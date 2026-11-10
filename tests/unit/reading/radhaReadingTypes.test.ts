import { beforeEach, describe, expect, it } from 'vitest';
import {
  ARUDHA_ARGALA_VARGAS,
  AVASTHA_VARGAS,
  BUILTIN_CHART_TYPES,
  CHART_TYPE_BY_ID,
  LEVEL3_DASHAS,
  PAST_READING_ANNUAL_TYPES,
  PAST_READING_MOVING_TYPES,
  PAST_READING_NATAL_TYPES,
  VARGA_TABLE_TYPES,
  type ChartTypeRow,
} from '../../../src/reading/chartData/catalog.js';
import { ensurePastReadingData, registrationPlan } from '../../../src/reading/chartData/registration.js';
import { clearChartDataCaches, ensureChartData, movingTypeError, needsFetch, parseKey, type ChartDataRepo, type StoredRow } from '../../../src/reading/chartData/store.js';
import { syncChartCatalog, type ChartCatalogRepo } from '../../../src/services/chartCatalogSync.js';

beforeEach(() => clearChartDataCaches());

const asServedRow = (id: string): ChartTypeRow => {
  const t = CHART_TYPE_BY_ID.get(id)!;
  return { id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true, calc_version: '2', legacy_column: null, sort_order: t.sortOrder, label: t.label, enabled: true };
};

describe('doc 34 catalog entries', () => {
  it('has dignities, aspects and relations per chart, with D1 staying the plain entry', () => {
    for (const name of VARGA_TABLE_TYPES) {
      expect(CHART_TYPE_BY_ID.get(name)!.fixedParams).toBeUndefined();
      expect(CHART_TYPE_BY_ID.has(`${name}.d1`)).toBe(false);
      for (const f of ARUDHA_ARGALA_VARGAS.filter((x) => x !== 1)) {
        expect(CHART_TYPE_BY_ID.get(`${name}.d${f}`)).toMatchObject({ radhaType: name, fixedParams: { varga: f }, tier: 'on_demand', changeClass: 'natal', variantKind: 'natal', served: false, calcVersion: null });
      }
    }
  });

  it('has reading_tables and avasthas (D1 + D9/D10/D16/D24) registered for past life reading', () => {
    expect(CHART_TYPE_BY_ID.get('reading_tables')).toMatchObject({
      radhaType: 'reading_tables',
      tier: 'on_demand',
      changeClass: 'natal',
      served: false,
      calcVersion: null,
    });
    expect(CHART_TYPE_BY_ID.get('avasthas')).toMatchObject({
      radhaType: 'avasthas',
      tier: 'on_demand',
      changeClass: 'natal',
      served: false,
      calcVersion: null,
    });
    for (const f of AVASTHA_VARGAS) {
      expect(CHART_TYPE_BY_ID.get(`avasthas.d${f}`)).toMatchObject({
        radhaType: 'avasthas',
        fixedParams: { varga: f },
        tier: 'on_demand',
        changeClass: 'natal',
        served: false,
        calcVersion: null,
      });
    }
    expect(PAST_READING_NATAL_TYPES).toContain('reading_tables');
    expect(PAST_READING_NATAL_TYPES).toContain('avasthas');
    expect(PAST_READING_NATAL_TYPES).toContain('dasha.dwisatpathi.l3');
    expect(PAST_READING_ANNUAL_TYPES).toEqual([
      'annual.tithi_pravesha',
      'annual.varsha',
      'annual.sahams',
      'annual.tithi_pravesha_dasha',
      'annual.patyayini',
      'annual.mudda',
    ]);
    expect(PAST_READING_MOVING_TYPES).toEqual(['transit_range', 'transit_contacts']);
  });

  it('has a level-3 entry per doc 34 system (and narayana, doc 67) on the dasha.<name> wire type; default entries ask for three levels too', () => {
    expect(LEVEL3_DASHAS).toEqual(['vimsottari', 'dwisatpathi', 'yogini', 'tithi_ashtottari', 'kaala', 'karaka', 'narayana']);
    for (const name of LEVEL3_DASHAS) {
      expect(CHART_TYPE_BY_ID.get(`dasha.${name}.l3`)).toMatchObject({ family: 'dasha', radhaType: `dasha.${name}`, fixedParams: { levels: 3 }, tier: 'on_demand', served: false });
      const base = CHART_TYPE_BY_ID.get(`dasha.${name}`)!;
      // legacy wire types take no params; every other default entry asks for three levels, lifelong (doc 67)
      expect(base.fixedParams).toEqual(base.legacyColumn ? undefined : { levels: 3 });
    }
    expect(CHART_TYPE_BY_ID.get('dasha.kalachakra')!.fixedParams).toBeUndefined(); // the engine serves one level only
    expect(CHART_TYPE_BY_ID.get('dasha.vimsottari')).toMatchObject({ radhaType: 'vimsottari_dasa', legacyColumn: 'vimsottari_dasa' });
    expect(CHART_TYPE_BY_ID.get('dasha.vimsottari.l3')!.legacyColumn).toBeUndefined();
  });

  it('registers the day-level types as moving, unserved, never pulled and never fetched by ensureChartData', async () => {
    const ids = ['daily_grade', 'muhurta', 'transit_ashtakavarga'];
    for (const id of ids) {
      expect(CHART_TYPE_BY_ID.get(id)).toMatchObject({ radhaType: id, changeClass: 'moving', tier: 'on_demand', served: false, calcVersion: null });
      expect(movingTypeError(id)).toMatch(/needs a date range/);
    }
    const plan = registrationPlan(BUILTIN_CHART_TYPES.map((t) => ({ ...t, served: true })));
    for (const id of ids) expect(plan.requested.map((t) => t.id)).not.toContain(id);

    const repo = {
      async loadTypes() {
        return ids.map(asServedRow);
      },
    } as unknown as ChartDataRepo;
    const fetcher = async () => {
      throw new Error('must not be called');
    };
    const out = await ensureChartData({ repo, fetcher: fetcher as never }, 'k1', ids);
    for (const id of ids) expect(out[id]).toMatchObject({ status: 'failed', error: movingTypeError(id) });
  });

  it('keeps ids and sort orders unique, and puts no new entry ahead of the sign-up gate', () => {
    const ids = BUILTIN_CHART_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = BUILTIN_CHART_TYPES.map((t) => t.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    const plan = registrationPlan(BUILTIN_CHART_TYPES.map((t) => ({ ...t, served: t.id !== 'dasha.brahma' })));
    expect(plan.gate.some((t) => /\.l3$|^(dignities|aspects|relations|avasthas)\.d\d+$/.test(t.id))).toBe(false);
  });
});

describe('fetching the new entries', () => {
  it('sends the fixed varga or levels inside params and stores one row per entry', async () => {
    const keys = ['dignities', 'dignities.d9', 'aspects.d10', 'relations.d60', 'avasthas', 'avasthas.d16', 'dasha.vimsottari.l3', 'dasha.yogini.l3'];
    const rows = new Map<string, StoredRow>();
    const repo: ChartDataRepo = {
      async loadTypes() {
        return keys.map(asServedRow);
      },
      async readRows() {
        return [];
      },
      async readLegacy() {
        return {};
      },
      async claim() {
        return true;
      },
      async complete(_id, k, _ay, result) {
        rows.set(k.dataType, { ...k, params: {}, calcVersion: result.calcVersion, payload: result.status === 'ready' ? result.payload : null, status: result.status, error: null, fetchStartedAt: null, fetchedAt: new Date(), validTo: null } as StoredRow);
      },
      async kundliRequest() {
        return { params: { dob: '2002-04-27', tob: '17:05:00', place: 'Delhi,IN' }, coords: { lat: 28.9, lon: 77.0, tz: 5.5 } };
      },
    };
    const calls: string[] = [];
    const fetcher = async (_req: unknown, type: string, extra: Record<string, unknown>) => {
      calls.push(`${type}:${JSON.stringify(extra.params ?? null)}`);
      return { data_type: type, calc_version: '2', data: { ok: true } };
    };
    const out = await ensureChartData({ repo, fetcher: fetcher as never }, 'k1', keys);
    expect(calls.sort()).toEqual([
      'aspects:{"varga":10}',
      'avasthas:null',
      'avasthas:{"varga":16}',
      'dasha.vimsottari:{"levels":3}',
      'dasha.yogini:{"levels":3}',
      'dignities:null',
      'dignities:{"varga":9}',
      'relations:{"varga":60}',
    ]);
    for (const k of keys) expect(out[k]!.status).toBe('ready');
    expect([...rows.keys()].sort()).toEqual([...keys].sort());
    expect(parseKey('dasha.yogini.l3@2027', CHART_TYPE_BY_ID).error).toMatch(/takes no variant/);
  });

  it('ensurePastReadingData requests natal and annual keys across the requested year span', async () => {
    const allIds = [...PAST_READING_NATAL_TYPES, ...PAST_READING_ANNUAL_TYPES];
    const repo: ChartDataRepo = {
      async loadTypes() {
        return allIds.map(asServedRow);
      },
      async readRows() {
        return [];
      },
      async readLegacy() {
        return {};
      },
      async claim() {
        return true;
      },
      async complete() {},
      async kundliRequest() {
        return { params: { dob: '1980-10-14', tob: '16:55:00', place: 'Pune,IN' }, coords: { lat: 18.52, lon: 73.85, tz: 5.5 } };
      },
    };
    const fetcher = async (_req: unknown, type: string) => ({ data_type: type, calc_version: '2', data: { ok: true } });
    const out = await ensurePastReadingData({ repo, fetcher: fetcher as never }, 'k-sachin', { endYear: 2026, years: 1 });
    expect(out['reading_tables']?.status).toBe('ready');
    expect(out['avasthas']?.status).toBe('ready');
    expect(out['annual.tithi_pravesha@2025']?.status).toBe('ready');
    expect(out['annual.tithi_pravesha@2026']?.status).toBe('ready');
  });
});

describe('catalog sync with the new Radha catalog', () => {
  const radha = {
    engine_commit: 'abc',
    types: [
      { type: 'dignities', calc_version: '2' },
      { type: 'aspects', calc_version: '2' },
      { type: 'relations', calc_version: '2' },
      { type: 'reading_tables', calc_version: '1' },
      { type: 'avasthas', calc_version: '1' },
      { type: 'annual.varsha', calc_version: '2' },
      { type: 'annual.tithi_pravesha', calc_version: '2' },
      { type: 'vimsottari_dasa', calc_version: '2' },
      { type: 'dasha.vimsottari', calc_version: '1' },
      { type: 'daily_grade', calc_version: '1' },
      { type: 'muhurta', calc_version: '1' },
      { type: 'transit_ashtakavarga', calc_version: '1' },
    ],
  };
  function mem(initial: ChartTypeRow[] = []) {
    const rows = new Map<string, ChartTypeRow>(initial.map((r) => [r.id, r]));
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

  it('serves every new entry from its Radha type and reports none of them as unknown', async () => {
    const { repo, rows } = mem();
    const res = await syncChartCatalog({ repo, fetchCatalog: async () => radha });
    expect(res.unknownRadhaTypes).toEqual([]);
    expect(rows.get('dignities.d9')).toMatchObject({ served: true, calc_version: '2', radha_type: 'dignities' });
    expect(rows.get('relations.d60')).toMatchObject({ served: true, calc_version: '2' });
    expect(rows.get('reading_tables')).toMatchObject({ served: true, calc_version: '1' });
    expect(rows.get('avasthas.d16')).toMatchObject({ served: true, calc_version: '1', radha_type: 'avasthas' });
    for (const id of ['daily_grade', 'muhurta', 'transit_ashtakavarga']) expect(rows.get(id)).toMatchObject({ served: true, calc_version: '1', change_class: 'moving' });
    // the level-3 row follows dasha.vimsottari, the default row its legacy wire type
    expect(rows.get('dasha.vimsottari.l3')).toMatchObject({ served: true, calc_version: '1' });
    expect(rows.get('dasha.vimsottari')).toMatchObject({ served: true, calc_version: '2' });
    const again = await syncChartCatalog({ repo, fetchCatalog: async () => radha });
    expect(again).toMatchObject({ inserted: 0, updated: 0 });
  });

  it('moves the annual charts to calc_version 2, which makes rows stored at 1 stale', async () => {
    const old = (id: string): ChartTypeRow => ({ ...asServedRow(id), calc_version: '1' });
    const { repo, rows } = mem([old('annual.varsha'), old('annual.tithi_pravesha'), old('dignities')]);
    await syncChartCatalog({ repo, fetchCatalog: async () => radha });
    for (const id of ['annual.varsha', 'annual.tithi_pravesha', 'dignities']) expect(rows.get(id)!.calc_version).toBe('2');
    const stored = { dataType: 'annual.varsha', variant: 'year=2026', status: 'ready', calcVersion: '1' } as unknown as StoredRow;
    expect(needsFetch(stored, { ...CHART_TYPE_BY_ID.get('annual.varsha')!, calcVersion: '2' }, Date.now(), 90_000)).toBe(true);
  });
});
