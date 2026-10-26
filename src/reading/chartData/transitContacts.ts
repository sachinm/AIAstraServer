/**
 * Natal-degree contacts of slow transits (Radha export type `transit_contacts`, change class `moving`; AIAstra_Radha
 * docs/transit-contacts.md): for a date range, when Saturn/Jupiter/Rahu/Ketu (Mars on request) come within an orb of a
 * natal planet or the lagna, with entry, exact hit(s), exit and any station inside the orb.
 *
 * It depends on the range asked for, so like `transit` it is never stored per person: ensureChartData refuses it and
 * callers come here. One Radha call through the shared export client, payload returned as is. Nothing here computes
 * astrology; this file only builds the request and checks the payload's outline.
 */
import { fetchEngineExport } from '../../lib/astroKundliClient.js';
import type { ChartDataRepo, RadhaFetcher } from './store.js';

export const TRANSIT_CONTACTS_TYPE = 'transit_contacts';
/** Radha's transit planet codes (transit_contacts_export.TRANSIT_PLANETS) */
export const CONTACT_PLANETS = ['Ma', 'Ju', 'Sa', 'Ra', 'Ke'] as const;
export type ContactPlanet = (typeof CONTACT_PLANETS)[number];

export interface TransitContactsOptions {
  /** 'YYYY-MM-DD', birth-place local; at most 3660 days apart (Radha's limit) */
  from: string;
  to: string;
  /** Degrees, 0.5..5; Radha's default is 2 */
  orb?: number;
  /** Default (Radha): Sa, Ju, Ra, Ke */
  planets?: ContactPlanet[];
}

export interface TransitContactsDeps {
  /** Only `kundliRequest` is used: birth data and stored coordinates. Defaults to the Prisma repo. */
  repo?: Pick<ChartDataRepo, 'kundliRequest'>;
  fetcher?: RadhaFetcher;
}

/** One contact as Radha returns it */
export interface RadhaContact {
  transit: string;
  transit_name?: string;
  natal: string;
  natal_name?: string;
  natal_sign?: string;
  natal_longitude?: number;
  natal_house: number;
  orb_deg: number;
  closest?: string;
  from: string;
  to: string;
  starts_before_range?: boolean;
  ends_after_range?: boolean;
  exact: string[];
  station_in_orb: boolean;
  stations: Array<{ date: string; kind: string; orb_deg: number }>;
}

export interface TransitContactsPayload {
  from: string;
  to: string;
  orb: number;
  planets: string[];
  natal_points?: Array<{ code: string; name: string; sign: string; sign_index: number; longitude: number; house: number }>;
  contacts: RadhaContact[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The `params` object Radha's transit_contacts export takes. Throws on a bad option before any round trip. */
export function transitContactsParams(opts: TransitContactsOptions): Record<string, unknown> {
  if (!DATE.test(opts.from) || !DATE.test(opts.to) || opts.to < opts.from) throw new Error(`fetchTransitContacts: from/to must be 'YYYY-MM-DD' with from <= to, got ${opts.from}..${opts.to}`);
  if (opts.orb != null && !(Number.isFinite(opts.orb) && opts.orb >= 0.5 && opts.orb <= 5)) throw new Error('fetchTransitContacts: orb must be between 0.5 and 5');
  const params: Record<string, unknown> = { from: opts.from, to: opts.to };
  if (opts.orb != null) params.orb = opts.orb;
  if (opts.planets?.length) params.planets = [...opts.planets];
  return params;
}

/** Outline check of Radha's answer (the fields the pack reads); null when it does not look like a contacts payload. */
export function asContactsPayload(raw: unknown): TransitContactsPayload | null {
  const p = raw as Partial<TransitContactsPayload> | null;
  if (!p || typeof p !== 'object' || !Array.isArray(p.contacts) || typeof p.from !== 'string' || typeof p.to !== 'string') return null;
  const ok = p.contacts.every(
    (c) => c && typeof c.transit === 'string' && typeof c.natal === 'string' && typeof c.from === 'string' && typeof c.to === 'string' && Array.isArray(c.exact) && Array.isArray(c.stations)
  );
  return ok ? (p as TransitContactsPayload) : null;
}

async function defaultRepo(): Promise<Pick<ChartDataRepo, 'kundliRequest'>> {
  const [{ prisma }, { prismaChartDataRepo }] = await Promise.all([import('../../lib/prisma.js'), import('./store.js')]);
  return prismaChartDataRepo(prisma);
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, extra);

/** Fetch the contacts for a kundli over a date range. Not stored; each call is one Radha request. */
export async function fetchTransitContacts(kundliId: string, opts: TransitContactsOptions, deps: TransitContactsDeps = {}): Promise<TransitContactsPayload> {
  const params = transitContactsParams(opts);
  const repo = deps.repo ?? (await defaultRepo());
  const req = await repo.kundliRequest(kundliId);
  if (!req) throw new Error('fetchTransitContacts: kundli or birth details not found');
  const raw = await (deps.fetcher ?? defaultFetcher)(req, TRANSIT_CONTACTS_TYPE, { ...(req.coords ?? {}), params });
  const payload = asContactsPayload(raw);
  if (!payload) throw new Error('fetchTransitContacts: Radha response is not a transit_contacts payload');
  return payload;
}
