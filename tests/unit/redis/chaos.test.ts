import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateRequest, resetRequestAuthForTests } from '../../../src/auth/requestAuth.js';
import { ChatTurnService } from '../../../src/chat/chatTurnService.js';
import {
  appendTurnEventToRedis,
  checkRateLimit,
  executeRedisOp,
  getRedisCircuitState,
  resetRateLimiterForTests,
  resetRedisClientForTests,
  resetRedisTelemetryForTests,
  setRedisFetchForTests,
  writeTurnMetaToRedis,
} from '../../../src/lib/redis/index.js';
import { recordPageExecution, runWithPageContext } from '../../../src/telemetry/pageTiming.js';

const ORIGINAL_ENV = { ...process.env };
const TEST_SECRET = 'phase4-chaos-test-secret-0123456789abcdef';

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('Phase 4 100% packet-drop chaos suite', () => {
  beforeEach(() => {
    restoreEnv();
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRateLimiterForTests();
    resetRedisTelemetryForTests();
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.REDIS_COMMAND_TIMEOUT_MS = '25';
    process.env.REDIS_CIRCUIT_FAILURE_THRESHOLD = '5';
    process.env.REDIS_CIRCUIT_WINDOW_MS = '30000';
    process.env.REDIS_CIRCUIT_COOLDOWN_MS = '60000';
  });

  afterEach(() => {
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRateLimiterForTests();
    resetRedisTelemetryForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('survives a 100% Upstash packet-drop storm: breaker opens, rate limits & SSE fail open, auth fails closed, telemetry persists', async () => {
    // 100% packet drop: fetch hangs until aborted by client timeout
    const fetchMock = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    setRedisFetchForTests(fetchMock);

    // 5 rate-limiter calls fail open AND trip breaker OPEN (25ms x 5 < 250ms total)
    const mockPrisma = {
      appErrorEvent: { create: vi.fn().mockResolvedValue({ id: 'e1' }) },
      pageExecutionLog: { create: vi.fn().mockResolvedValue({ id: 'p1' }) },
      chatTurn: {
        create: vi.fn().mockResolvedValue({ id: 'turn-chaos-1' }),
        update: vi.fn().mockResolvedValue({ id: 'turn-chaos-1' }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'turn-chaos-1',
          userId: 'user-chaos',
          sessionId: 'sess-chaos',
          status: 'streaming',
          seq: 1,
          events: [{ seq: 1, type: 'token', content: { delta: 'ok' }, timestamp: '2026-11-15T00:00:00Z' }],
        }),
      },
    } as any;

    for (let i = 0; i < 5; i++) {
      const rl = await checkRateLimit('graphql', `user-${i}`, { prisma: mockPrisma });
      expect(rl.allowed).toBe(true);
      expect(rl.degraded).toBe(true);
    }
    expect(getRedisCircuitState()).toBe('OPEN');
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Under OPEN breaker, SSE writes/reads fail open cleanly with zero fetch hangs
    const turnSvc = new ChatTurnService();
    await turnSvc.createTurn(mockPrisma, {
      userId: 'user-chaos',
      sessionId: 'sess-chaos',
      question: 'Health of stream?',
      ticket: null,
    });
    await writeTurnMetaToRedis({
      id: 'turn-chaos-1',
      userId: 'user-chaos',
      sessionId: 'sess-chaos',
      status: 'streaming',
      createdAtMs: Date.now(),
    });
    await appendTurnEventToRedis({
      meta: {
        id: 'turn-chaos-1',
        userId: 'user-chaos',
        sessionId: 'sess-chaos',
        status: 'streaming',
        createdAtMs: Date.now(),
      },
      event: { seq: 1, type: 'token', content: { delta: 'ok' }, timestamp: '2026-11-15T00:00:00Z' },
    });

    const consumer = new ChatTurnService();
    const resumed = await consumer.lookupTurnForResume(mockPrisma, {
      turnId: 'turn-chaos-1',
      userId: 'user-chaos',
    });
    expect(resumed.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(5); // Still short-circuited!

    // Auth under OPEN breaker falls back synchronously to PG -> fail closed if PG fails
    const token = jwt.sign({ sub: 'user-chaos', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });
    const pgHealthy = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      {
        secret: TEST_SECRET,
        readRow: vi.fn().mockResolvedValue({
          role: 'user',
          locked_at: null,
          token_version: 1,
          last_seen_at: new Date(),
        }),
      }
    );
    expect(pgHealthy.userId).toBe('user-chaos');

    resetRequestAuthForTests();
    const pgDown = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      {
        secret: TEST_SECRET,
        readRow: vi.fn().mockRejectedValue(new Error('DB down')),
        prisma: mockPrisma,
      }
    );
    expect(pgDown.userId).toBeNull();
    expect(pgDown.reason).toBe('auth_unavailable');

    // Page timing telemetry captures mixed hit/miss cache_status & meta.redis_latency_ms
    resetRedisClientForTests();
    setRedisFetchForTests(async () => new Response(JSON.stringify({ result: 'hit-val' }), { status: 200 }));
    process.env.PAGE_TIMING_ENABLED = '1';

    await runWithPageContext(
      { requestId: 'req-chaos-1', queryCount: 0, dbMs: 0 },
      async () => {
        await executeRedisOp('page:get1', (r) => r.get('k1'));
        await executeRedisOp('page:get2', async () => null, { kindOnNull: 'miss' });
        await recordPageExecution(mockPrisma, {
          requestId: 'req-chaos-1',
          userId: 'user-chaos',
          pagePath: '/you',
          routePattern: '/you',
          source: 'graphql',
          method: 'POST',
          statusCode: 200,
          durationMs: 42,
        });
      }
    );

    expect(mockPrisma.pageExecutionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cache_status: 'partial',
          meta: expect.objectContaining({
            cacheHits: 1,
            cacheMisses: 1,
            redisOps: 2,
          }),
        }),
      })
    );
  });
});
