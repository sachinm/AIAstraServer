import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { handleKundliDigestEvent, parseKundliDigestEvent, runDigestSweep } from '../../../../src/reading/digest/event.js';
import { queueDigestBuild } from '../../../../src/reading/digest/event.js';
import { fakeDigestPrisma } from './helpers.js';

const TOKEN = 'digest-test-token';
const prev = process.env.KUNDLI_DIGEST_EVENT_TOKEN;

beforeEach(() => {
  process.env.KUNDLI_DIGEST_EVENT_TOKEN = TOKEN;
  resetAgentRegistryState();
});
afterEach(() => {
  if (prev === undefined) delete process.env.KUNDLI_DIGEST_EVENT_TOKEN;
  else process.env.KUNDLI_DIGEST_EVENT_TOKEN = prev;
});

describe('kundli-digest event token guard', () => {
  it('accepts the flat events and the EventBridge envelope with the token', () => {
    expect(parseKundliDigestEvent({ source: 'kundli-digest', kundliId: 'abc-1', token: TOKEN })).toEqual({ kind: 'one', kundliId: 'abc-1' });
    expect(parseKundliDigestEvent({ source: 'kundli-digest-sweep', token: TOKEN })).toEqual({ kind: 'sweep' });
    expect(parseKundliDigestEvent({ source: 'aiastra', 'detail-type': 'kundli-digest', detail: { kundliId: 'abc-1', token: TOKEN } })).toEqual({ kind: 'one', kundliId: 'abc-1' });
    expect(parseKundliDigestEvent({ detail: { task: 'kundli-digest-sweep', token: TOKEN } })).toEqual({ kind: 'sweep' });
  });

  it('refuses a wrong or missing token, a bad kundli id and other events', () => {
    expect(parseKundliDigestEvent({ source: 'kundli-digest', kundliId: 'abc-1', token: 'nope' })).toBeNull();
    expect(parseKundliDigestEvent({ source: 'kundli-digest', kundliId: 'abc-1' })).toBeNull();
    expect(parseKundliDigestEvent({ source: 'kundli-digest-sweep' })).toBeNull();
    expect(parseKundliDigestEvent({ source: 'kundli-digest', kundliId: "x'; drop", token: TOKEN })).toBeNull();
    expect(parseKundliDigestEvent({ source: 'aiastra', 'detail-type': 'kundli-sync', detail: { kundliId: 'abc', token: TOKEN } })).toBeNull();
    expect(parseKundliDigestEvent(null)).toBeNull();
  });

  it('refuses every event when KUNDLI_DIGEST_EVENT_TOKEN is unset', () => {
    delete process.env.KUNDLI_DIGEST_EVENT_TOKEN;
    expect(parseKundliDigestEvent({ source: 'kundli-digest', kundliId: 'abc-1', token: '' })).toBeNull();
    expect(parseKundliDigestEvent({ source: 'kundli-digest-sweep', token: TOKEN })).toBeNull();
  });
});

describe('handling', () => {
  const ok = { status: 'ready' as const, rows: 10, activation: 5, ms: 1 };
  const topUpOk = { wanted: 210, present: 200, requested: 10, fetched: 0, failed: 0, remaining: 10, backedOff: 0, yearsCompleted: [] as number[] };

  it('one kundli: tops up the annual set (capped) then builds, and logs both runs', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'k1' }] });
    const order: string[] = [];
    const out = await handleKundliDigestEvent({ kind: 'one', kundliId: 'k1' }, {
      prisma: f.prisma as never,
      topUp: async (_p, _id, max) => (order.push(`topUp:${max}`), topUpOk),
      build: async () => (order.push('build'), ok),
    });
    expect(order).toEqual(['topUp:40', 'build']);
    expect(out).toMatchObject({ kundliId: 'k1', build: ok });
    expect(f.calls.agentRuns).toBe(2);
  });

  it('the sweep builds candidates one after another, stops at the budget, and marks stale only after a top-up that completed a year', async () => {
    const f = fakeDigestPrisma({ kundlis: [{ id: 'r1', digest_status: 'ready' }] });
    let t = 0;
    const built: string[] = [];
    const res = await runDigestSweep({
      prisma: f.prisma as never,
      now: () => t,
      maxMs: 60_000,
      find: async () => ['a', 'b', 'c'],
      build: async (_p, id) => {
        built.push(id);
        t += 25_000;
        return ok;
      },
      topUpCandidates: async () => ['r1'],
      topUp: async () => ({ ...topUpOk, fetched: 3 }),
    });
    expect(built).toEqual(['a', 'b', 'c']);
    expect(res.stoppedForBudget).toBe(false);
    // 75 s used of 60: no time left for top-ups
    expect(res.topUps).toEqual([]);

    // rows fetched but no year completed: the digest stays ready (no rebuild per fetched row)
    t = 0;
    const res2 = await runDigestSweep({ prisma: f.prisma as never, now: () => t, maxMs: 60_000, find: async () => ['a'], build: async () => ok, topUpCandidates: async () => ['r1'], topUp: async () => ({ ...topUpOk, fetched: 3 }) });
    expect(res2.topUps).toEqual([{ kundliId: 'r1', fetched: 3, remaining: 10, yearsCompleted: [] }]);
    expect(f.kundlis.get('r1')!.digest_status).toBe('ready');

    // a year completed: stale, so the next sweep rebuilds it once
    t = 0;
    await runDigestSweep({ prisma: f.prisma as never, now: () => t, maxMs: 60_000, find: async () => [], build: async () => ok, topUpCandidates: async () => ['r1'], topUp: async () => ({ ...topUpOk, fetched: 3, yearsCompleted: [2027] }) });
    expect(f.kundlis.get('r1')!.digest_status).toBe('stale');

    t = 0;
    const res3 = await runDigestSweep({ prisma: f.prisma as never, now: () => t, maxMs: 30_000, find: async () => ['a', 'b'], build: async () => ((t += 31_000), ok), topUpCandidates: async () => [] });
    expect(res3.built).toHaveLength(1);
    expect(res3.stoppedForBudget).toBe(true);
  });

  it('the default candidate list: dossier ready, digest pending / stale / failed / old version / stuck building; failed last', async () => {
    const now = Date.parse('2026-11-06T12:00:00Z');
    const f = fakeDigestPrisma({
      kundlis: [
        { id: 'failed', digest_status: 'failed' },
        { id: 'pending', digest_status: 'pending' },
        { id: 'ready', digest_status: 'ready', digest_version: 'd1.2026-11-06' },
        { id: 'old', digest_status: 'ready', digest_version: 'd0' },
        { id: 'stuck', digest_status: 'building', digest_built_at: new Date(now - 30 * 60_000) },
        { id: 'busy', digest_status: 'building', digest_built_at: new Date(now - 60_000) },
        { id: 'nofacts', digest_status: 'pending', facts_status: 'pending' },
      ],
    });
    const built: string[] = [];
    await runDigestSweep({ prisma: f.prisma as never, now: () => now, build: async (_p, id) => (built.push(id), ok), topUpCandidates: async () => [] });
    expect(built).toEqual(['pending', 'old', 'stuck', 'failed']);
  });
});

describe('queueDigestBuild (the immediate trigger)', () => {
  it('marks a failed or stale digest pending, then starts it; at most once a minute per kundli per container', async () => {
    const prev = { fn: process.env.AWS_LAMBDA_FUNCTION_NAME };
    delete process.env.AWS_LAMBDA_FUNCTION_NAME; // off Lambda: built in process (here against a fake that fails quietly)
    try {
      const updates: unknown[] = [];
      const prisma = { kundli: { updateMany: async (a: unknown) => (updates.push(a), { count: 1 }) } } as never;
      expect(await queueDigestBuild(prisma, 'kq-1')).toBe('in_process');
      expect(updates[0]).toEqual({ where: { id: 'kq-1', digest_status: { in: ['failed', 'stale'] } }, data: { digest_status: 'pending' } });
      const seen = updates.length;
      expect(await queueDigestBuild(prisma, 'kq-1')).toBe('skipped');
      // the cooldown: the second call within a minute writes nothing of its own
      expect(updates.filter((u: any) => u?.data?.digest_status === 'pending' && u?.where?.id === 'kq-1').length).toBe(1);
      expect(updates.length).toBeGreaterThanOrEqual(seen);
    } finally {
      if (prev.fn !== undefined) process.env.AWS_LAMBDA_FUNCTION_NAME = prev.fn;
    }
  });

  it('on Lambda without the event token it starts nothing and leaves the kundli to the sweep', async () => {
    const prev = { fn: process.env.AWS_LAMBDA_FUNCTION_NAME, tok: process.env.KUNDLI_DIGEST_EVENT_TOKEN };
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    delete process.env.KUNDLI_DIGEST_EVENT_TOKEN;
    try {
      const prisma = { kundli: { updateMany: async () => ({ count: 0 }) } } as never;
      expect(await queueDigestBuild(prisma, 'kq-2')).toBe('skipped');
    } finally {
      if (prev.fn === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      else process.env.AWS_LAMBDA_FUNCTION_NAME = prev.fn;
      if (prev.tok !== undefined) process.env.KUNDLI_DIGEST_EVENT_TOKEN = prev.tok;
    }
  });
});
