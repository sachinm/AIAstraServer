# 11 — Analysis methods, triangulation and deciding factors

Added 2026-10-24. This is the shared method the specialists apply and the synthesizer enforces. It extends file 02 with the **how to weigh** rules: how several methods confirm or weaken an outcome, what decides a split verdict, how "luck" is expressed, and what each agent is responsible for in the DAG.

## 0. The standing instruction to every agent

> You are given computed celestial data with stable fact ids. **Do not compute anything**: no house counting, no sign arithmetic, no dasha dates, no transit positions, no strength estimates. Read the fields. If a field you need is missing, write a caveat naming it. Apply the rules of Parashara (BPHS, Phaladeepika for gochara) and Jaimini (Upadesa Sutras, as taught by PVR Narasimha Rao) and the nakshatra rules listed here, and **tag each claim with the tradition you applied**. Where traditions disagree, report both and let the convergence rule decide. Never invent a placement, a date or a yoga that is not in the data.

## 1. The triangulation framework

An outcome is judged on five layers. Each layer returns a signed strength (−3 to +3) with evidence ids. The first three are required; the last two confirm or temper.

| Layer | Question | Source | Required? |
|---|---|---|---|
| **L1 Promise (natal)** | Does the chart promise it at all, and in what form? | D-1 houses/lords/karakas + subject varga + arudha + yogas + strength | yes |
| **L2 Timing (dasha)** | Which periods in the horizon can deliver or obstruct it? | Vimshottari MD/AD/PD classes; Narayana/Chara dasha of the sign | yes |
| **L3 Trigger (gochara)** | What transit fires it inside those periods? | Saturn/Jupiter/Rahu-Ketu by sign and nakshatra over natal points; double transit; ashtakavarga of the transited sign | yes for horizons ≤ 3 y |
| **L4 Confirmation (second school)** | Does Jaimini (arudha, rasi drishti, chara/narayana dasha) or the nakshatra layer (star-lord, tara) say the same? | arudhas, rasi aspects, star-lords, taras | optional, weights the verdict |
| **L5 Annual (Tithi Pravesha / Varshaphal)** | Does the year chart repeat the theme? | annual chart, year lord, Mudda dasha, sahams | optional, when the `annual` export exists |

### Convergence rule (reconcile computes it)

```
score = w1*L1 + w2*L2 + w3*L3 + w4*L4 + w5*L5     with w = 3, 2, 2, 1, 1 (L4/L5 only if present)
gate:  if L1 ≤ −2 → verdict 'not indicated' regardless of L2/L3 ("transits cannot deliver what the chart denies")
       if L1 ≥ +1 and L2 ≥ +1 and L3 ≥ +1 → 'strong indication'
       if two of L1..L3 ≥ +1 and none ≤ −2 → 'moderate indication'
       if one of L1..L3 ≥ +1 → 'weak / possible'
       else → 'not indicated' (or 'mixed' when L1 ≥ +1 but L2 and L3 oppose each other)
agreement label: converge (all signs equal) / partial / diverge
```

Windows are the intersection of favourable L2 periods with favourable L3 transit spans; the strongest window is the one with a double transit or a same-nakshatra transit inside a deliverer PD.

## 2. Strengthen / weaken rules (applied inside L1)

A house matter is **strengthened** by: its lord in kendra/trikona in dignity; benefic occupants or aspects; lord in the same house in the varga or in the varga lagna/kendra; arudha aspected by benefics (rasi drishti); argala from 2/4/11 by benefics; SAV ≥ 28 in the house; lord's shadbala ratio ≥ 1.0; a yoga involving the lord; Pushkara navamsa; vargottama lord.

It is **weakened** by: lord in 6/8/12 or debilitated (check **neecha bhanga** before scoring); combust (reduce 1 step, 2 if within 3°); papakartari (malefics on both sides); malefic aspects without benefic relief; lord in 6/8/12 of the varga; SAV ≤ 22; retrograde lord for timing questions (delays, not denial); gandanta Moon/Lagna for stability questions; dasha lord in 6/8 from the house lord.

**Dispositor and star-lord rule** (central, computable): a planet gives the results of (a) the houses it owns, (b) the house it occupies, (c) its sign-dispositor's condition, and (d) above all for timing, its **nakshatra lord's** houses and condition. When a dasha lord looks good but its star-lord sits in 6/8/12 or is debilitated, downgrade one step; when a weak dasha lord has a strong star-lord in 2/5/9/10/11, upgrade one step. Tag these claims `kp_starlord`.

## 3. Deciders: what settles a split verdict, per situation

When L1 is mixed, one or two factors decide. These are the tiebreakers the specialists must apply and name.

| Situation | Primary decider | Secondary decider | What it decides |
|---|---|---|---|
| Marriage (timing / will it happen) | **D-9 7th lord dignity + D-1 7th lord in D-9** | Upapada (UL) and its 2nd; double transit on 7th/UL | Promise and form; a strong D-9 overrides a weak D-1 (late, not denied) |
| Relationship quality | Venus condition (dignity, aspects) and 7th from Venus | DK placement; 2nd from UL | Sustainability vs friction |
| Career direction | **10th lord's dispositor and D-10 10th lord** | AmK sign/house; strongest planet by shadbala | Field and style of work |
| Promotion / recognition | 11th lord and Sun condition in running AD | Saturn transit on 10/11; SAV of 10 | Whether effort converts to status |
| Job change | 10th lord vs 6th lord strength in the running AD | 8th house activation (sudden change), Rahu on 10 | Change by choice vs forced |
| Wealth growth | **2nd and 11th lords' relation (yoga) + Jupiter condition** | Indu Lagna lord; D-2 hora of the 2nd lord; Sudasa sign | Capacity vs windfall vs slow accrual |
| Loss / debt | 12th lord's placement and 6/8/12 lord periods | Viparita raja yoga presence (loss turns to gain) | Severity and recovery |
| Property | **4th lord in D-4 and Mars condition** | A4; SAV of 4 during the window | Acquisition vs rental vs dispute |
| Children | **5th lord in D-7 and Jupiter condition** | PK; Beeja/Kshetra sphuta sign nature | Promise, delay, medical vigilance |
| Health vigilance | Lagna lord strength vs 6th/8th lord periods | Saturn/Rahu transit on Lagna/Moon; D-30 malefic dominance | Which windows need care (never diagnosis) |
| Education / exams | Mercury (and Jupiter) condition + 5th lord in D-24 | 4th lord; Saturn on 5 (discipline/delay) | Success and the kind of study |
| Foreign | 12th lord and Rahu condition | 9th/7th lord; Saturn on 4 | Travel vs settlement |
| Litigation | **6th lord strength vs 7th lord strength** (self vs opponent) | 11th activation; Jupiter on 11 | Likely outcome tendency |
| Business | 7th and 10th lords' relation + Mercury/Mars | A7/A10; Rahu on 11 | Partnership viability, scale timing |
| Speculation (policy) | 5th and 11th lords with Rahu/Jupiter in the running PD | SAV of 5/11 | Gain windows only |
| Spirituality | Ketu and Jupiter condition; AK in D-9 (Karakamsa) | 12th from Karakamsa; 9th lord | Phase and direction |
| Compatibility | Moon-to-Moon relation (tara, rasi distance) + Venus/Mars overlay | Ashtakoota with exceptions; DK of each; dasa-sandhi | Fit, friction axes, timing |
| Family cross-effects | Planets of B in 6/8/12 of A and vice versa; shared malefic transits | Chara karaka houses (MK, PiK, BK) | Who strains whom, when |

## 4. "How is the luck": the fortune layer

Users ask "is my luck good now?". Compute a **fortune tier** deterministically and let the synthesizer describe it:

| Input | Weight |
|---|---|
| 9th house: lord dignity and placement, occupants, SAV of 9 | 3 |
| Jupiter condition (dignity, house, aspects) and its running dasha role | 2 |
| Sree Lagna and Indu Lagna lords' condition | 1 |
| Running MD/AD lord in kendra/trikona from Lagna and from AL, its tara from janma | 2 |
| Jupiter transit from Moon (2/5/7/9/11 favourable) and Saturn from Moon (3/6/11 favourable; sade sati phase) | 2 |
| Narayana dasha sign strength and its lord | 1 |

Tiers: `rising`, `steady`, `testing`, `heavy` with the date the tier changes (next AD boundary or Jupiter/Saturn ingress). Expressed in the Answer card as one sentence ("Your luck reads as *testing* until Jul 2026, then *rising*"). Never numeric.

## 5. Likelihood language and honesty

- The verdict tier from §1 maps to the fixed vocabulary in file 09. The structured output also carries `score` (−9…+9) for logging and evals, never shown.
- A **data gap** (missing varga, unknown birth time) lowers the maximum attainable tier by one and adds a caveat line. Unknown birth time → no Lagna-based claims; read from Moon (Chandra lagna) and say so.
- **Disagreement is reported**: "D-1 promises it, D-9 is weak, Jaimini's Upapada agrees with D-9 — so moderate, later rather than sooner."
- **Transits never create**: when L1 is denied, the answer says what the transit will *feel like* instead of promising the event.

## 6. Agent responsibilities and DAG joins

| Agent | Owns layer(s) | Input slice | Required before synth? | Timeout behaviour |
|---|---|---|---|---|
| `promise` | L1 (+ L4 arudha/rasi-drishti part) | d1_core, subject_detail, varga, arudha_special, relations | **yes** | retry on Groq once, then synth proceeds with `promise=unknown` and the verdict caps at `weak` |
| `dasha` | L2 (+ Narayana/Chara L4) | dasha section, lords' records, varga lord positions | **yes** | same |
| `transit` | L3 (+ ashtakavarga check) | transit table rows, natal points, arudhas | **yes when horizon ≤ 3 y**, else optional | partial allowed; windows without L3 are marked `unconfirmed` |
| `nakshatra` | L4 nakshatra part (star-lord, tara) | nakshatra profile, lords' naks, transit naks | optional (required for T7) | 12 s cap; skipped silently otherwise |
| `annual` (phase 4) | L5 | Tithi Pravesha / Varshaphal export | optional | skipped if export missing |
| `compatibility` (phase 4) | two-chart L1–L3 | both dossiers + overlay | required for T8 only | — |
| `reconcile` (no LLM) | convergence, windows, deciders, fortune tier, grounding gate | all findings | always | deterministic |
| `synthesize` | prose per template | SynthBrief | always | — |

**Join semantics in LangGraph**: all Sends from `fanOut` complete in the same super-step before `reconcile` runs, so the required agents are naturally awaited. Optional agents wrap their model call in a per-node timeout and return an empty finding with `status: 'skipped'` so they never hold the join. Required agents retry once on the fallback provider; if both fail, they return `status: 'failed'` and reconcile applies the caps above rather than aborting the reading. For T8, `fanOut` emits two parallel `promise/dasha/transit` triples (one per chart) plus `compatibility`; reconcile waits for all.

**Deciders in the DAG**: `reconcile` looks up the subject's decider row (§3) and, when L1 is mixed, re-weights the claims whose evidence ids match the decider facts (×2). This is how "which house lord or dispositor decides" becomes code rather than prose.

## 7. Worked triangulation: "When will I buy a house?"

1. L1: 4th lord Jupiter in 10th, own sign in D-4 (`vargas.D4.d1_lord_positions.4`), Mars in 2nd exalted, A4 aspected by Venus, SAV of 4 = 30 → **+3**.
2. L2: Saturn–Mercury AD (now, Mercury rules 1/10, no 4th link) → 0; Saturn–Venus AD from Aug 2026 (Venus aspects A4, in 2nd from 4th lord) → **+2**; Saturn–Sun AD 2030 (Sun in 8th) → −1.
3. L3: Jupiter enters Cancer (4th from Moon, aspects 4th from Lagna) Jun 2026 – Jul 2027; Saturn aspects 4th from Pisces throughout 2026–2027 → **double transit +3** from Jun 2026 to Jul 2027.
4. L4: Narayana dasha of Cancer (4th sign) 2026–2028, A4 strong → +1; Mercury's star-lord Sun in 8th → −1 for the current AD (explains the delay).
5. Reconcile: strong indication; window = (Aug 2026 – Jul 2027) ∩ Venus AD = **Aug 2026 – Jul 2027**, peak **Nov 2026 – Feb 2027** when Mars transits the 4th; decider (4th lord in D-4 + Mars) confirms purchase rather than rental. Template T2.
