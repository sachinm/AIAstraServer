# Technique Specification: Activation of Houses 1, 4 and 5 Across Dasha Systems (`self.activation`)

**Technique ID:** `self.activation`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`gradeRow`, `familyVotes`, `aheadWindows`); `src/reading/self/sub/clock.ts` (`subClock`); `src/reading/self/sub/periods.ts` (`subPeriods`)  
**Agent ID:** `area.self_board` (upstream: `digest.activation`, `dasha.deep_pull`; downstream: `self.sub.periods`, `self.sub.windows`, `self.v2.chapters`, `self.v2.oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.activation` evaluates when the native's core self, emotional stability, and creative direction (houses `1, 4, 5, 9, 12`) are actively switched on across 7 timing families—main graha dashas, applicable conditional dashas, rasi clocks (Narayana/Chara), karaka clocks, annual Tithi Pravesha dasha, transit clocks, and short confirmers (Yogini / Tithi Ashtottari). It grades each running and upcoming period (`-13 months` to `+30 years`) using D1 and owning divisional agreement so the board accurately dates turning points, support windows, and tests.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.activation`:

- **Tithi Pravesha Annual Dasha & `yearLord` Fix (Gap R1 & O3):**
  - Radha `annual_export.py:736–746` currently omits `yearLord` (*Vaaresha*), causing `src/reading/digest/build.ts:1177` to leave `AnnualRow.yearLord` `undefined` for `kind === 'TP'` and triggering `dashaAssessment.ts:414–419` to fail closed into `stance = 'get_through'`.
  - Wiring `_year_lord(ret_jd, ctx["place"])` (`pressure_inventory_export.py:572`) into `annual.tithi_pravesha`, parsing `year_lord` for `kind === 'TP'` in `build.ts`, and adding compressed 365-day TP Vimshottari restores accurate annual clock voting inside `self.activation`.
- **Unlocking All 23 Vargas (`D1..D60`) with Explicit Houses & Dignities (Gaps R2 & R3):**
  - `self.activation` enforces the rule: *"A dasha vote counts only when D1 and the owning varga agree; D9 breaks a tie; D60 only with birth time to the minute."*
  - Expanding `SERVED_VARGAS` (`catalog.ts:133`) and populating explicit `house` and `dignity` on `D1..D60` rows (`export.py:887`) unlocks true varga confirmation for period lords across `D9`, `D20`, `D24`, `D12`, and `D60`.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Upgrades period-lord grading in `gradeRow` by weighting multi-divisional strength (`shodhasavarga` / `dasavarga`) alongside D1/D9 dignity.
- **Sudarshana Chakra Annual Progression (Gap H4):**
  - Headless `sudharsana_chakra.py` 1-year-per-sign progression across Lagna/Moon/Sun wheels adds an independent cross-check for annual chapter transitions.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:627`):**
  ```typescript
  [
    c('dasha', 'vimshottari'), c('dasha', 'conditional'), c('dasha', 'narayana'),
    c('dasha', 'chara'), c('dasha', 'karaka'), c('annual', 'tithi_pravesha_dasha'),
    c('dasha', 'yogini'), c('dasha', 'tithi_ashtottari'),
    c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D20'),
    c('divisional', 'D24'), c('divisional', 'D12'), c('divisional', 'D4'),
    c('divisional', 'D7'), c('divisional', 'D60'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('activation', 'every served system, periods from today to +30 years activating houses 1,4,5,9,12', 'activation_row')` — `system`, `family`, `level`, `lord_or_sign`, `from`, `to`, `houses`, `polarity`.
  - `inp('planet', 'D1 and D9/D20/D24/D60 cards of the period lords (dignity, functional nature, vimsopaka, dasha_charter)', 'planet_card')`
- **Contract Output Schema:** `'area_board.v1'` (aligns with `self.sub.clock` `'self_v2.clock_resolution'` and `self.sub.periods` `'self_v2.period_frame'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.activation', claim: string, evidence: string[], polarity: 'support' | 'pressure' | 'mixed', weight: number, window: { from: string, to: string } }`.
  - Voting & polarity rules: Functional benefic (`+1`) / malefic (`-1`), D1 dignity (`±1`), owning varga dignity (`±1`), owns Self house (`+1`) / owns dusthana (`-1`), Vimsopaka $\ge 15$ (`+0.5`). One planet casts at most one vote across graha clocks; a family votes support at level-weighted sum $\ge 0.5$ and test at $\le -0.5$. Yogini and Tithi Ashtottari vote only when both agree.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Activation Indexing (`digest.activation` & `dasha.deep_pull`):** Pre-computes 30-year activation rows and `-90d..+365d` deep levels (L4–L6) in `kundli_activation`.
  2. **Deterministic Clock Resolution & Grading (`self.activation`):** Runs in `houseLayers.ts` (`gradeRow`, `familyVotes`, `aheadWindows`) over `ActivationRow[]` and `DigestView`.
  3. **Sub-Technique & Oracle Brief (`self.sub.clock`, `self.sub.periods`, `self.v2.chapters`, `self.v2.oracle`):** Selects active boundaries and 9x9 Antardasha fruition relations (`dashaCharter`).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (or `'self.sub'`).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.activation'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, zero LLM calls).
- **Execution Boundary & Runtime Limits:**
  - Code-only deterministic evaluation; `< 30 ms` budget for 30-year window scanning.
  - Strict engine isolation: period start/end dates, activated houses, and `dasha.applicable` eligibility come solely from Radha / `kundli_activation`; Node never recalculates dasha proportions or house offsets.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Presents active phases as clear life chapters and turning points with exact date ranges (e.g., *"A quieter, inward stretch that started in March begins opening up after November 18, shifting your focus back toward visible output."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Vimshottari*, *Mahadasha*, *Antardasha*, *Pratyantardasha*, *Narayana*, *Yogini*, *Tithi Ashtottari*, *ShadAshtaka 6/8*, *Dwirdwadasha 2/12*, *Vimsopaka*, *Vaaresha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All clock votes and divisional confirmations stay inside `evidence[]`:
    `['activation.vimshottari.L1.Ju:2024-05-01..2040-05-01', 'digest.planet.D9.Ju.dignity:own', 'digest.planet.D1.Ju.vimsopaka:16.5', 'tp.2026.year_lord:Ve']`.
- **One-Tap "Chart Details":** Displays the active reading clock, confirming systems that agree on the boundary date, and D1/D9/D24 lordship confirmations.
- **Single Past-Event Calibration Question:** Validates the most recent turning point: *"Did your priorities shift noticeably around [last L2 boundary month]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Code-only step (`cacheStore: 'none_deterministic_code'`).
  - Feeds the variable suffix (active dates, boundaries, and 12 heaviest active windows) of `self.v2.oracle` and `self.v3.cards` while keeping the natal prefix (`parts[0]`) cached.
- **Findings & Output Persistence:**
  - Stored in `technique_outputs` keyed by `techniqueCacheKey(v1|self.activation|<contractHash>|<kundliId>|d:<digestVersion>|<clock>|<boundaryStamp>)`.
  - `KundliActivation` remains plain on purpose (`fields: {}` in `src/lib/pii/fields.ts:84`) for indexed SQL range queries, holding only system IDs, period lords, dates, and house numbers (no PII).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarming leaves `hit_count = 0`; live reads invoke `informIndividualCacheUsed({ userId, kundliId })`; recycled after 45 minutes of inactivity (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Derived outputs encrypted at rest under `SEALED_MODELS` (`TechniqueOutput`, `AreaBuild`, `KundliDigest`) using `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This section overrides any narrower list of dasha systems above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice.
  At most four voices are counted (star, sign, purpose, year); every other system is reported as support and never
  raises the count. Longevity dashas are read and never named to the person.
- **Tested against, for this technique:** the lagna and its lord, the Moon, and the houses of the Self area being read.
- **Purpose voice:** none for temperament, mind and body; Drig for purpose, named as unverified until the engine check.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows. The code and the lens recipes change with that build; until then this
  technique reads the systems listed above.
