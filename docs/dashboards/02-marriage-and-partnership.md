# Dashboard 02: Marriage & Committed Partnership (Cards 11–22)

**Document Status:** Architecture & Card Specification (Milestone 2 — Relationships Track)  
**Dashboard Slug:** `relationships.marriage` (sub-lens under `/love`)  
**Card Range:** Cards `#11` – `#22` (12 Cards Total)  
**Related Specs:** [`00-plan.md`](./00-plan.md), [`docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`](../reading-engine/78-love-work-dashboard-separation-and-cards.md), [`docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`](../reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md), [`docs/reading-engine/75-self-foundation-card.md`](../reading-engine/75-self-foundation-card.md), [`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`](../reading-engine/80-radha-and-catalogue-gap-analysis.md)

---

## 1. Domain Overview & Astrological Separation Rationale

Marriage and committed life-partnership operate on an entirely different astrological axis than casual dating (`5th house`). A lifelong union binds the native's **7th house** (covenant and spouse), **Upapada Lagna (`UL`)** (the social and legal container of marriage and its sustenance via `2nd from UL`), **2nd house** (*Kutumba* / extended family lineage), **4th house** (*Sukha* / shared home peace), **8th house** (*Mangalya* / longevity of the bond, joint assets, and in-laws), **12th house** (private union), and **D9 Navamsha** (the dharmic soul container that activates co-equally above Saturn's age-36 maturation threshold). Asking a married user *"When will you meet someone?"* or showing a single person *"In-laws & Shared Home"* destroys trust. Separating **Marriage & Committed Partnership** ensures every question, timing window, and behavioral prescription respects the user's real domestic covenant.

### 1.1 Dashboard Metadata

| Property | Specification |
|---|---|
| **Default Routing (`person_facts`)** | Routed automatically when `love.status` is `married`, `engaged`, `committed_domestic`, or `separated`; also openable from the `/love` lens switcher for unmarried users inspecting Card `#12` (`Marriage Timing & Readiness`). |
| **Pinned Starter Cards (Default 5)** | For married/committed: `#11 marriage.pulse`, `#13 marriage.daily_harmony`, `#14 marriage.conflict_cycles`, `#18 marriage.inlaws_family`, `#19 marriage.finances_chores`. For engaged/unmarried visiting this lens: `#12 marriage.timing_readiness` moves to #1 pinned; for separated: `#17 marriage.reconciliation` promotes to pinned. |
| **Picker-Available Cards (7)** | `#12 marriage.timing_readiness`, `#15 marriage.communication`, `#16 marriage.trust_transparency`, `#17 marriage.reconciliation`, `#20 marriage.children_family`, `#21 marriage.longterm_longevity`, `#22 marriage.personal_growth`. |
| **Primary Houses (`D1`)** | `7th` (spouse, formal vows), `2nd` (speech, family lineage, shared savings), `4th` (domestic happiness, home), `8th` (longevity of union, shared debt/assets, in-laws, hidden stress), `12th` (private intimacy, quiet compromise), `5th` (children), `1st` (personal identity inside partnership). |
| **Primary Karakas & Arudhas** | `Jupiter` (dharma, husband/wisdom significator), `Venus` (marital harmony, wife/affection significator), `DK` (*Darakaraka*), `AK` (*Atmakaraka* in Card `#22`), `PK` (*Putrakaraka* in Card `#20`), `UL` (*Upapada Lagna* & `2nd from UL`), `AL` (*Arudha Lagna*). |
| **Primary Divisional Charts** | `D1` (outer household reality), `D9` (*Navamsha* — mandatory joint `D1 + D9` confirmation when `ageYears > getD9MaturityAgeYears()`), `D7` (*Saptamsha* — progeny & creative family growth), `D30` (*Trimshamsha* — structural strain, disputes, *Arishta*). |
| **Secondary / Diagnostic Vargas** | `D2` (*Hora* — joint cashflow/treasury in Card `#19`), `D4` (*Chaturthamsha* — shared home/property in Card `#18`). |

### 1.2 Full-Circle Coverage Matrix

| Functional Pillar | Cards Covered | What It Guarantees for the User |
|---|---|---|
| **Macro Status & Evolution** | `#11` Partnership Pulse, `#21` Long-Term Longevity | Tracks the 12-month marital climate and multi-decade maturation across the age-36+ `D9` pivot. |
| **Commitment & Repair** | `#12` Timing & Readiness, `#17` Repair & Reconciliation | Guides engaged/unmarried users toward marriage readiness and supports separated couples through honest repair or dignified closure. |
| **Day-to-Day Relational Bond** | `#13` Daily Harmony, `#14` Conflict Cycles, `#15` Communication, `#16` Trust & Transparency | Protects warmth, de-escalates temporary transit fights without fatalism, times hard talks, and addresses secrecy constructively. |
| **Practical Domestic Life** | `#18` Family & In-Laws, `#19` Shared Money & Chores, `#20` Children & Family Growth | Solves real-world marriage friction around extended family, budgets/division of labor, and family expansion (`D7`). |
| **Soul Covenant & Identity** | `#22` Role & Growth Inside Marriage | Prevents self-erasure by aligning `AK` (personal soul purpose) with `DK` (partner mirror). |

---

## 2. Shared Engine Contracts, Age-36 `D9` Gate & Guardrails

### 2.1 Zero Node Astrology & Engine Boundary
- **Calculation Authority:** All natal and divisional chart tables (`D1`, `D2`, `D4`, `D7`, `D9`, `D30`), Arudhas (`UL`, `AL`, `A7`), Chara Karakas (`AK`, `PK`, `DK`), 40+ Dasha systems (`kundli_activation`), Ashtakavarga (`sav`/`bav`), and Tithi Pravesha annual charts (`annual.tithi_pravesha`) come strictly from the backend calculation engine (`AIAstra_Radha` / `pyjhora`) into `kundli_digest` (`DigestView`). Node performs zero astrological computation.
- **Caching & Sub-Technique Architecture:** Shared deterministic ledgers run once as `love.sub.*` sub-techniques into `technique_outputs`, area cards perform pure selection into `AreaBrief`, LLM prompts (`Oracle` + `Personalizer`) keep the stable natal prefix (`parts[0]` >= 1,024 tokens) cached per `(userId, kundliId)` with 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES = 45`).
- **Strict Redaction & Non-Fatalism (`SOUL.md` §1 & §3):** Zero internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) and zero raw Sanskrit jargon on user-facing card faces or Oracle Questions; technical keys sit in **Chart details** (`evidence`). Never issue a fatalistic divorce or separation verdict—frame every heavy period with easing dates and the 4-Tier Behavioral Playbook (`Sattvic`, `Rajasic`, `Mediocre`, `Baseline`).
- **Engine Gaps Noted (`doc 80`):** Until `SERVED_VARGAS` unlocks `D30` dynamic pulls and `annual.tithi_pravesha` populates `yearLord` across both engine and `build.ts`, `D1 + D9 + D7 + D2 + D4` serve natively while missing `yearLord` fails closed to `stance = 'get_through'`. Headless `Ashtakoota/Dasakoota` synastry (`compatibility.py`) is an upcoming High-Value (`H3`) enhancement when partner birth data is linked.

### 2.2 Age-36 Navamsha (`D9`) Mutual Confirmation Gate
Dashboard 02 is the primary consumer of `ageYears > getD9MaturityAgeYears()` (`src/config/env.ts`, default `36`):
- **Pre-36 (`ageYears <= 36`):** `D1` `7th`, `UL`, `2nd`/`4th`, `Venus`, and `Jupiter` set the primary baseline; `D9` provides early marital temperament background.
- **Post-36 (`ageYears > 36`):** **Mandatory joint `D1 + D9` mutual confirmation** via `evaluateD1D9MutualConfirmation` for `7th lord`, `UL lord`, `Venus`, `Jupiter`, `DK`, and active MD/AD lords:
  - `confirmed_strong` (+1.5 Exalted/Own Vargottama; +1.0 Neutral Vargottama): Deep marital endurance and dharmic alignment across decades.
  - `confirmed_weak` (-1.5 *Neecha Vargottama* / *Drudha Karma*; -1.3..-1.5 non-Vargottama): Structural marital friction requiring conscious boundaries, counseling, and disciplined expectations.
  - `d9_redeemed` (+1.2 *Neecha Bhanga via D9*): Early marriage turbulence or delayed union matures post-36 into earned loyalty, tenderness, and shared wisdom.
  - `d9_weakened` (-1.0 *False Promise*): Smooth early courtship (`D1` strong) hits unexamined structural expectations post-36 (`D9` weak) unless both partners adapt deliberately.

### 2.3 Card Toolbar Vetting & Single Calibration Discipline
- Every card follows `docs/reading-engine/75` and `.agents/skills/dashboard-card-toolbar-vetting/SKILL.md`: `Read` default face, `Short` face, ordered non-overlapping `PeriodStrip` (TP-bounded `tp_start`..`tp_end`, <= 400 days), `KeyDates` (max 6, future milestone required for `Dates` tool), 5-Gate vetted optional tools, unconditional `Chart details`, and **one** past-event confirmation question.

---

## 3. Card Specifications (Cards 11–22)

---

### Card 11: Where Your Partnership Stands
- **Card Number:** `11`
- **Card Name:** `Where Your Partnership Stands`
- **Card Slug:** `marriage.pulse`
- **Subtitle:** `The 12-month emotional climate of your committed bond, season by season`
- **Default Placement:** Pinned starter card (`suggested: true`) for `married`, `engaged`, `committed_domestic`, and `separated`.

#### Area of Focus
A comprehensive 12-month overview of the committed partnership's emotional climate, stability, and shared momentum across the upcoming lunar-solar return year.

#### Oracle Question
*"Across the next 12 months, what is the overarching emotional climate of your partnership, and which dated stretches bring natural closeness versus tests of patience?"*
- **Window Grounding:** Slices the current TP container (`tp_start`..`tp_end`) into 3–6 distinct stretches (`Warm stretch`, `Mixed stretch`, `Heavy stretch`), flagging both immediate active dates and upcoming shifts.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts directly to `love.status` (`married` vs `engaged` vs `separated`), `children`, and `age_band` (applying post-36 `D9` maturity lens when applicable).
- **Stance Resolution:** `build` when TP `yearLord` is dignified, `7th`/`UL` lords enjoy `1/5/9` or `4/7/10` AD fruition, and clocks concur; fails closed to `get_through` if `yearLord` is unresolved/afflicted or `6/8`/`2/12` marital strain dominates.
- **4-Tier Behavioral Guidance:** *Sattvic:* Treat quiet/heavy stretches as shared teamwork against external stress rather than turning against each other; *Rajasic:* Schedule major couple decisions (moves, travel, purchases) inside supportive windows; *Mediocre:* React mood-by-mood without seeing the broader cycle; *Baseline:* Escalate temporary friction into threats against the marriage itself.
- **Single Past-Event Calibration Question:** *"Between [prior_stretch_start] and [prior_stretch_end], did your relationship go through a noticeably steadier—or more demanding—season than usual?"*

#### Full-Circle Coverage
Delivers the annual relational weather map (Entry) -> prevents overreacting to short-term squalls (Reframing) -> routes active warmth to Card `#13`, strain to Card `#14`, and money/family pressure to Cards `#18`–`#19` (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `7th lord`, `UL lord`, `Venus`, and `Jupiter` nakshatras; checks if the active dasha lord and TP `yearLord` sit in `Sampat`, `Kshema`, `Sadhaka`, `Mitra`, or `Param Mitra` taras (`Tara Bala = 1`) vs. `Vipat`/`Pratyak`/`Vadha` (`Tara Bala = 0`) from Janma Nakshatra.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `7th house` and `7th lord`, `UL` (*Upapada Lagna*) and `2nd from UL` (sustenance of bond), `DK` (*Darakaraka*), `Venus` (harmony), and `Jupiter` (dharma/grace). Checks *Shubha Kartari* vs. *Papa Kartari* on `7th`/`UL`.
- **Divisional Charts (`D1`, `D9`):** Jointly inspects `D1` `7th`/`UL` and `D9` `Lagna`/`7th`. When `ageYears > getD9MaturityAgeYears()` (`36`), enforces `evaluateD1D9MutualConfirmation` on `7th lord`, `DK`, `Venus`, `Jupiter`, and active MD/AD lords, surfacing whether the year tests surface habits (`D1`) or core covenant (`D9`).
- **Dasha Systems:** Calls `resolveActiveMahadasha` across conditional nakshatra dashas (e.g., *Dwisaptati Sama* when Lagna/7th lords exchange!), Vimshottari MD/AD/PD, Narayana/Chara, and Yogini. Scores `AntardashaFruitionCell` (`1/5/9` & `4/7/10` closeness vs. `6/8` & `2/12` adjustment) and `avasthaMultipliers`.
- **Transits (Gochara):** Tracks `Jupiter` and `Saturn` aspects on `D1` `7th`, `UL`, and `Moon`; flags `Sade Sati` or `Ashtama Shani` heavy patience cycles; weighs `HouseCard.sav` on `7th` and `4th` (`>= 30` protective buffer).
- **Tithi Pravesha (TP):** Anchored strictly in `runningTithiPravesha` (`tp_start`..`tp_end` <= 400 days). Reads `AnnualRow.yearLord`, `TP Lagna` vs. `TP 7th` (`tpRowIn` for `D1` and `D9`), `Muntha` in `7th`/`4th`/`6th`/`8th`, *Vivaha Saham*, and `Tithi Ashtottari` sub-periods.

#### Google Search Trends Synthesis
Addresses the high-volume annual search cluster (*"marriage horoscope this year"*, *"relationship forecast 2026/2027"*, *"will my marriage get better this year"*) by grounding couples in realistic multi-month seasons instead of vague weekly fluff.

#### Classical Attribution
- *BPHS* Ch. 18 (7th Bhava Phala), Ch. 46–51 (Dasha fruition)
- *Jaimini Upadesha Sutras* Ch. 1.4 (`Upapada Lagna` & `2nd from UL`)
- *Tithi Pravesha* (Pt. Sanjay Rath) — Annual `yearLord`, `TP D9`, and `Tithi Ashtottari`
- *docs/reading-engine/76* — Age-36 `D9` Gate & `evaluateD1D9MutualConfirmation`

---

### Card 12: Marriage Timing & Readiness
- **Card Number:** `12`
- **Card Name:** `Marriage Timing & Readiness`
- **Card Slug:** `marriage.timing_readiness`
- **Subtitle:** `Dated commitment windows alongside emotional and practical readiness for marriage`
- **Default Placement:** Pinned #1 when `love.status` is `engaged` or unmarried user opens Dashboard 02; picker-available for `married` users.

#### Area of Focus
Pinpointing dated windows when formal marriage, engagement, or legal domestic commitment receives maximum astrological backing—paired with an honest audit of emotional and practical readiness.

#### Oracle Question
*"During which specific upcoming date ranges is formal marriage or lifelong commitment most strongly supported, and what personal readiness factors clear the way?"*
- **Window Grounding:** Surfacing exact 2-to-6-month double-transit + dasha + TP windows (`"Strongest commitment window: <from> to <to>"`), while noting earlier missed or preparatory phases.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored differently for `engaged` (wedding/vow timing & pre-marital alignment) vs. `single` seeking marriage (timing windows & readiness).
- **Stance Resolution:** `build` when `D1 + D9` `7th`/`UL` + Jupiter/Saturn double transit + supportive dasha align; `get_through` (use time to clear practical/emotional preconditions) when blocks on `UL`/`7th` remain active.
- **4-Tier Behavioral Guidance:** *Sattvic:* Align core values, family ethics, and mutual respect before ceremony; *Rajasic:* Set concrete financial, legal, and relocation logistics ahead of peak windows; *Mediocre:* Fixate on an arbitrary calendar deadline regardless of partner fit; *Baseline:* Rush into vows during an unvetted `Rahu`/`6-8` impulse to silence social pressure.
- **Single Past-Event Calibration Question:** *"Around [prior_ul_or_7th_trigger_window], did marriage, engagement, or serious family talks come onto the table?"*

#### Full-Circle Coverage
Audits natal/D9 marriage promise & age maturation (Baseline) -> verifies multi-clock + double-transit + TP marriage triggers (Timing) -> checks `UL` & `2nd from UL` sustainability prerequisites (Readiness) -> hands off to Card `#13` & `#18` once committed (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `7th lord`, `UL lord`, `Venus`, `Jupiter`, and `DK` nakshatras; checks `Pratyantardasha` activation of `Sadhaka`, `Sampat`, `Mitra`, or `Param Mitra` taras and auspicious *Muhurta* compatibility principles.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `7th house`, `7th lord`, `UL` (*Upapada Lagna*), `2nd from UL` (continuation), `DK`, `Venus` (men/universal harmony), and `Jupiter` (women/dharmic covenant). Evaluates *Kalatra Yoga*, delayed-marriage Saturn aspects on `7th`/`UL`, or *Kuja Dosha* cancellations (*Mangal Dosha* balanced across `D1`/`D9`).
- **Divisional Charts (`D1`, `D9`):** Mandatory dual confirmation of `D1` `7th`/`UL` with `D9` `Lagna`, `7th`, and `9th`. Above `getD9MaturityAgeYears()` (`> 36`), `evaluateD1D9MutualConfirmation` distinguishes delayed-but-solid `d9_redeemed` unions from `confirmed_weak` patterns needing careful partner vetting.
- **Dasha Systems:** Requires concordance across at least 2–3 clocks (`resolveActiveMahadasha`): MD/AD/PD of `7th lord`, `UL lord`, planets in `7th`/`UL`, `DK`, `Venus`, or `Jupiter`; checks *Chara/Narayana Dasha* of the sign containing `UL`, `7th`, or `DK`.
- **Transits (Gochara):** Core trigger is `activateDoubleTransit` (`S6D`: **Jupiter + Saturn** simultaneously transiting or aspecting `D1` `7th house`, `7th lord`, `UL`, or `D9` `7th`). Checks `Jupiter` transit over natal `Moon`/`Lagna`/`Venus` and `SAV >= 28` in `7th`.
- **Tithi Pravesha (TP):** Inspects `TP` `7th` house, `TP` `D9` `7th`, `yearLord` aspecting `7th`/`UL`, *Vivaha Saham* (`annual.sahams`), and `Muntha` in `7th`/`11th`/`1st`.

#### Google Search Trends Synthesis
Addresses one of the highest-volume global Vedic queries (*"when will I get married astrology"*, *"marriage age prediction birth chart"*, *"is my chart ready for marriage"*) using rigorous Double Transit + `UL` + `D9` mechanics instead of generic age guessing.

#### Classical Attribution
- *BPHS* Ch. 18 (7th Bhava marriage timing) & Ch. 45 (*Graha Pakvata*)
- *Jaimini Upadesha Sutras* Ch. 1.4 (`Upapada Lagna`, `2nd from UL`, *Chara Dasha* of `UL`)
- *K.N. Rao* — *The Double Transit Phenomenon* (Jupiter + Saturn mandatory marriage trigger)
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Vivaha Saham* & annual `7th` activation

---

### Card 13: Warmth & Day-to-Day Harmony
- **Card Number:** `13`
- **Card Name:** `Warmth & Day-to-Day Harmony`
- **Card Slug:** `marriage.daily_harmony`
- **Subtitle:** `Where tenderness and everyday ease live, and how to protect your rituals`
- **Default Placement:** Pinned starter card (`suggested: true`) for married and domestic partnerships.

#### Area of Focus
Identifying where affection, tenderness, domestic comfort, and effortless companionship naturally reside between partners—and actively protecting those rituals during busy seasons.

#### Oracle Question
*"Where does natural warmth and day-to-day ease live inside your partnership right now, and which upcoming windows best nurture closeness?"*
- **Window Grounding:** Highlights supportive `4th`/`7th`/`Venus`/`Moon` dates for shared rest, trips, or small rituals versus stretches where busyness crowds out tenderness.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `children` (protecting couple time amidst parenting), `work_load`, and `age_band`.
- **Stance Resolution:** `build` (invest in rituals, date nights, shared hobbies) when `4th`/`Venus`/`Moon` have benefic dasha/transit support; `get_through` (gentle, low-demand presence) when `Saturn`/`Mars` temporarily compresses leisure.
- **4-Tier Behavioral Guidance:** *Sattvic:* Practice daily gratitude, unhurried meals, and warm physical/verbal presence; *Rajasic:* Calendar-protect non-negotiable couple time away from screens and chores; *Mediocre:* Take each other for granted until distance feels normal; *Baseline:* Let work exhaustion spill into coldness or sharp tone at home.
- **Single Past-Event Calibration Question:** *"Around [warm_venus_moon_window], did things at home feel noticeably lighter, warmer, or easier to enjoy together?"*

#### Full-Circle Coverage
Locates the couple's natural harmony anchors (`4th`/`Venus`/`Moon`/`Argala`) -> surfaces supportive seasonal dates (Timing) -> recommends concrete daily/weekly protection habits (Action) -> pairs with Card `#14` when friction spikes (Balance).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Moon` and `Venus` nakshatras (`Rohini`, `Mrigashira`, `Pushya`, `Hasta`, `Anuradha`, `Revati` soften domestic tone); checks `Kshema` (4th tara — domestic comfort) and `Mitra`/`Param Mitra` transits.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `4th house` (*Sukha Bhava*, home atmosphere), `4th lord`, `7th house`, `Moon` (`Manas`), and `Venus` (`Shukra` harmony). Inspects benefic `Argala` (*Subha Argala* from `2nd`/`4th`/`11th` to `7th` and `Lagna`) vs. `Virodhargala` obstructions, and *Chandra–Shukra* / *Guru–Shukra* cordiality.
- **Divisional Charts (`D1`, `D9`):** Checks `D1` `4th`/`7th` household rhythm against `D9` `4th`/`7th`/`Venus`/`Moon` emotional sweetness. Post-36 (`ageYears > getD9MaturityAgeYears()`), `D9` `4th` and `Venus` govern whether domestic peace deepens or requires intentional cultivation (`d9_weakened` / `confirmed_weak`).
- **Dasha Systems:** Evaluates `4th`/`7th`/`Venus`/`Moon`/`Jupiter` sub-periods via `resolveActiveMahadasha` and `AntardashaFruitionCell` (`1/5/9` Trikona or `4/7/10` Kendra bringing easy domestic flow; `avasthaMultipliers` like `Mudita`/`Swastha` boosting warmth).
- **Transits (Gochara):** Tracks `Venus` and `Jupiter` transiting `1st`/`4th`/`5th`/`7th`/`11th`, benefic `Moon` *Chandra Bala*, and `SAV` bindus in `4th` and `7th` (`>= 30` steady household buffer).
- **Tithi Pravesha (TP):** Evaluates `TP` `4th` and `7th` houses, `Venus` and `Moon` placement in `TP.D1` and `TP.D9`, and *Smarana/Punya Saham* activations.

#### Google Search Trends Synthesis
Addresses search queries around relationship maintenance (*"how to improve marital harmony astrology"*, *"Venus transit domestic peace"*, *"keeping romance alive in marriage horoscope"*) by emphasizing proactive warmth-building rather than waiting for crisis.

#### Classical Attribution
- *BPHS* Ch. 15 (`4th` Sukha Bhava), Ch. 18 (`7th` house)
- *Jaimini Upadesha Sutras* Ch. 1.1 (`Argala` & `Virodhargala` supporting/obstructing the `7th` and `Lagna`)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Moon` & `Venus` domestic happiness)
- *Phaladeepika* Ch. 15 (home peace and planetary comfort)

---

### Card 14: Distance, Strain & Conflict Cycles
- **Card Number:** `14`
- **Card Name:** `Distance, Strain & Conflict Cycles`
- **Card Slug:** `marriage.conflict_cycles`
- **Subtitle:** `Distinguishing temporary friction from deeper strain, and when pressure lifts`
- **Default Placement:** Pinned starter card (`suggested: true`) for committed/married partnerships.

#### Area of Focus
Diagnosing acute or simmering friction cycles—distinguishing temporary astrological weather from structural faults—and naming the exact dates when tension begins to subside, **never** issuing a fatalistic divorce verdict.

#### Oracle Question
*"What temporary pressure or recurring friction is straining your bond right now, and on what specific dates does that pressure begin to ease?"*
- **Window Grounding:** Clearly bounds the strain span (`Heavy stretch · <from> – <to>`) and marks the exact relief inflection date (`"Tension begins easing after <relief_date>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Sensitive to `stress_markers`, `children`, and `declined_topics`; ensures compassionate, de-escalating tone that never plants fear of breakup.
- **Stance Resolution:** `get_through` (de-escalate, pause major conflict debates, protect dignity) while `Mars`/`Saturn`/`Rahu`/`6-8-12` hits are live; `build` (repair and reset expectations) on the easing date.
- **4-Tier Behavioral Guidance:** *Sattvic:* Name external stressors clearly so the partner isn't treated as the enemy; *Rajasic:* Use structured cool-off rules and fair boundary agreements during heated days; *Mediocre:* Keep score and replay old grievances during a tense cycle; *Baseline:* Utter irreversible threats or walk out impulsively during a temporary Mars/Rahu spike.
- **Single Past-Event Calibration Question:** *"Did arguments, cold distance, or external household stress spike sharply around [strain_start_date]?"*

#### Full-Circle Coverage
Pinpoints the exact source and start date of strain (Diagnosis) -> separates passing weather from deeper `D9`/`D30` patterns (Calibration) -> gives exact easing dates + de-escalation steps (Action) -> routes to Card `#15` (Communication) or Card `#17` (Repair) if separation occurred (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Checks if active AD/PD or transiting malefics cross `Vipat` (3), `Pratyak` (5), or `Vadha` (7) taras, `K64M`, `K64L`, `KD22`, or `Gandanta` degrees relative to `Moon`/`Venus`/`7th lord`.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `6th house` (disputes, criticism), `8th house` (crises, emotional volatility), `12th house` (withdrawal/sleep loss), `Mars–Saturn` mutual aspects on `7th`/`4th`, `Rahu–Ketu` across `1st/7th` or `2nd/8th` axes, and `GK` (*Gnatikaraka*) activating `DK`.
- **Divisional Charts (`D1`, `D9`, `D30`):** Cross-checks `D1` `7th` pressure with `D9` `7th`/`2nd` (note `doc 76` / `SKILL.md` forensic law: for strained `Venus`, `D9 H2` as maraka to 7th triggers sharp ego/speech friction) and **`D30` (*Trimshamsha*) `7th` and `Lagna`** (diagnosing acute conflict, legal escalation, or moral burnout). Post-36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` reveals whether friction is surface (`D1` only) or structural (`confirmed_weak`).
- **Dasha Systems:** Evaluates `6th`/`8th`/`12th` lord or `Mars`/`Saturn`/`Rahu` sub-periods via `resolveActiveMahadasha`, flagging `isShadAshtaka68` (`6/8`) or `isDwirdwadasha212` (`2/12`) in `AntardashaFruitionCell` (`tone = 'careful'`) and computing the exact AD/PD exit date.
- **Transits (Gochara):** Tracks `Mars` transiting `1st`/`4th`/`7th`/`8th`/`12th` (*Mangal* transit triggers), `Rahu–Ketu` over `1st/7th`, `Saturn` *Kantaka Shani* (`4th`/`8th`/`10th`) or *Sade Sati*, and low `SAV` (`< 25`) in `7th`/`4th` increasing fragility.
- **Tithi Pravesha (TP):** Checks `TP` `6th`/`7th`/`8th` houses, `TP D30` afflictions, `yearLord` in `6th`/`8th`/`12th`, *Kali/Mrityu Saham*, and `Tithi Ashtottari` malefic windows within `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses urgent, high-anxiety searches (*"why is my marriage so hard right now"*, *"marital fighting astrology transits"*, *"separation transit in birth chart"*) with non-fatalistic, date-bounded crisis navigation and strict ethical guardrails.

#### Classical Attribution
- *BPHS* Ch. 17, 18, 19 (`6th` disputes, `7th` partnership, `8th` sudden upheaval) & Ch. 30 (*D30 Trimshamsha*)
- *Phaladeepika* Ch. 26 (malefic Gochara over `7th`/`4th`/`Moon`)
- *Prasna Marga* Ch. 16 (identifying marital friction vs. permanent rupture)
- *SOUL.md* §3 & `multi-school-jyotish-reading/SKILL.md` §1.6 (`D9 H2` vs. `D9 H7` forensic law & 4-Tier Playbook)

---

### Card 15: Communication & Unspoken Resentments
- **Card Number:** `15`
- **Card Name:** `Communication & Unspoken Resentments`
- **Card Slug:** `marriage.communication`
- **Subtitle:** `Clearing unspoken resentments and timing sensitive talks when listening comes easiest`
- **Default Placement:** Picker-available (`suggested: false`).

#### Area of Focus
Clearing misunderstandings, unspoken hurts, sharp speech habits, and timing delicate conversations when Mercury and Moon support genuine listening rather than defensive misfires.

#### Oracle Question
*"What unspoken tensions or communication habits are creating distance between you, and which upcoming dates best support an honest, calm conversation?"*
- **Window Grounding:** Separates static-prone windows (`Mercury Rx`, `2nd`/`3rd` pressure) from clear dialogue windows (`Mercury`/`Jupiter` `Tara Bala = 1` dates).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `communication_style` or recent `conflict` cues; keeps coaching strictly practical and non-blaming.
- **Stance Resolution:** `get_through` (listen more, avoid high-stakes confrontations via text, write thoughts down first) during `Mercury Rx` or `Mars`/`Saturn` on `2nd`; `build` (initiate clear, empathetic talks) when `Mercury`/`Moon`/`Jupiter` open.
- **4-Tier Behavioral Guidance:** *Sattvic:* Speak truthful kindness without sarcasm, focusing on feelings rather than accusations; *Rajasic:* Use structured weekly check-ins with clear agendas and turn-taking; *Mediocre:* Swallow resentment until it leaks out sideways; *Baseline:* Weaponize sharp speech (`2nd` malefic) during heated nights.
- **Single Past-Event Calibration Question:** *"Around [mercury_or_2nd_friction_window], did a small misunderstanding or poorly timed conversation spiral larger than intended?"*

#### Full-Circle Coverage
Diagnoses speech & listening dynamics (`2nd`/`3rd`/`Mercury`/`Moon`) -> explains why timing caused misfires (Insight) -> provides clean conversation dates and tone habits (Action) -> feeds back into Card `#13` (Harmony) or Card `#19` (Practical Alignment) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Inspects `Mercury` and `Moon` nakshatras (`Ashlesha`, `Krittika`, `Jyeshtha`, `Moola` require extra care against sharp speech; `Hasta`, `Swati`, `Punarvasu`, `Shravana` aid dialogue); checks `Tara Bala` on planned dialogue windows.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Evaluates `2nd house` (*Vak* / speech and family tone), `3rd house` (daily communication and listening), `Mercury` (*Buddhi*/words) and `Moon` (*Manas*/emotional tone). Flags `Mars`/`Saturn`/`Rahu`/`Ketu` on `2nd`, `Mercury` combust (`sunProximity`) or retrograde (`Vakra`), and *Kemadruma* or *Papakartari* on `Moon`.
- **Divisional Charts (`D1`, `D9`):** Compares `D1` `2nd`/`3rd` verbal style with `D9` `2nd` (inner emotional speech toward spouse) and `D9` `Mercury`/`Moon`. Post-36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Mercury` and `2nd lord` shows whether conversational tact has matured (`d9_redeemed`) or remains brittle (`confirmed_weak`).
- **Dasha Systems:** Inspects `2nd`/`3rd` lord or `Mercury`/`Moon` sub-periods via `resolveActiveMahadasha` and `AntardashaFruitionCell` (`2/12` Dwirdwadasha or `6/8` causing crossed wires vs. `1/5/9` restoring fluency).
- **Transits (Gochara):** Tracks **Mercury Retrograde** (*Budha Vakra*) across `1st`/`2nd`/`3rd`/`7th`, `Mars` transiting `2nd` (harsh tone), `Saturn` transiting `2nd` (withholding/cold silence), and `Jupiter` aspecting `2nd`/`Mercury` (graceful mediation).
- **Tithi Pravesha (TP):** Evaluates `TP` `2nd` and `3rd` houses, `Mercury` dignity in the annual return, and `Tithi Ashtottari` `Mercury`/`Jupiter` periods for clearing the air.

#### Google Search Trends Synthesis
Addresses practical search queries (*"communication problems in marriage astrology"*, *"Mercury retrograde marriage fighting"*, *"how to talk to spouse birth chart"*) by turning Mercury/2nd-house mechanics into concrete conversational timing and tone hygiene.

#### Classical Attribution
- *BPHS* Ch. 13 & Ch. 14 (`2nd` Vak/Kutumba, `3rd` communication)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` speech, `2nd` verbal temperament, retrogradation)
- *Phaladeepika* Ch. 14 (`2nd` house speech quality & planetary influences)
- *SOUL.md* §3 (4-Tier speech playbook, e.g., `Ketu in 2H` Sattvic truth vs. Baseline harshness)

---

### Card 16: Trust, Transparency & Hidden Stress
- **Card Number:** `16`
- **Card Name:** `Trust, Transparency & Hidden Stress`
- **Card Slug:** `marriage.trust_transparency`
- **Subtitle:** `Addressing unspoken distance or financial/digital transparency constructively`
- **Default Placement:** Picker-available (`suggested: false`).

#### Area of Focus
Addressing unspoken anxiety around secrecy, emotional distance, financial/digital transparency, or third-party boundary blurs constructively—grounding intuition in facts without fueling paranoia.

#### Oracle Question
*"Where are unspoken worries around openness or hidden stress testing trust right now, and how can transparency be rebuilt cleanly during this cycle?"*
- **Window Grounding:** Dates `8th`/`12th`/`Rahu` fog cycles (`"Uncertainty peak: <from> – <to>"`) and the clarity window when hidden matters come into plain light (`"Transparency window: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Handles high-sensitivity topics carefully; respects `declined_topics` and enforces `SOUL.md` Rule 0 (never validate unverified paranoia OR dismiss genuine red flags).
- **Stance Resolution:** `get_through` (gather calm objective clarity, protect shared finances/boundaries, avoid impulsive accusations) during `Rahu`/`12th` fog; `build` (structured openness, shared financial/schedule visibility) when `Sun`/`Jupiter`/`9th` illuminates the axis.
- **4-Tier Behavioral Guidance:** *Sattvic:* Ask calm, direct questions anchored in observable facts and shared values; *Rajasic:* Establish transparent financial, calendar, and boundary agreements; *Mediocre:* Snoop silently or spiral in private suspicion; *Baseline:* Either ignore blatant dishonesty out of fear or make explosive false accusations.
- **Single Past-Event Calibration Question:** *"Around [8th_or_12th_trigger_dates], did a hidden concern, unspoken financial detail, or third-party boundary issue surface?"*

#### Full-Circle Coverage
Audits whether intuition reflects `8th`/`12th`/`Rahu` real secrecy vs. `Moon` anxiety (Calibration) -> names when truth surfaces (Timing) -> prescribes calm factual verification and boundary hygiene (Action) -> routes to Card `#17` (Repair) or `#14` (Conflict) if needed (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Inspects `Rahu`, `Ketu`, `Moon`, and `8th`/`12th` lord nakshatras; checks `Pratyak`/`Vadha` taras and deceptive/secretive stars (*Ashlesha*, *Jyeshtha*, *Ardra*, *Shatabhisha*) vs. truth-revealing *Uttara Phalguni*/*Pushya*/*Revati*.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `8th house` (secrets, concealed debts, intimacy trauma), `12th house` (behind-the-scenes actions, escapism), `Rahu` conjoining/aspecting `7th lord` or `Venus`, `Ketu` creating sudden emotional withdrawal, and `UL` vs. `A8` (*Mrityu Pada*) or `A12` (*Upapada* / *Vyaya*). Disambiguates distinct figures per `SOUL.md` Rule 0 (`7th` spouse vs. `6th`/`11th` external stressors).
- **Divisional Charts (`D1`, `D9`, `D30`):** Cross-checks `D1` `8th`/`12th` anxiety against **`D9` `7th`/`8th`/`12th`** and **`D30` (*Trimshamsha*) `7th`/`4th`** (separating fleeting suspicion from real breach of trust). Post-36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Venus`/`7th lord`/`Rahu` governs deep integrity vs. *False Promise* (`d9_weakened`).
- **Dasha Systems:** Tracks `8th`/`12th` lord or `Rahu`/`Ketu` MD/AD/PD via `resolveActiveMahadasha`, flagging `6/8` or `2/12` `AntardashaFruitionCell` stress and identifying when `Jupiter` or `9th` lord sub-periods restore clarity.
- **Transits (Gochara):** Tracks `Rahu` transiting `1st`/`4th`/`7th`/`8th`/`12th` or over natal `Moon`/`Venus`, `Saturn` transiting `8th` (*Ashtama Shani*), and `Jupiter` aspecting `7th`/`8th` (bringing truth to light).
- **Tithi Pravesha (TP):** Evaluates `TP` `8th` and `12th` houses, *Mrityu Saham* vs. *Satya/Punya Saham*, and `yearLord` placement in `8th`/`12th` vs. `9th`/`10th`.

#### Google Search Trends Synthesis
Addresses highly searched anxiety queries (*"can I trust my partner astrology"*, *"infidelity indicators in birth chart"*, *"secret stress in marriage horoscope"*) with strict ethical responsibility—refusing tabloid infidelity sensationalism while empowering grounded transparency.

#### Classical Attribution
- *BPHS* Ch. 19 & Ch. 23 (`8th` hidden matters, `12th` behind-the-scenes), Ch. 30 (`D30`)
- *Prasna Marga* Ch. 15–16 (testing suspicion vs. factual concealment)
- *Jaimini Upadesha Sutras* (`UL`, `A8`, `A12` secrets & sustainability)
- *SOUL.md* §2 (Rule 0 — Multi-entity disambiguation & anti-sycophancy verification)

---

### Card 17: Repair & Reconciliation
- **Card Number:** `17`
- **Card Name:** `Repair & Reconciliation`
- **Card Slug:** `marriage.reconciliation`
- **Subtitle:** `Cooling-off horizons, mediation openings, and honest requirements for repair`
- **Default Placement:** Picker-available (`suggested: false`, promoted to pinned when `person_facts` sets `love.status === 'separated'` or `crisis_repair`).

#### Area of Focus
Navigating marital separation, cooling-off periods, counseling, and testing whether authentic astrological support exists for healing and rebuilding the bond—or whether peaceful closure honors both people's dignity.

#### Oracle Question
*"During this strained or separated chapter, where does your chart show genuine openings for mediation and repair, and what fundamental shifts are needed for healing to hold?"*
- **Window Grounding:** Gives realistic cooling-off end dates (`"Cooling-off period: <from> – <to>"`) and specific mediation windows (`"Constructive repair window: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Activated for `separated`, `on_pause`, or couples in active repair. Strictly honors `declined_topics` (e.g., if user marked `no_reconciliation` or safety exit).
- **Stance Resolution:** `get_through` (emotional stabilization, respectful space, zero desperate chasing) during active `Ketu`/`6-8`/`Ashtama` storms; `build` (structured mediation, counseling, renegotiated terms) only when `UL` + `Jupiter` + `7th` open cleanly.
- **4-Tier Behavioral Guidance:** *Sattvic:* Take honest ownership of your half, forgive without amnesia, and rebuild on higher truth; *Rajasic:* Engage neutral counselors/mediators and establish clear behavioral milestones for reunion; *Mediocre:* Drift in prolonged limbo without either repairing or closing; *Baseline:* Plead, threaten, or return to unchanged destructive dynamics out of fear of being alone.
- **Single Past-Event Calibration Question:** *"Around [separation_or_ketu_trigger_date], did distance widen abruptly or did an existing strain reach a breaking point?"*

#### Full-Circle Coverage
Audits `UL`/`7th`/`D9` longevity vs. `Ketu` detachment (Honest Assessment) -> identifies cooling-off vs. mediation dates (Timeline) -> outlines concrete repair prerequisites (Action) -> guides either renewed partnership (Card `#13`) or dignified closure/re-entry (Dashboard 01) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Checks `7th lord`, `UL lord`, and `Moon` nakshatras; evaluates whether active dashas exit `Vadha`/`Vipat` taras into `Kshema`/`Sadhaka`/`Mitra`, and checks `Bhrigu Bindu` (`D1.BB`) Jupiter contact (karmic grace).
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `UL` (*Upapada Lagna*), `2nd from UL` (whether the container retains sustaining nourishment), `7th lord` moving out of combustion (`sunProximity`) or debilitation (`Neecha Bhanga`), `8th lord` (rejuvenation/transformation vs. rupture), and `Ketu` detachment from `7th`/`UL`.
- **Divisional Charts (`D1`, `D9`, `D30`):** Decisive `D1 + D9` check: strong `D9` `Lagna`/`7th`/`9th` (`confirmed_strong` or `d9_redeemed` post-36 via `getD9MaturityAgeYears()`) supports hard-won second-chapter repair; `confirmed_weak` (`Neecha Vargottama`) + heavy `D30` `7th` warns that reconciliation fails unless deep structural terms change.
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` across Five Clocks (`Vimshottari`, `Narayana/Chara` of `UL`/`7th`, `Yogini` *Siddha*/*Dhanya* vs *Ulka*/*Sankata*) to verify if the separating sub-period is temporary (`AD`/`PD`) or a macro chapter change (`MD`).
- **Transits (Gochara):** Tracks `Jupiter` transit aspecting or occupying `UL`, `7th house`, `7th lord`, or `D9` `7th`; `Venus`/`Mercury` turning direct after retrograde; `Saturn` lifting off `1st`/`7th`/`Moon`; `SAV >= 28` supporting reconciliation attempts.
- **Tithi Pravesha (TP):** Inspects `TP` `7th` and `9th` (grace/counsel), `yearLord` dignity (`get_through` if `yearLord` is weak/afflicted), and `Tithi Ashtottari` shift dates for constructive mediation.

#### Google Search Trends Synthesis
Addresses desperate, emotionally vulnerable queries (*"will my spouse come back astrology"*, *"reconciliation after separation birth chart"*, *"can this marriage be saved horoscope"*) with rare integrity—refusing false promises while identifying genuine mediation windows and healthy transformation requirements.

#### Classical Attribution
- *Jaimini Upadesha Sutras* Ch. 1.4 (`Upapada Lagna` longevity & `2nd from UL` repair)
- *BPHS* Ch. 18 & Ch. 19 (`7th` covenant & `8th` rejuvenation)
- *Phaladeepika* Ch. 20 (*Neecha Bhanga* & dasha transition relief)
- *docs/reading-engine/76* (`D9` post-36 `d9_redeemed` vs `confirmed_weak` assessment)

---

### Card 18: Family, In-Laws & Shared Home
- **Card Number:** `18`
- **Card Name:** `Family, In-Laws & Shared Home`
- **Card Slug:** `marriage.inlaws_family`
- **Subtitle:** `Extended family expectations, parent duties, and protecting your shared home boundary`
- **Default Placement:** Pinned starter card (`suggested: true`) for married/domestic users.

#### Area of Focus
Navigating extended family dynamics, in-law expectations, parent-care duties, and household privacy boundaries so the couple protects a unified domestic sanctuary.

#### Oracle Question
*"How are extended family expectations or household boundaries influencing your partnership right now, and when do domestic pressures settle?"*
- **Window Grounding:** Dates `2nd`/`4th`/`8th` pressure windows (`"Family pressure stretch: <from> – <to>"`) and calmer household alignment phases.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `living_arrangement` (nuclear vs. joint/multi-generational household), `children`, and `cultural_family_context`.
- **Stance Resolution:** `build` (host warm gatherings, align on housing/parent plans) when `4th`/`2nd` enjoy `Jupiter`/`Venus`/`Moon` harmony; `get_through` (protect couple privacy, calm polite boundaries) when `Sun`/`Saturn`/`Mars`/`Rahu` agitate `2nd`/`8th`.
- **4-Tier Behavioral Guidance:** *Sattvic:* Honor elders respectfully while keeping the marriage's inner decisions private between spouses; *Rajasic:* Negotiate explicit roles, financial boundaries, and visiting schedules together as a united team; *Mediocre:* Vent to parents about the spouse or avoid setting boundaries until resentment boils; *Baseline:* Let in-law interference divide the marriage into opposing camps.
- **Single Past-Event Calibration Question:** *"Around [2nd_4th_8th_pressure_dates], did a disagreement involving parents, in-laws, or household living arrangements test your peace?"*

#### Full-Circle Coverage
Disambiguates native's family (`2nd`) vs. shared home (`4th`) vs. spouse's family/in-laws (`8th` = `2nd from 7th`) -> diagnoses current boundary friction (Insight) -> prescribes united-front tactics and dated calm windows (Action) -> hands off to Card `#19` (Shared Money) or `#13` (Warmth) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `4th lord`, `2nd lord`, and `8th lord` nakshatras; checks `Moon` (mother/domestic nurturing) and `Sun` (father/authority) stars and `Tara Bala` during family transitions.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Uses precise Bhavat-Bhavam mapping: `2nd house` (native's family lineage/*Kutumba*), `4th house` (marital home & domestic peace), **`8th house`** (`2nd from 7th` — spouse's family / in-laws), and `2nd from UL`. Inspects `Sun`/`Saturn`/`Mars`/`Rahu` in `2nd`, `4th`, or `8th`, plus `A4` (*Matri/Vahana Pada*) and `UL` interactions.
- **Divisional Charts (`D1`, `D9`, `D4`):** Evaluates `D1` `2nd`/`4th`/`8th` alongside **`D4` (*Chaturthamsha*)** (fixed home, property, living arrangements) and **`D9` `4th`/`8th`** (long-term emotional boundary resilience post-36 via `getD9MaturityAgeYears()`).
- **Dasha Systems:** Tracks `2nd`/`4th`/`8th` lord or `Moon`/`Sun`/`Saturn` MD/AD/PD via `resolveActiveMahadasha` and `AntardashaFruitionCell` (`4/7/10` home settlement vs. `6/8` in-law friction).
- **Transits (Gochara):** Tracks `Saturn` transiting `4th` (*Kantaka Shani* — heavy domestic duty/repairs), `8th` (*Ashtama Shani* — in-law tension), or `2nd` (*Sade Sati* setting phase); `Rahu–Ketu` across `2nd/8th` or `4th/10th`; `Jupiter` aspecting `4th`/`2nd` (bringing warmth and resolution).
- **Tithi Pravesha (TP):** Evaluates `TP` `4th` and `8th` houses, `TP D4` (housing moves/domestic stability), `Muntha` in `4th`/`8th`, and `yearLord` influence on the domestic axis.

#### Google Search Trends Synthesis
Addresses one of the most searched yet underserved relationship topics globally (*"in-law problems astrology"*, *"mother in law conflict birth chart"*, *"joint family vs nuclear family astrology"*) with culturally literate, dignified boundary strategies.

#### Classical Attribution
- *BPHS* Ch. 13 (`2nd` *Kutumba*), Ch. 15 (`4th` *Griha/Sukha*), Ch. 19 (`8th` as `2nd from 7th` spouse's family)
- *Jaimini Upadesha Sutras* (`UL` & `2nd from UL`, `A4` home environment)
- *BPHS* Ch. 7 (*Chaturthamsha D4* for home & domestic assets)
- *SOUL.md* §2 (Rule 0 — disambiguating distinct family elders rather than stereotyping)

---

### Card 19: Shared Money & Responsibilities
- **Card Number:** `19`
- **Card Name:** `Shared Money & Responsibilities`
- **Card Slug:** `marriage.finances_chores`
- **Subtitle:** `Aligning household budgets, shared resources, and fair day-to-day workload`
- **Default Placement:** Pinned starter card (`suggested: true`) for married and cohabiting couples.

#### Area of Focus
Aligning on household budgets, shared savings, debt/tax realities, earning disparities, and fair division of domestic labor (`2nd`/`6th`/`8th`/`11th` + `D2 Hora`).

#### Oracle Question
*"Where are money expectations or day-to-day household responsibilities pulling out of balance, and which upcoming stretches support financial alignment and teamwork?"*
- **Window Grounding:** Maps lean cashflow or unexpected expense windows (`2nd`/`8th`/`12th`) versus surplus/alignment quarters (`11th`/`D2`/`Jupiter`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `dual_income` vs. `single_income`, `children` (childcare load), and `work.status` (e.g., if one partner is launching a business or between jobs).
- **Stance Resolution:** `build` (joint financial planning, investing, renegotiating chores cleanly) when `2nd`/`11th`/`D2` are supported; `get_through` (tighten discretionary leaks, emergency buffer, zero blame) during `8th`/`12th` or `2/12` AD stretches.
- **4-Tier Behavioral Guidance:** *Sattvic:* Treat household wealth and labor as one shared stewardship without scorekeeping; *Rajasic:* Run a calm monthly budget + chore-division review with clear ownership; *Mediocre:* Harbor quiet resentment over unequal effort or impulse spending; *Baseline:* Hide debts/purchases or weaponize income disparities for control.
- **Single Past-Event Calibration Question:** *"Around [2nd_8th_11th_shift_dates], did shared expenses, uneven household workload, or a financial decision require renegotiation?"*

#### Full-Circle Coverage
Audits personal vs. partner wealth & labor circuits (`2nd`/`8th`/`11th`/`6th` + `D2`) -> surfaces lean vs. surplus stretches (Timing) -> prescribes practical financial/chore alignment (Action) -> links smoothly to Work/Cashflow boards (`06` Card `#49` / `08` Card `#65`) without mixing domains (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `2nd lord`, `8th lord`, `11th lord`, and `Jupiter`/`Venus` nakshatras; checks `Sampat` (2nd tara — wealth/resources) vs. `Vipat`/`Pratyak` cycles for timing major joint financial commitments.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `2nd house` (joint savings/family treasury), **`8th house`** (`2nd from 7th` — partner's money, joint assets, taxes, debt), `11th house` (household cashflow), and `6th house` (daily chores, service load, uneven duty). Checks *Dhana Yogas* vs. *Daridra*/`12th` expenditure drains, `AL` vs. `A2`/`A8`, and `2nd from UL`.
- **Divisional Charts (`D1`, `D9`, `D2`):** Evaluates `D1` `2nd`/`8th`/`11th` alongside **`D2` (*Hora* — Sun Hora active earning vs. Moon Hora nurturing/liquid reserves)** and `D9` `2nd`/`8th`/`11th` (post-36 `getD9MaturityAgeYears()` check via `evaluateD1D9MutualConfirmation` on `2nd`/`11th` lords and `Jupiter`).
- **Dasha Systems:** Evaluates `2nd`/`8th`/`11th`/`6th` lord dashas via `resolveActiveMahadasha` and `AntardashaFruitionCell` (`2/11` *Dhana-Labha* inflow vs. `2/12` / `6/8` cashflow/chore strain).
- **Transits (Gochara):** Tracks `Jupiter` transiting/aspecting `2nd`/`8th`/`11th` (expansion and relief), `Saturn` transiting `2nd` (*Sade Sati* setting — disciplined budgeting) or `8th` (joint asset restructuring), `Rahu` in `2nd`/`8th` (volatile joint expenses), and `SAV` bindus in `2nd` vs. `12th` (`SAV(11th) > SAV(12th)` vs. drain).
- **Tithi Pravesha (TP):** Evaluates `TP` `2nd`/`8th`/`11th`, `TP D2` (*Hora*), *Artha Saham* (`annual.sahams`), and `yearLord` support for financial stability inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses pragmatic couple queries (*"money fights in marriage astrology"*, *"joint finances birth chart"*, *"division of labor in relationship horoscope"*) by connecting `2nd`/`8th`/`D2` wealth mechanics with everyday domestic workload (`6th`).

#### Classical Attribution
- *BPHS* Ch. 13 (`2nd` wealth), Ch. 19 (`8th` partner's wealth), Ch. 22 (`11th` gains), Ch. 6 (*Hora D2*)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (joint assets, `6th` daily chores/service)
- *Jaimini Upadesha Sutras* (`A2`, `A8`, `2nd from UL` material sustenance of marriage)
- *Lunar Astro / Multi-School* (`Sattvic`/`Rajasic`/`Mediocre`/`Baseline` wealth stewardship)

---

### Card 20: Children & Family Growth
- **Card Number:** `20`
- **Card Name:** `Children & Family Growth`
- **Card Slug:** `marriage.children_family`
- **Subtitle:** `Supportive windows for family expansion and steadier day-to-day parenting harmony`
- **Default Placement:** Picker-available (`suggested: false`, promoted if `person_facts` indicates `planning_children` or `parenting`).

#### Area of Focus
Timing supportive windows for conception, adoption, or family expansion—and, for existing parents, guiding parenting harmony, children's milestones, and balancing couple connection with parenthood (`5th house` + `Jupiter` + `D7 Saptamsha`).

#### Oracle Question
*"During which upcoming dates is family expansion or smoother parenting harmony most strongly supported in your chart?"*
- **Window Grounding:** Surfacing dated `5th`/`9th`/`D7` windows (`"Supportive family-growth window: <from> – <to>"`) with utmost sensitivity—never making reckless medical guarantees.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Strictly branches on `children` (`trying_to_conceive` vs. `has_children` vs. `childfree`—suppressing conception talk completely if user selected childfree or declined topic!).
- **Stance Resolution:** `build` when `5th` + `Jupiter` + `D7` + `TP` align; `get_through` (gentle patience, zero self-blame, medical prudence if trying; steady parenting patience if raising kids) during `5th` `Saturn`/`Ketu`/`6-8` friction.
- **4-Tier Behavioral Guidance:** *Sattvic:* Cultivate warmth, patience, and joyful mentoring regardless of timeline; *Rajasic:* Align health, finances, and childcare logistics before peak windows; *Mediocre:* Let fertility anxiety or parenting stress erode couple affection; *Baseline:* Project unlived personal ambitions onto children or delay medical care in favor of superstition.
- **Single Past-Event Calibration Question:** *"Around [5th_or_d7_activation_dates], did questions around parenthood, a child's milestone, or creative family growth take center stage?"*

#### Full-Circle Coverage
Respects user's `person_facts.children` stance (Safety Gate) -> reads `5th` + `Jupiter` + `D7` + `PK` (Diagnosis) -> maps supportive expansion or parenting windows (Timing) -> delivers compassionate, medically respectful guidance (Action).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `5th lord`, `Jupiter` (*Putrakaraka*), `PK` (*Putrakaraka* Chara), and `D7` `Lagna`/`5th` nakshatras; checks `Sadhaka`, `Sampat`, `Kshema`, and `Param Mitra` taras and *Pushkara Navamsha* grace.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `5th house` (progeny, nurturing), `9th house` (fortune through children, `5th from 5th`), `11th house` (fulfillment), `Jupiter` (*Naisargika Putrakaraka*), `PK` (*Jaimini Putrakaraka*), `A5` (*Putra Pada*), and `Santana/Putra Yogas` vs. `Saturn`/`Ketu`/`5th in 6-8-12` delays.
- **Divisional Charts (`D1`, `D9`, `D7`):** **`D7` (*Saptamsha*) is mandatory here**: inspects `D7 Lagna`, `D7 5th`, `D7 9th`, and `D7` lordships/dignities alongside `D1` `5th` and `D9` `5th`/`9th` (especially above `getD9MaturityAgeYears()`).
- **Dasha Systems:** Requires active MD/AD/PD (`resolveActiveMahadasha` + *Chara/Narayana Dasha* of `5th`/`D7 5th`) touching `5th lord`, `9th lord`, `Jupiter`, `PK`, or `D7` `5th`/`Lagna` lords, with `1/5/9` or `4/7/10` `AntardashaFruitionCell` support.
- **Transits (Gochara):** Checks `activateDoubleTransit` (`S6D`: **Jupiter + Saturn** influencing `D1` `5th house`, `5th lord`, or `D7 Lagna`), `Jupiter` transiting `1st`/`5th`/`9th`/`11th` from Lagna/Moon, and `SAV` bindus in `5th` and `9th`.
- **Tithi Pravesha (TP):** Checks `TP` `5th`, **`TP D7`** (`tpRowIn` for `D7`), `yearLord` link to `5th`/`Jupiter`, *Putra Saham* (`annual.sahams`), and `Muntha` in `5th`/`9th`/`11th`.

#### Google Search Trends Synthesis
Addresses deeply emotional searches (*"when will I have a baby astrology"*, *"children prediction birth chart"*, *"Saptamsha D7 child timing"*) with clinical sensitivity, branching automatically between family planning and active parenting.

#### Classical Attribution
- *BPHS* Ch. 16 (`5th` Putra Bhava) & Ch. 7 (*Saptamsha D7* for progeny)
- *Jaimini Upadesha Sutras* Ch. 1.3 (`Putrakaraka PK`, `A5`)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Saptamsha* odd/even reckoning & progeny timing
- *K.N. Rao* — Double Transit on `5th` house & *Putra Saham* in annual charts

---

### Card 21: Long-Term Longevity & Second Half of Life
- **Card Number:** `21`
- **Card Name:** `Long-Term Longevity & Second Half of Life`
- **Card Slug:** `marriage.longterm_longevity`
- **Subtitle:** `How your commitment deepens across decades and anchors shared resilience`
- **Default Placement:** Picker-available (`suggested: false`, promoted automatically to pinned for users with `ageYears > getD9MaturityAgeYears()` (`36+`)).

#### Area of Focus
Mapping how a committed partnership matures across decades—specifically contrasting early-life conditioning (`D1`) with the deeper dharmic container (`D9 Navamsha`) that governs the second half of life past Saturn's age-36 threshold.

#### Oracle Question
*"As your partnership matures into its next decade, how is your bond designed to deepen—and what shared values anchor its long-term resilience?"*
- **Window Grounding:** Anchors both the current multi-year Mahadasha arc (`1–10+ yr` horizon) and the active TP year, illustrating how earlier friction transforms or stabilizes post-36.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Dynamically branches at `ageYears > getD9MaturityAgeYears()` (`36`): for under-36, previews how the relationship matures over time; for over-36, centers `D1 + D9` mutual confirmation as lived reality.
- **Stance Resolution:** `build` when `D9` `Lagna`/`7th`/`UL` confirm `confirmed_strong` or `d9_redeemed` ("Trial to Mastery"); `get_through` with conscious structural reinforcement when `confirmed_weak` (*Drudha Karma*) or `d9_weakened` (*False Promise*) flags midlife drift.
- **4-Tier Behavioral Guidance:** *Sattvic:* Cultivate shared spiritual purpose, mutual respect, and quiet companionship as roles evolve; *Rajasic:* Co-design next-decade life goals (empty nest, retirement, legacy, relocation); *Mediocre:* Drift into parallel lives as roommates after early romance fades; *Baseline:* Become rigid or resentful when youthful illusions give way to mature reality.
- **Single Past-Event Calibration Question:** *"Looking back across the shift around your mid-30s (or [prior_decade_pivot_dates]), did what you truly need from a partner change in a lasting way?"*

#### Full-Circle Coverage
Evaluates the age-36 `D9` threshold (`isAgeMatureD9`) -> reconciles `D1` vs. `D9` via all 7 confirmation verdicts (Deep Diagnosis) -> charts the remaining Mahadasha trajectory & `UL` durability (Long Horizon) -> pairs with Card `#22` (Personal Soul Growth) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `D9` `Lagna` and `7th` nakshatras, *Vargottama* star alignments, and *Pushkara Navamsha* placements that bestow late-life healing grace even after early turbulence.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `8th house` (*Mangalya Bhava* / longevity of the marital tie), `UL` (*Upapada Lagna*) and `2nd from UL` durability, `7th lord`, `Jupiter`, `Venus`, and `Saturn` (time/endurance). Checks `D1` vs. `D9` *Vargottama* and *Neecha Bhanga* yogas.
- **Divisional Charts (`D1`, `D9`):** **Flagship `D9` Gate Card (`docs/reading-engine/76` §2.1–2.2):** Executes `isAgeMatureD9(ageYears)` (`ageYears > getD9MaturityAgeYears()`, default `36`) and `evaluateD1D9MutualConfirmation` across `7th lord`, `DK`, `Venus`, `Jupiter`, and `UL lord`:
  - `confirmed_strong` (+1.5/+1.0): Unshakeable multi-decade bedrock.
  - `d9_redeemed` (+1.2 *Neecha Bhanga via D9*): Early marital strain turns into gold after 36.
  - `d9_weakened` (-1.0 *False Promise*): Early effortless romance requires deliberate midlife re-anchoring.
  - `confirmed_weak` (-1.5 *Neecha Vargottama* / *Drudha Karma*): Fixed karmic tests requiring steady humility and zero complacency.
- **Dasha Systems:** Evaluates the **Remaining Largest Mahadasha Charter** (`selectCharterMahadasha`, `>= 10` yr macro horizon) + Five-Clocks concordance (`Narayana`/`Chara` of `D9`, `Vimshottari`, `Conditional`) to map the next 10–18 years of the marriage.
- **Transits (Gochara):** Tracks Saturn's 2nd return (~58–60) and half-return (~44), nodal returns (37.2, 55.8), and `Jupiter` cycles reinforcing `D9` `7th`/`9th`.
- **Tithi Pravesha (TP):** Evaluates `TP D9` (`tpRowIn(view, tp, 'D9')`) `Lagna` and `7th`, `yearLord`'s `D1+D9` confirmation, and long-term `Muntha` progression.

#### Google Search Trends Synthesis
Addresses mature, contemplative searches (*"will my marriage last forever astrology"*, *"second half of life marriage Navamsha"*, *"marriage changing after 35/40 astrology"*) by educating users intuitively on why bonds evolve after 36 without technical jargon.

#### Classical Attribution
- *BPHS* Ch. 6–7 (`D9` Navamsha), Ch. 19 (`8th` Mangalya longevity), Ch. 45 (*Graha Pakvata* age 36)
- *Phaladeepika* Ch. 20 (slokas 12–15, *Vargottama* & *Neecha Bhanga*)
- *Saravali* Ch. 4 (*Neecha Vargottama* vs. *Uccha Vargottama*)
- *docs/reading-engine/76* & `.agents/rules/vedic-d9-divisional-active-timing.md`

---

### Card 22: Your Role & Growth Inside Marriage
- **Card Number:** `22`
- **Card Name:** `Your Role & Growth Inside Marriage`
- **Card Slug:** `marriage.personal_growth`
- **Subtitle:** `Balancing lifelong devotion to the partnership with your own voice and growth`
- **Default Placement:** Picker-available (`suggested: false`).

#### Area of Focus
Balancing devotion to the partnership (`7th` / `DK`) with personal wholeness, individuality, and soul evolution (`1st` / `AK`) so marriage catalyzes mutual growth rather than self-erasure or ego dominance.

#### Oracle Question
*"What personal maturation or quiet balance between independence and devotion is this partnership asking of you during this cycle?"*
- **Window Grounding:** Anchors personal growth shifts in the active `AK`/`DK` and `1st–7th` axis dasha/TP periods (`"Personal growth focus: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `role` (`caregiver`, `breadwinner`, `balanced`) and `age_band` (`20s/30s` identity formation vs. `40s+` individuation).
- **Stance Resolution:** `build` (claim healthy creative/personal space alongside partnership) when `Lagna`/`AK`/`D9 Lagna` are strong; `get_through` (gentle boundary preservation without guilt) when `7th`/`12th` over-giving drains `Lagna`.
- **4-Tier Behavioral Guidance:** *Sattvic:* Grow alongside your partner—honor your own dharma while serving the union willingly; *Rajasic:* Carve out protected personal pursuits, friendships, and ambitions inside the marriage; *Mediocre:* Lose your voice to keep false peace, then quietly resent it; *Baseline:* Swing between total self-abandonment and selfish detachment.
- **Single Past-Event Calibration Question:** *"Around [ak_or_lagna_activation_dates], did you feel a strong pull to reclaim part of your own voice, purpose, or personal direction inside the relationship?"*

#### Full-Circle Coverage
Audits the `1st` (Self/`AK`) vs. `7th` (Other/`DK`) axis -> identifies whether the native over-merges or over-guards (Diagnosis) -> names current growth timing (Timeline) -> links back cleanly to Self (`/you`) and Friendships (`03`) cards to keep life whole (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `AK` (*Atmakaraka*), `DK` (*Darakaraka*), and `Lagna` nakshatras (`LagnaStar` in `StarProfile`); checks *Ishta Devata* / spiritual maturity notes (`9th`/`12th` from *Karakamsha* in `D9`) for how partnership refines the native's soul.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Inspects the **`1st–7th` axis** balance (`Lagna lord` dignity vs. `7th lord` dignity), **`AK`–`DK` relationship** (sign distance, mutual aspect, conjunction, or `6/8`/`2/12` tension), `AL` vs. `UL` (public identity vs. marital identity), and `Lagna lord` in `7th` (self defined through partner) vs. `7th lord` in `1st`.
- **Divisional Charts (`D1`, `D9`):** Compares `D1` `Lagna` (`Sthula` self) with **`D9` `Lagna`** (*Karakamsha* / *Swamsha* subtle self) and `D9` `7th`. Post-36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Lagna lord` and `AK` reveals whether the native's individuality strengthens (`confirmed_strong`/`d9_redeemed`) inside marriage.
- **Dasha Systems:** Checks when `AK`, `DK`, `Lagna lord`, or `9th lord` runs in MD/AD/PD (`resolveActiveMahadasha`)—noting *Dwisaptati Sama* applicability when `1st`/`7th` lords swap—and reads `AntardashaFruitionCell` (`1/5/9` integration vs. `6/8` identity friction).
- **Transits (Gochara):** Tracks `Saturn`, `Jupiter`, and `Rahu–Ketu` transiting `1st/7th` or over `AK`/`DK`, catalyzing major pivots in personal autonomy inside marriage.
- **Tithi Pravesha (TP):** Evaluates `TP Lagna` vs. `TP 7th`, `Muntha` in `1st` (self-renewal) vs. `7th` (partner focus), and `yearLord` relationship to `Lagna`/`AK`.

#### Google Search Trends Synthesis
Addresses modern relational psychology queries (*"losing identity in marriage astrology"*, *"personal growth inside partnership"*, *"Atmakaraka and Darakaraka compatibility"*) by blending Jaimini `AK–DK` soul-mirror philosophy with practical autonomy.

#### Classical Attribution
- *Jaimini Upadesha Sutras* Ch. 1.1–1.2 (`Atmakaraka AK`, `Darakaraka DK`, *Karakamsha*/*Swamsha*)
- *BPHS* Ch. 12 & Ch. 18 (`1st` Tanu Bhava vs. `7th` Kalatra Bhava balance)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Karakamsha* & `AL`/`UL` relationship
- *SOUL.md* §3 — Non-fatalistic growth elevation across all 4 behavioral tiers

---

## 4. Dashboard 02 Attribution & Source Catalog

| Source / Tradition | Author / Origin | Specific Sections / Concepts Applied | Role in Dashboard 02 |
|---|---|---|---|
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | Ch. 6–7 (`D2`, `D4`, `D7`, `D9`, `D30`), Ch. 13–23 (Bhavas `1,2,4,5,6,7,8,11,12`), Ch. 45 (*Graha Pakvata*), Ch. 46–51 | Core Bhava, Varga, and age-36 maturation architecture across Cards `#11`–`#22`. |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | Ch. 1.1–1.4 (`AK`, `PK`, `DK`, `GK`, `UL`, `2nd from UL`, `AL`, *Argala*, *Karakamsha*) | Marital container (`UL`), spouse/soul mirror (`DK`/`AK`), domestic interventions (`Argala`) across Cards `#11`–`#22`. |
| *Phaladeepika* | Mantreswara | Ch. 14–19, Ch. 20 (slokas 12–15 *Graha Pakvata*, *Vargottama*), Ch. 26 (*Gochara*) | Daily harmony, speech, `Neecha Bhanga`, and Saturn/Jupiter transits in Cards `#13`, `#14`, `#15`, `#21`. |
| *Saravali* | Kalyana Varma | Ch. 4 (*Neecha Vargottama*), Ch. 13–20 | Differentiation of `Neecha Vargottama` (*Drudha Karma*) vs. `Uccha Vargottama` in Card `#21` & age-36 gate. |
| *Uttara Kalamrita* | Kalidasa | Kanda 1, Varga 4–5 | `2nd` speech, `8th` partner's finances/in-laws, `6th` daily chores in Cards `#15`, `#18`, `#19`. |
| *Prasna Marga* | Panakkattu Namboodiri | Ch. 15–16 | Trust verification vs. hidden suspicion and repair prognosis in Cards `#16`, `#17`. |
| *Tithi Pravesha* & *Crux of Vedic Astrology* | Pt. Sanjay Rath | `yearLord`, `TP D9`, `TP D7`, `Muntha`, *Vivaha/Putra/Artha Sahams*, *Saptamsha* reckoning | Bounded annual timing, children (`D7`), and post-36 `D9` longevity in Cards `#11`, `#12`, `#20`, `#21`. |
| *Double Transit & Vimshottari Timing* | K.N. Rao | Double Transit of Jupiter & Saturn | Marriage timing (`#12`), children (`#20`), and multi-clock confirmation. |
| *Muhurta Chintamani* & *Lunar Astro / SOUL.md* | Daivajna Rama / Deepanshu Giri / Internal | Navatara/Tara Bala, `D9 H2` vs. `D9 H7` friction, `K64M`/`BB`, Rule 0, 4-Tier Playbook | Daily timing, conflict de-escalation, anti-sycophancy, and 4-tier prescriptions across all 12 cards. |
| *AIAstra Architecture & Search Research* | Internal Specs (`docs/reading-engine/75`, `76`, `78`, `80`) | `getD9MaturityAgeYears()`, `evaluateD1D9MutualConfirmation`, `TITHI_PRAVESHA_YEAR_RULE`, Search trends | Age-36 gate implementation, engine boundaries, and consumer marital query alignment. |
