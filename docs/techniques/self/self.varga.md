# Technique Specification: Owning Divisional Charts of Houses 1, 4 and 5 (`self.varga`)

**Technique ID:** `self.varga`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 major unlock target)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`vargaLayer`); `src/reading/area/self.ts` (`SELF`)  
**Agent ID:** `area.self_board` (upstream: `digest.build`; downstream: `family.varga`, `self.v2.oracle`, `self.reading_oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.varga` cross-checks whether the surface promise shown in the birth chart (`D1`) for houses `1, 4, 5, 9, 12` holds up across the specialized divisional charts (`D9` Navamsha inner character/maturation, `D20` Vimshamsha spiritual depth, `D24` Chaturvimshamsha learning/intellect, `D12` Dwadashamsha lineage, `D4` Chaturthamsha home/assets, `D7` Saptamsha creative legacy, and `D60` Shashtiamsha deep root karma). It returns an explicit `agrees | disagrees | neutral` divisional verdict so dasha votes and core personality claims are grounded across multiple layers of reality.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` directly unblock `self.varga`:

- **Unlocking All 23 Divisional Vargas (`D1..D60`) in `SERVED_VARGAS` (Gap R2):**
  - Currently `src/reading/chartData/catalog.ts:133` restricts `SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10])`.
  - All five core Self vargas outside `{1, 4, 7, 9}`—namely **`D12`, `D20`, `D24`, and `D60`** (plus `D3, D16, D27, D30, D40, D45`)—are currently marked `served: false`, blocking `ensureChartData` from fetching them dynamically.
  - Expanding `SERVED_VARGAS` to all 23 factors in `VARGA_FACTORS` makes `self.varga` genuinely operational across its entire declared chart list.
- **Explicit Divisional `house`, `lagna`, `owns`, `aspects_to`, and `dignity` in Radha (Gap R3):**
  - Currently `AIAstra_Radha/src/jhora/export.py:887–901` (`_build_placements_json`) omits `house`, top-level `lagna`, lordships (`owns`), aspects, and `dignity` on `varga.d<N>` rows, causing `src/reading/digest/build.ts:605–630` to leave `house: null` on placement cards.
  - Upgrading `_build_placements_json` to return `house` (`1..12`), `lagna`, `owns`, `aspects_to`, and `dignity`, and expanding `VARGA_SCOPE` (`natal_export.py:54`) from 12 to 23 vargas enables `self.varga` to read D20, D24, D12, D30, and D60 house cards without any forbidden Node `% 12` math.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Quantifies planetary consistency across Shadvarga, Dasavarga, and Shodashavarga on a 20-point scale, supplementing binary `agrees/disagrees` checks with graded multi-varga stability.
- **D9 >36 Maturity Gate (`D9_MATURITY_AGE_YEARS=36`):**
  - Enforces joint `D1 + D9` mutual confirmation rules from `docs/reading-engine/76` for subjects over age 36 (Vargottama, Neecha Bhanga via D9, False Promise, Drudha Karma).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:648`):**
  ```typescript
  [
    c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D20'),
    c('divisional', 'D24'), c('divisional', 'D12'), c('divisional', 'D4'),
    c('divisional', 'D7'), c('divisional', 'D60'), c('natal', 'strength.vimsopaka'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12', 'house_card')`
  - `inp('planet', 'D1 and D9/D20/D24/D12/D60 cards of L1, Mo, Su, L4, L5, Me, Ju, Ke, AK (plus vimsopaka_score)', 'planet_card')`
  - `inp('point', 'arudhas of houses 1,4,5,9,12 in D1, D9, D20, D24, D12, D4, D7, D60', 'point_row')`
- **Contract Output Schema:** `'area_board.v1'` (feeds `self.activation` dasha-vote gating and `family.varga` findings).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.varga', claim: string, evidence: string[], polarity: 'support' | 'pressure' | 'neutral', weight: number, agreement: 'agrees' | 'disagrees' | 'neutral' }`.
  - Weight formula: Natal D1 lord dignified in owning varga (`+1.5` support) / debilitated (`-1.5` test); varga house lord dignified or in kendra/trikona (`+1.0`) / dusthana or debilitated (`-1.0`); same-house D1+varga placement / Vargottama (`+1.0`); D60 consulted only when birth time precision is to the minute.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Multi-Varga Digest Build (`digest.build`):** Fetches/reads `varga.dN` + `dignities.dN` + `arudhas.dN` for all 23 vargas (lazy pull for `D40..D60` when needed, registration pull for `D2, D3, D4, D7, D10, D12, D30, D60`) and builds `house_card` and `planet_card` rows in `kundli_digest`.
  2. **Deterministic Varga Layer (`self.varga`):** Evaluates `vargaLayer` over `DigestView` (`houseLayers.ts`), gating whether `self.activation` period votes stand.
  3. **Family Varga & Oracle (`family.varga` -> `self.v2.oracle`):** `family.varga` reads the D2..D60 matrix and Vargottama flags to explain *why* surface promise matures or shifts internally.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (code layer) and `'family.varga'` (LLM reader).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.varga'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (`self.varga`), `'model_call'` (`family.varga`).
- **Execution Boundary & Runtime Limits:**
  - `self.varga` deterministic evaluation `< 15 ms`.
  - Strict zero-math rule: Node reads `house`, `lagna`, `owns`, and `dignity` verbatim from Radha's upgraded `_build_placements_json` / `dignities.dN`; never computes divisional sign boundaries (`floor(deg * N / 30)`) in TypeScript.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates multi-varga confirmation into relatable inner vs. outer alignment (e.g., *"What looks effortless on the outside takes quieter, steady practice behind the scenes, and your long-term resilience deepens notably in your late thirties."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Navamsha*, *D9*, *Vimshamsha*, *D20*, *Chaturvimshamsha*, *D24*, *Shashtiamsha*, *D60*, *Vargottama*, *Neecha Bhanga*, *Drudha Karma*, *Vimsopaka*, *Arudha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Divisional comparisons live strictly in `evidence[]`:
    `['digest.house.D9.h1.lord_dignity:exalted', 'digest.planet.D24.Me.house:5', 'digest.planet.D20.Ju.vargottama:true', 'd1_d9_gate:mature_over_36']`.
- **One-Tap "Chart Details":** Lists which life-domain lenses (`D9` inner path, `D24` learning, `D20` inner purpose) confirm or challenge the primary chart promise.
- **Single Past-Event Calibration Question:** Checks maturation shifts: *"Did your inner confidence and clarity about what truly matters noticeably settle after age 36 (or in your mid-thirties)?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `self.varga` is deterministic (`cacheStore: 'none_deterministic_code'`).
  - `family.varga` slices `D2..D60` `house` and `planet` cards into its cached prefix (`parts[0]` $\ge 1024$ tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`), shared across Self, Love, and Work boards in `reading_findings_cache`.
- **Findings & Output Persistence:**
  - Persisted in `technique_outputs` under `techniqueCacheKey(v1|self.varga|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest in `SEALED_MODELS` (`KundliData`, `KundliDigest`, `TechniqueOutput`, `ReadingFindingsCache`, `AreaBuild`) under `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
