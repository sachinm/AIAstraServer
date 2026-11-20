export type LensId = 'self.temperament' | 'self.mind' | 'self.purpose' | 'self.body' | 'self.chapter' | 'love.dating' | 'love.marriage' | 'love.friends' | 'love.allies' | 'work.career_start' | 'work.primary_job' | 'work.hobby' | 'work.business';
export const LENS_IDS: readonly LensId[] = ['self.temperament','self.mind','self.purpose','self.body','self.chapter','love.dating','love.marriage','love.friends','love.allies','work.career_start','work.primary_job','work.hobby','work.business'];
export interface CardRoute { card: string; board: 'self' | 'love' | 'work'; lens: LensId; houses: number[]; promiseCharts: string[]; signDasha: string; yearCharts: string[]; points: string[]; }
export function routeFor(_cardId: string): CardRoute | null { return null; }
export function recipeText(_lens: LensId): string | null { return null; }
