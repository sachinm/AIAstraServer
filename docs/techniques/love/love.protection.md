# Technique Specification: What Protects Love & Partnership (`love.protection`)

**Technique ID:** `love.protection`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts protectionLayer` (`src/reading/area/love.ts LOVE`, `boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.protection` identifies the classical safeguards that cushion a user's love life and raise the resilience floor even during stressful periods: Jupiter's grace (*Guru Drishti* on the 7th house, Venus, or `UL`), unobstructed benefic *Argala*, dignified dispositors, *Neecha Bhanga* cancellations, and `D9` Navamsha 7th-house strength. Protections raise the verdict floor and counterbalance `love.affliction` without fabricating unearned promises.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` makes protection scoring far more accurate across divisional layers:

- **D9 Navamsha & D7 Saptamsha Structural Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):** `protectionLayer` explicitly checks `D9.h7 lord_dignity` (`src/techniques/catalog.ts:623`). Upgrading Radha's `_build_placements_json` (`export.py:887`) to emit explicit `house` (1..12), `lagna`, `owns`, `aspects_to`, and `dignity` in `D9` and `D7` enables complete verification of `D9` 7th-house occupants, Jupiter's `D9` drishti on `D9.h7` or `D9.Ve`, and `D9` dispositor chains.
- **Expanded `VARGA_SCOPE` for `argala.d9` & `arudhas.d9` (Gap R2 / §1.1):** Ensuring Radha's `VARGA_SCOPE` exports `argala` and `arudhas` (`UL`, `A7`) consistently across `D1`, `D9`, and `D7` allows `protectionLayer` to verify benefic *Argala* on `UL` in `D9` as well as `D1`.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Measures the 20-point divisional stability of Jupiter, Venus, and the `D9` 7th lord so true protective cushions are weighted higher than weak temporary mitigations.
- **Harsha Bala (`strength.harsha`, Gap H6):** Confirms whether a 7th or 5th lord sitting in a dusthana retains classical protective stamina (`harsha_bala >= 15`).
- **Tithi Pravesha `yearLord` (Gap R1):** Ensures Jupiterian/benefic annual protections (`TP D9`, `TP yearLord`) are surfaced cleanly instead of suppressed by a fail-closed `get_through` stance.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:615, 663-667`)
```typescript
[
  c('natal', 'aspects'),
  c('natal', 'dignities'),
  c('jaimini', 'argala'),
  c('natal', 'yogas'),
  c('natal', 'avasthas'),
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('divisional', 'D30'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('jaimini', 'argala.d9')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:626`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9,D7,D30 houses 7,5,11,2,4,8,12` | `house_card` | Explicit `D9.h7` `lord_dignity`, `aspected_graha`, `argala` |
| `planet` | `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord` | `planet_card` | `dispositor` chain, `dignity` in `D9`/`D7`, `vimsopaka` |
| `point` | `UL, A7, DK, AL` | `point_row` | `UL` house/lord/aspects in `D1` and `D9` |
| `yoga` | `yogas and doshas joining houses 7, 5, 11, 2, 4, 8, 12 or their lords` | `yoga_row` | `Neecha Bhanga` and dosha cancellation rows |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (protection rows `{ key, text, weight, evidence[] }`, consumed by `love.reconcile`, `love.reading.purview`, and `love.reading.oracle`).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.protection', claim, evidence, polarity: 'support', weight, about: 'love.protection' }`:
  - Jupiter aspect/occupancy on `h7`, `Ve`, or `UL` (`+2`), unobstructed benefic argala (`+1`), strong dispositor (`+1`), cancellation yoga (`+2`), `D9 h7` lord dignified (`+2`), scaled to `[+0.5 .. +3.0]`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** in `boardService.ts getAreaBoard` -> `houseLayers.ts protectionLayer`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.protection` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic selection (`< 10 ms`). Zero LLM calls; zero Node astrological calculations (aspects, unobstructed argala, dispositor chains, and cancellation yogas come strictly from Radha/digest).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Reassuring, practical insights explaining what keeps relationships anchored under stress (e.g., *"Deep down, shared wisdom and a strong instinct to talk things through keep bonds intact even when schedules collide."*).
- **Jargon Redaction Rules:** Strictly removes *Jupiter Drishti*, *Neecha Bhanga*, *Argala*, *Upapada Lagna*, *UL*, *D9 Navamsha*, *Dispositor*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Technical proof stored inside `evidence[]` (e.g., `['D1.h7.aspected_graha:Ju', 'D9.h7:lord_dignity:own', 'argala:UL:unobstructed_benefic', 'cancellation:neecha_bhanga:Ve']`).
- **One-Tap "Chart Details":** Shows which protective factors cushion each identified relationship stressor.
- **Single Past-Event Calibration Question:** When paired with `love.reconcile`, asks how the user and partner historically repaired trust after tension.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`family.rasi`, `family.varga`, `lineman.love`) where natal/D9/argala rows sit in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Persisted in `area_builds` (`area: 'love'`) and `technique_outputs` (`freshness: 'natal'`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
