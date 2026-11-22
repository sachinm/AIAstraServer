# Technique Specification: Career Horizons — 1, 3, 6, 12 Months (`work.horizons`)

**Technique ID:** `work.horizons`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts careerMap (horizons)`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.horizons` distills the full career sub-area window list into four crisp planning rungs — **1 month**, **3 months**, **6 months**, and **12 months** — selecting at most the single strongest support window and hardest test window starting inside each rung. Higher horizons (`6` and `12` months) enforce a stricter `moderate`-or-above signal floor while near-term rungs (`1` and `3` months) allow `possible`-or-above signals, returning `"quiet"` when neither bar is cleared.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` makes horizon ranking and quiet-rung filtering significantly more reliable:

- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** In `docs/TODOS.md:240`, stored `transit_contacts` stop at the end of 2026, which blinds the 6-month and 12-month horizon rungs as the current year advances into late 2026 and 2027+. Generating and storing exact Saturn, Jupiter, Rahu, and Ketu contacts through 2036 restores full `6m`/`12m` horizon fidelity.
- **Transit Ashtakavarga (`transit_ashtakavarga`, Gap H5):** Adds BAV/SAV and Kakshya `has_bindu` gating to candidate windows before ranking (`band_order * 100 + score`), ensuring a short-term `1m` or `3m` rung does not promote an unbacked transit peak over a true bindu-supported opening.
- **Tithi Pravesha `yearLord` & Annual D10 (Gaps R1 / R4):** Feeds the active TP year chart (`12m` horizon boundary) and `TP D10` career house strength into the `6m` and `12m` rungs, eliminating fail-closed `get_through` bias in `dashaAssessment.ts:414-419`.
- **Gochara Vedha & Murti Nirnaya (Gaps H1 / H2):** Flags obstructed benefic transits in `1m`/`3m` rungs and grades slow ingress pressure in `6m`/`12m` rungs so the single selected test window reflects real friction rather than noisy ephemeris passes.
- **D10 Dashamsha Structural Enrichment (`varga.d10`, Gaps R2 / R3):** Supplies explicit `D10` `house`, `lord`, and `dignity` for `house_card` inputs so `work.d10_check` confirms driver planets before they win top horizon rank.

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
  // c('ashtakavarga', 'transit_ashtakavarga'), c('annual', 'tithi_pravesha'), c('divisional', 'D10')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:209`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D10 houses 10,6,1,2,11` | `house_card` | Explicit `D10` `house`, `lord_dignity`, `sav` |
| `activation` | `families S1, S4, S2+S3, S6/S6D, S7 this month to +12 months` | `activation_row` | Adds TP annual + conditional/karaka dashas across the +12m span |
| `transit` | `contacts and double transit on houses 10,6,1 and their lords ±24 months` | `transit_row` | 2027–2036 exact contacts, Kakshya `bindus`, Gochara Vedha |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `career_map.v1` (`horizons: { '1m' | '3m' | '6m' | '12m': { support: SubareaWindow | null, test: SubareaWindow | null, quiet: boolean } }`).
- **Synthesis Payload (`findings_in`):** Feeds dated horizon milestones into `work.reading.oracle` (`lineman.work`):
  - Ranked by `band_order * 100 + score`. Selected `support` window emits polarity `'support'` (`+1.0 .. +3.0`); selected `test` window emits polarity `'test'` (`-1.0 .. -3.0`); `quiet: true` emits `'neutral'` (`0`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** inside `career.ts careerMap`, immediately following `work.subarea_windows`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.horizons` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript array filtering and ranking (`< 5 ms`). Zero LLM calls; zero Node astrological computation.
  - **Threshold Discipline:** Enforces deterministic rung bars (`moderate+` for `6m`/`12m`; `possible+` for `1m`/`3m`), preventing weak noise from cluttering long-range career roadmaps.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Four clean horizon tabs (`1 Month`, `3 Months`, `6 Months`, `12 Months`), each showing at most one clear opportunity and one watch-out — or a calm *"Quiet stretch — steady execution without major inflection points"* message when `quiet` is true.
- **Jargon Redaction Rules:** Strips all dasha names, transit terminology, *Ashtakavarga*, *Kakshya*, *Vedha*, *Band Order*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured identifiers in `evidence[]` (e.g., `['horizon:6m:support:job_change', 'rank:204.6', 'transit_contact:Ju_L10:2027-08-19', 'tp_d10:10H:support']`).
- **One-Tap "Chart Details":** Shows exact start/end dates, rank score, active families, and driver planets for the winning rung window.
- **Single Past-Event Calibration Question:** Defers calibration questions to `work.looking_back` while keeping horizon rungs forward-looking and actionable.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). `work.reading.oracle` embeds the 4-rung horizon summary in the Work Lineman brief while keeping natal chart data cached in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Persisted in `area_builds` (`area: 'career'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, and monthly validity window).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; read hits call `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges stale entries after 45 minutes of inactivity.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, and `KundliDigest` are encrypted at rest in `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
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
- **Tested against, for this technique:** the 10th and its lord, the D10 lagna and lords, AL and A10.
- **Purpose voice:** Sudasa; Narayana on D10 once the engine casts it.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
