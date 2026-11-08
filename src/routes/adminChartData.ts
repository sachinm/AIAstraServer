/**
 * Chart Data Review (admin module, aiadastra_admin `web/src/pages/ChartData.tsx`): every row the engine stored for one
 * person's chart, opened by the Prisma PII extension and served behind the admin-lab token. Nothing here computes
 * astrology; the rows are returned as stored.
 *
 *   GET /api/admin-lab/chart-data/:userId?part=natal|dasha|annual|digest|activation|transit|all&years=2025,2026,2027
 *       transit only: &from=YYYY-MM-DD&to=YYYY-MM-DD&place=<lat>,<lon>
 *
 * Every answer carries the person (QA, Sachin 2026-11-08: every auth and kundli row is made-up test data, so birth
 * details are shown in full), the latest kundli's status columns, the catalogue (built-in list merged with the
 * `chart_data_types` table, plus which ids the digest expects) and the index of every stored `kundli_data` row without
 * its payload. `part` picks which payloads come with it, so one answer stays well under the Lambda's 6 MB response cap:
 *
 *   natal       (default) natal `kundli_data` rows other than dashas, with payloads, plus the legacy `kundlis` JSON columns
 *   dasha       `dasha.*` rows with payloads (about 3 MB on a full chart, most of a natal answer, so a part of its own)
 *   annual      `annual.*` rows with payloads; `years` (comma list, at most 5) narrows them to those years' variants
 *               plus the `current` variants of the registration pull
 *   digest      `kundli_digest` rows
 *   activation  `kundli_activation` rows
 *   transit     the stored transit data over a window (default 30 days back to 365 ahead, at most 731 days): the shared
 *               sky (`transit_instants` for one place, `transit_range_skies` overlapping the window) and this kundli's
 *               own engine answers (`kundli_transit_overlays`: houses and contacts; `transit_snapshots`: the natal-overlay
 *               chart with its windows). `place` picks the sky's place (two-decimal lat,lon of a stored place key);
 *               default the place with the most rows in the window. Bounded to TRANSIT_MAX_BYTES; when cut, `nextFrom`
 *               says where the next page starts.
 *   all         everything above except transit (small charts and tests only)
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { BUILTIN_CHART_TYPES } from '../reading/chartData/catalog.js';
import { DIGEST_NATAL_TYPES } from '../reading/digest/build.js';
import { ANNUAL_CHART_TYPES, ANNUAL_YEAR_TYPES } from '../reading/digest/annualSet.js';

export const CHART_DATA_PARTS = ['natal', 'dasha', 'annual', 'digest', 'activation', 'transit', 'all'] as const;
export type ChartDataPart = (typeof CHART_DATA_PARTS)[number];

/** The legacy `kundlis` JSON columns (sealed; opened by the extension) served with the natal part. */
const LEGACY_COLUMNS = ['biodata', 'd1', 'd2', 'd4', 'd7', 'd9', 'd10', 'charakaraka', 'vimsottari_dasa', 'narayana_dasa', 'other_readings'] as const;

const iso = (d: Date | null | undefined): string | null => (d instanceof Date ? d.toISOString() : null);
const day = (d: Date | null | undefined): string | null => (d instanceof Date ? d.toISOString().slice(0, 10) : null);

export function parsePart(v: unknown): ChartDataPart | null {
  if (v === undefined || v === '') return 'natal';
  return typeof v === 'string' && (CHART_DATA_PARTS as readonly string[]).includes(v) ? (v as ChartDataPart) : null;
}

/** `2025,2026` → [2025, 2026]; null when absent; undefined when malformed. */
export function parseYears(v: unknown): number[] | null | undefined {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string') return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length || parts.length > 5 || !parts.every((s) => /^\d{4}$/.test(s))) return undefined;
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

/** The year a `year=<y>[;...]` variant belongs to, or null. */
export function yearOfVariant(variant: string): number | null {
  const m = /^year=(\d{4})(?:;|$)/.exec(variant);
  return m ? Number(m[1]) : null;
}

// ------------------------------------------------------------------------------------------------- transit part

/** Default window: 30 days back, 365 ahead. The cap keeps one answer well under the Lambda's 6 MB response limit. */
export const TRANSIT_DEFAULT_BACK_DAYS = 30;
export const TRANSIT_DEFAULT_AHEAD_DAYS = 365;
export const TRANSIT_MAX_DAYS = 731;
/** Bytes of payload one transit answer may carry before the sky instants are cut and paged (`nextFrom`). */
export const TRANSIT_MAX_BYTES = 4_500_000;

const DAY_MS = 86_400_000;
const addDays = (d: string, n: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const validDate = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && addDays(d, 0) === d;

/** The transit window from the query; undefined when malformed, reversed or longer than TRANSIT_MAX_DAYS. */
export function parseWindow(fromQ: unknown, toQ: unknown, today: string): { from: string; to: string } | undefined {
  const f = fromQ === undefined || fromQ === '' ? null : fromQ;
  const t = toQ === undefined || toQ === '' ? null : toQ;
  if ((f !== null && (typeof f !== 'string' || !validDate(f))) || (t !== null && (typeof t !== 'string' || !validDate(t)))) return undefined;
  const span = TRANSIT_DEFAULT_BACK_DAYS + TRANSIT_DEFAULT_AHEAD_DAYS;
  const from = (f as string | null) ?? (t ? addDays(t as string, -span) : addDays(today, -TRANSIT_DEFAULT_BACK_DAYS));
  const to = (t as string | null) ?? addDays(from, span);
  if (to < from) return undefined;
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > TRANSIT_MAX_DAYS) return undefined;
  return { from, to };
}

/** `37.34,-121.89` as given; null when absent; undefined when malformed. */
export function parsePlace(v: unknown): string | null | undefined {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^-?\d{1,3}(\.\d{1,2})?,-?\d{1,3}(\.\d{1,2})?$/.test(v)) return undefined;
  return v;
}

/** A sky place key (`lat,lon,tz`) without its offset: one place across its daylight-saving keys. */
export const placeOfKey = (key: string): string => key.split(',').slice(0, 2).join(',');

/**
 * The place-local calendar date of a stored instant: the UTC instant moved by the key's own UTC offset. Clock arithmetic
 * only, so a row stored at 20:00Z under `-8` belongs to that day's noon in the place.
 */
export function localDateOf(atUtc: Date, key: string): string {
  const tz = Number(key.split(',')[2]);
  return new Date(atUtc.getTime() + (Number.isFinite(tz) ? tz : 0) * 3_600_000).toISOString().slice(0, 10);
}

const bytesOf = (v: unknown): number => (v == null ? 0 : Buffer.byteLength(JSON.stringify(v)));

type InstantRow = { place_key: string; at_utc: Date; factors_key: string; ayanamsa: string; calc_version: string | null; source_hash: string; fetched_at: Date; payload: unknown };

/**
 * Every stored transit row for this kundli over the window, as stored (overlays and snapshots are opened by the PII
 * extension). Nothing is computed: rows are selected by date and place, and dated by their own key's offset.
 */
export async function loadTransit(prisma: PrismaClient, kundliId: string, win: { from: string; to: string }, placeWanted: string | null) {
  const lo = new Date(Date.parse(`${win.from}T00:00:00Z`) - DAY_MS);
  const hi = new Date(Date.parse(`${win.to}T00:00:00Z`) + 2 * DAY_MS);
  const fromD = new Date(`${win.from}T00:00:00Z`);
  const toD = new Date(`${win.to}T00:00:00Z`);
  const grouped: unknown = await prisma.transitInstant.groupBy({ by: ['place_key'], where: { at_utc: { gte: lo, lt: hi } }, _count: { _all: true }, orderBy: { place_key: 'asc' } });
  const counts = grouped as Array<{ place_key: string; _count: { _all: number } }>;
  const byPlace = new Map<string, { place: string; keys: string[]; rows: number }>();
  for (const c of counts) {
    const place = placeOfKey(c.place_key);
    const g = byPlace.get(place) ?? { place, keys: [], rows: 0 };
    g.keys.push(c.place_key);
    g.rows += c._count._all;
    byPlace.set(place, g);
  }
  const places = [...byPlace.values()].map((g) => ({ ...g, keys: g.keys.sort() })).sort((a, b) => b.rows - a.rows || a.place.localeCompare(b.place));
  const chosen = placeWanted ? (places.find((p) => p.place === placeWanted) ?? null) : (places[0] ?? null);

  const instants = chosen
    ? ((await prisma.transitInstant.findMany({
        where: { place_key: { in: chosen.keys }, at_utc: { gte: lo, lt: hi } },
        select: { place_key: true, at_utc: true, factors_key: true, ayanamsa: true, calc_version: true, source_hash: true, fetched_at: true, payload: true },
        orderBy: [{ at_utc: 'asc' }, { place_key: 'asc' }],
      })) as InstantRow[])
    : [];
  const inst = instants
    .map((r) => ({
      placeKey: r.place_key,
      atUtc: iso(r.at_utc),
      localDate: localDateOf(r.at_utc, r.place_key),
      factorsKey: r.factors_key,
      ayanamsa: r.ayanamsa,
      calcVersion: r.calc_version,
      sourceHash: r.source_hash,
      fetchedAt: iso(r.fetched_at),
      payload: r.payload ?? null,
      bytes: bytesOf(r.payload),
    }))
    .filter((r) => r.localDate >= win.from && r.localDate <= win.to);

  const ranges = (
    await prisma.transitRangeSky.findMany({
      where: { from_date: { lte: toD }, to_date: { gte: fromD } },
      select: { place_key: true, from_date: true, to_date: true, planets_key: true, flags_key: true, ayanamsa: true, calc_version: true, source_hash: true, fetched_at: true, payload: true },
      orderBy: [{ place_key: 'asc' }, { from_date: 'asc' }],
    })
  ).map((r) => ({
    placeKey: r.place_key,
    from: day(r.from_date),
    to: day(r.to_date),
    planetsKey: r.planets_key,
    flagsKey: r.flags_key,
    ayanamsa: r.ayanamsa,
    calcVersion: r.calc_version,
    sourceHash: r.source_hash,
    fetchedAt: iso(r.fetched_at),
    payload: r.payload ?? null,
    bytes: bytesOf(r.payload),
  }));

  const overlays = (
    await prisma.kundliTransitOverlay.findMany({
      where: { kundli_id: kundliId, from_date: { lte: toD }, to_date: { gte: fromD } },
      select: { kind: true, params_key: true, from_date: true, to_date: true, calc_version: true, source_hash: true, fetched_at: true, payload: true },
      orderBy: [{ kind: 'asc' }, { from_date: 'asc' }],
    })
  ).map((r) => ({
    kind: r.kind,
    paramsKey: r.params_key,
    from: day(r.from_date),
    to: day(r.to_date),
    calcVersion: r.calc_version,
    sourceHash: r.source_hash,
    fetchedAt: iso(r.fetched_at),
    payload: r.payload ?? null,
    bytes: bytesOf(r.payload),
  }));

  const snapshots = (
    await prisma.transitSnapshot.findMany({
      where: { kundli_id: kundliId, from_date: { lte: toD }, to_date: { gte: fromD } },
      select: { id: true, from_date: true, to_date: true, ayanamsa: true, snapshot_version: true, built_at: true, snapshot: true },
      orderBy: { built_at: 'desc' },
      take: 3,
    })
  ).map((r) => ({
    id: r.id,
    from: day(r.from_date),
    to: day(r.to_date),
    ayanamsa: r.ayanamsa,
    snapshotVersion: r.snapshot_version,
    builtAt: iso(r.built_at),
    snapshot: r.snapshot ?? null,
    bytes: bytesOf(r.snapshot),
  }));

  // bound the answer: the kundli's own rows and the ranges always come; the sky instants are cut at the end and paged
  let bytes = [...ranges, ...overlays, ...snapshots].reduce((n, r) => n + r.bytes, 0);
  let cut = inst.length;
  for (let i = 0; i < inst.length; i++) {
    if (bytes + inst[i]!.bytes > TRANSIT_MAX_BYTES) {
      cut = i;
      break;
    }
    bytes += inst[i]!.bytes;
  }
  const nextFrom = cut < inst.length ? inst[cut]!.localDate : null;
  return { from: win.from, to: win.to, place: chosen, places, instants: inst.slice(0, cut), ranges, overlays, snapshots, truncated: nextFrom !== null, nextFrom, bytes };
}

type RowMeta = {
  data_type: string;
  variant: string;
  params: unknown;
  ayanamsa: string;
  calc_version: string | null;
  engine_commit: string | null;
  payload_hash: string | null;
  status: string;
  error: string | null;
  fetch_started_at: Date | null;
  fetched_at: Date | null;
  valid_to: Date | null;
};

function rowOut(r: RowMeta & { payload?: unknown }, withPayload: boolean) {
  const out: Record<string, unknown> = {
    dataType: r.data_type,
    variant: r.variant,
    params: r.params ?? {},
    ayanamsa: r.ayanamsa,
    calcVersion: r.calc_version,
    engineCommit: r.engine_commit,
    payloadHash: r.payload_hash,
    status: r.status,
    error: r.error,
    fetchStartedAt: iso(r.fetch_started_at),
    fetchedAt: iso(r.fetched_at),
    validTo: iso(r.valid_to),
  };
  if (withPayload) {
    out.payload = r.payload ?? null;
    out.bytes = r.payload == null ? 0 : Buffer.byteLength(JSON.stringify(r.payload));
  }
  return out;
}

const META_SELECT = {
  data_type: true,
  variant: true,
  params: true,
  ayanamsa: true,
  calc_version: true,
  engine_commit: true,
  payload_hash: true,
  status: true,
  error: true,
  fetch_started_at: true,
  fetched_at: true,
  valid_to: true,
} as const;

export interface ChartDataDeps {
  prisma: PrismaClient;
  /** the clock for the transit window's default (tests) */
  today?: () => Date;
}

/** The handler (the caller mounts it behind the lab token guard). */
export function chartDataHandler(deps: ChartDataDeps): express.RequestHandler {
  return async (req, res) => {
    const part = parsePart(req.query.part);
    const years = parseYears(req.query.years);
    const win = part === 'transit' ? parseWindow(req.query.from, req.query.to, (deps.today?.() ?? new Date()).toISOString().slice(0, 10)) : null;
    const place = parsePlace(req.query.place);
    if (!part || years === undefined || win === undefined || place === undefined) return void res.status(400).json({ error: 'bad_request' });
    const userId = String(req.params.userId);
    try {
      const a = await deps.prisma.auth.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, username: true, date_of_birth: true, time_of_birth: true, place_of_birth: true, city: true, country_code: true, gender: true, locked_at: true },
      });
      if (!a) return void res.status(404).json({ error: 'no_person' });
      const withNatal = part === 'natal' || part === 'all';
      const withAnnual = part === 'annual' || part === 'all';
      const withDasha = part === 'dasha' || part === 'all';
      const k = await deps.prisma.kundli.findFirst({
        where: { user_id: a.id },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          created_at: true,
          lat: true,
          lon: true,
          tz: true,
          place_resolved: true,
          queue_status: true,
          queue_completed_at: true,
          last_sync_error: true,
          facts_status: true,
          digest_status: true,
          digest_version: true,
          digest_built_at: true,
          digest_error: true,
          preferred_dasha: true,
          ...(withNatal ? Object.fromEntries(LEGACY_COLUMNS.map((c) => [c, true])) : {}),
        },
      });
      const tableRows = await deps.prisma.chartDataType.findMany({ select: { id: true, served: true, calc_version: true, enabled: true, label: true, family: true } }).catch(() => []);
      const tableById = new Map(tableRows.map((t) => [t.id, t]));
      const expected = new Set<string>(['varga.d1', ...DIGEST_NATAL_TYPES]);
      const annualExpected = new Set<string>([...ANNUAL_CHART_TYPES, ...ANNUAL_YEAR_TYPES]);
      const types = BUILTIN_CHART_TYPES.filter((t) => t.changeClass !== 'moving').map((t) => {
        const row = tableById.get(t.id);
        return {
          id: t.id,
          family: row?.family ?? t.family,
          label: row?.label ?? t.label,
          changeClass: t.changeClass,
          variantKind: t.variantKind,
          served: row?.served ?? t.served,
          calcVersion: row?.calc_version ?? t.calcVersion,
          enabled: row?.enabled ?? true,
          expected: expected.has(t.id) || annualExpected.has(t.id),
        };
      });
      const person = {
        userId: a.id,
        name: a.name?.trim() || a.username?.trim() || null,
        email: a.email ?? null,
        dateOfBirth: a.date_of_birth ?? null,
        timeOfBirth: a.time_of_birth ?? null,
        placeOfBirth: a.place_of_birth?.trim() || null,
        city: a.city ?? null,
        countryCode: a.country_code ?? null,
        gender: a.gender ?? null,
        locked: a.locked_at != null,
      };
      if (!k) {
        return void res.json({ person, kundli: null, types, index: [], part, years, rows: [], legacy: null, digest: null, activation: null, transit: null, servedAt: new Date().toISOString() });
      }
      const index = await deps.prisma.kundliData.findMany({ where: { kundli_id: k.id }, select: META_SELECT, orderBy: [{ data_type: 'asc' }, { variant: 'asc' }] });

      const rows: Array<Record<string, unknown>> = [];
      if (withNatal) {
        const natal = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, NOT: [{ data_type: { startsWith: 'annual.' } }, { data_type: { startsWith: 'dasha.' } }] },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...natal.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      if (withDasha) {
        const dasha = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, data_type: { startsWith: 'dasha.' } },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...dasha.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      if (withAnnual) {
        const yearFilter = years?.length ? { OR: [{ variant: 'current' }, ...years.flatMap((y) => [{ variant: `year=${y}` }, { variant: { startsWith: `year=${y};` } }])] } : {};
        const annual = await deps.prisma.kundliData.findMany({
          where: { kundli_id: k.id, data_type: { startsWith: 'annual.' }, ...yearFilter },
          select: { ...META_SELECT, payload: true },
          orderBy: [{ data_type: 'asc' }, { variant: 'asc' }],
        });
        rows.push(...annual.map((r) => rowOut(r as RowMeta & { payload: unknown }, true)));
      }
      const digest =
        part === 'digest' || part === 'all'
          ? (await deps.prisma.kundliDigest.findMany({ where: { kundli_id: k.id }, orderBy: [{ section: 'asc' }, { key: 'asc' }] })).map((d) => ({
              section: d.section,
              key: d.key,
              row: d.row,
              source: d.source,
              digestVersion: d.digest_version,
              builtAt: iso(d.built_at),
            }))
          : null;
      const activation =
        part === 'activation' || part === 'all'
          ? (await deps.prisma.kundliActivation.findMany({ where: { kundli_id: k.id }, orderBy: [{ system: 'asc' }, { level: 'asc' }, { from_date: 'asc' }] })).map((x) => ({
              system: x.system,
              family: x.family,
              level: x.level,
              lord: x.lord,
              sign: x.sign,
              from: day(x.from_date),
              to: day(x.to_date),
              houses: x.houses,
              parentLord: x.parent_lord,
              digestVersion: x.digest_version,
            }))
          : null;
      const transit = part === 'transit' && win ? await loadTransit(deps.prisma, k.id, win, place) : null;
      const kr = k as typeof k & Record<string, unknown>;
      const legacy = withNatal ? Object.fromEntries(LEGACY_COLUMNS.map((c) => [c, kr[c] ?? null])) : null;
      return void res.json({
        person,
        kundli: {
          id: k.id,
          createdAt: iso(k.created_at),
          lat: k.lat,
          lon: k.lon,
          tz: k.tz,
          placeResolved: k.place_resolved,
          queueStatus: k.queue_status,
          queueCompletedAt: iso(k.queue_completed_at),
          lastSyncError: k.last_sync_error,
          factsStatus: k.facts_status,
          digestStatus: k.digest_status,
          digestVersion: k.digest_version,
          digestBuiltAt: iso(k.digest_built_at),
          digestError: k.digest_error,
          preferredDasha: k.preferred_dasha,
        },
        types,
        index: index.map((r) => rowOut(r as RowMeta, false)),
        part,
        years,
        rows,
        legacy,
        digest,
        activation,
        transit,
        servedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[admin-lab] chart-data', (e as Error).message);
      return void res.status(503).json({ error: 'chart_data_unavailable' });
    }
  };
}
