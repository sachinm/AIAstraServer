/**
 * Card options (docs/reading-engine/71 §4.3, §4.4): validation, the sections each choice means, the Self card shaped by
 * its options, and the plain notes where an option cannot be honoured yet.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_OPTIONS,
  OPTION_NOTE,
  areaOptionNotes,
  boardOptionsFromRow,
  defaultBoardOptions,
  defaultCardOptions,
  effectiveOptions,
  optionsFromRow,
  sectionsFor,
  selfOptionNotes,
  shapeSelfCard,
  validateBoardOptions,
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

describe('faces and tools (redesign keys)', () => {
  afterEach(() => {
    for (const k of ['CARD_FACES', 'CARD_FACE', 'CARD_TOOLS', 'CARD_TOOLS_DEFAULT', 'CARD_GROUP_BY', 'CARD_START', 'BOARD_CONFIRM_DEFAULT']) delete process.env[k];
  });
  it('defaults: read face, no tools, quarters, swipe, short', () => {
    expect(defaultCardOptions()).toMatchObject({ face: 'read', tools: [], groupBy: 'quarters', groupsAs: 'swipe', start: 'short' });
    expect(defaultBoardOptions()).toMatchObject({ confirm: true, motion: true });
  });
  it('accepts every new key, keeps tools unique in list order, stores only what differs', () => {
    const r = validateCardOptions(
      { body: { face: 'research', tools: ['plan', 'table'], groupBy: 'months', groupsAs: 'accordion', start: 'full' }, mind: { face: 'read', groupBy: 'quarters', start: 'short', tools: [] } },
      ['body', 'mind'],
    );
    expect(r).toEqual({ ok: true, options: { body: { face: 'research', tools: ['table', 'plan'], groupBy: 'months', groupsAs: 'accordion', start: 'full' } } });
  });
  it('unknown values, unknown tools, duplicate tools and a non-array keep unknown_option', () => {
    expect(validateCardOptions({ body: { face: 'poster' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option', detail: 'body.face=poster' });
    expect(validateCardOptions({ body: { tools: ['table', 'chart'] } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
    expect(validateCardOptions({ body: { tools: ['table', 'table'] } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
    expect(validateCardOptions({ body: { tools: 'table' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
    expect(validateCardOptions({ body: { groupBy: 'days' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
  });
  it('the lists and defaults follow the env', () => {
    process.env.CARD_FACES = 'read,light';
    process.env.CARD_TOOLS_DEFAULT = 'dates,info';
    process.env.CARD_GROUP_BY = 'years';
    expect(validateCardOptions({ body: { face: 'research' } }, ['body'])).toMatchObject({ ok: false, error: 'unknown_option' });
    expect(defaultCardOptions()).toMatchObject({ tools: ['dates', 'info'], groupBy: 'years' });
    // equal to the env default → not stored
    expect(validateCardOptions({ body: { tools: ['info', 'dates'], groupBy: 'years' } }, ['body'])).toEqual({ ok: true, options: {} });
  });
  it('a stored row drops unknown tools and values without failing', () => {
    expect(optionsFromRow({ body: { tools: ['table', 'chart', 'table'], face: 'poster', start: 'full' } }, ['body'])).toEqual({ body: { tools: ['table'], start: 'full' } });
  });
});

describe('board options', () => {
  it('accepts the card keys plus confirm and motion; drops defaults', () => {
    expect(validateBoardOptions({ face: 'light', groupBy: 'years', confirm: false, motion: true })).toEqual({ ok: true, options: { face: 'light', groupBy: 'years', confirm: false } });
    expect(validateBoardOptions(undefined)).toEqual({ ok: true, options: {} });
  });
  it('refuses unknown keys, bad values and non-boolean switches', () => {
    expect(validateBoardOptions({ colour: 'red' })).toMatchObject({ ok: false, error: 'unknown_option', detail: 'board.colour' });
    expect(validateBoardOptions({ confirm: 'no' })).toMatchObject({ ok: false, error: 'unknown_option', detail: 'board.confirm=no' });
    expect(validateBoardOptions([])).toMatchObject({ ok: false, error: 'bad_body' });
  });
  it('a stored row is always an object', () => {
    expect(boardOptionsFromRow(null)).toEqual({});
    expect(boardOptionsFromRow({ motion: false, face: 'x' })).toEqual({ motion: false });
  });
  it("in force: the card's own, then the board's, then the defaults", () => {
    const o = effectiveOptions({ face: 'research' }, { face: 'light', groupBy: 'years', plan: 'without', confirm: false });
    expect(o).toMatchObject({ face: 'research', groupBy: 'years', plan: 'without', length: 'usual' });
    expect(o).not.toHaveProperty('confirm');
  });
  it('the board plan applies through shapeSelfCard', () => {
    const card = { id: 'body', rail: [{ current: true, span: 's1' }], v3: { spans: [{ span: 's1', step: 'x' }], ladder: {} as unknown } };
    expect(shapeSelfCard(card, undefined, { plan: 'without' }).v3?.ladder).toBeNull();
    expect(shapeSelfCard(card, { plan: 'with' }, { plan: 'without' }).v3?.ladder).not.toBeNull();
  });
  it('a face adds and removes nothing from the card', () => {
    const card = { id: 'body', rail: [{ current: true, span: 's1' }], v3: null };
    const { options: a, ...read } = shapeSelfCard(card, { face: 'read' });
    const { options: b, ...research } = shapeSelfCard(card, { face: 'research' });
    expect(research).toEqual(read);
    expect([a.face, b.face]).toEqual(['read', 'research']);
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
