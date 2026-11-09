import { describe, expect, it } from 'vitest';
import { buildPersonalizerSlice, buildSelfV2Slices, claimKey, estTokens, MIN_CACHE_TOKENS, topRisk, toSelfClock } from '../../../../../src/reading/self/v2/slices.js';
import type { OracleV2Output } from '../../../../../src/reading/self/v2types.js';
import { ACTIVATION, makeBriefs, makeCtx, makeProfile, makeView } from './fixtures.js';

const loaded = { view: makeView(), activation: ACTIVATION, sky: null, preferred: null };

const oracleOut = (): OracleV2Output => ({
  doc: {
    areas: {
      diagnosis: {
        id: 'diagnosis',
        headline: 'Work asks more of you now.',
        paragraphs: ['Saturn in the 10th presses the career through the Venus sub-period.', 'The 6/8 relation of Venus from Rahu costs effort until 2028-11-16.'],
        dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'Venus sub-period' }],
        actions: [],
        certainty: 'strong',
        evidence: ['planet:D1.Sa', 'claim:diagnosis.main'],
        validUntil: '2027-02-20',
      },
    },
    validUntil: '2027-02-20',
  },
  patterns: [],
});

describe('Self v2 slices (doc 66 §4.8 Layer 3)', () => {
  it('builds every slice from the context with no database: five families and the Oracle, owned by the person', () => {
    const s = buildSelfV2Slices(makeCtx(), loaded, makeBriefs());
    expect(Object.keys(s.families).sort()).toEqual(['family.dasha', 'family.rasi', 'family.sky', 'family.varga', 'family.year']);
    for (const sl of [...Object.values(s.families), s.oracle]) {
      expect(sl.cacheOwner).toEqual({ userId: 'u-v2', kundliId: 'k-v2' });
      expect(sl.prefixHash).toMatch(/^[0-9a-f]{24}$/);
      expect(sl.estTokens.prefix).toBe(estTokens(sl.prefix));
    }
    expect(s.oracle.agent).toBe('self.oracle');
  });

  it('the Oracle prefix is the natal slice plus the promise ledger, at least 1,024 tokens, with no date of today in it', () => {
    const s = buildSelfV2Slices(makeCtx(), loaded, makeBriefs());
    expect(s.oracle.estTokens.prefix).toBeGreaterThanOrEqual(MIN_CACHE_TOKENS);
    expect(s.oracle.prefix).toContain('# FAMILY PACK: family.rasi');
    expect(s.oracle.prefix).toContain('# FAMILY PACK: family.varga');
    expect(s.oracle.prefix).toContain('{promise:p1}');
    expect(s.oracle.prefix).not.toContain('2026-11-09');
    // the suffix carries the dated part
    for (const part of ['TODAY: 2026-11-09', '## RISK LEDGER', '{risk:r1}', '## AREA BRIEFS', '{claim:stuck.work_load}', '## CONFIRMS']) expect(s.oracle.suffix).toContain(part);
    expect(s.oracle.keys).toEqual(expect.arrayContaining(['planet:D1.Sa', 'risk:r1', 'promise:p1', claimKey('stuck.work_load'), 'activation:vimsottari/2/Ve@2025-11-16']));
  });

  it('pads family.sky past 1,024 tokens with the window rows it may read', () => {
    const s = buildSelfV2Slices(makeCtx(), loaded, makeBriefs());
    expect(s.families['family.sky'].estTokens.prefix).toBeGreaterThanOrEqual(MIN_CACHE_TOKENS);
    expect(s.families['family.sky'].prefix).toContain('WINDOW ROWS family.sky may read');
    expect(s.families['family.sky'].keys).toContain('window:sky-0');
  });

  it('a profile change leaves the Oracle and Personalizer prefixes unchanged; only the Personalizer suffix moves', () => {
    const a = makeCtx({ profile: makeProfile() });
    const b = makeCtx({ profile: makeProfile({ gender: 'woman', ageBand: '60_plus', mood: 'heavy', hash: 'profile-hash-2' }) });
    const sa = buildSelfV2Slices(a, loaded, makeBriefs());
    const sb = buildSelfV2Slices(b, loaded, makeBriefs());
    expect(sb.oracle.prefix).toBe(sa.oracle.prefix);
    expect(sb.oracle.prefixHash).toBe(sa.oracle.prefixHash);
    for (const id of Object.keys(sa.families) as Array<keyof typeof sa.families>) expect(sb.families[id].prefixHash).toBe(sa.families[id].prefixHash);
    const pa = buildPersonalizerSlice(a, oracleOut()).slice;
    const pb = buildPersonalizerSlice(b, oracleOut()).slice;
    expect(pb.prefix).toBe(pa.prefix);
    expect(pb.prefixHash).toBe(pa.prefixHash);
    expect(pb.suffix).not.toBe(pa.suffix);
    expect(pa.suffix).toContain('gender: not stated');
    expect(pb.suffix).toContain('gender: woman');
  });

  it('the Personalizer slice carries the Oracle paragraph ids, never the age in years or the profile hash', () => {
    const { slice, input } = buildPersonalizerSlice(makeCtx(), oracleOut());
    expect(slice.prefix).toContain('[diagnosis.p1]');
    expect(slice.keys).toEqual(expect.arrayContaining(['diagnosis.p1', 'diagnosis.p2', 'planet:D1.Sa', 'claim:diagnosis.main']));
    expect('ageYears' in input.profile).toBe(false);
    expect('hash' in input.profile).toBe(false);
    expect(slice.suffix).not.toContain('41');
  });

  it('risk top rows: the ledger top 3 first, then strength', () => {
    const ctx = makeCtx();
    expect(topRisk(ctx.sub.risk!.rows, ['r2']).map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(toSelfClock(ctx.sub.clock!).system).toBe('vimsottari');
  });
});
