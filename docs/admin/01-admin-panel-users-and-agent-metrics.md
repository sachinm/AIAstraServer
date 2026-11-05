# 01 — Admin panel: users, plans, quotas, lock-out, and agent speed and cost per query

Status: plan only, written 2026-11-04 for the Opus build session. No code, migration or AWS resource has changed. Written to
"How a plan is written" in `AGENTS.md`. Every fact in section 1 was read from the code on 2026-11-04; nothing was assumed.
Live rows were not read. The companion plan is `docs/privacy/02-birth-data-charts-and-wire-build-plan.md`; section 9 says
which goes first and what this plan must do so the other does not break it.

**Revision 2026-11-04 (Sachin): the admin is a separate app.** It lives in its own private repo `sachinm/aiadastra_admin`
(folder `C:\Users\Owner\Documents\work\aiadastra_admin`), on its own Lambda `aiadastra-admin-api` and its own site
`admin.vedic-astrology.app`, against the same database. What changes from the text below:

| Below | Now |
|---|---|
| Phases A2–A4 in this repo (GraphQL admin ops, `/admin/*` routes in `AIAstra_WEB`) | Built in `aiadastra_admin`: REST under `/api/admin/*` (`api/`, Express + `pg`), and a separate Vite SPA (`web/`). Contract: `aiadastra_admin/api/src/contract.ts`; architecture: `aiadastra_admin/docs/01-architecture-and-api.md` |
| Phase A1 and the M24 labels | Unchanged, in this repo, branch `feat/admin-a1-lockout`: only the main API can refuse a locked person |
| Migrations M23, M24 | Unchanged, in this repo. The admin repo never migrates. `admin_actions` gains `actor_kind` (`admin`, `cli`, `system`) and a nullable actor, so CLI and system writes are recorded too |
| `adminSetRole` bumps `token_version` | It does not: roles are read from the row on every request after A1, so the change applies at once without signing the person out |
| Sign-in for admins | The admin site calls this API's `requestMagicLink` / `loginWithMagicLink` (Turnstile, emailed code) and sends the JWT to the admin API, which re-checks role, lock and token version from the row. Needs `https://admin.vedic-astrology.app` in `CORS_ORIGINS` and on the Turnstile widget's hostnames |
| Retention route and EventBridge rule | Still this repo's phase A5; not built yet |
| Admins are `auth` rows with `aiastra_admin`, signing in with the emailed code | **Staff accounts in their own table `admin_accounts` (M25)**: `adastra-admin` (admin) and `adastra-superadmin` (superadmin), password sign-in on the admin API. Passwords are 64 random characters, only in Secrets Manager `aiadastra/admin/<username>`; the table holds scrypt hashes. Created 2026-11-04. `ADMIN_EMAILS` / `aiastra_admin` now only exempt staff customer accounts from the quota |

**Scope asked for.** Sachin asked for an admin panel that (a) manages users: find them, lock them out, reset their question
quota, review and change their plan; and (b) shows, per query, how fast the agents worked and what each sub-agent cost in
tokens, with averages by agent type and by technique. Not in scope now: reading what people asked, or their answers.

## 1. Start: the system today

### 1.1 Users, roles, admin API

| Fact | Where |
|---|---|
| Users are rows of `auth`. Columns that matter here: `id`, `email`, `username`, `name`, `role` (default `"user"`), `is_active` (default true), `created_at`, `email_verified_at`, `profile_complete`, `research`, `language`. | `prisma/schema.prisma:11-62` |
| There is no locked, locked-at, token-version or disabled-at column. | same |
| The role list is `novice`, `public`, `student`, `astrologer`, `researcher`, `client_account_admin`, `aiastra_admin`; `admin`, `superadmin`, `support` map to `aiastra_admin`. `isAiAstraAdmin()` exists and nothing calls it. | `src/auth/roles.ts:15-27,55` |
| New sign-ups get `novice`. | `src/services/authService.ts:217,306` |
| GraphQL already has an admin namespace: `adminListUsers`, `adminGetUser`, `adminGetUserChats`, `adminGetUserKundli`, `referralStats`, `adminUpdateUser`, `adminRefreshUserKundli`, behind `withAdmin`, which checks `ADMIN_ROLES = ['admin','superadmin','aiastra_admin']` against the **JWT** role and returns `{success:false}` instead of throwing. | `src/graphql/schema.ts:39,259-353,421-450,864-1073,1375-1412` |
| `adminService` only manages `MANAGED_ROLES = ['astrology_student','astrologer']`, so no `novice` user can be listed or edited through it. `adminUpdateUser` ignores the `{success:false}` from `updateUser` and reports success. | `src/services/adminService.ts:4,25-26,106-110`; `schema.ts:1386` |
| `adminGetUser` returns birth fields undecrypted; `adminGetUserKundli` returns the whole chart. | `schema.ts:897,1010`; filed in `docs/TODOS.md` (P2, 2026-11-01) |
| Superadmin bootstrap upserts a row with `role: 'superadmin'` only when `SUPERADMIN_PASSWORD` has 16+ characters. There is no password sign-in any more (sign-in is by emailed code), so the password is dead weight; the row can sign in only if `SUPERADMIN_EMAIL` receives mail. The `SUPERADMIN_*` variables are not on the Lambda. | `src/ensureSuperadmin.ts:12-70`; `server.ts:405`; `docs/TODOS.md:191` |
| REST routes have no role guard at all; `getUserIdFromRequest` returns only the id. | `server.ts:165-182` |
| The web app has no admin page, does not store or request `role`, and `ME_QUERY` does not ask for it. | `AIAstra_WEB/src/lib/graphql.ts:188-192`, `src/Auth/api.ts:221-232` |

### 1.2 Authentication and why nobody can be locked out today

| Fact | Where |
|---|---|
| The server issues its own JWT `{ sub, role }`, 7 days, after the emailed code is accepted, for both `AUTH_PROVIDER=local` and `cognito`. Cognito tokens are discarded. | `authService.ts:73-76,128-159`; `src/auth/emailCode.ts:28-34` |
| GraphQL context and REST both read the JWT only. No request reads the `auth` row. A role change takes effect at the next sign-in; a token cannot be revoked. | `src/graphql/context.ts:32-55`; `server.ts:165-182` |
| `is_active` is read only by `myBiodata`, one other resolver and the chart-sync sweeps. Sign-in, `ask`, `/api/chat/ask-stream`, `/api/chat/confirm-stream`, billing and timeline never read it. | `schema.ts:607,713`; `src/services/kundliSyncWorker.ts:244,268`; `src/services/askChatTurn.ts:51-72` |
| No `Admin*` Cognito call exists (no `AdminDisableUser`, no `RevokeToken`); the Lambda role has no `cognito-idp` permission by design. | `src/auth/cognitoClient.ts:7,23-30` |

Symptom for Sachin: a user who abuses the service cannot be stopped short of deleting their row, and a stolen token works for 7 days.

### 1.3 Plans and quota

| Fact | Where |
|---|---|
| Plans `free`, `plus`, `unlimited`; quotas only from `PLAN_FREE_QUESTIONS` and `PLAN_PLUS_QUESTIONS`; everything behind `PLANS_ENABLED`. | `src/billing/plans.ts:3,51-73` |
| `billing_accounts` (one row per user): `desired_*`, `is_paid`, `paid_plan`, `paid_interval`, `paid_since`, `paid_until`, `payment_ref`, `billing_country`, `question_quota` (null = unlimited), `questions_used_this_month`, `usage_month_start`. `question_usage`: one row per charged question, `reserved`, `committed` or `released`. | `schema.prisma:638-681` |
| Effective plan: paid if `is_paid` and `paid_plan` set and `paid_until` empty or future, else free. | `plans.ts:82-86` |
| The only writers of `is_paid` are `markPaid` and `clearPaid`; the only caller is the CLI `scripts/billing-set-paid.ts` (`--plan`, `--clear`, `--quota N|none`, `--research`). `store.setQuota` exists. No API resets `questions_used_this_month`. | `src/billing/account.ts:20-45`; `src/billing/store.ts:94-111` |
| Reset is lazy: the counter restarts on the first question of a new period (`monthFor`). | `plans.ts:100-109`; `store.ts:98-111` |
| Gate: `check` before any model call; `reserve` inserts a `question_usage` row and increments under `WHERE used < quota`; `commit`/`release`; reservations older than 10 minutes are released on the next request; a database error lets the question through. | `src/billing/questionGate.ts:121-207` |
| Exempt roles are raw strings `['support','admin','superadmin','aiastra_admin','astrologer']`, read from the database row, so `researcher` and `client_account_admin` are not exempt and the list is not `roles.ts`. | `plans.ts:41`; `store.ts:72-75` |
| Client sees 402 `{code:'quota_exhausted', usage}` or SSE `{type:'error', code:'quota_exhausted'}`; the web maps both to `QuotaExhaustedError` and shows `UpgradeCard`. Web `PlanStatus.window` allows only `'month'|'none'` but the server can send `'day'`. | `questionGate.ts:227-229`; `AIAstra_WEB/src/pages/UserData.ts:95,276-279`; `src/lib/billing.ts:13-27` |

### 1.4 Agent metrics: what is recorded per query

The recorder from `docs/reading-engine/41-agent-metrics.md` phase 1 is built and deployed; **no real row has been written yet**
(doc 41 §1, §8). It records, with `READING_METRICS=0` as the off switch:

| Table | One row per | Carries | Writer |
|---|---|---|---|
| `reading_traces` | request (`kind`: reading, clarify, prewarm) | `flow`, `status` (`processing` → `done`/`failed`/`unavailable`), `agents_spawned`, `agents_failed`, `model_calls`, 4 token counts, `est_cost_usd`, `unpriced_calls`, `ttft_ms`, `ms`, `error`, `started_at`, `ended_at`, `question`, `clarify_run_id` | `RunTrace` in `src/reading/metrics/trace.ts:119-268`; wired at `src/reading/run.ts:226-239`, `src/routes/clarifyRoutes.ts:85-137` |
| `reading_agent_spans` | agent stage or model call | `agent`, `agent_kind` (reader, specialist, oracle, validator, intake, clarify, step), `level` (stage, model_call), `model`, `status` (ok, cached, failed, skipped, unfinished), `failure_reason`, `ms`, `ttft_ms`, `steps {wait_ms, read_ms}`, 4 token counts, `est_cost_usd` (null when unpriced) | stage events through `observe` (`trace.ts:222`), model calls through `traceModelCall` (`trace.ts:302`) from `llm/gemini.ts:257,292` and `llm/bedrock.ts:70` |

What is **missing** for the dashboard Sachin asked for:

- **No technique label on a trace.** The labels the engine already computes are stored elsewhere or nowhere: `flow` (`single`, `graph`, `oracle`, `safety`; `run.ts:278-319`) is on the trace; `bucket` (15 ids, `src/reading/buckets/taxonomy.ts:14-30`) and `template` (T1–T10, `:36`) sit in `reading_runs.intent.classification`; `tier` (1–5, `src/reading/oracle/readers.ts:118-132`) sits in `reading_runs.cache` and `reading_agent_responses.tier`; the plan-B `route` (`pressure`, `mood`, `luck`, `will_it_happen`; `src/reading/oracle/planB.ts:9`) is not persisted; the number of subjects is not persisted.
- **Spans drop the subject.** The trace keys open stages by `name|subject` (`trace.ts:224`) but the stored row has no `subject` column, so a three-subject graph run writes three `dasha` rows that cannot be told apart.
- **No read API and no UI.** Doc 41 phases 2–4 (`adminReadingTraces`, `adminReadingTrace`, `adminAgentStats`, the pages, retention, alarms) are not built.
- **Not traced:** the legacy `geminiChatService.ts`/`groqChatService.ts` paths, prompt-cache create/delete calls, `timeline/interview.ts`, the public assistant. Bedrock calls have no price row in `llm/models.ts:37-55`, so they count as `unpriced_calls`.
- A process that dies leaves `status = processing` forever; prewarm spans can arrive after their trace closed (doc 41 §9).

Symptom for Sachin: there is no way, short of SQL on Render, to see which agent made a query slow or expensive.

### 1.5 Delivery and infrastructure facts the panel must respect

- API is `aiastra-server-api`, one Lambda behind CloudFront `E3UPJNUU8APCT` with `CachingDisabled`; account concurrency is 10 and shared with the chart worker (`docs/TODOS.md` P1). Admin queries must be cheap and few.
- Web is the Vite SPA on Amplify (`AIAstra_WEB`), routes in `src/routes.tsx:38-172` with `ProtectedRoute`/`GuestRoute` checking only `isAuthenticated` (`src/Auth/RouteGuards.tsx:17-48`); `ProfileGate` holds `me` and the plan in context (`src/Auth/ProfileGate.tsx:45-101`). GraphQL is plain `fetch` (`src/lib/graphql.ts`). `customHttp.yml` sets `X-Robots-Tag: noindex` per path prefix.
- Logging is `console.log` JSON lines to CloudWatch; there is no request id. The per-query `runId` travels in `AsyncLocalStorage` (`trace.ts:271-275`).
- Postgres is on Render through the pooler (`connection_limit` per instance, pool of 6; `src/lib/prismaUrl.ts`).

## 2. End goal

When this is done, Sachin (and anyone with the `aiastra_admin` role) opens `/admin` in the normal web app and:

- **Finds a user** by exact email, username or id, or browses the newest accounts, filtered by role, plan, locked, chart ready.
  Sees a masked email and name, role, sign-up date, chart status, plan, questions used and left, and their last 20 queries
  (times, agents, cost; never the question text).
- **Locks a user out** with one click and a reason. Within 30 seconds every request from that person, on every route, is
  refused with "This account is locked"; sign-in is refused; their chart builds stop. Unlock is one click. Both are in an
  audit log with who, when and why.
- **Resets the question quota** (this month's count goes to 0), **grants a different quota** for this account, or sets it back
  to the plan's default.
- **Reviews and changes the plan**: sets Plus or Unlimited with an interval and an optional end date, or clears to Free, with a
  note. The change takes effect on the person's next question and shows in their `UsageBar` on their next page focus.
- **Sees what is running now**, how many queries ran today, their p50 and p95 complete time and cost, and a table of every
  agent (and agent type, model, flow, bucket, template, tier, route) with calls, p50, p95, failure rate, average tokens in,
  cached, out, thought, and average cost, over a chosen window (24 h, 7 d, 30 d).
- **Opens one query** and sees its timeline: each agent and model call as a bar from start to end, with the gap that is our own
  overhead, the tokens and cost per bar, and failures with their reason.

What can no longer go wrong: an abusive account keeps asking; a quota or plan fix needs a laptop with `DATABASE_URL`;
a slow agent is invisible; an admin action leaves no record; a page that lists questions shows anyone's question text.

Timings the admin notices: list pages under 1 s; the agents table under 2 s at 30 days; the running-now list refreshes every
10 s; a lock takes effect within 30 s everywhere and at once on the instance that did it.

## 3. Deliverable

**Server (`AIAstra_Server`)**

- `src/auth/requestAuth.ts` (new): one `authenticateRequest(headers)` used by GraphQL context and every REST route; returns
  `{ userId, role, locked }` from the JWT **and** the `auth` row, with a 30 s per-instance cache.
- `src/auth/roles.ts`: `ADMIN_ROLES`, `isAdminRole`, `QUOTA_EXEMPT_ROLES`; `src/graphql/schema.ts:39` and `src/billing/plans.ts:41` import them.
- `src/ensureSuperadmin.ts` → `src/ensureAdmins.ts`: promotes the rows named in `ADMIN_EMAILS` to `aiastra_admin` at boot.
- `src/admin/` (new): `service.ts` (users, lock, quota, plan), `audit.ts`, `metrics.ts` (trace list, one trace, stats), `mask.ts`.
- GraphQL: the queries and mutations in section 4.2, replacing `adminListUsers`/`adminGetUser`/`adminUpdateUser` and removing
  `adminGetUserKundli`.
- `src/reading/metrics/trace.ts`: labels on the trace (`bucket`, `template`, `tier`, `route`, `subjects`), `subject` and `tier` on spans.
- Migrations (written; applied only with Sachin's OK, standing OK for staging testing per memory):
  `20261104100000_admin_m23_lock_audit` and `20261104110000_metrics_m24_labels` (section 4.1.1).
- `scripts/billing-set-paid.ts` stays, now calling the same `src/admin/service.ts` functions so there is one write path.
- Tests: `tests/unit/auth/requestAuth.test.ts`, `tests/unit/admin/*.test.ts`, `tests/unit/reading/metrics.test.ts` (extended),
  `tests/unit/adminResolvers.test.ts` (rewritten).

**Web (`AIAstra_WEB`)**

- `src/pages/admin/`: `AdminLayout.tsx`, `AdminOverview.tsx`, `AdminUsers.tsx`, `AdminUser.tsx`, `AdminQueries.tsx`,
  `AdminQuery.tsx`, `AdminAgents.tsx`, `api.ts`, `format.ts`; components `SpanTimeline.tsx`, `StatsTable.tsx`, `LockDialog.tsx`,
  `PlanDialog.tsx`, `QuotaDialog.tsx`.
- `src/Auth/RouteGuards.tsx`: `AdminRoute`. `src/Auth/api.ts`: `role` on `ME_QUERY`. `src/routes.tsx`: the `/admin/*` routes.
- `src/App.tsx`/`src/lib/graphql.ts`: handle 401 `account_locked` by signing out to a locked screen.
- `customHttp.yml`: `/admin` and `/admin/*` noindex.
- Tests: `src/pages/admin/*.test.tsx` for the guards, the masking and each dialog.

**Env:** `ADMIN_EMAILS` (comma list) on the Lambda and locally; `METRICS_RETENTION_DAYS` (default 90). Removed: `SUPERADMIN_PASSWORD`, `SUPERADMIN_USERNAME`.

**Docs:** this plan; `docs/reading-engine/41-agent-metrics.md` §10 pointed here; `docs/TODOS.md` items closed as they ship.

## 4. Exactly how it works when done

### 4.1 Backend

#### 4.1.1 Schema

Migration `20261104100000_admin_m23_lock_audit`:

```sql
ALTER TABLE auth
  ADD COLUMN locked_at     timestamptz,
  ADD COLUMN locked_reason text,
  ADD COLUMN locked_by     text,          -- auth.id of the admin, or 'system'
  ADD COLUMN token_version integer NOT NULL DEFAULT 1,
  ADD COLUMN last_seen_at  timestamptz;   -- updated at most once per 5 minutes per user
CREATE INDEX auth_locked_at ON auth (locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX auth_created_at ON auth (created_at DESC);

CREATE TABLE admin_actions (
  id              text PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  actor_user_id   text NOT NULL REFERENCES auth(id) ON DELETE SET NULL,
  action          text NOT NULL,        -- user.lock | user.unlock | quota.reset | quota.set | plan.set | plan.clear | role.set | research.set | email.reveal
  target_user_id  text REFERENCES auth(id) ON DELETE SET NULL,
  reason          text,
  before          jsonb,
  after           jsonb,
  ip              text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_actions_target ON admin_actions (target_user_id, created_at DESC);
CREATE INDEX admin_actions_actor  ON admin_actions (actor_user_id, created_at DESC);
CREATE INDEX admin_actions_created ON admin_actions (created_at DESC);
```

`is_active` is left as it is (the chart sync sweeps read it). Locking is `locked_at IS NOT NULL`; `is_active` is set false at
the same time so the sweeps stop building that person's charts, and true again on unlock.

Migration `20261104110000_metrics_m24_labels`:

```sql
ALTER TABLE reading_traces
  ADD COLUMN bucket   text,    -- buckets/taxonomy.ts id, from intent.classification
  ADD COLUMN template text,    -- T1..T10
  ADD COLUMN tier     integer, -- oracle flow, readers.ts tierFor
  ADD COLUMN route    text,    -- planB.ts: pressure | mood | luck | will_it_happen
  ADD COLUMN subjects integer; -- how many subjects fanned out
CREATE INDEX reading_traces_flow_started   ON reading_traces (flow, started_at DESC);
CREATE INDEX reading_traces_bucket_started ON reading_traces (bucket, started_at DESC);

ALTER TABLE reading_agent_spans
  ADD COLUMN subject text,
  ADD COLUMN tier    integer;
CREATE INDEX reading_agent_spans_started ON reading_agent_spans (started_at DESC);
```

Prisma models change to match (`Auth`, new `AdminAction`, `ReadingTrace`, `ReadingAgentSpan`). `prisma validate` and
`prisma generate` close the step.

#### 4.1.2 Request authentication, lock-out and revocation

One function, `authenticateRequest(headers, { now })` in `src/auth/requestAuth.ts`:

1. Read the bearer token from `X-Astra-Authorization`, else `Authorization` (as today). No token → `{ userId: null }`.
2. `jwt.verify` with `JWT_SECRET`. Invalid or expired → `{ userId: null }` (as today). The token now carries `tv` (token
   version); a token without `tv` is treated as `tv = 1`, so existing tokens keep working.
3. Look up `auth` by id, selecting `role, locked_at, token_version, is_active`, through a per-instance cache keyed by user id with a
   30 s TTL (one `Map`, at most 5,000 entries, oldest evicted). A cache miss is one primary-key read, under 5 ms on the pooler.
   Database error → log one line with no personal data and fall back to the JWT's role and `locked = false` (a bug of ours
   must not lock everyone out; the privacy plan's `PII_UNAVAILABLE` rule is the opposite because there the data is unreadable anyway).
4. Decide:
   - row missing → `{ userId: null, reason: 'deleted' }`
   - `locked_at` set → `{ userId, role, locked: true }`
   - `token_version` in the row greater than the token's `tv` → `{ userId: null, reason: 'revoked' }`
   - otherwise `{ userId, role: canonicalRole(row.role), locked: false }`. **Role comes from the row, not the token.**
5. Fire-and-forget `last_seen_at = now()` when the cached value is older than 5 minutes.

Callers:

- `src/graphql/context.ts` builds the context from it. `locked: true` makes every resolver except `me` (which returns the
  locked flag so the web can show the screen) and `logout` throw `GraphQLError('Account locked', { extensions: { code: 'ACCOUNT_LOCKED' } })`.
- `server.ts` `getUserIdFromRequest` becomes `requireUser(req, res)`: returns the id, or writes 401 `{ code: 'unauthorized' }`,
  or 401 `{ code: 'account_locked', message: 'This account is locked.' }`, and the route returns. The SSE routes write the
  same JSON before any `data:` frame. `clarifyRoutes.ts`, `billing/routes.ts`, `timelineRoutes.ts` receive the same function.
- Sign-in: `completeLogin` (`authService.ts:128-159`) and both verify paths in `emailCode.ts` check `locked_at` **before** issuing
  a token; locked → error code `ACCOUNT_LOCKED` with the same message. `requestMagicLink` for a locked account still sends
  nothing and returns the generic "code sent" answer, so a locked address learns nothing by probing.
- The JWT gains `tv`: `jwt.sign({ sub, role, tv: row.token_version }, secret, { expiresIn: '7d' })`. The `role` claim stays in
  the token only for logging; nothing authorises from it any more.
- `src/graphql/rbac.ts` `requireRoles` reads `context.role`, which is now the row's role. `withAdmin` throws
  `GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } })` instead of returning `{success:false}`.

Lock (`src/admin/service.ts lockUser(actor, targetId, reason, ip)`), in one transaction:

1. Refuse to lock yourself or another `aiastra_admin` (`ADMIN_CANNOT_LOCK_ADMIN`).
2. `UPDATE auth SET locked_at = now(), locked_reason, locked_by = actor, is_active = false, token_version = token_version + 1 WHERE id = target`.
3. Insert `admin_actions` (`user.lock`, before `{locked_at:null}`, after `{locked_at, reason}`).
4. Drop the target from the auth cache on this instance. Other instances see it within 30 s.
5. Release any `question_usage` row in `reserved` for the target (so a half-run question is not charged).

Unlock: `locked_at = null, locked_reason = null, locked_by = null, is_active = true`; `token_version` is **not** bumped (the person's
old tokens were already invalidated at lock; they sign in again). Audit `user.unlock`.

Revoke sessions only (no lock): `token_version + 1`, audit `user.revoke_sessions`. Used when a token is suspected stolen.

#### 4.1.3 Roles and who may do what

`src/auth/roles.ts` gains:

```ts
export const ADMIN_ROLES: RoleId[] = ['aiastra_admin'];
export const QUOTA_EXEMPT_ROLES: RoleId[] = ['aiastra_admin', 'astrologer', 'researcher'];
export function isAdminRole(raw) { return ADMIN_ROLES.includes(canonicalRole(raw)); }
```

`client_account_admin` is not exempt and not an admin: it exists for a later organisation feature and has no rights today.
`schema.ts:39` and `plans.ts:41` import these instead of their own arrays; `plans.ts` compares `canonicalRole(row.role)`, which
makes legacy `support`/`admin`/`superadmin` rows exempt through the map, as they are today.

Admin capability within the panel is one level: every `aiastra_admin` can do everything in section 4.2. A second tier
(`support`: read, lock, quota; no plan or role changes) is a one-line change to a capability map in `src/admin/service.ts`
and is deferred until there is a second staff member.

Bootstrap: `src/ensureAdmins.ts` runs at boot. For each address in `ADMIN_EMAILS`: if a row with that email exists and its
role is not `aiastra_admin`, set it and bump `token_version`; if none exists, do nothing (the person signs up normally and the
next boot promotes them). It never creates rows and never touches passwords. `SUPERADMIN_PASSWORD`, `SUPERADMIN_USERNAME` and
`src/lib/hash.ts` use from this path are removed. Sachin's own address goes in `ADMIN_EMAILS` on the Lambda (deploy session).

#### 4.1.4 Users: list, get, mask

`adminUsers(filter, cursor, limit ≤ 100)` in `src/admin/service.ts`:

- `search` is matched **exactly** against `lower(email)`, `username` or `id` (one indexed lookup each). No substring search: the
  privacy plan seals email and username and replaces this lookup with a blind index, so the panel is built for exact match from
  day one and does not break when that lands.
- Filters: `role`, `plan` (effective plan computed in SQL as in `plans.ts:82-86`), `locked` (true/false), `chart` (`ready`, `pending`,
  `failed`, `none` from `kundlis.queue_status`), `createdAfter`.
- Order: `created_at DESC`, keyset cursor on `(created_at, id)`.
- Returned fields per row: `id`, `emailMasked`, `nameMasked`, `role`, `createdAt`, `emailVerified`, `profileComplete`, `locked {at, reason}`,
  `chartStatus`, `plan {code, paid, until, quota, used, remaining, resetsAt}`, `lastSeenAt`, `queries7d` (count from `reading_traces`).

Masking (`src/admin/mask.ts`): `s***@y***.com` keeps the first character of the local part and of the domain label; names keep
initials (`S. M.`). `adminRevealEmail(id)` returns the full email for one user, writes `admin_actions` `email.reveal`, and the
web shows it for 60 s. Birth date, time, place, city, country, coordinates and every chart column are **never** returned by any
admin query. `adminGetUserKundli` is removed; `adminGetUserChats` is kept but returns only chat ids, titles are dropped, and message
text is never returned.

`adminUser(id)` returns the row above plus: `billing` (the full `billing_accounts` row minus `payment_ref`), `usageThisMonth`
(`questions_used_this_month`, `usage_month_start`, open reservations), the last 20 `admin_actions` on this user, and the last 20
`reading_traces` for this user (section 4.1.6 shape, no question).

#### 4.1.5 Quota and plan actions

All in `src/admin/service.ts`, each one transaction, each writing one `admin_actions` row with `before` and `after` snapshots of
the touched `billing_accounts` columns, each refused with `PLANS_DISABLED` when `PLANS_ENABLED` is off.

| Action | Writes | Notes |
|---|---|---|
| `resetQuota(target)` | `questions_used_this_month = 0`, `usage_month_start = <start of the current period per monthFor()>` | `question_usage` rows are left as history. Open `reserved` rows are released. Takes effect on the next question. |
| `setQuota(target, quota \| null)` | `question_quota` | `null` = unlimited for this account. Reuses `store.setQuota`. |
| `restoreDefaultQuota(target)` | `question_quota = planQuota(effectivePlan)` | Uses `plans.ts planQuota`. |
| `setPlan(target, plan, interval, until \| null, note)` | via `markPaid` with `payment_ref = 'admin:<actorId>'`, `paid_since = now()` unless renewing the same plan, `paid_until = until` | `plan ∈ plus, unlimited`. `desired_*` are left alone. `question_quota` is stamped from env by `markPaid` as today. |
| `clearPlan(target, note)` | via `clearPaid` | Back to Free. Quota stamped to the free value. |
| `setRole(target, role)` | `auth.role`, `token_version + 1` | Only `aiastra_admin` may call; cannot demote yourself; cannot set `aiastra_admin` on another row (bootstrap owns that). |
| `setResearch(target, on)` | `auth.research` | Shows full charts in the sidebar for that account. |

`scripts/billing-set-paid.ts` calls these same functions with `actor = 'cli'` so the audit log also shows CLI changes.

#### 4.1.6 Metrics: labels, read queries, retention

**Labels on the trace** (`src/reading/metrics/trace.ts`): `RunTrace.label({ bucket?, template?, tier?, route?, subjects? })`
merges into a private object and is written at `finish` together with the totals (one update, as today). `run.ts` calls it once after
intake (`bucket`, `template`, `subjects` from `intent.classification` and the subject list) and the oracle flow calls it when the tier
and plan-B route are chosen (`oracle/flow.ts`, `oracle/planB.ts`). A trace that dies before `finish` keeps nulls.

**Subject and tier on spans:** `observe` already keys stages by `name|subject` (`trace.ts:224`); the span row gets `subject` from that key,
and `traceModelCall` accepts an optional `subject` and `tier` in its options, passed by `nodes/specialists.ts:413` and `oracle/runReader.ts:200`.
A span's `tier` is the reader's tier for the oracle flow and null elsewhere.

**Read queries** (`src/admin/metrics.ts`, raw SQL through Prisma, every query bounded by a time window and `LIMIT`):

- `traces(filter, cursor, limit ≤ 100)`: filters `status`, `kind`, `flow`, `bucket`, `tier`, `userId`, `from`, `to`, `minMs`, `failedOnly`.
  Returns `run_id, user_id, emailMasked, kind, flow, bucket, template, tier, route, subjects, status, agents_spawned, agents_failed, model_calls, tokens{prompt, cached, output, thought}, est_cost_usd, unpriced_calls, ttft_ms, ms, started_at, ended_at, error`.
  **`question` is never selected.** `status = 'processing'` rows older than 30 minutes are returned with `status: 'lost'` (computed, not written).
- `trace(runId)`: the row above plus every span ordered by `started_at`, each with `offset_ms = started_at − trace.started_at`, and the derived
  `overhead_ms` per stage = stage `ms` minus the sum of its model calls' `ms` (matched by agent name, and by `subject` when present).
  Also the `reading_runs` row's `timings_ms` and `cache.cost` when `kind = 'reading'`, for cross-checking, and the `clarify`/`prewarm` traces
  that share `clarify_run_id`.
- `agentStats(window: '24h'|'7d'|'30d', groupBy: 'agent'|'agent_kind'|'model'|'flow'|'bucket'|'template'|'tier'|'route', level: 'stage'|'model_call')`:
  one query joining spans to traces on `run_id`, `GROUP BY` the chosen column, returning `calls, ok, cached, failed, p50_ms, p95_ms, avg_prompt_tokens,
  avg_cached_tokens, avg_output_tokens, avg_thought_tokens, avg_cost_usd, unpriced_calls, avg_wait_ms, avg_read_ms`.
  `percentile_cont` over the indexed `started_at` window. Grouping by `flow`/`bucket`/`template`/`tier`/`route` groups spans by their trace's label,
  which is what "averages per technique" means here.
- `queryStats(window)`: per trace, `kind = 'reading'`: count, done, failed, lost, p50 and p95 `ms` and `ttft_ms`, total and average `est_cost_usd`, total tokens.
- `runningNow()`: `status = 'processing'` and `started_at > now() − 30 min`, newest first, max 50.

Volume and speed: a query writes 5–25 spans. At 1,000 queries a day that is at most 25,000 rows a day, 2.3 M at 90 days. The 7-day stats
query touches at most 175,000 rows on `reading_agent_spans_started`; expected under 1 s on Render's smallest paid plan. If the 30-day
query exceeds 2 s in phase 4's check, add the daily rollup table `agent_stats_daily` (deferred, section 8).

**Retention:** `POST /internal/metrics-retention` with the existing internal-token pattern (`kundliSyncWorker.ts:50`, made mandatory by the
privacy plan step 0.2) deletes `reading_agent_spans` older than `METRICS_RETENTION_DAYS` (90) in batches of 5,000 and marks traces older than
30 minutes still `processing` as `unavailable` with `error = 'lost'`. Traces are kept (one small row per query). The EventBridge rule
(`rate(1 day)`) is infrastructure for the deploy session or Sachin (section 6); until it exists, the same code runs from `scripts/metrics-retention.ts`.

**Concurrency and limits:** admin reads use the same pool; no admin query may run longer than 5 s (`statement_timeout` set per query with
`SET LOCAL`), and the resolvers reject a window wider than 30 days. The web polls `runningNow` every 10 s only while the overview page is open.

#### 4.1.7 Audit log

Every mutation in 4.1.2, 4.1.3 and 4.1.5 writes `admin_actions` inside its transaction; a failed insert fails the action. `adminActions(filter)`
lists them (by target, by actor, by action, newest first, cursor). Rows are never deleted by code; `ON DELETE SET NULL` keeps the history
when a user is deleted. `ip` is the client IP from `src/lib/requestMeta.ts`.

### 4.2 API

All admin operations are GraphQL on the existing `/graphql`, guarded by `withAdmin` (throws `FORBIDDEN`), and all set
`Cache-Control: no-store` on the response (the GraphQL handler sets it for every response carrying a bearer token, which also covers the
privacy plan's 4.3 requirement). Errors come back as `extensions.code`; the client must handle `UNAUTHENTICATED`, `ACCOUNT_LOCKED`, `FORBIDDEN`,
`NOT_FOUND`, `PLANS_DISABLED`, `ADMIN_CANNOT_LOCK_ADMIN`, `ADMIN_CANNOT_CHANGE_SELF`, `INVALID_INPUT`.

| Operation | Args | Returns |
|---|---|---|
| `adminUsers` | `filter: {search, role, plan, locked, chart, createdAfter}`, `cursor`, `limit` | `{ items: [AdminUser], nextCursor }` |
| `adminUser` | `id` | `AdminUserDetail` (4.1.4) or `NOT_FOUND` |
| `adminRevealEmail` (mutation) | `id` | `{ email }`; audit row |
| `adminLockUser` (mutation) | `id, reason!` | `AdminUser`; `ADMIN_CANNOT_LOCK_ADMIN` |
| `adminUnlockUser` (mutation) | `id` | `AdminUser` |
| `adminRevokeSessions` (mutation) | `id` | `AdminUser` |
| `adminResetQuota` (mutation) | `id` | `AdminUser` |
| `adminSetQuota` (mutation) | `id, quota: Int` (null = unlimited), `restoreDefault: Boolean` | `AdminUser` |
| `adminSetPlan` (mutation) | `id, plan: plus\|unlimited, interval: month\|year, until: DateTime, note` | `AdminUser` |
| `adminClearPlan` (mutation) | `id, note` | `AdminUser` |
| `adminSetRole` (mutation) | `id, role` | `AdminUser` |
| `adminSetResearch` (mutation) | `id, on: Boolean` | `AdminUser` |
| `adminActions` | `filter: {targetUserId, actorUserId, action}`, `cursor`, `limit` | `{ items, nextCursor }` |
| `adminReadingTraces` | `filter` (4.1.6), `cursor`, `limit` | `{ items: [AdminTrace], nextCursor }` |
| `adminReadingTrace` | `runId` | `AdminTraceDetail` (trace, spans, related, runTimings) or `NOT_FOUND` |
| `adminAgentStats` | `window, groupBy, level` | `[AdminAgentStat]` |
| `adminQueryStats` | `window` | `AdminQueryStats` |
| `adminRunningNow` | | `[AdminTrace]` |
| `me` | | gains `role` and `locked` |

Removed: `adminListUsers`, `adminGetUser`, `adminUpdateUser`, `adminGetUserKundli`. `adminGetUserChats` returns ids only. `referralStats`
returns masked emails. `adminRefreshUserKundli` stays (it re-queues a chart build; it reads no chart).

REST: every protected route returns `401 { code: 'account_locked' }` for a locked user and `401 { code: 'unauthorized' }` otherwise, before any
SSE frame. `POST /internal/metrics-retention` returns `{ deletedSpans, lostTraces }`; 401 without the token.

### 4.3 Frontend experience

Routes under `/admin`, inside the normal signed-in shell, guarded by `AdminRoute` (requires `me.role === 'aiastra_admin'`; anyone else is sent to
`/dashboard`). The server is the real gate; the web guard only hides the menu. The profile menu shows an "Admin" entry for admins only.

| Page | What it shows | Polls | While waiting | On failure |
|---|---|---|---|---|
| `/admin` Overview | Running now (run id, user masked, flow, started, elapsed); today's and 7-day counts, p50/p95, cost; top 5 slowest and top 5 failing agents (7 d) | `adminRunningNow` every 10 s while visible; stats on load and on window focus | Skeleton rows | Inline "Could not load" with Retry; the rest of the page stays |
| `/admin/users` | Search box (exact email, username, id), filters, newest-first table: email masked, name masked, role, plan, used/quota, chart, locked badge, last seen | Nothing | Skeleton | same |
| `/admin/users/:id` | Header card (masked email with Reveal, role, created, last seen, chart status); Plan card (effective plan, paid until, quota, used, resets; buttons Set plan, Clear plan); Quota card (Reset this month, Set quota, Restore default); Access card (Lock/Unlock with reason, Revoke sessions, Role select, Research toggle); Recent queries (last 20 traces, no text); Audit (last 20 actions on this user) | Re-fetch after each mutation | Buttons disabled with spinner | Dialog keeps its values, shows the error code's message |
| `/admin/queries` | Trace table with filters (status, kind, flow, bucket, tier, user, window, failed only, slower than), columns: started, user masked, flow, bucket/template, tier/route, subjects, agents (spawned/failed), calls, tokens in/cached/out/thought, cost, TTFT, total, status | Nothing (Refresh button) | Skeleton | same |
| `/admin/queries/:runId` | Summary row; **timeline**: one bar per span from `offset_ms` to `offset_ms + ms`, stage bars thick, model-call bars thin under their stage, colour by status, the overhead gap hatched; hover shows tokens, cost, wait/read ms, failure reason; a table under it with the same numbers; related clarify/prewarm traces linked | Every 5 s while `status = processing` | "Still running" banner | same |
| `/admin/agents` | Window selector (24 h / 7 d / 30 d), group-by selector (agent, agent type, model, flow, bucket, template, tier, route), level selector (stage / model call); table: calls, ok/cached/failed, failure %, p50, p95, avg tokens in/cached/out/thought, avg cost, avg wait/read; sortable; unpriced calls flagged | On change | Skeleton | same |

Locked user, anywhere in the app: a 401 `account_locked` (REST) or `ACCOUNT_LOCKED` (GraphQL) signs the person out and shows the locked screen
(4.4). The `auth:session-expired` event (`lib/graphql.ts:121-123`) gets a sibling `auth:account-locked`.

### 4.4 UI/UX: words and states

| Place | Words |
|---|---|
| Locked screen (user) | "This account is locked. If you think this is a mistake, write to support." (support address from `LegalPages` once it exists; until then "write to us") |
| Sign-in for a locked account | Same words, after the code is accepted. The code request itself says "If that address has an account, we have sent a code." |
| Lock dialog | Title "Lock this account?"; reason field required, placeholder "Why (shown only to admins)"; buttons "Lock account" (red) / "Cancel"; result "Locked. Their sessions are ended; new sign-ins are refused." |
| Unlock | "Unlocked. They can sign in again." |
| Revoke sessions | "Signed out everywhere. Their account stays open." |
| Reset quota | "This month's count is back to 0 of {quota}." |
| Set quota | Field "Questions a month (blank = unlimited)"; result "Quota set to {n} for this account." |
| Set plan | Plan select, interval select, "Paid until (optional)", note; result "Plan set to {Plan}. It applies to their next question." |
| Clear plan | "Back on Free with {free} questions a month." |
| Trace status | `processing` "Running", `done` "Done", `failed` "Failed", `unavailable` "Not recorded", `lost` "Lost (no end recorded)" |
| Agents table, unpriced | "Cost excludes {n} calls with no price" |
| Any admin error | `FORBIDDEN` "You do not have access to this." `PLANS_DISABLED` "Plans are off on this server." `ADMIN_CANNOT_LOCK_ADMIN` "Admins cannot be locked here." |

Masked values everywhere; the Reveal button shows the email for 60 s with "Logged" beside it.

## 5. Architecture

```
Browser (/admin, aiastra_admin) ── TLS ──> CloudFront ──> aiastra-server-api
                                                            │
      authenticateRequest(headers)  ─── JWT verify ─── auth row (30 s cache): role, locked_at, token_version
                                                            │
      GraphQL admin resolvers ── withAdmin(throws) ── src/admin/service.ts ── one transaction ── billing_accounts / auth / admin_actions
                                                  └── src/admin/metrics.ts ── bounded SQL ── reading_traces ⋈ reading_agent_spans
                                                            │
      Reading engine (unchanged path) ── RunTrace.label(...) ── reading_traces.bucket/template/tier/route/subjects
                                      ── traceModelCall(subject, tier) ── reading_agent_spans.subject/tier
                                                            │
      EventBridge rate(1 day) ──> POST /internal/metrics-retention ── delete old spans, mark lost traces
```

| Boundary | Guarantee |
|---|---|
| Browser → API | Nothing admin-only is decided in the browser. Every admin operation checks the row's role on the server. |
| JWT → auth row | A lock or role change is honoured within 30 s on every instance, at once on the instance that made it. |
| Admin API → data | No birth field, coordinate, chart column, question text, answer text or prompt is selectable through any admin operation. Enforced by `tests/unit/admin/noPersonalFields.test.ts`, which walks the admin GraphQL types. |
| Admin writes → audit | No admin write commits without its `admin_actions` row. |
| Engine → metrics | Recording never waits on the database and never fails a reading (doc 41 §5). Labels are added to the same batched write. |
| Metrics reads → pool | Bounded windows, `LIMIT`, 5 s statement timeout. |

Runs where: everything on the request path of the one API Lambda; retention on a daily schedule; nothing new in Radha.

## 6. Ingredients

| Item | Who | Status |
|---|---|---|
| Migrations M23, M24 written | agent | step 1 |
| M23, M24 applied on staging | deploy session under the standing testing OK; live needs Sachin's yes | after step 1 |
| `ADMIN_EMAILS` on the Lambda with Sachin's address; `SUPERADMIN_*` removed | deploy session | phase A1 |
| `METRICS_RETENTION_DAYS=90`, `INTERNAL_TOKEN` (the existing events token, now mandatory) | deploy session | phase A4 |
| EventBridge rule `aiastra-metrics-retention`, `rate(1 day)`, target the Function URL path with the token | Sachin or admin (the deployer lacks `events:*`, `docs/TODOS.md`) | phase A4; script fallback until then |
| No new library. Timeline bars are plain CSS/SVG; no chart library. | — | |
| Fixtures: `tests/unit/admin/fixtures/traces.json` (one single, one 3-subject graph, one oracle tier-3 run, one lost run) built from `metrics.test.ts`'s fake store | agent | phase A3 |
| One real signed-in staging question after M24 so the first labelled rows exist (doc 41 §8 still open) | Sachin asks; deploy session reads | closes phase A3 |

## 7. Action steps in sequence

Branches are cut from `develop` and merged `--no-ff` back. Steps marked ∥ can run at the same time on separate branches; two writers never
edit the same file. `prisma/schema.prisma` is shared: A owns the `Auth`/`AdminAction` models, C owns `ReadingTrace`/`ReadingAgentSpan`, each
appends only its own block.

| # | Step | Files | Done when | ∥ |
|---|---|---|---|---|
| 1 | Migrations M23 and M24; Prisma models | `prisma/migrations/20261104100000_admin_m23_lock_audit`, `..110000_metrics_m24_labels`, `schema.prisma` | `prisma validate`, `prisma generate`, `tsc` green | A, C start after this |
| 2 | `authenticateRequest` with cache, `tv` claim, locked/revoked outcomes; GraphQL context and `requireUser` on every REST route; sign-in refuses locked | `src/auth/requestAuth.ts`, `graphql/context.ts`, `server.ts`, `routes/*.ts`, `billing/routes.ts`, `authService.ts`, `auth/emailCode.ts` | `requestAuth.test.ts`: token without `tv` works; bumped version → 401; locked → 401 `account_locked` on SSE before any frame; DB error → JWT fallback | A |
| 3 | Roles unified; `withAdmin` throws; `ensureAdmins` | `auth/roles.ts`, `graphql/schema.ts:39,439`, `billing/plans.ts:41`, `ensureAdmins.ts`, `server.ts:405` | `rbac.test.ts` updated; boot promotes an `ADMIN_EMAILS` row in a test | A |
| 4 | `src/admin/service.ts`, `audit.ts`, `mask.ts`: users list/get, lock, unlock, revoke, quota, plan, role, research; CLI script reuses them | `src/admin/*`, `scripts/billing-set-paid.ts`, `adminService.ts` (deleted) | `admin/service.test.ts`: each action writes its audit row in the same transaction; lock releases reservations; cannot lock admin; masks correct | A |
| 5 | GraphQL types and resolvers for users and actions; old admin operations removed; `me.role`, `me.locked`; `no-store` on bearer responses | `graphql/schema.ts` | `adminResolvers.test.ts` rewritten; `noPersonalFields.test.ts` passes | A, after 4 |
| 6 | Trace labels and span subject/tier | `reading/metrics/trace.ts`, `reading/run.ts`, `oracle/flow.ts`, `oracle/planB.ts`, `nodes/specialists.ts`, `oracle/runReader.ts` | `metrics.test.ts`: a 3-subject graph run writes 3 distinguishable `dasha` spans; oracle run writes `tier` and `route` on the trace | C |
| 7 | `src/admin/metrics.ts`: traces, trace, agentStats, queryStats, runningNow, retention | `src/admin/metrics.ts`, `server.ts` (internal route), `scripts/metrics-retention.ts` | `admin/metrics.test.ts` against the fixtures: overhead math, lost status, p50/p95, groupBy on labels; 5 s timeout set | C, after 6 |
| 8 | GraphQL for metrics | `graphql/schema.ts` (its own block) | resolver tests | C, after 7 and 5 |
| 9 | Web: `role` in `ME_QUERY`, `AdminRoute`, admin menu entry, locked screen and `auth:account-locked`, `customHttp.yml` | `AIAstra_WEB/src/Auth/api.ts`, `Auth/RouteGuards.tsx`, `routes.tsx`, `App.tsx`, `lib/graphql.ts`, `components/ProfileMenu.tsx`, `pages/LockedPage.tsx`, `customHttp.yml` | guard tests; a 401 `account_locked` lands on the locked screen | W1, after 5 |
| 10 | Web: users list, user detail, dialogs | `pages/admin/AdminUsers.tsx`, `AdminUser.tsx`, `LockDialog.tsx`, `PlanDialog.tsx`, `QuotaDialog.tsx`, `api.ts`, `format.ts` | component tests; stubbed walkthrough screenshots per `TEST.MD` into `docs/screenshots/admin-users/` | W1, after 9 |
| 11 | Web: overview, queries, query timeline, agents | `pages/admin/AdminOverview.tsx`, `AdminQueries.tsx`, `AdminQuery.tsx`, `AdminAgents.tsx`, `SpanTimeline.tsx`, `StatsTable.tsx` | component tests on the fixtures; screenshots into `docs/screenshots/admin-metrics/` | W2, after 8 and 9 |
| 12 | Merge A, C, W1, W2 into `develop`; `tsc`, `vitest run tests/unit/admin tests/unit/auth tests/unit/reading/metrics`; web `npm test` | — | green; `docs/TODOS.md` items closed | |
| 13 | Deploy session: apply M23/M24 on staging, set `ADMIN_EMAILS`, deploy; Sachin opens `/admin`, locks a test account, resets its quota, sets Plus; asks one question; opens its timeline | — | Each action visible and in `admin_actions`; the trace shows labelled spans | |

## 8. Development phases

| Phase | Steps | Leaves the system | Closing check | Deferred |
|---|---|---|---|---|
| A1 Lock-out and roles | 1–3 | Every route honours a lock within 30 s; roles come from the row; admins bootstrapped from env; nothing visible changes for users | `requestAuth.test.ts`, `rbac.test.ts`; on staging a locked test account gets 401 on `/api/chat/ask-stream` | Panel |
| A2 User management API | 4–5 | Users, plans, quotas, locks manageable through GraphQL with an audit log; CLI script unified | Resolver tests; `noPersonalFields` test; one `adminSetPlan` on staging shows in the user's `UsageBar` | UI |
| A3 Metrics labels and read API | 6–8 | Traces carry bucket/template/tier/route/subjects; spans carry subject/tier; stats queryable | `metrics.test.ts`; one real staging question shows labelled rows; the 7-day stats query under 1 s on staging | Rollup, alarms |
| A4 Admin pages | 9–11 | `/admin` usable end to end; retention script in place | Screenshots in `docs/screenshots/admin-*`; Sachin's walkthrough in step 13 | EventBridge rule; support tier |
| A5 Operate | — | Daily retention on a schedule; the slow-agent table has a week of data | First slow agent found from `/admin/agents` and filed | `agent_stats_daily` rollup if the 30-day query exceeds 2 s; p95 alarms; impersonation (not planned) |

Each phase is shippable on its own: A1 without A2 still removes the "cannot lock anyone out" risk; A2 without A4 gives a usable API through
GraphQL explorers for Sachin; A3 without A4 gives SQL-free stats through GraphQL.

## 9. Recommendation

**Build A1 → A2 → A3 → A4 in that order, in the existing web app and the existing GraphQL, with row-based authorisation and an audit
table from the first commit.** A1 is the one piece with a security consequence today and is the smallest; the rest stacks on it.

**Order against the encryption plan (`docs/privacy/02`).** Build this plan first. It touches none of the columns the encryption plan seals,
and it is built so sealing does not break it: user search is exact-match only (blind-index ready), no admin operation selects birth or
chart data, `no-store` goes on every bearer response, and the audit table holds ids and plan columns only. The encryption plan's phase 0
(log removal, `/debug/kundli`, mandatory internal token) can run in parallel with A1 on its own branch because they share no files
except `server.ts`, where A1 edits the auth helper and phase 0 deletes log lines and a route; merge A1 first.

### Decided here, with verdicts

| Choice | Decision | Why |
|---|---|---|
| Separate admin app vs routes in the SPA | Routes in the SPA under `/admin`, role-guarded, noindex | One deploy, one auth, one API client; the server is the gate either way. A separate app is for when there are non-engineer staff with different sign-in |
| Authorise from the JWT (today) vs from the row | From the row, 30 s cache, `tv` claim | Lock-out and role changes must work without waiting 7 days; one PK read per uncached request is cheap |
| Lock = `is_active=false` vs new `locked_at` | New columns, and `is_active` set alongside | `is_active` is read by sweeps for a different meaning; a lock needs who, when, why |
| Revocation by token version vs a deny-list | Token version | No table to sweep; a bump invalidates everything at once |
| Cognito `AdminDisableUser` | Not used | Cognito tokens are discarded today and the Lambda role has no `cognito-idp` rights; the server's JWT is the only credential that matters |
| Quota reset: zero the counter vs delete `question_usage` rows | Zero the counter, release open reservations, keep rows | Rows are the ledger; the counter governs the gate |
| Plan change through a new path vs `markPaid`/`clearPaid` | `markPaid`/`clearPaid` with `payment_ref = admin:<id>` | One writer for `is_paid`, as `docs/billing/README.md` requires; a webhook later uses the same seam |
| Technique label: one composite string vs discrete columns | Discrete columns `bucket`, `template`, `tier`, `route`, `subjects` | Group by any of them; no parsing |
| Stats on read vs nightly rollup | On read, bounded windows and indexes; rollup deferred | Volume is small now; measure in A3 and add the rollup only if the 30-day query passes 2 s |
| Store question text for the admin | No; never selected | Sachin said not now; it also matches the privacy plan, which seals it |
| Timeline rendering library | None; CSS/SVG bars | A few dozen bars per query; no bundle growth |
| Masked emails with a logged Reveal | Yes | Support needs to find a person; the log keeps it honest; sealed email later still reveals through the same path |
| `support` tier | Deferred, one capability map | One staff member today |

### Decisions that are Sachin's

1. **Who is an admin.** `ADMIN_EMAILS` on the Lambda: your address, and any other. Nothing else grants `aiastra_admin`.
2. **Applying M23 and M24 on live** (staging is covered by the standing OK). They add columns and a table and drop nothing.
3. **The EventBridge retention rule** needs an identity with `events:*`; until then the script runs by hand.

Stopping after any phase leaves nothing half-migrated: every migration only adds, and every step keeps the old behaviour until the new
one is tested.
