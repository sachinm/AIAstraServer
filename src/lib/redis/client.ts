import {
  Redis,
  type Requester,
  type UpstashRequest,
  type UpstashResponse,
} from '@upstash/redis';
import {
  getRedisCircuitCooldownMs,
  getRedisCircuitFailureThreshold,
  getRedisCircuitWindowMs,
  getRedisCommandTimeoutMs,
  getRedisRestToken,
  getRedisRestUrl,
  isRedisEnabled,
} from '../../config/env.js';
import { recordPageCacheOp } from '../../telemetry/pageTiming.js';
import {
  recordRedisSample,
  recordRedisShortCircuit,
  setRedisTelemetryCircuitState,
  type RedisCircuitState,
} from './telemetry.js';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class RedisTimeoutError extends Error {
  readonly code = 'REDIS_TIMEOUT';

  constructor(timeoutMs: number) {
    super(`Redis command timed out after ${timeoutMs}ms`);
    this.name = 'RedisTimeoutError';
  }
}

export interface RedisExecutionResult<T> {
  ok: boolean;
  value: T | null;
  skipped: boolean;
  timedOut: boolean;
  latencyMs: number;
  circuitState: RedisCircuitState;
  error: string | null;
}

export interface ExecuteRedisOpOptions {
  kindOnNull?: 'hit' | 'miss' | 'write';
  isWrite?: boolean;
  now?: () => number;
}

let fetchOverride: FetchLike | null = null;
let cachedClient: Redis | null = null;
let cachedConfigKey = '';

let circuitState: RedisCircuitState = 'CLOSED';
let failureTimestamps: number[] = [];
let openedAtMs = 0;
let probeInFlight = false;

export function setRedisFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
  cachedClient = null;
  cachedConfigKey = '';
}

export function getRedisCircuitState(): RedisCircuitState {
  return circuitState;
}

export function resetRedisClientForTests(): void {
  fetchOverride = null;
  cachedClient = null;
  cachedConfigKey = '';
  circuitState = 'CLOSED';
  failureTimestamps = [];
  openedAtMs = 0;
  probeInFlight = false;
}

function buildUpstashRequester(baseUrl: string, token: string): Requester {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const requester: Requester & { upstashSyncToken?: string } = {
    readYourWrites: true,
    upstashSyncToken: '',
    async request<TResult>(req: UpstashRequest): Promise<UpstashResponse<TResult>> {
      const timeoutMs = getRedisCommandTimeoutMs();
      const targetUrl = [normalizedBase, ...(req.path ?? [])].join('/');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(requester.upstashSyncToken ? { 'upstash-sync-token': requester.upstashSyncToken } : {}),
        ...(req.headers ?? {}),
      };

      const controller = new AbortController();
      const upstreamSignal = req.signal;
      if (upstreamSignal) {
        if (upstreamSignal.aborted) {
          controller.abort(upstreamSignal.reason);
        } else {
          upstreamSignal.addEventListener('abort', () => controller.abort(upstreamSignal.reason), {
            once: true,
          });
        }
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const timeoutErr = new RedisTimeoutError(timeoutMs);
          try {
            controller.abort(timeoutErr);
          } catch {
            controller.abort();
          }
          reject(timeoutErr);
        }, timeoutMs);
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
      });

      const fetchImpl = fetchOverride ?? globalThis.fetch;
      if (typeof fetchImpl !== 'function') {
        if (timer) clearTimeout(timer);
        throw new Error('Global fetch is unavailable for Redis REST requester');
      }

      const doFetch = async (): Promise<UpstashResponse<TResult>> => {
        const response = await fetchImpl(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(req.body),
          signal: controller.signal,
          keepalive: true,
        });

        const syncToken = response.headers?.get?.('upstash-sync-token');
        if (syncToken) {
          requester.upstashSyncToken = syncToken;
        }

        const rawText = await response.text();
        let parsed: unknown;
        try {
          parsed = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error(`Upstash REST invalid JSON response (HTTP ${response.status})`);
        }

        if (!response.ok) {
          const errMsg =
            typeof (parsed as { error?: unknown })?.error === 'string'
              ? (parsed as { error: string }).error
              : `HTTP ${response.status}`;
          throw new Error(`Upstash REST error: ${errMsg}`);
        }

        return parsed as UpstashResponse<TResult>;
      };

      try {
        return await Promise.race([doFetch(), timeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };

  return requester;
}

/**
 * Returns the shared Upstash Redis client when configured and enabled, or null otherwise.
 */
export function getRedisClient(): Redis | null {
  if (!isRedisEnabled()) {
    return null;
  }
  const url = getRedisRestUrl();
  const token = getRedisRestToken();
  if (!url || !token) {
    return null;
  }

  const configKey = `${url}|${token}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  cachedClient = new Redis(buildUpstashRequester(url, token));
  cachedConfigKey = configKey;
  return cachedClient;
}

function canExecuteWithBreaker(nowMs: number): { allowed: boolean; isProbe: boolean } {
  if (circuitState === 'CLOSED') {
    return { allowed: true, isProbe: false };
  }

  if (circuitState === 'OPEN') {
    if (nowMs - openedAtMs < getRedisCircuitCooldownMs()) {
      return { allowed: false, isProbe: false };
    }
    circuitState = 'HALF_OPEN';
    probeInFlight = true;
    setRedisTelemetryCircuitState('HALF_OPEN', false);
    return { allowed: true, isProbe: true };
  }

  // HALF_OPEN: allow only a single probe until it resolves.
  if (probeInFlight) {
    return { allowed: false, isProbe: false };
  }
  probeInFlight = true;
  return { allowed: true, isProbe: true };
}

function markOperationSuccess(isProbe: boolean): void {
  if (isProbe || circuitState !== 'CLOSED') {
    circuitState = 'CLOSED';
    failureTimestamps = [];
    openedAtMs = 0;
    probeInFlight = false;
    setRedisTelemetryCircuitState('CLOSED', false);
  }
}

function markOperationFailure(nowMs: number, isProbe: boolean): void {
  if (isProbe || circuitState === 'HALF_OPEN') {
    probeInFlight = false;
    circuitState = 'OPEN';
    openedAtMs = nowMs;
    failureTimestamps = [nowMs];
    setRedisTelemetryCircuitState('OPEN', true);
    return;
  }

  const cutoff = nowMs - getRedisCircuitWindowMs();
  failureTimestamps = failureTimestamps.filter((ts) => ts > cutoff);
  failureTimestamps.push(nowMs);

  if (failureTimestamps.length >= getRedisCircuitFailureThreshold()) {
    circuitState = 'OPEN';
    openedAtMs = nowMs;
    setRedisTelemetryCircuitState('OPEN', true);
  }
}

/**
 * Executes a Redis operation with timeout enforcement, 3-state circuit breaker protection,
 * and telemetry tracking. Never throws on transient failure.
 */
export async function executeRedisOp<T>(
  _opName: string,
  fn: (redis: Redis) => Promise<T>,
  opts?: ExecuteRedisOpOptions
): Promise<RedisExecutionResult<T>> {
  const client = getRedisClient();
  if (!client) {
    return {
      ok: false,
      value: null,
      skipped: true,
      timedOut: false,
      latencyMs: 0,
      circuitState,
      error: null,
    };
  }

  const nowFn = opts?.now ?? Date.now;
  const gate = canExecuteWithBreaker(nowFn());
  if (!gate.allowed) {
    recordRedisShortCircuit();
    return {
      ok: false,
      value: null,
      skipped: true,
      timedOut: false,
      latencyMs: 0,
      circuitState,
      error: null,
    };
  }

  const startedAt = nowFn();
  try {
    const value = await fn(client);
    const latencyMs = Math.max(0, nowFn() - startedAt);
    markOperationSuccess(gate.isProbe);

    const outcome = opts?.isWrite
      ? 'write'
      : value != null
        ? 'hit'
        : (opts?.kindOnNull ?? 'miss');
    recordRedisSample({ kind: outcome, latencyMs });
    recordPageCacheOp({ outcome, durationMs: latencyMs, fromRedis: true });

    return {
      ok: true,
      value,
      skipped: false,
      timedOut: false,
      latencyMs,
      circuitState,
      error: null,
    };
  } catch (err) {
    const endNow = nowFn();
    const latencyMs = Math.max(0, endNow - startedAt);
    const timedOut = err instanceof RedisTimeoutError || (err instanceof Error && err.name === 'RedisTimeoutError');
    markOperationFailure(endNow, gate.isProbe);

    recordRedisSample({ kind: timedOut ? 'timeout' : 'error', latencyMs });
    recordPageCacheOp({ outcome: 'error', durationMs: latencyMs, fromRedis: true });

    return {
      ok: false,
      value: null,
      skipped: false,
      timedOut,
      latencyMs,
      circuitState,
      error: err instanceof Error ? err.message.slice(0, 160) : 'redis_error',
    };
  }
}
