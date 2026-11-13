/**
 * One-off: fill one kundli's annual set (Tithi Pravesha + Varsha in D1/D9/D10, year dasha, Mudda, Patyayini, sahams)
 * for every year in [from, to], only the missing rows, with a disk guard. Nothing here computes astrology.
 *
 *   npx tsx scripts/pull-sachin-annual.ts --kundli <id> --from 2006 --to 2036 [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { ensureChartData, prismaChartDataRepo } from '../src/reading/chartData/store.js';
import { ANNUAL_CHART_TYPES, ANNUAL_CHART_VARGAS, ANNUAL_YEAR_TYPES } from '../src/reading/digest/annualSet.js';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIMIT = Number(process.env.DB_DISK_LIMIT_BYTES ?? 5 * 1024 ** 3);
const MAX_FILL = Number(process.env.DB_DISK_MAX_FILL ?? 0.7);

async function dbSize(): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ s: bigint }[]>('select pg_database_size(current_database()) as s');
  return Number(r[0]!.s);
}

async function main(): Promise<void> {
  const kundli = arg('kundli')!, from = Number(arg('from')), to = Number(arg('to'));
  if (!kundli || !from || !to) throw new Error('--kundli --from --to required');
  const dry = process.argv.includes('--dry-run');
  const keys: string[] = [];
  for (let y = to; y >= from; y--) {
    for (const t of ANNUAL_CHART_TYPES) for (const f of ANNUAL_CHART_VARGAS) keys.push(f === 1 ? `${t}@${y}` : `${t}@${y};divisional_chart_factor=${f}`);
    for (const t of ANNUAL_YEAR_TYPES) keys.push(`${t}@${y}`);
  }
  const deps = { repo: prismaChartDataRepo(prisma) };
  const stored = await ensureChartData(deps, kundli, keys, { noFetch: true });
  const missing = keys.filter((k) => stored[k]?.status !== 'ready');
  const per = await prisma.$queryRawUnsafe<{ b: bigint; n: bigint }[]>(
    "select pg_total_relation_size('kundli_data') as b, (select count(*) from kundli_data) as n"
  );
  const bpr = Number(per[0]!.b) / Math.max(1, Number(per[0]!.n));
  const size = await dbSize();
  const est = missing.length * bpr;
  console.log(JSON.stringify({ wanted: keys.length, ready: keys.length - missing.length, missing: missing.length,
    dbMB: +(size / 1e6).toFixed(1), limitMB: +(LIMIT / 1e6).toFixed(0), fill: +(size / LIMIT).toFixed(3),
    bytesPerRow: Math.round(bpr), estAddMB: +(est / 1e6).toFixed(1), fillAfter: +((size + est) / LIMIT).toFixed(3) }));
  if (dry) return;
  if ((size + est) / LIMIT > MAX_FILL) throw new Error('disk guard: would pass max fill, stopping');
  let done = 0, failed = 0;
  for (let i = 0; i < missing.length; i += 10) {
    if ((await dbSize()) / LIMIT > MAX_FILL) throw new Error('disk guard tripped mid-run');
    const batch = missing.slice(i, i + 10);
    const got = await ensureChartData(deps, kundli, batch, { concurrency: 2 });
    for (const k of batch) { if (got[k]?.status === 'ready') done++; else { failed++; console.log('not ready', k, got[k]?.status, got[k]?.error ?? ''); } }
    console.log(`progress ${Math.min(i + 10, missing.length)}/${missing.length} ready=${done} failed=${failed}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
