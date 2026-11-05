/**
 * Job 2 of 2 (docs/reading-engine/35): pull ONE kundli's own transit answer (houses from lagna and Moon, computed by the
 * engine) over whole calendar years and store it once per kundli and span. Run it for a new kundli, or when a span is
 * needed that is not stored. It is never run for every user.
 *
 *   npx tsx scripts/pull-kundli-overlay.ts --kundli <kundliId> --from 2026-01-01 --to 2028-12-31 [--step month|day] [--dry-run]
 */
import 'dotenv/config';
import { formatReport, pullKundliOverlay } from '../src/reading/transits/skyJobs.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const kundli = arg('kundli');
  const from = arg('from');
  const to = arg('to');
  if (!kundli || !from || !to) throw new Error('--kundli, --from and --to are required');
  const step = (arg('step') ?? 'month') as 'month' | 'day';
  if (step !== 'month' && step !== 'day') throw new Error("--step must be 'month' or 'day'");
  const report = await pullKundliOverlay(kundli, { from, to, step, dryRun: process.argv.includes('--dry-run') });
  console.log(formatReport(`overlay ${kundli.slice(0, 8)} ${step}`, report));
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();
  if (report.chunks.some((c) => c.state === 'failed')) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
