import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerLifeReadingRoutes } from '../../../../src/routes/lifeReadingRoutes.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import type { DigestStatus } from '../../../../src/reading/digest/types.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { makeView, row } from './fixture.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const builds: any[] = [];
const runs: any[] = [];
const kundliUpdates: any[] = [];
const statuses: Record<string, DigestStatus> = { k1: 'ready', k3: 'pending', k4: 'building', k5: 'failed' };
const users: Record<string, string> = { u1: 'k1', u3: 'k3', u4: 'k4', u5: 'k5' };
const prisma: any = {
  kundli: {
    findFirst: async ({ where }: any) => (users[where.user_id] ? { id: users[where.user_id] } : null),
    update: async (q: any) => kundliUpdates.push(q),
  },
  areaBuild: {
    findUnique: async ({ where }: any) => builds.find((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && b.area === where.kundli_id_area_as_of.area && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of)) ?? null,
    upsert: async ({ create }: any) => {
      builds.push(create);
      return create;
    },
  },
  personFact: { findMany: async () => [{ key: 'work.status', value: 'yes' }] },
  agentRegistry: { upsert: async () => ({}) },
  agentRun: { create: async ({ data }: any) => runs.push(data) },
};

const view = makeView({ tone: 'strong', planets: { D1: { Ra: { functional: 'malefic', dignity: 'debilitated' } } } });
const rows = [
  row('vimshottari', 'vimshottari', '2026-01-14', '2027-02-07', [10, 5], 'Ra', { parentLord: 'Mo' }),
  row('vimshottari', 'vimshottari', '2027-02-07', '2027-09-15', [10, 2], 'Sa', { parentLord: 'Mo' }),
  row('yogini', 'yogini', '2027-01-01', '2027-08-01', [10, 2], 'Ju'),
];
const loadDigest = vi.fn(async () => view);
const activationFor = vi.fn(async () => rows);
let server: ReturnType<express.Express['listen']>;
let base = '';

beforeAll(async () => {
  resetAgentRegistryState();
  const app = express();
  expect(
    registerLifeReadingRoutes(app, {
      prisma,
      requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null),
      enabled: true,
      now: () => new Date('2026-11-05T12:00:00Z'),
      digestStatusOf: async (id) => ({ status: statuses[id] ?? 'pending', version: 'd1.test' }),
      loadDigest,
      activationFor,
      loadSky: async () => null,
    }),
  ).toBe(true);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  kundliUpdates.length = 0;
});

async function get(user: string | null) {
  const r = await fetch(`${base}/api/life-reading`, { headers: user ? { 'x-user': user } : {} });
  const t = await r.text();
  return { status: r.status, json: t ? (JSON.parse(t) as any) : null };
}

describe('GET /api/life-reading', () => {
  it('is not mounted when LIFE_READING_ENABLED is off (404)', async () => {
    const app = express();
    expect(registerLifeReadingRoutes(app, { prisma, requireUser: fakeRequireUser(() => 'u1'), enabled: false })).toBe(false);
    const s = app.listen(0);
    await new Promise((r) => s.once('listening', r));
    const r = await fetch(`http://127.0.0.1:${(s.address() as { port: number }).port}/api/life-reading`);
    await new Promise<void>((res) => s.close(() => res()));
    expect(r.status).toBe(404);
  });

  it('401 without a user; no_kundli without a chart', async () => {
    expect((await get(null)).status).toBe(401);
    const r = await get('u2');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ status: 'no_kundli' });
  });

  it('preparing while the digest is not ready, and queues it unless it is queued or building', async () => {
    const pending = await get('u3');
    expect(pending.status).toBe(202);
    expect(pending.json).toEqual({ status: 'preparing' });
    expect(kundliUpdates).toEqual([]);
    expect((await get('u4')).json).toEqual({ status: 'preparing' });
    expect(kundliUpdates).toEqual([]);
    expect((await get('u5')).json).toEqual({ status: 'preparing' });
    expect(kundliUpdates).toEqual([{ where: { id: 'k5' }, data: { digest_status: 'pending' } }]);
    expect(loadDigest).not.toHaveBeenCalled();
  });

  it('builds once a day from the digest, tags the run, then serves the stored build', async () => {
    const a = await get('u1');
    expect(a.status).toBe(200);
    expect(a.json.status).toBe('ok');
    expect(a.json.cached).toBe(false);
    expect(a.json.built_at).toBe('2026-11-05');
    expect(a.json.rule_now).toContain('Until 7 Feb 2027');
    expect(a.json.charter).toBeTruthy();
    expect(a.json.charter.antardashas).toHaveLength(2);
    expect(a.json.charter.evidence.md).toBe('Moon');
    const work = a.json.areas.find((x: any) => x.id === 'work');
    expect(work.issue).toMatch(/Has work felt harder to move lately\?$/); // work.status = yes from the stored facts
    expect(work.improves).toHaveLength(1);
    expect(activationFor).toHaveBeenCalledWith('k1', { from: '2026-11-05', to: '2056-11-05', houses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxLevel: 2 });
    const run = runs.find((r) => r.agent_id === 'life.dashboard');
    expect(run.technique_id).toBe('life.dashboard');
    expect(run.kundli_id).toBe('k1');
    expect(run.charts_used.map((c: any) => c.type)).toEqual(['kundli_digest', 'kundli_activation']);
    expect(builds.find((b) => b.area === 'life' && b.kundli_id === 'k1')).toBeTruthy();

    const b = await get('u1');
    expect(b.json.cached).toBe(true);
    expect(b.json.areas).toEqual(a.json.areas);
    expect(b.json.charter).toEqual(a.json.charter);
    expect(loadDigest).toHaveBeenCalledTimes(1);
  });
});
