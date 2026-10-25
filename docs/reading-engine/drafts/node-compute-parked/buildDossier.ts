/**
 * Build the chart-facts dossier (facts_version 1) in Node from the legacy kundli JSON columns.
 *
 * Why Node and not the Python engine: on 2026-10-24 Sachin asked to leave pyjhora/FastAPI untouched for now.
 * Everything derivable from the stored exports (positions in D1/D2/D4/D7/D9/D10, chara karakas, Vimshottari
 * MD/AD dates, Narayana dasha) is computed here deterministically: houses, lordships, dignity, aspects, argala,
 * conjunctions, star lords, functional natures, retro/combust (chart-based rule), ashtakavarga, arudhas,
 * yogas (structural), doshas, taras, PD-level Vimshottari inside the horizon window, panchanga from the Sun/Moon
 * longitudes. Not available without the engine: shadbala (null), D3/D12/D30/D60 (listed in `vargas_missing`).
 *
 * The output is deterministic for the same kundli row and `as_of` (only `dasha.*.current` depends on `as_of`).
 */
import {
  APOKLIMA,
  ARGALA_PRIMARY,
  ARGALA_SECONDARY,
  ASHTAKAVARGA_RULES,
  CO_LORDS,
  COMBUSTION_ORB,
  DIGNITY_NAMES,
  DIGNITY_TABLE,
  DUSTHANAS,
  GANDA_MOOLA_NAKS,
  GRAHA_DRISHTI,
  KARAKA_CODES,
  KARANA_CYCLE,
  KARANA_FIXED,
  KENDRAS,
  LAGNA_CODE,
  MARAKA_HOUSES,
  MOOLATRIKONA,
  NAKSHATRA_DEITIES,
  NAKSHATRA_GANA,
  NAKSHATRA_LORDS,
  NAKSHATRA_NAMES,
  NAKSHATRA_SYMBOLS,
  NATURAL_KARAKAS,
  PANAPARA,
  PLANET_CODES,
  PLANET_INDEX,
  PUSHKARA_BHAGA,
  PUSHKARA_NAVAMSA_START,
  RETRO_LIMITS_FROM_SUN,
  SIDEREAL_YEAR_DAYS,
  SIGN_LORDS,
  SIGN_NAMES,
  TARA_NAMES,
  TITHI_NAMES,
  TRIKONAS,
  UPACHAYAS,
  VARA_LORDS,
  VARA_NAMES,
  VARGA_KEYS,
  VARGA_NAMES,
  VIMSHOTTARI_ORDER,
  VIMSHOTTARI_YEARS,
  VIRODHARGALA,
  YOGA_NAMES,
  rasiDrishtiOf,
  type PlanetCode,
  type VargaKey,
} from './constants.js';
import {
  parseBiodata,
  parseCharakaraka,
  parseChartRows,
  parseNarayana,
  parseVimsottari,
  type ParsedChart,
  type ParsedMahadasha,
  type ParsedPoint,
} from './parseLegacy.js';
import type {
  Body,
  DashaCurrent,
  DashaPeriod,
  Dosha,
  Dossier,
  ExtraBody,
  House,
  LagnaBody,
  NakRef,
  NarayanaPeriod,
  NatalPoints,
  Varga,
  Yoga,
} from './types.js';

export const FACTS_VERSION = 1 as const;

export interface LegacyKundliFields {
  biodata: unknown;
  d1: unknown;
  d2?: unknown;
  d4?: unknown;
  d7?: unknown;
  d9?: unknown;
  d10?: unknown;
  charakaraka: unknown;
  vimsottari_dasa: unknown;
  narayana_dasa?: unknown;
}

export class DossierBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DossierBuildError';
  }
}

const ONE_STAR = 360 / 27;

const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const norm360 = (x: number): number => ((x % 360) + 360) % 360;
const houseFrom = (lagnaSign: number, sign: number): number => ((sign - lagnaSign + 12) % 12) + 1;
const signOfHouse = (lagnaSign: number, house: number): number => (lagnaSign + house - 1) % 12;
const addDays = (iso: string, days: number): string => new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export function nakOf(lon: number): NakRef {
  const l = norm360(lon);
  const idx = Math.floor(l / ONE_STAR) % 27;
  const pada = Math.floor((l % ONE_STAR) / (ONE_STAR / 4)) + 1;
  return { idx, name: NAKSHATRA_NAMES[idx]!, pada, lord: NAKSHATRA_LORDS[idx]! };
}

export function taraFrom(fromNak: number, toNak: number): string {
  const count = ((toNak - fromNak + 27) % 27) + 1;
  return TARA_NAMES[(count - 1) % 9]!;
}

export function dignityOf(p: PlanetCode, sign: number): string {
  const strength = DIGNITY_TABLE[p][sign]!;
  if (MOOLATRIKONA[p] === sign && strength === 5) return 'moolatrikona';
  return DIGNITY_NAMES[strength] ?? 'neutral';
}

function isGandanta(sign: number, deg: number): boolean {
  if ([3, 7, 11].includes(sign) && deg >= 30 - 10 / 3) return true;
  if ([0, 4, 8].includes(sign) && deg < 10 / 3) return true;
  return false;
}

function classOfHouse(h: number): string[] {
  const out: string[] = [];
  if (KENDRAS.includes(h)) out.push('kendra');
  if (TRIKONAS.includes(h)) out.push('trikona');
  if (UPACHAYAS.includes(h)) out.push('upachaya');
  if (DUSTHANAS.includes(h)) out.push('dusthana');
  if (MARAKA_HOUSES.includes(h)) out.push('maraka');
  if (PANAPARA.includes(h)) out.push('panapara');
  if (APOKLIMA.includes(h)) out.push('apoklima');
  return out;
}

function functionalNature(p: PlanetCode, owned: number[]): 'benefic' | 'malefic' | 'neutral' {
  if (p === 'Ra' || p === 'Ke') return 'malefic';
  const bad = owned.some((h) => [3, 6, 11].includes(h));
  const good = owned.some((h) => [1, 5, 9].includes(h));
  if (good && bad) return 'neutral';
  if (good) return 'benefic';
  if (bad) return 'malefic';
  return 'neutral';
}

interface ChartCtx {
  lagnaSign: number;
  lagnaDeg: number;
  lagnaLon: number;
  sign: Record<PlanetCode, number>;
  deg: Record<PlanetCode, number>;
  lon: Record<PlanetCode, number>;
  house: (p: PlanetCode) => number;
  occupantsOfSign: (s: number) => PlanetCode[];
  planetsInHouse: (h: number) => PlanetCode[];
}

function makeCtx(chart: ParsedChart): ChartCtx {
  const sign = {} as Record<PlanetCode, number>;
  const deg = {} as Record<PlanetCode, number>;
  const lon = {} as Record<PlanetCode, number>;
  for (const p of PLANET_CODES) {
    sign[p] = chart.planets[p].sign;
    deg[p] = chart.planets[p].degInSign;
    lon[p] = chart.planets[p].lon;
  }
  const lagnaSign = chart.lagna.sign;
  const occupantsOfSign = (s: number) => PLANET_CODES.filter((p) => sign[p] === s);
  return {
    lagnaSign,
    lagnaDeg: chart.lagna.degInSign,
    lagnaLon: chart.lagna.lon,
    sign,
    deg,
    lon,
    house: (p) => houseFrom(lagnaSign, sign[p]),
    occupantsOfSign,
    planetsInHouse: (h) => occupantsOfSign(signOfHouse(lagnaSign, h)),
  };
}

// --- aspects ---------------------------------------------------------------------------------------

interface Aspects {
  grahaHouses: Record<PlanetCode, number[]>;
  grahaPlanets: Record<PlanetCode, PlanetCode[]>;
  rasiHouses: Record<PlanetCode, number[]>;
  rasiPlanets: Record<PlanetCode, PlanetCode[]>;
}

function computeAspects(c: ChartCtx): Aspects {
  const grahaHouses = {} as Record<PlanetCode, number[]>;
  const grahaPlanets = {} as Record<PlanetCode, PlanetCode[]>;
  const rasiHouses = {} as Record<PlanetCode, number[]>;
  const rasiPlanets = {} as Record<PlanetCode, PlanetCode[]>;
  for (const p of PLANET_CODES) {
    const from = c.sign[p];
    const gSigns = GRAHA_DRISHTI[p].map((h) => (from + h - 1) % 12);
    grahaHouses[p] = gSigns.map((s) => houseFrom(c.lagnaSign, s)).sort((a, b) => a - b);
    grahaPlanets[p] = PLANET_CODES.filter((q) => q !== p && gSigns.includes(c.sign[q]));
    const rSigns = rasiDrishtiOf(from);
    rasiHouses[p] = rSigns.map((s) => houseFrom(c.lagnaSign, s)).sort((a, b) => a - b);
    rasiPlanets[p] = PLANET_CODES.filter((q) => q !== p && rSigns.includes(c.sign[q]));
  }
  return { grahaHouses, grahaPlanets, rasiHouses, rasiPlanets };
}

// --- motion ----------------------------------------------------------------------------------------

function retroByElongation(c: ChartCtx): Set<PlanetCode> {
  const out = new Set<PlanetCode>(['Ra', 'Ke']);
  for (const p of ['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]) {
    const [lo, hi] = RETRO_LIMITS_FROM_SUN[p]!;
    const e = norm360(c.lon[p] - c.lon.Su);
    if (e > lo && e < hi) out.add(p);
  }
  return out;
}

function combustSet(c: ChartCtx, retro: Set<PlanetCode>): Set<PlanetCode> {
  const out = new Set<PlanetCode>();
  for (const p of ['Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]) {
    const [direct, rx] = COMBUSTION_ORB[p]!;
    const orb = retro.has(p) ? rx : direct;
    const d = Math.abs(((c.lon[p] - c.lon.Su + 540) % 360) - 180);
    if (d <= orb) out.add(p);
  }
  return out;
}

// --- ashtakavarga ----------------------------------------------------------------------------------

function ashtakavarga(c: ChartCtx): { bav: number[][]; sav: number[] } {
  const contributors: Array<PlanetCode | 'La'> = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'La'];
  const bav: number[][] = [];
  for (let p = 0; p < 8; p++) {
    const row = new Array<number>(12).fill(0);
    ASHTAKAVARGA_RULES[p]!.forEach((housesFromContributor, ci) => {
      const contributor = contributors[ci]!;
      const base = contributor === 'La' ? c.lagnaSign : c.sign[contributor];
      for (const h of housesFromContributor) row[(base + h - 1) % 12]! += 1;
    });
    bav.push(row);
  }
  const sav = new Array<number>(12).fill(0);
  for (let p = 0; p < 7; p++) for (let s = 0; s < 12; s++) sav[s]! += bav[p]![s]!;
  return { bav, sav };
}

// --- arudhas ---------------------------------------------------------------------------------------

function countSigns(from: number, to: number): number {
  return ((to - from + 12) % 12) + 1;
}

function bhavaArudhas(c: ChartCtx): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) {
    const hs = signOfHouse(c.lagnaSign, h);
    const lord = SIGN_LORDS[hs]!;
    const ls = c.sign[lord];
    const n = countSigns(hs, ls);
    let arudha = (ls + n - 1) % 12;
    const fromHouse = countSigns(hs, arudha);
    if (fromHouse === 1 || fromHouse === 7) arudha = (arudha + 9) % 12;
    out.push(arudha);
  }
  return out;
}

// --- vimshottari -----------------------------------------------------------------------------------

interface Window {
  from: string;
  to: string;
}

function vimshottari(parsed: ParsedMahadasha[], asOf: string, moonLon: number, birthDate: string | null) {
  // Prefer the engine's MD/AD boundaries (stored legacy JSON); fall back to the Moon-longitude formula.
  let mds: Array<{ md: PlanetCode; start: string; end: string; bhuktis: Array<{ ad: PlanetCode; start: string; end: string }> }> = [];
  if (parsed.length >= 9 && parsed.every((m) => m.bhuktis.length === 9)) {
    for (let i = 0; i < parsed.length; i++) {
      const md = parsed[i]!;
      const mdEnd = i + 1 < parsed.length ? parsed[i + 1]!.start : addDays(md.start, VIMSHOTTARI_YEARS[md.lord as PlanetCode] * SIDEREAL_YEAR_DAYS);
      const bhuktis = md.bhuktis.map((b, j) => ({
        ad: b.lord as PlanetCode,
        start: b.start,
        end: j + 1 < md.bhuktis.length ? md.bhuktis[j + 1]!.start : mdEnd,
      }));
      mds.push({ md: md.lord as PlanetCode, start: md.start, end: mdEnd, bhuktis });
    }
  } else if (birthDate) {
    const nak = Math.floor(moonLon / ONE_STAR);
    const rem = moonLon - nak * ONE_STAR;
    const first = VIMSHOTTARI_ORDER[nak % 9]!;
    const elapsedDays = (rem / ONE_STAR) * VIMSHOTTARI_YEARS[first] * SIDEREAL_YEAR_DAYS;
    let lord = first;
    let start = addDays(birthDate, -elapsedDays);
    for (let i = 0; i < 9; i++) {
      const end = addDays(start, VIMSHOTTARI_YEARS[lord] * SIDEREAL_YEAR_DAYS);
      const bhuktis: Array<{ ad: PlanetCode; start: string; end: string }> = [];
      let adLord = lord;
      let adStart = start;
      for (let j = 0; j < 9; j++) {
        const adEnd = j === 8 ? end : addDays(adStart, (VIMSHOTTARI_YEARS[adLord] * VIMSHOTTARI_YEARS[lord] * SIDEREAL_YEAR_DAYS) / 120);
        bhuktis.push({ ad: adLord, start: adStart, end: adEnd });
        adStart = adEnd;
        adLord = VIMSHOTTARI_ORDER[(VIMSHOTTARI_ORDER.indexOf(adLord) + 1) % 9]!;
      }
      mds.push({ md: lord, start, end, bhuktis });
      start = end;
      lord = VIMSHOTTARI_ORDER[(VIMSHOTTARI_ORDER.indexOf(lord) + 1) % 9]!;
    }
  }
  const window: Window = { from: addDays(asOf, -366), to: addDays(asOf, 3 * 366) };
  const periods: DashaPeriod[] = [];
  const current: DashaCurrent = {};
  for (const md of mds) {
    for (const ad of md.bhuktis) {
      const inWindow = ad.end >= window.from && ad.start <= window.to;
      if (ad.start <= asOf && asOf < ad.end) {
        current.md = md.md;
        current.ad = ad.ad;
        current.md_start = md.start;
        current.md_end = md.end;
        current.ad_start = ad.start;
        current.ad_end = ad.end;
      }
      if (!inWindow) {
        periods.push({ level: 'ad', md: md.md, ad: ad.ad, start: ad.start, end: ad.end });
        continue;
      }
      // PD: proportional split of the AD by Vimshottari years, starting from the AD lord
      const adDays = daysBetween(ad.start, ad.end);
      let pdLord = ad.ad;
      let pdStart = ad.start;
      let cursor = 0;
      for (let k = 0; k < 9; k++) {
        cursor += (VIMSHOTTARI_YEARS[pdLord] / 120) * adDays;
        const pdEnd = k === 8 ? ad.end : addDays(ad.start, Math.round(cursor));
        if (!(pdEnd < window.from || pdStart > window.to)) {
          periods.push({ level: 'pd', md: md.md, ad: ad.ad, pd: pdLord, start: pdStart, end: pdEnd });
        }
        if (pdStart <= asOf && asOf < pdEnd) {
          current.pd = pdLord;
          current.pd_start = pdStart;
          current.pd_end = pdEnd;
        }
        pdStart = pdEnd;
        pdLord = VIMSHOTTARI_ORDER[(VIMSHOTTARI_ORDER.indexOf(pdLord) + 1) % 9]!;
      }
    }
  }
  periods.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    current,
    mahadashas: mds.map((m) => ({ md: m.md, start: m.start, end: m.end })),
    periods,
    window: { pd_from: window.from, pd_to: window.to },
  };
}

function narayana(parsed: ParsedMahadasha[], asOf: string) {
  const periods: NarayanaPeriod[] = [];
  const flat: Array<{ md: number; ad: number; start: string }> = [];
  for (const md of parsed) for (const b of md.bhuktis) flat.push({ md: Number(md.lord), ad: Number(b.lord), start: b.start });
  for (let i = 0; i < flat.length; i++) {
    const row = flat[i]!;
    const end = i + 1 < flat.length ? flat[i + 1]!.start : addDays(row.start, 366);
    periods.push({
      md_sign: row.md, md_sign_name: SIGN_NAMES[row.md]!, md_lord: SIGN_LORDS[row.md]!,
      ad_sign: row.ad, ad_sign_name: SIGN_NAMES[row.ad]!, start: row.start, end,
    });
  }
  // runs of consecutive periods with the same md_sign
  const runs: Array<[number, number]> = [];
  periods.forEach((p, i) => {
    const last = runs[runs.length - 1];
    if (last && periods[last[0]]!.md_sign === p.md_sign && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  let current: Record<string, unknown> = {};
  for (const [a, b] of runs) {
    for (let i = a; i <= b; i++) {
      const p = periods[i]!;
      if (p.start <= asOf && asOf < p.end) {
        current = { ...p, md_start: periods[a]!.start, md_end: periods[b]!.end };
        break;
      }
    }
    if (Object.keys(current).length) break;
  }
  const lo = addDays(asOf, -2 * 366);
  const hi = addDays(asOf, 15 * 366);
  return { current, periods: periods.filter((p) => p.end >= lo && p.start <= hi) };
}

// --- yogas / doshas --------------------------------------------------------------------------------

function associated(c: ChartCtx, a: PlanetCode, b: PlanetCode): boolean {
  if (c.sign[a] === c.sign[b]) return true;
  if (SIGN_LORDS[c.sign[a]] === b && SIGN_LORDS[c.sign[b]] === a) return true;
  const da = ((c.sign[b] - c.sign[a] + 12) % 12) + 1;
  const db = ((c.sign[a] - c.sign[b] + 12) % 12) + 1;
  return GRAHA_DRISHTI[a].includes(da) && GRAHA_DRISHTI[b].includes(db);
}

function computeYogas(c: ChartCtx, lordOf: Record<number, PlanetCode>): Yoga[] {
  const out: Yoga[] = [];
  const seen = new Set<string>();
  const add = (name: string, planets: string[], houses: number[], cls: string, note?: string) => {
    const key = name + '|' + [...planets].sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    const y: Yoga = { name, planets, houses: [...new Set(houses)].sort((a, b) => a - b), class: cls };
    if (note) y.note = note;
    out.push(y);
  };
  const seven: PlanetCode[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
  for (const p of seven) {
    const q = SIGN_LORDS[c.sign[p]]!;
    if (q !== p && SIGN_LORDS[c.sign[q]] === p && PLANET_INDEX[p] < PLANET_INDEX[q]) {
      const hp = c.house(p);
      const hq = c.house(q);
      const dus = [hp, hq].filter((h) => DUSTHANAS.includes(h));
      const kind = dus.length === 0 ? 'Maha' : dus.length === 2 ? 'Khala' : 'Dainya';
      add(`Parivartana (${kind})`, [p, q], [hp, hq], 'exchange');
    }
  }
  if ([0, 3, 6, 9].includes((c.sign.Ju - c.sign.Mo + 12) % 12)) add('Gaja Kesari', ['Ju', 'Mo'], [c.house('Ju'), c.house('Mo')], 'benefic');
  if (c.sign.Su === c.sign.Me) add('Budha-Aditya', ['Su', 'Me'], [c.house('Su')], 'benefic');
  if (c.sign.Mo === c.sign.Ma || (c.sign.Mo - c.sign.Ma + 12) % 12 === 6) add('Chandra-Mangala', ['Mo', 'Ma'], [c.house('Mo'), c.house('Ma')], 'dhana');
  const mahapurusha: Partial<Record<PlanetCode, string>> = { Ma: 'Ruchaka', Me: 'Bhadra', Ju: 'Hamsa', Ve: 'Malavya', Sa: 'Sasa' };
  for (const [p, nm] of Object.entries(mahapurusha) as Array<[PlanetCode, string]>) {
    if (KENDRAS.includes(c.house(p)) && ['own', 'exalted', 'moolatrikona'].includes(dignityOf(p, c.sign[p]))) add(`${nm} (Pancha Mahapurusha)`, [p], [c.house(p)], 'mahapurusha');
  }
  const neighbours = (['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).filter((p) => [0, 1, 11].includes((c.sign[p] - c.sign.Mo + 12) % 12));
  if (neighbours.length === 0) {
    const cancel: string[] = [];
    if (KENDRAS.includes(c.house('Mo'))) cancel.push('Moon in a kendra from Lagna');
    if ([5, 7, 9].includes(((c.sign.Mo - c.sign.Ju + 12) % 12) + 1)) cancel.push('Jupiter aspects the Moon');
    if ((['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).some((p) => [0, 3, 6, 9].includes((c.sign.Mo - c.sign[p] + 12) % 12))) cancel.push('a planet in a kendra from the Moon');
    add('Kemadruma', ['Mo'], [c.house('Mo')], 'affliction', cancel.length ? 'cancelled: ' + cancel.join('; ') : 'no cancellation found');
  }
  const l9 = lordOf[9]!;
  const l10 = lordOf[10]!;
  if (l9 !== l10 && associated(c, l9, l10)) add('Dharma-Karmadhipati', [l9, l10], [9, 10, c.house(l9), c.house(l10)], 'raja');
  for (const kh of [4, 7, 10]) for (const th of [5, 9]) {
    const a = lordOf[kh]!;
    const b = lordOf[th]!;
    if (a !== b && associated(c, a, b)) add(`Raja Yoga (lords of ${kh} and ${th})`, [a, b], [kh, th, c.house(a), c.house(b)], 'raja');
  }
  for (const wh of [2, 11]) for (const th of [1, 5, 9]) {
    const a = lordOf[wh]!;
    const b = lordOf[th]!;
    if (a !== b && associated(c, a, b)) add(`Dhana Yoga (lords of ${wh} and ${th})`, [a, b], [wh, th, c.house(a), c.house(b)], 'dhana');
  }
  for (const dh of DUSTHANAS) {
    const l = lordOf[dh]!;
    if (DUSTHANAS.includes(c.house(l)) && c.house(l) !== dh) add(`Viparita Raja Yoga (lord of ${dh} in ${c.house(l)})`, [l], [dh, c.house(l)], 'viparita');
  }
  for (const p of seven) {
    if (dignityOf(p, c.sign[p]) === 'debilitated') {
      const sl = SIGN_LORDS[c.sign[p]]!;
      if (KENDRAS.includes(c.house(sl)) || [0, 3, 6, 9].includes((c.sign[sl] - c.sign.Mo + 12) % 12)) add('Neecha Bhanga', [p, sl], [c.house(p), c.house(sl)], 'cancellation');
    }
  }
  // Kala Sarpa: all seven planets on one side of the Rahu–Ketu axis
  const ra = c.sign.Ra;
  const side = seven.map((p) => (c.sign[p] - ra + 12) % 12).filter((d) => d !== 0 && d !== 6);
  if (side.length === 7 && (side.every((d) => d < 6) || side.every((d) => d > 6))) add('Kala Sarpa', ['Ra', 'Ke'], [c.house('Ra'), c.house('Ke')], 'affliction');
  // Sunapha / Anapha / Durudhara (planets other than Sun in 2nd / 12th from Moon)
  const in2 = (['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).filter((p) => (c.sign[p] - c.sign.Mo + 12) % 12 === 1);
  const in12 = (['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).filter((p) => (c.sign[p] - c.sign.Mo + 12) % 12 === 11);
  if (in2.length && in12.length) add('Durudhara', ['Mo', ...in2, ...in12], [c.house('Mo')], 'chandra');
  else if (in2.length) add('Sunapha', ['Mo', ...in2], [c.house('Mo')], 'chandra');
  else if (in12.length) add('Anapha', ['Mo', ...in12], [c.house('Mo')], 'chandra');
  // Adhi yoga: benefics in 6, 7, 8 from the Moon
  const adhi = (['Me', 'Ju', 'Ve'] as PlanetCode[]).filter((p) => [5, 6, 7].includes((c.sign[p] - c.sign.Mo + 12) % 12));
  if (adhi.length >= 2) add('Adhi Yoga', ['Mo', ...adhi], [c.house('Mo')], 'benefic');
  // Vesi / Vosi / Ubhayachari (planets other than Moon in 2nd / 12th from Sun)
  const s2 = (['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).filter((p) => (c.sign[p] - c.sign.Su + 12) % 12 === 1);
  const s12 = (['Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]).filter((p) => (c.sign[p] - c.sign.Su + 12) % 12 === 11);
  if (s2.length && s12.length) add('Ubhayachari', ['Su', ...s2, ...s12], [c.house('Su')], 'surya');
  else if (s2.length) add('Vesi', ['Su', ...s2], [c.house('Su')], 'surya');
  else if (s12.length) add('Vosi', ['Su', ...s12], [c.house('Su')], 'surya');
  // Guru-Chandala
  if (c.sign.Ju === c.sign.Ra || c.sign.Ju === c.sign.Ke) add('Guru Chandala', ['Ju', c.sign.Ju === c.sign.Ra ? 'Ra' : 'Ke'], [c.house('Ju')], 'affliction');
  return out;
}

function computeDoshas(c: ChartCtx, moonNakIdx: number): Dosha[] {
  const out: Dosha[] = [];
  const marsHouse = c.house('Ma');
  const manglikHouses = [1, 2, 4, 7, 8, 12];
  const fromMoon = ((c.sign.Ma - c.sign.Mo + 12) % 12) + 1;
  const fromVenus = ((c.sign.Ma - c.sign.Ve + 12) % 12) + 1;
  const present = manglikHouses.includes(marsHouse);
  const notes: string[] = [];
  if (manglikHouses.includes(fromMoon)) notes.push(`also ${fromMoon} from Moon`);
  if (manglikHouses.includes(fromVenus)) notes.push(`also ${fromVenus} from Venus`);
  out.push({ name: 'Manglik', present, planets: ['Ma'], houses: [marsHouse], note: notes.join('; ') || undefined });
  const seven: PlanetCode[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
  const side = seven.map((p) => (c.sign[p] - c.sign.Ra + 12) % 12).filter((d) => d !== 0 && d !== 6);
  out.push({ name: 'Kala Sarpa', present: side.length === 7 && (side.every((d) => d < 6) || side.every((d) => d > 6)), planets: ['Ra', 'Ke'] });
  out.push({ name: 'Guru Chandala', present: c.sign.Ju === c.sign.Ra || c.sign.Ju === c.sign.Ke, planets: ['Ju', 'Ra', 'Ke'] });
  out.push({ name: 'Ganda Moola (Moon)', present: GANDA_MOOLA_NAKS.has(moonNakIdx), planets: ['Mo'] });
  return out;
}

// --- panchanga -------------------------------------------------------------------------------------

function panchanga(c: ChartCtx, birth: { date: string | null; time: string | null; sunrise: string | null; sunset: string | null; lunarYearMonth: string | null }) {
  const elong = norm360(c.lon.Mo - c.lon.Su);
  const tithiIdx = Math.floor(elong / 12) + 1; // 1..30
  const paksha = tithiIdx <= 15 ? 'Shukla' : 'Krishna';
  const inPaksha = tithiIdx <= 15 ? tithiIdx : tithiIdx - 15;
  let tithiName = TITHI_NAMES[inPaksha - 1] ?? String(inPaksha);
  if (tithiIdx === 30) tithiName = 'Amavasya';
  const yogaIdx = Math.floor(norm360(c.lon.Su + c.lon.Mo) / ONE_STAR) + 1;
  const karanaIdx = Math.floor(elong / 6) + 1; // 1..60
  const karana = KARANA_FIXED[karanaIdx] ?? KARANA_CYCLE[(karanaIdx - 2) % 7]!;
  const moonNak = nakOf(c.lon.Mo);
  const out: Record<string, unknown> = {
    tithi: `${paksha} ${tithiName}`,
    tithi_idx: tithiIdx,
    paksha,
    tithi_lord: PLANET_CODES[(inPaksha - 1) % 9],
    nakshatra: moonNak.name,
    nakshatra_lord: moonNak.lord,
    nakshatra_pada: moonNak.pada,
    yoga: YOGA_NAMES[yogaIdx - 1],
    karana,
    moon_sign: c.sign.Mo,
    moon_sign_name: SIGN_NAMES[c.sign.Mo],
    lagna_sign: c.lagnaSign,
    lagna_sign_name: SIGN_NAMES[c.lagnaSign],
  };
  if (birth.sunrise) out.sunrise = birth.sunrise;
  if (birth.sunset) out.sunset = birth.sunset;
  if (birth.lunarYearMonth) out.lunar_year_month = birth.lunarYearMonth;
  if (birth.date) {
    let civil = new Date(birth.date + 'T00:00:00Z');
    if (birth.time && birth.sunrise) {
      const t = birth.time.split(':').map(Number);
      const s = birth.sunrise.split(':').map(Number);
      const th = (t[0] ?? 0) + (t[1] ?? 0) / 60;
      const sh = (s[0] ?? 0) + (s[1] ?? 0) / 60;
      if (th < sh) civil = new Date(civil.getTime() - 86400000);
    }
    const v = civil.getUTCDay();
    out.vara = VARA_LORDS[v];
    out.vara_name = VARA_NAMES[v];
  }
  return out;
}

// --- main ------------------------------------------------------------------------------------------

export interface BuildDossierOptions {
  asOf?: string; // YYYY-MM-DD, default today (UTC)
  engineCommit?: string;
}

export function buildDossier(fields: LegacyKundliFields, opts: BuildDossierOptions = {}): Dossier {
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const d1 = parseChartRows(fields.d1);
  if (!d1) throw new DossierBuildError('kundli d1 is missing or unparseable');
  const bio = parseBiodata(fields.biodata);
  const c = makeCtx(d1);
  const vargaCharts: Partial<Record<VargaKey, ParsedChart>> = { D1: d1 };
  const missing: string[] = [];
  for (const key of VARGA_KEYS) {
    if (key === 'D1') continue;
    const raw = (fields as Record<string, unknown>)[key.toLowerCase()];
    const parsed = parseChartRows(raw);
    if (parsed) vargaCharts[key] = parsed;
    else missing.push(key);
  }
  for (const k of ['D3', 'D12', 'D30', 'D60']) missing.push(k);

  // lordships
  const lordOf: Record<number, PlanetCode> = {};
  const housesOf: Record<PlanetCode, number[]> = { Su: [], Mo: [], Ma: [], Me: [], Ju: [], Ve: [], Sa: [], Ra: [], Ke: [] };
  const coLordOf: Partial<Record<number, PlanetCode>> = {};
  for (let h = 1; h <= 12; h++) {
    const s = signOfHouse(c.lagnaSign, h);
    lordOf[h] = SIGN_LORDS[s]!;
    housesOf[SIGN_LORDS[s]!].push(h);
    if (CO_LORDS[s]) coLordOf[h] = CO_LORDS[s];
  }

  const aspects = computeAspects(c);
  const retro = retroByElongation(c);
  const combust = combustSet(c, retro);
  const { bav, sav } = ashtakavarga(c);
  const moonNak = nakOf(c.lon.Mo);
  const paksha = norm360(c.lon.Mo - c.lon.Su) < 180 ? 'Shukla' : 'Krishna';

  // natural benefics (PVR method 2): Ju, Ve; Moon by paksha; Mercury by company
  const naturalBenefics = new Set<PlanetCode>(['Ju', 'Ve']);
  const naturalMalefics = new Set<PlanetCode>(['Su', 'Ma', 'Sa', 'Ra', 'Ke']);
  (paksha === 'Shukla' ? naturalBenefics : naturalMalefics).add('Mo');
  const withMe = PLANET_CODES.filter((p) => p !== 'Me' && c.sign[p] === c.sign.Me);
  const meMal = withMe.filter((p) => naturalMalefics.has(p)).length;
  const meBen = withMe.filter((p) => naturalBenefics.has(p)).length;
  (meMal > meBen ? naturalMalefics : naturalBenefics).add('Me');

  // navamsa signs from D9 (or the D1 export's navamsa column is not needed)
  const d9 = vargaCharts.D9;
  const navamsaSign = (p: PlanetCode): number | null => (d9 ? d9.planets[p].sign : null);

  // pushkara
  const pushkaraNav: PlanetCode[] = [];
  const pushkaraBhaga: PlanetCode[] = [];
  for (const p of PLANET_CODES) {
    const s = c.sign[p];
    const d = c.deg[p];
    const st = PUSHKARA_NAVAMSA_START[s]!;
    if ((d >= st && d < st + 30 / 9) || (d >= st + 60 / 9 && d < st + 10)) pushkaraNav.push(p);
    if (d >= PUSHKARA_BHAGA[s]! - 1 && d < PUSHKARA_BHAGA[s]!) pushkaraBhaga.push(p);
  }

  // bodies
  const bodies: Record<string, Body | LagnaBody | ExtraBody> = {};
  const laNak = nakOf(c.lagnaLon);
  bodies[LAGNA_CODE] = {
    lon: r3(c.lagnaLon), sign: c.lagnaSign, sign_name: SIGN_NAMES[c.lagnaSign]!, deg_in_sign: r3(c.lagnaDeg), house: 1, nak: laNak,
    navamsa_sign: d9 ? d9.lagna.sign : null,
    sign_lord: SIGN_LORDS[c.lagnaSign]!, sign_lord_house: c.house(SIGN_LORDS[c.lagnaSign]!),
    star_lord: laNak.lord, star_lord_house: c.house(laNak.lord),
    conj: c.occupantsOfSign(c.lagnaSign),
    flags: isGandanta(c.lagnaSign, c.lagnaDeg) ? ['gandanta'] : [],
  };
  for (const p of PLANET_CODES) {
    const s = c.sign[p];
    const nak = nakOf(c.lon[p]);
    const flags: string[] = [];
    if (combust.has(p)) flags.push('combust');
    if (retro.has(p) && p !== 'Ra' && p !== 'Ke') flags.push('retro');
    if (isGandanta(s, c.deg[p])) flags.push('gandanta');
    if (pushkaraNav.includes(p)) flags.push('pushkara_navamsa');
    if (pushkaraBhaga.includes(p)) flags.push('pushkara_bhaga');
    const nav = navamsaSign(p);
    if (nav != null && nav === s) flags.push('vargottama');
    bodies[p] = {
      lon: r3(c.lon[p]), sign: s, sign_name: SIGN_NAMES[s]!, deg_in_sign: r3(c.deg[p]), house: c.house(p), nak,
      navamsa_sign: nav, dignity: dignityOf(p, s), retro: retro.has(p), combust: combust.has(p), owns: housesOf[p],
      nature: { natural: naturalBenefics.has(p) ? 'benefic' : 'malefic', functional: functionalNature(p, housesOf[p]) },
      conj: c.occupantsOfSign(s).filter((q) => q !== p),
      aspects_to: { graha: aspects.grahaHouses[p], rasi: aspects.rasiHouses[p] },
      aspected_by: {
        graha: PLANET_CODES.filter((q) => aspects.grahaPlanets[q].includes(p)),
        rasi: PLANET_CODES.filter((q) => aspects.rasiPlanets[q].includes(p)),
      },
      star_lord: nak.lord, star_lord_house: c.house(nak.lord),
      sign_lord: SIGN_LORDS[s]!, sign_lord_house: c.house(SIGN_LORDS[s]!),
      bav_at_sign: PLANET_INDEX[p] <= 6 ? bav[PLANET_INDEX[p]]![s]! : null,
      tara_from_janma: taraFrom(moonNak.idx, nak.idx),
      flags,
    };
  }
  for (const code of ['Md', 'Gk'] as const) {
    const pt: ParsedPoint | undefined = d1.extras[code];
    if (!pt) continue;
    const nak = nakOf(pt.lon);
    bodies[code] = {
      lon: r3(pt.lon), sign: pt.sign, sign_name: SIGN_NAMES[pt.sign]!, deg_in_sign: r3(pt.degInSign), house: houseFrom(c.lagnaSign, pt.sign), nak,
      sign_lord: SIGN_LORDS[pt.sign]!, star_lord: nak.lord, tara_from_janma: taraFrom(moonNak.idx, nak.idx),
    };
  }

  // houses
  const houses: Record<string, House> = {};
  for (let h = 1; h <= 12; h++) {
    const s = signOfHouse(c.lagnaSign, h);
    const lord = lordOf[h]!;
    const argalaFrom = (offsets: number[]) => offsets.flatMap((o) => c.planetsInHouse(((h + o - 2) % 12) + 1));
    const cuspNak = nakOf(norm360(c.lagnaLon + (h - 1) * 30));
    const entry: House = {
      sign: s, sign_name: SIGN_NAMES[s]!, lord, lord_house: c.house(lord), lord_sign: c.sign[lord], lord_dignity: dignityOf(lord, c.sign[lord]),
      occupants: c.planetsInHouse(h),
      aspected_by: {
        graha: PLANET_CODES.filter((p) => aspects.grahaHouses[p].includes(h)),
        rasi: PLANET_CODES.filter((p) => aspects.rasiHouses[p].includes(h)),
      },
      argala: { primary: argalaFrom(ARGALA_PRIMARY), secondary: argalaFrom(ARGALA_SECONDARY), obstructed_by: argalaFrom(VIRODHARGALA) },
      sav: sav[s]!,
      class: classOfHouse(h),
      cusp_nak: { name: cuspNak.name, lord: cuspNak.lord, pada: cuspNak.pada },
    };
    if (coLordOf[h]) {
      entry.co_lord = coLordOf[h];
      entry.co_lord_house = c.house(coLordOf[h]!);
    }
    houses[String(h)] = entry;
  }

  // vargas
  const vargas: Partial<Record<VargaKey, Varga>> = {};
  for (const key of VARGA_KEYS) {
    const vc = vargaCharts[key];
    if (!vc) continue;
    const vl = vc.lagna.sign;
    const planets = {} as Record<PlanetCode, Varga['planets'][PlanetCode]>;
    for (const p of PLANET_CODES) {
      const vs = vc.planets[p].sign;
      planets[p] = { sign: vs, house: houseFrom(vl, vs), dignity: dignityOf(p, vs), vargottama: vs === c.sign[p] };
    }
    const vh: Varga['houses'] = {};
    for (let h = 1; h <= 12; h++) {
      const vs = signOfHouse(vl, h);
      vh[String(h)] = { sign: vs, lord: SIGN_LORDS[vs]!, occupants: PLANET_CODES.filter((p) => vc.planets[p].sign === vs) };
    }
    const d1lp: Varga['d1_lord_positions'] = {};
    for (let h = 1; h <= 12; h++) {
      const lord = lordOf[h]!;
      const vs = vc.planets[lord].sign;
      d1lp[String(h)] = { lord, varga_sign: vs, varga_house: houseFrom(vl, vs), varga_dignity: dignityOf(lord, vs) };
    }
    vargas[key] = {
      name: VARGA_NAMES[key], lagna_sign: vl, lagna_sign_name: SIGN_NAMES[vl]!, lagna_lord: SIGN_LORDS[vl]!,
      lagna_lord_house: houseFrom(vl, vc.planets[SIGN_LORDS[vl]!].sign), planets, houses: vh, d1_lord_positions: d1lp,
    };
  }

  // karakas (from the engine's charakaraka export; fall back to longitude ordering)
  let chara = parseCharakaraka(fields.charakaraka);
  if (Object.keys(chara).length < 7) {
    const order = (['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra'] as PlanetCode[])
      .map((p) => ({ p, d: p === 'Ra' ? 30 - c.deg[p] : c.deg[p] }))
      .sort((a, b) => b.d - a.d);
    chara = {};
    KARAKA_CODES.forEach((k, i) => {
      if (order[i]) chara[k] = order[i]!.p;
    });
  }
  const ak = chara.AK;
  const karakamsaSign = ak ? navamsaSign(ak) : null;

  // arudhas
  const ba = bhavaArudhas(c);
  const arudhas: Dossier['arudhas'] = {};
  ba.forEach((s, i) => {
    const entry = { sign: s, sign_name: SIGN_NAMES[s]!, house: houseFrom(c.lagnaSign, s), occupants: c.occupantsOfSign(s), lord: SIGN_LORDS[s]! };
    arudhas[`A${i + 1}`] = entry;
    if (i === 0) arudhas.AL = entry;
    if (i === 11) arudhas.UL = entry;
  });

  // special lagnas from the D1 export extras
  const special: Dossier['special_lagnas'] = {};
  for (const code of ['BL', 'HL', 'GL', 'VL', 'VNL', 'SL', 'PL', 'IL', 'BB']) {
    const pt = d1.extras[code];
    if (!pt) continue;
    const nak = nakOf(pt.lon);
    special[code] = { lon: r3(pt.lon), sign: pt.sign, sign_name: SIGN_NAMES[pt.sign]!, house: houseFrom(c.lagnaSign, pt.sign), nak: { name: nak.name, lord: nak.lord, pada: nak.pada }, occupants: c.occupantsOfSign(pt.sign) };
  }

  const yogas = computeYogas(c, lordOf);
  const doshas = computeDoshas(c, moonNak.idx);
  const vim = vimshottari(parseVimsottari(fields.vimsottari_dasa), asOf, c.lon.Mo, bio.date);
  const nar = narayana(parseNarayana(fields.narayana_dasa), asOf);

  // nakshatra profile
  const starLords: Record<string, unknown> = {};
  for (const p of PLANET_CODES) {
    const b = bodies[p] as Body;
    starLords[p] = {
      nak: b.nak.name, pada: b.nak.pada, star_lord: b.star_lord, star_lord_house: b.star_lord_house,
      star_lord_sign_lord: (bodies[b.star_lord] as Body).sign_lord, tara: b.tara_from_janma, navamsa_sign: b.navamsa_sign,
    };
  }
  const taras: Record<string, string> = {};
  NAKSHATRA_NAMES.forEach((n, i) => {
    taras[n] = taraFrom(moonNak.idx, i);
  });
  const nakshatraProfile: Record<string, unknown> = {
    janma: { ...moonNak, deity: NAKSHATRA_DEITIES[moonNak.idx], gana: NAKSHATRA_GANA[moonNak.idx], symbol: NAKSHATRA_SYMBOLS[moonNak.idx], lord_house: c.house(moonNak.lord) },
    lagna: { ...laNak, lord_house: c.house(laNak.lord) },
    taras_from_janma: taras,
    star_lords: starLords,
    gandanta: { moon: isGandanta(c.sign.Mo, c.deg.Mo), lagna: isGandanta(c.lagnaSign, c.lagnaDeg) },
    pushkara: { navamsa: pushkaraNav, bhaga: pushkaraBhaga },
    arudha_lagna_sign: arudhas.AL?.sign ?? null,
    tenth_cusp_nak: houses['10']!.cusp_nak,
  };

  // relations
  const exchanges: string[][] = [];
  for (const p of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]) {
    const q = SIGN_LORDS[c.sign[p]]!;
    if (q !== p && SIGN_LORDS[c.sign[q]] === p && PLANET_INDEX[p] < PLANET_INDEX[q]) exchanges.push([p, q]);
  }
  let yogakaraka: PlanetCode | null = null;
  for (const p of ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'] as PlanetCode[]) {
    const owned = housesOf[p];
    if (owned.some((h) => [4, 7, 10].includes(h)) && owned.some((h) => [5, 9].includes(h))) yogakaraka = p;
  }
  const functional = { benefic: [] as string[], malefic: [] as string[], neutral: [] as string[] };
  for (const p of PLANET_CODES) functional[(bodies[p] as Body).nature.functional].push(p);
  const conjunctions: string[][] = [];
  for (let s = 0; s < 12; s++) {
    const occ = c.occupantsOfSign(s);
    if (occ.length > 1) conjunctions.push(occ);
  }
  const marakas = [...new Set<PlanetCode>([lordOf[2]!, lordOf[7]!, ...c.planetsInHouse(2), ...c.planetsInHouse(7)])].sort((a, b) => PLANET_INDEX[a] - PLANET_INDEX[b]);

  return {
    v: FACTS_VERSION,
    engine: {
      source: 'node:legacy-kundli',
      pyjhora: '4.5.0',
      commit: opts.engineCommit ?? 'unknown',
      ayanamsa: 'LAHIRI',
      ayanamsa_deg: bio.ayanamsaDeg == null ? null : Math.round(bio.ayanamsaDeg * 100000) / 100000,
      houses: 'whole_sign',
    },
    as_of: asOf,
    birth: { date: bio.date, time: bio.time, tz: bio.tz, lat: bio.lat, lon: bio.lon, place: bio.placeName ?? '' },
    panchanga: panchanga(c, bio),
    bodies,
    houses,
    vargas,
    vargas_missing: missing,
    karakas: {
      chara,
      chara_houses: Object.fromEntries(Object.entries(chara).map(([k, p]) => [k, c.house(p)])),
      karakamsa: { sign: karakamsaSign, sign_name: karakamsaSign == null ? null : SIGN_NAMES[karakamsaSign]! },
      natural: NATURAL_KARAKAS,
    },
    arudhas,
    special_lagnas: special,
    yogas,
    doshas,
    ashtakavarga: { sav, bav: Object.fromEntries(PLANET_CODES.slice(0, 7).map((p, i) => [p, bav[i]!])), bav_lagna: bav[7]! },
    dasha: { vimshottari: vim, narayana: nar },
    nakshatra_profile: nakshatraProfile,
    relations: {
      exchanges,
      lord_of: Object.fromEntries(Object.entries(lordOf).map(([h, p]) => [h, p])) as Record<string, PlanetCode>,
      houses_of: Object.fromEntries(PLANET_CODES.filter((p) => housesOf[p].length).map((p) => [p, housesOf[p]])),
      kendra_trikona_lords: [...new Set([1, 4, 5, 7, 9, 10].map((h) => lordOf[h]!))].sort((a, b) => PLANET_INDEX[a] - PLANET_INDEX[b]),
      dusthana_lords: [...new Set(DUSTHANAS.map((h) => lordOf[h]!))].sort((a, b) => PLANET_INDEX[a] - PLANET_INDEX[b]),
      marakas,
      yogakaraka,
      functional,
      natural_benefics: PLANET_CODES.filter((p) => naturalBenefics.has(p)),
      natural_malefics: PLANET_CODES.filter((p) => naturalMalefics.has(p)),
      conjunctions,
      lagna_lord: SIGN_LORDS[c.lagnaSign]!,
      lagna_lord_house: c.house(SIGN_LORDS[c.lagnaSign]!),
      moon_sign_lord: SIGN_LORDS[c.sign.Mo]!,
    },
  };
}

/** Longitudes only: planets, lagna, special lagnas, arudha signs (for the transit join). */
export function natalPointsFromDossier(d: Dossier): NatalPoints {
  const points: NatalPoints['points'] = {};
  for (const [code, b] of Object.entries(d.bodies)) {
    const nak = nakOf(b.lon);
    points[code] = { lon: b.lon, sign: b.sign, nak: nak.idx, nak_name: nak.name, house: b.house };
  }
  for (const [code, s] of Object.entries(d.special_lagnas)) {
    points[code] = { lon: s.lon, sign: s.sign, nak: nakOf(s.lon).idx, nak_name: nakOf(s.lon).name, house: s.house };
  }
  const arudhaSigns: Record<string, number> = {};
  for (const [k, a] of Object.entries(d.arudhas)) arudhaSigns[k] = a.sign;
  return { v: 1, lagna_sign: d.bodies[LAGNA_CODE]!.sign, moon_sign: d.bodies.Mo!.sign, points, arudha_signs: arudhaSigns, lord_of: d.relations.lord_of };
}
