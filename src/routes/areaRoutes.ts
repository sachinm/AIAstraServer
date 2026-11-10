/**
 * HTTP surface of the career map, Phase 1 (docs/reading-engine/42 §B.5). Mounted only when AREA_ENABLED=1.
 *
 *   GET  /api/area/career                  the person's career map for today (built once a day), their work status and
 *                                          Looking-back answers → 200 | 404 no kundli | 202 chart not ready
 *   PUT  /api/profile/work-status          { value: yes|between_jobs|own_business|studying } → 204 | 400
 *   GET  /api/area/self                    the You board (docs/reading-engine/54 §3) → 200 ok | 404 no_kundli | 202 preparing
 *   GET  /api/area/love                    the Love board, same shape
 *   Offline first (docs/billing/03): each board serves the newest reading made for it, with `made_at`, `valid_until` and
 *   `refresh_due`; only its very first reading is made on open, and that one is free. Opening a board never costs a question.
 *   POST /api/boards/:board/refresh       board self|love|work: a fresh reading the person asked for, once `refresh_due`;
 *                                          takes one question → 200 (love, work: the new board + usage) | 202 (self: the
 *                                          synthesis is made in the background; { status:'building', usage }) |
 *                                          409 not_due | not_ready | building | 402 quota_exhausted | 404 | 400 | 500
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
import { pinActiveGoalWindow, recordWindowOutcomeCheckin } from '../reading/area/shadeResolver.js';
import { questionGate, quotaBody, type BoardCharge, type QuestionGate } from '../billing/questionGate.js';
import { queueSelfReadingBuild, type QueueDeps } from '../reading/self/buildEvent.js';
import { selfBoardDates } from '../reading/self/synthesisValidity.js';

export interface AreaRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** default: AREA_ENABLED=1 */
  enabled?: boolean;
  loadInputs?: CareerDeps['loadInputs'];
  now?: () => Date;
  /** tests: the Self and Love boards' digest, activation, sky and queue readers */
  boards?: Omit<BoardDeps, 'prisma' | 'now'>;
  /** tests: the question gate a fresh reading is charged to (docs/billing/03) */
  gate?: Pick<QuestionGate, 'reserveBoardRefresh' | 'settleBoardRefresh' | 'getStatus'>;
  /** tests: the You synthesis build a fresh reading queues */
  queue?: Pick<QueueDeps, 'build' | 'invoke' | 'now' | 'self'>;
}

export function isAreaEnabled(): boolean {
  return process.env.AREA_ENABLED?.trim() === '1';
}

export function registerAreaRoutes(app: express.Express, deps: AreaRouteDeps): boolean {
  if (!(deps.enabled ?? isAreaEnabled())) return false;
  const svc: CareerDeps = { prisma: deps.prisma, loadInputs: deps.loadInputs, now: deps.now };
  const gate = deps.gate ?? questionGate(deps.prisma);
  const today = () => (deps.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const kundliOf = (userId: string) => deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  /** The You board's dates: its synthesis's own once one is made, else the area reading's (docs/billing/03; selfBoardDates). */
  const youDates = async (userId: string, area: AreaBoardResult & { status: 'ok' }) => {
    const k = await kundliOf(userId);
    return k ? selfBoardDates(deps.prisma, k.id, today(), area) : null;
  };

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
        const dates = area === 'self' ? await youDates(userId, r) : null;
        return res.json({ ...r, ...(dates ?? {}), checks: await checksFor(deps.prisma, userId, area) });
      } catch (e) {
        console.error(`[area:${area}]`, (e as Error).message);
        return res.status(500).json({ error: 'area_failed' });
      }
    });
  boardRoute('self', getSelfBoard);
  boardRoute('love', getLoveBoard);

  const queueDeps: QueueDeps = { prisma: deps.prisma, now: deps.now, ...(deps.queue ?? {}) };
  const BOARDS: readonly BoardCharge[] = ['self', 'love', 'work'];
  app.post('/api/boards/:board/refresh', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const board = req.params.board as BoardCharge;
    if (!BOARDS.includes(board)) return res.status(400).json({ error: 'unknown_board' });
    const day = today();
    const build = (force: boolean) =>
      board === 'work' ? getCareer(svc, userId, { force }) : board === 'love' ? getLoveBoard(boardDeps, userId, { force }) : getSelfBoard(boardDeps, userId, { force });
    let held = false;
    try {
      const kundli = await kundliOf(userId);
      if (!kundli) return res.status(404).json({ error: 'no_kundli' });
      const current = await build(false);
      if (current.status === 'no_kundli') return res.status(404).json({ error: 'no_kundli' });
      if (current.status !== 'ok') return res.status(409).json({ error: 'not_ready', code: 'not_ready' });
      const dates = (board === 'self' ? await selfBoardDates(deps.prisma, kundli.id, day, current) : null) ?? current;
      if (!dates.refresh_due) return res.status(409).json({ error: 'not_due', code: 'not_due', valid_until: dates.valid_until });

      const reserved = await gate.reserveBoardRefresh(userId, board, day);
      if (!reserved.ok) return res.status(402).json(quotaBody(reserved.usage));
      held = true;
      const fresh = await build(true);
      if (fresh.status !== 'ok') {
        await gate.settleBoardRefresh(userId, board, day, false);
        return res.status(409).json({ error: 'not_ready', code: 'not_ready' });
      }
      if (board !== 'self') {
        await gate.settleBoardRefresh(userId, board, day, true);
        const usage = await gate.getStatus(userId);
        return res.json({ ...fresh, checks: await checksFor(deps.prisma, userId, board === 'work' ? undefined : board), ...(usage ? { usage } : {}) });
      }
      // You: the synthesis is made in its own invocation, which commits the question or gives it back
      const outcome = await queueSelfReadingBuild(queueDeps, userId, kundli.id, 'self', { refreshDay: day });
      if (outcome !== 'invoked' && outcome !== 'in_process') {
        await gate.settleBoardRefresh(userId, board, day, false);
        return res.status(409).json({ error: outcome === 'already_building' ? 'building' : 'not_ready', code: outcome === 'already_building' ? 'building' : 'not_ready' });
      }
      const usage = await gate.getStatus(userId);
      return res.status(202).json({ status: 'building', ...(usage ? { usage } : {}) });
    } catch (e) {
      if (held) await gate.settleBoardRefresh(userId, board, day, false);
      console.error(`[boards:refresh:${board}]`, (e as Error).message);
      return res.status(500).json({ error: 'refresh_failed' });
    }
  });

  app.post('/api/area/:area/checks', async (req, res) => {
    const area = req.params.area as CheckArea;
    if (!(CHECK_AREAS as readonly string[]).includes(area)) return res.status(404).json({ error: 'unknown_area' });
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = (req.body ?? {}) as { month?: unknown; side?: unknown; answer?: unknown; subarea?: unknown; shadeTag?: unknown };
    const ok = await recordCheck(deps.prisma, userId, b.month, b.side, b.answer, area).catch(() => false);
    if (ok && (typeof b.subarea === 'string' || typeof b.shadeTag === 'string')) {
      await recordWindowOutcomeCheckin(deps.prisma, userId, {
        area,
        month: String(b.month),
        side: b.side === 'test' ? 'test' : 'support',
        answer: String(b.answer) as 'yes' | 'partly' | 'no' | 'skip',
        ...(typeof b.subarea === 'string' ? { subarea: b.subarea } : {}),
        ...(typeof b.shadeTag === 'string' ? { shadeTag: b.shadeTag } : {}),
      }).catch(() => false);
    }
    return ok ? res.status(204).end() : res.status(400).json({ error: 'bad_check' });
  });

  app.post('/api/area/:area/goal', async (req, res) => {
    const area = req.params.area as CheckArea;
    if (!(CHECK_AREAS as readonly string[]).includes(area)) return res.status(404).json({ error: 'unknown_area' });
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = (req.body ?? {}) as { subarea?: unknown; shadeTag?: unknown; from?: unknown; to?: unknown };
    if (
      typeof b.subarea !== 'string' ||
      !b.subarea.trim() ||
      typeof b.shadeTag !== 'string' ||
      !b.shadeTag.trim() ||
      typeof b.from !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.from) ||
      typeof b.to !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.to)
    ) {
      return res.status(400).json({ error: 'bad_goal' });
    }
    try {
      const pinned = await pinActiveGoalWindow(deps.prisma, userId, {
        area,
        subarea: b.subarea.trim(),
        shadeTag: b.shadeTag.trim(),
        from: b.from,
        to: b.to,
      });
      return res.status(200).json(pinned);
    } catch {
      return res.status(500).json({ error: 'goal_pin_failed' });
    }
  });
  return true;
}
