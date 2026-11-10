/**
 * The Tithi Pravesha year selector (doc 66 §4.10): the year whose return moment has passed, time-aware, never the
 * calendar birthday and never the Varsha year in its place.
 */
import { describe, expect, it } from 'vitest';
import { localStamp, runningTithiPravesha } from '../../../../src/reading/annual/tithiPravesha.js';
import type { AnnualRow } from '../../../../src/reading/digest/types.js';

const row = (kind: 'TP' | 'VP', year: number, extra: Partial<AnnualRow> = {}): AnnualRow => ({
  kind,
  year,
  varga: 'D1',
  lagna: kind === 'TP' ? `Lagna${year}` : `VLagna${year}`,
  houses: [],
  dashas: [],
  sahams: [],
  ...extra,
});
const view = (rows: AnnualRow[]) => ({ annual: (y?: number) => (y == null ? rows : rows.filter((r) => r.year === y)) });

// a birthday of 15 Nov; the tithi return falls on 9 Nov 2025 and 28 Nov 2026 (before and after the birthday)
const tp2025 = row('TP', 2025, {
  start: '2025-11-09 06:30:00',
  end: '2026-11-28 21:10:00',
  startBasis: 'tp_start',
  dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2025-11-09', to: '2026-04-01' }, { lord: 'Ra', from: '2026-04-01', to: '2026-11-28' }] }],
});
const tp2026 = row('TP', 2026, {
  start: '2026-11-28 21:10:00',
  end: '2027-11-17 03:00:00',
  startBasis: 'tp_start',
  dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ve', from: '2026-11-28', to: '2027-05-01' }, { lord: 'Su', from: '2027-05-01', to: '2027-11-17' }] }],
});
const vp2026 = row('VP', 2026, { dashas: [{ system: 'mudda', periods: [{ lord: 'Ma', from: '2026-11-15', to: '2027-01-20' }, { lord: 'Ra', from: '2027-01-20', to: '2027-11-15' }] }] });
const vp2025 = row('VP', 2025, { dashas: [{ system: 'mudda', periods: [{ lord: 'Sa', from: '2025-11-15', to: '2026-11-15' }] }] });

describe('runningTithiPravesha', () => {
  const v = view([tp2025, tp2026, vp2025, vp2026]);

  it('one day before tp_start: the previous year is still in force', () => {
    const r = runningTithiPravesha(v, '2026-11-27');
    expect(r.year).toBe(2025);
    expect(r.basis).toBe('tp_start');
    expect(r.from).toBe('2025-11-09');
    expect(r.to).toBe('2026-11-28');
    expect(r.shortClock).toMatchObject({ lord: 'Ra', from: '2026-04-01', to: '2026-11-28' });
  });

  it('after the calendar birthday but before a late tithi return: still the previous year (the birthday is not the boundary)', () => {
    const r = runningTithiPravesha(v, '2026-11-20');
    expect(r.year).toBe(2025);
    // the Varsha year has turned on the birthday; it stays a confirming clock only
    expect(r.varsha?.row.year).toBe(2026);
    expect(r.row?.kind).toBe('TP');
  });

  it('at and after tp_start (time-aware on the return day): the current year', () => {
    expect(runningTithiPravesha(v, '2026-11-28T21:10:00').year).toBe(2026);
    expect(runningTithiPravesha(v, '2026-11-28 21:09:59').year).toBe(2025);
    expect(runningTithiPravesha(v, '2026-11-28T22:00').year).toBe(2026);
    expect(runningTithiPravesha(v, '2026-12-01').year).toBe(2026);
    const r = runningTithiPravesha(v, '2026-12-01');
    expect(r.shortClock).toMatchObject({ lord: 'Ve', system: 'tithi_ashtottari' });
    expect(r.start).toBe('2026-11-28 21:10:00');
  });

  it('a bare date on the return day is read at noon', () => {
    // the 2026 return is at 21:10, so noon of that day is still the 2025 year
    expect(runningTithiPravesha(v, '2026-11-28').year).toBe(2025);
    expect(localStamp('2026-11-28')).toBe('2026-11-28 12:00:00');
  });

  it('a tithi return a few days before the birthday: the new year starts at the return, before the birthday', () => {
    const r = runningTithiPravesha(v, '2025-11-10');
    expect(r.year).toBe(2025);
    expect(runningTithiPravesha(v, '2025-11-08').year).toBeNull();
  });

  it('valid_from as the stored return moment (same instants, older engine) is used with its basis', () => {
    const a = row('TP', 2026, { start: '2026-11-28 21:10:00', end: '2027-11-17 03:00:00', startBasis: 'valid_from' });
    const r = runningTithiPravesha(view([a]), '2026-12-02');
    expect(r.year).toBe(2026);
    expect(r.basis).toBe('valid_from');
    expect(r.shortClock).toBeNull();
    expect(r.gaps.join()).toMatch(/year dasha not stored/);
  });

  it('a lifetime TP year dasha is never the short clock', () => {
    const life = row('TP', 2026, {
      start: '2026-11-28 21:10:00',
      end: '2027-11-17 03:00:00',
      startBasis: 'tp_start',
      dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2015-07-07', to: '2034-07-06' }, { lord: 'Ra', from: '2034-07-06', to: '2046-07-06' }] }],
    });
    const r = runningTithiPravesha(view([life]), '2026-12-02');
    expect(r.year).toBe(2026);
    expect(r.shortClock).toBeNull();
    expect(r.yearDasha).toBeNull();
    expect(r.gaps.join()).toMatch(/lifetime dasha/);
  });

  it('no tp_start stored: the bounded year-dasha span heuristic, with a gap', () => {
    const a = row('TP', 2025, { dashas: tp2025.dashas });
    const b = row('TP', 2026, { dashas: tp2026.dashas });
    const r = runningTithiPravesha(view([a, b, vp2026]), '2026-12-01');
    expect(r.year).toBe(2026);
    expect(r.basis).toBe('dasha_span');
    expect(r.gaps.join()).toMatch(/tp_start not stored/);
  });

  it('no tp_start and only a lifetime TP dasha: not resolved, and the Varsha year is not used in its place', () => {
    const a = row('TP', 2026, { dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2015-07-07', to: '2034-07-06' }] }] });
    const r = runningTithiPravesha(view([a, vp2026]), '2026-12-01');
    expect(r.row).toBeNull();
    expect(r.year).toBeNull();
    expect(r.varsha?.row.year).toBe(2026);
    expect(r.gaps.join()).toMatch(/not resolved/);
  });

  it('today past the last stored year: nothing (never a year chart that does not cover today)', () => {
    const r = runningTithiPravesha(v, '2028-01-01');
    expect(r.row).toBeNull();
    expect(r.gaps.join()).toMatch(/no stored Tithi Pravesha year covers/);
  });
});
