import { describe, expect, it } from 'vitest';
import { checkAnswer, checkWindows } from '../../../src/reading/grounding/checker.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const d = loadG1Dossier();
const t = loadG1Transits();
const run = (text: string) => checkAnswer(text, d, t, G1_AS_OF);
const verdicts = (text: string) => run(text).items.map((i) => `${i.kind}:${i.verdict}`);

describe('grounding checker: true statements about G1 verify', () => {
  it('planet in house and sign', () => {
    const r = run('Your 10th lord Mercury sits in the 9th house in Taurus. Jupiter is in the 10th house.');
    expect(r.contradicted).toBe(0);
    expect(r.verified).toBeGreaterThanOrEqual(3);
  });
  it('lists of planets', () => {
    const r = run('Mars, Mercury, Venus, Saturn and Rahu are all in the 9th house.');
    expect(r.items.filter((i) => i.kind === 'planet_house' && i.verdict === 'verified')).toHaveLength(5);
    expect(r.contradicted).toBe(0);
  });
  it('house lords in several phrasings', () => {
    const r = run('The 10th lord is Mercury. Venus is the 2nd lord. Mercury, lord of the 1st and 10th houses, is strong. The lord of the 4th is Jupiter.');
    expect(r.contradicted).toBe(0);
    expect(r.items.filter((i) => i.kind === 'house_lord' && i.verdict === 'verified').length).toBeGreaterThanOrEqual(5);
  });
  it('running dasha and mahadasha end', () => {
    const r = run('You are currently running the Saturn-Ketu-Venus period. Your Saturn Mahadasha runs until November 2039.');
    expect(r.contradicted).toBe(0);
    expect(verdicts('You are currently running the Saturn-Ketu-Venus period.')).toContain('dasha_running:verified');
    expect(verdicts('Saturn Mahadasha runs until 2039.')).toContain('mahadasha_end:verified');
  });
  it('transit sign with an end date', () => {
    const r = run('Currently Saturn is transiting Pisces until June 2027, and Ketu is transiting Leo until December 2026.');
    expect(r.contradicted).toBe(0);
    expect(r.items.filter((i) => i.kind === 'transit_until' && i.verdict === 'verified')).toHaveLength(2);
  });
  it('divisional chart statements use the varga', () => {
    const r = run('In the D-10, Mercury sits in the 3rd house. The D-10 lagna is Scorpio.');
    expect(r.contradicted).toBe(0);
    expect(r.items.some((i) => i.kind === 'varga_planet_house' && i.verdict === 'verified')).toBe(true);
    expect(r.items.some((i) => i.kind === 'varga_lagna' && i.verdict === 'verified')).toBe(true);
  });
  it('table rows are checked too', () => {
    const r = run('| Window | Dasha | Trigger |\n|---|---|---|\n| Nov 2026 - Mar 2027 | Saturn-Ketu-Venus period running | Jupiter in Leo (transit) |');
    expect(r.contradicted).toBe(0);
  });
});

describe('grounding checker: false statements are caught', () => {
  it('wrong house', () => {
    const r = run('Mercury sits in the 5th house.');
    expect(r.contradicted).toBe(1);
    expect(r.items[0]!.expected).toBe('house 9');
  });
  it('wrong sign', () => {
    expect(run('Jupiter is in Aries.').contradicted).toBe(1);
  });
  it('wrong lord', () => {
    expect(run('The 10th lord is Saturn.').contradicted).toBe(1);
  });
  it('wrong running dasha', () => {
    expect(run('You are currently running the Jupiter-Saturn-Venus period.').contradicted).toBe(1);
  });
  it('wrong mahadasha end', () => {
    expect(run('Saturn Mahadasha runs until 2031.').contradicted).toBe(1);
  });
  it('wrong transit sign and wrong end date', () => {
    expect(run('Saturn is currently transiting Aries.').contradicted).toBe(1);
    expect(run('Currently Saturn is transiting Pisces until March 2028.').contradicted).toBe(1);
  });
  it('wrong varga lagna', () => {
    expect(run('The D-10 lagna is Leo.').contradicted).toBe(1);
  });
});

describe('grounding checker: stays quiet when unsure', () => {
  it('skips aspect and conjunction phrasing', () => {
    const r = run('Jupiter aspects the 7th house. Saturn is conjunct Mars in Taurus.');
    expect(r.contradicted).toBe(0);
  });
  it('skips sentences that mix natal and transit talk', () => {
    const r = run('Transiting Ketu will pass your natal Jupiter in the 5th house.');
    expect(r.contradicted).toBe(0);
  });
  it('reports a varga the dossier does not carry as unverifiable', () => {
    const r = run('In the D-24, Mercury sits in the 4th house.');
    expect(r.contradicted).toBe(0);
  });
  it('ignores prose with no chart claims', () => {
    expect(run('Be patient and keep working steadily.').checked).toBe(0);
  });
});

describe('grounding checker: undated planet-in-sign with no natal or transit cue', () => {
  it('does not call a sign contradicted when it matches a transit position in range', () => {
    expect(run('Early November: Jupiter stays in Leo, so look for steady news.').contradicted).toBe(0);
  });
  it('still catches a sign that matches neither the birth chart nor any transit', () => {
    expect(run('Jupiter is in Capricorn.').contradicted).toBe(1);
  });
  it('still catches a wrong natal sign when the sentence says natal', () => {
    expect(run('Your natal Jupiter is in Leo.').contradicted).toBe(1);
  });
});

describe('grounding checker: timeline tables', () => {
  const table = (rows: string) => `| Window | Dasha (MD-AD-PD) | Transit trigger | Indication | Watch for |\n|---|---|---|---|---|\n${rows}`;
  it('reads the transit column as a transit statement for the row period (true rows verify)', () => {
    const r = run(table('| Nov 2026 - Jan 2027 | Saturn-Ketu-Mercury | Jupiter in Leo | moderate | offers |\n| Jun 2027 - Aug 2027 | Saturn-Venus-Sun | Saturn in Aries | weak | delays |'));
    expect(r.contradicted).toBe(0);
    expect(r.verified).toBeGreaterThanOrEqual(2);
  });
  it('catches a false transit claim in the column', () => {
    const r = run(table('| Nov 2026 - Jan 2027 | Saturn-Ketu-Mercury | Jupiter in Aries | moderate | offers |'));
    expect(r.contradicted).toBe(1);
  });
});

describe('window sanity', () => {
  const hz = { from: '2026-10-24', to: '2027-10-24' };
  it('counts windows inside the horizon', () => {
    const w = checkWindows('| Nov 2026 – Mar 2027 | x |\n| Jun 2027 - Sep 2027 | y |', hz);
    expect(w).toMatchObject({ found: 2, insideHorizon: 2, outside: [] });
  });
  it('flags windows outside the horizon', () => {
    const w = checkWindows('Between Jan 2019 – Jun 2019 and Nov 2026 – Mar 2027', hz);
    expect(w.found).toBe(2);
    expect(w.outside).toHaveLength(1);
  });
});
