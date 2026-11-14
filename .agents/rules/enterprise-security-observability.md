# Enterprise Security, Scale & Admin Error Reconciliation Rules

Always-on checklist for coding sessions and `/teamwork` swarms across `AIAstra_Server`, `AIAstra_WEB`, and `aiadastra_admin`. Grounded in OWASP ASVS 5.0 L2, OWASP API Top 10 (2023), OWASP GraphQL & CSP Cheat Sheets, and Google Web Vitals (`LCP <= 2.5s`, `INP <= 200ms`, `CLS <= 0.1`).

## 1. Fail-Closed Security Defaults

1. **Session & Lockout Verification (`src/auth/requestAuth.ts`)**: Never fall back to cached/JWT `{ locked: false }` when the database read fails. Return `{ userId: null, role: null, locked: false, reason: 'auth_unavailable' }` -> HTTP `503` / GraphQL `AUTH_UNAVAILABLE` (`503`).
2. **OTP Brute-Force Protection (`src/auth/emailCode.ts`)**: Enforce cross-Lambda lockout using database columns (`failed_otp_attempts`, `otp_locked_until`) configured via `OTP_MAX_FAILED_ATTEMPTS` (default `5`) and `OTP_LOCKOUT_MINUTES` (default `15`). Record `otp_locked` in `account_events` and `app_error_events`.
3. **Strict CORS (`server.ts`)**: Outside dev/local mode, empty `CORS_ORIGINS` must resolve to `origin: false` (never `origin: true`).
4. **Secret Transport**: Never pass Google/Gemini or third-party API keys in URL query parameters (`?key=`). Always send `x-goog-api-key` (or Authorization) headers so access logs, proxy histories, and stack traces never leak credentials.

## 2. Dual-Plane Error Handling (Consumer Masking <-> Admin Visibility)

Never expose raw Prisma errors, SQL strings, stack traces, file paths, or upstream HTML to consumer responses in staging/production, while ensuring Admin engineers see every failure across Web and Server:

1. **Consumer Plane (`src/graphql/armorAndMasking.ts`, `server.ts`)**:
   - Classify allowlisted domain errors explicitly before masking so client flows remain intact: `Not authenticated` -> `UNAUTHENTICATED`, `Forbidden*` -> `FORBIDDEN`, lockouts -> `ACCOUNT_LOCKED`, query armor -> `DEPTH_LIMIT_EXCEEDED` / `ALIAS_LIMIT_EXCEEDED`, input validation -> `BAD_USER_INPUT`, DB auth failure -> `AUTH_UNAVAILABLE`.
   - When `isGraphqlErrorMaskingEnabled()` is true, rewrite all unexpected/Prisma/internal errors to `"Something went wrong while processing your request."` with `extensions: { code: 'INTERNAL_SERVER_ERROR', requestId }`.
   - Every REST/GraphQL response carries `X-Request-Id`.
2. **Admin Observability Plane (`src/telemetry/appErrors.ts`, `app_error_events` M39)**:
   - Record every unmasked GraphQL execution/validation error, RBAC denial (`403` / `FORBIDDEN`), query-armor rejection, auth DB outage (`503`), uncaught REST `5xx`, Web JS runtime error (`window.onerror` / `unhandledrejection`), React `<GlobalErrorBoundary>` component crash, and browser `securitypolicyviolation` into `app_error_events`.
   - Scrub all messages and top-8 stack frames through `redactErrorText` / `redactStackPreview` (`src/lib/logRedact.ts`) before persistence — strip emails, JWT/Bearer tokens, `key=` secrets, birth dates/times, coordinates, and phone/numeric identifiers, and mask IP last octets.
   - Correlate `request_id` and `session_id` with `page_execution_logs` and `account_events` inside `aiadastra_admin` (`Usage > Errors` at `/errors` and `People > Security` at `/security`).

## 3. Audited Staff Access & Signed Admin-Server Bridge

1. **No Anonymous Static Shared Tokens on Admin APIs (`src/routes/adminLabRoutes.ts`, `aiadastra_admin/api/src/serverClient.ts`)**:
   - Authenticate `aiadastra_admin` -> `AIAstra_Server` using HMAC-SHA256 signatures over `timestamp + "\n" + method + "\n" + pathAndQuery + "\n" + sha256(body) + "\n" + actorId + "\n" + actorRole` with a `60s` replay window and actor role verification (`admin` | `superadmin`).
2. **Mandatory Audit Rows (`admin_actions`)**:
   - Every staff read of customer natal/chart data (`getChartData`) or lab person inspection must record an `admin_actions` row (`chart.inspect`, `lab.person_view`) attributing the staff `actorAdminId` and consent/reason context.

## 4. GraphQL Armor & Browser Headers

1. **Query Cost & Introspection Bounds (`src/config/env.ts`)**:
   - Enforce AST `GRAPHQL_MAX_DEPTH` (`6`), `GRAPHQL_MAX_ALIASES` (`15`), `GRAPHQL_MAX_SELECTIONS` (`250`), and disable introspection (`GRAPHQL_INTROSPECTION=false`) in production/staging unless explicitly enabled.
2. **Browser & API Headers**:
   - Web (`AIAstra_WEB/customHttp.yml`): `Content-Security-Policy` (restricting `script-src`, `connect-src`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
   - Server (`server.ts`): `helmet` + disabled `x-powered-by` + `Cache-Control: private, no-store, no-cache, must-revalidate` on `/api/*` and `/graphql`.

## 5. Scale & `/teamwork` Verification Gate

- Keep latency inside the declared 3-tier SLA: `<= 100ms` immediate client UI feedback, `<= 500ms` deterministic/cached DB reads, `<= 10s` interactive AI streaming deadline with pre-warmed prefix caches (`READING_EXPLICIT_CACHE=1`).
- `/teamwork` workers and challengers must verify: (1) zero PII leakage into logs/errors/Admin SQL (`noPersonalFields.test.ts`), (2) ASVS 5.0 L2 controls on changed endpoints, and (3) Admin error telemetry capture for every newly added error path before claiming victory.
