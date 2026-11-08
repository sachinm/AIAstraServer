# 11 — The admin as an observatory: who was here, what they did, from which IP, and drill-down by date range

Status: **plan, written 2026-11-08** after a fine-tooth review of `admin.vedic-astrology.app` signed in (all 13 pages), the
admin API (`aiadastra_admin/api/src`), the server's logging tables (`prisma/schema.prisma`) and docs/admin/01–10. Written
to "How a plan is written" in `AGENTS.md`. Sachin's brief, in his words:

> Review all of admin.vedic-astrology.app, organize and find gaps in fully administering and real-time seeing users, what
> queries, agents, techniques are being run. Take what's been built and allow full drill-down inside the dashboard by date
> range, by types etc. If someone accessed the site yesterday I want to be able to see what they did; if there were
> visitors I want to know who and which IPs. Consolidate the header menu items into overarching sections with drop-downs.

Two parts of the brief were done on 2026-11-08 while this was written (branch `feat/admin-nav-sections` in
`aiadastra_admin`): the header is now Overview + three drop-down sections (People, Usage, Engine), and the Techniques Lab
was rebuilt to one viewport (top strip, three panels, collapsible right board rail). Everything else below is to build.

---

## 1. Start — the system as it is today (facts checked 2026-11-08)

### 1.1 What the live admin shows, page by page

| Page | What it answers today | Range control | Drill-down out of it | Seen on 2026-11-08 |
|---|---|---|---|---|
| Overview | running now; queries, latency, cost, tokens for 24 h and 7 d; slowest and most failing agents | fixed 24 h / 7 d | → Agents | 0 queries in 24 h, 2 in 7 d |
| Activity | on now, today, this week, visitors today; 7/30/90-day bars; active today; active sessions (15 min); plan events | 7/30/90 d for the chart; tables are **today only** | → User | On now 0, today 0, week 1, **visitors today 11 — no way to see who** |
| Day review | one calendar day: totals, by hour, by category/subject, techniques fired, agents involved, questions | **one date** (‹ › Yesterday) | → Query, → Technique. Person is shown but **not a link** | 2026-11-07: 0 questions, **181 agent runs** (all Techniques Lab runs counted as customer activity) |
| Users | list with role, plan, used/quota, chart, digest, access, last seen, queries 7 d | exact search, role, plan, locked, chart, created-after | → User | 35 accounts; **34 show Last seen "—"** although two have a query in 7 d |
| User | profile, plan, quota, access, role, research, last 20 queries, last 20 audit rows | none | → Queries?userId | audit full of "Lab run" rows (staff), no sign-in history, **no IP ever** |
| Queries | traces with status, kind, flow, bucket, tier, user, agents, tokens, cost, TTFT | 24 h / 7 d / 30 d window; API accepts `from`/`to` but the UI has **no date picker** | → Query | 4 rows; bucket/template/tier/subjects all "—" (labels not written, doc 04 G6) |
| Query | summary, timeline, spans, run timings | n/a | → User | complete and good |
| Agents | speed/registry by 15 group-bys | 24 h / 7 d / 30 d | none | fine |
| Techniques, Technique, Machinery | catalogue, runs, pieces, illustrations | window | ↔ each other | fine; Accuracy "No evidence yet" everywhere |
| Techniques Lab | run one technique or a board for one person; dossier tabs | as-of date | — | works (QA mode lists full birth data) |
| Security | sign-in/sign-up failures, Turnstile blocks, staff login fails, sessions revoked, sign-outs, locks; top offending IP prefixes; recent events with **masked IP** | window | → User | 2 sign-outs from `2601:646:897f:xxxx`; the **only IP on the whole site** |
| Clarify monitor | rubric scores per evaluated reading | window | → Query, → User | 0 evaluated |
| Page times | per-route p50/p95/p99, forecast, per-request log | window + page/source/min-ms/failed | → User or "guest" | 208 executions, **no IP**, lab routes dominate |
| Research lab | 20 synthetic subjects, verifier "100% PASS" | as-of | — | **template-synthesised, not server output** (admin TODOS P1, 2026-11-07) |

### 1.2 What the database records, and what it does not

| Table (server) | Per | Has IP | Has UA / country | Written when | Read by admin |
|---|---|---|---|---|---|
| `account_events` | event | yes (`ip`, `ip_chain`) — first `x-forwarded-for` hop, **spoofable** | yes, yes (`country` = CloudFront viewer country), `request_id` | sign-in/-up/-out, profile, billing, Turnstile fail (`src/audit/accountEvents.ts`) | Security only; IP masked, UA/country never selected |
| `assistant_visits` | signed-out visit per day | yes (`ip_prefix`, `ip_full` 30 d) — CloudFront-Viewer-Address | yes, yes, referrer, landing path | public assistant frame only (`/api/assistant/visit`) | count of distinct visits only ("Visitors today 11") |
| `page_execution_logs` | **every request** (server, GraphQL, SSE, client render) | **no, by design** | no | `pageTimingMiddleware` (`server.ts:140`); 30-day sweep | Page times |
| `user_activity_days` | user × day | no | no | the 5-minute `last_seen` tick (`requestAuth.ts:77`) | Activity |
| `auth.last_seen_at` | user | no | no | same tick | Users, User |
| `analytics_events` | click | no | no | the new boards only (`POST /api/analytics/events`) | `board_open` counts |
| `reading_traces`, `reading_runs`, `reading_agent_spans`, `agent_runs` | query / agent | no | no | reading flow and board functions | Queries, Query, Agents, Techniques, Day review |
| `admin_actions` | staff write | yes (`actor.ip`) | no | staff login/logout/fail, every staff write | User audit, Security, Activity feed; **`/actions` has no page** |
| `messages`, `assistant_questions`, `reading_traces.question` | text | — | — | — | never (by decision, doc 04 G7) |

No access logging exists outside the database: CloudFront (`E2G3O5L4YYBUE3`, the API distribution, the Amplify sites) and
the Lambda Function URL have no access logs configured; neither repo holds infrastructure-as-code; CloudWatch stdout
retention is undecided (`docs/TODOS.md:468`). Whether `CloudFront-Viewer-Address` is forwarded on the API path has not
been checked against AWS (`docs/TODOS.md:433`).

### 1.3 The symptoms, as Sachin sees them

1. "Someone visited yesterday" → Activity says *Visitors today 11* and nothing else: no list, no IP, no country, no pages.
2. "What did this user do yesterday" → the User page has the last 20 queries and staff audit rows; no requests, no page
   views, no sign-ins, no sessions; Day review counts them but does not link to them.
3. "Which IP" → only the Security page, only on sign-in-shaped events, masked, and from a spoofable header.
4. "Drill down by date range" → one calendar date (Day review), rolling windows everywhere else, a date picker nowhere but
   Users "created after". Filters do not carry from page to page.
5. Lab and research runs by staff are counted as customer activity (181 agent runs on a day with 0 questions).
6. Security's tiles count event names the server never writes (`sign_in_failed`, `session_revoked`, `account_locked`);
   the server writes `sign_in` with `outcome = failed|refused` (`security.ts:48-54` vs `schema.ts:1121-1325`).
7. Users shows *Last seen —* for 34 of 35 accounts (the tick only started writing on 2026-11-05 and only on
   authenticated API calls, which the chat SSE path and GraphQL `me` restore do not all pass through).

---

## 2. End goal — what Sachin gets

Open the admin, pick **Yesterday** (or any range up to 90 days) once in the header, and:

- **People › Visitors** lists every visitor of the range — signed-in people by masked email, signed-out visitors by a
  stable anonymous id — with country, IP prefix, device (browser/OS from the UA), first and last seen, requests, pages,
  questions asked, and whether they signed in. Click one → their **timeline**.
- **Timeline** (per person or visitor, over the range) interleaves every request (page, method, status, ms), page view,
  sign-in/-out, question (→ Query), board build, technique and agent run, and plan/quota event, newest first, with a
  filter by kind. Superadmin can **Reveal IP** for one row (audited), as email is revealed today.
- **Usage › Review** is Day review grown up: the range is the header range; group by day, hour, category, subject,
  technique, agent, model, person; every number is a link that opens the filtered list behind it (click *Self: 21
  techniques fired* → the 21 runs; click a person → their timeline). Staff lab and research runs are shown separately
  (toggle "Include staff runs", off by default).
- **Live** (on Activity): a feed of the last 100 requests across the site refreshed every 10 s, each row linking to the
  person or visitor, beside *Running now*.
- Every list page (Queries, Agents, Techniques runs, Security, Page times, Actions) takes the header range and the same
  filter chips; the URL carries range and filters so a view can be pasted to someone.
- Nothing shows a question's words or birth data; IPs are shown as prefix by default and in full only on an audited
  Reveal. Chart data is never computed in Node (nothing astrological is added here).

Time to answer "who visited yesterday and what did they do": under 10 seconds, three clicks.

---

## 3. Deliverable

| Repo | Ships |
|---|---|
| Server (`AIAstra_Server`) | Migration M41 `request_access` (+ `visitor_id` on `page_execution_logs`, `source` on `agent_runs`); `pageTimingMiddleware` writes the access row; anonymous visitor cookie; `recordAccountEvent` IP from `CloudFront-Viewer-Address`; `agent_runs.source = 'lab'|'research'` from the lab routes; sweeps; tests |
| Web (`AIAstra_WEB`) | `page_view` on every route with `visitor_id`; sends `X-Astra-Visitor` (G4 of doc 04) |
| Admin API | shared `range` parser; `GET /visitors`, `GET /timeline`, `GET /live`, `GET /review` (range + groupBy), range on `/actions`, `/security`, `/pages/requests`, `/techniques/:id/runs`, `/stats/*`, `/activity/users`; `POST /users/:id/reveal-ip` and `POST /visitors/:id/reveal-ip` (superadmin, audited); `admin_actions` rows for reads of a timeline; Security event-name fix; contract types; SQL check; tests |
| Admin web | `RangeBar` in the header (presets Today, Yesterday, 7 d, 30 d, custom from–to; URL-synced); Visitors page; Timeline page; Review page replacing Day review; Live feed on Activity; filter chips shared across pages; Actions page; Sessions & IPs card on User; tests |
| Infra (deploy session) | confirm `CloudFront-Viewer-Address` and `CloudFront-Viewer-Country` are forwarded on the API distribution (origin request policy); CloudWatch log retention 30 d on both Lambdas; no CloudFront access logs needed once `request_access` exists |
| Docs | this plan; `docs/TODOS.md` entries; admin `docs/01-architecture-and-api.md` updated with the new routes |

---

## 4. Exactly how it works when done

### 4.1 Backend (server) — one access row per request

**Write path.** `pageTimingMiddleware` already wraps every server request, GraphQL operation and SSE stream and writes
`page_execution_logs` without PII. It gains a second, PII-bearing sibling write to `request_access`, keyed by the same
`request_id`:

```
request_access
  id            bigserial
  request_id    text        -- = page_execution_logs.request_id (x-request-id | x-amzn-trace-id | x-amz-cf-id)
  at            timestamptz
  user_id       uuid null   -- from requestAuth when a JWT is present
  visitor_id    text null   -- anonymous cookie `av`, see below
  session_id    text null   -- the web's session id header, as analytics_events
  ip            inet        -- SEALED (pii fields): CloudFront-Viewer-Address, else socket
  ip_prefix     text        -- /24 (v4) or /48 (v6), plain, indexed: grouping and filtering
  country       text null   -- CloudFront-Viewer-Country
  ua            text        -- raw user agent, 512 chars max
  ua_family     text        -- parsed once: browser, os, device class (ua-parser-js, 60 KB, already a transitive dep? if not, a 40-line regex table is enough)
  method, path  text        -- path with ids replaced by :id (reuse pageTiming's canonical `page`)
  status        smallint
  ms            integer
  referer_host  text null
```

- Rules: one row per request; fire-and-forget after the response (same as page timing); a failed insert is logged once
  per minute and dropped. Cost: one insert per request, ~30 bytes of index. At today's volume (208 requests/7 d) this is
  nothing; at 100 k requests/day it is ~3 GB/year before sweeps.
- Retention: `ip` is nulled after 90 days, rows deleted after 400 days (sweep in `cacheSweep.ts` beside
  `page_execution_logs`), configurable `ACCESS_LOG_IP_DAYS`, `ACCESS_LOG_DAYS`. `legal_hold` is not needed here; hold a
  user's rows by not sweeping users with `auth.legal_hold` (exists for `assistant_visits`; reuse the flag name).
- IP source: `CloudFront-Viewer-Address` (`ip:port`), never the first `x-forwarded-for` hop. `recordAccountEvent` is
  changed to the same helper (`src/lib/requestMeta.ts` `getClientIp` → prefer viewer address; fall back to the **last**
  xff hop, which CloudFront appends and a client cannot set).
- Sealing: `request_access.ip` joins `SEALED_MODELS` in `src/lib/pii/fields.ts`; the PII guard forbids filtering on it, so
  all filters and group-bys use `ip_prefix`. Reveal decrypts one row for a superadmin and writes `admin_actions`
  `reveal_ip`.

**Visitor identity.** The web sets a first-party cookie `av` (random 22-char id, 1 year, `SameSite=Lax`, `Secure`) on
first load of `vedic-astrology.app` and sends it as `X-Astra-Visitor` on every API call (the assistant frame already has
a `visit_id`; it is replaced by this cookie so one id covers both). When a visitor signs in, the server writes one
`account_events` row `visitor_link` (`user_id`, `visitor_id`), so a timeline can show "was visitor abc… before signing
up". `page_execution_logs` gains `visitor_id` so the "guest" rows on Page times resolve to a visitor.

**Staff runs apart.** `agent_runs.source` (`'app' | 'lab' | 'research'`, default `'app'`) is set by
`src/routes/adminLabRoutes.ts` and the research routes through `withAgentRun`'s options; `reading_traces` gets the same
column for lab-driven readings. Every admin aggregate filters `source = 'app'` unless `includeStaff=1`.

**Web page views.** `AIAstra_WEB` sends `page_view` on every route change (`src/routes.tsx` effect), with `surface`,
`path`, `visitor_id`; server-side `page_execution_logs` already records the API side, so a timeline shows both "opened
/dashboard/you" and the calls it made.

### 4.2 Backend (admin API) — range, visitors, timeline, live, review

**Range parser** (`api/src/admin/range.ts`): `from`, `to` (ISO date or datetime), `tz` (default `REPORT_TZ`), presets
`today|yesterday|7d|30d|90d`; max span 92 days; `to` exclusive; dates later than now → 400 `bad_range`. Every list and
stat endpoint accepts it; `window` stays as an alias for the three presets.

**Statement budget:** every query under the admin's 5 s statement timeout; every list capped at 200 rows with a cursor;
group-bys capped at 500 groups; `request_access` scans use `(at)` and `(user_id, at)`, `(visitor_id, at)`,
`(ip_prefix, at)` indexes.

**Audit of reads:** opening a timeline writes `admin_actions` `view_timeline` (`target_user_id` or `visitor_id`, range)
— one row per page open, not per refresh (deduped 5 minutes per actor+target).

### 4.3 API

| Endpoint | Request | Response | Errors |
|---|---|---|---|
| `GET /visitors` | range; `kind=all|signed_in|anonymous`; `country`, `ipPrefix`, `q` (masked email exact, visitor id prefix); `includeStaff`; cursor | `{ items: [{ key: {userId?|visitorId}, emailMasked?, country, ipPrefixes[≤3], device, firstSeen, lastSeen, requests, pageViews, questions, signedIn: bool, linkedVisitorIds[] }], next }` ordered by lastSeen desc | `bad_range` |
| `GET /timeline` | `userId` or `visitorId` (one required); range; `kinds[]` of `request,page_view,sign_in,question,board,technique,agent,plan,staff`; cursor | `{ items: [{ at, kind, title, detail, status?, ms?, ipPrefix?, country?, device?, link?: {type, id} }], next }` newest first; merged with `UNION ALL` over the 6 tables, each pre-limited | `one_of_user_or_visitor`, `bad_range` |
| `GET /live` | `limit≤100` | last N `request_access` rows with person/visitor keys; `asOf` | — |
| `GET /review` | range; `groupBy=day|hour|category|subject|technique|agent|model|person|country`; filters `category`, `technique`, `agent`, `userId`, `includeStaff` | `{ totals, groups: [{ key, label, questions, people, failed, costUsd, p50Ms, p95Ms, runs, link: {page, filters} }] }` | `bad_range` |
| `GET /activity/users` | **range** (not one day) | as today plus `country`, `device` | |
| `GET /actions`, `/security`, `/pages/requests`, `/techniques/:id/runs`, `/stats/agents`, `/stats/queries`, `/traces` | + range | unchanged shapes | |
| `POST /users/:id/reveal-ip`, `POST /visitors/:id/reveal-ip` | `{ requestId }` | `{ ip }` | 403 unless superadmin; writes `admin_actions` `reveal_ip` |
| `GET /security` | fix: counts `action='sign_in' AND outcome IN ('failed','refused')`, `sign_up*` likewise; `session_revoked` from `admin_actions` (`revoke_sessions`); `account_locked` from `auth.locked_at` in range | | |

The web's HTTP wrapper already sends the staff JWT; all new routes are `admin`-role except the two reveals.

### 4.4 Frontend experience

- **Header RangeBar** (right of the sections): presets *Today · Yesterday · 7 d · 30 d · Custom*; a custom opens two date
  inputs; the choice is in the URL (`?from=&to=`) and mirrored to `sessionStorage` so it follows across pages. Pages that
  do not take a range (Machinery, Labs, Users list) grey it out.
- **Visitors** (People): tiles *Signed-in people · Anonymous visitors · Countries · New sign-ups* for the range; a table
  as in §4.3 with chips to filter by kind, country, IP prefix; a row click opens the Timeline. Loading: skeleton rows;
  empty: "No visits in this range"; error: the standard retry card.
- **Timeline**: header with the person or visitor (masked email or `visitor 3f9a…`), country, device, IP prefixes, link to
  the User page when signed in; a kind filter row; a virtualised list grouped by day with time, icon, title, detail;
  question rows link to Query, technique and agent rows to their pages, staff rows show the actor. *Reveal IP* on a
  request row (superadmin): confirm dialog → the full IP shown for 30 s → audit row.
- **Review** (replaces Day review in the Usage section; `/review` keeps working): the range from the header; a group-by
  select; three bar charts (by hour or day, by category, by technique category) that are clickable; the tables of
  techniques, agents and questions filtered by the clicked group; a person cell is a link to the timeline; a toggle
  *Include staff runs* defaulting off, with the hint "lab and research runs by staff".
- **Activity** gains a **Live** card: last 100 requests, 10 s refresh while the tab is visible, pause button; and *Active
  today* becomes *Active in range*.
- **User** page gains *Sessions & IPs*: distinct IP prefixes with country, device, first/last seen, request count for the
  range; a *Timeline* button.
- **Actions** (People › Security has a tab): the staff audit for the range by actor, action, target.
- Every table header that is a number shows a count link; filter chips show the active filters with ×.

### 4.5 UI/UX words and states

- Tiles: "Signed-in people", "Anonymous visitors", "Countries", "New sign-ups". Timeline kinds: Request, Page view,
  Sign-in, Sign-out, Question, Board built, Technique, Agent, Plan, Staff action.
- IP shows as `2601:646:897f:…` / `73.158.21.x` with the hint "prefix; Reveal for the full address (superadmin, audited)".
- Staff toggle hint: "Lab and Research Lab runs by staff are not customer activity."
- Pending: skeleton rows 400 ms after the request starts; failed: "Could not load. Retry."; empty: "Nothing in this range."
- No engine names, no question text, no birth data anywhere; `noPersonalFields.test.ts` extended to the new routes.

---

## 5. Architecture

```
vedic-astrology.app (web)                       api CloudFront → aiastra-server-api (Lambda)
  cookie av ──X-Astra-Visitor──▶ every call        pageTimingMiddleware
  page_view on every route                           ├─ page_execution_logs (no PII)        ← unchanged
                                                     └─ request_access (ip sealed, prefix)  ← new, same request_id
                                                   requestAuth tick → last_seen, user_activity_days
                                                   accountEvents (viewer address)   reading flow → traces/spans/runs(source)

admin.vedic-astrology.app (SPA) → admin CloudFront → aiadastra-admin-api (Lambda, read-mostly)
  RangeBar (URL)  Visitors  Timeline  Review  Live  ── SQL over the same Postgres (Render), 5 s timeout, ≤200 rows
  Reveal IP (superadmin) ───────────────────────── decrypt one row + admin_actions
```

Boundaries: the user app writes, the admin reads (and writes only `admin_actions`); nothing astrological crosses into
Node; the only PII the admin returns unmasked is on an audited Reveal.

---

## 6. Ingredients

| Item | Who |
|---|---|
| Migration M41 (`request_access`, `page_execution_logs.visitor_id`, `agent_runs.source`, `reading_traces.source`, `account_events` index on `(user_id, created_at)`), additive — standing OK | server agent |
| `SEALED_MODELS` entry for `request_access.ip`; PII guard tests | server agent |
| Env: `ACCESS_LOG_IP_DAYS=90`, `ACCESS_LOG_DAYS=400`, `ACCESS_LOG_ENABLED=1` (server); `REPORT_TZ` (both) | deploy session |
| Confirm the API CloudFront origin request policy forwards `CloudFront-Viewer-Address`, `CloudFront-Viewer-Country` (the admin and assistant code already assume it) | deploy session, with Sachin's assume-role OK |
| CloudWatch retention 30 d on both Lambdas | deploy session |
| UA parsing: a 40-line table in `src/lib/ua.ts` (no new dependency) | server agent |
| Web cookie `av` and `page_view` per route | web agent |
| Fixtures: 3 users × 2 days of `request_access`, 2 anonymous visitors, one lab run — for admin tests and the SQL check | admin agent |
| Decisions that are Sachin's: (a) full-IP retention 90 d, (b) read audit of timelines, (c) whether anonymous visitors get a timeline at all (default yes), (d) whether to show question text (still no, doc 04 G7) | Sachin |

---

## 7. Action steps in sequence

1. **Server M41 + access write** (`prisma/migrations/2026110900_access_m41`, `schema.prisma`, `src/telemetry/pageTiming.ts`,
   `src/lib/requestMeta.ts`, `src/lib/ua.ts`, `src/lib/pii/fields.ts`, `src/jobs/cacheSweep.ts`, tests). Done: every request
   in a local run writes one row with a viewer-address IP and a prefix; the PII guard refuses `where: { ip }`.
2. **Server staff-run tagging** (`src/agents/registry.ts` `withAgentRun` option `source`, `src/routes/adminLabRoutes.ts`,
   research routes, `reading_traces.source`). Done: a lab run shows `source = 'lab'`. Parallel with 1.
3. **Server `account_events` IP fix + `visitor_link`** (`src/audit/accountEvents.ts`, `src/graphql/schema.ts` sign-in).
   Parallel with 1.
4. **Web visitor cookie + page views** (`AIAstra_WEB/src/lib/graphql.ts` headers, `src/routes.tsx`). Parallel with 1.
5. **Admin API range + fixes** (`api/src/admin/range.ts`, range on the seven existing endpoints, Security event names,
   `activity/users` by range). Done: `sql-check.ts` passes; the Security tiles match server event names.
6. **Admin API visitors, timeline, live, review, reveal-ip** (`api/src/admin/{visitors,timeline,live,review}.ts`,
   `contract.ts`, `app.ts`, `noPersonalFields.test.ts`). After 5; needs 1 for real rows (tests use fixtures).
7. **Admin web RangeBar + chips** (`web/src/components/{RangeBar,FilterChips}.tsx`, `lib/range.ts`, wire into Queries,
   Agents, Security, Page times, Technique runs, Activity). After 5.
8. **Admin web Visitors, Timeline, Review, Live, User Sessions & IPs, Actions** (`web/src/pages/{Visitors,Timeline,Review,
   Actions}.tsx`, `Activity.tsx`, `User.tsx`, `Layout.tsx` entries under People and Usage). After 6 and 7.
9. **Deploy**: M41, env vars, origin request policy check, retention; then one walkthrough: Sachin opens Yesterday →
   Visitors → his own timeline → Reveal IP, screenshots at 375 px and desktop (admin `docs/02-deploy.md` §3).

Steps 1–4 are four parallel worktrees (Haiku creates them); 5 can start at once in the admin repo; 6–8 follow.

---

## 8. Development phases

| Phase | Steps | Leaves the system | Closing check |
|---|---|---|---|
| **V0 — range and truth** | 5, 7 | Every existing page takes a real date range; Security counts are right; staff runs still mixed in | Queries for `from=2026-11-07&to=2026-11-08` returns the day's rows; Security tiles match a hand count of `account_events` |
| **V1 — the access log** | 1, 2, 3, 4, 9 (deploy) | Rows accrue from deploy day; lab runs tagged; viewer IP everywhere | A request from Sachin's phone shows his carrier's prefix and country in `request_access`; the Day review stops counting lab runs |
| **V2 — who and what** | 6, 8 | Visitors, Timeline, Live, Review, Sessions & IPs, Actions | "Yesterday → Visitors → a person → Timeline → Reveal IP" in three clicks; `noPersonalFields` green; an audit row per reveal |
| **V3 — later** | — | CloudFront access logs to S3 only if a non-API asset path matters; geo beyond country; UA-based bot flagging; alerts (a new country for a user, >N failures from one prefix) | separate plan |

---

## 9. One recommendation

**Write one access row per request from the middleware the server already has, keyed by the request id, with the IP
sealed and a plain prefix beside it; give the admin one range control and one timeline that unions the six tables.**

- Why this: the server already intercepts every request (`pageTimingMiddleware`) and already has the sealing, sweep and
  admin-reveal patterns; the admin already has the per-day and per-trace queries. The new work is one table, one cookie,
  one range parser, and four pages. No new AWS service, no log pipeline to run, no engine change.
- Why not CloudFront/S3 access logs: they arrive minutes late, hold no user id, need Athena or a loader to query, and
  cannot be joined to a reading. They remain a V3 option for static-asset traffic only.
- Why not add IP to `page_execution_logs`: that table is deliberately PII-free and widely read; a sibling table keeps the
  seal and the sweep on one column and the existing page stays as it is.

| Option | Verdict |
|---|---|
| `request_access` sibling table from the existing middleware (chosen) | One write, sealed IP, joins to everything by `request_id`; ready for a timeline |
| CloudFront standard logs → S3 → Athena | No user id, minutes late, new query path; keep for V3 static traffic |
| Add `ip` to `page_execution_logs` | Breaks the "never PII" table and its tests; filters hit the PII guard |
| Third-party analytics (Plausible, PostHog) | Sends visitor data off-site; privacy plan (docs/privacy/01) rules it out |
| Keep rolling windows, add only a date picker to Queries | Does not answer "who visited yesterday"; still no IP, no timeline |

---

## 10. Revision 2026-11-08 (Sachin, same day): consolidate, panelise, and split List from Dashboard

Sachin's additions while this plan was being written:

> There's a Techniques section and a Machinery dashboard, and Clarify monitor, Research Lab — can these be consolidated?
> We want professional dashboards that use all of the viewport space to lay out info and forms into PANELS, a slick
> interface focused on digesting the data presented and running tests. On Users, Activity, Security — management
> should have a separate TAB dashboard with charts and graphs over a date range: list views, and a dashboard view
> showing cost spend, logins / DAU / MAU, queries run in aggregate, execution times.

### 10.1 Information architecture — three workspaces, each with a Dashboard tab and list tabs

| Header section | Tabs (left → right) | What merges into it |
|---|---|---|
| **Overview** | one page: the command centre — the three workspace dashboards' headline tiles and *Running now* + *Live* | today's Overview |
| **People** | **Dashboard** · Users · Visitors · Activity · Security · Actions | Activity's tiles move to Dashboard; Activity keeps *Active in range*, *Active sessions*, *Live*; Security keeps its event list; Actions is the staff audit |
| **Usage** | **Dashboard** · Review · Queries · Agents · Page times | Day review → Review (range + group-by, §4.4); Overview's 24 h / 7 d stats move to Dashboard |
| **Engine** | Techniques · **Lab** · Quality | Machinery becomes two tabs *inside* Techniques (Catalogue · Pieces & recipes · Illustrations); Research Lab folds into Lab as a *Subject source* (Accounts with a chart · Synthetic subjects), one run surface; Clarify monitor becomes the **Quality** tab beside technique accuracy and review verdicts |

Routes stay stable (`/machinery`, `/research-lab`, `/clarify-monitor` redirect into the tab they became), so nothing
bookmarked breaks. The header drop-downs list the tabs, so a section opens straight on a tab.

### 10.2 The Dashboard tabs — charts over the header range

All three read the header RangeBar (§4.4) and compare to the previous period of equal length (small Δ% under each tile).

**People › Dashboard**
- Tiles: DAU (today), WAU, MAU, new sign-ups, sign-ins, anonymous visitors, countries, paid accounts.
- Charts: active people per day (DAU line, 7-day WAU and 30-day MAU rolling lines); sign-ins and sign-ups per day
  (stacked bars); visitors by country (horizontal bars, top 10); plan mix (free / plus / unlimited, stacked area);
  quota used vs limit distribution (histogram); sign-in failures and Turnstile blocks per day (bars) from Security.
- Sources: `user_activity_days`, `auth`, `account_events`, `request_access` (country, visitors), `billing_accounts`,
  `question_usage`. MAU before 2026-11-05 is hatched (no history, doc 04 G1).

**Usage › Dashboard**
- Tiles: questions, people asking, failed %, cost, cost per question, p50 and p95 total time, p50 TTFT, tokens
  in / cached / out / thought, cache hit %.
- Charts: questions per day by category (stacked bars); cost per day by model (stacked bars) and by agent (top 8);
  execution time per day (p50 / p95 lines) and TTFT; agent runs per day by type (code / engine_pull / model);
  failure rate per day; board builds per day (Self / Love / Work / Lucky); page response p95 per day for the top 6 routes.
- Sources: `reading_traces`, `reading_agent_spans`, `agent_runs` (`source = 'app'`), `area_builds`, `page_execution_logs`.

**Engine** has no separate Dashboard tab: Techniques' catalogue header carries its run / failure / accuracy tiles for the
range, and Quality carries the Clarify rubric tiles.

### 10.3 Panel layout rules (every page)

- One viewport: `h-[calc(100vh-header)]`, a CSS grid of **panels**, each `min-h-0 overflow-auto`; the page itself does
  not scroll at ≥1280 px (the Techniques Lab rebuild of 2026-11-08 is the reference implementation). Below 1024 px panels
  stack and the page scrolls.
- A page is: a **top strip** (range, filters as chips, primary actions), a **panel grid** (2–4 panels, each with its
  own title, count, refresh time and actions), and optional **right rail** (collapsible, remembered in `localStorage`)
  for the detail of the selected row — so a list and its detail are on one screen (Queries → Query, Users → User,
  Visitors → Timeline all open in the rail first; a *Open full page* link keeps the deep URL).
- Dense tables: 13 px, zebra, sticky header, virtualised past 200 rows, column sort, a column picker, and CSV export of
  the visible rows (admin-side, masked values only).
- Charts: one `charts/` module — `TimeSeries` (lines, p50/p95 bands), `StackedBars`, `HBars`, `Histogram`, `Sparkline`
  — built on **uPlot** (≈45 KB, canvas, fast at 90 days × 24 h) for time series and the existing inline-SVG bars for the
  rest; one palette (slate for neutral, one hue per category: Self, Love, Work, Lucky, General); light and dark
  (`prefers-color-scheme`); every chart has a tooltip, a legend that toggles series, and a *click → filter* contract
  (clicking a bar sets the chip that filters the panels beside it).
- States: skeleton 400 ms in; empty "Nothing in this range"; error with Retry inside the panel, never a blank page.
- Words: short labels, units on axes, no engine names, no question text.

### 10.4 Changes to §3 and §7

Deliverable adds: `web/src/components/charts/*` (uPlot wrapper), `Panel`, `PanelGrid`, `RightRail`, `DataTable`
(sort, column picker, CSV), the three Dashboard pages and their admin API aggregates
(`GET /dash/people`, `GET /dash/usage`: one request each returning every series for the range, ≤ 92 × 24 points per
series, cached 60 s per range key in the Lambda), the Techniques → tabs merge, the Lab subject-source switch, Quality.

Steps add, after step 7: **7a** `Panel`/`PanelGrid`/`RightRail`/`DataTable`/charts module with stories in tests;
**7b** `GET /dash/people` and `/dash/usage`; **7c** the two Dashboard tabs; **7d** Engine consolidation (Techniques
tabs, Lab subject source, Quality) with redirects. Phases: 7a–7c join **V2**; 7d is **V2.5** (no server change).

Recommendation stands (§9), with one addition: **a single chart library (uPlot) and a single panel system**, because
twelve pages each drawing their own bars is what made the current admin feel like a list of reports rather than a
dashboard.

---

## 11. Revision 2026-11-08 (Sachin): the Engine workspace — a blue-sky research harness for the engine, shown to Y Combinator

Sachin:

> We need to present this dashboard to Y Combinator for the application, so it needs to be fully comprehensive. The
> Techniques Lab, Techniques, Machinery, Research Lab, Clarify monitor need to be fully capable of running tests on the
> astrological engine. Agents need to be included: what types of agents there are per dashboard and per general reading,
> their execution plan, and which techniques they use or are part of. Denote sub-techniques — the "reusable" parts — and
> show what data gets cached for them, what they pull new, and what chunks of data / views they run off that can be
> cached for the LLM.
>
> There's no shortage of execution time — we need the most blue-sky interface and harness for research, doing runs and
> staging.

**Scope rule from that last line:** build time is not the constraint. Where this section offers a lighter and a fuller
form, the fuller one is the plan. The bar is blue sky: design for where the product is going, not where it is. A research harness a senior ML / evals engineer would recognise as serious:
versioned suites, reproducible runs, regression diffs, provenance from every output line back to the rows and rules that
produced it, and cost known before a run starts.

### 11.1 Start — what is already recorded (checked 2026-11-08) and what no page shows

| Question a reviewer asks | Where the answer already lives | Shown today? |
|---|---|---|
| Which agents exist, of what kind, on which model and price | `agent_registry` (id, title, kind code / engine_pull / model, module, sub_module, provider, model, prices) | Agents › Registry, as a flat table |
| Which techniques an agent serves, and the reverse | `technique_registry.agents`, `.contract`, `src/techniques/catalog.ts` | Technique detail lists agents; no agent → techniques view |
| The execution plan of a board or a general reading | code only: `src/reading/graph.ts` (intake → prepare → specialists in parallel → reconcile → synthesize), `src/reading/area/*Service.ts`, `src/reading/self/oracle.ts` (family sub-agents → lineman → oracle) | Machinery has static Mermaid pictures; the Query page shows the plan *as it ran* for one reading |
| Reusable pieces (reader, prompt, output, agent), recipe families, freshness, scope | `src/techniques/pieces.ts` (106 pieces, 45 shared, 84 families; freshness natal…question; scope kundli / question) | Machinery counts and pictures, not per-piece usage |
| What is cached per technique for a kundli, until when, how often reused | `technique_outputs` (cache_key, freshness, valid_from / valid_to, made_by_agent, made_ms, hit_count, last_hit_at) | **nowhere** |
| Reader caches | `reading_findings_cache` (reader_id, pack_hash, horizon_key, prompt_version, expires_at, hit_count) | **nowhere** |
| LLM prompt caches (the chart prefix held at the provider) | `llm_cache_entries` (M8: provider, kundli, prefix_hash, model, created / last used / expires / deleted) and `cached_tokens` on every span and agent run | cached tokens as a number in Queries / Agents; the caches themselves **nowhere** |
| Did a run pull new data or reuse | `agent_runs.status` `ok | cached | skipped`, `charts_used`; engine pulls are agents of kind `engine_pull` | Day review counts runs; no reused-vs-new split |
| The dossier a board build ran off | `reading_dossiers` (M40: techniques, rules, data, yogas, clocks, panels, gaps, audit, oracle, bundle_hash) | Techniques Lab, one build at a time |
| Is the engine right | `technique_reviews`, `technique_decision_logs`, `benchmark_charts` / `benchmark_events` (M36), the Clarify rubric, the Research Lab verifier | spread over four pages; the Research Lab verdicts are **template text** (admin TODOS P1) |

The data for a complete engine story exists; it is scattered over five pages and three are thin. The work is reads,
layout, a declared execution plan per flow, and a real test-suite system.

### 11.2 End goal — Engine, six tabs

**Engine › Map** — the execution plan, live
- Left list of **flows**: General reading, Clarify, Self board, Love board, Work board, Lucky times, Digest build.
- Centre: the flow's plan as a DAG (stages left → right, parallel agents stacked). Each node: kind badge (code / engine
  pull / model), model, and for the header range its runs, p50 / p95, failure %, cost, **reuse %** (cached + skipped ÷
  runs). Edges carry what passes between stages (reader pieces → agent → output piece).
- Node click → right rail: the agent's techniques, reader pieces consumed, prompt piece (title and version; the text
  for superadmin), output schema, output freshness, last 20 runs → Query / Lab.
- **Overlay a single run**: pick a Query or Lab run and the DAG lights up with that run's actual timing and status per
  node (planned vs as-ran), so a reviewer sees the same picture as the Query timeline in the shape of the plan.
- The plan is **declared in code** (`FlowPlan` beside each flow) and registered at boot (`flow_registry`); a test fails
  when a stage runs an agent its plan does not list, so the map cannot drift.

**Engine › Techniques** (Techniques + Machinery merged)
- Inner tabs: **Catalogue** (today's list plus *Pieces*, *Family*, *Freshness*, *Scope*, *Reuse %*, *Cached outputs
  live*), **Pieces** — the reusable sub-techniques: kind, used by N techniques, freshness, and for readers the digest
  sections and filters; **Families** (84 recipe families side by side); **Illustrations** (today's Machinery pages).
- Technique detail: recipe as piece chips, agents, contract (charts / rows read), validity rule, runs, review verdicts,
  accuracy evidence, and **its cache** — live `technique_outputs` rows (subject masked, valid_from → valid_to, made by,
  made ms, hit count, last hit) and a *Invalidate for this subject* action (superadmin, audited).

**Engine › Cache** — the three layers and the engine pulls
1. **Technique outputs:** rows live / expired, hit rate, reuse per row, by freshness and technique; made-new vs reused
   per day (stacked bars).
2. **Reader findings:** `reading_findings_cache` rows, hits, expiry, by reader and prompt version.
3. **LLM prompt caches:** `llm_cache_entries` live / expired / deleted by model; cached-token share of prompt tokens per
   day; estimated saving = cached tokens × (price_in − price_cached) from `agent_registry`.
4. **Engine pulls:** `engine_pull` runs per day, ms p50 / p95, and data types pulled live at request time (the Work
   board's live `transit_contacts` pull, server TODOS 2026-11-07, shows red until the digest sweep stores it).
5. **Data views:** the stored "chunks" techniques run off — digest sections (`house`, `planet`, `yoga`, `point`,
   `star`, `annual`), `kundli_activation`, the shared sky, day tables, dossier bundles (`bundle_hash`) — each with row
   counts per subject, last build, which techniques read it, and whether it is part of an LLM prefix.

**Engine › Lab** — the harness (Techniques Lab + Research Lab merged; the one-viewport layout of 2026-11-08)
- **Subject source** in the top strip: *Accounts with a chart* (QA mode) · *Synthetic subjects* (the 20 research
  charts and custom ones, hydrated by the server) · *Benchmark charts* (`benchmark_charts` with dated life events) ·
  *Scenario specs* (docs/reading-engine/scenarios, once hydration takes chart specs — server TODOS P2).
- **Run modes:** one technique · one board · a **suite**.
- **Suites:** a versioned set of cases (subject × board or technique × as-of) with expectations: a benchmark event
  window, a staff verdict, a tone, a claim that must / must not appear, a rule that must fire. Suites are versioned;
  a run pins the suite version, the server git SHA, the digest version, the catalogue version and the model ids, so a
  run can be reproduced and two runs compared fairly.
- **Results grid:** cases × techniques, cells pass / fail / no-evidence / error, with filters; a cell opens the case.
- **Regression diff:** any two runs of a suite side by side — cells that changed colour, claims added / removed per
  panel, rules that moved, cost and time deltas. "Promote as baseline" marks the run future runs are compared with.
- **Provenance per output line:** every line of a board or reading links to the rules it came from, the digest rows it
  cited, the agent and stage that wrote it, and the LLM prefix it was written under (prefix hash, cached tokens).
- **Data panel per run:** rows read, rows reused from cache, rows pulled new, engine calls made, LLM calls and cached
  share — the same five layers as the Cache tab, for this one run.
- **Cost before a run:** the suite run shows the planned model calls and an estimated spend from `agent_registry` prices
  and asks for a yes when it is above $0 (rule: no paid API calls without a yes); code-only suites run free.
- **Staging:** synthetic and benchmark subjects live in the `research_*` tables, never `auth` / `kundlis`; the Lab runs
  them through the server's real pipeline (`/api/research/*`, `/api/admin-lab/*`); the admin-side template synthesis
  (`researchLab.ts` `synthesizeAdminResearchRun`) is removed.
- **Scheduled runs:** a suite can be set to run nightly and after each server deploy (the deploy session triggers it);
  a failing cell files a row in the Quality tab.

**Engine › Agents** (moved here from Usage; Usage keeps the speed table)
- Agent catalogue grouped **per flow and per dashboard** (General reading, Clarify, Self, Love, Work, Lucky, Digest):
  type, model, prompt piece, techniques it serves, which flows' plans include it, and its range stats. The reverse view:
  per technique, its agents in plan order.

**Engine › Quality** (Clarify monitor + accuracy)
- Clarify rubric beside technique accuracy (review verdicts, benchmark hit rate), suite pass rate over time, open
  regressions, the verifier agent's scores (server-run, not template). Each cell drills into the Lab run or Query.

### 11.3 The Y Combinator demo path (3 minutes)

1. **Overview** — headline numbers across People, Usage, Engine.
2. **Engine › Map › General reading** — the plan, then overlay one real reading: planned vs as-ran.
3. **Engine › Cache** — reuse of technique outputs, share of prompt tokens served from cache, money saved this week.
4. **Engine › Lab** — run *Benchmark: known life events*; the grid fills; open a case → provenance from a line of the
   reading back to the rows and rules; open the regression diff against last night's baseline.
5. **Usage › Dashboard** — questions, cost and latency over 30 days.

**Demo mode** (`?demo=1`, superadmin toggle): persons become *Subject 1…n*, emails and birth data hidden, QA mode off,
no engine vendor names, no question text. Screens are checked against `noPersonalFields.test.ts` in demo mode.

### 11.4 Deliverable additions

Server:

| Item | Why |
|---|---|
| `FlowPlan` per flow + `flow_registry` at boot (id, title, stages, agents, edges, code_ref) + drift test | Map draws from it; the test keeps it true |
| `agent_runs.reuse` (`new | technique_cache | findings_cache | skipped`) and `agent_runs.pulled` (data types fetched live) | reused-vs-new per run without inference |
| `reading_agent_spans.prefix_hash` | joins a model call to its `llm_cache_entries` row |
| Line provenance in `reading_dossiers` (line id → rule ids, digest row keys, agent, stage, prefix hash) | the Lab's provenance view |
| `run_manifest` on every Lab / suite run (git SHA, digest version, catalogue version, model ids, suite version) | reproducibility |
| `research_*` hydration from chart specs; benchmark routes through `ADMIN_LAB_TOKEN` | all subject sources in one Lab |

Admin (M42, admin-owned): `test_suites`, `test_suite_versions`, `test_cases`, `test_runs`, `test_results`,
`test_baselines`. API: `GET /engine/flows`, `GET /engine/flows/:id` (plan + range stats; `?overlay=<runId>`),
`GET /engine/agents`, `GET /engine/pieces`, `GET /engine/families`,
`GET /engine/cache/{outputs,findings,llm,pulls,views}`, `POST /engine/cache/outputs/invalidate` (superadmin, audited),
`GET/POST /engine/suites`, `POST /engine/suites/:id/estimate`, `POST /engine/suites/:id/run`,
`GET /engine/suite-runs/:id`, `GET /engine/suite-runs/:a/diff/:b`, `POST /engine/suite-runs/:id/baseline`. Suite runs
execute on the server in the background (async invoke, as the digest sweep), 50 cases per run, progress polled every
3 s, a per-day cap (`LAB_DAILY_CAP`), and are cancellable.

### 11.5 Steps and phases (added to §7–§8)

- **E1 (admin only, no server change):** Engine tabs and redirects; Techniques ⊕ Machinery (Catalogue / Pieces /
  Families / Illustrations from the data `machinery.ts` already mirrors); Cache tab over the three existing cache
  tables; Agents per flow from `agent_registry` + `technique_registry.agents`; Quality = Clarify monitor + review
  verdicts. Check: every old URL lands on its tab; Cache numbers equal a hand `SELECT` on staging.
- **E2 (server):** `FlowPlan` + `flow_registry` + drift test; `agent_runs.reuse` / `pulled`; `prefix_hash`; then Map
  with run overlay. Check: the General-reading DAG matches a live Query's spans node for node.
- **E3 (server + admin):** suites (M42), run manifest, background suite runner, estimate-then-run, regression diff,
  baselines, research and benchmark subjects through the server, template synthesis removed. Check: the benchmark
  suite runs end to end on staging; a second run with no code change diffs to "no change".
- **E4:** line provenance in dossiers and the provenance view; data-views panel; scheduled nightly and post-deploy
  runs; demo mode. Check: a line on Sachin's Self board traces to its rows and rules; demo mode passes the
  no-personal-fields test.
- Order with the rest: V0 ‖ E1 → V1 ‖ E2 → V2 ‖ E3 → E4. E1 and V0 are both admin-only and touch different files
  (Engine pages vs RangeBar and list pages), so they run as two parallel sessions.

Recommendation: **declare each flow's plan in code and draw the Map from it; show the cache layers that already exist
before adding any caching; make suites versioned and runs reproducible from day one.** A reviewer's first questions are
"what does the system actually do, what does it cost, and how do you know it is right" — the plan, the reuse rate and the
suite grid with its regression diff answer all three from real rows.

---

## 12. Revision 2026-11-08 (Sachin): blue sky, paced for 10k–100k users and many kinds of research at once

Sachin: "blue sky interface with future pacing to support 10k–100k users and many types of research happening on these
dashboards, with the ability to drill down into techniques, runs, various research labs."

### 12.1 What changes at 10k–100k users (sized, not guessed)

| Stream | Today | At 100k users (assume 20 % DAU, 30 requests and 1.5 questions per active user per day) |
|---|---|---|
| `request_access` rows | ~30 / day | ~600 k / day, ~220 M / year before sweeps |
| `page_execution_logs` | ~30 / day | ~600 k / day |
| `reading_traces` | ~1 / day | ~30 k / day; spans ×10 → 300 k / day |
| `agent_runs` (boards, techniques) | ~200 / day | ~2–4 M / day (110 techniques × board opens, mostly cache hits) |
| Admin dashboards | live SQL over raw rows, 5 s timeout | raw scans over 30–90 days no longer fit 5 s |

So the design rule from here on: **dashboards never aggregate raw event rows at read time; they read rollups.**

### 12.2 Data architecture for the admin

1. **Rollups, written as data arrives.** `stats_hourly` and `stats_daily` tables keyed by (bucket, dimension set):
   requests by route / country / device; active people; questions by category / subject; agent runs by agent / technique
   / reuse; cost by model; latency sketches (t-digest bytes, so p50 / p95 / p99 merge across hours). A 5-minute sweep
   (EventBridge → the server Lambda, as the cache sweep) folds the last window; late rows re-fold their hour. Every
   dashboard tile and chart reads rollups: a 90-day chart is ≤ 2,160 rows.
2. **Partitioned raw tables.** `request_access`, `page_execution_logs`, `reading_agent_spans`, `agent_runs` become
   monthly-partitioned (Postgres declarative partitioning); sweeps drop partitions instead of deleting rows.
3. **Drill-down reads raw, always bounded.** A click from a chart to its rows reads raw rows for that bucket only,
   keyset-paged (200 per page), by indexed columns. The timeline is per person or visitor, so it stays small.
4. **Read replica.** At ~10k users, the admin API reads from a Render read replica (`ADMIN_DATABASE_URL`), so research
   queries never slow the customer path. At ~50k+, raw event history older than 30 days is exported nightly to Parquet
   in S3 and queried through Athena for deep research (the admin shows a "historic" badge and runs it async).
5. **Live.** The Live feed and Running now move from 10 s polling to server-sent events from the admin API, fed by
   Postgres `LISTEN/NOTIFY` on new access and trace rows (sampled to ≤ 20 events / s on screen).

### 12.3 Many kinds of research at once — Research workspaces

At scale several people run different studies (a technique's accuracy, a new prompt, a dasha rule, latency work). The
Engine Lab grows into **workspaces**:

- A **workspace** = a named study with its owner, question, subjects (a cohort), suites, runs, notes and findings. Kinds:
  *Technique accuracy*, *Prompt / model A–B*, *Rule change*, *Benchmark events*, *Latency & cost*, *Clarify quality*,
  *Free study*.
- **Cohorts**: saved subject sets — synthetic, benchmark, scenario specs, and (consented, research-flagged) real
  accounts filtered by chart features the engine already stores (e.g. "Saturn MD running", "7th lord in 8th"), resolved
  by the server, never in Node.
- **Experiments**: one change (prompt version, model, rule flag, catalogue version) run against a cohort as A vs B, with
  the regression diff and cost; results attach to the workspace.
- **Findings**: a note that pins cells, runs and lines of provenance; a finding can be filed straight to `docs/TODOS.md`
  style tracking (admin `findings` table, exported).
- **Queue and quotas**: runs go through a job queue (SQS → the server's research worker), with per-workspace concurrency
  (default 2), per-day spend caps, priorities, and cancellation; the UI shows queue position and ETA.
- **Permissions**: staff roles gain *researcher* (workspaces, read-only on People) beside admin and superadmin; every
  workspace action is audited.

### 12.4 Interface — blue sky

- **Command palette** (Ctrl K): jump to any person, visitor, query, run, technique, agent, workspace by id or name.
- **Everything is a link, every panel a filter**: clicking a chart segment filters sibling panels; breadcrumbs keep the
  path (Usage › Dashboard › Love › technique love.reading.partner › run 9f2…); URLs carry it all, so any view is shareable.
- **Saved views and pinned panels**: a staff member pins panels from any page into their own Overview.
- **Compare anywhere**: pick two of anything of the same type (runs, ranges, techniques, models) → side-by-side diff.
- **Density and theme**: compact / comfortable, light / dark; keyboard navigation on every table.
- **Performance budgets**: first panel paints < 1 s on rollups, drill-down tables < 1.5 s, Live latency < 3 s.

### 12.5 Phases added

- **S1 (with V1):** partition the new raw tables from day one; `stats_hourly` / `stats_daily` and the 5-minute folder;
  dashboards read rollups. Check: a 90-day chart reads ≤ 2,200 rows; `EXPLAIN` shows partition pruning.
- **S2 (with E3):** research workspaces, cohorts, experiments, the queue and per-workspace caps, *researcher* role.
- **S3 (at ~10k users):** read replica for the admin; SSE live feed; command palette, saved views, compare-anywhere.
- **S4 (at ~50k users):** Parquet / Athena history; async historic queries.

Recommendation: **rollups now, partitions now, replica and Athena when the numbers say so.** Building rollups and
partitions while the tables are empty costs a few days; retrofitting them at 50k users means rewriting every dashboard
query under load.
