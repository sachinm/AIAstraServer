# Tithi Pravesha Chart and its Period Lord (tithi-praveśa-cakra; varṣeśa)

> The Tithi Pravesha chart is the "lunar birthday" annual chart. It is cast for the moment in each year when the
> Sun–Moon elongation returns to the birth tithi, in the same solar month (the Sun in the natal Sun's sign) or the same
> lunar month, depending on the school. Its lord of the year is, in Sanjay Rath's teaching, the lord of the weekday (vāra)
> at that moment; the hora lord is used alongside. Its in-year dasha is Tithi Ashtottari (SJC), or Mudda or Patyayini
> run on this chart. It answers "what kind of year is this, and who rules it?" from the Moon-and-Sun (tithi) side, as
> an alternative or complement to the Tajika solar return. It is an SJC/Rath revival; no classical verse was located.
> Label [MODERN].

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Year lord = lord of the weekday at the start of the tithi year; it has the most predominating influence; a benefic one makes the year good | Rath and PVR teaching, reported in secondary write-ups: https://www.sanskritimagazine.com/principles-of-tithi-pravesh-chakra-in-vedic-astrology/ ; https://dekhopanchang.com/en/learn/tithi-pravesha. Primary text (Rath/PVR, vedicastrologer.org/articles/pp_tp.pdf) was fetched but could not be text-extracted. | [MODERN] |
| Hora lord at the TP moment: very important, by some "more than the Lagna lord" | Same secondary sources | [MODERN] |
| Lagna of the TP chart channels the natal promise; the strength of the Lagna lord shows success | Same | [MODERN] |
| Conflicting claim: the tithi lord is the year lord | dekhopanchang explainer | [MODERN], minority |
| Worked example: TP on 26 Nov 1976, a Friday. Venus is the year lord, and a functional malefic for natal Cancer Lagna, so an unfavourable year. | Rath-school reading, as reported in the secondary sources | [MODERN] |
| Engine: TP instant search ±30 days around the birthday, matching the birth tithi and lunar month; TP chart; `annual.tithi_pravesha_dasha` with `tithi_ashtottari` (default), `mudda` or `patyayini` | AIAstra_Radha `src/jhora/panchanga/vratha.py::tithi_pravesha`; `src/jhora/annual_export.py` | engine |
| Repo background | `docs/reading-engine/28-tithi-pravesh-transit-prashna.md` | repo |

## 2. When it applies (which charts, which life areas)

- **Chart.** The TP chart for each year of life. It runs from one TP to the next, and is not synchronised with the solar
  return.
- **Life areas.** All. SJC uses it especially for health and family events because of its Moon basis, but that is not
  documented at source.

## 3. Inputs required (exact chart data)

- The natal tithi: the exact Moon − Sun elongation.
- The natal Sun's sign.
- The natal lunar month (amanta or purnimanta convention).
- The place for the TP chart. Common practice is the residence place; this is open, see §9.
- **Year lord.** The weekday at the TP instant, reckoned from sunrise, not midnight. Vedic weekdays run sunrise to
  sunrise. [MODERN]
- **Hora lord.** The hora at the TP instant (planetary hours from sunrise).

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Find the TP instant** near the birthday: the moment when the elongation equals the natal elongation.
   - Rath: the Sun in the natal Sun's sign.
   - Engine: same lunar month and tithi.
   - These usually agree; they differ in adhika-masa years.
2. **Cast the chart** for that instant.
3. **Year lord** = the lord of the vāra (Sun = Sunday …), with the vāra beginning at local sunrise.
4. **Hora lord** = the lord of the planetary hour at the TP instant.
5. **In-year dasha.**
   - SJC: Tithi Ashtottari dasha, seeded from the TP chart. This system is covered by the nakshatra-dasha researcher.
   - Alternatively Mudda or Patyayini computed on the TP chart (engine options).
6. **Year length.** TP to the next TP, about 354 or 384 days, so a "year" is not 365 days.

## 5. Interpretation rules (tagged)

- **Year lord.**
  - Good when it is a natal functional benefic, well placed in both the TP and natal charts.
  - Setbacks when it is a functional malefic for the natal Lagna.
  - [MODERN] Rath.
- **Hora lord.** The planet most active in the year. Its houses (ownership and placement in the TP chart) name the main
  events. [MODERN]
- **TP Lagna.** The house of the TP Lagna counted from the natal Lagna shows the area the year channels. [MODERN]
- **Moon and Sun placement.** Same tithi each year, so the Sun–Moon angle is fixed. Their house placements shift with
  the Lagna. [MODERN]

## 6. Variants and disputes (school by school)

- **Year lord.** Weekday lord (Rath/PVR) vs tithi lord (one explainer) vs hora lord as the "lord of the year" (some
  write-ups).
- **Month criterion.** Solar month (Sun's sign) vs lunar month (engine).
- **Place.** Birth place vs current residence.
- **Engine quirk.** `vratha.tithi_pravesha` silently swaps in the current year when `year_number <= birth year`.

## 7. Worked micro-example (optional, short)

A TP falls on a Thursday morning after local sunrise. Jupiter is the year lord. For a Taurus Lagna native, Jupiter rules
the 8th and 11th, a mixed functional nature. Placed in the 11th of the TP chart, it suggests a gains-focused but uneven
year.

## 8. Design notes for AI Astra

- **Engine output** for `annual.tithi_pravesha`: add
  - `vara_lord` (sunrise-based);
  - `hora_lord`;
  - the TP Lagna house from the natal Lagna;
  - the month-criterion used.

  Node must not derive the weekday or hora; both come from the engine.
- **Boards.**
  - You: the "kind of year".
  - Lucky: the year lord as a context colour.
  - It is the second annual voice beside the solar return.
- **Weight.** Medium in SJC, low elsewhere. Show it only when it agrees with the solar return or the natal dasha.
- **Pitfall.** TP years and solar-return years overlap by weeks to months. The boards must label which "year" they mean.

## 9. Open questions

- Get readable text of Rath's own Tithi Pravesha material (the pp_tp.pdf on vedicastrologer.org, or Rath's book) to
  settle the year-lord and place rules.
- Is there a classical root, for example in Kerala or Odia texts? None found.
