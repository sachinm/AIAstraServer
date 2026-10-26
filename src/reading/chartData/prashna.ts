/**
 * Prashna: the chart cast for the moment and place a question is asked (Radha export type `prashna`, change class
 * `moving`; docs/reading-engine/27 R-27c and §4). Nothing here computes astrology; Radha answers with the panchanga at the
 * moment, the prashna lagna (the rising sign at the moment, Sachin's decision: no user-picked number) and the planet rows
 * per varga.
 *
 * Where: the person's current location when the client sent it (`lat/lon/tz` on the ask / confirm routes), otherwise
 * the birth place (the kundli's stored coordinates, or the birth place text when none are stored). Coordinates are
 * rounded to two decimals before they are sent or stored.
 *
 * One Radha call through the shared export client (start-to-start spacing respected). The cast belongs to the question,
 * not the person, so it is stored in `prashna_casts` (migration M14) rather than kundli_data. When that table is not
 * there yet (migration not applied) the cast is still returned and the miss is logged once.
 */
import type { PrismaClient } from '@prisma/client';
import { roundPlace, type AtPlace } from './place.js';
import { isMissingTable, radhaLocalToDate, type KundliRequest } from './store.js';
import { defaultPlaceFetcher, factorsField, natalFields, transitAt, type PlaceFetcher, type VargaFactors } from './transit.js';

export type PlaceSource = 'current' | 'birth';

export interface PrashnaBirth {
  kundliId: string;
  req: KundliRequest;
  /** The kundli's resolved birth place name, when stored */
  placeResolved: string | null;
}

export interface PrashnaCastRow {
  userId: string;
  readingRunId: string | null;
  askedAt: Date;
  placeResolved: string | null;
  lat: number | null;
  lon: number | null;
  tz: number | null;
  placeSource: PlaceSource;
  calcVersion: string | null;
  payload: unknown;
}

/** Storage seam: raw SQL in production (works before the Prisma client knows the model), in-memory in tests. */
export interface PrashnaRepo {
  /** The person's latest kundli: birth data and stored coordinates. Null when there is none. */
  birth(userId: string): Promise<PrashnaBirth | null>;
  insertCast(row: PrashnaCastRow): Promise<{ id: string }>;
}

export interface CastPrashnaInput {
  userId: string;
  /** The question moment; default now. A Date, ISO 8601 with offset, or 'YYYY-MM-DD HH:MM:SS' local to the place. */
  at?: Date | string;
  /** The person's current location, already parsed (parseClientPlace); null/absent -> the birth place */
  place?: AtPlace | null;
  /** The reading run the question belongs to */
  runId?: string | null;
  /** Default [1, 9] (Radha's default, so not sent) */
  divisionalChartFactors?: VargaFactors;
  /** Add the birth data as `natal_*` so each planet row carries its natal house */
  withNatal?: boolean;
}

export interface PrashnaCast {
  payload: unknown;
  placeSource: PlaceSource;
  /** The rounded coordinates sent, or null when the birth place text was sent */
  place: AtPlace | null;
  placeResolved: string | null;
  askedAt: Date;
  /** `prashna_casts.id`, or null when the row could not be stored */
  castId: string | null;
}

export interface CastPrashnaDeps {
  repo?: PrashnaRepo;
  fetcher?: PlaceFetcher;
  now?: () => number;
}

let warnedMissing = false;
/** For tests: let the next missing-table miss log again. */
export function resetPrashnaWarning(): void {
  warnedMissing = false;
}

/** The instant the question was asked, for the stored row (Radha gets `at` as given). */
export function askedAtOf(at: string, tzHours: number | null): Date {
  // place-local time with no offset: read it at the place's offset (UTC when unknown)
  const local = radhaLocalToDate(at, tzHours);
  if (local) return local;
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function calcVersionOf(payload: unknown): string | null {
  const p = payload as { calc_version?: unknown; meta?: { calc_version?: unknown } } | null;
  const v = p?.calc_version ?? p?.meta?.calc_version;
  return v == null ? null : String(v);
}

function placeNameOf(payload: unknown): string | null {
  const p = (payload as { place?: unknown; place_resolved?: unknown } | null) ?? null;
  const v = p?.place_resolved ?? p?.place;
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null;
}

/** Cast the prashna for a question: one Radha call, one `prashna_casts` row (best effort), the payload returned. */
export async function castPrashna(input: CastPrashnaInput, deps: CastPrashnaDeps = {}): Promise<PrashnaCast> {
  const now = deps.now ?? Date.now;
  const at = transitAt(input.at ?? new Date(now()), 'castPrashna');
  const factors = input.divisionalChartFactors !== undefined ? factorsField(input.divisionalChartFactors, 'castPrashna') : undefined;
  let repo = deps.repo;
  const getRepo = async (): Promise<PrashnaRepo> => (repo ??= await defaultRepo());

  const needBirth = !input.place || input.withNatal;
  const birth = needBirth ? await (await getRepo()).birth(input.userId) : null;
  if (needBirth && !birth) throw new Error(input.place ? 'castPrashna: withNatal needs a kundli' : 'castPrashna: no current location and no birth place for this person');

  let placeSource: PlaceSource;
  let place: AtPlace | null;
  let placeFields: Record<string, unknown>;
  if (input.place) {
    placeSource = 'current';
    place = roundPlace(input.place);
    placeFields = { ...place };
  } else {
    placeSource = 'birth';
    place = birth!.req.coords ? roundPlace(birth!.req.coords) : null;
    placeFields = place ? { ...place } : { place: birth!.req.params.place };
  }

  const fields: Record<string, unknown> = {
    ...placeFields,
    at,
    ...(factors !== undefined ? { divisional_chart_factors: factors } : {}),
    ...(input.withNatal && birth ? natalFields(birth.req) : {}),
  };
  const payload = await (deps.fetcher ?? defaultPlaceFetcher)('prashna', fields);

  const askedAt = askedAtOf(at, place?.tz ?? null);
  const placeResolved = placeNameOf(payload) ?? (placeSource === 'birth' ? (birth!.placeResolved ?? birth!.req.params.place) : null);
  let castId: string | null = null;
  try {
    const row = await (await getRepo()).insertCast({
      userId: input.userId,
      readingRunId: input.runId ?? null,
      askedAt,
      placeResolved,
      lat: place?.lat ?? null,
      lon: place?.lon ?? null,
      tz: place?.tz ?? null,
      placeSource,
      calcVersion: calcVersionOf(payload),
      payload,
    });
    castId = row.id;
  } catch (err) {
    if (isMissingTable(err)) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn(JSON.stringify({ msg: 'prashna_casts missing; prashna returned unstored (migration M14 applied?)' }));
      }
    } else {
      console.warn(JSON.stringify({ msg: 'prashna_casts insert failed; prashna returned unstored', error: String((err as Error)?.message ?? err).slice(0, 200) }));
    }
  }
  return { payload, placeSource, place, placeResolved, askedAt, castId };
}

/** Raw-SQL repository (like src/services/userLocation.ts): no dependency on the generated client knowing `prashna_casts`. */
export function prismaPrashnaRepo(prisma: PrismaClient, chartRepo: { kundliRequest(kundliId: string): Promise<KundliRequest | null> }): PrashnaRepo {
  return {
    async birth(userId) {
      const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true, place_resolved: true } });
      if (!k) return null;
      const req = await chartRepo.kundliRequest(k.id);
      return req ? { kundliId: k.id, req, placeResolved: k.place_resolved ?? null } : null;
    },
    async insertCast(r) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "prashna_casts" ("user_id", "reading_run_id", "asked_at", "place_resolved", "lat", "lon", "tz", "place_source", "calc_version", "payload")
        VALUES (${r.userId}, ${r.readingRunId}, ${r.askedAt}, ${r.placeResolved}, ${r.lat}, ${r.lon}, ${r.tz}, ${r.placeSource}, ${r.calcVersion}, ${JSON.stringify(r.payload ?? null)}::jsonb)
        RETURNING "id"`;
      return { id: rows[0]!.id };
    },
  };
}

async function defaultRepo(): Promise<PrashnaRepo> {
  const [{ prisma }, { prismaChartDataRepo }] = await Promise.all([import('../../lib/prisma.js'), import('./store.js')]);
  return prismaPrashnaRepo(prisma, prismaChartDataRepo(prisma));
}
