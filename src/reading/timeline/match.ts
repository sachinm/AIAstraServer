/**
 * Match the ledger against the blind past grid (docs/reading-engine/27 §A.7 step 3). An event is a **hit** when a
 * Moderate or High window of its marker (either polarity) lies within ±1 month of it at the monthly grain, a
 * **near**-miss within ±3 months, else a **miss**. Events outside the grid or with a category no marker takes are
 * reported, not scored. Specifics (colour, direction, field …) are scored in P3.
 *
 * The random monthly baseline: a predictor that flags the same number of months for the marker, uniformly at random,
 * hits an event with probability 1 - C(N-k, f) / C(N, f) (N months in the grid, f flagged, k months in the event's
 * hit zone). The expected baseline hit rate is the mean of that over the scored events.
 */
import type { TimelineConfig } from './config.js';
import { flaggedMonths, type TimelineGrid, type TimelineWindow } from './converge.js';
import { eventMonths, type LifeEvent } from './ledger.js';
import { markerForCategory, type MarkerId } from './markers.js';
import { monthFromIndex, monthIndex } from './months.js';

export type MatchResult = 'hit' | 'near' | 'miss' | 'out_of_range' | 'unmapped';

export interface EventMatch {
  event: LifeEvent;
  marker: MarkerId | null;
  result: MatchResult;
  /** months from the event to the nearest flagged month (0 = inside) */
  distance: number | null;
  window: TimelineWindow | null;
  /** probability that the random monthly baseline hits this event */
  baseline: number | null;
}

export interface MatchSummary {
  scored: number;
  hits: number;
  near: number;
  misses: number;
  hitRate: number | null;
  baselineHitRate: number | null;
}

/** P(at least one of f random months out of n falls in a zone of k months) */
export function randomHitProbability(n: number, f: number, k: number): number {
  if (n <= 0 || f <= 0 || k <= 0) return 0;
  if (f + k > n) return 1;
  let miss = 1;
  for (let i = 0; i < k; i++) miss *= (n - f - i) / (n - i);
  return 1 - miss;
}

/** Grid months within `tol` of any of the event's months */
export function hitZone(gridMonths: readonly string[], months: readonly string[], tol: number): Set<string> {
  const grid = new Set(gridMonths);
  const zone = new Set<string>();
  for (const m of months) {
    const i = monthIndex(m);
    for (let d = -tol; d <= tol; d++) {
      const z = monthFromIndex(i + d);
      if (grid.has(z)) zone.add(z);
    }
  }
  return zone;
}

/** Smallest distance in months from the event's months to a month of the set; null when the set is empty */
export function distanceTo(set: ReadonlySet<string>, months: readonly string[]): number | null {
  let best: number | null = null;
  for (const f of set) {
    const fi = monthIndex(f);
    for (const m of months) {
      const d = Math.abs(fi - monthIndex(m));
      if (best == null || d < best) best = d;
    }
  }
  return best;
}

export function inGrid(grid: TimelineGrid, months: readonly string[]): boolean {
  const first = grid.months[0];
  const last = grid.months.at(-1);
  return !!first && !!last && months.some((m) => m >= first && m <= last);
}

export function matchLedger(grid: TimelineGrid, events: readonly LifeEvent[], config: TimelineConfig): { matches: EventMatch[]; summary: MatchSummary } {
  const tol = config.matchTolerance;
  const flagged = new Map<MarkerId, Set<string>>();
  const matches: EventMatch[] = events.map((event) => {
    const marker = markerForCategory(event.category);
    const months = eventMonths(event);
    if (!marker) return { event, marker, result: 'unmapped', distance: null, window: null, baseline: null };
    if (!inGrid(grid, months)) return { event, marker, result: 'out_of_range', distance: null, window: null, baseline: null };
    if (!flagged.has(marker)) flagged.set(marker, flaggedMonths(grid, marker));
    const set = flagged.get(marker)!;
    const distance = distanceTo(set, months);
    const result: MatchResult = distance != null && distance <= tol.hit ? 'hit' : distance != null && distance <= tol.near ? 'near' : 'miss';
    let window: TimelineWindow | null = null;
    if (distance != null && result !== 'miss') {
      const near = [...set].find((f) => months.some((m) => Math.abs(monthIndex(f) - monthIndex(m)) === distance));
      window = grid.windows.find((w) => w.marker === marker && w.band !== 'possible' && near != null && w.fromMonth <= near && near <= w.toMonth) ?? null;
    }
    const baseline = randomHitProbability(grid.months.length, set.size, hitZone(grid.months, months, tol.hit).size);
    return { event, marker, result, distance, window, baseline };
  });
  const scored = matches.filter((m) => m.result === 'hit' || m.result === 'near' || m.result === 'miss');
  const hits = scored.filter((m) => m.result === 'hit').length;
  const summary: MatchSummary = {
    scored: scored.length,
    hits,
    near: scored.filter((m) => m.result === 'near').length,
    misses: scored.filter((m) => m.result === 'miss').length,
    hitRate: scored.length ? hits / scored.length : null,
    baselineHitRate: scored.length ? scored.reduce((s, m) => s + (m.baseline ?? 0), 0) / scored.length : null,
  };
  return { matches, summary };
}
