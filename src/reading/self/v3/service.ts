/**
 * The Self board v3 API service (docs/reading-engine/68 §4.6). GET reads what v2 reads (the stored build, the clock, the
 * refresh and build state; it queues a build the same way) and adds the person's layout and the card registry. PUT
 * layout writes the layout only. Nothing here calls a model.
 */
import type { PrismaClient } from '@prisma/client';
import { getSelfV2, writeConfirm, type SelfV2Deps } from '../v2api/service.js';
import type { QueueOutcome } from '../buildEvent.js';
import { emptyLayout, readLayout, validateLayout, writeLayout } from './layout.js';
import { buildSelfV3Response } from './response.js';
import type { LayoutError, SelfBoardLayoutView, SelfCardId, SelfV3CardContent, SelfV3CatalogueEntry, SelfV3Response } from './types.js';

export interface SelfV3Deps extends SelfV2Deps {
  /** the stored v3 cards for the board clock (Phase B); default: none, the cards are filled from the v2 build */
  readV3Cards?: (prisma: PrismaClient, kundliId: string, clock: string) => Promise<Partial<Record<SelfCardId, SelfV3CardContent>> | null>;
  /** the suggested set for this person (Phase B: from what presses now and the stated focus); default: the registry's */
  suggest?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<SelfCardId[] | null>;
}

async function latestKundliId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  return k?.id ?? null;
}

const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

export type GetSelfV3Result = { body: SelfV3Response; queued: QueueOutcome | null };

/** GET /api/self/v3 for the signed-in person. */
export async function getSelfV3(deps: SelfV3Deps, userId: string): Promise<GetSelfV3Result> {
  const v2 = await getSelfV2(deps, userId);
  const today = dayOf((deps.now ?? (() => new Date()))());
  if (v2.body.status === 'no_kundli') {
    return { body: buildSelfV3Response({ v2: v2.body, layout: emptyLayout(), today }), queued: null };
  }
  const kundliId = await latestKundliId(deps.prisma, userId);
  if (!kundliId) return { body: buildSelfV3Response({ v2: v2.body, layout: emptyLayout(), today }), queued: v2.queued };
  const [layout, v3Cards, suggested] = await Promise.all([
    readLayout(deps.prisma, kundliId).catch((e) => {
      console.warn('[self:v3] layout read failed:', (e as Error).message);
      return emptyLayout();
    }),
    deps.readV3Cards ? deps.readV3Cards(deps.prisma, kundliId, v2.body.clock.system).catch(() => null) : Promise.resolve(null),
    deps.suggest ? deps.suggest(deps.prisma, userId, kundliId).catch(() => null) : Promise.resolve(null),
  ]);
  return { body: buildSelfV3Response({ v2: v2.body, v3Cards, suggested, layout, today }), queued: v2.queued };
}

/** GET /api/self/v3/catalogue: the picker's tiles without card bodies. */
export async function getSelfV3Catalogue(deps: SelfV3Deps, userId: string): Promise<SelfV3CatalogueEntry[] | null> {
  const r = await getSelfV3(deps, userId);
  if (r.body.status === 'no_kundli') return null;
  return r.body.cards.map((c) => ({
    id: c.id,
    group: c.group,
    title: c.title,
    description: c.description,
    suggested: c.suggested,
    available: c.available,
    unavailableReason: c.unavailableReason,
    firstLine: c.firstLine,
  }));
}

export type PutLayoutResult = { ok: true; layout: SelfBoardLayoutView } | { ok: false; status: 400 | 404; error: LayoutError | 'no_kundli'; detail?: string };

/** PUT /api/self/v3/layout: validated against the registry; never queues a build. */
export async function putSelfLayout(prisma: PrismaClient, userId: string, body: unknown): Promise<PutLayoutResult> {
  const check = validateLayout(body);
  if (!check.ok) return { ok: false, status: 400, error: check.error, ...(check.detail ? { detail: check.detail } : {}) };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  return { ok: true, layout: await writeLayout(prisma, userId, kundliId, check.layout) };
}

/** POST /api/self/v3/confirm: the same fact as v2 (`self.confirm.<claimId>`); the next build reads it. */
export const writeConfirmV3 = writeConfirm;
