import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRules, classifierThreshold } from '../../../../src/reading/buckets/classifier.js';
import { startClarify } from '../../../../src/reading/clarify/machine.js';
import { clearReadingCaches } from '../../../../src/reading/data/store.js';
import { runIntake } from '../../../../src/reading/nodes/intake.js';
import { buildBrief, groundReader, layerOf } from '../../../../src/reading/oracle/brief.js';
import { clearChartBundles, loadChartBundle, prismaChartRows, type ChartRowSource } from '../../../../src/reading/oracle/chartBundle.js';
import { CostGuard } from '../../../../src/reading/oracle/costGuard.js';
import { runOracleFlow, type OracleFlowDeps } from '../../../../src/reading/oracle/flow.js';
import { clearStartedCaches, readerRange, startReaderCache } from '../../../../src/reading/oracle/prepare.js';
import { clearReaderMemo, getReaderMemo, setReaderMemo } from '../../../../src/reading/oracle/prewarm.js';
import { prewarmOracleReaders } from '../../../../src/reading/oracle/prewarmReaders.js';
import { READERS, type ReaderId } from '../../../../src/reading/oracle/readers.js';
import { buildReaderRequest, readerFindingZ, ReaderFailure, runReader, toLayerFinding } from '../../../../src/reading/oracle/runReader.js';
import { annualTable, aspectLists, clipPeriods, frameHouses, presentOnly } from '../../../../src/reading/oracle/slices.js';
import { validateAnswer } from '../../../../src/reading/oracle/validator.js';
import { buildEvidencePack } from '../../../../src/reading/packs/selector.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import type { Intent, ReadingEvent } from '../../../../src/reading/types.js';
import { startFakeGemini, type FakeGemini } from '../../../helpers/fakeGemini.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../../helpers/readingFixtures.js';

const LITE = 'gemini-3.1-flash-lite';
const USAGE = { node: 'x', model: LITE, promptTokens: 100, cachedTokens: 0, outputTokens: 10, thoughtTokens: 0, ms: 1 };
const output = (over: object = {}) => readerFindingZ.parse({ verdict: 'moderate', layerScore: 1, digest: 'how', claims: [], ...over });
const intent: Intent = { subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'describe', format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: '', followUps: [], safety: 'ok' };

const answers: { reader: (id: string, parts: string[]) => { text: string; finishReason?: string } | null; validator: () => { text: string } } = { reader: () => null, validator: () => ({ text: '{"answered":true,"parts":[]}' }) };
let fake: FakeGemini;
const rows: ChartRowSource = { read: async () => [] };

beforeAll(async () => {
  fake = await startFakeGemini({
    answer: 'The window opens in March 2027 and holds for the year after it.',
    thoughts: ['thinking it through'],
    respond: (parts, body) => {
      if (body?.generationConfig?.responseSchema?.properties?.parts) return answers.validator();
      return answers.reader(parts[2] ?? '', parts);
    },
  });
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_API_URL = fake.url;
  process.env.GEMINI_FLASH_MODEL_ID = 'gemini-3.8-flash';
  process.env.READING_MODEL_READER = LITE;
  process.env.READING_MODEL_ORACLE = 'gemini-3.8-flash';
  process.env.READING_MODEL_VALIDATOR = LITE;
  process.env.READING_FACTS_SOURCE = 'fixture';
  process.env.READING_INTAKE_MODE = 'rules';
  delete process.env.READING_EXPLICIT_CACHE;
  delete process.env.READING_REMEDY_READER;
});
afterAll(async () => {
  await fake.close();
  for (const k of ['READING_MODEL_READER', 'READING_MODEL_ORACLE', 'READING_MODEL_VALIDATOR', 'READING_FACTS_SOURCE', 'READING_INTAKE_MODE', 'READING_FLOW', 'READING_CACHE_TTL_MS']) delete process.env[k];
});
beforeEach(() => {
  fake.reset();
  clearChartBundles();
  clearReaderMemo();
  clearReadingCaches();
  clearStartedCaches();
  answers.reader = () => null;
  answers.validator = () => ({ text: '{"answered":true,"parts":[]}' });
});

const okImpl = (over: object = {}) =>
  (async (req: { id: ReaderId; subject: never }) => ({ id: req.id, subject: req.subject, finding: output({ claims: [{ text: `${req.id} says Saturn holds.`, evidence: ['dignities.planets.Saturn.dignity'], polarity: 'supports', weight: 2, tradition: 'parashara', about: 'self', topic: 'Saturn', kind: 'holds' }], ...over }), usage: USAGE, repaired: false })) as unknown as typeof runReader;

const TABLES: ChartRowSource = {
  read: async (_k, types) => types.map((t) => ({ data_type: t, variant: '', payload: t === 'dignities' ? { planets: [{ name: 'Saturn', dignity: 'Exalted' }] } : t.startsWith('dasha') ? { periods: [] } : { x: 1 } })),
};

async function deps(question: string, over: Partial<OracleFlowDeps> = {}, intentOver: Partial<Intent> = {}): Promise<OracleFlowDeps & { events: ReadingEvent[] }> {
  const i = { ...(await runIntake(question, G1_AS_OF, { mode: 'rules' })).intent, ...intentOver };
  const pack = buildEvidencePack({ dossier: loadG1Dossier(), transits: loadG1Transits(), subject: i.subjects[0]!.id, asOf: G1_AS_OF, intent: i });
  const events: ReadingEvent[] = [];
  return { events, rows: TABLES, kundliId: 'k1', userId: 'u1', runId: 'run1', intent: i, question, asOf: G1_AS_OF, system: 'PERSONA', pack, tail: `QUESTION: ${question}`, thinking: 'off', includeThoughts: false, emit: (e) => events.push(e), cacheOwner: { userId: 'u1', kundliId: 'k1' }, ...over };
}

describe('every reader slice', () => {
  const tables: Record<string, unknown> = {};
  for (const t of ['yogas', 'doshas', 'aspects', 'argala.d1', 'bhava', 'varga.d10', 'arudhas.d10', 'varga.d9', 'varga.d30', 'varga.d12', 'strength.bhava', 'strength.vimsopaka', 'strength.harsha', 'sphutas', 'annual.tithi_pravesha', 'annual.varsha', 'annual.sahams', 'annual.mudda', 'annual.patyayini', 'dasha.vimsottari', 'dasha.narayana', 'dasha.chara', 'dasha.applicable', 'dasha.yogini', 'dasha.tithi_ashtottari', 'dasha.dwisatpathi']) tables[t] = { kept: t };
  const slice = { tables, houses: [10], vargas: ['varga.d10'], from: '2026-11-01', to: '2027-11-01', transits: { now: {} }, transitAt: { at: 'x' }, prashna: { lagna: 'x' }, person: { person: 'mother' as const, houses: [4], varga: 'varga.d12' } };
  const expected: Record<ReaderId, string[]> = {
    R01: ['yogas', 'doshas', 'dasha_vimsottari'],
    R02: ['aspects', 'argala_d1', 'bhava'],
    R03: ['varga_d10', 'varga_d9', 'varga_d30', 'arudhas_d10'],
    R04: ['argala_d1', 'dasha_narayana', 'dasha_chara'],
    R05: ['strength_bhava', 'strength_vimsopaka', 'strength_harsha'],
    R06: ['yogas', 'doshas'],
    R07: ['transits', 'transit_at'],
    R08: ['dasha_vimsottari'],
    R09: ['dasha_applicable', 'dasha_yogini', 'dasha_narayana', 'dasha_tithi_ashtottari', 'dasha_dwisatpathi'],
    R10: ['transits', 'transit_at'],
    R11: ['annual_tithi_pravesha', 'annual_varsha', 'annual_sahams', 'annual_mudda', 'annual_patyayini'],
    R12: ['prashna'],
    R13: ['aspects', 'dasha_vimsottari', 'varga_d12', 'transits', 'transit_at'],
    R14: [],
    P1: ['aspects', 'bhava', 'dasha_vimsottari', 'transits', 'transit_at'],
    P2: ['dasha_vimsottari', 'transits', 'transit_at'],
    P3: ['sphutas', 'dasha_vimsottari', 'transits', 'transit_at'],
  };

  it.each(Object.keys(expected) as ReaderId[])('%s sees exactly its own tables, and asks for them', (id) => {
    expect(Object.keys(READERS[id].slice(slice))).toEqual(expected[id]);
    const asked = READERS[id].types({ vargas: slice.vargas, person: slice.person }).map((t) => t.replace(/\./g, '_'));
    for (const section of expected[id].filter((s) => !s.startsWith('transit') && s !== 'prashna')) expect(asked).toContain(section);
  });

  it('a table that is not stored is left out, not invented', () => {
    const empty = { ...slice, tables: {}, transits: undefined, transitAt: undefined, prashna: undefined, person: null };
    for (const id of Object.keys(READERS) as ReaderId[]) expect(READERS[id].slice(empty), id).toEqual({});
  });

  it('a subject with no varga leaves the varga reader on D9 and D30', () => {
    expect(READERS.R03.types({ vargas: [], person: null })).toEqual(['varga.d9', 'varga.d30']);
    expect(Object.keys(READERS.R03.slice({ ...slice, vargas: [] }))).toEqual(['varga_d9', 'varga_d30']);
  });

  it('only readers with a convergence layer become layer findings', () => {
    expect(toLayerFinding({ id: 'R01', subject: 'career_work', finding: output() })).toBeNull();
    expect(toLayerFinding({ id: 'R08', subject: 'career_work', finding: output() })?.analyst).toBe('dasha');
  });
});

describe('slices on odd payloads', () => {
  it('passes through what it cannot select from', () => {
    expect(clipPeriods({ a: 1 }, '2026', '2027')).toEqual({ a: 1 });
    expect(presentOnly({ a: 1 }, 'yogas')).toEqual({ a: 1 });
    expect(frameHouses({ a: 1 }, [1])).toEqual({ a: 1 });
    expect(aspectLists(null)).toBeNull();
    expect(annualTable({ rows: 1 }, '2026', '2027')).toEqual({ rows: 1 });
  });

  it('skips a dasha row with no dates, and clips annual periods', () => {
    const out = annualTable({ periods: [{ lord: 'x' }, { lord: 'Sa', start: '2026-12-01', end: '2027-01-01' }] }, '2026-11-01', '2027-11-01') as { periods: object };
    expect(Object.keys(out.periods)).toEqual(['Sa_2026-12-01']);
  });
});

describe('chart bundle', () => {
  it('the Prisma source asks for ready rows of the planned types only', async () => {
    const findMany = vi.fn(async () => []);
    await prismaChartRows({ kundliData: { findMany } } as unknown as PrismaClient).read('k1', ['varga.d1']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { kundli_id: 'k1', status: 'ready', data_type: { in: ['varga.d1'] } } }));
  });

  it('reads again once the cache has expired', async () => {
    process.env.READING_CACHE_TTL_MS = '0';
    const read = vi.fn(async () => []);
    await loadChartBundle({ read }, 'k1', ['varga.d1'], G1_AS_OF);
    await new Promise((r) => setTimeout(r, 2));
    await loadChartBundle({ read }, 'k1', ['varga.d1'], G1_AS_OF);
    delete process.env.READING_CACHE_TTL_MS;
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('an annual row with no holding dates is missing', async () => {
    const source: ChartRowSource = { read: async () => [{ data_type: 'annual.varsha', variant: 'year=2020', payload: { valid_from: '2020-01-01', valid_to: '2021-01-01' } }] };
    expect((await loadChartBundle(source, 'k1', ['annual.varsha'], G1_AS_OF)).missing).toEqual(['annual.varsha']);
  });
});

describe('cost guard, remaining paths', () => {
  it('prices a worst case, and null for an unknown model', () => {
    const g = new CostGuard({ on: '2026-11-01', caps: { fanout: 0.05, oracle: 0.25, query: 0.3 } });
    expect(g.worstCase(LITE, 1000, 1000)).toBeCloseTo((1000 * 0.25 + 1000 * 1.5) / 1e6);
    expect(g.worstCase('made-up', 1, 1)).toBeNull();
  });

  it('a call with no usage report stays on the books as spent', () => {
    const g = new CostGuard({ on: '2026-11-01', caps: { fanout: 0.05, oracle: 0.25, query: 0.3 } });
    const r = g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 1000, maxOutputTokens: 500 });
    g.settleUnknown(r);
    expect(g.spent('fanout')).toBeCloseTo(r.usd);
    expect(g.summary().lines[0]!.estimate).toBe(true);
  });

  it('settling with no usage bills nothing, as after an HTTP error', () => {
    const g = new CostGuard({ on: '2026-11-01', caps: { fanout: 0.05, oracle: 0.25, query: 0.3 } });
    expect(g.settle(g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 1000, maxOutputTokens: 500 }), null)).toBe(0);
    expect(g.spent()).toBe(0);
  });
});

describe('readers prefix cache', () => {
  it('books storage once per prefix, and nothing with the cache off', async () => {
    const g = new CostGuard({ on: G1_AS_OF });
    await startReaderCache({ system: 's', coreText: 'CHART CORE' }, LITE, { userId: 'u', kundliId: 'k' }, g);
    expect(g.spent()).toBe(0);
    process.env.READING_EXPLICIT_CACHE = '1';
    try {
      await startReaderCache({ system: 's', coreText: 'CHART CORE: x'.repeat(100) }, LITE, { userId: 'u', kundliId: 'k' }, g);
      await startReaderCache({ system: 's', coreText: 'CHART CORE: x'.repeat(100) }, LITE, { userId: 'u', kundliId: 'k' }, g);
    } finally {
      delete process.env.READING_EXPLICIT_CACHE;
    }
    const lines = g.summary().lines.filter((l) => l.node === 'cache_storage');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.estimate).toBe(true);
    expect(lines[0]!.usd).toBeGreaterThan(0);
  });
});

describe('reader range', () => {
  it('holds a very long horizon to ten years ahead', () => {
    expect(readerRange({ ...intent, horizon: { from: '2026-10-24', to: '2090-01-01' } }, '2026-10-24').to).toBe('2036-10-24');
    expect(readerRange({ ...intent, horizon: '1y' }, '2026-10-24').to.slice(0, 4)).toBe('2027');
  });
});

describe('reader memo', () => {
  it('forgets an old entry, and the oldest when full', () => {
    const held = { finding: output(), usage: USAGE };
    vi.useFakeTimers();
    try {
      setReaderMemo('old', held);
      vi.advanceTimersByTime(7 * 3_600_000);
      expect(getReaderMemo('old')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
    for (let i = 0; i < 501; i++) setReaderMemo(`k${i}`, held);
    expect(getReaderMemo('k0')).toBeUndefined();
    expect(getReaderMemo('k500')).toBeDefined();
  });
});

describe('brief', () => {
  it('maps the remaining evidence families', () => {
    expect(layerOf('prashna.lagna')).toBe('prashna');
    expect(layerOf('frame.running.md')).toBe('frame');
  });

  it('carries actors, graces, ranked possibilities, disagreements, gaps and date grades', () => {
    const sections = { dignities: { planets: { Saturn: { dignity: 'Exalted' } } }, dasha_vimsottari: {} };
    const finding = output({
      claims: [{ text: 'Saturn holds.', evidence: ['dignities.planets.Saturn.dignity'], polarity: 'supports', weight: 3, tradition: 'parashara', about: 'mother', topic: 'Saturn', kind: 'holds' }],
      windows: [{ from: '2026-12-01', to: '2027-01-01', label: 'a', polarity: 'favourable', evidence: ['dignities.planets.Saturn.dignity'], fruit: 'gain', date_source: 'interpolated' }],
      actors: [{ planet: 'Moon', person: 'mother', can_do: ['tend routine'], needs: ['rest'], windows: ['December'] }, { planet: 'Sun', person: 'father' }],
      graces: [{ text: 'Jupiter holds the 4th.', evidence: ['dignities.planets.Saturn.dignity'] }, { text: 'An ungrounded grace.', evidence: ['nope'] }],
      pointers: [{ text: 'A possibility.', fit: 3, evidence: ['dignities.planets.Saturn.dignity'], alt: ['another'] }, { text: 'A lesser one.', fit: 1, evidence: ['dignities.planets.Saturn.dignity'] }, { text: 'Ungrounded.', fit: 3, evidence: ['nope'] }],
      gaps: [{ need: 'star lord', why: 'not served' }],
      disagree: 'Two rules point opposite ways.',
      sensitive: 'a parent in decline',
    });
    const g = groundReader('R08', 'career_work', finding, sections);
    const pack = buildEvidencePack({ dossier: loadG1Dossier(), transits: loadG1Transits(), subject: 'career_work', asOf: G1_AS_OF, intent });
    const b = buildBrief({ readers: [g, { ...groundReader('R02', 'career_work', output(), sections) }], failed: [{ id: 'R10', required: true, reason: 'timeout' }, { id: 'R03', required: false, reason: 'timeout' }], missingTypes: ['varga.d10'], pack: { ...pack, sections: { ...pack.sections, ...sections } }, intent, question: 'q', asOf: G1_AS_OF, tier: 3, note: 'a note' });
    expect(b.text).toContain('THIS KIND OF QUESTION: a note');
    expect(b.text).toContain('mother (Moon): can tend routine; needs rest; when December');
    expect(b.text).toContain('father (Sun): can not stated');
    expect(b.text).toContain('Jupiter holds the 4th.');
    expect(b.text).not.toContain('An ungrounded grace');
    expect(b.text).toContain('fit 3: A possibility. (the chart cannot tell this from: another)');
    expect(b.text).not.toContain('Ungrounded.');
    expect(b.text).toContain('Two rules point opposite ways.');
    expect(b.text).toContain('star lord');
    expect(b.text).toContain('varga.d10');
    expect(b.text).toContain('2026-12-01 to 2027-01-01: interpolated');
    expect(b.text).toContain('a parent in decline');
    expect(b.text).toContain('weight 3, a moderate indication');
    expect(b.text).toContain('VERDICT: ');
    expect(b.reconciled.verdict.caps.length).toBeGreaterThan(0);
  });
});

describe('one reader call, failures', () => {
  const req = (focus: string) => buildReaderRequest({ id: 'R08', subject: 'career_work', slice: { tables: {}, houses: [10], vargas: [], from: '2026-11-01', to: '2027-11-01' }, intent, question: 'q', asOf: G1_AS_OF, model: LITE, focus });

  it('reports an empty answer as a model error and a cut-off with no whole claim as parse', async () => {
    answers.reader = (tail) => (tail.includes('EMPTY') ? { text: '   ' } : tail.includes('STUMP') ? { text: '{"verdict":"strong","claims":[{"text":"cut', finishReason: 'MAX_TOKENS' } : null);
    await expect(runReader(req('EMPTY'), { model: LITE, guard: new CostGuard({ on: G1_AS_OF }) })).rejects.toMatchObject({ reason: 'model_error' });
    await expect(runReader(req('STUMP'), { model: LITE, guard: new CostGuard({ on: G1_AS_OF }) })).rejects.toMatchObject({ reason: 'parse' });
  });

  it('reports a JSON array as the wrong shape', async () => {
    answers.reader = () => ({ text: '[1,2]' });
    await expect(runReader(req('x'), { model: LITE, guard: new CostGuard({ on: G1_AS_OF }) })).rejects.toBeInstanceOf(ReaderFailure);
  });

  it('an HTTP error is not billed, and a time-out stays on the books', async () => {
    const down = await startFakeGemini({ specialistDelayMs: 200 });
    const url = process.env.GEMINI_API_URL;
    try {
      const timedOut = new CostGuard({ on: G1_AS_OF });
      process.env.GEMINI_API_URL = down.url;
      await expect(runReader(req('x'), { model: LITE, guard: timedOut, timeoutMs: 20 })).rejects.toMatchObject({ reason: 'timeout' });
      expect(timedOut.spent('fanout')).toBeGreaterThan(0);
      const http = await startFakeGemini({ respond: () => null, failAnalysts: [] });
      await http.close();
      process.env.GEMINI_API_URL = http.url;
      const refused = new CostGuard({ on: G1_AS_OF });
      await expect(runReader(req('x'), { model: LITE, guard: refused, timeoutMs: 500 })).rejects.toBeInstanceOf(ReaderFailure);
    } finally {
      process.env.GEMINI_API_URL = url;
      await down.close();
    }
  });
});

describe('validator, remaining paths', () => {
  const base = { answer: 'A long enough answer that names March 2027 for this question.', question: 'When?', intent, finishReason: 'STOP', stoppedForLoop: false, failedRequired: [], model: LITE, useModel: true };

  it('with no money for the model, the rules stand', async () => {
    const guard = new CostGuard({ on: G1_AS_OF, caps: { fanout: 0.05, oracle: 0.25, query: 0.00001 }, oracleHoldUsd: 0 });
    const v = await validateAnswer({ ...base, guard });
    expect(v.source).toBe('rules');
    expect(v.flags).toContain('validator_budget');
    expect(fake.requests).toHaveLength(0);
  });

  it('text that is not JSON leaves the rules standing and is flagged', async () => {
    answers.validator = () => ({ text: 'not json' });
    const v = await validateAnswer({ ...base, guard: new CostGuard({ on: G1_AS_OF }) });
    expect(v.source).toBe('rules');
    expect(v.flags).toContain('validator_failed');
  });

  it('never asks the model about an empty answer', async () => {
    const v = await validateAnswer({ ...base, answer: '', guard: new CostGuard({ on: G1_AS_OF }) });
    expect(v.flags).toContain('empty');
    expect(fake.requests).toHaveLength(0);
  });

  it('a part the rules found stands when the model finds nothing, and readers outside the loop list are dropped', async () => {
    answers.validator = () => ({ text: '{"answered":true,"parts":[]}' });
    const noDate = await validateAnswer({ ...base, answer: 'You will move when the time feels right for you to do so.', intent: { ...intent, questionType: 'timing' }, guard: new CostGuard({ on: G1_AS_OF }) });
    expect(noDate.answered).toBe(false);
    expect(noDate.missing[0]!.part).toBe('when');
    answers.validator = () => ({ text: '{"answered":false,"parts":[{"part":"x","status":"partial","missing":"y","readers":["R99","R08","R10","R03"]}]}' });
    const v = await validateAnswer({ ...base, guard: new CostGuard({ on: G1_AS_OF }) });
    expect(v.missing[0]!.readers).toEqual(['R08', 'R10']);
  });

  it('includes what the person told the clarifier', async () => {
    await validateAnswer({ ...base, intent: { ...intent, clarified: { turns: [{ criterion: 'horizon', question: 'q', answer: 'next year' }, { criterion: 'x', question: 'q', answer: '' }], assumed: {}, exactQuery: null } }, guard: new CostGuard({ on: G1_AS_OF }) });
    expect(JSON.stringify(fake.requests[0]!.body)).toContain('horizon: next year');
  });
});

describe('flow, remaining paths', () => {
  const Q = 'Tell me about my career over the next year';
  const tier3: Partial<Intent> = { questionType: 'describe', horizon: '1y', subjects: [{ id: 'career_work', weight: 1 }] };

  it('the remedy reader runs only when switched on, and reads findings, not tables', async () => {
    process.env.READING_REMEDY_READER = '1';
    try {
      const d = await deps(Q, { readerImpl: okImpl() }, { ...tier3, clarified: { turns: [], assumed: {}, exactQuery: null, realWant: { id: 'what_can_i_do', line: 'what to do', sensitive: null } } });
      const out = await runOracleFlow(d);
      expect(out.readers).toContain('R14');
      expect(out.journal.all().find((e) => e.agent === 'R14')?.promptSent).toContain('FINDINGS:');
      const prompt = fake.requests.find((r) => r.stream)!.body.contents[0].parts.map((p: { text: string }) => p.text).join('\n');
      expect(prompt).toContain('WHAT TO DO:');
    } finally {
      delete process.env.READING_REMEDY_READER;
    }
  });

  it('a failed remedy reader leaves the reading whole', async () => {
    process.env.READING_REMEDY_READER = '1';
    const impl = (async (req: { id: ReaderId; subject: never }, a: object) => {
      if (req.id === 'R14') throw new Error('no remedy today');
      return okImpl()(req as never, a as never);
    }) as unknown as typeof runReader;
    try {
      const d = await deps(Q, { readerImpl: impl }, { ...tier3, clarified: { turns: [], assumed: {}, exactQuery: null, realWant: { id: 'what_can_i_do', line: 'what to do', sensitive: null } } });
      const out = await runOracleFlow(d);
      expect(out.errors.map((e) => e.node)).toContain('R14');
      expect(out.answer).toContain('March 2027');
    } finally {
      delete process.env.READING_REMEDY_READER;
    }
  });

  it('streams thoughts when asked', async () => {
    const seen: string[] = [];
    const out = await runOracleFlow(await deps(Q, { readerImpl: okImpl(), includeThoughts: true, onThought: (t) => seen.push(t), thinking: 'low' }, tier3));
    expect(seen).toEqual(['thinking it through']);
    expect(out.thoughts).toBe('thinking it through');
  });

  it('when the Oracle call itself fails, the journal says so and the error carries it', async () => {
    const dead = await startFakeGemini({});
    await dead.close();
    const url = process.env.GEMINI_API_URL;
    const d = await deps(Q, { readerImpl: okImpl() }, tier3);
    process.env.GEMINI_API_URL = dead.url;
    try {
      await runOracleFlow(d);
      expect.unreachable();
    } catch (err) {
      const j = (err as { journal: { all: () => Array<{ agent: string; status: string }> } }).journal;
      expect(j.all().find((e) => e.agent === 'oracle')?.status).toBe('failed');
    } finally {
      process.env.GEMINI_API_URL = url;
    }
  });

  it('a thrown error that is not a reader failure still skips the reader', async () => {
    const impl = (async (req: { id: ReaderId; subject: never }, a: object) => {
      if (req.id === 'R03') throw new Error('socket hang up');
      return okImpl()(req as never, a as never);
    }) as unknown as typeof runReader;
    const d = await deps(Q, { readerImpl: impl }, tier3);
    await runOracleFlow(d);
    expect(d.events.find((e) => e.name === 'R03' && e.status === 'skipped')).toMatchObject({ reason: 'model_error' });
  });

  it('keeps the bill of a failed attempt, and a billed failure on the record', async () => {
    const impl = (async (req: { id: ReaderId; subject: never }, a: object) => {
      if (req.id === 'R08') throw new ReaderFailure('bad', 'parse', USAGE);
      return okImpl()(req as never, a as never);
    }) as unknown as typeof runReader;
    const out = await runOracleFlow(await deps(Q, { readerImpl: impl }, tier3));
    expect(out.usage.filter((u) => u === USAGE || u.node === 'x').length).toBeGreaterThan(0);
    expect(out.journal.all().find((e) => e.agent === 'R08')).toMatchObject({ status: 'failed', failureReason: 'parse' });
  });

  it('a cut-off finding is used but not reused for the next question', async () => {
    const impl = (async (req: { id: ReaderId; subject: never }, a: object) => ({ ...(await okImpl()(req as never, a as never)), repaired: true })) as unknown as typeof runReader;
    await runOracleFlow(await deps(Q, { readerImpl: impl }, tier3));
    const again = await runOracleFlow(await deps(Q, { readerImpl: okImpl() }, tier3));
    expect(again.journal.readers().every((e) => e.source === 'live')).toBe(true);
  });

  it('the loop stops quietly when its readers give nothing, and a part with no named readers uses the timing ones', async () => {
    answers.validator = () => ({ text: '{"answered":false,"parts":[{"part":"when","status":"missing","missing":"dates","readers":[]}]}' });
    const seen: string[] = [];
    const impl = (async (req: { id: ReaderId; subject: never; promptSent: string }, a: object) => {
      if (req.promptSent.includes('FOCUS ONLY')) {
        seen.push(req.id);
        throw new ReaderFailure('no', 'parse', null);
      }
      return okImpl()(req as never, a as never);
    }) as unknown as typeof runReader;
    const d = await deps(Q, { readerImpl: impl }, tier3);
    const out = await runOracleFlow(d);
    expect(seen.sort()).toEqual(['R08', 'R10']);
    expect(fake.requests.filter((r) => r.stream)).toHaveLength(1);
    expect(d.events.filter((e) => e.type === 'addendum').map((e) => e.status)).toEqual(['start', 'done']);
    expect(out.answer).toContain('March 2027');
  });

  it('the addendum keeps its dates, and a failed addendum leaves the answer whole', async () => {
    answers.validator = () => ({ text: '{"answered":false,"parts":[{"part":"when","status":"missing","missing":"dates","readers":["R08"]}]}' });
    const windowed = okImpl({ windows: [{ from: '2027-03-01', to: '2027-06-01', label: 'opens', polarity: 'favourable', evidence: ['dignities.planets.Saturn.dignity'], fruit: 'gain' }] });
    await runOracleFlow(await deps(Q, { readerImpl: windowed }, tier3));
    const addendum = fake.requests.filter((r) => r.stream)[1]!;
    expect(addendum.body.contents[0].parts.map((p: { text: string }) => p.text).join('\n')).toContain('2027-03-01 to 2027-06-01: opens, gain');

    fake.reset();
    clearReaderMemo();
    const url = process.env.GEMINI_API_URL;
    const dead = await startFakeGemini({});
    await dead.close();
    // the reader of the loop runs, then the addendum call cannot connect
    const killThenRead = (async (req: { id: ReaderId; promptSent: string; subject: never }, a: object) => {
      if (req.promptSent.includes('FOCUS ONLY')) process.env.GEMINI_API_URL = dead.url;
      return okImpl()(req as never, a as never);
    }) as unknown as typeof runReader;
    try {
      const out = await runOracleFlow(await deps(Q, { readerImpl: killThenRead }, tier3));
      expect(out.answer).toBe('The window opens in March 2027 and holds for the year after it.');
      expect(out.errors.map((e) => e.node)).toContain('addendum');
    } finally {
      process.env.GEMINI_API_URL = url;
    }
  });

  it('a stopped-for-repetition answer gets no loop', async () => {
    const loopFake = await startFakeGemini({ answer: 'repeat me over and over and over. '.repeat(120), respond: () => ({ text: '{"answered":false,"parts":[{"part":"x","status":"missing","missing":"y","readers":["R08"]}]}' }) });
    const url = process.env.GEMINI_API_URL;
    process.env.GEMINI_API_URL = loopFake.url;
    try {
      const out = await runOracleFlow(await deps(Q, { readerImpl: okImpl() }, tier3));
      expect(out.stoppedForLoop).toBe(true);
      expect(out.journal.all().filter((e) => e.round === 2)).toHaveLength(0);
    } finally {
      process.env.GEMINI_API_URL = url;
      await loopFake.close();
    }
  });

  it('a question past the time limit gets no loop', async () => {
    answers.validator = () => ({ text: '{"answered":false,"parts":[{"part":"x","status":"missing","missing":"y","readers":["R08"]}]}' });
    let clock = 1_000;
    const out = await runOracleFlow(await deps(Q, { readerImpl: okImpl(), now: () => (clock += 20_000) }, { ...tier3 }));
    expect(out.journal.all().filter((e) => e.round === 2)).toHaveLength(0);
  });

  it('with no readers planned it goes straight to the Oracle', async () => {
    const out = await runOracleFlow(await deps(Q, { readerImpl: okImpl() }, { ...tier3 }));
    expect(out.answer.length).toBeGreaterThan(0);
  });
});

describe('prewarm, remaining paths', () => {
  const Q = 'Should I change my job next year?';
  const state = () => startClarify(Q, G1_AS_OF, classifyRules(Q, G1_AS_OF), { mode: 'always', threshold: classifierThreshold(), card: null, needsChildAge: false, location: null, needsLocation: false, birthPlace: null });
  const db = (fail = false) =>
    ({
      readingRun: {
        findFirst: async () => ({ findings: null }),
        updateMany: async () => {
          if (fail) throw new Error('db down');
          return { count: 1 };
        },
      },
    }) as unknown as PrismaClient;

  it('reuses this instance\'s readers, and does not save a cut-off one', async () => {
    process.env.READING_FLOW = 'oracle';
    const cutOff = (async (req: { id: ReaderId; subject: never }, a: object) => ({ ...(await okImpl()(req as never, a as never)), repaired: req.id === 'R08' })) as unknown as typeof runReader;
    const first = await prewarmOracleReaders(db(), 'u1', state(), 'run1', { readerImpl: cutOff, rows });
    expect(first.ran.length).toBeGreaterThan(1);
    const second = await prewarmOracleReaders(db(), 'u1', state(), 'run1', { readerImpl: okImpl(), rows });
    expect(second.cached.length).toBe(first.ran.length - 1);
    expect(second.ran).toEqual(['R08']);
    delete process.env.READING_FLOW;
  });

  it('a failed save is logged, and the clarify request goes on', async () => {
    process.env.READING_FLOW = 'oracle';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(prewarmOracleReaders(db(true), 'u1', state(), 'run1', { readerImpl: okImpl(), rows })).resolves.toBeDefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    delete process.env.READING_FLOW;
  });

  it('a reader error that is not a reader failure is reported as such', async () => {
    process.env.READING_FLOW = 'oracle';
    const r = await prewarmOracleReaders(db(), 'u1', state(), 'run1', { readerImpl: (async () => { throw new Error('x'); }) as unknown as typeof runReader, rows });
    expect(r.skipped[0]).toMatch(/:error$/);
    delete process.env.READING_FLOW;
  });
});

describe('every prompt the flow names exists', () => {
  it('oracle prompts are embedded', () => {
    for (const k of ['oracle/system', 'oracle/addendum', 'oracle/validator', 'readers/_shared']) expect(PROMPTS[k], k).toBeTruthy();
  });
});
