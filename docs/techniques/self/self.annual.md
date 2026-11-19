# Technique Specification: This Year's Chart for Houses 1, 4 and 5 (`self.annual`)

**Technique ID:** `self.annual`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 critical fix & enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`currentYear`, `annualLayer`); `src/reading/self/sub/year.ts` (`subYear`); `src/reading/annual/tithiPravesha.ts` (`runningTithiPravesha`)  
**Agent ID:** `area.self_board` (upstream: `digest.annual_set`, `digest.build`; downstream: `self.sub.year`, `self.v2.year`, `family.year`, `self.v2.oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.annual` anchors the Self board's "This Year" assessment strictly to the active **Tithi Pravesha (TP)** lunar-solar return whose return moment has already passed (`tp_start <= now < tp_end`), never substituting a calendar birthday or Varshaphala chart in its place. It inspects the TP Lagna, the TP Year Lord (*Vaaresha*), the annual positions of houses `1, 4, 5, 9, 12`, relevant Sahams, and the bounded TP year dasha—using Varshaphala (*Mudda*/*Patyayini*) strictly as a secondary confirmer—to grade whether this year confirms, amplifies, contradicts, or stays neutral to the natal promise.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.annual`:

- **Tithi Pravesha `yearLord` (*Vaaresha*) & Return Panchanga Fix (Gap R1 — Critical):**
  - **Root Bug:** Radha `annual_export.py:736–746` (`run_annual`) omits `year_lord` (*Vaaresha*), `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, and `karana` from `annual.tithi_pravesha`, even though `pressure_inventory_export.py:572–582` already computes `_year_lord(jd, place)` via the Vedic sunrise weekday.
  - Meanwhile, Server `src/reading/digest/build.ts:1177–1196` only extracts `yearLord` when `kind === 'VP'` (Varshaphala), leaving `AnnualRow.yearLord` `undefined` for `kind === 'TP'`.
  - **Symptom Eliminated:** `src/reading/dasha/dashaAssessment.ts:414–419` currently fails closed into `stance = 'get_through'` whenever `yearLord` is unresolved. Exporting `year_lord` + `return_instant.panchanga` in Radha and parsing them for `kind === 'TP'` in `build.ts` eliminates false defensive stances across `self.annual`, `self.sub.year`, and `self.reading.year`.
- **Dynamic TP Divisional Charts (`divisional_chart_factor=9, 20, 24, 30`, Gap R4):**
  - `annual.tithi_pravesha` is currently marked `served: false` in `src/reading/chartData/catalog.ts:239`, blocking dynamic divisional TP pulls (`D9`, `D24`, `D20`, `D30`).
  - Marking `annual.tithi_pravesha` `served: true` enables `self.annual` to check annual `TP D9` (inner alignment) and `TP D24` (learning/mind) alongside `TP D1`.
- **TP Compressed 365-Day Vimshottari & TP Tajaka Yogas / Muntha (Gap O3):**
  - Adds `annual_export.py` compressed 365-day TP Vimshottari dasha (alongside `tithi_ashtottari`) and TP Muntha/Sahams so `self.sub.year` has full short-clock coverage without rescaling in Node.
- **Sudarshana Chakra Annual Wheel (`dhasa/sudharsana_chakra.py`, Gap H4):**
  - Cross-checks the TP year against the 1-year-per-sign Sudarshana Chakra progression (`progression_house`) across Lagna, Moon, and Sun wheels.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:640`):**
  ```typescript
  [
    c('annual', 'tithi_pravesha'), c('annual', 'sahams'),
    c('annual', 'mudda'), c('annual', 'patyayini'),
    c('annual', 'tithi_pravesha_dasha'), c('annual', 'varsha'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('annual', 'TP and VP of the current, previous and next year, houses 1,4,5,9,12, their sahams, year_lord, return panchanga, and year dashas', 'annual_row')` — columns: `year`, `kind`, `varga`, `lagna`, `house`, `lord`, `occupants`, `aspects`, `sahams`, `year_dasha`, `muntha`, `year_lord`, `tajaka_yogas`.
- **Contract Output Schema:** `'area_board.v1'` (aligns with `self.sub.year` `'self_v2.year_frame'` and `self.reading.year`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.annual', claim: string, evidence: string[], polarity: 'confirm' | 'amplify' | 'contradict' | 'silent', weight: number, window: { from: string, to: string } }`.
  - Weight & confirmation rules: Year lord (`Vaaresha`) and house `1, 4, 5` year lords in kendra/trikona/own without debility confirm (`+1`), in dusthana contradict (`-1`); occupants/aspects and Argala at half weight (`±0.5`); relevant Sahams in kendra with strong lord (`+0.5`); Varsha Mudda/Patyayini only confirm. Changes confidence by one step and never makes a verdict alone.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Annual Pre-Pull (`digest.annual_set`):** Pulls missing TP and VP charts (`-10..+10 years`, capped at `DIGEST_ANNUAL_MAX_CALLS=40`) before `digest.build`.
  2. **Annual Digestion (`digest.build`):** Parses `year_lord`, `return_instant.panchanga`, `tp_start`/`tp_end`, and divisional TP rows into `kundli_digest` (`annual` section).
  3. **Deterministic Annual Selection (`self.annual` / `self.sub.year`):** `runningTithiPravesha` selects the active TP chart (`tp_start <= now < tp_end`) and evaluates houses `1, 4, 5, 9, 12`.
  4. **Family Reader & Oracle (`family.year` -> `self.v2.oracle`):** Synthesizes the annual stance against the running Mahadasha.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (code layer), `'self.sub'` (v2), and `'family.year'` (LLM reader).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.annual'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic), `'model_call'` (`family.year`).
- **Execution Boundary & Runtime Limits:**
  - `self.annual` runs deterministically in `< 10 ms`.
  - Strict engine boundaries: Node never computes TP return instants, weekday lords, or compressed year dasha lengths; if `tp_start` is missing and no bounded TP year dasha covers `asOf`, `subYear` sets `noCoverage: true` rather than falling back to Varshaphala.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Frames the personal year between lunar-solar return dates in plain, empowering language (e.g., *"Your personal year running from October 24 to October 14 emphasizes steady personal rebuilding—focus on consolidating skills rather than forcing sudden leaps."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Tithi Pravesha*, *Vaaresha*, *Varshaphala*, *Mudda*, *Patyayini*, *Muntha*, *Saham*, *Tajaka*, *Tithi Ashtottari*, *Kendra*, *Dusthana*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Technical markers remain inside `evidence[]`:
    `['annual.TP2026.tp_start:2026-10-24T18:42:15', 'annual.TP2026.year_lord:Ve', 'annual.TP2026.D1.h1.lord_dignity:own', 'annual.VP2026.mudda.confirm:true']`.
- **One-Tap "Chart Details":** Displays exact return date/time window, Year Lord, annual Ascendant vs. natal Ascendant, and Varsha Mudda confirmation status.
- **Single Past-Event Calibration Question:** Grounds the return shift around the previous TP date: *"Did the tone of your year noticeably pivot right around [tp_start month/day]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `self.annual` executes with zero LLM calls (`cacheStore: 'none_deterministic_code'`).
  - `family.year` builds its annual pack from `DigestView` (`parts[0]` padded past `1,024` tokens where needed, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and persists findings in `reading_findings_cache`.
- **Findings & Output Persistence:**
  - Stored in `technique_outputs` keyed by `techniqueCacheKey(v1|self.annual|<contractHash>|<kundliId>|d:<digestVersion>|annual:<tpYear>)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest under `SEALED_MODELS` (`KundliDigest`, `TechniqueOutput`, `ReadingFindingsCache`, `AreaBuild`) with `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
