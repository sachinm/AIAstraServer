# Naisargika Dasha (naisargika-daśā, "natural period")

> A fixed life-stage clock that is the same for everyone: Moon rules year 0–1, Mars 1–3, Mercury 3–12, Venus 12–32,
> Jupiter 32–50, Sun 50–70 and Saturn 70–120. It answers "which stage of life is this, and which planet colours it?",
> not "what happens this year". Only the sub-periods (antardasha) depend on the chart. Parashara lists it among the
> systems in 46.10, next to 46.11, which marks Ashtakavarga, Sandhya, Pachaka and "the others beginning with Tara" as
> not universally accepted. Whether that phrase also covers 46.10 (Naisargika, Paindi, Amshi) is unverified. Varahamihira and Kalyanavarma treat it as one of two working dashas,
> the other being Mula dasha. In modern use it is a background layer and is rarely used for event timing.

## 1. Sources (text, edition, chapter:verse; URLs)

**Edition used for BPHS.** The BPHS text is the enjoylearningsanskrit.com web edition: 97 chapters, Devanagari, IAST and
English. The site names no printed edition. Its chapter and verse numbers are cited here as "site numbering". They
appear to follow the 97-chapter Santhanam/G.C. Sharma arrangement, but that is not confirmed.

| Rule | Source | Tag |
|---|---|---|
| Named in the list of dashas (*naisargikadaśā tathā*) | BPHS 46.10 (site numbering) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 | [TEXT] |
| 46.11: *aṣṭavargadaśā sandhyādasā pācakasaṃjñikā / anyās tārādaśādyāś ca na svargāḥ sarvasammatāḥ*. Ashtakavarga, Sandhya, Pachaka and "others beginning with Tara" are not universally agreed. Whether this covers 46.10 (Naisargika) was not verified. | BPHS 46.11 (site numbering) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-11 | [TEXT] |
| Years Moon 1, Mars 2, Mercury 9, Venus 20, Jupiter 18, Sun 20, Saturn 50, "in that order from birth", called *daśā* | BPHS 43.16–17 (site numbering, nisargāyu section) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-43 | [TEXT] |
| The same 1-2-9-20-18-20-50 years; Mula dasha named as the companion system | Brihat Jataka 8.9, as cited by Sanjay Rath; verse not verified this pass | [TEXT] via [MODERN] |
| Order of the dashas | Saravali 41.21, as cited by Rath; not verified | [TEXT] via [MODERN] |
| Antardasha rules | Saravali 42.1, 42.2, 42.4, 42.5, as cited by Rath; not verified | [TEXT] via [MODERN] |
| Longevity periods in the order Sun..Saturn | Jataka Parijata V.2, as cited by Rath | [TEXT] via [MODERN] |
| Full method and its own antardasha weighting | Sanjay Rath, "Naisargika Dasha" — https://srath.com/jyoti%E1%B9%A3a/dasa/naisargika-dasha/ | [MODERN] |

## 2. When it applies (which charts, which life areas)

- **Chart.** Every natal chart. There is no applicability condition.
- **Life areas.**
  - It gives the "stage of life" frame: infancy (Moon), childhood (Mars), schooling (Mercury), youth, love and marriage
    (Venus), adult duty, children and wisdom (Jupiter), authority and status (Sun), old age and detachment (Saturn).
  - The natal strength of the stage lord tells how that stage of life goes on the whole.
- **Use with Mula dasha.** Rath reports Varahamihira's rule that a result is sure when Naisargika and Mula dasha both
  show it at the same time. [MODERN] citing BJ 8 (verse not verified).

## 3. Inputs required (exact chart data)

- The birth instant. The mahadasha boundaries are fixed ages.
- For the antardashas:
  - the natal sign of each of the seven planets;
  - kendra, panaphara and apoklima class from the dasha lord;
  - sign and planet strength, to break ties.
- Rahu, Ketu and Lagna get no period in the classical scheme.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

**Mahadashas.** These are fixed; there is no balance at birth.

| Lord | Years | Starts at age | Ends at age |
|---|---|---|---|
| Moon | 1 | 0 | 1 |
| Mars | 2 | 1 | 3 |
| Mercury | 9 | 3 | 12 |
| Venus | 20 | 12 | 32 |
| Jupiter | 18 | 32 | 50 |
| Sun | 20 | 50 | 70 |
| Saturn | 50 | 70 | 120 |

The total is 120 years (BPHS 43.16–17 [TEXT]). Rath treats Lagna as an optional eighth "very old" stage and rejects it.
He also gives the nodes no period. [MODERN]

**Antardashas (Rath's reading of Saravali 42).** [MODERN]

1. Weigh each of the other six planets by its place counted from the dasha lord:

   | Place from the dasha lord | Weight |
   |---|---|
   | Conjunct the dasha lord | 1/2 |
   | 7th | 1/7 |
   | 4th or 8th | 1/4 |
   | 5th or 9th | 1/3 |
   | Other houses (2, 3, 6, 10, 11, 12) | 1 |

   Rath's page is internally inconsistent about the 3rd and 10th: it gives them 1/4 in one place and 1 in another.
2. Add up the weights.
3. Antardasha of a planet = its weight ÷ the total × the mahadasha years.
4. The dasha lord gets no antardasha.
5. The antardashas run in kendra → panaphara → apoklima order from the dasha lord. Within a group, use the sign and
   planet strength rules.

**Year length.** The texts do not state one. The engine uses the sidereal year.

## 5. Interpretation rules (tagged)

- **Strength of the stage lord.** A strong, well-placed lord gives a good stage of life; an afflicted lord gives a
  troubled one. This is a general dasha rule, [COMM]/[MODERN].
- **Antardashas.** An antardasha lord placed in a good house from the dasha lord gives that stage's good events.
  [MODERN] per Rath.
- **Agreement with Mula dasha.** When Naisargika and Mula dasha agree at the same time, the result is sure. Rath cites
  this as Varahamihira's rule, BJ 8 (verse not verified). [TEXT] via [MODERN]

## 6. Variants and disputes (school by school)

- **Lagna as an eighth period.** pyjhora (the engine) adds Lagna with 12 years, which makes 132 years in total. BPHS 43
  and Rath both total 120 years for seven planets, so the engine's Lagna period is not classical.
- **Order.** The order is the same in BPHS 43.17 and Rath: Moon, Mars, Mercury, Venus, Jupiter, Sun, Saturn. Jataka
  Parijata lists the years in planet order Sun..Saturn, but that is a table order, not a dasha order.
- **Antardasha.**
  - The engine splits each mahadasha equally among the sub-lords it keeps.
  - It drops sub-lords in some houses through options, and its code carries a TODO to add placement weights.
  - It rounds each antardasha to 2 decimal years, so dates drift. `dasha_export.py` notes about 7 days of drift per
    mahadasha.
  - Rath's weighted rule is different from all of this.

## 7. Worked micro-example (optional, short)

A person aged 41 is in the Jupiter Naisargika dasha (ages 32–50). In Rath's scheme, Venus conjunct Jupiter would get
weight 1/2. A planet 7th from Jupiter would get 1/7, which is a short sub-period.

## 8. Design notes for AI Astra

- **What the engine must output.**
  - The fixed mahadashas: lord, start age, end age, start date, end date.
  - The weighted antardashas per Rath, with weight and placement class.
  - Three changes to the current engine output:
    - drop Lagna by default, or flag it as a non-classical extension;
    - replace the equal split with Rath's weights;
    - stop rounding the antardasha lengths.
- **Boards it serves.**
  - The You/Self board, as the "life chapter" (stage) background.
  - Love, as a weak prior: the Venus stage at ages 12–32 is the culturally expected romance window.
  - Not used for dated predictions.
- **Weight vs other techniques.** Low. Treat it as a context layer under Vimshottari and never as a trigger.
- **Pitfalls.**
  - It is identical for everyone of the same age, so the user-facing text must lean on the natal strength of the stage
    lord, or it reads as generic.
  - The product rule "specific to the person or not shown" applies.

## 9. Open questions

- Fetch Saravali 41–42 and BJ 8 to confirm the antardasha weights and resolve Rath's 3rd/10th inconsistency.
- Year length: sidereal or 360-day? No text found states it.
- Whether the dasha lord gets its own antardasha: Rath says no; the BJ wording was not checked.
