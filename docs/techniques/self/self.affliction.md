# Technique Specification: Afflictions on Houses 1, 4 and 5 with the Moon (`self.affliction`)

**Technique ID:** `self.affliction`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`afflictionLayer`, `releaseOf`); `src/reading/area/self.ts` (`SELF`)  
**Agent ID:** `area.self_board` (upstream: `digest.build`, `digest.activation`; downstream: `self.sub.risk`, `self.v2.stuck`, `self.v2.oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.affliction` identifies structural stressors, blind spots, and recurring friction patterns across the native's self-architecture—houses `1, 4, 5, 9, 12`, the Lagna lord, Moon, Sun, and Atmakaraka—and pairs every identified pressure with its exact release date from the active dasha calendar. Rather than issuing fatalistic verdicts, it isolates root knots (debility without cancellation, dusthana placement, nodal/Saturnine pressure, or karmic traps) so downstream cards explain *what* strains the user and *when* that pressure eases.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.affliction`:

- **D30 Trimshamsha Structural Unlock & Explicit House Mapping (Gaps R2 & R3):**
  - Expanding `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) to include `D30` (currently excluded from `SERVED_VARGAS`) and upgrading Radha `_build_placements_json` (`export.py:887–901`) to emit explicit `house`, `lagna`, `owns`, and `dignity` unlocks full D30 house-level affliction reading.
  - Enables `self.affliction` to detect subconscious fears, somatic stress signatures, and hidden vulnerabilities on D30 houses `1, 4, 5` alongside D1.
- **D60 Shashtiamsha & D27 Bhamsa Unlock (Gap R2):**
  - Unlocks deep root-level endurance checks (`D27` strength/weakness balance) and foundational karmic knots (`D60`) when birth time is accurate to the minute.
- **Bhava Bala (`strength.bhava`, Gap H6):**
  - Quantifies whether an afflicted house (e.g., 4th house with Saturn aspect) suffers true structural depletion (bottom-4 Bhava Bala rank) or retains high underlying capacity.
- **Bhava Chalit Planetary Shifts (Gap H8):**
  - Explicit `houseShift` flags from Radha prevent false-positive affliction claims when a malefic (Saturn, Mars, Rahu, Ketu) sits in sign 1/4/5 in Rasi but shifts into an adjacent house in Bhava Chalit.
- **Gochara Vedha & Multi-Year Transit Contacts (Gaps R5, H1):**
  - Supplies exact future release/intensification boundaries through 2036 when affliction periods intersect slow transits.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:609`):**
  ```typescript
  [
    c('natal', 'facts'), c('natal', 'dignities'), c('natal', 'aspects'),
    c('natal', 'doshas'), c('natal', 'avasthas'), c('natal', 'house_counts'),
    c('natal', 'strength.bhava'), c('divisional', 'D1'), c('divisional', 'D30'),
    c('dasha', 'vimshottari'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60,D30 houses 1,4,5,9,12', 'house_card')`
  - `inp('planet', 'D1 and D9/D30 cards of L1, Mo, Su, L4, L5, Me, Ju, Ke, AK and afflicting malefics', 'planet_card')`
  - `inp('yoga', 'doshas and affliction rows joining houses 1,4,5,9,12 or their lords', 'yoga_row')`
  - `inp('activation', 'running and next periods of the afflicting planets, houses 1,4,5,9,12', 'activation_row')`
- **Contract Output Schema:** `'area_board.v1'` (feeds `self.sub.risk` `'self_v2.risk_ledger'` and `self.reading.struggle` `'self_panel.v1'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.affliction', claim: string, evidence: string[], polarity: 'pressure', weight: number, about: string, releaseAt?: string }`.
  - Weight formula: Lord in dusthana (`2.0`), debilitated without cancellation (`2.0`), combust (`1.0`, no release), planetary war (`1.0`), Saturn/Rahu/Ketu occupying (`1.5`) or aspecting (`1.0`) 1/4/5 or Moon, Kemadruma or Moon in Gandanta, D30 h1/h4 malefic overlap (`+1.0` Priority #2 weight), Bhava Bala bottom-4 (`+0.5`). Release date = `end` of the afflicting planet's running period in `kundli_activation` (primary clock first).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest & Activation Build (`digest.build` / `digest.activation`):** Stores `kundli_digest` (`D1`, `D30`, `doshas`, `avasthas`, `strength.bhava`) and 30-year `kundli_activation` rows.
  2. **Deterministic Affliction Scan (`self.affliction`):** Executes in `houseLayers.ts` (`afflictionLayer` + `releaseOf`) over `DigestView` and `ActivationRow[]`.
  3. **Risk Ledger & Purview Gate (`self.sub.risk`, `self.reading.purview`):** Joins live afflictions with active periods (`asOf`) and verifies whether a cancellation (`self.protection`) neutralizes or softens the knot before reaching the Oracle.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (or `'self.sub'`).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.affliction'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Code-only execution; strict `< 20 ms` execution limit.
  - Zero Node astrology: house classes (`dusthana`), dignities, cancellations, and D30 placements are read directly from engine-populated digest fields.
  - Afflictions never flip a board verdict alone; they set the baseline and name specific blockers with bounded release dates.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Frames friction constructively as actionable growth edges and temporary weather rather than doom (e.g., *"Overthinking tends to peak when you carry unspoken expectations at home; that mental heaviness eases noticeably after mid-August."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Dusthana*, *Debilitated*, *Combust*, *Kemadruma*, *Gandanta*, *Papakartari*, *Trimshamsha*, *D30*, *Mrita*, *Rahu*, *Ketu*, *Bhava Chalit*, *Radha*, *pyjhora*.
  - Medical/clinical diagnoses, doom language, or lifetime verdicts are strictly banned by `self.reading.audit`.
- **Evidence Array Encapsulation:**
  - All mechanics reside in `evidence[]`:
    `['digest.planet.D1.Mo.dignity:debilitated', 'digest.house.D30.h1.occupants:Sa', 'activation.vimshottari.L2.Sa.end:2027-08-14']`.
- **One-Tap "Chart Details":** Displays the exact tension source, whether a cancellation exists, whether D30 confirms internal wear, and the exact period end date.
- **Single Past-Event Calibration Question:** Grounds recurring strain in memory: *"Did that restlessness or second-guessing feel heaviest during the stretch starting around [period start]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero direct LLM calls (`cacheStore: 'none_deterministic_code'`).
  - Emits compact risk/affliction rows consumed in the variable suffix of `self.v2.oracle` and `lineman.self` so the immutable natal prefix (`parts[0]`) remains stable.
- **Findings & Output Persistence:**
  - Persisted inside `technique_outputs` under `techniqueCacheKey(v1|self.affliction|<contractHash>|<kundliId>|d:<digestVersion>|<clock>|...)` and invalidated whenever `buildDigest` runs (`deleteKundliTechniqueOutputs`).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`.
  - Prewarming leaves `hit_count = 0`; user board reads invoke `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) sweeps inactive individual caches after `READING_CACHE_RECYCLE_MINUTES` (`45`).
- **RBAC & Data Privacy:**
  - Strictly gated behind `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest in `SEALED_MODELS` (`KundliDigest`, `TechniqueOutput`, `AreaBuild`, `ReadingDossier`) with `pii2:v1` AES-256-GCM encryption (`src/lib/pii/fields.ts`).
  - Responses enforce `Cache-Control: private, no-store, no-cache, must-revalidate`.
