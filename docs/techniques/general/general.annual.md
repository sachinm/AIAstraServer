# Technique Specification: Annual Set Analyst (`general.annual`)

**Technique ID:** `general.annual`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 TP `yearLord`, panchanga, & dynamic annual varga fixes critical)  
**Owning Code Path:** `src/reading/nodes/specialists.ts`; `src/reading/packs/selector.ts` (`ANALYST_SECTIONS.annual`); `src/reading/packs/digestSource.ts` (`annualFromDigest`); `src/reading/annual/tithiPravesha.ts` (`runningTithiPravesha`); `src/reading/prompts/annual.md`  
**Agent ID:** `reading.analyst.annual` (subagent slices: `specialist:annual`, `code:annual`, `R11`; downstream: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.annual` is selected in the General Reading flow for all near-term horizons within 24 months (`now`, `3m`, `6m`, `1y`, `custom`). It evaluates the previous, running (`tp_start <= now < tp_end`), and next **Tithi Pravesha (TP)** annual charts across `D1`, `D9`, and `D10`—plus Varshaphala (`VP`), Mudda, Patyayini, Muntha, Sahams, and Tajaka yogas strictly as secondary confirmation—to pin down annual focus, year-lord support, and month-level timing inside the user's question horizon.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` resolve critical blind spots in `general.annual`:

- **Tithi Pravesha `yearLord` (*Vaaresha*) & Return Panchanga Limbs (Gap R1 — Critical):**
  - `general.annual`'s contract (`catalog.ts:925`) explicitly requests *"year lord when served"*, and `src/reading/digest/build.ts:1177–1196` currently parses `yearLord` **only** for `kind === 'VP'`.
  - Radha `annual_export.py:736–746` (`run_annual`) omits `year_lord` (*Vaaresha*), `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, and `karana` from `annual.tithi_pravesha`, even though `pressure_inventory_export.py:572–582` already computes `_year_lord(jd, place)`.
  - Exporting `year_lord` + `return_instant.panchanga` from Radha and parsing them for `kind === 'TP'` in `build.ts` gives `specialist:annual` and `R11` the authentic TP ruler and return-moment quality (e.g., Shukla/Krishna Tithi, Hora lord, Yoga/Karana) rather than falling back to Varsha's year lord.
- **Dynamic TP Divisional Pulls (`D9`, `D10`, `D7`, `D2`, Gap R4):**
  - `annual.tithi_pravesha` and `annual.varsha` are currently hardcoded to `served: false` in `src/reading/chartData/catalog.ts:238–239`, blocking dynamic divisional TP pulls (`divisional_chart_factor=9, 10, 7, 2`).
  - Flipping `served: true` enables `digest.annual_set` (`catalog.ts:1198`) and `ensureChartData` to pull complete `TP D9` and `TP D10` year charts for marriage and career questions.
- **Compressed 365-Day TP Vimshottari & TP Tajaka/Muntha/Sahams (Gap O3):**
  - Supplies bounded 365-day TP Vimshottari periods alongside `tithi_ashtottari`, plus TP Muntha and Tajaka yogas in `annual_export.py`, eliminating annual dasha coverage gaps.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:917`):**
  ```typescript
  [
    c('natal', 'facts'),
    c('annual', 'tithi_pravesha'), c('annual', 'tithi_pravesha_dasha'),
    c('annual', 'varsha'), c('annual', 'sahams'),
    c('annual', 'mudda'), c('annual', 'patyayini'), c('annual', 'tajaka'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('annual', "TP and VP of the current, previous and next year, D1, D9, D10, the frame's houses; year dashas; sahams in the frame's houses; muntha, year lord, and return panchanga when served", 'annual_row')`
- **Contract Output Schema:** `'findings.v2'` (`system: 'src/reading/prompts/annual.md'`, `user: ANALYST_USER_FIELDS`, `synthesizer: 'general.oracle'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Emits annual confirmation/contradiction claims anchored to the active TP window (`tp_start <= now < tp_end`), listing TP Lagna, TP Year Lord (*Vaaresha*), relevant house placements in TP D1/D9/D10, Sahams, and bounded TP year dasha periods, with VP/Mudda cited strictly as confirmation.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Annual Top-Up & Digest (`digest.annual_set` -> `digest.build`):** Ensures `-10..+10 years` of TP/VP charts (`D1, D9, D10`, capped by `DIGEST_ANNUAL_MAX_CALLS=40`) are stored and digested into `kundli_digest` (`annual` section).
  2. **Deterministic Annual Selection (`runningTithiPravesha`):** Selects the exact TP year covering `now` (`tp_start <= now < tp_end`; before this year's return, uses previous year's TP).
  3. **Analyst / Reader Execution (`specialist:annual`, `code:annual`, `R11`):** Executes only when horizon `<= 24 months` (`['now', '3m', '6m', '1y', 'custom']`), reading `reading_findings_cache` or calling Gemini with cached prefix.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - `agentIdOf('annual')` -> `'reading.analyst.annual'` (and `'reading.reader'` for `R11`). Note: `code:annual` is a digest slice key in `src/reading/oracle/digestSlices.ts`; `trace.ts` `CODE_READERS` only maps `varga_dynamics`, `strength_yoga`, `jaimini`, and `person` (`code:annual` rolls up as `'reading.step'` / `null` unless registered in `CODE_READERS`).
  - `techniqueIdOf('annual')` -> `'general.annual'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (`annual|subject`) and `'model_call'` (`specialist:annual|subject`).
- **Execution Boundary & Runtime Limits:**
  - Bounded by interactive AI fan-out budget (`<= 10 s`); zero live Radha calls during chat reading if `digest.annual_set` has already populated the active year.
  - Strict engine rule: Node never calculates solar/lunar return instants, Muntha, Sahams, or Vaaresha weekday lords.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Anchors near-term predictions to the user's actual personal year cycle without confusing it with Gregorian calendar years (e.g., *"Your current personal year running through next October highlights career restructuring; expect the biggest shift between late January and March."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on consumer surfaces: *Tithi Pravesha*, *Varshaphala*, *Vaaresha*, *Muntha*, *Saham*, *Mudda*, *Patyayini*, *Tajaka*, *Tithi Ashtottari*, *D9*, *D10*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Technical markers remain inside `evidence[]`:
    `['digest.annual.TP2026.D1.year_lord:Ve', 'digest.annual.TP2026.D10.h10.lord_dignity:own', 'digest.annual.TP2026.panchanga.tithi:14_Shukla', 'digest.annual.VP2026.mudda.confirm:true']`.
- **One-Tap "Chart Details":** Displays the personal year boundary dates, Year Lord, annual house focus, and secondary solar-return confirmation.
- **Single Past-Event Calibration Question:** Checks annual transition resonance: *"Did the overall theme of your year shift noticeably right around [TP return date]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:221–275`):**
  - `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - `FullContext.prefix` (`parts[0]`, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) keeps natal context warm while `annual_row` slices for the 3-year window sit in the lightweight suffix.
- **Findings & Output Persistence:**
  - Persisted in `reading_findings_cache` keyed by `findingsKey({ kundliId, analyst: 'annual', subject, packHash, horizonKey: '<horizon>:<YYYY-MM-DD>', promptVer })`.
- **45-Minute Inactivity Lifecycle:**
  - Prewarming leaves `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` deletes remote Gemini `cachedContents` and evicts `llm_cache_entries` + `reading_findings_cache` after `READING_CACHE_RECYCLE_MINUTES` (`45`) of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest`, `ReadingFindingsCache`, and `ReadingRun` sealed at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
