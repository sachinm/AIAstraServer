import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { askingGuide, COACH, guidanceFor } from '../../../src/reading/coach/content.js';
import { BUCKET_IDS } from '../../../src/reading/buckets/taxonomy.js';
import { detectDeclined } from '../../../src/reading/policy/declined.js';
import { registerClarifyRoutes, clarifyOnAsk } from '../../../src/routes/clarifyRoutes.js';
import { MemoryClarifyStore } from '../../../src/reading/clarify/store.js';
import { clearDeclinedTopicsCache } from '../../../src/reading/policy/declined.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

describe('coaching content', () => {
  it('has a card for every bucket, and no example falls into a declined topic', () => {
    for (const b of BUCKET_IDS) {
      const c = COACH[b];
      expect(c.bucket).toBe(b);
      // the health card is shown only to roles allowed to discuss health, so check it as one of them
      const role = b === 'health_windows' ? 'astrologer' : 'novice';
      for (const q of [c.goodExample, c.rewrite]) if (q) expect(detectDeclined(q, { role }), `${b}: ${q}`).toBeNull();
    }
  });
  it('gives guidance only for questions with no area or no subject', () => {
    expect(guidanceFor('unknown', 'no_subject')?.text).toMatch(/one area of life over a period/);
    expect(guidanceFor('unknown', 'no_subject')?.chips.map((c) => c.value)).not.toContain('health_windows');
    expect(guidanceFor('marriage', null)).toBeNull();
  });
  it('the asking guide hides health unless the role may discuss it', () => {
    expect(askingGuide(null, { healthAllowed: false }).map((c) => c.bucket)).not.toContain('health_windows');
    expect(askingGuide(null, { healthAllowed: true }).map((c) => c.bucket)).toContain('health_windows');
    expect(askingGuide('health_windows', { healthAllowed: false })).toEqual([]);
    expect(askingGuide('career_job', { healthAllowed: false })[0]?.goodExample).toMatch(/change jobs/);
  });
});

describe('clarify HTTP endpoints', () => {
  let fake: FakeGemini;
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  const env0 = { ...process.env };
  const store = new MemoryClarifyStore();
  const prisma = {
    declinedTopic: { findMany: vi.fn().mockResolvedValue([]) },
    auth: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', kundli_added: true, role: 'novice' }) },
    chat: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 'chat1' }), update: vi.fn().mockResolvedValue({}) },
    message: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockImplementation(async ({ data }: { data: { question: string } }) => ({ id: 'm1', ...data })) },
    chatLog: { create: vi.fn().mockResolvedValue({}) },
    readingRun: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient;

  beforeAll(async () => {
    fake = await startFakeGemini({ chunkDelayMs: 1 });
    const app = express();
    app.use(express.json());
    const getUserId = (req: express.Request) => (req.headers['x-user'] as string) ?? null;
    app.post('/api/chat/ask-stream', async (req, res) => {
      const write = (o: unknown) => res.write(`data: ${JSON.stringify(o)}\n\n`);
      res.setHeader('Content-Type', 'text/event-stream');
      const handled = await clarifyOnAsk({ prisma, getUserId, store }, getUserId(req)!, req.body.question, { write });
      if (!handled) write({ type: 'not_clarified' });
      res.end();
    });
    registerClarifyRoutes(app, { prisma, getUserId, store });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.close();
    await fake.close();
  });
  beforeEach(() => {
    Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', CHAT_LLM_PROVIDER: 'gemini', READING_FACTS_SOURCE: 'fixture' });
    delete process.env.READING_ENGINE;
    clearDeclinedTopicsCache();
    clearReadingCaches();
  });
  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
    Object.assign(process.env, env0);
  });

  const sse = async (path: string, body: unknown) => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': 'u1' }, body: JSON.stringify(body) });
    const text = await r.text();
    return text.split('\n\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);
  };
  const post = async (path: string, body: unknown, user = 'u1') => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user': user }, body: JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as Record<string, unknown> };
  };

  it('ask -> clarify event -> answer -> propose -> confirm-stream streams the reading with the clarified period', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'When will I get married?', clarify: true });
    const clarify = events.find((e) => e.type === 'clarify')!;
    expect(clarify.criterion).toBe('horizon');
    expect(events.at(-1)).toMatchObject({ type: 'done', status: 'clarifying' });
    const a = await post('/api/chat/answer', { runId: clarify.runId, value: '6m', viaChip: true });
    expect(a.status).toBe(200);
    expect(a.body.type).toBe('propose');
    expect(String(a.body.exactQuery)).toMatch(/next 6 months/);
    const out = await sse('/api/chat/confirm-stream', { runId: clarify.runId });
    const intent = out.find((e) => e.type === 'intent') as { intent: { horizon: unknown; text: string } } | undefined;
    expect(intent?.intent.horizon).toBe('6m');
    expect(intent?.intent.text).toMatch(/^I will read:/);
    expect(out.some((e) => e.type === 'token')).toBe(true);
    expect(out.at(-1)).toMatchObject({ type: 'done', chatId: 'chat1', clarifyRunId: clarify.runId });
  });

  it('a vague question gets the area question with guidance', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'Hello', clarify: true });
    const clarify = events.find((e) => e.type === 'clarify')!;
    expect(clarify.criterion).toBe('bucket');
    expect(String(clarify.guidance)).toMatch(/one area of life/);
  });

  it('a complete question is not clarified (the reading runs as usual)', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'Should I change jobs this year?', clarify: true });
    expect(events).toEqual([{ type: 'not_clarified' }]);
  });

  it('a declined question is not clarified (the chat path answers it with the fixed reply)', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'When will I die?', clarify: true });
    expect(events).toEqual([{ type: 'not_clarified' }]);
  });

  it('a deny answer during clarifying returns only the fixed reply', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'When will I get married?', clarify: true });
    const runId = events.find((e) => e.type === 'clarify')!.runId;
    const a = await post('/api/chat/answer', { runId, value: 'after I hurt someone', viaChip: false });
    expect(a.body).toEqual({ type: 'declined', runId, category: 'deny', reply: 'AI Astra cannot help with that.' });
  });

  it('rejects other users, unknown runs and bad bodies', async () => {
    const events = await sse('/api/chat/ask-stream', { question: 'When will I get married?', clarify: true });
    const runId = events.find((e) => e.type === 'clarify')!.runId;
    expect((await post('/api/chat/answer', { runId, value: '6m', viaChip: true }, 'u2')).status).toBe(404);
    expect((await post('/api/chat/answer', { runId: 'nope', value: '6m' })).status).toBe(404);
    expect((await post('/api/chat/answer', { runId })).status).toBe(400);
    const r = await fetch(base + '/api/chat/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(401);
  });
});
