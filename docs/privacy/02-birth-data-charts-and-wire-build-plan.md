# 02 — Encrypting birth details and charts at rest, and what to do about the wire: build plan

Status: plan only, written 2026-11-04 for the Opus build session. Migration numbers moved up one (M26-M28) because M25 is now the admin app's staff accounts. No code, migration or AWS resource has changed. Written to
"How a plan is written" in `AGENTS.md`. This is the build plan for the encryption track of
`01-encryption-and-bedrock-plan.md` (its "track B"), separated from the Bedrock move so it can ship on its own, with the three
questions Sachin asked on 2026-11-04 answered first. Doc 01's design decisions stand unless a row below says otherwise. Facts
were re-checked against the code on 2026-11-04 (the survey confirmed every claim of doc 01 §1 that it re-read). Live rows,
the deployed Lambda env and Render's backup retention were not read. The evidence doc that doc 01 called `02-evidence.md`
becomes `03-evidence.md`.

## 0. The three questions, answered

**Q1. Encrypt the birth-detail columns, encrypt the charts the engine returns, or encrypt the database as a whole?**

All three mean different things, and only one gives the promise Sachin wants:

| Option | Protects against | Does not protect against | Verdict |
|---|---|---|---|
| Render's disk encryption (exists today, assurance unread) | A lost disk at Render | A leaked `DATABASE_URL`, a database dump, a Render employee, a backup copy, a SQL client | Keep as the floor; it is not the promise |
| Postgres `pgcrypto` column encryption | A dump without the key | Keys or plaintext pass through Render in every query, and appear in its query logs | No |
| **Application-level envelope encryption of the personal columns, keys in AWS KMS** | Dump, leaked URL, Render staff, backups (ciphertext only), and per-person erasure by destroying the key | A compromised running Lambda; an AWS admin who changes the key policy | **Yes. This plan.** |
| Move the database into AWS (Aurora) with KMS at rest | "Stored in AWS" claim | Still the leaked-URL and dump cases unless columns are also sealed | Separate decision, doc 01 §9 decision 3; this plan does not need it |

**Q2. Encrypt or obfuscate the birth details after the charts have been pulled, then encrypt the charts?**

Two facts change the shape of this:

1. **The birth details cannot be discarded after the pull.** Charts are re-pulled every time the calculation engine changes (`docs/TODOS.md`
   records three such re-pulls in the last two weeks), the dossier rebuild needs them (`src/reading/data/factsBuilder.ts:37-53`), transit
   charts send them again (`src/reading/chartData/transit.ts:82-89`), and the prashna cast falls back to them (`src/reading/chartData/prashna.ts:115-155`).
   So "obfuscate after use" means: keep them, sealed, and open them only inside the Lambda for the moment of an engine call.
2. **The charts contain the birth details.** `kundlis.biodata` holds `date`, `time`, `time_zone`, `place`, `place_name`; `kundli_facts.dossier.birth`
   holds date, time, place, lat, lon, tz; `kundli_data` type `panchanga.birth` is the biodata again (`src/reading/chartData/catalog.ts:141`).
   Sealing `auth.date_of_birth` while leaving these plain protects nothing. So the unit of sealing is **the person's whole personal set**:
   birth fields, coordinates, every chart payload, the dossier, per-person transit rows, questions, answers and findings.

Therefore: one scheme, one key per person, every personal column sealed, as doc 01 §4.1.3 lists. Nothing is "obfuscated" as a separate
step; tokenisation would add a lookup table with the same exposure and no gain over a per-person key.

**Q3. The reading sent to the browser: can it be stored, or should it be encrypted JSON so DevTools or a cache cannot read it?**

Encrypting the JSON above TLS does not do what it sounds like. The page must decrypt it to show it, so the key is in the page's JavaScript
and the decrypted text is in React state, both one click away in DevTools. Anyone who can open DevTools on that browser is that signed-in
person, or has their device. What actually stops a reading being readable "after the fact" is:

| Risk | Real lever | State today |
|---|---|---|
| A cache (CloudFront, browser, proxy) keeps a response | `Cache-Control: no-store` on every response carrying personal data; CloudFront already `CachingDisabled` | SSE sends `no-cache` (not `no-store`); GraphQL sends nothing (`server.ts:222`, `docs/privacy/01` §4.3) |
| Browser storage keeps it | Keep readings only in memory, never in `localStorage`/`sessionStorage`/IndexedDB; clear session storage on sign-out | Readings are already only React state. `sessionStorage` holds the sign-up birth draft and the question location; `astroUser` in `localStorage` has empty birth fields but the shape invites filling them (`AIAstra_WEB/src/App.tsx:14-20`) |
| A shared device after sign-out | Sign-out clears every key the app wrote; idle timeout | `Auth/logout.ts:19-24` does not clear session storage |
| The back button or bfcache shows the page | `no-store` plus the idle timeout already in `sessionRestore.ts` | partly |
| Model "thinking" text on the wire | Stop streaming `thought` deltas to the browser (they mention chart details and are kept server-side in `reading_runs.thinking` anyway) | Streamed today (`run.ts:334`) |
| Server-side copy | The sealed `messages.ai_answer`, `reading_runs.answer` (this plan) | plain today |

**Verdict:** TLS plus `no-store` plus memory-only state plus a clean sign-out, not payload encryption. The one case where payload encryption
buys something is hiding bodies from an inspecting edge (WAF rules, a future body-logging CloudFront setting). That is a cost with no
present threat; it stays rejected (doc 01 §9 decision 2, option 2) and is listed under deferred.

## 1. Start: the system today (delta to doc 01 §1)

Doc 01 §1 is current. The 2026-11-04 survey adds these facts, all read from code:

| Fact | Where |
|---|---|
| `src/lib/encrypt.ts` stores plaintext when `ENCRYPTION_KEY` is unset and returns ciphertext on a failed decrypt. `ENCRYPTION_KEY` is absent from local `.env` and from the Lambda env inventory (`aiastra-aws-terraform/docs/INVENTORY.md:52`, a snapshot). **Assume every row is plaintext until phase B0 reads one.** | `encrypt.ts:30,59-61` |
| `services/userLocation.ts birthPlaceFor` reads `place_of_birth` with no decrypt and feeds the clarify "Same as birth place" chip; with a key set it would show ciphertext. | `userLocation.ts:131-137`; `reading/clarify/service.ts:110` |
| Birth date, time and place go into the model prompt. | `reading/packs/selector.ts:297`; `reading/run.ts:148` |
| Chart payload sizes: dossier about 96 KB, transits about 51 KB, dashas 14–50 KB, legacy d-charts 5–7 KB, biodata under 1 KB; doc 21 estimates 1–2 MB per person across about 60 rows. | `evals/fixtures/G1`, `docs/reading-engine/21:143` |
| Engine transport is `InvokeCommand` to `aiastra-pyjhora` inside AWS, body `{dob, tob, place, ayanamsa, type, ...lat, lon, tz, natal_*}`; the first 1,500 characters of every response are logged. | `src/lib/astroKundliClient.ts:116-242,763-767,836-848` |
| In-process caches on a warm Lambda hold opened charts: `data/store.ts:43-51` (TTL `READING_CACHE_TTL_MS`, 300 s), `oracle/chartBundle.ts:54`, `nodes/findingsCache.ts:21`. These are memory inside the Lambda and are allowed by the promise. | as cited |
| Secrets: `DATABASE_URL` and `JWT_SECRET` are plain function env vars on the live Lambda; the entrypoint reads Secrets Manager only when they are absent. | `docker-entrypoint.mjs:23-43`; `Dockerfile.lambda:9-11` |
| Real personal data is committed to the repository: `evals/fixtures/G1/*` (a real chart and biodata), `kundli.json`, `docs/reading-engine/36-*`, `37-*`. | repo root and `docs/` |
| Raw SQL that touches personal tables: `reading/chartData/prashna.ts`, `reading/chartData/store.ts`, `reading/timeline/ledgerStore.ts`, `reading/timeline/store.ts`, `reading/transits/ephemerisCache.ts`, `services/kundliSyncWorker.ts`, `services/userLocation.ts`. | doc 01 §1 |
| Unkeyed hashes over birth fields: `kundli_facts.source_hash` (sha256 cut to 16 hex), `payload_hash` (md5), `ephemerisCache.ts:83`, `packs/selector.ts:464`, `timeline/foundation.ts:92`. | as cited |

Modules touched by this plan, counted from the survey: 16 files write or read `auth` birth fields, 17 files touch the kundli and chart tables,
7 files use raw SQL on personal tables, 5 files compute hashes over personal values, 9 web files hold or store personal values. The Prisma
extension (section 4.1) is what keeps that from being 40 hand edits that can each be forgotten.

## 2. End goal

As doc 01 §2, restated for this track only:

- Birth details, coordinates, every chart payload, the dossier, per-person transit rows, questions, answers, findings and life events are
  sealed before they reach Render, under a per-person key wrapped by AWS KMS. A full Render dump, a backup, or a leaked `DATABASE_URL`
  yields no personal value. `scripts/pii-audit.ts` proves 0 unsealed values per column.
- Values are opened only inside the API Lambda and the chart worker, in memory, for a sign-in lookup, an engine call, a model call, or a
  response to the owner. They appear in no log line (`noPiiInLogs.test.ts`).
- The browser receives the owner's data over TLS with `no-store`, holds it in memory only, and keeps nothing after sign-out.
- Admin tools show masked values (`docs/admin/01` already builds this).
- Deleting an account destroys its key; its rows are unreadable everywhere within 7 days.
- Readers notice nothing: under 50 ms added on the first request per person per instance, under 5 ms after (measured in B3).

What is **not** promised, and the policy must not say: "never decrypted", "never leaves AWS", "end-to-end encrypted" (doc 01 §4.6).

## 3. Deliverable

**Server**
- `src/lib/pii/`: `fields.ts` (the sealed-field map, section 4.1.3), `keys.ts` (KMS + DynamoDB provider, local file provider), `seal.ts`
  (AES-256-GCM with AAD), `blindIndex.ts` (KMS `GenerateMac`, local HMAC), `hash.ts` (keyed hashes), `prismaExtension.ts`, `rawSql.ts`,
  `audit.ts` (counting only).
- `src/lib/prisma.ts` creates the client with the extension. `src/lib/encrypt.ts` is deleted in B5.
- The 7 raw-SQL files use `sealParam`/`openRow`. The 5 hash sites use `hash.ts`.
- `services/userLocation.ts`, `profileService.ts`, `authService.ts`, `auth/emailCode.ts`, `ensureAdmins.ts`, `scripts/*` use the extension
  (no direct `encrypt()`), and lookups by email/username go through the blind index.
- `services/kundliSyncWorker.ts`: `pii_backfill` event (one person per transaction, resumable).
- GraphQL: `myBirthDetails` (new), `deleteMyAccount` (new), `me` without birth fields, `myBiodata` filtered, `myKundliDisplayData` per `kundliSidebar.ts`.
- Migrations (written; staging under the standing OK; live and the destructive one need Sachin's yes):
  `20261106100000_pii_m26_expand`, `20261106110000_pii_m27_drop_llm_cache_entries` (only when the Bedrock track has removed the prompt cache; otherwise skipped),
  `20261120100000_pii_m28_contract` (destructive, last).
- `scripts/pii-audit.ts`, `scripts/pii-reseal-user.ts` (re-seal one person after suspected key exposure).
- Tests: `tests/unit/pii/*`, `tests/integration/piiAtRest.test.ts` (reads raw rows through a second plain client), `tests/unit/noPiiInLogs.test.ts`,
  `tests/unit/rawSqlAllowList.test.ts`.

**Web**: `Auth/logout.ts`, `App.tsx` (`astroUser` loses birth fields), `BirthDetails.tsx` (draft in memory), `useQuestionLocation.ts` (memory),
`ProfileSection.tsx` (closed birth row, `myBirthDetails` on open), `ChatRightSidebar.tsx`, `LegalPages.tsx` (B5 only), `readingProgress.ts`
(no `thought` handling once the server stops sending it).

**Radha (`AIAstra_Radha`)**: no Nominatim fallback, no input logging, no export log (doc 01 step 2.4). Independent of this track; it can ship any time.

**AWS (Sachin or an admin; never terraform from an agent)**: KMS keys `alias/aiastra-pii-wrap` (symmetric, annual rotation) and
`alias/aiastra-pii-bidx` (HMAC_256); DynamoDB `aiastra-user-keys` (on demand, deletion protection, PITR 7 days); IAM on
`aiastra-api-lambda-exec` and the worker role; CloudTrail confirmed on.

**Env**: `PII_KEY_PROVIDER=kms|local`, `PII_KMS_WRAP_KEY_ARN`, `PII_KMS_BIDX_KEY_ARN`, `PII_KEYS_TABLE`, `PII_WRITE_MODE=plain|sealed`,
`PII_LOCAL_KEY_FILE` (local only). Removed in B5: `ENCRYPTION_KEY`.

**Docs**: this plan, `03-evidence.md`, `docs/TODOS.md` updates.

## 4. Exactly how it works when done

### 4.1 Backend

#### 4.1.1 Keys (doc 01 §4.1.1, unchanged)

Per-person AES-256 data key (DEK) made by KMS `GenerateDataKey` at sign-up, stored wrapped in DynamoDB `aiastra-user-keys` under an
opaque `key_ref` (UUID, also on `auth.key_ref`); encryption context `{ key_ref }` on every KMS call; 500-entry, 5-minute LRU of unwrapped
DEKs per instance; blind-index HMAC through KMS `GenerateMac`; keyed hash key `HKDF(DEK, "hash-v1")`. Keys live only in AWS so Render's
backups cannot open anything, and deleting the key item is the erasure.

**Local and test:** `PII_KEY_PROVIDER=local` reads one 32-byte master key from `PII_LOCAL_KEY_FILE` (outside the checkout), derives
per-person DEKs with HKDF by `key_ref`, and does HMAC with a second derived key. Same code paths, no AWS. Refused when
`AWS_LAMBDA_FUNCTION_NAME` is set.

#### 4.1.2 Sealing (doc 01 §4.1.2, unchanged)

AES-256-GCM, random 12-byte IV, AAD `table.column.key_ref`; text columns become `pii2:<key_ref>:<iv>:<ct+tag>`; JSON columns keep their type
and hold `{ "$pii": "pii2:..." }`; payloads over 4 KB are gzipped first (`pii2z:`), which matters here because the chart rows are 5–96 KB each
and Postgres TOAST compression stops helping once they are ciphertext. Blind index `HMAC(bidx, lower(trim(value)))` in `email_bidx`,
`username_bidx`. A failed open **throws** `PII_UNAVAILABLE`; it never returns ciphertext.

**Measured budget to confirm in B3:** sealing a 96 KB dossier is one gzip (about 2–4 ms) plus one AES-GCM pass (under 1 ms); a reading opens
about 10 rows, so under 30 ms of CPU per reading plus one KMS unwrap per person per instance (about 20–40 ms, then cached). A chart build
seals about 60 rows over several minutes of worker time; negligible.

#### 4.1.3 What is sealed

Doc 01 §4.1.3's table is the field map and goes into `src/lib/pii/fields.ts` verbatim. The rows this track must not forget, because the
survey found them plain today and they carry birth details or charts:

| Table | Sealed | Why it matters here |
|---|---|---|
| `auth` | `email`, `username`, `name`, `date_of_birth`, `time_of_birth`, `place_of_birth`, `city`, `country_code`, `gender`, `signup_ip`, `cognito_session` | the birth columns Sachin named |
| `kundlis` | `biodata`, `d1`..`d10`, `charakaraka`, both dashas, `other_readings`, `place_resolved`, `last_sync_error`, new `coords` (replaces `lat`, `lon`, `tz`) | biodata repeats the birth details |
| `kundli_data` | `payload`, `error`, `params` | every chart from the engine; `panchanga.birth` is the biodata |
| `kundli_facts` | `dossier`, `natal_points`; `source_hash` and `dossier_hash` become keyed | `dossier.birth` |
| `kundli_transit_overlays`, `transit_snapshots` (where `kundli_id` set), `prashna_casts` (`payload`, `place_resolved`, new `coords`) | per-person sky rows |
| `transit_instants`, `transit_range_skies` | `lat`, `lon`, `tz` under a system key; `place_key` becomes an HMAC | the birth place's coordinates when a reading uses the birth place |
| `user_current_location` | `place`, `tz`, new `coords` | where they live |
| `chats.name`, `messages.question`, `messages.ai_answer`, `chat_logs.*_payload`, `reading_runs` text and JSON, `reading_agent_responses` text, `reading_traces.question`, `life_events`, `timeline_*` | the readings (Q3's server-side copy) |
| `admin_actions.before/after` (from `docs/admin/01`) | **left plain**: they hold plan and lock columns only, by construction; `tests/unit/admin/noPersonalFields.test.ts` keeps it so |
| `reading_agent_spans` | left plain: times, tokens, agent names only. `failure_reason` is an error type, not a message (checked in B2) |

Status, lock, queue, hash-index and timestamp columns stay plain so every `WHERE status = ...` and row-as-lock query keeps working unchanged.

#### 4.1.4 The Prisma extension and the guard

`prismaExtension.ts` is the one place all code paths pass through (doc 01 §4.1.2): seals mapped fields on every write kind including nested
and `createMany`; opens on every read including `include`; finds the owner's `key_ref` from `user_id`, or through `kundli_id`, `chat_id`,
`run_id` with a per-instance cache; throws on a `where`/`orderBy` that names a sealed field, except `email`/`username`, which it rewrites to the
blind index. Raw SQL cannot be seen by it, so the 7 files use `sealParam()`/`openRow()` and `rawSqlAllowList.test.ts` fails on any new
`$queryRaw`/`$executeRaw` outside the list.

**Read-both, write-by-mode.** Reads accept plaintext, legacy `enc:` (only if a key turns out to be set; B0 decides) and `pii2:`. Writes follow
`PII_WRITE_MODE`: `plain` until B3 flips staging to `sealed`. Rollback is flipping it back.

#### 4.1.5 Flows (doc 01 §4.1.4) with the engine call spelled out

- **Chart build** (`kundliQueueService.ts`, `chartData/store.ts`, `factsBuilder.ts`): the worker opens the `auth` birth fields and `kundlis.coords`
  through the extension, builds the engine body exactly as today (`astroKundliClient.ts:763-767`), invokes `aiastra-pyjhora` inside AWS, and the
  write of `payload` is sealed by the extension. The row-as-lock (`status`, `fetch_started_at`) is plain and untouched. The response log line
  (`astroKundliClient.ts:836-848`) is removed in B0, so the chart is never in CloudWatch.
- **Source hash:** computed over the opened birth values with the person's hash key, so sealing never looks like a birth change and never
  triggers a rebuild (`factsBuilder.ts:40`). Rewritten by the backfill in the same transaction as the seal.
- **Reading:** opens the 10-odd chart rows (cached 300 s in memory as today), builds the prompt with birth line and charts, calls the model,
  seals `answer`, `findings`, `messages.ai_answer` on write. One DEK unwrap per person per instance.
- **Sign-in:** `GenerateMac` on the typed email, lookup by `email_bidx`, same JWT as today.
- **Account deletion:** delete the DynamoDB key item first, then the rows in one transaction, then the Cognito user; revoke by `token_version`
  (from `docs/admin/01`). Unreadable everywhere within DynamoDB's 7-day PITR window.
- **Failure:** KMS 1 s × 2, DynamoDB 1 s × 2, then `PII_UNAVAILABLE`; cached keys keep working through an outage for 5 minutes; boot refuses on
  Lambda when KMS config is missing.

#### 4.1.6 Schema changes

`20261106100000_pii_m26_expand` (adds only):

```sql
ALTER TABLE auth ADD COLUMN key_ref text, ADD COLUMN email_bidx text, ADD COLUMN username_bidx text;
CREATE UNIQUE INDEX auth_email_bidx ON auth (email_bidx) WHERE email_bidx IS NOT NULL;
CREATE INDEX auth_username_bidx ON auth (username_bidx) WHERE username_bidx IS NOT NULL;
ALTER TABLE kundlis               ADD COLUMN coords text;        -- sealed JSON {lat, lon, tz}
ALTER TABLE prashna_casts         ADD COLUMN coords text;
ALTER TABLE user_current_location ADD COLUMN coords text;
ALTER TABLE life_events           ADD COLUMN event text;         -- sealed JSON {category, date, date_precision, place, attributes}
ALTER TABLE timeline_windows      ADD COLUMN window text;        -- sealed JSON {marker, from, to, band, testing, scores, systems, how, form}
ALTER TABLE timeline_matches      ADD COLUMN specifics_sealed text;
ALTER TABLE transit_instants      ADD COLUMN place_bidx text;    -- HMAC of place_key
ALTER TABLE transit_range_skies   ADD COLUMN place_bidx text;
```

`20261120100000_pii_m28_contract` (destructive, after audit 0 and a Render snapshot, Sachin's explicit yes): `email_bidx` NOT NULL, drop
`auth_email_lower_key`, drop `kundlis.lat/lon/tz`, `prashna_casts.lat/lon/tz`, `user_current_location.lat/lon/tz`, the old `life_events` and
`timeline_windows` columns, `transit_*.place_key`; drop `ENCRYPTION_KEY` handling.

Prisma: every sealed JSON column keeps `Json`; sealed text columns keep `String`. No type changes, so sealed and plain rows coexist during
the backfill.

#### 4.1.7 Backfill

`aiastra-kundli-worker` event `pii_backfill` (doc 01 §4.1.5 step 4): one person per transaction (auth row, kundlis, kundli_data, facts, overlays,
snapshots, prashna, chats, messages, chat_logs, reading_runs, responses, traces, life events, timeline rows), idempotent (skips values already
`pii2:`), 250 s per invocation then re-invokes itself with the last `created_at` cursor, one at a time. Runs in AWS so plaintext never
leaves it. At 1–2 MB per person and about 30 people, the whole backfill is minutes. `scripts/pii-audit.ts` counts unsealed values per column
through a plain client, prints counts only.

### 4.2 API

As doc 01 §4.3. The admin rows there are now satisfied by `docs/admin/01` (masked lists, exact-match search, no chart or birth field selectable).
Additions from Q3:

| Change | Detail |
|---|---|
| `Cache-Control: no-store` | On every GraphQL response with a bearer token (set once in the handler; `docs/admin/01` step 5 does this) and on both SSE routes (replace `no-cache, no-transform` with `no-store, no-transform`). |
| `thought` SSE event | Removed from `/api/chat/ask-stream` and `/api/chat/confirm-stream`; `reading_runs.thinking` keeps it server-side. `readingProgress.ts` drops the handler. |
| `/debug/kundli/:user_id` | Removed (doc 01 step 0.2). |
| `me` | Drops `date_of_birth`, `time_of_birth`; `myBirthDetails` serves them on demand. Errors: `PII_UNAVAILABLE`. |
| `myBiodata` | Named fields only (name, place name, nakshatra, lagna); no coordinates, no raw blob. |
| `deleteMyAccount` | Needs a fresh emailed code; `{ ok }`. |

### 4.3 Frontend experience and 4.4 UI/UX words

As doc 01 §4.4 and §4.5, plus:

- `Auth/logout.ts` clears `sessionStorage` entirely and every `localStorage` key the app writes except the region switch and reading UI prefs.
- `astroUser` becomes `{ name }` only; the three birth fields are removed from the type so nothing can fill them.
- The sign-up birth draft lives in React state across the two pages; a refresh loses it (fill is short).
- `useQuestionLocation` keeps the rounded location in memory for the tab's life.
- Birth details on the profile: "Birth details: hidden. Show" → fetch → shown until the section closes or the route changes.
- No new words beyond doc 01 §4.5.

## 5. Architecture

Doc 01 §5, with the engine call made explicit:

```
Browser ── TLS, no-store, memory only ──> CloudFront (CachingDisabled) ──> aiastra-server-api
                                                                              │ open: sign-in, reading, profile
   KMS wrap + HMAC ──┐                                                        │
   DynamoDB keys ────┼── unwrap once per person per instance (5 min LRU) ─────┤
                     │                                                        │
   Render Postgres ──┴── ciphertext + blind indexes + plain status/lock cols ─┤
                                                                              │
   aiastra-kundli-worker ── opens birth fields ── InvokeCommand ──> aiastra-pyjhora (plaintext in the invoke, inside AWS, no keys, no logs)
                          └── seals every payload on write; runs pii_backfill
```

| Boundary | Guarantee | Proof |
|---|---|---|
| Lambda → Render | Only `pii2:` values, blind indexes and plain operational columns | `piiAtRest.test.ts`, `pii-audit.ts` |
| Lambda → KMS/DynamoDB | Only the API and worker roles can unwrap; every unwrap in CloudTrail with `key_ref` | key policy, `03-evidence.md` |
| Worker → engine | Plaintext body inside AWS; engine logs nothing personal after its change | Radha grep + CloudWatch sample |
| Lambda → logs | Allow-listed fields | `noPiiInLogs.test.ts` |
| Lambda → browser | Owner only, `no-store`, fields the screen needs, no thinking stream | route tests |
| Browser → storage | Nothing personal persisted; sign-out clears | web tests |

## 6. Ingredients

| Item | Who | Needed by |
|---|---|---|
| `@aws-sdk/client-kms` (new; `client-dynamodb` is in) — install through a Haiku sub-agent in the literal folder | agent | B1 |
| Local master key file outside the checkout (`PII_LOCAL_KEY_FILE`), 32 random bytes; path noted in `docs/TODOS.md` without the value | agent | B1 |
| KMS keys, DynamoDB table, IAM, CloudTrail check (doc 01 §6) | **Sachin or an admin** (the deployer has no IAM/KMS rights; the admin path was given up on 2026-10-25) | B3 |
| Env on both Lambdas: `PII_KEY_PROVIDER=kms`, the three ARNs/table, `PII_WRITE_MODE` | deploy session | B3 |
| M26 applied on staging (standing OK) and live (Sachin's yes); M28 needs a Render snapshot and an explicit yes | deploy session | B3, B5 |
| Facts to read in B0 (never printed): deployed `ENCRYPTION_KEY` presence, share of `enc:` rows, row counts and sizes per table, Render backup retention and encryption statement, CloudTrail state | deploy session / Sachin | B0 |
| Decision on the committed real chart data in `evals/fixtures/G1`, `kundli.json`, docs 36/37 | Sachin (it is their own data; the question is whether it stays in a repository) | B0 |
| Lawyer read of the policy words | Sachin | B5 |

## 7. Action steps in sequence

Branches from `develop`, merged `--no-ff`. Steps marked ∥ run at the same time. This track touches `prisma/schema.prisma` by appending its own
block; `docs/admin/01` owns the `Auth` lock columns and appends first.

| # | Step | Files | Done when | ∥ |
|---|---|---|---|---|
| B0.1 | Remove personal data from logs | `server.ts:139-150`, `src/lib/astroKundliClient.ts:836-861`, `services/kundliService.ts:116-127`, `services/emailService.ts:56`, `services/publicChatError.ts:34-37` | `noPiiInLogs.test.ts` runs sign-up, chart build and a reading with sentinel values and finds none in captured logs | ∥ with admin A1 |
| B0.2 | Remove `/debug/kundli`; internal token mandatory; stop Nominatim on the server; stop the `thought` stream | `server.ts:377-397`, `services/kundliSyncWorker.ts:50`, `reading/chartData/store.ts:575-621`, `reading/run.ts:334`, web `readingProgress.ts` | 404, 401 and "place not found" by test; no `thought` frame in a streamed test | ∥ |
| B0.3 | `no-store` on SSE and bearer GraphQL; web storage clean-up; `astroUser` shape; sign-up draft and location in memory | `server.ts:222`, `routes/clarifyRoutes.ts:45`, web `Auth/logout.ts`, `App.tsx`, `BirthDetails.tsx`, `useQuestionLocation.ts` | header tests; web tests show nothing personal in storage after sign-out | ∥ |
| B0.4 | Read-only facts into `03-evidence.md` (section 6 list) | docs | filled, no values | deploy session |
| B1.1 | `seal.ts`, `keys.ts` (local + kms providers), `blindIndex.ts`, `hash.ts`, `fields.ts` | `src/lib/pii/*` | unit tests: round trip; wrong AAD fails; wrong key fails; no plaintext fallback; gzip path over 4 KB; boot refusal on Lambda without config | after B0 |
| B1.2 | Prisma extension and guard; client creation | `prismaExtension.ts`, `src/lib/prisma.ts` | every model in `fields.ts` round-trips through the extension against a test database; sealed `where` throws; `email`/`username` rewrite to bidx | after B1.1 |
| B1.3 | Raw SQL sites and allow-list test; keyed hashes | the 7 raw-SQL files, `rawSql.ts`, `factsBuilder.ts`, `chartData/store.ts`, `transits/ephemerisCache.ts`, `packs/selector.ts`, `timeline/foundation.ts`, `graph.ts:169` | `rawSqlAllowList.test.ts`; sealing a kundli does not change `source_hash` | ∥ with B1.2 (different files) |
| B1.4 | Callers stop using `encrypt()`; `birthPlaceFor` opens through the extension; sign-in lookups by bidx | `profileService.ts`, `authService.ts`, `auth/emailCode.ts`, `ensureAdmins.ts`, `services/userLocation.ts`, `scripts/seed-queue-users.ts`, `scripts/billing-set-paid.ts` | `tsc`; auth tests; `encrypt.ts` has no importer | after B1.2 |
| B2.1 | M26 written; `PII_WRITE_MODE=plain` read-both deployed to staging | migration, `schema.prisma` | staging green on sign-in, chart view, one reading, with no sealed row yet | after B1 |
| B2.2 | API shape: `myBirthDetails`, `me` trimmed, `myBiodata` filtered, `deleteMyAccount`; web profile and sidebar | `graphql/schema.ts`, `profileService.ts`, `kundliSidebar.ts`, web `ProfileSection.tsx`, `ChatRightSidebar.tsx` | API and web tests; screenshots per `TEST.MD` into `docs/screenshots/privacy-profile/` | ∥ with B2.1 |
| B3.1 | Sachin creates the AWS resources from section 6; deploy session sets env; `PII_KEY_PROVIDER=kms` on staging | AWS, env | a new staging sign-up's raw `auth` row shows `pii2:` values and a `key_ref`; CloudTrail shows the unwrap | needs Sachin |
| B3.2 | Flip `PII_WRITE_MODE=sealed` on staging; measure | env | `pii_key_ms` log line under 50 ms first request, under 5 ms cached; readings unchanged in timing within noise (`reading_traces.ms`) | after B3.1 |
| B4.1 | Backfill event in the worker; audit script | `services/kundliSyncWorker.ts`, `scripts/pii-audit.ts`, `scripts/pii-reseal-user.ts` | audit shows 0 unsealed on staging; then live with Sachin's yes | after B3.2 |
| B4.2 | Review scripts and fixtures: delete `backfill-local-facts.ts`; fixtures per Sachin's decision | `scripts/`, `evals/fixtures` | reviewed | ∥ |
| B5.1 | M28 contract after a Render snapshot and Sachin's yes; remove legacy `enc:` and `ENCRYPTION_KEY` | migration, `pii/*` | applied; audit still 0; all flows green | after B4 |
| B5.2 | Wait out Render backups; dump test; `03-evidence.md` complete; lawyer; policy text | `LegalPages.tsx`, docs | sentinel search of a fresh backup finds nothing; policy live with a new date | after B5.1 |

## 8. Development phases

| Phase | Steps | Leaves the system | Closing check | Deferred |
|---|---|---|---|---|
| B0 Stop the leaks, clean the wire and the browser | B0.1–B0.4 | Same product; no personal data in logs; `no-store`; nothing personal in browser storage; no thinking stream; facts known | `noPiiInLogs.test.ts`; header tests; `03-evidence.md` v1 | everything sealed |
| B1 Crypto foundation, no AWS | B1.1–B1.4 | All code paths go through the extension; local provider; writes still plain | unit + test-database round trips; `tsc`; `encrypt.ts` unused | real keys |
| B2 Expand and API | B2.1–B2.2 | M26 on staging; read-both live; profile hides birth details until opened; deletion path exists | staging flows green with plain rows | sealed writes |
| B3 Keys on staging | B3.1–B3.2 | New writes sealed on staging; old rows readable | raw row check; latency numbers in `03-evidence.md` | old rows |
| B4 Backfill | B4.1–B4.2 | Everything sealed; audit 0; fixtures decided | audit on staging then live | contract |
| B5 Contract and claim | B5.1–B5.2 | Plain columns gone; policy published | dump test; lawyer's yes | database move, if ever; payload encryption above TLS (rejected, section 0) |

Sizes (agent working days, rough): B0 1; B1 3; B2 1–2; B3 1 plus waiting on AWS; B4 1–2; B5 1 plus backup wait. B0 and B1 need no AWS
access and no decision, so they start the day the admin plan's A1 merges.

## 9. Recommendation

**Seal the person's whole personal set at the application layer with per-person keys in KMS, keep Render, do not encrypt the wire above
TLS, and ship B0 and B1 now while the AWS resources wait on Sachin.** B0 alone removes the chart from CloudWatch, the thinking text from
the wire and birth data from browser storage, which are the three leaks someone can find without a database. B1 builds the foundation
with no key dependency so B3 becomes a configuration flip.

**Order against `docs/admin/01`:** admin A1 (row-based auth, lock-out) merges first; B0 runs beside it on its own branch (shared file
`server.ts` only, different lines; rebase B0 on A1). B1 starts after A1 and A2 are merged so the extension sees the final set of callers.
`admin_actions` and `reading_agent_spans` stay plain by construction; the admin tests guard it.

### Decided here, with verdicts

| Choice | Decision | Why |
|---|---|---|
| Columns vs whole database vs both | Application-level columns; Render disk encryption stays as the floor | Only column sealing survives a leaked URL, a dump or a backup |
| Discard birth details after the pull | No; seal them | Re-pulls on every engine change need them; the charts repeat them anyway |
| Seal only birth columns | No; the whole personal set | `biodata`, `dossier.birth`, `panchanga.birth` repeat the birth details |
| Payload encryption to the browser | No | The page holds plaintext and the key; `no-store` and memory-only state are the real levers |
| Stream model thinking to the browser | Stop | Mentions chart details; kept server-side for study |
| Per-person DEK vs one app key | Per person (doc 01) | Erasure by key destruction, which the app stores require; audit by person |
| Local development key | File-based provider, same code | B1 can be built and tested with no AWS |
| Bedrock first (doc 01) vs encryption first | Encryption track ships on its own; Bedrock remains doc 01 track A | Sachin asked for the data at rest now; the tracks share no files beyond the LLM call sites |
| `reading_traces.question` | Sealed (doc 01) and never selected by the admin API (`docs/admin/01`) | Both plans agree |

### Decisions only Sachin can make

1. **AWS resources** (section 6): KMS keys, DynamoDB table, IAM. Without them the track stops at B2. Recommended: you create them from the list; no standing admin for agents.
2. **Applying M26 on live** and, much later, **M28** (destructive) after a Render snapshot.
3. **The committed real chart data** in `evals/fixtures/G1`, `kundli.json` and docs 36/37: keep (it is yours, and the repo is private) or replace with a synthetic chart. Recommended: replace G1 with a synthetic chart built through the engine once its `facts` export is live, which also closes the "G1 is a stand-in" item in `docs/TODOS.md`.
4. **Database location** stays doc 01 §9 decision 3; nothing here depends on it.

Stopping after any phase leaves nothing half-migrated: M26 only adds; read-both code reads plain and sealed rows alike; the write mode is a
flag; M28 is the only destructive step and comes last, after an audit of 0.
