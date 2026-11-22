# Technique Specification: Dasha Activation of Love & Partnership (`love.activation`)

**Technique ID:** `love.activation`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts gradeRow, familyVotes, aheadWindows` (`src/reading/area/love.ts LOVE`, `boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.activation` scans all served dasha families across `-13 months` to `+30 years` (`kundli_activation`) for periods activating love houses (`7, 5, 11, 2, 4, 8, 12`). It scores each period lord by functional nature, `D1` dignity, and owning-varga (`D9`/`D7`) agreement, aggregates multi-clock family votes (`main`, `conditional`, `rasi`, `karaka`, `short confirmers`), and extracts dated 36-month relationship windows and 30-year main-clock turning points.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` closes key multi-varga and multi-clock gaps in `love.activation`:

- **D9 Navamsha & D7 Saptamsha Structural Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):** `love.activation` explicitly specifies: *"A dasha vote counts only when D1 and the owning varga (D9) agree; D9 breaks a tie; D60 only with a birth time to the minute"* (`src/techniques/catalog.ts:630`). Unlocking explicit `house`, `owns`, and `dignity` on `varga.d9`, `varga.d7`, `varga.d30`, and `varga.d60` ensures `gradeRow` (`houseLayers.ts`) evaluates real divisional lordships and placements rather than skipping null `D9/D7` house fields.
- **Tithi Pravesha `yearLord` & Annual `D9` (Gaps R1 / R4):** `gradeRow` and `evaluateActiveDashaWithVargaAndTP` (`dashaAssessment.ts:414`) rely on `AnnualRow.yearLord` to avoid failing closed to `get_through`. Exporting TP `year_lord` and dynamic TP `D9` (`divisional_chart_factor=9`) restores balanced `build` vs `get_through` activation windows.
- **Unlocking Conditional, Chara, and Karaka Dashas (Doc 80 §1.4):** Ensuring `dasha.applicable`, `dasha.chara`, and `dasha.karaka` are served (`chartData/catalog.ts:174-188`) populates all seven voting families in `kundli_activation` rather than defaulting to Vimshottari + Narayana only.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Grades period lords on a 20-point scale across *Saptavarga* / *Dasavarga*, breaking ties cleanly when a running dasha lord is mixed in `D1` and `D9`.
- **D9 Maturation Gate (>36 Yrs, Doc 76):** Enforces joint `D1 + D9` mutual confirmation (`D9_MATURITY_AGE_YEARS=36`) on all running Mahadasha/Antardasha lords.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:627, 663-667`)
```typescript
[
  c('dasha', 'vimshottari'),
  c('dasha', 'conditional'),
  c('dasha', 'narayana'),
  c('dasha', 'chara'),
  c('dasha', 'karaka'),
  c('annual', 'tithi_pravesha_dasha'),
  c('dasha', 'yogini'),
  c('dasha', 'tithi_ashtottari'),
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('divisional', 'D30'),
  // Priority 2 additions:
  // c('divisional', 'D60'), c('natal', 'strength.vimsopaka')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:633`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `activation` | `every served system, periods from today to +30 years activating houses 7,5,11,2,4,8,12` | `activation_row` | Full 7-family rows (`vimshottari`, `conditional`, `narayana`, `chara`, `karaka`, `tp_dasha`, `yogini+ta`) |
| `planet` | `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord, the D9 7th lord, and running period lords` | `planet_card` | Explicit `D9`/`D7`/`D30`/`D60` `dignity`, `house`, `vimsopaka`, `dasha_charter` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (`familyVotes[]` feeding Love board tone + `aheadWindows[]` across `36 months` + `turningPoints[]` across `30 years`, routed into `love.meet`, `love.health`, `love.reconcile`).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.activation', claim, evidence, polarity, weight, about: 'love.timing' }`:
  - Each family votes `support` at weighted sum `>= +0.5` (`+1.5 .. +3.0`) or `test` at `<= -0.5` (`-1.5 .. -3.0`); short clocks (`Yogini + Tithi Ashtottari`) vote only when both agree.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (`digest.activation` + `dasha.deep_pull`)** pre-computes 30-year activation rows and level 4–6 deep windows. **Step 2 (`gradeRow`, `familyVotes`, `aheadWindows`)** runs deterministically inside `houseLayers.ts buildBoard`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.activation` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript filtering, weighting, and interval merging (`< 25 ms`). Zero LLM calls; zero Node astrological math (all period start/end dates and activated house arrays come from Radha + `kundli_activation`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Presents clean, dated relationship rhythm windows filtered by `love.status` (e.g., *"From May 10 to September 22, emotional openness and shared plans flow more naturally, making it easier to deepen commitment."*).
- **Jargon Redaction Rules:** Strictly hides *Mahadasha*, *Antardasha*, *Vimshottari*, *Narayana*, *Chara*, *Yogini*, *Tithi Ashtottari*, *D9*, *D60*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys inside `evidence[]` (e.g., `['act:S1:Ve/Ju:2027-05-10..2027-09-22', 'd1_d9:Ju:agree_support', 'vimsopaka:Ju:17.1', 'concordance:confirmed:4_families']`).
- **One-Tap "Chart Details":** Displays the agreeing timing families, the `D1`/`D9` confirmation status of the running period lord, and the exact start/end dates.
- **Single Past-Event Calibration Question:** Supports `Looking back` (`-12 months` edge changes) by asking one concrete question about a past relationship shift around a period boundary.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.dasha` and `lineman.love` in `love.reading.oracle` (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Activation rows live in `kundli_activation`; board selections cache in `area_builds` (`area: 'love'`) and `technique_outputs` (`freshness: 'dasha'`, bounded by the shortest running period span).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; reads invoke `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This is the rule the technique is being built to. It replaces any narrower list of dasha systems above **when the
preparation build of `docs/techniques/11` ships**; until that release the code still reads the systems listed above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice;
  every other system is reported as support and never raises the count. How many voices are counted is a house rule
  awaiting Sachin's confirmation: see `docs/techniques/12` §4 and §9. Longevity dashas are read and never named to the
  person.
- **Tested against, for this technique:** the 7th, 5th and 11th with their lords, Venus, D9, UL and A7.
- **Purpose voice:** Narayana on D9 once the engine casts it; until then Narayana D1, stated.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
