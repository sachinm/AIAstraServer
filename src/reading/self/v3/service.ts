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
import { cardDef, isCardOffered, SELF_CARDS } from './cards.js';
import { shapeSelfCard } from '../../boards/cardOptions.js';
import { emptyLayout, mergeLayoutPatch, readLayout, validateLayout, writeLayout, writeLayoutVersioned } from './layout.js';
import { applySelfFeatures, buildSelfV3Response } from './response.js';
import { featureContext, readFeatureOverrides, resolveFeatures, type FeatureState } from '../../../boards/features.js';
import { effectivePlan, type PlanCode } from '../../../billing/plans.js';
import { PrismaPlanStore } from '../../../billing/store.js';
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
  /** doc 75: the person's plan (default: their billing account through `effectivePlan`; `free` when it cannot be read) */
  planOf?: (prisma: PrismaClient, userId: string) => Promise<PlanCode>;
  /** doc 75: the person's feature overrides (default `readFeatureOverrides`; none when the table cannot be read) */
  featureOverrides?: (prisma: PrismaClient, userId: string) => Promise<Map<string, FeatureState>>;
}

/** until migration m52 is applied the overrides table is missing; that is said once per process, not per GET */
let overridesWarned = false;

const defaultPlanOf = async (prisma: PrismaClient, userId: string): Promise<PlanCode> => effectivePlan(await new PrismaPlanStore(prisma).getAccount(userId));

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
  // the v2 read already resolved the chart; look it up again only for a caller whose v2 read did not say
  const kundliId = v2.kundliId !== undefined ? v2.kundliId : await latestKundliId(deps.prisma, userId);
  if (!kundliId) return { body: buildSelfV3Response({ v2: v2.body, layout: emptyLayout(), today }), queued: v2.queued };
  const now = (deps.now ?? (() => new Date()))();
  const cardsRead = deps.cardsRead ?? isCardsReadEnabled();
  const [layout, legacy, suggested, perCard, doc, plan, overrides] = await Promise.all([
    readLayout(deps.prisma, kundliId).catch((e) => {
      console.warn('[self:v3] layout read failed:', (e as Error).message);
      return emptyLayout();
    }),
    (deps.readV3Cards ?? readSelfV3Cards)(deps.prisma, kundliId, v2.body.clock.system).catch(() => null),
    deps.suggest ? deps.suggest(deps.prisma, userId, kundliId).catch(() => null) : Promise.resolve(null),
    cardsRead ? (deps.readCardReadings ?? readCardReadings)(deps.prisma, kundliId, v2.body.clock.system).catch(() => ({})) : Promise.resolve({}),
    cardsRead ? readCardsState(deps.prisma, kundliId, now) : Promise.resolve(null),
    (deps.planOf ?? defaultPlanOf)(deps.prisma, userId).catch((): PlanCode => 'free'),
    (deps.featureOverrides ?? readFeatureOverrides)(deps.prisma, userId).catch((e) => {
      if (!overridesWarned) console.warn('[self:v3] feature overrides read failed (logged once):', (e as Error).message);
      overridesWarned = true;
      return new Map<string, FeatureState>();
    }),
  ]);
  // a card read on its own (doc 70) wins over the Phase B three-call card
  const v3Cards: Partial<Record<SelfCardId, SelfV3CardContent>> = { ...(legacy ?? {}), ...perCard };
  let states: Partial<Record<SelfCardId, CardReadState>> | null = null;
  if (doc) {
    states = {};
    for (const id of Object.keys({ ...doc.cards, ...v3Cards }) as SelfCardId[]) states[id] = cardStateOf(doc, id, Boolean(v3Cards[id]), now);
  }
  const reading = doc ? boardReadingView(doc, layout.cards, v3Cards, now, true) : null;
  const body = buildSelfV3Response({ v2: v2.body, v3Cards: Object.keys(v3Cards).length ? v3Cards : null, suggested, layout, today, states, cardsRead, reading });
  // doc 71 §4.4 item 4: each card shaped by the person's options, then the board's (a filter over stored content,
  // nothing new made; no option adds a field, so no role-gated content follows a face)
  body.cards = body.cards.map((c) => shapeSelfCard(c, layout.options?.[c.id], layout.boardOptions));
  return { body: applySelfFeatures(body, resolveFeatures(featureContext(plan, overrides))), queued: v2.queued };
}

/**
 * GET /api/self/v3/catalogue: the picker's tiles without card bodies. It reads the chart id, the registry, the suggested
 * set and today's card states only: no board read (no stored build, clock, refresh or layout read) and no build queued.
 * So `firstLine` is null, and a card whose reading is stored only in a Phase B row shows `not_read` here.
 */
export async function getSelfV3Catalogue(deps: SelfV3Deps, userId: string): Promise<SelfV3CatalogueEntry[] | null> {
  const kundliId = await latestKundliId(deps.prisma, userId);
  if (!kundliId) return null;
  const now = (deps.now ?? (() => new Date()))();
  const cardsRead = deps.cardsRead ?? isCardsReadEnabled();
  const [suggested, doc] = await Promise.all([
    deps.suggest ? deps.suggest(deps.prisma, userId, kundliId).catch(() => null) : Promise.resolve(null),
    cardsRead ? readCardsState(deps.prisma, kundliId, now) : Promise.resolve(null),
  ]);
  const suggestedSet = suggested ? new Set<SelfCardId>(suggested) : null;
  return SELF_CARDS.map((def) => {
    const available = isCardOffered(def, cardsRead);
    return {
      id: def.id,
      group: def.group,
      title: def.title,
      description: def.description,
      suggested: available && (suggestedSet ? suggestedSet.has(def.id) : def.suggested),
      available,
      unavailableReason: available ? null : 'Coming soon',
      firstLine: null,
      state: doc ? cardStateOf(doc, def.id, doc.cards[def.id]?.state === 'done', now) : 'not_read',
    };
  });
}

export type PutLayoutResult =
  | { ok: true; layout: SelfBoardLayoutView; reading?: { queued: SelfCardId[] } }
  | { ok: false; status: 409; error: 'stale_layout'; layout: SelfBoardLayoutView; detail?: string }
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
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as { version?: unknown; patch?: unknown }) : null;
  const versioned = Boolean(b && (b.patch !== undefined || b.version !== undefined));
  let layout: SelfBoardLayoutView;
  if (!versioned) {
    const check = validateLayout(body);
    if (!check.ok) return { ok: false, status: 400, error: check.error, ...(check.detail ? { detail: check.detail } : {}) };
    const kundliId = await latestKundliId(prisma, userId);
    if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
    layout = await writeLayout(prisma, userId, kundliId, check.layout);
    return queueAfterLayout(prisma, userId, kundliId, layout, deps);
  }
  // doc 75 §4.1: a patch on the version the page holds; a stale version is refused with the layout now stored
  if (b!.version !== undefined && typeof b!.version !== 'string') return { ok: false, status: 400, error: 'bad_body' };
  const kundliId = await latestKundliId(prisma, userId);
  if (!kundliId) return { ok: false, status: 404, error: 'no_kundli' };
  const current = await readLayout(prisma, kundliId);
  if (typeof b!.version === 'string' && b!.version !== current.version) return { ok: false, status: 409, error: 'stale_layout', layout: current };
  const merged = b!.patch !== undefined ? mergeLayoutPatch(current, b!.patch) : { ok: true as const, body: body as Record<string, unknown> };
  if (!merged.ok) return { ok: false, status: 400, error: merged.error };
  const check = validateLayout(merged.body);
  if (!check.ok) return { ok: false, status: 400, error: check.error, ...(check.detail ? { detail: check.detail } : {}) };
  const w = await writeLayoutVersioned(prisma, userId, kundliId, check.layout, current.version);
  if (!w.ok) return { ok: false, status: 409, error: 'stale_layout', layout: w.layout };
  layout = w.layout;
  return queueAfterLayout(prisma, userId, kundliId, layout, deps);
}

async function queueAfterLayout(prisma: PrismaClient, userId: string, kundliId: string, layout: SelfBoardLayoutView, deps: CardsQueueDeps): Promise<PutLayoutResult> {
  if (!(deps.cardsRead ?? isCardsReadEnabled()) || layout.cards.length < getCardsReadMin()) return { ok: true, layout };
  try {
    const now = (deps.now ?? (() => new Date()))();
    const [read, doc] = await Promise.all([
      (deps.clockOf ?? preferredClock)(prisma, kundliId).then(
        (clock): Promise<Partial<Record<SelfCardId, SelfV3CardContent>>> | Partial<Record<SelfCardId, SelfV3CardContent>> =>
          clock ? (deps.readCardReadings ?? readCardReadings)(prisma, kundliId, clock) : {},
      ),
      readCardsState(prisma, kundliId, now),
    ]);
    const queued = layout.cards.filter((id) => !read[id] && !['queued', 'reading'].includes(cardStateOf(doc, id, false, now)));
    if (queued.length) {
      await updateCardsState(prisma, userId, kundliId, now, (d) => {
        for (const id of queued) d.cards[id] = { state: 'queued', at: now.toISOString() };
        d.stage = d.stage === 'done' ? 'cards' : d.stage;
      });
      // the cards are marked queued above; starting the build does not hold the answer
      void (deps.queueBuild ?? defaultQueue)(prisma, userId, kundliId).catch((e) => console.warn('[self:v3] build queue failed:', (e as Error).message));
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
