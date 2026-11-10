import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_CHART_TYPES, type ChartDataType } from '../../../../src/reading/chartData/catalog.js';
import { lifelongDashaTypes, lifelongRequest, PLAN_ROWS_PER_KUNDLI, probeEngine, runLevelsBackfill, type BackfillDeps } from '../../../../src/reading/digest/levelsBackfill.js';
import { dashaSystemOfKey, type ActivationRowInput } from '../../../../src/reading/digest/activation.js';
import { createDiskGuard, diskLimitsFromEnv, judgeDisk, type DiskProbe } from '../../../../src/reading/digest/diskGuard.js';
import { loadFixture } from './helpers.js';

const fx = loadFixture();
const l3 = fx.items['dasha.vimsottari.l3'];
// every dasha entry served, as the catalogue sync marks them once the engine lists them
const TYPES: ChartDataType[] = BUILTIN_CHART_TYPES.map((t) => (t.family === 'dasha' && t.id !== 'dasha.deep' && t.id !== 'dasha.brahma' ? { ...t, served: true } : t));
const NEW_CATALOG = { types: [{ type: 'dasha.vimsottari', params: { levels: { default: 2, allowed: [1, 2, 3] }, max_level: { default: 6, allowed: [1, 2, 3, 4, 5, 6] } } }] };
const OLD_CATALOG = { types: [{ type: 'dasha.vimsottari', params: { levels: { default: 2, allowed: [1, 2, 3] } } }] };

const GB5 = 5_368_709_120;
/** a disk probe with a set size (bytes) and bytes per row; `grow` bytes are added after every size read */
function memDisk(size: number, bytesPerRow: number | null = 350, grow = 0) {
  const state = { size, reads: 0 };
  const probe: DiskProbe = {
    databaseSize: async () => {
      state.reads += 1;
      const s = state.size;
      state.size += grow;
      return s;
    },
    activationBytesPerRow: async () => bytesPerRow,
  };
  return { state, probe };
}

/** a kundli's activation rows for these systems (levels 1-3) */
function rowsFor(systems: string[]): ActivationRowInput[] {
  return systems.flatMap((system) => [1, 2, 3].map((level) => ({ system, family: 'other' as const, level: level as 1 | 2 | 3, lord: 'Mo', sign: null, from: '2000-01-01', to: '2001-01-01', houses: [1], parentLord: null })));
}

function harness(catalog: { types: Array<{ type: string; params?: Record<string, unknown> }> } = NEW_CATALOG, disk = memDisk(1_000_000_000).probe) {
  const fetched: Array<{ type: string; extra: Record<string, unknown> }> = [];
  const fetcher = vi.fn(async (_req: unknown, type: string, extra: Record<string, unknown>) => {
    fetched.push({ type, extra });
    return l3;
  });
  const done = new Set<string>(['k0']);
  const writes: Array<{ id: string; band: unknown }> = [];
  const claim = vi.fn(async () => true);
  const complete = vi.fn(async (_k: string, _key: { dataType: string }, _a?: string, _r?: unknown): Promise<void> => undefined);
  const repo = { claim, complete, kundliRequest: async () => ({ params: {} as never, coords: null }) };
  const deps: BackfillDeps = {
    listKundlis: async (q) => (q.kundliId ? [q.kundliId] : ['k0', 'k1', 'k2'].slice(0, q.limit ?? 3)),
    repo,
    types: TYPES,
    fetcher,
    buildRows: async (_id, fresh) => rowsFor(Object.keys(fresh).map((k) => dashaSystemOfKey(k)).filter((x): x is string => Boolean(x))),
    writeBand: async (id, _rows, band) => (writes.push({ id, band }), { deleted: 5, inserted: 1 }),
    counts: async () => ({ 1: 10, 2: 80, 3: 0 }),
    progress: { done: async () => done, mark: async (id) => void done.add(id) },
    probe: () => probeEngine({ fetchCatalog: async () => catalog, fetcher, repo, types: TYPES }, 'k1'),
    disk: createDiskGuard(disk, diskLimitsFromEnv({ DB_DISK_LIMIT_BYTES: String(GB5) })),
    log: () => undefined,
  };
  return { deps, fetched, fetcher, writes, claim, complete, done };
}

describe('dasha levels backfill (doc 67 step 4)', () => {
  it('asks every lifelong dasha type for three levels at most and never for the deep window', () => {
    const types = lifelongDashaTypes(TYPES);
    expect(types.map((t) => t.id)).toContain('dasha.yogini');
    expect(types.map((t) => t.id)).toContain('dasha.narayana.l3');
    expect(types.map((t) => t.id)).not.toContain('dasha.vimsottari'); // legacy wire type, no params
    expect(types.map((t) => t.id)).not.toContain('dasha.deep');
    for (const t of types) {
      const req = lifelongRequest(t);
      const params = (req.params ?? {}) as Record<string, unknown>;
      expect(params.max_level).toBeUndefined();
      expect(params.deep_from).toBeUndefined();
      expect((params.levels as number | undefined) ?? 0).toBeLessThanOrEqual(3);
    }
    expect(() => lifelongRequest({ ...types[0]!, fixedParams: { max_level: 6 } })).toThrow(/never asks for the deep levels/);
  });

  it('dry run (default) plans: lists kundlis and rows now, fetches and writes nothing', async () => {
    const h = harness();
    const r = await runLevelsBackfill(h.deps, { dryRun: true });
    expect(r.rows.map((x) => x.status)).toEqual(['skipped_done', 'planned', 'planned']);
    expect(r.rows[1]!.before).toEqual({ 1: 10, 2: 80, 3: 0 });
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });

  it('refuses a wet run against the engine before the levels release (no max_level above 3 in its catalogue)', async () => {
    const h = harness(OLD_CATALOG);
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r.refused).toBe(true);
    expect(r.probe?.reason).toMatch(/not deployed/);
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });

  it('wet run: probes, re-pulls each type to three levels, replaces levels 1–3 only, records progress and resumes', async () => {
    const h = harness();
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r.refused).toBe(false);
    expect(r.probe).toMatchObject({ ok: true, deepEngine: true, depth: 3 });
    expect(r.rows.map((x) => x.status)).toEqual(['skipped_done', 'done', 'done']);
    expect(h.fetched.every((f) => !('max_level' in ((f.extra.params ?? {}) as object)) && (((f.extra.params ?? {}) as { levels?: number }).levels ?? 0) <= 3)).toBe(true);
    const systems = [...new Set(lifelongDashaTypes(TYPES).map((t) => dashaSystemOfKey(t.id)!))].sort();
    expect(h.writes.map((w) => w.band)).toEqual([{ minLevel: 1, maxLevel: 3, systems }, { minLevel: 1, maxLevel: 3, systems }]);
    expect(h.done.has('k2')).toBe(true);
    const again = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(again.rows.every((x) => x.status === 'skipped_done')).toBe(true);
  });
  it('a failed pull of one system keeps its rows: only the systems pulled complete this run are replaced', async () => {
    const h = harness();
    h.fetcher.mockImplementation(async (_req: unknown, type: string) => {
      if (type === 'dasha.yogini' && h.fetcher.mock.calls.length > 1) throw new Error('engine 502');
      return l3;
    });
    const r = await runLevelsBackfill(h.deps, { dryRun: false, kundliId: 'k1' });
    const yoginiTypes = lifelongDashaTypes(TYPES).filter((t) => t.radhaType === 'dasha.yogini').length;
    expect(yoginiTypes).toBeGreaterThan(0);
    expect(r.rows[0]).toMatchObject({ kundliId: 'k1', status: 'partial', failed: yoginiTypes });
    const band = h.writes[0]!.band as { systems: string[] };
    expect(band.systems).not.toContain('yogini');
    expect(band.systems).toContain('narayana');
    // a partial kundli is not marked done, so a rerun retries it
    expect(h.done.has('k1')).toBe(false);
  });

  it('an empty answer or a store error counts as a failed pull (its rows kept)', async () => {
    const h = harness();
    h.fetcher.mockImplementation(async (_req: unknown, type: string) => (type === 'dasha.yogini' && h.fetcher.mock.calls.length > 1 ? { periods: [] } : l3));
    h.complete.mockImplementation(async (_k: string, key: { dataType: string }) => {
      if (key.dataType === 'dasha.narayana.l3') throw new Error('could not extend file: No space left on device');
    });
    const r = await runLevelsBackfill(h.deps, { dryRun: false, kundliId: 'k1' });
    const band = h.writes[0]!.band as { systems: string[] };
    expect(band.systems).not.toContain('yogini');
    expect(band.systems).not.toContain('narayana');
    expect(r.rows[0]).toMatchObject({ status: 'partial', failed: lifelongDashaTypes(TYPES).filter((t) => t.radhaType === 'dasha.yogini').length + 1 });
  });

  it('every pull failed: nothing is written for that kundli', async () => {
    const h = harness();
    h.fetcher.mockImplementation(async () => {
      // the probe (the first call) answers; the kundli's pulls all fail
      if (h.fetcher.mock.calls.length > 1) throw new Error('No space left on device');
      return l3;
    });
    const r = await runLevelsBackfill(h.deps, { dryRun: false, kundliId: 'k1' });
    expect(r.rows[0]).toMatchObject({ kundliId: 'k1', status: 'failed', error: 'every pull failed: nothing written' });
    expect(h.writes).toHaveLength(0);
    expect(h.done.has('k1')).toBe(false);
  });

  it('a disk-full error in one kundli transaction fails that kundli only; the next kundli is written', async () => {
    const h = harness();
    const writeBand = h.deps.writeBand;
    h.deps.writeBand = async (id, rows, band) => {
      if (id === 'k1') throw new Error('could not write to file "pg_wal/xlogtemp": No space left on device');
      return writeBand(id, rows, band);
    };
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r.rows.map((x) => [x.kundliId, x.status])).toEqual([['k0', 'skipped_done'], ['k1', 'failed'], ['k2', 'done']]);
    expect(h.writes.map((w) => w.id)).toEqual(['k2']);
    expect(h.done.has('k1')).toBe(false);
  });

  it('a wet run refuses without DB_DISK_LIMIT_BYTES (no engine call, no write) and names the variable', async () => {
    const h = harness();
    const lines: string[] = [];
    h.deps.log = (l) => void lines.push(l);
    h.deps.disk = createDiskGuard(memDisk(0).probe, diskLimitsFromEnv({}));
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r.refused).toBe(true);
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
    expect(lines.join('\n')).toMatch(/DB_DISK_LIMIT_BYTES.*5368709120/);
    h.deps.disk = undefined;
    expect((await runLevelsBackfill(h.deps, { dryRun: false })).refused).toBe(true);
  });

  it('the disk guard refuses before the run when the database is already past limit x max fill', async () => {
    const h = harness(NEW_CATALOG, memDisk(Math.floor(GB5 * 0.7) - 1000).probe);
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r).toMatchObject({ refused: true, stoppedForDisk: true });
    expect(r.disk).toMatchObject({ ok: false, limitBytes: GB5, maxFill: 0.7 });
    expect(h.fetcher).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(0);
  });

  it('the disk guard stops part-way: after a kundli the size leaves no room for the next one', async () => {
    const threshold = Math.floor(GB5 * 0.7);
    // room for the first checks; every size read then grows the database by 10 MB
    const d = memDisk(threshold - PLAN_ROWS_PER_KUNDLI * 350 - 15_000_000, 350, 10_000_000);
    const h = harness(NEW_CATALOG, d.probe);
    h.done.clear();
    const r = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(r.stoppedForDisk).toBe(true);
    expect(h.writes.map((w) => w.id)).toEqual(['k0']);
    expect(r.rows.map((x) => x.kundliId)).toEqual(['k0']);
  });

  it('dry run prints the byte estimate from the measured bytes per row (fallback 350)', async () => {
    const lines: string[] = [];
    const h = harness(NEW_CATALOG, memDisk(100_000_000, null).probe);
    h.deps.log = (l) => void lines.push(l);
    const r = await runLevelsBackfill(h.deps, { dryRun: true });
    expect(r.rows.filter((x) => x.status === 'planned').map((x) => x.estimateBytes)).toEqual([PLAN_ROWS_PER_KUNDLI * 350, PLAN_ROWS_PER_KUNDLI * 350]);
    expect(r.disk).toMatchObject({ ok: true, rows: 2 * PLAN_ROWS_PER_KUNDLI, bytesPerRow: 350 });
    expect(lines.join('\n')).toMatch(/dry-run byte estimate/);
    expect(h.fetcher).not.toHaveBeenCalled();
  });
});

describe('disk guard', () => {
  it('judges size + rows x bytes per row against limit x max fill and prints the numbers', () => {
    const limits = diskLimitsFromEnv({ DB_DISK_LIMIT_BYTES: '1000000', DB_DISK_MAX_FILL: '0.5' });
    expect(limits).toEqual({ limitBytes: 1_000_000, maxFill: 0.5 });
    expect(judgeDisk(400_000, 200, 500, limits)).toMatchObject({ ok: true, estimateBytes: 100_000, thresholdBytes: 500_000 });
    const no = judgeDisk(400_001, 200, 500, limits);
    expect(no.ok).toBe(false);
    expect(no.message).toMatch(/400001 B.*200 rows × 500 B.*refusing/);
  });

  it('reads DB_DISK_MAX_FILL with a 0.7 default and refuses an unset or bad limit', () => {
    expect(diskLimitsFromEnv({ DB_DISK_LIMIT_BYTES: '5368709120' })).toEqual({ limitBytes: GB5, maxFill: 0.7 });
    expect(diskLimitsFromEnv({ DB_DISK_LIMIT_BYTES: '5368709120', DB_DISK_MAX_FILL: '3' }).maxFill).toBe(0.7);
    expect(diskLimitsFromEnv({}).limitBytes).toBeNull();
    expect(diskLimitsFromEnv({ DB_DISK_LIMIT_BYTES: '5GB' }).limitBytes).toBeNull();
    expect(judgeDisk(0, 0, 350, diskLimitsFromEnv({})).ok).toBe(false);
  });

  it('measures bytes per row once, falling back to 350 on an empty table or an error', async () => {
    const calls = { n: 0 };
    const g = createDiskGuard({ databaseSize: async () => 10, activationBytesPerRow: async () => (calls.n++, 412.5) }, { limitBytes: 1e9, maxFill: 0.7 });
    expect(await g.bytesPerRow()).toBe(412.5);
    await g.check(10);
    expect(calls.n).toBe(1);
    const empty = createDiskGuard({ databaseSize: async () => 10, activationBytesPerRow: async () => null }, { limitBytes: 1e9, maxFill: 0.7 });
    expect(await empty.bytesPerRow()).toBe(350);
    const broken = createDiskGuard({ databaseSize: async () => 10, activationBytesPerRow: async () => { throw new Error('x'); } }, { limitBytes: 1e9, maxFill: 0.7 });
    expect(await broken.bytesPerRow()).toBe(350);
  });
});
