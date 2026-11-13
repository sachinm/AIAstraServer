/**
 * Self board v3 Phase A (docs/reading-engine/68 §4.1, §4.4, §4.5): the registry, layout validation, the period rail from
 * stored v2 dates, and the card views.
 */
import { describe, expect, it } from 'vitest';
import { OFFERED_CARDS, SELF_CARDS, V2_FILLED_CARDS, defaultSuggested } from '../../../../../src/reading/self/v3/cards.js';
import { layoutFromRow, suggestedLayout, validateLayout } from '../../../../../src/reading/self/v3/layout.js';
import { buildSelfV3Response, cardViews, railFromDates, railFromSpans } from '../../../../../src/reading/self/v3/response.js';
import { SUGGESTED_COUNT, type SelfV3CardContent } from '../../../../../src/reading/self/v3/types.js';
import { SELF_V2_AREAS } from '../../../../../src/reading/self/v2types.js';

describe('card registry', () => {
  it('offers the eleven v2 areas and no hero card', () => {
    expect(OFFERED_CARDS.map((c) => c.id).sort()).toEqual(SELF_V2_AREAS.map((a) => a.id).filter((id) => id !== 'now').sort());
    expect(V2_FILLED_CARDS).toHaveLength(11);
    expect(SELF_CARDS.find((c) => (c.id as string) === 'now')).toBeUndefined();
  });
  it('marks eight suggested, never more', () => {
    expect(defaultSuggested()).toHaveLength(SUGGESTED_COUNT);
  });
  it('has unique ids and every card keeps line and year in its defaults', () => {
    expect(new Set(SELF_CARDS.map((c) => c.id)).size).toBe(SELF_CARDS.length);
    for (const c of SELF_CARDS) expect(c.defaultSections).toEqual(expect.arrayContaining(['line', 'year']));
  });
  it('has no chakra card (decision D3)', () => {
    expect(SELF_CARDS.some((c) => /chakra/i.test(c.id + c.title))).toBe(false);
  });
});

describe('validateLayout', () => {
  const ok = { template: 'seasons', cards: ['body', 'mind', 'stuck'] };
  it('accepts three offered cards and keeps their order', () => {
    const r = validateLayout({ ...ok, cards: ['stuck', 'body', 'mind'] });
    expect(r).toEqual({ ok: true, layout: { template: 'seasons', cards: ['stuck', 'body', 'mind'], sections: {} } });
  });
  it('refuses fewer than three cards', () => {
    expect(validateLayout({ ...ok, cards: ['body', 'mind'] })).toMatchObject({ ok: false, error: 'too_few_cards' });
  });
  it('refuses unknown, unoffered and repeated cards', () => {
    expect(validateLayout({ ...ok, cards: ['body', 'mind', 'nope'] })).toMatchObject({ ok: false, error: 'unknown_card' });
    expect(validateLayout({ ...ok, cards: ['body', 'mind', 'sleep'] })).toMatchObject({ ok: false, error: 'card_not_offered' });
    expect(validateLayout({ ...ok, cards: ['body', 'mind', 'body'] })).toMatchObject({ ok: false, error: 'duplicate_card' });
  });
  it('refuses a template that is not live yet', () => {
    expect(validateLayout({ ...ok, template: 'table' })).toMatchObject({ ok: false, error: 'template_not_live' });
    expect(validateLayout({ ...ok, template: 'grid' })).toMatchObject({ ok: false, error: 'unknown_template' });
  });
  it('refuses switching off a fixed section and orders sections', () => {
    expect(validateLayout({ ...ok, sections: { body: ['year', 'stretch'] } })).toMatchObject({ ok: false, error: 'fixed_section_off' });
    expect(validateLayout({ ...ok, sections: { body: ['line', 'year', 'bogus'] } })).toMatchObject({ ok: false, error: 'unknown_section' });
    const r = validateLayout({ ...ok, sections: { body: ['ladder', 'year', 'line'] } });
    expect(r.ok && r.layout.sections.body).toEqual(['line', 'year', 'ladder']);
  });
  it('refuses a body that is not an object', () => {
    expect(validateLayout(null)).toMatchObject({ ok: false, error: 'bad_body' });
    expect(validateLayout({ template: 'seasons' })).toMatchObject({ ok: false, error: 'bad_body' });
  });
  it('the suggested layout validates', () => {
    expect(validateLayout(suggestedLayout()).ok).toBe(true);
  });
});

describe('layoutFromRow', () => {
  it('no row: the picker opens', () => {
    expect(layoutFromRow(null)).toMatchObject({ chosen: false, cards: [], template: 'seasons' });
  });
  it('drops withdrawn cards and keeps fixed sections on', () => {
    const v = layoutFromRow({ template: 'compact', cards: ['body', 'gone', 'body', 'mind'], sections: { body: ['stretch'] }, updated_at: new Date('2026-11-09T00:00:00Z') });
    expect(v.cards).toEqual(['body', 'mind']);
    expect(v.sections.body).toEqual(['line', 'year', 'stretch']);
    expect(v.chosen).toBe(true);
  });
});

describe('the period rail', () => {
  const today = '2026-11-09';
  it('Phase A: stored dates not yet ended, in order, the current one marked, at most six', () => {
    const dates = [
      { from: '2027-01-01', to: '2027-06-03', label: 'steadier' },
      { from: '2026-05-18', to: '2026-12-05', label: 'rest is thin' },
      { from: '2025-01-01', to: '2025-12-31', label: 'over' },
      { from: '2026-05-18', to: '2026-12-05', label: 'duplicate' },
      ...Array.from({ length: 8 }, (_, i) => ({ from: `2027-0${i + 1}-10`, to: `2027-0${i + 1}-20`, label: `x${i}` })),
    ];
    const rail = railFromDates(dates, today);
    expect(rail).toHaveLength(6);
    expect(rail[0]).toMatchObject({ from: '2026-05-18', label: '18 May 2026 → 5 Dec 2026', current: true, note: 'rest is thin', tone: null });
    expect(rail.some((r) => r.note === 'over' || r.note === 'duplicate')).toBe(false);
  });
  it('Phase B: one bar per span with its tone', () => {
    const c: SelfV3CardContent = {
      line: 'x',
      spans: [
        { span: 's1', from: '2026-10-01', to: '2026-12-05', tone: 'heavy', mode: 'get_through', asks: 'a', obstacle: 'o', step: 'If x, then y.' },
        { span: 's2', from: '2026-12-05', to: '2027-06-03', tone: 'light', mode: 'build', asks: 'a', obstacle: 'o', step: 'If x, then y.' },
      ],
      confirm: null,
      pattern: null,
      ladder: null,
      agreement: { agree: 3, of: 4 },
    };
    expect(railFromSpans(c, today).map((r) => [r.span, r.tone, r.current, r.label])).toEqual([
      ['s1', 'heavy', true, '1 Oct 2026 → 5 Dec 2026'],
      ['s2', 'light', false, '5 Dec 2026 → 3 Jun 2027'],
    ]);
  });
});

describe('card views', () => {
  const v2 = {
    status: 'ok',
    builtAt: '2026-11-09T10:00:00Z',
    nextCheck: null,
    clock: { system: 'vimsottari', label: 'Main clock', reason: 'default', reasonLine: '', applicable: [], notApplicable: [] },
    hero: null,
    areas: [
      {
        id: 'body',
        group: 'you',
        title: 'Body & energy',
        status: 'ok',
        card: { areaId: 'body', headline: 'Rest is short until 5 December.', body: ['p'], patterns: [], ladder: null, dates: [{ from: '2026-05-18', to: '2026-12-05', label: 'thin rest' }], certainty: 'likely', sources: [] },
        floor: [],
        rangeLabel: 'True until 5 Dec 2026',
        details: { evidence: [] },
      },
    ],
    profile: { ageBand: null, hasGender: false, missing: [] },
    refresh: { madeAt: null, validUntil: null, due: false, building: false, failed: false },
    build: { state: 'none' },
  } as never;
  it('fills a v2 card, its first line and rail; unfilled offered cards are pending; later ids are unavailable', () => {
    const cards = cardViews({ v2, today: '2026-11-09' });
    const body = cards.find((c) => c.id === 'body')!;
    expect(body).toMatchObject({ status: 'ok', firstLine: 'Rest is short until 5 December.', sensitive: true, suggested: true, available: true });
    expect(body.rail).toHaveLength(1);
    expect(cards.find((c) => c.id === 'mind')).toMatchObject({ status: 'pending', available: true, v2: null });
    expect(cards.find((c) => c.id === 'sleep')).toMatchObject({ available: false, suggested: false, unavailableReason: 'Coming soon' });
  });
  it('a v3 card wins over v2 and the response says v3', () => {
    const content: SelfV3CardContent = { line: 'Hold your evenings until 5 Dec 2026.', spans: [], confirm: null, pattern: null, ladder: null, agreement: null };
    const r = buildSelfV3Response({ v2, v3Cards: { body: content }, today: '2026-11-09', layout: layoutFromRow(null) });
    expect(r.readVersion).toBe('v3');
    expect(r.cards.find((c) => c.id === 'body')?.firstLine).toBe('Hold your evenings until 5 Dec 2026.');
  });
  it('a person-specific suggested set replaces the registry marks', () => {
    const cards = cardViews({ v2, today: '2026-11-09', suggested: ['presence', 'yogas', 'sleep'] });
    expect(cards.filter((c) => c.suggested).map((c) => c.id)).toEqual(['presence', 'yogas']);
  });
});
