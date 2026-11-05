/**
 * Job 1 of 2 (docs/reading-engine/35): extend the SHARED transit sky for a place. Whole calendar years, no person, stored
 * once and read by every user. Replaces the per-user `build-transit-charts.ts`.
 *
 *   npx tsx scripts/extend-transit-sky.ts --place sanjose|pune|<lat>,<lon>,<tz> --from 2026-01-01 --to 2028-12-31 [--step month|day] [--dry-run]
 *
 * --step day is limited by the engine to about 2 years per call; the job asks one calendar year at a time.
 * Always run --dry-run first: it reads the cache and calls nothing.
 */
import 'dotenv/config';
import type { AtPlace } from '../src/reading/chartData/place.js';
import { extendSharedSky, formatReport, type SkyStep } from '../src/reading/transits/skyJobs.js';

const PRESETS: Record<string, AtPlace> = {
  // fixed offsets: the engine takes hours from UTC, so a place with daylight saving needs one job per offset
  sanjose: { lat: 37.341, lon: -121.894, tz: -8 },
  pune: { lat: 18.52, lon: 73.857, tz: 5.5 },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function placeArg(v: string | undefined): AtPlace {
  if (!v) throw new Error('--place is required (sanjose, pune or lat,lon,tz)');
  const preset = PRESETS[v.toLowerCase()];
  if (preset) return preset;
  const [lat, lon, tz] = v.split(',').map(Number);
  if (![lat, lon, tz].every((n) => Number.isFinite(n))) throw new Error(`--place ${v}: expected a preset or lat,lon,tz`);
  return { lat: lat!, lon: lon!, tz: tz! };
}

async function main(): Promise<void> {
  const from = arg('from');
  const to = arg('to');
  if (!from || !to) throw new Error('--from and --to are required (YYYY-MM-DD)');
  const step = (arg('step') ?? 'month') as SkyStep;
  if (step !== 'month' && step !== 'day') throw new Error("--step must be 'month' or 'day'");
  const report = await extendSharedSky(placeArg(arg('place')), { from, to, step, dryRun: process.argv.includes('--dry-run') });
  console.log(formatReport(`shared sky ${arg('place')} ${step}`, report));
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();
  if (report.chunks.some((c) => c.state === 'failed')) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
