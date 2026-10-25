# 01 — Current state (as of 2026-10-24)

Everything below was read from the repos and the infra inventory, not assumed. Where something could not be verified it is marked.

## 1. Which code is live

| Repo | Live branch | Notes |
|---|---|---|
| AIAstra_Server | `origin/feature/gemini-context-cache` (37 commits ahead of `main`, last commit 2026-09-15) | `main` stopped on 2026-03-26 and still routes chat to Groq. Everything below describes the feature branch. |
| AIAstra_WEB | `origin/feature/turnstile_iPhone` / `feature/cf-oac-api-headers` (23 ahead of `main`) | SSE client, `X-Astra-Authorization`, Turnstile (disabled). `main` only knows GraphQL `ask`. |
| AIAstra_Radha (pyjhora fork) | `origin/feature/add_divisional_charts` | Adds `d2`, `d4`, Lambda container (`lambda_handler.py` → Mangum over FastAPI), OIDC deploy workflow. |
| aiastra-aws-terraform | draft, stubs only | Inventory is accurate; modules are placeholders; no `apply` yet. |

Action for Phase 0: give each repo a `develop` branch cut from its live feature branch, and branch all work from `develop`. The server `develop` was created this way on 2026-10-24. Branching from `main` today would silently drop Gemini, SSE, D-2/D-4, Turnstile, magic link and the Lambda transport.

## 2. Request path and infra

- Amplify `aiastra-web` → CloudFront `E3UPJNUU8APCT` (OAC + WAF `aiastra-api-edge`) → Lambda Function URL `aiastra-server-api` (`AWS_IAM`, `RESPONSE_STREAM`, 2048 MB, 300 s). Account `442728149528`, `us-east-1`.
- `aiastra-pyjhora` Lambda (image, 2048 MB, 60 s, invoke-only) is the calc engine; the server calls it with `ASTROKUNDLI_TRANSPORT=lambda` using a synthetic API Gateway v2 event per chart slice.
- `aiastra-kundli-worker` Lambda exists; its EventBridge rule `aiastra-kundli-worker-5m` is **disabled** (cost sleep). Kundli sync runs on login/signup/magic-link/admin refresh only.
- Database: Render Postgres (pooler `:6432`, `connection_limit=1` from Lambda; `DIRECT_URL` on `:5432`). Not in AWS.
- DynamoDB `aiastra-gemini-cache` (`userId` → cache pointer) exists; cache is **off** (`GEMINI_CACHE_ENABLED=0`) because the Gemini free tier has zero cachedContents storage. Paid billing is the blocker.
- Secrets Manager: `aiastra/database-url`, `aiastra/jwt-secret`, `aiastra/chat-llm`, `aiastra/server-env`, `aiastra/web-env`, `aiastra/pyjhora-env`.
- Gap: the server repo Dockerfile builds a plain Express container (`docker-entrypoint.mjs` → `node dist/server.js`). The RESPONSE_STREAM Lambda packaging (web adapter or handler) is not in the repo. It must be found and committed in Phase 0, otherwise the graph work cannot be deployed reproducibly.

## 3. The chat turn today

`POST /api/chat/ask-stream` (SSE) or GraphQL `ask` → `chatWithConfiguredProvider` → `chatWithGemini`:

1. `loadSystemPrompt('pvr_oracle')` from Postgres on every turn (persona prompt seeded by migration `20250309100000`; may have been edited in the DB since, which I could not verify without a connection string) plus a concise-answer appendix. The markdown-format appendix (`chatOracleMarkdownAppendix.ts`) exists but is not wired into the Gemini path.
2. `fetchLatestKundliForUser` → `buildUserMessageWithKundli`: one `user` message per field, each `This is the <title> of the person:` + `JSON.stringify(value, null, 2)`.
   - `CHAT_KUNDLI_CONTEXT=lean` (default): biodata, d1, d9, vimsottari_dasa, charakaraka.
   - `full`: adds d2, d4, d7, d10, narayana_dasa.
3. One `streamGenerateContent?alt=sse` call to `gemini-2.5-flash`, `thinkingBudget=512`, `maxOutputTokens=8192`, `temperature=0.5`, `topP=0.9`, with an n-gram loop guard. Groq (`openai/gpt-oss-120b`) is the alternate provider.
4. Persist `messages` + `chat_logs` (full request and response payloads).

No conversation history is sent. No transits. No "today" context beyond a commit that adds the date to the question.

## 4. What the model actually receives per chart

From `AIAstra_Radha/docs/API.md` and `export.py`:

| Field | Shape | What is missing for interpretation |
|---|---|---|
| `biodata` | date, time, tz, place string, tithi, nakshatra, yoga, karana, sunrise/sunset, ayanamsa | lat/lon/tz as numbers (geocoded again on every call) |
| `d1`, `d2`, `d4`, `d7`, `d9`, `d10` | array of `{body, longitude:"4 Pi 13' 45\"", nakshatra:"UBha", pada, rasi:"Pi", navamsa}` | house numbers, house lords, dignity, retrograde/combust, aspects, nakshatra lord, numeric longitude. For vargas, no varga lagna or house context at all, so the model cannot use them. |
| `charakaraka` | `{karaka_code, planet, meaning}` | fine |
| `vimsottari_dasa` | MD lord + start date, bhuktis lord + start date | end dates, pratyantar level, "current" flag, lord placement |
| `narayana_dasa` | same, sign names | same |

Nothing about: house lordships, graha/rasi drishti, argala, arudha padas, special lagnas (notes.txt shows JHora prints them; the API does not export them), shadbala, ashtakavarga, yogas, doshas, transits, nakshatra lords, tara bala. pyjhora computes all of these (see `horoscope/chart/*.py`, `horoscope/main.py`), they are simply not exported.

Size: pretty-printed JSON with 2-space indentation roughly doubles the token count. The ten-field "full" payload is on the order of 30–50k tokens; lean about 15–20k.

## 5. Why it is slow

Measured in `docs/grokbots/plan-phase-a-chat-latency/README.md`:

| Configuration | Wall clock |
|---|---|
| `maxOutputTokens=50000`, thinking default | ~205 s, `MAX_TOKENS`, repetition collapse |
| `thinkingBudget=1024`, `maxOut=8192` | 34.6 s |
| `thinkingBudget=512`, `maxOut=8192` (locked) | ~21 s, answers cut mid-table |
| Free tier, no cache | storage limit 0, so the 15–20k token prefix is re-read every turn |

Drivers, in order: (1) input size and whitespace, (2) thinking plus long output in one sequential call, (3) no prefix reuse, (4) cold Lambda + Prisma connect + prompt fetch (~1–2 s), (5) Nagle/proxy buffering already handled with pings.

## 6. Why it keeps going to D-1

- D-1 is the only chart where the row has a `navamsa` column and the lagna row gives the model something to count houses from. Vargas arrive as planet lists with no lagna row context and no house numbers, so the model cannot apply varga rules and quietly ignores them.
- The prompt says "all divisional charts D-1 to D-144" but the data gives five, with no instruction on which varga answers which subject.
- Lean mode removes D-10 and D-7 outright, so career and children questions physically cannot use them.
- Dasha arrays are undated at the end and unmarked for "now"; the model estimates the running period and sometimes gets it wrong.
- There is no transit data, so any transit statement is from the model's memory of ephemerides, which is unreliable.

## 7. Kundli sync cost (matters for the dossier design)

Each field is one POST to pyjhora, serialised with a 2 s start-to-start gap because the Python side geocodes `place` through Nominatim (about 1 req/s). Ten fields → 20 s+ per user per sync, and a Lambda invoke each. The fix is in file 06: resolve lat/lon/tz once, store them on `kundlis`, and have the engine compute the whole dossier in one invoke.

## 8. What already exists and is reusable

- SSE plumbing end to end (server `ask-stream`, web `consumeChatAskSse`, ping comments, `X-Accel-Buffering`). The graph will add event types to this channel, not replace it.
- Gemini REST client with undici agent, timeouts, loop guard, usage capture. Reuse as the model caller for every node.
- Explicit cache service with DynamoDB pointers and payload hashing. Reuse for the specialist model once billing is paid; extend the hash with the prompt version and dossier version.
- `askChatTurn.persistAskTurn` for message persistence; extend with `reading_runs`.
- `kundliQueueService` as the place where "facts" are built after sync.
- pyjhora: `Horoscope` class exposes shadbala, bhava bala, vimsopaka, arudhas, sphutas, special lagnas, 40+ dasha systems, yogas, raja yogas, doshas, ashtakavarga, all 16+ vargas, transits via `drik.planetary_positions(jd, place)`. Verified against the PVR book by its 6300-test suite.
