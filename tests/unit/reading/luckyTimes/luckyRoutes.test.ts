import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerLuckyRoutes } from '../../../../src/routes/luckyRoutes.js';
import { clampRange } from '../../../../src/reading/luckyTimes/service.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { fakeLuckyPrisma } from '../../../helpers/fakeLuckyPrisma.js';

const db = fakeLuckyPrisma();
const engine = vi.fn(async (_type: string, fields: Record<string, any>) => {
  // the engine for Oct 2026 at San Jose: one plain day per date, no windows needed for the test
  const days = [];
  for (let d = new Date(`${fields.params.from}T00:00:00Z`); d <= new Date(`${fields.params.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({ date: d.toISOString().slice(0, 10), weekday: 'Monday', sunrise: '07:30:00', sunset: '18:20:00', horas: [], muhurtas: [] });
  }
  return { days };
});
const NOW = new Date('2026-11-05T19:30:00Z'); // 11:30 in San Jose
let server: ReturnType<express.Express['listen']>;
let base = '';

beforeAll(async () => {
  resetAgentRegistryState();
  const app = express();
  app.use(express.json());
  registerLuckyRoutes(app, { prisma: db.prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), enabled: true, engine, now: () => NOW });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function call(method: string, path: string, user: string | null, body?: unknown) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  return { status: r.status, json: text ? (JSON.parse(text) as any) : null };
}

describe('range clamp', () => {
  it('keeps the range inside today −7 … +14', () => {
    expect(clampRange('2026-11-05')).toEqual({ from: '2026-10-29', to: '2026-11-19' });
    expect(clampRange('2026-11-05', '2026-01-01', '2027-01-01')).toEqual({ from: '2026-10-29', to: '2026-11-19' });
    expect(clampRange('2026-11-05', '2026-11-10', '2026-11-12')).toEqual({ from: '2026-11-10', to: '2026-11-12' });
  });
});

describe('lucky routes', () => {
  it('needs a signed-in user', async () => {
    expect((await call('GET', '/api/lucky/setup', null)).status).toBe(401);
  });

  it('is not mounted when the flag is off', async () => {
    const app = express();
    registerLuckyRoutes(app, { prisma: db.prisma, requireUser: fakeRequireUser(() => 'u1'), enabled: false });
    const s = app.listen(0);
    await new Promise((r) => s.once('listening', r));
    const r = await fetch(`http://127.0.0.1:${(s.address() as { port: number }).port}/api/lucky/setup`);
    expect(r.status).toBe(404);
    await new Promise<void>((r2) => s.close(() => r2()));
  });

  it('setup lists the 13 v1 scenarios by area, no place and no picks at first', async () => {
    const r = await call('GET', '/api/lucky/setup', 'u1');
    expect(r.status).toBe(200);
    expect(r.json.place).toBeNull();
    expect(r.json.picks).toEqual([]);
    expect(r.json.scenarios.flatMap((a: any) => a.scenarios)).toHaveLength(13);
  });

  it('range asks for a place first', async () => {
    expect((await call('GET', '/api/lucky/range', 'u1')).status).toBe(409);
  });

  it('place: rejects unknown, accepts a preset, and shows it in setup', async () => {
    expect((await call('PUT', '/api/lucky/place', 'u1', { place: 'atlantis' })).status).toBe(400);
    expect((await call('PUT', '/api/lucky/place', 'u1', { place: 'sanjose' })).status).toBe(204);
    expect((await call('GET', '/api/lucky/setup', 'u1')).json.place).toBe('sanjose');
  });

  it('picks: add, reject unknown and duplicates, hide, answer, remove', async () => {
    expect((await call('POST', '/api/lucky/picks', 'u1', { scenario: 'work.launch' })).status).toBe(400);
    expect((await call('POST', '/api/lucky/picks', 'u1', { scenario: 'work.sign_contract' })).status).toBe(201);
    expect((await call('POST', '/api/lucky/picks', 'u1', { scenario: 'work.sign_contract' })).status).toBe(409);
    expect((await call('POST', '/api/lucky/picks', 'u1', { scenario: 'work.hard_talk_boss' })).status).toBe(201);
    const a = await call('PATCH', '/api/lucky/picks/work.hard_talk_boss', 'u1', { answers: { who: 'boss', junk: 'x' } });
    expect(a.json.pick.answers).toEqual({ who: 'boss' });
    expect((await call('PATCH', '/api/lucky/picks/work.hard_talk_boss', 'u1', { shown: false })).json.pick.shown).toBe(false);
    expect((await call('PATCH', '/api/lucky/picks/nope', 'u1', { shown: false })).status).toBe(404);
    expect((await call('GET', '/api/lucky/setup', 'u1')).json.picks.map((p: any) => p.scenario)).toEqual(['work.sign_contract', 'work.hard_talk_boss']);
  });

  it('range: three weeks, layers only for shown picks, avoid bands, the missing days pulled by the agent', async () => {
    const r = await call('GET', '/api/lucky/range', 'u1');
    expect(r.status).toBe(200);
    expect(r.json.today).toBe('2026-11-05');
    expect(r.json.from).toBe('2026-10-29');
    expect(r.json.to).toBe('2026-11-19');
    expect(engine).toHaveBeenCalledTimes(1); // October pulled once
    expect(r.json.missing).toEqual([]);
    expect(r.json.days).toHaveLength(22);
    const thu = r.json.days.find((d: any) => d.date === '2026-11-05');
    expect(Object.keys(thu.layers)).toEqual(['work.sign_contract']); // the boss layer is hidden
    expect(thu.avoid.length).toBeGreaterThan(0);
    expect(r.json.now.kind).toBeDefined();
  });

  it('logs every agent run with module and timings, and registers the agents', async () => {
    const ids = db.runs.map((x: any) => x.agent_id);
    expect(ids).toEqual(expect.arrayContaining(['lucky.day_tables', 'lucky.scenario_windows']));
    for (const run of db.runs) {
      expect(run.module).toBe('lucky_times');
      expect(run.ms).toBeGreaterThanOrEqual(0);
      expect(run.status).toBe('ok');
    }
    expect([...db.registry.keys()]).toEqual(expect.arrayContaining(['reading.oracle', 'lucky.day_tables', 'lucky.day_overlay', 'lucky.scenario_windows']));
    expect(db.registry.get('reading.oracle')!.kind).toBe('llm');
    // M29 tags (docs/admin/03): the bands run, one run per shown scenario, the day tables pull; muhurta charts by month
    const techniques = db.runs.map((x: any) => x.technique_id);
    expect(techniques).toEqual(expect.arrayContaining(['lucky.day_tables', 'lucky.avoid_bands', 'lucky.work.sign_contract']));
    expect(techniques).not.toContain('lucky.work.hard_talk_boss'); // hidden pick: no layer, no run
    expect(db.runs.find((x: any) => x.technique_id === 'lucky.work.sign_contract')).toMatchObject({ category: 'work', board: 'lucky' });
    expect(db.runs.find((x: any) => x.technique_id === 'lucky.avoid_bands')).toMatchObject({ category: 'self', board: 'lucky' });
    for (const run of db.runs) for (const c of run.charts_used ?? []) expect(c).toMatchObject({ type: 'muhurta', variant: expect.stringMatching(/^\d{4}-\d{2}$/) });
  });

  it('remove a pick', async () => {
    expect((await call('DELETE', '/api/lucky/picks/work.sign_contract', 'u1')).status).toBe(204);
    expect((await call('DELETE', '/api/lucky/picks/work.sign_contract', 'u1')).status).toBe(404);
  });
});

describe('analytics events', () => {
  it('stores known events with clean props, drops unknown names and free text', async () => {
    const r = await call('POST', '/api/analytics/events', 'u1', {
      session: 's1',
      events: [
        { event: 'scenario_add', surface: 'lucky', target: 'work.sign_contract', props: { area: 'work', long: 'x'.repeat(200) } },
        { event: 'made_up', surface: 'lucky' },
        { event: 'view_select', surface: 'lucky', target: 'calendar' },
      ],
    });
    expect(r.status).toBe(204);
    expect(db.events.map((e: any) => e.event)).toEqual(['scenario_add', 'view_select']);
    expect(db.events[0].props).toEqual({ area: 'work' });
    expect(db.events[0].user_id).toBe('u1');
    expect(db.events[0].session_id).toBe('s1');
  });
  it('rejects more than 50 events', async () => {
    const events = Array.from({ length: 51 }, () => ({ event: 'page_view', surface: 'x' }));
    expect((await call('POST', '/api/analytics/events', 'u1', { events })).status).toBe(400);
  });
});
