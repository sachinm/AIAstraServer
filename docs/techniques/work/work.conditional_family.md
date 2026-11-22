# Technique Specification: Conditional Clock (`work.conditional_family`)

**Technique ID:** `work.conditional_family`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts workConditionalVote, presentState`; `src/reading/area/careerService.ts getCareer`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.conditional_family` casts the **Conditional Clock** family vote (`support`, `test`, or `neutral`) for `work.present_tone` whenever the native's chart satisfies classical eligibility rules for one or more conditional dashas (`dasha.applicable`: e.g., *Ashtottari*, *Dwadasottari*, *Shodasottari*, *Panchottari*, *Shattrimsa Sama*, *Dwisatpathi*, *Chathuraaseethi Sama*). Running level-1 and level-2 lords covering the current month are weighted (`1.0` and `0.5`) and cross-checked across D1 and D10 (`work.d10_check`); if no conditional dasha applies to the chart, the family abstains cleanly without distorting the voting threshold.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` eliminates silent abstentions and strengthens conditional lord grading:

- **Unlocking `dasha.applicable` and Conditional Dasha Serving (Doc 80 §1.4):** In `src/reading/chartData/catalog.ts:174-188`, `dasha.applicable` and 20+ conditional `GRAHA_DASHAS` default to `served: false` unless explicitly flipped on demand or pre-pulled by `dasha.deep_pull`. Ensuring `dasha.applicable` and applicable level 1–3 conditional dashas are served and populated in `kundli_activation` (`family: 'conditional'`) moves `work.conditional_family` out of `FAMILIES_NOT_BUILT` (`career.ts:46`).
- **D10 Dashamsha Structural Enrichment (`varga.d10`, Gaps R2 / R3):** `workConditionalVote` relies on `workD10Check` to verify `D1/D10` agreement for every conditional period lord. Upgrading Radha's `_build_placements_json` (`export.py:887`) to emit explicit `D10` `house`, `owns`, and `dignity` ensures conditional lords are never marked split or unresolved due to `house: null` in `digest/build.ts:612`.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Supplies the 20-point multi-divisional score (`shadvarga`/`dasavarga`) of the active conditional Mahadasha and Antardasha lords, resolving borderline neutral grades (`-0.5 < score < +0.5`) when D1 and D10 dignities are mixed.
- **Harsha Bala (`strength.harsha`, Gap H6):** Evaluates whether a conditional lord placed in D1/D10 house 6, 8, or 12 delivers resilient competitive victory (`harsha_bala >= 15`) rather than career setbacks.
- **D9 Navamsha Mutual Confirmation (>36 Yrs, Doc 76):** For natives above `D9_MATURITY_AGE_YEARS=36`, pairs `D1 + D10` checks with `D9` tie-breaking on the running conditional lord (`evaluateD1D9MutualConfirmation`).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:261`)
```typescript
[
  c('dasha', 'applicable'),
  c('dasha', 'conditional'),
  // Priority 2 additions:
  // c('divisional', 'D10'), c('divisional', 'D9'), c('natal', 'strength.vimsopaka'), c('natal', 'strength.harsha')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:272`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `activation` | `conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1` | `activation_row` | Populated `family: 'conditional'` periods for all applicable systems |
| `planet` *(P2)* | `D1,D10,D9 cards of running conditional L1–L2 lords` | `planet_card` | Explicit `D10` `house`, `dignity`, `vimsopaka`, `harsha_bala` |
| `house` *(P2)* | `D1,D10 houses 10,6,1` | `house_card` | Explicit `D10` house cards for `workD10Check` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `family_vote.v1` (`{ family: 'conditional', label: 'Conditional clock', vote: 'support' | 'test' | 'neutral', planet: string | null }`), feeding `work.present_tone`.
- **Synthesis Payload (`findings_in`):** Emits `{ technique: 'work.conditional_family', claim, evidence, polarity, weight, about: 'work.timing' }`:
  - Level-1 period weighs `1.0`; level-2 period weighs `0.5`. Sum `>= +0.5` casts `support` (`+1.5`); `<= -0.5` casts `test` (`-1.5`); otherwise `neutral` (`0`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (`digest.activation` + `dasha.deep_pull`)** populates applicable conditional systems in `kundli_activation`. **Step 2 (`workConditionalVote`)** executes deterministically inside `career.ts presentState`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.conditional_family` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript filtering and weighted sum (`< 5 ms`). Zero LLM calls; zero Node astrological math (applicability of conditional dashas is determined strictly by Radha's `dasha.applicable` output).
  - **Graceful Abstention:** When `dasha.applicable` lists no qualifying system for the native's birth chart, the family casts no vote and `presentState` scales `available` accordingly.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Never surfaces standalone system names; instead strengthens or tempers the confidence badge (`confirmed` / `likely` / `split`) of `work.present_tone` and `work.reading.chapters` (e.g., *"Multiple independent timing cycles confirm steady traction over the next two months."*).
- **Jargon Redaction Rules:** Strictly suppresses names such as *Ashtottari*, *Dwadasottari*, *Shodasottari*, *Chathuraaseethi Sama*, *Shattrimsa*, *Vimsopaka*, *Harsha Bala*, and internal engine identifiers (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Stores full system provenance in `evidence[]` (e.g., `['cond:dwadasottari:L1=Ve:L2=Sa', 'd10_check:Ve:agree_support', 'vimsopaka:Ve:16.4']`).
- **One-Tap "Chart Details":** Displays which specialized timing clock applies to the user's chart and how its running period aligns with `work.present_tone`.
- **Single Past-Event Calibration Question:** Supports `work.looking_back` edge verification when a conditional level-1 shift occurred within the past 12 months.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Conditional clock rows enter `work.reading.oracle` through `family.dasha`'s `cachedPrefix` (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Source periods live in `kundli_activation` (`family: 'conditional'`); family votes cache inside `area_builds` and `technique_outputs` (keyed by `kundliId`, `digestVersion`, and monthly span).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This section overrides any narrower list of dasha systems above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice.
  At most four voices are counted (star, sign, purpose, year); every other system is reported as support and never
  raises the count. Longevity dashas are read and never named to the person.
- **Tested against, for this technique:** the 10th and its lord, the D10 lagna and lords.
- **Purpose voice:** Sudasa. The conditional dasha that applies is part of the star voice, not a vote of its own.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows. The code and the lens recipes change with that build; until then this
  technique reads the systems listed above.
