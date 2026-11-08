/**
 * BUILD-GAPS BG-06, BG-07, BG-09 on the research calibration kundli's stored rows: the lagna-to-AL relation (lagna
 * panel), the Moon's own yogas and the A4/A5 padas (mind panel), and yogas ranked by their planets'
 * stored delivery multipliers and the running periods (yogas panel). Every value read is an engine row.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { resolveClock } from '../../../../src/reading/self/clock.js';
import { alSelfFit, lagnaPanel } from '../../../../src/reading/self/panels/lagna.js';
import { mindPanel, moonYogaClaim } from '../../../../src/reading/self/panels/mind.js';
import { yogasPanel, yogaWeight } from '../../../../src/reading/self/panels/yogas.js';
import type { PanelInput } from '../../../../src/reading/self/panels/common.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });
const clock = resolveClock('dwisatpathi', FIX.systems);
const input: PanelInput = { view, asOf: '2026-11-07', clock, activation: FIX.activation };

describe('BG-06 lagna panel', () => {
  const b = lagnaPanel(input);
  it('keeps the Moon lagna and leaves the Paka lagna out (doc 59 §4.1)', () => {
    expect(b.claims.some((c) => c.id === 'lagna.moon_lagna')).toBe(true);
    expect(b.claims.map((c) => c.detail).join()).not.toMatch(/paka/i);
  });
  it('reads the lagna-to-AL relation from the engine label of the AL house (AL in h10, a kendra)', () => {
    const c = b.claims.find((x) => x.id === 'lagna.seen_fit')!;
    expect(c.text).toMatch(/lines up/);
    expect(c.evidence).toEqual(['point:D1.AL', 'house:D1.h10']);
  });
  it('words each label group', () => {
    expect(alSelfFit(['upachaya', 'dusthana'])).toMatch(/pull apart/);
    expect(alSelfFit(['trikona'])).toMatch(/lines up/);
    expect(alSelfFit(['maraka', 'panapara'])).toMatch(/a step away/);
    expect(alSelfFit([])).toBeNull();
  });
});

describe('BG-07 mind panel', () => {
  const b = mindPanel(input);
  it('reads the Moon yogas the engine marks present; Durudhara wins over Sunapha and Anapha', () => {
    const c = b.claims.find((x) => x.id === 'mind.moon_support')!;
    expect(c.text).toMatch(/both sides/);
    expect(c.evidence).toEqual(['yoga:D1.sunaphaa_yoga', 'yoga:D1.anaphaa_yoga', 'yoga:D1.duradhara_yoga']);
  });
  it('words Kemadruma and returns null with no Moon yoga', () => {
    expect(moonYogaClaim(['kemadruma_yoga'])!.text).toMatch(/routine/);
    expect(moonYogaClaim(['vesi_yoga'])).toBeNull();
  });
  it('adds the A4 and A5 padas', () => {
    expect(b.claims.map((c) => c.id)).toEqual(expect.arrayContaining(['mind.home_seen', 'mind.ideas_seen']));
  });
});

describe('BG-09 yogas panel', () => {
  it('weights by the mean stored multiplier, raised when a planet runs a period', () => {
    expect(yogaWeight([0.5, 1, null], false)).toBe(0.75);
    expect(yogaWeight([0.5, 1], true)).toBeCloseTo(1.125);
    expect(yogaWeight([null, undefined], true)).toBeNull();
  });
  it('ranks gifts first, then by weight within each kind, and states the weight in the detail', () => {
    const b = yogasPanel(input);
    expect(b.claims.length).toBeGreaterThan(0);
    const rows = b.claims.map((c) => ({ gift: c.text.startsWith('A gift'), w: Number(/weight ([\d.]+)/.exec(c.detail)?.[1] ?? -1) }));
    const firstKnot = rows.findIndex((r) => !r.gift);
    if (firstKnot >= 0) expect(rows.slice(firstKnot).every((r) => !r.gift)).toBe(true);
    for (const group of [rows.filter((r) => r.gift), rows.filter((r) => !r.gift)]) {
      for (let i = 1; i < group.length; i++) expect(group[i - 1]!.w).toBeGreaterThanOrEqual(group[i]!.w);
    }
    for (const c of b.claims) expect(c.detail).toMatch(/weight /);
  });
});
