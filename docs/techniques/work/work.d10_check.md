# Technique Specification: D1 and D10 Agreement Check (`work.d10_check`)

**Technique ID:** `work.d10_check`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts workD10Check, presentState`; `src/reading/area/careerService.ts getCareer`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.d10_check` acts as the multi-varga gatekeeper for every career dasha vote across the main (`S1`), conditional, and karaka clocks. For each running period lord, it compares its placement and dignity in `D1` (Rasi) against `D10` (Dashamsha): a vote counts only when `D1` and `D10` agree on direction, with `D9` (Navamsha) breaking ties and `D60` (Shashtiamsha) confirming only when birth time is recorded to the exact minute. When `D1` and `D10` contradict, the vote is marked `split` and excluded.

---

## 2. Untapped Radha Resources Mapped

`work.d10_check` directly depends on Priority #2 divisional chart fixes in `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`:

- **D10 & D60 Structural Enrichment (Gaps R2 / R3):**
  - Currently `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) omits `D60` (`served: false`), blocking `work.d10_check` from using `D60` even when birth time accuracy is exact to the minute. Expanding `SERVED_VARGAS` to all 23 vargas unlocks `varga.d60`.
  - Simultaneously, Radha's `_build_placements_json` (`AIAstra_Radha/src/jhora/export.py:887-901`) omits `house`, `lagna`, `owns`, `aspects_to`, and `dignity` on `varga.d10`, `varga.d9`, and `varga.d60`, leaving `PlanetCard.house` as `null` in `digest/build.ts:612`. Upgrading `_build_placements_json` and `digest/build.ts` to populate full varga `house_card` and `planet_card` fields makes `workD10Check` 100% authoritative.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Supplies the 20-point *Shodashavarga* / *Dashavarga* dignity score alongside `D1/D10/D9` comparison to break subtle tie states cleanly.
- **D9 Maturation Gate (`D9_MATURITY_AGE_YEARS=36`, Doc 76):** Enhances `D9` tie-breaking with `evaluateD1D9MutualConfirmation` (`src/reading/dasha/dashaAssessment.ts`) so post-36 charts weight `D9` confirmation alongside `D10` execution.
- **Bhava Bala (`strength.bhava`, Gap H6) & `dignities.d10`:** Exposes `D10` 10th/6th/11th house potency and `D10` planetary war/combustion/retrograde status without Node performing any astrological math.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:299`)
```typescript
[
  c('divisional', 'D1'),
  c('divisional', 'D10'),
  c('divisional', 'D9'),
  c('divisional', 'D60'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('natal', 'strength.bhava')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:311`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `activation` | `running lords of the main, conditional and karaka clocks this month` | `activation_row` | Period lords across `S1`, conditional, and karaka clocks |
| `planet` | `D1, D10, D9, D60 cards of those lords` | `planet_card` | Explicit `D10`/`D60` `house`, `dignity`, `owns`, `vimsopaka` |
| `house` | `D10 houses 10,6,1,2,11` | `house_card` | Explicit `D10` `house_card` rows (`lord`, `lord_dignity`, `occupants`) |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `vote_check.v1` (`{ lord, d1Side, d10Side, d9TieBreak, d60Confirm, agreed: boolean, finalSide: 'support' | 'test' | 'split' }`), feeding `work.present_tone`.
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'work.d10_check', claim, evidence, polarity, weight, about: 'work.varga_agreement' }`:
  - `D1 + D10` agreement (or `D9` tie-break + `D60` confirmation): amplifies confidence (`+1.5 .. +2.5` or `-1.5 .. -2.5`).
  - `D1/D10` disagreement (`split`): emits `polarity: 'neutral'`, `weight: 0`, and prevents downstream overclaiming.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `career.ts workD10Check`, invoked as a validation gate by `presentState`, `workConditionalVote`, and `workKarakaVote`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.d10_check` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript card comparison (`< 5 ms`). Zero LLM calls; zero Node astrological math (all `D1`, `D10`, `D9`, and `D60` signs, houses, and dignities come directly from Radha's upgraded `_build_placements_json` stored in `kundli_digest`).
  - **Birth-Time Precision Guard:** `D60` is strictly skipped unless birth-time precision is exact to the minute (`birth_time_exact === true`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Surfaces indirectly via confidence indicators and balanced career wording (e.g., when `D1` promises opportunity but `D10` shows friction: *"Opportunities are visible on paper, though day-to-day execution will take patience before rewards settle."*).
- **Jargon Redaction Rules:** Strictly forbids *Dashamsha*, *Navamsha*, *Shashtiamsha*, *D1/D10/D9/D60*, *Vargottama*, *Vimsopaka*, or internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys in `evidence[]` (e.g., `['d10_check:Sa:d1=support:d10=test:d9=support', 'd60:skipped_birth_precision', 'vimsopaka:Sa:14.2']`).
- **One-Tap "Chart Details":** Displays whether the career execution layer (`D10`) and maturation layer (`D9`) align with the birth promise for the running period lord.
- **Single Past-Event Calibration Question:** When `work.d10_check` flags a split between outward role and inner satisfaction, supports confirm prompts checking whether a promotion felt heavier than expected.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.varga` and `lineman.work` in `work.reading.oracle` via the cached divisional slice in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Source varga cards live in `kundli_digest`; check verdicts cache inside `area_builds` and `technique_outputs` (`freshness: 'dasha'` / `'monthly'`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `KundliDigest`, `AreaBuild`, `TechniqueOutput`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
