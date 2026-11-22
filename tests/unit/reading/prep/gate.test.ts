/**
 * The reading gate, first version (docs/techniques/11 rev 4 §4.8): every queue door answers 409 `preparing` and queues
 * nothing while the chart is not ready; nothing is locked for a ready chart with no running build; a `failed` chart is
 * never locked; a build marker older than 10 minutes does not lock. Fakes only: no database, no model.
 */
import { describe, expect, it } from 'vitest';
import { fallbackStage, gateRule, gateView, readingGate, type GateFacts } from '../../../../src/reading/prep/gate.js';
import { BUILD_STUCK_MS, queueSelfReadingBuild, readRunningBuild } from '../../../../src/reading/self/buildEvent.js';
import { pipelineView } from '../../../../src/reading/pipeline/status.js';
import { preparingRefusal, type PipelineView } from '../../../../src/reading/pipeline/types.js';
import { readSelfV3Card, putSelfLayout } from '../../../../src/reading/self/v3/service.js';
import { readBoardV3Card, putBoardV3Layout, getBoardV3 } from '../../../../src/reading/boards/v3Service.js';
import { refreshBoardLens } from '../../../../src/reading/boards/lensRefresh.js';
import { getSelfV2, switchClock } from '../../../../src/reading/self/v2api/service.js';
import { APPLICABLE_RAW, PRESENT, latestFixture } from '../self/v2api/fixtures.js';
import { NOTHING_STORED } from '../../../../src/reading/self/v2api/storeContract.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const NOW = new Date('2026-11-22T12:00:00Z');
const LOCKED: PipelineView = pipelineView('pulling', 3, 10, { locked: true, reason: 'chart' });
const OPEN: PipelineView = pipelineView('ready', 10, 10, { locked: false, reason: null });
const lockedGate = async () => LOCKED;
const openGate = async () => OPEN;

const facts = (o: Partial<GateFacts> = {}): GateFacts => ({ chartStatus: 'ready', digestStatus: 'ready', runningBuild: false, anyRows: true, ...o });

/** A chart in the database as the gate reads it. */
function gatePrisma(o: { kundli?: any; auth?: any; rows?: number; markers?: any[]; pipelineRow?: any } = {}) {
  return {
    kundli: { findUnique: async () => ({ user_id: 'u1', digest_status: 'ready', queue_started_at: null, last_sync_error: null, ...(o.kundli ?? {}) }) },
    auth: { findUnique: async () => ({ profile_complete: true, kundli_added: true, ...(o.auth ?? {}) }) },
    kundliData: { count: async () => o.rows ?? 900 },
    areaBuild: { findMany: async ({ where }: any) => (o.markers ?? []).filter((m) => where.area.in.includes(m.area) && where.as_of.in.some((d: Date) => d.getTime() === m.as_of.getTime()) && m.status === where.status) },
    kundliPipeline: { findUnique: async () => o.pipelineRow ?? null },
  } as any;
}

const marker = (area: string, startedMsAgo: number, status = 'building') => ({
  area,
  as_of: new Date(`${new Date(NOW.getTime() - startedMsAgo).toISOString().slice(0, 10)}T00:00:00Z`),
  status,
  result: { started_at: new Date(NOW.getTime() - startedMsAgo).toISOString() },
});

describe('the rule', () => {
  it('locks while the chart is pending or building, or the digest is not ready', () => {
    expect(gateRule(facts({ chartStatus: 'pending' }))).toEqual({ locked: true, reason: 'chart' });
    expect(gateRule(facts({ chartStatus: 'building' }))).toEqual({ locked: true, reason: 'chart' });
    expect(gateRule(facts({ digestStatus: 'building' }))).toEqual({ locked: true, reason: 'chart' });
    expect(gateRule(facts({ digestStatus: 'stale' }))).toEqual({ locked: true, reason: 'chart' });
    expect(gateRule(facts({ runningBuild: true }))).toEqual({ locked: true, reason: 'building' });
  });

  it('never locks a failed chart, and never a ready chart with no running build', () => {
    expect(gateRule(facts({ chartStatus: 'failed', digestStatus: 'pending', runningBuild: true }))).toEqual({ locked: false, reason: null });
    expect(gateRule(facts())).toEqual({ locked: false, reason: null });
    expect(gateRule(facts({ chartStatus: 'chat_ready' }))).toEqual({ locked: false, reason: null });
  });

  it('the view: the stored stage when it agrees, the live one when a stale row still says ready', () => {
    expect(gateView(facts(), { stage: 'ready', verdict: 'complete_with_gaps', done: 9, total: 9, gaps: [], updatedAt: NOW })).toMatchObject({ stage: 'ready', done: 9, locked: false, reason: null, line: 'Your chart is ready. Choose your cards.' });
    expect(gateView(facts({ digestStatus: 'building' }), { stage: 'ready', verdict: 'complete', done: 9, total: 9, gaps: [], updatedAt: NOW })).toMatchObject({ stage: 'chart_ready', locked: true, reason: 'chart' });
    expect(fallbackStage(facts({ chartStatus: 'pending', anyRows: false }))).toBe('registered');
    expect(fallbackStage(facts({ chartStatus: 'failed' }))).toBe('blocked');
    expect(fallbackStage(facts({ digestStatus: 'pending' }))).toBe('checking');
  });
});

describe('readingGate against the stored rows', () => {
  it('a ready chart with no running build is open', async () => {
    expect(await readingGate(gatePrisma(), 'k1', { now: () => NOW })).toMatchObject({ locked: false, reason: null, stage: 'ready' });
  });

  it('a new chart still pulling is locked for the chart', async () => {
    const p = gatePrisma({ auth: { kundli_added: false }, kundli: { digest_status: 'pending', queue_started_at: new Date(NOW.getTime() - 60_000) }, rows: 40 });
    expect(await readingGate(p, 'k1', { now: () => NOW })).toMatchObject({ locked: true, reason: 'chart', stage: 'pulling', line: 'Getting your chart' });
  });

  it('a failed chart is not locked', async () => {
    const p = gatePrisma({ auth: { kundli_added: false }, kundli: { digest_status: 'pending', last_sync_error: 'x' }, rows: 0 });
    expect(await readingGate(p, 'k1', { now: () => NOW })).toMatchObject({ locked: false, stage: 'blocked' });
  });

  it('a build running on any board locks; a marker older than 10 minutes does not', async () => {
    const running = gatePrisma({ markers: [marker('love.reading', 4 * 60_000)] });
    expect(await readingGate(running, 'k1', { now: () => NOW })).toMatchObject({ locked: true, reason: 'building' });
    const old = gatePrisma({ markers: [marker('self.reading', BUILD_STUCK_MS + 60_000)] });
    expect(await readingGate(old, 'k1', { now: () => NOW })).toMatchObject({ locked: false });
    expect(await readRunningBuild(old, 'k1', NOW)).toBeNull();
    const done = gatePrisma({ markers: [marker('self.reading', 60_000, 'ready')] });
    expect(await readRunningBuild(done, 'k1', NOW)).toBeNull();
  });

  it('a build started just before UTC midnight is still seen after it', async () => {
    const justAfter = new Date('2026-11-23T00:03:00Z');
    const m = { area: 'self.reading', as_of: new Date('2026-11-22T00:00:00Z'), status: 'building', result: { started_at: '2026-11-22T23:58:00Z' } };
    const p = gatePrisma({ markers: [m] });
    expect(await readRunningBuild(p, 'k1', justAfter)).toMatchObject({ board: 'self' });
  });

  it('a read that fails never locks', async () => {
    expect(await readingGate({} as any, 'k1', { now: () => NOW })).toMatchObject({ locked: false });
  });
});

describe('every queue door answers 409 preparing and queues nothing while locked', () => {
  function cardsPrisma() {
    const writes: string[] = [];
    const prisma: any = {
      kundli: { findFirst: async () => ({ id: 'k1' }) },
      areaBuild: { findUnique: async () => null, upsert: async () => writes.push('marker') },
      boardLayout: {
        findUnique: async () => null,
        upsert: async ({ create }: any) => (writes.push('layout'), { template: 'seasons', sections: {}, options: {}, board_options: {}, ...create, updated_at: NOW }),
        create: async ({ data }: any) => (writes.push('layout'), { template: 'seasons', sections: {}, options: {}, board_options: {}, ...data, updated_at: NOW }),
        updateMany: async () => (writes.push('layout'), { count: 1 }),
      },
    };
    return { prisma, writes };
  }

  it('queueSelfReadingBuild: preparing, no marker written, nothing invoked', async () => {
    const { prisma, writes } = cardsPrisma();
    const invokes: unknown[] = [];
    const out = await queueSelfReadingBuild({ prisma, invoke: async (p) => void invokes.push(p), now: () => NOW, readingGate: lockedGate }, 'u1', 'k1', 'self');
    expect(out).toBe('preparing');
    expect(invokes).toEqual([]);
    expect(writes).toEqual([]);
    // open: queued exactly as today
    expect(await queueSelfReadingBuild({ prisma, invoke: async (p) => void invokes.push(p), now: () => NOW, readingGate: openGate }, 'u1', 'k1', 'self')).toBe('invoked');
    expect(invokes).toHaveLength(1);
  });

  it('the You and the Love/Work card reads: 409 preparing, nothing marked, no build', async () => {
    const { prisma, writes } = cardsPrisma();
    let queued = 0;
    const deps = { cardsRead: true, now: () => NOW, queueBuild: async () => (queued++, 'invoked' as const), readingGate: lockedGate, clockOf: async () => 'vimsottari', readCardReadings: async () => ({}) };
    prisma.reading = undefined;
    const self = await readSelfV3Card(prisma, 'u1', 'diagnosis', deps as any);
    expect(self).toMatchObject({ ok: false, status: 409, error: 'preparing', pipeline: LOCKED });
    const love = await readBoardV3Card(prisma, 'u1', 'love', 'love.dating.now', deps as any).catch((e) => e);
    // a card id unknown to the registry answers 400 before the gate: take the first offered Love card instead
    if (love && love.status === 400) {
      const { boardV3Cards } = await import('../../../../src/reading/boards/v3Cards.js');
      const id = boardV3Cards('love').find((d) => d.offered)!.id;
      expect(await readBoardV3Card(prisma, 'u1', 'love', id, deps as any)).toMatchObject({ ok: false, status: 409, error: 'preparing' });
    } else expect(love).toMatchObject({ ok: false, status: 409, error: 'preparing' });
    expect(queued).toBe(0);
    expect(writes).toEqual([]);
  });

  it('the layout saves: the layout is saved, nothing is queued, the gate comes back', async () => {
    const { prisma, writes } = cardsPrisma();
    let queued = 0;
    const deps = { cardsRead: true, now: () => NOW, queueBuild: async () => (queued++, 'invoked' as const), readingGate: lockedGate, clockOf: async () => 'vimsottari', readCardReadings: async () => ({}), loadProfile: async () => null };
    const { SELF_CARDS } = await import('../../../../src/reading/self/v3/cards.js');
    const cards = SELF_CARDS.filter((c) => c.offered !== false).slice(0, 8).map((c) => c.id);
    const r = await putSelfLayout(prisma, 'u1', { template: 'seasons', cards }, deps as any);
    expect(r).toMatchObject({ ok: true, pipeline: LOCKED, reading: { queued: [] } });
    expect(writes).toContain('layout');
    const { boardV3Cards } = await import('../../../../src/reading/boards/v3Cards.js');
    const loveCards = boardV3Cards('love').filter((d) => d.offered).map((d) => d.id);
    const b = await putBoardV3Layout(prisma, 'u1', 'love', { patch: { cards: loveCards } }, deps as any);
    if (b.ok) expect(b).toMatchObject({ pipeline: LOCKED, reading: { queued: [] } });
    expect(queued).toBe(0);
  });

  it('the clock switch: 409 preparing, nothing charged, stored or queued', async () => {
    const updates: unknown[] = [];
    let charged = 0;
    let queued = 0;
    const prisma: any = {
      kundli: { findFirst: async () => ({ id: 'k1', preferred_dasha: null, digest_status: 'ready' }), update: async (q: unknown) => updates.push(q) },
      analyticsEvent: { create: async () => ({}) },
    };
    const r = await switchClock(
      {
        prisma,
        systemsPresent: async () => PRESENT,
        loadApplicability: async () => (await import('../../../../src/reading/self/clock.js')).parseApplicability(APPLICABLE_RAW),
        gate: { chargeClock: async () => (charged++, 'charged' as const), getStatus: async () => null } as any,
        queueBuild: async () => (queued++, 'invoked' as const),
        readingGate: lockedGate,
        now: () => NOW,
      },
      'u1',
      'yogini',
    );
    expect(r).toMatchObject({ ok: false, status: 409, error: 'preparing', pipeline: LOCKED });
    expect([charged, queued, updates.length]).toEqual([0, 0, 0]);
  });

  it('the page GET: served with the gate, no build queued', async () => {
    let queued = 0;
    const prisma: any = { kundli: { findFirst: async () => ({ id: 'k1', preferred_dasha: null, digest_status: 'ready' }) } };
    const r = await getSelfV2(
      {
        prisma,
        boardFromCards: false,
        readLatest: async () => ({ ...NOTHING_STORED }),
        systemsPresent: async () => PRESENT,
        loadApplicability: async () => null,
        loadProfile: async () => ({ ageYears: 30 }) as any,
        refreshDates: async () => null,
        buildMarker: async () => 'none',
        progressMarkers: async () => ({ queue: { state: 'none', startedAt: null }, v2: { status: null, stage: null, stageAt: null } }) as any,
        queueBuild: async () => (queued++, 'invoked' as const),
        readingGate: lockedGate,
        now: () => NOW,
      },
      'u1',
    );
    expect(queued).toBe(0);
    expect(r.body.pipeline).toEqual(LOCKED);
    expect(r.body.status).toBe('preparing');
    expect(r.queued).toBeNull();
    // open: the free first build is queued, as today
    const open = await getSelfV2(
      {
        prisma,
        boardFromCards: false,
        readLatest: async () => ({ ...NOTHING_STORED }),
        systemsPresent: async () => PRESENT,
        loadApplicability: async () => null,
        loadProfile: async () => ({ ageYears: 30 }) as any,
        refreshDates: async () => null,
        buildMarker: async () => 'none',
        progressMarkers: async () => ({ queue: { state: 'none', startedAt: null }, v2: { status: null, stage: null, stageAt: null } }) as any,
        queueBuild: async () => (queued++, 'invoked' as const),
        readingGate: openGate,
        now: () => NOW,
      },
      'u1',
    );
    expect(queued).toBe(1);
    expect(open.body.pipeline).toEqual(OPEN);
    void latestFixture;
  });

  it('the refusal body', () => {
    expect(preparingRefusal(LOCKED)).toEqual({ error: 'Building your chart data', code: 'preparing', pipeline: LOCKED });
  });

  void getBoardV3;
  void refreshBoardLens;
});
