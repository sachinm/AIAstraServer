/**
 * docs/billing/03 "Per-lens refresh" (Sachin 2026-11-19): Love and Work boards and their lenses (sub-dashboards) charge
 * one question per refresh, per lens; each lens's first-ever reading is free; opening never charges and never re-reads a
 * card that has a stored reading; each lens has its own Good until; Try again is free for a failed or unread card only. Fakes only: no database, no model.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { lensRefreshKey, QuestionGate } from '../../../../src/billing/questionGate.js';
import { lensRefreshOutcome, settleLensRefreshes } from '../../../../src/reading/boards/lensRefreshSettle.js';
import { lensValidityFrom } from '../../../../src/reading/boards/lensValidity.js';
import type { QueueOutcome } from '../../../../src/reading/self/buildEvent.js';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../src/reading/self/v2api/storeContract.js';
import type { BoardValidity } from '../../../../src/reading/self/synthesisValidity.js';
import { registerAreaRoutes } from '../../../../src/routes/areaRoutes.js';
import { registerBoardCardsRoutes } from '../../../../src/routes/boardCardsRoutes.js';
import { registerBoardV3Routes } from '../../../../src/routes/boardV3Routes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { PRESENT, latestFixture } from '../self/v2api/fixtures.js';
import { MemoryPlanStore } from '../self/v2api/memoryPlanStore.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
let NOW = new Date('2026-12-06T12:00:00Z');
const ENV = ['SELF_V3_BUILD', 'READING_CLOCK_LAYER', 'BOARDS_V3', 'AREA_ENABLED'];
const saved: Record<string, string | undefined> = {};

function fakePrisma() {
  const layouts = new Map<string, any>();
  const builds = new Map<string, any>();
  let tick = 0;
  const stamp = () => new Date(NOW.getTime() + ++tick * 1000);
  const bk = (w: any) => `${w.kundli_id_area_as_of.kundli_id}|${w.kundli_id_area_as_of.area}|${new Date(w.kundli_id_area_as_of.as_of).toISOString()}`;
  const lk = (k: string, b: string) => `${k}|${b}`;
  return {
    builds,
    prisma: {
      kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' } : null) },
      kundliData: { findFirst: async () => null },
      auth: { findUnique: async () => ({ date_of_birth: '1990-03-01', gender: null, role: 'novice' }) },
      personFact: { findMany: async () => [], upsert: async ({ create }: any) => create },
      analyticsEvent: { create: async ({ data }: any) => data },
      areaCheck: { findMany: async () => [] },
      // the stored card rows the lens's dates come from: one per read card, `meta` sets its made time and valid_to
      techniqueOutput: {
        findMany: async ({ where }: any) => {
          const ids: string[] = (where.OR ?? []).map((o: any) => /card=(\w+)\|/.exec(o.digest_version.startsWith)![1]);
          return Object.entries(readings)
            .filter(([id]) => ids.includes(id))
            .map(([id, c]) => ({ output: { card: id, content: c }, created_at: new Date(meta[id]?.created ?? '2026-11-06T10:00:00Z'), valid_to: new Date(meta[id]?.validTo ?? '2026-12-06T00:00:00Z') }));
        },
      },
      areaBuild: {
        findUnique: async ({ where }: any) => builds.get(bk(where)) ?? null,
        findFirst: async () => null,
        upsert: async ({ where, create, update }: any) => {
          const k = bk(where);
          builds.set(k, builds.has(k) ? { ...builds.get(k), ...update } : { ...create });
          return builds.get(k);
        },
      },
      boardLayout: {
        findUnique: async ({ where }: any) => layouts.get(lk(where.kundli_id_board.kundli_id, where.kundli_id_board.board)) ?? null,
        create: async ({ data }: any) => {
          const row = { template: 'seasons', sections: {}, options: {}, board_options: {}, ...data, updated_at: stamp() };
          layouts.set(lk(data.kundli_id, data.board), row);
          return row;
        },
        updateMany: async ({ where, data }: any) => {
          const k = lk(where.kundli_id, where.board);
          const row = layouts.get(k);
          if (!row || row.updated_at < where.updated_at.gte || row.updated_at >= where.updated_at.lt) return { count: 0 };
          layouts.set(k, { ...row, ...data, updated_at: stamp() });
          return { count: 1 };
        },
        upsert: async ({ where, create, update }: any) => {
          const k = lk(where.kundli_id_board.kundli_id, where.kundli_id_board.board);
          const row = { ...(layouts.get(k) ?? create), ...update, updated_at: stamp() };
          layouts.set(k, row);
          return row;
        },
      },
    } as any,
  };
}

let f = fakePrisma();
let readings: Record<string, any> = {};
let meta: Record<string, { created?: string; validTo?: string }> = {};
let dates: BoardValidity | null = null;
let outcome: QueueOutcome = 'invoked';
const queuedBuilds: string[] = [];
let store = new MemoryPlanStore(NOW);
let gate = new QuestionGate(store, { enabled: true, now: () => NOW, env: { PLAN_FREE_QUESTIONS: '3' } as NodeJS.ProcessEnv });
let base = '';
let server: ReturnType<express.Express['listen']>;

// a card read with the full-thread reading (a technical story); `bare` is one read before it (deeperReadingReady)
const content = (line: string) => ({ line, story: 'The technical story.', spans: [{ span: 's1', from: '2026-11-01', to: '2027-01-05', tone: 'mixed', mode: 'build', asks: 'Go out more.', obstacle: 'Tired evenings.', step: 'If a friend asks, then say yes.', held: true }], confirm: null, pattern: null, ladder: null, agreement: { agree: 3, of: 4 } });
const doc = () => f.builds.get(`k1|self.cards|${new Date(`${NOW.toISOString().slice(0, 10)}T00:00:00Z`).toISOString()}`)?.result;
const used = async () => (await gate.getStatus('u1'))?.used ?? 0;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  process.env.SELF_V3_BUILD = '1';
  process.env.READING_CLOCK_LAYER = '1';
  const app = express();
  app.use(express.json());
  const prisma = new Proxy({}, { get: (_t, k) => f.prisma[k as string] }) as never;
  const requireUser = fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null);
  const queueBuild = async (_p: unknown, _u: string, k: string) => (queuedBuilds.push(k), outcome);
  const readCardReadings = async (_p: unknown, _k: string, _c: string, ids?: readonly string[]) => Object.fromEntries(Object.entries(readings).filter(([id]) => !ids || ids.includes(id)));
  const v3 = {
    now: () => NOW,
    readLatest: async (): Promise<SelfV2Latest> => latestFixture() ?? { ...NOTHING_STORED },
    systemsPresent: async () => PRESENT,
    queueBuild: async () => 'invoked' as const,
    queueDigest: async () => undefined,
    progressMarkers: async () => ({ queue: { state: 'none' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
    buildMarker: async () => 'none' as const,
    refreshDates: async () => dates,
    readCardReadings: readCardReadings as never,
    queueCardsBuild: queueBuild,
    planOf: async () => 'free' as const,
    featureOverrides: async () => new Map(),
  };
  const cards = { now: () => NOW, queueBuild, clockOf: async () => 'vimsottari', readCardReadings: readCardReadings as never };
  registerBoardV3Routes(app, { prisma, requireUser, v3, cards });
  registerBoardCardsRoutes(app, { prisma, requireUser, v3: cards });
  const lensGate = {
    reserveLensRefresh: (...a: Parameters<QuestionGate['reserveLensRefresh']>) => gate.reserveLensRefresh(...a),
    settleLensRefresh: (...a: Parameters<QuestionGate['settleLensRefresh']>) => gate.settleLensRefresh(...a),
    getStatus: (u: string) => gate.getStatus(u),
  };
  const youGate = {
    reserveBoardRefresh: (...a: Parameters<QuestionGate['reserveBoardRefresh']>) => gate.reserveBoardRefresh(...a),
    settleBoardRefresh: (...a: Parameters<QuestionGate['settleBoardRefresh']>) => gate.settleBoardRefresh(...a),
    getStatus: (u: string) => gate.getStatus(u),
  };
  registerAreaRoutes(app, { prisma, requireUser, enabled: true, now: () => NOW, gate: youGate, lensGate, lens: { v3, queueBuild, readCardReadings: readCardReadings as never } });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
beforeEach(() => {
  NOW = new Date('2026-12-06T12:00:00Z');
  f = fakePrisma();
  readings = {};
  meta = {};
  dates = { made_at: '2026-11-06T10:00:00.000Z', valid_until: '2026-12-05', refresh_due: true };
  outcome = 'invoked';
  queuedBuilds.length = 0;
  store = new MemoryPlanStore(NOW);
  gate = new QuestionGate(store, { enabled: true, now: () => NOW, env: { PLAN_FREE_QUESTIONS: '3' } as NodeJS.ProcessEnv });
  process.env.BOARDS_V3 = 'love,work';
});

const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(`${base}${path}`, { method, headers: { 'x-user': 'u1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  return { status: r.status, json: t ? (JSON.parse(t) as any) : null };
};
const deck = (cards: string[], lens?: string) => call('PUT', '/api/board/love/v3/layout', { version: '', patch: { cards, ...(lens ? { boardOptions: { lens } } : {}) } });
/** the cards' reads finished: each queued card is `done` (what the card runner writes) */
const finish = (ids: string[], at = NOW) => {
  const d = doc();
  for (const id of ids) d.cards[id] = { state: 'done', at: new Date(at.getTime() + 60_000).toISOString() };
};

describe('open never charges and never re-reads a stored card', () => {
  it('a lens never read is read free on open; a later day serves the stored readings and queues nothing', async () => {
    await deck(['dating_pulse', 'dating_delays_blocks']);
    f.builds.clear();
    queuedBuilds.length = 0;
    const g1 = await call('GET', '/api/board/love/v3');
    expect(g1.json.cards.find((c: any) => c.id === 'dating_pulse').state).toBe('queued');
    expect(queuedBuilds).toEqual(['k1']);
    // read; the next day the stored readings are served as they are
    readings = { dating_pulse: content('Warmer from 5 Jan 2027.'), dating_delays_blocks: content('Slow till spring.') };
    NOW = new Date('2026-12-07T09:00:00Z');
    queuedBuilds.length = 0;
    const g2 = await call('GET', '/api/board/love/v3');
    expect(g2.json.cards.find((c: any) => c.id === 'dating_pulse')).toMatchObject({ state: 'ready', firstLine: 'Warmer from 5 Jan 2027.' });
    expect(queuedBuilds).toEqual([]);
    expect(await used()).toBe(0);
  });

  it('a card newly added to the deck with Edit, never read, is read free; the read ones are not queued', async () => {
    readings = { dating_pulse: content('Warmer.') };
    const put = await deck(['dating_pulse', 'dating_delays_blocks']);
    expect(put.json.reading).toEqual({ queued: ['dating_delays_blocks'] });
    expect(await used()).toBe(0);
  });

  it('Try again on a failed card is free', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse', 'dating_delays_blocks']);
    doc().cards.dating_delays_blocks = { state: 'failed', at: NOW.toISOString() };
    const r = await call('POST', '/api/board/love/v3/cards/dating_delays_blocks/read');
    expect(r.status).toBe(202);
    expect(await used()).toBe(0);
    expect(store.usage).toEqual([]);
  });

  it('each lens has its own Good until (its newest card readings): two lenses with different dates', async () => {
    readings = { dating_pulse: content('Warmer.'), dating_delays_blocks: content('Slow.'), friends_core_allies: content('Allies near.') };
    meta = {
      dating_pulse: { created: '2026-11-06T10:00:00Z', validTo: '2027-02-01T00:00:00Z' },
      dating_delays_blocks: { created: '2026-11-07T10:00:00Z', validTo: '2026-12-06T00:00:00Z' },
      friends_core_allies: { created: '2026-11-20T10:00:00Z', validTo: '2027-01-10T00:00:00Z' },
    };
    const put = await deck(['dating_pulse', 'dating_delays_blocks', 'friends_core_allies'], 'dating');
    // dating: the earliest last good day of its cards (5 Dec), made when its oldest card was read; today 6 Dec: due
    expect((await call('GET', '/api/board/love/v3')).json.refresh).toMatchObject({ madeAt: '2026-11-06T10:00:00.000Z', validUntil: '2026-12-05', due: true });
    await call('PUT', '/api/board/love/v3/layout', { version: put.json.version, patch: { boardOptions: { lens: 'friends' } } });
    expect((await call('GET', '/api/board/love/v3')).json.refresh).toMatchObject({ madeAt: '2026-11-20T10:00:00.000Z', validUntil: '2027-01-09', due: false });
    // the refresh follows the same per-lens rule: friends is not due, dating is
    expect((await call('POST', '/api/boards/love/refresh', { lens: 'friends' })).json).toMatchObject({ code: 'not_due', valid_until: '2027-01-09' });
    expect((await call('POST', '/api/boards/love/refresh', { lens: 'dating' })).json).toMatchObject({ charged: true });
  });

  it('a refreshed lens is not due the next day; it is due again once its new readings expire', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    expect((await call('POST', '/api/boards/love/refresh')).json).toMatchObject({ charged: true });
    expect((await call('GET', '/api/board/love/v3')).json.refresh.due).toBe(false);
    // the forced read stored a new reading good until 10 Jan
    meta = { dating_pulse: { created: '2026-12-06T12:05:00Z', validTo: '2027-01-11T00:00:00Z' } };
    NOW = new Date('2026-12-07T09:00:00Z');
    expect((await call('GET', '/api/board/love/v3')).json.refresh).toMatchObject({ validUntil: '2027-01-10', due: false });
    expect((await call('POST', '/api/boards/love/refresh')).status).toBe(409);
    NOW = new Date('2027-01-11T09:00:00Z');
    expect((await call('GET', '/api/board/love/v3')).json.refresh).toMatchObject({ validUntil: '2027-01-10', due: true });
    expect((await call('POST', '/api/boards/love/refresh')).json).toMatchObject({ charged: true });
    // two questions, one per refresh (a new month's count starts again, so count the rows)
    expect(store.usage.map((u) => u.key)).toEqual([lensRefreshKey('love', 'dating', '2026-12-06'), lensRefreshKey('love', 'dating', '2027-01-11')]);
  });

  it('Try again on a card with a good reading is 409 already_read and queues nothing', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    queuedBuilds.length = 0;
    const r = await call('POST', '/api/board/love/v3/cards/dating_pulse/read');
    expect(r.status).toBe(409);
    expect(r.json).toEqual({ error: 'already_read' });
    expect(queuedBuilds).toEqual([]);
    // a card whose last try failed is free to try again, reading or not
    await call('GET', '/api/board/love/v3');
    doc().cards.dating_pulse = { state: 'failed', at: NOW.toISOString() };
    expect((await call('POST', '/api/board/love/v3/cards/dating_pulse/read')).status).toBe(202);
    // a never-read card too
    expect((await call('POST', '/api/board/love/v3/cards/dating_delays_blocks/read')).status).toBe(202);
  });
});

describe('POST /api/boards/love|work/refresh on v3: one question per lens', () => {
  it('a lens never read: the refresh is its first reading, free', async () => {
    await deck(['dating_pulse', 'dating_delays_blocks']);
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: 'queued', lens: 'dating', first: true, charged: false });
    expect(await used()).toBe(0);
    expect(store.usage).toEqual([]);
  });

  it('a read lens past Good until: one question under board:love:<lens>:refresh:<day>, its cards queued and forced', async () => {
    readings = { dating_pulse: content('Warmer.'), dating_delays_blocks: content('Slow.') };
    await deck(['dating_pulse', 'dating_delays_blocks', 'friends_core_allies'], 'dating');
    queuedBuilds.length = 0;
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: 'queued', lens: 'dating', charged: true, queued: ['dating_pulse', 'dating_delays_blocks'] });
    expect(r.json.usage.used).toBe(1);
    expect(store.usage.map((u) => [u.key, u.status])).toEqual([[lensRefreshKey('love', 'dating', '2026-12-06'), 'reserved']]);
    expect(queuedBuilds).toEqual(['k1']);
    const d = doc();
    expect(Object.keys(d.force).sort()).toEqual(['dating_delays_blocks', 'dating_pulse']);
    expect(d.lensRefresh['love:dating']).toMatchObject({ cards: ['dating_pulse', 'dating_delays_blocks'] });
    // the board no longer offers this lens today; another lens still is due
    expect((await call('GET', '/api/board/love/v3')).json.refresh.due).toBe(false);
    // a double tap the same day: free, nothing queued again
    queuedBuilds.length = 0;
    const again = await call('POST', '/api/boards/love/refresh');
    expect(again.json).toMatchObject({ repeat: true, charged: false, queued: [] });
    expect(queuedBuilds).toEqual([]);
    expect(await used()).toBe(1);
    // the build reads them and settles: committed
    finish(['dating_pulse', 'dating_delays_blocks']);
    await settleLensRefreshes(f.prisma, 'u1', 'k1', new Date(NOW.getTime() + 120_000), gate);
    expect(store.usage[0]!.status).toBe('committed');
    expect(doc().lensRefresh['love:dating'].outcome).toBe('committed');
    expect(doc().force).toEqual({});
    expect(await used()).toBe(1);
  });

  it('two lenses are charged separately; the body lens picks one; an unknown lens is 400', async () => {
    readings = { dating_pulse: content('Warmer.'), friends_core_allies: content('Allies near.') };
    await deck(['dating_pulse', 'friends_core_allies'], 'dating');
    expect((await call('POST', '/api/boards/love/refresh')).json).toMatchObject({ lens: 'dating', charged: true });
    expect((await call('POST', '/api/boards/love/refresh', { lens: 'friends' })).json).toMatchObject({ lens: 'friends', charged: true, queued: ['friends_core_allies'] });
    expect(await used()).toBe(2);
    expect(store.usage.map((u) => u.key)).toEqual([lensRefreshKey('love', 'dating', '2026-12-06'), lensRefreshKey('love', 'friends', '2026-12-06')]);
    expect((await call('POST', '/api/boards/love/refresh', { lens: 'business' })).status).toBe(400);
  });

  it('Work lenses charge the same way', async () => {
    readings = { job_pulse: content('Steady.') };
    await call('PUT', '/api/board/work/v3/layout', { version: '', patch: { cards: ['job_pulse'] } });
    const lens = (await call('GET', '/api/board/work/v3')).json.activeLens;
    const r = await call('POST', '/api/boards/work/refresh');
    expect(r.json).toMatchObject({ lens, charged: true });
    expect(store.usage.map((u) => u.key)).toEqual([lensRefreshKey('work', lens, '2026-12-06')]);
  });

  it('not due yet: 409 not_due with valid_until; nothing charged', async () => {
    readings = { dating_pulse: content('Warmer.') };
    meta = { dating_pulse: { validTo: '2027-01-06T00:00:00Z' } };
    await deck(['dating_pulse']);
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(409);
    expect(r.json).toMatchObject({ code: 'not_due', valid_until: '2027-01-05' });
    expect(store.usage).toEqual([]);
  });

  it('a card read before the full-thread reading (no story, deeperReadingReady) and not due: accepted and charged one question', async () => {
    const { story: _s, ...bare } = content('Warmer.');
    readings = { dating_pulse: bare, dating_delays_blocks: content('Slow.') };
    meta = { dating_pulse: { validTo: '2027-01-06T00:00:00Z' }, dating_delays_blocks: { validTo: '2027-01-06T00:00:00Z' } };
    await deck(['dating_pulse', 'dating_delays_blocks'], 'dating');
    queuedBuilds.length = 0;
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ status: 'queued', lens: 'dating', charged: true, queued: ['dating_pulse', 'dating_delays_blocks'] });
    expect(store.usage.map((u) => [u.key, u.status])).toEqual([[lensRefreshKey('love', 'dating', '2026-12-06'), 'reserved']]);
    expect(queuedBuilds).toEqual(['k1']);
    expect(await used()).toBe(1);
  });

  it('at the limit: 402 quota_exhausted, nothing queued, the stored cards stay as they are', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    for (const k of ['a', 'b', 'c']) await gate.reserve('u1', { key: k });
    queuedBuilds.length = 0;
    const before = JSON.stringify(doc());
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(402);
    expect(r.json).toMatchObject({ code: 'quota_exhausted', usage: { remaining: 0 } });
    expect(queuedBuilds).toEqual([]);
    expect(JSON.stringify(doc())).toBe(before);
    expect((await call('GET', '/api/board/love/v3')).json.cards.find((c: any) => c.id === 'dating_pulse')).toMatchObject({ state: 'ready', firstLine: 'Warmer.' });
  });

  it('no build to read the cards: the question is given back, the marks taken back, 409', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    outcome = 'failed_recently';
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(409);
    expect(store.usage[0]!.status).toBe('released');
    expect(await used()).toBe(0);
    expect(doc().force ?? {}).toEqual({});
    expect(doc().lensRefresh ?? {}).toEqual({});
  });

  it('every card of the refresh failed: the build gives the question back; a new ask that day is charged again', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    await call('POST', '/api/boards/love/refresh');
    doc().cards.dating_pulse = { state: 'failed', at: new Date(NOW.getTime() + 60_000).toISOString() };
    await settleLensRefreshes(f.prisma, 'u1', 'k1', new Date(NOW.getTime() + 120_000), gate);
    expect(store.usage[0]!.status).toBe('released');
    expect(await used()).toBe(0);
    const again = await call('POST', '/api/boards/love/refresh');
    expect(again.json).toMatchObject({ charged: true });
    expect(await used()).toBe(1);
  });

  it('a build already running takes the queued cards: the question stays held, 200', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    outcome = 'already_building';
    const r = await call('POST', '/api/boards/love/refresh');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ charged: true, queued: ['dating_pulse'] });
    expect(store.usage[0]!.status).toBe('reserved');
    expect(doc().force.dating_pulse).toBeTruthy();
  });

  it('charged is false when the gate counted nothing: an exempt role, plans off', async () => {
    readings = { dating_pulse: content('Warmer.'), friends_core_allies: content('Allies.') };
    await deck(['dating_pulse', 'friends_core_allies'], 'dating');
    store.role = 'admin';
    expect((await call('POST', '/api/boards/love/refresh')).json).toMatchObject({ status: 'queued', charged: false });
    store.role = 'novice';
    gate = new QuestionGate(store, { enabled: false, now: () => NOW });
    expect((await call('POST', '/api/boards/love/refresh', { lens: 'friends' })).json).toMatchObject({ status: 'queued', charged: false });
    expect(store.usage).toEqual([]);
  });

  it('a card still being read keeps the question held', async () => {
    readings = { dating_pulse: content('Warmer.') };
    await deck(['dating_pulse']);
    await call('POST', '/api/boards/love/refresh');
    const d = doc();
    expect(lensRefreshOutcome(d, d.lensRefresh['love:dating'], NOW)).toBe('pending');
    await settleLensRefreshes(f.prisma, 'u1', 'k1', NOW, gate);
    expect(store.usage[0]!.status).toBe('reserved');
  });
});

describe('lensValidityFrom (pure)', () => {
  it('valid_to gives the last good day; with none, the first span end from the day made; no rows, no dates', () => {
    const rows = [
      { output: { content: content('a') }, created_at: '2026-11-06T10:00:00Z', valid_to: '2026-12-20T00:00:00Z' },
      { output: { content: content('b') }, created_at: '2026-11-08T10:00:00Z', valid_to: null },
    ];
    expect(lensValidityFrom(rows, '2026-12-06')).toMatchObject({ madeAt: '2026-11-06T10:00:00.000Z', validUntil: '2026-12-19', due: false });
    expect(lensValidityFrom([rows[1]!], '2027-01-06')).toMatchObject({ validUntil: '2027-01-05', due: true });
    expect(lensValidityFrom([], '2026-12-06')).toMatchObject({ madeAt: null, validUntil: null, due: false });
    expect(lensValidityFrom(rows, '2026-12-06', { at: '2026-12-06T12:00:00.000Z', cards: [] }).madeAt).toBe('2026-12-06T12:00:00.000Z');
  });
});
