# Technique Specification: Shared Day Tables Per Place (`lucky.day_tables`)

**Technique ID:** `lucky.day_tables`  
**Category:** `self`  
**Board:** `lucky`  
**Status:** `built` (Priority #2 `muhurta` & `daily_grade` prepull upgrade ready)  
**Owning Code Path:** `src/reading/luckyTimes/service.ts` (`pullDayTables`, `prepullUniversalDayTables`); `src/reading/luckyTimes/places.ts` (`DAY_TABLE_PLACES`, `resolvePlacePreset`)  
**Agent ID:** `lucky.day_tables` (downstream: `lucky.avoid_bands`, `lucky.panchang_limbs`, `lucky.<scenario>`)  
**Accuracy Check:** `none` (shared sky infrastructure)

---

## 1. Executive Summary & Purpose

`lucky.day_tables` implements the zero-LLM, shared-sky prepull layer for Lucky Times (`GEMINI.md` Rule #2). Instead of querying the astrological engine per user, it deterministically pre-pulls missing day rows across the 5 configured reference timezone places (`LUCKY_REFERENCE_PLACES`: `us-east`, `us-central`, `us-mountain`, `us-west`, `in-ist`) over the universal horizon (`LUCKY_HORIZON_DAYS`, default 28 days ahead, plus `today -7 … today +14`), stamping each `day_tables` row with its `calc_version` and payload hash so every user in a timezone shares one cached sky table.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `lucky.day_tables`:

- **Enabling `muhurta` in Server Catalog (`chartData/catalog.ts:262`, Gap H5):**
  - Flipping `muhurta` from `served: false` to `served: true` aligns the catalog contract with `AIAstra_Radha/src/jhora/daily_export.py:616–635` (`_run_muhurta`), ensuring `pullDayTables` ingests the full upgraded payload:
    - Sunrise/Sunset, Brahma Muhurta, Abhijit, Rahu Kalam, Yamagandam, Gulikai, Durmuhurtam, Varjyam, Amrita Gadiya.
    - **30 Muhurtas of the day**, **24 planetary Horas**, **Gauri Choghadiya**, **Godhuli**, **Vijaya Muhurta**, **Nishita**, and **Panchaka Rahitha**.
- **Full-Day Panchanga Limb Transitions & End Times (`daily_export.py`, Gap H5):**
  - Upgrading `day_tables` ingestion to store multi-limb transition timestamps (when Tithi, Nakshatra, Yoga, or Karana changes mid-day rather than noon-only) directly unblocks sub-day window precision in `lucky.panchang_limbs` and `lucky.<scenario>`.
- **Environment-Driven Prepull Config (`src/config/env.ts`, `GEMINI.md` Rule #1):**
  - Externalizes `LUCKY_HORIZON_DAYS` (28), `LUCKY_PREPULL_DAYS`, and `LUCKY_REFERENCE_PLACES` (`us-east`, `us-central`, `us-mountain`, `us-west`, `in-ist`) so operational horizons can expand without code edits.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:459`):**
  ```typescript
  [c('panchang', 'muhurta')]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('panchang', 'reference timezone place preset (us-east, us-central, us-mountain, us-west, in-ist) and date window (today -7 … today +LUCKY_HORIZON_DAYS)', 'panchang_day')`
- **Contract Output Schema:** `'day_tables.v1'` — persisted relational rows in `day_tables` (`place_key`, `date_local`, `calc_version`, `payload_hash`, `payload`).
- **Oracle Synthesis Payload (`findings_in`):**
  - None (infrastructure data producer). Consumed directly by `lucky.avoid_bands`, `lucky.panchang_limbs`, `lucky.scenarios`, and Today (`self.now`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Scheduled Universal Prepull (`prepullUniversalDayTables`):** Runs via background sweep/cron for the 5 `DAY_TABLE_PLACES`, identifying missing dates in `[today - 7, today + LUCKY_HORIZON_DAYS]` and calling Radha `muhurta` deterministically per missing month/place (zero LLM tokens).
  2. **On-Demand Place Fallback (`pullDayTables`):** If a user queries a custom location outside the 5 presets (`resolvePlacePreset`), pulls only missing months for that place key and persists them to `day_tables`.
  3. **Request-Path Read (`getRange`):** Reads pre-warmed rows from PostgreSQL in `< 10 ms`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'lucky.day_tables'` (kind: `'engine_pull'`, `engineType: 'muhurta'`).
  - **Tagged `technique_id` (`withAgentRun`):** `'lucky.day_tables'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic engine pull, `0` LLM calls).
- **Execution Boundary & Runtime Limits:**
  - Radha HTTP call timeout bounded per month batch (`<= 10 s`); zero live Radha calls during normal preset dashboard opens once prepull succeeds.
  - Zero Node astrology: sunrise, hora boundaries, kalams, and panchanga limbs are persisted verbatim from Radha.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Invisible infrastructure; powers instant (`< 100 ms`) loading of Lucky Times calendars without waiting on external engine latency.
- **Jargon Redaction Rules:**
  - Raw `day_tables` JSON fields (`rahu_kalam`, `yamagandam`, `tithi`, `karana`, `choghadiya`) are never rendered verbatim on consumer card faces; downstream techniques translate them into plain English or encapsulate them in `evidence[]`.
  - Internal names (`Radha`, `pyjhora`, `jhora`) never leave the server.
- **Evidence Array Encapsulation:**
  - Provides canonical payload hashes and `calc_version` stamps referenced by downstream `day_tables` evidence keys (e.g., `day_table:in-ist:2026-11-17:v2`).
- **One-Tap "Chart Details":** Downstream techniques expose the place preset, timezone offset, and sunrise/sunset anchor from `day_tables`.
- **Single Past-Event Calibration Question:** Not applicable (shared astronomical calendar table).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM usage (`cacheStore: 'none_deterministic_code'`).
- **Findings & Output Persistence:**
  - Persisted in `day_tables(place_key, date_local)` with `calc_version` and `payload_hash` deduplication (`recycledEvery45m: false` since sky tables are shared across all users in a timezone and reused for the 28-day horizon).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (Group 7: shared sky `day_tables` persist across the horizon; only per-individual downstream overlay caches are subject to the 45-minute `recycleIndividualCaches` sweep).
- **RBAC & Data Privacy:**
  - `day_tables` holds public astronomical almanac data per preset place (zero user PII).
  - User-facing endpoints querying ranges or custom user locations enforce `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`) and return `Cache-Control: private, no-store, no-cache, must-revalidate`.
