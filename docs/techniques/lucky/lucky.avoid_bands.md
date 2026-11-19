# Technique Specification: Avoid Bands and Good Spans of the Day (`lucky.avoid_bands`)

**Technique ID:** `lucky.avoid_bands`  
**Category:** `self` (shared across all Lucky Times boards)  
**Board:** `lucky`  
**Status:** `built` (Priority #2 `muhurta` catalog unlock ready)  
**Owning Code Path:** `src/reading/luckyTimes/windows.ts` (`avoidBands`, `nowState`); `src/reading/luckyTimes/service.ts` (`getRange`)  
**Agent ID:** `lucky.scenario_windows` (upstream: `lucky.day_tables`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`lucky.avoid_bands` extracts the daily chronological red-light and green-light spans from the pre-pulled shared day row (`day_tables`) for a given place and local date. It surfaces the five classical avoid bands (**Rahu Kalam**, **Yamagandam**, **Gulikai**, **Durmuhurtam**, and **Varjyam**—wrapping post-midnight end times cleanly) alongside the three primary auspicious spans (**Brahma Muhurta**, **Abhijit**, and **Amrita Gadiya**), and resolves the real-time `"running now"` status (`avoid band` first, else `good span`, else `next good span`) in sub-millisecond deterministic execution.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `lucky.avoid_bands`:

- **Enabling `muhurta` in Server Chart Data Catalog (`chartData/catalog.ts:262`, Gap H5):**
  - Currently `muhurta` is marked `served: false` in `src/reading/chartData/catalog.ts:262`, even though `AIAstra_Radha/src/jhora/daily_export.py:616–635` (`_run_muhurta`) already computes the complete window suite.
  - Flipping `served: true` for `muhurta` and wiring a typed fetcher connects the full Radha `_run_muhurta` payload directly to `lucky.day_tables` and `lucky.avoid_bands`.
- **Full 30-Muhurta Windows & Extended Kalas (`daily_export.py:616–635`, Gap H5):**
  - Beyond basic Rahu/Yama/Gulikai/Abhijit, Radha's `_run_muhurta` computes **Godhuli**, **Vijaya Muhurta (Day/Night)**, **Nishita**, **30 Muhurtas of the day** (classified benefic/malefic), **Gauri Choghadiya** (*Amrit, Shubh, Labh, Char, Rog, Kaal, Udveg*), and **Panchaka Rahitha** windows.
  - Exposing these in `lucky.avoid_bands` lets high-precision windows verify whether an Abhijit or Amrita span overlaps a clean Choghadiya / 30-muhurta slot or hits a local Panchaka restriction.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:418`):**
  ```typescript
  [c('panchang', 'kalams'), c('panchang', 'muhurta')]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('panchang', 'stored day rows of the place (today −7 … today +14 / LUCKY_HORIZON_DAYS)', 'panchang_day')` — columns: `date`, `place`, `vara`, `tithi`, `nakshatra`, `yoga`, `karana`, `horas`, `avoid_bands`, `good_spans`, `tara`, `chandra_bala` (plus Priority #2 `muhurtas_30`, `choghadiya`, `godhuli`, `vijaya`).
- **Contract Output Schema:** `'day_bands.v1'` — deterministic timeline bands (`avoidBands[]`, `goodSpans[]`, `nowState`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Zero LLM synthesizer; consumed directly by the Lucky Times UI, Today card (`self.now`), and `lucky.<scenario>` (`lucky.scenarios.md`) to carve out forbidden time intervals before scoring candidate pieces.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Universal Prepull (`lucky.day_tables`):** Background job populates `day_tables` for the 5 reference timezone presets (`LUCKY_REFERENCE_PLACES`).
  2. **Deterministic Band Slicing (`lucky.avoid_bands`):** `avoidBands` and `nowState` execute synchronously inside `getRange` (`service.ts`) over stored `day_tables` JSON—zero live Radha calls and zero LLM calls.
  3. **Scenario & Limb Gating (`lucky.panchang_limbs`, `lucky.<scenario>`):** Avoided yoga/karana spans merge into the avoid-band cut list so no scenario window ever opens inside an avoid band.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'lucky.scenario_windows'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'lucky.avoid_bands'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (code-only, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Strict `< 5 ms` pure TypeScript interval arithmetic over Radha-computed sunrise/sunset and kalam timestamps.
  - If an interval's end time precedes its start time (e.g., nocturnal Varjyam/Durmuhurtam), Node reads the end as past midnight on the next civil day—zero astrological calculation performed in Node.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Displays clear, scannable daily traffic-light bands in the user's local timezone (e.g., *"Hold big decisions between 2:30 PM and 3:45 PM; clearest midday focus runs 11:42 AM – 12:26 PM."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on default card faces: *Rahu Kalam*, *Yamagandam*, *Gulikai*, *Durmuhurtam*, *Varjyam*, *Brahma Muhurta*, *Abhijit*, *Amrita Gadiya*, *Choghadiya*, *Panchaka Rahitha*, *Radha*, *pyjhora*.
  - Replaced with plain descriptions (*"Low-traction window"*, *"Clear midday peak"*, *"Quiet early-morning prep window"*).
- **Evidence Array Encapsulation:**
  - Exact classical band names live in `evidence[]` / `Why` sheet payloads:
    `['band.avoid:rahu_kalam:14:30-15:45', 'band.good:abhijit:11:42-12:26', 'band.good:amrita_gadiya:08:14-09:48']`.
- **One-Tap "Chart Details" (Why Sheet):** Reveals exact classical span names, sunrise/sunset anchors, and 30-muhurta / Choghadiya alignment.
- **Single Past-Event Calibration Question:** Not applicable (universal shared sky band lookup; no personal natal claim).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM tokens (`cacheStore: 'none_deterministic_code'`).
- **Findings & Output Persistence:**
  - Reads shared `day_tables(place_key, date_local)` (no person link, sealed under system key where applicable); derived scenario slices cached daily (`[00:00Z, 24:00Z)`) via `techniqueCacheKey`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (Group 7: Lucky Times, `recycledEvery45m: false` for shared sky `day_tables`).
- **RBAC & Data Privacy:**
  - User-requested range queries (`getRange`) enforce `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`) when overlaid with personal natal data, and emit `Cache-Control: private, no-store, no-cache, must-revalidate`.
  - Shared place sky payloads contain zero user PII.
