# 13 — Usage › Lambda calls: how often each Lambda ran this month, and why

Admin app (`aiadastra_admin`), Usage section. Written 2026-11-09.

## 0. Answer first

**Sachin's question: can Admin read the counts straight from AWS, or do we need our own counter?**

- **Totals: straight from AWS, no counter.** CloudWatch publishes `AWS/Lambda` `Invocations`, `Errors`, `Throttles` and
  `Duration` for every function at no charge. One `GetMetricData` call with period 43200 s (12 h) returns
  month-to-date counts for both functions; days are the sum of their two halves. Cost ≈ $0.01 per 1,000 metrics read,
  so one page load (≈ 12 metrics) costs about $0.0001. Latency under 1 s.
- **Most of the reason split is also in metrics.** Two facts make that possible:
  1. Every self-invoke (`kundli-digest`, `self-reading-build`, `kundli-sync`) and every EventBridge sweep reaches the API
     Lambda as an **asynchronous** invoke (`InvocationType: 'Event'`), while web requests come through the Function URL
     **synchronously**. Lambda publishes `AsyncEventsReceived` per function, so
     *web requests ≈ `Invocations` − `AsyncEventsReceived`* and *background events = `AsyncEventsReceived`*.
  2. EventBridge publishes `AWS/Events` `Invocations` per rule, so each sweep's count is exact.
     *Self-invokes = `AsyncEventsReceived` − sweeps.*
- **The split inside the self-invokes, and the engine's reasons, are not in metrics.** They come from **CloudWatch Logs
  Insights** over the JSON lines the API already writes to CloudWatch (`queueLog` prints each line to stdout because
  `Dockerfile.lambda` sets `KUNDLI_QUEUE_LOG_CONSOLE=1`): `digest_built` (one per `kundli-digest` event),
  `reading_build_done` / `reading_build_failed` (one per `self-reading-build` event) and `kundli_sync_invoked` (one per
  `kundli-sync` self-invoke, logged by the sender). Cost $0.005 per GB scanned; one query scans at most 12 h of the API
  log group after the first one, because closed 12-hour windows are kept in memory and never queried again.
  Latency 2–10 s, so the page shows metrics at once and fills the reasons in when the query finishes.
- **What still needs a small server change:** the engine's own reasons (registration pull vs every other data request)
  and an exact per-event tag. The engine Lambda writes no per-request line, and the API's `[AstroKundli] outgoing` log is
  a multi-line object dump that cannot be counted reliably. One JSON line per invocation in the API —
  `{"event":"lambda_invocation","reason":"<source>"}` at the top of `POST /events` and
  `{"event":"engine_call","reason":"registration|digest|reading|request","type":"<export type>"}` beside each engine
  invoke — makes both exact. The admin query already counts these two event names, so the page picks them up the day
  the server ships them, with no admin change. Filed in `docs/TODOS.md`.

**Recommendation:** metrics for every total and for the web / background / sweep split (exact, free, instant), Logs
Insights for the self-invoke split (exact enough, cents a month, 2–10 s), and the two server log lines as a follow-up
for the engine's reasons. No database counter and no schema change: the counts AWS keeps are the source of truth, and a
counter of our own would miss the invocations that never reach our code (throttles, cold-start crashes, retries).

| Option | Totals | Reasons | Cost / month | Latency | Verdict |
| --- | --- | --- | --- | --- | --- |
| CloudWatch metrics + Logs Insights (chosen) | exact | async/sync and sweeps exact; self-invokes from log lines | < $1 | < 1 s, reasons 2–10 s | best: no new state, no schema |
| Our own counter table, written per invocation | misses throttles and crashes | exact for what it sees | DB writes on every request | instant | adds a write to the hot path and a migration; rejected |
| Embedded Metric Format custom metrics per reason | exact | exact | $0.30 per metric × ~15 = ~$4.50 | < 1 s | good later if Logs Insights grows slow; needs the same server change |

## 1. Start: facts checked 2026-11-09

- API Lambda `aiastra-server-api` (us-east-1, account 442728149528): container image with the Lambda Web Adapter,
  Function URL behind CloudFront `E3UPJNUU8APCT`. Non-HTTP events are forwarded to `POST /events` (`server.ts:91`),
  which routes `kundli-digest` / `kundli-digest-sweep` (`src/reading/digest/event.ts`), `self-reading-build`
  (`src/reading/self/buildEvent.ts`), `kundli-sync` / `kundli-sync-sweep` (`src/services/kundliSyncWorker.ts`) and the
  LLM cache sweep (`src/reading/llm/cacheSweep.ts`); anything else gets 204.
- Self-invokes use `InvokeCommand` with `InvocationType: 'Event'` and `FunctionName = AWS_LAMBDA_FUNCTION_NAME`
  (`event.ts:224`, `buildEvent.ts:135`, `kundliSyncWorker.ts:101`).
- EventBridge rules targeting the API: the digest sweep (every 5 min), the kundli-sync sweep (every 15 min) and
  `aiastra-llm-cache-sweep`. Their exact names are not in terraform (the deploy session created them), so the admin
  lists them with `events:ListRuleNamesByTarget` on the API's ARN.
- Calculation-engine Lambda `aiastra-pyjhora`: invoked only by the API, synchronously (`InvocationType:
  'RequestResponse'`, `src/lib/astroKundliClient.ts:182`); its handler (Mangum) logs nothing per request.
- `queueLog` (`src/lib/queueLogger.ts`) prints single-line JSON to stdout when `KUNDLI_QUEUE_LOG_CONSOLE=1`, which
  `Dockerfile.lambda:45` sets; so those lines are in `/aws/lambda/aiastra-server-api`.
- `agent_runs` of kind `engine_pull` cover only four registered engine agents, not every engine call; not used here.
- Admin Lambda `aiadastra-admin-api`: 512 MB, **timeout 15 s**, role `aiadastra-admin-api-exec` with
  `AWSLambdaBasicExecutionRole` + two `GetSecretValue`s. No CloudWatch, Logs or EventBridge read today.
- This session could not read the live account (the `aiastra-ops` key returns `InvalidClientTokenId`; assume-role
  needs Sachin's say-so). The metric names and log lines above come from the code and the AWS docs; the first
  deployed page load is the live check (§7, phase 2).

## 2. End goal

Staff open **Usage › Lambda calls** and see, for the month so far:

- One tile per Lambda: API calls and engine calls this month, errors, throttles, average and p-max duration.
- A table and bar chart per day, or per 12 hours (toggle), with a column per reason:
  web requests, background events (self-invokes + sweeps), each sweep rule, `kundli-digest`, `self-reading-build`,
  `kundli-sync`, and the engine's calls.
- The time the numbers were read and their age. Numbers are read live when the page opens and are at most 60 minutes
  old (configurable), so they refresh far more than twice a day; a Refresh button reads them again (at most once a
  minute per Lambda container).
- If the reason query is still running, the metrics show at once and the reason columns say "Counting…" and fill in
  within 10 s. If Logs or EventBridge are not permitted yet, the page says which permission is missing and still shows
  the totals.

## 3. Deliverable

Admin repo, branch `feat/admin-lambda-calls` → `develop`:

- `api/src/contract.ts`: `LambdaCalls`, `LambdaCallsSeries`, `LambdaCallsBucket`, `LambdaCallsReason` types.
- `api/src/admin/lambdaCalls.ts`: month window, metric queries, Logs Insights query with closed-window cache, reason
  derivation, in-memory cache. AWS clients behind a small `LambdaCallsAws` interface so tests use a fake.
- `api/src/app.ts`: `GET /api/admin/usage/lambda-calls?refresh=1`.
- `api/tests/lambdaCalls.test.ts`: derivation, buckets, cache, partial failures, route.
- `web/src/pages/LambdaCalls.tsx` (+ test), nav entry under Usage, route `/lambda-calls`, API client, dev mock.
- Env vars (all optional, defaults shown): `USAGE_API_FUNCTION=aiastra-server-api`,
  `USAGE_ENGINE_FUNCTION=aiastra-pyjhora`, `USAGE_API_LOG_GROUP=/aws/lambda/aiastra-server-api`,
  `USAGE_SWEEP_RULES=` (comma list; empty = discover by target), `USAGE_CACHE_MINUTES=60`, `USAGE_LOGS=1`,
  `USAGE_AWS_REGION=us-east-1`.
- IAM change for the deploy session (§5), not applied by this session.
- Server repo: this plan, and a TODO for the two log lines.

## 4. How it works when done

### Backend

1. Request in → window = first day of the current UTC month 00:00 to now, rounded up to the next 12-hour boundary.
   12-hour windows are 00:00–12:00 and 12:00–24:00 UTC (CloudWatch and Logs Insights both align bins to UTC; an IST
   window would split CloudWatch's hour-aligned periods). The page says "UTC".
2. Cache: if a result younger than `USAGE_CACHE_MINUTES` exists and `refresh` is not set, return it. `refresh=1` is
   honoured at most once per 60 s per container.
3. In parallel:
   - `GetMetricData` (one call, period 43200 s, `Sum` for counts, `Average`/`Maximum` for duration):
     API `Invocations`, `Errors`, `Throttles`, `AsyncEventsReceived`, `Duration`; engine `Invocations`, `Errors`,
     `Throttles`, `Duration`; `AWS/Events` `Invocations` per sweep rule. Timeout 5 s.
   - Sweep rules: `USAGE_SWEEP_RULES`, else `ListRuleNamesByTarget` on the API ARN (cached 6 h).
   - Logs Insights (if `USAGE_LOGS=1`): `StartQuery` over `/aws/lambda/aiastra-server-api` from the first window not
     yet cached to now:
     ```
     fields event, reason
     | filter event in ["digest_built","reading_build_done","reading_build_failed","kundli_sync_invoked","lambda_invocation","engine_call"]
     | stats count(*) as n by event, reason, bin(12h) as b
     ```
     then `GetQueryResults` every 1 s for up to 8 s (the admin Lambda's timeout is 15 s). If it is not complete, the
     query id is kept and the next request reads it; the answer carries `reasons.status = 'pending'`.
     Results for windows that have closed are kept per container and never queried again; the open window is
     re-queried each time.
4. Derivation per 12-hour window: web = max(0, Invocations − AsyncEventsReceived); background = AsyncEventsReceived;
   self-invokes = max(0, background − Σ sweeps); per-source counts from logs; when `lambda_invocation` lines exist for
   a window they replace the older per-source lines for that window. Days = sum of their two windows.
5. Failures: a metric failure → 502 `aws_unavailable` with the AWS error name (no partial page without totals);
   a Logs or EventBridge failure → totals still answered, `reasons.status = 'denied' | 'error'` with the missing
   action named.

### API

`GET /api/admin/usage/lambda-calls[?refresh=1]` (any staff role) → 200 `LambdaCalls`:

```ts
{
  month: '2026-11', from: ISO, to: ISO, tz: 'UTC', readAt: ISO, cached: boolean,
  functions: [{ key: 'api' | 'engine', label, functionName, invocations, errors, throttles, avgMs, maxMs }],
  reasons: { status: 'ok' | 'pending' | 'denied' | 'error' | 'off', detail?: string,
             list: [{ key, label, function: 'api' | 'engine', source: 'metric' | 'derived' | 'log', total, note }] },
  halfDays: [{ start: ISO, counts: Record<reasonKey | 'api' | 'engine' | 'api_errors' | 'engine_errors', number> }],
  days:     [{ start: ISO, counts: same }]
}
```

Errors: 401/403 as every admin route; 502 `aws_unavailable`. No personal data: counts only.

### Frontend experience

`/lambda-calls`, workspace layout like Page times: strip = title, Day / 12 hours toggle, Refresh, "read 12 min ago ·
UTC"; centre = two tiles (API, Engine) and the reason tiles, then a stacked bar chart per window and the table (newest
first, a total row). Loading = skeletons; `pending` reasons = "Counting…" and one automatic re-read after 5 s; denied =
an amber note naming the permission; a 502 = the shared error panel with Retry.

### UI/UX

Words: "API calls", "Engine calls", "Web requests", "Background events", "Digest sweep", "Sync sweep", "Cache sweep",
"Digest builds", "Reading builds", "Chart syncs". The engine is called "Engine" only. Help text under each reason says
where the number comes from ("from AWS metrics", "worked out from AWS metrics", "from the API's logs").

## 5. Architecture and ingredients

```
web /lambda-calls ──GET──▶ admin API (aiadastra-admin-api)
                              ├─ cloudwatch:GetMetricData      ─▶ AWS/Lambda (api, engine), AWS/Events (sweep rules)
                              ├─ events:ListRuleNamesByTarget  ─▶ rules targeting aiastra-server-api
                              └─ logs:StartQuery/GetQueryResults ─▶ /aws/lambda/aiastra-server-api (queueLog JSON lines)
```

**IAM change for the deploy session** (add an inline policy `usage-lambda-calls` to role `aiadastra-admin-api-exec`;
needs Sachin's typed yes there):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "Metrics", "Effect": "Allow", "Action": "cloudwatch:GetMetricData", "Resource": "*" },
    { "Sid": "SweepRules", "Effect": "Allow", "Action": "events:ListRuleNamesByTarget", "Resource": "arn:aws:events:us-east-1:442728149528:rule/*" },
    { "Sid": "LogsQueryStart", "Effect": "Allow", "Action": "logs:StartQuery", "Resource": "arn:aws:logs:us-east-1:442728149528:log-group:/aws/lambda/aiastra-server-api:*" },
    { "Sid": "LogsQueryRead", "Effect": "Allow", "Action": ["logs:GetQueryResults", "logs:StopQuery"], "Resource": "*" }
  ]
}
```

**Scope of the IAM change (Sachin, 2026-11-09): admin only.** The policy goes on exactly one principal, the admin
Lambda's own execution role `aiadastra-admin-api-exec` (admin repo, `docs/02-deploy.md` §3). It does not go on, and
must not be copied to: the main API's execution role (`aiastra-server-api`), the engine's role, the web's Amplify
service roles (`aiastra-web`, `aiadastra-admin-web`), the GitHub deploy role `aiadastra-admin-github-deploy`, or any
shared or managed policy. It is an inline policy on that role only, so nothing the server or web run as gains
CloudWatch, Logs or EventBridge read access. The admin web (a browser SPA) holds no AWS credentials at all; only the
admin API Lambda reads AWS.

(`GetMetricData` and `GetQueryResults` have no resource-level permissions, hence `*`.) No env var is required: the
defaults name the live functions.

Libraries: `@aws-sdk/client-cloudwatch`, `@aws-sdk/client-cloudwatch-logs`, `@aws-sdk/client-eventbridge` (installed by
a Haiku sub-agent).

## 6. Action steps

1. Contract types (api/src/contract.ts).
2. `lambdaCalls.ts` + tests (fake AWS) — after 1.
3. Route in `app.ts` + route test — after 2.
4. Web: API client, page, nav, route, mock, test — after 1, in parallel with 2–3.
5. Typecheck + tests in api and web; merge `--no-ff` into `develop`.
6. Deploy session: IAM policy above, then deploy admin API and web (Sachin's yes).
7. Server follow-up: the two log lines (`lambda_invocation`, `engine_call`).

## 7. Development phases

- **Phase 1 (this branch):** steps 1–5. Closes on green tests and typecheck; the page renders from the dev mock.
- **Phase 2 (deploy session):** step 6. Closes when the deployed page shows November's totals and they match the
  Lambda console's Monitor tab for the same range.
- **Phase 3 (server):** step 7. Closes when the engine reason columns fill in on the page without an admin change.

## 8. Recommendation

Ship phase 1 now: AWS's own metrics are exact for totals, web vs background, and each sweep, and cost nothing; Logs
Insights over lines we already write covers the self-invoke split for cents. Do not add a counter table. Add the two
server log lines next so the engine's reasons are exact too.
