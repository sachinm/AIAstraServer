/**
 * doc 75 / TODOS P2 "the web sends PATCH to /api/self/v3/layout/{cards/:id,board,deck} but the server has no PATCH
 * routes": the three one-change PATCHes the web sends (`AIAstra_WEB/src/lib/selfV3Api.ts` `patchRoute`) answer like the
 * versioned PUT: 200 with the layout view (the web's `isLayoutView`: `cards` array and `template` string), 409
 * `stale_layout` on an old version, 400 with a LayoutError. Fakes only: no database, no model.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { patchSelfLayout } from '../../../../../src/reading/self/v3/service.js';
import { registerSelfV3Routes } from '../../../../../src/routes/selfV3Routes.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';

type Row = { template: string; cards: unknown; sections: unknown; options: unknown; board_options: unknown; updated_at: Date };

/** one board_layout row in memory, with the conditional update Postgres does */
function fakePrisma(start: Row | null = null) {
  let row: Row | null = start;
  let clock = Date.parse('2026-11-13T09:00:00.000Z');
  const tick = () => new Date((clock += 7));
  const prisma = {
    kundli: { findFirst: async ({ where }: { where: { user_id: string } }) => (where.user_id === 'u1' ? { id: 'k1' } : null) },
    boardLayout: {
      findUnique: async () => row,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (row) throw Object.assign(new Error('unique'), { code: 'P2002' });
        row = { template: data.template as string, cards: data.cards, sections: data.sections, options: data.options ?? {}, board_options: data.board_options ?? {}, updated_at: tick() };
        return row;
      },
      updateMany: async ({ where, data }: { where: { updated_at: { gte: Date; lt: Date } }; data: Record<string, unknown> }) => {
        if (!row || row.updated_at < where.updated_at.gte || row.updated_at >= where.updated_at.lt) return { count: 0 };
        row = { ...row, ...(data as Partial<Row>), updated_at: tick() };
        return { count: 1 };
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, row: () => row };
}

const START: Row = {
  template: 'seasons',
  cards: ['body', 'mind', 'stuck'],
  sections: {},
  options: { body: { face: 'research', length: 'deep' } },
  board_options: { face: 'research', groupBy: 'years' },
  updated_at: new Date('2026-11-13T08:00:00.000Z'),
};
const V0 = START.updated_at.toISOString();
const deps = { cardsRead: false };

describe('patchSelfLayout', () => {
  it("card: the card's whole options map replaces the stored one (a key it dropped is gone); other cards untouched", async () => {
    const f = fakePrisma({ ...START, options: { body: { face: 'research', length: 'deep' }, mind: { words: 'terms' } } });
    const r = await patchSelfLayout(f.prisma, 'u1', 'card', { version: V0, options: { length: 'glance' } }, 'body', deps);
    expect(r.ok && r.layout.options).toEqual({ body: { length: 'glance' }, mind: { words: 'terms' } });
  });
  it('board: the whole board-wide map replaces the stored one', async () => {
    const f = fakePrisma({ ...START });
    const r = await patchSelfLayout(f.prisma, 'u1', 'board', { version: V0, boardOptions: { face: 'light' } }, undefined, deps);
    expect(r.ok && r.layout.boardOptions).toEqual({ face: 'light' });
  });
  it('deck: template, cards and sections replace; options of a card still on the board are kept', async () => {
    const f = fakePrisma({ ...START });
    const r = await patchSelfLayout(f.prisma, 'u1', 'deck', { version: V0, template: 'compact', cards: ['body', 'mind', 'lagna'], sections: {} }, undefined, deps);
    expect(r.ok).toBe(true);
    expect(r.ok && r.layout).toMatchObject({ template: 'compact', cards: ['body', 'mind', 'lagna'], options: { body: { length: 'deep' } } });
  });
  it('a stale version is 409 with the layout now stored; a card not on the board or a bad body is 400', async () => {
    const f = fakePrisma({ ...START });
    expect(await patchSelfLayout(f.prisma, 'u1', 'board', { version: '2026-11-01T00:00:00.000Z', boardOptions: {} }, undefined, deps)).toMatchObject({ ok: false, status: 409, error: 'stale_layout' });
    expect(await patchSelfLayout(f.prisma, 'u1', 'card', { version: V0, options: {} }, 'lagna', deps)).toMatchObject({ ok: false, status: 400, error: 'unknown_card' });
    expect(await patchSelfLayout(f.prisma, 'u1', 'card', { version: V0, options: {} }, 'no_such_card', deps)).toMatchObject({ ok: false, status: 400, error: 'unknown_card' });
    expect(await patchSelfLayout(f.prisma, 'u1', 'card', { version: 3, options: {} }, 'body', deps)).toMatchObject({ ok: false, status: 400, error: 'bad_body' });
    expect(await patchSelfLayout(f.prisma, 'u1', 'deck', { version: V0, cards: 'body' }, undefined, deps)).toMatchObject({ ok: false, status: 400, error: 'bad_body' });
    expect(await patchSelfLayout(f.prisma, 'u1', 'card', { version: V0, options: { length: 'huge' } }, 'body', deps)).toMatchObject({ ok: false, status: 400, error: 'unknown_option' });
    expect(f.row()!.updated_at.toISOString()).toBe(V0);
  });
  it('no chart: 404 no_kundli', async () => {
    const f = fakePrisma(null);
    expect(await patchSelfLayout(f.prisma, 'u9', 'board', { boardOptions: {} }, undefined, deps)).toMatchObject({ ok: false, status: 404, error: 'no_kundli' });
  });
});

describe('PATCH /api/self/v3/layout/* routes', () => {
  let f = fakePrisma({ ...START });
  let base = '';
  let server: ReturnType<express.Express['listen']>;
  beforeAll(() => {
    const app = express();
    app.use(express.json());
    registerSelfV3Routes(app, {
      prisma: new Proxy({}, { get: (_t, k) => (f.prisma as unknown as Record<string, unknown>)[k as string] }) as never,
      enabled: true,
      budgetMs: 1000,
      requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
      cards: deps,
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());
  beforeEach(() => {
    f = fakePrisma({ ...START });
  });
  const patch = (path: string, body: unknown, user: string | null = 'u1') =>
    fetch(`${base}${path}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: JSON.stringify(body) });

  it('all three answer 200 with a layout view the web accepts, each on the version the last one returned', async () => {
    const a = await patch('/api/self/v3/layout/cards/mind', { version: V0, options: { words: 'terms' } });
    expect(a.status).toBe(200);
    expect(a.headers.get('cache-control')).toContain('no-store');
    const av = await a.json();
    expect(Array.isArray(av.cards) && typeof av.template === 'string').toBe(true);
    expect(av.options.mind).toEqual({ words: 'terms' });
    const b = await patch('/api/self/v3/layout/board', { version: av.version, boardOptions: { face: 'light' } });
    expect(b.status).toBe(200);
    const bv = await b.json();
    const c = await patch('/api/self/v3/layout/deck', { version: bv.version, template: 'seasons', cards: ['body', 'mind', 'stuck', 'lagna'], sections: {} });
    expect(c.status).toBe(200);
    expect((await c.json()).cards).toEqual(['body', 'mind', 'stuck', 'lagna']);
  });
  it('409 stale_layout with the stored layout; 400 with the error; 401 signed out; 403 for another account', async () => {
    const stale = await patch('/api/self/v3/layout/board', { version: '2026-11-01T00:00:00.000Z', boardOptions: {} });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'stale_layout', layout: { cards: ['body', 'mind', 'stuck'] } });
    const bad = await patch('/api/self/v3/layout/cards/body', { version: V0, options: { length: 'huge' } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'unknown_option' });
    expect((await patch('/api/self/v3/layout/board', { boardOptions: {} }, null)).status).toBe(401);
    expect((await patch('/api/self/v3/layout/board', { userId: 'u2', boardOptions: {} })).status).toBe(403);
  });
});
