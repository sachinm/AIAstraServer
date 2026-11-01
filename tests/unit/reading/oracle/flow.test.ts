import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearReadingCaches } from '../../../../src/reading/data/store.js';
import { clearChartBundles, type ChartRowSource } from '../../../../src/reading/oracle/chartBundle.js';
import { CostGuard } from '../../../../src/reading/oracle/costGuard.js';
import { runOracleFlow, type OracleFlowDeps } from '../../../../src/reading/oracle/flow.js';
import { clearStartedCaches } from '../../../../src/reading/oracle/prepare.js';
import { clearReaderMemo } from '../../../../src/reading/oracle/prewarm.js';
import { READERS, type ReaderId } from '../../../../src/reading/oracle/readers.js';
import { buildReaderRequest, ReaderFailure, type runReader } from '../../../../src/reading/oracle/runReader.js';
import { buildEvidencePack } from '../../../../src/reading/packs/selector.js';
import { runIntake } from '../../../../src/reading/nodes/intake.js';
import { persistAskTurn } from '../../../../src/services/askChatTurn.js';
import { runReading } from '../../../../src/reading/run.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import type { Intent, ReadingEvent } from '../../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../../helpers/readingFixtures.js';
import { startFakeGemini, type FakeGemini } from '../../../helpers/fakeGemini.js';

const TABLES: Record<string, unknown> = {
  'panchanga.birth': { date: '1990-01-01', nakshatra: 'Ashwini' },
  'varga.d1': [{ body: 'Sun', rasi: 'Leo', nakshatra: 'Magha' }, { body: 'Saturn', rasi: 'Libra', nakshatra: 'Swati' }],
  'varga.d9': [{ body: 'Saturn', rasi: 'Aries' }],
  'varga.d10': [{ body: 'Saturn', rasi: 'Virgo' }],
  'varga.d30': [{ body: 'Saturn', rasi: 'Pisces' }],
  dignities: { planets: [{ id: 6, name: 'Saturn', dignity: 'Exalted', house_from_lagna: 7, sign_index: 6 }] },
  benefic_malefic: { house_lords: [{ house: 10, lord: { id: 3, name: 'Mercury' }, sign: 'Virgo' }] },
  relations: { planets: [{ id: 6, name: 'Saturn' }] },
  ashtakavarga: { sav_by_house: [28, 30] },
  'strength.shadbala': { planets: [{ id: 6, name: 'Saturn', rank: 1, ratio: 1.5 }] },
  'karaka.chara': [{ planet: 'Saturn', karaka_code: 'AK', meaning: 'soul' }],
  arudhas: { bhava_arudhas: [{ label: 'A10', sign: 'Virgo', house: 10 }] },
  yogas: { present: 1, yogas: [{ id: 'amala', present: true, planets: [] }, { id: 'nope', present: false }] },
  doshas: { doshas: [{ id: 'manglik', present: false }] },
  'dasha.vimsottari': { system: 'v', periods: [{ lord: 'Saturn', start: '2019-01-01', end: '2038-01-01', children: [{ lord: 'Ketu', start: '2026-08-22', end: '2027-09-07' }] }, { lord: 'Mercury', start: '2038-01-01', end: '2055-01-01' }] },
  aspects: { rasi_drishti: [{ name: 'Saturn', aspected_houses: [10] }], graha_drishti: [{ name: 'Saturn', aspected_houses: [10] }], aspect_strength: { rows: [] } },
  'argala.d1': { houses: [{ house: 10, sign: 'Virgo', argalas: [] }, { house: 3, sign: 'x' }] },
  bhava: { houses: [{ house: 10, sign: 'Virgo' }] },
};

function rowsSource(): ChartRowSource & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    read: async (_k, types) => {
      calls.push(types);
      return types.filter((t) => TABLES[t] !== undefined).map((t) => ({ data_type: t, variant: '', payload: TABLES[t] }));
    },
  };
}

const goodReader = (id: string) => ({
  verdict: 'moderate',
  layerScore: 2,
  digest: `${id} read its tables.`,
  claims: [
    { text: `Saturn is exalted, says ${id}.`, evidence: ['dignities.planets.Saturn.dignity'], polarity: 'supports', weight: 2, tradition: 'parashara', about: 'self', topic: 'Saturn', kind: 'gives' },
    { text: `A claim from ${id} citing nothing real.`, evidence: ['bogus.path'], polarity: 'neutral', weight: 1, tradition: 'parashara', about: 'self', topic: 'Mars', kind: 'gives' },
  ],
  windows: [],
  quotes: [{ id: 'dignities.planets.Saturn.dignity', value: 'Exalted' }],
});

function readerOf(parts: string[]): string | null {
  for (const [id, def] of Object.entries(READERS)) if ((parts[2] ?? '').startsWith(PROMPTS[def.promptKey] ?? '\u0000')) return id;
  return null;
}

let fake: FakeGemini;
const validatorAnswer: { value: unknown } = { value: { answered: true, parts: [] } };
const ANSWER = 'Your strongest window opens in March 2027, and it holds through the year after.';

beforeAll(async () => {
  fake = await startFakeGemini({
    chunkDelayMs: 0,
    answer: ANSWER,
    respond: (parts, body) => {
      if (body?.generationConfig?.responseSchema?.properties?.parts) return { text: JSON.stringify(validatorAnswer.value) };
      const id = readerOf(parts);
      return id ? { text: JSON.stringify(goodReader(id)) } : null;
    },
  });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_FLASH_MODEL_ID = 'gemini-3.8-flash';
  process.env.READING_MODEL_READER = 'gemini-3.1-flash-lite';
  process.env.READING_MODEL_ORACLE = 'gemini-3.8-flash';
  process.env.READING_MODEL_VALIDATOR = 'gemini-3.1-flash-lite';
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_EXPLICIT_CACHE;
  delete process.env.READING_REMEDY_READER;
  delete process.env.READING_VALIDATOR;
});
afterAll(async () => {
  await fake.close();
  for (const k of ['READING_MODEL_READER', 'READING_MODEL_ORACLE', 'READING_MODEL_VALIDATOR', 'READING_FACTS_SOURCE', 'READING_INTAKE_MODE']) delete process.env[k];
});
beforeEach(() => {
  fake.reset();
  clearChartBundles();
  clearReaderMemo();
  clearReadingCaches();
  clearStartedCaches();
  validatorAnswer.value = { answered: true, parts: [] };
});

const dossier = loadG1Dossier();
const transits = loadG1Transits();

async function deps(question: string, over: Partial<OracleFlowDeps> = {}, intentOver: Partial<Intent> = {}): Promise<OracleFlowDeps & { events: ReadingEvent[]; deltas: string[] }> {
  const intent = { ...(await runIntake(question, G1_AS_OF, { mode: 'rules' })).intent, ...intentOver };
  const subject = intent.subjects[0]!.id;
  const pack = buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent });
  const events: ReadingEvent[] = [];
  const deltas: string[] = [];
  return {
    events,
    deltas,
    rows: rowsSource(),
    kundliId: 'k1',
    userId: 'u1',
    runId: 'run1',
    intent,
    question,
    asOf: G1_AS_OF,
    system: 'PERSONA',
    pack,
    tail: `QUESTION: ${question}`,
    thinking: 'low',
    includeThoughts: false,
    emit: (e) => events.push(e),
    onDelta: (d) => deltas.push(d),
    cacheOwner: { userId: 'u1', kundliId: 'k1' },
    ...over,
  };
}

const CAREER = 'Tell me about my career over the next year';
const intentTier3: Partial<Intent> = { questionType: 'describe', horizon: '1y', subjects: [{ id: 'career_work', weight: 1 }] };

const stages = (events: ReadingEvent[]) => events.filter((e) => e.type === 'stage').map((e) => `${e.name}:${e.status}`);
const oracleCall = () => fake.requests.filter((r) => r.stream)[0]!;
const oraclePrompt = () => (oracleCall().body.contents[0].parts as Array<{ text: string }>).map((p) => p.text).join('\n');

describe('oracle flow: the whole path', () => {
  it('fans out one call per reader, then one Oracle call, then the validator', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.tier).toBe(3);
    expect(out.readers).toEqual(['R01', 'R02', 'R03', 'R08', 'R10']);
    expect(fake.requests.filter((r) => !r.stream)).toHaveLength(6); // 5 readers + validator
    expect(fake.requests.filter((r) => r.stream)).toHaveLength(1);
    expect(d.deltas.join('')).toBe(ANSWER);
    const s = stages(d.events);
    expect(s.indexOf('oracle:start')).toBeGreaterThan(s.indexOf('R08:done'));
    expect(s.indexOf('validate:done')).toBeGreaterThan(s.indexOf('oracle:done'));
  });

  it('readers read only the tables they were planned, in one query', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    await runOracleFlow(d);
    expect((d.rows as ReturnType<typeof rowsSource>).calls).toHaveLength(1);
    expect((d.rows as ReturnType<typeof rowsSource>).calls[0]).not.toContain('dasha.chara');
  });

  it('every reader shares one prefix, so the cache can serve it', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    await runOracleFlow(d);
    const readers = fake.requests.filter((r) => !r.stream && readerOf(r.body.contents[0].parts.map((p: { text: string }) => p.text)));
    const firsts = new Set(readers.map((r) => r.body.contents[0].parts[0].text));
    expect(firsts.size).toBe(1);
    expect([...firsts][0]).toMatch(/^CHART CORE: /);
    expect(new Set(readers.map((r) => JSON.stringify(r.body.systemInstruction))).size).toBe(1);
  });

  it('natal readers are not sent the question; timing readers are', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    const sent = (id: string) => out.journal.all().find((e) => e.agent === id)!.promptSent!;
    expect(sent('R01')).not.toContain(CAREER);
    expect(sent('R08')).toContain(CAREER);
  });

  it('the Oracle reads the brief and never the tables, and a bad claim never reaches it', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    await runOracleFlow(d);
    const prompt = oraclePrompt();
    expect(prompt).toContain('BRIEF');
    expect(prompt).toContain('Saturn is exalted');
    expect(prompt).toContain('LENGTH: at most 280 words');
    expect(prompt).not.toContain('CHART CORE');
    expect(prompt).not.toContain('citing nothing real');
    expect(oracleCall().body.systemInstruction.parts[0].text).toContain('You are the Oracle');
  });

  it('the clarifier\'s context and the real want reach the Oracle', async () => {
    const clarified = { turns: [{ criterion: 'sub_bucket', question: 'Which part?', answer: 'Changing jobs' }], assumed: { horizon: 'the next 12 months' }, exactQuery: 'Career over the next year', realWant: { id: 'should_i_move', line: 'whether to move on', sensitive: 'being fired' } };
    const d = await deps(CAREER, {}, { ...intentTier3, clarified });
    await runOracleFlow(d);
    const prompt = oraclePrompt();
    expect(prompt).toContain('WHAT THEY REALLY WANT TO KNOW: whether to move on');
    expect(prompt).toContain('they said "Changing jobs"');
    expect(prompt).toContain('horizon: the next 12 months');
    expect(prompt).toContain('SENSITIVE (never print this)');
  });

  it('three layers make a finding, and fewer a pointer', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.brief!.statements[0]!.layers).toEqual(['d1']);
    expect(out.brief!.text).toContain('POINTERS (one or two layers)');
    expect(out.brief!.text).not.toContain('FINDINGS (three or more layers)');
  });
});

describe('oracle flow: the journal', () => {
  it('holds every response and writes nothing itself', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    const agents = out.journal.all().map((e) => e.agent);
    expect(agents.slice().sort()).toEqual(['R01', 'R02', 'R03', 'R08', 'R10', 'oracle', 'validator'].sort());
    const r08 = out.journal.all().find((e) => e.agent === 'R08')!;
    expect(r08.promptSent).toContain(PROMPTS['readers/R08-vimshottari']!.slice(0, 40));
    expect(r08.promptSent).not.toContain('CHART CORE');
    expect((r08.digest as { how: string }).how).toBe('R08 read its tables.');
    expect((r08.highlights as { claims: unknown[] }).claims).toHaveLength(2);
    expect(r08.dataKeys).toContain('dasha_vimsottari');
  });

  it('runReading returns the journal and the turn writes it after the run row', async () => {
    const r = await runReading({} as unknown as PrismaClient, 'u1', CAREER, { asOf: G1_AS_OF, flow: 'oracle', intent: { ...(await runIntake(CAREER, G1_AS_OF, { mode: 'rules' })).intent, ...intentTier3 }, chartRows: rowsSource() });
    expect(r.record.flow).toBe('oracle');
    expect(r.record.journal).toBeDefined();
    expect(r.record.costUsd).toBeGreaterThan(0);
    const order: string[] = [];
    const db = {
      chat: { findFirst: async () => null, updateMany: async () => ({}), create: async () => ({ id: 'c1' }), update: async () => ({}) },
      message: { count: async () => 1, create: async () => ({ id: 'm1' }) },
      chatLog: { create: async () => ({}) },
      readingRun: { create: async () => { order.push('run'); return {}; } },
      readingAgentResponse: { createMany: async ({ data }: { data: Array<{ message_id: string; agent: string }> }) => { order.push(`journal:${data.length}:${data[0]!.message_id}`); return {}; } },
    } as unknown as PrismaClient;
    await persistAskTurn(db, 'u1', null, CAREER, { answerText: r.answerText, requestPayload: r.requestPayload, responsePayload: r.responsePayload, reading: r.record } as never, true);
    expect(order[0]).toBe('run');
    expect(order[1]).toMatch(/^journal:\d+:m1$/);
  });

  it('a failed journal write never fails the turn', async () => {
    const r = await runReading({} as unknown as PrismaClient, 'u1', CAREER, { asOf: G1_AS_OF, flow: 'oracle', intent: { ...(await runIntake(CAREER, G1_AS_OF, { mode: 'rules' })).intent, ...intentTier3 }, chartRows: rowsSource() });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = {
      chat: { findFirst: async () => null, updateMany: async () => ({}), create: async () => ({ id: 'c1' }), update: async () => ({}) },
      message: { count: async () => 1, create: async () => ({ id: 'm1' }) },
      chatLog: { create: async () => ({}) },
      readingRun: { create: async () => ({}) },
      readingAgentResponse: { createMany: async () => { throw new Error('relation does not exist'); } },
    } as unknown as PrismaClient;
    await expect(persistAskTurn(db, 'u1', null, CAREER, { answerText: r.answerText, requestPayload: r.requestPayload, responsePayload: r.responsePayload, reading: r.record } as never, true)).resolves.toEqual({ chatId: 'c1', messageId: 'm1' });
    spy.mockRestore();
  });

  it('when the Oracle fails, the error carries the journal so it can still be written', async () => {
    process.env.READING_MODEL_ORACLE = 'no-such-model';
    const d = await deps(CAREER, {}, intentTier3);
    try {
      await runOracleFlow(d);
      expect.unreachable();
    } catch (err) {
      const j = (err as { journal: { all: () => Array<{ agent: string; status: string; failureReason: string }> } }).journal;
      expect(j.all().find((e) => e.agent === 'oracle')).toMatchObject({ status: 'failed', failureReason: 'budget' });
    } finally {
      process.env.READING_MODEL_ORACLE = 'gemini-3.8-flash';
    }
  });
});

describe('oracle flow: time', () => {
  const hanging = (slow: ReaderId[]): typeof runReader =>
    (async (req: { id: ReaderId; subject: never }, a: { guard: CostGuard; signal?: AbortSignal }) => {
      if (slow.includes(req.id)) return new Promise(() => undefined);
      return { id: req.id, subject: req.subject, finding: (await import('../../../../src/reading/oracle/runReader.js')).readerFindingZ.parse(goodReader(req.id)), usage: { node: req.id, model: 'x', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 }, repaired: false };
    }) as unknown as typeof runReader;

  it('a hung optional reader cannot hold the answer past the join', async () => {
    const d = await deps(CAREER, { readerImpl: hanging(['R03']), joinMs: 1_000 }, intentTier3);
    const t0 = Date.now();
    const out = await runOracleFlow(d);
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(out.answer).toBe(ANSWER);
    expect(d.events.find((e) => e.name === 'R03' && e.status === 'skipped')).toMatchObject({ reason: 'timeout' });
    expect(oraclePrompt()).toContain('LAYERS NOT READ');
    expect(out.journal.all().find((e) => e.agent === 'R03')).toMatchObject({ status: 'skipped', failureReason: 'timeout' });
  });

  it('a hung required reader fails without a retry and caps the verdict', async () => {
    const d = await deps(CAREER, { readerImpl: hanging(['R02']), joinMs: 1_000 }, intentTier3);
    const out = await runOracleFlow(d);
    expect(d.events.find((e) => e.name === 'R02' && e.status === 'failed')).toMatchObject({ reason: 'timeout', retried: false, capped: true });
    expect(d.events.some((e) => e.name === 'R02' && e.status === 'retrying')).toBe(false);
    expect(out.validation?.flags).toContain('layers_missing:R02');
  });

  it('a required reader that fails fast retries once', async () => {
    let calls = 0;
    const flaky = (async (req: { id: ReaderId; subject: never }) => {
      if (req.id === 'R08' && calls++ === 0) throw new ReaderFailure('bad json', 'parse', null);
      return { id: req.id, subject: req.subject, finding: (await import('../../../../src/reading/oracle/runReader.js')).readerFindingZ.parse(goodReader(req.id)), usage: { node: req.id, model: 'x', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 }, repaired: false };
    }) as unknown as typeof runReader;
    const d = await deps(CAREER, { readerImpl: flaky }, intentTier3);
    await runOracleFlow(d);
    expect(calls).toBe(2);
    expect(d.events.find((e) => e.name === 'R08' && e.status === 'done')).toMatchObject({ retried: true });
  });
});

describe('oracle flow: money', () => {
  it('a question stays under every cap, and the guard saw all of it', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    const c = out.guard.summary();
    expect(c.fanout).toBeLessThanOrEqual(0.05);
    expect(c.oracle).toBeLessThanOrEqual(0.25);
    expect(c.usd).toBeLessThanOrEqual(0.3);
    expect(c.lines.map((l) => l.node)).toEqual(expect.arrayContaining(['R01', 'oracle', 'validator']));
  });

  it('with no money for readers they are skipped and the Oracle still answers', async () => {
    const guard = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.0001, oracle: 0.25, query: 0.3 } });
    const d = await deps(CAREER, { guard }, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.answer).toBe(ANSWER);
    expect(d.events.find((e) => e.name === 'R08' && e.status === 'failed')).toMatchObject({ reason: 'budget' });
    expect(fake.requests.filter((r) => r.stream)).toHaveLength(1);
  });

  it('the output limit sent is the one the guard allowed', async () => {
    const guard = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.05, oracle: 0.02, query: 0.3 } });
    const d = await deps(CAREER, { guard }, intentTier3);
    await runOracleFlow(d);
    expect(oracleCall().body.generationConfig.maxOutputTokens).toBeLessThan(1_800 + 1);
    const outTokens = oracleCall().body.generationConfig.maxOutputTokens as number;
    expect((outTokens * 3.75) / 1e6).toBeLessThanOrEqual(0.02);
  });
});

describe('oracle flow: prewarm', () => {
  const held = (id: string) => ({ finding: { ...goodReader(id), gaps: [], actors: [], graces: [], pointers: [], disagree: '', sensitive: '', form: '', culprits: [], contributors: [], caveats: [] } as never, usage: { node: id, model: 'gemini-3.1-flash-lite', promptTokens: 1000, cachedTokens: 0, outputTokens: 100, thoughtTokens: 0, ms: 1 } });

  async function keysFor(d: OracleFlowDeps): Promise<Map<string, ReturnType<typeof held>>> {
    const { prepareReaders } = await import('../../../../src/reading/oracle/prepare.js');
    const p = await prepareReaders({ rows: d.rows, kundliId: d.kundliId, intent: d.intent, question: d.question, asOf: d.asOf, pack: d.pack, model: 'gemini-3.1-flash-lite' });
    return new Map([...p.requests.values()].map((r) => [r.cacheKey, held(r.id)]));
  }

  it('a confirm on another instance reuses what prewarm read, calls no reader, and starts the Oracle at full length', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const entries = await keysFor(d);
    clearChartBundles();
    fake.reset();
    const out = await runOracleFlow({ ...d, prewarmed: { entries, spentUsd: 0.004 } });
    expect(fake.requests.filter((r) => !r.stream && readerOf(r.body.contents[0].parts.map((p: { text: string }) => p.text)))).toHaveLength(0);
    expect(out.timings.prewarmHits).toBe(5);
    expect(out.journal.all().find((e) => e.agent === 'R08')).toMatchObject({ source: 'prewarm', status: 'cached' });
    expect(d.events.find((e) => e.name === 'R08' && e.status === 'done')).toMatchObject({ cached: true });
    expect(oraclePrompt()).not.toContain('LENGTH: at most');
    expect(out.guard.summary().lines.find((l) => l.node === 'prewarm')?.usd).toBeCloseTo(0.004);
  });

  it('a changed horizon re-runs only the timing readers', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const entries = await keysFor(d);
    clearChartBundles();
    fake.reset();
    const intent = { ...d.intent, horizon: '3y' as const };
    const out = await runOracleFlow({ ...d, intent, prewarmed: { entries, spentUsd: 0 } });
    const live = out.journal.readers().filter((e) => e.source === 'live').map((e) => e.agent).sort();
    expect(live).toEqual(['R08', 'R10']);
    const pre = out.journal.readers().filter((e) => e.source === 'prewarm').map((e) => e.agent).sort();
    expect(pre).toEqual(['R01', 'R02', 'R03']);
  });

  it('the same natal reader is not called again for the next question on this instance', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    await runOracleFlow(d);
    fake.reset();
    const d2 = await deps('Tell me more about my work', {}, intentTier3);
    const out = await runOracleFlow(d2);
    const sources = Object.fromEntries(out.journal.readers().map((e) => [e.agent, e.source]));
    expect(sources.R02).toBe('cache');
    expect(sources.R08).toBe('live');
  });

  it('buildReaderRequest: same input gives the same cache key', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const slice = { tables: TABLES, houses: [10], vargas: ['varga.d10'], from: '2026-10-24', to: '2027-10-24' };
    const a = buildReaderRequest({ id: 'R02', subject: 'career_work', slice, intent: d.intent, question: 'q1', asOf: G1_AS_OF, model: 'm' });
    const b = buildReaderRequest({ id: 'R02', subject: 'career_work', slice, intent: d.intent, question: 'q2', asOf: G1_AS_OF, model: 'm' });
    const c = buildReaderRequest({ id: 'R08', subject: 'career_work', slice, intent: d.intent, question: 'q1', asOf: G1_AS_OF, model: 'm' });
    const c2 = buildReaderRequest({ id: 'R08', subject: 'career_work', slice, intent: d.intent, question: 'q2', asOf: G1_AS_OF, model: 'm' });
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(c.cacheKey).not.toBe(c2.cacheKey);
  });
});

describe('oracle flow: the validator and its loop', () => {
  it('a missing part goes back through named readers, and the addition follows the answer', async () => {
    validatorAnswer.value = { answered: false, parts: [{ part: 'when it changes', status: 'missing', missing: 'the date of the change', readers: ['R08'] }] };
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.validation?.answered).toBe(false);
    const round2 = out.journal.all().filter((e) => e.round === 2);
    expect(round2.map((e) => e.agent)).toEqual(['R08', 'oracle']);
    expect(round2[0]!.promptSent).toContain('FOCUS ONLY ON THIS PART, WHICH THE ANSWER MISSED: when it changes');
    expect(out.answer.startsWith(ANSWER)).toBe(true);
    expect(out.answer.length).toBeGreaterThan(ANSWER.length);
    expect(fake.requests.filter((r) => r.stream)).toHaveLength(2);
    expect(d.events.filter((e) => e.type === 'addendum').map((e) => e.status)).toEqual(['start', 'done']);
    expect(d.events.find((e) => e.type === 'validation')).toMatchObject({ answered: false, missing: ['when it changes'] });
  });

  it('runs one round at most, even if the addition still misses', async () => {
    validatorAnswer.value = { answered: false, parts: [{ part: 'x', status: 'missing', missing: 'y', readers: ['R08', 'R10', 'R03'] }] };
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.journal.all().filter((e) => e.agent === 'validator')).toHaveLength(1);
    expect(out.journal.readers(2).map((e) => e.agent).sort()).toEqual(['R08', 'R10']); // at most two readers
  });

  it('an answered question makes no second round', async () => {
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.journal.all().filter((e) => e.round === 2)).toHaveLength(0);
    expect(out.answer).toBe(ANSWER);
  });

  it('a validator failure leaves the answer alone', async () => {
    validatorAnswer.value = 'not an object at all';
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.answer).toBe(ANSWER);
    expect(out.validation?.source).toBe('rules');
  });

  it('no money left means no loop', async () => {
    validatorAnswer.value = { answered: false, parts: [{ part: 'x', status: 'missing', missing: 'y', readers: ['R08'] }] };
    const guard = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.05, oracle: 0.0035, query: 0.3 } });
    const d = await deps(CAREER, { guard }, intentTier3);
    const out = await runOracleFlow(d);
    expect(out.journal.all().filter((e) => e.round === 2 && e.agentKind === 'oracle')).toHaveLength(0);
  });

  it('READING_VALIDATOR=0 keeps the rules and makes no model call', async () => {
    process.env.READING_VALIDATOR = '0';
    const d = await deps(CAREER, {}, intentTier3);
    const out = await runOracleFlow(d);
    delete process.env.READING_VALIDATOR;
    expect(out.validation?.source).toBe('rules');
    expect(fake.requests.filter((r) => !r.stream)).toHaveLength(5);
  });
});

describe('runReading routes the oracle flow', () => {
  it('reads one subject and queues the others as parts', async () => {
    const q = 'Tell me about my career and my marriage over the next year';
    const events: ReadingEvent[] = [];
    const base = (await runIntake(q, G1_AS_OF, { mode: 'rules' })).intent;
    const r = await runReading({} as unknown as PrismaClient, 'u1', q, { asOf: G1_AS_OF, flow: 'oracle', intent: { ...base, questionType: 'describe', horizon: '1y', subjects: [{ id: 'career_work', weight: 1 }, { id: 'marriage_relationship', weight: 1 }] }, chartRows: rowsSource(), onEvent: (e) => events.push(e) });
    expect(r.record.intent.subjects).toHaveLength(1);
    expect(events.find((e) => e.type === 'next')).toMatchObject({ parts: [{ id: 'marriage_relationship' }] });
  });

  it('a fast-lane question skips the readers', async () => {
    const q = 'Will I get a raise this month?';
    const base = (await runIntake(q, G1_AS_OF, { mode: 'rules' })).intent;
    const r = await runReading({} as unknown as PrismaClient, 'u1', q, { asOf: G1_AS_OF, flow: 'oracle', intent: { ...base, questionType: 'yes_no', horizon: 'now', subjects: [{ id: 'career_work', weight: 1 }] }, chartRows: rowsSource() });
    expect(r.record.flow).toBe('single');
    expect(r.record.journal).toBeUndefined();
  });

  it('declared flows are unchanged when READING_FLOW is single', async () => {
    const r = await runReading({} as unknown as PrismaClient, 'u1', CAREER, { asOf: G1_AS_OF, flow: 'single' });
    expect(r.record.flow).toBe('single');
    expect(r.record.journal).toBeUndefined();
  });
});
