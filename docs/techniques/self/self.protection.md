# Technique Specification: What Protects Houses 1, 4 and 5 with the Moon (`self.protection`)

**Technique ID:** `self.protection`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`protectionLayer`); `src/reading/area/self.ts` (`SELF`)  
**Agent ID:** `area.self_board` (upstream: `digest.build`; downstream: `self.sub.promise`, `self.sub.risk`, `self.reading.purview`, `self.v2.oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.protection` identifies the structural buffers, cancellations, and mitigating graces that stabilize the 1st, 4th, and 5th houses and the Moon when affliction is present. It evaluates Jupiter's protective aspect/occupation, unobstructed benefic Argala, yoga-register cancellations (such as Neecha Bhanga), dispositor strength, and owning divisional confirmations so the board never exaggerates risk when classical safeguards actively hold the chart's floor.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.protection`:

- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Currently `served: false` in `src/reading/chartData/catalog.ts:198`.
  - Radha (`natal_export.py:293–309`) evaluates 20-point multi-varga resilience (`shadvarga`, `saptavarga`, `dasavarga`, `shodhasavarga`).
  - Enhances `self.protection` by confirming whether the dispositor of the Lagna lord or Moon holds $\ge 15/20$ Vimsopaka strength, upgrading a weak Rasi dispositor into a resilient multi-varga protector.
- **Expanded Argala & Arudha Across 23 Vargas (`VARGA_SCOPE`, Gaps R2 & R3):**
  - Radha `natal_export.py:54` currently restricts `VARGA_SCOPE` to 12 vargas. Expanding `VARGA_SCOPE` and `SERVED_VARGAS` unlocks Argala and explicit `house` placements across `D1, D9, D12, D20, D24, D27, D30, D60`.
  - Allows `self.protection` to check protective benefic Argala and dispositor strength not only in D1/D9, but also in `D24` (mental clarity buffer) and `D20` (spiritual grounding buffer).
- **Sudarshana Chakra (`dhasa/sudharsana_chakra.py`, Gap H4):**
  - Checks whether Jupiter's protective aspect (`jupiter_aspects_all_three`) shields the active annual progression across Lagna, Moon, and Sun wheels simultaneously.
- **Bhava Bala (`strength.bhava`, Gap H6):**
  - Verifies high Drik Bala (benefic aspectual strength) on houses `1, 4, 5` directly from pyjhora instead of unweighted aspect counting.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:615`):**
  ```typescript
  [
    c('natal', 'aspects'), c('natal', 'dignities'), c('jaimini', 'argala'),
    c('natal', 'yogas'), c('natal', 'avasthas'), c('natal', 'strength.vimsopaka'),
    c('natal', 'strength.bhava'), c('divisional', 'D1'), c('divisional', 'D9'),
    c('divisional', 'D20'), c('divisional', 'D24'), c('divisional', 'D12'),
    c('divisional', 'D4'), c('divisional', 'D7'), c('divisional', 'D60'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12', 'house_card')` — `aspected_graha`, `argala` (primary, secondary, obstructed), `drik_bala`.
  - `inp('planet', 'D1 and D9 cards of L1, Mo, Su, L4, L5, Me, Ju, Ke, AK and their dispositors', 'planet_card')` — `dispositor`, `dignity`, `vimsopaka_score`.
  - `inp('point', 'AK, SL, AL', 'point_row')`
  - `inp('yoga', 'cancellation rows (Neecha Bhanga, Viparita) joining houses 1,4,5,9,12 or area planets', 'yoga_row')`
- **Contract Output Schema:** `'area_board.v1'` (consumed as graces/holds in `self.sub.promise`, `self.sub.risk`, and `self.reading.purview`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.protection', claim: string, evidence: string[], polarity: 'support', weight: number, about: 'self_and_body' | 'mind' }`.
  - Weight formula: Jupiter occupying or aspecting `h1/h4/h5` or Moon/L1/AL (`+2`), Unobstructed benefic Argala (`+1`), Strong dispositor (`+1`, boosted by `+0.5` if Vimsopaka $\ge 15$), Yoga cancellation row (`+2`), D9 `h1` lord dignified (`+2`). Protections raise the verdict floor and soften risk rows (`holds[]`) without inventing an independent promise.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest Build (`digest.build`):** Extracts `argala.dN`, `yogas` cancellations, `strength.vimsopaka`, `strength.bhava`, and dispositor chains into `kundli_digest`.
  2. **Protection Evaluation (`self.protection`):** Runs deterministically after/alongside `self.affliction` inside `houseLayers.ts` (`protectionLayer`).
  3. **Risk Mitigation & Purview (`self.sub.risk`, `self.reading.purview`):** Matches protection rows (`holds`) against active risks naming the same planet or house, preventing over-alarmist Oracle prose.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'self.protection'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, zero LLM cost).
- **Execution Boundary & Runtime Limits:**
  - Pure code execution over `DigestView`; `< 15 ms` runtime budget.
  - Strict boundary rule: Protections *only* raise the baseline floor and annotate active pressures; they never trigger a `"build"` stance on their own when primary activation presses.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Communicates emotional resilience and practical safety nets clearly (e.g., *"Even when daily demands spike, good counsel and your own long-term perspective keep you from making reactive choices."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Argala*, *Virodha*, *Neecha Bhanga*, *Graha Drishti*, *Dispositor*, *Vimsopaka*, *Drik Bala*, *D9*, *Sudarshana Chakra*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Every safeguard cites exact digest keys in `evidence[]`:
    `['digest.house.D1.h1.aspected_graha:Ju', 'digest.yoga.D1.neecha_bhanga_Mo:present', 'digest.planet.D1.L1_dispositor.vimsopaka:15.8']`.
- **One-Tap "Chart Details":** Displays the specific protective factor (e.g., Jupiter aspect on 1st/Moon, cancellation active, strong dispositor across divisions).
- **Single Past-Event Calibration Question:** Tests whether the buffer worked in lived experience: *"When things got tense last year, did stepping back or talking it over with someone steady keep it from spiraling?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM tokens spent directly (`cacheStore: 'none_deterministic_code'`).
  - Feeds the immutable `self.sub.promise` grace entries inside `parts[0]` of `self.v2.oracle` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Cached inside `technique_outputs` under `techniqueCacheKey(v1|self.protection|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered via `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; inactive records evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Gated by `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Encrypted at rest in `SEALED_MODELS` (`KundliDigest`, `TechniqueOutput`, `AreaBuild`) under `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
