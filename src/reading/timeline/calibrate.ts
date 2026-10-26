/**
 * Calibration per kundli (docs/reading-engine/27 §A.7 step 4, §B.5). For every system and marker:
 *
 * - the system's **windows** for the marker are the runs of consecutive months in which it activates the marker (any
 *   strength, either polarity);
 * - **precision** = windows that saw a ledger event of the marker (±1 month) / windows;
 * - **recall** = ledger events of the marker hit (±1 month) / events of the marker in the grid;
 * - **baseline recall** = what a random monthly predictor flagging as many months would hit (see match.ts);
 *   **lift** = recall / baseline recall.
 *
 * Only markers with at least one ledger event count (the ledger says nothing about the others). The next build's weight
 * is the default times (0.5 + precision), held to the floor 0.5x and ceiling 1.5x. A conditional system (S3) is dropped
 * (weight 0) when `dasha.applicable` does not list it AND its pooled lift does not beat the random baseline.
 */
import type { TimelineConfig, TimelineWeights } from './config.js';
import { runsIn, type TimelineGrid } from './converge.js';
import { eventMonths, type LifeEvent } from './ledger.js';
import { distanceTo, hitZone, inGrid, randomHitProbability } from './match.js';
import { MARKER_IDS, markerForCategory, type MarkerId } from './markers.js';
import { monthIndex } from './months.js';
import type { Activation, SystemId } from './types.js';

export interface CalibrationRow {
  system: SystemId | 'ALL';
  /** a marker, or '*' pooled over the markers that have ledger events */
  marker: MarkerId | '*';
  /** ledger events behind the row */
  n: number;
  windows: number;
  windowsWithEvent: number;
  precision: number | null;
  hits: number;
  recall: number | null;
  baselineRecall: number | null;
  lift: number | null;
  /** months flagged / grid months */
  coverage: number;
  multiplier: number;
  weight: number;
  dropped?: boolean;
}

export interface Calibration {
  rows: CalibrationRow[];
  weights: TimelineWeights;
}

/** Runs of consecutive months */
export function runsOf(months: readonly string[]): string[][] {
  const sorted = [...months].sort();
  const out: string[][] = [];
  for (const m of sorted) {
    const last = out.at(-1);
    if (last && monthIndex(m) === monthIndex(last.at(-1)!) + 1) last.push(m);
    else out.push([m]);
  }
  return out;
}

interface Tally {
  n: number;
  windows: number;
  withEvent: number;
  hits: number;
  baseline: number;
  flagged: number;
}

function tally(flagged: ReadonlySet<string>, events: ReadonlyArray<string[]>, grid: readonly string[], tol: number): Tally {
  const runs = runsOf([...flagged]);
  const withEvent = runs.filter((run) => events.some((months) => distanceTo(new Set(run), months)! <= tol)).length;
  let hits = 0;
  let baseline = 0;
  for (const months of events) {
    const d = distanceTo(flagged, months);
    if (d != null && d <= tol) hits++;
    baseline += randomHitProbability(grid.length, flagged.size, hitZone(grid, months, tol).size);
  }
  return { n: events.length, windows: runs.length, withEvent, hits, baseline, flagged: flagged.size };
}

function row(system: CalibrationRow['system'], marker: CalibrationRow['marker'], t: Tally, gridMonths: number, defaultWeight: number, config: TimelineConfig): CalibrationRow {
  const precision = t.windows ? t.withEvent / t.windows : null;
  const recall = t.n ? t.hits / t.n : null;
  const baselineRecall = t.n ? t.baseline / t.n : null;
  const multiplier = t.n && precision != null ? Math.min(config.calibration.ceiling, Math.max(config.calibration.floor, 0.5 + precision)) : 1;
  return {
    system,
    marker,
    n: t.n,
    windows: t.windows,
    windowsWithEvent: t.withEvent,
    precision,
    hits: t.hits,
    recall,
    baselineRecall,
    lift: recall != null && baselineRecall ? recall / baselineRecall : null,
    coverage: gridMonths ? t.flagged / gridMonths : 0,
    multiplier,
    weight: Math.round(defaultWeight * multiplier * 1000) / 1000,
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
  const defaults = config.weights.systems;
  const eventsBy = new Map<MarkerId, string[][]>();
  for (const e of input.events) {
    const m = markerForCategory(e.category);
    const months = eventMonths(e);
    if (!m || !inGrid(grid, months)) continue;
    eventsBy.set(m, [...(eventsBy.get(m) ?? []), months]);
  }
  const withEvents = MARKER_IDS.filter((m) => eventsBy.has(m));

  // months in which each system activates each marker
  const active = new Map<string, Set<string>>();
  for (const month of grid.months) {
    for (const a of activations) {
      if (a.strength <= 0 || !runsIn(a, month)) continue;
      const k = `${a.system}|${a.marker}`;
      if (!active.has(k)) active.set(k, new Set());
      active.get(k)!.add(month);
    }
  }

  const rows: CalibrationRow[] = [];
  const weights: TimelineWeights = { systems: { ...defaults }, byMarker: {} };
  const sum = (ts: Tally[]): Tally => ts.reduce((a, b) => ({ n: a.n + b.n, windows: a.windows + b.windows, withEvent: a.withEvent + b.withEvent, hits: a.hits + b.hits, baseline: a.baseline + b.baseline, flagged: a.flagged + b.flagged }), { n: 0, windows: 0, withEvent: 0, hits: 0, baseline: 0, flagged: 0 });

  for (const s of input.systems) {
    const tallies: Tally[] = [];
    for (const m of MARKER_IDS) {
      const t = tally(active.get(`${s}|${m}`) ?? new Set(), eventsBy.get(m) ?? [], grid.months, tol);
      const r = row(s, m, t, grid.months.length, defaults[s], config);
      rows.push(r);
      if (eventsBy.has(m)) {
        tallies.push(t);
        (weights.byMarker![m] ??= {})[s] = r.weight;
      }
    }
    const pooled = row(s, '*', sum(tallies), grid.months.length * Math.max(1, withEvents.length), defaults[s], config);
    if (s === 'S3' && !input.s3Applicable && !(pooled.lift != null && pooled.lift > 1)) {
      pooled.dropped = true;
      pooled.weight = 0;
      for (const m of withEvents) weights.byMarker![m]![s] = 0;
    }
    weights.systems[s] = pooled.weight;
    rows.push(pooled);
  }

  const ensemble: Tally[] = [];
  for (const m of MARKER_IDS) {
    const flagged = new Set(grid.cells[m].filter((c) => c.band === 'moderate' || c.band === 'high').map((c) => c.month));
    const t = tally(flagged, eventsBy.get(m) ?? [], grid.months, tol);
    rows.push(row('ALL', m, t, grid.months.length, 1, config));
    if (eventsBy.has(m)) ensemble.push(t);
  }
  rows.push(row('ALL', '*', sum(ensemble), grid.months.length * Math.max(1, withEvents.length), 1, config));
  return { rows, weights };
}
