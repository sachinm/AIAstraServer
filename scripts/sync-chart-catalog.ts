/**
 * Sync `chart_data_types.served` and `calc_version` from Radha's `catalog` export (S-1, docs/reading-engine/22 §7).
 *
 *   npm run chart-catalog:sync
 *
 * Needs DATABASE_URL and the engine transport env (ASTROKUNDLI_TRANSPORT=lambda + AWS credentials, or http + base URL).
 * Safe to re-run: it only writes rows that change. Prints a one-line JSON summary. No EventBridge schedule lives here.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { prismaChartCatalogRepo, syncChartCatalog } from '../src/services/chartCatalogSync.js';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await syncChartCatalog({ repo: prismaChartCatalogRepo(prisma) });
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('chart-catalog:sync failed:', (err as Error)?.message ?? String(err));
  process.exit(1);
});
