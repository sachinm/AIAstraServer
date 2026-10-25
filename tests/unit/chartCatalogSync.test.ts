import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_CHART_TYPES, type ChartDataType, type ChartTypeRow } from '../../src/reading/chartData/catalog.js';
import { scheduleChartCatalogSyncOnStart, syncChartCatalog, type ChartCatalogRepo } from '../../src/services/chartCatalogSync.js';
import type { RadhaCatalog } from '../../src/lib/astroKundliClient.js';

function toRow(t: ChartDataType): ChartTypeRow {
  return {
    id: t.id,
    family: t.family,
    radha_type: t.radhaType,
    change_class: t.changeClass,
    tier: t.tier,
    variant_kind: t.variantKind,
    served: t.served,
    calc_version: t.calcVersion,
    legacy_column: t.legacyColumn ?? null,
    sort_order: t.sortOrder,
    label: t.label,
    enabled: true,
  };
}

/** In-memory repo with Prisma-like upsert semantics; `writes` records every upsert so idempotence is observable. */
function memCatalogRepo(seed: ChartTypeRow[] = []) {
  const rows = new Map(seed.map((r) => [r.id, { ...r }]));
  const writes: string[] = [];
  const repo: ChartCatalogRepo & { rows: typeof rows; writes: string[] } = {
    rows,
    writes,
    async loadTypes() {
      return [...rows.values()].map((r) => ({ ...r }));
    },
    async upsertType(row) {
      writes.push(row.id);
      rows.set(row.id, { ...row });
    },
  };
  return repo;
}

function catalogOf(types: { type: string; calc_version: string }[], engine_commit = 'abc1234'): () => Promise<RadhaCatalog> {
  return async () => ({ engine_commit, types: types.map((t) => ({ ...t, params: {} })) });
}

const byRadha = (radhaType: string): ChartDataType => BUILTIN_CHART_TYPES.find((t) => t.radhaType === radhaType)!;

describe('syncChartCatalog (S-1)', () => {
  it('serves the types Radha lists with its calc_version and unserves the rest', async () => {
    const repo = memCatalogRepo();
    const result = await syncChartCatalog({
      repo,
      fetchCatalog: catalogOf([
        { type: 'd1', calc_version: 'v2' },
        { type: 'vimsottari_dasa', calc_version: 'v3' },
      ]),
    });

    expect(result.engineCommit).toBe('abc1234');
    expect(repo.rows.get('varga.d1')).toMatchObject({ served: true, calc_version: 'v2', radha_type: 'd1' });
    expect(repo.rows.get('dasha.vimsottari')).toMatchObject({ served: true, calc_version: 'v3', radha_type: 'vimsottari_dasa' });
    // built-in served by the code floor, but Radha does not list it: unserved
    expect(repo.rows.get('panchanga.birth')).toMatchObject({ served: false, radha_type: 'biodata' });
    expect(repo.rows.get('varga.d2')).toMatchObject({ served: false });
    expect([...result.served].sort()).toEqual(['dasha.vimsottari', 'varga.d1']);
    expect(result.served.length + result.unserved.length).toBe(BUILTIN_CHART_TYPES.length);
    expect(result.inserted).toBe(BUILTIN_CHART_TYPES.length);
    expect(result.updated).toBe(0);
  });

  it('is idempotent: a second run with the same catalog writes nothing', async () => {
    const repo = memCatalogRepo();
    const fetchCatalog = catalogOf([{ type: 'd1', calc_version: 'v2' }]);
    await syncChartCatalog({ repo, fetchCatalog });
    repo.writes.length = 0;

    const again = await syncChartCatalog({ repo, fetchCatalog });
    expect(repo.writes).toEqual([]);
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(0);
  });

  it('updates only the rows whose served or calc_version changed, and never deletes rows', async () => {
    // every built-in row already exists (unserved), so only the rows we change are written
    const seed: ChartTypeRow[] = [
      ...BUILTIN_CHART_TYPES.map((t) => ({ ...toRow(t), served: false, calc_version: null })),
      { ...toRow(byRadha('d1')), served: true, calc_version: 'v1' },
      { ...toRow(byRadha('d9')), served: true, calc_version: 'v2' },
      {
        id: 'custom.extra',
        family: 'special',
        radha_type: 'x',
        change_class: 'natal',
        tier: 'on_demand',
        variant_kind: 'natal',
        served: true,
        calc_version: 'v1',
        legacy_column: null,
        sort_order: 999,
        label: 'DB only',
        enabled: true,
      },
    ];
    const repo = memCatalogRepo(seed);
    const result = await syncChartCatalog({
      repo,
      fetchCatalog: catalogOf([
        { type: 'd1', calc_version: 'v2' },
        { type: 'd9', calc_version: 'v2' },
      ]),
    });

    expect(repo.writes).toEqual(['varga.d1']);
    expect(result.updated).toBe(1);
    expect(repo.rows.get('varga.d1')).toMatchObject({ served: true, calc_version: 'v2' });
    expect(repo.rows.get('varga.d9')).toMatchObject({ served: true, calc_version: 'v2' });
    // rows the built-in list does not know about are left alone
    expect(repo.rows.get('custom.extra')).toMatchObject({ served: true, calc_version: 'v1' });
    expect(repo.rows.size).toBe(BUILTIN_CHART_TYPES.length + 1);
  });

  it('keeps the stored calc_version for an unlisted type and reports Radha types this build does not know', async () => {
    const repo = memCatalogRepo([{ ...toRow(byRadha('d1')), served: true, calc_version: 'v1' }]);
    const result = await syncChartCatalog({ repo, fetchCatalog: catalogOf([{ type: 'mystery_type', calc_version: 'v9' }]) });

    expect(repo.rows.get('varga.d1')).toMatchObject({ served: false, calc_version: 'v1' });
    expect(result.unknownRadhaTypes).toEqual(['mystery_type']);
    expect(result.served).toEqual([]);
  });

  it('refuses an empty catalog instead of unserving every type, and writes nothing', async () => {
    const repo = memCatalogRepo([{ ...toRow(byRadha('d1')), served: true, calc_version: 'v1' }]);
    await expect(syncChartCatalog({ repo, fetchCatalog: catalogOf([]) })).rejects.toThrow(/refusing/);
    expect(repo.writes).toEqual([]);
    expect(repo.rows.get('varga.d1')).toMatchObject({ served: true });
  });

  it('propagates a Radha failure without writing', async () => {
    const repo = memCatalogRepo();
    await expect(
      syncChartCatalog({
        repo,
        fetchCatalog: async () => {
          throw new Error('HTTP 503');
        },
      })
    ).rejects.toThrow('HTTP 503');
    expect(repo.writes).toEqual([]);
  });
});

describe('scheduleChartCatalogSyncOnStart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when CHART_CATALOG_SYNC_ON_START is not 1', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const prisma = { chartDataType: { findMany: vi.fn(), upsert: vi.fn() } };
    const log = { log: vi.fn(), warn: vi.fn() };
    scheduleChartCatalogSyncOnStart(prisma as never, {}, log);
    scheduleChartCatalogSyncOnStart(prisma as never, { CHART_CATALOG_SYNC_ON_START: '0' }, log);
    await new Promise((r) => setTimeout(r, 20));
    expect(prisma.chartDataType.findMany).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(log.log).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs a failed sync as a warning and never throws', async () => {
    const prisma = { chartDataType: { findMany: vi.fn(), upsert: vi.fn() } };
    const log = { log: vi.fn(), warn: vi.fn() };
    // fetch refuses, so the catalog call fails before any DB read
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED')));
    expect(() => scheduleChartCatalogSyncOnStart(prisma as never, { CHART_CATALOG_SYNC_ON_START: '1' }, log)).not.toThrow();
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledTimes(1), { timeout: 5_000 });
    expect(String(log.warn.mock.calls[0]![0])).toContain('chart catalog sync failed');
    expect(prisma.chartDataType.findMany).not.toHaveBeenCalled();
  }, 10_000);
});
