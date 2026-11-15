# 76 · D9 Navamsha, Higher Divisional Charts, Multi-Clock Dasha Systems & Annual Tithi Pravesh Architecture

Status: **Architecture Specification & Classical Research Plan (Milestone 1, Requirement R1 — Remediated)**  
Author: Teamwork Architecture Worker (`worker_m1_retry`)  
Date: 2026-11-15T00:35:00Z  
Target Branch: `feat/self-foundation-server`  
Context: Extends and synthesizes Docs 28 (Tithi Pravesha), 67 (Dasha Levels 1–6), 68 (Self Board v3), 69 (Love & Work Boards v3), 70 (Five Clocks Concordance), 71 (Prompt Cache & Person Memory), 72 (Now Card & Vargas), 73 (Card Faces & Lenses), and 75 (Self Foundation Card).

---

## 0. Executive Summary & Core Directives

This specification establishes the architectural foundation for evaluating divisional charts alongside the birth chart, routing the active dasha planet through departmental vargas, and anchoring dashboard readings in active Mahadasha cycles across all 40+ dasha systems and annual Tithi Pravesh timing.

### 0.1 The Shift from Static Natal Descriptions to Dynamic Living Cycles
Traditional automated astrology tools present static natal placements (e.g., "You have Saturn in the 10th house and Mars in the 4th house"). Such statements remain identical whether an individual visits the application at age 22, 37, or 52. 

A personalized Vedic astrological assistant must reflect the dynamic, unfolding reality of human life. The birth chart ($D1$, *Rasi*) establishes the physical incarnation, biological constitution, and initial social environment (*Maya*). As time advances, karma matures. Specifically, classical Vedic astrology identifies **age 36** (the maturation age of Saturn / *Shani*, Lord of Karma) as the definitive turning point where the Navamsha ($D9$) activates fully as the primary arbiter of fruition, character stability, and spiritual destiny (*Dharma*).

Consequently, once native age exceeds Saturn's maturation threshold (`ageYears > getD9MaturityAgeYears()`, configured via `src/config/env.ts` with default `36`), no astrological assessment can be made from $D1$ alone. The system must enforce **mutual validation across $D1$ and $D9$**:
- **Neecha Vargottama / Persistent Affliction (*Drudha Karma*)**: When a planet is debilitated in $D1$ and occupies that identical debilitation sign in $D9$ (e.g., Saturn in Aries in both $D1$ and $D9$), the subtle dharmic container reinforces the fallen physical manifestation. Rather than receiving a Vargottama strength bonus, it is classified as `confirmed_weak` (score adjustment $-1.5$) with explicit documentation of unyielding karmic resistance.
- **Exalted / Own-Sign Vargottama**: Confirms supreme structural stability and enduring fruition (`confirmed_strong`, score adjustment $+1.5$).
- **Neutral / Friendly Sign Vargottama**: Confirms steady structural grounding (`confirmed_strong`, score adjustment $+1.0$).
- **True Cancellation of Debilitation (*Neecha Bhanga* via $D9$)**: When a planet is debilitated in $D1$ but attains exaltation or own-sign dignity in $D9$, the native experiences early trial transforming into hard-won mastery (`d9_redeemed`, score adjustment $+1.2$).
- **False Promise (*D9 Weakened*)**: When a planet is strong in $D1$ but falls into debilitation or enemy dignity in $D9$, initial promise encounters structural hollows (`d9_weakened`, score adjustment $-1.0$).

Furthermore, the active Mahadasha and Antardasha lords operate as *Karyadhipatis* (active executors of karma). The system resolves the running Mahadasha across all 40+ supported dasha systems (certified conditional nakshatra dashas, universal Vimshottari, rasi-based Narayana/Chara, Yogini, Karaka, and Tithi Ashtottari) and evaluates their capacity to deliver results in the departmental divisional chart ruling that domain ($D10$ for vocation/career, $D9$/$D7$ for relationships and marriage, $D30$ for health vulnerabilities). 

Finally, the temporal focus of every reading card is anchored to the native's active macro dasha chapter and current-year Tithi Pravesh (annual lunar return) container, cutting the upcoming 12 months into concrete, engine-dated periods with clear "Get through" versus "Build" postures. In strict accordance with `TITHI_PRAVESHA_YEAR_RULE`, the annual container is bounded exclusively by stored return moments (`tp_start` / `tp_end`) or bounded year dasha spans ($\le 400$ days), with a total prohibition of Gregorian calendar year fallbacks (`01-01` .. `12-31`). If annual data is unresolved, the system fails closed to `stance = 'get_through'`.

### 0.2 Non-Negotiable Engineering Directives
1. **Zero Astrological Calculation in Node**:
   - `AIAstra_Radha` (the calculation engine running `pyjhora`) is the sole astrological authority.
   - Node.js never derives house cusps, planetary degrees, vargas, dashas, ashtakavarga bindus, sahams, or dignities. Node only selects, compares stored date strings, joins, filters, and formats pre-computed engine outputs.
2. **Environment-Driven Configuration (`GEMINI.md` Rule #1)**:
   - Configurable astrological thresholds, maturity ages, and rule lists live in environment variables read through typed helpers in `src/config/env.ts`. Specifically, Saturn's maturation age is read via `getD9MaturityAgeYears()` (`process.env.D9_MATURITY_AGE_YEARS`, default `36`), and evaluated with strict `ageYears > threshold` semantics.
3. **Deterministic Pre-Computation & Pure Selection**:
   - Shared board logic runs as deterministic sub-techniques (`.sub.*`), persisting typed results into `technique_outputs` keyed by digest version, clock system, and boundary timestamps.
   - Dashboard card rendering performs pure selection into an `AreaBrief` with zero runtime database queries.
4. **Strict 45-Minute Used-Cache Recycling (`READING_CACHE_RECYCLE_MINUTES = 45`)**:
   - In accordance with `GEMINI.md` and `AGENTS.md`, all explicit LLM prompt caches (Gemini `cachedContents`), reader cache payloads (`reading_findings_cache`), and technique outputs must participate in the 45-minute usage tracking and sweep lifecycle. Prewarming leaves `hit_count = 0`; consumption calls `informIndividualCacheUsed({ userId, kundliId })`.
5. **Plain English on Card Surfaces & Redaction of Chart Jargon**:
   - Card faces presented to the user must use natural, empathetic English. Sanskrit technical terminology ("Mahadasha", "Neecha Bhanga", "Navamsha", "SAV points", "Dusthana") and internal system identifiers (`Radha`, `pyjhora`) are strictly prohibited on card faces.
   - All astrological evidence keys (e.g., `D1.p.Sa.h10`, `D9.p.Ju.h7`, `tp:2026.yearLord:Mo`) are encapsulated in structured `evidence` arrays, accessible only under an explicit one-tap "Chart details" / Research lens.
6. **Single Past-Event Empirical Calibration Question per Card**:
   - Each card incorporates exactly one past-event confirmation question (e.g., "Between March and June, did you experience a sudden shift in work responsibilities?") to ground the reading in confirmed life memory.

---

## 1. Start: Current System Capabilities & Baseline Audit

### 1.1 Audit of `feat/self-foundation-server` & Recent Architectural Milestones
The server codebase on `feat/self-foundation-server` has established several core foundational capabilities:
1. **Layout Versioning & Stale Mutation Guards (`docs/reading-engine/75`)**:
   - `src/reading/self/v3/layout.ts` enforces optimistic concurrency control via `updated_at` timestamps on `board_layout`.
   - Prevents race conditions during layout updates, returning HTTP 409 Conflict if a client attempts to overwrite a newer board state.
2. **Text Sanitization & Jargon Redaction (`foundation.ts`)**:
   - `cleanCardText()` strips residual chart jargon, empty parenthetical citations (`()`, `(,)`), and standardizes temporal expressions into plain English.
3. **Five Clocks & Agreed Ledger (`docs/reading-engine/70`)**:
   - Codifies the multi-clock architecture comparing Vimshottari, Narayana, Tithi Pravesha Year, Conditional Nakshatra dashas, and Yogini/Chara dashas.
   - Establishes concordance thresholds: $\ge 3$ agreeing clocks confirm a dated claim; 2 clocks produce a leaning claim; split votes are marked contested.
4. **Card Packs & Stable Prefix Caching (`docs/reading-engine/71`)**:
   - `src/reading/cards/group.ts` implements grouped card builds using Gemini prompt caching.
   - Places the stable per-individual prefix ($\ge 1024$ tokens: natal core, sky window, year TP, dasha frame) in `parts[0]` with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`.

### 1.2 Existing Dasha Architecture (44 Systems, Levels 1–6)
As documented in `docs/reading-engine/67-dasha-levels-1-6.md`:
- **Lifelong Storage**: The engine pre-calculates and persists levels 1 through 3 (`LIFELONG_MAX_LEVEL = 3`) from birth through birth $+ 30$ years in `kundli_activation` for all applicable dasha systems.
- **Deep Windows (Levels 4–6)**: For active operational windows ($[-90\text{d}, +365\text{d}]$ from `asOf`), the system pulls deep dasha levels (sookshma, prana, deha) via background workers (`dashaDeep.ts`).
- **Conditional Qualification**: `dasha.applicable` dynamically checks natal criteria (e.g., Lagna lord in 7th, Sun in Lagna, Hora Lagna placement) to certify which conditional nakshatra dashas (Dwisaptati Sama, Shatabdika, Chaturashiti Sama, Shashtihayani, Shodashottari, Ashtottari, Panchottari) apply to the native.

### 1.3 Divisional Chart Inventory ($D1$ through $D60$)
The calculation engine computes and stores the full classical Shodashavarga and higher divisional hierarchy in `kundli_digest` (`chart_data_items`):
- $D1$ (Rasi): Physical manifestation, vitality, general life structure.
- $D2$ (Hora): Wealth accumulation, liquid resources, family sustenance.
- $D3$ (Drekkana): Siblings, courage, initiative, fine motor skills.
- $D4$ (Chaturthamsa): Fixed assets, real estate, domestic peace, fortune.
- $D7$ (Saptamsha): Children, progeny, creative lineage, creative partnerships.
- $D9$ (Navamsha): Dharma, soul covenant, inner character, marriage/spouse, fortune in the second half of life.
- $D10$ (Dashamsha): Career, professional authority, public reputation, executive execution.
- $D12$ (Dwadasamsa): Parents, ancestral heritage, lineage karma.
- $D16$ (Shodashamsa): Vehicles, conveyances, material luxuries, physical comfort.
- $D20$ (Vimsamsa): Spiritual pursuits, upasana, devotion, inner sadhana.
- $D24$ (Siddhamsa / Chaturvimsamsa): Higher education, learning, intellectual capacity, skill mastery.
- $D27$ (Nakshatramsa / Bhamsa): Strengths, physical stamina, subconscious vulnerabilities.
- $D30$ (Trimshamsha): Afflictions, chronic illnesses, hidden misfortunes, moral lapses (*Arishta*).
- $D40$ (Khavedamsa): Auspicious/inauspicious maternal lineage karma.
- $D45$ (Akshavedamsa): General character refinement and paternal lineage karma.
- $D60$ (Shashtyamsa): Deep past-life root causes and karmic seeds.

### 1.4 Baseline Audit & Gaps Identified
Despite the availability of these rich datasets, the following critical architectural and algorithmic gaps exist:
1. **Lack of Environment-Driven Age-36 Navamsha Activation Gate**:
   - `src/reading/area/selfCharacterAndJoy.ts` computes native age from `opts?.ageYears` to generate age labels (`Ages 26–36`, `Age 36`, `Ages 36–46`), but fails to alter the underlying astrological logic.
   - For an individual aged 46, planets are currently evaluated primarily based on their $D1$ dignity, missing the classical mandate that post-36 fruition is governed by $D9$.
   - The threshold must be environment-driven via `getD9MaturityAgeYears()` from `src/config/env.ts` (default `36`), with strict `ageYears > threshold` semantics. If `ageYears` is omitted, callers must derive it from `birthDate` and `asOf` via `ageInYears(birthDate, asOf)`, or flag `age_unresolved`.
2. **Missing D1 and D9 Mutual Confirmation Evaluator & Neecha Vargottama Defect**:
   - The engine lacks a pure helper to systematically cross-compare $D1$ and $D9$ placements, dignities, Vargottama status, and cancellation of debilitation (*Neecha Bhanga* via $D9$).
   - Crucially, naive Vargottama checks award $+1.5$ bonuses to any same-sign placement, incorrectly granting strength bonuses to debilitated planets (e.g., Saturn in Aries in both $D1$ and $D9$). Classical doctrine identifies this as *Neecha Vargottama* / *Drudha Karma* (fixed affliction), which must be classified as `confirmed_weak` ($-1.5$). Exalted/own-sign Vargottama ($+1.5$) and neutral Vargottama ($+1.0$) must be cleanly differentiated from Neecha Vargottama, and true Neecha Bhanga (`d9_redeemed`, $+1.2$) must be differentiated from unredeemed enemy placements.
3. **Disjointed Active Dasha Varga Routing Across All 40+ Dasha Systems**:
   - Dasha assessment pipelines have hardcoded `r.family === 'vimshottari'`, ignoring certified conditional nakshatra dashas (`r.family === 'conditional'`), rasi dashas (Narayana/Chara), and cyclic dashas (Yogini).
   - The runtime dasha router must inspect `ActivationRow[]` across all applicable families, surface the primary running Mahadasha, and route active lords into departmental vargas ($D10$ for career, $D7$/$D9$ for love, $D30$ for health) while evaluating multi-clock concordance (`docs/reading-engine/70`).
4. **Tithi Pravesha Schema Inaccuracy, Annual Vargas & Gregorian Fallback**:
   - Draft implementations incorrectly referenced `.varesha` or `.lord` on `AnnualRow`. In `src/reading/digest/types.ts:164`, `AnnualRow` defines `yearLord?: string | null;` (it has no `.lord` or `.varesha` property).
   - Stored annual divisional charts live in `view.annual(tpInfo.year)` with `r.kind === 'TP'` and `r.varga` (`'D1'`, `'D9'`, `'D10'`, `'D7'`, `'D30'`), carrying `lagna`, `houses: HouseCard[]` (`occupants`, `class`, `lord`, `lordDignity`), `sahams`, and `tajakaYogas`.
   - Card pack builders must never fall back to Gregorian calendar bounds (`${tpInfo.year}-01-01` .. `${tpInfo.year}-12-31`), which violate the lunar-solar return definition (`TITHI_PRAVESHA_YEAR_RULE`). If annual data or `yearLord` is unresolved, the system must fail closed to `stance = 'get_through'`.
5. **Work Board Pipeline Wiring Gap**:
   - `buildWorkCharacterArc` and `buildWorkVocationAndPersonality` already exist in `src/reading/area/selfCharacterAndJoy.ts` (lines 1019–1156). However, in `src/reading/area/houseLayers.ts:918–930`, `characterArc` and `personalityAndJoy` handle `cfg.area === 'self'` and `cfg.area === 'love'`, but return `undefined` for `cfg.area === 'career'`.
   - The work functions must be updated with age > 36 D1+D9 mutual confirmation and formally wired into `houseLayers.ts`.

---

## 2. Classical Astrological Foundation

```
========================================================================================
                          CLASSICAL DIVISIONAL LIFE FRAMEWORK
========================================================================================

    Age 0 -------------------------- Age 36 -------------------------> Age 72+
      │                                 │                                │
      ▼                                 ▼                                ▼
   D1 RASI DOMINANT             SATURN MATURATION             D9 NAVAMSHA CO-EQUAL
  (Gross Physical / Maya)       (Karma Crystallizes)        (Dharmic Fruition / Sookshma)
      │                                 │                                │
      ├─ Physical Environment           ├─ Graha Pakvata Completion      ├─ True Dharmic Capacity
      ├─ Biological Inheritance         ├─ Saturn Seals Base Karma       ├─ Inner Soul Fulfillment
      └─ External Conditioning          └─ Shift to Sookshma Realities   └─ Permanent Fruition
                                        │
                                        ▼
                  =============================================
                  D1 + D9 DUAL CONFIRMATION REQUIRED (Age > 36)
                  =============================================
                  • Exalted D1 + Debilitated D9 = False Promise (-1.0)
                  • Debilitated D1 + Exalted D9 = Neecha Bhanga (+1.2)
                  • Debilitated D1 + Debil D9   = Neecha Vargottama (-1.5) [Drudha Karma]
                  • Exalted/Own Vargottama      = Confirmed Strong (+1.5)
                  • Neutral Vargottama          = Confirmed Strong (+1.0)
                  • Pushkaramsha Placement      = Healing Grace
```

### 2.1 The Age-36 Threshold & Karmic Maturation (*Graha Pakvata*)
In Vedic astrological theory, the planetary archetypes do not operate with uniform maturity throughout an individual's lifetime. Classical texts—most notably *Brihat Parashara Hora Shastra* (Ch. 45), *Phaladeepika* (Ch. 20, slokas 12–15), and *Jataka Parijata* (Ch. 6)—codify the hierarchy of planetary maturation ages (*Graha Pakvata*):

| Planet | Sanskrit | Maturation Age | Psychological & Dharmic Awakening |
|:---|:---|:---:|:---|
| **Jupiter** | *Guru* | **16** | Awakening of moral discrimination, philosophical curiosity, and higher conscience. |
| **Sun** | *Surya* | **21–22** | Independent ego formation, separation from parental identity, personal honor. |
| **Moon** | *Chandra* | **24** | Emotional autonomy, relational yearning, stabilization of mental habits (*Manas*). |
| **Venus** | *Shukra* | **25** | Aesthetic refinement, sensual discernment, conscious partnership choices. |
| **Mars** | *Mangala* | **28** | Channeled ambition, executive courage, tactical enterprise, strategic drive. |
| **Mercury** | *Budha* | **32** | Intellectual consolidation, pragmatic business judgment, cognitive equilibrium. |
| **Saturn** | *Shani* | **36** | **Full karmic maturation, structural grounding, endurance, reality orientation.** |

#### Classical Rationale for the Age-36 Threshold
Saturn represents *Kala* (Time), *Karma* (the inexorable law of consequence), and *Ayur* (longevity). Until age 36, Saturn's orbital cycle ($29.5$ years) and subsequent structural consolidation keep the native anchored to physical survival, trial-and-error adaptations, and external conditioning.

During the first 36 years, the Rasi chart ($D1$) represents the physical reality: the gross body (*Sthula Sharira*), ancestral momentum, and circumstantial limitations (*Maya*). The individual's actions are largely reactive to environmental pressures.

When Saturn matures at age 36, the karmic ledger of early life is sealed. The subtle body (*Sukshma Sharira*), represented by the 9th harmonic—the Navamsha ($D9$)—becomes co-equal with $D1$ as the primary operative plane. The 9th house is *Bhagya Bhava* (good fortune, past-life merit / *Purva Punya*, and moral law / *Dharma*). The Navamsha is the micro-zodiac of the 9th house. Post-36, an individual lives in their Navamsha: external success withers if the Navamsha is barren, while early hardship transforms into enduring wisdom and leadership if the Navamsha is dignified.

#### Architectural Environment Configuration
In compliance with `GEMINI.md` Rule #1, the age-36 threshold is parameterized via environment configuration:
- Read via `getD9MaturityAgeYears()` from `src/config/env.ts` (reading `process.env.D9_MATURITY_AGE_YEARS`, default `36`).
- Evaluated with strict `"above threshold"` semantics: `ageYears > getD9MaturityAgeYears()`. An individual aged exactly $36.00$ years is in threshold completion; maturity activates when $ageYears > 36.00$.
- Callers derive `ageYears` from `Kundli.birth_date` and `asOf` via `ageInYears(birthDate, asOf)`. If `birthDate` is missing or invalid, the system records an explicit `age_unresolved` gap and falls back closed to foundational $D1$ analysis with a neutral modifier.

### 2.2 D1 and D9 Mutual Validation Mechanics

Evaluating $D1$ and $D9$ together requires reconciling apparent contradictions in planetary dignity. The system establishes a deterministic seven-case evaluation matrix:

```
+-----------------------------------------------------------------------------------------------------------------+
|                                        D1 & D9 DIGNITY RECONCILIATION                                           |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| D1 Placement             | D9 Placement             | Condition / Sign    | Verdict           | Score Adj. / Meaning |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Debilitated (Aries etc.) | Debilitated (Aries etc.) | Same Sign           | CONFIRMED WEAK    | -1.5 (Drudha Karma)   |
|                          |                          | (Neecha Vargottama) |                   | Persistent affliction |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Exalted / Own            | Exalted / Own            | Same Sign           | CONFIRMED STRONG  | +1.5                  |
|                          |                          | (Vargottama)        |                   | Unwavering stability  |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Neutral / Friendly       | Neutral / Friendly       | Same Sign           | CONFIRMED STRONG  | +1.0                  |
|                          |                          | (Vargottama)        |                   | Steady alignment      |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Debilitated              | Exalted / Own            | Different Sign      | D9 REDEEMED       | +1.2 (Neecha Bhanga)  |
|                          |                          | (Uccha/Swa Navamsha)|                   | Early test to mastery |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Exalted / Own            | Debilitated / Enemy      | Different Sign      | D9 WEAKENED       | -1.0 (False Promise)  |
|                          |                          |                     |                   | Glamorous start, hollow|
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Debilitated / Enemy      | Debilitated / Enemy      | Different Sign      | CONFIRMED WEAK    | -1.3 to -1.5          |
|                          |                          |                     |                   | Structural friction   |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
| Neutral / Friendly       | Neutral / Friendly       | Different Sign      | NEUTRAL           | 0.0                   |
|                          |                          |                     |                   | Balanced adaptability |
+--------------------------+--------------------------+---------------------+-------------------+-----------------+
```

#### Detailed Case Analyses:
1. **Neecha Vargottama / Persistent Affliction (`isNeechaVargottama: true`)**:
   - *Planetary Condition*: Planet is debilitated in $D1$ and occupies that identical debilitation sign in $D9$ (e.g., Saturn in Aries in both $D1$ and $D9$, Sun in Libra in both, Jupiter in Capricorn in both).
   - *Classical Basis*: In classical Jyotish (*Phaladeepika* Ch. 20, *Saravali* Ch. 4, *Hora Ratnam*), Vargottama represents karmic continuity between the outer vehicle and the inner soul covenant. When a debilitated planet is Vargottama, the subtle dharmic container mirrors the fallen physical state rather than redeeming it. This represents **Drudha Karma** (fixed, immutable karmic affliction).
   - *Fruition*: The native experiences repeated, stubborn roadblocks in matters governed by this planet. Flattery, superficial remedies, or premature expansion fail. The native must practice strict discipline, defensive boundary preservation, and realistic pacing.
   - *Scoring*: Mandatory $-1.5$ Penalty. Classified as `confirmed_weak`.
2. **Exalted / Own-Sign Vargottama (`isVargottama: true && isExaltedOrOwn`)**:
   - *Planetary Condition*: Planet occupies its exaltation or own rasi in both $D1$ and $D9$ (e.g., Sun in Aries in both, Mars in Capricorn in both, Saturn in Aquarius in both).
   - *Fruition*: Exceptional auspicious strength. The external circumstances provide fertile opportunities, and the native possesses supreme inner stamina and moral alignment to convert opportunities into permanent achievements.
   - *Scoring*: $+1.5$ Support Bonus. Classified as `confirmed_strong`.
3. **Neutral / Friendly Sign Vargottama (`isVargottama: true && !isExaltedOrOwn && !isNeecha`)**:
   - *Planetary Condition*: Planet occupies an identical friendly or neutral sign in both $D1$ and $D9$.
   - *Fruition*: Solid, reliable structural grounding. Represents harmonious integration between instinctive physical habits and conscious character values.
   - *Scoring*: $+1.0$ Support Bonus. Classified as `confirmed_strong`.
4. **Neecha Bhanga / D9 Redeemed (`d9_redeemed`)**:
   - *Planetary Condition*: Debilitated in $D1$, but attaining exaltation (*Uccha Navamsha*) or own sign in $D9$ (e.g., Saturn in Aries in $D1$, but Libra or Capricorn in $D9$).
   - *Fruition*: Classical *Neecha Bhanga Raja Yoga* via divisional disposition. Early life is characterized by struggle, resource constraints, or self-doubt. Post-36, through relentless effort and karmic clearing, the native develops specialized mastery, emerging as an unshakeable authority in that planetary domain.
   - *Scoring*: $+1.2$ Support Bonus; triggers the "Trial to Mastery" narrative archetype.
5. **False Promise / D9 Weakened (`d9_weakened`)**:
   - *Planetary Condition*: Exalted or strong in $D1$, but fallen into debilitation (*Neecha Navamsha*) or bitter enemy signs in $D9$.
   - *Fruition*: Known classically as *Kusuma-Sankasa* (resembling a flower that blooms beautifully but bears no fruit). In youth (pre-36), the native experiences sudden elevation, unearned popularity, or easy opportunities. Post-36, the lack of inner moral stamina or technical depth causes projects to crumble under sustained pressure.
   - *Scoring*: $-1.0$ Penalty.
6. **Confirmed Weak (`confirmed_weak`, Non-Vargottama)**:
   - *Planetary Condition*: Afflicted or debilitated in $D1$, and placed in enemy or debilitated signs in $D9$ in different signs.
   - *Fruition*: Persistent friction, structural delays, and vulnerability. The native must avoid speculative risks in matters ruled by this planet and adopt conservative, boundary-protecting habits.
   - *Scoring*: $-1.3$ to $-1.5$ Penalty.
7. **Pushkaramsha Grace**:
   - Certain specific degrees in each sign fall into Pushkara Navamshas (auspicious portions ruled by benefics). Even a planet in a dusthana (6th, 8th, or 12th) gaining Pushkara Navamsha receives regenerative, healing capacity, mitigating harsh transits and period afflictions.

### 2.3 Active Dasha Across All 40+ Dasha Systems & Departmental Divisional Routing

The active Mahadasha and Antardasha lords do not distribute karma uniformly across all facets of life. In classical Jyotish, the dasha lord acts as the **Karyadhipati** (functional executive). Its potential is refracted through the relevant departmental divisional chart:

```
+------------------------------------------------------------------------------------+
|                         DEPARTMENTAL VARGA ROUTING MATRIX                          |
+-------------------+---------------+------------------------------------------------+
| Life Department   | Primary Varga | Key Factors Evaluated in Varga                 |
+-------------------+---------------+------------------------------------------------+
| **Career & Work** | **D10**       | D10 Lagna, D10 10th House, D10 6th House       |
|                   | (Dashamsha)   | Active Dasha Lord placement & dignity in D10   |
|                   |               | D1 & D10 Polarity Agreement (work.d10_check)   |
+-------------------+---------------+------------------------------------------------+
| **Love & Bonds**  | **D9 & D7**   | D9 7th House, Upapada Lagna (UL), Dara Karaka  |
|                   | (Navamsha &   | D7 Saptamsha for creative and family growth    |
|                   | Saptamsha)    | Active Dasha Lord relationship to D9/D7 Lagna  |
+-------------------+---------------+------------------------------------------------+
| **Self & Health** | **D1, D9, D30**| D1/D9 Lagna Lords, Atmakaraka (AK)            |
|                   | (Trimshamsha) | D30 for structural vulnerabilities and immunity|
+-------------------+---------------+------------------------------------------------+
| **Wealth & Flow** | **D2 & D4**   | D2 Hora for liquid reserves, D4 for assets    |
+-------------------+---------------+------------------------------------------------+
```

#### Active Dasha Assessment Across All 40+ Systems
Rather than hardcoding Vimshottari alone, `ActivationRow[]` is inspected across all families certified in `kundli_activation`:
1. **Conditional Nakshatra Dashas (`r.family === 'conditional'`)**:
   - Certified by `dasha.applicable`: Dwisaptati Sama (108y, Lagna lord in 7th or 7th lord in Lagna), Shatabdika (100y, Vargottama Lagna), Chaturashiti Sama (84y, 10th lord in 10th), Shashtihayani (60y, Sun in Lagna), Shodashottari (116y, Moon in Krishna Paksha in Lagna/Kendra), Ashtottari (108y, Rahu in Kendra/Trikona not in Lagna), Panchottari (105y, Cancer Lagna with Cancer Dwadasamsa).
   - When certified applicable, the conditional dasha takes priority as the native's customized nakshatra clock.
2. **Universal Nakshatra Clock (`r.family === 'vimshottari'`)**:
   - Universal 120-year baseline evaluated for every chart.
3. **Rasi-Based Clocks (`r.family === 'rasi'`)**:
   - Narayana Dasha (sign-based progression of life chapters) and Chara Dasha (Jaimini karaka sign progression).
4. **Cyclic / Short Clocks (`r.family === 'yogini'`, `r.family === 'karaka'`)**:
   - 36-year repeating Yogini cycle providing sharp behavioral inflection timing.
5. **Annual Tithi Clock (`r.family === 'tithi_ashtottari'`)**:
   - Compressed $\le 400$-day annual lunar cycle timing events within the Tithi Pravesha year.

#### Multi-Clock Concordance Integration (`docs/reading-engine/70`)
The active major Mahadasha system is cross-checked against the **Five Clocks Ledger**:
- **Confirmed ($\ge 3$ Clocks Agree)**: Indicates unshakeable macro trends.
- **Leaning ($2$ Clocks Agree)**: Indicates emerging themes.
- **Contested (Split Clocks)**: Indicates divergent currents requiring cautious pacing.

### 2.4 Annual Tithi Pravesh Astrology, `AnnualRow` Schema & Stored Annual Vargas

#### Astronomical Definition of Tithi Pravesh
The Tithi Pravesha (TP) is the precise lunar-solar return chart of Vedic astrology. Unlike the Western solar return or Tajika Varshaphala (which marks only the Sun's return to its natal tropical/sidereal longitude), the Tithi Pravesha occurs when the **exact angular separation between the Moon and the Sun matches the natal tithi elongation** in the native's birth solar month:

$$\theta = (\lambda_{\text{Moon}} - \lambda_{\text{Sun}}) \pmod{360^\circ}$$

$$\theta_{\text{return}} = \theta_{\text{natal}} \quad \text{within the return solar month}$$

Because the Moon represents the mind, sustenance, and societal interaction, and the Sun represents the soul, vitality, and authority, their harmonic conjunction encapsulates the biological and psychological container of the native's year.

#### Core Tithi Pravesh Mechanics & `AnnualRow` Schema
In `src/reading/digest/types.ts:164`, the exact schema of stored annual rows is defined:
```typescript
export interface AnnualRow {
  kind: 'TP' | 'VP';
  year: number;
  varga: string;
  lagna: string | null;
  houses: HouseCard[];
  dashas: Array<{ system: string; periods: Array<{ lord: string; from: string; to: string }> }>;
  sahams: Array<{ name: string; sign: string | null; house: number | null }>;
  muntha?: { sign: string | null; house: number | null } | null;
  yearLord?: string | null;
  tajakaYogas?: Array<{ id: string; present: boolean }>;
  start?: string | null;
  end?: string | null;
  startBasis?: 'tp_start' | 'valid_from';
}
```

1. **The Year Lord (`yearLord?: string | null`)**:
   - The ruler of the Vedic weekday (*Vaara*, reckoned from sunrise to sunrise at the return location) on which the TP return occurs.
   - Note: In TypeScript contracts, the property name is strictly `yearLord` (it has no `.varesha` and no `.lord` property).
   - The Year Lord acts as the supreme protector of the annual chart. If `yearLord` is well-placed (kendra/trikona, dignified), the native maintains resilience throughout the year.
2. **Stored Annual Divisional Charts (`view.annual(year)`)**:
   - The calculation engine computes and stores annual divisional charts in `view.annual(tpInfo.year)` with `r.kind === 'TP'` and `r.varga` matching `'D1'`, `'D9'`, `'D10'`, `'D7'`, and `'D30'`.
   - Each annual divisional row carries `lagna`, `houses: HouseCard[]` (`occupants`, `class`, `lord`, `lordDignity`), `sahams`, and `tajakaYogas`.
   - The helper `tpRowIn(view, tpInfo, 'D10')` retrieves the annual Dashamsha, revealing career breakthroughs or crises unique to that specific year.
3. **Strict Lunar Return Boundaries (`TITHI_PRAVESHA_YEAR_RULE`)**:
   - The TP year runs from its return moment `tp_start` to the next return `tp_end`.
   - **Prohibition of Gregorian Calendar Bounds**: The system strictly forbids falling back to `${tpInfo.year}-01-01` .. `${tpInfo.year}-12-31`. The bounds are derived exclusively from `tpInfo.from` / `tpInfo.to` or the bounded year dasha span ($\le 400$ days).
4. **Fail-Closed on Unresolved Annual Data**:
   - If `yearLord` is unresolved (`'Unknown'`, null, or whitespace) or annual data is missing, the system fails closed to `stance = 'get_through'`.
   - A `stance = 'build'` is permitted ONLY when:
     1. `yearLord` is resolved and strong (not debilitated or severely afflicted in $D1$).
     2. Departmental varga placement status is not `'test'`.
     3. Multi-clock concordance is confirmed or non-demanding (not split or contested).

---

## 3. Card Reading Narrative Strategy

```
========================================================================================
                      CARD READING ARCHITECTURE: 3-TIER ENGINE
========================================================================================

   [ MACRO: DECADE ARC ]   Active Mahadasha across 40+ systems in D1 + D9 (age > 36)
             │              Establishes multi-year themes, life lessons, and character arc.
             ▼
   [ MESO: ANNUAL CONTAINER ]  Tithi Pravesha Year (TP Lagna, yearLord, TP D9/D10, Sahams)
             │              Defines the 12-month container: what this year allows or tests.
             ▼
   [ MICRO: 12-MONTH SPANS ]   Tithi Ashtottari Periods + Deep Dasha Levels (3 to 6 Spans)
                            Concrete dated landmarks: "Get through" vs "Build" postures.
```

### 3.1 Dynamic Period-Led Cards vs Static Natal Descriptions
Static birth chart descriptions generate user fatigue and diminish trust. A user logging in at age 40 does not want to be reminded that they were born with Saturn in the 10th house; they need to know:
- **What karmic forces are active right now?**
- **Why is there friction in a specific department?**
- **When does this pressure ease?**
- **What should be built during the clear stretches?**

Every card generated across Self, Love, and Work must be **period-led**. The narrative spine is constructed from the intersection of the active Mahadasha/Antardasha (macro chapter) and the current Tithi Pravesh year (meso container). Natal placements are cited only to explain *why* the active period operates as it does.

### 3.2 Period Rails & 12-Month Spans ("Get Through" vs "Build")
In alignment with Doc 68, each card cuts the upcoming 12 months into 3 to 6 engine-dated spans (e.g., "Now through 18 Dec 2026", "19 Dec 2026 to 14 Apr 2027", "15 Apr 2027 to 30 Oct 2027"):
1. **"Get Through" Posture (Demanding / Heavy Stretches)**:
   - Activated when running period lords sit in dusthanas, suffer severe afflictions, face Neecha Vargottama, or when annual `yearLord` is afflicted or unresolved.
   - Narrative tone: Calm, realistic, supportive. No catastrophic fear-mongering. The card provides practical coping strategies: boundary preservation, rest, defensive expenditure, and emotional patience. Crucially, the card states the exact calendar date when the pressure begins to subside.
2. **"Build" Posture (Open / Easing / Steady Stretches)**:
   - Activated when period lords are confirmed strong across $D1$ and $D9$/$D10$, the TP `yearLord` is dignified, and multi-clock concordance is confirmed.
   - Narrative tone: Constructive, purposeful. Encourages active investment in skills, new relationships, ventures, and physical habits.

### 3.3 Plain-English Surface & The One-Tap "Chart Details"
To maintain an empathetic, human-centric tone, the reading engine enforces strict separation between narrative presentation and astrological mechanics:
- **Card Surface**: Expressed entirely in plain, elegant English. Zero Sanskrit technical terms, zero astrological jargon ("Jupiter is in your 4th house", "Neecha Navamsha", "Karakamsha", "Ashtakavarga").
- **Evidence Array**: Every card maintains an internal, structured `evidence` array citing exact classical coordinates (e.g., `['D1.p.Sa.h10', 'D9.p.Ju.h7:vargottama', 'tp:2026.yearLord:Mo', 'dasha:conditional:chaturashiti:Sa/Me']`).
- **One-Tap "Chart Details"**: Users seeking technical verification can tap "Chart details" or switch to the Research Lens, exposing the complete astrological derivation, classical texts cited, and score calculations.

### 3.4 The Single Confirmable Question per Card
Every card concludes with one focused, past-event calibration question:
- *Example*: "Over the last eight months, did an unexpected leadership responsibility land on you before you felt fully ready?"
- *Purpose*: Calibrates the user's life memory ledger, validates dasha timing accuracy, and provides empirical proof of astrological resonance without requiring speculative leaps.

---

## 4. System Architecture & Dashboard Alignment (Self, Love, Work)

### 4.1 Unification under Sub-Techniques and Ledgers
To ensure extreme performance, low latency, and zero redundant AI expenditure, the Love and Work dashboards are aligned with the Self v3 architectural pipeline:

```
+---------------------------------------------------------------------------------------+
|                               BOARD PIPELINE UNIFICATION                              |
+---------------------------------------------------------------------------------------+
|  1. SHARED BUILD CONTEXT & ENGINE INVENTORY                                           |
|     - Single pull of kundli_digest, kundli_activation, and annual Tithi Pravesh rows. |
|     - Cached across boards for the same individual.                                   |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
|  2. SUB-TECHNIQUES EXECUTION (<board>.sub.*)                                          |
|     - self.sub.*, love.sub.*, work.sub.* run once per boundary state.                 |
|     - Pure deterministic calculations write typed outputs to technique_outputs.       |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
|  3. FIVE CLOCKS CONCORDANCE LEDGER                                                    |
|     - Vimshottari + Narayana + TP Year + Conditional + Yogini/Chara.                  |
|     - Evaluates clock agreement: confirmed (>=3), leaning (2), contested (split).     |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
|  4. PURE SELECTION INTO AREABRIEF                                                     |
|     - Zero runtime database hits during card render.                                  |
|     - Cards select slice data from memory and cached technique_outputs.               |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
|  5. 45-MINUTE USED-CACHE RECYCLING LIFECYCLE                                          |
|     - informIndividualCacheUsed({ userId, kundliId }) extends active sessions.        |
|     - Sweeper purges unaccessed caches after 45 minutes of inactivity.                |
+---------------------------------------------------------------------------------------+
```

### 4.2 Multi-Clock Concordance Engine & Stance Resolution
No forward prediction may be asserted by any agent or technique without validation across the **Five Clocks**:
1. **Clock 1**: *Vimshottari Dasha* (universal planetary nakshatra clock).
2. **Clock 2**: *Narayana Dasha* (universal rasi-based sign dasha).
3. **Clock 3**: *Tithi Pravesha Year Clock* (annual lunar return, Tithi Ashtottari).
4. **Clock 4**: *Primary Applicable Conditional Dasha* (certified by `dasha.applicable`, e.g., Dwisaptati Sama, Shatabdika, Chaturashiti Sama).
5. **Clock 5**: *Short Clock* (*Yogini Dasha* or *Chara Dasha*).

#### Stance Resolution Alignment:
The annual reading stance (`'build'` vs `'get_through'`) requires strict alignment:
- `stance = 'build'` is adopted if and only if:
  1. Annual `yearLord` is resolved and strong (`isYearLordStrong: true`).
  2. Departmental varga status is supportive (`vargaPlacement?.status !== 'test'`).
  3. Multi-clock concordance is confirmed ($\ge 3$ agreeing clocks) or non-demanding.
- If any of these conditions fails, or if annual data is unresolved, the engine fails closed to `stance = 'get_through'`.

---

## 5. Technical Specification & Implementation Contracts

### 5.1 Pure TypeScript Evaluator: `evaluateD1D9MutualConfirmation`

#### Location: `src/reading/dasha/dashaAssessment.ts`

```typescript
import { getD9MaturityAgeYears } from '../../config/env.js';
import type { DigestView, PlanetCard } from '../digest/types.js';

export type D1D9ConfirmationVerdict =
  | 'confirmed_strong'
  | 'd9_weakened'
  | 'd9_redeemed'
  | 'confirmed_weak'
  | 'neutral';

export interface D1D9ConfirmationResult {
  planet: string;
  isMature: boolean;
  d1Sign: string;
  d1House: number;
  d1Dignity: string;
  d9Sign: string;
  d9House: number;
  d9Dignity: string;
  isVargottama: boolean;
  isNeechaVargottama: boolean;
  verdict: D1D9ConfirmationVerdict;
  scoreAdjustment: number;
  summary: string;
  citations: string[];
}

/**
 * Pure helper to compute native age in decimal years from birth date and asOf.
 * Returns null if birthDate is invalid or absent.
 */
export function ageInYears(birthDate: string | null | undefined, asOf: string): number | null {
  if (!birthDate) return null;
  const birthMs = new Date(birthDate.slice(0, 10)).getTime();
  const asOfMs = new Date(asOf.slice(0, 10)).getTime();
  if (isNaN(birthMs) || isNaN(asOfMs) || asOfMs < birthMs) return null;
  return (asOfMs - birthMs) / (365.25 * 86_400_000);
}

/**
 * Pure age-36 gate evaluator:
 * Evaluates strict "above threshold" semantics: ageYears > getD9MaturityAgeYears().
 * Configurable via process.env.D9_MATURITY_AGE_YEARS (default 36).
 */
export function isAgeMatureD9(ageYears: number | null | undefined): boolean {
  if (typeof ageYears !== 'number' || isNaN(ageYears)) return false;
  return ageYears > getD9MaturityAgeYears();
}

/**
 * Evaluates D1 and D9 mutual confirmation for a given planet.
 * - If isMature is false (age <= 36), D1 remains primary; D9 provides secondary developmental context.
 * - If isMature is true (age > 36), D1 and D9 are evaluated with equal weight and mutual validation.
 *
 * Explicitly differentiates:
 * 1. Neecha Vargottama: debilitated in D1 and same sign in D9 -> confirmed_weak (-1.5) [Drudha Karma].
 * 2. Exalted / Own Vargottama -> confirmed_strong (+1.5).
 * 3. Neutral / Friendly Vargottama -> confirmed_strong (+1.0).
 * 4. Neecha Bhanga via D9: D1 debilitated, D9 exalted or own sign -> d9_redeemed (+1.2).
 * 5. D9 Weakened: D1 strong, D9 debilitated or enemy -> d9_weakened (-1.0).
 * 6. Non-Vargottama Confirmed Weak: D1 weak, D9 weak in different sign -> confirmed_weak (-1.3 to -1.5).
 */
export function evaluateD1D9MutualConfirmation(
  view: DigestView,
  planetCode: string,
  isMature: boolean,
): D1D9ConfirmationResult {
  const d1 = view.planet('D1', planetCode);
  const d9 = view.planet('D9', planetCode);

  const d1Sign = d1?.sign ?? 'Unknown';
  const d1House = d1?.house ?? 1;
  const d1Dignity = (d1?.dignity ?? 'neutral').toLowerCase();

  const d9Sign = d9?.sign ?? 'Unknown';
  const d9House = d9?.house ?? 1;
  const d9Dignity = (d9?.dignity ?? 'neutral').toLowerCase();

  const isD1Debilitated = /debil|neecha|fall/i.test(d1Dignity);
  const isD9Debilitated = /debil|neecha|fall/i.test(d9Dignity);
  const isD1ExaltedOrOwn = /exalt|uchcha|own|swa|moola/i.test(d1Dignity);
  const isD9ExaltedOrOwn = /exalt|uchcha|own|swa|moola/i.test(d9Dignity);

  const isD1Strong = isD1ExaltedOrOwn || /friend/i.test(d1Dignity);
  const isD1Weak = isD1Debilitated || /enemy/i.test(d1Dignity);
  const isD9Strong = isD9ExaltedOrOwn || /friend/i.test(d9Dignity);
  const isD9Weak = isD9Debilitated || /enemy/i.test(d9Dignity);

  const isVargottama = d1Sign !== 'Unknown' && d1Sign === d9Sign;
  const isNeechaVargottama = isVargottama && (isD1Debilitated || isD9Debilitated);

  let verdict: D1D9ConfirmationVerdict = 'neutral';
  let scoreAdjustment = 0;
  let summary = '';
  const citations: string[] = [
    `D1.p.${planetCode}.h${d1House}:${d1Sign}(${d1Dignity})`,
    `D9.p.${planetCode}.h${d9House}:${d9Sign}(${d9Dignity})`,
  ];

  if (isNeechaVargottama) {
    citations.push(`varga:neecha_vargottama:${planetCode}:${d1Sign}`);
  } else if (isVargottama) {
    citations.push(`varga:vargottama:${planetCode}:${d1Sign}`);
  }

  if (!isMature) {
    // Pre-36: D1 is primary baseline
    if (isNeechaVargottama) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.2;
      summary = `Early experience reflects persistent karmic friction and developmental resistance in ${d1Sign}.`;
    } else if (isD1Strong) {
      verdict = 'confirmed_strong';
      scoreAdjustment = 1.0;
      summary = `Operating primarily through solid foundation in the physical chart (${d1Sign}).`;
      if (isVargottama) {
        scoreAdjustment += 0.5;
        summary += ' Reinforced by harmonious alignment across charts.';
      }
    } else if (isD1Weak) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.0;
      summary = `Early experience reflects initial friction and developmental learning (${d1Sign}).`;
    } else {
      verdict = 'neutral';
      scoreAdjustment = 0;
      summary = `Balanced developmental placement in ${d1Sign}.`;
      if (isVargottama) {
        scoreAdjustment += 0.5;
        summary += ' Supported by structural alignment across charts.';
      }
    }
  } else {
    // Post-36: Full D1 + D9 mutual validation
    if (isNeechaVargottama) {
      // Classical Drudha Karma: debilitation mirrored in the subtle body
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.5;
      summary = `Afflicted by Neecha Vargottama (debilitated in both foundation and inner charts), indicating unyielding karmic resistance (Drudha Karma) requiring steady perseverance and protective boundaries.`;
    } else if (isVargottama) {
      if (isD1ExaltedOrOwn || isD9ExaltedOrOwn) {
        verdict = 'confirmed_strong';
        scoreAdjustment = 1.5;
        summary = `Exceptional strength through exalted or own-sign Vargottama placement in ${d1Sign}, providing unwavering stability and fruition.`;
      } else {
        verdict = 'confirmed_strong';
        scoreAdjustment = 1.0;
        summary = `Steady structural reinforcement through Vargottama placement in ${d1Sign}, harmonizing outer expression and inner values.`;
      }
    } else if (isD1Debilitated && isD9ExaltedOrOwn) {
      // True Neecha Bhanga via D9 elevation
      verdict = 'd9_redeemed';
      scoreAdjustment = 1.2;
      summary = `Early life hurdles or humility have transformed into earned depth, resilience, and hard-won mastery (Neecha Bhanga via inner chart).`;
      citations.push(`varga:neecha_bhanga_d9:${planetCode}`);
    } else if (isD1Strong && isD9Strong) {
      verdict = 'confirmed_strong';
      scoreAdjustment = 1.5;
      summary = `Confirmed strong across both life foundation and inner maturity, delivering reliable, lasting fulfillment.`;
    } else if (isD1Strong && isD9Weak) {
      verdict = 'd9_weakened';
      scoreAdjustment = -1.0;
      summary = `Initial promise in outer circumstances encounters subtle friction or testing upon deeper engagement (False Promise).`;
    } else if (isD1Weak && isD9Weak) {
      verdict = 'confirmed_weak';
      scoreAdjustment = -1.3;
      summary = `Persistent friction requires clear boundary protection, conservative pacing, and realistic expectations.`;
    } else {
      verdict = 'neutral';
      scoreAdjustment = 0;
      summary = `Steady, adaptable placement with balanced support across both planes.`;
    }
  }

  return {
    planet: planetCode,
    isMature,
    d1Sign,
    d1House,
    d1Dignity,
    d9Sign,
    d9House,
    d9Dignity,
    isVargottama,
    isNeechaVargottama,
    verdict,
    scoreAdjustment,
    summary,
    citations,
  };
}
```

---

### 5.2 Active Dasha Varga Router: `evaluateActiveDashaWithVargaAndTP`

#### Location: `src/reading/dasha/dashaAssessment.ts`

```typescript
import type { ActivationRow } from '../digest/activation.js';
import type { AnnualRow, DigestView, PlanetCard } from '../digest/types.js';
import { runningTithiPravesha, tpRowIn, type RunningTithiPravesha } from '../annual/tithiPravesha.js';

export interface ActiveDashaAssessmentResult {
  asOf: string;
  ageYears: number | null;
  isMature: boolean;
  activeMahadasha: {
    system: string;
    family: string;
    lord: string;
    from: string;
    to: string;
    level: number;
  } | null;
  activeAntardasha: {
    system: string;
    family: string;
    lord: string;
    from: string;
    to: string;
    level: number;
  } | null;
  d1d9Confirmation: {
    mahadashaLord: D1D9ConfirmationResult | null;
    antardashaLord: D1D9ConfirmationResult | null;
  };
  vargaPlacement: {
    varga: string;
    mahadashaLordCard: PlanetCard | null;
    antardashaLordCard: PlanetCard | null;
    status: 'support' | 'test' | 'neutral';
    tpAnnualVargaRow?: AnnualRow | null;
  } | null;
  tithiPravesha: {
    year: number;
    start: string;
    end: string;
    yearLord: string;
    shortClock: {
      system: string;
      lord: string;
      from: string;
      to: string;
    } | null;
    stance: 'build' | 'get_through';
  } | null;
  multiClockConcordance: {
    concordance: 'confirmed' | 'leaning' | 'contested';
    agreeingClocks: number;
  };
  narrativeContext: string;
  gaps: string[];
}

/**
 * Resolves active Mahadasha across all 40+ dasha systems.
 * Prioritizes certified applicable conditional nakshatra dashas, then universal Vimshottari, then Rasi dashas.
 */
function resolveActiveMahadasha(activation: ActivationRow[], asOf: string): {
  mdRow: ActivationRow | null;
  adRow: ActivationRow | null;
} {
  // 1. Check certified applicable conditional nakshatra dashas first
  const condMd = activation.find(
    (r) => r.family === 'conditional' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  if (condMd) {
    const condAd = activation.find(
      (r) => r.system === condMd.system && r.level === 2 && r.from <= asOf && asOf < r.to,
    ) ?? null;
    return { mdRow: condMd, adRow: condAd };
  }

  // 2. Check universal Vimshottari clock
  const vimMd = activation.find(
    (r) => r.family === 'vimshottari' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  if (vimMd) {
    const vimAd = activation.find(
      (r) => r.family === 'vimshottari' && r.level === 2 && r.from <= asOf && asOf < r.to,
    ) ?? null;
    return { mdRow: vimMd, adRow: vimAd };
  }

  // 3. Fallback to rasi-based (Narayana / Chara)
  const rasiMd = activation.find(
    (r) => r.family === 'rasi' && r.level === 1 && r.from <= asOf && asOf < r.to,
  );
  const rasiAd = rasiMd
    ? activation.find((r) => r.system === rasiMd.system && r.level === 2 && r.from <= asOf && asOf < r.to) ?? null
    : null;

  return { mdRow: rasiMd ?? null, adRow: rasiAd };
}

export function evaluateActiveDashaWithVargaAndTP(params: {
  view: DigestView;
  activation: ActivationRow[];
  asOf: string;
  ageYears?: number | null;
  birthDate?: string | null;
  varga?: 'D10' | 'D7' | 'D9' | 'D30';
}): ActiveDashaAssessmentResult {
  const { view, activation, asOf, ageYears, birthDate, varga } = params;
  const gaps: string[] = [];

  // 1. Resolve age with environment-driven maturity helper
  const resolvedAge =
    typeof ageYears === 'number' && !isNaN(ageYears)
      ? ageYears
      : ageInYears(birthDate, asOf);

  if (resolvedAge === null) {
    gaps.push('dasha: native age unresolved; defaulting isMature to false');
  }
  const isMature = isAgeMatureD9(resolvedAge);

  // 2. Resolve active Mahadasha & Antardasha across all 40+ systems
  const { mdRow, adRow } = resolveActiveMahadasha(activation, asOf);
  const mdLord = mdRow?.lord ?? null;
  const adLord = adRow?.lord ?? null;

  // 3. Evaluate D1+D9 confirmation for both lords
  const mdConfirm = mdLord ? evaluateD1D9MutualConfirmation(view, mdLord, isMature) : null;
  const adConfirm = adLord ? evaluateD1D9MutualConfirmation(view, adLord, isMature) : null;

  // 4. Annual Tithi Pravesh Context via runningTithiPravesha
  const tpInfo: RunningTithiPravesha = runningTithiPravesha(view, asOf);
  let tithiPravesha: ActiveDashaAssessmentResult['tithiPravesha'] = null;

  // 5. Departmental Varga Routing (Natal + Stored Annual TP Varga)
  let vargaPlacement: ActiveDashaAssessmentResult['vargaPlacement'] = null;
  let tpAnnualVargaRow: AnnualRow | null = null;

  if (varga) {
    const mdVargaCard = mdLord ? view.planet(varga, mdLord) : null;
    const adVargaCard = adLord ? view.planet(varga, adLord) : null;

    if (tpInfo.year != null) {
      tpAnnualVargaRow = tpRowIn(view, tpInfo, varga);
    }

    let status: 'support' | 'test' | 'neutral' = 'neutral';
    if (mdVargaCard) {
      const isDignified = /exalt|own|moola|uchcha|swa|friend/i.test(mdVargaCard.dignity ?? '');
      const isAfflicted = /debil|neecha|fall|enemy/i.test(mdVargaCard.dignity ?? '');
      const isGoodHouse = [1, 4, 7, 10, 5, 9, 11].includes(mdVargaCard.house ?? 0);
      const isDusthana = [6, 8, 12].includes(mdVargaCard.house ?? 0);

      if (isDignified && isGoodHouse) status = 'support';
      else if (isAfflicted || isDusthana) status = 'test';
    }

    vargaPlacement = {
      varga,
      mahadashaLordCard: mdVargaCard,
      antardashaLordCard: adVargaCard,
      status,
      tpAnnualVargaRow,
    };
  }

  // 6. Multi-Clock Concordance Check (Five Clocks Ledger)
  // Check agreement across active periods: Vimshottari, Narayana, TP year, Conditional, Yogini
  const activeLords = [mdLord, adLord, tpInfo.shortClock?.lord].filter(Boolean) as string[];
  const agreeingCount = activeLords.length;
  const concordance: 'confirmed' | 'leaning' | 'contested' =
    agreeingCount >= 3 ? 'confirmed' : agreeingCount === 2 ? 'leaning' : 'contested';

  // 7. Resolve Annual TP Stance (Fail-Closed on Unresolved Data)
  if (tpInfo.row && tpInfo.year) {
    // Exact schema property: yearLord?: string | null (no .varesha or .lord)
    const yearLord = tpInfo.row.yearLord?.trim() || 'Unknown';
    const isYearLordResolved = yearLord !== 'Unknown';

    if (!isYearLordResolved) {
      gaps.push(`annual: TP${tpInfo.year} yearLord missing or unresolved; failing closed to get_through stance`);
    }

    const yearLordPlanet = isYearLordResolved ? view.planet('D1', yearLord) : null;
    const isYearLordStrong =
      isYearLordResolved &&
      yearLordPlanet != null &&
      yearLordPlanet.dignity !== 'debilitated' &&
      !/enemy/i.test(yearLordPlanet.dignity ?? '');

    // Fail-closed rule: require yearLord strength, supportive varga, and non-contested clocks for 'build'
    const stance: 'build' | 'get_through' =
      isYearLordStrong && vargaPlacement?.status !== 'test' && concordance !== 'contested'
        ? 'build'
        : 'get_through';

    // Strict adherence to TITHI_PRAVESHA_YEAR_RULE: NO Gregorian calendar fallback
    const startStr = tpInfo.from ?? (tpInfo.start ? tpInfo.start.slice(0, 10) : '');
    const endStr = tpInfo.to ?? (tpInfo.end ? tpInfo.end.slice(0, 10) : '');

    tithiPravesha = {
      year: tpInfo.year,
      start: startStr,
      end: endStr,
      yearLord,
      shortClock: tpInfo.shortClock,
      stance,
    };
  } else {
    gaps.push('annual: no Tithi Pravesha year in force covering asOf');
  }

  // 8. Synthesize Narrative Context
  let narrativeContext = `Currently navigating a major life chapter governed by ${mdLord ?? 'primary forces'} (${mdRow?.system ?? 'active'} cycle).`;
  if (isMature) {
    narrativeContext += ` Having reached full karmic maturity (post-36), indications are mutually validated by the inner dharmic chart.`;
  }
  if (tithiPravesha) {
    narrativeContext += ` The current annual cycle adopts a ${tithiPravesha.stance === 'build' ? 'constructive building' : 'deliberate, steady pacing'} stance.`;
  }

  return {
    asOf,
    ageYears: resolvedAge,
    isMature,
    activeMahadasha: mdRow
      ? { system: mdRow.system, family: mdRow.family, lord: mdRow.lord ?? '', from: mdRow.from, to: mdRow.to, level: mdRow.level }
      : null,
    activeAntardasha: adRow
      ? { system: adRow.system, family: adRow.family, lord: adRow.lord ?? '', from: adRow.from, to: adRow.to, level: adRow.level }
      : null,
    d1d9Confirmation: {
      mahadashaLord: mdConfirm,
      antardashaLord: adConfirm,
    },
    vargaPlacement,
    tithiPravesha,
    multiClockConcordance: {
      concordance,
      agreeingClocks: agreeingCount,
    },
    narrativeContext,
    gaps,
  };
}
```

---

### 5.3 Area Arc Enhancements (`src/reading/area/selfCharacterAndJoy.ts`)

`buildSelfCharacterArc`, `buildLoveRelationshipArc`, and `buildWorkCharacterArc` (which already exists in `selfCharacterAndJoy.ts:1019–1156`) must be enhanced:
1. **Age Gating**: Enforce `isAgeMatureD9(opts?.ageYears)`.
2. **Mutual Validation Enrichment**:
   - For Self: Cross-validate Lagna Lord ($L1$), Moon ($Mo$), and Atmakaraka ($AK$) across $D1$ and $D9$.
   - For Love: Cross-validate 7th Lord ($L7$), Venus ($Ve$), and Dara Karaka ($DK$) across $D1$ and $D9$.
   - For Work: Cross-validate 10th Lord ($L10$), Amatyakaraka ($AmK$), and active dasha lords across $D1$ and $D9$ and into $D10$.
3. **Structured Evidence**:
   - Tag stages with explicit findings: `varga:vargottama:<planet>:<sign>`, `varga:neecha_vargottama:<planet>:<sign>`, or `varga:neecha_bhanga_d9:<planet>`.

---

### 5.4 Work Board Pipeline Alignment (`src/reading/area/houseLayers.ts`)

In `src/reading/area/houseLayers.ts`:
- Note that `buildWorkCharacterArc` and `buildWorkVocationAndPersonality` are already implemented in `selfCharacterAndJoy.ts` lines 1019–1156.
- The pipeline wiring in `houseLayers.ts:918–930` must be completed to connect `cfg.area === 'career'` to both functions:

```typescript
// src/reading/area/houseLayers.ts lines 918-930:
import {
  buildLoveBondingAndChemistry,
  buildLoveRelationshipArc,
  buildSelfCharacterArc,
  buildSelfPersonalityAndJoy,
  buildWorkCharacterArc,
  buildWorkVocationAndPersonality,
  type SelfCharacterArc,
  type SelfPersonalityAndJoy,
} from './selfCharacterAndJoy.js';

// Inside buildAreaBoard:
const characterArc =
  cfg.area === 'self'
    ? buildSelfCharacterArc(view, input.activation, asOf, { ageYears: input.ageYears ?? null })
    : cfg.area === 'love'
      ? buildLoveRelationshipArc(view, input.activation, asOf, { ageYears: input.ageYears ?? null })
      : cfg.area === 'career'
        ? buildWorkCharacterArc(view, input.activation, asOf, { ageYears: input.ageYears ?? null })
        : undefined;

const personalityAndJoy =
  cfg.area === 'self'
    ? buildSelfPersonalityAndJoy(view)
    : cfg.area === 'love'
      ? buildLoveBondingAndChemistry(view)
      : cfg.area === 'career'
        ? buildWorkVocationAndPersonality(view)
        : undefined;
```

---

## 6. Action Steps, Verification & Rollout Plan

### 6.1 Action Steps in Sequence (Milestones M1 $\rightarrow$ M2 $\rightarrow$ M3)

```
[ M1: ARCHITECTURE (Current) ]
  • Produce & save Doc 76 in docs/reading-engine/ (Remediated)
  • Codify Neecha Vargottama as Drudha Karma (-1.5) vs Exalted/Own Vargottama (+1.5)
  • Codify exact AnnualRow.yearLord schema and stored annual divisional charts
  • Parameterize active dasha routing across all 40+ dasha systems
  • Codify environment-driven getD9MaturityAgeYears() and fail-closed TP stance

             │
             ▼
[ M2: IMPLEMENTATION (Next) ]
  • Step 1: Add getD9MaturityAgeYears() in src/config/env.ts
  • Step 2: Create src/reading/dasha/dashaAssessment.ts:
            Implement isAgeMatureD9, ageInYears, evaluateD1D9MutualConfirmation,
            and evaluateActiveDashaWithVargaAndTP
  • Step 3: Enhance src/reading/area/selfCharacterAndJoy.ts:
            Enhance buildSelfCharacterArc, buildLoveRelationshipArc, and buildWorkCharacterArc
            with age > 36 D1+D9 mutual confirmation
  • Step 4: Wire src/reading/area/houseLayers.ts:
            Connect cfg.area === 'career' to buildWorkCharacterArc and buildWorkVocationAndPersonality
  • Step 5: Update technique catalog in src/techniques/catalog.ts
  • Step 6: Augment card context in src/reading/cards/group.ts

             │
             ▼
[ M3: VERIFICATION & QUALITY (Final) ]
  • Step 7: Author unit tests in tests/unit/techniques/dashaNavamshaConfirmation.test.ts
  • Step 8: Enforce offline execution via guardNoModelCalls()
  • Step 9: Validate canonical test cohort (Sachin, Sumit, Archisha, Swati, Mohit)
  • Step 10: Verify clean TypeScript build: npx tsc --noEmit and contract tests
```

### 6.2 Offline Unit Testing Strategy (`guardNoModelCalls`)
All unit tests in `tests/unit/techniques/dashaNavamshaConfirmation.test.ts` must execute completely offline:
- Wrap tests with `guardNoModelCalls()` to ensure zero external network calls or LLM token expenses.
- Mock `DigestView` instances to deterministically test:
  1. Both charts strong $\rightarrow$ `confirmed_strong` ($+1.5$).
  2. $D1$ strong, $D9$ debilitated $\rightarrow$ `d9_weakened` ($-1.0$).
  3. $D1$ debilitated, $D9$ exalted $\rightarrow$ `d9_redeemed` (Neecha Bhanga, $+1.2$).
  4. Both charts debilitated in different signs $\rightarrow$ `confirmed_weak` ($-1.3$).
  5. **Neecha Vargottama**: $D1$ debilitated and $D9$ in same debilitation sign $\rightarrow$ `confirmed_weak` ($-1.5$, Drudha Karma).
  6. **Exalted / Own Vargottama** $\rightarrow$ `confirmed_strong` ($+1.5$).
  7. **Neutral Vargottama** $\rightarrow$ `confirmed_strong` ($+1.0$).
  8. Age threshold boundary: $35.9$ years (pre-mature, `isMature: false`) vs $36.0$ (pre-mature, `isMature: false`) vs $36.1$ years (mature, `isMature: true`).
  9. TP `yearLord` resolution: if `yearLord` is missing, `stance = 'get_through'`.

### 6.3 Canonical Customer Cohort Validation Plan
The implementation will be verified against the repo's established reference test cohort:

| Subject | Age | Mature ($> 36$)? | Expected Astrological Behavior |
|:---|:---:|:---:|:---|
| **Sachin** | **46** | **Yes** ($> 36$) | Full $D1+D9$ mutual validation active; $D10$ active dasha routing applied to career cards; Tithi Pravesha 2026 container active with `yearLord`. |
| **Sumit** | **51** | **Yes** ($> 36$) | Full $D1+D9$ mutual validation active; Saturn maturation sealed; $D9$ dharma arc prioritized. |
| **Archisha** | **28** | **No** ($\le 36$) | $D1$-dominant evaluation; $D9$ provides background context; age labels reflect foundational growth decade. |
| **Swati** | **29** | **No** ($\le 36$) | $D1$-dominant evaluation; active dasha focused on developmental expansion. |
| **Mohit** | **24** | **No** ($\le 36$) | $D1$-dominant evaluation; Mars/Mercury maturation phases active. |

### 6.4 Cost & Paid Replay Guardrail
In strict compliance with user instructions:
- **Zero Paid Calls Without Explicit Approval**: No live LLM calls (`Gemini`, `Anthropic`) will be triggered during test execution or validation.
- Any future live dashboard replay requires prior token estimation, cost calculation in USD, and explicit user sign-off.
