/**
 * Routes GraphQL chat to Groq or Gemini based on CHAT_LLM_PROVIDER.
 */
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { chatWithGroq, type ChatWithGroqResult } from './groqChatService.js';
import { chatWithGemini } from './geminiChatService.js';
import { isReadingEngineEnabled, readingBuildFactsEnabled, readingFallbackToLegacy } from '../reading/config.js';
import { scheduleFactsBuild } from '../reading/data/factsBuilder.js';
import { ReadingUnavailableError, runReading, type ReadingRunRecord } from '../reading/run.js';
import type { ReadingEmitter } from '../reading/types.js';

export type ChatTurnResult = ChatWithGroqResult & {
  /** Present when the reading engine answered; persisted as a reading_runs row. */
  reading?: ReadingRunRecord;
};

/** Shown when a kundli has no chart-facts dossier yet and the legacy fallback is off (the default). */
export const CHART_PREPARING_MESSAGE =
  'Your chart is still being prepared for detailed readings (planet placements, divisional charts, dasha periods and transits). This usually takes a few minutes after your birth details are saved. Please ask again shortly.';

export type ChatWithLlmOptions = {
  /** Fired for each streamed token delta (Gemini SSE + Groq stream). */
  onDelta?: (delta: string) => void;
  /** Reading-engine progress events (intent, stage, windows) for the SSE stream. */
  onEvent?: ReadingEmitter;
};

export async function chatWithConfiguredProvider(
  prisma: PrismaClient,
  userId: string,
  question: string,
  options?: ChatWithLlmOptions
): Promise<ChatTurnResult> {
  const provider = getChatLlmProvider();
  const t0 = Date.now();
  try {
    if (provider === 'gemini' && isReadingEngineEnabled()) {
      try {
        const r = await runReading(prisma, userId, question, {
          onDelta: options?.onDelta,
          onEvent: options?.onEvent,
          onFactsMissing: (kundliId) => {
            if (readingBuildFactsEnabled()) scheduleFactsBuild(prisma, kundliId);
          },
          onStale: (kundliId) => {
            if (readingBuildFactsEnabled()) scheduleFactsBuild(prisma, kundliId, { force: true });
          },
        });
        return { answerText: r.answerText, requestPayload: r.requestPayload, responsePayload: r.responsePayload, reading: r.record };
      } catch (err) {
        if (!(err instanceof ReadingUnavailableError)) throw err;
        options?.onEvent?.({ type: 'info', reason: err.reason });
        if (readingFallbackToLegacy()) {
          console.log(JSON.stringify({ msg: 'reading engine unavailable; using legacy chat path (READING_FALLBACK_LEGACY=1)', reason: err.reason }));
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
