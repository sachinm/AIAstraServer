/**
 * Contract for the pyjhora Lambda `transits` export served per kundli ("natal_overlay"): every transit period
 * already placed against the natal chart. Node selects rows from it; it never derives houses or overlays.
 * Stand-in generator for fixtures: docs/reading-engine/drafts/radha/transit_chart.py.
 */
import type { PlanetCode } from '../facts/constants.js';

export interface TransitNakSegment {
  from: string;
  to: string;
  nak: string;
  over_natal_nak: string[];
}
export interface TransitRow {
  planet: PlanetCode;
  from: string;
  to: string;
  sign: number;
  sign_name: string;
  retro_on_entry: boolean;
  house_from_lagna: number;
  house_from_moon: number;
  house_from_al: number;
  over_natal: string[];
  influences_houses: number[];
  sav: number;
  bav?: number;
  nak_segments?: TransitNakSegment[];
}
export interface DoubleTransitWindow {
  from: string;
  to: string;
  houses: number[];
  jupiter_sign: number;
  saturn_sign: number;
}
export interface SadeSatiPeriod {
  from: string;
  to: string;
  phase: string;
  saturn_sign: number;
  house_from_moon: number;
}
export interface TransitChart {
  v: 1;
  kind: 'natal_overlay';
  ayanamsa: string;
  as_of: string;
  from: string;
  to: string;
  natal: { lagna_sign: number; moon_sign: number; al_sign: number; moon_nak: string };
  now: Record<string, Pick<TransitRow, 'sign' | 'sign_name' | 'house_from_lagna' | 'house_from_moon' | 'house_from_al' | 'over_natal' | 'from' | 'to'>>;
  rows: TransitRow[];
  double_transit: DoubleTransitWindow[];
  sade_sati: { now: SadeSatiPeriod | null; periods: SadeSatiPeriod[] };
  stations: Array<{ planet: string; kind: string; date: string; sign: number; nak: string }>;
  lunations: Array<{ kind: string; date: string; sign: number; sign_name: string; nak: string }>;
}
