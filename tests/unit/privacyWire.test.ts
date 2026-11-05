/**
 * docs/privacy/02 B0.2 / B0.3, server side: no response is cached, the SSE routes send `no-store`, and the birth place
 * is never sent to an outside geocoder.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_STORE, SSE_CACHE_CONTROL, noStoreMiddleware } from '../../src/lib/noStore.js';
import { resolveFallbackCoords } from '../../src/reading/chartData/store.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cache-Control', () => {
  it('the middleware sets no-store on every response and calls on', () => {
    const headers: Record<string, string> = {};
    const next = vi.fn();
    noStoreMiddleware({}, { setHeader: (n: string, v: string) => (headers[n] = v) }, next);
    expect(headers['Cache-Control']).toBe(NO_STORE);
    expect(next).toHaveBeenCalledOnce();
  });

  it('both SSE routes send no-store, and the middleware runs before every route', () => {
    expect(SSE_CACHE_CONTROL).toMatch(/^no-store\b/);
    const server = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    const clarify = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/clarifyRoutes.ts'), 'utf8');
    for (const src of [server, clarify]) {
      expect(src).not.toMatch(/no-cache/);
      expect(src).toMatch(/setHeader\('Cache-Control', SSE_CACHE_CONTROL\)/);
    }
    const mw = server.indexOf('app.use(noStoreMiddleware)');
    expect(mw).toBeGreaterThan(0);
    for (const route of ["app.post('/events'", 'app.use(yoga.graphqlEndpoint', "app.post('/api/chat/ask-stream'", 'registerClarifyRoutes(app']) {
      expect(server.indexOf(route), route).toBeGreaterThan(mw);
    }
  });
});

describe('no outside geocoder for the birth place', () => {
  it('an unknown place resolves to null without any network call (the engine answers "place not found")', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await resolveFallbackCoords('Zzyzxville,US')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('known places still resolve from the biodata or the built-in list', async () => {
    expect(await resolveFallbackCoords('Pune,IN')).toEqual({ lat: 18.52, lon: 73.86, tz: 5.5 });
    expect(await resolveFallbackCoords('x', { lat: 1, lon: 2, tz: 3 })).toEqual({ lat: 1, lon: 2, tz: 3 });
  });

  it('no server source calls Nominatim', () => {
    const store = fs.readFileSync(path.resolve(process.cwd(), 'src/reading/chartData/store.ts'), 'utf8');
    expect(store).not.toMatch(/nominatim\.openstreetmap/);
  });
});
