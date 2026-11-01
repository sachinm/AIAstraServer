/**
 * Measures what each oracle-flow reader would be sent for a real stored kundli, with no model call: prompt tokens (estimate,
 * chars / 3.6), the worst-case cost and how long the table read took. Read-only. Prints sizes and field names, never a chart
 * value. Usage: npx tsx scripts/oracle-slice-sizes.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { priceFor } from '../src/reading/llm/models.js';
import { CORE_TYPES, loadChartBundle, prismaChartRows } from '../src/reading/oracle/chartBundle.js';
import { fetchPlan, READERS, subjectVargas, type ReaderId, type SliceContext } from '../src/reading/oracle/readers.js';
import { buildReaderRequest } from '../src/reading/oracle/runReader.js';
import { renderCore } from '../src/reading/oracle/slices.js';

const AS_OF = new Date().toISOString().slice(0, 10);
const TO = `${Number(AS_OF.slice(0, 4)) + 1}${AS_OF.slice(4)}`;
const MODEL = 'gemini-3.1-flash-lite';
const IDS: ReaderId[] = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R13', 'P1', 'P2', 'P3'];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const top = await prisma.$queryRawUnsafe<Array<{ kundli_id: string }>>(`SELECT kundli_id FROM kundli_data WHERE status='ready' GROUP BY kundli_id ORDER BY count(*) DESC LIMIT 1`);
    const kundliId = top[0]!.kundli_id;
    const person = { person: 'mother' as const, houses: [4], varga: 'varga.d12' };
    const vargas = subjectVargas('career_work');
    const types = fetchPlan(IDS, { vargas, person });
    const bundle = await loadChartBundle(prismaChartRows(prisma), kundliId, types, AS_OF);
    console.log(`types ${types.length}, missing ${JSON.stringify(bundle.missing)}, read ${bundle.ms} ms`);
    const coreTier3 = fetchPlan(['R01', 'R02', 'R03', 'R08', 'R10'], { vargas, person: null });
    console.log(`tier 3 types ${coreTier3.length}`);
    const core = renderCore(bundle.tables, CORE_TYPES);
    console.log(`core ${core.text.length} chars, about ${Math.ceil(core.text.length / 3.6)} tokens`);
    for (const [k, v] of Object.entries(core.sections)) console.log(`  ${k}: ${Math.ceil(JSON.stringify(v).length / 3.6)} tokens; keys ${Object.keys((v as object) ?? {}).slice(0, 6).join(', ')}`);
    const slice: SliceContext = { tables: bundle.tables, houses: [10, 6, 1, 4], vargas, from: AS_OF, to: TO, transits: {}, person };
    const p = priceFor(MODEL, AS_OF)!;
    let total = 0;
    for (const id of IDS) {
      const r = buildReaderRequest({ id, subject: 'career_work', slice, intent: { subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'describe', format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: '', followUps: [], safety: 'ok' }, question: 'q', asOf: AS_OF, model: MODEL });
      const tables = Math.ceil(r.tablesText.length / 3.6);
      const curriculum = Math.ceil(r.promptSent.length / 3.6);
      const cold = (r.promptTokens * p.in + READERS[id].maxOutputTokens * p.out) / 1e6;
      total += cold;
      console.log(`${id.padEnd(4)} tables ${String(tables).padStart(6)}  curriculum ${String(curriculum).padStart(5)}  prompt ${String(r.promptTokens).padStart(6)}  worst case $${cold.toFixed(4)}`);
    }
    console.log(`all readers, cold, at worst: $${total.toFixed(4)}`);
    const dig = (o: unknown, path: string[]) => path.reduce<unknown>((c, k) => (c && typeof c === 'object' ? (c as Record<string, unknown>)[k] : undefined), o);
    for (const path of [['dignities', 'planets'], ['arudhas', 'bhava_arudhas'], ['varga_d1'], ['karaka_chara'], ['benefic_malefic', 'house_lords'], ['strength_shadbala', 'planets']]) {
      const v = dig(core.sections, path);
      console.log(`${path.join('.')} → ${v && typeof v === 'object' && !Array.isArray(v) ? `keys ${Object.keys(v as object).slice(0, 14).join(', ')}` : Array.isArray(v) ? 'array (rows not named)' : typeof v}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message.slice(0, 300));
  process.exitCode = 1;
});
