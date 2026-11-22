/**
 * docs/techniques/09 §8 step 4: the natal prefix carries no date and the as-of day is out of the clock sheet, layer and
 * card keys. Day N and day N+1 inside one span give the same keys (a later open reads the stored reading); a day across
 * a span edge, or a new month of the slice window, gives a new one. TODAY rides only in the uncached dated block.
 */
import { describe, expect, it } from 'vitest';
import { layerCacheKey, layerValidUntil, readLayerCache } from '../../../../src/reading/clocks/layerCache.js';
import { sharedPrefix, sheetStoreKey, withDated } from '../../../../src/reading/clocks/reader.js';
import { cardStoreKey } from '../../../../src/reading/cards/store.js';
import { renderSliceSet, renderNatalCore } from '../../../../src/reading/slices/render.js';
import type { RenderedSlice } from '../../../../src/reading/slices/types.js';
import { frameRange, trimSliceToRange } from '../../../../src/reading/slices/trim.js';
import { frame as frameOf, inventories, natal } from '../slices/fixtures.js';

function keysOn(asOf: string, place: { s1: 'now' | 'next' } = { s1: 'now' }) {
  const f = { ...frameOf(), asOf, to: `${Number(asOf.slice(0, 4)) + 1}${asOf.slice(4)}` };
  f.spans = f.spans.map((s) => (s.id === 's1' ? { ...s, place: place.s1 } : s));
  const slices = [renderNatalCore(natal()), ...renderSliceSet({ frame: f, inventories: inventories() })];
  const by = new Map(slices.map((s) => [s.id, s] as [string, RenderedSlice]));
  const prefix = sharedPrefix({ natal: by.get('natal.core')!, sky: by.get('sky.window')!, year: by.get('year.tp')!, frame: by.get('frame')! }, asOf);
  const clock = trimSliceToRange(by.get('clock.vimsottari')!, frameRange(f));
  const frameHash = by.get('frame')!.hash;
  return {
    prefix,
    sheet: sheetStoreKey('vimsottari', { frameHash, prefix, slice: clock, model: 'm' }),
    layer: layerCacheKey({ model: 'm', prefixHash: prefix.hash, frameHash, clockSlices: slices.filter((s) => s.id.startsWith('clock.')).map((s) => ({ id: s.id, hash: s.hash })), promptVersion: 'p' }),
    card: cardStoreKey({ card: 'drive', clock: 'vimsottari', frameHash: 'fh', ledgerHash: 'lh', prefixHash: prefix.hash, profileHash: 'pr', portraitHash: 'po', sectionsHash: 'se', confirmHash: '-', promptHash: 'p' }),
    frame: f,
    clocks: slices.filter((s) => s.id.startsWith('clock.')),
  };
}

describe('stable keys across days (doc 09 step 4)', () => {
  it('the cached prefix carries no date of today; TODAY is in the dated block only', () => {
    const a = keysOn('2026-11-19');
    expect(a.prefix.text).not.toContain('2026-11-19');
    expect(a.prefix.dated).toContain('TODAY: 2026-11-19');
    expect(a.prefix.dated).toContain('# FRAME');
    expect(withDated(a.prefix, 'ROLE', '')).toBe(`${a.prefix.dated}\n\nROLE`);
    // keys of both parts are allowed
    expect(a.prefix.keys).toEqual(expect.arrayContaining(['house:D1.h10', 'pressure:annual:TP2026']));
  });

  it('day N and day N+1 in one span and one month: the same sheet, layer and card keys and the same cache region', () => {
    const a = keysOn('2026-11-19');
    const b = keysOn('2026-11-20');
    expect(b.prefix.text).toBe(a.prefix.text);
    expect(b.prefix.cacheHash).toBe(a.prefix.cacheHash);
    expect(b.sheet).toBe(a.sheet);
    expect(b.layer).toBe(a.layer);
    expect(b.card).toBe(a.card);
    expect(b.prefix.dated).not.toBe(a.prefix.dated);
  });

  it('crossing a span edge (s1 is no longer now) changes the keys', () => {
    const a = keysOn('2026-11-19');
    const b = keysOn('2026-11-20', { s1: 'next' });
    expect(b.sheet).not.toBe(a.sheet);
    expect(b.layer).not.toBe(a.layer);
  });

  it('a stored layer entry serves until its earliest edge, not after', async () => {
    const a = keysOn('2026-11-19');
    const until = layerValidUntil(a.frame, { clocks: a.clocks }, '2026-11-19');
    expect(until).toBe('2027-01-01');
    const entry = { v: 2, key: a.layer, asOf: '2026-11-19', validUntil: until, status: 'ok', sheets: [], ledger: { frameHash: 'f', sheetHashes: {}, cells: [], pairs: [], byStatus: { confirmed: 0, leaning: 0, single: 0, contested: 0 } } };
    const prisma = { kundliSlice: { findMany: async () => [{ slice_id: 'layer.clock', hash: a.layer, text: JSON.stringify(entry) }] } } as never;
    expect(await readLayerCache(prisma, 'k1', a.layer, '2026-12-31')).not.toBeNull();
    expect(await readLayerCache(prisma, 'k1', a.layer, '2027-01-01')).toBeNull();
  });
});
