import { describe, expect, it } from 'vitest';
import { concordanceSchema, CONCORDANCE_MAX_OUTPUT_TOKENS, countConcordance, ledgerFromCount, renderCount, runConcordance, statusOf, validateLedger } from '../../../../src/reading/clocks/concordance.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
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
    ['3 heavy + 2 light', tally(3, 0, 2), 'contested', null],
    ['4 heavy + 2 light', tally(4, 0, 2), 'contested', null],
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

describe('the concordance input and answer, trimmed (doc 70 Phase 3 replay fixes)', () => {
  const sheets = [
    sheet('vimsottari', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }, { span: 's1', matter: 'self_and_body', tone: 'mixed' }]),
    sheet('narayana', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'light' }]),
    sheet('yogini', [{ span: 's1', matter: 'career_and_standing', tone: 'heavy' }, { span: 's2', matter: 'career_and_standing', tone: 'heavy' }]),
    sheet('tithi_pravesha', [{ span: 's1', matter: 'career_and_standing', tone: 'light' }]),
  ];
  const count = countConcordance(sheets, ['s1', 's2']);

  it('the count sent: no evidence key, no strength, no pair table; the agreeing clocks speak, the others by tone; a single cell is not sent', () => {
    const t = renderCount(count);
    expect(t).not.toMatch(/\{pressure:|evidence|strength=|PAIRS/);
    expect(t).toContain('ledger:s1/career_and_standing status=confirmed tone=heavy');
    expect(t).toContain('  vimsottari: heavy "vimsottari says heavy"');
    expect(t).toContain('  apart: tithi_pravesha=light');
    expect(t).not.toContain('tithi_pravesha: light "');
    // contested: every clock with its sentence
    expect(t).toContain('  yogini: heavy "yogini says heavy"');
    expect(t).toContain('  narayana: light "narayana says light"');
    expect(t).not.toContain('ledger:s1/self_and_body');
  });

  it('the schema asks for the words only: id, sentence, sides', () => {
    const item = ((concordanceSchema(['a'], ['vimsottari']).properties as Record<string, { items: { properties: Record<string, unknown>; required: string[] } }>).cells.items);
    expect(Object.keys(item.properties).sort()).toEqual(['id', 'sentence', 'sides']);
    expect(item.required).toEqual(['id', 'sentence', 'sides']);
  });

  it('a words-only answer is kept with the count status, tone and the counted keys', () => {
    const base = ledgerFromCount(count, 'fh', {});
    const v = validateLedger(
      [
        { id: 'ledger:s1/career_and_standing', sentence: 'Work presses in this span.', sides: [] },
        { id: 'ledger:s2/career_and_standing', sentence: '', sides: [{ tone: 'light', clocks: ['vimsottari', 'narayana'], restsOn: 'support' }, { tone: 'heavy', clocks: ['yogini'], restsOn: 'pressure' }] },
      ],
      count,
      base,
    );
    expect(v.issues).toEqual([]);
    const s1 = v.ledger.cells.find((c) => c.id === 'ledger:s1/career_and_standing')!;
    expect(s1).toMatchObject({ status: 'confirmed', tone: 'heavy', sentence: 'Work presses in this span.' });
    expect(s1.evidence).toEqual(base.cells.find((c) => c.id === s1.id)!.evidence);
  });

  it('the call: minimal thinking, a 6 k output cap, the trimmed count as the uncached part (fake model)', async () => {
    const seen: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions): Promise<GeminiResult> => {
      seen.push(o);
      return { text: JSON.stringify({ cells: [{ id: 'ledger:s1/career_and_standing', sentence: 'Work presses.', sides: [] }] }), usage: { promptTokens: 10, cachedTokens: 0, outputTokens: 5, thoughtTokens: 0 } as never, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false };
    };
    const frame = { asOf: '2026-11-10', to: '2027-11-10', spans: [{ id: 's1', from: '2026-11-01', to: '2027-02-01', place: 'now' }, { id: 's2', from: '2027-02-01', to: '2027-11-10', place: 'next' }] } as never;
    const r = await runConcordance(
      { prisma: new Proxy({}, { get: () => undefined }) as never, callGemini, maxSpendUsd: 1, now: new Date('2026-11-10T12:00:00Z') },
      { ctx: { userId: 'u', kundliId: 'k', asOf: '2026-11-10' }, frame, prefix: { text: 'PREFIX', keys: [], hash: 'ph', rows: new Map() }, sheets, model: 'gemini-3.8-flash', frameHash: 'fh', overBudget: false },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.thinking).toBe('minimal');
    expect(seen[0]!.maxOutputTokens).toBe(CONCORDANCE_MAX_OUTPUT_TOKENS);
    expect(CONCORDANCE_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(6144);
    expect(seen[0]!.parts[0]).toBe('PREFIX');
    expect(seen[0]!.parts[1]).toContain(renderCount(count));
    expect(r.ledger.cells.find((c) => c.id === 'ledger:s1/career_and_standing')!.sentence).toBe('Work presses.');
    // the contested cell was not written: it keeps the count, and the gap is recorded
    expect(r.issues.map((i) => i.check)).toEqual(['missing_cell']);
  });
});
