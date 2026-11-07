# 56 — Technique pieces: standard parts, illustrated, and outputs stored by validity window

Status: Phase 1 (`src/techniques/pieces.ts`, `src/techniques/piecesDoc.ts`) and Phase 2 (`src/techniques/outputStore.ts` `withTechniqueOutput` + `technique_outputs` migration) built on `feat/technique-pieces` (server) and `feat/machinery-page` (admin). The generated area/family illustrations are in
[docs/admin/07-technique-pieces-and-agents.md](../admin/07-technique-pieces-and-agents.md) and the one-per-page per-technique visual manual is in [docs/techniques/README.md](../techniques/README.md) ([docs/reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md](./56-technique-pieces-illustrations-and-date-range-cache.md)).

## 1. Start (facts checked 2026-11-06 against `develop` c57a12b)

- **The catalogue** (`src/techniques/catalog.ts`, 66 rows, all built) says, per technique, what it reads
  (`contract.inputs`: a digest section, a free-text filter and a named layout from `src/techniques/layouts.ts`), its
  system prompt (`contract.system`, `none` for code), its user-turn fields, its output schema, its synthesizer and the
  agents that run it. It is seeded into `technique_registry` at boot; the Admin Panel's Techniques page reads it.
- **The agent registry** (`src/agents/registry.ts`, 30 agents) lists every agent with its kind (model, code, engine pull).
- **What is not named anywhere:** the *parts* that techniques share. The same `house` section in the `house_card` layout
  is read by General Reading analysts, the You, Love and Work boards, the life dashboard and the digest, but nothing
  counts that, draws it, or tests it once for all of them. Eight Self techniques, eight Love techniques and the lucky
  scenarios of each area are the same recipe with a different filter, and nothing groups them.
- **What is re-made needlessly:** board and reader outputs are recomputed on every open. Their inputs change on very
  different clocks: the natal digest never changes for a digest version; a dasha period holds for months; the year chart
  for a year; the panchang for a day; the transit overlay moves within hours. There is no record of "this technique's
  output for this kundli is valid from A to B", so nothing can be skipped. The only stored outputs today are
  `area_builds` (per board) and the Gemini prompt cache (`llm_cache_entries`, a prefix cache, not an output store).
- **Symptom for the person:** boards and readings wait on work whose answer has not changed since the last visit; for
  the team, a fix to one shared part has to be found and checked in every technique that copied it.

## 2. End goal

- Every technique is described as a **recipe of standard pieces** (reader, prompt, output, agent), and techniques with
  the same recipe are one **family**. The pieces and families are derived from the catalogue in code, so they cannot
  drift from what runs.
- Staff see the whole machinery **illustrated on one page**, in the docs (Markdown + Mermaid) and in the Admin Panel
  (**Machinery**): every agent, every piece, which techniques of General Reading and the Self, Love and Work boards use
  it, and how long each output stays valid.
- Each technique has a **freshness** and a **scope** from its contract, and a **validity window** and a **cache key**
  that is stable for that window. Phase 2 stores outputs under that key, so a second open inside the window reads the
  stored output and the agent does not run.

## 3. Deliverable

Phase 1 (this branch):
- `src/techniques/pieces.ts`: `pieces`, `families`, `recipes`, `reuseReport`, `techniqueFreshness`, `techniqueScope`,
  `validityWindow`, `windowCovers`, `contractHash`, `techniqueCacheKey`.
- `src/config/env.ts`: `TECHNIQUE_TRANSIT_WINDOW_HOURS` (2), `TECHNIQUE_DASHA_FALLBACK_DAYS` (30),
  `TECHNIQUE_ANNUAL_FALLBACK_DAYS` (90), `TECHNIQUE_CACHE_VERSION` ("1").
- `src/techniques/piecesDoc.ts` + `scripts/write-technique-pieces-doc.ts` (with `--check`) writing
  `docs/admin/07-technique-pieces-and-agents.md`.
- `tests/unit/techniques/pieces.test.ts`, `tests/unit/techniques/piecesDoc.test.ts`.
- Admin (`aiadastra_admin`): `GET /machinery` (`api/src/admin/machinery.ts`, derived from `technique_registry` and
  `agent_registry`) and the **Machinery** page (`web/src/pages/Machinery.tsx`).

Phase 2 (this branch):
- `prisma/schema.prisma` (`TechniqueOutput` / `technique_outputs`) + migration `prisma/migrations/20261106090000_technique_outputs_m37/migration.sql`.
- `src/techniques/outputStore.ts`: `withTechniqueOutput`, `deleteKundliTechniqueOutputs` (wired on digest rebuild in `src/reading/digest/build.ts`), and `sweepTechniqueOutputs` (wired in `scripts/cache-sweep.ts`).
- Read-through wired in `src/reading/area/boardService.ts`, `src/reading/area/careerService.ts`, and `src/reading/codeReaders/readers.ts` (`runCodeReadersCached`).
- `tests/unit/techniques/outputStore.test.ts`.
- One-per-page visual manual (`docs/techniques/README.md`, `01`..`06`).

## 4. Exactly how it works when done

### 4.1 Backend

**Pieces (Phase 1).** For each catalogue row: one reader piece per input (`reader:<section>/<layout>`; the filter is a
variant of the piece), one prompt piece unless `system` is `none`, one output piece, one agent piece per agent.
Family signature = sorted reader pieces + prompt + output + sorted agents.

**Freshness (Phase 1).** The shortest-lived section read, in the order natal > annual > dasha > daily > transit >
question: `house`, `planet`, `yoga`, `point`, `star` are natal; `annual` annual; `activation` dasha; `panchang` daily;
`transit` transit; `prashna` question. A `findings` input takes the shortest freshness of the techniques that name this
one as synthesizer (question when none; a cycle resolves to question). `text` does not shorten freshness.
**Scope:** per question when the user turn has QUESTION, REAL_WANT, HISTORY, CLARIFY_TURNS, ANSWER, SLOTS, BUCKET or
TEMPLATE, or an input is `text` or `prashna`; else the same for every question.

**Validity window (Phase 1).**

| Freshness | Window | Fallback |
|---|---|---|
| natal | open (`to = null`); the digest version and the contract hash are in the key | — |
| annual | the running year chart span passed by the caller | epoch-aligned `TECHNIQUE_ANNUAL_FALLBACK_DAYS` bucket |
| dasha | the shortest running period span the technique reads (`kundli_activation.from_date/to_date`) | epoch-aligned `TECHNIQUE_DASHA_FALLBACK_DAYS` bucket |
| daily | the local day at the place | the UTC day |
| transit | epoch-aligned `TECHNIQUE_TRANSIT_WINDOW_HOURS` bucket (12:00–14:00, 14:00–16:00 …) | — |
| question | empty window: never reused | — |

A passed span is used only when it is valid and holds `now`; otherwise the fallback bucket. Windows are half-open
`[from, to)`.

**Cache key (Phase 1).** `sha256("technique-output" | TECHNIQUE_CACHE_VERSION | technique id | contract hash (contract +
algorithm, 16 hex) | kundli id | digest version | freshness | from | to or "open" | question hash or "")`. Null (do not
store) when freshness is question, the window is empty, the kundli id or digest version is missing, or the scope is per
question and no question hash is given. The question text is never in the key, only its hash.

**Output store (Phase 2).** Table `technique_outputs` (migration written, applied only with Sachin's OK):
`cache_key text primary key, technique_id, kundli_id (fk, cascade), digest_version, freshness, valid_from timestamptz,
valid_to timestamptz null, output jsonb, output_schema, made_by_agent, made_ms int, created_at, hit_count int,
last_hit_at`; index `(kundli_id, technique_id)`, index `(valid_to)`. Read-through helper
`withTechniqueOutput(technique, ctx, make)`: compute the window and key; on a row whose window covers now, return its
output, bump `hit_count` (fire-and-forget) and write an `agent_runs` row with `status = 'cached'` and `ms` of the read;
otherwise run `make()`, then insert (`ON CONFLICT (cache_key) DO NOTHING`, so two concurrent makers both succeed and one
row wins). A failed read or write never fails the request: it logs once and runs `make()`. Digest rebuild deletes the
kundli's rows (`digest_version` changes anyway). Sweep (`cache:sweep`, daily): delete rows with `valid_to < now() - 1
day`, at most 5,000 per run.

First users of the store: the You and Love board builders and the Work career map (kundli scope; natal/dasha/transit),
the four code readers of General Reading (natal, kundli scope), and the lucky day overlay (daily). The LLM analysts are
per question; they are stored only for the same question hash (a re-ask, a retry), which the key already supports.

### 4.2 API

- Server: no new endpoint in Phase 1. Phase 2 adds nothing public; board responses gain `cached: boolean` and
  `validUntil` (ISO or null) per board for the client to show "updated …".
- Admin: `GET /machinery` → `200 { techniques: number, areas: [{ area, label, techniques, families: [...] }],
  pieces: [...], families: [...], agents: [...], report: {...} }`; `401` without a session; `500` with the standard
  error body when the registry cannot be read. Reads only; no question text or birth data.

### 4.3 Frontend experience (Admin Panel)

**Machinery** in the main nav. While loading: a spinner with "Loading the machinery…". On failure: the error and a
Retry button. When loaded: the counts line; one panel per area (General Reading, Self, Love, Work) drawn as four
columns — Reader pieces → Techniques (one card per family, members listed) → Agents → Feeds (synthesizer) — each card
showing its freshness badge; below, the pieces table (kind, piece, freshness, used by N of M, areas, filters) and the
validity table. A filter (All / reader / prompt / output / agent) narrows the pieces table.

### 4.4 UI/UX words

Freshness badges: "Natal (until the chart is re-digested)", "Year chart", "Dasha period", "Day", "Transit window",
"Each question". Scope: "Same for every question" / "Per question".

## 5. Architecture

```
catalog.ts ──► pieces.ts (pure) ──► piecesDoc.ts ──► docs/admin/07 (Mermaid)
     │                │
     │                └─► Phase 2: withTechniqueOutput ──► technique_outputs ◄── cache:sweep
     ▼
technique_registry ──► admin api /machinery (same derivation, pure, tested) ──► Machinery page
```

The admin repo cannot import server code, so `/machinery` re-derives pieces from `technique_registry` rows with the
same rules; both repos test the rules on the same examples (house_card shared across areas, lucky scenarios one family,
findings freshness from upstream). A rule change is made in both, and noted in docs/TODOS.md until a shared package exists.

## 6. Ingredients

No new library. Env vars as §3 (agent adds defaults; deploy session sets them only if tuning is wanted). Phase 2: one
migration (agent writes; Sachin approves applying), no IAM or EventBridge change (the existing sweep job runs it).

## 7. Action steps

1. `pieces.ts` + env helpers + tests (done).
2. `piecesDoc.ts`, generator script, generated doc 07, doc test that the checked-in file is current (done).
3. Admin `/machinery` + Machinery page + tests (done, admin branch; parallel with 1–2).
4. Phase 2: migration `technique_outputs`; `src/techniques/outputStore.ts` `withTechniqueOutput`; tests with a fake
   Prisma (hit, miss, expired, concurrent insert, store failure falls through).
5. Wire the You/Love builders, the career map and the code readers through `withTechniqueOutput`, passing the running
   period and year spans from `kundli_activation` and the digest's annual rows.
6. Admin: show cached runs and hit rate per technique on the Techniques page.

Steps 4 and 6 can run in parallel; 5 needs 4.

## 8. Development phases

- **Phase 1 — named and drawn (shipped on these branches).** Check: `npx vitest run tests/unit/techniques`, `npx tsc
  --noEmit`, `npx tsx scripts/write-technique-pieces-doc.ts --check`; admin `npm test` in api and web.
- **Phase 2 — stored and skipped.** Check: a board opened twice inside a window writes one `agent_runs` row with
  `status = 'built'` and one with `status = 'cached'`; p50 of the second open under 150 ms.
- **Phase 3 — standard filters.** Replace free-text filters with a typed filter (houses, vargas, planets, span) so two
  techniques with the same filter share one rendered table; the "Where to standardise next" list in doc 07 is the
  worklist.

## 9. Recommendation

Derive the pieces from the catalogue rather than declaring them by hand: the catalogue is already the contract that
runs, so a derived list cannot drift. Store outputs per technique with a window from the freshness of its inputs, not a
flat TTL: natal outputs then live until the digest changes and only transit-bound outputs are re-made every couple of
hours.

| Alternative | Verdict |
|---|---|
| Hand-written pieces registry | Drifts from the catalogue; twice the upkeep. No. |
| One flat TTL for every output (e.g. 2 h) | Re-makes natal outputs 12 times a day for nothing. No. |
| Cache the rendered prompt only (today's prefix cache) | Saves tokens, not the agent run or its latency. Keep it, but it is not this. |
| Mermaid as a web dependency in the admin | Heavy for one page; the page draws the same graph with plain cards. No. |
