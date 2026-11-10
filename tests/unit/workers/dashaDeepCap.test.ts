/** The account-wide cap on deep pulls (doc 67 §5.2): DASHA_DEEP_GLOBAL_MAX live pulls at most, queued in the marker. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/lib/astroKundliClient.js', async (orig) => ({ ...(await orig<object>()), fetchEngineExport: vi.fn(async () => { throw new Error('the engine must not be called in this test'); }) }));

import { fetchEngineExport } from '../../../src/lib/astroKundliClient.js';
import { BUILTIN_CHART_TYPES } from '../../../src/reading/chartData/catalog.js';
import { runDashaDeepPull, type DashaDeepDeps } from '../../../src/workers/dashaDeep.js';
import { findDeepSweepCandidates, noteDashaDeepFocus, resetDashaDeepFocusState, runDashaDeepSweep } from '../../../src/workers/dashaDeepFocus.js';
import { decideSlot, type SlotRow } from '../../../src/workers/dashaDeepSlots.js';
import { memSlots } from './memSlots.js';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const DAY = 86_400_000;
const MIN = 60_000;

const row = (status: SlotRow['status'], startedAgoMs: number | null, extra: Partial<SlotRow> = {}): SlotRow =>
  ({ dataType: 'dasha.deep', variant: 'marker', params: {}, calcVersion: null, payload: null, error: null, fetchedAt: null, validTo: null, status, fetchStartedAt: startedAgoMs == null ? null : new Date(NOW - startedAgoMs), ...extra }) as SlotRow;

/** A Prisma stand-in for the focus trigger: user uN owns kundli kN. */
function focusPrisma() {
  return {
    kundli: { findFirst: async (q: { where: { user_id: string } }) => ({ id: q.where.user_id.replace(/^u/, 'k') }) },
    kundliData: { findUnique: async () => null, upsert: async () => ({}), findMany: async () => [] },
  } as never;
}

beforeEach(() => {
  resetDashaDeepFocusState();
  vi.mocked(fetchEngineExport).mockClear();
  process.env.DASHA_DEEP_WORKER_FUNCTION = 'aiastra-dasha-deep-worker';
  process.env.KUNDLI_SYNC_EVENT_TOKEN = 'tok';
});
afterEach(() => {
  delete process.env.DASHA_DEEP_WORKER_FUNCTION;
  delete process.env.KUNDLI_SYNC_EVENT_TOKEN;
  delete process.env.DASHA_DEEP_GLOBAL_MAX;
  delete process.env.DASHA_DEEP_SWEEP_MAX;
});

describe('dasha-deep global cap (doc 67 §5.2)', () => {
  it('the decision: own live pull = busy; others at the cap = queued; else dispatched / fetching', () => {
    expect(decideSlot(undefined, 0, 'dispatch', NOW, 1)).toEqual({ outcome: 'granted', write: 'dispatched' });
    expect(decideSlot(undefined, 0, 'run', NOW, 1)).toEqual({ outcome: 'granted', write: 'fetching' });
    expect(decideSlot(undefined, 1, 'dispatch', NOW, 1)).toEqual({ outcome: 'queued', write: 'queued' });
    expect(decideSlot(undefined, 1, 'dispatch', NOW, 2)).toEqual({ outcome: 'granted', write: 'dispatched' });
    expect(decideSlot(row('fetching', MIN), 0, 'dispatch', NOW, 1)).toEqual({ outcome: 'busy', write: null });
    expect(decideSlot(row('dispatched', MIN), 0, 'dispatch', NOW, 1)).toEqual({ outcome: 'busy', write: null });
    // the worker takes over the marker the API dispatched for it
    expect(decideSlot(row('dispatched', MIN), 0, 'run', NOW, 1)).toEqual({ outcome: 'granted', write: 'fetching' });
    // a lease past its time is not live
    expect(decideSlot(row('fetching', 12 * MIN), 0, 'run', NOW, 1)).toEqual({ outcome: 'granted', write: 'fetching' });
    expect(decideSlot(row('dispatched', 16 * MIN), 0, 'dispatch', NOW, 1)).toEqual({ outcome: 'granted', write: 'dispatched' });
  });

  it('cap 1, two focus events on two kundlis: one invoke, the other kundli queued', async () => {
    const { markers, slots } = memSlots();
    const invoke = vi.fn(async (_fn: string, _p: Record<string, unknown>) => undefined);
    expect(await noteDashaDeepFocus(focusPrisma(), 'u1', { invoke, now: () => NOW, slots })).toBe('invoked');
    expect(await noteDashaDeepFocus(focusPrisma(), 'u2', { invoke, now: () => NOW + 1_000, slots })).toBe('queued');
    expect(invoke).toHaveBeenCalledTimes(1);
    expect((invoke.mock.calls[0]![1] as { kundliId: string }).kundliId).toBe('k1');
    expect(markers.get('k1')?.status).toBe('dispatched');
    expect(markers.get('k2')?.status).toBe('queued');
    expect(fetchEngineExport).not.toHaveBeenCalled();
  });

  it('focus does not invoke when the stored window still serves today, and gives the slot back when the invoke fails', async () => {
    const { markers, slots } = memSlots();
    markers.set('k1', row('ready', null, { fetchedAt: new Date(NOW - DAY), payload: { deep_from: '2026-08-01', deep_to: '2027-11-01', max_level: 4, engine_deep: true } }));
    const invoke = vi.fn(async () => undefined);
    expect(await noteDashaDeepFocus(focusPrisma(), 'u1', { invoke, now: () => NOW, slots })).toBe('fresh');
    expect(invoke).not.toHaveBeenCalled();
    const failing = vi.fn(async () => { throw new Error('throttled'); });
    expect(await noteDashaDeepFocus(focusPrisma(), 'u2', { invoke: failing, now: () => NOW, slots })).toBe('error');
    expect(markers.get('k2')?.status).toBe('queued');
  });

  it('the worker over the cap exits before any engine call and leaves its marker queued', async () => {
    const { markers, slots } = memSlots();
    markers.set('kOther', row('fetching', 2 * MIN));
    markers.set('k1', row('dispatched', MIN));
    const fetcher = vi.fn(async () => ({}));
    const loadInputs = vi.fn(async () => ({ items: {}, digestRows: [] }));
    const d: DashaDeepDeps = {
      repo: { readRows: async () => [], claim: async () => { throw new Error('the row claim is not used when the cap is wired'); }, complete: async () => undefined, kundliRequest: async () => ({ params: {} as never, coords: null }) },
      loadTypes: async () => BUILTIN_CHART_TYPES,
      loadInputs,
      writeBand: async () => ({ deleted: 0, inserted: 0 }),
      fetcher,
      now: () => NOW,
      slots,
    };
    const o = await runDashaDeepPull(d, { type: 'dasha-deep-pull', kundliId: 'k1', reason: 'focus', asOf: '2026-11-09' });
    expect(o).toEqual({ kundliId: 'k1', status: 'skipped', why: 'queued' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(loadInputs).not.toHaveBeenCalled();
    expect(fetchEngineExport).not.toHaveBeenCalled();
    expect(markers.get('k1')?.status).toBe('queued');
    // under the cap the worker takes its own dispatched marker
    markers.delete('kOther');
    markers.set('k1', row('dispatched', MIN));
    expect(await slots.acquire('k1', 'run', { now: NOW })).toBe('granted');
    expect(markers.get('k1')?.status).toBe('fetching');
  });

  it('the sweep drains the queue in order (oldest focus first), one per run at cap 1', async () => {
    const { markers, slots } = memSlots();
    process.env.DASHA_DEEP_SWEEP_MAX = '10';
    const focus = [
      { kundli_id: 'none', fetched_at: new Date(NOW - 5 * DAY) },
      { kundli_id: 'qNew', fetched_at: new Date(NOW - DAY) },
      { kundli_id: 'qOld', fetched_at: new Date(NOW - 3 * DAY) },
    ];
    markers.set('qNew', row('queued', null));
    markers.set('qOld', row('queued', null));
    const prisma = {
      kundliData: {
        findMany: async (q: { where: { variant: string } }) =>
          q.where.variant === 'focus'
            ? focus
            : [...markers].map(([kundli_id, m]) => ({ kundli_id, status: m.status, fetched_at: m.fetchedAt, fetch_started_at: m.fetchStartedAt, valid_to: m.validTo })),
      },
    } as never;
    expect(await findDeepSweepCandidates(prisma, NOW, 10)).toEqual(['qOld', 'qNew', 'none']);

    const invoke = vi.fn(async (_fn: string, _p: Record<string, unknown>) => undefined);
    const order = () => invoke.mock.calls.map((c) => (c[1] as { kundliId: string }).kundliId);
    // run 1: qOld goes, qNew waits (still queued), 'none' is not touched
    expect(await runDashaDeepSweep(prisma, { invoke, now: () => NOW, slots })).toMatchObject({ invoked: 1, queued: 2 });
    expect(order()).toEqual(['qOld']);
    expect(markers.get('qNew')?.status).toBe('queued');
    expect(markers.has('none')).toBe(false);
    // run 2 while qOld is still pulling: nothing goes
    expect(await runDashaDeepSweep(prisma, { invoke, now: () => NOW + MIN, slots })).toMatchObject({ invoked: 0 });
    // qOld finishes; run 3 sends qNew, run 4 'none'
    markers.set('qOld', row('ready', null, { fetchedAt: new Date(NOW), validTo: new Date(NOW + 365 * DAY) }));
    await runDashaDeepSweep(prisma, { invoke, now: () => NOW + 2 * MIN, slots });
    markers.set('qNew', row('ready', null, { fetchedAt: new Date(NOW), validTo: new Date(NOW + 365 * DAY) }));
    await runDashaDeepSweep(prisma, { invoke, now: () => NOW + 3 * MIN, slots });
    expect(order()).toEqual(['qOld', 'qNew', 'none']);
    expect(invoke.mock.calls.every((c) => (c[1] as { reason: string }).reason === 'sweep')).toBe(true);
    expect(fetchEngineExport).not.toHaveBeenCalled();
  });

  it('concurrent starters cannot both pass at cap 1 (the lock serialises count and write)', async () => {
    const locked = memSlots({ interleave: true });
    const got = await Promise.all([
      locked.slots.acquire('k1', 'dispatch', { now: NOW }),
      locked.slots.acquire('k2', 'dispatch', { now: NOW }),
      locked.slots.acquire('k3', 'run', { now: NOW }),
    ]);
    expect(got.filter((g) => g === 'granted')).toHaveLength(1);
    expect(got.filter((g) => g === 'queued')).toHaveLength(2);
    // without the lock the same interleaving lets every starter through: the lock is what holds the cap
    const open = memSlots({ interleave: true, lock: false });
    const raced = await Promise.all([open.slots.acquire('k1', 'dispatch', { now: NOW }), open.slots.acquire('k2', 'dispatch', { now: NOW })]);
    expect(raced).toEqual(['granted', 'granted']);
    // DASHA_DEEP_GLOBAL_MAX raises the cap
    process.env.DASHA_DEEP_GLOBAL_MAX = '2';
    const two = memSlots({ interleave: true });
    const g2 = await Promise.all(['a', 'b', 'c'].map((k) => two.slots.acquire(k, 'dispatch', { now: NOW })));
    expect(g2.filter((g) => g === 'granted')).toHaveLength(2);
  });
});
