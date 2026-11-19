# Technique Specification: Job Security by Month (`work.security_grade`)

**Technique ID:** `work.security_grade`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts securityGrade` (invoked by `presentState` and `careerMap`)  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.security_grade` evaluates monthly employment stability over the current month and the next 12 months, assigning one of five grounded grades (`clear_protected`, `clear`, `watch`, `risk`, or `high_risk`). It protects users from alarmist predictions by gating `risk`/`high_risk` flags strictly on whether an active driver planet is a classical career end-lord (`5, 9, 6, 8, 12`) or malefic anchor (`Sa, Ra, Ke`) during a testing month.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` sharpens `work.security_grade` from binary house-lord matching to true classical resilience scoring:

- **Harsha Bala (`strength.harsha`, Gap H6):** `strength.harsha` in `src/reading/chartData/catalog.ts:199` is currently `served: false`, despite `_build_harsha` (`AIAstra_Radha/src/jhora/natal_export.py:311-321`) computing the 20-point trik-house stamina score. Harsha Bala measures whether a planet placed in the 6th, 8th, or 12th house thrives under pressure (overcoming office politics, restructuring, or competition) rather than collapsing. Unlocking it prevents false `high_risk` alarms when a `6/8/12` end-lord carries strong Harsha Bala (`>= 15/20`).
- **Bhava Bala (`strength.bhava`, Gap H6):** Flipping `served: true` on `strength.bhava` (`catalog.ts:197`) supplies `bhavadhipati`, `dig`, and `drik` strength ranks for houses `10, 9, 5, 6, 8, 12`, quantifying whether the 10th house is structurally resilient against a transient `6/8/12` test.
- **D10 Dashamsha Structural Enrichment (`varga.d10`, Gaps R2 / R3):** Adding explicit `house` (1..12), `lord`, and `dignity` to `varga.d10` lets `securityGrade` check whether a D1 end-lord (`6, 8, 12`) is actually well-placed (`kendra`/`trikona` or dignified) in `D10`, softening career disruption into role transition.
- **Transit Ashtakavarga (`transit_ashtakavarga`, Gap H5):** Provides natal SAV points and Kakshya `has_bindu` validation for Saturn/Rahu/Ketu transits over houses `10, 6, 8, 12`, distinguishing real structural strain (low BAV `<= 2` and missing kakshya bindu) from manageable workload spikes.
- **Tithi Pravesha `yearLord` & Annual D10 (Gaps R1 / R4):** Supplies the annual *Vaaresha* and TP 10th/6th/8th house state so annual protective factors (`clear_protected`) are not suppressed by a fail-closed `get_through` stance.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:94-104`)
```typescript
[
  c('dasha', 'vimshottari'),
  c('dasha', 'yogini'),
  c('dasha', 'tithi_ashtottari'),
  c('dasha', 'narayana'),
  c('transit', 'transit_contacts'),
  c('transit', 'double_transit'),
  c('jaimini', 'modifier'),
  c('natal', 'house_counts'),
  c('natal', 'facts'),
  // Priority 2 additions:
  // c('natal', 'strength.harsha'), c('natal', 'strength.bhava'), c('divisional', 'D10'), c('ashtakavarga', 'transit_ashtakavarga')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:165`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1 houses 10,9,5,6,8,12 and their lords` | `house_card` | `bhava_bala` rank/ratio for `10, 6, 8, 12` + `D10` mirror houses |
| `activation` | `families S1, S4, S2+S3, S6/S6D, S7 ±24 months` | `activation_row` | Running driver lords across Vimshottari, Narayana, Yogini, Tithi Ashtottari |
| `transit` | `contacts and double transit on houses 10,6,1 and their lords ±24 months` | `transit_row` | `transit_ashtakavarga` BAV/Kakshya bindus on transiting `Sa, Ra, Ke` |
| `planet` *(P2)* | `D1,D10 cards of end lords (5,9,6,8,12) and Sa, Ra, Ke` | `planet_card` | `harsha_bala` (0..20) and `D10` `house` + `dignity` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `career_map.v1` (`security: SecurityGrade` per month on `PresentState` and `job_security` sub-area windows).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'work.security_grade', claim, evidence, polarity, weight, about: 'work.job_security' }`:
  - `clear_protected`: `+2.0` (`support`); `clear`: `+0.5` (`support`); `watch`: `-0.5` (`neutral/caution`); `risk`: `-2.0` (`test`); `high_risk`: `-3.0` (`test`).
  - Note: Hidden automatically by `careerService.ts fitsStatus` when `work.status` is `between_jobs`, `studying`, or `own_business`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `career.ts presentState` and `careerMap` (`ahead` `job_security` windows).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.security_grade` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript lookup and threshold rule evaluation (`< 15 ms` across 13 monthly cells). Zero LLM calls; zero Node astrological math (end-lord resolution reads `D1.h5/h9/h6/h8/h12` `lord` fields from Radha's `house_counts` / `digest`).
  - **Safety Guard:** `work.reading.struggle` and `work.reading.ground` explicitly forbid raw "layoff/firing" verdicts; `work.security_grade` gates risk bands purely on stored driver planets and `harsha_bala`/`bhava_bala` counters.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Plain, non-alarmist guidance scaled to the grade (e.g., for `watch`: *"Pace commitments carefully this month; avoid unnecessary friction with leadership while routines settle."* For `clear_protected`: *"Your standing is well cushioned right now, making this a steady period to focus on core deliverables."*).
- **Jargon Redaction Rules:** Never exposes *Dusthana*, *Trik*, *Harsha Bala*, *Bhava Bala*, *Maraka*, *Ashtakavarga*, *End Lord*, or internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Technical basis stored strictly in `evidence[]` (e.g., `['security:watch', 'driver:Sa:h8_lord', 'harsha:Sa:15/20:resilient', 'd10:h10:sav30']`).
- **One-Tap "Chart Details":** Displays the 13-month stability strip, the active period driver, and whether protective factors cushion the testing phase.
- **Single Past-Event Calibration Question:** When a `risk` or `high_risk` window appears in the trailing 12 months (`work.looking_back`), asks one concrete confirmation question (e.g., *"Was there a reorganization or sudden shift in team stability around June?"*).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). When passed to `work.reading.oracle`, the pre-computed `security_grade` summary rides in `lineman.work`'s input brief while the immutable natal/D10/Harsha slice sits in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored inside `area_builds` (`area: 'career'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, and monthly validity window).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; reads invoke `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges stale rows after 45 minutes of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest in `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
