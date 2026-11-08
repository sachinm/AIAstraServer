/** Chart Data Review (GET /api/admin-lab/chart-data/:userId): token guard, parts, year filter, opened rows as stored. */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerAdminLabRoutes } from '../../../../src/routes/adminLabRoutes.js';
import { parsePart, parseYears, yearOfVariant } from '../../../../src/routes/adminChartData.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const at = new Date('2026-11-01T10:00:00Z');
const meta = (data_type: string, variant = '', over: Record<string, unknown> = {}) => ({
  data_type,
  variant,
  params: {},
  ayanamsa: 'LAHIRI',
  calc_version: '2',
  engine_commit: 'abc123',
  payload_hash: 'h',
  status: 'ready',
  error: null,
  fetch_started_at: at,
  fetched_at: at,
  valid_to: null,
  ...over,
});
const ROWS = [
  { ...meta('ashtakavarga'), payload: { sav: { values: [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 29], total: 337 } } },
  { ...meta('dasha.vimsottari'), payload: { system: 'vimsottari', periods: [] } },
  { ...meta('yogas', '', { status: 'failed', error: 'engine timeout' }), payload: null },
  { ...meta('annual.tithi_pravesha', 'year=2025'), payload: { year_used: 2025 } },
  { ...meta('annual.mudda', 'current'), payload: { year_used: 2026 } },
  { ...meta('annual.tithi_pravesha', 'year=2026'), payload: { year_used: 2026 } },
  { ...meta('annual.tithi_pravesha', 'year=2026;divisional_chart_factor=9'), payload: { year_used: 2026, divisional_chart_factor: 9 } },
  { ...meta('annual.tithi_pravesha', 'year=2027'), payload: { year_used: 2027 } },
];

/** A tiny where-evaluator for the filters the route uses (startsWith, NOT, OR, equality). */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]: [string, any]) => {
    if (k === 'NOT') return Array.isArray(v) ? v.every((w) => !matches(row, w)) : !matches(row, v);
    if (k === 'OR') return (v as any[]).some((w) => matches(row, w));
    if (v && typeof v === 'object' && 'startsWith' in v) return String(row[k]).startsWith(v.startsWith);
    return row[k] === v;
  });
}
const pick = (row: any, select: any) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row);
const calls: any[] = [];

const prisma: any = {
  auth: {
    findUnique: async ({ where }: any) =>
      where.id === 'u1'
        ? { id: 'u1', email: 'qa@example.com', name: 'QA Person', username: 'qa', date_of_birth: '1990-04-05', time_of_birth: '06:30', place_of_birth: 'Pune, India', city: 'Pune', country_code: 'IN', gender: 'male', locked_at: null }
        : where.id === 'u2'
          ? { id: 'u2', email: 'no@example.com', name: null, username: 'nokundli', date_of_birth: '1991-01-01', time_of_birth: null, place_of_birth: null, city: null, country_code: null, gender: null, locked_at: null }
          : null,
  },
  kundli: {
    findFirst: async ({ where, select }: any) =>
      where.user_id === 'u1'
        ? pick(
            {
              id: 'k1',
              created_at: at,
              lat: 18.52,
              lon: 73.85,
              tz: 5.5,
              place_resolved: 'Pune, IN',
              queue_status: 'done',
              queue_completed_at: at,
              last_sync_error: null,
              facts_status: 'ready',
              digest_status: 'ready',
              digest_version: 'd1.3',
              digest_built_at: at,
              digest_error: null,
              preferred_dasha: 'vimsottari',
              biodata: { ayanamsa: '23-53-22' },
              d1: [{ body: 'Lagna', rasi: 'Pi' }],
              d2: null,
              d4: null,
              d7: null,
              d9: null,
              d10: null,
              charakaraka: null,
              vimsottari_dasa: null,
              narayana_dasa: null,
              other_readings: null,
            },
            select
          )
        : null,
  },
  chartDataType: { findMany: async () => [{ id: 'yogas', served: true, calc_version: '3', enabled: true, label: 'Yogas (table)', family: 'yoga' }] },
  kundliData: {
    findMany: async (args: any) => {
      calls.push(args);
      return ROWS.filter((r) => matches({ ...r, kundli_id: 'k1' }, args.where)).map((r) => pick(r, args.select));
    },
  },
  kundliDigest: { findMany: async () => [{ section: 'yoga', key: 'D1.gaja', row: { id: 'gaja' }, source: [{ type: 'yogas' }], digest_version: 'd1.3', built_at: at }] },
  kundliActivation: {
    findMany: async () => [{ system: 'vimsottari', family: 'nakshatra', level: 1, lord: 'Moon', sign: null, from_date: new Date('2018-03-16T00:00:00Z'), to_date: new Date('2028-03-16T00:00:00Z'), houses: [9], parent_lord: null, digest_version: 'd1.3' }],
  },
};

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  const app = express();
  app.use(express.json());
  registerAdminLabRoutes(app, { prisma, enabled: true, token: 'lab-secret' });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const get = (path: string, token = 'lab-secret') => fetch(`${base}${path}`, { headers: { 'x-admin-lab-token': token } });

describe('chart data review route', () => {
  it('refuses without the token, a bad part or bad years, and an unknown person', async () => {
    expect((await get('/api/admin-lab/chart-data/u1', 'wrong')).status).toBe(403);
    expect((await get('/api/admin-lab/chart-data/u1?part=everything')).status).toBe(400);
    expect((await get('/api/admin-lab/chart-data/u1?part=annual&years=26')).status).toBe(400);
    expect((await get('/api/admin-lab/chart-data/u9')).status).toBe(404);
  });

  it('natal (default): person in full, kundli status, catalogue with expected flags, index without payloads, natal rows and legacy columns', async () => {
    const r = await get('/api/admin-lab/chart-data/u1');
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.part).toBe('natal');
    expect(j.person).toMatchObject({ userId: 'u1', name: 'QA Person', dateOfBirth: '1990-04-05', timeOfBirth: '06:30', placeOfBirth: 'Pune, India', gender: 'male' });
    expect(j.kundli).toMatchObject({ id: 'k1', lat: 18.52, lon: 73.85, tz: 5.5, digestStatus: 'ready', digestVersion: 'd1.3' });
    expect(j.types.find((t: any) => t.id === 'yogas')).toMatchObject({ label: 'Yogas (table)', served: true, calcVersion: '3', expected: true });
    expect(j.types.find((t: any) => t.id === 'annual.tithi_pravesha')).toMatchObject({ expected: true, variantKind: 'year' });
    expect(j.types.some((t: any) => t.changeClass === 'moving')).toBe(false);
    expect(j.index).toHaveLength(ROWS.length);
    expect(j.index.every((x: any) => !('payload' in x))).toBe(true);
    expect(j.rows.map((x: any) => x.dataType)).toEqual(['ashtakavarga', 'yogas']);
    expect(j.rows[0]).toMatchObject({ status: 'ready', payload: { sav: { total: 337 } }, fetchedAt: at.toISOString() });
    expect(j.rows[0].bytes).toBeGreaterThan(10);
    expect(j.rows[1]).toMatchObject({ status: 'failed', error: 'engine timeout', payload: null, bytes: 0 });
    expect(j.legacy.biodata).toEqual({ ayanamsa: '23-53-22' });
    expect(j.legacy.d1).toEqual([{ body: 'Lagna', rasi: 'Pi' }]);
    expect(j.digest).toBeNull();
    expect(j.activation).toBeNull();
  });

  it('dasha rows come as their own part', async () => {
    const j = await (await get('/api/admin-lab/chart-data/u1?part=dasha')).json();
    expect(j.rows.map((x: any) => x.dataType)).toEqual(['dasha.vimsottari']);
    expect(j.legacy).toBeNull();
  });

  it('annual narrows to the asked years, every variant of each year included, plus the current pull', async () => {
    const j = await (await get('/api/admin-lab/chart-data/u1?part=annual&years=2026,2027')).json();
    expect(j.rows.map((x: any) => `${x.dataType}@${x.variant}`)).toEqual(['annual.mudda@current', 'annual.tithi_pravesha@year=2026', 'annual.tithi_pravesha@year=2026;divisional_chart_factor=9', 'annual.tithi_pravesha@year=2027']);
    expect(j.legacy).toBeNull();
    const all = await (await get('/api/admin-lab/chart-data/u1?part=annual')).json();
    expect(all.rows).toHaveLength(5);
  });

  it('digest and activation parts', async () => {
    const d = await (await get('/api/admin-lab/chart-data/u1?part=digest')).json();
    expect(d.rows).toEqual([]);
    expect(d.digest).toEqual([{ section: 'yoga', key: 'D1.gaja', row: { id: 'gaja' }, source: [{ type: 'yogas' }], digestVersion: 'd1.3', builtAt: at.toISOString() }]);
    const a = await (await get('/api/admin-lab/chart-data/u1?part=activation')).json();
    expect(a.activation).toEqual([{ system: 'vimsottari', family: 'nakshatra', level: 1, lord: 'Moon', sign: null, from: '2018-03-16', to: '2028-03-16', houses: [9], parentLord: null, digestVersion: 'd1.3' }]);
  });

  it('a person without a kundli gets the person and an empty chart', async () => {
    const j = await (await get('/api/admin-lab/chart-data/u2?part=all')).json();
    expect(j.kundli).toBeNull();
    expect(j.rows).toEqual([]);
    expect(j.person.name).toBe('nokundli');
  });

  it('parses part, years and variants', () => {
    expect(parsePart(undefined)).toBe('natal');
    expect(parsePart('all')).toBe('all');
    expect(parsePart('x')).toBeNull();
    expect(parseYears('2027,2025,2027')).toEqual([2025, 2027]);
    expect(parseYears('2020,2021,2022,2023,2024,2025')).toBeUndefined();
    expect(parseYears(undefined)).toBeNull();
    expect(yearOfVariant('year=2026;system=mudda')).toBe(2026);
    expect(yearOfVariant('')).toBeNull();
  });
});
