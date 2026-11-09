import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../../src/reading/self/service.js';

const NOW = new Date('2026-11-09T10:00:00Z');
const reading = (): SelfReadingResult =>
  ({ status: 'ok', built_at: '2026-11-09', cached: false, reading: { asOf: '2026-11-09', panels: [], oracle: { status: 'ok', cached: false } } }) as unknown as SelfReadingResult;
const prisma = () => ({ areaBuild: { findUnique: async () => null, upsert: async () => null } }) as never;

describe('the self build event runs the v2 build behind SELF_V2_BUILD=1 (doc 66 §4.8)', () => {
  const saved = { v2: process.env.SELF_V2_BUILD, model: process.env.SELF_READING_MODEL };
  beforeEach(() => {
    process.env.SELF_READING_MODEL = '1';
  });
  afterEach(() => {
    for (const [k, v] of [['SELF_V2_BUILD', saved.v2], ['SELF_READING_MODEL', saved.model]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('off by default: the existing build only', async () => {
    delete process.env.SELF_V2_BUILD;
    const v2Build = vi.fn(async () => ({ status: 'ok' }));
    await runSelfReadingBuild({ prisma: prisma(), build: async () => reading(), now: () => NOW, gate: { chargeBoard: vi.fn(async () => 'charged' as const) }, v2Build }, 'u1', 'k1', 'self');
    expect(v2Build).not.toHaveBeenCalled();
  });

  it('on: runs after the self build with its day, never for love or work, and the charge stays one per board', async () => {
    process.env.SELF_V2_BUILD = '1';
    const order: string[] = [];
    const chargeBoard = vi.fn(async () => (order.push('charge'), 'charged' as const));
    const v2Build = vi.fn(async () => (order.push('v2'), { status: 'ok' }));
    const r = await runSelfReadingBuild({ prisma: prisma(), build: async () => (order.push('build'), reading()), now: () => NOW, gate: { chargeBoard }, v2Build }, 'u1', 'k1', 'self');
    expect(r?.status).toBe('ok');
    expect(order).toEqual(['build', 'charge', 'v2']);
    expect(v2Build).toHaveBeenCalledWith(expect.anything(), 'u1', 'k1', '2026-11-09');
    expect(chargeBoard).toHaveBeenCalledTimes(1);
    await runSelfReadingBuild({ prisma: prisma(), build: async () => reading(), now: () => NOW, gate: { chargeBoard }, v2Build }, 'u1', 'k1', 'love');
    expect(v2Build).toHaveBeenCalledTimes(1);
  });

  it('a v2 build that throws never fails the build event', async () => {
    process.env.SELF_V2_BUILD = '1';
    const r = await runSelfReadingBuild(
      { prisma: prisma(), build: async () => reading(), now: () => NOW, gate: { chargeBoard: vi.fn(async () => 'charged' as const) }, v2Build: async () => { throw new Error('boom'); } },
      'u1',
      'k1',
      'self',
    );
    expect(r?.status).toBe('ok');
  });
});
