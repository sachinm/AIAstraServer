import { describe, expect, it } from 'vitest';
import { activateDoubleTransit } from '../../../../src/reading/timeline/activate/doubleTransit.js';
import { grahaActivations } from '../../../../src/reading/timeline/activate/graha.js';
import { activateJaimini } from '../../../../src/reading/timeline/activate/jaimini.js';
import { activateNarayana } from '../../../../src/reading/timeline/activate/narayana.js';
import { activateTithiAshtottari } from '../../../../src/reading/timeline/activate/tithiAshtottari.js';
import { activateTransitContacts, contactPolarity, mergeContacts, type SourcedContact } from '../../../../src/reading/timeline/activate/transits.js';
import { activateVimshottari } from '../../../../src/reading/timeline/activate/vimshottari.js';
import { activateYogini } from '../../../../src/reading/timeline/activate/yogini.js';
import type { RadhaContact, TransitContactsPayload } from '../../../../src/reading/chartData/transitContacts.js';
import { buildDashaStack, type DashaStack } from '../../../../src/reading/timeline/dashas.js';
import { buildFoundation } from '../../../../src/reading/timeline/foundation.js';
import { MARKER_IDS } from '../../../../src/reading/timeline/markers.js';
import { buildSignification, sigOf } from '../../../../src/reading/timeline/signification.js';
import { loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const inputs = loadG1TimelineInputs();
const f = buildFoundation(inputs.dossier);
const s = buildSignification(f, 3);
const stack = buildDashaStack(inputs.dossier, inputs.items, { from: '2008-10-01', to: '2026-11-01' });

describe('signification table (doc 29 §3.1) on G1', () => {
  it('caps every planet at three markers on each side', () => {
    for (const row of [...Object.values(s.sig), ...Object.values(s.adv)]) expect(Object.keys(row ?? {}).length).toBeLessThanOrEqual(3);
  });

  it('leaves no marker without a significator (scarcity tie-break)', () => {
    for (const m of MARKER_IDS) expect(Object.values(s.sig).some((row) => (row?.[m]?.value ?? 0) >= 2)).toBe(true);
  });

  it('reads the primary-house lord at 3 with its path (Saturn lords the 5th: children)', () => {
    expect(s.sig.Sa!.children).toMatchObject({ value: 3, primary: true, evidence: ['houses.5.lord'] });
    expect(s.sig.Ju!.education).toMatchObject({ value: 3, primary: true });
  });

  it('moves lordship to the adverse table for a planet in a dusthana (Sun in 8 lords the 12th)', () => {
    expect(s.adv.Su!.love_marriage!.value).toBe(1);
    expect(s.adv.Su!.love_marriage!.evidence).toContain('bodies.Su.house');
    expect(sigOf(s.sig, 'Su', 'love_marriage')).toBe(0);
  });

  it('money: lording 6/8/12 signifies loss', () => {
    expect(s.adv.Sa!.money).toMatchObject({ value: 2, evidence: ['houses.6.lord'] });
  });

  it('a larger cap lets planets signify more', () => {
    const wide = buildSignification(f, 11);
    expect(Object.keys(wide.sig.Ju!).length).toBeGreaterThan(3);
  });
});

describe('graha period-lord rule (S1-S3, doc 29 §3.2)', () => {
  it('a lord activates only the markers it signifies', () => {
    const hits = grahaActivations(f, s, 'Sa', { parentLord: null });
    expect(hits.filter((h) => h.polarity === 1).map((h) => h.marker).sort()).toEqual(Object.keys(s.sig.Sa!).sort());
    expect(hits.find((h) => h.marker === 'money')).toMatchObject({ polarity: -1, strength: 2 });
  });

  it('6/8/12 from the parent lord lowers the support by one (Saturn in 9 is 12th from Jupiter in 10)', () => {
    const plain = grahaActivations(f, s, 'Sa', { parentLord: null }).find((h) => h.marker === 'children')!.strength;
    const under = grahaActivations(f, s, 'Sa', { parentLord: 'Ju' }).find((h) => h.marker === 'children')!;
    expect(under.strength).toBe(plain - 1);
    expect(under.evidence).toContain('bodies.Ju.house');
  });

  it('S1 runs MD/AD/PD; the confirmers S2/S3 run at AD only; every activation cites its period row', () => {
    const s1 = activateVimshottari(f, s, stack);
    expect(new Set(s1.map((a) => a.level))).toEqual(new Set(['md', 'ad', 'pd']));
    for (const acts of [activateYogini(f, s, stack), activateTithiAshtottari(f, s, stack)]) {
      expect(acts.length).toBeGreaterThan(10);
      expect(new Set(acts.map((a) => a.level))).toEqual(new Set(['ad']));
    }
    for (const a of s1) expect(a.evidence[0]).toMatch(/^dasha\./);
  });
});

describe('S4 Narayana as D4', () => {
  const one = (sign: number): DashaStack => ({ rows: [{ system: 'narayana', level: 2, lord: null, sign, parentLord: null, parentSign: null, from: '2010-01-01', to: '2011-01-01', evidence: 'dasha.narayana.periods[0].children[0]' }], sources: {}, missing: [] });

  it('the sign holding the arudha scores 3 (Sagittarius holds UL: love and marriage)', () => {
    const love = activateNarayana(f, s, one(8)).find((a) => a.marker === 'love_marriage' && a.polarity === 1)!;
    expect(love).toMatchObject({ strength: 3, sign: 8 });
    expect(love.evidence).toContain('arudhas.UL.sign');
  });

  it('the primary house scores 2 (Pisces is the 7th from a Virgo lagna)', () => {
    const love = activateNarayana(f, s, one(11)).find((a) => a.marker === 'love_marriage' && a.polarity === 1)!;
    expect(love.strength).toBeGreaterThanOrEqual(2);
  });

  it('runs MD signs only where no AD sign runs', () => {
    expect(activateNarayana(f, s, stack).every((a) => a.level === 'ad')).toBe(true);
  });
});

describe('S6 contacts (T_c) and S6D double transit', () => {
  const contact = (over: Partial<RadhaContact>): RadhaContact => ({ transit: 'Sa', natal: 'La', natal_house: 1, orb_deg: 0, from: '2010-11-07', to: '2011-01-20', exact: ['2010-11-27'], station_in_orb: false, stations: [], ...over });
  const payload = (contacts: RadhaContact[]): TransitContactsPayload => ({ from: '2008-10-01', to: '2018-08-10', orb: 2, planets: ['Ju', 'Sa'], contacts });

  it('joins a contact that crosses a range boundary', () => {
    const a: TransitContactsPayload = { ...payload([contact({ from: '2018-07-01', to: '2018-08-10', exact: ['2018-07-20'], ends_after_range: true })]) };
    const b: TransitContactsPayload = { from: '2018-08-11', to: '2026-10-31', orb: 2, planets: ['Sa'], contacts: [contact({ from: '2018-08-11', to: '2018-09-30', exact: ['2018-09-02'], starts_before_range: true })] };
    const merged = mergeContacts([b, a]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.contact).toMatchObject({ from: '2018-07-01', to: '2018-09-30', exact: ['2018-07-20', '2018-09-02'] });
  });

  it('a contact on the lagna triggers every marker, monthly: 2 in the exact month, 1.5 in orb', () => {
    const acts = activateTransitContacts(f, s, mergeContacts([payload([contact({})])])).filter((a) => a.marker === 'career');
    expect(acts.map((a) => [a.from.slice(0, 7), a.strength])).toEqual([
      ['2010-11', 2],
      ['2010-12', 1.5],
      ['2011-01', 1.5],
    ]);
    expect(acts[0]!.evidence[0]).toBe('transit_contacts[2008-10-01..2018-08-10].contacts[0]');
  });

  it('a contact on a planet that does not signify the marker does not trigger it', () => {
    const acts = activateTransitContacts(f, s, mergeContacts([payload([contact({ natal: 'Ke', natal_house: 3 })])]));
    expect(new Set(acts.map((a) => a.marker))).toEqual(new Set(Object.keys(s.sig.Ke!).filter((m) => sigOf(s.sig, 'Ke', m as never) >= 2)));
  });

  it('Jupiter supports, Saturn supports what it signifies and tests the rest, Rahu supports residence', () => {
    expect(contactPolarity(s, 'Ju', 'money')).toBe(1);
    expect(contactPolarity(s, 'Sa', 'children')).toBe(1);
    expect(contactPolarity(s, 'Sa', 'career')).toBe(-1);
    expect(contactPolarity(s, 'Ra', 'residence')).toBe(1);
    expect(contactPolarity(s, 'Ke', 'residence')).toBe(-1);
  });

  it('double transit: Jupiter and Saturn on key points of the marker in the same month', () => {
    // Saturn's significations include children; its lord-of-the-5th is Saturn itself: Ju on Sa + Sa on La (lagna is no key) -> 2 or 3
    const sc = (c: RadhaContact, i: number): SourcedContact => ({ contact: c, evidence: [`transit_contacts[x].contacts[${i}]`] });
    const pair = [sc(contact({ transit: 'Ju', natal: 'Sa', natal_house: 9 }), 0), sc(contact({ transit: 'Sa', natal: 'Sa', natal_house: 9 }), 1)];
    const children = activateDoubleTransit(f, s, pair).filter((a) => a.marker === 'children');
    expect(children.length).toBeGreaterThan(0);
    expect(children[0]).toMatchObject({ system: 'S6D', strength: 3, polarity: 1, level: 'double' });
    expect(children[0]!.evidence).toEqual(['transit_contacts[x].contacts[0]', 'transit_contacts[x].contacts[1]']);
    expect(activateDoubleTransit(f, s, [pair[0]!])).toEqual([]);
  });

  it('the G1 contacts fixture produces cited monthly triggers', () => {
    const acts = activateTransitContacts(f, s, mergeContacts(inputs.contacts));
    expect(acts.length).toBeGreaterThan(20);
    expect(acts.every((a) => a.evidence[0]!.startsWith('transit_contacts['))).toBe(true);
  });
});

describe('S7 Jaimini modifier', () => {
  it('fires only for lords that signify the marker, at 0.5, citing the arudha', () => {
    const acts = activateJaimini(f, s, stack);
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) {
      expect(sigOf(s.sig, a.planet, a.marker)).toBeGreaterThanOrEqual(2);
      expect(a.strength).toBe(0.5);
      expect(a.evidence.some((e) => /^(arudhas|special_lagnas)\./.test(e))).toBe(true);
    }
  });
});
