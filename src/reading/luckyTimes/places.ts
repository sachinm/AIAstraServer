/**
 * The places whose day tables are pulled and shared (docs/reading-engine/47 §3.5): four US time zones and India, each
 * with its IANA zone so the engine applies daylight saving per date. `sanjose` and `pune` reuse the shared-sky presets.
 * The place key (doc 35's `placeKey`) is built from the standard-time offset so a place has one key all year.
 */
import { placeKey } from '../transits/ephemerisCache.js';
import { tzOffsetHours } from '../chartData/place.js';

export interface DayTablePlace {
  name: string;
  lat: number;
  lon: number;
  tzName: string;
}

export const DAY_TABLE_PLACES: Record<string, DayTablePlace> = {
  newyork: { name: 'New York, US', lat: 40.7128, lon: -74.006, tzName: 'America/New_York' },
  chicago: { name: 'Chicago, US', lat: 41.8781, lon: -87.6298, tzName: 'America/Chicago' },
  denver: { name: 'Denver, US', lat: 39.7392, lon: -104.9903, tzName: 'America/Denver' },
  sanjose: { name: 'San Jose, US', lat: 37.341, lon: -121.894, tzName: 'America/Los_Angeles' },
  pune: { name: 'Pune, IN', lat: 18.52, lon: 73.857, tzName: 'Asia/Kolkata' },
};

/** The zone's standard-time offset (read in mid-January), used for the request `tz` and the place key. */
export function standardOffsetHours(tzName: string): number {
  return tzOffsetHours(tzName, new Date(Date.UTC(2026, 0, 15))) ?? 0;
}

export function dayTablePlaceKey(p: DayTablePlace): string {
  return placeKey({ lat: p.lat, lon: p.lon, tz: standardOffsetHours(p.tzName) });
}
