# Plan: Phase A - Chat latency & answer quality

## Goal (final)
1. Amplify→CF→Lambda Gemini chat **≤30s wall-clock WITH thinking ON**.
2. No repetition loops; no capacity/hard failures.
3. Mid-answer cutoff **deferred / OK** (Sachin).
4. Gemini context-cache **held** until paid billing confirmed.

## Locked live knobs (Narayan GREEN 2026-09-15 ~7:47pm PT)
| Knob | Value |
|------|-------|
| `GEMINI_FLASH_MODEL_ID` | `gemini-2.5-flash` |
| `GEMINI_THINKING_BUDGET` | **512** |
| `GEMINI_MAX_OUTPUT_TOKENS` | **8192** |
| `GEMINI_INCLUDE_THOUGHTS` | **0** |
| `GEMINI_CACHE_ENABLED` | **0** |
| Loop guard | **on** (in image) |
| Image lineage | `thinking-off-*` image (sends `thinkingConfig` from env) |

## Smoke trail
| Step | Result |
|------|--------|
| Phase A knobs @ maxOut 2048 | ~22.4s latency PASS; later quality issues |
| maxOut 50000 | ~205s MAX_TOKENS + repetition collapse |
| Loop guard + maxOut 8192 | Loop gone; still mid-sentence (thinking default ate budget) |
| `thinkingConfig.thinkingBudget=0` wired | Still MAX_TOKENS @ 8192 on table-heavy outlook |
| Sachin: cutoff OK, thinking ON | Completeness chase stopped |
| Baseline @ budget **1024** / maxOut 8192 | Light PASS **34.6s** (not ≤30s) |
| Tune budget **512** / maxOut 8192 | Re-check PASS **~21s** ≤30s, no loop |

## Status
**GREEN** (Narayan, on Lakshmi’s ~21s @ 512). No more latency smokes unless Sachin asks. Cache Amplify traffic **held** until paid. Cognito = no work until greenlit (first artifact would be `docs/grokbots/plan-cognito-auth`).

## Learnings → SKILLS.md
See repo `docs/grokbots/SKILLS.md` (thinkingConfig must be in request body; free-tier no cache; 512/8192 winning knobs; smoke budget).
