import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateRequest,
  forgetUser,
  resetRequestAuthForTests,
} from '../../../src/auth/requestAuth.js';
import {
  clearOtpLockInRedis,
  invalidateCachedSessionInRedis,
  isOtpLockedInRedis,
  resetRedisClientForTests,
  resetRedisTelemetryForTests,
  revokeUserSessionInRedis,
  setOtpLockInRedis,
  setRedisFetchForTests,
} from '../../../src/lib/redis/index.js';

const ORIGINAL_ENV = { ...process.env };
const TEST_SECRET = 'phase4-session-test-secret-0123456789abcdef';

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function createMemoryUpstashFetch() {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  function runCommand(cmd: unknown[]): unknown {
    const op = String(cmd[0] || '').toUpperCase();
    if (op === 'GET') {
      const k = String(cmd[1]);
      return store.get(k) ?? null;
    }
    if (op === 'MGET') {
      return cmd.slice(1).map((k) => store.get(String(k)) ?? null);
    }
    if (op === 'SET') {
      const k = String(cmd[1]);
      const v = typeof cmd[2] === 'string' ? cmd[2] : JSON.stringify(cmd[2]);
      store.set(k, v);
      for (let i = 3; i < cmd.length; i++) {
        if (String(cmd[i]).toUpperCase() === 'EX' && cmd[i + 1] != null) {
          ttls.set(k, Number(cmd[i + 1]));
        }
      }
      return 'OK';
    }
    if (op === 'DEL') {
      let deleted = 0;
      for (const k of cmd.slice(1)) {
        if (store.delete(String(k))) deleted++;
      }
      return deleted;
    }
    return null;
  }

  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '[]'));
    if (String(url).endsWith('/pipeline')) {
      const results = (body as unknown[][]).map((c) => ({ result: runCommand(c) }));
      return new Response(JSON.stringify(results), { status: 200 });
    }
    return new Response(JSON.stringify({ result: runCommand(body as unknown[]) }), { status: 200 });
  });

  return { store, ttls, fetchMock };
}

describe('Redis session store, logout blacklist, isolated OTP lock, and fail-closed auth', () => {
  beforeEach(() => {
    restoreEnv();
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
    process.env.REDIS_REST_URL = 'https://example.upstash.io';
    process.env.REDIS_REST_TOKEN = 'test-token';
    process.env.REDIS_SESSION_TTL_SECONDS = '900';
  });

  afterEach(() => {
    resetRequestAuthForTests();
    resetRedisClientForTests();
    resetRedisTelemetryForTests();
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('caches PG AuthRow in sess:u:<id> so subsequent cold-L1 auth requests skip PG', async () => {
    const { store, ttls, fetchMock } = createMemoryUpstashFetch();
    setRedisFetchForTests(fetchMock);

    const token = jwt.sign({ sub: 'user-cache-1', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });
    const readRow = vi.fn().mockResolvedValue({
      role: 'user',
      locked_at: null,
      token_version: 1,
      last_seen_at: new Date(),
    });

    const first = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(first.userId).toBe('user-cache-1');
    expect(first.locked).toBe(false);
    expect(readRow).toHaveBeenCalledTimes(1);

    // Wait for background cache write to complete
    await new Promise((r) => setTimeout(r, 15));
    expect(store.has('sess:u:user-cache-1')).toBe(true);
    expect(ttls.get('sess:u:user-cache-1')).toBe(900);

    // Simulate another Lambda instance (clear local L1 cache) -> must hit Redis sess:u and NOT call PG
    resetRequestAuthForTests();
    const second = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(second.userId).toBe('user-cache-1');
    expect(readRow).toHaveBeenCalledTimes(1);

    await invalidateCachedSessionInRedis('user-cache-1');
    expect(store.has('sess:u:user-cache-1')).toBe(false);
  });

  it('revokes logged-out JWT immediately (<5ms bl:tok/bl:u) without blocking fresh re-login tv', async () => {
    const { store, fetchMock } = createMemoryUpstashFetch();
    setRedisFetchForTests(fetchMock);

    const oldToken = jwt.sign({ sub: 'user-logout-1', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });
    const freshToken = jwt.sign({ sub: 'user-logout-1', tv: 2 }, TEST_SECRET, { expiresIn: '1h' });
    const readRow = vi.fn().mockResolvedValue({
      role: 'user',
      locked_at: null,
      token_version: 2,
      last_seen_at: new Date(),
    });

    // Simulate active L1 session first
    await authenticateRequest(
      { authorization: `Bearer ${oldToken}` },
      { secret: TEST_SECRET, readRow: vi.fn().mockResolvedValue({ role: 'user', locked_at: null, token_version: 1, last_seen_at: new Date() }) }
    );
    await new Promise((r) => setTimeout(r, 10));

    // Logout bumps tv to 2 and writes bl:u + bl:tok
    forgetUser('user-logout-1');
    await revokeUserSessionInRedis({
      userId: 'user-logout-1',
      rawToken: oldToken,
      minTokenVersion: 2,
    });
    expect(store.has('bl:u:user-logout-1')).toBe(true);
    expect([...store.keys()].some((k) => k.startsWith('bl:tok:'))).toBe(true);

    // Replaying oldToken must fail immediately via Redis without calling PG
    const replay = await authenticateRequest(
      { authorization: `Bearer ${oldToken}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(replay.userId).toBeNull();
    expect(replay.reason).toBe('revoked');
    expect(readRow).not.toHaveBeenCalled();

    // Fresh re-login JWT with tv=2 must pass cleanly
    const relogin = await authenticateRequest(
      { authorization: `Bearer ${freshToken}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(relogin.userId).toBe('user-logout-1');
    expect(relogin.locked).toBe(false);
    expect(readRow).toHaveBeenCalledTimes(1);
  });

  it('keeps otp:lock isolated so OTP brute-force lockout never revokes an active JWT session', async () => {
    const { store, fetchMock } = createMemoryUpstashFetch();
    setRedisFetchForTests(fetchMock);

    const activeToken = jwt.sign({ sub: 'victim-1', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });
    const readRow = vi.fn().mockResolvedValue({
      role: 'user',
      locked_at: null,
      token_version: 1,
      last_seen_at: new Date(),
    });

    const beforeLock = await authenticateRequest(
      { authorization: `Bearer ${activeToken}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(beforeLock.userId).toBe('victim-1');

    // Attacker triggers OTP lockout -> writes otp:lock:victim-1 ONLY
    await setOtpLockInRedis('victim-1', new Date(Date.now() + 15 * 60_000));
    expect(store.has('otp:lock:victim-1')).toBe(true);
    expect(await isOtpLockedInRedis('victim-1')).toBe(true);

    // Victim's active JWT session MUST remain unaffected
    resetRequestAuthForTests();
    const duringOtpLock = await authenticateRequest(
      { authorization: `Bearer ${activeToken}` },
      { secret: TEST_SECRET, readRow }
    );
    expect(duringOtpLock.userId).toBe('victim-1');
    expect(duringOtpLock.locked).toBe(false);

    await clearOtpLockInRedis('victim-1');
    expect(await isOtpLockedInRedis('victim-1')).toBe(false);
  });

  it('fails closed synchronously via PG and returns auth_unavailable when both Redis and PG fail', async () => {
    setRedisFetchForTests(async () => new Response(JSON.stringify({ error: 'ERR' }), { status: 500 }));
    const token = jwt.sign({ sub: 'user-fc-1', tv: 1 }, TEST_SECRET, { expiresIn: '1h' });

    // Redis down, PG healthy -> synchronous PG fallback succeeds
    const pgRow = vi.fn().mockResolvedValue({
      role: 'admin',
      locked_at: null,
      token_version: 1,
      last_seen_at: new Date(),
    });
    const pgOk = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      { secret: TEST_SECRET, readRow: pgRow }
    );
    expect(pgOk.userId).toBe('user-fc-1');
    expect(pgOk.role).toBe('aiastra_admin');

    // Redis down AND PG down -> MUST fail closed with auth_unavailable (503)
    resetRequestAuthForTests();
    const pgDown = await authenticateRequest(
      { authorization: `Bearer ${token}` },
      {
        secret: TEST_SECRET,
        readRow: vi.fn().mockRejectedValue(new Error('PG connection refused')),
      }
    );
    expect(pgDown.userId).toBeNull();
    expect(pgDown.reason).toBe('auth_unavailable');
  });
});
