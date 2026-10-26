/**
 * The transit chart (Radha export type `transit`, change class `moving`; docs/reading-engine/23 §3, 27 R-27b).
 *
 * A transit depends on the moment asked for, so it is never stored per person: ensureChartData refuses it and callers
 * come here instead. One Radha call through the shared export client (so the start-to-start spacing and the engine's
 * rate limit are respected), payload returned as is, nothing written to kundli_data. Nothing here computes astrology.
 *
 * Where: `place` (coordinates, rounded to two decimals) when given, otherwise the kundli's birth place. With a `place`
 * no person is needed at all (pass `null` as the kundli). `withNatal` adds the kundli's birth data as Radha's `natal_*`
 * fields so each transiting planet carries its natal house; it needs a kundli.
 *
 * Which vargas: `divisionalChartFactor` (one, default 1, response is that chart) or `divisionalChartFactors` (a list or
 * the shorthand 'd1-d10'; response is `charts: { d1: ..., d9: ... }`). Not both.
 */
import { fetchEngineExport, fetchEngineExportAtPlace } from '../../lib/astroKundliClient.js';
import { VARGA_FACTORS } from './catalog.js';
import { roundPlace, type AtPlace } from './place.js';
import type { ChartDataRepo, KundliRequest, RadhaFetcher } from './store.js';

export type VargaFactors = readonly number[] | 'd1-d10';

export interface TransitOptions {
  /** The moment: a Date, or Radha's format ('YYYY-MM-DD HH:MM:SS' in place-local time, or ISO 8601 with offset). Past or future. */
  at: Date | string;
  /** Divisional chart of the transit (default 1 = rasi); one of pyjhora's `division_chart_factors` */
  divisionalChartFactor?: number;
  /** Several divisional charts on one Julian day (R-27b): a list such as [1, 9, 10], or 'd1-d10' */
  divisionalChartFactors?: VargaFactors;
  /** Send the kundli's birth data so Radha adds each planet's natal house (needs a kundli) */
  withNatal?: boolean;
  /** Cast at these coordinates instead of the birth place (rounded to two decimals before sending) */
  place?: AtPlace;
}

/** A Radha call with no birth data: the type and the fields (place, moment, options). */
export type PlaceFetcher = (radhaType: string, fields: Record<string, unknown>) => Promise<unknown>;

export interface TransitDeps {
  /** Only `kundliRequest` is used: birth data and stored coordinates. Defaults to the Prisma repo. */
  repo?: Pick<ChartDataRepo, 'kundliRequest'>;
  /** Birth-place calls (no `place`). Defaults to Radha's export endpoint through the throttled client */
  fetcher?: RadhaFetcher;
  /** Calls at a given `place` (no birth data sent). Defaults to the same endpoint and throttle */
  placeFetcher?: PlaceFetcher;
}

/** Radha's `at` pattern (transit_export._AT_PATTERN): checked here so a bad value fails without a round trip. */
const AT_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/;
const FACTORS = new Set<number>(VARGA_FACTORS);

export function transitAt(at: Date | string, caller = 'fetchTransit'): string {
  if (at instanceof Date) {
    if (Number.isNaN(at.getTime())) throw new Error(`${caller}: at is not a valid date`);
    return at.toISOString();
  }
  const s = typeof at === 'string' ? at.trim() : '';
  if (!AT_PATTERN.test(s)) throw new Error(`${caller}: at must be 'YYYY-MM-DD HH:MM:SS' or ISO 8601 with offset, got ${JSON.stringify(at)}`);
  return s;
}

/** A checked list of factors (deduplicated, order kept) or the 'd1-d10' shorthand, as Radha's `divisional_chart_factors`. */
export function factorsField(factors: VargaFactors, caller = 'fetchTransit'): number[] | 'd1-d10' {
  if (factors === 'd1-d10') return factors;
  if (!Array.isArray(factors) || factors.length === 0) throw new Error(`${caller}: divisionalChartFactors must be a non-empty list or 'd1-d10'`);
  for (const f of factors) {
    if (!Number.isInteger(f) || !FACTORS.has(f)) throw new Error(`${caller}: divisionalChartFactors must be among ${VARGA_FACTORS.join(', ')}`);
  }
  return [...new Set(factors)];
}

function vargaFields(opts: TransitOptions): Record<string, unknown> {
  if (opts.divisionalChartFactors !== undefined) {
    if (opts.divisionalChartFactor !== undefined) throw new Error('fetchTransit: pass divisionalChartFactor or divisionalChartFactors, not both');
    return { divisional_chart_factors: factorsField(opts.divisionalChartFactors) };
  }
  const factor = opts.divisionalChartFactor ?? 1;
  if (!Number.isInteger(factor) || !FACTORS.has(factor)) throw new Error(`fetchTransit: divisionalChartFactor must be one of ${VARGA_FACTORS.join(', ')}`);
  return { divisional_chart_factor: factor };
}

/** The kundli's birth data as Radha's `natal_*` fields (adds `natal_house` to each planet row). */
export function natalFields(req: KundliRequest): Record<string, unknown> {
  return {
    natal_dob: req.params.dob,
    natal_tob: req.params.tob,
    natal_place: req.params.place,
    ...(req.coords ? { natal_lat: req.coords.lat, natal_lon: req.coords.lon, natal_tz: req.coords.tz } : {}),
  };
}

/** The request fields Radha's transit export takes, on top of the place (birth place or its stored coordinates). */
export function transitRequestFields(req: KundliRequest, opts: TransitOptions): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...(req.coords ?? {}), at: transitAt(opts.at), ...vargaFields(opts) };
  return opts.withNatal ? { ...fields, ...natalFields(req) } : fields;
}

/** The fields for a transit at a given place: rounded coordinates, the moment, the vargas, and the natal overlay if any. */
export function transitPlaceFields(place: AtPlace, opts: TransitOptions, natal: KundliRequest | null): Record<string, unknown> {
  return { ...roundPlace(place), at: transitAt(opts.at), ...vargaFields(opts), ...(natal ? natalFields(natal) : {}) };
}

const defaultTransitFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, extra);
export const defaultPlaceFetcher: PlaceFetcher = (radhaType, fields) => fetchEngineExportAtPlace(radhaType, fields);

async function defaultRepo(): Promise<Pick<ChartDataRepo, 'kundliRequest'>> {
  const [{ prisma }, { prismaChartDataRepo }] = await Promise.all([import('../../lib/prisma.js'), import('./store.js')]);
  return prismaChartDataRepo(prisma);
}

/**
 * Fetch the transit chart at a moment. Not stored; each call is one Radha request. `kundliId` may be null when a
 * `place` is given and no natal overlay is asked for: the kundli is then never read.
 */
export async function fetchTransit(kundliId: string | null, opts: TransitOptions, deps: TransitDeps = {}): Promise<unknown> {
  if (opts.place) {
    if (opts.withNatal && !kundliId) throw new Error('fetchTransit: withNatal needs a kundli');
    let natal: KundliRequest | null = null;
    if (opts.withNatal) {
      natal = await (deps.repo ?? (await defaultRepo())).kundliRequest(kundliId!);
      if (!natal) throw new Error('fetchTransit: kundli or birth details not found');
    }
    const fields = transitPlaceFields(opts.place, opts, natal);
    return (deps.placeFetcher ?? defaultPlaceFetcher)('transit', fields);
  }
  if (!kundliId) throw new Error('fetchTransit: pass a kundli or a place');
  const repo = deps.repo ?? (await defaultRepo());
  const req = await repo.kundliRequest(kundliId);
  if (!req) throw new Error('fetchTransit: kundli or birth details not found');
  const fields = transitRequestFields(req, opts);
  return (deps.fetcher ?? defaultTransitFetcher)(req, 'transit', fields);
}
