/**
 * docs/dashboards/10 §4.3, §7 S7, S10: the Love and Work boards on the You v3 card machine. BOARDS_V3 unset → 404
 * board_v3_off; set → a You-shaped body with the board, its lenses and the active lens; the lens defaults from the
 * person's facts; build on open queues the lens deck's unread cards once a day; the layout PUT is dispatched on body shape; no
 * internal id or technique key reaches the body. Fakes only: no database, no model.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boardV3Cards } from '../../../../src/reading/boards/v3Cards.js';
import { answersLine, buildProfilePack } from '../../../../src/reading/person/profile.js';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../src/reading/self/v2api/storeContract.js';
import { registerBoardCardsRoutes } from '../../../../src/routes/boardCardsRoutes.js';
import { registerBoardV3Routes } from '../../../../src/routes/boardV3Routes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { PRESENT, latestFixture } from '../self/v2api/fixtures.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const ENV = ['SELF_V3_BUILD', 'READING_CLOCK_LAYER', 'BOARDS_V3', 'READING_SPEND_CAP_USD'];
const saved: Record<string, string | undefined> = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma(facts: Record<string, string>) {
  const layouts = new Map<string, any>();
  const builds = new Map<string, any>();
  let tick = 0;
  const stamp = () => new Date(NOW.getTime() + ++tick * 1000);
  const bk = (w: any) => `${w.kundli_id_area_as_of.kundli_id}|${w.kundli_id_area_as_of.area}|${new Date(w.kundli_id_area_as_of.as_of).toISOString()}`;
  const lk = (k: string, b: string) => `${k}|${b}`;
  return {
    builds,
    layouts,
    prisma: {
      kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' } : null) },
      kundliData: { findFirst: async () => null },
      auth: { findUnique: async () => ({ date_of_birth: '1990-03-01', gender: null, role: 'novice' }) },
      personFact: { findMany: async () => Object.entries(facts).map(([key, value]) => ({ key, value, confirmed_at: NOW })), upsert: async ({ create }: any) => create },
      analyticsEvent: { create: async ({ data }: any) => data },
      areaBuild: {
        findUnique: async ({ where }: any) => builds.get(bk(where)) ?? null,
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

let facts: Record<string, string> = {};
let f = fakePrisma(facts);
const queuedBuilds: string[] = [];
let readings: Record<string, any> = {};
let base = '';
let server: ReturnType<express.Express['listen']>;

const v2Seams = {
  now: () => NOW,
  readLatest: async (): Promise<SelfV2Latest> => latestFixture() ?? { ...NOTHING_STORED },
  systemsPresent: async () => PRESENT,
  queueBuild: async () => 'invoked' as const,
  queueDigest: async () => undefined,
  progressMarkers: async () => ({ queue: { state: 'none' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
  buildMarker: async () => 'none' as const,
  refreshDates: async () => null,
};

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  process.env.SELF_V3_BUILD = '1';
  process.env.READING_CLOCK_LAYER = '1';
  const app = express();
  app.use(express.json());
  const prisma = new Proxy({}, { get: (_t, k) => f.prisma[k as string] }) as never;
  const requireUser = fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null);
  const queueBuild = async (_p: unknown, _u: string, k: string) => (queuedBuilds.push(k), 'invoked' as const);
  const readCardReadings = async (_p: unknown, _k: string, _c: string, ids?: readonly string[]) => Object.fromEntries(Object.entries(readings).filter(([id]) => !ids || ids.includes(id)));
  registerBoardV3Routes(app, {
    prisma,
    requireUser,
    v3: { ...v2Seams, readCardReadings: readCardReadings as never, queueCardsBuild: queueBuild, planOf: async () => 'free', featureOverrides: async () => new Map() },
    cards: { now: () => NOW, queueBuild, clockOf: async () => 'vimsottari', readCardReadings: readCardReadings as never },
  });
  registerBoardCardsRoutes(app, { prisma, requireUser, v3: { now: () => NOW, queueBuild, clockOf: async () => 'vimsottari', readCardReadings: readCardReadings as never } });
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
  facts = {};
  f = fakePrisma(facts);
  queuedBuilds.length = 0;
  readings = {};
  process.env.BOARDS_V3 = 'love,work';
  delete process.env.READING_SPEND_CAP_USD;
});

const call = (method: string, path: string, user?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const content = { line: 'Warmer from 5 Jan 2027.', spans: [{ span: 's1', from: '2026-11-01', to: '2027-01-05', tone: 'mixed', mode: 'build', asks: 'Go out more.', obstacle: 'Tired evenings.', step: 'If a friend asks, then say yes.', held: true }], confirm: null, pattern: null, ladder: null, agreement: { agree: 3, of: 4 } };

describe('BOARDS_V3 gate', () => {
  it('unset: GET, read and a versioned PUT answer 404 board_v3_off; the legacy PUT still saves', async () => {
    delete process.env.BOARDS_V3;
    const g = await call('GET', '/api/board/love/v3', 'u1');
    expect(g.status).toBe(404);
    expect(await g.json()).toEqual({ error: 'board_v3_off' });
    expect((await call('POST', '/api/board/love/v3/cards/dating_pulse/read', 'u1')).status).toBe(404);
    const p = await call('PUT', '/api/board/love/v3/layout', 'u1', { version: '', patch: { cards: ['dating_pulse'] } });
    expect(p.status).toBe(404);
    expect(await p.json()).toEqual({ error: 'board_v3_off' });
    const legacy = await call('PUT', '/api/board/love/v3/layout', 'u1', { cards: ['love_where'] });
    expect(legacy.status).toBe(200);
    expect((await legacy.json()).cards).toEqual(['love_where']);
  });
  it('an unknown board is 400; only love is on with BOARDS_V3=love', async () => {
    expect((await call('GET', '/api/board/self/v3', 'u1')).status).toBe(400);
    process.env.BOARDS_V3 = 'love';
    expect((await call('GET', '/api/board/work/v3', 'u1')).status).toBe(404);
    expect((await call('GET', '/api/board/love/v3', 'u1')).status).toBe(200);
  });
  it('503 off while the per-card reading is off', async () => {
    process.env.READING_CLOCK_LAYER = '0';
    const r = await call('GET', '/api/board/love/v3', 'u1');
    process.env.READING_CLOCK_LAYER = '1';
    expect(r.status).toBe(503);
  });
});

describe('GET /api/board/:board/v3', () => {
  it('a You-shaped body plus board, lenses, activeLens and defaultLens; private, ETag, 304', async () => {
    const r = await call('GET', '/api/board/love/v3', 'u1');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/private/);
    const body = await r.json();
    for (const k of ['status', 'builtAt', 'readVersion', 'clock', 'profile', 'refresh', 'build', 'quality', 'layout', 'cards', 'reading', 'features', 'board', 'lenses', 'activeLens', 'defaultLens']) expect(body).toHaveProperty(k);
    expect(body.board).toBe('love');
    expect(body.status).toBe('ok');
    expect(body.refresh.due).toBe(false);
    expect(body.lenses.map((l: any) => l.id)).toEqual(['dating', 'marriage', 'friends', 'allies']);
    expect(body.activeLens).toBe('dating');
    expect(body.cards).toHaveLength(37);
    const kids = body.cards.find((c: any) => c.id === 'marriage_children_family');
    expect(kids).toMatchObject({ available: false, unavailableReason: 'Coming soon', group: 'marriage', v2: null });
    const tag = r.headers.get('etag')!;
    const again = await fetch(`${base}/api/board/love/v3`, { headers: { 'x-user': 'u1', 'if-none-match': tag } });
    expect(again.status).toBe(304);
  });

  it('the lens defaults from person facts; a stated fact hides the cards it excludes', async () => {
    facts['love.status'] = 'married';
    facts['work.status'] = 'own_business';
    const love = await (await call('GET', '/api/board/love/v3', 'u1')).json();
    expect(love.activeLens).toBe('marriage');
    expect(love.defaultLens).toBe('marriage');
    expect(love.cards.some((c: any) => c.id === 'dating_pulse')).toBe(false);
    expect(love.cards.find((c: any) => c.id === 'marriage_pulse').suggested).toBe(true);
    const work = await (await call('GET', '/api/board/work/v3', 'u1')).json();
    expect(work.activeLens).toBe('business');
    expect(work.lenses.find((l: any) => l.id === 'business').suggested).toContain('biz_founder_burnout');
  });

  it('no internal id, technique key or engine name in the body text', async () => {
    readings = { dating_pulse: content };
    await call('PUT', '/api/board/love/v3/layout', 'u1', { version: '', patch: { cards: ['dating_pulse', 'dating_delays_blocks'] } });
    const raw = await (await call('GET', '/api/board/love/v3', 'u1')).text();
    expect(raw).not.toMatch(/[a-z]+\.[a-z_]+ · /);
    expect(raw).not.toMatch(/radha|pyjhora|self\.card|technique/i);
    const body = JSON.parse(raw);
    for (const c of body.cards) {
      expect(c.title).not.toMatch(/_/);
      expect(c.subtitle).not.toMatch(/_/);
    }
    // offline first (docs/billing/03): the stored reading is served and not re-read on open; only the unread card is queued
    expect(body.cards.find((c: any) => c.id === 'dating_pulse')).toMatchObject({ state: 'ready', firstLine: 'Warmer from 5 Jan 2027.' });
  });
});

describe('layout PUT (dispatched on body shape) and build on open', () => {
  it('a versioned save keeps the lens, queues the unread lens deck and the build; a stale version is 409', async () => {
    readings = { dating_pulse: content };
    const put = await call('PUT', '/api/board/love/v3/layout', 'u1', { version: '', patch: { cards: ['dating_pulse', 'dating_delays_blocks', 'friends_core_allies'], boardOptions: { lens: 'dating' } } });
    expect(put.status).toBe(200);
    const view = await put.json();
    expect(view.boardOptions.lens).toBe('dating');
    expect(view.cards).toEqual(['dating_pulse', 'dating_delays_blocks', 'friends_core_allies']);
    expect(view.reading).toEqual({ queued: ['dating_delays_blocks'] });
    expect(queuedBuilds).toEqual(['k1']);
    const stale = await call('PUT', '/api/board/love/v3/layout', 'u1', { version: '2000-01-01T00:00:00.000Z', patch: { cards: ['dating_pulse'] } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toBe('stale_layout');
    const switched = await call('PUT', '/api/board/love/v3/layout', 'u1', { version: view.version, patch: { boardOptions: { lens: 'friends' } } });
    expect((await switched.json()).reading).toEqual({ queued: ['friends_core_allies'] });
  });

  it('refusals: unknown lens, another board card, a card not offered, too few cards', async () => {
    const put = (patch: unknown) => call('PUT', '/api/board/love/v3/layout', 'u1', { version: '', patch });
    expect(await (await put({ cards: ['dating_pulse'], boardOptions: { lens: 'business' } })).json()).toMatchObject({ error: 'unknown_option' });
    expect(await (await put({ cards: ['job_pulse'] })).json()).toMatchObject({ error: 'unknown_card' });
    expect(await (await put({ cards: ['marriage_children_family'] })).json()).toMatchObject({ error: 'card_not_offered' });
    expect(await (await put({ cards: [] })).json()).toMatchObject({ error: 'too_few_cards' });
  });

  it('the first GET of the day queues the active lens deck cards never read, once; a read card is served, not re-read', async () => {
    await call('PUT', '/api/board/love/v3/layout', 'u1', { version: '', patch: { cards: ['dating_pulse', 'dating_delays_blocks', 'friends_core_allies'] } });
    readings = { dating_pulse: content };
    f.builds.clear();
    queuedBuilds.length = 0;
    const g1 = await (await call('GET', '/api/board/love/v3', 'u1')).json();
    expect(g1.cards.find((c: any) => c.id === 'dating_pulse').state).toBe('ready');
    expect(g1.cards.find((c: any) => c.id === 'dating_delays_blocks').state).toBe('queued');
    expect(g1.cards.find((c: any) => c.id === 'friends_core_allies').state).toBe('not_read');
    expect(queuedBuilds).toEqual(['k1']);
    const doc = [...f.builds.values()][0].result;
    expect(doc.opened).toEqual({ love: true });
    await call('GET', '/api/board/love/v3', 'u1');
    expect(queuedBuilds).toEqual(['k1']);
  });
});

describe('POST read and confirm', () => {
  it('202 for a card of this board; 400 for another board card or one not offered; no day cap', async () => {
    const r = await call('POST', '/api/board/work/v3/cards/job_pulse/read', 'u1');
    expect(r.status).toBe(202);
    expect(await (await call('POST', '/api/board/work/v3/cards/dating_pulse/read', 'u1')).json()).toEqual({ error: 'unknown_card' });
    expect(await (await call('POST', '/api/board/work/v3/cards/start_degree_to_career/read', 'u1')).json()).toEqual({ error: 'card_not_offered' });
    // a high stored day spend no longer refuses a read: each read is its own operation with its own budget
    process.env.READING_SPEND_CAP_USD = '0.05';
    [...f.builds.values()][0].result.spentUsd = 9;
    expect((await call('POST', '/api/board/work/v3/cards/job_pulse/read', 'u1')).status).toBe(202);
  });
  it('confirm writes the same fact as You; a bad claim is 400', async () => {
    expect((await call('POST', '/api/board/love/v3/confirm', 'u1', { claimId: 'dating_pulse.quiet_stretch', answer: 'yes' })).status).toBe(204);
    expect((await call('POST', '/api/board/love/v3/confirm', 'u1', { claimId: 'BAD ID', answer: 'yes' })).status).toBe(400);
  });
  it('a Love/Work tap is stored as `self.confirm.<claimId>` (even the longest claim) and reaches the next build as PERSON\'S ANSWERS', async () => {
    const written: Array<{ user_id: string; key: string; value: string }> = [];
    f.prisma.personFact.upsert = async ({ create }: any) => (written.push(create), create);
    // the longest Love/Work card id (28) and the Oracle's longest tag (40): 69 characters, refused before (cap 60)
    const longest = [...boardV3Cards('love'), ...boardV3Cards('work')].map((d) => d.id).sort((a, b) => b.length - a.length)[0]!;
    const claimId = `${longest}.${'t'.repeat(40)}`;
    expect(claimId.length).toBeGreaterThan(60);
    expect((await call('POST', '/api/board/love/v3/confirm', 'u1', { claimId, answer: 'partly' })).status).toBe(204);
    expect((await call('POST', '/api/board/work/v3/confirm', 'u1', { claimId: 'job_pulse.review_due', answer: 'no' })).status).toBe(204);
    expect(written.map((w) => [w.user_id, w.key, w.value])).toEqual([
      ['u1', `self.confirm.${claimId}`, 'partly'],
      ['u1', 'self.confirm.job_pulse.review_due', 'no'],
    ]);
    // the same store You reads: the profile pack the build loads turns the rows into the PERSON'S ANSWERS line
    const pack = buildProfilePack({ birthDate: '1990-03-01', gender: null, role: null, facts: Object.fromEntries(written.map((w, i) => [w.key, { value: w.value, confirmed_at: `2026-11-1${i}T00:00:00Z` }])) }, '2026-11-19');
    expect(answersLine(pack)).toBe(`job_pulse.review_due=no; ${claimId}=partly`);
  });
});
