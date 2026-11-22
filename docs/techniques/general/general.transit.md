# Technique Specification: Transit Analyst (`general.transit`)

**Technique ID:** `general.transit`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 `transit_ashtakavarga`, `Gochara Vedha`, `Murti Nirnaya`, & `2027–2036` contacts ready)  
**Owning Code Path:** `src/reading/nodes/specialists.ts`; `src/reading/packs/selector.ts` (`ANALYST_SECTIONS.transit`); `src/reading/prompts/v2/transit.md`  
**Agent ID:** `reading.analyst.transit` (subagent slices: `specialist:transit`, `R07`, `R10`, `P1–P3`; downstream: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.transit` evaluates live and forecasted planetary movements (`Saturn`, `Jupiter`, `Rahu`, `Ketu`, eclipses, and `transit_at` for specific asked dates) over the subject's frame houses, natal lords, karakas, and Arudha Padas across all horizons. It pairs slow-planet sign stays, exact natal-degree contacts (entry, exact, exit, station), Double Transit alignments, and Sade Sati spans with natal Ashtakavarga scores to pinpoint when external circumstances trigger or constrain internal dasha promises.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` directly elevate `general.transit`:

- **Enabling `transit_ashtakavarga` with Kakshya Bindus (`daily_export.py:703–765`, Gap H5):**
  - `general.transit`'s contract (`catalog.ts:941`) already expects *"transit ashtakavarga"*, yet `transit_ashtakavarga` is marked `served: false` in `src/reading/chartData/catalog.ts:263`.
  - Flipping `served: true` and wiring Radha's `run_transit_ashtakavarga` payload provides BAV (`0..8`), SAV, and exact **Kakshya** (`3°45'` sub-lord + `has_bindu: boolean`) for every transiting planet on any asked date (`transit_at`) or horizon window.
- **Gochara Vedha & Virodha Vedha (`transits_export.py`, Gap H1):**
  - Computes classical transit obstruction pairs from natal Moon and Lagna in Radha, preventing `specialist:transit` from overclaiming an auspicious Jupiter/Venus transit when an opposing planet sits in its Vedha house.
- **Murti Nirnaya (`transits_export.py`, Gap H2):**
  - Computes the Moon-at-ingress metal vehicle (*Swarna, Rajata, Tamra, Loha*) for slow-planet ingresses, grading whether a Saturn or Rahu transit brings resilience or friction.
- **Divisional Transit Overlays (`D9`, `D10`, `D7`, `D11`, Gap H7) & Multi-Year Contacts (`2027–2036`, Gap R5):**
  - Extends exact natal-degree transit contact fixtures/generations beyond 2026 (`docs/TODOS.md:240`) through 2036 so `5y`, `life`, and custom future questions remain accurate.
  - Adds divisional transit overlays (e.g., transiting planets over D10 for career questions or D9 for marriage questions).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:933`):**
  ```typescript
  [
    c('natal', 'facts'), c('jaimini', 'arudhas'),
    c('dasha', 'vimshottari'), c('dasha', 'narayana'),
    c('transit', 'transit_overlay'), c('transit', 'transit_contacts'),
    c('transit', 'transit_at'), c('ashtakavarga', 'transit_ashtakavarga'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('transit', "shared sky with the overlay for the frame's houses, lords and karakas inside the horizon; double transit; sade sati; eclipses; transit ashtakavarga (BAV/SAV/kakshya), Gochara Vedha, Murti Nirnaya", 'transit_row')`
  - `inp('planet', "D1 cards of the frame's house lords and karakas", 'planet_card')`
- **Contract Output Schema:** `'findings.v2'` (`system: 'src/reading/prompts/v2/transit.md'`, `user: ANALYST_USER_FIELDS`, `synthesizer: 'general.oracle'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Emits dated transit claims (`from`, `to`, `exactDate`, `station`) citing `transit_row` and `digest` evidence IDs, explicitly noting whether BAV/Kakshya bindus support and whether Gochara Vedha obstructs the transit.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Shared Sky & Contact Fetch (`transit_overlay`, `transit_contacts`, `transit_at`, `transit_ashtakavarga`):** Loaded from `TransitRangeSky` / `KundliTransitOverlay` or Radha for specific `transit_at` dates.
  2. **Graph Specialist Execution (`specialist:transit`):** Runs in parallel with other selected analysts over `FullContext`, checking `reading_findings_cache` (`horizonKey: '<horizon>:<YYYY-MM-DD>'`) first; on miss calls `llmCallWithPrefix`.
  3. **Oracle Synthesis (`general.oracle`):** Cross-references transit hits with active `general.dasha` periods (Desha-Kala-Patra + Dasha-Gochara concordance: transits only deliver what the active dasha permits).
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - `agentIdOf('transit')` -> `'reading.analyst.transit'`.
  - `techniqueIdOf('transit')` -> `'general.transit'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (`transit|subject`) and `'model_call'` (`specialist:transit|subject`).
- **Execution Boundary & Runtime Limits:**
  - Interactive AI call within `<= 10 s` budget; one JSON repair attempt on parse error.
  - Zero Node astrology: planetary longitudes, stations, eclipses, Kakshya `has_bindu`, Vedha obstructions, and Murti metals are computed strictly by Radha.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Explains external timing triggers in clear, practical terms (e.g., *"Expect a noticeable push around mid-May when outside circumstances test your bandwidth—avoid overcommitting between May 12 and June 4."*).
- **Jargon Redaction Rules:**
  - Consumer responses strictly redact *Gochara*, *Vedha*, *Murti Nirnaya*, *Kakshya*, *Bindu*, *SAV*, *BAV*, *Sade Sati*, *Dhaiya*, *Double Transit*, *Arudha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Transit proofs remain inside `evidence[]`:
    `['transit.Sa.exact_natal_L10:2027-05-18', 'transit_av.Ju.bav:5.kakshya:has_bindu', 'vedha.Ju_from_moon:clear', 'murti.Sa:tamra']`.
- **One-Tap "Chart Details":** Lists exact contact windows, station dates, Ashtakavarga support score, and obstruction status.
- **Single Past-Event Calibration Question:** When an exact slow-planet station hit within the last 6 months, Clarify checks: *"Did something concrete shift externally around [station date]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:221–275`):**
  - `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - Natal `FullContext.prefix` cached in `parts[0]` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`); horizon-clipped `transit_row` events sent in `parts[1]`.
- **Findings & Output Persistence:**
  - Persisted in `reading_findings_cache` keyed by `findingsKey({ kundliId, analyst: 'transit', subject, packHash, horizonKey: '<horizon>:<YYYY-MM-DD>', promptVer })`.
- **45-Minute Inactivity Lifecycle:**
  - Prewarming leaves `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` deletes remote Gemini `cachedContents` and evicts `llm_cache_entries` + `reading_findings_cache` after `READING_CACHE_RECYCLE_MINUTES` (`45`) of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliTransitOverlay`, `TransitSnapshot`, `ReadingFindingsCache`, and `ReadingRun` sealed at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM); global `TransitRangeSky` uses system key.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
