/**
 * Shared slicers of the You reading (docs/reading-engine/58 §4.1): the reusable pieces every panel reads. Each is a pure
 * selection over stored engine rows (digest cards, activation periods). None derives a sign, lord, aspect, dignity or
 * yoga; when a field a slicer needs is absent it returns null and names the gap, so no panel ever prints a default.
 */
import type { ActivationRow } from '../digest/activation.js';
import type { DigestView, HouseCard, PlanetCard, PointRow, YogaRow } from '../digest/types.js';

export interface Gaps {
  list: string[];
  add(g: string): void;
}
export function gaps(): Gaps {
  const list: string[] = [];
  return { list, add: (g) => { if (!list.includes(g)) list.push(g); } };
}

export interface PlanetChain {
  planet: string;
  d1: PlanetCard;
  d9: PlanetCard | null;
  /** keys the panel cites */
  evidence: string[];
}

/** A planet's delivery chain: its D1 card (place, dignity, star lord, dispositor, company, aspects, avastha) and its D9 card. */
export function planetChain(view: DigestView, planet: string | null | undefined, g: Gaps): PlanetChain | null {
  if (!planet) return null;
  const d1 = view.planet('D1', planet);
  if (!d1) { g.add(`planet:D1.${planet} missing`); return null; }
  if (d1.house == null) { g.add(`planet:D1.${planet}.house missing`); return null; }
  const d9 = view.planet('D9', planet);
  if (!d9) g.add(`planet:D9.${planet} missing`);
  return { planet, d1, d9: d9 ?? null, evidence: [`planet:D1.${planet}`, ...(d9 ? [`planet:D9.${planet}`] : [])] };
}

/** One house of one varga, as stored. */
export function houseFrame(view: DigestView, varga: string, h: number, g: Gaps): HouseCard | null {
  const card = view.house(varga, h);
  if (!card) { g.add(`house:${varga}.h${h} missing`); return null; }
  return card;
}

/** One point (chara karaka, arudha, special lagna) of one varga. */
export function pointOf(view: DigestView, varga: string, id: string, g: Gaps): PointRow | null {
  const p = view.points(varga).find((x) => x.id === id);
  if (!p) { g.add(`point:${varga}.${id} missing`); return null; }
  return p;
}

/** The D1 yoga rows that name any of the planets or houses, de-duplicated by name. */
export function yogasTouching(view: DigestView, planets: readonly string[], houses: readonly number[]): YogaRow[] {
  const seen = new Set<string>();
  const norm = (n: string) => n.toLowerCase().replace(/dosha|yoga/g, '').replace(/[^a-z]/g, '');
  return view
    .yogas()
    .filter((y) => y.planets.some((p) => planets.includes(p)) || y.houses.some((h) => houses.includes(h)))
    .filter((y) => {
      const k = norm(y.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** The periods of one clock covering `asOf`, by level. */
export function runningChain(rows: readonly ActivationRow[], system: string, asOf: string): { l1: ActivationRow | null; l2: ActivationRow | null; l3: ActivationRow | null } {
  const at = (lv: 1 | 2 | 3) => rows.find((r) => r.system === system && r.level === lv && r.from <= asOf && asOf < r.to) ?? null;
  return { l1: at(1), l2: at(2), l3: at(3) };
}

export interface MdSpine {
  previous: ActivationRow | null;
  running: ActivationRow | null;
  next: ActivationRow | null;
  /** level-2 periods inside the running main period */
  subs: ActivationRow[];
  runningSub: ActivationRow | null;
  nextSub: ActivationRow | null;
}

/** Previous, running and next main period of one clock, with the sub-periods of the running one. */
export function mdSpine(rows: readonly ActivationRow[], system: string, asOf: string): MdSpine {
  const l1 = rows.filter((r) => r.system === system && r.level === 1).sort((a, b) => a.from.localeCompare(b.from));
  const i = l1.findIndex((r) => r.from <= asOf && asOf < r.to);
  const running = i >= 0 ? l1[i]! : null;
  const previous = i > 0 ? l1[i - 1]! : null;
  const next = i >= 0 && i + 1 < l1.length ? l1[i + 1]! : null;
  const subs = running
    ? rows.filter((r) => r.system === system && r.level === 2 && r.from >= running.from && r.to <= running.to).sort((a, b) => a.from.localeCompare(b.from))
    : [];
  const j = subs.findIndex((r) => r.from <= asOf && asOf < r.to);
  return { previous, running, next, subs, runningSub: j >= 0 ? subs[j]! : null, nextSub: j >= 0 && j + 1 < subs.length ? subs[j + 1]! : (next ? rows.find((r) => r.system === system && r.level === 2 && r.from === next.from) ?? null : null) };
}

/** Level-1 period starts of one clock (YYYY-MM-DD), ascending. */
export function mainStarts(rows: readonly ActivationRow[], system: string): string[] {
  return rows.filter((r) => r.system === system && r.level === 1).map((r) => r.from).sort();
}

export const activationKey = (r: ActivationRow): string => `activation:${r.system}/${r.level}/${r.lord ?? r.sign ?? '?'}@${r.from}`;
