# Mudda Dasha (mudda-daśā; Varsha Vimshottari)

> Mudda dasha is the Vimshottari dasha compressed into one solar year: the nine lords run in Vimshottari order with
> 360 "days" in proportion to their years (Sun 18, Moon 30, Mars 21, Rahu 54, Jupiter 48, Saturn 57, Mercury 51,
> Ketu 21, Venus 60). The first lord of each year moves one step along the Vimshottari order per completed year of age,
> starting from the birth star's lord. It answers "within this birthday year, when does each planet take charge?"
> "Mudda" is a Tajika (Perso-Arabic) loan word for "period". It is used in Varshaphala practice (PVR, K.N. Rao circle,
> Indian Varshaphal manuals) as the main in-year timer, alongside Patyayini.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Mudda = Vimshottari compressed into one year, used in Tajika Varshaphala | Tajika tradition. The exact Tajika Neelakanthi verse was not located; the text is on archive.org (Mahidhara Hindi edition, Bombay c. 1931 — https://archive.org/details/tajika_nilakanthi/page/n0). Not read this pass. | [TEXT]? (unverified) |
| Starting lord: (birth-star number + completed years − 2) mod 9, remainder counted Sun=1, Moon=2, Mars=3, Rahu=4, Jupiter=5, Saturn=6, Mercury=7, Ketu=8, Venus=0/9 | Widely quoted Varshaphal manual formula. No primary source found this pass; the search returned none. Arithmetically equivalent to "advance one Vimshottari lord per completed year from the natal star lord" (§4). | [MODERN] (unverified) |
| Worked example: born 1972-06-01 04:16 IST, 16°15′N 81°12′E; year 21 starts with Rahu (54.79 days) on 1993-05-20 | PVR Narasimha Rao, *Vedic Astrology: An Integrated Approach*, ch. 30.3, Example 122 / Chart 67, as encoded in the engine's `tests/pvr_tests.py::mudda_varsha_vimsottari_tests` | [MODERN] |
| Day table (sums to 360) and the start-date method | AIAstra_Radha `src/jhora/const.py:203` (`varsha_vimsottari_days`) and `horoscope/dhasa/annual/mudda.py` | engine |

## 2. When it applies (which charts, which life areas)

- **Charts.** The Tajika annual (varsha pravesh, solar return) chart. The engine also offers it on the Tithi Pravesha
  chart (`annual.tithi_pravesha_dasha`, `mudda` option).
- **Life areas.** All; it is the in-year timer for whatever the annual chart and the natal dasha promise.

## 3. Inputs required (exact chart data)

- The natal Moon's sidereal longitude: its nakshatra and the fraction elapsed.
- Completed years of age *Y* (the varsha number).
- The varsha pravesh instant: the Sun's sidereal return to its natal longitude.
- For reading: the annual-chart placements of the lords.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Natal star lord** *L0*: the Vimshottari lord of the Moon's nakshatra.
2. **Year's first lord.** Move *Y* steps forward along the Vimshottari order from *L0*. The order is Ketu, Venus, Sun,
   Moon, Mars, Rahu, Jupiter, Saturn, Mercury.
   - This equals the manual formula (N + Y − 2) mod 9, with N = the birth-star number from Ashwini = 1.
   - Check: Ashwini (N = 1), Y = 0 gives −1 ≡ 8, which is Ketu. That is correct, since Ashwini is Ketu's star.
3. **Periods** in days of a 360-day year: Sun 18, Moon 30, Mars 21, Rahu 54, Jupiter 48, Saturn 57, Mercury 51,
   Ketu 21, Venus 60. These are the Vimshottari years × 3. They are scaled to the actual year length (engine: × tropical
   year/360).
4. **Balance.** The first lord's period is reduced by the fraction of the natal nakshatra the Moon had already
   traversed at birth, the same fraction every year (PVR method as encoded).
   - So the cycle actually began slightly before the varsha pravesh. The PVR example starts on 1993-05-20 for a June 1
     birthday.
5. **Antardashas (bhukti).** The same nine lords from the dasha lord in Vimshottari order. Each bhukti = maha days ×
   bhukti lord's years/120.
6. **Year length.**
   - Some use 360 days, some 365.25 or 365.2564 (sidereal); the engine comment admits this.
   - The engine uses the tropical year and anchors at birth JD + Y × tropical year, not at the actual sidereal solar
     return.
   - The drift is about 0.014 days per year (≈ 0.7 day at age 50).

## 5. Interpretation rules (tagged)

- **The lord's annual-chart placement.** A Mudda lord gives the results of the houses it occupies and owns in the annual
  chart, modified by its natal promise. [MODERN] (PVR; K.N. Rao circle Varshaphal practice).
- **Year-lord agreement.** A Mudda period of the Varsheshwara (year lord) or the Muntha lord is emphatic. [MODERN]
  Tajika practice.
- **Natal dasha agreement.** An event needs:
  - the natal Vimshottari dasha or antardasha lord to promise it;
  - the annual chart to show it;
  - the Mudda lord to be connected to the same houses.

  [MODERN] standard layering (see `00-overview.md`).

## 6. Variants and disputes (school by school)

- **Anchor.**
  - Most manuals: the birth star.
  - Some modern sites: the annual chart's Moon or Lagna. This is not the PVR or engine method.
- **Balance.** Applied every year (PVR, engine) or not at all (each year starts fresh at the varsha pravesh with a full
  first period, as some manuals do).
- **Year length:** 360 / 365.25 / sidereal / tropical.
- **ENGINE BUG.** The engine's behaviour was verified on 2026-11-18 by running it. It is wrong under the
  one-lord-per-year rule, which matches the PVR example; that rule itself has no primary-text source yet.
  - `mudda.varsha_vimsottari_dasha_start_date` does `lord = (lord + years) % 9`, where `lord` is a **planet id** (Sun 0 …
    Ketu 8). It then indexes `varsha_vimsottari_adhipati_list = [Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury, Ketu,
    Venus]` with the result.
  - That is correct only when the natal star lord is the Sun, Moon, Mars or Jupiter, whose planet id equals their list
    position.
  - For Rahu, Saturn, Mercury, Ketu and Venus stars it gives the wrong starting lord. Examples:
    - Moon in Ashwini (Ketu): Y = 0 → engine says Venus, expected Ketu.
    - Revati (Mercury): Y = 0 → engine says Rahu.
    - Shatabhisha (Rahu): Y = 21 → engine says Moon, expected Mercury.
  - The PVR test passes only because its native's star lord is the Sun.
  - Fix in the engine: `lord = list[(list.index(natal_lord) + years) % 9]`.
  - Any `annual.mudda` and `annual.tithi_pravesha_dasha (mudda)` rows stored for people with those stars are wrong.

## 7. Worked micro-example (optional, short)

- **Moon in Rohini** (Moon's star) **at age 30.** Start from Moon and move 30 mod 9 = 3 steps: Mars, Rahu, Jupiter. The
  year opens with the Jupiter mudda (48 days × the year scale), less the natal balance fraction. Saturn (57 days)
  follows, and so on.
- **Same result by the formula.** Rohini N = 4: (4 + 30 − 2) mod 9 = 32 mod 9 = 5, which is Jupiter. ✔

## 8. Design notes for AI Astra

- **Engine.**
  - Fix the lord-index bug above, then re-run the stored annual tables for affected people.
  - Expose `year_length_basis` and `balance_rule` in the payload.
  - Anchor at the true varsha pravesh instant.
- **Boards.**
  - All boards' "this year" timelines, especially Work (promotions or job change within the year) and Love.
  - It gives the month-scale windows inside a year.
- **Weight.** Medium. It is the in-year timer, but secondary to the natal Vimshottari antardasha and pratyantardasha. It
  is useful when it agrees with Patyayini.
- **Pitfall.** Do not let a Mudda period alone produce a prediction. It must sit inside a natal dasha promise and an
  annual-chart indication.

## 9. Open questions

- Locate the Mudda verse in Tajika Neelakanthi or another Tajika text (Neelakanthi Varshatantra; Hayanaratna) and check
  the balance rule.
- Confirm the (N + Y − 2) formula in a printed manual (e.g., B.V. Raman's *Varshaphal*, or K.S. Charak).
