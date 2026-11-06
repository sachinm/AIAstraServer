import { describe, expect, it } from 'vitest';
import { lifeArea, LIFE_AREAS, allAreaHouses } from '../../../../src/reading/life/areas.js';
import { LAYER_WEIGHTS, promiseScale } from '../../../../src/reading/life/promise.js';
import { annualRow, makeView, row } from './fixture.js';

const today = '2026-11-05';
const none = { today, running: [], annual: [], sky: null };

describe('life areas', () => {
  it('has the thirteen areas of doc 34 with houses, karakas and vargas', () => {
    expect(LIFE_AREAS.map((a) => a.id)).toEqual(['self', 'money', 'work', 'home', 'marriage', 'children', 'parents', 'siblings', 'legal', 'health', 'travel', 'learning', 'dharma']);
    for (const a of LIFE_AREAS) {
      expect(a.houses.length, a.id).toBeGreaterThan(0);
      expect(a.label, a.id).toBeTruthy();
    }
    expect(lifeArea('work').houses[0]).toBe(10);
    expect(lifeArea('work').vargas).toContain('D10');
    expect(lifeArea('marriage').houses[0]).toBe(7);
    expect(allAreaHouses()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('promise scale (doc 34 §2)', () => {
  it('a chart whose cards all support the area is promised, with D9 and the owning varga read', () => {
    const p = promiseScale(makeView({ tone: 'strong' }), lifeArea('work'), none);
    expect(p.verdict).toBe('promised');
    expect(p.promiseRatio).toBe(1);
    expect(p.owningVarga).toBe('D10');
    expect(p.lines.some((l) => l.fact.startsWith('house:D9.h10'))).toBe(true);
    expect(p.lines.some((l) => l.fact.startsWith('house:D10.h10'))).toBe(true);
    expect(p.withholding).toEqual([]);
    expect(p.helpers).toContain('Sa');
  });

  it('weights sum to the layer weights doc 34 gives', () => {
    const p = promiseScale(makeView({ tone: 'strong' }), lifeArea('work'), {
      today,
      running: [row('vimshottari', 'vimshottari', '2026-01-01', '2027-01-01', [10], 'Sa'), row('yogini', 'yogini', '2026-06-01', '2027-06-01', [3], 'Mo')],
      annual: [annualRow('TP', 2026, 10, 'strong'), annualRow('VP', 2026, 10, 'strong')],
      sky: { from: '2026-01-01', to: '2028-12-31', gates: [{ from: '2026-10-01', to: '2027-03-01', houses: [10] }], slow: [] },
    });
    const sum = (layer: string) => Math.round(p.lines.filter((l) => l.layer === layer).reduce((s, l) => s + l.weight, 0));
    expect(sum('d1')).toBe(LAYER_WEIGHTS.d1);
    expect(sum('varga')).toBe(LAYER_WEIGHTS.varga);
    expect(sum('dasha')).toBe(LAYER_WEIGHTS.dasha);
    expect(sum('annual')).toBe(LAYER_WEIGHTS.annual);
    expect(sum('transit')).toBe(LAYER_WEIGHTS.transit);
    // the Yogini period does not touch house 10, 6 or 1: neutral, not support
    expect(p.lines.find((l) => l.fact.startsWith('activation:yogini'))!.side).toBe('neutral');
    // Vimshottari 8 against Yogini 3 inside the 25 dasha points
    expect(p.lines.find((l) => l.fact.startsWith('activation:vimshottari'))!.weight).toBeCloseTo(18.2, 1);
    expect(Object.values(p.available).every(Boolean)).toBe(true);
  });

  it('a chart whose cards all test the area is not written, and names the withholding planets', () => {
    const p = promiseScale(makeView({ tone: 'weak' }), lifeArea('work'), none);
    expect(p.verdict).toBe('not_written');
    expect(p.withholding[0]).toBe('Sa'); // the 10th lord on the synthetic chart, heaviest line
    expect(p.score).toBeLessThan(30);
  });

  it('mixed cards are partial', () => {
    const view = makeView({ tone: 'strong', houses: { D1: { 10: { lordDignity: 'debilitated', lordHouse: 8 }, 6: { lordDignity: 'debilitated', lordHouse: 12 } }, D9: { 10: { lordDignity: 'debilitated' } } }, planets: { D9: { Sa: { dignity: 'debilitated' } } } });
    const p = promiseScale(view, lifeArea('work'), none);
    expect(p.verdict).toBe('partial');
    expect(p.withholding).toContain('Sa');
  });

  it('without the owning varga, D9 carries the whole varga weight', () => {
    const p = promiseScale(makeView({ tone: 'strong', vargas: ['D1', 'D9'] }), lifeArea('work'), none);
    expect(p.owningVarga).toBeNull();
    expect(Math.round(p.lines.filter((l) => l.layer === 'varga').reduce((s, l) => s + l.weight, 0))).toBe(20);
    expect(p.lines.filter((l) => l.layer === 'varga').every((l) => l.fact.includes('D9'))).toBe(true);
  });

  it('a slow body on the primary house today is a test line with its end date', () => {
    const p = promiseScale(makeView({ tone: 'strong' }), lifeArea('work'), { ...none, sky: { from: '2026-01-01', to: '2028-12-31', gates: [], slow: [{ planet: 'Sa', from: '2026-03-01', to: '2027-06-03', house: 10 }] } });
    const t = p.lines.find((l) => l.layer === 'transit')!;
    expect(t.side).toBe('test');
    expect(t.until).toBe('2027-06-03');
  });
});
