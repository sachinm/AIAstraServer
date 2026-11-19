# Technique Specification: Natal Promise of Houses 1, 4 and 5 with the Moon (`self.promise`)

**Technique ID:** `self.promise`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`promiseLayer`); `src/reading/area/self.ts` (`SELF`); `src/reading/area/boardService.ts` (`getAreaBoard`)  
**Agent ID:** `area.self_board` (upstream digest: `digest.build`; downstream synthesizers: `self.sub.promise`, `self.v2.oracle`, `self.reading_oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.promise` evaluates the foundational natal strength and structural capacity of the Self domain—anchored by the 1st house (vitality, agency, embodied identity), 4th house (inner peace, home, emotional grounding), 5th house (creative intelligence, judgement), 9th house (purpose), 12th house (rest, surrender), and the Moon (*Manas*). It scores supportive placements, planetary dignities, yogas, Bhava strength, and divisional backing from stored digest cards and emits verified, dated-free structural claims with structured evidence keys so downstream boards (`self.sub.promise`, `self.v2.lagna`, `self.v2.yogas`, and `self.reading.oracle`) never guess baseline temperament.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` integrated into `self.promise`:

- **Bhava Bala (`strength.bhava`, Gap H6):**
  - Currently marked `served: false` in `src/reading/chartData/catalog.ts:197`.
  - Radha (`natal_export.py:270–291`, `_build_bhava_bala`) computes `bhavadhipati` (lord strength), `dig` (directional strength), `drik` (aspectual strength), total virupas/rupas, ratio, and rank (`1..12`) for every house.
  - Feeds `self.promise` directly: houses `1, 4, 5, 9, 12` ranked in the top 4 receive `+1` structural promise, while bottom 4 houses receive `-1`, replacing rough sign/aspect heuristics.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Currently marked `served: false` in `src/reading/chartData/catalog.ts:198`.
  - Radha (`natal_export.py:293–309`, `_build_vimsopaka`) computes 20-point scale divisional dignity across `shadvarga`, `saptavarga`, `dasavarga`, and `shodhasavarga` with strong varga counts.
  - Elevates `self.promise` evaluation of the Lagna lord, Sun, Moon, Mercury, Jupiter, and Atmakaraka (`AK`): planets scoring $\ge 15/20$ add sustained resilience to self-promise claims.
- **Unlocking All 23 Divisional Vargas (`D1..D60`, Gaps R2 & R3):**
  - Expanding `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) beyond `{1, 2, 4, 7, 9, 10}` to include `D12, D20, D24, D60` and upgrading Radha `_build_placements_json` (`export.py:887–901`) to emit explicit `house` (`1..12`), `lagna`, `owns`, `aspects_to`, and `dignity` eliminates `house: null` fallbacks in `digest/build.ts:605–630`.
  - Enables `self.promise` to cross-verify D1 promise against D24 (intellect), D20 (inner alignment), and D60 (deep karmic root) with zero Node-side `% 12` math.
- **Sudarshana Chakra (`dhasa/sudharsana_chakra.py`, Gap H4):**
  - Headless 3-wheel export (Lagna, Chandra, Surya wheels) confirms whether a 1st/4th/5th promise holds simultaneously across action (Lagna), mind (Moon), and core vitality (Sun).
- **Bhava Chalit Planetary Shifts (Gap H8):**
  - Explicit sign-to-bhava shift map (`houseShift`) prevents overclaiming an occupant's support in house 1, 4, or 5 when its Bhava Madhya places it in an adjacent house.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:600`):**
  ```typescript
  [
    c('natal', 'facts'), c('natal', 'house_counts'), c('natal', 'dignities'),
    c('natal', 'aspects'), c('jaimini', 'argala'), c('ashtakavarga', 'sav'),
    c('natal', 'strength.bhava'), c('natal', 'strength.vimsopaka'),
    c('natal', 'yogas'), c('natal', 'doshas'), c('jaimini', 'arudhas'),
    c('natal', 'avasthas'), c('divisional', 'D1'), c('divisional', 'D9'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12', 'house_card')` — includes `sav`, `argala`, `lord_dignity`, `aspected_graha`, `aspected_rasi`, plus Priority #2 `bhava_bala_rank` and `bhava_bala_rupas`.
  - `inp('planet', 'D1 and D9 cards of the lagna lord, Moon, Sun, 4th and 5th lords, Mercury, Jupiter, Ketu and AK', 'planet_card')` — includes `dignity`, `avasthas`, `shadbala_rank`, plus Priority #2 `vimsopaka_score` and `house_shift`.
  - `inp('point', 'AK, SL, AL', 'point_row')` — Jaimini reference points and Arudha placements.
  - `inp('yoga', 'yogas and doshas joining houses 1,4,5,9,12 or their lords or area planets', 'yoga_row')` — Raja, Mahapurusha, Dhana, Viparita, and cancellation rows.
- **Contract Output Schema:** `'area_board.v1'` (upgraded from `'house_state.v1'` once built; shared with `self.sub.promise` `self_v2.promise_ledger`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Each verified support emits a structured finding row: `{ technique: 'self.promise', claim: string, evidence: string[], polarity: 'support' | 'neutral', weight: number, about: 'self_and_body' | 'ideas' | 'home' }`.
  - Weight formula: Lord in Kendra/Trikona/Own (`+2`), Lord dignity Exalted/MT/Own (`+2`), Benefic occupant/aspect (`+1`), SAV $\ge 28$ (`+1`), Bhava Bala top 4 (`+1` / bottom 4 `-1`), Vimsopaka $\ge 15$ (`+1`), Yogas (`+1..+3`), scaled by Avastha (`x1.25` Jagrat/Deepta, `x0.5` Mrita/Sushupta), clamped to `[-8, +8]` and normalized to `weight` `1..3` for Oracle synthesis.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Pre-run Digest (`digest.build`):** Worker (`POST /events`) ingests `strength.bhava`, `strength.vimsopaka`, and enriched `D1..D60` rows into `kundli_digest` (zero LLM, zero Node astrological math).
  2. **Deterministic Layer Execution (`self.promise` / `self.sub.promise`):** Runs inside `buildAreaBoard` / `SelfBuildContext` over in-memory `DigestView` (zero raw `kundli_data` DB reads).
  3. **Area Selection & Oracle Brief (`self.v2.lagna`, `self.v2.yogas`, `self.v2.oracle`):** Selects promise ledger entries into `AreaBrief`s and feeds the cached Oracle prefix.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (or `'self.sub'` for v2 sub-technique).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.promise'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (code-only; `model_calls = 0`, `est_cost_usd = 0`).
- **Execution Boundary & Runtime Limits:**
  - Pure TypeScript deterministic evaluation over `DigestView`.
  - Runtime budget: `< 25 ms` per board build; total deterministic Self code phase `< 1 s`.
  - Fail-closed behavior: Any missing card or unserved Priority #2 field drops only that specific sub-claim and records a diagnostic gap string; never fabricates default strengths or `% 12` house positions.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates structural strengths into grounded, second-person plain English without mystical inflation (e.g., *"You recover quickly from pressure because your core steadiness and practical judgment reinforce each other, especially when you protect quiet thinking time."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Lagna*, *Bhava*, *Bhava Bala*, *Vimsopaka*, *Shodashavarga*, *Kendra*, *Trikona*, *Dusthana*, *Arudha*, *Atmakaraka*, *Avastha*, *SAV*, *Radha*, *pyjhora*, *jhora*.
  - Enforced by `validatePersonalDoc` and `self.reading.audit`.
- **Evidence Array Encapsulation:**
  - All astrological proofs live exclusively inside `evidence[]`, e.g.:
    `['digest.house.D1.h1.lord_dignity:own', 'digest.house.D1.h1.bhava_bala_rank:2', 'digest.planet.D1.Mo.vimsopaka:16.2', 'digest.house.D24.h5.sav_or_dignity:strong']`.
- **One-Tap "Chart Details":** Expanding "Chart Details" renders the underlying house focus (1st/4th/5th), planetary dignity states, Bhava Bala rank, and Vimsopaka tier cleanly for technical readers.
- **Single Past-Event Calibration Question:** When core 1st/4th promise splits (e.g., strong 1st Bhava Bala vs. Bhava Chalit shift on 4th), asks one memory-grounded check: *"Has your sense of stability depended more on your own routine than on where you live?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `self.promise` itself executes deterministically with zero LLM tokens (`cacheStore: 'none_deterministic_code'`).
  - Its output promise ledger populates `parts[0]` (the immutable natal prefix, $\ge 1024$ tokens) for `self.v2.oracle` and `self.reading_oracle` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Stored in `technique_outputs` keyed by `techniqueCacheKey(v1|self.promise|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`, and materialized into `area_builds` during board assembly.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`.
  - Prewarming/digest build creates outputs with `hit_count = 0`.
  - Board reads call `informIndividualCacheUsed({ userId, kundliId })` (`src/reading/llm/cacheSweep.ts`), scheduling eviction via `recycleIndividualCaches` after `READING_CACHE_RECYCLE_MINUTES` (`45`) of inactivity; `runScheduledSweep` acts as the safety net.
- **RBAC & Data Privacy:**
  - All GraphQL/REST entrypoints enforce `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`) so users access only their own kundli promises.
  - Underlying rows in `KundliData`, `KundliDigest`, `TechniqueOutput`, and `AreaBuild` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses emit `Cache-Control: private, no-store, no-cache, must-revalidate`.
