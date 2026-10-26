# 26 — How the reference reading was made, and the reading tiers

Status: method guide, 2026-10-26 (Fable). Written from the reference reading in the side-session notes
(`fable-reference-reading-2026-10-26.md`, the five-part love/money/work/travel/brother question on the G-chart) so the
prompts and the specialists can follow the same order and pick the same fields. No code changed. Field names are the
dossier's (`docs/reading-engine/23-radha-full-dataset.md`); evidence ids in the pack are these paths with the pack prefix
(`base.`, `detail.`, `varga.`, `dasha.`, `transits.`).

Part A is the process behind that one reading. Part B is the same method cut into eight tiers, from the full treatment
down to a five-minute reading that still checks its own headline, with what each tier needs from the data.

---

## Part A — The process behind the reference reading

The reading took one question with five parts and answered each part the same way, in six passes. The order matters:
each pass narrows what the next one has to look at, and the calendar at the end is only credible because the first four
passes already said what the dates would mean.

### Pass 0 — Read the question into subjects, houses and a horizon

Before any chart data: split the question into parts, and for each part fix the **frame** (houses, karakas, varga,
arudha) and the **horizon**. The reference question became five frames:

| Part | Houses | Natural karaka | Jaimini points | Varga | Horizon used |
|---|---|---|---|---|---|
| Love | 7, 5, (2, 11, 12) | Venus (+ Jupiter) | DK, UL, A7 | D9 | 26 Oct – 30 Nov, outlook to 26 Jan |
| Money / bills / rent | 2, 11, 12, (4 for rent) | Jupiter, Venus | HL, IL, A2 | D2, D4 | same |
| Work / who with | 10, 6, 7 | Sun, Saturn, Mercury, Jupiter | AmK, A10 | D10 | same |
| Travel / gym / flights | 3, 9, 12, (6 for gym) | Venus, Mars, Moon | A3, A9 | D3 | same |
| Brother / stay | 3 or 11, 4, 12 | Mars (siblings), Moon (home) | BK, A4 | D3, D4 | same |

Two ambiguities were noted and carried, not dropped: *which brother* (3rd = younger, 11th = elder; both read) and *attached
or single* (read as "a matter already in your life" because the 7th lord was under a retrograde transit). The engine now asks
these as clarify chips; when unanswered, read both branches.

Fields: none yet. This pass uses `FRAMES` (`src/reading/packs/frames.ts`) and the question only.

### Pass 1 — Fix the chart's backbone once, for every part

Read once and reuse: these ten facts shape every part and are cited by every specialist.

1. Lagna sign and lord, and where the lord sits (`bodies.La.sign_name`, `houses.1.lord`, `bodies.<lord>.house`).
2. Moon sign, nakshatra, pada, house, dignity, and any cancellation (`bodies.Mo.*`, `yogas[]` Neecha Bhanga).
3. The stelliums and the empty houses (`houses.*.occupants`). In the reference chart the 7th held Sun–Jupiter–Saturn; that one
   fact drove love, work *and* income.
4. Shadbala rank order (`bodies.*.shadbala.rank`, `.ratio`): who is strongest (Saturn, rank 1) and weakest (Venus, rank 7). The
   strongest planet's houses are where results arrive; the weakest planet's period is where effort is needed.
5. Functional nature per lagna (`relations.functional`): which planets are benefic, malefic or neutral *for this lagna*. Every
   "culprit" and "contributor" statement rests on this.
6. SAV per house (`houses.*.sav`; `ashtakavarga.sav`): the highest (Cancer 36) and lowest (Libra 18) signs. Transits through the
   lowest sign are read as friction regardless of the planet.
7. Running Vimshottari MD–AD–PD with end dates (`dasha.vimshottari.current`, `periods[]`), and Narayana current
   (`dasha.narayana.current`). The PD change inside the horizon (Rahu → Jupiter on 20 Nov) became the hinge of the whole reading.
8. Named yogas and doshas (`yogas[]`, `doshas[]`): Chandra-Mangala, Dhana 2+5 and 11+1, Viparita Raja, Kala Sarpa, Amala. Yogas
   are quoted only when a frame lord is in them.
9. Chara karakas (`karakas.chara`: AK, AmK, BK, DK, PK) and the Karakamsa sign.
10. Double transits and Sade Sati status (`transits.double_transit[]`, `transits.sade_sati.now`).

### Pass 2 — Promise: does the chart allow it, in what form, through whom

Per part, in this order, and every statement names a planet:

- **Primary house**: sign, SAV, occupants and their nature, `aspected_by` (count them; name benefic vs malefic), `argala`
  (who intervenes, who obstructs), `cusp_nak`.
- **House lord**: house, sign dignity, nakshatra and star lord (`star_lord`, `star_lord_house`), `shadbala`, `bav_at_sign`,
  `retro`/`combust`/`near_cusp`/`bhava`, `aspected_by`, and the **dispositor chain** (`sign_lord` → its house → its own sign
  lord). The chain ending in a kendra/trikona, a dusthana, or the frame itself is the one-line verdict on the lord.
- **Natural karaka**: same fields. Karaka in the 6th/8th/12th or debilitated is a standing culprit for the subject.
- **Jaimini points**: the chara karaka of the subject (DK for spouse, BK for sibling, AmK for career), the arudha (UL/A7, A2,
  A10, A3, A4) with its lord and occupants, and the special lagnas (HL, IL for money).
- **Varga**: the D-chart for the subject — varga lagna and lord, the D1 lord's position there (`vargas.<D>.d1_lord_positions`),
  the same house in the varga, vargottama flags. The varga *refines* D1; it never overrules it. One sentence on the **form**
  the result takes comes from here (e.g. D2 Venus in the 11th → "income from service and clients, not windfalls").
- **Strength numbers quoted**: SAV ≥ 28 strong / ≤ 22 weak; shadbala ratio ≥ 1.0; BAV ≥ 4 good. Quote the number.

Output of the pass: verdict, **form**, **culprits** (strongest first), **contributors**, and the facts used.

### Pass 3 — Periods: what the running lords give for this subject

For each lord in the horizon (MD, AD, every PD): houses owned, house occupied, dignity, varga seat, star lord and its house,
relation to the frame (deliverer / supporter / neutral / obstructor), and the **AD-from-MD** and **PD-from-AD** house count
(kendra/trikona smooth; 6/8/12 friction). Then one sentence per period on its **fruit** for this subject, through which
houses. The Narayana sign period is read once as a second-method check. Fields: `dasha.vimshottari.*`, `bodies.<lord>.*`,
`vargas.<D>.planets.<lord>`, `dasha.narayana.current`.

### Pass 4 — Transits: what triggers it, and when

Only rows that touch the frame: `house_from_lagna` or `influences_houses` is a frame house, or `over_natal` names a frame lord
or karaka. For each: planet, sign, dates, what natal planet it sits on and **what that planet rules** (`bodies.<P>.owns`),
house from the Moon, `sav` of the sign and `bav` of the planet. Then stations (`transits.stations[]`, with longitude
against `bodies.*.lon` for the ±2° natal contacts: "Venus stations 0.9° from natal Sun"), lunations (`transits.lunations[]`
by house and nakshatra, especially on an arudha or a frame lord's star), double-transit edges, and the nodes' axis change.
Rules applied: Saturn on a frame lord delays and tests; Jupiter on a frame house/lord/arudha gives; Rahu inflates and
unsettles; Ketu detaches; a retrograde crossing a lord three times = the matter is revisited; the lowest-SAV sign = friction.

### Pass 5 — Reconcile and write

Per part: the verdict only when promise, periods and transits agree; one layer alone is "possible". **Direct answer first**
(2–4 sentences with the dates), then the houses and lords that decide it, what the periods give, what the transits give, and a
**fruit-of-each-window table**. Culprits and contributors are named in plain words. The collapsed "How I read this" carries
the chains. Then the **dated calendar** across all parts (every row is a dated change in the data; between rows the previous
conditions hold), and an outlook table past the horizon.

### Honesty rules that were applied

- No day-level claims without day-level data (no daily Moon, tithi or hora rows: say so once, give the real boundaries).
- Never "data not available" when the field exists in the dossier.
- No amounts, no city names, no remedies, no medical or legal content. Directions are "tendencies, not a map".
- Every date in the text comes from a `from`/`to`/`date` field; every placement from a dossier field.

---

## Part B — Eight tiers, from exhaustive to the five-minute check

Each tier is a complete reading at its own depth. A lower tier's job is to produce the same headline as the tier above it;
when it cannot, that is the signal to go one tier deeper. "Data" lists what must be in the pack; "Review" is what the reader
actually looks at; "Time" is for a human; the app's cost is in tokens and calls.

### Tier 1 — Full treatment (the reference reading)

- **Data**: whole dossier (D1 bodies and houses with aspects, argala, shadbala, BAV, SAV, star lords, bhava/cusp flags; all
  vargas with `d1_lord_positions`; arudhas; special lagnas; chara karakas; yogas/doshas; Vimshottari to PD with Narayana);
  transit snapshot (rows with `over_natal`, `influences_houses`, sav/bav, nak segments; stations with longitudes; lunations;
  double transits; Sade Sati); natal-degree contacts (Radha `transit_contacts`); the dated calendar.
- **Review**: all six passes for every part; culprits/contributors per layer; form; fruit per window; calendar; outlook.
- **Time**: 60–90 minutes per part by hand. App: graph flow, v2 findings, 4 readers + writer per part.
- **Use when**: multi-part or "day by day" questions, or when the user asks *why*.

### Tier 2 — Three-layer reading with vargas and Jaimini

- **Data**: Tier 1 minus the calendar, lunations and natal contacts.
- **Review**: Passes 1–5, but only the primary house, its lord, the karaka, the subject's varga, one arudha and one chara karaka;
  periods to AD (PD only if it changes inside the horizon); transits of Saturn, Jupiter and the nodes plus any retrograde over a
  frame lord.
- **Time**: 25–40 minutes. App: graph flow, v1 or v2, 3 readers.
- **Confirms**: the headline and the main window of Tier 1. Loses: stations-to-the-degree, lunation dates, day-level edges.

### Tier 3 — Parashara core: house, lord, karaka, dasha, slow transits

- **Data**: D1 houses and bodies (`lord`, `lord_house`, `lord_dignity`, `occupants`, `aspected_by`, `sav`), `bodies.*`
  (`dignity`, `shadbala.rank`, `nature`), `relations.functional`, Vimshottari current + AD list, transit rows for Sa/Ju/Ra/Ke.
- **Review**: primary house and lord, karaka, functional nature of everything touching them; MD and AD lords' relation to the
  frame; Saturn/Jupiter/nodes over frame houses and lords; double transit.
- **Time**: 15–20 minutes. App: graph flow, 3 readers, no varga section.
- **Confirms**: direction (yes/no/mixed) and the AD-level window. Loses: form (no varga), Jaimini corroboration.

### Tier 4 — Dasha-first reading (timing questions)

- **Data**: Vimshottari to PD inside the horizon; `bodies.<lord>.{owns,house,dignity,star_lord,star_lord_house,sign_lord}`
  for each period lord; frame houses; `relations.functional`.
- **Review**: classify every period lord in the horizon as deliverer/supporter/neutral/obstructor by ownership, occupation and
  star lord; AD-from-MD and PD-from-AD counts; the PD change dates are the answer's skeleton. Then one glance at whether Saturn
  or Jupiter currently sits on the primary house or its lord.
- **Time**: 10–12 minutes. App: dasha reader + one transit row check.
- **Confirms**: *when*. Does not confirm *whether* (no promise layer) — say so.

### Tier 5 — Transit-first reading (short horizons, "this month")

- **Data**: transit rows in the horizon with `over_natal`, `influences_houses`, sav/bav; stations; double transits; frame
  houses and lords; running PD.
- **Review**: list every row touching the frame; stations in the horizon; the lowest-SAV sign being transited; the running PD
  lord's nature. Dates come straight from `from`/`to`.
- **Time**: 8–10 minutes. App: transit reader only (the fast lane).
- **Confirms**: the dated windows and the "watch these dates" list. Does not confirm promise or long-range timing.

### Tier 6 — Jaimini cross-check (sign-based second opinion)

- **Data**: `karakas.chara`, `karakas.karakamsa`, `arudhas.*`, `special_lagnas.{HL,IL,GL,SL}`, `dasha.narayana.current`,
  D9 planets, `houses.*.argala`.
- **Review**: the subject's chara karaka and its house; the arudha of the subject and planets on/aspecting it (sign aspects);
  argala on the primary house; the Narayana sign period and its lord. Four sentences.
- **Time**: 6–8 minutes. App: no separate reader; the v2 promise prompt asks for it.
- **Confirms or contradicts** Tier 3's verdict by an independent school. Agreement raises confidence one step; disagreement
  caps the verdict at "mixed" and is said out loud. It never stands alone.

### Tier 7 — Strength-only screen (numbers, no interpretation)

- **Data**: `houses.*.sav`, `bodies.*.shadbala.{rank,ratio}`, `bodies.*.bav_at_sign`, `bodies.*.ishta/kashta`,
  `houses.*.aspected_by` lengths.
- **Review**: for the frame — SAV of the primary house (≥ 28 / ≤ 22), shadbala rank of its lord and the karaka, their BAV, how
  many malefic vs benefic aspects on the house, ishta/kashta of the lord. Five numbers, one line each.
- **Time**: 4–5 minutes. App: deterministic, no model (could be `keyFactsCard` only).
- **Confirms**: whether the subject is *strong, average or weak* in this chart. Says nothing about timing. If Tier 7 says weak
  and a deeper tier says strong, the deeper tier must name the yoga or varga that overrides the numbers.

### Tier 8 — The five-minute reading (minimum that still checks its headline)

Eight looks, in this order, each one field or one row. Stop after any look that flatly contradicts the one before and go to
Tier 3.

1. **Lagna lord**: house and dignity (`houses.1.lord`, `bodies.<lord>.{house,dignity}`). Sets the chart's general footing.
2. **Primary house of the subject**: occupants and their functional nature, SAV (`houses.<H>.{occupants,sav}`,
   `relations.functional`).
3. **Its lord**: house, dignity, shadbala rank (`houses.<H>.lord`, `bodies.<lord>.{house,dignity,shadbala.rank}`). Dusthana or
   debilitated = culprit; kendra/trikona in dignity = contributor.
4. **Natural karaka**: house and dignity. If it sits in 6/8/12, name it as the standing cost.
5. **Running MD–AD lords** against the frame: do they own, occupy or aspect the primary house? (`dasha.vimshottari.current`,
   `bodies.<lord>.owns/house`). Yes to either = the time allows it; no to both = "not this period".
6. **Saturn and Jupiter now**: house from lagna and `over_natal` (`transits.now.{Sa,Ju}`). Jupiter on the frame = push; Saturn
   on the lord = delay. Double transit on the frame = the strongest "now".
7. **One varga glance**: the D1 lord's position in the subject's varga (`vargas.<D>.d1_lord_positions.<H>`): kendra/trikona
   and not debilitated = the form holds; 6/8/12 = the form is compromised.
8. **One Jaimini glance**: the subject's arudha and its lord's house (`arudhas.<A>`). Planets on it = the matter is visible and
   real; empty and lord in a dusthana = more appearance than substance.

Then write three sentences: the verdict (strong / moderate / weak / not indicated), the one window (the AD or PD that
delivers, or the next Jupiter/Saturn change), and the one culprit and one contributor by name. This is the headline that every
deeper tier must reproduce; if it does not, the deeper tier explains which look was misleading (usually look 2 or 3 overruled
by a yoga, a cancellation or a varga).

### How the tiers map to the app

| Tier | Flow | Readers | Flag |
|---|---|---|---|
| 1 | graph, parts queue, calendar, contacts | promise, dasha, transit, nakshatra + writer | `READING_FINDINGS=v2`, `READING_CALENDAR=1` |
| 2–3 | graph | promise, dasha, transit | default |
| 4 | graph | dasha (+ transit `now`) | timing questions, long horizon |
| 5 | single / fast lane | transit | `isFastLane` (short horizon, yes/no) |
| 6 | inside promise (v2) | — | — |
| 7 | deterministic | `keyFactsCard` | — |
| 8 | single flow with the 8 looks as the pack | one call | the minimum pack (`READING_FULL_BASE=0` plus frame) |

The five-minute reading is what the single flow should produce for a one-subject, short-horizon question; the full treatment
is what a multi-part or "why" question gets. In between, the tier is picked by the question, not by the model.
