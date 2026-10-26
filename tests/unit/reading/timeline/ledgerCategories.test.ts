import { describe, expect, it } from 'vitest';
import { MARKER_IDS, markerForCategory } from '../../../../src/reading/timeline/markers.js';
import { ALL_LEDGER_CATEGORIES, LEDGER_CATEGORIES, checkAttributes, checkLedgerInput, ledgerMeta, mergeLedgerUpdate, normalizeLedgerDate } from '../../../../src/reading/timeline/ledgerCategories.js';
import { parseLedger } from '../../../../src/reading/timeline/ledger.js';

const TODAY = new Date('2026-10-26T12:00:00Z');

describe('ledger categories', () => {
  it('every category belongs to the marker it is listed under and passes parseLedger', () => {
    for (const m of MARKER_IDS) for (const c of LEDGER_CATEGORIES[m]) expect(markerForCategory(c.code), c.code).toBe(m);
    expect(new Set(ALL_LEDGER_CATEGORIES).size).toBe(ALL_LEDGER_CATEGORIES.length);
    const { dropped } = parseLedger(ALL_LEDGER_CATEGORIES.map((category, i) => ({ id: `e${i}`, category, date: '2020-01-01', date_precision: 'year' })));
    expect(dropped).toBe(0);
  });

  it('meta groups the picker by marker and lists the doc 27 attribute keys', () => {
    const meta = ledgerMeta();
    expect(meta.markers.map((m) => m.id)).toEqual([...MARKER_IDS]);
    expect(meta.attributes.map((a) => a.key)).toEqual(['colour', 'make', 'direction', 'floor', 'field', 'country', 'outcome', 'with_whom']);
    expect(meta.precisions).toEqual(['day', 'month', 'year']);
  });

  it('no category label carries evaluation wording', () => {
    const labels = MARKER_IDS.flatMap((m) => LEDGER_CATEGORIES[m].map((c) => c.label)).join(' ').toLowerCase();
    for (const w of ['good', 'bad', 'lucky', 'success', 'fail', 'positive', 'negative']) expect(labels).not.toContain(w);
  });
});

describe('normalizeLedgerDate', () => {
  it('cuts the date to the precision', () => {
    expect(normalizeLedgerDate('2014-06-17', 'day', TODAY)).toBe('2014-06-17');
    expect(normalizeLedgerDate('2014-06', 'month', TODAY)).toBe('2014-06-01');
    expect(normalizeLedgerDate('2014-06-17', 'month', TODAY)).toBe('2014-06-01');
    expect(normalizeLedgerDate('2014', 'year', TODAY)).toBe('2014-01-01');
  });
  it('rejects missing parts, impossible days, the future and pre-1900', () => {
    expect(normalizeLedgerDate('2014', 'day', TODAY)).toBeNull();
    expect(normalizeLedgerDate('2014', 'month', TODAY)).toBeNull();
    expect(normalizeLedgerDate('2015-02-30', 'day', TODAY)).toBeNull();
    expect(normalizeLedgerDate('2026-10-27', 'day', TODAY)).toBeNull();
    expect(normalizeLedgerDate('2026-10', 'month', TODAY)).toBe('2026-10-01');
    expect(normalizeLedgerDate('1899', 'year', TODAY)).toBeNull();
    expect(normalizeLedgerDate('June 2014', 'month', TODAY)).toBeNull();
  });
});

describe('checkLedgerInput', () => {
  const ok = { category: 'vehicle.purchase', date: '2014-06-17', date_precision: 'day', place: ' Pune ', attributes: { colour: 'white', make: 'Honda', direction: 'ne' } };

  it('accepts a fact with attributes and normalises it', () => {
    const r = checkLedgerInput(ok, TODAY);
    expect(r).toEqual({ ok: true, value: { category: 'vehicle.purchase', date: '2014-06-17', date_precision: 'day', place: 'Pune', attributes: { colour: 'white', make: 'Honda', direction: 'NE' } } });
  });

  it('rejects unknown categories, keys and directions', () => {
    expect(checkLedgerInput({ ...ok, category: 'vehicle' }, TODAY)).toMatchObject({ ok: false, field: 'category' });
    expect(checkLedgerInput({ ...ok, category: 'astro.thing' }, TODAY)).toMatchObject({ ok: false, field: 'category' });
    expect(checkLedgerInput({ ...ok, attributes: { note: 'x' } }, TODAY)).toMatchObject({ ok: false, error: 'attribute_unknown' });
    expect(checkLedgerInput({ ...ok, attributes: { direction: 'up' } }, TODAY)).toMatchObject({ ok: false, error: 'direction_invalid' });
    expect(checkLedgerInput({ ...ok, date_precision: 'week' }, TODAY)).toMatchObject({ ok: false, field: 'date_precision' });
  });

  it('keeps the record to facts: no judgement words, no amounts', () => {
    expect(checkLedgerInput({ ...ok, category: 'business.end', attributes: { outcome: 'failed badly' } }, TODAY)).toMatchObject({ ok: false, error: 'judgement_wording' });
    expect(checkLedgerInput({ ...ok, category: 'business.end', attributes: { outcome: 'closed' } }, TODAY).ok).toBe(true);
    expect(checkAttributes({ outcome: 'sold for 5 lakhs' })).toMatchObject({ ok: false, error: 'amount_not_recorded' });
    expect(checkAttributes({ outcome: '$20000' })).toMatchObject({ ok: false, error: 'amount_not_recorded' });
    expect(checkLedgerInput({ ...ok, place: 'an unlucky town' }, TODAY)).toMatchObject({ ok: false, field: 'place' });
    expect(checkAttributes({ floor: 3 })).toEqual({ ok: true, value: { floor: '3' } });
    expect(checkAttributes({ colour: 'x'.repeat(81) })).toMatchObject({ ok: false, error: 'attribute_too_long' });
  });

  it('a partial update merges over the stored row and coarsens the date', () => {
    const stored = { id: 'e1', category: 'job.start', date: '2014-06-17', date_precision: 'day' as const, place: 'Pune', attributes: { field: 'computing' } };
    expect(mergeLedgerUpdate(stored, { date_precision: 'year' }, TODAY)).toMatchObject({ ok: true, value: { date: '2014-01-01', date_precision: 'year', place: 'Pune', attributes: { field: 'computing' } } });
    expect(mergeLedgerUpdate(stored, { place: null, attributes: {} }, TODAY)).toMatchObject({ ok: true, value: { place: null, attributes: {} } });
    expect(mergeLedgerUpdate(stored, { category: 'nope' }, TODAY).ok).toBe(false);
  });
});
