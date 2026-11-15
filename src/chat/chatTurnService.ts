import { EventEmitter } from 'node:events';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { QuestionTicket } from '../billing/questionGate.js';

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
  status: TurnStatus;
  seq: number;
  events: TurnEvent[];
  emitter: EventEmitter;
  ticket: QuestionTicket | null;
  lastPersistedSeq: number;
  lastPersistedAt: number;
}

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

    const active: ActiveTurn = {
      turnId: turn.id,
      userId: params.userId,
      status: 'pending',
      seq: 0,
      events: [],
      emitter: new EventEmitter(),
      ticket: params.ticket,
      lastPersistedSeq: 0,
      lastPersistedAt: Date.now(),
    };
    active.emitter.setMaxListeners(50);
    this.activeTurns.set(turn.id, active);
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

  async getTurn(
    db: PrismaClient,
    turnId: string,
    userId: string
  ): Promise<{ status: TurnStatus; seq: number; events: TurnEvent[] } | null> {
    const active = this.activeTurns.get(turnId);
    if (active && active.userId === userId) {
      return { status: active.status, seq: active.seq, events: active.events };
    }
    const row = await db.chatTurn.findUnique({
      where: { id: turnId },
    });
    if (!row || row.userId !== userId) return null;
    return {
      status: row.status as TurnStatus,
      seq: row.seq,
      events: (row.events as unknown as TurnEvent[]) ?? [],
    };
  }
}

export const chatTurnService = new ChatTurnService();
