# 34 — The comprehensive life reading, built from Radha's JSON tables

Status: plan, 2026-10-31. Written after the Sachin reading of 2026-10-28 (eleven parts) and its review. Companion to
doc 33 (reader curricula, Oracle master, Clarify real_want) and reference reader-edition output
[`36-sachin-reading-2026-10-28-reader-edition.md`](./36-sachin-reading-2026-10-28-reader-edition.md). This doc says how
a "comprehensive life reading" is assembled from nothing but the tabular JSON Radha serves, what the reading hierarchy
is, what data is still missing from the catalog, and how the pipeline maps onto the readers and the Oracle of doc 33.

## 1. What a comprehensive life reading has to answer

A reading is judged by whether it satisfies a non-technical reader or concerned relative who understands planets, houses,
signs, transits, and Dashas—not an astrologer auditing engine logs. The questions are always the same six, in this
order, and the reading is structured around them:

1. **What is wrong / what is promised** in this life (per area: self, money, work, home, marriage, children, parents,
   siblings, legal/adversaries, health, travel, learning, dharma). The promise is a plain-language verdict with a scale
   behind it, not a raw list of placements.
2. **Which planets and Dashas cause the current issue or withhold the promise**, named, with the mechanism (a weak lord,
   an obstructed bolt, a debilitated karaka, a period lord in a bad house from the mahadasha lord, or a slow transit
   compressing the house).
3. **How people and relationships factor in (who helps vs. who hurts)**, read through the planets in the native's chart
   (e.g. why Saturn-type partners delay and cost while Mercury/Mars-type partners profit; why Ketu in the 11th cuts kin
   favors while the 7th and 9th houses bring outside help).
4. **When and in which Dasha / planet / transit it improves**, by the period that owns it (mahadasha), the sub-period
   that delivers it (antardasha), the trigger (pratyantar and transit gate), with the recurrences (the cycle).
5. **To what level and with what probability**, stated as a graded confidence with its basis (how many independent
   layers agree) and what level of outcome to expect (e.g. steady salary vs. windfall accumulation, rented apartment vs.
   owned home).
6. **The solution: what helps and what to do on which dates** (practical actions first, dates to act vs. hold, and
   traditional planetary remedies tied to the chart's functional benefics and saving graces).

The reading must keep **human-readable planetary & Dasha synthesis** in the main body (Parts 1–4) and isolate **raw
mechanics and audit tables** (`Shadbala` numbers, `SAV` bindus, `Saham` formulas, 44-Dasha grids, and date-provenance
tags `stored/split/interpolated`) in **Part 5: Technical Appendix** so the reader never has to wade through engine
plumbing to find the cause, timing, and solution.

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
  → Synthesis (Oracle)      the five-part reader structure (§5); the probability grade with basis; the
                             saving graces; the dated calendar; the cycle table; the isolated technical appendix
  → Outputs                 the reading (Markdown → DOCX/PDF), the day calendar, the facts dossier used
```

Mapping to doc 33: the Facts normaliser is the dossier builder; the Promise engine is readers R1–R7 and R13 with a
scale output added; the Dasha engine is R8–R9 with the cross-system agreement step added; the Annual engine is R11;
the Transit and Daily engines are R10; the Synthesis is the Oracle (T11) with the five-part reader structure made
mandatory; Clarify's real_want decides which area leads.

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

Reference implementation: [`36-sachin-reading-2026-10-28-reader-edition.md`](./36-sachin-reading-2026-10-28-reader-edition.md).

A comprehensive reading is written for a **non-technical reader who understands planets, houses, signs, transits, and
Dashas**, never as four stitched passes or an engine audit log. It is organized into **five parts**:

1. **Part 1 — Executive Dashboard (At-a-Glance Summary):**
   - Immediate rule for the current sub-period (e.g., what not to decide during an active Rahu/retrograde window).
   - One master table across all active life areas with five columns:
     `Life Area | What Is Wrong Right Now (The Issue) | The Planetary & Dasha Cause | When & In Which Dasha / Planet It Improves | The Solution & Action Plan`
2. **Part 2 — The Root Cause Blueprint (Why Everything Felt Stuck at Once):**
   - Explains the chart's core architecture in plain planetary language: (a) where the Ascendant lord sits and what it
     depends on, (b) the dispositor floors (who holds whom, and which planet is the weakest link vs. the rock), (c) the
     running Mahadasha and its cancellation/rescue planet, and (d) why the recent Antardasha + slow transits compressed
     multiple houses simultaneously.
3. **Part 3 — Complete Life-Area Guides (One Self-Contained Section per Area):**
   - Every life area (Career & Business, Money/Savings/Home, Love & Marriage, Harassment/Legal, Family/Siblings/Parents,
     Health & Vitality) is consolidated into one place and follows the exact same five-step rhythm:
     1. **The Issue (What Is Wrong Right Now)**
     2. **The Planetary & Dasha Cause (Why It Happened)** — naming the planets, houses, signs, Vimshottari MD/AD/PD, and
        transits, while explaining key Jaimini or secondary Dasha indicators (*Upapada*, *Arudha Lagna*, *Hora/Indu
        Wealth Lagnas*, *Narayana*, *Dwisaptati*, *Yogini*) in plain English on first use.
     3. **People & Relationship Dynamics (Who Helps vs. Who Hurts)** — which planetary types (e.g. Saturn-type vs.
        Mercury/Mars-type partners; 11th-house Ketu kin vs. 7th/9th-house allies; Jupiter lawyer vs. Mars enforcement)
        help or drain the native.
     4. **When & In Which Dasha / Planet It Improves** — chronological table pairing each dated window with the active
        Dasha (MD–AD–PD + confirming secondary Dasha) and the planetary transit/annual trigger.
     5. **The Solution** — practical action steps, dates to act vs. hold, and traditional planetary remedies ordered by
        the chart's own benefics.
4. **Part 4 — Master Chronological Roadmap & Day-by-Day Calendar:**
   - Step-by-step restoration timeline across the next 12 months, the daily Good Days / Avoid Days calendar (graded by
     *Tara Bala* and *Chandra Bala* with weekday purpose), and the multi-year life charter across Mahadashas.
5. **Part 5 — Technical Appendix (Isolated at the End for Audit):**
   - All raw numbers (`Shadbala` ratios, `SAV` bindus, `Ishta/Kashta`, `Dig Bala`), divisional chart coordinates
     (`D2–D30`), Arudha padas, Annual *Varsha/Tithi Pravesha* Saham degrees, Prashna coordinates, the 44-Dasha
     convergence grid, and date provenance grades (`stored`, `split`, `interpolated`, `external`) live strictly in the
     Technical Appendix so they never clutter the human reading.

## 6. Phases

- **P-1 (now, docs only):** this doc; [`36-sachin-reading-2026-10-28-reader-edition.md`](./36-sachin-reading-2026-10-28-reader-edition.md);
  doc 35 by the deploy session; the Radha change list in §4 queued.
- **P-2 (Node, after the Radha changes):** the Facts normaliser and the Promise engine with scale output; unit tests on
  the Sachin and Archisha dossiers (expected verdicts fixed from the manual readings).
- **P-3:** the Dasha engine with cross-system agreement; the Annual, Transit and Daily engines; the day calendar.
- **P-4:** the Oracle template with the five-part reader structure; the confidence grade; DOCX output.
- **P-5:** evaluation against the manual readings ([`36-sachin-reading-2026-10-28-reader-edition.md`](./36-sachin-reading-2026-10-28-reader-edition.md)
  and parts 1–11 of the Sachin reading as the gold set), then the Archisha set.

All code on feature branches from develop, merged with --no-ff after tsc and the area's unit tests; no migration applied
and no deploy without Sachin's OK, per AGENTS.md.


---

## 7. Multi-School Predictive Synthesis, Immediate Cash Sensitivity & Non-Sycophantic Confirmation Rules

*(Added after the v2 revision of [`36-sachin-reading-2026-10-28-reader-edition.md`](./36-sachin-reading-2026-10-28-reader-edition.md); full data specification in [`../ASK-REQUIREMENTS.md`](../ASK-REQUIREMENTS.md).)*

Every comprehensive reading generated by the Oracle must enforce the following seven methodological laws:

1. **Four-Tradition Synthesis (Never Single-School):**
   - Combine **Maharishi Parashara (BPHS)** (houses, functional nature, Dhana/Raja/Viparita yogas, Shadbala, Avasthas, D1–D60 vargas), **Jaimini / Pt. Sanjay Rath** (`AL`, `UL`, `A2`..`A11`, `HL`, `IL`, `GL`, `Argala / Virodhargala`, Chara Karakas, Narayana & Sudasa rasi dashas), **Lunar Astro / Deepanshu Giri** (pending karma in Saturn/Ketu stars, dispositor chains & closed loops, 64th Navamsa, 22nd Drekkana, Bhrigu Bindu, and "Blind Saturnian Actions"), and **Tajaka Annual Charts** (*Varsha Pravesha* sahams, *Patyayini*, and *Tithi Pravesha*).
2. **Primary Individual Dasha Hierarchy (Elevate Applicable Conditional Dashas):**
   - Never treat *Vimshottari Dasha* as a solo timing system. Whenever a conditional nakshatra dasha applies (e.g., **Dwisaptati Sama Dasha** when the Lagna lord sits in the 7th house or the 7th lord sits in the 1st), it is a **Primary Individual Dasha** right beside **Narayana Dasha**, **Tithi Ashtottari / Annual Patyayini Dasha**, **Sudasa**, **Yogini**, and **Vimshottari**.
3. **Planetary Avasthas, Proximity/Combustion & "How the Fruit Tastes":**
   - Always evaluate each planet's **Baladi Avastha** (*Bala, Kumara, Yuva, Vriddha, Mrita*), **Jagradadi / Deeptadi / Lajjitadi Avasthas**, **Dig Bala**, and **solar/malefic conjunction orbs in D1 and D9** to tell the reader not just *when* a period runs, but **whether the fruit is unripe/dormant (*Mrita* solo), sour/scorched (tight Sun/Mars conjunction on a debilitated planet in D9), bitter (uncontracted 6th/8th lord), or sweet and ripe (*Vriddha / Yuva* with benefic transit/dispositor activation)**.
4. **Non-Sycophantic 3-Method Confirmation Rule:**
   - Never pander to the user's wish, and never dismiss their goal without exhausting the chart. Test every question against **3 or more independent methods** (multi-dasha stack + house/aspect promise + Avastha/dignity + Arudha/Argala + transits/annual sahams). Where 3+ methods say "not in this form right now, but yes in this form," clearly distinguish what works immediately vs. what belongs to a later window.
5. **Mandatory "Else What Will Happen?" & "How/When Preparation Is Used" for Every Warning:**
   - Whenever the reading tells a user to hold or avoid an action during a dangerous window (e.g., "Do not quit, sign contracts, or act on sudden attractions before Date X") or to spend a window preparing, it must explicitly state:
     - **Else What Will Happen:** The exact astrological and real-world loss if the rule is broken (e.g., forfeiting a *Viparita Raja Yoga*, signing under a retrograde 7th/8th lord in debility, or triggering an *Ashlesha* 5th-house drain).
     - **What We See Now & How/When Preparation Is Used:** Why the current retrograde/8th-house window favors internal excavation (logs, audits, portfolio, past contacts) and the **exact dates** when each prepared asset gets deployed.
6. **Common-Sense Humanity on Money (Never Put Relief 2 Years Out):**
   - When a native needs cash flow, **never tell them to wait 1–2 years.** Always construct an **Immediate Cash Relief Ladder** starting **within the same month (30 days)**, then **3 months, 6 months, 9 months, 12 months, and 1–5 years**, including:
     - **Exact Days Within 1–3 Months When Money Is Visible/Movable in the Bank** (using transit Moon in 2nd/6th/10th/11th + *Sampat/Kshema/Sadhana* Tara Bala + fast-planet contacts on `HL`, `IL`, `A2`, `A8`, and `Laabha/Artha` sahams).
     - **All Money Channels Compared:** (a) 6th-house salaried/contract service on `HL/IL`, (b) **Other People's Money (OPM)** via `A2+A8`, 8th-lord on `HL/IL`, retainers, float, and partner capital, (c) **Wealth of Inheritance** (honest SAV/karaka assessment), (d) **Entrepreneurship / Company building (1–5 years)**, (e) **Lifestyle, going out with friends, home shopping/redecorating, and big-ticket items**, and (f) **Systematic Stock/Index/Retirement Investing (D2 Lagna) vs. Speculation/Gambling (D1/D2 5th house)**.
7. **Foretold Money Leaks & Lunar Astro "Blind Saturnian Actions":**
   - Explicitly warn of upcoming eclipses or stationary malefic transits that could steal money, and prescribe the chart's specific **Blind Saturnian Actions** (thankless, clockwork daily/weekly actions done without immediate reward that clear 6th/8th/12th pending karma so the 11th house and Indu Lagna pay out over the next 6–12 months).
