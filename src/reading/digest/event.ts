/**
 * The digest events (docs/reading-engine/53 §4.7, 54 §2), handled by `POST /events` like `kundli-sync`:
 *   { source: 'kundli-digest', kundliId, token }      build (or rebuild) one kundli's digest, after an annual top-up
 *   { source: 'kundli-digest-sweep', token }          EventBridge rule (every 5 min): up to 20 kundlis whose dossier is ready
 *                                                     and whose digest is pending, stale, failed, of another version or
 *                                                     stuck building, one after another within DIGEST_SWEEP_MAX_MS
 *                                                     (default 60 s), then annual-set top-ups with the time left
 * The EventBridge envelope ({ source: 'aiastra', 'detail-type': 'kundli-digest', detail: { kundliId, token } } and
 * { detail: { task: 'kundli-digest-sweep', token } }) is read the same way. The token (KUNDLI_DIGEST_EVENT_TOKEN) is
 * mandatory: with it unset every digest event is refused, because `/events` is reachable by anything that can call the
 * function. Nothing here computes astrology; the engine is reached only through ensureChartData.
 */
import { timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { getDigestSweepMaxMs, getKundliDigestEventToken } from '../../config/env.js';
import { queueLog, queueLogError } from '../../lib/queueLogger.js';
import { withAgentRun } from '../../agents/registry.js';
import { prismaChartDataRepo } from '../chartData/store.js';
import { annualMaxCalls, ensureAnnualSet, type AnnualSetResult } from './annualSet.js';
import { buildDigest, type DigestBuildResult } from './build.js';
import { markDigestInputsChanged } from './status.js';
import { DIGEST_VERSION } from './types.js';

export const KUNDLI_DIGEST_SOURCE = 'kundli-digest';
export const KUNDLI_DIGEST_SWEEP_SOURCE = 'kundli-digest-sweep';
/** At most this many kundlis per sweep (doc 53 §4.7) */
export const DIGEST_SWEEP_BATCH = 20;
/** A build still `building` after this long is taken as dead (its process stopped) and run again */
export const DIGEST_STUCK_MS = 10 * 60_000;
/** Kundlis offered an annual top-up per sweep, and the engine calls one top-up may take per second of budget left */
const TOPUP_KUNDLIS = 3;
const MS_PER_ENGINE_CALL = 1_500;
const KUNDLI_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export type KundliDigestEvent = { kind: 'one'; kundliId: string } | { kind: 'sweep' };

function tokenOk(given: unknown): boolean {
  const want = getKundliDigestEventToken();
  if (!want || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The two digest events, or null (anything else, a wrong or missing token, or KUNDLI_DIGEST_EVENT_TOKEN unset). */
export function parseKundliDigestEvent(body: unknown): KundliDigestEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { source?: unknown; 'detail-type'?: unknown; kundliId?: unknown; token?: unknown; detail?: { kundliId?: unknown; task?: unknown; token?: unknown } };
  const d = b.detail && typeof b.detail === 'object' ? b.detail : null;
  let kind: 'one' | 'sweep' | null = null;
  let kundliId: unknown;
  let token: unknown;
  if (b.source === KUNDLI_DIGEST_SOURCE) [kind, kundliId, token] = ['one', b.kundliId, b.token];
  else if (b.source === KUNDLI_DIGEST_SWEEP_SOURCE) [kind, token] = ['sweep', b.token];
  else if (d && b['detail-type'] === KUNDLI_DIGEST_SOURCE) [kind, kundliId, token] = ['one', d.kundliId, d.token];
  else if (d && d.task === KUNDLI_DIGEST_SWEEP_SOURCE) [kind, token] = ['sweep', d.token];
  if (!kind || !tokenOk(token)) return null;
  if (kind === 'sweep') return { kind };
  return typeof kundliId === 'string' && KUNDLI_ID_RE.test(kundliId) ? { kind, kundliId } : null;
}

/** The event this Lambda sends itself to build one kundli's digest. */
export function kundliDigestEventPayload(kundliId: string): Record<string, unknown> {
  return { source: KUNDLI_DIGEST_SOURCE, kundliId, token: getKundliDigestEventToken() ?? '' };
}

export interface DigestEventDeps {
  prisma: PrismaClient;
  now?: () => number;
  maxMs?: number;
  /** replaces the build (tests) */
  build?: (prisma: PrismaClient, kundliId: string) => Promise<DigestBuildResult>;
  /** replaces the annual top-up (tests) */
  topUp?: (prisma: PrismaClient, kundliId: string, maxCalls: number) => Promise<AnnualSetResult>;
}

const defaultTopUp = (prisma: PrismaClient, kundliId: string, maxCalls: number) => ensureAnnualSet({ repo: prismaChartDataRepo(prisma) }, kundliId, { maxCalls });

async function runTopUp(deps: DigestEventDeps, kundliId: string, maxCalls: number): Promise<AnnualSetResult | null> {
  if (maxCalls <= 0) return null;
  try {
    return await withAgentRun(deps.prisma, 'digest.annual_set', { task: 'annual-top-up', technique: 'digest.annual_set', kundliId, input: { max_calls: maxCalls } }, async () => {
      const r = await (deps.topUp ?? defaultTopUp)(deps.prisma, kundliId, maxCalls);
      return { value: r, output: { wanted: r.wanted, present: r.present, requested: r.requested, fetched: r.fetched, failed: r.failed, remaining: r.remaining, backed_off: r.backedOff, years_completed: r.yearsCompleted, writes: [`kundli_charts:${r.fetched}`] } };
    });
  } catch (err) {
    queueLogError({ event: 'digest_annual_topup_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 300) });
    return null;
  }
}

async function runBuild(deps: DigestEventDeps, kundliId: string, trigger: 'event' | 'sweep'): Promise<DigestBuildResult> {
  try {
    return await withAgentRun(deps.prisma, 'digest.build', { task: `digest-${trigger}`, technique: 'digest.build', kundliId, input: { trigger, version: DIGEST_VERSION } }, async () => {
      const r = await (deps.build ?? ((p, id) => buildDigest(p, id, { fetch: true })))(deps.prisma, kundliId);
      return { value: r, output: { status: r.status, rows: r.rows, activation: r.activation, ms: r.ms, error_type: r.error ?? null, writes: [`kundli_digest:${r.rows}`, `kundli_activation:${r.activation}`] } };
    });
  } catch (err) {
    queueLogError({ event: 'digest_build_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 300) });
    return { status: 'failed', rows: 0, activation: 0, ms: 0, error: 'Error' };
  }
}

export interface DigestOneOutcome {
  kundliId: string;
  topUp: AnnualSetResult | null;
  build: DigestBuildResult;
}

/** One kundli: top up the annual set (capped), then build the digest from what is stored. Never throws. */
export async function runKundliDigest(deps: DigestEventDeps, kundliId: string): Promise<DigestOneOutcome> {
  const topUp = await runTopUp(deps, kundliId, annualMaxCalls());
  const build = await runBuild(deps, kundliId, 'event');
  queueLog({ event: 'digest_built', kundli_id: kundliId, status: build.status, rows: build.rows, activation: build.activation, ms: build.ms, annual_fetched: topUp?.fetched ?? 0 });
  return { kundliId, topUp, build };
}

/** Kundlis the sweep builds: dossier ready, digest pending / stale / failed / of another version / stuck building; failed last. */
export async function findDigestCandidates(prisma: PrismaClient, batch: number, now: number): Promise<string[]> {
  const rows = await prisma.kundli.findMany({
    where: {
      facts_status: 'ready',
      OR: [
        { digest_status: { in: ['pending', 'stale', 'failed'] } },
        { digest_status: 'ready', digest_version: null },
        { digest_status: 'ready', NOT: { digest_version: DIGEST_VERSION } },
        { digest_status: 'building', OR: [{ digest_built_at: null }, { digest_built_at: { lt: new Date(now - DIGEST_STUCK_MS) } }] },
      ],
    },
    select: { id: true, digest_status: true },
    orderBy: [{ created_at: 'asc' }],
    take: batch * 3,
  });
  return rows
    .sort((a, b) => Number(a.digest_status === 'failed') - Number(b.digest_status === 'failed'))
    .slice(0, batch)
    .map((r) => r.id);
}

export interface DigestSweepResult {
  candidates: number;
  built: Array<{ kundliId: string; status: string; rows: number; activation: number; ms: number }>;
  topUps: Array<{ kundliId: string; fetched: number; remaining: number; yearsCompleted: number[] }>;
  stoppedForBudget: boolean;
}

/** The scheduled sweep: builds, one after another under the budget, then annual top-ups with the time left. Never throws. */
export async function runDigestSweep(deps: DigestEventDeps & { find?: typeof findDigestCandidates; topUpCandidates?: (prisma: PrismaClient) => Promise<string[]> }): Promise<DigestSweepResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const deadline = started + (deps.maxMs ?? getDigestSweepMaxMs());
  const out: DigestSweepResult = { candidates: 0, built: [], topUps: [], stoppedForBudget: false };
  let ids: string[] = [];
  try {
    ids = await (deps.find ?? findDigestCandidates)(deps.prisma, DIGEST_SWEEP_BATCH, started);
  } catch (err) {
    queueLogError({ event: 'digest_sweep_failed', error: (err as Error).message?.slice(0, 300) });
    return out;
  }
  out.candidates = ids.length;
  for (const id of ids) {
    if (now() >= deadline) {
      out.stoppedForBudget = true;
      break;
    }
    const r = await runBuild(deps, id, 'sweep');
    out.built.push({ kundliId: id, status: r.status, rows: r.rows, activation: r.activation, ms: r.ms });
  }
  if (!out.stoppedForBudget) {
    let topIds: string[] = [];
    try {
      topIds = await (deps.topUpCandidates ?? readyKundlisForTopUp)(deps.prisma);
    } catch (err) {
      queueLogError({ event: 'digest_sweep_topup_list_failed', error: (err as Error).message?.slice(0, 300) });
    }
    for (const id of topIds) {
      const calls = Math.min(annualMaxCalls(), Math.floor((deadline - now()) / MS_PER_ENGINE_CALL));
      if (calls <= 0) break;
      const r = await runTopUp(deps, id, calls);
      if (!r) continue;
      out.topUps.push({ kundliId: id, fetched: r.fetched, remaining: r.remaining, yearsCompleted: r.yearsCompleted ?? [] });
      // A year became complete: the digest's annual section is behind, so the next sweep rebuilds it. Rows of a year
      // still being filled, and retried failures, wait (a rebuild per fetched row rebuilt every kundli 10-14 times a day).
      if (r.yearsCompleted?.length) await markDigestInputsChanged(deps.prisma, id);
    }
  }
  queueLog({ event: 'digest_sweep_done', candidates: out.candidates, built: out.built.length, top_ups: out.topUps.length, stopped_for_budget: out.stoppedForBudget });
  return out;
}

/** A few ready kundlis in random order (the top-up reads each one's set first, so a complete one costs one query). */
async function readyKundlisForTopUp(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.kundli.findMany({ where: { facts_status: 'ready', digest_status: 'ready' }, select: { id: true }, take: 200 });
  const ids = rows.map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids.slice(0, TOPUP_KUNDLIS);
}

/** POST /events entry: runs the event to the end (the invocation lives until the response is sent). */
export async function handleKundliDigestEvent(event: KundliDigestEvent, deps: DigestEventDeps): Promise<DigestOneOutcome | DigestSweepResult> {
  return event.kind === 'one' ? runKundliDigest(deps, event.kundliId) : runDigestSweep(deps);
}

let lambdaClient: LambdaClient | null = null;
const lastQueued = new Map<string, number>();
const QUEUE_COOLDOWN_MS = 60_000;

/**
 * Queue one kundli's digest (a board or a reading found it not ready): mark it pending unless it is building or ready,
 * then on Lambda invoke this function asynchronously with a kundli-digest event; off Lambda, build in process. At most
 * once a minute per kundli per container. Never throws, never waits for the build.
 */
export async function queueDigestBuild(prisma: PrismaClient, kundliId: string): Promise<'invoked' | 'in_process' | 'skipped'> {
  if (Date.now() - (lastQueued.get(kundliId) ?? 0) < QUEUE_COOLDOWN_MS) return 'skipped';
  lastQueued.set(kundliId, Date.now());
  try {
    await prisma.kundli.updateMany({ where: { id: kundliId, digest_status: { in: ['failed', 'stale'] } }, data: { digest_status: 'pending' } });
    const fn = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
    if (fn && getKundliDigestEventToken()) {
      lambdaClient ??= new LambdaClient({});
      await lambdaClient.send(new InvokeCommand({ FunctionName: fn, InvocationType: 'Event', Payload: Buffer.from(JSON.stringify(kundliDigestEventPayload(kundliId))) }), { abortSignal: AbortSignal.timeout(2_000) });
      return 'invoked';
    }
    if (fn) return 'skipped'; // on Lambda without the token: the sweep builds it
    void buildDigest(prisma, kundliId, { fetch: true }).catch(() => undefined);
    return 'in_process';
  } catch (err) {
    queueLogError({ event: 'digest_queue_failed', kundli_id: kundliId, error: (err as Error).message?.slice(0, 300) });
    return 'skipped';
  }
}
