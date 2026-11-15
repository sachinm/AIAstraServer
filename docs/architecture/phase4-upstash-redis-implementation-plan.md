# Phase 4 Implementation Plan: Upstash Serverless Redis & Chat CWV Polish

> **Status**: Executing (Phase 4 Milestones 4.1–4.5 + Roadmap 4.2 Web CWV Polish)  
> **Architecture Basis**: [`docs/architecture/redis-evaluation.md`](./redis-evaluation.md) and [`docs/roadmap/enterprise-remediation-roadmap.md`](../roadmap/enterprise-remediation-roadmap.md)

## 1. Start

- **Runtime Topology**: `aiastra-server-api` runs as an AWS Lambda Web Adapter HTTP service behind CloudFront (`https://api.vedic-astrology.app`), backed by Render PostgreSQL over PgBouncer (`:6432`) transaction pooling and `AIAstra_WEB` on AWS Amplify (`https://vedic-astrology.app`).
- **Existing Gaps**:
  - **Rate Limiting (`server.ts`, `src/auth/emailCode.ts`)**: Currently uses per-Lambda in-memory `express-rate-limit` counters and database checks. Under bursts across ephemeral Lambda instances, OTP and GraphQL limits split per container instead of enforcing globally.
  - **Session & Lockout Enforcement (`src/auth/requestAuth.ts`)**: Uses a local 30s `Map` cache per Lambda (`CACHE_TTL_MS = 30_000`) plus PostgreSQL `auth` reads (`locked_at`, `token_version`). Cross-instance logout or 5-strike OTP lockouts rely on waiting up to 30s unless backed by a shared invalidation store.
  - **Resumable SSE Streaming (`src/chat/chatTurnService.ts`, `src/chat/chatRoutes.ts`)**: Stores live `ActiveTurn` buffers in memory and throttled checkpoints in `chat_turns` (`M53`). A client reconnecting to a *different* warm Lambda container mid-turn benefits from a low-latency distributed 10-minute SSE buffer lookup by `turnId` or `sessionId`.
  - **Frontend Chat Rendering (`ChatSection.tsx`)**: Calls `setMessages(...)` on every streamed SSE token delta (~50+ updates/sec on fast responses), increasing main-thread React reconciliation work and degrading INP.

## 2. End Goal

- Sub-15ms cross-Lambda coordination via **Upstash Serverless Redis** (`@upstash/redis` + `@upstash/ratelimit`) over stateless HTTPS REST (zero VPC/NAT/TCP socket exhaustion).
- Strict **fail-open / fail-closed policy matrix** enforced and chaos-verified under 100% packet drop:
  - Fail-open: distributed rate limiting (recording rate-deduped `rate_limit_redis_unavailable` to `app_error_events`) and resumable SSE chat buffering (falling back to PostgreSQL `chat_turns` + in-memory `ActiveTurn`).
  - Fail-closed: JWT session validation & blacklist/lockout enforcement (falling back synchronously to Render PostgreSQL; returning `503 auth_unavailable` / `AUTH_UNAVAILABLE` if both Redis and PostgreSQL fail).
- `150ms` strict per-operation client timeout (`REDIS_TIMEOUT_MS=150`) and 5-failure/30s -> 60s `CIRCUIT_OPEN` in-memory circuit breaker preventing cascade stalls.
- Redis latency (`P50`/`P95`/`P99`) and cache hit/miss telemetry persisted in `page_execution_logs` (`cache_status`, `meta`).
- Smooth Web chat rendering (`<= 20 FPS` via `requestAnimationFrame` / `50ms` token batching + optimistic toggle/prompt responsiveness, keeping `< 50ms` INP target).
- Safe zero-config default: `isRedisEnabled()` returns `false` until `REDIS_ENABLED=1`, `REDIS_REST_URL`, and `REDIS_REST_TOKEN` are provisioned, ensuring zero regressions on staging before Upstash credentials are configured.

## 3. Deliverable

- **API Server (`AIAstra_Server`)**:
  - Dependencies: `@upstash/redis`, `@upstash/ratelimit` in `package.json`.
  - Config (`src/config/env.ts`): `isRedisEnabled`, `getRedisRestUrl`, `getRedisRestToken`, `getRedisTimeoutMs` (`150`), circuit-breaker thresholds, session/SSE TTLs, and OTP/GraphQL/Chart/Gemini rate-limit windows.
  - Modules (`src/lib/redis/*`): `client.ts`, `telemetry.ts`, `rateLimiter.ts`, `sessionStore.ts`, `sseBuffer.ts`, `index.ts`.
  - Integrations: `server.ts`, `src/auth/requestAuth.ts`, `src/auth/emailCode.ts`, `src/graphql/schema.ts`, `src/services/chatLlmService.ts`, `src/chat/chatTurnService.ts`, `src/chat/chatRoutes.ts`, `src/telemetry/pageTiming.ts`.
  - Tests: `tests/unit/redis/{client,rateLimiter,sessionStore,sseBuffer,chaos}.test.ts` and `tests/e2e/phase4RedisAndCwv.e2e.test.ts`.
- **Web Client (`AIAstra_WEB`)**:
  - `src/pages/chat-interface/tokenFlusher.ts` + `ChatSection.tsx` (`50ms` `rAF` SSE delta batching with synchronous flush on completion/error/unmount).
  - `src/pages/chat-interface/ChatMainArea.tsx` (optimistic send/feedback polish) + tests.

## 4. How It Works When Done

- **Backend**:
  - Every Upstash HTTP command runs inside `executeRedisCommand()` with `retry: false`, `AbortSignal.timeout(REDIS_TIMEOUT_MS)` (`150ms`), and a 3-state circuit breaker (`CLOSED`, `OPEN` for `60s` after `5` consecutive failures within `30s`, `HALF_OPEN` probe).
  - Rate limiters use SHA-256 hashed keys (`rl:<scope>:<hash>`, zero PII), `Ratelimit.slidingWindow` for `otp_send` (`5 / 600s`), `graphql` (`200 / 60s` prod, `2000 / 60s` dev), `chart_calc` (`20 / 60s`), and `Ratelimit.tokenBucket` for `gemini_api` (`60 / 60s`), all fail-open with `app_error_events` logging throttled to at most 1 row per 60s per scope.
  - Auth caches active user rows (`sess:u:<userId>`, `900s` TTL) and checks revocations (`bl:tok:<sha256>`, `bl:u:<userId>`) before hitting PostgreSQL; misses/errors fall back synchronously to PostgreSQL, and dual failure returns `503 auth_unavailable`.
  - Chat SSE events mirror via fail-open bounded calls to `sse:turn:<turnId>:events`, `sse:turn:<turnId>:meta`, and `sse:sess:<userId>:<sessionId>:latest` with sliding `600s` (`10m`) expiration.
- **API**:
  - `GET /api/chat/resume-stream` accepts both `?sessionId=<id>&afterSeq=<n>` and `?turnId=<id>&lastSeq=<n>` (or `Last-Event-ID`), enforces `userId` ownership (`403` on cross-user access), and replays missed SSE frames across Lambda containers.
  - Blocked GraphQL/OTP/chart requests return `429` with `RateLimit-*` / `Retry-After` headers.
- **Frontend Experience**:
  - Chat renders incoming SSE tokens at `<= 20 FPS` (`50ms` / `rAF` coalescing) without blocking typing or scrolling, while showing immediate optimistic prompt and UI state feedback.
- **UI/UX**:
  - Streamed answers appear smooth without layout thrash; reconnects resume seamlessly from `afterSeq`; when Redis degrades, rate-limited endpoints and chat streams continue working transparently while auth stays fail-closed.

## 5. Architecture

- **Execution Boundaries**: AWS Lambda (`aiastra-server-api`) <-> Upstash Serverless Redis over HTTPS REST (`150ms` budget) <-> Render PostgreSQL (`:6432`, durable fallback & truth for `auth`, `chat_turns`, `app_error_events`, `page_execution_logs`).
- **Failure Isolation**: No external network hiccup can stall a Lambda request beyond `150ms` * 5 strikes (`750ms` worst-case burst), after which the 60s circuit breaker sheds Redis I/O in `0ms`. No PII leaves encrypted Postgres tables into Redis keys.

## 6. Ingredients

- **Libraries**: `@upstash/redis`, `@upstash/ratelimit` (`AIAstra_Server`), native `requestAnimationFrame` + `setTimeout` (`AIAstra_WEB`).
- **Environment Variables (`src/config/env.ts`)**: `REDIS_ENABLED`, `REDIS_REST_URL`, `REDIS_REST_TOKEN`, `REDIS_TIMEOUT_MS`, `REDIS_CIRCUIT_FAILURE_THRESHOLD`, `REDIS_CIRCUIT_WINDOW_MS`, `REDIS_CIRCUIT_OPEN_MS`, `REDIS_SESSION_TTL_SEC`, `REDIS_SSE_BUFFER_TTL_SEC`, `REDIS_SSE_BUFFER_MAX_EVENTS`, `RATE_LIMIT_OTP_MAX`, `RATE_LIMIT_OTP_WINDOW_SEC`, `RATE_LIMIT_GRAPHQL_MAX`, `RATE_LIMIT_GRAPHQL_WINDOW_SEC`, `RATE_LIMIT_CHART_MAX`, `RATE_LIMIT_CHART_WINDOW_SEC`, `RATE_LIMIT_GEMINI_MAX`, `RATE_LIMIT_GEMINI_WINDOW_SEC`.
- **Database Tables (Existing — No Risky DDL Required)**: `auth`, `chat_turns` (`M53`), `app_error_events` (`M52`), `page_execution_logs` (`cache_status`, `meta`).
- **Owner**: Execution agents (code + tests on `develop`); Sachin / Deploy session (creating the Upstash Serverless endpoint and setting `REDIS_ENABLED=1`, `REDIS_REST_URL`, `REDIS_REST_TOKEN` on Lambda `aiastra-server-api` when ready).

## 7. Action Steps in Sequence

1. **Milestone 4.1**: Install SDKs in isolated worktree (`feat/phase4-upstash-redis`); add env helpers, `src/lib/redis/telemetry.ts`, and `src/lib/redis/client.ts` with timeout + circuit breaker.
2. **Milestone 4.2**: Build `src/lib/redis/rateLimiter.ts`; wire GraphQL, OTP, user chart calculation routes, and LLM quota paths with fail-open `app_error_events` telemetry.
3. **Milestone 4.3**: Build `src/lib/redis/sessionStore.ts`; wire `authenticateRequest`, `Mutation.logout`, and 5-strike OTP lockout while preserving synchronous PostgreSQL fallback and `503 auth_unavailable`.
4. **Milestone 4.4**: Build `src/lib/redis/sseBuffer.ts`; wire `ChatTurnService` and `GET /api/chat/resume-stream` for `turnId` and `sessionId` cross-Lambda replay with `403` ownership check.
5. **Milestone 4.5 + Web CWV**: Upgrade `src/telemetry/pageTiming.ts` with `cacheMisses`, `cacheMs`, `cache_status`, and Redis `P50`/`P95`/`P99`; implement Web `50ms` `rAF` SSE token coalescing + optimistic polish; write full unit, 100%-packet-drop chaos, and E2E suites.

## 8. Development Phases

- **Checkpoint 1**: Milestones `4.1–4.5` passing `tsc --noEmit` and `tests/unit/redis/*` (including chaos suite) with `REDIS_ENABLED` unset by default and mocked Upstash REST + network failure injection.
- **Checkpoint 2**: `AIAstra_WEB` `tsc --noEmit -p tsconfig.app.json`, `prerender.test.ts`, and all chat unit tests green alongside cross-repo `tests/e2e`, merged `--no-ff` to local `develop`.
- **Activation (Deferred to Live Secret Config)**: Provision Upstash Serverless database (`us-east-1`), configure `REDIS_ENABLED=1`, `REDIS_REST_URL`, `REDIS_REST_TOKEN` on `aiastra-server-api`, and promote to `release-candidate-staging`.

## 9. One Recommendation

**Use Upstash Serverless Redis over stateless HTTPS REST (`@upstash/redis` + `@upstash/ratelimit`) with a `150ms` abort budget, 5-strike/60s circuit breaker, and env-gated activation (`REDIS_ENABLED`)** rather than ElastiCache VPC or Render TCP Redis, eliminating Lambda VPC cold starts, NAT egress costs (\$32+/mo), and half-closed socket exhaustion while guaranteeing zero disruption when Redis is degraded or unconfigured.

| Alternative | Verdict | Reason |
|---|---|---|
| **Upstash Serverless REST (`150ms` + Circuit Breaker)** | **Chosen** | Zero VPC/NAT overhead, stateless HTTP connection reuse, \$0–\$15/mo dev/staging |
| AWS ElastiCache (VPC) | Rejected | Requires Lambda VPC ENIs + NAT Gateway (\$32+/mo base + fixed node cost) |
| Render Managed Redis (TCP) | Rejected | Cross-cloud latency + ephemeral Lambda TCP connection accumulation |
