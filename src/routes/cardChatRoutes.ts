/**
 * A chat on every card (docs/reading-engine/85 §4 API). The card is read on the server every time; the web sends only
 * `{board, cardId, from, to}`.
 *
 *   GET  /api/cards/:board/:cardId/chat?from&to
 *        → 200 CardChatOpenResponse (no model call; the stored card, the period, the cost line, the saved thread)
 *        | 400 unknown_board | unknown_card | bad_period | 403 feature_off | locked
 *        | 404 no_kundli | board_off | card_not_on_board | 409 card_not_ready | 503 timeout
 *
 *   POST /api/chat/ask-stream  { question, card: {board, id, from?, to?}, turnId: uuid, chatId?, newThread? }
 *        (the ask-stream route hands a body with `card` to `handleCardAsk`)
 *        before any SSE frame: the GET errors above, 400 bad_card | bad_turn_id | card_with_focus, 402 quota_exhausted,
 *        409 turn_in_flight, 429 rate_limited
 *        SSE: turn_init → card → start → usage → token… → turn_done{type:'done', chatId, answer, usage, card}
 *             | error{code:'quota_exhausted'|'spend_cap'|…}
 *
 * Billing: each sent question takes one question under `cardchat:<board>:<cardId>:<turnId>`; a retry of the same turnId
 * is free and makes no model call (the saved answer is replayed); a declined topic or a failed answer gives it back.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import { questionGate, quotaBody, type PlanStatus, type QuestionGate, type QuestionTicket } from '../billing/questionGate.js';
import { chatTurnService } from '../chat/chatTurnService.js';
import { getSelfV3RouteBudgetMs } from '../config/env.js';
import { assertOwnAccount } from '../graphql/rbac.js';
import { checkRateLimit } from '../lib/redis/rateLimiter.js';
import { SSE_CACHE_CONTROL } from '../lib/noStore.js';
import { answerCardQuestion, CardChatSpendCapError, type CardChatAnswerDeps } from '../reading/cardChat/answer.js';
import { resolveCard, resolveCardContext, type CardChatResolveDeps } from '../reading/cardChat/resolve.js';
import { cardRefOf, historyOf, loadCardThread, storedCardQuestion } from '../reading/cardChat/thread.js';
import {
  CARD_CHAT_CATEGORY,
  CARD_CHAT_ERROR_STATUS,
  isCardChatBoard,
  type CardChatBoard,
  type CardChatOpenResponse,
  type CardRef,
} from '../reading/cardChat/types.js';
import { boardV3CardOn } from '../reading/boards/v3Cards.js';
import { declinedFor, storedQuestion } from '../reading/policy/declined.js';
import { cardDef } from '../reading/self/v3/cards.js';
import { persistAskTurn } from '../services/askChatTurn.js';
import type { ChatTurnResult } from '../services/chatLlmService.js';
import { logChatProviderError, publicMessageFromChatProviderError } from '../services/publicChatError.js';
import { SELF_V2_CACHE_CONTROL } from './selfV2Routes.js';
import { BudgetExceeded, withinBudget } from './selfV3Routes.js';

export type CardChatGate = Pick<QuestionGate, 'check' | 'reserve' | 'commit' | 'release' | 'getStatus'>;

export interface CardChatRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
  /** test seams for the board reads and stored rows */
  resolve?: Omit<CardChatResolveDeps, 'prisma'>;
  /** test seams for the model call (stream, model, cap) */
  answer?: Omit<CardChatAnswerDeps, 'prisma'>;
  gate?: CardChatGate;
  /** the usage row of a key (default `question_usage`), for the retry rule */
  usageRow?: (prisma: PrismaClient, userId: string, key: string) => Promise<UsageRowView | null>;
  rateLimit?: (prisma: PrismaClient, userId: string) => Promise<{ allowed: boolean; retryAfterSec?: number }>;
  declined?: typeof declinedFor;
  budgetMs?: number;
}

export interface UsageRowView {
  status: string;
  chat_id: string | null;
  message_id: string | null;
}

/** one sent question = one question; the client's turnId makes a retry of the same send free */
export const cardChatUsageKey = (board: CardChatBoard, cardId: string, turnId: string): string => `cardchat:${board}:${cardId}:${turnId}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function defaultUsageRow(prisma: PrismaClient, userId: string, key: string): Promise<UsageRowView | null> {
  try {
    const q = (prisma as unknown as { questionUsage?: { findUnique?: (a: unknown) => Promise<UsageRowView | null> } }).questionUsage;
    if (!q?.findUnique) return null;
    return await q.findUnique({ where: { user_id_key: { user_id: userId, key } }, select: { status: true, chat_id: true, message_id: true } });
  } catch {
    return null;
  }
}

const defaultRateLimit = async (prisma: PrismaClient, userId: string) => checkRateLimit('gemini_api', userId, { prisma });

/** "Uses 1 of your 20 questions this month (17 left)"; null when nothing is counted (limits off, staff, Unlimited) */
export function costLineOf(status: PlanStatus | null): CardChatOpenResponse['cost'] {
  if (!status || status.exempt || status.limit === null) return { uses: 1, remaining: status?.remaining ?? null, limit: status?.limit ?? null, line: null };
  return { uses: 1, remaining: status.remaining, limit: status.limit, line: `Uses 1 of your ${status.limit} questions this month (${status.remaining ?? 0} left)` };
}

/** the card's title from the registry (the same the board shows), without reading the board */
function titleOf(board: CardChatBoard, id: string): string | null {
  return board === 'self' ? (cardDef(id)?.title ?? null) : (boardV3CardOn(board, id)?.title ?? null);
}

function ownAccount(userId: string, req: express.Request, res: express.Response): boolean {
  const q = req.query?.userId;
  try {
    assertOwnAccount(userId, typeof q === 'string' ? q : null);
    return true;
  } catch {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
}

export function registerCardChatRoutes(app: express.Express, deps: CardChatRouteDeps): void {
  const gate = (): CardChatGate => deps.gate ?? questionGate(deps.prisma);
  const resolveDeps = (): CardChatResolveDeps => ({ prisma: deps.prisma, ...(deps.resolve ?? {}) });

  app.get('/api/cards/:board/:cardId/chat', async (req, res) => {
    res.setHeader('Cache-Control', SELF_V2_CACHE_CONTROL);
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    if (!ownAccount(userId, req, res)) return;
    const board = String(req.params.board ?? '');
    const cardId = String(req.params.cardId ?? '');
    if (!isCardChatBoard(board)) return res.status(400).json({ error: 'unknown_board' });
    const title = titleOf(board, cardId);
    if (!title) return res.status(400).json({ error: 'unknown_card' });
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;
    const t0 = Date.now();
    try {
      const [r, status, thread] = await withinBudget(
        Promise.all([
          resolveCard(resolveDeps(), userId, { board, id: cardId, from, to }),
          gate().getStatus(userId).catch(() => null),
          loadCardThread(deps.prisma, userId, cardRefOf(board, cardId), title),
        ]),
        deps.budgetMs ?? getSelfV3RouteBudgetMs(),
      );
      console.log(`[cardchat] open board=${board} card=${cardId} ms=${Date.now() - t0}`);
      if (!r.ok) return res.status(CARD_CHAT_ERROR_STATUS[r.error]).json({ error: r.error });
      const body: CardChatOpenResponse = {
        card: { board, id: cardId, title: r.card.title, subtitle: r.card.subtitle },
        period: r.card.period,
        preamble: r.card.preamble,
        cost: costLineOf(status),
        thread,
      };
      return res.status(200).json(body);
    } catch (e) {
      if (e instanceof BudgetExceeded) {
        console.warn(JSON.stringify({ msg: '[cardchat] open budget exceeded', board, card: cardId }));
        if (res.headersSent) return;
        res.setHeader('Retry-After', '1');
        return res.status(503).json({ error: 'timeout' });
      }
      console.error('[cardchat:open]', (e as Error).message);
      return res.status(500).json({ error: 'card_chat_failed' });
    }
  });
}

/** The parsed card part of an ask-stream body, or the 400 error. */
export function parseCardAsk(body: Record<string, unknown>): { ok: true; ref: CardRef; turnId: string; newThread: boolean } | { ok: false; error: string } {
  if (body.focus !== undefined || body.parts !== undefined) return { ok: false, error: 'card_with_focus' };
  const c = body.card as Record<string, unknown> | null | undefined;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, error: 'bad_card' };
  const board = c.board;
  const id = typeof c.id === 'string' ? c.id : typeof c.cardId === 'string' ? c.cardId : '';
  if (!isCardChatBoard(board)) return { ok: false, error: 'unknown_board' };
  if (!id) return { ok: false, error: 'unknown_card' };
  const turnId = typeof body.turnId === 'string' ? body.turnId.trim() : '';
  if (!UUID.test(turnId)) return { ok: false, error: 'bad_turn_id' };
  const date = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { ok: true, ref: { board, id, from: date(c.from), to: date(c.to) }, turnId, newThread: body.newThread === true };
}

/**
 * POST /api/chat/ask-stream with `card` (doc 85 §4 Backend steps 2–5): the card is re-read on the server, the question
 * is checked and reserved under its per-turn key, the answer streams from one call on the card's context, and the turn is
 * saved to the card's thread. Called by the ask-stream route after it validated `question`.
 */
export async function handleCardAsk(deps: CardChatRouteDeps, req: express.Request, res: express.Response, userId: string): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const q = String(body.question ?? '').trim();
  const parsed = parseCardAsk(body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { ref, turnId, newThread } = parsed;
  const key = cardChatUsageKey(ref.board, ref.id, turnId);
  const prisma = deps.prisma;
  const gate = deps.gate ?? questionGate(prisma);
  const cardRef = cardRefOf(ref.board, ref.id);

  // a retry of a send already answered replays the saved answer (no model call, no charge); one still running is refused
  const earlier = await (deps.usageRow ?? defaultUsageRow)(prisma, userId, key);
  if (earlier?.status === 'reserved') {
    res.status(409).json({ error: 'turn_in_flight' });
    return;
  }
  let replay: { chatId: string; answer: string } | null = null;
  if (earlier?.status === 'committed' && earlier.message_id) {
    const m = await prisma.message
      .findFirst({ where: { id: earlier.message_id, chat: { user_id: userId } }, select: { ai_answer: true, chat_id: true } })
      .catch(() => null);
    if (m) replay = { chatId: m.chat_id, answer: m.ai_answer };
  }

  const resolved = await resolveCardContext({ prisma, ...(deps.resolve ?? {}) }, userId, ref);
  if (!resolved.ok) {
    res.status(CARD_CHAT_ERROR_STATUS[resolved.error]).json({ error: resolved.error });
    return;
  }
  const ctx = resolved.context;
  const card = ctx.card;
  if (!replay) {
    const rl = await (deps.rateLimit ?? defaultRateLimit)(prisma, userId).catch(() => ({ allowed: true }));
    if (!rl.allowed) {
      res.setHeader('Retry-After', String((rl as { retryAfterSec?: number }).retryAfterSec ?? 60));
      res.status(429).json({ error: 'rate_limited', retryAfterSec: (rl as { retryAfterSec?: number }).retryAfterSec ?? 60 });
      return;
    }
    const allowed = await gate.check(userId);
    if (!allowed.ok) {
      res.status(402).json(quotaBody(allowed.usage));
      return;
    }
  }
  const thread = newThread ? { chatId: null, messages: [] } : await loadCardThread(prisma, userId, cardRef, card.title);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', SSE_CACHE_CONTROL);
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  req.socket?.setNoDelay?.(true);
  const flush = () => (res as express.Response & { flush?: () => void }).flush?.();

  const activeTurn = await chatTurnService.createTurn(prisma, { userId, question: q, ticket: null });
  res.write(`id: 0\nevent: turn_init\ndata: ${JSON.stringify({ type: 'turn_init', turnId: activeTurn.turnId, seq: 0 })}\n\n`);
  flush();
  const writeEvent = async (type: string, payload: Record<string, unknown>) => {
    const ev = await chatTurnService.recordEvent(prisma, activeTurn.turnId, type, payload);
    res.write(`id: ${ev.seq}\nevent: ${type}\ndata: ${JSON.stringify({ ...payload, seq: ev.seq })}\n\n`);
    flush();
  };
  const finish = async (payload: Record<string, unknown>) => {
    await chatTurnService.completeTurn(prisma, activeTurn.turnId, payload);
    res.write(`id: ${activeTurn.seq}\nevent: turn_done\ndata: ${JSON.stringify({ turnId: activeTurn.turnId, seq: activeTurn.seq, ...payload })}\n\n`);
    flush();
  };
  const pingMs = Math.max(5000, Math.min(60_000, Number(process.env.CHAT_SSE_PING_MS) || 12_000));
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
      flush();
    } catch {
      /* client gone */
    }
  }, pingMs);

  let ticket: QuestionTicket | null = null;
  const cardOut = { board: card.board, id: card.id };
  try {
    await writeEvent('card', { type: 'card', board: card.board, id: card.id, title: card.title, periodLabel: card.period?.label ?? null, turnId });
    if (replay) {
      await writeEvent('token', { type: 'token', delta: replay.answer });
      await finish({ type: 'done', chatId: replay.chatId, answer: replay.answer, card: cardOut, replay: true });
      return;
    }
    const persistOpts = { card: { cardRef, category: CARD_CHAT_CATEGORY[card.board], title: card.title, newThread } };
    const stored = storedCardQuestion(card.title, card.period?.label ?? null, q);

    // topics the app does not discuss are stopped before any model sees the text, and cost nothing
    const declined = await (deps.declined ?? declinedFor)(prisma, userId, q);
    if (declined) {
      await writeEvent('info', { type: 'info', reason: 'declined', category: declined.category, topic: declined.id });
      await writeEvent('token', { type: 'token', delta: declined.reply });
      const result: ChatTurnResult = {
        answerText: declined.reply,
        requestPayload: { engine: 'policy', declined: declined.id, category: declined.category },
        responsePayload: { engine: 'policy', declined: declined.id },
        storedQuestion: storedCardQuestion(card.title, card.period?.label ?? null, storedQuestion(q, declined)),
      };
      const saved = await persistAskTurn(prisma, userId, (body.chatId as string | null | undefined) ?? null, stored, result, true, persistOpts);
      await finish({ type: 'done', chatId: saved.chatId, answer: declined.reply, card: cardOut });
      return;
    }

    const held = await gate.reserve(userId, { key });
    if (!held.ok) {
      await writeEvent('error', { type: 'error', code: 'quota_exhausted', usage: held.usage as unknown as Record<string, unknown>, message: 'Question limit reached' });
      await chatTurnService.failTurn(prisma, activeTurn.turnId, 'Question limit reached', held.usage);
      return;
    }
    ticket = held.ticket;
    await writeEvent('start', { type: 'start' });
    const usageNow = await gate.getStatus(userId).catch(() => null);
    if (usageNow) await writeEvent('usage', { type: 'usage', usage: usageNow as unknown as Record<string, unknown> });

    const answer = await answerCardQuestion({ prisma, ...(deps.answer ?? {}) }, userId, ctx, q, historyOf(thread), (delta) => {
      if (delta) void writeEvent('token', { type: 'token', delta });
    });
    const result: ChatTurnResult = {
      answerText: answer.text,
      // ids, counts and tokens only (the question text is the message's, never the payload's)
      requestPayload: {
        engine: 'cardchat',
        board: card.board,
        card: card.id,
        period: card.period ? { from: card.period.from, to: card.period.to } : null,
        model: answer.usage.model,
        prefix: Boolean(ctx.prefix),
        prefixMatchesCard: answer.prefixMatchesCard,
        ledgerMatchesCard: ctx.ledgerMatchesCard,
        cells: ctx.cells.length,
        history: historyOf(thread).length,
        maxOutputTokens: answer.maxOutputTokens,
      },
      responsePayload: { engine: 'cardchat', usage: answer.usage, costUsd: answer.costUsd, finishReason: answer.finishReason },
    };
    const saved = await persistAskTurn(prisma, userId, (body.chatId as string | null | undefined) ?? null, stored, result, true, persistOpts);
    await gate.commit(ticket, { chatId: saved.chatId, messageId: saved.messageId });
    ticket = null;
    const usage = await gate.getStatus(userId).catch(() => null);
    await finish({ type: 'done', chatId: saved.chatId, answer: answer.text, card: cardOut, ...(usage ? { usage } : {}) });
  } catch (e) {
    if (ticket) await gate.release(ticket);
    const spend = e instanceof CardChatSpendCapError;
    if (!spend) logChatProviderError('ask-stream card', e);
    else console.warn(JSON.stringify({ msg: '[cardchat] not answered: over the per-operation cap', board: card.board, card: card.id, worstUsd: e.worstUsd, capUsd: e.capUsd }));
    const usage = await gate.getStatus(userId).catch(() => null);
    const payload = {
      type: 'error',
      ...(spend ? { code: 'spend_cap', message: 'This question is too long to answer on this card. Try a shorter one.' } : { message: publicMessageFromChatProviderError(e) }),
      ...(usage ? { usage } : {}),
    };
    await chatTurnService.failTurn(prisma, activeTurn.turnId, (e as Error)?.message || String(e), payload);
    res.write(`id: ${activeTurn.seq}\nevent: error\ndata: ${JSON.stringify({ turnId: activeTurn.turnId, seq: activeTurn.seq, ...payload })}\n\n`);
    flush();
  } finally {
    clearInterval(ping);
    res.end();
  }
}
