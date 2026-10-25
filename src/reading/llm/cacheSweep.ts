/**
 * Entry points for the LLM cache sweeper (promptCache.ts `sweepLlmCaches`; docs/reading-engine/19 §cache, R-7):
 * - Lambda: an EventBridge scheduled event reaches Express through the Lambda Web Adapter pass-through path
 *   (POST /events, AWS_LWA_PASS_THROUGH_PATH). `isCacheSweepEvent` recognises it; `runScheduledSweep` runs it.
 * - Long-lived server (not Lambda): `startHourlySweep` runs it every hour on an unref'd timer.
 * - CLI: `npm run cache:sweep` (scripts/cache-sweep.ts).
 */
import { explicitCacheEnabled, sweepLlmCaches, type SweepResult } from './promptCache.js';

export const SWEEP_TASK = 'llm-cache-sweep';
const MIN_GAP_MS = 5 * 60_000;
let lastRunAt = 0;

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

/** Runs one sweep unless one ran on this instance in the last 5 minutes. Never throws. */
export async function runScheduledSweep(): Promise<SweepResult | { skipped: string }> {
  if (Date.now() - lastRunAt < MIN_GAP_MS) return { skipped: 'ran recently' };
  lastRunAt = Date.now();
  try {
    return await sweepLlmCaches();
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'llm cache sweep failed', error: (err as Error).message.slice(0, 200) }));
    return { skipped: 'error' };
  }
}

/** Hourly sweep for a long-lived server. No-op on Lambda (EventBridge drives it there) and when the cache is off. */
export function startHourlySweep(): ReturnType<typeof setInterval> | null {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || !explicitCacheEnabled()) return null;
  const t = setInterval(() => void runScheduledSweep(), 60 * 60_000);
  t.unref();
  return t;
}
