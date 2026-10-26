/**
 * The transit chart (Radha export type `transit`, change class `moving`; docs/reading-engine/23 §3).
 *
 * A transit depends on the moment asked for, so it is never stored per person: ensureChartData refuses it and callers
 * come here instead. One Radha call through the shared export client (so the start-to-start spacing and the engine's
 * rate limit are respected), payload returned as is, nothing written to kundli_data. Nothing here computes astrology.
 *
 * The transit is cast for the person's birth place (the only place the server knows for them). `withNatal` adds the
 * kundli's birth data as Radha's `natal_*` fields so each transiting planet carries its natal house.
 */
import { fetchEngineExport } from '../../lib/astroKundliClient.js';
import { VARGA_FACTORS } from './catalog.js';
import type { ChartDataRepo, KundliRequest, RadhaFetcher } from './store.js';

export interface TransitOptions {
  /** The moment: a Date, or Radha's format ('YYYY-MM-DD HH:MM:SS' in place-local time, or ISO 8601 with offset). Past or future. */
  at: Date | string;
  /** Divisional chart of the transit (default 1 = rasi); one of pyjhora's `division_chart_factors` */
  divisionalChartFactor?: number;
  /** Send the kundli's birth data so Radha adds each planet's natal house */
  withNatal?: boolean;
}

export interface TransitDeps {
  /** Only `kundliRequest` is used: birth data and stored coordinates. Defaults to the Prisma repo. */
  repo?: Pick<ChartDataRepo, 'kundliRequest'>;
  /** Defaults to Radha's export endpoint through the throttled client */
  fetcher?: RadhaFetcher;
}

/** Radha's `at` pattern (transit_export._AT_PATTERN): checked here so a bad value fails without a round trip. */
const AT_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/;
const FACTORS = new Set<number>(VARGA_FACTORS);

export function transitAt(at: Date | string): string {
  if (at instanceof Date) {
    if (Number.isNaN(at.getTime())) throw new Error('fetchTransit: at is not a valid date');
    return at.toISOString();
  }
  const s = typeof at === 'string' ? at.trim() : '';
  if (!AT_PATTERN.test(s)) throw new Error(`fetchTransit: at must be 'YYYY-MM-DD HH:MM:SS' or ISO 8601 with offset, got ${JSON.stringify(at)}`);
  return s;
}

/** The request fields Radha's transit export takes, on top of the place (birth place or its stored coordinates). */
export function transitRequestFields(req: KundliRequest, opts: TransitOptions): Record<string, unknown> {
  const factor = opts.divisionalChartFactor ?? 1;
  if (!Number.isInteger(factor) || !FACTORS.has(factor)) throw new Error(`fetchTransit: divisionalChartFactor must be one of ${VARGA_FACTORS.join(', ')}`);
  const fields: Record<string, unknown> = { ...(req.coords ?? {}), at: transitAt(opts.at), divisional_chart_factor: factor };
  if (opts.withNatal) {
    fields.natal_dob = req.params.dob;
    fields.natal_tob = req.params.tob;
    fields.natal_place = req.params.place;
    if (req.coords) {
      fields.natal_lat = req.coords.lat;
      fields.natal_lon = req.coords.lon;
      fields.natal_tz = req.coords.tz;
    }
  }
  return fields;
}

const defaultTransitFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, extra);

async function defaultRepo(): Promise<Pick<ChartDataRepo, 'kundliRequest'>> {
  const [{ prisma }, { prismaChartDataRepo }] = await Promise.all([import('../../lib/prisma.js'), import('./store.js')]);
  return prismaChartDataRepo(prisma);
}

/** Fetch the transit chart for a kundli at a moment. Not stored; each call is one Radha request. */
export async function fetchTransit(kundliId: string, opts: TransitOptions, deps: TransitDeps = {}): Promise<unknown> {
  const repo = deps.repo ?? (await defaultRepo());
  const req = await repo.kundliRequest(kundliId);
  if (!req) throw new Error('fetchTransit: kundli or birth details not found');
  const fields = transitRequestFields(req, opts);
  return (deps.fetcher ?? defaultTransitFetcher)(req, 'transit', fields);
}
