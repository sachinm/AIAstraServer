# 08 — App Performance Forecast, Security/RBAC Audit, Lazy JSON Section Streaming & Per-Request Page Execution Times Dashboard (M37)

## 1. Start

We audited `AIAstra_Server`, `AIAstra_WEB`, and `aiadastra_admin` end-to-end across six areas requested by Sachin:

### 1.1 Slow Queries & Redundant Client-Server Round-Trips
1. **`Query.me` (`src/graphql/schema.ts:480-540`)**:
   - Executes **6+ sequential database round-trips** on every session restore and profile refresh:
     1. `db.auth.findUnique`
     2. `db.kundli.findFirst` (fetched on line 509 and **never used**)
     3. `ensureUserGateReady(db, userId)` (`src/services/kundliQueueService.ts:59`), which re-runs `auth.findUnique` + `kundli.findFirst` selecting all 10 legacy JSON columns
     4. `getChartStatus(db, userId)` (`src/services/chartStatusService.ts:73`), which re-runs `auth.findUnique` + `kundli.findFirst` + `chartDataTypes.findMany` + `kundliData.findMany`
     5. `questionGate(db).getStatus(userId)`, which runs sequentially after `getChartStatus` instead of in parallel.
2. **`Query.meDetails` (`src/graphql/schema.ts:581-607`)**:
   - Executes an unused `db.kundli.findFirst` on line 594 prior to `ensureUserGateReady(db, userId)`.
3. **Redundant `fetchUserDetails()` Pre-flight Calls in `AIAstra_WEB` (`src/pages/UserData.ts:422-486`)**:
   - `fetchUserBiodata()` (`/dashboard/charts`) and `fetchUserContent()` (`/dashboard/mantras` and `/dashboard/remedies`) call `await fetchUserDetails()` (`Query.meDetails`) first, waiting a full network + Lambda + DB round-trip before calling `myBiodata` or `myContent` — even though `Query.myBiodata` (`schema.ts:628`) and `Query.myContent` (`schema.ts:683`) already validate user state on the server.
4. **Monolithic Dashboard Loading vs. Progressive Section Streaming**:
   - Multi-section views wait for full payloads rather than streaming independent JSON sections (`profile`, `chart_status`, `biodata`, `content`, `timeline`) as each resolves.

### 1.2 GraphQL Mutations & API Lambda ACL / RBAC / Account Isolation Audit
- **Verified Safe**:
  - `authenticateRequest` (`src/auth/requestAuth.ts:120`) verifies the JWT signature (`JWT_SECRET`) and checks the database `auth` row (`role`, `locked_at`, `token_version`) via a 30s per-instance cache (`forgetUser` evicts immediately on lock/role/logout). Roles are always read from the `auth` row (`canonicalRole(row.role)`), never trusted from the client JWT payload.
  - Self-service GraphQL queries (`me`, `meDetails`, `myBiodata`, `myContent`, `myKundliDisplayData`, `chats`, `activeChat`, `myTimeline`) and mutations (`completeProfile`, `updateProfile`, `retryChartBuild`, `uploadKundli`, `createChat`, `logout`) take **no `userId` argument** and scope all Prisma queries by `context.userId`.
  - Thread-scoped operations (`chatMessages`, `setChatPinned`, `setChatInactive`, `addMessage`) verify ownership via `db.chat.findFirst({ where: { id: chatId, user_id: userId } })` before reading or mutating.
  - Timeline & Ledger routes (`src/routes/timelineRoutes.ts`) validate `kundliId` ownership via `resolveKundli(prisma, userId, kundliId)` (`WHERE id = $kundliId AND user_id = $userId`).
  - Admin GraphQL operations (`adminListUsers`, `adminGetUser`, `adminGetUserChats`, `adminGetUserKundli`, `adminUpdateUser`, `adminRefreshUserKundli`, `referralStats`) require `withAdmin(context)` (`isAdminRole(context.role)`), and the dedicated Admin API (`aiadastra_admin/api`) uses separate staff accounts (`admin_accounts`) and `requireSuperadmin` for plan/role/research/email-reveal writes.
- **Gaps Identified & Fixed**:
  1. `POST /query` (`server.ts:330`) accepted `{ question, userID }` in `req.body` and silently ignored a mismatched `userID` instead of rejecting cross-account IDOR probing (`403 Forbidden` + recording an `idor_blocked` event in `account_events`).
  2. `src/graphql/rbac.ts` lacked a reusable `assertOwnAccount(authenticatedUserId, targetUserId)` guard for resolvers and REST handlers to explicitly reject and audit any cross-account parameter tampering.

### 1.3 Encryption & Plain-Text Caching Pen-Test Review
- **In-Transit & HTTP Caching**:
  - `noStoreMiddleware` (`src/lib/noStore.ts`) sets `Cache-Control: no-store` on every GraphQL, REST, and SSE response (`tests/unit/privacyWire.test.ts`). No proxy, CDN, or browser disk cache stores reading responses.
  - Browser `localStorage` (`AIAstra_WEB/src/lib/graphql.ts`, `readingUi.ts`) stores only `{ token, userId }` and boolean sidebar open/close flags — never plain-text readings, birth details, or chart JSON.
- **At-Rest Encryption (`src/lib/pii/fields.ts`)**:
  - **Gap Identified & Fixed**: Models added in M31–M36 — `ReadingFindingsCache` (`reading_findings_cache.payload`), `AreaBuild` (`area_builds.result`, `area_builds.error`), `PersonFact` (`person_facts.value`), and `TechniqueOutput` (`technique_outputs.output`) — were missing from `SEALED_MODELS` in `src/lib/pii/fields.ts`. Registering them in `SEALED_MODELS` ensures `piiExtension` (`src/lib/pii/prismaExtension.ts`) seals and opens these columns automatically under `PII_WRITE_MODE=sealed`.

### 1.4 Infrastructure Forecast: Redis ElastiCache vs. DynamoDB vs. PostgreSQL + In-Memory LRU
1. **Would Redis ElastiCache between PostgreSQL and Cognito help right now?**
   - **No (Not until >25 concurrent warm Lambdas or >500 req/s).**
   - Cognito is only called during sign-up/sign-in OTP initiation and verification (`src/services/authService.ts`), never on authenticated page requests.
   - Authenticated requests verify the JWT locally in `<0.2ms` and check `auth` (`role`, `locked_at`, `token_version`) via `requestAuth.ts`'s in-process Map cache (`30s` TTL, `5,000` users max), hitting PostgreSQL at most once every 30 seconds per active user per Lambda instance.
   - Placing ElastiCache Redis in front of RDS requires attaching the API Lambda to a VPC with Private Subnets + NAT Gateway (adding `$45–$120/mo` fixed cost and `300–800ms` ENI cold-start latency when scaling). Our two-tier caching architecture (in-process LRU + PostgreSQL `reading_findings_cache` and `technique_outputs` indexed by primary key) delivers `0ms` on warm hits and `3–8ms` on cross-Lambda DB hits without VPC cold-start penalties.
2. **Is DynamoDB required given the application?**
   - **Only for KMS Envelope Key Storage (Phase B3 of `docs/privacy/02`), NOT for application data.**
   - Astrological digests (`kundli_digest`), activation calendars (`kundli_activation` with PostgreSQL `GIN` `int[]` house indexes), and admin analytics (`PERCENTILE_CONT(0.95)`, window aggregations) rely heavily on relational SQL and JSONB. Moving user/chart state to DynamoDB would require expensive client-side joins and lose `GIN` array indexing.

### 1.5 Page Response Times Logging & Admin Dashboard Gap
- Previously, `AIAstra_Server` logged GraphQL durations only to `stdout` (`console.log('[GraphQL] completed')`), REST endpoints had no unified execution time store, `AIAstra_WEB` did not tag requests with `X-Astra-Page` or report browser render/draw timings, and `aiadastra_admin` had no dashboard to inspect page execution times on a per-request basis.

---

## 2. End Goal

1. **Per-Request & Per-Page Execution Time Logging (`page_execution_logs`)**:
   - Every GraphQL operation, REST API request, SSE stream, lazy section stream, and client-side page navigation/render/draw is logged to `page_execution_logs` with its canonical `page` (`/dashboard/chat`, `/dashboard/charts`, `/profile/timeline`, etc.), `source` (`graphql`, `server_request`, `sse_stream`, `client_render`, `section_stream`), `method`, `operation`, `status_code`, `duration_ms`, `ttfb_ms`, `server_ms`, `db_ms`, `render_ms`, `draw_ms`, `body_bytes`, `cache_status`, `user_id`, and sanitized `meta` (zero PII).
2. **Admin Module Page Response Times Dashboard (`/pages` in `aiadastra_admin`)**:
   - Staff can review aggregate latency (`p50`, `p95`, `p99`, `avg`, `max`, slow count `>=1000ms`, error rate, client render/draw vs. server execution) per page, view automated **Forecast & Bottleneck Diagnostics**, click any page to inspect per-operation breakdowns, and drill down into **every individual request to that page on a per-request basis** with filters (`page`, `source`, `minMs`, `errorsOnly`) and cursor pagination.
3. **Faster Page Loads & Progressive Section Streaming**:
   - `Query.me` and `Query.meDetails` drop redundant queries and parallelize independent lookups.
   - `fetchUserBiodata` and `fetchUserContent` in `AIAstra_WEB` eliminate the redundant pre-flight `fetchUserDetails` round-trip.
   - `GET /api/dashboard/sections-stream` streams dashboard sections (`profile`, `chart_status`, `biodata`, `content`, `timeline`) as NDJSON lines so the UI can draw each section progressively as soon as it resolves.
4. **Hardened RBAC & At-Rest Encryption Coverage**:
   - `assertOwnAccount` blocks and audits cross-account IDOR attempts (`403 Forbidden` + `idor_blocked` account event).
   - `ReadingFindingsCache`, `AreaBuild`, `PersonFact`, and `TechniqueOutput` are registered in `SEALED_MODELS` (`src/lib/pii/fields.ts`).

---

## 3. Deliverable

- **Database Migration (`M37`)**:
  - `prisma/migrations/20261106090000_page_execution_logs_m37/migration.sql` + `PageExecutionLog` in `prisma/schema.prisma`.
- **Server (`AIAstra_Server`)**:
  - `src/telemetry/pageTiming.ts`: Page path normalization, Express timing middleware, `POST /api/telemetry/page-timings`, and `GET /api/dashboard/sections-stream` (lazy NDJSON section streaming).
  - `src/config/env.ts`: `isPageTimingEnabled()`, `getPageSlowThresholdMs()`.
  - `src/graphql/schema.ts`: Parallelized `Query.me`, cleaned `Query.meDetails`.
  - `src/graphql/rbac.ts` & `server.ts`: `assertOwnAccount` IDOR guard + `POST /query` cross-account rejection + `X-Astra-Page` / `X-Astra-Session` CORS headers.
  - `src/lib/pii/fields.ts`: Added `ReadingFindingsCache`, `AreaBuild`, `PersonFact`, `TechniqueOutput` to `SEALED_MODELS`.
- **Web (`AIAstra_WEB`)**:
  - `src/lib/pageTelemetry.ts`: Client-side route render/draw timing tracker (`requestAnimationFrame` paint measurement), buffered beacon sender to `/api/telemetry/page-timings`, and `streamDashboardSections` NDJSON reader.
  - `src/lib/apiHeaders.ts`: Attaches `X-Astra-Page` and `X-Astra-Session` headers on outgoing requests.
  - `src/routes.tsx`: Mounts `<PageTimingTracker />` across all routes.
  - `src/pages/UserData.ts`: Removes redundant `fetchUserDetails()` pre-flight round-trip in `fetchUserBiodata()` and `fetchUserContent()`.
- **Admin (`aiadastra_admin`)**:
  - `api/src/contract.ts`: `AdminPageSummaryRow`, `AdminPageRequestRow`, `AdminPageOperationRow`, `AdminPageForecastAlert`, `AdminPagePerformanceOverview`, `AdminPageRequestsResponse`, `PageRequestsQuery`.
  - `api/src/admin/pagePerformance.ts`: `getPagePerformanceOverview` and `listPageRequests` (with `noPersonalFields.test.ts` compliance).
  - `api/src/app.ts`: `GET /api/admin/pages` and `GET /api/admin/pages/requests`.
  - `web/src/pages/PagePerformance.tsx`, `web/src/lib/adminApi.ts`, `web/src/App.tsx`, `web/src/components/Layout.tsx`: Full Admin dashboard for reviewing page response times and per-request execution logs.

---

## 4. Exactly How It Works When Done

### Backend
- **Server Request Instrumentation (`pageTimingMiddleware`)**:
  - Runs on every `/graphql`, `/api/*`, and `/query` request (excluding `/health` and `/api/telemetry/page-timings` to prevent self-amplification).
  - Captures `startedAt = Date.now()`, hooks first response chunk for `ttfb_ms`, sums `body_bytes`, resolves the canonical `page` from `X-Astra-Page` (falling back to deterministic route/operation mapping), extracts the GraphQL operation name (`Query.me`, `Query.myBiodata`, etc.), and writes a `page_execution_logs` row asynchronously on `res.on('finish')`.
- **Client Render & Draw Beacon (`POST /api/telemetry/page-timings`)**:
  - Accepts up to 25 timing entries per call (`page`, `source: 'client_render' | 'section_stream'`, `operation`, `durationMs`, `ttfbMs`, `renderMs`, `drawMs`, `cacheStatus`, `meta`).
  - Uses `optionalUser` so both guest pages (`/`, `/signin`, `/signup`, `/pricing`) and authenticated pages (`/dashboard/chat`, `/dashboard/charts`, `/profile/timeline`, etc.) are logged.
- **Lazy Section Streaming (`GET /api/dashboard/sections-stream`)**:
  - Accepts `?sections=profile,chart_status,biodata,content,timeline`.
  - Launches requested section loaders concurrently; as each promise resolves, writes an NDJSON line `{"section":"<name>","ok":true,"ms":<elapsed>,"data":...}\n` and flushes immediately.

### API
- `POST /api/telemetry/page-timings` (`AIAstra_Server`): `{ sessionId?: string, timings: Array<{ page: string, source?: string, operation?: string, durationMs: number, ttfbMs?: number, renderMs?: number, drawMs?: number, statusCode?: number, bodyBytes?: number, cacheStatus?: string, meta?: Record<string, scalar> }> }` → `204 No Content` | `400 Bad Request`.
- `GET /api/dashboard/sections-stream?sections=...` (`AIAstra_Server`): Authenticated NDJSON stream (`application/x-ndjson; charset=utf-8`, `Cache-Control: no-store`).
- `GET /api/admin/pages?window=24h|7d|30d` (`aiadastra_admin`): Returns `AdminPagePerformanceOverview` (global KPIs, per-page latency percentiles `p50/p95/p99`, server vs. client render/draw averages, forecast alerts, and slowest requests).
- `GET /api/admin/pages/requests?window=7d&page=/dashboard/chat&source=graphql&minMs=250&failedOnly=true&cursor=...&limit=50` (`aiadastra_admin`): Returns `AdminPageRequestsResponse` (per-operation breakdown for the selected page + paginated per-request execution log rows).

### Frontend Experience & UI/UX
- **Main Web (`AIAstra_WEB`)**:
  - `<PageTimingTracker />` observes route transitions and records `renderMs` (React commit) and `drawMs` (next painted frame via double `requestAnimationFrame`), flushing batches non-blockingly.
  - Every API/GraphQL request carries `X-Astra-Page: <pathname>` so backend execution times are attributed to the exact page the user is viewing.
- **Admin Web (`aiadastra_admin` → `Page times` `/pages`)**:
  - Top KPI tiles: Total Requests, Server / API Calls, Client Renders, Median (`p50`), Tail (`p95` / `p99`), Avg Render / Draw, Slow Requests (`>= 1s`), Errors.
  - Forecast & Capacity Alerts panel highlighting pages exceeding latency budgets or payload thresholds.
  - Interactive **By Page** table: clicking any row selects that page and loads its **Per-Operation Breakdown** and **Per-Request Execution Log** table below.

---

## 5. Architecture

```
Browser (AIAstra_WEB)
 ├── Route Change ──► PageTimingTracker (rAF renderMs + drawMs) ──► POST /api/telemetry/page-timings
 ├── API / GraphQL ─► buildApiHeaders (X-Astra-Page, X-Astra-Session)
 │                      │
 │                      ▼
 │              AIAstra_Server (pageTimingMiddleware)
 │                      ├── Measures duration_ms, ttfb_ms, body_bytes, status_code
 │                      └── Writes page_execution_logs (PostgreSQL)
 └── Progressive UI ◄── GET /api/dashboard/sections-stream (NDJSON per section)

Admin Panel (aiadastra_admin)
 └── /pages (PagePerformance.tsx)
        ├── GET /api/admin/pages?window=7d           ──► Per-page p50/p95/p99 + Forecast Alerts
        └── GET /api/admin/pages/requests?page=...   ──► Per-operation stats + Per-request log table
```

---

## 6. Ingredients

- **Migration**: `prisma/migrations/20261106090000_page_execution_logs_m37/migration.sql` (applied via `npx.cmd prisma migrate deploy`).
- **Env Vars**: `PAGE_TIMING_ENABLED` (default `1`), `PAGE_SLOW_THRESHOLD_MS` (default `1000`), `PAGE_TIMING_RETENTION_DAYS` (default `30`).
- **Retention Sweep**: `sweepPageExecutionLogs` (`src/telemetry/pageTiming.ts`) is wired into `runScheduledSweep` (`src/reading/llm/cacheSweep.ts`) to automatically prune `page_execution_logs` rows older than `PAGE_TIMING_RETENTION_DAYS`.

---

## 7. Action Steps in Sequence

1. **Step 1 (Schema & Migration)**: Add `PageExecutionLog` to `prisma/schema.prisma`, create migration `20261106090000_page_execution_logs_m37`, apply via `npx.cmd prisma migrate deploy` and `npx.cmd prisma generate`.
2. **Step 2 (Server Telemetry, Streaming, Performance & Security)**:
   - Implement `src/telemetry/pageTiming.ts` + env helpers in `src/config/env.ts` + wire in `server.ts`.
   - Optimize `Query.me` and `Query.meDetails` in `src/graphql/schema.ts`.
   - Add `assertOwnAccount` in `src/graphql/rbac.ts` and enforce IDOR check on `POST /query`.
   - Add `ReadingFindingsCache`, `AreaBuild`, `PersonFact`, and `TechniqueOutput` to `SEALED_MODELS` in `src/lib/pii/fields.ts`.
3. **Step 3 (Web Telemetry & Round-Trip Optimization)**:
   - Add `src/lib/pageTelemetry.ts`, update `src/lib/apiHeaders.ts` (`X-Astra-Page`), mount `<PageTimingTracker />` in `src/routes.tsx`, and remove redundant `fetchUserDetails()` pre-flights in `src/pages/UserData.ts`.
4. **Step 4 (Admin API & Web Dashboard)**:
   - Add contract types in `aiadastra_admin/api/src/contract.ts`, implement `aiadastra_admin/api/src/admin/pagePerformance.ts`, mount `/pages` and `/pages/requests` in `aiadastra_admin/api/src/app.ts`, and build `aiadastra_admin/web/src/pages/PagePerformance.tsx`.
5. **Step 5 (Verification)**: Run `tsc --noEmit` and unit tests across `AIAstra_Server`, `AIAstra_WEB`, and `aiadastra_admin`.

---

## 8. Development Phases

- **Phase 1**: Database schema (`M37`), server middleware, `/api/telemetry/page-timings`, `/api/dashboard/sections-stream`, RBAC/PII hardening, and `Query.me` optimization.
- **Phase 2**: Web client telemetry (`X-Astra-Page`, `<PageTimingTracker />`, NDJSON streaming helper, `UserData.ts` round-trip reduction).
- **Phase 3**: Admin API (`/api/admin/pages`, `/api/admin/pages/requests`) and Admin Web (`Page times` dashboard `/pages`) + unit test suites across all three repositories.

---

## 9. One Recommendation

Use PostgreSQL `page_execution_logs` with composite `(page, created_at DESC)` and `(created_at DESC)` indexes combined with in-process LRU + DB reader caches (`reading_findings_cache`, `technique_outputs`), rather than introducing Redis ElastiCache or DynamoDB for telemetry/session state.

| Option | Verdict | Why |
|---|---|---|
| **PostgreSQL `page_execution_logs` + In-Process LRU + DB Reader Cache (Recommended)** | **Chosen** | Zero extra AWS fixed cost, zero VPC cold-start penalty on Lambda, supports exact SQL `PERCENTILE_CONT(0.50/0.95/0.99)` and per-request cursor pagination directly in `aiadastra_admin`. |
| **Redis ElastiCache between Cognito & RDS** | Not now | Adds `$45–$120/mo` + VPC ENI cold-start delay (`300–800ms`); Cognito is only used at login, and `requestAuth.ts` already caches `auth` rows in memory for 30s. Revisit at `>25` concurrent Lambdas. |
| **DynamoDB for Application / Telemetry State** | Reject (except KMS DEK table in B3) | Cannot run relational joins or `PERCENTILE_CONT` aggregations for the Admin dashboard without scanning or exporting to Athena. |
