# 64 — The You reading in 10–15 seconds: build off the request, hand the Oracle findings not packs, write cards not essays

Status: **plan with Phase 1 built, 2026-11-08 (night),** written for Sachin's question of the same night: "why does the
Oracle need 1–3 minutes when sub-agents do the leg work, and why did the page show 'did not load' instead of loading
until the Oracle answered". Phase 1 (§7) is on branch `fix/self-reading-background-build` (server and web). Phases 2–4
change prompts and the DAG and wait for Sachin's yes on model, count and cost before any paid call (doc 63 §8).

Rules that bind every line: the calculation engine is the only source of astrological values and is never named in
anything a person sees; Node selects, joins and formats, it derives nothing; every agent and technique is registered and
tagged; every sub-agent passes `cachePrefix` and `cacheOwner` and stores its output.

## 0. Answer first

| Sachin's question | The answer |
|---|---|
| Why no loading state until the Oracle returned? | `GET /api/self/reading` raced the whole build against a **10 s** timer and answered `503 reading_slow`; the web mapped every non-OK answer to "Your reading did not load". The build itself cannot finish inside one request anyway: the Lambda sits behind CloudFront (origin timeout 30–60 s) and a cold build is 50–90 s when it works. |
| Why did the Oracle time out at 9:17 pm? | After the 503 went out, Lambda **froze the container**; the Oracle's Gemini call started only when the Retry click thawed it, and its 60 s timer fired on the next thaw. Two of today's three builds failed this way (163 s and 300 s). The one that worked (7:36 am, admin lab, 35 s) ran in an invocation that stayed alive. |
| Why does the Oracle take 35 s even when it works? | It is handed **45,110 input tokens** (the raw chart packs again, 38 k characters, plus the lineman's and families' findings) and asked to write an **11,500-character essay** (3,552 output tokens + 944 thinking) that the web page never shows. The five sub-agents do not reduce the Oracle's work: their 3,100 tokens of findings are appended to, not substituted for, the packs. The lineman is handed 43,414 tokens the same way. |
| Can the whole reading take 10–15 s? | Yes. Loads should take **under 1 s**: build on triggers (new digest, clock boundary, new year chart, confirm answer, doc 63 §0 Q2), never on a page open. A cold build can be **≈15 s**: families in parallel (5–7 s) → one lineman on findings only (3–4 s) → Oracle on findings + claims only, writing only the card lines, plan, calendar and valid-until (≈1,000 output tokens, 6–8 s, thinking low). The essay is dropped or moved to a parallel low-cost call. |

## 1. Start: facts checked 2026-11-08 on the shared database (kundli `c584c0a3`, Sachin)

| Build (PST) | Trigger | Families | Lineman | Oracle | Outcome |
|---|---|---|---|---|---|
| 07:35–07:36 | admin lab, scope `body`, manual | 5 calls, 5.2–7.3 s each (then sequential: 29.5 s) | 7.0 s, 43,414 prompt tokens, 1,684 out | **35.3 s**, 45,110 prompt, 3,552 out + 944 thought, $0.051 | ok; $0.084 total; essay 11,516 chars; 1 card line per panel; 0 plans parsed |
| 17:32–17:37 | page open | 5 calls, 5.2–6.8 s in parallel | **44.1 s** | failed after **299.9 s**: "Gemini call timed out after 60000ms" | dossier `de1bc2b9` written with `oracle.status = failed`; page showed "did not load" |
| 21:17–21:20 | page open (the 9:19 pm run) | 4 cached, `family.year` 6.4 s | 7.6 s | failed after **163.6 s**, same error | dossier `5ea12dca`; page showed "did not load"; panels carried only the code template lines |

Other facts:

- The route (`src/routes/selfReadingRoutes.ts`) `Promise.race`s `getSelfReading` against `timeoutMs ?? 10_000` and
  returns `503 { error: 'reading_slow' }`. The web (`src/lib/selfReadingApi.ts`) returns `{ kind: 'error' }` for any
  `!r.ok` other than 404, so the panel shows "Your reading did not load." with a Retry button.
- The Lambda is the Function URL `aiastra-server-api` (RESPONSE_STREAM, 300 s) behind CloudFront. Once the response is
  sent the invocation ends and the container is frozen until the next request; promises left running continue only
  while a later request thaws it. Timers measure wall time, so a 60 s Gemini timer set before a freeze fires on the thaw.
- `runSelfOracle` (`src/reading/self/oracle.ts`): the Oracle prompt is `linemanPrefix` (every active family pack's full
  prefix) + the compiled brief (board instruction + claims brief + lineman findings + family findings). Output budget
  `SELF_ORACLE_MAX_OUTPUT_TOKENS` default 8,000, `thinking: 'medium'`. The lineman gets the same prefix plus findings.
- The web (`src/pages/you/SelfReading.tsx` on `develop`) renders `panel.lines` only. `reading.oracle.text` (the essay),
  `reading.oracle.panelPlans` and the per-panel `plan` are in the JSON and never rendered. The Oracle's PANEL_SYNTHESIS
  lines reach the page only as extra `<panel>.ai.N` lines after the code auditor.
- Doc 63 §0 Q2 already decides: a load costs $0 and runs no agent; money and time are spent on a build with four
  triggers. The code built since then runs the build on page open instead.

## 2. End goal

A person opening You sees the reading in under a second when it is built, and a truthful "being written, usually within
two minutes" state with automatic refresh when it is not. No request ever waits on a model. A cold build of all nine
panels, including the Oracle's dated card lines, plan and calendar, completes in about 15 s inside its own invocation,
never times out on a frozen container, and costs about $0.03. Nothing the Oracle writes is thrown away: every token it
produces is rendered or stored for the lab.

**The scope of the Self reading (Sachin, 2026-11-08 night, restating `docs/product/you-board-synthesis-review.md` §5).**
The reading answers "who am I and what am I going through right now" from the **running Mahadasha** of the kundli's
reading clock and nothing beyond it: the Mahadasha lord's chain (houses from lagna and from the Moon, dignity, avastha,
star lord, the yogas it forms), then the **running Antardasha's relationship to it** (the Antardasha lord's house from
the Mahadasha lord, 6/8 and 2/12 relations, star-lord delivery, what it presses and what it delivers, with its dates).
The previous chapter appears only as "what you came out of", the next only as its boundary date and lord; no
predictions past the current Mahadasha. Every statement is one the panels' claims and at least one confirming clock
back, so it is said with 95–100 percent confidence or not at all (doc 62: a line without grounding is withheld, never
softened). The Oracle's job is to **synthesize that reading into the dashboard's areas**: one dated card per panel
(In short, Your chapters, Who you are, Your mind, Your body, Your soul's aim, Gifts and knots, What you struggle with,
This year), each with its plan and calendar, not one essay. Phase 3 (§7 step 6) rewrites `oracle/self.md` to this
scope.

## 3. Deliverable

1. Server: the reading build runs as a background event (`self-reading-build`) in its own Lambda invocation (in-process
   off Lambda), guarded by a per-kundli per-board `area_builds` marker so two polls never start two builds; the route
   answers from the store or `202 { status: 'preparing', stage: 'reading' }`; it never returns 503 for slowness.
2. Web: 202 and transient 502/503/504 keep the loading state ("Your reading is being written…"), polling every 10 s for
   up to six minutes; the Oracle's synthesis (card lines, plan, calendar, and the essay while it exists) is rendered.
3. Prompts and DAG (Phases 2–3): the lineman and Oracle receive findings and claims, not packs; the Oracle writes cards,
   plan, calendar and valid-until only; thinking low; output budget 1,500.
4. Triggers (Phase 4): the digest event and the sweep queue a reading build for Self (then Love, Work) so the first page
   open after a digest is already a cache read.

## 4. How it works when done

**Backend.** `GET /api/self/reading` runs the nine code panels (≈0.5 s, stored) and asks the Oracle store in
`cached_only` mode: a stored Oracle output for this digest version, clock, year chart, sky and answers hash is served;
none means `oracle.status = 'pending'`. The route then calls `queueSelfReadingBuild(userId, board)`: it upserts
`area_builds (kundli_id, '<board>.reading', today)` with `status = 'building'` and `result.started_at`; if a row is
already `building` and younger than 10 minutes it does nothing; otherwise on Lambda it invokes the function
asynchronously with `{ source: 'self-reading-build', userId, board, token }` (the same self-invoke and token as
`kundli-digest`), and off Lambda it runs the build detached in process. The event handler (`POST /events`) runs
`getBoardReading(…, { trigger: 'request' })` to completion in its own 300 s invocation, which stores the Oracle output
in `technique_outputs`, writes the dossier and marks the `area_builds` row `ready` or `failed`. A build that failed in
the last 30 minutes is not re-queued: the route serves the code panels with `oracle.status = 'failed'` so the person
sees the reading rather than a spinner, and the lab shows the failure.

**API.** `200 { status:'ok', reading }` as before, with `reading.oracle` when the model layer is on; `202 { status:
'preparing', stage: 'chart' | 'reading' }`; `404 no_kundli`; `500 self_reading_failed`. No `503 reading_slow`.

**Frontend.** "Your reading" shows the skeleton with "Reading your chart…" on the first request, then "Your reading is
being written. It usually takes a minute or two and will appear here by itself." while 202/stage=reading, polling every
10 s; 202/stage=chart keeps the 30 s poll. After six minutes without a reading it shows the error with Retry. A 502,
503 or 504 is treated as "still being written", never as an error. When the reading arrives, each panel card renders
its lines, then the Oracle's plan (summary, dated steps, calendar) and, while the prompt still produces it, the essay in
a "The full reading" card under the panels.

**The reading is a dashboard, not an essay (Sachin, 2026-11-08 late night).** Nobody reads "The full reading". The
Oracle already writes its reading under headings that name the panels (In short, Your chapters, Who you are & Your
soul's aim, Your mind & Brain, Your body, Gifts and knots & What you struggle with, This year); the service now splits
the text at those headings (`splitOracleSections`) and hands each panel its own section as `panel.synthesis`, a joint
heading feeding both panels it names. The page renders that prose inside the panel, under the card lines and above the
plan, with a **dates table** built from every dated sentence in the section (ranges and single dates), so each area of
focus carries its own statements, its own dates and its own plan. The whole text is shown only when no panel took a
section (an old stored output). Phase 3 keeps this shape and adds what prose cannot: a dasha timeline chart for Your
chapters, a year calendar for This year, and a gifts/knots table, each from the stored engine rows, never from the text.
The loading state is the same per panel: each card shows at once under a veil with the rotating Oracle lines, and the
veil lifts when its section lands.

**UI/UX.** No engine names, no internal scores or multipliers (the prompt now forbids them); the loading copy never
promises a time it cannot keep.

## 5. Architecture after Phases 2–4

```
digest built / clock boundary / new year chart / confirm answer ─► self-reading-build event (own invocation, ≤ 300 s)
   ├─ 9 code panels (stored)                         0.5 s
   ├─ 5 family readers, parallel, findings cached    5–7 s   (packs via cachedContents; ~1–17 k tokens each)
   ├─ lineman.self on findings + claims brief        3–4 s   (≈ 8 k tokens in, 1.5 k out)
   └─ oracle.self on findings + lineman + claims     6–8 s   (≈ 10 k tokens in, ≤ 1.5 k out: cards, plan, calendar, valid-until; thinking low)
                                                   ────────
                                                    ≈ 15 s cold, $0.03; page open reads the store in < 1 s
```

The five families stay (doc 63 §0 Q8). The lineman's prefix drops the raw packs: its job is to join findings, not to
re-read the chart. The Oracle's prefix drops the raw packs and the essay; the mechanism explanations it writes today
become the `detail` of each card line (shown under Chart details) and the plan's summary. If Sachin wants the long
narrative kept, it runs as a parallel `narrator.self` call on `gemini-3.1-flash-lite` (≈ 10 s, $0.01) and is stored for
the lab and an optional "Read in full" sheet, so it never sits on the critical path.

## 6. Ingredients

Server: `src/routes/selfReadingRoutes.ts`, `src/reading/self/service.ts`, `src/reading/self/oracle.ts`,
`src/reading/self/buildEvent.ts` (new), `server.ts` (`/events`), `src/reading/self/types.ts`, prompts
`src/reading/prompts/oracle/self.md` and `readers/R15-self.md` (Phase 2), `src/reading/digest/event.ts` (Phase 4).
Web: `src/lib/selfReadingApi.ts`, `src/pages/you/SelfReading.tsx` and tests. Config: `KUNDLI_DIGEST_EVENT_TOKEN` (already
set on the Lambda) authorises the self-invoke; `SELF_ORACLE_MAX_OUTPUT_TOKENS` drops to 1,500 in Phase 3.

## 7. Action steps

1. **Built.** Oracle `cached_only` mode: `runSelfOracle` returns `{ status: 'pending' }` without a model call when no
   stored output covers today; the sentinel is never stored (`skipStore`).
2. **Built.** `buildEvent.ts`: event parse (token-guarded), `queueSelfReadingBuild` with the `area_builds` marker,
   `handleSelfReadingBuildEvent`; `/events` dispatch; off-Lambda in-process build.
3. **Built.** Route: `cached_only` read → 200 or `202 stage=reading`; `failed` within 30 min → 200 without Oracle lines;
   slow code path → 202, never 503. Oracle and lineman Gemini timeouts raised to 150 s / 90 s because they now run in an
   invocation that is not frozen.
4. **Built.** Web: 202 stage copy and 10 s poll, 502/503/504 as "being written", six-minute budget; render `plan` and
   the Oracle essay; tests for each state.
4b. **Built (branch `feat/self-reading-oracle-veil`).** The code panels served at once with `oracle.status = 'pending'`;
   per-panel veils with the rotating Oracle lines; the Oracle's sections split into `panel.synthesis` and rendered as
   prose with a dates table inside each panel; the essay card retired; citations and empty backticks tidied; the prompt
   forbids internal scores and inline bullet runs.
5. Phase 2: lineman prompt and prefix take findings + claims only; measure tokens and seconds in the lab on two kundlis
   before and after (no paid call without Sachin's yes: 2 kundlis × 1 lineman ≈ $0.03).
6. Phase 3: Oracle prompt rewritten to the §2 scope (running Mahadasha, its Antardasha relationship, per-area cards
   with plan and calendar, valid-until = the Antardasha boundary); writes cards, plan, calendar, valid-until only;
   `thinking: 'low'`; budget 1,500; the essay to `narrator.self` or dropped (Sachin decides); the lineman and the
   families' `dynamic` suffix are narrowed to the same window; measure (2 kundlis ≈ $0.05).
7. Phase 4: the digest event and the sweep queue `self-reading-build` after a successful digest; the clock-boundary and
   confirm triggers of doc 63 §6 follow.
8. Phase 4: Love and Work readings take the same route and event (one `board` parameter already carried).

## 8. Development phases

| Phase | Scope | Time | Cost | Gate |
|---|---|---|---|---|
| 1 | Background build, truthful loading state, synthesis rendered | this branch | $0 (no new calls) | server + web tests green; one live open of You shows "being written" then the reading |
| 2 | Lineman on findings only | 0.5 day | ≈ $0.03 measured | lineman ≤ 5 s, claims parse unchanged |
| 3 | Oracle writes cards only; essay off the path | 0.5 day | ≈ $0.05 measured | cold build ≤ 15 s; every PANEL_SYNTHESIS, PLAN, CALENDAR line parsed; audit pass |
| 4 | Build on digest/sweep triggers; Love and Work | 1 day | per build ≈ $0.03 | first page open after digest is a cache read < 1 s |

## 9. Recommendation

Ship Phase 1 now: it ends the "did not load" page and the frozen-container timeouts without touching prompts or spend.
Then do Phases 2 and 3 together in the Techniques Lab on two kundlis, because the 10–15 s target is reached by what the
Oracle is given and asked to write, not by a faster model: 45 k tokens in and 3.5 k out can never be 10 s, 10 k in and
1.5 k out on `gemini-3.8-flash` is. Keep the essay only as a parallel, cheaper narrator if Sachin wants it read in full.
