/**
 * Transit evidence for one reading: SELECTS and CLIPS rows of the per-kundli transit chart the pyjhora Lambda
 * returns (see ../transits/types.ts). Nothing is derived here — houses, overlays, double transit and Sade Sati
 * phases are all fields computed by the engine. This file decides only which rows are relevant to the frame.
 */
import type { PlanetCode } from '../facts/constants.js';
import type { DoubleTransitWindow, SadeSatiPeriod, TransitChart, TransitNakSegment, TransitRow } from '../transits/types.js';

export interface TransitSelectionInput {
  chart: TransitChart;
  /** Houses from Lagna that the subject frame cares about */
  frameHouses: number[];
  /** Natal planets (lords of frame houses, karakas) whose natal point a transit is interesting over */
  interestingNatal: string[];
  horizon: { from: string; to: string; months: number };
  /** Planets the user named (canonical codes); forced into the selection */
  mentionsPlanets?: string[];
}

export interface SelectedTransitRow {
  planet: PlanetCode;
  from: string;
  to: string;
  sign: string;
  retro_on_entry: boolean;
  house_from_lagna: number;
  house_from_moon: number;
  house_from_al: number;
  over_natal: string[];
  influences_houses: number[];
  sav: number;
  bav?: number;
  nak_segments?: Array<Pick<TransitNakSegment, 'from' | 'to' | 'nak' | 'over_natal_nak'>>;
}

export interface TransitSection {
  as_of: string;
  now: Record<string, { sign: string; house_from_lagna: number; house_from_moon: number; over_natal: string[] }>;
  rows: Record<string, SelectedTransitRow>;
  /** Slow-planet-over-natal hits anywhere in the engine's range (even beyond the horizon), for "is X over my Y" questions */
  focus_hits: Array<{ key: string; planet: string; over_natal: string[]; from: string; to: string; in_horizon: boolean }>;
  double_transit: Array<{ from: string; to: string; houses: number[] }>;
  sade_sati: { now: string | null; periods: Array<{ from: string; to: string; phase: string }> };
  stations: Array<{ planet: string; kind: string; date: string; sign: number }>;
  dropped_rows: number;
}

const SLOW: PlanetCode[] = ['Ju', 'Sa', 'Ra', 'Ke'];
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const max = (a: string, b: string): string => (a > b ? a : b);
const min = (a: string, b: string): string => (a < b ? a : b);
const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string): boolean => aFrom <= bTo && aTo >= bFrom;

export function rowKey(r: { planet: string; from: string }): string {
  return `${r.planet}_${r.from}`;
}

/** Planets that get rows for a horizon: slow planets always, Mars for short horizons, anything the user named. */
export function transitPlanetsFor(months: number, mentions: string[] = []): Set<string> {
  const set = new Set<string>(SLOW);
  if (months <= 3) set.add('Ma');
  if (months <= 1) {
    set.add('Su');
    set.add('Ve');
    set.add('Me');
  }
  for (const m of mentions) set.add(m);
  return set;
}

export function selectTransits(input: TransitSelectionInput): TransitSection {
  const { chart, horizon } = input;
  const mentions = input.mentionsPlanets ?? [];
  const planets = transitPlanetsFor(horizon.months, mentions);
  const frame = new Set(input.frameHouses);
  const interesting = new Set<string>([...input.interestingNatal, 'Mo', 'La']);
  const rows: Record<string, SelectedTransitRow> = {};
  let dropped = 0;

  for (const r of chart.rows) {
    if (!planets.has(r.planet)) continue;
    if (!overlaps(r.from, r.to, horizon.from, horizon.to)) continue;
    const touchesFrame = r.influences_houses.some((h) => frame.has(h)) || frame.has(r.house_from_lagna);
    const overInteresting = r.over_natal.some((c) => interesting.has(c) && c !== r.planet);
    const mentioned = mentions.includes(r.planet);
    const sadeRelevant = r.planet === 'Sa' && [12, 1, 2, 4, 8].includes(r.house_from_moon);
    if (!(touchesFrame || overInteresting || mentioned || sadeRelevant || r.planet === 'Sa' || r.planet === 'Ju')) {
      dropped += 1;
      continue;
    }
    rows[rowKey(r)] = toSelected(r, horizon);
  }

  const focus_hits: TransitSection['focus_hits'] = [];
  for (const r of chart.rows) {
    if (!SLOW.includes(r.planet) && !mentions.includes(r.planet)) continue;
    const hits = r.over_natal.filter((c) => c !== r.planet && (mentions.length === 0 ? interesting.has(c) : mentions.includes(c) || c === 'Mo' || c === 'La'));
    if (!hits.length) continue;
    if (mentions.length && !mentions.includes(r.planet)) continue;
    focus_hits.push({ key: rowKey(r), planet: r.planet, over_natal: hits, from: r.from, to: r.to, in_horizon: overlaps(r.from, r.to, horizon.from, horizon.to) });
  }

  const double_transit = chart.double_transit
    .filter((d: DoubleTransitWindow) => overlaps(d.from, d.to, horizon.from, horizon.to))
    .map((d) => ({ from: max(d.from, horizon.from), to: min(d.to, horizon.to), houses: d.houses.filter((h) => frame.has(h)) }))
    .filter((d) => d.houses.length > 0);

  const sade_periods = chart.sade_sati.periods
    .filter((s: SadeSatiPeriod) => overlaps(s.from, s.to, horizon.from, horizon.to))
    .map((s) => ({ from: max(s.from, horizon.from), to: min(s.to, horizon.to), phase: s.phase }));

  const stations = chart.stations
    .filter((s) => ['Ju', 'Sa'].includes(s.planet) && s.date >= horizon.from && s.date <= horizon.to)
    .map((s) => ({ planet: s.planet, kind: s.kind, date: s.date, sign: s.sign }));

  const now: TransitSection['now'] = {};
  for (const [p, v] of Object.entries(chart.now)) {
    if (!planets.has(p)) continue;
    now[p] = { sign: v.sign_name, house_from_lagna: v.house_from_lagna, house_from_moon: v.house_from_moon, over_natal: v.over_natal };
  }

  return {
    as_of: chart.as_of,
    now,
    rows,
    focus_hits,
    double_transit,
    sade_sati: { now: chart.sade_sati.now ? chart.sade_sati.now.phase : null, periods: sade_periods },
    stations,
    dropped_rows: dropped,
  };
}

function toSelected(r: TransitRow, horizon: { from: string; to: string }): SelectedTransitRow {
  const out: SelectedTransitRow = {
    planet: r.planet,
    from: max(r.from, horizon.from),
    to: min(r.to, horizon.to),
    sign: SIGNS[r.sign] ?? r.sign_name,
    retro_on_entry: r.retro_on_entry,
    house_from_lagna: r.house_from_lagna,
    house_from_moon: r.house_from_moon,
    house_from_al: r.house_from_al,
    over_natal: r.over_natal,
    influences_houses: r.influences_houses,
    sav: r.sav,
  };
  if (r.bav != null) out.bav = r.bav;
  if (r.nak_segments) {
    const segs = r.nak_segments
      .filter((s) => overlaps(s.from, s.to, horizon.from, horizon.to))
      .filter((s) => s.over_natal_nak.length > 0 || (s.from <= horizon.from && s.to >= horizon.from))
      .map((s) => ({ from: max(s.from, horizon.from), to: min(s.to, horizon.to), nak: s.nak, over_natal_nak: s.over_natal_nak }));
    if (segs.length) out.nak_segments = segs;
  }
  return out;
}
