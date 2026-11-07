/**
 * One LLM cache sweep (docs/reading-engine/20 §8, R-7): delete idle/expired explicit Gemini caches and reconcile orphans.
 * Usage: npm run cache:sweep [-- --idle-minutes 30]
 */
import { config } from 'dotenv';
config();
import { prisma } from '../src/lib/prisma.js';
import { sweepLlmCaches } from '../src/reading/llm/promptCache.js';
import { sweepTechniqueOutputs } from '../src/techniques/outputStore.js';

async function main() {
  const i = process.argv.indexOf('--idle-minutes');
  const minutes = i > 0 ? Number(process.argv[i + 1]) : 30;
  if (!Number.isFinite(minutes) || minutes < 1) throw new Error('--idle-minutes must be a number >= 1');
  const [llm, techniqueOutputsDeleted] = await Promise.all([
    sweepLlmCaches({ idleMs: minutes * 60_000 }),
    sweepTechniqueOutputs(prisma),
  ]);
  console.log(JSON.stringify({ ...llm, techniqueOutputsDeleted }));
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
