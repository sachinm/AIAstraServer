# Technique Specification: Present Tone (`work.present_tone`)

**Technique ID:** `work.present_tone`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts presentState` (served via `src/reading/area/careerService.ts getCareer`)  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `area_checks:career`

---

## 1. Executive Summary & Purpose

`work.present_tone` determines the user's immediate career atmosphere (`easing`, `demanding`, `closing`, `open`, or `steady`) along with a three-tier confidence rating (`confirmed`, `likely`, or `split`) and actionable boundary dates (`ease_date`, `window_end`, `next_window_start`). It aggregates a 3-month rolling window (prior, current, and next month) across multi-clock dasha families, transit contacts, and Jaimini points so the Work board opens with an honest, grounded summary of present momentum rather than generic horoscope prose.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` upgrades `work.present_tone` from a 5-family Phase 1 vote (`S1`, `S4`, `S2+S3`, `S6/S6D`, `S7`) to full 8-family convergence with high-precision strength and transit gating:

- **Tithi Pravesha Annual Engine (`annual.tithi_pravesha`, Gap R1 / R4):** Currently `work.annual_family` is listed in `FAMILIES_NOT_BUILT` (`src/reading/area/career.ts:46`) because `annual.tithi_pravesha` omits `yearLord` (*Vaaresha*) and `src/reading/digest/build.ts:1177` only parses `yearLord` for `kind === 'VP'`. Exporting `year_lord`, `return_instant.panchanga`, and dynamic TP `D10` (`divisional_chart_factor=10`) unblocks the Annual Family vote inside `presentState` and stops `dashaAssessment.ts:414-419` from failing closed to `get_through`.
- **Divisional Chart Structural Enrichment (`varga.d10`, Gaps R2 / R3):** Expanding `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) and upgrading `_build_placements_json` (`AIAstra_Radha/src/jhora/export.py:887`) to emit explicit `house` (1..12), `lagna`, `owns`, `aspects_to`, and `dignity` removes `house: null` fallbacks in `digest/build.ts:612` and enables accurate `D1/D10` vote confirmation (`work.d10_check`).
- **Transit Ashtakavarga (`transit_ashtakavarga`, Gap H5):** Flipping `served: true` in `src/reading/chartData/catalog.ts:263` feeds natal SAV house points, planetary BAV points, and Kakshya `has_bindu` flags into the Slow Transits (`S6/S6D`) family vote over houses `10, 6, 1`, separating high-bindu support transits from empty-kakshya delays.
- **Gochara Vedha & Murti Nirnaya (Gaps H1 / H2):** Prevents `S6/S6D` from overclaiming support when a benefic transit over the 10th or 11th house is obstructed by an opposing planet, and weights Saturn/Jupiter/Rahu pressure by Moon-at-ingress metal vehicle (*Swarna/Rajata/Tamra/Loha*).
- **Additional Strength Models (`strength.vimsopaka`, `strength.harsha`, Gap H6):** Setting `served: true` in `src/reading/chartData/catalog.ts:197-199` supplies 20-point Vimsopaka and Harsha scores for period lords so driver planets running through trik houses (`6, 8, 12`) are weighted accurately.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Extends `transit_contacts` beyond 2026 so `ease_date` and `next_window_start` remain accurate across decade-long horizons.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:94-104`)
```typescript
[
  c('dasha', 'vimshottari'),
  c('dasha', 'yogini'),
  c('dasha', 'tithi_ashtottari'),
  c('dasha', 'narayana'),
  c('transit', 'transit_contacts'),
  c('transit', 'double_transit'),
  c('jaimini', 'modifier'),
  c('natal', 'house_counts'),
  c('natal', 'facts'),
  // Priority 2 additions:
  // c('divisional', 'D10'), c('ashtakavarga', 'transit_ashtakavarga'), c('annual', 'tithi_pravesha'), c('natal', 'strength.vimsopaka')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:110-113`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D10 houses 10,6,1,2,11` | `house_card` | Explicit `D10` `house` (1..12), `lord_dignity`, `sav`, `aspected_graha` |
| `activation` | `families S1, S4, S2+S3, S6/S6D, S7 ±24 months` | `activation_row` | Expanded with Conditional (`S2c`), Karaka, and TP Annual family votes |
| `transit` | `contacts and double transit on houses 10,6,1 and their lords ±24 months` | `transit_row` | Populated `bindus` (SAV/BAV + Kakshya `has_bindu`), Vedha flag, 2027–2036 contacts |
| `planet` *(P2)* | `D1,D10 cards of active period lords` | `planet_card` | `vimsopaka`, `harsha_bala`, explicit D10 `dignity` |
| `annual` *(P2)* | `running TP D1/D10 (tp_start <= now < tp_end)` | `annual_row` | Populated `year_lord` (*Vaaresha*) and `D10` year houses |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `career_map.v1` (`PresentState` inside `CareerMap`: `tone`, `confidence`, `votes[]`, `available`, `agree`, `ease_date`, `window_end`, `next_window_start`, `security`).
- **Synthesis Payload (`findings_in`):** When consumed by `work.reading.diagnosis` or `work.reading.oracle` (`lineman.work`), `present_tone` emits structured finding rows `{ technique: 'work.present_tone', claim, evidence, polarity, weight, about: 'work' }`:
  - **Polarity & Weight (`-3 .. +3`):** Derived deterministically from family agreement: `open`/`easing` with `confirmed` confidence maps to `+2.0 .. +3.0`; `steady` maps to `0 .. +0.5`; `closing` maps to `-1.0`; `demanding` with `risk`/`high_risk` security maps to `-2.0 .. -3.0`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** in `careerService.ts getCareer` — executes after `kundli_digest` and `kundli_activation` are built (`digest.build`, Step 1) and before `work.reading.oracle` (Steps 3–4).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_inputs` (for `transit_contacts` load) and `area.career_map` (for `presentState` computation).
  - **Tagged `technique_id` (`withAgentRun`):** `work.present_tone` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'` / `'engine_pull'`, `model: null`, `est_cost_usd: null`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic code in the Server API Lambda (`src/reading/area/career.ts`); **zero LLM calls** and **zero Node astrological calculations** (all house counts, dignities, bindus, and dates are read verbatim from stored engine tables/digest).
  - **Latency Budget:** `< 100 ms` over pre-pulled `TimelineInputs` and `DigestView`.
  - **Concurrency & Fallback:** Runs inline per board build; if `annual.tithi_pravesha` or `transit_ashtakavarga` is absent, scales voting denominator cleanly to available families and records a gap note rather than guessing.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Displays a single plain-English status badge and 1–2 empathetic sentences (e.g., *"Work feels demanding right now, with pressure centered on shifting responsibilities; conditions begin easing after March 14."*).
- **Jargon Redaction Rules:** Terms such as *Vimshottari*, *Narayana*, *Tithi Ashtottari*, *Dashamsha*, *Vaaresha*, *Ashtakavarga*, *Kakshya*, *Vedha*, and internal engine names (`Radha`, `pyjhora`, `jhora`) are strictly stripped from all consumer text.
- **Evidence Array Encapsulation:** All astrological proofs live exclusively inside `evidence[]` keys (e.g., `['tone:demanding:confirmed', 'vote:S1:test:Sa', 'd10:h10:dignity_support', 'sav:h10:31bindus', 'tp:2026:yearLord=Ju']`).
- **One-Tap "Chart Details":** Expanding the details drawer exposes the underlying 5–8 family vote tally, the active driver planet(s), and dated boundary windows (`ease_date` / `window_end` / `next_window_start`) mapped to verified keys.
- **Single Past-Event Calibration Question:** Paired with `work.looking_back` edge moments to ask one verifiable yes/partly/no question (e.g., *"Did your workload or reporting lines shift noticeably around last October?"*) logged in `area_checks`.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'` in `src/techniques/subagentCachePlan.ts:684`). Downstream `work.reading.oracle` consumes this deterministic result inside its prompt context while keeping the immutable chart slice in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Persisted in `area_builds` (`area: 'career'`) and `technique_outputs` via `withTechniqueOutput` (`src/techniques/outputStore.ts`).
  - **Cache Key Formula:** `techniqueCacheKey(v1|work.present_tone|<contractHash>|<kundliId>|d:<digestVersion>|<freshness>|<validFrom>|<validTo>)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered under `TECHNIQUES` (`src/techniques/catalog.ts:117`) and `PLAN_BY_ID` (`src/techniques/subagentCachePlan.ts:721`).
  - Reading a cached output triggers `informIndividualCacheUsed({ userId, kundliId })`; after `READING_CACHE_RECYCLE_MINUTES=45` of inactivity, `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts:85`) evicts used `technique_outputs`, and `buildDigest` calls `deleteKundliTechniqueOutputs` on chart/digest rebuild.
- **RBAC & Data Privacy:**
  - All GraphQL/REST resolvers serving the Work board enforce `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild` (`result`, `error`), `TechniqueOutput` (`output`), and `KundliDigest` (`row`, `source`) are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts:81, 118, 133`, `pii2:v1` AES-256-GCM).
  - HTTP responses emit `Cache-Control: private, no-store, no-cache, must-revalidate`.

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
- **Tested against, for this technique:** the 10th and its lord, the D10 lagna and lords, AL and A10.
- **Purpose voice:** Sudasa; Narayana on D10 once the engine casts it.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows. The code and the lens recipes change with that build; until then this
  technique reads the systems listed above.
