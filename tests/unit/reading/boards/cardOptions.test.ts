/**
 * Card options (docs/reading-engine/71 §4.3, §4.4): validation, the sections each choice means, the Self card shaped by
 * its options, and the plain notes where an option cannot be honoured yet.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_OPTIONS,
  OPTION_NOTE,
  areaOptionNotes,
  optionsFromRow,
  sectionsFor,
  selfOptionNotes,
  shapeSelfCard,
  validateCardOptions,
} from '../../../../src/reading/boards/cardOptions.js';

describe('validateCardOptions', () => {
  it('accepts known values, drops defaults and cards not on the board', () => {
    const r = validateCardOptions({ body: { length: 'glance', view: 'year' }, mind: { plan: 'without' }, gone: { length: 'deep' } }, ['body', 'mind']);
    expect(r).toEqual({ ok: true, options: { body: { length: 'glance' }, mind: { plan: 'without' } } });
  });
  it('missing options is no change', () => {
    expect(validateCardOptions(undefined, ['body'])).toEqual({ ok: true, options: {} });
  });
  it('refuses an unknown key or value with its place', () => {
    expect(validateCardOptions({ body: { colour: 'red' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option', detail: 'body.colour' });
    expect(validateCardOptions({ body: { length: 'huge' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
    expect(validateCardOptions([], ['body'])).toMatchObject({ ok: false, error: 'bad_body' });
  });
  it('a stored row never throws and keeps only valid choices', () => {
    expect(optionsFromRow({ body: { length: 'deep', x: 1 }, mind: 'no' }, ['body', 'mind'])).toEqual({ body: { length: 'deep' } });
    expect(optionsFromRow(null, ['body'])).toEqual({});
  });
});

describe('sectionsFor', () => {
  it("the defaults are today's four sections", () => {
    expect(sectionsFor(undefined)).toEqual(['line', 'year', 'stretch', 'confirm']);
    expect(sectionsFor(DEFAULT_CARD_OPTIONS)).toEqual(['line', 'year', 'stretch', 'confirm']);
  });
  it('a glance is the line and the year', () => {
    expect(sectionsFor({ length: 'glance' })).toEqual(['line', 'year']);
  });
  it('deep adds the pattern, and the ladder only with a plan', () => {
    expect(sectionsFor({ length: 'deep' })).toEqual(['line', 'year', 'stretch', 'confirm', 'pattern', 'ladder']);
    expect(sectionsFor({ length: 'deep', plan: 'without' })).toEqual(['line', 'year', 'stretch', 'confirm', 'pattern']);
  });
  it('chart terms adds Chart details', () => {
    expect(sectionsFor({ words: 'terms', length: 'glance' })).toEqual(['line', 'year', 'details']);
  });
});

describe('shapeSelfCard', () => {
  const card = {
    id: 'body',
    rail: [
      { current: true, span: 's1' },
      { current: false, span: 's2' },
    ],
    v3: {
      spans: [
        { span: 's1', step: 'If tired, then rest.' },
        { span: 's2', step: 'If calm, then build.' },
      ],
      ladder: { steps: ['a'] } as unknown,
    },
  };
  it('defaults change nothing', () => {
    const s = shapeSelfCard(card, undefined);
    expect(s.rail).toHaveLength(2);
    expect(s.v3?.spans).toHaveLength(2);
    expect(s.options).toEqual(DEFAULT_CARD_OPTIONS);
    expect(s.optionNotes).toEqual([]);
  });
  it('now keeps only the current period', () => {
    const s = shapeSelfCard(card, { view: 'now' });
    expect(s.rail.map((r) => r.span)).toEqual(['s1']);
    expect(s.v3?.spans.map((x) => x.span)).toEqual(['s1']);
  });
  it('without a plan empties the steps and drops the ladder', () => {
    const s = shapeSelfCard(card, { plan: 'without' });
    expect(s.v3?.spans.every((x) => x.step === '')).toBe(true);
    expect(s.v3?.ladder).toBeNull();
  });
  it('a card with no stored reading is left as it is', () => {
    expect(shapeSelfCard({ ...card, v3: null }, { plan: 'without', view: 'now' }).v3).toBeNull();
  });
});

describe('option notes', () => {
  it('the long arc is only honoured on the time cards', () => {
    expect(selfOptionNotes('body', { view: 'arc' })).toEqual([OPTION_NOTE.arcOnlyTime]);
    expect(selfOptionNotes('chapters', { view: 'arc' })).toEqual([]);
  });
  it('deep says plainly that the writing is not longer yet', () => {
    expect(selfOptionNotes('mind', { length: 'deep' })).toEqual([OPTION_NOTE.deepSameText]);
  });
  it('Love and Work say where an option has no effect', () => {
    expect(areaOptionNotes({ plan: 'without', view: 'arc' })).toEqual([OPTION_NOTE.arcAreaBoard, OPTION_NOTE.noPlanLines]);
    expect(areaOptionNotes(undefined)).toEqual([]);
  });
  it('no note names an engine', () => {
    expect(JSON.stringify(OPTION_NOTE)).not.toMatch(/radha|pyjhora/i);
  });
});
