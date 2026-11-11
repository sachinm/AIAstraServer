/**
 * The Love and Work card picker (docs/reading-engine/71 §4.5). Always mounted: no model call, no astrological content.
 * Every answer is the signed-in person's own and private.
 *
 *   GET /api/board/:board/v3/catalogue  board love|work → 200 { groups, cards } | 400 unknown_board
 *   GET /api/board/:board/v3/layout     → 200 AreaLayoutView | 404 no_kundli | 400 unknown_board
 *   PUT /api/board/:board/v3/layout     { cards, options? } → 200 AreaLayoutView | 400 { error, detail? } | 404 no_kundli
 *
 * Self keeps /api/self/v3 (doc 68); doc 69 folds it in here later.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { catalogue, isAreaBoard, readAreaLayout, validateAreaLayout, writeAreaLayout } from '../reading/boards/catalogue.js';
import { SELF_V2_CACHE_CONTROL } from './selfV2Routes.js';

export interface BoardCardsRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
}

export function registerBoardCardsRoutes(app: express.Express, deps: BoardCardsRouteDeps): void {
  const kundliOf = (userId: string) => deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });

  const board = (req: express.Request, res: express.Response) => {
    const b = String(req.params.board ?? '');
    if (!isAreaBoard(b)) {
      res.status(400).json({ error: 'unknown_board' });
      return null;
    }
    return b;
  };

  app.get('/api/board/:board/v3/catalogue', async (req, res) => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = board(req, res);
    if (!b) return;
    return res.json(catalogue(b));
  });

  app.get('/api/board/:board/v3/layout', async (req, res) => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = board(req, res);
    if (!b) return;
    try {
      const k = await kundliOf(userId);
      if (!k) return res.status(404).json({ error: 'no_kundli' });
      return res.json(await readAreaLayout(deps.prisma, k.id, b));
    } catch (e) {
      console.error('[board:layout]', (e as Error).message);
      return res.status(500).json({ error: 'board_layout_failed' });
    }
  });

  app.put('/api/board/:board/v3/layout', async (req, res) => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const b = board(req, res);
    if (!b) return;
    const check = validateAreaLayout(b, req.body);
    if (!check.ok) return res.status(400).json({ error: check.error, ...(check.detail ? { detail: check.detail } : {}) });
    try {
      const k = await kundliOf(userId);
      if (!k) return res.status(404).json({ error: 'no_kundli' });
      return res.json(await writeAreaLayout(deps.prisma, userId, k.id, b, check.cards, check.options));
    } catch (e) {
      console.error('[board:layout]', (e as Error).message);
      return res.status(500).json({ error: 'board_layout_failed' });
    }
  });
}
