/**
 * TODOS 2026-11-19: 25 `annual.tithi_pravesha(_dasha)` rows failed every 6 hours forever ("found no tithi pravesha for
 * year 2036"; 96 engine 500s in 72 h). A row that fails CHART_DATA_FAILED_MAX_TRIES (3) times in a row with the same
 * error, engine calc version and digest version is given up (still `failed`, `valid_to` far ahead) until one of those
 * changes. In-memory repository; no database, no engine.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../../src/reading/chartData/catalog.js';
import {
  clearChartDataCaches,
  ensureChartData,
  FAILED_GIVE_UP_UNTIL,
  failedGivenUp,
  markFailure,
  needsFetch,
  parseFailureMark,
  type ChartDataRepo,
  type FetchResult,
  type RowKey,
  type StoredRow,
} from '../../../../src/reading/chartData/store.js';
import { ensureAnnualSet } from '../../../../src/reading/digest/annualSet.js';
import { DIGEST_VERSION } from '../../../../src/reading/digest/types.js';
import { findIncompleteKundlis } from '../../../../src/services/kundliSyncWorker.js';

const ERR = 'Radha 500: found no tithi pravesha for year 2036';

/** kundli_data in memory, the annual types served at calc version `cv`; the claim clears `error` as the SQL does */
function memRepo(cv = '2') {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const types = (): ChartTypeRow[] =>
    BUILTIN_CHART_TYPES.filter((t) => t.family === 'annual').map((t) => ({
      id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: cv, legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true,
    }));
  const repo: ChartDataRepo & { rows: typeof rows; setCv: (v: string) => void } = {
    rows,
    setCv: (v) => (cv = v),
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
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date(), error: null } as StoredRow);
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

let clock = Date.parse('2026-11-19T00:00:00Z');
const HOUR = 3_600_000;
beforeEach(() => {
  clearChartDataCaches();
  clock = Date.parse('2026-11-19T00:00:00Z');
});

describe('markFailure / failedGivenUp', () => {
  it('counts identical failures, gives up at three, and starts over on another message, engine or digest version', () => {
    const one = markFailure(undefined, ERR, '2', 'd1', 3);
    expect(one).toMatchObject({ failures: 1, validTo: null });
    expect(parseFailureMark(one.error)).toEqual({ failures: 1, engine: '2', digest: 'd1', message: ERR });
    const two = markFailure({ status: 'failed', error: one.error }, ERR, '2', 'd1', 3);
    const three = markFailure({ status: 'failed', error: two.error }, ERR, '2', 'd1', 3);
    expect(three).toMatchObject({ failures: 3, validTo: FAILED_GIVE_UP_UNTIL });
    expect(markFailure({ status: 'failed', error: two.error }, 'another error', '2', 'd1', 3).failures).toBe(1);
    expect(markFailure({ status: 'failed', error: two.error }, ERR, '3', 'd1', 3).failures).toBe(1);
    expect(markFailure({ status: 'failed', error: two.error }, ERR, '2', 'd2', 3).failures).toBe(1);
    // an old unmarked error (rows failed before this release) counts as the first
    expect(markFailure({ status: 'failed', error: ERR }, ERR, '2', 'd1', 3).failures).toBe(1);
  });

  it('a given-up row is not fetched again until the calc version or the digest version changes', () => {
    const t = { calcVersion: '2' };
    const mark = markFailure({ status: 'failed', error: markFailure({ status: 'failed', error: markFailure(undefined, ERR, '2', DIGEST_VERSION).error }, ERR, '2', DIGEST_VERSION).error }, ERR, '2', DIGEST_VERSION);
    const row: StoredRow = { dataType: 'annual.tithi_pravesha', variant: 'year=2035', params: {}, calcVersion: '2', payload: null, status: 'failed', error: mark.error, fetchStartedAt: null, fetchedAt: new Date(clock - 7 * 24 * HOUR), validTo: mark.validTo };
    const type = { ...BUILTIN_CHART_TYPES.find((x) => x.id === 'annual.tithi_pravesha')!, calcVersion: '2' };
    expect(failedGivenUp(row, t, clock)).toBe(true);
    expect(needsFetch(row, type, clock, 90_000)).toBe(false);
    // a new engine release (the type's calc version moves on): due again
    expect(needsFetch(row, { ...type, calcVersion: '3' }, clock, 90_000)).toBe(true);
    // a new digest version: due again
    expect(failedGivenUp(row, t, clock, 'another-digest')).toBe(false);
    // two failures only: the old 60 s rule
    const twice = { ...row, error: markFailure(undefined, ERR, '2').error, validTo: null };
    expect(needsFetch(twice, type, clock, 90_000)).toBe(true);
  });
});

describe('ensureChartData stops calling the engine after three identical failures', () => {
  it('three engine calls, then none; the item says gaveUp; a calc version change asks again', async () => {
    const repo = memRepo('2');
    const fetcher = vi.fn(async () => {
      throw new Error(ERR);
    });
    const key = 'annual.tithi_pravesha_dasha@2035';
    for (let i = 0; i < 5; i++) {
      clock += 6 * HOUR;
      const out = await ensureChartData({ repo, fetcher }, 'k1', [key], { now: () => clock });
      expect(out[key]!.status).toBe('failed');
      if (i >= 3) expect(out[key]!.gaveUp).toBe(true);
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
    const row = [...repo.rows.values()][0]!;
    expect(row.status).toBe('failed');
    expect(row.validTo?.getTime()).toBe(FAILED_GIVE_UP_UNTIL.getTime());
    expect(parseFailureMark(row.error)?.failures).toBe(3);
    // the engine release changes the type's calc version: asked again (and counted from one)
    repo.setCv('3');
    clearChartDataCaches();
    clock += HOUR;
    await ensureChartData({ repo, fetcher }, 'k1', [key], { now: () => clock });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(parseFailureMark([...repo.rows.values()][0]!.error)).toMatchObject({ failures: 1, engine: '3' });
  });

  it('the 6-hourly annual set leaves a given-up row alone (backed off, not requested)', async () => {
    const repo = memRepo('2');
    const fetcher = vi.fn(async (_r: unknown, type: string) => {
      if (type === 'annual.tithi_pravesha_dasha') throw new Error(ERR);
      return { ok: true };
    });
    const run = () => ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2035, span: 0, maxCalls: 20, concurrency: 1, now: () => clock });
    for (let i = 0; i < 3; i++) {
      clock += 7 * HOUR;
      await run();
    }
    const dashaCalls = () => fetcher.mock.calls.filter((c) => c[1] === 'annual.tithi_pravesha_dasha').length;
    expect(dashaCalls()).toBe(3);
    clock += 7 * HOUR;
    const r = await run();
    expect(dashaCalls()).toBe(3);
    expect(r).toMatchObject({ requested: 0, backedOff: 1, remaining: 1 });
  });
});

describe('the registration sweep treats a given-up row as settled', () => {
  it('its SQL counts failed rows with valid_to ahead on the same calc version', async () => {
    let sql = '';
    const prisma = { $queryRaw: async (strings: TemplateStringsArray) => ((sql = strings.join('?')), []) };
    await findIncompleteKundlis(prisma as never, { requested: [{ id: 'annual.tithi_pravesha', variantKind: 'year', calcVersion: '2' }] as never }, 5, 60_000);
    expect(sql).toMatch(/d\."status" = 'failed' AND d\."valid_to" > now\(\) AND \(w\."calc_version" IS NULL OR d\."calc_version" = w\."calc_version"\)/);
  });
});
