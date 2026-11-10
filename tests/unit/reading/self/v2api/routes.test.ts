/**
 * Self board v2 routes (docs/reading-engine/66 §4.4, §4.5): GET maps the stored build, queues one build when nothing is
 * stored, serves only the caller's own data with no-store headers; PUT clock charges once per system per day, refuses
 * an inapplicable clock, writes preferred_dasha and a clock_viewed row; confirm and mood validate and store.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { QuestionGate } from '../../../../../src/billing/questionGate.js';
import { moodFor } from '../../../../../src/reading/person/profile.js';
import { queueSelfReadingBuild } from '../../../../../src/reading/self/buildEvent.js';
import { NOTHING_STORED, type SelfV2Latest } from '../../../../../src/reading/self/v2api/storeContract.js';
import { SELF_V2_CACHE_CONTROL, registerSelfV2Routes } from '../../../../../src/routes/selfV2Routes.js';
import { SELF_V2_AREAS } from '../../../../../src/reading/self/v2types.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';
import { APPLICABLE_RAW, PRESENT, latestFixture } from './fixtures.js';
import { MemoryPlanStore } from './memoryPlanStore.js';

const NOW = new Date('2026-11-09T12:00:00Z');
const ENV = { PLAN_FREE_QUESTIONS: '20', PLAN_PLUS_QUESTIONS: '100' } as NodeJS.ProcessEnv;

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const kundlis: Record<string, any> = {
    u1: { id: 'k1', user_id: 'u1', preferred_dasha: null, digest_status: 'ready' },
    u3: { id: 'k3', user_id: 'u3', preferred_dasha: null, digest_status: 'pending' },
  };
  const facts = new Map<string, any>();
  const events: any[] = [];
  const markers = new Map<string, any>();
  const prisma: any = {
    kundli: {
      findFirst: async ({ where }: any) => (kundlis[where.user_id] ? { ...kundlis[where.user_id] } : null),
      update: async ({ where, data }: any) => {
        const k = Object.values(kundlis).find((x: any) => x.id === where.id);
        return Object.assign(k, data);
      },
    },
    kundliData: { findFirst: async ({ where }: any) => (where.data_type === 'dasha.applicable' ? { payload: APPLICABLE_RAW } : null) },
    auth: { findUnique: async ({ where }: any) => ({ date_of_birth: where.id === 'u1' ? '1985-03-01' : null, gender: null, role: 'novice' }) },
    personFact: {
      findMany: async ({ where }: any) => [...facts.values()].filter((f) => f.user_id === where.user_id),
      upsert: async ({ where, create }: any) => {
        const row = { ...create, user_id: where.user_id_key.user_id, key: where.user_id_key.key };
        facts.set(`${row.user_id}:${row.key}`, row);
        return row;
      },
    },
    analyticsEvent: { create: async ({ data }: any) => (events.push(data), data) },
    areaBuild: {
      findUnique: async ({ where }: any) => markers.get(`${where.kundli_id_area_as_of.kundli_id}|${where.kundli_id_area_as_of.area}`) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = `${where.kundli_id_area_as_of.kundli_id}|${where.kundli_id_area_as_of.area}`;
        const next = markers.has(k) ? { ...markers.get(k), ...update } : create;
        markers.set(k, next);
        return next;
      },
    },
  };
  return { prisma, kundlis, facts, events, markers };
}

let f = fakePrisma();
let store = new MemoryPlanStore(NOW);
let stored: Record<string, SelfV2Latest> = {};
const reads: string[] = [];
const invokes: unknown[] = [];
const digestQueued: string[] = [];
const gate = () => new QuestionGate(store, { enabled: true, now: () => NOW, env: ENV });
let base = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(() => {
  const app = express();
  app.use(express.json());
  registerSelfV2Routes(app, {
    // the routes keep the deps they were given: a proxy hands them each test's fresh fake
    prisma: new Proxy({}, { get: (_t, k) => f.prisma[k as string] }) as never,
    enabled: true,
    requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
    v2: {
      now: () => NOW,
      readLatest: async (_p, kundliId) => { reads.push(kundliId); return stored[kundliId] ?? { ...NOTHING_STORED }; },
      systemsPresent: async () => PRESENT,
      queueBuild: (p, u, k) => queueSelfReadingBuild({ prisma: p, invoke: async (x) => { invokes.push(x); }, now: () => NOW }, u, k, 'self'),
      queueDigest: async (_p, k) => { digestQueued.push(k); },
      gate: {
        chargeClock: (u: string, d: string, sys: string) => gate().chargeClock(u, d, sys),
        getStatus: (u: string) => gate().getStatus(u),
      },
    },
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  f = fakePrisma();
  store = new MemoryPlanStore(NOW);
  stored = {};
  reads.length = 0;
  invokes.length = 0;
  digestQueued.length = 0;
});

const call = (method: string, path: string, user?: string, body?: unknown) =>
  fetch(`${base}${path}`, {
    method,
    headers: { ...(user ? { 'x-user': user } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

describe('GET /api/self/v2', () => {
  it('maps the stored build: twelve areas in order, engine names redacted, no-store', async () => {
    stored.k1 = latestFixture();
    const r = await call('GET', '/api/self/v2', 'u1');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe(SELF_V2_CACHE_CONTROL);
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(body.areas.map((a: any) => a.id)).toEqual(SELF_V2_AREAS.map((a) => a.id));
    expect(JSON.stringify(body)).not.toMatch(/radha|pyjhora|jhora/i);
    expect(body.clock.system).toBe('chathuraaseethi_sama');
    expect(body.clock.applicable.map((a: any) => a.system)).not.toContain('kalachakra');
    expect(body.clock.notApplicable.map((a: any) => a.system)).toContain('dwisatpathi');
    expect(body.profile).toMatchObject({ ageBand: '36_45', hasGender: false, missing: ['work.status', 'love.status', 'family.children', 'self.focus'] });
    expect(body.hero.question).toEqual({ claimId: 'fact.work.status', text: 'Do you have a job right now?' });
    expect(invokes).toHaveLength(0);
  });

  it('nothing stored: pending, and the build is queued once across polls', async () => {
    const r1 = await (await call('GET', '/api/self/v2', 'u1')).json();
    const r2 = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(r1.status).toBe('pending');
    expect(r2.status).toBe('pending');
    expect(r1.areas.every((a: any) => a.status === 'pending')).toBe(true);
    expect(invokes).toHaveLength(1);
    expect(invokes[0]).toMatchObject({ source: 'self-reading-build', userId: 'u1', board: 'self' });
  });

  it("refresh: the You board's dates by the v1 rule (selfBoardDates): the synthesis's own, due only after its last day", async () => {
    stored.k1 = latestFixture();
    // nothing made yet: nothing due, no dates
    const none = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(none.refresh).toEqual({ madeAt: null, validUntil: null, due: false, building: false, failed: false });
    // a synthesis said it holds through 2026-11-08; today is 2026-11-09
    f.prisma.techniqueOutput = {
      findFirst: async ({ where }: any) =>
        where.technique_id === 'self.reading.oracle' && where.kundli_id === 'k1'
          ? { output: { status: 'ok', validUntil: { overall: '2026-11-08' } }, created_at: new Date('2026-10-20T09:00:00Z'), valid_from: new Date('2026-10-20T00:00:00Z'), valid_to: null }
          : null,
    };
    const due = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(due.refresh).toEqual({ madeAt: '2026-10-20T09:00:00.000Z', validUntil: '2026-11-08', due: true, building: false, failed: false });
    f.prisma.techniqueOutput = {
      findFirst: async () => ({ output: { status: 'ok', validUntil: { overall: '2026-12-04' } }, created_at: new Date('2026-11-01T09:00:00Z'), valid_from: new Date('2026-11-01T00:00:00Z'), valid_to: null }),
    };
    const notDue = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(notDue.refresh).toEqual({ madeAt: '2026-11-01T09:00:00.000Z', validUntil: '2026-12-04', due: false, building: false, failed: false });
    const nk = await (await call('GET', '/api/self/v2', 'u2')).json();
    expect(nk.refresh).toEqual({ madeAt: null, validUntil: null, due: false, building: false, failed: false });
  });

  it("refresh.building and refresh.failed come from today's You build marker, so a failed fresh reading shows at once", async () => {
    stored.k1 = latestFixture();
    const started = { started_at: NOW.toISOString() };
    f.markers.set('k1|self.reading', { status: 'building', result: started });
    expect((await (await call('GET', '/api/self/v2', 'u1')).json()).refresh).toMatchObject({ building: true, failed: false });
    f.markers.set('k1|self.reading', { status: 'failed', result: started, error: 'v2 failed' });
    expect((await (await call('GET', '/api/self/v2', 'u1')).json()).refresh).toMatchObject({ building: false, failed: true });
    f.markers.set('k1|self.reading', { status: 'ready', result: started });
    expect((await (await call('GET', '/api/self/v2', 'u1')).json()).refresh).toMatchObject({ building: false, failed: false });
    // a build dead past the stuck limit is neither: the page's own timeout covers it
    f.markers.set('k1|self.reading', { status: 'building', result: { started_at: new Date(NOW.getTime() - 11 * 60_000).toISOString() } });
    expect((await (await call('GET', '/api/self/v2', 'u1')).json()).refresh).toMatchObject({ building: false, failed: false });
  });

  it("Try again (docs/loading-overlay/05): a stuck build, or one failed past the cooldown, is queued again; a recent failure or a running build is not", async () => {
    stored.k1 = latestFixture();
    const ago = (min: number) => ({ started_at: new Date(NOW.getTime() - min * 60_000).toISOString() });
    f.markers.set('k1|self.reading', { status: 'building', result: ago(11) });
    let b = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(invokes).toHaveLength(1);
    expect(b.build.state).toBe('queued');
    f.markers.set('k1|self.reading', { status: 'failed', result: ago(31), error: 'v2 failed' });
    await call('GET', '/api/self/v2', 'u1');
    expect(invokes).toHaveLength(2);
    f.markers.set('k1|self.reading', { status: 'failed', result: ago(5), error: 'v2 failed' });
    b = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(invokes).toHaveLength(2);
    expect(b.build.state).toBe('failed');
    f.markers.set('k1|self.reading', { status: 'building', result: ago(1) });
    await call('GET', '/api/self/v2', 'u1');
    expect(invokes).toHaveLength(2);
    // stored cards and a build done today: nothing is queued
    f.markers.set('k1|self.reading', { status: 'ready', result: ago(1) });
    b = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(invokes).toHaveLength(2);
    expect(b.build).toMatchObject({ state: 'ready', percent: 100 });
  });

  it('an Oracle with no cards for this clock and no build today is built again, not left pending forever (c584c0a3)', async () => {
    stored.k1 = { ...latestFixture(), cards: null, status: 'pending' };
    const b = await (await call('GET', '/api/self/v2', 'u1')).json();
    expect(b.status).toBe('pending');
    expect(invokes).toHaveLength(1);
    expect(b.build.state).toBe('queued');
  });

  it('digest not ready: preparing, the digest is queued, no build', async () => {
    const r = await (await call('GET', '/api/self/v2', 'u3')).json();
    expect(r.status).toBe('preparing');
    expect(digestQueued).toEqual(['k3']);
    expect(invokes).toHaveLength(0);
  });

  it('401 without a user; 404 no_kundli; another account is never read', async () => {
    stored.k1 = latestFixture();
    const anon = await call('GET', '/api/self/v2');
    expect(anon.status).toBe(401);
    expect(anon.headers.get('cache-control')).toBe(SELF_V2_CACHE_CONTROL);
    const u2 = await call('GET', '/api/self/v2', 'u2');
    expect(u2.status).toBe(404);
    expect((await u2.json()).status).toBe('no_kundli');
    const cross = await call('GET', '/api/self/v2?userId=u1', 'u2');
    expect(cross.status).toBe(403);
    expect(reads).not.toContain('k1');
  });
});

describe('PUT /api/self/v2/clock', () => {
  it('charges once per system per day, writes preferred_dasha and a clock_viewed row, queues the build', async () => {
    const r1 = await call('PUT', '/api/self/v2/clock', 'u1', { system: 'narayana' });
    expect(r1.status).toBe(202);
    const b1 = await r1.json();
    expect(b1).toMatchObject({ status: 'building', alsoChanges: ['love', 'work'] });
    expect(b1.usage).toMatchObject({ used: 1, limit: 20 });
    expect(f.kundlis.u1.preferred_dasha).toBe('narayana');

    const r2 = await (await call('PUT', '/api/self/v2/clock', 'u1', { system: 'vimsottari' })).json();
    expect(r2.usage.used).toBe(2);
    // back to a clock already paid for today: free
    const r3 = await (await call('PUT', '/api/self/v2/clock', 'u1', { system: 'narayana' })).json();
    expect(r3.usage.used).toBe(2);
    expect(store.usage.map((u) => u.key)).toEqual(['board:self:2026-11-09:clock:narayana', 'board:self:2026-11-09:clock:vimsottari']);

    expect(f.events).toHaveLength(3);
    expect(f.events[0]).toMatchObject({ user_id: 'u1', event: 'clock_viewed', surface: 'self', target: 'narayana', props: { kundli_id: 'k1', from: 'chathuraaseethi_sama', to: 'narayana', charged: true } });
    expect(f.events[1].props).toMatchObject({ from: 'narayana', to: 'vimsottari', charged: true });
    expect(f.events[2].props).toMatchObject({ from: 'vimsottari', to: 'narayana', charged: false });
    expect(invokes.length).toBeGreaterThanOrEqual(1);
  });

  it('the clock already in use: 200 unchanged, no charge, no event', async () => {
    const r = await call('PUT', '/api/self/v2/clock', 'u1', { system: 'chathuraaseethi_sama' });
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('unchanged');
    expect(store.usage).toHaveLength(0);
    expect(f.events).toHaveLength(0);
  });

  it('400 not_applicable for a clock the engine says does not apply; 400 unknown_system otherwise', async () => {
    const na = await call('PUT', '/api/self/v2/clock', 'u1', { system: 'dwisatpathi' });
    expect(na.status).toBe(400);
    expect((await na.json()).error).toBe('not_applicable');
    for (const system of ['kalachakra', 'nonsense', 42, null]) {
      const r = await call('PUT', '/api/self/v2/clock', 'u1', { system });
      expect(r.status).toBe(400);
      expect((await r.json()).error).toBe('unknown_system');
    }
    expect(store.usage).toHaveLength(0);
    expect(f.events).toHaveLength(0);
    expect(f.kundlis.u1.preferred_dasha).toBeNull();
  });

  it('404 without a kundli; 403 naming another account', async () => {
    expect((await call('PUT', '/api/self/v2/clock', 'u2', { system: 'narayana' })).status).toBe(404);
    expect((await call('PUT', '/api/self/v2/clock', 'u2', { system: 'narayana', userId: 'u1' })).status).toBe(403);
    expect(f.kundlis.u1.preferred_dasha).toBeNull();
  });
});

describe('POST /api/self/v2/confirm and /mood', () => {
  it('confirm stores self.confirm.<claimId>; bad claim or answer is 400', async () => {
    const ok = await call('POST', '/api/self/v2/confirm', 'u1', { claimId: 'work.change.2026', answer: 'partly' });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('cache-control')).toBe(SELF_V2_CACHE_CONTROL);
    expect(f.facts.get('u1:self.confirm.work.change.2026')?.value).toBe('partly');
    expect((await call('POST', '/api/self/v2/confirm', 'u1', { claimId: 'x', answer: 'maybe' })).status).toBe(400);
    expect((await call('POST', '/api/self/v2/confirm', 'u1', { claimId: 'Bad Id!', answer: 'yes' })).status).toBe(400);
    expect((await call('POST', '/api/self/v2/confirm', 'u1', { answer: 'yes' })).status).toBe(400);
  });

  it('mood stores <mood>:<day>, counted only that day by profile.moodFor', async () => {
    expect((await call('POST', '/api/self/v2/mood', 'u1', { mood: 'heavy' })).status).toBe(204);
    const v = f.facts.get('u1:self.mood')?.value;
    expect(v).toBe('heavy:2026-11-09');
    expect(moodFor(v, '2026-11-09')).toBe('heavy');
    expect(moodFor(v, '2026-11-10')).toBeNull();
    expect((await call('POST', '/api/self/v2/mood', 'u1', { mood: 'ecstatic' })).status).toBe(400);
    expect((await call('POST', '/api/self/v2/mood', 'u1', {})).status).toBe(400);
  });

  it('the mood reaches the profile pack the same day', async () => {
    await call('POST', '/api/self/v2/mood', 'u1', { mood: 'fine' });
    stored.k1 = latestFixture();
    // profile.mood is not in the response type; the pack reads it (loadProfilePack → moodFor)
    const { loadProfilePack } = await import('../../../../../src/reading/person/profile.js');
    expect((await loadProfilePack(f.prisma, 'u1', '2026-11-09')).mood).toBe('fine');
  });
});
