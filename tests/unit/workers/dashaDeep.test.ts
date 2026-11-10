import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/astroKundliClient.js', async (orig) => ({ ...(await orig<object>()), fetchEngineExport: vi.fn(async () => { throw new Error('the engine must not be called in this test'); }) }));

import { fetchEngineExport } from '../../../src/lib/astroKundliClient.js';
import { BUILTIN_CHART_TYPES, type ChartDataType } from '../../../src/reading/chartData/catalog.js';
import type { FetchResult, RowKey, StoredRow } from '../../../src/reading/chartData/store.js';
import { buildDigestRows } from '../../../src/reading/digest/build.js';
import {
  deepFreshness,
  deepSystems,
  parseDashaDeepEvent,
  runDashaDeepPull,
  type DashaDeepDeps,
  type DeepMarkerPayload,
} from '../../../src/workers/dashaDeep.js';
import { findDeepSweepCandidates, noteDashaDeepFocus, resetDashaDeepFocusState, runDashaDeepSweep, withDashaDeepFocus } from '../../../src/workers/dashaDeepFocus.js';
import { deepen } from '../reading/digest/deepFixture.js';
import { loadFixture } from '../reading/digest/helpers.js';

const fx = loadFixture();
const digestRows = buildDigestRows(fx.items, { kundliId: 'k1' });
const l3 = fx.items['dasha.vimsottari.l3'] as { periods: unknown[] };
const NOW = Date.parse('2026-11-09T12:00:00Z');
const DAY = 86_400_000;
const served = (ids: string[]): ChartDataType[] => BUILTIN_CHART_TYPES.map((t) => (ids.includes(t.id) ? { ...t, served: true } : t));
const TYPES = served(['dasha.vimsottari', 'dasha.yogini', 'dasha.vimsottari.l3', 'dasha.applicable']);

/** An in-memory marker store with the chart-data claim semantics (atomic: not fetching, or lease expired). */
function memRepo(initial?: Partial<StoredRow>) {
  const rows = new Map<string, StoredRow>();
  if (initial) rows.set('marker', { dataType: 'dasha.deep', variant: 'marker', params: {}, calcVersion: null, payload: null, status: 'ready', error: null, fetchStartedAt: null, fetchedAt: null, validTo: null, ...initial } as StoredRow);
  const completes: FetchResult[] = [];
  return {
    rows,
    completes,
    async readRows(_k: string, keys: RowKey[]) {
      return keys.map((k) => rows.get(k.variant)).filter(Boolean) as StoredRow[];
    },
    async claim(_k: string, key: RowKey, params: Record<string, unknown>, _a: string, leaseMs: number) {
      const r = rows.get(key.variant);
      if (r && r.status === 'fetching' && r.fetchStartedAt && NOW - r.fetchStartedAt.getTime() < leaseMs) return false;
      rows.set(key.variant, { ...(r ?? { dataType: key.dataType, variant: key.variant, payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null }), params, status: 'fetching', fetchStartedAt: new Date(NOW) } as StoredRow);
      return true;
    },
    async complete(_k: string, key: RowKey, _a: string, res: FetchResult) {
      completes.push(res);
      const r = rows.get(key.variant)!;
      rows.set(key.variant, { ...r, status: res.status, error: res.error ?? null, fetchedAt: new Date(NOW), validTo: res.validTo ?? null, ...(res.status === 'ready' ? { payload: res.payload } : {}) });
    },
    async kundliRequest() {
      return { params: { dob: '1975-09-06', tob: '10:00', place: 'X' } as never, coords: null };
    },
  };
}

function deps(over: Partial<DashaDeepDeps> = {}, repo = memRepo()) {
  const writes: Array<{ rows: number; band: unknown; levels: number[] }> = [];
  const calls: Array<{ type: string; extra: Record<string, unknown> }> = [];
  const d: DashaDeepDeps = {
    repo,
    loadTypes: async () => TYPES,
    loadInputs: async () => ({ items: fx.items, digestRows }),
    writeBand: async (_k, rows, band) => {
      writes.push({ rows: rows.length, band, levels: [...new Set(rows.map((r) => r.level))] });
      return { deleted: 0, inserted: rows.length };
    },
    fetcher: async (_req, type, extra) => {
      calls.push({ type, extra });
      const p = (extra.params ?? {}) as { max_level: number };
      return deepen(l3, p.max_level);
    },
    now: () => NOW,
    systems: 'all',
    ...over,
  };
  return { d, writes, calls, repo };
}

const ev = { type: 'dasha-deep-pull' as const, kundliId: 'k1', reason: 'focus' as const, asOf: '2026-11-09' };

describe('dasha-deep worker (doc 67)', () => {
  it('pulls every served dasha system once with max_level 4 (default) and the window, and writes level 4 only, inside it', async () => {
    const { d, writes, calls, repo } = deps();
    const o = await runDashaDeepPull(d, ev);
    expect(o.status).toBe('pulled');
    expect(calls.map((c) => c.type).sort()).toEqual(['dasha.narayana', 'dasha.vimsottari', 'dasha.yogini']);
    expect(calls[0]!.extra).toEqual({ params: { max_level: 4, deep_from: '2026-08-11', deep_to: '2027-11-09' } });
    expect(writes).toHaveLength(1);
    expect(writes[0]!.levels).toEqual([4]);
    expect(writes[0]!.band).toEqual({ minLevel: 4, maxLevel: 6, systems: ['narayana', 'vimsottari', 'yogini'] });
    const marker = repo.rows.get('marker')!;
    expect(marker.status).toBe('ready');
    expect(marker.validTo?.toISOString().slice(0, 10)).toBe('2027-11-09');
    const p = marker.payload as DeepMarkerPayload;
    expect(p).toMatchObject({ deep_from: '2026-08-11', deep_to: '2027-11-09', max_level: 4, engine_deep: true, reason: 'focus' });
    expect(p.systems.every((s) => typeof s.ms === 'number' && s.rows > 0)).toBe(true);
  });

  it('skips when the stored window covers as_of + 30 d and the pull is under 7 days old; pulls when older', async () => {
    const payload = { deep_from: '2026-08-01', deep_to: '2027-11-01', max_level: 4, engine_deep: true };
    const fresh = deps({}, memRepo({ status: 'ready', payload, fetchedAt: new Date(NOW - 2 * DAY) }));
    expect(await runDashaDeepPull(fresh.d, ev)).toMatchObject({ status: 'skipped', why: 'fresh' });
    expect(fresh.calls).toHaveLength(0);
    const old = deps({}, memRepo({ status: 'ready', payload, fetchedAt: new Date(NOW - 8 * DAY) }));
    expect((await runDashaDeepPull(old.d, ev)).status).toBe('pulled');
    expect(deepFreshness({ status: 'ready', payload: { ...payload, deep_to: '2026-11-30' }, fetchedAt: new Date(NOW - DAY) } as StoredRow, '2026-11-09', NOW, 4)).toEqual({ fresh: false, why: 'window' });
    expect(deepFreshness({ status: 'ready', payload, fetchedAt: new Date(NOW - DAY) } as StoredRow, '2026-11-09', NOW, 5)).toEqual({ fresh: false, why: 'level' });
  });

  it('the lock: a marker another run holds is not pulled again, and two focus events at once pull once', async () => {
    const held = deps({}, memRepo({ status: 'fetching', fetchStartedAt: new Date(NOW - 60_000) }));
    expect(await runDashaDeepPull(held.d, ev)).toMatchObject({ status: 'skipped', why: 'locked' });
    expect(held.calls).toHaveLength(0);
    const shared = memRepo();
    const a = deps({}, shared);
    const b = deps({}, shared);
    const [x, y] = await Promise.all([runDashaDeepPull(a.d, ev), runDashaDeepPull(b.d, ev)]);
    expect([x.status, y.status].sort()).toEqual(['pulled', 'skipped']);
    expect(a.calls.length + b.calls.length).toBe(3);
  });

  it('an old engine (refuses max_level): nothing written, marker failed, never throws; a three-level answer marks engine_deep false', async () => {
    const refused = deps({ fetcher: async () => { throw new Error('Invalid params: unknown key(s) for dasha.yogini: deep_from, deep_to, max_level'); } });
    const o = await runDashaDeepPull(refused.d, ev);
    expect(o.status).toBe('failed');
    expect(refused.writes).toHaveLength(0);
    expect(refused.repo.rows.get('marker')!.status).toBe('failed');
    const shallow = deps({ fetcher: async () => l3 });
    expect(await runDashaDeepPull(shallow.d, ev)).toMatchObject({ status: 'pulled', rows: 0, engineDeep: false });
    expect(deepFreshness(shallow.repo.rows.get('marker'), '2026-11-09', NOW + 3_600_000, 4)).toEqual({ fresh: true, why: 'no_engine' });
    expect(deepFreshness(shallow.repo.rows.get('marker'), '2026-11-09', NOW + 25 * 3_600_000, 4)).toEqual({ fresh: false, why: 'age' });
  });

  it('a failed system keeps its old rows (only the systems that answered are replaced)', async () => {
    const { d, writes } = deps({ fetcher: async (_r, type, extra) => { if (type === 'dasha.yogini') throw new Error('timeout'); return deepen(l3, (extra.params as { max_level: number }).max_level); } });
    const o = await runDashaDeepPull(d, ev);
    expect(o).toMatchObject({ status: 'pulled', ok: 2, failed: 1 });
    expect((writes[0]!.band as { systems: string[] }).systems).toEqual(['narayana', 'vimsottari']);
  });

  it('systems: every served dasha.<name> (narayana and vimsottari served on their legacy wire types), never applicable, .l3 or deep; DASHA_DEEP_SYSTEMS narrows', () => {
    expect(deepSystems(TYPES, 'all')).toEqual(['narayana', 'vimsottari', 'yogini']);
    expect(deepSystems(TYPES, ['yogini', 'narayana', 'mandooka'])).toEqual(['narayana', 'yogini']);
  });

  it('events need the token', () => {
    process.env.KUNDLI_SYNC_EVENT_TOKEN = 'tok';
    expect(parseDashaDeepEvent({ type: 'dasha-deep-pull', kundliId: 'k1', reason: 'focus', token: 'tok' })).toEqual({ type: 'dasha-deep-pull', kundliId: 'k1', reason: 'focus' });
    expect(parseDashaDeepEvent({ type: 'dasha-deep-pull', kundliId: 'k1', reason: 'focus', token: 'nope' })).toBeNull();
    expect(parseDashaDeepEvent({ detail: { type: 'dasha-deep-pull', kundliId: 'k1', reason: 'sweep', asOf: '2026-11-09', token: 'tok' } })).toMatchObject({ reason: 'sweep', asOf: '2026-11-09' });
    delete process.env.KUNDLI_SYNC_EVENT_TOKEN;
  });
});

function focusPrisma(focusAt: Date | null = null) {
  const upserts: unknown[] = [];
  return {
    upserts,
    prisma: {
      kundli: { findFirst: async () => ({ id: 'k1' }) },
      kundliData: {
        findUnique: async () => (focusAt ? { fetched_at: focusAt } : null),
        upsert: async (q: unknown) => (upserts.push(q), {}),
        findMany: async () => [],
      },
    } as never,
  };
}

describe('focus trigger and sweep (doc 67)', () => {
  beforeEach(() => {
    resetDashaDeepFocusState();
    vi.mocked(fetchEngineExport).mockClear();
  });
  afterEach(() => {
    delete process.env.DASHA_DEEP_WORKER_FUNCTION;
  });

  it('without DASHA_DEEP_WORKER_FUNCTION it is a no-op: no invoke, no write, no engine call', async () => {
    const invoke = vi.fn(async () => undefined);
    const f = focusPrisma();
    expect(await noteDashaDeepFocus(f.prisma, 'u1', { invoke, now: () => NOW })).toBe('no_function');
    expect(invoke).not.toHaveBeenCalled();
    expect(f.upserts).toHaveLength(0);
    expect(fetchEngineExport).not.toHaveBeenCalled();
  });

  it('fires the worker at most once per kundli per 6 hours (in memory, then the focus row)', async () => {
    process.env.DASHA_DEEP_WORKER_FUNCTION = 'aiastra-dasha-deep-worker';
    process.env.KUNDLI_SYNC_EVENT_TOKEN = 'tok';
    const invoke = vi.fn(async () => undefined);
    const f = focusPrisma();
    expect(await noteDashaDeepFocus(f.prisma, 'u1', { invoke, now: () => NOW })).toBe('invoked');
    expect(invoke).toHaveBeenCalledWith('aiastra-dasha-deep-worker', { type: 'dasha-deep-pull', kundliId: 'k1', userId: 'u1', reason: 'focus', asOf: '2026-11-09', token: 'tok' });
    expect(await noteDashaDeepFocus(f.prisma, 'u1', { invoke, now: () => NOW + 3_600_000 })).toBe('cooldown');
    // another container (memory empty) sees the focus row
    resetDashaDeepFocusState();
    expect(await noteDashaDeepFocus(focusPrisma(new Date(NOW)).prisma, 'u1', { invoke, now: () => NOW + 3_600_000 })).toBe('recent');
    expect(invoke).toHaveBeenCalledTimes(1);
    resetDashaDeepFocusState();
    expect(await noteDashaDeepFocus(focusPrisma(new Date(NOW)).prisma, 'u1', { invoke, now: () => NOW + 7 * 3_600_000 })).toBe('invoked');
    expect(fetchEngineExport).not.toHaveBeenCalled();
    delete process.env.KUNDLI_SYNC_EVENT_TOKEN;
  });

  it('the request path only authenticates and fires the invoke: it never waits on or calls the engine', async () => {
    process.env.DASHA_DEEP_WORKER_FUNCTION = 'aiastra-dasha-deep-worker';
    let release: () => void = () => undefined;
    const invoke = vi.fn(() => new Promise<void>((r) => (release = r)));
    const requireUser = withDashaDeepFocus(async () => 'u1', focusPrisma().prisma, { invoke, now: () => NOW });
    const userId = await requireUser({} as never, {} as never);
    expect(userId).toBe('u1');
    await new Promise((r) => setTimeout(r, 0));
    expect(invoke).toHaveBeenCalledTimes(1);
    release();
    const anon = withDashaDeepFocus(async () => null, focusPrisma().prisma, { invoke, now: () => NOW });
    expect(await anon({} as never, {} as never)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(fetchEngineExport).not.toHaveBeenCalled();
  });

  it('the sweep picks kundlis focused in 30 days whose window ends within 30 days or whose pull is over 7 days old', async () => {
    const focus = [
      { kundli_id: 'none', fetched_at: new Date(NOW - DAY) },
      { kundli_id: 'fresh', fetched_at: new Date(NOW - DAY) },
      { kundli_id: 'ending', fetched_at: new Date(NOW - DAY) },
      { kundli_id: 'old', fetched_at: new Date(NOW - 2 * DAY) },
      { kundli_id: 'failedRecent', fetched_at: new Date(NOW - DAY) },
      { kundli_id: 'locked', fetched_at: new Date(NOW - DAY) },
    ];
    const markers = [
      { kundli_id: 'fresh', status: 'ready', fetched_at: new Date(NOW - 2 * DAY), valid_to: new Date(NOW + 300 * DAY) },
      { kundli_id: 'ending', status: 'ready', fetched_at: new Date(NOW - 2 * DAY), valid_to: new Date(NOW + 10 * DAY) },
      { kundli_id: 'old', status: 'ready', fetched_at: new Date(NOW - 9 * DAY), valid_to: new Date(NOW + 300 * DAY) },
      { kundli_id: 'failedRecent', status: 'failed', fetched_at: new Date(NOW - 600_000), valid_to: null },
      { kundli_id: 'locked', status: 'fetching', fetch_started_at: new Date(NOW - 60_000), fetched_at: null, valid_to: null },
    ];
    const findMany = vi.fn(async (q: { where: { variant: string; fetched_at?: { gt: Date } } }) => {
      if (q.where.variant === 'focus') return focus.filter((f) => f.fetched_at > q.where.fetched_at!.gt);
      return markers;
    });
    const prisma = { kundliData: { findMany } } as never;
    const ids = await findDeepSweepCandidates(prisma, NOW, 10);
    expect(ids.sort()).toEqual(['ending', 'none', 'old']);
    expect((findMany.mock.calls[0]![0] as { where: { fetched_at: { gt: Date } } }).where.fetched_at.gt).toEqual(new Date(NOW - 30 * DAY));
    expect(await findDeepSweepCandidates(prisma, NOW, 2)).toHaveLength(2);

    // without the function name the sweep step does nothing
    const invoke = vi.fn(async (_fn: string, _payload: Record<string, unknown>) => undefined);
    expect(await runDashaDeepSweep(prisma, { invoke, now: () => NOW })).toMatchObject({ skipped: 'no_function', invoked: 0 });
    process.env.DASHA_DEEP_WORKER_FUNCTION = 'aiastra-dasha-deep-worker';
    process.env.DASHA_DEEP_SWEEP_MAX = '2';
    const r = await runDashaDeepSweep(prisma, { invoke, now: () => NOW });
    expect(r.invoked).toBe(2);
    expect(invoke.mock.calls.every((c) => (c[1] as { reason: string }).reason === 'sweep')).toBe(true);
    delete process.env.DASHA_DEEP_SWEEP_MAX;
    expect(fetchEngineExport).not.toHaveBeenCalled();
  });
});
