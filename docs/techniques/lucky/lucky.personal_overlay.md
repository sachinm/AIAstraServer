# Technique Specification: Personal Overlay — Tara, Chandra Bala & Chart Marks (`lucky.personal_overlay`)

**Technique ID:** `lucky.personal_overlay`  
**Category:** `self`  
**Board:** `lucky`  
**Status:** `built` (Priority #2 `daily_grade` & `transit_ashtakavarga` unlock ready)  
**Owning Code Path:** `src/reading/luckyTimes/service.ts` (`personalDays`, `LuckyDeps`); `src/reading/luckyTimes/wiring.ts`; `src/reading/luckyTimes/windows.ts` (`personalScore`, `scenarioDay`)  
**Agent ID:** `lucky.day_overlay` (upstream: `kundli_digest`, `kundli_activation`; downstream: `lucky.<scenario>`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`lucky.personal_overlay` personalizes the shared daily sky (`lucky.day_tables`) to an individual's birth chart without ever running an LLM. Once per month and place, it pulls engine-computed **Janma Tara Bala** (1–9), **Chandra Bala** (1–12 from natal Moon), and **Daily Grade** into `kundli_day_overlays`, and layers on the **hora lord's D1 functional nature** (benefic `+1` / malefic `-1`) plus **running dasha lord overlap** (tithi lord or star lord matching an active period lord `+1`). Crucially, personal marks shift a candidate window's score (`±1`) but never unlock a day gated out by general avoid bands or unfavorable panchang limbs.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `lucky.personal_overlay`:

- **Enabling `daily_grade` (`daily_export.py:429–450`, Gap H5):**
  - Currently `daily_grade` is marked `served: false` in `src/reading/chartData/catalog.ts:261`.
  - `_run_daily_grade` computes daily Moon position, Tara Bala (`Janma, Sampat, Vipat, Kshema, Pratyak, Sadhana, Naidhana, Mitra, Parama Mitra`), Chandra Bala (`house_from_moon`), combined day grade (`good | neutral | avoid`), and day transition events.
  - Flipping `served: true` provides standardized, batchable daily personal verdicts for `kundli_day_overlays`.
- **Enabling `transit_ashtakavarga` with Kakshya Bindus (`daily_export.py:703–765`, Gap H5):**
  - Currently marked `served: false` in `src/reading/chartData/catalog.ts:263`.
  - `run_transit_ashtakavarga` computes each moving planet's BAV in the transited sign, house SAV, and **Kakshya** (`1..8`, $3^\circ 45'$ sub-division ruled by Saturn..Lagna) with `has_bindu: boolean`.
  - Elevates `personalScore`: an auspicious hora lord (e.g., Jupiter or Mercury) gains an extra personal confirmation mark when the transiting hora lord currently sits in a `has_bindu === true` Kakshya, and is tempered when in a `0-bindu` Kakshya!
- **Pancha Pakshi Shastra (`panchanga/pancha_paksha.py`, Gap O2):**
  - Five-bird biorhythm system (*Vulture, Owl, Crow, Cock, Peacock*) computing personal micro-states (`Ruling`, `Eating`, `Walking`, `Sleeping`, `Dying`) in ~30–144 minute diurnal/nocturnal slots—providing ultra-granular personal energy overlays without any Node math.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:438`):**
  ```typescript
  [
    c('panchang', 'muhurta'), c('nakshatra', 'tara'), c('panchang', 'chandra_bala'),
    c('transit', 'daily_grade'), c('transit', 'transit_ashtakavarga'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('panchang', "person's day overlay rows (tara, chandra bala, daily grade, transit_ashtakavarga kakshya) for the range", 'panchang_day')`
  - `inp('planet', 'D1 cards of the seven hora lords (nature column: functional benefic/malefic)', 'planet_card')`
  - `inp('activation', 'periods running on each day, every system', 'activation_row')`
- **Contract Output Schema:** `'day_overlay.v1'` — per-day personal score modifiers (`taraDelta`, `chandraDelta`, `horaNatureDelta`, `dashaOverlapDelta`, `kakshyaBinduDelta`, `pakshiState`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Zero LLM calls. Deterministic modifier payload consumed by `scenarioDay` (`windows.ts`):
    - Tara good/bad: `+1 / -1`
    - Chandra Bala good/bad: `+1 / -1`
    - Hora lord functional benefic/malefic (when `kundli_digest` is ready): `+1 / -1`
    - Tithi lord or star lord matches running dasha lord: `+1`
    - Priority #2 Kakshya `has_bindu` on hora lord: `+1 / 0`
    - **Invariant:** Personal marks *never* override a general day gate (`yoga_avoid`, `karana_avoid`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Monthly/Place Pre-pull (`lucky.personal_overlay`):** `personalDays` calls Radha `muhurta` / `daily_grade` / `transit_ashtakavarga` once per month and place with birth fields, storing rows in `kundli_day_overlays`.
  2. **Digest & Activation Lookup (`wiring.ts`):** `LuckyDeps.functionalNatureOf` reads D1 `planet_card` nature (omits mark cleanly if digest is not ready yet), and `LuckyDeps.runningDashaLordsOf` reads `kundli_activation`.
  3. **Live Window Scoring (`windows.ts`):** `personalScore` applies deltas inside `scenarioDay` in `< 5 ms`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'lucky.day_overlay'` (engine pull) and `'lucky.scenario_windows'` (scoring).
  - **Tagged `technique_id` (`withAgentRun`):** `'lucky.personal_overlay'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic + engine pull, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Monthly overlay pull occurs asynchronously or read-through once per `(kundliId, placeKey, YYYY-MM)`; cached reads take `< 5 ms`.
  - Zero Node astrological calculation: Tara count, Chandra Bala house, Kakshya bindus, and functional nature are never computed in TypeScript.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Surfaces personal alignment cleanly as practical readiness cues (e.g., *"Today's afternoon slot aligns especially well with your personal rhythm and current focus."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Tara Bala*, *Vipat*, *Naidhana*, *Chandra Bala*, *Hora*, *Functional Malefic*, *Ashtakavarga*, *Kakshya*, *Bindu*, *Pancha Pakshi*, *Dasha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Personal marks live inside `evidence[]` / Why sheet tags:
    `['overlay.tara:kshema:+1', 'overlay.chandra:h11:+1', 'overlay.hora_nature:Ju.benefic:+1', 'overlay.kakshya.Ju:has_bindu:+1']`.
- **One-Tap "Chart Details" (Why Sheet):** Shows how the user's birth Moon alignment, current chapter lord match, and planetary hour support or dampen the day's general score.
- **Single Past-Event Calibration Question:** Optional calibration check if a high-scoring day felt unexpectedly flat: *"Did external timing delays slow things down around [date] even though your personal focus felt steady?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM tokens (`cacheStore: 'none_deterministic_code'`).
- **Findings & Output Persistence:**
  - Stored in `kundli_day_overlays(kundli_id, place_key, date_local)` and daily `technique_outputs` (`techniqueCacheKey(..., daily [00:00Z, 24:00Z))`).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (Group 7: `recycledEvery45m: true` for personal overlays).
  - Live reads call `informIndividualCacheUsed({ userId, kundliId })`; inactive derived overlay caches recycle after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Strictly enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest`, `TechniqueOutput`, and personal overlay payloads are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
