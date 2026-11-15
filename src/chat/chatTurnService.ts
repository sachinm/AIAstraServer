import { EventEmitter } from 'node:events';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { QuestionTicket } from '../billing/questionGate.js';
import {
  appendTurnEventToRedis,
  readTurnFromRedis,
  writeTurnMetaToRedis,
} from '../lib/redis/sseBuffer.js';

export type TurnStatus = 'pending' | 'streaming' | 'completed' | 'failed';

export interface TurnEvent {
  seq: number;
  type: string;
  content: unknown;
  timestamp: string;
}

export interface ActiveTurn {
  turnId: string;
  userId: string;
  sessionId: string | null;
  status: TurnStatus;
  seq: number;
  events: TurnEvent[];
  emitter: EventEmitter;
  ticket: QuestionTicket | null;
  lastPersistedSeq: number;
  lastPersistedAt: number;
  createdAtMs: number;
}

export type ResumeTurnLookupResult =
  | {
      status: 'ok';
      turn: { turnId: string; status: TurnStatus; seq: number; events: TurnEvent[] };
    }
  | { status: 'forbidden' }
  | { status: 'not_found' };

export class ChatTurnService {
  private activeTurns = new Map<string, ActiveTurn>();

  async createTurn(
    db: PrismaClient,
    params: {
      userId: string;
      kundliId?: string | null;
      sessionId?: string | null;
      question: string;
      ticket: QuestionTicket | null;
    }
  ): Promise<ActiveTurn> {
    const turn = await db.chatTurn.create({
      data: {
        userId: params.userId,
        kundliId: params.kundliId ?? null,
        sessionId: params.sessionId ?? null,
        question: params.question,
        status: 'pending',
        seq: 0,
        events: [] as unknown as Prisma.InputJsonValue,
      },
    });

    const createdAtMs = Date.now();
    const sessionId = params.sessionId ?? null;
    const active: ActiveTurn = {
      turnId: turn.id,
      userId: params.userId,
      sessionId,
      status: 'pending',
      seq: 0,
      events: [],
      emitter: new EventEmitter(),
      ticket: params.ticket,
      lastPersistedSeq: 0,
      lastPersistedAt: createdAtMs,
      createdAtMs,
    };
    active.emitter.setMaxListeners(50);
    this.activeTurns.set(turn.id, active);

    void writeTurnMetaToRedis({
      id: turn.id,
      userId: params.userId,
      sessionId,
      status: 'pending',
      createdAtMs,
    }).catch(() => undefined);

    return active;
  }

  getActiveTurn(turnId: string): ActiveTurn | undefined {
    return this.activeTurns.get(turnId);
  }

  getEventsSince(turnId: string, sinceSeq: number): TurnEvent[] {
    const active = this.activeTurns.get(turnId);
    if (!active) return [];
    return active.events.filter((e) => e.seq > sinceSeq);
  }

  async recordEvent(
    db: PrismaClient,
    turnId: string,
    type: string,
    content: unknown
  ): Promise<TurnEvent> {
    const active = this.activeTurns.get(turnId);
    if (!active) throw new Error(`Turn ${turnId} not active`);

    if (active.status === 'pending') {
      active.status = 'streaming';
    }

    const seq = active.seq + 1;
    active.seq = seq;
    const event: TurnEvent = {
      seq,
      type,
      content,
      timestamp: new Date().toISOString(),
    };
    active.events.push(event);
    active.emitter.emit('event', event);

    void appendTurnEventToRedis({
      meta: {
        id: turnId,
        userId: active.userId,
        sessionId: active.sessionId,
        status: active.status,
        createdAtMs: active.createdAtMs,
      },
      event,
    }).catch(() => undefined);

    // Throttle DB persist: write if > 1000ms elapsed or milestone event
    const now = Date.now();
    const isMilestone = type !== 'token';
    if (isMilestone || now - active.lastPersistedAt > 1000) {
      active.lastPersistedAt = now;
      active.lastPersistedSeq = seq;
      db.chatTurn
        .update({
          where: { id: turnId },
          data: {
            status: active.status,
            seq,
            events: active.events as unknown as Prisma.InputJsonValue,
          },
        })
        .catch((err) => console.warn(`[chatTurn] intermediate persist error:`, err.message));
    }

    return event;
  }

  async completeTurn(
    db: PrismaClient,
    turnId: string,
    finalPayload: unknown
  ): Promise<void> {
    const active = this.activeTurns.get(turnId);
    if (!active) return;

    active.status = 'completed';
    const finalSeq = active.seq + 1;
    active.seq = finalSeq;
    const doneEvent: TurnEvent = {
      seq: finalSeq,
      type: 'turn_done',
      content: finalPayload,
      timestamp: new Date().toISOString(),
    };
    active.events.push(doneEvent);
    active.emitter.emit('event', doneEvent);
    active.emitter.emit('done');

    void appendTurnEventToRedis({
      meta: {
        id: turnId,
        userId: active.userId,
        sessionId: active.sessionId,
        status: 'completed',
        createdAtMs: active.createdAtMs,
      },
      event: doneEvent,
    }).catch(() => undefined);

    await db.chatTurn.update({
      where: { id: turnId },
      data: {
        status: 'completed',
        seq: finalSeq,
        events: active.events as unknown as Prisma.InputJsonValue,
      },
    });

    // Retain in memory for 5 minutes for instant resume replay, then evict
    setTimeout(() => {
      this.activeTurns.delete(turnId);
    }, 5 * 60_000);
  }

  async failTurn(
    db: PrismaClient,
    turnId: string,
    error: string,
    errorPayload?: unknown
  ): Promise<void> {
    const active = this.activeTurns.get(turnId);
    if (!active) return;

    active.status = 'failed';
    const errSeq = active.seq + 1;
    active.seq = errSeq;
    const errEvent: TurnEvent = {
      seq: errSeq,
      type: 'error',
      content: errorPayload ?? { message: error },
      timestamp: new Date().toISOString(),
    };
    active.events.push(errEvent);
    active.emitter.emit('event', errEvent);
    active.emitter.emit('error', error);

    void appendTurnEventToRedis({
      meta: {
        id: turnId,
        userId: active.userId,
        sessionId: active.sessionId,
        status: 'failed',
        errorMessage: error,
        createdAtMs: active.createdAtMs,
      },
      event: errEvent,
    }).catch(() => undefined);

    await db.chatTurn
      .update({
        where: { id: turnId },
        data: {
          status: 'failed',
          seq: errSeq,
          events: active.events as unknown as Prisma.InputJsonValue,
          error,
        },
      })
      .catch(() => undefined);

    setTimeout(() => {
      this.activeTurns.delete(turnId);
    }, 5 * 60_000);
  }

  /**
   * Resolves a chat turn for SSE replay across memory -> Redis SSE buffer -> PostgreSQL `chat_turns`.
   * Explicitly returns `'forbidden'` when the turn belongs to a different user so callers return HTTP 403.
   */
  async lookupTurnForResume(
    db: PrismaClient,
    params: { turnId?: string; sessionId?: string; userId: string }
  ): Promise<ResumeTurnLookupResult> {
    const turnId = params.turnId?.trim() || '';
    const sessionId = params.sessionId?.trim() || '';
    if (!turnId && !sessionId) {
      return { status: 'not_found' };
    }

    if (turnId) {
      const active = this.activeTurns.get(turnId);
      if (active) {
        if (active.userId !== params.userId) return { status: 'forbidden' };
        return {
          status: 'ok',
          turn: { turnId: active.turnId, status: active.status, seq: active.seq, events: active.events },
        };
      }
    } else if (sessionId) {
      let matchedLatest: ActiveTurn | null = null;
      for (const active of this.activeTurns.values()) {
        if (active.sessionId === sessionId) {
          if (!matchedLatest || active.createdAtMs >= matchedLatest.createdAtMs) {
            matchedLatest = active;
          }
        }
      }
      if (matchedLatest) {
        if (matchedLatest.userId !== params.userId) return { status: 'forbidden' };
        return {
          status: 'ok',
          turn: {
            turnId: matchedLatest.turnId,
            status: matchedLatest.status,
            seq: matchedLatest.seq,
            events: matchedLatest.events,
          },
        };
      }
    }

    const redisRes = await readTurnFromRedis({
      turnId: turnId || undefined,
      sessionId: sessionId || undefined,
      userId: params.userId,
    });
    if (redisRes.status === 'forbidden') {
      return { status: 'forbidden' };
    }
    if (redisRes.status === 'ok') {
      const lastSeq = redisRes.events.length
        ? redisRes.events[redisRes.events.length - 1].seq
        : 0;
      return {
        status: 'ok',
        turn: {
          turnId: redisRes.meta.id,
          status: redisRes.meta.status,
          seq: lastSeq,
          events: redisRes.events,
        },
      };
    }

    const row = turnId
      ? await db.chatTurn.findUnique({ where: { id: turnId } })
      : await db.chatTurn.findFirst({
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
        });

    if (!row) return { status: 'not_found' };
    if (row.userId !== params.userId) return { status: 'forbidden' };

    return {
      status: 'ok',
      turn: {
        turnId: row.id,
        status: row.status as TurnStatus,
        seq: row.seq,
        events: (row.events as unknown as TurnEvent[]) ?? [],
      },
    };
  }

  async getTurn(
    db: PrismaClient,
    turnId: string,
    userId: string
  ): Promise<{ status: TurnStatus; seq: number; events: TurnEvent[] } | null> {
    const res = await this.lookupTurnForResume(db, { turnId, userId });
    if (res.status !== 'ok') return null;
    return {
      status: res.turn.status,
      seq: res.turn.seq,
      events: res.turn.events,
    };
  }
}

export const chatTurnService = new ChatTurnService();
