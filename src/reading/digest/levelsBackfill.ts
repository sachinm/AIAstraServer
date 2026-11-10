/**
 * The dasha levels backfill (docs/reading-engine/67 step 4, scripts/backfill-dasha-levels.ts): for every kundli, re-pull
 * every served dasha type to three levels, lifelong (`levels: 3`, the catalogue's fixed params; never deeper), store the
 * trees in `kundli_data` as the chart pull does, and replace the kundli's lifelong `kundli_activation` rows (levels 1–3)
 * in one transaction. The deep levels (4–6) are never pulled here: only the dasha-deep worker pulls them, for a kundli in
 * focus. Dry run by default; a wet run first checks the engine (see `probeEngine`). Resumable through the progress store,
 * rate limited by the export client (RADHA_MAX_CONCURRENT, spacing) and `concurrency`. Nothing here computes astrology.
 */
import { DASHA_DEEP_TYPE, DASHA_LIFELONG_LEVELS, type ChartDataType } from '../chartData/catalog.js';
import { normalizeDasha } from '../chartData/dashaShape.js';
import { radhaRequestFields, type ChartDataRepo, type FetchResult, type RadhaFetcher } from '../chartData/store.js';
import { LIFELONG_MAX_LEVEL, type ActivationRowInput } from './activation.js';
import type { ActivationBand } from './activationWrite.js';

export const BACKFILL_AYANAMSA = 'LAHIRI';
const LEASE_MS = 90_000;

/**
 * The lifelong dasha types to re-pull: served natal `dasha.*` entries on a `dasha.*` wire type (the legacy
 * vimsottari_dasa / narayana_dasa rows take no params; their `.l3` rows carry level 3), not `applicable` or `deep`.
 */
export function lifelongDashaTypes(types: readonly ChartDataType[]): ChartDataType[] {
  return types
    .filter((t) => t.family === 'dasha' && t.served && t.changeClass === 'natal' && t.variantKind === 'natal')
    .filter((t) => t.id !== 'dasha.applicable' && t.id !== DASHA_DEEP_TYPE && t.radhaType.startsWith('dasha.'))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** The request fields for a type; refuses anything that would ask for more than three levels or for the deep window. */
export function lifelongRequest(t: ChartDataType): Record<string, unknown> {
  const params = t.fixedParams ? { ...t.fixedParams } : {};
  if ('max_level' in params || 'deep_from' in params || 'deep_to' in params) throw new Error(`${t.id}: the backfill never asks for the deep levels`);
  const lv = params.levels;
  if (lv != null && (typeof lv !== 'number' || lv > DASHA_LIFELONG_LEVELS)) throw new Error(`${t.id}: levels ${String(lv)} is deeper than ${DASHA_LIFELONG_LEVELS}`);
  return radhaRequestFields(t, params);
}

export interface EngineProbe {
  ok: boolean;
  /** the catalogue lists `max_level` with a value above 3 for the dasha types (the levels 1–6 engine is deployed) */
  deepEngine: boolean;
  /** depth of the probe kundli's three-level answer */
  depth: number | null;
  reason?: string;
}

const depthOf = (nodes: Array<{ children: unknown[] }>): number => (nodes.length ? 1 + Math.max(...nodes.map((n) => depthOf(n.children as Array<{ children: unknown[] }>))) : 0);

/**
 * The wet-run gate. (1) The engine's catalogue must list `max_level` with a value above 3 for `dasha.vimsottari`: the
 * engine with levels 1–6 is deployed (asked of the catalogue, so no level above 3 is ever requested). (2) A three-level
 * pull of `dasha.yogini` for the probe kundli must come back three levels deep.
 */
export async function probeEngine(
  deps: { fetchCatalog: () => Promise<{ types?: Array<{ type: string; params?: Record<string, unknown> }> }>; fetcher: RadhaFetcher; repo: Pick<ChartDataRepo, 'kundliRequest'>; types: readonly ChartDataType[] },
  probeKundliId: string,
): Promise<EngineProbe> {
  try {
    const cat = await deps.fetchCatalog();
    const v = (cat.types ?? []).find((t) => t.type === 'dasha.vimsottari');
    const ml = v?.params?.max_level as { allowed?: unknown[] } | undefined;
    const deepEngine = Array.isArray(ml?.allowed) && ml!.allowed!.some((x) => typeof x === 'number' && x > LIFELONG_MAX_LEVEL);
    if (!deepEngine) return { ok: false, deepEngine: false, depth: null, reason: 'the engine catalogue lists no max_level above 3 for dasha.vimsottari: the levels 1–6 engine is not deployed' };
    const t = deps.types.find((x) => x.id === 'dasha.yogini');
    if (!t) return { ok: false, deepEngine, depth: null, reason: 'dasha.yogini is not served' };
    const req = await deps.repo.kundliRequest(probeKundliId);
    if (!req) return { ok: false, deepEngine, depth: null, reason: 'probe kundli has no birth details' };
    const n = normalizeDasha(await deps.fetcher(req, t.radhaType, lifelongRequest(t)), { system: 'yogini' });
    const depth = n ? depthOf(n.periods) : null;
    if (!depth || depth < DASHA_LIFELONG_LEVELS) return { ok: false, deepEngine, depth, reason: `dasha.yogini came back ${depth ?? 0} levels deep, not ${DASHA_LIFELONG_LEVELS}` };
    return { ok: true, deepEngine, depth };
  } catch (err) {
    return { ok: false, deepEngine: false, depth: null, reason: `probe failed: ${String((err as Error).message ?? err).slice(0, 200)}` };
  }
}

export interface BackfillDeps {
  listKundlis: (q: { kundliId?: string; limit?: number }) => Promise<string[]>;
  repo: Pick<ChartDataRepo, 'claim' | 'complete' | 'kundliRequest'>;
  types: readonly ChartDataType[];
  fetcher: RadhaFetcher;
  /** the lifelong rows from what is stored now (loadDigestInputs + buildDigestRows + buildActivationRows, no writes) */
  buildRows: (kundliId: string) => Promise<ActivationRowInput[]>;
  writeBand: (kundliId: string, rows: ActivationRowInput[], band: ActivationBand) => Promise<{ deleted: number; inserted: number }>;
  counts: (kundliId: string) => Promise<Record<number, number>>;
  progress: { done: () => Promise<Set<string>>; mark: (kundliId: string, line: Record<string, unknown>) => Promise<void> };
  probe: () => Promise<EngineProbe>;
  log: (line: string) => void;
  concurrency?: number;
}

export interface BackfillPlanRow {
  kundliId: string;
  before: Record<number, number>;
  after?: Record<number, number>;
  pulled?: number;
  failed?: number;
  status: 'planned' | 'done' | 'skipped_done' | 'failed';
  error?: string;
}

export interface BackfillResult {
  dryRun: boolean;
  types: string[];
  probe: EngineProbe | null;
  refused: boolean;
  rows: BackfillPlanRow[];
}

const fmt = (c: Record<number, number>) => [1, 2, 3, 4, 5, 6].map((l) => `L${l}=${c[l] ?? 0}`).join(' ');

async function pool<T>(items: readonly T[], n: number, run: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, n), items.length) }, async () => { while (i < items.length) await run(items[i++]!); }));
}

export async function runLevelsBackfill(deps: BackfillDeps, opts: { dryRun: boolean; kundliId?: string; limit?: number; probeKundliId?: string }): Promise<BackfillResult> {
  const types = lifelongDashaTypes(deps.types);
  // fail early (and in the dry run too) if the catalogue would ever ask for more than three levels
  for (const t of types) lifelongRequest(t);
  const ids = await deps.listKundlis({ ...(opts.kundliId ? { kundliId: opts.kundliId } : {}), ...(opts.limit ? { limit: opts.limit } : {}) });
  const out: BackfillResult = { dryRun: opts.dryRun, types: types.map((t) => t.id), probe: null, refused: false, rows: [] };
  deps.log(`dasha levels backfill: ${ids.length} kundli(s), ${types.length} dasha types to ${DASHA_LIFELONG_LEVELS} levels${opts.dryRun ? ' (dry run: nothing is fetched or written)' : ''}`);
  if (!opts.dryRun) {
    out.probe = await deps.probe();
    if (!out.probe.ok) {
      out.refused = true;
      deps.log(`refused: ${out.probe.reason}`);
      return out;
    }
  }
  const done = await deps.progress.done();
  for (const kundliId of ids) {
    const before = await deps.counts(kundliId);
    if (done.has(kundliId)) {
      out.rows.push({ kundliId, before, status: 'skipped_done' });
      deps.log(`${kundliId.slice(0, 8)} already done (progress file); ${fmt(before)}`);
      continue;
    }
    if (opts.dryRun) {
      out.rows.push({ kundliId, before, status: 'planned' });
      deps.log(`${kundliId.slice(0, 8)} would re-pull ${types.length} types and rebuild levels 1–3; now ${fmt(before)}`);
      continue;
    }
    try {
      const req = await deps.repo.kundliRequest(kundliId);
      if (!req) throw new Error('kundli or birth details not found');
      let pulled = 0;
      let failed = 0;
      await pool(types, deps.concurrency ?? 2, async (t) => {
        const key = { dataType: t.id, variant: '' };
        const params = t.fixedParams ? { ...t.fixedParams } : {};
        if (!(await deps.repo.claim(kundliId, key, params, BACKFILL_AYANAMSA, LEASE_MS))) return;
        let result: FetchResult;
        try {
          result = { status: 'ready', payload: await deps.fetcher(req, t.radhaType, lifelongRequest(t)), calcVersion: t.calcVersion, params };
          pulled += 1;
        } catch (err) {
          // a failed re-pull leaves the stored payload as it was (complete writes the payload only when ready)
          result = { status: 'failed', error: String((err as Error).message ?? err).slice(0, 500), calcVersion: t.calcVersion };
          failed += 1;
        }
        await deps.repo.complete(kundliId, key, BACKFILL_AYANAMSA, result);
      });
      const rows = await deps.buildRows(kundliId);
      await deps.writeBand(kundliId, rows, { minLevel: 1, maxLevel: LIFELONG_MAX_LEVEL });
      const after = await deps.counts(kundliId);
      out.rows.push({ kundliId, before, after, pulled, failed, status: 'done' });
      await deps.progress.mark(kundliId, { pulled, failed, before, after });
      deps.log(`${kundliId.slice(0, 8)} pulled ${pulled}/${types.length} (failed ${failed}); before ${fmt(before)}; after ${fmt(after)}`);
    } catch (err) {
      const error = String((err as Error).message ?? err).slice(0, 300);
      out.rows.push({ kundliId, before, status: 'failed', error });
      deps.log(`${kundliId.slice(0, 8)} failed: ${error}`);
    }
  }
  return out;
}
