/**
 * End-to-end check of the NEW chat path against the real database, with the model layer stubbed by the local fake
 * Gemini (no model spend). Nothing is written: it calls chatWithConfiguredProvider directly, not askChatTurn.
 *
 *   npx tsx scripts/e2e-live-db.ts [--users 3] [--flow single|graph] [--real-model]
 *
 * --real-model uses GEMINI_API_KEY / GEMINI_API_URL from the environment instead of the fake.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';
import { chatWithConfiguredProvider } from '../src/services/chatLlmService.js';
import { loadReadingData, clearReadingCaches } from '../src/reading/data/store.js';

const QUESTIONS = ['Should I change jobs this year?', 'When will I buy a house?', 'Is Saturn affecting my marriage right now?'];

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? def : def;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const real = process.argv.includes('--real-model');
  const fake = real ? null : await startFakeGemini({ chunkDelayMs: 1 });
  if (fake) {
    process.env.GEMINI_API_URL = fake.url;
    process.env.GEMINI_API_KEY = 'fake';
  }
  delete process.env.READING_ENGINE; // the default must be the new path
  delete process.env.READING_FALLBACK_LEGACY;
  process.env.CHAT_LLM_PROVIDER = 'gemini';
  process.env.READING_FLOW = arg('--flow', 'single');
  const n = Number(arg('--users', '3'));
  const asOf = new Date().toISOString().slice(0, 10);
  try {
    const kundlis = await prisma.kundli.findMany({ where: { facts_status: 'ready' }, select: { user_id: true, id: true }, take: n, orderBy: { created_at: 'asc' } });
    const rows: Array<Record<string, unknown>> = [];
    for (const [i, k] of kundlis.entries()) {
      // cold then warm DB load (the cache is in-process, as in a warm Lambda)
      clearReadingCaches();
      const c0 = Date.now();
      const cold = await loadReadingData(prisma, k.user_id, { asOf });
      const coldMs = Date.now() - c0;
      const w0 = Date.now();
      await loadReadingData(prisma, k.user_id, { asOf });
      const warmMs = Date.now() - w0;
      const q = QUESTIONS[i % QUESTIONS.length]!;
      const events: string[] = [];
      let firstEventMs = -1;
      let firstTokenMs = -1;
      const t0 = Date.now();
      const r = await chatWithConfiguredProvider(prisma, k.user_id, q, {
        onEvent: (e) => {
          if (firstEventMs < 0) firstEventMs = Date.now() - t0;
          events.push(e.type === 'stage' ? `stage:${String(e.name)}:${String(e.status)}` : e.type);
        },
        onDelta: () => {
          if (firstTokenMs < 0) firstTokenMs = Date.now() - t0;
        },
      });
      rows.push({
        kundli: k.id.slice(0, 8),
        question: q,
        engine: (r.requestPayload as Record<string, unknown>).engine,
        flow: r.reading?.flow ?? null,
        status: r.reading?.status ?? (r.requestPayload as Record<string, unknown>).status ?? null,
        dossier: cold ? 'loaded' : 'missing',
        transits: cold?.transits ? `${cold.transits.rows.length} rows ${cold.transits.from}..${cold.transits.to}` : 'none',
        dbLoadColdMs: coldMs,
        dbLoadWarmMs: warmMs,
        firstEventMs,
        firstTokenMs,
        totalMs: Date.now() - t0,
        intent: r.reading?.intent ? { subjects: (r.reading.intent as any).subjects?.map((s: any) => s.id), horizon: (r.reading.intent as any).horizon, format: (r.reading.intent as any).format } : null,
        packHashes: r.reading?.packHashes ?? null,
        timings: r.reading?.timingsMs ?? null,
        events: events.slice(0, 12),
        answerStart: r.answerText.slice(0, 80),
      });
    }
    console.log(JSON.stringify({ model: real ? 'real' : 'fake', flow: process.env.READING_FLOW, asOf, runs: rows }, null, 1));
  } finally {
    await fake?.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
