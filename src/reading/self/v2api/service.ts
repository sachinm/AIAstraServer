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
import { queueSelfReadingBuild, readBuildMarker, readBuildMarkerDetail, type BuildMarkerState, type QueueOutcome } from '../buildEvent.js';
import { buildView, type QueueMarkerView, type SelfV2BuildView, type V2MarkerView } from '../v2/progress.js';
import { readSelfV2Marker } from '../v2/store.js';
import { parseApplicability, resolveClockV2, type ApplicabilityRow, type ClockResolutionV2, type SystemPresence } from '../clock.js';
import { defaultSystemsPresent, readApplicableRow, type ApplicableRow } from '../service.js';
import type { Mood, ProfilePack, SelfV2AreaId, SelfV2RefreshView, SelfV2Response } from '../v2types.js';
import { selfBoardDates, selfV2OwnsBoard, type BoardValidity } from '../synthesisValidity.js';
import type { HeldOracleRow } from '../v2/store.js';
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
  /** the board's refresh dates (default: selfBoardDates, the rule the v1 board and POST /api/boards/self/refresh use) */
  refreshDates?: (prisma: PrismaClient, kundliId: string, today: string, held?: HeldOracleRow | null) => Promise<BoardValidity | null>;
  /** today's You build marker (default: readBuildMarker, the `self.reading` row the build event marks) */
  buildMarker?: (prisma: PrismaClient, kundliId: string, now: Date) => Promise<BuildMarkerState>;
  /** the two markers the `build` progress view is made from (docs/loading-overlay/05); defaults read area_builds */
  progressMarkers?: (prisma: PrismaClient, kundliId: string, now: Date) => Promise<{ queue: QueueMarkerView; v2: V2MarkerView }>;
  now?: () => Date;
}

/**
 * The `refresh` block of GET /api/self/v2. A read that fails shows nothing due (never a button that 409s). `building` and
 * `failed` come from today's You build marker: a fresh reading that failed is shown at once, not after the poll times out.
 * A build marked stuck (dead) is neither; the page's own timeout covers it.
 */
async function refreshView(
  deps: SelfV2Deps,
  kundliId: string,
  today: string,
  now: Date,
  sharedMarker?: Promise<BuildMarkerState>,
  held?: HeldOracleRow | null,
): Promise<SelfV2RefreshView> {
  const dates = deps.refreshDates ?? ((p, k, t, h) => selfBoardDates(p, k, t, null, h));
  const [d, marker] = await Promise.all([
    dates(deps.prisma, kundliId, today, held).catch((e) => {
      console.warn('[self:v2] refresh dates failed:', (e as Error).message);
      return null;
    }),
    (sharedMarker ?? (deps.buildMarker ?? ((p, k, n) => readBuildMarker(p, k, 'self', n)))(deps.prisma, kundliId, now)).catch(() => 'none' as const),
  ]);
  const building = marker === 'building';
  const failed = marker === 'failed' || marker === 'failed_recently';
  return d ? { madeAt: d.made_at, validUntil: d.valid_until, due: d.refresh_due, building, failed } : { madeAt: null, validUntil: null, due: false, building, failed };
}

const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

const applicabilityOf = (row: ApplicableRow): ApplicabilityRow[] | null =>
  row?.payload !== undefined && row?.payload !== null ? parseApplicability(row.payload) : null;

/** `row`: the `dasha.applicable` row a caller already holds (or is reading); without it the row is read here */
export async function defaultLoadApplicability(prisma: PrismaClient, kundliId: string, row?: ApplicableRow | Promise<ApplicableRow>): Promise<ApplicabilityRow[] | null> {
  return applicabilityOf(row === undefined ? await readApplicableRow(prisma, kundliId) : await row);
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
  // the two default readers both want the engine's `dasha.applicable` row: it is read once and handed to both
  const row = !deps.systemsPresent || !deps.loadApplicability ? readApplicableRow(deps.prisma, kundliId) : undefined;
  const [present, applicability] = await Promise.all([
    deps.systemsPresent ? deps.systemsPresent(deps.prisma, kundliId) : defaultSystemsPresent(deps.prisma, kundliId, row),
    deps.loadApplicability ? deps.loadApplicability(deps.prisma, kundliId) : defaultLoadApplicability(deps.prisma, kundliId, row),
  ]);
  return resolveClockV2(preferred, present, applicability);
}

/** `kundliId`: the chart the body was read for (null without one), so a caller does not look it up again */
export type GetSelfV2Result = { body: SelfV2Response; queued: QueueOutcome | null; kundliId?: string | null };

/** GET /api/self/v2 for the signed-in person. */
export async function getSelfV2(deps: SelfV2Deps, userId: string): Promise<GetSelfV2Result> {
  const prisma = deps.prisma;
  const kundli = await latestKundli(prisma, userId);
  if (!kundli) return { body: noKundliResponse(), queued: null, kundliId: null };
  const now = (deps.now ?? (() => new Date()))();
  const asOf = dayOf(now);
  // everything that does not need the clock starts now and overlaps the clock read
  const markersP = (deps.progressMarkers ?? defaultProgressMarkers)(prisma, kundli.id, now).catch(() => null);
  // on the default path the refresh block's build marker is the same `area_builds` row the progress markers read
  const sharedMarker = !deps.buildMarker && !deps.progressMarkers ? markersP.then((m) => (m ? m.queue.state : readBuildMarker(prisma, kundli.id, 'self', now))) : undefined;
  const profileP = (deps.loadProfile ?? loadProfilePack)(prisma, userId, asOf);
  const floorsP = deps.floors ? deps.floors(prisma, userId, kundli.id).catch(() => ({})) : Promise.resolve({});
  // With the v2 build owning the board, the refresh dates come from the Oracle row the board read below already holds, so
  // the block waits for that read and asks the database for nothing more; otherwise it reads its own rows now.
  const refreshP = selfV2OwnsBoard() ? null : refreshView(deps, kundli.id, asOf, now, sharedMarker);
  // a rejection is read at the await below; until then it must not be reported as unhandled
  profileP.catch(() => undefined);
  const clock = await clockFor(deps, kundli.id, kundli.preferred_dasha);
  const [latest, profile, floors, early, markers] = await Promise.all([
    // only the board clock's build: after a switch the old clock's cards are not served as the new one's
    (deps.readLatest ?? defaultReadSelfV2Latest)(prisma, kundli.id, clock.primary),
    profileP,
    floorsP,
    refreshP,
    markersP,
  ]);
  const refresh = early ?? (await refreshView(deps, kundli.id, asOf, now, sharedMarker, latest.oracleRow));

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
  } else {
    if (latest.status === 'pending') {
      // a rebuild is running over an earlier build: serve the earlier one, the page keeps polling
      status = latest.cards ? 'ok' : 'pending';
    }
    // the page's Try again (docs/loading-overlay/05): today's build is stuck, or failed past its cooldown, or the board
    // has no cards for this clock and no build ran today. queueSelfReadingBuild still refuses one that is building or
    // failed in the last 30 min, so a page reload never stacks builds. A build that ran today and still left no cards
    // is not re-run here (it would only fail again): it shows as ready/failed and is filed in docs/TODOS.md.
    const q = markers?.queue.state;
    const retry = q === 'stuck' || q === 'failed' || (!latest.cards && (q === 'none' || q === undefined));
    if (retry && (!kundli.digest_status || kundli.digest_status === 'ready')) {
      queued = await (deps.queueBuild ?? defaultQueueBuild)(prisma, userId, kundli.id, clock.primary).catch((e) => {
        console.warn('[self:v2] re-queue failed:', (e as Error).message);
        return 'skipped' as const;
      });
    }
  }
  // nothing was queued: the markers read above are still today's, so they are not read again
  const build =
    queued === null && markers
      ? buildView(markers.queue, markers.v2, now, false)
      : await progressFor(deps, kundli.id, now, queued === 'invoked' || queued === 'in_process' || queued === 'already_building');
  return { body: buildSelfV2Response({ status, latest, clock, profile, floors, refresh, build }), queued, kundliId: kundli.id };
}

async function defaultProgressMarkers(prisma: PrismaClient, kundliId: string, now: Date): Promise<{ queue: QueueMarkerView; v2: V2MarkerView }> {
  const [q, v2] = await Promise.all([readBuildMarkerDetail(prisma, kundliId, 'self', now), readSelfV2Marker(prisma, kundliId, now)]);
  return { queue: { state: q.state, startedAt: q.startedAt }, v2 };
}

/** GET /api/self/v2 `build`. Never throws: a failed read is "no build". */
async function progressFor(deps: SelfV2Deps, kundliId: string, now: Date, queuedNow: boolean): Promise<SelfV2BuildView> {
  try {
    const m = await (deps.progressMarkers ?? defaultProgressMarkers)(deps.prisma, kundliId, now);
    return buildView(m.queue, m.v2, now, queuedNow);
  } catch (e) {
    console.warn('[self:v2] build progress read failed:', (e as Error).message);
    return buildView({ state: 'none', startedAt: null }, { status: null, stage: null, stageAt: null }, now, queuedNow);
  }
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
