/**
 * Backfill the chart-facts dossier for existing kundlis. Serial, one engine invoke per user; coordinates returned by the
 * engine are stored on the kundli so nothing geocodes again.
 *
 *   npx tsx scripts/build-facts-for-all.ts [--user <userId>] [--limit N] [--force] [--dry-run]
 *
 * Needs DATABASE_URL and the engine transport env (ASTROKUNDLI_TRANSPORT=lambda + AWS credentials, or http + base URL).
 * The engine must serve `type=facts`; until it does every row ends as `failed (unsupported)` and nothing else changes.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildFactsForKundli } from '../src/reading/data/factsBuilder.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const force = process.argv.includes('--force');
  const dry = process.argv.includes('--dry-run');
  const limit = Number(arg('limit') ?? 0) || undefined;
  const user = arg('user');
  const kundlis = await prisma.kundli.findMany({
    where: { ...(user ? { user_id: user } : {}), queue_status: 'completed' },
    orderBy: { created_at: 'asc' },
    take: limit,
    select: { id: true, user_id: true, facts_status: true },
  });
  console.log(`kundlis to process: ${kundlis.length}${dry ? ' (dry run)' : ''}`);
  const tally: Record<string, number> = {};
  for (const k of kundlis) {
    if (dry) {
      console.log(`would build kundli ${k.id.slice(0, 8)} (status ${k.facts_status})`);
      continue;
    }
    const r = await buildFactsForKundli(prisma, k.id, { force });
    tally[r.status] = (tally[r.status] ?? 0) + 1;
    console.log(`${k.id.slice(0, 8)} ${r.status}${'ms' in r ? ` ${r.ms}ms` : ''}${'reason' in r ? ` ${r.reason}` : ''}`);
    if (r.status === 'failed' && r.unsupported) {
      console.log('engine does not serve type=facts yet; stopping early');
      break;
    }
  }
  console.log('done', JSON.stringify(tally));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
