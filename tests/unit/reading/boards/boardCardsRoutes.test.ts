/**
 * Love and Work card picker routes (docs/reading-engine/71 §4.5): the catalogue, the layout with options, refusals.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BOARD_CARDS, catalogue } from '../../../../src/reading/boards/catalogue.js';
import { OPTION_NOTE } from '../../../../src/reading/boards/cardOptions.js';
import { registerBoardCardsRoutes } from '../../../../src/routes/boardCardsRoutes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';

const NOW = new Date('2026-11-10T12:00:00Z');

/* eslint-disable @typescript-eslint/no-explicit-any */
let layouts = new Map<string, any>();
const prisma: any = {
  kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1' } : null) },
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

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  const app = express();
  app.use(express.json());
  registerBoardCardsRoutes(app, { prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null) });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  layouts = new Map();
});

const call = (method: string, path: string, user?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('catalogue', () => {
  it('doc 69: ten Love cards and nine Work cards, unique ids', () => {
    expect(BOARD_CARDS.filter((c) => c.board === 'love')).toHaveLength(10);
    expect(BOARD_CARDS.filter((c) => c.board === 'work')).toHaveLength(9);
    expect(new Set(BOARD_CARDS.map((c) => c.id)).size).toBe(BOARD_CARDS.length);
  });
  it('a card with no sub-area is coming soon and never suggested', () => {
    const partner = catalogue('love').cards.find((c) => c.id === 'love_partner')!;
    expect(partner).toMatchObject({ available: false, suggested: false, unavailableReason: 'Coming soon' });
  });
  it('GET answers the board, 400 for an unknown board, 401 signed out', async () => {
    const r = await call('GET', '/api/board/work/v3/catalogue', 'u1');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.groups.map((g: any) => g.id)).toEqual(['standing', 'money', 'growth']);
    expect(body.cards).toHaveLength(9);
    expect((await call('GET', '/api/board/self/v3/catalogue', 'u1')).status).toBe(400);
    expect((await call('GET', '/api/board/love/v3/catalogue')).status).toBe(401);
  });
});

describe('layout', () => {
  it('first visit: nothing chosen', async () => {
    const r = await call('GET', '/api/board/love/v3/layout', 'u1');
    expect(await r.json()).toMatchObject({ board: 'love', cards: [], chosen: false, options: {} });
  });
  it('stores the cards and options, and returns the options in force with notes', async () => {
    const put = await call('PUT', '/api/board/love/v3/layout', 'u1', { cards: ['love_where', 'love_meet'], options: { love_meet: { view: 'now', plan: 'without' } } });
    expect(put.status).toBe(200);
    const get = await (await call('GET', '/api/board/love/v3/layout', 'u1')).json();
    expect(get).toMatchObject({ chosen: true, cards: ['love_where', 'love_meet'], options: { love_meet: { view: 'now', plan: 'without' } } });
    expect(get.effective.love_meet.options).toEqual({ length: 'usual', view: 'now', words: 'plain', plan: 'without' });
    expect(get.effective.love_meet.notes).toEqual([OPTION_NOTE.noPlanLines]);
    expect(get.effective.love_where.notes).toEqual([]);
  });
  it('a PUT without options keeps the stored ones', async () => {
    await call('PUT', '/api/board/work/v3/layout', 'u1', { cards: ['work_where', 'work_money'], options: { work_money: { length: 'glance' } } });
    await call('PUT', '/api/board/work/v3/layout', 'u1', { cards: ['work_money', 'work_where'] });
    const get = await (await call('GET', '/api/board/work/v3/layout', 'u1')).json();
    expect(get.cards).toEqual(['work_money', 'work_where']);
    expect(get.options).toEqual({ work_money: { length: 'glance' } });
  });
  it('the boards are stored apart', async () => {
    await call('PUT', '/api/board/work/v3/layout', 'u1', { cards: ['work_where'] });
    expect((await (await call('GET', '/api/board/love/v3/layout', 'u1')).json()).chosen).toBe(false);
  });
  it('400 with the reason', async () => {
    const bad = async (body: unknown) => (await call('PUT', '/api/board/love/v3/layout', 'u1', body)).json();
    expect(await bad({ cards: ['work_where'] })).toMatchObject({ error: 'unknown_card' });
    expect(await bad({ cards: ['love_partner'] })).toMatchObject({ error: 'card_not_offered' });
    expect(await bad({ cards: ['love_where', 'love_where'] })).toMatchObject({ error: 'duplicate_card' });
    expect(await bad({ cards: [] })).toMatchObject({ error: 'too_few_cards' });
    expect(await bad({ cards: ['love_where'], options: { love_where: { length: 'huge' } } })).toMatchObject({ error: 'unknown_option' });
  });
  it('404 without a chart', async () => {
    expect((await call('PUT', '/api/board/love/v3/layout', 'u9', { cards: ['love_where'] })).status).toBe(404);
  });
});
