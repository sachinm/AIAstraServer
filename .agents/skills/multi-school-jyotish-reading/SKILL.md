---
name: multi-school-jyotish-reading
description: Four-school Vedic Astrology synthesis (Parashara, Jaimini, Sanjay Rath Pt. Tradition, and Lunar Astro / Deepanshu Giri) with 3-method confirmation, Dwisaptati Sama Dasha Charter & 9x9 Fruition Matrix, 5-system Planetary Avasthas, Immediate 1/3/6/9/12-Month Wealth Ladder, Shelter-in-Place Hurricane Evacuation Protocol, and 18-Year Retrospective Blind Event Prediction. Use whenever generating or revising comprehensive life readings, wealth/career forecasts, or retrospective life analyses.
---

# Multi-School Jyotish Reading & Strategic Life Engineering

## 1. Non-Sychophantic 3-Method Confirmation Rule
Never confirm what a user hopes or fears from a single indicator. Every major prediction (past or future) requires **3 or more independent astrological confirmations**:
1. **Multi-Dasha Convergence**: At least 2–3 dasha systems must align on the same house/planet axis:
   - **Conditional Nakshatra Dasha**: Check applicability first! When Lagna lord is in the 7th house or 7th lord is in the 1st house, **Dwisaptati Sama Dasha (72-year cycle)** is primary alongside Vimshottari. Also cross-check **Yogini Dasha**, **Tithi Ashtottari Dasha**, and **Kaala / Karaka Dasha**.
   - **Jaimini Rasi Dashas**: Cross-check **Narayana Dasha**, **Chara Dasha**, **Sudasa (Shree Lagna)** for wealth, **Drig Dasha** for spiritual/directional shifts, and **Shoola Dasha** for health/crisis windows.
2. **Structural Natal & Divisional Promise (D1 + Vargas + Arudhas + Argala)**:
   - Verify the natal house, its lord, **Arudha Padas** (`AL` for public status, `UL` for spouse/contracts, `A2/A11` for wealth/gains, `A4` for property/vehicles, `A6` for disputes, `A8` for sudden reversals, `A9` for higher education/fortune, `A10` for karma/office), and **Argala / Virodhargala** (intervention vs obstruction).
   - Confirm in the specific Varga: `D2` (Hora wealth), `D4` (Turyamsa property/relocation), `D9` (Navamsa dharma/marriage/fruit), `D10` (Dasamsa career/authority), `D12` (parents), `D16` (Shodasamsa vehicles/accidents), `D24` (Chaturvimshamsa college/learning), `D30` (Trimsamsa crisis), `D60` (Shashtyamsa root karma).
3. **Annual + Transit Trigger (`Tithi Pravesha` + `Varshaphal/Sahams` + `Gochara` + `Ashtakavarga`)**:
   - Check the **Annual Tithi Pravesha** Lagna, **Vara Lord (Year Lord)**, Hora Lord, Panchanga relationships, **Tajaka Varshaphal Muntha & Sahams** (`Punya`, `Vidya`, `Yashas`, `Artha`, `Mrityu`, `Kali`, `Paradara`, `Jala-Pathana`), and exact **slow-planet transit contacts** (`Saturn`, `Jupiter`, `Rahu`, `Ketu`) with Kakshya / Bhinnashtakavarga bindu scores.

---

## 2. Five-System Planetary Avasthas & Fruit Ripeness Audit
A planet in a great yoga cannot deliver ripe fruit if its **Avastha** or **Sun proximity** cripples its capacity. Always inspect the `avasthas` export from Radha (`pyserve/avasthas_export.py`):
1. **Baladi Avastha (Age State — Odd/Even Sign by 6° Arcs)**:
   - `Bala` (Infant, 25%): Early/unripe; needs external scaffolding.
   - `Kumara` (Adolescent, 50%): Growing but restless.
   - `Yuva` (Youth, 100%): Full, ripe, sovereign delivery.
   - `Vriddha` (Old, 12.5%): Delayed, fatigued, institutional/legacy fruit.
   - `Mrita` (Dead, 0%): Dormant physical fruit; acts internally, spiritually, or only via dispositor/conjunct planets.
2. **Jagradadi Avastha (Alertness)**: `Jagrat` (Awake, 100% — own/exalted), `Swapna` (Dreaming, 50% — friend/neutral), `Sushupta` (Asleep, 12.5% — enemy/debilitated).
3. **Deeptadi Avastha (9 Dignity/Ray States)**: `Deepta` (blazing), `Swastha` (comfortable), `Mudita` (delighted), `Shanta` (peaceful), `ina` (depressed), `Dukhita` (distressed), `Vikala` (crippled by malefics), `Khala` (mischievous), `Kopita` (combust/enraged by Sun).
4. **Lajjitadi Avastha (Psychological/Emotional Flavor)**: `Lajjita` (5th-house shame/hesitation), `Garvita` (exalted/moolatrikona pride), `Kshudhita` (starved by enemy/Saturn), `Trishita` (thirsty in watery sign aspected by enemy), `Mudita` (joyful with friendly Venus), `Kshobhita` (agitated with Sun + malefics).
5. **Shayanadi Avastha (12 Subconscious Micro-Behaviors)**: Explains *why* the native buys specific items, feels a certain way, or acts without knowing why (`Shayana` resting, `Upaveshana` sitting, `Netrapani` hand-on-eyes vigilance, `Prakashana` shining, `Gamana` moving/relocating, `Agamana` returning, `Sabha` assembly, `Agama` acquiring, `Bhojana` tasting/consuming, `Nritya Lipsa` craving movement, `Kautuka` curiosity, `Nidra` sleep).
6. **Sun Proximity Audit**: Distinguish **Cazimi** (`< 0°17'` — heart of the King), **Deep Combustion** (`< 3°` — charred outer fruit), **Standard Combustion** (within classical orbs), and **Vakra (Retrograde)** override.

---

## 3. Dasha Charter & 9×9 Antardasha-from-Mahadasha Fruition Matrix
Always explain *why* a Mahadasha is scheduled when it is and *what its charter/mission is* (from `avasthas.dasha_charter`):
1. **Origin Vector**: What houses does the Mahadasha lord rule (or co-rule), and what is its Chara Karaka role?
2. **Placement Vector**: Which Bhava and Rasi does it occupy in D1, D9, and D10?
3. **Dispositor Vector**: Where does its sign lord sit? (A planet in the 5th whose dispositor sits in the 10th routes 5th-house architecture directly into 10th-house public command.)
4. **Nakshatra Vector**: Who rules its Nakshatra and Pada?
5. **9×9 Antardasha Fruition Rule**:
   - Count houses from the **Mahadasha Lord to the Antardasha Lord** (`1..12` relative distance):
   - **6th, 8th, or 12th (Shadashtaka / Dwirdwadasha) from MD Lord** OR **functional 8th lord**: Produces friction, unpaid labor, hidden restructuring, or mirage promises (e.g., `Rahu–Venus` when Rahu is in Cancer 5H and Venus is 8th lord in Leo 6H).
   - **1st, 4th, 5th, 7th, 9th, 10th, or 11th from MD Lord** AND **functional benefic / Labha lord**: Delivers the ripe harvest of the Mahadasha's charter (e.g., `Rahu–Saturn` when Saturn is 11th/12th lord in 7th house Virgo, 3rd from Rahu and aspecting 1st/4th/9th).

---

## 4. Four-School Synthesis
Every reading must weave together:
1. **Maharishi Parashara (BPHS)**: Bhava lords, Dhana/Raja/Viparita/Neecha-Bhanga Yogas, Shadbala, Ashtakavarga, Vimshottari + Conditional Dashas (Dwisaptati), and 5 Avastha systems.
2. **Maharishi Jaimini**: Chara Karakas (`AK` to `DK`), Karakamsa & Swamsa, Rasi Drishti, Argala/Virodhargala, and Chara/Sthira/Mandooka/Shoola Rasi Dashas.
3. **Pt. Sanjay Rath (Puri Tradition)**: Arudha Lagna (`AL`) vs Satyapeetha (`1H/7H`), Upapada (`UL`), `A2/A6/A8/A9/A10/A11`, Badhaka & Maraka activation, Narayana & Sudasa Dashas, Tithi Pravesha Panchanga & Hora Lord, and Istha/Palan/Guru Devata remedies.
4. **Lunar Astro (Deepanshu Giri)**: Bhrigu Nandi Nadi (BNN) planetary circuits, Pending Karma by retrograde/afflicted houses, **64th Navamsa** (from Moon and Lagna) & **22nd Drekkana (Khara)** audit, **Bhrigu Bindu** (`Moon–Rahu` midpoint) transit triggers, and **Saturnian Blind-Action Remedies** (things you do consistently without immediate reward to discharge 6th/8th/12th debt so 2nd/11th wealth flows unobstructed).

---

## 5. Immediate Humanity-First Wealth Ladder & Shelter-in-Place Protocol
- **Never defer money 2 years out.** Always open the wealth section with an **Immediate 30-Day Tactical Cash & Relief Map** (exact dates when liquidity, small inflows, or safe discretionary enjoyment appear vs eclipse/retrograde days that steal money), followed by the **3-Month, 6-Month, 9-Month, and 12-Month Wealth Escalation Ladder** and **1–5 Year Wealth Architecture** (salaried vs consulting vs equity/OPM vs inheritance vs speculation).
- **Shelter-in-Place vs Hurricane Evacuation Protocol**: Treat astrology as a meteorological radar. Identify approaching Category-4/5 karmic storms (`Dasha Sandhi`, `Ashtama Shani`, `Rahu–8th Lord AD`, `Khara` transits) 6–24 months in advance, and prescribe concrete preparation: liquidity runway, career vehicle pivot, legal documentation, and exact exit/entry dates.

