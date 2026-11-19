# Dashboard 01: Dating & Romance (Cards 1–10)

**Document Status:** Architecture & Card Specification (Milestone 2 — Relationships Track)  
**Dashboard Slug:** `relationships.dating` (sub-lens under `/love`)  
**Card Range:** Cards `#1` – `#10` (10 Cards Total)  
**Related Specs:** [`00-plan.md`](./00-plan.md), [`docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`](../reading-engine/78-love-work-dashboard-separation-and-cards.md), [`docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`](../reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md), [`docs/reading-engine/75-self-foundation-card.md`](../reading-engine/75-self-foundation-card.md), [`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`](../reading-engine/80-radha-and-catalogue-gap-analysis.md)

---

## 1. Domain Overview & Astrological Separation Rationale

In classical Jyotish, romantic attraction, courtship, and dating operate on a fundamentally different karmic circuit than formal marriage (`7th house`, `Upapada Lagna`, `D9`). A chart can display a luminous `5th house` and an expressive `Venus–Mars` axis—producing effortless romantic magnetism—while simultaneously carrying a delayed or heavy `7th house` / `Upapada` that resists legal commitment. Separating **Dating & Romance** into its own dedicated sub-lens prevents single, dating, or newly re-entering users from receiving irrelevant marital prompts (*"In-laws"*, *"Shared chores"*) and preserves diagnostic precision across houses, karakas, and divisional charts.

### 1.1 Dashboard Metadata

| Property | Specification |
|---|---|
| **Default Routing (`person_facts`)** | Routed automatically when `love.status` is `single`, `dating`, `casual`, `complicated`, or `divorced_seeking`; accessible anytime via the `/love` segmented lens switcher. |
| **Pinned Starter Cards (Default 5)** | `#1 dating.pulse`, `#2 dating.meeting_timing`, `#3 dating.delays_blocks`, `#4 dating.attraction_pattern`, `#10 dating.transition_commitment` (contextual swaps to `#5` or `#6` when `person_facts` signals active ambiguity or recent breakup). |
| **Picker-Available Cards (5)** | `#5 dating.mixed_signals`, `#6 dating.exes_closure`, `#7 dating.karmic_compatibility`, `#8 dating.intimacy_safety`, `#9 dating.breaking_patterns`. |
| **Primary Houses (`D1`)** | `5th` (romance, courtship, *Purva Punya*, heart's delight), `11th` (fulfillment of desires, social introductions), `12th` (*Shayana Sukha* / bed pleasures, private intimacy), `7th` (transition bridge to exclusivity), `4th` (emotional safety), `6th`/`8th` (disputes, hidden karma). |
| **Primary Karakas & Arudhas** | `Venus` (attraction, sensuality, relational sweetness), `Mars` (passion, pursuit, physical spark), `Moon` (emotional receptivity, *Manas*), `Mercury` (flirtation, banter), `A5` (*Mantra/Romance Pada*), `DK` (*Darakaraka*), `UL` (*Upapada Lagna* for commitment handoff). |
| **Primary Divisional Charts** | `D1` (circumstantial reality), `D9` (sustainability & age-36+ mutual confirmation gate), `D7` (*Saptamsha* — romantic & creative chemistry, erotic/generative fertility). |
| **Secondary / Diagnostic Vargas** | `D30` (*Trimshamsha* — obsessive or deceptive relationship loops in Cards `#7`, `#9`), `D12` (ancestral emotional patterning in Card `#8`). |

### 1.2 Full-Circle Coverage Matrix

| Functional Pillar | Cards Covered | What It Guarantees for the User |
|---|---|---|
| **Timing & Momentum** | `#1` Pulse, `#2` Meeting Timing, `#3` Delays & Blocks | Answers *when* romantic energy opens, *where* introductions occur, and *when* heavy delays lift. |
| **Chemistry & Pattern** | `#4` Partner You Draw, `#7` Karmic vs. Real, `#9` Breaking Loops | Separates unconscious attraction traps from genuine long-term compatibility and gives behavioral remedies. |
| **Live Ambiguity & Closure** | `#5` Mixed Signals, `#6` Exes & No-Contact, `#8` Intimacy & Safety | Navigates active courtship confusion, returning exes, and emotional/physical vulnerability safely. |
| **Transition & Commitment** | `#10` Dating Into Commitment | Tracks the exact astrological handoff from `5th house` courtship to `7th house` / `UL` defined partnership. |

---

## 2. Shared Engine Contracts & Architectural Guardrails

### 2.1 Zero Node Astrology & Engine Boundary
- **Calculation Authority:** All planetary longitudes, Nakshatra padas, Tara Bala tables, Arudha Padas (`A5`, `UL`, `AL`), Chara Karakas (`AK`..`DK`), divisional charts (`D1`, `D7`, `D9`, `D30`), 40+ Dasha trees, transits, and Tithi Pravesha returns are computed exclusively by the backend calculation engine (`AIAstra_Radha` / `pyjhora`) and persisted in `kundli_data`, `kundli_digest` (`DigestView`), and `kundli_activation` (`ActivationRow[]`).
- **Node/Web Responsibility:** TypeScript services read `DigestView`, `ActivationRow[]`, and `person_facts`, execute deterministic sub-techniques (`.sub.*` written to `technique_outputs`), run grouped LLM synthesis (`Oracle` + `Personalizer`) over stable cached prefixes (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`), and enforce 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES = 45` via `informIndividualCacheUsed`).
- **Strict User-Facing Redaction (`SOUL.md` §1 & `doc 75`):** Never surface internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) or raw Sanskrit chart jargon (`Mahadasha`, `Navamsha`, `Darakaraka`, `SAV`, `Shadashtaka`) on `ReadFace`, `ShortFace`, headlines, subtitles, or Oracle Questions. Technical evidence keys (e.g., `D1.h5`, `D9.p.Ve`, `D7.h5`, `tp:2026.yearLord`) live solely inside structured `evidence` arrays for the **Chart details** modal.
- **Engine Gaps Noted (`doc 80`):** Until `SERVED_VARGAS` in `src/reading/chartData/catalog.ts` enables `D30` and `annual.tithi_pravesha` divisional pulls and the TP `yearLord` export (`annual_export.py` + `digest/build.ts`) is patched, `D1 + D9 + D7` operate natively while unresolved TP `yearLord` values fail closed to `stance = 'get_through'`.

### 2.2 Age-36 Navamsha (`D9`) Maturity Gate & Mutual Confirmation
Every card in Dashboard 01 checks native age dynamically via `ageYears > getD9MaturityAgeYears()` (`src/config/env.ts`, `D9_MATURITY_AGE_YEARS`, default `36`):
- **Pre-36 (`isMature = false`):** `D1` (`5th`/`11th`/`12th`/`Venus`/`Mars`) drives primary courtship temperament and immediate attraction windows, while `D9` and `D7` act as background compatibility lenses.
- **Post-36 (`isMature = true`):** Mandatory mutual confirmation (`evaluateD1D9MutualConfirmation`) across `D1` and `D9` for active dasha lords, `Venus`, `Mars`, `5th lord`, and `yearLord`:
  - `confirmed_strong` (+1.5 Exalted/Own Vargottama; +1.0 Neutral Vargottama): Durable romantic magnetism backed by inner emotional maturity.
  - `confirmed_weak` (-1.5 *Neecha Vargottama* / *Drudha Karma*; -1.3..-1.5 non-Vargottama weak): Fixed karmic resistance in romance; superficial charm fails without disciplined boundaries.
  - `d9_redeemed` (+1.2 *Neecha Bhanga via D9*): Early romantic disappointment or self-doubt transforms after 36 into discerning, steady love.
  - `d9_weakened` (-1.0 *False Promise*): Effortless early-life flirting or glamour (`D1` strong) hollows out post-36 (`D9` weak) unless grounded in real character alignment.

### 2.3 Multi-Clock Dasha, Tithi Pravesha & Toolbar Vetting Rules
- **Multi-Clock Concordance:** Cards call `resolveActiveMahadasha` across conditional nakshatra dashas (Rank 1 when certified in `dasha.applicable`), Vimshottari (MD/AD/PD + 9x9 `AntardashaFruitionCell`), Rasi dashas (Narayana/Chara), and Yogini.
- **Bounded Tithi Pravesha (`TITHI_PRAVESHA_YEAR_RULE`):** All 12-month dating timelines use `runningTithiPravesha` (`tp_start` to `tp_end`, <= 400 days) and `Tithi Ashtottari` sub-periods. Gregorian `01-01`..`12-31` fallbacks are forbidden.
- **SOUL.md Rule 0 & 4-Tier Playbook:** When a user references a specific romantic interest or "recurring type," verify multiplicity across `5th`, `7th`, `8th`, `11th`, `A5`, and `DK` rather than parroting user assumptions, and pair every structural romantic handicap with the 4-Tier Behavioral Playbook (`Sattvic`, `Rajasic`, `Mediocre`, `Baseline`).
- **Card UI & 5-Gate Toolbar Vetting (`.agents/skills/dashboard-card-toolbar-vetting/SKILL.md`):** `Chart details` remains unconditionally visible; optional tools (`table`, `calendar`, `dates`, `timeframe`, `plan`, `info`) appear only when all 5 gates pass (non-empty `own` prose, future milestones for `Dates`, >= 2 shades & transitions for `Calendar`, duration-honest `Timeframe` buckets, empty-ref scrubbing via `scrubEmptyRefs`).

---

## 3. Card Specifications (Cards 1–10)

---

### Card 1: Where Dating Stands (12-Month Pulse)
- **Card Number:** `1`
- **Card Name:** `Where Dating Stands (12-Month Pulse)`
- **Card Slug:** `dating.pulse`
- **Subtitle:** `Warm romantic stretches, quiet pauses, and your overall dating pace this year`
- **Default Placement:** Pinned starter card (`suggested: true`); visible for `love.status` in `['single', 'dating', 'casual', 'complicated']`.

#### Area of Focus
The 12-month emotional weather, attraction momentum, and dating energy across the native's upcoming lunar-solar return year, distinguishing receptive high-spark stretches from quieter self-restoration windows.

#### Oracle Question
*"Across your upcoming 12-month cycle, which dated stretches bring natural romantic warmth and social ease, and which stretches call for quieter focus and patience?"*
- **Window Grounding:** Cuts the active Tithi Pravesha year (`tp_start` -> `tp_end`, max 6 periods in `PeriodStrip`) into plain-English stretches (`Warm stretch`, `Mixed stretch`, `Quiet stretch`) with zero astrological jargon or engine names.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts tone by `age_band` (e.g., 20s exploration vs. 30s/40s intentional dating), `dating_goal` (`casual` vs `long_term`), and `declined_topics`.
- **Stance Resolution:** Sets `stance = 'build'` when TP `yearLord` is dignified, `5th`/`11th` lords hold benefic sub-periods, and clocks are non-contested; fails closed to `stance = 'get_through'` if `yearLord` is unresolved/afflicted or `6/8`/`2/12` AD friction dominates.
- **4-Tier Behavioral Guidance:** *Sattvic:* Treat quiet months as intentional emotional grounding rather than loneliness; *Rajasic:* Concentrate social outings and dating apps into peak warmth windows; *Mediocre:* Swipe passively during low-energy months and feel rejected; *Baseline:* Force dates during heavy emotional stretches and burn out.
- **Single Past-Event Calibration Question:** *"Looking back at the stretch between [prior_window_start] and [prior_window_end], did your dating life feel noticeably quieter or more inward than usual?"*

#### Full-Circle Coverage
Establishes the macro 12-month baseline (Entry) -> aligns expectations with real dated stretches so users stop blaming themselves during fallow months (Diagnosis) -> routes active sparks to Card `#2` (Meeting) or Card `#5` (Mixed Signals), and routes heavy stretches to Card `#3` (Delays) (Action & Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `StarProfile.moonStar` and the running Mahadasha/Antardasha lord's nakshatra and pada; checks Navatara classification (`Sampat` 2, `Kshema` 4, `Sadhaka` 6, `Mitra` 8, `Param Mitra` 9 yield `Tara Bala = 1` social ease vs. `Vipat` 3, `Pratyak` 5, `Vadha` 7 `Tara Bala = 0` dating fatigue). Tracks Venus's natal nakshatra lord (*Surya/Moon/Mars/etc.*) as the subtle romantic trigger star.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `5th house` (courtship/joy), `11th house` (social fulfillment), and `12th house` (private intimacy), their lords, `A5` (*Mantra Pada*), `Venus`, `Mars`, and `Moon`. Checks *Kalatra/Kama* yogas (`5th–11th` or `5th–9th` lord sambandha, `Venus–Moon` mutual aspect) vs. *Kemadruma* or *Papakartari* hemming on `5th`/Venus.
- **Divisional Charts (`D1`, `D9`, `D7`):** Compares `D1` 5th/Venus momentum against `D7` Lagna and 5th (erotic/romantic spark) and `D9` 5th/7th (capacity to hold attraction). Above `getD9MaturityAgeYears()` (`> 36`), enforces `evaluateD1D9MutualConfirmation` on `Venus`, `5th lord`, and active MD/AD lords so `d9_weakened` prevents over-promising fleeting `D1` sparks.
- **Dasha Systems:** Calls `resolveActiveMahadasha` (Rank 1 conditional nakshatra dasha if applicable -> Vimshottari MD/AD/PD -> Narayana/Chara -> Yogini). Evaluates the **9×9 Fruition Matrix** (`AntardashaFruitionCell`) from MD to AD (`1/5/9` Trikona or `4/7/10` Kendra = open dating windows; `6/8` Shadashtaka or `2/12` Dwirdwadasha = careful pacing) and inspects `PlanetCard.avasthaMultipliers` (`Baladi × Jagradadi`).
- **Transits (Gochara):** Tracks `Venus` and `Mars` transiting Kendras/Trikonas to natal Lagna/Moon/5th, `Jupiter` aspecting `5th`/`11th`/`Venus`, `Saturn` pressure on `5th`/`Moon` (Sade Sati / Kantaka Shani), and `HouseCard.sav` on `5th`/`11th` (>= 30 resilient; < 25 sensitive).
- **Tithi Pravesha (TP):** Anchored strictly in `runningTithiPravesha` (`tp_start`..`tp_end`, <= 400 days). Reads `AnnualRow.yearLord`, TP `Lagna`, TP `5th`/`11th` houses (`tpRowIn` for `D1`, `D9`, `D7`), `Muntha` in `5th`/`11th`/`7th`, *Smarana/Punya Saham*, and `Tithi Ashtottari` sub-periods to cut the year into 3–6 dated spans.

#### Google Search Trends Synthesis
Synthesizes high-volume consumer queries such as *"dating horoscope this year"*, *"will I find love in 2026/2027"*, and *"best months for dating"* by replacing vague sun-sign generalizations with concrete, multi-month personal cycles grounded in active dasha sub-periods and lunar-solar return windows.

#### Classical Attribution
- *Brihat Parashara Hora Shastra (BPHS)* Ch. 16 (5th Bhava Phala), Ch. 22 (11th Bhava), Ch. 46–51 (Vimshottari & Conditional Dashas)
- *Phaladeepika* Ch. 16 & Ch. 26 (Gochara of Venus, Jupiter, Saturn)
- *Tithi Pravesha: Vedic Annual Horoscopy* (Pt. Sanjay Rath) — `yearLord`, `Muntha`, and `Tithi Ashtottari` annual timing
- *Muhurta Chintamani* — Navatara & Tara Bala lunar day quality

---

### Card 2: When You Meet Someone
- **Card Number:** `2`
- **Card Name:** `When You Meet Someone`
- **Card Slug:** `dating.meeting_timing`
- **Subtitle:** `Dated windows for new introductions and the settings where connection sparks`
- **Default Placement:** Pinned starter card (`suggested: true`); hidden if `love.status === 'married'` or `'committed_exclusive'`.

#### Area of Focus
Specific dated opening windows for new romantic introductions and the real-world environments (shared learning, travel, friends-of-friends, creative spaces) where a meaningful connection is most likely to cross the native's path.

#### Oracle Question
*"During which specific upcoming date ranges is a genuine new romantic introduction most strongly supported, and what kind of setting naturally brings that connection forward?"*
- **Window Grounding:** Surfaces exact PD/transit trigger windows inside the current TP year and contrasts them with quiet gestation stretches so the user avoids forcing introductions prematurely.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailors setting suggestions to `age_band`, `lifestyle`/`work_mode`, and `location_context` (relocated vs. hometown).
- **Stance Resolution:** `build` during active `5th`/`7th`/`11th`/`UL` PD + Jupiter/Venus transit convergence; `get_through` (preparation & social widening) during dormant or `Vipat`/`Vadha` windows.
- **4-Tier Behavioral Guidance:** *Sattvic:* Show up in authentic interest-based communities during peak windows; *Rajasic:* Strategically attend weddings, conferences, or social mixers during open dates; *Mediocre:* Isolate at home waiting for fate to knock; *Baseline:* Chase low-alignment validation during barren transits.
- **Single Past-Event Calibration Question:** *"Did a notable social introduction, spark, or unexpected flirtation happen around [past_trigger_start] to [past_trigger_end]?"*

#### Full-Circle Coverage
Detects multi-clock meeting convergence (Trigger) -> maps the house/signification of *how* you meet (Context) -> gives concrete dated outreach windows (Action) -> hands off to Card `#4` (Attraction) or Card `#5` (Mixed Signals) once someone appears (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates nakshatras of `5th lord`, `7th lord`, `Venus`, and `A5` lord. When `Pratyantardasha` or transiting `Jupiter`/`Venus` activates a `Sampat`, `Sadhaka`, `Mitra`, or `Param Mitra` tara from Janma Nakshatra—or passes over the nakshatra dispositor of `DK`—introductions accelerate.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Checks `5th` (romance), `7th` (pairing), `11th` (social networks/friends-of-friends), `3rd` (neighborhood/short trips/apps), and `9th` (travel/higher learning) to identify the meeting venue. Inspects `A5` and `UL` lords, `DK`, and `Venus`/`Jupiter` (for female/male or universal attraction cues).
- **Divisional Charts (`D1`, `D9`, `D7`):** Requires confluence between `D1` (`5th`/`7th`/`11th`) and `D7` (`1st`/`5th`/`7th` for spark) plus `D9` (`7th`/`UL` for staying power). Post-36 (`ageYears > getD9MaturityAgeYears()`), prioritizes `D9` `7th`/`5th` lords over fleeting `D1` `5th` sparks via `evaluateD1D9MutualConfirmation`.
- **Dasha Systems:** Requires at least 2–3 clocks in Five-Clocks Concordance (`Vimshottari` MD/AD/PD of `5th`/`7th`/`11th`/`Venus`/`DK` + `Narayana/Chara` rasi dasha hitting signs containing `A5`/`UL`/`DK` + `Yogini` *Siddha*/*Mangala*/*Dhanya*). Evaluates `AntardashaFruitionCell` for direct MD-to-AD star-lord/dispositor executive delivery.
- **Transits (Gochara):** Checks `Jupiter` and `Venus` transits over or aspecting (5/7/9) natal `5th`, `7th`, `11th`, `Lagna`, `Venus`, or `DK`; checks `Rahu` transiting `5th`/`7th`/`11th` (sudden/unconventional introductions); verifies `Bhrigu Bindu` (`D1.BB`) benefic activation and `SAV >= 28` in the triggered house.
- **Tithi Pravesha (TP):** Checks `TP` `5th`/`7th`/`11th` lords, `yearLord` connection to `Venus`/`5th`, *Vivaha/Smarana Saham*, and `Tithi Ashtottari` periods where the TP `5th` or `7th` lord runs inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses evergreen high-intent queries (*"when will I meet the one astrology"*, *"next relationship timing"*, *"how will I meet my future partner"*) by explaining *why* certain months cluster real-world introductions and *which* environments match the native's chart without making deterministic soulmate promises.

#### Classical Attribution
- *BPHS* Ch. 16 & Ch. 18 (5th & 7th House introductions and fructification)
- *Jaimini Upadesha Sutras* Ch. 1.2–1.4 (`A5`, `UL`, `DK`, Rasi Drishti)
- *K.N. Rao — Timing Events Through Vimshottari Dasha & Double Transit*
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (venues and meeting significations of houses 3, 5, 7, 9, 11)

---

### Card 3: Why It's Taking Time
- **Card Number:** `3`
- **Card Name:** `Why It's Taking Time`
- **Card Slug:** `dating.delays_blocks`
- **Subtitle:** `What has been slowing romance down, and the exact dates pressure begins lifting`
- **Default Placement:** Pinned starter card (`suggested: true`); tailored for users experiencing prolonged single stretches or stalled dating momentum.

#### Area of Focus
Diagnosing the exact structural, karmic, or timing factors slowing romantic fruition—distinguishing temporary transit drag from deeper Saturn/Ketu maturation requirements—and naming the concrete dates when that pressure begins to lift.

#### Oracle Question
*"What underlying friction or life-timing cycle has been slowing your romantic momentum, and on what specific dates does that weight begin to lift?"*
- **Window Grounding:** Explicitly contrasts the start date and end date of the blocking cycle (`Heavy stretch · <from> – <to>`) with the easing window that follows.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Sensitive to `age_band` (acknowledging Saturn maturation around 28–30 and 36+), `dating_fatigue` signals, and `work_load` (e.g., `6th`/`10th` work absorption crowding out `5th`/`7th`).
- **Stance Resolution:** Defaults to `get_through` during active Saturn/Ketu/6-8/12 constriction on `5th`/`Venus`/`Moon`; shifts to `build` at the exact transition date where Jupiter or a benefic AD breaks the block.
- **4-Tier Behavioral Guidance:** *Sattvic:* Use slow seasons to clear *Pending Karma* and refine non-negotiable standards; *Rajasic:* Deliberately restructure schedule/geography so work does not starve social life; *Mediocre:* Internalize delays as personal unlovability; *Baseline:* Settle out of impatience during a Saturn test only to incur longer karmic entanglement.
- **Single Past-Event Calibration Question:** *"Since around [block_start_date], has dating felt unusually heavy, scarce, or overshadowed by work and family responsibilities?"*

#### Full-Circle Coverage
Identifies the exact bottleneck (Diagnosis) -> separates temporary transit drag from deep natal maturation (Reframing) -> names the exact easing date (Timeline) -> gives the 4-tier growth posture while waiting (Action) and hands off to Card `#2` or `#9` (Next Step).

#### Astrological Mechanics
- **Nakshatras:** Inspects `StarProfile.pendingKarmaHouses` (houses held/aspected by Saturn, planets in Saturn stars `Pushya`, `Anuradha`, `Uttara Bhadrapada`, or retrograde planets). Checks if active dasha lord sits in `Vipat`, `Pratyak`, or `Vadha` tara, or in `Gandanta` degrees (`Ashlesha–Magha`, `Jyeshtha–Moola`, `Revati–Ashwini`).
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Checks `Saturn` aspecting (`3rd`/`7th`/`10th`) or occupying `5th`, `7th`, `Venus`, or `Moon`; `Ketu` in `5th`/`7th`/`11th`; `5th` or `7th` lord placed in `Dusthanas` (`6th`, `8th`, `12th`); *Papakartari Yoga* hemming `5th` or `Venus`; `Venus` combust (`sunProximity`: `deep_combustion_sikhin` or `standard_combustion`) or `Mrita` (`0.10x` delivery multiplier).
- **Divisional Charts (`D1`, `D9`, `D7`):** Checks `D9` `7th`/`5th` and `Venus` under `evaluateD1D9MutualConfirmation`. Identifies *Drudha Karma* (`confirmed_weak` / `Neecha Vargottama`, `-1.5`) vs. *Delayed Mastery* (`d9_redeemed`, `+1.2` post-36) vs. *Karmic Restraint* in `D7` (`Saturn`/`Ketu` on `D7` Lagna or 5th).
- **Dasha Systems:** Identifies when a non-romantic Mahadasha (`6th`/`8th`/`12th` lord or `Saturn`/`Ketu`) is currently absorbing life bandwidth, or when `AntardashaFruitionCell` shows `isShadAshtaka68` (`6/8`) or `isDwirdwadasha212` (`2/12`) between MD and AD, pinpointing the exact PD/AD end date when the block releases.
- **Transits (Gochara):** Tracks `Saturn` transit over `Moon` (*Sade Sati*), `4th`/`8th`/`10th` (*Kantaka*/*Ashtama Shani*), or natal `5th`/`7th`/`Venus`; `Ketu` transiting `1st`/`5th`/`7th`; `Retrograde Venus/Jupiter` delays; low `SAV` (`< 25`) in `5th`/`7th` amplifying transit resistance.
- **Tithi Pravesha (TP):** Inspects whether `TP` `yearLord` is weak/combust/in `6th`/`8th`/`12th`, whether `Muntha` sits in `6th`/`8th`/`12th`, or whether `TP` Lagna/7th faces `Saturn`/`Mars` affliction, pinpointing the next TP return or `Tithi Ashtottari` shift when relief arrives.

#### Google Search Trends Synthesis
Addresses emotionally charged search queries (*"why am I still single astrology"*, *"delayed love life birth chart"*, *"why is dating so hard for me"*) by replacing fatalistic doom with transparent, compassionate explanations of *Saturnian pacing* and exact calendar relief horizons.

#### Classical Attribution
- *BPHS* Ch. 16, 18, 45 (*Graha Pakvata* — Venus age 25, Saturn age 36 maturation)
- *Phaladeepika* Ch. 20 (Dasha obstructions & Avastha weakness) & Ch. 26 (*Sade Sati* / Saturn transits)
- *Lunar Astro / Deepanshu Giri* — *Pending Karma* (`Saturn` house/aspect/star/retrograde) & `Mrita` Avastha externalization
- *SOUL.md* §3 — Mandatory 4-Tier Behavioral Playbook for structural handicaps

---

### Card 4: The Partner You Draw (Attraction Pattern)
- **Card Number:** `4`
- **Card Name:** `The Partner You Draw`
- **Card Slug:** `dating.attraction_pattern`
- **Subtitle:** `The chemistry you instinctively magnetize versus the partner who steadies you`
- **Default Placement:** Pinned starter card (`suggested: true`); essential baseline for anyone actively dating.

#### Area of Focus
Illuminating the contrast between who the native instinctively magnetizes (*unconscious chemistry*) and the partner profile that actually steadies, complements, and sustains them long-term.

#### Oracle Question
*"What kind of partner qualities do you instinctively magnetize, and how does that compare with the temperament that genuinely steadies and fulfills you over time?"*
- **Window Grounding:** Anchors attraction shifts to the active MD/AD lord coloring current partner choices (`"Right now, your current chapter pulls you toward..."`) alongside lifelong baseline patterns.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Honors `gender`/`partner_preference` without heteronormative assumptions (`Venus`/`Mars`/`Jupiter` mapped cleanly to attraction/drive/partnership roles), and calibrates maturity by `age_band` (pre-36 vs. post-36 shift).
- **Stance Resolution:** `build` when cultivating discernment toward `D9`/`DK`-aligned partners; `get_through` when an active `Rahu`/`6-8` sub-period heightens attraction to destabilizing archetypes.
- **4-Tier Behavioral Guidance:** *Sattvic:* Choose character alignment (`D9`/`Jupiter` warmth) over adrenaline spikes; *Rajasic:* Vet partner ambition, reliability, and shared lifestyle early; *Mediocre:* Mistake emotional unavailability for mystery; *Baseline:* Repeatedly rescue or chase chaotic partners (`Rahu`/`6th` trap).
- **Single Past-Event Calibration Question:** *"Thinking of the people you have felt drawn to over the past few years, have they often shared a strong streak of [archetype_trait_e.g_intensity_or_independence]?"*

#### Full-Circle Coverage
Reveals the subconscious magnet (`A5`/`5th`/`Venus–Mars`) -> contrasts it with true partner fit (`DK`/`7th`/`D9`) -> disambiguates multiple recurring partner types (`SOUL.md` Rule 0) -> equips the user with concrete screening criteria (Action).

#### Astrological Mechanics
- **Nakshatras:** Analyzes the nakshatra and pada of `DK` (*Darakaraka*), `Venus`, `Mars`, and `5th`/`7th` lords. Nakshatra *Gana* (*Deva*, *Manushya*, *Rakshasa*) and *Yoni* temperament explain instinctual attraction dynamics vs. friction; `Navatara` links between the native's `Moon` and `DK`'s star reveal natural ease vs. friction.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Contrasts `A5` (who you flirt with/attract) and `5th house` (romantic taste) against `DK` (soul-level partner mirror), `7th lord` (actual partner), and `UL` (commitment container). Checks `Venus–Mars` conjunction/aspect/exchange, `7th from Venus` (*Chandra/Shukra Lagna* partner lens), and `Rahu`/`Ketu` modifying `5th` or `DK`.
- **Divisional Charts (`D1`, `D9`, `D7`):** Compares `D1` `Venus/Mars/5th` (initial magnetism) with `D7` `7th` (sexual/creative chemistry) and `D9` `Lagna`, `7th`, and `DK` (enduring spouse archetype). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `D9` `DK` and `D9` `7th` supersede `D1` `5th` taste—explaining why attraction preferences evolve dramatically in the late 30s.
- **Dasha Systems:** Evaluates which planet rules the current Mahadasha/Antardasha via `resolveActiveMahadasha`: the active MD/AD lord temporarily tints *who* the native attracts during that chapter (e.g., a `Rahu` AD draws unconventional/foreign partners; a `Saturn` AD draws older, grounded, or guarded partners).
- **Transits (Gochara):** Tracks `Venus`, `Mars`, and `Rahu–Ketu` transiting `1st`/`5th`/`7th` or natal `Venus`/`DK`, showing temporary spikes in attraction toward specific archetypes.
- **Tithi Pravesha (TP):** Checks `TP` `Lagna`, `5th`, and `7th` lords and `yearLord` dignity to show what relational qualities the native prioritizes during the current annual return.

#### Google Search Trends Synthesis
Addresses popular search queries (*"who am I attracted to astrology"*, *"what kind of partner do I attract"*, *"Darakaraka partner traits"*, *"type of person I will marry chart"*) by moving beyond parlor-trick physical stereotypes into psychological attraction mechanics and compatibility discernment.

#### Classical Attribution
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`Darakaraka`, `A5`, `UL`, `7th` from `AL`/`Venus`)
- *BPHS* Ch. 18 & Ch. 32 (Chara Karakas & `7th` house partner nature)
- *Saravali* Ch. 13–20 (`Venus–Mars` and multi-planet relational combinations)
- *SOUL.md* §2 (Rule 0 — Multi-Entity Disambiguation across partner circuits)

---

### Card 5: How They Feel & Mixed Signals
- **Card Number:** `5`
- **Card Name:** `How They Feel & Mixed Signals`
- **Card Slug:** `dating.mixed_signals`
- **Subtitle:** `Separating temporary hesitation and communication fog from mismatched intent`
- **Default Placement:** Picker-available (`suggested: false`, promoted to pinned when `person_facts` indicates `dating_ambiguous`).

#### Area of Focus
Deciphering hot-and-cold behavior, communication fog, emotional hesitation, and inconsistent effort in an active dating connection—without claiming supernatural mind-reading.

#### Oracle Question
*"Are the mixed signals around this connection reflecting temporary hesitation and timing fog, or a genuine mismatch in readiness and intent?"*
- **Window Grounding:** Dates the exact clarity window (`Mercury`/`Venus` direct motion, `Rahu`/`12th` fog lifting, or PD transition) when ambiguity resolves into a clear answer.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Triggered for users actively seeing someone (`dating`, `talking_stage`, `complicated`). Respects `SOUL.md` Rule 0 by questioning romanticized excuses.
- **Stance Resolution:** `get_through` (observe actions over words, protect emotional boundaries) while `Mercury`/`Venus` retrograde, `12th` sub-periods, or `Rahu–Moon` fog are active; `build` (ask directly for clarity) once `Mercury`/`Jupiter` clarity window opens.
- **4-Tier Behavioral Guidance:** *Sattvic:* Communicate a calm, direct boundary and let consistent behavior answer; *Rajasic:* Set a personal time limit on ambiguity and keep social options open; *Mediocre:* Over-analyze texts and rationalize inconsistency; *Baseline:* Chase harder when pulled away from, reinforcing intermittent reinforcement.
- **Single Past-Event Calibration Question:** *"Did communication or emotional consistency noticeably wobble around [ambiguity_start_date]?"*

#### Full-Circle Coverage
Audits clarity vs. projection in the native's current timeline (Diagnosis) -> separates communication static from genuine unavailability (Disambiguation) -> names the date window to ask for clarity or step back (Action) -> routes to Card `#10` (Commitment) or Card `#6` (Closure) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Inspects `Moon` and `Mercury` nakshatras and whether active dasha/transit planets hit `Vipat` (3), `Pratyak` (5), or `Vadha` (7) taras, or deceptive/illusory padas (`Ashlesha`, `Ardra`, `Swati`, `Shatabhisha`, `Jyeshtha`). Evaluates *Tara Bala* on communication dates.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Checks `Mercury` (speech/signals) and `Moon` (emotional steadiness) dignity, `12th house` (hidden agendas, unspoken retreats), `3rd house` (messaging/effort), `5th`/`7th` lords in `6th`/`8th`/`12th`, `Rahu` aspecting `Moon`/`Mercury`/`5th`, and `A5` vs. `AL` perception gaps.
- **Divisional Charts (`D1`, `D9`, `D7`):** Compares `D1` `5th` surface charm against `D9` `2nd`/`7th` emotional integrity and `D7` `5th` warmth. Post-36 (`ageYears > getD9MaturityAgeYears()`), checks if `Venus` or `Mercury` suffers `d9_weakened` (*False Promise*: sweet initial words, hollow follow-through).
- **Dasha Systems:** Examines active `Pratyantardasha` and `Sookshma` levels (`L3–L4`) for `12th`/`8th`/`6th` lord activation, `Rahu`/`Ketu` sub-periods, and `AntardashaFruitionCell` (`isShadAshtaka68` or `isDwirdwadasha212`), showing when the foggy sub-period ends.
- **Transits (Gochara):** Tracks `Retrograde Mercury` (*Vakra*) and `Retrograde Venus` across `1st`/`5th`/`7th`/`11th`, `Rahu` transiting over natal `Moon` or `5th`, and `Moon` *Chandra Bala* dips through `6th`/`8th`/`12th` houses.
- **Tithi Pravesha (TP):** Evaluates `TP` `3rd`/`5th`/`12th` houses, `Hora Lord` (if `Mercury` or `Moon` is afflicted in the return), and `Tithi Ashtottari` sub-periods marking moments when hidden intentions surface.

#### Google Search Trends Synthesis
Directly addresses the #1 cluster of modern dating queries (*"does he have feelings for me"*, *"mixed signals astrology"*, *"is he leading me on"*, *"hot and cold behavior zodiac"*) with ethical, anti-sycophancy clarity—empowering users to read patterns and set boundaries rather than feeding false hope.

#### Classical Attribution
- *Prasna Marga* Ch. 1–16 (diagnosing hidden intent, deception, and clear vs. obscured speech)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` speech, `12th` hidden matters, retrogradation reversals)
- *BPHS* Ch. 14–16 (`3rd` communication, `5th` affection)
- *SOUL.md* §2 (Rule 0 — Anti-Sycophancy verification against chart geometry)

---

### Card 6: Exes, No-Contact & Reopening Doors
- **Card Number:** `6`
- **Card Name:** `Exes, No-Contact & Reopening Doors`
- **Card Slug:** `dating.exes_closure`
- **Subtitle:** `Whether a returning past tie brings genuine renewal or final emotional closure`
- **Default Placement:** Picker-available (`suggested: false`, auto-surfaced if `person_facts` indicates `recent_breakup` or `ex_recontact`).

#### Area of Focus
Evaluating past-partner re-emergence, no-contact cycles, nostalgia waves, and distinguishing authentic second-chance potential from unfinished karmic closure.

#### Oracle Question
*"When a past connection resurfaces or weighs on your mind during this window, is your chart supporting a genuine second chapter or final emotional closure?"*
- **Window Grounding:** Pinpoints the exact retrograde/nodal return or `8th`/`12th` sub-period window triggering past memories and the date when emotional detachment solidifies.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Sensitive to `recent_breakup`, `on_off_history`, and `declined_topics` (never pushes reconciliation if user marked closure/safety boundaries).
- **Stance Resolution:** `get_through` during `Ketu`, `Venus Rx`, or `8th`/`12th` nostalgia spikes (advising no impulsive re-entry); `build` (toward either clean closure or structured dialogue) only when `D9` + `Jupiter` + `7th` confirm real transformation.
- **4-Tier Behavioral Guidance:** *Sattvic:* Honor the lesson, forgive cleanly, and keep doors closed unless fundamental patterns changed; *Rajasic:* Require explicit accountability and behavioral proof before any re-engagement; *Mediocre:* Break no-contact out of boredom during a nostalgic transit; *Baseline:* Repeat an exhausting on-off cycle that drains years of momentum.
- **Single Past-Event Calibration Question:** *"Did an old relationship thread, memory, or sudden message from the past resurface around [past_retrograde_or_ketu_window]?"*

#### Full-Circle Coverage
Detects past-karma trigger (`Vakra`/Ketu/`8th`) -> tests whether `D9` & `UL` support genuine renewal vs. pure closure (Verdict) -> sets a dated no-contact or verification boundary (Action) -> transitions user to Card `#9` (Breaking Loop) or Card `#2` (New Meeting) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Checks `Ketu`'s nakshatra and `8th`/`12th` lord nakshatras; evaluates if transiting `Venus`, `Mercury`, or `Ketu` revisits the natal Moon/Venus star or triggers `K64M` (64th Navamsha from Moon) / `D1.BB` (Bhrigu Bindu).
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `8th house` (past karma, rupture, emotional underworld), `12th house` (letting go, loss, closure), `5th` and `7th` lords in retrograde (`Vakra`) motion, `Ketu` conjoining/aspecting `Venus` or `5th`/`7th`, and `UL` vs. `2nd from UL` (whether the container already fractured).
- **Divisional Charts (`D1`, `D9`, `D7`):** Compares `D1` `5th`/`8th` longing with `D9` `7th`/`9th` long-term viability. Above age 36 (`ageYears > getD9MaturityAgeYears()`), if `Venus` or `7th lord` is `confirmed_weak` or `d9_weakened` with the ex-dynamic's signifiers, revisiting repeats structural failure; `d9_redeemed` allows rare matured reconciliation only after real passage of time.
- **Dasha Systems:** Tracks `Ketu` or `Rahu` AD/PD, `8th` or `12th` lord sub-periods, and `AntardashaFruitionCell` transitions (`6/8` Shadashtaka ending into `1/5/9` Trikona) where unfinished psychological loops demand resolution before a new chapter starts.
- **Transits (Gochara):** Tracks **Venus Retrograde** (*Shukra Vakra*) and **Mercury Retrograde** over natal `1st`/`5th`/`7th`/`8th`/`12th`; `Ketu` transiting over `Venus`, `Moon`, or `5th`/`7th`; `Saturn` retrograde stations re-testing an old relationship degree.
- **Tithi Pravesha (TP):** Checks `TP` `8th`/`12th` houses, `Muntha` in `8th`/`12th`, and `Tithi Ashtottari` sub-periods ruled by `Ketu` or `8th lord` to mark exact dates when nostalgia fades.

#### Google Search Trends Synthesis
Addresses one of the highest-volume search spikes in relationship astrology (*"will my ex contact me"*, *"no contact rule Venus retrograde"*, *"getting back with ex astrology"*) by replacing false-hope clickbait with grounded discernment between retrograde nostalgia and true relational repair.

#### Classical Attribution
- *BPHS* Ch. 19 & Ch. 23 (`8th` transformation/secrets, `12th` dissolution/release)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (retrograde *Vakra* repetition and delayed returns)
- *Phaladeepika* Ch. 26 (*Ketu* and *Saturn* transit detachment)
- *Lunar Astro* — `D1.K64M`, `D1.BB`, and retrograde pending-karma loops

---

### Card 7: Karmic Pull vs. Real Compatibility
- **Card Number:** `7`
- **Card Name:** `Karmic Pull vs. Real Compatibility`
- **Card Slug:** `dating.karmic_compatibility`
- **Subtitle:** `Distinguishing high-drama magnetic pull from calm, lasting compatibility`
- **Default Placement:** Picker-available (`suggested: false`); critical diagnostic lens for intense, magnetic, or turbulent connections.

#### Area of Focus
Separating magnetic, obsessive, or high-drama chemistry (`Rahu`/`Ketu`/`8th` intensity) from steady, mutually nourishing compatibility (`Jupiter`/`D9`/`4th` peace).

#### Oracle Question
*"Is the powerful pull you feel in this connection built on steady mutual respect and peace, or on a high-intensity karmic lesson that destabilizes your calm?"*
- **Window Grounding:** Identifies the active sub-period driving the intensity and the date window when the adrenaline fog clears so true compatibility becomes visible.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to users reporting intense/turbulent bonds (`complicated`, `intense_chemistry`) and calibrated by `age_band` (pre-36 learning vs. post-36 `D9` peace priority).
- **Stance Resolution:** `get_through` (grounding, no irreversible legal/financial entanglement) whenever `Rahu`/`8th`/`D30` intensity dominates without `Jupiter`/`D9` confirmation; `build` only when `D9` + `Jupiter` + `4th` confirm emotional safety alongside spark.
- **4-Tier Behavioral Guidance:** *Sattvic:* Value steady peace and kindness over dramatic highs and lows; *Rajasic:* Test the connection under practical stress and shared commitments before investing deeper; *Mediocre:* Confuse anxiety and obsession with "soulmate destiny"; *Baseline:* Ignore red flags in the name of a "twin flame" bond.
- **Single Past-Event Calibration Question:** *"Have your strongest attractions around [intensity_window] felt thrilling at first yet unusually draining on your sleep or peace of mind?"*

#### Full-Circle Coverage
Measures chemistry source (`Rahu`/`8th` vs `Jupiter`/`Venus`) -> checks structural sustainability in `D9` & `D30` (Stress-Test) -> separates lesson from lifelong fit (Verdict) -> directs user to Card `#8` (Boundaries/Safety) or Card `#10` (Commitment) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Examines *Gandanta* placements, `Rahu`/`Ketu` stars (`Ardra`, `Swati`, `Shatabhisha`, `Ashwini`, `Magha`, `Moola`), and intense *Rakshasa*-gana / *Ashlesha*/*Jyeshtha*/*Moola* interactions vs. stabilizing *Rohini*/*Pushya*/*Anuradha*/*Revati* stars; checks if the active star places the native in `Vipat` or `Vadha` tara.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Contrasts `Rahu–Venus`, `Rahu–Mars`, `Venus–Saturn`, or `8th house` overlays (magnetic obsession, taboo/rapid attachment) against `Jupiter` aspecting `5th`/`7th`/`Venus`/`Moon` (dharmic protection) and `4th house` (*Sukha* / inner peace). Checks `A5` vs. `A8` (*Mrityu Pada*).
- **Divisional Charts (`D1`, `D9`, `D7`, `D30`):** Classic diagnostic split: vibrant `D1` `5th` + `D7` erotic chemistry paired with afflicted `D9` `7th`/`4th` or `D30` `5th`/`7th` reveals unsustainable turmoil. Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` penalizes `d9_weakened` (*False Promise*) connections that dazzle initially in `D1` but collapse under `D9` reality.
- **Dasha Systems:** Checks if `Rahu`, `Ketu`, `8th lord`, or `Shadashtaka` (`6/8`) `AntardashaFruitionCell` is running—often catalyzing short-term obsessive connections that naturally dissolve when the sub-period closes.
- **Transits (Gochara):** Tracks `Rahu–Ketu` nodal axis transiting natal `1st`/`5th`/`7th`/`Venus`/`Moon` (18-month karmic whirlwind), `Rahu` crossing `D1.BB` (Bhrigu Bindu), and whether `Jupiter` provides concurrent benefic aspect or is absent (unbuffered nodal pull).
- **Tithi Pravesha (TP):** Checks `TP` `5th`/`8th` houses, `Rahu`/`Ketu` prominence in the TP return, and *Kali Saham* vs. *Punya Saham* balance.

#### Google Search Trends Synthesis
Synthesizes viral search clusters (*"twin flame vs soulmate astrology"*, *"karmic relationship signs in birth chart"*, *"why is this connection so intense"*) while demystifying toxic "twin flame" hype using classical Jyotish distinctions between `Rahu`/`8th` turbulence and `Jupiter`/`D9` dharmic grace.

#### Classical Attribution
- *BPHS* Ch. 16 & Ch. 19 (`5th` romance vs. `8th` turmoil/obsession), Ch. 30 (*Trimshamsha D30* arishta)
- *Phaladeepika* Ch. 14–16 (`Rahu`/`Ketu` shadow effects on `Venus`/`Moon`)
- *Prasna Marga* Ch. 15–16 (discerning auspicious vs. obsessive/afflicted unions)
- *SOUL.md* §2 & §3 (Anti-Sycophancy verification + 4-tier non-fatalistic elevation)

---

### Card 8: Intimacy & Emotional Safety
- **Card Number:** `8`
- **Card Name:** `Intimacy & Emotional Safety`
- **Card Slug:** `dating.intimacy_safety`
- **Subtitle:** `Pacing emotional vulnerability, physical closeness, and trust boundaries safely`
- **Default Placement:** Picker-available (`suggested: false`); core emotional-depth card for guarded or hyper-open daters.

#### Area of Focus
Navigating emotional vulnerability, physical intimacy (*Shayana Sukha*), trust pacing, and nervous-system safety so the native opens up without self-abandonment or defensive walls.

#### Oracle Question
*"What emotional rhythms and personal boundaries help you feel genuinely safe opening up—both emotionally and physically—during this phase of your life?"*
- **Window Grounding:** Maps periods when emotional walls soften (`4th`/`12th`/`Moon`/`Venus` ease) versus stretches requiring slower physical and emotional pacing (`8th`/`Saturn`/`Ketu` strain).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Honors `declined_topics` strictly; adapts to `age_band` and `relationship_history` (e.g., recovering from betrayal vs. lifelong guardedness).
- **Stance Resolution:** `build` (gradual, mutual vulnerability) when `Moon`, `4th`, and `12th` are supported by `Jupiter`/`Venus`; `get_through` (protective pacing, clear consent/boundaries) during `Ketu–Moon`, `8th` AD, or `D30` strain.
- **4-Tier Behavioral Guidance:** *Sattvic:* Pace intimacy to match demonstrated emotional reliability; *Rajasic:* Express needs and physical/emotional boundaries clearly upfront; *Mediocre:* Swing between emotional aloofness and premature over-sharing; *Baseline:* Trade physical intimacy for validation when feeling insecure.
- **Single Past-Event Calibration Question:** *"Around [moon_or_12th_pressure_window], did you notice yourself pulling your guard up or feeling unexpectedly drained after opening up?"*

#### Full-Circle Coverage
Diagnoses vulnerability wiring (`4th`/`8th`/`12th` + `Moon`/`Venus`) -> names current comfort vs. guard cycles (Timing) -> prescribes healthy pacing & boundary habits (Action) -> prepares safe transition toward Card `#10` (Commitment) or Card `#13` (Warmth in Marriage) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Moon` and `Venus` nakshatras (especially sensitive watery stars *Rohini*, *Ashlesha*, *Anuradha*, *Jyeshtha*, *Revati*) and whether `Moon` sits in `Gandanta` or receives `Pushkara Navamsha` healing grace. Checks `Navatara` `Kshema` (4th — inner security) and `Janma` (1st — body/nervous system) cycles.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Reads `4th house` (emotional chest/*Hridaya*, inner comfort), `8th house` (deep trust, vulnerability, fear of betrayal), and `12th house` (*Shayana Sukha* — bedroom peace, surrender, sleep). Inspects `Moon` (`Manas`) and `Venus` (`Shukra`) *Shadbala*, `avasthaMultipliers` (`Lajjitadi`: `Lajjita`/`Bheeta`/`Mudita`, and `Shayanadi`), and *Kemadruma* or *Chandra–Saturn* (*Vish Yoga*) sensitivity.
- **Divisional Charts (`D1`, `D9`, `D7`, `D12`):** Evaluates `D1` `4th`/`12th` physical comfort alongside `D7` `1st`/`5th`/`12th` (sensual/creative receptivity) and `D9` `4th`/`12th` (inner emotional peace). Post-36 (`ageYears > getD9MaturityAgeYears()`), checks `Moon` and `Venus` across `D1 + D9` via `evaluateD1D9MutualConfirmation` (`d9_redeemed` heals early intimacy anxiety; `confirmed_weak` demands deliberate nervous-system pacing).
- **Dasha Systems:** Tracks `4th`/`8th`/`12th` lord dashas, `Moon`/`Venus` sub-periods, and `AntardashaFruitionCell` (`2/12` or `6/8` emotional mismatch vs. `1/5/9` emotional safety).
- **Transits (Gochara):** Tracks `Saturn` transiting `1st`/`4th`/`8th`/`12th` from Moon (emotional constriction/guarding), `Jupiter` aspecting `4th`/`12th`/`Moon` (safe opening), `Mars` transiting `12th` (impatience/boundary friction), and `SAV` bindus in `4th` and `12th` houses.
- **Tithi Pravesha (TP):** Evaluates `TP` `4th` and `12th` houses, `Moon` dignity in the TP return (since TP is anchored in the lunar-solar tithi!), and `yearLord` protection of the `4th`/`12th` axis.

#### Google Search Trends Synthesis
Addresses deeply personal search intents (*"fear of intimacy astrology"*, *"12th house bed pleasures & emotional safety"*, *"how to open up in love birth chart"*) with trauma-informed, non-judgmental guidance grounded in `4th`/`8th`/`12th` house mechanics rather than crude stereotypes.

#### Classical Attribution
- *BPHS* Ch. 15 (`4th` Sukha Bhava), Ch. 19 (`8th`), Ch. 23 (`12th` *Shayana Sukha*)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Moon` heart/emotions, `Venus` sensual harmony, `12th` bedroom ease)
- *Phaladeepika* Ch. 15 & Ch. 18 (emotional security & hidden fears)
- *SOUL.md* §3 (4-Tier Playbook for `Lajjitadi`/`Bheeta` emotional sensitivities)

---

### Card 9: Breaking Your Dating Loop
- **Card Number:** `9`
- **Card Name:** `Breaking Your Dating Loop`
- **Card Slug:** `dating.breaking_patterns`
- **Subtitle:** `Spotting your recurring dating script and the upcoming window to rewrite it`
- **Default Placement:** Picker-available (`suggested: false`); high-value transformation card for repeat dating frustration.

#### Area of Focus
Uncovering the recurring subconscious script—picking unavailable partners, self-sabotaging when things get real, moving too fast, or over-accommodating—and providing a concrete behavioral remedy for the active period.

#### Oracle Question
*"What recurring dating habit or blind spot has been repeating across your past chapters, and what specific shift breaks that loop during your current cycle?"*
- **Window Grounding:** Links the active loop to the current MD/AD/nodal cycle and highlights the upcoming turning-point window where new habits lock in (`"Your window to rewrite this script opens from <from> to <to>..."`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `pattern_history` (if shared) and `age_band` (breaking youth loops vs. post-36 Saturn maturation pivots).
- **Stance Resolution:** `build` when an upcoming `Trikona`/`Upachaya` sub-period or `Jupiter` transit supports conscious habit rewiring; `get_through` with strict guardrails when a `6th`/`8th`/`12th` or `Rahu` loop is peaking.
- **4-Tier Behavioral Guidance:** Explicitly delivers the full `SOUL.md` §3 ladder for the native's exact knot (e.g., *Sattvic:* Slow pacing + honest self-audit; *Rajasic:* Enforce non-negotiable 90-day vetting standards; *Mediocre:* Spot the red flag early but stay out of habit; *Baseline:* Repeat the exact self-undoing reflex).
- **Single Past-Event Calibration Question:** *"Looking back across [prior_cycle_dates], did a familiar relationship setback play out in almost the exact same way as an earlier chapter?"*

#### Full-Circle Coverage
Names the repeating script (Pattern Audit) -> connects it to active dasha/dispositor mechanics (Root Cause) -> delivers the 4-tier behavioral upgrade (Remedy) -> verifies progress via a past-loop calibration check and bridges to Card `#10` (Readiness for Commitment) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Inspects *Nakshatra Dispositor Chains* (`PlanetCard.starChain`) of `5th lord`, `Venus`, and `Moon`; identifies *Pending Karma* (`StarProfile.pendingKarmaHouses` involving `5th`, `7th`, `Venus`), and checks if `Lagna` or `5th` lord sits in `Vipat`/`Pratyak`/`Vadha` relationships to `DK`.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `6th house` (conflict/criticism habits), `8th house` (crisis/trauma bonding), `12th house` (self-undoing/escapism, *Vyaya*), `Mars–Saturn` or `Rahu–Venus` afflicting `5th`/`A5`, `12th` from `AL`/`A5` (what drains romantic image), and `Badhaka` house/lord interference (`HouseCard.class === 'badhaka'`).
- **Divisional Charts (`D1`, `D9`, `D30`):** Cross-checks `D1` loop against `D30` (*Trimshamsha* — subconscious behavioral flaws/*Arishta*) and `D9` (what the soul is actually trying to master). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` differentiates ingrained *Drudha Karma* (`confirmed_weak`, requiring firm structural guardrails) from `d9_redeemed` (where conscious maturity dissolves an old youthful loop).
- **Dasha Systems:** Traces how consecutive Antardashas in `AntardashaFruitionCell` (`6/8`, `2/12`, or repeating star-lord chains) reactivate the same `5th`/`6th`/`8th`/`12th` circuit, and spots the next `1/5/9` Trikona or `3/11` Upachaya shift to anchor new behavior.
- **Transits (Gochara):** Tracks **Nodal Returns** (18.6, 37.2, 55.8) and **Half-Nodal Returns** (27.9, 46.5), `Saturn` cycles repeating every ~29.5 years, and `Rahu`/`Saturn` hits over `K64M`, `K64L`, or `KD22` where old loops resurface for conscious graduation.
- **Tithi Pravesha (TP):** Inspects `TP` `6th`/`8th`/`12th` houses, *Mrityu/Kali Saham* triggers, and whether `yearLord` empowers self-mastery (`Lagna`/`9th`) vs. reactive drift.

#### Google Search Trends Synthesis
Addresses high-intent self-reflection queries (*"why do I keep dating the same person astrology"*, *"breaking relationship patterns birth chart"*, *"dating self sabotage astrology"*) by turning fatalistic "curse" fears into empowering, time-anchored behavioral accountability.

#### Classical Attribution
- *BPHS* Ch. 17, 19, 23 (`6th`/`8th`/`12th` habits and self-undoing), Ch. 30 (`D30` *Trimshamsha*)
- *Lunar Astro / Deepanshu Giri* — Rasi/Nakshatra Dispositor Chains (`chain`/`starChain`) & *Pending Karma* loops
- *Jaimini Upadesha Sutras* (`A5`, `AL`, `Badhaka` obstruction)
- *SOUL.md* §3 — Mandatory 4-Tier Behavioral Playbook (`Sattvic`/`Rajasic`/`Mediocre`/`Baseline`)

---

### Card 10: Turning Dating Into Commitment
- **Card Number:** `10`
- **Card Name:** `Turning Dating Into Commitment`
- **Card Slug:** `dating.transition_commitment`
- **Subtitle:** `When casual dating is supported to cross cleanly into defined commitment`
- **Default Placement:** Pinned starter card (`suggested: true`); bridges Dashboard 01 (`Dating`) to Dashboard 02 (`Marriage & Partnership`).

#### Area of Focus
Evaluating when a casual or dating bond has genuine astrological and practical support to cross the threshold from `5th house` romance into `7th house` / `UL` exclusive partnership—or when walking away protects the native's future.

#### Oracle Question
*"During which upcoming dates is your dating life supported to step across from casual romance into defined commitment—and what conversation clarifies whether this bond can hold it?"*
- **Window Grounding:** Highlights the exact `5th-to-7th` / `UL` convergence dates inside the next 12–24 months and marks past missed windows vs. upcoming decision windows.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored for `dating` users evaluating exclusivity (`love.status === 'dating'` or `'single'` seeking serious partnership); updates `person_facts` cleanly if the user confirms exclusivity, unlocking Dashboard 02.
- **Stance Resolution:** `build` (initiate the exclusivity/commitment conversation) when `D1 + D9` `7th`/`UL` align with `Jupiter` double-transit or supportive `AD`/`PD`; `get_through` (observe, do not force an ultimatum unless ready to exit) when `5th` is active alone without `7th`/`UL`/`D9` confirmation.
- **4-Tier Behavioral Guidance:** *Sattvic:* State clear long-term intentions calmly and honor the partner's honest capacity; *Rajasic:* Agree on concrete milestones and shared timeline expectations; *Mediocre:* Stay in an undefined situationship hoping it magically becomes exclusive; *Baseline:* Issue panic-driven ultimatums during a `Ketu`/`6-8` friction window.
- **Single Past-Event Calibration Question:** *"Around [prior_commitment_test_date], did a conversation about defining the relationship or taking a next step surface?"*

#### Full-Circle Coverage
Audits the `5th` (romance) -> `7th`/`UL` (commitment) handoff (Structural Readiness) -> checks `D9` sustainability (Longevity Gate) -> gives dated exclusivity windows (Timing) -> guides the conversation or graceful exit, transitioning committed users to Dashboard 02 (`Marriage & Partnership`) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Tracks activation of `7th lord`, `UL` lord, and `DK` nakshatras; checks `Tara Bala` on planned commitment conversation dates (`Sampat`, `Kshema`, `Sadhaka`, `Mitra`, `Param Mitra`) and avoids `Vipat`/`Vadha` or `Gandanta` triggers.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines the structural link (*Sambandha* via conjunction, mutual aspect, or exchange) between `5th lord` (dating) and `7th lord` (exclusive union) or `UL` (*Upapada Lagna*, tangible relationship container) and `2nd from UL` (sustenance). Checks `DK` and `Jupiter`/`Venus` strength.
- **Divisional Charts (`D1`, `D9`, `D7`):** The decisive varga bridge: `D1` `5th` + `D7` (attraction) must hand off cleanly to `D9` `7th`/`UL`/`Lagna` (covenant). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `7th lord`, `DK`, and `Venus`/`Jupiter` is mandatory—preventing `5th`-house illusions from masquerading as marriageable `D9` partnerships.
- **Dasha Systems:** Requires multi-clock confirmation (`resolveActiveMahadasha` + `Five Clocks`) shifting from `5th`/`11th` sub-periods into `7th lord`, `UL lord`, `DK`, or `D9` `7th` lord AD/PD, with supportive `9×9` `AntardashaFruitionCell` (`1/5/9` or `4/7/10`).
- **Transits (Gochara):** Checks `activateDoubleTransit` (`S6D`: **Jupiter + Saturn** both influencing `D1` `7th house`, `7th lord`, or `UL`), `Jupiter` transiting over `UL` or aspecting `7th`/`Lagna`, and `Saturn` stabilizing `7th` with `SAV >= 28` (structure rather than drift).
- **Tithi Pravesha (TP):** Checks `TP` `7th house` and `yearLord` connection to `7th`/`UL`, `Vivaha Saham` activation, and `Tithi Ashtottari` sub-periods of `7th`/`UL` lords inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Synthesizes high-intent transition queries (*"when will dating become exclusive astrology"*, *"moving from talking stage to relationship"*, *"will he commit birth chart"*) by explaining the concrete difference between "fun chemistry" and "covenant readiness" without manipulative dating games.

#### Classical Attribution
- *BPHS* Ch. 16 & Ch. 18 (`5th` vs. `7th` Bhava transitions)
- *Jaimini Upadesha Sutras* Ch. 1.4 (`Upapada Lagna` `UL` and `2nd from UL` sustainability)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `5th`-to-`7th` transition and `D9` covenant
- *K.N. Rao* — Jupiter/Saturn Double Transit for commitment maturation

---

## 4. Dashboard 01 Attribution & Source Catalog

| Source / Tradition | Author / Origin | Specific Sections / Concepts Applied | Role in Dashboard 01 |
|---|---|---|---|
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | Ch. 15–23 (Bhavas 4, 5, 6, 7, 8, 11, 12), Ch. 45 (*Graha Pakvata*), Ch. 46–51 (Dashas) | Primary Bhava, Karaka, Dasha, and maturation framework across Cards `#1`–`#10`. |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | Ch. 1.1–1.4 (`AK`..`DK`, `A5`, `UL`, `AL`, Rasi Drishti, Argala) | Partner archetype (`DK`), romantic image (`A5`), and commitment container (`UL`) in Cards `#2`, `#4`, `#7`, `#10`. |
| *Phaladeepika* | Mantreswara | Ch. 15–18, Ch. 20 (*Graha Pakvata*, Avasthas), Ch. 26 (Gochara) | Delays (`Saturn`/`Sade Sati`), Vargottama/Neecha Bhanga, and transit triggers in Cards `#1`, `#3`, `#6`, `#8`. |
| *Saravali* | Kalyana Varma | Ch. 4, Ch. 13–20 | `Venus–Mars` attraction signatures and `D1+D9` Vargottama differentiation in Cards `#4`, `#7`. |
| *Uttara Kalamrita* | Kalidasa | Kanda 1, Varga 4–5 | Subtle `3rd`/`5th`/`12th` significations and retrograde (*Vakra*) repeat mechanics in Cards `#2`, `#5`, `#6`, `#8`. |
| *Prasna Marga* | Panakkattu Namboodiri | Ch. 1–16 | Discerning mixed signals, hidden agendas, and obsessive vs. auspicious bonds in Cards `#5`, `#7`. |
| *Tithi Pravesha: Vedic Annual Horoscopy* | Pt. Sanjay Rath | `yearLord`, `TP Lagna`, `Muntha`, `Sahams`, `Tithi Ashtottari` | Bounded 12-month lunar-solar pulse across all 10 cards (zero Gregorian fallback). |
| *Timing Events & Double Transit* | K.N. Rao | Double Transit of Jupiter & Saturn + Vimshottari calibration | Meeting and commitment timing windows in Cards `#2`, `#10`. |
| *Muhurta Chintamani* & *Taittiriya Brahmana* | Daivajna Rama / Vedic Samhitas | 27 Nakshatras, 9 Navataras, Tara Bala | Daily/period emotional receptivity and conversation timing across Cards `#1`–`#10`. |
| *Lunar Astro / Modern Forensic Synthesis* | Deepanshu Giri & Internal Calibration (`SOUL.md`) | Rasi/Nakshatra Dispositor Chains, *Pending Karma*, `K64M`/`BB`, Rule 0, 4-Tier Playbook | Pattern-breaking, ex-closure, anti-sycophancy disambiguation, and 4-tier behavioral remedies in Cards `#3`, `#4`, `#5`, `#6`, `#9`. |
| *AIAstra Architecture & Search Research* | Internal Specs (`docs/reading-engine/75`, `76`, `78`, `80`) | Self v3 foundation contract, `getD9MaturityAgeYears()`, `evaluateD1D9MutualConfirmation`, Search trend synthesis | Product architecture, age-36 gate, engine boundary compliance, and consumer query alignment. |
