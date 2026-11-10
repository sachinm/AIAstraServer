/**
 * The activation calendar (`digest.activation`, docs/reading-engine/53 §4.1 and step 3, the contract of 54 §2): one row
 * per period of every stored dasha tree, from birth to thirty years after today, to level 3 (the normal pull asks every
 * system for three levels; docs/reading-engine/67), plus levels 4–6 inside the deep window for a kundli in focus
 * (written by the dasha-deep worker, src/workers/dashaDeep.ts), with the D1 houses the period activates AS THE ENGINE STATES THEM:
 *   - a graha period: the lord's D1 house, the houses it owns and the houses its graha drishti falls on (the lord's D1
 *     planet card, built from dignities / benefic_malefic / aspects);
 *   - a rasi period: the house of the sign in D1 (`house_counts.sign_to_house`) and the house of the sign's lord (the D1
 *     house card of that sign).
 * Families follow doc 46 §B.4. Selection and dating only: every date, lord, sign and house is the engine's.
 */
import type { PrismaClient } from '@prisma/client';
import { SIGN_NAMES } from '../facts/constants.js';
import { normalizeDasha, type DashaNode } from '../chartData/dashaShape.js';
import { lordCode, signIndexOf } from '../timeline/dashas.js';
import { FACTS_ITEM, type DigestRowInput, type HouseCard, type PlanetCard } from './types.js';

export type ActivationFamily = 'vimshottari' | 'conditional' | 'yogini' | 'tithi_ashtottari' | 'rasi' | 'karaka' | 'other';

/** Dasha depth: 1 maha, 2 antar, 3 pratyantar (lifelong, the normal pull), 4 sookshma, 5 prana, 6 deha (the deep window, docs/reading-engine/67). */
export type ActivationLevel = 1 | 2 | 3 | 4 | 5 | 6;
/** The deepest level stored lifelong; deeper rows exist only inside the deep window the dasha-deep worker pulls. */
export const LIFELONG_MAX_LEVEL = 3;

export interface ActivationRow {
  system: string;
  family: ActivationFamily;
  level: ActivationLevel;
  lord: string | null;
  sign: string | null;
  from: string;
  to: string;
  houses: number[];
  parentLord: string | null;
}
export type ActivationRowInput = ActivationRow;

/** The years after today the calendar runs to */
export const ACTIVATION_YEARS_AHEAD = 30;

/** Doc 46 §B.4 families by system (the catalogue's dasha names). Conditional systems require `dasha.applicable` (`applies: true`). */
const FAMILY_BY_SYSTEM: Record<string, ActivationFamily> = {
  vimsottari: 'vimshottari',
  yogini: 'yogini',
  tithi_yogini: 'yogini',
  tithi_ashtottari: 'tithi_ashtottari',
  karaka: 'karaka',
  kaala: 'karaka',
  naisargika: 'karaka',
};

/** Engine `dasha.applicable` type names → stored `dasha.<system>` tree names where the two spellings differ. */
const CONDITIONAL_SYSTEM_ALIASES: Record<string, string[]> = {
  chathuraaseethi_sama: ['chathuraaseethi_sama', 'chaturshitisama'],
  chaturshitisama: ['chathuraaseethi_sama', 'chaturshitisama'],
  sataatbika: ['sataatbika', 'shatabdika'],
  shatabdika: ['sataatbika', 'shatabdika'],
  shattrimsa_sama: ['shattrimsa_sama', 'shattrimsatsama'],
  shattrimsatsama: ['shattrimsa_sama', 'shattrimsatsama'],
  shodasottari: ['shodasottari', 'shodashottari'],
  shodashottari: ['shodasottari', 'shodashottari'],
};

export function applicableConditionalSystems(raw: unknown): Set<string> {
  const out = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isObj(r) || typeof r.type !== 'string') continue;
    if (r.applies !== true && r.applies !== undefined) continue;
    const base = r.type.replace(/^dasha\./, '');
    if (!base) continue;
    out.add(base);
    for (const alias of CONDITIONAL_SYSTEM_ALIASES[base] ?? []) out.add(alias);
  }
  return out;
}

export function familyOf(system: string, rasi: boolean, applicable: ReadonlySet<string>): ActivationFamily {
  if (rasi) return 'rasi';
  if (FAMILY_BY_SYSTEM[system]) return FAMILY_BY_SYSTEM[system]!;
  if (applicable.has(system)) return 'conditional';
  const aliases = CONDITIONAL_SYSTEM_ALIASES[system];
  if (aliases?.some((a) => applicable.has(a))) return 'conditional';
  return 'other';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** '1975-9-6' / '1975-09-06' -> '1975-09-06'; null otherwise */
function isoDate(v: unknown): string | null {
  const m = typeof v === 'string' ? /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v) : null;
  return m ? `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` : null;
}

/** The birth date the engine stated (dossier, else the birth panchanga); null when neither is stored. */
function birthDate(items: Record<string, unknown>): string | null {
  const facts = items[FACTS_ITEM];
  const fromFacts = isObj(facts) && isObj(facts.birth) ? isoDate(facts.birth.date) : null;
  if (fromFacts) return fromFacts;
  const p = items['panchanga.birth'];
  return isObj(p) ? isoDate(p.date) : null;
}

const addYears = (iso: string, years: number) => `${String(Number(iso.slice(0, 4)) + years).padStart(4, '0')}${iso.slice(4)}`;

/** Every stored dasha system and the tree to read for it: `dasha.<name>.l3` when stored, else `dasha.<name>` */
export function dashaTrees(items: Record<string, unknown>): Array<{ system: string; key: string; payload: unknown }> {
  const out = new Map<string, { system: string; key: string; payload: unknown }>();
  for (const key of Object.keys(items).sort()) {
    const m = /^dasha\.([a-z_]+?)(\.l3)?$/.exec(key);
    if (!m || m[1] === 'applicable' || items[key] == null) continue;
    const system = m[1]!;
    if (m[2] || !out.has(system)) out.set(system, { system, key, payload: items[key] });
  }
  return [...out.values()];
}

interface Cards {
  planet: Map<string, PlanetCard>;
  houseBySign: Map<string, HouseCard>;
  signToHouse: Map<number, number>;
}

function cardsOf(items: Record<string, unknown>, rows: readonly DigestRowInput[]): Cards {
  const planet = new Map<string, PlanetCard>();
  const houseBySign = new Map<string, HouseCard>();
  for (const r of rows) {
    if (r.section === 'planet' && (r.row as PlanetCard).varga === 'D1') planet.set((r.row as PlanetCard).planet, r.row as PlanetCard);
    if (r.section === 'house' && (r.row as HouseCard).varga === 'D1' && (r.row as HouseCard).sign) houseBySign.set((r.row as HouseCard).sign!, r.row as HouseCard);
  }
  const signToHouse = new Map<number, number>();
  const hc = items.house_counts;
  if (isObj(hc) && isObj(hc.sign_to_house)) {
    for (const [k, v] of Object.entries(hc.sign_to_house)) if (Number.isInteger(v)) signToHouse.set(Number(k), v as number);
  }
  return { planet, houseBySign, signToHouse };
}

/** The D1 houses a graha period activates: the lord's house, its houses owned, its graha drishti (its D1 card). */
export function grahaHouses(card: PlanetCard | undefined): number[] {
  if (!card) return [];
  return [...new Set([...(card.house != null ? [card.house] : []), ...card.owns, ...card.aspectsTo])].sort((a, b) => a - b);
}

/** The D1 houses a rasi period activates: the sign's house (house_counts) and its lord's house (the D1 house card of that sign). */
export function rasiHouses(signIndex: number, cards: Cards): { houses: number[]; lord: string | null } {
  const name = SIGN_NAMES[signIndex] ?? null;
  const own = cards.signToHouse.get(signIndex);
  const hcard = name ? cards.houseBySign.get(name) : undefined;
  const lordHouse = hcard?.lordHouse ?? null;
  const houses = [...new Set([...(own != null ? [own] : []), ...(lordHouse != null ? [lordHouse] : [])])].sort((a, b) => a - b);
  return { houses, lord: hcard?.lord ?? null };
}

function signIndexOfNode(n: DashaNode): number | null {
  if (typeof n.sign_index === 'number' && Number.isInteger(n.sign_index)) return n.sign_index;
  return signIndexOf(n.lord);
}

interface WalkOpts {
  minLevel: ActivationLevel;
  maxLevel: ActivationLevel;
  /** rows must overlap [from, to) when given (the deep window) */
  from?: string;
  to?: string;
  /** rows starting on or after this date are left out */
  horizon: string;
  birth: string | null;
}

/** One tree's rows between minLevel and maxLevel. Houses follow the same engine-field rule at every level. */
function rowsOfTree(tree: { system: string; payload: unknown }, cards: Cards, applicable: ReadonlySet<string>, o: WalkOpts): ActivationRowInput[] {
  const n = normalizeDasha(tree.payload, { system: tree.system });
  if (!n || !n.periods.length) return [];
  const rasi = n.periods.some((p) => signIndexOfNode(p) != null && lordCode(p.lord) == null);
  const family = familyOf(tree.system, rasi, applicable);
  const out: ActivationRowInput[] = [];
  const walk = (nodes: DashaNode[], parent: DashaNode | null, parentEnd: string | null, depth: number): void => {
    nodes.forEach((node, i) => {
      const end = node.end ?? (i + 1 < nodes.length ? nodes[i + 1]!.start : parentEnd);
      const lvl = Math.max(1, Math.round(node.level || depth));
      if (!node.start || !end || lvl > o.maxLevel) return;
      if (node.start >= o.horizon) return;
      // outside the window nothing below this node can be inside it either
      if (o.from && end <= o.from) return;
      if (o.to && node.start >= o.to) return;
      if (lvl >= o.minLevel && (!o.birth || end > o.birth)) {
        const level = lvl as ActivationLevel;
        if (rasi) {
          const s = signIndexOfNode(node);
          const ps = parent ? signIndexOfNode(parent) : null;
          if (s != null) {
            const { houses } = rasiHouses(s, cards);
            out.push({ system: tree.system, family, level, lord: null, sign: SIGN_NAMES[s] ?? null, from: node.start, to: end, houses, parentLord: ps != null ? (SIGN_NAMES[ps] ?? null) : null });
          }
        } else {
          const p = lordCode(node.lord);
          if (p) out.push({ system: tree.system, family, level, lord: p, sign: null, from: node.start, to: end, houses: grahaHouses(cards.planet.get(p)), parentLord: parent ? lordCode(parent.lord) : null });
        }
      }
      if (node.children.length && lvl < o.maxLevel) walk(node.children, node, end, lvl + 1);
    });
  };
  walk(n.periods, null, null, 1);
  return out;
}

/**
 * PURE. Lifelong activation rows (levels 1–3) from the stored trees and the digest's D1 cards. `today` bounds the
 * calendar at thirty years after it; the stored birth date (when there is one) bounds it below. Levels 4–6 are never
 * built here: they come only from the dasha-deep worker (`buildDeepActivationRows`).
 */
export function buildActivationRows(items: Record<string, unknown>, digestRows: readonly DigestRowInput[], opts: { today: string; yearsAhead?: number }): ActivationRowInput[] {
  const cards = cardsOf(items, digestRows);
  const applicable = applicableConditionalSystems(items['dasha.applicable']);
  const o: WalkOpts = { minLevel: 1, maxLevel: LIFELONG_MAX_LEVEL, horizon: addYears(opts.today, opts.yearsAhead ?? ACTIVATION_YEARS_AHEAD), birth: birthDate(items) };
  return dashaTrees(items).flatMap((tree) => rowsOfTree(tree, cards, applicable, o));
}

/**
 * PURE. The deep rows (levels 4..maxLevel) of trees the engine answered with `max_level` and a window, kept only where
 * they overlap [from, to). `items` supplies `house_counts`, `dasha.applicable` and the birth date; `digestRows` the D1
 * planet and house cards. The house rule is the lifelong one, unchanged: every value is the engine's.
 */
export function buildDeepActivationRows(
  trees: ReadonlyArray<{ system: string; payload: unknown }>,
  items: Record<string, unknown>,
  digestRows: readonly DigestRowInput[],
  window: { from: string; to: string; maxLevel: ActivationLevel },
): ActivationRowInput[] {
  const cards = cardsOf(items, digestRows);
  const applicable = applicableConditionalSystems(items['dasha.applicable']);
  const o: WalkOpts = { minLevel: (LIFELONG_MAX_LEVEL + 1) as ActivationLevel, maxLevel: window.maxLevel, from: window.from, to: window.to, horizon: '9999-12-31', birth: birthDate(items) };
  return trees.flatMap((tree) => rowsOfTree(tree, cards, applicable, o));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The periods overlapping [from, to) that activate any of `houses` (when given), in `systems` (when given), at or above
 * `maxLevel` (and `shortMaxLevel` inside `[shortFrom, shortTo)` / `shortSystems`). `maxLevel` defaults to 3 (lifelong
 * levels only). Levels 4–6 exist only inside the deep window the dasha-deep worker pulled for a kundli in focus: ask for
 * them with `maxLevel` (or `shortMaxLevel`) above 3; where they are not stored the answer simply has none (no pull).
 */
export async function activationFor(
  prisma: PrismaClient,
  kundliId: string,
  q: {
    from: string;
    to: string;
    houses?: number[];
    systems?: string[];
    maxLevel?: ActivationLevel;
    shortFrom?: string;
    shortTo?: string;
    shortMaxLevel?: ActivationLevel;
    shortSystems?: string[];
  },
): Promise<ActivationRow[]> {
  const maxLevel: ActivationLevel = q.maxLevel ?? LIFELONG_MAX_LEVEL;
  const hasShortWindow = Boolean(q.shortMaxLevel && q.shortMaxLevel > maxLevel && (q.shortTo || q.shortFrom));
  const shortClause: Record<string, unknown> = hasShortWindow
    ? {
        level: { lte: q.shortMaxLevel },
        ...(q.shortTo ? { from_date: { lte: new Date(`${q.shortTo}T00:00:00Z`) } } : {}),
        ...(q.shortFrom ? { to_date: { gt: new Date(`${q.shortFrom}T00:00:00Z`) } } : {}),
        ...(q.shortSystems?.length ? { system: { in: q.shortSystems } } : {}),
      }
    : {};
  const rows = await prisma.kundliActivation.findMany({
    where: {
      kundli_id: kundliId,
      from_date: { lt: new Date(`${q.to}T00:00:00Z`) },
      to_date: { gt: new Date(`${q.from}T00:00:00Z`) },
      ...(q.houses?.length ? { houses: { hasSome: q.houses } } : {}),
      ...(q.systems?.length ? { system: { in: q.systems } } : {}),
      ...(hasShortWindow ? { OR: [{ level: { lte: maxLevel } }, shortClause] } : { level: { lte: maxLevel } }),
    },
    orderBy: [{ from_date: 'asc' }, { level: 'asc' }, { system: 'asc' }],
  });
  return rows.map((r) => ({
    system: r.system,
    family: r.family as ActivationFamily,
    level: r.level as ActivationLevel,
    lord: r.lord,
    sign: r.sign,
    from: iso(r.from_date),
    to: iso(r.to_date),
    houses: r.houses,
    parentLord: r.parent_lord,
  }));
}
