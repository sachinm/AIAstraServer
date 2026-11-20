/**
 * The Self board's state from its card readings (plan "retire the v2 Self reading", server step 2; behind
 * SELF_BOARD_FROM_CARDS=1). With the v2 build retired no `self.v2.*` row is written, so every Self read route keys on the
 * card rows instead:
 *
 *   builtAt        the newest `created_at` among the Self cards' newest readings on the board clock, or the time today's
 *                  build recorded reading a card (the `self.v2` marker's `read_at`) when later: a forced re-read keeps
 *                  its row's key, and the Prisma upsert path keeps that row's `created_at` (docs/TODOS.md), so the
 *                  marker is what moves `builtAt` when a fresh reading lands
 *   cardsRead      Self cards with a stored reading on the clock (Love and Work card rows share the technique and are
 *                  never counted: only the Self registry's ids are read)
 *   nothingStored  no Self card was ever read on this clock: the first reading is the free automatic one
 *   validity       the Self "Good until": the lens rule (`lensValidityFrom`) over the Self deck's newest readings (the
 *                  board layout's cards; every read Self card when the layout holds none of them)
 *
 * Read only; never throws (an unreadable store reads as nothing stored and no dates).
 */
import type { PrismaClient } from '@prisma/client';
import { newestCardRows, readCardReadings } from '../cards/store.js';
import { deeperReadingReady } from '../cards/state.js';
import { lensValidityFrom, NO_LENS_REFRESH, type LensRefreshView } from '../boards/lensValidity.js';
import { READABLE_CARDS } from './v3/cards.js';
import { readLayout } from './v3/layout.js';

export interface SelfBoardState {
  builtAt: string | null;
  cardsRead: number;
  nothingStored: boolean;
  validity: Pick<LensRefreshView, 'madeAt' | 'validUntil' | 'due'>;
}

export const NO_SELF_BOARD_STATE: Readonly<SelfBoardState> = Object.freeze({ builtAt: null, cardsRead: 0, nothingStored: true, validity: { madeAt: null, validUntil: null, due: false } });

type Row = { output: unknown; created_at: Date | string; valid_to?: Date | string | null };

const iso = (d: Date | string): string => (d instanceof Date ? d : new Date(d)).toISOString();

/** Pure: the state from the newest stored rows (newest first), the deck and today's recorded read time. */
export function selfBoardStateFrom(rows: readonly Row[], today: string, deck: readonly string[], readAt?: string | null): SelfBoardState {
  const self = new Set<string>(READABLE_CARDS);
  const newest = new Map<string, Row>();
  for (const r of rows) {
    const o = r.output as { card?: string; content?: unknown } | null;
    if (o?.card && o.content && self.has(o.card) && !newest.has(o.card)) newest.set(o.card, r);
  }
  if (!newest.size) return { ...NO_SELF_BOARD_STATE, validity: { ...NO_SELF_BOARD_STATE.validity } };
  const made = [...newest.values()].map((r) => iso(r.created_at)).sort();
  let builtAt = made[made.length - 1]!;
  if (readAt && readAt > builtAt) builtAt = readAt;
  const onDeck = deck.length ? [...newest.entries()].filter(([id]) => deck.includes(id)).map(([, r]) => r) : [];
  const v = lensValidityFrom(onDeck.length ? onDeck : [...newest.values()], today, readAt ? { at: readAt, cards: [], outcome: 'committed' } : null);
  return { builtAt, cardsRead: newest.size, nothingStored: false, validity: { madeAt: v.madeAt, validUntil: v.validUntil, due: v.due } };
}

export interface SelfBoardStateDeps {
  /** the Self deck (default: the board layout's cards) */
  deck?: readonly string[];
  /** today's recorded read time (the `self.v2` marker's `read_at`), when the caller already holds it */
  readAt?: string | null;
}

/**
 * The board clock for a kundli the way GET /api/self/v2 resolves it (the person's preferred clock when it applies, else
 * the engine's default): for callers that do not hold it (POST /api/boards/self/refresh, GET /api/area/self). Null when
 * the kundli or its rows cannot be read. Never throws.
 */
export async function resolveSelfClock(prisma: PrismaClient, kundliId: string): Promise<string | null> {
  try {
    // loaded here, not at the top: self/service.ts reaches the board modules that import this one
    const [{ readApplicableRow, defaultSystemsPresent }, { parseApplicability, resolveClockV2 }] = await Promise.all([import('./service.js'), import('./clock.js')]);
    const k = await prisma.kundli.findUnique({ where: { id: kundliId }, select: { preferred_dasha: true } });
    const row = readApplicableRow(prisma, kundliId);
    const [present, held] = await Promise.all([defaultSystemsPresent(prisma, kundliId, row), row]);
    const applicability = held?.payload !== undefined && held?.payload !== null ? parseApplicability(held.payload) : null;
    return resolveClockV2(k?.preferred_dasha ?? null, present, applicability).primary || null;
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self board clock read failed', error: (e as Error).message?.slice(0, 200) }));
    return null;
  }
}

/**
 * The You board's dates from its card readings (`selfBoardDates` with SELF_BOARD_FROM_CARDS=1): made at, last good day
 * and due, by the Self "Good until" rule. Null when no Self card was read on the board clock (nothing made yet: the first
 * reading is the free automatic one, never a charged refresh).
 */
export async function selfCardDates(
  prisma: PrismaClient,
  kundliId: string,
  today: string,
  clock?: string | null,
  deps: SelfBoardStateDeps & { readMarker?: (prisma: PrismaClient, kundliId: string, now: Date) => Promise<{ readAt?: string }> } = {},
): Promise<{ made_at: string; valid_until: string | null; refresh_due: boolean } | null> {
  const c = clock ?? (await resolveSelfClock(prisma, kundliId));
  if (!c) return null;
  let readAt = deps.readAt;
  if (readAt === undefined) {
    const { readSelfV2Marker } = await import('./v2/store.js');
    readAt = (await (deps.readMarker ?? readSelfV2Marker)(prisma, kundliId, new Date(`${today}T12:00:00Z`)).catch(() => ({ readAt: undefined }))).readAt ?? null;
  }
  const s = await readSelfBoardState(prisma, kundliId, c, today, { ...deps, readAt });
  if (s.nothingStored || !s.validity.madeAt) return null;
  return { made_at: s.validity.madeAt, valid_until: s.validity.validUntil, refresh_due: s.validity.due };
}

/**
 * The Self board's `reading.deeperReadingReady` from the store (POST /api/boards/self/refresh): a card on the board
 * layout read on the board clock without a technical story, with the story contract on. Such a board counts as due
 * (the refresh is charged as usual). False when the store cannot be read. Never throws.
 */
export async function selfDeeperReadingReady(prisma: PrismaClient, kundliId: string, clock?: string | null): Promise<boolean> {
  try {
    const c = clock ?? (await resolveSelfClock(prisma, kundliId));
    if (!c) return false;
    const deck = (await readLayout(prisma, kundliId)).cards as readonly string[];
    if (!deck.length) return false;
    const readings = await readCardReadings(prisma, kundliId, c, deck);
    return deeperReadingReady(deck, readings as Partial<Record<string, { story?: string | null }>>);
  } catch {
    return false;
  }
}

/** The Self board's state on the clock from the store. Never throws. */
export async function readSelfBoardState(prisma: PrismaClient, kundliId: string, clock: string, today: string, deps: SelfBoardStateDeps = {}): Promise<SelfBoardState> {
  try {
    const [rows, deck] = await Promise.all([
      newestCardRows(prisma, kundliId, clock, READABLE_CARDS) as Promise<Row[]>,
      deps.deck ? Promise.resolve(deps.deck) : readLayout(prisma, kundliId).then((l) => l.cards as readonly string[]).catch(() => [] as readonly string[]),
    ]);
    return selfBoardStateFrom(rows, today, deck, deps.readAt ?? null);
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'self board state read failed', error: (e as Error).message?.slice(0, 200) }));
    return { ...NO_SELF_BOARD_STATE, validity: { ...NO_LENS_REFRESH } };
  }
}
