import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GeminiCallOptions } from '../../../../../src/reading/llm/gemini.js';
import { claimKeysOf, mergeOracleCalls, ORACLE_V2_AREAS, ORACLE_V2_CALLS, oracleV2Schema, runOracleV2, storedWindowsOf, validatePatterns } from '../../../../../src/reading/self/v2/oracle.js';
import { buildSelfV2Slices } from '../../../../../src/reading/self/v2/slices.js';
import { ACTIVATION, makeBriefs, makeCtx, makeGemini, makePrisma, makeView, oracleArea, geminiResult } from './fixtures.js';

const setup = () => {
  const ctx = makeCtx();
  const s = buildSelfV2Slices(ctx, { view: makeView(), activation: ACTIVATION, sky: null, preferred: null }, makeBriefs());
  return { ctx, slice: s.oracle };
};

describe('Self v2 Oracle: three calls over one prefix (doc 66 §4.1)', () => {
  // a priced model, so the spend cap is real (no call leaves the process: Gemini is mocked)
  const prev = process.env.READING_MODEL_ORACLE;
  beforeAll(() => {
    process.env.READING_MODEL_ORACLE = 'gemini-3.8-flash';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.READING_MODEL_ORACLE;
    else process.env.READING_MODEL_ORACLE = prev;
  });

  it('splits the eleven areas into three calls of three or four, each with its own schema; patterns only where mind or stuck is', () => {
    expect(ORACLE_V2_CALLS.flatMap((c) => c.areas).sort()).toEqual([...ORACLE_V2_AREAS].sort());
    for (const c of ORACLE_V2_CALLS) expect(c.areas.length).toBeGreaterThanOrEqual(3);
    const a = oracleV2Schema(ORACLE_V2_CALLS[0]!.areas) as { properties: Record<string, { items?: { properties: { id?: { enum: string[] } } } }> };
    expect(a.properties.areas!.items!.properties.id!.enum).toEqual(['diagnosis', 'stuck', 'chapter', 'chapters']);
    expect(a.properties.patterns).toBeDefined();
    expect((oracleV2Schema(['body', 'yogas', 'year']) as { properties: Record<string, unknown> }).properties.patterns).toBeUndefined();
  });

  it('runs the three calls in parallel over the same cached prefix and merges them into one validated document', async () => {
    const { ctx, slice } = setup();
    const log: string[] = [];
    const calls: GeminiCallOptions[] = [];
    const gem = makeGemini(log);
    const informUsed = vi.fn();
    const r = await runOracleV2(
      { prisma: makePrisma().prisma, callGemini: async (o) => (calls.push(o), gem(o)), informUsed, maxSpendUsd: 1 },
      ctx,
      slice,
    );
    expect(r.status).toBe('ok');
    expect(calls).toHaveLength(3);
    for (const c of calls) {
      expect(c.parts[0]).toBe(slice.prefix);
      expect(c.parts[1]).toBe(slice.suffix);
      expect(c.cachePrefix).toBe(true);
      expect(c.cacheOwner).toEqual({ userId: 'u-v2', kundliId: 'k-v2' });
      expect(c.system).toBe(slice.system);
    }
    expect(informUsed).toHaveBeenCalledTimes(3);
    expect(Object.keys(r.output!.doc.areas).sort()).toEqual([...ORACLE_V2_AREAS].sort());
    expect(r.output!.doc.validUntil).toBe('2027-02-20');
    expect(r.output!.patterns).toEqual([expect.objectContaining({ areaId: 'stuck', since: '2025-03-29', until: '2027-06-03', evidence: ['risk:r1', 'planet:D1.Sa'] })]);
    expect(r.calls.map((c) => c.call)).toEqual(['oracle.a', 'oracle.b', 'oracle.c']);
    expect(r.calls.every((c) => c.cachedTokens === 4000 && c.status === 'ok')).toBe(true);
  });

  it('keeps claim: keys through the validator (the claim-id drop of docs/TODOS.md is fixed on the v2 path)', async () => {
    const { ctx, slice } = setup();
    const r = await runOracleV2({ prisma: makePrisma().prisma, callGemini: makeGemini([]), informUsed: vi.fn(), maxSpendUsd: 1 }, ctx, slice);
    expect((r.output!.doc.areas as Record<string, { evidence: string[] }>).stuck!.evidence).toEqual(expect.arrayContaining(['claim:stuck.main', 'claim:stuck.work_load', 'risk:r1']));
    expect(claimKeysOf(r.output!)).toEqual(expect.arrayContaining(['claim:diagnosis.main', 'claim:stuck.work_load']));
  });

  it('drops keys and dates that are not in the input, and a date outside every window', () => {
    const { ctx, slice } = setup();
    const frame = storedWindowsOf(ctx);
    const pv = validatePatterns(
      [
        { areaId: 'mind', behaviour: 'b', mechanism: 'm', since: '1999-01-01', until: '', evidence: ['planet:D1.Mo'] },
        { areaId: 'lagna', behaviour: 'b', mechanism: 'm', since: '', until: '', evidence: ['planet:D1.Mo'] },
        { areaId: 'stuck', behaviour: 'b', mechanism: 'm', since: '', until: '', evidence: ['planet:D1.XX'] },
      ],
      new Set(slice.keys),
      frame,
    );
    expect(pv.patterns).toEqual([{ areaId: 'mind', behaviour: 'b', mechanism: 'm', since: null, until: null, evidence: ['planet:D1.Mo'] }]);
    expect(pv.gaps.join(' ')).toMatch(/1999-01-01/);
  });

  it('merges: areas concatenated, the earliest day as validUntil, a failed call left out', () => {
    const m = mergeOracleCalls([
      { areas: [oracleArea('diagnosis')], validUntil: '2027-05-01', patterns: [] },
      null,
      { areas: [oracleArea('body')], validUntil: '2027-02-20', patterns: [{ x: 1 }] },
    ]);
    expect(m.areas).toHaveLength(2);
    expect(m.validUntil).toBe('2027-02-20');
    expect(m.patterns).toHaveLength(1);
  });

  it('one call failing is partial, all failing is failed, a spend over the cap is budget_exceeded', async () => {
    const { ctx, slice } = setup();
    const deps = { prisma: makePrisma().prisma, informUsed: vi.fn(), maxSpendUsd: 1 };
    const partial = await runOracleV2({ ...deps, callGemini: makeGemini([], { failOracle: 'oracle.b' }) }, ctx, slice);
    expect(partial.status).toBe('partial');
    expect(Object.keys(partial.output!.doc.areas)).not.toContain('mind');
    expect(partial.gaps[0]).toMatch(/oracle\.b/);
    const failed = await runOracleV2({ ...deps, callGemini: async () => geminiResult('not json') }, ctx, slice);
    expect(failed.status).toBe('failed');
    expect(failed.output).toBeNull();
    const over = await runOracleV2({ ...deps, maxSpendUsd: 0.000001, callGemini: makeGemini([]) }, ctx, slice);
    expect(over.status).toBe('budget_exceeded');
    expect(over.output).toBeNull();
  });
});
