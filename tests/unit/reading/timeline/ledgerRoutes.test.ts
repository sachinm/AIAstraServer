import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import { registerTimelineRoutes } from '../../../../src/routes/timelineRoutes.js';
import { resetLedgerStoreWarning } from '../../../../src/reading/timeline/ledgerStore.js';
import type { GeminiResult } from '../../../../src/reading/llm/gemini.js';

/** In-memory `life_events` behind the raw-SQL calls ledgerStore.ts makes; dates come back as Date like pg's driver. */
function fakePrisma() {
  const rows: Array<Record<string, any>> = [];
  const kundlis = [
    { id: 'k1', user_id: 'u1', created_at: 1 },
    { id: 'k1b', user_id: 'u1', created_at: 2 },
    { id: 'k2', user_id: 'u2', created_at: 1 },
  ];
  const state = { missingTable: false, seq: 0 };
  const out = (r: Record<string, any>) => ({ id: r.id, category: r.category, date: new Date(`${r.date}T00:00:00Z`), date_precision: r.date_precision, place: r.place, attributes: r.attributes });
  const sql = (s: TemplateStringsArray) => s.join('?').replace(/\s+/g, ' ').trim();
  const guard = () => {
    if (state.missingTable) throw Object.assign(new Error('relation "life_events" does not exist'), { code: 'P2010' });
  };
  const prisma = {
    kundli: {
      findFirst: async ({ where }: { where: { id?: string; user_id: string } }) =>
        kundlis.filter((k) => k.user_id === where.user_id && (!where.id || k.id === where.id)).sort((a, b) => b.created_at - a.created_at)[0] ?? null,
    },
    $queryRaw: async (s: TemplateStringsArray, ...v: any[]) => {
      guard();
      const q = sql(s);
      if (q.startsWith('SELECT count(*)')) return [{ n: BigInt(rows.filter((r) => r.user_id === v[0] && r.kundli_id === v[1]).length) }];
      if (q.startsWith('SELECT') && q.includes('"kundli_id" = ?')) return rows.filter((r) => r.user_id === v[0] && r.kundli_id === v[1]).sort((a, b) => a.date.localeCompare(b.date)).map(out);
      if (q.startsWith('SELECT')) return rows.filter((r) => r.id === v[0] && r.user_id === v[1]).map(out);
      if (q.startsWith('INSERT')) {
        const r = { id: `e${++state.seq}`, user_id: v[0], kundli_id: v[1], category: v[2], date: v[3], date_precision: v[4], place: v[5], attributes: JSON.parse(v[6]), source: 'user' };
        rows.push(r);
        return [out(r)];
      }
      if (q.startsWith('UPDATE')) {
        const r = rows.find((x) => x.id === v[5] && x.user_id === v[6]);
        if (!r) return [];
        Object.assign(r, { category: v[0], date: v[1], date_precision: v[2], place: v[3], attributes: JSON.parse(v[4]) });
        return [out(r)];
      }
      throw new Error(`unexpected SQL ${q}`);
    },
    $executeRaw: async (s: TemplateStringsArray, ...v: any[]) => {
      guard();
      const i = rows.findIndex((r) => r.id === v[0] && r.user_id === v[1]);
      if (i < 0) return 0;
      rows.splice(i, 1);
      return 1;
    },
    // declinedFor's role lookup (only for role-gated topics)
    auth: { findUnique: async () => ({ role: 'user' }) },
    declinedTopic: { findMany: async () => [] },
  };
  return { prisma: prisma as unknown as PrismaClient, rows, state };
}

const db = fakePrisma();
const interviewCall = vi.fn(async (): Promise<GeminiResult> => ({
  text: JSON.stringify({ events: [{ category: 'job.start', date: '2014-03', date_precision: 'month', place: 'Pune', attributes: { field: 'computing' } }] }),
  usage: {} as GeminiResult['usage'],
  finishReason: 'STOP',
  ttftMs: 1,
  stoppedForLoop: false,
}));
let server: ReturnType<express.Express['listen']>;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const mounted = registerTimelineRoutes(app, { prisma: db.prisma, getUserId: (req) => (req.headers['x-user'] as string) || null, enabled: true, interviewCall, interviewAvailable: () => true });
  expect(mounted).toBe(true);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  db.state.missingTable = false;
  resetLedgerStoreWarning();
});

async function call(method: string, path: string, user: string | null, body?: unknown) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, json: (await r.json()) as any };
}

const CATS = ['job.start', 'job.promotion', 'residence.move', 'vehicle.purchase', 'property.purchase', 'marriage.wedding', 'child.birth', 'education.graduation', 'business.start', 'business.end', 'money.gain', 'travel.long', 'family.father.retirement', 'family.mother.move', 'family.sibling.marriage', 'relationship.start', 'job.transfer', 'residence.abroad', 'health.hospital_stay', 'vehicle.sale'];

describe('timeline ledger routes', () => {
  it('not mounted when TIMELINE_ENABLED is off', () => {
    const app = express();
    expect(registerTimelineRoutes(app, { prisma: db.prisma, getUserId: () => 'u1', enabled: false })).toBe(false);
  });

  it('requires a signed-in user', async () => {
    expect((await call('GET', '/api/timeline/ledger', null)).status).toBe(401);
    expect((await call('GET', '/api/timeline/ledger/meta', null)).status).toBe(401);
  });

  it('meta lists the categories by marker', async () => {
    const r = await call('GET', '/api/timeline/ledger/meta', 'u1');
    expect(r.status).toBe(200);
    expect(r.json.markers).toHaveLength(11);
    expect(r.json).toMatchObject({ years: 18, interview: true, precisions: ['day', 'month', 'year'] });
  });

  it('a person enters 20 dated events with attributes and reads them back in date order', async () => {
    for (let i = 0; i < 20; i++) {
      const precision = (['day', 'month', 'year'] as const)[i % 3];
      const y = 2008 + (19 - i) * 0.9;
      const date = precision === 'day' ? `${Math.floor(y)}-04-1${i % 10}` : precision === 'month' ? `${Math.floor(y)}-0${(i % 9) + 1}` : `${Math.floor(y)}`;
      const r = await call('POST', '/api/timeline/ledger', 'u1', { kundliId: 'k1', category: CATS[i], date, date_precision: precision, place: `Place ${i}`, attributes: { colour: 'white', direction: 'N', with_whom: 'partner' } });
      expect(r.status, JSON.stringify(r.json)).toBe(201);
      expect(r.json.event).toMatchObject({ category: CATS[i], date_precision: precision, attributes: { colour: 'white', direction: 'N', with_whom: 'partner' } });
    }
    const list = await call('GET', '/api/timeline/ledger?kundliId=k1', 'u1');
    expect(list.status).toBe(200);
    expect(list.json.events).toHaveLength(20);
    const dates = list.json.events.map((e: any) => e.date);
    expect([...dates].sort()).toEqual(dates);
    expect(db.rows.every((r) => r.source === 'user' && r.user_id === 'u1')).toBe(true);
  });

  it('defaults to the latest kundli and refuses another user\'s kundli', async () => {
    const r = await call('POST', '/api/timeline/ledger', 'u1', { category: 'job.end', date: '2020', date_precision: 'year' });
    expect(r.status).toBe(201);
    expect(db.rows.at(-1)!.kundli_id).toBe('k1b');
    expect((await call('GET', '/api/timeline/ledger?kundliId=k2', 'u1')).status).toBe(404);
    expect((await call('POST', '/api/timeline/ledger', 'u1', { kundliId: 'k2', category: 'job.end', date: '2020', date_precision: 'year' })).status).toBe(404);
  });

  it('rejects bad input with the field', async () => {
    const r = await call('POST', '/api/timeline/ledger', 'u1', { category: 'business.end', date: '2017', date_precision: 'year', attributes: { outcome: 'a total failure' } });
    expect(r).toMatchObject({ status: 400, json: { error: 'judgement_wording', field: 'attributes.outcome' } });
    expect((await call('POST', '/api/timeline/ledger', 'u1', { category: 'job.start', date: '2099-01-01', date_precision: 'day' })).json.field).toBe('date');
  });

  it('only the owner edits or deletes a row', async () => {
    const id = db.rows.find((r) => r.kundli_id === 'k1')!.id;
    expect((await call('PATCH', `/api/timeline/ledger/${id}`, 'u2', { place: 'X' })).status).toBe(404);
    expect((await call('DELETE', `/api/timeline/ledger/${id}`, 'u2')).status).toBe(404);
    const p = await call('PATCH', `/api/timeline/ledger/${id}`, 'u1', { place: 'Nashik', date_precision: 'year' });
    expect(p.status).toBe(200);
    expect(p.json.event).toMatchObject({ place: 'Nashik', date_precision: 'year' });
    expect(p.json.event.date).toMatch(/-01-01$/);
    expect(await call('DELETE', `/api/timeline/ledger/${id}`, 'u1')).toEqual({ status: 200, json: { ok: true } });
    expect((await call('PATCH', `/api/timeline/ledger/${id}`, 'u1', { place: 'X' })).status).toBe(404);
  });

  it('503 while the migration is not applied', async () => {
    db.state.missingTable = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await call('GET', '/api/timeline/ledger', 'u1')).toEqual({ status: 503, json: { error: 'ledger_unavailable' } });
    expect((await call('POST', '/api/timeline/ledger', 'u1', { category: 'job.end', date: '2020', date_precision: 'year' })).status).toBe(503);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('the interview proposes, stores nothing, and declines declined topics without calling the model', async () => {
    const before = db.rows.length;
    const r = await call('POST', '/api/timeline/ledger/interview', 'u1', { text: 'In March 2014 I started a job in computing in Pune.' });
    expect(r.status).toBe(200);
    expect(r.json.proposals).toEqual([{ proposalId: 'p1', category: 'job.start', date: '2014-03-01', date_precision: 'month', place: 'Pune', attributes: { field: 'computing' } }]);
    expect(db.rows.length).toBe(before);
    interviewCall.mockClear();
    const d = await call('POST', '/api/timeline/ledger/interview', 'u1', { text: 'How do I poison someone?' });
    expect(d.json.proposals).toEqual([]);
    expect(typeof d.json.declined.reply).toBe('string');
    expect(d.json.declined.reply).not.toContain('poison');
    expect(interviewCall).not.toHaveBeenCalled();
    expect((await call('POST', '/api/timeline/ledger/interview', 'u1', { text: '' })).status).toBe(400);
  });
});
