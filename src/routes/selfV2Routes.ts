/**
 * HTTP surface of the Self board v2 (docs/reading-engine/66 §4.4, §4.5). Mounted when SELF_V2_ENABLED=1 (unset: follows
 * AREA_ENABLED). Every route is the signed-in person's own: no route takes a user id, and a request that names another
 * account is refused (assertOwnAccount). Every answer is `Cache-Control: private, no-store`.
 *
 *   GET  /api/self/v2          → 200 SelfV2Response (status ok | pending | preparing) | 404 SelfV2Response (no_kundli)
 *                                pending: nothing stored yet; one build is queued and the page polls
 *   PUT  /api/self/v2/clock    { system } → 202 { usage, status:'building', alsoChanges:['love','work'] }
 *                                | 200 { usage, status:'unchanged', alsoChanges:[] }  already the board's clock, no charge
 *                                | 400 unknown_system | 400 not_applicable | 404 no_kundli   (never 402: billing/02 §9)
 *   POST /api/self/v2/confirm  { claimId, answer: yes|partly|no|skip } → 204 | 400 bad_claim | bad_answer
 *   POST /api/self/v2/mood     { mood: heavy|mixed|fine } → 204 | 400 bad_mood
 *
 * The v1 PUT /api/self/clock (selfReadingRoutes.ts) stays as it is for the old page; v2 lives under /api/self/v2.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { isSelfV2Enabled } from '../config/env.js';
import { assertOwnAccount } from '../graphql/rbac.js';
import { getSelfV2, switchClock, writeConfirm, writeMood, type SelfV2Deps } from '../reading/self/v2api/service.js';

export interface SelfV2RouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  enabled?: boolean;
  v2?: Omit<SelfV2Deps, 'prisma'>;
}

export const SELF_V2_CACHE_CONTROL = 'private, no-store, no-cache, must-revalidate';

/** A request that names a user id other than the caller's (query or body) is another account's: refused. */
function ownAccount(userId: string, req: express.Request, res: express.Response): boolean {
  const q = req.query?.userId;
  const b = (req.body as { userId?: unknown } | undefined)?.userId;
  const target = typeof q === 'string' ? q : typeof b === 'string' ? b : null;
  try {
    assertOwnAccount(userId, target);
    return true;
  } catch {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
}

export function registerSelfV2Routes(app: express.Express, deps: SelfV2RouteDeps): boolean {
  if (!(deps.enabled ?? isSelfV2Enabled())) return false;
  const v2: SelfV2Deps = { prisma: deps.prisma, ...(deps.v2 ?? {}) };
  const now = () => (v2.now ?? (() => new Date()))();

  const user = async (req: express.Request, res: express.Response): Promise<string | null> => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return null;
    return ownAccount(userId, req, res) ? userId : null;
  };

  app.get('/api/self/v2', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const r = await getSelfV2(v2, userId);
      return res.status(r.body.status === 'no_kundli' ? 404 : 200).json(r.body);
    } catch (e) {
      console.error('[self:v2]', (e as Error).message);
      return res.status(500).json({ error: 'self_v2_failed' });
    }
  });

  app.put('/api/self/v2/clock', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const r = await switchClock(v2, userId, (req.body as { system?: unknown } | undefined)?.system);
      if (!r.ok) return res.status(r.status).json({ error: r.error });
      return res.status(r.status).json(r.body);
    } catch (e) {
      console.error('[self:v2:clock]', (e as Error).message);
      return res.status(500).json({ error: 'self_clock_failed' });
    }
  });

  app.post('/api/self/v2/confirm', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    const r = await writeConfirm(deps.prisma, userId, req.body).catch(() => ({ ok: false as const, error: 'write_failed' }));
    return r.ok ? res.status(204).end() : res.status(r.error === 'write_failed' ? 500 : 400).json({ error: r.error });
  });

  app.post('/api/self/v2/mood', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    const r = await writeMood(deps.prisma, userId, req.body, now()).catch(() => ({ ok: false as const, error: 'write_failed' }));
    return r.ok ? res.status(204).end() : res.status(r.error === 'write_failed' ? 500 : 400).json({ error: r.error });
  });

  return true;
}
