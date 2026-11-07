import { describe, expect, it } from 'vitest';
import { activationFor, applicableConditionalSystems, buildActivationRows, dashaTrees, familyOf, grahaHouses } from '../../../../src/reading/digest/activation.js';
import { buildDigestRows } from '../../../../src/reading/digest/build.js';
import type { HouseCard, PlanetCard } from '../../../../src/reading/digest/types.js';
import { fakeDigestPrisma, loadFixture } from './helpers.js';

const fx = loadFixture();
const rows = buildDigestRows(fx.items, { kundliId: 'k1' });
const card = (p: string) => rows.find((r) => r.section === 'planet' && r.key === `D1.${p}`)!.row as PlanetCard;
const houseOf = (sign: string) => rows.map((r) => r.row as HouseCard).find((h) => h.varga === 'D1' && h.sign === sign && 'occupants' in h)!;
const act = buildActivationRows(fx.items, rows, { today: '2026-11-06' });

describe('activation calendar', () => {
  it('reads the .l3 tree where one is stored, and every other stored tree', () => {
    const trees = dashaTrees(fx.items);
    expect(trees.find((t) => t.system === 'vimsottari')?.key).toBe('dasha.vimsottari.l3');
    expect(trees.map((t) => t.system).sort()).toEqual(['kalachakra', 'vimsottari', 'yogini']);
    expect(act.filter((a) => a.system === 'vimsottari').some((a) => a.level === 3)).toBe(true);
  });

  it("a graha period activates the lord's D1 house, the houses it owns and its graha drishti", () => {
    const ju = act.find((a) => a.system === 'vimsottari' && a.level === 1 && a.lord === 'Ju')!;
    const c = card('Ju');
    expect(ju.houses).toEqual([...new Set([c.house!, ...c.owns, ...c.aspectsTo])].sort((a, b) => a - b));
    expect(ju.houses).toEqual(grahaHouses(c));
    expect(ju.family).toBe('vimshottari');
    const pd = act.find((a) => a.system === 'vimsottari' && a.level === 3)!;
    expect(pd.parentLord).toBeTruthy();
  });

  it("a rasi period activates the sign's house (house_counts) and the house of the sign's lord", () => {
    const k = act.find((a) => a.system === 'kalachakra')!;
    expect(k.family).toBe('rasi');
    expect(k.lord).toBeNull();
    const signIndex = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'].indexOf(k.sign!);
    const own = (fx.items.house_counts as { sign_to_house: Record<string, number> }).sign_to_house[String(signIndex)]!;
    const lordHouse = houseOf(k.sign!).lordHouse!;
    expect(k.houses).toEqual([...new Set([own, lordHouse])].sort((a, b) => a - b));
  });

  it('families follow doc 46 §B.4 and gate conditional dashas by dasha.applicable (applies === true)', () => {
    const none = new Set<string>();
    expect(familyOf('vimsottari', false, none)).toBe('vimshottari');
    expect(familyOf('ashtottari', false, none)).toBe('other');
    expect(familyOf('ashtottari', false, new Set(['ashtottari']))).toBe('conditional');
    expect(familyOf('some_new', false, new Set(['some_new']))).toBe('conditional');
    expect(familyOf('yogini', false, none)).toBe('yogini');
    expect(familyOf('tithi_ashtottari', false, none)).toBe('tithi_ashtottari');
    expect(familyOf('karaka', false, none)).toBe('karaka');
    expect(familyOf('narayana', true, none)).toBe('rasi');
    expect(familyOf('tara', false, none)).toBe('other');
    expect(act.find((a) => a.system === 'yogini')?.family).toBe('yogini');

    const app = applicableConditionalSystems(fx.items['dasha.applicable']);
    expect(app.has('chathuraaseethi_sama')).toBe(true);
    expect(app.has('chaturshitisama')).toBe(true);
    expect(app.has('ashtottari')).toBe(false);
    expect(app.has('dwisatpathi')).toBe(false);
    expect(familyOf('chaturshitisama', false, app)).toBe('conditional');
    expect(familyOf('dwisatpathi', false, app)).toBe('other');
  });

  it('runs to thirty years after today and no further', () => {
    expect(act.every((a) => a.from < '2056-11-06')).toBe(true);
    expect(act.some((a) => a.to > '2050-01-01')).toBe(true);
    const short = buildActivationRows(fx.items, rows, { today: '2026-11-06', yearsAhead: 1 });
    expect(short.every((a) => a.from < '2027-11-06')).toBe(true);
    expect(short.length).toBeLessThan(act.length);
  });

  it('activationFor asks for the range, houses (GIN hasSome), systems and level', async () => {
    const f = fakeDigestPrisma();
    await activationFor(f.prisma as never, 'k1', { from: '2027-01-01', to: '2030-01-01', houses: [7], systems: ['vimsottari'], maxLevel: 2 });
    expect(f.prisma.kundliActivation.lastFindMany).toMatchObject({
      where: { kundli_id: 'k1', from_date: { lt: new Date('2030-01-01T00:00:00Z') }, to_date: { gt: new Date('2027-01-01T00:00:00Z') }, houses: { hasSome: [7] }, system: { in: ['vimsottari'] }, level: { lte: 2 } },
    });
  });
});
