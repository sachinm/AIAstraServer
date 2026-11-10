import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_CHART_TYPES, type ChartDataType } from '../../../../src/reading/chartData/catalog.js';
import { lifelongDashaTypes, lifelongRequest, probeEngine, runLevelsBackfill, type BackfillDeps } from '../../../../src/reading/digest/levelsBackfill.js';
import { loadFixture } from './helpers.js';

const fx = loadFixture();
const l3 = fx.items['dasha.vimsottari.l3'];
// every dasha entry served, as the catalogue sync marks them once the engine lists them
const TYPES: ChartDataType[] = BUILTIN_CHART_TYPES.map((t) => (t.family === 'dasha' && t.id !== 'dasha.deep' && t.id !== 'dasha.brahma' ? { ...t, served: true } : t));
const NEW_CATALOG = { types: [{ type: 'dasha.vimsottari', params: { levels: { default: 2, allowed: [1, 2, 3] }, max_level: { default: 6, allowed: [1, 2, 3, 4, 5, 6] } } }] };
const OLD_CATALOG = { types: [{ type: 'dasha.vimsottari', params: { levels: { default: 2, allowed: [1, 2, 3] } } }] };

function harness(catalog: { types: Array<{ type: string; params?: Record<string, unknown> }> } = NEW_CATALOG) {
  const fetched: Array<{ type: string; extra: Record<string, unknown> }> = [];
  const fetcher = vi.fn(async (_req: unknown, type: string, extra: Record<string, unknown>) => {
    fetched.push({ type, extra });
    return l3;
  });
  const done = new Set<string>(['k0']);
  const writes: Array<{ id: string; band: unknown }> = [];
  const claim = vi.fn(async () => true);
  const complete = vi.fn(async () => undefined);
  const repo = { claim, complete, kundliRequest: async () => ({ params: {} as never, coords: null }) };
  const deps: BackfillDeps = {
    listKundlis: async (q) => (q.kundliId ? [q.kundliId] : ['k0', 'k1', 'k2'].slice(0, q.limit ?? 3)),
    repo,
    types: TYPES,
    fetcher,
    buildRows: async () => [{ system: 'yogini', family: 'yogini', level: 1, lord: 'Mo', sign: null, from: '2000-01-01', to: '2001-01-01', houses: [1], parentLord: null }],
    writeBand: async (id, _rows, band) => (writes.push({ id, band }), { deleted: 5, inserted: 1 }),
    counts: async () => ({ 1: 10, 2: 80, 3: 0 }),
    progress: { done: async () => done, mark: async (id) => void done.add(id) },
    probe: () => probeEngine({ fetchCatalog: async () => catalog, fetcher, repo, types: TYPES }, 'k1'),
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
    expect(h.writes.map((w) => w.band)).toEqual([{ minLevel: 1, maxLevel: 3 }, { minLevel: 1, maxLevel: 3 }]);
    expect(h.done.has('k2')).toBe(true);
    const again = await runLevelsBackfill(h.deps, { dryRun: false });
    expect(again.rows.every((x) => x.status === 'skipped_done')).toBe(true);
  });
});
