# 19 — Multi-agent DAG, convergence and token caching (as built)

Added 2026-10-25. Implements files 09 (templates), 11 (triangulation and DAG joins) and the caching parts of 05 and 13. Code: `src/reading/graph.ts`, `src/reading/nodes/{specialists,reconcile,convergence,findingsCache}.ts`, `src/reading/llm/promptCache.ts`, `src/reading/prompts/templates/`. The graph runs when `READING_FLOW=graph`; the single-call flow stays the default until the graph is measured on a paid Gemini key.

## 1. The DAG

```
intake (rules, classifier) ─► packs ─► fanOut ──Send──► promise   (L1, required)
                                              ├─────► dasha     (L2, required)
                                              ├─────► transit   (L3, required when the period is 3 years or less)
                                              └─────► nakshatra (L4, optional)
                                                          │  all join before reconcile
                                                          ▼
                                     reconcile (no model): grounding gate · windows · deciders · convergence ·
                                                           fortune tier · now/next · SynthBrief
                                                          ▼
                                     synthesize (streams) with the template for the question (T1–T10)
```

| Agent | Required? | On failure |
|---|---|---|
| promise | yes | retried once; then recorded as failed and the verdict is capped at *weak* |
| dasha | yes | same |
| transit | yes when the period is 3 years or less, otherwise optional | same when required; skipped when optional |
| nakshatra | optional | no retry; skipped after its time budget; never holds the join |
| annual (L5) | optional, horizon within about 12 months (doc 28 §5) | same as nakshatra; no data = skipped, reason `no_data` |
| prashna (L6) | optional, prashna-eligible confirmed questions (doc 28 §5) | same; one vote that cannot move the verdict past *mixed* without a natal layer |

Every agent has a hard time budget (`READING_SPECIALIST_TIMEOUT_MS`, default 12 s). Stage events tell the UI `start`, `done` (with `cached: true` on a cache hit), `failed` or `skipped`.

## 2. What the specialists return

- **verdict:** the analyst's verdict (unchanged).
- **layerScore:** −3 (clearly denied or obstructed) to +3 (clearly promised or supported).
- **claims:** each cites evidence ids (dropped by the grounding gate when they don't resolve) and carries a `tradition` tag: `parashara`, `jaimini`, `nakshatra`, `kp_starlord`, `tajaka` or `kuta`.
- **Standing instruction:** the method prompt now carries file 11 §0 for every analyst. Read the fields, compute nothing, tag the tradition, report disagreement, and never invent a placement, date or yoga.

## 3. Reconcile: convergence, deciders, fortune, brief

**Convergence** (file 11 §1), on the primary subject:
- **Score:** 3·L1 + 2·L2 + 2·L3 + L4 (+ L5 when an annual export exists). It's logged and never shown.
- **Verdict tiers, first match wins:**

| Tier | When |
|---|---|
| not indicated | L1 ≤ −2, whatever the transits say |
| strong | L1, L2 and L3 are all ≥ +1 (L3 only when transit is required) |
| moderate | two of the three are ≥ +1 and none is ≤ −2 |
| weak | one of the three is ≥ +1 |
| mixed | L1 ≥ +1 while L2 and L3 point opposite ways |
| not indicated | otherwise |

- **Cap:** a missing required layer caps the verdict at *weak* and adds a caveat.
- **Agreement label:** converge, partial or diverge, from the signs of the layers.

**Deciders** (file 11 §3): a table per subject of the evidence-id patterns that settle a split promise. When the promise is split (verdict mixed, or claims pointing both ways), claims citing primary deciders count double and secondary ones 1.5×, and L1 is recomputed. The brief names the deciders used. Examples:
- **Marriage:** D-9 and the 7th lord.
- **Career:** the 10th lord and D-10.
- **Property:** D-4 and Mars.

**Fortune tier** (file 11 §4): rising, steady, testing or heavy, with the date it next changes (the end of the running antardasha). Its inputs are fields only:
- **9th house:** the 9th lord's dignity and house, and the SAV of the 9th.
- **Jupiter:** its dignity and house.
- **Running periods:** the houses of the running MD and AD lords.
- **Transits now:** Jupiter and Saturn from the Moon, and Sade Sati.

**Now and next:** the running MD–AD–PD and when it ends, and the next antardasha. The dossier lists sub-periods near today and antardashas further out, so "next" is the first row with a different MD–AD.

**SynthBrief** (file 09 §3), rendered as a compact block the synthesizer reads:

```
TEMPLATE: T2
VERDICT: moderate (agreement partial)
LAYERS: L1=2 L2=1 L3=0
DECIDERS: D-9 7th lord dignity and the D-1 7th lord in D-9; …
NOW: Sa-Ke-Ve until 2027-09-07
NEXT: Sa-Ve from 2027-09-07 to 2030-03-20
FORTUNE: steady until 2027-09-07
WINDOWS: - 2026-11-01 to 2027-01-31 | favourable | … | combined
KEY FACTS: - …
TRADITIONS APPLIED: parashara, jaimini
```

## 4. Templates

`prompts/templates/T1.md` … `T10.md` hold the section skeletons and word caps of file 09 §2. `_rules.md` holds the ten common rules: answer first, dates everywhere, fixed confidence words, no remedies, death, minors or advice, facts quoted not computed. The bucket classifier picks the template; the older format prompts remain the fallback for intents without a classification.

## 5. Token caching

| Layer | What it saves | How |
|---|---|---|
| **Findings cache** (`findingsCache.ts`) | whole specialist calls | Key: dossier hash + analyst + subject + prompt version, plus the period for timing layers only. Promise and nakshatra are natal, so changing the period during clarification or asking again re-runs only dasha and transit. In-process LRU, 500 entries, 6-hour TTL (`READING_FINDINGS_CACHE_TTL_MS`). |
| **Prompt layout** (implicit caching) | the repeated prefix of every call | System (persona + method, identical for everyone), then the user's base chart (identical across that user's questions), then the subject part, then the question. Gemini discounts a repeated prefix automatically on the paid tier. |
| **Explicit prompt cache** (`promptCache.ts`) | the ~3k-token system + base-chart prefix | Created lazily on the prefix's 2nd use (`READING_EXPLICIT_CACHE_MIN_USES`), in the background, 30-minute sliding TTL (`READING_EXPLICIT_CACHE_TTL_SECONDS`). Later calls send `cachedContent` plus only the subject part and question. A rejected cache is forgotten and the call retried uncached. Lifecycle below. **Off** until `READING_EXPLICIT_CACHE=1`. |

### Explicit cache lifecycle (R-7; doc 20 §8, doc 21 §1 Q4)

Goal: never pay for an idle cache. Code: `src/reading/llm/promptCache.ts`, `cacheRegistry.ts`, `cacheSweep.ts`.

- **Registry** `llm_cache_entries` (migration M8): one row per Gemini cache — name, provider, user, kundli, prefix hash,
  model, created / last used / expires, deleted_at, delete_error. Before creating, an instance adopts a live row for the same
  prefix (it also asks once on the first sighting of a prefix), so Lambda instances share one cache per chart prefix.
- **Display name** `aiastra:<prefixHash>` on every cache we create; the sweeper only ever deletes orphans with that prefix.
- **TTL 30 min, sliding.** A hit with less than half the TTL left PATCHes `cachedContents/{name}?updateMask=ttl` in the
  background; uses are written to `last_used_at` at most once a minute per instance.
- **Logout** (GraphQL `logout: Boolean!`) calls `deleteUserCaches(userId)` fire-and-forget: Gemini DELETE (404 counts as
  deleted), rows marked. A failed delete keeps the row live with `delete_error`, and the sweeper retries it. The web client
  must call the mutation on logout (it only clears local storage today). On Lambda the background delete can be frozen
  with the instance; the TTL and the sweeper are the backstop.
- **Sweeper** `sweepLlmCaches({ idleMs })` (default 30 min): deletes live rows idle longer than that, marks expired rows,
  then lists Gemini's `cachedContents` and deletes `aiastra:*` caches with no live row that are older than 5 minutes.
  Without a working registry it skips the reconcile (it cannot tell orphans from live caches).
  - CLI: `npm run cache:sweep [-- --idle-minutes 30]`.
  - Long-lived server (not Lambda): 45-minute unref'd timer, only when `READING_EXPLICIT_CACHE=1`.
  - Lambda: EventBridge schedule → Lambda Web Adapter pass-through → `POST /events` in `server.ts`. Recognised only when
    `source=aws.events`, `detail-type=Scheduled Event`, `detail.task=llm-cache-sweep` and, when
    `LLM_CACHE_SWEEP_TOKEN` is set on the function, `detail.token` equals it. Other bodies get 204. One sweep per
    instance per 5 minutes at most.
- **Registry failures** (table missing before M8 is applied, DB down) are logged once; the registry is skipped for 5
  minutes and the cache keeps working from memory. A chat call never waits on, or fails because of, the registry.

**For the deploy session (not created yet):** apply M8 (`npx prisma migrate deploy`), set `LLM_CACHE_SWEEP_TOKEN` (any
random string) on the API Lambda, check the image keeps the LWA default `AWS_LWA_PASS_THROUGH_PATH=/events`, then create:

| Resource | Value |
|---|---|
| EventBridge rule | `aiastra-llm-cache-sweep`, schedule `rate(45 minutes)`, state ENABLED, default bus |
| Target | the API Lambda (alias the deploy uses), constant input (JSON): `{"source":"aws.events","detail-type":"Scheduled Event","detail":{"task":"llm-cache-sweep","token":"<LLM_CACHE_SWEEP_TOKEN>"}}` |
| Permission | `aws lambda add-permission --statement-id eventbridge-llm-cache-sweep --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn <rule ARN>` on that function/alias |

Constant input replaces the event EventBridge would send, so the body above is what reaches `POST /events`. An
EventBridge Scheduler schedule with the same input works too. Nothing to create until `READING_EXPLICIT_CACHE=1` is set.

**What turning the explicit cache on needs:** paid billing on the Gemini key's Google project, then `READING_EXPLICIT_CACHE=1`.
- **The newer key:** its project needs prepay credits topped up in AI Studio, and it requires `gemini-3.8-flash`.
- **The current key:** it's on the free tier, which has no cache storage.

**Bedrock:** Bedrock prompt caching supports Claude and Amazon Nova only, not the open models (Nemotron, Llama, gpt-oss, Gemma, Qwen, DeepSeek). The clarifier's prompts are too short to be cached in any case.

## 6. Not done yet

- **Two-track stage 1 during clarification:** dispatching promise and nakshatra while the clarifier waits (file 13 §3). The findings cache already makes the confirm path reuse them on the same instance. Pre-dispatching from the clarify service is the next step.
- **L5 (annual chart) and L6 (prashna):** built as optional nodes (doc 28 §5); live once Radha R-27a/c are deployed and the catalog sync marks the types served.
- **Real-model measurements:** latency, cost and cache hit rate need a funded Gemini key.
