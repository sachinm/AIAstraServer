# Varsha Pravesha: casting the annual chart (varṣa-praveśa)

> The annual chart (varṣa-kuṇḍalī) is cast for the moment the Sun returns to its exact natal **sidereal** longitude
> in a given year of life. It answers "what kind of year is this person entering, and which matters are switched on
> this year?". Every other Tajika technique (Muntha, year lord, aspects and yogas, sahams, monthly charts) sits on
> this chart. It is used across all North Indian Tajika practice. The instant can be computed reliably. How much the
> chart predicts depends on reading it with the natal chart (see §5 and `00-overview.md`).

## 1. Sources

| Text | Edition / numbering | Place | What it says |
|---|---|---|---|
| Nīlakaṇṭha, *Tājika-Nīlakaṇṭhī*, Saṃjñātantra | as quoted in Balabhadra's *Hāyanaratna*, M. Gansten tr., Motilal Banarsidass 2020 (wisdomlib) | Saṃj. 1.16 | Short arithmetic: add 1¼ days per elapsed year plus 21/40 ghaṭī per year, then reduce by 7 to get the weekday and time |
| Same, Varṣatantra | same | Varṣ. 1.3–4, 1.5 | Same shortcut. At the revolution the Sun's longitude equals its natal longitude (1.5) |
| Balabhadra, *Hāyanaratna* (1649) | Gansten 2020 | ch. 1 §6 | Year length 365 d 15 gh 31 pal 30 vipal (= 365.25875 d). Solar year only. A lunisolar year is rejected |
| Yādava, *Tājikayogasudhānidhi* | quoted in HR | 1.9–10, 1.26 | Multiplier method (1, 15, 31, 30). The weekday is certain, the other elements are approximate |
| Gaṇeśa, *Tājikabhūṣaṇa*; Haribhaṭṭa, *Tājikasāra* | quoted in HR | TBh 1.8–9 | Propose correcting the time when the computed Sun does not match. Balabhadra rejects this |
| Samarasiṃha, *Tājikaśāstra* / *Karmaprakāśa* (13th c.) | quoted in HR | — | Sun at revolution = natal Sun |

URLs: Hāyanaratna ch. 1 §6 <https://www.wisdomlib.org/hinduism/book/hayanaratna-the-jewel-of-annual-astrology/d/doc1500887.html>;
index <https://wisdomlib.org/hinduism/book/hayanaratna-the-jewel-of-annual-astrology>. Sanskrit editions of the Nīlakaṇṭhī
on archive.org: `tajika_nilakanthi` (Mahīdhara Hindi tr., Bombay c. 1931) and `dhjc-tajika-nilakanthi-satika-sa-udaharana-author-nilak`
(Viśvanātha's commentary, Nirnaya Sagar 1926). These were not read page by page in this pass.

Dating conflict: Wikipedia's *Tajika Neelakanthi* article gives Śaka 1509 (1587 CE) for completion. Its *Tājika* article
gives 1544 CE. Both are recorded here and neither is chosen.

## 2. When it applies

Every year of life from age 1 onward, for every life area. It is the base chart of Tajika annual prediction (varṣaphala).
It is also the parent of the monthly (`masa-pravesha.md`) and daily revolutions (HR ch. 8).

## 3. Inputs required

- Natal sidereal longitude of the Sun (same ayanāṃśa as the natal chart).
- Birth place. The year to be judged.
- The place of residence in that year. Which place the chart is cast for is disputed (§6).

## 4. Calculation

1. [TEXT] Find the instant t in year N of life when the true sidereal Sun's longitude equals the natal Sun's (Varṣ. 1.5; Samarasiṃha).
2. [TEXT] Classical shortcut, for checking only: `t ≈ birth + N × 365.25875 d`. The weekday moves about 1¼ days a year (Saṃj. 1.16).
   The engine must use the true return, not this mean value. Gansten's footnote: the true return can differ from the
   mean by about 25 minutes of clock time.
3. Cast the full chart at t for the chosen place: lagna, houses, all planets, and the vargas as needed (D9 at least,
   because Tajika dignities use the navāṃśa).
4. [TEXT] Record day or night at t (sunrise and sunset at the place). The year lord candidate list (Sun-sign lord by day,
   Moon-sign lord by night), the triplicity lord (day or night table) and the saham formulas all depend on it.
5. [TEXT] Record the weekday and panchanga at t. HR ch. 1 §7 cites the *Trailokyaprakāśa*: Mon, Wed, Thu and Fri
   revolutions are good, and Sun, Tue and Sat bring loss or fear. Some tithis and yogas at the revolution are also judged.

## 5. Interpretation rules

- [TEXT] The varṣa lagna and its lord set the year's general tone. The houses of the year chart are judged like natal
  houses: by lord, occupants, aspects and Tajika yogas (HR ch. 6, quoting the *Abdatantra* 5.1).
- [TEXT] The varṣa lagna read against the natal chart: Praśnavaiṣṇava 13.73–75, quoted in HR ch. 1 §7, counts which natal
  house the year's lagna falls in. Benefics there make that house prosper and malefics harm it.
  [TEXT] The Yantrādhikāra, quoted in HR ch. 1 §7: a year lagna in the 8th or 12th from the natal lagna is not auspicious.
- [MODERN] Many modern authors (B.V. Raman, K.N. Rao and others) treat the varṣa lagna falling in the natal 6/8/12 as
  a hard year. That is a simplification of the rule above.

## 6. Variants and disputes

| Issue | Positions |
|---|---|
| Correcting the instant | Haribhaṭṭa and Gaṇeśa correct it. Balabhadra rejects correction. Modern software uses the true return, which settles this |
| Place of casting | [MODERN] Birth place vs. place of residence at the return. The classical texts quoted assume the native's place. Software defaults vary. This must be a stored choice |
| Solar vs. lunisolar year | HR rejects the lunisolar year for varṣaphala. [MODERN] Tithi Praveśa (the lunisolar return, Sanjay Rath / SJC) is a separate, non-Tajika technique. AI Astra already runs it as primary (`general.annual.md`) |
| Ayanāṃśa | The texts use the sidereal zodiac. Lahiri vs. others is a [MODERN] choice that must match the natal chart |

## 7. Worked micro-example

Natal Sun at 3°12′ Leo (sidereal). For age 34, find the 2026 instant the Sun reaches 3°12′ Leo, about mid-August.
Cast the chart for that instant and place. If it falls after local sunset, it is a night revolution, so take the
Moon-sign lord as the fourth year-lord candidate and use the night triplicity lord.

## 8. Design notes for AI Astra

- Engine (served): `annual.varsha` uses `drik.next_solar_date`, the true return (engine `annual_export.py` lines 8–10,
  169–174). Good.
- **Engine check:** `tajaka.lord_of_the_year` builds its own instant as `jd_at_dob + years × year_value`, a mean year
  (`tajaka.py` line 519). That is not the true-return instant the chart uses. Near a lagna or day/night boundary, the
  year lord and day/night flag can come from a different instant than the published chart. Engine addition: compute
  the year lord from the same `next_solar_date` instant and return `is_day_revolution` with the chart.
- Per person-year, the engine should output: return instant (UTC and local), place used, day/night flag, weekday and
  panchanga at the instant, the D1 and D9 charts, varṣa lagna relative to natal lagna (house number), and calc_version.
- Weight: the varṣa chart confirms and times. It does not create promises (see `00-overview.md` §4). On consumer
  surfaces it is "your personal year from <date> to <date>". No Tajika words.

## 9. Open questions

- Which place should be used for the return: birth or residence? This needs a product decision. The engine should accept either.
- The weekday and tithi-at-return rules (Trailokyaprakāśa 193–197) are minor. Do they deserve a slot?
- Nīlakaṇṭha's own Varṣatantra 1.x verses were read only as Balabhadra quotes them. They were not checked against the 1926 Nirnaya Sagar edition.
