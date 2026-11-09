/**
 * The shared service behind the Self and Love boards (docs/reading-engine/54 §3), mirroring careerService: built once a
 * day per kundli into `area_builds` (area 'self' / 'love'), from the stored digest only. When the digest is not ready the
 * board says `preparing` and the digest is queued (`kundlis.digest_status = 'pending'` unless it is already building).
 * The person's own fact (`self.focus`, `love.status`, doc 48) picks the lead sub-area at read time and hides the
 * sub-areas that do not fit; the stored build is the same for every reading of the day.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { latestReadyBuild, refreshDue, storedValidity, validityOf, type ReadingValidity } from './validity.js';
import { runningYearSpan, shortestRunningPeriodSpan, withTechniqueOutput } from '../../techniques/outputStore.js';
import type { DateSpan } from '../../techniques/pieces.js';
import { activationFor as realActivationFor, type ActivationRow } from '../digest/activation.js';
import { loadDigest as realLoadDigest } from '../digest/load.js';
import { queueDigestBuild } from '../digest/event.js';
import type { DigestView } from '../digest/types.js';
import { asRangePayload, type TransitRangePayload } from '../chartData/transitRange.js';
import { openRow } from '../../lib/pii/rawSql.js';
import { getShadeShortHorizonMonths } from '../../config/env.js';
import { addMonthsIso } from '../timeline/months.js';
import { buildBoard, type AreaBoardBody, type AreaConfig, type BuiltBoard } from './houseLayers.js';
import { loadAreaFacts, loadTechniqueGovernance, recordTechniqueDecisions, resolveAreaShades } from './shadeResolver.js';

export interface BoardDeps {
  prisma: PrismaClient;
  loadDigest?: (prisma: PrismaClient, kundliId: string) => Promise<DigestView | null>;
  activationFor?: (prisma: PrismaClient, kundliId: string, q: { from: string; to: string; houses?: number[]; systems?: string[]; maxLevel?: 1 | 2 | 3; shortTo?: string; shortMaxLevel?: 1 | 2 | 3 }) => Promise<ActivationRow[]>;
  /** the kundli's stored sky overlay covering asOf; null when none is stored (never fetched here) */
  loadTransit?: (prisma: PrismaClient, kundliId: string, asOf: string) => Promise<TransitRangePayload | null>;
  /** ask the digest sweep to build this kundli */
  queueDigest?: (prisma: PrismaClient, kundliId: string) => Promise<void>;
  now?: () => Date;
}

export interface AreaSpec {
  area: 'self' | 'love';
  cfg: AreaConfig;
  agent: 'area.self_board' | 'area.love_board';
  /** the board's lead technique id (src/techniques/catalog.ts) */
  technique: string;
  factKey: 'self.focus' | 'love.status';
  fits: (subarea: string, fact: string | null) => boolean;
  lead: (fact: string | null) => string | null;
}

export type AreaBoardResult =
  | { status: 'no_kundli' }
  | { status: 'preparing' }
  | ({ status: 'ok'; built_at: string; cached: boolean; focus: string | null; ask: boolean; board: AreaBoardBody; refresh_due: boolean } & ReadingValidity);

/** `force`: the person asked for a fresh reading (docs/billing/03): skip the stored one and remake it. */
export interface BoardBuildOptions {
  force?: boolean;
}

const DECLINED = 'declined';

/** The years of activation the board reads: 12 months back (Looking back) to 30 years ahead (doc 53 §4.5). */
export function activationSpan(asOf: string): { from: string; to: string } {
  return { from: addMonthsIso(asOf, -13), to: addMonthsIso(asOf, 12 * 30) };
}

export function coerceSharedSkyPayload(raw: unknown, asOf: string): TransitRangePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const direct = asRangePayload(raw);
  if (direct) return direct;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.ingresses)) {
    return asRangePayload({
      from: typeof r.from === 'string' ? r.from : addMonthsIso(asOf, -6),
      to: typeof r.to === 'string' ? r.to : addMonthsIso(asOf, 18),
      planets: Array.isArray(r.planets) ? r.planets : ['Sa', 'Ju', 'Ra', 'Ke', 'Ma', 'Su'],
      natal: r.natal && typeof r.natal === 'object' ? r.natal : { lagna_sign: '', lagna_sign_index: 0, moon_sign: '', moon_sign_index: 0 },
      ingresses: r.ingresses,
      stations: Array.isArray(r.stations) ? r.stations : [],
      lunations: Array.isArray(r.lunations) ? r.lunations : [],
      eclipses: Array.isArray(r.eclipses) ? r.eclipses : [],
      sade_sati: Array.isArray(r.sade_sati) ? r.sade_sati : [],
      dhaiya: Array.isArray(r.dhaiya) ? r.dhaiya : [],
    });
  }
  return null;
}

export async function defaultLoadTransit(prisma: PrismaClient, kundliId: string, asOf: string): Promise<TransitRangePayload | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ payload: unknown }>>`SELECT "payload" FROM "kundli_transit_overlays"
      WHERE "kundli_id" = ${kundliId} AND "kind" = 'range' AND "from_date" <= ${asOf}::date AND "to_date" >= ${asOf}::date
      ORDER BY "fetched_at" DESC LIMIT 1`;
    if (rows[0]) {
      const opened = await openRow('kundli_transit_overlays', rows[0]);
      const parsed = coerceSharedSkyPayload(opened.payload, asOf);
      if (parsed) return parsed;
    }
  } catch (e) {
    console.warn('[area] sky overlay unreadable:', (e as Error).message);
  }
  // Universal shared transit sky fallback (no per-person storage required; shared across all kundlis)
  try {
    const sharedRows = await prisma.$queryRaw<Array<{ payload: unknown }>>`SELECT "payload" FROM "transit_range_skies"
      WHERE "from_date" <= ${asOf}::date AND "to_date" >= ${asOf}::date
      ORDER BY "fetched_at" DESC LIMIT 1`;
    if (sharedRows[0]) {
      const opened = await openRow('transit_range_skies', sharedRows[0]).catch(() => sharedRows[0]!);
      const parsed = coerceSharedSkyPayload(opened.payload, asOf);
      if (parsed) return parsed;
    }
  } catch {
    // table may not exist in unit-test mock prisma
  }
  return null;
}

/**
 * The board found the digest not ready: mark it pending (unless building or ready) and start the build now (an async
 * self-invoke on Lambda, in process off it), so the person waits a minute, not a sweep interval. The sweep stays the
 * safety net. Never throws.
 */
export async function defaultQueueDigest(prisma: PrismaClient, kundliId: string): Promise<void> {
  await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: { notIn: ['building', 'pending', 'ready'] } }, data: { digest_status: 'pending' } });
  await queueDigestBuild(prisma, kundliId).catch(() => undefined);
}

/** The digest sections a board build reads, for the run's `charts` (docs/admin/03 §4.1). */
export function boardChartsRead(view: DigestView, transit: boolean): ChartUsed[] {
  const v = view.version;
  return [
    ...(['house', 'planet', 'yoga', 'point', 'annual', 'star'] as const).map((s) => ({ type: `digest.${s}`, variant: v })),
    { type: 'kundli_activation', variant: v },
    ...(transit ? [{ type: 'transit_range', variant: 'overlay' }] : []),
  ];
}

export async function getFact(prisma: PrismaClient, userId: string, key: string): Promise<string | null> {
  const f = await prisma.personFact.findUnique({ where: { user_id_key: { user_id: userId, key } } });
  return f?.value ?? null;
}

async function getUserAgeYears(prisma: PrismaClient, userId: string, asOf: string): Promise<number | null> {
  try {
    const authModel = (prisma as unknown as { auth?: { findUnique?: (q: unknown) => Promise<{ date_of_birth?: string | null } | null> } }).auth;
    if (!authModel?.findUnique) return null;
    const row = await authModel.findUnique({ where: { id: userId }, select: { date_of_birth: true } });
    const dob = row?.date_of_birth;
    if (!dob || !/^\d{4}/.test(dob)) return null;
    const birthYear = Number(dob.slice(0, 4));
    const refYear = Number(asOf.slice(0, 4));
    if (!Number.isFinite(birthYear) || !Number.isFinite(refYear) || refYear <= birthYear) return null;
    return refYear - birthYear;
  } catch {
    return null;
  }
}

/** What the person sees: the sub-areas that fit their fact, the lead first. */
export function shapeBoard(built: BuiltBoard, spec: AreaSpec, fact: string | null): { focus: string | null; board: AreaBoardBody } {
  const usable = fact === DECLINED ? null : fact;
  const ahead = built.board.ahead.filter((w) => spec.fits(w.subarea, usable));
  const present = [...new Set(ahead.map((w) => w.subarea))];
  let focus = spec.lead(usable);
  if (focus && !spec.fits(focus, usable)) focus = null;
  if (!focus) focus = present.sort((a, b) => (built.subareaScores[b] ?? 0) - (built.subareaScores[a] ?? 0))[0] ?? null;
  const order = spec.cfg.subareas.map((s) => s.id);
  const rank = (s: string) => (s === focus ? -1 : order.indexOf(s));
  ahead.sort((a, b) => rank(a.subarea) - rank(b.subarea) || a.from.localeCompare(b.from));
  return { focus, board: { ...built.board, ahead } };
}

export async function getAreaBoard(deps: BoardDeps, spec: AreaSpec, userId: string, opts: BoardBuildOptions = {}): Promise<AreaBoardResult> {
  const prisma = deps.prisma;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 'no_kundli' };
  const nowAt = (deps.now ?? (() => new Date()))();
  const asOf = nowAt.toISOString().slice(0, 10);
  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  const fact = await getFact(prisma, userId, spec.factKey);

  // offline first (docs/billing/03): the newest reading made for this board is served, whatever its day; only the very
  // first one is made here (free), and a fresh one only when the person asks (`force`)
  const cached = opts.force ? null : await latestReadyBuild(prisma, kundli.id, spec.area);
  const builtOn = cached ? cached.as_of.toISOString().slice(0, 10) : asOf;
  let built: BuiltBoard | null = cached ? (cached.result as unknown as BuiltBoard) : null;
  let validity = built ? storedValidity(cached?.result, cached?.created_at, builtOn) : null;
  let fresh = false;
  if (!built) {
    const view = await (deps.loadDigest ?? realLoadDigest)(prisma, kundli.id);
    if (!view) {
      await (deps.queueDigest ?? defaultQueueDigest)(prisma, kundli.id).catch((e) => console.warn('[area] digest queue failed:', (e as Error).message));
      return { status: 'preparing' };
    }
    const activationFor = deps.activationFor ?? realActivationFor;
    const span = activationSpan(asOf);
    const yearSpan = runningYearSpan(view, nowAt);
    const out = await withTechniqueOutput(
      prisma,
      {
        technique: spec.technique,
        kundliId: kundli.id,
        forceRefresh: Boolean(opts.force),
        digestVersion: view.version,
        context: { now: nowAt, year: yearSpan },
        agentId: spec.agent,
        userId,
        charts: boardChartsRead(view, false),
      },
      async () => {
        let runningSpan: DateSpan | null = null;
        const builtBoard = await withAgentRun(
          prisma,
          spec.agent,
          { userId, task: `${spec.area} ${asOf}`, input: { span_from: span.from, span_to: span.to, version: view.version }, technique: spec.technique, kundliId: kundli.id },
          async () => {
            const shortTo = addMonthsIso(asOf, getShadeShortHorizonMonths());
            const [activation, running, transit, areaFacts, ageYears] = await Promise.all([
              activationFor(prisma, kundli.id, { ...span, houses: spec.cfg.houses, maxLevel: 2, shortTo, shortMaxLevel: 3 }),
              activationFor(prisma, kundli.id, { from: asOf, to: asOf, maxLevel: 3 }),
              (deps.loadTransit ?? defaultLoadTransit)(prisma, kundli.id, asOf),
              loadAreaFacts(prisma, userId, spec.area, { key: spec.factKey, value: fact }),
              getUserAgeYears(prisma, userId, asOf),
              loadTechniqueGovernance(prisma),
            ]);
            runningSpan = shortestRunningPeriodSpan(running, nowAt);
            const b = buildBoard({ view, cfg: spec.cfg, asOf, activation, running, transit, ageYears });
            const receipts = resolveAreaShades({
              view,
              cfg: spec.cfg,
              asOf,
              built: b,
              activation,
              facts: areaFacts,
            });
            const logged = await recordTechniqueDecisions(prisma, { kundliId: kundli.id, userId }, receipts);
            const writes = logged > 0 ? ['area_builds:1', `technique_decision_logs:${logged}`] : ['area_builds:1'];
            return {
              value: b,
              output: { tone: b.board.tone.tone, confidence: b.board.tone.confidence, supports: b.board.supports.length, pressures: b.board.pressures.length, ahead: b.board.ahead.length, shades: receipts.length, writes, ...b.counts },
              charts: boardChartsRead(view, transit !== null),
            };
          },
        );
        return {
          value: builtBoard,
          context: { runningPeriod: runningSpan, year: yearSpan },
        };
      },
    );
    built = out.value;
    validity = validityOf(out, asOf);
    const stored = { ...built, validity } as unknown as object;
    await prisma.areaBuild
      .upsert({
        where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: spec.area, as_of: asOfDate } },
        create: { user_id: userId, kundli_id: kundli.id, area: spec.area, as_of: asOfDate, status: 'ready', result: stored },
        update: { status: 'ready', result: stored, error: null },
      })
      .catch(() => undefined);
    fresh = !out.cached;
  }
  const shaped = shapeBoard(built, spec, fact);
  const v = validity ?? storedValidity(null, null, builtOn);
  return { status: 'ok', built_at: builtOn, cached: !fresh, focus: shaped.focus, ask: fact === null, board: shaped.board, ...v, refresh_due: refreshDue(v.valid_until, asOf) };
}
