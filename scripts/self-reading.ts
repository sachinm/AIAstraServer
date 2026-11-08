/**
 * Runs the You reading for one kundli and prints, per panel technique, its time, cache state, claims and gaps
 * (docs/reading-engine/58 §8 step 8). Read-only apart from what the reading itself stores (technique_outputs,
 * agent_runs). Usage:
 *   npx tsx scripts/self-reading.ts --kundli <id> [--json] [--times 2] [--set-clock <system>] [--rebuild-digest]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getSelfReading } from '../src/reading/self/service.js';
import { buildDigest } from '../src/reading/digest/build.js';

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const kundliId = arg('--kundli');
  if (!kundliId) throw new Error('--kundli <id> required');
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try {
    const k = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { user_id: true, preferred_dasha: true } });
    if (!k) throw new Error('kundli not found');
    if (process.argv.includes('--rebuild-digest')) {
      const r = await buildDigest(prisma, kundliId, { fetch: false });
      console.log(`digest rebuilt: ${r.status}, ${r.rows} rows, ${r.ms} ms`);
    }
    const setClock = arg('--set-clock');
    if (setClock) {
      await prisma.kundli.update({ where: { id: kundliId }, data: { preferred_dasha: setClock === 'none' ? null : setClock } });
      console.log(`preferred_dasha = ${setClock}`);
    }
    const times = Number(arg('--times') ?? 1);
    for (let i = 0; i < times; i++) {
      const t0 = performance.now();
      const r = await getSelfReading({ prisma }, k.user_id);
      const total = Math.round(performance.now() - t0);
      if (r.status !== 'ok') { console.log(r.status); return; }
      if (process.argv.includes('--json')) { console.log(JSON.stringify(r.reading, null, 1)); continue; }
      console.log(`\n=== run ${i + 1}: ${total} ms total, all cached: ${r.cached}; clock ${r.reading.clock.label} (${r.reading.clock.reason}); confirming ${r.reading.clock.confirming.map((c) => c.label).join(', ')}`);
      for (const p of r.reading.panels) console.log(`${p.technique.padEnd(24)} ${p.status.padEnd(8)} ${p.cached ? 'cached' : `made ${p.ms} ms`}  claims ${p.claims.length}`);
      if (i === 0) {
        for (const p of r.reading.panels) {
          console.log(`\n## ${p.title} (${p.technique})\n${p.lead}`);
          for (const c of p.claims) console.log(`- [${c.certainty}] ${c.text}\n    details: ${c.detail}\n    evidence: ${c.evidence.join(', ')}`);
          for (const ch of p.chapters ?? []) console.log(`  chapter ${ch.kind} ${ch.lordLabel} ${ch.from}→${ch.to} ${ch.certainty}: ${ch.confirmations.map((x) => `${x.label}${x.agrees ? '✓' : '✗'}(${x.boundary})`).join(' ')}`);
        }
        console.log(`\nQuestion: ${r.reading.question?.text ?? '—'} (${r.reading.question?.claimId ?? ''})`);
        console.log(`Gaps: ${r.reading.gaps.join(' | ') || 'none'}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
