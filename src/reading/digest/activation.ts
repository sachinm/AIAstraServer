/**
 * The activation calendar (`digest.activation`, docs/reading-engine/53 §4.1 and step 3, the contract of 54 §2): one row
 * per period of every stored dasha tree, from birth to thirty years after today, level 3 where a `.l3` tree is stored and
 * level 2 otherwise, with the D1 houses the period activates AS THE ENGINE STATES THEM:
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

export interface ActivationRow {
  system: string;
  family: ActivationFamily;
  level: 1 | 2 | 3;
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

/** Doc 46 §B.4 families by system (the catalogue's dasha names). Conditional: also any system `dasha.applicable` lists. */
const FAMILY_BY_SYSTEM: Record<string, ActivationFamily> = {
  vimsottari: 'vimshottari',
  ashtottari: 'conditional',
  dwisatpathi: 'conditional',
  chathuraaseethi_sama: 'conditional',
  shodasottari: 'conditional',
  dwadasottari: 'conditional',
  panchottari: 'conditional',
  sataatbika: 'conditional',
  shastihayani: 'conditional',
  shattrimsa_sama: 'conditional',
  yogini: 'yogini',
  tithi_yogini: 'yogini',
  tithi_ashtottari: 'tithi_ashtottari',
  karaka: 'karaka',
  kaala: 'karaka',
  naisargika: 'karaka',
};

export function familyOf(system: string, rasi: boolean, applicable: ReadonlySet<string>): ActivationFamily {
  if (rasi) return 'rasi';
  return FAMILY_BY_SYSTEM[system] ?? (applicable.has(system) ? 'conditional' : 'other');
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

/**
 * PURE. Activation rows from the stored trees and the digest's D1 cards. `today` bounds the calendar at thirty years
 * after it; the stored birth date (when there is one) bounds it below.
 */
export function buildActivationRows(items: Record<string, unknown>, digestRows: readonly DigestRowInput[], opts: { today: string; yearsAhead?: number }): ActivationRowInput[] {
  const cards = cardsOf(items, digestRows);
  const applicable = new Set(
    (Array.isArray(items['dasha.applicable']) ? (items['dasha.applicable'] as unknown[]) : [])
      .map((r) => (isObj(r) && typeof r.type === 'string' ? r.type.replace(/^dasha\./, '') : null))
      .filter((s): s is string => Boolean(s))
  );
  const birth = birthDate(items);
  const horizon = addYears(opts.today, opts.yearsAhead ?? ACTIVATION_YEARS_AHEAD);
  const out: ActivationRowInput[] = [];
  for (const tree of dashaTrees(items)) {
    const n = normalizeDasha(tree.payload, { system: tree.system });
    if (!n || !n.periods.length) continue;
    const rasi = n.periods.some((p) => signIndexOfNode(p) != null && lordCode(p.lord) == null);
    const family = familyOf(tree.system, rasi, applicable);
    const walk = (nodes: DashaNode[], parent: DashaNode | null, parentEnd: string | null): void => {
      nodes.forEach((node, i) => {
        const end = node.end ?? (i + 1 < nodes.length ? nodes[i + 1]!.start : parentEnd);
        if (!node.start || !end || node.level > 3) return;
        if (node.start >= horizon) return;
        if (!birth || end > birth) {
          const level = Math.min(3, Math.max(1, node.level)) as 1 | 2 | 3;
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
        if (node.children.length && node.level < 3) walk(node.children, node, end);
      });
    };
    walk(n.periods, null, null);
  }
  return out;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The periods overlapping [from, to) that activate any of `houses` (when given), in `systems` (when given), at or above `maxLevel` (and `shortMaxLevel` inside `shortTo`). */
export async function activationFor(
  prisma: PrismaClient,
  kundliId: string,
  q: { from: string; to: string; houses?: number[]; systems?: string[]; maxLevel?: 1 | 2 | 3; shortTo?: string; shortMaxLevel?: 1 | 2 | 3 }
): Promise<ActivationRow[]> {
  const rows = await prisma.kundliActivation.findMany({
    where: {
      kundli_id: kundliId,
      from_date: { lt: new Date(`${q.to}T00:00:00Z`) },
      to_date: { gt: new Date(`${q.from}T00:00:00Z`) },
      ...(q.houses?.length ? { houses: { hasSome: q.houses } } : {}),
      ...(q.systems?.length ? { system: { in: q.systems } } : {}),
      ...(q.maxLevel
        ? q.shortTo && q.shortMaxLevel && q.shortMaxLevel > q.maxLevel
          ? {
              OR: [
                { level: { lte: q.maxLevel } },
                { level: { lte: q.shortMaxLevel }, from_date: { lte: new Date(`${q.shortTo}T00:00:00Z`) } },
              ],
            }
          : { level: { lte: q.maxLevel } }
        : {}),
    },
    orderBy: [{ from_date: 'asc' }, { level: 'asc' }, { system: 'asc' }],
  });
  return rows.map((r) => ({
    system: r.system,
    family: r.family as ActivationFamily,
    level: r.level as 1 | 2 | 3,
    lord: r.lord,
    sign: r.sign,
    from: iso(r.from_date),
    to: iso(r.to_date),
    houses: r.houses,
    parentLord: r.parent_lord,
  }));
}
