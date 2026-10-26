# 24 — What happens when a user submits a question

Plain-language walk-through of one chat turn on the new chat path (reading engine on, as it is by default). Written from the code
on `develop`; file references are given so each claim can be checked.

## The short answer

- You do **not** see the model's reasoning. The server never asks Gemini for thoughts (`includeThoughts: false` in
  `src/reading/llm/gemini.ts`) and drops any thought part it receives. Thinking happens, costs tokens, and is discarded.
- You **do** see progress before the answer: an "I understood …" line and a row of stage pills (Understanding, Chart facts,
  Writing, and in the graph flow also Promise, Dasha, Transits, Nakshatras, Cross-check).
- The **final answer streams** token by token as it is written.

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
       a. intake     rules classifier first, small model if needed -> intent     (intake, doc 15)
                     (data reads start now, in parallel with intake)
       b. prepare    build the evidence pack from the stored chart facts and transits
       c. write      single flow (default): one streamed Gemini call
                     graph flow (READING_FLOW=graph): specialists -> reconcile -> one streamed call
  7. save            the turn is stored (persistAskTurn), then "done" is sent
```

Self-harm questions skip steps b and c: intake flags them and a fixed supportive reply is streamed.

## What the browser receives (server-sent events)

| Event | When | What the UI does |
|---|---|---|
| `start` | stream opened | shows the working state |
| `intent` | after intake | draws the "I understood …" line, subjects, time horizon, and the template frame |
| `stage` | start / done / failed / skipped for each step | updates one pill per stage (`readingProgress.ts`) |
| `windows` | graph flow, after reconcile | shows how many timing windows were found |
| `info` | declined topic, or chart not ready | explains why there is no full reading |
| `clarify` / `propose` | clarify agent | renders a question card with chips |
| `token` | answer text, many times | appends text to the answer |
| `done` | answer saved | closes the turn; carries `chatId`, the final `answer`, `runId`, and `grounding.dropped` |
| `error` | any failure | shows a public-safe message |

Lines starting with `:` are keep-alive comments the client ignores.

## What streams and what does not

| Part | Streams to the user? |
|---|---|
| Model thinking / reasoning | **No.** Never requested, never shown. |
| "I understood …" line and stage pills | Yes, as events, before the first answer token |
| Specialist analyses (graph flow) | **No.** They run silently and appear only as a stage pill; they feed the final writer |
| The final answer | **Yes**, token by token |

Expect a quiet gap between the pills and the first words: the first token arrives only after intake, evidence packs and the
model's own thinking time. On staging it was about 5–12 s in the 12-question eval.

## Which flow runs

- **single** (default; `READING_FLOW` unset): one call to the writer model over the evidence pack. This is what staging runs.
- **graph** (`READING_FLOW=graph`): specialist calls per subject, a reconcile step that cross-checks them, then the same
  streamed writer call. Slower, richer, more pills. Questions that qualify for the fast lane skip the specialists.

## When things go wrong

| Situation | What the user sees |
|---|---|
| Declined topic | Fixed reply, `info` event, no model call |
| Chart facts not built yet | A plain "your chart is being prepared" message; the facts build is scheduled |
| Legacy fallback | Only if `READING_FALLBACK_LEGACY=1`; off by default |
| Any thrown error | `error` event with a public-safe message |
| Login code email | Separate path: `AUTH_PROVIDER=cognito` sends the code through Cognito; `local` needs `RESEND_API_KEY` or `SMTP_HOST` |

## Switches that change this

| Setting | Effect |
|---|---|
| `READING_ENGINE` | on by default; off uses the legacy chat path |
| `READING_FALLBACK_LEGACY=1` | allows the legacy path when the chart is unavailable |
| `READING_FLOW=graph` | enables specialists and reconcile |
| `READING_SYNTH_THINKING` | how much hidden thinking the writer does (`off` / `low` / `medium` / `high`) |
| `READING_MODEL_INTAKE`, `_SPECIALIST`, `_SYNTH`, `_FAST` | model ids per stage |
| `CHAT_SSE_PING_MS` | keep-alive interval (5–60 s) |
| `VITE_CHAT_CLARIFY=0` (web build) | the web client stops sending `clarify:true` |

## Where to look in the code

- Route and stream: `server.ts` (`/api/chat/ask-stream`), `src/routes/clarifyRoutes.ts`
- Entry and gate: `src/services/chatLlmService.ts`
- Engine: `src/reading/run.ts`, `src/reading/graph.ts`, `src/reading/llm/gemini.ts`, `src/reading/config.ts`
- Browser: `src/pages/UserData.ts` (stream parser), `src/pages/chat-interface/readingProgress.ts` (pills), `ChatSection.tsx`
