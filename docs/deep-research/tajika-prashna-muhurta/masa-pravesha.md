# Monthly revolution charts (māsa-praveśa)

> Inside the annual chart, Tajika casts a chart for each solar month of the personal year: the moment the Sun
> reaches the natal Sun's longitude plus 30°, 60° and so on. Each month chart has its own lagna, month lord and
> yogas, which narrow the year's promise to a month. Daily revolutions (dina-praveśa, about +1° of the Sun) take
> it further. The texts treat monthly charts as necessary ("the annual result is incomplete without the monthly",
> Yādava 15.1). In modern practice they are used less, as monthly timing usually comes from Mudda or Patyayini dashas.

## 1. Sources

| Text | Numbering | Content |
|---|---|---|
| Yādava, *Tājikayogasudhānidhi* 15.1, 15.5 | as quoted in *Hāyanaratna* (Gansten 2020) ch. 8 §1, §4 | Need for months. Five-candidate month lord |
| Nīlakaṇṭha, Varṣatantra 18.3–6 | HR ch. 8 §4 | Six candidates for the month lord |
| *Tājikabhūṣaṇa* 15.4a–8a | HR ch. 8 §4 | Navāṃśa-lord method |
| *Tājikālaṃkāra*; Balabhadra's own verses | HR ch. 8 §1–3 | Mean-Sun arithmetic for month entry |
| HR ch. 8 §8–11 | | Daily revolutions, day lord, day periods, avasthās |

URLs: `.../doc1500993.html`, `.../doc1500996.html` (fetched). `.../doc1501000.html`–`.../doc1501003.html` (daily, not fetched).

## 2. When it applies

Each of the 12 solar months of a personal year, when month-level timing of an annual promise is needed.

## 3. Inputs required

Natal Sun longitude, the year's return instant, the place, and the same inputs as the annual chart, per month.

## 4. Calculation

1. [TEXT/COMM] Month k (k = 0..11) begins when the true sidereal Sun reaches natal Sun + 30°·k (it enters each "month"
   of the year from the return point). HR's surviving verses give only mean-Sun arithmetic. They do not state the +30°
   rule in so many words. The rule is standard in all software and modern texts [MODERN]. The fetched page does not
   state a casting method beyond establishing longitudes at the monthly revolution (Varṣatantra 18.3).
2. Cast the month chart at that instant.
3. Month lord [TEXT] (Varṣatantra 18.3–6): candidates are (1) the month-lagna lord, (2) the Muntha lord (Muntha moves
   2½° a month, per `muntha.md`), (3) the natal-lagna lord, (4) the triplicity lord, (5) the Sun-sign (day) or
   Moon-sign (night) lord, (6) the varṣa-lagna lord. The strongest that aspects the month lagna is the month lord.
   "Others" take the month-lagna lord alone. Yādava 15.5 uses five candidates built from the month chart. TBh uses the
   stronger of the navāṃśa lords of the lagna and of the lagna lord.
4. Read the month chart like the year chart: yogas between the month-lagna lord and the matter's lord, sahams, and so on.

## 5. Interpretation rules

- [TEXT] A strong month lord in good aspect gives a good month for the matters it rules. Results by navāṃśa
  placements (HR ch. 8 §4–6, Vāmana, Trailokyaprakāśa) were not fetched.
- [TEXT] The annual promise decides. The monthly chart picks which month delivers it (Yādava 15.1).

## 6. Variants and disputes

- Five vs. six month-lord candidates. The month-lagna lord alone (others).
- The engine uses a mean-month step (below), unlike the true-Sun step.

## 7. Worked micro-example

Natal Sun 3°12′ Leo. Month 4 of the year begins when the Sun reaches 3°12′ Scorpio (about mid-November). If the
month lagna is Taurus and Venus aspects it strongly, Venus is the month lord, and November–December are good for
Venus matters, if the year chart promised them.

## 8. Design notes for AI Astra

- Engine (exists): `tajaka.maasa_pravesh` / `monthly_chart` and `lord_of_the_month`. `annual.tajaka` exports
  `month_lords[{month, lord}]`. **Check:** `lord_of_the_month` takes its instant as `jd_at_dob + (years + months/12) ×
  year_value`. That is a mean twelfth of a year, not the Sun's +30° ingress. The two can differ by about a day, more
  around perihelion. Engine addition: monthly instants from the true Sun (+30° steps); per month `{start, end, lagna,
  month_lord, candidates[], muntha_long}`. Also the month lord selection inherits the year-lord issues (see
  `varshesha-panchadhikari.md`).
- Serves: month cards on the Self, Love and Work boards ("which month this year") and the annual reader. Weight: below
  Mudda or Patyayini timing (other researcher) and transits. Use only as agreement.

## 9. Open questions

- Is the monthly chart worth serving, given that the Mudda and Patyayini dashas already give month timing? Recommend: export the month lords and lagnas only, not full yogas, until there is a use.
- Daily revolutions (HR ch. 8 §8–11) were not researched in depth. The product does not need them now.
