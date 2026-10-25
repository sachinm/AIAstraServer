/**
 * Contract with the pyjhora Lambda (facts_version 1). The Lambda computes every value; Node only reads them.
 * Authoritative shape: ../schema/facts.v1.schema.json and docs/reading-engine/03-chart-facts-dossier.md §2.
 * Fields beyond the ones the packs need are kept loose on purpose so the Python side can add fields without a
 * Node release.
 */
import type { PlanetCode, VargaKey } from './constants.js';

export interface NakRef {
  idx: number;
  name: string;
  pada: number;
  lord: PlanetCode;
}

export interface Body {
  lon: number;
  sign: number;
  sign_name: string;
  deg_in_sign: number;
  house: number;
  nak: NakRef;
  navamsa_sign?: number | null;
  dignity?: string;
  retro?: boolean;
  combust?: boolean;
  speed?: number | null;
  owns?: number[];
  nature?: { natural: string; functional: string };
  conj?: string[];
  aspects_to?: { graha: number[]; rasi: number[] };
  aspected_by?: { graha: string[]; rasi: string[] };
  star_lord?: PlanetCode;
  star_lord_house?: number;
  sign_lord?: PlanetCode;
  sign_lord_house?: number;
  shadbala?: { rupas: number; required: number; ratio: number; rank: number } | null;
  ishta?: number | null;
  kashta?: number | null;
  bav_at_sign?: number | null;
  tara_from_janma?: string;
  bhava?: number | null;
  near_cusp?: boolean | null;
  flags?: string[];
}

export interface House {
  sign: number;
  sign_name: string;
  lord: PlanetCode;
  lord_house: number;
  lord_sign?: number;
  lord_dignity?: string;
  co_lord?: PlanetCode;
  co_lord_house?: number;
  occupants: string[];
  aspected_by: { graha: string[]; rasi: string[] };
  argala?: { primary: string[]; secondary?: string[]; obstructed_by: string[] };
  sav?: number | null;
  class?: string[];
  cusp_nak?: { name: string; lord: PlanetCode; pada: number };
}

export interface VargaPlanet {
  sign: number;
  house: number;
  dignity: string;
  vargottama: boolean;
}
export interface Varga {
  lagna_sign: number;
  lagna_sign_name?: string;
  lagna_lord: PlanetCode;
  lagna_lord_house?: number;
  planets: Record<string, VargaPlanet>;
  houses: Record<string, { sign: number; lord: PlanetCode; occupants: string[] }>;
  d1_lord_positions: Record<string, { lord: PlanetCode; varga_sign: number; varga_house: number; varga_dignity: string }>;
}

export interface DashaCurrent {
  md?: PlanetCode;
  ad?: PlanetCode;
  pd?: PlanetCode;
  md_start?: string;
  md_end?: string;
  ad_start?: string;
  ad_end?: string;
  pd_start?: string;
  pd_end?: string;
}
export interface DashaPeriod {
  level: 'ad' | 'pd';
  md: PlanetCode;
  ad: PlanetCode;
  pd?: PlanetCode;
  start: string;
  end: string;
}
export interface NarayanaPeriod {
  md_sign: number;
  md_sign_name: string;
  md_lord: PlanetCode;
  ad_sign: number;
  ad_sign_name: string;
  start: string;
  end: string;
}

export interface Yoga {
  name: string;
  planets: string[];
  houses: number[];
  class: string;
  note?: string;
  source?: string;
}
export interface Dosha {
  name: string;
  present: boolean | null;
  planets?: string[];
  houses?: number[];
  [k: string]: unknown;
}

export interface Dossier {
  v: 1;
  engine: { pyjhora: string; commit: string; ayanamsa: string; houses: string };
  as_of: string;
  birth: { date: string; time: string; tz: number; lat: number; lon: number; place: string };
  panchanga: Record<string, unknown>;
  bodies: Record<string, Body>;
  houses: Record<string, House>;
  vargas: Partial<Record<VargaKey, Varga>>;
  karakas: { chara: Record<string, PlanetCode>; chara_houses?: Record<string, number>; karakamsa: { sign: number | null; sign_name: string | null }; natural?: Record<string, string[]> };
  arudhas: Record<string, { sign: number; sign_name: string; house: number; occupants: string[]; lord: PlanetCode }>;
  special_lagnas: Record<string, { lon: number; sign: number; sign_name: string; house: number; nak: { name: string; lord: PlanetCode; pada: number }; occupants: string[] }>;
  yogas: Yoga[];
  doshas: Dosha[];
  ashtakavarga: { sav: number[]; bav: Record<string, number[]> };
  dasha: {
    vimshottari: { current: DashaCurrent; mahadashas: Array<{ md: PlanetCode; start: string; end: string }>; periods: DashaPeriod[]; window?: { pd_from: string; pd_to: string } };
    narayana: { current: Record<string, unknown>; periods: NarayanaPeriod[] };
  };
  nakshatra_profile: Record<string, unknown>;
  relations: {
    exchanges: string[][];
    lord_of: Record<string, PlanetCode>;
    houses_of: Record<string, number[]>;
    kendra_trikona_lords: string[];
    dusthana_lords: string[];
    marakas: string[];
    yogakaraka: PlanetCode | null;
    functional: { benefic: string[]; malefic: string[]; neutral: string[] };
    [k: string]: unknown;
  };
  meta?: Record<string, unknown>;
}
