/**
 * The depth replay (AGENTS.md "Reading depth is a release gate", rule 5; docs/techniques/09 §5): reads stored card
 * readings (`technique_outputs`, technique `self.card.reading`) READ-ONLY and prints, per card, the technical and plain
 * story words, the charts and dasha systems cited by key, old or new schema, and the depth floor's verdict. No model
 * call, no write, no registry seed: only `findMany`. Counts and ids only; no reading text is printed.
 *
 *   npx tsx scripts/depth-replay.ts [--kundli <id>] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--take 400] [--all]
 *
 * By default the newest row per (kundli, card) is measured; `--all` measures every row read. Old against new: run it
 * once with `--until <release day>` and once with `--since <release day>` and set the two tables side by side.
 */
import 'dotenv/config';
import { depthRowOf, depthSummary, depthTable, type StoredCardLike } from '../src/reading/cards/depthReplay.js';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
};
const kundli = arg('kundli');
const since = arg('since');
const until = arg('until');
const take = Math.min(2000, Math.max(1, Number(arg('take') ?? 400) || 400));
const all = process.argv.includes('--all');

const { prisma } = await import('../src/lib/prisma.js');
try {
  const rows = (await (prisma as unknown as { techniqueOutput: { findMany: (q: unknown) => Promise<Array<{ kundli_id: string; output: unknown; created_at: Date; digest_version: string | null }>> } }).techniqueOutput.findMany({
    where: {
      technique_id: 'self.card.reading',
      ...(kundli ? { kundli_id: kundli } : {}),
      ...(since || until ? { created_at: { ...(since ? { gte: new Date(`${since}T00:00:00Z`) } : {}), ...(until ? { lt: new Date(`${until}T00:00:00Z`) } : {}) } } : {}),
    },
    orderBy: { created_at: 'desc' },
    take,
    select: { kundli_id: true, output: true, created_at: true, digest_version: true },
  })) ?? [];
  const seen = new Set<string>();
  const out: Array<ReturnType<typeof depthRowOf> & { kundli: string; madeAt: string }> = [];
  for (const r of rows) {
    const s = r.output as StoredCardLike | null;
    if (!s?.card) continue;
    const id = `${r.kundli_id}|${s.card}`;
    if (!all && seen.has(id)) continue;
    seen.add(id);
    out.push({ ...depthRowOf(s), kundli: r.kundli_id.slice(0, 8), madeAt: r.created_at.toISOString().slice(0, 10) });
  }
  out.sort((a, b) => a.kundli.localeCompare(b.kundli) || a.card.localeCompare(b.card));
  const sum = depthSummary(out);
  console.log(`# depth replay: ${out.length} cards from ${rows.length} rows read${kundli ? ` (kundli ${kundli.slice(0, 8)})` : ''}${since ? ` since ${since}` : ''}${until ? ` until ${until}` : ''}`);
  console.log('');
  console.log(depthTable(out));
  console.log('');
  console.log(`floor: ${sum.pass} of ${sum.cards} pass · median technical ${sum.medianTechnical} words (max ${sum.maxTechnical}) · median plain ${sum.medianPlain} · year chart cited on ${sum.withYear} · D9 on ${sum.withD9} · two or more systems on ${sum.twoSystems}`);
} finally {
  await (prisma as unknown as { $disconnect: () => Promise<void> }).$disconnect();
}
