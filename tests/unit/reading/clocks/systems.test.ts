/**
 * docs/techniques/09 §1 decision 2 and §8 step 5: the served systems by name and mark. Only verified systems that apply
 * to the chart are read, shown and counted; a conditional dasha only when the engine says it applies.
 */
import { describe, expect, it } from 'vitest';
import { countedNames, floorMissing, isCounted, isShown, levelShown, renderShownPeriods, shownSystems, systemDef, SYSTEMS } from '../../../../src/reading/clocks/systems.js';

const APPLIES = [
  { system: 'dwisatpathi', names: ['dwisatpathi'], applies: true },
  { system: 'ashtottari', names: ['ashtottari'], applies: false },
  { system: 'shodasottari', names: ['shodasottari', 'shodashottari'], applies: true },
];

describe('the systems table', () => {
  it('shows the verified set of doc 09 §1 and never the flagged, longevity or unchecked ones', () => {
    for (const s of ['vimsottari', 'narayana', 'sudasa', 'lagna_kendradi', 'kendradhi_rasi', 'patyayini', 'tithi_pravesha']) expect(isShown(s), s).toBe(true);
    for (const s of ['yogini', 'chara', 'drig', 'trikona', 'mandooka', 'tara', 'naisargika', 'mudda', 'shoola', 'sthira', 'brahma', 'nirayana', 'navamsa', 'aayu', 'karaka', 'tithi_ashtottari']) expect(isShown(s), s).toBe(false);
    expect(isShown('some_new_system')).toBe(false);
  });
  it('a conditional dasha shows only when dasha.applicable says it applies; an unchecked one never', () => {
    expect(isShown('dwisatpathi', APPLIES)).toBe(true);
    expect(isShown('ashtottari', APPLIES)).toBe(false);
    expect(isShown('dwisatpathi', null)).toBe(false);
    expect(isShown('shodasottari', APPLIES)).toBe(false);
    expect(isCounted('dwisatpathi', APPLIES)).toBe(true);
  });
  it('Narayana is verified at the maha dasha level only', () => {
    expect(levelShown('narayana', 1)).toBe(true);
    expect(levelShown('narayana', 2)).toBe(false);
    expect(levelShown('vimsottari', 3)).toBe(true);
  });
  it('every id is unique and every row says why', () => {
    expect(new Set(SYSTEMS.map((s) => s.id)).size).toBe(SYSTEMS.length);
    for (const s of SYSTEMS) expect(s.why.length).toBeGreaterThan(3);
    expect(systemDef('dasha.chaturshitisama')?.id).toBe('chathuraaseethi_sama');
  });
  it('shownSystems: the stored ones that are shown, the year and Patyayini always; the floor', () => {
    const shown = shownSystems(['vimsottari', 'narayana', 'yogini', 'sudasa', 'kendradhi_rasi', 'dwisatpathi', 'ashtottari'], APPLIES);
    expect(shown.map((s) => s.id)).toEqual(['vimsottari', 'narayana', 'sudasa', 'lagna_kendradi', 'tithi_pravesha', 'dwisatpathi']);
    // Patyayini is verified but nothing renders its rows yet: never padded in
    expect(shown.map((s) => s.id)).not.toContain('patyayini');
    expect(shown.find((s) => s.id === 'lagna_kendradi')?.stored).toBe('kendradhi_rasi');
    expect(floorMissing(shown)).toEqual([]);
    expect(floorMissing(shownSystems(['vimsottari'], null))).toEqual(['a sign dasha']);
    expect(countedNames(shown)).toEqual(expect.arrayContaining(['vimsottari', 'narayana', 'kendradhi_rasi', 'dwisatpathi']));
  });
  it('renders the stored periods of the periods-only systems, keyed, in the window', () => {
    const shown = shownSystems(['vimsottari', 'sudasa'], null);
    const r = renderShownPeriods(
      [
        { system: 'sudasa', level: 1, lord: null, sign: 'Le', from: '2020-01-01', to: '2029-01-01', houses: [6, 1] },
        { system: 'sudasa', level: 2, lord: null, sign: 'Vi', from: '2026-01-01', to: '2026-12-01', houses: [7] },
        { system: 'sudasa', level: 3, lord: null, sign: 'Li', from: '2026-01-01', to: '2026-02-01', houses: [8] },
        { system: 'sudasa', level: 2, lord: null, sign: 'Ar', from: '2010-01-01', to: '2011-01-01', houses: [1] },
        { system: 'yogini', level: 1, lord: 'Ma', sign: null, from: '2020-01-01', to: '2030-01-01', houses: [1] },
      ],
      shown,
      { from: '2025-11-19', to: '2027-05-19' },
    );
    expect(r.keys).toEqual(['activation:sudasa/1/Le@2020-01-01', 'activation:sudasa/2/Vi@2026-01-01']);
    expect(r.text).toContain('{activation:sudasa/1/Le@2020-01-01} system=sudasa L1 sign=Le 2020-01-01..2029-01-01 houses=[1,6]');
    expect(renderShownPeriods([], shown, { from: '2025-01-01', to: '2026-01-01' }).text).toBe('');
  });
});
