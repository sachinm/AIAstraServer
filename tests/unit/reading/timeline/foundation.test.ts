import { describe, expect, it } from 'vitest';
import { buildFoundation, houseFrom, houseOfSign, pointOf } from '../../../../src/reading/timeline/foundation.js';
import { MARKER_IDS, markerForCategory } from '../../../../src/reading/timeline/markers.js';
import { loadG1Dossier } from '../../../helpers/readingFixtures.js';

describe('timeline foundation (doc 27 §A.1) on G1', () => {
  const f = buildFoundation(loadG1Dossier());

  it('reads lagna, planets and lordships from the dossier', () => {
    expect(f.lagnaSign).toBe(5); // Virgo
    expect(f.planets.Sa).toMatchObject({ house: 9, owns: [5, 6], starLord: 'Mo' });
    expect(f.planets.Su).toMatchObject({ house: 8, strongDignity: true });
    // co-lords count as ownership (Rahu co-lords Aquarius, Ketu Scorpio)
    expect(f.planets.Ra!.owns).toEqual([6]);
    expect(f.planets.Ke!.owns).toEqual([3]);
  });

  it('builds the house-lord chart two hops deep', () => {
    const h1 = f.houseLordChart.find((l) => l.house === 1)!;
    expect(h1).toMatchObject({ lord: 'Me', lordHouse: 9, lordFromOwn: 9, lordPlacement: 'trikona', dispositor: 'Ve', dispositorHouse: 9 });
    expect(h1.evidence).toContain('houses.1.lord');
    expect(f.lagnaLordChain).toBe(h1);
    // 2nd lord Venus in 9 (8th from the 2nd) and 10th lord Mercury in 9 (12th from the 10th)
    const in6812 = f.houseLordChart.filter((l) => l.lordIn6812FromOwn).map((l) => l.house);
    expect(in6812).toEqual(expect.arrayContaining([2, 10]));
    expect(f.houseLordChart.find((l) => l.house === 9)!.lordPlacement).toBe('own');
    expect(f.houseLordChart.find((l) => l.house === 12)!.lordPlacement).toBe('dusthana');
  });

  it('keeps arudhas and special lagnas with their paths', () => {
    expect(pointOf(f, 'UL')).toEqual({ point: { sign: 8, house: 4 }, path: 'arudhas.UL' });
    expect(pointOf(f, 'HL')).toEqual({ point: { sign: 11, house: 7 }, path: 'special_lagnas.HL' });
    expect(pointOf(f, 'XX')).toBeNull();
    expect(houseOfSign(f, 11)).toBe(7);
  });

  it('is keyed by a stable dossier hash', () => {
    expect(buildFoundation(loadG1Dossier()).hash).toBe(f.hash);
  });

  it('counts houses from a house', () => {
    expect(houseFrom(1, 1)).toBe(1);
    expect(houseFrom(10, 9)).toBe(12);
    expect(houseFrom(12, 8)).toBe(9);
  });
});

describe('timeline markers (doc 27 §A.2)', () => {
  it('has the eleven rows of the marker table', () => {
    expect(MARKER_IDS).toHaveLength(11);
  });

  it('maps ledger categories to markers by the longest prefix', () => {
    expect(markerForCategory('family.father.illness')).toBe('family_parents');
    expect(markerForCategory('family.sibling.birth')).toBe('siblings');
    expect(markerForCategory('travel.long')).toBe('residence');
    expect(markerForCategory('vehicle.purchase')).toBe('property_vehicles');
    expect(markerForCategory('marriage')).toBe('love_marriage');
    expect(markerForCategory('jobless')).toBeNull();
    expect(markerForCategory('travel.short')).toBeNull();
  });
});
