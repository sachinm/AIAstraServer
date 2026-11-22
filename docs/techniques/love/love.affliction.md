# Technique Specification: Afflictions on Love & Partnership (`love.affliction`)

**Technique ID:** `love.affliction`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts afflictionLayer, releaseOf` (`src/reading/area/love.ts LOVE`, `boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.affliction` surfaces the specific relational stressors, delays, and emotional blind spots weighing on houses `7, 5, 11, 2, 4, 8, 12`, Venus, Moon, the 7th lord, and `UL`. Crucially, it pairs every pressure with a concrete **release date** (`releaseOf`) computed from the end of the afflicting planet's running period in the activation calendar — ensuring users see temporary challenges with clear horizons rather than fatalistic or permanent doom.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` adds psychological depth and prevents overstating minor stressors:

- **D30 Trimshamsha Structural Unlock (`varga.d30`, Gaps R2 / R3):** `D30` is explicitly listed in `LOVE_PLANNED`'s varga list (`src/techniques/catalog.ts:664`: `vargas: ['D9', 'D7', 'D30']`), yet `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) omits `30` (`served: false`) and Radha's `_build_placements_json` (`export.py:887`) omits explicit `house` and `dignity`. Unlocking `varga.d30` with full house/dignity fields lets `love.affliction` identify subconscious relationship fears, unspoken resentment, and karmic friction in `D30` 7th/8th/12th houses.
- **D9 Navamsha & D7 Saptamsha Affliction Parity (Gaps R2 / R3):** Explicit `D9` and `D7` `house` and `dignity` fields let `afflictionLayer` verify whether a D1 affliction (such as Mars/Saturn on the 7th or Kalathra/Manglik dosha) persists in `D9` or is neutralized.
- **Harsha Bala & Bhava Bala (`strength.harsha`, `strength.bhava`, Gap H6):** When the 7th lord occupies the 6th, 8th, or 12th house (`dusthana`), high Harsha Bala (`>= 15/20`) and strong 7th Bhava Bala distinguish resilience through honest friction from destructive breakdown.
- **Bhava Chalit Shifts (`houseShift`, Gap H8):** Verifies whether Saturn, Mars, Rahu, or Ketu actually occupy the 7th Bhava cusp vs only sharing the 7th Rasi sign, avoiding false malefic pressure claims.
- **Tithi Pravesha `yearLord` (Gap R1):** Ensures running affliction release context is not distorted by a missing TP *Vaaresha* forcing `get_through` stances.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:609, 663-667`)
```typescript
[
  c('natal', 'facts'),
  c('natal', 'dignities'),
  c('natal', 'aspects'),
  c('natal', 'doshas'),
  c('natal', 'avasthas'),
  c('natal', 'house_counts'),
  // Priority 2 additions:
  // c('divisional', 'D30'), c('divisional', 'D9'), c('natal', 'strength.harsha'), c('natal', 'strength.bhava')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:614`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9,D7,D30 houses 7,5,11,2,4,8,12` | `house_card` | Explicit `D30` & `D9` `house_card` rows + `bhava_bala` |
| `planet` | `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord` | `planet_card` | `combust`, `retro`, `avasthas`, `harsha_bala`, `houseShift` |
| `yoga` | `yogas and doshas joining houses 7, 5, 11, 2, 4, 8, 12 or their lords` | `yoga_row` | `Kalathra`, `Manglik`, and cancellation rows |
| `activation` | `running and next periods of the afflicting planets, houses 7,5,11,2,4,8,12` | `activation_row` | Level 1–3 end dates for `releaseOf` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (pressure rows with `{ key, text, weight, until: string | null, evidence[] }`, consumed directly by `love.reconcile` and `love.reading.struggle`).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.affliction', claim, evidence, polarity: 'test', weight, about: 'love.strain' }`:
  - Lord in dusthana (`2`), debilitated without cancellation (`2`), combust (`1`), planetary war (`1`), `Sa/Ma/Ra/Ke` on/aspecting 7th or Venus (`1.5` / `1`), Kalathra/Manglik doshas (`1..2`), normalized to `[-3 .. -0.5]`. Afflictions set the baseline blocker and never flip a verdict alone.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** in `boardService.ts getAreaBoard` -> `houseLayers.ts afflictionLayer` & `releaseOf`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.affliction` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript digest & activation lookup (`< 10 ms`). Zero LLM calls; zero Node astrological calculations (dosha flags, combustion, war, and period end dates come strictly from Radha/digest).
  - **Ethical Guardrail:** Never outputs separation verdicts or permanent incompatibility claims (`love.reading.bond` / `love.reading.audit`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Honest, compassionate, growth-oriented phrasing with clear release dates when active (e.g., *"Old hesitations around trusting a partner's consistency can surface through August 18; clearer dialogue becomes much easier once that phase closes."*).
- **Jargon Redaction Rules:** Strictly suppresses *Manglik*, *Kalathra Dosha*, *Dusthana*, *Papakartari*, *Trimshamsha*, *D30*, *Combustion*, *Planetary War*, *Mrita Avastha*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys in `evidence[]` (e.g., `['D1.h7:occupied_by:Sa', 'dosha:manglik:un_cancelled', 'D30.h7:strain_ve', 'release:vimshottari:Sa:2027-08-18']`).
- **One-Tap "Chart Details":** Displays the exact stressor, whether a cancellation (`love.protection`) softens it, and the active period end date (`until`).
- **Single Past-Event Calibration Question:** When `love.status` is `separated` or `complicated`, pairs with `love.reconcile` to ask one concrete question about when tension peaked.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`family.rasi`, `family.varga`, `lineman.love`) where natal/D30/D9 rows sit inside `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `area_builds` (`area: 'love'`) and `technique_outputs` (`techniqueCacheKey` with `freshness: 'dasha'` when `releaseOf` carries active period dates).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
