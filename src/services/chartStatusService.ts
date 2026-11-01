/**
 * The one chart-build state the API exposes (docs/reading-engine/38 §4.1 flow E). It is worked out from the same rows the
 * worker writes, so there is no separate progress table to drift. Read-only: nothing here starts a build.
 */
import type { PrismaClient } from '@prisma/client';
import { getKundliSyncLeaseMs } from '../config/env.js';
import { chartDataDeps } from '../reading/chartData/tool.js';
import { loadRegistrationPlan } from '../reading/chartData/registration.js';
import { CURRENT_VARIANT, isMissingTable, type EnsureDeps } from '../reading/chartData/store.js';
import type { ChartDataType } from '../reading/chartData/catalog.js';
import { isReadingEngineEnabled } from '../reading/config.js';

export type ChartBuildStatus = 'pending' | 'building' | 'chat_ready' | 'ready' | 'failed';
export type ChartBuildStage = 'gate' | 'facts' | 'rest' | null;

export interface ChartStatus {
  status: ChartBuildStatus;
  stage: ChartBuildStage;
  gate_done: number;
  gate_total: number;
  rest_done: number;
  rest_total: number;
  facts_status: string;
  /** What chat answers with right now: `full` has the dossier, `legacy` is the basic chart only */
  reading_mode: 'full' | 'legacy';
  /** A sentence for the user. Never the raw error, which can carry internal names. */
  last_error: string | null;
}

export const CHART_BUILD_FAILED_MESSAGE = 'Some of the calculations did not finish.';

export interface ChartStatusInput {
  profileComplete: boolean;
  hasKundli: boolean;
  kundliAdded: boolean;
  factsStatus: string;
  leaseHeld: boolean;
  hasSyncError: boolean;
  gateDone: number;
  gateTotal: number;
  restDone: number;
  restTotal: number;
  readingEngine: boolean;
}

export function chartStatusFrom(i: ChartStatusInput): ChartStatus {
  const state = (status: ChartBuildStatus, stage: ChartBuildStage = null, lastError: string | null = null): ChartStatus => ({
    status,
    stage,
    gate_done: i.gateDone,
    gate_total: i.gateTotal,
    rest_done: i.restDone,
    rest_total: i.restTotal,
    facts_status: i.factsStatus,
    reading_mode: i.readingEngine && i.factsStatus === 'ready' ? 'full' : 'legacy',
    last_error: lastError,
  });
  if (!i.profileComplete || !i.hasKundli) return state('pending');
  if (i.kundliAdded) return i.restDone < i.restTotal ? state('chat_ready', 'rest') : state('ready');
  if (i.hasSyncError && !i.leaseHeld) return state('failed', null, CHART_BUILD_FAILED_MESSAGE);
  if (i.gateDone === 0 && !i.leaseHeld) return state('pending');
  if (i.gateDone < i.gateTotal || !i.readingEngine) return state('building', 'gate');
  return state('building', 'facts');
}

/** A row the worker has finished with, whatever the result. A row still `fetching` is not done. */
const SETTLED = new Set(['ready', 'failed', 'unsupported']);

function countSettled(types: readonly ChartDataType[], settled: ReadonlySet<string>): number {
  return types.filter((t) => settled.has(`${t.id}|${t.variantKind === 'year' ? CURRENT_VARIANT : ''}`)).length;
}

export async function getChartStatus(prisma: PrismaClient, userId: string, deps?: EnsureDeps): Promise<ChartStatus> {
  const [user, kundli, plan] = await Promise.all([
    prisma.auth.findUnique({ where: { id: userId }, select: { profile_complete: true, kundli_added: true } }),
    prisma.kundli.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { id: true, facts_status: true, queue_started_at: true, last_sync_error: true },
    }),
    loadRegistrationPlan(deps ?? chartDataDeps(prisma)),
  ]);
  const rows = kundli
    ? await prisma.kundliData
        .findMany({ where: { kundli_id: kundli.id, ayanamsa: 'LAHIRI' }, select: { data_type: true, variant: true, status: true } })
        .catch((err: unknown) => {
          if (isMissingTable(err)) return [];
          throw err;
        })
    : [];
  const settled = new Set(rows.filter((r) => SETTLED.has(r.status)).map((r) => `${r.data_type}|${r.variant}`));
  return chartStatusFrom({
    profileComplete: user?.profile_complete !== false,
    hasKundli: Boolean(kundli),
    kundliAdded: Boolean(user?.kundli_added),
    factsStatus: kundli?.facts_status ?? 'pending',
    leaseHeld: Boolean(kundli?.queue_started_at && Date.now() - kundli.queue_started_at.getTime() <= getKundliSyncLeaseMs()),
    hasSyncError: Boolean(kundli?.last_sync_error),
    gateDone: countSettled(plan.gate, settled),
    gateTotal: plan.gate.length,
    restDone: countSettled(plan.rest, settled),
    restTotal: plan.rest.length,
    readingEngine: isReadingEngineEnabled(),
  });
}
