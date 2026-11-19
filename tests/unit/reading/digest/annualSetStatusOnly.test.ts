/**
 * The 5-minute digest sweep's annual-set check (ensureAnnualSet → ensureChartData noFetch) read every row's payload to
 * learn 210 statuses (pg_stat_statements 2026-11-19: 3,087 calls, 643 ms mean, 9 MB a call). It now reads statuses
 * only (`readRowStatus`: no payload, no params); payloads are read only for the rows it then fetches.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../../src/reading/chartData/catalog.js';
import { clearChartDataCaches, ensureChartData, prismaChartDataRepo, type ChartDataRepo, type FetchResult, type RowKey, type StoredRow } from '../../../../src/reading/chartData/store.js';
import { annualSetKeys, ensureAnnualSet } from '../../../../src/reading/digest/annualSet.js';

function memRepo() {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const served: ChartTypeRow[] = BUILTIN_CHART_TYPES.filter((t) => t.family === 'annual').map((t) => ({
    id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: '2', legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true,
  }));
  const reads = { full: 0, status: 0 };
  const repo: ChartDataRepo & { rows: typeof rows; reads: typeof reads } = {
    rows,
    reads,
    async loadTypes() {
      return served;
    },
    async readRows(_id, keys) {
      reads.full += 1;
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readRowStatus(_id, keys) {
      reads.status += 1;
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r)).map((r) => ({ ...r, payload: null, params: {} }));
    },
    async readLegacy() {
      return {};
    },
    async claim(_id, key, params) {
      rows.set(k(key), { ...key, params, status: 'fetching', fetchStartedAt: new Date(), payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null });
      return true;
    },
    async complete(_id, key, _ay, r: FetchResult) {
      rows.set(k(key), { ...key, params: {}, status: r.status, payload: r.payload ?? null, calcVersion: r.calcVersion, error: r.error ?? null, fetchStartedAt: null, fetchedAt: new Date(), validTo: r.validTo ?? null });
    },
    async kundliRequest() {
      return { params: { dob: '2000-01-01', tob: '10:00:00', place: 'Test,IN' }, coords: { lat: 1, lon: 1, tz: 0 } };
    },
  };
  return repo;
}

beforeEach(() => clearChartDataCaches());

describe('annual-set status check', () => {
  it('a complete set is checked with one status read and no payload read', async () => {
    const repo = memRepo();
    const fetcher = async () => ({ big: 'x'.repeat(1000) });
    await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, span: 0, maxCalls: 50, concurrency: 1 });
    repo.reads.full = 0;
    repo.reads.status = 0;
    const r = await ensureAnnualSet({ repo, fetcher }, 'k1', { year: 2026, span: 0, maxCalls: 50 });
    expect(r).toMatchObject({ wanted: 10, present: 10, requested: 0, remaining: 0 });
    expect(repo.reads).toEqual({ full: 0, status: 1 });
  });

  it('statusOnly is honoured only with noFetch; a ready item comes back without its payload', async () => {
    const repo = memRepo();
    await ensureChartData({ repo, fetcher: async () => ({ v: 1 }) }, 'k1', ['annual.varsha@2026']);
    const status = await ensureChartData({ repo }, 'k1', ['annual.varsha@2026'], { noFetch: true, statusOnly: true });
    expect(status['annual.varsha@2026']).toMatchObject({ status: 'ready', payload: null });
    const full = await ensureChartData({ repo }, 'k1', ['annual.varsha@2026'], { statusOnly: true });
    expect(full['annual.varsha@2026']).toMatchObject({ status: 'ready', payload: { v: 1 } });
    expect(annualSetKeys(2026, 0)).toHaveLength(10);
  });

  it('the Prisma repository reads status columns only (no payload, no params)', async () => {
    let q: { select?: Record<string, boolean> } = {};
    const prisma = {
      kundliData: {
        findMany: async (args: typeof q) => {
          q = args;
          return [{ data_type: 'annual.varsha', variant: 'year=2026', status: 'failed', calc_version: '2', error: 'x', fetch_started_at: null, fetched_at: new Date(), valid_to: null }];
        },
      },
    };
    const rows = await prismaChartDataRepo(prisma as never).readRowStatus!('k1', [{ dataType: 'annual.varsha', variant: 'year=2026' }], 'LAHIRI');
    expect(Object.keys(q.select ?? {}).sort()).toEqual(['calc_version', 'data_type', 'error', 'fetch_started_at', 'fetched_at', 'status', 'valid_to', 'variant']);
    expect(rows[0]).toMatchObject({ dataType: 'annual.varsha', status: 'failed', payload: null, params: {} });
  });
});
