/**
 * The life markers the timeline tracks (docs/reading-engine/27 §A.2): each a frame of houses, karakas, arudhas and
 * vargas, plus the ledger categories it is checked against. A table of labels and codes; nothing here reads a chart.
 * Doc 27 says "ten markers" but its table has eleven rows; all eleven are kept (property and vehicles stay one marker).
 */
import type { PlanetCode } from '../facts/constants.js';
import type { KarakaCode } from '../packs/frames.js';

export const MARKER_IDS = [
  'family_parents',
  'siblings',
  'love_marriage',
  'children',
  'career',
  'business',
  'money',
  'residence',
  'property_vehicles',
  'education',
  'health',
] as const;
export type MarkerId = (typeof MARKER_IDS)[number];

export interface Marker {
  id: MarkerId;
  label: string;
  /** Houses from the lagna, primary first; activating one supports the marker */
  houses: number[];
  /** Houses whose activation is adverse for the marker (money: loss through 6/8/12) */
  adverseHouses: number[];
  karakas: PlanetCode[];
  charaKarakas: KarakaCode[];
  /** Arudha padas (A1..A12, AL, UL) */
  arudhas: string[];
  /** Special lagnas (HL, GL, IL, SL …) */
  specialLagnas: string[];
  vargas: string[];
  /** Ledger category prefixes (dotted) that belong to this marker */
  categories: string[];
}

const M = (m: Marker): Marker => m;

export const MARKERS: Record<MarkerId, Marker> = {
  family_parents: M({ id: 'family_parents', label: 'Family: father, mother', houses: [9, 4, 10], adverseHouses: [], karakas: ['Su', 'Mo'], charaKarakas: ['PiK', 'MK'], arudhas: ['A9', 'A4'], specialLagnas: [], vargas: ['D12'], categories: ['family.father', 'family.mother'] }),
  siblings: M({ id: 'siblings', label: 'Family: siblings', houses: [3, 11], adverseHouses: [], karakas: ['Ma'], charaKarakas: ['BK'], arudhas: ['A3', 'A11'], specialLagnas: [], vargas: ['D3'], categories: ['family.sibling'] }),
  love_marriage: M({ id: 'love_marriage', label: 'Love and marriage', houses: [7, 5, 2, 11, 12], adverseHouses: [], karakas: ['Ve', 'Ju'], charaKarakas: ['DK'], arudhas: ['UL', 'A7'], specialLagnas: [], vargas: ['D9'], categories: ['relationship', 'marriage'] }),
  children: M({ id: 'children', label: 'Children', houses: [5, 9, 2], adverseHouses: [], karakas: ['Ju'], charaKarakas: ['PK'], arudhas: ['A5'], specialLagnas: [], vargas: ['D7'], categories: ['child'] }),
  career: M({ id: 'career', label: 'Job and career', houses: [10, 6, 1, 2], adverseHouses: [], karakas: ['Su', 'Sa', 'Me', 'Ju'], charaKarakas: ['AmK'], arudhas: ['A10'], specialLagnas: ['GL'], vargas: ['D10'], categories: ['job'] }),
  business: M({ id: 'business', label: 'Business', houses: [7, 10, 11, 2, 5], adverseHouses: [], karakas: ['Me', 'Sa', 'Ju'], charaKarakas: ['AmK'], arudhas: ['A7', 'A10'], specialLagnas: ['HL'], vargas: ['D10', 'D2'], categories: ['business'] }),
  money: M({ id: 'money', label: 'Money: gain and loss', houses: [2, 11, 5, 9], adverseHouses: [6, 8, 12], karakas: ['Ju', 'Ve'], charaKarakas: [], arudhas: ['A2', 'A11', 'A8'], specialLagnas: ['HL', 'IL'], vargas: ['D2'], categories: ['money'] }),
  residence: M({ id: 'residence', label: 'Residence and movement', houses: [4, 12, 3, 9], adverseHouses: [], karakas: ['Mo', 'Ra', 'Ve'], charaKarakas: [], arudhas: ['A4', 'A12', 'A3'], specialLagnas: [], vargas: ['D4'], categories: ['residence', 'travel.long'] }),
  property_vehicles: M({ id: 'property_vehicles', label: 'Property and vehicles', houses: [4, 2, 11, 3], adverseHouses: [], karakas: ['Ma', 'Ve'], charaKarakas: ['MK'], arudhas: ['A4'], specialLagnas: [], vargas: ['D4', 'D16'], categories: ['property', 'vehicle'] }),
  education: M({ id: 'education', label: 'Education', houses: [4, 5, 9, 2], adverseHouses: [], karakas: ['Me', 'Ju'], charaKarakas: [], arudhas: ['A5', 'A9'], specialLagnas: [], vargas: ['D24'], categories: ['education'] }),
  health: M({ id: 'health', label: 'Health (facts only)', houses: [1, 6, 8, 12], adverseHouses: [], karakas: ['Su', 'Mo', 'Sa'], charaKarakas: ['AK', 'GK'], arudhas: ['A6', 'A8'], specialLagnas: [], vargas: ['D30'], categories: ['health'] }),
};

/** The marker a dotted ledger category belongs to (longest prefix wins); null when none does. */
export function markerForCategory(category: string): MarkerId | null {
  let best: { id: MarkerId; len: number } | null = null;
  for (const m of Object.values(MARKERS)) {
    for (const prefix of m.categories) {
      if ((category === prefix || category.startsWith(`${prefix}.`)) && (!best || prefix.length > best.len)) best = { id: m.id, len: prefix.length };
    }
  }
  return best?.id ?? null;
}
