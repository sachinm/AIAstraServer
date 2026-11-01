import { beforeEach, describe, expect, it } from 'vitest';
import { clearChartBundles, CORE_TYPES, loadChartBundle, type ChartRow, type ChartRowSource } from '../../../../src/reading/oracle/chartBundle.js';
import { aspectLists, clipPeriods, frameHouses, presentOnly, renderCore, sectionName, tidy } from '../../../../src/reading/oracle/slices.js';

function source(rows: ChartRow[]): ChartRowSource & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    read: async (_k, types) => {
      calls.push(types);
      return rows.filter((r) => types.includes(r.data_type));
    },
  };
}

const row = (data_type: string, payload: unknown, variant = ''): ChartRow => ({ data_type, variant, payload });

describe('loadChartBundle', () => {
  beforeEach(() => clearChartBundles());

  it('reads only the planned types, in one query', async () => {
    const s = source([row('varga.d1', [{ body: 'Sun' }]), row('dasha.chara', { periods: [] })]);
    const b = await loadChartBundle(s, 'k1', ['varga.d1', 'yogas'], '2026-11-01');
    expect(s.calls).toEqual([['varga.d1', 'yogas']]);
    expect(Object.keys(b.tables)).toEqual(['varga.d1']);
    expect(b.missing).toEqual(['yogas']);
  });

  it('makes no query for types already loaded, which is what prewarm during clarify buys', async () => {
    const s = source([row('varga.d1', [{ body: 'Sun' }]), row('yogas', { yogas: [] })]);
    await loadChartBundle(s, 'k1', ['varga.d1'], '2026-11-01');
    const b = await loadChartBundle(s, 'k1', ['varga.d1'], '2026-11-01');
    expect(s.calls).toHaveLength(1);
    expect(b.fromCache).toBe(1);
    await loadChartBundle(s, 'k1', ['varga.d1', 'yogas'], '2026-11-01');
    expect(s.calls[1]).toEqual(['yogas']);
  });

  it('concurrent loads share one query', async () => {
    const s = source([row('varga.d1', [])]);
    await Promise.all([loadChartBundle(s, 'k1', ['varga.d1'], '2026-11-01'), loadChartBundle(s, 'k1', ['varga.d1'], '2026-11-01')]);
    expect(s.calls).toHaveLength(1);
  });

  it('a failed read reports missing and does not throw', async () => {
    const s: ChartRowSource = { read: async () => { throw new Error('db down'); } };
    const b = await loadChartBundle(s, 'k1', ['varga.d1'], '2026-11-01');
    expect(b.missing).toEqual(['varga.d1']);
  });

  it('picks the annual row whose stored dates hold the day, preferring the default dasha system', async () => {
    const y26 = row('annual.tithi_pravesha_dasha', { valid_from: '2026-02-01', valid_to: '2027-02-01', tag: 'mudda' }, 'year=2026;system=mudda');
    const y26b = row('annual.tithi_pravesha_dasha', { valid_from: '2026-02-01', valid_to: '2027-02-01', tag: 'tithi' }, 'year=2026;system=tithi_ashtottari');
    const y25 = row('annual.tithi_pravesha_dasha', { valid_from: '2025-02-01', valid_to: '2026-02-01', tag: 'old' }, 'year=2025;system=tithi_ashtottari');
    const b = await loadChartBundle(source([y25, y26, y26b]), 'k1', ['annual.tithi_pravesha_dasha'], '2026-11-01');
    expect((b.tables['annual.tithi_pravesha_dasha'] as { tag: string }).tag).toBe('tithi');
  });

  it('the core list is what every reader caches', () => {
    expect(CORE_TYPES).toContain('varga.d1');
    expect(CORE_TYPES).toContain('dignities');
  });
});

describe('slices select and never compute', () => {
  it('names rows and drops housekeeping fields, keeping each value as stored', () => {
    const out = tidy({ planets: [{ id: 6, name: 'Saturn', dignity: 'Exalted', sign_index: 6, house_from_lagna: 7 }], notes: { x: 1 } }) as any;
    expect(out).toEqual({ planets: { Saturn: { dignity: 'Exalted', house_from_lagna: 7 } } });
  });

  it('leaves rows without a unique name as an array', () => {
    expect(tidy([{ name: 'a' }, { name: 'a' }])).toEqual([{ name: 'a' }, { name: 'a' }]);
  });

  it('clips dasha rows by date, with the dates untouched', () => {
    const p = {
      system: 'vimsottari',
      periods: [
        { lord: 'Ju', start: '2000-01-01', end: '2016-01-01', children: [] },
        {
          lord: 'Sa',
          start: '2016-01-01',
          end: '2035-01-01',
          start_jd: 1,
          children: [
            { lord: 'Me', start: '2024-01-01', end: '2026-06-01' },
            { lord: 'Ke', start: '2026-06-01', end: '2027-07-01' },
            { lord: 'Ve', start: '2027-07-01', end: '2030-01-01' },
          ],
        },
      ],
    };
    const out = clipPeriods(p, '2026-11-01', '2027-03-01') as any;
    expect(Object.keys(out.periods)).toEqual(['Sa_2016-01-01']);
    expect(Object.keys(out.periods['Sa_2016-01-01'].children)).toEqual(['Ke_2026-06-01']);
    expect(out.periods['Sa_2016-01-01'].children['Ke_2026-06-01'].end).toBe('2027-07-01');
    expect(out.periods['Sa_2016-01-01'].start_jd).toBeUndefined();
  });

  it('keeps only yogas the engine marks present', () => {
    const out = presentOnly({ present: 1, yogas: [{ id: 'a', present: true }, { id: 'b', present: false }] }, 'yogas') as any;
    expect(Object.keys(out.yogas)).toEqual(['a']);
  });

  it('keeps only frame houses', () => {
    const out = frameHouses({ houses: [{ house: 1, sign: 'x' }, { house: 7, sign: 'y' }] }, [7]) as any;
    expect(Object.keys(out.houses)).toEqual(['7']);
  });

  it('drops the aspect strength matrix', () => {
    const out = aspectLists({ aspect_strength: { rows: [] }, rasi_drishti: [{ name: 'Sa', aspected_houses: [1] }], graha_drishti: [] }) as any;
    expect(out.aspect_strength).toBeUndefined();
    expect(out.rasi_drishti.Sa.aspected_houses).toEqual([1]);
  });

  it('the core is byte-stable and uses underscored section names', () => {
    const tables = { 'varga.d1': [{ body: 'Sun', rasi: 'Leo' }], dignities: { planets: [{ name: 'Sun', dignity: 'Own' }] } };
    const a = renderCore(tables, ['varga.d1', 'dignities']);
    const b = renderCore(tables, ['varga.d1', 'dignities']);
    expect(a.text).toBe(b.text);
    expect(a.sections.varga_d1).toEqual({ Sun: { rasi: 'Leo' } });
    expect(sectionName('dasha.vimsottari')).toBe('dasha_vimsottari');
  });
});
