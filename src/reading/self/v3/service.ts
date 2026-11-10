/**
 * The Self board v3 API service (docs/reading-engine/68 §4.6). GET reads what v2 reads (the stored build, the clock, the
 * refresh and build state; it queues a build the same way) and adds the person's layout and the card registry. PUT
 * layout writes the layout. Nothing here calls a model.
 *
 * Doc 70 Phase 3, when the per-card reading is on (`isCardsReadEnabled`: SELF_V3_BUILD=1 and READING_CLOCK_LAYER=1):
 * GET adds each card's reading state and the board's reading line; PUT layout with at least CARDS_READ_MIN cards marks
 * the board's unread cards `queued` and queues the build (which reads them); POST /cards/:id/read queues one card.
 */
import type { PrismaClient } from '@prisma/client';
import { getCardsReadMin, getCardsSpendCapUsd, isCardsReadEnabled } from '../../../config/env.js';
import { boardReadingView, cardStateOf, readCardsState, updateCardsState } from '../../cards/state.js';
import { readCardReadings } from '../../cards/store.js';
import { CARD_STUCK_MS } from '../../cards/types.js';
import { getSelfV2, writeConfirm, type SelfV2Deps } from '../v2api/service.js';
import { queueSelfReadingBuild, type QueueOutcome } from '../buildEvent.js';
import { cardDef, isCardOffered } from './cards.js';
import { emptyLayout, readLayout, validateLayout, writeLayout } from './layout.js';
import { buildSelfV3Response } from './response.js';
import { readSelfV3Cards } from './store.js';
import type { CardReadError, CardReadState, LayoutError, SelfBoardLayoutView, SelfCardId, SelfV3CardContent, SelfV3CatalogueEntry, SelfV3Response } from './types.js';

export interface SelfV3Deps extends SelfV2Deps {
  /** the stored v3 cards for the board clock (Phase B); default: the newest `self.v3.cards` row; none: filled from v2 */
  readV3Cards?: (prisma: PrismaClient, kundliId: string, clock: string) => Promise<Partial<Record<SelfCardId, SelfV3CardContent>> | null>;
  /** the suggested set for this person (Phase B: from what presses now and the stated focus); default: the registry's */
  suggest?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<SelfCardId[] | null>;
  /** doc 70 Phase 3: overrides `isCardsReadEnabled` */
  cardsRead?: boolean;
  /** doc 70 Phase 3 test seam: the stored per-card readings (default `readCardReadings`) */
  readCardReadings?: typeof readCardReadings;
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
  const now = (deps.now ?? (() => new Date()))();
  const cardsRead = deps.cardsRead ?? isCardsReadEnabled();
  const [layout, legacy, suggested, perCard, doc] = await Promise.all([
    readLayout(deps.prisma, kundliId).catch((e) => {
      console.warn('[self:v3] layout read failed:', (e as Error).message);
      return emptyLayout();
    }),
    (deps.readV3Cards ?? readSelfV3Cards)(deps.prisma, kundliId, v2.body.clock.system).catch(() => null),
    deps.suggest ? deps.suggest(deps.prisma, userId, kundliId).catch(() => null) : Promise.resolve(null),
    cardsRead ? (deps.readCardReadings ?? readCardReadings)(deps.prisma, kundliId, v2.body.clock.system).catch(() => ({})) : Promise.resolve({}),
    cardsRead ? readCardsState(deps.prisma, kundliId, now) : Promise.resolve(null),
  ]);
  // a card read on its own (doc 70) wins over the Phase B three-call card
  const v3Cards: Partial<Record<SelfCardId, SelfV3CardContent>> = { ...(legacy ?? {}), ...perCard };
  let states: Partial<Record<SelfCardId, CardReadState>> | null = null;
  if (doc) {
    states = {};
    for (const id of Object.keys({ ...doc.cards, ...v3Cards }) as SelfCardId[]) states[id] = cardStateOf(doc, id, Boolean(v3Cards[id]), now);
  }
  const reading = doc ? boardReadingView(doc, layout.cards, v3Cards, now, true) : null;
  return {
    body: buildSelfV3Response({ v2: v2.body, v3Cards: Object.keys(v3Cards).length ? v3Cards : null, suggested, layout, today, states, cardsRead, reading }),
    queued: v2.queued,
  };
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
    state: c.state,
  }));
}

export type PutLayoutResult =
  | { ok: true; layout: SelfBoardLayoutView; reading?: { queued: SelfCardId[] } }
  | { ok: false; status: 400 | 404; error: LayoutError | 'no_kundli'; detail?: string };

export interface CardsQueueDeps {
  now?: () => Date;
  cardsRead?: boolean;
  /** queues the build that reads the cards (default: the Self build queue) */
  queueBuild?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<QueueOutcome>;
  readCardReadings?: typeof readCardReadings;
  clockOf?: (prisma: PrismaClient, kundliId: string) => Promise<string | null>;
}

const defaultQueue = (prisma: PrismaClient, userId: string, kundliId: string) => queueSelfReadingBuild({ prisma }, userId, kundliId, 'self');

async function preferredClock(prisma: PrismaClient, kundliId: string): Promise<string | null> {
  const { loadReadingClockSet } = await import('../sub/pressure.js');
  return (await loadReadingClockSet(prisma, kundliId).catch(() => null))?.spine ?? null;
}

/**
 * PUT /api/self/v3/layout: validated against the registry and stored. With the per-card reading on and at least
 * CARDS_READ_MIN cards on the board (doc 70 §4.1 "Trigger"), the board's cards without a stored reading are marked
 * `queued` and the build is queued; changing the board re-reads nothing already read.
 */
export async function putSelfLayout(prisma: PrismaClient, userId: string, body: unknown, deps: CardsQueueDeps = {}): Promise<PutLayoutResult> {
  const check = validateLayout(body);
  if (!check.ok) return { ok: false, status: 400, error: check.error, ...(check.detail ? { detail: check.detail } : {}) };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  const layout = await writeLayout(prisma, userId, kundliId, check.layout);
  if (!(deps.cardsRead ?? isCardsReadEnabled()) || layout.cards.length < getCardsReadMin()) return { ok: true, layout };
  try {
    const now = (deps.now ?? (() => new Date()))();
    const clock = await (deps.clockOf ?? preferredClock)(prisma, kundliId);
    const read = clock ? await (deps.readCardReadings ?? readCardReadings)(prisma, kundliId, clock) : {};
    const doc = await readCardsState(prisma, kundliId, now);
    const queued = layout.cards.filter((id) => !read[id] && !['queued', 'reading'].includes(cardStateOf(doc, id, false, now)));
    if (queued.length) {
      await updateCardsState(prisma, userId, kundliId, now, (d) => {
        for (const id of queued) d.cards[id] = { state: 'queued', at: now.toISOString() };
        d.stage = d.stage === 'done' ? 'cards' : d.stage;
      });
      await (deps.queueBuild ?? defaultQueue)(prisma, userId, kundliId);
    }
    return { ok: true, layout, reading: { queued } };
  } catch (e) {
    console.warn('[self:v3] card queue failed:', (e as Error).message);
    return { ok: true, layout, reading: { queued: [] } };
  }
}

export type ReadCardResult = { ok: true; status: 202; state: 'queued' } | { ok: false; status: 400 | 404 | 409 | 429 | 503; error: CardReadError };

/** POST /api/self/v3/cards/:id/read: queue or retry one card (doc 70 §4.2). */
export async function readSelfV3Card(prisma: PrismaClient, userId: string, cardId: string, deps: CardsQueueDeps = {}): Promise<ReadCardResult> {
  if (!(deps.cardsRead ?? isCardsReadEnabled())) return { ok: false, status: 503, error: 'off' };
  const def = cardDef(cardId);
  if (!def) return { ok: false, status: 400, error: 'unknown_card' };
  if (!isCardOffered(def, true)) return { ok: false, status: 400, error: 'card_not_offered' };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  const now = (deps.now ?? (() => new Date()))();
  const doc = await readCardsState(prisma, kundliId, now);
  const e = doc.cards[def.id];
  if (e && e.state === 'reading' && now.getTime() - Date.parse(e.at) <= CARD_STUCK_MS) return { ok: false, status: 409, error: 'already_reading' };
  if (doc.spentUsd >= getCardsSpendCapUsd()) return { ok: false, status: 429, error: 'spend_cap' };
  await updateCardsState(prisma, userId, kundliId, now, (d) => {
    d.cards[def.id] = { state: 'queued', at: now.toISOString() };
  });
  await (deps.queueBuild ?? defaultQueue)(prisma, userId, kundliId).catch(() => 'skipped' as const);
  return { ok: true, status: 202, state: 'queued' };
}

/** POST /api/self/v3/confirm: the same fact as v2 (`self.confirm.<claimId>`); the next build reads it. */
export const writeConfirmV3 = writeConfirm;
