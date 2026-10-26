import { beforeEach, describe, expect, it } from 'vitest';
import {
  ARUDHA_ARGALA_VARGAS,
  BUILTIN_CHART_TYPES,
  CHART_TYPE_BY_ID,
  mergeChartTypes,
  type ChartTypeRow,
} from '../../../src/reading/chartData/catalog.js';
import { clearChartDataCaches, ensureChartData, parseKey, type ChartDataRepo, type StoredRow } from '../../../src/reading/chartData/store.js';
import { syncChartCatalog, type ChartCatalogRepo } from '../../../src/services/chartCatalogSync.js';

beforeEach(() => clearChartDataCaches());

describe('per-chart arudha and argala catalog entries', () => {
  it('has argala.dN for all 12 charts and arudhas.dN for the 11 charts other than D1', () => {
    const ids = new Set(BUILTIN_CHART_TYPES.map((t) => t.id));
    for (const f of ARUDHA_ARGALA_VARGAS) {
      expect(ids.has(`argala.d${f}`)).toBe(true);
      expect(ids.has(`arudhas.d${f}`)).toBe(f !== 1);
    }
    expect(ARUDHA_ARGALA_VARGAS).toEqual([1, 2, 3, 4, 7, 9, 10, 12, 20, 24, 30, 60]);
    // D1 arudhas stay the plain entry
    expect(CHART_TYPE_BY_ID.get('arudhas')!.fixedParams).toBeUndefined();
  });

  it('sends the Radha type with a fixed varga, and is fetched on demand', () => {
    for (const f of ARUDHA_ARGALA_VARGAS) {
      const arg = CHART_TYPE_BY_ID.get(`argala.d${f}`)!;
      expect(arg).toMatchObject({ radhaType: 'argala', fixedParams: { varga: f }, tier: 'on_demand', changeClass: 'natal', variantKind: 'natal', served: false });
      if (f !== 1) expect(CHART_TYPE_BY_ID.get(`arudhas.d${f}`)).toMatchObject({ radhaType: 'arudhas', fixedParams: { varga: f }, tier: 'on_demand' });
    }
  });

  it('has unique ids and unique sort orders', () => {
    const ids = BUILTIN_CHART_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = BUILTIN_CHART_TYPES.map((t) => t.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('parseKey hands the fixed varga to the request, and a copy of it', () => {
    const p = parseKey('argala.d9', CHART_TYPE_BY_ID);
    expect(p).toMatchObject({ id: 'argala.d9', variant: '', params: { varga: 9 } });
    p.params.varga = 99;
    expect(CHART_TYPE_BY_ID.get('argala.d9')!.fixedParams).toEqual({ varga: 9 });
    expect(parseKey('varga.d9', CHART_TYPE_BY_ID).params).toEqual({});
    expect(parseKey('argala.d9@2027', CHART_TYPE_BY_ID).error).toMatch(/takes no variant/);
  });

  it('keeps the fixed varga when a table row overrides the built-in entry', () => {
    const t = CHART_TYPE_BY_ID.get('argala.d24')!;
    const row: ChartTypeRow = {
      id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind,
      served: true, calc_version: '1', legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true,
    };
    const merged = mergeChartTypes([row]).find((x) => x.id === 'argala.d24')!;
    expect(merged.served).toBe(true);
    expect(merged.fixedParams).toEqual({ varga: 24 });
  });
});

describe('fetching a per-chart type', () => {
  function memRepo() {
    const rows = new Map<string, StoredRow>();
    const key = (k: { dataType: string; variant: string }) => `${k.dataType}|${k.variant}`;
    const repo: ChartDataRepo = {
      async loadTypes() {
        return [
          // the table row says served, as the catalog sync would
          ...['argala.d9', 'argala.d24', 'arudhas.d20'].map((id) => {
            const t = CHART_TYPE_BY_ID.get(id)!;
            return { id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: '1', legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true };
          }),
        ];
      },
      async readRows(_id, keys) {
        return keys.map((k) => rows.get(key(k))).filter((r): r is StoredRow => Boolean(r));
      },
      async readLegacy() {
        return {};
      },
      async claim(_id, k, params) {
        rows.set(key(k), { ...k, params, status: 'fetching', fetchStartedAt: new Date(), payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null } as StoredRow);
        return true;
      },
      async complete(_id, k, _ay, result) {
        const prev = rows.get(key(k));
        rows.set(key(k), { ...k, params: prev?.params ?? {}, calcVersion: result.calcVersion, payload: result.status === 'ready' ? result.payload : null, status: result.status, error: null, fetchStartedAt: null, fetchedAt: new Date(), validTo: null } as StoredRow);
      },
      async kundliRequest() {
        return { params: { dob: '2002-04-27', tob: '17:05:00', place: 'Delhi,IN' }, coords: { lat: 28.9, lon: 77.0, tz: 5.5 } };
      },
    };
    return { repo, rows };
  }

  it('calls Radha with the entry’s type and varga, and stores one row per chart', async () => {
    const { repo, rows } = memRepo();
    const calls: Array<{ type: string; extra: Record<string, unknown> }> = [];
    const fetcher = async (_req: unknown, type: string, extra: Record<string, unknown>) => {
      calls.push({ type, extra });
      return { chart: `D${extra.varga}`, data_type: type, calc_version: '1', data: { ok: true, varga: extra.varga } };
    };
    const out = await ensureChartData({ repo, fetcher: fetcher as never }, 'k1', ['argala.d9', 'argala.d24', 'arudhas.d20']);
    expect(calls.map((c) => `${c.type}:${String(c.extra.varga)}`).sort()).toEqual(['argala:24', 'argala:9', 'arudhas:20']);
    expect(Object.keys(out).sort()).toEqual(['argala.d24', 'argala.d9', 'arudhas.d20']);
    for (const item of Object.values(out)) expect(item.status).toBe('ready');
    // one stored row per chart; the varga is kept with the row
    expect([...rows.keys()].sort()).toEqual(['argala.d24|', 'argala.d9|', 'arudhas.d20|']);
    expect(rows.get('argala.d9|')!.params).toEqual({ varga: 9 });
  });
});

describe('catalog sync with the new entries', () => {
  function memCatalogRepo() {
    const rows = new Map<string, ChartTypeRow>();
    const repo: ChartCatalogRepo = {
      async loadTypes() {
        return [...rows.values()];
      },
      async upsertType(row) {
        rows.set(row.id, { ...row });
      },
    };
    return { repo, rows };
  }

  it('creates the rows, marks them served from Radha, and no longer reports argala as unknown', async () => {
    const { repo, rows } = memCatalogRepo();
    const res = await syncChartCatalog({
      repo,
      fetchCatalog: async () => ({
        engine_commit: 'abc',
        types: [{ type: 'arudhas', calc_version: '2' }, { type: 'argala', calc_version: '1' }, { type: 'd9', calc_version: '1' }],
      }),
    });
    expect(res.unknownRadhaTypes).toEqual([]);
    for (const f of ARUDHA_ARGALA_VARGAS) {
      expect(rows.get(`argala.d${f}`)).toMatchObject({ served: true, calc_version: '1', radha_type: 'argala' });
      if (f !== 1) expect(rows.get(`arudhas.d${f}`)).toMatchObject({ served: true, calc_version: '2', radha_type: 'arudhas' });
    }
    expect(res.served).toEqual(expect.arrayContaining(['argala.d9', 'arudhas.d60', 'arudhas', 'varga.d9']));
    // a second run changes nothing
    const again = await syncChartCatalog({
      repo,
      fetchCatalog: async () => ({ engine_commit: 'abc', types: [{ type: 'arudhas', calc_version: '2' }, { type: 'argala', calc_version: '1' }, { type: 'd9', calc_version: '1' }] }),
    });
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(0);
  });
});
