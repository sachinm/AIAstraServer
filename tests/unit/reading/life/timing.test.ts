import { describe, expect, it } from 'vitest';
import { lifeArea } from '../../../../src/reading/life/areas.js';
import { promiseScale } from '../../../../src/reading/life/promise.js';
import { areaTiming, basisOf, gradeOf } from '../../../../src/reading/life/timing.js';
import type { AnnualRow } from '../../../../src/reading/digest/types.js';
import { annualRow, makeView, row } from './fixture.js';

const today = '2026-11-05';
const horizonEnd = '2041-11-05';
const work = lifeArea('work');
const view = makeView({ tone: 'strong', planets: { D1: { Ra: { functional: 'malefic', dignity: 'debilitated' } } } });
const promise = promiseScale(view, work, { today, running: [], annual: [], sky: null });
const noAnnual = (): AnnualRow[] => [];
const VIM = row('vimshottari', 'vimshottari', '2027-01-01', '2028-02-16', [10, 2], 'Sa', { parentLord: 'Mo' });

describe('timing agreement across systems (doc 34 §2)', () => {
  it('Vimshottari alone is not dated: it is a possibility, with its year only', () => {
    const t = areaTiming(view, work, promise, { today, horizonEnd, rows: [VIM], annual: noAnnual, sky: null });
    expect(t.windows).toHaveLength(1);
    expect(t.windows[0].dated).toBe(false);
    expect(t.improves).toEqual([]);
    expect(t.possibility).toEqual({ year: 2027 });
  });

  it('two systems agree: dated, moderate', () => {
    const rows = [VIM, row('yogini', 'yogini', '2026-12-01', '2027-08-01', [10], 'Ju')];
    const t = areaTiming(view, work, promise, { today, horizonEnd, rows, annual: noAnnual, sky: null });
    const w = t.improves[0];
    expect(w.dated).toBe(true);
    expect(w.systems).toEqual(['vimshottari', 'yogini']);
    expect(w.grade).toBe('moderate');
    expect(w.md).toBe('Mo');
    expect(w.ad).toBe('Sa');
    expect(w.basis).toBe('moderate: two systems agree, the sky check is not available for these dates');
    expect(t.possibility).toBeNull();
  });

  it('four systems and the year chart: strong', () => {
    const rows = [
      VIM,
      row('narayana', 'rasi', '2026-10-15', '2027-10-15', [10], null, { sign: 'Sign10', level: 1, parentLord: null }),
      row('dwisaptati', 'conditional', '2027-01-01', '2027-12-01', [10, 6], 'Ve'),
      row('yogini', 'yogini', '2026-12-01', '2027-08-01', [10], 'Ju'),
    ];
    const t = areaTiming(view, work, promise, { today, horizonEnd, rows, annual: (y) => (y === 2027 ? [annualRow('TP', 2027, 10, 'strong')] : []), sky: null });
    const w = t.improves[0];
    expect(w.families).toEqual(['vimshottari', 'conditional', 'rasi', 'yogini']);
    expect(w.annual).toBe('confirms');
    expect(w.grade).toBe('strong');
    expect(w.basis.startsWith('strong: four systems agree, the year chart confirms')).toBe(true);
    expect(w.evidence).toContain('annual:TP2027.h10');
  });

  it('an open double transit on an area house earns the sky points; a period that tests the area is named as disagreeing', () => {
    const rows = [VIM, row('yogini', 'yogini', '2026-12-01', '2027-08-01', [10], 'Ju'), row('tithi_ashtottari', 'tithi_ashtottari', '2027-01-01', '2027-06-01', [10], 'Ra')];
    const sky = { from: '2026-01-01', to: '2028-11-01', gates: [{ from: '2027-03-01', to: '2027-05-01', houses: [10] }], slow: [] };
    const t = areaTiming(view, work, promise, { today, horizonEnd, rows, annual: noAnnual, sky });
    const w = t.improves[0];
    expect(w.transit).toBe('open');
    expect(w.contradicts).toEqual(['tithi_ashtottari']);
    expect(w.score).toBe(55 + 8 + 3 - 2 + 10);
    expect(w.basis).toBe('strong: two systems agree, the sky confirms, one disagrees');
  });

  it('a Vimshottari period whose lord tests the area, or that does not touch it, is not a window', () => {
    const rows = [row('vimshottari', 'vimshottari', '2027-01-01', '2028-01-01', [10], 'Ra'), row('vimshottari', 'vimshottari', '2028-01-01', '2029-01-01', [3], 'Ju')];
    expect(areaTiming(view, work, promise, { today, horizonEnd, rows, annual: noAnnual, sky: null }).windows).toEqual([]);
  });

  it('keeps the best three dated windows, in date order', () => {
    const rows = [2027, 2029, 2031, 2033].flatMap((y, i) => [
      row('vimshottari', 'vimshottari', `${y}-01-01`, `${y}-12-01`, [10], 'Sa'),
      row('yogini', 'yogini', `${y}-02-01`, `${y}-06-01`, [10], 'Ju'),
      ...(i === 0 ? [] : [row('narayana', 'rasi', `${y}-01-01`, `${y}-12-01`, [10], 'Ju')]),
    ]);
    const t = areaTiming(view, work, promise, { today, horizonEnd, rows, annual: noAnnual, sky: null });
    expect(t.improves.map((w) => w.from.slice(0, 4))).toEqual(['2029', '2031', '2033']);
  });

  it('grades by doc 34 bands', () => {
    expect([gradeOf(70), gradeOf(69), gradeOf(50), gradeOf(49)]).toEqual(['strong', 'moderate', 'moderate', 'weak']);
    expect(basisOf({ grade: 'weak', systems: ['vimshottari'], contradicts: [], annual: 'missing', transit: 'closed' })).toBe('weak: one system points');
  });
});
