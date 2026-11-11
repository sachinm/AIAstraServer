/**
 * The Now card (docs/reading-engine/72), on every board. Mounted when NOW_CARD_ENABLED=1 (unset: off). The signed-in
 * person's own; private, no-store. Free: it never takes a question from the quota.
 *
 *   GET /api/now  → 200 NowView (status ready | unavailable) | 404 NowView (no_kundli)
 *
 * The first request of the day makes the day's Now (the engine pulls, then one model call) and answers when it is done;
 * a second request meanwhile waits on the same work.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { isNowCardEnabled } from '../config/env.js';
import { callGemini } from '../reading/llm/gemini.js';
import { modelFor } from '../reading/llm/models.js';
import { getNow, type NowDeps } from '../reading/now/service.js';
import { SELF_V2_CACHE_CONTROL } from './selfV2Routes.js';

export interface NowRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  enabled?: boolean;
  now?: Partial<Omit<NowDeps, 'prisma'>>;
}

export function registerNowRoutes(app: express.Express, deps: NowRouteDeps): boolean {
  if (!(deps.enabled ?? isNowCardEnabled())) return false;
  app.get('/api/now', async (req, res) => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const view = await getNow({ prisma: deps.prisma, callGemini, model: modelFor('oracle'), ...(deps.now ?? {}) }, userId);
      return res.status(view.status === 'no_kundli' ? 404 : 200).json(view);
    } catch (e) {
      console.error('[now]', (e as Error).message);
      return res.status(500).json({ error: 'now_failed' });
    }
  });
  return true;
}
