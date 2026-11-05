/**
 * Pull the SHARED day tables for a place (docs/reading-engine/47): the engine's `muhurta` type, no person in it, one
 * row per date in `day_tables`, read by everyone at that place. Daylight saving is the engine's per date (`tz_name`).
 *
 *   npx tsx scripts/pull-day-tables.ts --place newyork|chicago|denver|sanjose|pune|all --from 2026-11-01 --to 2026-11-30 [--dry-run] [--json-dir evals/fixtures/day-tables]
 *
 * The engine caps `muhurta` at 92 days per call; the job asks one calendar month at a time. --dry-run reads the cache
 * and calls nothing. --json-dir also writes each month's raw answer to <dir>/<place>/<yyyy-mm>.json for review.
 * Nothing here computes astrology: the payload is stored as the engine returned it.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchEngineExportAtPlace } from '../src/lib/astroKundliClient.js';
import { placeKey } from '../src/reading/transits/ephemerisCache.js';
import { tzOffsetHours } from '../src/reading/chartData/place.js';

/** The first five places (doc 47 §3.5): four US zones and India. Keys are stable; the sky presets reuse sanjose and pune. */
export const DAY_TABLE_PLACES: Record<string, { name: string; lat: number; lon: number; tzName: string }> = {
  newyork: { name: 'New York, US', lat: 40.7128, lon: -74.006, tzName: 'America/New_York' },
  chicago: { name: 'Chicago, US', lat: 41.8781, lon: -87.6298, tzName: 'America/Chicago' },
  denver: { name: 'Denver, US', lat: 39.7392, lon: -104.9903, tzName: 'America/Denver' },
  sanjose: { name: 'San Jose, US', lat: 37.341, lon: -121.894, tzName: 'America/Los_Angeles' },
  pune: { name: 'Pune, IN', lat: 18.52, lon: 73.857, tzName: 'Asia/Kolkata' },
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** [from, to] split into calendar months (inclusive dates, UTC arithmetic on YYYY-MM-DD strings). */
function monthChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!(cur <= end)) throw new Error(`--from ${from} is after --to ${to}`);
  while (cur <= end) {
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const chunkEnd = monthEnd < end ? monthEnd : end;
    out.push({ from: isoDate(cur), to: isoDate(chunkEnd) });
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return out;
}

interface MuhurtaDay {
  date: string;
  utc_offset_hours?: number;
  [k: string]: unknown;
}
interface MuhurtaAnswer {
  type?: string;
  calc_version?: string;
  data?: { days?: MuhurtaDay[]; [k: string]: unknown };
  [k: string]: unknown;
}

async function pullPlace(key: string, from: string, to: string, opts: { dryRun: boolean; jsonDir?: string }): Promise<void> {
  const place = DAY_TABLE_PLACES[key];
  if (!place) throw new Error(`unknown place ${key}; known: ${Object.keys(DAY_TABLE_PLACES).join(', ')}`);
  const { prisma } = await import('../src/lib/prisma.js');
  // The engine takes `tz` as a fixed offset for the request and `params.tz_name` for the per-date offset; the key uses
  // the standard (January) offset so a place has one key all year.
  const standardTz = tzOffsetHours(place.tzName, new Date(Date.UTC(2026, 0, 15))) ?? 0;
  const pk = placeKey({ lat: place.lat, lon: place.lon, tz: standardTz });

  for (const chunk of monthChunks(from, to)) {
    const have = await prisma.dayTable.count({
      where: { place_key: pk, date: { gte: new Date(`${chunk.from}T00:00:00Z`), lte: new Date(`${chunk.to}T00:00:00Z`) } },
    });
    const want = (new Date(`${chunk.to}T00:00:00Z`).getTime() - new Date(`${chunk.from}T00:00:00Z`).getTime()) / 86_400_000 + 1;
    if (have >= want) {
      console.log(`${key} ${chunk.from}..${chunk.to}: cached (${have} rows)`);
      continue;
    }
    if (opts.dryRun) {
      console.log(`${key} ${chunk.from}..${chunk.to}: would call muhurta (${have}/${want} rows cached)`);
      continue;
    }
    const started = Date.now();
    const raw = (await fetchEngineExportAtPlace('muhurta', {
      lat: place.lat,
      lon: place.lon,
      tz: standardTz,
      params: { from: chunk.from, to: chunk.to, tz_name: place.tzName },
    })) as MuhurtaAnswer;
    const days = raw?.data?.days ?? (raw as { days?: MuhurtaDay[] }).days ?? [];
    if (!Array.isArray(days) || days.length === 0) throw new Error(`${key} ${chunk.from}: engine returned no days`);
    const calcVersion = typeof raw.calc_version === 'string' ? raw.calc_version : null;
    const engineCommit = typeof (raw as { engine_commit?: unknown }).engine_commit === 'string' ? (raw as { engine_commit: string }).engine_commit : null;

    if (opts.jsonDir) {
      const dir = path.join(opts.jsonDir, key);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${chunk.from.slice(0, 7)}.json`), JSON.stringify(raw, null, 2));
    }

    let written = 0;
    for (const day of days) {
      if (typeof day.date !== 'string') continue;
      const payload = JSON.parse(JSON.stringify(day)) as object;
      const sourceHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const offset = typeof day.utc_offset_hours === 'number' ? day.utc_offset_hours : (tzOffsetHours(place.tzName, new Date(`${day.date}T12:00:00Z`)) ?? standardTz);
      await prisma.dayTable.upsert({
        where: { place_key_date_ayanamsa: { place_key: pk, date: new Date(`${day.date}T00:00:00Z`), ayanamsa: 'LAHIRI' } },
        create: {
          place_key: pk,
          place_name: place.name,
          lat: place.lat,
          lon: place.lon,
          tz_name: place.tzName,
          date: new Date(`${day.date}T00:00:00Z`),
          utc_offset_hours: offset,
          ayanamsa: 'LAHIRI',
          calc_version: calcVersion,
          engine_commit: engineCommit,
          source_hash: sourceHash,
          payload,
        },
        update: { utc_offset_hours: offset, calc_version: calcVersion, engine_commit: engineCommit, source_hash: sourceHash, payload, fetched_at: new Date() },
      });
      written += 1;
    }
    console.log(`${key} ${chunk.from}..${chunk.to}: ${written} rows written in ${((Date.now() - started) / 1000).toFixed(1)} s (calc_version ${calcVersion ?? '?'})`);
  }
}

async function main(): Promise<void> {
  const placeArg = arg('place');
  const from = arg('from');
  const to = arg('to');
  if (!placeArg || !from || !to) throw new Error('--place, --from and --to are required');
  const keys = placeArg === 'all' ? Object.keys(DAY_TABLE_PLACES) : placeArg.split(',').map((s) => s.trim().toLowerCase());
  const opts = { dryRun: process.argv.includes('--dry-run'), jsonDir: arg('json-dir') };
  for (const key of keys) await pullPlace(key, from, to, opts);
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
