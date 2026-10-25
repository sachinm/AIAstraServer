/**
 * Triangulation (docs/reading-engine/11): five layers, the convergence rule, deciders, the fortune tier and the
 * SynthBrief the synthesizer writes from (docs/reading-engine/09 §3). Deterministic, no model, no astronomy: every
 * input is a field the Radha engine computed (dossier, transit chart) or a specialist's layer score.
 *
 *   L1 promise (natal)   from the promise specialist          weight 3   required
 *   L2 timing (dasha)    from the dasha specialist            weight 2   required
 *   L3 trigger (transit) from the transit specialist          weight 2   required when the horizon is 3 years or less
 *   L4 second school     from the nakshatra specialist        weight 1   optional
 *   L5 annual chart      not exported yet                     weight 1   optional
 */
import type { SubjectId } from '../packs/frames.js';
import type { Dossier } from '../facts/types.js';
import type { TransitChart } from '../transits/types.js';
import type { Finding, SpecialistAnalyst } from './specialists.js';

export type LayerId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type VerdictLevel = 'strong' | 'moderate' | 'weak' | 'not_indicated' | 'mixed';
export type AgreementLabel = 'converge' | 'partial' | 'diverge';

export const LAYER_OF: Record<SpecialistAnalyst, LayerId> = { promise: 'L1', dasha: 'L2', transit: 'L3', nakshatra: 'L4' };
export const LAYER_WEIGHT: Record<LayerId, number> = { L1: 3, L2: 2, L3: 2, L4: 1, L5: 1 };

export interface LayerScores {
  L1?: number;
  L2?: number;
  L3?: number;
  L4?: number;
  L5?: number;
}

export interface Verdict {
  level: VerdictLevel;
  agreement: AgreementLabel;
  /** −9…+9 style weighted sum, logged, never shown */
  score: number;
  /** caps applied (missing required layer, data gap) */
  caps: string[];
}

const clamp = (n: number, lo = -3, hi = 3) => Math.max(lo, Math.min(hi, Math.round(n)));

/** The convergence rule of file 11 §1, with the missing-layer caps of §6. */
export function convergence(layers: LayerScores, opts: { transitRequired: boolean; missingRequired: LayerId[] } = { transitRequired: true, missingRequired: [] }): Verdict {
  const caps: string[] = [];
  const present = (Object.keys(layers) as LayerId[]).filter((k) => typeof layers[k] === 'number');
  const score = present.reduce((s, k) => s + LAYER_WEIGHT[k] * (layers[k] as number), 0);
  const L1 = layers.L1;
  const L2 = layers.L2;
  const L3 = layers.L3;
  let level: VerdictLevel;
  if (L1 !== undefined && L1 <= -2) level = 'not_indicated'; // transits cannot deliver what the chart denies
  else {
    const core = [L1, L2, opts.transitRequired ? L3 : L3 ?? undefined].filter((x): x is number => typeof x === 'number');
    const pos = core.filter((x) => x >= 1).length;
    const hardNeg = core.some((x) => x <= -2);
    if (L1 !== undefined && L1 >= 1 && (L2 ?? -9) >= 1 && (!opts.transitRequired || (L3 ?? -9) >= 1)) level = 'strong';
    else if (pos >= 2 && !hardNeg) level = 'moderate';
    else if (pos >= 1) level = 'weak';
    else if (L1 !== undefined && L1 >= 1 && L2 !== undefined && L3 !== undefined && Math.sign(L2) !== Math.sign(L3) && L2 !== 0 && L3 !== 0) level = 'mixed';
    else level = 'not_indicated';
  }
  // a required layer that failed caps the verdict at weak (file 11 §6)
  if (opts.missingRequired.length) {
    caps.push(`missing ${opts.missingRequired.join(', ')}`);
    if (level === 'strong' || level === 'moderate') level = 'weak';
  }
  const signs = present.filter((k) => k !== 'L5').map((k) => Math.sign(layers[k] as number)).filter((s) => s !== 0);
  const agreement: AgreementLabel = signs.length <= 1 || signs.every((s) => s === signs[0]) ? 'converge' : signs.filter((s) => s === signs[0]).length >= signs.length / 2 ? 'partial' : 'diverge';
  return { level, agreement, score, caps };
}

// ---- deciders (file 11 §3) ---------------------------------------------------------------------------------

/** Evidence-id patterns of the facts that settle a split promise, per subject. */
export const DECIDERS: Partial<Record<SubjectId, { primary: RegExp[]; secondary: RegExp[]; text: string }>> = {
  marriage_relationship: { primary: [/varga\.D9\./, /houses\.7\.lord/], secondary: [/UL\b|upapada/i, /double_transit/], text: 'D-9 7th lord dignity and the D-1 7th lord in D-9; then the Upapada and the double transit on the 7th' },
  career_work: { primary: [/houses\.10\.lord/, /varga\.D10\./], secondary: [/AmK/, /shadbala/], text: "the 10th lord's dispositor and the D-10 10th lord; then the AmK and the strongest planet" },
  income_wealth: { primary: [/houses\.(2|11)\.lord/, /bodies\.Ju\./], secondary: [/special_lagnas\.IL/, /varga\.D2\./], text: 'the 2nd and 11th lords and Jupiter; then the Indu Lagna and D-2' },
  debt_loss_expense: { primary: [/houses\.12\.lord/], secondary: [/viparita/i], text: "the 12th lord's placement; then a viparita raja yoga" },
  property_home: { primary: [/varga\.D4\./, /bodies\.Ma\./], secondary: [/A4/, /sav/], text: 'the 4th lord in D-4 and Mars; then A4 and the SAV of the 4th' },
  children: { primary: [/varga\.D7\./, /bodies\.Ju\./], secondary: [/PK/], text: 'the 5th lord in D-7 and Jupiter; then the PK' },
  education_learning: { primary: [/bodies\.(Me|Ju)\./, /houses\.5\.lord/], secondary: [/houses\.4\.lord/], text: 'Mercury and Jupiter with the 5th lord; then the 4th lord' },
  foreign_relocation: { primary: [/houses\.12\.lord/, /bodies\.Ra\./], secondary: [/houses\.(9|7)\.lord/], text: 'the 12th lord and Rahu; then the 9th and 7th lords' },
  litigation_government: { primary: [/houses\.(6|7)\.lord/], secondary: [/houses\.11\./], text: 'the 6th lord against the 7th lord; then the 11th' },
  spirituality_moksha: { primary: [/bodies\.(Ke|Ju)\./], secondary: [/AK|karakamsa/i], text: 'Ketu and Jupiter; then the AK in D-9' },
  speculation_lottery: { primary: [/houses\.(5|11)\.lord/], secondary: [/sav/], text: 'the 5th and 11th lords; then their SAV' },
};

/**
 * When the promise layer is split (verdict mixed, or its claims point both ways), claims whose evidence matches the
 * subject's primary deciders count double (secondary 1.5×), and L1 is recomputed from the weighted claims.
 */
export function applyDeciders(promise: Finding | undefined, subject: SubjectId): { L1: number | undefined; used: string[] } {
  if (!promise) return { L1: undefined, used: [] };
  const base = typeof promise.layerScore === 'number' ? promise.layerScore : undefined;
  const pos = promise.claims.filter((c) => c.polarity === 'supports').length;
  const neg = promise.claims.filter((c) => c.polarity === 'obstructs').length;
  const split = promise.verdict === 'mixed' || (pos > 0 && neg > 0);
  const d = DECIDERS[subject];
  if (!split || !d) return { L1: base, used: [] };
  let num = 0;
  let den = 0;
  const used = new Set<string>();
  for (const c of promise.claims) {
    if (c.polarity === 'neutral') continue;
    const prim = c.evidence.some((e) => d.primary.some((r) => r.test(e)));
    const sec = !prim && c.evidence.some((e) => d.secondary.some((r) => r.test(e)));
    const mult = prim ? 2 : sec ? 1.5 : 1;
    if (prim || sec) for (const e of c.evidence) used.add(e);
    num += (c.polarity === 'supports' ? 1 : -1) * c.weight * mult;
    den += c.weight * mult;
  }
  if (!den) return { L1: base, used: [] };
  return { L1: clamp((num / den) * 3), used: [...used] };
}

// ---- fortune tier (file 11 §4) ------------------------------------------------------------------------------

export type FortuneTier = 'rising' | 'steady' | 'testing' | 'heavy';

const DIGNITY_SCORE: Record<string, number> = { exalted: 2, moolatrikona: 2, own: 2, friend: 1, great_friend: 1, neutral: 0, enemy: -1, great_enemy: -1, debilitated: -2 };
const GOOD_HOUSES = new Set([1, 4, 5, 7, 9, 10]);
const DUSTHANA = new Set([6, 8, 12]);

/** Reads dossier and transit fields only; returns the tier and the date it next changes (next AD boundary). */
export function fortuneTier(d: Dossier, t: TransitChart | null, asOf: string): { tier: FortuneTier; score: number; until: string | null; inputs: Record<string, number> } {
  const dd = d as unknown as {
    houses: Record<string, { lord: string; lord_dignity?: string; lord_house?: number; sign?: number }>;
    bodies: Record<string, { dignity?: string; house?: number }>;
    ashtakavarga?: { sav?: number[] };
    dasha: { vimshottari: { current: { md?: string; ad?: string; ad_end?: string } } };
  };
  const inputs: Record<string, number> = {};
  const h9 = dd.houses['9'];
  let ninth = 0;
  if (h9) {
    ninth += DIGNITY_SCORE[h9.lord_dignity ?? 'neutral'] ?? 0;
    if (h9.lord_house && GOOD_HOUSES.has(h9.lord_house)) ninth += 1;
    if (h9.lord_house && DUSTHANA.has(h9.lord_house)) ninth -= 1;
    const sav9 = typeof h9.sign === 'number' ? dd.ashtakavarga?.sav?.[h9.sign] : undefined;
    if (typeof sav9 === 'number') ninth += sav9 >= 28 ? 1 : sav9 <= 22 ? -1 : 0;
  }
  inputs.ninth = clamp(ninth);
  const ju = dd.bodies.Ju;
  inputs.jupiter = clamp((DIGNITY_SCORE[ju?.dignity ?? 'neutral'] ?? 0) + (ju?.house && GOOD_HOUSES.has(ju.house) ? 1 : ju?.house && DUSTHANA.has(ju.house) ? -1 : 0));
  const cur = dd.dasha.vimshottari.current;
  const dashaLordHouse = (p?: string) => (p ? dd.bodies[p]?.house : undefined);
  const mdH = dashaLordHouse(cur.md);
  const adH = dashaLordHouse(cur.ad);
  inputs.dasha = clamp([mdH, adH].reduce((s: number, h) => s + (h && GOOD_HOUSES.has(h) ? 1 : h && DUSTHANA.has(h) ? -1 : 0), 0));
  let transit = 0;
  const now = t?.now as Record<string, { house_from_moon?: number }> | undefined;
  const juM = now?.Ju?.house_from_moon;
  const saM = now?.Sa?.house_from_moon;
  if (juM) transit += [2, 5, 7, 9, 11].includes(juM) ? 1 : -0.5;
  if (saM) transit += [3, 6, 11].includes(saM) ? 1 : [12, 1, 2, 8].includes(saM) ? -1 : 0;
  if ((t as unknown as { sade_sati?: { now?: unknown } } | null)?.sade_sati?.now) transit -= 1;
  inputs.transit = clamp(transit);
  const score = 3 * inputs.ninth + 2 * inputs.jupiter + 2 * inputs.dasha + 2 * inputs.transit;
  const tier: FortuneTier = score >= 6 ? 'rising' : score >= 0 ? 'steady' : score >= -6 ? 'testing' : 'heavy';
  void asOf;
  return { tier, score, until: cur.ad_end ?? null, inputs };
}

// ---- SynthBrief (file 09 §3) --------------------------------------------------------------------------------

export interface BriefWindow {
  from: string;
  to: string;
  label: string;
  polarity: 'favourable' | 'testing' | 'mixed';
  source: string;
}

export interface SynthBrief {
  template: string;
  subjects: string[];
  horizon: unknown;
  question: string;
  verdict: Verdict;
  layers: LayerScores;
  deciders: { text: string; evidence: string[] } | null;
  now: { md?: string; ad?: string; pd?: string; until?: string } | null;
  next: { from: string; to: string; mdAd: string } | null;
  windows: BriefWindow[];
  keyFacts: string[];
  caveats: string[];
  fortune: { tier: FortuneTier; until: string | null } | null;
  /** traditions the specialists applied (Parashara, Jaimini, nakshatra …) */
  traditions: string[];
}

/** The running AD from the dossier (re-selected by date) and the next AD from the dated period list. */
export function nowAndNext(d: Dossier, asOf: string): { now: SynthBrief['now']; next: SynthBrief['next'] } {
  const v = (d as unknown as { dasha: { vimshottari: { current: { md?: string; ad?: string; pd?: string; ad_end?: string }; periods: Array<{ level: string; md: string; ad?: string; start: string; end: string }> } } }).dasha.vimshottari;
  const cur = v.current;
  // the dossier lists PD rows near today and AD rows further out: the next AD is the first row (any level) with a
  // different MD-AD after today, and it ends where the last contiguous row of that MD-AD ends
  const rows = [...v.periods].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
  const same = (r: { md: string; ad?: string }, md?: string, ad?: string) => r.md === md && r.ad === ad;
  const i = rows.findIndex((r) => r.start >= asOf && !same(r, cur.md, cur.ad) && !!r.ad);
  let next: SynthBrief['next'] = null;
  if (i >= 0) {
    const first = rows[i]!;
    let end = first.end;
    for (let j = i + 1; j < rows.length && same(rows[j]!, first.md, first.ad); j++) end = rows[j]!.end;
    next = { from: first.start, to: end, mdAd: `${first.md}-${first.ad}` };
  }
  return { now: cur.md ? { md: cur.md, ad: cur.ad, pd: cur.pd, until: cur.ad_end } : null, next };
}

/** Renders the brief as the compact block the synthesizer reads (stable key order, no whitespace noise). */
export function renderBrief(b: SynthBrief): string {
  return [
    `TEMPLATE: ${b.template}`,
    `VERDICT: ${b.verdict.level} (agreement ${b.verdict.agreement}${b.verdict.caps.length ? `; ${b.verdict.caps.join('; ')}` : ''})`,
    `LAYERS: ${Object.entries(b.layers).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`,
    b.deciders ? `DECIDERS: ${b.deciders.text}` : '',
    b.now ? `NOW: ${b.now.md}-${b.now.ad}${b.now.pd ? `-${b.now.pd}` : ''} until ${b.now.until}` : '',
    b.next ? `NEXT: ${b.next.mdAd} from ${b.next.from} to ${b.next.to}` : '',
    b.fortune ? `FORTUNE: ${b.fortune.tier}${b.fortune.until ? ` until ${b.fortune.until}` : ''}` : '',
    `WINDOWS:\n${b.windows.map((w) => `- ${w.from} to ${w.to} | ${w.polarity} | ${w.label} | ${w.source}`).join('\n') || '- none in the horizon'}`,
    `KEY FACTS:\n${b.keyFacts.map((f) => `- ${f}`).join('\n') || '- none'}`,
    b.caveats.length ? `CAVEATS:\n${b.caveats.map((c) => `- ${c}`).join('\n')}` : '',
    b.traditions.length ? `TRADITIONS APPLIED: ${b.traditions.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
