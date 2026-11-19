# Technique Specification: Owning Divisional Charts for Love (`love.varga`)

**Technique ID:** `love.varga`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts vargaLayer` (`src/reading/area/love.ts LOVE`, `boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.varga` cross-checks Love houses (`7, 5, 11` primary; `2, 4, 8, 12` secondary) across their owning divisional charts — **D9 (Navamsha)** for covenant and marriage harmony, **D7 (Saptamsha)** for romance, attraction, and creative/family continuity, and **D30 (Trimshamsha)** for hidden emotional anxieties or karmic friction. It verifies the natal 7th lord's dignity in the varga, the varga's own 7th/5th house lords, and *Vargottama* placements, producing a net `agrees` / `disagrees` / `neutral` signal that validates or filters `love.activation` dasha votes.

---

## 2. Untapped Radha Resources Mapped

`love.varga` is directly throttled by two Priority #2 divisional gaps in `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`:

- **Unlocking `D30` in `SERVED_VARGAS` (Gap R2):** In `src/techniques/catalog.ts:664`, `LOVE_PLANNED` declares `vargas: ['D9', 'D7', 'D30']`, yet `src/reading/chartData/catalog.ts:133` restricts `SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10])`, marking `D30` as `served: false`. Expanding `SERVED_VARGAS` to all 23 vargas unlocks `varga.d30` so `vargaLayer` can read `D30` 7th/5th/12th house cards natively.
- **Explicit `house`, `lagna`, `owns`, `aspects_to`, and `dignity` on `D9`, `D7`, `D30` (Gap R3):** Currently `AIAstra_Radha/src/jhora/export.py:887-901` (`_build_placements_json`) omits explicit `house` numbers (1..12), `lagna`, lordships, and varga dignities, causing `digest/build.ts:612` (`placementCards`) to leave `house: null` on divisional `planet_card` rows. Upgrading `_build_placements_json` unlocks true *Vargottama* house comparison (`D1` house vs `D9`/`D7` house), accurate varga house-lord identification, and `D9`/`D7` arudha placement (`arudhas.d9`, `arudhas.d7`) with zero Node `% 12` arithmetic.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Quantifies 20-point composite varga dignity for Venus, the 7th lord, and active dasha lords across `D1, D7, D9, D30`.
- **D9 Maturation Gate (>36 Yrs, Doc 76):** Pairs `vargaLayer` with `evaluateD1D9MutualConfirmation` (`D9_MATURITY_AGE_YEARS=36`) to distinguish *Neecha Vargottama* (`Drudha Karma`) from *D9 Redeemed* (`+1.2`) and *False Promise* (`-1.0`).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:648, 663-667`)
```typescript
[
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('divisional', 'D30'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('jaimini', 'arudhas.d9'), c('jaimini', 'arudhas.d7')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:653`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9,D7,D30 houses 7,5,11,2,4,8,12` | `house_card` | Explicit `D9`, `D7`, `D30` `house`, `lord`, `lord_dignity`, `occupants`, `aspected_graha` |
| `planet` | `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord` | `planet_card` | Explicit `D9`/`D7`/`D30` `house`, `dignity`, `vimsopaka` |
| `point` | `arudhas of houses 7,5,11,2,4,8,12 in D9, D7, D30` | `point_row` | `UL`, `A7`, `A5` placements inside `D9` and `D7` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (board support/pressure rows + net varga agreement `agrees` | `disagrees` | `neutral`, gating `love.activation` dasha votes).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.varga', claim, evidence, polarity, weight, about: 'love.varga' }`:
  - Natal D1 lord dignified in owning varga (`+1.5`) or debilitated (`-1.5`); varga house lord dignified/kendra/trikona (`+1`) or dusthana/debilitated (`-1`); *Vargottama* house alignment (`+1`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `houseLayers.ts vargaLayer` (`boardService.ts getAreaBoard`), immediately gating `love.activation` votes.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.varga` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic card comparison (`< 5 ms`). Zero LLM calls; zero Node astrological calculations (all `D9`, `D7`, and `D30` houses, dignities, and arudhas originate from Radha's upgraded `_build_placements_json` and `arudhas.d<N>`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Expresses inner vs outer relationship reality in everyday language (e.g., *"Beneath surface attraction, long-term shared values and emotional maturity anchor your strongest partnerships."*).
- **Jargon Redaction Rules:** Strictly strips *Navamsha*, *Saptamsha*, *Trimshamsha*, *Vargottama*, *D9*, *D7*, *D30*, *A7*, *UL*, *Vimsopaka*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys inside `evidence[]` (e.g., `['D9.h7:lord=Ma:exalted', 'D7.h5:Ve:own_sign', 'D30.h7:Sa:pressure', 'vargottama:Ve:house=7']`).
- **One-Tap "Chart Details":** Displays whether the inner partnership layer (`D9`), romance/continuity layer (`D7`), and hidden-strain layer (`D30`) reinforce or challenge the birth promise.
- **Single Past-Event Calibration Question:** When `D1` and `D9` diverge significantly (especially after age 36), supports confirm prompts checking whether relationships improved or deepened with maturity.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.varga` and `lineman.love` in `love.reading.oracle` (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `kundli_digest` (`D9`, `D7`, `D30` rows), `area_builds` (`area: 'love'`), and `technique_outputs` (`freshness: 'natal'`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `KundliDigest`, `AreaBuild`, `TechniqueOutput`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
