/**
 * A synthetic DigestView (doc 54 §2) for the life reading tests: no real birth data, no person. Every house and planet
 * card is built from a "tone" (strong or weak) and per-card overrides.
 */
import type { ActivationFamily, ActivationRow, AnnualRow, DigestView, HouseCard, PlanetCard } from '../../../../src/reading/digest/types.js';

export type Tone = 'strong' | 'weak';
const SIGNS = ['Sign1', 'Sign2', 'Sign3', 'Sign4', 'Sign5', 'Sign6', 'Sign7', 'Sign8', 'Sign9', 'Sign10', 'Sign11', 'Sign12'];
const LORDS = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];
const PLANETS = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];

const classOf = (h: number): string[] => [
  ...([1, 4, 7, 10].includes(h) ? ['kendra'] : []),
  ...([1, 5, 9].includes(h) ? ['trikona'] : []),
  ...([6, 8, 12].includes(h) ? ['dusthana'] : []),
];

export function houseCard(varga: string, h: number, tone: Tone, over: Partial<HouseCard> = {}): HouseCard {
  return {
    varga,
    house: h,
    sign: SIGNS[h - 1],
    lord: LORDS[h - 1],
    lordHouse: tone === 'strong' ? 1 : 8,
    lordSign: null,
    lordDignity: tone === 'strong' ? 'exalted' : 'debilitated',
    coLord: null,
    occupants: [],
    aspectedGraha: [],
    aspectedRasi: [],
    argala: null,
    sav: tone === 'strong' ? 32 : 20,
    class: classOf(h),
    cuspStar: null,
    arudha: null,
    ...over,
  };
}

export function planetCard(varga: string, p: string, tone: Tone, over: Partial<PlanetCard> = {}): PlanetCard {
  return {
    varga,
    planet: p,
    sign: null,
    house: 1,
    degree: null,
    star: null,
    pada: null,
    starLord: null,
    dignity: tone === 'strong' ? 'own' : 'debilitated',
    retro: false,
    combust: false,
    war: false,
    dispositor: null,
    dispositorHouse: null,
    chain: [],
    avasthas: {},
    shadbalaRatio: null,
    shadbalaRank: PLANETS.indexOf(p) + 1,
    natural: null,
    functional: tone === 'strong' ? 'benefic' : 'malefic',
    owns: [],
    aspectsTo: [],
    aspectedBy: [],
    conjunctions: [],
    ...over,
  };
}

export interface ViewSpec {
  tone: Tone;
  vargas?: string[];
  houses?: Record<string, Record<number, Partial<HouseCard>>>;
  planets?: Record<string, Record<string, Partial<PlanetCard>>>;
  annual?: Record<number, AnnualRow[]>;
}

export function makeView(spec: ViewSpec): DigestView {
  const vargas = spec.vargas ?? ['D1', 'D9', 'D10'];
  const houses = new Map<string, HouseCard[]>();
  const planets = new Map<string, PlanetCard[]>();
  for (const v of vargas) {
    houses.set(v, Array.from({ length: 12 }, (_, i) => houseCard(v, i + 1, spec.tone, spec.houses?.[v]?.[i + 1])));
    planets.set(v, PLANETS.map((p) => planetCard(v, p, spec.tone, spec.planets?.[v]?.[p])));
  }
  return {
    kundliId: 'k-test',
    status: 'ready',
    version: 'd1.test',
    builtAt: '2026-11-01T00:00:00Z',
    house: (v, h) => houses.get(v)?.find((c) => c.house === h) ?? null,
    houses: (v) => houses.get(v) ?? [],
    planet: (v, p) => planets.get(v)?.find((c) => c.planet === p) ?? null,
    planets: (v) => planets.get(v) ?? [],
    vargas: () => vargas,
    yogas: () => [],
    points: () => [],
    annual: (year?: number) => (year === undefined ? Object.values(spec.annual ?? {}).flat() : (spec.annual?.[year] ?? [])),
    star: () => null,
    sourceOf: () => [],
  };
}

export function row(system: string, family: ActivationFamily, from: string, to: string, houses: number[], lord: string | null, over: Partial<ActivationRow> = {}): ActivationRow {
  return { system, family, level: 2, lord, sign: null, from, to, houses, parentLord: 'Ju', ...over };
}

export function annualRow(kind: 'TP' | 'VP', year: number, house: number, tone: Tone): AnnualRow {
  return { kind, year, varga: 'D1', lagna: null, houses: [houseCard('D1', house, tone)], dashas: [], sahams: [] };
}
