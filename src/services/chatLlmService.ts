/**
 * Routes GraphQL chat to Groq or Gemini based on CHAT_LLM_PROVIDER.
 */
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { chatWithGroq, type ChatWithGroqResult } from './groqChatService.js';
import { chatWithGemini } from './geminiChatService.js';
import { isReadingEngineEnabled, readingBuildFactsEnabled, readingFallbackToLegacy } from '../reading/config.js';
import { buildFactsForKundli, scheduleFactsBuild, type BuildResult } from '../reading/data/factsBuilder.js';
import { ReadingUnavailableError, runReading, type ReadingRunRecord } from '../reading/run.js';
import type { Intent, ReadingEmitter } from '../reading/types.js';
import { declinedFor, storedQuestion } from '../reading/policy/declined.js';

export type ChatTurnResult = ChatWithGroqResult & {
  /** Present when the reading engine answered; persisted as a reading_runs row. */
  reading?: ReadingRunRecord;
  /** When set, stored instead of the question text (deny topics: "[withheld: <topic>]") */
  storedQuestion?: string;
};

/** Shown when a kundli has no chart-facts dossier yet and the legacy fallback is off (the default). */
export const CHART_PREPARING_MESSAGE =
  'Your chart is still being prepared for detailed readings (planet placements, divisional charts, dasha periods and transits). This usually takes a few minutes after your birth details are saved. Please ask again shortly.';

/**
 * Chat found no dossier. This request is still open, so the build runs inside it: a fire-and-forget build here would freeze
 * with the Lambda container. Null when there is nothing to build. A kundli the engine cannot serve yet makes no call:
 * the build onFactsMissing scheduled (at most once per cooldown) is what notices when that changes.
 */
async function buildDossierNow(prisma: PrismaClient, userId: string): Promise<BuildResult | null> {
  if (!readingBuildFactsEnabled()) return null;
  const kundli = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true, facts_status: true } });
  if (!kundli) return null;
  if (kundli.facts_status === 'unsupported') return { status: 'failed', kundliId: kundli.id, reason: 'engine does not serve the dossier yet', unsupported: true };
  return buildFactsForKundli(prisma, kundli.id);
}

export type ChatWithLlmOptions = {
  /** Fired for each streamed token delta (Gemini SSE + Groq stream). */
  onDelta?: (delta: string) => void;
  /** Reading-engine progress events (intent, stage, windows) for the SSE stream. */
  onEvent?: ReadingEmitter;
  /** Confirmed intent from the clarifier (skips intake) */
  intent?: Intent;
  /** The clarify run this answer came from (joins the metrics) */
  clarifyRunId?: string;
  /** The clarifier confirmed the person's child is 18 or older */
  childAgeConfirmed?: boolean;
  /** Where the question is asked (client location, rounded; parseClientPlace), for the prashna */
  questionPlace?: { lat: number; lon: number; tz: number } | null;
};

export async function chatWithConfiguredProvider(
  prisma: PrismaClient,
  userId: string,
  question: string,
  options?: ChatWithLlmOptions
): Promise<ChatTurnResult> {
  const provider = getChatLlmProvider();
  const t0 = Date.now();
  // topics the app does not discuss are stopped before any agent or model sees the text, on every provider
  const declined = await declinedFor(prisma, userId, question, { childAgeConfirmed: options?.childAgeConfirmed === true });
  if (declined) {
    options?.onEvent?.({ type: 'info', reason: 'declined', category: declined.category, topic: declined.id });
    options?.onDelta?.(declined.reply);
    const stored = storedQuestion(question, declined);
    return { answerText: declined.reply, requestPayload: { engine: 'policy', declined: declined.id, category: declined.category }, responsePayload: { engine: 'policy', declined: declined.id }, storedQuestion: stored };
  }
  try {
    if (provider === 'gemini' && isReadingEngineEnabled()) {
      const read = async (): Promise<ChatTurnResult> => {
        const r = await runReading(prisma, userId, question, {
          onDelta: options?.onDelta,
          onEvent: options?.onEvent,
          intent: options?.intent,
          ...(options?.clarifyRunId ? { clarifyRunId: options.clarifyRunId } : {}),
          ...(options?.questionPlace ? { questionPlace: options.questionPlace } : {}),
          onFactsMissing: (kundliId) => {
            if (readingBuildFactsEnabled()) scheduleFactsBuild(prisma, kundliId);
          },
          onStale: (kundliId) => {
            if (readingBuildFactsEnabled()) scheduleFactsBuild(prisma, kundliId, { force: true });
          },
        });
        return { answerText: r.answerText, requestPayload: r.requestPayload, responsePayload: r.responsePayload, reading: r.record };
      };
      try {
        return await read();
      } catch (err) {
        if (!(err instanceof ReadingUnavailableError)) throw err;
        options?.onEvent?.({ type: 'info', reason: err.reason });
        const built = err.reason === 'dossier_missing' ? await buildDossierNow(prisma, userId) : null;
        if (built?.status === 'ready') {
          try {
            return await read();
          } catch (retryErr) {
            if (!(retryErr instanceof ReadingUnavailableError)) throw retryErr;
          }
        }
        // the dossier cannot be had right now (the engine does not serve it, or the build failed): answer from the basic
        // chart and tell the client, so it can say so on screen instead of passing this off as a full reading
        if (readingFallbackToLegacy() || (built && built.status !== 'ready')) {
          options?.onEvent?.({ type: 'info', reason: 'legacy_mode' });
          console.log(JSON.stringify({ msg: 'reading engine unavailable; using legacy chat path', reason: err.reason, facts: built?.status ?? null }));
        } else {
          // New chat path only: say plainly that the chart is being prepared (the build was scheduled by onFactsMissing).
          console.warn(JSON.stringify({ msg: 'reading engine unavailable; no legacy fallback', reason: err.reason }));
          options?.onDelta?.(CHART_PREPARING_MESSAGE);
          return {
            answerText: CHART_PREPARING_MESSAGE,
            requestPayload: { engine: 'reading', status: err.reason },
            responsePayload: { engine: 'reading', status: err.reason },
          };
        }
      }
    }
    if (provider === 'gemini') {
      return await chatWithGemini(prisma, userId, question, options);
    }
    return await chatWithGroq(prisma, userId, question, options);
  } finally {
    // Router total only — no secrets, prompts, or payloads.
    console.log(
      JSON.stringify({
        msg: 'chatWithConfiguredProvider timing',
        provider,
        totalMs: Date.now() - t0,
      })
    );
  }
}
