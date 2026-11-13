/**
 * Phase A per-period text: a v2 card's body paragraphs split onto the rail by the dates they name (plain string
 * matching on stored text), the rest standing. Phase B keeps `text: null` and no standing paragraphs.
 */
import { describe, expect, it } from 'vitest';
import { cardViews, railFromDates, splitBodyByPeriods } from '../../../../../src/reading/self/v3/response.js';
import type { RailItem } from '../../../../../src/reading/self/v3/types.js';
import { card } from '../v2api/fixtures.js';

const TODAY = '2026-11-12';
const rail: RailItem[] = railFromDates(
  [
    { from: '2026-10-01', to: '2027-01-01', label: 'review' },
    { from: '2027-01-01', to: '2027-06-30', label: 'build' },
    { from: '2027-07-01', to: '2027-11-30', label: 'rest' },
  ],
  TODAY,
);

describe('splitBodyByPeriods', () => {
  it("a paragraph naming '1 Jan 2027' goes to the period ending 2027-01-01 (first in rail order), only once", () => {
    const r = splitBodyByPeriods(['Your review closes on 1 Jan 2027.'], rail);
    expect(r.rail[0]!.text).toEqual(['Your review closes on 1 Jan 2027.']);
    expect(r.rail[1]!.text).toBeNull();
    expect(r.standing).toEqual([]);
  });
  it('a paragraph without a date is standing; periods nobody names keep text null', () => {
    const r = splitBodyByPeriods(['You hold steady under pressure.'], rail);
    expect(r.standing).toEqual(['You hold steady under pressure.']);
    expect(r.rail.every((x) => x.text === null)).toBe(true);
  });
  it('matches ISO and the long month form; no paragraph is assigned twice', () => {
    const body = ['From 2027-07-01 the pace eases.', 'By 30 June 2027 the build is done, and 1 July 2027 opens rest.', 'A standing line.'];
    const r = splitBodyByPeriods(body, rail);
    expect(r.rail[2]!.text).toEqual(['From 2027-07-01 the pace eases.']);
    expect(r.rail[1]!.text).toEqual(['By 30 June 2027 the build is done, and 1 July 2027 opens rest.']);
    expect(r.standing).toEqual(['A standing line.']);
    const assigned = r.rail.flatMap((x) => x.text ?? []).concat(r.standing);
    expect(assigned.sort()).toEqual([...body].sort());
  });
  it('a near date does not match (11 Jan 2027 is not 1 Jan 2027)', () => {
    expect(splitBodyByPeriods(['On 11 Jan 2027 a call.'], rail).standing).toEqual(['On 11 Jan 2027 a call.']);
  });
});

describe('card views', () => {
  const mindCard = {
    ...card('mind', 'You think in pictures'),
    body: ['Until 1 Jan 2027 your review takes your attention.', 'You think in pictures.'],
    dates: [
      { from: '2026-10-01', to: '2027-01-01', label: 'review' },
      { from: '2027-01-02', to: '2027-06-30', label: 'build' },
    ],
  };
  const v2 = { status: 'ok', areas: [{ id: 'mind', group: 'who', title: 'Mind', status: 'ok', card: mindCard, floor: [], range: null, rangeLabel: '', details: { evidence: [] } }] } as never;

  it('Phase A: the period text and the standing paragraphs come from the v2 body', () => {
    const mind = cardViews({ v2, today: TODAY }).find((c) => c.id === 'mind')!;
    expect(mind.rail.map((r) => r.text)).toEqual([['Until 1 Jan 2027 your review takes your attention.'], null]);
    expect(mind.standing).toEqual(['You think in pictures.']);
  });
  it('Phase B: text stays null and standing is empty (the page reads the spans)', () => {
    const v3 = {
      line: 'A line',
      spans: [{ span: 's1', from: '2026-10-01', to: '2027-01-01', tone: 'steady', mode: 'build', asks: 'a', obstacle: 'o', step: 's', held: true }],
      confirm: null,
      pattern: null,
      ladder: null,
      agreement: { agree: 1, of: 1 },
    } as never;
    const mind = cardViews({ v2, v3Cards: { mind: v3 }, today: TODAY }).find((c) => c.id === 'mind')!;
    expect(mind.rail.every((r) => r.text === null)).toBe(true);
    expect(mind.standing).toEqual([]);
  });
  it('a card with no stored body has no standing paragraphs', () => {
    expect(cardViews({ v2, today: TODAY }).find((c) => c.id === 'body')!.standing).toEqual([]);
  });
});
