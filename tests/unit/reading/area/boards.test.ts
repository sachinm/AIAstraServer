import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerAreaRoutes } from '../../../../src/routes/areaRoutes.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { getSelfBoard, SELF_SPEC } from '../../../../src/reading/area/selfService.js';
import { getLoveBoard, LOVE_SPEC } from '../../../../src/reading/area/loveService.js';
import { shapeBoard, type BoardDeps } from '../../../../src/reading/area/boardService.js';
import { buildBoard, runningOn } from '../../../../src/reading/area/houseLayers.js';
import { LOVE, LOVE_FIT, loveFits, loveLead } from '../../../../src/reading/area/love.js';
import { SELF, selfLead } from '../../../../src/reading/area/self.js';
import { FACT_CATALOG } from '../../../../src/profile/facts.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { selfActivation, selfFixture } from '../../../helpers/fakeDigest.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);

function fakePrisma() {
  const builds: any[] = [];
  const facts = new Map<string, any>();
  const checks: any[] = [];
  const runs: any[] = [];
  const queued: string[] = [];
  const techniqueOutputs = new Map<string, any>();
  const prisma: any = {
    kundli: {
      findFirst: async ({ where }: any) => (where.user_id === 'u1' || where.user_id === 'u3' ? { id: where.user_id === 'u1' ? 'k1' : 'k3' } : null),
      updateMany: async ({ where }: any) => (queued.push(where.id), { count: 1 }),
    },
    areaBuild: {
      findUnique: async ({ where }: any) => builds.find((b) => b.kundli_id === where.kundli_id_area_as_of.kundli_id && b.area === where.kundli_id_area_as_of.area && iso(b.as_of) === iso(where.kundli_id_area_as_of.as_of)) ?? null,
      upsert: async ({ create }: any) => (builds.push(create), create),
    },
    personFact: {
      findUnique: async ({ where }: any) => facts.get(`${where.user_id_key.user_id}:${where.user_id_key.key}`) ?? null,
    },
    areaCheck: {
      upsert: async ({ create }: any) => checks.push(create),
      findMany: async ({ where }: any) => checks.filter((c) => c.user_id === where.user_id && c.area === where.area),
    },
    techniqueOutput: {
      findUnique: async ({ where }: any) => techniqueOutputs.get(where.cache_key) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const cur = techniqueOutputs.get(where.cache_key);
        const next = cur ? { ...cur, ...update } : { ...create, hit_count: 0, last_hit_at: null };
        techniqueOutputs.set(where.cache_key, next);
        return next;
      },
      updateMany: async ({ where, data }: any) => {
        const cur = techniqueOutputs.get(where.cache_key);
        if (!cur) return { count: 0 };
        cur.hit_count = (cur.hit_count ?? 0) + (data.hit_count?.increment ?? 0);
        if (data.last_hit_at) cur.last_hit_at = data.last_hit_at;
        return { count: 1 };
      },
    },
    agentRegistry: { upsert: async () => ({}) },
    agentRun: { create: async ({ data }: any) => runs.push(data) },
  };
  return { prisma, builds, facts, checks, runs, queued, techniqueOutputs };
}

const view = selfFixture();
const activation = selfActivation();
const NOW = new Date('2026-11-05T12:00:00Z');

function deps(db: ReturnType<typeof fakePrisma>, over: Partial<BoardDeps> = {}): BoardDeps {
  return {
    prisma: db.prisma,
    now: () => NOW,
    loadDigest: async (_p, id) => (id === 'k1' ? view : null),
    activationFor: async (_p, _id, q) => (q.from === q.to ? runningOn(activation, q.from) : activation),
    loadTransit: async () => null,
    ...over,
  };
}

beforeEach(() => resetAgentRegistryState());

describe('companion memory selects and filters (doc 48, doc 53 §4.5)', () => {
  it('love.status picks meet, health or reconcile, and hides what does not fit', () => {
    expect(loveLead('single')).toBe('meet');
    expect(loveLead('married')).toBe('health');
    expect(loveLead('separated')).toBe('reconcile');
    expect(loveLead(null)).toBeNull();
    expect(loveFits('meet', 'married')).toBe(false);
    expect(loveFits('meet', 'single')).toBe(true);
    expect(loveFits('reconcile', 'single')).toBe(false);
    expect(loveFits('friends', null)).toBe(true);
    expect(loveFits('romance', null)).toBe(false);
  });
  it('every love.status value of the fact catalogue has a fit row and a lead; every fit names a Love sub-area', () => {
    const ids = LOVE.subareas.map((s) => s.id);
    for (const v of FACT_CATALOG['love.status'] as readonly string[]) {
      expect(LOVE_FIT[v as keyof typeof LOVE_FIT], v).toBeDefined();
      expect(loveLead(v as never), v).toBeTruthy();
    }
    for (const list of Object.values(LOVE_FIT)) for (const s of list) expect(ids).toContain(s);
  });
  it('self.focus (comma list, first wins) picks the You lead', () => {
    expect(selfLead('learning')).toBe('growth');
    expect(selfLead('nope,spirituality')).toBe('purpose');
    expect(selfLead(null)).toBeNull();
    expect(selfLead('declined')).toBeNull();
    for (const s of Object.values({ a: selfLead('career'), b: selfLead('home') })) expect(SELF.subareas.map((x) => x.id)).toContain(s);
  });
  it('shapeBoard puts the lead first, and with no fact leads with the strongest sub-area ahead', () => {
    const built = buildBoard({ view, cfg: SELF, asOf: '2026-11-05', activation, running: runningOn(activation, '2026-11-05'), transit: null });
    const withFocus = shapeBoard(built, SELF_SPEC, 'learning');
    expect(withFocus.focus).toBe('growth');
    expect(withFocus.board.ahead[0]!.subarea).toBe('growth');
    const none = shapeBoard(built, SELF_SPEC, null);
    expect(none.focus).toBe(Object.entries(built.subareaScores).sort((a, b) => b[1] - a[1])[0]![0]);
    const love = buildBoard({ view, cfg: LOVE, asOf: '2026-11-05', activation, running: [], transit: null });
    const married = shapeBoard(love, LOVE_SPEC, 'married');
    expect(married.focus).toBe('health');
    expect(married.board.ahead.every((w) => LOVE_FIT.married.includes(w.subarea))).toBe(true);
    const declined = shapeBoard(love, LOVE_SPEC, 'declined');
    expect(declined.board.ahead.every((w) => w.subarea === 'friends')).toBe(true);
  });
});

describe('the board services', () => {
  it('no kundli', async () => {
    const db = fakePrisma();
    expect(await getSelfBoard(deps(db), 'u2')).toEqual({ status: 'no_kundli' });
  });
  it('preparing when the digest is not ready, and the digest is queued', async () => {
    const db = fakePrisma();
    const queueDigest = vi.fn(async () => undefined);
    expect(await getLoveBoard(deps(db, { queueDigest }), 'u3')).toEqual({ status: 'preparing' });
    expect(queueDigest).toHaveBeenCalledWith(db.prisma, 'k3');
    expect(db.builds).toHaveLength(0);
    // the default queue sets digest_status pending unless it is building, pending or ready
    await getLoveBoard(deps(db), 'u3');
    expect(db.queued).toEqual(['k3']);
  });
  it('builds once a day per area, tags the run, then serves the stored build', async () => {
    const db = fakePrisma();
    const activationFor = vi.fn(deps(db).activationFor!);
    const a = await getSelfBoard(deps(db, { activationFor }), 'u1');
    expect(a.status).toBe('ok');
    if (a.status !== 'ok') return;
    expect(a.cached).toBe(false);
    expect(a.ask).toBe(true);
    expect(a.board.tone.tone).toBe('open');
    const b = await getSelfBoard(deps(db, { activationFor }), 'u1');
    expect(b.status === 'ok' && b.cached).toBe(true);
    expect(activationFor).toHaveBeenCalledTimes(2); // the area's span and today's running periods, once
    expect(activationFor.mock.calls[0]![2]).toMatchObject({ houses: SELF.houses, maxLevel: 2 });
    const l = await getLoveBoard(deps(db), 'u1');
    expect(l.status === 'ok' && l.cached).toBe(false);
    expect(db.builds.map((x) => x.area)).toEqual(['self', 'love']);
    expect(db.runs.map((r) => r.agent_id)).toEqual(['area.self_board', 'area.love_board']);
    expect(db.runs[0].technique_id).toBe('self.activation');
    expect(db.runs[0].board).toBe('you');
    expect(db.runs[1].technique_id).toBe('love.activation');
    expect(db.runs.every((r) => r.kundli_id === 'k1' && r.status === 'ok')).toBe(true);
    const charts = db.runs[0].charts_used as Array<{ type: string }>;
    expect(charts.map((c) => c.type)).toEqual(expect.arrayContaining(['digest.house', 'digest.planet', 'digest.yoga', 'kundli_activation']));
    expect(charts.some((c) => c.type === 'transit_range')).toBe(false);
  });
  it('the person’s fact filters at read time without a rebuild', async () => {
    const db = fakePrisma();
    db.facts.set('u1:love.status', { value: 'single' });
    const single = await getLoveBoard(deps(db), 'u1');
    expect(single.status === 'ok' && single.focus).toBe('meet');
    expect(single.status === 'ok' && single.ask).toBe(false);
    db.facts.set('u1:love.status', { value: 'married' });
    const married = await getLoveBoard(deps(db), 'u1');
    if (married.status !== 'ok') throw new Error('not ok');
    expect(married.cached).toBe(true);
    expect(married.focus).toBe('health');
    expect(married.board.ahead.some((w) => w.subarea === 'meet')).toBe(false);
  });
  it('reuses technique_outputs across days inside the dasha validity window when area_builds misses', async () => {
    const db = fakePrisma();
    const activationFor = vi.fn(deps(db).activationFor!);
    const day1 = await getSelfBoard(deps(db, { activationFor, now: () => new Date('2026-11-05T12:00:00Z') }), 'u1');
    expect(day1.status).toBe('ok');
    expect(activationFor).toHaveBeenCalledTimes(2);
    expect(db.techniqueOutputs.size).toBe(1);

    // Next day (2026-11-06): area_builds misses for the new as_of date, but technique_outputs hits within the dasha window!
    const day2 = await getSelfBoard(deps(db, { activationFor, now: () => new Date('2026-11-06T12:00:00Z') }), 'u1');
    expect(day2.status).toBe('ok');
    if (day2.status !== 'ok') return;
    expect(day2.cached).toBe(true);
    expect(activationFor).toHaveBeenCalledTimes(2); // skipped activationFor & buildBoard!
    const cachedRun = db.runs.find((r) => r.status === 'cached');
    expect(cachedRun).toBeDefined();
    expect(cachedRun.technique_id).toBe('self.activation');
    expect((cachedRun.charts_used as Array<{ type: string }>).length).toBeGreaterThan(0);
  });
});

describe('area routes for You and Love', () => {
  const db = fakePrisma();
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  beforeAll(async () => {
    resetAgentRegistryState();
    const app = express();
    app.use(express.json());
    const d = deps(db);
    registerAreaRoutes(app, { prisma: db.prisma, requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null), enabled: true, now: () => NOW, boards: { loadDigest: d.loadDigest, activationFor: d.activationFor, loadTransit: d.loadTransit, queueDigest: async () => undefined } });
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

  it('flag off: the routes are not mounted (404)', async () => {
    const app = express();
    expect(registerAreaRoutes(app, { prisma: db.prisma, requireUser: fakeRequireUser(() => 'u1'), enabled: false })).toBe(false);
    const s = app.listen(0);
    await new Promise((r) => s.once('listening', r));
    const r = await fetch(`http://127.0.0.1:${(s.address() as { port: number }).port}/api/area/self`);
    expect(r.status).toBe(404);
    await new Promise<void>((r2) => s.close(() => r2()));
  });
  it('401 without a user; 404 no_kundli; 202 preparing', async () => {
    expect((await call('GET', '/api/area/self', null)).status).toBe(401);
    const nk = await call('GET', '/api/area/love', 'u2');
    expect(nk.status).toBe(404);
    expect(nk.json.status).toBe('no_kundli');
    const prep = await call('GET', '/api/area/self', 'u3');
    expect(prep.status).toBe(202);
    expect(prep.json).toEqual({ status: 'preparing' });
  });
  it('200 ok with the doc 54 §3 shape and the Looking-back answers', async () => {
    for (const area of ['self', 'love']) {
      const r = await call('GET', `/api/area/${area}`, 'u1');
      expect(r.status).toBe(200);
      expect(r.json.status).toBe('ok');
      const expectedKeys =
        area === 'self'
          ? ['ahead', 'asOf', 'back', 'characterArc', 'notes', 'personalityAndJoy', 'pressures', 'supports', 'tone', 'year']
          : ['ahead', 'asOf', 'back', 'notes', 'pressures', 'supports', 'tone', 'year'];
      expect(Object.keys(r.json.board).sort()).toEqual(expectedKeys);
      expect(['demanding', 'easing', 'steady', 'closing', 'open']).toContain(r.json.board.tone.tone);
      expect(r.json.checks).toEqual({});
    }
  });
  it('POST /api/area/:area/checks for self and love; an unknown area is 404', async () => {
    expect((await call('POST', '/api/area/self/checks', 'u1', { month: '2026-03', side: 'test', answer: 'yes' })).status).toBe(204);
    expect((await call('POST', '/api/area/love/checks', 'u1', { month: '2026-04', side: 'support', answer: 'partly' })).status).toBe(204);
    expect((await call('POST', '/api/area/love/checks', 'u1', { month: 'x', side: 'support', answer: 'partly' })).status).toBe(400);
    expect((await call('POST', '/api/area/money/checks', 'u1', { month: '2026-04', side: 'support', answer: 'yes' })).status).toBe(404);
    expect(db.checks.map((c) => c.area)).toEqual(['self', 'love']);
    expect((await call('GET', '/api/area/self', 'u1')).json.checks).toEqual({ '2026-03': 'yes' });
  });
});
