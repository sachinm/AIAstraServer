# Kalachakra dasha (kālacakra daśā)

> A sign-based dasha driven by the navamsha pada of the Moon's nakshatra. Each of the 108 padas maps to a fixed run of nine signs (with a "body" sign and a "life" sign) and a full lifespan (paramayush) of 100, 85, 83 or 86 years. The running sign's years come from its lord. BPHS calls it the most authoritative of its group, told by Shiva to Parvati (46.6, 46.52). It is hard to compute and hard to read; specialist schools use it (SJC, some South Indian lineages). The jumps between non-adjacent signs (gatis) are its distinct signal.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Called the best of the kala/chakra group | ELS 46.6 | [TEXT] |
| Introduction; the twelve-spoke wheel | ELS 46.52–55 | [TEXT] |
| Savya (clockwise) stars from Ashwini; apasavya from Rohini | ELS 46.56–58, 46.70–72 | [TEXT] |
| Deha and jeeva signs per pada (savya) | ELS 46.60–69 | [TEXT] |
| Deha and jeeva per pada (apasavya) | ELS 46.73–81 | [TEXT] |
| Sign years: Sun 5, Moon 21, Mars 7, Mercury 9, Jupiter 10, Venus 16, Saturn 4 | ELS 46.84 | [TEXT] |
| Paramayush = sum of the nine signs' years | ELS 46.85 | [TEXT] |
| Birth at start/middle/end of pada → full/medium/short | ELS 46.86 | [TEXT] |
| Pada index method | ELS 46.87–88 | [TEXT] |
| Paramayush Aries 100, Taurus 85, Gemini 83, Cancer 86 (and trines) | ELS 46.89 (`meṣe śataṃ vṛṣe 'kṣāṣṭau mithune trigajāḥ … karkaṭe 'ṅgagajāḥ`) | [TEXT] |
| Balance | ELS 46.90–93 | [TEXT] |
| Deha first, jeeva last in savya; reversed in apasavya | ELS 46.94–95 | [TEXT] |
| Gatis: Manduka, Markati, Simhavalokana | ELS 46.96–100 | [TEXT] |
| Gati results | ELS 46.101–119 | [TEXT] |
| Navamsha-sign results; deha/jeeva afflictions | ELS 46.120–130 | [TEXT] |
| Dasha sign by house from lagna results | ELS 46.131–154 | [TEXT] |
| Effects chapter; Kalachakra antardashas | AE ch. 49; ch. 64 | [TEXT] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-89 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt

ELS's English for 46.89 prints 58/38/68. The bhutasankhya words (akṣa 5, aṣṭa 8; tri 3, gaja 8; aṅga 6, gaja 8) are read right to left, giving 85, 83, 86, which AE and the engine use. The engine tables also sum to these values (pada 1 of the Ashwini group: 7+16+9+21+5+9+16+7+10 = 100; pada 2: 85).

## 2. When it applies

No condition. All charts. [TEXT]

## 3. Inputs required

Moon longitude (nakshatra and pada, and the fraction of the pada crossed). Optionally lagna and planets for reading the dasha sign by house.

## 4. Calculation

**Sign years (46.84)**: Aries 7, Taurus 16, Gemini 9, Cancer 21, Leo 5, Virgo 9, Libra 16, Scorpio 7, Sagittarius 10, Capricorn 4, Aquarius 4, Pisces 10 (each sign takes its lord's years).

**Star groups (engine `const.py` lines 210–213, 0-based → names)**

| Group | Direction | Stars | Paramayush by pada 1–4 |
|---|---|---|---|
| Savya 1 | clockwise | Ashwini, Krittika, Punarvasu, Ashlesha, Hasta, Swati, Mula, U.Ashadha, P.Bhadrapada | 100, 85, 83, 86 |
| Savya 2 | clockwise | Bharani, Pushya, Chitra, P.Ashadha, U.Bhadrapada, Revati | 100, 85, 83, 86 |
| Apasavya 1 | anti-clockwise | Rohini, Magha, Vishakha, Shravana | 86, 83, 85, 100 |
| Apasavya 2 | anti-clockwise | Mrigashira, Ardra, P.Phalguni, U.Phalguni, Anuradha, Jyeshtha, Dhanishta, Shatabhisha | 86, 83, 85, 100 |

**Nine-sign runs (engine, savya group 1)**: pada 1 Aries→Sagittarius in order (deha Aries, jeeva Sagittarius, 46.60); pada 2 Capricorn, Aquarius, Pisces, Scorpio, Libra, Virgo, Cancer, Leo, Gemini; pada 3 Taurus, Aries, Pisces, Aquarius, Capricorn, Sagittarius, Aries, Taurus, Gemini; pada 4 Cancer→Pisces. Full tables for the other groups are in `const.py` (`savya_stars_2_rasis`, `apasavya_stars_1_rasis`, `apasavya_stars_2_rasis`).

**Steps**
1. Find the Moon's nakshatra, pada and fraction crossed p.
2. Pick the group, then the pada's nine-sign run and its paramayush P.
3. Years elapsed at birth = p × P (46.90–93). Walk the run's cumulative years to find the running sign at birth; its balance = cumulative end − p × P.
4. After the ninth sign, continue into the next pada's run (the engine's rule: next pada in the same group; after pada 4, switch savya 1 ↔ savya 2 or apasavya 1 ↔ apasavya 2).
5. **Antardashas**: the engine takes the nine signs that follow the MD sign in the master list and scales their years to the MD length (proportional). BPHS's antardasha rule for Kalachakra is in AE ch. 51/64 and was not read in detail for this file.

**Deha and jeeva (46.94–95)**: in savya runs, the first sign is deha (body) and the last jeeva (life); in apasavya runs it is reversed. Malefics in the deha or jeeva sign threaten health or life; benefics protect (46.123–128).

**Gatis (46.96–100)**: when the run jumps between non-adjacent signs:
- Manduka (frog leap, skipping a sign): Virgo→Cancer, Leo→Gemini.
- Markati (monkey, a step backwards): Cancer→Leo in reverse runs (text: "Cancer and Leo").
- Simhavalokana (lion's glance, to a trine): Pisces→Scorpio, Sagittarius→Aries.

## 5. Interpretation rules

- Each gati carries set dangers: Manduka to relatives/parents (fevers, poison, weapons), Markati to wealth and the father, Simhavalokana to cattle, friends and status (46.101–111). Directions of travel to avoid or favour are given (46.114–119). [TEXT]
- Navamsha sign of the lagna gives temperament (Aries hero/thief … Pisces wealth) (46.120–122). [TEXT]
- Dasha sign as a house from lagna: 1st health, 2nd food and wealth, 3rd siblings and courage, 4th home and land … 12th losses (46.131–154). Results scale with benefic/malefic sign and occupants. [TEXT]

## 6. Variants and disputes

- Paramayush digits (above): settled by bhutasankhya reading.
- Antardasha method: proportional nine-sign (engine) vs other schemes; not settled here.
- Whether to treat gati jumps as dated events or as the character of a period: modern teachers differ [MODERN]; not researched further.
- Engine `antardhasa` carries a "temporary fix" when the nine-sign slice runs past the end of the master list; edge cases at the last pada of an apasavya group need a check.

## 7. Worked micro-example

Moon in Ashwini pada 1 with 25% crossed: savya 1, run Aries…Sagittarius, P = 100. Elapsed 25 years → cumulative Aries 7, Taurus 23, Gemini 32 → running sign Gemini with 32 − 25 = 7 years left. Then Cancer 21, Leo 5 …. The Gemini → Cancer step is adjacent (no gati).

## 8. Design notes for AI Astra

- Engine must output: MD sign, AD sign, start/end, deha and jeeva signs of the running pada run, and a gati flag (type + dates) when the next sign is a jump.
- Weight: research only (admin research page). Not a board driver until tested on the research kundlis.
- Pitfall: the results text is death- and danger-heavy; never pass it raw into user text.

## 9. Open questions

- BPHS antardasha rule for Kalachakra (AE ch. 51/64) to be read and compared with the engine.
- Sign runs for apasavya groups were taken from the engine, not checked verse by verse.
