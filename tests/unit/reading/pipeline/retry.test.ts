/**
 * docs/techniques/11 rev 4 §4.2 "Retry" (step 3, first half): a row that blocks the first pass is asked again 1, 5 and 15
 * minutes after its failures, then at every sweep; after PIPELINE_GIVE_UP_FAILURES (6) it is given up and named as a gap.
 * A failed dated clock row is asked again (the old sweep counted ready rows against a number and never asked it). A row
 * the engine refuses for its input (the `kaala` clock) is unsupported and not retried. Fake clock, in-memory stores; no
 * database, no engine.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../../src/reading/chartData/catalog.js';
import {
  clearChartDataCaches,
  countFailure,
  ensureChartData,
  failedRowDue,
  FAILED_GIVE_UP_UNTIL,
  needsFetch,
  parseFailureMark,
  type ChartDataRepo,
  type FetchResult,
  type RowKey,
  type StoredRow,
} from '../../../../src/reading/chartData/store.js';
import { rowState, type StoredStatusRow } from '../../../../src/reading/pipeline/manifest.js';
import { clocksToAsk, isEngineRefusal, PIPELINE_GIVE_UP_FAILURES, RETRY_DELAYS_MS, retryDelayMs, retryVerdict } from '../../../../src/reading/pipeline/retry.js';
import { clockRowRetry, ensurePressureInventories, loadPressureInventory } from '../../../../src/reading/self/sub/pressure.js';
import type { RadhaFetcher } from '../../../../src/reading/chartData/store.js';
import { findIncompleteKundlis, findKundlisMissingClocks } from '../../../../src/services/kundliSyncWorker.js';

const MIN = 60_000;
const T0 = Date.parse('2026-11-22T10:00:00Z');
const at = (ms: number) => new Date(T0 + ms);
const KAALA_ERR = 'validation_error: Invalid export type: pressure_inventory';

describe('the schedule: 1, 5, 15 minutes, then every sweep, given up after 6', () => {
  it('the waits after each failure', () => {
    expect(RETRY_DELAYS_MS).toEqual([1 * MIN, 5 * MIN, 15 * MIN]);
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([1 * MIN, 5 * MIN, 15 * MIN, 0, 0]);
    expect(PIPELINE_GIVE_UP_FAILURES).toBe(6);
  });

  it('on a fake clock: waiting before each delay, due after it; given up at the 6th failure', () => {
    const last = at(0);
    const v = (failures: number, after: number) => retryVerdict({ failures, lastAttemptAt: last }, at(after)).state;
    expect(v(1, 59_000)).toBe('waiting');
    expect(v(1, 1 * MIN)).toBe('due');
    expect(v(2, 4 * MIN + 59_000)).toBe('waiting');
    expect(v(2, 5 * MIN)).toBe('due');
    expect(v(3, 14 * MIN)).toBe('waiting');
    expect(v(3, 15 * MIN)).toBe('due');
    expect(v(4, 0)).toBe('due');
    expect(v(5, 0)).toBe('due');
    expect(v(6, 60 * MIN)).toBe('given_up');
    expect(retryVerdict({ failures: 2, lastAttemptAt: last }, at(0)).dueAt?.getTime()).toBe(T0 + 5 * MIN);
  });

  it('a registration row (natal or `current`) follows it in needsFetch; a fixed year keeps its 60 s rule', () => {
    const type = BUILTIN_CHART_TYPES.find((t) => t.id === 'varga.d9')!;
    const row = (failures: number, variant = ''): StoredRow => ({
      dataType: 'varga.d9', variant, params: {}, calcVersion: type.calcVersion ?? null, payload: null, status: 'failed',
      error: `[failures=${failures} engine=${type.calcVersion ?? '-'} digest=x] boom`, fetchStartedAt: null, fetchedAt: at(0), validTo: null,
    });
    expect(needsFetch(row(2), type, T0 + 2 * MIN, 90_000)).toBe(false);
    expect(needsFetch(row(2), type, T0 + 5 * MIN, 90_000)).toBe(true);
    expect(needsFetch(row(3), type, T0 + 10 * MIN, 90_000)).toBe(false);
    expect(failedRowDue(row(3), T0 + 15 * MIN)).toBe(true);
    // the yearly rows are not this step's (their own pull and backoff stay)
    expect(needsFetch(row(3, 'year=2030'), type, T0 + 2 * MIN, 90_000)).toBe(true);
  });
});

/** kundli_data in memory with every builtin type served; `clock` is the fake time */
let clock = T0;
function memRepo() {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const types = (): ChartTypeRow[] =>
    BUILTIN_CHART_TYPES.map((t) => ({
      id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: t.calcVersion ?? null, legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true,
    }));
  const repo: ChartDataRepo & { rows: typeof rows } = {
    rows,
    async loadTypes() {
      return types();
    },
    async readRows(_id, keys) {
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r)).map((r) => ({ ...r }));
    },
    async readLegacy() {
      return {};
    },
    async claim(_id, key, params) {
      const r = rows.get(k(key));
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date(clock), error: null } as StoredRow);
      return true;
    },
    async complete(_id, key, _ay, r: FetchResult) {
      const prev = rows.get(k(key));
      rows.set(k(key), { ...key, params: prev?.params ?? {}, status: r.status, payload: r.status === 'ready' ? r.payload : (prev?.payload ?? null), calcVersion: r.calcVersion, error: r.error ?? null, fetchStartedAt: null, fetchedAt: new Date(clock), validTo: r.validTo ?? null });
    },
    async kundliRequest() {
      return { params: { dob: '2000-01-01', tob: '10:00:00', place: 'Test,IN' }, coords: { lat: 1, lon: 1, tz: 0 } };
    },
  };
  return repo;
}

beforeEach(() => {
  clearChartDataCaches();
  clock = T0;
});

describe('give-up after 6 names the gap', () => {
  it('countFailure counts any failure on the same engine and digest, and marks the 6th', () => {
    let prev: { status: 'failed'; error: string } | undefined;
    const marks = [];
    for (let i = 0; i < 6; i++) {
      const m = countFailure(prev, i % 2 ? 'Radha 500: a' : 'Radha 502: b', '2', 'd1');
      marks.push(m);
      prev = { status: 'failed', error: m.error };
    }
    expect(marks.map((m) => m.failures)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(marks.slice(0, 5).every((m) => m.validTo === null)).toBe(true);
    expect(marks[5]!.validTo).toEqual(FAILED_GIVE_UP_UNTIL);
    expect(countFailure(prev, 'x', '3', 'd1').failures).toBe(1);
  });

  it('a natal row failing on every ask: asked at 0, +1, +5, +15 min and two sweeps, then given up and never asked again', async () => {
    const repo = memRepo();
    const fetcher = vi.fn(async () => {
      throw new Error('Radha 500: engine down');
    });
    const key = 'varga.d9';
    // the asks a sweep every 15 minutes (and the sync run) would make, over two hours
    const calls: number[] = [];
    for (let m = 0; m <= 120; m++) {
      clock = T0 + m * MIN;
      const before = fetcher.mock.calls.length;
      await ensureChartData({ repo, fetcher }, 'k1', [key], { now: () => clock });
      if (fetcher.mock.calls.length > before) calls.push(m);
    }
    // 0 (1st), +1 (2nd), +5 after it (3rd), +15 after it (4th), then at once (5th, 6th): given up
    expect(calls).toEqual([0, 1, 6, 21, 22, 23]);
    const row = [...repo.rows.values()][0]!;
    expect(parseFailureMark(row.error)?.failures).toBe(PIPELINE_GIVE_UP_FAILURES);
    expect(row.validTo?.getTime()).toBe(FAILED_GIVE_UP_UNTIL.getTime());
    const out = await ensureChartData({ repo, fetcher }, 'k1', [key], { now: () => clock });
    expect(out[key]!.gaveUp).toBe(true);
    // named as a given-up gap in the manifest
    const s: StoredStatusRow = { dataType: key, variant: '', status: 'failed', calcVersion: row.calcVersion, error: row.error, fetchStartedAt: null, fetchedAt: row.fetchedAt, validTo: row.validTo };
    expect(rowState(s, new Date(clock))).toMatchObject({ state: 'gap', code: 'failed', failures: 6 });
  });

  it('a clock row given up after 6 failures is not pulled again', async () => {
    const db = pressureStore();
    const fetcher = vi.fn<RadhaFetcher>(async () => {
      throw new Error('Radha 500: engine down');
    });
    let pulls = 0;
    for (let m = 0; m <= 120; m++) {
      const before = fetcher.mock.calls.length;
      await loadPressureInventory(db.prisma, 'k1', 'yogini', '2026-11-22', { fetcher, kundliRequest: async () => REQ, now: () => at(m * MIN) });
      if (fetcher.mock.calls.length > before) pulls += 1;
    }
    expect(pulls).toBe(PIPELINE_GIVE_UP_FAILURES);
    const row = db.rows.get('k1|pressure_inventory|system=yogini|LAHIRI')!;
    expect(row).toMatchObject({ status: 'failed' });
    expect((row.valid_to as Date).getTime()).toBe(FAILED_GIVE_UP_UNTIL.getTime());
    expect(clockRowRetry(row as never, at(200 * MIN)).state).toBe('given_up');
  });
});

describe('a failed clock row is asked again', () => {
  it('the sweep picks a chart with a due failed clock row even beside enough ready ones', async () => {
    let sql = '';
    const prisma = { $queryRaw: async (strings: TemplateStringsArray) => ((sql = strings.join('?')), []) };
    await findKundlisMissingClocks(prisma as never, 5, 60_000);
    expect(sql).toMatch(/OR EXISTS \(\s*SELECT 1 FROM "kundli_data" f\s+WHERE f\."kundli_id" = k\."id" AND f\."data_type" = 'pressure_inventory' AND f\."status" = 'failed'/);
    expect(sql).toMatch(/f\."valid_to" IS NULL OR f\."valid_to" <= now\(\)/);
    // the registration sweep settles a failed row for the first wait only (was 6 h); given-up rows stay settled
    await findIncompleteKundlis(prisma as never, { requested: [{ id: 'varga.d9', variantKind: null, calcVersion: '1' }] as never }, 5, 60_000);
    expect(sql).toMatch(/d\."status" = 'failed' AND d\."valid_to" > now\(\)/);
  });

  it('a failed clock row is pulled again a minute later, and a failed clock outside the set is asked while due', async () => {
    const db = pressureStore();
    const fail = vi.fn<RadhaFetcher>(async () => {
      throw new Error('Radha 500: engine down');
    });
    await loadPressureInventory(db.prisma, 'k1', 'yogini', '2026-11-22', { fetcher: fail, kundliRequest: async () => REQ, now: () => at(0) });
    const ok = vi.fn<RadhaFetcher>(async () => ENGINE as unknown);
    const r = await loadPressureInventory(db.prisma, 'k1', 'yogini', '2026-11-22', { fetcher: ok, kundliRequest: async () => REQ, now: () => at(1 * MIN) });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(r.source).toBe('pulled');
    expect(db.rows.get('k1|pressure_inventory|system=yogini|LAHIRI')).toMatchObject({ status: 'ready', valid_to: null });

    const set = ['vimsottari', 'narayana', 'dwisatpathi', 'yogini'];
    const stored = [{ system: 'chara', status: 'failed', failures: 2, lastAttemptAt: at(0), message: 'Radha 500: down', givenUpMark: false }];
    expect(clocksToAsk(set, stored, at(4 * MIN)).ask).toEqual(set);
    expect(clocksToAsk(set, stored, at(5 * MIN)).ask).toEqual([...set, 'chara']);
    expect(clocksToAsk(set, [{ ...stored[0]!, failures: 6 }], at(60 * MIN)).ask).toEqual(set);
  });

  it('ensurePressureInventories asks the set and the due failed clock; a refused one is rewritten unsupported, not asked', async () => {
    const asked: string[] = [];
    const marked: string[] = [];
    const r = await ensurePressureInventories({} as PrismaClient, 'k1', '2026-11-22', {
      now: () => at(30 * MIN),
      loadSet: async () => ({ spine: 'vimsottari', clocks: [], pulled: ['vimsottari', 'narayana'], conditional: null, skipped: [] }) as never,
      loadFailed: async () => [
        { system: 'chara', status: 'failed', failures: 1, lastAttemptAt: at(0), message: 'Radha 500: down', givenUpMark: false },
        { system: 'kaala', status: 'failed', failures: 1, lastAttemptAt: new Date('2026-11-10T00:38:08Z'), message: KAALA_ERR, givenUpMark: false },
      ],
      markUnsupported: async (_p, _k, system) => void marked.push(system),
      load: (async (_p: unknown, _k: string, system: string) => (asked.push(system), { inventory: null, source: 'none', gaps: [] })) as never,
    });
    expect(asked.sort()).toEqual(['chara', 'narayana', 'vimsottari']);
    expect(marked).toEqual(['kaala']);
    expect(r.clocks.map((c) => c.system).sort()).toEqual(['chara', 'narayana', 'vimsottari']);
  });
});

describe('an engine refusal is not retried', () => {
  it('the refusal is recognised by its text', () => {
    expect(isEngineRefusal(KAALA_ERR)).toBe(true);
    expect(isEngineRefusal('Radha 400: Invalid type: pressure_inventory')).toBe(true);
    expect(isEngineRefusal('Radha 500: found no tithi pravesha for year 2036')).toBe(false);
    expect(isEngineRefusal(null)).toBe(false);
  });

  it('the kaala row (failed 10 Nov with the refusal): unsupported, named, not asked; its exit is the recheck after 30 days', () => {
    const last = new Date('2026-11-10T00:38:08Z');
    expect(retryVerdict({ failures: 1, lastAttemptAt: last, message: KAALA_ERR }, new Date('2026-11-22T10:00:00Z')).state).toBe('unsupported');
    expect(retryVerdict({ failures: 1, lastAttemptAt: last, message: KAALA_ERR }, new Date('2026-12-11T00:00:00Z')).state).toBe('due');
    const row: StoredStatusRow = { dataType: 'pressure_inventory', variant: 'system=kaala', status: 'failed', calcVersion: null, error: KAALA_ERR, fetchStartedAt: last, fetchedAt: last, validTo: null };
    expect(rowState(row, new Date('2026-11-22T10:00:00Z'))).toMatchObject({ state: 'gap', code: 'unsupported' });
    expect(clocksToAsk(['vimsottari'], [{ system: 'kaala', status: 'failed', failures: 1, lastAttemptAt: last, message: KAALA_ERR, givenUpMark: false }], new Date('2026-11-22T10:00:00Z'))).toEqual({ ask: ['vimsottari'], refused: ['kaala'] });
  });

  it('a refused pull is stored unsupported and never asked again within the recheck', async () => {
    const db = pressureStore();
    const refused = vi.fn<RadhaFetcher>(async () => {
      throw new Error(`Radha 400: ${KAALA_ERR}`);
    });
    for (let m = 0; m <= 180; m += 15) await loadPressureInventory(db.prisma, 'k1', 'kaala', '2026-11-22', { fetcher: refused, kundliRequest: async () => REQ, now: () => at(m * MIN) });
    expect(refused).toHaveBeenCalledTimes(1);
    expect(db.rows.get('k1|pressure_inventory|system=kaala|LAHIRI')).toMatchObject({ status: 'unsupported' });
  });
});

// ---------------------------------------------------------------- the clock rows' store (as in self/v2/pressure.test.ts)

const REQ = { params: { dob: '1990-05-01', tob: '10:00', place: 'Test' } as never, coords: { lat: 1, lon: 1, tz: 0 } };
const ENGINE = { system: 'yogini', as_of: '2026-11-22', from: '2023-11-22', to: '2029-11-22', calc_version: '1', rows: [], boundaries: [] };

function pressureStore() {
  const rows = new Map<string, Record<string, unknown>>();
  const types = new Set<string>();
  const key = (w: { kundli_id: string; data_type: string; variant: string; ayanamsa: string }) => `${w.kundli_id}|${w.data_type}|${w.variant}|${w.ayanamsa}`;
  const prisma = {
    kundliData: {
      findUnique: async ({ where }: { where: { kundli_data_key: Parameters<typeof key>[0] } }) => rows.get(key(where.kundli_data_key)) ?? null,
      upsert: async ({ where, create, update }: { where: { kundli_data_key: Parameters<typeof key>[0] }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const k = key(where.kundli_data_key);
        rows.set(k, rows.has(k) ? { ...rows.get(k), ...update } : { ...create });
      },
    },
    chartDataType: {
      upsert: async ({ where }: { where: { id: string } }) => void types.add(where.id),
    },
  };
  return { prisma: prisma as unknown as PrismaClient, rows };
}
