import { describe, expect, it } from 'vitest';
import { refreshCurrent } from '../../../src/reading/facts/current.js';
import { G1_AS_OF, loadG1Dossier } from '../../helpers/readingFixtures.js';

const d = loadG1Dossier();

describe('refreshCurrent', () => {
  it('is a no-op on the dossier date', () => {
    const r = refreshCurrent(d, G1_AS_OF);
    expect(r.dossier).toBe(d);
    expect(r.stale).toBe(false);
  });
  it('reproduces the engine current period from the dated rows', () => {
    // build the same date from a different as_of label so the selection path runs
    const shifted = { ...d, as_of: '2026-10-23' };
    const r = refreshCurrent(shifted, G1_AS_OF);
    const c = r.dossier.dasha.vimshottari.current;
    const e = d.dasha.vimshottari.current;
    expect(c).toMatchObject({ md: e.md, ad: e.ad, pd: e.pd, md_start: e.md_start, md_end: e.md_end, pd_start: e.pd_start, pd_end: e.pd_end });
    expect(c.ad_start).toBe(e.ad_start);
    expect(c.ad_end).toBe(e.ad_end);
  });
  it('moves to the next pratyantardasha two months later', () => {
    const r = refreshCurrent(d, '2026-12-24');
    const c = r.dossier.dasha.vimshottari.current;
    expect(c.md).toBe('Sa');
    expect(c.ad).toBe('Ke');
    expect(c.pd).toBeDefined();
    expect(c.pd !== d.dasha.vimshottari.current.pd || c.pd_start !== d.dasha.vimshottari.current.pd_start).toBe(true);
    expect(c.pd_start! <= '2026-12-24' && '2026-12-24' <= c.pd_end!).toBe(true);
    expect(r.dossier.as_of).toBe('2026-12-24');
  });
  it('rolls over to the next antardasha after the current one ends', () => {
    const c = refreshCurrent(d, '2027-10-01').dossier.dasha.vimshottari.current;
    expect(c.ad).toBe('Ve');
    expect(c.md).toBe('Sa');
  });
  it('flags a dossier as stale near the edge of the PD window', () => {
    expect(refreshCurrent(d, '2029-09-01').stale).toBe(true);
    expect(refreshCurrent(d, '2025-01-01').stale).toBe(true);
    expect(refreshCurrent(d, '2027-06-01').stale).toBe(false);
  });
  it('selects the Narayana period containing the date', () => {
    const n = refreshCurrent(d, '2026-12-24').dossier.dasha.narayana.current as any;
    expect(n.start <= '2026-12-24' && '2026-12-24' < n.end).toBe(true);
    expect(n.md_start).toBeDefined();
  });
});
