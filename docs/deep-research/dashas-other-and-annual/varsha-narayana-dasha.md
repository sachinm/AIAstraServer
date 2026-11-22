# Varsha Narayana Dasha (varṣa-nārāyaṇa-daśā)

> Varsha Narayana is a modern Parashari/Jaimini adaptation that runs the Narayana sign dasha inside a single annual
> chart. Each sign gets its Narayana years read as about 3 days per year, so the 12 signs fill about a year. The seed
> sign progresses one house per year of age from the Lagna. It answers "which sign, and so which house area, is active
> in which part of this year?" It comes from PVR Narasimha Rao's textbook (via the engine's encoded example); no classical text was
> found. Treat it as [MODERN].

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Varsha Narayana dasa, with the worked example: born 1972-06-01, year 22, navamsa (D9), first signs and durations (7, 21), (8, 12), (9, 6), (10, 9), (11, 33) | PVR Narasimha Rao, *Vedic Astrology: An Integrated Approach*, ch. 30.4, as encoded in the engine's `tests/pvr_tests.py::varsha_narayana_tests`. Book not opened. | [MODERN] |
| Narayana dasha (natal) | Jaimini Upadesa Sutras via Rath and PVR; covered by the Jaimini researcher | [TEXT]/[MODERN] |
| Implementation | AIAstra_Radha `src/jhora/horoscope/dhasa/raasi/narayana.py::varsha_narayana_dhasa_bhukthi` | engine |

## 2. When it applies (which charts, which life areas)

- **Charts.** The annual (varsha pravesh) chart, in D1 or any varga. PVR's example uses D9.
- **Life areas.** All; most useful when a varga matches the subject (D10 for career, D9 for marriage).

## 3. Inputs required (exact chart data)

- The annual chart and its varga.
- The completed age *n*.
- The Narayana sign-period rules: the sign lord's distance, and exaltation or debilitation adjustments.
- Saturn's and Ketu's positions, for direction exceptions.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

This is the engine's behaviour (PVR method as encoded):

1. **Charts.** Cast the annual chart at the solar return for year *n*, D1 and the chosen varga D*k*.
2. **Progressed sign** = annual-chart Lagna sign + (n − 1) + (k − 1).
   - The engine variable is called `natal_lagna`, but it is read from the annual chart's D1.
3. **Seed.** Take the lord of that progressed sign. The seed is the sign that lord occupies in the varga.
4. **Order.** Standard Narayana progression from the seed. The Saturn and Ketu exceptions change direction or order.
5. **Period** of each sign = its Narayana dasha years (1–12, ±1 for exaltation or debilitation of the lord) × 3, in units
   of year/360 days. So each Narayana "year" is about 3.04 days.
6. **Antardashas.** Narayana-style.
7. **Stop rule.** Stop when the total reaches 3 × the Narayana life-span constant.

## 5. Interpretation rules (tagged)

- **Active sign.** The house the active sign forms from the annual and natal Lagna is the area in focus. Planets in the
  sign and its aspects colour the result. [MODERN] PVR.

## 6. Variants and disputes (school by school)

- **Progression base.** PVR's text may count the progressed sign from the **natal** Lagna. The engine uses the annual
  Lagna (see §9).
- **Period scale.** Narayana years × 3 days. Twelve signs at an average of about 10 years each give about 360 days, but
  the sum varies by chart, so the 12 periods do not always fill exactly one year.

## 7. Worked micro-example (optional, short)

PVR's example (as encoded): year 22 in D9. The first dasha is sign index 7 (Scorpio), 21 days, then Sagittarius 12 days,
Capricorn 6, Aquarius 9 and Pisces 33.

## 8. Design notes for AI Astra

- **Engine.** Expose `annual.varsha_narayana` per varga. State the progression base and the 3-day scale in the payload.
- **Boards.** Work (D10) and Love (D9) in-year windows, as a secondary check beside Mudda and Patyayini.
- **Weight.** Low-medium; it is modern and has no classical attestation.
- **Pitfall.** Do not present it as classical Tajika.

## 9. Open questions

- Read PVR ch. 30.4 to confirm:
  - whether the progression counts from the natal or the annual Lagna;
  - the treatment of the varga factor (k − 1);
  - what happens when the 12 periods do not sum to one year.
