/**
 * A fresh You reading the person asked for (docs/billing/03) with SELF_V2_BUILD=1: the v2 build is forced under a new
 * store key, and the question held for it is committed only when the v2 build (the one the v2 page serves) is ok,
 * given back when it fails. No model runs: every build is a stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../../src/reading/self/service.js';
import { oracleStoreKey } from '../../../../../src/reading/self/v2/build.js';
import { selfBoardDates } from '../../../../../src/reading/self/synthesisValidity.js';

const NOW = new Date('2026-11-09T10:00:00Z');
const reading = (oracle = 'ok'): SelfReadingResult =>
  ({ status: 'ok', built_at: '2026-11-09', cached: false, reading: { asOf: '2026-11-09', panels: [], oracle: { status: oracle, cached: false } } }) as unknown as SelfReadingResult;
const prisma = () => ({ areaBuild: { findUnique: async () => null, upsert: async () => null } }) as never;

describe('self refresh with SELF_V2_BUILD=1', () => {
  const saved = { v2: process.env.SELF_V2_BUILD, model: process.env.SELF_READING_MODEL };
  beforeEach(() => {
    process.env.SELF_READING_MODEL = '1';
    process.env.SELF_V2_BUILD = '1';
  });
  afterEach(() => {
    for (const [k, v] of [['SELF_V2_BUILD', saved.v2], ['SELF_READING_MODEL', saved.model]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const run = (v2Status: string | Error, oracle = 'ok', refreshDay: string | null = '2026-11-09') => {
    const settleBoardRefresh = vi.fn(async () => undefined as never);
    const v2Build = vi.fn(async () => {
      if (v2Status instanceof Error) throw v2Status;
      return { status: v2Status };
    });
    return {
      settleBoardRefresh,
      v2Build,
      done: runSelfReadingBuild({ prisma: prisma(), build: async () => reading(oracle), now: () => NOW, gate: { settleBoardRefresh }, v2Build }, 'u1', 'k1', 'self', refreshDay ? { refreshDay } : {}),
    };
  };

  it('the v2 build is asked for a fresh reading of that day; the question is committed when it is ok', async () => {
    const r = run('ok');
    await r.done;
    expect(r.v2Build).toHaveBeenCalledWith(expect.anything(), 'u1', 'k1', '2026-11-09', { refreshDay: '2026-11-09' });
    expect(r.settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-09', true);
  });

  it('a v2 build that fails or throws gives the question back', async () => {
    for (const s of ['failed', 'budget_exceeded', 'preparing', new Error('boom')]) {
      const r = run(s);
      await r.done;
      expect(r.settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-09', false);
    }
  });

  it('a v1 synthesis that fails gives the question back even when the v2 build is ok', async () => {
    const r = run('ok', 'failed');
    await r.done;
    expect(r.settleBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-09', false);
  });

  it('a first reading (no refresh) is neither forced nor settled', async () => {
    const r = run('ok', 'ok', null);
    await r.done;
    expect(r.v2Build).toHaveBeenCalledWith(expect.anything(), 'u1', 'k1', '2026-11-09', {});
    expect(r.settleBoardRefresh).not.toHaveBeenCalled();
  });
});

describe('the v2 Oracle store key on a fresh reading', () => {
  const ctx = { stamps: { digestVersion: 'd1', clock: 'vimsottari', mainPeriod: 'a', subPeriod: 'b', subSubPeriod: 'c', skyWeek: 'w', year: 'y', confirmHash: 'h' } } as never;
  const slice = { prefixHash: 'pre' } as never;

  it('is unchanged without a refresh day, and gains |fresh=<day> with one (so the cards key changes too)', () => {
    const plain = oracleStoreKey(ctx, slice, 'in');
    expect(plain).not.toContain('fresh=');
    expect(oracleStoreKey(ctx, slice, 'in', '2026-11-09')).toBe(`${plain}|fresh=2026-11-09`);
    expect(oracleStoreKey(ctx, slice, 'in', 'not-a-day')).toBe(plain);
    // the clock filter the store reads with still matches
    expect(oracleStoreKey(ctx, slice, 'in', '2026-11-09')).toContain('|clock=vimsottari|');
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('selfBoardDates: one rule for the v1 board, the refresh route and GET /api/self/v2', () => {
  const synth = (row: any) => ({ techniqueOutput: { findFirst: async () => row } });
  const area = (row: any) => ({ areaBuild: { findFirst: async () => row } });

  it("the synthesis's own dates win", async () => {
    const p = { ...synth({ output: { status: 'ok', validUntil: { overall: '2026-11-08' } }, created_at: new Date('2026-10-20T09:00:00Z'), valid_to: null }), ...area(null) } as any;
    expect(await selfBoardDates(p, 'k1', '2026-11-09', { made_at: 'x', valid_until: '2027-01-01' })).toEqual({ made_at: '2026-10-20T09:00:00.000Z', valid_until: '2026-11-08', refresh_due: true });
  });

  it("without a synthesis: the area reading's dates the caller has, else the newest ready area build; null with neither", async () => {
    const p = { ...synth(null), ...area({ as_of: new Date('2026-11-01T00:00:00Z'), created_at: new Date('2026-11-01T08:00:00Z'), result: { validity: { made_at: '2026-11-01T08:00:00.000Z', valid_until: '2026-11-30' } } }) } as any;
    expect(await selfBoardDates(p, 'k1', '2026-11-09', { made_at: '2026-11-02T00:00:00.000Z', valid_until: '2026-11-05' })).toEqual({ made_at: '2026-11-02T00:00:00.000Z', valid_until: '2026-11-05', refresh_due: true });
    expect(await selfBoardDates(p, 'k1', '2026-11-09')).toEqual({ made_at: '2026-11-01T08:00:00.000Z', valid_until: '2026-11-30', refresh_due: false });
    expect(await selfBoardDates({ ...synth(null), ...area(null) } as any, 'k1', '2026-11-09')).toBeNull();
  });
});
