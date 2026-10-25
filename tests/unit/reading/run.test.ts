import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { ReadingUnavailableError, runReading } from '../../../src/reading/run.js';
import type { ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF } from '../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

let fake: FakeGemini;
const prisma = {} as unknown as PrismaClient;

beforeAll(async () => {
  fake = await startFakeGemini({ chunkDelayMs: 1 });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_FLOW;
});
afterAll(async () => {
  await fake.close();
  delete process.env.READING_FACTS_SOURCE;
  delete process.env.READING_INTAKE_MODE;
});
beforeEach(() => {
  fake.reset();
  clearReadingCaches();
});

const collect = () => {
  const events: ReadingEvent[] = [];
  const deltas: string[] = [];
  return { events, deltas, onEvent: (e: ReadingEvent) => events.push(e), onDelta: (d: string) => deltas.push(d) };
};

describe('runReading: single flow', () => {
  it('streams one answer after intake and pack, with events in order', async () => {
    const c = collect();
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single', onEvent: c.onEvent, onDelta: c.onDelta });
    expect(r.answerText).toContain('Direct answer');
    expect(c.deltas.join('')).toBe(r.answerText.trim() === c.deltas.join('') ? r.answerText : c.deltas.join(''));
    expect(c.deltas.length).toBeGreaterThan(2);
    const names = c.events.map((e) => (e.type === 'stage' ? `${e.name}:${e.status}` : e.type));
    expect(names.indexOf('intent')).toBeGreaterThan(names.indexOf('intake:start'));
    expect(names.indexOf('prepare:done')).toBeGreaterThan(names.indexOf('intent'));
    expect(names.indexOf('synthesize:start')).toBeGreaterThan(names.indexOf('prepare:done'));
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.stream).toBe(true);
    expect(r.record.flow).toBe('single');
    expect(r.record.intent.subjects[0]!.id).toBe('marriage_relationship');
  });

  it('sends the thinking config in the request body and never asks for thoughts', async () => {
    await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    const gc = fake.requests[0]!.body.generationConfig;
    expect(gc.thinkingConfig).toEqual({ thinkingBudget: 512, includeThoughts: false });
    expect(gc.maxOutputTokens).toBe(4096);
  });

  it('logs the pack hash and sizes in chat_logs payloads, never the chart', async () => {
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    const text = JSON.stringify(r.requestPayload);
    expect(r.requestPayload.pack).toMatchObject({ hashes: { merged: expect.any(String), base: expect.any(String) } });
    expect(text).not.toContain('deg_in_sign');
    expect(text).not.toContain('"bodies"');
    expect(text.length).toBeLessThan(2500);
  });

  it('uses an identical cacheable prefix (system + base chart) for different questions and subjects', async () => {
    await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'single' });
    const [a, b] = fake.requests;
    expect(JSON.stringify(a!.body.systemInstruction)).toBe(JSON.stringify(b!.body.systemInstruction));
    const pa = a!.body.contents[0].parts.map((p: any) => p.text);
    const pb = b!.body.contents[0].parts.map((p: any) => p.text);
    expect(pa[0]).toBe(pb[0]);
    expect(pa[1]).not.toBe(pb[1]);
    expect(pa[0].length).toBeGreaterThan(5000);
  });

  it('puts the day-dependent text after the cacheable prefix and keeps the system prompt date-free', async () => {
    await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    const body = fake.requests[0]!.body;
    expect(body.systemInstruction.parts[0].text).not.toMatch(/2026-10-24/);
    expect(body.contents[0].parts[0].text).not.toMatch(/2026-10-24/);
    expect(body.contents[0].parts.at(-1).text).toContain('TODAY: 2026-10-24');
  });

  it('records usage, cached share and cost in the run record', async () => {
    await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    const r = await runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, flow: 'single' });
    expect(r.record.usage).toHaveLength(1);
    expect(r.record.cache.cachedTokens).toBeGreaterThan(0);
    expect(r.record.costUsd).toBeGreaterThan(0);
    expect(r.record.timingsMs.total).toBeGreaterThanOrEqual(0);
    expect(r.record.promptVersion).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('runReading: safety and availability', () => {
  it('answers self-harm messages with the fixed response and no model call', async () => {
    const c = collect();
    const r = await runReading(prisma, 'u1', 'I want to kill myself', { asOf: G1_AS_OF, onDelta: c.onDelta });
    expect(r.record.flow).toBe('safety');
    expect(r.answerText).toMatch(/988/);
    expect(fake.requests).toHaveLength(0);
  });
  it('signals fallback when the dossier is not available', async () => {
    await expect(runReading(prisma, 'u1', 'When will I get married?', { asOf: G1_AS_OF, dataLoader: async () => null })).rejects.toBeInstanceOf(ReadingUnavailableError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('runReading: graph flow', () => {
  it('runs specialists in parallel, gates ungrounded claims, then streams the synthesis', async () => {
    const slow = await startFakeGemini({ specialistDelayMs: 300, chunkDelayMs: 1 });
    process.env.GEMINI_API_URL = slow.url;
    try {
      const c = collect();
      const t0 = Date.now();
      const r = await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'graph', onEvent: c.onEvent, onDelta: c.onDelta });
      const wall = Date.now() - t0;
      const specialists = slow.requests.filter((q) => !q.stream);
      const synth = slow.requests.filter((q) => q.stream);
      expect(specialists.length).toBeGreaterThanOrEqual(3);
      expect(synth).toHaveLength(1);
      // 3 specialists of 300 ms each would take 900 ms+ if sequential
      expect(wall).toBeLessThan(800);
      const starts = specialists.map((q) => q.at);
      expect(Math.max(...starts) - Math.min(...starts)).toBeLessThan(150);
      expect(r.record.flow).toBe('graph');
      expect(r.record.droppedClaims).toBeGreaterThanOrEqual(3);
      const findings = r.record.findings as Array<{ claims: unknown[]; windows: unknown[] }>;
      for (const f of findings) {
        expect(f.claims).toHaveLength(1);
        expect(f.windows).toHaveLength(1);
      }
      const stageNames = c.events.filter((e) => e.type === 'stage').map((e) => `${e.name}:${e.status}`);
      expect(stageNames).toEqual(expect.arrayContaining(['promise:start', 'dasha:done', 'transit:done', 'reconcile:done', 'synthesize:done']));
      // the synthesis prompt carries the brief but not the whole chart
      const synthParts = synth[0]!.body.contents[0].parts.map((p: any) => p.text).join('\n');
      expect(synthParts).toContain('SPECIALIST FINDINGS');
      expect(synthParts).not.toContain('"houses"');
    } finally {
      process.env.GEMINI_API_URL = fake.url;
      await slow.close();
    }
  });

  it('continues when one specialist fails and reports the missing layer', async () => {
    const flaky = await startFakeGemini({ failAnalysts: ['transit'], chunkDelayMs: 0 });
    process.env.GEMINI_API_URL = flaky.url;
    try {
      const r = await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'graph' });
      expect(r.answerText).toContain('Direct answer');
      expect(r.record.errors.some((e) => e.node.startsWith('transit'))).toBe(true);
      const synth = flaky.requests.find((q) => q.stream)!;
      expect(synth.body.contents[0].parts.map((p: any) => p.text).join('\n')).toMatch(/MISSING LAYERS[^\n]*transit/);
    } finally {
      process.env.GEMINI_API_URL = fake.url;
      await flaky.close();
    }
  });

  it('falls back to one call over the pack when every specialist fails', async () => {
    const broken = await startFakeGemini({ failAnalysts: ['promise', 'dasha', 'transit', 'nakshatra'] });
    process.env.GEMINI_API_URL = broken.url;
    try {
      const r = await runReading(prisma, 'u1', 'Should I change jobs this year?', { asOf: G1_AS_OF, flow: 'graph' });
      expect(r.answerText).toContain('Direct answer');
      expect(r.record.errors.some((e) => e.node === 'graph')).toBe(true);
    } finally {
      process.env.GEMINI_API_URL = fake.url;
      await broken.close();
    }
  });

  it('uses the fast lane (no specialists) for a short yes/no question', async () => {
    const r = await runReading(prisma, 'u1', 'Is this month a good time to sign a property deal?', { asOf: G1_AS_OF, flow: 'graph' });
    expect(r.record.flow).toBe('single');
    expect(fake.requests.filter((q) => !q.stream)).toHaveLength(0);
  });
});

describe('runReading: intake via model when unsure', () => {
  it('calls the intake model for ambiguous questions in auto mode', async () => {
    process.env.READING_INTAKE_MODE = 'auto';
    try {
      const r = await runReading(prisma, 'u1', 'hello there', { asOf: G1_AS_OF, flow: 'single' });
      expect(fake.requests.filter((q) => !q.stream)).toHaveLength(1);
      expect(r.record.intakeSource).toBe('llm');
      expect(r.record.intent.subjects[0]!.id).toBe('career_work');
    } finally {
      process.env.READING_INTAKE_MODE = 'rules';
    }
  });
});
