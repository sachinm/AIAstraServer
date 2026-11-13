/**
 * GET /api/self/v3 reads each stored row once (TODOS 2026-11-12): the engine's `dasha.applicable` row (the clock's two
 * default readers share it) and the newest `self.v2.oracle` row (the refresh block takes the row the board read holds).
 * The default readers run over a fake Prisma that counts every call.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getSelfV3 } from '../../../../../src/reading/self/v3/service.js';
import { APPLICABLE_RAW, PRESENT, latestFixture } from '../v2api/fixtures.js';

const NOW = new Date('2026-11-09T12:00:00Z');
const MADE = new Date('2026-11-09T10:00:00Z');
const ENV_KEYS = ['SELF_V2_BUILD', 'SELF_READING_MODEL', 'BOARD_MODEL_LAYER'] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) saved[k] = process.env[k];
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function countingPrisma() {
  const calls: string[] = [];
  const rec = (op: string, key?: string) => calls.push(key ? `${op}:${key}` : op);
  const fixture = latestFixture();
  const oracle = { ...fixture.oracle!, doc: { ...fixture.oracle!.doc, validUntil: '2027-01-01' } };
  const prisma: any = {
    kundli: {
      findFirst: async () => {
        rec('kundli.findFirst');
        return { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' };
      },
    },
    kundliActivation: {
      groupBy: async () => {
        rec('kundliActivation.groupBy');
        return PRESENT.map((p) => ({ system: p.system, family: p.family }));
      },
    },
    kundliData: {
      findFirst: async ({ where }: any) => {
        rec('kundliData.findFirst', where.data_type);
        return where.data_type === 'dasha.applicable' ? { payload: APPLICABLE_RAW } : null;
      },
    },
    techniqueOutput: {
      findFirst: async ({ where }: any) => {
        rec('techniqueOutput.findFirst', where.technique_id);
        if (where.technique_id === 'self.v2.oracle') return { output: { key: 'o1', result: { status: 'ok', output: oracle }, briefs: [] }, created_at: MADE, valid_to: null };
        if (where.technique_id === 'self.v2.personalizer') return { output: { key: 'c1', oracleKey: 'o1', result: { doc: fixture.cards } }, created_at: MADE, valid_to: null };
        return null;
      },
    },
    areaBuild: { findFirst: async () => null, findUnique: async () => null, upsert: async ({ create }: any) => create },
    boardLayout: {
      findUnique: async () => {
        rec('boardLayout.findUnique');
        return null;
      },
    },
    auth: { findUnique: async () => ({ date_of_birth: '1985-03-01', gender: null, role: 'novice' }) },
    personFact: { findMany: async () => [], upsert: async ({ create }: any) => create },
  };
  return { prisma, calls };
}

const depsFor = (prisma: any, queued: string[] = []) => ({
  prisma,
  now: () => NOW,
  cardsRead: false,
  readV3Cards: async () => null,
  queueBuild: async (_p: unknown, _u: string, k: string) => {
    queued.push(k);
    return 'invoked' as const;
  },
  queueDigest: async () => undefined,
  progressMarkers: async () => ({ queue: { state: 'none' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } }),
  buildMarker: async () => 'none' as const,
});

const count = (calls: string[], what: string) => calls.filter((c) => c === what).length;

describe('GET /api/self/v3 reads each stored row once', () => {
  it('v2 owns the board: `dasha.applicable` and the newest `self.v2.oracle` row are each read once, and the refresh dates come from that row', async () => {
    process.env.SELF_V2_BUILD = '1';
    process.env.SELF_READING_MODEL = '1';
    const { prisma, calls } = countingPrisma();
    const { body } = await getSelfV3(depsFor(prisma), 'u1');
    expect(count(calls, 'kundliData.findFirst:dasha.applicable')).toBe(1);
    expect(count(calls, 'techniqueOutput.findFirst:self.v2.oracle')).toBe(1);
    expect(count(calls, 'techniqueOutput.findFirst:self.v2.personalizer')).toBe(1);
    // the clock still reads the shared row: the conditional system that applies is the board clock
    expect(body.clock.system).toBe('chathuraaseethi_sama');
    // the refresh block was made from the held Oracle row
    expect(body.refresh).toMatchObject({ madeAt: MADE.toISOString(), validUntil: '2027-01-01', due: false });
  });

  it('with the model off the refresh block reads its own rows, and `dasha.applicable` is still read once', async () => {
    process.env.SELF_V2_BUILD = '0';
    process.env.SELF_READING_MODEL = '0';
    const { prisma, calls } = countingPrisma();
    await getSelfV3(depsFor(prisma), 'u1');
    expect(count(calls, 'kundliData.findFirst:dasha.applicable')).toBe(1);
    expect(count(calls, 'techniqueOutput.findFirst:self.v2.oracle')).toBe(1);
  });

  it('a build stored for no clock leaves the refresh block to read for itself (nothing held)', async () => {
    process.env.SELF_V2_BUILD = '1';
    process.env.SELF_READING_MODEL = '1';
    const { prisma, calls } = countingPrisma();
    const find = prisma.techniqueOutput.findFirst;
    // the board clock has no stored Oracle row; an older one (another clock) is the newest overall
    prisma.techniqueOutput.findFirst = async (q: any) => {
      const clockKey = q.where.digest_version?.contains;
      if (q.where.technique_id === 'self.v2.oracle' && clockKey) {
        calls.push('techniqueOutput.findFirst:self.v2.oracle');
        return null;
      }
      return find(q);
    };
    const { body } = await getSelfV3(depsFor(prisma), 'u1');
    expect(body.refresh.validUntil).toBe('2027-01-01');
    // one read for the board's clock, one for the refresh block's newest-on-any-clock row
    expect(count(calls, 'techniqueOutput.findFirst:self.v2.oracle')).toBe(2);
  });
});
