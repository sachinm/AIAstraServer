/**
 * Runs the assistant log's SQL once against the configured database, with one throwaway visit, and removes it.
 *   npx tsx scripts/check-assistant-store.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaAssistantStore } from '../src/assistant/store.js';

const db = new PrismaClient();
const store = new PrismaAssistantStore(db);
const visitId = `store-check-${Date.now()}`;
const now = new Date();

async function main(): Promise<void> {
  const facts = { visitId, ip: '203.0.113.42', userAgent: 'store-check', country: null, language: null, referrer: null, path: '/' };
  await store.recordVisit(facts, now);
  await store.recordVisit(facts, new Date(now.getTime() + 1000));
  await store.recordQuestion({ visitId, ip: '203.0.113.42', question: 'store check', answer: 'ok', verdict: 'unsure', outcome: 'failed', model: null, tokensIn: null, tokensOut: null, latencyMs: 1 }, now);
  await store.recordQuestion({ visitId, ip: null, question: 'store check 2', answer: 'ok', verdict: 'yes', outcome: 'answered', model: 'store-check-model', tokensIn: 5, tokensOut: 2, latencyMs: 9 }, now);
  console.log('counts', await store.counts(visitId, new Date(now.getTime() + 2000)));
  const visits = await db.$queryRaw<{ n: bigint; ip_prefix: string; ip_full: string }[]>`SELECT count(*) OVER () AS n, ip_prefix, ip_full FROM assistant_visits WHERE visit_id = ${visitId}`;
  console.log('visit rows', Number(visits[0]?.n), visits[0]?.ip_prefix, visits[0]?.ip_full);
  console.log('purge', await store.purge(now));
}

main()
  .catch((e) => {
    console.error('FAILED', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const q = await db.$executeRaw`DELETE FROM assistant_questions WHERE visit_id = ${visitId}`;
    const v = await db.$executeRaw`DELETE FROM assistant_visits WHERE visit_id = ${visitId}`;
    console.log('removed', q, v);
    await db.$disconnect();
  });
