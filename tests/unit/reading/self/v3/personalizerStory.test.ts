/**
 * docs/techniques/09 §3.3, §8 step 9: what the Personalizer is guaranteed to write, and its voice. Fake model only.
 * Naming rule (Sachin, 2026-11-19): the reading's own agreement is "AdAstra AI", never "the systems" or "the clocks".
 */
import { describe, expect, it } from 'vitest';
import { PROMPTS } from '../../../../../src/reading/prompts/generated.js';
import { checkPersonalCard, personalizerV3Schema, personalizerV3Suffix, renderOracleCards } from '../../../../../src/reading/self/v3/personalizer.js';
import { lifeStageOf } from '../../../../../src/reading/person/profile.js';
import type { OracleCardV3 } from '../../../../../src/reading/self/v3/types.js';

const oracle: OracleCardV3 = {
  card: 'body',
  headline: 'A heavy stretch, then room to build.',
  spans: [{ span: 's1', tone: 'heavy', mode: 'get_through', asks: 'x', obstacle: 'y', evidence: ['k'], agreement: 'z' }],
  confirm: null,
  gift: 'g',
  knot: 'k',
  pattern: null,
  certainty: 'likely',
  evidence: [],
  story: 'The Vimshottari maha dasha of Saturn {activation:vimsottari/1/Sa@2019-01-01} opens the story.',
  beats: [{ beat: 'maha', held: 'yes', systems: ['vimsottari'], evidence: [] }],
};
const many = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
const raw = (over: Record<string, unknown> = {}) => ({
  card: 'body',
  line: 'Guard your evenings until 1 Jan 2027.',
  spans: [{ span: 's1', asks: 'a', obstacle: 'b', step: 'If x, then y.', growth: 'steadiness' }],
  confirm: '',
  pattern: '',
  why: 'It fits your year.',
  ladder: { best: 'a', practical: 'b', drift: 'c', floor: 'd' },
  story: many(400),
  ...over,
});
const ctx = { gender: null, dates: { days: new Set<string>(), months: new Set<string>(), years: new Set<string>(), pairs: new Set<string>() } } as never;

describe('the Personalizer story contract', () => {
  it('keeps a card with every guaranteed field', () => {
    const r = checkPersonalCard(raw(), oracle, ctx, ['line', 'year'], true);
    expect(r.problems).toEqual([]);
    expect(r.card).toMatchObject({ story: expect.any(String), why: 'It fits your year.', ladder: { best: 'a' } });
    expect(r.card!.spans[0]!.growth).toBe('steadiness');
  });
  it('refuses a short story, a missing growth, a missing why, or a ladder step empty (the ladder is always on)', () => {
    expect(checkPersonalCard(raw({ story: many(100) }), oracle, ctx, [], true).problems[0]).toMatch(/story: 100 words; at least 350/);
    expect(checkPersonalCard(raw({ spans: [{ span: 's1', asks: 'a', obstacle: 'b', step: 's', growth: '' }] }), oracle, ctx, [], true).problems).toContain('span s1 growth: empty');
    expect(checkPersonalCard(raw({ why: '' }), oracle, ctx, [], true).problems).toContain('why: empty');
    expect(checkPersonalCard(raw({ ladder: { best: 'a', practical: '', drift: 'c', floor: 'd' } }), oracle, ctx, [], true).problems[0]).toMatch(/ladder practical/);
  });
  it('the doc 70 face is unchanged without the contract', () => {
    expect(checkPersonalCard(raw({ story: '', why: '' }), oracle, ctx, ['line'], false).card).toBeTruthy();
  });
  it('the schema writes the story last; the suffix gives the age in years (never to print) and the stage of life', () => {
    const s = personalizerV3Schema(['body'], true) as { properties: { cards: { items: { propertyOrdering: string[]; required: string[] } } } };
    expect(s.properties.cards.items.propertyOrdering.at(-1)).toBe('story');
    expect(s.properties.cards.items.required).toEqual(expect.arrayContaining(['why', 'ladder', 'story']));
    const profile = { ageBand: '36_45', ageYears: 41, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'h' } as never;
    const suffix = personalizerV3Suffix('2026-11-19', [oracle], new Map([['s1', { from: '2026-10-01', to: '2027-01-01' }]]), { profile, portrait: null, sections: {}, story: { ageYears: 41, lifeStage: lifeStageOf(profile) } });
    expect(suffix).toContain('age in whole years: 41 (to pitch the reading; never write the age)');
    expect(suffix).toContain('stage of life: load-bearing years');
    expect(renderOracleCards([oracle])).toContain('opens the story.');
    expect(renderOracleCards([oracle])).not.toContain('{activation:');
  });
});

describe('the Personalizer prompt (voice, naming)', () => {
  const p = PROMPTS['personalizer/self-v3']!;
  it('is the learned astrologer: optimistic, growth-led, never hides a heavy stretch; no pep-talk ban left', () => {
    expect(p).toContain('learned astrologer');
    expect(p).toContain('growth-led');
    expect(p).toContain('Never hide or soften a heavy stretch');
    expect(p).not.toMatch(/No pep talk/i);
    expect(p).toContain('ladder');
  });
  it('names the reader AdAstra AI; its example wording never says "the systems" or "the clocks"', () => {
    expect(p).toContain('AdAstra AI reads');
    // the quoted examples, leaving out the quoted phrases the prompt forbids (`Never "the systems", "the clocks" …`)
    const allowed = p.replace(/Never "the systems"[^.]*\./g, '');
    expect(allowed).not.toBe(p);
    const examples = [...allowed.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(examples.length).toBeGreaterThan(3);
    for (const e of examples) expect(e, e).not.toMatch(/\bthe systems\b|\bclocks?\b|\btiming systems\b/i);
  });
  it('keeps the no-chart-term, health and gender rules', () => {
    expect(p).toMatch(/Never a planet, a house, a sign/);
    expect(p).toMatch(/Health:/);
    expect(p).toMatch(/Gender:/);
  });
});
