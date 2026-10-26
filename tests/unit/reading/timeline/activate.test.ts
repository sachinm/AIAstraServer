import { describe, expect, it } from 'vitest';
import { grahaActivations } from '../../../../src/reading/timeline/activate/graha.js';
import { activateJaimini } from '../../../../src/reading/timeline/activate/jaimini.js';
import { activateNarayana } from '../../../../src/reading/timeline/activate/narayana.js';
import { activateTithiAshtottari } from '../../../../src/reading/timeline/activate/tithiAshtottari.js';
import { activateTransitContacts, mergeContacts } from '../../../../src/reading/timeline/activate/transits.js';
import { activateVimshottari } from '../../../../src/reading/timeline/activate/vimshottari.js';
import { activateYogini } from '../../../../src/reading/timeline/activate/yogini.js';
import type { TransitContactsPayload } from '../../../../src/reading/chartData/transitContacts.js';
import { buildDashaStack, type DashaStack } from '../../../../src/reading/timeline/dashas.js';
import { buildFoundation } from '../../../../src/reading/timeline/foundation.js';
import { loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const inputs = loadG1TimelineInputs();
const f = buildFoundation(inputs.dossier);
const stack = buildDashaStack(inputs.dossier, inputs.items, { from: '2008-10-01', to: '2026-11-01' });
const rules = { secondaryHouseStrength: 1, mdCounts: true };
const ctx = { level: 2 as const, parentLord: null, hasFinerLevel: false, secondaryHouseStrength: 1 };

describe('graha period-lord rule (S1-S3, doc 27 §A.3)', () => {
  it('Saturn (lord of 5 and 6, in 9) activates children through the primary 5th at strength 2', () => {
    const hit = grahaActivations(f, 'Sa', ctx).find((h) => h.marker === 'children')!;
    expect(hit).toMatchObject({ strength: 2, polarity: 1 });
    expect(hit.evidence).toContain('houses.5.lord');
  });

  it('secondary frame houses follow the rule knob (doc literal 2, tighter 1)', () => {
    // Moon sits in the 2nd: a secondary house of children (5, 9, 2); it is not a children karaka
    const literal = grahaActivations(f, 'Mo', { ...ctx, secondaryHouseStrength: 2 }).find((h) => h.marker === 'children')!;
    const tight = grahaActivations(f, 'Mo', ctx).find((h) => h.marker === 'children')!;
    expect(literal.strength).toBe(2);
    expect(tight.strength).toBe(1);
  });

  it('a lord in a dusthana makes the activation adverse (Sun in 8)', () => {
    const hits = grahaActivations(f, 'Su', ctx);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.filter((h) => h.marker !== 'money').every((h) => h.polarity === -1)).toBe(true);
  });

  it('money takes owning/occupying 6/8/12 as an adverse activation', () => {
    expect(grahaActivations(f, 'Sa', ctx).some((h) => h.marker === 'money' && h.polarity === -1 && h.evidence.includes('houses.6.lord'))).toBe(true);
  });

  it('AD in 6/8/12 from the MD lord and an MD under an AD count one lower', () => {
    const plain = grahaActivations(f, 'Sa', ctx).find((h) => h.marker === 'children')!.strength;
    // Saturn in 9 is 12th from Jupiter in 10
    const underJu = grahaActivations(f, 'Sa', { ...ctx, parentLord: 'Ju' }).find((h) => h.marker === 'children')!;
    expect(underJu.strength).toBe(plain - 1);
    const md = grahaActivations(f, 'Sa', { ...ctx, level: 1, hasFinerLevel: true }).find((h) => h.marker === 'children')!;
    expect(md.strength).toBe(plain - 1);
  });
});

describe('dasha systems on G1', () => {
  it('S1, S2, S3 cite the period row first, then dossier fields', () => {
    for (const acts of [activateVimshottari(f, stack, rules), activateYogini(f, stack, rules), activateTithiAshtottari(f, stack, rules)]) {
      expect(acts.length).toBeGreaterThan(50);
      for (const a of acts) {
        expect(a.evidence[0]).toMatch(/^dasha\./);
        expect(a.evidence.length).toBeGreaterThan(1);
        expect(a.strength).toBeGreaterThan(0);
      }
    }
  });

  it('S2: an Ulka (Saturn) period makes the markers Saturn rules adverse', () => {
    const sa = activateYogini(f, stack, rules).filter((a) => a.planet === 'Sa' && a.marker === 'children');
    expect(sa.length).toBeGreaterThan(0);
    expect(sa.every((a) => a.polarity === -1)).toBe(true);
  });

  it('mdCounts=false leaves MD lords out', () => {
    const levels = new Set(activateVimshottari(f, stack, { ...rules, mdCounts: false }).map((a) => a.level));
    expect(levels.has('md')).toBe(false);
  });

  it('S4 Narayana: Pisces (7th from a Virgo lagna) activates love and marriage at strength 2', () => {
    const one: DashaStack = { rows: [{ system: 'narayana', level: 2, lord: null, sign: 11, parentLord: null, parentSign: null, from: '2010-01-01', to: '2011-01-01', evidence: 'dasha.narayana.periods[0].children[0]' }], sources: {}, missing: [] };
    const acts = activateNarayana(f, one, rules);
    const love = acts.find((a) => a.marker === 'love_marriage')!;
    expect(love).toMatchObject({ strength: 2, polarity: 1, planet: 'Ju', sign: 11 });
    expect(love.evidence).toContain('houses.7.sign');
    // HL sits in Pisces: business and money get the special lagna at 2
    expect(acts.find((a) => a.marker === 'money')!.evidence).toContain('special_lagnas.HL.sign');
  });

  it('S7 Jaimini cites the arudha and the argala or aspect it read', () => {
    const acts = activateJaimini(f, stack, rules);
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) {
      expect(a.level).toBe('modifier');
      expect(a.evidence.some((e) => /^(arudhas|special_lagnas)\./.test(e))).toBe(true);
      expect(a.evidence.some((e) => /argala|aspects_to|\.house$/.test(e))).toBe(true);
    }
  });
});

describe('S6 transit contacts', () => {
  const contact = (over: Partial<TransitContactsPayload['contacts'][number]>): TransitContactsPayload['contacts'][number] => ({ transit: 'Sa', natal: 'La', natal_house: 1, orb_deg: 0, from: '2010-11-07', to: '2011-09-10', exact: ['2010-11-27'], station_in_orb: false, stations: [], ...over });

  it('joins a contact that crosses a range boundary', () => {
    const a: TransitContactsPayload = { from: '2008-10-01', to: '2018-08-10', orb: 2, planets: ['Sa'], contacts: [contact({ from: '2018-07-01', to: '2018-08-10', exact: ['2018-07-20'], ends_after_range: true })] };
    const b: TransitContactsPayload = { from: '2018-08-11', to: '2026-10-31', orb: 2, planets: ['Sa'], contacts: [contact({ from: '2018-08-11', to: '2018-09-30', exact: ['2018-09-02'], starts_before_range: true })] };
    const merged = mergeContacts([b, a]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.contact).toMatchObject({ from: '2018-07-01', to: '2018-09-30', exact: ['2018-07-20', '2018-09-02'] });
    expect(merged[0]!.evidence).toHaveLength(2);
  });

  it('Saturn over the lagna tests health, stronger in the exact month', () => {
    const acts = activateTransitContacts(f, mergeContacts([{ from: '2008-10-01', to: '2018-08-10', orb: 2, planets: ['Sa'], contacts: [contact({})] }]));
    const health = acts.filter((a) => a.marker === 'health');
    expect(health.every((a) => a.polarity === -1 && a.level === 'contact')).toBe(true);
    expect(Math.max(...health.map((a) => a.strength))).toBe(1.5);
    expect(health[0]!.evidence[0]).toBe('transit_contacts[2008-10-01..2018-08-10].contacts[0]');
  });

  it('the G1 contacts fixture activates markers with cited evidence', () => {
    const acts = activateTransitContacts(f, mergeContacts(inputs.contacts));
    expect(acts.length).toBeGreaterThan(20);
    expect(acts.every((a) => a.item && a.evidence[0]!.startsWith('transit_contacts['))).toBe(true);
  });
});
