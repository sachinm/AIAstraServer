/**
 * BUILD-GAPS BG-10 and BG-11 on the research calibration kundli's stored rows, with synthetic rows where the fixture
 * holds none (D10 cards, a present manglik row). BG-10: the manglik row's exceptions carried by the digest and read as a
 * softened knot, and the Venus Lajjitadi states. BG-11: D10 service against business, and the SAV of houses 10:11:12.
 * Every value read is an engine row; Node only selects, compares stored numbers and words them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDigestRows } from '../../../../src/reading/digest/build.js';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import type { HouseCard, YogaRow } from '../../../../src/reading/digest/types.js';
import { resolveClock } from '../../../../src/reading/self/clock.js';
import { heartPanel, lajjitadiWords, loveDoshaClaim, loveStrugglePanel } from '../../../../src/reading/self/panels/love.js';
import { gainPanel, groundPanel, savBalanceClaim, serviceOrBusinessClaim } from '../../../../src/reading/self/panels/work.js';
import type { PanelInput } from '../../../../src/reading/self/panels/common.js';
import { loadFixture } from '../digest/helpers.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const clock = resolveClock('dwisatpathi', FIX.systems);
const inputOf = (rows: Array<{ section: string; key: string; row: unknown }>): PanelInput => ({
  view: digestView('k1', rows as never, { status: 'ready', version: 'd1.test' }),
  asOf: '2026-11-07',
  clock,
  activation: FIX.activation,
});
const base = inputOf(FIX.digest);

const d10 = (house: number, over: Partial<HouseCard>): HouseCard => ({
  varga: 'D10', house, sign: null, lord: null, lordHouse: null, lordSign: null, lordDignity: null, coLord: null, occupants: [],
  aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: [], cuspStar: null, arudha: null, ...over,
});
const D10_ROWS = [
  { section: 'house', key: 'D10.h6', row: d10(6, { sign: 'Libra', lord: 'Ve', lordHouse: 9, lordDignity: 'friend', occupants: [{ planet: 'Me', dignity: 'neutral', nature: null }, { planet: 'Sa', dignity: 'exalted', nature: null }] }) },
  { section: 'house', key: 'D10.h7', row: d10(7, { sign: 'Scorpio', lord: 'Ma', lordHouse: 2, lordDignity: 'enemy', occupants: [] }) },
];
const MANGLIK: YogaRow = {
  id: 'manglik', name: 'Manglik Dosha', planets: ['Ma'], houses: [], class: 'dosha', source: 'doshas',
  details: { hasExceptions: true, exceptions: [{ id: 3, text: 'Mars in its own sign.' }], fromMoon: false, fromVenus: true },
};

const JARGON = /\b(Venus|Mars|Saturn|Manglik|Kuja|dosha|D10|SAV|bindu|lajjit|kshudhit|kshobhit|garvit|trishit|mudit)\b/i;

describe('BG-10 digest carries the dosha details', () => {
  it('selects has_exceptions, exceptions, from_moon and from_venus onto the dosha row', () => {
    const fx = loadFixture();
    const doshas = fx.items.doshas as { doshas: Array<Record<string, unknown>> };
    const m = doshas.doshas.find((d) => d.id === 'manglik')!;
    m.present = true;
    m.details = { has_exceptions: true, exceptions: [{ id: 3, text_en: 'Mars in its own sign.' }], from_moon: false, from_venus: true };
    const rows = buildDigestRows(fx.items, { kundliId: 'fixture-a', calcVersions: fx.calcVersions });
    const row = rows.find((r) => r.section === 'yoga' && r.key === 'D1.manglik')!.row as YogaRow;
    expect(row.details).toEqual({ hasExceptions: true, exceptions: [{ id: 3, text: 'Mars in its own sign.' }], fromMoon: false, fromVenus: true });
    const pitru = rows.find((r) => r.section === 'yoga' && r.key === 'D1.pitru')!.row as YogaRow;
    expect(pitru.details).toBeUndefined();
  });
});

describe('BG-10 love panels', () => {
  it('states a manglik row with exceptions as softened, citing the exception in the detail', () => {
    const c = loveDoshaClaim(MANGLIK);
    expect(c.text).toMatch(/ease/);
    expect(c.text).not.toMatch(/knot/);
    expect(c.detail).toMatch(/softened by 1 classical exception: Mars in its own sign\./);
    expect(c.detail).toMatch(/from Venus: yes/);
    expect(c.evidence).toEqual(['yoga:D1.manglik']);
    expect(`${c.text} ${c.line}`).not.toMatch(JARGON);
  });
  it('keeps a plain knot when there are no exceptions', () => {
    const c = loveDoshaClaim({ ...MANGLIK, details: { hasExceptions: false, exceptions: [] } });
    expect(c.text).toMatch(/knot/);
  });
  it('reads the manglik row in the struggle panel by its id even when it touches no love planet or house', () => {
    // The calibration kundli already fills the six struggle slots; drop the D1 7th card so the dosha row has room.
    const rows = FIX.digest.filter((r) => r.key !== 'D1.h7');
    const b = loveStrugglePanel(inputOf([...rows, { section: 'yoga', key: 'D1.manglik', row: { ...MANGLIK, planets: [] } }]));
    const c = b.claims.find((x) => x.id === 'struggle.dosha_manglik');
    expect(c).toBeDefined();
    expect(c!.text).toMatch(/ease/);
  });
  it('words the Venus Lajjitadi states from D1 and D9 in plain words', () => {
    const ve = base.view.planet('D9', 'Ve');
    expect(lajjitadiWords(ve).states).toEqual(['kshudhita', 'kshobhita']);
    const c = heartPanel(base).claims.find((x) => x.id === 'heart.venus_mood')!;
    expect(c.text).toMatch(/hungry/);
    expect(c.text).toMatch(/Deeper down, it is hungry, wanting more than it gets; and stirred up/);
    expect(c.detail).toBe('Venus Lajjitadi avastha: D1 kshudhita; D9 kshudhita, kshobhita');
    expect(c.evidence).toEqual(['planet:D1.Ve', 'planet:D9.Ve']);
    expect(`${c.text} ${c.line}`).not.toMatch(JARGON);
  });
});

describe('BG-11 work panels', () => {
  it('compares D10 h6 and h7 by occupant count and words the lord dignity labels', () => {
    const c = serviceOrBusinessClaim(D10_ROWS[0]!.row, D10_ROWS[1]!.row)!;
    expect(c.line).toMatch(/team or an organisation/);
    expect(c.text).toMatch(/2 forces at work there, what steers it is comfortable/);
    expect(c.text).toMatch(/nothing sitting there, what steers it is uneasy/);
    expect(c.detail).toMatch(/lean by occupant count: service/);
    expect(c.evidence).toEqual(['house:D10.h6', 'house:D10.h7']);
    expect(`${c.text} ${c.line}`).not.toMatch(JARGON);
    const b = groundPanel(inputOf([...FIX.digest, ...D10_ROWS]));
    expect(b.claims.map((x) => x.id)).toContain('ground.service_or_business');
  });
  it('withholds with a gap when the D10 cards are missing', () => {
    expect(serviceOrBusinessClaim(null, D10_ROWS[1]!.row)).toBeNull();
    const b = groundPanel(base);
    expect(b.claims.some((x) => x.id === 'ground.service_or_business')).toBe(false);
    expect(b.gaps).toEqual(expect.arrayContaining(['house:D10.h6 missing', 'house:D10.h7 missing']));
  });
  it('reads the SAV of houses 10, 11 and 12 (32:30:26) as earning outweighing loss', () => {
    const c = gainPanel(base).claims.find((x) => x.id === 'gain.sav_balance')!;
    expect(c.detail).toBe('SAV H10:H11:H12 = 32:30:26');
    expect(c.line).toMatch(/outweighs what slips away/);
    expect(c.evidence).toEqual(['house:D1.h10', 'house:D1.h11', 'house:D1.h12']);
    expect(`${c.text} ${c.line}`).not.toMatch(JARGON);
  });
  it('words each SAV balance and withholds without all three numbers', () => {
    const h = (house: number, sav: number | null) => d10(house, { varga: 'D1', sav });
    expect(savBalanceClaim(h(10, 20), h(11, 22), h(12, 30))!.line).toMatch(/guard your outflow/);
    expect(savBalanceClaim(h(10, 20), h(11, 32), h(12, 25))!.line).toMatch(/gains outweigh/);
    expect(savBalanceClaim(h(10, 30), h(11, 20), h(12, 25))!.line).toMatch(/leak away/);
    expect(savBalanceClaim(h(10, 30), h(11, null), h(12, 25))).toBeNull();
  });
});
