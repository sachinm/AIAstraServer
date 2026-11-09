/**
 * Phase A replay (docs/reading-engine/65 §7 step 2): build one person's You reading with the Oracle's area document
 * (SELF_ORACLE_AREAS=1) through the same path the background build uses, trigger 'manual', and write what came back to
 * a markdown report for Sachin to read. A paid model run: the family readers, the lineman and the Oracle (about $0.08
 * per kundli); run only with his yes.
 *
 *   npx tsx scripts/replay-self-areas.ts <userId> [board] [out.md]
 *
 * Env (set for the run): SELF_READING_MODEL=1 SELF_ORACLE_AREAS=1 READING_EXPLICIT_CACHE=1 and the usual DATABASE_URL /
 * GEMINI_API_KEY from .env. The stored output lands under the new prompt version's key, so the live server (older
 * bundle) never reads it.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { getBoardReading } from '../src/reading/self/service.js';
import type { ReadingBoardId } from '../src/reading/self/types.js';

async function main(): Promise<void> {
  const [userId, boardArg = 'self', outArg] = process.argv.slice(2);
  if (!userId) throw new Error('usage: replay-self-areas.ts <userId> [board] [out.md]');
  const board = boardArg as ReadingBoardId;
  for (const k of ['SELF_READING_MODEL', 'SELF_ORACLE_AREAS']) if (process.env[k] !== '1') throw new Error(`${k}=1 required`);
  const prisma = new PrismaClient();
  const t0 = Date.now();
  try {
    const r = await getBoardReading({ prisma }, userId, board, { trigger: 'manual', force: true });
    const ms = Date.now() - t0;
    if (r.status !== 'ok') {
      console.log(JSON.stringify({ status: r.status, ms }));
      return;
    }
    const o = r.reading.oracle;
    const lines: string[] = [];
    lines.push(`# Replay: ${board} areas for ${userId.slice(0, 8)}… as of ${r.reading.asOf}`, '');
    lines.push(`Wall ${Math.round(ms / 100) / 10} s · Oracle ${o?.status} · model ${o?.model ?? '—'} · prompt ${o?.promptName} ${o?.promptVersion ?? ''}`);
    lines.push(`Cost $${o?.costUsd ?? 0} · tokens ${JSON.stringify(o?.tokens ?? {})} · calls ${o?.calls ?? 0}`);
    if (o?.error) lines.push(`Error: ${o.error}`);
    lines.push('', '## Stages', '', '| stage | status | ms | prompt | cached | out | thinking | cost |', '|---|---|---|---|---|---|---|---|');
    for (const s of o?.stages ?? []) lines.push(`| ${s.agentId} | ${s.status ?? ''} | ${s.ms ?? ''} | ${s.promptTokens ?? ''} | ${s.cachedTokens} | ${s.outputTokens} | ${s.thoughtTokens ?? ''} | ${s.costUsd} |`);
    lines.push('', `Cache warm (cached tokens per stage): ${JSON.stringify(o?.cacheWarm ?? {})}`);
    if (o?.areaGaps?.length) lines.push('', '## Validator gaps', '', ...o.areaGaps.map((g) => `- ${g}`));
    lines.push('', '## Areas', '');
    for (const p of r.reading.panels) {
      const a = o?.areas?.areas[p.id];
      lines.push(`### ${p.title} (${p.id}) · panel ${p.status}${a ? '' : ' · no area returned'}`);
      if (a) {
        lines.push('', `**${a.headline}**`, '', ...a.paragraphs.flatMap((x) => [x, '']));
        if (a.dates.length) lines.push('Dates:', ...a.dates.map((d) => `- ${d.from} → ${d.to}: ${d.label}`), '');
        if (a.actions.length) lines.push('Do:', ...a.actions.map((x) => `- ${x.from} → ${x.to}: ${x.text}`), '');
        lines.push(`Certainty ${a.certainty} · valid until ${a.validUntil} · evidence ${a.evidence.join(', ')}`);
      }
      lines.push('', `Code lines (the floor): ${p.lines.filter((l) => !/\.ai\.\d+$/.test(l.id)).map((l) => l.text).join(' | ')}`, '');
    }
    lines.push(`Overall valid until ${o?.areas?.validUntil ?? '—'} · dossier ${r.reading.dossierId ?? '—'}`);
    const out = outArg ?? `docs/reading-engine/65-replay-${r.reading.asOf}-${board}-${userId.slice(0, 8)}.md`;
    writeFileSync(out, lines.join('\n'), 'utf8');
    console.log(JSON.stringify({ status: 'ok', ms, oracle: o?.status, cost: o?.costUsd, areas: Object.keys(o?.areas?.areas ?? {}), gaps: o?.areaGaps?.length ?? 0, out }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
