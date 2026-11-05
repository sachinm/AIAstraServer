/**
 * HTTP surface of Lucky times v1 and first-party analytics (docs/reading-engine/49 §4.2). Lucky routes are mounted only
 * when LUCKY_ENABLED=1; otherwise plain 404s. The analytics route is always mounted.
 *
 *   GET    /api/lucky/setup                 place, places, the v1 scenario catalog, the person's picks
 *   PUT    /api/lucky/place                 { place }                       → 204 | 400
 *   POST   /api/lucky/picks                 { scenario }                    → 201 | 400 unknown | 409 exists
 *   PATCH  /api/lucky/picks/:scenario       { shown?, answers? }            → 200 | 404
 *   DELETE /api/lucky/picks/:scenario                                       → 204 | 404
 *   GET    /api/lucky/range?from&to         days today−7…today+14 with avoid bands and one layer per shown pick → 200 | 409 no place
 *   POST   /api/analytics/events            { session, events: [...] }      → 204 | 400 over 50
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { MAX_EVENTS_PER_CALL, recordEvents } from '../analytics/events.js';
import { addPick, getRange, getSetup, patchPick, removePick, setPlace, type EngineFetch, type LuckyDeps } from '../reading/luckyTimes/service.js';

export interface LuckyRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** default: LUCKY_ENABLED=1 */
  enabled?: boolean;
  engine?: EngineFetch | null;
  natalFor?: LuckyDeps['natalFor'];
  now?: () => Date;
}

export function isLuckyEnabled(): boolean {
  return process.env.LUCKY_ENABLED?.trim() === '1';
}

const fail = (res: express.Response, e: unknown) => {
  console.error('[lucky]', (e as Error).message);
  return res.status(500).json({ error: 'lucky_failed' });
};

export function registerLuckyRoutes(app: express.Express, deps: LuckyRouteDeps): void {
  app.post('/api/analytics/events', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const events = (req.body as { events?: unknown })?.events;
    if (Array.isArray(events) && events.length > MAX_EVENTS_PER_CALL) return res.status(400).json({ error: 'too_many_events', max: MAX_EVENTS_PER_CALL });
    try {
      await recordEvents(deps.prisma, userId, (req.body as { session?: unknown })?.session, events);
      return res.status(204).end();
    } catch (e) {
      console.error('[analytics]', (e as Error).message);
      return res.status(204).end();
    }
  });

  if (!(deps.enabled ?? isLuckyEnabled())) return;
  const svc: LuckyDeps = { prisma: deps.prisma, engine: deps.engine ?? null, natalFor: deps.natalFor, now: deps.now };

  app.get('/api/lucky/setup', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      return res.json(await getSetup(svc, userId));
    } catch (e) {
      return fail(res, e);
    }
  });

  app.put('/api/lucky/place', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const place = (req.body as { place?: unknown })?.place;
    if (typeof place !== 'string') return res.status(400).json({ error: 'unknown_place' });
    try {
      return (await setPlace(svc, userId, place)) ? res.status(204).end() : res.status(400).json({ error: 'unknown_place' });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.post('/api/lucky/picks', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const scenario = (req.body as { scenario?: unknown })?.scenario;
    if (typeof scenario !== 'string') return res.status(400).json({ error: 'unknown_scenario' });
    try {
      const r = await addPick(svc, userId, scenario);
      if (r.status === 'unknown') return res.status(400).json({ error: 'unknown_scenario' });
      if (r.status === 'exists') return res.status(409).json({ error: 'already_added' });
      return res.status(201).json(r.status === 'ok' ? { pick: r.pick } : {});
    } catch (e) {
      return fail(res, e);
    }
  });

  app.patch('/api/lucky/picks/:scenario', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const r = await patchPick(svc, userId, req.params.scenario, (req.body ?? {}) as { shown?: unknown; answers?: unknown });
      if (r.status !== 'ok') return res.status(404).json({ error: 'not_found' });
      return res.json({ pick: r.pick });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.delete('/api/lucky/picks/:scenario', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      return (await removePick(svc, userId, req.params.scenario)) ? res.status(204).end() : res.status(404).json({ error: 'not_found' });
    } catch (e) {
      return fail(res, e);
    }
  });

  app.get('/api/lucky/range', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const r = await getRange(svc, userId, { from: req.query.from as string | undefined, to: req.query.to as string | undefined });
      if (r.status === 'no_place') return res.status(409).json({ error: 'no_place' });
      return res.json(r);
    } catch (e) {
      return fail(res, e);
    }
  });
}
