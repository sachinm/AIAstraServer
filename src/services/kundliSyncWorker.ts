/**
 * Background chart pull (docs/reading-engine/31): the registration-set pull runs in its own Lambda invocation instead of
 * the request that triggered it, so the chart is built while the user is not logged in.
 *
 * - `scheduleKundliSync(kundliId)`: after signup / completeProfile / a birth-details change. Invokes this same Lambda
 *   asynchronously (InvocationType 'Event') with a `kundli-sync` event. Off Lambda, or when the invoke fails, it falls
 *   back to the old in-process queue run. It never waits for the pull.
 * - `POST /events` (Lambda Web Adapter pass-through) hands both event kinds to `handleKundliSyncEvent`:
 *     { source: 'aiastra', 'detail-type': 'kundli-sync', detail: { kundliId, token } }   one kundli
 *     { detail: { task: 'kundli-sync-sweep', token } }                                     EventBridge rule, every 15 min
 * - A lease on `kundlis.queue_started_at` (atomic conditional update) keeps two workers off one kundli; the kundli_data
 *   row lock in ensureChartData still keeps any single item from being fetched twice.
 * - An elapsed-time budget (KUNDLI_SYNC_MAX_MS, default 12 min) stops a long pull between chunks; the worker then
 *   re-invokes itself for the rest. Ready rows are read, not fetched, so every run resumes from the first missing item.
 * Nothing here computes astrology; Radha is reached only through ensureChartData.
 */
import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { getKundliSyncEventToken, getKundliSyncMaxMs, getKundliSyncSweepBatch, getReadingClocks, getSelfV2PressureMaxAgeDays, getSelfV2PressureRetryHours } from '../config/env.js';
import { queueLog, queueLogError } from '../lib/queueLogger.js';
import { chartDataDeps } from '../reading/chartData/tool.js';
import { loadRegistrationPlan, type RegistrationPlan } from '../reading/chartData/registration.js';
import { CURRENT_VARIANT } from '../reading/chartData/store.js';
import { readingBuildFactsEnabled } from '../reading/config.js';
import { buildFactsForKundli } from '../reading/data/factsBuilder.js';
import { enqueueKundliSync, processKundliSyncQueue, processOneKundliRow, type KundliQueueDeps, type KundliRowWithUser } from './kundliQueueService.js';

export const KUNDLI_SYNC_SOURCE = 'aiastra';
export const KUNDLI_SYNC_DETAIL_TYPE = 'kundli-sync';
export const KUNDLI_SYNC_SWEEP_TASK = 'kundli-sync-sweep';

/** Extra lease time over the budget: one chunk that started just before the deadline may still be running. */
export const LEASE_MARGIN_MS = 3 * 60_000;
/** The sweep leaves a kundli whose only open items failed less than this long ago (a broken type would starve the batch). */
export const SWEEP_FAILED_RETRY_MS = 6 * 3_600_000;
/** The Invoke API call (not the pull) is awaited at most this long by the request that schedules it. */
const INVOKE_TIMEOUT_MS = 2_000;
/** When the invoke fails on Lambda, the request itself pulls the gate for at most this long. */
const FALLBACK_GATE_MS = 15_000;
const FALLBACK_CONCURRENCY = 4;
/** A polling client restarts a stalled build at most this often, per kundli owner, per container. */
const RESUME_COOLDOWN_MS = 60_000;
const KUNDLI_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export type KundliSyncEvent = { kind: 'sync'; kundliId: string } | { kind: 'sweep' };

/**
 * The token is mandatory (docs/privacy/02 B0.2): with KUNDLI_SYNC_EVENT_TOKEN unset no event is accepted, because
 * `/events` is reachable by anything that can call the function.
 */
function tokenOk(given: unknown): boolean {
  const want = getKundliSyncEventToken();
  if (!want) return false;
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recognises the two worker events. Returns null for anything else (the cache sweeper's event included), for a
 * matching event whose `detail.token` does not equal KUNDLI_SYNC_EVENT_TOKEN, and for every event when that is unset.
 */
export function parseKundliSyncEvent(body: unknown): KundliSyncEvent | null {
  const b = body as { source?: unknown; 'detail-type'?: unknown; detail?: { kundliId?: unknown; task?: unknown; token?: unknown } } | null;
  if (!b || typeof b !== 'object' || !b.detail || typeof b.detail !== 'object') return null;
  if (b.source === KUNDLI_SYNC_SOURCE && b['detail-type'] === KUNDLI_SYNC_DETAIL_TYPE) {
    const id = b.detail.kundliId;
    if (typeof id !== 'string' || !KUNDLI_ID_RE.test(id) || !tokenOk(b.detail.token)) return null;
    return { kind: 'sync', kundliId: id };
  }
  if (b.detail.task === KUNDLI_SYNC_SWEEP_TASK) return tokenOk(b.detail.token) ? { kind: 'sweep' } : null;
  return null;
}

/** The event this Lambda sends itself for one kundli. */
export function kundliSyncEventPayload(kundliId: string): Record<string, unknown> {
  return { source: KUNDLI_SYNC_SOURCE, 'detail-type': KUNDLI_SYNC_DETAIL_TYPE, detail: { kundliId, token: getKundliSyncEventToken() ?? '' } };
}

let lambdaClient: LambdaClient | null = null;
function client(): LambdaClient {
  return (lambdaClient ??= new LambdaClient({}));
}

/**
 * Invoke this same Lambda asynchronously with a kundli-sync event. True when Lambda accepted it (202). False when not on
 * Lambda (no AWS_LAMBDA_FUNCTION_NAME) or the call failed; never throws.
 */
export async function invokeKundliSyncAsync(kundliId: string): Promise<boolean> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  if (!functionName) return false;
  // an event without the token would be refused by the worker: take the gate-only fallback instead of losing the build
  if (!getKundliSyncEventToken()) {
    queueLogError({ event: 'kundli_sync_token_missing', kundli_id: kundliId });
    return false;
  }
  try {
    const out = await client().send(
      new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(kundliSyncEventPayload(kundliId))) }),
      { abortSignal: AbortSignal.timeout(INVOKE_TIMEOUT_MS) }
    );
    if (out.StatusCode !== undefined && out.StatusCode !== 202) throw new Error(`unexpected StatusCode ${out.StatusCode}`);
    queueLog({ event: 'kundli_sync_invoked', kundli_id: kundliId });
    return true;
  } catch (err) {
    queueLogError({ event: 'kundli_sync_invoke_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 300) });
    return false;
  }
}

export interface ScheduleDeps {
  prisma?: PrismaClient;
  queue?: KundliQueueDeps;
}

/**
 * Start the background pull for one kundli. On Lambda: an async self-invoke (the pull then runs in its own invocation,
 * up to the Lambda timeout, whether or not the user is still connected). When that invoke fails on Lambda: the gate only,
 * awaited under a short deadline, because anything left running would freeze with the container; the sweep does the rest.
 * Off Lambda or with no kundliId: the old in-process queue run, not awaited. Only the Invoke API call is awaited in the
 * normal case (capped at 2 s). Never throws.
 */
export async function scheduleKundliSync(kundliId: string | null | undefined, deps: ScheduleDeps = {}): Promise<'invoked' | 'gate_sync' | 'in_process'> {
  if (kundliId && (await invokeKundliSyncAsync(kundliId))) return 'invoked';
  try {
    const prisma = deps.prisma ?? (await import('../lib/prisma.js')).prisma;
    if (kundliId && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const row = (await prisma.kundli.findUnique({ where: { id: kundliId }, include: { user: true } })) as KundliRowWithUser | null;
      const gate = row && (await processOneKundliRow(prisma, row, deps.queue ?? {}, { gateOnly: true, concurrency: FALLBACK_CONCURRENCY, deadline: Date.now() + FALLBACK_GATE_MS }));
      queueLog({ event: 'kundli_sync_fallback_sync', kundli_id: kundliId, gate_complete: gate?.gateComplete ?? false });
      return 'gate_sync';
    }
    void processKundliSyncQueue(prisma, deps.queue).catch((err) => {
      console.error('processKundliSyncQueue (in-process fallback) failed:', (err as Error).message);
    });
  } catch (err) {
    console.error('scheduleKundliSync fallback failed:', (err as Error).message);
  }
  return 'in_process';
}

const lastResumeAt = new Map<string, number>();

/**
 * Restart a build that is not running, for a client that found the chart incomplete (`me`, `meDetails`, chat). The lease
 * still decides who runs, so a build in progress is left alone. `force` is the Retry button: it skips the cooldown and
 * clears the last error so the client stops showing `failed`. Never throws.
 */
export async function resumeChartBuild(prisma: PrismaClient, userId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  if (!opts.force && Date.now() - (lastResumeAt.get(userId) ?? 0) < RESUME_COOLDOWN_MS) return false;
  lastResumeAt.set(userId, Date.now());
  try {
    const kundliId = await enqueueKundliSync(prisma, userId);
    if (opts.force && kundliId) await prisma.kundli.update({ where: { id: kundliId }, data: { last_sync_error: null } });
    await scheduleKundliSync(kundliId, { prisma });
    return true;
  } catch (err) {
    queueLogError({ event: 'kundli_sync_resume_failed', user_id: userId, error: (err as Error).message?.slice(0, 300) });
    return false;
  }
}

/** Take the worker lease on a kundli: set queue_started_at when it is empty or older than the lease. Null = held. */
export async function acquireLease(prisma: PrismaClient, kundliId: string, now: number, leaseMs: number): Promise<Date | null> {
  const leaseAt = new Date(now);
  const r = await prisma.kundli.updateMany({
    where: { id: kundliId, OR: [{ queue_started_at: null }, { queue_started_at: { lt: new Date(now - leaseMs) } }] },
    data: { queue_started_at: leaseAt },
  });
  return r.count > 0 ? leaseAt : null;
}

/** Release only our own lease (compare-and-set on the timestamp we wrote). */
export async function releaseLease(prisma: PrismaClient, kundliId: string, leaseAt: Date): Promise<void> {
  await prisma.kundli.updateMany({ where: { id: kundliId, queue_started_at: leaseAt }, data: { queue_started_at: null } });
}

export interface WorkerDeps {
  prisma: PrismaClient;
  queue?: KundliQueueDeps;
  now?: () => number;
  maxMs?: number;
  /** Self re-invoke; default invokeKundliSyncAsync */
  invoke?: (kundliId: string) => Promise<boolean>;
  /** The reading clock set's inventories (doc 70 §4.1); default ensurePressureInventories. Never throws. */
  ensurePressure?: (prisma: PrismaClient, kundliId: string, asOf: string) => Promise<unknown>;
}

/**
 * Time that must be left in the run's budget before the clock set's inventories are pulled. The pulls run in parallel,
 * each limited to SELF_V2_PRESSURE_TIMEOUT_MS (15 s); the engine client spaces calls about 1 s apart in this process, so
 * four pulls end within about 19 s. The run's budget is KUNDLI_SYNC_MAX_MS (12 min) and a sweep runs at most
 * KUNDLI_SYNC_SWEEP_BATCH (5) kundlis one after another under that one budget, so the pulls add at most about 1.6 min
 * to a full sweep. With less than this left, the pull is left to the next run or to the build.
 */
export const PRESSURE_PULL_MIN_LEFT_MS = 30_000;

/**
 * The clock set's inventories, then the slices rendered from them (doc 70 §4.1 layers 0 and 1, §7 step 3): one slice
 * set per kundli, written only where a hash changed. The slices are free (code); a failure is logged, never thrown.
 */
async function defaultEnsurePressure(prisma: PrismaClient, kundliId: string, asOf: string): Promise<unknown> {
  const { ensurePressureInventories } = await import('../reading/self/sub/pressure.js');
  const r = await ensurePressureInventories(prisma, kundliId, asOf);
  queueLog({ event: 'kundli_sync_pressure', kundli_id: kundliId, clocks: r.clocks.map((c) => `${c.system}:${c.source}:${c.rows}`), gaps: r.gaps.length });
  if (r.set) {
    const { writeSlicesAtSync } = await import('../reading/slices/prepare.js');
    const s = await writeSlicesAtSync(prisma, kundliId, asOf, r.set);
    queueLog({ event: 'kundli_sync_slices', kundli_id: kundliId, slices: s.slices, written: s.written.length, unchanged: s.read.length, failed: s.failed.length, gaps: s.gaps.slice(0, 3) });
  }
  return r;
}

/**
 * Kundlis (each user's latest, active, not leased, digest ready) whose clock set is not settled: fewer pressure
 * inventories than the set pulls (READING_CLOCKS minus the year) are either ready and fresh (younger than
 * SELF_V2_PRESSURE_MAX_AGE_DAYS) or failed within SELF_V2_PRESSURE_RETRY_HOURS. A kundli synced before the clock set
 * existed, or whose rows went stale, is picked here (docs/TODOS.md, doc 70). Oldest settled pull first.
 */
// Raw SQL reviewed for docs/privacy/02 B1.3: ids, status and timestamp columns only.
export async function findKundlisMissingClocks(prisma: PrismaClient, batch: number, leaseMs: number): Promise<string[]> {
  const leaseSecs = Math.ceil(leaseMs / 1000);
  const maxAgeSecs = getSelfV2PressureMaxAgeDays() * 86_400;
  const retrySecs = getSelfV2PressureRetryHours() * 3_600;
  const want = Math.max(1, getReadingClocks() - 1);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT k."id" FROM "kundlis" k
    JOIN "auth" a ON a."id" = k."user_id"
    WHERE a."is_active" IS DISTINCT FROM false
      AND k."digest_status" = 'ready'
      AND k."id" = (SELECT k2."id" FROM "kundlis" k2 WHERE k2."user_id" = k."user_id" ORDER BY k2."created_at" DESC LIMIT 1)
      AND (k."queue_started_at" IS NULL OR k."queue_started_at" < now() - make_interval(secs => ${leaseSecs}))
      AND (
        SELECT count(*) FROM "kundli_data" d
        WHERE d."kundli_id" = k."id" AND d."data_type" = 'pressure_inventory'
          AND ((d."status" = 'ready' AND d."fetched_at" > now() - make_interval(secs => ${maxAgeSecs}))
            OR (d."status" = 'failed' AND d."fetch_started_at" > now() - make_interval(secs => ${retrySecs})))
      ) < ${want}
    ORDER BY (SELECT max(d2."fetched_at") FROM "kundli_data" d2 WHERE d2."kundli_id" = k."id" AND d2."data_type" = 'pressure_inventory') ASC NULLS FIRST
    LIMIT ${batch}`;
  return rows.map((r) => r.id);
}

/** The clock set's pulls for one kundli the sweep picked, under its lease. Never throws. */
export async function runClockSetPull(deps: WorkerDeps, kundliId: string): Promise<'pulled' | 'lease held' | 'error'> {
  const now = deps.now ?? Date.now;
  const maxMs = deps.maxMs ?? getKundliSyncMaxMs();
  let leaseAt: Date | null = null;
  try {
    leaseAt = await acquireLease(deps.prisma, kundliId, now(), maxMs + LEASE_MARGIN_MS);
    if (!leaseAt) return 'lease held';
    await (deps.ensurePressure ?? defaultEnsurePressure)(deps.prisma, kundliId, new Date(now()).toISOString().slice(0, 10));
    return 'pulled';
  } catch (err) {
    queueLogError({ event: 'kundli_sync_clock_pull_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 300) });
    return 'error';
  } finally {
    if (leaseAt) await releaseLease(deps.prisma, kundliId, leaseAt).catch(() => undefined);
  }
}

export type KundliSyncOutcome =
  | { kundliId: string; status: 'skipped'; reason: 'lease held' | 'not found' }
  | { kundliId: string; status: 'ran'; gateComplete: boolean; more: boolean; reinvoked: boolean }
  | { kundliId: string; status: 'error'; error: string };

/**
 * One kundli: lease, gate + rest under the budget (deadline = startedAt + maxMs), release, and when the budget stopped
 * it with items not started, an async self re-invoke for the rest. Never throws.
 */
export async function runKundliSync(deps: WorkerDeps, kundliId: string, startedAt?: number): Promise<KundliSyncOutcome> {
  const now = deps.now ?? Date.now;
  const maxMs = deps.maxMs ?? getKundliSyncMaxMs();
  const deadline = (startedAt ?? now()) + maxMs;
  let leaseAt: Date | null = null;
  try {
    leaseAt = await acquireLease(deps.prisma, kundliId, now(), maxMs + LEASE_MARGIN_MS);
    if (!leaseAt) {
      queueLog({ event: 'kundli_sync_skipped_lease', kundli_id: kundliId });
      return { kundliId, status: 'skipped', reason: 'lease held' };
    }
    const row = (await deps.prisma.kundli.findUnique({ where: { id: kundliId }, include: { user: true } })) as KundliRowWithUser | null;
    if (!row) return { kundliId, status: 'skipped', reason: 'not found' };
    const result = await processOneKundliRow(deps.prisma, row, deps.queue ?? {}, { deadline, leaseAt });
    // doc 70 §4.1 layer 0: the clock set's dated rows, under the lease, only when the chart is complete and time is left
    if (result.gateComplete && !result.more && deadline - now() >= PRESSURE_PULL_MIN_LEFT_MS) {
      const asOf = new Date(now()).toISOString().slice(0, 10);
      await (deps.ensurePressure ?? defaultEnsurePressure)(deps.prisma, kundliId, asOf).catch((err: Error) =>
        queueLogError({ event: 'kundli_sync_pressure_failed', kundli_id: kundliId, error: err?.message?.slice(0, 300) }),
      );
    }
    await releaseLease(deps.prisma, kundliId, leaseAt);
    leaseAt = null;
    let reinvoked = false;
    if (result.more) {
      reinvoked = await (deps.invoke ?? invokeKundliSyncAsync)(kundliId);
      // not re-invoked (off Lambda or the call failed): the sweep picks the kundli up again
      queueLog({ event: 'kundli_sync_budget_reached', kundli_id: kundliId, reinvoked, max_ms: maxMs });
    }
    return { kundliId, status: 'ran', gateComplete: result.gateComplete, more: result.more, reinvoked };
  } catch (err) {
    const error = (err as Error).message?.slice(0, 300) ?? String(err);
    queueLogError({ event: 'kundli_sync_failed', kundli_id: kundliId, error });
    return { kundliId, status: 'error', error };
  } finally {
    if (leaseAt) await releaseLease(deps.prisma, kundliId, leaseAt).catch(() => undefined);
  }
}

/** The (data_type, variant, calc_version) rows a complete registration set has: natal '' rows and annual 'current' pointers. */
export function sweepWantList(plan: Pick<RegistrationPlan, 'requested'>): { ids: string[]; variants: string[]; versions: (string | null)[] } {
  return {
    ids: plan.requested.map((t) => t.id),
    variants: plan.requested.map((t) => (t.variantKind === 'year' ? CURRENT_VARIANT : '')),
    versions: plan.requested.map((t) => t.calcVersion ?? null),
  };
}

/**
 * Kundlis (each user's latest, active users only) with at least one registration-set row missing or stale, not leased,
 * oldest first; kundlis whose last run ended in an error go after the rest so a bad one cannot starve the batch. The
 * "settled" test mirrors ensureChartData's needsFetch, except that failed rows wait SWEEP_FAILED_RETRY_MS.
 */
export async function findIncompleteKundlis(prisma: PrismaClient, plan: Pick<RegistrationPlan, 'requested'>, batch: number, leaseMs: number, ayanamsa = 'LAHIRI'): Promise<string[]> {
  const { ids, variants, versions } = sweepWantList(plan);
  if (ids.length === 0) return [];
  const leaseSecs = Math.ceil(leaseMs / 1000);
  const failedSecs = Math.ceil(SWEEP_FAILED_RETRY_MS / 1000);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT k."id" FROM "kundlis" k
    JOIN "auth" a ON a."id" = k."user_id"
    WHERE a."is_active" IS DISTINCT FROM false
      AND k."id" = (SELECT k2."id" FROM "kundlis" k2 WHERE k2."user_id" = k."user_id" ORDER BY k2."created_at" DESC LIMIT 1)
      AND (k."queue_started_at" IS NULL OR k."queue_started_at" < now() - make_interval(secs => ${leaseSecs}))
      AND (
        SELECT count(*) FROM unnest(${ids}::text[], ${variants}::text[], ${versions}::text[]) AS w("data_type", "variant", "calc_version")
        JOIN "kundli_data" d ON d."kundli_id" = k."id" AND d."data_type" = w."data_type" AND d."variant" = w."variant" AND d."ayanamsa" = ${ayanamsa}
        WHERE (d."status" = 'ready' AND (w."calc_version" IS NULL OR d."calc_version" = w."calc_version") AND (d."valid_to" IS NULL OR d."valid_to" > now()))
           OR (d."status" = 'fetching' AND d."fetch_started_at" > now() - interval '90 seconds')
           OR (d."status" = 'failed' AND d."fetched_at" > now() - make_interval(secs => ${failedSecs}))
           OR (d."status" = 'unsupported' AND d."fetched_at" > now() - interval '24 hours')
      ) < ${ids.length}
    ORDER BY (k."last_sync_error" IS NOT NULL), k."created_at" ASC
    LIMIT ${batch}`;
  return rows.map((r) => r.id);
}

/**
 * Kundlis with chat open whose dossier never landed (a fallback run, a crash, a Radha failure). Random order, so kundlis
 * that keep failing cannot hold every slot. `unsupported` is left out: chat retries it when someone asks a question.
 */
// Raw SQL reviewed for docs/privacy/02 B1.3 (tests/unit/rawSqlAllowList.test.ts): these two sweeps read only ids and
// plain status, lock and timestamp columns; `last_sync_error IS NOT NULL` gives the same answer sealed or plain.
export async function findKundlisMissingFacts(prisma: PrismaClient, batch: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT k."id" FROM "kundlis" k
    JOIN "auth" a ON a."id" = k."user_id"
    WHERE a."is_active" IS DISTINCT FROM false
      AND a."kundli_added" = true
      AND k."facts_status" IN ('pending', 'building', 'failed')
      AND k."id" = (SELECT k2."id" FROM "kundlis" k2 WHERE k2."user_id" = k."user_id" ORDER BY k2."created_at" DESC LIMIT 1)
    ORDER BY random()
    LIMIT ${batch}`;
  return rows.map((r) => r.id);
}

export interface SweepResult {
  candidates: number;
  outcomes: KundliSyncOutcome[];
  stoppedForBudget: boolean;
}

/**
 * The scheduled sweep: the oldest incomplete kundlis (KUNDLI_SYNC_SWEEP_BATCH), one after another under one budget, so
 * Radha's one-request-per-second spacing in this process holds. A kundli the budget cuts short re-invokes itself; the
 * kundlis not reached wait for the next sweep. Never throws.
 */
export async function runKundliSyncSweep(
  deps: WorkerDeps & { batch?: number; find?: typeof findIncompleteKundlis; findFacts?: typeof findKundlisMissingFacts; findClocks?: typeof findKundlisMissingClocks; deepSweep?: (prisma: PrismaClient) => Promise<unknown> },
): Promise<SweepResult> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const maxMs = deps.maxMs ?? getKundliSyncMaxMs();
  const outcomes: KundliSyncOutcome[] = [];
  let ids: string[] = [];
  try {
    const plan = await loadRegistrationPlan(deps.queue?.chart ?? chartDataDeps(deps.prisma));
    ids = await (deps.find ?? findIncompleteKundlis)(deps.prisma, plan, deps.batch ?? getKundliSyncSweepBatch(), maxMs + LEASE_MARGIN_MS);
  } catch (err) {
    queueLogError({ event: 'kundli_sync_sweep_failed', error: (err as Error).message?.slice(0, 300) });
    return { candidates: 0, outcomes, stoppedForBudget: false };
  }
  queueLog({ event: 'kundli_sync_sweep_start', candidates: ids.length });
  let stoppedForBudget = false;
  for (const id of ids) {
    if (now() >= startedAt + maxMs) {
      stoppedForBudget = true;
      break;
    }
    const o = await runKundliSync(deps, id, startedAt);
    outcomes.push(o);
    if (o.status === 'ran' && o.more) {
      stoppedForBudget = true;
      break;
    }
  }
  let factsTried = 0;
  if (readingBuildFactsEnabled() && !stoppedForBudget) {
    try {
      const missing = await (deps.findFacts ?? findKundlisMissingFacts)(deps.prisma, deps.batch ?? getKundliSyncSweepBatch());
      for (const id of missing) {
        if (now() >= startedAt + maxMs) break;
        await buildFactsForKundli(deps.prisma, id);
        factsTried += 1;
      }
    } catch (err) {
      queueLogError({ event: 'kundli_sync_sweep_facts_failed', error: (err as Error).message?.slice(0, 300) });
    }
  }
  // doc 70 §4.1 layer 0: complete kundlis whose clock set is missing or stale get their pulls (and slices) here
  let clocksPulled = 0;
  if (!stoppedForBudget) {
    try {
      const missing = await (deps.findClocks ?? findKundlisMissingClocks)(deps.prisma, deps.batch ?? getKundliSyncSweepBatch(), maxMs + LEASE_MARGIN_MS);
      for (const id of missing) {
        if (startedAt + maxMs - now() < PRESSURE_PULL_MIN_LEFT_MS) break;
        if ((await runClockSetPull(deps, id)) === 'pulled') clocksPulled += 1;
      }
    } catch (err) {
      queueLogError({ event: 'kundli_sync_sweep_clocks_failed', error: (err as Error).message?.slice(0, 300) });
    }
  }
  // the deep dasha levels' weekly roll (docs/reading-engine/67): invokes the worker for focused kundlis, never pulls here
  if (!stoppedForBudget) {
    await (deps.deepSweep ?? ((p: PrismaClient) => import('../workers/dashaDeepFocus.js').then((m) => m.runDashaDeepSweep(p))))(deps.prisma).catch((err: Error) =>
      queueLogError({ event: 'dasha_deep_sweep_failed', error: err.message?.slice(0, 300) }),
    );
  }
  queueLog({ event: 'kundli_sync_sweep_done', candidates: ids.length, processed: outcomes.length, facts_tried: factsTried, clocks_pulled: clocksPulled, stopped_for_budget: stoppedForBudget });
  return { candidates: ids.length, outcomes, stoppedForBudget };
}

/** POST /events entry: runs the event to the end (the invocation lives until the response is sent). */
export async function handleKundliSyncEvent(event: KundliSyncEvent, deps: WorkerDeps): Promise<KundliSyncOutcome | SweepResult> {
  return event.kind === 'sync' ? runKundliSync(deps, event.kundliId) : runKundliSyncSweep(deps);
}
