import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHARTS_PAGE_COLUMNS, hasLegacyShape, readChartColumns } from '../../../src/reading/chartData/chartsPageReader.js';
import type { ChartDataRepo, StoredRow } from '../../../src/reading/chartData/store.js';

function row(dataType: string, over: Partial<StoredRow> = {}): StoredRow {
  return { dataType, variant: '', params: {}, calcVersion: 'legacy', payload: { from: 'row', dataType }, status: 'ready', error: null, fetchStartedAt: null, fetchedAt: new Date(), validTo: null, ...over };
}

function repoWith(rows: StoredRow[] | Error): ChartDataRepo {
  return {
    async readRows(_id: string, keys: { dataType: string; variant: string }[]) {
      if (rows instanceof Error) throw rows;
      return rows.filter((r) => keys.some((k) => k.dataType === r.dataType && k.variant === r.variant));
    },
  } as unknown as ChartDataRepo;
}

const legacy = Object.fromEntries(CHARTS_PAGE_COLUMNS.map((c) => [c, { from: 'legacy', c }]));

afterEach(() => {
  delete process.env.KUNDLI_DATA_READ;
});

describe('readChartColumns', () => {
  it('prefers a ready kundli_data row over the legacy column', async () => {
    const out = await readChartColumns(repoWith([row('varga.d1'), row('panchanga.birth')]), 'k1', ['d1', 'biodata', 'd2'], legacy);
    expect(out.d1).toEqual({ from: 'row', dataType: 'varga.d1' });
    expect(out.biodata).toEqual({ from: 'row', dataType: 'panchanga.birth' });
    expect(out.d2).toEqual({ from: 'legacy', c: 'd2' }); // no row: legacy column
  });

  it('maps every Charts page column to its dotted type', async () => {
    const rows = ['panchanga.birth', 'varga.d1', 'varga.d2', 'varga.d4', 'varga.d7', 'varga.d9', 'varga.d10', 'karaka.chara', 'dasha.vimsottari', 'dasha.narayana'].map((id) => row(id));
    const out = await readChartColumns(repoWith(rows), 'k1', CHARTS_PAGE_COLUMNS, {});
    expect(Object.values(out).every((v) => (v as { from?: string })?.from === 'row')).toBe(true);
  });

  it('falls back to the legacy column for failed, fetching, unsupported or empty rows', async () => {
    const rows = [row('varga.d1', { status: 'failed' }), row('varga.d2', { status: 'fetching' }), row('varga.d4', { status: 'unsupported' }), row('varga.d7', { payload: null })];
    const out = await readChartColumns(repoWith(rows), 'k1', ['d1', 'd2', 'd4', 'd7'], legacy);
    for (const c of ['d1', 'd2', 'd4', 'd7'] as const) expect(out[c]).toEqual({ from: 'legacy', c });
  });

  it('uses a backwards-compatible varga row after its calc_version moves on, but not a re-shaped dasha row', async () => {
    const rows = [row('varga.d9', { calcVersion: '1' }), row('dasha.vimsottari', { calcVersion: '2' }), row('dasha.narayana', { calcVersion: 'legacy' })];
    const out = await readChartColumns(repoWith(rows), 'k1', ['d9', 'vimsottari_dasa', 'narayana_dasa'], legacy);
    expect(out.d9).toEqual({ from: 'row', dataType: 'varga.d9' });
    expect(out.vimsottari_dasa).toEqual({ from: 'legacy', c: 'vimsottari_dasa' });
    expect(out.narayana_dasa).toEqual({ from: 'row', dataType: 'dasha.narayana' });
  });

  it('returns null when neither the row nor the legacy column has data', async () => {
    const out = await readChartColumns(repoWith([]), 'k1', ['d1'], { d1: undefined });
    expect(out.d1).toBeNull();
  });

  it('degrades to legacy values when the M7 tables are missing (silently) or the read fails (logged)', async () => {
    const missing = Object.assign(new Error('relation "kundli_data" does not exist'), { code: 'P2021' });
    const warn = vi.fn();
    expect((await readChartColumns(repoWith(missing), 'k1', ['d1'], legacy, { log: { warn } })).d1).toEqual({ from: 'legacy', c: 'd1' });
    expect(warn).not.toHaveBeenCalled();
    expect((await readChartColumns(repoWith(new Error('boom')), 'k1', ['d1'], legacy, { log: { warn } })).d1).toEqual({ from: 'legacy', c: 'd1' });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('KUNDLI_DATA_READ=0 skips the vertical table', async () => {
    process.env.KUNDLI_DATA_READ = '0';
    const out = await readChartColumns(repoWith([row('varga.d1')]), 'k1', ['d1'], legacy);
    expect(out.d1).toEqual({ from: 'legacy', c: 'd1' });
  });
});

describe('hasLegacyShape', () => {
  it('accepts legacy, null and compatible families only', () => {
    expect(hasLegacyShape({ calcVersion: 'legacy' }, { family: 'dasha' })).toBe(true);
    expect(hasLegacyShape({ calcVersion: null }, { family: 'dasha' })).toBe(true);
    expect(hasLegacyShape({ calcVersion: '2' }, { family: 'dasha' })).toBe(false);
    expect(hasLegacyShape({ calcVersion: '3' }, { family: 'varga' })).toBe(true);
  });
});
