/**
 * One card-chat answer (docs/reading-engine/85 §4 step 3): one streamed call on the card's own context, run as agent
 * `card.chat` (technique `self.card.chat`). The model and the first two inputs are the card's own Oracle call's (the reader
 * model, the common reader system prompt, the shared prefix as parts[0], `cachePrefix` with the person as cache owner),
 * so the answer reads the same cached prefix the card was written on: one cache key, `prefixKey(model, system, prefix)`.
 *
 * Caches (doc 86): the answer runs under a non-recording lease on the kundli and never creates a cache; a live one is
 * used, a missing or refused one means an uncached call, never a failure.
 *
 * Spend: each answer is one operation under READING_SPEND_CAP_USD (default $0.45). Before the call the worst case
 * (the estimated input, all uncached, plus the output cap) is priced; the output cap is lowered to fit, and a call that
 * cannot fit even a short answer is not made (`CardChatSpendCapError`). No word filters on the answer (doc 82): only the
 * engine's internal names are redacted in place, as the text streams.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { getReadingSpendCapUsd } from '../../config/env.js';
import { streamGemini, type GeminiCallOptions, type GeminiResult } from '../llm/gemini.js';
import { modelFor, priceFor, usageCostUsd } from '../llm/models.js';
import { prefixKey } from '../llm/promptCache.js';
import { withCacheLease } from '../llm/cacheLease.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { estProviderTokens } from '../self/v2/slices.js';
import { redactEngineTerms } from '../self/words.js';
import type { Usage } from '../types.js';
import { cardChatParts } from './prompt.js';
import { CARD_CHAT_AGENT, CARD_CHAT_TECHNIQUE, type CardChatContext, type CardChatHistoryTurn } from './types.js';

/** the answer is 60 to 180 words; the cap bounds output and thought together (they share it on Gemini 3.x) */
export const CARD_CHAT_MAX_OUTPUT_TOKENS = 2_048;
/** below this many output tokens no useful answer fits: the call is not made */
export const CARD_CHAT_MIN_OUTPUT_TOKENS = 256;
export const CARD_CHAT_TIMEOUT_MS = 90_000;

export class CardChatSpendCapError extends Error {
  constructor(readonly worstUsd: number, readonly capUsd: number) {
    super(`card chat answer would exceed the per-operation cap (${worstUsd.toFixed(4)} > ${capUsd})`);
  }
}

export interface CardChatAnswerDeps {
  prisma: PrismaClient;
  /** default streamGemini */
  stream?: (o: GeminiCallOptions, onDelta?: (d: string) => void) => Promise<GeminiResult>;
  /** default the reader model the card was read on (`modelFor('oracle')`, the clock layer's and the cards') */
  model?: string;
  /** default getReadingSpendCapUsd() */
  capUsd?: number;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  signal?: AbortSignal;
}

export interface CardChatAnswer {
  text: string;
  usage: Usage;
  costUsd: number;
  /** the explicit cache key the call's prefix maps to (the card's own key when `prefixMatchesCard`) */
  cacheKey: string | null;
  prefixMatchesCard: boolean;
  maxOutputTokens: number;
  finishReason: string | null;
}

/** The cache key a card call and a card-chat call share: the reader system prompt and the shared prefix on one model. */
export function cardChatCacheKey(model: string, system: string, prefix: string | null): string | null {
  return prefix ? prefixKey(model, system, prefix) : null;
}

/**
 * The output cap that keeps the worst case under the cap: input priced all uncached (a cache miss), plus output.
 * Unknown models are priced 0 (flagged elsewhere) and keep the full cap.
 */
export function outputBudget(model: string, inputChars: number, capUsd: number, maxOut = CARD_CHAT_MAX_OUTPUT_TOKENS): { maxOutputTokens: number; worstUsd: number } {
  const p = priceFor(model);
  if (!p) return { maxOutputTokens: maxOut, worstUsd: 0 };
  const inTokens = Math.ceil(inputChars / 2.2);
  const inUsd = (inTokens * p.in) / 1_000_000;
  const room = Math.floor(((capUsd - inUsd) * 1_000_000) / p.out);
  const maxOutputTokens = Math.max(0, Math.min(maxOut, room));
  return { maxOutputTokens, worstUsd: inUsd + (maxOutputTokens * p.out) / 1_000_000 };
}

/**
 * Streams engine-name redaction: text is let out up to its last whitespace, so a name split across two deltas is still
 * whole when redacted (names hold no space). `end()` lets out the rest.
 */
export function redactingStream(emit: (s: string) => void): { push: (d: string) => void; end: () => void; text: () => string } {
  let held = '';
  let all = '';
  const out = (s: string) => {
    if (!s) return;
    const r = redactEngineTerms(s);
    all += r;
    emit(r);
  };
  return {
    push(d: string) {
      held += d;
      const cut = Math.max(held.lastIndexOf(' '), held.lastIndexOf('\n'));
      if (cut < 0) return;
      out(held.slice(0, cut + 1));
      held = held.slice(cut + 1);
    },
    end() {
      out(held);
      held = '';
    },
    text: () => all,
  };
}

/** One answer about the card. `onDelta` gets the redacted text as it streams. Throws on a failed call or the cap. */
export async function answerCardQuestion(
  deps: CardChatAnswerDeps,
  userId: string,
  ctx: CardChatContext,
  question: string,
  history: readonly CardChatHistoryTurn[],
  onDelta?: (d: string) => void,
  clarified: readonly string[] = [],
): Promise<CardChatAnswer> {
  const model = deps.model ?? modelFor('oracle');
  const parts = cardChatParts(ctx, question, history, clarified);
  const cap = deps.capUsd ?? getReadingSpendCapUsd();
  const inputChars = parts.system.length + (parts.prefix?.length ?? 0) + parts.suffix.length;
  const budget = outputBudget(model, inputChars, cap);
  if (budget.maxOutputTokens < CARD_CHAT_MIN_OUTPUT_TOKENS) throw new CardChatSpendCapError(budget.worstUsd, cap);
  const cacheOwner = { userId, kundliId: ctx.card.kundliId };
  const o: GeminiCallOptions = {
    model,
    node: `card.chat.${ctx.card.board}`,
    system: parts.system,
    parts: parts.prefix ? [parts.prefix, parts.suffix] : [parts.suffix],
    thinking: 'low',
    maxOutputTokens: budget.maxOutputTokens,
    timeoutMs: CARD_CHAT_TIMEOUT_MS,
    // doc 86: a live prefix cache is used (a build of this kundli in flight); none is ever created for an answer
    ...(parts.prefix ? { cachePrefix: true, cacheOwner, cacheCreate: false } : {}),
    ...(deps.signal ? { signal: deps.signal } : {}),
  };
  const red = redactingStream((s) => onDelta?.(s));
  // doc 86: the answer holds a lease on the person's caches, so a build ending meanwhile does not delete them under it;
  // a cache already gone (another instance deleted it) is refused by Gemini and the call is retried uncached
  const res = await withCacheLease(cacheOwner, 'card.chat', () => withAgentRun(
    deps.prisma,
    CARD_CHAT_AGENT,
    {
      userId,
      kundliId: ctx.card.kundliId,
      technique: CARD_CHAT_TECHNIQUE,
      // ids and counts only: never the question text (AGENTS.md "Summaries")
      task: `card.chat ${ctx.card.board}.${ctx.card.id}`,
      input: {
        board: ctx.card.board,
        card: ctx.card.id,
        period: Boolean(ctx.card.period),
        cells: ctx.cells.length,
        rows: ctx.evidenceRows.length,
        oracle: Boolean(ctx.oracle),
        prefix: Boolean(ctx.prefix),
        prefixMatchesCard: Boolean(ctx.prefix?.matchesCard),
        history: history.length,
        clarified: clarified.length,
        estTokens: estProviderTokens(parts.suffix),
        // doc 13 §2.4: the field names the gate sent (never values); absent with READING_PERSON_GATE off
        ...(ctx.person ? { fieldsSent: ctx.person.fieldsSent } : {}),
      },
      charts: [{ type: 'pressure_inventory', variant: `system=${ctx.card.clock || 'unknown'}` }],
    },
    async () => {
      const g = await (deps.stream ?? streamGemini)(o, (d) => red.push(d));
      red.end();
      return {
        value: g,
        usage: { model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
        output: { chars: g.text.length, finish: g.finishReason ?? null },
      };
    },
  ), { record: false });
  if (parts.prefix) markAgentUsed({ cacheOwner }, deps.informUsed);
  const usage: Usage = res.usage ?? { node: o.node, model, promptTokens: 0, cachedTokens: 0, outputTokens: 0, thoughtTokens: 0, ms: 0 };
  const costUsd = Math.round(usageCostUsd({ ...usage, model }) * 1e6) / 1e6;
  if (costUsd > cap) console.warn(JSON.stringify({ msg: '[cardchat] answer over the per-operation cap', board: ctx.card.board, card: ctx.card.id, costUsd, cap }));
  return {
    text: red.text() || redactEngineTerms(res.text ?? ''),
    usage,
    costUsd,
    cacheKey: cardChatCacheKey(model, parts.system, parts.prefix),
    prefixMatchesCard: Boolean(ctx.prefix?.matchesCard),
    maxOutputTokens: budget.maxOutputTokens,
    finishReason: res.finishReason ?? null,
  };
}
