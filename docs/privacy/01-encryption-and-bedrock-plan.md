# 01 — Encrypt personal data at rest and keep model traffic inside AWS

Status: plan only, for Sachin's review. No code, migration or AWS resource has changed. Written to "How a plan is written" in
`AGENTS.md`. Facts were checked on 2026-11-01 by reading code and AWS docs. Live rows and deployed Lambda env were not read;
where a fact comes from local `.env` or from memory, it says so.

## Read this first: three things cannot be done as worded

1. **Gemini is not on Bedrock.** The us-east-1 catalogue lists Google only as `gemma-3-4b-it`, `gemma-3-12b-it` and
   `gemma-3-27b-it` (`aws bedrock list-foundation-models`, 2026-11-01, run in account 900515855120 because the AI Astra
   deployer has no list permission). The Bedrock pricing page also lists only Gemma for Google. So the switch is to a different
   model, which changes how readings read, and needs an evaluation. Recommendation: Claude on Bedrock (section 9).
2. **"Never available decrypted" would be a false statement.** The server must read birth details to call the chart engine and
   must read the chart to call the model. The browser must hold readable text to paint a screen. No encryption scheme changes
   this while the product computes charts and writes readings. Section 2 gives what can truthfully be promised, which is still
   strong, and section 4.6 gives the exact policy words.
3. **"Does not leave AWS" is false while the database is on Render.** Moving the model to Bedrock does not fix that. After this
   plan Render holds only encrypted data and no keys, so the true claim is "readable only inside AWS". The literal claim needs
   the database moved, which is Sachin's decision (section 9, decision 3).

## 1. Start: the system today

**Stored data.** Render Postgres holds everything (`.env` points at `*.virginia-postgres.render.com`; deployed value unread).
`src/lib/encrypt.ts` covers only `auth.date_of_birth`, `time_of_birth` and `place_of_birth`
(`src/services/profileService.ts:86-88`), and has three faults:

- It stores plaintext when `ENCRYPTION_KEY` is unset (`encrypt.ts:30`). Local `.env` has no such key; the deployed value is unread.
- A failed decrypt returns the ciphertext as if it were the value (`encrypt.ts:59-61`).
- `adminService.updateUser` writes the three fields unencrypted (`adminService.ts:106-108`) and `adminGetUser` returns them
  undecrypted (`schema.ts:897`).

Everything else is plaintext: email, name, username, gender, city, country and signup IP on `auth`; `kundlis.biodata` holds date,
time and place in clear, plus coordinates; and all charts, questions, answers and life events are unencrypted.

**Hashes leak too.** `kundli_facts.source_hash` is a SHA-256 over the stored birth fields (`src/reading/data/factsBuilder.ts:40`).
Birth date, minute and city are few enough to guess by brute force, so an unkeyed hash of them is not safe at rest. Because that
hash covers ciphertext with a random IV, re-encrypting also makes it look stale, which would trigger a rebuild of every dossier.
`dossier_hash` (`factsBuilder.ts:54`) feeds finding cache keys (`src/reading/graph.ts:169`), and `payload_hash` is an MD5
(`src/reading/chartData/store.ts:607`).

**Encryption is feasible.** No code or migration reads, filters or sorts by JSON path, so payload columns can be encrypted whole.
Only these filter on a personal column:

| Column | Where | Kind |
|---|---|---|
| `email` | `src/auth/emailCode.ts:49,83,130`, `authService.ts:194,273` | case-insensitive, unique index on `lower(email)` |
| `email` | `scripts/billing-set-paid.ts:25` | exact |
| `username` | `authService.ts:281`, `src/ensureSuperadmin.ts:24`, `scripts/seed-queue-users.ts:33` | exact |
| `email`, `username` | `adminService.ts:25-26` | substring search |

Raw SQL touches personal tables in 7 source files: `reading/chartData/prashna.ts`, `reading/chartData/store.ts`,
`reading/timeline/ledgerStore.ts`, `reading/timeline/store.ts`, `reading/transits/ephemerisCache.ts`,
`services/kundliSyncWorker.ts`, `services/userLocation.ts`.

**Model traffic.** There is no provider layer. Ten call sites import `callGemini` or `streamGemini` directly:

| Site | Job | Stream | JSON schema | Explicit cache | Personal data sent |
|---|---|---|---|---|---|
| `reading/nodes/intake.ts:305` | intake | no | yes | no | question, previous turn |
| `reading/buckets/classifier.ts:642` | classifier | no | yes | no | question |
| `reading/nodes/specialists.ts:411` | specialists | no | yes | yes | birth data, chart, question |
| `reading/run.ts:364,451` | synth | yes | no | yes | birth data, chart, findings, question |
| `reading/oracle/runReader.ts:211` | readers, prewarm | no | yes | yes | chart tables, question |
| `reading/oracle/flow.ts:274,352` | Oracle, addendum | yes | no | no | brief, findings, question |
| `reading/oracle/validator.ts:116` | validator | no | yes | no | question, answers |
| `reading/timeline/interview.ts:126` | life interview | no | yes | no | free-text life events |
| `services/geminiChatService.ts:349` | legacy chat | yes | no | yes | biodata, charts, dashas, question |

No tool calling, grounding or web search is used anywhere. Models come from `READING_MODEL_*` (`reading/llm/models.ts:12-18`);
local `.env` has `gemini-3.1-flash-lite` and `gemini-3.8-flash`, while an older note says `gemini-2.5-flash` is live, so the
deployed value is unverified.

**Google holds user charts in caches:**

- `services/geminiCacheService.ts:224-246` uploads biodata and charts to Google `cachedContents` with a 7-day TTL, on login, signup,
  profile update and chart completion (`authService.ts:147,336`, `profileService.ts:105`, `kundliQueueService.ts:456`). Logout does
  not delete it. Whether it runs live depends on `GEMINI_CACHE_ENABLED`, unread; an older note says it was off.
- `reading/llm/promptCache.ts:181-188` holds the chart prefix for 30 minutes, tracked in `llm_cache_entries`. Logout deletes it.

**Bedrock today.** `reading/llm/bedrock.ts` does Converse only, for the clarifier: no streaming, schema or cache. `docs/TODOS.md`
conflicts on it (quota 0 and no `bedrock:InvokeModel` on the role versus defaults of 10,000 RPM).

**Other people who receive personal data:**

| Recipient | Site | Data | Inside AWS? |
|---|---|---|---|
| Google (Gemini) | `reading/llm/gemini.ts:276,306` | as above | no |
| Render | `DATABASE_URL` | everything stored | no |
| OpenStreetMap Nominatim | `reading/chartData/store.ts:582`, Radha `src/jhora/export.py:501` | birth place in URL | no |
| Groq | `services/groqChatService.ts:178`; the code default when `CHAT_LLM_PROVIDER` is unset (`config/env.ts:254`) | biodata, charts, question | no |
| OpenAI | `lib/llmClient.ts:22`, via `POST /query` and `uploadKundli`; no key in local `.env` | chart chunks, question | no |
| Resend, SMTP | `services/emailService.ts:20,50`, only when `AUTH_PROVIDER=local` | email, sign-in code | no |
| Cloudflare Turnstile | `services/turnstileService.ts:28-33`, plus the browser | token, IP | no |
| Google Analytics | web `index.html:34`, from the browser | usage, IP | no |
| Cognito, SES | `auth/cognitoClient.ts:136-137` | email, name | yes |
| Radha Lambda | `lib/astroKundliClient.ts:184` | birth data in the invoke payload | yes |

**Logs hold personal data:**

- `server.ts:141-146` logs the first 300 characters of every GraphQL body, including emails, sign-in codes and questions.
- `lib/astroKundliClient.ts:839-848` logs 1,500 characters of every Radha response by default.
- `services/kundliService.ts:120-125` logs raw model output on parse failure.
- Radha logs place and coordinates (`src/jhora/export.py:481,496,503`), appends each export response to `logs/export.log`
  (`:1284`), and logs date, time and place at `:1407`. Which of these reach CloudWatch is unverified.
- `chat_logs` stores whole prompts on legacy paths (`geminiChatService.ts:335-343`, `groqChatService.ts:189-197`), and
  `reading_agent_responses.prompt_sent` stores reader prompts.

**The browser.** Decrypted data crosses both ways over TLS:

- Reads: `me` (`schema.ts:459`), `myBiodata` (`:583`), `myKundliDisplayData` (`:681`), `chats` and `chatMessages` (`:766,827`),
  `myTimeline` (`:972`), and the `/api/chat/ask-stream` stream (`server.ts:184`).
- Writes: `startSignup`, `signup`, `completeProfile`, `updateProfile` (`schema.ts:1088-1136`), and the question and location.
- Shown on `ProfileSection.tsx:71-85`, `ChartsSection.tsx:86`, `ChatRightSidebar.tsx:109-114`, `ChatMainArea.tsx:253`.
- Stored: `astroUser` with name and email in localStorage (`routes.tsx:98`, `App.tsx:35`); the birth draft and rounded location in
  sessionStorage (`BirthDetails.tsx:94`, `useQuestionLocation.ts:47`), which logout does not clear (`Auth/logout.ts:19-24`).
- The browser computes nothing from chart data; it only formats tables. The JWT holds `sub` and `role` only (`authService.ts:73-76`).

**Admin.** `adminGetUser` (`schema.ts:897`), `adminGetUserKundli` (`:1010`) and `referralStats` (`:998`) return personal data. The web
has no admin screen. Role comes from the JWT, not the database (`graphql/context.ts:48`). `GET /debug/kundli/:user_id` (`server.ts:371`)
is closed only when `NODE_ENV` is `production`, and the Lambda runs as `staging`, so it is probably open; it returns only the caller's
own chart.

**What the current policy says.** Section 4 of `AIAstra_WEB/src/pages/legal/LegalPages.tsx` names Render and "artificial intelligence
providers" generally, and section 10 says "reasonable" safeguards. That is broadly accurate today. Nothing stronger can go in until
this plan's evidence exists.

**Access.** `aiastra-ops-deployer` works but has no IAM, KMS or Bedrock rights. `aiastra-ops` is rejected. The admin path into account
442728149528 was given up on 2026-10-25. Every AWS resource here therefore waits on Sachin (section 9, decision 4).

**Symptom for the user:** none yet. The exposure is a Render breach, a leaked `DATABASE_URL`, a CloudWatch reader, or Google, each
of whom can read a person's birth details and questions in clear.

## 2. End goal

When this is done, a person using AI Astra gets the following, and each line has a check behind it (section 8):

- Their name, email, birth details, charts, dashas, questions, answers and life events are encrypted before they reach the database,
  with keys held in AWS KMS. Render stores unreadable text and no keys. A full database dump reveals no personal data.
- Those values become readable only in the AI Astra Lambdas on AWS, in memory, for the moment they are needed. They are never in logs.
- Readings are written by models on Amazon Bedrock in US AWS Regions. No model provider outside AWS receives anything, and no chart is
  parked in anyone's cache.
- The browser receives a person's data only for that person, over TLS, only for the screen they opened. Birth details are hidden until
  they choose to see them. Nothing personal stays in browser storage after sign-out.
- Support staff and admin tools see masked values. Every key use is in CloudTrail.
- Deleting an account destroys its key. Its data is unreadable within 7 days everywhere, including Render's backups.

What can no longer go wrong: a stolen database or backup exposing a person; a log line holding someone's birth details; a user's chart
sitting at Google; a misconfigured key silently storing plaintext (the app refuses to start).

What this does not protect against, and the policy must not imply it does: a compromised running Lambda or an AWS admin who changes the key
policy. Those are limited by audit, not prevented.

**Speed.** Readers should notice nothing from encryption. The target is under 50 ms added on the first request per user per Lambda
instance and under 5 ms after that; this is a target, measured in phase 3. Model latency will change and is measured in phase 1.

## 3. Deliverable

**Server**
- `src/lib/pii/`: `fields.ts` (the table in 4.1.3), `keys.ts`, `seal.ts`, `blindIndex.ts`, `prismaExtension.ts`, `rawSql.ts`.
- `src/reading/llm/provider.ts`, `src/reading/llm/bedrockAdapter.ts`; all ten call sites moved to the provider.
- Removed: `lib/encrypt.ts`, `reading/llm/gemini.ts`, `reading/llm/promptCache.ts`, `services/geminiCacheService.ts`,
  `services/geminiChatService.ts`, `services/groqChatService.ts`, `lib/llmClient.ts`, the `/query` and `/debug/kundli` routes, the
  Nominatim fallback, and the log lines listed in section 1.
- New queries `myBirthDetails` and `deleteMyAccount`. Changed `me`, `myBiodata`, `myKundliDisplayData`, admin queries.
- Migrations (written, not applied without OK): M20 `pii_expand`, M21 `pii_contract`, M22 `drop_llm_cache_entries`.
- `scripts/pii-audit.ts`: prints per-column counts of unsealed values, never values.
- Tests: `tests/unit/pii/*`, `tests/integration/piiAtRest.test.ts`, `tests/unit/noExternalHosts.test.ts`, `tests/unit/noPiiInLogs.test.ts`.

**Radha:** drop the Nominatim fallback, stop logging place, coordinates, date and time, and stop the export log.

**Web:** `ProfileSection.tsx`, `ChatRightSidebar.tsx`, `Auth/logout.ts`, `routes.tsx`, `App.tsx`, `BirthDetails.tsx`,
`useQuestionLocation.ts`, `LegalPages.tsx`.

**AWS (created by Sachin or an admin, never by terraform from an agent):** two KMS keys, one DynamoDB table, IAM changes on the
two Lambda roles, Bedrock model access and quota, the Bedrock retention setting, CloudTrail check.

**Docs:** this plan, `docs/privacy/02-evidence.md` (audit output and dates that back each policy sentence), updates to `docs/TODOS.md`.

## 4. Exactly how it works when done

### 4.1 Backend: encryption

#### 4.1.1 Keys

Envelope encryption with one data key per person:

- **Wrapping key:** KMS symmetric key `alias/aiastra-pii-wrap`, us-east-1, automatic annual rotation (no re-encryption needed).
- **Per-person data key (DEK):** AES-256, made by KMS `GenerateDataKey` at signup. The wrapped copy goes in DynamoDB table
  `aiastra-user-keys`, keyed by an opaque `key_ref` (a UUID also stored on `auth.key_ref`). The table holds no user id, email or data.
  Encryption context on every KMS call: `{ key_ref }`, so CloudTrail shows which person's key was used.
- **Why DynamoDB and not a Postgres column:** Render's backups would otherwise hold the wrapped key forever, and deleting a person could
  not make their backed-up rows unreadable. With keys only in AWS, Render holds ciphertext and nothing that opens it. Table settings: deletion
  protection on, point-in-time recovery 7 days. That is where the "within 7 days" promise comes from.
- **Lookup key:** KMS `HMAC_256` key `alias/aiastra-pii-bidx`, called through `GenerateMac`, so the secret never reaches the Lambda.
- **Hash key:** `HKDF(DEK, "hash-v1")`, for per-person hashes.
- **Key policy:** `kms:Decrypt` and `GenerateDataKey` for `aiastra-server-api` and `aiastra-kundli-worker` roles only, and only with a
  `key_ref` context. `aiastra-pyjhora` gets none. Admin users can manage the key but not use it. The deployer gets nothing. An
  operator role gets `GenerateMac` only, so scripts can find a user without reading them.
- **In memory:** an LRU of 500 unwrapped DEKs per Lambda instance, 5-minute TTL.

#### 4.1.2 Sealing a value

- AES-256-GCM through `node:crypto`, random 12-byte IV, AAD = `table.column.key_ref`, so a value cannot be moved to another column or person.
- Text columns: `pii2:<key_ref>:<iv>:<ciphertext+tag>`. JSON columns keep their type and hold `{ "$pii": "pii2:..." }`, so no column changes type and
  sealed and unsealed rows can coexist during the backfill. Payloads over 4 KB are gzipped first, marked `pii2z:`, because ciphertext does not compress
  and Postgres can no longer do it for us.
- Blind index: `HMAC(bidx key, lower(trim(value)))` in `email_bidx` and `username_bidx`, with the unique index moving to `email_bidx`.

`Prisma` client extension (`prismaExtension.ts`), one place, all code paths:

- **Reads:** walks results by model, including `include`, and opens anything sealed. The key comes from the value itself, so no join is needed.
- **Writes:** seals mapped fields on `create`, `update`, `upsert`, `createMany`, including nested writes. It finds the owner from `user_id`, or through
  `kundli_id`, `chat_id` or `run_id` with a per-instance cache.
- **Guard:** a `where` or `orderBy` naming a sealed field throws in every environment, except `email` and `username`, which it rewrites to the blind index.
- **Raw SQL:** the extension cannot see it. The 7 files use `sealParam()` and `openRow()` from `rawSql.ts`, and a test fails if a new file uses `$queryRaw`
  or `$executeRaw` without being on the reviewed list.
- **Failure:** a failed decrypt throws, never returns ciphertext. KMS timeout 1 s, 2 attempts. DynamoDB timeout 1 s, 2 attempts. Then error `PII_UNAVAILABLE`. Cached
  keys keep working through a KMS outage for their 5 minutes.
- **Boot:** on Lambda (`AWS_LAMBDA_FUNCTION_NAME` set, not `NODE_ENV`, which reads `staging` there), missing KMS config refuses to start. Local and test use
  `PII_KEY_PROVIDER=local`, which is refused on Lambda.

#### 4.1.3 What is sealed

| Table | Sealed | Blind index or keyed hash | Left plain, and why |
|---|---|---|---|
| `auth` | `email`, `username`, `name`, `date_of_birth`, `time_of_birth`, `place_of_birth`, `city`, `country_code`, `gender`, `signup_ip`, `cognito_session` | `email_bidx`, `username_bidx` | ids, role, flags, timestamps, `referral_code`, `language`. `password` and `magic_link_code_hash` stay bcrypt |
| `kundlis` | `biodata`, `d1`..`d10`, `charakaraka`, both dashas, `other_readings`, `place_resolved`, `last_sync_error`, new `coords` replacing `lat`, `lon`, `tz` | | queue and facts status, timestamps |
| `kundli_facts` | `dossier`, `natal_points` | `dossier_hash`, `source_hash` | versions, `ayanamsa` |
| `kundli_data` | `payload`, `error`, `params` | `payload_hash` | `data_type`, `variant`, `status`, lock columns |
| `kundli_transit_overlays` | `payload` | `source_hash` | `kind`, `params_key`, dates |
| `transit_snapshots` | `snapshot` where `kundli_id` is set | | global rows have no person |
| `user_generated_content` | `remedies`, `mantras`, `routines` | | |
| `chats`, `messages`, `chat_logs` | `name`; `question`, `ai_answer`; `request_payload`, `response_payload` | | |
| `reading_runs` | `question`, `intent`, `intent_confirmed`, `findings`, `windows`, `agreement`, `answer`, `thinking`, `grounding`, `errors` | `dossier_hash` | status, timings, usage, cost |
| `reading_agent_responses` | `question`, `subject`, `prompt_sent`, `digest`, `highlights`, `failure_reason` | `data_hash` | model, tokens, cost, timing |
| `reading_traces` | `question`, `error` | | counts, timing. Spans hold times only; check `failure_reason` in phase 3 |
| `prashna_casts` | `payload`, `place_resolved`, new `coords` replacing `lat`, `lon`, `tz` | | `asked_at` |
| `life_events` | new `event` holding `category`, `date`, `date_precision`, `place`, `attributes` | | Sorted in memory after opening; a person has few rows |
| `timeline_windows`, `timeline_matches` | new `window` holding `marker`, `from`, `to`, band, scores, `systems`, `how`, `form`; `specifics` | | Read by `build_id`, sorted in memory |
| `timeline_calibration` | `marker`, scores | | |
| `user_current_location` | `place`, `tz`, new `coords` replacing `lat`, `lon` | | |
| `billing_accounts` | `payment_ref`, `billing_country` | | plan and quota fields |
| `transit_instants`, `transit_range_skies` | `lat`, `lon`, `tz` under a system key | `place_key` becomes an HMAC | Sky data shared by all, no person link |
| `login_attempts` | | | No code reads or writes it and it is not in the schema. Drop it if empty (phase 0) |

`llm_cache_entries` is dropped in phase 2. DynamoDB `aiastra-gemini-cache` is retired then too.

#### 4.1.4 Flows

- **Sign-up and sign-in:** `email` in, `GenerateMac`, find by `email_bidx`, send the code, verify, issue the same JWT. New user: `GenerateDataKey`, store the key, seal the row.
- **Chart build:** worker opens birth data, invokes Radha over the existing AWS SDK path (`astroKundliClient.ts:184`), seals the payload, writes `kundli_data`. The row-as-lock logic is untouched because
  `status` and lock columns stay plain. One worker keeps the existing concurrency and timeouts.
- **Reading:** opens chart rows on the existing pool of 6, sends to Bedrock, seals the answer, writes it. One DEK unwrap per user per instance, so 17 readers cost one KMS call.
- **Source hash:** computed over opened values with the hash key, so sealing never triggers a rebuild. The backfill rewrites it in the same transaction as the seal.
- **Account deletion:** delete the key item first, then delete rows in one transaction. Data at Render, including backups, is then unreadable once DynamoDB's 7-day recovery window passes. Revoke
  access by checking `auth` still exists on each request, because JWTs last 7 days. Also delete the Cognito user. This closes the "no account deletion" item in `docs/TODOS.md`.
- **Rotation:** the wrapping key rotates itself. On suspected DEK exposure: re-seal that person. On suspected lookup-key exposure: new HMAC key, second index column, backfill, swap; HMAC keys
  are not assumed to auto-rotate.

#### 4.1.5 Migration with no downtime

1. **Expand (M20):** add `auth.key_ref`, `email_bidx`, `username_bidx`, all new `coords`, `event`, `window` columns, nullable. Nothing breaks.
2. **Deploy read-both code:** opens plaintext, legacy `enc:` values (needs the current key, if any) and `pii2:`. Writes stay plain with `PII_WRITE_MODE=plain`.
3. **Flip `PII_WRITE_MODE=sealed`.** New writes are sealed. Rollback: flip back; the reader handles both.
4. **Backfill in AWS, not on a laptop,** so plaintext never leaves it: `aiastra-kundli-worker` event `pii_backfill`, one person per transaction, 250 s per invocation then re-invoke itself, idempotent (skips sealed values), one
   at a time. An older note says 24 charts are built, so this should be small; phase 0 confirms it.
5. **Verify:** `scripts/pii-audit.ts` shows 0 unsealed across all columns. Then a sign-in, a chart view, a reading on staging.
6. **Contract (M21, destructive, needs Sachin's explicit yes):** make `email_bidx` unique and required, drop `auth_email_lower_key`, drop plain `lat`/`lon`/`tz`, old `life_events` and `timeline_windows`
   columns. Remove legacy `enc:` handling and `ENCRYPTION_KEY`. Before this: a Render snapshot.
7. **Wait out Render's backups.** Plaintext lives in backups until they age out, and the claim is not true before that date. Retention is unread; phase 0 finds it.

### 4.2 Backend: Bedrock

**Provider layer.** `provider.ts` exposes `callModel` and `streamModel` with today's `GeminiCallOptions` shape, so call sites change only their import. `READING_LLM_PROVIDER=gemini|bedrock` selects the adapter
until phase 2, then the Gemini adapter is deleted. `bedrockAdapter.ts` extends `bedrock.ts` with `ConverseStream`, schema and caching, on the `@aws-sdk/client-bedrock-runtime` already in the repo, so gpt-oss and Claude share one
call shape. Converse is chosen over the Anthropic Mantle client for that reason.

**Model set for evaluation:**

| Role | Today (local `.env`) | Price in, out per 1M | Bedrock candidate | Price in, out per 1M (Anthropic list) |
|---|---|---|---|---|
| intake, specialist, reader, validator | `gemini-3.1-flash-lite` | $0.25, $1.50 | `us.anthropic.claude-haiku-5-5` | $0.10, $0.50 (under 100K prompt tokens) |
| synth, Oracle | `gemini-3.8-flash` | $0.75, $3.75 | `us.anthropic.claude-sonnet-5-5` | $2.00, $10.00; cache read $0.20 |
| clarifier | `openai.gpt-oss-120b-1:0` | $0.15, $0.62 (Sydney rate; US unread) | unchanged | |

Anthropic list prices are shown because the Claude tables on the AWS pricing page did not load; Bedrock rates must be read before phase 2, and `PRICES` in `models.ts` gets a row for each so cost tracking is right.
Claude Opus 5.5 ($4, $20) is a third arm on synth only if Sonnet misses the quality gate. Gemma 3 27B is a low-cost control arm: the only Google family on Bedrock, included to show what it gives up.

**Models not allowed.** Claude Fable 5 and 5.1 retain all traffic up to 30 days with possible human review by AWS. OpenAI GPT 5.x retains classifier-flagged traffic up to 30 days; the gpt-oss models are exempt. Setting the account's
retention mode to `none` makes Bedrock refuse any model that requires retention, so a config mistake fails loudly instead of quietly storing prompts.

**Where it runs.** `bedrock-runtime` has no in-Region route for Sonnet 5.5, only `us.`, `eu.`, `au.` and `global.` profiles. The `us.` profile routes among us-east-1, us-east-2 and us-west-2. All are AWS and US. IAM allows only `us.` profile
ARNs and the matching foundation-model ARNs, so `global.` cannot be called.

**Adapter details that break if missed:**

- `inferenceConfig.temperature` must not be sent to Claude 5.5 models: non-default sampling returns 400. `bedrock.ts:84` sends 0, and `GEMINI_TEMPERATURE` and `GEMINI_TOP_P` have no equivalent.
- Thinking map: `off` is `disabled` on Haiku (allowed at effort high or below) and `between_tools` on Sonnet. `low`, `medium`, `high` become `output_config.effort`. `budget_tokens` returns 400. Today's `thought` stream
  (`run.ts:334`) needs `display: "summarized"`.
- Schemas: Gemini's uppercase OpenAPI subset is converted to JSON Schema with `additionalProperties: false`, one tested function. Keep `extractJsonObject` as the fallback. The exact Converse field is confirmed by a test call in step 1.3.
- `maxTokens` is always set per role, because an unset value reserves the model's maximum against quota.
- Refusals: read `stopReason` before the text. Server-side fallback does not exist on Bedrock, so a refusal is one retry on the next model up, then the existing failure path. Astrology questions on health and death are in the eval because
  Sonnet 5.5 has a `general_harms` category.
- No prefill and no forced `tool_choice`. The code uses neither.
- Limits: timeouts per role as today, SDK `maxAttempts: 2` adaptive, 17 readers in parallel as today, within the new quota.

**Caching replaces uploads.** Bedrock caching is a `cachePoint` marker in the request: minimum 512 tokens, 4 checkpoints, TTL 5 minutes or 1 hour. There is nothing to create, name, register, sweep or delete, so `promptCache.ts`, `geminiCacheService.ts`,
`llm_cache_entries`, the logout delete (`schema.ts:1183`) and the sweep (`server.ts:74`) all go. Layout: system, then chart prefix, then `cachePoint`, then the question. Prewarm stays (`reading/oracle/prepare.ts:102`) because 17 cold readers
would otherwise all miss. Start at 5 minutes; move the chart prefix to 1 hour if the eval hit rate is low on follow-up questions. Caches are per model, which is another reason to keep the role map small.

**Closing the doors:**

- `CHAT_LLM_PROVIDER` is removed and `clarifyRoutes.ts:74` no longer depends on it.
- `POST /query`, `uploadKundli` and OpenAI go, after confirming no caller (none found in web).
- Boot refuses to start on Lambda if `GEMINI_API_KEY`, `GROQ_API_KEY` or `OPENAI_API_KEY` is set.
- `noExternalHosts.test.ts` fails on any `https://` host in `src` not on the allow list (AWS, and the Turnstile verify endpoint).
- Birth place lookup uses only Radha's `_PLACE_COORDS_LOOKUP` and world-cities CSV (`utils.py:45-50`, off by default today) and the server's `BUILTIN_CITY_COORDS`. Not found means asking the person to pick a city (4.5), not asking the internet.

**After cutover:** delete remaining `cachedContents` through Google's API, revoke the Gemini key, and remove `GEMINI_*` and `aiastra/chat-llm` entries.

### 4.3 API

All GraphQL and REST responses carrying personal data set `Cache-Control: no-store`. CloudFront must not cache them; confirm the behaviour in phase 4.

| Endpoint | Change | Response | Errors the client handles |
|---|---|---|---|
| `me` | Drops `date_of_birth`, `time_of_birth` | id, email, name, role, country, city, language, plan | `PII_UNAVAILABLE` |
| `myBirthDetails` (new) | Fetched only when the person opens the section | date, time, place, gender | `PII_UNAVAILABLE`, 401 |
| `myBiodata` | Filtered to named fields, no coordinates or raw blob | name, place, nakshatra, Lagna | same |
| `myKundliDisplayData` | Full charts for research accounts only; others get nakshatra and Lagna, no date, time or place (`kundliSidebar.ts:5-19`) | as stated | same |
| `chats`, `chatMessages`, `myContent`, `myTimeline`, `/api/chat/ask-stream` | Shape unchanged, owner only | unchanged | same |
| `deleteMyAccount` (new) | Requires a fresh emailed code | `{ ok }` | code invalid or expired |
| `startSignup`, `requestMagicLink`, `loginWithMagicLink` | Shape unchanged. Lookups use the blind index | unchanged | "Sign-in unavailable" on `PII_UNAVAILABLE` |
| `adminListUsers`, `adminGetUser`, `referralStats` | Masked (`s***@y***.com`, name initials). Search is exact email only, since substring search cannot work on sealed data | masked | |
| `adminGetUserKundli` | Removed. Support reads no charts | | |
| `adminUpdateUser` | Birth fields removed | | |
| `/debug/kundli/:user_id`, `POST /query` | Removed | 404 | |
| `POST /events` | Token becomes mandatory (`kundliSyncWorker.ts:50` passes when none is configured) | unchanged | 401 |

REST returns 503 with `{ code: "PII_UNAVAILABLE" }`; GraphQL returns the same code in `extensions`. Birth values never appear in an error message.

### 4.4 Frontend experience

- **Profile:** name and email show as now. Birth details show a closed row; opening it calls `myBirthDetails`; the values live in React state and leave on close or navigation. Editing keeps the form.
- **Chat sidebar:** non-research accounts see nakshatra and Lagna only. Research accounts see the tables as now, fetched when the sidebar opens.
- **Sign-up:** the draft stays in memory across the two pages rather than in sessionStorage, so a refresh loses it. Fill is short; acceptable.
- **Sign-out:** clears token, user id, and anything session-scoped.
- **No personal value in browser storage, URL, page title or analytics event.** `astroUser` stops holding name and email. Location is held in memory and sent with the question.
- **Failure:** on `PII_UNAVAILABLE` the screen keeps its layout and shows the message below with a retry. It retries once after 5 s by itself on the chart and chat screens. Nothing is cached in the browser to fall back on.
- **Reading screens:** pending, thinking and answer states are unchanged, and streaming is the same SSE contract. Time to answer changes with the model; phase 1 reports it before anyone sees it.

### 4.5 UI/UX: words on screen

| State | Words |
|---|---|
| Birth details closed | "Birth details: hidden. Show" |
| Key service down, screens | "We can't open your account data right now. Try again in a minute." |
| Key service down, sign-in | "Sign-in is unavailable right now. Try again in a minute." |
| Place not found at sign-up | "We couldn't find that place. Pick the nearest city from the list." |
| Delete account, step 1 | "This deletes your account, charts, questions and answers. It can't be undone. We've emailed you a code to confirm." |
| Delete account, done | "Your account is deleted. Your data will be unreadable everywhere within 7 days." |

### 4.6 Privacy policy: the words this plan supports

**Publish only after phase 5 closes and `02-evidence.md` backs each sentence, and after a lawyer has read it.** The policy never names the internal chart engine (`SOUL.md`).

> **How your information is protected.** Your name, email, birth details, charts, questions and answers are encrypted before they are stored, using keys held in Amazon Web Services (AWS) Key Management Service. Each person has their own key. Our database provider, Render, stores only the encrypted form and has no access to the keys.
>
> Your information is decrypted only inside our application on AWS, and only for the moment it is needed to create your chart, answer your question, or show it to you. It is sent to your device over an encrypted connection, and only when you are signed in. We do not keep it in your browser after you sign out.
>
> Answers are generated by AI models on Amazon Bedrock in US AWS Regions. AWS does not share your prompts or answers with model providers, and they are not used to train models. We have turned on Bedrock's zero data retention setting. We do not send your information to any AI provider outside AWS.
>
> Our staff tools show masked information, not your birth details, charts or questions. Use of the encryption keys is recorded in an audit log.
>
> When you delete your account we destroy your key, which makes your information unreadable everywhere, including backups, within 7 days.
>
> Two other services receive limited technical information, never your birth details, charts or questions: Cloudflare, for the security check on sign-in forms (your IP address), and Google Analytics, for measuring how the Service is used. Payment and app store providers will receive what is needed to take payment, once paid plans open.

Changes elsewhere in `LegalPages.tsx`: section 4 replaces "Artificial intelligence providers" with Amazon Bedrock and changes Render's line; section 6 narrows browser storage; section 8 adds the 7 days; section 9 adds in-app deletion; section 10 keeps "no system is completely secure".

**What we must not say:**

| Claim | Why not |
|---|---|
| "Your information is never available decrypted" | The server and the browser both must read it |
| "Your data never leaves AWS" | Render holds the ciphertext; Cloudflare and Google Analytics get IP and usage; the browser is outside AWS |
| "We can't see your data" | We hold the keys through AWS. Masking and audit limit it; cryptography does not prevent it |
| "End-to-end encrypted" | The server reads it, by design |
| "Gemini on Bedrock" | Does not exist |
| Anything about data sent before cutover | Google received it on Google's terms. Earlier traffic may have used an unpaid key tier, and the current tier is Sachin's word, not read from Google. Lawyer to advise on whether past traffic needs disclosure |

## 5. Architecture

```
Browser ── TLS ──> CloudFront + WAF ── SigV4 ──> aiastra-server-api (Lambda, plaintext in memory only)
                                                    │
        ┌──────────────┬──────────────┬─────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼             ▼              ▼              ▼
   KMS (wrap,      DynamoDB       Bedrock us.    aiastra-      Cognito/SES    Render Postgres
   HMAC keys)    aiastra-user-    (Haiku,        pyjhora       (email, name)   CIPHERTEXT ONLY
   CloudTrail    keys (wrapped    Sonnet,        (Radha,                        no keys
                 DEKs only)       gpt-oss)       no KMS)
                                                    ▲
                     aiastra-kundli-worker ─────────┘ (same keys, same store; chart builds, backfill)
```

| Boundary | What it guarantees |
|---|---|
| Lambda to Render | Only sealed values and blind indexes cross. Tested by `piiAtRest.test.ts` and `pii-audit.ts` |
| Lambda to KMS, DynamoDB | Only these two roles can unwrap. Every unwrap is in CloudTrail with `key_ref` |
| Lambda to Bedrock | IAM limits it to `us.` profiles. Retention mode `none`. Invocation logging stays off, confirmed in phase 0 and in the evidence doc |
| Lambda to Radha | Plaintext in the invoke payload, inside AWS. Radha holds no keys and logs no input after the Radha change |
| Lambda to browser | TLS. Owner only. Only the fields the opened screen needs. `no-store` |
| Lambda to logs | Allow-listed fields. `noPiiInLogs.test.ts` runs flows with sentinel values and fails if one is logged |

Runs where: sign-in and reading on the request path; chart builds and backfill in the async worker. There is no new scheduled sweep, and one is removed.

## 6. Ingredients

| Item | Who |
|---|---|
| Admin path into 442728149528 | Sachin |
| KMS keys `alias/aiastra-pii-wrap`, `alias/aiastra-pii-bidx` ($1 a month each, plus up to $2 a month for rotation, plus per-request; request rate to confirm) | Sachin or admin |
| DynamoDB `aiastra-user-keys`, on demand, deletion protection, PITR 7 days | Sachin or admin |
| IAM for `aiastra-server-api` and `aiastra-kundli-worker` roles: KMS as in 4.1.1; DynamoDB on that table; `bedrock:InvokeModel`, `InvokeModelWithResponseStream` on `us.` profiles and US foundation-model ARNs; AWS Marketplace rights for first use, since third-party models bill through it | Sachin or admin |
| Eval role: invoke only, for fixture chart G1 | Sachin or admin |
| Bedrock: model access, quota read for Claude Haiku 5.5 and Sonnet 5.5, resolve the TODOS conflict on gpt-oss quota, `PUT /data-retention` `{ "mode": "none" }` in all three US Regions, confirm invocation logging off, then an SCP or IAM deny on changing it | Sachin or admin |
| CloudTrail trail on, confirmed, with retained logs | Sachin or admin |
| Env: `PII_KMS_WRAP_KEY_ARN`, `PII_KMS_BIDX_KEY_ARN`, `PII_KEYS_TABLE`, `PII_WRITE_MODE`, `READING_LLM_PROVIDER`, `READING_MODEL_*=bedrock:us.anthropic...`, `BEDROCK_REGION` | deploy session |
| Env removed: `GEMINI_*`, `GROQ_API_KEY`, `OPENAI_*`, `CHAT_LLM_PROVIDER`, `ENCRYPTION_KEY` | deploy session |
| Libraries: `@aws-sdk/client-kms`, new. `client-dynamodb`, `client-bedrock-runtime` are already in. No crypto library: `node:crypto` | agent, install through Haiku |
| Migrations M20, M21, M22 | agent writes; M20 applied under the standing OK for testing; M21 and M22 drop data, so each needs a yes |
| Fixtures: chart G1 in `evals/fixtures/G1`, question set in `evals/questions.ts` | exists; add sensitive-topic questions |
| Render: backup retention, SOC 2 and encryption statement in writing | Sachin |
| Legal: lawyer read, entity name and support address (already open in TODOS) | Sachin |

## 7. Action steps in sequence

**Tracks A and B do not depend on each other and can run at once on separate branches.** Both touch `prisma/schema.prisma` only by appending; A owns M22, B owns M20 and M21. Track C needs both.

**Phase 0: stop the obvious and read the facts**

| # | Step | Files | Done |
|---|---|---|---|
| 0.1 | Remove PII logs: GraphQL body, Radha response preview, raw model output | `server.ts:141-146`, `astroKundliClient.ts:839-860,869,876`, `kundliService.ts:120-125`, `emailService.ts:56` | Lines gone, test added |
| 0.2 | Remove `/debug/kundli`, require the `/events` token | `server.ts:371`, `kundliSyncWorker.ts:50` | 404 and 401 by test |
| 0.3 | Stop the hardcoded personal narrative reaching other users (see TODOS) | `reading/timeline/pastReadingFlow.ts:359,511` | Builders use only the person's own inputs |
| 0.4 | Stop Nominatim on the server | `chartData/store.ts:575-600` | Falls to "place not found" |
| 0.5 | Read-only facts: deployed env (`ENCRYPTION_KEY`, models, cache flags, `TIMELINE_ENABLED`), row counts and sizes per table, share of `enc:` values, `login_attempts` rows, Render backup retention, CloudTrail, Bedrock logging | none | Filled into `02-evidence.md`, values never printed |
| 0.6 | Sachin's decisions 1 to 4 | | Recorded here |

**Phase 1: Bedrock behind a flag (track A)**

| # | Step | Files | Done |
|---|---|---|---|
| 1.1 | Provider seam; ten call sites move, still on Gemini | `reading/llm/provider.ts`, call sites | `tsc`, unit tests, no behaviour change |
| 1.2 | Adapter: stream, schema, cachePoint, thinking map, refusal, prices | `bedrockAdapter.ts`, `models.ts` | Unit tests with the existing fake |
| 1.3 | AWS ready; one test call per model and mode, including the schema field | | Each returns; `none` retention does not block them |
| 1.4 | Eval harness takes a provider; run arms on G1 only | `evals/run.ts` | Report per arm |
| 1.5 | Sachin reads side-by-side answers | | Choice recorded |

**Phase 2: cut over (track A)**

| # | Step | Files | Done |
|---|---|---|---|
| 2.1 | Flag on for superadmin on staging, then all staging | env | Live readings, traces show `bedrock:` |
| 2.2 | Remove Gemini, Groq, OpenAI, caches, `/query`; add boot check and host test | list in section 3; M22 | Tests pass |
| 2.3 | Delete remaining `cachedContents`; revoke key; retire DynamoDB table | Google API, AWS | API lists none; key refused |
| 2.4 | Radha: no Nominatim, no input logs, no export log | `AIAstra_Radha/src/jhora/export.py`, `api.py` | Grep and a CloudWatch sample show none |

**Phase 3: encryption foundation (track B)**

| # | Step | Files | Done |
|---|---|---|---|
| 3.1 | `keys`, `seal`, `blindIndex`, field map | `src/lib/pii/*` | Unit tests: round trip, wrong AAD fails, wrong key fails, no plaintext fallback |
| 3.2 | Prisma extension and guard | `prismaExtension.ts`, the client's creation site | Every model round-trips; sealed `where` throws |
| 3.3 | Raw SQL sites | the 7 files, `rawSql.ts` | List test passes |
| 3.4 | Keyed hashes | `factsBuilder.ts`, `store.ts`, `ephemerisCache.ts`, `graph.ts` | No rebuild when sealing |
| 3.5 | M20, AWS resources, deploy read-both, then `PII_WRITE_MODE=sealed` on staging | M20 | New signup sealed in raw row; flows green; `pii_key_ms` logged |

**Phase 4: backfill and browser (tracks B and C)**

| # | Step | Files | Done |
|---|---|---|---|
| 4.1 | Backfill in worker; audit script | `kundliSyncWorker.ts`, `scripts/pii-audit.ts` | Audit 0 unsealed on staging, then live, each with a yes |
| 4.2 | API changes | `schema.ts`, `profileService.ts`, `adminService.ts`, `kundliSidebar.ts` | API tests |
| 4.3 | Web changes | list in section 3 | Web tests, stubbed walkthrough with screenshots per `TEST.MD` |
| 4.4 | `deleteMyAccount`, in-app action | `schema.ts`, web profile | Key gone, rows gone, sign-in refused |
| 4.5 | Review scripts: delete `backfill-local-facts.ts`; `billing-set-paid.ts` uses the index and prints no email; `e2e-live-db.ts` fixtures only | `scripts/` | Reviewed |

**Phase 5: claim it (track C)**

| # | Step | Files | Done |
|---|---|---|---|
| 5.1 | M21 contract, after a Render snapshot and Sachin's yes | M21 | Applied |
| 5.2 | Render's old backups age out; DB dump test on a fresh backup | | Search for sentinels finds none |
| 5.3 | Evidence doc complete; lawyer reads; publish policy with a new date | `02-evidence.md`, `LegalPages.tsx` | Live |

## 8. Development phases

Sizes are rough estimates in agent working days, not measured. Waiting on AWS access or a human is extra.

| Phase | Leaves the system | Closing check | Size | Deferred to next |
|---|---|---|---|---|
| 0 | Same product, fewer leaks, facts known | Tests; `02-evidence.md` first version | 1 | Everything else |
| 1 | Gemini live; Bedrock provable | Eval report on G1 and Sachin's choice. Gate: dropped claims and grounding no worse than the Gemini baseline, no refusal on the question set, p50 complete time no worse by more than 25%, cost per question inside the cap | 2 to 3 | Live traffic |
| 2 | All model traffic on Bedrock | `reading_traces` shows only `bedrock:` for 48 h; Google lists no caches; host test green | 1 to 2 | Encryption |
| 3 | New data sealed, old readable | Raw-row check on staging; sign-in added latency measured, under 50 ms | 3 to 4 | Old rows, browser |
| 4 | Everything sealed, browser minimal, deletion works | Audit 0; walkthrough screenshots; account deletion test | 3 | Column drops, policy |
| 5 | Claim published | Dump test; lawyer's yes; new policy live | 1, plus backup wait | Database move, if chosen |

**Quickest honest milestone:** phases 0 to 2, which remove Google, Groq, OpenAI and OpenStreetMap from the data path without touching stored data. The policy can then truthfully change its AI provider line, even before encryption ships.

## 9. Recommendation

**Do it in this order: stop the leaks, move models, then encrypt, then claim.** Models first because you asked for it soonest, it is the smaller change, and it removes the largest outside party. Encrypt with per-person keys in KMS, keys and ciphertext held apart, at application level, with Render kept for now.

### Decisions only Sachin can make

**1. Which model replaces Gemini?** The choice exists because Gemini is not on Bedrock. Readings will read differently, and only you can judge whether they are good enough.
1. **Claude on Bedrock, Haiku 5.5 plus Sonnet 5.5, subject to the eval. (Recommended.)** Likely to work: the features the code needs (stream, schema, cache, thinking) are all on the model cards. Synth output costs about 2.7 times `gemini-3.8-flash` at Anthropic's list price; workers cost less.
2. Stay on Gemini and drop the AWS claim. Nothing breaks. The policy keeps saying "AI providers", and charts keep going to Google.
3. Gemini through Vertex. Keeps the voice, but data goes to Google Cloud, so no AWS claim is possible.

Stopping now costs nothing: phase 0 has no dependency on this.

**2. What may the browser receive?** You asked for no decrypted data in the UI. Taken literally, a person could not see their own chart, and no one could read their answer.
1. **Owner only, over TLS, minimum fields, birth details hidden until opened, nothing stored. (Recommended.)** This is what section 4 builds and section 4.6 words.
2. Add payload encryption above TLS, decrypting in page JavaScript. It would hide bodies from CloudFront and WAF, but the page still holds plaintext, so the policy sentence does not get stronger. Not worth it now.
3. Remove birth details and chart tables from the UI completely. This is a real option: answers would remain, and the browser never gets the raw chart. It removes the research sidebar and profile birth fields. Answers still contain personal content, so the "never" sentence is still false.

**3. Where does the database live?** A note from October says do not propose RDS, and the Terraform inventory says the same unless a separate cutover is planned. That is why this plan does not assume it.
1. **Keep Render now, ciphertext only; claim "readable only inside AWS". (Recommended.)** No move risk. Render's own encryption and region (`virginia`) remain; written assurance is unread.
2. Move to Aurora PostgreSQL in the same account, as a separate plan, after phase 5. Only this gets close to "stored in AWS". Aurora can pause at 0 capacity but adds cost, a connection path from Lambda and a cutover window. Do this if you want that sentence or if investors or app stores ask.

Stopping at option 1 leaves nothing half done.

**4. AWS access.** Everything in sections 6 to 8 past phase 0.4 and step 1.2 needs someone who can create KMS keys and change IAM in 442728149528. That path was deliberately given up on 2026-10-25. Either you create the resources from a list, or you grant a named role. **Recommended: you create them from section 6, with no standing admin for agents.** Without this, tracks A and B stop at unit tests.

### Decided here, with verdicts

| Choice | Decision | Why |
|---|---|---|
| Field encryption in the app vs Postgres `pgcrypto` | App | `pgcrypto` passes keys or plaintext through Render in the query |
| Render disk encryption alone | Not enough | Render can read it; a leaked `DATABASE_URL` reads it |
| Per-person DEK vs one app key | Per person | Deletion by key destruction; one person's exposure stays with them; audit by person; little more code |
| One KMS key per person | No | $1 a month each |
| AWS Encryption SDK | No | Its message format is built for whole messages and adds overhead on thousands of small fields. AES-GCM through `node:crypto` is already in the repo, with tests for tampering and swaps |
| Wrapped keys in Postgres | No | Backups would keep them and deletion would not reach them |
| Prisma extension vs hand-written calls | Extension plus a guard | 16 files touch `auth` and 17 touch the kundli tables; a forgotten call would write plaintext silently |
| Encrypted search | Exact match by blind index only | Nothing else needs more. Admin substring search goes |
| Turnstile and Google Analytics | Keep, carved out in the policy | They see no chart data. Replacing them with AWS WAF CAPTCHA and CloudWatch RUM is possible later if the sentence must be simpler |
| Fable 5.1 for synth | Excluded | 30-day retention and possible human review contradict the claim |
| `global.` inference profile | Blocked | Routes outside the US |

## Sources

- AWS, Bedrock: [data retention](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html), [abuse detection](https://docs.aws.amazon.com/bedrock/latest/userguide/abuse-detection.html), [Sonnet 5.5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html), [Haiku 5.5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html), [prompt caching](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html), [data use](https://repost.aws/knowledge-center/amazon-bedrock-model-data-use), [pricing](https://aws.amazon.com/bedrock/pricing/)
- AWS, other: [KMS pricing](https://aws.amazon.com/kms/pricing/), [Aurora serverless capacity](https://aws.amazon.com/blogs/database/understanding-how-acu-minimum-and-maximum-range-impacts-scaling-in-amazon-aurora-serverless-v2/)
- Other: [Gemma 4 on Bedrock](https://aws.amazon.com/blogs/machine-learning/introducing-gemma-4-models-on-amazon-bedrock/) (announced, but not in the us-east-1 `list-foundation-models` result), [Render encryption, community thread](https://community.render.com/t/encryption-at-rest/3609) (weak source; hence the request for written assurance)
