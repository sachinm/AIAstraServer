/**
 * BUILD-GAPS BG-14: the Oracle's PANEL_PLAN and PANEL_CALENDAR blocks become a per-panel plan (summary, dated steps,
 * calendar), their bullets are never read as card lines, a line is not dropped for its wording, and the stored engine
 * windows a date may fall in are collected from the activation rows, the year charts and the transit range.
 */
import { describe, expect, it } from 'vitest';
import { parseOracleStructuredBlocks, splitPlanBlocks } from '../../../../src/reading/self/oracle.js';
import { inStoredWindow } from '../../../../src/reading/self/audit.js';
import { storedWindows } from '../../../../src/reading/self/service.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';

const KEYS = new Set(['planet:D1.Ju', 'house:D1.h10']);
const TEXT = [
  'Narrative paragraph {planet:D1.Ju}',
  '',
  'PANEL_SYNTHESIS:',
  '- [lagna] (always) This will be with you forever, and it is guaranteed {planet:D1.Ju}',
  'PANEL_PLAN:',
  '- [lagna] summary: You steer through partnership now; lean on one trusted ally. {planet:D1.Ju}',
  '- [lagna] step (2026-11-08..2027-02-01) Set the terms of the partnership in writing {planet:D1.Ju, house:D1.h10}',
  '- [lagna] step (always) Keep a weekly review',
  '- [nope] step (always) ignored',
  'PANEL_CALENDAR:',
  '- [lagna] (2027-01-15) Sign or renew {house:D1.h10}',
  '- [lagna] (2027-03-01..2027-03-31) A month to launch {planet:D1.Ju}',
  '- [lagna] (soon) undated is skipped',
  'VALID_UNTIL:',
  'overall: 2027-02-01',
].join('\n');

describe('BG-14 plan blocks', () => {
  it('cuts the plan and calendar blocks out of the text', () => {
    const b = splitPlanBlocks(TEXT);
    expect(b.rest).toContain('PANEL_SYNTHESIS:');
    expect(b.rest).toContain('VALID_UNTIL:');
    expect(b.rest).not.toContain('PANEL_PLAN');
    expect(b.plan).toContain('summary:');
    expect(b.calendar).toContain('Sign or renew');
  });

  it('parses the plan per panel and keeps calendar bullets out of the card lines', () => {
    const s = parseOracleStructuredBlocks(TEXT, KEYS);
    expect(s.panelLines.lagna).toHaveLength(1);
    expect(s.validUntil.overall).toBe('2027-02-01');
    const p = s.panelPlans.lagna!;
    expect(p.summary).toBe('You steer through partnership now; lean on one trusted ally.');
    expect(p.steps).toEqual([
      { text: 'Set the terms of the partnership in writing', range: { from: '2026-11-08', to: '2027-02-01' }, claimIds: ['planet:D1.Ju', 'house:D1.h10'] },
      { text: 'Keep a weekly review', range: 'always', claimIds: [] },
    ]);
    expect(p.calendar).toEqual([
      { from: '2027-01-15', to: '2027-01-15', label: 'Sign or renew', claimIds: ['house:D1.h10'] },
      { from: '2027-03-01', to: '2027-03-31', label: 'A month to launch', claimIds: ['planet:D1.Ju'] },
    ]);
    expect(Object.keys(s.panelPlans)).toEqual(['lagna']);
  });

  it('no longer drops a card line for its wording (tone lives in the prompt)', () => {
    const s = parseOracleStructuredBlocks(TEXT, KEYS);
    expect(s.panelLines.lagna?.[0]?.text).toBe('This will be with you forever, and it is guaranteed');
  });

  it('redacts an engine name in a plan instead of dropping it', () => {
    const s = parseOracleStructuredBlocks('PANEL_PLAN:\n- [mind] summary: Read by pyjhora today.', KEYS);
    expect(s.panelPlans.mind?.summary).toBe('Read by traditional calculations today.');
  });
});

describe('BG-14 stored windows', () => {
  const act = [{ system: 'v', level: 3, lord: 'Ju', from: '2027-01-01', to: '2027-02-10' }] as unknown as ActivationRow[];
  const view = { annual: () => [{ dashas: [{ system: 'mudda', periods: [{ lord: 'Sa', from: '2027-03-01', to: '2027-04-01' }] }] }] } as never;
  const sky = { from: '2026-11-01', to: '2027-10-31', sade_sati: [{ phase: 'peak', saturn_sign: 'Pisces', from: '2025-03-29', to: '2027-06-02' }], dhaiya: [] } as never;
  it('collects activation, year-chart and transit windows', () => {
    const w = storedWindows(act, view, sky);
    expect(w).toEqual(expect.arrayContaining([
      { from: '2027-01-01', to: '2027-02-10' },
      { from: '2027-03-01', to: '2027-04-01' },
      { from: '2026-11-01', to: '2027-10-31' },
      { from: '2025-03-29', to: '2027-06-02' },
    ]));
    expect(storedWindows(act, view, null)).toHaveLength(2);
  });
  it('a date or month inside a window, or on a boundary, is grounded', () => {
    const w = [{ from: '2027-01-01', to: '2027-02-10' }];
    expect(inStoredWindow('2027-01-20', new Set(), w)).toBe(true);
    expect(inStoredWindow('2027-05-01', new Set(['2027-05-01']), w)).toBe(true);
    expect(inStoredWindow('2027-02', new Set(), w)).toBe(true);
    expect(inStoredWindow('2027-03-01', new Set(), w)).toBe(false);
    expect(inStoredWindow('2028-01', new Set(['2027-05-01']), w)).toBe(false);
  });
});
