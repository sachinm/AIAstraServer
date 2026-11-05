---
name: transit-reading
description: Read transits for one person from the shared transit sky, their stored dasha and annual tables and their kundli overlay, and turn them into dated windows (a month, a quarter, or a week-by-week table) for career, money, marriage or any other subject. Use for any request about what the sky does for a person over a date range.
---

# Transit reading

Transits trigger what the chart and the dasha promise. They never create it. Every dated claim needs a dasha window and a transit that agree.

## Inputs, and where each comes from

| Need | Source | Never |
|---|---|---|
| Planet positions, ingresses, stations, lunations, eclipses | The shared sky (`transit_instants`, `transit_range_skies`). Prepare gaps first with the `transit-sky-preparation` skill | A per-user pull |
| Where a transit falls in this person's chart | The kundli overlay from the engine (`kundli_transit_overlays`, pulled with `npm run transits:overlay`): `house_from_lagna`, `house_from_moon`, `natal_house`, contacts, double transit, sade sati; with `--step day` a row per day | Counting houses from a sign index in Node or in a script |
| Dasha periods at three levels, annual charts, D10, Mudda, Patyayini | `kundli_data` rows for the kundli (`dasha.*`, `annual.*`) | Re-deriving dates |
| The person's promises and verdicts | The stored readings and `kundli_facts` | Re-judging the natal chart in a transit pass |

If a needed value is missing, say which one and what pull would fill it. Do not invent it and do not compute it.

## Method (docs/reading-engine/02 step 3, 26 pass 4)

1. **Frame.** Name the subject's houses, lords and karakas from the stored verdicts (career: 10th, 11th, 6th, 2nd, Mercury, Sun, Saturn).
2. **Slow gates first.** Saturn, Jupiter, Rahu and Ketu: sign, house from lagna and from Moon, what natal point each sits on. Jupiter on a frame lord or house gives; Saturn delays and fixes the remit; Rahu inflates; Ketu detaches.
3. **Double transit.** Saturn and Jupiter both influencing a frame house is the strongest trigger window.
4. **Dasha overlay.** Cut each transit window at dasha and sub-period boundaries. A window is the intersection. Count how many independent clocks agree and state the count. Make a timing claim only when two or more do.
5. **Annual chart.** Does the year's Tithi Pravesha chart, its D10 and its Mudda and Patyayini month confirm or contradict the dasha? Say which wins when they disagree.
6. **Fast planets for the week.** Sun and Mercury crossings of natal points, Mars on natal Sun, Venus or Moon, Mercury stations, new and full moons, eclipses. These set the day, not the year.
7. **Daily layer.** The Moon's house, the tara from the birth star, the tithi, the weekday lord. Mark each day A act, B good, C routine, D hold. Grading rules are in the Sumit week-by-week document, section 6 heading.
8. **Verdict.** For each window: for minus against, a scale out of 100 (strong 70+, moderate 50 to 69, weak under 50). Say who is for and who is against.

## Output shapes

- **Horizon table (3, 6, 9, 12 months):** horizon | what is promised | carried by (clocks, count) | what blocks or steals it | scale.
- **Sub-category table:** promotion, recognition, mentor, income, luck, offer cycle, change of company, location, department, the rival, delay, days to sign nothing. Each row names its transit gate and dates.
- **Week table:** week | Moon path and day grades | clocks running | act days | one focus line that names the dates and the reason. One idea per row, plain words, no jargon the reader has to look up.
- Dates are written `Mon 7 Oct` style with the year in the week label. Every date comes from a stored row; none from memory.

## Rules that never bend

- No invented dates, no invented placements. If a number is not in a stored row, it is not in the reading.
- Never write the engine's name or the library's name in anything a user can read.
- Do not give a financial instruction beyond the chart's own caution (for example, no speculation in a named window).
- Remedies are acts and conduct (a mantra, a day, a donation of food or books, service, conduct), tied to a planet and to the sub-periods where it matters. No claim that a remedy changes the chart.
- Mark anything counted by a script rather than returned by the engine as such, in the document's own provenance line, and file a TODO to regenerate it from the engine's overlay.

## Worked example

`C:\Users\Owner\Documents\Readings\Sumit-career-week-by-week-2026-10-to-2028-12.docx`: 118 weeks, Oct 2026 to Dec 2028, built from the stored dasha tables, the 2026 to 2028 annual charts, and the shared San Jose sky. Its day layer (Moon house, tara, tithi, grades, stations, lunations) was counted by a scratch script from the stored sky rows because the daily overlay had not been pulled; regenerate it from the overlay once `npm run transits:overlay` has run for the kundli. The repeatable version belongs in a script under `scripts/` that reads the overlay and the shared sky and writes the week table.
