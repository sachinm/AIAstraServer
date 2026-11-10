/**
 * API side of the dasha-deep worker (docs/reading-engine/67): the focus trigger and the sweep step. Neither pulls
 * anything from the engine; both only invoke the worker Lambda named by DASHA_DEEP_WORKER_FUNCTION asynchronously
 * (InvocationType 'Event'). With the env var unset (local, tests, before the function exists) both are no-ops, logged
 * once per process, and never fall back to an inline pull.
 *
 * - Focus: a signed-in person opens Today, Lucky times, a board or chat. `withDashaDeepFocus` wraps the routes'
 *   `requireUser`, so after authentication it fires `noteDashaDeepFocus` without awaiting it. At most once per user and
 *   per kundli every DASHA_DEEP_FOCUS_HOURS (6) per container (in memory), and the `dasha.deep@focus` row says when the
 *   last focus invoked the worker, so other containers hold back too.
 * - Sweep: `runDashaDeepSweep` (the kundli-sync sweep, every 15 min) sends `reason: 'sweep'` for kundlis focused in the
 *   last 30 days whose window ends within 30 days or whose last pull is older than 7 days, at most DASHA_DEEP_SWEEP_MAX.
 */
import type { PrismaClient } from '@prisma/client';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { getDashaDeepFocusHours, getDashaDeepSweepMax, getDashaDeepWorkerFunction } from '../config/env.js';
import { queueLog, queueLogError } from '../lib/queueLogger.js';
import type { RequireUser } from '../auth/requestAuth.js';
import { DASHA_DEEP_TYPE } from '../reading/chartData/catalog.js';
import { DEEP_COVER_DAYS, DEEP_FAILED_RETRY_HOURS, DEEP_LEASE_MS, DEEP_MAX_AGE_DAYS, DASHA_DEEP_AYANAMSA, dashaDeepEventPayload, FOCUS_VARIANT, MARKER_VARIANT, type DashaDeepEvent } from './dashaDeep.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The sweep only refreshes kundlis someone opened within this many days */
export const SWEEP_FOCUS_DAYS = 30;
const INVOKE_TIMEOUT_MS = 2_000;

export type Invoker = (functionName: string, payload: Record<string, unknown>) => Promise<void>;

let lambdaClient: LambdaClient | null = null;
const defaultInvoker: Invoker = async (functionName, payload) => {
  lambdaClient ??= new LambdaClient({});
  await lambdaClient.send(new InvokeCommand({ FunctionName: functionName, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(payload)) }), { abortSignal: AbortSignal.timeout(INVOKE_TIMEOUT_MS) });
};

let loggedNoFunction = false;
function noFunction(where: string): void {
  if (loggedNoFunction) return;
  loggedNoFunction = true;
  queueLog({ event: 'dasha_deep_no_worker_function', where, note: 'DASHA_DEEP_WORKER_FUNCTION unset: deep dasha levels are not pulled (no inline pull)' });
}

const lastByUser = new Map<string, number>();
const lastByKundli = new Map<string, number>();

/** Test seam: forget the in-memory cooldowns and the once-only log. */
export function resetDashaDeepFocusState(): void {
  lastByUser.clear();
  lastByKundli.clear();
  loggedNoFunction = false;
}

type FocusPrisma = {
  kundli: { findFirst: (q: { where: { user_id: string }; orderBy: { created_at: 'desc' }; select: { id: true } }) => Promise<{ id: string } | null> };
  kundliData: {
    findUnique: (q: { where: { kundli_data_key: { kundli_id: string; data_type: string; variant: string; ayanamsa: string } }; select: { fetched_at: true } }) => Promise<{ fetched_at: Date | null } | null>;
    upsert: (q: { where: { kundli_data_key: { kundli_id: string; data_type: string; variant: string; ayanamsa: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
    findMany: (q: Record<string, unknown>) => Promise<Array<{ kundli_id: string; status?: string; fetched_at: Date | null; fetch_started_at?: Date | null; valid_to?: Date | null }>>;
  };
};

export interface FocusDeps {
  invoke?: Invoker;
  now?: () => number;
}

export type FocusOutcome = 'invoked' | 'no_function' | 'cooldown' | 'no_kundli' | 'recent' | 'error';

const focusKey = (kundliId: string) => ({ kundli_data_key: { kundli_id: kundliId, data_type: DASHA_DEEP_TYPE, variant: FOCUS_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA } });

/** One focus for a user: invoke the worker for the user's latest kundli, at most once per focus window. Never throws, never pulls. */
export async function noteDashaDeepFocus(prisma: PrismaClient, userId: string, deps: FocusDeps = {}): Promise<FocusOutcome> {
  const fn = getDashaDeepWorkerFunction();
  if (!fn) {
    noFunction('focus');
    return 'no_function';
  }
  const now = (deps.now ?? Date.now)();
  const windowMs = getDashaDeepFocusHours() * HOUR;
  if (now - (lastByUser.get(userId) ?? -Infinity) < windowMs) return 'cooldown';
  lastByUser.set(userId, now);
  const p = prisma as unknown as FocusPrisma;
  try {
    const k = await p.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
    if (!k) return 'no_kundli';
    if (now - (lastByKundli.get(k.id) ?? -Infinity) < windowMs) return 'cooldown';
    lastByKundli.set(k.id, now);
    const row = await p.kundliData.findUnique({ where: focusKey(k.id), select: { fetched_at: true } });
    if (row?.fetched_at && now - row.fetched_at.getTime() < windowMs) return 'recent';
    const at = new Date(now);
    const data = { status: 'ready', payload: { focused_at: at.toISOString() }, fetched_at: at, error: null };
    await p.kundliData.upsert({ where: focusKey(k.id), create: { kundli_id: k.id, data_type: DASHA_DEEP_TYPE, variant: FOCUS_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA, ...data }, update: data });
    const event: Omit<DashaDeepEvent, 'type'> = { kundliId: k.id, userId, reason: 'focus', asOf: at.toISOString().slice(0, 10) };
    await (deps.invoke ?? defaultInvoker)(fn, dashaDeepEventPayload(event));
    queueLog({ event: 'dasha_deep_focus_invoked', kundli_id: k.id });
    return 'invoked';
  } catch (err) {
    queueLogError({ event: 'dasha_deep_focus_failed', error: (err as Error).message?.slice(0, 200) });
    return 'error';
  }
}

/**
 * `requireUser` for the focus routes (Today, Lucky times, boards, chat): authenticates as before, then fires the focus
 * trigger without awaiting it. The request never waits on it and never reaches the engine through it.
 */
export function withDashaDeepFocus(requireUser: RequireUser, prisma: PrismaClient, deps: FocusDeps = {}): RequireUser {
  return async (req, res) => {
    const userId = await requireUser(req, res);
    if (userId) void noteDashaDeepFocus(prisma, userId, deps).catch(() => undefined);
    return userId;
  };
}

export interface DeepSweepResult {
  focused: number;
  due: number;
  invoked: number;
  skipped: 'no_function' | 'off' | null;
}

/** Kundlis focused in the last 30 days whose deep window needs a refresh, oldest pull first, at most `max`. */
export async function findDeepSweepCandidates(prisma: PrismaClient, now: number, max: number): Promise<string[]> {
  const p = prisma as unknown as FocusPrisma;
  const focused = await p.kundliData.findMany({
    where: { data_type: DASHA_DEEP_TYPE, variant: FOCUS_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA, fetched_at: { gt: new Date(now - SWEEP_FOCUS_DAYS * DAY) } },
    select: { kundli_id: true, fetched_at: true },
    orderBy: { fetched_at: 'desc' },
    take: 1000,
  });
  if (!focused.length) return [];
  const markers = await p.kundliData.findMany({
    where: { data_type: DASHA_DEEP_TYPE, variant: MARKER_VARIANT, ayanamsa: DASHA_DEEP_AYANAMSA, kundli_id: { in: focused.map((f) => f.kundli_id) } },
    select: { kundli_id: true, status: true, fetched_at: true, fetch_started_at: true, valid_to: true },
  });
  const byId = new Map(markers.map((m) => [m.kundli_id, m]));
  const cover = new Date(now + DEEP_COVER_DAYS * DAY);
  const due = focused
    .map((f) => ({ id: f.kundli_id, m: byId.get(f.kundli_id) }))
    .filter(({ m }) => {
      if (!m) return true;
      if (m.status === 'fetching') return !m.fetch_started_at || now - m.fetch_started_at.getTime() > DEEP_LEASE_MS;
      if (m.status === 'failed') return !m.fetched_at || now - m.fetched_at.getTime() > DEEP_FAILED_RETRY_HOURS * HOUR;
      return !m.valid_to || m.valid_to < cover || !m.fetched_at || now - m.fetched_at.getTime() > DEEP_MAX_AGE_DAYS * DAY;
    })
    .sort((a, b) => (a.m?.fetched_at?.getTime() ?? 0) - (b.m?.fetched_at?.getTime() ?? 0));
  return due.slice(0, max).map((d) => d.id);
}

/** The sweep step: invoke the worker (reason 'sweep') for the due kundlis. Never throws, never pulls. */
export async function runDashaDeepSweep(prisma: PrismaClient, deps: FocusDeps & { find?: typeof findDeepSweepCandidates } = {}): Promise<DeepSweepResult> {
  const fn = getDashaDeepWorkerFunction();
  if (!fn) {
    noFunction('sweep');
    return { focused: 0, due: 0, invoked: 0, skipped: 'no_function' };
  }
  const max = getDashaDeepSweepMax();
  if (max <= 0) return { focused: 0, due: 0, invoked: 0, skipped: 'off' };
  const now = (deps.now ?? Date.now)();
  let ids: string[] = [];
  try {
    ids = await (deps.find ?? findDeepSweepCandidates)(prisma, now, max);
  } catch (err) {
    queueLogError({ event: 'dasha_deep_sweep_failed', error: (err as Error).message?.slice(0, 200) });
    return { focused: 0, due: 0, invoked: 0, skipped: null };
  }
  let invoked = 0;
  const asOf = new Date(now).toISOString().slice(0, 10);
  for (const kundliId of ids.slice(0, max)) {
    try {
      await (deps.invoke ?? defaultInvoker)(fn, dashaDeepEventPayload({ kundliId, reason: 'sweep', asOf }));
      invoked += 1;
    } catch (err) {
      queueLogError({ event: 'dasha_deep_sweep_invoke_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 200) });
    }
  }
  queueLog({ event: 'dasha_deep_sweep_done', due: ids.length, invoked });
  return { focused: ids.length, due: ids.length, invoked, skipped: null };
}
