import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { contactRanges, fixtureInputs, pastRange } from '../../../../src/reading/timeline/inputs.js';
import { buildPastTimeline, TimelineDisabledError, verifyPast } from '../../../../src/reading/timeline/pipeline.js';
import { readLedger, resetTimelineStoreWarning, saveVerifiedBuild } from '../../../../src/reading/timeline/store.js';
import { G1_AS_OF, loadG1Ledger, loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const ON = { TIMELINE_ENABLED: '1' };

/**
 * sha256 of the G1 activations and grid without evidence paths (those now cite `house_counts`), as built by develop at
 * 07238ed, before houses came from Radha's table, when Node still counted them itself. A deliberate scoring change
 * moves this digest: re-pin it then, and only then.
 */
const G1_RESULT_BEFORE_HOUSE_COUNTS = 'c95542b27e777267862bc4b5d95d5a39b76928da1c91359cf9f1624d1bd83518';

describe('houses from Radha (house_counts) on G1', () => {
  it('leaves the timeline results unchanged with the table present', () => {
    const b = buildPastTimeline(loadG1TimelineInputs(), { env: ON });
    expect(b.foundation.houseCounts).not.toBeNull();
    const body = JSON.stringify({ activations: b.activations, grid: b.grid }, (k, v) => (k === 'evidence' ? undefined : v));
    expect(createHash('sha256').update(body).digest('hex')).toBe(G1_RESULT_BEFORE_HOUSE_COUNTS);
  });

  describe('with the table missing', () => {
    // The G1 fixture folder without house_counts.json, as a kundli whose table Radha has not served
    const dir = mkdtempSync(path.join(tmpdir(), 'g1-no-house-counts-'));
    const g1 = path.resolve('evals/fixtures/G1');
    cpSync(g1, dir, { recursive: true, filter: (src) => path.basename(src) !== 'house_counts.json' });
    const bareInputs = fixtureInputs(dir, G1_AS_OF);
    rmSync(dir, { recursive: true, force: true });
    const bare = buildPastTimeline(bareInputs, { env: ON });
    const full = buildPastTimeline(loadG1TimelineInputs(), { env: ON });

    it('still builds, and the report says what is left out', () => {
      expect(bareInputs.houseCounts).toBeNull();
      expect(bareInputs.notes.some((n) => n.startsWith('house_counts not available'))).toBe(true);
      expect(bare.notes.some((n) => n.startsWith('house_counts not available'))).toBe(true);
      expect(bare.grid.months).toHaveLength(217);
      expect(full.notes.some((n) => n.includes('house_counts'))).toBe(false);
    });

    it('S4 is left out, and S7 has no Narayana row', () => {
      expect(bare.activations.some((a) => a.system === 'S4')).toBe(false);
      expect(bare.activations.some((a) => a.system === 'S7')).toBe(true);
      expect(bare.activations.filter((a) => a.system === 'S7').some((a) => a.evidence[0]!.startsWith('dasha.narayana'))).toBe(false);
    });

    it('S1 keeps the hits the drop would have lowered, and cites no count', () => {
      const s1 = (b: typeof bare) => b.activations.filter((a) => a.system === 'S1');
      expect(s1(bare).length).toBeGreaterThanOrEqual(s1(full).length);
      expect(s1(bare).some((a) => a.evidence.some((e) => e.startsWith('house_counts.')))).toBe(false);
      expect(s1(full).some((a) => a.evidence.some((e) => e.startsWith('house_counts.')))).toBe(true);
    });

    it('a malformed table counts as missing, with its own note', () => {
      const inputs = fixtureInputs(g1, G1_AS_OF);
      expect(inputs.houseCounts).not.toBeNull();
      const tmp = mkdtempSync(path.join(tmpdir(), 'g1-bad-house-counts-'));
      cpSync(g1, tmp, { recursive: true });
      writeFileSync(path.join(tmp, 'catalog', 'house_counts.json'), JSON.stringify({ varga: 1, sign_to_house: {} }));
      const bad = fixtureInputs(tmp, G1_AS_OF);
      rmSync(tmp, { recursive: true, force: true });
      expect(bad.houseCounts).toBeNull();
      expect(bad.notes.some((n) => n.startsWith('house_counts malformed'))).toBe(true);
    });
  });
});

describe('past timeline pipeline (doc 27 §B.7 P1) on G1', () => {
  it('is gated behind TIMELINE_ENABLED', () => {
    expect(() => buildPastTimeline(loadG1TimelineInputs(), { env: {} })).toThrow(TimelineDisabledError);
  });

  const v = verifyPast(loadG1TimelineInputs(), loadG1Ledger(), { env: ON });
  const b = v.build;

  it('builds 217 months back from the as-of date with every technique', () => {
    expect(b.range).toEqual({ from: '2008-10-01', to: '2026-10-31' });
    expect(b.grid.months).toHaveLength(217);
    for (const s of ['S1', 'S2', 'S3', 'S4', 'S6', 'S7']) expect(b.activations.some((a) => a.system === s)).toBe(true);
    expect(b.s3Applicable).toBe(true);
    expect(b.notes.some((n) => n.includes('S6D double transit is approximated'))).toBe(true);
  });

  it('every activation cites its evidence', () => {
    for (const a of b.activations) {
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.evidence[0]).toMatch(/^(dasha\.|transit_contacts\[)/);
    }
  });

  it('is selective: per marker at most 8 % High and 20 % Moderate; every High month has a period and a trigger', () => {
    const N = b.grid.months.length;
    for (const cells of Object.values(b.grid.cells)) {
      // support and test are banded separately, so up to two cuts' worth may show
      expect(cells.filter((c) => c.band === 'high').length).toBeLessThanOrEqual(2 * Math.round(0.08 * N));
      expect(cells.filter((c) => c.band === 'high' || c.band === 'moderate').length).toBeLessThanOrEqual(2 * Math.round(0.2 * N));
      for (const c of cells.filter((x) => x.band === 'high')) {
        const g = c.testing ? c.test : c.support;
        expect(g.D).toBeGreaterThan(0);
        expect(g.T).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic (the blind cast never reads the ledger)', () => {
    const again = buildPastTimeline(loadG1TimelineInputs(), { env: ON });
    expect(again.grid).toEqual(b.grid);
    expect(again.foundation.hash).toBe(b.foundation.hash);
  });

  it('matches every ledger event and calibrates every system', () => {
    expect(v.summary.scored).toBe(12);
    expect(v.summary.hits + v.summary.near + v.summary.misses).toBe(12);
    expect(v.summary.baselineHitRate).not.toBeNull();
    for (const s of ['S1', 'S2', 'S3', 'S4', 'S6', 'S7', 'ALL']) expect(v.calibration.rows.some((r) => r.system === s && r.marker === '*')).toBe(true);
    for (const w of Object.values(v.calibration.weights.systems)) {
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('TIMELINE_SYSTEMS leaves systems out', () => {
    const only = buildPastTimeline(loadG1TimelineInputs(), { env: { ...ON, TIMELINE_SYSTEMS: 'S1,S4' } });
    expect(new Set(only.activations.map((a) => a.system))).toEqual(new Set(['S1', 'S4']));
  });
});

describe('timeline inputs', () => {
  it('splits a range for Radha transit_contacts (<= 3660 days per call)', () => {
    const r = contactRanges('2008-10-01', '2026-10-31');
    expect(r[0]).toEqual({ from: '2008-10-01', to: '2018-08-10' });
    expect(r.at(-1)!.to).toBe('2026-10-31');
    expect(pastRange(G1_AS_OF, 18)).toEqual({ from: '2008-10-01', to: '2026-10-31' });
  });
});

describe('timeline store degrades when the tables are missing', () => {
  const missing = Object.assign(new Error('relation "life_events" does not exist'), { code: 'P2010' });
  const prisma = { $queryRaw: vi.fn().mockRejectedValue(missing), $transaction: vi.fn().mockRejectedValue(missing) } as unknown as PrismaClient;

  it('reads no ledger and stores nothing, without throwing', async () => {
    resetTimelineStoreWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await readLedger(prisma, 'k1')).toEqual({ status: 'unavailable' });
    const v = verifyPast(loadG1TimelineInputs(), loadG1Ledger(), { env: ON });
    expect(await saveVerifiedBuild(prisma, v)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('parses ledger rows the database returns', async () => {
    const ok = { $queryRaw: vi.fn().mockResolvedValue([{ id: 'e1', category: 'job.start', date: new Date('2022-09-05T00:00:00Z'), date_precision: 'day', place: null, attributes: {} }]) } as unknown as PrismaClient;
    expect(await readLedger(ok, 'k1')).toEqual({ status: 'found', events: [{ id: 'e1', category: 'job.start', date: '2022-09-05', date_precision: 'day', place: null, attributes: {} }] });
  });
});
