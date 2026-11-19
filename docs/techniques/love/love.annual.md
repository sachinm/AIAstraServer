# Technique Specification: This Year's Chart for Love (`love.annual`)

**Technique ID:** `love.annual`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts currentYear, annualLayer` (`src/reading/annual/tithiPravesha.ts runningTithiPravesha`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.annual` evaluates the user's current relationship year using the active **Tithi Pravesha (TP)** return chart (`tp_start <= now < tp_end`), keeping Varshaphala (`VP`) strictly as secondary confirmation. It inspects the year chart's 7th house and lord, *Vivaha* and *Preethi* Sahams (while flagging *Santapa* and *Paradara* Saham strain), and the bounded TP year dasha, contributing both a vote to the Love board's tone and a plain-language **"This year"** insight.

---

## 2. Untapped Radha Resources Mapped

Notice `src/techniques/catalog.ts:647` explicitly flags the special caveat: **`"Muntha, the year lord and Tajaka yogas are engine gaps"`**. Priority #2 from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` directly eliminates those gaps:

- **TP `yearLord` (*Vaaresha*) & Return Panchanga (Gap R1):**
  - `AIAstra_Radha/src/jhora/annual_export.py:736-746` omits `year_lord`, `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, and `karana` from `annual.tithi_pravesha`, and `AIAstra_Server/src/reading/digest/build.ts:1177` only parses `yearLord` for `kind === 'VP'`.
  - **Enhancement:** Export `_year_lord(ret_jd, ctx["place"])` and `return_instant.panchanga` in `annual_export.py`, and parse `yearLord` for `kind === 'TP'` in `build.ts`. This removes the `stance = 'get_through'` fail-closed bug in `dashaAssessment.ts:414-419` and lets `love.annual` grade annual partnership harmony via the true *Vaaresha*.
- **Dynamic TP Divisional Pulls — Annual `D9` & `D7` (`annual.tithi_pravesha`, Gap R4):** Flipping `served: true` on `annual.tithi_pravesha` and `annual.sahams` in `src/reading/chartData/catalog.ts:238-246` with `divisional_chart_factor=9` (and `7`) enables `love.annual` to verify the annual **TP D9** 7th house and Venus alongside TP D1.
- **TP Muntha, Sahams & Compressed 365-Day TP Vimshottari (Optional O3):** Supplies TP *Vivaha*, *Preethi*, *Santapa*, and *Paradara* sahams plus compressed 365-day TP Vimshottari alongside `tithi_ashtottari`.
- **Vimsopaka Bala on TP Year Lord (Gap H6):** Evaluates natal Vimsopaka strength of the TP *Vaaresha* and annual 7th lord.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:640, 663-667`)
```typescript
[
  c('annual', 'tithi_pravesha'),
  c('annual', 'sahams'),
  c('annual', 'mudda'),
  c('annual', 'patyayini'),
  c('annual', 'tithi_pravesha_dasha'),
  // Priority 2 additions: annual TP D9, TP year_lord, TP return panchanga
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:647`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `annual` | `TP and VP of the current, previous and next year, houses 7,5,11,2,4,8,12, their sahams and year dashas` | `annual_row` | Populated TP `year_lord`, TP `D9` rows, `muntha`, `Vivaha`/`Preethi`/`Santapa`/`Paradara` sahams |
| `planet` *(P2)* | `D1 and D9 cards of TP year_lord and annual 7th lord` | `planet_card` | `vimsopaka` and `D1+D9` confirmation of *Vaaresha* |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (annual verdict `confirms` | `amplifies` | `contradicts` | `silent`, shifting board confidence by one step without overriding natal promise alone + `"This year"` line).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.annual', claim, evidence, polarity, weight, about: 'love.year' }`:
  - Year 7th lord in kendra/trikona with dignity + *Vivaha/Preethi* sahams in kendra + strong *Vaaresha*: `support` (`+1.5 .. +2.5`).
  - Year 7th lord in `6/8/12` or *Santapa/Paradara* sahams in kendra: `test` (`-1.5 .. -2.5`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (`digest.annual_set` + `digest.build`)** pulls TP D1/D9 and sahams into `kundli_digest`. **Step 2 (`currentYear` -> `runningTithiPravesha` -> `annualLayer`)** runs deterministically inside `houseLayers.ts buildBoard`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `digest.annual_set` (Step 1), `area.love_board` (Step 2).
  - **Tagged `technique_id` (`withAgentRun`):** `love.annual` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'` / `'engine_pull'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript evaluation (`< 5 ms`). Zero LLM calls; zero Node astrological math (TP return moments, *Vaaresha*, sahams, and year-bounded dashas come strictly from Radha).
  - **Chronological Honesty:** Before this year's lunar *tithi* return instant, `runningTithiPravesha` strictly selects the prior year's TP chart (`tp_start <= local_now < tp_end`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Gives one clear annual relationship headline under `"This year"` (e.g., *"This annual cycle favors steady affection and shared family warmth, with thoughtful pacing around late autumn."*).
- **Jargon Redaction Rules:** Strictly strips *Tithi Pravesha*, *Varshaphala*, *Vaaresha*, *Muntha*, *Vivaha Saham*, *Preethi Saham*, *Santapa*, *Paradara*, *Mudda*, *Patyayini*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys inside `evidence[]` (e.g., `['annual:TP2026:D1', 'annual:TP2026:D9', 'tp:yearLord=Ve:dignified', 'saham:vivaha:h7', 'tp_dasha:tithi_ashtottari:Ju']`).
- **One-Tap "Chart Details":** Displays the active TP return window (`valid_from` to `valid_to`), the annual governor planet, and whether the annual layer confirms or tempers the main relationship trend.
- **Single Past-Event Calibration Question:** When a TP return boundary occurred within the past 90 days, supports a question checking whether relationship priorities shifted around that lunar month.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.year` and `lineman.love` in `love.reading.oracle` (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `kundli_digest` (`section: 'annual'`), `area_builds`, and `technique_outputs` (`freshness: 'annual'`, valid for `[tp_start, tp_end)`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `KundliDigest`, `AreaBuild`, `TechniqueOutput`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
