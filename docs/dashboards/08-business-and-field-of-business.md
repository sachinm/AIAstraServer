# Dashboard 08: Business, Venture & Field of Business (Entrepreneurship, Cashflow & Risk)

**Document ID:** `docs/dashboards/08-business-and-field-of-business.md`  
**Board Route:** `/work` → Lens: `business_venture` (`work.status` = `founder` | `business_owner` | `freelancer_agency` | `exploring_business`)  
**Card Range:** Cards 62–72 (11 Cards)  
**Primary Divisional Charts:** `D10` (Dashamsha — 1st, 7th, 11th commercial execution), `D2` (Hora — treasury, cashflow & profit margins), `D4` (Chaturthamsha — capital, leases & fixed assets), `D11` Proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th + `D2` pending engine `D11` export), `D30` (Trimshamsha — legal, tax, fraud & regulatory safeguards), `D24` (domain/industry intelligence), `D9` (Navamsha — mandatory joint `D1+D9` gate at `ageYears > getD9MaturityAgeYears()`)  
**Engine & Data Boundary:** All planetary coordinates, divisional vargas, dashas, double transits, Ashtakavarga bindus, Arudha padas, Chara Karakas, and Tithi Pravesha rows are pre-computed by the external sidereal ephemeris engine and consumed from `kundli_digest` (`DigestView`) and `kundli_activation`. Node.js performs **zero** astrological calculations.

---

## 1. Domain Architecture & Full-Circle Coverage Guarantee

The **Business, Venture & Field of Business** dashboard serves founders, solo consultants, agency owners, small-business operators, and professionals testing whether to leave employment for independent enterprise. Corporate employment (6th-house service) and entrepreneurship (3rd/7th/11th-house sovereign trade) run on fundamentally opposing Vedic engines:

1. **Employment (`6th`) vs. Enterprise (`3rd + 7th + 11th` + `D10` 1st/7th):** A chart can possess extraordinary 6th-house corporate discipline yet struggle with 7th-house client volatility, or vice versa. Card 62 explicitly tests this structural wiring before encouraging anyone to quit a steady paycheck.
2. **Multi-Varga Enterprise Engine (`D10` + `D2` + `D4` + `D11 Proxy` + `D30`):** Running a business requires five distinct divisional audits: market authority and commercial trade (`D10` 1st/7th), liquid working capital and margins (`D2` Hora), fixed infrastructure, real estate, and leases (`D4` Chaturthamsha), aggregate scale and revenue gains (`D11` proxy via `D1` 11th + `A11` + `D9` 11th + `D10` 11th + `D2`), and litigation/compliance/fraud risk (`D30` Trimshamsha).
3. **Rule 0 Counterparty Disambiguation (`SOUL.md` §2):** Co-founders, silent investors, enterprise clients, contractors, and regulators never get collapsed into one generic "7th house" blob—each is cleanly disambiguated across `D10` 7th/6th/11th, `A7`/`A10`/`A11`, `DK`/`AmK`, and nakshatra dispositors.
4. **Full-Circle Coverage Matrix (11 Cards):**
   - **Founder Identity & Industry Selection:** Cards **62** (*Job vs. Business Readiness*) and **63** (*Your Ideal Field & Industry of Business*).
   - **Launch Timing & Bold Expansion:** Cards **64** (*Timing Your Launch or Major Pivot*) and **70** (*Scaling, Risk & Bold Moves*).
   - **Economics, Sales & Infrastructure:** Cards **65** (*Revenue, Cashflow & Profit Margins*), **66** (*Clients, Sales & Market Pull*), and **69** (*Capital, Assets & Infrastructure*).
   - **Co-Founders & Team Building:** Cards **67** (*Co-Founders & Business Partnerships*) and **68** (*Hiring, Team & Delegation*).
   - **Compliance Risk & Founder Stamina:** Cards **71** (*Legal, Contracts & Financial Safeguards*) and **72** (*Founder Energy & Avoiding Burnout*).

### Default Pinned Cards & Sub-Technique Architecture
- **Default Pinned Starter Deck (5 Cards):**
  - If `work.status === 'exploring_business'`: `biz.readiness` (62), `biz.ideal_industry` (63), `biz.launch_timing` (64), `biz.cashflow_margins` (65), `biz.clients_sales` (66).
  - If active founder (`founder | business_owner`): `biz.cashflow_margins` (65), `biz.clients_sales` (66), `biz.scaling_risk` (70), `biz.legal_safeguards` (71), `biz.founder_burnout` (72) — with `biz.readiness` (62) and `biz.ideal_industry` (63) accessible in Card Picker.
- **Deterministic Sub-Technique Pipeline:** `work.sub.business_venture_ledger` executes once per `(kundliId, digest_version, asOf)`, extracting `D1 + D9 + D10 + D2 + D4 + D30 + D24` ledgers, `D11` proxy aggregations (`D1.11` + `A11` + `D9.11` + `D10.11`), active 40+ dashas, Five Clocks Concordance, and bounded TP containers into `technique_outputs`. Grouped LLM synthesis uses stable `parts[0]` prefix caching ($\ge 1,024$ tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and obeys 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES=45`).

---

## 2. Dashboard-Wide Rules: Age-36 Gate, Multi-Clock Dashas & Bounded Tithi Pravesha

1. **Age-36 Navamsha (`D9`) Gate (`getD9MaturityAgeYears()`, default `36`):**
   - For founders aged `> getD9MaturityAgeYears()`, **every** active dasha lord, annual TP `yearLord`, and key business planet (`7th lord`, `11th lord`, `2nd lord`, `AmK`, `DK`) **must** pass `evaluateD1D9MutualConfirmation`:
     - *Neecha Vargottama* (`confirmed_weak`, `-1.5`, *Drudha Karma*): Signals hard structural ceiling in high-leverage speculation—mandating cash-flow positive, low-debt business models.
     - *Exalted/Own Vargottama* (`confirmed_strong`, `+1.5`): Durable enterprise staying power across market cycles.
     - *Neutral/Friendly Vargottama* (`confirmed_strong`, `+1.0`): Reliable commercial compounding.
     - *Neecha Bhanga via D9* (`d9_redeemed`, `+1.2`): Early entrepreneurial failures or cash crunches converting into seasoned post-36 commercial authority.
     - *False Promise* (`d9_weakened`, `-1.0`): Flashy top-line hype (`D1`/`AL`) that masks thin unit economics (`D9`) unless disciplined by strict governance.
   - Pre-36 (`ageYears <= threshold`) weights `D1 + D10 + D2 + D4` primarily with `D9` advisory; unresolved birth date records `age_unresolved` and fails closed.
2. **Active 40+ Dasha Systems & 9x9 Fruition Matrix:**
   - Queries `resolveActiveMahadasha` across conditional dashas (especially *Chaturashiti Sama*, *Dwisaptati Sama* when 7th lord is in Lagna or Lagna lord in 7th—huge entrepreneurial/partnership signature), *Vimshottari*, *Narayana/Chara*, and *Yogini*. Evaluates 9x9 Matrix (`AntardashaFruitionCell`) and 5-system Avasthas (Baladi/Jagradadi `0.10x–1.00x`).
3. **Bounded Annual Tithi Pravesha (`TITHI_PRAVESHA_YEAR_RULE`):**
   - Slices the next 12 months into 3–6 engine-dated spans strictly within `[tp_start, tp_end]` ($\le 400$ days) via `runningTithiPravesha` and `tpRowIn(view, tpInfo, 'D10'|'D2'|'D4'|'D30')`. Zero Gregorian `01-01` .. `12-31` fallbacks. Unresolved `yearLord` or contested clocks fail closed to `stance = 'get_through'`.
4. **D11 (Ekadashamsha) Engine Proxy Note:**
   - Pending engine export of `D11` (`src/reading/chartData/catalog.ts`), all gain/scale/partnership-upside mechanics evaluate **`D1` 11th house + `A11` (Labha Pada) + `D9` 11th + `D10` 11th + `D2` Hora** cleanly without failing.
5. **Implementation Dependencies (`FACT_CATALOG`, `SERVED_VARGAS`, `ANNUAL_CHART_VARGAS`):**
   - **`FACT_CATALOG` (`src/profile/facts.ts`):** `FACT_CATALOG` defines `'work.status': ['yes', 'between_jobs', 'own_business', 'studying', 'retired']` and `'work.level': [..., 'owner_alone', 'owner_staff', 'several_businesses']`. Spec tokens (`founder`, `business_owner`, `freelancer_agency`, `exploring_business`) map onto `work.status === 'own_business'` + `work.level` (or `self.focus` / `yes` for `exploring_business`), while optional Personalizer keys (`work.runway_months`, `work.has_cofounder`, `work.team_size`) require additive `FACT_CATALOG` entries before `checkFact` persistence.
   - **`SERVED_VARGAS` & `ANNUAL_CHART_VARGAS`:** `src/reading/chartData/catalog.ts:133` currently sets `SERVED_VARGAS = {1, 2, 4, 7, 9, 10}` and `src/reading/digest/annualSet.ts:11` sets `ANNUAL_CHART_VARGAS = [1, 9, 10]`. Live natal pulls for `D30`, `D24`, and `D11`—plus annual TP divisional pulls (`tpRowIn`) for `D2`, `D4`, `D24`, and `D30`—depend on `docs/reading-engine/80` R1–R4 (`SERVED_VARGAS_LIST`, varga house/dignity fields, `kind === 'TP'` `yearLord` parsing, and `ANNUAL_CHART_VARGAS` expansion), falling back safely to served `D1 + D9 + D10 + D2 + D4` until unlocked.

---

## 3. Complete Card Specifications (Cards 62–72)

---

### Card 62: Job vs. Business Readiness
- **Card Key:** `biz.readiness`
- **Subtitle:** `Whether your wiring favors sovereign business ownership, employment, or a staged hybrid`
- **Default Placement:** Pinned when `exploring_business`; Card Picker when active founder | **`showWhen`:** `work.status in ['exploring_business', 'founder', 'business_owner', 'freelancer_agency', 'employed']`

#### Area of Focus
Diagnosing core entrepreneurial readiness—weighing independent risk appetite, autonomy need, and income volatility tolerance against steady salaried structure, and mapping a safe staged transition if warranted.

#### Oracle Question
> "Does your chart's deeper wiring favor full-time business ownership, steady salaried leadership, or building an independent venture alongside employment first?"

#### Personalizer Goal & Stance
- **Goal:** Prevent both reckless "quit your job tomorrow with zero runway" leaps and lifelong frustration among people genuinely wired for independent ownership (`person_facts`: `work.status`, `work.runway_months`, `age_band`).
- **Stance Logic:**
  - `build`: 3rd/7th/11th + `D10` 1st/7th + `D2` + Sun/Mars/Mercury/Rahu strength clearly outweigh 6th-house service dependence, backed by strong TP `yearLord`. Supports active transition planning or sovereign ownership.
  - `get_through`: Strong 6th-house service reliance with volatile 8th/12th exposure or `6/8` AD / weak `yearLord`. Recommends consulting, fractional retainers, or building side-revenue to 50%+ of salary before leaving salaried protection.

#### Full-Circle Coverage
1. **Trigger:** Asking "Am I actually meant to be an entrepreneur, or should I stay in high-paying employment?"
2. **Evidence & Diagnosis:** Compares **6th house** (service/employment) vs **3rd** (courage/risk) + **7th** (independent trade) + **11th** (enterprise scale) + **`D10` 1st/7th** + **`D2` Hora**.
3. **Behavioral Action:** Maps transition-readiness milestones (`PeriodStrip`) and 4-tier jump-or-stage protocols.
4. **Resolution:** Connects validated founders directly into Card 63 (*Ideal Field*) and Card 64 (*Timing Launch*), or directs employment-aligned natives smoothly to Dashboard 06 (*Primary Job*).

#### Single Past-Event Calibration Question
> "In past roles, did you feel most energized when owning an uncertain outcome from scratch with full autonomy—or did you perform at your peak when steady institutional structure covered the operational downside?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Choose sovereignty out of genuine service and craftsmanship rather than ego rebellion against bosses or get-rich-quick impatience.
- **Rajasic (Pragmatic Leverage):** Validate demand with paying customers and build 9–12 months of liquid personal runway before handing in corporate notice.
- **Mediocre (Passive/Mixed):** Romanticize entrepreneurship for years without ever selling a single dollar on the side, or burn a stable career overnight with zero unit-economics proof.
- **Baseline (Zero-Loss Floor):** Never co-sign personal guarantees or liquidate core family reserves during a `get_through` launch window without tested cashflow.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Compares nakshatras of `Lagna`, `AmK`, `D10` Lagna, and `10th lord`. Dynamic/initiative stars (*Ashwini, Mrigashira, Chitra, Swati, Dhanishta, Purva Phalguni*) thrive in independent commerce; disciplined service/institutional stars (*Pushya, Anuradha, Shravana, Uttara Ashadha*) excel inside structured leadership or disciplined consulting practices.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Direct comparison of **6th house** (*Dasya* / service to an employer) vs **3rd house** (self-initiated risk), **7th house** (direct marketplace trade), and **1st/10th/11th** independence. Evaluates **Sun** (sovereignty), **Mars** (risk appetite), **Mercury** (commerce), and **Rahu** (disruption) vs **Saturn** (employee discipline). Checks `AL` vs `A7` vs `A10`.
- **Divisional Charts (`D10`, `D2`, `D1`, `D9`):**
  - Core structural test: **`D10` Lagna & 7th house** (self-directed enterprise) vs **`D10` 6th house** (salaried service). Checks **`D2` (Hora)**—Sun Hora abundance favors self-generated enterprise; Moon Hora favors steady institutional/partner cashflow.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, enforces `evaluateD1D9MutualConfirmation` on Lagna lord, 7th lord, `AmK`, and active dasha lord (`d9_redeemed` empowers mid-life corporate-to-founder transitions; *Neecha Vargottama* cautions against excessive leverage).
- **Dasha Systems:** Checks `resolveActiveMahadasha` for **Dwisaptati Sama** (7th-1st link favoring independent partnerships/business) or *Vimshottari*/*Narayana* shifts away from 6th-house service into 3rd/7th/10th/11th enterprise periods.
- **Transits (Gochar) & Ashtakavarga:** Compares `HouseCard.sav` of **6th house** vs **7th/11th houses** (classical `7H + 11H > 6H + 12H` favors independent commerce). Monitors Jupiter/Saturn double transit onto 7th/10th/11th.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` 6th vs 7th, `yearLord` strength, and *Karya Siddhi*/*Artha* Sahams within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Directly answers the #1 pre-founder astrology query cluster (*"job vs business astrology"*, *"am I meant to be an entrepreneur birth chart"*, *"should I quit my job to start a business horoscope"*). Users on the cusp of leaving salaried stability need an honest, unsycophantic structural check before risking savings.

#### Classical Attribution
- *BPHS* Ch. 17–21 (6th service vs 3rd/7th/11th independent enterprise), Ch. 7 (`D10` & `D2` Hora).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` 6th (service) vs 7th (business) rule and Sun/Moon Hora.
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`AmK`, `A7`, `A10`, `Dwisaptati Sama` conditions).
- *Phaladeepika* Ch. 17 & 19 (Service vs independent livelihood combinations).

---

### Card 63: Your Ideal Field & Industry of Business
- **Card Key:** `biz.ideal_industry`
- **Subtitle:** `Specific commercial sectors, B2B vs B2C models, and product vs advisory fit`
- **Default Placement:** Pinned when `exploring_business`; Card Picker when active founder | **`showWhen`:** `work.status in ['exploring_business', 'founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Pinpointing the exact commercial sectors, revenue models (services/advisory vs software/digital vs physical manufacturing/real estate/trade), and market positioning where the founder enjoys unfair natural advantage.

#### Oracle Question
> "Which specific business sectors, commercial models, and revenue vehicles align most powerfully with your chart's strengths right now?"

#### Personalizer Goal & Stance
- **Goal:** Narrow down abstract "business" curiosity into concrete, testable commercial verticals tailored to `person_facts` (`work.background`, `work.capital_tier`)—explaining *why* one founder thrives in high-margin B2B SaaS/advisory while another dominates physical real estate, logistics, or consumer aesthetics.
- **Stance Logic:**
  - `build`: Clear dominant planetary/elemental concentration in `D10` + `AmK` + `D24` + supportive TP `yearLord`. Encourages committing deeply to the aligned vertical and refining core positioning.
  - `get_through`: Split planetary pulls across conflicting sectors or active `6/8` AD fog. Recommends starting with low-capex service/advisory cashflow in your proven domain before locking capital into unfamiliar inventory-heavy sectors.

#### Full-Circle Coverage
1. **Trigger:** Deciding what business to start, pivoting a stagnant agency/startup into a sharper niche, or choosing between B2B services vs physical products.
2. **Evidence & Diagnosis:** Synthesizes **elements (`Fire/Earth/Air/Water`)**, **`AmK`**, **10th/7th/2nd lords**, **`D10` strongest planets**, and **`D24` domain mastery**.
3. **Behavioral Action:** Delivers sector-fit rankings, model recommendations, and 4-tier positioning rules.
4. **Resolution:** Feeds directly into Card 64 (*Timing Your Launch*) and Card 66 (*Clients & Market Pull*).

#### Single Past-Event Calibration Question
> "Looking back at work or projects you've done before, did money flow most easily when selling intangible expertise/strategy, building digital/technical systems, or trading/managing physical goods and property?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Build a venture solving real, durable human needs in a domain where your natural integrity and depth create genuine value.
- **Rajasic (Pragmatic Leverage):** Pick the specific sub-niche where your chart's top two planetary archetypes intersect (e.g., Mercury+Saturn = B2B compliance/fintech tooling; Venus+Moon = hospitality/consumer design).
- **Mediocre (Passive/Mixed):** Chase whatever hype industry is trending this quarter despite zero planetary or skill alignment.
- **Baseline (Zero-Loss Floor):** Never enter high-regulation, heavy-inventory, or litigious sectors without domain experts if your chart lacks `D4`/`D30` structural insulation.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Maps nakshatra archetypes of `AmK`, `10th lord`, and `D10` Lagna/10th occupants:
  - *Rahu / Mercury / Air stars (Ardra, Swati, Shatabhisha, Revati, Jyeshtha)*: AI, software, SaaS, logistics, media, digital marketplaces, brokerage.
  - *Saturn / Mars / Earth stars (Rohini, Pushya, Anuradha, Uttarabhadrapada, Dhanishta)*: Real estate, construction, manufacturing, defense, hardware, energy, infrastructure.
  - *Jupiter / Sun / Fire stars (Krittika, Magha, Punarvasu, Vishakha, Purva Bhadrapada)*: Executive advisory, fintech/banking, education, legal/healthcare institutions.
  - *Venus / Moon / Water stars (Bharani, Purva Phalguni, Shravana, Hasta)*: Consumer brands, hospitality, luxury, wellness, food, design agencies.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Inspects **10th** (core industry), **7th** (trade model: B2B partnerships vs retail), **2nd** (value proposition), **`AmK`** (functional instrument), **`A10`** & **`A7`**. Evaluates *Budhaditya*, *Panchamahapurusha* (*Bhadra* = commerce/media, *Ruchaka* = engineering/realty, *Sasa* = manufacturing/operations, *Malavya* = aesthetics/consumer, *Hamsa* = advisory/finance).
- **Divisional Charts (`D10`, `D24`, `D4`, `D2`, `D1`, `D9`):**
  - Core matrix: Strongest dignified planets in **`D10` (1st, 7th, 10th, 11th)** crossed with **`D24`** (domain intelligence) and **`D4`** (if physical/real-estate heavy).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, validates industry-ruling planets via `evaluateD1D9MutualConfirmation`—avoiding sectors ruled by a *False Promise* (`d9_weakened`) planet in favor of `confirmed_strong` or `d9_redeemed` sectors.
- **Dasha Systems:** Aligns industry selection not only with natal strengths, but with the **current + next 10-year `resolveActiveMahadasha`** (e.g., entering tech/global services as Rahu/Mercury MD opens; shifting toward real assets/advisory under Saturn/Jupiter MD).
- **Transits (Gochar) & Ashtakavarga:** Checks transit Jupiter and Rahu activating specific sector houses (`3/7/10/11`) and `HouseCard.sav` across 2nd, 7th, 10th, and 11th houses.
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` strongest planet, `AnnualRow.yearLord`, and *Artha/Karya Siddhi* Sahams inside `[tp_start, tp_end]` to pick the cleanest *initial wedge* market for this year.

#### Google Search Trends Synthesis
Directly addresses one of the highest-intent commercial searches globally (*"best business field astrology"*, *"which business is lucky for me by date of birth"*, *"business domain horoscope"*). Aspiring founders want data-grounded sector filtering instead of vague "you'd be good at anything" flattery.

#### Classical Attribution
- *BPHS* Ch. 3 (Planetary elements, professions & industries), Ch. 7 (`D10`, `D24`, `D4`), Ch. 37 (*Panchamahapurusha Yogas*).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Exhaustive catalog of trades, commodities, sciences, and professions per planet).
- *Saravali* Ch. 30–35 (Planetary combinations producing specific commercial domains).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` occupational/industry synthesis & `AmK`.

---

### Card 64: Timing Your Launch or Major Pivot
- **Card Key:** `biz.launch_timing`
- **Subtitle:** `Best quarters to incorporate, open doors, or launch a flagship product`
- **Default Placement:** Pinned when `exploring_business`; Card Picker when active founder | **`showWhen`:** `work.status in ['exploring_business', 'founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Selecting auspicious incorporation, public launch, store opening, fundraising announcement, or major product-pivot windows—distinguishing quiet internal R&D stretches from prime public market-entry dates.

#### Oracle Question
> "During which specific dated windows is incorporating, publicly launching, or executing a major commercial pivot most strongly supported by your chart?"

#### Personalizer Goal & Stance
- **Goal:** Provide founder-grade launch sequencing (`person_facts`: `work.launch_stage`, `work.industry`)—preventing public launches during dead-end retrograde/Vipat stretches while sharpening readiness so the founder hits open windows at full speed.
- **Stance Logic:**
  - `build`: TP `yearLord` rules or aspects 7th/10th/11th in `D10`, active AD/PD links 7th/10th/11th with `D2`, Jupiter/Saturn double transit supports 10th/11th, and concordance is `confirmed`. Green-lights incorporation, public launches, and PR pushes inside named `KeyDates`.
  - `get_through`: Retrograde Mercury/Venus muddling contracts, `6/8`/`2/12` AD strain, or weak/unresolved TP `yearLord`. Advises private beta testing, stealth building, and legal preparation until the clean launch window opens.

#### Full-Circle Coverage
1. **Trigger:** Setting an incorporation date, product launch, storefront opening, or strategic pivot announcement.
2. **Evidence & Diagnosis:** Intersects **Tithi Pravesha `yearLord`** + `TP D10` + **MD/AD/PD** + **Double Transit (`S6D`)** + **Navatara *Tara Bala***.
3. **Behavioral Action:** Lists 3–6 stealth-vs-launch spans (`PeriodStrip` + `KeyDates <= 6`) and 4-tier launch discipline.
4. **Resolution:** Hands off post-launch directly into Card 65 (*Revenue & Cashflow*) and Card 66 (*Clients & Sales*).

#### Single Past-Event Calibration Question
> "Thinking back to an earlier project, product, or career milestone you launched publicly, did initiatives started smoothly with unhurried prep hold up better—or did rushed starts under heavy pressure require costly rework?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Launch with honest product substance, clear promises, and readiness to serve customers reliably from day one.
- **Rajasic (Pragmatic Leverage):** Separate *stealth engineering/legal setup* from *public launch announcements*—aligning public go-live and contract signings strictly with supportive *Sampat/Sadhaka/Mitra* windows.
- **Mediocre (Passive/Mixed):** Keep endlessly delaying launch out of perfectionism past open windows, or rush an untested launch solely to hit an arbitrary calendar date during chaotic transits.
- **Baseline (Zero-Loss Floor):** Never sign foundational incorporation charters, IP assignments, or irreversible vendor contracts during *Vadha/Vipat* periods without double legal review.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Applies classical *Muhurta* launch filters over the founder's natal Moon via `StarProfile.taras`: targets **Sampat** (2), **Kshema** (4), **Sadhaka** (6), **Mitra** (8), and **Param Mitra** (9) Taras for public go-live dates; flags **Vipat** (3), **Pratyak** (5), and **Vadha** (7) for quiet internal work. Favors *Pushya, Rohini, Ashwini, Hasta, Uttara Phalguni, Shravana, Revati* for enduring commercial starts.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Checks **10th house** (public launch/impact), **7th house** (commercial marketplace), **11th house** (early customer adoption/cashflow), **`A10`** & **`A7`**, and **Mercury** (commerce/agreements). Ensures 8th/12th lords do not dominate the launch sub-period.
- **Divisional Charts (`D10`, `D2`, `D1`, `D9`):**
  - Requires alignment across **`D10` (1st/7th/10th/11th)** and **`D2` (Hora)** so public visibility turns into liquid revenue rather than vanity press.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on active dasha lords and TP `yearLord`—ensuring launches after 36 sit on `confirmed_strong` or `d9_redeemed` foundations.
- **Dasha Systems:** Drills to **Levels 3–6 (PD/Sookshma/Prana)** via `resolveActiveMahadasha` for exact week/month launch dates, checking 9x9 Matrix (`1/5/9`, `4/7/10`, `2/11` from MD) and Five Clocks Concordance ($\ge 3$ clocks agreeing = `confirmed`).
- **Transits (Gochar) & Ashtakavarga:** Monitors `activateDoubleTransit` (`S6D`) onto `D1` 10th/11th/7th or `D10` Lagna/10th, tracks retrograde Mercury/Venus/Mars caution zones, and checks `HouseCard.sav` ($\ge 30$ in 10th/11th) + `BAV` ($\ge 5$).
- **Tithi Pravesha (TP):** Inspects `runningTithiPravesha` (`AnnualRow.yearLord` ruling or aspecting 7th/10th/11th in `tpRowIn(view, tpInfo, 'D10')`), **Karya Siddhi Saham** & **Artha Saham**, Muntha in 10th/11th, and *Tithi Ashtottari* launch sub-periods inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Captures urgent pre-launch founder queries (*"best date to start a business astrology"*, *"business launch timing horoscope"*, *"when should I incorporate my company astrology"*). Founders investing time and capital want clear timing gates distinguishing "build quietly" from "ship publicly."

#### Classical Attribution
- *Muhurta Chintamani* & *B.V. Raman — Muhurta* (Tara Bala, Panchanga, and business *Vyapara Muhurta* rules).
- *Tithi Pravesha* (Pt. Sanjay Rath) — `yearLord`, *Karya Siddhi Saham*, `TP D10` launch windows.
- *Timing Events Through Vimshottari Dasha* (K.N. Rao) — Double transit (`S6D`) + Level 3–4 dasha launch triggers.
- *BPHS* Ch. 7 & 20–21 (`D10`, `D2`, 7th/10th/11th houses).

---

### Card 65: Revenue, Cashflow & Profit Margins
- **Card Key:** `biz.cashflow_margins`
- **Subtitle:** `Liquidity velocity, pricing power, and navigating lean stretches cleanly`
- **Default Placement:** Pinned (Starter Card) | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency', 'exploring_business']`

#### Area of Focus
Managing venture economics—top-line revenue velocity (`11th` / `D11` proxy), gross profit margins and retained cash reserves (`2nd` / `D2` Hora), pricing power, and anticipating thin working-capital stretches before they become crises.

#### Oracle Question
> "What is the cashflow and profitability rhythm of your business over the next 12 months, and which dated stretches call for tighter cash reserves versus bold pricing and collection?"

#### Personalizer Goal & Stance
- **Goal:** Give founders realistic treasury foresight (`person_facts`: `work.business_model`, `work.cash_buffer`)—separating high-revenue/low-margin traps (`11th` strong, `12th` bloated, `2nd` weak) from healthy compounding profit.
- **Stance Logic:**
  - `build`: `D2` (Hora) + 2nd/11th + `D11` proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th) aligned with Jupiter/Venus/Mercury support and strong TP `yearLord`. Advises raising prices, expanding high-margin tiers, and reinvesting surplus wisely.
  - `get_through`: 12th-house burn/overhead spikes, `2/12` AD tension, or weak/afflicted TP *Artha* indicators. Advises aggressive receivables collection, cutting bloated SaaS/overhead, pausing non-ROI experiments, and holding cash reserves through the lean stretch.

#### Full-Circle Coverage
1. **Trigger:** Cashflow crunch, receivables delays, pricing uncertainty, or planning annual operating budgets.
2. **Evidence & Diagnosis:** Balances **11th house (`D11` proxy)** (gross revenue) against **2nd house (`D2` Hora)** (net retained cash) and **12th house** (burn rate/overhead).
3. **Behavioral Action:** Maps surplus vs tight-liquidity stretches (`PeriodStrip`) with 4-tier treasury management rules.
4. **Resolution:** Connects surplus windows to Card 69 (*Capital & Assets*) or Card 70 (*Scaling & Risk*).

#### Single Past-Event Calibration Question
> "Over the past year, did your business experience a stretch where top-line activity looked busy on the surface, yet delayed client payments or rising overhead kept actual net cash tighter than expected?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Price fairly for genuine transformation, pay vendors/team promptly, and steward business treasury with zero greed or panic.
- **Rajasic (Pragmatic Leverage):** Track weekly net cash runway and gross margins relentlessly; enforce upfront deposits/milestones before lean *Dwirdwadasha* stretches hit.
- **Mediocre (Passive/Mixed):** Confuse gross vanity revenue with net profit, underprice out of imposter fear, or spend aggressively after one good month.
- **Baseline (Zero-Loss Floor):** Never commingle personal emergency reserves with speculative business burn or ignore tax withholdings during tight cash quarters.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Evaluates nakshatras of 2nd, 11th, and 12th lords, Jupiter, and `A11`. **Sampat** (2/11/20) and **Sadhaka** (6/15/24) Taras mark prime invoicing, fee-increase, and collection weeks; **Vipat** (3) and **Vadha** (7) warn against extending unsecured credit terms.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Checks **2nd house** (retained capital/margins), **11th house** (top-line revenue/receivables), **12th house** (overhead/losses/burn), **`A2`**, **`A11` (Labha Pada)**, and **Jupiter** (*Dhana Karaka*). Evaluates classical *Dhana Yogas* vs *Daridra/12th-burn* drains (`11th lord in 12th` or `2nd lord in 6/8/12`).
- **Divisional Charts (`D2`, `D10`, `D1`, `D9`, `D11 Proxy`):**
  - Primary financial engine: **`D2` (Hora)** (planetary distribution across Sun Hora active-revenue vs Moon Hora reserve-building) combined with **`D10` 2nd/11th** and **`D11` proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th)** pending engine `D11` export.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on 2nd/11th lords and Jupiter (`confirmed_strong` stabilizes multi-year wealth retention; *False Promise* warns against thin-margin ego scaling).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`2nd`, `11th`, `5th`, `9th`, or `12th` lord periods), checking 9x9 Matrix (`2/11` *Dhana/Labha* vs `2/12` *Dwirdwadasha* burn) and Baladi/Jagradadi Avasthas (`Yuva 1.00x` vs `Mrita 0.10x` reducing expected payouts).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting 2nd/5th/9th/11th (margin expansion), **Saturn/Rahu** transiting 2nd/12th (tightening cash or surprise expenses), and the classic **`11H SAV` vs `12H SAV`** ratio (`11H > 12H` = positive net cashflow; `12H >= 11H` = margin compression requiring strict cost control).
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D2')` and `tpRowIn(view, tpInfo, 'D10')`, **Artha Saham** & **Labha Saham**, `yearLord` dignity, and *Tithi Ashtottari* cashflow stretches inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Serves high-stakes founder queries (*"business profit astrology"*, *"cashflow problems business horoscope"*, *"when will my business make money birth chart"*). Small business owners and founders don't just ask "will I be rich?"—they want foresight on tight quarters versus collection/margin surges.

#### Classical Attribution
- *BPHS* Ch. 7 (`D2` Hora), Ch. 13, 21, 23 (2nd treasury, 11th revenue, 12th expenses), Ch. 66–72 (`11H vs 12H` Ashtakavarga savings rule).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A2`, `A11` Labha Pada).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Artha Saham*, `TP D2` Hora, and annual cashflow pacing.
- *Phaladeepika* Ch. 14 & 26 (2nd/11th house Dhana fruition and Jupiter Gochar).

---

### Card 66: Clients, Sales & Market Pull
- **Card Key:** `biz.clients_sales`
- **Subtitle:** `Inbound demand, closing high-value deals, and positioning that wins trust`
- **Default Placement:** Pinned (Starter Card) | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency', 'exploring_business']`

#### Area of Focus
Commercial traction—inbound customer magnetism, enterprise sales closing, conversion messaging, and understanding when market demand rises organically versus when outbound hustle and positioning tweaks are required.

#### Oracle Question
> "When will market demand and client acquisition accelerate over the next 12 months, and what positioning or outreach approach builds the deepest buyer trust?"

#### Personalizer Goal & Stance
- **Goal:** Optimize sales cadence (`person_facts`: `work.sales_motion`, `work.target_buyer`)—helping founders time major campaigns, product drops, and flagship sales pitches to high-conversion 7th/`A7`/`A10` windows.
- **Stance Logic:**
  - `build`: 7th/`A7`/`A10`/Mercury/Venus alignment in `D1 + D10`, supported by Jupiter transit and strong TP `yearLord`. Advises ramping outbound demos, speaking engagements, and closing enterprise contracts.
  - `get_through`: Retrograde Mercury/Venus, 6th/8th friction on 7th/`A7`, or contested TP window slowing deal cycles. Advises nurturing existing accounts for referrals/upsells and tightening pitch decks rather than burning ad spend on cold traffic.

#### Full-Circle Coverage
1. **Trigger:** Dry sales pipeline, slow deal velocity, or launching a new marketing/outbound campaign.
2. **Evidence & Diagnosis:** Evaluates **7th house** (buyers/clients), **`A7` (Dara Pada)** (commercial allure), **`A10`** (brand credibility), **Mercury** (sales copy/negotiation), and **Venus** (attraction) across `D1 + D10`.
3. **Behavioral Action:** Maps peak closing windows (`PeriodStrip` + `KeyDates`) and delivers 4-tier commercial selling ethics.
4. **Resolution:** Feeds closed client demand directly into Card 65 (*Cashflow*) and Card 68 (*Hiring & Delegation*).

#### Single Past-Event Calibration Question
> "Looking back over the past year, did your best clients find you through warm inbound reputation and word-of-mouth—or did they convert primarily through direct, structured outbound pitching?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Sell from genuine conviction in how your product helps the buyer; never oversell capabilities or manipulate urgency.
- **Rajasic (Pragmatic Leverage):** Focus outreach on ideal buyer segments aligned with `A7`/`D10` 7th during peak *Mitra/Sampat* windows, pairing clear ROI case studies with crisp follow-up cadences.
- **Mediocre (Passive/Mixed):** Hide behind endless website redesigns instead of talking to buyers, or slash prices desperately whenever deals take longer to close.
- **Baseline (Zero-Loss Floor):** Never accept misaligned toxic clients out of desperation during a slow quarter—bad-fit buyers consume support capacity and stall better referrals.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Inspects nakshatras of `7th lord`, `A7`, Mercury, and Venus. *Vaishya* / communicative stars (*Rohini, Mrigashira, Swati, Hasta, Shravana, Revati*) confer natural commercial magnetism; **Mitra** (8), **Param Mitra** (9), and **Sadhaka** (6) Taras boost sales close rates.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **7th house** (public trade & clients), **10th house** (brand authority), **3rd house** (marketing/sales copy/campaigns), **`A7` (Dara Pada — public buyer perception)**, **`A10`**, **Mercury** (persuasion), and **Venus** (appeal). Checks *Mercury-Venus* and *Lagna-7th* mutual exchange/aspects.
- **Divisional Charts (`D10`, `D1`, `D9`):**
  - Core commercial engine: **`D10` 7th house, 3rd house, and `A7`** crossed with `D1` 7th/`A7`. Strong `D10` 7th attracts sophisticated enterprise/long-term clients; afflicted `D10` 7th requires tighter contract scoping.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on 7th lord, Mercury, and Venus (`confirmed_strong` turns brand trust into compounding word-of-mouth referrals).
- **Dasha Systems:** Tracks `resolveActiveMahadasha` (`7th lord`, `Mercury`, `Venus`, `10th lord`, or `11th lord` periods), checking 9x9 Matrix (`4/7/10` *Kendra* and `2/11` *Labha* links) and *Narayana Dasha* hitting `A7` or 7th.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting/aspecting 7th/11th/`A7` (high-trust enterprise deals), **Venus** & **Mercury** direct transits through 1st/7th/10th/11th, and `D1` & `D10` 7th `HouseCard.sav` ($\ge 30$ strong inbound pull).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` 7th/3rd/11th houses, *Yashas* / *Mitra* Sahams, `yearLord` links to Mercury/7th, and *Tithi Ashtottari* campaign windows within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses urgent revenue-growth queries (*"how to attract more clients astrology"*, *"business sales growth horoscope"*, *"customer acquisition birth chart"*). Founders and freelancers want to know both *when* buyers open their wallets and *how* their chart naturally attracts deals (inbound thought-leadership vs direct outreach).

#### Classical Attribution
- *BPHS* Ch. 18 & 20 (7th *Vyapara*/trade & 10th public visibility).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A7` Dara Pada, `A10` Rajya Pada).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Mercury commercial communication, Venus customer attraction).
- *Tithi Pravesha* (Pt. Sanjay Rath) — `TP D10` 7th house & *Mitra*/*Yashas* Sahams.

---

### Card 67: Co-Founders & Business Partnerships
- **Card Key:** `biz.partnerships_fit`
- **Subtitle:** `Whether to go solo or partner up, equity alignment, and governance safeguards`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['founder', 'business_owner', 'exploring_business']`

#### Area of Focus
Evaluating co-founder and equity-partner dynamics—diagnosing whether bringing on a business partner multiplies enterprise value or breeds deadlock, and establishing explicit governance before signing cap tables.

#### Oracle Question
> "Does sharing ownership with a business partner or co-founder strengthen your enterprise right now, and what governance terms or timing protect the relationship?"

#### Personalizer Goal & Stance
- **Goal:** Apply `SOUL.md` Rule 0 to screen co-founder compatibility objectively (`person_facts`: `work.has_cofounder`, `work.seeking_partner`)—preventing naive 50/50 handshake deals when `D30` or 7th-house friction indicates future equity disputes.
- **Stance Logic:**
  - `build`: Harmonious `D10` 7th house + supportive `11th`/`D11` proxy gains + clean `D30` 7th + strong TP `yearLord`. Supports formalizing complementary partnerships (especially where partner skills fill the founder's blind spots).
  - `get_through`: Malefics in `D10` 7th/8th, `D30` 7th litigation signatures, `6/8` AD tension, or `d9_weakened` 7th lord. Recommends going solo with hired contractors/advisors—or enforcing strict vesting cliffs, clear tie-breaker voting, and buyout clauses before partnering.

#### Full-Circle Coverage
1. **Trigger:** Considering a co-founder split, onboarding a strategic equity partner, or experiencing early co-founder tension.
2. **Evidence & Diagnosis:** Inspects **`D10` 7th house/lord**, **`A7`**, **`DK`**, **`D11` proxy gains**, and **`D30` 7th house** (partnership disputes/breach).
3. **Behavioral Action:** Maps partnership formation vs conflict-test dates (`PeriodStrip`) and prescribes 4-tier governance rules.
4. **Resolution:** Connects equity disputes requiring legal armor directly to Card 71 (*Legal & Contracts*).

#### Single Past-Event Calibration Question
> "In past group ventures or shared business arrangements, did splitting authority equally help move faster—or did unclear decision boundaries eventually create unspoken resentment?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Partner only with individuals whose character and work ethic match yours, maintaining transparent communication when hard trade-offs arise.
- **Rajasic (Pragmatic Leverage):** Mandate 4-year vesting with a 1-year cliff, written role authority (no vague 50/50 deadlocks), and pre-agreed buy-sell valuation formulas before incorporation.
- **Mediocre (Passive/Mixed):** Give away half your company out of loneliness or fear of going solo, or leave equity expectations verbal to "avoid awkwardness."
- **Baseline (Zero-Loss Floor):** Never onboard an equity partner or merge cap tables during a *Vipat/Vadha* period or `D30` flare-up without independent corporate counsel.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of `7th lord` (`D1` & `D10`), `DK` (Darakaraka), and `A7`, testing Navatara compatibility (*Mitra/Param Mitra/Sadhaka* vs *Vipat/Vadha*) during partnership-formation periods.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Evaluates **7th house/lord** relationship with **Lagna lord** (`1st–7th` harmony = aligned vision; `6/8` or `2/12` between 1st & 7th lords = structural divergence), **`A7`**, **`DK`**, and **Mercury-Jupiter** (fair contracts). Checks `SOUL.md` Rule 0 disambiguation between equity partners (`7th`) vs paid staff (`6th`) vs industry allies (`11th`).
- **Divisional Charts (`D10`, `D30`, `D11 Proxy`, `D1`, `D9`):**
  - Core triangulation: **`D10` 7th house** (operational co-founder synergy) + **`D11` proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th)** (whether the partnership actually multiplies wealth) + **`D30` 7th house** (hidden betrayal, ego warfare, or litigation risk).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on 7th lord and `DK` (`Neecha Vargottama` demands watertight legal separation of liabilities and clear solo control).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`7th lord`, `11th lord`, `DK`, or *Dwisaptati Sama* if applicable), checking 9x9 Matrix (`4/7/10` vs `6/8` partnership strain) and *Chara Dasha* (`DK` / `A7` sign chapters).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Rahu/Ketu** transiting the 1st/7th axis (sudden partner arrivals or ideological splits), **Saturn** in 7th (heavy obligation/slow friction), and **Jupiter** aspecting 7th/`A7` (fair mediation). Checks `D1` & `D10` 7th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` 7th house and `tpRowIn(view, tpInfo, 'D30')` 7th house, `yearLord` harmony with 7th lord, and *Tithi Ashtottari* signing/renegotiation windows within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses crucial founder-search queries (*"business partner compatibility astrology"*, *"should I have a business partner birth chart"*, *"co-founder equity dispute astrology"*). Co-founder breakups kill more startups than bad products; translating `D10` 7th + `D30` 7th into concrete governance checklists prevents catastrophic cap-table mistakes.

#### Classical Attribution
- *BPHS* Ch. 7 (`D10` & `D30`), Ch. 18 (7th house partnerships & trade).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A7` Dara Pada, `DK` Darakaraka, `1st–7th` lord relationships).
- *Prasna Marga* Ch. 15–16 (Partnership integrity, deception diagnostics, and contract timing).
- *SOUL.md* §2 (Rule 0: Counterparty disambiguation across `D1`/`D10`/`D30`/Arudhas).

---

### Card 68: Hiring, Team & Delegation
- **Card Key:** `biz.hiring_team`
- **Subtitle:** `When to expand headcount, what to delegate first, and building loyal execution`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Scaling a venture beyond solo founder hustle—timing key hires and contractors (`6th` house in `D10`), fostering team loyalty (`5th` house), and identifying which operational functions to delegate first vs hold close.

#### Oracle Question
> "When is your business astrologically supported to expand headcount or bring on contractors, and how can you delegate cleanly so team loyalty and quality hold?"

#### Personalizer Goal & Stance
- **Goal:** Prevent premature payroll bloat during volatile stretches (`person_facts`: `work.team_size`, `work.cash_buffer`) while guiding overwhelmed solo founders on *when* and *what* to delegate first so they stop acting as their company's bottleneck.
- **Stance Logic:**
  - `build`: `D10` 5th/6th/10th harmony + dignified Saturn (workforce structure) + positive cashflow (`Card 65`) + supportive TP `yearLord`. Green-lights strategic hiring, contractor onboarding, and handing off repeatable operations.
  - `get_through`: Afflicted `D10` 6th/8th (high turnover, flaky hires, or payroll squeeze) or `6/8` AD tension. Advises hiring fractional/project-based contractors with clear SLAs rather than heavy full-time payroll until stability returns.

#### Full-Circle Coverage
1. **Trigger:** Founder hitting capacity ceiling at 70 hours/week, recovering from a bad hire, or planning next year's headcount.
2. **Evidence & Diagnosis:** Evaluates **`D10` 6th house** (employees/contractors), **`D10` 5th house** (team loyalty/key lieutenants), and **Saturn** (systems/SOPs).
3. **Behavioral Action:** Maps prime hiring/onboarding windows (`PeriodStrip`) and delivers 4-tier delegation habits.
4. **Resolution:** Connects scaled team operations cleanly to Card 70 (*Scaling & Risk*) and Card 72 (*Founder Energy*).

#### Single Past-Event Calibration Question
> "Over the past year, did hiring help or delegating work immediately free up your strategic focus—or did unclear onboarding mean you ended up redoing the work yourself?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Treat employees and contractors with dignity, transparent expectations, and fair compensation so loyalty grows organically.
- **Rajasic (Pragmatic Leverage):** Document SOPs *before* hiring; delegate high-volume repeatable execution first while keeping core vision, key sales, and cash sign-off close until lieutenants prove reliability.
- **Mediocre (Passive/Mixed):** Hire out of panic without clear scorecards, or refuse to delegate anything out of perfectionism until burnout hits.
- **Baseline (Zero-Loss Floor):** Never expand fixed full-time payroll ahead of verified cashflow runway during a tight `D2` / `D10` 6th transit.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of `D10` 6th lord, Saturn, and Mercury. *Pushya, Anuradha, Uttara Phalguni, Hasta, Shravana* favor steady, loyal, detail-oriented staff; **Sadhaka** (6), **Mitra** (8), and **Kshema** (4) Taras mark prime job-posting and offer-signing weeks.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **6th house** (employees, vendors, daily operations), **5th house** (trusted deputies/disciples), **10th house** (founder's command), **Saturn** (workforce management), and **`A6`** / **`A5`**. Checks `6th lord` vs `Lagna lord` relationship in `D10`.
- **Divisional Charts (`D10`, `D2`, `D1`, `D9`):**
  - Core operational lens: **`D10` 5th and 6th houses** alongside **`D2`** (payroll affordability).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on Saturn and 6th lord (`d9_redeemed` Saturn turns early hiring headaches into rock-solid operational systems post-36).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Saturn`, `Mercury`, `6th/5th/10th lord` sub-periods), checking 9x9 Matrix (`Upachaya 3/6/10/11` rewards systems-building; `6/8` warns of contractor churn).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** aspecting 6th/10th (attracting high-integrity talent), **Saturn** transiting 6th/11th (disciplined scaling), and `D1` & `D10` 6th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D10')` 5th/6th houses, `yearLord` harmony with Saturn/6th lord, and *Tithi Ashtottari* onboarding windows within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Reflects small-business scaling search demand (*"best time to hire employees astrology"*, *"building a team business horoscope"*, *"employee problems astrology"*). Solo founders making their first hires worry deeply about wasting scarce cash on bad hires or losing control of quality.

#### Classical Attribution
- *BPHS* Ch. 16 & 17 (5th loyal followers vs 6th subordinates/staff), Ch. 7 (`D10`).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Saturn governing servants, staff, systems, and execution).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` 5th/6th house management dynamics.
- *Muhurta Chintamani* — Hiring & onboarding *Tara Bala* rules.

---

### Card 69: Capital, Assets & Infrastructure
- **Card Key:** `biz.capital_assets`
- **Subtitle:** `Fundraising, business credit, commercial leases, and heavy equipment timing`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['founder', 'business_owner']`

#### Area of Focus
Capital allocation and fixed infrastructure—evaluating venture fundraising, bank loans/credit lines, commercial real estate leases, warehouses, machinery, or foundational capex investments through **`D4` (Chaturthamsha)**.

#### Oracle Question
> "What upcoming windows favor securing business financing, negotiating commercial leases, or committing capital to fixed assets and infrastructure?"

#### Personalizer Goal & Stance
- **Goal:** Protect founders from locking into toxic debt covenants, overpriced leases, or premature capex (`person_facts`: `work.funding_model`, `work.capex_need`)—identifying when capital inflows support asset accumulation vs when asset-light leasing preserves survival.
- **Stance Logic:**
  - `build`: Strong **`D4` (Chaturthamsha)** + 2nd/4th/11th + Mars/Venus/Jupiter alignment + supportive TP `yearLord`. Supports negotiating commercial leases, raising aligned capital, or investing in durable productive assets.
  - `get_through`: Afflicted `D4` 4th/8th, heavy Saturn/Rahu pressure on 4th/6th (debt trap risk), or weak TP `yearLord`. Advises staying asset-light, renegotiating flexible short-term leases, and avoiding personal debt guarantees until clarity returns.

#### Full-Circle Coverage
1. **Trigger:** Raising a seed/Series round, taking an SBA/bank loan, signing a multi-year office/retail lease, or buying major equipment.
2. **Evidence & Diagnosis:** Evaluates **`D4` (Chaturthamsha)** (fixed assets, property, infrastructure) alongside **2nd** (capital), **4th** (premises), **8th** (outside investor/bank money), and **11th** (gains).
3. **Behavioral Action:** Maps capital-commitment windows (`PeriodStrip`) and delivers 4-tier asset/financing safeguards.
4. **Resolution:** Anchors physical infrastructure smoothly beneath Card 70 (*Scaling & Risk*).

#### Single Past-Event Calibration Question
> "Looking back at major equipment purchases, leases, or financing commitments you made, did taking on fixed overhead early accelerate growth—or did staying lean and flexible serve you better?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Build real, tangible assets on honest math and conservative debt ratios, prioritizing long-term stability over vanity office prestige.
- **Rajasic (Pragmatic Leverage):** Separate *debt/investor capital* (`8th`/`11th`) from *retained margin* (`2nd`); negotiate exit caps and tenant-improvement clauses on every commercial lease.
- **Mediocre (Passive/Mixed):** Lock into 5-year fixed leases or high-interest debt based on best-case revenue projections, or under-invest in critical tooling out of scarcity fear.
- **Baseline (Zero-Loss Floor):** Never pledge personal home equity or sign uncapped personal guarantees during a turbulent `D4` / 8th-house transit.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of `4th lord`, `D4` Lagna lord, Mars (land/machinery), and Venus (comfort/premises). **Sthira (Fixed)** stars (*Rohini, Uttara Phalguni, Uttara Ashadha, Uttara Bhadrapada*) strongly bless long-term real estate/infrastructure; **Kshema** (4 — security) and **Sampat** (2 — wealth) Taras mark prime closing/signing dates.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **4th house** (premises, land, equipment, base), **2nd house** (own capital), **8th house** (outside capital: VC equity, bank loans, credit), **6th house** (debt service burden), **Mars** (*Bhumi Karaka*), and **`A4`**. Checks *Bhumi/Property Yogas* (4th–9th–11th–Mars connections) vs *Debt Yogas* (4th/2nd lords trapped in 6th/8th/12th).
- **Divisional Charts (`D4`, `D2`, `D10`, `D1`, `D9`):**
  - Core asset engine: **`D4` (Chaturthamsha)** (Lagna, 4th, 8th, 11th houses + Mars/Jupiter/Venus dignity) paired with **`D2` (Hora)** and **`D10`**.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, verifies `evaluateD1D9MutualConfirmation` on 4th lord and Mars (`confirmed_strong` or `d9_redeemed` favors acquiring enduring commercial property; *False Promise* warns against over-leveraged commercial leases).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`4th`, `2nd`, `8th`, `11th` lords, Mars, Venus, Jupiter) and *Narayana Dasha* entering `D4` Kendra/Trikona signs. Inspects 9x9 Matrix (`4/7/10` *Kendra* solidifies infrastructure; `6/8` warns of hidden capex surprises).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting/aspecting 4th/2nd/11th (smooth financing and property blessing), **Saturn** transiting 4th (*Kantaka Shani* — heavy facility repairs or lease friction requiring inspection), and `D1` & `D4` 4th `HouseCard.sav` ($\ge 30$ strong asset equity).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D4')` and `tpRowIn(view, tpInfo, 'D2')`, *Bhumi*/*Artha* Sahams, Muntha in 4th/11th, and *Tithi Ashtottari* signing dates within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses capital-heavy business queries (*"business funding loan astrology"*, *"commercial real estate business birth chart"*, *"venture capital funding transit"*). Founders debating outside capital vs bootstrapping or signing expensive leases seek disciplined risk-timing guidance.

#### Classical Attribution
- *BPHS* Ch. 7 (`D4` Chaturthamsha for land, property, infrastructure & *Bhagya*), Ch. 15 & 19 (4th assets vs 8th outside capital).
- *Phaladeepika* Ch. 14 & 26 (4th house property gains, Mars *Bhumi Karaka*, and Saturn 4th-house transits).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Mars land/machinery, 6th/8th credit & liabilities).
- *Tithi Pravesha* (Pt. Sanjay Rath) — `TP D4` & *Artha Saham* capital windows.

---

### Card 70: Scaling, Risk & Bold Moves
- **Card Key:** `biz.scaling_risk`
- **Subtitle:** `When exponential expansion pays off versus when leverage destabilizes you`
- **Default Placement:** Pinned when active founder; Card Picker when exploring | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Calculated risk, geographic or product-line scaling, marketing spend surges, and strategic leverage—distinguishing high-ROI Rahu/Mars/11th expansion windows from reckless over-extension.

#### Oracle Question
> "When is bold expansion, new-market entry, or strategic risk strongly backed by your chart—and when could moving too aggressively destabilize what you've built?"

#### Personalizer Goal & Stance
- **Goal:** Calibrate founder aggression (`person_facts`: `work.growth_goal`, `work.risk_tolerance`)—giving conservative founders permission to swing big when double transits and `D10` 3rd/11th roar, while pumping the brakes on reckless gamblers during Rahu/8th traps.
- **Stance Logic:**
  - `build`: `3rd/11th` + `Mars/Rahu/Jupiter` alignment in `D10` + `SAV >= 30` + confirmed concordance + strong TP `yearLord`. Green-lights launching new markets, scaling acquisition budgets, or acquiring competitors.
  - `get_through`: Rahu/Mars running unchecked without Jupiterian/SAV guardrails, `6/8` AD, or `confirmed_weak` *Drudha Karma* risk profile. Advises unit-level margin tightening, small reversible A/B tests, and guarding core cash cows over big bets.

#### Full-Circle Coverage
1. **Trigger:** Deciding whether to open a second location, enter an international market, triple ad spend, or launch a risky new bet.
2. **Evidence & Diagnosis:** Evaluates **3rd house** (bold initiative), **11th house** (scale), **Mars** (execution strike), **Rahu** (exponential/unconventional growth), and **Jupiter** (wisdom/guardrail) inside **`D10`**.
3. **Behavioral Action:** Maps aggressive scale vs risk-control stretches (`PeriodStrip`) and delivers 4-tier strategic risk habits.
4. **Resolution:** Pairs expansion directly with Card 71 (*Legal Safeguards*) and Card 72 (*Founder Energy*).

#### Single Past-Event Calibration Question
> "Thinking back on the boldest business or financial bets you've taken, did calculated leaps preceded by strong preparation multiply your results—or did stretching too fast once create a painful cleanup?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Scale impact and reach in alignment with service quality—never growing faster than your team's integrity and customer promise can sustain.
- **Rajasic (Pragmatic Leverage):** Run "asymmetric bets"—cap downside rigorously while scaling what already shows proven unit economics during peak `3rd/11th` windows.
- **Mediocre (Passive/Mixed):** Stay timid through golden expansion windows out of perfectionism, or pour massive leverage into an unproven idea just to chase growth headlines.
- **Baseline (Zero-Loss Floor):** Never bet the core business's solvency on a single irreversible expansion move during an unconfirmed or `get_through` transit.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of Mars, Rahu, 3rd lord, and 11th lord in `D1` & `D10`. Bold/pioneering stars (*Ashwini, Krittika, Mrigashira, Ardra, Magha, Dhanishta*) supercharge rapid market capture; **Sadhaka** (6) and **Sampat** (2) Taras reward decisive strikes, whereas **Vadha** (7) punishes over-leveraged bets.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **3rd house** (*Parakrama* — daring enterprise), **11th house** (*Labha* — scale & network effects), **Mars-Jupiter** (*Guru-Mangala Yoga* — wise courage), **Rahu in 3/6/10/11** (*Upachaya Rahu* — massive unconventional scaling), and **`A10` / `A11`**. Checks *Mars-Rahu* (*Angaraka*) without Jupiter (excessive risk needing tight downside caps).
- **Divisional Charts (`D10`, `D11 Proxy`, `D2`, `D1`, `D9`):**
  - Core growth engine: **`D10` 3rd, 10th, and 11th houses** + **`D11` proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th)** + **`D2`** margin buffer.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, validates Mars, Rahu, and 11th lord via `evaluateD1D9MutualConfirmation` (`d9_redeemed` Mars/Saturn unlocks disciplined massive scaling post-36; *False Promise* requires stage-gated capital controls).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Rahu`, `Mars`, `Jupiter`, `3rd/11th lord` periods), checking 9x9 Matrix (`Upachaya 3`, `Labha 11`, `Trikona 1/5/9`) and *Yogini* (*Siddha* Venus / *Dhanya* Jupiter vs *Sankata* Rahu).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter + Saturn double transit (`S6D`)** over 11th/10th/3rd, **Rahu** transiting 3rd/10th/11th, and **`SAV >= 30`** in 3rd and 11th (mandatory scaffolding before aggressive leverage).
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D10')` 3rd/11th houses, `yearLord` Mars/Jupiter strength, *Yashas/Karya Siddhi* Sahams, and *Tithi Ashtottari* expansion spikes inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses ambitious founder queries (*"when to scale business astrology"*, *"business expansion risk birth chart"*, *"taking a bold business move horoscope"*). Growth-stage operators want clear distinction between disciplined scaling windows and hubris traps.

#### Classical Attribution
- *BPHS* Ch. 14 & 21 (3rd *Parakrama* courage & 11th *Labha* scale), Ch. 66–72 (Ashtakavarga risk scaffolding).
- *Phaladeepika* Ch. 14 & 26 (Upachaya Rahu/Mars growth and Gochar scaling triggers).
- *Timing Events Through Vimshottari Dasha* (K.N. Rao) — Double transit (`S6D`) for major business expansion.
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D10` 3rd/11th bold commercial expansion.

---

### Card 71: Legal, Contracts & Financial Safeguards
- **Card Key:** `biz.legal_safeguards`
- **Subtitle:** `Dates requiring heightened contract, tax, IP, and regulatory vigilance`
- **Default Placement:** Pinned when active founder; Card Picker when exploring | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Preventative enterprise defense—identifying exact periods of elevated exposure to contract loopholes, vendor/client disputes, tax audits, regulatory compliance fines, IP leakage, or internal fraud via **`D30` (Trimshamsha)** and 6th/8th houses.

#### Oracle Question
> "Which upcoming dated windows call for extra legal, tax, and compliance scrutiny around your contracts and finances to prevent avoidable disputes?"

#### Personalizer Goal & Stance
- **Goal:** Turn **`D30` (Trimshamsha)** and 6th/8th indicators into calm, proactive corporate hygiene (`person_facts`: `work.industry`, `work.contract_volume`)—preventing litigation *before* it starts via checklists, IP registration, and tax audits rather than frightening founders.
- **Stance Logic:**
  - `build`: Clean `D30` 6th/8th, benefic Jupiter/Mercury protecting contracts, and strong TP `yearLord`. Supports clean renewal of major agreements, IP filings, and proactive compliance upgrades.
  - `get_through`: Saturn/Rahu/Mars hitting `D30` 6th/8th or `D10` 6th/8th, *Vipat/Vadha* AD, or weak TP `yearLord`. Flags specific audit windows requiring independent legal counsel on all new deals, strict tax escrow, and clean written change-orders.

#### Full-Circle Coverage
1. **Trigger:** Signing major enterprise contracts, handling tax/audit season, onboarding vendors, or sensing a brewing client/partner dispute.
2. **Evidence & Diagnosis:** Audits **6th house** (lawsuits/disputes), **8th house** (tax audits, penalties, hidden fraud), **12th house** (losses), and **`D30` (Trimshamsha)** (hidden flaws and *Arishta*).
3. **Behavioral Action:** Flags exact high-scrutiny `KeyDates` (`<= 6`) and delivers 4-tier legal hygiene protocols.
4. **Resolution:** Insulates cashflow (Card 65) and co-founder alignment (Card 67) from destructive legal shocks.

#### Single Past-Event Calibration Question
> "In past business cycles, did skipping fine-print review, verbal side agreements, or delayed tax/bookkeeping reconciliation ever come back to create an avoidable financial or legal headache?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Conduct every deal with impeccable transparency, clean bookkeeping, and honorable adherence to commitments—eliminating karmic loopholes at the root.
- **Rajasic (Pragmatic Leverage):** Have qualified legal and CPA counsel review non-standard indemnities, IP clauses, and tax reserves before every `D30`/6th/8th caution window.
- **Mediocre (Passive/Mixed):** Rely on handshake trust or recycled internet templates for six-figure contracts, or postpone quarterly tax/compliance filings until penalties hit.
- **Baseline (Zero-Loss Floor):** Never sign personal guarantees, waive arbitration/IP protections, or ignore regulatory notices during a contested *Vipat/Vadha* period.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks active MD/AD/PD lords and transiting malefics hitting **Vipat** (3/12/21), **Pratyak** (5/14/23), or **Vadha** (7/16/25) Taras—plus sensitive transit points **`D1.K64M`**, **`D1.K64L`**, **`D1.KD22`**, and **`D1.BB`** triggering sudden legal/audit blindsides.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **6th house** (litigation, adversaries, contract disputes), **8th house** (IRS/tax audits, hidden liabilities, sudden losses), **12th house** (penalties/settlement outflows), **Mercury** (contracts/accounting), **Saturn** (law/compliance), and **Rahu** (regulatory gray zones/fraud). Checks `A6`, `A8`, and *Viparita Raja Yoga* (winning disputes when forced into defense).
- **Divisional Charts (`D30`, `D10`, `D1`, `D9`):**
  - Primary risk diagnostic: **`D30` (Trimshamsha)** (Lagna, 6th, 8th, 12th houses + Mercury/Mars/Saturn/Rahu placements) crossed with **`D10` 6th/8th**.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on Mercury, 6th/8th lords, and active dasha lord (*Neecha Vargottama* mandates permanent external CPA/legal checks; *d9_redeemed* turns hard-won dispute resolution into institutional moat).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`6th/8th/12th lord`, `Rahu`, `Saturn`, `Mars`), checking 9x9 Matrix **Shadashtaka (`6/8`)** and **Dwirdwadasha (`2/12`)** tension and *Yogini* (*Sankata* Rahu / *Ulka* Saturn).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Saturn-Rahu** or **Mars-Ketu** transiting 6th/8th/12th or over natal Mercury/`A7`, **Ashtama Shani** (Saturn 8th from Moon), and `HouseCard.sav` in 6th and 8th ($< 25$ signals low dispute insulation).
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D30')` and `tpRowIn(view, tpInfo, 'D10')`, *Mrityu/Vyaya/Bandhana* Sahams, weak/afflicted `yearLord`, and exact *Tithi Ashtottari* caution dates inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses urgent protective queries (*"business legal troubles astrology"*, *"tax audit risk horoscope"*, *"contract dispute business birth chart"*). Founders rarely look up compliance for fun—they search when signing high-stakes agreements or facing regulatory anxiety, valuing concrete vigilance dates and preventative checklists.

#### Classical Attribution
- *BPHS* Ch. 7 (`D30` Trimshamsha — *Arishta*, hidden misfortunes & disputes), Ch. 17, 19, 23 (6th litigation, 8th audits/penalties, 12th losses).
- *Prasna Marga* Ch. 15–16 & 28 (Litigation outcomes, hidden financial flaws, fraud & audit diagnostics).
- *Lunar Astro / Deepanshu Giri* (*Predicting Through Nakshatras*) — `K64M`, `K64L`, `KD22`, `BB` transit triggers for sudden disputes.
- *Tithi Pravesha* (Pt. Sanjay Rath) — `TP D30` annual risk windows & fail-closed protective pacing.

---

### Card 72: Founder Energy & Avoiding Burnout
- **Card Key:** `biz.founder_burnout`
- **Subtitle:** `Protecting the founder as the company's core asset and sustaining stamina`
- **Default Placement:** Pinned when active founder; Card Picker when exploring | **`showWhen`:** `work.status in ['founder', 'business_owner', 'freelancer_agency']`

#### Area of Focus
Sustaining the founder's physical vitality, nervous-system resilience, sleep architecture, and emotional longevity—recognizing that in an owner-operated business, founder collapse equals enterprise collapse.

#### Oracle Question
> "How can you protect your physical vitality and mental stamina over the next 12 months so the weight of running your business does not quietly deplete your health?"

#### Personalizer Goal & Stance
- **Goal:** Anchor hard-driving entrepreneurs (`person_facts`: `work.stress_level`, `age_band`) in sustainable multi-year pacing—pinpointing exact physical/nervous-system vulnerability windows (`Lagna`/`Moon`/`Sun`/`6th`/`12th`/`D30`) and when energy rebounds.
- **Stance Logic:**
  - `build`: Strong Lagna lord, Sun, Moon, and clean `D30` + supportive TP `yearLord`. Encourages establishing consistent athletic, sleep, and strategic-offsite rhythms that multiply executive clarity.
  - `get_through`: Saturn/Mars/Rahu pressing Lagna/Moon/Sun/6th/12th, `D30` Lagna strain, *Ashtama Shani*, or *Sade Sati*. Mandates non-negotiable sleep protection, delegating fires (Card 68), scheduling medical checkups, and banning 7-day workweeks until the named relief date.

#### Full-Circle Coverage
1. **Trigger:** Founder insomnia, decision fatigue, chronic stress illness, or feeling trapped by the very business built for freedom.
2. **Evidence & Diagnosis:** Evaluates **Lagna/Lagna lord** (body), **Sun** (*Prana*/vitality), **Moon** (nervous system/sleep), **6th** (illness/overwork), **12th** (sleep/hospitalization), and **`D30` Lagna/Moon**.
3. **Behavioral Action:** Maps vulnerability vs recovery windows (`PeriodStrip`) and delivers 4-tier founder longevity habits.
4. **Resolution:** Connects recovered energy back across the entire Business lens (Cards 65, 68, 70).

#### Single Past-Event Calibration Question
> "Over the past 12 months, did carrying every operational crisis personally cause your sleep, digestion, or mood to dip sharply—even when business metrics were growing?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** View your body and mind as sacred instruments of long-term stewardship; protect daily silence, movement, and family presence unconditionally.
- **Rajasic (Pragmatic Leverage):** Treat recovery as an executive KPI—build automated operational redundancies, hire a strong #2 (Card 68), and enforce hard evening/weekend off-switches.
- **Mediocre (Passive/Mixed):** Wear 80-hour burnout as a badge of honor, numbing stress with stimulants and late-night screens until forced to stop by health trouble.
- **Baseline (Zero-Loss Floor):** Never skip preventive bloodwork/medical checks or sacrifice core sleep for minor operational fires during a heavy `D30` / *Sade Sati* window.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks Moon's Janma Nakshatra and Lagna's nakshatra against active AD/PD lords under **Janma** (1), **Vipat** (3), **Pratyak** (5), or **Vadha** (7 — especially **25th Manasa Nakshatra**) Taras and **Gandanta** degrees (`StarProfile.gandanta`).
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **Lagna & Lagna lord** (physical constitution), **Sun** (*Atma/Prana* vitality), **Moon** (*Manas*/rest), **6th house** (acute strain/illness), **12th house** (sleep quality/bed rest), and **8th house** (chronic fatigue). Checks *Kemadruma*, *Vish Yoga* (Saturn-Moon), or *Lagna lord in 6/8/12* Shadbala depletion.
- **Divisional Charts (`D30`, `D1`, `D9`, `D10`):**
  - Cross-evaluates **`D30` (Trimshamsha)** (Lagna, Moon, 6th, 8th, 12th) against **`D1`** vitality and **`D10`** workload pressure.
  - **Age-36 Gate:** Essential for seasoned founders (`ageYears > getD9MaturityAgeYears()`): runs `evaluateD1D9MutualConfirmation` on Lagna lord, Sun, and Moon—post-36 *Neecha Vargottama* or *False Promise* vitality markers demand disciplined lifestyle pacing rather than youthful all-nighters.
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`6th/8th/12th lord`, `Saturn`, `Rahu`, `Ketu` sub-periods), 9x9 Matrix **Shadashtaka (`6/8`)** tension, and *Mrita* (`0.10x`) / *Sushupti* (`0.25x`) Avasthas lowering physical recovery speed.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Sade Sati** (12th/1st/2nd from Moon), **Ashtama Shani** (8th from Moon), **Kantaka Shani**, and Mars/Rahu transiting Lagna/6th/12th. Checks `D1` Lagna, 6th, and 12th `HouseCard.sav` ($< 25$ requires deliberate energy conservation) and Sun/Moon `BAV`.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D30')` Lagna/Moon, `AnnualRow.yearLord` vitality, Muntha in 6th/8th/12th, and *Tithi Ashtottari* rest-vs-surge milestones within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Serves deeply human founder wellbeing searches (*"entrepreneur burnout astrology"*, *"founder mental health horoscope"*, *"how to sustain founder energy birth chart"*). Founders often ignore personal health until crisis hits; grounding recovery mandates in `D30` + Moon + *Sade Sati* gives objective permission to delegate and rest.

#### Classical Attribution
- *BPHS* Ch. 7 (`D30` Trimshamsha), Ch. 12, 17, 19, 23 (Lagna vitality, 6th illness, 8th chronic wear, 12th sleep).
- *Prasna Marga* Ch. 12–13 & 25 (*Arishta* health & nervous depletion diagnostics, *Manasa Nakshatra*).
- *Phaladeepika* Ch. 26 (Saturn transits—Sade Sati, Ashtama Shani—impacting stamina).
- *Saravali* Ch. 14–16 (Moon-Saturn/Mars exhaustion yogas and Sun vitality).

---

## 4. Attribution & Source Credits Summary

| Source / Tradition | Author / Lineage | Scope Applied in Dashboard 08 |
| :--- | :--- | :--- |
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | `D10`, `D2` Hora, `D4` Chaturthamsha, `D30` Trimshamsha, `D24`, 2nd/3rd/4th/6th/7th/8th/11th/12th Bhavas, *Dhana/Raja/Panchamahapurusha* Yogas, Ashtakavarga (`11H > 12H`, `SAV`). |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | `AmK`, `DK`, `AL`, `A2`, `A4`, `A6`, `A7` (Dara Pada), `A10` (Rajya Pada), `A11` (Labha Pada), Narayana & Chara Dashas, *Dwisaptati Sama* conditions. |
| *Phaladeepika* | Mantreswara | Service vs trade (Ch. 17/19), Upachaya Rahu/Mars scaling, *Sade Sati* / *Ashtama Shani* / *Kantaka Shani* (Ch. 26). |
| *Saravali* | Kalyana Varma | Commercial sector yogas (Ch. 30–35), Vargottama vs *Neecha Vargottama* founder endurance, Moon/Sun vitality. |
| *Uttara Kalamrita* | Kalidasa | Exhaustive industry/commodity karakatvas, Mars *Bhumi Karaka*, Mercury commerce, Saturn staff/systems, 6th/8th debt & litigation. |
| *Prasna Marga* | Panakkattu Namboodiri | Co-founder integrity & deception checks, tax/litigation diagnostics, *Arishta* founder burnout & *Manasa Nakshatra* alerts. |
| *Tithi Pravesha: Vedic Annual Horoscopy* & *Crux of Vedic Astrology* | Pt. Sanjay Rath (Puri Tradition) | Annual `TP D10`/`D2`/`D4`/`D30`, `yearLord`, *Artha*/*Karya Siddhi*/*Yashas*/*Bhumi* Sahams, post-36 `D9` gate, `D10` 6th vs 7th rule. |
| *Timing Events Through Vimshottari Dasha* | K.N. Rao | Jupiter-Saturn double transit (`S6D`) for business launches, major expansions, and capital pivots. |
| *Muhurta Chintamani* & *Muhurta* | Daivajna Rama / Dr. B.V. Raman | *Vyapara Muhurta* (incorporation/launch/hiring/asset closing) via *Sampat*/*Sadhaka*/*Mitra*/*Kshema* Taras and Fixed/Swift stars. |
| *Blank Chart Prediction* & *Predicting Through Nakshatras* | Lunar Astro / Deepanshu Giri | `K64M`, `K64L`, `KD22`, `BB` sensitive transit points for legal/audit shocks and abrupt pivots. |
| Internal Architecture & Research Specs | AI AdAstra Engineering | `docs/reading-engine/76`, `docs/reading-engine/78` (`D11` proxy architecture), `SOUL.md` §2–3, `src/reading/dasha/dashaAssessment.ts`. |
