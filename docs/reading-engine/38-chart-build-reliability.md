# 38 — Chart build reliability: 429s, DB pool, Lambda freeze, dossier before chat

Status: Phases 1 and 2 code written 2026-11-01, not deployed; Phase 0 infra not applied. Written to the template in
`AGENTS.md` ("How a plan is written"). Where the build differs from this plan, §10 "As built" wins.
Owner: dev session (server and web), deploy session (Phase 0 infra), Radha session (Phase 3).

The four problems are one problem: **the chart build has no single owner.** It runs in whichever process happens to be
alive (the login request, the `me` query, the ask-stream precondition, a worker invocation, an in-process fallback),
with different concurrency in each, no retry on 429, a DB pool sized for none of them, and chat gated on a different
"ready" than the reading engine needs. The fix gives the build one owner (the worker invocation), one Radha client with
one limiter, one readiness state the API exposes, and a web screen that shows that state.

---

## 1. Start: the system today (facts checked in code on 2026-11-01)

### 1.1 Where a chart build can run

| Trigger | Code | Concurrency to Radha | Awaited? | Deadline |
|---|---|---|---|---|
| `completeProfile` / `updateProfile` on Lambda | `profileService.ts:105-110, 262-267` → `ensureUserGateReady(db,userId,true)` | **8** (gate+rest) + 5 for up to 4 other users' rows | yes, inside the HTTP request | 20 s (own row), 12 s (others) |
| `completeProfile` after that | `scheduleKundliSync` → async self-invoke, else `processKundliSyncQueue` **not awaited** | 1 (`KUNDLI_QUEUE_MAX_FETCHES_PER_USER`) | no (fallback) | none |
| `me` query | `schema.ts:439-442` → `void ensureUserGateReady(db,userId,true)` | 8 | **no** | 20 s |
| `ask-stream` precondition | `askChatTurn.ts:58` → `ensureUserGateReady(db,userId,true)` | 8 | yes | 20 s |
| Worker invocation (`POST /events`) | `kundliSyncWorker.runKundliSync` → `processOneKundliRow` | 1 | yes | 12 min |
| 15-minute sweep | `runKundliSyncSweep` | 1 | yes | 12 min |

Every one of these calls `ensureChartData` → `pool(toFetch, concurrency, …)` → `fetchEngineExport`.

### 1.2 Problem 1: 429 from Radha

- Radha (`AIAstra_Radha/src/jhora/export.py:313-327`, `api.py:380-401`) allows **one export per second per client id**.
  The client id is `X-Forwarded-For` or `request.client.host`; a request carrying a valid API key (`PYJHORA_API_KEY` /
  `PYJHORA_API_KEYS` on the pyjhora Lambda) **skips the throttle** (`api.py:381`). All exports in one Radha container
  also run under `_export_global_lock` (serial).
- The Node client (`astroKundliClient.ts`) has a per-process serial throttle with a 1.1 s floor
  (`withHoroscopeExportThrottle`), but `fetchHoroscopeChart` and `fetchEngineExport` **bypass it** on the Lambda transport
  whenever coordinates are known (`:663-671`, `:683-686`). So the gate pull runs 8 Radha calls at once.
- Commit `a6cb60a` worked around the resulting 429s by **randomising `sourceIp`** in the APIGW event (`:136`), so Radha
  sees a different client on every call. It is a spoof of Radha's own limiter, and it only works because the Lambda
  event path lets the caller choose its IP.
- `fetchHoroscopeChartImpl` has **no retry**: a 429 throws, `ensureChartData` stores the row as `failed`, and
  `FAILED_RETRY_MS` was dropped from 5 min to **1 s** (`store.ts:94`) so the next pass re-fetches it. Each 429 is a
  wasted Radha invocation, a wasted DB write, and a log line.
- Symptom to the user: items missing after the gate run; "Generating your birth chart…" shown longer; occasionally a
  reading with a caveat because a varga was `failed` at read time.

### 1.3 Problem 2: Prisma pool / `connection_limit`

- `src/lib/prisma.ts` rewrites `DATABASE_URL` to **`connection_limit=5`, `pool_timeout=30`** regardless of what the
  URL says. The DB is Render Postgres behind its pooler on `:6432` (memory: original URL had `connection_limit=1`).
- One request can hold up to **8 fetch workers**, each doing `claim` (raw INSERT … ON CONFLICT), `complete` (upsert), and
  per item a fire-and-forget `kundli.update` for coordinates (`store.ts:672`) and a legacy write-through
  (`store.ts:254`). With 5 connections and 8 workers, 3 wait on the pool; under load `pool_timeout` (30 s) exceeds the
  20 s gate deadline, so the request can end with items neither fetched nor failed.
- N concurrent Lambda containers × 5 = 5N pooler connections, uncapped: the API Lambda has no reserved concurrency in
  the inventory (`aiastra-aws-infra` memory; **to confirm**, AWS creds expired during this session).
- Nothing tells Prisma the host is pgbouncer (`pgbouncer=true`), so prepared statements can fail on transaction pooling.
- Symptom: `Timed out fetching a new connection from the connection pool` in logs; slow `me`; partial gate runs.

### 1.4 Problem 3: work frozen with the Lambda container

Lambda freezes a container once the response is sent. Everything started with `void` or an un-awaited call in the
request path may never finish:

- `kundliQueueService.ts:459-462`: `void ensureGeminiCacheForUser`, `scheduleFactsBuild` (fire-and-forget) after
  completion — **the dossier build**.
- `schema.ts:441`: `void ensureUserGateReady(db, userId, true)` in `me`.
- `store.ts:254, 672`: `void repo.complete` (legacy write-through), `void prisma.kundli.update` (coords).
- `kundliSyncWorker.ts:113`: in-process fallback `void processKundliSyncQueue` when the self-invoke fails.
- Commit `8a6d4fc` answered this by pulling **synchronously inside `completeProfile`** for up to 20 s. That makes the
  signup HTTP call 20 s long and still leaves the rest (≈100 items) and the dossier to a frozen process.

The design that fixes this exists in code (doc 31: async self-invoke `kundli-sync` event, lease, budget, sweep) but its
infra (§5 of doc 31: Lambda timeout 900 s, IAM `lambda:InvokeFunction` on itself, EventBridge `kundli-sync-sweep`,
`KUNDLI_SYNC_EVENT_TOKEN`) is **not confirmed applied**. Memory says the API Lambda timeout is 300 s. If the invoke
fails, `kundli_sync_invoke_failed` is logged and the fallback runs un-awaited: today's behaviour.

### 1.5 Problem 4: dossier missing when chat starts

- Chat is gated on `auth.kundli_added`, which flips when the **ten legacy columns** are filled
  (`kundliQueueService.ts:446-457`). The reading engine needs `kundli_facts` (the dossier, `FACTS_VERSION`) and the
  transit snapshot (`reading/data/store.ts:124-139`); without it `runReading` throws `ReadingUnavailableError('dossier_missing')`.
- The dossier build is scheduled after completion (frozen, 1.4) and Radha **does not serve `facts` yet** (TODOS P0; on
  Radha `feature/reading-p1`), so `facts_status` ends `failed` with `unsupported=true`.
- Commit `a6cb60a` made chat fall back to the legacy prompt whenever `AWS_LAMBDA_FUNCTION_NAME` is set
  (`chatLlmService.ts:73`), hiding the state rather than exposing it.
- Web: `BirthDetails.tsx` shows "Generating your birth chart…" and polls `me.kundli_status` every 3 s;
  `ChatSection.tsx:130-157` polls `fetchUserDetails` every 3 s and opens chat when `kundli_added && queue_status ===
  'completed'`; `KundliNotice.tsx` shows a fixed "about 30 minutes" text until `kundli_status === 'ready'`.
- Symptom: a user types a question, the answer comes from the legacy path with no chart tables, and nothing on screen
  says why.

---

## 2. End goal

- A new user saves birth details and sees one progress screen: **"Preparing your chart"** with a real count and stage.
  Chat opens as soon as the chat gate is ready (target **≤ 60 s** after save with Radha at 4 concurrent calls; ≤ 2 min
  at 1 per second), and the full chart keeps building in the background (**≤ 3 min**, resumable).
- The build finishes whether or not the user stays logged in. No work depends on a request staying open.
- Radha never returns 429 to us in normal operation; when it does, the call is retried after the interval Radha names,
  and the row is never marked `failed` for a 429.
- The DB pool is sized to the work: no `pool_timeout` errors at 5 simultaneous sign-ups.
- Chat never silently answers without the chart. If the dossier is not ready, the screen says so, the answer carries a
  visible "preparing" note, and the API reports which mode answered.
- A failed build shows a **Retry** button that works.

---

## 3. Deliverable

**Server (`AIAstra_Server`)**

- `src/lib/astroKundliClient.ts`: one limiter (`radhaLimiter`) for every Radha call: ≤ `RADHA_MAX_CONCURRENT` (default
  4) in flight per process, ≥ `ASTROKUNDLI_REQUEST_SPACING_MS` between starts, 429/503 retry with Radha's
  `Retry after about N seconds` or exponential backoff (1 s, 2 s, 4 s, ±20 % jitter, 3 attempts). API key sent on every
  call. `sourceIp` is a **fixed** label per process (`10.0.<instance>` derived from the Lambda log stream), not random.
  The bypass branches in `fetchHoroscopeChart` / `fetchEngineExport` are deleted.
- `src/reading/chartData/store.ts`: 429 inside the fetcher is retried by the limiter and never reaches `complete()`;
  `FAILED_RETRY_MS` back to 60 s; legacy write-through and coords update awaited (batched once per `ensureChartData`
  call, not per item).
- `src/lib/prisma.ts`: pool size = `CHART_DATA_FETCH_CONCURRENCY + 2` (default **6**), `pool_timeout=20`,
  `pgbouncer=true` added when the host port is 6432, and the URL's own `connection_limit` is honoured when it is ≥ that.
- `src/services/kundliQueueService.ts`: `processOneKundliRow` has one `concurrency` (from env, default 4) and, inside a
  worker run, **awaits** the dossier build and Gemini cache after the gate, before `kundli_added` flips when
  `READING_ENGINE` is on. `ensureUserGateReady` becomes **read-only** (it reports; it never pulls).
- `src/services/kundliSyncWorker.ts`: on Lambda, when the self-invoke fails, the fallback is a **gate-only, awaited**
  run with a 15 s deadline (the only synchronous pull left), logged as `kundli_sync_fallback_sync`.
- `src/services/profileService.ts`, `src/graphql/schema.ts`, `src/services/askChatTurn.ts`: no synchronous pull in the
  request path; `me` reads state; ask returns **409 `chart_not_ready`** with the state.
- `src/services/chartStatusService.ts` (new): `getChartStatus(prisma, userId)` → the state in §5.2, one query.
- `src/graphql/schema.ts`: `me.chart: ChartStatus!`, `retryChartBuild: ChartStatus!`.
- `src/services/chatLlmService.ts`: legacy fallback decided by `facts_status` (`unsupported` → legacy with an `info`
  event `reason: 'legacy_mode'`); the `AWS_LAMBDA_FUNCTION_NAME` condition is removed.
- Tests: `tests/unit/lib/radhaLimiter.test.ts`, `tests/unit/reading/chartStatus.test.ts`, updates to
  `backgroundChartPull.test.ts`, `kundliQueue*.test.ts`.
- Docs: this file; `docs/TODOS.md` updated; doc 31 §5 marked with what was confirmed.

**Web (`AIAstra_WEB`)**

- `src/components/ChartProgress.tsx` (new): the one progress component used by `BirthDetails.tsx` and `ChatSection.tsx`.
- `src/Auth/api.ts`: `me.chart` in the `me` query; `retryChartBuild` mutation.
- `src/components/KundliNotice.tsx`: text from the state, not a fixed sentence.
- `ChatSection.tsx`: opens on `chart.status in ('chat_ready','ready')`; handles 409 from ask-stream; shows the
  `legacy_mode` info event as a banner.
- Tests for each; screenshots in `docs/screenshots/chart-progress/`.

**Infra (deploy session, Sachin's OK)**

- doc 31 §5 applied and confirmed: timeout 900 s, self-invoke IAM, EventBridge rule, token, async retries 0.
- `ASTROKUNDLI_API_KEY` on the API Lambda = one of `PYJHORA_API_KEYS` on the pyjhora Lambda.
- API Lambda reserved concurrency (recommend **20**) so 20 × 6 = 120 ≤ the pooler cap (confirm the Render plan's cap).
- `CHART_DATA_FETCH_CONCURRENCY=4`, `KUNDLI_QUEUE_MAX_FETCHES_PER_USER=4`.

**Radha (separate branch, Phase 3)**: `facts` export, already in progress (`feature/reading-p1`). Nothing here depends on it;
when it lands, `facts_status` becomes `ready` on the next sweep and legacy mode stops being used.

---

## 4. Exactly how it works when done

### 4.1 Backend

**Flow A — sign-up / profile save (request path, ≤ 1.5 s)**

1. `completeProfile` validates, writes `auth`, `enqueueKundliSync` (kundli row `pending`), then `scheduleKundliSync`:
   async self-invoke, awaited ≤ 2 s. Returns `{ success, message: 'Profile saved. Your chart is being prepared.' }`.
2. If the invoke fails on Lambda: run the **gate only**, awaited, concurrency 4, deadline 15 s, then return. Logged
   `kundli_sync_fallback_sync`. (Off Lambda: in-process queue as today; the process is not frozen.)
3. Nothing else runs after the response.

**Flow B — the worker invocation (`POST /events`, one per kundli, ≤ 12 min budget)**

1. Lease (`queue_started_at`, compare-and-set). Held → skip.
2. **Gate**: `fetchRegistrationItemsUntil(plan.gate)` at concurrency 4 through the limiter. 429 → retried inside the
   call (never a row write). Each item: claim → Radha → complete.
3. Legacy columns filled from gate items (one `kundli.update`).
4. **Dossier** (when `READING_ENGINE=1`): `buildFactsForKundli` awaited. Outcomes: `ready`; `unsupported` (Radha has no
   `facts`) → recorded, chat opens in legacy mode; `failed` → one retry after 5 s, then recorded, chat still opens
   (legacy) and the sweep retries later.
5. **Completion**: `kundli_added = true`, `queue_status = completed`, `queue_completed_at`. Gemini cache awaited
   (best effort, 10 s cap).
6. **Rest**: `fetchRegistrationItemsUntil(plan.rest)` at concurrency 4 until the budget; `more` → release lease and
   self re-invoke; the sweep catches anything left.
7. Every phase writes one log line: `chart_build {kundli_id, phase: gate|facts|rest, ready, failed, ms}`.

**Flow C — Radha client (every call)**

```
radhaLimiter.run(fn):
  wait for a slot (≤ RADHA_MAX_CONCURRENT in flight)         default 4
  wait until lastStart + spacing                                default 250 ms when API key set, 1100 ms when not
  attempt 1..3:
    call Radha (Lambda invoke or HTTP), headers X-API-Key + Authorization
    429 → delay = parse "Retry after about N seconds" ?? 1s·2^(attempt-1), ±20 % jitter; retry
    503 / FunctionError timeout → same backoff; retry
    4xx other / 200 → return
  after 3 attempts → throw (row becomes failed, FAILED_RETRY_MS 60 s)
```

The spacing floor stays at 1.1 s **only when no API key is configured** (Radha's unauthenticated limiter). With the key,
Radha skips its limiter and the only cap is our concurrency (one Radha container runs serially, Lambda scales
containers, so 4 in flight ≈ 4 containers).

**Flow D — DB pool**

- Pool per container = fetch concurrency + 2 = 6: 4 fetch workers each holding ≤ 1 connection during claim/complete,
  1 for the request's own reads, 1 spare. `pool_timeout=20` < any deadline.
- `pgbouncer=true` on `:6432` hosts.
- Containers capped by reserved concurrency (20) → ≤ 120 pooler connections.
- Per-item side writes (coords, legacy write-through) become one batched write per `ensureChartData` call, awaited.

**Flow E — readiness state (one query)**

```
status =
  no kundli row or birth details missing                → 'pending'
  gate rows ready < gate total                           → 'building'   (facts irrelevant yet)
  gate ready, facts in (building, pending) and engine on → 'building'   (stage 'facts')
  gate ready, facts ready | unsupported | failed         → 'chat_ready' (rest may continue)
  everything ready (rest too)                            → 'ready'
  last_sync_error set and no lease and not chat_ready    → 'failed'
```

Counts come from one `kundli_data` aggregate (`count(*) filter (where status='ready')` over the registration set) plus
`kundlis.facts_status`, `queue_started_at`, `last_sync_error`. No migration.

### 4.2 API

**GraphQL `me`** (addition; `kundli_status` kept, derived as `pending|building|ready` for old clients):

```graphql
type ChartStatus {
  status: String!          # pending | building | chat_ready | ready | failed
  stage: String            # gate | facts | rest | null
  gate_done: Int!  gate_total: Int!
  rest_done: Int!  rest_total: Int!
  facts_status: String!    # pending | building | ready | failed | unsupported
  reading_mode: String!    # full | legacy   (what chat will use right now)
  last_error: String       # user-safe sentence, never an engine name
  updated_at: String
}
type User { ... chart: ChartStatus! }
mutation { retryChartBuild: ChartStatus! }   # enqueue + schedule; 429-safe: no-op when a lease is held
```

**`POST /api/chat/ask-stream`**

- Precondition fails → **409** `{ error: 'chart_not_ready', chart: ChartStatus }` (was 400 with a sentence).
- Stream: when the reading engine answers in legacy mode, the first event is
  `{ type: 'info', reason: 'legacy_mode', chart: ChartStatus }` so the client can show a banner.
- No change to the rest of the stream.

**`POST /events`**: unchanged shapes (doc 31). One new outcome field in the log, `facts: ready|unsupported|failed`.

### 4.3 Frontend experience

**Birth details → progress** (`BirthDetails.tsx`, `ChartProgress`): after save, the overlay shows the stage and count,
polling `me` every 3 s for 2 min, then every 10 s. At `chat_ready` it calls `onDone` (dashboard/chat). At `failed` it
shows the error sentence and **Retry**. Leaving the page is fine; the next login lands on the same component in the
same state.

**Chat** (`ChatSection.tsx`): while `status` is `pending|building`, the same `ChartProgress` overlay (no second
"Syncing" copy). Opens at `chat_ready`. A slim banner stays while `rest` is building or `reading_mode === 'legacy'`.
Sending a question that gets 409 re-renders the overlay with the returned state (no error toast). A `legacy_mode` info
event shows the banner above the answer.

**Dashboard** (`KundliNotice`): the same banner text as chat, from the state; gone at `ready`.

### 4.4 UI/UX words and states

| State | Overlay / banner text | Control |
|---|---|---|
| `pending` | "Preparing your chart…" (spinner) | — |
| `building`, stage `gate` | "Calculating your birth chart — 7 of 24" | — |
| `building`, stage `facts` | "Assembling your reading dossier…" | — |
| `chat_ready`, rest building | banner: "You can ask now. Your full chart is still being computed (31 of 113); answers get more detailed as it completes." | dismiss (session) |
| `chat_ready`, `reading_mode: legacy` | banner: "Detailed chart readings are still being prepared. Answers for now use your basic chart." | — |
| `ready` | nothing | — |
| `failed` | "We couldn't finish your chart. {last_error}" | **Retry** → `retryChartBuild` |

Timings the user notices: save → overlay < 1 s; gate 24 items at 4 concurrent ≈ 10–25 s (Radha ~1–3 s per call on
warm containers); dossier +5–20 s; chat open target ≤ 60 s. Rest ≈ 90 items ≈ 1–2 min more.

---

## 5. Architecture

```
Web (Amplify) ── me / completeProfile / retryChartBuild ──▶ API Lambda (request path, ≤ 2 s of chart work)
                 ◀── ChartStatus ───────────────────────────      │ async self-invoke (Event)  ◀── EventBridge sweep /15 min
                                                                   ▼
                                                        API Lambda (worker invocation, ≤ 12 min)
                                                        lease → gate → dossier → completion → rest → release/re-invoke
                                                                   │ radhaLimiter: ≤4 in flight, backoff on 429
                                                                   ▼
                                                        aiastra-pyjhora Lambda (Radha, API key, serial per container)
                                                                   │
                      Render Postgres (pooler :6432) ◀── Prisma, 6 connections per container, pgbouncer=true
                      kundlis (queue_status, facts_status, lease) · kundli_data (row lock per item) · kundli_facts
```

Guarantees at each boundary:
- Request path never does more than 2 s of chart work (the awaited invoke) except the 15 s fallback.
- One kundli has one worker at a time (lease); one item has one fetcher at a time (row lock).
- Radha sees ≤ 4 concurrent calls per API container and never an unauthenticated burst.
- State the web shows is computed from the same rows the worker writes; no separate progress table to drift.

**Alternatives considered**

| Option | Verdict |
|---|---|
| Keep the synchronous pull in `completeProfile` (today) | No: 20 s HTTP calls, still frozen after the response, 8-wide bursts |
| SQS / Step Functions for the build | Not now: the self-invoke + sweep already gives at-least-once with a lease; SQS adds infra for no new guarantee at this volume. Revisit above ~1 sign-up/s |
| Progress table (`chart_builds`) | No: `kundli_data` counts are the truth; a table would drift |
| Keep random `sourceIp` | No: it defeats Radha's limiter instead of using the API-key path that exists for this |
| Raise `connection_limit` to 10+ | No: multiplies by container count; cap concurrency instead |

---

## 6. Ingredients

| Ingredient | Who | Status |
|---|---|---|
| `ASTROKUNDLI_API_KEY` on API Lambda; `PYJHORA_API_KEYS` on pyjhora (same value) | deploy session | **to do** (confirm whether pyjhora has keys today) |
| doc 31 §5: timeout 900 s, IAM self-invoke, `kundli-sync-sweep` rule + permission, `KUNDLI_SYNC_EVENT_TOKEN`, async retries 0 | deploy session, Sachin's OK | **unconfirmed** (AWS creds expired this session) |
| API Lambda reserved concurrency 20; Render pooler cap confirmed | deploy session | to do |
| Env: `CHART_DATA_FETCH_CONCURRENCY=4`, `KUNDLI_QUEUE_MAX_FETCHES_PER_USER=4`, `RADHA_MAX_CONCURRENT=4` | deploy session | to do |
| `DATABASE_URL` host/port known (6432 → `pgbouncer=true`) | code reads it | — |
| No migration | — | — |
| Test seams: `EnsureDeps.fetcher`, `WorkerDeps.invoke`, fake timers for the limiter | dev session | in repo |
| Radha `facts` export | Radha session (`feature/reading-p1`) | in progress, not a dependency |
| Screenshot run per `TEST.MD` → `docs/screenshots/chart-progress/` | web session | Phase 2 |

---

## 7. Action steps in sequence

Steps marked ∥ can run in parallel (separate files). Each step: files → done means.

1. **Limiter + API key + retry** — `astroKundliClient.ts`, `config/env.ts`, new `tests/unit/lib/radhaLimiter.test.ts`.
   Done: all three export functions go through `radhaLimiter`; a fake 429 with "Retry after about 0.5 seconds" is retried
   after ≈ 0.5 s; random `sourceIp` gone; `tsc` clean.
2. ∥ **Pool sizing** — `src/lib/prisma.ts`, test. Done: URL with `:6432` gets `pgbouncer=true`; limit = concurrency + 2;
   an explicit higher `connection_limit` in the URL is kept.
3. ∥ **Chart status service** — new `src/services/chartStatusService.ts`, test. Done: the six states from one query
   against an in-memory repo fixture.
4. **Worker owns the build** — `kundliQueueService.ts`, `kundliSyncWorker.ts`, `store.ts` (batched side writes,
   `FAILED_RETRY_MS`). Depends on 1. Done: in a worker run the dossier build is awaited before completion; the
   fallback is gate-only and awaited; `ensureUserGateReady` no longer pulls; existing tests updated.
5. **Request path** — `profileService.ts`, `schema.ts` (`me.chart`, `retryChartBuild`, no `void` pull),
   `askChatTurn.ts` + `server.ts` (409 with state), `chatLlmService.ts` (legacy by `facts_status`, info event).
   Depends on 3, 4. Done: `completeProfile` returns in < 2 s with the invoke mocked; 409 body carries `chart`.
6. **Docs + TODOS** — this file's status, doc 31 §5 confirmation column, TODOS items closed/added.
7. **Web** (web session, after 5 is merged): `ChartProgress.tsx`, `api.ts`, `BirthDetails.tsx`, `ChatSection.tsx`,
   `KundliNotice.tsx`, tests, screenshots.
8. **Infra** (deploy session, any time after 1; needed before Phase 1 is live): §6 rows 1–4.
9. **Verify end to end** on staging: one sign-up, timings logged, screenshots; five simultaneous sign-ups, no
   `pool_timeout`, no 429 in Radha logs.

---

## 8. Development phases

| Phase | Steps | Leaves the system | Closing check |
|---|---|---|---|
| **0 — Infra** (deploy session) | 8 | Worker path actually runs; API key path on | `kundli_sync_invoked` in logs after a sign-up; a Radha log line showing the key accepted; `aws lambda get-function-configuration` timeout 900 |
| **1 — Server** (this session) | 1–6 | Build owned by the worker; API exposes state; chat gated correctly; old `kundli_status` still served | `npx tsc --noEmit`; `npx vitest run tests/unit/lib tests/unit/reading tests/unit/services`; merged `--no-ff` into `develop` |
| **2 — Web** | 7 | Progress screen, retry, banners | Web tests green; screenshots `01-…png` to `06-…png` in `docs/screenshots/chart-progress/`; QA-LIST entry |
| **3 — Radha facts** | (Radha branch) | `facts_status: ready`, legacy mode unused | one sweep after deploy shows `chart_build phase=facts ready=1` |
| **4 — Load + observability** | 9 | Alarm on `kundli_sync_failed` and `pool_timeout`; numbers in this doc replaced with measured ones | 5 concurrent sign-ups: all `chat_ready` ≤ 90 s, zero 429 |

Phase 1 is shippable without Phase 0 (the fallback keeps today's behaviour, now awaited and gate-only), but the end
goal in §2 needs Phase 0.

---

## 9. Recommendation

Do Phases 0 and 1 now, in parallel (infra is the deploy session's; code is this session's), Phase 2 right after.
The decisions above a staff engineer can make are made here; the ones that are Sachin's:

1. **Reserved concurrency 20 on the API Lambda** (caps cost and DB connections; also caps concurrent chats at 20).
2. **Radha API key** set on both Lambdas (a config change on production).
3. **Lambda timeout 900 s** (doc 31 §5, already pending).

---

## 10. As built (2026-11-01)

**Deploy order matters. Do it in this order:**

1. **Infra first (§6).** Until the API key is set, Radha allows one call per second, so the limiter runs calls one at a
   time. The old random `sourceIp` is gone, and that workaround is what made 8-wide bursts possible. Without the key the
   gate takes about 1.1 s per item, and the 15 s fallback will not finish it. Set `KUNDLI_QUEUE_MAX_FETCHES_PER_USER=4`
   too: its code default stays 1, and a worker run uses that as its parallel width.
2. **Server next.** Lambda timeout is the risk here: at 300 s a worker's 12-minute budget can be cut off, and its lease
   then blocks the kundli for 15 minutes. Raise the timeout, or set `KUNDLI_SYNC_MAX_MS` to 150000 first.
3. **Web last.** The web asks for `me.chart`. Against an old server that query fails, `fetchMe` returns null, and the app
   opens without the profile gate.

**Not checked.** AWS credentials had expired, so nothing here is confirmed against the live Lambdas: timeout, API key,
self-invoke IAM, the sweep rule. The timings in §2 and §4.4 and the gate size "24" are estimates and examples, not
measurements; Phase 4 replaces them. `findKundlisMissingFacts` is new SQL that has not run against a real database.

**Differences from the plan above:**

| Plan | Built | Why |
|---|---|---|
| Retry on 429, 503 and Lambda function timeouts | 429, 503 and Lambda throttling only | A 60 s timeout retried three times burns the budget and rarely succeeds |
| 409 body `{ error: 'chart_not_ready', chart }` | `{ error: <sentence>, code: 'chart_not_ready', chart }` | `error` stays readable for any client; also applied to `confirm-stream` |
| 409 re-renders the chat overlay | The web shows the sentence; the overlay comes from polling `me` | The input is already disabled until chat opens, so this is rare |
| `legacy_mode` info event drives a chat banner | The event is sent, but the banner comes from `me.chart.reading_mode` | One source for the state; the banner also shows before a question is asked |
| Dossier not ready in chat: answer in legacy mode | Build it inside the open request, read again, and use legacy only if that fails | A fire-and-forget build here freezes; this also gives the user the full reading when it can |
| Side writes batched per call | Awaited (write-throughs together, coordinates at the read) | Fixes the freeze; batching would have added code for little gain |
| `READING_ENGINE=1` gates the dossier step | `readingBuildFactsEnabled()` (`READING_FACTS_BUILD`) | The existing switch |
| `ChartStatus.updated_at` | Dropped | Nothing uses it |
| `unsupported` picked up by the next sweep | Sweep skips it; the build chat schedules notices the change, or run `npm run facts:backfill` | Otherwise every sweep calls the engine for every such kundli until `facts` is deployed |
| "Assembling your reading dossier…" | "Putting your reading together…" | "Dossier" is our word, not the user's |

**Added:** `resumeChartBuild` restarts a stalled build when a client polls (at most once a minute per user, per
container), replacing the old un-awaited pull in `me`. The chat page now shows `KundliNotice`; it was only on the
dashboard.
