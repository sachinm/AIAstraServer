/**
 * The reading gate, first version (docs/techniques/11 rev 4 §4.8): nothing starts a reading while the chart is being
 * prepared. Every function that queues a reading build asks `readingGate` first (and every door that marks cards,
 * reserves a question or charges a clock asks it before doing so), so a refused call queues nothing and changes nothing.
 *
 * With READING_PREP off (what ships first) there is no preparation queue, and the gate is LOCKED when
 *   - the chart is not ready: its build status is `pending` or `building`, or the digest is not `ready`
 *     (reason `chart`), or
 *   - a reading build is already running for this chart on any board: a `<board>.reading` marker `building` and at most
 *     10 minutes old; an older marker is a dead build and does not lock (reason `building`).
 * It is NEVER locked when the chart's build status is `failed`: that chart shows its own Retry, as today.
 *
 * Read-only and cheap: the chart row, the account row, one count and one marker query; the stored status row (M56) only
 * supplies the stage, the progress and the line. A failed read never locks (the gate is a new restriction; when it
 * cannot tell, today's behaviour stands) and is logged. No engine name and no raw error is ever in the view.
 */
import type { PrismaClient } from '@prisma/client';
import { getKundliSyncLeaseMs } from '../../config/env.js';
import { queueLogError } from '../../lib/queueLogger.js';
import { chartStatusFrom, type ChartBuildStatus } from '../../services/chartStatusService.js';
import { readPipelineRow, pipelineView, type PipelineRow } from '../pipeline/status.js';
import type { PipelineStage, PipelineView } from '../pipeline/types.js';
import { readRunningBuild } from '../self/buildEvent.js';

export interface GateDeps {
  now?: () => Date;
  /** the stored status row (default readPipelineRow) */
  readRow?: (prisma: PrismaClient, kundliId: string) => Promise<PipelineRow | null>;
  /** a reading build running now on any board (default readRunningBuild) */
  runningBuild?: (prisma: PrismaClient, kundliId: string, now: Date) => Promise<{ board: string; startedAt: string } | null>;
}

/** The gate as a function the queue doors take (tests replace it). */
export type ReadingGateFn = (prisma: PrismaClient, kundliId: string) => Promise<PipelineView>;

export interface GateFacts {
  chartStatus: ChartBuildStatus;
  digestStatus: string | null;
  runningBuild: boolean;
  anyRows: boolean;
}

/** PURE. The first-version rule: whether a reading may start, and why not. */
export function gateRule(f: GateFacts): { locked: boolean; reason: PipelineView['reason'] } {
  if (f.chartStatus === 'failed') return { locked: false, reason: null };
  if (f.chartStatus === 'pending' || f.chartStatus === 'building') return { locked: true, reason: 'chart' };
  if (f.digestStatus !== 'ready') return { locked: true, reason: 'chart' };
  if (f.runningBuild) return { locked: true, reason: 'building' };
  return { locked: false, reason: null };
}

/** The stage when no status row is stored (M56 not applied, or no run since it was): from the chart status and the digest. */
export function fallbackStage(f: GateFacts): PipelineStage {
  if (f.chartStatus === 'failed') return 'blocked';
  if (f.chartStatus === 'pending') return f.anyRows ? 'pulling' : 'registered';
  if (f.chartStatus === 'building') return 'pulling';
  if (f.digestStatus === 'building') return 'chart_ready';
  if (f.digestStatus !== 'ready') return 'checking';
  return 'ready';
}

/** PURE. The view: the stored row's stage and progress when there is one and it agrees with the lock, else the fallback. */
export function gateView(f: GateFacts, row: PipelineRow | null): PipelineView {
  const lock = gateRule(f);
  // a row from before the chart changed (a rebuild, a new pull) may still say ready: the live facts win
  const useRow = row && !(lock.locked && lock.reason === 'chart' && row.stage === 'ready');
  return useRow ? pipelineView(row.stage, row.done, row.total, lock) : pipelineView(fallbackStage(f), row?.done ?? 0, row?.total ?? 0, lock);
}

const OPEN: PipelineView = pipelineView('ready', 0, 0, { locked: false, reason: null });

/** The facts the rule reads, and the stored status row. Null when the chart does not exist. Throws on a failed read. */
export async function readGateFacts(prisma: PrismaClient, kundliId: string, now: Date, deps: GateDeps = {}): Promise<{ facts: GateFacts; row: PipelineRow | null } | null> {
  const kundli = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { user_id: true, digest_status: true, queue_started_at: true, last_sync_error: true } });
  if (!kundli) return null;
  const [auth, rowCount, running, row] = await Promise.all([
    prisma.auth.findUnique({ where: { id: kundli.user_id }, select: { profile_complete: true, kundli_added: true } }),
    prisma.kundliData.count({ where: { kundli_id: kundliId } }),
    (deps.runningBuild ?? readRunningBuild)(prisma, kundliId, now),
    (deps.readRow ?? readPipelineRow)(prisma, kundliId),
  ]);
  const leaseAt = kundli.queue_started_at?.getTime();
  // the same rule GET chart status uses (chartStatusFrom); the counts only tell "nothing pulled yet" from "pulling"
  const chart = chartStatusFrom({
    profileComplete: auth?.profile_complete !== false,
    hasKundli: true,
    kundliAdded: Boolean(auth?.kundli_added),
    factsStatus: 'pending',
    leaseHeld: leaseAt != null && now.getTime() - leaseAt <= getKundliSyncLeaseMs(),
    hasSyncError: Boolean(kundli.last_sync_error),
    gateDone: rowCount > 0 ? 1 : 0,
    gateTotal: 1,
    restDone: 0,
    restTotal: 0,
    readingEngine: true,
  });
  return { facts: { chartStatus: chart.status, digestStatus: kundli.digest_status, runningBuild: Boolean(running), anyRows: rowCount > 0 }, row };
}

/** Whether a reading may start for this chart now, as the view served to the person. Never throws. */
export async function readingGate(prisma: PrismaClient, kundliId: string, deps: GateDeps = {}): Promise<PipelineView> {
  const now = (deps.now ?? (() => new Date()))();
  try {
    const read = await readGateFacts(prisma, kundliId, now, deps);
    if (!read) return pipelineView('registered', 0, 0, { locked: false, reason: null });
    return gateView(read.facts, read.row);
  } catch (e) {
    queueLogError({ event: 'reading_gate_read_failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 200) });
    return OPEN;
  }
}

/** The gate for the person's latest chart (GraphQL chart status). Null without a chart. Never throws. */
export async function readingGateForUser(prisma: PrismaClient, userId: string, deps: GateDeps = {}): Promise<PipelineView | null> {
  try {
    const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
    return k ? await readingGate(prisma, k.id, deps) : null;
  } catch (e) {
    queueLogError({ event: 'reading_gate_read_failed', user_id: userId, error: (e as Error).message?.slice(0, 200) });
    return null;
  }
}
