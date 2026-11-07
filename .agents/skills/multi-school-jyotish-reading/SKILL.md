---
name: multi-school-jyotish-reading
description: Four-school Vedic Astrology synthesis (Parashara, Jaimini, Sanjay Rath Pt. Tradition, and Lunar Astro / Deepanshu Giri) with Rule 0 Anti-Sycophancy Claim Verification & Multi-Entity Disambiguation, 4-Tier Behavioral Playbook (Sattvic/Rajasic/Mediocre/Baseline), 3-Method & 5-Rank Forensic Calibration, Remaining Largest Mahadasha (10–18+ Yr) Charter & 9x9 Fruition Matrix, 5-System Planetary Avasthas with Delivery Multipliers, Immediate 1/3/6/9/12-Month Wealth Ladder, Shelter-in-Place Hurricane Evacuation Protocol, and 18-Year Retrospective Blind Event Prediction. Use whenever generating or revising comprehensive life readings, wealth/career forecasts, or retrospective life analyses.
---

# Multi-School Jyotish Reading & Strategic Life Engineering

> **Strict Redaction Mandate (`SOUL.md` §1):** Never output internal calculation engine or library names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) in any user-facing reading, report, or prompt output. Refer only to classical Jyotish traditions, astronomical ephemerides, or "our astrological calculations."

---

## 0. Anti-Sycophancy Claim-Verification & Multi-Entity Disambiguation Rule ("Never Go By What the User Enters")
**CRITICAL MANDATORY RULE:** Never accept a user's prompt, clarify answer, or simplified label as "fact" and parrot it back. Users naturally compress or conflate multiple people, partners, or ventures when describing their situation (e.g., saying *"an older guy I work with"* or *"my brother I stay with"*). Doing so makes the reading look sycophantic and astrologically blind.

Before taking any user claim forward, **audit and challenge the claim against the chart geometry first**:
1. **Multiplicity Audit (How Many Distinct People/Counterparties Does the Chart Show?):**
   - Inspect the **7th house (business partners/counterparties)**, **6th house (service/contracting employers)**, **8th house (legacy/agency client pools)**, and **11th house (elder siblings/network ventures)** across `D1`, `D9`, and `D10`:
   - When multiple grahas occupy a house while the house lord goes to another house and the 11th house holds a distinct graha/lord circuit, **the native is NOT dealing with just one person!**
   - *Calibration Case (`Sachin`, `c584c0a3`, D1 Pisces / D9 Leo / D10 Sagittarius)*: `Jupiter + Saturn + Sun` occupy 7th house Virgo, while `7th lord Mercury` sits in 8th house Libra and `11th house Capricorn` holds `Ketu` ruled by `Saturn`.
   - Explicitly tell the user: *"Looking at your chart geometry, it does not look like you are working with just one older person (50s–70s), nor is a senior partner simply 'Saturn = old.' Your chart splits your 50s–70s counterparties into **multiple distinct figures** across separate tracks."*
2. **Composite Planetary Profession Audit (Never Reduce Saturn to Just "Old"):**
   - A person's profession and role come from the **composite planetary circuit** (sign, nakshatra lord, conjunctions, and aspects). In our reference calibration chart (`Sachin`, `c584c0a3`), this disambiguates three separate 50s–70s tracks:
   - **Track A — Senior Construction / Roofing / Real-Estate Principal (`Saturn in 7th + Sun in Chitra [Mars star] + Mars in Anuradha [Saturn star] + Saturn 10th aspect on 4th House of Buildings/Roofs`):**
     - Do not say *"you work with an old Saturn guy."* Say: *"One senior man (60s–70s) you are building a venture with has strong **Mars + Saturn + 4th-house** characteristics (`Sun in Chitra` [the Celestial Architect] conjoined `Saturn` in 7H, exchanging nakshatras with `Mars in Anuradha`, while `Saturn` aspects the 4th house of buildings/roofs). He must own or run **building, construction, roofing, or real-estate companies** and bring deep industry contacts (`CarbonLite`)."*
   - **Track B — Senior Software Development Shop Owner / Freelance Contracting Agency (`7th & 4th Lord Mercury in 8th House Libra + 6th-Lord Sun in 7th + D10 Sagittarius Lagna with 1st/4th Lord Jupiter in 7th House Gemini`):**
     - Because the 7th lord `Mercury` (software, code, web tools) sits separately in the 8th house (contracted client pools) while 6th-lord `Sun` (fee-for-service contracting) sits in the 7th house (Virgo) and `D10` rises in Sagittarius with `Jupiter in 7H Gemini` (`Mercury's` sign) and `Mars in 10H Virgo` (`Mercury's` sign), say: *"There is a **second older business owner** in the **software development / IT agency** field who owns a development shop (`CF Webtools`) and under whom you work as a **freelance/contract developer** serving small and mid-size businesses."*
   - **Track C — Elder Brother in His 50s Commissioning the Astrology / AI Platform (`11th House Capricorn [Elder Brother] with Ketu in Shravana + 11th Lord Saturn Conjunct Lagna/10th Lord Jupiter [Jyotish] + 5th House Rahu [AI]`):**
     - Because the 11th house (`elder brother`) is Capricorn (ruled by `Saturn` → 50s age bracket) occupied by `Ketu` (karaka of Jyotish/intuition), and its lord `Saturn` sits in the 7th house conjoined `Jupiter` (karaka of Vedic astrology/counsel) aspected by `5th-house Rahu` (AI/software architecture) and `9th-house Moon-Mars in Scorpio` (occult calibration), say: *"Your **elder brother (in his 50s)** is not merely providing a roof over your head—your 11th-lord `Saturn` conjoined `Jupiter` and aspected by `5th-house Rahu` shows he is actively **commissioning and partnering with you to build and fine-tune an AI + Vedic Astrology (`Jyotish`) application (`AI AdAstra`)**!"*

---

## 1. Non-Sycophantic 3-Method Confirmation & 5-Rank Forensic Calibration Hierarchy
Never confirm what a user hopes or fears from a single indicator. Every major prediction (past or future) requires **3 or more independent astrological confirmations** across the 5-Rank Forensic Hierarchy (`docs/TECHNIQUE.md` §2 & `docs/reading-engine/37`):

1. **Rank 1 — Applicable Conditional Nakshatra Dasha (`dasha.applicable` in `kundli_activation`)**:
   - Always check conditional dasha applicability first! When Lagna lord is in the 7th house or 7th lord is in the 1st house (e.g., Pisces Lagna with `Jupiter in 7H Virgo`), **Dwisaptati Sama Dasha (72-year cycle, 9 years per graha)** is the primary clock alongside Vimshottari. Also check `Chaturaseeti Sama`, `Shatabdika`, `Shodashottari`, `Dwadashottari`, `Panchottari`, and `Shattrimshat Sama`.
2. **Rank 2 — Multi-Family Nakshatra & Jaimini Rasi Dashas (`kundli_activation` across 42–43 systems / 7 families)**:
   - Cross-check `Vimshottari` (L1/L2/L3), `Yogini`, `Tithi Ashtottari`, `Kaala`/`Karaka` dashas, and Jaimini Rasi dashas: **Narayana Dasha**, **Chara Dasha**, **Sudasa (Shree Lagna)** for wealth, **Drig Dasha** for directional shifts, and **Shoola / Nirvana Shoola Dasha** for health/crisis windows.
3. **Rank 3 — Dasha Lord House Ownership & Varga Placement (**Forensic Calibration Law**)**:
   - **Calibration Law (`docs/reading-engine/37`):** *Rank 3 Dasha Ownership overrides Rank 5 Transits.* When an active Mahadasha/Antardasha lord owns the 10th house and sits in a Kendra (1/4/7/10) with strong D10 dignity, a simultaneous 8th-house slow transit does **not** halt career ascension—it manifests as high-pressure restructuring inside an expanding role.
   - Verify natal house, lord, **Arudha Padas** (`AL`, `UL`, `A2`..`A11` in `kundli_digest` `point` section), **Argala / Virodhargala** (`HouseCard.argala`), and owning Varga (`D2` wealth, `D4` property/relocation, `D7` children, `D9` marriage/dharma/fruit, `D10` career/authority, `D12` parents, `D16` vehicles/accidents, `D24` education, `D30` crisis, `D60` root karma).
4. **Rank 4 — Annual Return Confirmation (`Tithi Pravesha` + `Varshaphal` in `kundli_digest` `annual` section)**:
   - Check `TP<year>.D1` / `TP<year>.D9` / `TP<year>.D10` and `VP<year>.D1` / `VP<year>.D9` / `VP<year>.D10`, including **Muntha** (`AnnualRow.muntha`), **Year Lord** (`AnnualRow.yearLord`), **Tajaka Yogas** (`AnnualRow.tajakaYogas`), annual `Mudda`/`Patyayini`/`Tithi Ashtottari` dashas (`AnnualRow.dashas`), and **Sahams** (`Punya`, `Vidya`, `Yashas`, `Artha`, `Karya Siddhi`, `Mrityu`, `Kali`, `Paradara`, `Jala-Pathana` in `AnnualRow.sahams`).
5. **Rank 5 — Gochara Transit & Ashtakavarga Gate (`SkyView` + `HouseCard.sav`)**:
   - Check slow-planet transits (`Saturn`, `Jupiter`, `Rahu`, `Ketu`) over natal houses, `Bhrigu Bindu` (`D1.BB`), `64th Navamsa` (`D1.K64M`, `D1.K64L`), and `22nd Drekkana` (`D1.KD22`), weighted by Sarvashtakavarga (`HouseCard.sav`) and Bhinnashtakavarga bindus.
6. **Forensic Event Disambiguation Rules (`docs/TECHNIQUE.md` §3)**:
   - **Voluntary Vehicle Switch vs. Crash (`Vahana Pada A4` vs. Double 4th-Lord-in-8th):** Activation of `A4 in H12` (expenditure on vehicles) triggers voluntary buying/selling/trading of cars; actual vehicle accidents require **double 4th-lord-in-8th activation** (`D1 4th lord` + `D16 4th lord` connected to `8th house` / `Mrityu Saham` / `KD22`).
   - **Romantic Initiation vs. Friction (`D9 H7` vs. `D9 H2`):** For combust `Venus` (`Kopita`), activation of `D9 H7` initiates a relationship, whereas activation of `D9 H2` (maraka to 7th) triggers ego friction or separation.

---

## 2. Four-Tier Behavioral Playbook (`Sattvic / Rajasic / Mediocre / Baseline`) (`SOUL.md` §3)
Astronomical geometry shows the **energy axis**; how a person lives that axis depends on their **Operating Tier (Guna) & Socio-Economic Context**. Every reading must calibrate its interpretation across four distinct behavioral tiers:

1. **Tier 1 — Sattvic (Conscious / Mastery / Dharmic Channeling)**:
   - *Ketu in 2H*: Speaks deliberate, high-signal truth; non-attached stewardship of family resources.
   - *Saturn in 8H*: Deep systems/actuarial/research mastery, longevity discipline, and calm crisis navigation.
   - *Venus + Mars in 6H*: High-craft design/engineering execution in service of solving hard problems.
2. **Tier 2 — Rajasic (Ambitious / Transactional / High-Agency Builder)**:
   - *Ketu in 2H*: Abrupt financial pivots, unconventional income structures, blunt boardroom speech.
   - *Saturn in 8H*: Restructuring legacy debt, M&A/tax/insurance leverage, grinding through institutional bottlenecks.
   - *Venus + Mars in 6H*: Intense competitive drive in agency/legal/commercial disputes and passionate workplace alliances.
3. **Tier 3 — Mediocre (Passive / Drifting / Reactive)**:
   - *Ketu in 2H*: Unplanned savings leaks, inconsistent family budgeting,avoidance of financial tracking.
   - *Saturn in 8H*: Chronic anxiety over shared bills, delayed reimbursements, and lingering fatigue.
   - *Venus + Mars in 6H*: Draining office politics, impulsive spending on conveniences, and relationship stalemates.
4. **Tier 4 — Baseline (Survival / Unconscious / Raw Friction)**:
   - *Ketu in 2H*: Harsh or erratic speech causing family estrangement and sudden liquidity dry-ups.
   - *Saturn in 8H*: Acute debt traps, chronic neglect of health warnings, or legal/tax penalties.
   - *Venus + Mars in 6H*: Destructive conflicts with coworkers/partners and recurring vitality depletion.
5. **Dynamic Tier Shift Rule**:
   - Even a normally Tier 1/2 native can drop one tier during a `Shadashtaka (6/8)` or `Dwirdwadasha (2/12)` Antardasha (`AntardashaFruitionCell.isShadAshtaka68` / `isDwirdwadasha212`). Always prescribe the **Sattvic / Rajasic upgrade path** so the native consciously channels the house energy upward.

---

## 3. Five-System Planetary Avasthas, Delivery Multipliers & Solar Proximity
A planet in a great yoga cannot deliver ripe fruit if its **Avastha** or **Sun proximity** cripples its capacity. Always inspect `PlanetCard.avasthas`, `PlanetCard.avasthaMultipliers`, and `PlanetCard.sunProximity` in `kundli_digest` (`src/reading/digest/build.ts`):

1. **Baladi Avastha (Age State — Odd/Even Sign by 6° Arcs, `avasthaMultipliers.baladi` & `ripeness`)**:
   - `Bala` (Infant, multiplier `0.25`, `unripe_sour`): Early/unripe; needs external scaffolding.
   - `Kumara` (Adolescent, multiplier `0.50`, `half_ripe`): Growing but restless.
   - `Yuva` (Youth, multiplier `1.00`, `fully_ripe_sweet`): Full, ripe, sovereign delivery.
   - `Vriddha` (Senior/Old, multiplier `0.35`, `over_ripe_delayed`): Delayed, institutional/legacy fruit maturing on the 2nd/3rd cycle.
   - `Mrita` (Dormant/Dried Seed, multiplier `0.10`, `dried_seed_externalized`): Dormant personal fruit; externalizes through its **Sign Dispositor (`PlanetCard.dispositor`)** and **Nakshatra Lord (`PlanetCard.starLord`)**.
2. **Jagradadi Avastha (Alertness, `avasthaMultipliers.jagradadi`)**:
   - `Jagrat` (Awake, `1.00` — own/exalted), `Swapna` (Dreaming, `0.60` — friend/neutral), `Sushupta` (Asleep, `0.25` — enemy/debilitated).
   - **Combined Delivery Multiplier (`avasthaMultipliers.effective`)** = `baladi.multiplier × jagradadi.multiplier`.
3. **Deeptadi Avastha (9 Dignity/Ray States)**: `Deepta` (blazing), `Swastha` (comfortable), `Mudita` (delighted), `Shanta` (peaceful), `Shakta` (strong/capable), `Peedita` (oppressed), `Deena` (depressed), `Vikala` (crippled by malefics), `Khala` (mischievous), `Bheeta` (fearful).
4. **Lajjitadi Avastha (Psychological/Emotional Flavor)**: `Lajjita` (5th-house hesitation), `Garvita` (exalted/moolatrikona pride), `Kshudhita` (starved by enemy/Saturn), `Trishita` (thirsty in watery sign aspected by enemy), `Mudita` (joyful with friendly benefic), `Kshobhita` (agitated with Sun + malefics).
5. **Shayanadi Avastha (12 Subconscious Micro-Behaviors)**: Explains *why* the native buys specific items, feels a certain way, or acts instinctively (`Shayana`, `Upaveshana`, `Netrapani`, `Prakashana`, `Gamana`, `Agamana`, `Sabha`, `Agama`, `Bhojana`, `Nritya Lipsa`, `Kautuka`, `Nidra`).
6. **Solar Proximity Audit (`PlanetCard.sunProximity`)**:
   - `cazimi` (`< 0.2833°` / `17'`): Empowered at the heart of the Sun.
   - `deep_combustion_sikhin` (`< 3.0°`): External significations fused into the Sun's house charter.
   - `standard_combustion` (`<= classical_orb_deg`): External significations subordinated to the Sun's house.
   - `burnt_edge_tapta` (`<= classical_orb_deg + 3°`): Mild solar heat.
   - `free_of_sun`: Independent ray delivery.

---

## 4. Remaining Largest Mahadasha (10–18+ Yr) Charter & 9×9 Antardasha Fruition Matrix (`life.mahadasha_charter`)
Wired in `src/reading/digest/build.ts` (`PlanetCard.dashaCharter`) and `src/reading/life/charter.ts` (`buildMahadashaCharter`, `docs/reading-engine/55-life-reading-mahadasha-charter.md`):

1. **Primary Mahadasha Selection & Bridge (`selectCharterMahadasha`)**:
   - If the running Vimshottari Mahadasha has `>= LIFE_CHARTER_MIN_REMAINING_YEARS` (default `10` years) remaining, it is the primary chartered chapter.
   - Otherwise, `selectCharterMahadasha` selects the **first upcoming Mahadasha with `>= 10` years starting within `10` years of `today`** as the primary charter, and carries all remaining sub-periods of the pre-primary Mahadasha(s) as the chronological `bridge` (`LifeMahadashaBridge`).
2. **5-Vector Mahadasha Charter (`PlanetCard.dashaCharter`)**:
   - **Vector 1 (Occupied House & Arudhas)**: `house`, `sign`, `dignity`, `arudhasInSign`.
   - **Vector 2 (Sign Dispositor)**: `dispositor`, `dispositorHouse`, `dispositorDignity`, Rasi dispositor `chain`.
   - **Vector 3 (Nakshatra Lord / Sutradhara)**: `starLord`, `starLordHouse`, `starLordDignity`, `starLordArudhas`, Nakshatra dispositor `starChain`.
   - **Vector 4 (Lordships, Co-Lordship & Drishti)**: `housesOwned`, `housesCoOwned`, `coLordPartner` (Scorpio `Ma/Ke`, Aquarius `Sa/Ra`), `grahaDrishtiHouses`, `rasiDrishtiHouses`.
   - **Vector 5 (Yogi / Avayogi / Sahayogi)**: `isYogi` (prosperity multiplier), `isSahayogi`, `isAvayogi` (leakage warning).
3. **9×9 Antardasha-from-Mahadasha Fruition Matrix (`dashaCharter.fruition[adCode]`)**:
   - `houseFromMd` (`1..12` distance from MD lord to AD lord) & `houseFromLagna`:
   - `trikona_manifestation` (`1, 5, 9` from MD) and `kendra_structural` (`4, 7, 10` from MD): Primary structural and dharmic fruition windows.
   - `dhana_labha_gain` (`2, 11` from MD) and `upachaya_effort` (`3` from MD): Financial accumulation and initiative windows (tempered by `isDwirdwadasha212` unless linked as star lord/dispositor/co-lord).
   - `dusthana_reversal_crisis` (`6, 8, 12` from MD) or `isShadAshtaka68`: Friction, restructuring, or reversal windows (`tone = 'careful'`).
   - Direct MD-to-AD links (`isStarLordOfMd`, `isSignDispositorOfMd`, `isCoLordPartnerOfMd`): Elevate the Antardasha into a primary delivery agent for the Mahadasha's charter.

---

## 5. Four-School Synthesis & Digest Data Map
Every reading weaves together four classical and Nadi schools directly from the kundli's stored `kundli_digest` and `kundli_activation` rows:
1. **Maharishi Parashara (BPHS)**: Bhava lords (`HouseCard`), Dhana/Raja/Viparita/Neecha-Bhanga Yogas (`YogaRow` across D1 & Vargas), Shadbala (`PlanetCard.shadbalaRatio/Rank`), Ashtakavarga (`HouseCard.sav`), Vimshottari + Conditional Dashas (`kundli_activation`), and 5 Avastha systems (`PlanetCard.avasthas` & `avasthaMultipliers`).
2. **Maharishi Jaimini**: Chara Karakas (`D1.AK`..`D1.DK` and `D9.AK`..`D9.DK` in `PointRow`), Rasi Drishti (`HouseCard.aspectedRasi`), Argala/Virodhargala (`HouseCard.argala`), and Chara/Sthira/Mandooka/Shoola Rasi Dashas (`kundli_activation`).
3. **Pt. Sanjay Rath (Puri Tradition)**: Arudha Lagna (`D1.AL`) vs Satyapeetha (`1H/7H`), Upapada (`D1.UL`), Bhava/Surya/Chandra Arudhas (`D1.A1`..`D1.A12`, `S9`, `C7`), Badhaka (`D1.badhaka` & `HouseCard.class` `'badhaka'`), Narayana & Sudasa Dashas, and Annual Tithi Pravesha (`TP<year>.D1`).
4. **Lunar Astro (Deepanshu Giri)**:
   - **Dispositor Chains**: Rasi dispositor `PlanetCard.chain` and Nakshatra dispositor `PlanetCard.starChain`.
   - **Pending Karma (`StarProfile.pendingKarmaHouses`)**: Houses held by Saturn, aspected by Saturn (`3rd/7th/10th`), occupied by planets in Saturn stars (`Pushya`, `Anuradha`, `Uttara Bhadrapada`), or occupied by retrograde grahas.
   - **Sensitive Khara & Transit Points (`PointRow`)**: `D1.K64M` (64th Navamsa from Moon), `D1.K64L` (64th Navamsa from Lagna), `D1.KD22` (22nd Drekkana from Lagna), and `D1.BB` (Bhrigu Bindu `Moon–Rahu` midpoint).

---

## 6. Mode-of-Earnings Audit, Immediate Wealth Ladder & Shelter-in-Place Protocol
1. **Mode-of-Earnings Audit (`11th House` & `Arudha Lagna AL` across `D1`, `D9`, `D10`)**:
   - Explicitly distinguish **Independent Equity / Principal Ownership** (`10th/11th/7th` lords in Kendra/Trikona with strong `AL` and `A10`) from **Salaried / Fee-for-Service Contracting** (`6th` house/lord dominance, `A6` activation) and **Commission / Advisory / Agency** (`8th` house client pools, `Mercury/Jupiter` influence).
2. **Immediate Humanity-First Wealth Ladder**:
   - **Never defer money 2 years out.** Always open the wealth section with an **Immediate 30-Day Tactical Cash & Relief Map**, followed by the **3-Month, 6-Month, 9-Month, and 12-Month Wealth Escalation Ladder** and **1–5 Year + 10–18 Year Mahadasha Wealth Architecture**.
3. **Shelter-in-Place vs. Hurricane Evacuation Protocol**:
   - Identify approaching Category-4/5 karmic storms (`dusthana_reversal_crisis` / `isShadAshtaka68` Antardashas + `K64M/K64L/KD22` transit hits) 6–24 months in advance, and prescribe concrete preparation: liquidity runway, career vehicle pivot, legal documentation, and exact exit/entry dates.

---

## 7. Reference Calibration Kundlis & Deterministic Digest Mapping (`kundli_digest` / `kundli_activation`)

### 7.1 Verified Reference Calibration Charts in PostgreSQL
| Reference Native | Primary `kundli_id` | Birth Data | Verified Lagnas (`D1 / D9 / D10`) | Applicable Conditional Dashas (`applies === true`) | Key Calibration Signatures |
|---|---|---|---|---|---|
| **Sachin** | `c584c0a3-841b-451b-a2ed-f5709c5fb31d` | `1980-10-14 16:55 Pune, IN` | `D1 Pisces` / `D9 Leo` / `D10 Sagittarius` | `dwisatpathi` (Lagna lord Ju in 7H), `shatabdika` (`sataatbika`, Vargottama Lagna) | `Ju (Mrita 0.10x) + Sa (#1 Shadbala) + Su in 7H Virgo`; `Mo (Neecha) + Ma in 9H Scorpio`; `Me in 8H Libra`; `Ve in 6H Leo`; `Ra in 5H` / `Ke in 11H`. |
| **Sumit** (`research-a.json`) | `75b0d618-90b7-4db6-bff8-cc7bb0ed561f` | `1975-09-06 14:55 Pune, IN` | `D1 Sagittarius` / `D9 Virgo` / `D10 Taurus` | `shodashottari` (`shodasottari`, Krishna Paksha Lagna in Moon Hora) | `Ju (Rx, Vargottama) in 4H Pisces`; `Su + Mo + Me in 9H–10H Leo/Virgo`; `Ve + Ma in 6H–9H`; `Sa in 8H Cancer`; `Ra in 12H Scorpio` / `Ke in 6H Taurus`. |
| **Archisha** | `6514751c-9b30-45e6-bad6-0a56415e067b` | `1998-12-17 13:28 Delhi, IN` | `D1 Pisces` / `D9 Aquarius` / `D10 Gemini` | `dwisatpathi` (7th lord Me in 9H / Lagna lord Ju in 12H), `shatabdika` (`sataatbika`) | `Sa (Neecha, Rx) in 2H Aries`; `Ma in 7H Virgo`; `Mo + Me in 9H Scorpio`; `Su + Ve in 10H Sagittarius`; `Ju in 12H Aquarius`; `Ra in 6H Leo` / `Ke in 12H Aquarius`. |

### 7.2 Dual-Lordship Rule (`Scorpio` & `Aquarius`) in Digest & House Layers
- In `dignities` (`v2`) and `benefic_malefic` (`v1`), Scorpio (`Ma`/`Ke`) and Aquarius (`Sa`/`Ra`) carry both a Parashari `natural_lord` (`Ma`, `Sa`) and a Jaimini stronger `lord` / `co_lord` (`Ke`, `Ra`).
- Never drop the Parashari natural lordship when evaluating house ownership (`PlanetCard.owns`, `HouseCard.lord`, `HouseCard.coLord`, and `PlanetCard.dashaCharter.housesOwned` / `housesCoOwned`):
  - In **Pisces Lagna** (`Sachin` & `Archisha`), **Mars owns both the 2nd (Aries) and 9th (Scorpio)** (`Dharmapati`), while **Ketu co-owns the 9th**.
  - In **Sagittarius Lagna** (`Sumit`), **Saturn owns both the 2nd (Capricorn) and 3rd (Aquarius)**, while **Rahu co-owns the 3rd**.

### 7.3 Conditional Dasha Name Normalization (`dasha.applicable` → `kundli_activation`)
- `items['dasha.applicable']` lists all 9 conditional dashas with a boolean `applies` flag and engine `type` names (`chathuraaseethi_sama`, `sataatbika`, `shattrimsa_sama`, `shodasottari`), whereas stored dasha trees use `DASHA_TREES.system` names (`chaturshitisama`, `shatabdika`, `shattrimsatsama`, `shodashottari`).
- Only systems where `applies === true` after `type → system` normalization receive `family = 'conditional'` (Rank 1). Non-applicable conditional trees receive `family = 'other'` and must never be counted as Rank 1 conditional confirmations.

---

## 8. Register Boundary: Plain-Words UI Boards vs. Deep Analytical Reports (`docs/reading-engine/45 §3.3` & `55 §6`)
1. **Consumer UI Boards & First-Screen Cards (`src/reading/life/compose.ts`, `src/reading/area/career.ts`)**:
   - Enforce `BANNED_RE`: **zero raw chart jargon** on first screens (`Mahadasha`, `Antardasha`, `Pratyantardasha`, `Vimshottari`, `Tithi Pravesha`, `Varshaphal`, `Gochara`, `Ashtakavarga`, `Sav`, `Bav`, `D1`, `D9`, `D10`, `Rasi`, `Navamsa`, `Dasamsa`, `Bhava`, `Graha`, `Drishti`, `Argala`, `Arudha`, `Karaka`, `Avastha`, `Lagna`, `Nakshatra`).
   - Translate every multi-school synthesis into plain English (`18-year Saturn chapter`, `Mercury sub-period`, `annual birthday chart`, `career chart`, `5 clocks across 3 independent families`).
2. **Analytical Dossiers, Research Views & Long-Form Life Readings**:
   - Cite the full 4-school technical evidence (`D1/D9/D10`, `Arudha Padas`, `Avastha` multipliers, `9×9 Fruition Matrix`, `Sav` bindus, and `Tithi Pravesha` sahams) while strictly obeying `SOUL.md` §1 (**never** output `Radha`, `pyjhora`, `AIAstra_Radha`, or `jhora`).

---

## 9. Related Domain Skills in This Repository
- **Career Reading (`career.reading`)**: [`.claude/skills/career-reading/SKILL.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/.claude/skills/career-reading/SKILL.md) — 6-layer deterministic house-layer scoring (`src/reading/area/career.ts`, `src/reading/area/houseLayers.ts`) over `kundli_digest` (`D1`, `D9`, `D10`) and `kundli_activation`.
- **Transit Reading**: [`.claude/skills/transit-reading/SKILL.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/.claude/skills/transit-reading/SKILL.md) — Dasha-gated Gochara transit synthesis (`SkyView` in `src/reading/life/sky.ts` + `kundli_transit_overlays`).
- **Transit Sky Preparation**: [`.claude/skills/transit-sky-preparation/SKILL.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/.claude/skills/transit-sky-preparation/SKILL.md) — Ephemeris sky timeline & natal contact preparation (`src/reading/transits/`).
