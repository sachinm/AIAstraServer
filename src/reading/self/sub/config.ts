/**
 * Selections of the Self v2 sub-techniques that can be tuned without code (AGENTS.md: rule lists through typed env
 * helpers with clean defaults). Each is a list of engine codes or house numbers the code SELECTS by; none is a derivation.
 * Also the calendar helpers the build needs (ISO week of the sky snapshot, month offsets): calendar arithmetic only.
 */
import type { IsoDate } from '../v2types.js';

const PLANET_CODES = new Set(['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']);

function planetList(env: string, fallback: string[]): string[] {
  const raw = process.env[env];
  if (!raw) return fallback;
  const xs = raw.split(',').map((x) => x.trim()).filter((x) => PLANET_CODES.has(x));
  return xs.length ? [...new Set(xs)] : fallback;
}

function houseList(env: string, fallback: number[]): number[] {
  const raw = process.env[env];
  if (!raw) return fallback;
  const xs = raw.split(',').map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 1 && x <= 12);
  return xs.length ? [...new Set(xs)] : fallback;
}

/** transiting planets S3 keeps from the sky overlay (env `SELF_V2_WINDOW_TRANSIT_PLANETS`, default Ma,Ju,Sa,Ra,Ke) */
export const getWindowTransitPlanets = (): string[] => planetList('SELF_V2_WINDOW_TRANSIT_PLANETS', ['Ma', 'Ju', 'Sa', 'Ra', 'Ke']);
/** the body houses S7 selects live lords on (env `SELF_V2_BODY_HOUSES`, default 1,6,8; doc 66 §4.8 S7) */
export const getBodyHouses = (): number[] => houseList('SELF_V2_BODY_HOUSES', [1, 6, 8]);
/** transits S7 keeps over lagna and Moon (env `SELF_V2_BODY_TRANSIT_PLANETS`, default Sa,Ma) */
export const getBodyTransitPlanets = (): string[] => planetList('SELF_V2_BODY_TRANSIT_PLANETS', ['Sa', 'Ma']);
/** planets whose placements S6 offers as candidate patterns (env `SELF_V2_MIND_PATTERN_PLANETS`, default Ra,Sa,Ke) */
export const getMindPatternPlanets = (): string[] => planetList('SELF_V2_MIND_PATTERN_PLANETS', ['Ra', 'Sa', 'Ke']);
/** planets whose periods S8 reads besides the lagna lord (env `SELF_V2_PRESENCE_PLANETS`, default Ve) */
export const getPresencePlanets = (): string[] => planetList('SELF_V2_PRESENCE_PLANETS', ['Ve']);

const DAY_MS = 86_400_000;

/** ISO 8601 week of a date, e.g. '2026-W45'; null for an invalid date */
export function isoWeek(iso: string | null | undefined): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** true when [from, to) overlaps [a, b) */
export const overlaps = (from: IsoDate, to: IsoDate, a: IsoDate, b: IsoDate): boolean => from < b && to > a;
export const isLive = (from: IsoDate, to: IsoDate, asOf: IsoDate): boolean => from <= asOf && asOf < to;
