import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { SSE_CACHE_CONTROL } from '../lib/noStore.js';
import { chatWithConfiguredProvider } from '../services/chatLlmService.js';
import { validateAskForUser, persistAskTurn } from '../services/askChatTurn.js';
import {
  partsFromEvent,
  questionGate,
  quotaBody,
  wasDeclined,
  type QuestionTicket,
} from '../billing/questionGate.js';
import { clarifyOnAsk } from '../routes/clarifyRoutes.js';
import { parseClientPlace } from '../reading/chartData/place.js';
import { intentForFocus } from '../reading/clarify/service.js';
import { FRAMES, SUBJECT_IDS, type SubjectId } from '../reading/packs/frames.js';
import {
  logChatProviderError,
  publicMessageFromChatProviderError,
} from '../services/publicChatError.js';
import { chatTurnService, type TurnEvent } from './chatTurnService.js';

export interface ChatRoutesDeps {
  prisma: PrismaClient;
  requireUser: (req: express.Request, res: express.Response) => Promise<string | null>;
}

export function registerChatRoutes(app: express.Express, deps: { prisma: PrismaClient; requireUser: (req: express.Request, res: express.Response) => Promise<string | null> }): void {
  const { prisma, requireUser } = deps;

  /**
   * SSE chat: streams turn_init, start, usage, tokens/progress, and turn_done.
   * State machine turn buffered in ChatTurn for SSE reconnection & resume.
   */
  app.post('/api/chat/ask-stream', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const { question, chatId, clarify, focus, parts } = req.body as {
      question?: string;
      chatId?: string | null;
      clarify?: boolean;
      focus?: string;
      parts?: unknown;
    };

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    const isSubject = (v: unknown): v is SubjectId =>
      typeof v === 'string' && (SUBJECT_IDS as readonly string[]).includes(v);
    if (focus !== undefined && !isSubject(focus)) {
      return res.status(400).json({ error: 'focus is not a known subject' });
    }
    const focusParts: SubjectId[] = Array.isArray(parts) ? parts.filter(isSubject).slice(0, 8) : [];

    const pre = await validateAskForUser(prisma, userId);
    if (!pre.ok) {
      return res.status(pre.chart ? 409 : 400).json({
        error: pre.error,
        ...(pre.chart ? { code: 'chart_not_ready', chart: pre.chart } : {}),
      });
    }

    const gate = questionGate(prisma);
    const allowed = await gate.check(userId, focus ? { focus } : {});
    if (!allowed.ok) return res.status(402).json(quotaBody(allowed.usage));

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', SSE_CACHE_CONTROL);
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    req.socket?.setNoDelay?.(true);

    type ResWithFlush = express.Response & { flush?: () => void };
    const flush = () => (res as ResWithFlush).flush?.();

    // Create turn state in ChatTurn & in-memory manager
    const q = question.trim();
    const activeTurn = await chatTurnService.createTurn(prisma, {
      userId,
      question: q,
      ticket: null,
    });

    // Event 0: turn_init within <= 50ms
    res.write(`id: 0\nevent: turn_init\ndata: ${JSON.stringify({ type: 'turn_init', turnId: activeTurn.turnId, seq: 0 })}\n\n`);
    flush();

    const writeEvent = async (type: string, payload: unknown) => {
      const ev = await chatTurnService.recordEvent(prisma, activeTurn.turnId, type, payload);
      const dataObj = typeof payload === 'object' && payload !== null ? { ...(payload as object), seq: ev.seq } : { type, seq: ev.seq, content: payload };
      res.write(`id: ${ev.seq}\nevent: ${type}\ndata: ${JSON.stringify(dataObj)}\n\n`);
      flush();
      return ev;
    };

    const ssePingMs = Math.max(5000, Math.min(60_000, Number(process.env.CHAT_SSE_PING_MS) || 12_000));
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    const writeSseComment = () => {
      try {
        res.write(': ping\n\n');
        flush();
      } catch {
        /* client gone */
      }
    };
    pingTimer = setInterval(writeSseComment, ssePingMs);

    let ticket: QuestionTicket | null = null;
    try {
      const focusIntent = focus ? await intentForFocus(q, new Date().toISOString().slice(0, 10), focus as SubjectId, focusParts) : undefined;
      if (!focusIntent && clarify === true && (await clarifyOnAsk({ prisma, requireUser }, userId, q, { write: (obj) => writeEvent('clarify', obj) }))) {
        return;
      }

      const held = await gate.reserve(userId, focus ? { focus } : {});
      if (!held.ok) {
        await writeEvent('error', { type: 'error', code: 'quota_exhausted', usage: held.usage, message: 'Question limit reached' });
        await chatTurnService.failTurn(prisma, activeTurn.turnId, 'Question limit reached', held.usage);
        return;
      }
      ticket = held.ticket;
      activeTurn.ticket = ticket;

      await writeEvent('start', { type: 'start' });
      const usageNow = await gate.getStatus(userId);
      if (usageNow) await writeEvent('usage', { type: 'usage', usage: usageNow });

      let openParts: string[] = [];
      const questionPlace = parseClientPlace(req.body);
      const chatResult = await chatWithConfiguredProvider(prisma, userId, q, {
        ...(questionPlace ? { questionPlace } : {}),
        onDelta: (delta) => {
          if (delta) void writeEvent('token', { type: 'token', delta });
        },
        onEvent: (event) => {
          openParts = partsFromEvent(event) ?? openParts;
          const evType = (event as any)?.type || 'event';
          void writeEvent(evType, event);
        },
        ...(focusIntent ? { intent: focusIntent } : {}),
      });

      const storedQ = focusIntent ? `[${FRAMES[focus as SubjectId].label}] ${q}` : q;
      const { chatId: finalChatId, messageId } = await persistAskTurn(prisma, userId, chatId ?? null, storedQ, chatResult, true);
      if (wasDeclined(chatResult)) await gate.release(ticket);
      else await gate.commit(ticket, { chatId: finalChatId, messageId, openParts });

      const usage = await gate.getStatus(userId);
      const donePayload = {
        type: 'done',
        chatId: finalChatId,
        answer: chatResult.answerText,
        ...(usage ? { usage } : {}),
        ...(chatResult.reading ? { runId: chatResult.reading.runId, grounding: { dropped: chatResult.reading.droppedClaims } } : {}),
      };

      await chatTurnService.completeTurn(prisma, activeTurn.turnId, donePayload);
      res.write(`id: ${activeTurn.seq}\nevent: turn_done\ndata: ${JSON.stringify({ turnId: activeTurn.turnId, seq: activeTurn.seq, ...donePayload })}\n\n`);
      flush();
    } catch (e: any) {
      logChatProviderError('ask-stream', e);
      if (ticket) await gate.release(ticket);
      const usage = await gate.getStatus(userId);
      const errPayload = { type: 'error', message: publicMessageFromChatProviderError(e), ...(usage ? { usage } : {}) };
      await chatTurnService.failTurn(prisma, activeTurn.turnId, e?.message || String(e), errPayload);
      res.write(`id: ${activeTurn.seq}\nevent: error\ndata: ${JSON.stringify({ turnId: activeTurn.turnId, seq: activeTurn.seq, ...errPayload })}\n\n`);
      flush();
    } finally {
      if (pingTimer) clearInterval(pingTimer);
      res.end();
    }
  });

  /**
   * Resumes an existing chat turn SSE stream from sequence number `lastSeq`.
   */
  app.get('/api/chat/resume-stream', async (req, res) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const turnId = String(req.query.turnId || '');
    if (!turnId) {
      return res.status(400).json({ error: 'turnId is required' });
    }

    const lastSeqHeader = req.headers['last-event-id'];
    const lastSeqRaw = req.query.lastSeq ?? (Array.isArray(lastSeqHeader) ? lastSeqHeader[0] : lastSeqHeader);
    const lastSeq = lastSeqRaw !== undefined ? Number(lastSeqRaw) : -1;

    const turn = await chatTurnService.getTurn(prisma, turnId, userId);
    if (!turn) {
      return res.status(404).json({ error: 'Turn not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', SSE_CACHE_CONTROL);
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    req.socket?.setNoDelay?.(true);

    type ResWithFlush = express.Response & { flush?: () => void };
    const flush = () => (res as ResWithFlush).flush?.();

    // 1. Replay historical events seq > lastSeq
    for (const ev of turn.events) {
      if (ev.seq > lastSeq) {
        const dataObj = typeof ev.content === 'object' && ev.content !== null ? { ...(ev.content as object), seq: ev.seq } : { type: ev.type, seq: ev.seq, content: ev.content };
        res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(dataObj)}\n\n`);
      }
    }
    flush();

    // 2. If turn is completed or failed, close stream
    if (turn.status === 'completed' || turn.status === 'failed') {
      res.end();
      return;
    }

    // 3. If turn is streaming/pending, attach to active turn emitter
    const active = chatTurnService.getActiveTurn(turnId);
    if (!active || active.status === 'completed' || active.status === 'failed') {
      res.end();
      return;
    }

    const onEvent = (ev: TurnEvent) => {
      if (ev.seq > lastSeq) {
        const dataObj = typeof ev.content === 'object' && ev.content !== null ? { ...(ev.content as object), seq: ev.seq } : { type: ev.type, seq: ev.seq, content: ev.content };
        res.write(`id: ${ev.seq}\nevent: ${ev.type}\ndata: ${JSON.stringify(dataObj)}\n\n`);
        flush();
      }
    };

    const cleanup = () => {
      active.emitter.off('event', onEvent);
      active.emitter.off('done', onDone);
      active.emitter.off('error', onError);
    };

    const onDone = () => {
      cleanup();
      res.end();
    };

    const onError = () => {
      cleanup();
      res.end();
    };

    active.emitter.on('event', onEvent);
    active.emitter.on('done', onDone);
    active.emitter.on('error', onError);

    req.on('close', cleanup);
  });
}
