# ASK-REQUIREMENTS — Must-Have Astrological Data Points for Deep Multi-School Readings

**Status:** Active Specification (Updated 2026-11-06 — Core `avasthas`, `dasha_charter`, `lunar_astro`, `.l3` Dashas, `argala.d1..d60`, and Annual Vargas SHIPPED in `kundli_data` & `kundli_digest` `d1.2026-11-06`)  
**Owner:** Reading Engine & `AIAstra_Radha` Data Contract (`docs/reading-engine/20`, `23`, `34`, `53`, `55`)  
**Schools Covered:** **Parashara (BPHS)** · **Jaimini / Pt. Sanjay Rath (SJC)** · **Lunar Astro (Deepanshu Giri / Bhrigu-Nadi)** · **Tajaka (Annual Varsha & Tithi Pravesha)** · **Prashna & Muhurta (Panchanga / Kakshya)**

---

## 1. Purpose & Non-Negotiable Standard

To deliver a non-sycophantic, human-sensitive reading that:
1. Explains **what is wrong**, **the multi-layered planetary/Dasha cause**, **how the fruit tastes** (*unripe, sour/scorched, over-ripe, or sweet/ripe*), **else what will happen if a warning is ignored**, and **how/when each preparation is used**,
2. Finds **immediate cash flow and relief pockets within 1 month (day-by-day), 3 months, 6 months, 9 months, 12 months, and 1–5 years** across all wealth channels (salaried/contract service, entrepreneurship, Other People's Money [OPM], inheritance, stock/retirement investing vs. speculation, lifestyle/spending, and real estate), and
3. Verifies every major claim with **3 or more independent methods** (**Dwisaptati Sama / applicable conditional dasha + Narayana Dasha + Tithi Ashtottari / Annual Patyayini + Sudasa / Chara / Yogini + Vimshottari + Placements/Drishti + Avasthas + Arudhas/Argala + Transits**),

the stored `kundli_facts` JSON from **`AIAstra_Radha` (`pyjhora`)** must serve every data point below. Node computes nothing astrological (`AGENTS.md`); therefore, every missing or buggy item listed below is a required data contract upgrade in `AIAstra_Radha` and the dossier builder.

---

## 2. Executive Summary of Current Data Gaps & Bugs in `AIAstra_Radha`

| Priority | System / Category | What Is Missing or Buggy Right Now | Impact on Reading Depth |
| :--- | :--- | :--- | :--- |
| **P0 (Bug)** | **Parashara Shadbala & Ishta/Kashta Phala** | 1. `ishta_phala: 0` on **Sun and Moon** in stored facts (formula bug).<br>2. Shadbala `rank` sorted on raw rupas instead of **ratio to required minimum** (`Saturn 1.72, Sun 1.38, Mars 1.25...`). | Distorts planet harmony scores (`ishta/kashta`) and misranks Moon/Sun if read without manual ratio correction. |
| **P0 (Bug)** | **Sripati Bhava Cusps, Rahu Dignity & Empty-House Yogas** | 1. `drik._bhaava_madhya_new` treats house centers as starts (`bhava` method 3).<br>2. `const.house_strengths_of_planets[7]` swaps Rahu/Ketu dignity.<br>3. `yoga.py` emits *Sunapha/Duradhara/Vesi* for empty houses. | Corrupts cusp-junction (*Bhava Sandhi*) diagnostics (e.g., Sun at 7th/8th cusp, Mercury at 8th/9th cusp) and inflates yoga counts. |
| **SHIPPED** | **Planetary Avasthas (`avasthas`, `.d9/.d10/.d16/.d24` — All 5 Sets + Multipliers + `dasha_charter`)** | **Shipped in `avasthas_export.py` & `kundli_digest` (`PlanetCard.avasthas`, `avasthaMultipliers`, `dashaCharter`)**: Serves *Baladi* (with `multiplier` & `ripeness`), *Jagradadi* (`multiplier`), `effective_delivery_multiplier`, *Deeptadi*, *Lajjitadi*, *Shayanadi*, 5-vector Mahadasha charter, and 9×9 Antardasha fruition matrix. | Live in `kundli_data` (`avasthas`) and `kundli_digest` (`PlanetCard`). |
| **SHIPPED (L3)** | **Multi-Dasha Level 3 (PD) (`*.l3` in `kundli_data` & `kundli_activation`)** | **Shipped 3-level (`MD + AD + PD`) exports** for `dasha.vimsottari.l3`, `dasha.dwisatpathi.l3`, `dasha.narayana.l3`, `dasha.tithi_ashtottari.l3`, `dasha.yogini.l3`, and `dasha.sudasa.l3`, normalized into `kundli_activation` (8,000–15,000 rows per kundli across 42–43 systems). Level 4 (Sookshma) remains optional future work. | Live in `kundli_data` and `kundli_activation`. |
| **SHIPPED** | **Combustion (`Moudhya`), Cazimi & Tight Varga Conjunction Orbs (`proximity_audit`)** | **Shipped in `avasthas.proximity_audit` & `kundli_digest` (`PlanetCard.sunProximity`)**: Serves `distance_from_sun_deg`, `classical_orb_deg`, `zone` (`cazimi`, `deep_combustion_sikhin`, `standard_combustion`, `burnt_edge_tapta`, `free_of_sun`), `tight_conjunctions_d1`, and `varga_clusters` (`D1, D9, D10`). | Live in `kundli_data` (`avasthas`) and `kundli_digest` (`PlanetCard.sunProximity`). |
| **SHIPPED** | **Jaimini Argala & Virodhargala Matrix (`argala.d1`..`argala.d60`)** | **Shipped across 12 vargas (`argala.d1`..`argala.d60`)** and joined onto `HouseCard.argala` (`primary`, `secondary`, `obstructed`) in `kundli_digest`. | Live in `kundli_data` and `kundli_digest`. |
| **P1 (Partial)** | **Special Lagnas Exact Degrees, Indu Lagna Kalas & Varga Placements** | `HL`, `GL`, `IL`, `SL`, `BB`, `VL`, `PL` are in `arudhas.special_points` / `sphutas` and `kundli_digest` `point` rows; Indu Lagna 16-kala breakdown remains optional enrichment. | Needed for fine Indu Lagna ray diagnostics. |
| **SHIPPED** | **Lunar Astro / Bhrigu-Nadi Points (`64th Navamsa`, `22nd Drekkana`, `Bhrigu Bindu`, `Pending Karma`)** | **Shipped in `avasthas.lunar_astro` & `kundli_digest`**: `D1.K64M` (64th Navamsa from Moon), `D1.K64L` (from Lagna), `D1.KD22` (22nd Drekkana), `D1.BB` (Bhrigu Bindu), Rasi `PlanetCard.chain`, Nakshatra `PlanetCard.starChain`, and `StarProfile.pendingKarmaHouses`. | Live in `kundli_data` (`avasthas`) and `kundli_digest`. |
| **P1 (Partial)** | **Fast-Planet Transit Contacts & Daily Kakshya / BAV Cash Scoring** | `kundli_transit_overlays` stores range and contact rows; daily Kakshya (`3°45′` sub-lord) & Prastarashtakavarga bindu per transiting planet remain P1. | Fast-planet contacts + daily Kakshya bindus pinpoint exact days of the month. |
| **SHIPPED** | **Annual Chart Vargas & Tajaka Aspects (`annual.*@year=Y;divisional_chart_factor=2,7,9,10`)** | **Shipped in `kundli_data` & `kundli_digest` (`AnnualRow`)**: `TP<year>.D1/D2/D7/D9/D10` and `VP<year>.D1/D2/D7/D9/D10` with house cards, `dashas`, `sahams`, `muntha`, `yearLord`, and `tajakaYogas`. | Live in `kundli_digest` (`annual` section; note: Sachin & Archisha need annual top-up sweep to match Sumit's 200 annual rows). |

---

## 3. System-by-System Must-Have Data Requirements

### 3.1 Parashara Core Natal, Bhava Cusps, Combustion & Planetary Avasthas

Every planet (`Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke`) and Upagraha (`Maandi, Gulika, Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu`) must include:

1. **Exact Coordinates & Motion State (D1 + All 16 Shodashavargas):**
   - `longitude_deg` (0–360°), `sign_deg` (0–30°), `dms` (`"17°27'14\""`), `sign`, `house_whole_sign`, `house_bhava_sripati`, `is_bhava_sandhi` (true when within ±1°30′ of a Sripati bhava junction, or when whole-sign house != Sripati bhava house, e.g., Sachin's Sun in 7th sign / 8th bhava and Mercury in 8th sign / 9th bhava).
   - `speed_deg_per_day`, `motion_state` (`"direct" | "retrograde" | "stationary_retrograde" | "stationary_direct" | "accelerated_chari"`).
   - `nakshatra`, `nakshatra_pada`, `nakshatra_lord`, `pushkara_navamsa` (`bool`), `pushkara_bhaga_distance_deg`, `mrityu_bhaga_distance_deg`, `ganda_moola` (`bool`), `gandanta_distance_deg`.
2. **All Five Classical Planetary Avastha Systems (`avasthas.<planet>`) — MUST ADD TO RADHA:**
   - **`baladi` (Age / Maturity State by 6° slices — Odd vs. Even sign reversed):**
     - State: `"bala"` (Infant, 25% delivery) | `"kumara"` (Youth, 50% delivery) | `"yuva"` (Prime, 100% delivery) | `"vriddha"` (Aged/Seasoned, ~12–25% solo / high wisdom) | `"mrita"` (Dormant/Incapable solo, 0% solo—requires dispositor, conjunction, or transit activation).
     - Must include `slice_progress_pct` (how far into the 6° slice the planet sits).
   - **`jagradadi` (Alertness State by Dignity):**
     - `"jagrat"` (Awake — own/moolatrikona/exalted: 100% result) | `"swapna"` (Dreaming — friend/neutral sign: 50% result) | `"sushupti"` (Asleep — enemy/debilitated sign: 0–25% solo result unless *Neecha Bhanga* or *Viparita* applies).
   - **`deeptadi` (9 Functional Mood/Tone States — Determines "How the Fruit Tastes"):**
     - `"deepta"` (Blazing/Exalted — sweet, authoritative fruit), `"swastha"` (Comfortable in own sign — ripe, stable fruit), `"mudita"` (Delighted in close friend's sign), `"shanta"` (Peaceful in benefic vargas), `"shakta"` (Strong/Bright), `"peedita"` (oppressed by malefics), `"deena"` (depressed in enemy sign), `"vikala"` (crippled/combust — sour/scorched fruit), `"khala"` (mischievous/debilitated).
   - **`lajjitadi` (6 Psychological & Karmic Complexion States — BPHS Ch. 45):**
     - `"lajjita"` (ashamed: planet in 5th with Rahu/Ketu/Sun/Saturn/Mars), `"garvita"` (proud: exalted/moolatrikona), `"kshudita"` (starved: in enemy sign or aspected by enemy/Saturn), `"trushita"` (thirsty: in watery sign aspected by malefic without benefic aspect), `"mudita"` (joyful: with/aspected by friendly benefic), `"kshobhita"` (agitated: conjunct Sun and aspected by malefic — e.g., D9 Virgo Venus+Sun+Mars!).
   - **`shayanadi` (12 Activity States + `drishti / cheshta / vicheshta` sub-strength):**
     - Required for **Sanjay Rath** and **Lunar Astro** behavioral diagnostics (*Shayana, Upaveshana, Netrapani, Prakashana, Gamana, Agamana, Sabha, Agama, Bhojana, Nrityalipsa, Kautuka, Nidra*).
3. **Combustion (`Moudhya`), Cazimi, Planetary War (`Graha Yuddha`) & Varga Conjunction Orbs:**
   - For every planet in **D1** and **D9**:
     - `sun_distance_deg`: exact shortest arc (0–180°) from the Sun in D1, plus same-sign degree gap in D9.
     - `is_combust`: boolean + `combustion_orb_deg` (Moon 12°, Mars 17°, Mercury 14° direct / 12° retro, Jupiter 11°, Venus 10° direct / 8° retro, Saturn 15°) + `combustion_severity_pct`.
     - `is_cazimi`: boolean (within 0°17′ to 1°00′ of the Sun's center).
     - `graha_yuddha`: array of planetary wars (two true planets within 1° longitude), naming the winner by northern celestial latitude (`sharas`) and brightness.
     - `tight_conjunctions_d1` and `tight_conjunctions_d9`: any 2+ planets within **6°00′** in D1 or within the same sign within **6°00′** in D9 (flagging whether a benefic like Venus or Jupiter is *scorched* between malefics like Sun + Mars or Sun + Saturn).
4. **Corrected Shadbala, Ishta/Kashta Phala & Vimshopaka Bala:**
   - Fix `ishta_phala` and `kashta_phala` on Sun and Moon so they never return `0` erroneously.
   - Serve `shadbala_rupas`, `required_rupas`, `shadbala_ratio` (`rupas / required_rupas`), and `ratio_rank` (1–7 sorted strictly by `shadbala_ratio`).
   - Serve `dig_bala` (0–60 virupas) and flag any planet with `dig_bala < 10` as `"directionally_unanchored"`.
   - Serve **Vimshopaka Bala** (20-point composite varga strength across Shadvarga, Sapthavarga, Dashavarga, and Shodashavarga).


---

### 3.2 Multi-Dasha Engine (Conditional Priority, Level 3 PD & Level 4 Sookshma)

A comprehensive reading must never treat *Vimshottari Dasha* as a solo oracle. When a conditional nakshatra dasha applies to the chart, it must sit in the **Primary Tier** right alongside **Narayana Dasha**, **Tithi Ashtottari / Annual Patyayini**, **Sudasa**, **Yogini**, and **Vimshottari**:

1. **Explicit Conditional Dasha Applicability & Primary Hierarchy (`dasha.applicability`):**
   - Radha must evaluate all Parashara conditional nakshatra dashas and emit:
     - `applicable_systems`: list of conditional systems that pass the classical BPHS eligibility check, with the exact rule matched (e.g., `dwisatpathi`: `"Lagna lord Jupiter in 7th house Virgo -> PRIMARY CONDITIONAL DASHA"`).
     - **Primary Individual Dasha Stack (Mandatory for Every Chart):**
       1. **Narayana Dasha** (`dasha.narayana` — Jaimini's supreme rasi dasha of physical environment and worldly manifestation).
       2. **Primary Applicable Conditional Nakshatra Dasha** (e.g., **Dwisaptati Sama Dasha** when Lagna lord is in 7th or 7th lord is in 1st; **Shatabdika** when Lagna is Vargottama; **Chaturaseeti Sama** when 10th lord is in 10th; **Shashtihayani** when Sun is in Lagna; **Dwadasottari** when Lagna is in Venus's Navamsa; **Panchottari** when Lagna is in Cancer Rasi & Dwadasamsa; **Shattrimsa Sama** when Day birth in Lagna Hora or Night birth in Moon Hora; **Ashtottari** when Rahu is in Kendra/Trikona from Paka Lagna outside Lagna).
       3. **Tithi Ashtottari Dasha & Annual Tithi Pravesha / Patyayini Dasha** (`dasha.tithi_ashtottari`, `annual.tithi_pravesha_dasha`, `annual.patyayini` — governs the lunar-day mindset, emotional tide, and exact annual delivery).
       4. **Sudasa (`dasha.sudasa` — Shree Lagna wealth/prosperity rasi dasha)** & **Chara / Karaka / Kaala Dashas**.
       5. **Yogini Dasha (`dasha.yogini`)** — critical for tracking hidden traps (*Sankata/Rahu*, *Ulka/Saturn*, *Siddha/Venus*).
       6. **Vimshottari Dasha (`dasha.vimshottari` — Janma Nakshatra, Utpanna, Kshema, Adhana, and Lagna-Tara variants)**.
2. **Level 3 (Pratyantardasha / PD) & Level 4 (Sookshma) Depth Requirement:**
   - Currently, Radha stores only **Level 1 (Mahadasha)** and **Level 2 (Antardasha)** for all 44 dasha systems.
   - **Mandatory Upgrade:** For the **Top 9 Primary Systems** (`vimshottari`, `dwisatpathi` [plus any other applicable conditional dasha], `narayana`, `tithi_ashtottari`, `yogini`, `sudasa`, `chara`, `patyayini`, `tithi_pravesha_dasha`), Radha must serve:
     - **Level 1 (Mahadasha) + Level 2 (Antardasha):** Full life span (birth to birth + 90 years).
     - **Level 3 (Pratyantardasha / PD):** Full span for `reading_date - 5 years` to `reading_date + 10 years`.
     - **Level 4 (Sookshma Dasha):** Full span for `reading_date - 3 months` to `reading_date + 18 months` (essential for **1-month and 3-month cash inflow and legal timing**).

---

### 3.3 Jaimini & Pt. Sanjay Rath Tradition (Arudhas, Argala, Special Lagnas & Chara Karakas)

1. **Arudha Padas (`arudhas`) with Sanjay Rath Exceptions & Co-Tenancy Flags:**
   - Serve all 12 Arudha Padas (`AL, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, UL`) in **D1, D9, and D10**, explicitly noting when the **Sanjay Rath 4th/10th exception** was triggered and listing **Arudha Conjunctions** (`co_present_arudhas`, e.g., `["A2", "A8"]` in Gemini 4th house; `["A5", "A9", "A10"]` in Pisces 1st house).
   - Serve key **Arudha Relational Houses**:
     - `2nd_from_AL` and `11th_from_AL` (what feeds vs. elevates public image), `7th_from_AL` (what partners/doors open to the public image), `9th_from_AL` (what protects the `AL`), and `12th_from_AL` (what drains the `AL`).
     - `2nd_from_UL` (what sustains vs. breaks the marriage), `7th_from_UL` (what opposes the marriage), and `UL_lord` + `A7_lord`.
2. **Full Argala & Virodhargala Matrix (`argala_matrix`) — MUST ADD TO RADHA:**
   - Pre-compute the **Jaimini Argala / Virodhargala table** from five reference points (**Lagna**, **Arudha Lagna `AL`**, **Upapada Lagna `UL`**, **Hora Lagna `HL`**, and **Indu Lagna `IL`**):
     - **Dhana Argala (2nd house)** vs. **Virodhargala (12th house)**.
     - **Sukha Argala (4th house)** vs. **Virodhargala (10th house)**.
     - **Labha Argala (11th house)** vs. **Virodhargala (3rd house)**.
     - **Putra/Dhi Secondary Argala (5th house)** vs. **Virodhargala (9th house)**.
     - **Papa Argala (3rd house when occupied by 3+ malefics — Unobstructed Intervention)**.
     - **7th-House Partner Argala** vs. **1st-House Virodhargala** *(and following Sanjay Rath's Ketu rule: reverse counting for Ketu-occupied signs where applicable)*.
     - For each pair, emit `status`: `"unobstructed_argala" | "dominant_argala" | "cancelled_equal" | "obstructed_virodhargala"` based on planet count, degree strength, and SAV bindus.
3. **Special Lagnas (`special_lagnas`) with Exact Degrees, Vargas & Indu Lagna Kalas:**
   - Serve **Hora Lagna (`HL`)**, **Ghatika Lagna (`GL`)**, **Indu Lagna (`IL`)**, **Sree Lagna (`SL`)**, **Varnada Lagna (`VL` — `V1` to `V12`)**, **Pranapada Lagna (`PL`)**, **Kunda Lagna**, and **Bhrigu Bindu (`BB`)** with:
     - Exact longitude (`longitude_deg`, `sign`, `sign_deg`, `nakshatra`, `house_from_lagna`, `house_from_al`).
     - Placement in **D1, D2 (Hora), D9 (Navamsa), and D10 (Dasamsa)**.
     - For **Indu Lagna (`IL`)**: serve the **16-Kala Ray Breakdown** (`Sun 30, Moon 16, Mars 6, Mercury 8, Jupiter 10, Venus 12, Saturn 1`), identifying the exact `9th_lord_kala`, `9th_from_moon_lord_kala`, total modulo-12 remainder, and which planets occupy or aspect `IL` by Rasi and Graha Drishti.
4. **Chara Karakas (Both 7-Karaka and 8-Karaka Schemes) & Karakamsa (`KL`) / Swamsa:**
   - Serve both **Parashara/Jaimini 8-Karaka scheme** (including Rahu via `30° - deg`, with `AK, AmK, BK, MK, PiK, PK, GK, DK`) and **7-Karaka scheme**, plus any **Chara Karaka Replacement (`Sthira Karaka` backup when two planets tie in degree)**.
   - Serve **Karakamsa Lagna (`KL` — AK's sign in D9)** and **Swamsa (Lagna in D9)**, with planets in the **1st, 2nd, 5th, 6th, 7th, 9th, 10th, and 12th from Karakamsa** (for spirituality, deity [*Ishta Devata* = 12th from KL; *Palana Devata* = 6th from AmK in D9; *Guru Devata* = BK in D9], career, and chronic illness).

---

### 3.4 Lunar Astro / Deepanshu Giri System (Pending Karma, 64th Navamsa, 22nd Drekkana, Bhrigu Bindu)

To support **Lunar Astro (Deepanshu Giri)** predictive techniques, Radha must compute and serve:
1. **Sensitive Crisis & Leak Points (`sensitive_points`) — MUST ADD TO RADHA:**
   - **`khara_navamsa_64` (64th Navamsa — 4th from D9 Lagna AND 4th from D9 Moon):** Sign, degree span in D1 (`from_deg` to `to_deg`), lord, and any natal or transiting planets occupying it. *(Transits of Saturn, Rahu, Ketu, or Mars across the 64th Navamsa lord or degree trigger sudden financial leaks, health scares, or relationship breaks).*
   - **`khara_drekkana_22` (22nd Drekkana — 8th from D3 Lagna AND 8th from D3 Moon):** Sign, 10° span in D1, nature of the Drekkana (*Sarpa [Serpent], Pakshi [Bird], Chatushpada [Quadruped], Ayudha [Weapon], Nigada [Fetters/Chains], Pasha [Noose]*), and its lord.
   - **`bhrigu_bindu` (Moon-to-Rahu Midpoint):** Exact degree (`(Moon_lon + Rahu_lon) / 2` counted counterclockwise from Moon to Rahu), sign, house, nakshatra, and exact dates when transiting **Jupiter, Saturn, Rahu, Ketu, Mars, Venus, or Mercury** cross within ±2° of the Bhrigu Bindu (the #1 Bhrigu trigger for sudden destined payouts, travel, or life turns).
2. **Dispositor Graph & Nakshatra-Lord (Nadi) Chains (`dispositor_chains`):**
   - **Rasi Dispositor Tree (D1 & D9):** Terminal own-sign roots (e.g., `Mars in Scorpio`), mutual receptions (*Parivartana*), and closed loops (e.g., `Mercury -> Venus -> Sun -> Mercury`), flagging the **weakest link in any closed loop** by dignity/Avastha.
   - **Nakshatra Dispositor Tree (`star_lord_chain`):** Which planets sit in **Saturn's stars** (*Pushya, Anuradha, Uttara Bhadrapada*), **Ketu's stars** (*Ashwini, Magha, Moola*), **Rahu's stars** (*Ardra, Swati, Shatabhisha*), etc., showing the hidden Nadi operator behind each house.
3. **Pending Karma (`pending_karma_audit`):**
   - Automatically flag:
     - **Retrograde Natal Planets** (unfinished past-life promises requiring 3x repetition).
     - **Planets & Cusps in Saturn's Signs/Stars or Conjoined with Maandi/Gulika** (where the native must perform "Blind Saturnian Actions"—thankless, clockwork discipline without immediate reward—to unlock the house's wealth).
     - **6th/8th/12th Lord Placements on Wealth Lagnas (`HL/IL`) or Arudhas (`AL`, `UL`, `A2`, `A8`)** (indicating whether money comes through OPM, litigation, auditing, service, or Viparita reversal).

---

### 3.5 Wealth, OPM, Speculation vs. Investing & Annual Tajaka Requirements

1. **Multi-Channel Wealth & D2 Hora Audit (`wealth_audit`):**
   - Serve both **Parashara Hora (D2 — Leo/Cancer)** and **Kashinatha / Jagannatha Hora (D2 — 12-sign wealth chart)** with full house placements from D2 Lagna, explicitly scoring:
     - **Channel 1 — Salaried / Contract Service:** 6th house, 6th lord, `HL/IL` house, and D10 6th/10th houses.
     - **Channel 2 — Entrepreneurship / Own Venture:** 10th house, `AL`, `A10`, `A7`, 7th from `AL`, and Annual `Vyaapaara saham`.
     - **Channel 3 — Other People's Money (OPM — Retainers, Venture Capital, Float, Settlements):** 8th house, 8th lord, `A2` vs. `A8` relationship, and D2 8th house.
     - **Channel 4 — Family Inheritance:** 8th SAV bindus, 9th SAV bindus, `BK` & `PiK` placements, and Annual `Pithri / Bhratri / Mrithyu sahams`.
     - **Channel 5 — Systematic Investing (Stocks / Retirement / Real Estate) vs. Speculation (Options / Gambling):** Compare **D2 Lagna & 2nd/4th/11th houses** (long-term compounding) against **D1 5th house + D2 5th house** (speculation—flagging whenever malefics or debilitated planets occupy the D1/D2 5th house).
2. **Annual Charts (`annual.varsha` & `annual.tithi_pravesha`) Upgrades:**
   - Serve **Annual Divisional Charts (`D2, D4, D7, D9, D10`)** for each stored year (`reading_year - 1` to `reading_year + 5`).
   - Serve **Muntha** (sign, house in annual chart, house in natal chart, and Muntha lord placement/dignity).
   - Serve **Varsheshwara (Lord of the Year)** with full **Panchavargiya Bala** and **Harsha Bala** scores.
   - Serve **Tajaka Aspects (`Ithasala` [applying — event happens], `Ishrafa` [separating — missed opportunity], `Nakta` [transfer of light via faster third planet], `Yamaya` [collection of light], `Kamboola`, `Radda` [retrograde/debilitated reversal])** between the Year Lagna lord, Muntha lord, and the lords of the 2nd (money), 4th (home/car), 6th (job/litigation), 7th (marriage/partner), 10th (career), and 11th (gains).

---

### 3.6 High-Precision Transit, Eclipse, Kakshya & Daily Cash-Inflow Engine

To tell a user **which exact days within 1 month and 3 months money will be visible in the bank**, when to shop, when to go out with friends, and when an eclipse or transit threatens to steal money:

1. **Fast-Planet & Special-Point Transit Contacts (`transit_contacts`):**
   - Upgrade `transit_contacts` to accept **all 9 grahas** (`Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke`) as transiting bodies, and expand the target list beyond natal planets to include:
     - **Natal Lagna, `HL` (Hora Lagna), `IL` (Indu Lagna), `GL` (Ghatika Lagna), `AL` (Arudha Lagna), `UL` (Upapada Lagna), `A2`, `A7`, `A8`, `A10`, `A11`, and `Bhrigu Bindu`**.
     - **Active Year's Tajaka Sahams** (`Laabha, Artha, Dhana, Karma, Vyaapaara, Vivaha, Bandhu, Roga, Jadya, Bandhana, Sathru, Paradesa`).
2. **Daily Ashtakavarga Kakshya (3°45′ Sub-Division) & BAV Bindu Scoring (`daily_kakshya`):**
   - For every day in the 365-day forward window (`reading_date` to `reading_date + 365 days`), serve for each transiting planet (`Su, Mo, Ma, Me, Ju, Ve, Sa`):
     - `bav_bindus_in_sign` (0–8 bindus in that planet's Bhinnashtakavarga for the sign it is transiting).
     - `sav_bindus_in_sign` (Sarvashtakavarga bindus of the sign).
     - `kakshya_lord` (which of the 8 contributors—`Sa, Ju, Ma, Su, Ve, Me, Mo, Lagna`, each ruling a 3°45′ slice—governs the planet's exact degree today) and `has_kakshya_bindu` (`true` if that `kakshya_lord` contributed a bindu in the Prastarashtakavarga table!).
   - **Why this is a game-changer for 1-Month Cash Timing:** When transiting **Jupiter, Venus, Mercury, Sun, or Moon** enters a **3°45′ Kakshya where `has_kakshya_bindu == true`** inside your 2nd, 6th (`HL/IL`), 10th (`AL`), or 11th house during a *Sampat* or *Sadhana* Tara day, **that is the exact 1–3 day window when cash hits the bank or a deal is signed.**
3. **Pre-Scored Daily Muhurta & Cash/Lifestyle Tags (`daily_panchanga_scores`):**
   - For every day in the 90–180 day window, serve:
     - `tithi`, `vara`, `nakshatra`, `yoga`, `karana`, `rahu_kala`, `gulika_kala`, `abhijit_muhurta`.
     - `tara_bala` (1–9 from Janma Nakshatra + special check from Karma [10th] and Vainashika [22nd] stars), `chandra_bala` (house from natal Moon + house from natal Lagna), and `panchaka_rahita`.
     - **Domain Suitability Flags per Day:** `is_cash_inflow_day`, `is_job_interview_day`, `is_contract_signing_day`, `is_legal_filing_day`, `is_social_friends_day`, `is_home_shopping_day`, `is_speculation_danger_day`.

---

## 4. Live PostgreSQL `kundli_data` vs. `kundli_digest` Consumption Inventory (2026-11-06 Audit)

Across the three primary benchmark kundlis — **Sachin Mohan** (`c584c0a3-841b-451b-a2ed-f5709c5fb31d`, `1980-10-14 16:55 IST Pune`), **Sumit** (`75b0d618-90b7-4db6-bff8-cc7bb0ed561f`, `1975-09-06 14:55 IST Pune`), and **Archisha** (`6514751c-9b30-45e6-bad6-0a56415e067b`, `1998-12-17 13:28 IST Delhi`) — `kundli_data` stores **158 distinct `data_type` keys**:

1. **Consumed by `buildDigestRows` (`src/reading/digest/build.ts`) → `kundli_digest`**:
   - **12-Varga Structural Tables (`D1, D2, D3, D4, D7, D9, D10, D12, D20, D24, D30, D60`)**: `dignities(.dN)`, `aspects(.dN)`, `argala.d1..d60`, `arudhas(.dN)`, `house_counts(.dN)` → `HouseCard` (`144` rows) & `PlanetCard` (`108` rows).
   - **11-Varga Placement Tables (`D5, D6, D8, D11, D16, D27, D40, D45, D81, D108, D144`)**: `varga.dN` (+ `avasthas.d16` on `D16`) → `PlanetCard` (`99` rows; `207` total `PlanetCard` rows across all 23 vargas).
   - **5-Varga Planetary Avasthas (`avasthas`, `avasthas.d9`, `avasthas.d10`, `avasthas.d16`, `avasthas.d24`)**: `PlanetCard.avasthas`, `PlanetCard.avasthaMultipliers` (`baladi`, `jagradadi`, `effective`, `ripeness`), `PlanetCard.chain` (D1 rasi dispositor chain), `PlanetCard.starChain` (D1 nakshatra dispositor chain), `PlanetCard.sunProximity` (D1 solar proximity distance, orb & zone), `PlanetCard.dashaCharter` (D1 5-vector charter & 9×9 Antardasha fruition matrix), `PointRow` (`D1.K64M`, `D1.K64L`, `D1.KD22`, `D1.BB`), and `StarProfile.pendingKarmaHouses`.
   - **D1 Strength, Nature, Yogas & Points**: `strength.shadbala`, `ashtakavarga`, `benefic_malefic`, `yogas`, `doshas`, `karaka.chara`, `sphutas`.
   - **Annual Charts (`annual.varsha`, `annual.tithi_pravesha`, `annual.tithi_pravesha_dasha`, `annual.mudda`, `annual.patyayini`, `annual.sahams`)**: `AnnualRow` (`200` rows for Sumit across `2016–2035` in `D1, D2, D7, D9, D10`; `2` rows each for Sachin & Archisha pending annual top-up sweep).
2. **Consumed by `buildActivationRows` (`src/reading/digest/activation.ts`) → `kundli_activation`**:
   - **42–43 Dasha Systems + 6 `.l3` 3-Level Dashas** (`dasha.*`, including `dasha.vimsottari.l3`, `dasha.dwisatpathi.l3`, `dasha.narayana.l3`, `dasha.tithi_ashtottari.l3`, `dasha.yogini.l3`, `dasha.sudasa.l3`) → `8,298–12,586` `kundli_activation` rows per kundli across 7 families.
3. **Stored in `kundli_data` (Ready) & Available for Future Digest / Dossier Enrichment**:
   - `strength.bhava` (house rupas, virupas, ratios, and ranks `1..12`), `strength.vimsopaka` (`shadvarga`, `sapthavarga`, `dasavarga`, `shodashavarga` composite scores & `strong_vargas`), `strength.harsha` (`harsha_bala`, `pancha_vargeeya_bala`, `dwadasa_vargeeya_bala`), `bhava` (Sripati cusp longitudes), `panchanga.birth` (birth tithi, nakshatra, yoga, karana, sunrise/sunset, hora/kaala lords), `reading_tables` (summary table bundle), `relations(.dN)` (Panchadha friendship matrices), and `dasha.applicable` (conditional dasha eligibility flags).
