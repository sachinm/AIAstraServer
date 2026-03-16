import type { Prisma, PrismaClient } from '@prisma/client';
import {
  KUNDLI_JSON_FIELDS,
  type KundliJsonField,
  fetchHoroscopeChart,
  authToAstroKundliParams,
} from '../lib/astroKundliClient.js';
import { getNodeEnv, getAstroKundliBaseUrl, getKundliQueueBatchSize, getKundliQueueMaxFetchesPerUser } from '../config/env.js';
import { queueLog, queueLogError } from '../lib/queueLogger.js';

const QUEUE_STATUS_PENDING = 'pending';
const QUEUE_STATUS_IN_PROGRESS = 'in_progress';
const QUEUE_STATUS_COMPLETED = 'completed';


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
  field: KundliJsonField,
  outcome: Outcome,
  durationMs: number,
  errMessage?: string
): void {
  const env = getNodeEnv();
  const baseUrl = getAstroKundliBaseUrl();
  const payload: Record<string, unknown> = {
    event: 'astrokundli_call',
    user_id: userId,
    kundli_id: kundliId,
    field,
    outcome,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    env,
    base_url: baseUrl,
  };
  if (errMessage) payload.error_message = errMessage;
  queueLog(payload);
}

/**
 * Process Kundli rows (users) per run. For each row we fetch missing data points in
 * chunks to cap concurrent AstroKundli API calls. Peak concurrency = batch size ×
 * max fetches per user (see env: KUNDLI_QUEUE_BATCH_SIZE, KUNDLI_QUEUE_MAX_FETCHES_PER_USER).
 * Rows with queue_status 'pending' or 'in_progress' are eligible (in_progress = retry partial).
 */
export async function processKundliSyncQueue(prisma: PrismaClient): Promise<void> {
  const batchSize = getKundliQueueBatchSize();
  const rows = await prisma.kundli.findMany({
    where: {
      queue_status: { in: [QUEUE_STATUS_PENDING, QUEUE_STATUS_IN_PROGRESS] },
    },
    orderBy: { created_at: 'asc' },
    take: batchSize,
    include: { user: true },
  });

  queueLog({ event: 'kundli_queue_tick_start', pending_count: rows.length });

  await Promise.all(rows.map((row) => processOneKundliRow(prisma, row)));
}

type KundliRowWithUser = Prisma.KundliGetPayload<{ include: { user: true } }>;

async function processOneKundliRow(prisma: PrismaClient, row: KundliRowWithUser): Promise<void> {
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
  let params: ReturnType<typeof authToAstroKundliParams>;
  try {
    params = authToAstroKundliParams({
      date_of_birth: auth.date_of_birth,
      place_of_birth: auth.place_of_birth,
      time_of_birth: auth.time_of_birth,
    });
  } catch (err) {
    const msg = (err as Error).message;
    await prisma.kundli.update({
      where: { id: kundliId },
      data: {
        queue_status: QUEUE_STATUS_IN_PROGRESS,
        queue_completed_at: null,
        last_sync_error: msg,
      },
    });
    logAstroKundliCall(userId, kundliId, 'biodata', 'error', 0, msg);
    return;
  }

  const missingFields = KUNDLI_JSON_FIELDS.filter(
    (field) => !isJsonFieldFilled((row as Record<string, unknown>)[field])
  ) as KundliJsonField[];

  if (missingFields.length === 0) {
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
    return;
  }

  // Fetch missing data points in chunks to cap concurrent API calls (avoid overwhelming server).
  const maxConcurrent = getKundliQueueMaxFetchesPerUser();
  const startAll = Date.now();
  const updates: Partial<Record<KundliJsonField, unknown>> = {};
  for (let i = 0; i < missingFields.length; i += maxConcurrent) {
    const chunk = missingFields.slice(i, i + maxConcurrent);
    const results = await Promise.allSettled(
      chunk.map((field) => fetchHoroscopeChart(params, field))
    );
    const durationMs = Date.now() - startAll;
    results.forEach((result, j) => {
      const field = chunk[j];
      if (result.status === 'fulfilled') {
        updates[field] = result.value;
        logAstroKundliCall(userId, kundliId, field, 'passed', durationMs);
      } else {
        const errMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        const outcome = errMessage.includes('HTTP') ? 'failed' : 'error';
        logAstroKundliCall(userId, kundliId, field, outcome, durationMs, errMessage);
      }
    });
  }
  const durationMs = Date.now() - startAll;

  // Persist all fetched fields in one update (parallel-friendly, single DB round-trip).
  const dataUpdate = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  ) as Record<string, object>;
  if (Object.keys(dataUpdate).length > 0) {
    try {
      await prisma.kundli.update({
        where: { id: kundliId },
        data: dataUpdate,
      });
    } catch (updateErr) {
      for (const field of Object.keys(dataUpdate)) {
        logAstroKundliCall(
          userId,
          kundliId,
          field as KundliJsonField,
          'error',
          durationMs,
          (updateErr as Error).message
        );
      }
    }
  }

  const updatedRow = await prisma.kundli.findUnique({
    where: { id: kundliId },
    select: {
      biodata: true,
      d1: true,
      d7: true,
      d9: true,
      d10: true,
      charakaraka: true,
      vimsottari_dasa: true,
      narayana_dasa: true,
    },
  });
  const allFieldsFilled = updatedRow && KUNDLI_JSON_FIELDS.every(
    (field) => isJsonFieldFilled((updatedRow as Record<string, unknown>)[field])
  );

  // Only mark completed when all 8 Kundli data points are filled from AstroKundli.
  if (allFieldsFilled) {
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
  } else {
    queueLog({
      event: 'kundli_partial_sync',
      user_id: userId,
      kundli_id: kundliId,
      message: 'Not all data points filled; queue_status stays in_progress for retry.',
    });
    await prisma.kundli.update({
      where: { id: kundliId },
      data: {
        queue_status: QUEUE_STATUS_IN_PROGRESS,
        queue_completed_at: null,
        last_sync_error: 'Partial sync; missing data points will be retried on next run.',
      },
    });
  }
}
