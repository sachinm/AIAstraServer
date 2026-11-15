import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getRedisSessionTtlSeconds, isRedisEnabled } from '../../config/env.js';
import type { AuthRow } from '../../auth/requestAuth.js';
import { executeRedisOp } from './client.js';

export type SessionLookupOutcome =
  | { status: 'revoked' }
  | { status: 'hit'; row: AuthRow }
  | { status: 'miss' };

interface SerializedSessionRow {
  role: string | null;
  lockedAtMs: number | null;
  tokenVersion: number;
  lastSeenAtMs: number | null;
}

interface SerializedUserBlacklist {
  minTokenVersion: number;
  revokedAtMs: number;
}

interface SerializedOtpLock {
  lockedUntilMs: number;
}

function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function sessionKey(userId: string): string {
  return `sess:u:${userId}`;
}

function userBlacklistKey(userId: string): string {
  return `bl:u:${userId}`;
}

function tokenBlacklistKey(rawToken: string): string {
  return `bl:tok:${sha256Hex(rawToken)}`;
}

function otpLockKey(userId: string): string {
  return `otp:lock:${userId}`;
}

function parseRedisJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function computeRemainingJwtTtlSec(rawToken: string): number {
  const defaultTtl = getRedisSessionTtlSeconds();
  try {
    const decoded = jwt.decode(rawToken);
    if (decoded && typeof decoded === 'object' && typeof decoded.exp === 'number') {
      const remaining = Math.ceil(decoded.exp - Date.now() / 1000);
      return Math.max(60, Math.min(30 * 86_400, remaining));
    }
  } catch {
    // Fall back to configured session TTL on non-standard test tokens.
  }
  return defaultTtl;
}

/**
 * Checks per-token revocation, per-user revocation floor, and the short-lived session cache
 * in a single Redis round-trip. Always returns `'miss'` (prompting synchronous PostgreSQL
 * lookup) when Redis is disabled, misses, or is unavailable.
 */
export async function checkSessionRevocationAndCache(
  userId: string,
  rawToken: string,
  tokenVersion: number
): Promise<SessionLookupOutcome> {
  if (!isRedisEnabled()) {
    return { status: 'miss' };
  }

  const res = await executeRedisOp(
    'session:lookup',
    async (redis) => {
      return await redis.mget<[unknown, unknown, unknown]>(
        tokenBlacklistKey(rawToken),
        userBlacklistKey(userId),
        sessionKey(userId)
      );
    },
    { kindOnNull: 'miss' }
  );

  if (!res.ok || !Array.isArray(res.value)) {
    return { status: 'miss' };
  }

  const [tokBlRaw, userBlRaw, sessRaw] = res.value;

  if (tokBlRaw != null && tokBlRaw !== false && tokBlRaw !== '') {
    return { status: 'revoked' };
  }

  if (userBlRaw != null) {
    if (userBlRaw === '1' || userBlRaw === 1 || userBlRaw === true) {
      return { status: 'revoked' };
    }
    const userBl = parseRedisJson<SerializedUserBlacklist>(userBlRaw);
    if (userBl && typeof userBl.minTokenVersion === 'number' && tokenVersion < userBl.minTokenVersion) {
      return { status: 'revoked' };
    }
  }

  const cachedSess = parseRedisJson<SerializedSessionRow>(sessRaw);
  if (cachedSess && typeof cachedSess.tokenVersion === 'number') {
    if (cachedSess.tokenVersion > tokenVersion) {
      return { status: 'revoked' };
    }
    return {
      status: 'hit',
      row: {
        role: typeof cachedSess.role === 'string' ? cachedSess.role : null,
        locked_at: typeof cachedSess.lockedAtMs === 'number' ? new Date(cachedSess.lockedAtMs) : null,
        token_version: cachedSess.tokenVersion,
        last_seen_at: typeof cachedSess.lastSeenAtMs === 'number' ? new Date(cachedSess.lastSeenAtMs) : null,
      },
    };
  }

  return { status: 'miss' };
}

/**
 * Caches a PostgreSQL AuthRow in Redis with a 15-minute TTL (default). Best-effort; errors are ignored.
 */
export async function cacheAuthSessionInRedis(userId: string, row: AuthRow | null): Promise<void> {
  if (!isRedisEnabled()) return;
  if (!row) {
    await executeRedisOp('session:del', (redis) => redis.del(sessionKey(userId)), { isWrite: true });
    return;
  }

  const payload: SerializedSessionRow = {
    role: row.role,
    lockedAtMs: row.locked_at ? row.locked_at.getTime() : null,
    tokenVersion: row.token_version,
    lastSeenAtMs: row.last_seen_at ? row.last_seen_at.getTime() : null,
  };
  await executeRedisOp(
    'session:set',
    (redis) => redis.set(sessionKey(userId), JSON.stringify(payload), { ex: getRedisSessionTtlSeconds() }),
    { isWrite: true }
  );
}

/**
 * Drops a user's cached session entry from Redis (e.g., on role change, lock, or sign-out).
 */
export async function invalidateCachedSessionInRedis(userId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  await executeRedisOp('session:invalidate', (redis) => redis.del(sessionKey(userId)), { isWrite: true });
}

/**
 * Revokes an active user session immediately across all Lambdas:
 * deletes `sess:u:<userId>`, updates `bl:u:<userId>` to require `tv >= minTokenVersion`,
 * and records `bl:tok:<sha256(jwt)>` for the remaining JWT lifetime.
 */
export async function revokeUserSessionInRedis(params: {
  userId: string;
  rawToken?: string | null;
  minTokenVersion?: number | null;
}): Promise<void> {
  if (!isRedisEnabled()) return;

  const sessionTtl = getRedisSessionTtlSeconds();
  const minTv = typeof params.minTokenVersion === 'number' && Number.isFinite(params.minTokenVersion)
    ? params.minTokenVersion
    : Number.MAX_SAFE_INTEGER;
  const userBlPayload: SerializedUserBlacklist = {
    minTokenVersion: minTv,
    revokedAtMs: Date.now(),
  };

  await executeRedisOp(
    'session:revoke',
    async (redis) => {
      const p = redis.pipeline();
      p.del(sessionKey(params.userId));
      p.set(userBlacklistKey(params.userId), JSON.stringify(userBlPayload), { ex: sessionTtl });
      if (params.rawToken) {
        const tokTtl = computeRemainingJwtTtlSec(params.rawToken);
        p.set(tokenBlacklistKey(params.rawToken), '1', { ex: tokTtl });
      }
      return await p.exec();
    },
    { isWrite: true }
  );
}

/**
 * Stores an isolated OTP lockout entry (`otp:lock:<userId>`) that does NOT touch active JWT sessions (`sess:u:*` / `bl:*`).
 */
export async function setOtpLockInRedis(userId: string, lockedUntil: Date): Promise<void> {
  if (!isRedisEnabled()) return;
  const ttlSec = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
  const payload: SerializedOtpLock = { lockedUntilMs: lockedUntil.getTime() };
  await executeRedisOp(
    'otp_lock:set',
    (redis) => redis.set(otpLockKey(userId), JSON.stringify(payload), { ex: ttlSec }),
    { isWrite: true }
  );
}

/**
 * Checks whether an account's OTP challenge flow is currently locked in Redis.
 * Callers MUST also evaluate PostgreSQL `otp_locked_until` synchronously so lockouts fail closed on Redis outage.
 */
export async function isOtpLockedInRedis(userId: string, nowMs = Date.now()): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  const res = await executeRedisOp(
    'otp_lock:get',
    (redis) => redis.get<unknown>(otpLockKey(userId)),
    { kindOnNull: 'miss' }
  );
  if (!res.ok || res.value == null) return false;
  const parsed = parseRedisJson<SerializedOtpLock>(res.value);
  return Boolean(parsed && typeof parsed.lockedUntilMs === 'number' && parsed.lockedUntilMs > nowMs);
}

/**
 * Clears an isolated OTP lockout in Redis without touching JWT session caches.
 */
export async function clearOtpLockInRedis(userId: string): Promise<void> {
  if (!isRedisEnabled()) return;
  await executeRedisOp('otp_lock:del', (redis) => redis.del(otpLockKey(userId)), { isWrite: true });
}
