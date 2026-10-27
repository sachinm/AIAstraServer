# 31 — Background chart pull: build the chart while the user is not logged in

Status: code on branch `feature/background-chart-pull` (from `develop` 95ae6c7), 2026-10-26. Code, tests and this doc
only. Nothing on AWS or the database was touched. The infra in §5 is for the deploy session.

**The problem.** After registration the full chart pull (the registration set, about 113 Radha calls, one per second,
2–3 minutes) ran inside the Lambda container that served the signup or login request. Once the response was sent, the
container could be frozen at any point, so whatever the pull had not finished waited for the user's next login. Nothing
else ran the queue: the 5-minute worker rule is disabled.

**The fix.** The pull runs in its own Lambda invocation. The request that starts it only sends an async self-invoke (an
`Event` invocation, which returns 202 at once). A 15-minute EventBridge sweep picks up anything left over.

## 1. Flow

```
signup / login / adminRefreshUserKundli / (completeProfile, updateProfile on feature/registration-v2-server)
  └─ enqueueKundliSync(prisma, userId)            -> kundliId (row set to queue_status 'pending')
  └─ scheduleKundliSync(kundliId)
       ├─ on Lambda: InvokeCommand { FunctionName: $AWS_LAMBDA_FUNCTION_NAME, InvocationType: 'Event',
       │             Payload: {"source":"aiastra","detail-type":"kundli-sync","detail":{"kundliId":"…","token":"…"}} }
       │      └─ Lambda Web Adapter pass-through -> POST /events -> runKundliSync(kundliId)
       └─ not on Lambda, no kundliId, or the invoke failed: processKundliSyncQueue(prisma), not awaited (the old behaviour)

EventBridge rule kundli-sync-sweep, rate(15 minutes)
  └─ {"source":"aws.events","detail-type":"Scheduled Event","detail":{"task":"kundli-sync-sweep","token":"…"}}
       └─ POST /events -> runKundliSyncSweep: the oldest incomplete kundlis (KUNDLI_SYNC_SWEEP_BATCH, default 5),
          one after another, each through runKundliSync, under one budget
```

`runKundliSync(kundliId)`:

1. **Lease.** One conditional update: `UPDATE kundlis SET queue_started_at = now WHERE id = $1 AND (queue_started_at IS
   NULL OR queue_started_at < now - lease)`. No row updated means another worker holds it: the run is skipped. The lease
   is `KUNDLI_SYNC_MAX_MS` + 3 minutes (15 minutes by default), so a crashed worker's lease expires by itself.
2. **Pull.** `processOneKundliRow` (the queue's existing row run): gate (everything chat needs), legacy columns,
   completion (`kundli_added`, `queue_status = completed`), then the rest. All items go through `ensureChartData` /
   `ensureAnnualCurrent`, so the `kundli_data` row lock still keeps any one item from being fetched twice across
   instances, and ready rows are read, not fetched. That is what makes a later run resume from the first missing item.
   A run of a row that was already `completed` (a resumed or swept run) does not repeat the completion side effects
   (Gemini cache, facts build).
3. **Budget.** The list goes in chunks of `KUNDLI_QUEUE_MAX_FETCHES_PER_USER` types (default 1). No chunk starts once
   `KUNDLI_SYNC_MAX_MS` (default 12 minutes) has passed since the invocation started. `context.getRemainingTimeInMillis`
   is not available behind the web adapter, so the budget is elapsed time.
4. **Release, then continue.** The lease is released with a compare-and-set on the timestamp it wrote (`WHERE
   queue_started_at = <ours>`), so a lease another worker took after ours expired is never cleared. If the budget
   stopped the pull with items not started, the worker re-invokes itself asynchronously for the rest. If that invoke
   fails, the next sweep picks the kundli up.
5. **Respond.** `POST /events` answers only when the run is done, because the invocation lives exactly as long as the
   request. An async invoke throws the response away.

**Sweep selection** (`findIncompleteKundlis`, one SQL query): each active user's latest kundli, not leased, where fewer
than all registration-set rows are *settled*. The want list is every served natal type (variant `''`) and every annual
type's `current` pointer, with its catalog `calc_version`. Settled mirrors `needsFetch` in `store.ts`: ready with the
right calc_version and an unexpired `valid_to`; fetching for under 90 s; unsupported for under 24 h. One difference:
failed rows count as settled for 6 hours, not 5 minutes, so one broken type cannot fill every batch with the same users.
Order: kundlis whose last run ended with `last_sync_error` go last, then oldest `created_at` first.

**Radha spacing.** Inside one invocation, calls stay one per second: the throttled default fetcher does this, and the
sweep processes kundlis one after another, never in parallel. Separate invocations (two users signing up at the same
moment, or a sweep running beside a fresh pull) each keep their own spacing, so Radha can get about one call per second
per running pull. The pyjhora Lambda scales per request, so this is fine at today's sign-up rate.

**Events and token.** `parseKundliSyncEvent` accepts:

- `{source:'aiastra', 'detail-type':'kundli-sync', detail:{kundliId, token}}`. `kundliId` must match
  `[A-Za-z0-9-]{1,64}`.
- `{detail:{task:'kundli-sync-sweep', token}}`. `source` and `detail-type` are not checked, because a constant input
  carries them anyway.

When `KUNDLI_SYNC_EVENT_TOKEN` is set, `detail.token` must equal it (constant-time compare). It is unset-tolerant like
the cache sweeper's `LLM_CACHE_SWEEP_TOKEN`. Set it: `/events` is reachable through the function URL. Any other body
falls through to the cache sweeper check and then a 204.

**Why the invoke call is awaited (2 s cap).** If the Invoke API call were left un-awaited, it would be frozen with the
container as soon as the response was sent, which is the bug this doc fixes. So the request waits for Lambda to accept
the `Event` invocation (usually tens of milliseconds, capped at 2 s by an abort signal). It never waits for the pull.

## 2. Files

| File | What |
|---|---|
| `src/services/kundliSyncWorker.ts` | events, `scheduleKundliSync`, `invokeKundliSyncAsync`, lease, `runKundliSync`, sweep query, `runKundliSyncSweep`, `handleKundliSyncEvent` |
| `src/services/kundliQueueService.ts` | `processOneKundliRow` exported, with `{ deadline, leaseAt }` options; returns `{ gateComplete, more }`. `enqueueKundliSync` returns the kundli id |
| `src/reading/chartData/registration.ts` | `fetchRegistrationItemsUntil` (chunked, deadline-aware) |
| `src/config/env.ts` | `KUNDLI_SYNC_MAX_MS`, `KUNDLI_SYNC_SWEEP_BATCH`, `KUNDLI_SYNC_EVENT_TOKEN` |
| `server.ts` | `POST /events` routes kundli-sync events before the cache sweeper |
| `src/services/authService.ts`, `src/graphql/schema.ts` | signup, email-code login and `adminRefreshUserKundli` call `scheduleKundliSync` |
| `tests/unit/reading/backgroundChartPull.test.ts` | parsing and token, async invoke payload, fallback, lease skip, budget re-invoke and resume, sweep order and budget |

**For `feature/registration-v2-server`:** after `completeProfile` and after an `updateProfile` that changes birth date,
time or place, call `const id = await enqueueKundliSync(prisma, userId); await scheduleKundliSync(id, { prisma });`.
There is one gap. A birth-details change does not invalidate existing `kundli_data` rows today: ready rows are read, not
re-fetched, so a re-pull after the change would keep the old chart. That branch must delete or mark stale the kundli's
`kundli_data` rows, or start a new kundli row, before it schedules the pull.

## 3. Behaviour off Lambda

When `AWS_LAMBDA_FUNCTION_NAME` is unset (local, Render), `scheduleKundliSync` runs `processKundliSyncQueue` in-process,
exactly as before: no deadline, no lease. The sweep is driven only by EventBridge, so a long-lived server has no sweep.
It does not need one, because its process is not frozen.

## 4. Settings

| Env | Default | Meaning |
|---|---|---|
| `KUNDLI_SYNC_EVENT_TOKEN` | unset (not checked) | shared secret in both events. **Set it on the API Lambda** |
| `KUNDLI_SYNC_MAX_MS` | 720000 (12 min) | elapsed budget per invocation; keep it ≥ 2.5 min below the Lambda timeout (one chunk can take one Radha timeout, 120 s) |
| `KUNDLI_SYNC_SWEEP_BATCH` | 5 | kundlis per sweep |

## 5. Infra for the deploy session

The API Lambda is `aiastra-server-api` in account 442728149528 (profile `aiastra-ops`). Terraform's
`environments/prod/main.tf` sets memory 2048 MB and **timeout 300 s**.

| # | Change | Value |
|---|---|---|
| 1 | Lambda timeout | raise to **900 s** (15 min). It is 300 s today, which would cut a 12-minute budget short. In terraform that is `timeout = 900` for `aiastra-server-api`, but terraform is applied only with Sachin's OK. |
| 2 | Lambda env | `KUNDLI_SYNC_EVENT_TOKEN=<random string>` (new, secret, never logged). Optional: `KUNDLI_SYNC_MAX_MS`, `KUNDLI_SYNC_SWEEP_BATCH`. The image keeps the LWA default `AWS_LWA_PASS_THROUGH_PATH=/events` (already relied on by the cache sweeper). |
| 3 | IAM: the function's own execution role | allow `lambda:InvokeFunction` on itself: `{"Effect":"Allow","Action":"lambda:InvokeFunction","Resource":["arn:aws:lambda:us-east-1:442728149528:function:aiastra-server-api","arn:aws:lambda:us-east-1:442728149528:function:aiastra-server-api:*"]}`. Without it the invoke fails, the server falls back in-process (today's behaviour), and logs `kundli_sync_invoke_failed`. |
| 4 | EventBridge rule | `kundli-sync-sweep`, schedule `rate(15 minutes)`, state ENABLED, default bus |
| 5 | Rule target | the API Lambda (the alias/version the deploy uses), constant input: `{"source":"aws.events","detail-type":"Scheduled Event","detail":{"task":"kundli-sync-sweep","token":"<KUNDLI_SYNC_EVENT_TOKEN>"}}` |
| 6 | Resource permission | `aws lambda add-permission --function-name aiastra-server-api --statement-id eventbridge-kundli-sync-sweep --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn <rule ARN>` |
| 7 | Async invoke config (optional) | `aws lambda put-function-event-invoke-config --function-name aiastra-server-api --maximum-retry-attempts 0`. A failed run is picked up by the sweep, so Lambda's automatic async retries (default 2) would only double up. |

`AWS_LAMBDA_FUNCTION_NAME` is set by Lambda itself and needs no setting. The self-invoke targets the unqualified
function (`$LATEST`). If deploys route traffic through an alias, use the alias ARN in the rule target. The invoke can
stay unqualified as long as `$LATEST` is the deployed code.

The disabled 5-minute worker rule can stay disabled. This replaces it.

## 6. Cost (estimate)

These are AWS's public on-demand list prices for us-east-1, x86 (the image is built `linux/amd64`). They are estimates,
not billing data, and they ignore the free tier (400,000 GB-s and 1M requests a month, if the account still gets it):
Lambda **$0.0000166667 per GB-second** and **$0.20 per million requests**. Scheduled EventBridge rule events on the
default bus have no charge.

**One full pull (3 minutes) on the API Lambda at 2048 MB:**

- 180 s × 2 GB = 360 GB-s × $0.0000166667 = **$0.0060**
- 1 async request × $0.0000002 = $0.0000002

The API Lambda is billed for the whole wall time, including the second it waits between Radha calls.

**Radha (aiastra-pyjhora, 2048 MB), 113 invocations at an assumed ~1 s billed each:**

- 113 × 1 s × 2 GB = 226 GB-s × $0.0000166667 = **$0.0038**
- 113 × $0.0000002 = $0.00002

**Per new user: about $0.0098, roughly one cent.** The work itself is the same as today's. Today it was cut short by
the freeze and repeated in pieces on later logins, so this mostly moves the cost rather than adding to it. A pull that
runs past 12 minutes costs one more async request (about $0.0000002) for its re-invoke.

**Sweep when there is nothing to do:** 4 runs an hour × 24 × 30.4 = **2,920 invocations a month**. Each one is a single
SQL query.

- warm, ~0.3 s billed: 2,920 × 0.3 s × 2 GB = 1,752 GB-s = **$0.029 a month**
- worst case, every run a cold start (~5 s billed including init): 2,920 × 5 × 2 = 29,200 GB-s = **$0.49 a month**
- requests: 2,920 × $0.0000002 = $0.0006 a month

**Side effect of raising the timeout to 900 s:** an HTTP request that hangs could now be billed for up to 15 minutes
instead of 5 (at most 900 × 2 = 1,800 GB-s, $0.03, per hung request). The chat stream already bounds its own work, so
this does not happen in normal use.

## 7. Known limits

- The lease lives on `kundlis.queue_started_at` (no migration). The in-process path (off Lambda, or the fallback) also
  writes that column and never releases it, so for 15 minutes after such a run the sweep and kundli-sync events skip
  the kundli. While that run is still going, skipping it is correct.
- If a login lands while a worker holds the lease, its event is skipped and the row keeps `queue_status = 'pending'`
  until the next run. Chat is gated on `kundli_added`, so this is cosmetic.
- A kundli whose birth details cannot be parsed fails on every sweep. It sorts after the clean ones (by
  `last_sync_error`), so it cannot starve them.
