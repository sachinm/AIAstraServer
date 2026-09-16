# Plan: Phase A - Chat latency & answer quality

## Goal
1. Full Amplify chat reply initially ≤30s (streaming not required).
2. **Completeness over speed** — no mid-sentence truncation, no repetition loops.
3. Then Gemini explicit context-cache (login + TTL/kundli; DDB pointers) when quota allows.

## How steps advance the plan
- Knobs (lean Kundli, temp, timing logs) reduce generation time.
- `aiastra/chat-llm` in SM makes provider real (was missing → default groq).
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
1. **finishReason=`MAX_TOKENS`**, `stoppedForLoop=false`, `maxOutputTokens=8192`, `geminiCallMs≈40542` (matches ~40.9s wall). Not stream abort / not CF soft-deadline / not capacity.
2. Visible reply ~4480 **chars** (not tokens). Far below what 8192 answer tokens should yield → thinking tokens were consuming the budget.
3. Live env already had `GEMINI_THINKING_BUDGET=0` / `GEMINI_INCLUDE_THOUGHTS=0` but **`generationConfig` never sent `thinkingConfig`** — Gemini 2.5-flash default thinking stayed on.
4. **Fix:** add `thinkingConfig: { thinkingBudget, includeThoughts }` from env (0/false); keep maxOut=8192 + loop guard + `GEMINI_CACHE_ENABLED=0`. Redeploy → Lakshmi re-smoke same outlook prompt; expect `finishReason=STOP` (or equivalent) + complete sentences. Log `thinkingBudget` in timing line.

## Best approach?
Quality-first: keep 8192 + loop guard; disable thinking in-request rather than raising maxOut to 50k (that caused repetition collapse). Do not re-enable cache until paid quota.

## Status
**IN PROGRESS** — thinkingConfig wire-up on KING-SM branch `feature/gemini-context-cache`; redeploy + completeness re-smoke next. Cache Amplify cutover **held**.
