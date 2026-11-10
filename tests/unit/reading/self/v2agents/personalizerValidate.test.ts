import { describe, expect, it } from 'vitest';
import { daysIn, heroSplit, parsePersonalDoc, textProblem, validatePersonalDoc } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { buildPersonalizerInput } from '../../../../../src/reading/self/v2/slices.js';
import type { OracleArea } from '../../../../../src/reading/self/areaDoc.js';
import type { OracleV2Output, PersonalizerInput } from '../../../../../src/reading/self/v2types.js';
import { makeCtx, makeProfile, personalJson } from './fixtures.js';

const area = (id: string, certainty: OracleArea['certainty'] = 'strong'): OracleArea =>
  ({
    id,
    headline: `Saturn in the 10th makes ${id} heavy.`,
    paragraphs: [`Saturn in the 10th presses ${id}.`, `Venus, 6/8 from Rahu, costs effort until 2028-11-16.`],
    dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'Venus sub-period' }],
    actions: [{ from: '2026-11-09', to: '2027-02-20', text: 'Finish one task.' }],
    certainty,
    evidence: ['planet:D1.Sa', `claim:${id}.main`, ...(id === 'stuck' ? ['claim:stuck.work_load'] : [])],
    validUntil: '2027-02-20',
  }) as unknown as OracleArea;

const oracle = (certs: Partial<Record<string, OracleArea['certainty']>> = {}): OracleV2Output => ({
  doc: { areas: Object.fromEntries(['diagnosis', 'stuck', 'chapter', 'lagna'].map((id) => [id, area(id, certs[id] ?? 'strong')])) as OracleV2Output['doc']['areas'], validUntil: '2027-02-20' },
  patterns: [],
});

const input = (o = oracle(), gender: 'woman' | 'man' | null = null): PersonalizerInput => buildPersonalizerInput(makeCtx({ profile: makeProfile({ gender }) }), o);

const AREAS = ['diagnosis', 'stuck', 'chapter', 'lagna'];
const card = (over: Record<string, unknown>) => {
  const doc = JSON.parse(personalJson(AREAS)) as { hero: Record<string, unknown>; cards: Array<Record<string, unknown>> };
  doc.cards[0] = { ...doc.cards[0], ...over };
  return doc;
};
const run = (doc: { hero: Record<string, unknown>; cards: unknown[] }, inp = input()) => validatePersonalDoc(doc, inp);

describe('Personalizer validator (doc 66 §4.1)', () => {
  it('keeps a clean document: every sentence sourced, dates from the Oracle, certainty copied, the question on a claim id', () => {
    const v = run(parsePersonalDoc(personalJson(AREAS))!);
    expect(v.gaps).toEqual([]);
    expect(Object.values(v.cardStatus).every((s) => s === 'ok')).toBe(true);
    const c = v.doc.cards.diagnosis!;
    expect(c.body).toEqual(['You carry more at work than you are thanked for. It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    expect(c.sources).toEqual(['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2', 'planet:D1.Sa']);
    expect(c.certainty).toBe('strong');
    expect(c.ladder).toEqual(expect.objectContaining({ best: expect.any(String), floor: expect.any(String) }));
    expect(v.doc.hero).toMatchObject({ tone: 'demanding', withheld: false, question: { claimId: 'claim:stuck.work_load' }, easesAt: '2027-06-03' });
  });

  it('rejects a new date', () => {
    const v = run(card({ body: ['Work eases on 3 Mar 2027.', 'Finish one thing a week.'], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] }));
    expect(v.doc.cards.diagnosis!.body).toEqual(['Finish one thing a week.']);
    expect(v.gaps.join(' ')).toMatch(/date 2027-03-03 is not in the Oracle document/);
    const d = run(card({ dates: [{ from: '2026-01-01', to: '2026-06-01', label: 'A new span' }] }));
    expect(d.doc.cards.diagnosis!.dates).toEqual([]);
    expect(textProblem('It changes in May 2031.', { gender: null, dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() } })).toMatch(/2031/);
  });

  it('rejects a chart term', () => {
    const v = run(card({ body: ['Saturn presses your work.', 'Finish one thing a week.'] }));
    expect(v.doc.cards.diagnosis!.body).toEqual(['Finish one thing a week.']);
    expect(v.gaps.join(' ')).toMatch(/chart term \(Saturn\)/);
    for (const t of ['Your 10th house is busy.', 'This dasha asks a lot.', 'Venus helps you.', 'Your Capricorn side shows.', 'Three of 5 clocks agree.']) expect(textProblem(t, { gender: null, dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() } }), t).toMatch(/chart term/);
  });

  it('rejects an engine name', () => {
    const v = run(card({ headline: 'Radha says work is heavy.' }));
    // run 2: the headline goes, the card stays with a passing body sentence as its headline
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.doc.cards.diagnosis!.headline).not.toMatch(/radha/i);
    expect(v.gaps.join(' ')).toMatch(/engine name/);
    expect(textProblem('pyjhora shows it', { gender: 'man', dates: { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() } })).toBe('engine name');
  });

  it('rejects a gendered word when gender is null, keeps it when stated', () => {
    const doc = card({ body: ['She carries more at work than she is thanked for.', 'Finish one thing a week.'], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] });
    const none = run(doc, input(oracle(), null));
    expect(none.doc.cards.diagnosis!.body).toEqual(['Finish one thing a week.']);
    expect(none.gaps.join(' ')).toMatch(/gendered word/);
    const stated = run(doc, input(oracle(), 'woman'));
    expect(stated.doc.cards.diagnosis!.body[0]).toMatch(/^She carries/);
  });

  it('rejects a sentence without a source in the Oracle document', () => {
    const v = run(card({ sources: ['diagnosis.p1', 'diagnosis.p9', 'diagnosis.p2', 'planet:D1.Sa'] }));
    expect(v.doc.cards.diagnosis!.body).toEqual(['It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    expect(v.gaps.join(' ')).toMatch(/no source in the Oracle document/);
    const short = run(card({ sources: ['diagnosis.p9'] })); // no source of the card is in the Oracle: truly unsourced
    expect(short.cardStatus.diagnosis).toBe('withheld');
  });

  it('an empty body is withheld and the Oracle headline, redacted, stands in', () => {
    const v = run(card({ body: [] }));
    expect(v.cardStatus.diagnosis).toBe('withheld');
    const c = v.doc.cards.diagnosis!;
    expect(c.body).toEqual([]);
    expect(c.headline).not.toMatch(/Saturn/);
    expect(c.certainty).toBe('strong');
    // an area the Personalizer left out is withheld the same way
    const missing = run({ hero: {}, cards: [] });
    expect(Object.values(missing.cardStatus)).toEqual(['withheld', 'withheld', 'withheld', 'withheld']);
  });

  it('caps the headline at 14 words and the body at 120', () => {
    const long = run(card({ headline: 'You carry a great deal at work right now and it is more than anyone sees today.' }));
    // run 2: a long headline is replaced by the first passing body sentence of at most 14 words
    expect(long.cardStatus.diagnosis).toBe('ok');
    expect(long.doc.cards.diagnosis!.headline).toBe('You carry more at work than you are thanked for.');
    expect(long.doc.cards.diagnosis!.body).toEqual(['It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    const words = Array.from({ length: 70 }, () => 'work').join(' ');
    const body = run(card({ body: [`${words}.`, `${words}.`], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] }));
    expect(body.doc.cards.diagnosis!.body).toHaveLength(1);
  });

  it('the hero: withheld when the live areas split; a question on an unknown claim dropped; tone falls back to mixed', () => {
    expect(heroSplit(oracle({ stuck: 'possible' }))).toBe(true);
    expect(heroSplit(oracle({ diagnosis: 'possible', stuck: 'possible', chapter: 'possible' }))).toBe(true);
    expect(heroSplit(oracle({ stuck: 'likely' }))).toBe(false);
    const split = run(parsePersonalDoc(personalJson(AREAS))!, input(oracle({ stuck: 'possible' })));
    expect(split.doc.hero.withheld).toBe(true);
    const bad = run(parsePersonalDoc(personalJson(AREAS, { hero: { tone: 'grim', sentence: 'Work eases on 20 Feb 2027.', sub: '', questionClaimId: 'claim:made.up', questionText: 'Is it?', withheld: false } }))!);
    expect(bad.doc.hero.tone).toBe('mixed');
    expect(bad.doc.hero.question).toBeNull();
  });

  it('reads days in both forms', () => {
    expect(daysIn('from 2027-02-20 to 16 Feb 2028')).toEqual(['2027-02-20', '2028-02-16']);
  });
});
