# Sudarshana Chakra Dasha (sudarśana-cakra-daśā)

> The Sudarshana Chakra lays three concentric wheels of the natal chart over one another, counting the houses from the
> Lagna, the Moon and the Sun. From that a clock follows. Each year of life activates one house: year 1 is the 1st,
> year 2 the 2nd, and so on, repeating every 12 years. Each month of that year activates one house from the year's
> house, and each 2.5 days one house from the month's house. It answers "which house of life is lit up this year, this
> month, these days?" and is read in all three wheels at once. Parashara presents it as a full chapter and requires a
> cross-check with Ashtakavarga. Modern SJC practice uses it as a key annual layer. It is one of the most reliable
> annual "focus" clocks, but it needs a natal promise.

## 1. Sources (text, edition, chapter:verse; URLs)

BPHS chapter 74, 28 verses, site numbering: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-74

| Rule | Source | Tag |
|---|---|---|
| Three circles from one centre, 12 divisions each | BPHS 74.4–6 | [TEXT] |
| Inner circle: houses from the Lagna; middle: from the Moon; outer: from the Sun | BPHS 74.5–6 | [TEXT] |
| A malefic in exaltation or own sign does not harm | BPHS 74.9 | [TEXT] |
| Results come from planets in, and aspecting, the house | BPHS 74.10–11 | [TEXT] |
| Benefic-dominant houses are good, malefic-dominant ones bad | BPHS 74.12 | [TEXT] |
| An empty house follows its lord's strength | BPHS 74.14 | [TEXT] |
| Condition: use Sudarshana when the Sun and Moon are in separate houses away from the Lagna. If two or three of them share one house, use the Lagna instead. | BPHS 74.18–20; the site's translation is terse | [TEXT] |
| Annual results through dashas and antardashas | BPHS 74.21 | [TEXT] |
| Site IAST: *tanvādyairvarṣamāssārdhadvikadhasrān pravartayet / bhaveśādidvādaśānāṃ daśā varṣeṣu kalpayet*. "…dhasrān" is probably a corruption of *ghasrān* ("days"), giving years, months and 2.5-day units counted from the 1st house (*tanu*). The dashas of the twelve house lords are set in years. | BPHS 74.22 — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-74/verse-22. The site shows no explicit "12 × 1 month" or "12 × 2.5 days". | [TEXT] |
| Antardashas reckoned from the start of each month | BPHS 74.23 | [TEXT] |
| Benefics in kendra, kona or the 8th from the Lagna are auspicious; Rahu harms its house; malefic-crowded houses are ruined | BPHS 74.24–25 | [TEXT] |
| Compare with Ashtakavarga: if both agree, the result is complete; if not, the stronger prevails | BPHS 74.27–28 | [TEXT] |
| Engine implementation | AIAstra_Radha `src/jhora/horoscope/dhasa/sudharsana_chakra.py` | engine |
| Repo background | `docs/techniques/general/general.sudarshana_chakra.md` | repo |

## 2. When it applies (which charts, which life areas)

- **Chart.** The natal chart. BPHS 74.18–20 gives a condition about Sun, Moon and Lagna placement, but the site's
  wording is terse; see §9.
- **Life areas.** All twelve houses in rotation. The year's house is the theme of the year:
  - 7th house year: partner;
  - 10th house year: work;
  - 4th house year: home;
  - 5th house year: children and romance.
- **Ages and houses.** Ages 0, 12, 24, 36, 48, 60 and 72 run 1st-house years. More generally, completed age *n* runs
  house (n mod 12) + 1.

## 3. Inputs required (exact chart data)

- The **natal** Lagna sign, Moon sign and Sun sign.
- Natal planets per sign, with aspects (graha drishti).
- Planet dignities (exaltation and own sign).
- Ashtakavarga (SAV/BAV), for the 74.27–28 cross-check.
- Birth date and time, for the year, month and 2.5-day boundaries.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Year dasha.** For completed age *n* (0-based), the active house is (n mod 12) + 1, counted from each reference:
   - Lagna: sign = Lagna sign + n;
   - Moon: sign = Moon sign + n;
   - Sun: sign = Sun sign + n.

   The year runs from birthday to birthday. The text reckons the year as a solar year; the natural boundary is the
   solar return, an [MODERN] SJC reading.
2. **Month antardasha.** The year is divided into 12 parts of about 1 month (year/12). Month *m* (0-based) of the year
   activates the sign (year sign + m), in each wheel. [TEXT] 74.22–23; the "1 month each" split is the standard reading.
3. **2.5-day pratyantardasha.** Each month is divided into 12 parts of 2.5 days (year/144). Part *d* activates the sign
   (month sign + d). [TEXT] 74.22 *sārdhadvika*.
4. **Order.** Always forward (zodiacal) and in whole signs.

## 5. Interpretation rules (tagged)

- **Which wheel.** Read the active house from all three wheels:
  - Lagna: body and self;
  - Moon: mind and comforts;
  - Sun: soul, status and father.

  If the three agree, the result is strong. [TEXT] 74.4–6 for the wheels. The three meanings are [MODERN] SJC as commonly taught; not read at source this pass.
- **Planets in the house.** Benefics in the active house or aspecting it, or malefics in their own or exaltation sign,
  give good results. Malefics otherwise harm it. An empty house follows its lord's strength. [TEXT] 74.9–14.
- **Benefic placements.** Benefics in kendras, konas or the 8th from the year's house help the year. Rahu harms the
  house it occupies. [TEXT] 74.24, applied relative to the activated house (SJC reading).
- **Ashtakavarga cross-check.** Check the activated sign's SAV and BAV. If they agree with the Sudarshana reading, the
  result is complete; if they disagree, the stronger view wins. [TEXT] 74.27–28.
- **Natal promise.** Sudarshana times only what the natal chart promises. [MODERN] (Rath; general practice).

## 6. Variants and disputes (school by school)

- **Year start.** Birthday by solar return (SJC, varsha pravesh) or the civil birthday. They differ by about a day.
- **Which wheel dominates.** BPHS 74 does not rank them. SJC reads all three. Some use the strongest of Lagna, Moon and
  Sun.
- **Engine deviation (observed in code, not exported).** `sudharsana_chakra_dhasa_for_divisional_chart`:
  - recomputes the chart at birth + N sidereal years and takes Lagna, Moon and Sun from that **later** chart, which is a
    transit/annual chart, not the natal one;
  - then adds (N − 1) houses, so years_from_dob = 0 seeds the 12th house;
  - contains debug `print` statements;
  - rounds antardashas to 2 decimal days;
  - is not referenced by any export module (`annual_export.py`, `dasha_export.py`, `api.py`).

  Classical Sudarshana counts from the **natal** Lagna, Moon and Sun.

## 7. Worked micro-example (optional, short)

Natal Lagna Cancer, Moon Virgo, Sun Aquarius. At completed age 30, 30 mod 12 = 6, so the 7th house is active:

- Lagna wheel: Capricorn;
- Moon wheel: Pisces;
- Sun wheel: Leo.

A partnership theme is active in all three wheels. In month 3 of that year (m = 2), the 9th house is active in each
wheel.

## 8. Design notes for AI Astra

- **Engine addition.** Add a natal-seeded Sudarshana export: `annual.sudarshana`. For a given date it returns, for each
  of the Lagna, Moon and Sun wheels:
  - year house number and sign;
  - month house and sign;
  - 2.5-day house and sign;
  - start and end instants;
  - the planets in, and aspecting, each active sign;
  - SAV and BAV of each active sign.

  Do not reuse the current function as-is (see §6). Node computes nothing.
- **Boards.**
  - **You:** the year house is the "theme of the year".
  - **Love:** 5th and 7th house years and months.
  - **Work:** 10th, 6th and 11th.
  - **Lucky:** the 2.5-day sign is a candidate for short good/bad windows, combined with panchang.
- **Weight.** Medium-high for "what is in focus this year". It must agree with the Vimshottari dasha lord's houses and
  the annual chart before a dated claim is made.
- **Pitfall.** The same age gives the same house number to everyone. The text must name the person's own signs and
  planets in that house.

## 9. Open questions

- BPHS 74.18–20 wording: when exactly to prefer the Lagna wheel. Needs a verse-level reading.
- Year length for the month split: year/12 vs actual solar months (Sun ingress). The text says *varṣa-māsa*; SJC
  commonly uses year/12.
