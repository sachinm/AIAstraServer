import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatTurnService } from '../../../src/chat/chatTurnService.js';
import {
  resetRedisClientForTests,
  resetRedisTelemetryForTests,
  setRedisFetchForTests,
} from '../../../src/lib/redis/index.js';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function createSseUpstashMock() {
  const strings = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const ttls = new Map<string, number>();

  function runCommand(cmd: unknown[]): unknown {
    const op = String(cmd[0] || '').toUpperCase();
    if (op === 'GET') return strings.get(String(cmd[1])) ?? null;
    if (op === 'MGET') return cmd.slice(1).map((k) => strings.get(String(k)) ?? null);
    if (op === 'SET') {
      const k = String(cmd[1]);
      const v = typeof cmd[2] === 'string' ? cmd[2] : JSON.stringify(cmd[2]);
      strings.set(k, v);
      for (let i = 3; i < cmd.length; i++) {
        if (String(cmd[i]).toUpperCase() === 'EX' && cmd[i + 1] != null) {
          ttls.set(k, Number(cmd[i + 1]));
        }
      }
      return 'OK';
    }
    if (op === 'RPUSH') {
      const k = String(cmd[1]);
      const arr = lists.get(k) ?? [];
      for (const item of cmd.slice(2)) {
        arr.push(typeof item === 'string' ? item : JSON.stringify(item));
      }
      lists.set(k, arr);
      return arr.length;
    }
    if (op === 'LTRIM') {
      const k = String(cmd[1]);
      const start = Number(cmd[2]);
      const stop = Number(cmd[3]);
      const arr = lists.get(k) ?? [];
      const slice = arr.slice(start, stop === -1 ? undefined : stop + 1);
      lists.set(k, slice);
      return 'OK';
    }
    if (op === 'LRANGE') {
      const k = String(cmd[1]);
      const start = Number(cmd[2]);
      const stop = Number(cmd[3]);
      const arr = lists.get(k) ?? [];
      return arr.slice(start, stop === -1 ? undefined : stop + 1);
    }
    if (op === 'EXPIRE') {
      const k = String(cmd[1]);
      ttls.set(k, Number(cmd[2]));
      return 1;
    }
    return null;
  }

  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '[]'));
    if (String(url).endsWith('/pipeline')) {
      return new Response(
        JSON.stringify((body as unknown[][]).map((c) => ({ result: runCommand(c) }))),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ result: runCommand(body as unknown[]) }), { status: 200 });
  });

  return { strings, lists, ttls, fetchMock };
}

describe('Redis resumable SSE turn buffer (fail-open + 403 ownership isolation)', () => {
  beforeEach(() => {
    restoreEnv();
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.REDIS_SSE_BUFFER_TTL_SECONDS = '600';
    process.env.REDIS_SSE_BUFFER_MAX_EVENTS = '50';
  });

  afterEach(() => {
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('buffers SSE events with sliding 600s TTL, trims to maxEvents, and resumes across Lambdas by sessionId or turnId', async () => {
    const { strings, lists, ttls, fetchMock } = createSseUpstashMock();
    setRedisFetchForTests(fetchMock);

    const mockDb = {
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-sse-1' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-sse-1' }),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const producer = new ChatTurnService();
    await producer.createTurn(mockDb, {
      userId: 'user-1',
      sessionId: 'sess-1',
      question: 'Career outlook?',
      ticket: null,
    });
    for (let i = 1; i <= 54; i++) {
      await producer.recordEvent(mockDb, 'turn-sse-1', 'token', { delta: `chunk-${i}` });
    }
    await producer.completeTurn(mockDb, 'turn-sse-1', { answer: 'Full answer' });

    await new Promise((r) => setTimeout(r, 25));

    // Verified sliding TTL 600 and trimmed list cap = 50 (clamped production min 50..5000)
    expect(ttls.get('sse:turn:turn-sse-1:events')).toBe(600);
    expect(ttls.get('sse:session:user-1:sess-1')).toBe(600);
    expect(lists.get('sse:turn:turn-sse-1:events')?.length).toBe(50);
    expect(strings.has('sse:turn:turn-sse-1:meta')).toBe(true);

    // Different Lambda instance (empty activeTurns Map) resumes via sessionId OR turnId from Redis without hitting PG
    const crossLambdaConsumer = new ChatTurnService();
    const bySession = await crossLambdaConsumer.lookupTurnForResume(mockDb, {
      sessionId: 'sess-1',
      userId: 'user-1',
    });
    expect(bySession.status).toBe('ok');
    if (bySession.status === 'ok') {
      expect(bySession.turn.turnId).toBe('turn-sse-1');
      expect(bySession.turn.status).toBe('completed');
      expect(bySession.turn.events.map((e) => e.seq)).toEqual(
        Array.from({ length: 50 }, (_, idx) => idx + 6)
      );
    }
    expect(mockDb.chatTurn.findFirst).not.toHaveBeenCalled();

    // Cross-user resume attempt by turnId or sessionId must return forbidden (403)
    const crossUserTurn = await crossLambdaConsumer.lookupTurnForResume(mockDb, {
      turnId: 'turn-sse-1',
      userId: 'attacker-2',
    });
    expect(crossUserTurn.status).toBe('forbidden');

    const crossUserSession = await crossLambdaConsumer.lookupTurnForResume(mockDb, {
      sessionId: 'sess-1',
      userId: 'attacker-2',
    });
    expect(crossUserSession.status).toBe('forbidden');
  });

  it('fails open to PostgreSQL chat_turns when Redis drops packets during resume lookup', async () => {
    setRedisFetchForTests(async () => new Response(JSON.stringify({ error: 'ERR' }), { status: 500 }));

    const mockDb = {
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-pg-fallback' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-pg-fallback' }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'turn-pg-fallback',
          userId: 'user-1',
          sessionId: 'sess-pg',
          status: 'completed',
          seq: 2,
          events: [
            { seq: 1, type: 'token', content: { delta: 'hi' }, timestamp: '2026-11-15T00:00:00Z' },
            { seq: 2, type: 'turn_done', content: { answer: 'hi' }, timestamp: '2026-11-15T00:00:01Z' },
          ],
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const consumer = new ChatTurnService();
    const res = await consumer.lookupTurnForResume(mockDb, {
      turnId: 'turn-pg-fallback',
      userId: 'user-1',
    });

    expect(res.status).toBe('ok');
    if (res.status === 'ok') {
      expect(res.turn.events).toHaveLength(2);
    }
    expect(mockDb.chatTurn.findUnique).toHaveBeenCalledTimes(1);
  });
});
