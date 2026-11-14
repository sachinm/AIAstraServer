import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFullKundliBatch, KUNDLI_JSON_FIELDS, type AstroKundliRequestParams } from '../../../src/lib/astroKundliClient.js';

describe('fetchFullKundliBatch', () => {
  const originalFetch = globalThis.fetch;
  const mockParams: AstroKundliRequestParams = {
    dob: '1990-01-15',
    tob: '14:30:00',
    place: 'New_Delhi,IN',
    ayanamsa: 'LAHIRI',
  };

  const sampleCharts: Record<string, unknown> = {
    biodata: { date: '1990-01-15', time: '14:30:00', place: 'New Delhi, India' },
    d1: { chart: 'd1', houses: [] },
    d2: { chart: 'd2', houses: [] },
    d4: { chart: 'd4', houses: [] },
    d7: { chart: 'd7', houses: [] },
    d9: { chart: 'd9', houses: [] },
    d10: { chart: 'd10', houses: [] },
    charakaraka: [{ karaka_code: 'AK', planet: 'Sun' }],
    vimsottari_dasa: { periods: [] },
    narayana_dasa: { periods: [] },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches all 10 legacy Kundli charts in a single batched calculation call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        calc_versions: {
          biodata: 'v1',
          d1: 'v1',
          d2: 'v1',
          d4: 'v1',
          d7: 'v1',
          d9: 'v1',
          d10: 'v1',
          charakaraka: 'v1',
          vimsottari_dasa: 'v2',
          narayana_dasa: 'v3',
        },
        charts: sampleCharts,
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFullKundliBatch(mockParams, { lat: 28.61, lon: 77.21, tz: 5.5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/calculate-full-kundli');
    expect(options.method).toBe('POST');

    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.dob).toBe('1990-01-15');
    expect(parsedBody.tob).toBe('14:30:00');
    expect(parsedBody.place).toBe('New_Delhi,IN');
    expect(parsedBody.lat).toBe(28.61);
    expect(parsedBody.lon).toBe(77.21);
    expect(parsedBody.tz).toBe(5.5);
    expect(parsedBody.fields).toEqual(expect.arrayContaining([...KUNDLI_JSON_FIELDS]));

    for (const field of KUNDLI_JSON_FIELDS) {
      expect(result[field]).toEqual(sampleCharts[field]);
    }
  });

  it('gracefully falls back to sequential calls if the batched endpoint returns 404', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      callCount += 1;
      if (url.includes('/api/calculate-full-kundli')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: 'Not Found' }),
        };
      }
      const parsedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: parsedBody.type,
          data: sampleCharts[parsedBody.type] ?? {},
        }),
      };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFullKundliBatch(mockParams);

    // Initial batch attempt (404) followed by 10 individual chart calls
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(callCount).toBe(11);

    for (const field of KUNDLI_JSON_FIELDS) {
      expect(result[field]).toBeDefined();
    }
  });
});
