/**
 * The kundli digest (docs/reading-engine/53 §4.1, the build contract of 54 §2): one versioned breakdown per kundli, built
 * by code from the stored engine rows and read by every board, reading and technique without recomputation. Every row
 * carries the engine type, variant, calc version and JSON path it came from. Nothing here computes astrology: the
 * builder selects, counts, joins and dates engine fields (doc 46 §C.3; tests/unit/reading/digest/noAstrologyInNode.test.ts).
 */

export const DIGEST_VERSION = 'd1.2026-11-06';

export type DigestSection = 'house' | 'planet' | 'yoga' | 'point' | 'annual' | 'star';
export const DIGEST_SECTIONS: readonly DigestSection[] = ['house', 'planet', 'yoga', 'point', 'annual', 'star'];
export type DigestStatus = 'pending' | 'building' | 'ready' | 'stale' | 'failed';
export const DIGEST_STATUSES: readonly DigestStatus[] = ['pending', 'building', 'ready', 'stale', 'failed'];

/** Where a value came from: the catalogue type, its variant ('' natal, 'year=2027' …), the stored calc version and the JSON path inside the payload. */
export interface DigestSource {
  type: string;
  variant: string;
  calcVersion: string | null;
  path: string;
}

export interface HouseCard {
  /** 'D1', 'D9' … */
  varga: string;
  /** 1..12 */
  house: number;
  sign: string | null;
  /** planet code as the engine writes it (Su Mo Ma Me Ju Ve Sa Ra Ke) */
  lord: string | null;
  lordHouse: number | null;
  lordSign: string | null;
  lordDignity: string | null;
  coLord: string | null;
  occupants: Array<{ planet: string; dignity: string | null; nature: string | null }>;
  aspectedGraha: string[];
  aspectedRasi: string[];
  argala: { primary: string[]; secondary: string[]; obstructed: string[] } | null;
  sav: number | null;
  /** kendra, trikona, dusthana, upachaya, maraka … as the engine labels them */
  class: string[];
  cuspStar: { name: string; lord: string; pada: number | null } | null;
  /** the arudha pada of this house, as a sign */
  arudha: string | null;
}

export interface AntardashaFruitionCell {
  houseFromMd: number | null;
  houseFromLagna: number | null;
  fruitionClass: string | null;
  isStarLordOfMd: boolean;
  isSignDispositorOfMd: boolean;
  isCoLordPartnerOfMd: boolean;
  isShadAshtaka68: boolean;
  isDwirdwadasha212: boolean;
}

export interface DashaCharterDigest {
  housesOwned: number[];
  housesCoOwned: number[];
  coLordPartner: string | null;
  rasiDrishtiHouses: number[];
  grahaDrishtiHouses: number[];
  arudhasInSign: string[];
  dispositorHouse: number | null;
  dispositorDignity: string | null;
  starLordHouse: number | null;
  starLordDignity: string | null;
  starLordArudhas: string[];
  isYogi: boolean;
  isAvayogi: boolean;
  isSahayogi: boolean;
  fruition: Record<string, AntardashaFruitionCell>;
}

export interface PlanetCard {
  varga: string;
  planet: string;
  sign: string | null;
  house: number | null;
  degree: number | null;
  star: string | null;
  pada: number | null;
  starLord: string | null;
  dignity: string | null;
  retro: boolean | null;
  combust: boolean | null;
  war: boolean | null;
  dispositor: string | null;
  dispositorHouse: number | null;
  chain: string[];
  avasthas: Record<string, string>;
  shadbalaRatio: number | null;
  shadbalaRank: number | null;
  natural: string | null;
  functional: string | null;
  owns: number[];
  aspectsTo: number[];
  aspectedBy: string[];
  conjunctions: string[];
  /** D1 only: 5-vector Mahadasha charter & 9×9 Antardasha fruition map from avasthas.dasha_charter */
  dashaCharter?: DashaCharterDigest | null;
}

export interface YogaRow {
  id: string;
  name: string;
  planets: string[];
  houses: number[];
  class: string;
  source: string;
}

export interface PointRow {
  id: string;
  varga: string;
  sign: string | null;
  house: number | null;
  lord: string | null;
  lordHouse: number | null;
}

export interface AnnualRow {
  kind: 'TP' | 'VP';
  year: number;
  varga: string;
  lagna: string | null;
  houses: HouseCard[];
  dashas: Array<{ system: string; periods: Array<{ lord: string; from: string; to: string }> }>;
  sahams: Array<{ name: string; sign: string | null; house: number | null }>;
  muntha?: { sign: string | null; house: number | null } | null;
  yearLord?: string | null;
  tajakaYogas?: Array<{ id: string; present: boolean }>;
}

export interface StarProfile {
  moonStar: string | null;
  moonStarLord: string | null;
  lagnaStar: string | null;
  taras: Array<{ star: string; tara: string }>;
  gandanta: string[];
}

export interface DigestView {
  kundliId: string;
  status: DigestStatus;
  version: string;
  builtAt: string | null;
  house(varga: string, h: number): HouseCard | null;
  houses(varga: string): HouseCard[];
  planet(varga: string, p: string): PlanetCard | null;
  planets(varga: string): PlanetCard[];
  vargas(): string[];
  yogas(): YogaRow[];
  points(varga?: string): PointRow[];
  annual(year?: number): AnnualRow[];
  star(): StarProfile | null;
  sourceOf(section: DigestSection, key: string): DigestSource[];
}

export type DigestRow = HouseCard | PlanetCard | YogaRow | PointRow | AnnualRow | StarProfile;

/** One row of `kundli_digest` before it is written (keys: `D9.h7`, `D1.Ve`, `D1.<yoga id>`, `D1.AK`, `TP2027.D1`, `profile`). */
export interface DigestRowInput {
  section: DigestSection;
  key: string;
  row: DigestRow;
  source: DigestSource[];
}

/** The id the dossier (`kundli_facts.dossier`) has in the builder's input map, beside the catalogue ids. */
export const FACTS_ITEM = 'facts';

/** `type` or `type@variant`: how an input item is keyed in the builder's map (variant as stored, e.g. `year=2027;divisional_chart_factor=9`). */
export function itemKey(type: string, variant: string): string {
  return variant ? `${type}@${variant}` : type;
}

export function splitItemKey(key: string): { type: string; variant: string } {
  const at = key.indexOf('@');
  return at < 0 ? { type: key, variant: '' } : { type: key.slice(0, at), variant: key.slice(at + 1) };
}
