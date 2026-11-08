/** The admin Techniques Lab surface (docs/admin/10): token and consent guards, a manual run that writes a dossier, one-technique runs, birth fields stripped. */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { digestView } from '../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import { registerAdminLabRoutes } from '../../../../src/routes/adminLabRoutes.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const dossiers = new Map<string, any>();
const actions: any[] = [];
const prisma: any = {
  auth: {
    findUnique: async ({ where }: any) =>
      where.id === 'u1'
        ? {
            id: 'u1',
            email: 'sachin@example.com',
            name: 'Sachin Mohan',
            date_of_birth: '1975-07-30',
            time_of_birth: '19:21',
            place_of_birth: 'Pune, Maharashtra, India',
            city: 'Pune',
            country_code: 'IN',
            locked_at: null,
          }
        : where.id === 'u2'
          ? { id: 'u2', locked_at: new Date('2026-11-01T00:00:00Z') }
          : null,
    findMany: async () => [
      {
        id: 'u1',
        email: 'sachin@example.com',
        name: 'Sachin Mohan',
        date_of_birth: '1975-07-30',
        time_of_birth: '19:21',
        place_of_birth: 'Pune, Maharashtra, India',
        city: 'Pune',
        country_code: 'IN',
        kundlis: [{ id: 'k1', digest_status: 'ready', preferred_dasha: 'dwisatpathi' }],
      },
    ],
  },
  kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1', digest_status: 'ready', preferred_dasha: 'dwisatpathi' } : null) },
  personFact: { findMany: async () => [] },
  techniqueOutput: { findUnique: async () => null, upsert: async ({ create }: any) => create, updateMany: async () => ({ count: 0 }) },
  agentRegistry: { upsert: async () => ({}) },
  agentRun: { create: async () => ({}) },
  adminAction: { create: async ({ data }: any) => (actions.push(data), data) },
  readingDossier: {
    findUnique: async ({ where }: any) => (where.id ? dossiers.get(where.id) ?? null : [...dossiers.values()].find((d) => d.bundle_hash === where.kundli_id_board_bundle_hash?.bundle_hash) ?? null),
    findFirst: async () => [...dossiers.values()].at(-1) ?? null,
    findMany: async () => [...dossiers.values()],
    create: async ({ data }: any) => {
      const id = `d${dossiers.size + 1}`;
      dossiers.set(id, { id, ...data, date_of_birth: 'should be stripped' });
      return { id };
    },
  },
};

let base = '';
let server: ReturnType<express.Express['listen']>;
beforeAll(() => {
  const app = express();
  app.use(express.json());
  registerAdminLabRoutes(app, {
    prisma,
    enabled: true,
    token: 'lab-secret',
    self: {
      now: () => new Date('2026-11-07T12:00:00Z'),
      loadDigest: async () => digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' }),
      systemsPresent: async () => FIX.systems,
      loadTransit: async () => null,
      activationFor: async (_p, _k, q) => FIX.activation.filter((r) => (!q.systems || q.systems.includes(r.system)) && r.level <= (q.maxLevel ?? 3) && r.from < q.to && r.to > q.from),
    },
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

const post = (body: unknown, token = 'lab-secret') => fetch(`${base}/api/admin-lab/run`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-lab-token': token }, body: JSON.stringify(body) });

describe('admin lab', () => {
  it('refuses without the token, without consent, and an unknown technique', async () => {
    expect((await post({ userId: 'u1' }, 'wrong')).status).toBe(403);
    // QA: no research flag needed; a locked account is still refused
    expect((await post({ userId: 'u2' })).status).toBe(403);
    expect((await post({ userId: 'u1', technique: 'self.reading.nonesuch' })).status).toBe(400);
    expect((await post({ userId: 'u9' })).status).toBe(404);
  });
  it('a full manual run returns the reading and its dossier, birth fields stripped, and logs the action', async () => {
    const r = await post({ userId: 'u1', force: true });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.runId).toBe('d1');
    expect(j.reading.panels).toHaveLength(9);
    expect(j.reading.audit.verdict).toBe('pass');
    expect(j.dossier.trigger).toBe('manual');
    expect(j.dossier.date_of_birth).toBeUndefined();
    expect(Object.keys(j.dossier.data).length).toBeGreaterThan(10);
    expect(actions.at(-1)).toMatchObject({ action: 'lab.run', target_user_id: 'u1' });
  });
  it('one technique runs only that panel (the diagnosis brings its four inputs)', async () => {
    const one = await (await post({ userId: 'u1', technique: 'self.reading.body', force: true })).json();
    expect(one.reading.panels.map((p: any) => p.id)).toEqual(['body']);
    const diag = await (await post({ userId: 'u1', technique: 'diagnosis', force: true })).json();
    expect(diag.reading.panels.map((p: any) => p.id).sort()).toEqual(['chapters', 'diagnosis', 'lagna', 'struggle', 'yogas']);
  });
  it('lists and reads stored dossiers behind the token', async () => {
    const h = { 'x-admin-lab-token': 'lab-secret' };
    expect((await fetch(`${base}/api/admin-lab/dossiers?userId=u1`)).status).toBe(403);
    const list = await (await fetch(`${base}/api/admin-lab/dossiers?userId=u1`, { headers: h })).json();
    expect(list.items.length).toBeGreaterThanOrEqual(1);
    const one = await (await fetch(`${base}/api/admin-lab/runs/d1`, { headers: h })).json();
    expect(one.id).toBe('d1');
    expect(one.date_of_birth).toBeUndefined();
  });
  it('returns un-obfuscated person and birth details on GET /api/admin-lab/people and /api/admin-lab/people/:userId, and accepts X-Astra-Authorization LabToken fallback', async () => {
    expect((await fetch(`${base}/api/admin-lab/people`)).status).toBe(403);
    expect((await fetch(`${base}/api/admin-lab/people/u1`)).status).toBe(403);
    const listRes = await fetch(`${base}/api/admin-lab/people`, {
      headers: { 'X-Astra-Authorization': 'LabToken lab-secret' },
    });
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.items).toEqual([
      {
        userId: 'u1',
        label: 'Sachin Mohan (sachin@example.com)',
        email: 'sachin@example.com',
        name: 'Sachin Mohan',
        dateOfBirth: '1975-07-30',
        timeOfBirth: '19:21',
        placeOfBirth: 'Pune, Maharashtra, India',
        city: 'Pune',
        countryCode: 'IN',
        kundliId: 'k1',
        digestStatus: 'ready',
        preferredClock: 'dwisatpathi',
      },
    ]);

    const detailRes = await fetch(`${base}/api/admin-lab/people/u1`, {
      headers: { 'x-admin-lab-token': 'lab-secret' },
    });
    expect(detailRes.status).toBe(200);
    expect(await detailRes.json()).toEqual({
      userId: 'u1',
      email: 'sachin@example.com',
      name: 'Sachin Mohan',
      dateOfBirth: '1975-07-30',
      timeOfBirth: '19:21',
      placeOfBirth: 'Pune, Maharashtra, India',
      city: 'Pune',
      countryCode: 'IN',
      locked: false,
      kundliId: 'k1',
      digestStatus: 'ready',
      preferredClock: 'dwisatpathi',
    });
    expect((await fetch(`${base}/api/admin-lab/people/u9`, { headers: { 'x-admin-lab-token': 'lab-secret' } })).status).toBe(404);
  });
});

describe('admin lab: the served shape (docs/admin/10 §5 mirror test)', () => {
  const offending = (v: unknown, path = '$', out: string[] = []): string[] => {
    if (Array.isArray(v)) v.forEach((x, i) => offending(x, `${path}[${i}]`, out));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const l = k.toLowerCase().replace(/[^a-z]/g, '');
        if (['name', 'place', 'city', 'lat', 'lon', 'tz', 'email', 'phone', 'address', 'ip', 'kundliid', 'question'].includes(l) || l.startsWith('birth')) out.push(`${path}.${k}`);
        offending(x, `${path}.${k}`, out);
      }
    }
    return out;
  };
  it('a run response and its dossier carry none of the keys the admin refuses, and chart names survive as title', async () => {
    const j = await (await post({ userId: 'u1', force: true })).json();
    expect(offending(j)).toEqual([]);
    expect(JSON.stringify(j.dossier.yogas)).toContain('"title"');
  });
  it('the dossier records step timings, unread rows, clock applicability and the run scope', async () => {
    const j = await (await post({ userId: 'u1', technique: 'body', force: true })).json();
    expect(j.dossier.audit.steps).toEqual(expect.objectContaining({ loadMs: expect.any(Number), panelsMs: expect.any(Number), purviewMs: expect.any(Number), cardsMs: expect.any(Number), auditMs: expect.any(Number) }));
    expect(j.dossier.audit.unresolvedKeys).toBe(0);
    expect(j.dossier.audit.scope).toBe('body');
    expect(j.dossier.clocks.applicable).toBe(true);
    const list = await (await fetch(`${base}/api/admin-lab/dossiers?userId=u1`, { headers: { 'x-admin-lab-token': 'lab-secret' } })).json();
    expect(list.items.some((r: any) => r.technique === 'body')).toBe(true);
    expect(offending(list)).toEqual([]);
  });
  it('takes an as-of date and names unbuilt boards', async () => {
    const j = await (await post({ userId: 'u1', asOf: '2027-03-01', force: true })).json();
    expect(j.reading.asOf).toBe('2027-03-01');
    expect((await post({ userId: 'u1', asOf: '1 March' })).status).toBe(400);
    const love = await post({ userId: 'u1', board: 'love' });
    expect(love.status).toBe(400);
    expect(await love.json()).toEqual({ error: 'board_not_built', board: 'love' });
  });
});
