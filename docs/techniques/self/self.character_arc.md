# Technique Specification: 3-Decade Character Evolution (`self.character_arc`)

**Technique ID:** `self.character_arc`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/selfCharacterAndJoy.ts` (`buildSelfCharacterArc`); `src/reading/area/houseLayers.ts` (`buildBoard`)  
**Agent ID:** `area.self_board` (downstream consumer: `self.v2.oracle`, `self.v2.personalizer`, UI `/you` Character Arc card)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.character_arc` synthesizes the native's longitudinal character evolution across three 10-year arcs relative to today (`asOf`): **Last 10 Years**, **Who You Are Now**, and **Next 10 Years**. Anchoring core temperament in D1 Lagna, Lagna lord (*Paka Lagna*), D9 Navamsha maturation (enforced jointly over age 36), Sun, Moon, and Atmakaraka (`AK`), it pairs active Mahadasha/Antardasha trajectories across 40+ dasha systems with the active Tithi Pravesha year lord to produce practical, jargon-free behavioral evolution guidance.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.character_arc`:

- **Headless Sudarshana Chakra (`dhasa/sudharsana_chakra.py`, Gap H4):**
  - Exposing Sudarshana Chakra's 3 concentric reference wheels (**Lagna Chakra** / physical action, **Chandra Chakra** / emotional mind, **Surya Chakra** / soul ambition) plus its annual 1-year-per-sign progression directly enriches the "Who You Are Now" and "Next 10 Years" windows.
  - Allows `buildSelfCharacterArc` to verify whether current life pressure or momentum aligns across body, mind, and core purpose simultaneously (`triple_alignment.shared_activating_planets`).
- **Tithi Pravesha `yearLord` (*Vaaresha*) Fix (Gap R1):**
  - `self.character_arc` reads the active TP year lord from `runningTithiPravesha` (`catalog.ts:696`). Fixing Radha `annual_export.py` to export `year_lord` and `digest/build.ts:1177` to parse it for `kind === 'TP'` eliminates `yearLord: undefined` gaps in the "Who You Are Now" chapter.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6) & Bhava Bala (`strength.bhava`, Gap H6):**
  - Quantifies long-term planetary stamina (0..20 scale) for the Lagna lord, Sun, Moon, `AK`, and each decade's Mahadasha lords, separating enduring character pillars from transient spikes.
- **D9/D10/D60 Explicit Houses & Dignities + Karakamsha / Swamsha (Gaps R2, R3, R6):**
  - Upgrading Radha `_build_placements_json` to return explicit `house` (`1..12`), `lagna`, `owns`, and `dignity` across `D1, D9, D10, D60`, plus explicit Jaimini Karakamsha (`D9` sign of `AK` mapped as `KL`) and Swamsha, anchors the soul-purpose trajectory across decades without Node-side house math.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:681`):**
  ```typescript
  [
    c('natal', 'facts'), c('natal', 'dignities'),
    c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D10'),
    c('annual', 'tithi_pravesha'), c('jaimini', 'charakaraka'),
    c('dasha', 'vimshottari'), c('dasha', 'narayana'),
    c('natal', 'strength.vimsopaka'), c('natal', 'sudarshana_chakra'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D10 houses 1,4,5,9,10', 'house_card')`
  - `inp('planet', 'D1,D9,D10 cards of L1, Su, Mo, AK and running MD/AD lords (including vimsopaka_score)', 'planet_card')`
  - `inp('point', 'AK, AmK, AL (plus Karakamsha/Swamsha & Sudarshana 3-wheel active signs)', 'point_row')`
  - `inp('activation', 'vimshottari and rasi periods from -10 years to +10 years', 'activation_row')`
  - `inp('annual', 'current Tithi Pravesha year and year lord', 'annual_row')`
- **Contract Output Schema:** `'self_character_arc.v1'` — structured 3-decade JSON object (`last10Years`, `whoYouAreNow`, `next10Years`, each with `range`, `headline`, `traits[]`, `growthLessons[]`, `practicalShifts[]`, and `evidence[]`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Consumed deterministically by `/you` UI board and passed into `self.v2.oracle` / `self.reading_oracle` briefs as grounded decade anchors.
  - Enforces `D9_MATURITY_AGE_YEARS` (`36`, from `src/config/env.ts`) to evaluate joint `D1 + D9` mutual confirmation (Vargottama, Neecha Bhanga via D9, False Promise, Drudha Karma).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest & Annual Pre-computation (`digest.build`, `digest.annual_set`):** Materializes `D1/D9/D10` cards, `AK`, `runningTithiPravesha`, `strength.vimsopaka`, and Sudarshana Chakra into `kundli_digest`.
  2. **Deterministic Decade Synthesis (`buildSelfCharacterArc`):** Executes inside `houseLayers.ts` (`buildBoard`) over `DigestView` and `ActivationRow[]` (`-10Y..+10Y`), zero DB queries and zero LLM calls.
  3. **Progressive Board Streaming:** Streamed early as a deterministic section via `GET /api/dashboard/sections-stream` (`application/x-ndjson`) so `/you` renders before heavier AI synthesis finishes.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'self.character_arc'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, `< 20 ms`, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Zero Node astrological math: age bands use simple calendar subtraction on birth date; all `D1+D9` signs, houses, dignities, `AK`, and Sudarshana wheels come strictly from Radha exports.
  - Budget: `< 20 ms` CPU time.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Displays three crisp decade cards (*Last 10 Years*, *Who You Are Now*, *Next 10 Years*) written in empathetic, plain second-person prose (e.g., *"Over the past decade you shifted from proving capability through sheer effort to building systems that run cleanly; the next ten years reward mentoring and selective commitments."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Lagna*, *Paka Lagna*, *Navamsha*, *D9*, *D10*, *Atmakaraka*, *Vargottama*, *Neecha Bhanga*, *Drudha Karma*, *Sudarshana Chakra*, *Mahadasha*, *Vaaresha*, *Tithi Pravesha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All astrological proofs live strictly in `evidence[]`:
    `['digest.planet.D1.L1.dignity:own', 'd1_d9_check:vargottama_Mo', 'activation.vimshottari.now:Me_Ju', 'annual.TP2026.year_lord:Ve', 'sudarshana.age42.h7:Ju_aspect']`.
- **One-Tap "Chart Details":** Reveals the underlying 3-decade clock transitions, D1/D9 maturity flags (when age $> 36$), `AK` soul theme, and active TP Year Lord.
- **Single Past-Event Calibration Question:** Anchors the *Last 10 Years* card: *"Looking back at the past decade, did your biggest turning point come when you stepped into a steadier leadership or creative role around [last L1 boundary year]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Pure deterministic code technique (`cacheStore: 'none_deterministic_code'`).
  - Its output feeds `/you` directly and can also enrich the `person` / `character` context of `self.v2.oracle` without bloating `parts[0]`.
- **Findings & Output Persistence:**
  - Cached in `technique_outputs` under `techniqueCacheKey(v1|self.character_arc|<contractHash>|<kundliId>|d:<digestVersion>|<asOfYear>)` and `area_builds`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Strictly gated by `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest under `SEALED_MODELS` (`KundliDigest`, `TechniqueOutput`, `AreaBuild`) with `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

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
- **Tested against, for this technique:** every counted voice's maha dasha, its end date and the next lord (the chapter turn).
- **Purpose voice:** all counted voices.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows. The code and the lens recipes change with that build; until then this
  technique reads the systems listed above.
