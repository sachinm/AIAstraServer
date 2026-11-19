# Patyayini Dasha (patyāyinī-daśā)

> Patyayini is the Tajika annual-chart dasha. It ranks the Lagna and the seven planets (no nodes) of the annual chart by
> their degrees within sign (the krishamsha). Each one's share of the year is the gap between its degree and the next
> lower one (the patyamsha), so the planet with the fewest degrees runs first. It answers "when within the year does
> each planet deliver what the annual chart promises?" It is the most used in-year dasha in Tajika practice (PVR's
> textbook and, by reputation, K.N. Rao-school Varshaphal; neither was opened this pass). Its source is the Tajika texts (Neelakanthi tradition). The
> exact verse was not verified in this pass.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Patyayini as the Tajika varsha dasha | Tajika Neelakanthi (Nīlakaṇṭha, 16th c.), Varshatantra. Mahidhara Hindi edition, Bombay c. 1931, archive.org https://archive.org/details/tajika_nilakanthi/page/n0. Verse not located this pass. | [TEXT] (unverified) |
| Krishamsha, patyamsha, proportional periods and antardasha | PVR Narasimha Rao, *Vedic Astrology: An Integrated Approach*, ch. 30 (Tajika annual charts), as encoded in the engine's `tests/pvr_tests.py::patyayini_tests`. Not opened directly. | [MODERN] |
| Implementation | AIAstra_Radha `src/jhora/horoscope/dhasa/annual/patyayini.py` | engine |

## 2. When it applies (which charts, which life areas)

- **Charts.** The Tajika varsha pravesh chart. The engine also runs it on the Tithi Pravesha chart (an
  `annual.tithi_pravesha_dasha` option) and on divisional versions of the annual chart.
- **Life areas.** All; it is an in-year timer.

## 3. Inputs required (exact chart data)

- Sidereal longitudes, degrees within sign, of the Lagna, Sun, Moon, Mars, Mercury, Jupiter, Venus and Saturn at the
  varsha pravesh instant.
- The varsha pravesh instant.
- The year length.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Krishamsha.** For each of the 8 points, take the degrees within its sign (0–30°), ignoring the sign.
2. **Sort** ascending by krishamsha.
3. **Patyamsha.**
   - First point: its own krishamsha.
   - Each later point: its krishamsha minus the previous (lower) one.
4. **Sum** of the patyamshas = the largest krishamsha (the sum telescopes).
5. **Period** of each point = patyamsha ÷ sum × year length. The engine uses the average Gregorian year, 365.2425 days.
6. **Order.** The lowest krishamsha runs first, starting at the varsha pravesh. There is no balance.
7. **Antardasha.** Within each dasha, all 8 lords in the same cyclic order starting from the dasha lord. Each
   antardasha = the dasha period × the lord's share (patyamsha/sum).

## 5. Interpretation rules (tagged)

- **Annual-chart houses.** A Patyayini lord gives the results of the houses it owns and occupies in the annual chart,
  per its annual strength (Tajika pancha-vargiya bala) and its Tajika aspects and yogas, such as Ithasala. [MODERN] PVR;
  Tajika practice.
- **Lagna period.** The Lagna's period is the native's own (body and self) period. [MODERN]
- **Longest periods.** Planets with long periods dominate the year: a big gap means a long reign. [MODERN] inference.

## 6. Variants and disputes (school by school)

- **Inclusion of the Lagna.** Classical Tajika and PVR include the Lagna. Some software includes Rahu and Ketu; the
  engine excludes them.
- **Year length.** 365.2425 (engine) vs 365.2564 (sidereal) vs 360.
- **Engine conformance.** Code review: the engine takes the D1 list (Lagna + 9), drops the last two (the nodes), sorts by
  degree within sign, and differences, normalises and scales. **This matches the method above.** It was run on 2026-11-18 on the PVR chart (1972-06-01, year 21): 8 lords
  including Lagna, no nodes, summing to 365.243 days (`const.average_gregorian_year` = 365.2425). No bug found.
  - Tie-breaking for equal degrees is not specified (stable sort).
  - The 1993 PVR test values are encoded.

## 7. Worked micro-example (optional, short)

Degrees in sign:

| Point | Degree | Patyamsha |
|---|---|---|
| Venus | 2° | 2 |
| Moon | 5° | 3 |
| Lagna | 11° | 6 |
| Sun | 14° | 3 |
| Saturn | 18° | 4 |
| Mars | 22° | 4 |
| Mercury | 25° | 3 |
| Jupiter | 29° | 4 |

The sum is 29. Venus runs 2/29 of a year (≈ 25 days) first, then Moon about 38 days, then Lagna about 76 days, and so on.

## 8. Design notes for AI Astra

- **Engine output.** The engine already exports `annual.patyayini`. The payload should carry:
  - each lord's krishamsha;
  - its share;
  - its annual-chart house(s).
- **Boards.** In-year windows on Work, Love and You. Pair with Mudda: when both put the same planet, or connected
  planets, in charge, confidence rises.
- **Weight.** Medium; equal to or slightly above Mudda in Tajika practice. Subordinate to the natal dasha.
- **Pitfall.** The periods are very sensitive to the birth time through the Lagna degree. Show confidence bands when the
  birth time is uncertain.

## 9. Open questions

- Locate the Neelakanthi or Hayanaratna verse for Patyayini and confirm that the Lagna is included and the nodes
  excluded.
- Whether the patyamsha sum should be the Lagna-inclusive maximum, or 30°. Under the telescoping method above it is the
  maximum.
