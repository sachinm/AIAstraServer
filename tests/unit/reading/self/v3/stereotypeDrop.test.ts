/**
 * The stereotype filter (TODOS 2026-11-12): `girl` is no longer a default phrase, and a flagged sentence is dropped on
 * its own, never the whole card. An env list replaces the default; a field left empty keeps the empty-field behaviour.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PERSONALIZER_STEREOTYPE_PHRASES } from '../../../../../src/config/env.js';
import { dropStereotypeSentences, redactChartTerms, textProblem } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { checkPersonalCard, v3DateFrame } from '../../../../../src/reading/self/v3/personalizer.js';
import type { OracleCardV3 } from '../../../../../src/reading/self/v3/types.js';

const saved = process.env.PERSONALIZER_STEREOTYPE_PHRASES;
afterEach(() => {
  if (saved === undefined) delete process.env.PERSONALIZER_STEREOTYPE_PHRASES;
  else process.env.PERSONALIZER_STEREOTYPE_PHRASES = saved;
});

const c = { gender: 'woman' as const, dates: v3DateFrame(['2026-12-01', '2027-02-01']) };

const oracle = {
  card: 'body',
  headline: 'Rest is thin.',
  spans: [{ span: 's1', tone: 'heavy', mode: 'get_through', asks: 'hold the evenings', obstacle: 'late work', evidence: [], agreement: 'all agree' }],
  confirm: null,
  gift: 'stamina',
  knot: 'overwork',
  pattern: null,
  certainty: 'likely',
  evidence: [],
} as unknown as OracleCardV3;

const personal = (over: Record<string, unknown> = {}) => ({
  card: 'body',
  line: 'Your evenings need guarding.',
  spans: [{ span: 's1', asks: 'Guard your evenings.', obstacle: 'Working late to catch up.', step: 'If it is past ten, then write tomorrow’s first task and stop.' }],
  confirm: null,
  pattern: '',
  ladder: { best: '', practical: '', drift: '', floor: '' },
  ...over,
});

describe('`girl` is not a default stereotype phrase', () => {
  it('leaves the default list, and a sentence about a daughter survives', () => {
    expect(DEFAULT_PERSONALIZER_STEREOTYPE_PHRASES).not.toContain('girl');
    expect(textProblem('Your daughter, a girl of seven, needs a calm evening.', c)).toBeNull();
    expect(dropStereotypeSentences('Your daughter, a girl of seven, needs a calm evening.')).toEqual({
      text: 'Your daughter, a girl of seven, needs a calm evening.',
      dropped: [],
    });
  });
  it('stays env-tunable: PERSONALIZER_STEREOTYPE_PHRASES can put it back', () => {
    process.env.PERSONALIZER_STEREOTYPE_PHRASES = 'girl';
    expect(textProblem('Your daughter, a girl of seven, needs a calm evening.', c)).toMatch(/stereotype/);
  });
});

describe('dropStereotypeSentences', () => {
  it('drops only the sentence that carries a configured phrase', () => {
    expect(dropStereotypeSentences('Rest tonight. Take it easy, sweetie. Keep the mornings clear.')).toEqual({
      text: 'Rest tonight. Keep the mornings clear.',
      dropped: ['Take it easy, sweetie.'],
    });
  });
  it('returns an empty text when every sentence is flagged', () => {
    expect(dropStereotypeSentences('Honey, rest tonight.').text).toBe('');
  });
  it('agrees with redactChartTerms', () => {
    expect(redactChartTerms('Rest tonight. Take it easy, sweetie. Keep the mornings clear.')).toBe('Rest tonight. Keep the mornings clear.');
  });
});

describe('the v3 Personalizer check drops a flagged sentence, not the card', () => {
  it('keeps the card when one sentence of a field carries a stereotype phrase', () => {
    const p = personal({ line: 'Your evenings need guarding. Honey, rest tonight.' });
    (p.spans[0] as Record<string, string>).asks = 'Guard your evenings. As a woman, you should rest more.';
    const r = checkPersonalCard(p, oracle, c, ['line', 'year']);
    expect(r.problems).toEqual([]);
    expect(r.card?.line).toBe('Your evenings need guarding.');
    expect(r.card?.spans[0]?.asks).toBe('Guard your evenings.');
    expect(r.notes.join(' | ')).toMatch(/line: 1 sentence\(s\) dropped/);
    expect(r.notes.join(' | ')).toMatch(/span s1 asks: 1 sentence\(s\) dropped/);
  });
  it('a sentence about a daughter survives', () => {
    const r = checkPersonalCard(personal({ line: 'Your daughter, a girl of seven, needs your evenings.' }), oracle, c, ['line', 'year']);
    expect(r.problems).toEqual([]);
    expect(r.card?.line).toBe('Your daughter, a girl of seven, needs your evenings.');
  });
  it('a stereotype sentence in a ladder step is dropped alone', () => {
    const ladder = { best: 'Keep two quiet evenings. Sweetie, sleep in.', practical: 'Agree a stop time.', drift: 'You catch up but tire.', floor: 'Sleep seven hours.' };
    const r = checkPersonalCard(personal({ ladder }), oracle, c, ['line', 'year', 'ladder']);
    expect(r.card?.ladder).toEqual({ ...ladder, best: 'Keep two quiet evenings.' });
  });
  it('a field left with nothing keeps the empty-field behaviour: the card is withheld', () => {
    const r = checkPersonalCard(personal({ line: 'Honey, rest tonight.' }), oracle, c, ['line', 'year']);
    expect(r.card).toBeNull();
    expect(r.problems).toContain('line: empty');
  });
});
