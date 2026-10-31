/**
 * Kundli-independent transit cache (docs/reading-engine/35). The sky at an instant, for a place and a set of divisional
 * charts, is the same for every kundli, so it is fetched from Radha once and shared. Nothing here computes astrology:
 * keys are clock and coordinate arithmetic, and houses are only ever looked up from values Radha itself returned.
 *
 * Three stores:
 * - `transit_instants`: one snapshot per (place, instant, factors, ayanamsa), payload WITHOUT natal fields.
 * - `transit_range_skies`: one `transit_range` per (place, from, to, step, planets, flags), payload WITHOUT natal fields.
 * - `kundli_transit_overlays`: per-kundli answers Radha computed against the natal chart (range or contacts), which is
 *   where `house_from_lagna` / `house_from_moon` / `natal_house` come from. Never derived in Node.
 *
 * The repository is a seam: raw SQL in production (works before the Prisma client knows the models; a missing table
 * degrades to a plain Radha call, nothing breaks), in-memory in tests.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { roundPlace, type AtPlace } from '../chartData/place.js';
import { isMissingTable } from '../chartData/store.js';
import { fetchTransit, type VargaFactors } from '../chartData/transit.js';
import { fetchTransitRange, type TransitRangeOptions, type TransitRangePayload } from '../chartData/transitRange.js';

export const DEFAULT_AYANAMSA = 'LAHIRI';

// ---------------------------------------------------------------------------------------------------------- keys

/** Two-decimal coordinates plus offset: the same place always gives the same key. */
export function placeKey(p: AtPlace): string {
  const r = roundPlace(p);
  return `${r.lat.toFixed(2)},${r.lon.toFixed(2)},${r.tz}`;
}

export function factorsKey(factors: VargaFactors | undefined): string {
  if (factors === undefined) return '1';
  if (factors === 'd1-d10') return 'd1-d10';
  return [...new Set(factors)].sort((a, b) => a - b).join(',');
}

/** An instant as a UTC Date. Accepts a Date or an ISO string WITH an offset; a bare local time is refused (it would be ambiguous). */
export function instantOf(at: Date | string): Date {
  if (at instanceof Date) {
    if (Number.isNaN(at.getTime())) throw new Error('transit cache: at is not a valid date');
    return at;
  }
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(at.trim())) throw new Error(`transit cache: at needs an offset (e.g. 2027-03-01T12:00:00-08:00), got ${JSON.stringify(at)}`);
  const d = new Date(at.trim());
  if (Number.isNaN(d.getTime())) throw new Error(`transit cache: at is not a valid date: ${JSON.stringify(at)}`);
  return d;
}

export interface SnapshotKey {
  placeKey: string;
  atUtc: Date;
  factorsKey: string;
  ayanamsa: string;
}

export function snapshotKey(at: Date | string, place: AtPlace, factors?: VargaFactors, ayanamsa = DEFAULT_AYANAMSA): SnapshotKey {
  return { placeKey: placeKey(place), atUtc: instantOf(at), factorsKey: factorsKey(factors), ayanamsa };
}

export interface RangeKey {
  placeKey: string;
  from: string;
  to: string;
  planetsKey: string;
  flagsKey: string;
  ayanamsa: string;
}

export function rangeKey(opts: TransitRangeOptions, place: AtPlace, ayanamsa = DEFAULT_AYANAMSA): RangeKey {
  return {
    placeKey: placeKey(place),
    from: opts.from,
    to: opts.to,
    planetsKey: [...new Set(opts.planets ?? ['Sa', 'Ju', 'Ra', 'Ke'])].sort().join(','),
    flagsKey: `l${opts.lunations === false ? 0 : 1}e${opts.eclipses === false ? 0 : 1}`,
    ayanamsa,
  };
}

/** Stable hash of a payload, to see whether Radha's answer for the same key ever changes. */
export function sourceHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex').slice(0, 16);
}

// ------------------------------------------------------------------------------------------- natal-field stripping

/** True for a field that exists only because a kundli was sent along: `natal_*` keys and the range `natal` block. */
const isNatalField = (k: string): boolean => k === 'natal' || k.startsWith('natal_');

/** The payload with every natal-dependent field removed, at any depth. Pure; the input is not changed. */
export function stripNatal<T>(payload: T): T {
  if (Array.isArray(payload)) return payload.map((x) => stripNatal(x)) as unknown as T;
  if (payload && typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) if (!isNatalField(k)) out[k] = stripNatal(v);
    return out as T;
  }
  return payload;
}

/** Fields of a `transit_range` answer that exist because of the kundli it was asked for: houses, Sade Sati, dhaiya. */
const isRangePersonField = (k: string): boolean =>
  isNatalField(k) || k === 'house_from_lagna' || k === 'house_from_moon' || k === 'sade_sati' || k === 'dhaiya' || k.endsWith('_houses');

/** A `transit_range` answer reduced to the sky: nothing in it belongs to one person. Pure; the input is not changed. */
export function stripRangeToSky<T>(payload: T): T {
  if (Array.isArray(payload)) return payload.map((x) => stripRangeToSky(x)) as unknown as T;
  if (payload && typeof payload === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) if (!isRangePersonField(k)) out[k] = stripRangeToSky(v);
    return out as T;
  }
  return payload;
}

// ----------------------------------------------------------------------------------------------------- repository

export interface CachedRow<T> {
  payload: T;
  calcVersion: string | null;
  sourceHash: string;
  fetchedAt: Date;
}

export type OverlayKind = 'range' | 'contacts';

export interface OverlayKey {
  kundliId: string;
  kind: OverlayKind;
  paramsKey: string;
}

export interface EphemerisRepo {
  getSnapshot(key: SnapshotKey): Promise<CachedRow<unknown> | null>;
  putSnapshot(key: SnapshotKey, place: AtPlace, row: { payload: unknown; calcVersion: string | null }): Promise<void>;
  getRange(key: RangeKey): Promise<CachedRow<TransitRangePayload> | null>;
  putRange(key: RangeKey, place: AtPlace, row: { payload: TransitRangePayload; calcVersion: string | null }): Promise<void>;
  getOverlay(key: OverlayKey): Promise<CachedRow<unknown> | null>;
  putOverlay(key: OverlayKey, row: { from: string; to: string; payload: unknown; calcVersion: string | null }): Promise<void>;
}

function calcVersionOf(payload: unknown): string | null {
  const p = payload as { calc_version?: unknown; meta?: { calc_version?: unknown } } | null;
  const v = p?.calc_version ?? p?.meta?.calc_version;
  return v == null ? null : String(v);
}

/** Raw-SQL repository (like prashna_casts): no dependency on the generated client knowing the models. */
export function prismaEphemerisRepo(prisma: PrismaClient): EphemerisRepo {
  type Row = { payload: unknown; calc_version: string | null; source_hash: string; fetched_at: Date };
  const toRow = <T>(r: Row | undefined): CachedRow<T> | null => (r ? { payload: r.payload as T, calcVersion: r.calc_version, sourceHash: r.source_hash, fetchedAt: r.fetched_at } : null);
  return {
    async getSnapshot(k) {
      const rows = await prisma.$queryRaw<Row[]>`SELECT "payload", "calc_version", "source_hash", "fetched_at" FROM "transit_instants"
        WHERE "place_key" = ${k.placeKey} AND "at_utc" = ${k.atUtc} AND "factors_key" = ${k.factorsKey} AND "ayanamsa" = ${k.ayanamsa} LIMIT 1`;
      return toRow(rows[0]);
    },
    async putSnapshot(k, place, row) {
      const r = roundPlace(place);
      await prisma.$executeRaw`INSERT INTO "transit_instants" ("place_key", "lat", "lon", "tz", "at_utc", "factors_key", "ayanamsa", "calc_version", "source_hash", "payload")
        VALUES (${k.placeKey}, ${r.lat}, ${r.lon}, ${r.tz}, ${k.atUtc}, ${k.factorsKey}, ${k.ayanamsa}, ${row.calcVersion}, ${sourceHash(row.payload)}, ${JSON.stringify(row.payload ?? null)}::jsonb)
        ON CONFLICT ("place_key", "at_utc", "factors_key", "ayanamsa") DO NOTHING`;
    },
    async getRange(k) {
      const rows = await prisma.$queryRaw<Row[]>`SELECT "payload", "calc_version", "source_hash", "fetched_at" FROM "transit_range_skies"
        WHERE "place_key" = ${k.placeKey} AND "from_date" = ${k.from}::date AND "to_date" = ${k.to}::date AND "planets_key" = ${k.planetsKey}
          AND "flags_key" = ${k.flagsKey} AND "ayanamsa" = ${k.ayanamsa} LIMIT 1`;
      return toRow(rows[0]);
    },
    async putRange(k, place, row) {
      const r = roundPlace(place);
      await prisma.$executeRaw`INSERT INTO "transit_range_skies" ("place_key", "lat", "lon", "tz", "from_date", "to_date", "planets_key", "flags_key", "ayanamsa", "calc_version", "source_hash", "payload")
        VALUES (${k.placeKey}, ${r.lat}, ${r.lon}, ${r.tz}, ${k.from}::date, ${k.to}::date, ${k.planetsKey}, ${k.flagsKey}, ${k.ayanamsa}, ${row.calcVersion}, ${sourceHash(row.payload)}, ${JSON.stringify(row.payload ?? null)}::jsonb)
        ON CONFLICT ("place_key", "from_date", "to_date", "planets_key", "flags_key", "ayanamsa") DO NOTHING`;
    },
    async getOverlay(k) {
      const rows = await prisma.$queryRaw<Row[]>`SELECT "payload", "calc_version", "source_hash", "fetched_at" FROM "kundli_transit_overlays"
        WHERE "kundli_id" = ${k.kundliId} AND "kind" = ${k.kind} AND "params_key" = ${k.paramsKey} LIMIT 1`;
      return toRow(rows[0]);
    },
    async putOverlay(k, row) {
      await prisma.$executeRaw`INSERT INTO "kundli_transit_overlays" ("kundli_id", "kind", "params_key", "from_date", "to_date", "calc_version", "source_hash", "payload")
        VALUES (${k.kundliId}, ${k.kind}, ${k.paramsKey}, ${row.from}::date, ${row.to}::date, ${row.calcVersion}, ${sourceHash(row.payload)}, ${JSON.stringify(row.payload ?? null)}::jsonb)
        ON CONFLICT ("kundli_id", "kind", "params_key") DO NOTHING`;
    },
  };
}

async function defaultRepo(): Promise<EphemerisRepo> {
  const { prisma } = await import('../../lib/prisma.js');
  return prismaEphemerisRepo(prisma);
}

// ------------------------------------------------------------------------------------------------------ read path

export interface EphemerisDeps {
  repo?: EphemerisRepo;
  /** The Radha call for a miss (default: fetchTransit at the place, no natal fields) */
  fetchSnapshot?: (at: string, place: AtPlace, factors: VargaFactors | undefined) => Promise<unknown>;
  fetchRange?: (opts: TransitRangeOptions, kundliId: string) => Promise<TransitRangePayload>;
}

let warnedMissing = false;
/** For tests: let the next missing-table miss log again. */
export function resetEphemerisWarning(): void {
  warnedMissing = false;
}

function warnStore(err: unknown, what: string): void {
  if (isMissingTable(err)) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(JSON.stringify({ msg: 'transit cache tables missing; calling Radha directly (migration applied?)', what }));
    }
  } else {
    console.warn(JSON.stringify({ msg: 'transit cache store failed; calling Radha directly', what, error: String((err as Error)?.message ?? err).slice(0, 200) }));
  }
}

const inflight = new Map<string, Promise<unknown>>();
/** One Radha call at a time per key inside this process: concurrent askers wait for the first. */
function coalesce<T>(key: string, run: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export interface SnapshotResult {
  payload: unknown;
  source: 'cache' | 'radha';
}

/**
 * The sky at an instant for a place: stored once, shared by every kundli. `at` needs an offset (ISO) or is a Date.
 * The stored and returned payload has no natal fields; the per-kundli layer adds houses from a Radha overlay.
 */
export async function getTransitSnapshot(at: Date | string, place: AtPlace, factors?: VargaFactors, deps: EphemerisDeps = {}): Promise<SnapshotResult> {
  const key = snapshotKey(at, place, factors);
  const repo = deps.repo ?? (await defaultRepo());
  let stored = true;
  try {
    const hit = await repo.getSnapshot(key);
    if (hit) return { payload: hit.payload, source: 'cache' };
  } catch (err) {
    stored = false;
    warnStore(err, 'read snapshot');
  }
  const id = `s|${key.placeKey}|${key.atUtc.toISOString()}|${key.factorsKey}|${key.ayanamsa}`;
  const payload = await coalesce(id, async () => {
    const raw = await (deps.fetchSnapshot ?? defaultFetchSnapshot)(key.atUtc.toISOString(), place, factors);
    return stripNatal(raw);
  });
  if (stored) await repo.putSnapshot(key, place, { payload, calcVersion: calcVersionOf(payload) }).catch((err) => warnStore(err, 'write snapshot'));
  return { payload, source: 'radha' };
}

const defaultFetchSnapshot = (at: string, place: AtPlace, factors: VargaFactors | undefined): Promise<unknown> =>
  fetchTransit(null, { at, place, ...(factors === undefined ? {} : Array.isArray(factors) || factors === 'd1-d10' ? { divisionalChartFactors: factors } : {}) });

/**
 * The dated sky over a range at a place (no natal fields), shared by every kundli. The Radha call needs a kundli to
 * name the birth place, so `anyKundliId` is any kundli whose birth place is the place asked for; everything that belongs
 * to that person (natal block, houses, Sade Sati, dhaiya) is removed before it is stored.
 */
export async function getSharedRange(opts: TransitRangeOptions, place: AtPlace, anyKundliId: string, deps: EphemerisDeps = {}): Promise<{ payload: TransitRangePayload; source: 'cache' | 'radha' }> {
  const key = rangeKey(opts, place);
  const repo = deps.repo ?? (await defaultRepo());
  let stored = true;
  try {
    const hit = await repo.getRange(key);
    if (hit) return { payload: hit.payload, source: 'cache' };
  } catch (err) {
    stored = false;
    warnStore(err, 'read range');
  }
  const id = `r|${key.placeKey}|${key.from}|${key.to}|${key.planetsKey}|${key.flagsKey}`;
  const payload = await coalesce(id, async () => {
    const raw = await (deps.fetchRange ?? ((o, k) => fetchTransitRange(k, o)))(opts, anyKundliId);
    return stripRangeToSky(raw);
  });
  if (stored) await repo.putRange(key, place, { payload, calcVersion: calcVersionOf(payload) }).catch((err) => warnStore(err, 'write range'));
  return { payload, source: 'radha' };
}

// ------------------------------------------------------------------------------------------ per-kundli overlay

/** The key under which a kundli's own range/contacts answer is stored. */
export function overlayParamsKey(opts: { from: string; to: string; planets?: readonly string[]; orb?: number }): string {
  return [opts.from, opts.to, [...new Set(opts.planets ?? [])].sort().join(','), opts.orb ?? ''].join('|');
}

/**
 * The kundli's own range (or contacts) answer from Radha, with its natal house fields. Stored per kundli, so asking for
 * the same span again never calls Radha. This is where every `house_from_lagna` / `house_from_moon` / `natal_house`
 * comes from: Radha computes them, Node only reads them.
 */
export async function getKundliOverlay<T>(
  kundliId: string,
  kind: OverlayKind,
  span: { from: string; to: string; planets?: readonly string[]; orb?: number },
  fetchFromRadha: () => Promise<T>,
  deps: EphemerisDeps = {},
): Promise<{ payload: T; source: 'cache' | 'radha' }> {
  const key: OverlayKey = { kundliId, kind, paramsKey: overlayParamsKey(span) };
  const repo = deps.repo ?? (await defaultRepo());
  let stored = true;
  try {
    const hit = await repo.getOverlay(key);
    if (hit) return { payload: hit.payload as T, source: 'cache' };
  } catch (err) {
    stored = false;
    warnStore(err, 'read overlay');
  }
  const payload = await coalesce(`o|${kundliId}|${kind}|${key.paramsKey}`, fetchFromRadha);
  if (stored) await repo.putOverlay(key, { from: span.from, to: span.to, payload, calcVersion: calcVersionOf(payload) }).catch((err) => warnStore(err, 'write overlay'));
  return { payload, source: 'radha' };
}

export interface RadhaHouses {
  house_from_lagna: number;
  house_from_moon: number;
}

/**
 * The houses Radha gave for a planet on a date, read from the kundli's stored range answer: the sign stay that covers
 * the date. A lookup of returned values, no arithmetic. Null when the range does not cover the date or planet.
 */
export function housesFromOverlay(overlay: Pick<TransitRangePayload, 'ingresses'>, planet: string, date: string): RadhaHouses | null {
  for (const r of overlay.ingresses) {
    if (r.planet === planet && r.from <= date && date <= r.to) return { house_from_lagna: r.house_from_lagna, house_from_moon: r.house_from_moon };
  }
  return null;
}

// -------------------------------------------------------------------------------------------------------- backfill

/**
 * Seed the cache from a payload pulled earlier (files in the notes folder). The natal fields are stripped on insert.
 * Returns false when the key was already stored.
 */
export async function ingestSnapshot(at: Date | string, place: AtPlace, factors: VargaFactors | undefined, payload: unknown, deps: EphemerisDeps = {}): Promise<boolean> {
  const key = snapshotKey(at, place, factors);
  const repo = deps.repo ?? (await defaultRepo());
  if (await repo.getSnapshot(key)) return false;
  const clean = stripNatal(payload);
  await repo.putSnapshot(key, place, { payload: clean, calcVersion: calcVersionOf(clean) });
  return true;
}
