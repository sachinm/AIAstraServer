/**
 * Convergence (docs/reading-engine/27 §A.4, §A.6, §B.5): per marker and month, the score of every system that activates
 * it, the independence count, the band, and the agent and channel. Arithmetic on the activation matrix only.
 *
 * - A system counts once per marker and month: its strongest activation on each side (support / test). Transit
 *   contacts are the exception: each contact is one item and the items add up, capped at `s6ItemCap`.
 * - support score = sum of weight x strength over systems on the support side; test score the same on the adverse side.
 * - Bands: high >= 3 systems and score >= 7; moderate >= 2 and >= 4.5; possible >= 1 and >= 2.5; else quiet. A cell is
 *   `testing` when its adverse side reaches the testing rule (>= 2 systems, >= 4.5) and bands at least as high as the
 *   support side. S7 adds to the scores but is not an independent system (it rides on the S1-S4 lords).
 * - Agent = argmax of weight x strength on the winning side, ties broken by shadbala rank; channel = the next planet.
 * - Grain: monthly. A dasha period runs in a month when it covers the 15th; a transit contact when it overlaps the month.
 * - Quiet months (every marker quiet) collapse into strips naming the Vimshottari lords running.
 */
import type { Foundation } from './foundation.js';
import type { DashaStack } from './dashas.js';
import { runningOn } from './dashas.js';
import { weightOf, type BandRule, type TimelineConfig, type TimelineWeights } from './config.js';
import { MARKER_IDS, type MarkerId } from './markers.js';
import { monthEnd, monthMid, monthStart } from './months.js';
import type { Activation, Band, SystemId } from './types.js';

export interface SystemCell {
  support: number;
  test: number;
  /** The strongest activation's planet on the winning side */
  planet: string | null;
  evidence: string[];
}

export interface MonthCell {
  month: string;
  marker: MarkerId;
  band: Band;
  testing: boolean;
  supportScore: number;
  testScore: number;
  supportSystems: SystemId[];
  testSystems: SystemId[];
  systems: Partial<Record<SystemId, SystemCell>>;
  agent: string | null;
  channel: string | null;
}

export interface TimelineWindow {
  marker: MarkerId;
  /** first month 'YYYY-MM' and last month (inclusive) */
  fromMonth: string;
  toMonth: string;
  /** ISO dates: first day, and the first day after the window */
  from: string;
  to: string;
  months: number;
  band: Exclude<Band, 'quiet'>;
  testing: boolean;
  /** peak scores over the window, and the peak month's systems and agent */
  supportScore: number;
  testScore: number;
  peakMonth: string;
  systems: Partial<Record<SystemId, SystemCell>>;
  agent: string | null;
  channel: string | null;
}

export interface QuietStrip {
  fromMonth: string;
  toMonth: string;
  /** e.g. "Vimshottari Ju-Sa" */
  lords: string;
}

export interface TimelineGrid {
  months: string[];
  cells: Record<MarkerId, MonthCell[]>;
  windows: TimelineWindow[];
  quiet: QuietStrip[];
}

export interface ConvergeOptions {
  config: TimelineConfig;
  weights: TimelineWeights;
  /** `dasha.applicable` lists Ashtottari (S3 at full weight) */
  s3Applicable: boolean;
  foundation: Foundation;
  stack: DashaStack;
}

const BAND_ORDER: Record<Band, number> = { quiet: 0, possible: 1, moderate: 2, high: 3 };

function bandOf(score: number, systems: number, bands: TimelineConfig['bands'], testRule?: BandRule): Band {
  if (systems >= bands.high.systems && score >= bands.high.score) return 'high';
  const mod = testRule ?? bands.moderate;
  if (systems >= mod.systems && score >= mod.score) return 'moderate';
  if (!testRule && systems >= bands.possible.systems && score >= bands.possible.score) return 'possible';
  return 'quiet';
}

/** An activation runs in a month (dasha periods: on the 15th; contacts: any overlap) */
export function runsIn(a: Activation, month: string): boolean {
  if (a.level === 'contact') return a.from < monthEnd(month) && a.to > monthStart(month);
  const mid = monthMid(month);
  return a.from <= mid && mid < a.to;
}

interface Side {
  strength: number;
  best: Activation | null;
}

function sideOf(acts: Activation[], system: SystemId, cap: number): Side {
  if (!acts.length) return { strength: 0, best: null };
  const best = acts.reduce((a, b) => (b.strength > a.strength ? b : a));
  if (system !== 'S6') return { strength: best.strength, best };
  const perItem = new Map<string, number>();
  for (const a of acts) perItem.set(a.item ?? '', Math.max(perItem.get(a.item ?? '') ?? 0, a.strength));
  return { strength: Math.min(cap, [...perItem.values()].reduce((s, v) => s + v, 0)), best };
}

export function cellFor(month: string, marker: MarkerId, acts: Activation[], opts: ConvergeOptions): MonthCell {
  const { config, weights, foundation } = opts;
  const bySystem = new Map<SystemId, Activation[]>();
  for (const a of acts) {
    if (a.marker !== marker) continue;
    const list = bySystem.get(a.system) ?? [];
    list.push(a);
    bySystem.set(a.system, list);
  }
  let supportScore = 0;
  let testScore = 0;
  const supportSystems: SystemId[] = [];
  const testSystems: SystemId[] = [];
  const systems: MonthCell['systems'] = {};
  const candidates: Array<{ planet: string; value: number; polarity: 1 | -1 }> = [];
  for (const [system, list] of bySystem) {
    const w = weightOf(weights, system, marker) * (system === 'S3' && !opts.s3Applicable ? config.s3NotApplicableFactor : 1);
    if (w <= 0) continue;
    const sup = sideOf(list.filter((a) => a.polarity === 1), system, config.s6ItemCap);
    const tst = sideOf(list.filter((a) => a.polarity === -1), system, config.s6ItemCap);
    const independent = !config.modifierSystems.includes(system);
    if (sup.strength > 0) {
      supportScore += w * sup.strength;
      if (independent) supportSystems.push(system);
      candidates.push({ planet: sup.best!.planet, value: w * sup.best!.strength, polarity: 1 });
    }
    if (tst.strength > 0) {
      testScore += w * tst.strength;
      if (independent) testSystems.push(system);
      candidates.push({ planet: tst.best!.planet, value: w * tst.best!.strength, polarity: -1 });
    }
    const lead = sup.strength >= tst.strength ? sup.best : tst.best;
    systems[system] = { support: sup.strength, test: tst.strength, planet: lead?.planet ?? null, evidence: lead?.evidence ?? [] };
  }
  const supportBand = bandOf(supportScore, supportSystems.length, config.bands);
  const testBand = bandOf(testScore, testSystems.length, config.bands, config.bands.testing);
  const testing = testBand !== 'quiet' && BAND_ORDER[testBand] >= BAND_ORDER[supportBand];
  const band = testing ? testBand : supportBand;
  const rank = (p: string): number => foundation.planets[p as keyof Foundation['planets']]?.shadbalaRank ?? 99;
  const side = candidates.filter((c) => c.polarity === (testing ? -1 : 1)).sort((a, b) => b.value - a.value || rank(a.planet) - rank(b.planet));
  const agent = side[0]?.planet ?? null;
  const channel = side.find((c) => c.planet !== agent)?.planet ?? null;
  const round = (n: number): number => Math.round(n * 100) / 100;
  return { month, marker, band, testing, supportScore: round(supportScore), testScore: round(testScore), supportSystems, testSystems, systems, agent, channel };
}

/** The monthly grid, its merged windows and the quiet strips */
export function converge(activations: readonly Activation[], months: readonly string[], opts: ConvergeOptions): TimelineGrid {
  const cells = Object.fromEntries(MARKER_IDS.map((m) => [m, [] as MonthCell[]])) as Record<MarkerId, MonthCell[]>;
  for (const month of months) {
    const running = activations.filter((a) => runsIn(a, month));
    for (const m of MARKER_IDS) cells[m].push(cellFor(month, m, running, opts));
  }
  const windows: TimelineWindow[] = [];
  for (const m of MARKER_IDS) {
    let cur: TimelineWindow | null = null;
    for (const c of cells[m]) {
      if (cur && c.band === cur.band && c.testing === cur.testing) {
        cur.toMonth = c.month;
        cur.to = monthEnd(c.month);
        cur.months += 1;
        const peak = Math.max(c.supportScore, c.testScore) > Math.max(cur.supportScore, cur.testScore);
        cur.supportScore = Math.max(cur.supportScore, c.supportScore);
        cur.testScore = Math.max(cur.testScore, c.testScore);
        if (peak) Object.assign(cur, { peakMonth: c.month, systems: c.systems, agent: c.agent, channel: c.channel });
        continue;
      }
      if (cur) windows.push(cur);
      cur =
        c.band === 'quiet'
          ? null
          : { marker: m, fromMonth: c.month, toMonth: c.month, from: monthStart(c.month), to: monthEnd(c.month), months: 1, band: c.band, testing: c.testing, supportScore: c.supportScore, testScore: c.testScore, peakMonth: c.month, systems: c.systems, agent: c.agent, channel: c.channel };
    }
    if (cur) windows.push(cur);
  }
  const quiet: QuietStrip[] = [];
  months.forEach((month, i) => {
    if (MARKER_IDS.some((m) => cells[m][i]!.band !== 'quiet')) return;
    const lords = runningOn(opts.stack.rows, 'vimsottari', monthMid(month))
      .filter((r) => r.level <= 2)
      .map((r) => r.lord)
      .join('-');
    const last = quiet.at(-1);
    if (last && months[i - 1] === last.toMonth && last.lords === `Vimshottari ${lords}`) last.toMonth = month;
    else quiet.push({ fromMonth: month, toMonth: month, lords: `Vimshottari ${lords}` });
  });
  return { months: [...months], cells, windows, quiet };
}

/** Months 'YYYY-MM' where the marker is at least `min` (default moderate), either polarity */
export function flaggedMonths(grid: TimelineGrid, marker: MarkerId, min: Band = 'moderate'): Set<string> {
  return new Set(grid.cells[marker].filter((c) => BAND_ORDER[c.band] >= BAND_ORDER[min]).map((c) => c.month));
}
