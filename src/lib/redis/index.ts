export {
  recordRedisSample,
  recordRedisShortCircuit,
  setRedisTelemetryCircuitState,
  getRedisTelemetrySnapshot,
  resetRedisTelemetryForTests,
  type RedisCircuitState,
  type RedisOpKind,
  type RedisTelemetrySnapshot,
} from './telemetry.js';

export {
  RedisTimeoutError,
  getRedisClient,
  getRedisCircuitState,
  executeRedisOp,
  setRedisFetchForTests,
  resetRedisClientForTests,
  type FetchLike,
  type RedisExecutionResult,
  type ExecuteRedisOpOptions,
} from './client.js';

export {
  RateLimitExceededError,
  checkRateLimit,
  hashRateLimitKey,
  resetRateLimiterForTests,
  type RateLimitScope,
  type RateLimitCheckResult,
} from './rateLimiter.js';

export {
  checkSessionRevocationAndCache,
  cacheAuthSessionInRedis,
  invalidateCachedSessionInRedis,
  revokeUserSessionInRedis,
  setOtpLockInRedis,
  isOtpLockedInRedis,
  clearOtpLockInRedis,
  type SessionLookupOutcome,
} from './sessionStore.js';

export {
  writeTurnMetaToRedis,
  appendTurnEventToRedis,
  readTurnFromRedis,
  type RedisSseTurnMeta,
  type RedisSseLookupResult,
} from './sseBuffer.js';
