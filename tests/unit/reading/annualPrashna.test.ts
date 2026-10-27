/**
 * R28 (docs/reading-engine/28 §5): the annual (Tithi Pravesh) and prashna specialists in the reading graph, and the
 * transit specialist at an asked date. Fake specialists, the fake Gemini and fake Radha fetchers only: no network to a
 * real model, no Radha, no database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { confirmClarify, prashnaRule, startClarify, type ClarifyState } from '../../../src/reading/clarify/machine.js';
import { judgePrashna } from '../../../src/reading/clarify/planner.js';
import { confirmAndBuildIntent } from '../../../src/reading/clarify/service.js';
import { MemoryClarifyStore } from '../../../src/reading/clarify/store.js';
import { setBedrockClientForTests } from '../../../src/reading/llm/bedrock.js';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../src/reading/chartData/catalog.js';
import { clearChartDataCaches, type ChartDataRepo, type FetchResult, type KundliRequest, type RowKey, type StoredRow } from '../../../src/reading/chartData/store.js';
import type { PrashnaCastRow, PrashnaRepo } from '../../../src/reading/chartData/prashna.js';
import { buildReadingGraph, optionalLayersFor } from '../../../src/reading/graph.js';
import { layerLoaders, type LayerLoaders } from '../../../src/reading/layers/loaders.js';
import { annualSection, prashnaSection, transitAtSection } from '../../../src/reading/layers/sections.js';
import { convergence, prashnaNudge } from '../../../src/reading/nodes/convergence.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { runIntake } from '../../../src/reading/nodes/intake.js';
import { annualApplies, isFastLane, prashnaApplies, runSpecialist, transitAskedAt, type Finding, type SpecialistAnalyst } from '../../../src/reading/nodes/specialists.js';
import { buildEvidencePack, renderSubject, type EvidencePack } from '../../../src/reading/packs/selector.js';
import { BUILTIN_TOPICS } from '../../../src/reading/policy/declined.js';
import { PROMPTS } from '../../../src/reading/prompts/generated.js';
import type { Intent, ReadingEvent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';
import { startFakeGemini } from '../../helpers/fakeGemini.js';

const AS_OF = G1_AS_OF; // 2026-10-24
const dossier = loadG1Dossier();
const transits = loadG1Transits();

// ---- fake Radha payloads (shapes of AIAstra_Radha annual_export / prashna_export / transit_export) ----------

const planetRows = (houses: Record<string, number>, extra: Record<string, unknown> = {}) =>
  Object.entries(houses).map(([name, h]) => ({ name, sign: 'Leo', sign_index: 4, longitude: 10, nakshatra: 'Magha', house_from_lagna: h, ...extra }));

const TP_CHART = {
  year_used: 2026, valid_from: '2026-02-10 06:00:00', valid_to: '2027-03-01 07:00:00',
  lagna: { name: 'Lagna', sign: 'Gemini', sign_index: 2, longitude: 3, nakshatra: 'Mrigashira', house_from_lagna: 1 },
  planets: planetRows({ Sun: 10, Moon: 7, Mars: 6, Mercury: 10, Jupiter: 7, Venus: 11, Saturn: 9, Rahu: 3, Ketu: 9, Uranus: 2 }),
};
const TP_DASHA = {
  system: 'tithi_ashtottari', year_used: 2026, valid_from: '2026-02-10 06:00:00', valid_to: '2027-03-01 07:00:00', levels: ['maha', 'bhukti'],
  periods: [
    { lord: 'Sun', level: 1, start: '2026-02-10', end: '2026-06-01', children: [] },
    {
      lord: 'Jupiter', level: 1, start: '2026-06-01', end: '2026-12-20',
      children: [
        { lord: 'Jupiter', level: 2, start: '2026-06-01', end: '2026-09-01', children: [] },
        { lord: 'Saturn', level: 2, start: '2026-09-01', end: '2026-12-20', children: [] },
      ],
    },
    { lord: 'Venus', level: 1, start: '2026-12-20', end: '2027-03-01', children: [] },
  ],
};
const PRASHNA = {
  at_jd: 2461340.1, at_local: '2026-10-24 10:15:00', method: 'moment',
  panchanga: { tithi: { number: 3, name: 'Tritiya', paksha: 'Shukla' }, nakshatra: { number: 10, name: 'Magha', pada: 2, lord: 'Ketu' }, yoga: { name: 'Siddhi' }, karana: { name: 'Bava', lord: 'Sun' }, weekday: { index: 6, name: 'Saturday' }, hora_lord: 'Jupiter' },
  udaya_lagna: { sign: 'Sagittarius' },
  charts: {
    d1: { lagna: { name: 'Lagna', sign: 'Sagittarius', sign_index: 8, nakshatra: 'Moola', house_from_lagna: 1 }, planets: planetRows({ Jupiter: 7, Moon: 10, Venus: 7, Saturn: 4, Sun: 11, Mars: 12, Mercury: 11, Rahu: 3, Ketu: 9 }) },
    d9: { lagna: { name: 'Lagna', sign: 'Aries', sign_index: 0, nakshatra: 'Ashwini', house_from_lagna: 1 }, planets: planetRows({ Jupiter: 5, Moon: 2 }) },
  },
};
const TRANSIT_AT = {
  at_jd: 2461450, at_local: '2027-03-15 12:00:00', divisional_chart_factors: [1, 9, 10],
  charts: {
    d1: { lagna: { sign: 'Gemini' }, planets: planetRows({ Saturn: 3, Jupiter: 5, Rahu: 6, Ketu: 12 }, { natal_house: 7 }) },
    d9: { lagna: { sign: 'Libra' }, planets: planetRows({ Venus: 1 }, { natal_house: 7 }) },
    d10: { lagna: { sign: 'Leo' }, planets: planetRows({ Mercury: 10 }, { natal_house: 10 }) },
  },
};

// ---- helpers ------------------------------------------------------------------------------------------------

async function intentFor(question: string, over: Partial<Intent> = {}): Promise<Intent> {
  return { ...(await runIntake(question, AS_OF, { mode: 'rules' })).intent, ...over };
}

function packsFor(intent: Intent): Record<string, EvidencePack> {
  return Object.fromEntries(intent.subjects.map((s) => [s.id, buildEvidencePack({ dossier, transits, subject: s.id, asOf: AS_OF, intent })]));
}

const usage = { node: 'x', model: 'fake', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 };
const finding = (analyst: SpecialistAnalyst, subject: string, layerScore: number, evidence: string[] = []): { finding: Finding; usage: typeof usage } => ({
  finding: { analyst, subject: subject as Finding['subject'], verdict: layerScore > 0 ? 'strong' : layerScore < 0 ? 'weak' : 'mixed', layerScore, status: 'ok', claims: evidence.length ? [{ text: `${analyst} claim`, evidence, polarity: 'supports', weight: 2, tradition: 'parashara' }] : [], windows: [], caveats: [], keyFacts: [] },
  usage,
});

type Impl = (a: { analyst: SpecialistAnalyst; subject: string; pack: EvidencePack }) => Promise<ReturnType<typeof finding>>;

async function runGraph(intent: Intent, question: string, impl: Impl, layers?: LayerLoaders) {
  const events: ReadingEvent[] = [];
  const synthesize = vi.fn(async (brief: string) => ({ text: brief, usage, ttftMs: 1, finishReason: 'STOP', stoppedForLoop: false }));
  const g = buildReadingGraph({
    intent, question, asOf: AS_OF, system: 'sys', packs: packsFor(intent), keyFacts: 'k', emit: (e) => events.push(e), synthesize,
    specialistImpl: impl as never, dossier, transits, dossierHash: 'h-r28', runId: 'run-r28', ...(layers ? { layers } : {}),
  });
  const out = await g.invoke({});
  const stage = (name: string) => events.filter((e) => e.type === 'stage' && e.name === name);
  return { out, events, stage };
}

const PRASHNA_INTENT = { eligible: true, askedAt: '2026-10-24T04:45:00.000Z', source: 'rules' as const };

beforeEach(() => {
  findingsCache.clear();
  clearChartDataCaches();
});

// ---- 1. eligibility rules -----------------------------------------------------------------------------------

const rule = (q: string, childAge: ClarifyState['childAge'] = null) => {
  const c = classifyRules(q, AS_OF);
  return prashnaRule({ question: q, bucket: c.bucket, unanswerable: c.unanswerable, childAge });
};

describe('prashna eligibility (clarify rules)', () => {
  it.each([
    'Should I accept the job offer?',
    'Will I get the promotion this year?',
    'Is now a good time to buy a house?',
    'Will my visa application be approved?',
    'Can I start my business now?',
    'Should we move abroad next year?',
  ])('eligible: %s', (q) => {
    const r = rule(q);
    expect(r).toMatchObject({ eligible: true, rule: 'eligible', source: 'rules' });
  });

  it.each([
    ['When will I get married?', /kind:timing/],
    ['Why is my career stuck?', /kind:why_meaning/],
    ['What does Sade Sati mean?', /no_life_area|kind:explain_term/],
    ['What will my career look like next year?', /kind:/],
    ['Tell me about my 10th house', /kind:describe/],
  ])('not eligible: %s', (q, why) => {
    const r = rule(q);
    expect(r.eligible).toBe(false);
    expect(r.why).toMatch(why);
  });

  it('a descriptive question that only says "now" is unsure (model planner optional), not eligible on its own', () => {
    expect(rule('Tell me about my career right now')).toMatchObject({ eligible: false, rule: 'unsure' });
  });

  it('declined topics are never eligible, in any category and whatever the role (every built-in example)', () => {
    const examples = BUILTIN_TOPICS.flatMap((t) => t.examples.map((q) => [t, q] as const));
    expect(examples.length).toBeGreaterThan(20);
    for (const [t, q] of examples) {
      const r = rule(q);
      expect(r.eligible, `${t.id}: ${q}`).toBe(false);
      expect(r.rule, `${t.id}: ${q}`).toBe('not_eligible');
    }
    // role-gated health stays ineligible even though a doctor role could discuss it
    expect(rule('Will my surgery go well?').why).toMatch(/^declined:health/);
    expect(rule('Will I win the lottery this month?').why).toMatch(/^declined:|^policy:|^speculation$/);
    expect(rule('Will I stay healthy this year?').eligible).toBe(false);
  });

  it('a question about an adult child (age confirmed) can be eligible; unconfirmed it cannot', () => {
    expect(rule('Will my daughter get married soon?').eligible).toBe(false);
    expect(rule('Will my daughter get married soon?', 'adult').eligible).toBe(true);
  });

  it('confirming marks the state and keeps the confirmation moment; an edit re-proposes without marking', () => {
    const q = 'Should I change jobs this year?';
    const s = startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode: 'always', threshold: 0.7, now: 0 });
    expect(s.status).toBe('PROPOSED');
    const edited = confirmClarify(s, { horizon: '3m' }, 5);
    expect(edited.status).toBe('PROPOSED');
    expect(edited.prashna).toBeUndefined();
    const c = confirmClarify(s, {}, 1_790_000_000_000);
    expect(c.status).toBe('CONFIRMED');
    expect(c.prashna).toMatchObject({ eligible: true, source: 'rules' });
    expect(c.confirmedAt).toBe(1_790_000_000_000);
  });

  it('the confirmed intent carries prashna_eligible and the moment it was confirmed', async () => {
    const store = new MemoryClarifyStore();
    const q = 'Should I change jobs this year?';
    const s = startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode: 'always', threshold: 0.7, now: Date.now() });
    const runId = await store.create('u1', s);
    const c = await confirmAndBuildIntent(store, 'u1', runId);
    if ('error' in c) throw new Error(c.error);
    expect(c.intent?.prashna?.eligible).toBe(true);
    expect(c.intent?.prashna?.askedAt).toBe(new Date(c.state.confirmedAt!).toISOString());
    const timing = startClarify('When will I get married?', AS_OF, classifyRules('When will I get married?', AS_OF), { mode: 'never', threshold: 0.7, now: Date.now() });
    const r2 = await confirmAndBuildIntent(store, 'u1', await store.create('u1', timing));
    if ('error' in r2) throw new Error(r2.error);
    expect(r2.intent?.prashna?.eligible).toBe(false);
  });

  describe('model planner for unsure questions', () => {
    const send = vi.fn();
    const reply = (text: string) => ({ output: { message: { role: 'assistant', content: [{ text }] } }, usage: { inputTokens: 100, outputTokens: 5, totalTokens: 105 } });
    beforeEach(() => {
      process.env.READING_MODEL_CLARIFY = 'bedrock:openai.gpt-oss-120b-1:0';
      setBedrockClientForTests({ send });
      send.mockReset();
    });
    afterEach(() => {
      delete process.env.READING_MODEL_CLARIFY;
      setBedrockClientForTests(null);
    });
    const unsureState = (): ClarifyState => {
      const q = 'Tell me about my career right now';
      return { ...startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode: 'always', threshold: 0.7, now: 0 }), status: 'CONFIRMED' };
    };
    it('an unsure rule asks the model once and takes its yes', async () => {
      send.mockResolvedValue(reply('{"eligible": true}'));
      const s = unsureState();
      const { result } = await judgePrashna(s, rule(s.question));
      expect(send).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ eligible: true, source: 'model' });
    });
    it('a ruled-out question never reaches the model; bad model output keeps the rules', async () => {
      const s = unsureState();
      await judgePrashna(s, rule('Will my surgery go well?'));
      expect(send).not.toHaveBeenCalled();
      send.mockResolvedValue(reply('maybe'));
      expect((await judgePrashna(s, rule(s.question))).result.eligible).toBe(false);
    });
  });
});

// ---- 2. annual layer ----------------------------------------------------------------------------------------

describe('annual (Tithi Pravesh) specialist', () => {
  it('applies only when the horizon ends within about 12 months', async () => {
    const i = await intentFor('Should I change jobs?');
    expect(annualApplies({ ...i, horizon: '6m' }, AS_OF)).toBe(true);
    expect(annualApplies({ ...i, horizon: '1y' }, AS_OF)).toBe(true);
    expect(annualApplies({ ...i, horizon: { from: AS_OF, to: '2027-08-31' } }, AS_OF)).toBe(true);
    expect(annualApplies({ ...i, horizon: '3y' }, AS_OF)).toBe(false);
    expect(annualApplies({ ...i, horizon: 'life' }, AS_OF)).toBe(false);
    expect(annualApplies({ ...i, horizon: { from: AS_OF, to: '2028-06-30' } }, AS_OF)).toBe(false);
  });

  it('section: year chart with houses as Radha counted them, the running period with its sub-period, periods in the horizon', () => {
    const s = annualSection({ chart: TP_CHART, dasha: TP_DASHA, asOf: AS_OF, horizon: { from: AS_OF, to: '2027-04-24' }, dossier }) as any;
    expect(s.year_used).toBe(2026);
    expect(s.chart.bodies.Ju).toMatchObject({ h: 7, sign: 'Leo' });
    expect(s.chart.bodies.Uranus).toBeUndefined();
    expect(s.chart.occupants['7'].sort()).toEqual(['Ju', 'Mo']);
    expect(s.chart.lagna.lord).toBe('Me'); // Gemini's lord, as the dossier pairs them
    expect(s.dasha.running).toEqual({ lord: 'Ju', from: '2026-06-01', to: '2026-12-20', sub: { lord: 'Sa', from: '2026-09-01', to: '2026-12-20' } });
    expect(Object.keys(s.dasha.periods)).toEqual(['Ju_2026-06-01', 'Sa_2026-09-01', 'Ve_2026-12-20']);
    expect(annualSection({ chart: null, dasha: null, asOf: AS_OF, horizon: { from: AS_OF, to: '2027-01-01' } })).toBeNull();
    expect((annualSection({ chart: TP_CHART, dasha: null, asOf: AS_OF, horizon: { from: AS_OF, to: '2027-01-01' } }) as any).missing).toEqual(['Tithi Pravesh year dasha']);
  });

  it('runs within 12 months (weight 1 as L5), optional, never retried, not cached; its claims stay grounded', async () => {
    const intent = await intentFor('Should I change jobs in the next 6 months?');
    const annual = vi.fn(async () => ({ chart: TP_CHART, dasha: TP_DASHA }));
    const seen: string[] = [];
    const impl: Impl = async ({ analyst, subject, pack }) => {
      if (analyst === 'annual') seen.push(renderSubject(pack, 'annual'));
      return finding(analyst, subject, analyst === 'annual' ? 2 : 1, analyst === 'annual' ? ['annual.chart.bodies.Ju.h', 'annual.dasha.running.lord'] : []);
    };
    const { out, stage } = await runGraph(intent, 'Should I change jobs in the next 6 months?', impl, { annual });
    expect(annual).toHaveBeenCalledTimes(1);
    expect(seen[0]).toMatch(/"annual":\{"year_used":2026/);
    const f = out.reconciled!.findings.find((x) => x.analyst === 'annual')!;
    expect(f.claims[0]!.evidence).toEqual(['annual.chart.bodies.Ju.h', 'annual.dasha.running.lord']);
    expect(out.reconciled!.layers.L5).toBe(2);
    expect(out.reconciled!.verdict.score).toBe(3 * 1 + 2 * 1 + 2 * 1 + 1 * 2);
    expect(stage('annual').at(-1)).toMatchObject({ status: 'done', retried: false, capped: false });
    expect(out.reconciled!.brief).toMatch(/"layer":"annual"/);
    // a second run fetches and reads again (the year layer is not in the findings cache)
    await runGraph(intent, 'Should I change jobs in the next 6 months?', impl, { annual });
    expect(annual).toHaveBeenCalledTimes(2);
  });

  it('is not offered for a 3-year question', async () => {
    const intent = await intentFor('Will I get married in the next 3 years?');
    const annual = vi.fn(async () => ({ chart: TP_CHART, dasha: TP_DASHA }));
    const impl = vi.fn<Impl>(async ({ analyst, subject }) => finding(analyst, subject, 1));
    const { stage } = await runGraph(intent, 'Will I get married in the next 3 years?', impl, { annual });
    expect(annual).not.toHaveBeenCalled();
    expect(stage('annual')).toHaveLength(0);
    expect(impl.mock.calls.map((c) => c[0].analyst)).not.toContain('annual');
  });

  it('missing data: skipped with reason no_data, no model call, no retry, no cap', async () => {
    const intent = await intentFor('Should I change jobs in the next 6 months?');
    const impl = vi.fn<Impl>(async ({ analyst, subject }) => finding(analyst, subject, 1));
    const { out, stage } = await runGraph(intent, 'Should I change jobs in the next 6 months?', impl, { annual: async () => null });
    expect(impl.mock.calls.map((c) => c[0].analyst)).not.toContain('annual');
    expect(stage('annual').at(-1)).toMatchObject({ status: 'skipped', reason: 'no_data', retried: false, capped: false });
    expect(out.failed).toEqual([]);
    expect(out.reconciled!.layers.L5).toBeUndefined();
  });

  it('a failing annual model call is skipped after one attempt', async () => {
    const intent = await intentFor('Should I change jobs in the next 6 months?');
    let calls = 0;
    const impl: Impl = async ({ analyst, subject }) => {
      if (analyst === 'annual') {
        calls += 1;
        throw new Error('model down');
      }
      return finding(analyst, subject, 1);
    };
    const { stage } = await runGraph(intent, 'q', impl, { annual: async () => ({ chart: TP_CHART, dasha: TP_DASHA }) });
    expect(calls).toBe(1);
    expect(stage('annual').at(-1)).toMatchObject({ status: 'skipped', reason: 'model_error', retried: false, capped: false });
  });

  it('loader against fake Radha: unserved types are never requested; served ones read the current year with system tithi_ashtottari', async () => {
    const radha = vi.fn(async (_req: KundliRequest, type: string, _extra: Record<string, unknown>) => (type === 'annual.tithi_pravesha' ? TP_CHART : TP_DASHA));
    const unserved = memRepo([]);
    expect(await layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: unserved, fetcher: radha }).annual!()).toBeNull();
    expect(radha).not.toHaveBeenCalled();
    clearChartDataCaches();
    const served = memRepo(['annual.tithi_pravesha', 'annual.tithi_pravesha_dasha']);
    const data = await layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: served, fetcher: radha, now: () => Date.parse('2026-10-24T06:00:00Z') }).annual!();
    expect(data).toEqual({ chart: TP_CHART, dasha: TP_DASHA });
    const dashaCall = radha.mock.calls.find((c) => c[1] === 'annual.tithi_pravesha_dasha')!;
    expect(dashaCall[2]).toEqual({ at: '2026-10-24', params: { system: 'tithi_ashtottari' } });
  });
});

// ---- 3. prashna layer ---------------------------------------------------------------------------------------

describe('prashna specialist', () => {
  it('runs only for an eligible confirmed question, and never for a declined topic', async () => {
    const i = await intentFor('Should I accept the job offer?');
    expect(prashnaApplies(i, 'Should I accept the job offer?')).toBe(false);
    expect(prashnaApplies({ ...i, prashna: PRASHNA_INTENT }, 'Should I accept the job offer?')).toBe(true);
    expect(prashnaApplies({ ...i, prashna: { ...PRASHNA_INTENT, eligible: false } }, 'Should I accept the job offer?')).toBe(false);
    expect(prashnaApplies({ ...i, prashna: PRASHNA_INTENT }, 'Will my surgery go well?')).toBe(false);
    expect(prashnaApplies({ ...i, prashna: PRASHNA_INTENT }, 'Which gemstone should I wear?')).toBe(false);
    const layers = { prashna: vi.fn(), annual: vi.fn() } as unknown as LayerLoaders;
    expect(optionalLayersFor({ intent: { ...i, horizon: '3y', prashna: PRASHNA_INTENT }, asOf: AS_OF, question: 'When will I die?', layers })).toEqual([]);
  });

  it('a prashna-eligible question is not sent down the fast lane (the graph casts the prashna)', async () => {
    const i = await intentFor('Will I get the promotion?', { horizon: '3m', questionType: 'yes_no' });
    expect(isFastLane(i)).toBe(true);
    expect(isFastLane({ ...i, prashna: PRASHNA_INTENT })).toBe(false);
    expect(isFastLane({ ...i, prashna: { ...PRASHNA_INTENT, eligible: false } })).toBe(true);
  });

  it('section: prashna lagna and its lord, the Moon, the house of the matter from the prashna lagna, the panchanga', () => {
    const s = prashnaSection({ payload: PRASHNA, frameHouses: [7, 2, 11], placeSource: 'current', dossier }) as any;
    expect(s.lagna).toMatchObject({ sign: 'Sagittarius', nak: 'Moola', lord: 'Ju' });
    expect(s.lagna_lord).toMatchObject({ planet: 'Ju', h: 7 });
    expect(s.moon).toMatchObject({ h: 10 });
    expect(s.matter['7']).toMatchObject({ occupants: ['Ju', 'Ve'], sign: 'Leo', lord: 'Su' });
    expect(s.matter['2']).toEqual({ occupants: [] }); // empty house: no sign or lord is derived
    expect(s.panchanga).toEqual({ tithi: { name: 'Tritiya', paksha: 'Shukla', number: 3 }, nakshatra: { name: 'Magha', pada: 2, lord: 'Ke' }, yoga: { name: 'Siddhi' }, karana: { name: 'Bava', lord: 'Su' }, weekday: 'Saturday', hora_lord: 'Ju' });
    expect(s.d9.bodies.Ju.h).toBe(5);
  });

  it('is cast once at the confirmation moment at the current location; then read with weight 1 as L6', async () => {
    const intent = await intentFor('Should I accept the job offer?', { horizon: '3y', prashna: PRASHNA_INTENT, questionPlace: { lat: 18.52, lon: 73.86, tz: 5.5 } });
    const prashna = vi.fn(async () => ({ payload: PRASHNA, placeSource: 'current' as const }));
    const impl: Impl = async ({ analyst, subject }) => finding(analyst, subject, analyst === 'prashna' ? 2 : 1, analyst === 'prashna' ? ['prashna.lagna_lord.h', 'prashna.moon.h'] : []);
    const { out, stage } = await runGraph(intent, 'Should I accept the job offer?', impl, { prashna });
    expect(prashna).toHaveBeenCalledTimes(1);
    expect(prashna).toHaveBeenCalledWith({ at: '2026-10-24T04:45:00.000Z', place: { lat: 18.52, lon: 73.86, tz: 5.5 }, runId: 'run-r28' });
    expect(out.reconciled!.layers.L6).toBe(2);
    expect(out.reconciled!.findings.find((f) => f.analyst === 'prashna')!.claims[0]!.evidence).toEqual(['prashna.lagna_lord.h', 'prashna.moon.h']);
    expect(stage('prashna').at(-1)).toMatchObject({ status: 'done', retried: false, capped: false });
  });

  it('without a current location the loader is asked for none (birth place); no data means skipped no_data', async () => {
    const intent = await intentFor('Should I accept the job offer?', { horizon: '3y', prashna: PRASHNA_INTENT });
    const prashna = vi.fn(async (_a: { at: string; place: unknown; runId?: string | null }) => null);
    const { stage } = await runGraph(intent, 'Should I accept the job offer?', async ({ analyst, subject }) => finding(analyst, subject, 1), { prashna });
    expect(prashna.mock.calls[0]![0]).toMatchObject({ place: null });
    expect(stage('prashna').at(-1)).toMatchObject({ status: 'skipped', reason: 'no_data', retried: false, capped: false });
  });

  it('loader against fake Radha: current location first, then the birth place; unserved type never called', async () => {
    const rows: PrashnaCastRow[] = [];
    const prashnaRepo: PrashnaRepo = {
      birth: async () => ({ kundliId: 'k1', req: { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN' }, coords: { lat: 28.613939, lon: 77.209023, tz: 5.5 } }, placeResolved: 'Delhi, India' }),
      insertCast: async (r) => (rows.push(r), { id: `c${rows.length}` }),
    };
    const placeFetcher = vi.fn(async (_t: string, _f: Record<string, unknown>) => PRASHNA);
    expect(await layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: memRepo([]), prashnaRepo, placeFetcher }).prashna!({ at: PRASHNA_INTENT.askedAt, place: null })).toBeNull();
    expect(placeFetcher).not.toHaveBeenCalled();
    clearChartDataCaches();
    const loaders = layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: memRepo(['prashna']), prashnaRepo, placeFetcher });
    const current = await loaders.prashna!({ at: PRASHNA_INTENT.askedAt, place: { lat: 18.520431, lon: 73.856743, tz: 5.5 }, runId: 'r1' });
    expect(current).toEqual({ payload: PRASHNA, placeSource: 'current' });
    expect(placeFetcher.mock.calls[0]).toEqual(['prashna', { lat: 18.52, lon: 73.86, tz: 5.5, at: PRASHNA_INTENT.askedAt }]);
    const birth = await loaders.prashna!({ at: PRASHNA_INTENT.askedAt, place: null, runId: 'r1' });
    expect(birth?.placeSource).toBe('birth');
    expect(placeFetcher.mock.calls[1]![1]).toEqual({ lat: 28.61, lon: 77.21, tz: 5.5, at: PRASHNA_INTENT.askedAt });
    expect(rows.map((r) => [r.placeSource, r.readingRunId])).toEqual([['current', 'r1'], ['birth', 'r1']]);
  });
});

// ---- 4. a prashna vote alone cannot decide --------------------------------------------------------------------

describe('convergence: the prashna is one vote', () => {
  it('alone it pulls a not-indicated verdict to mixed at most, and a positive one down by one step at most', () => {
    expect(prashnaNudge('not_indicated', { L1: 0, L2: 0, L3: -1, L6: 3 })).toMatchObject({ level: 'mixed' });
    expect(prashnaNudge('strong', { L1: 2, L2: 2, L3: 1, L6: -3 })).toMatchObject({ level: 'moderate' });
    expect(prashnaNudge('moderate', { L1: 2, L2: 1, L3: 0, L6: -3 })).toMatchObject({ level: 'mixed' });
    expect(prashnaNudge('mixed', { L1: 1, L6: -3 })).toMatchObject({ level: 'mixed', note: null });
  });
  it('with a natal layer on its side it moves one step', () => {
    expect(prashnaNudge('weak', { L1: 1, L2: 0, L3: 0, L6: 2 })).toMatchObject({ level: 'moderate' });
    expect(prashnaNudge('moderate', { L1: 2, L2: 1, L3: -1, L6: -2 })).toMatchObject({ level: 'weak' });
    expect(prashnaNudge('not_indicated', { L1: 0, L4: 1, L6: 1 })).toMatchObject({ level: 'weak' });
  });
  it('never overrides a chart that denies the result, and ignores a balanced prashna', () => {
    expect(prashnaNudge('not_indicated', { L1: -2, L6: 3 })).toEqual({ level: 'not_indicated', note: null });
    expect(prashnaNudge('weak', { L1: 1, L6: 0 })).toEqual({ level: 'weak', note: null });
  });
  it('the missing-layer cap still applies after the nudge', () => {
    const v = convergence({ L1: 2, L2: 2, L6: 3 }, { transitRequired: true, missingRequired: ['L3'] });
    expect(v.level).toBe('weak');
    expect(v.caps.join(' ')).toMatch(/missing L3/);
  });
  it('end to end: natal layers that do not indicate the result plus a strong prashna yes give mixed, not moderate or strong', async () => {
    const intent = await intentFor('Should I accept the job offer?', { horizon: '3y', prashna: PRASHNA_INTENT });
    const impl: Impl = async ({ analyst, subject }) => finding(analyst, subject, analyst === 'prashna' ? 3 : analyst === 'promise' ? 0 : -1);
    const { out } = await runGraph(intent, 'Should I accept the job offer?', impl, { prashna: async () => ({ payload: PRASHNA, placeSource: 'birth' }) });
    expect(out.reconciled!.layers.L6).toBe(3);
    expect(out.reconciled!.verdict.level).toBe('mixed');
    expect(out.reconciled!.brief).toMatch(/VERDICT: mixed \(.*prashna raised not_indicated to mixed without a natal layer/);
  });
});

// ---- 5. transit at the asked date -----------------------------------------------------------------------------

describe('transit specialist at the asked date', () => {
  it('a date-specific question has an asked date; closed horizons and windows from today do not', async () => {
    const i = await intentFor('Will I get married?');
    expect(transitAskedAt({ ...i, horizon: { from: '2027-03-15', to: '2027-03-31' } }, AS_OF)).toBe('2027-03-15 12:00:00');
    expect(transitAskedAt({ ...i, horizon: { from: AS_OF, to: '2026-12-31' } }, AS_OF)).toBeNull();
    expect(transitAskedAt({ ...i, horizon: '6m' }, AS_OF)).toBeNull();
  });

  it('reads D-1, D-9 and D-10 at the asked date instead of today; one Radha call per run; not cached', async () => {
    const intent = await intentFor('Will I get married in March 2027?', { horizon: { from: '2027-03-15', to: '2027-03-31' } });
    const transitAt = vi.fn(async () => TRANSIT_AT);
    const packs: string[] = [];
    const impl: Impl = async ({ analyst, subject, pack }) => {
      if (analyst === 'transit') packs.push(renderSubject(pack, 'transit'));
      return finding(analyst, subject, 1, analyst === 'transit' ? ['transit_at.charts.D1.bodies.Sa.natal_h'] : []);
    };
    const { out } = await runGraph(intent, 'Will I get married in March 2027?', impl, { transitAt });
    expect(transitAt).toHaveBeenCalledTimes(1);
    expect(transitAt).toHaveBeenCalledWith('2027-03-15 12:00:00');
    const t = JSON.parse(packs[0]!);
    expect(t.transit_at.at).toBe('2027-03-15 12:00:00');
    expect(Object.keys(t.transit_at.charts)).toEqual(['D1', 'D9', 'D10']);
    expect(t.transit_at.charts.D1.bodies.Sa).toMatchObject({ h: 3, natal_h: 7 });
    expect(out.reconciled!.findings.find((f) => f.analyst === 'transit')!.claims[0]!.evidence).toEqual(['transit_at.charts.D1.bodies.Sa.natal_h']);
    await runGraph(intent, 'Will I get married in March 2027?', impl, { transitAt });
    expect(transitAt).toHaveBeenCalledTimes(2);
  });

  it('no transit data at the asked date: the transit specialist still runs on the horizon rows', async () => {
    const intent = await intentFor('Will I get married in March 2027?', { horizon: { from: '2027-03-15', to: '2027-03-31' } });
    const packs: string[] = [];
    const { stage } = await runGraph(intent, 'q', async ({ analyst, subject, pack }) => {
      if (analyst === 'transit') packs.push(renderSubject(pack, 'transit'));
      return finding(analyst, subject, 1);
    }, { transitAt: async () => null });
    expect(JSON.parse(packs[0]!).transit_at).toBeUndefined();
    expect(stage('transit').at(-1)).toMatchObject({ status: 'done' });
  });

  it('loader against fake Radha: factors [1, 9, 10] at the asked date with the natal houses', async () => {
    const radha = vi.fn(async (_req: KundliRequest, _type: string, _extra: Record<string, unknown>) => TRANSIT_AT);
    expect(await layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: memRepo([]), fetcher: radha }).transitAt!('2027-03-15 12:00:00')).toBeNull();
    expect(radha).not.toHaveBeenCalled();
    clearChartDataCaches();
    const out = await layerLoaders({ userId: 'u1', kundliId: 'k1', chartRepo: memRepo(['transit']), fetcher: radha }).transitAt!('2027-03-15 12:00:00');
    expect(out).toBe(TRANSIT_AT);
    expect(radha.mock.calls[0]![1]).toBe('transit');
    expect(radha.mock.calls[0]![2]).toMatchObject({ at: '2027-03-15 12:00:00', divisional_chart_factors: [1, 9, 10], natal_dob: '1990-01-01', natal_tob: '10:00:00' });
    expect(transitAtSection({ payload: { charts: {} }, at: 'x' })).toBeNull();
  });
});

// ---- 6. prompts and the real specialist call against the fake Gemini ------------------------------------------

describe('annual and prashna prompts', () => {
  it('exist, are English, forbid remedies, and the specialist sends only its own section', async () => {
    for (const k of ['annual', 'prashna']) {
      expect(PROMPTS[k]).toMatch(/No remedies/);
      expect(PROMPTS[k]).not.toMatch(/[^\x00-\x7F]/);
    }
    const fake = await startFakeGemini();
    const env = { GEMINI_API_URL: process.env.GEMINI_API_URL, GEMINI_API_KEY: process.env.GEMINI_API_KEY, READING_MODEL_SPECIALIST: process.env.READING_MODEL_SPECIALIST };
    try {
      Object.assign(process.env, { GEMINI_API_URL: fake.url, GEMINI_API_KEY: 'k', READING_MODEL_SPECIALIST: 'gemini-2.5-flash' });
      const intent = await intentFor('Should I accept the job offer?', { prashna: PRASHNA_INTENT });
      const base = packsFor(intent)[intent.subjects[0]!.id]!;
      const section = prashnaSection({ payload: PRASHNA, frameHouses: base.keyFrame.houses, placeSource: 'current', dossier });
      const pack = { ...base, sections: { ...base.sections, prashna: section } };
      const r = await runSpecialist({ analyst: 'prashna', subject: intent.subjects[0]!.id, pack, intent, question: 'Should I accept the job offer?', system: 'sys', asOf: AS_OF });
      expect(r.finding.analyst).toBe('prashna');
      const text = fake.requests.at(-1)!.body.contents[0].parts.map((p: { text: string }) => p.text).join('\n');
      expect(text).toMatch(/ANALYST: prashna/);
      expect(text).toMatch(/"prashna":\{"at_local"/);
      expect(text).not.toMatch(/"transits":/);
      expect(text).toMatch(/3 to 6 claims|at most 6 claims/);
    } finally {
      await fake.close();
      for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
});

// ---- in-memory chart-data repo (catalog rows mark which types are served) -------------------------------------

function memRepo(servedIds: string[]): ChartDataRepo {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const catalog: ChartTypeRow[] = BUILTIN_CHART_TYPES.filter((t) => servedIds.includes(t.id)).map((t) => ({
    id: t.id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: true,
    calc_version: t.calcVersion, legacy_column: t.legacyColumn ?? null, sort_order: t.sortOrder, label: t.label, enabled: true,
  }));
  return {
    loadTypes: async () => catalog,
    readRows: async (_id, keys) => keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r)),
    readLegacy: async () => ({}),
    claim: async (_id, key, params) => {
      rows.set(k(key), { ...key, params, status: 'fetching', payload: null, calcVersion: null, error: null, fetchStartedAt: new Date(), fetchedAt: null, validTo: null });
      return true;
    },
    complete: async (_id, key, _ay, result: FetchResult) => {
      rows.set(k(key), { ...key, params: result.params ?? {}, calcVersion: result.calcVersion, payload: result.payload ?? null, status: result.status, error: result.error ?? null, fetchStartedAt: null, fetchedAt: new Date(), validTo: result.validTo ?? null });
    },
    kundliRequest: async () => ({ params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN' }, coords: { lat: 28.6, lon: 77.2, tz: 5.5 } }),
  };
}
