/**
 * GET /api/lucky/range shape after the five limbs (docs/reading-engine/54 §6): each window carries `reasons` with a
 * scope and the plain `reasonKeys`; each day names its yoga and karana; the hora-lord mark appears only when the
 * functional-nature dependency (the digest, S1) answers for the person's kundli.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { registerLuckyRoutes } from '../../../../src/routes/luckyRoutes.js';
import { resetAgentRegistryState } from '../../../../src/agents/registry.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';
import { fakeLuckyPrisma } from '../../../helpers/fakeLuckyPrisma.js';

const NOW = new Date('2026-11-05T19:30:00Z');
const engine = vi.fn(async (_type: string, fields: Record<string, any>) => {
  const days = [];
  for (let d = new Date(`${fields.params.from}T00:00:00Z`); d <= new Date(`${fields.params.to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({ date: d.toISOString().slice(0, 10), weekday: 'Monday', sunrise: '07:30:00', sunset: '18:20:00', horas: [], muhurtas: [] });
  }
  return { days };
});
const natalFor = vi.fn(async (userId: string) => (userId === 'nochart' ? null : { kundliId: `k-${userId}`, fields: { natal_date: '1990-01-01' } }));
const functionalNatureOf = vi.fn(async (kundliId: string) =>
  kundliId === 'k-digest' ? ({ Jupiter: 'benefic', Mercury: 'benefic', Moon: 'benefic', Sun: 'neutral', Venus: 'neutral', Mars: 'malefic', Saturn: 'malefic' } as const) : null,
);

type Srv = ReturnType<express.Express['listen']>;
const servers: Srv[] = [];
async function start(withNature: boolean): Promise<string> {
  const db = fakeLuckyPrisma();
  const app = express();
  app.use(express.json());
  registerLuckyRoutes(app, {
    prisma: db.prisma,
    requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null),
    enabled: true,
    engine,
    natalFor,
    functionalNatureOf: withNature ? functionalNatureOf : null,
    now: () => NOW,
  });
  const s = app.listen(0);
  servers.push(s);
  await new Promise((r) => s.once('listening', r));
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}
async function call(base: string, method: string, path: string, user: string, body?: unknown) {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-user': user }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  return { status: r.status, json: text ? (JSON.parse(text) as any) : null };
}
async function rangeFor(base: string, user: string) {
  await call(base, 'PUT', '/api/lucky/place', user, { place: 'sanjose' });
  await call(base, 'POST', '/api/lucky/picks', user, { scenario: 'work.start_project' });
  const r = await call(base, 'GET', '/api/lucky/range?from=2026-11-01&to=2026-11-19', user);
  expect(r.status).toBe(200);
  return r.json;
}

let withNature = '';
let withoutNature = '';
beforeAll(async () => {
  resetAgentRegistryState();
  withNature = await start(true);
  withoutNature = await start(false);
});
afterAll(() => Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))));

describe('range shape with the five limbs', () => {
  it('every window has scoped reasons and the plain keys; every day names its yoga and karana', async () => {
    const json = await rangeFor(withoutNature, 'digest');
    const thu = json.days.find((d: any) => d.date === '2026-11-05');
    expect(thu.yoga).toEqual({ name: 'Vaidhriti', endHour: 15.6488 });
    expect(thu.karana).toEqual({ name: 'Taitila', endHour: 21.0046 });
    const windows = json.days.flatMap((d: any) => d.layers['work.start_project'].windows);
    expect(windows.length).toBeGreaterThan(0);
    for (const w of windows) {
      expect(Array.isArray(w.reasonKeys)).toBe(true);
      expect(w.reasons.map((x: any) => x.key)).toEqual(w.reasonKeys);
      for (const x of w.reasons) expect(['general', 'personal']).toContain(x.scope);
    }
    const keys = windows.flatMap((w: any) => w.reasonKeys);
    expect(keys.some((k: string) => k.startsWith('yoga:') || k.startsWith('karana:'))).toBe(true);
    expect(keys.some((k: string) => k.startsWith('personal:hora'))).toBe(false); // dependency wired to null
  });

  it('the hora-lord mark comes only from the functional-nature dependency, for the kundli of the person', async () => {
    const json = await rangeFor(withNature, 'digest');
    expect(functionalNatureOf).toHaveBeenCalledWith('k-digest');
    const reasons = json.days.flatMap((d: any) => d.layers['work.start_project'].windows.flatMap((w: any) => w.reasons));
    expect(reasons).toContainEqual({ key: 'personal:hora_benefic', scope: 'personal' });

    const none = await rangeFor(withNature, 'nodigest'); // the dependency answers null: no digest yet
    const keys = none.days.flatMap((d: any) => d.layers['work.start_project'].windows.flatMap((w: any) => w.reasonKeys));
    expect(keys.some((k: string) => k.startsWith('personal:hora'))).toBe(false);
  });

  it('no chart, no call for the functional natures', async () => {
    functionalNatureOf.mockClear();
    await rangeFor(withNature, 'nochart');
    expect(functionalNatureOf).not.toHaveBeenCalled();
  });
});
