/**
 * Cutting slices to the frame (doc 70 Phase 3 replay fixes): the clock readers' slices and the cards' matter rows keep
 * only rows overlapping the frame, every kept line as written; the cards name prefix rows by key only.
 */
import { describe, expect, it } from 'vitest';
import { renderSliceSet } from '../../../../src/reading/slices/render.js';
import { cardMatterRows, frameRange, trimSliceToRange } from '../../../../src/reading/slices/trim.js';
import type { RenderedSlice } from '../../../../src/reading/slices/types.js';
import { frame, inventories, natal } from './fixtures.js';

const slice = (id: string, text: string): RenderedSlice => ({ id, text, keys: [...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!).filter((k, i, a) => a.indexOf(k) === i).sort(), estTokens: 1, sources: [], hash: 'h0' });
const RANGE = { from: '2026-10-27', to: '2028-01-18' };

const clockText = [
  '# CLOCK yogini (3 periods, levels 1-3, 2025-11-10..2028-05-10)',
  '## periods',
  '{pressure:dasha:yogini/3/Ma@2025-11-20} kind=dasha L3 lord=Ma 2025-11-20..2026-03-01 tone=heavy polarity=presses strength=2 houses=[6] matters=[self_and_body]',
  '{pressure:dasha:yogini/2/Ra@2026-01-01} kind=dasha L2 lord=Ra 2026-01-01..2027-06-01 tone=mixed polarity=presses strength=2 houses=[12] matters=[loss_rest_and_distance]',
  '{pressure:dasha:yogini/3/Ju@2028-02-01} kind=dasha L3 lord=Ju 2028-02-01..2028-04-01 tone=light polarity=supports strength=2 houses=[1] matters=[self_and_body]',
  '## by span (the rows of this clock overlapping each FRAME span)',
  's1 2026-10-27..2027-01-25: {pressure:dasha:yogini/2/Ra@2026-01-01}',
  '## by house (the houses each period touches)',
  'h1: {pressure:dasha:yogini/3/Ju@2028-02-01}',
  'h6: {pressure:dasha:yogini/3/Ma@2025-11-20}',
  'h12: {pressure:dasha:yogini/2/Ra@2026-01-01}',
].join('\n');

describe('trimSliceToRange', () => {
  it('drops rows outside the range and their keys in the index lines; kept lines are unchanged; the hash changes', () => {
    const s = slice('clock.yogini', clockText);
    const t = trimSliceToRange(s, RANGE);
    expect(t.text).toContain(clockText.split('\n')[3]);
    expect(t.text).not.toContain('yogini/3/Ma@2025-11-20');
    expect(t.text).not.toContain('yogini/3/Ju@2028-02-01');
    expect(t.text).toContain('h1: none');
    expect(t.text).toContain('h12: {pressure:dasha:yogini/2/Ra@2026-01-01}');
    expect(t.text).toContain('(cut to 2026-10-27..2028-01-18: 2 rows outside it left out)');
    expect(t.keys).toEqual(['pressure:dasha:yogini/2/Ra@2026-01-01']);
    expect(t.hash).not.toBe(s.hash);
    expect(t.id).toBe('clock.yogini');
  });
  it('a slice whose rows all overlap is returned as is', () => {
    const s = slice('clock.yogini', clockText);
    expect(trimSliceToRange(s, { from: '2025-01-01', to: '2029-01-01' })).toBe(s);
  });
  it('on the rendered fixtures: every kept row of a clock slice overlaps the frame, and no kept key is outside', () => {
    const f = frame();
    const r = frameRange(f);
    for (const s of renderSliceSet({ frame: f, inventories: inventories(), natal: natal() }).filter((x) => x.id.startsWith('clock.'))) {
      const t = trimSliceToRange(s, r);
      for (const m of t.text.matchAll(/^\{(pressure:[^}]+)\} .*?(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/gm)) expect(m[2]! < r.to && r.from < m[3]!, m[1]).toBe(true);
      for (const k of t.keys) expect(t.text).toContain(`{${k}}`);
    }
  });
});

describe('cardMatterRows', () => {
  const body = slice('matter.self_and_body', [
    '# MATTER self_and_body (1 promise entries, 3 dated rows, 2025-11-10..2028-05-10)',
    '## promise (natal)',
    '{promise:p1} yoga strength=2 house=1',
    '## clock yogini',
    '{pressure:dasha:yogini/3/Ma@2025-11-20} kind=dasha L3 lord=Ma 2025-11-20..2026-03-01 tone=heavy polarity=presses strength=2 houses=[6] matters=[self_and_body]',
    '{pressure:dasha:yogini/2/Ra@2026-01-01} kind=dasha L2 lord=Ra 2026-01-01..2027-06-01 tone=mixed polarity=presses strength=2 houses=[12] matters=[self_and_body,loss_rest_and_distance]',
    '## sky',
    '{pressure:transit:Sa@2027-06-03} kind=transit lord=Sa 2027-06-03..2027-12-01 tone=heavy polarity=presses strength=3 houses=[1] matters=[self_and_body]',
  ].join('\n'));
  const loss = slice('matter.loss_rest_and_distance', [
    '# MATTER loss_rest_and_distance (0 promise entries, 1 dated rows, 2025-11-10..2028-05-10)',
    '## promise (natal)',
    '(none)',
    '## clock yogini',
    '{pressure:dasha:yogini/2/Ra@2026-01-01} kind=dasha L2 lord=Ra 2026-01-01..2027-06-01 tone=mixed polarity=presses strength=2 houses=[12] matters=[self_and_body,loss_rest_and_distance]',
  ].join('\n'));

  it('each row once, only rows overlapping the frame, prefix rows and promise entries by key', () => {
    const prefixKeys = new Set(['pressure:transit:Sa@2027-06-03', 'promise:p1']);
    const m = cardMatterRows([body, loss], RANGE, prefixKeys);
    expect(m.text.match(/yogini\/2\/Ra@2026-01-01\} kind=/g)).toHaveLength(1);
    expect(m.text).not.toContain('yogini/3/Ma@2025-11-20');
    expect(m.text).not.toContain('kind=transit');
    expect(m.text).not.toContain('yoga strength=2');
    expect(m.text).toContain('## in the shared data above (full lines there): {pressure:transit:Sa@2027-06-03} {promise:p1}');
    expect(m.rows).toBe(1);
    expect(m.left).toBe(1);
    expect(m.keys).toEqual(['pressure:dasha:yogini/2/Ra@2026-01-01', 'pressure:transit:Sa@2027-06-03', 'promise:p1']);
  });
  it('a promise entry not in the prefix is kept in full', () => {
    const m = cardMatterRows([body], RANGE, new Set());
    expect(m.text).toContain('## promise (natal)\n{promise:p1} yoga strength=2 house=1');
  });
  it('no slices: none stored', () => {
    expect(cardMatterRows([], RANGE, new Set()).text).toBe('(none stored)');
  });
});
