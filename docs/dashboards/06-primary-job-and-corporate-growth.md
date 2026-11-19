# Dashboard 06: Primary Job & Corporate Growth (Employment, Advancement & Stamina)

**Document ID:** `docs/dashboards/06-primary-job-and-corporate-growth.md`  
**Board Route:** `/work` → Lens: `primary_job` (`work.status` = `employed` | `corporate` | `executive` | `job_seeking_experienced`)  
**Card Range:** Cards 45–55 (11 Cards)  
**Primary Divisional Charts:** `D10` (Dashamsha — core corporate arena), `D2` (Hora — compensation & cashflow), `D30` (Trimshamsha — burnout, politics & restructuring stress), `D24` (Siddhamsha — executive upskilling), `D4` (Chaturthamsha — relocation/remote base), `D9` (Navamsha — mandatory joint `D1+D9` gate at `ageYears > getD9MaturityAgeYears()`)  
**Engine & Data Boundary:** All planetary longitudes, divisional vargas, dashas, double transits, Ashtakavarga bindus, Arudha padas, Chara Karakas, and Tithi Pravesha rows are pre-computed by the external sidereal ephemeris engine and consumed from `kundli_digest` (`DigestView`) and `kundli_activation`. Node.js performs **zero** astrological calculations.

---

## 1. Domain Architecture & Full-Circle Coverage Guarantee

The **Primary Job & Corporate Growth** dashboard serves salaried professionals, specialists, managers, and executives operating inside structured organizations. Unlike early-career launch (`05`) or entrepreneurial risk (`08`), corporate employment operates on distinct Jyotish mechanics:

1. **The Service-Status-Reward Triangle (`6th` ↔ `10th` ↔ `11th` in `D1` & `D10`):** Daily service, deliverables, deadlines, and competition live in the **6th house**; formal title, executive visibility, and authority live in the **10th house** (`A10` / Sun); salary increments, bonuses, and equity payouts live in the **11th** and **2nd** houses (`D2` Hora).
2. **Amatyakaraka (`AmK`) & `D1 + D10` Polarity Agreement:** Active career execution depends on whether the natal *Amatyakaraka* and running Mahadasha/Antardasha lords enjoy dignity and structural support inside **`D10` (Dashamsha)** (`work.d10_check`).
3. **Age-36 Navamsha (`D9`) Co-Equal Gate:** Mid-career professionals (`ageYears > getD9MaturityAgeYears()`, default `36`) live directly inside the mutual confirmation of **`D1 + D9 + D10`**. A glamorous `D1` 10th-house yoga that collapses in `D9` (*False Promise*, `d9_weakened`) manifests as mid-career plateauing or sudden organizational misalignment; conversely, *Neecha Bhanga via D9* (`d9_redeemed`) powers hard-won senior executive breakthroughs after 36.
4. **Full-Circle Coverage Matrix (11 Cards):**
   - **Stability, Security & Transitions:** Cards **45** (*Where Your Job Stands*), **46** (*Job Security & Layoff Risk*), **47** (*Should You Stay or Change Jobs?*), and **53** (*Switching Industries or Roles*).
   - **Financial Upside, Advancement & Upskilling:** Cards **48** (*Promotions, Titles & Recognition*), **49** (*Salary, Bonuses & Cashflow*), and **55** (*What Skill to Build Next*).
   - **Burnout, Politics & Leadership Command:** Cards **50** (*What Wears You: Burnout & Heavy Load*), **51** (*Bosses, Leadership & Politics*), and **52** (*Leading Teams & Authority*).
   - **Geography & Remote Freedom:** Card **54** (*Work Abroad & Remote Flexibility*).

### Default Pinned Cards & Sub-Technique Architecture
- **Default Pinned Starter Deck (5 Cards):** `job.pulse` (45), `job.security_layoff` (46), `job.stay_or_leave` (47), `job.promotion_recognition` (48), `job.salary_bonuses` (49).
- **Card Picker Deck (Contextual / Role-Triggered):** `job.burnout_load` (50), `job.boss_politics` (51), `job.leading_teams` (52), `job.industry_switch` (53), `job.remote_abroad` (54), `job.skill_building` (55).
- **Deterministic Sub-Technique Pipeline:** `work.sub.primary_job_ledger` executes once per `(kundliId, digest_version, asOf)`, computing `D1 + D9 + D10 + D2 + D30 + D24 + D4` ledgers, active 40+ dasha routing, Five Clocks Concordance, and bounded TP containers into `technique_outputs`. Grouped LLM synthesis uses stable `parts[0]` prefix caching ($\ge 1,024$ tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and participates in 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES=45`).

---

## 2. Dashboard-Wide Rules: Age-36 Gate, Multi-Clock Dashas & Bounded Tithi Pravesha

1. **Age-36 Navamsha (`D9`) Gate (`getD9MaturityAgeYears()`, default `36`):**
   - When `ageYears > getD9MaturityAgeYears()`, **every** active dasha lord (`MD`/`AD`), annual TP `yearLord`, and career significator (`AmK`, 10th lord, 6th lord) **must** pass `evaluateD1D9MutualConfirmation` alongside `D10`:
     - *Neecha Vargottama* (`confirmed_weak`, `-1.5`, *Drudha Karma*): Persistent structural ceiling unless mitigated through Sattvic discipline.
     - *Exalted/Own Vargottama* (`confirmed_strong`, `+1.5`): Enduring executive authority and promotion stability.
     - *Neutral/Friendly Vargottama* (`confirmed_strong`, `+1.0`): Reliable corporate resilience.
     - *Neecha Bhanga via D9* (`d9_redeemed`, `+1.2`): Early-career struggle transforming into seasoned post-36 mastery.
     - *False Promise* (`d9_weakened`, `-1.0`): Strong early resume failing under senior political or endurance stress.
   - Pre-36 (`ageYears <= threshold`) weights `D1 + D10` primary with `D9` advisory; missing birth date records `age_unresolved` and fails closed.
2. **Active 40+ Dasha Systems & 9x9 Fruition Matrix:**
   - Resolves `resolveActiveMahadasha` across conditional dashas (especially *Chaturashiti Sama* when 10th lord sits in 10th), *Vimshottari*, *Narayana/Chara*, and *Yogini*. Inspects the 9x9 Antardasha-from-Mahadasha Fruition Matrix (`AntardashaFruitionCell`) and 5-system Planetary Avasthas (Baladi/Jagradadi multipliers `0.10x–1.00x`).
3. **Bounded Annual Tithi Pravesha (`TITHI_PRAVESHA_YEAR_RULE`):**
   - All 12-month periods strictly occupy `[tp_start, tp_end]` ($\le 400$ days), driven by `runningTithiPravesha` and `tpRowIn(view, tpInfo, 'D10')` / `'D2'` / `'D30'`. Zero Gregorian `01-01` .. `12-31` fallbacks. Unresolved `yearLord` or contested concordance fails closed to `stance = 'get_through'`.
4. **Anti-Sycophancy Disambiguation (`SOUL.md` Rule 0) & Plain-English Surface:**
   - Multiple workplace counterparties (skip-level executive vs direct manager vs rival peer vs subordinate) are never collapsed into one generic "Saturn boss"; each is disambiguated across `D10` 10th, 9th, 6th, and 5th houses + Arudhas. Zero Sanskrit jargon or internal engine names on `ReadFace`/`ShortFace`; all technical keys sit inside `evidence[]` for **Chart details**.
5. **Implementation Dependencies (`FACT_CATALOG`, `SERVED_VARGAS`, `ANNUAL_CHART_VARGAS`):**
   - **`FACT_CATALOG` (`src/profile/facts.ts`):** `FACT_CATALOG` currently restricts `'work.status'` to `['yes', 'between_jobs', 'own_business', 'studying', 'retired']` and `'work.level'` to `['hourly', 'employee', 'specialist', 'manager', 'senior_leader', ...]`. Semantic tags in this spec (`employed`, `corporate`, `executive`, `job_seeking_experienced`) map onto `work.status` (`yes`, `between_jobs`) + `work.level`, with optional sub-context keys (`work.role`, `work.tenure`) requiring additive `FACT_CATALOG` updates before `checkFact` persistence.
   - **`SERVED_VARGAS` & `ANNUAL_CHART_VARGAS`:** `src/reading/chartData/catalog.ts:133` currently sets `SERVED_VARGAS = {1, 2, 4, 7, 9, 10}` and `src/reading/digest/annualSet.ts:11` sets `ANNUAL_CHART_VARGAS = [1, 9, 10]`. Live `D24`/`D30` natal pulls and divisional TP pulls beyond `D1`/`D9`/`D10` (`tpRowIn` for `D2`, `D4`, `D24`, `D30`) depend on `docs/reading-engine/80` R1–R4; until unlocked, ledgers degrade gracefully to served `D1 + D9 + D10 + D2 + D4`.

---

## 3. Complete Card Specifications (Cards 45–55)

---

### Card 45: Where Your Job Stands (12-Month Pulse)
- **Card Key:** `job.pulse`
- **Subtitle:** `Seasons of corporate momentum, consolidation, and pressure across your year`
- **Default Placement:** Pinned (Starter Card #1) | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
The executive 12-month operational weather report for primary employment—synthesizing quarters of upward visibility, routine grind, restructuring noise, and compensation openness.

#### Oracle Question
> "What is the overarching operational rhythm of your primary job across your upcoming 12-month cycle, and which dated stretches call for bold visibility versus quiet consolidation?"

#### Personalizer Goal & Stance
- **Goal:** Give busy professionals a calm quarterly roadmap tailored to `person_facts` (`work.role`, `work.seniority`, `age_band`). Replace vague anxiety with 3–6 clearly bounded `PeriodStrip` windows.
- **Stance Logic:**
  - `build`: Triggered when TP `yearLord` is strong in `D1`/`D10`, active MD/AD passes `evaluateD1D9MutualConfirmation` (post-36) and occupies Kendra/Trikona/Upachaya in `D10`, and Five Clocks Concordance is `confirmed` ($\ge 3$). Encourages pitching initiatives, networking upward, and seeking high-visibility projects.
  - `get_through`: Triggered when `yearLord` is unresolved or weak in `D10` 6th/8th/12th, AD sits in `6/8` or `2/12` from MD, or clocks are `contested`. Advises protecting deliverables, documenting wins, and conserving energy until the stated shift date.

#### Full-Circle Coverage
1. **Trigger:** Annual planning, performance-review preparation, or wanting a big-picture check on career weather.
2. **Evidence & Diagnosis:** Intersects macro MD/AD (`D1 + D9 + D10`) with the current `[tp_start, tp_end]` TP `D10` container.
3. **Behavioral Action:** Segments the year into 3–6 `PeriodStrip` stretches and `KeyDates` (`<= 6`) with 4-tier executive conduct.
4. **Resolution:** Routes deeper into Card 46 (if turbulence appears), Card 47 (if exit doors open), or Card 48 (if promotion windows shine).

#### Single Past-Event Calibration Question
> "Looking back over the past 6 to 9 months at work, did a sudden shift in team priorities, reporting lines, or workload alter what your role required of you day to day?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Deliver consistently on core commitments regardless of corporate noise, building quiet trust across both supportive and heavy quarters.
- **Rajasic (Pragmatic Leverage):** Schedule flagship proposals, visibility demos, and cross-functional asks inside `build` windows; execute backend cleanup and documentation during `get_through` stretches.
- **Mediocre (Passive/Mixed):** React emotionally to daily Slack/email turbulence, over-committing during low-stamina stretches and coasting during open windows.
- **Baseline (Zero-Loss Floor):** Maintain crisp written status updates and healthy sleep/recovery boundaries all year so small administrative missteps never compound.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates `D10` Lagna cusp star, `D10` 10th cusp star, and active MD/AD lord nakshatras against natal Moon via `StarProfile.taras`. Periods ruled by stars in **Sampat** (2), **Kshema** (4), **Sadhaka** (6), **Mitra** (8), or **Param Mitra** (9) smooth organizational friction; **Vipat** (3), **Pratyak** (5), or **Vadha** (7) signal sudden policy or stakeholder pushback.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Evaluates `D1` & `D10` 6th (daily service/execution), 10th (role/authority), and 11th (rewards/allies), plus `AmK` (Amatyakaraka), `A10` (Rajya Pada — corporate standing), and `AL` (public prestige). Checks *Amala Yoga* (natural benefic in 10th from Lagna/Moon — ethical reputation) and *Raja/Dhana Yogas* linking 6th/10th/11th.
- **Divisional Charts (`D1`, `D10`, `D9`):**
  - Core check: `work.d10_check` polarity between `D1` 10th and `D10` Lagna/10th.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, enforces `evaluateD1D9MutualConfirmation` on active MD/AD lords, `AmK`, and `10th lord` (`confirmed_strong` `+1.5` vs *Neecha Vargottama* `-1.5` vs *False Promise* `-1.0`).
- **Dasha Systems:** Runs `resolveActiveMahadasha` across all 40+ systems (prioritizing *Chaturashiti Sama* if applicable, then *Vimshottari*, *Narayana*, *Yogini*). Applies 9x9 Matrix (`AntardashaFruitionCell`) and Baladi/Jagradadi Avasthas (`0.10x–1.00x`) to see whether the active AD lord delivers directly or requires its dispositor/nakshatra lord.
- **Transits (Gochar) & Ashtakavarga:** Tracks Jupiter and Saturn double transit (`S6D`) on `D1` 10th/6th/11th and `D10` 10th, Saturn's 2.5-year position relative to Moon (*Sade Sati* / *Kantaka Shani* over 10th), and `HouseCard.sav` ($\ge 30$ absorbs corporate reorganization smoothly; $< 25$ requires cautious pacing).
- **Tithi Pravesha (TP):** Inspects `runningTithiPravesha` (`AnnualRow.yearLord`, TP Lagna, Muntha in 6/10/11 vs 8/12, *Karya Siddhi* & *Rajya* Sahams), `tpRowIn(view, tpInfo, 'D10')`, and *Tithi Ashtottari* periods within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Captures broad annual career-check queries (*"job horoscope 2026/2027"*, *"corporate career forecast"*, *"work life this year astrology"*). Salaried workers want a seasonal map—knowing ahead of time which quarters favor bold moves and which quarters demand protective execution.

#### Classical Attribution
- *BPHS* Ch. 7 (`D10` Dashamsha), Ch. 17 & 20 (6th & 10th Bhavas), Ch. 46–51 (Multi-clock dashas).
- *Tithi Pravesha: Vedic Annual Horoscopy* (Pt. Sanjay Rath) — Annual TP container, `yearLord`, and `TP D10`.
- *Phaladeepika* Ch. 19 & 26 (10th house *Karmabhava* and Gochar transits).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`AmK`, `A10`, `AL`).

---

### Card 46: Job Security & Layoff / Restructuring Risk
- **Card Key:** `job.security_layoff`
- **Subtitle:** `Organizational stability around your role, and dates calling for quiet readiness`
- **Default Placement:** Pinned (Starter Card #2) | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
Objective evaluation of corporate restructuring, role elimination, contract non-renewal, and organizational turbulence—distinguishing false-alarm anxiety from genuine structural risk windows.

#### Oracle Question
> "How stable is the organizational ground beneath your current role over the next 12 months, and which specific dated stretches call for quiet contingency readiness?"

#### Personalizer Goal & Stance
- **Goal:** Eliminate paralyzing layoff dread while respecting real risk windows (`person_facts`: `work.industry`, `work.tenure`). Never issue catastrophic verdicts; instead translate risk indicators into calm, proactive preparation dates (emergency fund, resume refresh, warm network check-ins).
- **Stance Logic:**
  - `build`: Strong `D10` 6th/10th/11th, `SAV >= 30`, no 8th/12th disruption, and solid TP `yearLord`. Reassures the user that their seat is structurally durable even amidst industry headlines.
  - `get_through`: Active 8th (sudden severance/termination) or 12th (loss of position) activation in `D10`, Rahu/Ketu/Saturn hitting 10th/6th, or *Dasha Sandhi* / *Neecha Vargottama* pressure. Triggers a protective preparation timeline with exact dates when vulnerability clears.

#### Full-Circle Coverage
1. **Trigger:** Industry layoff rumors, budget freezes, leadership changes, or personal fear of losing a role.
2. **Evidence & Diagnosis:** Distinguishes *real* termination/transition vectors (8th/12th in `D10` + *Sade Sati*/*Ashtama Shani* + `6/8` AD) from routine 6th-house workload pressure.
3. **Behavioral Action:** Provides dated vigilance windows and 4-tier career-insurance behaviors.
4. **Resolution:** Hands off smoothly to Card 47 (*Should You Stay or Change Jobs?*) if an exit or proactive pivot is warranted, or Card 48 once stability returns.

#### Single Past-Event Calibration Question
> "Within the last 12 to 18 months, did your company or department go through a reorganization, leadership shakeup, or budget tightening that forced roles around you to shift?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Anchor security in transferable skill excellence and ethical reliability rather than attachment to a single company org chart.
- **Rajasic (Pragmatic Leverage):** Keep a 6-month liquidity cushion, document quantified impact metrics quarterly, and keep warm external recruiter/peer relationships alive before you ever need them.
- **Mediocre (Passive/Mixed):** Ignore clear restructuring signals out of comfort, or spiral into daily rumor-watching that tanks current performance.
- **Baseline (Zero-Loss Floor):** Never confront leadership impulsively or resign without an offer/runway during a turbulent 8th/12th transit; protect severance and documentation cleanly.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks active MD/AD/PD lords and transiting malefics falling in **Vipat** (3/12/21), **Pratyak** (5/14/23), or **Vadha** (7/16/25) Taras from Moon's Janma Nakshatra. Inspects transits over **64th Navamsa (`D1.K64M`, `D1.K64L`)**, **22nd Drekkana (`D1.KD22`)**, and **Bhrigu Bindu (`D1.BB`)**—classic triggers for abrupt role termination or restructuring.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Examines **8th house** (sudden severance, organizational collapse, breaks in service) and **12th house** (loss of role/stepping back) relative to **6th** (employment) and **10th** (status). Checks `A10` affliction by Saturn/Rahu/Ketu, *Maraka* or *8th-lord* links to `AmK`, and whether **Viparita Raja Yoga** turns a company layoff into a sudden better role/severance upgrade.
- **Divisional Charts (`D10`, `D30`, `D1`, `D9`):**
  - Primary diagnostic in **`D10` (Dashamsha)** (8th/12th houses and `D10` Lagna lord strength) paired with **`D30` (Trimshamsha)** (hidden structural vulnerability, institutional scapegoating).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on active dasha lords and 10th lord. *False Promise* (`d9_weakened`) warns that a glittering title lacks structural insulation during downturns; `confirmed_strong` provides deep tenure resilience.
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` for **8th/12th lord** MD/AD/PD, **Dasha Sandhi** (final 6 months of a Mahadasha), or 9x9 Matrix **Shadashtaka (`6/8`)** / **Dwirdwadasha (`2/12`)** friction. Cross-checks *Narayana Dasha* entering 8th/12th from Lagna/`AL` and *Yogini* (*Ulka* Saturn / *Sankata* Rahu).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Ashtama Shani** (Saturn 8th from Moon), **Kantaka Shani** (Saturn 10th from Lagna/Moon), **Sade Sati**, and **Rahu-Ketu** crossing the 4th/10th or 6th/12th axes. Inspects `D1` 10th/6th `HouseCard.sav` ($< 25$ bindus = low structural buffer; $\ge 30$ = high retention buffer) and Saturn's `BAV` ($\le 2$ = heavy friction).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` and `tpRowIn(view, tpInfo, 'D30')`, checking if `AnnualRow.yearLord` sits in 6th/8th/12th or *Mrityu/Vyaya* Saham triggers inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses urgent anxiety-driven searches (*"will I get laid off astrology"*, *"job security horoscope"*, *"company restructuring career birth chart"*). During tech/corporate contraction cycles, users crave honest risk triage with exact preparation dates rather than empty platitudes or fatalistic doom.

#### Classical Attribution
- *BPHS* Ch. 7 (`D10` & `D30`), Ch. 19 & 23 (8th house breaks/interruptions and 12th house losses).
- *Prasna Marga* Ch. 15–16 & 28 (Loss of position, hidden organizational instability, SAV filtering).
- *Lunar Astro / Deepanshu Giri* (*Predicting Through Nakshatras*) — `K64M`/`K64L`, `KD22`, and `BB` transit triggers for sudden job shifts.
- *Phaladeepika* Ch. 20 & 26 (Dasha Sandhi, Ashtama Shani, and Kantaka Shani transitions).

---

### Card 47: Should You Stay or Change Jobs?
- **Card Key:** `job.stay_or_leave`
- **Subtitle:** `Timing an external move, resume campaign, or strategic stay`
- **Default Placement:** Pinned (Starter Card #3) | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive', 'job_seeking_experienced']`

#### Area of Focus
Evaluating the exact trade-off between staying to consolidate inside a current employer versus launching an external interview campaign, resigning, and onboarding elsewhere.

#### Oracle Question
> "Is your chart aligned right now for launching an external job switch, or does staying put to consolidate deliver better rewards until a cleaner transition window opens?"

#### Personalizer Goal & Stance
- **Goal:** Prevent premature rage-quitting during temporary friction while giving clear green-light windows when an external switch genuinely upgrades status and pay (`person_facts`: `work.considering_change`, `work.tenure`).
- **Stance Logic:**
  - `build`: Active transition from 8th/3rd (leaving/initiating) into 10th/11th (new seat/higher income) across `D1 + D10`, supported by Jupiter/Saturn double transit and strong TP `yearLord`. Green-lights active interviewing and negotiating an exit.
  - `get_through`: Active 12th/6th confusion without 10th/11th landing support, retrograde Mercury/Mars muddling contract terms, or `contested` Five Clocks. Advises updating materials quietly and waiting for the dated landing window before handing in notice.

#### Full-Circle Coverage
1. **Trigger:** Feeling underpaid, bored, or frustrated and debating whether to stay or jump ship.
2. **Evidence & Diagnosis:** Compares *departure signals* (3rd/8th/12th in `D10`) against *landing signals* (6th/10th/11th in `D10` + `D2`).
3. **Behavioral Action:** Maps discrete "Prepare / Interview / Notice-Period" phases on `PeriodStrip` with 4-tier transition strategy.
4. **Resolution:** Flows into Card 48/49 (if staying/promoted) or Card 53 (if pivoting industries entirely).

#### Single Past-Event Calibration Question
> "In your last major role change or job switch, did the move happen right around a clear shift in leadership, project completion, or sudden inner restlessness?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Leave cleanly with gratitude, integrity, and well-documented handoffs so your reputation remains an asset for years.
- **Rajasic (Pragmatic Leverage):** Never resign purely to escape; wait until you have a signed, verified offer aligned with an open landing window and clear compensation upside.
- **Mediocre (Passive/Mixed):** Vent about leaving for months without interviewing, or accept the first lateral escape offer just to feel movement.
- **Baseline (Zero-Loss Floor):** Never burn notice-period bridges or overlook non-compete/vesting cliff dates during emotional frustration.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks whether the active AD/PD lord occupies a **Chara (Movable)** nakshatra (favoring mobility and switching) vs **Sthira (Fixed)** nakshatra (favoring tenure consolidation). Inspects *Tara Bala* (`StarProfile.taras`) for the exact weeks of submitting applications (**Sadhaka/Mitra**) vs signing final offers (**Sampat/Param Mitra**).
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Maps the classical switch sequence: **3rd house** (courage to initiate/leave) + **8th house** (ending current contract) + **10th/11th houses** (securing the new seat and raise). Evaluates `AmK` and `A10` (public career jump) and checks whether **2nd/11th** confirm real financial upgrade over a purely horizontal move.
- **Divisional Charts (`D10`, `D2`, `D1`, `D9`):**
  - Requires `D10` 10th/11th/6th activation for a successful external landing; if only `D10` 8th/12th is active without 11th/10th support, switching risks jumping into another turbulent seat. Checks `D2` (Hora) to confirm pay progression.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on both current dasha lord and incoming AD lord; switching during a *d9_weakened* sub-period requires extra due diligence on the prospective employer's stability.
- **Dasha Systems:** Looks for **AD/PD transitions** inside `resolveActiveMahadasha` (e.g., exiting a heavy Saturn/Ketu AD into a Mercury/Venus/Jupiter/10th-lord AD) and 9x9 Fruition Matrix shifts from `6/8/12` to `1/5/9/10/11`. Cross-checks *Narayana Dasha* sign change and *Yogini* transitions.
- **Transits (Gochar) & Ashtakavarga:** Tracks `activateDoubleTransit` (`S6D`) touching `D1` 10th/11th or `D10` Lagna/10th, Jupiter transiting 2nd/6th/10th/11th from Moon/Lagna, and Rahu/Ketu crossing the 1st/7th or 4th/10th axis (classic job-change catalyst).
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` for 3rd/10th/11th activation, *Karya Siddhi* Saham, Muntha in 3rd/10th/11th, and Tithi Ashtottari sub-period handoffs within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Directly serves one of the highest-volume career astrology clusters (*"should I quit my job astrology"*, *"best time to change jobs 2026/2027"*, *"when will I find a new job horoscope"*). Working adults want clarity on whether frustration means "stick it out for a promotion" or "polish the resume now."

#### Classical Attribution
- *BPHS* Ch. 14–21 (3rd, 6th, 8th, 10th, 11th houses in vocational shifts).
- *Timing Events Through Vimshottari Dasha* (K.N. Rao) — Dasha transitions + double transit triggers for job changes.
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` house-by-house reading for service transitions.
- *Muhurta Chintamani* — Movable vs Fixed nakshatras and Tara Bala for career transitions.

---

### Card 48: Promotions, Titles & Recognition
- **Card Key:** `job.promotion_recognition`
- **Subtitle:** `When visibility peaks for title bumps, awards, and executive credit`
- **Default Placement:** Pinned (Starter Card #4) | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
Timing upward mobility, title upgrades, public institutional recognition, award nominations, and securing credit for high-leverage work.

#### Oracle Question
> "During which upcoming dated windows is your work most visible to decision-makers, supporting a formal push for promotion, title elevation, or executive recognition?"

#### Personalizer Goal & Stance
- **Goal:** Guide the user (`person_facts`: `work.role`, `work.promotion_target`) on *when* to make their case during review cycles and *how* to ensure their contributions are attributed cleanly rather than swallowed quietly behind the scenes.
- **Stance Logic:**
  - `build`: Sun/Jupiter/10th-lord/`A10` activation in `D1 + D10`, confirmed by TP `yearLord` and `confirmed_strong` D9 (post-36). Encourages initiating promotion conversations, presenting flagship outcomes, and claiming executive scope.
  - `get_through`: Saturn/Ketu dampening `A10` or `12th` house swallowing credit, or `d9_weakened` / `get_through` TP year. Advises building indisputable documentation and waiting for the named visibility peak before forcing a title ask.

#### Full-Circle Coverage
1. **Trigger:** Upcoming annual review cycle, feeling passed over for promotion, or eyeing a director/VP/staff-level step.
2. **Evidence & Diagnosis:** Evaluates `Sun` (authority), `Jupiter` (grace/title), `10th house`, `11th house`, and **`A10` (Rajya Pada)** across `D1` and `D10`.
3. **Behavioral Action:** Maps peak review/visibility dates (`KeyDates`) and delivers 4-tier executive positioning steps.
4. **Resolution:** Connects directly into Card 49 (*Salary, Bonuses & Cashflow*) and Card 52 (*Leading Teams & Authority*).

#### Single Past-Event Calibration Question
> "Thinking back 1 to 2 years, did a project where you did heavy foundational work end up getting recognized much later—or did someone else briefly capture credit before your value became clear?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Lead with undeniable substance and generosity toward teammates so authority settles onto you naturally through respect.
- **Rajasic (Pragmatic Leverage):** Proactively schedule pre-review alignment meetings during supportive windows, translating technical/operational wins into leadership's KPIs.
- **Mediocre (Passive/Mixed):** Assume hard work speaks for itself in total silence, then grow resentful when louder peers receive the title.
- **Baseline (Zero-Loss Floor):** Never issue ultimatums or publicly undermine superiors when a promotion cycle slips by a quarter; gather clear feedback and time the next push cleanly.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Inspects the nakshatra of `10th lord`, `Sun`, and `A10` in `D1` and `D10`. Sun-ruled stars (*Krittika, Uttara Phalguni, Uttara Ashadha*) and Jupiter-ruled stars (*Punarvasu, Vishakha, Purva Bhadrapada*) amplify executive elevation when activated under **Sadhaka** (6), **Mitra** (8), or **Param Mitra** (9) Taras.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Focuses on **10th house** (title/throne), **11th house** (fulfillment of rank), **9th house** (executive sponsorship/grace), **`A10` (Rajya Pada)**, **`AL` (public image)**, and **Sun** (*Dig Bala* in 10th). Checks *Dharmakarmadhipati Raja Yoga* (9th–10th), *Gaja Kesari Yoga*, and *Panchamahapurusha* (*Sasa*, *Hamsa*, *Bhadra*, *Ruchaka*, *Malavya*) in Kendra of `D1` or `D10`.
- **Divisional Charts (`D10`, `D1`, `D9`):**
  - Requires `D10` 10th/1st/11th alignment and strong `A10` in `D10`. If `D10` 10th is strong while `D1` 10th is modest, promotion arrives through earned operational delivery rather than politics.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, `evaluateD1D9MutualConfirmation` on Sun, 10th lord, and active MD/AD lords determines whether senior titles hold long-term (`confirmed_strong` `+1.5`, `d9_redeemed` `+1.2`) or stall at middle-management (`d9_weakened` `-1.0`, `confirmed_weak` `-1.5`).
- **Dasha Systems:** Checks `resolveActiveMahadasha` (including *Chaturashiti Sama* when 10th lord is in 10th) for MD/AD/PD of 9th, 10th, or 11th lords, *Yogakaraka*, or `A10` lord. Evaluates 9x9 Fruition Matrix (`1/5/9` and `4/7/10` from MD) and Jagradadi *Jagrat* (`1.00x`) delivery multiplier.
- **Transits (Gochar) & Ashtakavarga:** Monitors `activateDoubleTransit` (`S6D`) onto `D1` 10th/11th and `D10` 10th/1st; Jupiter transiting 10th/11th/1st from Lagna or Moon; Sun's monthly transit through 10th/11th for exact promotion-announcement weeks. Checks `D1` & `D10` 10th/11th `HouseCard.sav` ($\ge 30$ strong elevation).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` for `yearLord` aspecting 10th/11th, *Yashas* (fame/honor) & *Rajya* Sahams, Muntha in 10th/11th, and peak *Tithi Ashtottari* periods inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Directly addresses perennial career-advancement searches (*"when will I get promoted astrology"*, *"career recognition horoscope"*, *"asking for a promotion transit"*). High-performing employees want to know *when* leadership visibility aligns so they ask for elevation when decision-makers are receptive.

#### Classical Attribution
- *BPHS* Ch. 20 (10th house *Rajya Bhava*), Ch. 34–41 (*Raja Yogas* & *Panchamahapurusha Yogas*).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A10` Rajya Pada, `AL` Arudha Lagna, `AmK`).
- *Phaladeepika* Ch. 6 & 19 (Sun/Jupiter elevation yogas and 10th house authority).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Yashas* & *Rajya* Sahams and `TP D10` elevation triggers.

---

### Card 49: Salary, Bonuses & Cashflow
- **Card Key:** `job.salary_bonuses`
- **Subtitle:** `Merit increases, equity vests, thin stretches, and compensation growth`
- **Default Placement:** Pinned (Starter Card #5) | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
Earned compensation dynamics inside employment—base salary negotiations, annual performance bonuses, RSU/equity vesting, and pacing personal spending through tight liquidity quarters.

#### Oracle Question
> "What is the financial trajectory of your employment compensation over the next 12 months, and when are raises, bonuses, or liquidity inflows most strongly supported?"

#### Personalizer Goal & Stance
- **Goal:** Provide grounded financial timing (`person_facts`: `work.comp_structure`, `work.financial_focus`) so the user maximizes negotiation timing during high-inflow windows and avoids over-committing fixed expenses during lean cashflow months.
- **Stance Logic:**
  - `build`: 2nd/11th lords + `D2` (Hora) + `D10` 11th aligned with Jupiter/Venus support and strong TP `yearLord`. Advises proactive compensation benchmarking, negotiation, and long-term asset allocation.
  - `get_through`: 12th-house expenditure spikes, `2/12` AD strain, or contested TP *Artha* markers. Advises conservative budgeting, delaying non-essential fixed debt, and guarding against delayed bonus payouts.

#### Full-Circle Coverage
1. **Trigger:** Preparing for compensation review, evaluating equity upside, or feeling squeezed by stagnant wages/inflation.
2. **Evidence & Diagnosis:** Integrates **2nd house** (accumulated savings), **11th house** (salary/bonus inflow), **`D2` (Hora)** (wealth retention), and **`D10` 11th** (earned career rewards).
3. **Behavioral Action:** Maps peak inflow vs cautious cash-conservation periods (`PeriodStrip`) with 4-tier compensation habits.
4. **Resolution:** Connects naturally to Card 47 (if current employer ceiling requires an external jump) or Card 48 (pairing title with pay).

#### Single Past-Event Calibration Question
> "Over the past year, did an expected bonus, raise, or payout arrive slightly later or in a different form than originally promised—or arrive smoothly right when cash was needed?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Negotiate fair value for honest contribution without greed, and direct surplus cashflow toward family security and calm generosity.
- **Rajasic (Pragmatic Leverage):** Enter compensation talks armed with market comps and quantified revenue/cost impact during supportive *Sampat/Sadhaka* windows.
- **Mediocre (Passive/Mixed):** Accept below-market pay out of discomfort with negotiation, then overspend impulsively when a bonus finally lands.
- **Baseline (Zero-Loss Floor):** Never base fixed monthly lifestyle commitments on unvested equity or discretionary bonus targets during a `get_through` financial window.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates nakshatras of 2nd and 11th lords, Jupiter (*Dhana Karaka*), and Venus. Active periods in **Sampat** (2/11/20 — literally "wealth") Taras from Janma Nakshatra catalyze raises, arrears, and unexpected bonuses; **Vipat** (3) or **Vadha** (7) signal tax/deduction surprises or delayed payouts.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Checks **2nd house** (bank balance/savings), **11th house** (recurring salary/bonus cashflow), **5th/9th houses** (equity/bonus windfalls), **`A2`** and **`A11` (Labha Pada)**. Evaluates *Dhana Yogas* (1/2/5/9/11 lord linkages) and *Daridra/12th drains* (2nd/11th lords sitting in 6/8/12 without Neecha Bhanga).
- **Divisional Charts (`D2`, `D10`, `D1`, `D9`):**
  - Core wealth varga: **`D2` (Hora)**—evaluating Sun Hora (self-earned, active executive pay) vs Moon Hora (steady, collaborative, passive/savings accumulation) and benefics in 2nd/11th of `D10`.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, verifies `evaluateD1D9MutualConfirmation` on 2nd/11th lords and Jupiter (`confirmed_strong` locks in compounding wealth; `d9_weakened` warns against lifestyle inflation).
- **Dasha Systems:** Tracks `resolveActiveMahadasha` activating 2nd/11th/5th/9th lords or Dhana-Yoga participants, checking 9x9 Matrix **Dhana & Labha (`2/11` from MD)** vs **Dwirdwadasha (`2/12` cash leakage)** and Baladi Avastha delivery (`Yuva 1.00x` vs `Vriddha/Mrita`).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting 2nd, 5th, 9th, or 11th from natal Moon/Lagna; **Saturn** transiting 11th/3rd (slow, steady compounding raises); and `HouseCard.sav` comparison between **11th house (income)** and **12th house (expense)**—classical rule: `11H SAV > 12H SAV` guarantees net surplus.
- **Tithi Pravesha (TP):** Checks **Artha Saham** (wealth), **Labha Saham**, `tpRowIn(view, tpInfo, 'D2')` and `tpRowIn(view, tpInfo, 'D10')` 2nd/11th houses, and `yearLord` connection to wealth houses across `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses direct monetary career queries (*"when will I get a raise astrology"*, *"bonus prediction birth chart"*, *"salary increase horoscope 2026/2027"*). Salaried workers need realistic expectations distinguishing high-leverage compensation negotiation periods from tight corporate budget freezes.

#### Classical Attribution
- *BPHS* Ch. 7 (`D2` Hora), Ch. 13 & 21 (2nd *Dhana* and 11th *Labha* Bhavas), Ch. 35 (*Dhana Yogas*), Ch. 66–72 (Ashtakavarga 11H vs 12H surplus rule).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Jupiter/Venus wealth karakatvas and bonus/equity gains).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Artha Saham* and `TP D2` annual cashflow assessment.
- *Phaladeepika* Ch. 14 & 26 (2nd/11th fruition and Jupiter Gochar over wealth houses).

---

### Card 50: What Wears You (Burnout & Heavy Load)
- **Card Key:** `job.burnout_load`
- **Subtitle:** `Root causes of work exhaustion, unsustainable deadlines, and relief dates`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']` or burnout/fatigue signal

#### Area of Focus
Diagnosing chronic workplace exhaustion, sleep erosion, unsustainable workload creep, and emotional depletion—pinpointing the exact astrological pressure and the calendar date it eases.

#### Oracle Question
> "What specific pressure is draining your physical and mental stamina at work right now, and on what dated milestone does this heavy load genuinely begin to lift?"

#### Personalizer Goal & Stance
- **Goal:** Validate real fatigue without shaming productivity (`person_facts`: `work.stress_level`, `work.hours`). Give the exhausted professional an exact countdown to relief plus practical boundary rules to prevent medical burnout.
- **Stance Logic:**
  - `build`: Heavy 6th/8th/`D30` pressure has cleared or is easing inside the current TP window, with Moon/Lagna vitality recovering. Encourages gently rebuilding stamina and reclaiming sustainable pace.
  - `get_through`: Saturn/Mars/Rahu pressing 6th/8th/Lagna/Moon or `D30` Lagna afflicted, or *Ashtama Shani* / *Sade Sati*. Enforces strict protective pacing, delegation, saying no to optional committees, and guarding sleep until the named relief date.

#### Full-Circle Coverage
1. **Trigger:** Sunday-night dread, chronic exhaustion despite vacations, cynicism, or physical stress symptoms tied to workload.
2. **Evidence & Diagnosis:** Inspects `6th` (overwork), `8th` (chronic exhaustion), `12th` (sleep loss), `Moon` (emotional tank), and **`D30` (Trimshamsha)** vulnerabilities.
3. **Behavioral Action:** Provides exact `KeyDates` when load lifts and 4-tier anti-burnout protocols.
4. **Resolution:** Connects recovered energy back into Card 45 (*Where Your Job Stands*) or prompts role renegotiation in Card 47/51.

#### Single Past-Event Calibration Question
> "Over the past 4 to 8 months, did a period of nonstop deadlines or understaffing leave you running on empty even after taking time off?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Honor physical and mental limits as sacred stewardship; detach identity from heroic overwork and restore quiet daily rhythms.
- **Rajasic (Pragmatic Leverage):** Audit your calendar ruthlessly—renegotiate non-critical deadlines with your manager in writing and automate or drop low-impact busywork.
- **Mediocre (Passive/Mixed):** Cope with burnout via late-night doomscrolling, caffeine escalation, or silent martyrdom while resentment builds.
- **Baseline (Zero-Loss Floor):** Never sacrifice sleep, basic medical checkups, or clear PTO boundaries to compensate for systemic understaffing during a heavy transit.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks Moon's nakshatra and `D10` 6th-lord nakshatra under **Vipat** (3), **Pratyak** (5), or **Vadha** (7)—especially **25th Manasa Nakshatra**—or **Gandanta** stress. Inspects Mars/Saturn-ruled stars (*Krittika, Pushya, Anuradha, Dhanishta*) overworking the nervous system.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **6th house** (grinding daily toil/debt of effort), **8th house** (chronic depletion/crisis), **12th house** (insomnia/hospitalization risk), **Moon** (*Manas*), **Sun** (*Prana*/vitality), and **Lagna lord** Shadbala/Avasthas. Checks *Kemadruma*, *Vish Yoga* (Saturn-Moon), or *Angaraka/Mars-Saturn* friction in `6/8/12` or `10th`.
- **Divisional Charts (`D30`, `D10`, `D1`, `D9`):**
  - Core stress varga: **`D30` (Trimshamsha)** (Lagna, 6th, 8th, Moon) crossed with **`D10`** 6th/8th houses. Identifies whether burnout is *physical/somatic* (`D1`/`D30` Lagna) or *toxic workload structure* (`D10` 6th/8th).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on Lagna lord, Moon, and active dasha lord (`confirmed_weak` *Drudha Karma* demands permanent structural boundaries, not temporary fixes).
- **Dasha Systems:** Checks `resolveActiveMahadasha` for **6th/8th/12th lord** sub-periods, **Saturn/Rahu/Mars** heavy ADs, 9x9 Matrix **Shadashtaka (`6/8`)** friction, and *Mrita* (`0.10x`) or *Sushupti* (`0.25x`) Avastha depletion of Lagna lord/Sun.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Sade Sati** (especially Phase 2 over Moon), **Ashtama Shani**, **Kantaka Shani** (4th/8th/10th), and Mars/Saturn transiting 6th/8th/12th from Moon/Lagna. Checks `SAV` in Lagna, 6th, and 8th ($< 25$ signals low physiological reserve) and Moon `BAV`.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D30')` and `tpRowIn(view, tpInfo, 'D10')`, checking if `yearLord` is weak/afflicted in `6/8/12`, Muntha in 8th/12th, and *Tithi Ashtottari* periods marking exact **burnout peak vs relief onset** inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Reflects surging workplace-wellbeing search queries (*"career burnout astrology"*, *"why is work so stressful right now"*, *"overworked horoscope when will it end"*). Burned-out professionals do not want generic "take a bath" advice; they want to know *why* stamina collapsed and the exact date the wave breaks.

#### Classical Attribution
- *BPHS* Ch. 7 (`D30` Trimshamsha), Ch. 17, 19, 23 (6th, 8th, and 12th Bhavas of toil, exhaustion, and sleep).
- *Prasna Marga* Ch. 12–13 & 25 (Physical/mental depletion, *Arishta*, and healing/relief timing).
- *Phaladeepika* Ch. 26 (Saturn transits—Sade Sati, Ashtama Shani, Kantaka Shani—causing chronic fatigue).
- *Saravali* Ch. 14–16 (Saturn-Moon and Mars-Saturn fatigue combinations).

---

### Card 51: Bosses, Leadership & Politics
- **Card Key:** `job.boss_politics`
- **Subtitle:** `Handling demanding managers, credit dynamics, and internal politics cleanly`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
Managing vertical authority (direct managers, skip-level executives) and horizontal/departmental politics without becoming collateral damage or burning political capital.

#### Oracle Question
> "How can you read the leadership dynamics and internal office politics around your seat right now, and when does friction with authority figures ease?"

#### Personalizer Goal & Stance
- **Goal:** Provide sharp, grounded corporate navigation tailored to `person_facts` (`work.manager_friction`, `work.role`), applying `SOUL.md` Rule 0 to disambiguate direct boss vs senior sponsor vs rival peer instead of blaming one generic archetype.
- **Stance Logic:**
  - `build`: Sun/9th/10th/`A10` aligned in `D1 + D10` with benefic Jupiter/Mercury mediation and strong TP `yearLord`. Advises building executive sponsorship, presenting crisp solutions, and expanding cross-team allies.
  - `get_through`: Sun-Saturn conflict, Rahu/Mars in `D10` 6th/10th, or `D30` 6th/10th political heat. Advises strict written paper trails, radical neutrality in faction fights, and zero ego battles until friction lifts.

#### Full-Circle Coverage
1. **Trigger:** Micromanaging or erratic boss, departmental turf wars, or political blindsides.
2. **Evidence & Diagnosis:** Separates vertical authority (`Sun`/`9th`/`10th` in `D10`) from peer rivalry (`6th`/`Mercury`/`Mars`/`Rahu` in `D10 + D30`).
3. **Behavioral Action:** Maps political flare-up vs alignment windows (`PeriodStrip`) and prescribes 4-tier executive diplomacy.
4. **Resolution:** Connects smoothly to Card 48 (when sponsorship unlocks) or Card 47 (if toxicity persists past easing dates).

#### Single Past-Event Calibration Question
> "Over the past year, did a clash of communication styles or unspoken agendas with a manager or senior stakeholder catch you off guard?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Act with steady integrity, refuse office gossip, and treat difficult leaders with calm composure without sacrificing self-respect.
- **Rajasic (Pragmatic Leverage):** Manage up proactively—confirm priorities in crisp follow-up emails, solve your boss's top bottleneck visibly, and cultivate multiple senior sponsors.
- **Mediocre (Passive/Mixed):** Vent horizontally to coworkers who leak complaints upward, or shut down defensively whenever leadership gives blunt feedback.
- **Baseline (Zero-Loss Floor):** Never wage open ego war against insecure authority or skip written documentation during contested political cycles.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of **Sun** (authority/boss), **Saturn** (hierarchy/rules), and `D10` 10th/6th lords. Fiery/Kshatriya stars (*Krittika, Magha, Moola, Chitra*) signal proud or demanding leadership styles requiring crisp executive brevity; Rahu-ruled stars (*Ardra, Swati, Shatabhisha*) warn of murky agendas and shifting goalposts. Checks *Pratyak/Vipat* Taras for communication misreads.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Disambiguates **9th house** (mentors/benefic sponsors), **10th house** (direct authority/boss), and **6th house** (competitors/adversaries) per `SOUL.md` Rule 0. Evaluates **Sun-Saturn** mutual aspects/conjunctions (classical father/boss authority tension), `A10` vs `A6`, and *Mercury-Rahu* (spin/office rumors).
- **Divisional Charts (`D10`, `D30`, `D1`, `D9`):**
  - Core corporate arena: **`D10`** (6th, 9th, 10th houses; Sun/Saturn dignity) + **`D30`** (6th/10th hidden sabotage or unfair blame).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on Sun, Saturn, and 10th lord (`d9_redeemed` shows early boss friction maturing into peer respect among senior executives).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Sun`, `Saturn`, `Rahu`, or `6th/10th lord` MD/AD/PD), checking 9x9 Matrix (`houseFromMd` `6/8` or `1/5/9` mentor support) and Sun/Saturn Avasthas.
- **Transits (Gochar) & Ashtakavarga:** Monitors Mars/Rahu/Saturn transiting natal 10th/6th or over natal Sun/Mercury (`D1` & `D10`), vs Jupiter aspecting 9th/10th (protective executive shield). Checks `D1` & `D10` 6th vs 10th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` and `tpRowIn(view, tpInfo, 'D30')` for `yearLord` relationship to Sun/Saturn, plus *Tithi Ashtottari* spans highlighting political cooling dates within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses emotionally charged workplace queries (*"dealing with toxic manager astrology"*, *"office politics corporate career chart"*, *"bad boss birth chart"*). Users seek tactical clarity: is this boss friction a temporary transit to outlast calmly, or a structural signal to change teams?

#### Classical Attribution
- *BPHS* Ch. 3 & 17–20 (Sun/Saturn karakatvas; 6th, 9th, and 10th houses).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.2 (`A10` vs `A6`, `AL` political perception).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Sun-Saturn authority friction and Rahu intrigue).
- *SOUL.md* §2 (Rule 0: Multi-Entity Disambiguation across `D1`/`D10`/Arudhas).

---

### Card 52: Leading Teams & Authority
- **Card Key:** `job.leading_teams`
- **Subtitle:** `Stepping into management, earning team trust, and delegating cleanly`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['corporate', 'executive']` or `work.manages_people === true`

#### Area of Focus
Transitioning from individual contributor to people manager, scaling executive command across larger teams, resolving delegation bottlenecks, and earning genuine team loyalty.

#### Oracle Question
> "How does your natural leadership style land on direct reports right now, and where can you delegate more cleanly to multiply your team's impact?"

#### Personalizer Goal & Stance
- **Goal:** Tailor leadership guidance to `person_facts` (`work.team_size`, `work.management_level`), helping new or seasoned managers balance empathy (Moon/Jupiter) with clear accountability (Sun/Saturn/Mars) without micromanaging.
- **Stance Logic:**
  - `build`: Strong Sun/Jupiter/5th/10th in `D10` + supportive TP `yearLord`. Encourages taking on larger team scope, mentoring rising leaders, and setting bold standards.
  - `get_through`: 5th/6th house strain (high team turnover or friction with juniors) or Saturn/Ketu dampening Sun in `D10`. Advises tightening 1:1 clarity, delegating via clear checklists, and avoiding hero-mode rescuing.

#### Full-Circle Coverage
1. **Trigger:** First-time manager promotion, struggling with underperforming reports, or scaling from manager of ICs to manager of managers.
2. **Evidence & Diagnosis:** Evaluates **5th house** (disciples/loyal followers), **6th house** (subordinates/execution), **10th house** (command), plus Sun/Jupiter/Saturn in `D10`.
3. **Behavioral Action:** Maps leadership growth vs team-friction stretches (`PeriodStrip`) and delivers 4-tier delegation habits.
4. **Resolution:** Reinforces upward readiness in Card 48 (*Promotions, Titles & Recognition*).

#### Single Past-Event Calibration Question
> "Over the past year, did stepping back to let a teammate own an important deliverable pay off—or did rescuing unfinished work end up pulling you back into the weeds?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Lead through clarity, fairness, and genuine mentorship—creating safety for honest feedback while holding high standards.
- **Rajasic (Pragmatic Leverage):** Define explicit ownership metrics, weekly checkpoints, and clear escalation triggers so accountability runs on systems rather than constant supervision.
- **Mediocre (Passive/Mixed):** Micromanage details out of perfectionism, or avoid tough performance conversations until team morale erodes.
- **Baseline (Zero-Loss Floor):** Never blame direct reports upward for leadership ambiguity, nor absorb every dropped ball silently until you burn out.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of `D10` 5th/10th lords, Sun, and Jupiter. Leadership stars (*Magha, Rohini, Pushya, Uttara Phalguni, Shravana*) confer natural followership; sharp/analytical stars (*Chitra, Ashlesha, Jyeshtha*) require conscious warmth when delivering critique. Evaluates Navatara harmony for hiring/onboarding windows.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **5th house** (advisors/loyal team), **6th house** (workforce/daily staff), **10th house** (executive command), **Sun** (*Dig Bala* in 10th), **Jupiter** (wise counsel/mentoring), and **Saturn** (fair systems). Checks `A5`, `A10`, and *Sun-Jupiter* / *Hamsa* / *Sasa* leadership yogas.
- **Divisional Charts (`D10`, `D1`, `D9`):**
  - Core diagnostic in **`D10` (Dashamsha)** (5th, 6th, 10th houses, `D10` Lagna lord).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on Sun, Jupiter, and `AmK`—post-36 `confirmed_strong` or `d9_redeemed` confers seasoned, calm executive gravitas.
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Sun`, `Jupiter`, `Saturn`, or 5th/10th lord periods) and 9x9 Fruition Matrix (`Trikona 1/5/9` favors inspiring mentoring; `Upachaya 3/6/10` rewards operational rigor).
- **Transits (Gochar) & Ashtakavarga:** Monitors Jupiter transiting 5th/9th/10th/11th (team loyalty and strong hires) vs Saturn/Rahu transiting 5th/6th (attrition or performance-management discipline). Checks `D10` 5th/6th/10th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` 5th/6th/10th houses, `yearLord` dignity, and *Tithi Ashtottari* periods marking team-expansion vs reorganization phases inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses management-transition searches (*"stepping into management astrology"*, *"leadership style birth chart"*, *"how to manage difficult direct reports astrology"*). Newly promoted managers frequently search for validation of their leadership archetype and how to stop over-functioning as an individual contributor.

#### Classical Attribution
- *BPHS* Ch. 16, 17, 20 (5th followers, 6th subordinates, 10th command; Sun *Dig Bala*).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` 5th, 6th, and 10th house management dynamics.
- *Uttara Kalamrita* Kanda 1, Varga 4–6 (Authority, delegation, and administrative execution).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A5`, `A10`, `AmK`).

---

### Card 53: Switching Industries or Roles
- **Card Key:** `job.industry_switch`
- **Subtitle:** `Evaluating whether restlessness signals a genuine reinvention or temporary fatigue`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']` or `work.considering_pivot === true`

#### Area of Focus
Mid-career reinvention—distinguishing transient burnout restlessness from deep, multi-year planetary chapter shifts calling for a new industry, functional discipline, or domain.

#### Oracle Question
> "Does your urge to pivot industries or reinvent your role reflect a genuine multi-year career realignment in your chart, or temporary fatigue with your current setup?"

#### Personalizer Goal & Stance
- **Goal:** Prevent reckless mid-career leaps fueled purely by burnout (`person_facts`: `work.industry`, `age_band`) while validating true Mahadasha/Rahu chapter pivots with a practical bridge strategy (internal lateral move, certification, advisory side-track).
- **Stance Logic:**
  - `build`: Upcoming or newly started Mahadasha/major AD shift + Rahu/8th/D10-Lagna realignment + supportive `D24` learning capacity and strong TP `yearLord`. Supports an intentional, staged pivot into the new domain.
  - `get_through`: Temporary `6/8` AD restlessness inside an otherwise strong core Mahadasha, or `d9_weakened` impulsive transit without landing infrastructure. Advises fixing burnout (Card 50) or shifting teams internally before burning domain equity.

#### Full-Circle Coverage
1. **Trigger:** Mid-career existential crisis ("Is this what I want to do for the next 15 years?") or structural disruption of one's legacy industry (e.g., AI/automation shift).
2. **Evidence & Diagnosis:** Compares macro **Mahadasha transitions** (`kundli_activation`) + `D10` Lagna/10th shifts + `D24` new-skill potential vs transient transit itch.
3. **Behavioral Action:** Maps pivot preparation vs transition windows (`PeriodStrip`) and delivers 4-tier reinvention steps.
4. **Resolution:** Connects validated pivots to Card 55 (*What Skill to Build Next*) or Dashboard 08 (if pivoting from corporate to entrepreneurship).

#### Single Past-Event Calibration Question
> "Over the past 2 to 3 years, have you noticed the core problems you used to love solving feeling stale—while an unfamiliar field keeps pulling your curiosity?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Evolve purposefully—carrying hard-won wisdom and ethics from your first chapter into a more aligned domain rather than running away from discipline.
- **Rajasic (Pragmatic Leverage):** Build a 6–12 month "bridge"—transferring horizontally into an adjacent function inside your sector or stacking credible credentials before dropping your income floor.
- **Mediocre (Passive/Mixed):** Romanticize an unfamiliar grass-is-greener industry with zero informational interviews, or stay paralyzed by sunk-cost fear despite multi-year stagnation.
- **Baseline (Zero-Loss Floor):** Never liquidate retirement/emergency savings or abandon core tenure mid-year without testing the target industry via real projects first.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Compares the nakshatra/element of the *outgoing* vs *incoming* Mahadasha/Antardasha lord and `D10` Lagna/10th lords. A shift from Earth/Saturnine stars to Air/Rahu/Mercury stars signals pivoting from legacy operations into tech, media, or modern advisory. Checks **Gandanta** or **Pushkara Navamsha** thresholds during pivotal life transitions.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **8th house** (complete transformation/rebirth of identity), **9th/12th** (new philosophy/foreign/modern domains), **Rahu/Ketu** axis (unconventional pivots and shedding outgrown roles), `AmK` dispositor chain, and `A10` shifts.
- **Divisional Charts (`D10`, `D24`, `D1`, `D9`):**
  - Cross-evaluates **`D10` Lagna & 10th house** alongside **`D24`** (capacity to retrain rapidly) and **`D2`** (financial resilience during a step-back-to-leap-forward).
  - **Age-36 Gate:** Crucial for 36+ pivots: `evaluateD1D9MutualConfirmation` verifies whether the new chapter's ruling planet is `confirmed_strong` or `d9_redeemed` (post-36 second-act mastery) vs *False Promise* (`d9_weakened`).
- **Dasha Systems:** Scans `resolveActiveMahadasha` and the **5-year `kundli_activation` horizon** for **Mahadasha Sandhi** (chapter transitions—e.g., Mars→Rahu, Rahu→Jupiter, Venus→Sun) and *Narayana Dasha* sign shifts changing the active quadrant of `D10`.
- **Transits (Gochar) & Ashtakavarga:** Tracks **Rahu-Ketu** nodal returns (ages ~37.2, 46.5, 55.8) and nodes transiting `1st/7th` or `4th/10th` (`D1` & `D10`), plus Saturn's 2.5-year shifts dismantling obsolete structures. Checks `D10` 8th/10th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` Lagna shift from natal `D10` Lagna, `yearLord` placement in 8th/9th/10th, and *Tithi Ashtottari* periods inside `[tp_start, tp_end]` marking concrete pivot launches.

#### Google Search Trends Synthesis
Addresses huge mid-career query volumes (*"career change at 30/40 astrology"*, *"switching industries birth chart"*, *"am I meant to change careers horoscope"*). Mid-career adults want empirical validation that wanting a second act aligns with a real timing shift rather than mid-life impulsiveness.

#### Classical Attribution
- *BPHS* Ch. 19 (`8th` transformation) & Ch. 46–51 (Mahadasha transitions / *Dasha Sandhi*).
- *Phaladeepika* Ch. 20 (Major Dasha transformations and Rahu/Ketu chapter pivots).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` Lagna vs 10th house vocational reinvention.
- *Lunar Astro / Deepanshu Giri* (*Blank Chart Prediction*) — Dispositor chains & nodal axis reinventions.

---

### Card 54: Work Abroad & Remote Flexibility
- **Card Key:** `job.remote_abroad`
- **Subtitle:** `International teams, cross-border transfers, and location independence`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive']`

#### Area of Focus
Evaluating multinational career opportunities, intra-company international transfers, cross-border clients/teams, and negotiating permanent remote or hybrid autonomy.

#### Oracle Question
> "What support exists in your chart for international assignments, cross-border collaboration, or transitioning into durable remote work flexibility?"

#### Personalizer Goal & Stance
- **Goal:** Guide professionals (`person_facts`: `place`, `work.remote_preference`, `work.relocation_open`) on whether global/remote roles unlock higher growth than strictly local in-office tracks—timing visa requests, transfer pitches, and remote negotiations cleanly.
- **Stance Logic:**
  - `build`: 9th/12th/Rahu alignment in `D10 + D4` (remote home base) and supportive TP `yearLord`. Encourages pursuing global teams, cross-border transfers, or permanent remote contracts.
  - `get_through`: 4th-house/12th-house friction risking isolation or visa delays without 10th/11th backing. Advises securing written remote policies or hybrid anchors before relocating across time zones.

#### Full-Circle Coverage
1. **Trigger:** Return-to-office mandates, multinational transfer openings, or desire to work remotely from another city/country.
2. **Evidence & Diagnosis:** Evaluates **9th/12th/Rahu** (foreign/multinational) vs **4th house/`D4`** (working cleanly from home/base) inside `D10`.
3. **Behavioral Action:** Maps transfer/negotiation windows (`PeriodStrip`) and delivers 4-tier global/remote execution discipline.
4. **Resolution:** Connects relocated professionals into Card 45/49 for ongoing international trajectory.

#### Single Past-Event Calibration Question
> "Over the past 1 to 2 years, did working with international colleagues, distant offices, or from a remote home setup noticeably boost your productivity or career visibility?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Bridge cultures and time zones with respect, clarity, and genuine dependability so distance strengthens trust rather than eroding it.
- **Rajasic (Pragmatic Leverage):** Tie remote or transfer requests explicitly to measurable output, overlapping collaboration hours, and global market coverage.
- **Mediocre (Passive/Mixed):** Let remote work blur into social isolation and invisible output, or take an international transfer without clarifying repatriation/visa security.
- **Baseline (Zero-Loss Floor):** Never relocate internationally on verbal promises or ignore tax/residency compliance across borders.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Inspects nakshatras of 4th, 9th, 10th, and 12th lords and **Rahu** (*Ardra, Swati, Shatabhisha* strongly favor cross-border digital/global roles). Checks **Chara (Movable)** vs **Sthira (Fixed)** stars in `D10` and `D4`, plus *Tara Bala* for travel/transfer dates.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **4th house** (home office/remote comfort), **9th house** (global expansion/long travel), **12th house** (foreign companies/overseas residence), **Rahu** (foreigners/digital networks), and **Moon** (adaptability). Checks `A10` links to 9th/12th (reputation in foreign/multinational firms).
- **Divisional Charts (`D10`, `D4`, `D1`, `D9`):**
  - Cross-references **`D10` (Dashamsha)** 9th/12th/4th houses with **`D4` (Chaturthamsha)** (property/home stability for remote work or smooth overseas residence).
  - **Age-36 Gate:** Post-36 (`ageYears > getD9MaturityAgeYears()`), applies `evaluateD1D9MutualConfirmation` on Rahu, 9th lord, and 12th lord to verify long-term settlement (`confirmed_strong`) vs temporary foreign stint (`d9_weakened`).
- **Dasha Systems:** Checks `resolveActiveMahadasha` (`Rahu`, `Moon`, `12th lord`, or `9th lord` periods) and 9x9 Matrix (`houseFromMd` `9` or `12`). Cross-checks *Narayana Dasha* entering movable signs or `9th/12th` from Lagna/`AL`.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Rahu/Ketu** transiting 4th/10th or 3rd/9th/12th axes, **Jupiter** transiting 9th/12th/4th, and `HouseCard.sav` in 4th vs 9th/12th ($\ge 30$ eases visa and remote logistics).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` and `tpRowIn(view, tpInfo, 'D4')`, *Paradesa* / travel Sahams, Muntha in 4th/9th/12th, and *Tithi Ashtottari* windows within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Reflects post-2020 globalized work search trends (*"work from home career astrology"*, *"foreign job transfer birth chart"*, *"relocating abroad for job horoscope"*). Professionals navigating RTO mandates and global talent markets seek clear chart backing for remote vs expatriate paths.

#### Classical Attribution
- *BPHS* Ch. 7 (`D4` & `D10`), Ch. 15, 20, 23 (4th domestic base, 9th distant fortune, 12th foreign lands).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Rahu, Moon, and 12th house foreign/remote significations).
- *Prasna Marga* Ch. 18 (Foreign travel, visa timing, and distant settlement).
- *Phaladeepika* Ch. 14 & 26 (4th/9th/12th house transits).

---

### Card 55: What Skill to Build Next
- **Card Key:** `job.skill_building`
- **Subtitle:** `High-leverage capabilities and credentials to sharpen ahead of your next cycle`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['employed', 'corporate', 'executive', 'job_seeking_experienced']`

#### Area of Focus
Strategic upskilling—pinpointing the exact technical, analytical, strategic, or executive skill that bridges current experience with the next 2–3 years of dasha demand.

#### Oracle Question
> "Looking at the upcoming cycles in your chart, what specific skill, credential, or capability offers the highest career leverage if you build it now?"

#### Personalizer Goal & Stance
- **Goal:** Prevent scattershot tutorial collecting by aligning learning investments (`person_facts`: `work.role`, `work.industry`) directly with the planetary strengths of `D24` + `D10` and the *next* active Mahadasha/Antardasha.
- **Stance Logic:**
  - `build`: Strong `D24`/Mercury/Jupiter/3rd-5th support and constructive TP *Vidya* indicators. Encourages enrolling in targeted credentials, public speaking, AI/technical fluency, or executive leadership programs.
  - `get_through`: Busy/heavy `get_through` operational stretch where big formal degrees would cause burnout. Recommends lean, micro-paced applied practice (15–30 min/day) rather than heavy tuition commitments until bandwidth clears.

#### Full-Circle Coverage
1. **Trigger:** Feeling technologically outdated, plateauing in current skillset, or preparing quietly during a slower corporate quarter.
2. **Evidence & Diagnosis:** Bridges **`D24` (Siddhamsha)** innate learning style with **`D10`** upcoming dasha demands (`Mercury` technical/data vs `Jupiter` strategy/advisory vs `Mars` systems/engineering vs `Venus` design/client craft).
3. **Behavioral Action:** Maps optimal study/certification windows (`PeriodStrip`) with 4-tier deliberate-practice habits.
4. **Resolution:** Reinforces advancement in Card 48 (*Promotions*) and pivot readiness in Card 53 (*Switching Industries*).

#### Single Past-Event Calibration Question
> "Looking back, did a skill you picked up informally on the side end up creating more career momentum than a traditional credential—or did a formal certification unlock a specific door?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Learn with genuine curiosity and intellectual humility, mastering foundational principles rather than superficial buzzwords.
- **Rajasic (Pragmatic Leverage):** Choose one scarce skill directly tied to the next tier of pay in your field, and ship a real applied project using it within 90 days.
- **Mediocre (Passive/Mixed):** Hoard unread courses, certificates, and tutorials as procrastination against visible career action.
- **Baseline (Zero-Loss Floor):** Never go into heavy debt for speculative degrees during an unaligned `get_through` financial window without testing market ROI first.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates nakshatras of **Mercury**, **Jupiter**, `D24` 5th/9th lords, and `AmK`. Mercury-ruled stars (*Ashlesha, Jyeshtha, Revati*) excel in coding, linguistics, finance, and systems analysis; Jupiter stars (*Punarvasu, Vishakha, Purva Bhadrapada*) excel in strategy, law, pedagogy, and architecture; Mars/Rahu stars favor AI, engineering, cybersecurity, and hands-on tooling.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **3rd house** (hands-on tools/writing/communication), **5th house** (specialized intelligence/strategy), **9th house** (higher mentorship/certifications), **Mercury** (*Buddhi*), **Jupiter** (*Jnana*), and `PK`/`AmK`. Checks *Budhaditya*, *Saraswati*, and *Bhadra* yogas across `D1` and `D24`.
- **Divisional Charts (`D24`, `D10`, `D1`, `D9`):**
  - Core pairing: **`D24` (Siddhamsha)** (Lagna, 4th, 5th, 9th, 10th) mapped directly onto **`D10`** (`10th` lord and `AmK`). Identifies whether the native learns best via *structured theoretical study* (`D24` 9th/Jupiter) or *rapid applied prototyping* (`D24` 3rd/Mercury/Mars).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on Mercury, Jupiter, and the *upcoming* dasha lord (`d9_redeemed` supports late-blooming mastery in analytical/advisory domains).
- **Dasha Systems:** Looks ahead 12–36 months in `resolveActiveMahadasha` (`kundli_activation`)—preparing the native *before* a new AD/MD begins (e.g., building management/strategy skills ahead of a Jupiter AD, or technical/analytics depth ahead of a Mercury/Rahu AD).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting 3rd/5th/9th from Lagna/Moon (peak learning absorption) and **Mercury** direct cycles free of severe nodal/Mars affliction for exam/certification dates. Checks `D24` and `D1` 5th/9th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Evaluates **Vidya Saham**, `tpRowIn(view, tpInfo, 'D24')`, `tpRowIn(view, tpInfo, 'D10')`, `yearLord` affinity to Mercury/Jupiter, and *Tithi Ashtottari* study windows inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Captures proactive professional-development searches (*"what skill should I learn astrology"*, *"best certifications for my career birth chart"*, *"career upskilling horoscope"*). Ambitious professionals want ROI clarity before spending hundreds of hours and thousands of dollars on an MBA, coding stack, or executive certificate.

#### Classical Attribution
- *BPHS* Ch. 6–7 (`D24` Siddhamsha & `D10` Dashamsha), Ch. 14, 16, 20 (3rd, 5th, and 9th houses of skill and higher learning).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Budha, Guru, and specialized craft/wisdom karakatvas).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D24` intellectual mastery feeding `D10` vocational execution.
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Vidya Saham* and `TP D24` annual learning windows.

---

## 4. Attribution & Source Credits Summary

| Source / Tradition | Author / Lineage | Scope Applied in Dashboard 06 |
| :--- | :--- | :--- |
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | `D10`, `D2`, `D30`, `D24`, `D4`, 6th/10th/11th/2nd/8th/12th Bhavas, Raja/Dhana/Viparita/Panchamahapurusha Yogas, Ashtakavarga (`11H > 12H`). |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | `AmK`, `A10` (Rajya Pada), `A6`, `A11`, `AL`, Narayana & Chara Dashas. |
| *Phaladeepika* | Mantreswara | Planetary maturation (Ch. 20), Dasha Sandhi, *Sade Sati* / *Ashtama Shani* / *Kantaka Shani* (Ch. 26), 10th house *Karmabhava*. |
| *Saravali* | Kalyana Varma | Saturn-Moon/Mars-Saturn burnout combinations, Vargottama vs *Neecha Vargottama* corporate endurance. |
| *Uttara Kalamrita* | Kalidasa | Sun/Saturn authority tension, Mercury/Jupiter upskilling karakatvas, Rahu/12th foreign/remote work. |
| *Prasna Marga* | Panakkattu Namboodiri | Organizational instability, burnout/depletion diagnostics, visa/relocation timing, SAV transit filters. |
| *Tithi Pravesha: Vedic Annual Horoscopy* & *Crux of Vedic Astrology* | Pt. Sanjay Rath (Puri Tradition) | Annual TP container (`yearLord`, Muntha, *Artha*/*Yashas*/*Karya Siddhi*/*Vidya* Sahams), `TP D10`/`D2`/`D30`/`D24`, post-36 `D9` gate. |
| *Timing Events Through Vimshottari Dasha* | K.N. Rao | Jupiter-Saturn double transit (`S6D`) for promotions, job switches, and restructuring survival. |
| *Muhurta Chintamani* & *Muhurta* | Daivajna Rama / Dr. B.V. Raman | Navatara (*Sampat*, *Sadhaka*, *Vipat*, *Vadha*) and Chara/Sthira stars for job transitions & negotiations. |
| *Blank Chart Prediction* & *Predicting Through Nakshatras* | Lunar Astro / Deepanshu Giri | `K64M`/`K64L`/`KD22`/`BB` layoff/transition triggers, dispositor chains, nodal axis pivots. |
| Internal Architecture & Research Specs | AI AdAstra Engineering | `docs/reading-engine/76`, `docs/reading-engine/78`, `SOUL.md` §2–3, `src/reading/dasha/dashaAssessment.ts`. |
