/**
 * Where the person lives now (city as typed + IANA timezone), kept per user in `user_current_location`
 * (migration 20261026130000_reading_m13_user_current_location). Used only to say timing in local terms: no geocoding
 * and no astrological computation happens here; the place is stored exactly as the person typed it.
 *
 * The migration may not be applied yet on a given database. Every read and write is therefore wrapped: a missing table
 * (or any other database error, or a slow database) is logged once per process and treated as "no location, cannot
 * store", so the clarifier does not ask (it could never remember the answer) and the reading is never affected.
 * Raw SQL is used on purpose so this works whether or not the generated Prisma client knows the new model.
 */
import type { PrismaClient } from '@prisma/client';

export interface UserLocation {
  /** what the person typed, trimmed (for example "Pune, India") */
  place: string;
  /** IANA timezone from the browser (Intl), when it sent one */
  tz: string | null;
}

export type LocationLookup = { status: 'found'; location: UserLocation } | { status: 'none' } | { status: 'unavailable' };

export interface UserLocationStore {
  get(userId: string): Promise<LocationLookup>;
  /** true when stored; false when the store is unavailable (never throws) */
  save(userId: string, location: UserLocation): Promise<boolean>;
}

export const LOCATION_LOOKUP_BUDGET_MS = 300;
export const MAX_PLACE_CHARS = 120;

let warned = false;
function warnOnce(op: string, err: unknown): void {
  if (warned) return;
  warned = true;
  const e = err as { code?: unknown; message?: unknown };
  console.warn(JSON.stringify({ msg: 'user_current_location unavailable; treating as no location (migration M13 applied?)', op, code: typeof e?.code === 'string' ? e.code : undefined, error: String(e?.message ?? err).slice(0, 200) }));
}

/** For tests: let the next failure log again. */
export function resetUserLocationWarning(): void {
  warned = false;
}

/** A timezone the runtime knows ("Asia/Kolkata"); anything else is dropped. */
export function normalizeTimeZone(tz: unknown): string | null {
  if (typeof tz !== 'string') return null;
  const t = tz.trim();
  if (!t || t.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(t)) return null;
  try {
    // validate only: keep the browser's spelling (ICU may canonicalise Asia/Kolkata to Asia/Calcutta)
    new Intl.DateTimeFormat('en-US', { timeZone: t });
    return t;
  } catch {
    return null;
  }
}

/** The place as typed: no control characters, single spaces, capped. Empty -> null. */
export function normalizePlace(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim();
  if (!t) return null;
  return t.slice(0, MAX_PLACE_CHARS);
}

/** The line the reading tail carries: `CURRENT LOCATION: Pune, India (Asia/Kolkata)`. */
export function currentLocationLine(loc: UserLocation | null | undefined): string | null {
  if (!loc?.place) return null;
  return `CURRENT LOCATION: ${loc.place}${loc.tz ? ` (${loc.tz})` : ''}`;
}

export class PrismaUserLocationStore implements UserLocationStore {
  constructor(private prisma: PrismaClient, private budgetMs = LOCATION_LOOKUP_BUDGET_MS) {}

  async get(userId: string): Promise<LocationLookup> {
    try {
      const q = (async () => {
        const rows = await this.prisma.$queryRaw<Array<{ place: string | null; tz: string | null }>>`SELECT "place", "tz" FROM "user_current_location" WHERE "user_id" = ${userId} LIMIT 1`;
        return rows;
      })();
      const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), this.budgetMs).unref?.());
      const rows = await Promise.race([q, timeout]);
      if (rows === 'timeout') {
        q.catch(() => undefined);
        return { status: 'unavailable' };
      }
      const row = rows[0];
      const place = normalizePlace(row?.place);
      if (!place) return { status: 'none' };
      return { status: 'found', location: { place, tz: normalizeTimeZone(row?.tz) } };
    } catch (err) {
      warnOnce('get', err);
      return { status: 'unavailable' };
    }
  }

  async save(userId: string, location: UserLocation): Promise<boolean> {
    const place = normalizePlace(location.place);
    if (!place) return false;
    const tz = normalizeTimeZone(location.tz);
    try {
      await this.prisma.$executeRaw`INSERT INTO "user_current_location" ("user_id", "place", "tz", "updated_at") VALUES (${userId}, ${place}, ${tz}, now())
        ON CONFLICT ("user_id") DO UPDATE SET "place" = EXCLUDED."place", "tz" = EXCLUDED."tz", "lat" = NULL, "lon" = NULL, "updated_at" = now()`;
      return true;
    } catch (err) {
      warnOnce('save', err);
      return false;
    }
  }
}

export class MemoryUserLocationStore implements UserLocationStore {
  rows = new Map<string, UserLocation>();
  constructor(private available = true) {}
  async get(userId: string): Promise<LocationLookup> {
    if (!this.available) return { status: 'unavailable' };
    const r = this.rows.get(userId);
    return r ? { status: 'found', location: r } : { status: 'none' };
  }
  async save(userId: string, location: UserLocation): Promise<boolean> {
    if (!this.available) return false;
    const place = normalizePlace(location.place);
    if (!place) return false;
    this.rows.set(userId, { place, tz: normalizeTimeZone(location.tz) });
    return true;
  }
}

/** The person's birth place as stored at sign-up, for the "Same as birth place" chip. Never throws. */
export async function birthPlaceFor(prisma: PrismaClient, userId: string): Promise<string | null> {
  try {
    const row = await (prisma as unknown as { auth?: { findUnique?: (a: unknown) => Promise<{ place_of_birth?: string | null } | null> } }).auth?.findUnique?.({ where: { id: userId }, select: { place_of_birth: true } });
    return normalizePlace(row?.place_of_birth ?? null);
  } catch {
    return null;
  }
}
