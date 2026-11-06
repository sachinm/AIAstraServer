/**
 * A synthetic DigestView (docs/reading-engine/54 §2) for the Self and Love board tests. No real birth data: every card is
 * made up so each layer rule has one row that fires and one that does not.
 */
import type { AnnualRow, DigestView, HouseCard, PlanetCard, PointRow, YogaRow } from '../../src/reading/digest/types.js';
import type { ActivationRow } from '../../src/reading/digest/activation.js';

const CLASS: Record<number, string[]> = {
  1: ['kendra', 'trikona'], 2: ['maraka'], 3: ['upachaya'], 4: ['kendra'], 5: ['trikona'], 6: ['dusthana', 'upachaya'],
  7: ['kendra', 'maraka'], 8: ['dusthana'], 9: ['trikona'], 10: ['kendra', 'upachaya'], 11: ['upachaya'], 12: ['dusthana'],
};
const SIGNS = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];

export function house(h: number, over: Partial<HouseCard> = {}, varga = 'D1'): HouseCard {
  return {
    varga, house: h, sign: SIGNS[h - 1]!, lord: null, lordHouse: null, lordSign: null, lordDignity: null, coLord: null,
    occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: 25, class: CLASS[h]!, cuspStar: null, arudha: null,
    ...over,
  };
}

export function planet(p: string, over: Partial<PlanetCard> = {}, varga = 'D1'): PlanetCard {
  return {
    varga, planet: p, sign: null, house: null, degree: null, star: null, pada: null, starLord: null, dignity: null,
    retro: null, combust: null, war: null, dispositor: null, dispositorHouse: null, chain: [], avasthas: {},
    shadbalaRatio: null, shadbalaRank: null, natural: null, functional: null, owns: [], aspectsTo: [], aspectedBy: [], conjunctions: [],
    ...over,
  };
}

export interface FakeDigestInput {
  houses?: HouseCard[];
  planets?: PlanetCard[];
  yogas?: YogaRow[];
  points?: PointRow[];
  annual?: AnnualRow[];
  gandanta?: string[];
}

export function fakeDigest(input: FakeDigestInput, kundliId = 'k1'): DigestView {
  const houses = input.houses ?? [];
  const planets = input.planets ?? [];
  return {
    kundliId,
    status: 'ready',
    version: 'd1.test',
    builtAt: '2026-11-01T00:00:00Z',
    house: (v, h) => houses.find((c) => c.varga === v && c.house === h) ?? null,
    houses: (v) => houses.filter((c) => c.varga === v),
    planet: (v, p) => planets.find((c) => c.varga === v && c.planet === p) ?? null,
    planets: (v) => planets.filter((c) => c.varga === v),
    vargas: () => [...new Set(houses.map((c) => c.varga))],
    yogas: () => input.yogas ?? [],
    points: (v) => (input.points ?? []).filter((p) => !v || p.varga === v),
    annual: (y) => (input.annual ?? []).filter((a) => y === undefined || a.year === y),
    star: () => ({ moonStar: null, moonStarLord: null, lagnaStar: null, taras: [], gandanta: input.gandanta ?? [] }),
    sourceOf: () => [],
  };
}

export function act(over: Partial<ActivationRow> & Pick<ActivationRow, 'from' | 'to'>): ActivationRow {
  return { system: 'vimshottari', family: 'vimshottari', level: 2, lord: null, sign: null, houses: [], parentLord: null, ...over };
}

/**
 * The Self fixture: lagna lord Ma in h10 (kendra) and own sign; Jupiter aspecting h1 and the Moon; Saturn in h4;
 * the 5th lord Su in h8; a mahapurusha yoga on Ma; Kemadruma with its cancellation listed.
 */
export function selfFixture(): DigestView {
  const houses: HouseCard[] = [
    house(1, { lord: 'Ma', lordHouse: 10, lordDignity: 'own', aspectedGraha: ['Ju'], sav: 30 }),
    house(2, { lord: 'Ve', lordHouse: 7 }),
    house(3, { lord: 'Me', lordHouse: 3 }),
    house(4, { lord: 'Mo', lordHouse: 4, lordDignity: 'exalted', occupants: [{ planet: 'Sa', dignity: null, nature: 'malefic' }, { planet: 'Mo', dignity: 'exalted', nature: 'benefic' }] }),
    house(5, { lord: 'Su', lordHouse: 8 }),
    house(6, { lord: 'Me', lordHouse: 3 }),
    house(7, { lord: 'Ve', lordHouse: 7, aspectedGraha: ['Sa'] }),
    house(8, { lord: 'Ma', lordHouse: 10, occupants: [{ planet: 'Su', dignity: null, nature: null }] }),
    house(9, { lord: 'Ju', lordHouse: 1, lordDignity: 'own', argala: { primary: ['Ve'], secondary: [], obstructed: [] } }),
    house(10, { lord: 'Sa', lordHouse: 4, occupants: [{ planet: 'Ma', dignity: 'own', nature: 'benefic' }] }),
    house(11, { lord: 'Sa', lordHouse: 4 }),
    house(12, { lord: 'Ju', lordHouse: 1 }),
    house(1, { lord: 'Ve', lordHouse: 1, lordDignity: 'own' }, 'D9'),
    house(7, { lord: 'Ma', lordHouse: 2, lordDignity: 'debilitated' }, 'D9'),
  ];
  const planets: PlanetCard[] = [
    planet('Ma', { dignity: 'own', functional: 'benefic', owns: [1, 8], house: 10, dispositor: 'Sa' }),
    planet('Mo', { dignity: 'exalted', functional: 'benefic', owns: [4], house: 4, aspectedBy: ['Ju'], conjunctions: ['Sa'] }),
    planet('Su', { dignity: 'neutral', functional: 'benefic', owns: [5], house: 8, combust: false }),
    planet('Ju', { dignity: 'own', functional: 'benefic', owns: [9, 12], house: 1 }),
    planet('Sa', { dignity: 'friend', functional: 'malefic', owns: [10, 11], house: 4 }),
    planet('Ve', { dignity: 'own', functional: 'benefic', owns: [2, 7], house: 7 }),
    planet('Me', { dignity: 'neutral', functional: 'malefic', owns: [3, 6], house: 3 }),
    planet('Ra', { functional: 'malefic', house: 6 }),
    planet('Ke', { functional: 'malefic', house: 12 }),
    planet('Ju', { dignity: 'exalted' }, 'D9'),
    planet('Sa', { dignity: 'debilitated' }, 'D9'),
  ];
  const yogas: YogaRow[] = [
    { id: 'ruchaka', name: 'Ruchaka', planets: ['Ma'], houses: [10], class: 'mahapurusha', source: 'yogas' },
    { id: 'kemadruma', name: 'Kemadruma', planets: ['Mo'], houses: [4], class: 'dosha', source: 'yogas' },
    { id: 'kemadruma_bhanga', name: 'Kemadruma bhanga', planets: ['Mo', 'Ju'], houses: [4], class: 'cancellation', source: 'yogas' },
  ];
  const points: PointRow[] = [
    { id: 'UL', varga: 'D1', sign: 'Sg', house: 9, lord: 'Ju', lordHouse: 1 },
  ];
  const annual: AnnualRow[] = [
    {
      kind: 'TP', year: 2026, varga: 'D1', lagna: 'Ar',
      houses: [house(1, { lord: 'Ma', lordHouse: 10 }), house(10, {}), house(7, { lord: 'Ve', lordHouse: 12 }), house(12, {}), house(4, {}), house(5, {}), house(9, {})],
      dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Ju', from: '2026-04-10', to: '2026-09-01' }, { lord: 'Sa', from: '2026-09-01', to: '2027-04-29' }] }],
      sahams: [{ name: 'Punya', sign: 'Ar', house: 1 }, { name: 'Vivaha', sign: 'Li', house: 7 }],
    },
    {
      kind: 'TP', year: 2025, varga: 'D1', lagna: 'Ar', houses: [],
      dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Me', from: '2025-04-21', to: '2026-04-10' }] }],
      sahams: [],
    },
  ];
  return fakeDigest({ houses, planets, yogas, points, annual, gandanta: [] });
}

/** Activation for the Self fixture: Saturn's main period running to 2031, Jupiter's sub-period now, Mercury's next. */
export function selfActivation(): ActivationRow[] {
  return [
    act({ level: 1, lord: 'Sa', from: '2012-03-01', to: '2031-03-01', houses: [4, 10, 11] }),
    act({ level: 2, lord: 'Ve', from: '2025-01-01', to: '2026-02-01', houses: [2, 7], parentLord: 'Sa' }),
    act({ level: 2, lord: 'Ju', from: '2026-02-01', to: '2027-06-01', houses: [1, 9, 12, 5], parentLord: 'Sa' }),
    act({ level: 2, lord: 'Me', from: '2027-06-01', to: '2028-10-01', houses: [3, 6], parentLord: 'Sa' }),
    act({ level: 1, lord: 'Me', from: '2031-03-01', to: '2048-03-01', houses: [3, 6] }),
    act({ system: 'narayana', family: 'rasi', level: 1, sign: 'Ar', from: '2024-01-01', to: '2030-01-01', houses: [1] }),
    act({ system: 'yogini', family: 'yogini', level: 2, lord: 'Ju', from: '2026-01-01', to: '2027-01-01', houses: [1, 9] }),
    act({ system: 'tithi_ashtottari', family: 'tithi_ashtottari', level: 2, lord: 'Ma', from: '2026-03-01', to: '2027-03-01', houses: [1, 8] }),
  ];
}
