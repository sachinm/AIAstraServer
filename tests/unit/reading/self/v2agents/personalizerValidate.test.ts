import { describe, expect, it } from 'vitest';
import { daysIn, heroSplit, parsePersonalDoc, redactEngineText, validatePersonalDoc } from '../../../../../src/reading/self/v2/personalizerValidate.js';
import { buildPersonalizerInput } from '../../../../../src/reading/self/v2/slices.js';
import type { OracleArea } from '../../../../../src/reading/self/areaDoc.js';
import type { OracleV2Output, PersonalizerInput, ProfilePack } from '../../../../../src/reading/self/v2types.js';
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

const input = (o = oracle(), gender: 'woman' | 'man' | null = null, over: Partial<ProfilePack> = {}): PersonalizerInput =>
  buildPersonalizerInput(makeCtx({ profile: makeProfile({ gender, ...over }) }), o);

const AREAS = ['diagnosis', 'stuck', 'chapter', 'lagna'];
const card = (over: Record<string, unknown>) => {
  const doc = JSON.parse(personalJson(AREAS)) as { hero: Record<string, unknown>; cards: Array<Record<string, unknown>> };
  doc.cards[0] = { ...doc.cards[0], ...over };
  return doc;
};
const run = (doc: { hero: Record<string, unknown>; cards: unknown[] }, inp = input()) => validatePersonalDoc(doc, inp);

describe('Personalizer validator (doc 66 §4.1; no word filters, doc 82)', () => {
  it('keeps a clean document: every sentence sourced, dates from the Oracle, certainty copied, the question on a claim id', () => {
    const v = run(parsePersonalDoc(personalJson(AREAS))!);
    expect(v.gaps).toEqual([]);
    expect(Object.values(v.cardStatus).every((s) => s === 'ok')).toBe(true);
    const c = v.doc.cards.diagnosis!;
    expect(c.body).toEqual(['You carry more at work than you are thanked for. It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    expect(c.sources.slice(0, 3)).toEqual(['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2']);
    expect(c.certainty).toBe('strong');
    expect(c.ladder).toEqual(expect.objectContaining({ best: expect.any(String), floor: expect.any(String) }));
    expect(v.doc.hero).toMatchObject({ tone: 'demanding', withheld: false, question: { text: 'Has work felt heavier lately?' }, easesAt: '2027-06-03' });
  });

  it('engine redaction leaves structured ids alone: evidence-key sources and the hero question claim id', () => {
    const v = run(parsePersonalDoc(personalJson(AREAS))!);
    expect(v.doc.cards.diagnosis!.sources).toEqual(['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2', 'planet:D1.Sa']);
    expect(v.doc.hero.question).toEqual({ claimId: 'claim:stuck.work_load', text: 'Has work felt heavier lately?' });
  });

  it('keeps a date written in prose; drops a structured card date that is not an Oracle window', () => {
    const v = run(card({ body: ['Work eases on 3 Mar 2027.', 'Finish one thing a week.'], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] }));
    expect(v.doc.cards.diagnosis!.body).toEqual(['Work eases on 3 Mar 2027.', 'Finish one thing a week.']);
    const d = run(card({ dates: [{ from: '2026-01-01', to: '2026-06-01', label: 'A new span' }] }));
    expect(d.doc.cards.diagnosis!.dates).toEqual([]);
    expect(d.gaps.join(' ')).toMatch(/2026-01-01\.\.2026-06-01 is not a window of the Oracle document/);
  });

  it('keeps a chart term', () => {
    const v = run(card({ body: ['Saturn presses your work.', 'Finish one thing a week.'] }));
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.doc.cards.diagnosis!.body).toEqual(['Saturn presses your work.', 'Finish one thing a week.']);
  });

  it('redacts an engine name in place and keeps the headline', () => {
    const v = run(card({ headline: 'Radha says work is heavy.' }));
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.doc.cards.diagnosis!.headline).toBe('traditional calculations says work is heavy.');
  });

  it('keeps a gendered word whether or not gender is stated', () => {
    const doc = card({ body: ['She carries more at work than she is thanked for.', 'Finish one thing a week.'], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] });
    for (const g of [null, 'woman'] as const) expect(run(doc, input(oracle(), g)).doc.cards.diagnosis!.body[0]).toMatch(/^She carries/);
  });

  it('rejects a sentence without a source in the Oracle document', () => {
    const v = run(card({ sources: ['diagnosis.p1', 'diagnosis.p9', 'diagnosis.p2', 'planet:D1.Sa'] }));
    expect(v.doc.cards.diagnosis!.body).toEqual(['It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    expect(v.gaps.join(' ')).toMatch(/no source in the Oracle document/);
    const short = run(card({ sources: ['diagnosis.p9'] })); // no source of the card is in the Oracle: truly unsourced
    expect(short.cardStatus.diagnosis).toBe('withheld');
  });

  it('an empty body is withheld and the Oracle headline stands in (chart terms kept, engine names redacted)', () => {
    const v = run(card({ body: [] }));
    expect(v.cardStatus.diagnosis).toBe('withheld');
    const c = v.doc.cards.diagnosis!;
    expect(c.body).toEqual([]);
    expect(c.headline).toBe('Saturn in the 10th makes diagnosis heavy.');
    expect(c.certainty).toBe('strong');
    // an area the Personalizer left out is withheld the same way
    const missing = run({ hero: {}, cards: [] });
    expect(Object.values(missing.cardStatus)).toEqual(['withheld', 'withheld', 'withheld', 'withheld']);
  });

  it('no word caps: a long headline and a long body are kept whole', () => {
    const headline = 'You carry a great deal at work right now and it is more than anyone sees today.';
    const long = run(card({ headline }));
    expect(long.cardStatus.diagnosis).toBe('ok');
    expect(long.doc.cards.diagnosis!.headline).toBe(headline);
    expect(long.doc.cards.diagnosis!.body).toEqual(['You carry more at work than you are thanked for. It eases after 20 Feb 2027.', 'Finish one thing a week.']);
    const words = Array.from({ length: 70 }, () => 'work').join(' ');
    const body = run(card({ body: [`${words}.`, `${words}.`], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] }));
    expect(body.doc.cards.diagnosis!.body).toEqual([`${words}.`, `${words}.`]);
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
    expect(bad.doc.hero.sentence).toBe('Work eases on 20 Feb 2027.');
  });

  it('2026-11-18 failure: between_jobs, a hero on "your career" and a body on "professional" are both kept', () => {
    const inp = input(oracle(), null, { facts: { work: { status: 'between_jobs' } } } as Partial<ProfilePack>);
    const heroSentence = 'Your career asks for patience until 20 Feb 2027.';
    const hero = { tone: 'demanding', sentence: heroSentence, sub: '', questionClaimId: 'claim:stuck.work_load', questionText: 'Has work felt heavier lately?', withheld: false };
    const doc = JSON.parse(personalJson(AREAS, { hero })) as { hero: Record<string, unknown>; cards: Array<Record<string, unknown>> };
    const professional = 'Your professional standing is quietly being rebuilt.';
    doc.cards[0] = { ...doc.cards[0], body: [professional, 'Finish one thing a week.'], sources: ['diagnosis.p1', 'diagnosis.p1', 'diagnosis.p2'] };
    const v = run(doc, inp);
    expect(v.doc.hero.sentence).toBe(heroSentence);
    expect(v.doc.hero.withheld).toBe(false);
    expect(v.cardStatus.diagnosis).toBe('ok');
    expect(v.doc.cards.diagnosis!.body).toContain(professional);
    expect(v.gaps.join(' ')).not.toMatch(/dropped/);
  });

  it('reads days in both forms', () => {
    expect(daysIn('from 2027-02-20 to 16 Feb 2028')).toEqual(['2027-02-20', '2028-02-16']);
  });
});

describe('redactEngineText (doc 82: the one step on text)', () => {
  it('replaces the engine names and strips internal keys and braces without dropping the sentence', () => {
    expect(redactEngineText('Radha and pyjhora both show it {claim:x}. Rest tonight.')).toBe('traditional calculations and traditional calculations both show it. Rest tonight.');
    expect(redactEngineText('Work eases soon {claim:stuck.work_load}.')).toBe('Work eases soon.');
  });
  it('leaves other text, chart terms included, as it is', () => {
    expect(redactEngineText('Saturn presses your 10th house.')).toBe('Saturn presses your 10th house.');
  });
});
