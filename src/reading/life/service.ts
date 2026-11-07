/**
 * The life reading service (docs/reading-engine/54 §4; doc 34 Part 1): built once a day per kundli from the stored digest
 * and activation calendar, kept in `area_builds` with area 'life'. When the digest is not ready the answer is
 * 'preparing' and the digest is queued (kundlis.digest_status = 'pending', picked up by the digest sweep) unless it is
 * already building. Composed by code; no model call.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun, type ChartUsed } from '../../agents/registry.js';
import { getLifeCharterHorizonYears, getLifeHorizonYears } from '../../config/env.js';
import { ACTIVATION_YEARS_AHEAD, activationFor as activationForDb } from '../digest/activation.js';
import { digestStatusOf as digestStatusOfDb, loadDigest as loadDigestDb } from '../digest/load.js';
import type { ActivationRow } from '../digest/activation.js';
import type { DigestStatus, DigestView } from '../digest/types.js';
import { allAreaHouses, LIFE_AREAS } from './areas.js';
import { composeDashboard, type LifeAreaRow, type LifeMahadashaCharter, type PersonFacts } from './compose.js';
import { addYears, covers } from './labels.js';
import { promiseScale } from './promise.js';
import { loadStoredSky, type SkyView } from './sky.js';
import { areaTiming } from './timing.js';

export const LIFE_HORIZON_YEARS = getLifeHorizonYears();
export const LIFE_AREA_KEY = 'life';
const FACT_KEYS = ['work.status', 'love.status', 'family.children'] as const;

export type LifeReading =
  | { status: 'no_kundli' }
  | { status: 'preparing' }
  | {
      status: 'ok';
      built_at: string;
      cached: boolean;
      rule_now: string | null;
      areas: LifeAreaRow[];
      charter: LifeMahadashaCharter | null;
    };

export interface LifeDeps {
  prisma: PrismaClient;
  now?: () => Date;
  /** tests: the digest without the database */
  loadDigest?: (kundliId: string) => Promise<DigestView | null>;
  digestStatusOf?: (kundliId: string) => Promise<{ status: DigestStatus; version: string | null }>;
  activationFor?: (kundliId: string, q: { from: string; to: string; houses?: number[]; maxLevel?: 1 | 2 | 3 }) => Promise<ActivationRow[]>;
  loadSky?: (kundliId: string) => Promise<{ sky: SkyView; id: string } | null>;
}

async function readFacts(prisma: PrismaClient, userId: string): Promise<PersonFacts> {
  const rows = await prisma.personFact.findMany({ where: { user_id: userId, key: { in: [...FACT_KEYS] } } }).catch(() => []);
  const out: PersonFacts = {};
  for (const r of rows) if (r.value && r.value !== 'declined') out[r.key as keyof PersonFacts] = r.value;
  return out;
}

/** Queue the digest unless it is already queued or building (the digest sweep builds 'pending' kundlis). */
async function queueDigest(prisma: PrismaClient, kundliId: string, status: DigestStatus): Promise<void> {
  if (status === 'building' || status === 'pending' || status === 'ready') return;
  await prisma.kundli.update({ where: { id: kundliId }, data: { digest_status: 'pending' } }).catch(() => undefined);
}

export async function getLifeReading(deps: LifeDeps, userId: string): Promise<LifeReading> {
  const { prisma } = deps;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 'no_kundli' };
  const today = (deps.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const asOfDate = new Date(`${today}T00:00:00Z`);

  const cached = await prisma.areaBuild.findUnique({ where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: LIFE_AREA_KEY, as_of: asOfDate } } });
  if (cached?.status === 'ready' && cached.result && 'charter' in (cached.result as Record<string, unknown>)) {
    const r = cached.result as unknown as { rule_now: string | null; areas: LifeAreaRow[]; charter?: LifeMahadashaCharter | null };
    return { status: 'ok', built_at: today, cached: true, rule_now: r.rule_now, areas: r.areas, charter: r.charter ?? null };
  }

  const st = await (deps.digestStatusOf ? deps.digestStatusOf(kundli.id) : digestStatusOfDb(prisma, kundli.id));
  if (st.status !== 'ready') {
    await queueDigest(prisma, kundli.id, st.status);
    return { status: 'preparing' };
  }
  const view = await (deps.loadDigest ? deps.loadDigest(kundli.id) : loadDigestDb(prisma, kundli.id));
  if (!view) return { status: 'preparing' };

  const horizonYears = getLifeHorizonYears();
  const horizonEnd = addYears(today, horizonYears);
  const activationEnd = addYears(today, Math.max(horizonYears, getLifeCharterHorizonYears(), ACTIVATION_YEARS_AHEAD));
  const dashboard = await withAgentRun(
    prisma,
    'life.dashboard',
    {
      userId,
      task: `life reading ${today}`,
      input: { horizon_years: horizonYears, areas: LIFE_AREAS.length },
      technique: 'life.dashboard',
      kundliId: kundli.id,
      charts: [{ type: 'kundli_digest', variant: view.version }, { type: 'kundli_activation', variant: `${today}_${activationEnd}` }],
    },
    async () => {
      const q = { from: today, to: activationEnd, houses: allAreaHouses(), maxLevel: 2 as const };
      const rows = await (deps.activationFor ? deps.activationFor(kundli.id, q) : activationForDb(prisma, kundli.id, q));
      const stored = await (deps.loadSky ? deps.loadSky(kundli.id) : loadStoredSky(prisma, kundli.id));
      const sky = stored?.sky ?? null;
      const facts = await readFacts(prisma, userId);
      const running = rows.filter((r) => covers(r, today));
      const year = Number(today.slice(0, 4));
      const thisYear = view.annual(year);
      const built = LIFE_AREAS.map((area) => {
        const promise = promiseScale(view, area, { today, running, annual: thisYear, sky });
        const timing = areaTiming(view, area, promise, { today, horizonEnd, rows, annual: (y) => view.annual(y), sky });
        return { area, promise, timing };
      });
      const d = composeDashboard(view, built, running, today, facts, { rows, annual: (y) => view.annual(y), sky });
      const charts: ChartUsed[] = stored ? [{ type: 'transit_snapshot', variant: stored.id.slice(0, 8) }] : [];
      return {
        value: d,
        output: {
          shown: d.areas.length,
          dated: d.areas.reduce((s, a) => s + a.improves.length, 0),
          strong: d.areas.filter((a) => a.grade === 'strong').length,
          moderate: d.areas.filter((a) => a.grade === 'moderate').length,
          charter_ads: d.charter?.antardashas.length ?? 0,
          charter_areas: d.charter?.area_charters.length ?? 0,
          activation_rows: rows.length,
          sky: sky ? 'stored' : 'none',
          writes: ['area_builds:1'],
        },
        charts,
      };
    },
  );

  await prisma.areaBuild
    .upsert({
      where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: LIFE_AREA_KEY, as_of: asOfDate } },
      create: { user_id: userId, kundli_id: kundli.id, area: LIFE_AREA_KEY, as_of: asOfDate, status: 'ready', result: dashboard as unknown as object },
      update: { status: 'ready', result: dashboard as unknown as object, error: null },
    })
    .catch(() => undefined);
  return { status: 'ok', built_at: today, cached: false, rule_now: dashboard.rule_now, areas: dashboard.areas, charter: dashboard.charter };
}
