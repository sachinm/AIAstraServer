import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelCall } from '../../../src/assistant/answer.js';
import { UNSURE, WOULD_NOT_KNOW } from '../../../src/assistant/guard.js';
import type { AssistantStore, QuestionFacts, VisitFacts } from '../../../src/assistant/store.js';
import { assistantEnabled, registerAssistantRoutes } from '../../../src/routes/assistantRoutes.js';

class MemoryStore implements AssistantStore {
  visits: VisitFacts[] = [];
  questions: QuestionFacts[] = [];
  visitLastHour = 0;
  siteToday = 0;
  failCounts = false;
  async recordVisit(v: VisitFacts) { this.visits.push(v); }
  async recordQuestion(q: QuestionFacts) { this.questions.push(q); }
  async counts() {
    if (this.failCounts) throw new Error('db down');
    return { visitLastHour: this.visitLastHour, siteToday: this.siteToday };
  }
  async purge() { return { questions: 0, visits: 0, ipsCleared: 0 }; }
}

const prisma = { declinedTopic: { findMany: async () => [] } } as unknown as PrismaClient;
const VISIT = '11111111-2222-4333-8444-555555555555';

describe('the assistant routes', () => {
  let server: Server;
  let base = '';
  let store: MemoryStore;
  let call: ModelCall;

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

  beforeEach(async () => {
    store = new MemoryStore();
    call = vi.fn(async () => ({ json: { answer: 'Yes. A reading looks at work.', verdict: 'yes', cta: true }, tokensIn: 3, tokensOut: 2 }));
    const app = express();
    app.use(express.json());
    registerAssistantRoutes(app, { prisma, store, call, env: {} as NodeJS.ProcessEnv });
    await new Promise<void>((r) => { server = app.listen(0, () => r()); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(() => new Promise<void>((r) => { server.close(() => r()); }));

  it('needs no sign-in, answers, and logs the visit and the question', async () => {
    const res = await post('/api/assistant/ask', { question: 'can you help with my career?', visitId: VISIT, path: '/', referrer: 'https://example.com/' }, {
      'user-agent': 'TestAgent/1',
      'cloudfront-viewer-address': '203.0.113.42:51234',
      'cloudfront-viewer-country': 'IN',
      'accept-language': 'hi',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: 'Yes. A reading looks at work.', verdict: 'yes', cta: true, visitId: VISIT });
    expect(store.visits[0]).toMatchObject({ visitId: VISIT, ip: '203.0.113.42', userAgent: 'TestAgent/1', country: 'IN', language: 'hi', path: '/', referrer: 'https://example.com/' });
    expect(store.questions[0]).toMatchObject({ visitId: VISIT, ip: '203.0.113.42', question: 'can you help with my career?', outcome: 'answered', model: 'nvidia.nemotron-super-3-120b', tokensIn: 3 });
  });

  it('cannot be fooled about the address by a forged X-Forwarded-For when CloudFront names the viewer', async () => {
    await post('/api/assistant/visit', { visitId: VISIT }, { 'x-forwarded-for': '1.2.3.4', 'cloudfront-viewer-address': '203.0.113.42:1' });
    expect(store.visits[0].ip).toBe('203.0.113.42');
  });

  it('gives the fixed answer about how it works, with no model and no count', async () => {
    const res = await post('/api/assistant/ask', { question: 'what dasha systems do you use?', visitId: VISIT });
    expect((await res.json()).answer).toBe(WOULD_NOT_KNOW);
    expect(call).not.toHaveBeenCalled();
    expect(store.questions[0]).toMatchObject({ outcome: 'inside', model: null });
  });

  it('refuses an empty or missing question', async () => {
    expect((await post('/api/assistant/ask', { question: '   ' })).status).toBe(400);
    expect((await post('/api/assistant/ask', {})).status).toBe(400);
    expect(store.questions).toHaveLength(0);
  });

  it('cuts a very long question before the model sees it', async () => {
    await post('/api/assistant/ask', { question: `career ${'x'.repeat(2000)}`, visitId: VISIT });
    expect((vi.mocked(call).mock.calls[0][1] as string).length).toBe(400);
  });

  it('makes its own visit id when the one sent is not valid', async () => {
    const j = await (await post('/api/assistant/visit', { visitId: "x'; DROP TABLE" })).json();
    expect(j.visitId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stops model calls for a visit over its hourly limit, still answering', async () => {
    store.visitLastHour = 10;
    const j = await (await post('/api/assistant/ask', { question: 'can you help with my career?', visitId: VISIT })).json();
    expect(call).not.toHaveBeenCalled();
    expect(j.cta).toBe(true);
    expect(store.questions[0].outcome).toBe('limited');
  });

  it('stops model calls at the daily cap', async () => {
    store.siteToday = 2000;
    const j = await (await post('/api/assistant/ask', { question: 'can you help with my career?', visitId: VISIT })).json();
    expect(call).not.toHaveBeenCalled();
    expect(j.answer).toBe(UNSURE);
  });

  it('makes no model call when it cannot count, so the bill stays bounded', async () => {
    store.failCounts = true;
    const res = await post('/api/assistant/ask', { question: 'can you help with my career?', visitId: VISIT });
    expect(res.status).toBe(200);
    expect(call).not.toHaveBeenCalled();
  });

  it('still answers when the log fails', async () => {
    store.recordQuestion = async () => { throw new Error('db down'); };
    store.recordVisit = async () => { throw new Error('db down'); };
    const res = await post('/api/assistant/ask', { question: 'can you help with my career?', visitId: VISIT });
    expect(res.status).toBe(200);
  });
});

describe('the off switch', () => {
  it('is on unless set off', () => {
    expect(assistantEnabled({} as NodeJS.ProcessEnv)).toBe(true);
    expect(assistantEnabled({ ASSISTANT_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
    expect(assistantEnabled({ ASSISTANT_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('mounts nothing when off', () => {
    const app = express();
    expect(registerAssistantRoutes(app, { prisma, store: new MemoryStore(), env: { ASSISTANT_ENABLED: '0' } as NodeJS.ProcessEnv })).toBe(false);
  });
});
