import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import type { PrismaClient } from '@prisma/client';
import {
  getRateLimitChartCalcPer10m,
  getRateLimitGeminiPerMin,
  getRateLimitGraphqlPerMin,
  getRateLimitOtpPer15m,
  isRedisEnabled,
} from '../../config/env.js';
import { recordAppError } from '../../telemetry/appErrors.js';
import { executeRedisOp } from './client.js';

export type RateLimitScope = 'otp_send' | 'graphql' | 'chart_calc' | 'gemini_api';

export interface RateLimitCheckResult {
  allowed: boolean;
  degraded: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  resetAtMs: number;
}

export class RateLimitExceededError extends Error {
  readonly code = 'RATE_LIMITED';
  readonly statusCode = 429;
  readonly scope: RateLimitScope;
  readonly retryAfterSec: number;

  constructor(scope: RateLimitScope, retryAfterSec: number, message?: string) {
    super(message ?? `Rate limit exceeded for ${scope}`);
    this.name = 'RateLimitExceededError';
    this.scope = scope;
    this.retryAfterSec = Math.max(1, retryAfterSec);
  }
}

let limiterByClient = new WeakMap<Redis, Map<string, Ratelimit>>();
let lastDegradedAlertAtMs = 0;

export function resetRateLimiterForTests(): void {
  limiterByClient = new WeakMap<Redis, Map<string, Ratelimit>>();
  lastDegradedAlertAtMs = 0;
}

/**
 * Produces a 32-hex SHA-256 digest of a normalized identifier so zero raw emails, user IDs, or IPs
 * ever appear in Redis keys or diagnostics.
 */
export function hashRateLimitKey(rawIdentifier: string): string {
  const normalized = rawIdentifier.trim().toLowerCase() || 'anonymous';
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

function configuredMaxForScope(scope: RateLimitScope): number {
  switch (scope) {
    case 'otp_send':
      return getRateLimitOtpPer15m();
    case 'graphql':
      return getRateLimitGraphqlPerMin();
    case 'chart_calc':
      return getRateLimitChartCalcPer10m();
    case 'gemini_api':
      return getRateLimitGeminiPerMin();
  }
}

function getOrCreateLimiter(redis: Redis, scope: RateLimitScope): Ratelimit {
  let map = limiterByClient.get(redis);
  if (!map) {
    map = new Map<string, Ratelimit>();
    limiterByClient.set(redis, map);
  }

  const maxLimit = configuredMaxForScope(scope);
  const cacheKey = `${scope}:${maxLimit}`;
  const existing = map.get(cacheKey);
  if (existing) {
    return existing;
  }

  let created: Ratelimit;
  switch (scope) {
    case 'otp_send':
      created = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxLimit, '15 m'),
        prefix: 'rl:otp',
        analytics: false,
        ephemeralCache: false,
      });
      break;
    case 'graphql':
      created = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxLimit, '1 m'),
        prefix: 'rl:gql',
        analytics: false,
        ephemeralCache: false,
      });
      break;
    case 'chart_calc':
      created = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxLimit, '10 m'),
        prefix: 'rl:chart',
        analytics: false,
        ephemeralCache: false,
      });
      break;
    case 'gemini_api':
      created = new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(maxLimit, '1 m', maxLimit),
        prefix: 'rl:gemini',
        analytics: false,
        ephemeralCache: false,
      });
      break;
  }

  map.set(cacheKey, created);
  return created;
}

/**
 * Checks a distributed rate limit in Redis.
 * Policy: FAIL OPEN when Redis is disabled, slow, or unreachable, emitting at most one
 * `rate_limit_redis_unavailable` warning row in `app_error_events` per 60 seconds when enabled.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  rawIdentifier: string,
  opts?: { prisma?: PrismaClient | null; now?: () => number }
): Promise<RateLimitCheckResult> {
  const nowFn = opts?.now ?? Date.now;
  const maxLimit = configuredMaxForScope(scope);
  const hashedId = hashRateLimitKey(rawIdentifier);

  const exec = await executeRedisOp(
    `ratelimit:${scope}`,
    async (redis) => {
      const limiter = getOrCreateLimiter(redis, scope);
      const res = await limiter.limit(hashedId);
      if (res.pending && typeof res.pending.catch === 'function') {
        void res.pending.catch(() => undefined);
      }
      return res;
    },
    { kindOnNull: 'miss', now: nowFn }
  );

  if (!exec.ok || !exec.value) {
    const nowMs = nowFn();
    if (isRedisEnabled() && opts?.prisma && nowMs - lastDegradedAlertAtMs >= 60_000) {
      lastDegradedAlertAtMs = nowMs;
      void recordAppError(opts.prisma, {
        source: 'server_rest',
        severity: 'warn',
        category: 'rate_limit',
        errorCode: 'rate_limit_redis_unavailable',
        operation: scope,
        message: 'Redis rate limiter unavailable; failing open',
        meta: {
          circuitState: exec.circuitState,
          timedOut: exec.timedOut,
        },
      }).catch(() => undefined);
    }

    return {
      allowed: true,
      degraded: true,
      limit: maxLimit,
      remaining: maxLimit,
      retryAfterSec: 0,
      resetAtMs: nowMs,
    };
  }

  const rl = exec.value;
  const retryAfterSec = rl.success
    ? 0
    : Math.max(1, Math.ceil((rl.reset - nowFn()) / 1000));

  return {
    allowed: rl.success,
    degraded: false,
    limit: rl.limit,
    remaining: rl.remaining,
    retryAfterSec,
    resetAtMs: rl.reset,
  };
}
