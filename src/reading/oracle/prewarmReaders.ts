/**
 * The clarify side of prewarm: from a clarify state, load the tables and run every reader the reading will need, inside the
 * caller's request (a Lambda freezes once the response is sent). Readers that need the confirmed moment (prashna) wait.
 * Bounded by its own cost guard and by the caller's time cap. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { BUCKETS } from '../buckets/taxonomy.js';
import { intentFromState } from '../clarify/service.js';
import type { ClarifyState } from '../clarify/machine.js';
import { readingFlow } from '../config.js';
import { startPrefetch } from '../data/store.js';
import { modelFor } from '../llm/models.js';
import { isFastLane } from '../nodes/specialists.js';
import { buildEvidencePack } from '../packs/selector.js';
import { prismaChartRows, type ChartRowSource } from './chartBundle.js';
import { CostGuard } from './costGuard.js';
import { prepareReaders, startReaderCache } from './prepare.js';
import { getReaderMemo, savePrewarmed, setReaderMemo, type HeldReader } from './prewarm.js';
import { ReaderFailure, runReader } from './runReader.js';
import { readerTimeoutMs } from './readers.js';

/** The cap the readers' prefix cache gets before the readers start without it. */
const CACHE_WAIT_MS = 1_500;

export interface PrewarmReport {
  ran: string[];
  cached: string[];
  skipped: string[];
  spentUsd: number;
}

export async function prewarmOracleReaders(prisma: PrismaClient, userId: string, s: ClarifyState, runId: string, opts: { readerImpl?: typeof runReader; rows?: ChartRowSource } = {}): Promise<PrewarmReport> {
  const report: PrewarmReport = { ran: [], cached: [], skipped: [], spentUsd: 0 };
  if (readingFlow() !== 'oracle' || s.bucket === 'unknown' || s.bucket === 'explain_term' || !BUCKETS[s.bucket]) return report;
  // a question about a child goes to no agent until the clarifier knows the child is an adult (doc 18)
  if (s.pending?.criterion === 'child_age' || s.childAge === 'minor') return report;
  try {
    const data = await startPrefetch(prisma, userId, { asOf: s.asOf });
    if (!data?.dossier) return report;
    const intent = await intentFromState(s, runId);
    if (isFastLane(intent)) return report;
    const subject = intent.subjects[0]!.id;
    const pack = buildEvidencePack({ dossier: data.dossier, transits: data.transits, subject, asOf: s.asOf, intent });
    const model = modelFor('reader');
    const guard = new CostGuard({ on: s.asOf });
    const prep = await prepareReaders({ rows: opts.rows ?? prismaChartRows(prisma), kundliId: data.kundliId, intent, question: s.question, asOf: s.asOf, pack, model });
    const owner = { userId, kundliId: data.kundliId };
    await Promise.race([startReaderCache(prep, model, owner, guard), new Promise((r) => setTimeout(r, CACHE_WAIT_MS))]);
    const entries: Array<{ key: string; held: HeldReader }> = [];
    const impl = opts.readerImpl ?? runReader;
    await Promise.all(
      [...prep.requests.values()].map(async (req) => {
        const hit = getReaderMemo(req.cacheKey);
        if (hit) {
          report.cached.push(req.id);
          entries.push({ key: req.cacheKey, held: hit });
          return;
        }
        try {
          const out = await impl(req, { model, guard, cacheOwner: owner, timeoutMs: readerTimeoutMs(req.def, model) });
          const held = { finding: out.finding, usage: out.usage };
          if (!out.repaired) {
            setReaderMemo(req.cacheKey, held);
            entries.push({ key: req.cacheKey, held });
          }
          report.ran.push(req.id);
        } catch (err) {
          report.skipped.push(`${req.id}:${err instanceof ReaderFailure ? err.reason : 'error'}`);
        }
      })
    );
    report.spentUsd = guard.spent();
    await savePrewarmed(prisma, userId, runId, { entries, spentUsd: report.spentUsd });
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'oracle prewarm failed (the reading will run the readers itself)', error: (err as Error).message.slice(0, 200) }));
  }
  return report;
}
