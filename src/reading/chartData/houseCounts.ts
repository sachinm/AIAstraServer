/**
 * Radha's `house_counts` export (default params: the D1 chart): the table a consumer reads to place a sign or count from
 * one place to another. Node derives no house, not even as a lookup over signs, so a table that is missing or malformed
 * means the value is unavailable; there is no fallback. This file only checks the shape.
 */
import { PLANET_CODES, type PlanetCode } from '../facts/constants.js';

export const HOUSE_COUNTS_TYPE = 'house_counts';

export interface HouseCounts {
  chart: string;
  varga: number;
  chart_method: number;
  lagna: { sign_index: number; sign: string };
  /** sign index (0-11) -> its house from this chart's lagna */
  sign_to_house: Record<number, number>;
  planet_house: Record<PlanetCode, number>;
  /** row house a, column house b: the count from a to b (1 = same house) */
  house_from_house: Record<number, Record<number, number>>;
  /** row planet, column planet: the count from the row planet to the column planet */
  house_from_planet: Record<PlanetCode, Record<PlanetCode, number>>;
  arudha_lagna: { sign_index: number; sign: string; house: number };
  /** house -> the count from this chart's Arudha Lagna to it */
  house_from_arudha_lagna: Record<number, number>;
}

const SIGNS = Array.from({ length: 12 }, (_, i) => String(i));
const HOUSES = Array.from({ length: 12 }, (_, i) => String(i + 1));

const isHouse = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const row = (v: unknown, keys: readonly string[]): boolean => isObject(v) && keys.every((k) => isHouse(v[k]));
const grid = (v: unknown, rows: readonly string[], cols: readonly string[]): boolean => isObject(v) && rows.every((r) => row(v[r], cols));

/** The D1 table when `v` has every cell; null otherwise (a partial table is treated as no table) */
export function asHouseCounts(v: unknown): HouseCounts | null {
  if (!isObject(v) || v.varga !== 1) return null;
  const ok =
    row(v.sign_to_house, SIGNS) &&
    row(v.planet_house, PLANET_CODES) &&
    grid(v.house_from_house, HOUSES, HOUSES) &&
    grid(v.house_from_planet, PLANET_CODES, PLANET_CODES) &&
    isObject(v.arudha_lagna) &&
    isHouse(v.arudha_lagna.house) &&
    row(v.house_from_arudha_lagna, HOUSES);
  return ok ? (v as unknown as HouseCounts) : null;
}
