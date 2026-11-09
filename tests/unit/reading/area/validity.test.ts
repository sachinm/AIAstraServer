import { describe, expect, it } from 'vitest';
import { storedValidity, validityOf } from '../../../../src/reading/area/validity.js';

describe('board reading validity (docs/billing/02 §10)', () => {
  const madeAt = new Date('2026-11-09T08:30:00Z');
  it('the last good day is the day before the window ends, and never before today', () => {
    expect(validityOf({ madeAt, window: { to: new Date('2026-12-04T00:00:00Z') } }, '2026-11-09')).toEqual({ made_at: '2026-11-09T08:30:00.000Z', valid_until: '2026-12-03' });
    expect(validityOf({ madeAt, window: { to: new Date('2026-11-09T12:00:00Z') } }, '2026-11-09').valid_until).toBe('2026-11-09');
    expect(validityOf({ madeAt, window: { to: null } }, '2026-11-09').valid_until).toBeNull();
  });
  it('reads it back from the stored build; an older row falls back to its own day', () => {
    expect(storedValidity({ validity: { made_at: 'x', valid_until: '2026-12-03' } }, null, '2026-11-09')).toEqual({ made_at: 'x', valid_until: '2026-12-03' });
    expect(storedValidity({ board: {} }, madeAt, '2026-11-09')).toEqual({ made_at: '2026-11-09T08:30:00.000Z', valid_until: '2026-11-09' });
  });
});
