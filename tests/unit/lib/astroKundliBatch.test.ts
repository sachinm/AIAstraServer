import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchFullKundliBatch,
  KUNDLI_JSON_FIELDS,
  RadhaHttpError,
  type AstroKundliRequestParams,
} from '../../../src/lib/astroKundliClient.js';
import { isJsonFieldFilled } from '../../../src/services/kundliQueueService.js';

// 1. Mock encryption helper
vi.mock('../../../src/lib/encrypt.js', () => ({
  decrypt: vi.fn((x: string | null) => (x && x.startsWith('enc:') ? 'decrypted' : x)),
}));

// 2. Mock environment helper with strict isolation
vi.mock('../../../src/config/env.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/config/env.js')>()),
  // Force HTTP transport so tests never attempt AWS Lambda calls
  getAstroKundliTransport: vi.fn(() => 'http'),
  // Provide deterministic base URL avoiding "ASTROKUNDLI_BASE_URL_DEV must be set"
  getAstroKundliBaseUrl: vi.fn(() => 'http://localhost:8765'),
  // Unset API key to enforce radhaLimits().maxConcurrent === 1 (stress-testing slot re-entrancy)
  getAstroKundliApiKey: vi.fn(() => undefined),
  // Set spacing to 0 to eliminate sleep delays during sequential fallback tests
  getAstroKundliRequestSpacingMs: vi.fn(() => 0),
}));

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
    d1: { chart: 'd1', houses: [{ house: 1, sign: 'Aries' }] },
    d2: { chart: 'd2', houses: [] },
    d4: { chart: 'd4', houses: [] },
    d7: { chart: 'd7', houses: [] },
    d9: { chart: 'd9', houses: [] },
    d10: { chart: 'd10', houses: [] },
    charakaraka: [{ karaka_code: 'AK', planet: 'Sun' }],
    vimsottari_dasa: { periods: [{ lord: 'Ketu', start: '1990-01-15' }] },
    narayana_dasa: { periods: [{ sign: 'Aries', start: '1990-01-15' }] },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // TEST 1: Happy-path batched calculation returning 10 charts
  it('fetches all 10 legacy Kundli charts in a single batched calculation call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        calc_versions: {
          biodata: 'v1', d1: 'v1', d2: 'v1', d4: 'v1', d7: 'v1',
          d9: 'v1', d10: 'v1', charakaraka: 'v1', vimsottari_dasa: 'v2', narayana_dasa: 'v3',
        },
        charts: sampleCharts,
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFullKundliBatch(mockParams, { lat: 28.61, lon: 77.21, tz: 5.5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8765/api/calculate-full-kundli');
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

  // TEST 2: 404 fallback without deadlock when maxConcurrent = 1 and ASTROKUNDLI_API_KEY is undefined
  it('gracefully falls back to sequential calls if the batched endpoint returns 404 without deadlock when maxConcurrent = 1', async () => {
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

    // Timeout guard: 5000ms ensures any re-entrancy deadlock fails fast
    const result = await fetchFullKundliBatch(mockParams, { lat: 28.61, lon: 77.21, tz: 5.5 });

    // Initial batch attempt (404) followed by 10 individual chart calls
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(callCount).toBe(11);

    for (const field of KUNDLI_JSON_FIELDS) {
      expect(result[field]).toBeDefined();
      expect(result[field]).toEqual(sampleCharts[field]);
    }
  }, 5000);

  // TEST 3: 501 fallback without deadlock
  it('gracefully falls back to sequential calls if the batched endpoint returns 501 without deadlock', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/api/calculate-full-kundli')) {
        return {
          ok: false,
          status: 501,
          json: async () => ({ detail: 'Not Implemented' }),
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
    expect(fetchMock).toHaveBeenCalledTimes(11);
    for (const field of KUNDLI_JSON_FIELDS) {
      expect(result[field]).toBeDefined();
      expect(result[field]).toEqual(sampleCharts[field]);
    }
  }, 5000);

  // TEST 4: Subfield error filtering (verifying { error: "..." } is NOT returned)
  it('filters out subfield error payloads so they are not assigned to result', async () => {
    const partialErrorCharts: Record<string, unknown> = {
      ...sampleCharts,
      d1: { error: 'Division by zero in bhava calculation' },
      narayana_dasa: { error: 'Ayanamsa not supported for Narayana Dasa' },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        calc_versions: { biodata: 'v1', d2: 'v1' },
        charts: partialErrorCharts,
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchFullKundliBatch(mockParams);

    // Only 1 call made (no fallback triggered for 200 OK)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Valid charts must be present
    expect(result.biodata).toEqual(sampleCharts.biodata);
    expect(result.d2).toEqual(sampleCharts.d2);
    expect(result.charakaraka).toEqual(sampleCharts.charakaraka);

    // Erroneous subfields must NOT be returned in result (must be undefined)
    expect(result.d1).toBeUndefined();
    expect(result.narayana_dasa).toBeUndefined();

    // Verify integration with kundliQueueService's isJsonFieldFilled helper
    expect(isJsonFieldFilled(result.d1)).toBe(false);
    expect(isJsonFieldFilled(result.narayana_dasa)).toBe(false);
    expect(isJsonFieldFilled(result.d2)).toBe(true);
  });

  // TEST 5: Fallback when charts map is missing or invalid
  it('falls back to sequential calls if charts object is missing or null in 200 response', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes('/api/calculate-full-kundli')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', charts: null }),
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
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(result.biodata).toBeDefined();
  }, 5000);

  // TEST 6: 500 error rejection
  it('throws RadhaHttpError immediately on HTTP 500 without falling back', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error', detail: 'Database error' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchFullKundliBatch(mockParams)).rejects.toThrow(RadhaHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
