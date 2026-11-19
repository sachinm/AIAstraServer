# Technique Specification: This Year's Chart — Annual Family (`work.annual_family`)

**Technique ID:** `work.annual_family`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts workAnnualVote, presentState`; `src/reading/area/careerService.ts getCareer`; `src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.annual_family` casts the **Annual Family** vote (`support`, `test`, or `neutral`) for `work.present_tone` using the active **Tithi Pravesha (TP)** solar-lunar return chart (`tp_start <= now < tp_end`). It evaluates the TP year chart's 10th, 6th, and 1st houses, the *Rajya* and *Karma* Sahams, and the bounded TP year dasha lord covering the current month — ensuring annual career timing reflects the Vedic *tithi* return rather than a Western calendar birthday or Varshaphala substitution.

---

## 2. Untapped Radha Resources Mapped

`work.annual_family` is the technique most directly unblocked by Priority #2 Tithi Pravesha fixes in `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`:

- **TP `yearLord` (*Vaaresha*) & Return Panchanga (Gap R1):**
  - Currently `AIAstra_Radha/src/jhora/annual_export.py:736-746` (`run_annual`) omits `year_lord`, `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, and `karana` from `annual.tithi_pravesha`, even though `AIAstra_Radha/src/jhora/pressure_inventory_export.py:572-582` already implements `_year_lord(jd, place)`.
  - Simultaneously, `AIAstra_Server/src/reading/digest/build.ts:1177-1196` only parses `yearLord` when `kind === 'VP'` (Varshaphala), leaving `AnnualRow.yearLord` `undefined` for `kind === 'TP'` and causing `src/reading/dasha/dashaAssessment.ts:414-419` to fail closed to `stance = 'get_through'`.
  - **Enhancement:** Export `year_lord` and `return_instant.panchanga` in Radha `annual_export.py` and parse `yearLord` for `kind === 'TP'` in `digest/build.ts` to restore accurate `build` vs `get_through` annual votes.
- **Dynamic TP Divisional Pulls — Annual `D10` (`annual.tithi_pravesha` `divisional_chart_factor=10`, Gap R4):** `src/reading/chartData/catalog.ts:238-246` currently marks `annual.tithi_pravesha`, `annual.varsha`, `annual.sahams`, `annual.mudda`, `annual.patyayini`, and `annual.tajaka` as `served: false`. Enabling `served: true` with `divisional_chart_factor=10` allows `work.annual_family` to read the **TP D10** chart alongside TP D1 when grading houses `10, 6, 1, 2, 11`.
- **TP Compressed 365-Day Vimshottari & TP Sahams (Optional O3):** Adds compressed TP Vimshottari alongside `tithi_ashtottari`, `mudda`, and `patyayini`, plus explicit TP `rajya` and `karma` sahams.
- **Vimsopaka & Bhava Bala on TP Year Lord (Gap H6):** Evaluates natal Vimsopaka strength of the TP *Vaaresha* so a strong natal *Vaaresha* elevates annual career support.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:241`)
```typescript
[
  c('annual', 'tithi_pravesha'),
  c('annual', 'tithi_pravesha_dasha'),
  c('annual', 'mudda'),
  c('annual', 'patyayini'),
  c('annual', 'sahams'),
  c('divisional', 'D10'),
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:253`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `annual` | `the running TP year (tp_start ≤ now < tp_end), D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; TP year dasha running this month when bounded to the year` | `annual_row` | Populated `year_lord` (*Vaaresha*), TP `D10` houses, TP `panchanga` limbs |
| `planet` *(P2)* | `D1,D9,D10 cards of TP year_lord and running TP dasha lord` | `planet_card` | Natal `vimsopaka` and `D1+D9` confirmation of *Vaaresha* (age > 36) |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `family_vote.v1` (`{ family: 'annual', label: "This year's chart", vote: 'support' | 'test' | 'neutral', planet: string | null }`), synthesized by `work.present_tone`.
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'work.annual_family', claim, evidence, polarity, weight, about: 'work.year' }`:
  - `support` (TP `h10/h6/h1` lords in kendra/trikona without debility, *Rajya/Karma* sahams in kendra, strong *Vaaresha*): weight `+1.5 .. +2.5`.
  - `test` (TP career lords in dusthana/debilitated or weak *Vaaresha*): weight `-1.5 .. -2.5`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (`digest.annual_set` + `digest.build`)** pre-pulls TP D1/D10 charts and parses `AnnualRow` into `kundli_digest`. **Step 2 (`workAnnualVote`)** executes deterministically inside `career.ts presentState`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `digest.annual_set` (Step 1 engine pull), `area.career_map` (Step 2 vote).
  - **Tagged `technique_id` (`withAgentRun`):** `work.annual_family` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'` for vote; `kind: 'engine_pull'` for annual pull).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript evaluation over stored `AnnualRow`s (`< 5 ms`). Zero LLM calls; zero Node astrological math (Node never derives TP return dates, *Vaaresha*, or compressed dasha bounds — it reads `tp_start`, `tp_end`, `year_lord`, and bounded `dashas[]` directly from Radha).
  - **TP Boundary Rule:** Before the current year's TP return instant, `runningTithiPravesha` strictly selects the *previous* year's TP chart (`tp_start <= local_now < tp_end`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Surfaces an annual career posture note integrated into `work.present_tone` and `work.reading.year` (e.g., *"Your current annual cycle favors visible leadership and steady project expansion through October."*).
- **Jargon Redaction Rules:** Never prints *Tithi Pravesha*, *Vaaresha*, *Varshaphala*, *Mudda*, *Patyayini*, *Rajya Saham*, *Karma Saham*, *Hora*, *Dusthana*, or internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured audit keys in `evidence[]` (e.g., `['annual:TP2026:D1', 'annual:TP2026:D10', 'tp:yearLord=Ju:dignified', 'saham:rajya:h10', 'tp_dasha:tithi_ashtottari:Me']`).
- **One-Tap "Chart Details":** Reveals the active TP year date window (`valid_from` to `valid_to`), the annual governor planet, and whether the annual D10 career house confirms D1.
- **Single Past-Event Calibration Question:** When the annual cycle shifted within the past 90 days, pairs with a confirmation prompt around the TP return month (e.g., *"Did your overall career direction or responsibility level shift around late October?"*).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.year` and `lineman.work` in `work.reading.oracle`, where the annual chart slice is passed inside the cached family pack (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Stored `AnnualRow`s live in `kundli_digest` (`section: 'annual'`); annual vote results cache inside `area_builds` and `technique_outputs` (`freshness: 'annual'`, bounded by `[tp_start, tp_end)`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; reads invoke `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `KundliDigest`, `AreaBuild`, and `TechniqueOutput` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
