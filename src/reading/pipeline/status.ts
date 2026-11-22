/**
 * One status per chart (docs/techniques/11 rev 4 §4.2): the manifest's verdict per need (complete / complete with named
 * gaps / incomplete), the stage, and the person's line. Recomputed from the stored rows at the end of every sync, digest
 * and clock run and kept in `kundli_pipeline` (M56), so the gate and the admin page read one row. The stored rows stay the
 * truth: the row is only ever written from them.
 *
 * With READING_PREP off (the default) there is no preparation queue: the stages are registered → pulling → checking →
 * chart_ready → ready, with `blocked` beside them (a required item failed). `ready` = the chart complete, or complete with
 * named gaps, and the digest built.
 *
 * Never throws on the sync, digest or clock path: M56 may not be applied, and a missing table is logged once and skipped.
 */
import type { PrismaClient } from '@prisma/client';
import { getKundliSyncLeaseMs, getPipelineRequiredDashas, isReadingPrepEnabled } from '../../config/env.js';
import { queueLog, queueLogError } from '../../lib/queueLogger.js';
import type { ChartDataType } from '../chartData/catalog.js';
import { loadRegistrationPlan } from '../chartData/registration.js';
import { isMissingTable, parseKey } from '../chartData/store.js';
import { chartDataDeps } from '../chartData/tool.js';
import { ACTIVATION_YEARS_AHEAD } from '../digest/activation.js';
import { annualSetKeys } from '../digest/annualSet.js';
import { parseApplicability } from '../self/clock.js';
import { buildManifest, gapsOf, verdictOf, type ActivationSpan, type Gap, type ItemState, type ManifestInput, type ManifestItem, type StoredStatusRow, type Verdict } from './manifest.js';
import { STAGE_LINES, type PipelineStage, type PipelineView } from './types.js';

export interface PipelineContext {
  digestStatus: string | null;
  /** the sync worker's lease is held (a pull is running) */
  leaseHeld: boolean;
  /** any `kundli_data` row is stored for the chart */
  anyRows: boolean;
  /** the last sync run ended in an error (`kundlis.last_sync_error`) */
  syncFailed: boolean;
  /** READING_PREP=1: after the chart is ready the stage is `preparing` until the queue (phase 2) moves it on */
  prep?: boolean;
}

export interface PipelineStatus {
  stage: PipelineStage;
  verdict: Verdict;
  verdicts: { chat: Verdict; pass1: Verdict };
  gaps: Gap[];
  done: number;
  total: number;
  counts: Record<ItemState, number>;
  items: ManifestItem[];
}

const STATES: readonly ItemState[] = ['ok', 'missing', 'fetching', 'waiting', 'retrying', 'gap', 'filling'];

/** The stage, from the items and the chart's own state. */
export function stageOf(items: readonly ManifestItem[], c: PipelineContext): PipelineStage {
  const req = items.filter((x) => x.required);
  if (!c.anyRows && !c.leaseHeld) return c.syncFailed ? 'blocked' : 'registered';
  if (req.some((x) => x.state === 'missing' || x.state === 'fetching')) return c.syncFailed && !c.leaseHeld ? 'blocked' : 'pulling';
  if (req.some((x) => x.state === 'retrying' || x.state === 'gap')) return 'blocked';
  if (c.digestStatus === 'building') return 'chart_ready';
  if (c.digestStatus !== 'ready' || req.some((x) => x.state === 'waiting')) return 'checking';
  return c.prep ? 'preparing' : 'ready';
}

/** PURE. The manifest, its verdicts, gaps, counts and the stage. */
export function computePipeline(input: ManifestInput, c: PipelineContext): PipelineStatus {
  const items = buildManifest(input);
  const counts = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const x of items) counts[x.state] += 1;
  // progress counts what is meant to arrive now; optional items still filling in behind are left out
  const counted = items.filter((x) => x.state !== 'filling');
  return {
    stage: stageOf(items, c),
    verdict: verdictOf(items),
    verdicts: { chat: verdictOf(items, 'chat'), pass1: verdictOf(items, 'pass1') },
    gaps: gapsOf(items),
    done: counted.filter((x) => x.state === 'ok' || x.state === 'gap').length,
    total: counted.length,
    counts,
    items,
  };
}

/** The view served to the person, from a stage and the gate's lock. */
export function pipelineView(stage: PipelineStage, done: number, total: number, lock: { locked: boolean; reason: PipelineView['reason'] }): PipelineView {
  return { stage, done, total, line: STAGE_LINES[stage], locked: lock.locked, reason: lock.locked ? lock.reason : null };
}

// ---------------------------------------------------------------------------------------------------------------------
// Loading from the stored rows
// ---------------------------------------------------------------------------------------------------------------------

const ayanamsa = 'LAHIRI';
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** This and last year's yearly keys (the set's own key list, D1/D9/D10 today), as stored `{ dataType, variant }`. */
export function thisAndLastYearKeys(types: readonly ChartDataType[], now: Date): Array<{ dataType: string; variant: string }> {
  const year = now.getUTCFullYear();
  const map = new Map(types.map((t) => [t.id, t]));
  const out: Array<{ dataType: string; variant: string }> = [];
  for (const key of annualSetKeys(year, 1)) {
    const y = Number(/@(\d{4})/.exec(key)?.[1]);
    if (y !== year && y !== year - 1) continue;
    const p = parseKey(key, map);
    if (!p.error) out.push({ dataType: p.id, variant: p.variant });
  }
  return out;
}

export interface PipelineLoadDeps {
  /** the clock set the sync pulls (default: loadReadingClockSet(...).pulled); null when unknown */
  clockSet?: (prisma: PrismaClient, kundliId: string) => Promise<string[] | null>;
  /** the registration plan (default: from the catalogue) */
  plan?: () => Promise<{ requested: ChartDataType[]; gate: ChartDataType[] }>;
}

async function defaultClockSet(prisma: PrismaClient, kundliId: string): Promise<string[] | null> {
  const { loadReadingClockSet } = await import('../self/sub/pressure.js');
  return (await loadReadingClockSet(prisma, kundliId)).pulled;
}

/** Everything the manifest reads, from the stored rows. Null when the chart does not exist. Throws on a failed read. */
export async function loadPipelineInput(prisma: PrismaClient, kundliId: string, now: Date, deps: PipelineLoadDeps = {}): Promise<{ input: ManifestInput; context: PipelineContext } | null> {
  const kundli = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { digest_status: true, queue_started_at: true, last_sync_error: true } });
  if (!kundli) return null;
  const [plan, rows, failed, appRow] = await Promise.all([
    deps.plan ? deps.plan() : loadRegistrationPlan(chartDataDeps(prisma), now.getTime()),
    prisma.kundliData.findMany({
      where: { kundli_id: kundliId, ayanamsa },
      select: { data_type: true, variant: true, status: true, calc_version: true, fetch_started_at: true, fetched_at: true, valid_to: true },
    }),
    // the failure count lives in the (sealed) error of failed rows only
    prisma.kundliData.findMany({ where: { kundli_id: kundliId, ayanamsa, status: 'failed' }, select: { data_type: true, variant: true, error: true } }),
    prisma.kundliData.findFirst({ where: { kundli_id: kundliId, data_type: 'dasha.applicable', variant: '', ayanamsa, status: 'ready' }, select: { payload: true } }),
  ]);
  const errors = new Map(failed.map((r) => [`${r.data_type}|${r.variant}`, r.error]));
  const stored: StoredStatusRow[] = rows.map((r) => ({
    dataType: r.data_type,
    variant: r.variant,
    status: r.status,
    calcVersion: r.calc_version,
    error: errors.get(`${r.data_type}|${r.variant}`) ?? null,
    fetchStartedAt: r.fetch_started_at,
    fetchedAt: r.fetched_at,
    validTo: r.valid_to,
  }));
  const digestUsable = kundli.digest_status === 'ready' || kundli.digest_status === 'stale';
  const [spanRows, levelRows, clockSet] = digestUsable
    ? await Promise.all([
        prisma.kundliActivation.findMany({ where: { kundli_id: kundliId, level: { lte: 2 } }, select: { system: true, level: true, from_date: true, to_date: true } }),
        prisma.kundliActivation.groupBy({ by: ['system', 'level'], where: { kundli_id: kundliId } }),
        (deps.clockSet ?? defaultClockSet)(prisma, kundliId).catch(() => null),
      ])
    : [[], [], null];
  const spans: ActivationSpan[] = spanRows.map((r) => ({ system: r.system, level: r.level, from: iso(r.from_date), to: iso(r.to_date) }));
  const levels = new Map<string, Set<number>>();
  for (const r of levelRows as Array<{ system: string; level: number }>) levels.set(r.system, (levels.get(r.system) ?? new Set<number>()).add(r.level));
  const leaseAt = kundli.queue_started_at?.getTime();
  return {
    input: {
      now,
      requested: plan.requested,
      gate: plan.gate,
      rows: stored,
      applicability: appRow?.payload != null ? parseApplicability(appRow.payload) : null,
      digestStatus: kundli.digest_status,
      spans,
      levels,
      clockSet,
      annualYearKeys: thisAndLastYearKeys(plan.requested, now),
      requiredDashas: getPipelineRequiredDashas(),
      yearsAhead: ACTIVATION_YEARS_AHEAD,
    },
    context: {
      digestStatus: kundli.digest_status,
      leaseHeld: leaseAt != null && now.getTime() - leaseAt <= getKundliSyncLeaseMs(),
      anyRows: rows.length > 0,
      syncFailed: Boolean(kundli.last_sync_error),
      prep: isReadingPrepEnabled(),
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The stored row (M56)
// ---------------------------------------------------------------------------------------------------------------------

export interface PipelineRow {
  stage: PipelineStage;
  verdict: Verdict;
  done: number;
  total: number;
  gaps: Gap[];
  updatedAt: Date;
}

type PipelinePrisma = {
  kundliPipeline?: {
    findUnique?: (q: unknown) => Promise<{ stage: string; verdict: string; done: number; total: number; gaps: unknown; updated_at: Date } | null>;
    upsert?: (q: unknown) => Promise<unknown>;
  };
};

let missingTableLogged = false;
function logMissingOnce(where: string): void {
  if (missingTableLogged) return;
  missingTableLogged = true;
  queueLog({ event: 'kundli_pipeline_table_missing', where, note: 'M56 not applied; the status is computed and not stored' });
}

/** The stored status row, or null (none yet, or M56 not applied). Never throws. */
export async function readPipelineRow(prisma: PrismaClient, kundliId: string): Promise<PipelineRow | null> {
  try {
    const r = await (prisma as unknown as PipelinePrisma).kundliPipeline?.findUnique?.({ where: { kundli_id: kundliId }, select: { stage: true, verdict: true, done: true, total: true, gaps: true, updated_at: true } });
    if (!r) return null;
    return { stage: r.stage as PipelineStage, verdict: r.verdict as Verdict, done: r.done, total: r.total, gaps: Array.isArray(r.gaps) ? (r.gaps as Gap[]) : [], updatedAt: r.updated_at };
  } catch (e) {
    if (isMissingTable(e)) logMissingOnce('read');
    else queueLogError({ event: 'kundli_pipeline_read_failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 200) });
    return null;
  }
}

/** Write the status row. Never throws; false when it was not written. */
export async function writePipelineRow(prisma: PrismaClient, kundliId: string, s: PipelineStatus, now: Date): Promise<boolean> {
  const data = {
    stage: s.stage,
    verdict: s.verdict,
    gaps: s.gaps as unknown as object,
    done: s.done,
    total: s.total,
    counts: { ...s.counts, chat: s.verdicts.chat, pass1: s.verdicts.pass1 },
    updated_at: now,
  };
  try {
    const upsert = (prisma as unknown as PipelinePrisma).kundliPipeline?.upsert;
    if (!upsert) return false;
    await upsert({ where: { kundli_id: kundliId }, create: { kundli_id: kundliId, ...data }, update: data });
    return true;
  } catch (e) {
    if (isMissingTable(e)) logMissingOnce('write');
    else queueLogError({ event: 'kundli_pipeline_write_failed', kundli_id: kundliId, error: (e as Error).message?.slice(0, 200) });
    return false;
  }
}

/**
 * Recompute the chart's status from the stored rows and store it. Called at the end of every sync, digest and clock run.
 * Never throws; null when the chart is gone or a read failed (logged).
 */
export async function recomputePipeline(prisma: PrismaClient, kundliId: string, opts: { now?: Date; trigger: 'sync' | 'digest' | 'clock' | 'script'; deps?: PipelineLoadDeps }): Promise<PipelineStatus | null> {
  const now = opts.now ?? new Date();
  try {
    const loaded = await loadPipelineInput(prisma, kundliId, now, opts.deps);
    if (!loaded) return null;
    const s = computePipeline(loaded.input, loaded.context);
    const stored = await writePipelineRow(prisma, kundliId, s, now);
    queueLog({
      event: 'kundli_pipeline',
      kundli_id: kundliId,
      trigger: opts.trigger,
      stage: s.stage,
      verdict: s.verdict,
      chat: s.verdicts.chat,
      pass1: s.verdicts.pass1,
      done: s.done,
      total: s.total,
      gaps: s.gaps.slice(0, 12).map((g) => `${g.id}:${g.code}`),
      stored,
    });
    return s;
  } catch (e) {
    queueLogError({ event: 'kundli_pipeline_recompute_failed', kundli_id: kundliId, trigger: opts.trigger, error: (e as Error).message?.slice(0, 200) });
    return null;
  }
}
