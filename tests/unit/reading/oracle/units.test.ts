import { describe, expect, it, vi } from 'vitest';
import { countLayers, groundReader, layerOf, type GroundedReader } from '../../../../src/reading/oracle/brief.js';
import { ReadingJournal } from '../../../../src/reading/oracle/journal.js';
import { planBRoute } from '../../../../src/reading/oracle/planB.js';
import { fetchPlan, joinDeadlineMs, personIn, planReaders, READERS, readerTimeoutMs, tierFor, type ReaderId } from '../../../../src/reading/oracle/readers.js';
import { readerFindingZ, type ReaderOutput } from '../../../../src/reading/oracle/runReader.js';
import { validateByRules } from '../../../../src/reading/oracle/validator.js';
import { scrubEngineNames, oracleBudget } from '../../../../src/reading/oracle/flow.js';
import { inferRealWant } from '../../../../src/reading/clarify/realWant.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import type { Intent } from '../../../../src/reading/types.js';

const AS_OF = '2026-11-01';
const intent = (over: Partial<Intent>): Intent => ({ subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', questionType: 'describe', format: 'direct', focusPoints: [], mentionsPlanets: [], confidence: 1, clarifyText: '', followUps: [], safety: 'ok', ...over });
const finding = (over: Partial<ReaderOutput>): ReaderOutput => readerFindingZ.parse({ verdict: 'moderate', layerScore: 1, digest: 'read it', claims: [], ...over });

describe('readers', () => {
  it('every reader has a curriculum, and no prompt names the engine', () => {
    for (const r of Object.values(READERS)) expect(PROMPTS[r.promptKey], r.id).toBeTruthy();
    for (const [k, t] of Object.entries(PROMPTS).filter(([k]) => k.startsWith('readers/') || k.startsWith('oracle/'))) {
      expect(t, k).not.toMatch(/radha|pyjhora|jhora/i);
    }
  });

  it('no reader prompt asks for a probability, and only the remedy reader gives practices', () => {
    for (const k of ['readers/P1-pressure', 'readers/P2-mood', 'readers/P3-luck']) expect(PROMPTS[k]).not.toMatch(/\d+\s?%/);
  });

  it('the tier comes from the question, by rule', () => {
    expect(tierFor(intent({ horizon: 'life' }), 'read my life')).toBe(1);
    expect(tierFor(intent({ questionType: 'why_meaning' }), 'why is this happening')).toBe(2);
    expect(tierFor(intent({}), 'how is my mother')).toBe(2);
    expect(tierFor(intent({ horizon: '3m' }), 'what about this quarter')).toBe(5);
    expect(tierFor(intent({ questionType: 'timing' }), 'when will I move')).toBe(4);
    expect(tierFor(intent({}), 'tell me about my career')).toBe(3);
  });

  it('plans the tier 3 set, with the timing and house readers holding the join', () => {
    const p = planReaders({ intent: intent({}), question: 'tell me about my career', asOf: AS_OF });
    expect(p.ids).toEqual(['R01', 'R02', 'R03', 'R08', 'R10']);
    expect([...p.required].sort()).toEqual(['R02', 'R08', 'R10']);
  });

  it('adds the person reader when someone is named, and transit is not required past 3 years', () => {
    const p = planReaders({ intent: intent({ horizon: { from: '2026-11-01', to: '2032-11-01' } }), question: 'what about my father in my whole life', asOf: AS_OF });
    expect(p.ids).toContain('R13');
    expect(personIn('my wife')?.person).toBe('spouse');
    expect(p.required.has('R10')).toBe(false);
  });

  it('keeps the remedy reader off by default', () => {
    expect(planReaders({ intent: intent({}), question: 'q', asOf: AS_OF, realWant: 'what_can_i_do' }).ids).not.toContain('R14');
  });

  it('fetches only what the planned readers need', () => {
    const plan = fetchPlan(['R08'] as ReaderId[], { vargas: ['varga.d10'], person: null });
    expect(plan).toContain('dasha.vimsottari');
    expect(plan).toContain('varga.d1');
    expect(plan).not.toContain('varga.d10');
    expect(fetchPlan(['R03'], { vargas: ['varga.d10'], person: null })).toEqual(expect.arrayContaining(['varga.d10', 'arudhas.d10', 'varga.d9', 'varga.d30']));
  });

  it('a slower model gets more time, so a model swap cannot cause time-outs', () => {
    const def = READERS.R08;
    expect(readerTimeoutMs(def, 'gemini-3.1-flash-lite')).toBe(5_000);
    expect(readerTimeoutMs(def, 'gemini-3.8-flash')).toBeGreaterThan(10_000);
    expect(joinDeadlineMs(3, ['R08'], 'gemini-3.1-flash-lite')).toBe(6_000);
    expect(joinDeadlineMs(1, ['R08'], 'gemini-3.1-flash-lite')).toBe(8_000);
  });

  it('a direct question gets a word target and a prewarmed one keeps its template length', () => {
    expect(oracleBudget(3, false).wordTarget).toBe(280);
    expect(oracleBudget(3, true).wordTarget).toBeNull();
    expect(oracleBudget(1, false).wordTarget).toBe(2_500);
  });
});

describe('Plan B routes', () => {
  it('routes by cue and adds its reader', () => {
    expect(planBRoute('why do I feel so anxious lately')?.route).toBe('pressure');
    expect(planBRoute('how is my mood today')?.route).toBe('mood');
    expect(planBRoute('am I lucky right now')?.route).toBe('luck');
    expect(planBRoute('will I get the job by March')?.route).toBe('will_it_happen');
    expect(planBRoute('tell me about my career')).toBeNull();
    expect(planReaders({ intent: intent({}), question: 'x', asOf: AS_OF, route: planBRoute('why do I feel so anxious') }).ids).toContain('P1');
  });

  it('a prediction is told to give strength words and no probability', () => {
    expect(planBRoute('will I get the job by March')?.note).toMatch(/never give a percentage/i);
  });
});

describe('real want', () => {
  it('reads the words of the question by bucket, then in general', () => {
    expect(inferRealWant('should I change my job', 'career_job')?.id).toBe('should_i_move');
    expect(inferRealWant('should I change my job', 'career_job')?.sensitive).toMatch(/fired/);
    expect(inferRealWant('why is everything so slow', undefined)?.id).toBe('why_now');
    expect(inferRealWant('tell me about Saturn', 'career_job')).toBeNull();
  });
});

describe('grounding and layer counting', () => {
  const sections = { dignities: { planets: { Saturn: { dignity: 'Exalted' } } }, varga_d9: { Saturn: { rasi: 'Libra' } }, dasha_vimsottari: { periods: { Sa_2020: { end: '2039' } } }, transits: { now: { Sa: 1 } } };
  const claim = (over: object) => ({ text: 'Saturn holds the chart here.', evidence: [], polarity: 'supports', weight: 2, tradition: 'parashara', about: 'self', topic: 'Saturn', kind: 'holds', ...over });

  it('drops a claim whose evidence does not resolve, and a quote whose value differs', () => {
    const g = groundReader('R01', 'career_work', finding({ claims: [claim({ evidence: ['nope.x'] }), claim({ evidence: ['dignities.planets.Saturn.dignity', 'nope.x'] })], quotes: [{ id: 'dignities.planets.Saturn.dignity', value: 'Debilitated' }, { id: 'dignities.planets.Saturn.dignity', value: 'Exalted' }] } as Partial<ReaderOutput>), sections);
    expect(g.finding.claims).toHaveLength(1);
    expect(g.finding.claims[0]!.evidence).toEqual(['dignities.planets.Saturn.dignity']);
    expect(g.droppedClaims).toBe(1);
    expect(g.finding.quotes).toHaveLength(1);
    expect(g.droppedQuotes).toBe(1);
  });

  it('maps evidence ids to data families', () => {
    expect(layerOf('dignities.planets.Saturn.dignity')).toBe('d1');
    expect(layerOf('varga_d9.Saturn.rasi')).toBe('varga_d9');
    expect(layerOf('arudhas.bhava_arudhas.A7.sign')).toBe('jaimini');
    expect(layerOf('dasha_vimsottari.periods.x')).toBe('vimshottari');
    expect(layerOf('dasha_yogini.periods.x')).toBe('dasha_yogini');
    expect(layerOf('transits.now.Sa')).toBe('transit');
    expect(layerOf('annual_sahams.x')).toBe('annual');
    expect(layerOf('varga_d1.Sun.nakshatra', 'nakshatra')).toBe('nakshatra');
  });

  it('counts distinct layers, so one reader repeating itself cannot make a finding', () => {
    const r = (id: ReaderId, evidence: string[]): GroundedReader => ({ id, subject: 'career_work', droppedClaims: 0, droppedQuotes: 0, finding: finding({ claims: [claim({ evidence })] } as Partial<ReaderOutput>) });
    const same = countLayers([r('R01', ['dignities.planets.Saturn.dignity']), r('R05', ['dignities.planets.Saturn.dignity'])]);
    expect(same[0]!.layers).toEqual(['d1']);
    const many = countLayers([r('R01', ['dignities.planets.Saturn.dignity']), r('R03', ['varga_d9.Saturn.rasi']), r('R08', ['dasha_vimsottari.periods.Sa_2020.end'])]);
    expect(many[0]!.layers).toHaveLength(3);
  });

  it('keeps opposite statements about one planet apart', () => {
    const r = (polarity: string): GroundedReader => ({ id: 'R01', subject: 'career_work', droppedClaims: 0, droppedQuotes: 0, finding: finding({ claims: [claim({ polarity, evidence: ['dignities.planets.Saturn.dignity'] })] } as Partial<ReaderOutput>) });
    expect(countLayers([r('supports'), r('obstructs')])).toHaveLength(2);
  });
});

describe('journal', () => {
  const id = { runId: 'run1', userId: 'u1', question: 'q', tier: 3, promptVersion: 'v', asOf: AS_OF };
  const usage = { node: 'R01', model: 'gemini-3.1-flash-lite', promptTokens: 1000, cachedTokens: 0, outputTokens: 100, thoughtTokens: 0, ms: 1 };

  it('holds responses in memory and writes one row each, only when flushed', async () => {
    const j = new ReadingJournal(id);
    j.record({ agent: 'R01', agentKind: 'reader', round: 1, promptSent: 'curriculum', digest: { how: 'x' }, highlights: { claims: [] }, status: 'ok', source: 'live', usage });
    j.record({ agent: 'oracle', agentKind: 'oracle', round: 1, status: 'ok', source: 'live' });
    const write = vi.fn(async () => undefined);
    expect(write).not.toHaveBeenCalled();
    expect(await j.flush(write, { chatId: 'c', messageId: 'm' })).toBe(2);
    const rows = (write.mock.calls[0] as unknown as [Array<Record<string, unknown>>])[0];
    expect(rows[0]).toMatchObject({ run_id: 'run1', agent: 'R01', agent_kind: 'reader', prompt_sent: 'curriculum', chat_id: 'c', message_id: 'm', prompt_tokens: 1000 });
    expect(rows[0]!.cost_usd).toBeCloseTo((1000 * 0.25 + 100 * 1.5) / 1e6, 8);
  });

  it('writes once, even when flushed twice', async () => {
    const j = new ReadingJournal(id);
    j.record({ agent: 'R01', agentKind: 'reader', round: 1, status: 'ok', source: 'live' });
    const write = vi.fn(async () => undefined);
    await j.flush(write);
    expect(await j.flush(write)).toBe(0);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('a failed write retries once and never throws', async () => {
    const j = new ReadingJournal(id);
    j.record({ agent: 'R01', agentKind: 'reader', round: 1, status: 'ok', source: 'live' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const write = vi.fn(async () => {
      throw new Error('table missing');
    });
    await expect(j.flush(write)).resolves.toBe(0);
    expect(write).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('validator rules', () => {
  const base = { question: 'When will I move?', intent: { questionType: 'timing' as const }, finishReason: 'STOP', stoppedForLoop: false, failedRequired: [] };

  it('a timing answer needs a date', () => {
    const v = validateByRules({ ...base, answer: 'You will move eventually, and it will feel right when it comes to you.' });
    expect(v.answered).toBe(false);
    expect(v.missing[0]!.part).toBe('when');
    expect(validateByRules({ ...base, answer: 'You move in the window that opens in March 2027, when the period changes.' }).answered).toBe(true);
  });

  it('flags a cut-off or empty answer', () => {
    expect(validateByRules({ ...base, answer: 'x', finishReason: 'STOP' }).flags).toContain('empty');
    expect(validateByRules({ ...base, answer: 'A long enough answer with a date in March 2027 that was cut', finishReason: 'MAX_TOKENS' }).flags).toContain('cut_off');
  });

  it('finds a part of a many-part question that the answer never touched', () => {
    const v = validateByRules({ ...base, intent: { questionType: 'describe' as const }, question: 'How is my career? Will my brother recover?', answer: 'Your career grows through the coming period with steady support.' });
    expect(v.missing.map((m) => m.part)).toEqual(['Will my brother recover']);
  });

  it('flags an engine name unless the person used the word', () => {
    expect(validateByRules({ ...base, answer: 'According to pyjhora, March 2027 is the window for this.' }).flags).toContain('engine_name');
    expect(validateByRules({ ...base, question: 'Will Radha marry me?', answer: 'With Radha, the window of March 2027 is strongest.' }).flags).not.toContain('engine_name');
  });
});

describe('engine names', () => {
  it('never reach the person, unless the person used the name', () => {
    expect(scrubEngineNames('computed by pyjhora and Radha', 'q')).toBe('computed by the calculation engine and the calculation engine');
    expect(scrubEngineNames('Radha is your partner', 'Will Radha stay?')).toBe('Radha is your partner');
  });
});
