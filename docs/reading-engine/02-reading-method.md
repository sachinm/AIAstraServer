# 02 — The reading method

This is the algorithm. The Python engine computes the inputs (file 03), the specialists apply the steps (file 04), the synthesizer applies the convergence rule and the format. If a rule here cannot be checked against a computed fact it does not belong in the engine.

Tradition: integrated Parashari + Jaimini as taught by PVR Narasimha Rao (Vedic Astrology: An Integrated Approach), which is what pyjhora implements. Whole-sign houses from Lagna for the main judgement; Sripati bhava madhya kept for cusp proximity flags only. Lahiri ayanamsa. Vimshottari from Moon. Narayana dasa (Jaimini) for the sign-level timeline.

## Step 0 — Frame the question

The intake step maps the question to one or more **subjects**, a **horizon** and a **question type**. Each subject has a fixed frame. This table is the contract between intake and the evidence-pack selector; adding a subject means adding a row, nothing else.

| Subject | Houses (from Lagna) | Also judge from | Karakas (natural) | Chara karaka | Varga | Arudha / special | Not in scope now |
|---|---|---|---|---|---|---|---|
| career_work | 10, 6 (service), 1 | Moon, AL (A1) | Sun (authority), Saturn (work), Mercury (trade), Jupiter (counsel) | AmK | **D-10** | A10, Ghati Lagna (power), Hora Lagna | — |
| income_wealth | 2, 11, 9 (fortune), 5 (speculative gains) | Moon, AL | Jupiter (wealth), Venus (comforts), Mercury (trade) | AmK, DK for partnerships | **D-2** (Hora) | A2, A11, Indu Lagna, Sree Lagna | — |
| debt_loss_expense | 6, 8, 12 | — | Saturn, Rahu, Ketu | — | D-2 | A6, A8 | — |
| property_home | 4, (2), 11 | Moon (4th from Moon) | Mars (land, karaka of 4th), Venus (home comfort), Moon | MK (mother/home) | **D-4** | A4 | — |
| vehicles | 4 | — | Venus | — | D-4 (D-16 when added) | A4 | D-16 |
| marriage_relationship | 7, 2 (family), 11 (friends), 12 (bed) | Venus, Moon | Venus (for all; wife), Jupiter (husband) | DK | **D-9** | UL (A12), A7, Darapada | D-9 only |
| children | 5, 9 (5th from 5th) | Jupiter | Jupiter | PK | **D-7** | A5 | — |
| health_body | 1, 6, 8 | Moon (mind), Sun (vitality) | Sun, Moon, Lagna lord | AK (soul), GK (illness) | D-30 (Trimsamsa) when added; D-1 now | A6, A8, Maandi/Gulika | D-30 marked "add when needed" |
| education_learning | 4, 5, 2 (speech), 9 | Mercury, Jupiter | Mercury (intellect), Jupiter (wisdom) | — | D-24 when added; D-1 now | A4, A5 | D-24 |
| spirituality_moksha | 9, 12, 8, 5 | Ketu, Jupiter | Ketu, Jupiter, Saturn | AK | D-20 when added; D-9 now | A9, A12, AK in D-9 (Karakamsa) | D-20 |
| foreign_relocation | 12, 9, 7, 4 (leaving home) | — | Rahu, Moon, Saturn | — | D-4, D-10 | A12, A4 | — |
| litigation_government | 6, 10, 8 | — | Mars, Saturn, Sun (government) | — | D-10 | A6 | — |
| speculation_lottery | 5, 11, 2 | — | Rahu, Jupiter, Venus | — | D-2 | A5, A11 | **Answer as gain windows, never a win prediction** |
| general_life_direction | 1, 9, 10 | Moon | Lagna lord, AK | AK, AmK | D-9, D-10 | AL, Karakamsa | — |
| explain_term | — | — | — | — | — | — | Educational answer, chart used only as example |

Horizon values: `now` (this month), `3m`, `6m`, `1y`, `3y`, `life`, or an explicit date range. Question types: `timing` ("when"), `yes_no` ("will I"), `why_meaning` ("what does X mean", "why is this happening"), `compare` ("A or B"), `describe` ("what does my D-10 say"), `explain_term`.

## Step 1 — Promise (static potential)

Goal: decide whether the chart promises the result at all, and how strongly. Done once per subject, from the dossier.

For each house `H` in the subject frame, read these facts (fact ids in file 03):

1. **House lord**: sign, house placed in (from Lagna), dignity (exalted / moolatrikona / own / friend / neutral / enemy / debilitated), combust, retrograde, and whether it sits in a kendra/trikona (strong), upachaya (grows with time), dusthana 6/8/12 (obstructed) or maraka 2/7 (for health only).
2. **Occupants** of H: natural benefic/malefic, functional benefic/malefic for this lagna, dignity.
3. **Aspects on H and on its lord**: graha drishti (Parashari, with the special aspects of Mars 4/8, Jupiter 5/9, Saturn 3/10) and rasi drishti (Jaimini, for the arudha/Narayana layer). Benefic aspect strengthens, malefic afflicts; aspects of the house lord on its own house protect.
4. **Argala** on H (primary 2, 4, 11; secondary 5; obstruction from 12, 10, 3, 9) for whether the result is helped or blocked by neighbouring houses.
5. **Karakas**: natural karaka dignity and house; chara karaka (e.g. AmK for career) sign and house in D-1 and in the varga.
6. **Varga confirmation**: in the subject varga, (a) the varga lagna and its lord, (b) house H in the varga, (c) where the D-1 lord of H lands in the varga (own/exalted/kendra = promise confirmed; 6/8/12 or debilitated = promise diluted), (d) planets in the varga lagna and 10th (for D-10) or 7th (for D-9). The rule the model must obey: **the varga refines, it does not replace D-1**. D-1 promises, the varga says in what form and how robustly.
7. **Arudha**: AL and the subject arudha (A10, A2, A4, UL...). Planets in or aspecting (rasi drishti) the arudha and its 2nd/11th show the perceived/material result; 12th from arudha shows loss of it.
8. **Yogas** touching H or its lord: dhana (2/5/9/11 lords), raja (kendra–trikona lords), viparita raja (6/8/12 lords in 6/8/12), neecha bhanga, parivartana, Gaja Kesari, Panch Mahapurusha, Kemadruma; doshas that affect the subject (Manglik for marriage, Kala Sarpa generally). pyjhora already names these; the dossier carries the list with the houses involved.
9. **Strength**: shadbala rupas and rank of the lord and karaka; ishta/kashta phala; ashtakavarga bindus of H in SAV (≥ 28 strong, ≤ 22 weak) and of the lord in its BAV at its sign (≥ 4 good).

Output of the promise step: `promise_level ∈ {strong, moderate, weak, denied}`, the three to five decisive facts (by id), the form the result tends to take (from the varga), and the main affliction if any.

## Step 2 — Timing (dasha)

Goal: within the horizon, name the periods that can deliver the promised result and the ones that obstruct it.

For Vimshottari (MD / AD / PD), using the dossier's dated list with `current` flags:

1. For each period lord `P` active in the horizon: houses P owns, house P sits in, dignity, P in the subject varga, P's nakshatra lord (the star-lord flavours the result: a planet gives the results of the houses its star-lord signifies — this is the single most useful nakshatra rule and it is computable), P's relation to H and to H's lord (conjunct / aspecting / exchanged / in kendra-trikona from it / in 6-8-12 from it).
2. Classify P for this subject: `deliverer` (owns or occupies H / 11th / 2nd / 9th for the subject, or is the karaka, or is in the subject varga's lagna/10th in dignity), `supporter` (benefic connection), `neutral`, `obstructor` (6/8/12 lord or placed there relative to H, or afflicting karaka).
3. AD relative to MD: AD lord in 6/8/12 from MD lord → friction inside the period; in kendra/trikona → smooth.
4. Narayana dasa: the running sign, its lord(s) (both for Scorpio/Aquarius), planets in and aspecting (rasi drishti) the sign, the sign's position from AL and from the subject arudha. Used for direction of life and for confirming or contradicting the Vimshottari verdict, never alone.
5. Produce **dasha windows**: `[start, end, MD-AD-PD, verdict for subject, reason ids]` for the whole horizon, PD-level for horizons ≤ 1y, AD-level otherwise.

## Step 3 — Triggers (gochara / transits)

Goal: inside the favourable dasha windows, find the transit events that fire the result. Transits do not create what the chart and dasha do not promise.

From the dossier transit table (computed daily, with ingress dates for the horizon):

1. **Saturn** by sign from Lagna and from Moon (sade sati / dhaiyya status; 3, 6, 11 from Moon favourable; 1, 2, 4, 5, 7, 8, 9, 10, 12 testing), and over natal points (natal lord of H, karaka, H itself, AL). Saturn delays and then delivers in upachaya.
2. **Jupiter** by sign from Lagna and Moon (2, 5, 7, 9, 11 from Moon favourable) and over H, H's lord, karaka, AL and the subject arudha.
3. **Double transit**: when Saturn and Jupiter together influence (occupy or aspect) H or its lord within the window, the event is strongly indicated. This is the primary event-timing test; the reconciler computes it from the table.
4. **Rahu / Ketu**: sign and nakshatra, over natal planets. The specific case Sachin raised, **Ketu transiting natal Jupiter**: Ketu in the same sign as natal Jupiter (and more sharply, the same nakshatra, or within ~3° by longitude) → Jupiter significations (wealth, counsel, children, dharma, the houses Jupiter owns and the house it sits in) go through detachment, sudden loss of structure, disillusionment with teachers/advisers, then insight; financial over-optimism is punished; good for research and spiritual depth. Duration and exact window come from Ketu's longitude path in the table. Rahu simultaneously opposite (over the 7th from natal Jupiter) is read together.
5. **Nakshatra-level transits**: a slow planet entering the nakshatra of a natal planet or of a dasha lord gives week-level timing; the dossier carries nakshatra ingress dates for Saturn, Jupiter, Rahu/Ketu and Mars.
6. **Ashtakavarga check** of the transited sign: BAV bindus of the transiting planet in that sign (≥ 4 delivers), SAV of the sign.
7. **Fast planets** (Sun, Mars, Venus, Mercury) and new/full moons are used only to narrow a month inside an already-selected window, never to define the window.
8. **Vedha** (Phaladeepika obstruction points) and eclipses: phase 4, after the base method is proven.

Output: **transit windows** `[start, end, planet, event (ingress / over natal X / double-transit on H), polarity, reason ids]`.

## Step 4 — Nakshatra layers (the "eight ways")

The nakshatra analyst reads the same question through the lunar-mansion lens. Each layer is computable and is in the dossier.

1. **Janma nakshatra** (Moon): nakshatra, pada, lord, deity/symbol/gana/nature from the reference table; Moon's star-lord placement. This is temperament and the lens on everything else.
2. **Lagna nakshatra** and its lord: how the person acts in the world.
3. **Each key planet's nakshatra and star-lord** for the subject (lords of H, karaka, dasha lords): the planet acts through its star-lord's houses. Dispositor chain: planet → star-lord → star-lord's sign-lord.
4. **Dasha-lord nakshatra**: the MD and AD lords' nakshatras and their lords give the "colour" of the period.
5. **Tara bala**: the nine taras counted from janma nakshatra (Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-mitra) applied to (a) the nakshatra of the current dasha lord, (b) the current transit nakshatra of Moon/Saturn/Jupiter/Ketu, (c) the nakshatra of the day for short-horizon questions. Favourable: Sampat, Kshema, Sadhaka, Mitra, Ati-mitra.
6. **Pada → navamsa**: the pada places the planet in a navamsa sign; read the planet's D-9 sign and lord as the inner outcome of that placement.
7. **Transit nakshatra vs natal nakshatra**: which natal planets are being "walked over" by nakshatra, with dates (from the transit table). Same-nakshatra return of a slow planet to a natal planet is the sharpest trigger in the method.
8. **Arudha Lagna and 10th-cusp nakshatra**: public image and career expression.

Flags: gandanta (last 3°20′ of Cancer/Scorpio/Pisces, first of Leo/Sagittarius/Aries) for Moon/Lagna; pushkara navamsa/bhaga; nakshatra of Rahu/Ketu axis.

## Step 5 — Synthesis (convergence)

The synthesizer receives only findings (claims with evidence ids, windows, caveats) and writes the answer. Rules it must apply, and that the reconciler enforces mechanically where possible:

1. **Three-layer convergence**: likely when promise ≥ moderate AND a deliverer dasha window AND a confirming transit overlap; possible when two agree; unlikely when promise is weak/denied regardless of dasha and transit; state which layer disagrees.
2. **Windows are intersections**: dasha window ∩ transit window, cut at ingress and PD boundaries; express as `Mon YYYY – Mon YYYY` with the trigger named. Never invent dates outside the dossier.
3. **Confidence vocabulary** is fixed: `strong indication`, `moderate indication`, `weak / possible`, `not indicated`. No percentages.
4. **No invented facts**: every placement, lordship, aspect, dasha or transit sentence carries an evidence id in the structured output; the prose shows the fact (e.g. "your 10th lord Mercury sits in the 9th in Taurus") but the id is kept in the run log. The grounding checker (file 07) verifies prose assertions against the dossier.
5. **Honesty rules**: data gaps are named (e.g. "D-30 is not in your chart data, so the health layer is from D-1 only"); speculation and lottery questions get the gain-window answer with the caveat; no dollar amounts; no remedies; no medical or legal advice beyond the astrological indication.
6. **Scope discipline**: answer the subject(s) asked; one short line if another subject is strongly triggered in the same windows, no lectures.

## Step 6 — Presentation formats

Intake picks one; the synthesizer obeys. All begin with a 2–5 sentence direct answer.

| Format | When | Shape |
|---|---|---|
| `direct` | yes_no, short why | Direct answer, then 3–6 bullets of evidence, then one-line outlook |
| `timeline` | timing questions | Direct answer, table `Window | Dasha (MD-AD-PD) | Transit trigger | Indication | Watch for`, then a short "how to read this" paragraph |
| `factor_table` | compare, describe | Direct answer, table `Factor | Placement | Strength | Effect on question`, then interpretation |
| `narrative` | why_meaning, general_life_direction, nakshatra deep dive | Sectioned prose: What is happening (chart) → Why now (dasha) → Trigger (transit) → Nakshatra view → What to expect |
| `watchlist` | now / 3m horizons | Direct answer, numbered list of dated checkpoints with the sign to look for |

Markdown rules from `chatOracleMarkdownAppendix.ts` apply (headings, blank lines, tables with header rows, no invented images).

## Step 7 — Conversation behaviour

- **Clarify card** (when enabled or when intent confidence < 0.8 or more than two subjects): "I read this as: subject(s) X over horizon Y. I will look at … Shall I?" with chips to switch subject/horizon and a confirm button. One question at a time when several are asked; the others are queued as follow-up chips.
- **Follow-ups in the same chat** reuse the intent unless the question changes subject; the last two turns (question + answer summary) are passed to intake only, not to the specialists.
- **Educational questions** ("what does Ketu over Jupiter mean in general?") are answered in `narrative` with the person's own placement as the worked example, clearly separated from the general meaning.
