/**
 * docs/reading-engine/85 §4 step 2 (Sachin, 2026-11-18): the first question on a card goes through Clarify, pre-filled
 * from the card. The card names the subject and the period on screen, so Clarify never asks for the life area, the
 * period, the sub-area or whose chart; facts in person_facts are not asked; nothing left to ask = straight to the answer.
 * A missing fact (which brother) is asked inside the card with the main chat's clarify events, the answer is `ready`,
 * and confirm-stream streams the card's answer under the first send's `cardchat:<board>:<card>:<turnId>` key, so the
 * clarifier is free. Follow-ups skip Clarify. Real question gate over an in-memory plan store, memory clarify store,
 * fake model, no database, no paid call (the clarify model is off, the Gemini URL is dead).
 */
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QuestionGate, type QuestionTicket } from '../../../../src/billing/questionGate.js';
import { registerChatRoutes } from '../../../../src/chat/chatRoutes.js';
import { clearDeclinedTopicsCache } from '../../../../src/reading/policy/declined.js';
import { MemoryClarifyStore } from '../../../../src/reading/clarify/store.js';
import { CARD_BOARD_BUCKETS, cardClarifySeed, clarifiedLines } from '../../../../src/reading/cardChat/clarify.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import type { CardChatRouteDeps } from '../../../../src/routes/cardChatRoutes.js';
import { registerClarifyRoutes } from '../../../../src/routes/clarifyRoutes.js';
import type { UserLocationStore } from '../../../../src/services/userLocation.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { MemoryPlanStore } from '../self/v2api/memoryPlanStore.js';
import { ASOF, body, PERIODS, resolveSeams, view } from './fixtures.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const MODEL = 'gemini-3.8-flash';
// no model may be reached from here: the clarify model is off, the reading metrics write nothing, Gemini is unreachable
const ENV: Record<string, string> = { READING_MODEL_CLARIFY: 'off', READING_METRICS: '0', READING_CLARIFY_MODE: 'when_missing', GEMINI_API_URL: 'http://127.0.0.1:9', GEMINI_API_KEY: '' };
const savedEnv: Record<string, string | undefined> = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ChatRow { id: string; user_id: string; is_active: boolean; category: string; name: string | null; card_ref: string | null; created_at: Date }
interface MsgRow { id: string; chat_id: string; question: string; ai_answer: string; created_at: Date }
let chats: ChatRow[] = [];
let messages: MsgRow[] = [];
let facts: Array<{ key: string; value: string; source: string; confirmed_at: Date | null }> = [];
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
    updateMany: async () => ({ count: 0 }),
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
  personFact: { findMany: async () => facts },
  declinedTopic: { findMany: async () => [] },
  auth: { findUnique: async () => ({ role: 'novice' }) },
  chatLog: { create: async () => ({}) },
  chatTurn: { create: async () => ({ id: randomUUID() }), update: async () => ({}) },
} as any;

let plans: MemoryPlanStore;
let gate: QuestionGate;
let clarifyStore: MemoryClarifyStore;
const commits = new Map<string, { chatId?: string; messageId?: string }>();
const streamed: GeminiCallOptions[] = [];
const answerText = 'Lean on the steadier stretch after New Year. ';
const stream = async (o: GeminiCallOptions, onDelta?: (d: string) => void): Promise<GeminiResult> => {
  streamed.push(o);
  for (const w of answerText.split(/(?<= )/)) onDelta?.(w);
  return { text: answerText, usage: { node: o.node, model: MODEL, promptTokens: 9000, cachedTokens: 8000, outputTokens: 120, thoughtTokens: 0, ms: 5 }, finishReason: 'STOP', ttftMs: 5, stoppedForLoop: false };
};
// the person's current place is stored: "Where are you living now?" is never due
const locationStore: UserLocationStore = { get: async () => ({ status: 'found', location: { place: 'Pune', tz: 'Asia/Kolkata' } }) as any, save: async () => true };

const selfBody = body([view('body', 'Body & energy')], ['body']);
const loveBody = body([view('dating_pulse', 'Where Dating Stands')], ['dating_pulse']);
const workBody = body([view('job_pulse', 'Where Your Job Stands')], ['job_pulse']);

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  for (const [k, v] of Object.entries(ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  const app = express();
  app.use(express.json());
  const requireUser = fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null);
  const card: Omit<CardChatRouteDeps, 'prisma' | 'requireUser'> = {
    resolve: resolveSeams({ self: selfBody, love: loveBody, work: workBody }),
    answer: { model: MODEL, stream },
    gate: {
      check: (...a) => gate.check(...a),
      reserve: (...a) => gate.reserve(...a),
      commit: (...a) => gate.commit(...a),
      release: (...a) => gate.release(...a),
      getStatus: (...a) => gate.getStatus(...a),
    },
    usageRow: async (_p, userId, key) => {
      const r = plans.usage.find((x) => x.user_id === userId && x.key === key);
      return r ? { status: r.status, chat_id: commits.get(r.id)?.chatId ?? null, message_id: commits.get(r.id)?.messageId ?? null } : null;
    },
    rateLimit: async () => ({ allowed: true }),
    clarify: {
      get store() {
        return clarifyStore;
      },
      locationStore,
      asOf: () => ASOF,
    },
  };
  registerChatRoutes(app, { prisma, requireUser, card });
  registerClarifyRoutes(app, {
    prisma,
    requireUser,
    get store() {
      return clarifyStore;
    },
    locationStore,
    card,
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  for (const k of Object.keys(ENV)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
beforeEach(() => {
  chats = [];
  messages = [];
  facts = [];
  streamed.length = 0;
  commits.clear();
  clearDeclinedTopicsCache();
  clarifyStore = new MemoryClarifyStore();
  plans = new MemoryPlanStore(NOW);
  gate = new QuestionGate(plans, { enabled: true, now: () => NOW, env: { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv });
  const commit = gate.commit.bind(gate);
  gate.commit = async (t: QuestionTicket, d: { chatId?: string; messageId?: string } = {}) => {
    if (t.id) commits.set(t.id, d);
    return commit(t, d);
  };
});

const parseSse = (text: string) =>
  text
    .split('\n\n')
    .filter((blk) => blk.includes('data: '))
    .map((blk) => ({ event: /event: (\S+)/.exec(blk)?.[1], ...JSON.parse(blk.slice(blk.indexOf('data: ') + 6)) }));
const post = async (path: string, b: Record<string, unknown>, user = 'u1') => {
  const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify(b) });
  const text = await r.text();
  if (!r.headers.get('content-type')?.includes('text/event-stream')) return { status: r.status, json: JSON.parse(text), events: [] as any[] };
  return { status: r.status, json: null as any, events: parseSse(text) };
};
const ask = (b: Record<string, unknown>) => post('/api/chat/ask-stream', b);
const selfCard = { board: 'self', id: 'body', from: PERIODS[0]!.from, to: PERIODS[0]!.to };
const tokens = (events: any[]) => events.filter((e) => e.type === 'token').map((e) => e.delta).join('');
/** the only clarify run of the test */
const onlyRun = async () => {
  const s = await clarifyStore.get('u1', 'clarify-1');
  expect(await clarifyStore.get('u1', 'clarify-2')).toBeNull();
  return s!;
};

describe('the card seeds the clarifier', () => {
  it("each board's areas; the period on screen (past or not) or the whole card; the card as the sub-area", () => {
    const seed = cardClarifySeed({ board: 'love', id: 'dating_pulse', title: 'Where Dating Stands', period: { from: '2025-01-01', to: '2025-06-01', label: 'Back then' } } as never, { turnId: 't', newThread: false });
    expect(seed.buckets).toBe(CARD_BOARD_BUCKETS.love);
    expect(seed.horizon).toEqual({ value: { from: '2025-01-01', to: '2025-06-01' }, text: 'Back then' });
    expect(seed.subBucket).toEqual({ value: 'card:dating_pulse', text: 'Where Dating Stands' });
    expect(seed.cardChat).toEqual({ board: 'love', id: 'dating_pulse', from: '2025-01-01', to: '2025-06-01', turnId: 't', newThread: false });
    const whole = cardClarifySeed({ board: 'work', id: 'job_pulse', title: 'Where Your Job Stands', period: null } as never, { turnId: 't', newThread: true });
    expect(whole.horizon.text).toBe('the whole Where Your Job Stands card');
    expect(clarifiedLines({ turns: [{ ask: { criterion: 'sibling', question: 'Which brother do you mean?', chips: [{ label: 'Elder brother', value: 'elder_brother' }], allowFreeText: true }, at: 0, answer: { value: 'elder_brother', viaChip: true, resolved: true } }] } as never)).toEqual([
      'Which brother do you mean? → Elder brother',
    ]);
  });
});

describe('POST /api/chat/ask-stream with card and clarify', () => {
  it('first question: Clarify runs pre-filled and asks nothing when the card and the facts settle it; the answer streams at once', async () => {
    facts = [{ key: 'work.status', value: 'yes', source: 'tapped', confirmed_at: NOW }];
    // a work question with no period and no sub-area: the main chat would ask both
    const b = { question: 'How is work going?', card: { board: 'work', id: 'job_pulse' }, turnId: randomUUID(), clarify: true };
    const r = await ask(b);
    expect(r.status).toBe(200);
    const types = r.events.map((e) => e.type);
    expect(types).not.toContain('clarify');
    expect(types.slice(0, 4)).toEqual(['turn_init', 'card', 'start', 'usage']);
    expect(tokens(r.events)).toBe(answerText);
    expect(r.events.at(-1)).toMatchObject({ event: 'turn_done', type: 'done', chatId: 'chat1', card: { board: 'work', id: 'job_pulse' } });
    // the run was made, from the card: its area, the whole card as the period, the card as the sub-area, the known fact
    const s = await onlyRun();
    expect(s.status).toBe('READY');
    expect(s.turns).toEqual([]);
    expect(s.bucket).toBe('career_job');
    expect(s.cardChat).toMatchObject({ board: 'work', id: 'job_pulse', turnId: b.turnId });
    expect(s.slots.horizon?.text).toBe('the whole Where Your Job Stands card');
    expect(s.slots.sub_bucket).toEqual({ value: 'card:job_pulse', text: 'Where Your Job Stands' });
    expect(s.slots.background?.value).toBe('employed');
    expect(s.facts).toMatchObject({ 'work.status': 'yes' });
    expect(plans.usage.map((u) => [u.key, u.status])).toEqual([[`cardchat:work:job_pulse:${b.turnId}`, 'committed']]);
    expect(streamed).toHaveLength(1);
    expect(streamed[0]!.parts.at(-1)).not.toContain('WHAT THE PERSON SETTLED');
  });

  it('a missing fact is asked with the main chat\'s clarify events; nothing is reserved or read until the answer turn', async () => {
    const b = { question: 'Will my brother stand by me through this?', card: selfCard, turnId: randomUUID(), clarify: true };
    const r = await ask(b);
    expect(r.status).toBe(200);
    expect(r.events.map((e) => [e.event, e.type])).toEqual([
      ['turn_init', 'turn_init'],
      ['card', 'card'],
      ['clarify', 'start'],
      ['clarify', 'clarify'],
      ['turn_done', 'done'],
    ]);
    const q = r.events[3]!;
    expect(q).toMatchObject({ criterion: 'sibling', question: 'Which brother do you mean?', allowFreeText: true, runId: 'clarify-1' });
    expect(q.chips.map((c: any) => c.value)).toEqual(['elder_brother', 'younger_brother', 'all']);
    expect(r.events.at(-1)).toMatchObject({ type: 'done', status: 'clarifying', runId: 'clarify-1', card: { board: 'self', id: 'body' } });
    // never the area, the period or the sub-area: the card settles them
    const s = await onlyRun();
    expect(s.turns.map((t) => t.ask.criterion)).toEqual(['sibling']);
    expect(s.slots.horizon).toEqual({ value: { from: PERIODS[0]!.from, to: PERIODS[0]!.to }, text: PERIODS[0]!.label });
    // the clarifier is free: no question reserved, no model call, nothing saved
    expect(plans.usage).toHaveLength(0);
    expect(streamed).toHaveLength(0);
    expect(messages).toHaveLength(0);

    // the answer is `ready` (a card run never proposes "I will read …")
    const a = await post('/api/chat/answer', { runId: 'clarify-1', value: 'elder_brother', viaChip: true });
    expect(a).toMatchObject({ status: 200, json: { type: 'ready', runId: 'clarify-1' } });
    expect(plans.usage).toHaveLength(0);

    // confirm-stream: the card's answer, the card event first, under the first send's own key
    const c = await post('/api/chat/confirm-stream', { runId: 'clarify-1', chatId: null });
    expect(c.status).toBe(200);
    expect(c.events.map((e) => e.type).slice(0, 4)).toEqual(['turn_init', 'card', 'start', 'usage']);
    expect(c.events[1]).toMatchObject({ type: 'card', board: 'self', id: 'body', title: 'Body & energy', periodLabel: PERIODS[0]!.label, turnId: b.turnId });
    expect(tokens(c.events)).toBe(answerText);
    expect(c.events.at(-1)).toMatchObject({ type: 'done', chatId: 'chat1', answer: answerText, clarifyRunId: 'clarify-1', card: { board: 'self', id: 'body' } });
    expect(plans.usage.map((u) => [u.key, u.status])).toEqual([[`cardchat:self:body:${b.turnId}`, 'committed']]);
    // the answer read the card and what the person settled
    expect(streamed).toHaveLength(1);
    const suffix = streamed[0]!.parts.at(-1)!;
    expect(suffix).toContain('CARD ON SCREEN');
    expect(suffix).toContain('WHAT THE PERSON SETTLED BEFORE THIS QUESTION');
    expect(suffix).toContain('- Which brother do you mean? → Elder brother');
    expect(suffix).toContain('QUESTION: Will my brother stand by me through this?');
    expect(messages[0]!.question).toBe(`[Body & energy · ${PERIODS[0]!.label}] Will my brother stand by me through this?`);
    expect((await clarifyStore.get('u1', 'clarify-1'))!.status).toBe('CONFIRMED');

    // a retry of the confirm replays the saved answer: no model call, no second charge
    const again = await post('/api/chat/confirm-stream', { runId: 'clarify-1', chatId: 'chat1' });
    expect(again.events.at(-1)).toMatchObject({ type: 'done', replay: true, answer: answerText, clarifyRunId: 'clarify-1' });
    expect(streamed).toHaveLength(1);
    expect((await plans.getAccount('u1'))!.questions_used_this_month).toBe(1);
  });

  it('follow-ups in the same thread skip Clarify, even when the client sends clarify', async () => {
    await ask({ question: 'Why am I tired at night?', card: selfCard, turnId: randomUUID(), clarify: true });
    expect(streamed).toHaveLength(1);
    const before = (await clarifyStore.get('u1', 'clarify-1'))!;
    expect(before.status).toBe('READY');
    // this one would ask "which brother" as a first question
    const r = await ask({ question: 'Will my brother stand by me through this?', card: selfCard, turnId: randomUUID(), clarify: true, chatId: 'chat1' });
    expect(r.events.map((e) => e.type)).not.toContain('clarify');
    expect(r.events.at(-1)).toMatchObject({ type: 'done', chatId: 'chat1' });
    expect(streamed).toHaveLength(2);
    expect(await clarifyStore.get('u1', 'clarify-2')).toBeNull();
    expect(plans.usage.filter((u) => u.status === 'committed')).toHaveLength(2);
  });

  it('without clarify the card answers directly (older clients), and newThread asks again', async () => {
    const r = await ask({ question: 'Will my brother stand by me through this?', card: selfCard, turnId: randomUUID() });
    expect(r.events.map((e) => e.type)).not.toContain('clarify');
    expect(await clarifyStore.get('u1', 'clarify-1')).toBeNull();
    const fresh = await ask({ question: 'Will my brother stand by me through this?', card: selfCard, turnId: randomUUID(), clarify: true, newThread: true });
    expect(fresh.events.at(-1)).toMatchObject({ type: 'done', status: 'clarifying' });
  });

  it("a question about the person's child asks the age first instead of declining it; 18+ is then answered", async () => {
    const b = { question: 'Will my daughter find a good job?', card: { board: 'work', id: 'job_pulse' }, turnId: randomUUID(), clarify: true };
    const r = await ask(b);
    expect(r.events.find((e) => e.type === 'clarify')).toMatchObject({ criterion: 'child_age' });
    expect(plans.usage).toHaveLength(0);
    expect(await post('/api/chat/answer', { runId: 'clarify-1', value: 'adult', viaChip: true })).toMatchObject({ json: { type: 'ready' } });
    const c = await post('/api/chat/confirm-stream', { runId: 'clarify-1' });
    expect(c.events.at(-1)).toMatchObject({ type: 'done', answer: answerText });
    expect(streamed[0]!.parts.at(-1)).toContain('→ 18 or older');
    expect(plans.usage.map((u) => u.key)).toEqual([`cardchat:work:job_pulse:${b.turnId}`]);
  });

  it('confirm-stream on a card run still asking is refused before any frame', async () => {
    await ask({ question: 'Will my brother stand by me through this?', card: selfCard, turnId: randomUUID(), clarify: true });
    expect(await post('/api/chat/confirm-stream', { runId: 'clarify-1' })).toMatchObject({ status: 409, json: { error: 'not_ready' } });
    expect(streamed).toHaveLength(0);
  });
});
