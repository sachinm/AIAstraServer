/**
 * Specialist failures (docs/reading-engine/30): budgets derived from thinking, cut-off JSON repair, failure reasons on
 * `stage` events (reason, retried, capped, a `retrying` event before the retry) and the structured failure log.
 * Reproduces the staging symptom "promise, dasha, transit all failed after their retry" with a slow fake model.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReadingGraph } from '../../../src/reading/graph.js';
import { buildEvidencePack } from '../../../src/reading/packs/selector.js';
import { runIntake } from '../../../src/reading/nodes/intake.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import {
  failureReason,
  parseFindingText,
  repairTruncatedJson,
  runSpecialist,
  specialistBudget,
  SpecialistOutputError,
  SpecialistTimeoutError,
  TRUNCATED_CAVEAT,
  type Finding,
  type SpecialistAnalyst,
} from '../../../src/reading/nodes/specialists.js';
import { callGemini, GeminiHttpError, isCacheRejection, safeErrorText } from '../../../src/reading/llm/gemini.js';
import { clearPromptCache, setCacheRegistry, settlePromptCache } from '../../../src/reading/llm/promptCache.js';
import type { ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini, type FakeGeminiOptions } from '../../helpers/fakeGemini.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const env0 = { ...process.env };

afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
  Object.assign(process.env, env0);
  vi.restoreAllMocks();
  findingsCache.clear();
  clearPromptCache();
});

async function setup(question: string) {
  const intent = (await runIntake(question, G1_AS_OF, { mode: 'rules' })).intent;
  const packs = Object.fromEntries(intent.subjects.map((s) => [s.id, buildEvidencePack({ dossier, transits, subject: s.id, asOf: G1_AS_OF, intent })]));
  return { intent, packs };
}

const okFinding = (analyst: SpecialistAnalyst, subject: string) => ({
  finding: { analyst, subject: subject as Finding['subject'], verdict: 'moderate' as const, layerScore: 1, status: 'ok' as const, claims: [], windows: [], caveats: [], keyFacts: [] },
  usage: { node: analyst, model: 'fake', promptTokens: 10, cachedTokens: 0, outputTokens: 5, thoughtTokens: 0, ms: 1 },
});

async function runGraph(question: string, impl?: (a: { analyst: SpecialistAnalyst; subject: string; signal?: AbortSignal }) => Promise<unknown>, packsOverride?: (p: Record<string, unknown>) => Record<string, unknown>) {
  const { intent, packs } = await setup(question);
  const events: ReadingEvent[] = [];
  const g = buildReadingGraph({
    intent, question, asOf: G1_AS_OF, system: 'sys', packs: (packsOverride ? packsOverride(packs) : packs) as never, keyFacts: 'k', emit: (e) => events.push(e), runId: 'run-1',
    synthesize: async (brief: string) => ({ text: brief, usage: okFinding('promise', 'x').usage, ttftMs: 1, finishReason: 'STOP', stoppedForLoop: false }),
    ...(impl ? { specialistImpl: impl as never } : {}), dossier, transits,
  });
  const out = await g.invoke({});
  const stage = (name: string, status?: string) => events.filter((e) => e.type === 'stage' && e.name === name && (!status || e.status === status)) as Array<Record<string, unknown>>;
  return { out, events, stage };
}

describe('specialist budget follows the model', () => {
  it('a 2.x model with thinking off gets the plain budget', () => {
    expect(specialistBudget('gemini-2.5-flash')).toEqual({ thinks: false, timeoutMs: 18_000, maxOutputTokens: 4096 });
  });
  it('a 3.x model (off is sent as thinkingLevel low) gets thinking time and tokens on top', () => {
    expect(specialistBudget('gemini-3.8-flash')).toEqual({ thinks: true, timeoutMs: 30_000, maxOutputTokens: 8192 });
  });
  it('an explicit READING_SPECIALIST_TIMEOUT_MS is the base; the thinking headroom is added and can be tuned or turned off', () => {
    process.env.READING_SPECIALIST_TIMEOUT_MS = '12000';
    expect(specialistBudget('gemini-3.1-flash-lite').timeoutMs).toBe(24_000);
    process.env.READING_SPECIALIST_THINKING_MS = '0';
    process.env.READING_SPECIALIST_THINKING_TOKENS = '0';
    expect(specialistBudget('gemini-3.1-flash-lite')).toEqual({ thinks: true, timeoutMs: 12_000, maxOutputTokens: 4096 });
  });
});

describe('cut-off JSON repair', () => {
  const full = { verdict: 'strong', layerScore: 2, claims: [{ text: 'Jupiter aspects the 7th house.', evidence: ['base.houses.7'], polarity: 'supports', weight: 3, tradition: 'parashara' }, { text: 'Saturn delays the result.', evidence: [], polarity: 'obstructs', weight: 2, tradition: 'parashara' }], windows: [], caveats: [], keyFacts: [] };
  const json = JSON.stringify(full);

  it('keeps every complete claim of an answer cut off mid-claim', () => {
    const cut = json.slice(0, json.indexOf('Saturn delays') + 6);
    expect(() => JSON.parse(cut)).toThrow();
    const v = repairTruncatedJson(cut) as typeof full;
    expect(v.verdict).toBe('strong');
    expect(v.claims).toHaveLength(1);
    expect(v.claims[0]!.text).toBe('Jupiter aspects the 7th house.');
  });
  it('handles escaped quotes and brackets inside strings', () => {
    const v = repairTruncatedJson('{"verdict":"weak","claims":[{"text":"a \\"quoted\\" [x] {y}, here"},{"text":"cut') as { claims: unknown[] };
    expect(v.claims).toEqual([{ text: 'a "quoted" [x] {y}, here' }]);
  });
  it('accepts a ```json fence and prose around the object; rejects text with no JSON', () => {
    expect(parseFindingText('```json\n' + json + '\n```')).toEqual({ value: full, repaired: false });
    expect(parseFindingText('Here it is: ' + json + ' Done.')).toEqual({ value: full, repaired: false });
    expect(parseFindingText('I cannot answer that.')).toBeNull();
  });
});

describe('runSpecialist against the fake model', () => {
  let fake: FakeGemini | undefined;
  const start = async (opts: FakeGeminiOptions) => {
    fake = await startFakeGemini(opts);
    Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', READING_MODEL_SPECIALIST: 'gemini-2.5-flash' });
  };
  afterEach(async () => {
    await fake?.close();
    fake = undefined;
  });
  const args = async () => {
    const { intent, packs } = await setup('When will I get married?');
    const subject = intent.subjects[0]!.id;
    return { analyst: 'promise' as const, subject, pack: packs[subject]!, intent, question: 'When will I get married?', system: 'sys', asOf: G1_AS_OF };
  };
  const claim = (t: string) => ({ text: t, evidence: ['base.houses.7'], polarity: 'supports', weight: 2, tradition: 'parashara' });

  it('a MAX_TOKENS answer cut mid-JSON keeps its complete claims and says it was cut short', async () => {
    const text = JSON.stringify({ verdict: 'moderate', layerScore: 1, claims: [claim('Venus rules the 7th house.'), claim('Jupiter aspects the 7th lord.')], windows: [], caveats: [], keyFacts: [] });
    await start({ specialistRaw: () => ({ text: text.slice(0, text.indexOf('Jupiter aspects') + 4), finishReason: 'MAX_TOKENS' }) });
    const r = await runSpecialist(await args());
    expect(r.repaired).toBe(true);
    expect(r.finding.claims.map((c) => c.text)).toEqual(['Venus rules the 7th house.']);
    expect(r.finding.caveats).toContain(TRUNCATED_CAVEAT);
  });
  it('a cut-off answer with no complete claim is a parse failure', async () => {
    await start({ specialistRaw: () => ({ text: '{"verdict":"moderate","claims":[{"text":"Venus ru', finishReason: 'MAX_TOKENS' }) });
    const err = await runSpecialist(await args()).catch((e) => e);
    expect(err).toBeInstanceOf(SpecialistOutputError);
    expect(failureReason(err)).toBe('parse');
    expect(err.finishReason).toBe('MAX_TOKENS');
    expect(err.message).not.toMatch(/Venus/); // model text never goes into the error
  });
  it('JSON of the wrong shape is a schema failure; an empty blocked answer is a model error', async () => {
    await start({ specialistRaw: () => ({ text: '[1,2,3]' }) });
    expect(failureReason(await runSpecialist(await args()).catch((e) => e))).toBe('schema');
    await fake!.close();
    await start({ specialistRaw: () => ({ text: '', finishReason: 'SAFETY' }) });
    const err = await runSpecialist(await args()).catch((e) => e);
    expect(failureReason(err)).toBe('model_error');
    expect(err.message).toMatch(/SAFETY/);
  });
  it('a 3.x specialist asks for the larger output budget', async () => {
    await start({});
    process.env.READING_MODEL_SPECIALIST = 'gemini-3.8-flash';
    await runSpecialist(await args());
    const body = fake!.requests.at(-1)!.body;
    expect(body.generationConfig.maxOutputTokens).toBe(8192);
    expect(body.generationConfig.thinkingConfig).toMatchObject({ thinkingLevel: 'low' });
  });
  it('an HTTP 429 is a model error carrying its status', async () => {
    await start({ failAnalysts: ['promise'], failStatus: 429 });
    const err = await runSpecialist(await args()).catch((e) => e);
    expect(err).toBeInstanceOf(GeminiHttpError);
    expect(err.status).toBe(429);
    expect(failureReason(err)).toBe('model_error');
  });
});

describe('stage events and logs for failed specialists', () => {
  it('reproduces the staging symptom: a slow model fails promise, dasha and transit after a retry, each with reason timeout', async () => {
    const fake = await startFakeGemini({ specialistDelayMs: 400 });
    try {
      Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', READING_MODEL_SPECIALIST: 'gemini-2.5-flash', READING_SPECIALIST_TIMEOUT_MS: '60' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { out, stage } = await runGraph('When will I get married?', (a) => runSpecialist(a as never));
      expect([...out.failed].sort()).toEqual(['dasha', 'promise', 'transit']);
      for (const name of ['promise', 'dasha', 'transit']) {
        expect(stage(name, 'retrying')).toEqual([expect.objectContaining({ reason: 'timeout', attempt: 2 })]);
        expect(stage(name, 'failed')).toEqual([expect.objectContaining({ reason: 'timeout', retried: true, capped: true })]);
      }
      // order: start, retrying, failed
      expect(stage('promise').map((e) => e.status)).toEqual(['start', 'retrying', 'failed']);
      const logs = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('reading specialist failed')).map((l) => JSON.parse(l));
      expect(logs).toHaveLength(6); // 3 analysts × 2 attempts
      expect(logs[0]).toMatchObject({ runId: 'run-1', reason: 'timeout', model: 'gemini-2.5-flash', timeoutMs: 60, maxOutputTokens: 4096 });
      expect(typeof logs[0].latencyMs).toBe('number');
      expect(logs.filter((l) => l.final && l.capped)).toHaveLength(3);
      const all = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(all).not.toMatch(/QUESTION|When will I get married|ANALYST:/); // no prompt content
      expect(out.errors.every((e) => e.reason === 'timeout')).toBe(true);
    } finally {
      await fake.close();
    }
  });

  it('the timed-out attempt is aborted, not left running', async () => {
    process.env.READING_SPECIALIST_TIMEOUT_MS = '30';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const aborted: string[] = [];
    await runGraph('When will I get married?', ({ analyst, subject, signal }) =>
      new Promise((resolve) => {
        if (analyst !== 'promise') return resolve(okFinding(analyst, subject));
        signal?.addEventListener('abort', () => aborted.push(String((signal.reason as Error).name)));
      })
    );
    expect(aborted).toEqual(['SpecialistTimeoutError', 'SpecialistTimeoutError']);
  });

  it('done after a retry says retried; an optional failure is skipped, not retried, not capped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let promiseCalls = 0;
    const { stage, out } = await runGraph('What do my nakshatras say about me?', async ({ analyst, subject }) => {
      if (analyst === 'promise' && promiseCalls++ === 0) throw new GeminiHttpError('Resource exhausted', 429);
      if (analyst === 'nakshatra') throw new SpecialistOutputError('specialist nakshatra returned unparsable JSON (MAX_TOKENS)', okFinding('nakshatra', subject).usage, { kind: 'parse', finishReason: 'MAX_TOKENS' });
      return okFinding(analyst, subject);
    });
    expect(stage('promise', 'retrying')).toEqual([expect.objectContaining({ reason: 'model_error' })]);
    expect(stage('promise', 'done')).toEqual([expect.objectContaining({ retried: true })]);
    expect(stage('nakshatra', 'skipped')).toEqual([expect.objectContaining({ reason: 'parse', retried: false, capped: false })]);
    expect(stage('nakshatra', 'retrying')).toEqual([]);
    expect(out.failed).toEqual([]);
  });

  it('a subject with no pack fails at once with reason no_data and no retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const impl = vi.fn(async ({ analyst, subject }: { analyst: SpecialistAnalyst; subject: string }) => okFinding(analyst, subject));
    const { stage, out } = await runGraph('When will I get married?', impl, () => ({}));
    expect(impl).not.toHaveBeenCalled();
    expect(stage('dasha', 'failed')).toEqual([expect.objectContaining({ reason: 'no_data', retried: false, capped: true })]);
    expect(stage('dasha', 'retrying')).toEqual([]);
    expect([...out.failed].sort()).toEqual(['dasha', 'promise', 'transit']);
  });

  it('timeout classification covers every layer that can raise one', () => {
    expect(failureReason(new SpecialistTimeoutError('promise exceeded 18000 ms'))).toBe('timeout');
    expect(failureReason(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))).toBe('timeout');
    expect(failureReason(new Error('Gemini call timed out after 18000ms'))).toBe('timeout');
    expect(failureReason(new Error('fetch failed'))).toBe('model_error');
    expect(safeErrorText(new Error('GET https://x/models/m:generateContent?key=AIzaSyA1234567890abcdefghijk failed'))).not.toMatch(/AIza/);
  });
});

describe('explicit prompt cache fallback', () => {
  let fake: FakeGemini;
  beforeAll(async () => {
    fake = await startFakeGemini({ specialistDelayMs: 150 });
  });
  afterAll(async () => fake.close());
  beforeEach(() => {
    Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', READING_EXPLICIT_CACHE: '1' });
    fake.reset();
    clearPromptCache();
    setCacheRegistry(null);
  });
  afterAll(() => setCacheRegistry(undefined));

  it('only a refused cache (400/403/404) is retried uncached', () => {
    expect(isCacheRejection(new GeminiHttpError('CachedContent not found', 404))).toBe(true);
    expect(isCacheRejection(new GeminiHttpError('quota', 429))).toBe(false);
    expect(isCacheRejection(new Error('Gemini call timed out after 10ms'))).toBe(false);
  });

  it('a time-out on a cached call is not retried uncached (it would start with no time left)', async () => {
    const call = (timeoutMs: number) => callGemini({ model: 'gemini-2.5-flash', node: 't', system: 'S', parts: ['BASE '.repeat(400), 'subject', 'ANALYST: promise'], cachePrefix: true, thinking: 'off', timeoutMs });
    await call(5000);
    await call(5000);
    await settlePromptCache();
    fake.reset();
    const err = await call(40).catch((e) => e);
    expect(failureReason(err)).toBe('timeout');
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.body.cachedContent).toBe('cachedContents/fake-1');
    // the cache was kept for the next caller
    await call(5000);
    expect(fake.requests.at(-1)!.body.cachedContent).toBe('cachedContents/fake-1');
  });
});
