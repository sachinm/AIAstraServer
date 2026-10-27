/**
 * Reading-engine benchmark (brief item 5, docs/reading-engine/12-performance.md).
 *
 *   npm run bench:reading                    # model stubbed by the local fake Gemini: measures our own overhead
 *   npm run bench:reading -- --runs 20       # more repetitions (default 10 per question per flow)
 *   npm run bench:reading -- --live          # real Gemini (GEMINI_API_KEY / GEMINI_API_URL from .env), 1 run each
 *   npm run bench:reading -- --json out.json # also write the raw numbers
 *   npm run bench:reading -- --layout full   # explicit cache on, full prefix layout (memory registry, no database)
 *
 * `cachedShare.<flow>` is cached / prompt tokens per question; `uncached.<node>.<flow>` the tokens each call sent
 * outside a cache. With the fake Gemini both are character estimates (chars / 3.2), not Gemini's tokenizer.
 *
 * Chart: golden fixture G1 (no database). Prints p50/p95 per stage for the single and graph flows and checks the
 * budgets. In stub mode model time is the fake's (~ms), so first-token and total numbers show orchestration cost only.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { classifyRules } from '../src/reading/buckets/classifier.js';
import { buildEvidencePack } from '../src/reading/packs/selector.js';
import { runIntake } from '../src/reading/nodes/intake.js';
import { reconcile } from '../src/reading/nodes/reconcile.js';
import { runReading } from '../src/reading/run.js';
import { clearReadingCaches, loadReadingData } from '../src/reading/data/store.js';
import { findingsCache } from '../src/reading/nodes/findingsCache.js';
import { GOLDEN } from '../evals/questions.js';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';
import { setCacheRegistry, settlePromptCache } from '../src/reading/llm/promptCache.js';
import type { ReadingEvent } from '../src/reading/types.js';

const AS_OF = '2026-10-24';
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] ?? d : d;
};
const live = process.argv.includes('--live');
const runs = live ? 1 : Number(arg('--runs', '10'));
const prisma = { systemPrompt: { findFirst: async () => null } } as unknown as PrismaClient;

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};
const fmt = (n: number) => (Number.isNaN(n) ? '-' : n < 10 ? n.toFixed(2) : n.toFixed(0));

interface Budget {
  stage: string;
  p95Max: number;
  note: string;
}
const BUDGETS: Budget[] = [
  { stage: 'classify', p95Max: 5, note: 'rules classification' },
  { stage: 'intentEvent', p95Max: 1200, note: 'intent event on the wire, from request' },
  { stage: 'pack', p95Max: 150, note: 'evidence pack build' },
  { stage: 'reconcile', p95Max: 50, note: 'reconcile (no model)' },
  { stage: 'firstToken.single', p95Max: 10_000, note: 'first answer token, full reading' },
  { stage: 'total.single', p95Max: 40_000, note: 'complete, full reading' },
  { stage: 'firstToken.graph', p95Max: 10_000, note: 'first answer token, graph flow' },
  { stage: 'total.graph', p95Max: 40_000, note: 'complete, graph flow' },
];

async function main(): Promise<void> {
  process.env.READING_FACTS_SOURCE = 'fixture';
  delete process.env.READING_ENGINE;
  const layout = arg('--layout', '');
  if (layout === 'full' || layout === 'base') {
    process.env.READING_EXPLICIT_CACHE = '1';
    process.env.READING_CACHE_LAYOUT = layout;
    // the bench never touches the database: caches live in this process only
    setCacheRegistry(null);
  }
  const fake = live ? null : await startFakeGemini({ chunkDelayMs: 0 });
  if (fake) {
    process.env.GEMINI_API_URL = fake.url;
    process.env.GEMINI_API_KEY = 'bench';
  }
  const samples: Record<string, number[]> = {};
  const add = (k: string, v: number | undefined) => {
    if (typeof v === 'number' && Number.isFinite(v)) (samples[k] ??= []).push(v);
  };
  try {
    const data = await loadReadingData(prisma, 'bench', { asOf: AS_OF });
    if (!data) throw new Error('fixture data missing');
    for (let r = 0; r < runs; r++) {
      for (const g of GOLDEN) {
        // pure stages, measured in isolation
        let t = performance.now();
        classifyRules(g.question, AS_OF);
        add('classify', performance.now() - t);
        const intent = (await runIntake(g.question, AS_OF, { mode: 'rules' })).intent;
        t = performance.now();
        const pack = buildEvidencePack({ dossier: data.dossier, transits: data.transits, subject: intent.subjects[0]!.id, asOf: AS_OF, intent });
        add('pack', performance.now() - t);
        t = performance.now();
        reconcile({ findings: [], packs: { [intent.subjects[0]!.id]: pack }, intent, asOf: AS_OF, keyFacts: '', dossier: data.dossier, transits: data.transits });
        add('reconcile', performance.now() - t);

        for (const flow of ['single', 'graph'] as const) {
          clearReadingCaches();
          findingsCache.clear();
          let intentAt = -1;
          const t0 = performance.now();
          const res = await runReading(prisma, 'bench', g.question, {
            asOf: AS_OF,
            flow,
            onEvent: (e: ReadingEvent) => {
              if (e.type === 'intent' && intentAt < 0) intentAt = performance.now() - t0;
            },
          });
          const tm = res.record.timingsMs as Record<string, number>;
          add('intentEvent', intentAt);
          add(`firstToken.${flow}`, tm.firstTokenFromStart);
          add(`total.${flow}`, tm.total);
          add(`intake.${flow}`, tm.intake);
          add(`dataWait.${flow}`, tm.dataWait);
          if (flow === 'graph') add('graph.reconcile', tm.reconcile);
          add(`promptTokens.${flow}`, res.record.usage.reduce((s, u) => s + u.promptTokens, 0));
          add(`cachedTokens.${flow}`, res.record.usage.reduce((s, u) => s + u.cachedTokens, 0));
          add(`cachedShare.${flow}`, Number(res.record.cache.cachedShare ?? 0));
          for (const u of res.record.usage) add(`uncached.${u.node}.${flow}`, u.promptTokens - u.cachedTokens);
          // let a cache started by this question finish, as the next question would find it on a warm instance
          await settlePromptCache();
          add(`modelCalls.${flow}`, res.record.usage.length);
        }
      }
    }
  } finally {
    await fake?.close();
  }

  const rows = Object.keys(samples).sort();
  console.log(`\nReading bench: ${live ? 'LIVE model' : 'model stubbed (fake Gemini)'} · cache layout ${process.env.READING_EXPLICIT_CACHE === '1' ? process.env.READING_CACHE_LAYOUT ?? 'base' : 'off'} · chart G1 · ${GOLDEN.length} questions × ${runs} runs\n`);
  console.log('| Stage | n | p50 | p95 | budget (p95) | ok |');
  console.log('|---|---|---|---|---|---|');
  for (const k of rows) {
    const b = BUDGETS.find((x) => x.stage === k);
    const p95 = pct(samples[k]!, 95);
    console.log(`| ${k} | ${samples[k]!.length} | ${fmt(pct(samples[k]!, 50))} | ${fmt(p95)} | ${b ? b.p95Max : ''} | ${b ? (p95 <= b.p95Max ? 'yes' : 'NO') : ''} |`);
  }
  const json = arg('--json', '');
  if (json) writeFileSync(json, JSON.stringify({ live, runs, asOf: AS_OF, samples }, null, 1));
  const failed = BUDGETS.filter((b) => samples[b.stage] && pct(samples[b.stage]!, 95) > b.p95Max);
  if (failed.length) {
    console.log(`\nOver budget: ${failed.map((f) => f.stage).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
