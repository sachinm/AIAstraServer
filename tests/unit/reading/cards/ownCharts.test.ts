/** docs/techniques/09 §4: the card's own charts, its lens, and the sign-dasha fallback (Narayana on D9/D10 → D1). */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/reading/cards/routing.js', () => ({
  LENS_IDS: [],
  routeFor: (id: string) =>
    id === 'marriage_timing'
      ? { card: id, board: 'love', lens: 'love.marriage', houses: [7], promiseCharts: ['D1', 'D9'], signDasha: 'narayana D9', yearCharts: ['D9'], points: ['UL'] }
      : id === 'primary_job_promotion'
        ? { card: id, board: 'work', lens: 'work.primary_job', houses: [10], promiseCharts: ['D10'], signDasha: 'sudasa', yearCharts: ['D10'], points: [] }
        : null,
  recipeText: () => null,
}));

const { ownChartsOf, signDashaOf, lensOf } = await import('../../../../src/reading/cards/ownCharts.js');

describe('own charts and sign dasha', () => {
  it('the route decides; D1 is never a card own chart', () => {
    expect(ownChartsOf('marriage_timing')).toEqual(['D9']);
    expect(ownChartsOf('primary_job_promotion')).toEqual(['D10']);
    expect(lensOf('marriage_timing')).toBe('love.marriage');
  });
  it('without a route: today\'s routing words (Self) and the board chart', () => {
    expect(ownChartsOf('drive')).toEqual(['D10']);
    expect(ownChartsOf('body')).toEqual(['D30']);
    expect(lensOf('body')).toBe('self.body');
  });
  it('Narayana on D9/D10 falls back to Narayana on D1 and says so', () => {
    expect(signDashaOf('marriage_timing')).toMatchObject({ system: 'narayana', varga: 'D1' });
    expect(signDashaOf('marriage_timing')!.note).toContain('Narayana on D1 is read instead');
    expect(signDashaOf('primary_job_promotion')).toEqual({ system: 'sudasa', varga: 'D1', note: null });
    expect(signDashaOf('drive')).toBeNull();
  });
});
