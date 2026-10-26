import { describe, expect, it, vi } from 'vitest';
import { asRangePayload, fetchTransitRange, transitRangeParams } from '../../../src/reading/chartData/transitRange.js';
import { ensureChartData, movingTypeError } from '../../../src/reading/chartData/store.js';
import { CHART_TYPE_BY_ID } from '../../../src/reading/chartData/catalog.js';

const PAYLOAD = {
  from: '2008-10-01',
  to: '2044-10-01',
  planets: ['Sa', 'Ju', 'Ra', 'Ke'],
  natal: { lagna_sign: 'Virgo', lagna_sign_index: 5, moon_sign: 'Libra', moon_sign_index: 6 },
  ingresses: [{ planet: 'Sa', planet_name: 'Saturn', sign: 'Virgo', sign_index: 5, from: '2009-09-09', to: '2011-11-15', retro_on_entry: false, house_from_lagna: 1, house_from_moon: 12 }],
  stations: [{ planet: 'Sa', planet_name: 'Saturn', kind: 'retrograde', date: '2008-12-31', longitude: 147.78, sign: 'Leo', sign_index: 4, house_from_lagna: 12, house_from_moon: 11 }],
  lunations: [{ kind: 'new', date: '2008-10-29', sign: 'Libra', sign_index: 6, degree: 11.93, nakshatra: 'Swati', pada: 2, house_from_lagna: 2, house_from_moon: 1 }],
  eclipses: [{ kind: 'solar', type: 'annular', date: '2009-01-26', sign: 'Capricorn', sign_index: 9, degree: 12.52, nakshatra: 'Shravana', house_from_lagna: 5, house_from_moon: 4 }],
  sade_sati: [{ phase: 'rising', saturn_sign: 'Virgo', from: '2009-09-09', to: '2011-11-15' }],
  dhaiya: [],
};

describe('transit_range catalogue entry', () => {
  it('is a moving, unserved, on-demand type that is never stored per person', async () => {
    expect(CHART_TYPE_BY_ID.get('transit_range')).toMatchObject({ radhaType: 'transit_range', family: 'transit', changeClass: 'moving', tier: 'on_demand', served: false, calcVersion: null });
    expect(movingTypeError('transit_range')).toMatch(/fetchTransitRange/);
    const repo = { kundliRequest: async () => null } as never;
    const out = await ensureChartData({ repo, fetcher: vi.fn() as never }, 'k1', ['transit_range']);
    expect(out['transit_range']?.status).not.toBe('ready');
  });
});

describe('transitRangeParams', () => {
  it('passes only the options given', () => {
    expect(transitRangeParams({ from: '2008-10-01', to: '2044-10-01' })).toEqual({ from: '2008-10-01', to: '2044-10-01' });
    expect(transitRangeParams({ from: '2008-10-01', to: '2012-10-01', planets: ['Sa'], eclipses: false })).toEqual({ from: '2008-10-01', to: '2012-10-01', planets: ['Sa'], eclipses: false });
  });
  it('rejects a reversed range and a span over the limit', () => {
    expect(() => transitRangeParams({ from: '2027-02-01', to: '2027-01-01' })).toThrow(/from <= to/);
    expect(() => transitRangeParams({ from: '1990-01-01', to: '2040-01-01' })).toThrow(/limit/);
  });
});

describe('fetchTransitRange', () => {
  const req = { params: { dob: '2002-04-27', tob: '17:05:00', place: 'Delhi,IN' }, coords: { lat: 28.9167, lon: 77.0167, tz: 5.5 } };

  it('sends one Radha call with the options under params and the stored coordinates', async () => {
    const fetcher = vi.fn(async () => PAYLOAD);
    const out = await fetchTransitRange('k1', { from: '2008-10-01', to: '2044-10-01' }, { repo: { kundliRequest: async () => req }, fetcher });
    expect(out).toBe(PAYLOAD);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(req, 'transit_range', { lat: 28.9167, lon: 77.0167, tz: 5.5, params: { from: '2008-10-01', to: '2044-10-01' } });
  });
  it('refuses a payload that is not a range, and an unknown kundli', async () => {
    const repo = { kundliRequest: async () => req };
    await expect(fetchTransitRange('k1', { from: '2027-01-01', to: '2027-02-01' }, { repo, fetcher: vi.fn(async () => ({ nope: true })) })).rejects.toThrow(/not a transit_range payload/);
    await expect(fetchTransitRange('k1', { from: '2027-01-01', to: '2027-02-01' }, { repo: { kundliRequest: async () => null }, fetcher: vi.fn() })).rejects.toThrow(/not found/);
    expect(asRangePayload(PAYLOAD)).toBe(PAYLOAD);
    expect(asRangePayload({ ...PAYLOAD, stations: [{ planet: 'Sa' }] })).toBeNull();
  });
});
