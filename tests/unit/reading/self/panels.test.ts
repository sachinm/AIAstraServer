/**
 * The You reading techniques (docs/reading-engine/58) on the research calibration kundli's stored rows: the clock, every
 * shared slicer, every panel, chapter confirmation, gaps instead of defaults, the confirm question, and the
 * no-astrology rule over src/reading/self/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { resolveClock } from '../../../../src/reading/self/clock.js';
import { gaps, mdSpine, planetChain, pointOf, runningChain, yogasTouching } from '../../../../src/reading/self/slices.js';
import { lagnaPanel } from '../../../../src/reading/self/panels/lagna.js';
import { mindPanel } from '../../../../src/reading/self/panels/mind.js';
import { atmaPanel } from '../../../../src/reading/self/panels/atma.js';
import { yogasPanel } from '../../../../src/reading/self/panels/yogas.js';
import { strugglePanel } from '../../../../src/reading/self/panels/struggle.js';
import { chaptersPanel, confirmShift } from '../../../../src/reading/self/panels/chapters.js';
import { yearPanel } from '../../../../src/reading/self/panels/year.js';
import { PANELS, pickQuestion, shapeClaims, withheldSources } from '../../../../src/reading/self/service.js';
import { diagnosisPanel } from '../../../../src/reading/self/panels/diagnosis.js';
import type { PanelInput } from '../../../../src/reading/self/panels/common.js';
import type { SelfPanel } from '../../../../src/reading/self/types.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const ASOF = '2026-11-07';
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
const clock = resolveClock('dwisatpathi', FIX.systems);
const input: PanelInput = { view, asOf: ASOF, clock, activation: FIX.activation };
const texts = (b: { claims: Array<{ text: string }> }) => b.claims.map((c) => c.text).join(' ');

afterEach(() => {
  delete process.env.SELF_CHAPTER_BOUNDARY_MONTHS;
  delete process.env.SELF_CHAPTER_CONFIRM_MIN;
});

describe('reading clock (self.reading.clock)', () => {
  it('uses the stored preference when the system has periods', () => {
    expect(clock.system).toBe('dwisatpathi');
    expect(clock.reason).toBe('preferred');
    expect(clock.label).toBe('Dwisaptati Sama');
    expect(clock.confirming.map((c) => c.system)).toEqual(['vimsottari', 'narayana', 'chara', 'yogini', 'karaka', 'tithi_ashtottari']);
  });
  it('falls back to the conditional system the engine says applies, then Vimshottari', () => {
    expect(resolveClock(null, FIX.systems)).toMatchObject({ system: 'dwisatpathi', reason: 'applicable' });
    expect(resolveClock('nonesuch', FIX.systems).reason).toBe('applicable');
    expect(resolveClock(null, FIX.systems.filter((s) => s.family !== 'conditional'))).toMatchObject({ system: 'vimsottari', reason: 'default' });
  });
});

describe('shared slicers', () => {
  it('planetChain returns D1 and D9 cards, and a gap instead of a default', () => {
    const g = gaps();
    const ju = planetChain(view, 'Ju', g)!;
    expect(ju.d1.house).toBe(7);
    expect(ju.d9?.sign).toBe('Aquarius');
    expect(planetChain(view, 'Xx', g)).toBeNull();
    expect(g.list).toContain('planet:D1.Xx missing');
  });
  it('pointOf carries the karaka planet, not its dispositor', () => {
    const ak = pointOf(view, 'D1', 'AK', gaps())!;
    expect(ak.planet).toBe('Su');
    expect(ak.lord).toBe('Me');
  });
  it('yogasTouching keeps one row per name', () => {
    const names = yogasTouching(view, ['Ju', 'Mo', 'Su'], [1, 4, 5, 9]).map((y) => y.name);
    expect(names.filter((n) => /kala sarpa/i.test(n))).toHaveLength(1);
  });
  it('runningChain and mdSpine read the reading clock', () => {
    const r = runningChain(FIX.activation, 'dwisatpathi', ASOF);
    expect(r.l1).toMatchObject({ lord: 'Ra', from: '2019-02-16', to: '2028-02-16' });
    expect(r.l2).toMatchObject({ lord: 'Ve', from: '2025-11-16', to: '2027-01-01' });
    const s = mdSpine(FIX.activation, 'dwisatpathi', ASOF);
    expect([s.previous?.lord, s.running?.lord, s.next?.lord]).toEqual(['Sa', 'Ra', 'Su']);
    expect(s.nextSub).toMatchObject({ lord: 'Sa', from: '2027-01-01' });
  });
});

describe('panels', () => {
  it('lagna: the lagna lord in the 7th, its company, AL in the 10th', () => {
    const b = lagnaPanel(input);
    expect(b.gaps).toEqual([]);
    expect(b.lead).toBe('Your sense of self is lived through partnership.');
    expect(texts(b)).toContain('partners, clients and the people you deal with');
    expect(texts(b)).toContain('Others see you through your work, your standing');
    expect(texts(b)).toContain('Read from your feelings rather than your body, your life is steered from gains, friends, networks and elder siblings');
    expect(texts(b)).toContain('Your inner self is steered from your family, your speech and what you hold');
    expect(texts(b)).toContain('helped by');
    expect(b.claims.map((c) => c.detail).join()).not.toMatch(/paka/i);
    expect(b.claims.every((c) => c.evidence.length > 0 && c.certainty === 'fact')).toBe(true);
  });
  it('mind: a fragile Moon lifted by a cancellation, the 4th lord in the 8th', () => {
    const t = texts(mindPanel(input));
    expect(t).toContain('at their most fragile, and a cancellation in your chart lifts this over time');
    expect(t).toContain('Your peace of mind depends on sudden change');
    expect(t).toContain('Your courage and effort work through');
    expect(t).not.toContain('Your judgement');
  });
  it('atma: the Sun as soul planet, karakamsa in the D9 2nd with Mars and Venus', () => {
    const b = atmaPanel(input);
    expect(b.lead).toBe("Your soul's lesson runs through your sense of purpose and authority.");
    expect(texts(b)).toContain('alongside your drive and courage and your pleasures, art and closeness');
    expect(texts(b)).toContain('Your judgement and faith work through partners');
    expect(b.claims.map((c) => c.id)).toEqual(expect.arrayContaining(['atma.purpose', 'atma.letting_go']));
  });
  it('atma: withheld with a gap when the AK planet is not stored', () => {
    const rows = FIX.digest.map((r) => (r.section === 'point' && /\.AK$/.test(r.key) ? { ...r, row: { ...(r.row as object), planet: undefined } } : r));
    const b = atmaPanel({ ...input, view: digestView('k1', rows as never, { status: 'ready', version: 'd' }) });
    expect(b.claims.some((c) => c.id === 'atma.ak')).toBe(false);
    expect(b.gaps.join()).toMatch(/AK\.planet missing/);
  });
  it('yogas: gifts first, knots after', () => {
    const b = yogasPanel(input);
    expect(b.claims[0]!.text.startsWith('A gift')).toBe(true);
    expect(b.claims.at(-1)!.text.startsWith('A knot')).toBe(true);
  });
  it('struggle: at most six claims, each with evidence', () => {
    const b = strugglePanel(input);
    expect(b.claims.length).toBeGreaterThan(0);
    expect(b.claims.length).toBeLessThanOrEqual(6);
    expect(texts(b)).toContain('What carries your judgement, wisdom and faith spends itself mostly on the people around you');
  });
  it('chapters: Saturn, Rahu, Sun on the Dwisaptati clock with the Venus sub-chapter', () => {
    const b = chaptersPanel(input);
    const ch = b.chapters!;
    expect(ch.map((c) => [c.kind, c.lord, c.from, c.to])).toEqual([
      ['previous', 'Sa', '2010-02-15', '2019-02-16'],
      ['running', 'Ra', '2019-02-16', '2028-02-16'],
      ['next', 'Su', '2028-02-16', '2037-02-15'],
    ]);
    expect(ch[1]!.certainty).toBe('confirmed');
    expect(ch[1]!.confirmations.filter((c) => c.agrees).map((c) => c.system)).toEqual(['vimsottari', 'chara', 'yogini']);
    expect(ch[1]!.sub).toMatchObject({ lord: 'Ve', from: '2025-11-16', to: '2027-01-01' });
    expect(ch[1]!.sub!.text).toContain('though what comes in also goes out');
    expect(ch[2]!.confirmations.filter((c) => c.agrees).map((c) => c.system)).toEqual(['vimsottari', 'narayana']);
    expect(ch[0]!.certainty).toBe('likely');
  });
  it('chapters: a split chapter keeps its dates and drops its sentence', () => {
    process.env.SELF_CHAPTER_BOUNDARY_MONTHS = '6';
    process.env.SELF_CHAPTER_CONFIRM_MIN = '5';
    const c = confirmShift(FIX.activation, '2010-02-15', clock.confirming);
    expect(c.every((x) => !x.agrees)).toBe(true);
    const prev = chaptersPanel(input).chapters!.find((x) => x.kind === 'previous')!;
    expect(prev.certainty).toBe('split');
    expect(prev.text).toBeNull();
    expect(prev.from).toBe('2010-02-15');
  });
  it('year: the natal lagna lord at its strongest in this year\'s 1st', () => {
    const t = texts(yearPanel(input));
    expect(t).toContain("This year's chart puts the part of you that steers in your body, your presence and your sense of self, at its strongest.");
    expect(t).toContain('Until 24 Dec 2026');
  });
  it('year: withheld when no year chart covers the day', () => {
    const b = yearPanel({ ...input, asOf: '2040-01-01' });
    expect(b.claims).toEqual([]);
    expect(b.gaps.join()).toMatch(/annual:VP covering 2040-01-01 missing/);
  });
  it('no panel text carries chart words (doc 45 §3.3); chart terms live in detail', () => {
    const banned = /\b(house|lord|dasha|mahadasha|antardasha|nakshatra|varga|rahu|ketu|saturn|jupiter|venus|mercury|mars|sun|moon|lagna|D1\.|D9\.)\b/i;
    for (const b of [...Object.values(PANELS).map((p) => p.run(input)), diagnosisPanel({ lagna: lagnaPanel(input), struggle: strugglePanel(input), yogas: yogasPanel(input), chapters: chaptersPanel(input) })]) {
      for (const c of b.claims) expect(c.text, c.id).not.toMatch(banned);
      for (const ch of b.chapters ?? []) if (ch.text) expect(ch.text).not.toMatch(banned);
      expect(b.lead).not.toMatch(banned);
    }
  });
});

describe('diagnosis, confirm question and answers', () => {
  const bodies = { lagna: lagnaPanel(input), struggle: strugglePanel(input), yogas: yogasPanel(input), chapters: chaptersPanel(input) };
  const diag = diagnosisPanel(bodies);
  const asPanel = (id: SelfPanel['id'], b: ReturnType<typeof lagnaPanel>): SelfPanel => ({ id, technique: `self.reading.${id}`, title: id, lead: b.lead, status: 'ok', claims: b.claims, ...(b.chapters ? { chapters: b.chapters } : {}), cached: false, ms: 0 });
  const panels: SelfPanel[] = [asPanel('diagnosis', diag), asPanel('chapters', bodies.chapters), asPanel('struggle', bodies.struggle)];
  it('diagnosis: three sentences built from other claims, adding no fact', () => {
    expect(diag.claims.map((c) => c.id)).toEqual(['diagnosis.direction', 'diagnosis.tension', 'diagnosis.now']);
    expect(diag.claims[0]!.text.startsWith('Your sense of self is lived through partnership.')).toBe(true);
    expect(diag.claims[2]!.text).toContain('that runs to 16 Feb 2028; since 16 Nov 2025');
    for (const c of diag.claims) expect(c.evidence.every((e) => e.startsWith('claim:'))).toBe(true);
  });
  it('asks about the central tension first', () => {
    const q = pickQuestion(panels, {})!;
    expect(q.claimId).toBe('diagnosis.tension');
    expect(q.text.startsWith('Does this ring true for you right now? ')).toBe(true);
  });
  it('then the running sub-chapter by its houses, then the chapter, then nothing', () => {
    expect(pickQuestion(panels, { 'diagnosis.tension': 'yes' })!).toMatchObject({ claimId: 'chapters.sub', text: 'Have you moved recently, or been thinking about moving?' });
    expect(pickQuestion(panels, { 'diagnosis.tension': 'yes', 'chapters.sub': 'yes' })!.claimId).toBe('chapters.running');
    expect(pickQuestion(panels, { 'diagnosis.tension': 'yes', 'chapters.sub': 'yes', 'chapters.running': 'no' })).toBeNull();
  });
  it('a no to the tension withholds the claim it was built from too', () => {
    const src = diag.claims[1]!.evidence[0]!.slice(6);
    expect(withheldSources(panels, { 'diagnosis.tension': 'no' }).has(src)).toBe(true);
  });
  it('a "no" withholds the claim and keeps its detail', () => {
    const out = shapeClaims([{ id: 'chapters.sub', text: 't', detail: 'd', certainty: 'confirmed', evidence: ['e'] }], { 'chapters.sub': 'no' });
    expect(out[0]).toMatchObject({ withheld: 'You told us this did not fit.', detail: 'd' });
  });
});

describe('no astrology in src/reading/self (doc 46 §C.3)', () => {
  const DIR = path.resolve(__dirname, '../../../../src/reading/self');
  const all = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []));
  const FORBIDDEN = [/\/\s*30(?![\d.])/, /%\s*12(?!\d)/, /13\.33|40\s*\/\s*3\b|360\s*\/\s*27/, /\+\s*12\)\s*%/, /\b(SIGN_LORDS|EXALTATION|DEBILITATION|MOOLATRIKONA|OWN_SIGNS)\b/, /\b(GRAHA_DRISHTI|SPECIAL_ASPECTS|ASPECT_TABLE)\b\s*[:=]/];
  it('derives no sign, house, aspect or dignity', () => {
    const hits: string[] = [];
    for (const f of all(DIR)) {
      const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      src.split('\n').forEach((line, i) => { if (FORBIDDEN.some((re) => re.test(line))) hits.push(`${path.basename(f)}:${i + 1}`); });
    }
    expect(hits).toEqual([]);
  });
});
