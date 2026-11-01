/**
 * Oracle flow benchmark (docs/reading-engine/39 §5, §10). Replaces the speed fit in doc 39 with measured numbers.
 *
 *   npm run bench:oracle                      # model stubbed by the local fake Gemini: our own overhead, no cost
 *   npm run bench:oracle -- --live            # real Gemini: costs money, under $1 for the default set. Needs Sachin's OK
 *   npm run bench:oracle -- --live --runs 3   # repeats per question
 *   npm run bench:oracle -- --json out.json
 *
 * Chart: golden fixture G1 and its stored tables (evals/fixtures/G1/catalog). No database. Prints per-stage times,
 * tokens and cost, and the share of questions inside 10 s.
 */
import 'dotenv/config';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { GOLDEN } from '../evals/questions.js';
import { clearReadingCaches } from '../src/reading/data/store.js';
import { clearChartBundles, type ChartRowSource } from '../src/reading/oracle/chartBundle.js';
import { clearReaderMemo } from '../src/reading/oracle/prewarm.js';
import { runReading } from '../src/reading/run.js';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';

const AS_OF = '2026-10-24';
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] ?? d : d;
};
const live = process.argv.includes('--live');
const runs = Number(arg('--runs', '1'));
const prisma = { systemPrompt: { findFirst: async () => null } } as unknown as PrismaClient;

/** G1's stored tables. A file name is the type id with `.json`. */
function fixtureRows(): ChartRowSource {
  const dir = path.resolve('evals/fixtures/G1/catalog');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const tables = new Map(files.map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as unknown]));
  return { read: async (_k, types) => types.filter((t) => tables.has(t)).map((t) => ({ data_type: t, variant: '', payload: tables.get(t) })) };
}

const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0;
};

async function main(): Promise<void> {
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  const fake = live ? null : await startFakeGemini({ answer: 'A demo answer naming March 2027 for the bench.' });
  if (fake) {
    process.env.GEMINI_API_KEY = 'bench';
    process.env.GEMINI_API_URL = fake.url;
    process.env.READING_MODEL_READER = 'gemini-3.1-flash-lite';
    process.env.READING_MODEL_ORACLE = 'gemini-3.8-flash';
    process.env.READING_MODEL_VALIDATOR = 'gemini-3.1-flash-lite';
  }
  const rows = fixtureRows();
  const results: Array<Record<string, unknown>> = [];
  for (let run = 0; run < runs; run++) {
    for (const g of GOLDEN) {
      clearChartBundles();
      clearReaderMemo();
      clearReadingCaches();
      const r = await runReading(prisma, 'bench', g.question, { asOf: AS_OF, flow: 'oracle', chartRows: rows });
      const t = r.record.timingsMs;
      const cost = (r.record.cache as { cost?: { fanout: number; oracle: number; refused: number } }).cost;
      const usage = r.record.usage;
      results.push({
        id: g.id,
        flow: r.record.flow,
        tier: (r.record.cache as { tier?: number }).tier ?? null,
        readers: usage.filter((u) => /^(R\d\d|P\d)$/.test(u.node)).length,
        totalMs: t.total,
        bundleMs: t.bundle ?? 0,
        oracleStartMs: t.synthStart ?? 0,
        oracleMs: t.oracle ?? t.synthesize ?? 0,
        validateMs: t.validate ?? 0,
        readerMaxMs: Math.max(0, ...usage.filter((u) => /^(R\d\d|P\d)$/.test(u.node)).map((u) => u.ms)),
        promptTokens: usage.reduce((n, u) => n + u.promptTokens, 0),
        cachedTokens: usage.reduce((n, u) => n + u.cachedTokens, 0),
        oracleOut: usage.filter((u) => u.node === 'oracle').reduce((n, u) => n + u.outputTokens + u.thoughtTokens, 0),
        usd: r.record.costUsd,
        fanoutUsd: cost?.fanout ?? 0,
        oracleUsd: cost?.oracle ?? 0,
        refused: cost?.refused ?? 0,
        errors: r.record.errors.length,
      });
      const last = results[results.length - 1]!;
      console.log(`${String(g.id).padEnd(5)} tier ${String(last.tier ?? '-').padEnd(2)} readers ${String(last.readers).padEnd(3)} total ${String(last.totalMs).padStart(6)} ms  oracle ${String(last.oracleMs).padStart(6)} ms  $${Number(last.usd).toFixed(4)}  errors ${last.errors}`);
    }
  }
  const nums = (k: string) => results.map((x) => Number(x[k]));
  const row = (k: string) => `${k.padEnd(14)} p50 ${pct(nums(k), 0.5)}  p95 ${pct(nums(k), 0.95)}  max ${Math.max(...nums(k))}`;
  console.log(['', ...['totalMs', 'bundleMs', 'readerMaxMs', 'oracleStartMs', 'oracleMs', 'validateMs', 'promptTokens', 'cachedTokens', 'oracleOut', 'usd', 'fanoutUsd', 'oracleUsd'].map(row)].join('\n'));
  const inside = results.filter((x) => Number(x.totalMs) <= 10_000).length;
  console.log(`\ninside 10 s: ${inside} of ${results.length}. Over a cap: ${results.filter((x) => Number(x.usd) > 0.3 || Number(x.fanoutUsd) > 0.05 || Number(x.oracleUsd) > 0.25).length}. Calls refused by the guard: ${results.reduce((n, x) => n + Number(x.refused), 0)}.`);
  const out = arg('--json', '');
  if (out) writeFileSync(out, JSON.stringify({ live, asOf: AS_OF, results }, null, 2));
  await fake?.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
