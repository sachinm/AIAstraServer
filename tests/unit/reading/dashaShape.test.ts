import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  dashaForPrompt,
  detectDashaShape,
  legacyDateToIso,
  normalizeDasha,
  toLegacyDasha,
  type DashaNode,
  type NormalizedDasha,
} from '../../../src/reading/chartData/dashaShape.js';

const fixture = (name: string): unknown => JSON.parse(readFileSync(path.resolve('tests/fixtures/dasha', name), 'utf8'));

const vimV2 = fixture('vimsottari.v2.json') as NormalizedDasha;
const narV2 = fixture('narayana.v2.json') as NormalizedDasha;
const vimLegacy = fixture('vimsottari.legacy.json') as Array<{ maha_dasha_lord: string; maha_start_date: string; bhuktis: Array<{ lord: string; start_date: string }> }>;
const narLegacy = fixture('narayana.legacy.json') as typeof vimLegacy;

/** children are contiguous and the last one ends where the parent ends */
function expectContiguous(node: DashaNode): void {
  if (!node.children.length) return;
  expect(node.children[0]!.start).toBe(node.start);
  node.children.forEach((c, i) => {
    if (i + 1 < node.children.length) expect(c.end).toBe(node.children[i + 1]!.start);
    expectContiguous(c);
  });
  expect(node.children.at(-1)!.end).toBe(node.end);
}

describe('detectDashaShape', () => {
  it('tells the two shapes apart and refuses everything else', () => {
    expect(detectDashaShape(vimV2)).toBe('v2');
    expect(detectDashaShape(narV2)).toBe('v2');
    expect(detectDashaShape(vimLegacy)).toBe('legacy');
    expect(detectDashaShape(JSON.stringify(vimLegacy))).toBe('legacy');
    expect(detectDashaShape(JSON.stringify(vimV2))).toBe('v2');
    expect(detectDashaShape(null)).toBe('unknown');
    expect(detectDashaShape(undefined)).toBe('unknown');
    expect(detectDashaShape({ a: 1 })).toBe('unknown');
    expect(detectDashaShape([{ x: 1 }])).toBe('unknown');
    expect(detectDashaShape('not json')).toBe('unknown');
    expect(detectDashaShape(42)).toBe('unknown');
  });
});

describe('normalizeDasha: new shape', () => {
  it('keeps every field of the brief example (system, balance, ISO dates, Julian days, durations, before_birth)', () => {
    const n = normalizeDasha(vimV2)!;
    expect(n.system).toBe('vimsottari');
    expect(n.levels).toBe(2);
    expect(n.balance_at_birth).toEqual({ lord: 'Moon', years: 6.42 });
    const moon = n.periods[0]!;
    expect(moon).toMatchObject({ lord: 'Moon', level: 1, start: '1984-03-02', start_jd: 2445761.5, duration_years: 10, before_birth: true });
    expect(moon.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(moon.children[0]).toMatchObject({ lord: 'Moon', level: 2, start: '1984-03-02', end: '1984-12-31' });
    expect(n.periods).toHaveLength(3);
    for (const p of n.periods) expectContiguous(p);
  });

  it('is idempotent and accepts a JSON string', () => {
    const once = normalizeDasha(vimV2)!;
    expect(normalizeDasha(once)).toEqual(once);
    expect(normalizeDasha(JSON.stringify(vimV2))).toEqual(once);
  });

  it('keeps sign_index on rasi nodes and a null balance', () => {
    const n = normalizeDasha(narV2)!;
    expect(n.system).toBe('narayana');
    expect(n.balance_at_birth).toBeNull();
    expect(n.periods[0]).toMatchObject({ lord: 'Capricorn', sign_index: 9 });
    expect(n.periods[0]!.children.every((c) => typeof c.sign_index === 'number')).toBe(true);
  });

  it('fills missing optional fields instead of failing', () => {
    const n = normalizeDasha({ periods: [{ lord: 'Sun', start: '2000-01-01' }] })!;
    expect(n).toMatchObject({ system: null, levels: 1, balance_at_birth: null });
    expect(n.periods[0]).toEqual({ lord: 'Sun', level: 1, start: '2000-01-01', end: null, start_jd: null, end_jd: null, duration_years: null, before_birth: false, children: [] });
  });

  it('takes the system from the hint only when the payload has none', () => {
    expect(normalizeDasha({ periods: [] }, { system: 'vimsottari' })!.system).toBe('vimsottari');
    expect(normalizeDasha(narV2, { system: 'vimsottari' })!.system).toBe('narayana');
  });
});

describe('normalizeDasha: legacy shape', () => {
  it('derives end from the next start; the last end is unknown; no balance, not before birth, no Julian days', () => {
    const n = normalizeDasha(vimLegacy, { system: 'vimsottari' })!;
    expect(n.system).toBe('vimsottari');
    expect(n.levels).toBe(2);
    expect(n.balance_at_birth).toBeNull();
    expect(n.periods).toHaveLength(3);
    expect(n.periods[0]).toMatchObject({ lord: 'Moon', level: 1, start: '1984-03-02', end: n.periods[1]!.start, before_birth: false, start_jd: null, end_jd: null, duration_years: null });
    expect(n.periods.at(-1)!.end).toBeNull();
    const lastMaha = n.periods.at(-1)!;
    expect(lastMaha.children.at(-1)!.end).toBeNull();
    // a bhukti ends where the next starts, and the last bhukti of a maha ends where the next maha starts
    expect(n.periods[0]!.children[0]!.end).toBe(n.periods[0]!.children[1]!.start);
    expect(n.periods[0]!.children.at(-1)!.end).toBe(n.periods[1]!.start);
    expect(n.periods[0]!.children.every((c) => c.level === 2 && c.children.length === 0)).toBe(true);
  });

  it('cuts the display time and moves a "(+1)" roll-over to the next day', () => {
    expect(legacyDateToIso('1984-03-02 07:15:30 AM')).toBe('1984-03-02');
    expect(legacyDateToIso('1995-08-17 01:20:00 AM (+1)')).toBe('1995-08-18');
    expect(legacyDateToIso('1995-12-31 11:59:00 PM (+1)')).toBe('1996-01-01');
    expect(legacyDateToIso('2000-02-28')).toBe('2000-02-28');
    expect(legacyDateToIso('garbage')).toBeNull();
    expect(legacyDateToIso(null)).toBeNull();
    const n = normalizeDasha(vimLegacy)!;
    expect(n.periods[1]!.children[2]!.start).toBe('1995-08-18'); // fixture row carries "(+1)"
  });

  it('reads the date-only narayana legacy rows, system null without a hint', () => {
    const n = normalizeDasha(narLegacy)!;
    expect(n.system).toBeNull();
    expect(n.periods.map((p) => p.lord)).toEqual(['Capricorn', 'Aquarius', 'Pisces']);
    expect(n.periods[0]!.start).toBe('1988-06-15');
  });

  it('legacy and new shape of the same dasha agree on lords and starts (ends where the legacy tree can say)', () => {
    const legacy = normalizeDasha(narLegacy)!;
    const v2 = normalizeDasha(narV2)!;
    expect(legacy.periods.map((p) => [p.lord, p.start])).toEqual(v2.periods.map((p) => [p.lord, p.start]));
    legacy.periods.forEach((p, i) => {
      expect(p.children.map((c) => [c.lord, c.start])).toEqual(v2.periods[i]!.children.map((c) => [c.lord, c.start]));
      p.children.forEach((c, j) => {
        if (c.end != null) expect(c.end).toBe(v2.periods[i]!.children[j]!.end);
      });
    });
    expect(legacy.periods.slice(0, -1).every((p, i) => p.end === v2.periods[i]!.end)).toBe(true);
  });

  it('handles empty and bhukti-less arrays', () => {
    expect(normalizeDasha([])).toEqual({ system: null, levels: 1, balance_at_birth: null, periods: [] });
    const n = normalizeDasha([{ maha_dasha_lord: 'Sun', maha_start_date: '2001-01-01' }])!;
    expect(n.levels).toBe(1);
    expect(n.periods[0]!.children).toEqual([]);
  });

  it('returns null for anything that is not a dasha', () => {
    for (const bad of [null, undefined, 7, 'x', {}, { a: 1 }, [{ foo: 1 }]]) expect(normalizeDasha(bad)).toBeNull();
  });
});

describe('toLegacyDasha (what the Charts page parses)', () => {
  it('passes a legacy array through untouched', () => {
    expect(toLegacyDasha(vimLegacy)).toEqual(vimLegacy);
    expect(toLegacyDasha(JSON.stringify(vimLegacy))).toEqual(vimLegacy);
  });

  it('turns the new shape into the legacy array (lord and ISO start per maha and bhukti)', () => {
    const out = toLegacyDasha(narV2) as typeof narLegacy;
    expect(out).toEqual(narLegacy);
    const vim = toLegacyDasha(vimV2) as typeof vimLegacy;
    expect(vim).toHaveLength(3);
    expect(vim[0]).toMatchObject({ maha_dasha_lord: 'Moon', maha_start_date: '1984-03-02' });
    expect(vim[0]!.bhuktis).toHaveLength(9);
    expect(vim[0]!.bhuktis[0]).toEqual({ lord: 'Moon', start_date: '1984-03-02' });
  });

  it('returns unrecognised input unchanged', () => {
    const odd = { from: 'legacy', c: 'x' };
    expect(toLegacyDasha(odd)).toBe(odd);
    expect(toLegacyDasha(null)).toBeNull();
  });
});

describe('dashaForPrompt', () => {
  it('gives the same compact form for either shape of the same data, without Julian days or empty fields', () => {
    const fromLegacy = dashaForPrompt(narLegacy, { system: 'narayana' }) as { system: string; periods: Array<Record<string, unknown>> };
    const fromV2 = dashaForPrompt(narV2) as { system: string; periods: Array<Record<string, unknown>> };
    expect(fromLegacy.system).toBe('narayana');
    expect(fromV2.system).toBe('narayana');
    const text = JSON.stringify(fromV2);
    expect(text).not.toContain('start_jd');
    expect(text).not.toContain('"children":[]');
    expect(text).not.toContain('"level"');
    expect(fromLegacy.periods.map((p) => p.lord)).toEqual(fromV2.periods.map((p) => p.lord));
    expect(fromLegacy.periods[0]).not.toHaveProperty('duration_years');
    expect(fromV2.periods[0]).toHaveProperty('duration_years');
  });

  it('keeps the balance at birth and marks periods before birth', () => {
    const out = dashaForPrompt(vimV2) as { balance_at_birth: unknown; periods: Array<{ before_birth?: boolean }> };
    expect(out.balance_at_birth).toEqual({ lord: 'Moon', years: 6.42 });
    expect(out.periods[0]!.before_birth).toBe(true);
    expect(out.periods[1]!.before_birth).toBeUndefined();
  });

  it('passes unrecognised input through so no data is lost', () => {
    expect(dashaForPrompt('(raw)')).toBe('(raw)');
    expect(dashaForPrompt({ x: 1 })).toEqual({ x: 1 });
  });
});
