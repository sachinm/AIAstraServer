# AI Astra Reading Engine — Plan

**Status:** proposal, 2026-10-24. No code in this change; this folder is the plan.
**Owner:** Sachin. **Scope:** chat readings only (no Panchanga, no Prashna, no remedies).

This document is the plan. The companion files hold the detail:

| File | What it covers |
|---|---|
| [01-current-state.md](./01-current-state.md) | What is actually live today (branch, flow, latency, data, infra) and why it is slow and keeps going to D-1 |
| [02-reading-method.md](./02-reading-method.md) | The reading algorithm: subject → houses/karakas/varga → promise → dasha timing → transit triggers → nakshatra layers → synthesis |
| [03-chart-facts-dossier.md](./03-chart-facts-dossier.md) | The deterministic "chart facts" dossier the Python engine must produce, with fact ids, and the per-subject evidence pack |
| [04-agent-graph.md](./04-agent-graph.md) | The LangGraph design: nodes, state, fan-out, structured outputs, streaming events, failure handling, prompt skeletons |
| [05-cost-latency-caching.md](./05-cost-latency-caching.md) | Model matrix (verified against ai.google.dev on 2026-10-24), token budgets, cache strategy, per-reading cost and latency |
| [06-schema-api-infra.md](./06-schema-api-infra.md) | Prisma migrations, GraphQL/SSE contract, Python API changes, Lambda/EventBridge/Secrets changes |
| [07-evaluation.md](./07-evaluation.md) | Golden question set (including Sachin's test questions), grounding checker, scoring rubric |
| [08-rollout.md](./08-rollout.md) | Phases, branch strategy, what ships when, go/no-go gates |

---

## 1. End goal (what "done" looks like)

A user asks a question in chat. Within about 2 seconds the engine says what it understood ("You are asking about **income and career** over the **next 6 months**; I will read the 2nd/10th/11th houses, D-10, D-2, your Saturn–Mercury–Ketu period and the Ketu transit over natal Jupiter"). The user confirms or corrects with one tap. The engine then streams a reading whose **every astrological claim is traceable to a computed fact** (a placement, lordship, aspect, dasha date or transit date produced by the Python engine, never derived by the LLM), organised by the classical method (promise → timing → trigger), presented in one of a small set of formats (direct answer, timeline table, factor table, narrative, watch-list), with explicit confidence and explicit date windows.

Targets:

| Metric | Today | Target |
|---|---|---|
| First visible progress | ~20–30 s (first token) | < 2 s (intent card), < 10 s (first answer token) |
| Complete answer | 21 s tuned / 60 s+ untuned, often cut off | ≤ 40 s for a full multi-layer reading; ≤ 15 s on the fast lane |
| Grounding | unmeasured; model recomputes placements and often defaults to D-1 | 100 % of placement/lordship/dasha/transit assertions verified against the dossier by an automated checker |
| Method coverage | one prompt, model chooses | every reading touches the subject houses, karakas, varga, dasha lords and transits by construction |
| Cost per reading | ~$0.03 (2.5-flash, raw JSON) | ~$0.05 fast lane, ~$0.10 full reading (see file 05) |
| Observability | request/response blobs in `chat_logs` | per-node timings, tokens, cost, model, cache hit, evidence ids in `reading_runs` |

## 2. Diagnosis in one paragraph

The current system sends ten pretty-printed JSON blobs (planet longitude strings per chart, dasha date lists) plus a persona prompt to one Gemini call and asks it to do everything. The model therefore has to **compute** before it can **interpret**: find house lords, count houses, decide which dasha runs today, infer aspects, infer nakshatra lords. It has no transit data at all, so "Ketu over my Jupiter" is unanswerable from the data; the vargas are planet lists without house context, so the model falls back to D-1 where it at least sees a lagna; and the "lean" context mode drops D-7/D-10/Narayana entirely for speed. Latency comes from roughly 30–50k tokens of whitespace-heavy JSON, thinking, long output and a single sequential call. Full detail with numbers in [01-current-state.md](./01-current-state.md).

## 3. The decision: compute → select → interpret → synthesize

This is the architecture. Everything else in this folder serves it.

```
                     +-----------------------------------------------------------+
  birth data ------> | Python engine (pyjhora Lambda `aiastra-pyjhora`)          |
  (once per kundli)  |  NEW type=facts    -> full "chart facts dossier" (ids)    |
                     |  NEW type=transits -> gochara + ingresses (global, daily) |
                     +----------------------------+------------------------------+
                                                  | stored: kundli_facts, transit_snapshots
                                                  v
  question --> intake (flash-lite, ~1 s) --> [clarify card <-> user]  (configurable)
                     | intent: subjects[], horizon, question type, format
                     v
               prepare (no LLM): evidence packs per subject from the dossier + transits
                     |
        +------------+-------------+-------------+-------------+   LangGraph Send fan-out
        v            v             v             v             v   (gemini-3.8-flash, JSON out)
    promise       dasha         transit      nakshatra     (per extra subject...)
    analyst       analyst       analyst      analyst
        +------------+-------------+-------------+-------------+
                     v
               reconcile (no LLM): grounding gate, window intersection, agreement score
                     v
               synthesize (gemini-4-argon, thinking, streaming) -> SSE tokens -> UI
                     v
               persist: messages, chat_logs, reading_runs
```

Why this and not the alternatives:

| Option | Verdict | Why |
|---|---|---|
| Keep one big prompt, add more rules | **No** | Rules cannot make the model compute house lords or transits reliably; latency does not improve; already tried (Phase A). |
| One big prompt but with the facts dossier instead of raw JSON | **Yes, as Phase 1** (quick win) | Removes the computation burden and the D-1 bias immediately; cheap to ship; validates the dossier before the graph exists. |
| Multi-agent with each agent given *all* data | **No** | Multiplies tokens and latency; agents still have to find their slice. |
| Multi-agent where each specialist gets only its evidence pack, parallel, structured output, then one reasoning synthesizer | **Yes, the target** | Parallelism cuts wall-clock; small packs cut tokens; structured claims with evidence ids make grounding checkable; the synthesizer reasons over findings, not over 40k tokens of JSON. |
| Agents with tools calling the Python engine live per question | **Later, not now** | Useful for "what if" questions, but a round trip per tool call adds seconds; the precomputed dossier covers the large majority of questions. Phase 5 option. |

## 4. The reading method the engine encodes

The method (fully specified in [02-reading-method.md](./02-reading-method.md)) is the standard integrated Parashari–Jaimini workflow that PVR Narasimha Rao teaches in the book and in Jagannatha Hora, which is also exactly what pyjhora implements. Computation and interpretation therefore stay in one tradition.

1. **Frame**: map the subject to houses, karakas, the divisional chart, arudha pada and special lagna (a fixed table; e.g. career → 10th, 10th lord, Sun/Saturn/Mercury, D-10, A10, AmK).
2. **Promise** (static): is the result promised at all? Lord placement and dignity, occupants, graha and rasi drishti, argala, yogas, varga confirmation, arudha, shadbala and ashtakavarga strength.
3. **Timing** (dasha): current and upcoming Vimshottari MD/AD/PD lords, each judged by its ownership, placement, varga position, nakshatra lord and relation to the subject houses; Narayana dasha sign for the life-direction layer.
4. **Trigger** (gochara): slow planets (Saturn, Jupiter, Rahu/Ketu) over natal points from Lagna, Moon and Arudha Lagna; double-transit; nakshatra-level transits; ashtakavarga bindus of the transited sign; fast planets for month-level windows.
5. **Nakshatra layers** (the "eight ways"): janma nakshatra, lagna nakshatra, each planet's nakshatra and star-lord, dasha-lord nakshatra, tara bala from janma tara, pada → navamsa link, transit nakshatra vs natal, arudha-lagna nakshatra; gandanta and pushkara flags.
6. **Synthesis rule**: an event is likely only when promise, dasha and transit agree; one layer alone is "possible, weak"; disagreement is said out loud. Windows are AD/PD boundaries intersected with transit ingress dates. No remedies, no amounts, no lottery promises; speculation questions are answered as "windows of gains from 5/11/2 and Rahu/Jupiter" with an honesty caveat.
7. **Presentation**: the intake step chooses one of five formats; the synthesizer must obey it. Tables for comparisons and timelines, numbered lists for sequences, direct answer first.

## 5. What has to change (summary)

| Layer | Change | Detail |
|---|---|---|
| Python engine (AIAstra_Radha) | New export types `facts` (full dossier, one call) and `transits` (date-parameterised, global). Store lat/lon/tz once; stop geocoding on every call. | [03](./03-chart-facts-dossier.md), [06](./06-schema-api-infra.md) |
| Database | `kundli_facts`, `transit_snapshots`, `reading_runs`; `kundlis.lat/lon/tz`; `chats.subject_tags/last_activity_at`. Prompts move to versioned files in the repo; `system_prompts` keeps the persona override. | [06](./06-schema-api-infra.md) |
| Server (AIAstra_Server) | New `src/reading/` module: LangGraph graph, evidence-pack selector, specialists, synthesizer, grounding gate; SSE protocol gains `intent`, `clarify`, `stage` events; `confirm` resume path. Existing Gemini REST client stays. | [04](./04-agent-graph.md) |
| Web (AIAstra_WEB) | Intent/clarify card with subject chips, stage indicators during the read; formats already render (remark-gfm). | [06](./06-schema-api-infra.md) |
| Infra | pyjhora Lambda image rebuild; kundli-worker also builds facts and (when billing is paid) the Gemini cache; new daily EventBridge rule for transits; env for the model matrix; Terraform updates in `aiastra-aws-terraform`. | [06](./06-schema-api-infra.md) |
| Models | Specialists on `gemini-3.8-flash` (explicit per-user cache once billing is paid); synthesizer on `gemini-4-argon` (implicit cache only, so stable prefix first); intake on `gemini-3.1-flash-lite`. All via env; Groq kept as specialist fallback. | [05](./05-cost-latency-caching.md) |
| Evaluation | 12 golden questions on the test chart, automated grounding checker, rubric; run on every prompt or model change. | [07](./07-evaluation.md) |

## 6. Order of work

Detailed in [08-rollout.md](./08-rollout.md). Short form:

0. **Consolidate**: `origin/feature/gemini-context-cache` is the live code and `main` is 37 commits behind it. Merge to main first; everything below branches from there.
1. **Phase 1 — dossier + grounded single call** (quick win, about 1 week): Python `facts`/`transits`, tables, evidence-pack selector, replace raw JSON in the existing Gemini call with the evidence pack and today's transits. Measure with the eval set. The D-1 bias and the "no transit" gap should disappear and input tokens should drop by more than half.
2. **Phase 2 — the graph** (about 2 weeks): intake, fan-out specialists, reconcile, synthesizer, `reading_runs`, stage events in SSE.
3. **Phase 3 — clarify step + UI + nakshatra depth** (about 1 week): HITL confirm card, formats, nakshatra analyst at full depth.
4. **Phase 4 — tune**: evals, model matrix, cache after paid billing, cost dashboard, fast lane.

## 7. Decisions already taken (so nobody re-litigates them)

- **Deterministic first.** Anything pyjhora can compute, the LLM never computes. This is the single biggest accuracy lever.
- **Select per question, not lean/full.** `CHAT_KUNDLI_CONTEXT=lean|full` goes away; the evidence pack is chosen by subject.
- **Structured outputs with evidence ids** for every specialist; a claim without an id is dropped before synthesis.
- **Orchestrate with LangGraph JS, call Gemini with the existing REST client.** The earlier `@langchain/groq` / `@langchain/core` export breakage is a warning against coupling the model layer to LangChain provider packages; LangGraph is used for state, Send fan-out, streaming and interrupts only.
- **Prompts are code**: versioned markdown in the repo, hashed into the cache key; the DB `pvr_oracle` persona remains an override for voice, not for method.
- **No remedies, no Panchanga, no Prashna** in this scope. The method table lists D-30/D-24/D-20 where they would apply and marks them "add when needed"; pyjhora already computes them, so adding one is a config change in the dossier.
- **Clarify step is configurable** (`always` / `when_ambiguous` / `never`); default `when_ambiguous`, with pre-warming during the wait.
