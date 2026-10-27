import type { Prisma, PrismaClient } from '@prisma/client';
import { KUNDLI_JSON_FIELDS, authToAstroKundliParams } from '../lib/astroKundliClient.js';
import {
  getNodeEnv,
  getAstroKundliEndpointLabel,
  getAstroKundliTransport,
  getKundliQueueBatchSize,
  getKundliQueueMaxFetchesPerUser,
  getKundliQueueRowStaggerMs,
} from '../config/env.js';
import { ensureGeminiCacheForUser } from './geminiCacheService.js';
import { readingBuildFactsEnabled } from '../reading/config.js';
import { scheduleFactsBuild } from '../reading/data/factsBuilder.js';
import { queueLog, queueLogError } from '../lib/queueLogger.js';
import { chartDataDeps } from '../reading/chartData/tool.js';
import { fetchRegistrationItems, firstTierReady, loadRegistrationPlan, type RegistrationPlan } from '../reading/chartData/registration.js';
import type { ChartDataType } from '../reading/chartData/catalog.js';
import type { ChartItem, EnsureDeps, EnsureOptions } from '../reading/chartData/store.js';

const QUEUE_STATUS_PENDING = 'pending';
const QUEUE_STATUS_IN_PROGRESS = 'in_progress';
const QUEUE_STATUS_COMPLETED = 'completed';

/** DB columns synced via AstroKundli `KUNDLI_JSON_FIELDS` (used after status → in_progress for a fresh snapshot). */
const KUNDLI_JSON_COLUMNS_SELECT = {
  biodata: true,
  d1: true,
  d2: true,
  d4: true,
  d7: true,
  d9: true,
  d10: true,
  charakaraka: true,
  vimsottari_dasa: true,
  narayana_dasa: true,
} as const;

export type KundliStatus = 'pending' | 'building' | 'ready';

/** The web-facing progress word for a kundli queue_status (null = no kundli row yet = pending). */
export function kundliStatusFromQueue(queueStatus: string | null | undefined): KundliStatus {
  if (queueStatus === QUEUE_STATUS_COMPLETED) return 'ready';
  if (queueStatus === QUEUE_STATUS_IN_PROGRESS) return 'building';
  return 'pending';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Ensure the user has a Kundli row with queue_status = 'pending' so the queue worker will pick it up.
 * Call after login or signup. Creates a new Kundli row if none exists.
 */
export async function enqueueKundliSync(prisma: PrismaClient, userId: string): Promise<void> {
  const latest = await prisma.kundli.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
  if (latest) {
    await prisma.kundli.update({
      where: { id: latest.id },
      data: { queue_status: QUEUE_STATUS_PENDING },
    });
    return;
  }
  await prisma.kundli.create({
    data: {
      user_id: userId,
      queue_status: QUEUE_STATUS_PENDING,
    },
  });
}

type Outcome = 'passed' | 'failed' | 'error';

/**
 * Returns true if the value is considered "filled" for a Kundli JSON column
 * (non-null and, for objects, non-empty).
 */
export function isJsonFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function logAstroKundliCall(
  userId: string,
  kundliId: string,
  field: string,
  outcome: Outcome,
  durationMs: number,
  errMessage?: string
): void {
  const env = getNodeEnv();
  const payload: Record<string, unknown> = {
    event: 'astrokundli_call',
    user_id: userId,
    kundli_id: kundliId,
    field,
    outcome,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    env,
    transport: getAstroKundliTransport(),
    base_url: getAstroKundliEndpointLabel(),
  };
  if (errMessage) payload.error_message = errMessage;
  queueLog(payload);
}

/** One `astrokundli_call` line per item that went to Radha (items read from a row or legacy column made no call). */
function logRadhaCalls(userId: string, kundliId: string, types: readonly ChartDataType[], items: Record<string, ChartItem>, durationMs: number): void {
  for (const t of types) {
    const item = items[t.id];
    if (!item || (item.status === 'ready' && item.source !== 'radha')) continue;
    if (item.status === 'ready') logAstroKundliCall(userId, kundliId, t.id, 'passed', durationMs);
    else {
      const errMessage = item.error ?? item.status;
      logAstroKundliCall(userId, kundliId, t.id, errMessage.includes('HTTP') ? 'failed' : 'error', durationMs, errMessage);
    }
  }
}

/**
 * Kundlis whose post-gate pull is running in this process. A second login while it runs completes the gate (all rows
 * ready, no Radha call) and leaves the rest to the run already going, so one user never has two pulls in one process.
 * Across Lambda instances the kundli_data row lock keeps any item from being fetched twice.
 */
const restPullInFlight = new Set<string>();

async function pullRest(
  chartDeps: EnsureDeps,
  userId: string,
  kundliId: string,
  plan: RegistrationPlan,
  gateItems: Record<string, ChartItem>,
  opts: EnsureOptions,
  startAll: number,
  gateMs: number
): Promise<void> {
  if (restPullInFlight.has(kundliId)) {
    queueLog({ event: 'kundli_full_pull_already_running', user_id: userId, kundli_id: kundliId });
    return;
  }
  restPullInFlight.add(kundliId);
  let restItems: Record<string, ChartItem> = {};
  let error: string | undefined;
  try {
    restItems = await fetchRegistrationItems(chartDeps, kundliId, plan.rest, opts);
  } catch (err) {
    error = (err as Error).message?.slice(0, 500) ?? String(err);
    queueLogError({ event: 'kundli_full_pull_failed', user_id: userId, kundli_id: kundliId, error });
  } finally {
    restPullInFlight.delete(kundliId);
  }
  const wallMs = Date.now() - startAll;
  logRadhaCalls(userId, kundliId, plan.rest, restItems, wallMs - gateMs);

  // Per-user summary: how many items, how many went to Radha, and the wall time (about 1 s per Radha call).
  const all = { ...gateItems, ...restItems };
  const count = (pred: (i: ChartItem) => boolean) => plan.requested.filter((t) => all[t.id] && pred(all[t.id]!)).length;
  queueLog({
    event: 'kundli_full_pull',
    user_id: userId,
    kundli_id: kundliId,
    total_items: plan.requested.length,
    gate_items: plan.gate.length,
    rest_items: plan.rest.length,
    fetched_from_radha: count((i) => i.source === 'radha'),
    ready: count((i) => i.status === 'ready'),
    failed: count((i) => i.status === 'failed'),
    unsupported: count((i) => i.status === 'unsupported'),
    missing: plan.requested.length - count((i) => i.status === 'ready' || i.status === 'failed' || i.status === 'unsupported'),
    skipped_unserved: plan.skipped.length,
    gate_ms: gateMs,
    wall_ms: wallMs,
    ...(error ? { error } : {}),
  });
}

/**
 * Process Kundli rows (users) per run. Each row’s missing slices are fetched in chunks
 * (see KUNDLI_QUEUE_MAX_FETCHES_PER_USER). Rows are staggered by KUNDLI_QUEUE_ROW_STAGGER_MS
 * (default 2s per index) so multiple pending rows in one tick do not hammer the upstream API.
 * Rows with queue_status 'pending' are eligible. After a row is moved to 'in_progress',
 * any processing failure resets it to 'pending' so the worker can retry.
 */
export async function processKundliSyncQueue(prisma: PrismaClient, deps: KundliQueueDeps = {}): Promise<void> {
  const batchSize = getKundliQueueBatchSize();
  const rows = await prisma.kundli.findMany({
    where: {
      queue_status: QUEUE_STATUS_PENDING,
    },
    orderBy: { created_at: 'asc' },
    take: batchSize,
    include: { user: true },
  });

  queueLog({ event: 'kundli_queue_tick_start', pending_count: rows.length });

  const staggerMs = getKundliQueueRowStaggerMs();
  await Promise.all(
    rows.map((row, index) =>
      (async () => {
        if (staggerMs > 0 && index > 0) {
          await sleep(index * staggerMs);
        }
        await processOneKundliRow(prisma, row, deps);
      })()
    )
  );
}

/** Test seam: chart-data repo and Radha fetcher. Production uses Prisma and the throttled Radha client. */
export interface KundliQueueDeps {
  chart?: EnsureDeps;
}

type KundliRowWithUser = Prisma.KundliGetPayload<{ include: { user: true } }>;

async function processOneKundliRow(prisma: PrismaClient, row: KundliRowWithUser, deps: KundliQueueDeps): Promise<void> {
  const userId = row.user_id;
  const kundliId = row.id;

  try {
    await prisma.kundli.update({
      where: { id: kundliId },
      data: {
        queue_status: QUEUE_STATUS_IN_PROGRESS,
        queue_started_at: new Date(),
        last_sync_error: null,
      },
    });
  } catch (err) {
    queueLogError({
      event: 'kundli_queue_update_failed',
      kundli_id: kundliId,
      user_id: userId,
      error: (err as Error).message,
    });
    return;
  }

  const auth = row.user;
  try {
    // birth details must parse before we call Radha (ensureChartData builds its own request from the same fields)
    authToAstroKundliParams({
      date_of_birth: auth.date_of_birth,
      place_of_birth: auth.place_of_birth,
      time_of_birth: auth.time_of_birth,
    });
  } catch (err) {
    const msg = (err as Error).message;
    await prisma.kundli.update({
      where: { id: kundliId },
      data: {
        queue_status: QUEUE_STATUS_PENDING,
        queue_completed_at: null,
        last_sync_error: msg,
      },
    });
    logAstroKundliCall(userId, kundliId, 'biodata', 'error', 0, msg);
    return;
  }

  const freshKundli = await prisma.kundli.findUnique({
    where: { id: kundliId },
    select: KUNDLI_JSON_COLUMNS_SELECT,
  });
  if (!freshKundli) {
    queueLogError({
      event: 'kundli_queue_row_missing_after_in_progress',
      kundli_id: kundliId,
      user_id: userId,
      error: 'Kundli row not found after status update',
    });
    return;
  }

  try {
    // S-5 / doc 23 §4: the registration set is every served natal and annual type (never `moving`), first tier, then
    // registration, then the rest, through ensureChartData / ensureAnnualCurrent so each item is stored once in
    // kundli_data and shared with the agents. The gate (up to the last item the completion rule needs) runs first; chat
    // opens after it and the rest follows in this same run. Concurrency is the per-user cap (default 1); the Radha
    // one-request-per-second spacing lives in the default fetcher and stays on.
    const chartDeps = deps.chart ?? chartDataDeps(prisma);
    const fetchOpts = { concurrency: getKundliQueueMaxFetchesPerUser() };
    const startAll = Date.now();
    const plan = await loadRegistrationPlan(chartDeps);
    const gateItems = await fetchRegistrationItems(chartDeps, kundliId, plan.gate, fetchOpts);
    const gateMs = Date.now() - startAll;
    logRadhaCalls(userId, kundliId, plan.gate, gateItems, gateMs);
    const reg = { ...plan, items: gateItems, firstTierReady: firstTierReady(plan.firstTier, gateItems) };
    if (reg.skipped.length > 0) {
      queueLog({ event: 'kundli_registration_skipped_unserved', kundli_id: kundliId, count: reg.skipped.length, types: reg.skipped.map((t) => t.id) });
    }

    // Legacy columns: the old readers still read the ten kundlis columns, so fill the missing ones from what was just
    // fetched or read (a filled column is never overwritten). The matching kundli_data rows were already stored by
    // ensureChartData with the catalog's calc_version, so this does not write through again (that would stamp the
    // built-in 'legacy' calc_version on a new-shape dasha payload and make it look stale on the next login).
    const legacyType = new Map(reg.requested.filter((t) => t.legacyColumn).map((t) => [t.legacyColumn!, t]));
    const dataUpdate: Record<string, object> = {};
    for (const field of KUNDLI_JSON_FIELDS) {
      if (isJsonFieldFilled((freshKundli as Record<string, unknown>)[field])) continue;
      const t = legacyType.get(field);
      const item = t ? reg.items[t.id] : undefined;
      if (item?.status === 'ready' && isJsonFieldFilled(item.payload)) dataUpdate[field] = item.payload as object;
    }
    if (Object.keys(dataUpdate).length > 0) {
      try {
        await prisma.kundli.update({
          where: { id: kundliId },
          data: dataUpdate,
        });
      } catch (updateErr) {
        const persistMsg = (updateErr as Error).message;
        for (const field of Object.keys(dataUpdate)) {
          logAstroKundliCall(userId, kundliId, field, 'error', Date.now() - startAll, persistMsg);
        }
        await prisma.kundli.update({
          where: { id: kundliId },
          data: {
            queue_status: QUEUE_STATUS_PENDING,
            queue_completed_at: null,
            last_sync_error: `Kundli persist failed: ${persistMsg}`,
          },
        });
        return;
      }
    }

    const updatedRow = await prisma.kundli.findUnique({
      where: { id: kundliId },
      select: KUNDLI_JSON_COLUMNS_SELECT,
    });
    const allFieldsFilled = Boolean(updatedRow) && KUNDLI_JSON_FIELDS.every(
      (field) => isJsonFieldFilled((updatedRow as Record<string, unknown>)[field])
    );

    // Completed when every legacy column is filled (existing rule) and every served first-tier type is ready.
    if (allFieldsFilled && reg.firstTierReady) {
      await prisma.auth.update({
        where: { id: userId },
        data: { kundli_added: true },
      });
      await prisma.kundli.update({
        where: { id: kundliId },
        data: {
          queue_status: QUEUE_STATUS_COMPLETED,
          queue_completed_at: new Date(),
        },
      });
      void ensureGeminiCacheForUser(prisma, userId).catch((err) => {
        console.error('ensureGeminiCacheForUser after kundli complete failed:', (err as Error).message);
      });
      if (readingBuildFactsEnabled()) scheduleFactsBuild(prisma, kundliId);

      // Chat is open; pull everything else Radha serves. A failure here is logged, never undoes the completion: rows
      // that did not land stay missing/failed and the next run (next login) resumes from them.
      await pullRest(chartDeps, userId, kundliId, plan, gateItems, fetchOpts, startAll, gateMs);
    } else {
      queueLog({
        event: 'kundli_partial_sync',
        user_id: userId,
        kundli_id: kundliId,
        legacy_columns_filled: allFieldsFilled,
        first_tier_ready: reg.firstTierReady,
        message: 'Not all data points filled; queue_status reset to pending for retry.',
      });
      await prisma.kundli.update({
        where: { id: kundliId },
        data: {
          queue_status: QUEUE_STATUS_PENDING,
          queue_completed_at: null,
          last_sync_error: 'Partial sync; missing data points will be retried on next run.',
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    queueLogError({
      event: 'kundli_queue_row_processing_failed',
      kundli_id: kundliId,
      user_id: userId,
      error: msg,
    });
    try {
      await prisma.kundli.update({
        where: { id: kundliId },
        data: {
          queue_status: QUEUE_STATUS_PENDING,
          queue_completed_at: null,
          last_sync_error: msg,
        },
      });
    } catch (revertErr) {
      queueLogError({
        event: 'kundli_queue_revert_to_pending_failed',
        kundli_id: kundliId,
        user_id: userId,
        error: (revertErr as Error).message,
      });
    }
  }
}
