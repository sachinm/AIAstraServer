/**
 * R14 (docs/reading-engine/27 §4): castPrashna resolves the question place (client location, else birth place), makes one
 * Radha call with rounded coordinates, stores a prashna_casts row and returns the payload; a missing table is tolerated.
 * Also the client-place parser used by the ask / confirm routes. Fakes only: no network, no database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { castPrashna, askedAtOf, prismaPrashnaRepo, resetPrashnaWarning, type PrashnaCastRow, type PrashnaRepo } from '../../../src/reading/chartData/prashna.js';
import { parseClientPlace, roundCoord, tzOffsetHours } from '../../../src/reading/chartData/place.js';
import type { KundliRequest } from '../../../src/reading/chartData/store.js';

const BIRTH: KundliRequest = { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN' }, coords: { lat: 28.613939, lon: 77.209023, tz: 5.5 } };
const PAYLOAD = { calc_version: '1', at_local: '2026-10-26 10:15:00', panchanga: { tithi: 'x' }, prashna_lagna: { sign: 3 }, charts: { d1: {}, d9: {} } };

function fakeRepo(opts: { birth?: KundliRequest | null; placeResolved?: string | null; insertError?: unknown } = {}) {
  const rows: PrashnaCastRow[] = [];
  const birth = vi.fn(async (_userId: string) =>
    opts.birth === null ? null : { kundliId: 'k1', req: opts.birth ?? BIRTH, placeResolved: opts.placeResolved === undefined ? 'Delhi, India' : opts.placeResolved }
  );
  const insertCast = vi.fn(async (r: PrashnaCastRow) => {
    if (opts.insertError) throw opts.insertError;
    rows.push(r);
    return { id: `cast${rows.length}` };
  });
  const repo: PrashnaRepo = { birth, insertCast };
  return { repo, rows, birth, insertCast };
}

const fakeRadha = (payload: unknown = PAYLOAD) => vi.fn(async (_type: string, _fields: Record<string, unknown>) => payload);

beforeEach(() => resetPrashnaWarning());

describe('castPrashna', () => {
  it('uses the current location when given: rounded, no kundli read, one Radha call, one stored row', async () => {
    const { repo, rows, birth } = fakeRepo();
    const fetcher = fakeRadha();
    const out = await castPrashna({ userId: 'u1', at: '2026-10-26T04:45:00Z', place: { lat: 18.520431, lon: 73.856743, tz: 5.5 }, runId: 'run1' }, { repo, fetcher });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('prashna', { lat: 18.52, lon: 73.86, tz: 5.5, at: '2026-10-26T04:45:00Z' });
    expect(birth).not.toHaveBeenCalled();
    expect(out).toMatchObject({ payload: PAYLOAD, placeSource: 'current', place: { lat: 18.52, lon: 73.86, tz: 5.5 }, castId: 'cast1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'u1', readingRunId: 'run1', placeSource: 'current', lat: 18.52, lon: 73.86, tz: 5.5, calcVersion: '1', payload: PAYLOAD });
    expect(rows[0]!.askedAt.toISOString()).toBe('2026-10-26T04:45:00.000Z');
  });

  it('falls back to the birth place: the kundli coordinates, rounded, and the stored place name', async () => {
    const { repo, rows } = fakeRepo();
    const fetcher = fakeRadha();
    const out = await castPrashna({ userId: 'u1', at: '2026-10-26 10:15:00' }, { repo, fetcher });
    expect(fetcher.mock.calls[0]![1]).toEqual({ lat: 28.61, lon: 77.21, tz: 5.5, at: '2026-10-26 10:15:00' });
    expect(out).toMatchObject({ placeSource: 'birth', placeResolved: 'Delhi, India' });
    // place-local time read at the place's offset
    expect(rows[0]).toMatchObject({ placeSource: 'birth', lat: 28.61, lon: 77.21, tz: 5.5, readingRunId: null });
    expect(rows[0]!.askedAt.toISOString()).toBe('2026-10-26T04:45:00.000Z');
  });

  it('with no stored birth coordinates, sends the birth place text and stores null coordinates', async () => {
    const { repo, rows } = fakeRepo({ birth: { ...BIRTH, coords: null }, placeResolved: null });
    const fetcher = fakeRadha({ result: 1 });
    await castPrashna({ userId: 'u1', at: '2026-10-26T04:45:00Z' }, { repo, fetcher });
    expect(fetcher.mock.calls[0]![1]).toEqual({ place: 'Delhi,IN', at: '2026-10-26T04:45:00Z' });
    expect(rows[0]).toMatchObject({ lat: null, lon: null, tz: null, placeResolved: 'Delhi,IN', calcVersion: null });
  });

  it('defaults the moment to now; sends vargas and the natal overlay only when asked', async () => {
    const { repo } = fakeRepo();
    const fetcher = fakeRadha();
    const now = Date.UTC(2026, 9, 26, 5, 0, 0);
    await castPrashna({ userId: 'u1', place: { lat: 1, lon: 2, tz: 0 }, divisionalChartFactors: [1, 9, 10], withNatal: true }, { repo, fetcher, now: () => now });
    expect(fetcher.mock.calls[0]![1]).toEqual({
      lat: 1, lon: 2, tz: 0, at: '2026-10-26T05:00:00.000Z', divisional_chart_factors: [1, 9, 10],
      natal_dob: '1990-01-01', natal_tob: '10:00:00', natal_place: 'Delhi,IN', natal_lat: 28.613939, natal_lon: 77.209023, natal_tz: 5.5,
    });
  });

  it('returns the payload unstored when prashna_casts is missing, and logs that once', async () => {
    const missing = Object.assign(new Error('relation "prashna_casts" does not exist'), { code: '42P01' });
    const { repo } = fakeRepo({ insertError: missing });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a = await castPrashna({ userId: 'u1', at: '2026-10-26T04:45:00Z' }, { repo, fetcher: fakeRadha() });
    const b = await castPrashna({ userId: 'u1', at: '2026-10-26T04:46:00Z' }, { repo, fetcher: fakeRadha() });
    expect(a).toMatchObject({ payload: PAYLOAD, castId: null });
    expect(b.castId).toBeNull();
    expect(warn.mock.calls.filter(([m]) => String(m).includes('prashna_casts missing'))).toHaveLength(1);
    warn.mockRestore();
  });

  it('refuses without a place or a birth place, a bad moment or bad vargas, before calling Radha', async () => {
    const fetcher = fakeRadha();
    await expect(castPrashna({ userId: 'u1' }, { repo: fakeRepo({ birth: null }).repo, fetcher })).rejects.toThrow(/no current location and no birth place/);
    await expect(castPrashna({ userId: 'u1', place: { lat: 1, lon: 2, tz: 0 }, withNatal: true }, { repo: fakeRepo({ birth: null }).repo, fetcher })).rejects.toThrow(/withNatal needs a kundli/);
    await expect(castPrashna({ userId: 'u1', at: 'now please' }, { repo: fakeRepo().repo, fetcher })).rejects.toThrow(/castPrashna: at must be/);
    await expect(castPrashna({ userId: 'u1', divisionalChartFactors: [7000] }, { repo: fakeRepo().repo, fetcher })).rejects.toThrow(/must be among/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes Radha errors through and stores nothing', async () => {
    const { repo, insertCast } = fakeRepo();
    const fetcher = vi.fn(async () => {
      throw new Error('Invalid export type: prashna');
    });
    await expect(castPrashna({ userId: 'u1' }, { repo, fetcher })).rejects.toThrow(/Invalid export type/);
    expect(insertCast).not.toHaveBeenCalled();
  });

  it('the SQL repository inserts one row with jsonb payload and reads the latest kundli', async () => {
    const queryRaw = vi.fn(async () => [{ id: 'c1' }]);
    const findFirst = vi.fn(async () => ({ id: 'k9', place_resolved: 'Pune, India' }));
    const prisma = { $queryRaw: queryRaw, kundli: { findFirst } } as never;
    const repo = prismaPrashnaRepo(prisma, { kundliRequest: async () => BIRTH });
    expect(await repo.birth('u1')).toEqual({ kundliId: 'k9', req: BIRTH, placeResolved: 'Pune, India' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: 'u1' }, orderBy: { created_at: 'desc' } }));
    const row: PrashnaCastRow = { userId: 'u1', readingRunId: null, askedAt: new Date(0), placeResolved: null, lat: 1, lon: 2, tz: 0, placeSource: 'current', calcVersion: '1', payload: { a: 1 } };
    expect(await repo.insertCast(row)).toEqual({ id: 'c1' });
    const [strings, ...values] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, ...unknown[]];
    expect(strings.join('?')).toMatch(/INSERT INTO "prashna_casts"[\s\S]*::jsonb[\s\S]*RETURNING "id"/);
    expect(values).toEqual(['u1', null, new Date(0), null, 1, 2, 0, 'current', '1', '{"a":1}']);
  });
});

describe('question place from the client', () => {
  it('rounds coordinates to two decimals and reads tz as hours or an IANA zone', () => {
    expect(roundCoord(18.526)).toBe(18.53);
    expect(roundCoord(-74.006)).toBe(-74.01);
    expect(parseClientPlace({ lat: 18.520431, lon: 73.856743, tz: 5.5 })).toEqual({ lat: 18.52, lon: 73.86, tz: 5.5 });
    expect(parseClientPlace({ lat: '40.7128', lon: '-74.0060', tz: 'America/New_York' }, new Date('2026-07-01T12:00:00Z'))).toEqual({ lat: 40.71, lon: -74.01, tz: -4 });
    expect(parseClientPlace({ lat: 40.7128, lon: -74.006, tz: 'America/New_York' }, new Date('2026-12-01T12:00:00Z'))?.tz).toBe(-5);
    expect(tzOffsetHours('Asia/Kathmandu')).toBe(5.75);
    expect(tzOffsetHours('UTC')).toBe(0);
  });
  it('anything missing or out of range means no place (the birth place is used)', () => {
    expect(parseClientPlace(undefined)).toBeNull();
    expect(parseClientPlace({ lat: 18.5, lon: 73.8 })).toBeNull();
    expect(parseClientPlace({ lat: 91, lon: 0, tz: 0 })).toBeNull();
    expect(parseClientPlace({ lat: 0, lon: 181, tz: 0 })).toBeNull();
    expect(parseClientPlace({ lat: 0, lon: 0, tz: 15 })).toBeNull();
    expect(parseClientPlace({ lat: 0, lon: 0, tz: 'Not/AZone' })).toBeNull();
    expect(parseClientPlace({ lat: 'x', lon: 0, tz: 0 })).toBeNull();
  });
  it('reads the asked-at instant from Radha local time or ISO', () => {
    expect(askedAtOf('2026-10-26 10:15:00', 5.5).toISOString()).toBe('2026-10-26T04:45:00.000Z');
    expect(askedAtOf('2026-10-26T10:15:00+05:30', 0).toISOString()).toBe('2026-10-26T04:45:00.000Z');
  });
});
