import { describe, expect, it } from 'vitest';
import { validateFacts, validateTransits } from '../../../src/reading/schema/validate.js';
import { loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

describe('facts.v1 schema', () => {
  it('accepts the golden-chart dossier', () => {
    const r = validateFacts(loadG1Dossier());
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
  });
  it('rejects a wrong version', () => {
    const d: any = loadG1Dossier();
    d.v = 2;
    expect(validateFacts(d).ok).toBe(false);
  });
  it('rejects a body without a house', () => {
    const d: any = loadG1Dossier();
    delete d.bodies.Me.house;
    const r = validateFacts(d);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/bodies/);
  });
  it('rejects a house number outside 1-12', () => {
    const d: any = loadG1Dossier();
    d.houses['10'].lord_house = 13;
    expect(validateFacts(d).ok).toBe(false);
  });
  it('rejects a missing D-10 (the career varga must be present)', () => {
    const d: any = loadG1Dossier();
    delete d.vargas.D10;
    expect(validateFacts(d).ok).toBe(false);
  });
  it('rejects a dasha period with a bad date', () => {
    const d: any = loadG1Dossier();
    d.dasha.vimshottari.periods[0].start = '24/10/2026';
    expect(validateFacts(d).ok).toBe(false);
  });
});

describe('transits.v1 schema', () => {
  it('accepts the golden-chart transit chart', () => {
    const r = validateTransits(loadG1Transits());
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
  });
  it('rejects a global snapshot posing as a natal overlay', () => {
    const t: any = loadG1Transits();
    t.kind = 'global';
    expect(validateTransits(t).ok).toBe(false);
  });
  it('rejects a row without a house from Lagna', () => {
    const t: any = loadG1Transits();
    delete t.rows[0].house_from_lagna;
    expect(validateTransits(t).ok).toBe(false);
  });
});
