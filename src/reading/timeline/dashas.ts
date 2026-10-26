/**
 * Dasha stack (docs/reading-engine/27 §B.4 stage 2): one normalised period table per system,
 * `{ system, level, lord | sign, from, to }`, read from Radha's catalogue payloads through `normalizeDasha` (both the v2
 * node shape and the legacy arrays). Pure reshaping: every date and lord is Radha's; nothing is computed here.
 *
 * Sources, finest first:
 * - Vimshottari: catalogue `dasha.vimsottari` (MD, AD) plus the dossier's PD rows (`dasha.vimshottari.periods`, level
 *   pd, which Radha serves around today only); the dossier's AD rows when the catalogue item is missing.
 * - Yogini, Tithi Ashtottari, Ashtottari: catalogue `dasha.<name>` (MD, AD).
 * - Narayana: catalogue `dasha.narayana` (sign MD, sign AD); the dossier's Narayana rows (a few years only) as fallback.
 */
import type { Dossier } from '../facts/types.js';
import { PLANET_CODES, SIGN_NAMES, type PlanetCode } from '../facts/constants.js';
import { normalizeDasha, type DashaNode } from '../chartData/dashaShape.js';

export const DASHA_SYSTEMS = ['vimsottari', 'yogini', 'tithi_ashtottari', 'ashtottari', 'narayana'] as const;
export type DashaSystem = (typeof DASHA_SYSTEMS)[number];

/** Catalogue ids the stack reads (src/reading/chartData/catalog.ts) */
export const DASHA_TYPE_IDS: Record<DashaSystem, string> = {
  vimsottari: 'dasha.vimsottari',
  yogini: 'dasha.yogini',
  tithi_ashtottari: 'dasha.tithi_ashtottari',
  ashtottari: 'dasha.ashtottari',
  narayana: 'dasha.narayana',
};
export const DASHA_APPLICABLE_TYPE = 'dasha.applicable';

export interface PeriodRow {
  system: DashaSystem;
  /** 1 = MD, 2 = AD, 3 = PD */
  level: 1 | 2 | 3;
  /** Graha dashas: the period lord. Narayana: the lord of the running sign is NOT filled here (the sign is the period). */
  lord: PlanetCode | null;
  /** Rasi dashas: the running sign (0 = Aries) */
  sign: number | null;
  /** The enclosing period's lord / sign (AD -> its MD, PD -> its AD) */
  parentLord: PlanetCode | null;
  parentSign: number | null;
  from: string;
  /** exclusive */
  to: string;
  evidence: string;
}

export interface DashaStack {
  rows: PeriodRow[];
  /** Where each system was read from ('catalogue' | 'dossier'); absent = not available */
  sources: Partial<Record<DashaSystem, 'catalogue' | 'dossier'>>;
  missing: DashaSystem[];
}

const NAME_TO_CODE: Record<string, PlanetCode> = {
  sun: 'Su', surya: 'Su', moon: 'Mo', chandra: 'Mo', mars: 'Ma', kuja: 'Ma', mangal: 'Ma', mercury: 'Me', budha: 'Me',
  jupiter: 'Ju', guru: 'Ju', venus: 'Ve', sukra: 'Ve', shukra: 'Ve', saturn: 'Sa', sani: 'Sa', shani: 'Sa',
  rahu: 'Ra', raagu: 'Ra', ragu: 'Ra', ketu: 'Ke', kethu: 'Ke', kethu_: 'Ke',
};

/** 'Raagu☊' / 'Jupiter' / 'Ju' -> planet code; null for anything else (e.g. a sign) */
export function lordCode(name: unknown): PlanetCode | null {
  if (typeof name !== 'string') return null;
  const t = name.trim();
  if ((PLANET_CODES as readonly string[]).includes(t)) return t as PlanetCode;
  const letters = t.replace(/[^A-Za-z]/g, '').toLowerCase();
  return NAME_TO_CODE[letters] ?? null;
}

/** '♓︎Pisces' / 'Pisces' -> 11; null otherwise */
export function signIndexOf(name: unknown): number | null {
  if (typeof name !== 'string') return null;
  const letters = name.replace(/[^A-Za-z]/g, '').toLowerCase();
  const i = SIGN_NAMES.findIndex((s) => s.toLowerCase() === letters);
  return i >= 0 ? i : null;
}

function overlaps(from: string, to: string, range: { from: string; to: string }): boolean {
  return from < range.to && to > range.from;
}

/** Flatten a normalised tree into rows (levels 1 and 2, and 3 if present), clipped to the range. */
export function rowsFromTree(system: DashaSystem, payload: unknown, range: { from: string; to: string }, typeId: string): PeriodRow[] | null {
  const n = normalizeDasha(payload, { system });
  if (!n || !n.periods.length) return null;
  const rasi = system === 'narayana';
  const out: PeriodRow[] = [];
  const walk = (nodes: DashaNode[], path: string, parent: DashaNode | null, parentEnd: string | null): void => {
    nodes.forEach((node, i) => {
      const end = node.end ?? (i + 1 < nodes.length ? nodes[i + 1]!.start : parentEnd);
      const p = `${path}[${i}]`;
      if (!node.start || !end) return;
      const sign = rasi ? (typeof node.sign_index === 'number' ? node.sign_index : signIndexOf(node.lord)) : null;
      const level = Math.min(3, Math.max(1, node.level)) as 1 | 2 | 3;
      if (overlaps(node.start, end, range)) {
        out.push({
          system,
          level,
          lord: rasi ? null : lordCode(node.lord),
          sign,
          parentLord: parent && !rasi ? lordCode(parent.lord) : null,
          parentSign: parent && rasi ? (typeof parent.sign_index === 'number' ? parent.sign_index : signIndexOf(parent.lord)) : null,
          from: node.start,
          to: end,
          evidence: `${typeId}.${p.replace(/^\./, '')}`,
        });
      }
      if (node.children.length) walk(node.children, `${p}.children`, node, end);
    });
  };
  walk(n.periods, 'periods', null, null);
  return out.filter((r) => (rasi ? r.sign != null : r.lord != null));
}

function vimshottariFromDossier(dossier: Dossier, range: { from: string; to: string }, levels: Array<'ad' | 'pd'>): PeriodRow[] {
  const v = dossier.dasha?.vimshottari;
  if (!v) return [];
  const out: PeriodRow[] = [];
  if (levels.includes('ad')) {
    (v.mahadashas ?? []).forEach((m, i) => {
      if (overlaps(m.start, m.end, range)) out.push({ system: 'vimsottari', level: 1, lord: m.md, sign: null, parentLord: null, parentSign: null, from: m.start, to: m.end, evidence: `dasha.vimshottari.mahadashas[${i}]` });
    });
  }
  (v.periods ?? []).forEach((p, i) => {
    if (!levels.includes(p.level) || !overlaps(p.start, p.end, range)) return;
    const pd = p.level === 'pd';
    out.push({ system: 'vimsottari', level: pd ? 3 : 2, lord: pd ? (p.pd ?? null) : p.ad, sign: null, parentLord: pd ? p.ad : p.md, parentSign: null, from: p.start, to: p.end, evidence: `dasha.vimshottari.periods[${i}]` });
  });
  return out.filter((r) => r.lord != null);
}

function narayanaFromDossier(dossier: Dossier, range: { from: string; to: string }): PeriodRow[] {
  return (dossier.dasha?.narayana?.periods ?? [])
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => overlaps(p.start, p.end, range))
    .map(({ p, i }) => ({ system: 'narayana' as const, level: 2 as const, lord: null, sign: p.ad_sign, parentLord: null, parentSign: p.md_sign, from: p.start, to: p.end, evidence: `dasha.narayana.periods[${i}]` }));
}

/**
 * Every system's rows over the range. `items` maps catalogue ids (`dasha.yogini` …) to Radha payloads; a missing or
 * unreadable item leaves that system out (listed in `missing`) rather than failing the build.
 */
export function buildDashaStack(dossier: Dossier, items: Record<string, unknown>, range: { from: string; to: string }): DashaStack {
  const rows: PeriodRow[] = [];
  const sources: DashaStack['sources'] = {};
  const missing: DashaSystem[] = [];
  for (const system of DASHA_SYSTEMS) {
    const typeId = DASHA_TYPE_IDS[system];
    const fromCatalogue = items[typeId] != null ? rowsFromTree(system, items[typeId], range, typeId) : null;
    if (fromCatalogue?.length) {
      rows.push(...fromCatalogue);
      sources[system] = 'catalogue';
      // Radha's catalogue tree stops at AD; the dossier carries PDs around today
      if (system === 'vimsottari') rows.push(...vimshottariFromDossier(dossier, range, ['pd']));
      continue;
    }
    const fallback = system === 'vimsottari' ? vimshottariFromDossier(dossier, range, ['ad', 'pd']) : system === 'narayana' ? narayanaFromDossier(dossier, range) : [];
    if (fallback.length) {
      rows.push(...fallback);
      sources[system] = 'dossier';
    } else missing.push(system);
  }
  return { rows, sources, missing };
}

/** The rows of one system running on a day (one per level at most), finest last */
export function runningOn(rows: readonly PeriodRow[], system: DashaSystem, day: string): PeriodRow[] {
  return rows.filter((r) => r.system === system && r.from <= day && day < r.to).sort((a, b) => a.level - b.level);
}

export interface ApplicabilityRow {
  type: string;
  applies: boolean | null;
}

/** Radha's `dasha.applicable` list, read loosely */
export function applicableRows(payload: unknown): ApplicabilityRow[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((r): r is { type: string; applies?: unknown } => typeof r === 'object' && r !== null && typeof (r as { type?: unknown }).type === 'string')
    .map((r) => ({ type: r.type, applies: typeof r.applies === 'boolean' ? r.applies : null }));
}

/**
 * Doc 27 §A.3 S3: Tithi Ashtottari counts at full weight when `dasha.applicable` lists Ashtottari (or Tithi Ashtottari)
 * as applying to this chart. Returns the evidence path, or null when it does not apply / is not known.
 */
export function ashtottariApplies(payload: unknown): string | null {
  const rows = applicableRows(payload);
  const i = rows.findIndex((r) => (r.type === 'dasha.ashtottari' || r.type === 'dasha.tithi_ashtottari') && r.applies === true);
  return i >= 0 ? `${DASHA_APPLICABLE_TYPE}[${i}]` : null;
}
