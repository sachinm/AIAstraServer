/**
 * Data for the doc 28 §5 layers, fetched for one reading (Radha through the shared, throttled client; nothing computed
 * here):
 *
 *   annual     the current-year `annual.tithi_pravesha` chart and `annual.tithi_pravesha_dasha` (system
 *              tithi_ashtottari), through ensureAnnualCurrent (stored once per year, shared with the registration pull)
 *   prashna    castPrashna at the confirmation moment, at the question place (client location) or else the birth place
 *   transitAt  fetchTransit at the asked date with D-1, D-9 and D-10 and the natal houses
 *
 * Each returns null when there is nothing to read: the type is not served yet (catalog), the item is missing or failed,
 * or Radha refused it. A null means the layer is skipped with reason `no_data`; it never fails the reading.
 */
import type { PrismaClient } from '@prisma/client';
import { castPrashna, prismaPrashnaRepo, type PrashnaRepo } from '../chartData/prashna.js';
import type { AtPlace } from '../chartData/place.js';
import { ensureAnnualCurrent, loadMergedChartTypes, prismaChartDataRepo, type ChartDataRepo, type RadhaFetcher } from '../chartData/store.js';
import { fetchTransit, type PlaceFetcher } from '../chartData/transit.js';

export const ANNUAL_CHART_TYPE = 'annual.tithi_pravesha';
export const ANNUAL_DASHA_TYPE = 'annual.tithi_pravesha_dasha';
/** The vargas the transit specialist reads at an asked date (doc 28 §5). */
export const TRANSIT_AT_FACTORS = [1, 9, 10] as const;

export interface AnnualData {
  chart: unknown;
  dasha: unknown;
}

export interface PrashnaData {
  payload: unknown;
  placeSource: 'current' | 'birth';
}

/** What the graph calls; each is optional (absent = the layer is not offered for this run). */
export interface LayerLoaders {
  annual?: () => Promise<AnnualData | null>;
  prashna?: (a: { at: string; place: AtPlace | null; runId?: string | null }) => Promise<PrashnaData | null>;
  transitAt?: (at: string) => Promise<unknown | null>;
}

export interface LayerLoaderDeps {
  userId: string;
  kundliId: string;
  chartRepo: ChartDataRepo;
  prashnaRepo?: PrashnaRepo;
  /** Radha calls with birth data (annual, transit at the birth place) */
  fetcher?: RadhaFetcher;
  /** Radha calls at a place with no birth data (prashna) */
  placeFetcher?: PlaceFetcher;
  now?: () => number;
}

const warn = (layer: string, err: unknown): void =>
  console.warn(JSON.stringify({ msg: 'reading layer data unavailable', layer, error: String((err as Error)?.message ?? err).slice(0, 200) }));

async function served(repo: ChartDataRepo, id: string): Promise<boolean> {
  const types = await loadMergedChartTypes(repo);
  return types.some((t) => t.id === id && t.served);
}

export function layerLoaders(deps: LayerLoaderDeps): LayerLoaders {
  const { chartRepo } = deps;
  return {
    async annual() {
      try {
        const items = await ensureAnnualCurrent({ repo: chartRepo, ...(deps.fetcher ? { fetcher: deps.fetcher } : {}) }, deps.kundliId, [ANNUAL_CHART_TYPE, ANNUAL_DASHA_TYPE], deps.now ? { now: deps.now } : {});
        const ready = (id: string) => (items[id]?.status === 'ready' ? items[id]!.payload ?? null : null);
        const chart = ready(ANNUAL_CHART_TYPE);
        const dasha = ready(ANNUAL_DASHA_TYPE);
        return chart || dasha ? { chart, dasha } : null;
      } catch (err) {
        warn('annual', err);
        return null;
      }
    },
    async prashna({ at, place, runId }) {
      try {
        if (!(await served(chartRepo, 'prashna'))) return null;
        const cast = await castPrashna({ userId: deps.userId, at, place, runId: runId ?? null }, { ...(deps.prashnaRepo ? { repo: deps.prashnaRepo } : {}), ...(deps.placeFetcher ? { fetcher: deps.placeFetcher } : {}), ...(deps.now ? { now: deps.now } : {}) });
        return { payload: cast.payload, placeSource: cast.placeSource };
      } catch (err) {
        warn('prashna', err);
        return null;
      }
    },
    async transitAt(at) {
      try {
        if (!(await served(chartRepo, 'transit'))) return null;
        return await fetchTransit(deps.kundliId, { at, divisionalChartFactors: [...TRANSIT_AT_FACTORS], withNatal: true }, { repo: chartRepo, ...(deps.fetcher ? { fetcher: deps.fetcher } : {}) });
      } catch (err) {
        warn('transit_at', err);
        return null;
      }
    },
  };
}

/** Production loaders for one reading. */
export function prismaLayerLoaders(prisma: PrismaClient, a: { userId: string; kundliId: string }): LayerLoaders {
  const chartRepo = prismaChartDataRepo(prisma);
  return layerLoaders({ ...a, chartRepo, prashnaRepo: prismaPrashnaRepo(prisma, chartRepo) });
}
