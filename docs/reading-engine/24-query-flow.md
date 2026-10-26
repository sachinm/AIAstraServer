# 24 — What happens when a user submits a question

Plain-language walk-through of one chat turn on the new chat path (reading engine on, as it is by default), with the models,
agents, data, caching, cost and timings behind it. Written from the code on `develop` and from measurements; file references
are given so each claim can be checked. Last updated 2026-10-26.

## The short answer

- **Thinking is streamed, then tucked away.** The writer call asks Gemini for thought summaries (`includeThoughts: true`). They
  stream to the browser as `thought` events while the answer is being prepared and show in a **Thinking** panel under the stage
  pills. The panel is open while the answer is prepared, collapses when the answer starts, and can be toggled open at any time.
- **Thinking is stored.** The same text is saved next to the answer in `reading_runs.thinking` (migration M10, applied to the
  live database on 2026-10-26) so the reasoning can be studied for discrepancies. It is capped at 60,000 characters and is never
  written to the application logs. `READING_INCLUDE_THOUGHTS=0` turns both the stream and the storage off.
- **Progress comes first:** an "I understood …" line and stage pills (Understanding, Chart facts, Writing; the graph flow adds
  Promise, Dasha, Transits, Nakshatras, Cross-check).
- **The final answer streams** token by token. In practice most of the text arrives in a short burst after the model finishes
  thinking, so the thinking panel is what fills the first 5–12 seconds.

## The sequence

```
Browser  POST /api/chat/ask-stream { question, chatId, clarify }
  1. auth            JWT from X-Astra-Authorization / Authorization            (server.ts)
  2. pre-check       validateAskForUser: the account must be able to ask        (server.ts)
  3. open stream     SSE headers, "start" event, keep-alive ping every ~12 s    (server.ts)
  4. clarify         only if the client sent clarify:true and the question is vague
                     -> a "clarify" or "propose" event and the turn pauses       (clarifyRoutes.ts, doc 17)
  5. declined gate   topics the app does not discuss get a fixed reply, no model (policy/declined.ts, doc 18)
  6. runReading
       a. intake     rules classifier first, small model only if the rules are unsure -> intent (doc 15)
                     (the data reads start now, in parallel with intake)
       b. prepare    build the evidence pack from the stored chart facts and transits
       c. write      single flow (default): one streamed Gemini call
                     graph flow (READING_FLOW=graph): specialists -> reconcile -> one streamed call
  7. save            the turn and the reading run (including the thinking) are stored, then "done" is sent
```

Self-harm questions skip b and c: intake flags them and a fixed supportive reply is streamed.

## What the browser receives (server-sent events)

| Event | When | What the UI does |
|---|---|---|
| `start` | stream opened | shows the working state |
| `intent` | after intake | draws the "I understood …" line, subjects, time horizon, and the template frame |
| `stage` | start / done / failed / skipped for each step | updates one pill per stage (`readingProgress.ts`) |
| `thought` | while the writer thinks | appends text to the Thinking panel (`ThinkingPanel.tsx`) |
| `windows` | graph flow, after reconcile | shows how many timing windows were found |
| `info` | declined topic, or chart not ready | explains why there is no full reading |
| `clarify` / `propose` | clarify agent | renders a question card with chips |
| `token` | answer text, many times | appends text to the answer |
| `done` | answer saved | closes the turn; carries `chatId`, the final `answer`, `runId`, and `grounding.dropped` |
| `error` | any failure | shows a public-safe message |

Lines starting with `:` are keep-alive comments the client ignores. Thinking is held in memory by the browser for the live answer
only: a reloaded chat has no Thinking panel (the stored copy is for study, not for display).

## Which models run which part

| Stage | What it does | Model (setting) |
|---|---|---|
| Clarifier phrasing / resolving | turns a vague question into one question for the user; rules first, optional model | Bedrock open model, `READING_MODEL_CLARIFY=bedrock:openai.gpt-oss-120b-1:0` (off when unset; falls back to rules on any error; ~900 ms budget) |
| Intake | reads the question into subject, horizon, format | rules in most cases (no model); small model when unsure (`READING_MODEL_INTAKE`) |
| Specialists (graph flow) | each reads one layer of the chart and returns structured findings | `READING_MODEL_SPECIALIST` |
| Writer | the answer, streamed, with thinking | `READING_MODEL_SYNTH` (single flow uses it for the whole answer) |
| Fast lane | short factual questions in the graph flow | `READING_MODEL_FAST` (defaults to the writer) |

Every role defaults to `GEMINI_FLASH_MODEL_ID` when its setting is empty.

**Staging today (checked 2026-10-26):** no `READING_MODEL_*` is set, so every stage runs `gemini-2.5-flash`; the flow is single;
`READING_MODEL_CLARIFY` is unset so the clarifier uses rules only. The plan's matrix (not yet applied) is `gemini-3.1-flash-lite`
for intake and specialists, `gemini-3.8-flash` for the writer and fast lane, and the Bedrock model for the clarifier; the Lambda
role also needs `bedrock:InvokeModel` on that model.

| Model | Input $/1M | Output (incl. thinking) $/1M | Cached input $/1M | Source |
|---|---|---|---|---|
| gemini-2.5-flash | 0.30 | 2.50 | 0.03 | `llm/models.ts` `PRICES` |
| gemini-3.1-flash-lite | 0.25 | 1.50 | 0.025 | same |
| gemini-3.5-flash-lite | 0.30 | 2.50 | 0.03 | same |
| gemini-3.8-flash | 0.75 (1.50 from 2027-01-01) | 3.75 (7.50) | 0.075 (0.15) | same, doc 23 §1 |
| gemini-3.1-pro-preview | 2.00 | 12.00 | 0.20 | same |
| gpt-oss-120b on Bedrock | 0.15 | 0.60 | none | third-party trackers; check the AWS price page |

Bedrock on-demand has no prepaid balance: it is pay-per-token on the account's monthly bill.

## How many agents work on one answer

- **Single flow (the default):** one model call writes the answer. Intake uses a model only when the rules are unsure, so a turn is
  usually **1 model call** (2 when intake needs the model).
- **Graph flow:** per subject the specialists **promise**, **dasha** and **transit** (transit is required only when the horizon is
  three years or less), plus one **nakshatra** pass per run on the first subject. One subject = 4 specialists; three subjects = up to
  10. A **reconcile** step (plain code, no model) cross-checks and merges their findings, then **one writer call** streams the answer.
  Questions that qualify for the fast lane skip the specialists.
- The clarifier is separate and runs before any of this, only for vague questions.

## What data is pulled from Radha

The reading engine reads the stored chart facts (the *dossier*, built from Radha exports and kept per user) plus Radha's transit
chart. The dossier holds:

| Group | What is in it |
|---|---|
| Birth and panchanga | date, time, place, tithi, nakshatra, yoga, karana, weekday |
| Bodies and houses | each planet and the lagna (sign, house, nakshatra, dignity, ownership), twelve houses with lords, occupants, aspects, argala |
| **Divisional charts** | **10, not 60:** D1, D2, D3, D4, D7, D9, D10, D12, D30, D60 (planets and houses in each) |
| Karakas, arudhas, special lagnas | Chara karakas and karakamsa; arudha padas (D1 only today); special lagnas |
| Yogas and doshas | named yogas and doshas with the planets and houses involved |
| **Ashtakavarga** | SAV (12 signs) and BAV (per planet) |
| **Dashas** | **Vimshottari** (mahadashas, antardashas, pratyantardashas around the horizon) and **Narayana** only |
| Nakshatra profile and relations | janma and lagna nakshatra, taras, gandanta, pushkara; natural and functional benefics and malefics, exchanges, kendra/trikona and dusthana lords |
| Transits (separate Radha export) | transit rows by planet and period, double-transit windows, Sade Sati periods |

The catalog lists **114 chart data types** (91 after M9, plus 23 per-chart arudha and argala entries from M11). Radha serves 90 of
the first 91 (every divisional chart, every dasha except `dasha.brahma`, the natal tables, annual types and transit; catalog sync
of 2026-10-26). Only **10** are stored per user so far (birth panchanga, D1, D2, D4, D7, D9, D10, Vimshottari, Narayana, Chara
karakas); the others are fetched when a sign-up or a question asks for them, and the reading engine's prompt still reads the dossier.

**Arudhas and Argala per divisional chart (R-4c, Radha `641a924`):** the Radha types `arudhas` and `argala` take a `varga` parameter.
The server catalog has one entry per chart, `argala.dN` for D1, D2, D3, D4, D7, D9, D10, D12, D20, D24, D30, D60 and `arudhas.dN`
for the same charts except D1 (plain `arudhas` stays D1), each with the `varga` fixed in code (`fixedParams`). They are `on_demand`.
Each `arudhas` answer also carries Sri Lagna (SL), Hora Lagna (HL), Gulika (GK) and Maandi (MD) placed in that chart, and each
`argala` answer lists, per house, the planets in the 2nd/4th/5th/11th and the paired 12th/10th/9th/3rd with their benefic or
malefic nature. Radha allows one call per second per client without an API key.

## What is sent to the model, and what is cached

The prompt has a fixed order so the stable part can be cached:

1. **System** (persona and method), the same for every user.
2. **Base** (`pack.sections.base`), the same for every question of one user. It holds birth data, houses, bodies, relations and the
   nakshatra profile, and with `READING_FULL_BASE` (default on) also **every divisional chart in the dossier, ashtavarga, the
   Vimshottari and Narayana dasha tree, arudhas, special lagnas, karakas, yogas and doshas**.
3. **Subject part** (frame houses, detail, the vargas for this subject, dashas around the horizon, transits), different per question.
4. **Question and the answer format.**

Caching, in two layers:

- **Implicit**: Gemini caches a repeated prefix by itself; `usage.cachedTokens` shows whether it did.
- **Explicit** (`READING_EXPLICIT_CACHE=1`): the system plus base are stored as a Gemini cache on the second use inside 30 minutes
  and deleted on logout or a chart rebuild. It needs paid billing, and **Gemini 3.x only caches a prefix of at least 4,096 tokens**.
  The bare base was about 1.7k tokens by the pack's own estimate, so the cache could never engage; the full base is about **5.6k**
  (measured on the golden chart, `tests/unit/reading/fullBase.test.ts`), plus the system prompt.
- `GEMINI_CACHE_ENABLED` belongs to the older chat path (`geminiCacheService.ts`), not to the reading engine's cache.

Not yet confirmed live: whether `cachedTokens` rises on staging. Check the `reading timing` log line after enabling.

## How long the answer is

Each answer template has a word cap: T1 180, T10 220, T9 260, T3 300, T5 300, T4 320, T2 350, T6 350, T8 380, T7 420 words
(some plus a table). The older formats allow 250 (direct), 450 plus a table (factor table) and 700 (narrative). A typical answer
is **200–450 words**.

## What a question costs

Measured on 2026-10-26 (12 golden questions, single flow, `gemini-3.8-flash`, thinking low, no cache, golden chart, CloudShell in
us-east-1): **$0.0059 to $0.0157 per question, average about $0.0094; $0.113 for all twelve.** Prompts were 6.3k–16k tokens.
These are token counts times our price table, not Google's invoice; confirm against the AI Studio billing page.

| Setup | Per question |
|---|---|
| Single flow, `gemini-3.8-flash`, measured | **$0.006–0.016** |
| Graph flow, cheap readers plus `gemini-3.8-flash` writer | about $0.04–0.06 (estimate, doc 23; **not measured**) |
| Claude Fable 5.1 as the writer | about $0.14–0.17 (estimate, doc 23; **not Gemini**) |

The full base adds about 4k input tokens to every call (roughly $0.003 on `gemini-3.8-flash` uncached) and about a tenth of that
once cached. Thought tokens are billed whether or not they are shown.

## How long it takes

Measured on the same run (thinking included, answer fully produced):

| | Total response | First answer text |
|---|---|---|
| fastest | 4.7 s | 4.7 s |
| median | 10.2 s | 9.7 s |
| p95 | 11.9 s | 11.9 s |

The budget in doc 12 is a first token under 10 s at p95 and a complete answer under 40 s; the measured p95 first-token time is
just over it. **Not measured:** the graph flow with live models, the cheap readers, the Bedrock clarifier, cache hits, thought
streaming overhead, and the full staging path through CloudFront with a real user's chart.

## When things go wrong

| Situation | What the user sees |
|---|---|
| Declined topic | Fixed reply, `info` event, no model call |
| Chart facts not built yet | A plain "your chart is being prepared" message; the facts build is scheduled |
| Legacy fallback | Only if `READING_FALLBACK_LEGACY=1`; off by default |
| Any thrown error | `error` event with a public-safe message |
| Login code email | Separate path: `AUTH_PROVIDER=cognito` sends the code through Cognito; `local` needs `RESEND_API_KEY` or `SMTP_HOST` |
| Saving the run fails | Logged only; the answer is never lost because the run row could not be written |

## Switches that change this

| Setting | Effect |
|---|---|
| `READING_ENGINE` | on by default; off uses the legacy chat path |
| `READING_FALLBACK_LEGACY=1` | allows the legacy path when the chart is unavailable |
| `READING_FLOW=graph` | enables specialists and reconcile |
| `READING_MODEL_INTAKE`, `_SPECIALIST`, `_SYNTH`, `_FAST` | model ids per stage |
| `READING_MODEL_CLARIFY` | `bedrock:<model id>` turns on the Bedrock clarifier; `off` or unset uses rules only |
| `READING_SYNTH_THINKING` | how much hidden thinking the writer does (`off` / `low` / `medium` / `high`) |
| `READING_INCLUDE_THOUGHTS=0` | stop streaming and storing thought summaries |
| `READING_FULL_BASE=0` | go back to the small (1.7k-token) base |
| `READING_EXPLICIT_CACHE=1` | turn on the explicit prompt cache |
| `CHAT_SSE_PING_MS` | keep-alive interval (5–60 s) |
| `VITE_CHAT_CLARIFY=0` (web build) | the web client stops sending `clarify:true` |

## Where to look in the code

- Route and stream: `server.ts` (`/api/chat/ask-stream`), `src/routes/clarifyRoutes.ts`
- Entry and gate: `src/services/chatLlmService.ts`; run saving: `src/services/askChatTurn.ts`
- Engine: `src/reading/run.ts`, `src/reading/graph.ts`, `src/reading/llm/gemini.ts`, `src/reading/llm/models.ts`, `src/reading/config.ts`
- Pack and base: `src/reading/packs/selector.ts` (`buildEvidencePack`, `fullBaseExtras`, `renderBase`)
- Browser: `src/pages/UserData.ts` (stream parser), `src/pages/chat-interface/readingProgress.ts` (pills and thinking text),
  `ThinkingPanel.tsx`, `ChatMainArea.tsx`
