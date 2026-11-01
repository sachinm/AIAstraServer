/** The one Radha limiter (docs/reading-engine/38 §4.1 flow C): parallel cap, retry on a throttle, no retry on a failure. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEngineExport, RadhaHttpError, radhaRetryDelayMs } from '../../src/lib/astroKundliClient.js';

vi.mock('../../src/lib/encrypt.js', () => ({ decrypt: vi.fn((x: string | null) => x) }));
vi.mock('../../src/config/env.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/config/env.js')>()),
  getAstroKundliBaseUrl: vi.fn(() => 'http://localhost:8765'),
  getAstroKundliTransport: vi.fn(() => 'http'),
}));

const params = { dob: '1996-12-07', tob: '10:34:00', place: 'Chennai,IN', ayanamsa: 'LAHIRI' };
const ok = { ok: true, status: 200, json: async () => ({ type: 'x', data: { ok: true } }) };
const saved = { key: process.env.ASTROKUNDLI_API_KEY, max: process.env.RADHA_MAX_CONCURRENT };

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  process.env.ASTROKUNDLI_API_KEY = 'test-key';
  delete process.env.RADHA_MAX_CONCURRENT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  restore('ASTROKUNDLI_API_KEY', saved.key);
  restore('RADHA_MAX_CONCURRENT', saved.max);
});

describe('radhaRetryDelayMs', () => {
  it('uses the wait Radha names, never shorter', () => {
    const err = new RadhaHttpError('rate_limit: Rate limit exceeded. Retry after about 0.5 seconds.', 429);
    const delay = radhaRetryDelayMs(err, 1)!;
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(600);
  });

  it('backs off 1 s then 2 s without a named wait, for 429, 503 and a Lambda throttle', () => {
    expect(radhaRetryDelayMs(new RadhaHttpError('busy', 429), 1)).toBeGreaterThanOrEqual(1000);
    expect(radhaRetryDelayMs(new RadhaHttpError('busy', 503), 2)).toBeGreaterThanOrEqual(2000);
    expect(radhaRetryDelayMs(Object.assign(new Error('slow down'), { name: 'TooManyRequestsException' }), 1)).toBeGreaterThanOrEqual(1000);
  });

  it('does not retry a real failure', () => {
    expect(radhaRetryDelayMs(new RadhaHttpError('Invalid export type: x', 400), 1)).toBeNull();
    expect(radhaRetryDelayMs(new RadhaHttpError('boom', 500), 1)).toBeNull();
    expect(radhaRetryDelayMs(new Error('network'), 1)).toBeNull();
  });
});

describe('Radha calls through the limiter', () => {
  it('retries a 429 and returns the answer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: 'rate_limit', detail: 'Rate limit exceeded. Retry after about 0.05 seconds.' }) })
      .mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchEngineExport(params, 'd1')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('gives up after three throttled attempts with the status on the error', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: 'rate_limit', detail: 'Retry after about 0.01 seconds.' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchEngineExport(params, 'd1')).rejects.toMatchObject({ name: 'RadhaHttpError', status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('does not retry a 400', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'validation_error', detail: 'Invalid export type: zz' }) }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchEngineExport(params, 'zz')).rejects.toThrow('Invalid export type');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('with the API key, runs in parallel but never above RADHA_MAX_CONCURRENT', async () => {
    process.env.RADHA_MAX_CONCURRENT = '2';
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 400));
      inFlight -= 1;
      return ok;
    }));
    await Promise.all(Array.from({ length: 5 }, () => fetchEngineExport(params, 'd1')));
    expect(peak).toBe(2);
  }, 15_000);

  it('without the API key, runs one call at a time', async () => {
    delete process.env.ASTROKUNDLI_API_KEY;
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 50));
      inFlight -= 1;
      return ok;
    }));
    await Promise.all(Array.from({ length: 3 }, () => fetchEngineExport(params, 'd1')));
    expect(peak).toBe(1);
  }, 15_000);
});
