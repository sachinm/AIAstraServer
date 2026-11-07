/**
 * The thirteen life areas of the comprehensive life reading (docs/reading-engine/34 §1, §2): each area's D1 houses
 * (primary first), natural karakas and owning varga. Taken from the subject frames (src/reading/packs/frames.ts) where a
 * frame exists; parents has no frame and follows doc 34 §2 (the 4th and 9th with the Moon and the Sun, read in D12).
 * A label table only: nothing here reads a chart.
 */
import { FRAMES, type SubjectId } from '../packs/frames.js';
import type { PlanetCode } from '../facts/constants.js';

export const LIFE_AREA_IDS = ['self', 'money', 'work', 'home', 'marriage', 'children', 'parents', 'siblings', 'legal', 'health', 'travel', 'learning', 'dharma'] as const;
export type LifeAreaId = (typeof LIFE_AREA_IDS)[number];

export interface LifeArea {
  id: LifeAreaId;
  /** plain words, shown in the table */
  label: string;
  /** the noun used inside sentences ("your work", "money") */
  words: string;
  /** D1 houses, primary first */
  houses: number[];
  karakas: PlanetCode[];
  /** the varga that owns the area, then fallbacks when the digest does not hold it; D9 is read for every area besides */
  vargas: string[];
  /** frames.ts subject this area is read through, when there is one */
  frame: SubjectId | null;
}

const fromFrame = (id: LifeAreaId, label: string, words: string, frame: SubjectId, over: Partial<Pick<LifeArea, 'houses' | 'karakas' | 'vargas'>> = {}): LifeArea => {
  const f = FRAMES[frame];
  return { id, label, words, frame, houses: over.houses ?? [...f.houses], karakas: over.karakas ?? [...f.karakas], vargas: over.vargas ?? [...f.vargas] };
};

export const LIFE_AREAS: LifeArea[] = [
  fromFrame('self', 'You', 'your own energy and direction', 'general_life_direction', { houses: [1, 9, 10], karakas: ['Su', 'Ju'], vargas: ['D9'] }),
  fromFrame('money', 'Money', 'money and savings', 'income_wealth'),
  fromFrame('work', 'Work', 'work', 'career_work'),
  fromFrame('home', 'Home', 'home and property', 'property_home'),
  fromFrame('marriage', 'Partner and marriage', 'partnership and marriage', 'marriage_relationship'),
  fromFrame('children', 'Children', 'children', 'children'),
  { id: 'parents', label: 'Parents', words: 'your parents', frame: null, houses: [4, 9], karakas: ['Mo', 'Su'], vargas: ['D12'] },
  fromFrame('siblings', 'Brothers and sisters', 'brothers and sisters', 'siblings'),
  fromFrame('legal', 'Disputes and paperwork', 'disputes, officials and paperwork', 'litigation_government', { vargas: ['D30', 'D10'] }),
  fromFrame('health', 'Health and energy', 'health and energy', 'health_body', { vargas: ['D30'] }),
  fromFrame('travel', 'Travel and moving', 'travel and moving', 'travel_journeys', { houses: [12, 9, 3, 7], karakas: ['Mo', 'Ra'], vargas: ['D4'] }),
  fromFrame('learning', 'Learning', 'study and learning', 'education_learning', { vargas: ['D24'] }),
  fromFrame('dharma', 'Purpose and faith', 'purpose and faith', 'spirituality_moksha', { vargas: ['D20', 'D9'] }),
];

export function lifeArea(id: LifeAreaId): LifeArea {
  return LIFE_AREAS.find((a) => a.id === id)!;
}

/** Every D1 house any area reads, for one activation query. */
export function allAreaHouses(): number[] {
  return [...new Set(LIFE_AREAS.flatMap((a) => a.houses))].sort((a, b) => a - b);
}
