# Technique Specification: Windows Ahead by Sub-Area (`work.subarea_windows`)

**Technique ID:** `work.subarea_windows`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts careerMap (ahead), careerSubareas` & `src/reading/area/careerService.ts fitsStatus`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.subarea_windows` classifies every upcoming timeline window (from the start of the current month up to +24 months ahead) into seven concrete career sub-areas: `get_job`, `job_change`, `promotion`, `job_security`, `abroad`, `pay`, and `business`. It filters those sub-areas through the user's confirmed work status (`work.status` via `fitsStatus`) so an employed user is never shown "getting a job" cards and a founder sees business windows instead of promotion ladders.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` improves sub-area discrimination, financial accuracy, and long-horizon reliability:

- **Divisional Chart Structural Enrichment (`varga.d10`, `varga.d11`, `varga.d4`, `varga.d12`, Gaps R2 / R3):**
  - `D10` explicit `house` (1..12) and `dignity` sharpen `promotion` and `job_change` classification when the 10th lord or `Ghati Lagna` lord activates `D10` kendras/trikonas.
  - Unlocking `D11` (Rudramsha / gains) and `D2` (Hora) with explicit `house` and `lord` fields strengthens `pay` windows beyond `D1` 2nd/11th house markers alone.
  - Unlocking `D4` (Chaturthamsha) and `D12` residence/relocation links strengthens `abroad` sub-area windows alongside 9th/12th lord and Rahu drivers.
- **Transit Ashtakavarga (`transit_ashtakavarga`, Gap H5):** Validates `promotion`, `pay`, and `business` support windows by checking whether Jupiter/Saturn transits over houses `10, 11, 2, 7` occupy a kakshya with a bindu (`has_bindu: true`), preventing false peak scores on weak transits.
- **Bhava Bala & Vimsopaka Bala (`strength.bhava`, `strength.vimsopaka`, Gap H6):** Quantifies the relative potency of houses `2, 11` (`pay`), `4` (`abroad` / residence), `7` (`business`), and `10` (`promotion`) and their lords across vargas so overlapping windows are ranked accurately.
- **Harsha Bala (`strength.harsha`, Gap H6):** Calibrates `job_security` peak-month grades when 6th/8th/12th drivers carry high trik stamina.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Essential for the +24 month lookahead (`careerSpan`), ensuring exact Saturn, Jupiter, Rahu, and Ketu degree contacts on natal `10th`, `11th`, `2nd`, `7th`, and `12th` lords do not go blind after 2026.

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
  // c('divisional', 'D10'), c('divisional', 'D2'), c('divisional', 'D4'), c('divisional', 'D11'),
  // c('ashtakavarga', 'transit_ashtakavarga'), c('natal', 'strength.bhava'), c('natal', 'strength.vimsopaka')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:189`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D10 houses 10,6,1,2,11` | `house_card` | Explicit `D10` `house`, `lord`, `lord_dignity`, `sav`, `bhava_bala` |
| `house` | `D1 houses 2,11 (money), 4 (residence), 7 (business) and their lords` | `house_card` | Augmented with `D2`, `D4`, `D11` explicit `house_card` rows |
| `activation` | `families S1, S4, S2+S3, S6/S6D, S7 ±24 months` | `activation_row` | Multi-clock period rows with `D1/D10` lordship tags |
| `transit` | `contacts and double transit on houses 10,6,1 and their lords ±24 months` | `transit_row` | Kakshya `bindus`, Vedha obstruction flag, 2027–2036 exact contacts |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `career_map.v1` (`subareas: SubareaWindow[]` sorted by start date, then `get_job`, `job_change`, `promotion`, `job_security`, `abroad`, `pay`, `business`, each carrying `{ subarea, side, from, to, peak_month, band, score, families, drivers }`).
- **Synthesis Payload (`findings_in`):** Supplies dated sub-area claims to `work.reading.oracle` (`lineman.work`):
  - `support` windows (`promotion`, `job_change`, `pay`, `business`, `abroad`, `get_job`) emit polarity `'support'` with weight `+1.0 .. +3.0` scaled by band (`strong`/`moderate`/`possible`) and Kakshya bindu confirmation.
  - `job_security` testing windows emit polarity `'test'` with weight `-1.0 .. -3.0` scaled by `securityGrade`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** in `career.ts careerMap` + read-time filtering in `careerService.ts fitsStatus`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_inputs`, `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.subarea_windows` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript window grouping and sorting (`< 50 ms`). Zero LLM calls; zero astrological computation in Node (Ghati Lagna lord, Narayana signs, house lords, and transit contact dates are read verbatim from Radha/digest rows).
  - **Personalization Gate:** `fitsStatus` reads `person_facts` (`work.status` in `['yes', 'between_jobs', 'own_business', 'studying']` or `null`) at read time so the shared `area_builds` payload never leaks mismatched sub-areas to the UI.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Presents clean, dated timeline cards per relevant sub-area (e.g., **Advancement Window · Apr 12 – Jun 28**: *"Recognition for steady execution builds during late spring; aim for promotion conversations or formal reviews before late June."*).
- **Jargon Redaction Rules:** Removes *Ghati Lagna*, *Narayana*, *Dashamsha*, *Rudramsha*, *Chaturthamsha*, *Kakshya*, *Rahu*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys stored in `evidence[]` (e.g., `['subarea:promotion:2027-04-12..2027-06-28', 'driver:Su:L10', 'd10:h10:bhava_rank2', 'kakshya:Ju:bindu1']`).
- **One-Tap "Chart Details":** Reveals the peak month, contributing timing families, driver planets, and band score (`score` to 1 decimal place).
- **Single Past-Event Calibration Question:** When the user's `work.status` is unknown (`null`), asks a single one-tap profile question (*"What best describes your current work situation?"*) before showing status-gated sub-areas.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Downstream `work.reading.oracle` reuses the immutable natal/D10/D11/D2 digest prefix in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `area_builds` (`area: 'career'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, and monthly validity window). `work.status` personalization runs dynamically on read without invalidating the chart cache.
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) sweeps inactive rows after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `PersonFact`, and `KundliDigest` are sealed at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
