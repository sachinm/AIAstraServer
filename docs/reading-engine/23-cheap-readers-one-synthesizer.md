# 23 — Cheap readers, one strong synthesizer: cost model, model-agnostic rules, gap plan, orchestration patterns

Status: **design + handoff**, written 2026-10-25. Docs and plan only; no `src/` change.
Related: [05](05-cost-latency-caching.md) (models, cost, caching), [11](11-analysis-methods.md) (layers, convergence), [12](12-performance.md)
(latency budgets), [19](19-dag-convergence-and-caching.md) (DAG as built), [20](20-radha-data-provider.md) /
[21](21-radha-plan-review.md) / [22](22-radha-build-plan.md) (`kundli_data`, `ensureChartData`, Radha build),
[07](07-evaluation.md) (evals). Code read: `src/reading/{graph,run,config}.ts`, `nodes/{specialists,reconcile,findingsCache}.ts`,
`llm/{gemini,bedrock,models,promptCache}.ts`, `packs/selector.ts`, `chartData/{store,tool}.ts`, `evals/questions.ts`.

**Assumption.** Sachin's brief was cut off at "the amount of data that needs to be processed per". I read it as **per question**
(one user, one primary subject, one answer). Per-user and per-day figures are the per-question figure times a stated
question count. All token counts are **estimates** anchored on doc 12's measured prompt sizes (7.1k single / 19.5k graph p50);
real counts come from the P0 measurement task.

## 0. Answer first

1. **The DAG already is "cheap readers + one synthesizer".** Specialists run on `gemini-3.8-flash`, the synthesizer on `gemini-4-argon`.
   What is missing is not the shape but (a) readers that read the **`kundli_data` store** instead of a Node-built pack, (b) a findings
   contract that carries **verified quoted facts** so the synthesizer never needs the tables, (c) a **provider-neutral model layer**
   (everything is Gemini-only today), and (d) caching that actually engages (today's 3k-token prefix is **below the 4,096-token
   minimum** on 3.x models, and parallel readers cannot hit a cache nobody has written yet).
2. **Per question today (graph flow, 3 readers + synth): ≈ $0.061** (est.). After Argon's repricing on 2026-12-01 and Flash's on 2027-01-01
   the same graph costs **≈ $0.123**.
3. **Target with Haiku 5.5 readers + Sonnet 5.5 synth: ≈ $0.036 cold, $0.030 on a follow-up within 30 minutes** (est.), i.e. ~40–50 % under
   today and **~75 % under today's post-repricing cost**. The synthesizer is 85–90 % of that number: **output tokens of the strong model
   are the cost**, readers are noise (< $0.01 on any cheap tier). So the lever is synth output + thinking tokens and the synth price per
   token, not squeezing readers.
4. **Fable 5.1 as the synthesizer costs ≈ $0.14–0.17 per question** (est.), 4–5× Sonnet/Argon. Use only as an A/B ceiling or a
   premium tier. Opus 5.5 lands at ≈ $0.06–0.08.
5. **Cheap readers buy speed and quality control, more than money.** Against "one strong model reads everything"
   (≈ $0.034 Sonnet, ≈ $0.17 Fable warm) readers save little at Sonnet price and a lot at Opus/Fable price; at every price they cut
   synth input and TTFT and give deterministic grounding.
6. Recommended defaults to prove in evals (P5): **readers = Haiku 5.5** (fallback Gemini 3.1 Flash-Lite, gpt-oss-120b on Bedrock),
   **synth = Sonnet 5.5** with Argon and Opus 5.5 as the A/B arms. All env-driven; nothing hard-coded.

## 1. Cost model

### 1.1 Prices (USD per 1M tokens) and sources

| Model | Input | Output (incl. thinking) | Cache read | Cache write / storage | Source (read 2026-10-25) |
|---|---|---|---|---|---|
| Claude Fable 5.1 | 10 | 50 | 0.25 | write 5m 12.50, 1h 20 | platform.claude.com/docs/en/about-claude/pricing |
| Claude Opus 5.5 | 4 | 20 | 0.20 | 5m 5, 1h 8 | same |
| Claude Sonnet 5.5 | 2 | 10 | 0.10 | 5m 2.50, 1h 4 | same |
| Claude Haiku 5.5 (prompts ≤ 100k) | 0.10 | 0.50 | 0.01 | 5m 0.125, 1h 0.20 | same (over 100k: 0.50 / 2.50) |
| Gemini 4 Argon | 2.00 → **4.00 on 2026-12-01** | 10 → **20** | 0.10 → 0.20 (implicit only) | no explicit cache | ai.google.dev/gemini-api/docs/pricing |
| Gemini 3.8 Flash | 0.75 → **1.50 on 2027-01-01** | 3.75 → 7.50 | 0.075 → 0.15 | storage 0.50 → 1.00 /M/h | same |
| Gemini 3.5 Flash-Lite | 0.30 | 2.50 | 0.03 | storage 1.00 /M/h | same |
| Gemini 3.1 Flash-Lite | 0.25 | 1.50 | 0.025 | storage 1.00 /M/h | same |
| Gemini 2.5 Flash (today's live default) | 0.30 | 2.50 | 0.03 | storage 1.00 /M/h | same |
| gpt-oss-120b on Bedrock us-east-1 | 0.15 | 0.60 | none (open models have no prompt cache) | | third-party trackers (cloudprice.net, typingmind) — **verify on the AWS pricing page** |

Notes: Claude cache hits refresh the TTL; a Claude cache write costs 1.25× (5m) so it pays back on the first hit. Gemini explicit caches
charge the creation tokens once at input price plus storage per token-hour. Doc 05's matrix still lists the pre-repricing Gemini
numbers; `llm/models.ts` `PRICES` has no Claude entries (see §2).

### 1.2 Token assumptions per question (estimated)

| Call | Input | Of which stable prefix | Output (visible) | Thinking |
|---|---|---|---|---|
| Today, specialist ×3 (promise, dasha, transit; nakshatra +0.3 avg ignored) | 4.8k | 3.0k (persona+method+base chart) | 0.9k | 0.4k on 3.x (code maps `off` → `low`) |
| Today, synth (argon) | 5.0k | 2.5k | 1.6k | 1.0k |
| Target, reader ×3 | 7.2k (rules 1.2k + natal base 3.8k + question tables 2.2k) | 5.0k (≥ 4,096 so explicit caching is possible) | 0.7k | 0–0.4k by model |
| Target, synth | 4.5k (persona+synth+template 2.5k, brief ~2k) | 2.5k | 1.6k | 0.8–1.0k |
| Single call, 2.5-flash (today's default flow) | 7.1k | 2.5k | 1.6k | 0.8k |

Anchors: doc 12 measured 19.5k prompt tokens across the 4 graph calls (p50) and ~4.1k per subject pack. Target readers read slightly more
(raw tables from `kundli_data`: ashtakavarga, shadbala, extra vargas) — that is the cost of moving the data to the readers; it is cheap
because readers are cheap. Doc 05's older estimate (≈ $0.085) assumed bigger packs; the measured sizes give ≈ $0.061.

Script: `scratchpad/cost.mjs` (kept out of the repo; the P0 task puts a cleaned version in `scripts/reading-cost-model.ts`).

### 1.3 Results — USD per question

**(a) Today**

| Setup | No cache | Warm |
|---|---|---|
| A0 single call, gemini-2.5-flash (live default) | $0.0081 | $0.0075 (2.5k prefix cached) |
| A1 graph: 3× 3.8-flash + argon | **$0.0614** | $0.0614 (3k / 2.5k prefixes are under the 4,096-token minimum → nothing to hit) |
| A1b graph: 3× 3.5-flash-lite + argon | $0.0501 | $0.0501 |
| A1 after repricing (3.8-flash $0.75→1.50; argon $2→4) | **$0.1228** | |

So the graph flow is ~7.5× the single call; the reading quality has to pay for that (doc 05 §2 said ~3×; the measured single flow is cheaper than
assumed there).

**(b) Target: 3 cheap readers + one synthesizer.** Rows = reader model, columns = synthesizer. "Cold" = first question of a session
(cache written once, then 2 reader hits; Gemini storage for 30 min included). "Warm" = follow-up inside the 30-minute TTL (all calls hit).

No cache:

| Reader \ Synth | readers only | Argon | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|---|
| Haiku 5.5 | 0.0032 | 0.0382 | 0.0362 | 0.0692 | 0.1682 |
| Gemini 3.1 Flash-Lite | 0.0103 | 0.0454 | 0.0433 | 0.0764 | 0.1754 |
| Gemini 3.5 Flash-Lite | 0.0147 | 0.0497 | 0.0477 | 0.0807 | 0.1797 |
| gpt-oss-120b (Bedrock) | 0.0050 | 0.0400 | 0.0380 | 0.0710 | 0.1700 |
| Gemini 3.8 Flash | 0.0286 | 0.0636 | 0.0616 | 0.0946 | 0.1936 |

Cold, cache engaged:

| Reader \ Synth | readers only | Argon | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|---|
| Haiku 5.5 | 0.0024 | 0.0327 | 0.0307 | 0.0589 | 0.1431 |
| Gemini 3.1 Flash-Lite | 0.0106 | 0.0408 | 0.0389 | 0.0671 | 0.1512 |
| Gemini 3.5 Flash-Lite | 0.0145 | 0.0448 | 0.0428 | 0.0710 | 0.1552 |
| gpt-oss-120b | 0.0050 | 0.0353 | 0.0333 | 0.0615 | 0.1457 |
| Gemini 3.8 Flash | 0.0231 | 0.0533 | 0.0513 | 0.0796 | 0.1637 |

Warm (follow-up within 30 min):

| Reader \ Synth | readers only | Argon | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|---|
| Haiku 5.5 | 0.0019 | 0.0321 | **0.0301** | 0.0584 | 0.1425 |
| Gemini 3.1 Flash-Lite | 0.0070 | 0.0372 | 0.0352 | 0.0635 | 0.1476 |
| Gemini 3.5 Flash-Lite | 0.0107 | 0.0409 | 0.0389 | 0.0672 | 0.1513 |
| gpt-oss-120b | 0.0050 | 0.0353 | 0.0333 | 0.0615 | 0.1457 |
| Gemini 3.8 Flash | 0.0185 | 0.0487 | 0.0467 | 0.0750 | 0.1591 |

Synthesizer alone (warm): Argon $0.030, Sonnet $0.028, Opus $0.057, Fable $0.141. After Argon's repricing: $0.070 (no cache) / $0.061 (warm).

**(c) Control: one strong model reads everything (no readers), 13.5k in, 1.6k out + thinking**

| Synth | No cache | Warm |
|---|---|---|
| Argon | 0.053 | 0.036 |
| Sonnet 5.5 | 0.051 | 0.034 |
| Opus 5.5 | 0.102 | 0.069 |
| Fable 5.1 | 0.255 | 0.169 |

**Reading the tables**

- Readers on Haiku or gpt-oss cost **under half a cent** for all three. Reader model choice moves the total by ≤ $0.026; synth choice moves it by up to $0.14.
- Cache is worth ~$0.005–0.008 per question here because the prefix is small; it matters more for latency (TTFT) and for Fable/Opus synth (cache read
  $0.20–0.25 vs $4–10 input).
- Strong-only vs readers: at Sonnet/Argon price the readers save ~$0.00–0.02 (not the reason to have them); at Opus they save $0.03; at Fable $0.025
  warm (readers add 0.0019 but shrink synth input from 13.5k to 4.5k). The synth-input shrink matters more at higher synth price.
- **Sensitivity:** every 1k synth output/thinking tokens = $0.010 Sonnet/Argon (today) · $0.020 Opus / Argon-after-Dec-1 · $0.050 Fable. Synth thinking
  should default to low/none for T-templates whose facts are already in the brief.
- **Volume:** at 1,000 questions/day: today ≈ $61/day ($1.8k/mo), $123/day after repricing; Haiku+Sonnet warm-mix ≈ $30–36/day ($0.9–1.1k/mo);
  Haiku+Opus ≈ $58–69/day; Haiku+Fable ≈ $143–168/day.
- **The Argon repricing (2026-12-01) removes Argon's price advantage**: at $4/$20 it costs 2× Sonnet 5.5 and equals Opus 5.5. Decide the synth
  by quality per dollar in the eval, not by habit.
- **Not modelled:** intake (rules-first, ~0), clarify (gpt-oss on Bedrock, < $0.001), nakshatra reader (+~$0.001 on Haiku), multi-subject (+3 readers per
  extra subject, +~$0.003–0.01), retries (required readers retry once), explicit cache storage beyond 30 min, Lambda/Radha compute.

## 2. Model-agnostic ruleset: what is model-specific today and what must change

Principle: **the ruleset is three things — prompts, schemas, and a capability table — and nothing else knows which vendor is behind a role.**

| # | Today (file) | Model-specific because | Change |
|---|---|---|---|
| M1 | `llm/gemini.ts` is the only specialist/synth transport; `bedrock.ts` serves only the clarifier | Role env vars (`READING_MODEL_*`) hold bare Gemini ids | A `ModelAdapter` interface with `gemini`, `anthropic` and `bedrock` implementations; ids become `provider:model` (`anthropic:claude-haiku-5-5`, `bedrock:openai.gpt-oss-120b-1:0`, `gemini:gemini-3.8-flash`); a bare id keeps meaning Gemini for back-compat |
| M2 | `FINDING_RESPONSE_SCHEMA` in `specialists.ts` uses Gemini's uppercase OpenAPI types (`'OBJECT'`, `'STRING'`) and `responseMimeType` | Gemini structured output | Keep one neutral JSON Schema (zod → JSON Schema) as the source; each adapter translates it (Gemini responseSchema, Anthropic tool-use / structured output, Converse `toolConfig`, or prompt-only + `extractJsonObject` for models without schema support). The zod parse stays the one validator, plus one repair retry |
| M3 | `thinkingConfigFor`: `thinking: 'off'` becomes `thinkingLevel: 'low'` on 3.x; budgets on 2.x | Gemini cannot fully disable thinking on 3.x, so "off" costs ~0.4k tokens/reader | Neutral levels `none | low | medium | high` with the adapter reporting the **effective** level; capability table says which models can do `none`; Anthropic maps to its thinking settings, Haiku/gpt-oss to none/reasoning_effort (bedrock.ts already does the gpt-oss case) |
| M4 | `promptCache.ts` + `cachePrefix`: Gemini `cachedContents` only; `cacheNameFor(model, system, parts[0])`; min 4,096 tokens on 3.x/Argon; Argon has no explicit cache | Caching APIs differ completely | `PromptCache` interface: Gemini adapter keeps `cachedContents`; Anthropic adapter places `cache_control` breakpoints (5m or 1h) after system and after base chart; Bedrock Claude uses `cachePoint`; open models: no-op. Capability table carries `minCacheTokens` and the layout builder pads/extends the cacheable prefix to clear it (see G6) |
| M5 | `llm/models.ts`: `PRICES` has Gemini ids only; unknown model costs 0 | Cost per run would read $0 on any Claude/Bedrock model | Price table v2: per model in / out / cacheRead / cacheWrite / storage-per-hour, effective-from dates (the 2026-12-01 and 2027-01-01 repricings), `PRICE_TABLE_VERSION`; unknown model = loud flag in `reading_runs.usage`, never silent 0 |
| M6 | `Usage` maps `promptTokenCount`, `cachedContentTokenCount`, `thoughtsTokenCount` | Gemini field names; Claude reports input / cache_creation / cache_read separately and counts thinking inside output; Bedrock reports `cacheReadInputTokens` | Adapters normalise to `{promptTokens, cachedTokens, cacheWriteTokens, outputTokens, thoughtTokens}` |
| M7 | `findingsCache` key = dossier hash + analyst + subject (+ period) + prompt version | Key ignores the model, so switching the reader model serves another model's findings | Add `readerModel` family + `findingsSchemaVersion` to the key; eval runs bypass the cache |
| M8 | Error/refusal handling reads `promptFeedback.blockReason` and `finishReason`; `detectLoop` aborts a stream on repetition (a Gemini-era guard) | Vendor-specific stop reasons | Adapter returns a normalised `stopReason: end | length | refusal | loop | error`; keep the loop guard as adapter-independent |
| M9 | Prompts (`method.md`, `persona.md`, `synth.md`, templates `T1–T10`) are plain markdown with evidence-id rules | Mostly neutral. Risks: instructions that rely on Gemini habits (e.g. JSON-only replies without fences, `claims ≤ 8` enforced only in prose) | Prompt conformance rules (below); no vendor words, no fence/format tricks, schema stated once in text and enforced by the adapter |
| M10 | Token budgets (`maxOutputTokens 1800`, 12 s specialist timeout) set from Gemini speeds | Tokenizers and speeds differ per model | Capability table gets `tokensPerSecond` (measured) and `tokenizerFactor` (measured with each vendor's token-count endpoint); timeouts derive from it, not constants |

**Prompt conformance rules (what every model must accept):** (1) all instructions in `system` + one user turn; no assistant prefill; (2) the schema
is described in one short block and enforced by the adapter, the prompt never says "reply only with JSON in a code fence"; (3) evidence ids are
copied verbatim from the table headers the reader was given — the reader gets `id = value` rows, not nested JSON paths it must assemble;
(4) readers never write prose for the user, the synth never sees raw tables; (5) one example finding in the prompt, not three; (6) numbers
and dates only from the tables (existing rule, kept); (7) no instruction depends on the model "thinking first" — if a step needs reasoning it is a
`thinking` level in the capability table.

**Conformance suite** (a model may serve a role only after it passes it; script in P5): for readers — schema-valid ≥ 99 % over the 12 golden
questions × 3 runs; grounded claims ≥ 98 % (every evidence id resolves and every quoted value matches the table); `layerScore` within ±1 of the
reference run (Opus 5.5 reader on the same tables) on ≥ 90 % of layers; p95 latency inside the §3.6 budget. For synthesizers — the existing
`proseMustMention` / `forbid` / `requireCaveat` checks plus the answer-first and word-cap rules of `templates/_rules.md`, ≥ 11 of 12 goldens green, no new
`forbid` hit.

## 3. Target design

```
intent (rules)                        clarify (user-paced)
   │                                       │  ◄── speculative: ensureChartData(prefetch plan), natal readers pre-run (P5 of §5)
   ▼
FETCH PLAN (deterministic: bucket/subject/horizon → type ids)            no model
   ▼
ensureChartData(kundliId, plan)  ──►  FactStore (ids → values, from kundli_data)        0–400 ms warm, Radha only on a miss
   ▼
 ┌─ reader:promise   (cheap)  tables: base + varga + strength + yogas + arudhas ─┐
 ├─ reader:dasha     (cheap)  tables: dasha tree slice + period lords' placement ├─► findings.v2  (JSON, schema-checked)
 ├─ reader:transit   (cheap)  tables: overlay + ingress dates + SAV/BAV           │
 └─ reader:nakshatra (cheap, optional, never holds the join)                    ─┘
   ▼
RECONCILE (no model): grounding gate (ids + quoted values vs FactStore) · windows · deciders · convergence · fortune · now/next · SynthBrief v2
   ▼
SYNTH (ONE strong model, streamed): persona + template + brief (≈2k) — never sees raw tables
```

### 3.1 The fetch plan (replaces "Node builds a pack")

A pure function `fetchPlan(intent, bucket) → {reader: typeIds[]}` driven by a table (same table as doc 10's subject × prompt matrix: for each
subject its houses, karakas, vargas, dashas, ashtakavarga, strengths). It returns type ids from the doc 20 catalog (`varga.d10`,
`dasha.vimsottari`, `ashtakavarga`, `strength.shadbala`, `arudhas`, `yogas`, `transit.overlay@year`). `ensureChartData` fills `FactStore`; items
not yet fetched (`missing`) either block briefly (≤ 1.5 s budget for first-tier types) or are reported to the reader as `gaps`. The existing
`getChartDataTool` stays for the agentic fallback (P6 below) and for the timeline builder; the main path does **not** let a model pick the tables —
the runtime cannot decide ad hoc, so the plan is a reviewed table, tested by the golden questions' `packMustHave` lists.

### 3.2 What a reader gets and returns

**Input** (cache-ordered, stable first): `system` = reader rules (≈1.2k tokens, identical for every user and every reader layer) → **natal base**
(the user's `panchanga.birth`, D1 houses/lords, arudhas, karakas; identical across a user's questions and across the three readers) → layer tables
(slice-specific) → tail (today's date, subject, horizon, focus, the question). Tables are rendered as flat `id = value` rows (compact, copyable, no nesting).

**Output: `findings.v2`** (neutral JSON Schema, zod-validated, one repair retry, `status: ok | failed`):

```json
{
  "schema": "findings.v2",
  "layer": "promise | dasha | transit | nakshatra",
  "subject": "career_work",
  "verdict": "strong | moderate | weak | denied | mixed",
  "layerScore": -3,
  "claims": [
    { "text": "one sentence about this chart", "evidence": ["varga.d10.house.10.lord"], "polarity": "supports | obstructs | neutral",
      "weight": 1, "tradition": "parashara | jaimini | nakshatra | tajaka | kuta | kp_starlord" }
  ],
  "quotes": [ { "id": "dasha.current.ad.lord", "value": "Ketu" } ],
  "windows": [ { "from": "2026-11-01", "to": "2027-01-31", "polarity": "favourable | testing | mixed", "label": "", "evidence": ["…"] } ],
  "gaps": [ { "need": "varga.d60", "why": "question names past-life themes" } ],
  "disagree": "one sentence when two rules in this layer point opposite ways, else empty"
}
```

Changes against today's `findingZ`: **`quotes`** (verbatim id/value pairs the synth may print; the gate checks `value` equals the FactStore value, so a
cheap model cannot smuggle in a wrong placement), **`gaps`** (an explicit "I needed X" instead of silent improvisation; drives a second hop
or a caveat), **`disagree`** (feeds the verifier pattern), claims ≤ 8, quotes ≤ 12, `keyFacts`/`caveats` free text removed (the brief builds caveats
from `gaps` and missing layers). Everything else (`layerScore`, `tradition`, windows) stays so `convergence.ts` and `reconcile.ts` keep working.

### 3.3 How the synthesizer consumes findings

`reconcile` stays deterministic and byte-stable. `SynthBrief v2` = today's block (TEMPLATE, VERDICT, LAYERS, DECIDERS, NOW, NEXT, FORTUNE, WINDOWS) +
**VERIFIED FACTS** (the `quotes` that passed the gate, grouped by layer) + **CLAIMS** (grounded ones only, one line each) + **GAPS/CAVEATS** (from missing layers,
`gaps`, `disagree`). Budget ≈ 2k tokens. The synth prompt rule: "write only from the brief; a fact that is not in VERIFIED FACTS is not stated; say so
in one line if the question needs it". If a template needs a fact the readers did not quote, that is a reader-prompt bug caught by the eval
(`proseMustMention` fails), not something the synth patches by asking for tables.

### 3.4 Convergence and verification

Unchanged math (doc 19 §3). Two additions: (1) **disagree trigger** — if `disagree` is non-empty on a required layer, or two layers' scores differ by ≥ 4 on
the same subject, run the verifier pattern (P4, §6) before reconcile; (2) **second hop** — a required reader that returns `gaps` for a
catalog type triggers one `ensureChartData` + one re-run of that reader only (budget: 4 s; once; otherwise caveat).

### 3.5 Caching design (provider-neutral)

- **Layout.** Cacheable prefix per user = reader rules + natal base **padded to ≥ the model's `minCacheTokens`** (Gemini 3.x/Argon 4,096; Claude per model
  from the capability table). Today's 3k-token prefix is under the Gemini minimum, so explicit caching can never trigger on it. The natal base is
  ~3.8k tokens in the target; adding the user's top-tier natal tables (shadbala, SAV) lifts it over 4,096 and makes the prefix **identical for all
  readers and all questions** of that user.
- **Warm before fan-out.** Parallel readers launched together cannot hit an implicit cache that the first of them is still writing. On the first question of a
  session: one cache-create call (Gemini `cachedContents`, or one Anthropic request with `cache_control` that the other readers wait for ≈ 0.4–0.8 s,
  or a 1-token warm-up) before launching the others. Subsequent questions inside the TTL skip it. Cost of the warm-up is already in the "cold" table.
- **TTL.** Gemini 30 min sliding (doc 20 §8; registry/sweeper from R-7). Anthropic: 5 min default, extend with the 1-hour write (2× input) only when the session
  is active (≥ 2 questions inside 5 min); a hit refreshes the TTL for free. Open models: none.
- **Synth.** Prefix = persona + synth rules + template (2.5k, identical for everyone). Argon: implicit only (and 2.5k < 4,096: no hit). Claude: `cache_control`
  after the template; Sonnet/Opus/Fable cache-read is 5 % / 5 % / 2.5 % of input, so the shared prefix pays for itself within one request every 5 min globally
  (not per user), which is the highest-hit-rate cache in the system.
- **Findings cache** (doc 19) keeps skipping whole reader calls; key gets model family and schema version (M7).
- **Measure**: `reading_runs.usage` records cached/written tokens per node and per provider; eval reports hit rate and the cache share of cost.

### 3.6 Latency budgets (doc 12 targets: first token < 10 s full reading, complete < 40 s; fast lane 4 s / 15 s)

Estimates (not measured live; doc 12 §5 lists the live bench still owed):

| Stage | Budget | Basis |
|---|---|---|
| Rules intent | < 1 ms (measured, doc 12) | |
| FetchPlan + `ensureChartData` warm | ≤ 400 ms; first-tier miss ≤ 1.5 s | doc 12 §3: warm data load 0–1 ms, cold 1.4 s from a laptop |
| Cache warm-up (first question only) | ≤ 0.8 s | one extra call |
| Readers (parallel, wall = slowest required) | 4–7 s | 7.2k in, ~0.7k out; doc 05 §3 flash speeds 150–250 tok/s + TTFT 1–2 s; Haiku-class expected faster (**measure**) |
| Reconcile | < 50 ms | doc 12 |
| Synth TTFT | 2–3 s with brief ~4.5k in and thinking low | doc 05 says 2–5 s with high thinking |
| **First answer token** | **≈ 7–11 s** | tight against the 10 s budget → levers: reader `maxOutput 600`, `quotes ≤ 8`, speculative prefetch (P5), early-synth rule |
| Complete | 20–35 s | 1.6k visible tokens at 80–120 tok/s ≈ 14–20 s after TTFT |

**Early-synth rule:** synth starts when all *required* layers are done; optional nakshatra never holds the join (as built). **Per-reader timeout** derives
from the capability table (`tokensPerSecond`), default 9 s, retry once for required readers only when the first attempt failed before 4 s.

## 4. Gap analysis: current code vs. target

| # | Target | Current code | Gap | Size | Depends on |
|---|---|---|---|---|---|
| G1 | Readers read tables from `kundli_data` via fetch plan | `packs/selector.ts` builds an `EvidencePack` from the Node dossier/transit chart; `graph.ts` passes `deps.packs`; `getChartData` tool exists (`chartData/tool.ts`) but nothing in the reading flow calls it | FetchPlan table + FactStore loader + table renderer; selector stays as fallback while `kundli_data` rows are `legacy` | L | R-3/R-4a merged, M7 applied (doc 22) |
| G2 | `findings.v2` with `quotes`, `gaps`, `disagree` | `findingZ` has claims/windows/caveats/keyFacts | New schema + zod + prompt text; reconcile reads both v1 and v2 behind `READING_FINDINGS=v2` | M | none |
| G3 | Grounding resolves ids **and values** against FactStore | `reconcile.resolveEvidence` resolves ids inside a pack; values not checked | Generalise to a `FactStore` interface (`has(id)`, `get(id)`); add value-equality check for quotes; drop-rate metric | M | G1 (interface first, can use pack-backed store) |
| G4 | Provider-neutral `ModelAdapter` + capability table | Gemini REST wrapper for readers/synth; Bedrock JSON helper for clarify | Adapters (gemini, anthropic, bedrock), normalised usage/stop reason/thinking, schema translation, `provider:model` ids, repair retry | L | none |
| G5 | Price table v2 with repricing dates and cache write/storage | `PRICES` Gemini-only, unknown = 0 | Table v2 + `usageCostUsd` handles write/storage; unknown flagged | S | none |
| G6 | Cache prefix ≥ min, warm before fan-out, provider-neutral | 3k prefix under the 4,096 floor; explicit cache Gemini-only and **off**; parallel fan-out cannot hit; Argon no explicit | Prefix builder with `minCacheTokens`; warm-up step in `graph.ts`; Anthropic/Bedrock cache points; hit-rate metrics. Registry/sweeper (R-7) reused unchanged for Gemini | M | G4; R-7 merged |
| G7 | Synth consumes brief v2 only | Brief v1 (TEMPLATE…KEY FACTS); synth sees brief + persona | Add VERIFIED FACTS / CLAIMS / GAPS blocks, byte-stable; synth rule line; template check | S | G2, G3 |
| G8 | Convergence with disagree/verify branch and one second hop | Convergence + deciders built; no verifier, no second hop | Add the two triggers (§3.4) as optional graph nodes | M | G2 |
| G9 | Speculative prefetch during clarify | `clarify/prewarm.ts` prewarms the promise reader on the same instance; findings cache does the rest (doc 19 §6 "not done") | Dispatch fetch plan + natal readers when intent is first known; cancel on change; cross-instance via findings cache table (optional) | M | G1 |
| G10 | Latency budgets enforced per node; timeouts from capability table | Constant 12 s specialist timeout; budgets only measured with a stub (doc 12 §2) | Live bench (`npm run bench:reading -- --live`), `tokensPerSecond` in capability table, p95 alarms from `reading_runs` | M | G4, a funded key |
| G11 | Eval matrix: reader × synth × cache on the 12 goldens | `evals/run.ts` + `questions.ts` check pack coverage and prose; stubbed model | Live mode with provider matrix, repeats, cost/latency/grounding columns, reference-run agreement, gates (§5) | M | G4, G5 |
| G12 | Reader prompts: rules/system tuned for flat `id = value` tables | `method.md`, `promise.md`, `dasha.md`, `transit.md`, `nakshatra.md` written for the nested pack | New reader prompt set (`prompts/readers/*.md`) + prompt version bump (invalidates findings cache) | M | G1 shape |

## 5. Plan: phases, owners, gates

Owners are session roles per `AGENTS.md`. Parallel pieces are independent and touch disjoint files.

| Phase | Work | Owner | Files (owns) | Gate to merge / proceed |
|---|---|---|---|---|
| **P0 Measure (1 d)** | Count real tokens for the current graph (specialist, synth, clarify) per golden question with each vendor's token-count API; log them; clean `scripts/reading-cost-model.ts` from §1; replace the estimates in §1.2 | dev-reading (parallel with P1, P2) | `scripts/reading-cost-model.ts`, `docs/reading-engine/23` §1 | Table updated with measured numbers; if measured prefix ≥ 4,096 on some path, G6 shrinks |
| **P1 Model layer (3–4 d)** | G4 + G5 + M1…M10: `ModelAdapter`, capability table `llm/capabilities.ts`, price table v2, Gemini adapter wrapping today's code unchanged in behaviour, Anthropic adapter (direct API) and Bedrock adapter (Claude + gpt-oss); no role switched | dev-llm (parallel) | `src/reading/llm/*` (not `promptCache.ts` yet) | `tsc` clean; unit tests with a fake transport per adapter; **byte-identical** requests for the Gemini path (golden-request snapshot); stub eval unchanged |
| **P2 Findings v2 (3 d)** | G2 + G3 + G7: schema, reader output parse, `FactStore` interface (pack-backed first), quotes gate, brief v2; flag `READING_FINDINGS=v2` | dev-reading (parallel) | `nodes/specialists.ts`, `nodes/reconcile.ts`, `grounding/checker.ts`, `prompts/synth.md`, `prompts/templates/*` | Unit tests; with the stub model 12/12 goldens still pass; dropped-claim counter works; v1 path unchanged when the flag is off |
| **P3 Data path (4–5 d)** | G1 + G12: FetchPlan table (reviewed by Sachin: subject → type ids), `ensureChartData` loader, reader prompts for flat tables; selector kept as fallback | dev-reading | `src/reading/chartData/plan.ts` (new), `packs/factStore.ts` (new), `prompts/readers/*` | Blocked until R-3 + R-4a merged and M7 applied. `packMustHave` of all 12 goldens resolve from `kundli_data`; warm load ≤ 400 ms; missing types produce `gaps`, not crashes |
| **P4 Caching (2–3 d)** | G6: prefix builder with `minCacheTokens`, warm-up before fan-out, Anthropic `cache_control`, Bedrock cache points, metrics; reuse R-7 registry for Gemini | dev-llm | `llm/promptCache.ts` + `graph.ts` warm step | Needs P1 + R-7 merged. Live: cached share of reader input ≥ 60 % on follow-ups, ≥ 90 % of synth prefix across users |
| **P5 Eval and choose (3 d, then ongoing)** | G10 + G11: live matrix runner. Arms: readers {Haiku 5.5, 3.1 Flash-Lite, gpt-oss-120b, 3.8 Flash (control)} × synth {Sonnet 5.5, Argon, Opus 5.5, Fable 5.1 (ceiling)} × cache {off, on}; 12 goldens × 3 runs. Output a results doc `24-…` and set defaults | eval session, then deploy session for env | `evals/*`, `scripts/` | **Gates:** reader conformance (§2); synth 11/12 goldens green; first token p95 ≤ 10 s, complete p95 ≤ 40 s; cost per question ≤ $0.05 warm (target arm: Haiku + Sonnet); no `forbid` regressions. Sachin's call only: which synth tier ships as default |
| **P6 Patterns (after P5)** | Router/one-specialist, speculative prefetch, verifier, map-reduce per §6, each behind its own flag, A/B on goldens | dev-reading | `graph.ts`, `clarify/prewarm.ts`, new nodes | Per-pattern gate in §6 |

Deploy steps (flags `READING_FINDINGS`, `READING_MODEL_READER`, `READING_MODEL_SYNTH`, any API key in `aiastra/chat-llm`; Anthropic key or Bedrock model access
for the Lambda role) go through the deploy session. No migration is needed by this doc; `reading_runs.usage` JSON gains fields.

## 6. Orchestration pattern hypotheses (test before choosing)

The runtime must not "decide ad hoc" with an LLM: the **router is rules** (bucket + subject count + horizon + question type, already in `buckets/classifier.ts` and
`isFastLane`), and each pattern is a fixed graph. Predictions use the §1 costs (Haiku readers + Sonnet synth, warm) and §3.6 latencies; **all are hypotheses, estimated**.

Golden question groups (`evals/questions.ts`): **TIMING** Q1, Q2, Q4, Q9, Q10 (when/this month, single or two subjects); **DECISION** Q7 (should I change jobs); **NATAL-INTERPRETIVE** Q6 (nakshatras), Q8 (D-10);
**EXPLAIN** Q5 (Ketu over Jupiter), Q11 (Sade Sati); **SPECULATIVE** Q3 (lottery), Q4 (million dollars); **MULTI-SUBJECT** Q1, Q12.

| ID | Pattern | Best for | Predicted cost | Predicted first token / complete | Predicted accuracy vs full-DAG baseline | How to test on goldens |
|---|---|---|---|---|---|---|
| **P0** | Fast lane: one call, strong or mid model, one subject pack, no readers (exists as `isFastLane`) | EXPLAIN (Q5, Q11), short DECISION | $0.012–0.03 (Sonnet 4.5k in) | 3–5 s / 9–15 s | Equal on EXPLAIN; worse on anything needing a verdict or windows | Run Q5, Q11, Q7 in P0 and P1; compare `proseMustMention` + a blind rubric score by a second model (Opus) on groundedness; keep P0 only where it ties |
| **P1** | Fan-out/fan-in readers → reconcile → synth (today's DAG, with target contracts) | TIMING single subject | $0.030 | 7–11 s / 20–35 s | Baseline | The whole eval matrix of P5 |
| **P2** | Router + **one** reader (promise only) + synth | NATAL-INTERPRETIVE (Q8 D-10, Q6 when nakshatra reader alone) | $0.017–0.022 | 5–8 s / 18–28 s | Equal on Q8 (no timing layers needed); fails if the user also asks "when" | Q8, Q6: P2 vs P1; check that dropped layers never appear in `proseMustMention`; add a guard test where the question gains a "when" and the router must pick P1 |
| **P3** | Two-stage map-reduce: per-subject P1 readers → per-subject cheap **digest** (≤ 400 tokens each) → one synth | MULTI-SUBJECT (Q1, Q12; 2–3 subjects) | $0.045–0.065 (3 subjects ×3 readers + 3 digests ≈ $0.011 + synth $0.030) | 9–13 s / 28–40 s | Better than one 12-reader fan-out: synth input stays ~3k instead of ~5–6k; digest loses detail → watch `proseMustMention` of the second subject | Q1, Q12: P3 vs P1-with-all-readers; compare synth input tokens, cost, and mention coverage |
| **P4** | Reader → **verifier**: second cheap model (different family) re-checks the top-k claims and `disagree` items against the tables; deterministic checker first, LLM only for semantic rules | high-stakes / contested layers (Q4, Q3 speculative; `disagree` set; layer score gap ≥ 4) | +$0.002–0.006 | +1.5–3 s | +accuracy on rule-application errors (hypothesis: −30 % wrong-claim rate); no gain on grounding errors, which the gate already catches | Seed 20 known-bad findings (wrong lord, wrong dasha lord) into reader outputs; measure catch rate of gate-only vs gate+verifier; run only if catch rate gain ≥ 10 points for ≤ +$0.006 |
| **P5** | Speculative prefetch: when the intent is known (or the clarify question is shown), run fetch plan + natal readers (promise, nakshatra) in the background; cancel on intent change | TIMING with a clarify wait; any follow-up in the same area | Wasted work ≈ 15–25 % of runs × $0.004 ≈ +$0.001 average | −3 to −6 s on first token when the user takes ≥ 5 s to confirm | Same as P1 (identical readers, only earlier) | Replay recorded clarify timings; measure hit rate (confirmed intent == speculated), time-to-first-token delta, cost of misses |
| **P6** | Tool-using reader: reader calls `getChartData` itself (≤ 2 rounds) | unknown/rare questions, bucket = other, `gaps` after the second hop | $0.008–0.02 (2 rounds, 1.5× tokens) | +1–2 s per round | Better on out-of-pattern questions; riskier grounding (reader chose the tables) | Add 6 off-pattern questions (past-life, D-60, a specific dasha such as Yogini) to the golden set; compare P6 vs P1+fallback on recall of the right tables |
| **P7** | Hedged readers: the critical layer (promise or dasha) runs on **two** cheap models; take the median / flag disagreement | DECISION (Q7), anything the verdict depends on | +$0.002–0.008 | +0–1 s (parallel) | Lower variance of `layerScore`; hypothesis: layer agreement rises from ~85 % to ~95 % | Run each reader 3× on the goldens, measure score variance for 1 vs 2 models |
| **P8** | Strong-only (no readers, full tables, cache) — control arm | baseline for "do we need readers at all" | $0.034 (Sonnet) – $0.17 (Fable) warm | 4–7 s / 18–30 s | May beat P1 on holistic questions; no deterministic grounding | Same goldens, same synth; compare accuracy, cost, grounding rate (with a post-hoc checker on prose) |

**Routing table to implement (rules, versioned, in code and in the doc):**

| Condition | Pattern |
|---|---|
| explain_term / yes_no, one subject, horizon ≤ 6m | P0 |
| natal question, no timing words, one subject (bucket says natal) | P2 |
| 1 subject, timing or decision | P1 (+P5 prefetch if a clarify happens, +P7 when decision) |
| 2–3 subjects | P3 |
| `disagree` or score gap ≥ 4 | add P4 |
| bucket other, or reader `gaps` after hop | P6 fallback |

Order of testing: P1 vs P8 (do readers pay off?) → P0/P2 (cheaper routes) → P5 (free latency) → P3 → P4/P7 → P6. Each pattern ships only if it beats its
control on the gate that matches its claim (cost for P0/P2, latency for P5, accuracy for P4/P7, both for P3) and does not fail any golden.

## 7. Code-change task list (for the implementer)

Numbered for the tracker; each is one PR-sized change off `develop`. *(files = files it owns)*

1. **T-23-01 Price table v2 + normalised Usage** — `llm/models.ts`: per-model in/out/cacheRead/cacheWrite/storage with `effectiveFrom`; `usageCostUsd` handles write tokens and storage hours; unknown model flagged (`costUnknown: true`) not zero; entries for the models in §1.1 and the 2026-12-01 / 2027-01-01 repricings. Tests: the figures in §1.3 reproduce to the cent.
2. **T-23-02 Capability table** — new `llm/capabilities.ts`: provider, id, max output, `minCacheTokens`, supported thinking levels (incl. whether `none` is possible), schema support, `tokensPerSecond`, `tokenizerFactor`, cache TTL options.
3. **T-23-03 `ModelAdapter` interface** — `llm/adapter.ts` (generate / stream, normalised usage + stop reason + thinking level reported back) and `llm/index.ts` resolver for `provider:model`; bare Gemini ids keep working.
4. **T-23-04 Gemini adapter** — wrap `callGemini` / `streamGemini` unchanged; golden-request snapshot test proves identical bodies.
5. **T-23-05 Anthropic adapter** — messages API, system blocks with `cache_control`, JSON via tool-use schema, usage mapping, stop-reason mapping, streaming.
6. **T-23-06 Bedrock adapter** — Converse for Claude (`cachePoint`) and open models (reuse `extractJsonObject`); generalise `callBedrockJson`.
7. **T-23-07 Neutral schema** — one JSON Schema generated from zod for `findings.v2` (and intake); per-adapter translation; one repair retry on invalid output.
8. **T-23-08 `findings.v2` + reader output parse** — `nodes/specialists.ts` (rename later), keep v1 parsing; flag `READING_FINDINGS`.
9. **T-23-09 `FactStore` and quotes gate** — `packs/factStore.ts`; reconcile and `grounding/checker.ts` resolve ids and quote values through it; metrics `droppedClaims`, `droppedQuotes`.
10. **T-23-10 Brief v2** — VERIFIED FACTS / CLAIMS / GAPS blocks in `renderBrief`, byte-stable test, `synth.md` rule line, template `_rules.md` update.
11. **T-23-11 FetchPlan** — `chartData/plan.ts`: the subject × reader → type ids table (from doc 10), unit tests tied to every golden's `packMustHave`.
12. **T-23-12 Table loader and renderer** — fetch via `ensureChartData`, render flat `id = value` rows per reader, token-budget trimmer (drop least relevant rows first, log what was trimmed).
13. **T-23-13 Reader prompts** — `prompts/readers/{promise,dasha,transit,nakshatra}.md` + shared `reader-rules.md`; bump `PROMPT_VERSION` (invalidates findings cache).
14. **T-23-14 Prefix builder + warm-up** — put the natal base into the cacheable prefix, pad to `minCacheTokens`, warm-up call in `graph.ts` on the first question of a session.
15. **T-23-15 Provider cache hooks** — `promptCache.ts` stays Gemini; add Anthropic / Bedrock cache-point helpers in the adapters; `READING_CACHE_PROVIDER_*` flags off by default.
16. **T-23-16 Findings cache key** — add `readerModel`, `findingsSchemaVersion`; eval bypass flag.
17. **T-23-17 Second hop and disagree trigger** — optional graph nodes behind `READING_VERIFY=1`.
18. **T-23-18 Router** — `nodes/route.ts`: the §6 routing table as a pure function with a test per row; patterns behind flags.
19. **T-23-19 Speculative prefetch** — `clarify/prewarm.ts`: fetch plan + natal readers when intent is first known; cancel/ignore on intent change; metric `specHit`.
20. **T-23-20 Live eval matrix** — `evals/run.ts --live --matrix`, repeats, reference-run agreement, columns: cost, first-token, complete, grounding, cached share; writes JSON to `docs/screenshots/<folder>/` per the repo's test rules; adds 6 off-pattern questions.
21. **T-23-21 Cost script and doc refresh** — `scripts/reading-cost-model.ts` from §1; replace §1 estimates with the measured numbers (P0).
22. **T-23-22 Ops** — CloudWatch metric filters for per-node p95 (reader, synth TTFT) and cost per question; admin `readingStats` gets provider and cache columns.

## 8. Risks and open points

- **Quality of Haiku-class readers on classical rule application** is unknown; the conformance suite and the reference-run agreement are the gate. Fallbacks in order: 3.1 Flash-Lite, 3.8 Flash, Sonnet-as-reader (cost +$0.03, still under the strong-only Fable arm).
- **Tokenizer differences**: Claude may count the flat-table text differently from Gemini; `tokenizerFactor` is measured in P0, not assumed.
- **Cache minimums** per Claude model differ and are read from the vendor's caching doc in T-23-02; if the prefix cannot clear a minimum, that provider runs uncached (cost still shown in §1.3 "no cache").
- **Repricing dates are fixed events**: 2026-12-01 (Argon) and 2027-01-01 (3.8 Flash). Anything shipped as default before P5 finishes should be reviewed at those dates.
- **Anthropic access**: needs an API key in `aiastra/chat-llm` or Bedrock model access for the Lambda role (Terraform draft, not applied). Deploy session decides which; direct API is faster to start, Bedrock keeps traffic inside AWS.
- **Sachin's decisions (only these):** (1) the default synthesizer tier after the P5 results (Sonnet / Argon / Opus; Fable only as a premium arm); (2) whether to enable the 1-hour Claude cache write for active sessions; (3) which off-pattern questions go into the golden set.
- Nothing here changes Radha or astrological computation: readers only read stored tables.
