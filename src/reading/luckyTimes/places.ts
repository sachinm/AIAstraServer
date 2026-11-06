/**
 * The places whose day tables are pulled and shared (docs/reading-engine/47 §3.5): four US time zones and India, each
 * with its IANA zone so the engine applies daylight saving per date. `sanjose` and `pune` reuse the shared-sky presets.
 * The place key (doc 35's `placeKey`) is built from the standard-time offset so a place has one key all year.
 */
import { getLuckyReferencePlaces } from '../../config/env.js';
import { placeKey } from '../transits/ephemerisCache.js';
import { tzOffsetHours } from '../chartData/place.js';

export interface DayTablePlace {
  name: string;
  lat: number;
  lon: number;
  tzName: string;
  tzAlias?: string;
}

export const DAY_TABLE_PLACES: Record<string, DayTablePlace> = Object.fromEntries(
  getLuckyReferencePlaces().map((p) => [
    p.key,
    { name: p.label, lat: p.lat, lon: p.lon, tzName: p.ianaTz, tzAlias: p.tzAlias },
  ]),
);

/** Resolves a preset key ('sanjose'), timezone alias ('us-west'), or IANA zone ('America/Los_Angeles') to the canonical key in DAY_TABLE_PLACES. */
export function resolvePlacePreset(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;
  const k = input.trim().toLowerCase();
  if (DAY_TABLE_PLACES[k]) return k;
  for (const [key, p] of Object.entries(DAY_TABLE_PLACES)) {
    if (p.tzAlias?.toLowerCase() === k || p.tzName.toLowerCase() === k) return key;
  }
  return null;
}

/** The zone's standard-time offset (read in mid-January), used for the request `tz` and the place key. */
export function standardOffsetHours(tzName: string): number {
  return tzOffsetHours(tzName, new Date(Date.UTC(2026, 0, 15))) ?? 0;
}

export function dayTablePlaceKey(p: DayTablePlace): string {
  return placeKey({ lat: p.lat, lon: p.lon, tz: standardOffsetHours(p.tzName) });
}
