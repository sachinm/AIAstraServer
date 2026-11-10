/**
 * Doc 70 Phase 3 routes (§4.2): with the per-card reading on (SELF_V3_BUILD=1, READING_CLOCK_LAYER=1), a layout save of
 * five or more cards queues the board's unread cards and the build; GET carries each card's state and the board's
 * reading line; POST /api/self/v3/cards/:id/read queues one card (202), refuses a card already reading (409), at the
 * spend cap (429) and with the reading off (503). Fakes only.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../../src/reading/self/v2api/storeContract.js';
import { registerSelfV3Routes } from '../../../../../src/routes/selfV3Routes.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';
import { PRESENT, latestFixture } from '../v2api/fixtures.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const ENV = ['SELF_V3_BUILD', 'READING_CLOCK_LAYER', 'CARDS_SPEND_CAP_USD'];
const saved: Record<string, string | undefined> = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const layouts = new Map<string, any>();
  const builds = new Map<string, any>();
  const bk = (w: any) => `${w.kundli_id_area_as_of.kundli_id}|${w.kundli_id_area_as_of.area}|${new Date(w.kundli_id_area_as_of.as_of).toISOString()}`;
  return {
    builds,
    prisma: {
      kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' } : null) },
      kundliData: { findFirst: async () => null },
      auth: { findUnique: async () => ({ date_of_birth: '1985-03-01', gender: null, role: 'novice' }) },
      personFact: { findMany: async () => [], upsert: async ({ create }: any) => create },
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
        findUnique: async ({ where }: any) => layouts.get(`${where.kundli_id_board.kundli_id}|${where.kundli_id_board.board}`) ?? null,
        upsert: async ({ where, create, update }: any) => {
          const k = `${where.kundli_id_board.kundli_id}|${where.kundli_id_board.board}`;
          const row = { ...(layouts.get(k) ?? create), ...update, updated_at: NOW };
          layouts.set(k, row);
          return row;
        },
      },
    } as any,
  };
}

let f = fakePrisma();
const stored: Record<string, SelfV2Latest> = {};
const queuedBuilds: string[] = [];
let readings: Record<string, any> = {};
let base = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  process.env.SELF_V3_BUILD = '1';
  process.env.READING_CLOCK_LAYER = '1';
  const app = express();
  app.use(express.json());
  registerSelfV3Routes(app, {
    prisma: new Proxy({}, { get: (_t, k) => f.prisma[k as string] }) as never,
    enabled: true,
    requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
    v3: {
      now: () => NOW,
      readLatest: async (_p, kundliId) => stored[kundliId] ?? { ...NOTHING_STORED },
      systemsPresent: async () => PRESENT,
      queueBuild: async () => 'invoked',
      queueDigest: async () => undefined,
      progressMarkers: async () => ({ queue: { state: 'none', startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
      buildMarker: async () => 'none',
      refreshDates: async () => null,
      readCardReadings: async () => readings,
    },
    cards: {
      now: () => NOW,
      queueBuild: async (_p, _u, k) => {
        queuedBuilds.push(k);
        return 'invoked';
      },
      clockOf: async () => 'dwisatpathi',
      readCardReadings: async () => readings,
    },
  });
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
  f = fakePrisma();
  queuedBuilds.length = 0;
  readings = {};
  stored.k1 = latestFixture();
  delete process.env.CARDS_SPEND_CAP_USD;
});

const call = (method: string, path: string, user?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('layout save starts the reading (doc 70 §4.1 trigger)', () => {
  it('five cards: the unread ones are queued and the build is queued; GET shows them queued', async () => {
    readings = { body: { line: 'x', spans: [], confirm: null, pattern: null, ladder: null, agreement: null } };
    const put = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['body', 'mind', 'stuck', 'sleep', 'year'] });
    expect(put.status).toBe(200);
    const body = await put.json();
    expect(body.reading).toEqual({ queued: ['mind', 'stuck', 'sleep', 'year'] });
    expect(queuedBuilds).toEqual(['k1']);
    const get = await (await call('GET', '/api/self/v3', 'u1')).json();
    const state = Object.fromEntries(get.cards.map((c: any) => [c.id, c.state]));
    expect(state).toMatchObject({ body: 'ready', mind: 'queued', sleep: 'queued', drive: 'not_read' });
    expect(get.cards.filter((c: any) => c.available)).toHaveLength(21);
    expect(get.reading).toMatchObject({ enabled: true, stage: 'cards', done: 1, total: 5 });
  });
  it('three cards save, but nothing is read', async () => {
    const put = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['body', 'mind', 'stuck'] });
    expect(put.status).toBe(200);
    expect((await put.json()).reading).toBeUndefined();
    expect(queuedBuilds).toEqual([]);
  });
});

describe('POST /api/self/v3/cards/:id/read', () => {
  it('202 queues one card and the build; 409 while it reads; 400 for an unknown or unreadable card', async () => {
    const r = await call('POST', '/api/self/v3/cards/sleep/read', 'u1');
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ state: 'queued' });
    expect(queuedBuilds).toEqual(['k1']);
    const doc = [...f.builds.values()][0].result;
    doc.cards.sleep = { state: 'reading', at: NOW.toISOString() };
    expect((await call('POST', '/api/self/v3/cards/sleep/read', 'u1')).status).toBe(409);
    expect(await (await call('POST', '/api/self/v3/cards/nope/read', 'u1')).json()).toEqual({ error: 'unknown_card' });
    expect(await (await call('POST', '/api/self/v3/cards/constitution/read', 'u1')).json()).toEqual({ error: 'card_not_offered' });
  });
  it('429 at the day spend cap', async () => {
    process.env.CARDS_SPEND_CAP_USD = '0.01';
    await call('POST', '/api/self/v3/cards/mind/read', 'u1');
    [...f.builds.values()][0].result.spentUsd = 0.02;
    const r = await call('POST', '/api/self/v3/cards/body/read', 'u1');
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'spend_cap' });
  });
  it('503 with the reading off; 404 without a chart; 403 for another account', async () => {
    process.env.READING_CLOCK_LAYER = '0';
    expect((await call('POST', '/api/self/v3/cards/body/read', 'u1')).status).toBe(503);
    process.env.READING_CLOCK_LAYER = '1';
    expect((await call('POST', '/api/self/v3/cards/body/read', 'u9')).status).toBe(404);
    expect((await call('POST', '/api/self/v3/cards/body/read?userId=u2', 'u1')).status).toBe(403);
  });
});
