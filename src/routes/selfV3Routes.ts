/**
 * HTTP surface of the Self board v3 (docs/reading-engine/68 §4.6). Mounted when SELF_V3_ENABLED=1 (unset: off). Every
 * route is the signed-in person's own; a request naming another account is refused. Every answer is private, no-store.
 *
 *   GET  /api/self/v3            → 200 SelfV3Response (status ok | pending | preparing) | 404 SelfV3Response (no_kundli)
 *   GET  /api/self/v3/catalogue  → 200 { cards: SelfV3CatalogueEntry[] } | 404 { error: 'no_kundli' }
 *   PUT  /api/self/v3/layout     { template, cards, sections } → 200 SelfBoardLayoutView & { reading?: { queued } } | 400 { error, detail? } | 404
 *   POST /api/self/v3/confirm    { claimId, answer: yes|partly|no|skip } → 204 | 400 bad_claim | bad_answer
 *   POST /api/self/v3/cards/:id/read  → 202 { state: 'queued' } | 400 unknown_card | card_not_offered | 404 no_kundli
 *                                       | 409 already_reading | 429 spend_cap | 503 off (doc 70 §4.2)
 *
 * The clock switch stays PUT /api/self/v2/clock. GET /api/self/v2 keeps working until v3 is the default.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { isSelfV3Enabled } from '../config/env.js';
import { assertOwnAccount } from '../graphql/rbac.js';
import { getSelfV3, getSelfV3Catalogue, putSelfLayout, readSelfV3Card, writeConfirmV3, type CardsQueueDeps, type SelfV3Deps } from '../reading/self/v3/service.js';
import { SELF_V2_CACHE_CONTROL } from './selfV2Routes.js';

export interface SelfV3RouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  enabled?: boolean;
  v3?: Omit<SelfV3Deps, 'prisma'>;
  /** doc 70 Phase 3: the card queue's seams (the build queue, the flag) */
  cards?: CardsQueueDeps;
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

export function registerSelfV3Routes(app: express.Express, deps: SelfV3RouteDeps): boolean {
  if (!(deps.enabled ?? isSelfV3Enabled())) return false;
  const v3: SelfV3Deps = { prisma: deps.prisma, ...(deps.v3 ?? {}) };

  const user = async (req: express.Request, res: express.Response): Promise<string | null> => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return null;
    return ownAccount(userId, req, res) ? userId : null;
  };

  app.get('/api/self/v3', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const r = await getSelfV3(v3, userId);
      return res.status(r.body.status === 'no_kundli' ? 404 : 200).json(r.body);
    } catch (e) {
      console.error('[self:v3]', (e as Error).message);
      return res.status(500).json({ error: 'self_v3_failed' });
    }
  });

  app.get('/api/self/v3/catalogue', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const cards = await getSelfV3Catalogue(v3, userId);
      return cards ? res.status(200).json({ cards }) : res.status(404).json({ error: 'no_kundli' });
    } catch (e) {
      console.error('[self:v3:catalogue]', (e as Error).message);
      return res.status(500).json({ error: 'self_v3_failed' });
    }
  });

  app.put('/api/self/v3/layout', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const r = await putSelfLayout(deps.prisma, userId, req.body, deps.cards ?? {});
      if (!r.ok) return res.status(r.status).json({ error: r.error, ...(r.detail ? { detail: r.detail } : {}) });
      return res.status(200).json(r.reading ? { ...r.layout, reading: r.reading } : r.layout);
    } catch (e) {
      console.error('[self:v3:layout]', (e as Error).message);
      return res.status(500).json({ error: 'self_layout_failed' });
    }
  });

  app.post('/api/self/v3/confirm', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    const r = await writeConfirmV3(deps.prisma, userId, req.body).catch(() => ({ ok: false as const, error: 'write_failed' }));
    return r.ok ? res.status(204).end() : res.status(r.error === 'write_failed' ? 500 : 400).json({ error: r.error });
  });

  app.post('/api/self/v3/cards/:id/read', async (req, res) => {
    const userId = await user(req, res);
    if (!userId) return;
    try {
      const r = await readSelfV3Card(deps.prisma, userId, String(req.params.id ?? ''), deps.cards ?? {});
      return r.ok ? res.status(202).json({ state: r.state }) : res.status(r.status).json({ error: r.error });
    } catch (e) {
      console.error('[self:v3:card-read]', (e as Error).message);
      return res.status(500).json({ error: 'self_card_read_failed' });
    }
  });

  return true;
}
