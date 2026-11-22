# Technique Specification: Career Authority & Ambition Evolution Across 3 Decades (`work.character_arc`)

**Technique ID:** `work.character_arc`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/selfCharacterAndJoy.ts buildWorkCharacterArc`; `src/reading/area/houseLayers.ts buildBoard`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `area_checks:career`

---

## 1. Executive Summary & Purpose

`work.character_arc` builds a 3-decade career authority and ambition arc — **Last 10 Years**, **Standing Today**, and **Next 10 Years** — anchored in the 10th Bhava (`D1`), Dashamsha (`D10`), *Amatyakaraka* (`AmK`), Saturn (*Shani*), and active Mahadasha/Antardasha trajectories. For users over `D9_MATURITY_AGE_YEARS` (`36`), it enforces joint `D1 + D9` mutual confirmation (`evaluateD1D9MutualConfirmation`) and incorporates the running **Tithi Pravesha** year lord (*Vaaresha*) to contrast long-term vocational maturation with current-year pacing.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` transforms `work.character_arc` from D1-heavy inference into multi-varga, decade-spanning precision:

- **Tithi Pravesha `yearLord` & Annual `D10` (Gaps R1 / R4):** Currently `buildWorkCharacterArc` (`selfCharacterAndJoy.ts:1349`) calls `evaluateActiveDashaWithVargaAndTP`, which fails closed to `stance = 'get_through'` whenever `AnnualRow.yearLord` is `undefined` (`dashaAssessment.ts:414-419`). Exporting `year_lord` and TP `D10` (`divisional_chart_factor=10`) in Radha and parsing them in `digest/build.ts:1177` immediately restores accurate `build` vs `get_through` annual narrative modifiers in the **Standing Today** stage.
- **D10 Dashamsha Structural Enrichment (`varga.d10`, Gaps R2 / R3):** `buildWorkCharacterArc` (`selfCharacterAndJoy.ts:1273, 1313`) reads `view.house('D10', 10)` and `view.planet('D10', d10H10?.lord ?? l10Code)?.house`. Today `PlanetCard.house` in `D10` is `null` because Radha omits `house` in `_build_placements_json` (`export.py:887`), forcing fallback defaults. Returning explicit `D10` `house`, `lagna`, `owns`, and `dignity` makes the **Next 10 Years** house theme selection exact.
- **Sudarshana Chakra (`dhasa/sudharsana_chakra.py`, Gap H4):** Adding headless 3-wheel progression (Lagna, Moon, Sun) enriches the 3-decade narrative by aligning career authority (`Sun`/10th) with public execution (`Lagna`) and emotional resilience (`Moon`).
- **Vimsopaka Bala & Bhava Bala (`strength.vimsopaka`, `strength.bhava`, Gap H6):** Quantifies the enduring potency of `L10`, `AmK`, and `Sa` across vargas so decade themes distinguish high-stamina leadership rises from quiet consolidation phases.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Anchors the **Next 10 Years** stage with dated Saturn and Jupiter return/contact milestones across the coming decade.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:319-328`)
```typescript
[
  c('natal', 'facts'),
  c('natal', 'dignities'),
  c('divisional', 'D1'),
  c('divisional', 'D10'),
  c('divisional', 'D9'),
  c('annual', 'tithi_pravesha'),
  c('jaimini', 'charakaraka'),
  c('dasha', 'vimshottari'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('natal', 'strength.bhava'), c('natal', 'sudarshana_chakra')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:346-352`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D10 houses 10,6,1,2,11` | `house_card` | Explicit `D10` `house`, `lord`, `lord_dignity`, `bhava_bala` |
| `planet` | `D1,D9,D10 cards of 10th lord, Saturn, AmK and running MD/AD lords` | `planet_card` | Explicit `D10` `house`, `dignity`, `vimsopaka`, `avasthas` |
| `point` | `AmK, AK, A10` | `point_row` | `AmK`, `AK` (Karakamsha), `A10` across `D1`/`D9`/`D10` |
| `activation` | `vimshottari, conditional, and rasi periods from -10 to +10 years` | `activation_row` | 40+ dasha system support across -10y to +10y span |
| `annual` | `running Tithi Pravesha year and year lord` | `annual_row` | Populated TP `year_lord` (*Vaaresha*) and TP `D10` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `work_character_arc.v1` (`SelfCharacterArc`: `{ headline, pastDecade, presentNow, nextDecade, windows[] }`, each stage holding `{ id, stage, title, ageSpanLabel, headline, summary, anchorTrait, evidence[] }`).
- **Synthesis Payload (`findings_in`):** Supplies long-arc framing to `work.reading.oracle` (`lineman.work`):
  - **Standing Today** carries the active Mahadasha concordance (`confirmed`/`leaning`/`contested`), `D1+D9` confirmation verdict, and TP stance (`build` -> `+2.0`, `get_through` -> `-1.0`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `buildWorkCharacterArc` (`selfCharacterAndJoy.ts:1261`), executed as part of the Work board build and served via progressive NDJSON (`GET /api/dashboard/sections-stream`) before heavier LLM synthesis completes.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.character_arc` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic assembly (`< 20 ms`). Zero LLM calls; zero Node astrological calculations (all ages, house placements, `D1+D9` dignities, and TP *Vaaresha* come strictly from Radha/digest inputs).
  - **Age Maturation Rule:** Calls `isAgeMatureD9(resolvedAge)` against `getD9MaturityAgeYears()` (`D9_MATURITY_AGE_YEARS=36` in `src/config/env.ts`).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Displays three crisp decade cards (`Last 10 Years`, `Standing Today`, `Next 10 Years`) with age/year tags (e.g., `Ages 36–46 (2016–2026)`) and warm, grounded prose (e.g., *"Over the past ten years your career emphasized operational mastery; today your standing shifts toward visible stewardship and mentoring."*).
- **Jargon Redaction Rules:** Strictly strips *Dashamsha*, *Navamsha*, *Amatyakaraka*, *Shani*, *Tithi Pravesha*, *Vaaresha*, *Mahadasha*, *Sudarshana Chakra*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** All astrological citations live in `stage.evidence[]` (e.g., `['D10.h10:Capricorn(lord=Sa)', 'D1+D9:L10:confirmed_strong', 'annual:TP2026:yearLord=Ju:stance=build', 'active_dasha:vimshottari:Me/Ve']`).
- **One-Tap "Chart Details":** Reveals the active chapter lord, `D1+D9` maturity confirmation status (for age > 36), `D10` career house anchor, and TP annual posture.
- **Single Past-Event Calibration Question:** Invites verification of the `Last 10 Years` pivot (e.g., *"Looking back over the last decade, did your role shift from hands-on delivery to broader decision-making?"*).

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `work.reading.oracle` as structured arc context alongside `parts[0]`'s immutable natal/D10/D9 prefix (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Persisted in `area_builds` (`area: 'career'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, `asOf` year/span).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; read hits invoke `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
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
- **Tested against, for this technique:** every counted voice's maha dasha against the 10th, AL and A10 (the chapter turn).
- **Purpose voice:** Sudasa.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
