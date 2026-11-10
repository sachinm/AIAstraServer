/**
 * The heavy-tone stopgap (docs/reading-engine/70-heavy-clocks-2026-11-10.md): the engine's stored `reasons` reach the
 * row, one selection grades `presses` by the count of bad flags, the frame shows a span tone only when
 * READING_CLOCKS_MIN clocks hold it, and the frame names every Tithi Pravesha year its spans touch.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { gradeRow, toneOfRow, type ToneRule } from '../../../../../src/reading/self/sub/rowTone.js';
import { toPressureInventory, type EnginePressurePayload, type PressureInventoryDetail, type PressureRowDetail } from '../../../../../src/reading/self/sub/pressure.js';
import { buildYearFrameV3, heldTone, renderYearFrame } from '../../../../../src/reading/self/v3/yearFrame.js';
import { KeyBook } from '../../../../../src/reading/self/v2/slices.js';
import { parseRowLines, rowLine } from '../../../../../src/reading/slices/render.js';

const RULE: ToneRule = {
  minBad: 3,
  bad: ['functional_malefic', 'in_dusthana', 'kashta_over_ishta', 'shadbala_ratio_below_0.8', '2_12_from_parent', '6_8_from_parent'],
  good: ['functional_benefic'],
};
const THREE = ['functional_malefic', 'in_dusthana', 'kashta_over_ishta'];

afterEach(() => {
  delete process.env.PRESSES_MIN_BAD_FLAGS;
});

describe('gradeRow', () => {
  it('presses with three or more bad flags is heavy; with fewer, mixed; supports stays light', () => {
    expect(gradeRow({ kind: 'dasha', polarity: 'presses', reasons: THREE }, RULE)).toMatchObject({ tone: 'heavy', engine: 'presses', softened: false });
    expect(gradeRow({ kind: 'dasha', polarity: 'presses', reasons: ['functional_malefic'] }, RULE)).toMatchObject({ tone: 'mixed', engine: 'presses', softened: true, bad: ['functional_malefic'] });
    expect(gradeRow({ kind: 'annual', polarity: 'presses', reasons: ['in_dusthana', '6_8_from_parent'] }, RULE).tone).toBe('mixed');
    expect(gradeRow({ kind: 'dasha', polarity: 'supports', reasons: ['functional_benefic'] }, RULE)).toMatchObject({ tone: 'light', good: ['functional_benefic'] });
    expect(gradeRow({ kind: 'dasha', polarity: 'mixed', reasons: ['functional_benefic', '2_12_from_parent'] }, RULE).tone).toBe('mixed');
  });
  it('a flag the rule does not list is not counted', () => {
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses', reasons: ['functional_malefic', 'in_dusthana', 'something_new'] }, RULE)).toBe('mixed');
  });
  it('rows of other kinds and rows without a stored list keep the engine verdict', () => {
    expect(toneOfRow({ kind: 'transit', polarity: 'presses', reasons: ['functional_malefic'] }, RULE)).toBe('heavy');
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses', reasons: null }, RULE)).toBe('heavy');
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses' }, RULE)).toBe('heavy');
  });
  it('reads PRESSES_MIN_BAD_FLAGS (1 restores the engine tone)', () => {
    process.env.PRESSES_MIN_BAD_FLAGS = '1';
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses', reasons: ['in_dusthana'] })).toBe('heavy');
    process.env.PRESSES_MIN_BAD_FLAGS = '2';
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses', reasons: ['in_dusthana'] })).toBe('mixed');
    expect(toneOfRow({ kind: 'dasha', polarity: 'presses', reasons: ['in_dusthana', 'kashta_over_ishta'] })).toBe('heavy');
  });
});

describe('the stored reasons reach PressureRowDetail', () => {
  it('toPressureInventory carries reasons, and null when the engine sent none', () => {
    const payload: EnginePressurePayload = {
      calc_version: '2',
      system: 'vimsottari',
      as_of: '2026-11-10',
      from: '2023-11-10',
      to: '2029-11-10',
      levels: 3,
      boundaries: [],
      rows: [
        { id: 'dasha:vimsottari/1/Sa@2020-01-01', kind: 'dasha', level: 1, planet: 'Sa', houses_touched: [6], matters: ['partnership'], polarity: 'presses', strength: 1, from: '2020-01-01', to: '2030-01-01', evidence: [], reasons: ['functional_malefic', 7 as unknown as string] },
        { id: 'transit:Sa/h6@2026-01-01', kind: 'transit', planet: 'Sa', houses_touched: [6], matters: [], polarity: 'presses', strength: 2, from: '2026-01-01', to: '2027-01-01', evidence: [] },
      ],
    };
    const inv = toPressureInventory(payload, 'k1').inventory;
    expect(inv.rows[0]!.reasons).toEqual(['functional_malefic']);
    expect(inv.rows[1]!.reasons).toBeNull();
  });
  it('the slice line writes the graded tone beside the engine polarity, and reads it back', () => {
    const r = { id: 'dasha:yogini/3/Ma@2026-01-01', kind: 'dasha', level: 3, planet: 'Ma', housesTouched: [8], matters: ['sudden_and_hidden'], polarity: 'presses', strength: 1, from: '2026-01-01', to: '2026-03-01', evidence: [], houseFromMoon: null, reasons: ['in_dusthana'] } as PressureRowDetail;
    const line = rowLine(new KeyBook(), r);
    expect(line).toContain('tone=mixed polarity=presses flags=1');
    expect(parseRowLines(line).get('pressure:dasha:yogini/3/Ma@2026-01-01')).toMatchObject({ polarity: 'presses', tone: 'mixed' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The frame
// ---------------------------------------------------------------------------------------------------------------------

const ASOF = '2026-11-10';
const row = (id: string, kind: PressureRowDetail['kind'], level: number | undefined, polarity: PressureRowDetail['polarity'], from: string, to: string, reasons: string[] | null = null): PressureRowDetail =>
  ({ id, kind, ...(level ? { level } : {}), planet: 'X', housesTouched: [6], matters: ['work_load_and_health'], polarity, strength: 1, from, to, evidence: [id], houseFromMoon: null, reasons }) as PressureRowDetail;
const inv = (clock: string, rows: PressureRowDetail[]): PressureInventoryDetail => ({ kundliId: 'k1', clock, asOf: ASOF, from: '2023-11-10', to: '2029-11-10', rows, boundaries: [], calcVersion: '2' });
const clock = { primary: 'dwisatpathi', confirming: [], applicable: [], notApplicable: [] } as never;
const year = { from: '2026-09-12', to: '2027-09-01', yearLagna: null, yearLord: null, shortClock: null, noCoverage: false };

// the spine: one light period over the whole frame; the year rows: TP2026 then TP2027
const spine = (spinePolarity: PressureRowDetail['polarity'], reasons: string[] | null = null) =>
  inv('dwisatpathi', [
    row('dasha:dwisatpathi/3/Ju@2026-10-01', 'dasha', 3, spinePolarity, '2026-10-01', '2028-02-01', reasons),
    row('annual:TP2026', 'annual', 1, 'presses', '2026-09-12', '2027-09-01', THREE),
    row('annual:TP2027', 'annual', 1, 'presses', '2027-09-01', '2028-08-20', THREE),
  ]);
const heavyClock = (system: string) => ({ system, inventory: inv(system, [row(`dasha:${system}/3/Sa@2026-01-01`, 'dasha', 3, 'presses', '2026-01-01', '2029-01-01', THREE)]) });

describe('the frame tone needs READING_CLOCKS_MIN clocks', () => {
  it('heldTone: one tone held by min clocks, else none', () => {
    expect(heldTone(['light', 'heavy', 'heavy', 'heavy', 'heavy'], 3)).toEqual({ tone: 'heavy', agree: 4 });
    expect(heldTone(['light', 'heavy'], 3)).toEqual({ tone: null, agree: 1 });
    expect(heldTone(['heavy', 'heavy', 'heavy', 'light', 'light', 'light'], 3)).toEqual({ tone: null, agree: 3 });
  });
  it('one clock light against four heavy: the span is not shown light', () => {
    const f = buildYearFrameV3({ asOf: ASOF, clock, primary: spine('supports'), others: ['vimsottari', 'narayana', 'yogini'].map(heavyClock), year, rule: RULE, minClocks: 3 });
    const s = f.spans[0]!;
    expect(s.spineTone).toBe('light');
    expect(s.clocks.map((c) => c.tone)).toEqual(['light', 'heavy', 'heavy', 'heavy', 'heavy']);
    expect([s.tone, s.held, s.agree, s.of]).toEqual(['heavy', true, 4, 5]);
    // the engine's polarity and the flag count stay in the provenance
    expect(s.clocks[1]).toMatchObject({ system: 'tithi_pravesha', polarity: 'presses', flags: 3 });
  });
  it('the spine alone holds no tone: no tone is shown', () => {
    const f = buildYearFrameV3({ asOf: ASOF, clock, primary: spine('supports'), others: [], year, rule: RULE, minClocks: 3 });
    expect(f.spans.every((s) => s.held === false && s.tone === 'mixed')).toBe(true);
    expect(renderYearFrame(f, 'Main').text).toContain('held=no');
  });
  it('presses with one flag on every clock reads mixed, so heavy is not the default', () => {
    const one = ['functional_malefic'];
    const others = ['vimsottari', 'narayana', 'yogini'].map((system) => ({ system, inventory: inv(system, [row(`dasha:${system}/3/Sa@2026-01-01`, 'dasha', 3, 'presses', '2026-01-01', '2029-01-01', one)]) }));
    const p = inv('dwisatpathi', [row('dasha:dwisatpathi/3/Ju@2026-10-01', 'dasha', 3, 'presses', '2026-10-01', '2028-02-01', one), row('annual:TP2026', 'annual', 1, 'presses', '2026-09-12', '2027-09-01', one)]);
    const f = buildYearFrameV3({ asOf: ASOF, clock, primary: p, others, year, rule: RULE, minClocks: 3 });
    expect(f.spans[0]).toMatchObject({ tone: 'mixed', held: true, agree: 5 });
    expect(f.spans[0]!.clocks.every((c) => c.polarity === 'presses' && c.tone === 'mixed')).toBe(true);
  });
  it('names every Tithi Pravesha year its spans touch', () => {
    const f = buildYearFrameV3({ asOf: ASOF, clock, primary: spine('supports'), others: ['vimsottari', 'narayana'].map(heavyClock), year, rule: RULE, minClocks: 3 });
    expect(f.to > '2027-09-01').toBe(true);
    expect(f.years).toEqual([
      { key: 'pressure:annual:TP2026', label: 'TP2026', from: '2026-09-12', to: '2027-09-01' },
      { key: 'pressure:annual:TP2027', label: 'TP2027', from: '2027-09-01', to: '2028-08-20' },
    ]);
    expect(renderYearFrame(f, 'Main').text).toContain('YEARS: TP2026 2026-09-12..2027-09-01 {pressure:annual:TP2026}; TP2027 2027-09-01..2028-08-20 {pressure:annual:TP2027}');
  });
});
