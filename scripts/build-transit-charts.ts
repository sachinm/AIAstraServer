/**
 * Pre-build today's per-kundli transit charts (24 months from today) so the first chat of the day is not the one that pays
 * for the engine call. Also the entry point for a daily scheduled job (EventBridge → worker) once the engine serves
 * `type=transits`. The API builds lazily on a miss as well.
 *
 *   npx tsx scripts/build-transit-charts.ts [--user <userId>] [--limit N] [--dry-run]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { loadReadingData } from '../src/reading/data/store.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const asOf = new Date().toISOString().slice(0, 10);
  const user = arg('user');
  const limit = Number(arg('limit') ?? 0) || undefined;
  const dry = process.argv.includes('--dry-run');
  const rows = await prisma.kundliFacts.findMany({
    where: user ? { kundli: { user_id: user } } : {},
    take: limit,
    select: { kundli: { select: { user_id: true } } },
  });
  console.log(`kundlis with facts: ${rows.length}`);
  const tally: Record<string, number> = {};
  for (const r of rows) {
    if (dry) continue;
    const data = await loadReadingData(prisma, r.kundli.user_id, { asOf, buildTransitsOnMiss: true });
    const state = data?.timings.transitsCache ?? 'none';
    tally[state] = (tally[state] ?? 0) + 1;
  }
  console.log('done', asOf, JSON.stringify(tally));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
