import { describe, expect, it } from 'vitest';
import { asHouseCounts } from '../../../../src/reading/chartData/houseCounts.js';
import { buildFoundation, pointOf } from '../../../../src/reading/timeline/foundation.js';
import { PLANET_CODES } from '../../../../src/reading/facts/constants.js';
import { MARKER_IDS, markerForCategory } from '../../../../src/reading/timeline/markers.js';
import { loadG1Dossier, loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

describe('timeline foundation (doc 27 §A.1) on G1', () => {
  const table = loadG1TimelineInputs().houseCounts;
  const f = buildFoundation(loadG1Dossier(), table);

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
  });

  it('is keyed by a stable dossier hash', () => {
    expect(buildFoundation(loadG1Dossier(), table).hash).toBe(f.hash);
  });

  it('reads lordFromOwn from the table, not from arithmetic', () => {
    expect(f.houseLordChart.find((l) => l.house === 1)!.evidence).toContain('house_counts.house_from_house.1.9');
    const tampered = structuredClone(table!);
    tampered.house_from_house[1]![9] = 6;
    const link = buildFoundation(loadG1Dossier(), tampered).houseLordChart.find((l) => l.house === 1)!;
    expect(link).toMatchObject({ lordFromOwn: 6, lordIn6812FromOwn: true });
  });

  it('without the table lordFromOwn is unavailable, and the rest of the link stands', () => {
    const bare = buildFoundation(loadG1Dossier(), null);
    expect(bare.houseCounts).toBeNull();
    for (const l of bare.houseLordChart) {
      expect(l.lordFromOwn).toBeNull();
      expect(l.lordIn6812FromOwn).toBeNull();
      expect(l.evidence.some((e) => e.startsWith('house_counts.'))).toBe(false);
    }
    expect(bare.houseLordChart.find((l) => l.house === 1)).toMatchObject({ lord: 'Me', lordHouse: 9, lordPlacement: 'trikona', dispositor: 'Ve', dispositorHouse: 9 });
    expect(bare.hash).toBe(f.hash);
  });
});

describe('house_counts table on G1 (Radha)', () => {
  const dossier = loadG1Dossier();
  const table = loadG1TimelineInputs().houseCounts!;

  it('fixtureInputs picks it up', () => {
    const inputs = loadG1TimelineInputs();
    expect(inputs.houseCounts).not.toBeNull();
    expect(inputs.items.house_counts).toBe(inputs.houseCounts);
    expect(inputs.notes.some((n) => n.includes('house_counts'))).toBe(false);
  });

  it('agrees with the dossier: houses, bodies and the Arudha Lagna', () => {
    for (const [h, c] of Object.entries(dossier.houses)) expect(table.sign_to_house[c.sign]).toBe(Number(h));
    for (const p of PLANET_CODES) expect(table.planet_house[p]).toBe(dossier.bodies[p]!.house);
    expect(table.lagna.sign_index).toBe(dossier.houses['1']!.sign);
    expect(table.arudha_lagna).toMatchObject({ sign_index: dossier.arudhas.AL!.sign, house: dossier.arudhas.AL!.house });
    expect(table.house_from_arudha_lagna[dossier.arudhas.AL!.house]).toBe(1);
  });

  it('holds the counts the old tests pinned', () => {
    expect(table.house_from_house[1]![1]).toBe(1);
    expect(table.house_from_house[10]![9]).toBe(12);
    expect(table.house_from_house[12]![8]).toBe(9);
    expect(table.sign_to_house[11]).toBe(7);
    expect(table.house_from_planet.Ju.Sa).toBe(12);
  });

  it('a missing, partial or non-D1 table is no table', () => {
    expect(asHouseCounts(null)).toBeNull();
    expect(asHouseCounts({})).toBeNull();
    expect(asHouseCounts({ ...table, varga: 9 })).toBeNull();
    const partial = structuredClone(table);
    delete (partial.house_from_planet.Ju as Partial<typeof partial.house_from_planet.Ju>).Sa;
    expect(asHouseCounts(partial)).toBeNull();
    expect(asHouseCounts({ ...table, sign_to_house: { ...table.sign_to_house, 0: 13 } })).toBeNull();
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
