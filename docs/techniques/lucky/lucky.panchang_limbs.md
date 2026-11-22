# Technique Specification: The Five Limbs of the Day (`lucky.panchang_limbs`)

**Technique ID:** `lucky.panchang_limbs`  
**Category:** `self`  
**Board:** `lucky`  
**Status:** `built` (Priority #2 `muhurta` & `daily_grade` enhancement ready)  
**Owning Code Path:** `src/reading/luckyTimes/scenarios.ts` (`yogaAvoid`, `yogaFavour`, `karanaAvoid`, `karanaFavour`, `yogaName`, `karanaName`, `isAmritaSiddhi`); `src/reading/luckyTimes/windows.ts` (`dayLimbs`, `scenarioDay`); `src/reading/luckyTimes/service.ts` (`getRange`)  
**Agent ID:** `lucky.scenario_windows` (upstream: `lucky.day_tables`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`lucky.panchang_limbs` evaluates the five classical Panchanga limbs (**Vara**, **Tithi**, **Nakshatra**, **Yoga**, **Karana**) from each stored `day_tables` row to establish the general day-gate and limb bonus structure for every Lucky Times action. Using environment-configurable rule lists (`src/config/env.ts`) rather than hardcoded logic, it cuts out avoided Yoga (`Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti`) and Karana (`Vishti/Bhadra`, plus fixed karanas `Shakuni, Chatushpada, Naga`) spans like avoid bands—gating out an entire day when an avoided limb fills it—while rewarding favoured limbs (`Siddha`, `Kimstughna`, and `Amrita Siddhi` weekday+star pairs) with `+1` window scores.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `lucky.panchang_limbs`:

- **Engine-Provided Tithi Group & Star Group + Full-Day Limb Transition Spans (`muhurta` & `daily_grade`, Gap H5):**
  - As noted in `src/reading/luckyTimes/scenarios.ts:13` (`TODO(engine pass): the tithi and star group of a day should come from the engine`), Node currently maps `TITHI_GROUPS` and `STAR_GROUPS` via lookup tables over Radha's tithi/star numbers, and reads `panchanga_at_noon.yoga` / `.karana` with their end times.
  - Flipping `served: true` on `muhurta` (`catalog.ts:262`) and `daily_grade` (`catalog.ts:261`) and ingesting Radha `daily_export.py`'s exact sub-day limb spans (start/end instants for every Tithi, Nakshatra, Yoga, and Karana transition across the 24-hour day) allows `dayLimbs` to slice exact span windows (`yoga_avoid`, `karana_avoid`) down to the minute without noon-only approximation.
- **Dina Bala / Tribhaga Bala & Gauri Choghadiya (`daily_export.py:616–635`, Gap H5):**
  - Supplements the five Panchanga limbs with classical day/night Tribhaga planetary governors and Choghadiya quality tags inside the Why sheet.
- **Environment-Driven Rule Lists (`src/config/env.ts`, `GEMINI.md` Rule #1):**
  - Already reads `LUCKY_YOGA_AVOID`, `LUCKY_YOGA_FAVOUR`, `LUCKY_KARANA_AVOID`, `LUCKY_KARANA_FAVOUR`, `LUCKY_FIXED_KARANA_AVOID`, `LUCKY_FIXED_KARANA_FAVOUR`, and `LUCKY_AMRITA_SIDDHI_ENABLED` through typed env helpers with classical defaults.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:478`):**
  ```typescript
  [
    c('panchang', 'weekday'), c('panchang', 'tithi'), c('panchang', 'nakshatra'),
    c('panchang', 'yoga'), c('panchang', 'karana'), c('panchang', 'muhurta'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('panchang', "the place's day rows today −7 … today +14: vara, tithi, nakshatra, yoga, karana with end times", 'panchang_day')`
- **Contract Output Schema:** `'limbs.v1'` (with `synthesizer: 'lucky.avoid_bands'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Deterministic rule output consumed by `lucky.<scenario>`:
    - **Vara:** Weekday & lord matched against scenario `dayFavour` / `dayAvoid`; `isAmritaSiddhi(weekday, starNumber)` adds `+1` (`amrita_siddhi`).
    - **Tithi & Nakshatra:** Evaluated within their exact transition spans against scenario `tithiFavour/Avoid` and `starFavour/Avoid`.
    - **Yoga & Karana:** Avoided yoga/karana spans act as hard gates (`dayReason: 'yoga_avoid' | 'karana_avoid'`); favoured yoga adds `+1`; `Kimstughna` (`karanaBonus`) adds `+1` on auspicious beginnings. Personal marks (`lucky.personal_overlay`) never open a gated day.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Shared Prepull (`lucky.day_tables`):** Populates `day_tables` with Radha's limb names and transition timestamps.
  2. **Deterministic Limb Normalization (`lucky.panchang_limbs`):** `yogaName` / `karanaName` normalize Radha spelling variants (`soubhagya` -> `Saubhagya`, `vishtibhadra` -> `Vishti`) using `SPELLING` in `scenarios.ts:70`, and `dayLimbs` computes active limb intervals and hard gates.
  3. **Scenario Evaluation (`lucky.<scenario>`):** Consumes `limbs.v1` + `avoid_bands` + `personal_overlay` in `< 10 ms`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'lucky.scenario_windows'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'lucky.panchang_limbs'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code evaluation, `0` LLM calls).
- **Execution Boundary & Runtime Limits:**
  - Pure TypeScript rule-table evaluation (`< 5 ms`).
  - Zero Node astrological calculation: Node never computes lunar/solar elongation for Tithis, Yogas, or Karanas—it only matches engine-returned names and numbers against configurable `src/config/env.ts` lists.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Explains day gates in clear, everyday scheduling terms (e.g., *"Today carries mixed background timing until 1:15 PM—save routine prep for morning and schedule key outreach later."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on default card faces: *Vara*, *Tithi*, *Rikta*, *Nanda*, *Amavasya*, *Vishti*, *Bhadra*, *Vyatipata*, *Vaidhriti*, *Kimstughna*, *Amrita Siddhi*, *Shakuni*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Classical limb names and end hours ride cleanly inside `evidence[]` and the expandable Why sheet:
    `['limb.tithi:Dashami(purna)', 'limb.star:Pushya(quick)', 'limb.yoga:Siddha:+1(until 16:40)', 'limb.karana:Vishti:gated_out(until 13:15)']`.
- **One-Tap "Chart Details" (Why Sheet):** Surfaces the exact five limbs of the day, their transition end hours, and whether an Amrita Siddhi or avoided Yoga/Karana span affected the day gate.
- **Single Past-Event Calibration Question:** Not applicable (daily calendar limb lookup).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM tokens (`cacheStore: 'none_deterministic_code'`).
- **Findings & Output Persistence:**
  - Backed by shared `day_tables(place_key, date_local)` and daily `technique_outputs` (`techniqueCacheKey(..., daily [00:00Z, 24:00Z))`).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (Group 7: shared limb tables persist; user-scoped scenario outputs follow daily/individual cache cleanup).
- **RBAC & Data Privacy:**
  - User-scoped range requests enforce `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`) and return `Cache-Control: private, no-store, no-cache, must-revalidate`.
  - Zero PII stored in shared `day_tables` limb records.
