import { beforeEach, describe, expect, it } from 'vitest';
import { annualSetKeys, annualYears, ensureAnnualSet } from '../../../../src/reading/digest/annualSet.js';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../../src/reading/chartData/catalog.js';
import { clearChartDataCaches, type ChartDataRepo, type FetchResult, type RowKey, type StoredRow } from '../../../../src/reading/chartData/store.js';

/** In-memory kundli_data with the annual types served (as the chart_data_types table marks them). */
function memRepo(): ChartDataRepo & { rows: Map<string, StoredRow> } {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const served: ChartTypeRow[] = BUILTIN_CHART_TYPES.filter((t) => t.family === 'annual').map((t) => ({
    id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: '2', legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true,
  }));
  return {
    rows,
    async loadTypes() {
      return served;
    },
    async readRows(_id, keys) {
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readLegacy() {
      return {};
    },
    async claim(_id, key, params) {
      rows.set(k(key), { ...key, params, status: 'fetching', fetchStartedAt: new Date(), payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null });
      return true;
    },
    async complete(_id, key, _ay, r: FetchResult) {
      rows.set(k(key), { ...key, params: {}, status: r.status, payload: r.payload ?? null, calcVersion: r.calcVersion, error: r.error ?? null, fetchStartedAt: null, fetchedAt: new Date(), validTo: null });
    },
    async kundliRequest() {
      return { params: { dob: '2000-01-01', tob: '10:00:00', place: 'Test,IN' }, coords: { lat: 1, lon: 1, tz: 0 } };
    },
  };
}

beforeEach(() => clearChartDataCaches());

describe('annual set', () => {
  it('ten years back and ahead, nearest first; 10 keys a year (TP and VP in D1, D9, D10, and four year tables)', () => {
    expect(annualYears(2026)).toEqual([2026, 2027, 2025, 2028, 2024, 2029, 2023, 2030, 2022, 2031, 2021, 2032, 2020, 2033, 2019, 2034, 2018, 2035, 2017, 2036, 2016]);
    const keys = annualSetKeys(2026);
    expect(keys).toHaveLength(21 * 10);
    expect(keys.slice(0, 10)).toEqual([
      'annual.tithi_pravesha@2026', 'annual.tithi_pravesha@2026;divisional_chart_factor=9', 'annual.tithi_pravesha@2026;divisional_chart_factor=10',
      'annual.varsha@2026', 'annual.varsha@2026;divisional_chart_factor=9', 'annual.varsha@2026;divisional_chart_factor=10',
      'annual.tithi_pravesha_dasha@2026', 'annual.mudda@2026', 'annual.patyayini@2026', 'annual.sahams@2026',
    ]);
  });

  it('fetches only missing rows, at most maxCalls per run, and the next run continues', async () => {
    const repo = memRepo();
    const calls: Array<{ type: string; extra: Record<string, unknown> }> = [];
    const fetcher = async (_req: unknown, type: string, extra: Record<string, unknown>) => (calls.push({ type, extra }), { ok: true });
    const a = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, maxCalls: 6, concurrency: 1 });
    expect(calls).toHaveLength(6);
    expect(a).toMatchObject({ wanted: 210, present: 0, requested: 6, fetched: 6, failed: 0, remaining: 204 });
    // the year and the divisional chart go to the engine as the store sends them
    expect(calls[0]).toEqual({ type: 'annual.tithi_pravesha', extra: { year: 2026 } });
    expect(calls[1]).toEqual({ type: 'annual.tithi_pravesha', extra: { year: 2026, params: { divisional_chart_factor: 9 } } });
    expect(repo.rows.has('annual.varsha|year=2026;divisional_chart_factor=10')).toBe(true);

    const b = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, maxCalls: 6, concurrency: 1 });
    expect(calls).toHaveLength(12);
    expect(b).toMatchObject({ present: 6, requested: 6, remaining: 198 });
    expect(calls[6]!.type).toBe('annual.tithi_pravesha_dasha');
    expect(calls[6]!.extra).toEqual({ year: 2026, params: { system: 'tithi_ashtottari' } });
  });

  it('a cap of 0 reads only, and a failed fetch counts as remaining', async () => {
    const repo = memRepo();
    let n = 0;
    const r0 = await ensureAnnualSet({ repo, fetcher: async () => (n++, {}) }, 'k1', { year: 2026, maxCalls: 0 });
    expect(n).toBe(0);
    expect(r0).toMatchObject({ requested: 0, remaining: 210 });
    const r1 = await ensureAnnualSet({ repo, fetcher: async () => { throw new Error('engine down'); } }, 'k1', { year: 2026, maxCalls: 2, concurrency: 1 });
    expect(r1).toMatchObject({ requested: 2, fetched: 0, failed: 2, remaining: 210, yearsCompleted: [] });
  });

  it('failed rows back off for six hours, then are tried again', async () => {
    const repo = memRepo();
    const tried: string[] = [];
    const down = async (_r: unknown, type: string) => { tried.push(type); throw new Error('engine down'); };
    await ensureAnnualSet({ repo, fetcher: down }, 'k1', { year: 2026, maxCalls: 2, concurrency: 1 });
    expect(tried).toHaveLength(2);
    // the two failed keys wait; the next two missing keys go instead
    const later = await ensureAnnualSet({ repo, fetcher: down }, 'k1', { year: 2026, maxCalls: 2, concurrency: 1, now: () => Date.now() + 60 * 60_000 });
    expect(later).toMatchObject({ requested: 2, backedOff: 2 });
    expect(tried).toEqual(['annual.tithi_pravesha', 'annual.tithi_pravesha', 'annual.tithi_pravesha', 'annual.varsha']);
    const n = tried.length;
    const after = await ensureAnnualSet({ repo, fetcher: async () => ({ ok: true }) }, 'k1', { year: 2026, maxCalls: 4, concurrency: 1, now: () => Date.now() + 7 * 3_600_000 });
    expect(after).toMatchObject({ requested: 4, fetched: 4, backedOff: 0 });
    expect(tried).toHaveLength(n);
  });

  it('reports a year as completed only on the run that fills its last key', async () => {
    const repo = memRepo();
    const fetcher = async () => ({ ok: true });
    const a = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, maxCalls: 6, concurrency: 1 });
    expect(a.yearsCompleted).toEqual([]);
    const b = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, maxCalls: 24, concurrency: 1 });
    // keys 7..30: finishes 2026 (keys 1-10), 2027 (11-20) and 2025 (21-30)
    expect(b.yearsCompleted).toEqual([2026, 2027, 2025]);
    const c = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, maxCalls: 0 });
    expect(c.yearsCompleted).toEqual([]);
  });
});
