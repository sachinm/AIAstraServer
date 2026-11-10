import { describe, expect, it } from 'vitest';
import { countConcordance, ledgerFromCount, statusOf, validateLedger } from '../../../../src/reading/clocks/concordance.js';
import type { ClockCell, ClockSheet, ClockTone } from '../../../../src/reading/clocks/types.js';

const sheet = (system: string, cells: Array<Partial<ClockCell> & { span: string; matter: string; tone: ClockTone }>): ClockSheet => ({
  system,
  status: 'ok',
  cells: cells.map((c) => ({ sentence: `${system} says ${c.tone}`, strength: 2, evidence: [`pressure:dasha:${system}/${c.span}`], ...c })),
  issues: [],
  model: 'm',
  sliceHash: 'x',
  prefixHash: 'p',
  hash: `h-${system}`,
});

const tally = (heavy: number, mixed: number, light: number) => ({ heavy, mixed, light });

describe('statusOf: the count rules (doc 70 §4.1)', () => {
  it.each([
    ['3 heavy', tally(3, 0, 0), 'confirmed', 'heavy'],
    ['4 light', tally(0, 0, 4), 'confirmed', 'light'],
    ['3 mixed + 1 heavy', tally(1, 3, 0), 'confirmed', 'mixed'],
    // dissent does not lower a confirmed cell: "3 or more clocks give the same tone" (opposed is counted, see below)
    ['3 heavy + 1 light', tally(3, 0, 1), 'confirmed', 'heavy'],
    // a tie at three is no agreement, and it is heavy against light
    ['3 heavy + 3 light', tally(3, 0, 3), 'contested', null],
    ['2 heavy + 1 light: 2 agree but one opposes', tally(2, 0, 1), 'contested', null],
    ['1 heavy + 1 light', tally(1, 0, 1), 'contested', null],
    ['heavy, mixed, light', tally(1, 1, 1), 'contested', null],
    // "exactly 2 agree, none opposes": opposes means heavy against light; mixed opposes nothing
    ['2 heavy + 1 mixed', tally(2, 1, 0), 'leaning', 'heavy'],
    ['2 light', tally(0, 0, 2), 'leaning', 'light'],
    ['2 mixed + 1 heavy', tally(1, 2, 0), 'leaning', 'mixed'],
    ['2 heavy + 2 mixed: two pairs, no one tone agreed', tally(2, 2, 0), 'single', null],
    ['1 clock', tally(0, 1, 0), 'single', 'mixed'],
    ['heavy + mixed: no two agree', tally(1, 1, 0), 'single', null],
  ])('%s → %s', (_name, t, status, tone) => {
    expect(statusOf(t)).toEqual({ status, tone });
  });
});

describe('countConcordance', () => {
  const sheets = [
    sheet('vimsottari', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }, { span: 's1', matter: 'self_and_body', tone: 'mixed' }]),
    sheet('narayana', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }]),
    sheet('yogini', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'heavy' }]),
    sheet('tithi_pravesha', [{ span: 's1', matter: 'career_and_standing', tone: 'light' }]),
  ];

  it('joins by span and matter, counts identical tones, and sets the status', () => {
    const c = countConcordance(sheets, ['s1', 's2']);
    expect(c.systems).toEqual(['vimsottari', 'narayana', 'yogini', 'tithi_pravesha']);
    const s1 = c.cells.find((x) => x.id === 'ledger:s1/career_and_standing')!;
    expect(s1).toMatchObject({ status: 'confirmed', tone: 'heavy', agree: 3, of: 4, opposed: 1, tally: { heavy: 3, mixed: 0, light: 1 } });
    expect(c.cells.find((x) => x.id === 'ledger:s2/career_and_standing')).toMatchObject({ status: 'contested', tone: null, of: 3 });
    expect(c.cells.find((x) => x.id === 'ledger:s1/self_and_body')).toMatchObject({ status: 'single', tone: 'mixed', agree: 1, of: 1 });
    expect(c.cells.map((x) => x.id)).toEqual(['ledger:s1/career_and_standing', 'ledger:s1/self_and_body', 'ledger:s2/career_and_standing']);
    expect(c.byStatus).toEqual({ confirmed: 1, leaning: 0, single: 1, contested: 1 });
  });

  it('writes the pair table: cells both read, cells they agree on', () => {
    const c = countConcordance(sheets, ['s1', 's2']);
    expect(c.pairs).toHaveLength(6);
    expect(c.pairs.find((p) => p.a === 'vimsottari' && p.b === 'narayana')).toEqual({ a: 'vimsottari', b: 'narayana', both: 2, agree: 2 });
    expect(c.pairs.find((p) => p.a === 'vimsottari' && p.b === 'yogini')).toEqual({ a: 'vimsottari', b: 'yogini', both: 2, agree: 1 });
    expect(c.pairs.find((p) => p.a === 'yogini' && p.b === 'tithi_pravesha')).toEqual({ a: 'yogini', b: 'tithi_pravesha', both: 1, agree: 0 });
  });

  it('leaves out failed and empty sheets', () => {
    const c = countConcordance([...sheets, { ...sheet('chara', [{ span: 's1', matter: 'career_and_standing', tone: 'light' }]), status: 'failed' }, sheet('kaala', [])]);
    expect(c.systems).toEqual(['vimsottari', 'narayana', 'yogini', 'tithi_pravesha']);
  });
});

describe('validateLedger: the agent cannot change the count', () => {
  const sheets = [
    sheet('vimsottari', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }, { span: 's1', matter: 'self_and_body', tone: 'mixed' }, { span: 's3', matter: 'home_and_peace', tone: 'light' }]),
    sheet('narayana', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }, { span: 's3', matter: 'home_and_peace', tone: 'light' }]),
    sheet('yogini', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'heavy' }]),
  ];
  const count = countConcordance(sheets, ['s1', 's2', 's3']);
  const base = ledgerFromCount(count, 'fh', { a: '1' });
  const good = [
    { id: 'ledger:s1/career_and_standing', status: 'confirmed', tone: 'heavy', sentence: 'All three clocks put work under strain in this span.', sides: [], evidence: ['pressure:dasha:vimsottari/s1'] },
    { id: 'ledger:s3/home_and_peace', status: 'leaning', tone: 'light', sentence: 'Home may settle.', sides: [], evidence: [] },
    {
      id: 'ledger:s2/career_and_standing',
      status: 'contested',
      tone: 'none',
      sentence: '',
      sides: [
        { tone: 'light', clocks: ['narayana', 'vimsottari'], restsOn: 'a supporting period lord in the tenth' },
        { tone: 'heavy', clocks: ['yogini'], restsOn: 'a pressing period lord' },
      ],
      evidence: ['pressure:dasha:yogini/s2'],
    },
  ];

  it('keeps valid words and the count status and tone of every cell', () => {
    const v = validateLedger(good, count, base);
    expect(v.issues).toEqual([]);
    const by = Object.fromEntries(v.ledger.cells.map((c) => [c.id, c]));
    expect(by['ledger:s1/career_and_standing']).toMatchObject({ status: 'confirmed', tone: 'heavy', sentence: 'All three clocks put work under strain in this span.' });
    expect(by['ledger:s2/career_and_standing']!.sides!.map((s) => [s.tone, s.clocks])).toEqual([
      ['heavy', ['yogini']],
      ['light', ['vimsottari', 'narayana']],
    ]);
    expect(by['ledger:s1/self_and_body']).toMatchObject({ status: 'single', sentence: null, sides: null });
  });

  it('a status cannot be raised: a leaning cell written as confirmed, or a single cell written at all, is dropped', () => {
    const v = validateLedger(
      [
        { ...good[1], status: 'confirmed' },
        { id: 'ledger:s1/self_and_body', status: 'confirmed', tone: 'mixed', sentence: 'Settled.', sides: [], evidence: [] },
        { id: 'ledger:s9/career_and_standing', status: 'confirmed', tone: 'heavy', sentence: 'Made up.', sides: [], evidence: [] },
      ],
      count,
      base,
    );
    const by = Object.fromEntries(v.ledger.cells.map((c) => [c.id, c]));
    expect(by['ledger:s3/home_and_peace']).toMatchObject({ status: 'leaning', sentence: null });
    expect(by['ledger:s1/self_and_body']).toMatchObject({ status: 'single', sentence: null });
    expect(by['ledger:s9/career_and_standing']).toBeUndefined();
    expect(v.ledger.cells).toHaveLength(count.cells.length);
    expect(v.issues.map((i) => i.check)).toEqual(expect.arrayContaining(['status_changed', 'unknown_cell', 'unknown_cell', 'missing_cell']));
  });

  it('a tone change, a key from another cell and a one-sided contest are dropped', () => {
    const v = validateLedger(
      [
        { ...good[0], tone: 'mixed' },
        { ...good[1], evidence: ['pressure:dasha:yogini/s2'] },
        { ...good[2], sides: [good[2]!.sides[0]] },
      ],
      count,
      base,
    );
    expect(v.issues.map((i) => i.check).sort()).toEqual(['bad_sides', 'tone_changed', 'unknown_evidence_key']);
    expect(v.ledger.cells.every((c) => c.sentence === null && c.sides === null)).toBe(true);
  });

  it('a side may name only the clocks that gave that tone', () => {
    const bad = { ...good[2], sides: [{ tone: 'light', clocks: ['yogini'], restsOn: 'x' }, good[2]!.sides[1]] };
    const v = validateLedger([bad], count, base);
    expect(v.issues.find((i) => i.check === 'bad_sides')?.message).toMatch(/names clocks that did not give it/);
  });
});
