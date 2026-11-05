/**
 * Category of a run (docs/admin/03 §4.1): which of Self, Love, Work or General a General Reading subject or a Lucky times
 * area belongs to, so the admin can group agents and techniques by the task they served. A label only: nothing here reads
 * a chart.
 */
import type { SubjectId } from '../reading/packs/frames.js';
import type { Area } from '../reading/luckyTimes/scenarios.js';

export type TechniqueCategory = 'self' | 'love' | 'work' | 'general';
export const TECHNIQUE_CATEGORIES: readonly TechniqueCategory[] = ['self', 'love', 'work', 'general'];

/** The plan's table (docs/admin/03 §4.1 "Categories"); every SUBJECT_IDS entry is listed. */
export const SUBJECT_CATEGORY: Record<SubjectId, TechniqueCategory> = {
  career_work: 'work',
  income_wealth: 'work',
  debt_loss_expense: 'work',
  litigation_government: 'work',
  speculation_lottery: 'work',
  marriage_relationship: 'love',
  children: 'love',
  health_body: 'self',
  education_learning: 'self',
  spirituality_moksha: 'self',
  general_life_direction: 'self',
  property_home: 'self',
  vehicles: 'self',
  siblings: 'self',
  foreign_relocation: 'self',
  travel_journeys: 'self',
  explain_term: 'general',
};

export function categoryOfSubject(subject: string | null | undefined): TechniqueCategory {
  if (!subject) return 'general';
  return (SUBJECT_CATEGORY as Record<string, TechniqueCategory>)[subject] ?? 'general';
}

const LUCKY_AREA_CATEGORY: Record<Area, TechniqueCategory> = { work: 'work', money: 'work', love: 'love', travel: 'self', study: 'self', home: 'self' };

export function categoryOfLuckyArea(area: string | null | undefined): TechniqueCategory {
  if (!area) return 'general';
  return (LUCKY_AREA_CATEGORY as Record<string, TechniqueCategory>)[area] ?? 'general';
}
