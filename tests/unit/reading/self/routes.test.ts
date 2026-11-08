/**
 * The You reading routes and service (docs/reading-engine/58 §4.2): status codes, panels stored per technique and
 * served from the store on the second open, the clock change, and confirm answers that withhold a claim.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { registerSelfReadingRoutes } from '../../../../src/routes/selfReadingRoutes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const facts = new Map<string, any>();
  const outputs = new Map<string, any>();
  const runs: any[] = [];
  const kundli: any = { id: 'k1', preferred_dasha: 'dwisatpathi' };
  const prisma: any = {
    kundli: {
      findFirst: async ({ where }: any) => (where.user_id === 'u1' ? kundli : null),
      update: async ({ data }: any) => Object.assign(kundli, data),
      updateMany: async () => ({ count: 1 }),
    },
    personFact: {
      findMany: async ({ where }: any) => [...facts.values()].filter((f) => f.user_id === where.user_id && f.key.startsWith(where.key.startsWith)),
      upsert: async ({ where, create }: any) => (facts.set(`${where.user_id_key.user_id}:${where.user_id_key.key}`, create), create),
    },
    techniqueOutput: {
      findUnique: async ({ where }: any) => outputs.get(where.cache_key) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const cur = outputs.get(where.cache_key);
        const next = cur ? { ...cur, ...update } : { ...create, hit_count: 0, last_hit_at: null };
        outputs.set(where.cache_key, next);
        return next;
      },
      updateMany: async () => ({ count: 1 }),
    },
    agentRegistry: { upsert: async () => ({}) },
    agentRun: { create: async ({ data }: any) => runs.push(data) },
  };
  return { prisma, facts, outputs, runs, kundli };
}

const f = fakePrisma();
let base = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(() => {
  const app = express();
  app.use(express.json());
  registerSelfReadingRoutes(app, {
    prisma: f.prisma,
    enabled: true,
    requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
    self: {
      now: () => new Date('2026-11-07T12:00:00Z'),
      loadDigest: async () => digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' }),
      systemsPresent: async () => FIX.systems,
      activationFor: async (_p, _k, q) => FIX.activation.filter((r) => (!q.systems || q.systems.includes(r.system)) && r.level <= (q.maxLevel ?? 3) && r.from < q.to && r.to > q.from),
    },
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const get = (user?: string) => fetch(`${base}/api/self/reading`, { headers: user ? { 'x-user': user } : {} });

describe('GET /api/self/reading', () => {
  it('401 without a user, 404 without a kundli', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('u9')).status).toBe(404);
  });
  it('builds seven panels, each stored and timed, then serves them from the store', async () => {
    const r1 = await (await get('u1')).json();
    expect(r1.status).toBe('ok');
    expect(r1.reading.clock).toMatchObject({ system: 'dwisatpathi', reason: 'preferred' });
    expect(r1.reading.panels.map((p: any) => p.technique)).toEqual(['diagnosis', 'chapters', 'lagna', 'mind', 'body', 'atma', 'yogas', 'struggle', 'year'].map((x) => `self.reading.${x}`));
    expect(r1.reading.panels.every((p: any) => p.status !== 'failed' && p.status !== 'withheld' && !p.cached)).toBe(true);
    expect(r1.reading.audit.verdict).toBe('pass');
    const strugglePanelOut = r1.reading.panels.find((p: any) => p.id === 'struggle');
    expect(strugglePanelOut.lead).toBe(`${strugglePanelOut.claims.length} ${strugglePanelOut.claims.length === 1 ? 'thing' : 'things'} in your chart ${strugglePanelOut.claims.length === 1 ? 'asks' : 'ask'} more of you than the rest.`);
    expect(r1.reading.panels.find((p: any) => p.id === 'body').status).toBe('partial');
    expect(f.outputs.size).toBe(9);
    expect(f.runs.filter((r) => r.agent_id === 'self.reading_panel' || r.agentId === 'self.reading_panel').length).toBeGreaterThanOrEqual(9);
    const r2 = await (await get('u1')).json();
    expect(r2.cached).toBe(true);
    expect(r2.reading.panels.every((p: any) => p.cached && p.ms === 0)).toBe(true);
    expect(r2.reading.question).toMatchObject({ claimId: 'diagnosis.tension', panel: 'diagnosis' });
  });
  it('a "no" answer withholds the claim and the next question moves on', async () => {
    const post = await fetch(`${base}/api/self/reading/confirm`, { method: 'POST', headers: { 'x-user': 'u1', 'content-type': 'application/json' }, body: JSON.stringify({ claimId: 'diagnosis.tension', answer: 'no' }) });
    expect(post.status).toBe(204);
    const bad = await fetch(`${base}/api/self/reading/confirm`, { method: 'POST', headers: { 'x-user': 'u1', 'content-type': 'application/json' }, body: JSON.stringify({ claimId: 'chapters.sub', answer: 'maybe' }) });
    expect(bad.status).toBe(400);
    const r = await (await get('u1')).json();
    const d = r.reading.panels.find((p: any) => p.id === 'diagnosis');
    const t = d.claims.find((c: any) => c.id === 'diagnosis.tension');
    expect(t.withheld).toBe('You told us this did not fit.');
    const src = t.evidence[0].slice(6);
    const all = r.reading.panels.flatMap((p: any) => p.claims);
    expect(all.find((c: any) => c.id === src).withheld).toBe('You told us this did not fit.');
    expect(r.reading.question.claimId).toBe('chapters.sub');
  });
  it('PUT /api/self/clock sets a stored system and refuses an unknown one; a new clock makes new stored outputs', async () => {
    const put = (system: unknown) => fetch(`${base}/api/self/clock`, { method: 'PUT', headers: { 'x-user': 'u1', 'content-type': 'application/json' }, body: JSON.stringify({ system }) });
    expect((await put('nonesuch')).status).toBe(400);
    const ok = await put('vimsottari');
    expect(ok.status).toBe(200);
    expect((await ok.json()).clock).toMatchObject({ system: 'vimsottari', reason: 'preferred' });
    const r = await (await get('u1')).json();
    expect(r.reading.panels.every((p: any) => !p.cached)).toBe(true);
    const ch = r.reading.panels.find((p: any) => p.id === 'chapters').chapters;
    expect(ch.find((c: any) => c.kind === 'running')).toMatchObject({ lord: 'Mo', from: '2018-03-16' });
    expect((await put(null)).status).toBe(200);
    expect(f.kundli.preferred_dasha).toBeNull();
  });
});
