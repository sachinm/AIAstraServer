/**
 * The dasha levels backfill (docs/reading-engine/67 step 4, scripts/backfill-dasha-levels.ts): for every kundli, re-pull
 * every served dasha type to three levels, lifelong (`levels: 3`, the catalogue's fixed params; never deeper), store the
 * trees in `kundli_data` as the chart pull does, and replace the kundli's lifelong `kundli_activation` rows (levels 1–3)
 * in one transaction. The deep levels (4–6) are never pulled here: only the dasha-deep worker pulls them, for a kundli in
 * focus. Dry run by default; a wet run first checks the engine (see `probeEngine`). Resumable through the progress store,
 * rate limited by the export client (RADHA_MAX_CONCURRENT, spacing) and `concurrency`. Nothing here computes astrology.
 *
 * Safety (2026-11-09 disk-full incident, docs/TODOS.md):
 *   - Never strip on failure: only the systems whose pull came back as a complete tree THIS run (and was stored) are
 *     replaced, per kundli, in one transaction (delete + insert of that kundli's levels 1-3 for exactly those systems).
 *     A failed, locked or empty pull leaves that system's rows untouched; when every pull failed nothing is written.
 *   - Disk guard (src/reading/digest/diskGuard.ts): a wet run refuses without DB_DISK_LIMIT_BYTES; before the run, before
 *     every kundli's write and after every kundli it reads the database size and stops when size + estimate would pass
 *     DB_DISK_LIMIT_BYTES x DB_DISK_MAX_FILL. The dry run prints the byte estimate.
 */
import { DASHA_DEEP_TYPE, DASHA_LIFELONG_LEVELS, type ChartDataType } from '../chartData/catalog.js';
import { normalizeDasha } from '../chartData/dashaShape.js';
import { radhaRequestFields, type ChartDataRepo, type FetchResult, type RadhaFetcher } from '../chartData/store.js';
import { dashaSystemOfKey, LIFELONG_MAX_LEVEL, type ActivationRowInput } from './activation.js';
import { DB_DISK_LIMIT_HINT, FALLBACK_ACTIVATION_BYTES_PER_ROW, type DiskGuard, type DiskVerdict } from './diskGuard.js';
import type { ActivationBand } from './activationWrite.js';

export const BACKFILL_AYANAMSA = 'LAHIRI';
const LEASE_MS = 90_000;
/**
 * Rows one kundli adds when nothing better is known (the dry run before the three-level trees are stored, the check
 * before the next kundli): measured 2026-11-09 at 31k-47k level-3 rows per kundli over 47 dasha types, plus levels 1-2.
 */
export const PLAN_ROWS_PER_KUNDLI = 50_000;

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
  /**
   * The lifelong rows (no writes). `fresh` holds this run's complete pulls by type id; the rows of those systems must be
   * built from them (the stored trees of other dasha systems may be left out). With `fresh` empty (the dry run's
   * estimate): the rows from what is stored now.
   */
  buildRows: (kundliId: string, fresh: Record<string, unknown>) => Promise<ActivationRowInput[]>;
  writeBand: (kundliId: string, rows: ActivationRowInput[], band: ActivationBand) => Promise<{ deleted: number; inserted: number }>;
  counts: (kundliId: string) => Promise<Record<number, number>>;
  progress: { done: () => Promise<Set<string>>; mark: (kundliId: string, line: Record<string, unknown>) => Promise<void> };
  probe: () => Promise<EngineProbe>;
  /** the database disk guard; a wet run refuses without one (or without DB_DISK_LIMIT_BYTES) */
  disk?: DiskGuard;
  log: (line: string) => void;
  concurrency?: number;
}

export interface BackfillPlanRow {
  kundliId: string;
  before: Record<number, number>;
  after?: Record<number, number>;
  pulled?: number;
  failed?: number;
  /** systems whose rows were replaced */
  replaced?: string[];
  /** dry run: rows this kundli is expected to add, and the bytes */
  estimateRows?: number;
  estimateBytes?: number;
  /** done: every type pulled; partial: some failed (their rows kept, not marked done, a rerun retries); failed: nothing written */
  status: 'planned' | 'done' | 'partial' | 'skipped_done' | 'failed' | 'stopped_disk';
  error?: string;
}

export interface BackfillResult {
  dryRun: boolean;
  types: string[];
  probe: EngineProbe | null;
  refused: boolean;
  /** the disk guard stopped the run (before it or part-way) */
  stoppedForDisk: boolean;
  disk: DiskVerdict | null;
  rows: BackfillPlanRow[];
}

const fmt = (c: Record<number, number>) => [1, 2, 3, 4, 5, 6].map((l) => `L${l}=${c[l] ?? 0}`).join(' ');
const mb = (b: number) => `${(b / 1_048_576).toFixed(1)} MB`;

async function pool<T>(items: readonly T[], n: number, run: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, n), items.length) }, async () => { while (i < items.length) await run(items[i++]!); }));
}

/** A complete tree: the engine answer normalises to a dasha tree with at least one period. */
function completeTree(payload: unknown, typeId: string): boolean {
  const n = normalizeDasha(payload, { system: dashaSystemOfKey(typeId) ?? typeId });
  return Boolean(n && n.periods.length);
}

export async function runLevelsBackfill(deps: BackfillDeps, opts: { dryRun: boolean; kundliId?: string; limit?: number; probeKundliId?: string }): Promise<BackfillResult> {
  const types = lifelongDashaTypes(deps.types);
  // fail early (and in the dry run too) if the catalogue would ever ask for more than three levels
  for (const t of types) lifelongRequest(t);
  const ids = await deps.listKundlis({ ...(opts.kundliId ? { kundliId: opts.kundliId } : {}), ...(opts.limit ? { limit: opts.limit } : {}) });
  const out: BackfillResult = { dryRun: opts.dryRun, types: types.map((t) => t.id), probe: null, refused: false, stoppedForDisk: false, disk: null, rows: [] };
  deps.log(`dasha levels backfill: ${ids.length} kundli(s), ${types.length} dasha types to ${DASHA_LIFELONG_LEVELS} levels${opts.dryRun ? ' (dry run: nothing is fetched or written)' : ''}`);
  const done = await deps.progress.done();

  if (opts.dryRun) {
    const bpr = deps.disk ? await deps.disk.bytesPerRow() : null;
    let totalRows = 0;
    for (const kundliId of ids) {
      const before = await deps.counts(kundliId);
      if (done.has(kundliId)) {
        out.rows.push({ kundliId, before, status: 'skipped_done' });
        deps.log(`${kundliId.slice(0, 8)} already done (progress file); ${fmt(before)}`);
        continue;
      }
      const stored = await deps.buildRows(kundliId, {}).then((r) => r.length).catch(() => 0);
      const estimateRows = Math.max(stored, PLAN_ROWS_PER_KUNDLI);
      totalRows += estimateRows;
      const estimateBytes = bpr != null ? Math.ceil(estimateRows * bpr) : undefined;
      out.rows.push({ kundliId, before, status: 'planned', estimateRows, ...(estimateBytes != null ? { estimateBytes } : {}) });
      deps.log(`${kundliId.slice(0, 8)} would re-pull ${types.length} types and rebuild levels 1–3; now ${fmt(before)}; adds ~${estimateRows} rows${estimateBytes != null ? ` ≈ ${mb(estimateBytes)}` : ''}`);
    }
    if (deps.disk) {
      out.disk = await deps.disk.check(totalRows);
      deps.log(`dry-run byte estimate: ${totalRows} rows × ${(bpr ?? 0).toFixed(0)} B ≈ ${mb(out.disk.estimateBytes)} for ${out.rows.filter((r) => r.status === 'planned').length} kundli(s)`);
      deps.log(out.disk.message);
      if (out.disk.thresholdBytes != null && !out.disk.ok) {
        const room = Math.max(0, out.disk.thresholdBytes - out.disk.sizeBytes);
        deps.log(`the wet run would stop after about ${Math.floor(room / (PLAN_ROWS_PER_KUNDLI * (bpr ?? FALLBACK_ACTIVATION_BYTES_PER_ROW)))} kundli(s)`);
      }
    } else deps.log(`no disk guard: ${DB_DISK_LIMIT_HINT}`);
    return out;
  }

  // wet run: the disk guard first (no engine call, no write without it), then the engine probe
  if (!deps.disk || deps.disk.limits.limitBytes == null) {
    out.refused = true;
    deps.log(`refused: ${deps.disk?.limits.problem ?? `no disk guard: ${DB_DISK_LIMIT_HINT}`}`);
    return out;
  }
  const disk = deps.disk;
  const stop = (v: DiskVerdict, where: string): void => {
    out.disk = v;
    out.stoppedForDisk = true;
    out.refused = true;
    deps.log(`stopped ${where}: ${v.message}`);
  };
  if (ids.some((id) => !done.has(id))) {
    const v = await disk.check(PLAN_ROWS_PER_KUNDLI);
    out.disk = v;
    deps.log(v.message);
    if (!v.ok) {
      stop(v, 'before the run');
      return out;
    }
  }
  out.probe = await deps.probe();
  if (!out.probe.ok) {
    out.refused = true;
    deps.log(`refused: ${out.probe.reason}`);
    return out;
  }
  for (const [index, kundliId] of ids.entries()) {
    const before = await deps.counts(kundliId);
    if (done.has(kundliId)) {
      out.rows.push({ kundliId, before, status: 'skipped_done' });
      deps.log(`${kundliId.slice(0, 8)} already done (progress file); ${fmt(before)}`);
      continue;
    }
    try {
      const req = await deps.repo.kundliRequest(kundliId);
      if (!req) throw new Error('kundli or birth details not found');
      const fresh: Record<string, unknown> = {};
      let failed = 0;
      await pool(types, deps.concurrency ?? 2, async (t) => {
        const key = { dataType: t.id, variant: '' };
        const params = t.fixedParams ? { ...t.fixedParams } : {};
        try {
          // locked by another pull: not fresh, its rows stay
          if (!(await deps.repo.claim(kundliId, key, params, BACKFILL_AYANAMSA, LEASE_MS))) throw new Error('locked by another pull');
        } catch (err) {
          failed += 1;
          deps.log(`${kundliId.slice(0, 8)} ${t.id} not pulled, its rows are kept: ${String((err as Error).message ?? err).slice(0, 120)}`);
          return;
        }
        let result: FetchResult;
        try {
          const payload = await deps.fetcher(req, t.radhaType, lifelongRequest(t));
          if (!completeTree(payload, t.id)) throw new Error('engine answer is not a complete dasha tree');
          result = { status: 'ready', payload, calcVersion: t.calcVersion, params };
        } catch (err) {
          // a failed re-pull leaves the stored payload as it was (complete writes the payload only when ready)
          result = { status: 'failed', error: String((err as Error).message ?? err).slice(0, 500), calcVersion: t.calcVersion };
        }
        try {
          await deps.repo.complete(kundliId, key, BACKFILL_AYANAMSA, result);
        } catch (err) {
          // e.g. disk full: the payload is not stored, so this system is not replaced either
          result = { status: 'failed', error: `store: ${String((err as Error).message ?? err).slice(0, 200)}`, calcVersion: t.calcVersion };
        }
        if (result.status === 'ready') fresh[t.id] = result.payload;
        else {
          failed += 1;
          deps.log(`${kundliId.slice(0, 8)} ${t.id} failed, its rows are kept: ${(result.error ?? '').slice(0, 120)}`);
        }
      });
      const pulled = Object.keys(fresh).length;
      if (!pulled) {
        out.rows.push({ kundliId, before, pulled, failed, status: 'failed', error: 'every pull failed: nothing written' });
        deps.log(`${kundliId.slice(0, 8)} every pull failed (${failed}/${types.length}): nothing written; ${fmt(before)}`);
      } else {
        const systems = [...new Set(Object.keys(fresh).map(dashaSystemOfKey).filter((s): s is string => Boolean(s)))].sort();
        const rows = (await deps.buildRows(kundliId, fresh)).filter((r) => r.level >= 1 && r.level <= LIFELONG_MAX_LEVEL && systems.includes(r.system));
        const v = await disk.check(rows.length);
        if (!v.ok) {
          out.rows.push({ kundliId, before, pulled, failed, status: 'stopped_disk', error: v.message });
          stop(v, `before writing ${kundliId.slice(0, 8)}`);
          return out;
        }
        await deps.writeBand(kundliId, rows, { minLevel: 1, maxLevel: LIFELONG_MAX_LEVEL, systems });
        const after = await deps.counts(kundliId);
        const status = failed ? 'partial' : 'done';
        out.rows.push({ kundliId, before, after, pulled, failed, replaced: systems, status });
        // a partial kundli is not marked done: a rerun retries it (the failed systems kept their rows meanwhile)
        if (!failed) await deps.progress.mark(kundliId, { pulled, failed, before, after });
        deps.log(`${kundliId.slice(0, 8)} pulled ${pulled}/${types.length} (failed ${failed}); replaced ${systems.length} system(s), ${rows.length} rows; before ${fmt(before)}; after ${fmt(after)}`);
      }
    } catch (err) {
      // a write error rolls back this kundli's one transaction: its rows stay as they were
      const error = String((err as Error).message ?? err).slice(0, 300);
      out.rows.push({ kundliId, before, status: 'failed', error });
      deps.log(`${kundliId.slice(0, 8)} failed (its rows are as they were): ${error}`);
    }
    // after every kundli: is there room for the next one?
    if (index < ids.length - 1) {
      const v = await disk.check(PLAN_ROWS_PER_KUNDLI);
      out.disk = v;
      if (!v.ok) {
        stop(v, `after ${kundliId.slice(0, 8)}`);
        return out;
      }
    }
  }
  return out;
}
