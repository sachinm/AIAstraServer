import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEngineExport, fetchHoroscopeChart, fetchRadhaCatalog } from '../../src/lib/astroKundliClient.js';
import { ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS } from '../../src/config/env.js';

vi.mock('../../src/lib/encrypt.js', () => ({
  decrypt: vi.fn((x: string | null) => x),
}));

vi.mock('../../src/config/env.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/config/env.js')>()),
  getAstroKundliBaseUrl: vi.fn(() => 'http://localhost:8765'),
  getAstroKundliTransport: vi.fn(() => 'http'),
}));

const params = { dob: '1996-12-07', tob: '10:34:00', place: 'Chennai,IN', ayanamsa: 'LAHIRI' };
const coords = { lat: 13.08, lon: 80.27, tz: 5.5 };

/** Records the start time and JSON body of every export POST. */
function stubExportFetch(response: unknown = { type: 'x', data: { ok: true } }) {
  const starts: number[] = [];
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      starts.push(Date.now());
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      return { ok: true, status: 200, json: async () => response };
    })
  );
  return { starts, bodies };
}

describe('export spacing (one export start per spacing interval)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the start spacing for engine exports without coordinates', async () => {
    const { starts } = stubExportFetch();
    await fetchEngineExport(params, 'facts');
    await fetchEngineExport(params, 'facts');
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS - 10);
  }, 10_000);

  it('keeps the start spacing for engine exports that send lat/lon/tz', async () => {
    const { starts, bodies } = stubExportFetch();
    await fetchEngineExport(params, 'facts', coords);
    await fetchEngineExport(params, 'facts', coords);
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS - 10);
    expect(bodies[0]).toMatchObject({ type: 'facts', ...coords });
  }, 10_000);

  it('keeps the start spacing for chart exports (fetchHoroscopeChart) that have stored coordinates', async () => {
    const { starts, bodies } = stubExportFetch();
    await fetchHoroscopeChart(params, 'd1', coords);
    await fetchHoroscopeChart(params, 'd9', coords);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS - 10);
    expect(bodies[1]).toMatchObject({ type: 'd9', ...coords });
  }, 10_000);

  it('keeps the spacing for chart exports with partial coordinates', async () => {
    const { starts } = stubExportFetch();
    await fetchHoroscopeChart(params, 'd1', { lat: 13.08, lon: null, tz: 5.5 });
    await fetchHoroscopeChart(params, 'd9', null);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS - 10);
  }, 10_000);

  it('fetchRadhaCatalog sends type catalog with no birth fields and returns the catalog', async () => {
    const catalog = { engine_commit: 'deadbee', types: [{ type: 'd1', calc_version: 'v2', params: {} }] };
    const { bodies } = stubExportFetch(catalog);
    const result = await fetchRadhaCatalog();
    expect(bodies[0]).toEqual({ type: 'catalog' });
    expect(bodies[0]).not.toHaveProperty('dob');
    expect(bodies[0]).not.toHaveProperty('tob');
    expect(bodies[0]).not.toHaveProperty('place');
    expect(result.engine_commit).toBe('deadbee');
    expect(result.types).toEqual(catalog.types);
  }, 10_000);
});
