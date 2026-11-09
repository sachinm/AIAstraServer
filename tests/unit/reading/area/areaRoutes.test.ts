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
    findFirst: async ({ where }: any) => builds.filter((b) => b.kundli_id === where.kundli_id && b.area === where.area && (b.status ?? 'ready') === where.status).sort((a, b) => iso(b.as_of).localeCompare(iso(a.as_of)))[0] ?? null,
    findUnique: async ({ where }: any) => builds.find((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of)) ?? null,
    upsert: async ({ create }: any) => {
      const i = builds.findIndex((b) => b.kundli_id === create.kundli_id && b.area === create.area && iso(b.as_of) === iso(create.as_of));
      if (i >= 0) builds.splice(i, 1);
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
const USAGE = { code: 'free', used: 1, limit: 20, remaining: 19 };
const gate = {
  reserveBoardRefresh: vi.fn(async (): Promise<any> => ({ ok: true, ticket: { id: 'q1', periodStart: null, userId: 'u1' } })),
  settleBoardRefresh: vi.fn(async () => undefined),
  getStatus: vi.fn(async () => USAGE as any),
};
let NOW = new Date('2026-10-24T12:00:00Z');
let server: ReturnType<express.Express['listen']>;
let base = '';

beforeAll(async () => {
  resetAgentRegistryState();
  const app = express();
  app.use(express.json());
  expect(registerAreaRoutes(app, { prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), enabled: true, loadInputs, now: () => NOW, gate })).toBe(true);
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
    // docs/billing/03: the first map is made free; opening it again serves it and costs nothing
    expect(a.json.usage).toBeUndefined();
    expect(a.json.refresh_due).toBe(false);
    const b = await call('GET', '/api/area/career', 'u1');
    expect(b.json.cached).toBe(true);
    expect(b.json.usage).toBeUndefined();
    // §10: when the reading was made and the last day it holds come back on both, the same on the stored one
    expect(typeof a.json.made_at).toBe('string');
    expect(a.json.valid_until === null || a.json.valid_until >= '2026-10-24').toBe(true);
    expect([b.json.made_at, b.json.valid_until]).toEqual([a.json.made_at, a.json.valid_until]);
    expect(b.json.map.validity).toBeUndefined();
    expect(gate.reserveBoardRefresh).not.toHaveBeenCalled();
    expect(loadInputs).toHaveBeenCalledTimes(1);
    expect(runs.map((r) => r.agent_id)).toEqual(['area.career_inputs', 'area.career_map']);
    expect(runs.every((r) => r.module === 'area' && r.status === 'ok')).toBe(true);
    // M29 tags (docs/admin/03): technique, category, board, kundli and the charts the inputs run read
    expect(runs.every((r) => r.technique_id === 'work.present_tone' && r.category === 'work' && r.board === 'work' && typeof r.kundli_id === 'string')).toBe(true);
    const charts = runs[0].charts_used as Array<{ type: string; variant?: string }>;
    expect(charts.length).toBeGreaterThan(0);
    expect(charts.some((c) => c.type.startsWith('dasha.'))).toBe(true);
    for (const c of charts.filter((x) => x.type === 'transit_contacts')) expect(c.variant).toMatch(/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/);
  });
  it('offline first: past "good until" the old map is still served; a fresh one only on request, one question (docs/billing/03)', async () => {
    const first = await call('GET', '/api/area/career', 'u1');
    const notDue = await call('POST', '/api/boards/work/refresh', 'u1');
    expect(notDue.status).toBe(409);
    expect(notDue.json).toMatchObject({ code: 'not_due', valid_until: first.json.valid_until });
    expect(gate.reserveBoardRefresh).not.toHaveBeenCalled();
    if (first.json.valid_until === null) return; // a map with no end is never due
    const builtTimes = loadInputs.mock.calls.length;
    NOW = new Date(`${first.json.valid_until}T12:00:00Z`);
    NOW.setUTCDate(NOW.getUTCDate() + 1);
    const later = await call('GET', '/api/area/career', 'u1');
    expect(later.json).toMatchObject({ cached: true, made_at: first.json.made_at, refresh_due: true });
    expect(loadInputs.mock.calls.length).toBe(builtTimes);

    gate.reserveBoardRefresh.mockResolvedValueOnce({ ok: false, usage: { ...USAGE, used: 20, remaining: 0 } });
    const full = await call('POST', '/api/boards/work/refresh', 'u1');
    expect(full.status).toBe(402);
    expect(full.json.code).toBe('quota_exhausted');
    expect(loadInputs.mock.calls.length).toBe(builtTimes);

    const fresh = await call('POST', '/api/boards/work/refresh', 'u1');
    expect(fresh.status).toBe(200);
    expect(fresh.json.usage).toEqual(USAGE);
    expect(fresh.json.map.present.tone).toBeTruthy();
    expect(gate.reserveBoardRefresh).toHaveBeenLastCalledWith('u1', 'work', NOW.toISOString().slice(0, 10));
    expect(gate.settleBoardRefresh).toHaveBeenLastCalledWith('u1', 'work', NOW.toISOString().slice(0, 10), true);
    expect(loadInputs.mock.calls.length).toBe(builtTimes + 1);
    const after = await call('GET', '/api/area/career', 'u1');
    expect(after.json.made_at).not.toBe(first.json.made_at);
    expect(after.json.refresh_due).toBe(false);
    NOW = new Date('2026-10-24T12:00:00Z');
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
