/** Per-agent metrics (docs/reading-engine/41): what gets recorded, in what order, and that a failure never reaches the reading. */
import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentKindOf, currentTrace, failureLabel, resetTraceStoreForTests, RunTrace, traceModelCall, withRunTrace, type SpanRow, type TraceStore } from '../../../src/reading/metrics/trace.js';
import { runReading } from '../../../src/reading/run.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import { startFakeGemini, type FakeGemini } from '../../helpers/fakeGemini.js';

const usage = (over = {}) => ({ node: 'R01', model: 'gemini-3.1-flash-lite', promptTokens: 1000, cachedTokens: 400, outputTokens: 200, thoughtTokens: 0, ms: 5, ...over });

function memStore() {
  const log: string[] = [];
  const started: Record<string, unknown>[] = [];
  const spans: SpanRow[] = [];
  const finished: Record<string, unknown>[] = [];
  const store: TraceStore = {
    startRun: async (row) => {
      log.push('start');
      started.push(row as unknown as Record<string, unknown>);
    },
    addSpans: async (rows) => {
      log.push(`spans:${rows.length}`);
      spans.push(...rows);
    },
    finishRun: async (_id, data) => {
      log.push('finish');
      finished.push(data as Record<string, unknown>);
    },
  };
  return { store, log, started, spans, finished };
}

const prismaFrom = (m: ReturnType<typeof memStore>) =>
  ({
    readingTrace: { create: ({ data }: { data: never }) => m.store.startRun(data), updateMany: ({ where, data }: { where: { run_id: string }; data: never }) => m.store.finishRun(where.run_id, data) },
    readingAgentSpan: { createMany: ({ data }: { data: SpanRow[] }) => m.store.addSpans(data) },
  }) as unknown as PrismaClient;

const id = { runId: 'run-1', userId: 'u1', kind: 'reading' as const, flow: 'graph', question: 'q' };

beforeEach(() => resetTraceStoreForTests());
afterEach(() => vi.restoreAllMocks());

describe('agentKindOf', () => {
  it('names each kind of agent', () => {
    expect(['R01', 'P2', 'specialist:dasha', 'dasha', 'oracle', 'synthesize', 'validate', 'intake', 'clarify.phrase', 'prepare'].map(agentKindOf)).toEqual(['reader', 'reader', 'specialist', 'specialist', 'oracle', 'oracle', 'validator', 'intake', 'clarify', 'step']);
  });
});

describe('failureLabel', () => {
  it('uses the status or type, never the message', () => {
    expect(failureLabel(Object.assign(new Error('prompt text here'), { status: 429 }))).toBe('http_429');
    expect(failureLabel(new Error('R01 timed out'))).toBe('timeout');
    expect(failureLabel(new TypeError('prompt text here'))).toBe('TypeError');
  });
});

describe('RunTrace', () => {
  it('writes the trace first, so a query in flight is visible before any agent ends', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    await new Promise((r) => setTimeout(r, 5));
    expect(m.log).toEqual(['start']);
    expect(m.started[0]).toMatchObject({ run_id: 'run-1', status: 'processing', kind: 'reading', question: 'q' });
    await t.finish({ status: 'done' });
    expect(m.log).toEqual(['start', 'finish']);
  });

  it('batches a burst of agents into one write', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    for (let i = 1; i <= 17; i++) t.addModelCall({ agent: `R${i}`, model: 'gemini-3.1-flash-lite', startedAt: Date.now(), status: 'ok', usage: usage({ node: `R${i}` }) });
    await t.finish({ status: 'done' });
    expect(m.log).toEqual(['start', 'spans:17', 'finish']);
  });

  it('adds up tokens and cost, and counts spawned and failed agents', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    t.observe({ type: 'stage', name: 'R01', status: 'start' });
    t.observe({ type: 'stage', name: 'R01', status: 'done', ms: 1 });
    t.observe({ type: 'stage', name: 'R02', status: 'start' });
    t.observe({ type: 'stage', name: 'R02', status: 'failed', reason: 'timeout' });
    t.addModelCall({ agent: 'R01', model: 'gemini-3.1-flash-lite', startedAt: Date.now(), status: 'ok', usage: usage(), ttftMs: 7, steps: { wait_ms: 6, read_ms: 1 } });
    t.addModelCall({ agent: 'R02', model: 'gemini-3.1-flash-lite', startedAt: Date.now(), status: 'failed', failureReason: 'timeout' });
    await t.finish({ status: 'done', flow: 'oracle', ttftMs: 900 });
    expect(m.finished[0]).toMatchObject({ status: 'done', flow: 'oracle', ttft_ms: 900, agents_spawned: 2, agents_failed: 1, model_calls: 2, prompt_tokens: 1000, cached_tokens: 400, output_tokens: 200, unpriced_calls: 0 });
    expect(m.finished[0]!.est_cost_usd as number).toBeGreaterThan(0);
    const call = m.spans.find((s) => s.level === 'model_call' && s.agent === 'R01')!;
    expect(call).toMatchObject({ agent_kind: 'reader', status: 'ok', ttft_ms: 7, steps: { wait_ms: 6, read_ms: 1 }, prompt_tokens: 1000 });
    expect(call.est_cost_usd as number).toBeGreaterThan(0);
    expect(m.spans.find((s) => s.level === 'stage' && s.agent === 'R02')).toMatchObject({ status: 'failed', failure_reason: 'timeout' });
  });

  it('does not call a model with no price free', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    t.addModelCall({ agent: 'x', model: 'no-such-model', startedAt: Date.now(), status: 'ok', usage: usage({ model: 'no-such-model' }) });
    await t.finish({ status: 'done' });
    expect(m.spans[0]!.est_cost_usd).toBeNull();
    expect(m.finished[0]).toMatchObject({ unpriced_calls: 1 });
  });

  it('a retried agent stays open until it ends, a cached one says so, and an agent still open at the end is unfinished', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    t.observe({ type: 'stage', name: 'R01', status: 'start' });
    t.observe({ type: 'stage', name: 'R01', status: 'retrying' });
    t.observe({ type: 'stage', name: 'R01', status: 'done' });
    t.observe({ type: 'stage', name: 'R02', status: 'start' });
    t.observe({ type: 'stage', name: 'R02', status: 'done', cached: true });
    t.observe({ type: 'stage', name: 'R03', status: 'start' });
    await t.finish({ status: 'failed' });
    expect(Object.fromEntries(m.spans.map((s) => [s.agent, s.status]))).toEqual({ R01: 'ok', R02: 'cached', R03: 'unfinished' });
    expect(m.finished[0]).toMatchObject({ agents_spawned: 3, agents_failed: 1 });
  });

  it('keeps the same agent on two subjects apart', async () => {
    const m = memStore();
    const t = new RunTrace(id, m.store);
    t.observe({ type: 'stage', name: 'R01', status: 'start', subject: 'career' });
    t.observe({ type: 'stage', name: 'R01', status: 'start', subject: 'marriage' });
    t.observe({ type: 'stage', name: 'R01', status: 'done', subject: 'career' });
    await t.finish({ status: 'done' });
    expect(m.spans.map((s) => s.status).sort()).toEqual(['ok', 'unfinished']);
  });

  it('survives every kind of store failure, and stops trying when the table is not there', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const startRun = vi.fn(async () => {
      throw Object.assign(new Error('relation does not exist'), { code: 'P2021' });
    });
    const addSpans = vi.fn(async () => undefined);
    const t = new RunTrace(id, { startRun, addSpans, finishRun: async () => undefined });
    t.addModelCall({ agent: 'R01', model: 'gemini-3.1-flash-lite', startedAt: Date.now(), status: 'ok', usage: usage() });
    await expect(t.finish({ status: 'done' })).resolves.toBeUndefined();
    expect(startRun).toHaveBeenCalledTimes(1);
    expect(addSpans).not.toHaveBeenCalled();
  });

  it('never holds the query for a slow database', async () => {
    const t = new RunTrace(id, { startRun: () => new Promise(() => undefined), addSpans: async () => undefined, finishRun: async () => undefined });
    const t0 = Date.now();
    await t.finish({ status: 'done' });
    expect(Date.now() - t0).toBeLessThan(2_500);
  }, 5_000);
});

describe('traceModelCall', () => {
  it('runs the call as usual with no trace', async () => {
    await expect(traceModelCall('R01', 'm', async () => ({ usage: usage(), value: 1 }))).resolves.toMatchObject({ value: 1 });
    expect(currentTrace()).toBeUndefined();
  });

  it('records a failed call with its type only, and rethrows it', async () => {
    const m = memStore();
    await expect(
      withRunTrace(prismaFrom(m), id, () =>
        traceModelCall('R01', 'gemini-3.1-flash-lite', async () => {
          throw Object.assign(new Error('secret prompt'), { status: 503 });
        })
      )
    ).rejects.toThrow('secret prompt');
    expect(m.spans[0]).toMatchObject({ agent: 'R01', status: 'failed', failure_reason: 'http_503' });
    expect(m.finished[0]).toMatchObject({ status: 'failed', error: 'http_503' });
    expect(JSON.stringify([m.spans, m.finished])).not.toContain('secret prompt');
  });

  it('keeps each trace to its own calls when queries overlap', async () => {
    const a = memStore();
    const b = memStore();
    const call = (agent: string) => traceModelCall(agent, 'gemini-3.1-flash-lite', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { usage: usage({ node: agent }) };
    });
    await Promise.all([withRunTrace(prismaFrom(a), { ...id, runId: 'a' }, () => call('R01')), withRunTrace(prismaFrom(b), { ...id, runId: 'b' }, () => call('R02'))]);
    expect(a.spans.map((s) => s.agent)).toEqual(['R01']);
    expect(b.spans.map((s) => s.agent)).toEqual(['R02']);
  });
});

describe('runReading records its agents', () => {
  let fake: FakeGemini;
  const env0 = { ...process.env };

  beforeEach(async () => {
    clearReadingCaches();
    fake = await startFakeGemini({});
    Object.assign(process.env, { CHAT_LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', GEMINI_API_URL: fake.url, READING_INTAKE_MODE: 'rules', READING_FACTS_SOURCE: 'fixture' });
  });
  afterEach(async () => {
    await fake.close();
    for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
    Object.assign(process.env, env0);
  });

  const bare = (m: ReturnType<typeof memStore>) => Object.assign(prismaFrom(m), { kundli: { findFirst: vi.fn().mockResolvedValue(null) } }) as unknown as PrismaClient;

  it('single flow: run id, stages and the model call', async () => {
    process.env.READING_FLOW = 'single';
    const m = memStore();
    const r = await runReading(bare(m), 'u1', 'When will I get married?');
    expect(m.started[0]).toMatchObject({ run_id: r.record.runId, kind: 'reading', status: 'processing', question: 'When will I get married?' });
    expect(m.finished[0]).toMatchObject({ status: 'done', flow: 'single' });
    expect((m.finished[0]!.model_calls as number)).toBeGreaterThan(0);
    expect(m.spans.some((s) => s.level === 'stage' && s.agent === 'intake')).toBe(true);
    const call = m.spans.find((s) => s.level === 'model_call');
    expect(call?.steps).toHaveProperty('wait_ms');
    expect(call?.prompt_tokens).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('graph flow: the fan-out runs through LangGraph and every specialist still lands on the trace', async () => {
    process.env.READING_FLOW = 'graph';
    const m = memStore();
    await runReading(bare(m), 'u1', 'When will I get married?');
    const specialists = m.spans.filter((s) => s.level === 'model_call' && s.agent_kind === 'specialist');
    expect(specialists.length).toBeGreaterThan(1);
    expect(m.finished[0]!.agents_spawned as number).toBeGreaterThan(1);
  }, 30_000);

  it('a database with no metrics tables does not change the answer', async () => {
    process.env.READING_FLOW = 'single';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await runReading({ kundli: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient, 'u1', 'When will I get married?');
    expect(r.answerText.length).toBeGreaterThan(0);
  }, 30_000);

  it('READING_METRICS=0 writes nothing', async () => {
    process.env.READING_FLOW = 'single';
    process.env.READING_METRICS = '0';
    const m = memStore();
    await runReading(bare(m), 'u1', 'When will I get married?');
    expect(m.log).toEqual([]);
  }, 30_000);
});
