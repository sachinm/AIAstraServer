/**
 * POST /api/boards/self/refresh with SELF_BOARD_FROM_CARDS=1 (plan "retire the v2 Self reading" step 2): the charge keys
 * on "a Self card was read". No card read: the board's first reading, free, queued with no question held (202 `first`).
 * A card read but its Good until not passed: 409 not_due, nothing held. Due: one question held and the build queued with
 * the refresh day. The card dates (`selfBoardDates`) are faked here; `selfCardDates` has its own test. Fakes only.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerAreaRoutes } from '../../../../src/routes/areaRoutes.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { runningOn } from '../../../../src/reading/area/houseLayers.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { selfActivation, selfFixture } from '../../../helpers/fakeDigest.js';

const dates = vi.hoisted(() => ({ value: null as null | { made_at: string; valid_until: string | null; refresh_due: boolean } }));
vi.mock('../../../../src/reading/self/synthesisValidity.js', async (orig) => ({
  ...(await orig<typeof import('../../../../src/reading/self/synthesisValidity.js')>()),
  selfBoardDates: async () => dates.value,
}));
vi.mock('../../../../src/reading/digest/event.js', async (orig) => ({ ...(await orig<typeof import('../../../../src/reading/digest/event.js')>()), queueDigestBuild: async () => 'skipped' as const }));

const iso = (d: Date) => d.toISOString().slice(0, 10);
const NOW = new Date('2026-11-19T12:00:00Z');

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const builds: any[] = [];
  const outputs = new Map<string, any>();
  const prisma: any = {
    kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1' } : null), updateMany: async () => ({ count: 1 }) },
    areaBuild: {
      findFirst: async ({ where }: any) => builds.filter((b) => b.kundli_id === where.kundli_id && b.area === where.area && (b.status ?? 'ready') === where.status)[0] ?? null,
      findUnique: async ({ where }: any) => builds.find((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && b.area === where.kundli_id_area_as_of.area && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of)) ?? null,
      upsert: async ({ create, update, where }: any) => {
        const i = builds.findIndex((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && b.area === where.kundli_id_area_as_of.area && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of));
        if (i >= 0) builds[i] = { ...builds[i], ...update };
        else builds.push(create);
        return create;
      },
    },
    personFact: { findUnique: async () => null },
    areaCheck: { upsert: async () => ({}), findMany: async () => [] },
    techniqueOutput: {
      findUnique: async ({ where }: any) => outputs.get(where.cache_key) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const next = outputs.has(where.cache_key) ? { ...outputs.get(where.cache_key), ...update } : { ...create, hit_count: 0, last_hit_at: null };
        outputs.set(where.cache_key, next);
        return next;
      },
      updateMany: async () => ({ count: 1 }),
    },
    agentRegistry: { upsert: async () => ({}) },
    agentRun: { create: async () => ({}) },
  };
  return { prisma, builds };
}

describe('POST /api/boards/self/refresh with SELF_BOARD_FROM_CARDS=1', () => {
  const saved = process.env.SELF_BOARD_FROM_CARDS;
  const db = fakePrisma();
  const view = selfFixture();
  const activation = selfActivation();
  const gate = {
    reserveBoardRefresh: vi.fn(async () => ({ ok: true as const, ticket: { id: 'q1', periodStart: null, userId: 'u1' } })),
    settleBoardRefresh: vi.fn(async () => undefined),
    getStatus: vi.fn(async () => ({ code: 'free', used: 1, limit: 20, remaining: 19 }) as any),
  };
  const invoked: Array<Record<string, unknown>> = [];
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  beforeAll(async () => {
    process.env.SELF_BOARD_FROM_CARDS = '1';
    resetAgentRegistryState();
    const app = express();
    app.use(express.json());
    registerAreaRoutes(app, {
      prisma: db.prisma,
      requireUser: fakeRequireUser(() => 'u1'),
      enabled: true,
      now: () => NOW,
      boards: { loadDigest: async (_p, id) => (id === 'k1' ? view : null), activationFor: async (_p, _id, q) => (q.from === q.to ? runningOn(activation, q.from) : activation), loadTransit: async () => null, queueDigest: async () => undefined },
      gate,
      queue: { invoke: async (payload) => void invoked.push(payload) },
    });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.SELF_BOARD_FROM_CARDS;
    else process.env.SELF_BOARD_FROM_CARDS = saved;
    return new Promise<void>((r) => server.close(() => r()));
  });
  beforeEach(() => {
    invoked.length = 0;
    db.builds.length = 0;
    gate.reserveBoardRefresh.mockClear();
    gate.settleBoardRefresh.mockClear();
  });
  afterEach(() => {
    dates.value = null;
  });
  const post = async () => {
    const r = await fetch(`${base}/api/boards/self/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' } });
    return { status: r.status, json: (await r.json()) as any };
  };

  it('no Self card read: the first reading is queued free, no question held', async () => {
    dates.value = null;
    const r = await post();
    expect(r.status).toBe(202);
    expect(r.json).toMatchObject({ status: 'building', first: true, charged: false });
    expect(gate.reserveBoardRefresh).not.toHaveBeenCalled();
    expect(gate.settleBoardRefresh).not.toHaveBeenCalled();
    expect(invoked).toHaveLength(1);
    expect(invoked[0]!.refreshDay).toBeUndefined();
  });

  it('a card read, its Good until not passed: 409 not_due, nothing held, nothing queued', async () => {
    dates.value = { made_at: '2026-11-18T09:00:00.000Z', valid_until: '2026-11-30', refresh_due: false };
    const r = await post();
    expect(r.status).toBe(409);
    expect(r.json).toMatchObject({ code: 'not_due', valid_until: '2026-11-30' });
    expect(gate.reserveBoardRefresh).not.toHaveBeenCalled();
    expect(invoked).toHaveLength(0);
  });

  it('due: one question held and the build queued for that refresh day', async () => {
    dates.value = { made_at: '2026-10-01T09:00:00.000Z', valid_until: '2026-10-31', refresh_due: true };
    const r = await post();
    expect(r.status).toBe(202);
    expect(gate.reserveBoardRefresh).toHaveBeenCalledWith('u1', 'self', '2026-11-19');
    expect(invoked).toHaveLength(1);
    expect(invoked[0]!.refreshDay).toBe('2026-11-19');
  });
});
