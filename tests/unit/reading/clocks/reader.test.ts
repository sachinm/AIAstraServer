import { describe, expect, it } from 'vitest';
import { CELL_ASK_WORDS, CELL_MAX_WORDS, clockReaderSchema, sharedPrefix, validateClockSheet, type ReaderCheckContext } from '../../../../src/reading/clocks/reader.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import { pickClockLayerSlices } from '../../../../src/reading/clocks/run.js';
import { parseRowLines, renderSliceSet } from '../../../../src/reading/slices/index.js';
import { frame, inventories, natal } from '../slices/fixtures.js';

const set = renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() });
const picked = pickClockLayerSlices(set).picked!;
const prefix = sharedPrefix(picked.shared);
const vim = picked.clocks.find((s) => s.id === 'clock.vimsottari')!;
const ctx = (): ReaderCheckContext => {
  const clockRows = parseRowLines(vim.text);
  const rows = new Map(prefix.rows);
  for (const [k, r] of clockRows) rows.set(k, r);
  return { system: 'vimsottari', spans: frame().spans, allowedKeys: new Set([...prefix.keys, ...vim.keys]), clockRows, rows };
};
const SA = 'pressure:dasha:vimsottari/2/Sa@2026-06-01';
const ME = 'pressure:dasha:vimsottari/2/Me@2027-03-01';
const cell = (extra: Record<string, unknown> = {}) => ({ span: 's1', matter: 'career_and_standing', tone: 'heavy', sentence: 'The Saturn sub-period loads the tenth.', strength: 2, evidence: [SA], ...extra });

describe('the shared prefix', () => {
  it('is natal.core, sky.window, year.tp and frame, and carries no clock', () => {
    expect(picked.clocks.map((s) => s.id)).toEqual(['clock.narayana', 'clock.vimsottari', 'clock.yogini', 'clock.tithi_pravesha']);
    expect(prefix.text.indexOf('# NATAL SLICE')).toBe(0);
    expect(prefix.text.indexOf('# SKY WINDOW')).toBeLessThan(prefix.text.indexOf('# YEAR TP'));
    expect(prefix.text.indexOf('# YEAR TP')).toBeLessThan(prefix.text.indexOf('# FRAME'));
    expect(prefix.text).not.toContain('pressure:dasha:');
    expect(sharedPrefix(pickClockLayerSlices(renderSliceSet({ frame: frame(), inventories: [...inventories()].reverse(), natal: natal() })).picked!.shared).hash).toBe(prefix.hash);
  });
});

describe('validateClockSheet', () => {
  it('keeps a good cell', () => {
    const v = validateClockSheet([cell()], ctx());
    expect(v.issues).toEqual([]);
    expect(v.cells).toEqual([{ span: 's1', matter: 'career_and_standing', tone: 'heavy', sentence: 'The Saturn sub-period loads the tenth.', strength: 2, evidence: [SA] }]);
  });

  it('drops a cell with a key that is not in its input (another clock, or made up)', () => {
    const v = validateClockSheet([cell({ evidence: [SA, 'pressure:dasha:narayana/1/Le@2025-01-01'] }), cell({ span: 's2', evidence: ['pressure:dasha:vimsottari/9/Xx'] })], ctx());
    expect(v.cells).toEqual([]);
    expect(v.issues.map((i) => i.check)).toEqual(['unknown_evidence_key', 'unknown_evidence_key']);
  });

  it('drops a tone that contradicts the engine polarity of the cited rows', () => {
    const v = validateClockSheet([cell({ tone: 'light' }), cell({ span: 's3', evidence: [ME], tone: 'heavy' })], ctx());
    expect(v.cells).toEqual([]);
    expect(v.issues.map((i) => i.check)).toEqual(['tone_contradicts_polarity', 'tone_contradicts_polarity']);
  });

  it('rows of two polarities allow only mixed', () => {
    const both = { span: 's2', evidence: [SA, ME] };
    expect(validateClockSheet([cell({ ...both, tone: 'heavy' })], ctx()).issues[0]!.check).toBe('tone_contradicts_polarity');
    expect(validateClockSheet([cell({ ...both, tone: 'mixed' })], ctx()).cells).toHaveLength(1);
    // a supporting sky row cited beside a pressing period: mixed only
    expect(validateClockSheet([cell({ evidence: [SA, 'pressure:transit:Ju/h11@2026-10-01'] })], ctx()).issues[0]!.check).toBe('tone_contradicts_polarity');
  });

  it('drops an unknown span, a cell with no row of its own clock, a row outside the span, a matter not in the rows', () => {
    const v = validateClockSheet(
      [
        cell({ span: 's9' }),
        cell({ evidence: ['pressure:transit:Ju/h11@2026-10-01'], tone: 'light', matter: 'gains_and_network' }),
        cell({ span: 's3' }),
        cell({ matter: 'partnership' }),
      ],
      ctx(),
    );
    expect(v.cells).toEqual([]);
    expect(v.issues.map((i) => i.check)).toEqual(['unknown_span', 'no_clock_row', 'row_outside_span', 'matter_not_in_rows']);
  });

  it('drops a bad strength, a long sentence and a second cell for the same span and matter', () => {
    const long = Array.from({ length: 26 }, () => 'word').join(' ');
    const v = validateClockSheet([cell({ strength: 4 }), cell({ sentence: long }), cell(), cell({ sentence: 'Again.' })], ctx());
    expect(v.cells).toHaveLength(1);
    expect(v.issues.map((i) => i.check)).toEqual(['bad_strength', 'bad_sentence', 'duplicate_cell']);
  });

  it('accepts braces and orders cells by span then matter', () => {
    const v = validateClockSheet([cell({ span: 's2', tone: 'mixed', evidence: [`{${SA}}`, ME] }), cell({ matter: 'self_and_body', tone: 'mixed', evidence: ['pressure:dasha:vimsottari/1/Ra@2020-01-01'] }), cell()], ctx());
    expect(v.cells.map((c) => `${c.span}/${c.matter}`)).toEqual(['s1/career_and_standing', 's1/self_and_body', 's2/career_and_standing']);
    expect(v.cells[2]!.evidence).toEqual([SA, ME]);
  });
});

describe('the reader asks for less than it accepts (doc 70 Phase 3 replay fixes)', () => {
  it('the prompt and the schema ask for 15 words and three keys; the validator still allows 25 words', () => {
    expect(CELL_ASK_WORDS).toBe(15);
    expect(CELL_MAX_WORDS).toBe(25);
    const item = (clockReaderSchema(['s1'], []).properties as { cells: { items: { properties: Record<string, { description?: string }> } } }).cells.items.properties;
    expect(item.sentence!.description).toContain('at most 15 words');
    expect(item.evidence!.description).toContain('at most three');
    expect(PROMPTS['clock/reader']).toContain('at most 15 words');
    expect(PROMPTS['clock/reader']).toContain('at most three');
  });
});
