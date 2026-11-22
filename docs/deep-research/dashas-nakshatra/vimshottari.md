# Vimshottari dasha (viṃśottarī daśā)

> The 120-year nakshatra dasha. The Moon's birth nakshatra picks the first lord; nine planets follow in a fixed order for fixed years; each period divides into sub-periods to six levels in modern software. BPHS calls it the chief dasha for people of this age (46.3, 46.14). It is the default timing clock of almost every school and the best-tested system in practice; its results chapters (BPHS 47–48, 52–63) are the fullest in the classical literature.

## 1. Sources

| Rule | Text | Edition, chapter:verse | Tag |
|---|---|---|---|
| Vimshottari is the chief dasha | BPHS | ELS 46.3, 46.14; AE 46.2–5 | [TEXT] |
| Count from Krittika; remainder ÷ 9 gives lord | BPHS | ELS/AE 46.12–13 | [TEXT] |
| Lord order and years | BPHS | ELS/AE 46.15 | [TEXT] |
| Balance at birth | BPHS | ELS/AE 46.16 (AE also 46.21–22) | [TEXT] |
| Antardasha formula | BPHS | AE 51.1 | [TEXT] |
| Results: MD | BPHS | AE ch. 47, 48 | [TEXT] |
| Results: AD per MD lord | BPHS | AE ch. 52–60 | [TEXT] |
| Results: pratyantar, sookshma, prana | BPHS | AE ch. 61, 62, 63 | [TEXT] |
| Utpanna/Kshema/Adhana dashas | Sanjay Rath | srath.com/?p=872 | [MODERN] |
| Lagna or Sun when Moon is weak | PVR Narasimha Rao | pp_cond_dasas.pdf (2014) | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://srath.com/?p=872 · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

Other texts with Vimshottari chapters (Jataka Parijata ch. 18, Phaladeepika's dasha chapters, Uttara Kalamrita, Laghu Parashari's dasha verses) were not read for this file. Laghu Parashari is the key source for which lord gives results in a period; see `../dasha-results/functional-nature-laghu-parashari.md`.

## 2. When it applies

All charts, all life areas [TEXT 46.14]. Every conditional dasha is weighed against it (see `01-applicability-matrix.md`).

## 3. Inputs required

- Sidereal longitude of the Moon at birth (ayanamsa stated). Variants need the lagna degree, other planets' longitudes, or the Sun's.
- Birth moment as a Julian day, for adding periods.
- The year length convention (§6).

## 4. Calculation

**Lord table (46.15)** [TEXT]

| # | Lord | Years | Nakshatras (1-based) |
|---|---|---|---|
| 1 | Ketu | 7 | Ashwini 1, Magha 10, Mula 19 |
| 2 | Venus | 20 | Bharani 2, Purva Phalguni 11, Purva Ashadha 20 |
| 3 | Sun | 6 | Krittika 3, Uttara Phalguni 12, Uttara Ashadha 21 |
| 4 | Moon | 10 | Rohini 4, Hasta 13, Shravana 22 |
| 5 | Mars | 7 | Mrigashira 5, Chitra 14, Dhanishta 23 |
| 6 | Rahu | 18 | Ardra 6, Swati 15, Shatabhisha 24 |
| 7 | Jupiter | 16 | Punarvasu 7, Vishakha 16, Purva Bhadrapada 25 |
| 8 | Saturn | 19 | Pushya 8, Anuradha 17, Uttara Bhadrapada 26 |
| 9 | Mercury | 17 | Ashlesha 9, Jyeshtha 18, Revati 27 |

Total 120. The text starts the cycle at Krittika with the Sun (46.12–13); the table above is the same cycle read from Ashwini.

**Steps**
1. Moon longitude λ (sidereal). Nakshatra index n = floor(λ / 13°20′) (0-based); lord = cycle[n mod 9] from Ashwini = Ketu.
2. Traversed fraction f = (λ − n × 13°20′) / 13°20′.
3. Balance of first MD = years(lord) × (1 − f). The MD start is birth − years × f (engine: `vimsottari_dasha_start_date`).
4. Following MDs run in cycle order for their full years.

**Sub-periods (AE 51.1)** [TEXT]
- AD of lord B in MD of A = years(A) × years(B) / 120. ADs start with A itself and run in the cycle order.
- Pratyantar (PD) of C in AD B of MD A = years(A) × years(B) × years(C) / 120², starting with B.
- Sookshma, prana: the same proportion one level deeper each time (results chapters AE 61–63 show these levels are classical).
- **Deha (level 6)**: no BPHS chapter; a software convention (JHora, PyJHora) using the same proportion [MODERN].

| Level | Sanskrit | Typical length (Sun MD, Sun AD …) | Source |
|---|---|---|---|
| 1 | Mahadasha | 6–20 years | BPHS 46 |
| 2 | Antardasha / bhukti | 3.6 months – 3.3 years | BPHS 51 |
| 3 | Pratyantardasha | days to months | BPHS 61 |
| 4 | Sookshma | hours to weeks | BPHS 62 |
| 5 | Prana | hours to days | BPHS 63 |
| 6 | Deha | minutes to hours | software only |

**Engine options** (`vimsottari.py`): `antardhasa_option` 1 = AD from MD lord forward (BPHS); 2 = backward; 3/4 = from next lord; 5/6 = from previous lord. `use_tribhagi_variation` divides the 120 years into three 40-year runs (a Tribhagi variant [MODERN/COMM, source not traced here]). A rasi-bhukti option divides the MD into 12 sign-bhuktis.

## 5. Interpretation rules

- The MD lord's nature, dignity and house ownership decide the period's tone: favourable in lagna, exaltation, own or friendly sign; adverse in 6/8/12, debility, enemy sign (AE 47.5–6). [TEXT]
- Dreshkana of the lord times the fruition inside the MD: 1st dreshkana early, 2nd middle, 3rd late; reversed for retrograde planets and always for Rahu/Ketu (AE 47.2–4). [TEXT]
- Bhava-lord dashas: the dasha of the lord of a house gives that house's matters (AE ch. 48); dusthana lords become good with a trikona lord (48.14–17); Rahu/Ketu good in 3/6/11 (48.18–20). [TEXT]
- AD results depend on the AD lord's relation to the MD lord and on placements from the MD lord (AE 52–60). Details: `../dasha-results/antardasha-results-per-pair.md`. [TEXT]
- Functional benefic/malefic and yogakaraka rules from Laghu Parashari override natural nature. [TEXT, Laghu Parashari]
- Utpanna (5th star), Kshema (4th), Adhana (8th) dashas: end dates compared with the Janma dasha's end dates; coincidence marks danger; used for longevity. [MODERN, Rath]

## 6. Variants and disputes

**Starting point**
- Janma (Moon's star): BPHS default [TEXT].
- Kshema (4th), Utpanna (5th), Adhana (8th) from Janma: SJC [MODERN]. Rath cites no classical verse for them on his page. Engine: `star_position_from_moon` = 4, 5, 8.
- Lagna nakshatra when lagna is stronger than the Moon; Sun in rare cases: PVR [MODERN], tests listed (waning Moon near Sun, nodes, empty kendras from Moon, 8th house, deep debility, gandanta). SJC teaches the strongest of Lagna, Moon and the Utpanna star [MODERN, secondary source]. No classical verse was found. Engine: `dhasa_starting_planet`.
- Seed star other than Krittika: the engine's `seed_star` parameter exists for research; no text supports changing it for Vimshottari.

**Year length** (not settled by the text)
- 365.2564-day sidereal solar year: engine default (`const.sidereal_year = 365.256364`, "From JHora").
- 365.2422 tropical year: available in engine.
- 360-day savana year: used by some traditional almanac makers; engine constant `savana_year = 360` exists. I found no BPHS verse requiring it for Vimshottari.
- "True solar" year (dasha year = the Sun's return to the same sidereal longitude): a JHora option [MODERN]; equivalent to the sidereal year on average but varies by up to a day or two.
- Effect: over a 120-year cycle, 360 days vs 365.256 days moves dates by about 1.7 years. For a 40-year-old, about 7 months.

**Sub-period ordering**: BPHS starts each AD sequence with the MD lord [TEXT]. Other options are engine research switches.

## 7. Worked micro-example

Moon at 15°00′ Taurus = 45°00′. Nakshatras: Krittika ends 40°00′, Rohini runs 40°00′–53°20′. Lord Moon (10 years). Traversed f = 5°00′ / 13°20′ = 0.375. Balance = 10 × 0.625 = 6.25 years of Moon MD. Next: Mars 7, Rahu 18, Jupiter 16 …. ADs of the Moon MD (years = 10 × lord / 120): Moon 0.833, Mars 0.583, Rahu 1.5, Jupiter 1.333 … Cumulative ends: 0.833, 1.417, 2.917, 4.25. At birth 3.75 years of the MD have passed, so the native is born in Moon–Jupiter AD, with 0.5 years of it left.

## 8. Design notes for AI Astra

- **Engine must output**: MD/AD/PD (3 levels minimum for boards; 5 levels on demand for a single date), start/end as UTC instants, the year convention, the ayanamsa, the starting point used (Janma/Lagna/Utpanna), and the Moon's traversed fraction (so the UI can warn when the Moon is within 0.5° of a nakshatra edge).
- **Boards**: Self = MD + AD lords' themes; Love = AD/PD lords' link to 7th/5th/Venus; Work = link to 10th/6th/11th/Saturn/Sun; Lucky = not a dasha board below PD.
- **Weight**: lead timing system. Every other dasha in this folder is agreement evidence against it.
- **Pitfalls**: AD boundaries are sensitive to birth time; do not show sookshma or prana dates without rectified time. Never mix year conventions between MD and AD in one export.
- **Engine additions**: variant start (lagna/Utpanna) only as a research toggle on the admin research page; export of the Moon-edge warning; level 3 export (today 2 levels).

## 9. Open questions

- Which classical text (if any) gives Utpanna/Kshema/Adhana? Kalaprakashika or Jataka Parijata are candidates; not verified.
- Should the product ever switch the lead dasha to lagna-start? Recommendation: no, keep Janma-start fixed; record PVR's weak-Moon test as an engine flag for research.
- Deha (6th level) has no classical results; do not surface it.
