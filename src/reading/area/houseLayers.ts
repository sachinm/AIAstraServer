/**
 * The house-state layers of doc 46 Part B, read from the stored digest (docs/reading-engine/53 §4.5, 54 §3).
 *
 * Generic over an area config (houses, the planets and points that matter to it, vargas, sub-areas): Self and Love are
 * two configs over the same functions. Every row is a SELECT of a digest field or an activation row, given a weight from
 * the config tables below, and summed. Node computes nothing astrological here: house classes (kendra, trikona, dusthana),
 * dignities, natures, aspects, argala, dispositors, yogas and the houses a period activates are all the engine's own
 * labels as the digest stores them. Dates are intersected, never derived.
 *
 * The layers:
 *  - promise     what supports the area (placement class, dignity, benefic occupants and aspects, SAV, yogas)
 *  - affliction  what presses on it, each with `until` = the end of the afflicting planet's running period
 *  - protection  Jupiter's aspect on the houses, planets and points; cancellations in the yoga register; benefic argala;
 *                a strong dispositor of the house lord; extra varga checks (D9 7th lord for Love)
 *  - activation  periods ahead that activate the houses, graded by the period lord's functional nature and D1/D9 dignity,
 *                voted by family like career.ts
 *  - transit     the stored sky overlay of the kundli (Jupiter, Saturn, the nodes over the houses; sade sati) when one is
 *                stored; omitted with a note otherwise
 *  - annual      the current year chart (TP first, else VP): the year's lord of each house, and the area's sahams
 *  - tone        doc 45 §7 from the family votes, scaled to the families present
 */
import { runningTithiPravesha } from '../annual/tithiPravesha.js';
import type { AnnualRow, DigestView, HouseCard, PlanetCard } from '../digest/types.js';
import type { ActivationFamily, ActivationRow } from '../digest/activation.js';
import type { TransitRangePayload } from '../chartData/transitRange.js';
import { getShadeShortHorizonMonths } from '../../config/env.js';
import { addDaysIso, addMonthsIso, monthEnd, monthMid, monthOf, monthStart, monthsBetween } from '../timeline/months.js';
import {
  buildLoveBondingAndChemistry,
  buildLoveRelationshipArc,
  buildSelfCharacterArc,
  buildSelfPersonalityAndJoy,
  type SelfCharacterArc,
  type SelfPersonalityAndJoy,
} from './selfCharacterAndJoy.js';

export { buildLoveBondingAndChemistry, buildLoveRelationshipArc, type SelfCharacterArc, type SelfPersonalityAndJoy } from './selfCharacterAndJoy.js';

export type Tone = 'demanding' | 'easing' | 'steady' | 'closing' | 'open';
export type Confidence = 'confirmed' | 'likely' | 'split';
export type Vote = 'support' | 'test' | 'neutral';
export type Side = 'support' | 'test';
export type Grade = 'strong' | 'moderate' | 'weak';
export type LayerId = 'promise' | 'affliction' | 'protection' | 'activation' | 'transit' | 'annual' | 'varga' | 'nakshatra';

/**
 * A reference to a planet as the area names it: a planet code ('Mo', 'Ve'), a house lord ('L1', 'L7', read from the
 * D1 house card), or a chara karaka ('AK', 'DK', read from the digest point rows).
 */
export type PlanetRef = string;

export interface SubareaDef {
  id: string;
  /** the plain name (Ahead tabs, labels) */
  title: string;
  /** distinguishing planets (doc 46 §B.12): a period of one of them lands in this sub-area */
  planets: PlanetRef[];
  /** a sign period (rasi family) that activates one of these lands here */
  houses: number[];
  sides: Side[];
  /** only a main-clock change at this level counts (turning points) */
  level1Only?: boolean;
}

export interface AreaWords {
  /** theme key (`h1`, `Mo`, `L1`, `UL` …) → a noun phrase in plain words, lower case */
  themes: Record<string, string>;
  /** rule kinds the area words differently from the shared table */
  kinds?: Partial<Record<RowKind, (theme: string) => string>>;
  back: Record<Side, string>;
  year: { support: string; test: string; mixed: string };
  ahead: Record<Side, Record<Grade, string>>;
  /** a change of the main chapter (turning points) */
  turn: Record<Side, string>;
}

export interface AreaConfig {
  area: 'self' | 'love' | 'career';
  /** every house the area reads (activation query) */
  houses: number[];
  /** the houses whose promise and afflictions are read */
  primary: number[];
  /** the planets whose own state is read for promise and affliction */
  karakas: PlanetRef[];
  /** the points whose house Jupiter's aspect protects (Love: UL) */
  protectPoints: string[];
  /** extra varga house checks in the protection layer (Love: D9 h7's lord dignified) */
  vargaChecks: Array<{ varga: string; house: number }>;
  /** D1 first; the second is the inner chart used to grade a period lord */
  vargas: string[];
  /** planets whose occupation or aspect on a primary house is a pressure (Saturn and the nodes) */
  heavy: string[];
  /** affliction names in the yoga register that touch this area (Kemadruma for Self; Kalathra, Manglik for Love) */
  yogaAfflictions: RegExp[];
  /** read the Moon's gandanta from the star profile (Self) */
  gandantaMoon: boolean;
  /** read the sade sati spans in the transit layer (Self) */
  sadeSati: boolean;
  sahams: { support: string[]; test: string[] };
  subareas: SubareaDef[];
  words: AreaWords;
}

export type RowKind =
  | 'placed_well' | 'strong' | 'helped' | 'reserves' | 'yoga'
  | 'guarded' | 'cancelled' | 'held_up' | 'backed' | 'deep_bond'
  | 'placed_hard' | 'weak' | 'overshadowed' | 'conflict' | 'pressed' | 'deep_feelings' | 'alone' | 'dosha'
  | 'sky_helps' | 'sky_slows' | 'sky_unsettles' | 'long_test'
  | 'year_backs' | 'year_tests';

export interface LayerRow {
  layer: LayerId;
  side: Side;
  weight: number;
  kind: RowKind;
  /** theme key for the words */
  theme: string;
  /** the planet the row is about (afflictions: the one whose period carries it) */
  planet?: string | null;
  until?: string | null;
  evidence: string[];
}

// ---------------------------------------------------------------- engine labels, matched (never computed)

const GOOD_DIGNITY = /exalt|own|moola|uchcha|swa/i;
const BAD_DIGNITY = /debil|neecha|fall/i;
const DEAD_AVASTHA = /mrita|sushupta|dead/i;
const AWAKE_AVASTHA = /jagrat|deepta|awake/i;
const CANCELLATION = /bhanga|cancel/i;
const DOSHA = /dosha/i;

export const isGood = (d: string | null | undefined) => !!d && GOOD_DIGNITY.test(d) && !BAD_DIGNITY.test(d);
export const isBad = (d: string | null | undefined) => !!d && BAD_DIGNITY.test(d);
const isMalefic = (n: string | null | undefined) => !!n && /malefic/i.test(n);
const isBenefic = (n: string | null | undefined) => !!n && /benefic/i.test(n) && !/malefic/i.test(n);
export const hasClass = (card: HouseCard | null | undefined, re: RegExp) => !!card && card.class.some((c) => re.test(c));
const GOOD_PLACE = /kendra|trikona/i;
const HARD_PLACE = /dusthana/i;

/** Yoga class → weight (doc 46 §B.2 "+1 to +3 by class"); config, not computed. */
export const YOGA_WEIGHT: Array<[RegExp, number]> = [
  [/raja|mahapurusha|pancha/i, 2],
  [/dhana|lakshmi|gaja/i, 1.5],
  [/.*/, 1],
];
const yogaWeight = (cls: string) => YOGA_WEIGHT.find(([re]) => re.test(cls))![1];

/** Activation family → board family (doc 46 §B.4); `agree` families vote only when every system in them agrees. */
export const BOARD_FAMILIES: Array<{ id: string; label: string; from: ActivationFamily[]; mode: 'any' | 'agree' }> = [
  { id: 'main', label: 'Main clock', from: ['vimshottari'], mode: 'any' },
  { id: 'conditional', label: 'Conditional clock', from: ['conditional'], mode: 'any' },
  { id: 'rasi', label: 'Sign clock', from: ['rasi'], mode: 'any' },
  { id: 'karaka', label: 'Karaka clock', from: ['karaka'], mode: 'any' },
  { id: 'short', label: 'Short clocks', from: ['yogini', 'tithi_ashtottari'], mode: 'agree' },
];
const LEVEL_WEIGHT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2 };

// ---------------------------------------------------------------- reading the digest

/** The planet a reference names, read from the digest (a lord from its house card, a karaka from its point row). */
export function resolvePlanet(view: DigestView, ref: PlanetRef): string | null {
  const lord = /^L(\d{1,2})$/.exec(ref);
  if (lord) return view.house('D1', Number(lord[1]))?.lord ?? null;
  if (/^(A|Am|B|M|Pi|P|G|D)K$/.test(ref)) {
    const row = view.points('D1').find((p) => p.id === ref) ?? view.points().find((p) => p.id === ref);
    if (!row) return null;
    const planet = (row as unknown as { planet?: unknown }).planet;
    if (typeof planet === 'string') return planet;
    // the digest places a karaka by its planet's card (sign, house, dispositor): join back to that one card
    const cards = view.planets(row.varga).filter((c) => c.sign === row.sign && c.house === row.house && c.dispositor === row.lord);
    return cards.length === 1 ? cards[0]!.planet : null;
  }
  return ref;
}

function lordState(view: DigestView, lord: string | null): PlanetCard | null {
  return lord ? view.planet('D1', lord) : null;
}

/** The running rows on a date: the period covers it (from ≤ d < to, as stored). */
export function runningOn(rows: ActivationRow[], date: string): ActivationRow[] {
  return rows.filter((r) => r.from <= date && date < r.to);
}

/**
 * When an affliction lifts: the end of the afflicting planet's running period, from the activation calendar (the main
 * clock first; else any family). Null when the planet is not running: the weight stands.
 */
export function releaseOf(running: ActivationRow[], planet: string | null | undefined): string | null {
  if (!planet) return null;
  const mine = running.filter((r) => r.lord === planet);
  const main = mine.filter((r) => r.family === 'vimshottari');
  const pick = main.length ? main : mine;
  if (!pick.length) return null;
  return pick.map((r) => r.to).sort().at(-1)!;
}

// ---------------------------------------------------------------- layer 1: promise

export function promiseLayer(view: DigestView, cfg: AreaConfig): LayerRow[] {
  const out: LayerRow[] = [];
  const seenYoga = new Set<string>();
  for (const h of cfg.primary) {
    const card = view.house('D1', h);
    if (!card) continue;
    const key = `D1.h${h}`;
    const theme = `h${h}`;
    const rows: LayerRow[] = [];
    if (card.lord && card.lordHouse != null) {
      const at = view.house('D1', card.lordHouse);
      if (card.lordHouse === h || hasClass(at, GOOD_PLACE)) rows.push({ layer: 'promise', side: 'support', weight: 2, kind: 'placed_well', theme, planet: card.lord, evidence: [`${key} lord ${card.lord} in h${card.lordHouse} (${at?.class.join('/') || 'own'})`] });
    }
    const ls = lordState(view, card.lord);
    if (card.lord && isGood(card.lordDignity ?? ls?.dignity)) rows.push({ layer: 'promise', side: 'support', weight: 2, kind: 'strong', theme, planet: card.lord, evidence: [`D1.${card.lord} dignity ${card.lordDignity ?? ls?.dignity}`] });
    for (const o of card.occupants) {
      const nature = o.nature ?? view.planet('D1', o.planet)?.functional ?? null;
      if (isBenefic(nature)) rows.push({ layer: 'promise', side: 'support', weight: 1, kind: 'helped', theme, planet: o.planet, evidence: [`${key} occupant ${o.planet} (${nature})`] });
      else if (isMalefic(nature)) rows.push({ layer: 'promise', side: 'test', weight: 1, kind: 'pressed', theme, planet: o.planet, evidence: [`${key} occupant ${o.planet} (${nature})`] });
    }
    for (const p of card.aspectedGraha) {
      const f = view.planet('D1', p)?.functional ?? null;
      if (isBenefic(f)) rows.push({ layer: 'promise', side: 'support', weight: 1, kind: 'helped', theme, planet: p, evidence: [`${key} aspected_by ${p} (${f})`] });
      else if (isMalefic(f)) rows.push({ layer: 'promise', side: 'test', weight: 1, kind: 'pressed', theme, planet: p, evidence: [`${key} aspected_by ${p} (${f})`] });
    }
    if (card.sav != null && card.sav >= 28) rows.push({ layer: 'promise', side: 'support', weight: 1, kind: 'reserves', theme, evidence: [`${key} sav ${card.sav}`] });
    else if (card.sav != null && card.sav <= 22) rows.push({ layer: 'promise', side: 'test', weight: 1, kind: 'placed_hard', theme, evidence: [`${key} sav ${card.sav}`] });
    for (const y of view.yogas()) {
      if (seenYoga.has(y.id)) continue;
      const touches = y.houses.includes(h) || (!!card.lord && y.planets.includes(card.lord));
      if (!touches || CANCELLATION.test(y.name) || DOSHA.test(y.class) || cfg.yogaAfflictions.some((re) => re.test(y.name))) continue;
      seenYoga.add(y.id);
      rows.push({ layer: 'promise', side: 'support', weight: yogaWeight(y.class), kind: 'yoga', theme, evidence: [`yoga:${y.id} (${y.class})`] });
    }
    // the lord's avastha scales what the house promises (doc 46 §B.2 last row)
    const av = Object.values(ls?.avasthas ?? {});
    const mult = av.some((v) => DEAD_AVASTHA.test(v)) ? 0.5 : av.some((v) => AWAKE_AVASTHA.test(v)) ? 1.25 : 1;
    for (const r of rows) if (r.side === 'support' && mult !== 1) {
      r.weight *= mult;
      r.evidence.push(`D1.${card.lord} avastha x${mult}`);
    }
    out.push(...rows);
  }
  for (const ref of cfg.karakas) {
    const p = resolvePlanet(view, ref);
    const pc = p ? view.planet('D1', p) : null;
    if (!pc) continue;
    if (isGood(pc.dignity)) out.push({ layer: 'promise', side: 'support', weight: 1, kind: 'strong', theme: ref, planet: p, evidence: [`D1.${p} dignity ${pc.dignity}`] });
    if (pc.shadbalaRatio != null && pc.shadbalaRatio >= 1.2) out.push({ layer: 'promise', side: 'support', weight: 1, kind: 'reserves', theme: ref, planet: p, evidence: [`D1.${p} shadbala_ratio ${pc.shadbalaRatio}`] });
  }
  return out;
}

// ---------------------------------------------------------------- layer 2: afflictions

function cancelled(view: DigestView, planet: string): string | null {
  const y = view.yogas().find((x) => CANCELLATION.test(`${x.name} ${x.class}`) && x.planets.includes(planet));
  return y ? y.id : null;
}

export function afflictionLayer(view: DigestView, cfg: AreaConfig, running: ActivationRow[]): LayerRow[] {
  const out: LayerRow[] = [];
  const add = (r: Omit<LayerRow, 'layer' | 'side' | 'until'>) => out.push({ layer: 'affliction', side: 'test', until: releaseOf(running, r.planet), ...r });
  for (const h of cfg.primary) {
    const card = view.house('D1', h);
    if (!card) continue;
    const key = `D1.h${h}`;
    const theme = `h${h}`;
    if (card.lord && card.lordHouse != null && card.lordHouse !== h && hasClass(view.house('D1', card.lordHouse), HARD_PLACE)) {
      add({ weight: 2, kind: 'placed_hard', theme, planet: card.lord, evidence: [`${key} lord ${card.lord} in h${card.lordHouse} (dusthana)`] });
    }
    const ls = lordState(view, card.lord);
    if (card.lord && isBad(card.lordDignity ?? ls?.dignity) && !cancelled(view, card.lord)) add({ weight: 2, kind: 'weak', theme, planet: card.lord, evidence: [`D1.${card.lord} dignity ${card.lordDignity ?? ls?.dignity}`] });
    // combustion gives no release (doc 46 §B.3), except cazimi (empowered at heart of Sun)
    if (card.lord && ls?.combust && ls.sunProximity?.zone !== 'cazimi') out.push({ layer: 'affliction', side: 'test', weight: 1, kind: 'overshadowed', theme, planet: card.lord, until: null, evidence: [`D1.${card.lord} combust`] });
    if (card.lord && ls?.war) add({ weight: 1, kind: 'conflict', theme, planet: card.lord, evidence: [`D1.${card.lord} planetary_war`] });
    for (const o of card.occupants) if (cfg.heavy.includes(o.planet)) add({ weight: 1.5, kind: 'pressed', theme, planet: o.planet, evidence: [`${key} occupant ${o.planet}`] });
    for (const p of card.aspectedGraha) if (cfg.heavy.includes(p) && !card.occupants.some((o) => o.planet === p)) add({ weight: 1, kind: 'pressed', theme, planet: p, evidence: [`${key} aspected_by ${p}`] });
  }
  for (const ref of cfg.karakas) {
    const p = resolvePlanet(view, ref);
    const pc = p ? view.planet('D1', p) : null;
    if (!pc || !p) continue;
    for (const c of pc.conjunctions) if (cfg.heavy.includes(c)) add({ weight: 1.5, kind: 'pressed', theme: ref, planet: c, evidence: [`D1.${p} conjunct ${c}`] });
    for (const a of pc.aspectedBy) if (cfg.heavy.includes(a) && !pc.conjunctions.includes(a)) add({ weight: 1, kind: 'pressed', theme: ref, planet: a, evidence: [`D1.${p} aspected_by ${a}`] });
    if (isBad(pc.dignity) && !cancelled(view, p)) add({ weight: 1, kind: 'weak', theme: ref, planet: p, evidence: [`D1.${p} dignity ${pc.dignity}`] });
    if (pc.combust && pc.sunProximity?.zone !== 'cazimi') out.push({ layer: 'affliction', side: 'test', weight: 1, kind: 'overshadowed', theme: ref, planet: p, until: null, evidence: [`D1.${p} combust`] });
  }
  if (cfg.gandantaMoon && (view.star()?.gandanta ?? []).some((g) => g === 'Mo' || /moon/i.test(g))) {
    out.push({ layer: 'affliction', side: 'test', weight: 1, kind: 'deep_feelings', theme: 'Mo', planet: 'Mo', until: null, evidence: ['star gandanta Mo'] });
  }
  const yogas = view.yogas();
  for (const y of yogas) {
    if (CANCELLATION.test(`${y.name} ${y.class}`)) continue;
    const named = cfg.yogaAfflictions.some((re) => re.test(y.name) || re.test(y.id));
    const dosha = DOSHA.test(y.class) && y.houses.some((h) => cfg.primary.includes(h));
    if (!named && !dosha) continue;
    // an engine-listed cancellation of the same yoga lifts it
    const base = y.name.split(/\s+/)[0]!.toLowerCase();
    if (yogas.some((x) => x !== y && CANCELLATION.test(`${x.name} ${x.class}`) && x.name.toLowerCase().includes(base))) continue;
    const kind: RowKind = /kemadruma/i.test(y.name) ? 'alone' : 'dosha';
    const theme = y.houses.find((h) => cfg.primary.includes(h));
    out.push({ layer: 'affliction', side: 'test', weight: 1.5, kind, theme: theme ? `h${theme}` : cfg.karakas[0]!, planet: y.planets[0] ?? null, until: releaseOf(running, y.planets[0]), evidence: [`yoga:${y.id} (${y.class})`] });
  }
  return out;
}

// ---------------------------------------------------------------- protection

export function protectionLayer(view: DigestView, cfg: AreaConfig): LayerRow[] {
  const out: LayerRow[] = [];
  const add = (r: Omit<LayerRow, 'layer' | 'side'>) => out.push({ layer: 'protection', side: 'support', ...r });
  const lords = new Set<string>();
  for (const h of cfg.primary) {
    const card = view.house('D1', h);
    if (!card) continue;
    const key = `D1.h${h}`;
    if (card.lord) lords.add(card.lord);
    if (card.aspectedGraha.includes('Ju') || card.occupants.some((o) => o.planet === 'Ju')) add({ weight: 2, kind: 'guarded', theme: `h${h}`, planet: 'Ju', evidence: [`${key} ${card.aspectedGraha.includes('Ju') ? 'aspected_by' : 'occupant'} Ju`] });
    const benefic = (card.argala?.primary ?? []).filter((p) => !(card.argala?.obstructed ?? []).includes(p) && isBenefic(view.planet('D1', p)?.functional));
    if (benefic.length) add({ weight: 1, kind: 'held_up', theme: `h${h}`, evidence: [`${key} argala ${benefic.join(',')}`] });
    const ls = lordState(view, card.lord);
    if (ls?.dispositor) {
      const disp = view.planet('D1', ls.dispositor);
      if (isGood(disp?.dignity)) add({ weight: 1, kind: 'backed', theme: `h${h}`, planet: ls.dispositor, evidence: [`D1.${card.lord} dispositor ${ls.dispositor} dignity ${disp?.dignity}`] });
    }
  }
  for (const ref of cfg.karakas) {
    const p = resolvePlanet(view, ref);
    const pc = p ? view.planet('D1', p) : null;
    if (!pc || !p) continue;
    lords.add(p);
    if (p !== 'Ju' && (pc.aspectedBy.includes('Ju') || pc.conjunctions.includes('Ju'))) add({ weight: 2, kind: 'guarded', theme: ref, planet: 'Ju', evidence: [`D1.${p} ${pc.aspectedBy.includes('Ju') ? 'aspected_by' : 'conjunct'} Ju`] });
  }
  for (const id of cfg.protectPoints) {
    const pt = view.points('D1').find((x) => x.id === id);
    if (!pt || pt.house == null) continue;
    const card = view.house('D1', pt.house);
    if (card && (card.aspectedGraha.includes('Ju') || card.occupants.some((o) => o.planet === 'Ju'))) add({ weight: 2, kind: 'guarded', theme: id, planet: 'Ju', evidence: [`point:${id} in D1.h${pt.house}; aspected_by Ju`] });
    if (card) {
      const benefic = (card.argala?.primary ?? []).filter((p) => !(card.argala?.obstructed ?? []).includes(p) && isBenefic(view.planet('D1', p)?.functional));
      if (benefic.length) add({ weight: 1, kind: 'held_up', theme: id, evidence: [`point:${id} D1.h${pt.house} argala ${benefic.join(',')}`] });
    }
  }
  for (const y of view.yogas()) {
    if (!CANCELLATION.test(`${y.name} ${y.class}`)) continue;
    if (!y.planets.some((p) => lords.has(p))) continue;
    add({ weight: 2, kind: 'cancelled', theme: cfg.karakas[0]!, planet: y.planets[0] ?? null, evidence: [`yoga:${y.id} (${y.name})`] });
  }
  for (const v of cfg.vargaChecks) {
    const card = view.house(v.varga, v.house);
    const ls = card?.lord ? view.planet(v.varga, card.lord) : null;
    const dig = card?.lordDignity ?? ls?.dignity ?? null;
    if (card && isGood(dig)) add({ weight: 2, kind: 'deep_bond', theme: `h${v.house}`, planet: card.lord, evidence: [`${v.varga}.h${v.house} lord ${card.lord} dignity ${dig}`] });
  }
  return out;
}

// ---------------------------------------------------------------- activation

export interface Graded {
  row: ActivationRow;
  planet: string | null;
  score: number;
  side: Side | null;
  grade: Grade | null;
  evidence: string[];
}

/** A period lord's polarity to the area: functional nature, D1 and inner-varga dignity, what it lords (engine labels). */
export function gradePlanet(view: DigestView, cfg: AreaConfig, p: string): { score: number; evidence: string[] } {
  let score = 0;
  const ev: string[] = [];
  const d1 = view.planet('D1', p);
  const inner = cfg.vargas.find((v) => v !== 'D1') ?? 'D9';
  const dn = view.planet(inner, p);
  if (isBenefic(d1?.functional)) (score += 1), ev.push(`D1.${p} functional ${d1!.functional}`);
  else if (isMalefic(d1?.functional)) (score -= 1), ev.push(`D1.${p} functional ${d1!.functional}`);
  if (isGood(d1?.dignity)) (score += 1), ev.push(`D1.${p} dignity ${d1!.dignity}`);
  else if (isBad(d1?.dignity)) (score -= 1), ev.push(`D1.${p} dignity ${d1!.dignity}`);
  if (isGood(dn?.dignity)) (score += 1), ev.push(`${inner}.${p} dignity ${dn!.dignity}`);
  else if (isBad(dn?.dignity)) (score -= 1), ev.push(`${inner}.${p} dignity ${dn!.dignity}`);
  const owns = d1?.owns ?? [];
  if (owns.some((h) => cfg.primary.includes(h))) (score += 1), ev.push(`D1.${p} owns ${owns.join(',')}`);
  else if (owns.some((h) => hasClass(view.house('D1', h), HARD_PLACE))) (score -= 1), ev.push(`D1.${p} owns ${owns.join(',')} (dusthana)`);
  return { score, evidence: ev };
}

const gradeOf = (s: number): Grade | null => (Math.abs(s) >= 3 ? 'strong' : Math.abs(s) === 2 ? 'moderate' : Math.abs(s) >= 1 ? 'weak' : null);

export function gradeRow(view: DigestView, cfg: AreaConfig, row: ActivationRow): Graded {
  let planet = row.lord;
  let bonus = 0;
  const ev: string[] = [`act:${row.system}/L${row.level}/${row.lord ?? row.sign}/${row.from}..${row.to}`];
  if (!planet && row.sign) {
    // a sign period: the D1 house card of that sign names its lord (a lookup)
    const card = view.houses('D1').find((c) => c.sign === row.sign);
    planet = card?.lord ?? null;
    if (card && cfg.primary.includes(card.house)) (bonus += 1), ev.push(`D1.h${card.house} sign ${row.sign}`);
  }
  if (!planet) return { row, planet: null, score: 0, side: null, grade: null, evidence: ev };
  const g = gradePlanet(view, cfg, planet);
  if (row.parentLord && row.lord) {
    const cell = view.planet('D1', row.parentLord)?.dashaCharter?.fruition?.[row.lord];
    if (cell) {
      if (cell.fruitionClass === 'dusthana_reversal_crisis' || cell.isShadAshtaka68) {
        bonus -= 1;
        ev.push(`D1.${row.parentLord} charter fruition ${row.lord} 6/8/12`);
      } else if (cell.isStarLordOfMd || cell.isSignDispositorOfMd) {
        bonus += 1;
        ev.push(`D1.${row.parentLord} charter link ${row.lord}`);
      }
    }
  }
  const score = g.score + bonus;
  return { row, planet, score, side: score > 0 ? 'support' : score < 0 ? 'test' : null, grade: gradeOf(score), evidence: [...ev, ...g.evidence] };
}

export interface FamilyVote {
  family: string;
  vote: Vote;
}

/** The vote of each board family on a date (career.ts familyVote: 'any' families need their systems not to disagree). */
export function familyVotes(graded: Graded[], date: string): FamilyVote[] {
  const on = graded.filter((g) => g.row.from <= date && date < g.row.to);
  const out: FamilyVote[] = [];
  for (const f of BOARD_FAMILIES) {
    const rows = on.filter((g) => f.from.includes(g.row.family));
    if (!rows.length) continue;
    const bySystem = new Map<string, number>();
    for (const g of rows) bySystem.set(g.row.system, (bySystem.get(g.row.system) ?? 0) + g.score * (LEVEL_WEIGHT[g.row.level] ?? 1));
    const votes = [...bySystem.values()].map((s): Vote => (s >= 0.5 ? 'support' : s <= -0.5 ? 'test' : 'neutral'));
    let vote: Vote = 'neutral';
    if (f.mode === 'any') {
      const sides = votes.filter((v) => v !== 'neutral');
      if (sides.length && sides.every((v) => v === sides[0])) vote = sides[0]!;
    } else {
      const systems = new Set(rows.map((g) => f.from.indexOf(g.row.family)));
      if (systems.size === f.from.length && votes.every((v) => v === votes[0])) vote = votes[0]!;
    }
    out.push({ family: f.id, vote });
  }
  return out;
}

// ---------------------------------------------------------------- transit (the stored sky overlay)

export function transitLayer(payload: TransitRangePayload | null, cfg: AreaConfig, asOf: string): LayerRow[] | null {
  if (!payload || !Array.isArray(payload.ingresses)) return null;
  const out: LayerRow[] = [];
  for (const r of payload.ingresses) {
    if (!(r.from <= asOf && asOf <= r.to)) continue;
    if (!cfg.primary.includes(r.house_from_lagna)) continue;
    const ev = [`transit:${r.planet} h_from_lagna ${r.house_from_lagna} ${r.from}..${r.to}`];
    const theme = `h${r.house_from_lagna}`;
    if (r.planet === 'Ju') out.push({ layer: 'transit', side: 'support', weight: 1.5, kind: 'sky_helps', theme, planet: 'Ju', until: r.to, evidence: ev });
    else if (r.planet === 'Sa') out.push({ layer: 'transit', side: 'test', weight: 1.5, kind: 'sky_slows', theme, planet: 'Sa', until: r.to, evidence: ev });
    else if (r.planet === 'Ra' || r.planet === 'Ke') out.push({ layer: 'transit', side: 'test', weight: 1, kind: 'sky_unsettles', theme, planet: r.planet, until: r.to, evidence: ev });
  }
  if (cfg.sadeSati) {
    for (const s of payload.sade_sati ?? []) {
      if (s.from <= asOf && asOf <= s.to) out.push({ layer: 'transit', side: 'test', weight: 1.5, kind: 'long_test', theme: 'Mo', planet: 'Sa', until: s.to, evidence: [`transit:sade_sati ${s.phase} ${s.from}..${s.to}`] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- annual (the current year chart)

/**
 * The year chart running on `asOf`: the Tithi Pravesha D1 row whose return moment has passed (`runningTithiPravesha`,
 * doc 66 §4.10). Null when no TP year covers the date; the Varsha row is never put in its place.
 */
export function currentYear(view: DigestView, asOf: string): AnnualRow | null {
  return runningTithiPravesha(view, asOf).row;
}

export function annualLayer(view: DigestView, cfg: AreaConfig, asOf: string): { year: AnnualRow | null; rows: LayerRow[] } {
  const year = currentYear(view, asOf);
  if (!year) return { year: null, rows: [] };
  const rows: LayerRow[] = [];
  const tag = `annual:${year.kind}${year.year}`;
  for (const h of cfg.primary) {
    const card = year.houses.find((c) => c.house === h);
    if (!card || card.lordHouse == null) continue;
    const at = year.houses.find((c) => c.house === card.lordHouse);
    if ((card.lordHouse === h || hasClass(at, GOOD_PLACE)) && !isBad(card.lordDignity)) rows.push({ layer: 'annual', side: 'support', weight: 1, kind: 'year_backs', theme: `h${h}`, planet: card.lord, evidence: [`${tag}.h${h} lord ${card.lord} in h${card.lordHouse}`] });
    else if (card.lordHouse !== h && hasClass(at, HARD_PLACE)) rows.push({ layer: 'annual', side: 'test', weight: 1, kind: 'year_tests', theme: `h${h}`, planet: card.lord, evidence: [`${tag}.h${h} lord ${card.lord} in h${card.lordHouse} (dusthana)`] });
  }
  for (const s of year.sahams) {
    if (s.house == null) continue;
    const at = year.houses.find((c) => c.house === s.house);
    if (!hasClass(at, /kendra/i)) continue;
    const name = s.name.toLowerCase();
    if (cfg.sahams.support.includes(name)) rows.push({ layer: 'annual', side: 'support', weight: 1, kind: 'year_backs', theme: cfg.karakas[0]!, evidence: [`${tag} saham ${name} in h${s.house} (kendra)`] });
    else if (cfg.sahams.test.includes(name)) rows.push({ layer: 'annual', side: 'test', weight: 1, kind: 'year_tests', theme: cfg.karakas[0]!, evidence: [`${tag} saham ${name} in h${s.house} (kendra)`] });
  }
  return { year, rows };
}

// ---------------------------------------------------------------- varga and nakshatra layers (doc 46 §B.7–§B.8; doc 53 §4.5)

/** Owning divisional charts of the area's primary houses and their D1 lords (doc 46 §B.7). */
export function vargaLayer(view: DigestView, cfg: AreaConfig): LayerRow[] {
  const out: LayerRow[] = [];
  const checked = new Set(cfg.vargaChecks.map((c) => `${c.varga}.h${c.house}`));
  for (const v of cfg.vargas.filter((x) => x !== 'D1')) {
    for (const h of cfg.primary) {
      const theme = `h${h}`;
      const d1 = view.house('D1', h);
      const vHouse = view.house(v, h);
      if (vHouse && !checked.has(`${v}.h${h}`)) {
        if (isGood(vHouse.lordDignity)) {
          out.push({ layer: 'varga', side: 'support', weight: 1, kind: 'placed_well', theme, planet: vHouse.lord, evidence: [`${v}.h${h} lord ${vHouse.lord} dignity ${vHouse.lordDignity}`] });
        } else if (isBad(vHouse.lordDignity)) {
          out.push({ layer: 'varga', side: 'test', weight: 1, kind: 'weak', theme, planet: vHouse.lord, evidence: [`${v}.h${h} lord ${vHouse.lord} dignity ${vHouse.lordDignity}`] });
        }
      }
      if (d1?.lord) {
        const vLord = view.planet(v, d1.lord);
        if (vLord) {
          if (isGood(vLord.dignity)) {
            out.push({ layer: 'varga', side: 'support', weight: 1, kind: 'backed', theme, planet: d1.lord, evidence: [`${v}.${d1.lord} dignity ${vLord.dignity}`] });
          } else if (isBad(vLord.dignity)) {
            out.push({ layer: 'varga', side: 'test', weight: 1, kind: 'weak', theme, planet: d1.lord, evidence: [`${v}.${d1.lord} dignity ${vLord.dignity}`] });
          }
        }
      }
    }
  }
  return out;
}

const GOOD_TARA = /sampat|kshema|sadhana|sadhaka|mitra|parama/i;
const BAD_TARA = /vipat|pratyak|vadha|naidhana/i;

/** Cusp stars of the primary houses, their star lords in D1, and the running main-clock lord's tara (doc 46 §B.8). */
export function nakshatraLayer(view: DigestView, cfg: AreaConfig, running: ActivationRow[] = []): LayerRow[] {
  const out: LayerRow[] = [];
  for (const h of cfg.primary) {
    const card = view.house('D1', h);
    const cusp = card?.cuspStar;
    if (!cusp?.lord) continue;
    const theme = `h${h}`;
    const lordCard = view.planet('D1', cusp.lord);
    if (isGood(lordCard?.dignity)) {
      out.push({ layer: 'nakshatra', side: 'support', weight: 1, kind: 'helped', theme, planet: cusp.lord, evidence: [`D1.h${h} cusp_star ${cusp.name} lord ${cusp.lord} dignity ${lordCard?.dignity}`] });
    } else if (isBad(lordCard?.dignity)) {
      out.push({ layer: 'nakshatra', side: 'test', weight: 1, kind: 'weak', theme, planet: cusp.lord, evidence: [`D1.h${h} cusp_star ${cusp.name} lord ${cusp.lord} dignity ${lordCard?.dignity}`] });
    }
  }
  const starProfile = view.star();
  if (starProfile?.taras?.length) {
    const primaryTheme = `h${cfg.primary[0]!}`;
    for (const r of running.filter((x) => x.family === 'vimshottari' && x.lord && x.level <= 2)) {
      const pCard = view.planet('D1', r.lord!);
      if (!pCard?.star) continue;
      const taraRow = starProfile.taras.find((t) => t.star === pCard.star);
      if (!taraRow) continue;
      if (GOOD_TARA.test(taraRow.tara)) {
        out.push({ layer: 'nakshatra', side: 'support', weight: 1, kind: 'helped', theme: primaryTheme, planet: r.lord, evidence: [`star:${r.lord} in ${pCard.star} tara ${taraRow.tara}`] });
      } else if (BAD_TARA.test(taraRow.tara)) {
        out.push({ layer: 'nakshatra', side: 'test', weight: 1, kind: 'weak', theme: primaryTheme, planet: r.lord, until: r.to, evidence: [`star:${r.lord} in ${pCard.star} tara ${taraRow.tara}`] });
      }
    }
  }
  return out;
}

const sumSide = (rows: LayerRow[]) => rows.reduce((s, r) => s + (r.side === 'support' ? r.weight : -r.weight), 0);
const voteOf = (s: number): Vote => (s >= 1 ? 'support' : s <= -1 ? 'test' : 'neutral');

// ---------------------------------------------------------------- the board

export interface BoardLine {
  text: string;
  evidence: string[];
  subCategory?: string;
  from?: string | null;
  to?: string | null;
  dateLabel?: string;
  reading?: string;
  natalPromise?: string;
  periodCharter?: string;
  aspectsAndPlacements?: string[];
  techniqueId?: string;
}
export interface PressureLine extends BoardLine {
  until: string | null;
}
export interface AheadWindow {
  subarea: string;
  label: string;
  from: string;
  to: string;
  side: Side;
  grade: Grade;
  systems: string[];
}
export interface AreaBoardBody {
  asOf: string;
  tone: {
    tone: Tone;
    confidence: Confidence;
    families: Array<{ family: string; vote: Vote }>;
    /** the day it changes: eases (demanding/easing), closes (open/closing), next opening (steady); null when not in range */
    date: string | null;
  };
  supports: BoardLine[];
  pressures: PressureLine[];
  ahead: AheadWindow[];
  year: { year: number; note: string } | null;
  back: Array<{ month: string; side: Side; label: string }>;
  notes: string[];
  characterArc?: SelfCharacterArc;
  personalityAndJoy?: SelfPersonalityAndJoy;
}

export interface BuiltBoard {
  board: AreaBoardBody;
  /** sub-area → strength ahead (sum of graded windows in the next 12 months); the lead when the person set no focus */
  subareaScores: Record<string, number>;
  /** counts for the run summary */
  counts: { promise: number; affliction: number; protection: number; activation: number; transit: number | null; annual: number; varga: number; nakshatra: number };
}

export interface BoardInput {
  view: DigestView;
  cfg: AreaConfig;
  asOf: string;
  /** periods activating the area's houses, from 12 months back to 30 years ahead */
  activation: ActivationRow[];
  /** every period running on asOf (for release dates), any houses */
  running: ActivationRow[];
  transit: TransitRangePayload | null;
  /** optional person age in years on `asOf` for 3-decade age labels on the Self board */
  ageYears?: number | null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PLURAL_THEME = /\b(ideas|feelings|partnerships|friendships|bonds|relationships)\b/i;
const isPlural = (t: string) => PLURAL_THEME.test(t);

/** Shared plain-words table (doc 45 §3.3): no planet, house or period names. */
export const KIND_WORDS: Record<RowKind, (t: string) => string> = {
  placed_well: (t) => `${cap(t)} ${isPlural(t) ? 'have' : 'has'} firm footing.`,
  strong: (t) => `${cap(t)} ${isPlural(t) ? 'are' : 'is'} naturally strong.`,
  helped: (t) => `${cap(t)} ${isPlural(t) ? 'get' : 'gets'} steady support.`,
  reserves: (t) => `${cap(t)} ${isPlural(t) ? 'have' : 'has'} deep reserves.`,
  yoga: (t) => `A rare strength in your chart lifts ${t}.`,
  guarded: (t) => `Something steady watches over ${t}.`,
  cancelled: () => 'An early weakness turns into strength over time.',
  held_up: (t) => `Good influences hold ${t} up.`,
  backed: (t) => `What stands behind ${t} is itself strong.`,
  deep_bond: () => 'The deeper side of a bond is well supported.',
  placed_hard: (t) => `${cap(t)} ${isPlural(t) ? 'take more effort than they look' : 'takes more effort than it looks'}.`,
  weak: (t) => `${cap(t)} ${isPlural(t) ? 'ask' : 'asks'} for patience.`,
  overshadowed: (t) => `${cap(t)} can feel overshadowed.`,
  conflict: (t) => `${cap(t)} can feel pulled two ways.`,
  pressed: (t) => `A heavy influence presses on ${t}.`,
  deep_feelings: () => 'Feelings run deep and can turn quickly.',
  alone: () => 'You can feel on your own at times.',
  dosha: (t) => `An old pattern weighs on ${t}.`,
  sky_helps: (t) => `A slow-moving influence is kind to ${t} for now.`,
  sky_slows: (t) => `A slow-moving influence asks for patience with ${t}.`,
  sky_unsettles: (t) => `A slow-moving influence unsettles ${t}.`,
  long_test: () => 'A long, testing stretch for your feelings.',
  year_backs: (t) => `This year's chart backs ${t}.`,
  year_tests: (t) => `This year's chart asks for patience with ${t}.`,
};

export function lineText(cfg: AreaConfig, r: Pick<LayerRow, 'kind' | 'theme'>): string {
  const theme = cfg.words.themes[r.theme] ?? cfg.words.themes[cfg.karakas[0]!] ?? 'this part of your life';
  return (cfg.words.kinds?.[r.kind] ?? KIND_WORDS[r.kind])(theme);
}

function lines<T extends LayerRow>(cfg: AreaConfig, rows: T[], max: number): Array<BoardLine & { until: string | null; weight: number; theme: string; layer: LayerId }> {
  const by = new Map<string, BoardLine & { until: string | null; weight: number; theme: string; layer: LayerId }>();
  for (const r of [...rows].sort((a, b) => b.weight - a.weight)) {
    const text = lineText(cfg, r);
    const prev = by.get(text);
    if (prev) {
      prev.weight += r.weight;
      for (const e of r.evidence) if (!prev.evidence.includes(e)) prev.evidence.push(e);
      if (r.until && (!prev.until || r.until > prev.until)) prev.until = r.until;
    } else by.set(text, { text, evidence: [...r.evidence], until: r.until ?? null, weight: r.weight, theme: r.theme, layer: r.layer });
  }
  return [...by.values()].sort((a, b) => b.weight - a.weight).slice(0, max);
}

function enrichLine(
  cfg: AreaConfig,
  item: { text: string; evidence: string[]; until: string | null; theme: string; layer: LayerId },
  side: Side,
  asOf: string,
  ahead: AheadWindow[],
): BoardLine & { until: string | null } {
  const themeLabel = cfg.words.themes[item.theme] ?? cfg.words.themes[cfg.karakas[0]!] ?? 'this area';
  const subMatch = cfg.subareas.find((s) => item.theme.startsWith('h') && s.houses.includes(Number(item.theme.slice(1)))) ?? cfg.subareas[0];
  const subCategory = subMatch?.id ?? (cfg.area === 'love' ? 'health' : 'identity');
  const win = ahead.find((w) => w.side === side && w.subarea === subCategory) ?? ahead.find((w) => w.side === side) ?? ahead[0] ?? null;
  const from = side === 'support' ? (win?.from ?? asOf) : asOf;
  const to = side === 'support' ? (win?.to ?? null) : item.until;
  const dateLabel =
    side === 'support'
      ? from && to
        ? `${from} – ${to}`
        : `Active from ${asOf}`
      : item.until
        ? `Now – ${item.until}`
        : 'Steady discipline across active periods';
  const techniqueId =
    side === 'support'
      ? item.layer === 'protection'
        ? `${cfg.area}.protection`
        : `${cfg.area}.promise`
      : `${cfg.area}.affliction`;
  const reading =
    side === 'support'
      ? `${item.text} Grounded in ${themeLabel}, this structural strength steadies your choices and helps constructive efforts compound across ${dateLabel}.`
      : `${item.text} Focused on ${themeLabel}, this pressure asks for deliberate pacing, clear agreements, and unhurried recovery across ${dateLabel}.`;
  const natalPromise =
    side === 'support'
      ? `Natal foundation for ${themeLabel} is well anchored across your primary and inner charts.`
      : `Natal sensitivity in ${themeLabel} matures through patience, realistic boundaries, and consistent follow-through.`;
  const periodCharter =
    side === 'support'
      ? `Active period charter (${dateLabel}) supports constructive initiative in ${subMatch?.title.toLowerCase() ?? themeLabel}.`
      : item.until
        ? `Active period charter tests ${themeLabel} until ${item.until}, when the heaviest weight lifts.`
        : `Standing discipline: pace commitments in ${themeLabel} with steady weekly habits.`;

  return {
    text: item.text,
    until: item.until,
    evidence: item.evidence,
    subCategory,
    from,
    to,
    dateLabel,
    reading,
    natalPromise,
    periodCharter,
    aspectsAndPlacements: item.evidence,
    techniqueId,
  };
}

export function votesSide(votes: FamilyVote[]): Vote {
  const tests = votes.filter((v) => v.vote === 'test').length;
  const supports = votes.filter((v) => v.vote === 'support').length;
  const mainVote = votes.find((v) => v.family === 'main')?.vote ?? null;
  const condVote = votes.find((v) => v.family === 'conditional')?.vote ?? null;
  const readingVote = condVote && condVote !== 'neutral' ? condVote : mainVote;

  // Primary clocks (`conditional ?? main` and `main`) govern tone direction; secondary clocks cannot outvote them into the opposite side.
  if (readingVote === 'test' && mainVote !== 'support') {
    return (condVote === 'test' && mainVote === 'test') || tests >= 2 ? 'test' : 'neutral';
  }
  if (readingVote === 'support' && mainVote !== 'test') {
    return (condVote === 'support' && mainVote === 'support') || supports >= 2 ? 'support' : 'neutral';
  }
  if (readingVote && mainVote && readingVote !== mainVote && readingVote !== 'neutral' && mainVote !== 'neutral') {
    return 'neutral';
  }
  return tests >= 2 && tests > supports ? 'test' : supports >= 2 && supports > tests ? 'support' : 'neutral';
}

export function presentTone(series: Array<{ month: string; side: Vote }>, nowIdx: number, votes: FamilyVote[]): AreaBoardBody['tone'] {
  const tests = votes.filter((v) => v.vote === 'test').length;
  const supports = votes.filter((v) => v.vote === 'support').length;
  const available = votes.length;
  const at = (i: number) => series[i]?.side ?? 'neutral';
  const primarySide = seriesSide(votes);
  const demanding = primarySide === 'test';
  const open = primarySide === 'support';
  let date: string | null = null;
  let tone: Tone = 'steady';
  if (demanding) {
    let j = nowIdx + 1;
    while (j < series.length && at(j) === 'test') j++;
    date = j < series.length ? monthStart(series[j]!.month) : null;
    tone = j === nowIdx + 1 && j < series.length ? 'easing' : 'demanding';
  } else if (open) {
    let k = nowIdx + 1;
    while (k < series.length && at(k) === 'support') k++;
    date = k < series.length ? addDaysIso(monthEnd(series[k - 1]!.month), -1) : null;
    tone = k === nowIdx + 1 && k < series.length ? 'closing' : 'open';
  } else {
    let n = nowIdx + 1;
    while (n < series.length && at(n) !== 'support') n++;
    date = n < series.length ? monthStart(series[n]!.month) : null;
  }
  const side: Vote = tone === 'demanding' || tone === 'easing' ? 'test' : tone === 'open' || tone === 'closing' ? 'support' : 'neutral';
  const agree = side === 'test' ? tests : side === 'support' ? supports : votes.filter((v) => v.vote === 'neutral').length;
  const mainAgrees = votes.find((v) => v.family === 'main')?.vote === side;
  let confidence: Confidence;
  if (side === 'neutral') confidence = tests >= 2 && supports >= 2 ? 'split' : supports >= 2 || tests >= 2 ? 'likely' : 'confirmed';
  else if (agree >= Math.max(3, Math.ceil(available * 0.6)) && mainAgrees) confidence = 'confirmed';
  else if (agree >= 2 && agree > (side === 'test' ? supports : tests)) confidence = 'likely';
  else confidence = 'split';
  return { tone, confidence, families: votes, date };
}

function seriesSide(votes: FamilyVote[]): Vote {
  return votesSide(votes);
}

export const AHEAD_MONTHS = 36;
const MAX_PER_SUBAREA = 4;
const GRADE_RANK: Record<Grade, number> = { weak: 1, moderate: 2, strong: 3 };

export function aheadWindows(view: DigestView, cfg: AreaConfig, graded: Graded[], asOf: string): AheadWindow[] {
  const horizon = addMonthsIso(asOf, AHEAD_MONTHS);
  const shortHorizon = addMonthsIso(asOf, getShadeShortHorizonMonths());
  const turnHorizon = addMonthsIso(asOf, 12 * 30);
  const resolved = cfg.subareas.map((s) => ({ s, planets: new Set(s.planets.map((p) => resolvePlanet(view, p)).filter((p): p is string => !!p)) }));
  const raw: AheadWindow[] = [];
  for (const g of graded) {
    if (!g.side || !g.grade || g.row.to <= asOf) continue;
    const isTurn = g.row.level === 1 && g.row.family === 'vimshottari' && g.row.from > asOf && g.row.from <= turnHorizon;
    // a main-clock chapter counts only as a turning point; a sign-clock period (rasi family, level 1) is a window itself
    if (g.row.level === 1 && !isTurn && g.row.family !== 'rasi') continue;
    if (g.row.level === 1 && g.row.family === 'rasi' && g.row.from > horizon) continue;
    if (g.row.level !== 1 && g.row.from > horizon) continue;
    if (g.row.level === 3 && g.row.from > shortHorizon) continue;
    for (const { s, planets } of resolved) {
      if (!s.sides.includes(g.side)) continue;
      if (s.level1Only ? !isTurn : isTurn) continue;
      const byPlanet = g.row.lord !== null && planets.has(g.row.lord);
      const bySign = g.row.lord === null && g.row.houses.some((h) => s.houses.includes(h));
      if (!byPlanet && !bySign) continue;
      raw.push({ subarea: s.id, label: isTurn ? cfg.words.turn[g.side] : cfg.words.ahead[g.side][g.grade], from: g.row.from < asOf ? asOf : g.row.from, to: addDaysIso(g.row.to, -1), side: g.side, grade: g.grade, systems: [g.row.system] });
    }
  }
  // overlapping windows of one sub-area and side merge: the dates join, the systems join, the higher grade stands
  raw.sort((a, b) => a.subarea.localeCompare(b.subarea) || a.side.localeCompare(b.side) || a.from.localeCompare(b.from));
  const merged: AheadWindow[] = [];
  for (const w of raw) {
    const last = merged.at(-1);
    if (last && last.subarea === w.subarea && last.side === w.side && w.from <= last.to) {
      if (w.to > last.to) last.to = w.to;
      for (const s of w.systems) if (!last.systems.includes(s)) last.systems.push(s);
      if (GRADE_RANK[w.grade] > GRADE_RANK[last.grade]) (last.grade = w.grade), (last.label = w.label);
    } else merged.push({ ...w, systems: [...w.systems] });
  }
  const order = cfg.subareas.map((s) => s.id);
  const out: AheadWindow[] = [];
  for (const id of order) out.push(...merged.filter((w) => w.subarea === id).sort((a, b) => a.from.localeCompare(b.from)).slice(0, MAX_PER_SUBAREA));
  return out;
}

export function buildBoard(input: BoardInput): BuiltBoard {
  const { view, cfg, asOf } = input;
  const notes: string[] = [];
  const promise = promiseLayer(view, cfg);
  const affliction = afflictionLayer(view, cfg, input.running);
  const protection = protectionLayer(view, cfg);
  const varga = vargaLayer(view, cfg);
  const nakshatra = nakshatraLayer(view, cfg, input.running);
  const transit = transitLayer(input.transit, cfg, asOf);
  if (transit === null) notes.push('The slow-moving sky is not stored for this chart yet; the board reads the timing clocks and the year chart only.');
  const annual = annualLayer(view, cfg, asOf);
  if (!annual.year) notes.push("This year's chart is not stored yet.");
  const graded = input.activation.map((r) => gradeRow(view, cfg, r));

  // the month series: activation families only (the sky and the year chart speak for now)
  const months = monthsBetween(addMonthsIso(asOf, -12), addMonthsIso(asOf, 24));
  const series = months.map((m) => ({ month: m, side: seriesSide(familyVotes(graded, monthMid(m))) }));
  const nowIdx = months.indexOf(monthOf(asOf));
  const votes = familyVotes(graded, asOf);
  if (transit !== null) votes.push({ family: 'transit', vote: voteOf(sumSide(transit)) });
  if (annual.year) votes.push({ family: 'annual', vote: voteOf(sumSide(annual.rows)) });
  const missing = BOARD_FAMILIES.filter((f) => !votes.some((v) => v.family === f.id)).map((f) => f.label.toLowerCase());
  if (missing.length) notes.push(`Not running for this chart today: ${missing.join(', ')}; confidence scales to the families present.`);
  const tone = presentTone(series, nowIdx, votes);

  const ahead = aheadWindows(view, cfg, graded, asOf);
  const supportPool = [...promise.filter((r) => r.side === 'support'), ...protection, ...varga.filter((r) => r.side === 'support'), ...nakshatra.filter((r) => r.side === 'support'), ...(transit ?? []).filter((r) => r.side === 'support')];
  const strongThemes = new Set<string>();
  for (const r of supportPool) {
    if (r.weight >= 2) strongThemes.add(r.theme);
  }
  const pressurePool = [
    ...affliction,
    ...varga.filter((r) => r.side === 'test' && !(r.kind === 'weak' && !r.until && strongThemes.has(r.theme))),
    ...nakshatra.filter((r) => r.side === 'test' && !(r.kind === 'weak' && !r.until && strongThemes.has(r.theme))),
    ...(transit ?? []).filter((r) => r.side === 'test'),
  ];
  const supports = lines(cfg, supportPool, 5).map((item) => {
    const { until: _u, ...rest } = enrichLine(cfg, item, 'support', asOf, ahead);
    return rest;
  });
  const pressures = lines(cfg, pressurePool, 5).map((item) => enrichLine(cfg, item, 'test', asOf, ahead));
  const in12 = addMonthsIso(asOf, 12);
  const subareaScores: Record<string, number> = {};
  for (const w of ahead) if (w.from < in12) subareaScores[w.subarea] = (subareaScores[w.subarea] ?? 0) + GRADE_RANK[w.grade];

  let year: AreaBoardBody['year'] = null;
  if (annual.year) {
    const s = sumSide(annual.rows);
    year = { year: annual.year.year, note: s >= 1 ? cfg.words.year.support : s <= -1 ? cfg.words.year.test : cfg.words.year.mixed };
  }

  // Looking back (doc 45 §9): the sharpest edges of the last 12 months, both directions, at most three
  const edges: AreaBoardBody['back'] = [];
  for (let k = Math.max(1, nowIdx - 12); k < nowIdx; k++) {
    const c = series[k]!;
    if (c.side === 'neutral' || c.side === series[k - 1]!.side) continue;
    edges.push({ month: c.month, side: c.side, label: cfg.words.back[c.side] });
  }
  const back = [...edges.filter((e) => e.side === 'test').slice(-2), ...edges.filter((e) => e.side === 'support').slice(-2)]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 3)
    .sort((a, b) => a.month.localeCompare(b.month));

  const characterArc =
    cfg.area === 'self'
      ? buildSelfCharacterArc(view, input.activation, asOf, { ageYears: input.ageYears ?? null })
      : cfg.area === 'love'
        ? buildLoveRelationshipArc(view, input.activation, asOf, { ageYears: input.ageYears ?? null })
        : undefined;
  const personalityAndJoy =
    cfg.area === 'self'
      ? buildSelfPersonalityAndJoy(view)
      : cfg.area === 'love'
        ? buildLoveBondingAndChemistry(view)
        : undefined;

  return {
    board: {
      asOf,
      tone,
      supports,
      pressures,
      ahead,
      year,
      back,
      notes,
      ...(characterArc ? { characterArc } : {}),
      ...(personalityAndJoy ? { personalityAndJoy } : {}),
    },
    subareaScores,
    counts: { promise: promise.length, affliction: affliction.length, protection: protection.length, activation: input.activation.length, transit: transit ? transit.length : null, annual: annual.rows.length, varga: varga.length, nakshatra: nakshatra.length },
  };
}
