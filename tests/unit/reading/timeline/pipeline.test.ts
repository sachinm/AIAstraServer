import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { contactRanges, pastRange } from '../../../../src/reading/timeline/inputs.js';
import { buildPastTimeline, TimelineDisabledError, verifyPast } from '../../../../src/reading/timeline/pipeline.js';
import { readLedger, resetTimelineStoreWarning, saveVerifiedBuild } from '../../../../src/reading/timeline/store.js';
import { G1_AS_OF, loadG1Ledger, loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const ON = { TIMELINE_ENABLED: '1' };

describe('past timeline pipeline (doc 27 §B.7 P1) on G1', () => {
  it('is gated behind TIMELINE_ENABLED', () => {
    expect(() => buildPastTimeline(loadG1TimelineInputs(), { env: {} })).toThrow(TimelineDisabledError);
  });

  const v = verifyPast(loadG1TimelineInputs(), loadG1Ledger(), { env: ON });
  const b = v.build;

  it('builds 217 months back from the as-of date with every P1 system', () => {
    expect(b.range).toEqual({ from: '2008-10-01', to: '2026-10-31' });
    expect(b.grid.months).toHaveLength(217);
    expect(new Set(b.activations.map((a) => a.system))).toEqual(new Set(['S1', 'S2', 'S3', 'S4', 'S6', 'S7']));
    expect(b.s3Applicable).toBe(true);
    expect(b.notes).toEqual([]);
  });

  it('every activation cites its evidence', () => {
    for (const a of b.activations) {
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.evidence[0]).toMatch(/^(dasha\.|transit_contacts\[)/);
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
