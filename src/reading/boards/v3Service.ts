/**
 * The Love and Work boards on the You v3 card machine (docs/dashboards/10 §4.1, §4.3, §7 S6). The same build, state
 * doc, ledger, prefix and pack as You: only the card list differs. Nothing here calls a model and nothing here is
 * astrological: the routing reads the person's stated facts and age, everything else is stored rows.
 *
 *   GET   board body (`BoardV3Response`), offline first: each card shows its newest stored reading; the first GET of the
 *         day queues only the active lens's deck cards never read (a lens's first reading is free, made on open)
 *   PUT   versioned layout (`{version, patch}`), then the active lens's unread deck cards are queued and the build too
 *   POST  one card read (queue or Try again); confirm (the same `self.confirm.<claimId>` fact as You)
 */
import type { PrismaClient } from '@prisma/client';
import { getBoardsV3, getCardsReadMinArea, isCardsReadEnabled } from '../../config/env.js';
import { featureContext, readFeatureOverrides, resolveFeatures, type FeatureGrant, type FeatureState } from '../../boards/features.js';
import { effectivePlan, type PlanCode } from '../../billing/plans.js';
import { PrismaPlanStore } from '../../billing/store.js';
import { loadProfilePack } from '../person/profile.js';
import { boardReadingView, cardStateOf, readCardsState, updateCardsState } from '../cards/state.js';
import { readCardReadings } from '../cards/store.js';
import { CARD_STUCK_MS, type CardsStateDoc } from '../cards/types.js';
import { queueSelfReadingBuild, type QueueOutcome } from '../self/buildEvent.js';
import { getSelfV2, writeConfirm, type SelfV2Deps } from '../self/v2api/service.js';
import { redactDeep } from '../self/v2api/response.js';
import type { ProfilePack, SelfV2Response } from '../self/v2types.js';
import { keyDatesFrom, periodsFrom, plainV3Card, readTexts, staleDatesIn } from '../self/v3/foundation.js';
import { areaLayoutRegistry, emptyLayout, mergeLayoutPatch, readBoardLayout, validateLayout, writeLayoutVersioned } from '../self/v3/layout.js';
import { applySelfFeatures, cardWindows, railFromSpans } from '../self/v3/response.js';
import type { BoardReadingView, CardReadError, CardReadState, LayoutError, SelfBoardLayoutView, SelfV3CardContent, SelfV3CardView, SelfV3Response } from '../self/v3/types.js';
import { lensValidity, NO_LENS_REFRESH } from './lensValidity.js';
import { readingGate, type ReadingGateFn } from '../prep/gate.js';
import type { PipelineView } from '../pipeline/types.js';
import { effectiveOptions, shapeSelfCard, type BoardOptions, type CardOptions } from './cardOptions.js';
import {
  boardFactsOf,
  boardV3CardOn,
  boardV3Cards,
  defaultLens,
  isBoardLens,
  showsFor,
  starters,
  V3_LENSES,
  type AreaV3Board,
  type BoardFacts,
  type BoardLens,
  type BoardV3CardDef,
  type BoardV3CardId,
} from './v3Cards.js';

/** one Love or Work card as the page sees it: the You card view with its v3 id and its lens as `group` */
export type BoardV3CardView = Omit<SelfV3CardView, 'id' | 'group' | 'foldedInto' | 'v2'> & { id: BoardV3CardId; group: BoardLens; foldedInto: null; v2: null };

/** GET /api/board/:board/v3 (docs/dashboards/10 §4.3): `SelfV3Response` field for field, plus the board and its lenses */
export interface BoardV3Response extends Omit<SelfV3Response, 'status' | 'layout' | 'cards'> {
  status: 'ok' | 'preparing' | 'no_kundli';
  board: AreaV3Board;
  layout: SelfBoardLayoutView<BoardV3CardId>;
  cards: BoardV3CardView[];
  lenses: Array<{ id: BoardLens; title: string; suggested: BoardV3CardId[] }>;
  activeLens: BoardLens;
  defaultLens: BoardLens;
}

export interface BoardV3Deps extends SelfV2Deps {
  /** overrides `isCardsReadEnabled` */
  cardsRead?: boolean;
  /** overrides BOARDS_V3 */
  boards?: readonly AreaV3Board[];
  readCardReadings?: typeof readCardReadings;
  planOf?: (prisma: PrismaClient, userId: string) => Promise<PlanCode>;
  featureOverrides?: (prisma: PrismaClient, userId: string) => Promise<Map<string, FeatureState>>;
  /** the build that reads the cards (default: the one per-kundli Self build) */
  queueCardsBuild?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<QueueOutcome>;
  /**
   * docs/reading-engine/85 §4 step 1: a read with no side effect (the card chat re-reads a stored card). Skips "build on
   * open" entirely: no `opened` mark, no card queued, no build. Pass no-op `queueBuild`/`queueDigest` with it.
   */
  readOnly?: boolean;
  /** the lens's own refresh dates (default: from its newest stored card readings; docs/billing/03 §10) */
  lensValidity?: typeof lensValidity;
}

export const boardV3Enabled = (board: AreaV3Board, boards: readonly string[] = getBoardsV3()): boolean => boards.includes(board);

const defaultPlanOf = async (prisma: PrismaClient, userId: string): Promise<PlanCode> => effectivePlan(await new PrismaPlanStore(prisma).getAccount(userId));
const defaultQueue = (prisma: PrismaClient, userId: string, kundliId: string) => queueSelfReadingBuild({ prisma }, userId, kundliId, 'self');
const dayOf = (d: Date): string => d.toISOString().slice(0, 10);
let overridesWarned = false;

async function latestKundliId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  return k?.id ?? null;
}

/** the lens in force: the stored one, else the person's default */
export function activeLensOf(board: AreaV3Board, layout: { boardOptions: { lens?: string } }, facts: BoardFacts, age: number | null): BoardLens {
  return isBoardLens(board, layout.boardOptions.lens) ? layout.boardOptions.lens : defaultLens(board, facts, age);
}

/** the deck cards of one lens, in the person's order */
export function lensDeck(board: AreaV3Board, cards: readonly string[], lens: BoardLens): BoardV3CardId[] {
  return cards.flatMap((id) => {
    const d = boardV3CardOn(board, id);
    return d && d.lens === lens ? [d.id] : [];
  });
}

/** The plain lines a v3 Love/Work card shows where an option cannot be honoured yet (no engine words). */
function boardOptionNotes(o: CardOptions): string[] {
  const notes: string[] = [];
  if (o.view === 'arc') notes.push('The long arc is not on this board yet. This card shows your year.');
  if (o.length === 'deep') notes.push('Deep shows every part we have. Longer writing comes with a later reading.');
  return notes;
}

export interface BoardCardViewsInput {
  board: AreaV3Board;
  facts: BoardFacts;
  age: number | null;
  /** the person's deck (a card on it is always listed, whatever its showWhen) */
  deck: readonly string[];
  readings: Partial<Record<string, SelfV3CardContent>>;
  states: Partial<Record<string, CardReadState>> | null;
  /** suggested ids per lens */
  suggested: ReadonlySet<string>;
  today: string;
  builtAt: string | null;
}

/** Pure: the board's card views over its registry and the stored readings (redacted once, plain words only). */
export function boardCardViews(i: BoardCardViewsInput): BoardV3CardView[] {
  const listed = boardV3Cards(i.board).filter((d) => i.deck.includes(d.id) || showsFor(d, i.facts, i.age));
  return listed.map((def: BoardV3CardDef<BoardV3CardId>) => {
    const raw = i.readings[def.id];
    const v3 = raw ? plainV3Card(redactDeep(raw)) : null;
    const available = def.offered;
    const w = cardWindows(null, v3);
    const staleDates = staleDatesIn(readTexts(null, v3), i.today, i.builtAt);
    return {
      id: def.id,
      group: def.lens,
      title: def.title,
      subtitle: def.subtitle,
      foldedInto: null,
      periods: periodsFrom(w, i.today),
      keyDates: keyDatesFrom(w, i.today),
      stale: staleDates.length > 0,
      staleDates,
      features: {},
      locked: null,
      description: def.description,
      suggested: available && i.suggested.has(def.id),
      sensitive: def.sensitive,
      available,
      unavailableReason: available ? null : 'Coming soon',
      status: v3 ? 'ok' : 'pending',
      state: i.states?.[def.id] ?? (v3 ? 'ready' : 'not_read'),
      firstLine: v3?.line ?? null,
      defaultSections: [...def.defaultSections],
      rail: v3 ? railFromSpans(v3, i.today) : [],
      standing: [],
      v3,
      v2: null,
    } satisfies BoardV3CardView;
  });
}

export type GetBoardV3Result = { body: BoardV3Response; queued: BoardV3CardId[] };

/** GET /api/board/:board/v3 for the signed-in person (the route checks BOARDS_V3 and the reading flag first). */
export async function getBoardV3(deps: BoardV3Deps, userId: string, board: AreaV3Board): Promise<GetBoardV3Result> {
  const now = (deps.now ?? (() => new Date()))();
  const today = dayOf(now);
  const v2 = await getSelfV2(deps, userId);
  const kundliId = v2.body.status === 'no_kundli' ? null : v2.kundliId !== undefined ? v2.kundliId : await latestKundliId(deps.prisma, userId);
  if (!kundliId) return { body: emptyBody(board, v2.body, null), queued: [] };
  const ids = boardV3Cards(board).map((d) => d.id);
  const [layout, readings, doc0, plan, overrides, profile] = await Promise.all([
    readBoardLayout(deps.prisma, kundliId, board).catch((e) => {
      console.warn('[board:v3] layout read failed:', (e as Error).message);
      return emptyLayout<BoardV3CardId>();
    }),
    (deps.readCardReadings ?? readCardReadings)(deps.prisma, kundliId, v2.body.clock.system, ids).catch(() => ({})),
    readCardsState(deps.prisma, kundliId, now),
    (deps.planOf ?? defaultPlanOf)(deps.prisma, userId).catch((): PlanCode => 'free'),
    (deps.featureOverrides ?? readFeatureOverrides)(deps.prisma, userId).catch((e) => {
      if (!overridesWarned) console.warn('[board:v3] feature overrides read failed (logged once):', (e as Error).message);
      overridesWarned = true;
      return new Map<string, FeatureState>();
    }),
    (deps.loadProfile ?? loadProfilePack)(deps.prisma, userId, today).catch((): ProfilePack | null => null),
  ]);
  const facts = boardFactsOf(profile);
  const age = profile?.ageYears ?? null;
  const lens = activeLensOf(board, layout, facts, age);
  const dflt = defaultLens(board, facts, age);
  const read = readings as Partial<Record<string, SelfV3CardContent>>;

  // build on open, offline first (doc 10 §4.1 step 2; docs/billing/03): opening never re-reads a card that has a stored
  // reading (the newest one on the clock is served, whatever day it was made). Once per board per day, the active lens's
  // deck cards that were never read are queued: a lens's first reading, and a card newly added, are made free on open.
  // A fresh reading of a lens already read is the paid refresh (POST /api/boards/:board/refresh).
  let doc: CardsStateDoc = doc0;
  let queued: BoardV3CardId[] = [];
  const deck = lensDeck(board, layout.cards, lens);
  // doc 11 §4.8: while the gate is locked the board is not marked opened and nothing is queued, so its free first
  // reading is still made on the first open after the gate opens
  const gated = Boolean(v2.pipeline?.locked);
  if (!deps.readOnly && !gated && !doc0.opened?.[board] && deck.length >= getCardsReadMinArea()) {
    // the deck's own rows (the board-wide read above is capped and could leave a read card out of its window)
    const own = (await (deps.readCardReadings ?? readCardReadings)(deps.prisma, kundliId, v2.body.clock.system, deck).catch(() => null)) as Partial<Record<string, SelfV3CardContent>> | null;
    const has = (id: string) => Boolean(read[id] ?? own?.[id]);
    if (own) {
      queued = deck.filter((id) => !has(id) && !['queued', 'reading'].includes(cardStateOf(doc0, id, false, now)));
      doc = await updateCardsState(deps.prisma, userId, kundliId, now, (d) => {
        d.opened = { ...(d.opened ?? {}), [board]: true };
        for (const id of queued) d.cards[id] = { state: 'queued', at: now.toISOString() };
        if (queued.length && d.stage === 'done') d.stage = 'cards';
      });
      if (queued.length) void (deps.queueCardsBuild ?? defaultQueue)(deps.prisma, userId, kundliId).catch((e) => console.warn('[board:v3] build queue failed:', (e as Error).message));
    }
  }

  const states: Partial<Record<string, CardReadState>> = {};
  for (const id of ids) states[id] = cardStateOf(doc, id, Boolean(read[id]), now);
  const reading: BoardReadingView = boardReadingView(doc, layout.cards, read, now, true);
  const suggested = new Set<string>(starters(board, lens, facts, age));
  let cards = boardCardViews({ board, facts, age, deck: layout.cards, readings: read, states, suggested, today, builtAt: v2.body.builtAt });
  // doc 71 §4.4 item 4: each card shaped by the person's options, then the board's (a filter over stored content)
  cards = cards.map((c) => {
    const shaped = shapeSelfCard(c, layout.options?.[c.id], layout.boardOptions as Partial<BoardOptions>);
    return { ...shaped, optionNotes: boardOptionNotes(effectiveOptions(layout.options?.[c.id], layout.boardOptions as Partial<BoardOptions>)) };
  });
  // docs/billing/03 §10: the active lens's own dates (its newest card readings), and a lens refreshed today (not given
  // back) is not offered again today
  const mark = doc.lensRefresh?.[`${board}:${lens}`];
  const own = await (deps.lensValidity ?? lensValidity)(deps.prisma, kundliId, v2.body.clock.system, deck, today, mark);
  const refresh = mark && mark.outcome !== 'given_back' ? { ...own, due: false } : own;
  const body: BoardV3Response = {
    ...baseOf(board, v2.body),
    refresh,
    status: doc.preparing ? 'preparing' : 'ok',
    readVersion: Object.keys(read).length ? 'v3' : null,
    layout,
    cards,
    reading,
    lenses: V3_LENSES[board].map((l) => ({ id: l.id, title: l.title, suggested: starters(board, l.id, facts, age) })),
    activeLens: lens,
    defaultLens: dflt,
    ...(v2.pipeline ? { pipeline: v2.pipeline } : {}),
  };
  return { body: applySelfFeatures<BoardV3CardView, BoardV3Response>(body, resolveFeatures(featureContext(plan, overrides)), board), queued };
}

function baseOf(board: AreaV3Board, v2: SelfV2Response): Omit<BoardV3Response, 'status' | 'readVersion' | 'layout' | 'cards' | 'reading' | 'lenses' | 'activeLens' | 'defaultLens'> {
  return {
    board,
    builtAt: v2.builtAt,
    clock: v2.clock,
    profile: v2.profile,
    // docs/billing/03 §10: each lens has its own dates; getBoardV3 sets them (none before a reading)
    refresh: { ...NO_LENS_REFRESH },
    build: v2.build,
    quality: v2.quality ?? null,
    features: {} as Record<string, FeatureGrant>,
  };
}

function emptyBody(board: AreaV3Board, v2: SelfV2Response, lens: BoardLens | null): BoardV3Response {
  const l = lens ?? defaultLens(board, {}, null);
  return {
    ...baseOf(board, v2),
    status: 'no_kundli',
    readVersion: null,
    layout: emptyLayout<BoardV3CardId>(),
    cards: [],
    reading: null,
    lenses: V3_LENSES[board].map((x) => ({ id: x.id, title: x.title, suggested: starters(board, x.id, {}, null) })),
    activeLens: l,
    defaultLens: l,
  };
}

/** `pipeline`: the reading gate was locked (docs/techniques/11 §4.8); the layout is saved, nothing is queued */
export type PutBoardLayoutResult =
  | { ok: true; layout: SelfBoardLayoutView<BoardV3CardId>; reading?: { queued: BoardV3CardId[] }; pipeline?: PipelineView }
  | { ok: false; status: 409; error: 'stale_layout'; layout: SelfBoardLayoutView<BoardV3CardId> }
  | { ok: false; status: 400 | 404; error: LayoutError | 'no_kundli'; detail?: string };

export interface BoardQueueDeps {
  now?: () => Date;
  cardsRead?: boolean;
  queueBuild?: (prisma: PrismaClient, userId: string, kundliId: string) => Promise<QueueOutcome>;
  readCardReadings?: typeof readCardReadings;
  clockOf?: (prisma: PrismaClient, kundliId: string) => Promise<string | null>;
  loadProfile?: (prisma: PrismaClient, userId: string, asOf: string) => Promise<ProfilePack>;
  /** the reading gate (docs/techniques/11 rev 4 §4.8; default `readingGate`) */
  readingGate?: ReadingGateFn;
}

async function preferredClock(prisma: PrismaClient, kundliId: string): Promise<string | null> {
  const { loadReadingClockSet } = await import('../self/sub/pressure.js');
  return (await loadReadingClockSet(prisma, kundliId).catch(() => null))?.spine ?? null;
}

/**
 * PUT /api/board/:board/v3/layout `{version, patch}` (doc 75 §4.1, the same as You): a stale version is refused with
 * 409 `stale_layout` and the layout now stored. Then the active lens's unread deck cards are queued with the build.
 */
export async function putBoardV3Layout(prisma: PrismaClient, userId: string, board: AreaV3Board, body: unknown, deps: BoardQueueDeps = {}): Promise<PutBoardLayoutResult> {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as { version?: unknown; patch?: unknown }) : null;
  if (!b || (b.patch === undefined && b.version === undefined)) return { ok: false, status: 400, error: 'bad_body' };
  if (b.version !== undefined && typeof b.version !== 'string') return { ok: false, status: 400, error: 'bad_body' };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  const registry = areaLayoutRegistry(board);
  const current = await readBoardLayout(prisma, kundliId, board);
  if (typeof b.version === 'string' && b.version !== current.version) return { ok: false, status: 409, error: 'stale_layout', layout: current };
  const merged = b.patch !== undefined ? mergeLayoutPatch(current, b.patch) : { ok: true as const, body: body as Record<string, unknown> };
  if (!merged.ok) return { ok: false, status: 400, error: merged.error };
  const check = validateLayout(merged.body, registry);
  if (!check.ok) return { ok: false, status: 400, error: check.error, ...(check.detail ? { detail: check.detail } : {}) };
  const w = await writeLayoutVersioned(prisma, userId, kundliId, check.layout, current.version, board, registry);
  if (!w.ok) return { ok: false, status: 409, error: 'stale_layout', layout: w.layout };
  return queueLensDeck(prisma, userId, kundliId, board, w.layout, deps);
}

async function queueLensDeck(prisma: PrismaClient, userId: string, kundliId: string, board: AreaV3Board, layout: SelfBoardLayoutView<BoardV3CardId>, deps: BoardQueueDeps): Promise<PutBoardLayoutResult> {
  if (!(deps.cardsRead ?? isCardsReadEnabled())) return { ok: true, layout };
  // doc 11 §4.8: the layout is saved; while the gate is locked no card is marked and no build starts
  const pipeline = await (deps.readingGate ?? readingGate)(prisma, kundliId);
  if (pipeline.locked) return { ok: true, layout, reading: { queued: [] }, pipeline };
  try {
    const now = (deps.now ?? (() => new Date()))();
    let lens: BoardLens;
    if (isBoardLens(board, layout.boardOptions.lens)) lens = layout.boardOptions.lens;
    else {
      const p = await (deps.loadProfile ?? loadProfilePack)(prisma, userId, dayOf(now)).catch(() => null);
      lens = defaultLens(board, boardFactsOf(p), p?.ageYears ?? null);
    }
    const deck = lensDeck(board, layout.cards, lens);
    if (deck.length < getCardsReadMinArea()) return { ok: true, layout };
    const [read, doc] = await Promise.all([
      (deps.clockOf ?? preferredClock)(prisma, kundliId).then((clock) => (clock ? (deps.readCardReadings ?? readCardReadings)(prisma, kundliId, clock, deck) : {})),
      readCardsState(prisma, kundliId, now),
    ]);
    const have = read as Partial<Record<string, SelfV3CardContent>>;
    const queued = deck.filter((id) => !have[id] && !['queued', 'reading'].includes(cardStateOf(doc, id, false, now)));
    if (queued.length) {
      await updateCardsState(prisma, userId, kundliId, now, (d) => {
        for (const id of queued) d.cards[id] = { state: 'queued', at: now.toISOString() };
        d.stage = d.stage === 'done' ? 'cards' : d.stage;
      });
      void (deps.queueBuild ?? defaultQueue)(prisma, userId, kundliId).catch((e) => console.warn('[board:v3] build queue failed:', (e as Error).message));
    }
    return { ok: true, layout, reading: { queued } };
  } catch (e) {
    console.warn('[board:v3] card queue failed:', (e as Error).message);
    return { ok: true, layout, reading: { queued: [] } };
  }
}

/** `already_read`: Try again is for a failed, stuck or never-read card; a good reading is refreshed with its lens (paid) */
export type ReadBoardCardResult =
  | { ok: true; status: 202; state: 'queued' }
  | { ok: false; status: 400 | 404 | 409 | 503; error: CardReadError | 'already_read' }
  | { ok: false; status: 409; error: 'preparing'; pipeline: PipelineView };

/** POST /api/board/:board/v3/cards/:id/read: queue or retry one card of this board. */
export async function readBoardV3Card(prisma: PrismaClient, userId: string, board: AreaV3Board, cardId: string, deps: BoardQueueDeps = {}): Promise<ReadBoardCardResult> {
  if (!(deps.cardsRead ?? isCardsReadEnabled())) return { ok: false, status: 503, error: 'off' };
  const def = boardV3CardOn(board, cardId);
  if (!def) return { ok: false, status: 400, error: 'unknown_card' };
  if (!def.offered) return { ok: false, status: 400, error: 'card_not_offered' };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  const now = (deps.now ?? (() => new Date()))();
  const doc = await readCardsState(prisma, kundliId, now);
  const e = doc.cards[def.id];
  if (e && e.state === 'reading' && now.getTime() - Date.parse(e.at) <= CARD_STUCK_MS) return { ok: false, status: 409, error: 'already_reading' };
  // docs/billing/03 §10: a card with a good reading on the clock is not read again for free (its last try did not fail)
  if (e?.state !== 'failed' && e?.state !== 'queued' && e?.state !== 'reading') {
    const clock = await (deps.clockOf ?? preferredClock)(prisma, kundliId).catch(() => null);
    const have = clock ? ((await (deps.readCardReadings ?? readCardReadings)(prisma, kundliId, clock, [def.id]).catch(() => ({}))) as Partial<Record<string, unknown>>) : {};
    if (have[def.id]) return { ok: false, status: 409, error: 'already_read' };
  }
  // doc 11 §4.8: no card is marked and no build queued while the gate is locked
  const pipeline = await (deps.readingGate ?? readingGate)(prisma, kundliId);
  if (pipeline.locked) return { ok: false, status: 409, error: 'preparing', pipeline };
  // no day cap (docs/billing/README.md "Spend cap per operation"): the build this queues is its own operation, its own budget
  await updateCardsState(prisma, userId, kundliId, now, (d) => {
    d.cards[def.id] = { state: 'queued', at: now.toISOString() };
  });
  await (deps.queueBuild ?? defaultQueue)(prisma, userId, kundliId).catch(() => 'skipped' as const);
  return { ok: true, status: 202, state: 'queued' };
}

/** POST /api/board/:board/v3/confirm: the same fact store as You (`self.confirm.<claimId>`). */
export const writeConfirmBoardV3 = writeConfirm;

