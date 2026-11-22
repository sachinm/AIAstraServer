# Dashboard 05: Career Start & First Break (Graduation, Skill Conversion & Early Trajectory)

**Document ID:** `docs/dashboards/05-career-start-and-first-break.md`  
**Board Route:** `/work` → Lens: `career_start` (`work.status` = `student` | `recent_grad` | `early_career` | `career_reentry`)  
**Card Range:** Cards 38–44 (7 Cards)  
**Primary Divisional Charts:** `D24` (Siddhamsha / Chaturvimshamsha), `D10` (Dashamsha), `D1` (Rasi), `D4` (Chaturthamsha), `D2` (Hora), `D9` (Navamsha — gated at `ageYears > getD9MaturityAgeYears()`)  
**Engine & Data Boundary:** All astronomical coordinates, divisional vargas, dashas, transits, Ashtakavarga bindus, Arudha padas, Chara Karakas, and Tithi Pravesha annual rows are pre-computed by the external sidereal ephemeris engine and consumed from `kundli_digest` (`DigestView`) and `kundli_activation`. Node.js performs **zero** astrological calculations.

---

## 1. Domain Architecture & Full-Circle Coverage Guarantee

The **Career Start & First Break** dashboard addresses the critical developmental bridge between academic preparation and professional execution. Standard generic horoscopes collapse a 22-year-old graduate hunting for an entry-level break into the same generic "10th house career" bucket as a 45-year-old corporate vice president. In Vedic Jyotish, these are completely distinct karmic phases:

1. **Knowledge-to-Vocation Conversion (`D24` → `D10`):** Whether formal schooling, degrees, and technical certifications (`D24` / 4th, 5th, 9th houses) convert smoothly into marketable professional standing (`D10` / 6th, 10th houses) or pivot into an adjacent commercial skill.
2. **Entry Into Service (`6th House` + `D10`):** Landing a first job is classically a **6th-house** (*Artha-Trikona* service entry, competitive interviews, beating rival applicants) and **10th/11th-house** (*Karyakshetra* appointment and first paycheck) transition—not yet the executive authority of mid-career.
3. **Saturn Return & Early Planetary Maturation (*Graha Pakvata*):** Young adults transitioning from age 21 through age 30 experience consecutive *Graha Pakvata* activations—Sun (21–22: autonomy), Moon (24: emotional independence), Venus (25: taste/networking), Mars (28: strategic drive), and the first **Saturn Return** (ages ~27.5–30.5)—marking the structural crucible before Saturn's full karmic maturation threshold (`D9_MATURITY_AGE_YEARS`, default `36`).
4. **Full-Circle Coverage Matrix (7 Cards):**
   - **Launch Timing & Interview Momentum:** Cards **38** (*Your Career Launch Window*) and **40** (*Landing Your First Role*).
   - **Education-to-Market Fit & Fork Decisions:** Cards **39** (*Turning Your Degree Into a Career*) and **41** (*Choosing Between Two Paths or Offers*).
   - **Psychological Grounding & Relocation:** Cards **42** (*Overcoming Imposter Syndrome & Early Doubt*) and **43** (*Relocation & Working Abroad*).
   - **Multi-Year Credibility Horizon:** Card **44** (*Building Your 3-Year Foundation*).

### Default Pinned Cards & Sub-Technique Architecture
- **Default Pinned Starter Deck (4 Cards):** `start.launch_window` (38), `start.degree_to_career` (39), `start.first_role_timing` (40), `start.three_year_foundation` (44).
- **Card Picker Deck (Contextual / On-Demand):** `start.offer_decision` (41), `start.imposter_syndrome` (42), `start.relocation_abroad` (43).
- **Deterministic Sub-Technique Pipeline:** `work.sub.career_start_ledger` executes once per `(kundliId, digest_version, asOf)`, reading `DigestView` (`D1`, `D24`, `D10`, `D4`, `D2`, `D9`, `AnnualRow`, `StarProfile`, `PointRow`) and `kundli_activation`, persisting typed ledgers into `technique_outputs`. Grouped LLM synthesis (`parts[0]` stable natal prefix $\ge 1,024$ tokens with `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) runs over the ledger and obeys 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES=45`).

---

## 2. Dashboard-Wide Rules: Age-36 Gate, Multi-Clock Dashas & Bounded Tithi Pravesha

1. **Age-36 Navamsha (`D9`) Gate (`getD9MaturityAgeYears()`, default `36`):**
   - For the primary demographic of Career Start (ages 18–32, `ageYears <= getD9MaturityAgeYears()`), `isAgeMatureD9(ageYears)` evaluates to `false`. `D1 + D24 + D10` act as the primary engines, with `D9` providing developmental context and early Vargottama/Neecha Bhanga signatures.
   - When an older career re-entrant (`ageYears > getD9MaturityAgeYears()`, e.g., pivoting at age 38 after an advanced degree or sabbatical) opens this lens, `evaluateD1D9MutualConfirmation` becomes mandatory: **Neecha Vargottama** (*Drudha Karma*, `-1.5`), **Exalted/Own Vargottama** (`confirmed_strong`, `+1.5`), **Neutral Vargottama** (`+1.0`), **Neecha Bhanga via D9** (`d9_redeemed`, `+1.2`), and **False Promise** (`d9_weakened`, `-1.0`). If `birthDate` is absent, the card records `age_unresolved` and falls back to `D1 + D24 + D10`.
2. **Active 40+ Dasha Systems & 9x9 Fruition Matrix:**
   - Resolves active MD/AD/PD via `resolveActiveMahadasha`: prioritizes certified conditional nakshatra dashas (e.g., *Chaturashiti Sama* if 10th lord is in 10th, *Shashtihayani* if Sun is in Lagna) before universal *Vimshottari*, *Narayana/Chara*, and *Yogini*. Evaluates the 9x9 Antardasha-from-Mahadasha Fruition Matrix (`AntardashaFruitionCell`) and 5-system Planetary Avasthas (Baladi ripeness `0.10x–1.00x`, Jagradadi alertness `0.25x–1.00x`).
3. **Bounded Annual Tithi Pravesha (`TITHI_PRAVESHA_YEAR_RULE`):**
   - Cuts the next 12 months into 3–6 engine-dated spans strictly within `[tp_start, tp_end]` ($\le 400$ days) using `runningTithiPravesha` and `tpRowIn(view, tpInfo, 'D10')` / `'D24'`. Gregorian `01-01` .. `12-31` fallbacks are forbidden. Unresolved `yearLord` or contested multi-clock concordance fails closed to `stance = 'get_through'`.
4. **Surface Discipline:**
   - Card `ReadFace` and `ShortFace` use plain, empathetic English with **zero** Sanskrit jargon and **zero** internal engine identifiers. Technical coordinates reside exclusively inside `evidence[]` for the one-tap **Chart details** modal.
5. **Implementation Dependencies (`FACT_CATALOG`, `SERVED_VARGAS`, `ANNUAL_CHART_VARGAS`):**
   - **`FACT_CATALOG` (`src/profile/facts.ts`):** `FACT_CATALOG` currently defines `'work.status': ['yes', 'between_jobs', 'own_business', 'studying', 'retired']`, `'work.level'`, `'self.focus'`, and `'place.current'`. Semantic routing tokens in this spec (`student`, `recent_grad`, `early_career`, `career_reentry`) map onto `studying` / `between_jobs` / `yes` + `work.level` + `age_band` during initial rollout or require additive `FACT_CATALOG` keys/values before `checkFact` validation.
   - **`SERVED_VARGAS` & `ANNUAL_CHART_VARGAS`:** `src/reading/chartData/catalog.ts:133` currently limits `SERVED_VARGAS` to `{1, 2, 4, 7, 9, 10}` and `src/reading/digest/annualSet.ts:11` limits `ANNUAL_CHART_VARGAS` to `[1, 9, 10]`. Live `D24` natal pulls and `TP D24` (`tpRowIn`) annual pulls depend on `docs/reading-engine/80` R1–R4 (`SERVED_VARGAS_LIST`, varga placement houses, `kind === 'TP'` `yearLord` parsing, and `ANNUAL_CHART_VARGAS` expansion); until enabled, ledgers fall back cleanly to served `D1 + D9 + D10`.

---

## 3. Complete Card Specifications (Cards 38–44)

---

### Card 38: Your Career Launch Window (Next 12 Months)
- **Card Key:** `start.launch_window`
- **Subtitle:** `When interview momentum opens, and how your first year unfolds`
- **Default Placement:** Pinned (Starter Card #1) | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']` or user-pinned

#### Area of Focus
The macro 12-month trajectory for graduating, entering the job market, clearing initial screenings, and gaining early-career traction—separating high-conversion application quarters from preparation stretches.

#### Oracle Question
> "Across your next 12 months, which dated windows actively support launching your career and gaining professional traction, and when should you focus quietly on readiness rather than forcing breakthroughs?"

*(Requirements: Grounded in D1 + D24 + D10 active dasha lords, bounded TP `yearLord` spans, zero chart terms or engine names.)*

#### Personalizer Goal & Stance
- **Goal:** Read `person_facts` (`work.status`, `work.field`, `age_band`, `work.graduation_date`) to deliver a calm, month-by-month operational calendar. Eliminate post-graduation panic by naming exact dates when doors open vs when quiet skill-building yields higher returns.
- **Stance Logic:**
  - `build`: Triggered when TP `yearLord` is strong/unafflicted in `D1`/`D10`, active MD/AD links `D24` and `D10` Lagna/10th, and Five Clocks Concordance is `confirmed` ($\ge 3$) or `leaning` ($2$). Encourages aggressive interviewing, networking, and portfolio launches.
  - `get_through`: Triggered when `yearLord` is unresolved or placed in 6th/8th/12th from TP Lagna, active AD sits in `6/8` (*Shadashtaka*) or `2/12` (*Dwirdwadasha*) from MD, or clocks are `contested`. Advises structured upskilling, internships, and disciplined pacing until the stated easing date.

#### Full-Circle Coverage
1. **Trigger:** User enters the labor market or anticipates graduation within 12 months.
2. **Evidence & Diagnosis:** Compares current `D24` skill activation against `D10` career entry triggers over the bounded TP year.
3. **Behavioral Action:** Maps 3–6 dated `PeriodStrip` windows and `KeyDates` (`<= 6`) paired with the 4-tier behavioral playbook.
4. **Resolution:** Hands off smoothly into Card 40 (*Landing Your First Role*) for tactical interview execution or Card 39 (*Turning Your Degree Into a Career*) if a field pivot is indicated.

#### Single Past-Event Calibration Question
> "Looking back over the past 6 to 9 months, did a sudden shift in your academic plan, internship, or target timeline force you to rethink what you wanted to pursue next?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Align outreach and flagship applications strictly with peak supportive windows; treat quieter months as sacred deep-study and mentor-seeking retreats.
- **Rajasic (Pragmatic Leverage):** Systematically build tangible proof-of-work projects during preparation windows so recruiters see concrete artifacts the moment hiring gates open.
- **Mediocre (Passive/Mixed):** Scatter-gun applying blindly through low-conversion cycles, leading to rejection fatigue right before favorable windows arrive.
- **Baseline (Zero-Loss Floor):** Never abandon basic financial discipline or burn bridges with professors/early contacts during slow, frustrating months.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates the natal Moon's Janma Nakshatra against the active Mahadasha/Antardasha lord's nakshatra and the TP Lagna's nakshatra via `StarProfile.taras`. Launching initiatives during **Sampat** (2), **Kshema** (4), **Sadhaka** (6), **Mitra** (8), or **Param Mitra** (9) (*Tara Bala = 1*) yields smooth callback velocity; **Vipat** (3), **Pratyak** (5), or **Vadha** (7) (*Tara Bala = 0*) requires patience and double-verification of paperwork. Checks Pada-to-Navamsha mapping of the 10th lord to see if early career expression shifts element (e.g., Fire-to-Earth grounding).
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses `D1` 5th/9th lords (academic completion/grace) connecting to 6th (service entry) and 10th (vocation), `A10` (Rajya Pada — visible career standing), `AL` (public first impression), and **Amatyakaraka (`AmK`)** dignity. Checks *Raja Yogas* (9th–10th *Dharmakarmadhipati*), *Budhaditya Yoga* (analytical launch), or *Kemadruma/Papakartari* dampening early confidence.
- **Divisional Charts (`D1`, `D24`, `D10`, `D9`):**
  - Bridges `D24` (4th/5th/9th/10th) with `D10` (1st/6th/10th). Polarity agreement (`D1` + `D10` alignment) determines whether first-year execution feels natural or uphill.
  - **Age-36 Gate:** Pre-36 (`isAgeMatureD9 === false`) weights `D1 + D24 + D10` primarily; if `ageYears > getD9MaturityAgeYears()` (late career re-entry), runs `evaluateD1D9MutualConfirmation` on active MD/AD lords and `AmK`, adjusting confidence for *Neecha Vargottama* (`-1.5`) or *Neecha Bhanga via D9* (`+1.2`).
- **Dasha Systems:** `resolveActiveMahadasha` checks certified conditional dashas first (e.g., *Chaturashiti Sama*, *Ashtottari*), then *Vimshottari* MD/AD/PD, *Narayana* (sign chapter shifting into 1st/6th/10th/11th), and *Yogini*. Evaluates the **9x9 Fruition Matrix** (`AntardashaFruitionCell` distance from MD to AD: `1/5/9` and `4/7/10` drive rapid onboarding; `6/8` or `2/12` signal transitional friction) and Baladi/Jagradadi Avastha multipliers (`0.10x–1.00x`).
- **Transits (Gochar) & Ashtakavarga:** Monitors `activateDoubleTransit` (`S6D`: Jupiter and Saturn simultaneously aspecting or occupying `D1` 10th house, 10th lord, or `D10` Lagna/10th). Evaluates Saturn's aspect on 6th/10th (grinding structure), Rahu/Ketu axis over 1st/7th or 4th/10th (unconventional entry or abrupt redirection), and `HouseCard.sav` ($\ge 30$ bindus buffers early rejection; $< 25$ signals need for steady pacing).
- **Tithi Pravesha (TP):** Inspects `runningTithiPravesha(view, asOf)` for TP Lagna, `AnnualRow.yearLord` dignity in `tpRowIn(view, tpInfo, 'D10')` and `tpRowIn(view, tpInfo, 'D24')`, *Karya Siddhi* and *Yashas* Sahams, Muntha placement (Muntha in 6/10/11 favors breakthrough; 8/12 counsels preparation), and Tithi Ashtottari sub-periods bounded strictly by `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Synthesizes high-intent early-career search clusters (*"first job astrology after graduation"*, *"when will I find a job after college"*, *"career start horoscope 2026/2027"*). Recent graduates experience acute temporal uncertainty during the gap between final exams and first offer letters. Rather than generic encouragement, users seek concrete calendar boundaries separating silent preparation periods from active hiring surges.

#### Classical Attribution
- *Brihat Parashara Hora Shastra (BPHS)* Ch. 7 & 19 (Shodashavarga, D10/D24 definitions, 10th house *Karma Bhava*), Ch. 46–51 (Vimshottari & conditional dashas).
- *Tithi Pravesha: Vedic Annual Horoscopy* (Pt. Sanjay Rath) — `yearLord`, Muntha, Sahams, and Tithi Ashtottari annual timing.
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — Bridging `D24` (Siddhamsha) learning to `D10` (Dashamsha) action.
- *Timing Events Through Vimshottari Dasha* (K.N. Rao) — Double transit of Jupiter and Saturn on 10th house/lord.

---

### Card 39: Turning Your Degree Into a Career
- **Card Key:** `start.degree_to_career`
- **Subtitle:** `Whether your formal training directly fuels your work or feeds an adjacent path`
- **Default Placement:** Pinned (Starter Card #2) | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']`

#### Area of Focus
Evaluating the alignment—or productive divergence—between a person's academic degree, specialized study, and actual commercial career trajectory.

#### Oracle Question
> "How directly does your formal education translate into practical market demand, and if an adjacent field fits better, where does your training become a hidden advantage?"

#### Personalizer Goal & Stance
- **Goal:** Use `person_facts` (`work.education_field`, `work.target_role`) to remove guilt when a graduate feels drawn away from their major—or conversely validate doubling down on specialized credentials.
- **Stance Logic:**
  - `build`: Triggered when `D24` strongest lord harmonizes with `D10` 10th lord / `AmK`, and TP `yearLord` supports `5th/9th/10th` activation. Supports direct degree monetization or confident interdisciplinary positioning.
  - `get_through`: Triggered when `D24` 4th/5th lords sit in `6/8/12` from `D10` Lagna or active period creates cognitive scatter. Advises taking a practical bridge role first rather than stalling in perpetual credential-collecting.

#### Full-Circle Coverage
1. **Trigger:** Doubt over whether to stick strictly to one's college major or pivot immediately upon graduating.
2. **Evidence & Diagnosis:** Compares `D24` (what the mind masters) against `D10` (how the market pays and promotes) and `AmK` (functional executive vehicle).
3. **Behavioral Action:** Prescribes direct-track vs hybrid-translation strategies using the 4-tier playbook.
4. **Resolution:** Connects to Card 41 (*Choosing Between Two Paths or Offers*) or Card 55 (*What Skill to Build Next*).

#### Single Past-Event Calibration Question
> "During your final year of study or training, did a practical project or side assignment end up energizing you more than your core coursework?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Synthesize formal analytical rigor (`D24`) with genuine vocational purpose (`D10` / `AmK`), turning rare interdisciplinary fluency into a signature strength.
- **Rajasic (Pragmatic Leverage):** Reframe your degree as a credibility badge while actively pursuing higher-demand adjacent skills that command faster market entry.
- **Mediocre (Passive/Mixed):** Cling rigidly to a mismatched major out of sunk-cost guilt, or abandon hard-earned credentials completely instead of bridging them.
- **Baseline (Zero-Loss Floor):** Complete active certifications cleanly before pivoting so no academic chapter ends in unfinished loose threads.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Inspects nakshatra lords of `D1` 5th/9th/10th cusps (`HouseCard.cuspStar`) and `AmK`'s nakshatra in `D1` and `D24`. Mercury/Jupiter-ruled stars (*Ashlesha, Jyeshtha, Revati, Punarvasu, Vishakha, Purva Bhadrapada*) favor knowledge-intensive advisory/technical translation; Rahu/Mars stars indicate cross-disciplinary or disruptive pivots away from textbook majors. Checks Navatara harmony between Moon's star and the `D24` 4th/10th lord's star.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Maps the `5th` (intelligence/applied learning) and `9th` (higher degrees/mentors) to the `10th` (profession) and `2nd` (skill monetization). Evaluates `AmK` (Amatyakaraka) vs `PK` (Putrakaraka — intellect/discernment) and `A5` vs `A10`. Classical *Saraswati Yoga* (Mercury-Jupiter-Venus strength) signals academic-to-career continuity; a `5th–8th` or `9th–12th` break signals research or non-traditional pivots.
- **Divisional Charts (`D24`, `D10`, `D1`, `D9`):**
  - Core mechanic: Direct structural cross-walk between **`D24` (Siddhamsha)** (Lagna, 4th, 5th, 9th houses) and **`D10` (Dashamsha)** (Lagna, 10th house, `AmK`). When the strongest planet in `D24` aligns (trine/kendra/mutual friendship) with `D10` 10th lord, the degree translates directly. When `D24` and `D10` point to different elements (e.g., `D24` Moon/Venus vs `D10` Mars/Saturn), an adjacent hybrid career thrives.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()` (mid-life degree/MBA/PhD pivot), enforces `evaluateD1D9MutualConfirmation` on `D24` lord and `AmK` to ensure the new credential does not suffer from *False Promise* (`d9_weakened`).
- **Dasha Systems:** Evaluates whether the running MD/AD lord (`resolveActiveMahadasha`) sits favorably in both `D24` and `D10`, or activates a `6/8` shift between academic completion and vocational reality. Checks *Chara Dasha* / *Narayana Dasha* transitions across the 5th/9th/10th rasis.
- **Transits (Gochar) & Ashtakavarga:** Tracks Jupiter transiting natal 5th/9th/10th (unlocking mentorship and academic transferability) and `Rahu` transiting `D24` Lagna or 10th (pulling the native toward emerging, unorthodox industries not taught in traditional curricula). Checks `D1` 5th/10th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Evaluates `Vidya Saham` (learning application) and `Karya Siddhi Saham` in the current TP chart, plus `tpRowIn(view, tpInfo, 'D24')` and `tpRowIn(view, tpInfo, 'D10')`. If `yearLord` links 5th/9th in `D24` to 10th/11th in `D10`, formal credentials directly open commercial doors this year.

#### Google Search Trends Synthesis
Addresses recurring search behavior (*"jobs for my degree astrology"*, *"will I work in my field of study?"*, *"degree to career transition birth chart"*). Early-career users frequently feel trapped by sunk-cost anxiety ("I studied X, why do I feel pulled toward Y?"). Synthesizing `D24` vs `D10` validates both direct-track specialists and non-linear career pivots with concrete astrological clarity.

#### Classical Attribution
- *BPHS* Ch. 6–7 (Chaturvimshamsha `D24` for *Vidya*/learning and Dashamsha `D10` for *Karma*/profession), Ch. 16 & 20 (5th and 9th houses).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Budha/Mercury and Guru/Jupiter educational vs commercial karakatvas).
- *Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D24` 4th/5th/9th evaluation for formal vs intuitive knowledge conversion.
- *Jaimini Upadesha Sutras* Ch. 1.1–1.2 (`AmK` as career instrument, `A5` vs `A10`).

---

### Card 40: Landing Your First Role
- **Card Key:** `start.first_role_timing`
- **Subtitle:** `Best interview windows, application strategy, and conversion into an offer`
- **Default Placement:** Pinned (Starter Card #3) | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']`

#### Area of Focus
Tactical interview scheduling, competitive differentiation against other candidates, and converting applications into formal employment contracts.

#### Oracle Question
> "During which specific dated windows are interviews, hiring callbacks, and formal job offers most strongly supported, and how should you pace your search in between?"

#### Personalizer Goal & Stance
- **Goal:** Convert abstract "career luck" into actionable hiring-funnel timing tailored to `person_facts` (`work.job_hunting`, `work.target_role`). Separate quiet prep weeks from high-conversion interview surges.
- **Stance Logic:**
  - `build`: Active 6th/10th/11th sub-period + benefic Navatara/TP `yearLord` support + `D10` 6th/10th harmony. Advises active outreach, referrals, and scheduling final-round interviews inside peak dates.
  - `get_through`: Active `6/8` or `2/12` AD friction, Saturn/Ketu drag on 6th/11th, or unresolved TP `yearLord`. Advises targeted warm referrals over cold portals, mock interviews, and patience until the pressure-release date.

#### Full-Circle Coverage
1. **Trigger:** Active job search, upcoming recruiting cycles, or stalled interview pipelines.
2. **Evidence & Diagnosis:** Evaluates the 6th house (beating competition/service entry) + 10th house (role) + 11th house (formal offer/income) across `D1` and `D10`.
3. **Behavioral Action:** Provides dated `KeyDates` for outreach/interviews and 4-tier job-hunt execution habits.
4. **Resolution:** Hands off to Card 41 (*Choosing Between Two Paths or Offers*) once offers materialize, or Card 42 (*Overcoming Imposter Syndrome*) if interview anxiety spikes.

#### Single Past-Event Calibration Question
> "Over the past year, did a promising interview or application stall unexpectedly over timing, budget freezes, or an external delay outside your control?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Prepare deeply, treat every interview as an honest exchange of value, and lean into trusted alumni/mentor referrals during supportive windows.
- **Rajasic (Pragmatic Leverage):** Treat job hunting as an empirical funnel—track outreach metrics, tailor portfolios to specific role pain points, and time major follow-ups to peak weeks.
- **Mediocre (Passive/Mixed):** Rely solely on one-click automated portals without networking, or emotionally crash after a single rejection.
- **Baseline (Zero-Loss Floor):** Keep daily routines, sleep, and follow-up etiquette intact so anxiety never leaks into interview tone.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks running PD/Sookshma lord's nakshatra against Moon's Janma Nakshatra via `StarProfile.taras`. **Sadhaka** (6/15/24 — accomplishment) and **Sampat** (2/11/20 — gain) Taras mark prime offer-closing weeks; **Pratyak** (5/14/23) warns of stiff interview panels requiring extra prep. Checks Mercury's nakshatra and pada for articulate communication during technical/behavioral screens.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Prioritizes the **6th house** (competitive exams, interviews, winning over rivals, entering service), **10th house** (title/role), and **11th house** (appointment/first salary), alongside `A6`, `A10`, `A11`, and `AmK`. Checks *Viparita Raja Yoga* (unexpected openings via competitor dropouts) and *Budha-Mangala* (sharp technical execution).
- **Divisional Charts (`D1`, `D10`, `D24`, `D9`):**
  - Evaluates `D10` 6th house (daily service onboarding) and `D10` 11th house (tangible offers), plus `D10` Lagna lord dignity. Checks `D24` communication/knowledge indicators backing technical interviews.
  - **Age-36 Gate:** Pre-36 relies on `D1 + D10` alignment; post-36 re-entry requires `evaluateD1D9MutualConfirmation` on 6th/10th lords and active MD/AD lords so early interview momentum converts into sustainable roles.
- **Dasha Systems:** Drills into **Levels 3–6** (Pratyantardasha, Sookshma, Prana in `[-90d, +365d]` operational windows) across certified conditional dashas, *Vimshottari*, and *Yogini* (*Siddha*, *Dhanya*, *Bhadrika* sub-periods favor hiring). Checks 9x9 Matrix (`AntardashaFruitionCell`) for `isStarLordOfMd` or `isSignDispositorOfMd` executive delivery.
- **Transits (Gochar) & Ashtakavarga:** Monitors `activateDoubleTransit` over `D1` 6th/10th/11th or `D10` 10th, transit Jupiter over 11th/2nd (offer + salary), and transit Mars/Mercury activating 3rd/6th/10th (interview courage and sharp pitch). Checks 6th and 11th `HouseCard.sav` ($\ge 30$ favors quick conversion; `< 25` requires higher application volume).
- **Tithi Pravesha (TP):** Evaluates `AnnualRow` *Tithi Ashtottari* periods within `[tp_start, tp_end]`, `Karya Siddhi Saham`, and `tpRowIn(view, tpInfo, 'D10')` 6th/10th/11th houses. Strong `yearLord` in Kendra/Upachaya supports offer conversion; weak `yearLord` triggers `get_through` persistence pacing.

#### Google Search Trends Synthesis
Addresses urgent, high-volume search queries (*"when will I get a job offer astrology"*, *"interview success transit"*, *"landing first job birth chart"*). Job seekers want tactical clarity on *when* effort converts to offers and *why* strong resumes hit invisible hiring walls during certain months.

#### Classical Attribution
- *BPHS* Ch. 17 & 21 (6th house *Ripu/Seva Bhava* for competitive success and service; 11th house *Labha* for fulfillment).
- *Phaladeepika* Ch. 15 & 26 (6th/10th/11th house fruition and Gochar/transit rules).
- *Prasna Marga* Ch. 14–16 (Competitive victory, timing of appointments, Ashtakavarga transit filtering).
- *B.V. Raman — Muhurta* & *Muhurta Chintamani* (Tara Bala and Sadhaka/Sampat nakshatra selection for interviews).

---

### Card 41: Choosing Between Two Paths or Offers
- **Card Key:** `start.offer_decision`
- **Subtitle:** `Comparing competing roles, startup risk vs corporate structure, and long-term upside`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']` or user mentions competing offers

#### Area of Focus
Structured decision-making when facing two distinct early-career forks: big corporate brand vs scrappy startup, immediate higher pay vs steep learning curve, or technical specialist track vs management/generalist track.

#### Oracle Question
> "When weighing competing offers or two divergent early-career paths, which structural qualities—stability, learning speed, or upside—align best with your chart right now?"

#### Personalizer Goal & Stance
- **Goal:** Provide an objective, grounded decision matrix tailored to `person_facts` (`work.risk_tolerance`, `work.field`) without making choices for the user—helping them see which path compounds over 3–5 years vs which path causes early burnout.
- **Stance Logic:**
  - `build`: Strong `AmK` + `D10` 10th/11th + `D2` alignment and supportive TP `yearLord`. Supports seizing higher-growth, high-autonomy offers when learning velocity is backed by structural resilience.
  - `get_through`: Afflicted 8th/12th activation, `6/8` AD tension, or weak `yearLord`. Favors the steadier, lower-volatility option with stronger mentorship and financial cushion.

#### Full-Circle Coverage
1. **Trigger:** Receiving multiple job offers, grad-school vs job dilemma, or startup vs enterprise fork.
2. **Evidence & Diagnosis:** Compares structured authority/service (`Saturn`/`6th`/`10th`) vs entrepreneurial agility (`Mars`/`Rahu`/`3rd`/`7th`) and immediate cashflow (`D2`/`2nd`) vs skill compounding (`D24`).
3. **Behavioral Action:** Delivers a clear comparative decision rubric and 4-tier negotiation/choice behaviors.
4. **Resolution:** Anchors the selected path into Card 44 (*Building Your 3-Year Foundation*) or routes entrepreneurial founders toward Card 62 (*Job vs. Business Readiness*).

#### Single Past-Event Calibration Question
> "In past academic or internship choices, did picking the structured, well-known option work out better for you—or did you thrive more when thrown into an ambiguous, fast-moving environment?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Choose the environment that cultivates authentic long-term mastery and ethical mentors, not merely vanity prestige or short-term flattery.
- **Rajasic (Pragmatic Leverage):** Negotiate clear learning scope, mentorship access, or compensation milestones in writing before signing either offer.
- **Mediocre (Passive/Mixed):** Pick purely out of peer comparison or fear of missing out, then second-guess the decision every difficult week.
- **Baseline (Zero-Loss Floor):** Never accept an offer with ambiguous role boundaries or unsustainable burn risk just to end the discomfort of deciding.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Contrasts the nakshatra temperament of `AmK` and `D10` 10th lord: Fixed/Earth stars (*Rohini, Uttara Phalguni, Uttara Ashadha, Uttara Bhadrapada*) thrive in structured institutional environments; Movable/Swift/Sharp stars (*Ashwini, Swati, Pushya, Mrigashira, Chitra*) thrive in agile, fast-iterating startups or consulting. Checks Navatara status of the active AD lord to gauge risk appetite during the decision window.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Compares `6th` house (structured corporate service) vs `3rd`/`7th` houses (autonomy, agency, commercial versatility); `10th` house (status/title) vs `2nd`/`11th` (cash compensation). Evaluates `AmK` dispositor, `AL` (how prestige looks externally) vs `Lagna` (what actually nourishes the self), and `Moon` stability under pressure.
- **Divisional Charts (`D10`, `D2`, `D24`, `D1`, `D9`):**
  - Cross-evaluates **`D10`** (status/trajectory), **`D2` (Hora)** (Sun Hora favoring self-driven/high-margin earning vs Moon Hora favoring steady institutional/cooperative cashflow), and **`D24`** (whether the role deepens durable expertise).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on the planetary significator of each offer type (e.g., Saturn/Sun for corporate vs Mars/Rahu for startup) to prevent *False Promise* (`d9_weakened`) traps.
- **Dasha Systems:** Inspects the *next* 2–3 years of `resolveActiveMahadasha` (`MD/AD` transitions) and `Narayana Dasha` sign shifts so the user does not pick a rigid corporate track right before a dynamic, risk-oriented Mahadasha begins (or vice versa). Evaluates 9x9 Matrix (`houseFromMd`) for stability vs disruption.
- **Transits (Gochar) & Ashtakavarga:** Evaluates Saturn's transit relative to 6th/10th (rewarding structured discipline) vs Rahu's transit over Lagna/10th (tempting high-risk leaps that require strong `SAV >= 30` scaffolding). Checks `BAV` bindus of 10th lord and `AmK`.
- **Tithi Pravesha (TP):** Checks `tpRowIn(view, tpInfo, 'D10')` and `tpRowIn(view, tpInfo, 'D2')` alongside TP `yearLord` and *Artha/Karya Siddhi* Sahams to judge whether this specific 12-month lunar return supports taking a bold bet or locking in steady cashflow.

#### Google Search Trends Synthesis
Synthesizes high-intent decision queries (*"which job offer should I take astrology"*, *"two job offers career birth chart"*, *"startup vs corporate astrology"*). Early-career seekers frequently struggle between prestigious brand names, higher starting salaries, and high-growth chaos; aligning planetary temperament with role architecture prevents 12-month regret.

#### Classical Attribution
- *BPHS* Ch. 6–7 (`D2` Hora, `D10` Dashamsha, `D24` Siddhamsha), Ch. 14–21 (2nd, 6th, 10th, 11th house interplay).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`AmK` dispositor, `AL` vs Lagna comparison).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Corporate service vs independent enterprise significations).
- *Lunar Astro / Deepanshu Giri* (*Blank Chart Prediction*) — Dispositor chains and multi-path outcome verification.

---

### Card 42: Overcoming Imposter Syndrome & Early Doubt
- **Card Key:** `start.imposter_syndrome`
- **Subtitle:** `Separating temporary confidence dips from your actual capability`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']` or `mood/stress` signals

#### Area of Focus
De-escalating early-career self-doubt, perfectionism, comparison anxiety, and fear of being "found out" as inexperienced during the first 1–3 years of professional life.

#### Oracle Question
> "What temporary pressure is amplifying self-doubt or making your capabilities feel smaller than they are, and when does your inner footing naturally steady?"

#### Personalizer Goal & Stance
- **Goal:** Normalize the beginner learning curve using `person_facts` (`work.status`, `age_band`). Validate why intellect feels sharp internally (`D24`) even while outer confidence (`D1` Lagna/Moon/Sun) feels tested by Saturnian critique or high standards.
- **Stance Logic:**
  - `build`: Triggered when `D24`/Mercury/Jupiter strength is confirmed and Moon/Lagna pressure is passing within the current TP window. Encourages visible output, asking mentors questions, and trusting preparation.
  - `get_through`: Triggered during *Kemadruma*, Saturn-Moon *Vish Yoga*, Sade Sati, or `6/8` AD stress. Advises micro-wins, documenting daily accomplishments objectively, and avoiding harsh self-judgment until the dated easing window.

#### Full-Circle Coverage
1. **Trigger:** Fear of failing in a first job, freeze response before speaking in meetings, or post-grad comparison spiral.
2. **Evidence & Diagnosis:** Separates genuine skill gaps (`D24`) from perceptual/emotional self-criticism (Moon/Saturn/Mercury/Lagna in `D1`).
3. **Behavioral Action:** Provides dated relief timelines (`PeriodStrip`) and concrete 4-tier confidence-grounding habits.
4. **Resolution:** Stabilizes the native for sustained execution in Card 40 (*Landing Your First Role*) or Card 44 (*Building Your 3-Year Foundation*).

#### Single Past-Event Calibration Question
> "Over the past few months, did receiving even minor critical feedback or stepping into an unfamiliar room trigger a wave of self-doubt out of proportion to your actual performance?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Anchor self-worth in honest daily learning and service rather than expecting instant perfection on day one.
- **Rajasic (Pragmatic Leverage):** Keep a factual "evidence log" of solved problems and positive feedback; ask clarifying questions early instead of pretending to know everything.
- **Mediocre (Passive/Mixed):** Overwork silently out of fear of exposure, or procrastinate on visible deliverables to avoid evaluation.
- **Baseline (Zero-Loss Floor):** Never resign, withdraw from teams, or decline growth assignments solely to escape temporary beginner discomfort.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Inspects Moon's Janma Nakshatra and Mercury's nakshatra for hypersensitive or perfectionist tendencies (e.g., *Hasta*, *Ashlesha*, *Moola*, *Pushya*, *Anuradha*). Evaluates whether the running AD/PD places the Moon under **Vipat** (3), **Pratyak** (5), or **Vadha** (7) Tara—especially **25th Manasa Nakshatra**—or near **Gandanta** degrees (`StarProfile.gandanta`), explaining spikes in mental second-guessing.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Checks `Moon` (*Manas*/emotional steadiness), `Sun` (healthy self-regard), `Mercury` (*Buddhi*/articulation), and `Lagna` lord dignity. Identifies *Kemadruma Yoga* (unaccompanied Moon), *Papakartari* on Lagna/Moon, Saturn aspecting Moon/Mercury (*Vish Yoga* / over-caution), or `AL` weakened relative to `Lagna` (feeling invisible or underestimated).
- **Divisional Charts (`D1`, `D24`, `D10`, `D9`):**
  - Classic diagnostic pattern: **Mercury or 5th lord strong/exalted in `D24` (high genuine competence) while afflicted, combust, or under Saturn's aspect in `D1` (difficulty projecting confidence externally)**. Also checks `D10` 1st vs 6th house friction.
  - **Age-36 Gate:** Pre-36, early *Graha Pakvata* (Moon at 24, Mars at 28, Mercury at 32) explains why confidence matures in stages rather than instantly. Post-36, checks `evaluateD1D9MutualConfirmation` on Moon/Lagna lord (`d9_redeemed` confirms hidden resilience behind surface doubt).
- **Dasha Systems:** Checks active `resolveActiveMahadasha` (`MD/AD`) for Ketu/Saturn sub-periods (self-questioning, feeling inadequate) vs upcoming Mercury/Jupiter/Sun sub-periods (restoration of voice and authority). Inspects 9x9 Matrix (`isShadAshtaka68`, `isDwirdwadasha212`) and Baladi/Jagradadi Avasthas (e.g., *Bala* infant or *Sushupti* sleeping Moon/Sun needing gentle nurturing).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Sade Sati** (especially Phase 1 & 2 over Moon), **Ashtama Shani** (Saturn 8th from Moon), or Saturn/Rahu transiting over natal Moon/Lagna/Mercury. Checks `SAV` in Lagna and 4th house (emotional container) and Moon's `BAV` ($\le 2$ marks heightened sensitivity; $\ge 5$ supports composure).
- **Tithi Pravesha (TP):** Evaluates TP Lagna, Moon placement in the TP chart, `yearLord` strength, and *Manas*/emotional markers across `[tp_start, tp_end]`. Names the exact *Tithi Ashtottari* sub-period where self-doubt clears into steady self-possession.

#### Google Search Trends Synthesis
Addresses empathetic, rapidly growing search clusters (*"imposter syndrome first job astrology"*, *"lack of confidence career birth chart"*, *"why do I feel not good enough for my job astrology"*). Young professionals searching these terms need reassurance grounded in structural chart evidence—proving that temporary self-doubt is a transit/maturation phenomenon rather than lack of ability.

#### Classical Attribution
- *BPHS* Ch. 3 & 12 (Chandra/Moon, Surya/Sun, Budha/Mercury psychological significations; Lagna Bhava), Ch. 45 (*Graha Pakvata* maturation ages 24/28/32/36).
- *Phaladeepika* Ch. 6 & 14 (Kemadruma, Chandra Bala, and Moon-Saturn mental pressure).
- *Prasna Marga* Ch. 24–26 (Psychological distress, Gandanta, and Manasa Nakshatra diagnostics).
- *Saravali* Ch. 13–18 (Planetary conjunctions affecting mind, speech, and confidence).

---

### Card 43: Relocation & Working Abroad
- **Card Key:** `start.relocation_abroad`
- **Subtitle:** `Moving cities or crossing borders for early-career acceleration`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']` or `person_facts.relocation_open === true`

#### Area of Focus
Evaluating whether leaving one's hometown, relocating to a major metro hub, or pursuing overseas work/visas accelerates early career trajectory—and identifying exact travel/relocation windows.

#### Oracle Question
> "Is relocating to a new city or working abroad astrologically supported to accelerate your early career, and which dated windows favor a smooth move?"

#### Personalizer Goal & Stance
- **Goal:** Use `person_facts` (`place`, `work.relocation_open`, `work.visa_status`) to give grounded guidance on domestic vs international moves—highlighting when distance unlocks opportunity (`Bhagya` away from birthplace) vs when staying anchored near home stabilizes the foundation first.
- **Stance Logic:**
  - `build`: Triggered when 3rd/9th/12th lords + Rahu align with `D10` and `D4` (change of residence) and TP `yearLord` / *Paradesa* indicators support mobility. Encourages applying to out-of-state/international hubs and finalizing leases/visas in peak windows.
  - `get_through`: Triggered when 4th house/*D4* shows severe instability without 9th/12th career reward, or active `6/8` AD risks visa/logistics friction. Advises thorough documentation checks and staging remote work or short visits before permanent uprooting.

#### Full-Circle Coverage
1. **Trigger:** Post-grad job offers in distant cities, international graduate-to-work visa deadlines, or feeling stagnant in one's hometown.
2. **Evidence & Diagnosis:** Weighs 4th house/*D4* rootedness against 3rd (short move), 9th (long-distance fortune), and 12th (foreign residence) activations tied to `D10`.
3. **Behavioral Action:** Maps relocation/visa windows on `PeriodStrip` and provides 4-tier transition execution rules.
4. **Resolution:** Connects relocated natives into Card 44 (*Building Your 3-Year Foundation*) or Card 54 (*Work Abroad & Remote Flexibility*) later in career.

#### Single Past-Event Calibration Question
> "In recent years, have your biggest academic or early professional breakthroughs happened after traveling away from your hometown—or only when operating close to familiar ground?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Move with clear purpose and cultural humility, keeping roots and family goodwill intact while stepping into wider horizons.
- **Rajasic (Pragmatic Leverage):** Target cities or international markets where your specific niche has dense demand; verify housing, visa timelines, and emergency buffers upfront.
- **Mediocre (Passive/Mixed):** Relocate impulsively to escape internal restlessness without a concrete job plan, or turn down clear growth opportunities out of hometown inertia.
- **Baseline (Zero-Loss Floor):** Never finalize binding long-term leases or cross-border transitions during contested *Vipat/Vadha* periods without backup clauses and legal verification.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of 4th, 9th, and 12th lords and Rahu: **Chara (Movable)** stars (*Swati, Punarvasu, Shravana, Dhanishta, Shatabhisha*) strongly accelerate relocation success; **Sthira (Fixed)** stars (*Rohini, Uttara Phalguni, Uttara Ashadha, Uttara Bhadrapada*) prefer deliberate, well-anchored moves. Checks *Tara Bala* of the active AD/PD lord for move dates.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **3rd house** (change of residence/short move), **4th house** (homeland/comfort), **9th house** (long-distance travel & fortune away from birth), and **12th house** (foreign lands/multinational hubs). Evaluates Rahu/Moon/12th-lord links to `10th`/`AmK` and `AL` placement in movable signs (`1/4/7/10`) vs fixed signs.
- **Divisional Charts (`D4`, `D10`, `D1`, `D9`):**
  - Core focus on **`D4` (Chaturthamsha)** (4th house/residence stability & domestic relocation) paired with **`D10` (Dashamsha)** (9th/12th houses showing whether career rises specifically in distant/foreign places).
  - **Age-36 Gate:** Pre-36 reads `D1 + D4 + D10`; if `ageYears > getD9MaturityAgeYears()`, verifies `D9` 9th/12th lords and active dasha lords via `evaluateD1D9MutualConfirmation` (checking *d9_redeemed* vs *d9_weakened* for overseas settlement).
- **Dasha Systems:** Checks `resolveActiveMahadasha` for **Rahu, Moon, or 9th/12th lord** MD/AD/PD activations, alongside *Narayana Dasha* entering movable rasis or the 9th/12th house from Lagna/`AL`. Inspects 9x9 Fruition Matrix for `3rd`, `9th`, or `12th` from MD.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Rahu/Ketu** transiting the 1st/7th, 3rd/9th, or 4th/10th axes (classic relocation triggers), Saturn moving off the 4th house (*Kantaka Shani* relocation), and Jupiter aspecting 9th/12th/4th. Checks `D1` 4th vs 9th/12th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Inspects TP Lagna (movable/dual signs favor transition), Muntha in 3rd/9th/12th, *Paradesa* / travel Sahams, and `tpRowIn(view, tpInfo, 'D4')` + `tpRowIn(view, tpInfo, 'D10')` within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses widespread youth mobility queries (*"should I move for a job astrology"*, *"relocating after college career chart"*, *"working abroad first job horoscope"*). Graduates weighing costly metro moves or visa lotteries seek clear astrological confirmation on whether uprooting creates real career acceleration.

#### Classical Attribution
- *BPHS* Ch. 6–7 (`D4` Chaturthamsha for residence/fortune), Ch. 15, 20, 23 (4th, 9th, and 12th houses for homeland vs foreign lands).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Rahu, Moon, 9th/12th house foreign residence significations).
- *Prasna Marga* Ch. 18 (Travel, relocation, and distance from birthplace).
- *Phaladeepika* Ch. 14 & 26 (4th/9th/12th house results and Saturn/Rahu transit relocations).

---

### Card 44: Building Your 3-Year Foundation
- **Card Key:** `start.three_year_foundation`
- **Subtitle:** `Locking in core habits, credentials, and credibility across your first career arc`
- **Default Placement:** Pinned (Starter Card #4) | **`showWhen`:** `work.status in ['student', 'recent_grad', 'early_career']`

#### Area of Focus
The 1-to-3-year strategic roadmap: surviving the chaotic first 36 months of adulthood, navigating the **Saturn Return** (ages ~27–30) or early *Graha Pakvata* milestones, and compounding real reputation rather than chasing shiny shortcuts.

#### Oracle Question
> "Over the next 1 to 3 years, what foundational skills, daily work habits, and professional credibility should you lock in—and what multi-year cycle is shaping your growth?"

#### Personalizer Goal & Stance
- **Goal:** Shift the early-career user out of 2-week panic loops into a calm 36-month compounding mindset tailored to `person_facts` (`age_band`, `work.field`). Demystify the Saturn Return and early Mahadasha shifts as constructive scaffolding.
- **Stance Logic:**
  - `build`: Upcoming 1–3 year MD/AD transitions move into Trikona/Kendra/Upachaya houses in `D10` and `D24`, with supportive Saturn/Jupiter alignment. Encourages deliberate specialization, mentor cultivation, and portfolio compounding.
  - `get_through`: Upcoming Saturn Return, *Ashtama Shani*, or `6/8` AD restructuring hits over the 1–3 year arc. Frames the stretch as essential foundation-digging—prioritizing debt avoidance, steady attendance, and craft mastery over quick titles.

#### Full-Circle Coverage
1. **Trigger:** Feeling behind peers at age 23–29, experiencing Saturn Return career pressure, or wanting a structured 3-year plan after landing a first role.
2. **Evidence & Diagnosis:** Synthesizes the multi-year `kundli_activation` horizon (next 1–3 years of MD/AD transitions), Saturn's orbital position, and `D24` + `D10` Upachaya (`3, 6, 10, 11`) growth engines.
3. **Behavioral Action:** Maps multi-year milestones (`PeriodStrip` + `KeyDates`) and delivers 4-tier foundational work ethics.
4. **Resolution:** Prepares the native to graduate smoothly from *Career Start* into *Primary Job & Corporate Growth* (Dashboard 06) or *Business & Venture* (Dashboard 08).

#### Single Past-Event Calibration Question
> "Over the past 2 to 3 years, did an older expectation of how fast your life would 'take off' give way to a slower, more realistic understanding of what real mastery requires?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Treat your first three years as an apprenticeship in integrity, patience, and deep craftsmanship—trusting that quiet consistency outlasts early flash.
- **Rajasic (Pragmatic Leverage):** Identify the two hardest, most scarce skills in your industry and deliberately take on unglamorous operational work to master them early.
- **Mediocre (Passive/Mixed):** Job-hop every six months at the first sign of boredom or critique, resetting your credibility clock before skills ever compound.
- **Baseline (Zero-Loss Floor):** Never neglect financial savings, basic reliability, or professional honesty while chasing rapid titles during testing Saturnian years.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates the nakshatra of **Saturn** (karmic endurance), the **10th lord**, and the **upcoming Mahadasha/Antardasha lords** over the 36-month horizon. Tracks *Pushkara Navamsha* degrees in `D1`/`D10` as hidden reservoirs of multi-year healing grace. Checks Navatara progression across upcoming AD shifts.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Centers on the **Upachaya houses (`3, 6, 10, 11`)**—which classically ripen through sustained effort—alongside `AmK`, `AK` (soul alignment), `A10` (evolving public stature), and **Pending Karma houses** (Saturn's sign, Saturn-aspected houses, Saturn's star houses, retrograde planets). Evaluates *Neecha Bhanga* setups where early struggle converts into long-term authority.
- **Divisional Charts (`D1`, `D10`, `D24`, `D9`):**
  - Cross-links `D24` (skill consolidation) with `D10` (institutional reputation) across a 3-year arc.
  - **Age-36 Gate:** Explicitly contextualizes **Graha Pakvata** (*Moon 24 -> Venus 25 -> Mars 28 -> Mercury 32 -> Saturn 36*). For natives approaching age 36 (`ageYears <= getD9MaturityAgeYears()`), explains how building structural integrity in `D1 + D10` prepares the ground for `D9` activation after `getD9MaturityAgeYears()`. For users already `> 36`, runs full `evaluateD1D9MutualConfirmation` on Saturn and the 3-year dasha lords.
- **Dasha Systems:** Scans `kundli_activation` forward **36 months** across `resolveActiveMahadasha` (conditional + *Vimshottari* + *Narayana Dasha* + *Yogini*) to catch upcoming **Mahadasha Sandhi** (chapter handoffs) and 9x9 Fruition shifts (`AntardashaFruitionCell`) well before they hit.
- **Transits (Gochar) & Ashtakavarga:** Tracks **Saturn Return** (transit Saturn approaching/crossing natal Saturn around ages 27.5–30.5), Saturn's 2.5-year sign ingresses relative to natal Moon (*Sade Sati* / *Kantaka*) and `D10` 10th house, plus Jupiter's 3-sign progression over the next 36 months (`activateDoubleTransit` windows). Evaluates `SAV` across Upachayas (`3, 6, 10, 11`).
- **Tithi Pravesha (TP):** Anchors Year 1 in the active `[tp_start, tp_end]` container (`AnnualRow.yearLord`, Muntha, `tpRowIn` for `D10`/`D24`) and maps how the current TP year sets the cornerstone for the subsequent 2 years of macro dasha unfolding.

#### Google Search Trends Synthesis
Addresses evergreen early-adult career searches (*"career roadmap next 3 years astrology"*, *"Saturn return career confusion late 20s"*, *"building a career in your 20s birth chart"*). Users in their 20s and early 30s search heavily for Saturn Return survival guidance and reassurance that slow early traction still leads to major mid-career breakthroughs.

#### Classical Attribution
- *BPHS* Ch. 11–21 (Upachaya houses 3, 6, 10, 11) & Ch. 45 (*Graha Pakvata* planetary maturation sequence culminating in Saturn at 36).
- *Phaladeepika* Ch. 20, slokas 12–15 (Planetary maturation and Dasha Sandhi transitions) & Ch. 26 (Saturn transit cycles).
- *Timing Events Through Vimshottari Dasha* (K.N. Rao) — Multi-year double-transit and dasha-sandhi synthesis.
- *Lunar Astro / Deepanshu Giri* (*Blank Chart Prediction*) — Pending Karma houses ruled/aspected by Saturn and multi-year dispositor unfolding.

---

## 4. Attribution & Source Credits Summary

| Source / Tradition | Author / Lineage | Scope Applied in Dashboard 05 |
| :--- | :--- | :--- |
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | `D24` Siddhamsha, `D10` Dashamsha, `D4` Chaturthamsha, Upachaya houses (`3/6/10/11`), *Graha Pakvata* (Ch. 45), Vimshottari & conditional dashas, Ashtakavarga (`SAV`/`BAV`). |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | `AmK` (Amatyakaraka), `PK` (Putrakaraka), Arudha Padas (`AL`, `A5`, `A6`, `A10`, `A11`), Rasi Drishti, Narayana/Chara Dashas. |
| *Phaladeepika* | Mantreswara | Planetary maturation (Ch. 20), Gochar/Saturn Return & Sade Sati (Ch. 26), Neecha Bhanga & Kemadruma diagnostics. |
| *Saravali* | Kalyana Varma | Multi-planet mental/confidence yogas (Card 42), Vargottama vs *Neecha Vargottama* dignity evaluation. |
| *Uttara Kalamrita* | Kalidasa | Subtle karakatvas of Mercury, Jupiter, Rahu, and 6th/9th/12th house foreign/service manifestations. |
| *Prasna Marga* | Panakkattu Namboodiri | Competitive victory (6th house interviews), Gandanta/Manasa Nakshatra diagnostics, Ashtakavarga transit filters. |
| *Tithi Pravesha: Vedic Annual Horoscopy* & *Crux of Vedic Astrology* | Pt. Sanjay Rath (Puri Tradition) | Annual lunar-solar return (`yearLord`, Muntha, Sahams, Tithi Ashtottari), `D24`-to-`D10` bridging, post-36 `D9` activation. |
| *Timing Events Through Vimshottari Dasha* | K.N. Rao | Jupiter-Saturn double transit (`S6D`) for first-break and 3-year career timing. |
| *Muhurta Chintamani* & *Muhurta* | Daivajna Rama / Dr. B.V. Raman | 27 Nakshatras, 9-Tara Navatara cycle, *Tara Bala* for interview/launch timing. |
| *Blank Chart Prediction* & *Predicting Through Nakshatras* | Lunar Astro / Deepanshu Giri | Dispositor chains, Pending Karma houses (Saturn links), sensitive points (`BB`, `K64M`, `KD22`). |
| Internal Architecture & Research Specs | AI AdAstra Engineering | `docs/reading-engine/76`, `docs/reading-engine/78`, `SOUL.md`, `src/reading/dasha/dashaAssessment.ts`, `src/reading/annual/tithiPravesha.ts`. |
