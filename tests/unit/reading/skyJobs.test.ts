import { describe, expect, it, vi } from 'vitest';
import { extendSharedSky, pullKundliOverlay, yearChunks } from '../../../src/reading/transits/skyJobs.js';
import type { CachedRow, EphemerisRepo } from '../../../src/reading/transits/ephemerisCache.js';
import { sourceHash } from '../../../src/reading/transits/ephemerisCache.js';
import type { TransitRangePayload } from '../../../src/reading/chartData/transitRange.js';

const SAN_JOSE = { lat: 37.341, lon: -121.894, tz: -8 };
const payload = { from: 'x', to: 'y', planets: [], natal: null, ingresses: [], stations: [], lunations: [], eclipses: [], sade_sati: [], dhaiya: [] } as unknown as TransitRangePayload;

function memRepo(): EphemerisRepo {
  const ranges = new Map<string, CachedRow<TransitRangePayload>>();
  const overlays = new Map<string, CachedRow<unknown>>();
  const row = <T>(p: T): CachedRow<T> => ({ payload: p, calcVersion: null, sourceHash: sourceHash(p), fetchedAt: new Date(0) });
  return {
    async getSnapshot() {
      return null;
    },
    async putSnapshot() {},
    async getRange(k) {
      return ranges.get(Object.values(k).join('|')) ?? null;
    },
    async putRange(k, _p, r) {
      ranges.set(Object.values(k).join('|'), row(r.payload));
    },
    async getOverlay(k) {
      return overlays.get(Object.values(k).join('|')) ?? null;
    },
    async putOverlay(k, r) {
      overlays.set(Object.values(k).join('|'), row(r.payload));
    },
  };
}

describe('yearChunks', () => {
  it('covers whole calendar years from the years of from and to', () => {
    expect(yearChunks('2026-11-04', '2028-02-01')).toEqual([
      { from: '2026-01-01', to: '2026-12-31' },
      { from: '2027-01-01', to: '2027-12-31' },
      { from: '2028-01-01', to: '2028-12-31' },
    ]);
  });
  it('refuses a reversed or enormous span', () => {
    expect(() => yearChunks('2028-01-01', '2026-01-01')).toThrow();
    expect(() => yearChunks('1900-01-01', '2030-01-01')).toThrow();
  });
});

describe('extendSharedSky', () => {
  it('dry run reads the cache and never calls the engine', async () => {
    const fetchRange = vi.fn(async () => payload);
    const r = await extendSharedSky(SAN_JOSE, { from: '2027-01-01', to: '2028-12-31', step: 'day', dryRun: true }, { repo: memRepo(), fetchRange });
    expect(fetchRange).not.toHaveBeenCalled();
    expect(r.chunks.map((c) => c.state)).toEqual(['missing', 'missing']);
  });

  it('fetches each missing year once and serves the repeat from the cache', async () => {
    const repo = memRepo();
    const fetchRange = vi.fn(async () => payload);
    const first = await extendSharedSky(SAN_JOSE, { from: '2027-01-01', to: '2028-12-31', step: 'day' }, { repo, fetchRange });
    const second = await extendSharedSky(SAN_JOSE, { from: '2027-01-01', to: '2028-12-31', step: 'day' }, { repo, fetchRange });
    expect(first.engineCalls).toBe(2);
    expect(second.engineCalls).toBe(0);
    expect(second.chunks.map((c) => c.state)).toEqual(['cached', 'cached']);
    expect(fetchRange).toHaveBeenCalledTimes(2);
  });

  it('one failed year does not stop the others', async () => {
    const fetchRange = vi.fn().mockRejectedValueOnce(new Error('engine down')).mockResolvedValue(payload);
    const r = await extendSharedSky(SAN_JOSE, { from: '2027-01-01', to: '2028-12-31', step: 'month' }, { repo: memRepo(), fetchRange });
    expect(r.chunks.map((c) => c.state)).toEqual(['failed', 'fetched']);
  });
});

describe('pullKundliOverlay', () => {
  it('pulls one kundli once per year and span, and a second kundli separately', async () => {
    const repo = memRepo();
    const fetchOverlay = vi.fn(async (_kundliId: string) => payload);
    await pullKundliOverlay('k1', { from: '2027-01-01', to: '2027-12-31', step: 'day' }, { repo, fetchOverlay });
    const again = await pullKundliOverlay('k1', { from: '2027-01-01', to: '2027-12-31', step: 'day' }, { repo, fetchOverlay });
    await pullKundliOverlay('k2', { from: '2027-01-01', to: '2027-12-31', step: 'day' }, { repo, fetchOverlay });
    expect(again.engineCalls).toBe(0);
    expect(fetchOverlay).toHaveBeenCalledTimes(2);
    expect(fetchOverlay.mock.calls.map((c) => c[0])).toEqual(['k1', 'k2']);
  });
});
