# Technique Specification: Scenario Windows (`lucky.scenarios` — 13 Action Rules)

**Technique IDs:** `lucky.work.sign_contract`, `lucky.work.send_resume`, `lucky.work.interview`, `lucky.work.ask_raise`, `lucky.work.start_project`, `lucky.work.hard_talk_boss`, `lucky.love.ask_out`, `lucky.love.first_date`, `lucky.love.clear_air`, `lucky.money.invest_buy`, `lucky.travel.set_out`, `lucky.study.exam_submit`, `lucky.home.start_routine`  
**Category:** Area-mapped (`work` | `love` | `self`)  
**Board:** `lucky`  
**Status:** `built` (Priority #2 `daily_grade`, `muhurta`, `transit_ashtakavarga`, & `Pancha Pakshi` enhancement ready)  
**Owning Code Path:** `src/reading/luckyTimes/scenarios.ts` (`SCENARIOS`, `scenarioById`); `src/reading/luckyTimes/windows.ts` (`scenarioDay`); `src/reading/luckyTimes/service.ts` (`getRange`)  
**Agent ID:** `lucky.scenario_windows` (upstream: `lucky.day_tables`, `lucky.personal_overlay`, `lucky.avoid_bands`, `lucky.panchang_limbs`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

The `lucky.<scenario>` suite scores and filters intraday candidate windows across 13 real-world life actions spanning Work (6), Love (3), Money (1), Travel (1), Study (1), and Home (1). Combining the shared day row (`lucky.day_tables`), avoid bands (`lucky.avoid_bands`), five-limb gates (`lucky.panchang_limbs`), and personal chart marks (`lucky.personal_overlay`), it slices each day's active hours (`['sunrise' | hour, endHour]`), cuts out all avoid/gated spans, scores every remaining piece against the scenario's classical *Muhurta Chintamani* / B.V. Raman rule profile, and surfaces the top two windows scoring `>= floor` (`3`) in time order.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` directly resolve existing v1 scenario gaps (`v1Note`s in `scenarios.ts`) and elevate micro-timing precision:

- **`daily_grade` (`daily_export.py:429–450`, Gap H5):**
  - Currently `served: false` in `catalog.ts:261`. Supplies engine-verified `grade: 'good' | 'neutral' | 'avoid'` plus Tara/Chandra Bala day transitions so multi-day scenario calendars avoid recommending borderline days.
- **`muhurta` (`daily_export.py:616–635`, Gap H5) — 30 Muhurtas, Choghadiya, Mercury Retrograde & Disha Shool:**
  - Currently `served: false` in `catalog.ts:262`.
  - Unlocks the **30 Muhurtas of the day**, **24 planetary Horas**, and **Gauri Choghadiya** (*Amrit, Shubh, Labh, Char, Rog, Kaal, Udveg*).
  - Directly resolves the three explicit v1 scenario notes (`scenarios.ts:182, 264, 274`):
    1. `work.sign_contract` & `money.invest_buy`: Checks live **Mercury retrograde** (`v1Note: "Mercury's motion is not yet checked"`).
    2. `travel.set_out`: Integrates weekday directional rules (**Disha Shool**, `v1Note: "The direction rule for each weekday is not yet applied"`).
- **`transit_ashtakavarga` with Kakshya Bindus (`daily_export.py:703–765`, Gap H5):**
  - Currently `served: false` in `catalog.ts:263`.
  - Adds **Kakshya bindu verification** (`3°45'` sub-divisions): an auspicious Hora (`+2`, e.g., Jupiter/Mercury for `sign_contract` or Venus/Moon for `first_date`) gains full confirmation only when the transiting Hora lord occupies a natal Kakshya with `has_bindu === true` (`+1` personal precision boost), filtering false-positive horas on weak days.
- **Pancha Pakshi Shastra (`panchanga/pancha_paksha.py`, Gap O2):**
  - Layers personal 5-bird activity states (`Ruling` / `Eating` peak windows vs. `Sleeping` / `Dying` low-traction windows) onto `useBrahma` / action hours for high-stakes scenarios (`work.interview`, `work.ask_raise`, `work.start_project`).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Scenario Matrix Covered (`SCENARIOS` in `src/reading/luckyTimes/scenarios.ts:173–294`):**

| Scenario ID | Area | Ask First | Favour Tithi / Star | Favour Day / Hora | Active Hours |
|---|---|---|---|---|---|
| `work.sign_contract` | `work` | — | Bhadra, Purna / Fixed | Thu, Wed / Ju, Me | Sunrise–19:00 |
| `work.send_resume` | `work` | `job` | Bhadra, Nanda / Quick, Moving | Wed, Thu, Sun / Me, Su, Ju | Sunrise–20:00 |
| `work.interview` | `work` | `job` | Jaya, Bhadra / Quick, Soft | Thu, Sun, Wed / Su, Ju | Sunrise–18:00 |
| `work.ask_raise` | `work` | `job` | Purna, Jaya / Fixed, Quick | Thu / Ju, Su | Sunrise–18:00 |
| `work.start_project` | `work` | — | Bhadra, Nanda / Quick, Fixed | Mon, Wed, Thu / Ju, Me, Mo | Sunrise–20:00 (+Brahma) |
| `work.hard_talk_boss` | `work` | `who` | Nanda / Soft, Fixed | Mon, Thu / Mo, Ju, Ve | Sunrise–18:00 |
| `love.ask_out` | `love` | `relationship` | Nanda, Bhadra / Soft | Fri, Wed / Ve, Me, Mo | 09:00–22:00 |
| `love.first_date` | `love` | `relationship` | Nanda / Soft | Fri / Ve, Mo | 11:00–22:00 |
| `love.clear_air` | `love` | `relationship` | Nanda / Soft, Fixed | Mon, Fri / Mo, Ve | 09:00–22:00 |
| `money.invest_buy` | `money` | — | Bhadra, Purna / Fixed | Thu, Wed / Ju, Me | Sunrise–19:00 |
| `travel.set_out` | `travel` | — | Bhadra, Nanda / Moving, Quick | — / Mo, Ve, Me | Sunrise–21:00 |
| `study.exam_submit` | `study` | — | Jaya, Purna / Quick | Wed, Thu / Me, Ju | Sunrise–20:00 |
| `home.start_routine` | `home` | — | Bhadra / Fixed, Quick | Mon, Thu / Su, Mo, Ju | Sunrise–12:00 (+Brahma) |

- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('panchang', "the place's day rows today −7 … today +14 (vara, tithi, nakshatra, yoga, karana, horas, avoid_bands, good_spans, 30-muhurta, daily_grade)", 'panchang_day')`
  - `inp('panchang', "the person's day overlay (tara, chandra bala, kakshya bindus, pakshi state) when stored", 'panchang_day')`
- **Contract Output Schema:** `'windows.v1'` — ranked candidate pieces (`start`, `end`, `score`, `reasons[]`, `plainLabel`, `gatedReason?`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Deterministic scoring (`< 10 ms`): Tithi (`+1 / -2`), Star (`+1 / -2`), Yoga (`+1` or hard cut), Karana (hard cut or `+1` Kimstughna), Weekday (`+1 / -2`), Hora (`+2 / -3`), Abhijit `>=10m` (`+2`), Amrita Gadiya (`+2`), good muhurtas `>=50%` (`+1`), Personal Tara (`±1`), Personal Chandra (`±1`), Hora functional nature (`±1`), Priority #2 Kakshya `has_bindu` (`+1`). Keeps pieces `>= floor` (`3`), shows top 2 chronologically.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Universal & Personal Pre-load:** Reads `day_tables` (`lucky.day_tables`) and `kundli_day_overlays` (`lucky.personal_overlay`).
  2. **Clarify / Context Ask Gate (`ask?: 'who' | 'job' | 'relationship'`):** For `send_resume`, `interview`, `ask_raise`, `hard_talk_boss`, and Love scenarios, checks `person_facts` first; asks one tap if missing (`AGENTS.md` rule #3).
  3. **Deterministic Window Selection (`scenarioDay`):** Cuts avoid/gated spans, scores sub-intervals, and returns `windows.v1` in `< 10 ms` with zero LLM tokens.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'lucky.scenario_windows'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'lucky.<scenario.id>'`.
  - `category`: mapped via `categoryOfLuckyArea(s.area)` (`work` | `love` | `self`).
  - `level`: `'stage'` (code-only, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - `< 10 ms` execution per 14–28 day range query; zero live Radha calls on scenario switch.
  - Zero Node astrological calculation: all astronomical coordinates, horas, muhurtas, Kakshya bindus, and retrograde states come from Radha.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Surfaces clean, plain-language time blocks and practical framing (e.g., *"Best windows to sign: 11:45 AM – 12:26 PM (Clear focus window) and 3:10 PM – 4:02 PM (Favorable window for agreements)."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on default card faces: *Rahu Kalam*, *Hora*, *Tithi*, *Nakshatra*, *Bhadra*, *Rikta*, *Vishti*, *Kakshya*, *Bindu*, *Choghadiya*, *Pancha Pakshi*, *Disha Shool*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All scoring reasons and rule keys remain in `reasons[]` / `evidence[]` for the Why sheet:
    `['hora:Ju:+2', 'band:abhijit:+2', 'yoga:Siddha:+1', 'overlay.tara:kshema:+1', 'kakshya.Ju.has_bindu:+1']`.
- **One-Tap "Chart Details" (Why Sheet):** Explains why each window scored well (or why a day was gated out) and displays any active `v1Note` caveats until Priority #2 `muhurta` fields land.
- **Single Past-Event Calibration Question:** When `ask` is configured (`job`, `who`, `relationship`), confirms situational context first in one tap before showing windows.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Zero LLM tokens (`cacheStore: 'none_deterministic_code'`).
- **Findings & Output Persistence:**
  - Reads `day_tables` + `kundli_day_overlays` and caches daily scenario outputs in `technique_outputs` (`techniqueCacheKey(..., daily [00:00Z, 24:00Z))`).
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (Group 7: `recycledEvery45m: true` for personal overlay / scenario outputs).
  - Live reads invoke `informIndividualCacheUsed({ userId, kundliId })`; inactive per-kundli caches recycle after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Personal overlays and `TechniqueOutput` rows are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
