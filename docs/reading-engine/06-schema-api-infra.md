# 06 — Schema, API and infrastructure changes

Everything here is incremental on the live feature branches (file 01 §1). Nothing removes an existing column or endpoint until Phase 4.

## 1. Prisma migrations (AIAstra_Server)

### M1 — `kundlis` coordinates and facts pointer (Phase 1)

```sql
ALTER TABLE "kundlis" ADD COLUMN "lat" DOUBLE PRECISION, ADD COLUMN "lon" DOUBLE PRECISION, ADD COLUMN "tz" DOUBLE PRECISION,
                      ADD COLUMN "place_resolved" TEXT, ADD COLUMN "facts_status" TEXT NOT NULL DEFAULT 'pending';
-- facts_status: pending | building | ready | failed
```

### M2 — `kundli_facts` (Phase 1)

```sql
CREATE TABLE "kundli_facts" (
  "id" TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  "kundli_id" TEXT NOT NULL REFERENCES "kundlis"("id") ON DELETE CASCADE,
  "facts_version" INTEGER NOT NULL,
  "engine_commit" TEXT NOT NULL,
  "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
  "dossier" JSONB NOT NULL,
  "natal_points" JSONB NOT NULL,
  "dossier_hash" TEXT NOT NULL,
  "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "kundli_facts_kundli_version" ON "kundli_facts"("kundli_id", "facts_version");
```

### M3 — `transit_snapshots` (Phase 1)

```sql
CREATE TABLE "transit_snapshots" (
  "id" TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  "from_date" DATE NOT NULL, "to_date" DATE NOT NULL,
  "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
  "snapshot_version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "transit_snapshots_range" ON "transit_snapshots"("from_date", "to_date");
```

### M4 — `reading_runs` (Phase 2)

```sql
CREATE TABLE "reading_runs" (
  "id" TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL REFERENCES "auth"("id") ON DELETE CASCADE,
  "chat_id" TEXT REFERENCES "chats"("id") ON DELETE SET NULL,
  "message_id" TEXT UNIQUE REFERENCES "messages"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL,                       -- intake | awaiting_confirm | running | done | failed | abandoned
  "question" TEXT NOT NULL,
  "intent" JSONB, "intent_confirmed" JSONB,
  "facts_version" INTEGER, "dossier_hash" TEXT, "transit_snapshot_id" TEXT,
  "pack_hashes" JSONB,
  "findings" JSONB, "windows" JSONB, "agreement" JSONB,
  "answer" TEXT,
  "models" JSONB, "usage" JSONB, "cost_usd" NUMERIC(10,6),
  "timings_ms" JSONB, "cache" JSONB, "dropped_claims" INTEGER, "grounding" JSONB,
  "errors" JSONB,
  "prompt_version" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6)
);
CREATE INDEX "reading_runs_user_created" ON "reading_runs"("user_id", "created_at" DESC);
CREATE INDEX "reading_runs_chat" ON "reading_runs"("chat_id");
```

### M5 — chats metadata (Phase 3)

```sql
ALTER TABLE "chats" ADD COLUMN "subject_tags" TEXT[] NOT NULL DEFAULT '{}', ADD COLUMN "last_activity_at" TIMESTAMPTZ(6);
CREATE INDEX "chats_user_activity" ON "chats"("user_id", "last_activity_at" DESC);
```

### M6 — LangGraph checkpointer tables (Phase 3)

Created by `@langchain/langgraph-checkpoint-postgres` `setup()` with table prefix `lg_`; run once from a migration script so Prisma migrate and the checkpointer do not fight. Rows are deleted by a nightly job for runs older than 7 days.

`system_prompts`: unchanged. `pvr_oracle` remains the persona override; add rows `reading_persona_override` only if the voice is to be editable per environment. Method prompts are files.

## 2. Python API changes (AIAstra_Radha)

- `ExportType` += `facts`, `transits`, `natal_points`.
- `facts`: assemble from `Horoscope` + `charts.divisional_chart` + `house.*` + `strength.shad_bala/bhava_bala` + `ashtakavarga.get_ashtaka_varga` + `yoga/raja_yoga/dosha.get_*_details` + `arudhas.*` + `sphuta.*` + special lagnas + `vimsottari/narayana` with end dates and PD level + nakshatra profile from `const`. Output per file 03 §2. Target: ≤ 3 s on the 2048 MB Lambda for 10 vargas; profile and cache the `Horoscope` object across sections.
- `transits`: `drik.planetary_positions(jd, place)` per step; ingress detection by sign and nakshatra with bisection to the day; stations from speed sign change; lunations from Sun–Moon elongation.
- Request: accept `lat/lon/tz` first-class (already supported) and **return** resolved coordinates when `place` was used.
- Keep the existing `d1…narayana_dasa` types for the Charts page; mark them legacy in `docs/API.md`.
- Tests: golden chart snapshot (`notes.txt` export), property tests (file 03 §5), timing test (< 3 s).
- Lambda: same image recipe (`public.ecr.aws/lambda/python:3.12`, Mangum), bump memory to 3008 MB only if the timing test needs it; timeout stays 60 s. Deploy through the existing OIDC workflow.

## 3. Server changes (AIAstra_Server)

### Kundli sync → facts

`kundliQueueService.processOneKundliRow`: after the legacy fields are filled (or immediately for new users once the Charts page reads from facts), invoke `type=facts` once with stored `lat/lon/tz` (or `place` on first run; persist the returned coordinates), write `kundli_facts`, set `facts_status=ready`, then `ensureGeminiCacheForUser` when enabled. Backfill script `scripts/build-facts-for-all.ts` for existing users (serial, one invoke per user, no geocoding because coordinates are stored first by a one-off `place` resolution pass).

### Transit job

`scripts/build-transit-snapshot.ts` (also the worker Lambda entry `buildTransitSnapshot`): if no snapshot covers `[today, today+24m]`, invoke `type=transits` and insert. Scheduled daily by a new EventBridge rule (`aiastra-transits-daily`, `cron(30 0 * * ? *)` UTC). The API also builds lazily on a miss.

### `src/reading/` module

Per file 04. Entry points:

- `runReading({ userId, chatId, question, mode: 'sse' | 'sync', onEvent })`.
- `resumeReading({ runId, confirmed, intentPatch, onEvent })`.
- `askChatTurn.ts` gains `persistReadingRun`.

### HTTP / GraphQL contract

| Endpoint | Change |
|---|---|
| `POST /api/chat/ask-stream` | Same request. New SSE events `intent`, `clarify`, `stage`, `windows`; `done` carries `runId` and `grounding`. When `clarify` is sent the stream closes with status `awaiting_confirm`. |
| `POST /api/chat/confirm` (new) | `{ runId, confirmed: boolean, intentPatch?: Partial<Intent> }` → SSE stream continuing the run. JWT via `X-Astra-Authorization`; `runId` must belong to the user. |
| GraphQL `ask` | Unchanged signature; runs the graph with clarify `never`. |
| GraphQL `myReadingRuns(limit)` / `readingRun(id)` (new) | user-scoped run history for the UI "why this answer" panel (Phase 4). |
| GraphQL `adminReadingRuns(userId, from, to)`, `adminReadingStats(from, to)` (new) | admin observability. |
| GraphQL `adminRebuildFacts(userId)` (new) | admin action; also triggered by `adminRefreshUserKundli`. |

CloudFront: the new path `/api/chat/confirm` goes through the same behaviour as `/api/chat/ask-stream` (OAC, `x-amz-content-sha256`, forwarded `X-Astra-Authorization`). Add it to the Terraform edge module notes.

### Env (API Lambda, from `aiastra/chat-llm` + `aiastra/server-env`)

```
READING_ENGINE=1                      # 0 = legacy chatWithGemini path (kill switch)
READING_CLARIFY_MODE=when_ambiguous   # always | when_ambiguous | never
READING_FAST_LANE=1
READING_MODEL_INTAKE=gemini-3.1-flash-lite
READING_MODEL_SPECIALIST=gemini-3.8-flash
READING_MODEL_SYNTH=gemini-4-argon
READING_MODEL_FAST=gemini-3.8-flash
READING_SPECIALIST_TIMEOUT_MS=12000
READING_SYNTH_THINKING=auto           # auto | low | medium | high
READING_DAILY_BUDGET_USD=1.00
READING_PROMPT_VERSION=auto           # hash of prompts/ at build
GEMINI_CACHE_ENABLED=0                # flip to 1 after paid billing; lazy per-user explicit cache
```

`CHAT_KUNDLI_CONTEXT` is removed once `READING_ENGINE=1` is the default (Phase 4).

### Lambda packaging (Phase 0)

Added on branch `feature/api-lambda-packaging` (2026-10-24): `Dockerfile.lambda` (Express behind the AWS Lambda Web Adapter in `response_stream` mode, `/health` readiness), a hardened `docker-entrypoint.mjs`, `.dockerignore`, and a manual OIDC workflow `.github/workflows/deploy-api-lambda.yml`. See [../lambda-deployment.md](../lambda-deployment.md). Remaining check before first use: compare with the live function config (read-only commands listed in that doc), since the live image `thinking-off-20260916022820` was built outside the repo.

## 4. Web changes (AIAstra_WEB, on the live branch)

- `UserData.ts`: handle new SSE events; add `confirmReadingStream(runId, confirmed, intentPatch, onDelta, onEvent)`.
- `ChatSection.tsx`: render the **understanding line** on `intent` (grey italic under the user bubble); render the **clarify card** on `clarify` (text + subject/horizon chips + "Yes, read it" / "Change"); render **stage chips** on `stage` (small pills: "D-10 ✓", "Dasha ✓", "Transits …"); queue `followUps` as suggestion chips after the answer.
- Timeout: `VITE_GRAPHQL_ASK_TIMEOUT_MS` stays 15 min; the stream now has visible progress so no UX change there.
- Charts page: unchanged until Phase 4, when it can read `kundli_facts` for richer tables (house lords, aspects, dasha with end dates).

## 5. Infrastructure (aiastra-aws-terraform + console until TF is applied)

| Item | Change |
|---|---|
| `aiastra-pyjhora` | New image with `facts`/`transits`; same role; consider 3008 MB. |
| `aiastra-kundli-worker` | New entry points `buildFacts`, `buildTransitSnapshot`; keep the 5-min rule disabled; add `aiastra-transits-daily` rule (enabled). |
| `aiastra-server-api` | New env keys above; same role plus `secretsmanager:GetSecretValue` on `aiastra/chat-llm` (already) and `dynamodb` on `aiastra-gemini-cache` (already). |
| DynamoDB `aiastra-gemini-cache` | Add attributes `promptVersion`, `factsVersion`, `modelId` (schemaless, no TF change beyond docs). |
| Secrets | `aiastra/chat-llm`: add the `READING_MODEL_*` keys; no new secrets. |
| CloudFront | Behaviour for `/api/chat/confirm`. |
| CloudWatch | Metric filters + alarms (file 05 §6). |
| Render Postgres | Three new tables + checkpointer tables; size impact small (dossier ~60–120 KB per user, snapshot ~100 KB per day, runs ~50–100 KB each). Add a retention job: `reading_runs.findings/packs` older than 90 days → null out, keep metrics. |
| Gemini billing | Required for cache and for the 3.x/4 models at production rate limits. Confirm paid tier before Phase 2 load testing. |

Terraform: fill the `lambda_pyjhora`, `lambda_kundli_worker`, `eventbridge_kundli` and `edge` module stubs for these resources as part of the planned import work; no `apply` without Sachin.

## 6. Security and privacy notes

- The dossier contains birth data; it is PII. `kundli_facts` inherits the `kundlis` cascade; no dossier in logs (log hashes and sizes only, as the Gemini client already does).
- `reading_runs.findings` contain chart facts: same handling as `chat_logs`.
- Gemini explicit cache objects hold the dossier at Google for the TTL; delete on account deletion (extend the existing delete path to call `deleteRemoteCachedContent`).
- `confirm` must validate `runId` ownership and `status=awaiting_confirm`.
