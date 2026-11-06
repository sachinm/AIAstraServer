/**
 * The promise engine of the life reading (docs/reading-engine/34 §2, §3): per area, a weighed scale over the stored
 * digest. Every line is {fact (digest key), weight, side}; the weights are doc 34's defaults (D1 35, vargas 20 with D9
 * for every area, dashas 25 split by system, annual 10, transit gates 10). The verdict is read from the promise layers
 * only (D1 and vargas): dashas never create a promise; they deliver or withhold one.
 *
 * Node selects digest rows, reads the engine's labels into a side (labels.ts), counts and sums weights. It derives
 * nothing astrological.
 */
import type { ActivationFamily, ActivationRow } from '../digest/activation.js';
import type { AnnualRow, DigestView, HouseCard } from '../digest/types.js';
import type { LifeArea } from './areas.js';
import { covers, dignitySide, houseClassSide, natureSide, planetSide, sideValue, type Side } from './labels.js';
import type { SkyView } from './sky.js';

export type Layer = 'd1' | 'varga' | 'dasha' | 'annual' | 'transit';
export const LAYER_WEIGHTS: Record<Layer, number> = { d1: 35, varga: 20, dasha: 25, annual: 10, transit: 10 };
/** doc 34 §2: Vimshottari 8, rasi dashas 6, applicable conditional 4, Yogini 3, Tithi Ashtottari 2, others 2 */
export const FAMILY_WEIGHTS: Record<ActivationFamily, number> = { vimshottari: 8, rasi: 6, conditional: 4, yogini: 3, tithi_ashtottari: 2, karaka: 2, other: 2 };
export const ANNUAL_WEIGHTS = { TP: 6, VP: 4 } as const;

export interface ScaleLine {
  layer: Layer;
  /** digest key and field, e.g. house:D1.h10/lordDignity, planet:D9.Ve/dignity, activation:vimshottari/2/<from> */
  fact: string;
  /** share of the layer weight, rounded to one decimal */
  weight: number;
  side: Side;
  /** the planet the line is about (engine code), when there is one */
  planet: string | null;
  /** chart terms, for the evidence list */
  note: string;
  /** a period or a transit: the day it ends */
  until?: string;
}

export type Verdict = 'promised' | 'partial' | 'not_written';

export interface AreaPromise {
  area: LifeArea['id'];
  lines: ScaleLine[];
  /** 0..100 over the layers that were available */
  score: number;
  /** 0..1 over D1 and vargas */
  promiseRatio: number;
  verdict: Verdict;
  /** planets named by the promise layers' test lines, heaviest first */
  withholding: string[];
  /** planets named by the promise layers' support lines, heaviest first */
  helpers: string[];
  available: Record<Layer, boolean>;
  /** the varga read beside D9, when the digest holds one */
  owningVarga: string | null;
}

export interface NowInputs {
  today: string;
  /** activation rows running today (any level ≤ 2) */
  running: ActivationRow[];
  /** this year's annual rows (TP and VP) */
  annual: AnnualRow[];
  sky: SkyView | null;
}

interface RawLine {
  fact: string;
  w: number;
  side: Side;
  planet: string | null;
  note: string;
  until?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Spread a layer's weight over its raw lines by their relative weight. */
function spread(layer: Layer, total: number, raw: RawLine[]): ScaleLine[] {
  const sum = raw.reduce((s, r) => s + r.w, 0);
  if (!sum) return [];
  return raw.map((r) => ({ layer, fact: r.fact, weight: round1((total * r.w) / sum), side: r.side, planet: r.planet, note: r.note, ...(r.until ? { until: r.until } : {}) }));
}

export function layerFraction(lines: ScaleLine[]): number {
  const w = lines.reduce((s, l) => s + l.weight, 0);
  return w ? lines.reduce((s, l) => s + l.weight * sideValue(l.side), 0) / w : 0.5;
}

/** The house card's own lines: its lord's dignity and placement, occupants, SAV, obstructed argala. */
function houseLines(view: DigestView, varga: string, card: HouseCard, w: number, full: boolean): RawLine[] {
  const key = `house:${varga}.h${card.house}`;
  const out: RawLine[] = [];
  if (card.lord) {
    out.push({ fact: `${key}/lordDignity`, w, side: dignitySide(card.lordDignity), planet: card.lord, note: `${varga} house ${card.house} lord ${card.lord}: ${card.lordDignity ?? 'dignity not served'}` });
    if (full && card.lordHouse) {
      const placed = view.house(varga, card.lordHouse);
      out.push({ fact: `${key}/lordHouse`, w: w * 0.75, side: houseClassSide(placed), planet: card.lord, note: `${varga} house ${card.house} lord in house ${card.lordHouse} (${(placed?.class ?? []).join(', ') || 'class not served'})` });
    }
  }
  for (const o of card.occupants ?? []) {
    const d = dignitySide(o.dignity);
    const side = d !== 'neutral' ? d : natureSide(o.nature);
    out.push({ fact: `${key}/occupant.${o.planet}`, w: w * 0.5, side, planet: o.planet, note: `${o.planet} in ${varga} house ${card.house}${o.dignity ? ` (${o.dignity})` : ''}${o.nature ? `, ${o.nature}` : ''}` });
  }
  if (full && typeof card.sav === 'number') {
    const side: Side = card.sav >= 28 ? 'support' : card.sav <= 24 ? 'test' : 'neutral';
    out.push({ fact: `${key}/sav`, w: w * 0.5, side, planet: null, note: `SAV ${card.sav} in house ${card.house}` });
  }
  if (full && card.argala) {
    const ob = card.argala.obstructed?.length ?? 0;
    const pr = (card.argala.primary?.length ?? 0) + (card.argala.secondary?.length ?? 0);
    if (ob || pr) out.push({ fact: `${key}/argala`, w: w * 0.25, side: ob > pr ? 'test' : pr > ob ? 'support' : 'neutral', planet: null, note: `argala on house ${card.house}: ${pr} open, ${ob} obstructed` });
  }
  return out;
}

const YOGA_SUPPORT = /raja|dhana|mahapurusha|cancel|bhanga|lakshmi|gaja/i;
const YOGA_TEST = /dosha|daridra|kemadruma|shakata|grahan/i;

/** The owning varga: the first of the area's vargas the digest holds, other than D9. */
export function owningVargaOf(view: DigestView, area: LifeArea): string | null {
  const held = new Set(view.vargas());
  return area.vargas.find((v) => v !== 'D9' && held.has(v)) ?? null;
}

/** The running row of one family: the first system in the engine's order, its deepest level up to 2. */
export function runningOf(rows: ActivationRow[], family: ActivationFamily, today: string): ActivationRow | null {
  const r = rows.filter((x) => x.family === family && x.level <= 2 && covers(x, today));
  if (!r.length) return null;
  const sys = r[0].system;
  return r.filter((x) => x.system === sys).sort((a, b) => b.level - a.level)[0];
}

/** A graha period's lord, or the lord of a rasi period's sign as the D1 house card states it. */
export function periodLord(view: DigestView, row: ActivationRow): string | null {
  if (row.lord) return row.lord;
  if (!row.sign) return null;
  return view.houses('D1').find((h) => h.sign === row.sign)?.lord ?? null;
}

/** The side of a period for an area: silent unless it activates one of the area's houses; then its lord's side. */
export function periodSide(view: DigestView, row: ActivationRow, houses: number[]): Side | 'silent' {
  if (!row.houses?.some((h) => houses.includes(h))) return 'silent';
  const lord = periodLord(view, row);
  return lord ? planetSide(view.planet('D1', lord)) : 'neutral';
}

export function promiseScale(view: DigestView, area: LifeArea, now: NowInputs): AreaPromise {
  const lines: ScaleLine[] = [];
  const available: Record<Layer, boolean> = { d1: false, varga: false, dasha: false, annual: false, transit: false };
  const primary = area.houses[0];

  // rank 1: D1 houses (primary counts double), karakas, yogas on the area's houses or their lords
  const d1: RawLine[] = [];
  for (const h of area.houses) {
    const card = view.house('D1', h);
    if (card) d1.push(...houseLines(view, 'D1', card, h === primary ? 2 : 1, true));
  }
  for (const k of area.karakas) {
    const p = view.planet('D1', k);
    if (!p) continue;
    d1.push({ fact: `planet:D1.${k}/karaka`, w: 1, side: planetSide(p), planet: k, note: `karaka ${k}: ${p.dignity ?? 'no dignity'}, ${p.functional ?? 'functional not served'}${p.combust ? ', combust' : ''}` });
  }
  const lords = new Set(area.houses.map((h) => view.house('D1', h)?.lord).filter((x): x is string => !!x));
  for (const y of view.yogas()) {
    const touches = y.houses.some((h) => area.houses.includes(h)) || y.planets.some((p) => lords.has(p));
    if (!touches) continue;
    const label = `${y.class} ${y.name}`;
    const side: Side = YOGA_TEST.test(label) && !/cancel|bhanga/i.test(label) ? 'test' : YOGA_SUPPORT.test(label) ? 'support' : 'neutral';
    if (side !== 'neutral') d1.push({ fact: `yoga:D1.${y.id}`, w: 1, side, planet: y.planets[0] ?? null, note: `${y.name} (${y.class})` });
  }
  if (d1.length) {
    available.d1 = true;
    lines.push(...spread('d1', LAYER_WEIGHTS.d1, d1));
  }

  // rank 2: D9 for every area, and the owning varga beside it
  const owning = owningVargaOf(view, area);
  const primaryLord = view.house('D1', primary)?.lord ?? null;
  const vargasRead: Array<[string, number]> = owning ? [['D9', LAYER_WEIGHTS.varga / 2], [owning, LAYER_WEIGHTS.varga / 2]] : [['D9', LAYER_WEIGHTS.varga]];
  const vargaLines: ScaleLine[] = [];
  for (const [v, total] of vargasRead) {
    const raw: RawLine[] = [];
    const card = view.house(v, primary);
    if (card) raw.push(...houseLines(view, v, card, 2, false));
    if (primaryLord) {
      const p = view.planet(v, primaryLord);
      if (p) raw.push({ fact: `planet:${v}.${primaryLord}/dignity`, w: 2, side: dignitySide(p.dignity), planet: primaryLord, note: `D1 house ${primary} lord ${primaryLord} in ${v}: ${p.dignity ?? 'no dignity'}` });
    }
    vargaLines.push(...spread('varga', total, raw));
  }
  // a varga that is missing gives its share to the one that is there
  const vargaTotal = vargaLines.reduce((s, l) => s + l.weight, 0);
  if (vargaLines.length) {
    available.varga = true;
    lines.push(...vargaLines.map((l) => ({ ...l, weight: round1((LAYER_WEIGHTS.varga * l.weight) / vargaTotal) })));
  }

  // rank 3: the periods running today, one per family, weighted by doc 34's system split
  const dasha: ScaleLine[] = [];
  for (const fam of Object.keys(FAMILY_WEIGHTS) as ActivationFamily[]) {
    const row = runningOf(now.running, fam, now.today);
    if (!row) continue;
    const s = periodSide(view, row, area.houses);
    dasha.push({
      layer: 'dasha',
      fact: `activation:${row.system}/${row.level}/${row.from}`,
      weight: FAMILY_WEIGHTS[fam],
      side: s === 'silent' ? 'neutral' : s,
      planet: s === 'silent' ? null : periodLord(view, row),
      note: `${row.system} ${row.parentLord ? `${row.parentLord}-` : ''}${row.lord ?? row.sign ?? ''} to ${row.to}${s === 'silent' ? ' (does not touch the area)' : ''}`,
      until: row.to,
    });
  }
  if (dasha.length) {
    available.dasha = true;
    const total = dasha.reduce((s, l) => s + l.weight, 0);
    lines.push(...dasha.map((l) => ({ ...l, weight: round1((LAYER_WEIGHTS.dasha * l.weight) / total) })));
  }

  // rank 4: this year's charts, the primary house as the year chart's D1 card states it
  const annual: RawLine[] = [];
  for (const a of now.annual) {
    const side = annualSide(view, a, primary);
    if (!side) continue;
    annual.push({ fact: `annual:${a.kind}${a.year}.h${primary}`, w: ANNUAL_WEIGHTS[a.kind], side: side.side, planet: side.lord, note: side.note });
  }
  if (annual.length) {
    available.annual = true;
    lines.push(...spread('annual', LAYER_WEIGHTS.annual, annual));
  }

  // rank 5: the sky today: a slow body on an area house tests; Jupiter and Saturn together on one supports
  if (now.sky && covers(now.sky, now.today)) {
    const raw: RawLine[] = [];
    for (const s of now.sky.slow) if (covers(s, now.today) && area.houses.includes(s.house)) raw.push({ fact: `transit:${s.planet}.h${s.house}/${s.from}`, w: s.house === primary ? 2 : 1, side: 'test', planet: s.planet, note: `transit ${s.planet} in house ${s.house} until ${s.to}`, until: s.to });
    for (const g of now.sky.gates) if (covers(g, now.today) && g.houses.some((h) => area.houses.includes(h))) raw.push({ fact: `transit:double/${g.from}`, w: 2, side: 'support', planet: null, note: `double transit on houses ${g.houses.join(',')} until ${g.to}`, until: g.to });
    if (!raw.length) raw.push({ fact: 'transit:none', w: 1, side: 'neutral', planet: null, note: 'no slow body or double transit on the area today' });
    available.transit = true;
    lines.push(...spread('transit', LAYER_WEIGHTS.transit, raw));
  }

  const layers = (Object.keys(LAYER_WEIGHTS) as Layer[]).filter((l) => available[l]);
  const totalW = layers.reduce((s, l) => s + LAYER_WEIGHTS[l], 0);
  const points = layers.reduce((s, l) => s + LAYER_WEIGHTS[l] * layerFraction(lines.filter((x) => x.layer === l)), 0);
  const score = totalW ? Math.round((points / totalW) * 100) : 0;
  const promiseLayers = (['d1', 'varga'] as Layer[]).filter((l) => available[l]);
  const pW = promiseLayers.reduce((s, l) => s + LAYER_WEIGHTS[l], 0);
  const promiseRatio = pW ? promiseLayers.reduce((s, l) => s + LAYER_WEIGHTS[l] * layerFraction(lines.filter((x) => x.layer === l)), 0) / pW : 0;
  const verdict: Verdict = promiseRatio >= 0.6 ? 'promised' : promiseRatio >= 0.4 ? 'partial' : 'not_written';

  const named = (side: Side) => {
    const byPlanet = new Map<string, number>();
    for (const l of lines) if ((l.layer === 'd1' || l.layer === 'varga') && l.side === side && l.planet) byPlanet.set(l.planet, (byPlanet.get(l.planet) ?? 0) + l.weight);
    return [...byPlanet.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  };
  return { area: area.id, lines, score, promiseRatio: Math.round(promiseRatio * 100) / 100, verdict, withholding: named('test'), helpers: named('support'), available, owningVarga: owning };
}

/** A year chart's side for a house: its D1 card's lord dignity and occupants, averaged. Null when the card is not there. */
export function annualSide(view: DigestView, a: AnnualRow, house: number): { side: Side; lord: string | null; note: string } | null {
  const card = a.houses.find((h) => h.house === house && (h.varga ?? 'D1') === 'D1');
  if (!card) return null;
  const parts = houseLines(view, `${a.kind}${a.year}`, card, 1, false);
  const v = parts.length ? parts.reduce((s, p) => s + sideValue(p.side), 0) / parts.length : 0.5;
  return { side: v > 0.55 ? 'support' : v < 0.45 ? 'test' : 'neutral', lord: card.lord, note: `${a.kind} ${a.year} house ${house}: lord ${card.lord ?? '?'} ${card.lordDignity ?? ''}`.trim() };
}
