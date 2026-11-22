# Technique Specification: Relationship & Emotional Bond Evolution Across 3 Decades (`love.relationship_arc`)

**Technique ID:** `love.relationship_arc`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/selfCharacterAndJoy.ts buildLoveRelationshipArc`; `src/reading/area/houseLayers.ts buildBoard`  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.relationship_arc` builds a 3-decade relational evolution arc — **Last 10 Years**, **Where Your Heart Stands Now**, and **Next 10 Years** — anchored in the 7th Bhava (`D1`), Navamsha (`D9`), Saptamsha (`D7`), Venus (*Shukra*), *Dara Karaka* (`DK`), and *Upapada Lagna* (`UL`). For users above `D9_MATURITY_AGE_YEARS` (`36`), it enforces joint `D1 + D9` mutual confirmation (`evaluateD1D9MutualConfirmation`) and merges active 40+ Mahadasha concordance with the running **Tithi Pravesha** annual return (`evaluateActiveDashaWithVargaAndTP`).

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` removes current fail-closed limitations and null divisional fallbacks in `buildLoveRelationshipArc` (`selfCharacterAndJoy.ts:946-1177`):

- **Tithi Pravesha `yearLord` & Annual `D9` (Gaps R1 / R4):** `buildLoveRelationshipArc` calls `evaluateActiveDashaWithVargaAndTP` (`selfCharacterAndJoy.ts:1051`), which fails closed to `stance = 'get_through'` whenever `AnnualRow.yearLord` is missing (`dashaAssessment.ts:414-419`). Exporting `year_lord` and dynamic TP `D9` (`divisional_chart_factor=9`) in Radha and parsing them in `digest/build.ts:1177` restores true `build` vs `get_through` annual relationship phrasing in **Where Your Heart Stands Now**.
- **D9 Navamsha & D7 Saptamsha Structural Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):** `buildLoveRelationshipArc` (`selfCharacterAndJoy.ts:1120-1125, 1151`) inspects `D7` Venus, `D7` 7th lord, and `D9` 7th house. Upgrading Radha's `_build_placements_json` (`export.py:887`) to return explicit `house` (1..12), `lagna`, `owns`, and `dignity` populates complete `D9` and `D7` cards in `kundli_digest` without null house fallbacks.
- **Vimsopaka Bala & Bhava Bala (`strength.vimsopaka`, `strength.bhava`, Gap H6):** Quantifies the enduring strength of `L7`, `Ve`, `DK`, and `7th`/`5th` houses across the 30-year span.
- **Sudarshana Chakra (`dhasa/sudharsana_chakra.py`, Gap H4):** Cross-checks 7th-house progression from Lagna (commitment action), Moon (emotional security), and Sun (shared purpose) across each decade window.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Anchors the **Next 10 Years** stage with upcoming Saturn/Jupiter transits over `D1`/`D9` 7th houses and Venus.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:792-801`)
```typescript
[
  c('natal', 'facts'),
  c('natal', 'dignities'),
  c('divisional', 'D1'),
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('annual', 'tithi_pravesha'),
  c('jaimini', 'charakaraka'),
  c('dasha', 'vimshottari'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('natal', 'strength.bhava'), c('natal', 'sudarshana_chakra')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:819-825`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9,D7 houses 7,5,4,8,2,11` | `house_card` | Explicit `D9` & `D7` `house`, `lord`, `lord_dignity`, `bhava_bala` |
| `planet` | `D1,D9,D7 cards of 7th lord, Venus, DK and running MD/AD lords` | `planet_card` | Explicit `D9`/`D7` `house`, `dignity`, `vimsopaka` |
| `point` | `DK, UL` | `point_row` | `DK` & `UL` house/lord mappings in `D1` and `D9` |
| `activation` | `vimshottari, conditional, and rasi periods from -10 to +10 years` | `activation_row` | Multi-clock concordance across 40+ systems |
| `annual` | `running Tithi Pravesha year and year lord` | `annual_row` | Populated TP `year_lord` (*Vaaresha*) and TP `D9` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `love_relationship_arc.v1` (`SelfCharacterArc`: `{ headline, pastDecade, presentNow, nextDecade, windows[] }` with stage titles `'Last 10 Years'`, `'Where Your Heart Stands Now'`, `'Next 10 Years'`).
- **Synthesis Payload (`findings_in`):** Supplies multi-decade relationship context to `love.reading.oracle` (`lineman.love`), weighting post-36 `D1+D9` mutual confirmation (`confirmed_strong`/`d9_redeemed` `+2.0`, `d9_weakened`/`confirmed_weak` `-1.5`) and TP annual stance (`build` `+1.5`, `get_through` `-1.0`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `buildLoveRelationshipArc` (`selfCharacterAndJoy.ts:946`), executed as part of the Love board build and streamed progressively via `GET /api/dashboard/sections-stream` (`application/x-ndjson`).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.relationship_arc` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic assembly (`< 20 ms`). Zero LLM calls; zero Node astrological math (age gating uses `getD9MaturityAgeYears()` = `36`, and all `D1/D9/D7` dignities and TP *Vaaresha* come strictly from Radha/digest).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Three empathetic, plain-English decade cards with age-bracket labels (`Ages 36–46`, `Age 46`, `Ages 46–56`): e.g., *"Today you value straightforward communication and kept promises over guesswork—bringing steadiness, loyalty, and warmth when reciprocity is clear."*
- **Jargon Redaction Rules:** Strictly strips *Navamsha*, *Saptamsha*, *Dara Karaka*, *Upapada Lagna*, *Tithi Pravesha*, *Vaaresha*, *Mahadasha*, *D1+D9*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** All chart citations stored strictly inside `evidence[]` (`['D1.Ve:Taurus(H7)', 'D9.Ve:Libra(own)', 'D1.point.DK:Me', 'D1.point.UL:H7', 'annual:TP2026:yearLord=Ju:stance=build']`).
- **One-Tap "Chart Details":** Reveals the running chapter lord, `D1+D9` maturity confirmation status, `D7` continuity markers, and TP annual cycle stance.
- **Single Past-Event Calibration Question:** Invites reflection on the past 10 years' relational shift (e.g., *"Over the past decade, did your definition of a trustworthy partner shift from chemistry toward steadiness?"*).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`lineman.love`) while keeping natal/D9/D7 slices in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `area_builds` (`area: 'love'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, and active year/dasha span).
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
- **Tested against, for this technique:** the D9 lagna and 7th lord, UL, the Darakaraka.
- **Purpose voice:** Narayana on D9 once the engine casts it; until then Narayana D1, stated.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
