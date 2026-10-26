import { afterEach, describe, expect, it } from 'vitest';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { startClarify, type ClarifyState } from '../../../src/reading/clarify/machine.js';
import { intentFromState } from '../../../src/reading/clarify/service.js';
import { readingSpecialistMaxTokens, readingSynthMaxTokens, readingSynthThinking } from '../../../src/reading/config.js';
import { SpecialistOutputError } from '../../../src/reading/nodes/specialists.js';

const AS_OF = '2026-10-26';
const MULTI = 'tell me about my love life in OCT-NOV 2026 - finances, bank account balance, paying rent, who will i be at work with, business lunches';

const focused = (q: string, bucket: ClarifyState['bucket']): ClarifyState => ({
  ...startClarify(q, AS_OF, classifyRules(q, AS_OF), { mode: 'always', threshold: 0.7, card: null, now: 0 }),
  bucket,
  subBucket: null,
});

afterEach(() => {
  delete process.env.READING_SPECIALIST_MAX_OUTPUT_TOKENS;
  delete process.env.READING_SYNTH_MAX_OUTPUT_TOKENS;
  delete process.env.READING_SYNTH_THINKING;
});

describe('confirmed focus', () => {
  it('reads only the chosen subject now and keeps the other parts for afterwards', async () => {
    const intent = await intentFromState(focused(MULTI, 'love_relationships'));
    expect(intent.subjects).toEqual([{ id: 'marriage_relationship', weight: 1 }]);
    expect(intent.nextSubjects?.length).toBeGreaterThan(0);
    expect(intent.nextSubjects).not.toContain('marriage_relationship');
    expect(intent.nextSubjects).not.toContain('general_life_direction');
    expect(new Set(intent.nextSubjects).size).toBe(intent.nextSubjects!.length);
  });

  it('a single-topic question has no next parts', async () => {
    const intent = await intentFromState(focused('When will I get married?', 'love_relationships'));
    expect(intent.subjects).toEqual([{ id: 'marriage_relationship', weight: 1 }]);
    expect(intent.nextSubjects).toBeUndefined();
  });
});

describe('budgets and thinking defaults', () => {
  it('give specialists room to finish their JSON and the writer room to think and go deep', () => {
    expect(readingSpecialistMaxTokens()).toBe(4096);
    expect(readingSynthMaxTokens()).toBe(12_288);
    expect(readingSynthThinking()).toBe('medium');
  });
  it('can be overridden by env', () => {
    process.env.READING_SPECIALIST_MAX_OUTPUT_TOKENS = '6000';
    process.env.READING_SYNTH_MAX_OUTPUT_TOKENS = '16000';
    process.env.READING_SYNTH_THINKING = 'low';
    expect(readingSpecialistMaxTokens()).toBe(6000);
    expect(readingSynthMaxTokens()).toBe(16_000);
    expect(readingSynthThinking()).toBe('low');
    process.env.READING_SPECIALIST_MAX_OUTPUT_TOKENS = '10';
    expect(readingSpecialistMaxTokens()).toBe(4096); // below the floor: default
  });
});

describe('usage of a rejected specialist answer', () => {
  it('travels on the error, because those tokens were billed', () => {
    const usage = { node: 'specialist:promise', model: 'gemini-3.1-flash-lite', promptTokens: 12000, cachedTokens: 10000, outputTokens: 1800, thoughtTokens: 0, ms: 3000 };
    const err = new SpecialistOutputError('specialist promise returned unparsable JSON (MAX_TOKENS): x', usage);
    expect(err).toBeInstanceOf(Error);
    expect(err.usage).toEqual(usage);
    expect(err.name).toBe('SpecialistOutputError');
  });
});

describe('tolerant finding parse (doc 25)', () => {
  it('a claim with weight 0 keeps the layer: the weight falls back to 2', async () => {
    const { findingZ } = await import('../../../src/reading/nodes/specialists.js');
    const f = findingZ.parse({ verdict: 'moderate', layerScore: 1, claims: [{ text: 'The 7th lord is strong.', weight: 0, evidence: ['base.houses.7.lord'] }] });
    expect(f.claims).toHaveLength(1);
    expect(f.claims[0]!.weight).toBe(2);
  });
  it('drops a malformed claim or window on its own and keeps the rest', async () => {
    const { findingZ } = await import('../../../src/reading/nodes/specialists.js');
    const f = findingZ.parse({
      verdict: 'not-a-verdict',
      layerScore: 9,
      claims: [{ text: 'ok claim here' }, { text: 'x' }, 'garbage', { text: 'another good claim', polarity: 'weird', tradition: 'astro' }],
      windows: [{ from: '2026-11-01', to: '2026-11-20' }, { from: '2026-12-01' }],
    });
    expect(f.verdict).toBe('mixed');
    expect(f.layerScore).toBe(0);
    expect(f.claims.map((c) => c.text)).toEqual(['ok claim here', 'another good claim']);
    expect(f.claims[1]).toMatchObject({ polarity: 'neutral', tradition: 'parashara' });
    expect(f.windows).toHaveLength(1);
  });
  it('the specialist timeout default is 18 s', async () => {
    const { readingSpecialistTimeoutMs } = await import('../../../src/reading/config.js');
    expect(readingSpecialistTimeoutMs()).toBe(18_000);
  });
});
