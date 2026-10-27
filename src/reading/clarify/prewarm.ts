/**
 * Track B of file 13: while the clarifier waits for the person's answer, run the specialists that do not depend on
 * the answer (the natal layers: promise, and nakshatra when relevant) for the bucket's frame, so their findings are
 * in the findings cache when the person confirms. Timing layers (dasha, transit) wait for the clarified period.
 *
 * Only for the graph flow (READING_FLOW=graph) and only when the dossier is loaded. Bounded: the caller awaits it with
 * a cap inside the same request, so nothing outlives a Lambda invocation. Never throws.
 *
 * With the full cache layout (READING_EXPLICIT_CACHE=1, READING_CACHE_LAYOUT=full) it first creates the user's cached
 * prefix for the day, one per model the reading will use (single and graph flow alike), so the first question already
 * hits it. That step has its own cap (FULL_CACHE_PREWARM_CAP_MS); if it runs over, the natal layers go ahead uncached.
 */
import type { PrismaClient } from '@prisma/client';
import { readingFlow } from '../config.js';
import { startPrefetch } from '../data/store.js';
import { findingCacheKey, findingsCache } from '../nodes/findingsCache.js';
import { runIntake } from '../nodes/intake.js';
import { runSpecialist, type SpecialistAnalyst } from '../nodes/specialists.js';
import { buildEvidencePack } from '../packs/selector.js';
import { fullCacheLayoutActive, fullContextFor, type FullContext } from '../packs/fullPrefix.js';
import { ensurePromptCache } from '../llm/promptCache.js';
import { modelFor } from '../llm/models.js';
import { buildSystem } from '../run.js';
import { BUCKETS } from '../buckets/taxonomy.js';
import type { ClarifyState } from './machine.js';

export const PREWARM_CAP_MS = 12_000;
/** Longest the prewarm waits for the full-layout caches before running the natal layers. */
export const FULL_CACHE_PREWARM_CAP_MS = 6_000;

export async function prewarmNatalLayers(prisma: PrismaClient, userId: string, s: ClarifyState, opts: { specialist?: typeof runSpecialist } = {}): Promise<{ ran: string[]; cached: string[] }> {
  const ran: string[] = [];
  const cached: string[] = [];
  const graph = readingFlow() === 'graph';
  const layers = graph && s.bucket !== 'unknown' && s.bucket !== 'explain_term';
  const fullLayout = fullCacheLayoutActive();
  if (!layers && !fullLayout) return { ran, cached };
  try {
    const data = await startPrefetch(prisma, userId, { asOf: s.asOf });
    if (!data?.dossier) return { ran, cached };
    let full: FullContext | undefined;
    if (fullLayout) {
      full = fullContextFor(data, s.asOf, await buildSystem(prisma));
      const ctx = full;
      const models = [...new Set([modelFor('synth'), ...(graph ? [modelFor('specialist')] : [])])];
      const owner = { userId, kundliId: data.kundliId };
      await prewarmWithCap(Promise.all(models.map((m) => ensurePromptCache(m, ctx.system, ctx.prefix, owner))), FULL_CACHE_PREWARM_CAP_MS);
    }
    if (!layers) return { ran, cached };
    const sub = s.subBucket ? BUCKETS[s.bucket].subBuckets.find((x) => x.id === s.subBucket)?.frame : undefined;
    const subject = sub ?? BUCKETS[s.bucket].frames[0]!;
    const intent = (await runIntake(s.question, s.asOf, { mode: 'rules' })).intent;
    const subjIntent = { ...intent, subjects: [{ id: subject, weight: 1 }] };
    const pack = buildEvidencePack({ dossier: data.dossier, transits: data.transits, subject, asOf: s.asOf, intent: subjIntent });
    const system = await buildSystem(prisma);
    const analysts: SpecialistAnalyst[] = ['promise', ...(s.bucket === 'spirituality_direction' ? (['nakshatra'] as const) : [])];
    const call = opts.specialist ?? runSpecialist;
    await Promise.all(
      analysts.map(async (analyst) => {
        const key = findingCacheKey({ dossierHash: data.dossierHash, analyst, subject, horizon: subjIntent.horizon, asOf: s.asOf });
        if (findingsCache.get(key)) {
          cached.push(analyst);
          return;
        }
        const { finding } = await call({ analyst, subject, pack, intent: subjIntent, question: s.question, system, asOf: s.asOf, cacheOwner: { userId, kundliId: data.kundliId }, ...(full ? { full } : {}) });
        findingsCache.set(key, finding);
        ran.push(analyst);
      })
    );
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify prewarm failed (reading will run the layers itself)', error: (err as Error).message.slice(0, 200) }));
  }
  return { ran, cached };
}

/** Await the prewarm with a cap so the request never hangs on it. */
export async function prewarmWithCap(p: Promise<unknown>, capMs = PREWARM_CAP_MS): Promise<void> {
  await Promise.race([p.catch(() => undefined), new Promise((r) => setTimeout(r, capMs))]);
}
