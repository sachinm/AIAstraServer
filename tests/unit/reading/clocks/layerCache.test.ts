/**
 * The clock layer cache (doc 70 Phase 3 replay fixes): a second open with the same inputs makes no reader and no
 * concordance call; any changed slice hash or prompt version misses; a missing `kundli_slices` table is a quiet no-op.
 * Fake model, fake cache, an in-memory slice store; no database, no paid call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAYER_CACHE_SLICE_ID, layerCacheKey, readLayerCache, resetLayerCacheWarning, writeLayerCache } from '../../../../src/reading/clocks/layerCache.js';
import { runClockLayer, type ClockLayerDeps } from '../../../../src/reading/clocks/run.js';
import type { GeminiCallOptions } from '../../../../src/reading/llm/gemini.js';
import { renderSliceSet } from '../../../../src/reading/slices/index.js';
import type { RenderedSlice } from '../../../../src/reading/slices/types.js';
import { ASOF, frame, inventories, natal } from '../slices/fixtures.js';
import { fakeConcordance, fakeReader, result } from './fakes.js';

const ctx = { userId: 'u1', kundliId: 'k1', asOf: ASOF };

/** an in-memory `kundli_slices` with the two calls the cache uses */
function memoryStore() {
  const rows = new Map<string, { slice_id: string; text: string; hash: string }>();
  const upserts: string[] = [];
  const prisma = {
    kundliSlice: {
      findMany: async (q: { where: { kundli_id: string; slice_id: { in: string[] } } }) => q.where.slice_id.in.map((id) => rows.get(`${q.where.kundli_id}/${id}`)).filter(Boolean),
      upsert: async (q: { where: { kundli_slice_key: { kundli_id: string; slice_id: string } }; create: { text: string; hash: string } }) => {
        const k = q.where.kundli_slice_key;
        upserts.push(k.slice_id);
        rows.set(`${k.kundli_id}/${k.slice_id}`, { slice_id: k.slice_id, text: q.create.text, hash: q.create.hash });
      },
    },
  };
  return { prisma: prisma as never, rows, upserts };
}

describe('the clock layer cache', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.READING_EXPLICIT_CACHE = '1';
    process.env.READING_CLOCK_LAYER = '1';
    resetLayerCacheWarning();
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  const slices = (): RenderedSlice[] => renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() });
  function deps(prisma: never, over: Partial<ClockLayerDeps> = {}) {
    const calls: GeminiCallOptions[] = [];
    const warmed: string[] = [];
    const d: ClockLayerDeps = {
      prisma,
      callGemini: async (o) => {
        calls.push(o);
        return result(o.node === 'reading.concordance' ? fakeConcordance(o.parts[1]!) : fakeReader(o.parts[1]!));
      },
      ensureCache: (async (_m: string, _s: string | undefined, prefix: string) => (warmed.push(prefix), 'cachedContents/fake')) as never,
      maxSpendUsd: 1,
      now: new Date(`${ASOF}T12:00:00Z`),
      model: 'gemini-3.8-flash',
      ...over,
    };
    return { d, calls, warmed };
  }

  it('the second run with identical hashes makes zero reader and concordance calls, and still warms the region the cards read', async () => {
    const store = memoryStore();
    const first = deps(store.prisma);
    const a = await runClockLayer(first.d, { ctx, frame: frame(), slices: slices() });
    expect(a.cached).toBe(false);
    expect(first.calls.filter((c) => c.node.startsWith('reading.clock.'))).toHaveLength(4);
    expect(first.calls.filter((c) => c.node === 'reading.concordance')).toHaveLength(1);
    expect(store.upserts).toEqual([LAYER_CACHE_SLICE_ID]);
    expect(store.rows.get(`k1/${LAYER_CACHE_SLICE_ID}`)!.hash).toBe(a.cacheKey);

    const second = deps(store.prisma);
    const b = await runClockLayer(second.d, { ctx, frame: frame(), slices: slices() });
    expect(second.calls).toHaveLength(0);
    expect(second.warmed).toHaveLength(1);
    expect(b.cached).toBe(true);
    expect(b.cacheKey).toBe(a.cacheKey);
    expect(b.status).toBe(a.status);
    expect(b.ledger).toEqual(a.ledger);
    expect(b.sheets).toEqual(a.sheets);
    expect(b.count!.byStatus).toEqual(a.count!.byStatus);
    expect(b.spentUsd).toBe(0);
    expect(b.timings.every((t) => t.status === 'cached' && t.costUsd === 0)).toBe(true);
  });

  it('a changed clock slice hash misses and reads again', async () => {
    const store = memoryStore();
    const a = await runClockLayer(deps(store.prisma).d, { ctx, frame: frame(), slices: slices() });
    const changed = slices().map((s) => (s.id === 'clock.yogini' ? { ...s, hash: `${s.hash}x` } : s));
    const again = deps(store.prisma);
    const b = await runClockLayer(again.d, { ctx, frame: frame(), slices: changed });
    expect(b.cached).toBe(false);
    expect(b.cacheKey).not.toBe(a.cacheKey);
    expect(again.calls.some((c) => c.node === 'reading.clock.yogini')).toBe(true);
  });

  it('a changed shared slice (the prefix) misses', async () => {
    const store = memoryStore();
    await runClockLayer(deps(store.prisma).d, { ctx, frame: frame(), slices: slices() });
    const changed = slices().map((s) => (s.id === 'sky.window' ? { ...s, hash: `${s.hash}x` } : s));
    const again = deps(store.prisma);
    expect((await runClockLayer(again.d, { ctx, frame: frame(), slices: changed })).cached).toBe(false);
    expect(again.calls.length).toBeGreaterThan(0);
  });

  it('a changed prompt version misses', async () => {
    const store = memoryStore();
    await runClockLayer(deps(store.prisma).d, { ctx, frame: frame(), slices: slices() });
    const again = deps(store.prisma, { promptVersion: 'other.prompts' });
    expect((await runClockLayer(again.d, { ctx, frame: frame(), slices: slices() })).cached).toBe(false);
    expect(again.calls.length).toBeGreaterThan(0);
  });

  it('force reads again and replaces the row', async () => {
    const store = memoryStore();
    await runClockLayer(deps(store.prisma).d, { ctx, frame: frame(), slices: slices() });
    const again = deps(store.prisma, { force: true });
    expect((await runClockLayer(again.d, { ctx, frame: frame(), slices: slices() })).cached).toBe(false);
    expect(again.calls.length).toBeGreaterThan(0);
  });

  it('the key: every part changes it, the order of the clock slices does not', () => {
    const base = { asOf: ASOF, model: 'm', prefixHash: 'p', frameHash: 'f', clockSlices: [{ id: 'clock.a', hash: '1' }, { id: 'clock.b', hash: '2' }], promptVersion: 'pv' };
    const k = layerCacheKey(base);
    expect(layerCacheKey({ ...base, clockSlices: [...base.clockSlices].reverse() })).toBe(k);
    for (const over of [{ asOf: '2026-11-11' }, { model: 'n' }, { prefixHash: 'q' }, { frameHash: 'g' }, { promptVersion: 'pw' }, { clockSlices: [{ id: 'clock.a', hash: '1' }, { id: 'clock.b', hash: '3' }] }, { clockSlices: [{ id: 'clock.a', hash: '1' }] }]) {
      expect(layerCacheKey({ ...base, ...over }), JSON.stringify(over)).not.toBe(k);
    }
  });

  it('a missing kundli_slices table (M48 not applied) is a quiet no-op: the layer runs, nothing thrown, nothing logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const missing = Object.assign(new Error('The table `public.kundli_slices` does not exist in the current database.'), { code: 'P2021' });
    const prisma = { kundliSlice: { findMany: async () => Promise.reject(missing), upsert: async () => Promise.reject(missing) } } as never;
    const run = deps(prisma);
    const r = await runClockLayer(run.d, { ctx, frame: frame(), slices: slices() });
    expect(r.cached).toBe(false);
    expect(r.ledger).not.toBeNull();
    expect(run.calls.length).toBeGreaterThan(0);
    expect(await readLayerCache(prisma, 'k1', 'x')).toBeNull();
    expect(await writeLayerCache(prisma, 'k1', { v: 1, key: 'x', asOf: ASOF, status: 'ok', sheets: [], ledger: r.ledger! })).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a client without the store (test fakes) reads null and writes nothing', async () => {
    const prisma = new Proxy({}, { get: () => undefined }) as never;
    expect(await readLayerCache(prisma, 'k1', 'x')).toBeNull();
    expect(await writeLayerCache(prisma, 'k1', { v: 1, key: 'x', asOf: ASOF, status: 'ok', sheets: [], ledger: { frameHash: 'f', sheetHashes: {}, cells: [], pairs: [], byStatus: { confirmed: 0, leaning: 0, single: 0, contested: 0 } } })).toBe(false);
  });

  it('a stored row with another key, or text that is not an entry, is a miss', async () => {
    const store = memoryStore();
    store.rows.set(`k1/${LAYER_CACHE_SLICE_ID}`, { slice_id: LAYER_CACHE_SLICE_ID, text: '{"v":1,"key":"old"}', hash: 'old' });
    expect(await readLayerCache(store.prisma, 'k1', 'new')).toBeNull();
    store.rows.set(`k1/${LAYER_CACHE_SLICE_ID}`, { slice_id: LAYER_CACHE_SLICE_ID, text: 'not json', hash: 'new' });
    expect(await readLayerCache(store.prisma, 'k1', 'new')).toBeNull();
  });
});
