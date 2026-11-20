/**
 * The trusted card lookup of the card chat (docs/reading-engine/85 §4 Backend step 1, §9). The server re-reads the
 * STORED card by id through its board's own read path, with every queue seam turned off, both to render the preamble
 * (GET open) and to build the prompt (send). The same read serves both, so what the page shows is what the reader gets.
 *
 * - You: `getSelfV3` with no-op `queueBuild`/`queueDigest` (no build, no digest queued; no gate: no clock charge).
 * - Love, Work: `getBoardV3` with `readOnly` (its "build on open" block is skipped: no `opened` mark, no card queued) and
 *   the same no-op seams.
 *
 * With `context`, the data the card was prepared from is read too, all stored rows (Node computes nothing astrological):
 * the stored card row (its Oracle card, Personalizer card and store key), the shared prefix rebuilt from the stored
 * slices (natal.core, sky.window, year.tp, frame; byte-identical to what the card's calls cached when its hash is the
 * key's `pre=`), the agreed ledger from the clock layer's stored entry (`layer.clock`), the card's cells and the rows it
 * cites, the card's brief, and the person's stated facts. Each is optional: a missing one is left out, never guessed.
 */
import type { PrismaClient } from '@prisma/client';
import { getBoardsV3 } from '../../config/env.js';
import { cardCells } from '../cards/oracle.js';
import { readStoredCardReading } from '../cards/store.js';
import { cardBriefPrompt } from '../cards/registry.js';
import { sharedPrefix } from '../clocks/reader.js';
import { LAYER_CACHE_SLICE_ID, type LayerCacheEntry } from '../clocks/layerCache.js';
import type { AgreedLedger } from '../clocks/types.js';
import { boardV3CardOn } from '../boards/v3Cards.js';
import { getBoardV3, type BoardV3Response } from '../boards/v3Service.js';
import { loadProfilePack } from '../person/profile.js';
import type { QueueOutcome } from '../self/buildEvent.js';
import { promptText, shortHash } from '../self/v2/slices.js';
import type { ProfilePack } from '../self/v2types.js';
import { cardDef } from '../self/v3/cards.js';
import { getSelfV3 } from '../self/v3/service.js';
import type { CardMatter, SelfV3CardContent, SelfV3CardView, SelfV3Response } from '../self/v3/types.js';
import { readSlices } from '../slices/store.js';
import type { RenderedSlice } from '../slices/types.js';
import { canonicalJson } from '../../techniques/pieces.js';
import {
  CARD_CHAT_PREAMBLE_MAX_CHARS,
  isCardChatBoard,
  type CardChatContext,
  type CardChatError,
  type CardChatPeriod,
  type CardChatPreamble,
  type CardChatPrefix,
  type CardRef,
  type ResolvedCard,
} from './types.js';

type AnyBoardBody = Pick<SelfV3Response, 'status' | 'clock'> & {
  layout: { cards: readonly string[] };
  cards: Array<Pick<SelfV3CardView, 'title' | 'subtitle' | 'locked' | 'features' | 'periods' | 'keyDates' | 'v3' | 'v2'> & { id: string }>;
};

export interface CardChatResolveDeps {
  prisma: PrismaClient;
  now?: () => Date;
  /** overrides BOARDS_V3 */
  boards?: readonly string[];
  /** test seams: the board reads (defaults: getSelfV3 / getBoardV3 with every queue seam off) */
  readSelf?: (prisma: PrismaClient, userId: string) => Promise<SelfV3Response>;
  readBoard?: (prisma: PrismaClient, userId: string, board: 'love' | 'work') => Promise<BoardV3Response>;
  kundliOf?: (prisma: PrismaClient, userId: string) => Promise<string | null>;
  readStored?: typeof readStoredCardReading;
  readSlices?: typeof readSlices;
  loadProfile?: (prisma: PrismaClient, userId: string, asOf: string) => Promise<ProfilePack>;
}

export type ResolveResult = { ok: true; card: ResolvedCard } | { ok: false; error: CardChatError };
export type ContextResult = { ok: true; context: CardChatContext } | { ok: false; error: CardChatError };

const noQueue = async (): Promise<QueueOutcome> => 'skipped';
const noDigest = async (): Promise<void> => undefined;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** the read-only board reads: every queue seam is a no-op, Love/Work skip "build on open" */
export const readOnlySelf = (now?: () => Date) => async (prisma: PrismaClient, userId: string): Promise<SelfV3Response> =>
  (await getSelfV3({ prisma, ...(now ? { now } : {}), queueBuild: noQueue, queueDigest: noDigest }, userId)).body;
export const readOnlyBoard = (now?: () => Date) => async (prisma: PrismaClient, userId: string, board: 'love' | 'work'): Promise<BoardV3Response> =>
  (await getBoardV3({ prisma, ...(now ? { now } : {}), queueBuild: noQueue, queueDigest: noDigest, queueCardsBuild: noQueue, readOnly: true }, userId, board)).body;

async function latestKundliId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  return k?.id ?? null;
}

/** the card's matters (its ledger cells and `matter.<key>` slices); null for an id the board does not hold */
function matterOf(board: CardRef['board'], id: string): readonly CardMatter[] | null {
  if (board === 'self') return cardDef(id)?.matters ?? null;
  return boardV3CardOn(board, id)?.matters ?? null;
}

/** The period on screen: both dates or neither; a named period of the card, else the one that holds the range. */
export function pickPeriod(
  periods: ReadonlyArray<{ from: string; to: string; label: string }>,
  from: string | null | undefined,
  to: string | null | undefined,
): { ok: true; period: CardChatPeriod | null } | { ok: false } {
  const f = from?.trim() || null;
  const t = to?.trim() || null;
  if (!f && !t) return { ok: true, period: null };
  if (!f || !t || !ISO.test(f) || !ISO.test(t) || f > t) return { ok: false };
  const exact = periods.find((p) => p.from === f && p.to === t);
  const holds = exact ?? periods.find((p) => p.from <= f && t <= p.to);
  return holds ? { ok: true, period: { from: holds.from, to: holds.to, label: holds.label } } : { ok: false };
}

/** The card's own text for the period on screen, capped at CARD_CHAT_PREAMBLE_MAX_CHARS (whole lines dropped from the end). */
export function buildPreamble(
  card: Pick<ResolvedCard, 'content' | 'v2' | 'periods' | 'keyDates'>,
  period: CardChatPeriod | null,
): CardChatPreamble {
  const p = period ? card.periods.find((x) => x.from === period.from && x.to === period.to) ?? null : null;
  const headline = (p?.headline ?? card.content?.line ?? card.v2?.headline ?? '').trim();
  const lines = p
    ? p.text.map((t) => t.trim()).filter(Boolean)
    : card.periods.length
      ? card.periods.map((x) => `${x.label}: ${x.headline}`.trim())
      : (card.v2?.body ?? []).map((t) => t.trim()).filter(Boolean);
  const keyDates = (period ? card.keyDates.filter((k) => k.date >= period.from && k.date <= period.to) : card.keyDates).map((k) => ({ date: k.date, label: k.label }));
  const confirm = card.content?.confirm?.text?.trim() || null;
  let budget = CARD_CHAT_PREAMBLE_MAX_CHARS - headline.length - (confirm?.length ?? 0) - keyDates.reduce((n, k) => n + k.label.length + 12, 0);
  const kept: string[] = [];
  for (const l of lines) {
    if (l.length > budget) break;
    kept.push(l);
    budget -= l.length;
  }
  return { headline: headline.slice(0, CARD_CHAT_PREAMBLE_MAX_CHARS), lines: kept, keyDates, confirm };
}

/**
 * The card on the person's board, read through the board's own read path with no side effect. Errors: the board or
 * card is unknown, the board is not served (Love/Work outside BOARDS_V3), the card is not on the person's board, its
 * flag or the card-chat feature is off or locked, it has no stored text yet, the period is not one of the card's.
 */
export async function resolveCard(deps: CardChatResolveDeps, userId: string, ref: CardRef): Promise<ResolveResult> {
  if (!isCardChatBoard(ref.board)) return { ok: false, error: 'unknown_board' };
  if (!ref.id || !matterOf(ref.board, ref.id)) return { ok: false, error: 'unknown_card' };
  if (ref.board !== 'self' && !(deps.boards ?? getBoardsV3()).includes(ref.board)) return { ok: false, error: 'board_off' };
  const [body, kundliId] = await Promise.all([
    ref.board === 'self'
      ? (deps.readSelf ?? readOnlySelf(deps.now))(deps.prisma, userId)
      : (deps.readBoard ?? readOnlyBoard(deps.now))(deps.prisma, userId, ref.board),
    (deps.kundliOf ?? latestKundliId)(deps.prisma, userId),
  ]);
  const b = body as unknown as AnyBoardBody;
  if (b.status === 'no_kundli' || !kundliId) return { ok: false, error: 'no_kundli' };
  const view = b.cards.find((c) => c.id === ref.id);
  // a card whose flag is off is not in the body at all
  if (!view) return { ok: false, error: 'card_not_on_board' };
  if (view.locked) return { ok: false, error: 'locked' };
  const grant = view.features?.['feature.card_chat'];
  if (!grant) return { ok: false, error: 'feature_off' };
  if (grant.locked) return { ok: false, error: 'locked' };
  if (!b.layout.cards.includes(ref.id)) return { ok: false, error: 'card_not_on_board' };
  const content: SelfV3CardContent | null = view.v3 ?? null;
  const v2card = view.v2?.card ?? null;
  const v2 = v2card ? { headline: v2card.headline ?? '', body: [...(v2card.body ?? [])] } : null;
  if (!content && !v2) return { ok: false, error: 'card_not_ready' };
  const periods = (view.periods ?? []).map((p) => ({ label: p.label, from: p.from, to: p.to, headline: p.headline, text: [...p.text] }));
  const picked = pickPeriod(periods, ref.from, ref.to);
  if (!picked.ok) return { ok: false, error: 'bad_period' };
  const keyDates = (view.keyDates ?? []).map((k) => ({ date: k.date, label: k.label }));
  const boardCards = b.layout.cards
    .filter((id) => id !== ref.id)
    .map((id) => ({ id, title: b.cards.find((c) => c.id === id)?.title ?? '' }))
    .filter((c) => c.title);
  const card: ResolvedCard = {
    board: ref.board,
    id: ref.id,
    title: view.title,
    subtitle: view.subtitle ?? '',
    kundliId,
    clock: b.clock?.system ?? '',
    period: picked.period,
    preamble: { headline: '', lines: [], keyDates: [], confirm: null },
    content,
    v2,
    periods,
    keyDates,
    boardCards,
    matters: matterOf(ref.board, ref.id) ?? [],
  };
  card.preamble = buildPreamble(card, picked.period);
  return { ok: true, card };
}

/** the grounding hash of a ledger, as the card runner keys a card on it (`cards/run.ts`) */
export const ledgerGroundingHash = (ledger: AgreedLedger): string =>
  shortHash(canonicalJson(ledger.cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of, c.evidence])));

function parseLayer(text: string | undefined): AgreedLedger | null {
  if (!text) return null;
  try {
    const e = JSON.parse(text) as LayerCacheEntry;
    return e?.ledger && Array.isArray(e.ledger.cells) ? e.ledger : null;
  } catch {
    return null;
  }
}

/** every key the stored card cites (card, spans, pattern), without braces */
function citedKeys(c: CardChatContext['oracle']): string[] {
  if (!c) return [];
  const all = [...(c.evidence ?? []), ...c.spans.flatMap((s) => s.evidence ?? []), ...(c.pattern?.evidence ?? [])];
  return [...new Set(all.map((k) => String(k).trim().replace(/^\{|\}$/g, '')).filter(Boolean))];
}

/** Rows of the card's matter slices that hold a cited key not already in the prefix, each once, at most `max`. */
export function evidenceRowsOf(matterSlices: readonly RenderedSlice[], keys: readonly string[], prefixKeys: ReadonlySet<string>, max = 40): string[] {
  const want = keys.filter((k) => !prefixKeys.has(k));
  if (!want.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of matterSlices) {
    for (const line of s.text.split('\n')) {
      const l = line.trim();
      if (!l || seen.has(l) || !want.some((k) => l.includes(`{${k}}`))) continue;
      seen.add(l);
      out.push(l);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** The card and the data it was prepared from (send path). Stored rows only; every part optional. */
export async function resolveCardContext(deps: CardChatResolveDeps, userId: string, ref: CardRef): Promise<ContextResult> {
  const r = await resolveCard(deps, userId, ref);
  if (!r.ok) return r;
  const card = r.card;
  const now = (deps.now ?? (() => new Date()))();
  const sliceIds = ['natal.core', 'sky.window', 'year.tp', 'frame', LAYER_CACHE_SLICE_ID, ...card.matters.map((m) => `matter.${m}`)];
  const [stored, slices, profile] = await Promise.all([
    card.clock ? (deps.readStored ?? readStoredCardReading)(deps.prisma, card.kundliId, card.clock, card.id).catch(() => null) : Promise.resolve(null),
    (deps.readSlices ?? readSlices)(deps.prisma, card.kundliId, sliceIds).catch(() => ({}) as Awaited<ReturnType<typeof readSlices>>),
    (deps.loadProfile ?? loadProfilePack)(deps.prisma, userId, dayOf(now)).catch((): ProfilePack | null => null),
  ]);
  const by = slices as Record<string, RenderedSlice | undefined>;
  let prefix: CardChatPrefix | null = null;
  if (by['sky.window'] && by['year.tp'] && by['frame']) {
    const sp = sharedPrefix({ natal: by['natal.core'] ?? null, sky: by['sky.window'], year: by['year.tp'], frame: by['frame'] }, dayOf(now));
    prefix = { text: sp.text, dated: sp.dated, keys: sp.keys, hash: sp.hash, matchesCard: Boolean(stored?.key && stored.key.includes(`|pre=${sp.hash}|`)) };
  }
  const ledger = parseLayer(by[LAYER_CACHE_SLICE_ID]?.text);
  const cells = ledger ? cardCells(ledger, card.matters as CardMatter[]) : [];
  const ledgerMatchesCard = ledger && stored?.ledgerHash ? ledgerGroundingHash(ledger) === stored.ledgerHash : null;
  const matterSlices = card.matters.map((m) => by[`matter.${m}`]).filter((s): s is RenderedSlice => Boolean(s));
  const evidenceRows = evidenceRowsOf(matterSlices, citedKeys(stored?.oracle ?? null), new Set(prefix?.keys ?? []));
  return {
    ok: true,
    context: {
      card,
      oracle: stored?.oracle ?? null,
      personal: stored?.personal ?? null,
      storeKey: stored?.key ?? null,
      cells,
      ledgerMatchesCard,
      evidenceRows,
      prefix,
      brief: promptText(cardBriefPrompt(card.id as Parameters<typeof cardBriefPrompt>[0])),
      profile,
    },
  };
}
