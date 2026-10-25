# 12 — Performance: budgets, measurements, and what each optimisation bought

Added 2026-10-25. Bench: `npm run bench:reading` (`scripts/bench-reading.ts`). Raw numbers: `docs/screenshots/p3-01-bench/`.

## 1. Budgets (brief item 5)

| Stage | Budget (p95) |
|---|---|
| Rules classification | under 5 ms |
| Intent event on the wire, from request (warm instance) | under 1.2 s |
| Evidence pack build | under 150 ms |
| Reconcile (no model) | under 50 ms |
| First answer token | under 10 s for a full reading, under 4 s on the fast lane |
| Complete answer | under 40 s for a full reading, under 15 s on the fast lane |

## 2. Measured: model stubbed (fake Gemini), 2026-10-25

Chart G1 from fixtures (no database), 12 golden questions × 5 runs, both flows, on a Windows development laptop. With the model stubbed, the first-token and total numbers are the engine's own orchestration cost. Real model time is added on top, and is measured with `--live` once Gemini billing is funded.

| Stage | p50 | p95 | Budget | Met |
|---|---|---|---|---|
| Rules classification | 0.18 ms | 0.72 ms | 5 ms | yes |
| Intent event | 6 ms | 31 ms | 1,200 ms | yes |
| Evidence pack | 0.7 ms | 4.5 ms | 150 ms | yes |
| Reconcile | 0.12 ms | 0.35 ms | 50 ms | yes |
| First token, single flow | 12 ms | 44 ms | 10 s | yes |
| First token, graph flow | 37 ms | 121 ms | 10 s | yes |
| Complete, single flow | 13 ms | 50 ms | 40 s | yes |
| Complete, graph flow | 39 ms | 124 ms | 40 s | yes |
| Model calls per question, single / graph | 1 / 4 | 2 / 5 | | |
| Prompt tokens per question, single / graph | 7.1k / 19.5k | 7.6k / 27.8k | | |

The cached-token counts in the raw file come from the fake's simulation of a repeated prefix. They are not a real cache hit rate.

## 3. Measured earlier on the live database (2026-10-25)

| Measurement | Before | After |
|---|---|---|
| Warm data load (dossier + transit chart) per question | 430–530 ms | 0–1 ms |
| Cold data load from a laptop to Render (Virginia) | 1.4–1.6 s | same; on the Lambda in us-east-1 it is a few round trips of a few ms |
| Intent event | 3–5 ms | |

## 4. What each optimisation bought

| Optimisation | Where | Effect |
|---|---|---|
| Rules-first classification and intake (no model call for clear questions) | `buckets/classifier.ts`, `nodes/intake.ts` | understanding in under 1 ms instead of a model round trip (typically 0.5–1.5 s) |
| Evidence pack instead of raw chart JSON | `packs/selector.ts` | about 4.1k tokens per subject, against 16.1k for the whole dossier and 19.2k for the legacy full prompt (72 % fewer); 6.6k for legacy lean (38 % fewer) |
| Cache-friendly prompt order (system, base chart, subject, question) | `run.ts`, `nodes/specialists.ts` | the same ~3k-token prefix on every call, eligible for implicit and explicit caching |
| User → kundli cached in process; dossier and transit chart read in parallel | `data/store.ts` | warm data load 430–530 ms → 0–1 ms |
| Data prefetch overlapping intake | `run.ts` | the data wait inside a question is 0 when warm |
| Findings cache (natal layers ignore the period) | `nodes/findingsCache.ts` | a repeat question in the same area makes no specialist calls; a changed period re-runs only dasha and transit |
| Prewarm during clarification (graph flow) | `clarify/prewarm.ts` | the promise layer is ready before the person confirms |
| Explicit Gemini prompt cache (off until billing) | `llm/promptCache.ts` | the ~3k-token prefix billed at the cached rate after the 2nd use |
| Removed the `meDetails` round trip before each ask (web) | `AIAstra_WEB/src/pages/UserData.ts` (AF-05) | one network round trip less per question |
| Token-indexed classifier, no backtracking regexes | `buckets/classifier.ts` | 100,000-character adversarial input stays under 50 ms |
| Declined-topics list cached; built-in floor on cold start | `policy/declined.ts` | the gate never waits on the database |
| Parallel specialists with per-node time budgets; optional agents never hold the join | `graph.ts` | the graph's wall time is the slowest required agent, not the sum |

## 5. Still to measure (needs a funded Gemini key)

- **Real latency:** first token and total with `gemini-3.8-flash`, single against graph flow.
- **Explicit cache:** hit rate and the cached share of input tokens.
- **Cost per reading:** single against graph.
- **Concurrency:** load at 20 concurrent readings against the Lambda.

```bash
npm run bench:reading -- --live --json docs/screenshots/p3-01-bench/02-live-bench.json
```
