/**
 * docs/reading-engine/85 §7 step 5: the card chat over HTTP. GET opens a card's chat (the stored preamble, the period,
 * the cost line, the saved thread; no model call). POST /api/chat/ask-stream with `card` answers on the card: errors
 * before any SSE frame, the `card` event first, the question reserved under `cardchat:<board>:<card>:<turnId>` and
 * counted as `cardchat`, a retry of the same turnId replayed free with no model call, the turn saved to the card's
 * thread (found by card_ref even after an ordinary chat deactivated it), the last two exchanges carried, You, Love and
 * Work alike. Real question gate over an in-memory plan store; fake model; no database.
 */
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QuestionGate, type QuestionTicket } from '../../../../src/billing/questionGate.js';
import { breakdownOf } from '../../../../src/billing/usageKinds.js';
import { registerChatRoutes } from '../../../../src/chat/chatRoutes.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { registerCardChatRoutes, type CardChatRouteDeps } from '../../../../src/routes/cardChatRoutes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { MemoryPlanStore } from '../self/v2api/memoryPlanStore.js';
import { body, PERIODS, prefix, resolveSeams, view } from './fixtures.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const MODEL = 'gemini-3.8-flash';
const ENV = ['READING_SPEND_CAP_USD'];
const savedEnv: Record<string, string | undefined> = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ChatRow { id: string; user_id: string; is_active: boolean; category: string; name: string | null; card_ref: string | null; created_at: Date }
interface MsgRow { id: string; chat_id: string; question: string; ai_answer: string; created_at: Date }
let chats: ChatRow[] = [];
let messages: MsgRow[] = [];
let updateManyCalls = 0;
let tick = 0;
const at = () => new Date(NOW.getTime() + ++tick * 1000);
const match = (row: any, where: any) => Object.entries(where).every(([k, v]) => (k === 'chat' ? true : row[k] === v));
const prisma = {
  chat: {
    findFirst: async ({ where }: any) => chats.filter((c) => match(c, where)).sort((a, b) => b.created_at.getTime() - a.created_at.getTime())[0] ?? null,
    create: async ({ data }: any) => {
      const row: ChatRow = { id: `chat${chats.length + 1}`, is_active: true, category: 'general', name: null, card_ref: null, created_at: at(), ...data };
      chats.push(row);
      return { id: row.id };
    },
    updateMany: async () => (updateManyCalls++, { count: 0 }),
    update: async () => ({}),
  },
  message: {
    count: async ({ where }: any) => messages.filter((m) => m.chat_id === where.chat_id).length,
    create: async ({ data }: any) => {
      const row: MsgRow = { id: `m${messages.length + 1}`, created_at: at(), ...data };
      messages.push(row);
      return row;
    },
    findMany: async ({ where, take }: any) => messages.filter((m) => m.chat_id === where.chat_id).sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).slice(0, take),
    findFirst: async ({ where }: any) => messages.find((m) => m.id === where.id && chats.find((c) => c.id === m.chat_id)?.user_id === where.chat.user_id) ?? null,
  },
  chatLog: { create: async () => ({}) },
  chatTurn: { create: async () => ({ id: randomUUID() }), update: async () => ({}) },
} as any;

let store: MemoryPlanStore;
let gate: QuestionGate;
const commits = new Map<string, { chatId?: string; messageId?: string }>();
const streamed: GeminiCallOptions[] = [];
let answerText = 'Rest after ten, and keep mornings light. ';
let capUsd: number | undefined;
const stream = async (o: GeminiCallOptions, onDelta?: (d: string) => void): Promise<GeminiResult> => {
  streamed.push(o);
  for (const w of answerText.split(/(?<= )/)) onDelta?.(w);
  return { text: answerText, usage: { node: o.node, model: MODEL, promptTokens: 9000, cachedTokens: 8000, outputTokens: 120, thoughtTokens: 0, ms: 5 }, finishReason: 'STOP', ttftMs: 5, stoppedForLoop: false };
};

const selfBody = body([view('body', 'Body & energy'), view('mind', 'How you think'), view('sleep', 'Sleep', { v3: null })], ['body', 'mind', 'sleep']);
const loveBody = body([view('dating_pulse', 'Where Dating Stands')], ['dating_pulse']);
const workBody = body([view('job_pulse', 'Where Your Job Stands')], ['job_pulse']);

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  for (const k of ENV) savedEnv[k] = process.env[k];
  const app = express();
  app.use(express.json());
  const requireUser = fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null);
  const card: Omit<CardChatRouteDeps, 'prisma' | 'requireUser'> = {
    resolve: resolveSeams({ self: selfBody, love: loveBody, work: workBody }),
    answer: {
      model: MODEL,
      stream,
      get capUsd() {
        return capUsd;
      },
    },
    // the gate of the current test (a new one per test)
    gate: {
      check: (...a) => gate.check(...a),
      reserve: (...a) => gate.reserve(...a),
      commit: (...a) => gate.commit(...a),
      release: (...a) => gate.release(...a),
      getStatus: (...a) => gate.getStatus(...a),
    },
    usageRow: async (_p, userId, key) => {
      const r = store.usage.find((x) => x.user_id === userId && x.key === key);
      return r ? { status: r.status, chat_id: commits.get(r.id)?.chatId ?? null, message_id: commits.get(r.id)?.messageId ?? null } : null;
    },
    rateLimit: async () => ({ allowed: true }),
    declined: (async (_p: unknown, _u: string, q: string) => (/when will i die/i.test(q) ? { id: 'death', category: 'deny', reply: 'AI AdAstra cannot help with that.' } : null)) as never,
  };
  registerChatRoutes(app, { prisma, requireUser, card });
  registerCardChatRoutes(app, { prisma, requireUser, ...card });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  for (const k of ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
beforeEach(() => {
  chats = [];
  messages = [];
  updateManyCalls = 0;
  streamed.length = 0;
  commits.clear();
  answerText = 'Rest after ten, and keep mornings light. ';
  capUsd = undefined;
  store = new MemoryPlanStore(NOW);
  gate = new QuestionGate(store, { enabled: true, now: () => NOW, env: { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv });
  const commit = gate.commit.bind(gate);
  gate.commit = async (t: QuestionTicket, d: { chatId?: string; messageId?: string } = {}) => {
    if (t.id) commits.set(t.id, d);
    return commit(t, d);
  };
});

const get = async (path: string, user = 'u1') => {
  const r = await fetch(base + path, { headers: { 'x-user': user } });
  return { status: r.status, body: (await r.json()) as any, headers: r.headers };
};
const ask = async (b: Record<string, unknown>, user = 'u1') => {
  const r = await fetch(`${base}/api/chat/ask-stream`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify(b) });
  const text = await r.text();
  if (!r.headers.get('content-type')?.includes('text/event-stream')) return { status: r.status, json: JSON.parse(text), events: [] as any[] };
  const events = text
    .split('\n\n')
    .filter((blk) => blk.includes('data: '))
    .map((blk) => ({ event: /event: (\S+)/.exec(blk)?.[1], ...JSON.parse(blk.slice(blk.indexOf('data: ') + 6)) }));
  return { status: r.status, json: null, events };
};
const cardBody = (over: Record<string, unknown> = {}) => ({ question: 'Why am I so tired at night?', card: { board: 'self', id: 'body', from: PERIODS[0]!.from, to: PERIODS[0]!.to }, turnId: randomUUID(), ...over });

describe('GET /api/cards/:board/:cardId/chat', () => {
  it('the stored preamble, the period, the cost line and an empty thread; private; no model call', async () => {
    const r = await get(`/api/cards/self/body/chat?from=${PERIODS[0]!.from}&to=${PERIODS[0]!.to}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toMatch(/private/);
    expect(r.body).toEqual({
      card: { board: 'self', id: 'body', title: 'Body & energy', subtitle: 'What Body & energy answers' },
      period: { from: PERIODS[0]!.from, to: PERIODS[0]!.to, label: PERIODS[0]!.label },
      preamble: { headline: PERIODS[0]!.headline, lines: PERIODS[0]!.text, keyDates: [{ date: '2027-01-01', label: 'Heavy stretch ends' }], confirm: 'Did you feel worn out in spring 2026?' },
      cost: { uses: 1, remaining: 20, limit: 20, line: 'Uses 1 of your 20 questions this month (20 left)' },
      thread: { chatId: null, messages: [] },
    });
    expect(streamed).toHaveLength(0);
  });
  it('Love and Work open the same way', async () => {
    expect((await get('/api/cards/love/dating_pulse/chat')).body.card).toEqual({ board: 'love', id: 'dating_pulse', title: 'Where Dating Stands', subtitle: 'What Where Dating Stands answers' });
    expect((await get('/api/cards/work/job_pulse/chat')).body.period).toBeNull();
  });
  it('errors: unknown board or card, a card not read yet, a bad period, no user', async () => {
    expect(await get('/api/cards/lucky/now/chat')).toMatchObject({ status: 400, body: { error: 'unknown_board' } });
    expect(await get('/api/cards/self/nope/chat')).toMatchObject({ status: 400, body: { error: 'unknown_card' } });
    expect(await get('/api/cards/self/sleep/chat')).toMatchObject({ status: 409, body: { error: 'card_not_ready' } });
    expect(await get('/api/cards/self/body/chat?from=2030-01-01&to=2030-02-01')).toMatchObject({ status: 400, body: { error: 'bad_period' } });
    expect((await fetch(`${base}/api/cards/self/body/chat`)).status).toBe(401);
  });
});

describe('POST /api/chat/ask-stream with card', () => {
  it('card event first, the cardchat key reserved and committed, tokens streamed, saved to a new card thread', async () => {
    const b = cardBody();
    const r = await ask(b);
    expect(r.status).toBe(200);
    const types = r.events.map((e) => e.type);
    expect(types[0]).toBe('turn_init');
    expect(r.events[1]).toMatchObject({ type: 'card', board: 'self', id: 'body', title: 'Body & energy', periodLabel: PERIODS[0]!.label, turnId: b.turnId });
    expect(types.slice(2, 4)).toEqual(['start', 'usage']);
    expect(r.events.filter((e) => e.type === 'token').map((e) => e.delta).join('')).toBe(answerText);
    const done = r.events.at(-1)!;
    expect(done).toMatchObject({ event: 'turn_done', type: 'done', chatId: 'chat1', answer: answerText, card: { board: 'self', id: 'body' } });
    const key = `cardchat:self:body:${b.turnId}`;
    expect(store.usage.map((u) => [u.key, u.status])).toEqual([[key, 'committed']]);
    expect(breakdownOf(store.usage.map((u) => u.key))).toMatchObject({ cardchat: 1, chat: 0 });
    expect(chats).toEqual([expect.objectContaining({ id: 'chat1', card_ref: 'self:body', category: 'you', name: 'Body & energy', is_active: false })]);
    expect(updateManyCalls).toBe(0);
    expect(messages[0]!.question).toBe(`[Body & energy · ${PERIODS[0]!.label}] Why am I so tired at night?`);
    // the call read the card's cached prefix
    expect(streamed[0]!.parts[0]).toBe(prefix.text);
    expect(streamed[0]!.cachePrefix).toBe(true);
  });

  it('a retry of the same turnId replays the saved answer: no model call, no second charge; a reserved one is 409', async () => {
    const b = cardBody();
    await ask(b);
    expect(streamed).toHaveLength(1);
    const again = await ask(b);
    expect(again.events[1]).toMatchObject({ type: 'card' });
    expect(again.events.at(-1)).toMatchObject({ type: 'done', replay: true, answer: answerText, chatId: 'chat1' });
    expect(streamed).toHaveLength(1);
    expect(store.usage).toHaveLength(1);
    expect((await store.getAccount('u1'))!.questions_used_this_month).toBe(1);
    store.usage[0]!.status = 'reserved';
    expect(await ask(b)).toMatchObject({ status: 409, json: { error: 'turn_in_flight' } });
  });

  it('the next question goes to the same thread and carries the last two exchanges; the GET lists the thread', async () => {
    for (const q of ['First?', 'Second?', 'Third?']) await ask(cardBody({ question: q }));
    const last = streamed.at(-1)!.parts[1]!;
    expect(last).toContain('Q: First?');
    expect(last).toContain('Q: Second?');
    await ask(cardBody({ question: 'Fourth?' }));
    expect(streamed.at(-1)!.parts[1]).not.toContain('Q: First?');
    expect(chats).toHaveLength(1);
    const g = await get('/api/cards/self/body/chat');
    expect(g.body.thread.chatId).toBe('chat1');
    expect(g.body.thread.messages.map((m: any) => m.question)).toEqual(['First?', 'Second?', 'Third?', 'Fourth?']);
    expect(g.body.thread.messages[0].periodLabel).toBe(PERIODS[0]!.label);
  });

  it('the thread is found after an ordinary chat deactivated it; newThread starts a fresh one', async () => {
    await ask(cardBody({ question: 'One?' }));
    chats[0]!.is_active = false;
    chats.push({ id: 'plain', user_id: 'u1', is_active: true, category: 'general', name: 'x', card_ref: null, created_at: at() });
    expect((await get('/api/cards/self/body/chat')).body.thread.chatId).toBe('chat1');
    // a chatId of another chat is never written to
    await ask(cardBody({ question: 'Two?', chatId: 'plain' }));
    expect(messages.filter((m) => m.chat_id === 'plain')).toHaveLength(0);
    await ask(cardBody({ question: 'Fresh?', newThread: true }));
    expect(chats.filter((c) => c.card_ref === 'self:body')).toHaveLength(2);
    expect((await get('/api/cards/self/body/chat')).body.thread.messages.map((m: any) => m.question)).toEqual(['Fresh?']);
  });

  it('Love and Work answer on their cards, each under its own key and thread category', async () => {
    const l = await ask({ question: 'When does it warm up?', card: { board: 'love', id: 'dating_pulse' }, turnId: randomUUID() });
    expect(l.events.at(-1)).toMatchObject({ type: 'done', card: { board: 'love', id: 'dating_pulse' } });
    const w = await ask({ question: 'Is my job steady?', card: { board: 'work', id: 'job_pulse' }, turnId: randomUUID() });
    expect(w.events.at(-1)).toMatchObject({ type: 'done', card: { board: 'work', id: 'job_pulse' } });
    expect(store.usage.map((u) => u.key.split(':').slice(0, 3).join(':'))).toEqual(['cardchat:love:dating_pulse', 'cardchat:work:job_pulse']);
    expect(chats.map((c) => [c.card_ref, c.category])).toEqual([
      ['love:dating_pulse', 'love'],
      ['work:job_pulse', 'work'],
    ]);
    expect(streamed[0]!.parts[1]).toContain('CARD BRIEF\nCARD: `dating_pulse`');
    expect(streamed[1]!.parts[1]).toContain('Work board');
  });

  it('errors come before any SSE frame', async () => {
    expect(await ask(cardBody({ focus: 'career_work' }))).toMatchObject({ status: 400, json: { error: 'card_with_focus' } });
    expect(await ask(cardBody({ turnId: 'abc' }))).toMatchObject({ status: 400, json: { error: 'bad_turn_id' } });
    expect(await ask(cardBody({ card: 'body' }))).toMatchObject({ status: 400, json: { error: 'bad_card' } });
    expect(await ask(cardBody({ card: { board: 'self', id: 'sleep' } }))).toMatchObject({ status: 409, json: { error: 'card_not_ready' } });
    expect(await ask(cardBody({ card: { board: 'love', id: 'job_pulse' } }))).toMatchObject({ status: 400, json: { error: 'unknown_card' } });
    store.accounts.set('u1', { ...(await store.ensureAccount('u1', 0)), question_quota: 0 });
    expect(await ask(cardBody())).toMatchObject({ status: 402, json: { code: 'quota_exhausted' } });
    expect(streamed).toHaveLength(0);
  });

  it('a declined topic is answered by policy, saved withheld, and not charged', async () => {
    const r = await ask(cardBody({ question: 'When will I die?' }));
    expect(r.events.at(-1)).toMatchObject({ type: 'done', answer: 'AI AdAstra cannot help with that.' });
    expect(streamed).toHaveLength(0);
    expect(store.usage).toHaveLength(0);
    expect(messages[0]!.question).toBe(`[Body & energy · ${PERIODS[0]!.label}] [withheld: death]`);
  });

  it('over the per-operation cap: no call, the question is given back, error spend_cap', async () => {
    capUsd = 0.0001;
    const r = await ask(cardBody());
    expect(r.events.at(-1)).toMatchObject({ type: 'error', code: 'spend_cap' });
    expect(streamed).toHaveLength(0);
    expect(store.usage[0]!.status).toBe('released');
  });
});
