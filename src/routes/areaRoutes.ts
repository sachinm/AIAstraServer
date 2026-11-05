/**
 * HTTP surface of the career map, Phase 1 (docs/reading-engine/42 §B.5). Mounted only when AREA_ENABLED=1.
 *
 *   GET  /api/area/career                  the person's career map for today (built once a day), their work status and
 *                                          Looking-back answers → 200 | 404 no kundli | 202 chart not ready
 *   PUT  /api/profile/work-status          { value: yes|between_jobs|own_business|studying } → 204 | 400
 *   POST /api/area/career/checks           { month: 'YYYY-MM', side: support|test, answer: yes|partly|no|skip } → 204 | 400
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { checksFor, getCareer, recordCheck, setWorkStatus, type CareerDeps } from '../reading/area/careerService.js';

export interface AreaRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** default: AREA_ENABLED=1 */
  enabled?: boolean;
  loadInputs?: CareerDeps['loadInputs'];
  now?: () => Date;
}

export function isAreaEnabled(): boolean {
  return process.env.AREA_ENABLED?.trim() === '1';
}

export function registerAreaRoutes(app: express.Express, deps: AreaRouteDeps): boolean {
  if (!(deps.enabled ?? isAreaEnabled())) return false;
  const svc: CareerDeps = { prisma: deps.prisma, loadInputs: deps.loadInputs, now: deps.now };

  app.get('/api/area/career', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    try {
      const r = await getCareer(svc, userId);
      if (r.status === 'no_kundli') return res.status(404).json({ error: 'no_kundli' });
      if (r.status === 'no_data') return res.status(202).json({ error: 'not_ready', notes: r.notes });
      return res.json({ ...r, checks: await checksFor(deps.prisma, userId) });
    } catch (e) {
      console.error('[area]', (e as Error).message);
      return res.status(500).json({ error: 'area_failed' });
    }
  });

  app.put('/api/profile/work-status', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const ok = await setWorkStatus(deps.prisma, userId, String((req.body as { value?: unknown })?.value ?? '')).catch(() => false);
    return ok ? res.status(204).end() : res.status(400).json({ error: 'bad_value' });
  });

  app.post('/api/area/career/checks', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = (req.body ?? {}) as { month?: unknown; side?: unknown; answer?: unknown };
    const ok = await recordCheck(deps.prisma, userId, b.month, b.side, b.answer).catch(() => false);
    return ok ? res.status(204).end() : res.status(400).json({ error: 'bad_check' });
  });
  return true;
}
