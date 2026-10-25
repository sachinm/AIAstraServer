# 05 — Models, cost, latency, caching

Model ids and prices were read from `ai.google.dev/gemini-api/docs/models`, `/pricing` and `/caching` on 2026-10-24. Re-verify before Phase 2 ships; Google reprices on 2026-12-01 and 2027-01-01 per the pricing page notes.

## 1. Model matrix (paid tier, per 1M tokens)

| Role | Model id | Input | Output (incl. thinking) | Cached input | Cache storage | Explicit cache | Notes |
|---|---|---|---|---|---|---|---|
| Intake | `gemini-3.1-flash-lite` | $0.25 | $1.50 | $0.025 | $1.00 /M/h | yes | ~1k in, ~200 out; structured output |
| Specialists | `gemini-3.8-flash` | $0.75 | $3.75 | $0.075 | $0.50 /M/h | yes (min 4,096 tokens) | JSON output, thinking low |
| Specialists (budget alt.) | `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.03 | $1.00 /M/h | yes | try in evals; use if grounding scores match |
| Synthesizer | `gemini-4-argon` | $2.00 | $10.00 | $0.10 (implicit only) | n/a | **no** | 1M context, thinking; stable prefix first |
| Synthesizer (alt.) | `gemini-3.1-pro-preview` | $2.00 | $12.00 | $0.20 | $4.50 /M/h | yes | preview; only if argon quality disappoints |
| Fast lane synth | `gemini-3.8-flash` | as above | | | | | |
| Fallback specialists | Groq `openai/gpt-oss-120b` | existing | | | | | JSON mode; keep key in `aiastra/chat-llm` |
| Current live | `gemini-2.5-flash` | $0.30 | $2.50 | $0.03 | $1.00 /M/h | yes (min 2,048) | access limited to prior users; keep as env option during Phase 1 |

All ids are env-driven (`READING_MODEL_INTAKE`, `READING_MODEL_SPECIALIST`, `READING_MODEL_SYNTH`, `READING_MODEL_FAST`), so the matrix changes without a deploy. Thinking is set per request: Gemini 3.x/4 use `thinkingConfig.thinkingLevel` (`low|medium|high`), 2.5 uses `thinkingBudget`; the wrapper maps one setting to both (verify the exact field name on each model page when implementing; the 2.5 lesson in `docs/grokbots/SKILLS.md` — the config must be in the request body — still applies).

## 2. Token budget per full reading (one subject)

| Node | Input tokens | Output tokens | Model | Cost uncached | Cost with cache |
|---|---|---|---|---|---|
| intake | 1,200 | 250 | flash-lite | $0.0007 | — |
| promise | 7,000 | 1,200 | 3.8-flash | $0.0098 | $0.0055 (pack portion cached) |
| dasha | 6,000 | 1,200 | 3.8-flash | $0.0090 | $0.0051 |
| transit | 6,000 | 1,200 | 3.8-flash | $0.0090 | $0.0051 |
| nakshatra | 5,000 | 1,000 | 3.8-flash | $0.0075 | $0.0043 |
| synthesize | 9,000 (persona+method+format ~2.5k, brief ~6k) | 3,000 (incl. thinking) | argon | $0.0480 | $0.044 (implicit on the 2.5k prefix) |
| **total** | ~34k | ~7.9k | | **≈ $0.085** | **≈ $0.07** |

Two subjects add three specialists (~$0.025). Fast lane (intake + one 3.8-flash synth over a 9k pack, 1.5k out): ≈ $0.013. Current live turn (2.5-flash, ~18k in lean, 2–8k out): $0.01–0.03. So the full reading is roughly 3× today's cost per turn for a reading that is grounded and complete; the fast lane is cheaper than today.

At 1,000 full readings/day: ~$85/day ≈ $2.6k/month before cache; cache saves ~15–20 % at this pack size (the per-request packs are not cached; see §4). The real savings lever is the fast lane share and the specialist model choice (3.5-flash-lite halves specialist cost if evals allow).

## 3. Latency budget (warm Lambda, paid tier)

| Stage | Expected | Notes |
|---|---|---|
| intake | 0.8–1.5 s | tiny model, short output |
| clarify round trip | user-paced | prepare runs during it |
| prepare | 0.2–0.4 s | two DB reads, arithmetic |
| specialists (parallel) | 5–9 s | ~1.2k output tokens each at 150–250 tok/s on flash + TTFT 1–2 s; wall clock = slowest |
| reconcile | < 0.1 s | |
| synthesize TTFT | 2–5 s | thinking medium/high |
| synthesize stream | 15–25 s | 3k tokens incl. thinking; visible tokens ~1.5–2k at ~80–120 tok/s |
| **first visible progress** | **< 2 s** (intent event) | |
| **first answer token** | **9–15 s** | after specialists |
| **complete** | **30–40 s** | vs 21 s cut-off answers / 60 s+ full answers today |
| fast lane complete | 8–15 s | |

Cold start adds 2–4 s (Node 22 image, Prisma connect). Mitigations already in place: SSE pings, `X-Accel-Buffering`. New: `stage` events so the user sees "Reading D-10 ✓ Checking Saturn–Mercury period ✓ …" instead of a spinner; provisioned concurrency of 1 on `aiastra-server-api` during peak hours if cold starts show in the run timings (cost ~$10–15/month at 2048 MB).

Why this is still "fast enough" though slower than the 21 s lock: the 21 s answers are truncated and single-layer; a human astrologer reading takes much longer; and the perceived wait is split into a 2 s acknowledgement, a visible pipeline, and a streaming answer that starts in ~10 s. If after Phase 2 the median complete time exceeds 45 s, the first lever is reducing specialist output (`claims ≤ 8`, `maxOutputTokens 1200`), the second is `thinkingLevel medium` on argon, the third is 3.5-flash-lite specialists.

## 4. Caching strategy

Facts from the caching doc: implicit caching is automatic on 2.5+ with minimum prefixes of 2,048 (2.5) / 4,096 (3.x, argon) tokens, discount reflected automatically, hits reported in `usageMetadata.cachedContentTokenCount`; explicit `cachedContents` is supported on 3.x and 2.5 but **not on Gemini 4 Argon**; storage is billed per token-hour; the free tier gave zero storage, which is why the DynamoDB pointer design is parked.

Decisions:

1. **Prompt layout for implicit hits everywhere**: system instruction = persona + method + format (stable, ~2.5k tokens, same bytes for every user); then the evidence pack sections in fixed order with the per-user stable parts first (`header`, `d1_core`) and the horizon-dependent parts last (`dasha`, `transits`). Same user, consecutive questions → the prefix repeats → implicit hits on flash and argon without any infrastructure.
2. **Explicit cache for specialists, per user, when billing is paid**: content = persona + method + **full dossier** (~30k tokens) as a `cachedContents` object on `gemini-3.8-flash`, TTL 24 h sliding (re-create on first question of the day, delete on kundli rebuild). Then each specialist request sends only its small pack delta + question. Cost: storage 30k tokens × $0.50/M/h ≈ $0.015 per user-day when active; cached reads at 10 % of input price. This pays off when a user asks more than ~3 questions in a day; otherwise implicit caching is enough. Therefore: **create the explicit cache lazily on the second question within 24 h**, not at login. Reuse `geminiCacheService.ts` (pointer table `aiastra-gemini-cache`), extend the hash with `promptVersion + factsVersion + dossierHash + modelId`.
3. **No explicit cache for the synthesizer** (argon does not support it); rely on the stable prefix.
4. **Transit snapshot is global**: one row per day serves all users; never cached in Gemini, always joined server-side.
5. **Dossier is computed once** per kundli version; never recomputed per question. The 2 s-spaced ten-call sync becomes one invoke.

Measure: log `cachedContentTokenCount` per node into `reading_runs.usage`; the evals report hit rate; target ≥ 60 % of specialist input tokens cached for returning users.

## 5. Tokens saved by the dossier itself

Today a "full" context is ten pretty-printed JSON arrays (longitude strings, 2-space indent) ≈ 30–50k tokens. The compact dossier is ≈ 25–40k tokens for far more information, and a single-subject pack is 6–12k. Phase 1 alone (dossier pack in the existing single call) should cut input tokens by 50–70 % and remove most of the thinking spent on arithmetic, which is where the 21 s → cut-off trade-off came from.

## 6. Cost controls

- `reading_runs.usage` with per-model token counts and computed USD (price table in `llm/models.ts`, versioned).
- Per-user daily budget (`READING_DAILY_BUDGET_USD`, default 1.00) → beyond it, fast lane only, with a message.
- Admin GraphQL `readingStats(from, to)`: runs, p50/p95 latency per stage, cost, cache hit rate, dropped claims, grounding failures.
- CloudWatch metric filters on the JSON log lines (`msg: "reading timing"`), alarms on p95 complete > 60 s and error rate > 5 %.
