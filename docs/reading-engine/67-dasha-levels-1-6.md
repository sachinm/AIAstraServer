# 67. Dasha levels 1–6 for every system (server side)

Asked by Sachin, 2026-11-09: calculate dasha levels 1–6, return them for all dasha systems, and update every kundli's
affected data. Changed the same day: "have a separate Lambda be responsible for pulling the data for the 1-6 levels
separately and store it in the db for the kundli in focus", then "levels 1-4 for all dasha systems for now only".

Branch `feat/dasha-levels-1-6` (server). The engine side is AIAstra_Radha `feat/dasha-levels-1-6`, a separate lane that
is not merged yet.

## 1. Start (checked 2026-11-09)

- **Pull.** `src/reading/chartData/catalog.ts` lists 44 `dasha.<name>` entries and six `dasha.<name>.l3` entries.
  The `.l3` entries are vimsottari, dwisatpathi, yogini, tithi_ashtottari, kaala and karaka, and each sends
  `params: { levels: 3 }`. Every other system is requested with no params, so the engine answers with its default of
  **two levels**. `dasha.vimsottari` and `dasha.narayana` use the legacy wire types `vimsottari_dasa` and
  `narayana_dasa`, which take no params. The registration set and the sync worker (`src/services/kundliSyncWorker.ts`,
  run by EventBridge every 15 min) pull every served natal type through `ensureChartData`. A row that is already
  `ready` is never pulled again just because its params changed (`needsFetch` does not compare params).
- **Engine today** (AIAstra_Radha `develop`, `src/jhora/dasha_export.py` and `export.py`):
  - `levels` accepts `[1, 2, 3]`. kalachakra accepts only `[1]`.
  - **An unknown key such as `max_level` is refused** with `Invalid params: unknown key(s)`.
  - The `catalog` export lists each type's params spec.
- **Activation.** `buildActivationRows` (`src/reading/digest/activation.ts`) writes one `kundli_activation` row per
  period, from birth to today + 30 years, at most level 3. The digest build (`writeDigest`) deletes **all** of a
  kundli's activation rows and inserts them again. The table has two indexes: `(kundli_id, from_date, to_date)` and a
  GIN index on `houses`.
- **Readers of `activationFor`:**

  | Reader | Level asked for |
  | --- | --- |
  | Self board (`self/service.ts`, `self/sub/index.ts`) | `maxLevel: 2`, plus `shortMaxLevel: 3` around today |
  | Area boards (`boardService.ts`) | 2 and 3 |
  | Career | 3 |
  | Life reading | 2 |
  | Lucky times (`luckyTimes/wiring.ts`, vimsottari lords) | 2 |
  | Chat (`run.ts`, `prewarmReaders.ts`) | none given, which means every stored level |

- **The symptom.** Only six systems reach level 3, and no system goes deeper. A question about "this week" or "this
  month" has nothing finer than a pratyantar, which runs for weeks to months.

## 2. End goal

- Every dasha system is stored **lifelong to level 3**. That covers every kundli, through the normal pull and a
  one-time backfill.
- For a kundli **someone is using**, the deep levels are stored inside a window around today, from −90 days to +365
  days. The default is level 4 only. The env var `DASHA_DEEP_MAX_LEVEL` can raise it to 5 or 6 with no code change.
  - These levels are pulled by a separate worker Lambda.
  - The pull starts the moment the person opens Today, Lucky times, a board or chat.
  - The window is refreshed weekly while the person keeps coming back.
- **What can no longer go wrong:**
  - The API request path never waits on, or calls, the engine for the deep levels.
  - A digest rebuild never deletes the deep rows.
  - The Self board never reads below level 3.
  - Nothing breaks while the engine is still the old one: deep pulls fail quietly, and the lifelong pull keeps working.

## 3. Deliverable (this branch)

**Code:**

| Path | What it does |
| --- | --- |
| `src/reading/digest/activation.ts` | `ActivationLevel` (1..6) and `LIFELONG_MAX_LEVEL = 3`. One tree walker shared by `buildActivationRows` (levels 1–3, lifelong) and `buildDeepActivationRows` (levels 4..max, rows overlapping the window). The house rule is unchanged at every level. `activationFor` takes `maxLevel` and `shortMaxLevel` up to 6, and its **default is now 3**. |
| `src/reading/digest/activationWrite.ts` | `replaceActivationBand`: deletes one band of levels (optionally for some systems) and inserts the new rows, in one transaction. `activationCountsByLevel`. |
| `src/reading/digest/build.ts` | The digest rebuild deletes only `level <= 3`. |
| `src/reading/chartData/catalog.ts` | Every non-legacy `dasha.<name>` gets `fixedParams { levels: 3 }`, except kalachakra. Adds `dasha.narayana.l3`. Adds `dasha.deep`, change class `moving`, which holds the worker's marker and focus rows. |
| `src/workers/dashaDeep.ts` | The worker: the event parser, the freshness rule, the lock, the per-system pull, the band write and the marker. Also `handler` and `handleDashaDeepEvent`. |
| `src/workers/dashaDeepFocus.ts` | The focus trigger (`withDashaDeepFocus`, `noteDashaDeepFocus`) and the sweep step (`runDashaDeepSweep`, `findDeepSweepCandidates`). |
| `server.ts` | `/events` runs `dasha-deep-pull` only when `DASHA_DEEP_WORKER=1`. The chat stream, clarify, lucky, area, self, self v2, life reading and page-timing / sections-stream routes get the focus-wrapped `requireUser`. |
| `src/services/kundliSyncWorker.ts` | The sweep calls `runDashaDeepSweep` at its end. |
| `src/reading/digest/levelsBackfill.ts`, `scripts/backfill-dasha-levels.ts` | The backfill (§4.1). |
| `src/config/env.ts` | The `DASHA_DEEP_*` getters (§6). |
| `src/agents/registry.ts` | A new agent row, `dasha.deep_pull`. |
| `src/reading/self/sub/periods.ts`, `windows.ts` | Skip any row deeper than level 3. |

**Migration** `20261109120100_dasha_levels_m46`. It is additive:

- the index `idx_kundli_activation_level_range` on `(kundli_id, level, from_date, to_date)`;
- two `chart_data_types` rows, `dasha.narayana.l3` and `dasha.deep`, inserted with `ON CONFLICT DO NOTHING`.

The migration has not been applied anywhere.

**Tests:**

- `tests/unit/reading/digest/dashaLevels.test.ts`
- `tests/unit/workers/dashaDeep.test.ts`
- `tests/unit/reading/digest/levelsBackfill.test.ts`
- the fixture `tests/unit/reading/digest/deepFixture.ts`, a depth-6 tree in the R-6 shape, built by hand
- updates to `tests/unit/reading/chartData.test.ts`

**Infra.** Nothing is created here. §5.1 is the spec for the deploy session.

## 4. How it works when done

### 4.1 Backend

**The lifelong pull (levels 1–3, every kundli).**

- Registration, sync and the sweep pull as before. Each `dasha.<name>` is now asked for `{ params: { levels: 3 } }`.
  - Both engines accept this. The old engine already answers three levels for every system.
  - `max_level` is never sent here. The old engine would refuse it. The new engine defaults `max_level` to 6, so a
    request without `levels` would store a deep window in a row that nobody ever rolls forward.
- The digest build turns the stored trees into lifelong rows (levels 1–3, birth to +30 years) and replaces only that
  band.

**The backfill:** `scripts/backfill-dasha-levels.ts`.

- **Scope:** every kundli, or `--kundli <id>`, or `--limit n`. It is a dry run unless `--dry-run=false` is given.
- **Per kundli:**
  1. Re-pull every served lifelong dasha type: `dasha.<name>` and `.l3`, but not the legacy wire types.
  2. Each pull takes the chart-data row lock, sends `levels <= 3`, and writes the result with `complete`. A failed pull
     keeps the old payload.
  3. Build the lifelong rows from the stored rows.
  4. Replace that kundli's level 1–3 activation rows in **one transaction**. No other table is written except
     `kundli_data`, which receives the re-pulled trees.
  5. Print the row count per level before and after.
  6. Append a line to the progress file. A rerun skips those kundlis.
- **Concurrency:** at most 2 types in flight per kundli. Kundlis run one after another. The export client spaces the
  calls (`RADHA_MAX_CONCURRENT`, 250 ms keyed, otherwise the configured spacing).
- **Wet-run gate.** A wet run first checks two things:
  1. The engine's `catalog` lists `max_level` above 3 for `dasha.vimsottari`, which proves the levels engine is
     deployed. This is asked of the catalogue, so the backfill never requests a level above 3.
  2. A three-level `dasha.yogini` pull for the probe kundli comes back three levels deep.

  If either check fails, the script refuses and exits with code 2. A test asserts that no request carries
  `max_level`, `deep_from` or `deep_to`, or a `levels` value above 3.

**The deep pull (levels 4..N, kundlis in focus only):** `src/workers/dashaDeep.ts`.

- **Event:**

  ```
  { type: 'dasha-deep-pull', kundliId, userId?, reason: 'focus' | 'sweep' | 'manual', asOf?, token }
  ```

  `token` is `KUNDLI_SYNC_EVENT_TOKEN`. A wrong or missing token means the event is ignored.

- **Steps:**
  1. **Freshness.** Read the marker `kundli_data (dasha.deep, variant 'marker')`. Skip the kundli when:
     - the marker's window covers from `as_of` to `as_of + 30 d`;
     - its `max_level` is at least the current setting;
     - it was pulled less than 7 days ago. That becomes 24 h when the engine answered no level above 3, as an old
       engine does.

     A failed run backs off for 1 h. `reason: 'manual'` ignores freshness.
  2. **Lock.** Claim the marker row with the same atomic claim as chart data, with an 11 min lease. If another run
     holds it, skip with `locked`. Two focus events for the same kundli therefore pull once.
  3. **Systems.** Every served `dasha.<name>` in the merged catalogue: about 40 in production. `DASHA_DEEP_SYSTEMS`
     can narrow the list.
  4. **Engine calls.**
     - One call per system: `dasha.<name>` with
       `{ params: { max_level: DASHA_DEEP_MAX_LEVEL (4), deep_from: as_of − 90 d, deep_to: as_of + 365 d } }`.
     - At most `DASHA_DEEP_CONCURRENCY` calls in flight. The default is 2, which is also the maximum.
     - The export client spaces the calls.
     - Each call has a 50 s timeout, under the engine's 60 s limit.
     - A worst case of 40 systems × 50 s ÷ 2 is about 1,000 s. That only happens if the engine hangs on every call;
       a normal call takes 0.3–1.5 s. The 600 s Lambda timeout and the 11 min lease bound the run, and the next focus
       finishes the work.
  5. **Rows.** `buildDeepActivationRows` keeps levels 4..N whose `[from, to)` overlaps the window. Each row gets the
     lifelong house rule: a graha lord gets its D1 house, the houses it owns and its aspects; a rasi sign gets
     `house_counts` and its lord's house. The rule reads only the D1 cards in `kundli_digest` and the engine rows.
  6. **Write.** `replaceActivationBand(levels 4..6, systems = those that answered)` runs in one transaction. A system
     that failed keeps its old rows.
  7. **Marker.** Write `ready`, with `valid_to = deep_to` and a payload of
     `{ as_of, deep_from, deep_to, max_level, engine_deep, pulled_at, reason, rows, systems: [{ system, ms, rows, levels, error? }] }`.
     If every system failed, the marker is `failed` with the error. `queueLog` writes `dasha_deep_pull` with the ms and
     rows for each system. An `agent_runs` row is written for `dasha.deep_pull`.
- **Errors.** The worker never throws. Errors go to the marker and the log, and the next focus or sweep retries.
- **Old engine.** The engine refuses `max_level`, so every system fails. The marker is set to `failed`, no rows are
  written, and the next try is after 1 h.

**Focus trigger:** `src/workers/dashaDeepFocus.ts`.

- `withDashaDeepFocus(requireUser, prisma)` wraps the `requireUser` of the focus routes. These are:
  - `/api/chat/ask-stream` and the clarify routes (chat);
  - `/api/lucky/*`;
  - `/api/area/*` and `/api/boards/*`;
  - `/api/self/*`;
  - `/api/life*`;
  - `/api/dashboard/sections-stream` and the page-timing beacon.
- After a successful authentication, it fires `noteDashaDeepFocus` without awaiting it. The steps are:
  1. If `DASHA_DEEP_WORKER_FUNCTION` is unset, return `no_function` and log once per process. There is never an inline
     pull.
  2. Apply a per-container cooldown per user and per kundli: `DASHA_DEEP_FOCUS_HOURS`, default 6 h.
  3. Find the user's latest kundli (1 query).
  4. Read the `focus` row. If it was written in the last 6 h, stop: another container already fired.
  5. Upsert the `focus` row with `fetched_at = now`.
  6. Call `lambda:InvokeFunction` with `InvocationType: 'Event'` and a 2 s abort.
- Cost to the request: zero awaited work. Behind the request: about 3 queries and 1 invoke, at most once per 6 h per
  user per container.

**Weekly roll:** `runDashaDeepSweep`, run at the end of the existing kundli-sync sweep. No new EventBridge rule.

- It picks kundlis that meet both conditions:
  - the `focus` row is less than 30 days old;
  - the marker is missing, its `valid_to` (`deep_to`) is less than 30 days away, it was pulled more than 7 days ago,
    it failed more than 1 h ago, or its lock is older than its lease.
- Oldest pull first, at most `DASHA_DEEP_SWEEP_MAX` (default 10) per sweep.
- It invokes the worker with `reason: 'sweep'`. It never pulls anything itself.
- Worker reserved concurrency is 2, so at most two kundlis are pulled at once across the whole account.

**Consumers.**

- `activationFor` defaults to `maxLevel: 3`, so every reader behaves exactly as today. Chat, which passed no level, used
  to get every stored level; it now gets levels 1–3 explicitly.
- A reader that wants the deep levels asks for them:
  - `maxLevel: 4` to `6`; or
  - `shortMaxLevel: 4` to `6` with `shortFrom` / `shortTo` around a date.

  Where no deep rows are stored, the answer simply has none. There is no pull and no error.
- Today, Lucky times and chat **can** read the deep levels through these options. Their calls and prompts are not
  changed on this branch: wiring them in belongs to those boards' owners (filed in TODOS).
- The Self board stays at 3 or below:
  - every `maxLevel` / `shortMaxLevel` literal under `src/reading/self` is 3 or less, and a test asserts it;
  - `periodSpan` and `windowRows` skip any row deeper than level 3.

### 4.2 API

- **No new public endpoint.** The focus routes keep their requests, responses and status codes. The trigger runs after
  `requireUser` and cannot fail the request.
- **`POST /events`** gains `dasha-deep-pull`. Where it runs:

  | Function | Result |
  | --- | --- |
  | Worker (`DASHA_DEEP_WORKER=1`) | Runs the pull and answers with the outcome: `skipped`, `pulled` or `failed`. |
  | API | Answers `202 { status: 'ignored' }`. The API function never pulls deep levels. |
  | Any, with a wrong or missing token | Falls through to the existing handlers and answers 204. |

### 4.3 Frontend experience

There is no change on this branch. The first time a person opens a board, the deep rows are in place within about
30–60 s, depending on the engine and the number of systems. Until then, a reader that asks for level 4 sees levels 1–3
only.

### 4.4 UI/UX

No words change. Board copy keeps the digested words of doc 45 §3.3. Deep levels feed timing ("this week", "after the
18th") once the board owners wire them in.

## 5. Architecture

```
person opens Today / Lucky / a board / chat
        │
  API Lambda (aiastra-server-api) ── requireUser ── withDashaDeepFocus ──(no await)──► noteDashaDeepFocus
        │                                                                                  │ focus row (kundli_data dasha.deep@focus)
        │                                                                                  ▼
        │                                                         lambda:InvokeFunction (Event) aiastra-dasha-deep-worker
        │                                                                                  │
EventBridge (15 min) ─► /events kundli-sync-sweep ─► runKundliSyncSweep ─► runDashaDeepSweep ─┘  (focused ≤ 30 d, window due)
                                                                                           ▼
                            Worker Lambda (same image, DASHA_DEEP_WORKER=1) ─► /events dasha-deep-pull ─► runDashaDeepPull
                                 marker lock (kundli_data dasha.deep@marker) ─► engine dasha.<name> × ~40 (max_level, window)
                                 ─► kundli_activation levels 4..6 (one transaction per kundli) ─► marker ready / failed

lifelong: registration / sync / sweep ─► ensureChartData (dasha.<name> levels: 3) ─► kundli_data ─► digest build ─► kundli_activation levels 1..3
backfill (once, by hand): scripts/backfill-dasha-levels.ts ─► same, for every kundli
```

What each boundary guarantees:

- The API process only ever invokes the worker.
- The worker owns levels 4–6.
- The digest owns levels 1–3. Neither deletes the other's band.
- The marker row is the lock and the record of the last pull.
- The engine is reached only through the export client, which spaces and limits the calls.

### 5.1 Worker Lambda (spec for the deploy session; nothing is created by this branch)

Facts checked:

- The API is a **container image** (`Dockerfile.lambda`, `node docker-entrypoint.mjs`) behind the **Lambda Web
  Adapter**.
- Non-HTTP events reach `POST /events` through `AWS_LWA_PASS_THROUGH_PATH`.
- `aiastra-aws-terraform/modules/lambda_server_api` owns the function shape (role, memory, timeout). It ignores
  `image_uri` and `environment`.
- `.github/workflows/deploy-api-lambda.yml` in this repo pushes the image to ECR `aiastra-server-api` and points
  `aiastra-server-api` at it.
- The role is `aiastra-api-lambda-exec` (`modules/iam`).
- A `lambda_kundli_worker` placeholder module exists (`aiastra-kundli-worker`). It is unrelated.

**Function:**

| Setting | Value |
| --- | --- |
| Name | `aiastra-dasha-deep-worker` (us-east-1, account 442728149528) |
| Package | Image, the **same image URI** as `aiastra-server-api` (ECR `aiastra-server-api`) |
| Handler | No `ImageConfig` override. The image CMD (`node docker-entrypoint.mjs` + Lambda Web Adapter) is the entry. The adapter hands the async invoke's payload to `POST /events`, and `server.ts` runs the pull there only because of `DASHA_DEEP_WORKER=1`. |
| Timeout | 600 s |
| Memory | 1024 MB |
| Reserved concurrency | 2 |
| Function URL | None |
| Async invoke config | `MaximumRetryAttempts = 0`, `MaximumEventAgeInSeconds = 3600`. The next focus or sweep retries. |
| Role | `aiastra-api-lambda-exec` (same DB, Secrets Manager and engine access as the API), or a copy of it |

A zip / runtime-interface build could use `dist/src/workers/dashaDeep.handler` instead. The node image has no runtime
interface client today, so use the image CMD.

**Env vars:**

- **Copy from `aiastra-server-api`:** the same DB and engine vars.
  - `DATABASE_URL`, `DIRECT_URL` (or the `AIASTRA_DATABASE_SECRET_*` names)
  - the PII key config (`PII_*`)
  - `ASTROKUNDLI_TRANSPORT`, `ASTROKUNDLI_LAMBDA_FUNCTION_NAME` / `ASTROKUNDLI_BASE_URL`, `ASTROKUNDLI_API_KEY`
  - `RADHA_MAX_CONCURRENT`
  - `KUNDLI_SYNC_EVENT_TOKEN`
  - `NODE_ENV`
  - `AWS_LWA_PASS_THROUGH_PATH=/events`
- **Add:** `DASHA_DEEP_WORKER=1`. Optionally `DASHA_DEEP_MAX_LEVEL=4` and `DASHA_DEEP_CONCURRENCY=2`.
- **Leave out the HTTP-only vars:** `JWT_SECRET`, `CORS_ORIGINS`, the `GEMINI_*` / `GROQ_*` / chat keys, and billing
  keys. The worker makes no model call.
- **Also set** whatever the API sets to keep in-process timers off on Lambda (for example the cache-sweep interval).

**On the API function:** add `DASHA_DEEP_WORKER_FUNCTION=aiastra-dasha-deep-worker`. Until this is set, focus is a
no-op.

**IAM:** add to `aiastra-api-lambda-exec` in `aiastra-aws-terraform/modules/iam`:

```
lambda:InvokeFunction on arn:aws:lambda:us-east-1:442728149528:function:aiastra-dasha-deep-worker
```

The API already invokes itself for kundli-sync.

**Logs:** `/aws/lambda/aiastra-dasha-deep-worker`, with the same retention as the API.

**Deploy workflow:** `deploy-api-lambda.yml` should update both functions from the same artifact. After the
`aiastra-server-api` update, add:

```
aws lambda update-function-code --function-name aiastra-dasha-deep-worker --image-uri "$IMAGE_URI"
aws lambda wait function-updated --function-name aiastra-dasha-deep-worker
```

Guard both with `if aws lambda get-function --function-name aiastra-dasha-deep-worker` so the workflow keeps working
before the function exists. The `aiastra-github-deploy` role needs `lambda:UpdateFunctionCode` and
`lambda:GetFunction` on the new ARN.

**Terraform:** add a `lambda_dasha_deep_worker` module, modelled on `lambda_server_api` minus the Function URL and the
CloudFront permissions: log group, function shape, reserved concurrency, `aws_lambda_function_event_invoke_config`.
Add the IAM statement above. Infra stays import-first: create with the CLI (with Sachin's typed yes), then import.

**What the deploy session must do:**

1. Create the function from the current API image. Use the settings and env vars above.
2. Set the reserved concurrency and the async config.
3. Add the IAM statement to `aiastra-api-lambda-exec` and to the deploy role.
4. Set `DASHA_DEEP_WORKER_FUNCTION` on the API.
5. Update the workflow.
6. Commit the Terraform module and the imports.

## 6. Ingredients

**Env vars**, all in `src/config/env.ts`:

| Var | Default | Range or note |
| --- | --- | --- |
| `DASHA_DEEP_WORKER_FUNCTION` | unset (no-op) | API only |
| `DASHA_DEEP_WORKER` | | `1` on the worker only |
| `DASHA_DEEP_MAX_LEVEL` | 4 | 4–6 |
| `DASHA_DEEP_DAYS_BACK` | 90 | 0–365 |
| `DASHA_DEEP_DAYS_AHEAD` | 365 | 30–730 |
| `DASHA_DEEP_SYSTEMS` | `all` | comma list |
| `DASHA_DEEP_CONCURRENCY` | 2 | 1–2 |
| `DASHA_DEEP_FOCUS_HOURS` | 6 | |
| `DASHA_DEEP_SWEEP_MAX` | 10 | `0` turns the step off |

The existing `KUNDLI_SYNC_EVENT_TOKEN` and `RADHA_MAX_CONCURRENT` also apply.

**Who provides what:**

| Ingredient | Provided by |
| --- | --- |
| Migration M46 (agents may apply additive migrations when testing needs them; not applied here) | this branch |
| Engine release with `max_level`, `deep_from`, `deep_to`, and `max_level` in its catalogue params | engine lane, then the deploy session |
| Worker function, IAM, API env var, workflow | deploy session, with Sachin's typed yes |
| Backfill run | Sachin approved updating all kundlis' data in chat on 2026-11-09; run by the deploy or ops session after the engine and server releases |

### 6.1 Rows and storage

The measure is a row in `kundli_activation`: about 190 B of heap plus three index entries (range, level-range, GIN on
`houses`). That is about **350 B a row**. The table is not sealed, because its `fields` are empty in
`src/lib/pii/fields.ts`. Each kundli is assumed to have about 40 served systems.

**Lifelong, levels 1–3, every kundli, after the backfill.** For a 40-year-old the calendar runs from birth to +30 years,
70 years in all. Vimsottari over that span:

- level 1: about 7 rows
- level 2: about 60 rows
- level 3: about 430 rows (a pratyantar averages about 60 days)

That is about 500 rows per system, so about **20k rows, or about 7 MB, per kundli**. Today a kundli has about 6k rows:
six systems at level 3 plus the rest at level 2. The backfill therefore adds about 14k rows and 5 MB per kundli. For the
24 research kundlis, about 120 MB.

**Deep window (455 days), level 4 (the default), focused kundlis only.**

- Vimsottari level 4 averages about 6.7 days, so about 70 rows per window.
- The coordinator's rule of thumb, a tenth of a level 4–6 unit, gives about 250.
- Taking 70–250 rows per system across 40 systems gives **3k–10k rows, or about 1–3.5 MB, per focused kundli**.
- The rows replace themselves weekly, so the size does not grow over time.

**If raised to level 6** (`DASHA_DEEP_MAX_LEVEL=6`):

- The coordinator's unit, about 2.5k rows per system per window, gives about 100k rows, about 35 MB.
- A direct count for vimsottari gives about 70 + 620 + 5,500 rows, about 6.2k per system. That is about 250k rows, or
  85 MB, per focused kundli.

Raise to 6 only with `DASHA_DEEP_SYSTEMS` narrowed to the systems the boards read, and after checking the Render
Postgres plan.

**Indexes.** Every query filters by `kundli_id` and `level`, and the worker and the backfill delete one level band per
kundli. Without the new index, a lifelong query over a kundli with deep rows walks the deep rows through the range
index. That is why `(kundli_id, level, from_date, to_date)` is added. The existing range and GIN indexes stay.

The raw deep trees are **not** stored in `kundli_data`. A deep answer repeats the lifelong levels 1–3 (about 1.5k nodes
per system) next to the window. Keeping the activation rows, which can be rebuilt by pulling again, is cheaper than
keeping 40 trees per kundli.

## 7. Action steps in sequence

1. **Types and walker:** `activation.ts`, `activationWrite.ts`, the band delete in `build.ts`. Done when tsc passes and
   `dashaLevels.test.ts` passes. *(done)*
2. **Catalogue:** `levels: 3` for every system, `dasha.narayana.l3`, `dasha.deep`, migration M46, the chartData tests.
   *(done)*
3. **Worker** (`dashaDeep.ts`) and the `/events` gate in `server.ts`, with worker tests. *(done)*
4. **Focus trigger and sweep step** (`dashaDeepFocus.ts`), wired into the routes and `runKundliSyncSweep`, with tests.
   *(done)*
5. **Backfill:** `levelsBackfill.ts` and the script, with tests. Not run. *(done)*
6. **This doc and TODOS.** *(done)*

Steps 1 and 2 could have run in parallel with 3 and 4. Step 5 depends on 1 and 2. The engine lane runs in parallel
throughout.

## 8. Development phases and deploy order

1. **Engine release.** AIAstra_Radha `feat/dasha-levels-1-6` is merged and deployed through the deploy session, after
   Sachin's typed yes there.
   - Check: the `catalog` export lists `max_level` for `dasha.vimsottari`.
   - Before this, the server branch is still safe: the lifelong pull sends only `levels`, deep pulls fail into a 1 h
     backoff, and nothing is written.
2. **Server release.** Merge this branch into `develop`, apply M46, and release (the worker code ships inside the API
   image).
   - Check: tsc and unit tests pass, `prisma migrate status` is clean, and focus logs `dasha_deep_no_worker_function`
     once.
3. **Worker function and IAM.** The deploy session follows §5.1 after Sachin's typed yes.
   - Check: a manual invoke of
     `{ type: 'dasha-deep-pull', kundliId: <a test kundli>, reason: 'manual', token }` logs `dasha_deep_pull` with rows
     for each system.
4. **Backfill levels 1–3 for all kundlis** (approved by Sachin in chat on 2026-11-09).
   - Dry run first: `npx tsx scripts/backfill-dasha-levels.ts --limit 3`.
   - Then the wet run: `npx tsx scripts/backfill-dasha-levels.ts --dry-run=false`.
   - Check: the after counts show level 3 rows for every system.
5. **Deep pulls start on focus.** Set `DASHA_DEEP_WORKER_FUNCTION` on the API.
   - Check: opening a board logs `dasha_deep_focus_invoked`, then the worker logs `dasha_deep_pull`. The weekly roll
     runs from the sweep.

Deferred: Today, Lucky times and chat reading level 4 in their prompts (their owners), and datetime precision for levels
5 and 6 (TODOS).

## 9. Recommendation

Use **a separate worker Lambda for the deep window, triggered by focus and rolled by the existing sweep**, with
lifelong levels 1–3 in the normal pull and the backfill. This keeps the expensive part (about 40 engine calls per
kundli) off the request path and off kundlis nobody opens, and needs no new schedule.

| Option | Verdict |
| --- | --- |
| Deep levels in the normal pull for every kundli | No. About 40 extra calls per kundli per week for people who never open a board, plus 1–35 MB per kundli. |
| Inline pull on the request | No. 30–60 s on a page open, and it adds engine load in the request path. |
| Store the raw deep trees in `kundli_data` | No. It repeats levels 1–3 for every system. The activation rows are the store, and the engine is re-callable. |
| A new EventBridge rule for the roll | Not needed. The kundli-sync sweep already runs every 15 min, and the step only invokes. |
