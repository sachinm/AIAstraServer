/**
 * Shows that two different questions from the same user send a byte-identical cacheable prefix (system prompt + base chart),
 * which is what lets Gemini's implicit prefix cache hit. Uses the local fake Gemini and the golden chart; prints where the two
 * requests first differ.
 *
 *   npx tsx scripts/cache-prefix-probe.ts [out.json]
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { startFakeGemini } from '../tests/helpers/fakeGemini.js';

const fake = await startFakeGemini({});
process.env.GEMINI_API_URL = fake.url;
process.env.GEMINI_API_KEY = 'probe';
process.env.GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash';
process.env.READING_FACTS_SOURCE = 'fixture';
process.env.READING_INTAKE_MODE = 'rules';
const { runReading } = await import('../src/reading/run.js');
const prisma = {} as unknown as PrismaClient;
const questions = ['When will I get married?', 'Should I change jobs this year?', 'When am I going to buy a house?'];
for (const q of questions) await runReading(prisma, 'u', q, { asOf: '2026-10-24', flow: 'single' });

const bodies = fake.requests.map((r) => r.body);
const sys = bodies.map((b) => String(b.systemInstruction.parts[0].text));
const parts = bodies.map((b) => (b.contents[0].parts as Array<{ text: string }>).map((p) => p.text));
const out = {
  questions,
  systemPromptIdentical: sys.every((s) => s === sys[0]),
  systemPromptChars: sys[0]!.length,
  baseChartIdentical: parts.every((p) => p[0] === parts[0]![0]),
  baseChartChars: parts[0]![0]!.length,
  subjectPartsDiffer: new Set(parts.map((p) => p[1])).size === parts.length,
  subjectPartChars: parts.map((p) => p[1]!.length),
  cacheablePrefixChars: sys[0]!.length + parts[0]![0]!.length,
  cacheablePrefixApproxTokens: Math.ceil((sys[0]!.length + parts[0]![0]!.length) / 3.6),
  perRequestVariableApproxTokens: parts.map((p) => Math.ceil((p[1]!.length + p[2]!.length) / 3.6)),
  note: 'The fake server reports cachedContentTokenCount for a repeated prefix, as Gemini does for implicit caching; real hit rates are measured in the real eval.',
};
console.log(JSON.stringify(out, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
await fake.close();
process.exit(0);
