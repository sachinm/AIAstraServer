# Nakshatra (udu) and graha-period dasha systems

Research notes for `docs/deep-research/dashas-nakshatra/`. Written 2026-11-18.

Abbreviations used here and in the deliverable files:
- **ELS** = Sanskrit text of BPHS on enjoylearningsanskrit.com (Devanagari + IAST + word glosses, verse-by-verse; the site does not name the printed edition). Chapter 46 runs to verse 210 on that site. https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46
- **AE** = English e-text of BPHS on archive.org ("BrihatParasharaHoraSastraVedicAstrologyEbook", OCR, "Dashas" garbled to "Pashas"). Translator not named on the page. Its chapter scheme (46 Dashas of grahas, 47 Effects, 48 bhava-lord dashas, 49 Kalachakra, 50 Chara etc., 51 antardasha working, 52–60 antardashas by MD lord, 61 pratyantar, 62 sookshma, 63 prana, 64 Kalachakra antardashas, 65 rasi dashas in amshas) is the scheme usually cited as the R. Santhanam (Ranjan) numbering, but I could not confirm the translator. https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Engine** = AIAstra_Radha `src/jhora/horoscope/dhasa/graha/*.py` and `raasi/kalachakra.py`, `src/jhora/const.py` (read locally, not run: `swisseph` is not installed in the local Python).

## Key question 1: eligibility, start, order, years, sub-period rule for each system

### Takeaway
BPHS ch. 46 gives every conditional nakshatra dasha a one-line condition, a seed nakshatra, a lord order and a year table; the Sanskrit verses (ELS) and the engine agree on years and orders for all ten systems. The conditions are where translations differ (Panchottari, Dwadashottari, Ashtottari's second rule).

### Cited findings
- Ch. 46 lists the dashas: Vimshottari as chief, then Ashtottari, Shodashottari, Dwadashottari, Panchottari, Shatasama (Shatabdika), Chaturashiti, Dwisaptati, Shashti, Shattrimsha; Kalachakra called the most authoritative of the kala/chakra group; Yogini, Tara and others listed later (ELS 46.3–11; AE 46.2–11). — [ELS ch 46](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Vimshottari: count from Krittika, remainder by 9 gives the lord; order Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury, Ketu, Venus; years 6, 10, 7, 18, 16, 19, 17, 7, 20 = 120; balance = years × untraversed part of the Moon's nakshatra (46.12–16). ELS's English rendering of v.15 shows "19" for Mercury, a translation slip (the total of 120 requires 17). — [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Ashtottari 46.17: `lagneśāt kendrakoṇasthe rāhau lagnaṃ vinā sthite … raudrabhāditaḥ`: Rahu in a kendra or trikona from the lagna lord, not in lagna; count from Ardra. — [ELS 46.17](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-17). (A summariser's reading of AE put this in the negative; the Sanskrit is positive. Treat the negative as a summarising error.)
- Ashtottari 46.23: `kṛṣṇapakṣe divā janma śuklapakṣe tathā niśi | tadā hyaṣṭottarī cintyā`: day birth in the dark fortnight or night birth in the bright fortnight is a second Ashtottari condition. — [ELS 46.23](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-23). The AE summary attached this rule to Shodashottari; the Sanskrit names Ashtottari.
- Ashtottari lords and years: Sun 6, Moon 15, Mars 8, Mercury 17, Saturn 10, Jupiter 19, Rahu 12, Venus 21 = 108; Ketu excluded; nakshatras allotted 4, 3, 4, 3 … from Ardra (46.18–20); special handling of Abhijit (46.22, per AE). — [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Shodashottari 46.24: `candrahorāgate kṛṣṇe sūryahorāgate sitī lagne … ṣoḍaśottarī`: lagna in Moon's hora in the dark fortnight or in Sun's hora in the bright fortnight; count from Pushya, divide by 8; lords Sun, Mars, Jupiter, Saturn, Ketu, Moon, Mercury, Venus with 11 … 18 years = 116 (46.24–26). — [ELS 46.24](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-24); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Dwadashottari 46.27: `śukrāṃśake prajātasya vicintyā dvādaśottarī | janmabhāt pauṣṇabhaṃ yāvat saṃkhyā hi vasutaṣṭitā`: born in a Venus amsha; count from the birth star to Revati (backwards relative to the zodiac), divide by 8. AE: lagna in a navamsha of Venus. Lords Sun, Jupiter, Ketu, Mercury, Rahu, Mars, Saturn, Moon; years 7, 9, … 21 = 112 (46.27–28). — [ELS 46.27](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-27); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Panchottari 46.29: `arkāṃśa karkalagne pañcottarī matā | mitrarkṣāj janmabhaṃ yāvat saṃkhyā saptavibhājitā`. ELS renders "Cancer lagna and Sun's navamsha". AE renders "Lagna is Cancer and also in Cancer dwadashamsha". Count from Anuradha (`mitra` = Mitra's star = Anuradha; ELS's "friendly asterism" is a mistranslation), divide by 7. Lords Sun, Mercury, Saturn, Mars, Venus, Moon, Jupiter; 12 … 18 years = 105. — [ELS 46.29](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-29); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- PVR Narasimha Rao reads Panchottari as lagna in Cancer in the dwadashamsha only, and footnotes that "Cancer in both rasi and dwadasamsa" is an incorrect translation. — [PVR, Unified Nakshatra Dasa Approach, 2014](https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf)
- Shatabdika: vargottama lagna; count from Revati, divide by 7; lords Sun, Moon, Venus, Mercury, Jupiter, Mars, Saturn; years 5, 5, 10, 10, 20, 20, 30 = 100 (46.32–34). ELS's English shows "33" for the last term; AE and the 100-year total give 30. — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt); [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46)
- Chaturashiti-sama: 10th lord in the 10th; count from Swati, divide by 7; Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, 12 years each = 84 (46.35–36). — same sources
- Dwisaptati-sama 46.38: `lagneśe saptame yasya lagne vā saptamādhipe`: lagna lord in the 7th or 7th lord in lagna; count from Mula, divide by 8; eight lords (Ketu excluded), 9 years each = 72 (46.37–39). — [ELS 46.38](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-38). (A summariser's AE reading said "lagna lord in lagna or 7th"; the Sanskrit settles it.)
- Shashtihayani: Sun in lagna; count from Ashwini with groups 3/4; Jupiter, Sun, Mars 10 years each; Moon, Mercury, Venus, Saturn, Rahu 6 each = 60 (46.40–41). — same sources
- Shattrimsha-sama: count from Shravana, divide by 8; Moon, Sun, Jupiter, Mars, Mercury, Saturn, Venus, Rahu with 1 … 8 years = 36; for day birth with lagna in Sun's hora or night birth with lagna in Moon's hora (46.42–43). — same sources
- Yogini 46.199: `janmarkṣaṃ ca tribhir yuktaṃ vasubhir bhāgam āharet | ekādiśeṣe … maṅgalādikāḥ`: birth star (Ashwini = 1) + 3, divide by 8, remainder from 1 = Mangala. Yoginis Mangala, Pingala, Dhanya, Bhramari, Bhadrika, Ulka, Siddha, Sankata; lords Moon, Sun, Jupiter, Mars, Mercury, Saturn, Venus, Rahu; years 1 … 8 (46.196–200). — [ELS 46.199](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-199); [ELS ch 46](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46)
- Tara dasha (46.207–209): modelled on Vimshottari with taras (Janma, Sampat …) in place of planets, given to planets in kendras, starting from the strongest. — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt); [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46)
- Kalachakra (46.52–154 in ELS): savya and apasavya wheels; deha and jeeva signs per pada; sign years Sun 5, Moon 21, Mars 7, Mercury 9, Jupiter 10, Venus 16, Saturn 4 (46.84); paramayush 46.89 `meṣe śataṃ vṛṣe 'kṣāṣṭau mithune trigajāḥ … karkaṭe 'ṅgagajāḥ`. — [ELS 46.89](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-89)
- The bhutasankhya words in 46.89 (akṣa = 5, aṣṭa = 8; tri = 3, gaja = 8; aṅga = 6, gaja = 8) read right to left (`aṅkānāṃ vāmato gatiḥ`) give 85, 83, 86. ELS's English shows 58/38/68 (digits not reversed). AE gives 100/85/83/86, and the engine table sums agree: Ashwini pada 1 signs Aries…Sagittarius = 7+16+9+21+5+9+16+7+10 = 100; pada 2 signs Cp, Aq, Pi, Sc, Li, Vi, Cn, Le, Ge = 4+4+10+7+16+9+21+5+9 = 85. — [ELS 46.89](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-89); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt); engine `const.py` lines 205–228
- Gatis (46.96–100): Manduka (frog: leap over a sign), Markati (monkey: step backwards), Simhavalokana (lion's glance: jump to a trine); results 46.101–119. — [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46); [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Antardasha rule (AE ch. 51 v.1): sub-period = MD years × AD lord years ÷ total years of the system; pratyantar the same with AD in place of MD; chara-type antardashas = MD ÷ 9 (or 12 for rasi dashas, 51.3–5). — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- ELS 46.210 closes ch. 46 and announces antardashas later. — [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46)

### Inferences
- `arkāṃśa` in 46.29 can mean "Sun's amsha" (arka = Sun) or "the 12th amsha" (arka = 12 as a bhutasankhya number, the twelve Adityas). The second reading supports the dwadashamsha translations (AE, PVR). PVR's reading drops the rasi-Cancer requirement; AE's keeps it. This is a real textual dispute, not a typo.
- `śukrāṃśake prajātasya` (46.27) says only "born in Venus's amsha"; every practical source (AE, PVR, engine) reads it as lagna in a Taurus/Libra navamsha.

### Gaps
- Girish Chand Sharma's BPHS (Sagar) was not consulted; I cannot state where its chapter or verse numbers differ. Do not fill this gap from memory.
- I could not confirm that AE is Santhanam's translation. Its chapter scheme matches the one commonly cited as Santhanam's.
- The Santhanam PDFs at archive.org/download/BPHSEnglish were not opened (budget).

## Key question 2: which BPHS dasha-results chapters apply to each system

### Takeaway
Results chapters are written in Vimshottari terms (bhava lords, nine planets), and BPHS never says they are Vimshottari-only. The Kalachakra and rasi-dasha results are in separate chapters.

### Cited findings
- AE chapter scheme: 47 effects of dashas (by planet, by dignity and dreshkana timing), 48 distinctive effects (bhava-lord dashas; heading names Vimshottari), 49 Kalachakra effects, 50 chara-type effects, 51 antardasha working, 52–60 antardasha effects inside each Vimshottari MD, 61 pratyantar, 62 sookshma, 63 prana, 64 antardashas in Kalachakra, 65 rasi dashas in amshas. — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Ch. 47 is not restricted to any system: favourable if the lord is in lagna, exaltation or own sign; unfavourable in 6/8/12, debilitation or an enemy sign (47.5–6); the dreshkana decides early, middle or late fruition, reversed for retrograde planets and nodes. — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt)
- Kalachakra results by house (ELS 46.131–154) and by gati (46.101–119) sit inside ch. 46 in the Sanskrit numbering. — [ELS](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46)

### Inferences
- Ch. 47 and 48 (planet nature, dignity, bhava lordship) carry over to any graha dasha (all conditional nakshatra dashas, Yogini, Tara). Chapters 52–60 are written per Vimshottari MD lord and carry over only where the same planet pair occurs. Ketu-less systems (Ashtottari, Dwisaptati, Yogini) and Rahu-less systems simply skip those pairs. This is my inference, consistent with PVR's practice of reading conditional dashas "like Vimshottari" (BPHS 46.22 says the same for Ashtottari: judge as in Vimshottari).

### Gaps
- No verse states which results chapter applies to Yogini. Mansagari's Yogini results were not consulted (no online text found).

## Key question 3: where editions differ

### Takeaway
The differences found are in the English renderings of 46.17, 46.23, 46.27, 46.29, 46.34 and 46.89; the Sanskrit resolves all but 46.27 and 46.29.

### Cited findings
- See the conditions above: Panchottari (three readings), Shatabdika last term (33 vs 30), Kalachakra paramayush (58/38/68 vs 85/83/86), Vimshottari Mercury (19 vs 17), Ashtottari's 46.23 rule attributed to Shodashottari in the AE summary.
- PVR flags the Panchottari translation error. — [PVR 2014](https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf)

### Gaps
- GC Sharma vs Santhanam comparison not done (see above).

## Vimshottari variants, levels and year length

### Cited findings
- Utpanna (5th star from Janma), Kshema (4th) and Adhana (8th) Vimshottari: [MODERN] SJC (Sanjay Rath). Always from the Moon's longitude; used for longevity: end dates compared with the Janma dasha. Rath's article cites Jataka Parijata ch. 18 for related longevity rules but gives no classical verse for these three dashas. — [srath.com p=872](https://srath.com/?p=872)
- A blog citing Rath lists starts from Janma, Sampat, Kshema, Vipat, Adhana, Lagna, Gulika and others. — [sanjayprabhakaran.blogspot.com](https://sanjayprabhakaran.blogspot.com/2024/07/india-utpanna-dasa.html)
- PVR: use the Moon's nakshatra; if the Moon is weak (waning near the Sun, node-afflicted, empty kendras from Moon, 8th house, deep debility, gandanta) and lagna is stronger, use lagna; in rare cases the Sun. — [PVR 2014](https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf)
- Engine: `year_duration = const.sidereal_year` (365.256364 days) for Vimshottari, Ashtottari, Yogini, Tara, Shodashottari, Shashtihayani, Kalachakra; `savana_year = 360` and `tropical_year = 365.24219` exist in const but are not the default; comment in vimsottari.py: some say 360, others 365.25 or 365.2563. — engine `vimsottari.py:28`, `const.py:166–170`
- Engine Vimshottari options: `star_position_from_moon` (1 = Janma; 4 = Kshema, 5 = Utpanna, 8 = Adhana), `seed_star` (default 3 = Krittika), `dhasa_starting_planet` (Moon default; lagna, other planets, special lagnas), `antardhasa_option` 1–6, `use_tribhagi_variation`, rasi-bhukti variant. — engine `vimsottari.py:51–231`
- BPHS levels: antardasha (ch. 51; results 52–60), pratyantar (61), sookshma (62), prana (63). — [AE](https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt). A 6th "deha" level does not appear in the chapter list; it is a software convention (JHora/PyJHora).

### Gaps
- No classical verse found for a 360-day year in Vimshottari. No classical verse found for "start from lagna if stronger" (PVR calls it his deduction; search found no verse).
- Jataka Parijata ch. 18, Phaladeepika (dasha chapters) and Uttara Kalamrita were not read in full; their Vimshottari/Ashtottari rules are not cited.
- Mansagari's Yogini verse was not found online.

## When several conditional dashas apply

### Cited findings
- PVR: Parashara gives no priority rule; the conditions are necessary, not sufficient; the share of charts each applies to runs from 8.33% to 50%. His method [MODERN]: each conditional dasha has a "controlling planet" (Shodashottari Jupiter, Dwadashottari Ketu, Ashtottari Mars, Panchottari Venus, Shatabdika Sun, Chaturashiti Saturn, Dwisaptati Rahu, Shashtihayani Moon, Shattrimsha Mercury). Pick the applicable dasha whose controlling planet is strongest (exalted > moolatrikona > own > great friend > friend; neutral or worse disqualifies); if none is strong, use Vimshottari. He reads paksha as "Sun in the visible half from Moon" and day/night as "Sun in the visible half from lagna", and he applies the same conditions in vargas and in Tithi Pravesha charts, using his Pushya-paksha ayanamsa. — [PVR 2014](https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf)

## Engine findings (for the parent to file in docs/TODOS.md; this session cannot edit it)

1. **Yogini star mapping: to verify on a live run.** `yogini.py` builds the star → yogini table by counting forward from Punarvasu (seed 7 = Pingala) through 27 stars in one 8-cycle. BPHS 46.199 rule (n + 3) mod 8 numbers from Ashwini. A reimplementation of `_get_dhasa_dict(7)` (not a live run) disagrees for Ashwini–Ardra (1–6): engine Siddha, Sankata, Mangala, Pingala, Dhanya, Bhramari vs text Bhramari, Bhadrika, Ulka, Siddha, Sankata, Mangala. Stars 7–27 agree.
2. **Panchottari check** tests only D12 lagna = Cancer (PVR reading). The AE/Santhanam reading also needs rasi lagna Cancer. Expose both as options.
3. **Ashtottari check** implements only 46.17 (Rahu); the second condition 46.23 (day/krishna, night/shukla) is not implemented.
4. **Shodashottari and Shattrimsha-sama** have no `applicability_check`; `applicability.py` lists a TODO. The modules carry PVR's "visible half" definitions in docstrings only.
5. **Ashtottari antardasha start:** `const.ashtottari_bhukthi_starts_from_dhasa_lord = True` with comment "PVR Book says this should be False. But JHora has this True." This is an open dispute.
6. **Kalachakra antardasha** has a "temporary fix" when the 9-sign slice is empty (`kalachakra.py` antardhasa); gatis are not flagged in output.
7. Engine export depth: memory note says the engine's dasha export goes 2 levels deep (MD + AD) for the live product.
