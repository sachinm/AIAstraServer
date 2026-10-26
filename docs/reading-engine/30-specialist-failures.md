# 30 — Why the required specialists fail, and what the server now says about it

Status: fix on branch `fix/specialist-failures` (from `develop` 4edb317), 2026-10-26. Code and tests only; nothing on
AWS or the database was touched. The live cause still has to be read from staging logs (§4).

**The symptom.** A real reading on staging showed `Promise !`, `Dasha !`, `Transits !` (all three failed after their one
retry) while Chart facts, Cross-check and Writing were fine. A failed required specialist on the first subject caps the
verdict (reconcile, file 11 §6), so the answer came out weak. The web panel already reads `reason`, `retried` and
`capped` on `stage` events, but the server never sent them, so nobody could tell *why* from the UI or the logs.

## 1. Every way a specialist can fail

A specialist (`src/reading/nodes/specialists.ts`) is one non-streamed `callGemini` with a response schema, run in
parallel by the graph (`src/reading/graph.ts`). Required ones (promise, dasha, transit when the horizon is 3 years or
less) retry once; optional ones (nakshatra, long-horizon transit) do not.

| # | Failure | Where | Reason code |
|---|---|---|---|
| 1 | The attempt runs past the time budget (`READING_SPECIALIST_TIMEOUT_MS`, 18 s default) | graph timer / Gemini AbortController | `timeout` |
| 2 | The model stops at `maxOutputTokens` mid-JSON (`finishReason: MAX_TOKENS`), so `JSON.parse` fails | `runSpecialist` | `parse` |
| 3 | Text that is not JSON at all (prose, fence) | `runSpecialist` | `parse` |
| 4 | JSON of the wrong shape (root is not an object) | `findingZ` | `schema` |
| 5 | Empty or blocked answer (`SAFETY`, `RECITATION`, `promptFeedback.blockReason`) | `runSpecialist` | `model_error` |
| 6 | HTTP error after the wrapper's one 429/500/503 retry: quota (429), credits (402), bad request (400), outage (5xx), network | `gemini.ts post()` | `model_error` (log has `httpStatus`) |
| 7 | Explicit prompt cache refused (expired, deleted) | `callGemini` fallback | retried uncached; fails as 1 or 6 |
| 8 | No evidence pack for the subject | graph | `no_data` |

Since `fix/specialist-parse-tolerance` (8cc004b) the zod schema is tolerant field by field (`.catch` defaults,
`keepValid` drops one bad claim or window), so **4 is now close to impossible**: only a non-object root fails it.

## 2. Ranked: what most likely hit all three at once

All three specialists share the model, the system prompt, the ~10k+ token base chart (full base, doc 24) and the same
budgets, and they start at the same moment. A cause that hits all three is one that depends on those shared things, not
on one analyst's content.

1. **Time-out with a Gemini 3.x specialist model (most likely).** `thinking: 'off'` is sent to 3.x as
   `thinkingLevel: 'low'` (`thinkingConfigFor`), so the specialists *think* before writing up to 4,096 tokens of v2 JSON
   (6–10 claims, up to 12 windows with fruit) over a large prompt. The 18 s budget (12 s before 8cc004b; the env sample in
   doc 06 still says 12000) was sized for a non-thinking model. The retry gets the same budget and the same work, so a
   slow model fails twice, exactly the `!` after a retry that staging showed. Two code faults made it worse:
   - the timed-out attempt was never aborted (the graph's `Promise.race` timer had no link to the HTTP call), so the
     retry ran while the first call was still streaming on the same connection pool, and the timer was never cleared;
   - with the explicit cache on, `callGemini` treated *any* error, a time-out included, as "cache rejected": it forgot
     the shared cache (for all three analysts) and made a second, uncached call that started with no time left.
2. **Cut-off JSON (`MAX_TOKENS`).** On 3.x the thought tokens come out of the same `maxOutputTokens` (4,096). After
   thinking, the v2 JSON no longer fits and is cut mid-claim; `JSON.parse` failed and the whole layer was lost, even when
   eight good claims had already arrived. Again the same for all three and again the retry repeats it.
3. **Quota or billing (429 / 402).** Three to four parallel calls plus three retries in a few seconds can hit a low
   per-minute quota on a preview model; a depleted key fails every call (memory: the AI Studio key returned 402). Writing
   ✓ on the same reading makes a key-wide failure unlikely unless the synthesizer uses a different model with its own quota.
4. **Explicit cache path.** Only if `READING_EXPLICIT_CACHE=1` on staging (doc 19 says it stays off until paid billing).
5. **Schema.** Nearly ruled out by 8cc004b (above).

Reproduced in `tests/unit/reading/specialistFailures.test.ts`: a slow fake Gemini fails promise, dasha and transit after
their retry with `reason: 'timeout'`, and a fake `MAX_TOKENS` answer cut mid-claim was a total loss before the repair.

## 3. Fixes made

| Fix | Code | Test |
|---|---|---|
| **Budget follows the model.** `specialistBudget(model)`: a model that thinks (any 3.x, or 2.x with a budget) gets `READING_SPECIALIST_THINKING_MS` (default 12 s) on top of `READING_SPECIALIST_TIMEOUT_MS` and `READING_SPECIALIST_THINKING_TOKENS` (default 4,096) on top of `READING_SPECIALIST_MAX_OUTPUT_TOKENS`. 2.x with thinking off is unchanged (18 s, 4,096); 3.x gets 30 s and 8,192. An env value of 12000 on staging becomes 24 s on 3.x. | `specialists.ts`, `config.ts` | budget tests; 3.x request sends 8,192 |
| **Time-outs abort the call.** Each attempt has its own `AbortController`; on time-out the HTTP call is aborted and the timer cleared. | `graph.ts` (`attempt`), `runSpecialist({ signal })` | "the timed-out attempt is aborted" |
| **Cache fallback only for a refused cache.** `callGemini`/`streamGemini` retry uncached only on HTTP 400/403/404 (`isCacheRejection`); a time-out or 429 is rethrown and the shared cache is kept. | `gemini.ts` | "a time-out on a cached call is not retried uncached" |
| **Cut-off JSON repair.** `parseFindingText` strips a fence or surrounding prose, and on failure `repairTruncatedJson` drops the unfinished last member and closes open arrays and objects. A repaired finding is kept only if at least one whole claim survived; it carries the caveat "This layer was cut short…", and is not written to the findings cache. | `specialists.ts` | repair tests; MAX_TOKENS answer keeps its complete claims |
| **Typed errors.** `SpecialistOutputError.kind` (`parse` / `schema` / `model_error`) and `finishReason`; `GeminiHttpError.status`; `GeminiTimeoutError`, `SpecialistTimeoutError`, `SpecialistNoDataError`. Error messages name the cause only; model text (which can quote the chart) is never put in an error or a log. | `specialists.ts`, `gemini.ts` | parse failure message has no model text |

Prompts and their astrology content are unchanged.

### Stage events (backward-compatible additions)

```jsonc
// before the retry of a required specialist (new status; older clients treat it as "running")
{ "type": "stage", "name": "dasha", "status": "retrying", "subject": "marriage_relationship", "ms": 18004, "reason": "timeout", "attempt": 2 }
// failed (required) or skipped (optional)
{ "type": "stage", "name": "dasha", "status": "failed", "subject": "marriage_relationship", "ms": 36011,
  "reason": "timeout", "retried": true, "capped": true }
// done after a retry
{ "type": "stage", "name": "promise", "status": "done", "ms": 21000, "subject": "...", "retried": true }
```

- `reason`: `timeout` | `parse` | `schema` | `model_error` | `no_data`.
- `retried`: true when a second attempt ran (required agents; never for `no_data` or optional agents).
- `capped`: true only for a required specialist on the first subject, the case reconcile caps the verdict for.
- The run record's `errors[]` entries for specialists also carry `reason`.

### Failure log

One `console.warn` JSON line per failed attempt, no prompt or model text, the API key redacted:

```json
{"msg":"reading specialist failed","runId":"…","analyst":"dasha","subject":"marriage_relationship","attempt":1,"final":false,
 "required":true,"capped":false,"reason":"timeout","model":"gemini-3.8-flash","latencyMs":30002,"timeoutMs":30000,
 "maxOutputTokens":8192,"thinks":true,"finishReason":null,"httpStatus":null,"promptTokens":null,"cachedTokens":null,
 "outputTokens":null,"thoughtTokens":null,"error":"dasha exceeded 30000 ms"}
```

Token counts are present when the model answered (parse, schema, blocked); a time-out has none because the call was
aborted. `final: true, capped: true` is the line that explains a capped reading.

## 4. What still needs a live check on staging

1. **Read the reason.** After this is deployed (through the deploy session), ask one graph-flow question and run the
   query below. The `reason` and `finishReason` decide which of §2 it was.
2. **Which specialist model is live.** `READING_MODEL_SPECIALIST` (or `GEMINI_FLASH_MODEL_ID` when unset) on
   `aiastra-server-api`, and whether `READING_SPECIALIST_TIMEOUT_MS`, `READING_SPECIALIST_MAX_OUTPUT_TOKENS`,
   `READING_EXPLICIT_CACHE` and `READING_FINDINGS` are set there. If the timeout is still 12000 from the doc 06 sample,
   remove it (the new default plus thinking headroom is 30 s on 3.x).
3. **Latency on 3.x.** From the `reading specialist failed` lines (or `timingsMs` on `reading_runs`) check that a
   successful specialist on the live model finishes inside 30 s. If thought tokens are large, consider
   `thinkingLevel: 'minimal'` for Flash models (not done here: not every 3.x model accepts it, and a 400 would fail every
   call).
4. **Quota.** If the reason is `model_error` with `httpStatus` 429 or 402, the fix is quota/billing, not code.
5. **Repaired findings.** Count `repaired` layers via the caveat in `reading_runs.findings`; many means the output budget
   is still short for v2 and `READING_SPECIALIST_THINKING_TOKENS` should go up.
6. **Panel.** The web panel shows "Timed out after a retry — reading confidence capped" for `reason: 'timeout'`; other
   reasons fall back to "Did not finish". It ignores `retrying` (shown as running) until the web adds a label for it.

### CloudWatch Logs Insights query

Log group `/aws/lambda/aiastra-server-api` (account 442728149528, us-east-1, profile `aiastra-ops`), last 24 h:

```
fields @timestamp, runId, analyst, subject, attempt, final, capped, reason, model, latencyMs, timeoutMs,
       maxOutputTokens, finishReason, httpStatus, promptTokens, cachedTokens, outputTokens, thoughtTokens, error
| filter msg = "reading specialist failed"
| sort @timestamp desc
| limit 100
```

Summary by cause:

```
filter msg = "reading specialist failed"
| stats count(*) as failures, avg(latencyMs) as avgMs, max(latencyMs) as maxMs by reason, model, finishReason, httpStatus, final
| sort failures desc
```

Pair with the run line for the same reading: `filter msg = "reading timing" and runId = "<runId>"`.

## 5. Checks run

`npx tsc --noEmit` clean; `npx vitest run tests/unit/reading`: 46 files, 623 tests passed (18 new in `specialistFailures.test.ts`), no flaky graph-flow failures on this run.
