/**
 * The Self board v2 API service (docs/reading-engine/66 §4.4, §4.5): read the latest stored build, resolve the clock,
 * switch the clock with consent and a charge, and store the confirm and mood taps. Nothing here calls a model: a page
 * open reads the store and, when nothing is stored, queues the build the same way GET /api/self/reading does.
 */
import type { PrismaClient } from '@prisma/client';
import { questionGate, type BoardChargeOutcome, type PlanStatus, type QuestionGate } from '../../../billing/questionGate.js';
import { SELF_CONFIRM_PREFIX, SELF_CONFIRM_ANSWERS, writeFacts } from '../../../profile/facts.js';
import { loadProfilePack } from '../../person/profile.js';
import { defaultQueueDigest } from '../../area/boardService.js';
import { queueSelfReadingBuild, type QueueOutcome } from '../buildEvent.js';
import { parseApplicability, resolveClockV2, type ApplicabilityRow, type ClockResolutionV2, type SystemPresence } from '../clock.js';
import { defaultSystemsPresent } from '../service.js';
import type { Mood, ProfilePack, SelfV2AreaId, SelfV2Response } from '../v2types.js';
import { buildSelfV2Response, noKundliResponse } from './response.js';
import { defaultReadSelfV2Latest, type ReadSelfV2Latest } from './storeContract.js';

export interface SelfV2Deps {
  prisma: PrismaClient;
  /** the agents lane's `readSelfV2Latest` (default: its module when present, else pending) */
  readLatest?: ReadSelfV2Latest;
  systemsPresent?: (prisma: PrismaClient, kundliId: string) => Promise<SystemPresence[]>;
  /** the engine's `dasha.applicable` rows; null when none is stored */
  loadApplicability?: (prisma: PrismaClient, kundliId: string) => Promise<ApplicabilityRow[] | null>;
  loadProfile?: (prisma: PrismaClient, userId: string, asOf: string) => Promise<ProfilePack>;
  /**
   * queues the Self build (default: queueSelfReadingBuild, the same helper GET /api/self/reading uses). `clock` is the
   * clock the build is for: the marker carries it, so a clock switch queues a build even while one runs on the old clock.
   */
  queueBuild?: (prisma: PrismaClient, userId: string, kundliId: string, clock?: string) => Promise<QueueOutcome>;
  queueDigest?: (prisma: PrismaClient, kundliId: string) => Promise<void>;
  gate?: Pick<QuestionGate, 'chargeClock' | 'getStatus'>;
  /** the legacy panels' code lines per area, when the integrator has them (optional) */
  floors?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<Partial<Record<SelfV2AreaId, string[]>>>;
  now?: () => Date;
}

const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

export async function defaultLoadApplicability(prisma: PrismaClient, kundliId: string): Promise<ApplicabilityRow[] | null> {
  const row = await prisma.kundliData
    ?.findFirst?.({ where: { kundli_id: kundliId, data_type: 'dasha.applicable' }, select: { payload: true } })
    .catch(() => null);
  return row?.payload !== undefined && row?.payload !== null ? parseApplicability(row.payload) : null;
}

const defaultQueueBuild = (prisma: PrismaClient, userId: string, kundliId: string, clock?: string): Promise<QueueOutcome> =>
  queueSelfReadingBuild({ prisma }, userId, kundliId, 'self', clock ? { clock } : {});

async function latestKundli(prisma: PrismaClient, userId: string) {
  return prisma.kundli.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    select: { id: true, preferred_dasha: true, digest_status: true },
  });
}

async function clockFor(deps: SelfV2Deps, kundliId: string, preferred: string | null): Promise<ClockResolutionV2> {
  const [present, applicability] = await Promise.all([
    (deps.systemsPresent ?? defaultSystemsPresent)(deps.prisma, kundliId),
    (deps.loadApplicability ?? defaultLoadApplicability)(deps.prisma, kundliId),
  ]);
  return resolveClockV2(preferred, present, applicability);
}

export type GetSelfV2Result = { body: SelfV2Response; queued: QueueOutcome | null };

/** GET /api/self/v2 for the signed-in person. */
export async function getSelfV2(deps: SelfV2Deps, userId: string): Promise<GetSelfV2Result> {
  const prisma = deps.prisma;
  const kundli = await latestKundli(prisma, userId);
  if (!kundli) return { body: noKundliResponse(), queued: null };
  const asOf = dayOf((deps.now ?? (() => new Date()))());
  const clock = await clockFor(deps, kundli.id, kundli.preferred_dasha);
  const [latest, profile, floors] = await Promise.all([
    // only the board clock's build: after a switch the old clock's cards are not served as the new one's
    (deps.readLatest ?? defaultReadSelfV2Latest)(prisma, kundli.id, clock.primary),
    (deps.loadProfile ?? loadProfilePack)(prisma, userId, asOf),
    deps.floors ? deps.floors(prisma, userId, kundli.id).catch(() => ({})) : Promise.resolve({}),
  ]);

  const nothingStored = !latest.cards && !latest.oracle;
  let status: SelfV2Response['status'] = 'ok';
  let queued: QueueOutcome | null = null;
  if (nothingStored && latest.status !== 'failed') {
    if (kundli.digest_status && kundli.digest_status !== 'ready') {
      await (deps.queueDigest ?? defaultQueueDigest)(prisma, kundli.id).catch((e) => console.warn('[self:v2] digest queue failed:', (e as Error).message));
      status = 'preparing';
    } else {
      queued = await (deps.queueBuild ?? defaultQueueBuild)(prisma, userId, kundli.id, clock.primary);
      status = 'pending';
    }
  } else if (latest.status === 'pending') {
    // a rebuild is running over an earlier build: serve the earlier one, the page keeps polling
    status = latest.cards ? 'ok' : 'pending';
  }
  return { body: buildSelfV2Response({ status, latest, clock, profile, floors }), queued };
}

export type SwitchClockResult =
  | { ok: false; status: 400 | 404; error: 'unknown_system' | 'not_applicable' | 'no_kundli' }
  | { ok: true; status: 200 | 202; body: { usage: PlanStatus | null; status: 'building' | 'unchanged'; alsoChanges: Array<'love' | 'work'> }; charged: BoardChargeOutcome | 'none' };

const SYSTEM_RE = /^[a-z0-9_]{1,40}$/;

/**
 * PUT /api/self/v2/clock (doc 66 §4.4): the consent path. The person saw the cost line and tapped. Reserve and commit
 * `board:self:<day>:clock:<system>` (a repeat the same day is free; at the limit the switch proceeds and nothing is
 * counted; exempt roles and limits off are never charged), write `kundlis.preferred_dasha`, log `clock_viewed`, queue
 * the build. The clock is the kundli's, so Love and Work change with it.
 */
export async function switchClock(deps: SelfV2Deps, userId: string, system: unknown): Promise<SwitchClockResult> {
  if (typeof system !== 'string' || !SYSTEM_RE.test(system)) return { ok: false, status: 400, error: 'unknown_system' };
  const prisma = deps.prisma;
  const kundli = await latestKundli(prisma, userId);
  if (!kundli) return { ok: false, status: 404, error: 'no_kundli' };
  const clock = await clockFor(deps, kundli.id, kundli.preferred_dasha);
  if (clock.notApplicable.some((n) => n.system === system)) return { ok: false, status: 400, error: 'not_applicable' };
  if (!clock.applicable.includes(system)) return { ok: false, status: 400, error: 'unknown_system' };
  const gate = deps.gate ?? questionGate(prisma);
  const from = clock.primary;

  if (from === system) {
    // already the board's clock: nothing is rebuilt and nothing is charged; the choice is stored as the person's
    if (kundli.preferred_dasha !== system) await prisma.kundli.update({ where: { id: kundli.id }, data: { preferred_dasha: system } });
    return { ok: true, status: 200, body: { usage: await gate.getStatus(userId), status: 'unchanged', alsoChanges: [] }, charged: 'none' };
  }

  const now = (deps.now ?? (() => new Date()))();
  const charged = await gate.chargeClock(userId, dayOf(now), system);
  await prisma.kundli.update({ where: { id: kundli.id }, data: { preferred_dasha: system } });
  try {
    await prisma.analyticsEvent.create({
      data: {
        user_id: userId,
        event: 'clock_viewed',
        surface: 'self',
        target: system,
        props: { kundli_id: kundli.id, from, to: system, charged: charged === 'charged', outcome: charged },
        at: now,
      },
    });
  } catch (e) {
    console.error('[self:v2] clock_viewed event failed:', (e as Error).message);
  }
  await (deps.queueBuild ?? defaultQueueBuild)(prisma, userId, kundli.id, system).catch((e) => {
    console.error('[self:v2] build queue failed:', (e as Error).message);
    return 'skipped' as const;
  });
  return { ok: true, status: 202, body: { usage: await gate.getStatus(userId), status: 'building', alsoChanges: ['love', 'work'] }, charged };
}

const CLAIM_RE = /^[a-z0-9_.]{1,60}$/;

/** POST /api/self/v2/confirm: `self.confirm.<claimId>` in person_facts. The next build reads it; no model runs here. */
export async function writeConfirm(prisma: PrismaClient, userId: string, body: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const b = (body ?? {}) as { claimId?: unknown; answer?: unknown };
  if (typeof b.claimId !== 'string' || !CLAIM_RE.test(b.claimId)) return { ok: false, error: 'bad_claim' };
  if (typeof b.answer !== 'string' || !(SELF_CONFIRM_ANSWERS as readonly string[]).includes(b.answer)) return { ok: false, error: 'bad_answer' };
  const r = await writeFacts(prisma, userId, { [`${SELF_CONFIRM_PREFIX}${b.claimId}`]: b.answer });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const MOODS: readonly Mood[] = ['heavy', 'mixed', 'fine'];

/** POST /api/self/v2/mood: `self.mood` = `<mood>:<YYYY-MM-DD>`, counted only that day (profile.moodFor). */
export async function writeMood(prisma: PrismaClient, userId: string, body: unknown, now: Date = new Date()): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const mood = (body as { mood?: unknown } | null | undefined)?.mood;
  if (typeof mood !== 'string' || !(MOODS as readonly string[]).includes(mood)) return { ok: false, error: 'bad_mood' };
  const value = `${mood}:${dayOf(now)}`;
  const r = await writeFacts(prisma, userId, { 'self.mood': value });
  return r.ok ? { ok: true, value } : { ok: false, error: r.error };
}
