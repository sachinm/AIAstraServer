/** Chart Data Review, transit part: the window, the sky's place, the kundli's own rows, the size bound. Rows as stored. */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerAdminLabRoutes } from '../../../../src/routes/adminLabRoutes.js';
import { localDateOf, parsePlace, parseWindow, placeOfKey, TRANSIT_MAX_BYTES } from '../../../../src/routes/adminChartData.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const at = new Date('2026-11-01T10:00:00Z');
const SJ8 = '37.34,-121.89,-8';
const SJ7 = '37.34,-121.89,-7';
const PUNE = '18.52,73.86,5.5';

const planet = (name: string, sign: string, longitude: number) => ({ name, sign, longitude, nakshatra: 'Swaathi', sign_index: 0, house_from_lagna: 1 });
const instant = (place_key: string, iso: string, extra: Record<string, unknown> = {}) => ({
  place_key,
  at_utc: new Date(iso),
  factors_key: '1',
  ayanamsa: 'LAHIRI',
  calc_version: null,
  source_hash: 'h',
  fetched_at: at,
  payload: { at_local: iso.slice(0, 10) + ' 12:00:00', planets: [planet('Sun', 'Libra', 15.1), planet('Saturn', 'Pisces', 14.9)], ...extra },
});
/** San Jose noon, both offsets; Pune monthly. */
let INSTANTS: any[] = [
  instant(SJ8, '2026-11-01T20:00:00Z'),
  instant(SJ8, '2026-11-02T20:00:00Z'),
  instant(SJ8, '2026-11-03T20:00:00Z'),
  instant(SJ7, '2026-10-31T19:00:00Z'),
  instant(PUNE, '2026-11-01T06:30:00Z'),
  instant(SJ8, '2026-12-20T20:00:00Z'),
];
const RANGES = [
  { place_key: PUNE, from_date: new Date('2025-01-01'), to_date: new Date('2035-12-31'), planets_key: 'Ju,Ke,Ra,Sa', flags_key: 'l1e1', ayanamsa: 'LAHIRI', calc_version: null, source_hash: 'r', fetched_at: at, payload: { ingresses: [{ planet: 'Sa', sign: 'Pisces', from: '2025-03-29', to: '2027-06-02' }] } },
  { place_key: PUNE, from_date: new Date('2015-01-01'), to_date: new Date('2024-12-31'), planets_key: 'Ju,Ke,Ra,Sa', flags_key: 'l1e1', ayanamsa: 'LAHIRI', calc_version: null, source_hash: 'r0', fetched_at: at, payload: { ingresses: [] } },
];
const OVERLAYS = [
  { kundli_id: 'k1', kind: 'range', params_key: '2025-01-01|2035-12-31||', from_date: new Date('2025-01-01'), to_date: new Date('2035-12-31'), calc_version: null, source_hash: 'o', fetched_at: at, payload: { ingresses: [{ planet: 'Sa', from: '2025-03-29', to: '2027-06-02', house_from_lagna: 8, house_from_moon: 9 }] } },
  { kundli_id: 'k1', kind: 'contacts', params_key: '2025-01-01|2029-12-31||', from_date: new Date('2025-01-01'), to_date: new Date('2029-12-31'), calc_version: null, source_hash: 'c', fetched_at: at, payload: { contacts: [{ transit: 'Ju', natal: 'Ma', from: '2026-12-01', to: '2027-01-10', exact: ['2026-12-20'], stations: [] }] } },
  { kundli_id: 'k1', kind: 'contacts', params_key: '1975-09-06|1985-09-05||', from_date: new Date('1975-09-06'), to_date: new Date('1985-09-05'), calc_version: null, source_hash: 'old', fetched_at: at, payload: { contacts: [] } },
];
const SNAPSHOTS = [
  { id: 's1', kundli_id: 'k1', from_date: new Date('2026-11-01'), to_date: new Date('2028-11-01'), ayanamsa: 'LAHIRI', snapshot_version: 1, built_at: at, snapshot: { kind: 'natal_overlay', rows: [{ planet: 'Su', from: '2026-11-01', to: '2026-11-15', house_from_lagna: 3 }], double_transit: [{ from: '2026-11-01', to: '2027-01-24', houses: [5] }] } },
];

const d = (v: any): Date => (v instanceof Date ? v : new Date(v));
/** The filters the transit part uses: equality, in, gte/lt/lte on dates. */
function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(row[k]);
      if ('gte' in v && !(d(row[k]) >= d(v.gte))) return false;
      if ('lt' in v && !(d(row[k]) < d(v.lt))) return false;
      if ('lte' in v && !(d(row[k]) <= d(v.lte))) return false;
      return true;
    }
    return row[k] === v;
  });
}
const pick = (row: any, select: any) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row);
const seen: any[] = [];

const prisma: any = {
  auth: {
    findUnique: async ({ where }: any) =>
      where.id === 'u1' ? { id: 'u1', email: 'qa@example.com', name: 'QA', username: 'qa', date_of_birth: '1990-04-05', time_of_birth: '06:30', place_of_birth: 'Pune', city: null, country_code: 'IN', gender: null, locked_at: null } : null,
  },
  kundli: {
    findFirst: async ({ select }: any) =>
      pick({ id: 'k1', created_at: at, lat: 18.52, lon: 73.85, tz: 5.5, place_resolved: 'Pune', queue_status: 'completed', queue_completed_at: at, last_sync_error: null, facts_status: 'ready', digest_status: 'ready', digest_version: 'd1', digest_built_at: at, digest_error: null, preferred_dasha: null }, select),
  },
  chartDataType: { findMany: async () => [] },
  kundliData: { findMany: async () => [] },
  kundliDigest: { findMany: async () => [] },
  kundliActivation: { findMany: async () => [] },
  transitInstant: {
    groupBy: async ({ where }: any) => {
      const m = new Map<string, number>();
      for (const r of INSTANTS.filter((x) => matches(x, where))) m.set(r.place_key, (m.get(r.place_key) ?? 0) + 1);
      return [...m].map(([place_key, n]) => ({ place_key, _count: { _all: n } }));
    },
    findMany: async (args: any) => {
      seen.push({ model: 'instant', args });
      return INSTANTS.filter((r) => matches(r, args.where))
        .sort((a, b) => a.at_utc.getTime() - b.at_utc.getTime())
        .map((r) => pick(r, args.select));
    },
  },
  transitRangeSky: { findMany: async (args: any) => RANGES.filter((r) => matches(r, args.where)).map((r) => pick(r, args.select)) },
  kundliTransitOverlay: { findMany: async (args: any) => OVERLAYS.filter((r) => matches(r, args.where)).map((r) => pick(r, args.select)) },
  transitSnapshot: { findMany: async (args: any) => SNAPSHOTS.filter((r) => matches(r, args.where)).map((r) => pick(r, args.select)) },
};

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  const app = express();
  registerAdminLabRoutes(app, { prisma, enabled: true, token: 'lab-secret' });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
const get = (path: string) => fetch(`${base}${path}`, { headers: { 'x-admin-lab-token': 'lab-secret' } });

describe('chart data review, transit part', () => {
  it('serves the sky for the place with most rows (both offset keys, one date each), the ranges, overlays and snapshots overlapping the window', async () => {
    const r = await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-10-31&to=2026-11-30');
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.part).toBe('transit');
    expect(j.rows).toEqual([]);
    const t = j.transit;
    expect(t.from).toBe('2026-10-31');
    expect(t.to).toBe('2026-11-30');
    expect(t.places.map((p: any) => [p.place, p.rows])).toEqual([
      ['37.34,-121.89', 4],
      ['18.52,73.86', 1],
    ]);
    expect(t.place).toMatchObject({ place: '37.34,-121.89', keys: [SJ7, SJ8] });
    expect(t.instants.map((x: any) => x.localDate)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    expect(t.instants[0]).toMatchObject({ placeKey: SJ7, atUtc: '2026-10-31T19:00:00.000Z', factorsKey: '1', sourceHash: 'h' });
    expect(t.instants[1].payload.planets[0]).toEqual(planet('Sun', 'Libra', 15.1));
    expect(t.ranges.map((x: any) => x.sourceHash)).toEqual(['r']);
    expect(t.ranges[0]).toMatchObject({ placeKey: PUNE, from: '2025-01-01', to: '2035-12-31', planetsKey: 'Ju,Ke,Ra,Sa' });
    expect(t.overlays.map((x: any) => `${x.kind}:${x.from}`)).toEqual(['range:2025-01-01', 'contacts:2025-01-01']);
    expect(t.overlays[0].payload.ingresses[0].house_from_lagna).toBe(8);
    expect(t.snapshots[0]).toMatchObject({ id: 's1', from: '2026-11-01', to: '2028-11-01', snapshotVersion: 1 });
    expect(t.snapshots[0].snapshot.double_transit[0].houses).toEqual([5]);
    expect(t.truncated).toBe(false);
    expect(t.nextFrom).toBeNull();
    expect(t.bytes).toBeGreaterThan(0);
  });

  it('a named place picks that sky; an unknown place gives no instants but still the kundli rows', async () => {
    const pune = await (await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-10-31&to=2026-11-30&place=18.52,73.86')).json();
    expect(pune.transit.instants.map((x: any) => [x.placeKey, x.localDate])).toEqual([[PUNE, '2026-11-01']]);
    const none = await (await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-10-31&to=2026-11-30&place=1.00,2.00')).json();
    expect(none.transit.place).toBeNull();
    expect(none.transit.instants).toEqual([]);
    expect(none.transit.overlays).toHaveLength(2);
  });

  it('refuses a bad window or place, and does not send transit with other parts', async () => {
    expect((await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-13-01')).status).toBe(400);
    expect((await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-12-01&to=2026-11-01')).status).toBe(400);
    expect((await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-01-01&to=2028-01-02')).status).toBe(400);
    expect((await get('/api/admin-lab/chart-data/u1?part=transit&place=pune')).status).toBe(400);
    const natal = await (await get('/api/admin-lab/chart-data/u1')).json();
    expect(natal.transit).toBeNull();
    const all = await (await get('/api/admin-lab/chart-data/u1?part=all')).json();
    expect(all.transit).toBeNull();
  });

  it('cuts the sky instants at the byte bound and says where the next page starts', async () => {
    const saved = INSTANTS;
    const big = 'x'.repeat(Math.ceil(TRANSIT_MAX_BYTES / 2.5));
    INSTANTS = [instant(SJ8, '2026-11-01T20:00:00Z', { pad: big }), instant(SJ8, '2026-11-02T20:00:00Z', { pad: big }), instant(SJ8, '2026-11-03T20:00:00Z', { pad: big })];
    try {
      const j = await (await get('/api/admin-lab/chart-data/u1?part=transit&from=2026-11-01&to=2026-11-30')).json();
      expect(j.transit.instants.map((x: any) => x.localDate)).toEqual(['2026-11-01', '2026-11-02']);
      expect(j.transit.truncated).toBe(true);
      expect(j.transit.nextFrom).toBe('2026-11-03');
      expect(j.transit.bytes).toBeLessThanOrEqual(TRANSIT_MAX_BYTES);
    } finally {
      INSTANTS = saved;
    }
  });

  it('parses the window, the place and dates instants by their own offset', () => {
    expect(parseWindow(undefined, undefined, '2026-11-08')).toEqual({ from: '2026-10-09', to: '2027-11-08' });
    expect(parseWindow('2026-01-01', undefined, '2026-11-08')).toEqual({ from: '2026-01-01', to: '2027-01-31' });
    expect(parseWindow(undefined, '2026-12-31', '2026-11-08')).toEqual({ from: '2025-12-01', to: '2026-12-31' });
    expect(parseWindow('2026-01-01', '2027-12-31', 'x')).toEqual({ from: '2026-01-01', to: '2027-12-31' });
    expect(parseWindow('2026-01-01', '2028-01-01', 'x')).toEqual({ from: '2026-01-01', to: '2028-01-01' });
    expect(parseWindow('2026-01-01', '2028-01-02', 'x')).toBeUndefined();
    expect(parseWindow('2026-02-30', undefined, 'x')).toBeUndefined();
    expect(parsePlace('37.34,-121.89')).toBe('37.34,-121.89');
    expect(parsePlace(undefined)).toBeNull();
    expect(parsePlace('37.341,-121.89')).toBeUndefined();
    expect(placeOfKey(SJ8)).toBe('37.34,-121.89');
    expect(localDateOf(new Date('2026-11-01T20:00:00Z'), SJ8)).toBe('2026-11-01');
    expect(localDateOf(new Date('2026-11-01T06:30:00Z'), PUNE)).toBe('2026-11-01');
    expect(localDateOf(new Date('2026-11-01T02:00:00Z'), SJ8)).toBe('2026-10-31');
  });
});
