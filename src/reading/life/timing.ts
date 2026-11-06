/**
 * The dasha engine of the life reading (docs/reading-engine/34 §2, §3): windows over the next fifteen years in which the
 * area's houses are activated, graded by cross-system agreement, the year chart and the sky.
 *
 * A window starts from a Vimshottari sub-period (level 2; level 1 when no level 2 is stored) whose activated houses (the
 * digest's activation calendar, doc 54 §2) meet the area's houses and whose lord does not test the area. Another family
 * agrees when one of its periods overlapping the window activates the area's houses without testing it; it contradicts
 * when every such period tests it. A dated statement needs Vimshottari and at least one of the applicable conditional
 * dasha, a Jaimini rasi dasha, Yogini or Tithi Ashtottari; with fewer the window is a possibility, written as one.
 *
 * Score per window, doc 34 §2: the promise layers (55 × the area's promise ratio) + Vimshottari 8 + the agreeing
 * families' weights − the contradicting families' weights + the year charts that confirm (TP 6, VP 4) + an open transit
 * gate 10. 70+ strong, 50–69 moderate, under 50 weak. When the sky is not stored for the window its 10 points are not
 * earned and the basis says so.
 *
 * Node selects rows, intersects date ranges, counts and sums weights. It derives nothing astrological.
 */
import type { ActivationFamily, ActivationRow, AnnualRow, DigestView } from '../digest/types.js';
import type { LifeArea } from './areas.js';
import { overlaps } from './labels.js';
import { ANNUAL_WEIGHTS, FAMILY_WEIGHTS, LAYER_WEIGHTS, annualSide, periodLord, periodSide, type AreaPromise } from './promise.js';
import type { SkyView } from './sky.js';

export type Grade = 'strong' | 'moderate' | 'weak';
/** the families that count toward the two-system minimum (doc 34 §2) */
export const DATING_FAMILIES: ActivationFamily[] = ['conditional', 'rasi', 'yogini', 'tithi_ashtottari'];
const OTHER_FAMILIES: ActivationFamily[] = [...DATING_FAMILIES, 'karaka', 'other'];

export interface TimingWindow {
  from: string;
  to: string;
  md: string | null;
  ad: string | null;
  /** the systems that agree, Vimshottari first */
  systems: string[];
  families: ActivationFamily[];
  contradicts: string[];
  annual: 'confirms' | 'silent' | 'missing';
  transit: 'open' | 'closed' | 'unknown';
  score: number;
  grade: Grade;
  basis: string;
  dated: boolean;
  /** evidence ids: activation rows, annual rows, transit gate */
  evidence: string[];
}

export interface AreaTiming {
  windows: TimingWindow[];
  /** the best three dated windows, in date order */
  improves: TimingWindow[];
  /** when nothing is dated: the year of the first undated opening, written as a possibility */
  possibility: { year: number } | null;
}

export interface TimingInputs {
  today: string;
  horizonEnd: string;
  /** activation rows over [today, horizonEnd] for the area's houses (any system, levels 1–2) */
  rows: ActivationRow[];
  /** annual rows by year; empty when the digest holds none */
  annual: (year: number) => AnnualRow[];
  sky: SkyView | null;
}

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const count = (n: number) => NUM[n] ?? String(n);

export function gradeOf(score: number): Grade {
  return score >= 70 ? 'strong' : score >= 50 ? 'moderate' : 'weak';
}

export function basisOf(w: Pick<TimingWindow, 'grade' | 'systems' | 'contradicts' | 'annual' | 'transit'>): string {
  const parts = [`${w.grade}: ${count(w.systems.length)} ${w.systems.length === 1 ? 'system points' : 'systems agree'}`];
  if (w.annual === 'confirms') parts.push('the year chart confirms');
  if (w.transit === 'open') parts.push('the sky confirms');
  if (w.transit === 'unknown') parts.push('the sky check is not available for these dates');
  if (w.contradicts.length) parts.push(`${count(w.contradicts.length)} ${w.contradicts.length === 1 ? 'disagrees' : 'disagree'}`);
  return parts.join(', ');
}

const yearsOf = (from: string, to: string): number[] => {
  const out: number[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push(y);
  return out;
};

export function areaTiming(view: DigestView, area: LifeArea, promise: AreaPromise, input: TimingInputs): AreaTiming {
  const span = { from: input.today, to: input.horizonEnd };
  const inSpan = input.rows.filter((r) => overlaps(r, span));
  const vim = inSpan.filter((r) => r.family === 'vimshottari');
  const level = vim.some((r) => r.level === 2) ? 2 : 1;
  const candidates = vim.filter((r) => r.level === level).sort((a, b) => a.from.localeCompare(b.from));
  const promisePts = (LAYER_WEIGHTS.d1 + LAYER_WEIGHTS.varga) * promise.promiseRatio;

  const windows: TimingWindow[] = [];
  for (const c of candidates) {
    const side = periodSide(view, c, area.houses);
    if (side === 'silent' || side === 'test') continue;
    const win = { from: c.from < input.today ? input.today : c.from, to: c.to };
    const systems = [c.system];
    const families: ActivationFamily[] = ['vimshottari'];
    const contradicts: string[] = [];
    const evidence = [`activation:${c.system}/${c.level}/${c.from}`];
    let dasha = FAMILY_WEIGHTS.vimshottari;
    for (const fam of OTHER_FAMILIES) {
      const over = inSpan.filter((r) => r.family === fam && overlaps(r, win));
      const sides = over.map((r) => ({ r, s: periodSide(view, r, area.houses) })).filter((x) => x.s !== 'silent');
      if (!sides.length) continue;
      const agree = sides.find((x) => x.s !== 'test');
      if (agree) {
        systems.push(agree.r.system);
        families.push(fam);
        dasha += FAMILY_WEIGHTS[fam];
        evidence.push(`activation:${agree.r.system}/${agree.r.level}/${agree.r.from}`);
      } else {
        contradicts.push(sides[0].r.system);
        dasha -= FAMILY_WEIGHTS[fam];
        evidence.push(`activation:${sides[0].r.system}/${sides[0].r.level}/${sides[0].r.from}`);
      }
    }

    // rank 4: a year chart overlapping the window confirms when its D1 card supports the primary house
    // (TP and VP each earn their weight once, from any year the window touches)
    const confirming = new Set<'TP' | 'VP'>();
    let anyYear = false;
    for (const y of yearsOf(win.from, win.to)) {
      for (const a of input.annual(y)) {
        const s = annualSide(view, a, area.houses[0]);
        if (!s) continue;
        anyYear = true;
        if (s.side === 'support' && !confirming.has(a.kind)) {
          confirming.add(a.kind);
          evidence.push(`annual:${a.kind}${a.year}.h${area.houses[0]}`);
        }
      }
    }
    const annualPts = [...confirming].reduce((s, k) => s + ANNUAL_WEIGHTS[k], 0);

    // rank 5: Jupiter and Saturn together on an area house inside the window (engine double_transit)
    let transit: TimingWindow['transit'] = 'unknown';
    if (input.sky && win.from <= input.sky.to) {
      const gate = input.sky.gates.find((g) => overlaps(g, win) && g.houses.some((h) => area.houses.includes(h)));
      transit = gate ? 'open' : 'closed';
      if (gate) evidence.push(`transit:double/${gate.from}`);
    }

    const score = Math.max(0, Math.min(100, Math.round(promisePts + dasha + annualPts + (transit === 'open' ? LAYER_WEIGHTS.transit : 0))));
    const grade = gradeOf(score);
    const w: TimingWindow = {
      ...win,
      md: c.level === 2 ? c.parentLord : periodLord(view, c),
      ad: c.level === 2 ? periodLord(view, c) : null,
      systems,
      families,
      contradicts,
      annual: annualPts ? 'confirms' : anyYear ? 'silent' : 'missing',
      transit,
      score,
      grade,
      basis: '',
      dated: families.some((f) => DATING_FAMILIES.includes(f)),
      evidence,
    };
    w.basis = basisOf(w);
    windows.push(w);
  }

  const dated = windows.filter((w) => w.dated);
  const improves = [...dated].sort((a, b) => b.score - a.score || a.from.localeCompare(b.from)).slice(0, 3).sort((a, b) => a.from.localeCompare(b.from));
  const possibility = !dated.length && windows.length ? { year: Number(windows[0].from.slice(0, 4)) } : null;
  return { windows, improves, possibility };
}
