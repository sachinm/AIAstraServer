/**
 * Dasha levels backfill (docs/reading-engine/67 step 4): re-pull every served dasha type to three levels, lifelong, for
 * every kundli, and replace each kundli's lifelong activation rows (levels 1–3) in one transaction. Never pulls levels
 * 4–6 (the dasha-deep worker does, for a kundli in focus).
 *
 *   npx tsx scripts/backfill-dasha-levels.ts [--kundli <id>] [--limit N] [--dry-run=false] [--probe <kundliId>]
 *                                            [--progress <file>] [--concurrency 1|2]
 *
 * --dry-run is true unless `--dry-run=false` is given: it lists the kundlis, the types and the rows per level now.
 * A wet run first asks the engine's catalogue for `max_level` above 3 (the levels 1–6 engine is deployed) and pulls
 * `dasha.yogini` to three levels for the probe kundli (default: the first in the list); it refuses to run otherwise.
 * Progress: one JSON line per finished kundli in --progress (default logs/backfill-dasha-levels.progress.jsonl); a rerun
 * skips those. Needs DATABASE_URL (+ the PII key config) and the engine transport env, like the API.
 */
import 'dotenv/config';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { prisma } from '../src/lib/prisma.js';
import { fetchEngineExport, fetchRadhaCatalog } from '../src/lib/astroKundliClient.js';
import { loadMergedChartTypes, prismaChartDataRepo, type RadhaFetcher } from '../src/reading/chartData/store.js';
import { buildActivationRows } from '../src/reading/digest/activation.js';
import { activationCountsByLevel, replaceActivationBand } from '../src/reading/digest/activationWrite.js';
import { buildDigestRows, loadDigestInputs } from '../src/reading/digest/build.js';
import { probeEngine, runLevelsBackfill } from '../src/reading/digest/levelsBackfill.js';

function arg(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const dryRun = arg('dry-run') !== 'false';
  const kundliId = arg('kundli');
  const limit = Number(arg('limit') ?? 0) || undefined;
  const progressFile = arg('progress') ?? 'logs/backfill-dasha-levels.progress.jsonl';
  const concurrency = Math.min(2, Math.max(1, Number(arg('concurrency') ?? 2) || 2));
  const repo = prismaChartDataRepo(prisma);
  const types = await loadMergedChartTypes(repo);
  const fetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, { ...(req.coords ?? {}), ...extra });
  const listKundlis = async (q: { kundliId?: string; limit?: number }) =>
    (await prisma.kundli.findMany({ where: q.kundliId ? { id: q.kundliId } : {}, orderBy: { created_at: 'asc' }, ...(q.limit ? { take: q.limit } : {}), select: { id: true } })).map((k) => k.id);
  let probeId = arg('probe');

  const result = await runLevelsBackfill(
    {
      listKundlis,
      repo,
      types,
      fetcher,
      concurrency,
      buildRows: async (id) => {
        const { items, calcVersions } = await loadDigestInputs(prisma, id);
        return buildActivationRows(items, buildDigestRows(items, { kundliId: id, calcVersions }), { today: new Date().toISOString().slice(0, 10) });
      },
      writeBand: (id, rows, band) => replaceActivationBand(prisma, id, rows, band),
      counts: (id) => activationCountsByLevel(prisma, id),
      probe: async () => {
        probeId ??= (await listKundlis({ ...(kundliId ? { kundliId } : {}), limit: 1 }))[0];
        if (!probeId) return { ok: false, deepEngine: false, depth: null, reason: 'no kundli to probe' };
        return probeEngine({ fetchCatalog: fetchRadhaCatalog, fetcher, repo, types }, probeId);
      },
      progress: {
        done: async () => {
          const text = await readFile(progressFile, 'utf8').catch(() => '');
          return new Set(text.split('\n').filter(Boolean).map((l) => { try { return String(JSON.parse(l).kundliId); } catch { return ''; } }).filter(Boolean));
        },
        mark: async (id, line) => {
          await mkdir(dirname(progressFile), { recursive: true });
          await appendFile(progressFile, `${JSON.stringify({ kundliId: id, at: new Date().toISOString(), ...line })}\n`);
        },
      },
      log: (l) => console.log(l),
    },
    { dryRun, ...(kundliId ? { kundliId } : {}), ...(limit ? { limit } : {}), ...(probeId ? { probeKundliId: probeId } : {}) },
  );
  const tally = result.rows.reduce<Record<string, number>>((t, r) => ({ ...t, [r.status]: (t[r.status] ?? 0) + 1 }), {});
  console.log(`done${result.refused ? ' (refused)' : ''}`, JSON.stringify(tally));
  await prisma.$disconnect();
  if (result.refused) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
