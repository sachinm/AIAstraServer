/**
 * HTTP surface of the life reading dashboard (docs/reading-engine/54 §4; doc 34 Part 1). Mounted only when
 * LIFE_READING_ENABLED=1, so the path is a 404 when the flag is off.
 *
 *   GET /api/life-reading   200 { status: 'ok', built_at, cached, rule_now, areas[] }
 *                           200 { status: 'no_kundli' }
 *                           202 { status: 'preparing' }   the digest is not ready; it has been queued
 *                           401 without a user, 500 { error: 'life_reading_failed' }
 */
import type express from 'express';
import type { RequireUser } from '../auth/requestAuth.js';
import { getLifeReading, type LifeDeps } from '../reading/life/service.js';

export interface LifeReadingRouteDeps extends LifeDeps {
  requireUser: RequireUser;
  /** default: LIFE_READING_ENABLED=1 */
  enabled?: boolean;
}

export function isLifeReadingEnabled(): boolean {
  return process.env.LIFE_READING_ENABLED?.trim() === '1';
}

export function registerLifeReadingRoutes(app: express.Express, deps: LifeReadingRouteDeps): boolean {
  if (!(deps.enabled ?? isLifeReadingEnabled())) return false;
  app.get('/api/life-reading', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const r = await getLifeReading(deps, userId);
      if (r.status === 'preparing') return res.status(202).json(r);
      return res.json(r);
    } catch (e) {
      console.error('[life-reading]', (e as Error).message);
      return res.status(500).json({ error: 'life_reading_failed' });
    }
  });
  return true;
}
