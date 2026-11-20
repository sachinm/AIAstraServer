/**
 * A fresh reading of one Love or Work lens, the person's own ask (docs/billing/03 "Per-lens refresh";
 * POST /api/boards/love|work/refresh while the board is on v3). A lens is a sub-dashboard: Love has dating, marriage,
 * friends and allies; Work has career_start, primary_job, hobby and business.
 *
 *   - the lens is the body's `lens` when given, else the stored layout's `boardOptions.lens` (else the person's default)
 *   - a lens never read for this kundli: this is its first reading, free (its unread deck cards are queued, nothing held)
 *   - else the lens's own `due` (its newest card readings' "Good until", lensValidity.ts) must hold, or a deck card was
 *     read before the full-thread reading (no technical story: `deeperReadingReady`, charged as usual), or 409 `not_due`
 *   - `charged` is true only when the gate counted a question (not for exempt roles, plans off or a same-day repeat)
 *   - one question is held under `lensRefreshKey(board, lens, day)`; at the limit 402 and nothing is queued (the stored
 *     cards stay as they are)
 *   - the lens's deck cards are queued with a `force` mark (read again even when their store key is unchanged) and the
 *     one Self build is queued; the build settles the question at its end (lensRefreshSettle.ts): committed when a card
 *     was read, given back when none was. A build that cannot be queued gives it back here and answers 409
 *   - a second ask for the same lens the same day, while the first is being read or was read, re-reads nothing and
 *     costs nothing (200 `repeat`); after a given-back refresh it is a new ask
 *
 * Nothing here calls a model or reads the chart.
 */
import type { PrismaClient } from '@prisma/client';
import { getCardsReadMinArea } from '../../config/env.js';
import { quotaBody, type PlanStatus, type QuestionGate } from '../../billing/questionGate.js';
import { cardStateOf, deeperReadingReady, readCardsState, updateCardsState } from '../cards/state.js';
import { readCardReadings } from '../cards/store.js';
import type { CardsStateDoc } from '../cards/types.js';
import { queueSelfReadingBuild, type QueueOutcome } from '../self/buildEvent.js';
import { lensRefreshOutcome } from './lensRefreshSettle.js';
import { lensValidity } from './lensValidity.js';
import { getBoardV3, lensDeck, type BoardV3Deps } from './v3Service.js';
import { isBoardLens, type AreaV3Board, type BoardLens, type BoardV3CardId } from './v3Cards.js';

export type LensRefreshGate = Pick<QuestionGate, 'reserveLensRefresh' | 'settleLensRefresh' | 'getStatus'>;

export interface LensRefreshDeps {
  prisma: PrismaClient;
  gate: LensRefreshGate;
  now?: () => Date;
  /** the board read's seams (the read is side-effect free: no `opened` mark, no queue) */
  v3?: Omit<BoardV3Deps, 'prisma' | 'now'>;
  /** the one per-kundli Self build that reads the cards (default: queueSelfReadingBuild) */
  queueBuild?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<QueueOutcome>;
  readCardReadings?: typeof readCardReadings;
  /** the lens's own refresh dates (default: its newest stored card readings) */
  lensValidity?: typeof lensValidity;
}

export interface LensRefreshAnswer {
  status: 200 | 400 | 402 | 404 | 409;
  body: Record<string, unknown>;
}

/** the state doc key of one lens's paid refresh */
export const lensMarkKey = (board: AreaV3Board, lens: BoardLens): string => `${board}:${lens}`;

const noQueue = async (): Promise<QueueOutcome> => 'skipped';
const defaultQueue = (prisma: PrismaClient, userId: string, kundliId: string) => queueSelfReadingBuild({ prisma }, userId, kundliId, 'self');
/** a build that will read the queued cards: a new one, or the one running now (it takes cards queued while it runs) */
const QUEUED: readonly QueueOutcome[] = ['invoked', 'in_process', 'already_building'];

export async function refreshBoardLens(deps: LensRefreshDeps, userId: string, board: AreaV3Board, lensParam?: unknown): Promise<LensRefreshAnswer> {
  if (lensParam !== undefined && lensParam !== null && !isBoardLens(board, lensParam)) return { status: 400, body: { error: 'unknown_lens', code: 'unknown_lens' } };
  const now = (deps.now ?? (() => new Date()))();
  const day = now.toISOString().slice(0, 10);
  const read = await getBoardV3(
    { prisma: deps.prisma, ...(deps.v3 ?? {}), ...(deps.now ? { now: deps.now } : {}), queueBuild: noQueue, queueDigest: async () => undefined, queueCardsBuild: noQueue, readOnly: true },
    userId,
    board,
  );
  const body = read.body;
  if (body.status === 'no_kundli') return { status: 404, body: { error: 'no_kundli' } };
  if (body.status === 'preparing') return { status: 409, body: { error: 'not_ready', code: 'not_ready' } };
  const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (!kundli) return { status: 404, body: { error: 'no_kundli' } };
  const kundliId = kundli.id;
  const lens: BoardLens = isBoardLens(board, lensParam) ? lensParam : body.activeLens;
  const deck = lensDeck(board, body.layout.cards, lens);
  if (!deck.length || deck.length < getCardsReadMinArea()) return { status: 409, body: { error: 'not_ready', code: 'not_ready', lens } };

  const [have, doc] = await Promise.all([
    (deps.readCardReadings ?? readCardReadings)(deps.prisma, kundliId, body.clock.system, deck) as Promise<Partial<Record<string, unknown>>>,
    readCardsState(deps.prisma, kundliId, now),
  ]);
  const live = (id: BoardV3CardId) => ['queued', 'reading'].includes(cardStateOf(doc, id, Boolean(have[id]), now));
  const usage = async () => {
    const u = await deps.gate.getStatus(userId);
    return u ? { usage: u } : {};
  };

  // a lens never read: this is its first reading, free (the same as opening it)
  if (!deck.some((id) => have[id])) {
    const queued = deck.filter((id) => !live(id));
    if (queued.length) {
      const ok = await queueCards(deps, userId, kundliId, now, queued, null);
      if (!ok) return { status: 409, body: { error: 'not_ready', code: 'not_ready', lens } };
    }
    return { status: 200, body: { status: 'queued', board, lens, first: true, charged: false, queued, ...(await usage()) } };
  }

  // the same lens again today: free, and nothing is read again while the first ask is being read or was read
  const key = lensMarkKey(board, lens);
  const mark = doc.lensRefresh?.[key];
  if (mark && mark.outcome !== 'given_back' && (mark.outcome === 'committed' || lensRefreshOutcome(doc, mark, now) !== 'given_back')) {
    return { status: 200, body: { status: 'queued', board, lens, repeat: true, charged: false, queued: [], ...(await usage()) } };
  }

  // this lens's own "Good until" (its newest card readings; docs/billing/03 §10)
  const dates = await (deps.lensValidity ?? lensValidity)(deps.prisma, kundliId, body.clock.system, deck, day, mark);
  // a deck card read before the full-thread reading (no technical story) makes the lens due: the refresh is charged as
  // usual (Sachin: after a prompt release everyone refreshes and the quota pays); once every card carries a story the
  // lens is due again only when its Good until passes
  const deeper = deeperReadingReady(deck, have as Partial<Record<string, { story?: string | null }>>);
  if (!dates.due && !deeper) return { status: 409, body: { error: 'not_due', code: 'not_due', valid_until: dates.validUntil, lens } };

  const held = await deps.gate.reserveLensRefresh(userId, board, lens, day);
  if (!held.ok) return { status: 402, body: { ...quotaBody(held.usage as PlanStatus), lens } };
  // counted only when the gate took a question (not for exempt roles, plans off, or a repeat of today's key)
  const charged = Boolean(held.ticket.id);
  let queued: BoardV3CardId[] = [];
  try {
    // a card being read right now is left to finish (its `done` lands after this refresh and counts as read)
    queued = deck.filter((id) => cardStateOf(doc, id, Boolean(have[id]), now) !== 'reading');
    const ok = await queueCards(deps, userId, kundliId, now, queued, { key, cards: deck });
    if (!ok) {
      await deps.gate.settleLensRefresh(userId, board, lens, day, false);
      return { status: 409, body: { error: 'not_ready', code: 'not_ready', lens } };
    }
  } catch (e) {
    await deps.gate.settleLensRefresh(userId, board, lens, day, false);
    await undoQueue(deps.prisma, userId, kundliId, now, queued, key).catch(() => undefined);
    throw e;
  }
  return { status: 200, body: { status: 'queued', board, lens, charged, queued, ...(await usage()) } };
}

/**
 * Marks the cards queued (with `force` and the lens mark when `paid`) and queues the Self build. False, with the marks
 * taken back, when no build will read them (one failed in the last half hour, or the queue failed).
 */
async function queueCards(deps: LensRefreshDeps, userId: string, kundliId: string, now: Date, ids: BoardV3CardId[], paid: { key: string; cards: BoardV3CardId[] } | null): Promise<boolean> {
  const at = now.toISOString();
  await updateCardsState(deps.prisma, userId, kundliId, now, (d) => {
    for (const id of ids) d.cards[id] = { state: 'queued', at };
    if (paid) {
      d.force = { ...(d.force ?? {}) };
      for (const id of ids) d.force[id] = at;
      d.lensRefresh = { ...(d.lensRefresh ?? {}), [paid.key]: { at, cards: [...paid.cards] } };
    }
    if (ids.length && d.stage === 'done') d.stage = 'cards';
  });
  const outcome = await (deps.queueBuild ?? defaultQueue)(deps.prisma, userId, kundliId).catch((): QueueOutcome => 'skipped');
  if (QUEUED.includes(outcome)) return true;
  await undoQueue(deps.prisma, userId, kundliId, now, ids, paid?.key ?? null);
  return false;
}

async function undoQueue(prisma: PrismaClient, userId: string, kundliId: string, now: Date, ids: BoardV3CardId[], key: string | null): Promise<void> {
  const at = now.toISOString();
  await updateCardsState(prisma, userId, kundliId, now, (d: CardsStateDoc) => {
    for (const id of ids) {
      if (d.cards[id]?.state === 'queued' && d.cards[id]?.at === at) delete d.cards[id];
      if (d.force?.[id] === at) delete d.force[id];
    }
    if (key && d.lensRefresh?.[key]?.at === at) delete d.lensRefresh[key];
  });
}
