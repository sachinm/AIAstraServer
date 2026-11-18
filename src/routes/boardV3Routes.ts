/**
 * The Love and Work boards on the You v3 card machine (docs/dashboards/10 §4.3). Always registered; a board not in
 * BOARDS_V3 answers 404 `{ error: 'board_v3_off' }` (the page falls back to the legacy board). Every route is the
 * signed-in person's own; every answer is private, no-store. No model call is made here.
 *
 *   GET  /api/board/:board/v3                 → 200 BoardV3Response + ETag | 304 | 404 { status: 'no_kundli', … }
 *                                               | 404 { error: 'board_v3_off' } | 400 unknown_board | 503 off | timeout
 *   POST /api/board/:board/v3/cards/:id/read  → 202 { state: 'queued' } | 400 unknown_card | card_not_offered | 404
 *                                               | 409 already_reading | 429 spend_cap | 503 off
 *   POST /api/board/:board/v3/confirm         { claimId, answer } → 204 | 400 bad_claim | bad_answer
 *
 * PUT /api/board/:board/v3/layout stays in boardCardsRoutes.ts and is dispatched there on the body's shape.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { getBoardsV3, getSelfV3RouteBudgetMs, isCardsReadEnabled } from '../config/env.js';
import { assertOwnAccount } from '../graphql/rbac.js';
import { isAreaV3Board, type AreaV3Board } from '../reading/boards/v3Cards.js';
import { getBoardV3, readBoardV3Card, writeConfirmBoardV3, type BoardQueueDeps, type BoardV3Deps } from '../reading/boards/v3Service.js';
import { SELF_V2_CACHE_CONTROL } from './selfV2Routes.js';
import { BudgetExceeded, ifNoneMatchHas, strongETag, withinBudget } from './selfV3Routes.js';

export interface BoardV3RouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  budgetMs?: number;
  v3?: Omit<BoardV3Deps, 'prisma'>;
  cards?: BoardQueueDeps;
}

export const BOARD_V3_OFF = 'board_v3_off';

/** The board named in the path when it is served on v3, else the error answer is sent and null returned. */
export function boardV3Param(req: express.Request, res: express.Response, boards: readonly string[] = getBoardsV3()): AreaV3Board | null {
  const b = String(req.params.board ?? '');
  if (!isAreaV3Board(b)) {
    res.status(400).json({ error: 'unknown_board' });
    return null;
  }
  if (!boards.includes(b)) {
    res.status(404).json({ error: BOARD_V3_OFF });
    return null;
  }
  return b;
}

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

export function registerBoardV3Routes(app: express.Express, deps: BoardV3RouteDeps): void {
  const v3: BoardV3Deps = { prisma: deps.prisma, ...(deps.v3 ?? {}) };
  const budgetMs = () => deps.budgetMs ?? getSelfV3RouteBudgetMs();

  const user = async (req: express.Request, res: express.Response): Promise<{ userId: string; board: AreaV3Board } | null> => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return null;
    if (!ownAccount(userId, req, res)) return null;
    const board = boardV3Param(req, res, deps.v3?.boards ?? getBoardsV3());
    return board ? { userId, board } : null;
  };

  app.get('/api/board/:board/v3', async (req, res) => {
    const u = await user(req, res);
    if (!u) return;
    if (!(deps.v3?.cardsRead ?? isCardsReadEnabled())) return res.status(503).json({ error: 'off' });
    try {
      const r = await withinBudget(getBoardV3(v3, u.userId, u.board), budgetMs());
      const json = JSON.stringify(r.body);
      const tag = strongETag(json);
      res.setHeader('ETag', tag);
      if (r.body.status !== 'no_kundli' && ifNoneMatchHas(req.headers['if-none-match'], tag)) return res.status(304).end();
      return res
        .status(r.body.status === 'no_kundli' ? 404 : 200)
        .type('application/json')
        .send(json);
    } catch (e) {
      if (e instanceof BudgetExceeded) {
        console.warn(JSON.stringify({ msg: '[board:v3] route budget exceeded', board: u.board }));
        if (res.headersSent) return;
        res.setHeader('Retry-After', '1');
        return res.status(503).json({ error: 'timeout' });
      }
      console.error('[board:v3]', (e as Error).message);
      return res.status(500).json({ error: 'board_v3_failed' });
    }
  });

  app.post('/api/board/:board/v3/cards/:id/read', async (req, res) => {
    const u = await user(req, res);
    if (!u) return;
    try {
      const r = await readBoardV3Card(deps.prisma, u.userId, u.board, String(req.params.id ?? ''), deps.cards ?? {});
      return r.ok ? res.status(202).json({ state: r.state }) : res.status(r.status).json({ error: r.error });
    } catch (e) {
      console.error('[board:v3:card-read]', (e as Error).message);
      return res.status(500).json({ error: 'board_card_read_failed' });
    }
  });

  app.post('/api/board/:board/v3/confirm', async (req, res) => {
    const u = await user(req, res);
    if (!u) return;
    const r = await writeConfirmBoardV3(deps.prisma, u.userId, req.body).catch(() => ({ ok: false as const, error: 'write_failed' }));
    return r.ok ? res.status(204).end() : res.status(r.error === 'write_failed' ? 500 : 400).json({ error: r.error });
  });
}
