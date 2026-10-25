/**
 * Parse the legacy kundli JSON columns (as exported by the pyjhora `export-horoscope` API and stored in
 * `kundlis.d1 … d10`, `charakaraka`, `vimsottari_dasa`, `narayana_dasa`, `biodata`) into numeric,
 * normalised structures. This is the only place that knows the legacy string formats.
 */
import { PLANET_CODES, SIGN_SHORT, type PlanetCode } from './constants.js';

export interface LegacyRow {
  body: string;
  longitude: string;
  nakshatra?: string;
  pada?: string;
  rasi?: string;
  navamsa?: string;
  karaka?: string;
}

export interface ParsedPoint {
  /** 0..359.999 sidereal longitude */
  lon: number;
  sign: number;
  degInSign: number;
}

export interface ParsedChart {
  lagna: ParsedPoint;
  planets: Record<PlanetCode, ParsedPoint>;
  /** Extra bodies by canonical key (Md, Gk, BL, HL, GL, VL, VNL, SL, PL, IL, BB, Dhuma…) */
  extras: Record<string, ParsedPoint>;
}

export interface ParsedDashaPeriod {
  lord: string;
  start: string; // YYYY-MM-DD
}
export interface ParsedMahadasha {
  lord: string;
  start: string;
  bhuktis: ParsedDashaPeriod[];
}

export interface ParsedBiodata {
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM:SS
  tz: number | null;
  lat: number | null;
  lon: number | null;
  placeName: string | null;
  sunrise: string | null;
  sunset: string | null;
  ayanamsaDeg: number | null;
  lunarYearMonth: string | null;
}

const BODY_TO_CODE: Record<string, PlanetCode> = {
  sun: 'Su', moon: 'Mo', mars: 'Ma', mercury: 'Me', jupiter: 'Ju', venus: 'Ve', saturn: 'Sa',
  rahu: 'Ra', raagu: 'Ra', ketu: 'Ke', kethu: 'Ke',
};

const EXTRA_TO_CODE: Record<string, string> = {
  maandi: 'Md', gulika: 'Gk', 'bhava lagna': 'BL', 'hora lagna': 'HL', 'ghati lagna': 'GL', 'vighati lagna': 'VL',
  'varnada lagna': 'VNL', 'sree lagna': 'SL', 'pranapada lagna': 'PL', 'indu lagna': 'IL', 'bhrigu bindhu lagna': 'BB',
  dhuma: 'Dhuma', vyatipaata: 'Vyatipata', parivesha: 'Parivesha', 'indra chapa': 'IndraChapa', upaketu: 'Upaketu',
  kaala: 'Kaala', mrityu: 'Mrityu', artha: 'ArthaPrahara', yama: 'YamaGhantaka',
};

/** Strip astrological symbols and whitespace from pyjhora names ("Raagu☊", "♓︎Pisces"). */
export function cleanName(raw: string): string {
  return raw
    .replace(/[☀-➿︎️⭐☽-♓]/g, '')
    .replace(/[^\p{L}\p{N} ()-]/gu, '')
    .trim();
}

export function planetCodeFromName(raw: string): PlanetCode | null {
  const key = cleanName(raw).toLowerCase().split(/[\s-]/)[0] ?? '';
  return BODY_TO_CODE[key] ?? null;
}

const SIGN_NAME_TO_INDEX: Record<string, number> = {
  aries: 0, mesha: 0, taurus: 1, vrishabha: 1, gemini: 2, mithuna: 2, cancer: 3, karka: 3, leo: 4, simha: 4,
  virgo: 5, kanya: 5, libra: 6, tula: 6, scorpio: 7, vrischika: 7, sagittarius: 8, dhanu: 8,
  capricorn: 9, makara: 9, aquarius: 10, kumbha: 10, pisces: 11, meena: 11,
};

export function signIndexFromName(raw: string): number | null {
  const key = cleanName(raw).toLowerCase();
  if (key in SIGN_NAME_TO_INDEX) return SIGN_NAME_TO_INDEX[key]!;
  const short = SIGN_SHORT.findIndex((s) => s.toLowerCase() === key.slice(0, 2));
  return short >= 0 ? short : null;
}

/** "20 Vi 12' 19.00\"" → { lon, sign, degInSign }. Returns null for "N/A". */
export function parseLongitude(raw: string | undefined | null): ParsedPoint | null {
  if (!raw) return null;
  const m = /^\s*(\d+)\s+([A-Za-z]{2})\s+(\d+)\s*'\s*([\d.]+)\s*"?\s*$/.exec(raw.trim());
  if (!m) return null;
  const sign = SIGN_SHORT.findIndex((s) => s.toLowerCase() === m[2]!.toLowerCase());
  if (sign < 0) return null;
  const degInSign = Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
  if (!Number.isFinite(degInSign) || degInSign < 0 || degInSign >= 30) return null;
  return { lon: sign * 30 + degInSign, sign, degInSign };
}

export function parseChartRows(rows: unknown): ParsedChart | null {
  if (!Array.isArray(rows)) return null;
  const planets: Partial<Record<PlanetCode, ParsedPoint>> = {};
  const extras: Record<string, ParsedPoint> = {};
  let lagna: ParsedPoint | null = null;
  for (const r of rows as LegacyRow[]) {
    if (!r || typeof r.body !== 'string') continue;
    const pt = parseLongitude(r.longitude);
    if (!pt) continue;
    const body = cleanName(r.body).toLowerCase();
    if (body === 'lagna' || body === 'ascendant') {
      lagna = pt;
      continue;
    }
    const code = planetCodeFromName(r.body);
    if (code) {
      planets[code] = pt;
      continue;
    }
    const extra = EXTRA_TO_CODE[body];
    if (extra) extras[extra] = pt;
  }
  if (!lagna) return null;
  for (const c of PLANET_CODES) if (!planets[c]) return null;
  return { lagna, planets: planets as Record<PlanetCode, ParsedPoint>, extras };
}

export function parseCharakaraka(raw: unknown): Record<string, PlanetCode> {
  const out: Record<string, PlanetCode> = {};
  if (!Array.isArray(raw)) return out;
  for (const r of raw as Array<{ karaka_code?: string; planet?: string }>) {
    const code = planetCodeFromName(String(r?.planet ?? ''));
    if (r?.karaka_code && code) out[r.karaka_code] = code;
  }
  return out;
}

function dateOnly(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

export function parseVimsottari(raw: unknown): ParsedMahadasha[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedMahadasha[] = [];
  for (const md of raw as Array<{ maha_dasha_lord?: string; maha_start_date?: string; bhuktis?: Array<{ lord?: string; start_date?: string }> }>) {
    const lord = planetCodeFromName(String(md?.maha_dasha_lord ?? ''));
    const start = dateOnly(md?.maha_start_date);
    if (!lord || !start) continue;
    const bhuktis: ParsedDashaPeriod[] = [];
    for (const b of md.bhuktis ?? []) {
      const bl = planetCodeFromName(String(b?.lord ?? ''));
      const bs = dateOnly(b?.start_date);
      if (bl && bs) bhuktis.push({ lord: bl, start: bs });
    }
    out.push({ lord, start, bhuktis });
  }
  return out;
}

export function parseNarayana(raw: unknown): ParsedMahadasha[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedMahadasha[] = [];
  for (const md of raw as Array<{ maha_dasha_lord?: string; maha_start_date?: string; bhuktis?: Array<{ lord?: string; start_date?: string }> }>) {
    const sign = signIndexFromName(String(md?.maha_dasha_lord ?? ''));
    const start = dateOnly(md?.maha_start_date);
    if (sign == null || !start) continue;
    const bhuktis: ParsedDashaPeriod[] = [];
    for (const b of md.bhuktis ?? []) {
      const bs = signIndexFromName(String(b?.lord ?? ''));
      const st = dateOnly(b?.start_date);
      if (bs != null && st) bhuktis.push({ lord: String(bs), start: st });
    }
    out.push({ lord: String(sign), start, bhuktis });
  }
  return out;
}

/** "77 E 01' 00\", 28 N 55' 00\"" → { lon: 77.0167, lat: 28.9167 } */
export function parseCoordString(raw: string | undefined | null): { lat: number | null; lon: number | null } {
  const out = { lat: null as number | null, lon: null as number | null };
  if (!raw) return out;
  const re = /(\d+)\s*([NSEW])\s*(\d+)'\s*([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const v = Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
    const dir = m[2]!;
    if (dir === 'N' || dir === 'S') out.lat = dir === 'S' ? -v : v;
    else out.lon = dir === 'W' ? -v : v;
  }
  if (out.lat != null) out.lat = Math.round(out.lat * 10000) / 10000;
  if (out.lon != null) out.lon = Math.round(out.lon * 10000) / 10000;
  return out;
}

/** "5:30:00" → 5.5 ; "-5:00:00" → -5 */
export function parseTz(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = /^\s*(-?)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(raw);
  if (!m) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const v = Number(m[2]) + Number(m[3]) / 60;
  return m[1] === '-' ? -v : v;
}

export function parseBiodata(raw: unknown): ParsedBiodata {
  const b = (raw ?? {}) as Record<string, unknown>;
  const str = (k: string): string | null => (typeof b[k] === 'string' && (b[k] as string).trim() && b[k] !== 'N/A' ? (b[k] as string).trim() : null);
  const coords = parseCoordString(str('place'));
  let date: string | null = null;
  const d = str('date');
  if (d) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
    if (m) date = `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  }
  let ayan: number | null = null;
  const a = str('ayanamsa');
  if (a) {
    const m = /^(\d+)-(\d+)-([\d.]+)$/.exec(a);
    if (m) ayan = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  }
  return {
    date,
    time: str('time'),
    tz: parseTz(str('time_zone')),
    lat: coords.lat,
    lon: coords.lon,
    placeName: str('place_name'),
    sunrise: str('sunrise'),
    sunset: str('sunset'),
    ayanamsaDeg: ayan,
    lunarYearMonth: str('lunar_yr_mo'),
  };
}
