/**
 * The dated sky over a long span (Radha export type `transit_range`, change class `moving`; AIAstra_Radha
 * docs/transit-range.md): sign stays of the slow planets, stations, new and full Moons, eclipses and Sade Sati phases for up
 * to ~40 years, with the houses from the natal lagna and Moon. Feeds the life timeline's transit layer (docs 27 and 29).
 *
 * It depends on the range asked for, so like `transit` it is never stored per person: ensureChartData refuses it and
 * callers come here. One Radha call through the shared export client; the payload is returned as is. Nothing here computes
 * astrology; this file only builds the request and checks the payload's outline.
 */
import { fetchEngineExport, fetchEngineExportAtPlace } from '../../lib/astroKundliClient.js';
import { roundPlace, type AtPlace } from './place.js';
import type { ChartDataRepo, RadhaFetcher } from './store.js';

export const TRANSIT_RANGE_TYPE = 'transit_range';
export const RANGE_PLANETS = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'] as const;
export type RangePlanet = (typeof RANGE_PLANETS)[number];
/** Radha's limit (transit_range_export.MAX_SPAN_DAYS) */
export const TRANSIT_RANGE_MAX_DAYS = 14_700;
/** and with `step: 'day'` (transit_export: about 2 years) */
export const TRANSIT_RANGE_MAX_DAILY_DAYS = 730;

export interface TransitRangeOptions {
  /** 'YYYY-MM-DD', birth-place local */
  from: string;
  to: string;
  /** `month` (default, one row on the 1st of each month) or `day` (a row every day, at most ~2 years) */
  step?: 'month' | 'day';
  /** Default (Radha): Sa, Ju, Ra, Ke. The Moon only with `step: 'day'` */
  planets?: RangePlanet[];
  /** Default true */
  lunations?: boolean;
  eclipses?: boolean;
}

export interface TransitRangeDeps {
  repo?: Pick<ChartDataRepo, 'kundliRequest'>;
  fetcher?: RadhaFetcher;
}

export interface RangeIngress {
  planet: string;
  planet_name?: string;
  sign: string;
  sign_index: number;
  from: string;
  to: string;
  starts_before_range?: boolean;
  ends_after_range?: boolean;
  retro_on_entry: boolean | null;
  house_from_lagna: number;
  house_from_moon: number;
}
export interface RangeStation {
  planet: string;
  kind: 'retrograde' | 'direct';
  date: string;
  longitude: number;
  sign: string;
  sign_index: number;
  house_from_lagna: number;
  house_from_moon: number;
}
export interface RangeLunation {
  kind: 'new' | 'full';
  date: string;
  sign: string;
  sign_index: number;
  degree: number;
  nakshatra: string;
  pada: number;
  house_from_lagna: number;
  house_from_moon: number;
}
export interface RangeEclipse {
  kind: 'solar' | 'lunar';
  type: string;
  date: string;
  sign: string;
  sign_index: number;
  degree: number;
  nakshatra: string;
  house_from_lagna: number;
  house_from_moon: number;
}
export interface RangeSpan {
  phase: string;
  saturn_sign: string;
  from: string;
  to: string;
  starts_before_range?: boolean;
  ends_after_range?: boolean;
}

export interface TransitRangePayload {
  from: string;
  to: string;
  planets: string[];
  natal: { lagna_sign: string; lagna_sign_index: number; moon_sign: string; moon_sign_index: number };
  ingresses: RangeIngress[];
  stations: RangeStation[];
  lunations: RangeLunation[];
  eclipses: RangeEclipse[];
  sade_sati: RangeSpan[];
  dhaiya: RangeSpan[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The `params` object Radha's transit_range export takes. Throws on a bad option before any round trip. */
export function transitRangeParams(opts: TransitRangeOptions): Record<string, unknown> {
  if (!DATE.test(opts.from) || !DATE.test(opts.to) || opts.to < opts.from) throw new Error(`fetchTransitRange: from/to must be 'YYYY-MM-DD' with from <= to, got ${opts.from}..${opts.to}`);
  const days = Math.round((Date.parse(opts.to) - Date.parse(opts.from)) / 86_400_000);
  if (days > TRANSIT_RANGE_MAX_DAYS) throw new Error(`fetchTransitRange: ${days} days is more than the ${TRANSIT_RANGE_MAX_DAYS}-day limit`);
  if (opts.step !== undefined && opts.step !== 'month' && opts.step !== 'day') throw new Error(`fetchTransitRange: step must be 'month' or 'day', got ${JSON.stringify(opts.step)}`);
  if (opts.step === 'day' && days > TRANSIT_RANGE_MAX_DAILY_DAYS) throw new Error(`fetchTransitRange: ${days} days is more than the ${TRANSIT_RANGE_MAX_DAILY_DAYS}-day limit with step 'day'`);
  if (opts.planets?.includes('Mo') && opts.step !== 'day') throw new Error("fetchTransitRange: the Moon needs step 'day'");
  const params: Record<string, unknown> = { from: opts.from, to: opts.to };
  if (opts.step) params.step = opts.step;
  if (opts.planets?.length) params.planets = [...opts.planets];
  if (opts.lunations != null) params.lunations = opts.lunations;
  if (opts.eclipses != null) params.eclipses = opts.eclipses;
  return params;
}

/** Outline check of Radha's answer (the fields the timeline reads); null when it does not look like a transit_range payload. */
export function asRangePayload(raw: unknown): TransitRangePayload | null {
  const p = raw as Partial<TransitRangePayload> | null;
  if (!p || typeof p !== 'object' || typeof p.from !== 'string' || typeof p.to !== 'string' || !p.natal || typeof p.natal !== 'object') return null;
  for (const k of ['ingresses', 'stations', 'lunations', 'eclipses', 'sade_sati', 'dhaiya'] as const) if (!Array.isArray(p[k])) return null;
  const ok =
    p.ingresses!.every((r) => r && typeof r.planet === 'string' && typeof r.sign === 'string' && typeof r.from === 'string' && typeof r.to === 'string') &&
    p.stations!.every((r) => r && typeof r.planet === 'string' && typeof r.date === 'string' && typeof r.longitude === 'number');
  return ok ? (p as TransitRangePayload) : null;
}

async function defaultRepo(): Promise<Pick<ChartDataRepo, 'kundliRequest'>> {
  const [{ prisma }, { prismaChartDataRepo }] = await Promise.all([import('../../lib/prisma.js'), import('./store.js')]);
  return prismaChartDataRepo(prisma);
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, extra);

/** Fetch the dated sky for a kundli over a date range. Not stored; each call is one Radha request (about 3 s for 36 years). */
export async function fetchTransitRange(kundliId: string, opts: TransitRangeOptions, deps: TransitRangeDeps = {}): Promise<TransitRangePayload> {
  const params = transitRangeParams(opts);
  const repo = deps.repo ?? (await defaultRepo());
  const req = await repo.kundliRequest(kundliId);
  if (!req) throw new Error('fetchTransitRange: kundli or birth details not found');
  const raw = await (deps.fetcher ?? defaultFetcher)(req, TRANSIT_RANGE_TYPE, { ...(req.coords ?? {}), params });
  const payload = asRangePayload(raw);
  if (!payload) throw new Error('fetchTransitRange: Radha response is not a transit_range payload');
  return payload;
}

export interface SharedSkyDeps {
  /** A Radha call with no birth data: the type and the fields (place, params). Default: the throttled export client. */
  placeFetcher?: (radhaType: string, fields: Record<string, unknown>) => Promise<unknown>;
}

/**
 * The dated sky at a place with NO person: the request carries the place and the options only, so the answer has no natal
 * block, no houses, no Sade Sati. It is the same for every kundli (docs/reading-engine/35) and is stored once.
 */
export async function fetchSharedSkyRange(place: AtPlace, opts: TransitRangeOptions, deps: SharedSkyDeps = {}): Promise<TransitRangePayload> {
  const params = transitRangeParams(opts);
  const raw = await (deps.placeFetcher ?? fetchEngineExportAtPlace)(TRANSIT_RANGE_TYPE, { ...roundPlace(place), params });
  const payload = asRangePayload(raw) ?? asSkyOnlyPayload(raw);
  if (!payload) throw new Error('fetchSharedSkyRange: Radha response is not a transit_range payload');
  return payload;
}

/** A person-free answer has `natal: null`, which `asRangePayload` refuses; accept it when the rest has the range shape. */
function asSkyOnlyPayload(raw: unknown): TransitRangePayload | null {
  const p = raw as { natal?: unknown } | null;
  if (!p || typeof p !== 'object' || p.natal !== null) return null;
  return asRangePayload({ ...p, natal: {} });
}
