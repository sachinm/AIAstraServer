/**
 * The reading build as a background event (docs/reading-engine/64 §4). A page open never waits on a model: the route
 * reads the store (`oracleMode: 'cached_only'`) and, when the Oracle has nothing stored for today, queues one build:
 *
 *   { source: 'self-reading-build', userId, board, token }   handled by POST /events like kundli-digest
 *
 * On Lambda the function invokes itself asynchronously (its own invocation, up to the function's timeout, never a frozen
 * container); off Lambda the build runs detached in process. One build at a time per kundli and board: the marker is an
 * `area_builds` row (area `<board>.reading`, today) whose status is `building` while it runs, `ready` or `failed` after.
 * A build still `building` after BUILD_STUCK_MS is taken as dead and run again; a build that `failed` within
 * FAILED_COOLDOWN_MS is not run again, so a Gemini outage costs one attempt per half hour, not one per poll.
 * The token (KUNDLI_DIGEST_EVENT_TOKEN, the Lambda's self-invoke secret) is mandatory: without it every event is refused.
 */
import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { getKundliDigestEventToken, isSelfReadingModelEnabled, isSelfV2BuildEnabled } from '../../config/env.js';
import { queueLog, queueLogError } from '../../lib/queueLogger.js';
import { questionGate, type QuestionGate } from '../../billing/questionGate.js';
import { getBoardReading, type SelfDeps, type SelfReadingResult } from './service.js';
import type { ReadingBoardId } from './types.js';

export const SELF_READING_BUILD_SOURCE = 'self-reading-build';
/** A build still `building` after this long is taken as dead and run again */
export const BUILD_STUCK_MS = 10 * 60_000;
/** A build that failed this recently is served without its Oracle lines instead of being run again */
export const FAILED_COOLDOWN_MS = 30 * 60_000;
const BOARDS: readonly ReadingBoardId[] = ['self', 'love', 'work'];
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export interface SelfReadingBuildEvent {
  userId: string;
  board: ReadingBoardId;
  /** a fresh reading the person asked for (docs/billing/03): the day its question was held on, settled by this build */
  refreshDay?: string;
}

/** A fresh reading the person asked for, and the UTC day its question was held on. */
export interface BuildOptions {
  refreshDay?: string;
}
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function tokenOk(given: unknown): boolean {
  const want = getKundliDigestEventToken();
  if (!want || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The build event, or null (anything else, a wrong or missing token, or the token unset). */
export function parseSelfReadingBuildEvent(body: unknown): SelfReadingBuildEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { source?: unknown; userId?: unknown; board?: unknown; token?: unknown; refreshDay?: unknown; 'detail-type'?: unknown; detail?: Record<string, unknown> };
  const d = b.detail && typeof b.detail === 'object' ? b.detail : null;
  let userId: unknown;
  let board: unknown;
  let token: unknown;
  let refreshDay: unknown;
  if (b.source === SELF_READING_BUILD_SOURCE) [userId, board, token, refreshDay] = [b.userId, b.board, b.token, b.refreshDay];
  else if (d && b['detail-type'] === SELF_READING_BUILD_SOURCE) [userId, board, token, refreshDay] = [d.userId, d.board, d.token, d.refreshDay];
  else return null;
  if (!tokenOk(token)) return null;
  if (typeof userId !== 'string' || !ID_RE.test(userId)) return null;
  if (typeof board !== 'string' || !BOARDS.includes(board as ReadingBoardId)) return null;
  return { userId, board: board as ReadingBoardId, ...(typeof refreshDay === 'string' && DAY_RE.test(refreshDay) ? { refreshDay } : {}) };
}

/** The event this Lambda sends itself. */
export function selfReadingBuildEventPayload(userId: string, board: ReadingBoardId, opts: BuildOptions = {}): Record<string, unknown> {
  return { source: SELF_READING_BUILD_SOURCE, userId, board, ...(opts.refreshDay ? { refreshDay: opts.refreshDay } : {}), token: getKundliDigestEventToken() ?? '' };
}

export const markerArea = (board: ReadingBoardId): string => `${board}.reading`;

export type BuildMarkerState = 'none' | 'building' | 'stuck' | 'ready' | 'failed_recently' | 'failed';

interface MarkerRow {
  status: string;
  result: unknown;
  error?: string | null;
}

type MarkerPrisma = {
  areaBuild?: {
    findUnique?: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } } }) => Promise<MarkerRow | null>;
    upsert?: (q: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  };
};

const dayOf = (now: Date): Date => new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);

function startedAtOf(row: MarkerRow | null): number {
  const r = row?.result as { started_at?: unknown } | null | undefined;
  const t = typeof r?.started_at === 'string' ? Date.parse(r.started_at) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** What the marker says about today's build of this board for this kundli. Never throws. */
export async function readBuildMarker(prisma: PrismaClient, kundliId: string, board: ReadingBoardId, now: Date): Promise<BuildMarkerState> {
  try {
    const row = await (prisma as unknown as MarkerPrisma).areaBuild?.findUnique?.({ where: { kundli_id_area_as_of: { kundli_id: kundliId, area: markerArea(board), as_of: dayOf(now) } } });
    if (!row) return 'none';
    const age = now.getTime() - startedAtOf(row);
    if (row.status === 'building') return age > BUILD_STUCK_MS ? 'stuck' : 'building';
    if (row.status === 'failed') return age < FAILED_COOLDOWN_MS ? 'failed_recently' : 'failed';
    return 'ready';
  } catch (e) {
    queueLogError({ event: 'reading_build_marker_read_failed', kundli_id: kundliId, board, error: (e as Error).message?.slice(0, 300) });
    return 'none';
  }
}

async function writeBuildMarker(prisma: PrismaClient, userId: string, kundliId: string, board: ReadingBoardId, now: Date, status: 'building' | 'ready' | 'failed', error?: string): Promise<void> {
  try {
    const where = { kundli_id_area_as_of: { kundli_id: kundliId, area: markerArea(board), as_of: dayOf(now) } };
    const result = { started_at: now.toISOString() };
    await (prisma as unknown as MarkerPrisma).areaBuild?.upsert?.({
      where,
      create: { user_id: userId, kundli_id: kundliId, area: markerArea(board), as_of: dayOf(now), status, result, error: error ?? null },
      update: { status, ...(status === 'building' ? { result } : {}), error: error ?? null },
    });
  } catch (e) {
    queueLogError({ event: 'reading_build_marker_write_failed', kundli_id: kundliId, board, error: (e as Error).message?.slice(0, 300) });
  }
}

export interface QueueDeps {
  prisma: PrismaClient;
  /** the build that runs off Lambda (tests replace it) */
  build?: (deps: SelfDeps, userId: string, board: ReadingBoardId, opts: BuildOptions) => Promise<SelfReadingResult>;
  /** the async self-invoke on Lambda (tests replace it) */
  invoke?: (payload: Record<string, unknown>) => Promise<void>;
  self?: Omit<SelfDeps, 'prisma'>;
  now?: () => Date;
  /** settles the question held for a fresh reading the person asked for (docs/billing/03; tests replace it) */
  gate?: Pick<QuestionGate, 'settleBoardRefresh'>;
  /** the Self v2 build run after the self build when SELF_V2_BUILD=1 (docs/reading-engine/66 §4.8; tests replace it) */
  v2Build?: (prisma: PrismaClient, userId: string, kundliId: string, asOf: string) => Promise<{ status: string; ms?: Record<string, number> }>;
}

let lambdaClient: LambdaClient | null = null;

async function defaultInvoke(payload: Record<string, unknown>): Promise<void> {
  const fn = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  if (!fn) throw new Error('not on Lambda');
  lambdaClient ??= new LambdaClient({});
  await lambdaClient.send(new InvokeCommand({ FunctionName: fn, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(payload)) }), { abortSignal: AbortSignal.timeout(2_000) });
}

const defaultBuild = (deps: SelfDeps, userId: string, board: ReadingBoardId, opts: BuildOptions) =>
  getBoardReading(deps, userId, board, { trigger: 'request', ...(opts.refreshDay ? { refresh: true } : {}) });

/** The Self v2 build, loaded only when the flag is on (the v2 modules stay out of the event path otherwise). */
async function defaultV2Build(prisma: PrismaClient, userId: string, kundliId: string, asOf: string): Promise<{ status: string; ms?: Record<string, number> }> {
  const { runSelfV2Build } = await import('./v2/build.js');
  return runSelfV2Build({ prisma }, { userId, kundliId, asOf });
}

/**
 * SELF_V2_BUILD=1: after the self build, the v2 build runs in the same invocation (docs/reading-engine/66 §4.8). It never
 * charges (the board's one charge per day stays with the build above) and never fails the build event. The current
 * lineman path is untouched; it is retired only for the v2 path.
 */
async function maybeRunSelfV2(deps: QueueDeps, userId: string, kundliId: string, board: ReadingBoardId, asOf: string): Promise<void> {
  if (board !== 'self' || !isSelfV2BuildEnabled() || !isSelfReadingModelEnabled()) return;
  const t0 = Date.now();
  try {
    const v2 = await (deps.v2Build ?? defaultV2Build)(deps.prisma, userId, kundliId, asOf);
    queueLog({ event: 'self_v2_build_done', kundli_id: kundliId, status: v2.status, ms: Date.now() - t0 });
  } catch (e) {
    queueLogError({ event: 'self_v2_build_failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 300), ms: Date.now() - t0 });
  }
}

/**
 * Runs one build to the end, marking the marker `ready` or `failed`. Never throws. A build with no `refreshDay` is the
 * board's first reading and costs nothing; one the person asked for commits the question held for it when the synthesis
 * is made, and gives it back when it is not (docs/billing/03).
 */
export async function runSelfReadingBuild(deps: QueueDeps, userId: string, kundliId: string, board: ReadingBoardId, opts: BuildOptions = {}): Promise<SelfReadingResult | null> {
  const now = (deps.now ?? (() => new Date()))();
  const selfDeps: SelfDeps = { prisma: deps.prisma, ...(deps.self ?? {}) };
  const t0 = Date.now();
  try {
    const r = await (deps.build ?? defaultBuild)(selfDeps, userId, board, opts);
    const oracle = r.status === 'ok' ? r.reading.oracle : undefined;
    const failed = oracle !== undefined && (oracle.status === 'failed' || oracle.status === 'pending');
    await writeBuildMarker(deps.prisma, userId, kundliId, board, now, failed ? 'failed' : 'ready', failed ? `oracle ${oracle.status}` : undefined);
    const made = r.status === 'ok' && oracle?.status === 'ok';
    if (opts.refreshDay) await (deps.gate ?? questionGate(deps.prisma)).settleBoardRefresh(userId, board, opts.refreshDay, made);
    queueLog({ event: 'reading_build_done', kundli_id: kundliId, board, status: r.status, oracle: oracle?.status ?? 'off', refresh: opts.refreshDay ? (made ? 'charged' : 'given_back') : 'none', ms: Date.now() - t0 });
    await maybeRunSelfV2(deps, userId, kundliId, board, r.status === 'ok' ? r.reading.asOf : now.toISOString().slice(0, 10));
    return r;
  } catch (e) {
    await writeBuildMarker(deps.prisma, userId, kundliId, board, now, 'failed', (e as Error).message?.slice(0, 300));
    if (opts.refreshDay) await (deps.gate ?? questionGate(deps.prisma)).settleBoardRefresh(userId, board, opts.refreshDay, false);
    queueLogError({ event: 'reading_build_failed', kundli_id: kundliId, board, error: (e as Error).message?.slice(0, 300), ms: Date.now() - t0 });
    return null;
  }
}

export type QueueOutcome = 'invoked' | 'in_process' | 'already_building' | 'failed_recently' | 'skipped';

/**
 * Queue one board's reading build for a person unless one is running or failed in the last half hour. Marks the marker
 * `building` first, so the next poll sees it even before the invocation starts. Never throws, never waits for the build.
 */
export async function queueSelfReadingBuild(deps: QueueDeps, userId: string, kundliId: string, board: ReadingBoardId, opts: BuildOptions = {}): Promise<QueueOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const state = await readBuildMarker(deps.prisma, kundliId, board, now);
  if (state === 'building') return 'already_building';
  if (state === 'failed_recently') return 'failed_recently';
  await writeBuildMarker(deps.prisma, userId, kundliId, board, now, 'building');
  const onLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME?.trim());
  if (onLambda || deps.invoke) {
    if (!getKundliDigestEventToken() && !deps.invoke) {
      queueLogError({ event: 'reading_build_queue_failed', kundli_id: kundliId, board, error: 'KUNDLI_DIGEST_EVENT_TOKEN unset' });
      await writeBuildMarker(deps.prisma, userId, kundliId, board, now, 'failed', 'no event token');
      return 'skipped';
    }
    try {
      await (deps.invoke ?? defaultInvoke)(selfReadingBuildEventPayload(userId, board, opts));
      return 'invoked';
    } catch (e) {
      queueLogError({ event: 'reading_build_queue_failed', kundli_id: kundliId, board, error: (e as Error).message?.slice(0, 300) });
      await writeBuildMarker(deps.prisma, userId, kundliId, board, now, 'failed', 'invoke failed');
      return 'skipped';
    }
  }
  void runSelfReadingBuild(deps, userId, kundliId, board, opts);
  return 'in_process';
}

/** POST /events entry: runs the build to the end (the invocation lives until the response is sent). */
export async function handleSelfReadingBuildEvent(event: SelfReadingBuildEvent, deps: QueueDeps): Promise<{ status: string; oracle: string }> {
  const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: event.userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 'no_kundli', oracle: 'off' };
  const r = await runSelfReadingBuild(deps, event.userId, kundli.id, event.board, event.refreshDay ? { refreshDay: event.refreshDay } : {});
  return { status: r?.status ?? 'failed', oracle: (r?.status === 'ok' ? r.reading.oracle?.status : undefined) ?? 'off' };
}
