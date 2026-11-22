# Ashtakavarga Dasha (aṣṭavarga-daśā)

> Parashara names a dasha whose results are judged by Ashtakavarga strength (*aṣṭavargabalena*). The text gives no
> standalone period table or order. It is a weighting rule over other dashas more than a clock of its own. Parashara
> lists it among the systems "not universally accepted". No living school uses a distinct Ashtakavarga dasha clock.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Named; not universally accepted | BPHS 46.11 (site numbering) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 | [TEXT] |
| Results to be weighed by Ashtakavarga strength; called *aṣṭavargadaśā* | BPHS 46.203 (site numbering) | [TEXT] |
| Ashtakavarga chapters: house and sign results from bindus | BPHS ch. 66–72 region (site numbering; ch. 72 confirmed as Ashtakavarga) | [TEXT] |
| Cross-check of Sudarshana results with Ashtakavarga: the stronger result prevails | BPHS 74.27–28 (site numbering) | [TEXT] |

## 2. When it applies (which charts, which life areas)

Any dasha period of a planet or sign. In this reading, the Ashtakavarga "dasha" is the rule that a period's results scale
with the bindus.

## 3. Inputs required (exact chart data)

- Bhinnashtakavarga (BAV) of each planet.
- Sarvashtakavarga (SAV) per sign.
- Optionally, the reduced (shodhita) values.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

No period table exists in BPHS 46.203. The working method, a [COMM]/[MODERN] reading:

1. Take the running dasha lord from the primary system (Vimshottari).
2. Read the lord's BAV bindus in the sign it occupies (natal), and the SAV of that sign.
3. Read the bindus of the transit signs during the period.
4. More bindus mean fuller good results. The common threshold is 4 or more of 8 in BAV, and 28 or more in SAV, as good.
   [MODERN] convention.

Some modern authors build an Ashtakavarga-based dasha ordering (for example, by SAV totals). None was found sourced to
a classical text.

## 5. Interpretation rules (tagged)

- **Scaling.** A dasha's results are proportional to the dasha lord's Ashtakavarga strength. [TEXT] 46.203.
- **Agreement.** When Sudarshana and Ashtakavarga agree, the result is complete; when they disagree, the stronger
  prevails. [TEXT] 74.27–28.

## 6. Variants and disputes (school by school)

There is no agreed standalone clock. Treat any software "Ashtakavarga dasha" as a modern construct unless it cites a
text.

## 7. Worked micro-example (optional, short)

Venus runs a Vimshottari dasha from Taurus, where Venus has 6 BAV bindus and the sign has 32 SAV. Read it as strongly
positive. If Venus had 2 bindus there, the same dasha would be weak.

## 8. Design notes for AI Astra

- **Do not build a separate clock.** Use Ashtakavarga as a weight on Vimshottari, annual and Sudarshana periods.
- **Engine.** BAV and SAV must come from the engine. Node does no bindu arithmetic.
- **Boards.** All boards, as a strength modifier. Lucky is the most natural fit (transit bindus).
- **Weight.** Medium as a modifier; none as a timer.

## 9. Open questions

- Does any commentator (for example in the Santhanam notes) give an actual Ashtakavarga dasha period rule? Not found.
- Which bindu threshold should the product adopt? This is a design choice.
