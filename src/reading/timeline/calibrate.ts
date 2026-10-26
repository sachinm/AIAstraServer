/**
 * Calibration, v2 (docs/reading-engine/29 §5): threshold-free measures of whether a technique ranks the months the ledger
 * says something happened above the others, and the per-chart weight update.
 *
 * For each technique (and the combined score, 'ALL') and each marker with ledger events:
 * - its **monthly score** is its strongest activation of the marker in the month, support plus test (ALL: the grid's
 *   max(support, test) score);
 * - **mean percentile**: where the event months sit in that technique's own ranking of the grid's months (ties count
 *   half; a year-precision event averages its twelve months). 0.5 = random;
 * - **lift at density d** (8 %, 20 %, 35 %): flag the technique's top d of months (score > 0 only); hits = events with a
 *   flagged month within ±1 month; lift = hits / the hits a random choice of as many months would expect
 *   (hypergeometric, match.ts). 1.0 = random;
 * - **weight** = prior x clamp(0.5 + lift@20 / 2, 0.5, 1.5), shrunk toward the prior by n / (n + 5) (n = ledger events of
 *   the marker): ten events move a weight, one barely does.
 * A conditional technique (S3) is dropped (weight 0) when `dasha.applicable` does not list it AND its pooled lift@20 does
 * not beat random.
 */
import type { TimelineConfig, TimelineWeights } from './config.js';
import { runsIn, type TimelineGrid } from './converge.js';
import { eventMonths, type LifeEvent } from './ledger.js';
import { hitZone, inGrid, randomHitProbability } from './match.js';
import { MARKER_IDS, markerForCategory, type MarkerId } from './markers.js';
import type { Activation, SystemId } from './types.js';

export interface DensityResult {
  density: number;
  flagged: number;
  hits: number;
  /** expected hits of a random choice of `flagged` months */
  expected: number;
  lift: number | null;
}

export interface CalibrationRow {
  system: SystemId | 'ALL';
  /** a marker, or '*' pooled over the markers that have ledger events */
  marker: MarkerId | '*';
  /** ledger events behind the row */
  n: number;
  meanPercentile: number | null;
  byDensity: DensityResult[];
  /** at 20 %: flagged months within ±1 month of an event / flagged months, and events hit / events */
  precision: number | null;
  recall: number | null;
  /** months with a score > 0 / grid months */
  coverage: number;
  multiplier: number;
  weight: number;
  dropped?: boolean;
}

export interface Calibration {
  rows: CalibrationRow[];
  weights: TimelineWeights;
}

/** Percentile of a value in a list (ties count half) */
export function percentileOf(scores: readonly number[], v: number): number {
  let below = 0;
  let equal = 0;
  for (const s of scores) {
    if (s < v) below++;
    else if (s === v) equal++;
  }
  return scores.length ? (below + equal / 2) / scores.length : 0.5;
}

/** The top `share` of months by score (score > 0 only; ties by month order) */
export function topMonths(months: readonly string[], scores: readonly number[], share: number): Set<string> {
  const k = Math.round(share * months.length);
  return new Set(
    months
      .map((m, i) => ({ m, s: scores[i]! }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.m.localeCompare(b.m))
      .slice(0, k)
      .map((x) => x.m)
  );
}

interface Tally {
  n: number;
  pctSum: number;
  densities: Array<{ density: number; flagged: number; hits: number; expected: number }>;
  inZone20: number;
  flagged20: number;
  positive: number;
  months: number;
}

function tally(months: readonly string[], scores: readonly number[], events: ReadonlyArray<string[]>, densities: readonly number[], tol: number): Tally {
  const index = new Map(months.map((m, i) => [m, i]));
  let pctSum = 0;
  for (const em of events) {
    const inside = em.filter((m) => index.has(m));
    pctSum += inside.reduce((s, m) => s + percentileOf(scores, scores[index.get(m)!]!), 0) / Math.max(1, inside.length);
  }
  const zones = events.map((em) => hitZone(months, em, tol));
  const allZone = new Set(zones.flatMap((z) => [...z]));
  let inZone20 = 0;
  let flagged20 = 0;
  const ds = densities.map((density) => {
    const flagged = topMonths(months, scores, density);
    const hits = zones.filter((z) => [...z].some((m) => flagged.has(m))).length;
    const expected = zones.reduce((s, z) => s + randomHitProbability(months.length, flagged.size, z.size), 0);
    if (Math.abs(density - 0.2) < 1e-9) {
      flagged20 = flagged.size;
      inZone20 = [...flagged].filter((m) => allZone.has(m)).length;
    }
    return { density, flagged: flagged.size, hits, expected };
  });
  return { n: events.length, pctSum, densities: ds, inZone20, flagged20, positive: scores.filter((s) => s > 0).length, months: months.length };
}

function sum(ts: Tally[], densities: readonly number[]): Tally {
  return {
    n: ts.reduce((s, t) => s + t.n, 0),
    pctSum: ts.reduce((s, t) => s + t.pctSum, 0),
    densities: densities.map((density, i) => ({ density, flagged: ts.reduce((s, t) => s + t.densities[i]!.flagged, 0), hits: ts.reduce((s, t) => s + t.densities[i]!.hits, 0), expected: ts.reduce((s, t) => s + t.densities[i]!.expected, 0) })),
    inZone20: ts.reduce((s, t) => s + t.inZone20, 0),
    flagged20: ts.reduce((s, t) => s + t.flagged20, 0),
    positive: ts.reduce((s, t) => s + t.positive, 0),
    months: ts.reduce((s, t) => s + t.months, 0),
  };
}

function row(system: CalibrationRow['system'], marker: CalibrationRow['marker'], t: Tally, prior: number, config: TimelineConfig): CalibrationRow {
  const byDensity: DensityResult[] = t.densities.map((d) => ({ ...d, lift: t.n && d.expected > 0 ? d.hits / d.expected : null }));
  const at20 = byDensity.find((d) => Math.abs(d.density - 0.2) < 1e-9);
  const lift20 = at20?.lift ?? null;
  const { floor, ceiling, shrinkK } = config.calibration;
  const raw = lift20 == null ? 1 : Math.min(ceiling, Math.max(floor, 0.5 + lift20 / 2));
  const multiplier = t.n ? 1 + (raw - 1) * (t.n / (t.n + shrinkK)) : 1;
  return {
    system,
    marker,
    n: t.n,
    meanPercentile: t.n ? t.pctSum / t.n : null,
    byDensity,
    precision: t.flagged20 ? t.inZone20 / t.flagged20 : null,
    recall: t.n && at20 ? at20.hits / t.n : null,
    coverage: t.months ? t.positive / t.months : 0,
    multiplier: Math.round(multiplier * 1000) / 1000,
    weight: Math.round(prior * multiplier * 1000) / 1000,
  };
}

export interface CalibrateInput {
  grid: TimelineGrid;
  activations: readonly Activation[];
  events: readonly LifeEvent[];
  systems: readonly SystemId[];
  config: TimelineConfig;
  s3Applicable: boolean;
}

export function calibrate(input: CalibrateInput): Calibration {
  const { grid, activations, config } = input;
  const tol = config.matchTolerance.hit;
  const dens = config.calibration.densities;
  const priors = config.weights.systems;
  const eventsBy = new Map<MarkerId, string[][]>();
  for (const e of input.events) {
    const m = markerForCategory(e.category);
    const months = eventMonths(e);
    if (!m || !inGrid(grid, months)) continue;
    eventsBy.set(m, [...(eventsBy.get(m) ?? []), months]);
  }

  // per system and marker: the monthly technique score (support + test)
  const score = new Map<string, number[]>();
  grid.months.forEach((month, i) => {
    const best = new Map<string, { sup: number; tst: number }>();
    for (const a of activations) {
      if (!runsIn(a, month)) continue;
      const k = `${a.system}|${a.marker}`;
      const b = best.get(k) ?? { sup: 0, tst: 0 };
      if (a.polarity === 1) b.sup = Math.max(b.sup, a.strength);
      else b.tst = Math.max(b.tst, a.strength);
      best.set(k, b);
    }
    for (const [k, b] of best) {
      if (!score.has(k)) score.set(k, new Array(grid.months.length).fill(0));
      score.get(k)![i] = b.sup + b.tst;
    }
  });
  const zeros = new Array(grid.months.length).fill(0);

  const rows: CalibrationRow[] = [];
  const weights: TimelineWeights = { systems: { ...priors }, byMarker: {} };
  for (const s of input.systems) {
    const tallies: Tally[] = [];
    for (const m of MARKER_IDS) {
      const t = tally(grid.months, score.get(`${s}|${m}`) ?? zeros, eventsBy.get(m) ?? [], dens, tol);
      const r = row(s, m, t, priors[s], config);
      rows.push(r);
      if (eventsBy.has(m)) {
        tallies.push(t);
        (weights.byMarker![m] ??= {})[s] = r.weight;
      }
    }
    const pooled = row(s, '*', sum(tallies, dens), priors[s], config);
    const lift20 = pooled.byDensity.find((d) => Math.abs(d.density - 0.2) < 1e-9)?.lift ?? null;
    if (s === 'S3' && !input.s3Applicable && !(lift20 != null && lift20 > 1)) {
      pooled.dropped = true;
      pooled.weight = 0;
      for (const m of eventsBy.keys()) weights.byMarker![m]![s] = 0;
    }
    weights.systems[s] = pooled.weight;
    rows.push(pooled);
  }

  const ensemble: Tally[] = [];
  for (const m of MARKER_IDS) {
    const t = tally(grid.months, grid.cells[m].map((c) => Math.max(c.supportScore, c.testScore)), eventsBy.get(m) ?? [], dens, tol);
    rows.push(row('ALL', m, t, 1, config));
    if (eventsBy.has(m)) ensemble.push(t);
  }
  rows.push(row('ALL', '*', sum(ensemble, dens), 1, config));
  return { rows, weights };
}

/**
 * Chart-swap check (doc 29 §5 item 4): the person's ledger scored against their own grid and against other charts'
 * grids over the same months. The timeline reads *this* chart only if `own` beats the median of `others`.
 */
export function chartSwap(events: readonly LifeEvent[], own: TimelineGrid, others: readonly TimelineGrid[], config: TimelineConfig): { own: number | null; others: Array<number | null>; median: number | null; beats: boolean | null } {
  const lift = (g: TimelineGrid): number | null => {
    const c = calibrate({ grid: g, activations: [], events, systems: [], config, s3Applicable: true });
    return c.rows.find((r) => r.system === 'ALL' && r.marker === '*')!.byDensity.find((d) => Math.abs(d.density - 0.2) < 1e-9)?.lift ?? null;
  };
  const o = lift(own);
  const rest = others.map(lift);
  const vals = rest.filter((x): x is number => x != null).sort((a, b) => a - b);
  const median = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2]! : (vals[vals.length / 2 - 1]! + vals[vals.length / 2]!) / 2) : null;
  return { own: o, others: rest, median, beats: o != null && median != null ? o > median : null };
}
