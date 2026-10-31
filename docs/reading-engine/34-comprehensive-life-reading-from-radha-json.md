# 34 — The comprehensive life reading, built from Radha's JSON tables

Status: plan, 2026-10-31. Written after the Sachin reading of 2026-10-28 (eleven parts) and its review. Companion to
doc 33 (reader curricula, Oracle master, Clarify real_want). This doc says how a "comprehensive life reading" is
assembled from nothing but the tabular JSON Radha serves, what the reading hierarchy is, what data is still missing
from the catalog, and how the pipeline maps onto the readers and the Oracle of doc 33.

## 1. What a comprehensive life reading has to answer

A reading is judged by whether it satisfies a concerned relative, not an astrologer. The questions are always the same
six, in this order, and the reading is structured around them:

1. **What is promised** in this life (per area: self, money, work, home, marriage, children, parents, siblings, health,
   travel, learning, dharma). The promise is a verdict with a scale behind it, not a list of placements.
2. **Which planets withhold it**, named, with the mechanism (a weak lord, an obstructed bolt, a debilitated karaka, a
   period lord in a bad house from the mahadasha lord). "Blocked" and "shaped" are not verdicts; a weighed scale is.
3. **When it manifests**, by the period that owns it (mahadasha), the sub-period that delivers it (antardasha), the
   trigger (pratyantar and transit gate), with the recurrences (the cycle), because promised things happen more than once.
4. **To what level** (below the native's own rate, at it, above it; one child or three; a rented home or an owned one),
   and **with what manner** (effort, reversal, ease, providence).
5. **With what probability**, stated as a graded confidence with its basis (how many independent layers agree).
6. **What helps** (the saving graces: the star-lord of each planet, the house that bolts the matter, the remedy the
   chart itself writes) and **what to do on which dates**.

The reading must separate three registers and label them: **mechanics** (the data and the rules applied), **the planet
reading** (what each planet promises and withholds in this chart), and **the synthesis** (the answers to the six
questions in plain language). A reading that mixes them reads as noise to the relative and as hand-waving to the expert.

## 2. The hierarchy of evidence (what outranks what)

| Rank | Layer | Role | Source tables |
|---|---|---|---|
| 1 | **Rasi (D1) promise** | what the life holds: house, lord, occupants, dispositors and their state, aspects (graha and rasi), argala and virodha, arudhas, SAV, bhava bala, shadbala, functional nature, yogas and doshas, nakshatra lords | varga.d1, dignities, relations, aspects, argala.d1, arudhas, ashtakavarga, strength.*, benefic_malefic, yogas, doshas, karaka.chara, sphutas, bhava |
| 2 | **Divisional promise** | the same house read in the varga that owns the area, with that varga's lagna, lord, dispositors, arudhas and argala; D9 is read for every area as the fruit chart, with more weight after ~36 | varga.dN, arudhas.dN, argala.dN, strength.vimsopaka |
| 3 | **Dasha promise and timing** | the mahadasha lord's houses, sign, nakshatra lord and dispositor give the chapter's promise; the antardasha lord's position from the mahadasha lord (6/8/12 = bad) and from the lagna modify it; the pratyantar triggers; agreement across systems grades it | dasha.vimsottari, dasha.dwisatpathi (if applicable), dasha.yogini, dasha.tithi_ashtottari, dasha.narayana, dasha.sudasa, dasha.chara and the other rasi dashas, dasha.applicable, dasha.kaala, dasha.karaka |
| 4 | **Annual charts** | the year's own promise: tithi pravesha (lagna, its 7th/10th/2nd, Jupiter's place, the year lord) and its vargas; varsha with sahams, Patyayini, Mudda; the Tithi Ashtottari it generates | annual.tithi_pravesha, annual.varsha, annual.sahams, annual.patyayini, annual.mudda, annual.tithi_pravesha_dasha |
| 5 | **Transit gates** | Jupiter and Saturn on the house, its lord, the lagna, the Moon sign and the padas (double transit); the nodes; stations; exact contacts; eclipses | transit range, contacts, monthly snapshots |
| 6 | **Daily grade** | tara from the natal Moon's star, chandra bala, fast-planet crossings, Mercury/Venus stations, panchanga | daily snapshots |
| 7 | **Prashna** | the question's own chart, for the present state and the next turn | prashna |

Rules of use:

- The promise is read at ranks 1–2 only. Dashas never create a promise; they deliver or withhold one.
- A dated statement needs: the promise at rank 1–2, the owning mahadasha at rank 3 in at least **two** systems
  (Vimshottari and one of: the applicable conditional dasha, a Jaimini rasi dasha for the house's sign, Yogini, Tithi
  Ashtottari), an annual confirmation at rank 4 for the year, and a transit gate at rank 5. Fewer than that, the
  statement is a possibility and is written as one.
- Two-system agreement is the minimum for timing, not a verdict on the promise. Three or more systems on the same
  window raise the confidence grade; a system that contradicts lowers it and is named.
- Weighting of the scale per area (default; the Oracle may adjust per question): D1 35, vargas 20 (D9 counted for every
  area), dashas 25 (Vimshottari 8, rasi dashas 6, applicable conditional 4, Yogini 3, Tithi Ashtottari 2, others 2),
  annual 10 (TP 6, varsha 4), transit gates 10. A window scores 70+ strong, 50–69 moderate, under 50 weak.
- Confidence is reported as a grade with its basis ("strong: five layers agree, one contradicts") and, where the
  product wants a number, mapped to a band (strong ≈ 65–80 %, moderate ≈ 40–60 %, weak ≈ 15–35 %); never as a point
  estimate without the basis.

## 3. The pipeline from JSON to reading

```
Radha tables (kundli_data rows, annual rows, transit files, prashna)
  → Facts normaliser        one typed facts object: houses[1..12], planets[9], vargas[N], padas, argala, strengths,
                             dashas[system][levels], annual[year], transits{range, contacts, monthly, daily}, prashna
  → Promise engine          per area: D1 facts + owning varga facts → weighed scale (every line: fact, weight, side)
                             → verdict (promised / partial / not written) + the named withholding planets
  → Dasha engine            per system: MD promise (lord's houses, sign, star-lord, dispositor), AD modifiers
                             (position from MD lord and from lagna), PD triggers; cross-system agreement per window
  → Annual engine           per year: TP and varsha readings, sahams on natal points, Patyayini/Mudda cash-flow lords
  → Transit engine          gates: double transit on house/lord/lagna/Moon/pada; nodes; stations; contacts; eclipses
  → Daily engine            tara + chandra bala + fast crossings → good/avoid days per purpose
  → Synthesis (Oracle)      the six questions per area in three registers; the probability grade with basis; the
                             saving graces; the dated calendar; the cycle table
  → Outputs                 the reading (Markdown → DOCX/PDF), the day calendar, the facts dossier used
```

Mapping to doc 33: the Facts normaliser is the dossier builder; the Promise engine is readers R1–R7 and R13 with a
scale output added; the Dasha engine is R8–R9 with the cross-system agreement step added; the Annual engine is R11;
the Transit and Daily engines are R10; the Synthesis is the Oracle (T11) with the six-question template and the three
registers made mandatory; Clarify's real_want decides which area's six questions lead.

## 4. What Radha must add for the reading to be complete

Found missing or unconfirmed during the Sachin pull (deploy session to confirm each):

1. **Dasha levels 3** (pratyantar) for Vimshottari, Dwisaptati, Yogini, Tithi Ashtottari, Kaala, Karaka; sub-sub for
   the rasi dashas where the classical system has them.
2. **Annual charts with divisional charts**: tithi pravesha and varsha with D1–D60 (the method reads the year's D9,
   D10, D2, D7 as well as its D1).
3. **Panchanga for an arbitrary instant** (tithi, nakshatra, yoga, karana, weekday, hora) for the daily engine.
4. **Fast-planet transit contacts** (Su, Mo, Me, Ve, Ma on natal points); today transit_contacts accepts only Ma, Ju, Sa,
   Ra, Ke.
5. **Transit ashtakavarga** (bindu of the transiting planet in the sign, kakshya) for Sa, Ju, Ra, Ke.
6. **Sade sati and dhaiya** from the natal Moon for the full life (the range payload has the fields; confirm they fill
   when Saturn is in range).
7. **Muhurta / day-quality** for a date range at a place, if the library serves it.
8. **Dignity in the varga tables** (own/exalted/debilitated/friend/enemy per planet per varga), so the Node side does
   not read a sign table.
9. **Dasha applicability** already served; keep it as the gate for conditional systems.

Transit snapshots are place-and-instant data, not kundli data: doc 35 (to be written by the deploy session) specifies a
kundli-independent cache so the sky is pulled once per instant and natal fields are derived at read.

## 5. The written reading's shape (the template the Oracle fills)

1. Reader's guide: the three registers and the grading legend.
2. The synthesis for the concerned relative: the six questions for the area asked, then for the other areas in brief;
   the named withholding planets; the dated turns; the confidence grades.
3. The planet reading: nine planets, each with sign, house, dignity, star-lord, dispositor and its state, vargas in
   one line, what it promises, what it withholds, its saving grace.
4. The promise hierarchy: the D1 verdicts per area; the varga verdicts; the year charts; D9's role.
5. The dasha promises: each mahadasha 2026 → +10 years per system, with its antardashas and the 6/8/12 flags, and the
   cross-system agreement table.
6. The timing and cycle tables per area, the calendar, the muhurta signs.
7. The appendices: the mechanics (facts used, weights, every scale line), so an expert can audit.

## 6. Phases

- **P-1 (now, docs only):** this doc; doc 35 by the deploy session; the Radha change list in §4 queued.
- **P-2 (Node, after the Radha changes):** the Facts normaliser and the Promise engine with scale output; unit tests on
  the Sachin and Archisha dossiers (expected verdicts fixed from the manual readings).
- **P-3:** the Dasha engine with cross-system agreement; the Annual, Transit and Daily engines; the day calendar.
- **P-4:** the Oracle template with the six questions and three registers; the confidence grade; DOCX output.
- **P-5:** evaluation against the manual readings (parts 1–11 of the Sachin reading as the gold set), then the
  Archisha set.

All code on feature branches from develop, merged with --no-ff after tsc and the area's unit tests; no migration applied
and no deploy without Sachin's OK, per AGENTS.md.
