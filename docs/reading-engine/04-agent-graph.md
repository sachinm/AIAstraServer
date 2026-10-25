# 04 — Agent graph (LangGraph JS)

Lives in `AIAstra_Server/src/reading/`. LangGraph provides state, Send fan-out, streaming and the interrupt for the clarify step. Model calls go through a thin `callGemini({model, system, contents, responseSchema, thinking, cache})` wrapper built on the existing undici REST client in `geminiChatService.ts` (no `@langchain/google-genai`, no `@langchain/groq` in the hot path; the earlier `utils/standard_schema` breakage is the reason).

## 1. Module layout

```
src/reading/
  graph.ts                 // StateGraph assembly, compile, run helpers
  state.ts                 // Annotation.Root state + reducers
  nodes/
    intake.ts              // intent classification + clarify text (LLM, flash-lite)
    prepare.ts             // load dossier + transits, build evidence packs (no LLM)
    specialists/
      promise.ts dasha.ts transit.ts nakshatra.ts   // one file per analyst (LLM, flash)
    reconcile.ts           // grounding gate, window intersection, agreement (no LLM)
    synthesize.ts          // final answer, streaming (LLM, argon)
    persist.ts             // reading_runs + messages + chat_logs
  packs/
    frames.ts              // subject frame table (file 02 step 0)
    selector.ts            // buildEvidencePack
    transitTable.ts        // snapshot x natal points -> per-user rows
  prompts/                 // versioned markdown, loaded at cold start, hashed
    persona.md method.md intake.md promise.md dasha.md transit.md nakshatra.md synth.md formats/*.md
  schema/                  // zod + JSON schema for every structured output and for facts.v1
  llm/
    gemini.ts              // callGemini wrapper (REST, SSE, responseSchema, thinkingConfig, cachedContent)
    groq.ts                // fallback for specialists only
    models.ts              // model matrix from env (file 05)
  grounding/
    checker.ts             // extracts assertions from prose, verifies against dossier (also used by evals)
```

## 2. State

```ts
const ReadingState = Annotation.Root({
  // input
  userId: Annotation<string>(), chatId: Annotation<string | null>(), question: Annotation<string>(),
  historySummary: Annotation<string | null>(),            // last 2 turns, intake only
  // intake
  intent: Annotation<Intent | null>(),                     // { subjects[], horizon, questionType, format, confidence, clarifyText, followUps[] }
  confirmed: Annotation<boolean>(),                        // true when clarify not needed or user confirmed
  // prepare
  dossierRef: Annotation<{ kundliId: string; factsVersion: number; hash: string } | null>(),
  packs: Annotation<Record<string /*subject*/, EvidencePack>>(),
  transitTable: Annotation<TransitRow[]>(),
  // specialists (reducer: concat)
  findings: Annotation<Finding[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  // reconcile
  windows: Annotation<Window[]>(), agreement: Annotation<Agreement | null>(), droppedClaims: Annotation<number>(),
  // synth
  answer: Annotation<string>(), usage: Annotation<Usage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  timings: Annotation<Record<string, number>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  errors: Annotation<NodeError[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
```

## 3. Nodes and edges

```
START → intake → (needsClarify ? clarify[interrupt] : prepare)
clarify → prepare                      (resumed with Command({ resume: { confirmed, intentPatch } }))
prepare → fanOut                       (returns Send[] : one per (subject, analyst))
Send targets: promise | dasha | transit | nakshatra  → reconcile
reconcile → synthesize → persist → END
```

### intake (LLM, `gemini-3.1-flash-lite`, structured output, ≤ 1.5 s)

Input: question, last two turns summarised, list of subjects with one-line definitions, today, horizon rules. Output schema:

```ts
Intent = {
  subjects: Array<{ id: SubjectId; weight: number }>;   // max 3, weight sums to 1
  horizon: 'now' | '3m' | '6m' | '1y' | '3y' | 'life' | { from: string; to: string };
  questionType: 'timing' | 'yes_no' | 'why_meaning' | 'compare' | 'describe' | 'explain_term';
  format: 'direct' | 'timeline' | 'factor_table' | 'narrative' | 'watchlist';
  focusPoints: string[];           // free text, e.g. "Ketu transit over natal Jupiter"
  mentionsPlanets: string[];       // canonical codes, used to force those bodies into packs
  confidence: number;              // 0–1
  clarifyText: string;             // the card text, always produced
  followUps: string[];             // other questions found in the message, queued as chips
  safety: 'ok' | 'medical' | 'legal' | 'self_harm' | 'minor';  // routes to a fixed response when not ok
}
```

Decision: `needsClarify = mode === 'always' || (mode === 'when_ambiguous' && (confidence < 0.8 || subjects.length > 2 || followUps.length > 0))`. Default mode `when_ambiguous` (`READING_CLARIFY_MODE`). Intake always emits an `intent` SSE event so the UI can show the understanding line even when it does not stop.

### clarify (interrupt)

`interrupt({ card: intent.clarifyText, chips })`. The graph is checkpointed (Postgres checkpointer on the Render DB, table prefix `lg_`; `MemorySaver` is useless across Lambda invocations). While waiting, **prepare runs eagerly**: the SSE handler kicks `prepare` work (dossier load, pack build, cache ensure) in parallel with sending the card, so confirmation costs no extra latency. Resume via `POST /api/chat/confirm {runId, confirmed, intentPatch}` → `graph.invoke(new Command({ resume }), { configurable: { thread_id: runId } })` on a new SSE stream. Timeout: a run not resumed within 10 minutes is marked `abandoned`.

### prepare (no LLM, ≤ 300 ms warm)

1. Load `kundli_facts` for the latest completed kundli (fail with the existing "chart still being prepared" message if missing; enqueue a facts build).
2. Load the newest `transit_snapshots` row covering `[today, horizonEnd]`; if none, build synchronously via the pyjhora Lambda (one invoke) and store it.
3. `transitTable = joinTransits(snapshot, dossier.natalPoints)`.
4. For each subject: `packs[subject] = buildEvidencePack(dossier, transitTable, subject, horizon, intent.mentionsPlanets)`.
5. Fire-and-forget `ensureGeminiCache(user, dossierHash, promptHash)` when cache is enabled.

### fanOut → specialists (LLM, `gemini-3.8-flash`, structured output, thinking low)

```ts
function fanOut(state) {
  const sends = [];
  for (const s of state.intent.subjects) {
    sends.push(new Send('promise',   { subject: s.id, pack: state.packs[s.id], intent: state.intent }));
    sends.push(new Send('dasha',     { ... }));
    sends.push(new Send('transit',   { ... }));
  }
  // one nakshatra pass covers all subjects (it is person-centric)
  sends.push(new Send('nakshatra', { subjects: state.intent.subjects.map(s => s.id), pack: mergedNakPack, intent }));
  return sends;            // cap: 10 workers; beyond that, drop lowest-weight subject and note it
}
```

Each specialist: system = persona (short) + method section for that step (from file 02) + output schema; contents = evidence pack sections for that analyst (file 03 §3) + the question + focusPoints. `temperature 0.2`, `maxOutputTokens 2048`, `responseMimeType application/json` with `responseSchema`. Budget 12 s; on timeout or parse failure retry once with Groq `gpt-oss-120b` (same schema), then record a `NodeError` and continue. Output schema shared by all four:

```ts
Finding = {
  analyst: 'promise' | 'dasha' | 'transit' | 'nakshatra';
  subject: SubjectId;
  verdict: 'strong' | 'moderate' | 'weak' | 'denied' | 'mixed';
  claims: Array<{
    text: string;                     // one sentence, chart-specific
    evidence: string[];               // fact ids from the pack, ≥ 1 required
    polarity: 'supports' | 'obstructs' | 'neutral';
    weight: 1 | 2 | 3;
  }>;
  windows: Array<{ from: string; to: string; label: string; polarity: 'favourable' | 'testing' | 'mixed'; evidence: string[] }>;
  caveats: string[];                  // data gaps, contradictions
  keyFacts: string[];                 // ≤ 6 ids the synthesizer should quote
}
```

Specialist specifics:

- **promise**: Step 1 of file 02. Must fill `verdict` and the "form the result takes" (from the varga) as a claim with `evidence` pointing into `vargas.<D>`.
- **dasha**: Step 2. Must emit one window per period in the horizon with the deliverer/supporter/obstructor class in `label`.
- **transit**: Step 3. Must emit windows for every row in the transit table that touches the frame, flag double-transit, and handle `focusPoints` explicitly (e.g. Ketu over natal Jupiter) with the longitude-based dates from the table.
- **nakshatra**: Step 4, all eight layers as claims grouped by layer name in `text` prefix (`[janma]`, `[star-lord]`, `[tara]`…). For nakshatra deep-dive questions it is the primary analyst and the others run at reduced depth (intent `questionType=describe`, subject `general_life_direction`).

### reconcile (no LLM, < 100 ms)

1. **Grounding gate**: drop any claim whose `evidence` ids are not present in the pack given to that analyst; drop windows outside the horizon or outside the dossier dates; count drops into `droppedClaims` (a quality metric).
2. **Window algebra**: intersect dasha windows (deliverer/supporter) with transit windows (favourable, double-transit) → `windows[]` sorted by start, each with `strength = f(promise verdict, dasha class, transit polarity, double_transit, tara)`; cut by PD boundaries and ingress dates; merge adjacent identical windows.
3. **Agreement**: per subject, `{ promise, dasha, transit, nakshatra }` verdict vector and a label `converge | partial | diverge` per the convergence rule.
4. Produce the **synth brief**: ordered findings (highest weight first), windows table, agreement label, caveats, key facts card (≤ 20 lines rendered from the dossier: lagna, Moon, running MD-AD-PD with dates, frame houses with lords and placements).

### synthesize (LLM, `gemini-4-argon`, streaming)

System (stable, first, for implicit caching): persona (`pvr_oracle` from DB override or `prompts/persona.md`) + `method.md` (the convergence and honesty rules, step 5) + the format file for `intent.format`. Contents: synth brief + question. `thinkingLevel high` for `timing`/`compare`, `medium` otherwise (on 2.5 models map to `thinkingBudget` 2048/1024); `maxOutputTokens 4096`; loop guard on. Tokens stream to SSE as today. The synthesizer may not introduce a placement that is not in the brief; the grounding checker runs on the final text in `persist` and the result is logged (not blocking in v1; blocking with a one-shot rewrite in v2 if the failure rate warrants it).

Fast lane: when `questionType ∈ {yes_no, explain_term}` and one subject and horizon ≤ 6m and `READING_FAST_LANE=1`, skip specialists; `synthesize` runs on `gemini-3.8-flash` directly over the promise+dasha pack with the same rules. Target < 15 s.

### persist

Writes `reading_runs` (intent, packs hash, findings, windows, agreement, per-node timings, usage/cost per model, cache hits, dropped claims, grounding result), then the existing `messages` + `chat_logs` via `persistAskTurn` (request payload = synth brief, not the raw dossier).

## 4. Streaming contract (extends the existing SSE)

Existing: `start`, `token`, `done {chatId, answer}`, `error`, `: ping` comments. Added:

| event | payload | when |
|---|---|---|
| `intent` | `{ runId, intent }` | after intake, always |
| `clarify` | `{ runId, card, chips: { subjects[], horizons[] }, followUps[] }` | when interrupted; stream ends after this event |
| `stage` | `{ name: 'prepare'|'promise'|'dasha'|'transit'|'nakshatra'|'reconcile'|'synthesize', status: 'start'|'done'|'failed', ms? }` | on every node start/finish; UI renders chips ("Reading D-10… ✓") |
| `windows` | `{ windows[] }` | after reconcile, so the UI can render the timeline table skeleton before prose arrives (optional in v1) |
| `done` | adds `runId`, `grounding: { checked, failed }` | end |

Implementation: `graph.streamEvents(input, { version: 'v2' })`; map `on_chain_start/end` for nodes to `stage`, `on_custom_event` for `intent`/`clarify`/`windows`, and the synth node writes tokens via a callback as today. Groq and Gemini token deltas both arrive through `onDelta`.

GraphQL `ask` keeps working: it runs the same graph with clarify mode `never` and returns the final text.

## 5. Failure handling and limits

- Any specialist failure → continue; the synth brief notes the missing layer and the answer says so in one line.
- Intake failure → fall back to `general_life_direction`, `narrative`, no clarify.
- Dossier missing → existing "still being prepared" message; enqueue build.
- Transit snapshot missing and pyjhora invoke fails → run without transits, say so.
- Hard budget per run: 90 s wall clock (Lambda 300 s), 12 s per specialist, 45 s synth; `AbortController` everywhere via the existing undici agent.
- Concurrency: at most 10 Sends per run (`maxConcurrency` in graph config); per-user one run at a time (reject a second ask-stream while one is in flight with a clear message).
- Rate limits: Gemini paid tier; if 429, retry with jitter once, then Groq for specialists, then error.

## 6. Prompt skeletons (the actual files live in `src/reading/prompts/`)

**persona.md** (shared, short): voice of PVR Narasimha Rao — humble, exacting, scriptural; Sanskrit terms with a short gloss; never claim certainty; cite the chart. 150 words. The DB `pvr_oracle` row, if active, overrides this file only.

**intake.md**: subject list with definitions; horizon rules ("next few months" → 6m; "this year" → to Dec 31; "soon" → 3m); format rules; "produce clarifyText in second person, one sentence, naming subject, horizon and the charts you will read"; the safety routing list.

**promise.md** (excerpt of the rule text the model sees):
> You judge whether the chart promises the asked result. Use only the facts given; each fact has an id. For every house in the frame: lord placement and dignity, occupants, aspects and argala, karaka state, the varga confirmation (D-1 lord in the varga, the varga lagna, the same house in the varga), arudha, yogas, shadbala and ashtakavarga. The varga refines D-1; it never replaces it. Output JSON only, in the schema. Every claim must list the ids it rests on. If a needed fact is absent, write a caveat instead of guessing.

**dasha.md**: Step 2 rules; the star-lord rule spelled out; the AD-from-MD rule; window emission requirement; "the current period is given; do not recompute it".

**transit.md**: Step 3 rules; double-transit definition; "use the dates in the table, never your own ephemeris"; the specific handling of `focusPoints` (if the user named a transit, address it first).

**nakshatra.md**: the eight layers as a checklist with the fact paths for each; tara meanings table; gandanta/pushkara meanings.

**synth.md**: convergence rule, confidence vocabulary, honesty rules, "windows are only those in the brief", format obedience, markdown rules, length guidance per format (direct ≤ 250 words, timeline ≤ 450 + table, narrative ≤ 700), one-line cross-subject mention max, no remedies.

**formats/*.md**: the exact section skeleton and table header for each format.

## 7. Why LangGraph here and not plain `Promise.all`

Send fan-out with reducers, per-node streaming events, checkpoint + interrupt for the clarify step, and a run graph that is inspectable in logs. `Promise.all` would cover Phase 1 but not the clarify resume or the per-stage events, and the graph makes adding a fifth analyst (e.g. a `varshaphal` analyst later) a one-node change. The dependency is already in `package.json` (`@langchain/langgraph ^1.1.4`, `@langchain/core ^1.1.20`); add `@langchain/langgraph-checkpoint-postgres` only when Phase 3 lands.
