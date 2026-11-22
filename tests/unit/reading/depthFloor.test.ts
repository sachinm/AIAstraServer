/**
 * AGENTS.md "Reading depth is a release gate", rule 1 (docs/techniques/09 §5): every stored card has a technical story
 * of at least 700 words that cites, by evidence key, the maha dasha and sub-period with their system, the year chart,
 * D9, the card's own divisional chart and at least two verified dasha systems; and a plain story of at least 350 words.
 * Word counts and evidence-key kinds only; no word lists.
 */
import { describe, expect, it } from 'vitest';
import { checkDepth, classifyKey, depthRepairNote, kindCoverage, parseBeats, PLAIN_STORY_MIN_WORDS, STORY_BEATS, TECH_STORY_MIN_WORDS, wordCount } from '../../../src/reading/cards/story.js';

const words = (n: number, w = 'word') => Array.from({ length: n }, () => w).join(' ');

/** a card as the new Oracle writes it: the story and the beat index's keys */
const deep = {
  story: words(TECH_STORY_MIN_WORDS + 50),
  evidence: [
    'pressure:dasha:vimsottari/1/Ra@2020-01-01',
    'pressure:dasha:vimsottari/2/Sa@2026-06-01',
    'pressure:dasha:narayana/1/Le@2025-01-01',
    'pressure:annual:TP2026/2/Sa',
    'planet:D9.Ju',
    'house:D10.h10',
  ],
  ownCharts: ['D10'],
  verifiedSystems: ['vimsottari', 'narayana', 'sudasa'],
  plainStory: words(PLAIN_STORY_MIN_WORDS + 10),
};

/** a card as the group call wrote it on 2026-11-18: one sentence of gift, one of knot, one stretch */
const today = {
  story: 'Your work asks more of you than it gives until March. The gift is steadiness; the knot is pace.',
  evidence: ['ledger:s1/career_and_standing', 'pressure:dasha:vimsottari/3/Sa@2026-10-01'],
  ownCharts: ['D10'],
  verifiedSystems: ['vimsottari', 'narayana'],
  plainStory: 'Work asks more of you until March.',
};

describe('classifyKey: the kind of a key from its spelling', () => {
  it('reads dasha periods with their system and level', () => {
    expect(classifyKey('pressure:dasha:vimsottari/1/Ra@2020-01-01')).toEqual({ kind: 'dasha', system: 'vimsottari', level: 1 });
    expect(classifyKey('{activation:dwisatpathi/2/Ve@2025-11-16}')).toEqual({ kind: 'dasha', system: 'dwisatpathi', level: 2 });
    expect(classifyKey('pressure:dasha:chathuraaseethi_sama/2/Ma@2025-11-03')).toMatchObject({ system: 'chathuraaseethi_sama', level: 2 });
  });
  it('reads the year chart and divisional charts', () => {
    expect(classifyKey('pressure:annual:TP2026').kind).toBe('year');
    expect(classifyKey('annual:TP2026.D1').kind).toBe('year');
    expect(classifyKey('planet:D9.Su')).toEqual({ kind: 'varga', varga: 'D9' });
    expect(classifyKey('house:D10.h7')).toEqual({ kind: 'varga', varga: 'D10' });
    expect(classifyKey('ledger:s1/partnership').kind).toBe('other');
  });
});

describe('checkDepth: the floor', () => {
  it('passes a deep card', () => {
    const r = checkDepth(deep);
    expect(r.gaps).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.coverage).toMatchObject({ maha: true, sub: true, year: true, d9: true, ownCharts: ['D10'], verifiedSystems: ['narayana', 'vimsottari'] });
  });

  it("fails today's card on every count", () => {
    const r = checkDepth(today);
    expect(r.ok).toBe(false);
    expect(r.gaps.map((g) => g.kind).sort()).toEqual(['d9', 'maha', 'own_chart', 'plain_words', 'story_words', 'sub', 'systems', 'year'].sort());
  });

  it('fails a long story that cites no year chart, and one with a single system', () => {
    expect(checkDepth({ ...deep, evidence: deep.evidence.filter((k) => !k.includes('annual')) }).gaps.map((g) => g.kind)).toEqual(['year']);
    const one = deep.evidence.filter((k) => !k.includes('narayana'));
    expect(checkDepth({ ...deep, evidence: one }).gaps.map((g) => g.kind)).toEqual(['systems']);
  });

  it('counts only verified systems toward the two', () => {
    const r = checkDepth({ ...deep, verifiedSystems: ['vimsottari'] });
    expect(r.gaps.map((g) => g.kind)).toEqual(['systems']);
  });

  it('needs the card own chart, not D9 alone, when the card has one', () => {
    expect(checkDepth({ ...deep, evidence: deep.evidence.filter((k) => !k.startsWith('house:D10')) }).gaps.map((g) => g.kind)).toEqual(['own_chart']);
    expect(checkDepth({ ...deep, ownCharts: ['D9'], evidence: deep.evidence.filter((k) => !k.startsWith('house:D10')) }).ok).toBe(true);
  });

  it('a short plain story fails the plain half only', () => {
    const r = checkDepth({ ...deep, plainStory: words(PLAIN_STORY_MIN_WORDS - 1) });
    expect(r.technicalOk).toBe(true);
    expect(r.plainOk).toBe(false);
    expect(r.ok).toBe(false);
  });

  it('marks a kind the input never carried as unavailable (filed, not repaired)', () => {
    const noYear = deep.evidence.filter((k) => !k.includes('annual'));
    const r = checkDepth({ ...deep, evidence: noYear, available: noYear });
    expect(r.gaps).toEqual([expect.objectContaining({ kind: 'year', unavailable: true })]);
    expect(depthRepairNote(r)).toBeNull();
    const r2 = checkDepth({ ...deep, evidence: noYear, available: deep.evidence });
    expect(r2.gaps[0]!.unavailable).toBe(false);
    expect(depthRepairNote(r2)).toContain('year chart');
  });

  it('counts words, not characters; braces in the story count as cited keys', () => {
    expect(wordCount('  one two\nthree  ')).toBe(3);
    const r = checkDepth({ ...deep, evidence: [], story: `${deep.story} ${deep.evidence.map((k) => `{${k}}`).join(' ')}` });
    expect(r.technicalOk).toBe(true);
  });
});

describe('beat index', () => {
  it('keeps the nine beats in order and drops unknown ones', () => {
    const raw = [...STORY_BEATS].reverse().map((beat) => ({ beat, held: 'yes', systems: ['vimsottari'], evidence: ['{planet:D9.Su}'] }));
    const b = parseBeats([...raw, { beat: 'gossip', held: 'yes', systems: [], evidence: [] }]);
    expect(b.map((x) => x.beat)).toEqual([...STORY_BEATS]);
    expect(b[0]!.evidence).toEqual(['planet:D9.Su']);
  });
  it('kindCoverage is order free', () => {
    expect(kindCoverage([...deep.evidence].reverse(), ['D10'])).toEqual(kindCoverage(deep.evidence, ['D10']));
  });
});

describe('depth replay row (scripts/depth-replay.ts)', async () => {
  const { depthRowOf, depthSummary, depthTable } = await import('../../../src/reading/cards/depthReplay.js');
  it("measures an old-schema row on what its Oracle wrote, and fails it", () => {
    const r = depthRowOf({
      card: 'drive',
      oracle: { headline: 'Work asks more until March.', gift: 'steady', knot: 'pace', spans: [{ asks: 'hold', obstacle: 'load', agreement: '3 of 4', evidence: ['pressure:dasha:vimsottari/3/Sa@2026-10-01', 'ledger:s1/career_and_standing'] }], evidence: [] },
      personal: { line: 'Work asks more of you until 2 Mar 2027.', spans: [{ asks: 'a', obstacle: 'b', step: 'If x, then y.' }] },
    });
    expect(r).toMatchObject({ card: 'drive', schema: 'old', floor: 'fail', systems: ['vimsottari'], charts: [] });
    expect(r.technicalWords).toBeLessThan(30);
    expect(depthTable([r])).toContain('| drive | old |');
    expect(depthSummary([r])).toMatchObject({ cards: 1, pass: 0 });
  });
  it('measures a new-schema row on its story and beats', () => {
    const r = depthRowOf({ card: 'drive', oracle: { story: deep.story, beats: [{ evidence: deep.evidence }], evidence: [] }, personal: { story: deep.plainStory } });
    expect(r).toMatchObject({ schema: 'new', floor: 'pass', charts: ['D10', 'D9', 'year'] });
  });
});
