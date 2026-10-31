import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  factorsKey,
  getKundliOverlay,
  getSharedRange,
  getTransitSnapshot,
  housesFromOverlay,
  ingestSnapshot,
  instantOf,
  overlayParamsKey,
  placeKey,
  rangeKey,
  resetEphemerisWarning,
  snapshotKey,
  sourceHash,
  stripNatal,
  stripRangeToSky,
  type CachedRow,
  type EphemerisRepo,
} from '../../../src/reading/transits/ephemerisCache.js';
import type { TransitRangePayload } from '../../../src/reading/chartData/transitRange.js';

const SAN_JOSE = { lat: 37.341, lon: -121.894, tz: -8 };

function memRepo(opts: { failReads?: Error } = {}) {
  const snaps = new Map<string, CachedRow<unknown>>();
  const ranges = new Map<string, CachedRow<TransitRangePayload>>();
  const overlays = new Map<string, CachedRow<unknown>>();
  const row = <T>(payload: T, calcVersion: string | null): CachedRow<T> => ({ payload, calcVersion, sourceHash: sourceHash(payload), fetchedAt: new Date(0) });
  const sk = (k: ReturnType<typeof snapshotKey>) => [k.placeKey, k.atUtc.toISOString(), k.factorsKey, k.ayanamsa].join('|');
  const rk = (k: ReturnType<typeof rangeKey>) => Object.values(k).join('|');
  const ok = (k: { kundliId: string; kind: string; paramsKey: string }) => [k.kundliId, k.kind, k.paramsKey].join('|');
  const fail = () => {
    if (opts.failReads) throw opts.failReads;
  };
  const repo: EphemerisRepo & { snaps: typeof snaps; ranges: typeof ranges; overlays: typeof overlays } = {
    snaps,
    ranges,
    overlays,
    async getSnapshot(k) {
      fail();
      return snaps.get(sk(k)) ?? null;
    },
    async putSnapshot(k, _p, r) {
      snaps.set(sk(k), row(r.payload, r.calcVersion));
    },
    async getRange(k) {
      fail();
      return ranges.get(rk(k)) ?? null;
    },
    async putRange(k, _p, r) {
      ranges.set(rk(k), row(r.payload, r.calcVersion));
    },
    async getOverlay(k) {
      fail();
      return overlays.get(ok(k)) ?? null;
    },
    async putOverlay(k, r) {
      overlays.set(ok(k), row(r.payload, r.calcVersion));
    },
  };
  return repo;
}

const snapshotWithNatal = {
  at_jd: 2461000.5,
  calc_version: '3',
  natal_dob: '1980-10-14',
  planets: [
    { body: 'Sa', sign: 'Ar', house_from_lagna: 3, natal_house: 2 },
    { body: 'Ju', sign: 'Li', natal_house: 8 },
  ],
};

describe('keys', () => {
  it('rounds the place to two decimals and keeps the offset', () => {
    expect(placeKey(SAN_JOSE)).toBe('37.34,-121.89,-8');
    expect(placeKey({ lat: 37.3449, lon: -121.894, tz: -8 })).toBe('37.34,-121.89,-8');
  });
  it('sorts and dedupes factors; defaults to rasi', () => {
    expect(factorsKey([30, 1, 9, 1])).toBe('1,9,30');
    expect(factorsKey(undefined)).toBe('1');
    expect(factorsKey('d1-d10')).toBe('d1-d10');
  });
  it('treats the same instant written with different offsets as one key', () => {
    expect(snapshotKey('2027-03-01T12:00:00-08:00', SAN_JOSE).atUtc.toISOString()).toBe(snapshotKey('2027-03-01T20:00:00Z', SAN_JOSE).atUtc.toISOString());
  });
  it('refuses a bare local time (no offset)', () => {
    expect(() => instantOf('2027-03-01 12:00:00')).toThrow(/offset/);
    expect(() => instantOf(new Date('x'))).toThrow(/valid/);
  });
  it('range key defaults to Sa/Ju/Ra/Ke with lunations and eclipses on', () => {
    const k = rangeKey({ from: '2028-01-01', to: '2028-12-31' }, SAN_JOSE);
    expect(k.planetsKey).toBe('Ju,Ke,Ra,Sa');
    expect(k.flagsKey).toBe('l1e1');
    expect(rangeKey({ from: 'a', to: 'b', lunations: false }, SAN_JOSE).flagsKey).toBe('l0e1');
  });
});

describe('stripNatal', () => {
  it('removes natal_* fields and the natal block at any depth, leaving the sky', () => {
    const out = stripNatal({ ...snapshotWithNatal, natal: { lagna_sign: 'Pi' } }) as any;
    expect(out.natal_dob).toBeUndefined();
    expect(out.natal).toBeUndefined();
    expect(out.planets[0]).toEqual({ body: 'Sa', sign: 'Ar', house_from_lagna: 3 });
    expect(out.at_jd).toBe(2461000.5);
  });
  it('does not change its input', () => {
    const before = JSON.stringify(snapshotWithNatal);
    stripNatal(snapshotWithNatal);
    expect(JSON.stringify(snapshotWithNatal)).toBe(before);
  });
});

describe('getTransitSnapshot', () => {
  beforeEach(() => resetEphemerisWarning());

  it('calls Radha once, stores the sky without natal fields, then serves every later asker from the cache', async () => {
    const repo = memRepo();
    const fetchSnapshot = vi.fn(async () => snapshotWithNatal);
    const a = await getTransitSnapshot('2027-03-01T12:00:00-08:00', SAN_JOSE, [1, 9], { repo, fetchSnapshot });
    const b = await getTransitSnapshot(new Date('2027-03-01T20:00:00Z'), SAN_JOSE, [9, 1], { repo, fetchSnapshot });
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(a.source).toBe('radha');
    expect(b.source).toBe('cache');
    expect(JSON.stringify(b.payload)).not.toMatch(/natal/);
    expect(repo.snaps.size).toBe(1);
  });

  it('keeps different places, instants and factors apart', async () => {
    const repo = memRepo();
    const fetchSnapshot = vi.fn(async () => ({ ok: true }));
    await getTransitSnapshot('2027-03-01T12:00:00Z', SAN_JOSE, [1], { repo, fetchSnapshot });
    await getTransitSnapshot('2027-03-01T12:00:00Z', { lat: 18.52, lon: 73.85, tz: 5.5 }, [1], { repo, fetchSnapshot });
    await getTransitSnapshot('2027-03-02T12:00:00Z', SAN_JOSE, [1], { repo, fetchSnapshot });
    await getTransitSnapshot('2027-03-01T12:00:00Z', SAN_JOSE, [1, 9], { repo, fetchSnapshot });
    expect(fetchSnapshot).toHaveBeenCalledTimes(4);
  });

  it('shares one Radha call between concurrent askers', async () => {
    const repo = memRepo();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchSnapshot = vi.fn(async () => {
      await gate;
      return { ok: true };
    });
    const p = [1, 2, 3].map(() => getTransitSnapshot('2027-05-01T12:00:00Z', SAN_JOSE, [1], { repo, fetchSnapshot }));
    release();
    await Promise.all(p);
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it('degrades to a plain Radha call when the cache tables are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const repo = memRepo({ failReads: Object.assign(new Error('relation "transit_instants" does not exist'), { code: 'P2021' }) });
    const fetchSnapshot = vi.fn(async () => ({ ok: true }));
    const r = await getTransitSnapshot('2027-06-01T12:00:00Z', SAN_JOSE, [1], { repo, fetchSnapshot });
    expect(r.source).toBe('radha');
    expect(repo.snaps.size).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not store a failed Radha call, and lets the error through', async () => {
    const repo = memRepo();
    const fetchSnapshot = async () => {
      throw new Error('rate_limit');
    };
    await expect(getTransitSnapshot('2027-07-01T12:00:00Z', SAN_JOSE, [1], { repo, fetchSnapshot })).rejects.toThrow('rate_limit');
    expect(repo.snaps.size).toBe(0);
  });
});

const range = (houses: [number, number]): TransitRangePayload =>
  ({
    from: '2028-01-01',
    to: '2028-12-31',
    planets: ['Sa'],
    natal: { lagna_sign: 'Pisces', lagna_sign_index: 11, moon_sign: 'Scorpio', moon_sign_index: 7 },
    ingresses: [{ planet: 'Sa', sign: 'Ar', sign_index: 0, from: '2028-01-01', to: '2028-03-07', retro_on_entry: false, house_from_lagna: houses[0], house_from_moon: houses[1] }],
    stations: [],
    lunations: [],
    eclipses: [],
    sade_sati: [],
    dhaiya: [],
  }) as unknown as TransitRangePayload;

describe('shared range and per-kundli overlay', () => {
  it('stores the shared range without the natal block', async () => {
    const repo = memRepo();
    const fetchRange = vi.fn(async () => range([2, 9]));
    const first = await getSharedRange({ from: '2028-01-01', to: '2028-12-31' }, SAN_JOSE, 'k1', { repo, fetchRange });
    const second = await getSharedRange({ from: '2028-01-01', to: '2028-12-31' }, SAN_JOSE, 'k2', { repo, fetchRange });
    expect(fetchRange).toHaveBeenCalledTimes(1);
    expect(first.source).toBe('radha');
    expect(second.source).toBe('cache');
    expect((second.payload as any).natal).toBeUndefined();
    expect((second.payload as any).ingresses[0].house_from_lagna).toBeUndefined();
  });

  it('removes every field that belongs to one person from a real-shaped range answer', () => {
    const raw = {
      from: '2028-01-01',
      natal: { lagna_sign: 'Pisces' },
      ingresses: [{ planet: 'Ma', sign: 'Capricorn', from: '2028-01-01', to: '2028-02-03', house_from_lagna: 11, house_from_moon: 3, natal_house: 11 }],
      lunations: [{ kind: 'full', date: '2028-01-12', sign: 'Gemini', house_from_lagna: 4, house_from_moon: 8 }],
      sade_sati: [{ phase: 'rising' }],
      dhaiya: [{ phase: 'x' }],
      rows: [{ date: '2028-01-01', bodies: { Ma: { sign: 'Capricorn', longitude: 3.49, natal_house: 11, house_from_moon: 3 } } }],
      double_transit: [{ month: '2028-01', rasi_drishti: { Ju_signs: [2, 5], both_signs: [2], Ju_houses: [1, 4], both_houses: [1] } }],
    };
    const sky = stripRangeToSky(raw);
    expect(JSON.stringify(sky)).not.toMatch(/natal|house|sade_sati|dhaiya/);
    expect(sky.ingresses[0]).toEqual({ planet: 'Ma', sign: 'Capricorn', from: '2028-01-01', to: '2028-02-03' });
    expect(sky.rows[0]!.bodies.Ma).toEqual({ sign: 'Capricorn', longitude: 3.49 });
    expect(sky.double_transit[0]!.rasi_drishti).toEqual({ Ju_signs: [2, 5], both_signs: [2] });
  });

  it('stores a kundli answer once and serves the repeat from the cache', async () => {
    const repo = memRepo();
    const fetchFromRadha = vi.fn(async () => range([2, 9]));
    const span = { from: '2028-01-01', to: '2028-12-31', planets: ['Sa', 'Ju'] };
    const a = await getKundliOverlay('k1', 'range', span, fetchFromRadha, { repo });
    const b = await getKundliOverlay('k1', 'range', { ...span, planets: ['Ju', 'Sa'] }, fetchFromRadha, { repo });
    const other = await getKundliOverlay('k2', 'range', span, fetchFromRadha, { repo });
    expect([a.source, b.source, other.source]).toEqual(['radha', 'cache', 'radha']);
    expect(fetchFromRadha).toHaveBeenCalledTimes(2);
    expect(overlayParamsKey(span)).toBe(overlayParamsKey({ ...span, planets: ['Ju', 'Sa'] }));
  });

  it('reads houses from the values Radha returned, never computing them', () => {
    const r = range([2, 9]);
    expect(housesFromOverlay(r, 'Sa', '2028-02-10')).toEqual({ house_from_lagna: 2, house_from_moon: 9 });
    expect(housesFromOverlay(r, 'Sa', '2028-03-07')).toEqual({ house_from_lagna: 2, house_from_moon: 9 });
    expect(housesFromOverlay(r, 'Sa', '2028-03-08')).toBeNull();
    expect(housesFromOverlay(r, 'Ju', '2028-02-10')).toBeNull();
  });

  it('two kundlis with different houses share one sky', async () => {
    const repo = memRepo();
    const a = await getKundliOverlay('k1', 'range', { from: '2028-01-01', to: '2028-12-31' }, async () => range([2, 9]), { repo });
    const b = await getKundliOverlay('k2', 'range', { from: '2028-01-01', to: '2028-12-31' }, async () => range([7, 1]), { repo });
    expect(housesFromOverlay(a.payload, 'Sa', '2028-02-01')?.house_from_lagna).toBe(2);
    expect(housesFromOverlay(b.payload, 'Sa', '2028-02-01')?.house_from_lagna).toBe(7);
  });
});

describe('ingestSnapshot (backfill)', () => {
  it('seeds a file payload with natal fields stripped, once', async () => {
    const repo = memRepo();
    expect(await ingestSnapshot('2027-03-01T12:00:00-08:00', SAN_JOSE, [1], snapshotWithNatal, { repo })).toBe(true);
    expect(await ingestSnapshot('2027-03-01T12:00:00-08:00', SAN_JOSE, [1], snapshotWithNatal, { repo })).toBe(false);
    const fetchSnapshot = vi.fn();
    const hit = await getTransitSnapshot('2027-03-01T12:00:00-08:00', SAN_JOSE, [1], { repo, fetchSnapshot });
    expect(hit.source).toBe('cache');
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(JSON.stringify(hit.payload)).not.toMatch(/natal/);
  });
});

describe('migration', () => {
  const sql = readFileSync(path.join(process.cwd(), 'prisma/migrations/20261031100000_transit_ephemeris_cache/migration.sql'), 'utf8');
  it('is additive and idempotent', () => {
    expect(sql.replace(/ON DELETE CASCADE/g, '')).not.toMatch(/\b(DROP|DELETE|TRUNCATE|ALTER\s+TABLE)\b/i);
    for (const t of ['transit_instants', 'transit_range_skies', 'kundli_transit_overlays']) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${t}"`);
    expect(sql).toContain('ON DELETE CASCADE');
  });
  it('matches the schema models', () => {
    const schema = readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    for (const m of ['transit_instants', 'transit_range_skies', 'kundli_transit_overlays']) expect(schema).toContain(`@@map("${m}")`);
  });
});
