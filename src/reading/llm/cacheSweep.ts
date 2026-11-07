/**
 * Entry points for the LLM & reading cache sweeper and 45-minute per-individual cache recycler
 * (promptCache.ts `sweepLlmCaches`, prewarm.ts `sweepReaderFindingsCache`, outputStore.ts `sweepTechniqueOutputs`;
 * docs/reading-engine/19 §cache, R-7):
 * - Per-individual 45-minute recycle task: whenever any sub-agent cache (Gemini explicit prompt cache,
 *   `reading_findings_cache`, `technique_outputs`, or in-memory specialist/reader cache) is used for an individual
 *   (`userId` / `kundliId`), `informIndividualCacheUsed` schedules a 45-minute task (`READING_CACHE_RECYCLE_MINUTES`,
 *   default 45) to remove all caches that have already been used for that individual.
 * - Lambda: an EventBridge scheduled event reaches Express through the Lambda Web Adapter pass-through path
 *   (POST /events, AWS_LWA_PASS_THROUGH_PATH). `isCacheSweepEvent` recognises it; `runScheduledSweep` runs it.
 * - Long-lived server (not Lambda): `startPeriodicSweep` runs it every 45 minutes on an unref'd timer.
 * - CLI: `npm run cache:sweep` (scripts/cache-sweep.ts).
 */
import type { PrismaClient } from '@prisma/client';
import { getReadingCacheRecycleMs } from '../../config/env.js';
import { recycleIndividualTechniqueOutputs, setTechniqueOutputUsedHook, sweepTechniqueOutputs } from '../../techniques/outputStore.js';
import { evictClarifyCacheForIndividual } from '../clarify/planner.js';
import { evictCodeReaderMemoForIndividual } from '../codeReaders/readers.js';
import { evictFindingsCacheForIndividual, setSpecialistCacheUsedHook } from '../nodes/findingsCache.js';
import { evictChartBundleForIndividual } from '../oracle/chartBundle.js';
import { evictReaderMemoForIndividual, recycleIndividualReaderCache, setReaderCacheUsedHook, sweepReaderFindingsCache } from '../oracle/prewarm.js';
import { evictValidatorCacheForIndividual } from '../oracle/validator.js';
import { evictFullContextsForIndividual } from '../packs/fullPrefix.js';
import {
  deleteIndividualCaches,
  explicitCacheEnabled,
  setCacheOwnerUsedHook,
  setUserCachesDeletedHook,
  sweepLlmCaches,
  type CacheOwner,
  type SweepResult,
} from './promptCache.js';

let defaultPrismaPromise: Promise<PrismaClient | null> | undefined;
async function resolveDefaultPrisma(): Promise<PrismaClient | null> {
  defaultPrismaPromise ??= import('../../lib/prisma.js')
    .then((m) => m.prisma)
    .catch(() => null);
  return defaultPrismaPromise;
}

export const SWEEP_TASK = 'llm-cache-sweep';
const MIN_GAP_MS = 5 * 60_000;
let lastRunAt = 0;

export interface IndividualCacheRecycleResult {
  userId: string | null;
  kundliId: string | null;
  llmDeleted: number;
  llmFailed: number;
  llmMemoryCleared: number;
  readerDbDeleted: number;
  readerMemoryDeleted: number;
  specialistMemoryDeleted: number;
  techniqueOutputsDeleted: number;
  fullContextsDeleted: number;
  chartBundleEvicted: boolean;
  validatorMemoryDeleted: number;
  clarifyMemoryDeleted: number;
  codeReaderMemoryDeleted: number;
}

interface PendingRecycleEntry {
  owner: { userId: string | null; kundliId: string | null };
  lastUsedAt: number;
  dueAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRecycles = new Map<string, PendingRecycleEntry>();

function ownerKey(owner: CacheOwner): string | null {
  const u = owner.userId?.trim() || '';
  const k = owner.kundliId?.trim() || '';
  if (!u && !k) return null;
  return `${u}|${k}`;
}

/**
 * Removes all caches that have already been used (or are idle >= `opts.idleMs`) for one individual (`userId` / `kundliId`)
 * across Gemini explicit caches (`llm_cache_entries`), `reading_findings_cache`, `technique_outputs`, and in-memory memos.
 */
export async function recycleIndividualCaches(
  owner: CacheOwner,
  opts: {
    prisma?: PrismaClient | null;
    onlyUsed?: boolean;
    idleMs?: number;
    now?: Date;
  } = {},
): Promise<IndividualCacheRecycleResult> {
  const key = ownerKey(owner);
  if (key) {
    const existing = pendingRecycles.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      pendingRecycles.delete(key);
    }
  }
  const db = opts.prisma !== undefined ? opts.prisma : await resolveDefaultPrisma();
  const now = opts.now ?? new Date();
  const onlyUsed = opts.onlyUsed ?? true;
  const idleMs = opts.idleMs;
  const idleBeforeMs = idleMs && idleMs > 0 ? now.getTime() - idleMs : undefined;

  const [llm, reader, techniqueOutputsDeleted] = await Promise.all([
    deleteIndividualCaches(owner, { onlyUsed, ...(idleMs !== undefined ? { idleMs } : {}), now }).catch(() => ({
      deleted: 0,
      failed: 1,
      memoryCleared: 0,
    })),
    recycleIndividualReaderCache(db, owner, { onlyUsed, ...(idleMs !== undefined ? { idleMs } : {}), now }).catch(() => ({
      dbDeleted: 0,
      memoryDeleted: 0,
    })),
    recycleIndividualTechniqueOutputs(db, { kundliId: owner.kundliId ?? null }, { onlyUsed, ...(idleMs !== undefined ? { idleMs } : {}), now }).catch(
      () => 0,
    ),
  ]);

  const specialistMemoryDeleted = evictFindingsCacheForIndividual(owner, {
    onlyUsed,
    ...(idleBeforeMs !== undefined ? { idleBeforeMs } : {}),
  });
  const fullContextsDeleted = evictFullContextsForIndividual({ kundliId: owner.kundliId ?? null });
  const chartBundleEvicted = evictChartBundleForIndividual(owner.kundliId ?? null);
  const validatorMemoryDeleted = evictValidatorCacheForIndividual(owner);
  const clarifyMemoryDeleted = evictClarifyCacheForIndividual(owner);
  const codeReaderMemoryDeleted = evictCodeReaderMemoForIndividual(owner.kundliId ?? null);

  return {
    userId: owner.userId ?? null,
    kundliId: owner.kundliId ?? null,
    llmDeleted: llm.deleted,
    llmFailed: llm.failed,
    llmMemoryCleared: llm.memoryCleared,
    readerDbDeleted: reader.dbDeleted,
    readerMemoryDeleted: reader.memoryDeleted,
    specialistMemoryDeleted,
    techniqueOutputsDeleted,
    fullContextsDeleted,
    chartBundleEvicted,
    validatorMemoryDeleted,
    clarifyMemoryDeleted,
    codeReaderMemoryDeleted,
  };
}

/**
 * Informs the 45-minute per-individual cache recycle task that caches for `owner` (`userId` / `kundliId`) have been used.
 * After `delayMs` (default `getReadingCacheRecycleMs()`, 45 minutes), all caches that have already been used for that
 * individual are removed across DB and memory.
 */
export function informIndividualCacheUsed(
  owner: CacheOwner,
  opts: { delayMs?: number; prisma?: PrismaClient | null } = {},
): void {
  const key = ownerKey(owner);
  if (!key) return;
  const prev = pendingRecycles.get(key);
  if (prev) clearTimeout(prev.timer);

  const normalizedOwner = {
    userId: owner.userId?.trim() || prev?.owner.userId || null,
    kundliId: owner.kundliId?.trim() || prev?.owner.kundliId || null,
  };
  const delayMs = opts.delayMs ?? getReadingCacheRecycleMs();
  const nowMs = Date.now();
  const timer = setTimeout(() => {
    pendingRecycles.delete(key);
    void recycleIndividualCaches(normalizedOwner, {
      ...(opts.prisma !== undefined ? { prisma: opts.prisma } : {}),
      onlyUsed: true,
    }).catch(() => {});
  }, delayMs);
  timer.unref?.();

  pendingRecycles.set(key, {
    owner: normalizedOwner,
    lastUsedAt: nowMs,
    dueAt: nowMs + delayMs,
    timer,
  });
}

/** Alias for {@link informIndividualCacheUsed}. */
export const scheduleIndividualCacheRecycle = informIndividualCacheUsed;

/** Inspects currently scheduled per-individual 45-minute cache recycle tasks (for diagnostics and unit tests). */
export function getPendingIndividualRecycles(): Array<{
  userId: string | null;
  kundliId: string | null;
  lastUsedAt: number;
  dueAt: number;
}> {
  return [...pendingRecycles.values()].map((e) => ({
    userId: e.owner.userId,
    kundliId: e.owner.kundliId,
    lastUsedAt: e.lastUsedAt,
    dueAt: e.dueAt,
  }));
}

/** Test seam: clears all scheduled per-individual recycle timers and resets sweep cooldown. */
export function clearPendingIndividualRecycles(): void {
  for (const e of pendingRecycles.values()) clearTimeout(e.timer);
  pendingRecycles.clear();
  lastRunAt = 0;
}

// Wire automatic usage notifications from all 4 cache layers to the 45-minute per-individual recycler.
setCacheOwnerUsedHook((owner) => informIndividualCacheUsed(owner));
setReaderCacheUsedHook((owner) => informIndividualCacheUsed(owner));
setSpecialistCacheUsedHook((owner) => informIndividualCacheUsed(owner));
setTechniqueOutputUsedHook((owner) => informIndividualCacheUsed(owner));
setUserCachesDeletedHook((userId) => {
  for (const [k, e] of pendingRecycles.entries()) {
    if (e.owner.userId === userId) {
      clearTimeout(e.timer);
      pendingRecycles.delete(k);
    }
  }
  const owner = { userId, kundliId: null };
  evictReaderMemoForIndividual(owner, { onlyUsed: false });
  evictFindingsCacheForIndividual(owner, { onlyUsed: false });
  evictValidatorCacheForIndividual(owner);
  evictClarifyCacheForIndividual(owner);
});

/**
 * An EventBridge scheduled event for the sweeper: `source: aws.events`, `detail-type: Scheduled Event`,
 * `detail.task: llm-cache-sweep`. When LLM_CACHE_SWEEP_TOKEN is set, `detail.token` must match it (the path is reachable
 * through the function URL, so the token keeps strangers from triggering sweeps).
 */
export function isCacheSweepEvent(body: unknown): boolean {
  const b = body as { source?: unknown; 'detail-type'?: unknown; detail?: { task?: unknown; token?: unknown } } | null;
  if (!b || b.source !== 'aws.events' || b['detail-type'] !== 'Scheduled Event' || b.detail?.task !== SWEEP_TASK) return false;
  const token = process.env.LLM_CACHE_SWEEP_TOKEN?.trim();
  return !token || b.detail?.token === token;
}

export type ScheduledSweepResult =
  | (SweepResult & {
      readerFindingsDeleted?: number;
      techniqueOutputsDeleted?: number;
      pageLogsDeleted?: number;
      individualsRecycled?: number;
    })
  | { skipped: string };

/** Runs one sweep across all cache layers unless one ran on this instance in the last 5 minutes. Never throws. */
export async function runScheduledSweep(
  opts: { prisma?: PrismaClient | null; now?: Date; force?: boolean } = {},
): Promise<ScheduledSweepResult> {
  const now = opts.now ?? new Date();
  if (!opts.force && Date.now() - lastRunAt < MIN_GAP_MS) return { skipped: 'ran recently' };
  lastRunAt = Date.now();
  const db = opts.prisma !== undefined ? opts.prisma : await resolveDefaultPrisma();
  const recycleMs = getReadingCacheRecycleMs();
  try {
    // Run any due per-individual recycle tasks first
    let individualsRecycled = 0;
    for (const [key, entry] of [...pendingRecycles.entries()]) {
      if (entry.dueAt <= now.getTime()) {
        clearTimeout(entry.timer);
        pendingRecycles.delete(key);
        await recycleIndividualCaches(entry.owner, { prisma: db, onlyUsed: true, now }).catch(() => {});
        individualsRecycled += 1;
      }
    }

    const [llm, readerFindingsDeleted, techniqueOutputsDeleted, pageLogsDeleted] = await Promise.all([
      sweepLlmCaches({ idleMs: recycleMs, now }),
      sweepReaderFindingsCache(db, { idleMs: recycleMs, now }).catch((err: Error) => {
        console.warn(JSON.stringify({ msg: 'reader findings cache sweep failed', error: err.message.slice(0, 200) }));
        return 0;
      }),
      db
        ? sweepTechniqueOutputs(db, now, 5_000, { recycleUsedAfterMs: recycleMs }).catch((err: Error) => {
            console.warn(JSON.stringify({ msg: 'technique outputs sweep failed', error: err.message.slice(0, 200) }));
            return 0;
          })
        : Promise.resolve(0),
      import('../../telemetry/pageTiming.js' as string)
        .then((m: { sweepPageExecutionLogs?: (p: PrismaClient | null, o: { now: Date }) => Promise<number> }) =>
          m.sweepPageExecutionLogs ? m.sweepPageExecutionLogs(db, { now }) : 0,
        )
        .catch(() => 0),
    ]);
    return { ...llm, readerFindingsDeleted, techniqueOutputsDeleted, pageLogsDeleted, individualsRecycled };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'llm cache sweep failed', error: (err as Error).message.slice(0, 200) }));
    return { skipped: 'error' };
  }
}

/** Sweep cadence (EventBridge on Lambda uses rate(45 minutes)). */
export const SWEEP_INTERVAL_MS = 45 * 60_000;

/** Sweep every 45 minutes for a long-lived server. No-op on Lambda (EventBridge drives it there) and when the cache is off. */
export function startPeriodicSweep(): ReturnType<typeof setInterval> | null {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || !explicitCacheEnabled()) return null;
  const t = setInterval(() => void runScheduledSweep(), getReadingCacheRecycleMs());
  t.unref();
  return t;
}
