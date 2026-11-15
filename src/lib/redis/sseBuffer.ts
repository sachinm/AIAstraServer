import { getRedisSseBufferMaxEvents, getRedisSseBufferTtlSeconds, isRedisEnabled } from '../../config/env.js';
import type { TurnEvent, TurnStatus } from '../../chat/chatTurnService.js';
import { executeRedisOp } from './client.js';

export interface RedisSseTurnMeta {
  id: string;
  userId: string;
  sessionId: string | null;
  status: TurnStatus;
  errorMessage?: string | null;
  createdAtMs: number;
}

export type RedisSseLookupResult =
  | { status: 'ok'; meta: RedisSseTurnMeta; events: TurnEvent[] }
  | { status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'unavailable' };

function turnMetaKey(turnId: string): string {
  return `sse:turn:${turnId}:meta`;
}

function turnEventsKey(turnId: string): string {
  return `sse:turn:${turnId}:events`;
}

function userSessionTurnKey(userId: string, sessionId: string): string {
  return `sse:session:${userId}:${sessionId}`;
}

function sessionLatestTurnKey(sessionId: string): string {
  return `sse:session_turn:${sessionId}`;
}

function parseJson<T>(raw: unknown): T | null {
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

/**
 * Persists chat turn metadata to Redis with a sliding 10-minute TTL (default).
 * Fail-open: silently ignores any Redis failure so chat turns continue uninterrupted.
 */
export async function writeTurnMetaToRedis(meta: RedisSseTurnMeta): Promise<void> {
  if (!isRedisEnabled()) return;
  const ttlSec = getRedisSseBufferTtlSeconds();

  await executeRedisOp(
    'sse:meta_set',
    async (redis) => {
      const p = redis.pipeline();
      p.set(turnMetaKey(meta.id), JSON.stringify(meta), { ex: ttlSec });
      p.expire(turnEventsKey(meta.id), ttlSec);
      if (meta.sessionId) {
        p.set(userSessionTurnKey(meta.userId, meta.sessionId), meta.id, { ex: ttlSec });
        p.set(sessionLatestTurnKey(meta.sessionId), meta.id, { ex: ttlSec });
      }
      return await p.exec();
    },
    { isWrite: true }
  );
}

/**
 * Appends a sequenced SSE event to Redis, caps the buffer to the latest N events,
 * and refreshes the 10-minute sliding TTL across meta, events, and session keys.
 * Fail-open on any Redis error or timeout.
 */
export async function appendTurnEventToRedis(params: {
  meta: RedisSseTurnMeta;
  event: TurnEvent;
}): Promise<void> {
  if (!isRedisEnabled()) return;
  const ttlSec = getRedisSseBufferTtlSeconds();
  const maxEvents = getRedisSseBufferMaxEvents();

  await executeRedisOp(
    'sse:event_push',
    async (redis) => {
      const p = redis.pipeline();
      p.rpush(turnEventsKey(params.meta.id), JSON.stringify(params.event));
      p.ltrim(turnEventsKey(params.meta.id), -maxEvents, -1);
      p.expire(turnEventsKey(params.meta.id), ttlSec);
      p.set(turnMetaKey(params.meta.id), JSON.stringify(params.meta), { ex: ttlSec });
      if (params.meta.sessionId) {
        p.set(userSessionTurnKey(params.meta.userId, params.meta.sessionId), params.meta.id, { ex: ttlSec });
        p.set(sessionLatestTurnKey(params.meta.sessionId), params.meta.id, { ex: ttlSec });
      }
      return await p.exec();
    },
    { isWrite: true }
  );
}

/**
 * Reads turn metadata and buffered events from Redis by `turnId` or `sessionId`.
 * Enforces owner check (`meta.userId !== userId` -> `'forbidden'`). Fail-open on outage (`'unavailable'`).
 */
export async function readTurnFromRedis(params: {
  turnId?: string;
  sessionId?: string;
  userId: string;
}): Promise<RedisSseLookupResult> {
  if (!isRedisEnabled()) {
    return { status: 'unavailable' };
  }

  let resolvedTurnId = params.turnId?.trim() || '';
  if (!resolvedTurnId && params.sessionId?.trim()) {
    const sid = params.sessionId.trim();
    const resolveRes = await executeRedisOp(
      'sse:resolve_session',
      async (redis) => {
        return await redis.mget<[unknown, unknown]>(
          userSessionTurnKey(params.userId, sid),
          sessionLatestTurnKey(sid)
        );
      },
      { kindOnNull: 'miss' }
    );

    if (!resolveRes.ok) {
      return { status: 'unavailable' };
    }
    const [scopedId, sharedId] = resolveRes.value ?? [null, null];
    const picked = typeof scopedId === 'string' && scopedId
      ? scopedId
      : typeof sharedId === 'string' && sharedId
        ? sharedId
        : '';
    if (!picked) {
      return { status: 'not_found' };
    }
    resolvedTurnId = picked;
  }

  if (!resolvedTurnId) {
    return { status: 'not_found' };
  }

  const readRes = await executeRedisOp(
    'sse:read_turn',
    async (redis) => {
      const p = redis.pipeline();
      p.get(turnMetaKey(resolvedTurnId));
      p.lrange(turnEventsKey(resolvedTurnId), 0, -1);
      return (await p.exec()) as [unknown, unknown[]];
    },
    { kindOnNull: 'miss' }
  );

  if (!readRes.ok || !Array.isArray(readRes.value)) {
    return { status: 'unavailable' };
  }

  const [metaRaw, eventsRaw] = readRes.value;
  const meta = parseJson<RedisSseTurnMeta>(metaRaw);
  if (!meta || !meta.id) {
    return { status: 'not_found' };
  }

  if (meta.userId !== params.userId) {
    return { status: 'forbidden' };
  }

  const rawList = Array.isArray(eventsRaw) ? eventsRaw : [];
  const events: TurnEvent[] = [];
  for (const item of rawList) {
    const parsed = parseJson<TurnEvent>(item);
    if (parsed && typeof parsed.seq === 'number') {
      events.push(parsed);
    }
  }
  events.sort((a, b) => a.seq - b.seq);

  return { status: 'ok', meta, events };
}
