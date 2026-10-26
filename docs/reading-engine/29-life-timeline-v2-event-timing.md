# 29 — Life timeline v2: timing events, not describing months

Status: method rewrite, 2026-10-26 (Fable), planning only. Replaces doc 27 §A.3, §A.4, §A.6 bands, §A.7 step 4 and §B.5;
everything else in doc 27 (foundation, markers, ledger, data, pipeline shape, phases P2–P5) stands. Written after the P1
build on branch `feature/timeline-p1` (commit fded952) and its measurements on the G1 golden chart. No code changed here.

**The verdict.** Doc 27 v1 asks every timing system "which houses does the running lord touch?" and sums the answers. On
a real chart the answer is "most of them, all the time": every planet activates 9–11 of the 11 markers, five or six
planets run in a typical month, so every marker is High in 217 of 217 past months and the blind cast cannot beat a random
guess. The rule describes the chart; it does not time anything. Version 2 is built the other way round, from the
question "what do practitioners actually use to say *when*?": a dasha lord that *specifically* signifies the matter,
a slow-planet **trigger** on that matter in the same window, and a period **edge**. Those three gates, scored relative to
the chart's own history, ranked rather than thresholded, and weighted by a trust prior that the ledger then adjusts per
chart. Below: the evidence (§1), the techniques and their priors (§2), the v2 rules (§3), the bands (§4), how we know it
works (§5), and what changes in code, doc 27 and the phase order (§6–§7).

---

## 1. Why v1 saturates (measured on G1, 2008-10 … 2026-10, 217 months)

| Measurement | Value | What it means |
|---|---|---|
| Markers each planet activates under the §A.3 rule (owns/occupies a frame house, karaka, star lord, arudha) | Su 10, Mo 11, Ma 11, Me 10, Ju 11, Ve 11, Sa 11, Ra 9, Ke 10 of 11 | The rule is not specific: a running lord says "everything" |
| Distinct planets running per month (MD+AD over S1–S4) | 4: 26 mo, 5: 75, 6: 95, 7: 19, 8: 2 | Five or six of nine planets are "active" at any time |
| Support score per marker, p10 → p90 | e.g. money 11 → 18.5, career 8.5 → 15.5; CV 0.18–0.24 | Scores never fall below the High bar (7) and barely vary |
| Months with ≥ 1 AD/PD start (S1–S4) | 78 of 217 (36 %) | Edges are the sparse, informative signal we are not using |
| S1 and S3 running the same AD lord | 17 of 217 | The conditional dashas are not copies of Vimshottari; fine to keep as confirmers |
| Radha `argala.obstructed_by` per house | house 1: 7 planets, 7: 6, 10: 5, 12: 7 | S7 as written fires on every lord; it is a modifier at best |
| Months with ≥ 1 `transit_contacts` activation | 132 of 217 (61 %) | Contacts are sparse enough to discriminate; v1 weights them lowest |

Two tightenings were tried as config knobs (secondary frame houses at strength 1; MD lords excluded). Together they still
leave 65–99 % of months Moderate-or-High. The problem is the *shape* of the rule, not its constants.

## 2. What times events in practice, and the trust prior

There is no published evidence that any technique predicts life events; what exists is a long practitioner consensus on
which techniques are used **for timing** (as opposed to for describing promise), and that consensus is consistent across
the Parashari, Jaimini, Tajaka and KP schools. The table ranks the techniques by how central they are to event timing in
that practice. The number is a **prior weight**: the starting trust, which the ledger then raises or lowers per chart
(§5). It is not a claim of accuracy.

| Rank | Technique (system id) | What it says about *when* | Prior weight | Role in v2 |
|---|---|---|---|---|
| 1 | **Vimshottari MD + AD both connected to the matter** (S1) — the lords of the running MD *and* AD each own, occupy or are karaka of the primary house, or are its lord's dispositor; stronger when PD agrees | The backbone of Parashari timing: "the event comes in the dasha-bhukti of the lords connected to the house" | 3.0 | Gate D (period) |
| 2 | **Double transit** (S6-DT) — Jupiter *and* Saturn both transiting or aspecting (rasi drishti) the primary house or its lord in the same window | K.N. Rao's trigger; widely treated as near-necessary for marriage, child, job, property | 3.0 | Gate T (trigger) |
| 3 | **Jupiter / Saturn / nodes on the frame point** (S6-C) — a slow planet within orb of the primary house lord, the karaka, the Moon or the lagna (`transit_contacts`), a station in orb, the nodes' axis over the frame axis | The classical "trigger within the dasha"; Jupiter gives, Saturn delivers with delay or tests, nodes unsettle | 2.0 | Gate T |
| 4 | **Narayana / Chara dasha sign holding the arudha** (S4) — the running rasi holds the marker's arudha (UL for marriage, A10/A7 for work and business, A4 for home) or is the primary house or its lord's sign | Jaimini's own timing; the second school's answer, independent of nakshatra dashas | 2.0 | Gate D (Jaimini family) |
| 5 | **Period edge** (all dashas) — the month an AD or PD begins, or a Narayana sign changes | Practice times events to the *change* of lord, not the middle of a three-year bhukti | ×1.5 on D in that month, ×1.25 the month after | Gate E |
| 6 | **Annual chart** (S5, P2) — Tithi Pravesha lagna's natal house, year lord, muntha, sahams with a strong lord | Tajaka's year-level narrowing; good at "which year", weak at "which month" until the Mudda dasha | 2.0 (year), 1.0 (Mudda month) | Gate D (annual family) |
| 7 | **Yogini, Tithi Ashtottari** (S2, S3) | Confirmers: used when they agree with Vimshottari; rarely the sole basis | 1.0 each; S3 0.5 when `dasha.applicable` says no | Gate D (confirmers only; they cannot open a window alone) |
| 8 | **Star lord of the period lord** (KP rule) | KP times by the sub-lord; in a Parashari frame it is a tie-breaker | +0.5 modifier on an existing D activation | modifier |
| 9 | **Ashtakavarga of the transited sign** | BAV ≥ 4 / SAV ≥ 28 the transit delivers; ≤ 2 / ≤ 22 it fails | ±0.5 on T | modifier |
| 10 | **Argala / Jaimini aspect of the running lord on the arudha** (S7) | Real but non-selective as Radha lists it (§1) | ±0.5, only when the same lord already passes Gate D | modifier |

Three things follow from the table. **(a)** Weight goes to *specific connection* and to *triggers*, not to the count of
systems. **(b)** Two of the top three are transit rules, and doc 27 v1 weighted transits lowest (1.5) and could only see
±2° contacts: the range export (R-T1) stops being a P2 nicety and becomes the prerequisite for the method (§7).
**(c)** The conditional dashas and the Jaimini modifiers are demoted to what they are in practice: confirmation.

## 3. The v2 rules (deterministic, on read fields, every activation cites its path)

### 3.1 Signification is scarce: each planet signifies few markers

Before any window is scored, build once per chart the **signification table** `sig[planet][marker] ∈ {0, 1, 2, 3}`:

- 3: the planet **lords the primary house** (`houses.<h1>.lord`) or is the marker's **natural karaka in dignity**
  (`karakas.natural`, `bodies.<P>.dignity` ∈ exalted/own/moolatrikona) or the **chara karaka** named in the frame.
- 2: it **occupies the primary house** (`bodies.<P>.house`), is the natural karaka not in dignity, or is the **dispositor
  of the primary lord** (`bodies.<lord>.sign_lord`).
- 1: it lords or occupies a **secondary** frame house, or sits on the marker's arudha (`arudhas.<k>.house`).
- 0: anything else — including star-lord-only and aspect-only links, which become modifiers (§2 rows 8, 10), not
  significations.

Then **cap**: a planet keeps its three highest markers (ties broken by the primary-house rule first, then natural
karaka); the rest are set to 0. On G1 this takes the planet → marker table from 9–11 markers per planet to ≤ 3. This one
rule removes most of the saturation; everything below assumes it.

Adverse signification `adv[planet][marker]` is the same table on the marker's adverse houses (money: 6/8/12; every
marker: a lord in a dusthana or debilitated signifies adversely for the markers it owns), capped the same way.

### 3.2 Gate D — the period: lords that signify, counted once

For each month and marker, over the running lords of the dasha family (S1 at MD/AD/PD; S2, S3; S4 by the sign's lord
and the sign itself):

- `D1 = sig[AD lord][marker]` (Vimshottari AD), `D1 += 1` when `sig[MD lord][marker] ≥ 2` (both lords connected), `D1 += 1`
  when the PD lord also signifies (PD only where Radha serves it). D1 ∈ 0…5. A PD running in a 6/8/12 house from its AD
  lord, or an AD in 6/8/12 from its MD lord, lowers D1 by 1.
- `D4` (Narayana): 3 when the running sign holds the marker's arudha or special lagna, 2 when it is the primary house or
  its lord's sign, 1 when its lord signifies the marker (`sig ≥ 2`); the MD sign counts only when no AD sign runs.
- `D2, D3` (Yogini, Tithi Ashtottari): `sig[period lord][marker]`, but they **cannot open a window**: they count only in a
  month where D1 ≥ 2 or D4 ≥ 2, as confirmers.
- **One planet, one vote**: if the same planet is the running lord in two graha dashas in the month, it is counted once
  (in the system with the higher prior). Five planets running the same lord is one piece of evidence, not five.
- `D = w1·D1 + w4·D4 + w2·D2 + w3·D3` with the priors of §2 (w1 3.0, w4 2.0, w2 1.0, w3 1.0 or 0.5).

### 3.3 Gate T — the trigger: a slow planet on the matter

From the range export (R-T1: Jupiter, Saturn, Rahu/Ketu sign positions, stations, ingresses per month over the 36 years)
and `transit_contacts`:

- `T_dt = 3` when Jupiter and Saturn **both** transit or rasi-aspect the primary house or its lord's sign in the month
  (double transit); 2 when one of them does **and** the other aspects a secondary frame house; else 0.
- `T_c = 2` for an exact contact (`transit_contacts.exact` in the month) of Jupiter/Saturn/Rahu/Ketu on the primary lord,
  the karaka, the Moon or the lagna; 1.5 while in orb; +0.5 for a station in orb; 1.5 for the nodes' axis crossing the
  primary house axis in the month.
- Polarity: Jupiter supports; Saturn tests-or-delivers (support when Saturn signifies the marker in `sig`, test otherwise);
  Rahu/Ketu test, except Rahu on a foreign/residence marker supports.
- Ashtakavarga modifier ±0.5 on `T` (`ashtakavarga.sav[sign]`, `bav[planet][sign]`).
- `T = w_dt·T_dt + w_c·max(T_c)` (priors 3.0 and 2.0). **Until R-T1 lands**, `T_dt` is approximated from
  `transit_contacts` only (Jupiter and Saturn both within 2° of the primary lord or house cusp in the same month) and
  the honesty line says so; this is what the re-run on G1 in §6 uses.

### 3.4 Gate E — the edge

`E = 1.5` in the month an AD/PD starts (any dasha whose lord signifies the marker, `sig ≥ 2`) or a Narayana sign changes
to one that scores D4 ≥ 2; `E = 1.25` the month after; else `E = 1`. Edges are where practice places events (§1: 36 % of
months have one, so this is selective).

### 3.5 The score

```
support(marker, month) = E × ( D_support + T_support )      when D_support > 0 and T_support > 0
                       = E × D_support × 0.5                  when no trigger (period alone)
                       = T_support × 0.5                      when no signifying lord runs (trigger alone)
test(marker, month)    = same with the adverse sides
```

A month with a signifying period **and** a trigger scores at least twice a month with either alone: this is the
"promise × period × trigger" rule of every school, written as arithmetic. Annual (S5) joins `D` at P2 with its prior;
the S7 and star-lord modifiers add ±0.5 to `D` only where the same lord already signifies.

### 3.6 Promise (natal) as a prior, not a gate — P3

Whether the matter is *promised* at all (7th lord strength, D9, UL for marriage; 5th/Jupiter/D7 for children …) scales
the whole marker's scores by 0.5–1.5. It is a natal reading and belongs with the annotation phase; the past-grid
calibration does not need it (the ledger already tells us what happened), the future grid does.

## 4. Bands: relative to the chart, ranked, and honest about density

- The grid is **ranked** per marker over the full 36 years (past and future share one distribution, so the future is
  banded against the chart's own history, not against an absolute number).
- **High** = top 8 % of the marker's months **and** `T_support > 0` **and** at least two families agree (dasha family
  S1–S4, transit family, annual family; the conditional dashas and modifiers never make a family on their own).
- **Moderate** = top 20 %, any composition with D > 0.
- **Possible** = top 35 % (drill-down only). **Quiet** = the rest; collapsed strips as in doc 27 §A.6.
- **Testing**: the same percentiles on the `test` score; shown with the testing tag when it out-ranks the support band.
- Percentile bands fix the density (≈ 8 % High, 20 % Moderate per marker), so the random baseline is the same for every
  chart and every technique and **lift is comparable** across people. The honesty line for a window states the band's
  density ("this is one of this chart's 8 % strongest months for work").
- Agent and channel as in doc 27 §B.5, taken from the `sig` table (highest `sig × prior`), ties by shadbala rank.

## 5. Knowing whether it works — the evaluation is threshold-free

Calibration in v1 measured precision at a fixed threshold; at 100 % density it measured nothing. v2 measures the ranking:

1. **Mean percentile of event months** per marker and per technique: where do the ledger's real months sit in that
   technique's own ranking of the 36 years? 0.5 = random; the technique is useful when it is clearly above.
2. **Lift at fixed density** (8 %, 20 %, 35 %): hit rate ÷ density, for each technique alone and for the combined score,
   with ±1 month tolerance. This is doc 27's "random monthly baseline", now meaningful because density is fixed.
3. **Per-technique weight update with shrinkage**: `w = prior × clamp(0.5 + lift_at_20% / 2, 0.5, 1.5)`, shrunk toward
   the prior by `n / (n + 5)` where n is the number of ledger events of that marker. Ten events move a weight; one does
   not. This replaces doc 27 §A.7 step 4 and keeps its floor and ceiling.
4. **Chart-swap check** (needs real ledgers): run the person's ledger against ten other charts; the method carries
   information only if the right chart's lift beats the swapped charts' median. This is the honest test that the timeline
   is reading *this* chart and not the calendar.
5. **No tuning on the made-up ledger.** The G1 ledger is invented; the re-run in §6 checks that the machinery is selective
   (density, variance, families), not that it is right. The first real numbers come from Sachin's chart and the panel
   charts once P0 has their ledgers.

## 6. What changes in the P1 code (`src/reading/timeline/`)

| File | Change |
|---|---|
| `foundation.ts` | add `signification(f)`: the `sig` / `adv` tables of §3.1 with the cap and evidence paths |
| `activate/graha.ts` | replace the house-touch rule by `sig` lookup; MD+AD connection; one-planet-one-vote across S1–S3; S2/S3 flagged `confirmer` |
| `activate/narayana.ts` | D4 as in §3.2 (arudha in sign = 3) |
| `activate/transits.ts` | `T_c` as in §3.3; add `activate/doubleTransit.ts` (interim from contacts; R-T1 later) |
| `activate/jaimini.ts` | modifier only, gated on `sig ≥ 2` of the same lord |
| `converge.ts` | gates D/T/E, the score of §3.5, family-level independence, percentile bands over the 36-year distribution |
| `calibrate.ts` | mean-percentile, lift at fixed density, shrinkage update; chart-swap harness (fixture-only until real ledgers) |
| `config.ts` | priors of §2 as the default weights; band percentiles; `TIMELINE_WEIGHTS` keeps overriding |
| tests | one test per gate on G1 with a hand-checked month; a density test (High ≈ 8 % per marker); the chart-swap harness on G1 vs the legacy fixtures |

Expected on G1 after the change (machinery check, not accuracy): High ≈ 17 months per marker, variance up (CV > 0.5),
every High month carries a trigger, and the made-up ledger's lift lands wherever it lands — reported, not tuned.

## 7. Phase order, revised

1. **P0 — ledger** (unchanged scope, now first in time): Sachin's own chart and the two panel charts with ≥ 20 dated
   events each are the only way to get real numbers. Starts now, in parallel with everything below; no dependency.
2. **P1b — v2 rules in the P1 code** (§6), re-run on G1 for the machinery check, then on the P0 ledgers for the first real
   lift table. Blocks P3/P4.
3. **R-T1 — Radha `transit_range`** moves up from P2 to run alongside P1b: the double-transit trigger (prior 3.0) needs
   Jupiter/Saturn/node sign positions per month over 36 years, which `transit_contacts` (±2° to natal points) cannot
   give. Same scope as doc 27 §B.3: ingresses, stations, lunations, eclipses, Sade Sati phases, nodes' sign changes.
4. **P2 — annual layer** (S5) once R-T1 is in; recalibrate.
5. **P3, P4, P5** as in doc 27, with the promise prior (§3.6) added to P3.

## 8. Open points for Sachin

1. The cap of three markers per planet (§3.1) is the strongest single assumption; two or four are defensible. Three is the
   recommendation; the ledger will show if it is too tight (recall falls) or too loose (lift falls).
2. Whether Saturn's transit on a signified matter is support or test is school-dependent; §3.3 takes "support when Saturn
   signifies the marker, test otherwise". Alternative: always test, with delivery at the exit.
3. Chara dasha (K.N. Rao's school) is served by Radha and is the more common Jaimini timing dasha than Narayana; adding it
   as S4b at the same prior is cheap once the arudha rule exists. Recommended for P1b if Sachin agrees.
4. Band densities (8 / 20 / 35 %) are a product choice as much as a method one: fewer High windows read as more
   confident. They can be tuned per marker later (marriage is rarer than a job change).

## 9. P1b built — results on G1 (2026-10-26, machinery check only)

Built on `feature/timeline-p1` as specified in §6, with two deviations: the signification table lives in its own
`signification.ts`, and the cap's tie-break adds **scarcity** (a planet's place goes to the marker with the fewest other
strong significators). Without it G1's Jupiter, lord of the 4th and 7th, is primary for five markers and education is
left with no significator at all. The 36-year ranking is the past 18 years only until P4 builds the future grid.

| | v1 (doc 27) | v2 (this doc) |
|---|---|---|
| Markers a planet signifies | 9–11 of 11 | ≤ 3 (every marker has ≥ 1 at strength 2+) |
| High months per marker | 211–217 of 217 | 8–17 (≈ 4–8 %); money 28 because its support and test sides are banded separately |
| Moderate + High per marker | ~100 % | 17–38 % |
| High months with a period **and** a trigger | not required | all (test enforces it) |
| Blind-cast hit rate vs random at the same density | 12/12 vs 100 % | 5/12 vs 54 % |
| Combined lift@8 % / @20 % / mean percentile | 1.00 / 1.00 / – | 1.29 / 0.79 / 0.61 |

Per technique on the invented ledger (lift@20 %, mean percentile): Narayana 1.27 / 0.69, contacts 0.95 / 0.58,
Yogini 0.70 / 0.54, Tithi Ashtottari 0.37 / 0.53, Vimshottari 0.17 / 0.51, the interim double transit 0 / 0.49 (it fires
in 1 % of months: `transit_contacts` rarely puts Jupiter and Saturn on key natal points at once, which is the R-T1 gap).
**These numbers say nothing about accuracy**: the ledger is made up. What they show is that the grid is now selective,
so a real ledger can move the weights, and that a technique can now score below random (Vimshottari here), which v1 could
never show. Next: P0 ledgers for Sachin's chart and the panel charts, then the chart-swap check, then R-T1.
