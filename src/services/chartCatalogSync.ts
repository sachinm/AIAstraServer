/**
 * S-1 (docs/reading-engine/22 §7): keep `chart_data_types` in step with what Radha serves.
 *
 * Radha's `catalog` export lists the types it can answer and their `calc_version`. For every built-in type in
 * `reading/chartData/catalog.ts` (matched by `radhaType`):
 *   - listed by Radha  -> `served = true` and `calc_version` from Radha (row created if missing);
 *   - not listed       -> `served = false` (row created if missing; `calc_version` left as stored).
 * Rows are never deleted, and only rows that actually change are written, so a second run is a no-op.
 * Nothing here computes astrology: Radha stays the only source.
 *
 * Triggers: `npm run chart-catalog:sync` (scripts/sync-chart-catalog.ts), or once at server start when
 * CHART_CATALOG_SYNC_ON_START=1 (non-blocking). There is no EventBridge schedule in this repo.
 */
import type { PrismaClient } from '@prisma/client';
import { fetchRadhaCatalog, type RadhaCatalog } from '../lib/astroKundliClient.js';
import { BUILTIN_CHART_TYPES, type ChartDataType, type ChartTypeRow } from '../reading/chartData/catalog.js';
import { clearChartDataCaches } from '../reading/chartData/store.js';

/** Storage seam: Prisma in production, an in-memory fake in tests. */
export interface ChartCatalogRepo {
  loadTypes(): Promise<ChartTypeRow[]>;
  /** Insert the row, or update `served` and `calc_version` when it already exists. */
  upsertType(row: ChartTypeRow): Promise<void>;
}

export interface CatalogSyncDeps {
  repo: ChartCatalogRepo;
  /** Defaults to Radha's `catalog` export through the throttled client */
  fetchCatalog?: () => Promise<RadhaCatalog>;
}

export interface CatalogSyncResult {
  engineCommit: string;
  served: string[];
  unserved: string[];
  /** Radha lists these types but this build has no built-in entry for them (ignored) */
  unknownRadhaTypes: string[];
  inserted: number;
  updated: number;
}

function toRow(t: ChartDataType, served: boolean, calcVersion: string | null): ChartTypeRow {
  return {
    id: t.id,
    family: t.family,
    radha_type: t.radhaType,
    change_class: t.changeClass,
    tier: t.tier,
    variant_kind: t.variantKind,
    served,
    calc_version: calcVersion,
    legacy_column: t.legacyColumn ?? null,
    sort_order: t.sortOrder,
    label: t.label,
    enabled: true,
  };
}

export async function syncChartCatalog(deps: CatalogSyncDeps): Promise<CatalogSyncResult> {
  const catalog = await (deps.fetchCatalog ?? fetchRadhaCatalog)();
  const listed = new Map<string, { calc_version: string | null }>();
  for (const t of catalog.types ?? []) {
    if (!t || typeof t.type !== 'string' || !t.type) continue;
    if (!listed.has(t.type)) listed.set(t.type, { calc_version: t.calc_version ? String(t.calc_version) : null });
  }
  // An empty list would unserve every type; treat it as a bad response instead.
  if (listed.size === 0) throw new Error('Radha catalog lists no types; refusing to mark every chart type unserved');

  const existing = new Map((await deps.repo.loadTypes()).map((r) => [r.id, r]));
  const builtinRadhaTypes = new Set(BUILTIN_CHART_TYPES.map((t) => t.radhaType));

  const served: string[] = [];
  const unserved: string[] = [];
  let inserted = 0;
  let updated = 0;

  for (const t of BUILTIN_CHART_TYPES) {
    const radha = listed.get(t.radhaType);
    const row = existing.get(t.id);
    const wantServed = Boolean(radha);
    // Radha's calc_version when it lists the type; otherwise keep what is stored (or the built-in floor)
    const wantCalc = radha ? radha.calc_version : row ? row.calc_version : null;

    (wantServed ? served : unserved).push(t.id);

    if (!row) {
      await deps.repo.upsertType(toRow(t, wantServed, wantCalc));
      inserted++;
    } else if (row.served !== wantServed || (radha && row.calc_version !== wantCalc)) {
      await deps.repo.upsertType({ ...row, served: wantServed, calc_version: wantCalc });
      updated++;
    }
  }

  clearChartDataCaches();
  return {
    engineCommit: catalog.engine_commit,
    served,
    unserved,
    unknownRadhaTypes: [...listed.keys()].filter((k) => !builtinRadhaTypes.has(k)),
    inserted,
    updated,
  };
}

/** Prisma implementation of the catalog repository. */
export function prismaChartCatalogRepo(prisma: PrismaClient): ChartCatalogRepo {
  return {
    async loadTypes() {
      return (await prisma.chartDataType.findMany()) as unknown as ChartTypeRow[];
    },
    async upsertType(row) {
      await prisma.chartDataType.upsert({
        where: { id: row.id },
        create: row,
        update: { served: row.served, calc_version: row.calc_version },
      });
    },
  };
}

/**
 * Server start hook: runs one sync in the background when CHART_CATALOG_SYNC_ON_START=1.
 * Never throws and never blocks startup; failures are logged.
 */
export function scheduleChartCatalogSyncOnStart(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Console, 'log' | 'warn'> = console
): void {
  if (env.CHART_CATALOG_SYNC_ON_START !== '1') return;
  void syncChartCatalog({ repo: prismaChartCatalogRepo(prisma) })
    .then((r) => {
      log.log(
        `chart catalog sync: engine_commit=${r.engineCommit || 'unknown'} served=${r.served.length} unserved=${r.unserved.length} inserted=${r.inserted} updated=${r.updated}`
      );
    })
    .catch((err: unknown) => {
      log.warn(`chart catalog sync failed (startup continues): ${(err as Error)?.message ?? String(err)}`.slice(0, 500));
    });
}
