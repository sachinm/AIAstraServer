import { describe, expect, it, vi } from 'vitest';
import type { ChartDataRepo, KundliRequest } from '../../../src/reading/chartData/store.js';
import { fetchTransit, transitAt } from '../../../src/reading/chartData/transit.js';

const BIRTH: KundliRequest = {
  params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi, IN' },
  coords: { lat: 28.6, lon: 77.2, tz: 5.5 },
};

/** A repo that only knows birth data; the store methods throw so any write would fail the test. */
function birthRepo(req: KundliRequest | null = BIRTH) {
  const kundliRequest = vi.fn(async (_id: string) => req);
  const repo = {
    kundliRequest,
    claim: vi.fn(async () => {
      throw new Error('transit must not be stored');
    }),
    complete: vi.fn(async () => {
      throw new Error('transit must not be stored');
    }),
  } satisfies Partial<ChartDataRepo>;
  return repo;
}

function fakeFetcher(payload: unknown = { planets: [] }) {
  return vi.fn(async (_req: KundliRequest, _type: string, _extra: Record<string, unknown>) => payload);
}

describe('fetchTransit', () => {
  it('asks Radha for a past moment in D1 at the birth place and returns the payload unstored', async () => {
    const repo = birthRepo();
    const fetcher = fakeFetcher({ at: '2001-09-11 08:46:00', planets: [{ name: 'Sun' }] });
    const out = await fetchTransit('k1', { at: '2001-09-11 08:46:00' }, { repo, fetcher });
    expect(out).toEqual({ at: '2001-09-11 08:46:00', planets: [{ name: 'Sun' }] });
    expect(repo.kundliRequest).toHaveBeenCalledWith('k1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [req, type, extra] = fetcher.mock.calls[0]!;
    expect(req).toBe(BIRTH);
    expect(type).toBe('transit');
    expect(extra).toEqual({ lat: 28.6, lon: 77.2, tz: 5.5, at: '2001-09-11 08:46:00', divisional_chart_factor: 1 });
    expect(repo.claim).not.toHaveBeenCalled();
    expect(repo.complete).not.toHaveBeenCalled();
  });

  it('sends a future Date as ISO 8601 UTC and a D9 transit', async () => {
    const fetcher = fakeFetcher();
    await fetchTransit('k1', { at: new Date('2031-04-15T06:30:00Z'), divisionalChartFactor: 9 }, { repo: birthRepo(), fetcher });
    expect(fetcher.mock.calls[0]![2]).toMatchObject({ at: '2031-04-15T06:30:00.000Z', divisional_chart_factor: 9 });
    expect(fetcher.mock.calls[0]![2]).not.toHaveProperty('natal_dob');
  });

  it('withNatal adds the kundli birth data as natal_* fields', async () => {
    const fetcher = fakeFetcher();
    await fetchTransit('k1', { at: '2027-03-01T12:00:00+05:30', divisionalChartFactor: 9, withNatal: true }, { repo: birthRepo(), fetcher });
    expect(fetcher.mock.calls[0]![2]).toEqual({
      lat: 28.6,
      lon: 77.2,
      tz: 5.5,
      at: '2027-03-01T12:00:00+05:30',
      divisional_chart_factor: 9,
      natal_dob: '1990-01-01',
      natal_tob: '10:00:00',
      natal_place: 'Delhi, IN',
      natal_lat: 28.6,
      natal_lon: 77.2,
      natal_tz: 5.5,
    });
  });

  it('withNatal without stored coordinates sends the natal place only', async () => {
    const fetcher = fakeFetcher();
    const repo = birthRepo({ ...BIRTH, coords: null });
    await fetchTransit('k1', { at: '2027-03-01 12:00:00', withNatal: true }, { repo, fetcher });
    expect(fetcher.mock.calls[0]![2]).toEqual({ at: '2027-03-01 12:00:00', divisional_chart_factor: 1, natal_dob: '1990-01-01', natal_tob: '10:00:00', natal_place: 'Delhi, IN' });
  });

  it('every call goes to Radha (nothing cached or stored)', async () => {
    const fetcher = fakeFetcher();
    const repo = birthRepo();
    await fetchTransit('k1', { at: '2027-03-01 12:00:00' }, { repo, fetcher });
    await fetchTransit('k1', { at: '2027-03-01 12:00:00' }, { repo, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects a bad moment, an unknown divisional chart or a missing kundli without calling Radha', async () => {
    const fetcher = fakeFetcher();
    await expect(fetchTransit('k1', { at: 'next tuesday' }, { repo: birthRepo(), fetcher })).rejects.toThrow(/at must be/);
    await expect(fetchTransit('k1', { at: new Date('nope') }, { repo: birthRepo(), fetcher })).rejects.toThrow(/not a valid date/);
    await expect(fetchTransit('k1', { at: '2027-03-01 12:00:00', divisionalChartFactor: 13 }, { repo: birthRepo(), fetcher })).rejects.toThrow(/divisionalChartFactor must be one of/);
    await expect(fetchTransit('k1', { at: '2027-03-01 12:00:00' }, { repo: birthRepo(null), fetcher })).rejects.toThrow(/not found/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes Radha errors through', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('Invalid params: at year must be between 1800 and 2300, got 2400');
    });
    await expect(fetchTransit('k1', { at: '2400-01-01 00:00:00' }, { repo: birthRepo(), fetcher })).rejects.toThrow(/Invalid params/);
  });
});

describe('transitAt', () => {
  it("accepts Radha's local and ISO forms", () => {
    expect(transitAt(' 2027-03-01 12:00:00 ')).toBe('2027-03-01 12:00:00');
    expect(transitAt('2027-03-01T12:00Z')).toBe('2027-03-01T12:00Z');
    expect(transitAt('1950-06-30T23:59:59.5-0400')).toBe('1950-06-30T23:59:59.5-0400');
  });
});

describe('fetchTransit default fetcher', () => {
  it('goes through the shared throttled export client', async () => {
    vi.resetModules();
    const fetchEngineExport = vi.fn(async () => ({ ok: true }));
    vi.doMock('../../../src/lib/astroKundliClient.js', () => ({ fetchEngineExport }));
    const { fetchTransit: fresh } = await import('../../../src/reading/chartData/transit.js');
    const out = await fresh('k1', { at: '2027-03-01 12:00:00', divisionalChartFactor: 9 }, { repo: birthRepo() });
    expect(out).toEqual({ ok: true });
    expect(fetchEngineExport).toHaveBeenCalledWith(BIRTH.params, 'transit', { lat: 28.6, lon: 77.2, tz: 5.5, at: '2027-03-01 12:00:00', divisional_chart_factor: 9 });
    vi.doUnmock('../../../src/lib/astroKundliClient.js');
  });
});
