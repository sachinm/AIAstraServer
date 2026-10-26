/**
 * The registration fetch set (docs/reading-engine/22 §7, server task S-5): everything the kundli queue asks Radha for
 * when a person signs up, in `sort_order`, through `ensureChartData` (so each item is stored once and shared with the
 * agents). The set is the `first` and `registration` tiers of the merged catalog, served types only: a type Radha does
 * not serve yet is never requested. Year-variant (annual) types never belong here; they need a year and are on demand.
 * Nothing here computes astrology.
 */
import { typesForTier, type ChartDataType } from './catalog.js';
import { ensureChartData, loadMergedChartTypes, type ChartItem, type EnsureDeps, type EnsureOptions } from './store.js';

export interface RegistrationSet {
  /** First tier then registration tier, each by sort_order; served natal types only */
  requested: ChartDataType[];
  /** Registration-set types the catalog lists as not served: skipped, never requested */
  skipped: ChartDataType[];
}

export function registrationSet(types: readonly ChartDataType[]): RegistrationSet {
  const all = typesForTier(types, 'registration').filter((t) => t.variantKind === 'natal');
  return { requested: all.filter((t) => t.served), skipped: all.filter((t) => !t.served) };
}

export interface RegistrationFetch extends RegistrationSet {
  items: Record<string, ChartItem>;
  /** Served first-tier types (chat can open when all are ready) */
  firstTier: ChartDataType[];
  /** True when every served first-tier type is `ready` (vacuously true when there are none) */
  firstTierReady: boolean;
}

/** Fetch (or read) the registration set for a kundli. `opts.concurrency` bounds Radha calls in flight (queue: 1). */
export async function fetchRegistrationSet(deps: EnsureDeps, kundliId: string, opts: EnsureOptions = {}): Promise<RegistrationFetch> {
  const types = await loadMergedChartTypes(deps.repo, opts.now?.() ?? Date.now());
  const set = registrationSet(types);
  const items = set.requested.length ? await ensureChartData(deps, kundliId, set.requested.map((t) => t.id), opts) : {};
  const firstTier = set.requested.filter((t) => t.tier === 'first');
  return { ...set, items, firstTier, firstTierReady: firstTier.every((t) => items[t.id]?.status === 'ready') };
}
