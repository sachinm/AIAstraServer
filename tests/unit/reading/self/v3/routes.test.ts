/**
 * Self board v3 routes (docs/reading-engine/68 §4.6): GET adds the layout and the registry to what v2 reads; PUT layout
 * validates and stores without queueing a build; the catalogue has no card bodies; every answer is the caller's own.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../../src/reading/self/v2api/storeContract.js';
import { SELF_V2_CACHE_CONTROL } from '../../../../../src/routes/selfV2Routes.js';
import { registerSelfV3Routes } from '../../../../../src/routes/selfV3Routes.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';
import { PRESENT, latestFixture } from '../v2api/fixtures.js';

const NOW = new Date('2026-11-09T12:00:00Z');

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const kundlis: Record<string, any> = {
    u1: { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' },
  };
  const layouts = new Map<string, any>();
  const prisma: any = {
    kundli: { findFirst: async ({ where }: any) => (kundlis[where.user_id] ? { ...kundlis[where.user_id] } : null) },
    kundliData: { findFirst: async () => null },
    auth: { findUnique: async () => ({ date_of_birth: '1985-03-01', gender: null, role: 'novice' }) },
    personFact: { findMany: async () => [], upsert: async ({ create }: any) => create },
    analyticsEvent: { create: async ({ data }: any) => data },
    areaBuild: { findUnique: async () => null, upsert: async ({ create }: any) => create },
    boardLayout: {
      findUnique: async ({ where }: any) => layouts.get(`${where.kundli_id_board.kundli_id}|${where.kundli_id_board.board}`) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = `${where.kundli_id_board.kundli_id}|${where.kundli_id_board.board}`;
        const row = { ...(layouts.get(k) ?? create), ...update, updated_at: NOW };
        layouts.set(k, row);
        return row;
      },
    },
  };
  return { prisma, layouts };
}

let f = fakePrisma();
let stored: Record<string, SelfV2Latest> = {};
const queued: string[] = [];
let base = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(() => {
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
      queueBuild: async (_p, _u, k) => {
        queued.push(k);
        return 'invoked';
      },
      queueDigest: async () => undefined,
      progressMarkers: async () => ({ queue: { state: 'none', startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
      buildMarker: async () => 'none',
      refreshDates: async () => null,
    },
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  f = fakePrisma();
  stored = {};
  queued.length = 0;
});

const call = (method: string, path: string, user?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('GET /api/self/v3', () => {
  it('first visit: no layout chosen, every catalogue card listed, the v2 build fills the offered ones', async () => {
    stored.k1 = latestFixture();
    const r = await call('GET', '/api/self/v3', 'u1');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe(SELF_V2_CACHE_CONTROL);
    const body = await r.json();
    expect(body.layout).toMatchObject({ chosen: false, cards: [], template: 'seasons' });
    expect(body.readVersion).toBe('v2');
    expect(body.cards.length).toBeGreaterThan(11);
    expect(body.cards.filter((c: any) => c.available)).toHaveLength(11);
    expect(body.cards.filter((c: any) => c.suggested)).toHaveLength(8);
    expect(JSON.stringify(body)).not.toMatch(/radha|pyjhora/i);
  });
  it('a person with no chart gets 404 no_kundli and no cards', async () => {
    const r = await call('GET', '/api/self/v3', 'u9');
    expect(r.status).toBe(404);
    expect((await r.json()).cards).toEqual([]);
  });
  it('refuses another account', async () => {
    expect((await call('GET', '/api/self/v3?userId=u2', 'u1')).status).toBe(403);
  });
  it('signed out: 401', async () => {
    expect((await call('GET', '/api/self/v3')).status).toBe(401);
  });
});

describe('PUT /api/self/v3/layout', () => {
  it("doc 71: options are stored, set that card's sections, and GET shapes the card with notes", async () => {
    stored.k1 = latestFixture();
    const put = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['year', 'body', 'mind'], options: { body: { length: 'glance', view: 'arc' }, mind: { words: 'terms' } } });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({
      options: { body: { length: 'glance', view: 'arc' }, mind: { words: 'terms' } },
      sections: { body: ['line', 'year'], mind: ['line', 'year', 'stretch', 'confirm', 'details'] },
    });
    const get = await (await call('GET', '/api/self/v3', 'u1')).json();
    const body = get.cards.find((c: any) => c.id === 'body');
    expect(body.options).toEqual({ length: 'glance', view: 'arc', words: 'plain', plan: 'with' });
    expect(body.optionNotes[0]).toMatch(/long arc is only/);
    expect(get.cards.find((c: any) => c.id === 'year').options).toEqual({ length: 'usual', view: 'year', words: 'plain', plan: 'with' });
    // a later PUT without options keeps them
    await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['year', 'body', 'mind'] });
    expect((await (await call('GET', '/api/self/v3', 'u1')).json()).layout.options).toEqual({ body: { length: 'glance', view: 'arc' }, mind: { words: 'terms' } });
  });
  it('doc 71: an unknown option is refused', async () => {
    const r = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['year', 'body', 'mind'], options: { body: { length: 'huge' } } });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('unknown_option');
  });
  it('stores the layout, GET returns it chosen, and no build is queued', async () => {
    stored.k1 = latestFixture();
    const put = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'compact', cards: ['year', 'body', 'mind'], sections: { body: ['line', 'year', 'ladder'] } });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ chosen: true, template: 'compact', cards: ['year', 'body', 'mind'] });
    const get = await (await call('GET', '/api/self/v3', 'u1')).json();
    expect(get.layout).toMatchObject({ chosen: true, cards: ['year', 'body', 'mind'], sections: { body: ['line', 'year', 'ladder'] } });
    expect(queued).toEqual([]);
  });
  it('400 with the reason', async () => {
    const r = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['body'] });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'too_few_cards' });
    const r2 = await call('PUT', '/api/self/v3/layout', 'u1', { template: 'seasons', cards: ['body', 'mind', 'sleep'] });
    expect(await r2.json()).toEqual({ error: 'card_not_offered', detail: 'sleep' });
  });
  it('404 without a chart', async () => {
    expect((await call('PUT', '/api/self/v3/layout', 'u9', { template: 'seasons', cards: ['body', 'mind', 'stuck'] })).status).toBe(404);
  });
});

describe('GET /api/self/v3/catalogue', () => {
  it('tiles only: no card bodies or rails', async () => {
    stored.k1 = latestFixture();
    const body = await (await call('GET', '/api/self/v3/catalogue', 'u1')).json();
    expect(body.cards[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), title: expect.any(String), description: expect.any(String), suggested: expect.any(Boolean) }),
    );
    expect(body.cards[0].rail).toBeUndefined();
    expect(body.cards[0].v2).toBeUndefined();
  });
});

describe('POST /api/self/v3/confirm', () => {
  it('stores the answer as v2 does', async () => {
    expect((await call('POST', '/api/self/v3/confirm', 'u1', { claimId: 'body.rest', answer: 'no' })).status).toBe(204);
    expect((await call('POST', '/api/self/v3/confirm', 'u1', { claimId: 'body.rest', answer: 'maybe' })).status).toBe(400);
  });
});
