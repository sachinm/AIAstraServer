# Technique Specification: Dasha Analyst — All Systems (`general.dasha`)

**Technique ID:** `general.dasha`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 `D1..D60`, `Vimsopaka`, & `TP yearLord` enhancement ready)  
**Owning Code Path:** `src/reading/nodes/specialists.ts`; `src/reading/packs/selector.ts` (`ANALYST_SECTIONS.dasha`); `src/reading/packs/digestSource.ts` (`overlayDigest`); `src/reading/dasha/dashaAssessment.ts`; `src/reading/prompts/v2/dasha.md`  
**Agent ID:** `reading.analyst.dasha` (subagent slice: `specialist:dasha`; downstream: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.dasha` is the primary timing analyst of the General Reading (Chat) flow, always selected alongside `general.promise` across all horizons (`now`, `3m`, `6m`, `1y`, `5y`, `life`, `custom`). Reading `kundli_activation` alongside frame houses and period-lord cards across all served dasha families (Vimshottari MD/AD/PD at level 3, Narayana, applicable conditional dashas from `dasha.applicable`, Chara, Karaka, Yogini, and Tithi Ashtottari), it determines which timing windows open, test, or delay the subject's natal promise.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `general.dasha`:

- **Tithi Pravesha `yearLord` Fix in `dashaAssessment.ts` (Gap R1 — Critical):**
  - `src/reading/dasha/dashaAssessment.ts:412–420` explicitly checks `tpInfo.row.yearLord`. Because Radha `annual_export.py` omits `year_lord` and `digest/build.ts:1177` only parses `yearLord` for `kind === 'VP'`, active dasha assessment currently **fails closed to `stance = 'get_through'`**!
  - Fixing Radha to export `year_lord` and `build.ts` to parse it for `kind === 'TP'` immediately restores accurate active-timing stances (`build` vs. `get_through`) during `general.dasha` evaluation.
- **Unlocking All 23 Divisional Vargas (`D1..D60`) with Explicit Houses & Dignities (Gaps R2 & R3):**
  - `general.dasha` reads *"each period lord's place in the frame vargas"* (`catalog.ts:902`). Expanding `SERVED_VARGAS` (`chartData/catalog.ts:133`) and populating explicit `house` and `dignity` on `varga.dN` (`export.py:887`) empowers `specialist:dasha` to evaluate period lords accurately inside `D11, D12, D20, D24, D30, D60` (not just `D1/D9/D10`), enforcing `D9_MATURITY_AGE_YEARS=36` joint confirmation.
- **Vimsopaka & Harsha Bala (`strength.vimsopaka`, `strength.harsha`, Gap H6):**
  - Currently `served: false` in `chartData/catalog.ts:198–199`. Enables `specialist:dasha` to assess whether an active dasha lord sitting in a 6th/8th/12th house carries high Harsha Bala resilience or strong Vimsopaka backing rather than flagging every trik placement as pure failure.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:901`):**
  ```typescript
  [
    c('natal', 'facts'), ...FRAME_VARGAS,
    c('dasha', 'vimshottari'), c('dasha', 'narayana'), c('dasha', 'conditional'),
    c('dasha', 'chara'), c('dasha', 'karaka'), c('dasha', 'yogini'),
    c('dasha', 'tithi_ashtottari'), c('natal', 'strength.vimsopaka'),
    c('natal', 'strength.harsha'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('activation', "periods inside the horizon activating the frame's houses, every served system, grouped by family; Vimshottari MD/AD/PD at level 3; dasha.applicable", 'activation_row')`
  - `inp('planet', "D1 and frame varga cards of the frame's house lords, karakas, and period lords (including dasha_charter, vimsopaka, harsha)", 'planet_card')`
  - `inp('house', "D1 and the frame's vargas, the frame's houses", 'house_card')`
- **Contract Output Schema:** `'findings.v2'` (with `synthesizer: 'general.oracle'`, `system: 'src/reading/prompts/v2/dasha.md'`, `user: ANALYST_USER_FIELDS`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Claims dated with exact `from`/`to` bounds from `kundli_activation`, polarity (`support | pressure | mixed`), weight (`1..3`), and evidence IDs referencing both `activation` rows and `digest.planet.*.dasha_charter` (6/8, 2/12, star-lord links).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Activation Pre-computation (`digest.activation` & `dasha.deep_pull`):** Builds 30-year `kundli_activation` rows and `-90d..+365d` deep L4–L6 rows.
  2. **Clarify Prewarm (`general.clarify`):** Warms `FullContext.prefix` (`parts[0]`) in Gemini `cachedContents` + `llm_cache_entries`.
  3. **Graph Specialist Execution (`runSpecialist`):** Checks `reading_findings_cache` (`horizonKey: '<horizon>:<YYYY-MM-DD>'`); on miss calls `llmCallWithPrefix` using the cached prefix handle in parallel with `general.promise` and other selected analysts.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - `agentIdOf('dasha')` -> `'reading.analyst.dasha'`.
  - `techniqueIdOf('dasha')` -> `'general.dasha'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (`dasha|subject`) and `'model_call'` (`specialist:dasha|subject`).
- **Execution Boundary & Runtime Limits:**
  - Bounded by interactive AI fan-out deadline (`<= 10 s`), single JSON repair retry on malformed output, graceful skip on timeout.
  - Zero Node astrology: dasha boundaries, applicability flags (`dasha.applicable`), and divisional placements are read directly from Radha-sourced tables.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Presents timing guidance in plain language with concrete date windows (e.g., *"Momentum builds steadily between April and October next year, while the stretch before March favors quiet preparation over forced leaps."*).
- **Jargon Redaction Rules:**
  - Downstream answers strictly forbid *Mahadasha*, *Antardasha*, *Pratyantardasha*, *Vimshottari*, *Narayana*, *Yogini*, *Tithi Ashtottari*, *ShadAshtaka*, *Harsha Bala*, *Vimsopaka*, *Vaaresha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All clock names and charter links stay inside `evidence[]`:
    `['activation.vimshottari.L2.Me:2026-04-01..2028-11-15', 'digest.planet.D1.Me.dasha_charter.Ve:trine_support', 'digest.planet.D10.Me.dignity:own', 'tp.2026.year_lord:Ve']`.
- **One-Tap "Chart Details":** Displays active timing systems, confirming multi-clock consensus, and divisional strength of running period lords.
- **Single Past-Event Calibration Question:** When a major chapter shift occurred within the last 12–18 months, Clarify confirms: *"Did your day-to-day focus change noticeably around [last L1/L2 boundary date]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:221–275`):**
  - `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - Immutable natal prefix (`FullContext.prefix` from `kundli_digest`) in `parts[0]` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`); horizon-clipped `activation_row` list in `parts[1]`.
- **Findings & Output Persistence:**
  - Persisted in `reading_findings_cache` keyed by `findingsKey({ kundliId, analyst: 'dasha', subject, packHash, horizonKey: '<horizon>:<YYYY-MM-DD>', promptVer })`.
- **45-Minute Inactivity Lifecycle:**
  - Prewarming leaves `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` deletes remote Gemini `cachedContents` and evicts `llm_cache_entries` + `reading_findings_cache` after `READING_CACHE_RECYCLE_MINUTES` (`45`) of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest`, `ReadingFindingsCache`, and `ReadingRun` sealed at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This is the rule the technique is being built to. It replaces any narrower list of dasha systems above **when the
preparation build of `docs/techniques/11` ships**; until that release the code still reads the systems listed above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice;
  every other system is reported as support and never raises the count. How many voices are counted is a house rule
  awaiting Sachin's confirmation: see `docs/techniques/12` §4 and §9. Longevity dashas are read and never named to the
  person.
- **Tested against, for this technique:** the significators of the question asked.
- **Purpose voice:** Sudasa for money and standing, Drig for the spiritual path, Narayana on the subject's divisional chart once cast.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
