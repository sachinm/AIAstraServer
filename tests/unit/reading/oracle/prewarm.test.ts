import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRules, classifierThreshold } from '../../../../src/reading/buckets/classifier.js';
import { intentFromState } from '../../../../src/reading/clarify/service.js';
import { startClarify, type ClarifyState } from '../../../../src/reading/clarify/machine.js';
import { clearReadingCaches } from '../../../../src/reading/data/store.js';
import { clearChartBundles, type ChartRowSource } from '../../../../src/reading/oracle/chartBundle.js';
import { CostGuard } from '../../../../src/reading/oracle/costGuard.js';
import { clearStartedCaches } from '../../../../src/reading/oracle/prepare.js';
import { clearReaderMemo, loadPrewarmed, savePrewarmed } from '../../../../src/reading/oracle/prewarm.js';
import { prewarmOracleReaders } from '../../../../src/reading/oracle/prewarmReaders.js';
import { READERS } from '../../../../src/reading/oracle/readers.js';
import { buildReaderRequest, readerFindingZ, ReaderFailure, runReader, type ReaderResult } from '../../../../src/reading/oracle/runReader.js';
import { registerClarifyRoutes } from '../../../../src/routes/clarifyRoutes.js';
import { G1_AS_OF } from '../../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini } from '../../../helpers/fakeGemini.js';

const rows: ChartRowSource = { read: async () => [] };
const USAGE = { node: 'x', model: 'gemini-3.1-flash-lite', promptTokens: 1000, cachedTokens: 0, outputTokens: 100, thoughtTokens: 0, ms: 1 };
const impl = vi.fn(async (req: { id: string; subject: string }) => ({ id: req.id, subject: req.subject, finding: readerFindingZ.parse({ verdict: 'moderate', layerScore: 1, digest: 'd', claims: [] }), usage: USAGE, repaired: false })) as unknown as typeof runReader;

/** A stand-in for the reading_runs clarify row: only the columns prewarm touches. */
function db(): PrismaClient & { row: { findings: unknown } } {
  const row = { findings: null as unknown };
  return {
    row,
    readingRun: {
      findFirst: async () => ({ findings: row.findings }),
      updateMany: async ({ data }: { data: { findings: unknown } }) => {
        row.findings = data.findings;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient & { row: { findings: unknown } };
}

const state = (question: string, over: Partial<ClarifyState> = {}): ClarifyState => {
  const s = startClarify(question, G1_AS_OF, classifyRules(question, G1_AS_OF), { mode: 'always', threshold: classifierThreshold(), card: null, needsChildAge: false, location: null, needsLocation: false, birthPlace: null });
  return { ...s, ...over };
};

let fake: FakeGemini;
const CAREER = 'Should I change my job next year?';

beforeAll(async () => {
  fake = await startFakeGemini({
    respond: (parts) => {
      const tail = parts[2] ?? '';
      if (tail.includes('CUT_OFF')) return { text: '{"verdict":"strong","layerScore":2,"digest":"d","claims":[{"text":"Saturn holds.","evidence":["a.b"],"polarity":"supports","weight":2,"tradition":"parashara","about":"self","topic":"Saturn","kind":"holds"},{"text":"cut', finishReason: 'MAX_TOKENS' };
      if (tail.includes('NOT_JSON')) return { text: 'plain words only, no json at all' };
      return null;
    },
  });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.READING_MODEL_READER = 'gemini-3.1-flash-lite';
  process.env.READING_FLOW = 'oracle';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_EXPLICIT_CACHE;
});
afterAll(async () => {
  await fake.close();
  for (const k of ['READING_MODEL_READER', 'READING_FLOW', 'READING_FACTS_SOURCE', 'READING_INTAKE_MODE']) delete process.env[k];
});
beforeEach(() => {
  fake.reset();
  clearChartBundles();
  clearReaderMemo();
  clearReadingCaches();
  clearStartedCaches();
  vi.mocked(impl).mockClear();
});

describe('prewarm during clarify', () => {
  it('runs the readers and saves them on the clarify row, with their spend', async () => {
    const p = db();
    const r = await prewarmOracleReaders(p, 'u1', state(CAREER), 'run1', { readerImpl: impl, rows });
    expect(r.ran.length).toBeGreaterThan(0);
    const back = await loadPrewarmed(p, 'u1', 'run1');
    expect(back?.entries.size).toBe(r.ran.length);
  });

  it('never runs anything for a question about a child whose age is not confirmed', async () => {
    const p = db();
    const pending = { criterion: 'child_age', question: 'Is your child 18 or older?', chips: [], allowFreeText: false } as unknown as ClarifyState['pending'];
    const r = await prewarmOracleReaders(p, 'u1', state('How is my son doing?', { pending }), 'run1', { readerImpl: impl, rows });
    expect(r.ran).toEqual([]);
    expect(impl).not.toHaveBeenCalled();
  });

  it('does nothing outside the oracle flow, for an unknown area, or for an explainer', async () => {
    const p = db();
    process.env.READING_FLOW = 'graph';
    expect((await prewarmOracleReaders(p, 'u1', state(CAREER), 'run1', { readerImpl: impl, rows })).ran).toEqual([]);
    process.env.READING_FLOW = 'oracle';
    expect((await prewarmOracleReaders(p, 'u1', state(CAREER, { bucket: 'unknown' }), 'run1', { readerImpl: impl, rows })).ran).toEqual([]);
    expect(impl).not.toHaveBeenCalled();
  });

  it('a second prewarm adds entries and keeps the first one\'s spend', async () => {
    const p = db();
    const held = { finding: readerFindingZ.parse({ verdict: 'weak', layerScore: 0, digest: 'd', claims: [] }), usage: USAGE };
    await savePrewarmed(p, 'u1', 'run1', { entries: [{ key: 'a', held }], spentUsd: 0.01 });
    await savePrewarmed(p, 'u1', 'run1', { entries: [{ key: 'b', held }], spentUsd: 0.02 });
    const back = await loadPrewarmed(p, 'u1', 'run1');
    expect([...back!.entries.keys()]).toEqual(['a', 'b']);
    expect(back!.spentUsd).toBeCloseTo(0.03);
  });

  it('a failed read means no prewarm, not an error', async () => {
    const p = { readingRun: { findFirst: async () => { throw new Error('db down'); } } } as unknown as PrismaClient;
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(loadPrewarmed(p, 'u1', 'run1')).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('never fails the clarify request, whatever a reader does', async () => {
    const failing = vi.fn(async () => { throw new ReaderFailure('nope', 'parse', null); }) as unknown as typeof runReader;
    const r = await prewarmOracleReaders(db(), 'u1', state(CAREER), 'run1', { readerImpl: failing, rows });
    expect(r.ran).toEqual([]);
    expect(r.skipped.length).toBeGreaterThan(0);
  });
});

describe('POST /api/chat/prewarm', () => {
  type Handler = (req: unknown, res: unknown) => Promise<unknown>;
  function route(store: object, userId: string | null = 'u1'): Handler {
    const handlers = new Map<string, Handler>();
    const app = { post: (p: string, h: Handler) => handlers.set(p, h) };
    registerClarifyRoutes(app as never, { prisma: db(), getUserId: () => userId, store: store as never });
    return handlers.get('/api/chat/prewarm')!;
  }
  const res = () => {
    const r = { code: 200, body: null as unknown, status: (c: number) => ((r.code = c), r), json: (b: unknown) => ((r.body = b), r) };
    return r;
  };

  it('answers 401, 400 and 404 for the errors a client can cause', async () => {
    const store = { get: async () => null };
    const a = res();
    await route(store, null)({ body: { runId: 'x' } }, a);
    expect(a.code).toBe(401);
    const b = res();
    await route(store)({ body: {} }, b);
    expect(b.code).toBe(400);
    const c = res();
    await route(store)({ body: { runId: 'x' } }, c);
    expect(c.code).toBe(404);
  });

  it('is a no-op outside the oracle flow', async () => {
    process.env.READING_FLOW = 'graph';
    const r = res();
    await route({ get: async () => state(CAREER) })({ body: { runId: 'x' } }, r);
    process.env.READING_FLOW = 'oracle';
    expect(r.body).toEqual({ ran: [], cached: [], skipped: [] });
  });
});

describe('the clarifier\'s context', () => {
  it('becomes part of the intent, with the run that holds prewarmed findings', async () => {
    const s = state(CAREER, { turns: [{ ask: { criterion: 'horizon', question: 'When?', chips: [], allowFreeText: true } as never, answer: { value: 'next year', viaChip: true, resolved: true }, at: 1 }], assumed: { sub_bucket: 'Changing jobs' }, exactQuery: 'Career over the next year' });
    const i = await intentFromState(s, 'run9');
    expect(i.clarified).toMatchObject({ runId: 'run9', exactQuery: 'Career over the next year', turns: [{ criterion: 'horizon', question: 'When?', answer: 'next year' }], assumed: { sub_bucket: 'Changing jobs' } });
    expect(i.clarified?.realWant?.id).toBe('should_i_move');
  });
});

describe('one reader call', () => {
  const request = (focus?: string) =>
    buildReaderRequest({ id: 'R08', subject: 'career_work', slice: { tables: {}, houses: [10], vargas: [], from: '2026-11-01', to: '2027-11-01' }, intent: { questionType: 'describe', horizon: '1y', subjects: [], format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: '', followUps: [], safety: 'ok' }, question: 'q', asOf: G1_AS_OF, model: 'gemini-3.1-flash-lite', ...(focus ? { focus } : {}) });
  const guard = () => new CostGuard({ on: G1_AS_OF });

  it('sends the guard\'s output limit, and a thinking setting, in the request', async () => {
    const g = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.0012, oracle: 0.25, query: 0.3 } });
    await expect(runReader(request(), { model: 'gemini-3.1-flash-lite', guard: g })).resolves.toBeDefined();
    const sent = fake.requests[0]!.body.generationConfig;
    expect(sent.maxOutputTokens).toBeLessThan(READERS.R08.maxOutputTokens);
    expect(sent.thinkingConfig).toBeDefined();
  });

  it('is refused before any network call when money is out', async () => {
    const g = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.00001, oracle: 0.25, query: 0.3 } });
    await expect(runReader(request(), { model: 'gemini-3.1-flash-lite', guard: g })).rejects.toMatchObject({ reason: 'budget' });
    expect(fake.requests).toHaveLength(0);
  });

  it('keeps the whole claims of a cut-off answer, with a caveat', async () => {
    const r: ReaderResult = await runReader(request('CUT_OFF'), { model: 'gemini-3.1-flash-lite', guard: guard() });
    expect(r.repaired).toBe(true);
    expect(r.finding.claims.map((c) => c.topic)).toEqual(['Saturn']);
    expect(r.finding.caveats.join(' ')).toMatch(/cut short/);
  });

  it('reports unparsable text as parse, and still bills it', async () => {
    const g = guard();
    await expect(runReader(request('NOT_JSON'), { model: 'gemini-3.1-flash-lite', guard: g })).rejects.toMatchObject({ reason: 'parse' });
    expect(g.spent('fanout')).toBeGreaterThan(0);
  });
});
