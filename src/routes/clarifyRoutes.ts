/**
 * HTTP surface of the clarify agent (docs/reading-engine/17-clarify-agent.md §8).
 *
 *   POST /api/chat/ask-stream     { question, chatId?, clarify: true }  → SSE clarify | propose | (normal reading)
 *   POST /api/chat/answer         { runId, value, viaChip, tz? }        → JSON clarify | propose | declined
 *                                 (tz: browser IANA timezone, used with the "Where are you living now?" answer)
 *   POST /api/chat/confirm-stream { runId, chatId?, edits? }            → SSE reading with the confirmed intent
 *
 * Clarifying happens only when the client says it can render the card (`clarify: true`), so older clients keep
 * today's behaviour. Every entry passes the declined-topics gate first (src/reading/policy/declined.ts).
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { isReadingEngineEnabled } from '../reading/config.js';
import { answerClarify, beginClarify, confirmAndBuildIntent } from '../reading/clarify/service.js';
import { PrismaClarifyStore, type ClarifyStore } from '../reading/clarify/store.js';
import { prewarmNatalLayers, prewarmWithCap } from '../reading/clarify/prewarm.js';
import { chatWithConfiguredProvider } from '../services/chatLlmService.js';
import { persistAskTurn, validateAskForUser } from '../services/askChatTurn.js';
import { logChatProviderError, publicMessageFromChatProviderError } from '../services/publicChatError.js';
import { normalizeTimeZone, type UserLocationStore } from '../services/userLocation.js';

export interface ClarifyRouteDeps {
  prisma: PrismaClient;
  getUserId: (req: express.Request) => string | null;
  store?: ClarifyStore;
  /** where the current location is kept (defaults to the `user_current_location` table) */
  locationStore?: UserLocationStore;
}

/** Opens an SSE response with the same headers and keep-alive pings as ask-stream. */
export function openSse(req: express.Request, res: express.Response): { write: (obj: unknown) => void; end: () => void } {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  req.socket?.setNoDelay?.(true);
  const flush = () => (res as express.Response & { flush?: () => void }).flush?.();
  const write = (obj: unknown) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    flush();
  };
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
      flush();
    } catch {
      /* client gone */
    }
  }, Math.max(5000, Math.min(60_000, Number(process.env.CHAT_SSE_PING_MS) || 12_000)));
  return {
    write,
    end: () => {
      clearInterval(ping);
      res.end();
    },
  };
}

export function clarifyAvailable(): boolean {
  return getChatLlmProvider() === 'gemini' && isReadingEngineEnabled();
}

/**
 * Called by ask-stream when the client sent `clarify: true`. Returns true when it answered the request itself
 * (a clarify or propose event was sent and the stream closed); false when the reading should run as usual.
 */
export async function clarifyOnAsk(deps: ClarifyRouteDeps, userId: string, question: string, sse: { write: (o: unknown) => void }): Promise<boolean> {
  if (!clarifyAvailable()) return false;
  const store = deps.store ?? new PrismaClarifyStore(deps.prisma);
  const r = await beginClarify(deps.prisma, store, userId, question, deps.locationStore ? { locationStore: deps.locationStore } : {});
  // declined topics fall through: the chat path answers them with the fixed reply and stores them correctly
  if (r.declined || !r.event) return false;
  sse.write({ type: 'start' });
  sse.write(r.event);
  sse.write({ type: 'done', status: 'clarifying', runId: r.runId, ms: r.ms });
  // Track B: the natal layers run while the person reads the question (graph flow only, capped, same request)
  await prewarmWithCap(prewarmNatalLayers(deps.prisma, userId, r.state));
  return true;
}

export function registerClarifyRoutes(app: express.Express, deps: ClarifyRouteDeps): void {
  const store = (): ClarifyStore => deps.store ?? new PrismaClarifyStore(deps.prisma);

  app.post('/api/chat/answer', async (req, res) => {
    const userId = deps.getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { runId, value, viaChip, tz } = req.body as { runId?: string; value?: string; viaChip?: boolean; tz?: unknown };
    if (!runId || typeof value !== 'string' || !value.trim()) return res.status(400).json({ error: 'runId and value are required' });
    try {
      // tz: the browser's IANA timezone, sent with the "Where are you living now?" answer (validated before storing)
      const r = await answerClarify(deps.prisma, store(), userId, runId, value, viaChip === true, { tz: normalizeTimeZone(tz), ...(deps.locationStore ? { locationStore: deps.locationStore } : {}) });
      if ('error' in r) return res.status(r.error === 'not_found' ? 404 : 409).json({ error: r.error });
      if (r.declined) return res.json({ type: 'declined', runId, category: r.declined.category, reply: r.declined.reply });
      return res.json(r.event ?? { type: 'ready', runId });
    } catch (e) {
      logChatProviderError('clarify-answer', e);
      return res.status(500).json({ error: 'clarify_failed' });
    }
  });

  app.post('/api/chat/confirm-stream', async (req, res) => {
    const userId = deps.getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { runId, chatId, edits } = req.body as { runId?: string; chatId?: string | null; edits?: { horizon?: string; bucket?: string } };
    if (!runId) return res.status(400).json({ error: 'runId is required' });
    const pre = await validateAskForUser(deps.prisma, userId);
    if (!pre.ok) return res.status(400).json({ error: pre.error });
    const c = await confirmAndBuildIntent(store(), userId, runId, edits ?? {});
    if ('error' in c) return res.status(c.error === 'not_found' ? 404 : 409).json({ error: c.error });
    const sse = openSse(req, res);
    try {
      sse.write({ type: 'start' });
      if (!c.intent) {
        // an edit re-proposes
        if (c.event) sse.write(c.event);
        sse.write({ type: 'done', status: 'clarifying', runId });
        return;
      }
      const result = await chatWithConfiguredProvider(deps.prisma, userId, c.state.question, {
        intent: c.intent,
        childAgeConfirmed: c.state.childAge === 'adult',
        onDelta: (delta) => {
          if (delta) sse.write({ type: 'token', delta });
        },
        onEvent: (event) => sse.write(event),
      });
      const { chatId: finalChatId } = await persistAskTurn(deps.prisma, userId, chatId ?? null, c.state.question, result, true);
      sse.write({ type: 'done', chatId: finalChatId, answer: result.answerText, clarifyRunId: runId, ...(result.reading ? { runId: result.reading.runId } : {}) });
    } catch (e) {
      logChatProviderError('confirm-stream', e);
      sse.write({ type: 'error', message: publicMessageFromChatProviderError(e) });
    } finally {
      sse.end();
    }
  });
}
