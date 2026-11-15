import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  executeRedisOp,
  getRedisCircuitState,
  getRedisClient,
  getRedisTelemetrySnapshot,
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

describe('Redis REST client and 3-state circuit breaker', () => {
  beforeEach(() => {
    restoreEnv();
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
  });

  afterEach(() => {
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('acts as a complete zero-call no-op when Redis env vars are unset or disabled', async () => {
    delete process.env.REDIS_REST_URL;
    delete process.env.REDIS_REST_TOKEN;
    delete process.env.REDIS_ENABLED;

    const fetchMock = vi.fn();
    setRedisFetchForTests(fetchMock);

    expect(getRedisClient()).toBeNull();
    const res = await executeRedisOp('noop:get', async (r) => r.get('k'));
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.value).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.REDIS_ENABLED = '0';

    expect(getRedisClient()).toBeNull();
    const res2 = await executeRedisOp('disabled:get', async (r) => r.get('k'));
    expect(res2.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('executes single-attempt REST calls with keepalive and records telemetry', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'secret-token';
    delete process.env.REDIS_ENABLED;

    const fetchMock = vi.fn(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer secret-token');
      expect(init?.keepalive).toBe(true);
      return new Response(JSON.stringify({ result: 'cached-value' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    setRedisFetchForTests(fetchMock);

    const res = await executeRedisOp('test:get', async (r) => r.get<string>('sess:u:1'));
    expect(res.ok).toBe(true);
    expect(res.value).toBe('cached-value');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const snap = getRedisTelemetrySnapshot();
    expect(snap.hits).toBe(1);
    expect(snap.errors).toBe(0);
    expect(snap.circuitState).toBe('CLOSED');
  });

  it('aborts hung calls after the 150ms command timeout without SDK retry', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'secret-token';
    process.env.REDIS_COMMAND_TIMEOUT_MS = '35';

    const fetchMock = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    setRedisFetchForTests(fetchMock);

    const started = Date.now();
    const res = await executeRedisOp('slow:get', async (r) => r.get('slow-key'));
    const elapsed = Date.now() - started;

    expect(res.ok).toBe(false);
    expect(res.timedOut).toBe(true);
    expect(res.skipped).toBe(false);
    expect(elapsed).toBeLessThan(300);
    // Crucial: custom Requester does NOT double-retry failed REST requests
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRedisTelemetrySnapshot().timeouts).toBe(1);
  });

  it('opens circuit after 5 failures in 30s, short-circuits during cooldown, and runs single-probe HALF_OPEN recovery', async () => {
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'secret-token';
    process.env.REDIS_CIRCUIT_FAILURE_THRESHOLD = '5';
    process.env.REDIS_CIRCUIT_WINDOW_MS = '30000';
    process.env.REDIS_CIRCUIT_COOLDOWN_MS = '60000';

    let fakeNow = 1_000_000;
    const nowFn = () => fakeNow;

    let shouldFail = true;
    const fetchMock = vi.fn(async () => {
      if (shouldFail) {
        return new Response(JSON.stringify({ error: 'ERR downstream' }), { status: 500 });
      }
      return new Response(JSON.stringify({ result: 'PONG' }), { status: 200 });
    });
    setRedisFetchForTests(fetchMock);

    for (let i = 0; i < 4; i++) {
      const r = await executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
      expect(r.ok).toBe(false);
      expect(getRedisCircuitState()).toBe('CLOSED');
    }

    // 5th failure trips breaker OPEN
    const fifth = await executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
    expect(fifth.ok).toBe(false);
    expect(getRedisCircuitState()).toBe('OPEN');
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // During 60s cooldown, calls short-circuit immediately with 0 fetch invocations
    fakeNow += 30_000;
    const fastFail = await executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
    expect(fastFail.ok).toBe(false);
    expect(fastFail.skipped).toBe(true);
    expect(fastFail.circuitState).toBe('OPEN');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(getRedisTelemetrySnapshot().circuitShortCircuits).toBe(1);

    // Advance past cooldown -> single probe HALF_OPEN; verify concurrent call short-circuits while probe is in flight
    fakeNow += 35_000;
    let releaseProbe!: (val: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          releaseProbe = resolve;
        })
    );
    shouldFail = false;

    const probePromise = executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
    const concurrentDuringProbe = await executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
    expect(concurrentDuringProbe.skipped).toBe(true);
    expect(getRedisCircuitState()).toBe('HALF_OPEN');

    releaseProbe(new Response(JSON.stringify({ result: 'PONG' }), { status: 200 }));
    const probeRes = await probePromise;
    expect(probeRes.ok).toBe(true);
    expect(probeRes.value).toBe('PONG');
    expect(getRedisCircuitState()).toBe('CLOSED');

    // If a HALF_OPEN probe fails, breaker must re-open immediately
    shouldFail = true;
    for (let i = 0; i < 5; i++) {
      await executeRedisOp('ping', (c) => c.ping(), { now: () => fakeNow + i });
    }
    expect(getRedisCircuitState()).toBe('OPEN');
    fakeNow += 65_000;
    const failedProbe = await executeRedisOp('ping', (c) => c.ping(), { now: nowFn });
    expect(failedProbe.ok).toBe(false);
    expect(getRedisCircuitState()).toBe('OPEN');
  });
});
