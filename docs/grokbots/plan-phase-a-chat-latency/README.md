# Plan: Phase A - Chat latency & answer quality

## Goal
1. Full Amplify chat reply initially =30s (streaming not required).
2. **Completeness over speed** — no mid-sentence truncation, no repetition loops.
3. Then Gemini explicit context-cache (login + TTL/kundli; DDB pointers) when quota allows.

## How steps advance the plan
- Knobs (lean Kundli, temp, timing logs) reduce generation time.
- `aiastra/chat-llm` in SM makes provider real (was missing ? default groq).
- maxOut / loop guard protect quality.
- **Wire `thinkingConfig.thinkingBudget` into the Gemini request** so env `GEMINI_THINKING_BUDGET=0` actually applies (2.5-flash defaults to thinking and eats maxOut).
- Cache deferred: free-tier cachedContents storage limit 0.

## Tests
| Test | How | Success |
|------|-----|---------|
| Latency | Amplify outlook prompt; wall clock | Was ~22.4s at maxOut 2048 |
| Completeness | Same prompt; full sentences; no n-gram loops | Loop guard PASS; still FAIL mid-sentence at 8192 |
| Cache | usedCache in logs | Blocked until paid quota |

## Dig (2026-09-15 ~7:25pm PT) — loop-guard smoke FAIL ~41s
1. **finishReason=`MAX_TOKENS`**, `stoppedForLoop=false`, `maxOutputTokens=8192`, `geminiCallMs˜40542` (matches ~40.9s wall). Not stream abort / not CF soft-deadline / not capacity.
2. Visible reply ~4480 **chars** (not tokens). Far below what 8192 answer tokens should yield ? thinking tokens were consuming the budget.
3. Live env already had `GEMINI_THINKING_BUDGET=0` / `GEMINI_INCLUDE_THOUGHTS=0` but **`generationConfig` never sent `thinkingConfig`** — Gemini 2.5-flash default thinking stayed on.
4. **Fix:** add `thinkingConfig: { thinkingBudget, includeThoughts }` from env (0/false); keep maxOut=8192 + loop guard + `GEMINI_CACHE_ENABLED=0`. Redeploy ? Lakshmi re-smoke same outlook prompt; expect `finishReason=STOP` (or equivalent) + complete sentences. Log `thinkingBudget` in timing line.

## Best approach?
Quality-first: keep 8192 + loop guard; disable thinking in-request rather than raising maxOut to 50k (that caused repetition collapse). Do not re-enable cache until paid quota.

## Status
**SMOKE PASS (=30s + thinking)** — await Narayan/Sachin green declaration; cache held until paid.

## Dig (2026-09-15 ~7:36pm PT) — thinking-off smoke FAIL ~43s
- Timing log confirms `thinkingBudget:0`, `includeThoughts:false`, `stoppedForLoop:false`, `finishReason=MAX_TOKENS`, `maxOutputTokens=8192`, `geminiCallMs˜35900`.
- Thinking-off worked; answer format (Karmic Timeline table) still needs more than 8192 output tokens.
- **Fix (env-only):** raise `GEMINI_MAX_OUTPUT_TOKENS` to **16000** (SM + Lambda). Keep thinking off + loop guard. Avoid 50000 (repetition collapse).
- Re-test: same outlook prompt; expect `finishReason=STOP` (or complete table) without loop.

## Decision (2026-09-15 ~7:37pm PT) — Sachin: cutoff OK, thinking ON
- Completeness gate **relaxed**: mid-answer / mid-table cutoff is ACCEPTABLE.
- Phase A green criteria now: **no repetition loop** + **thinking enabled** + no capacity/hard failures.
- Live env: `GEMINI_THINKING_BUDGET=1024`, `GEMINI_MAX_OUTPUT_TOKENS=8192`, `INCLUDE_THOUGHTS=0`, `CACHE_ENABLED=0`, loop-guard on.
- Image `thinking-off-20260916022820` already sends `thinkingConfig` from env — **no rebuild** required to turn thinking back on.
- Light smoke (not full completeness): loop-free + timing log shows `thinkingBudget:1024`.

## Goal update (Sachin 2026-09-15 ~7:38pm PT)
- Phase A green = **=30s wall-clock** + **thinking ON** + **no repetition loop** + no hard/capacity fail.
- Mid-answer cutoff still OK.
- Order: Lakshmi baseline at 1024/8192 ? env-only tune (lower thinkingBudget and/or maxOut) ? re-smoke latency after each change.

## Cache deferred (Sachin 2026-09-15 ~7:41pm PT)
- Gemini **FREE tier**: `cachedContents` storage limit=0; capacity/high-demand risk accepted.
- Keep `GEMINI_CACHE_ENABLED=0`. Do **not** enable context cache for =30s latency.
- Path to =30s = `thinkingBudget` / `maxOut` env tune only (after baseline). Conserve smokes (~20 calls): batch knobs, one re-check after tune.
- Cache PR/infra can remain parked until paid quota (if ever).

## Smoke budget (Sachin/Narayan)
- Free tier ~20 Gemini calls — **Astra: NO extra probes/smokes**.
- Lakshmi only: (1) baseline at 1024/8192 (2) ONE post-tune re-check after a single batched env flip.
- Tune from baseline wall-clock + CloudWatch only. Astra does not declare Phase A green.

## Policy flip (Sachin via Narayan ~7:42pm PT)
1. Gemini **paid** coming for caching — keep `CACHE_ENABLED=0` until Sachin confirms billing live (do not enable cachedContents yet).
2. **=30s is PRIMARY**.
3. Cutoff/completeness chase **DEFERRED**.
4. Zero Astra probes; Lakshmi baseline ? one batched thinkingBudget/maxOut flip ? one re-check.
5. Cache PR #4 / DDB/IAM may stay ready; Amplify traffic on cache **held**.

## Baseline + tune (2026-09-15 ~7:43pm PT)
- Baseline light PASS: 34.6s, thinking on, no loop, cutoff OK (not =30s).
- One batched flip: `GEMINI_THINKING_BUDGET=512` (maxOut 8192, cache off). Awaiting single re-check.


## Re-check PASS (Lakshmi 2026-09-15 ~7:47pm PT)
- Wall-clock **˜21s** (=30s YES); thinkingBudget=512; no loop; no capacity/hard error; complete sentence end.
- Baseline 34.6s ? 21s after 1024?512 thinkingBudget flip.
- Live knobs: maxOut=8192, INCLUDE_THOUGHTS=0, CACHE_ENABLED=0, loop-guard on.
- Free-tier smoke budget done unless Sachin asks more.
- **Phase A green:** criteria met per Lakshmi smoke; Astra does not self-declare — await Narayan/Sachin.
- Cache Amplify traffic still **held** until paid billing confirmed.
