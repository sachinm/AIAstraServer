import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  hashRateLimitKey,
  resetRateLimiterForTests,
  resetRedisClientForTests,
  setRedisFetchForTests,
} from '../../../src/lib/redis/index.js';

const ORIGINAL_ENV = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('Upstash distributed rate limiter (fail-open + hashed keys)', () => {
  beforeEach(() => {
    restoreEnv();
    resetRedisClientForTests();
    resetRateLimiterForTests();
  });

  afterEach(() => {
    resetRedisClientForTests();
    resetRateLimiterForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('hashes raw identifiers with SHA-256 and never sends PII on the wire', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';

    const rawEmail = 'Sita.Sharma+test@Example.com';
    const hashed = hashRateLimitKey(rawEmail);
    expect(hashed).toMatch(/^[0-9a-f]{32}$/);
    expect(hashed).toBe(hashRateLimitKey('  sita.sharma+test@example.com  '));

    const sentBodies: string[] = [];
    setRedisFetchForTests(async (_url, init) => {
      sentBodies.push(String(init?.body ?? ''));
      // Upstash slidingWindow returns [remainingTokens, effectiveLimit]
      return new Response(JSON.stringify({ result: [4, 5] }), { status: 200 });
    });

    const res = await checkRateLimit('otp_send', rawEmail);
    expect(res.allowed).toBe(true);
    expect(res.degraded).toBe(false);

    const combined = sentBodies.join('\n');
    expect(combined).toContain(hashed);
    expect(combined.toLowerCase()).not.toContain('sita');
    expect(combined.toLowerCase()).not.toContain('example.com');
  });

  it('enforces slidingWindow and tokenBucket caps via Upstash REST', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.RATE_LIMIT_OTP_PER_15M = '2';
    process.env.RATE_LIMIT_GEMINI_PER_MIN = '1';

    let otpCalls = 0;
    let geminiCalls = 0;
    setRedisFetchForTests(async (_url, init) => {
      const bodyStr = String(init?.body ?? '');
      if (bodyStr.includes('rl:otp:')) {
        otpCalls++;
        // slidingWindow evaluates [remainingTokens, effectiveLimit]
        const remaining = otpCalls <= 2 ? 2 - otpCalls : -1;
        return new Response(JSON.stringify({ result: [remaining, 2] }), { status: 200 });
      }
      if (bodyStr.includes('rl:gemini:')) {
        geminiCalls++;
        // tokenBucket returns [remaining, resetMs, effectiveLimit]
        const remaining = geminiCalls <= 1 ? 0 : -1;
        return new Response(JSON.stringify({ result: [remaining, Date.now() + 15_000, 1] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ result: [1, 2] }), { status: 200 });
    });

    const firstOtp = await checkRateLimit('otp_send', 'user@example.com');
    const secondOtp = await checkRateLimit('otp_send', 'user@example.com');
    const thirdOtp = await checkRateLimit('otp_send', 'user@example.com');

    expect(firstOtp.allowed).toBe(true);
    expect(secondOtp.allowed).toBe(true);
    expect(thirdOtp.allowed).toBe(false);
    expect(thirdOtp.retryAfterSec).toBeGreaterThanOrEqual(1);

    const firstGemini = await checkRateLimit('gemini_api', 'user-123');
    const secondGemini = await checkRateLimit('gemini_api', 'user-123');
    expect(firstGemini.allowed).toBe(true);
    expect(secondGemini.allowed).toBe(false);
    expect(secondGemini.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('fails open on Redis errors and throttles rate_limit_redis_unavailable telemetry to once per 60s', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';

    const createAppError = vi.fn().mockResolvedValue({ id: 'err-1' });
    const fakePrisma = {
      appErrorEvent: { create: createAppError },
    } as any;

    setRedisFetchForTests(async () => new Response(JSON.stringify({ error: 'ERR' }), { status: 500 }));

    let fakeNow = 500_000;
    const nowFn = () => fakeNow;

    const r1 = await checkRateLimit('graphql', 'user-1', { prisma: fakePrisma, now: nowFn });
    const r2 = await checkRateLimit('graphql', 'user-1', { prisma: fakePrisma, now: nowFn });

    expect(r1.allowed).toBe(true);
    expect(r1.degraded).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r2.degraded).toBe(true);

    // Wait a tick for void telemetry write
    await new Promise((r) => setTimeout(r, 10));
    expect(createAppError).toHaveBeenCalledTimes(1);
    expect(createAppError).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_code: 'rate_limit_redis_unavailable',
          source: 'server_rest',
          severity: 'warn',
        }),
      })
    );

    // After 61 seconds, a new failure emits another alert
    fakeNow += 61_000;
    await checkRateLimit('graphql', 'user-1', { prisma: fakePrisma, now: nowFn });
    await new Promise((r) => setTimeout(r, 10));
    expect(createAppError).toHaveBeenCalledTimes(2);
  });
});
