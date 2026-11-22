# Technique Specification: Sudarshana Chakra 3-Wheel Synthesis (`general.sudarshana_chakra`)

**Technique ID:** `general.sudarshana_chakra`  
**Category:** `general`  
**Board:** `chat` (cross-routed to `you`, `work`, and `love` boards)  
**Status:** `planned` (Priority #2 Gap H4 — new technique specification)  
**Owning Code Path:** `src/reading/codeReaders/readers.ts` (`sudarshanaChakra` — proposed); `src/reading/chartData/catalog.ts`; `src/techniques/catalog.ts`  
**Agent ID:** `reading.code.sudarshana_chakra` (proposed registry row in `src/agents/registry.ts`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.sudarshana_chakra` closes Priority #2 High-Value Gap **H4** (`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md:51`) by integrating `pyjhora`'s **Sudarshana Chakra** (`dhasa/sudharsana_chakra.py`) into the reading pipeline. Evaluating the three concentric reference wheels simultaneously—**Lagna Chakra** (physical action/body), **Chandra Chakra** (mind/emotions), and **Surya Chakra** (soul/vitality/authority)—alongside its 1-year-per-sign annual progression (`age_years` -> `progression_house`), it identifies high-conviction "triple alignment" moments where body, mind, and core purpose agree on the same life theme.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `general.sudarshana_chakra`:

- **Headless Sudarshana Chakra JSON Export (`AIAstra_Radha/src/jhora/horoscope/dhasa/sudharsana_chakra.py:24, 42`, Gap H4):**
  - `sudharshana_chakra_chart` and `sudharsana_chakra_dhasa_for_divisional_chart` already exist in `pyjhora`, computing all 3 wheels (`lagna`, `moon`, `sun`) and the annual 1-year-per-sign progression across age years.
  - Currently lacks a headless HTTP export wrapper in `AIAstra_Radha/src/jhora/export.py` and catalog registration in `AIAstra_Server/src/reading/chartData/catalog.ts`.
  - Adding `type: "sudarshana_chakra"` in Radha's `export.py` (emitting the verified schema: `age_years`, `progression_house`, `wheels.lagna|moon|sun` with `reference_sign`, `active_sign`, `active_house`, `lord`, `occupants[]`, `aspects[]`, and `triple_alignment` flags such as `jupiter_aspects_all_three` and `shared_activating_planets[]`) allows Server to consume 3-wheel alignment with zero Node astrological math.
- **Divisional Sudarshana Chakra (`D9`, `D10`, Gaps R2 & H4):**
  - `sudharsana_chakra_dhasa_for_divisional_chart` natively supports divisional wheels (`D9` for relationships/maturation, `D10` for career authority), unlocking multi-varga 3-wheel confirmation when `SERVED_VARGAS` expands to 23 vargas.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` to register in `src/techniques/catalog.ts`):**
  ```typescript
  [
    c('natal', 'sudarshana_chakra'),
    c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D10'),
    c('natal', 'facts'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('point', 'Sudarshana Chakra 3-wheel natal alignment and current age progression_house across Lagna, Chandra, and Surya wheels', 'sudarshana_wheel')` *(planned `LayoutId` per Doc 81 §3.2; maps from `point_row` until `sudarshana_wheel` lands in `layouts.ts`)*
  - `inp('house', 'D1 houses matching the active progression_house across Lagna, Moon, and Sun wheels', 'house_card')`
  - `inp('planet', 'D1 cards of shared_activating_planets and active wheel lords', 'planet_card')`
- **Contract Output Schema:** `'findings.v3'` while `status: 'planned'` (strictly complying with `tests/unit/techniques/contracts.test.ts:57`, which requires `'findings.v3'` for planned `general.oracle` techniques; `contract.inputs` may also remain `[]` while `planned` per `src/techniques/contracts.ts:134`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Deterministic claims (`<= 8` claims, `weight: 1..3`):
    - `triple_alignment.jupiter_aspects_all_three === true` -> high-conviction protective alignment (`support`, `weight: 2`).
    - Planet in `shared_activating_planets[]` that is functional benefic and dignified -> unified multi-tier momentum (`support`, `weight: 2`).
    - Active annual `progression_house` (`age_years % 12` computed in Radha) occupied by functional malefic across 2+ wheels -> concerted test requiring pacing (`pressure`, `weight: 2`).
    - Divergence between Lagna wheel (action) and Moon wheel (mind) -> explains internal friction vs. external progress (`neutral`, `weight: 1`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Chart Data Ingestion (`ensureChartData` -> `digest.build`):** Pulls `sudarshana_chakra` during registration/digest build (or on-demand for active age progression) and stores wheel markers in `kundli_digest`.
  2. **Deterministic Code Reader (`general.sudarshana_chakra`):** Runs inside `runCodeReadersCached` (`src/reading/codeReaders/readers.ts`) in `< 5 ms` with zero LLM calls, feeding structured findings (`findings.v3` while `status: 'planned'`) to `general.oracle` and enriching `self.character_arc` / `self.annual`.
  3. **Oracle Synthesis (`general.oracle`):** Uses 3-wheel agreement to calibrate answer conviction.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - Register `'sudarshana_chakra'` in `CODE_READERS` (`trace.ts:36`) and `AGENTS` (`src/agents/registry.ts`).
  - `agentIdOf('code:sudarshana_chakra')` -> `'reading.code.sudarshana_chakra'`.
  - `techniqueIdOf('code:sudarshana_chakra')` -> `'general.sudarshana_chakra'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (code-only, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - `< 5 ms` CPU execution; zero live Radha HTTP calls on the chat request path once digested.
  - Strict engine isolation: `progression_house`, `active_sign`, and 3-wheel `occupants`/`aspects` come exclusively from Radha's `sudharsana_chakra.py` export; Node performs zero wheel rotation arithmetic.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Expresses 3-wheel agreement as alignment between action, mindset, and long-term purpose (e.g., *"This year marks a rare point where your day-to-day motivation, emotional peace, and career direction all pull in the same direction."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on consumer surfaces: *Sudarshana Chakra*, *Lagna Chakra*, *Chandra Chakra*, *Surya Chakra*, *Progression House*, *Dasha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All wheel coordinates and progression states remain inside `evidence[]`:
    `['sudarshana.age42.progression_house:7', 'sudarshana.wheel.lagna.active:Virgo(Me)', 'sudarshana.wheel.moon.active:Taurus(Ve)', 'sudarshana.triple_alignment.shared:Ju,Me']`.
- **One-Tap "Chart Details":** Shows the three concentric alignment lenses (Action/Lagna, Mind/Moon, Purpose/Sun) and which shared planets activate the current year.
- **Single Past-Event Calibration Question:** Checks past triple-alignment years: *"Looking back at age [last major alignment year], did major shifts in your mindset and outer circumstances happen almost simultaneously?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Compact findings flow into downstream `general.oracle` / `self.v2.oracle` synthesis.
- **Findings & Output Persistence:**
  - Wrapped in `withTechniqueOutput` and persisted in `technique_outputs` keyed by `techniqueCacheKey(v1|general.sudarshana_chakra|<contractHash>|<kundliId>|d:<digestVersion>|annual:<ageYear>)`.
- **45-Minute Inactivity Lifecycle:**
  - Register `'general.sudarshana_chakra': ['code:sudarshana_chakra']` in `src/techniques/subagentCachePlan.ts` (`recycledEvery45m: true`).
  - Live reads invoke `informIndividualCacheUsed({ userId, kundliId })`; inactive outputs recycle after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliData`, `KundliDigest`, and `TechniqueOutput` encrypted at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

## Who reads this technique (corrected 2026-11-22, `docs/techniques/11` rev 4 §4.9)

The lines above say this technique feeds `self.v2.oracle` synthesis. Checked on `develop` on 2026-11-22: **it never reached any
reading code.** No file of the v2 build, the per-card pipeline, the linemen or the family readers reads its output.
It is a specification only. If it is wanted in readings it needs a supplier and a reader named in
`docs/techniques/11` §4.9, and nothing in a prompt may name it until then.
