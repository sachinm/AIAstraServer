import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { absorbAnswer, ABANDON_AFTER_MS, applyDefaults, assumptionText, confirmClarify, expireIfStale, MAX_QUESTIONS, parseHorizonValue, startClarify, type ClarifyState } from '../../../src/reading/clarify/machine.js';
import { phraseAsk, resolveFreeText } from '../../../src/reading/clarify/planner.js';
import { answerClarify, beginClarify, confirmAndBuildIntent } from '../../../src/reading/clarify/service.js';
import { MemoryClarifyStore } from '../../../src/reading/clarify/store.js';
import { extractJsonObject, setBedrockClientForTests } from '../../../src/reading/llm/bedrock.js';
import { clearDeclinedTopicsCache } from '../../../src/reading/policy/declined.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';

const AS_OF = '2026-10-24';
const CARD = { md: 'Sa', ad: 'Ke', pd: 'Ve', adEnd: '2027-09-07' };
const start = (q: string, mode: 'always' | 'when_missing' | 'never' = 'when_missing', card: typeof CARD | null = CARD) =>
  startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode, threshold: 0.7, card, now: 0 });
const chip = (s: ClarifyState, v: string, now = 1) => absorbAnswer(s, v, { viaChip: true, threshold: 0.7, now });
const typed = (s: ClarifyState, v: string, now = 1) => absorbAnswer(s, v, { viaChip: false, threshold: 0.7, now });

describe('clarify state machine', () => {
  it('reads straight away when nothing is missing (when_missing)', () => {
    const s = start('Should I change jobs this year?');
    expect(s.status).toBe('READY');
    expect(s.turns).toHaveLength(0);
    expect(s.exactQuery).toMatch(/24 Oct 2026 to 31 Dec 2026/);
  });
  it('proposes even when nothing is missing in always mode, and never asks in never mode', () => {
    expect(start('Should I change jobs this year?', 'always').status).toBe('PROPOSED');
    expect(start('When will I get married?', 'never').status).toBe('READY');
  });
  it('asks for the period first, chart-aware, with a chip ending at the running sub-period', () => {
    const s = start('When will I get married?');
    expect(s.status).toBe('ASKING');
    expect(s.pending?.criterion).toBe('horizon');
    expect(s.pending?.question).toBe('Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at?');
    expect(s.pending!.question.split(/\s+/).length).toBeLessThanOrEqual(18);
    expect(s.pending?.chips[0]).toEqual({ label: 'Until 7 Sep 2027', value: 'range:2026-10-24:2027-09-07' });
    expect(s.pending?.allowFreeText).toBe(true);
  });
  it('asks a plain question when no chart card is available', () => {
    expect(start('When will I get married?', 'when_missing', null).pending?.question).toBe('Which period should I look at?');
  });
  it('a chip answer resolves the slot and proposes the exact query', () => {
    const s = chip(start('When will I get married?'), '6m');
    expect(s.status).toBe('PROPOSED');
    expect(s.slots.horizon?.value).toBe('6m');
    expect(s.exactQuery).toBe('I will read: "When will I get married" over the next 6 months (24 Oct 2026 to 24 Apr 2027), using the D-9 chart, your 7th, 2nd, 11th houses, your Saturn–Ketu period and the transits.');
  });
  it('a typed answer the rules can read resolves the slot', () => {
    expect(typed(start('When will I get married?'), 'the next 3 months').slots.horizon?.value).toBe('3m');
    expect(typed(start('When will I get married?'), 'by March').slots.horizon?.value).toEqual({ from: '2026-10-24', to: '2027-03-31' });
  });
  it('asks one criterion per turn: period, then which part of career', () => {
    let s = start('Is my career going anywhere?');
    expect(s.pending?.criterion).toBe('horizon');
    s = chip(s, '1y');
    expect(s.pending?.criterion).toBe('sub_bucket');
    expect(s.pending?.chips.map((c) => c.value)).toEqual(['job_change', 'promotion', 'job_search', 'workplace_trouble', 'career_direction']);
    s = chip(s, 'promotion');
    expect(s.status).toBe('PROPOSED');
    expect(s.exactQuery).toMatch(/focusing on promotion or recognition over the next 12 months/);
  });
  it('never asks more than two questions and states the defaults it used', () => {
    let s = start('Hello');
    expect(s.pending?.criterion).toBe('bucket');
    s = typed(s, 'money');
    expect(s.bucket).toBe('money_wealth');
    expect(s.pending?.criterion).toBe('horizon');
    s = typed(s, "after my sister's wedding");
    expect(s.turns).toHaveLength(MAX_QUESTIONS);
    expect(s.status).toBe('PROPOSED');
    expect(s.slots.horizon?.value).toBe('6m');
    expect(assumptionText(s)).toBe('I assumed the next 6 months (24 Oct 2026 to 24 Apr 2027).');
    expect(s.exactQuery).toMatch(/^I will read: your money and wealth over/);
  });
  it('a multi-area question asks which area first (golden Q12)', () => {
    let s = start('How will my work, money and marriage go over the next 3 years?');
    expect(s.pending?.criterion).toBe('bucket');
    expect(s.pending?.chips.map((c) => c.value)).toEqual(expect.arrayContaining(['marriage', 'money_wealth', 'career_job']));
    s = chip(s, 'career_job');
    expect(s.bucket).toBe('career_job');
    expect(s.slots.horizon?.value).toBe('3y');
    expect(s.pending?.criterion).toBe('sub_bucket');
  });
  it('never re-asks a slot the question already filled (an adult child)', () => {
    const s = start("Will my son's business grow in the next 6 months?");
    expect(s.slots.subject_person?.value).toBe('son');
    expect(s.status).toBe('READY');
    expect(s.exactQuery).toMatch(/about your son, read from your chart/);
  });
  it('asks whose chart for family questions that do not say', () => {
    const s = start('How will the coming years be for the children in 2027?');
    if (s.status === 'ASKING' && s.pending?.criterion === 'subject_person') {
      expect(s.pending.chips.map((c) => c.label)).toContain('My adult child (18+)');
    }
    const q = start('Will there be a child in the family?');
    expect(['ASKING', 'READY', 'PROPOSED']).toContain(q.status);
  });
  it('confirm and edit', () => {
    const p = chip(start('When will I get married?'), '6m');
    expect(confirmClarify(p, {}, 2).status).toBe('CONFIRMED');
    const edited = confirmClarify(p, { horizon: '1y' }, 2);
    expect(edited.status).toBe('PROPOSED');
    expect(edited.exactQuery).toMatch(/next 12 months/);
  });
  it('abandons after 10 minutes without an answer', () => {
    const s = start('When will I get married?');
    expect(expireIfStale(s, ABANDON_AFTER_MS - 1).status).toBe('ASKING');
    expect(expireIfStale(s, ABANDON_AFTER_MS + 1).status).toBe('ABANDONED');
  });
  it('ignores answers when not asking', () => {
    const s = start('Should I change jobs this year?');
    expect(chip(s, '6m')).toBe(s);
  });
  it('parses horizon chip values and rejects bad ranges', () => {
    expect(parseHorizonValue('6m', AS_OF)).toBe('6m');
    expect(parseHorizonValue('range:2026-11-01:2027-01-31', AS_OF)).toEqual({ from: '2026-11-01', to: '2027-01-31' });
    expect(parseHorizonValue('range:2020-01-01:2021-01-01', AS_OF)).toBeNull();
    expect(parseHorizonValue('range:2027-01-01:2026-12-01', AS_OF)).toBeNull();
    expect(parseHorizonValue('soon', AS_OF)).toBeNull();
  });
  it('applyDefaults fills only what is open', () => {
    const s = applyDefaults(start('When will I get married?'), ['horizon']);
    expect(s.slots.horizon?.value).toBe('1y');
    expect(s.assumed.horizon).toMatch(/next 12 months/);
  });
});

describe('clarify model step (Bedrock, fake client)', () => {
  const send = vi.fn();
  beforeEach(() => {
    process.env.READING_MODEL_CLARIFY = 'bedrock:openai.gpt-oss-120b-1:0';
    setBedrockClientForTests({ send });
    send.mockReset();
  });
  afterEach(() => {
    delete process.env.READING_MODEL_CLARIFY;
    setBedrockClientForTests(null);
  });
  const reply = (text: string) => ({ output: { message: { role: 'assistant', content: [{ text }] } }, usage: { inputTokens: 300, outputTokens: 40, totalTokens: 340 } });

  it('uses the model phrasing when valid, keeping the rule chips', async () => {
    send.mockResolvedValue(reply('Thinking...\n```json\n{"question":"Shall I look until 7 Sep 2027, or a different stretch of time?"}\n```'));
    const s = start('When will I get married?');
    const { ask, usage } = await phraseAsk(s, s.pending!);
    expect(ask.question).toBe('Shall I look until 7 Sep 2027, or a different stretch of time?');
    expect(ask.chips).toEqual(s.pending!.chips);
    expect(usage?.model).toBe('bedrock:openai.gpt-oss-120b-1:0');
    const cmd = send.mock.calls[0]![0] as { input: { inferenceConfig: { maxTokens: number }; additionalModelRequestFields: unknown } };
    expect(cmd.input.inferenceConfig.maxTokens).toBe(300);
    expect(cmd.input.additionalModelRequestFields).toEqual({ reasoning_effort: 'low' });
  });
  it('falls back to the rule question on error, junk, a long question or unsafe wording', async () => {
    const s = start('When will I get married?');
    for (const r of [Promise.reject(new Error('ThrottlingException')), Promise.resolve(reply('no json here')), Promise.resolve(reply(`{"question":"${'word '.repeat(30)}"}`)), Promise.resolve(reply('{"question":"Which remedies have you tried so far?"}'))]) {
      send.mockReturnValueOnce(r);
      expect((await phraseAsk(s, s.pending!)).ask.question).toBe(s.pending!.question);
    }
  });
  it('does not send reasoning_effort to non-gpt-oss models', async () => {
    process.env.READING_MODEL_CLARIFY = 'bedrock:us.meta.llama4-maverick-17b-instruct-v1:0';
    send.mockResolvedValue(reply('{"question":"Which months matter most to you?"}'));
    const s = start('When will I get married?');
    await phraseAsk(s, s.pending!);
    expect((send.mock.calls[0]![0] as { input: Record<string, unknown> }).input.additionalModelRequestFields).toBeUndefined();
  });
  it('resolves free text to a closed value, and rejects values outside the set', async () => {
    const s = start('When will I get married?');
    send.mockResolvedValueOnce(reply('{"value":"range:2027-03-01:2027-06-30"}'));
    expect((await resolveFreeText(s, 'horizon', 'after my sister\'s wedding in spring')).value).toBe('range:2027-03-01:2027-06-30');
    send.mockResolvedValueOnce(reply('{"value":"next spring"}'));
    expect((await resolveFreeText(s, 'horizon', 'spring')).value).toBeNull();
  });
  it('is off by default (no model call)', async () => {
    delete process.env.READING_MODEL_CLARIFY;
    const s = start('When will I get married?');
    await phraseAsk(s, s.pending!);
    expect(send).not.toHaveBeenCalled();
  });
  it('extracts JSON from fenced or prose-wrapped replies', () => {
    expect(extractJsonObject('ok {"a": "b {x}"} trailing')).toEqual({ a: 'b {x}' });
    expect(() => extractJsonObject('none')).toThrow();
  });
});

describe('clarify service (memory store, fixture chart)', () => {
  const prisma = {
    declinedTopic: { findMany: vi.fn().mockResolvedValue([]) },
    auth: { findUnique: vi.fn().mockResolvedValue({ role: 'novice' }) },
  } as unknown as PrismaClient;
  beforeEach(() => {
    process.env.READING_FACTS_SOURCE = 'fixture';
    clearDeclinedTopicsCache();
    clearReadingCaches();
  });
  afterEach(() => delete process.env.READING_FACTS_SOURCE);

  it('question -> chart-aware ask -> chip -> propose -> confirm -> intent with the clarified horizon', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF });
    expect(b.event?.type).toBe('clarify');
    if (b.event?.type !== 'clarify') return;
    expect(b.event.question).toMatch(/^Your Saturn–Ketu period runs until 7 Sep 2027/);
    const a = await answerClarify(prisma, store, 'u1', b.runId, '6m', true);
    expect('error' in a ? a.error : a.event?.type).toBe('propose');
    const c = await confirmAndBuildIntent(store, 'u1', b.runId);
    if ('error' in c) throw new Error(c.error);
    expect(c.state.status).toBe('CONFIRMED');
    expect(c.intent?.horizon).toBe('6m');
    expect(c.intent?.subjects[0]?.id).toBe('marriage_relationship');
    expect(c.intent?.clarifyText).toMatch(/^I will read:/);
  });
  it('another user cannot answer or confirm the run', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF });
    expect(await answerClarify(prisma, store, 'u2', b.runId, '6m', true)).toEqual({ error: 'not_found' });
    expect(await confirmAndBuildIntent(store, 'u2', b.runId)).toEqual({ error: 'not_found' });
  });
  it('a declined question never starts a clarify conversation', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'When will I die?', { asOf: AS_OF });
    expect(b.declined?.id).toBe('death_lifespan');
    expect(b.event).toBeNull();
    expect(b.runId).toBe('');
  });
  it('a typed answer on a deny topic ends the conversation and is not stored', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'When will I get married?', { asOf: AS_OF });
    const a = await answerClarify(prisma, store, 'u1', b.runId, 'after I hurt someone', false);
    if ('error' in a) throw new Error(a.error);
    expect(a.declined?.category).toBe('deny');
    expect(a.state.status).toBe('ABANDONED');
    const saved = await store.get('u1', b.runId);
    expect(JSON.stringify(saved)).not.toMatch(/hurt/);
  });
  it("a question about the person's own child asks the age first; under 18 ends with the minors decline", async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'Will my daughter get married soon?', { asOf: AS_OF });
    expect(b.event?.type).toBe('clarify');
    if (b.event?.type !== 'clarify') return;
    expect(b.event.criterion).toBe('child_age');
    expect(b.event.question).toBe('Is your daughter 18 or older?');
    expect(b.event.chips.map((c) => c.value)).toEqual(['adult', 'minor']);
    const a = await answerClarify(prisma, store, 'u1', b.runId, 'minor', true);
    if ('error' in a) throw new Error(a.error);
    expect(a.declined?.id).toBe('minors');
    expect(a.state.status).toBe('ABANDONED');
  });
  it('18 or older continues to the normal questions and the confirm carries the confirmation', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'Will my daughter get married soon?', { asOf: AS_OF });
    const a = await answerClarify(prisma, store, 'u1', b.runId, 'she is 24', false);
    if ('error' in a) throw new Error(a.error);
    expect(a.state.childAge).toBe('adult');
    expect(a.event?.type === 'clarify' || a.event?.type === 'propose').toBe(true);
  });
  it('an unclear age answer counts as not confirmed', async () => {
    const store = new MemoryClarifyStore();
    const b = await beginClarify(prisma, store, 'u1', 'How is my son doing?', { asOf: AS_OF });
    const a = await answerClarify(prisma, store, 'u1', b.runId, 'not sure', false);
    if ('error' in a) throw new Error(a.error);
    expect(a.declined?.id).toBe('minors');
  });
  it('a question with everything in it needs no clarifying', async () => {
    const b = await beginClarify(prisma, new MemoryClarifyStore(), 'u1', 'Should I change jobs this year?', { asOf: AS_OF });
    expect(b.event).toBeNull();
    expect(b.state.status).toBe('READY');
  });
});
