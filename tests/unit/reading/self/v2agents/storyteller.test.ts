/**
 * The storyteller's illustration (Sachin 2026-11-09): one short example, analogy or modern reference per card (and the
 * hero), pointing at an Oracle paragraph; its own rule set; a failing illustration is dropped alone, never the card.
 */
import { describe, expect, it } from 'vitest';
import { parsePersonalDoc, validatePersonalDoc } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { personalizerSchema } from '../../../../../src/reading/self/v2/personalizer.js';
import { buildPersonalizerInput } from '../../../../../src/reading/self/v2/slices.js';
import { ILLUSTRATION_MAX_WORDS, illustrationTextProblem } from '../../../../../src/reading/self/v2/storyteller.js';
import type { OracleArea } from '../../../../../src/reading/self/areaDoc.js';
import type { OracleV2Output, PersonalizerInput, StatedGender } from '../../../../../src/reading/self/v2types.js';
import { makeCtx, makeProfile, personalJson } from './fixtures.js';

const area = (id: string): OracleArea =>
  ({
    id,
    headline: `Saturn in the 10th makes ${id} heavy.`,
    paragraphs: [`Saturn in the 10th presses ${id}.`, `Venus, 6/8 from Rahu, costs effort until 2028-11-16.`],
    dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'Venus sub-period' }],
    actions: [],
    certainty: 'strong',
    evidence: ['planet:D1.Sa', `claim:${id}.main`, ...(id === 'stuck' ? ['claim:stuck.work_load'] : [])],
    validUntil: '2027-02-20',
  }) as unknown as OracleArea;
const AREAS = ['diagnosis', 'stuck', 'chapter', 'body'];
const oracle: OracleV2Output = { doc: { areas: Object.fromEntries(AREAS.map((id) => [id, area(id)])) as OracleV2Output['doc']['areas'], validUntil: '2027-02-20' }, patterns: [] };
const input = (gender: StatedGender | null = null): PersonalizerInput => buildPersonalizerInput(makeCtx({ profile: makeProfile({ gender }) }), oracle);

/** the clean fixture document with an illustration on the first card (diagnosis) and, optionally, the hero */
const withIllustration = (ill: Record<string, unknown> | undefined, hero?: Record<string, unknown>, cardIndex = 0) => {
  const doc = JSON.parse(personalJson(AREAS)) as { hero: Record<string, unknown>; cards: Array<Record<string, unknown>> };
  if (ill) doc.cards[cardIndex] = { ...doc.cards[cardIndex], illustration: ill };
  if (hero) doc.hero = { ...doc.hero, illustration: hero };
  return parsePersonalDoc(JSON.stringify(doc))!;
};
const run = (ill: Record<string, unknown> | undefined, inp = input(), hero?: Record<string, unknown>, cardIndex = 0) => validatePersonalDoc(withIllustration(ill, hero, cardIndex), inp);

const GOOD = { text: 'Like a phone on low battery: it still works, but every app you open costs more than it did a month ago.', kind: 'analogy', illustrates: 'diagnosis.p2' };

describe('storyteller: the illustration on a card', () => {
  it('keeps a good analogy that points at an Oracle paragraph, and the card is untouched', () => {
    const v = run(GOOD);
    expect(v.doc.cards.diagnosis!.illustration).toEqual(GOOD);
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.gaps.filter((g) => g.includes('illustration'))).toEqual([]);
  });

  it('keeps an example and a modern reference', () => {
    expect(run({ text: 'Think of the week a new manager arrives and every routine you had gets rewritten.', kind: 'example', illustrates: 'stuck.p1' }).doc.cards.diagnosis!.illustration?.kind).toBe('example');
    expect(run({ text: 'Like a phone running a big system update overnight: slow for a while, then everything works better.', kind: 'modern', illustrates: 'diagnosis.p1' }).doc.cards.diagnosis!.illustration?.kind).toBe('modern');
  });

  const dropped = (ill: Record<string, unknown>, reason: RegExp, inp = input()) => {
    const v = run(ill, inp);
    expect(v.doc.cards.diagnosis!.illustration).toBeUndefined();
    // the card stands: only the illustration goes
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.doc.cards.diagnosis!.body.length).toBeGreaterThan(0);
    expect(v.gaps.find((g) => g.startsWith('diagnosis: illustration dropped'))).toMatch(reason);
  };

  it('drops one that illustrates no Oracle paragraph (an evidence key or a made-up id is not one)', () => {
    dropped({ ...GOOD, illustrates: 'planet:D1.Sa' }, /not an Oracle paragraph id/);
    dropped({ ...GOOD, illustrates: 'diagnosis.p9' }, /not an Oracle paragraph id/);
    dropped({ ...GOOD, illustrates: 'mind.p1' }, /not an Oracle paragraph id/);
  });

  it('drops chart terms, engine names, medical words', () => {
    dropped({ ...GOOD, text: 'Like Saturn sitting on your desk all day.' }, /chart term/);
    dropped({ ...GOOD, text: 'As the calculation in Radha shows, it is like a low battery.' }, /engine name/);
    dropped({ ...GOOD, text: 'Like a chronic illness that flares in the evening.' }, /medical word/);
  });

  it('drops dates, years and month names, even ones the Oracle carries', () => {
    dropped({ ...GOOD, text: 'Like the 2008 crash: the floor moved under everyone at once.' }, /a date or year \(2008\)/);
    dropped({ ...GOOD, text: 'Like tax season in March, when every evening goes to paperwork.' }, /a month name \(March\)/);
    dropped({ ...GOOD, text: 'Like the stretch until 2027-02-20 when everything is uphill.' }, /a date or year/);
    // "may" the verb is not a month
    expect(run({ ...GOOD, text: 'Like a long commute: you may arrive tired even on easy days.' }).doc.cards.diagnosis!.illustration).toBeDefined();
  });

  it('drops a gendered word when no gender is stated, and keeps it when one is', () => {
    const ill = { ...GOOD, text: 'Like a coach who keeps her best player on the bench until the final.' };
    dropped(ill, /gendered word/);
    expect(run(ill, input('woman')).doc.cards.diagnosis!.illustration).toBeDefined();
  });

  it('drops one over 40 words, and one with an unknown kind', () => {
    dropped({ ...GOOD, text: Array.from({ length: ILLUSTRATION_MAX_WORDS + 1 }, () => 'word').join(' ') }, /over 40 words/);
    dropped({ ...GOOD, kind: 'joke' }, /unknown kind joke/);
  });

  it('drops a profile-fit violation (a career-stage word a 25 to 35 band does not allow)', () => {
    const young = buildPersonalizerInput(makeCtx({ profile: makeProfile({ ageBand: '25_35', ageYears: 29 }) }), oracle);
    dropped({ ...GOOD, text: 'Like a seasoned pilot who has flown this route a hundred times.' }, /career-stage word .*\(seasoned\)/, young);
  });

  it('the body card keeps its own words table (no diet advice in an illustration either)', () => {
    const v = run({ text: 'Like skipping meals on a long drive: you keep going, but you pay for it later.', kind: 'analogy', illustrates: 'body.p1' }, input(), undefined, 3);
    expect(v.doc.cards.body!.illustration).toBeUndefined();
    expect(v.gaps.find((g) => g.startsWith('body: illustration dropped'))).toMatch(/diet or medicine advice|medical/);
  });

  it('no illustration (or an empty one) is no illustration and no finding', () => {
    expect(run(undefined).doc.cards.diagnosis!.illustration).toBeUndefined();
    expect(run({ text: '', kind: 'analogy', illustrates: 'diagnosis.p1' }).gaps.filter((g) => g.includes('illustration'))).toEqual([]);
  });
});

describe('storyteller: the hero and the schema', () => {
  it('the hero may carry one under the same rules', () => {
    const ok = run(undefined, input(), { text: 'Like a marathon at the halfway mark: the hard part is behind you only on the map.', kind: 'analogy', illustrates: 'stuck.p1' });
    expect(ok.doc.hero.illustration).toMatchObject({ kind: 'analogy', illustrates: 'stuck.p1' });
    const bad = run(undefined, input(), { text: 'Like Jupiter returning in 2027.', kind: 'analogy', illustrates: 'stuck.p1' });
    expect(bad.doc.hero.illustration).toBeUndefined();
    expect(bad.doc.hero.sentence).not.toBe('');
    expect(bad.gaps.find((g) => g.startsWith('hero: illustration dropped'))).toBeDefined();
  });

  it('the responseSchema offers an optional illustration on each card and on the hero', () => {
    const s = personalizerSchema(AREAS) as { properties: { hero: { properties: Record<string, unknown>; required: string[] }; cards: { items: { properties: Record<string, { properties?: Record<string, { enum?: string[] }> }>; required: string[] } } } };
    expect(s.properties.cards.items.properties.illustration!.properties!.kind!.enum).toEqual(['example', 'analogy', 'modern']);
    expect(s.properties.cards.items.required).not.toContain('illustration');
    expect(s.properties.hero.properties.illustration).toBeDefined();
    expect(s.properties.hero.required).not.toContain('illustration');
  });

  it('the date rules run before the card checks', () => {
    expect(illustrationTextProblem('Back in Sept the roads were quiet.', () => null)).toMatch(/month name/);
    expect(illustrationTextProblem("Like the summer of '99.", () => null)).toMatch(/date or year/);
    expect(illustrationTextProblem('Like a low battery.', () => 'x')).toBe('x');
  });
});
