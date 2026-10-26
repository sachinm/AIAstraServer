/**
 * The registration fetch set (docs/reading-engine/22 §7 S-5, 23 §4): at sign-up (and on every later login) the kundli
 * queue pulls EVERYTHING Radha serves about the person into `kundli_data`, through `ensureChartData` (natal) and
 * `ensureAnnualCurrent` (annual, the year that applies today), so each item is stored once and shared with the agents.
 *
 * - The set is every type of the merged catalog that is `served` and of change class `natal` or `annual`. `moving`
 *   types (transit) are never in it: they depend on the moment asked for and are fetched on demand, unstored.
 * - Order: `first` tier, then `registration`, then everything else, each by `sort_order`.
 * - The gate is the leading part of that list up to the last item the completion rule needs (served first-tier types and
 *   the types behind the ten legacy `kundlis` columns). The queue opens chat after the gate and pulls the rest after it.
 * - Items already `ready` (and not stale) are read, not fetched, so a later run resumes where an earlier one stopped.
 * Nothing here computes astrology.
 */
import type { ChartDataType, FetchTier } from './catalog.js';
import { ensureAnnualCurrent, ensureChartData, loadMergedChartTypes, type ChartItem, type EnsureDeps, type EnsureOptions } from './store.js';

const TIER_RANK: Record<FetchTier, number> = { first: 0, registration: 1, on_demand: 2 };

/** Types stored per person: natal (one row) and annual (one row per year). Never `moving`. */
export function isStoredPerPerson(t: ChartDataType): boolean {
  return (t.changeClass === 'natal' && t.variantKind === 'natal') || (t.changeClass === 'annual' && t.variantKind === 'year');
}

export interface RegistrationSet {
  /** Served natal and annual types: first tier, then registration, then the rest, each by sort_order */
  requested: ChartDataType[];
  /** Natal and annual types the catalog lists as not served: skipped, never requested */
  skipped: ChartDataType[];
}

export function registrationSet(types: readonly ChartDataType[]): RegistrationSet {
  const all = types.filter(isStoredPerPerson).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.sortOrder - b.sortOrder);
  return { requested: all.filter((t) => t.served), skipped: all.filter((t) => !t.served) };
}

export interface RegistrationPlan extends RegistrationSet {
  /** Leading part of `requested` up to the last type the completion rule needs */
  gate: ChartDataType[];
  /** Everything after the gate, same order */
  rest: ChartDataType[];
  /** Served first-tier types (chat can open when all are ready) */
  firstTier: ChartDataType[];
}

export function registrationPlan(types: readonly ChartDataType[]): RegistrationPlan {
  const set = registrationSet(types);
  const needed = (t: ChartDataType) => t.tier === 'first' || Boolean(t.legacyColumn);
  let last = -1;
  set.requested.forEach((t, i) => {
    if (needed(t)) last = i;
  });
  return {
    ...set,
    gate: set.requested.slice(0, last + 1),
    rest: set.requested.slice(last + 1),
    firstTier: set.requested.filter((t) => t.tier === 'first'),
  };
}

export async function loadRegistrationPlan(deps: EnsureDeps, now: number = Date.now()): Promise<RegistrationPlan> {
  return registrationPlan(await loadMergedChartTypes(deps.repo, now));
}

/** True when every served first-tier type is `ready` (vacuously true when there are none) */
export function firstTierReady(firstTier: readonly ChartDataType[], items: Record<string, ChartItem>): boolean {
  return firstTier.every((t) => items[t.id]?.status === 'ready');
}

/**
 * Fetch (or read) a list of types in the order given: consecutive natal types go to ensureChartData in one call,
 * consecutive annual types to ensureAnnualCurrent. Items are keyed by type id.
 */
export async function fetchRegistrationItems(deps: EnsureDeps, kundliId: string, types: readonly ChartDataType[], opts: EnsureOptions = {}): Promise<Record<string, ChartItem>> {
  const items: Record<string, ChartItem> = {};
  let i = 0;
  while (i < types.length) {
    const annual = types[i]!.changeClass === 'annual';
    const run: string[] = [];
    while (i < types.length && (types[i]!.changeClass === 'annual') === annual) run.push(types[i++]!.id);
    Object.assign(items, annual ? await ensureAnnualCurrent(deps, kundliId, run, opts) : await ensureChartData(deps, kundliId, run, opts));
  }
  return items;
}

export interface RegistrationFetch extends RegistrationPlan {
  items: Record<string, ChartItem>;
  /** True when every served first-tier type is `ready` */
  firstTierReady: boolean;
}

/**
 * Fetch (or read) the whole registration set for a kundli: the gate, then the rest. `opts.concurrency` bounds Radha
 * calls in flight (queue: 1). The queue itself runs the two parts separately so it can open chat between them.
 */
export async function fetchRegistrationSet(deps: EnsureDeps, kundliId: string, opts: EnsureOptions = {}): Promise<RegistrationFetch> {
  const plan = await loadRegistrationPlan(deps, opts.now?.() ?? Date.now());
  const items = { ...(await fetchRegistrationItems(deps, kundliId, plan.gate, opts)) };
  Object.assign(items, await fetchRegistrationItems(deps, kundliId, plan.rest, opts));
  return { ...plan, items, firstTierReady: firstTierReady(plan.firstTier, items) };
}
