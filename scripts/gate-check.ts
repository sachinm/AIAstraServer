/**
 * Read-only check of the reading gate, first version (docs/techniques/11 rev 4 §4.8, step 2c: "before it ships, a
 * read-only check that none of the existing charts would be locked"). For every chart in the configured database it
 * prints: the chart id (first 8 characters only), the chart build status, the digest status, the newest reading-build
 * marker (board, status, age), whether the gate would lock it and why; and the one status the manifest computes from the
 * stored rows (stage, verdict, named gaps), which is NOT written (`kundli_pipeline` is not touched).
 *
 *   npx tsx scripts/gate-check.ts
 *
 * Writes nothing: Prisma reads only (no raw SQL), no engine call, no model call. Never prints a URL, a name or a value
 * the engine returned.
 */
import 'dotenv/config';

const { prisma } = await import('../src/lib/prisma.js');
const { readGateFacts, gateView } = await import('../src/reading/prep/gate.js');
const { loadPipelineInput, computePipeline } = await import('../src/reading/pipeline/status.js');
const { markerArea } = await import('../src/reading/self/buildEvent.js');

const now = new Date();
const areas = (['self', 'love', 'work'] as const).map(markerArea);

/** The newest `<board>.reading` marker of the chart, whatever its status, and how old it is. */
async function newestMarker(kundliId: string): Promise<string> {
  const rows = await prisma.areaBuild.findMany({ where: { kundli_id: kundliId, area: { in: areas } }, orderBy: { as_of: 'desc' }, take: 6, select: { area: true, status: true, result: true } });
  let best: { area: string; status: string; t: number } | null = null;
  for (const r of rows) {
    const s = (r.result as { started_at?: unknown } | null)?.started_at;
    const t = typeof s === 'string' ? Date.parse(s) : NaN;
    if (Number.isFinite(t) && (!best || t > best.t)) best = { area: r.area, status: r.status, t };
  }
  if (!best) return 'none';
  const mins = Math.round((now.getTime() - best.t) / 60_000);
  const age = mins < 120 ? `${mins} min` : mins < 2880 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} d`;
  return `${best.area.replace('.reading', '')} ${best.status} ${age} ago`;
}

const charts = await prisma.kundli.findMany({ select: { id: true }, orderBy: { created_at: 'asc' } });
console.log(`gate-check ${now.toISOString()} charts=${charts.length} (read-only)`);
let locked = 0;
for (const c of charts) {
  const id8 = c.id.slice(0, 8);
  try {
    const read = await readGateFacts(prisma, c.id, now);
    if (!read) {
      console.log(`${id8}  (gone)`);
      continue;
    }
    const view = gateView(read.facts, read.row);
    if (view.locked) locked += 1;
    const marker = await newestMarker(c.id);
    const loaded = await loadPipelineInput(prisma, c.id, now).catch(() => null);
    const s = loaded ? computePipeline(loaded.input, loaded.context) : null;
    console.log(
      [
        id8,
        `chart=${read.facts.chartStatus}`,
        `digest=${read.facts.digestStatus ?? 'null'}`,
        `marker=${marker}`,
        `gate=${view.locked ? `LOCKED (${view.reason})` : 'open'}`,
        s ? `stage=${s.stage} verdict=${s.verdict} chat=${s.verdicts.chat} pass1=${s.verdicts.pass1} done=${s.done}/${s.total}` : 'status=not computed',
      ].join('  '),
    );
    if (s?.gaps.length) for (const g of s.gaps) console.log(`          gap ${g.required ? 'REQUIRED ' : ''}${g.id} ${g.code}${g.givenUp ? ' (given up)' : ''}${g.detail ? `: ${g.detail}` : ''}`);
  } catch (e) {
    console.log(`${id8}  read failed: ${(e as Error).name}`);
  }
}
console.log(`locked=${locked} of ${charts.length}`);
await prisma.$disconnect();
