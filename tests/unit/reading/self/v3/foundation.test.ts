/**
 * docs/reading-engine/75: the foundation card's code layer — text cleaning, named periods, key dates, the stale guard,
 * card names, and This chapter folded into Your life phases.
 */
import { describe, expect, it } from 'vitest';
import {
  cleanEmptyRefs,
  isoDatesToWords,
  keyDatesFrom,
  periodsFrom,
  plainProse,
  staleDatesIn,
  yearTitle,
  type CardWindow,
} from '../../../../../src/reading/self/v3/foundation.js';
import { cardViews, railFromDates } from '../../../../../src/reading/self/v3/response.js';
import { cardDef, defaultSuggested } from '../../../../../src/reading/self/v3/cards.js';
import { CHART_TERMS } from '../../../../../src/reading/self/v2/personalizerValidate.js';

const today = '2026-11-13';
const w = (from: string, to: string, extra: Partial<CardWindow> = {}): CardWindow => ({ from, to, label: null, tone: null, headline: null, text: [], span: null, ...extra });

describe('text cleaning', () => {
  it('drops empty references', () => {
    expect(cleanEmptyRefs('Strength in the 1st house ().')).toBe('Strength in the 1st house.');
    expect(cleanEmptyRefs('A drive (Mars ()) that pushes.')).toBe('A drive (Mars) that pushes.');
    expect(cleanEmptyRefs('Your aim (Amatyakaraka,) is clear (,) now.')).toBe('Your aim (Amatyakaraka) is clear now.');
    expect(cleanEmptyRefs('A long period ( , ) ends.')).toBe('A long period ends.');
  });
  it('one date format', () => {
    expect(isoDatesToWords('Until 2026-11-11, then 2027-01-01.')).toBe('Until 11 Nov 2026, then 1 Jan 2027.');
  });
  it('Read prose keeps no chart term: the sentence carrying one is dropped whole', () => {
    const out = plainProse('Your evenings need guarding until 2026-12-05. The Rahu Mahadasha () presses. You have 32 SAV points.');
    expect(out).toBe('Your evenings need guarding until 5 Dec 2026.');
    expect(CHART_TERMS.some((re) => re.test(out))).toBe(false);
  });
});

describe('stale guard', () => {
  it('flags a day that was ahead at the build and has passed, with or without a year', () => {
    const texts = ['Mental relief arrives on 11 November.', 'The strain eases on 2026-11-12.', 'A new phase from 1 Jan 2027.'];
    expect(staleDatesIn(texts, today, '2026-11-10T08:00:00Z')).toEqual(['2026-11-11', '2026-11-12']);
  });
  it('a day already past at the build is history, not stale', () => {
    expect(staleDatesIn(['You left that job on 3 March 2025.'], today, '2026-11-10T08:00:00Z')).toEqual([]);
  });
  it('a no-year day early in the next year resolves forward', () => {
    expect(staleDatesIn(['It turns on 5 January.'], today, '2026-11-10T08:00:00Z')).toEqual([]);
  });
});

describe('named periods', () => {
  it('orders by start, merges same-end windows, names by held tone, flags past, keeps own text', () => {
    const p = periodsFrom(
      [
        w('2026-12-05', '2027-06-03', { tone: 'light', headline: 'Build again.', text: ['Lighter months.'] }),
        w('2025-03-29', '2026-12-05', { tone: 'heavy', headline: 'Keep your evenings.', text: ['A long strain.'] }),
        w('2026-06-01', '2026-12-05', { headline: 'Same end.', text: ['Merged in.'] }),
        w('2026-08-01', '2026-10-01', { tone: 'mixed', headline: 'Over now.', text: ['It passed.'] }),
      ],
      today,
      { max: 6, pastDays: 180 },
    );
    expect(p.map((x) => [x.id, x.name, x.from, x.to, x.current, x.passed])).toEqual([
      ['p1', 'Heavy stretch', '2025-03-29', '2026-12-05', true, false],
      ['p2', 'Mixed stretch', '2026-08-01', '2026-10-01', false, true],
      ['p3', 'Lighter stretch', '2026-12-05', '2027-06-03', false, false],
    ]);
    expect(p[0]!.label).toBe('Heavy stretch · 29 Mar 2025 – 5 Dec 2026');
    expect(p[0]!.text).toEqual(['A long strain.', 'Merged in.']);
    expect(p[2]).toMatchObject({ headline: 'Build again.', text: ['Lighter months.'] });
  });
  it('a window with no text of its own is not a period; the headline comes from its first sentence', () => {
    const p = periodsFrom([w('2026-10-01', '2027-01-01'), w('2027-01-01', '2028-02-16', { text: ['A new phase begins. It asks for patience.'] })], today);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: 'Next stretch', headline: 'A new phase begins.', text: ['It asks for patience.'] });
  });
  it('drops passed periods past the horizon and caps the count, oldest passed first', () => {
    const ws = Array.from({ length: 8 }, (_, i) => w(`2026-0${i + 1}-01`, `2026-0${i + 1}-20`, { headline: `h${i}` }));
    const p = periodsFrom([...ws, w('2027-01-01', '2027-02-01', { headline: 'future' })], today, { max: 3, pastDays: 365 });
    expect(p.map((x) => x.headline)).toEqual(['h6', 'h7', 'future']);
  });
});

describe('key dates', () => {
  it('starts and ends in plain words; a shared day is the next window start; past marked; old dropped', () => {
    const k = keyDatesFrom(
      [w('2019-01-01', '2026-11-11', { tone: 'heavy' }), w('2026-11-11', '2027-01-01', { tone: 'light' }), w('2027-01-01', '2028-02-16')],
      today,
      { max: 6, pastDays: 60 },
    );
    expect(k).toEqual([
      { date: '2026-11-11', label: 'Lighter stretch begins', tone: 'light', passed: true },
      { date: '2027-01-01', label: 'Next stretch begins', tone: null, passed: false },
      { date: '2028-02-16', label: 'Next stretch ends', tone: null, passed: false },
    ]);
  });
});

describe('card names', () => {
  it('renames and subtitles', () => {
    expect(cardDef('stuck')!.title).toBe("What's weighing on you");
    expect(cardDef('yogas')!.title).toBe('Your strengths and sticking points');
    expect(cardDef('diagnosis')!.title).toBe('Your life right now');
    expect(cardDef('chapters')!.title).toBe('Your life phases: before, now, next');
    expect(cardDef('body')!.subtitle).toBe('How to pace yourself');
  });
  it('This year is named by the annual chart dates', () => {
    expect(yearTitle({ from: '2026-10-09', to: '2027-10-09' })).toBe('Your year: Oct 2026 to Oct 2027');
    expect(yearTitle(null)).toBe('Your year');
  });
  it('This chapter is not suggested, folds into life phases, and stays resolvable', () => {
    expect(defaultSuggested()).not.toContain('chapter');
    expect(defaultSuggested()).toContain('chapters');
    expect(cardDef('chapter')).toMatchObject({ foldedInto: 'chapters', offered: true });
  });
});

describe('card views (doc 75 fields)', () => {
  const card = (areaId: string, headline: string, body: string[], dates: Array<{ from: string; to: string; label: string }>) => ({
    areaId,
    headline,
    body,
    patterns: [],
    ladder: null,
    dates,
    certainty: 'likely',
    sources: [],
  });
  const area = (id: string, c: ReturnType<typeof card>, extra: Record<string, unknown> = {}) => ({ id, group: 'you', title: id, status: 'ok', card: c, floor: [], rangeLabel: '', details: { headline: 'Rahu Mahadasha ()', paragraphs: ['1st house (,) strong.'], evidence: [] }, ...extra });
  const v2 = {
    status: 'ok',
    builtAt: '2026-11-10T08:00:00Z',
    nextCheck: null,
    clock: { system: 'vimsottari', label: 'Main clock', reason: 'default', reasonLine: '', applicable: [], notApplicable: [] },
    hero: null,
    areas: [
      area('stuck', card('stuck', 'The Mahadasha presses. Mental relief arrives on 11 November.', ['The pressure eases on 2026-12-05 and you can breathe.'], [{ from: '2026-05-18', to: '2026-12-05', label: 'thin rest' }])),
      area('chapter', card('chapter', 'You are in a long stretch.', ['This stretch runs to 2027-01-01 and asks patience.'], [{ from: '2026-01-01', to: '2027-01-01', label: 'patience' }])),
      area('chapters', card('chapters', 'Your life moves in long phases.', ['From 2027-01-01 to 2028-02-16 a new phase opens.'], [{ from: '2027-01-01', to: '2028-02-16', label: 'a new phase' }])),
      area('year', card('year', 'This year asks steadiness.', [], []), { range: { from: '2026-10-09', to: '2027-10-09' } }),
    ],
    profile: { ageBand: null, hasGender: false, missing: [] },
    refresh: { madeAt: null, validUntil: null, due: false, building: false, failed: false },
    build: { state: 'none' },
  } as never;
  const views = cardViews({ v2, today });
  const byId = (id: string) => views.find((v) => v.id === id)!;

  it('Read text is plain and the headline falls back past a dropped sentence; Chart details lose empty references', () => {
    const s = byId('stuck');
    expect(s.v2!.card!.headline).toBe('Mental relief arrives on 11 November.');
    expect(s.v2!.card!.body).toEqual(['The pressure eases on 5 Dec 2026 and you can breathe.']);
    expect(s.v2!.details).toMatchObject({ headline: 'Rahu Mahadasha', paragraphs: ['1st house strong.'] });
  });
  it('stale flag and named period with its own text', () => {
    const s = byId('stuck');
    expect(s).toMatchObject({ stale: true, staleDates: ['2026-11-11'], title: "What's weighing on you", subtitle: 'What gets under your skin, and until when' });
    expect(s.periods).toEqual([
      expect.objectContaining({ name: 'Thin rest', from: '2026-05-18', to: '2026-12-05', current: true, headline: 'The pressure eases on 5 Dec 2026 and you can breathe.' }),
    ]);
    expect(s.keyDates).toEqual([{ date: '2026-12-05', label: 'Thin rest ends', tone: null, passed: false }]);
  });
  it('life phases carry This chapter as their now; the year is named by its dates', () => {
    const c = byId('chapters');
    expect(c.periods.map((p) => [p.from, p.to, p.current])).toEqual([
      ['2026-01-01', '2027-01-01', true],
      ['2027-01-01', '2028-02-16', false],
    ]);
    expect(byId('chapter').foldedInto).toBe('chapters');
    expect(byId('year').title).toBe('Your year: Oct 2026 to Oct 2027');
  });
  it('rail labels carry real dates, never "now →"', () => {
    expect(railFromDates([{ from: '2026-05-18', to: '2026-12-05', label: 'x' }], today)[0]!.label).toBe('18 May 2026 → 5 Dec 2026');
  });
});
