import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_CHART_TYPES, CHART_TYPE_BY_ID, VARGA_FACTORS, mergeChartTypes, typesForTier } from '../../../src/reading/chartData/catalog.js';
import {
  clearChartDataCaches,
  ensureChartData,
  needsFetch,
  parseKey,
  type ChartDataRepo,
  type FetchResult,
  type KundliRequest,
  type RowKey,
  type StoredRow,
} from '../../../src/reading/chartData/store.js';
import { chartDataTypeIds } from '../../../src/reading/chartData/tool.js';

/** In-memory repository with the same claim semantics as the SQL (row is the lock). */
function memRepo(opts: { legacy?: Record<string, unknown>; missingTables?: boolean; request?: KundliRequest | null } = {}) {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const missing = () => {
    if (opts.missingTables) throw Object.assign(new Error('relation "kundli_data" does not exist'), { code: 'P2021' });
  };
  const repo: ChartDataRepo & { rows: typeof rows; completes: number } = {
    rows,
    completes: 0,
    async loadTypes() {
      missing();
      return [];
    },
    async readRows(_id, keys) {
      missing();
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readLegacy(_id, columns) {
      return Object.fromEntries(columns.map((c) => [c, opts.legacy?.[c] ?? null]));
    },
    async claim(_id, key, params, _ay, leaseMs) {
      missing();
      const r = rows.get(k(key));
      if (r && r.status === 'fetching' && r.fetchStartedAt && Date.now() - r.fetchStartedAt.getTime() <= leaseMs) return false;
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date() } as StoredRow);
      return true;
    },
    async complete(_id, key, _ay, result: FetchResult) {
      missing();
      repo.completes += 1;
      const prev = rows.get(k(key));
      rows.set(k(key), {
        ...key,
        params: prev?.params ?? {},
        calcVersion: result.calcVersion,
        payload: result.status === 'ready' ? result.payload : (prev?.payload ?? null),
        status: result.status,
        error: result.error ?? null,
        fetchStartedAt: prev?.fetchStartedAt ?? null,
        fetchedAt: new Date(),
        validTo: result.validTo ?? null,
      });
    },
    async kundliRequest() {
      return opts.request === undefined ? { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN' }, coords: { lat: 28.6, lon: 77.2, tz: 5.5 } } : opts.request;
    },
  };
  return repo;
}

beforeEach(() => clearChartDataCaches());

describe('catalog', () => {
  it('lists every varga factor, 44 dashas plus dasha.applicable and the annual items with unique ids', () => {
    const ids = BUILTIN_CHART_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of VARGA_FACTORS) expect(CHART_TYPE_BY_ID.get(`varga.d${f}`)).toBeTruthy();
    expect(BUILTIN_CHART_TYPES.filter((t) => t.family === 'dasha')).toHaveLength(45);
    expect(CHART_TYPE_BY_ID.get('annual.varsha')?.variantKind).toBe('year');
  });
  it('lists the R-4a/R-4b/R-5 types and transit with their wire names, unserved until the catalog sync', () => {
    for (const id of ['relations', 'benefic_malefic', 'dignities', 'bhava', 'dasha.applicable']) {
      expect(CHART_TYPE_BY_ID.get(id)).toMatchObject({ radhaType: id, changeClass: 'natal', variantKind: 'natal', tier: 'on_demand', served: false, calcVersion: null });
    }
    expect(CHART_TYPE_BY_ID.get('annual.tithi_pravesha_dasha')).toMatchObject({ radhaType: 'annual.tithi_pravesha_dasha', changeClass: 'annual', variantKind: 'year', tier: 'on_demand', served: false });
    expect(CHART_TYPE_BY_ID.get('transit')).toMatchObject({ radhaType: 'transit', family: 'transit', changeClass: 'moving', tier: 'on_demand', served: false });
    expect(CHART_TYPE_BY_ID.get('dasha.brahma')).toMatchObject({ served: false }); // Radha does not export it (pyjhora bug)
    expect(CHART_TYPE_BY_ID.get('transit_contacts')).toMatchObject({ radhaType: 'transit_contacts', family: 'transit', changeClass: 'moving', tier: 'on_demand', served: false, calcVersion: null });
    expect(BUILTIN_CHART_TYPES.filter((t) => t.changeClass === 'moving').map((t) => t.id)).toEqual(['transit', 'transit_contacts']);
    expect(chartDataTypeIds()).not.toContain('transit');
    expect(chartDataTypeIds()).not.toContain('transit_contacts');
    expect(chartDataTypeIds()).toContain('annual.tithi_pravesha_dasha@<year>');
  });
  it('serves exactly the ten types Radha exports today, each with its legacy column', () => {
    const served = BUILTIN_CHART_TYPES.filter((t) => t.served);
    expect(served.map((t) => t.radhaType).sort()).toEqual(['biodata', 'charakaraka', 'd1', 'd10', 'd2', 'd4', 'd7', 'd9', 'narayana_dasa', 'vimsottari_dasa']);
    for (const t of served) expect(t.legacyColumn && t.calcVersion).toBe('legacy');
  });
  it('registration order puts the first tier first (doc 21 Q1)', () => {
    const reg = typesForTier(BUILTIN_CHART_TYPES, 'registration');
    const firstCount = reg.filter((t) => t.tier === 'first').length;
    expect(reg.slice(0, firstCount).every((t) => t.tier === 'first')).toBe(true);
    expect(reg.map((t) => t.id)).toEqual(expect.arrayContaining(['panchanga.birth', 'varga.d1', 'varga.d9', 'dasha.vimsottari', 'varga.d60', 'ashtakavarga']));
    expect(reg.some((t) => t.id === 'annual.varsha')).toBe(false);
  });
  it('database rows override the code floor and can disable a type', () => {
    const merged = mergeChartTypes([
      { id: 'varga.d60', family: 'varga', radha_type: 'd60', change_class: 'natal', tier: 'first', variant_kind: 'natal', served: true, calc_version: '1', legacy_column: null, sort_order: 1, label: 'D60', enabled: true },
      { id: 'dasha.aayu', family: 'dasha', radha_type: 'x', change_class: 'natal', tier: 'on_demand', variant_kind: 'natal', served: false, calc_version: null, legacy_column: null, sort_order: 1, label: 'x', enabled: false },
    ]);
    expect(merged.find((t) => t.id === 'varga.d60')).toMatchObject({ served: true, calcVersion: '1', tier: 'first' });
    expect(merged.some((t) => t.id === 'dasha.aayu')).toBe(false);
  });
  it('the M7 + M9 + M11 + M12 migrations seed every built-in type and M7 backfills every legacy column', () => {
    const m7 = readFileSync(path.resolve('prisma/migrations/20261025120000_reading_m7_kundli_data/migration.sql'), 'utf8');
    const m9 = readFileSync(path.resolve('prisma/migrations/20261025160000_reading_m9_catalog_more_types/migration.sql'), 'utf8');
    const m11 = readFileSync(path.resolve('prisma/migrations/20261026110000_reading_m11_arudha_argala_per_varga/migration.sql'), 'utf8');
    const m12 = readFileSync(path.resolve('prisma/migrations/20261026120000_reading_m12_transit_contacts/migration.sql'), 'utf8');
    const m9Ids = ['dasha.applicable', 'relations', 'benefic_malefic', 'dignities', 'bhava', 'annual.tithi_pravesha_dasha', 'transit'];
    const m12Ids = ['transit_contacts'];
    const isM11 = (id: string) => /^(arudhas|argala)\.d\d+$/.test(id);
    const seedRow = (t: (typeof BUILTIN_CHART_TYPES)[number]) =>
      `('${t.id}', '${t.family}', '${t.radhaType}', '${t.changeClass}', '${t.tier}', '${t.variantKind}', ${t.served}, ${t.calcVersion == null ? 'NULL' : `'${t.calcVersion}'`}, ${t.legacyColumn ? `'${t.legacyColumn}'` : 'NULL'}, ${t.sortOrder}, '${t.label}')`;
    for (const t of BUILTIN_CHART_TYPES) {
      const sql = m12Ids.includes(t.id) ? m12 : isM11(t.id) ? m11 : m9Ids.includes(t.id) ? m9 : m7;
      expect(sql).toContain(seedRow(t));
    }
    for (const id of [...m9Ids, ...m12Ids]) expect(m7).not.toContain(`('${id}', `);
    for (const id of m12Ids) expect(m9 + m11).not.toContain(`('${id}', `);
    expect(m7).not.toMatch(/\('(arudhas|argala)\.d\d+', /);
    expect(m11).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(m12).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(m9).toMatch(/CHECK \("change_class" IN \('natal', 'annual', 'moving'\)\)/);
    expect(m9).toContain('ON CONFLICT ("id") DO NOTHING');
    for (const t of BUILTIN_CHART_TYPES.filter((x) => x.legacyColumn)) expect(m7).toContain(`SELECT "id", '${t.id}', 'legacy', "${t.legacyColumn}"`);
  });
});

describe('keys and staleness', () => {
  it('parses year variants and rejects bad keys', () => {
    expect(parseKey('annual.varsha@2027', CHART_TYPE_BY_ID)).toMatchObject({ id: 'annual.varsha', variant: 'year=2027', params: { year: 2027 } });
    expect(parseKey('annual.varsha', CHART_TYPE_BY_ID).error).toMatch(/needs a year/);
    expect(parseKey('varga.d1@2027', CHART_TYPE_BY_ID).error).toMatch(/no variant/);
    expect(parseKey('varga.d7000', CHART_TYPE_BY_ID).error).toMatch(/unknown/);
  });
  it('a calc_version change, an expired annual row, an old failure or an expired lease means refetch', () => {
    const t = { ...CHART_TYPE_BY_ID.get('varga.d1')!, calcVersion: '2' };
    const base: StoredRow = { dataType: 'varga.d1', variant: '', params: {}, calcVersion: '2', payload: {}, status: 'ready', error: null, fetchStartedAt: null, fetchedAt: new Date(), validTo: null };
    const now = Date.now();
    expect(needsFetch(base, t, now, 90_000)).toBe(false);
    expect(needsFetch({ ...base, calcVersion: 'legacy' }, t, now, 90_000)).toBe(true);
    expect(needsFetch({ ...base, validTo: new Date(now - 1) }, t, now, 90_000)).toBe(true);
    expect(needsFetch({ ...base, status: 'failed', fetchedAt: new Date(now - 60_000) }, t, now, 90_000)).toBe(false);
    expect(needsFetch({ ...base, status: 'failed', fetchedAt: new Date(now - 10 * 60_000) }, t, now, 90_000)).toBe(true);
    expect(needsFetch({ ...base, status: 'fetching', fetchStartedAt: new Date(now - 10_000) }, t, now, 90_000)).toBe(false);
    expect(needsFetch({ ...base, status: 'fetching', fetchStartedAt: new Date(now - 100_000) }, t, now, 90_000)).toBe(true);
  });
});

describe('ensureChartData', () => {
  it('fetches a missing served item once, stores it, and reads it from the table next time', async () => {
    const repo = memRepo();
    const fetcher = vi.fn(async (_req: KundliRequest, type: string) => ({ chart: type }));
    const first = await ensureChartData({ repo, fetcher }, 'k1', ['varga.d9']);
    expect(first['varga.d9']).toMatchObject({ status: 'ready', source: 'radha', payload: { chart: 'd9' } });
    expect(fetcher).toHaveBeenCalledWith(expect.anything(), 'd9', {});
    const second = await ensureChartData({ repo, fetcher }, 'k1', ['varga.d9']);
    expect(second['varga.d9']).toMatchObject({ status: 'ready', source: 'db' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves a legacy column without calling Radha and writes it through', async () => {
    const repo = memRepo({ legacy: { d1: { rows: [1] } } });
    const fetcher = vi.fn();
    const out = await ensureChartData({ repo, fetcher }, 'k1', ['varga.d1']);
    expect(out['varga.d1']).toMatchObject({ status: 'ready', source: 'legacy', payload: { rows: [1] } });
    expect(fetcher).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(repo.rows.get('varga.d1|')).toMatchObject({ status: 'ready', calcVersion: 'legacy' });
  });

  it('never calls Radha for a type it does not serve yet', async () => {
    const fetcher = vi.fn();
    const out = await ensureChartData({ repo: memRepo(), fetcher }, 'k1', ['varga.d60', 'annual.varsha@2027', 'nope']);
    expect(out['varga.d60']).toMatchObject({ status: 'unsupported' });
    expect(out['annual.varsha@2027']).toMatchObject({ status: 'unsupported' });
    expect(out['nope']).toMatchObject({ status: 'failed' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses moving types (transit) even when served: no row read, no claim, no Radha call', async () => {
    const repo = memRepo();
    repo.loadTypes = async () => [
      { id: 'transit', family: 'transit', radha_type: 'transit', change_class: 'moving', tier: 'on_demand', variant_kind: 'natal', served: true, calc_version: '1', legacy_column: null, sort_order: 600, label: 'Transit', enabled: true },
    ];
    const readRows = vi.spyOn(repo, 'readRows');
    const claim = vi.spyOn(repo, 'claim');
    const fetcher = vi.fn(async () => ({ chart: 'd9' }));
    const out = await ensureChartData({ repo, fetcher }, 'k1', ['transit', 'varga.d9']);
    expect(out['transit']).toMatchObject({ status: 'failed', source: null, payload: null });
    expect(out['transit'].error).toMatch(/moving type.*fetchTransit\(kundliId, \{ at, divisionalChartFactor, withNatal \}\).*transit\.ts/);
    expect(out['varga.d9']).toMatchObject({ status: 'ready', source: 'radha' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalledWith(expect.anything(), 'transit', expect.anything());
    expect(readRows.mock.calls.flatMap((c) => c[1].map((k) => k.dataType))).not.toContain('transit');
    expect(claim.mock.calls.map((c) => c[1].dataType)).not.toContain('transit');
    expect(repo.rows.has('transit|')).toBe(false);
  });

  it('a transit-only request returns before touching the store', async () => {
    const repo = memRepo();
    const readRows = vi.spyOn(repo, 'readRows');
    const out = await ensureChartData({ repo, fetcher: vi.fn() }, 'k1', ['transit']);
    expect(out['transit'].status).toBe('failed');
    expect(readRows).not.toHaveBeenCalled();
  });

  it('marks Radha "Invalid export type" as unsupported and other errors as failed', async () => {
    const repo = memRepo();
    const fetcher = vi.fn(async (_r: KundliRequest, type: string) => {
      if (type === 'd2') throw new Error('Invalid export type: d2');
      throw new Error('HTTP 502');
    });
    const out = await ensureChartData({ repo, fetcher }, 'k1', ['varga.d2', 'varga.d4']);
    expect(out['varga.d2'].status).toBe('unsupported');
    expect(out['varga.d4'].status).toBe('failed');
    expect(repo.rows.get('varga.d4|')?.status).toBe('failed');
  });

  it('two callers asking at once fetch the item only once (row is the lock)', async () => {
    const repo = memRepo();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = vi.fn(async () => {
      await gate;
      return { ok: true };
    });
    const a = ensureChartData({ repo, fetcher }, 'k1', ['dasha.vimsottari'], { pollMs: 5 });
    await new Promise((r) => setTimeout(r, 5));
    const b = ensureChartData({ repo, fetcher }, 'k1', ['dasha.vimsottari'], { pollMs: 5 });
    await new Promise((r) => setTimeout(r, 15));
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ra['dasha.vimsottari']).toMatchObject({ status: 'ready', source: 'radha' });
    expect(rb['dasha.vimsottari']).toMatchObject({ status: 'ready', source: 'db' });
  });

  it('caps parallel Radha calls', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetcher = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return {};
    });
    await ensureChartData({ repo: memRepo(), fetcher }, 'k1', ['varga.d2', 'varga.d4', 'varga.d7', 'varga.d10', 'dasha.narayana'], { concurrency: 2 });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(peak).toBe(2);
  });

  it('noFetch returns only what is stored', async () => {
    const fetcher = vi.fn();
    const out = await ensureChartData({ repo: memRepo(), fetcher }, 'k1', ['varga.d9'], { noFetch: true });
    expect(out['varga.d9'].status).toBe('missing');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('without the M7 tables it still answers from legacy columns and Radha', async () => {
    const repo = memRepo({ missingTables: true, legacy: { d1: { a: 1 } } });
    const fetcher = vi.fn(async () => ({ b: 2 }));
    const out = await ensureChartData({ repo, fetcher }, 'k1', ['varga.d1', 'varga.d9']);
    expect(out['varga.d1']).toMatchObject({ status: 'ready', source: 'legacy' });
    expect(out['varga.d9']).toMatchObject({ status: 'ready', source: 'radha' });
    expect(repo.completes).toBe(0);
  });

  it('reports a kundli with no birth details instead of calling Radha', async () => {
    const fetcher = vi.fn();
    const out = await ensureChartData({ repo: memRepo({ request: null }), fetcher }, 'k1', ['varga.d9']);
    expect(out['varga.d9']).toMatchObject({ status: 'failed', error: expect.stringMatching(/birth details/) });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('getChartData tool', () => {
  it('caps the list, drops junk and returns statuses', async () => {
    const { runGetChartData, MAX_ITEMS_PER_CALL, chartDataTypeIds } = await import('../../../src/reading/chartData/tool.js');
    const fetcher = vi.fn(async () => ({ ok: 1 }));
    const many = ['varga.d9', 'varga.d9', 42, '', ...Array.from({ length: 20 }, (_, i) => `x${i}`)];
    const r = await runGetChartData({ repo: memRepo(), fetcher }, 'k1', { types: many });
    expect(Object.keys(r.items).length).toBeLessThanOrEqual(MAX_ITEMS_PER_CALL);
    expect(r.truncated).toBe(true);
    expect(r.items['varga.d9']).toMatchObject({ status: 'ready' });
    expect(chartDataTypeIds()).toContain('annual.varsha@<year>');
    expect((await runGetChartData({ repo: memRepo(), fetcher }, 'k1', null)).items).toEqual({});
  });
});

describe('write-through from the kundli queue', () => {
  it('stores each legacy column as a row and turns itself off when the table is missing', async () => {
    const { writeLegacyColumnsThrough, resetWriteThrough } = await import('../../../src/reading/chartData/writeThrough.js');
    resetWriteThrough();
    const upsert = vi.fn(async () => ({}));
    const prisma = { kundliData: { upsert } } as never;
    expect(await writeLegacyColumnsThrough(prisma, 'k1', { d1: { a: 1 }, vimsottari_dasa: [], unknown_col: 1, d9: null })).toBe(2);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { kundli_data_key: { kundli_id: 'k1', data_type: 'varga.d1', variant: '', ayanamsa: 'LAHIRI' } } }));
    const missing = vi.fn(async () => { throw Object.assign(new Error('table does not exist'), { code: 'P2021' }); });
    const prisma2 = { kundliData: { upsert: missing } } as never;
    expect(await writeLegacyColumnsThrough(prisma2, 'k1', { d1: {}, d2: {} })).toBe(0);
    expect(missing).toHaveBeenCalledTimes(1);
    expect(await writeLegacyColumnsThrough(prisma, 'k1', { d1: {} })).toBe(0);
    resetWriteThrough();
  });
});
