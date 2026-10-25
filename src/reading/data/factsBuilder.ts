/**
 * Builds and stores the chart-facts dossier for a kundli by asking the pyjhora Lambda (`type=facts`) once.
 * Called after kundli sync (kundliQueueService), by the backfill script, and lazily when a chat finds no dossier.
 * Coordinates returned by the engine are stored once on the kundli so nothing geocodes again.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { queueLog, queueLogError } from '../../lib/queueLogger.js';
import { hashText } from '../packs/selector.js';
import { EngineUnsupportedError, fetchFacts } from './engineClient.js';
import { FACTS_VERSION } from './store.js';

const inflight = new Map<string, Promise<BuildResult>>();

export type BuildResult =
  | { status: 'ready'; kundliId: string; dossierHash: string; ms: number }
  | { status: 'skipped'; kundliId: string; reason: string }
  | { status: 'failed'; kundliId: string; reason: string; unsupported: boolean };

/** Hash of the inputs the dossier depends on; a change (admin edit, new birth data) triggers a rebuild. */
export function sourceHash(parts: Array<string | number | null | undefined>): string {
  return createHash('sha256').update(parts.map((p) => String(p ?? '')).join('|')).digest('hex').slice(0, 16);
}

export function buildFactsForKundli(prisma: PrismaClient, kundliId: string, opts: { force?: boolean; asOf?: string } = {}): Promise<BuildResult> {
  const existing = inflight.get(kundliId);
  if (existing) return existing;
  const p = doBuild(prisma, kundliId, opts).finally(() => inflight.delete(kundliId));
  inflight.set(kundliId, p);
  return p;
}

async function doBuild(prisma: PrismaClient, kundliId: string, opts: { force?: boolean; asOf?: string }): Promise<BuildResult> {
  const t0 = Date.now();
  const kundli = await prisma.kundli.findUnique({
    where: { id: kundliId },
    select: { id: true, lat: true, lon: true, tz: true, facts_status: true, user: { select: { date_of_birth: true, place_of_birth: true, time_of_birth: true } } },
  });
  if (!kundli) return { status: 'skipped', kundliId, reason: 'kundli not found' };
  const src = sourceHash([kundli.user.date_of_birth, kundli.user.time_of_birth, kundli.user.place_of_birth, FACTS_VERSION]);

  if (!opts.force) {
    const row = await prisma.kundliFacts.findUnique({
      where: { kundli_id_facts_version: { kundli_id: kundliId, facts_version: FACTS_VERSION } },
      select: { source_hash: true, dossier_hash: true },
    });
    if (row && row.source_hash === src) return { status: 'skipped', kundliId, reason: 'up to date' };
  }

  await prisma.kundli.update({ where: { id: kundliId }, data: { facts_status: 'building' } });
  try {
    const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
    const dossier = await fetchFacts({ auth: kundli.user, coords: kundli }, { asOf });
    const dossierHash = hashText(JSON.stringify(dossier));
    const natalPoints = projectNatalPoints(dossier);
    await prisma.$transaction([
      prisma.kundliFacts.upsert({
        where: { kundli_id_facts_version: { kundli_id: kundliId, facts_version: FACTS_VERSION } },
        create: {
          kundli_id: kundliId,
          facts_version: FACTS_VERSION,
          engine_commit: dossier.engine.commit,
          ayanamsa: dossier.engine.ayanamsa,
          dossier: dossier as unknown as object,
          natal_points: natalPoints as unknown as object,
          dossier_hash: dossierHash,
          source_hash: src,
        },
        update: {
          engine_commit: dossier.engine.commit,
          ayanamsa: dossier.engine.ayanamsa,
          dossier: dossier as unknown as object,
          natal_points: natalPoints as unknown as object,
          dossier_hash: dossierHash,
          source_hash: src,
          built_at: new Date(),
        },
      }),
      prisma.kundli.update({
        where: { id: kundliId },
        data: { facts_status: 'ready', lat: dossier.birth.lat, lon: dossier.birth.lon, tz: dossier.birth.tz, place_resolved: dossier.birth.place || null },
      }),
    ]);
    const ms = Date.now() - t0;
    queueLog({ event: 'kundli_facts_built', kundli_id: kundliId, dossier_hash: dossierHash, ms });
    return { status: 'ready', kundliId, dossierHash, ms };
  } catch (err) {
    const unsupported = err instanceof EngineUnsupportedError;
    const reason = (err as Error).message.slice(0, 400);
    await prisma.kundli.update({ where: { id: kundliId }, data: { facts_status: 'failed' } }).catch(() => undefined);
    (unsupported ? queueLog : queueLogError)({ event: 'kundli_facts_failed', kundli_id: kundliId, unsupported, error: reason });
    return { status: 'failed', kundliId, reason, unsupported };
  }
}

/** Longitudes only (a pure projection of the dossier, no calculation) for the transit-vs-natal views. */
export function projectNatalPoints(d: { v: number; bodies: Record<string, { lon: number; sign: number; house: number; nak: { idx: number; name: string } }>; special_lagnas: Record<string, { lon: number; sign: number; house: number }>; arudhas: Record<string, { sign: number }> }): Record<string, unknown> {
  const points: Record<string, unknown> = {};
  for (const [code, b] of Object.entries(d.bodies)) points[code] = { lon: b.lon, sign: b.sign, house: b.house, nak: b.nak.name };
  for (const [code, s] of Object.entries(d.special_lagnas ?? {})) points[code] = { lon: s.lon, sign: s.sign, house: s.house };
  return { v: d.v, points, arudha_signs: Object.fromEntries(Object.entries(d.arudhas ?? {}).map(([k, a]) => [k, a.sign])) };
}

const lastAttempt = new Map<string, number>();
const COOLDOWN_MS = 10 * 60_000;

/**
 * Fire-and-forget build with a per-kundli cooldown, so a chat that finds no dossier (or an engine that does not serve
 * `facts` yet) cannot hammer the Lambda on every question.
 */
export function scheduleFactsBuild(prisma: PrismaClient, kundliId: string, opts: { force?: boolean } = {}): void {
  const last = lastAttempt.get(kundliId) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  lastAttempt.set(kundliId, Date.now());
  void buildFactsForKundli(prisma, kundliId, opts).catch((err) => {
    console.error(JSON.stringify({ msg: 'scheduleFactsBuild failed', error: (err as Error).message.slice(0, 300) }));
  });
}
