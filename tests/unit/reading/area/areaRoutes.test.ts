import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerAreaRoutes } from '../../../../src/routes/areaRoutes.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { loadG1TimelineInputs } from '../../../helpers/readingFixtures.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const builds: any[] = [];
const facts = new Map<string, any>();
const checks: any[] = [];
const runs: any[] = [];
const prisma: any = {
  kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1' } : null) },
  areaBuild: {
    findUnique: async ({ where }: any) => builds.find((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of)) ?? null,
    upsert: async ({ create }: any) => {
      builds.push(create);
      return create;
    },
  },
  personFact: {
    findUnique: async ({ where }: any) => facts.get(`${where.user_id_key.user_id}:${where.user_id_key.key}`) ?? null,
    upsert: async ({ where, create, update }: any) => {
      const k = `${where.user_id_key.user_id}:${where.user_id_key.key}`;
      facts.set(k, { ...(facts.get(k) ?? create), ...update });
    },
  },
  areaCheck: {
    upsert: async ({ create }: any) => checks.push(create),
    findMany: async ({ where }: any) => checks.filter((c) => c.user_id === where.user_id),
  },
  agentRegistry: { upsert: async () => ({}) },
  agentRun: { create: async ({ data }: any) => runs.push(data) },
};
const loadInputs = vi.fn(async () => loadG1TimelineInputs());
let server: ReturnType<express.Express['listen']>;
let base = '';

beforeAll(async () => {
  resetAgentRegistryState();
  const app = express();
  app.use(express.json());
  expect(registerAreaRoutes(app, { prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), enabled: true, loadInputs, now: () => new Date('2026-10-24T12:00:00Z') })).toBe(true);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function call(method: string, path: string, user: string | null, body?: unknown) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  return { status: r.status, json: t ? (JSON.parse(t) as any) : null };
}

describe('area routes', () => {
  it('is not mounted when the flag is off', () => {
    expect(registerAreaRoutes(express(), { prisma, requireUser: fakeRequireUser(() => 'u1'), enabled: false })).toBe(false);
  });
  it('401 without a user, 404 without a kundli', async () => {
    expect((await call('GET', '/api/area/career', null)).status).toBe(401);
    expect((await call('GET', '/api/area/career', 'u2')).status).toBe(404);
  });
  it('builds once a day, then serves the stored build', async () => {
    const a = await call('GET', '/api/area/career', 'u1');
    expect(a.status).toBe(200);
    expect(a.json.cached).toBe(false);
    expect(a.json.map.present.tone).toBeTruthy();
    expect(a.json.work).toBeNull();
    const b = await call('GET', '/api/area/career', 'u1');
    expect(b.json.cached).toBe(true);
    expect(loadInputs).toHaveBeenCalledTimes(1);
    expect(runs.map((r) => r.agent_id)).toEqual(['area.career_inputs', 'area.career_map']);
    expect(runs.every((r) => r.module === 'area' && r.status === 'ok')).toBe(true);
  });
  it('work status: rejects an unknown value; once set, the map hides what does not fit', async () => {
    expect((await call('PUT', '/api/profile/work-status', 'u1', { value: 'astronaut' })).status).toBe(400);
    expect((await call('PUT', '/api/profile/work-status', 'u1', { value: 'own_business' })).status).toBe(204);
    const r = await call('GET', '/api/area/career', 'u1');
    expect(r.json.work).toBe('own_business');
    expect(r.json.map.ahead.some((w: any) => w.subarea === 'promotion' || w.subarea === 'job_security' || w.subarea === 'get_job')).toBe(false);
  });
  it('Looking-back answers are stored and returned', async () => {
    expect((await call('POST', '/api/area/career/checks', 'u1', { month: '2025-10', side: 'support', answer: 'yes' })).status).toBe(204);
    expect((await call('POST', '/api/area/career/checks', 'u1', { month: 'October', side: 'support', answer: 'yes' })).status).toBe(400);
    expect((await call('GET', '/api/area/career', 'u1')).json.checks).toEqual({ '2025-10': 'yes' });
  });
});
