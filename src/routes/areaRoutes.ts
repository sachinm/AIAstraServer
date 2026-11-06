/**
 * HTTP surface of the career map, Phase 1 (docs/reading-engine/42 §B.5). Mounted only when AREA_ENABLED=1.
 *
 *   GET  /api/area/career                  the person's career map for today (built once a day), their work status and
 *                                          Looking-back answers → 200 | 404 no kundli | 202 chart not ready
 *   PUT  /api/profile/work-status          { value: yes|between_jobs|own_business|studying } → 204 | 400
 *   GET  /api/area/self                    the You board (docs/reading-engine/54 §3) → 200 ok | 404 no_kundli | 202 preparing
 *   GET  /api/area/love                    the Love board, same shape
 *   POST /api/area/:area/checks            area career|self|love; { month: 'YYYY-MM', side: support|test,
 *                                          answer: yes|partly|no|skip } → 204 | 400 | 404 unknown area
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { CHECK_AREAS, checksFor, getCareer, recordCheck, setWorkStatus, type CareerDeps, type CheckArea } from '../reading/area/careerService.js';
import type { AreaBoardResult, BoardDeps } from '../reading/area/boardService.js';
import { getSelfBoard } from '../reading/area/selfService.js';
import { getLoveBoard } from '../reading/area/loveService.js';

export interface AreaRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** default: AREA_ENABLED=1 */
  enabled?: boolean;
  loadInputs?: CareerDeps['loadInputs'];
  now?: () => Date;
  /** tests: the Self and Love boards' digest, activation, sky and queue readers */
  boards?: Omit<BoardDeps, 'prisma' | 'now'>;
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

  const boardDeps: BoardDeps = { prisma: deps.prisma, now: deps.now, ...(deps.boards ?? {}) };
  const boardRoute = (area: 'self' | 'love', get: (d: BoardDeps, userId: string) => Promise<AreaBoardResult>) =>
    app.get(`/api/area/${area}`, async (req, res) => {
      const userId = await deps.requireUser(req, res);
      if (!userId) return;
      try {
        const r = await get(boardDeps, userId);
        if (r.status === 'no_kundli') return res.status(404).json({ status: 'no_kundli', error: 'no_kundli' });
        if (r.status === 'preparing') return res.status(202).json({ status: 'preparing' });
        return res.json({ ...r, checks: await checksFor(deps.prisma, userId, area) });
      } catch (e) {
        console.error(`[area:${area}]`, (e as Error).message);
        return res.status(500).json({ error: 'area_failed' });
      }
    });
  boardRoute('self', getSelfBoard);
  boardRoute('love', getLoveBoard);

  app.post('/api/area/:area/checks', async (req, res) => {
    const area = req.params.area as CheckArea;
    if (!(CHECK_AREAS as readonly string[]).includes(area)) return res.status(404).json({ error: 'unknown_area' });
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = (req.body ?? {}) as { month?: unknown; side?: unknown; answer?: unknown };
    const ok = await recordCheck(deps.prisma, userId, b.month, b.side, b.answer, area).catch(() => false);
    return ok ? res.status(204).end() : res.status(400).json({ error: 'bad_check' });
  });
  return true;
}
