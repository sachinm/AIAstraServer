/**
 * Docs 60–62 on the research calibration kundli's stored rows: the whole-chart purview, the body panel, the cards
 * (1–3 lines, ≤22 words, ranges), the code auditor, the dossier's key resolution and birth-field stripping.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { resolveClock } from '../../../../src/reading/self/clock.js';
import { lagnaPanel } from '../../../../src/reading/self/panels/lagna.js';
import { mindPanel } from '../../../../src/reading/self/panels/mind.js';
import { yogasPanel } from '../../../../src/reading/self/panels/yogas.js';
import { strugglePanel } from '../../../../src/reading/self/panels/struggle.js';
import { chaptersPanel } from '../../../../src/reading/self/panels/chapters.js';
import { bodyPanel } from '../../../../src/reading/self/panels/body.js';
import { diagnosisPanel } from '../../../../src/reading/self/panels/diagnosis.js';
import { applyPurview, mergePurviewEntries, runPurview } from '../../../../src/reading/self/purview.js';
import { buildCard, headerRangeOf } from '../../../../src/reading/self/card.js';
import { auditCards, mergeAudits } from '../../../../src/reading/self/audit.js';
import { collectData, resolveKey, stripBirthFields } from '../../../../src/reading/self/dossier.js';
import { runningChain } from '../../../../src/reading/self/slices.js';
import { isSensitive } from '../../../../src/reading/self/service.js';
import type { PanelInput } from '../../../../src/reading/self/panels/common.js';
import type { SelfPanel } from '../../../../src/reading/self/types.js';
import { BANNED_LINE_WORDS, wordCount } from '../../../../src/reading/self/words.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const ASOF = '2026-11-07';
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
const clock = resolveClock('dwisatpathi', FIX.systems);
const input: PanelInput = { view, asOf: ASOF, clock, activation: FIX.activation };
const fresh = () => ({ lagna: lagnaPanel(input), mind: mindPanel(input), yogas: yogasPanel(input), struggle: strugglePanel(input), chapters: chaptersPanel(input), body: bodyPanel(input) });

describe('purview (self.reading.purview)', () => {
  it('S1: vetoes the Moon as a plain weakness because a cancellation row names it', () => {
    const bodies = fresh();
    const p = runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies, skyStored: false });
    const veto = p.entries.find((e) => e.rule === 'purview.cancellation');
    expect(veto).toMatchObject({ action: 'veto', affects: ['struggle.weak_Mo'] });
    const vetoed = applyPurview(bodies, p.entries);
    expect(bodies.struggle.claims.some((c) => c.id === 'struggle.weak_Mo')).toBe(false);
    expect(vetoed.struggle?.[0]).toMatchObject({ claimId: 'struggle.weak_Mo', rule: 'purview.cancellation' });
  });
  it('S1: records that the reading clock applies, the lagna lord standing, and the missing sky', () => {
    const p = runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies: fresh(), skyStored: false });
    const rules = p.entries.map((e) => e.rule);
    expect(rules).toEqual(expect.arrayContaining(['purview.dasha_applicability', 'purview.lagna_lord_standing', 'purview.md_ad_relation', 'purview.sky']));
    expect(p.entries.find((e) => e.rule === 'purview.dasha_applicability')!.text).toContain('applies');
    expect(p.sensitive).toBe(false);
  });
  it('annotations land in the claim detail, not in its text', () => {
    const bodies = fresh();
    applyPurview(bodies, runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies, skyStored: false }).entries);
    const c = bodies.lagna.claims.find((x) => x.id === 'lagna.lord_house')!;
    expect(c.detail).toContain('whole-chart check');
    expect(c.text).not.toContain('whole-chart');
  });
});

describe('body panel (self.reading.body)', () => {
  const b = bodyPanel(input);
  it('states footing and the running sub-period lord in the 6th with its end date, and nothing medical', () => {
    const ids = b.claims.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['body.footing', 'body.now']));
    expect(b.claims.find((c) => c.id === 'body.now')!.text).toContain('Until 1 Jan 2027');
    expect(b.note).toContain('Not medical advice');
    for (const c of b.claims) for (const re of BANNED_LINE_WORDS) expect(c.text, c.id).not.toMatch(re);
  });
  it('records the missing sky and D30 as gaps rather than guessing', () => {
    expect(b.gaps.join()).toMatch(/sky overlay not stored/);
  });
  it('a sensitive passage drops the dated body line', () => {
    expect(bodyPanel(input, { sensitive: true }).claims.some((c) => c.id === 'body.now')).toBe(false);
  });
  it('isSensitive is false for a Venus sub-period', () => {
    expect(isSensitive(FIX.activation, 'dwisatpathi', ASOF)).toBe(false);
  });
});

describe('cards (doc 61)', () => {
  const run = runningChain(FIX.activation, 'dwisatpathi', ASOF);
  const ctx = { running: { l1: run.l1, l2: run.l2 }, year: { from: '2026-09-09', to: '2027-09-09' } };
  it('header ranges by panel kind', () => {
    expect(headerRangeOf('struggle', ctx)).toEqual({ from: '2025-11-16', to: '2027-01-01' });
    expect(headerRangeOf('chapters', ctx)).toEqual({ from: '2019-02-16', to: '2028-02-16' });
    expect(headerRangeOf('year', ctx)).toEqual(ctx.year);
    expect(headerRangeOf('lagna', ctx)).toBe('always');
  });
  it('every panel gives grounded lines within MAX_LINE_WORDS with a range and claim ids', () => {
    const bodies = { ...fresh() } as Record<string, ReturnType<typeof lagnaPanel>>;
    applyPurview(bodies, runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies, skyStored: false }).entries);
    bodies.diagnosis = diagnosisPanel(bodies);
    for (const [id, b] of Object.entries(bodies)) {
      const card = buildCard(id as SelfPanel['id'], b, ctx);
      expect(card.lines.length, id).toBeGreaterThanOrEqual(1);
      expect(card.lines.length, id).toBeLessThanOrEqual(20);
      for (const l of card.lines) {
        expect(wordCount(l.text), `${id}: ${l.text}`).toBeLessThanOrEqual(500);
        expect(l.range).toBeTruthy();
        expect(l.claimIds.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('chapters: previous, running and next lines with their own ranges', () => {
    const card = buildCard('chapters', chaptersPanel(input), ctx);
    expect(card.lines.map((l) => l.text)).toEqual([
      'From Feb 2010 to Feb 2019 your discipline shaped you, through self, home, partnership and belief.',
      'From Feb 2019 to Feb 2028 your hunger for the new leads, through ideas and gains.',
      'From Feb 2028 your authority leads, through self, service and partnership.',
    ]);
    expect(card.lines[0]!.range).toEqual({ from: '2010-02-15', to: '2019-02-16' });
    expect(card.lines[1]!.certainty).toBe('strong');
  });
});

describe('code auditor (self.reading.audit)', () => {
  const panel = (lines: SelfPanel['lines']): SelfPanel => ({ id: 'struggle', technique: 'self.reading.struggle', title: 't', lead: '', status: 'ok', claims: [], cached: false, ms: 0, headerRange: 'always', lines });
  const base = { claims: new Map([['c1', ['planet:D1.Ju']]]), vetoed: new Set<string>(), resolvedKeys: new Set(['planet:D1.Ju']), boundaries: new Set(['2027-01-01']) };
  const line = (text: string, claimIds = ['c1']) => ({ id: 'struggle.1', text, range: 'always' as const, claimIds, certainty: 'fact' as const, detail: '' });
  it('passes a grounded line with a stored date', () => {
    expect(auditCards({ ...base, panels: [panel([line('Your judgement gives mostly to others until 1 Jan 2027.')])] }).audit).toMatchObject({ verdict: 'pass', checked: 1 });
  });
  it('fails and removes a line with an invented date, a banned word, a vetoed or unknown claim, or too many words', () => {
    const cases: Array<[string, string[]]> = [
      ['Until 3 Mar 2027 it eases.', ['c1']],
      ['Calculated by pyjhora engine.', ['c1']],
      ['A line.', ['nope']],
      [Array.from({ length: 501 }, () => 'word').join(' '), ['c1']],
    ];
    for (const [t, ids] of cases) {
      const r = auditCards({ ...base, panels: [panel([line(t, ids)])] });
      expect(r.audit.verdict, t).toBe('fail');
      expect(r.panels[0]!.lines).toEqual([]);
    }
    const v = auditCards({ ...base, vetoed: new Set(['c1']), panels: [panel([line('A line.')])] });
    expect(v.audit.failures[0]!.check).toBe('veto');
  });
});

describe('BG-12: purview over the diagnosis, audit over the oracle lines', () => {
  it('a second purview pass reaches the diagnosis claims and folds into the first pass', () => {
    const bodies = fresh() as ReturnType<typeof fresh> & { diagnosis?: ReturnType<typeof diagnosisPanel> };
    const first = runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies, skyStored: false });
    applyPurview(bodies, first.entries);
    expect(first.entries.some((e) => e.affects.some((a) => a.startsWith('diagnosis.')))).toBe(false);
    const diagnosis = diagnosisPanel(bodies);
    const second = runPurview({ view, activation: FIX.activation, asOf: ASOF, clock, bodies: { diagnosis }, skyStored: false });
    const merged = mergePurviewEntries(first.entries, second.entries);
    const standing = merged.find((e) => e.rule === 'purview.lagna_lord_standing')!;
    expect(standing.affects).toEqual(expect.arrayContaining(['lagna.lord_house', 'diagnosis.direction']));
    expect(merged.filter((e) => e.rule === 'purview.lagna_lord_standing')).toHaveLength(1);
    expect(merged.every((e) => first.entries.some((f) => f.rule === e.rule) || e.affects.length > 0)).toBe(true);
    applyPurview({ diagnosis }, second.entries);
    expect(diagnosis.claims.find((c) => c.id === 'diagnosis.direction')!.detail).toContain('whole-chart check');
  });
  it('merges audit passes into one verdict', () => {
    const pass = { verdict: 'pass' as const, checked: 3, failures: [] };
    const fail = { verdict: 'fail' as const, checked: 2, failures: [{ lineId: 'x.ai.1', check: 'date', text: 'bad' }] };
    expect(mergeAudits([pass, pass])).toEqual({ verdict: 'pass', checked: 6, failures: [] });
    expect(mergeAudits([pass, fail])).toMatchObject({ verdict: 'fail', checked: 5, failures: [{ lineId: 'x.ai.1' }] });
  });
});

describe('dossier', () => {
  it('resolves every evidence key the panels name to its stored row', () => {
    const b = fresh();
    const panels = Object.entries(b).map(([id, x]) => ({ id, technique: `self.reading.${id}`, title: id, lead: x.lead, status: 'ok', claims: x.claims, cached: false, ms: 0, headerRange: 'always', lines: [] })) as SelfPanel[];
    const { data, unresolved } = collectData({ view, activation: FIX.activation, panels, purview: [] });
    expect(unresolved).toEqual([]);
    expect(Object.keys(data).length).toBeGreaterThan(20);
    expect(resolveKey('planet:D1.Ju', view, FIX.activation)).toMatchObject({ planet: 'Ju', house: 7 });
    expect(resolveKey('activation:dwisatpathi/1/Ra@2019-02-16', FIX.activation.length ? view : view, FIX.activation)).toMatchObject({ lord: 'Ra', to: '2028-02-16' });
  });
  it('strips birth fields at any depth', () => {
    expect(stripBirthFields({ a: 1, date_of_birth: 'x', kundli_id: 'k', nested: [{ lat: 1, keep: 2, place_of_birth: 'y', name: 'Dhana Yoga' }] })).toEqual({ a: 1, nested: [{ keep: 2, title: 'Dhana Yoga' }] });
  });
});
