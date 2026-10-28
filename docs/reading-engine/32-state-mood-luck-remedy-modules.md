# 32 — Three modules on the full catalog: what troubles the person, today's mood, prediction-market answers and luck at the moment — each with its remedy technique, as DAG nodes

Status: **technique and build plan, 2026-10-28 (Fable)**. No code changed. Written for Sachin from the catalog as it
stands after docs 20–31: every field name below is a real dossier path (`src/reading/facts/types.ts`), transit path
(`src/reading/transits/types.ts`), catalog id (`src/reading/chartData/catalog.ts`, doc 23 §2) or a pyjhora function
(`AIAstra_Radha/src/jhora/...`). Per Sachin's instruction the doc 18 guardrails (health role-gate, `gambling_markets`
decline) are **set aside here**; where a module would trip one today, the line says so once so the gate can be opened
deliberately at build time.

Three modules, each in three parts — **technique** (the classical rules applied), **process and sequence** (which data
point is read in which order, what each step produces) and **remedy / counter-action** (how the data picks what to
do about it) — then one section on how they become nodes in the existing LangGraph (doc 04/19) and the build phases.

Shared conventions: `P` is a planet code (`Su Mo Ma Me Ju Ve Sa Ra Ke`); house numbers are whole-sign from Lagna
unless "from Moon"; `H(x)` is house x; scores are integers; every claim keeps the evidence ids it used; "today" is the
question moment at the person's current place (`intent.questionPlace`, else the birth place).

---

## Part 1 — "What is troubling the person": the pressure map

### 1.1 Technique

Parashara reads the state of mind from the **Moon** (manas), the **4th house** (sukha, peace, home), the **5th** (buddhi,
judgement) and the Lagna/Lagna lord (the self that carries it), weighed by **functional nature** (which planets are
benefic or malefic *for this lagna*), and finds *what* presses on the mind in the **houses activated right now** by the
running dasha lords (Vimshottari MD/AD/PD; Narayana sign as the second school) and by the slow transits (Saturn, Jupiter,
Rahu/Ketu, plus any station or retrograde over a Moon-related point). Jaimini adds the arudhas (how the matter is *seen*)
and the chara karakas. Nakshatra rules add the tara of the running lords from the janma star and the star-lord chain.

The rule set, in one line each:

- A house is **under pressure** when a running period lord or a slow transit (a) occupies it, aspects it, or is its lord, and
  (b) that planet is a functional malefic, weak (shadbala ratio < 1, debilitated, combust, in 6/8/12), or in a hostile
  tara/house from the Moon — *and* the house itself is weak (SAV ≤ 22, afflicted lord, malefic argala).
- The **mind's baseline capacity** to carry pressure is the natal Moon's condition plus the 4th: a strong Moon (dignity, SAV of
  its sign, benefic aspects, no Rahu/Ketu/Saturn conjunction, not gandanta) raises the threshold; a weak Moon lowers it.
- The **kind of pressure** comes from the planet (Saturn: burden, delay, isolation, duty; Rahu: anxiety, obsession,
  foreign/unconventional, confusion; Ketu: detachment, loss of interest, doubt; Mars: anger, conflict, haste; Sun: ego,
  authority, father; Mercury: overthinking, communication, money arithmetic; Venus: relationship, comfort, desire; Jupiter in
  trouble: faith, children, advice gone wrong; Moon: emotional swings, mother) and the **life area** from the house.
- The **timing** of the pressure is the intersection of the PD/AD window and the transit dwell; it "eases" at the first
  boundary where the pressing planet leaves the house or the sub-period changes to a deliverer/supporter.

### 1.2 Process and sequence (exact data points)

Everything in steps 1–5 is deterministic. Step 6 is the only model call.

**Step 1 — Mind baseline (natal, computed once per kundli, cached with the dossier).**

| # | Read | Field | Produces |
|---|---|---|---|
| 1.1 | Moon sign, house, dignity | `bodies.Mo.sign`, `.house`, `.dignity` | `moon.house`, `moon.dignity` |
| 1.2 | Moon nakshatra, pada, star lord and its house | `bodies.Mo.nak.{name,pada,lord}`, `bodies.Mo.star_lord`, `.star_lord_house` | temperament lens; `moon.star_lord_house` |
| 1.3 | Moon strength | `bodies.Mo.shadbala.{ratio,rank}`, `bodies.Mo.bav_at_sign`, `houses[moon.house].sav`, `ashtakavarga.sav[moon.sign]` | `moon.strength` ∈ {strong, mid, weak}: strong if ratio ≥ 1 and SAV of sign ≥ 28; weak if ratio < 0.8 or SAV ≤ 22 or dignity = debilitated without Neecha Bhanga in `yogas[]` |
| 1.4 | Moon afflictions | `bodies.Mo.conj` ∩ {Sa, Ra, Ke, Ma}, `bodies.Mo.aspected_by.graha` ∩ functional malefics from `relations.functional.malefic`, `nakshatra_profile.gandanta` (Moon), `bodies.Mo.flags` | `moon.afflictions[]` with the afflicting planet |
| 1.5 | 4th house | `houses.4.{sign,lord,lord_house,lord_dignity,occupants,aspected_by,argala,sav}` and `bodies[houses.4.lord].{dignity,shadbala,house}` | `h4.strength` by the same thresholds; `h4.afflictors[]` |
| 1.6 | 5th house (judgement) and Mercury (reasoning) | `houses.5.*`, `bodies.Me.{house,dignity,combust,retro,shadbala}` | `judgement.strength` |
| 1.7 | Lagna and lord | `houses.1.{lord,lord_house,sav}`, `bodies[lord].{dignity,shadbala}` | `self.strength` |
| 1.8 | Functional nature | `relations.functional.{benefic,malefic,neutral}`, `relations.yogakaraka`, `relations.marakas`, `relations.dusthana_lords` | lookup used by every later step |
| 1.9 | Natal doshas that colour the mind | `doshas[]` where `name ∈ {Kala Sarpa, Manglik, Guru Chandala, Pitru}` and `present = true` | `baseline.doshas[]` |
| 1.10 | Arudha Lagna and its lord | `arudhas.AL.{sign,house,occupants,lord}` | `al.house` (how the person's situation is perceived) |

Output `baseline`: `{ moon: {...}, h4, judgement, self, capacity: strong|mid|weak, afflictions[], doshas[] }`. `capacity` =
the median of `moon.strength`, `h4.strength`, `self.strength`.

**Step 2 — Period activation (running lords, from `dasha`).**

| # | Read | Field | Produces |
|---|---|---|---|
| 2.1 | Running MD, AD, PD with dates | `dasha.vimshottari.current.{md,ad,pd,md_end,ad_end,pd_end}` | `periods[]` = [MD, AD, PD] |
| 2.2 | For each lord L in `periods[]`: houses owned and occupied | `bodies[L].owns[]`, `bodies[L].house` | `activated_houses[L]` = owns ∪ {house} |
| 2.3 | L's condition | `bodies[L].{dignity,retro,combust,shadbala.ratio,bav_at_sign,ishta,kashta}`, `bodies[L].nature.functional` | `lord_quality[L]` ∈ {giver, mixed, presser}: presser if functional malefic or ratio < 0.8 or in 6/8/12 or kashta > ishta |
| 2.4 | L from the Moon | house count from `bodies.Mo.sign` to `bodies[L].sign` | `from_moon[L]`; 6/8/12 → inner friction (+2 pressure); 3/6/11 from Moon for Saturn is relief |
| 2.5 | L's tara from janma | `bodies[L].tara_from_janma` (or `nakshatra_profile.taras_from_janma[bodies[L].nak.name]`) | `tara[L]`; Vipat, Pratyari, Vadha → +1 pressure; Janma → emotional (+1 on Moon-related houses) |
| 2.6 | L's star lord chain | `bodies[L].star_lord`, `.star_lord_house`, `bodies[L].sign_lord`, `.sign_lord_house` | adds `star_lord_house` to `activated_houses[L]` at half weight |
| 2.7 | AD-from-MD and PD-from-AD house counts | signs of `bodies[md]`, `bodies[ad]`, `bodies[pd]` | 6/8/12 → "period friction" (+1) |
| 2.8 | Narayana running sign | `dasha.narayana.current.{md_sign,ad_sign,md_lord}` → the natal house that sign is, and `houses[that].occupants` | adds that house to activation at weight 1 (second school) |
| 2.9 | Next boundary | first of `pd_end`, `ad_end` | `next_change` date and the next lord's `lord_quality` |

Output `activation`: per house h, `dasha_load[h]` = Σ over lords of weight(level: MD 1, AD 2, PD 3 for horizons ≤ 1 y)
× (1 if L owns/occupies h, 0.5 if via star lord) × (presser 2 / mixed 1 / giver 0) + friction terms, with the lord names.

**Step 3 — Transit load (from the transit snapshot, `transits.*`; `fetchTransit` at today when the snapshot is older than a week).**

| # | Read | Field | Produces |
|---|---|---|---|
| 3.1 | Current rows | `transits.now[P]` for P ∈ {Sa, Ju, Ra, Ke, Ma}: `house_from_lagna`, `house_from_moon`, `house_from_al`, `over_natal[]`, `influences_houses[]`, `sav`, `bav` | per planet the houses it loads |
| 3.2 | Sade Sati / dhaiyya | `transits.sade_sati.now.{phase,house_from_moon,from,to}` | if present: Moon pressure +3, with phase |
| 3.3 | Nodes on the Moon axis or 4th | `transits.now.Ra/Ke.over_natal ∋ Mo`, or `house_from_lagna ∈ {4, 10}` | +2 on H(4) and Moon |
| 3.4 | Saturn from the Moon | `transits.now.Sa.house_from_moon` ∈ {1, 2, 4, 5, 7, 8, 9, 10, 12} → testing; {3, 6, 11} → relief | ±1 global |
| 3.5 | Jupiter from the Moon | `transits.now.Ju.house_from_moon` ∈ {2, 5, 7, 9, 11} → support (−1 global); {6, 8, 12} → hidden support only | |
| 3.6 | Weakest-SAV sign being transited | `transits.now[P].sav ≤ 22` by Sa/Ra/Ke | +1 on `house_from_lagna` |
| 3.7 | Retrogrades and stations over Moon points | `transits.stations[]` within ±30 days; `transits.contacts` (`transit_contacts`, ±2° to `bodies.Mo.lon`, `bodies[moon.star_lord].lon`, `bodies[houses.4.lord].lon`) | +2 on the contacted point's house, with the exact date |
| 3.8 | Double transit on a house | `transits.double_transit[]` covering today | that house is **active**, not necessarily pressured: pressure only if its lord is a presser |
| 3.9 | Lunations | `transits.lunations[]` next 30 days with `sign` = Moon sign or H(4)/H(8)/H(12) sign | +1 timed spike |

Output `transit_load[h]` per house with the planet, dates (`from`, `to`) and polarity.

**Step 4 — Natal weakness per house (static, cached).**

For every h: `natal_weakness[h]` = +1 if `houses[h].sav ≤ 22`; +1 if `bodies[houses[h].lord].shadbala.ratio < 0.8` or
`houses[h].lord_dignity = debilitated`; +1 if `houses[h].lord_house ∈ {6, 8, 12}`; +1 if `houses[h].argala.obstructed_by`
has a functional malefic; +1 if `houses[h].occupants` ∩ `relations.functional.malefic` ≠ ∅ and no benefic occupant;
−1 if `houses[h].aspected_by.graha` contains Jupiter or a functional benefic lord.

**Step 5 — Pressure map and ranking (deterministic; new reconcile helper `pressureMap`).**

```
pressure[h] = dasha_load[h] * (1 + 0.5 * natal_weakness[h]) + transit_load[h] * (1 + 0.5 * natal_weakness[h])
capacity factor: strong 0.8 / mid 1.0 / weak 1.25  (from baseline.capacity)
score[h] = round(pressure[h] * capacity_factor)
area[h]  = house → life area (inverse of doc 02 §0, extended):
  1 self, body, direction · 2 money in hand, speech, family of origin · 3 siblings, effort, short trips, courage
  4 home, mother, peace of mind, vehicles · 5 children, judgement, romance, creativity · 6 work load, debt, illness, rivals
  7 partner, marriage, business partner · 8 fear, sudden change, inheritance, hidden matters · 9 father, faith, luck, long travel
  10 career, status, boss · 11 gains, friends, elder sibling · 12 sleep, isolation, expense, loss, distant places
  plus the Moon itself (emotional tone) and the arudhas: UL/A7 relationship as seen, A4 home as seen, A10 work as seen, AL reputation
rank: top 3 by score; a house enters the answer only if score ≥ 3 and at least one of dasha_load, transit_load is non-zero
kind[h]: from the dominant presser planet (Saturn burden / Rahu anxiety / Ketu detachment / Mars conflict / … per §1.1)
window[h]: [max(start of the pressing period, transit from), min(pd_end or ad_end, transit to)]
eases_at: earliest boundary after today at which score[h] drops below 3 when recomputed with the next lord / next sign
```

Output `PressureMap { baseline, top: [{house, area, score, kind, pressers:[{planet, via: dasha|transit, from, to}], window,
eases_at, evidence[]}], global: {sade_sati, saturn_from_moon, jupiter_from_moon}, next_change }`.

**Step 6 — Narrative (one model call, template `narrative`).** Input: the `PressureMap` and the `base` pack only. The prompt
asks for: the two or three areas in rank order with the dates, the *kind* of pressure in plain words, what eases and when,
one sentence on the baseline ("your Moon in Scorpio in the 8th is quick to feel threat; this is amplified until …"), no
diagnosis words, every date from `window`/`eases_at`. The grounding gate checks ids as for any specialist.

Entry points: bucket `state_of_mind` (doc 15 taxonomy; cues "what's on my mind", "why do I feel", "troubling",
"unsettled", "restless", "weighing on me", "when will this ease") with sub-buckets `whats_weighing`, `why_unsettled`,
`when_eases`; and the **no-question card** "This month for you" = Steps 1–5 + a shorter narrative, recomputed when
`next_change` passes or the transit snapshot refreshes. Health gate (doc 18 row 16) set aside per instruction; `self_harm`
cue routing stays a product decision to make before shipping.

### 1.3 Remedy technique: from the pressure map to a remedy plan

Classical remedy selection is a function of **which planet presses, in what role, and whether it should be strengthened
or pacified**. The map already names the planet and the role; the rule is:

1. **Culprit list** = the `pressers[]` of the top areas, ordered by contribution to `score`. For each culprit C record:
   `role` (period lord / transiting planet / natal afflictor of the Moon), `functional` (`bodies[C].nature.functional`),
   `strength` (`bodies[C].shadbala.ratio`, dignity), `houses_owned` (`bodies[C].owns`), `window`.
2. **Strengthen or pacify** (the decision that decides everything else):
   - **Strengthen** C only when C is a **functional benefic or yogakaraka** (`relations.functional.benefic`,
     `relations.yogakaraka`) that is *weak* (ratio < 1, debilitated, combust, in 6/8/12). A weak friend that cannot deliver
     is strengthened: gemstone of C, mantra of C, C's weekday observance, C's metal/colour.
   - **Pacify** C when C is a **functional malefic**, a maraka (`relations.marakas`), a dusthana lord, or a node, whatever
     its strength. A strong enemy is never strengthened: no gemstone; charity (daan) of C's items, C's pacifying mantra/stotra,
     fasting on C's weekday, avoidance of C's colour/direction during the window.
   - A planet that is **both** (e.g. owns 5 and 6) is pacified, not strengthened, unless it is the Lagna lord.
3. **Moon-side remedies** are added whenever `baseline.capacity = weak` or `moon.afflictions` is non-empty, independent of
   C: Moon mantra, Monday observance, white/silver, water offering, and Chandra-shanti for a gandanta or Krishna-Chaturdashi/
   Amavasya Moon (`panchanga.tithi` at birth from `panchanga.birth`).
4. **Transit-specific** overlays: Sade Sati phase → Saturn pacification for the phase's `to` date; Rahu/Ketu over Moon or 4th →
   Rahu (Durga) / Ketu (Ganesha) remedies until `transits.now.Ra.to`; a station on a Moon point → a one-week observance.
5. **Dosha remedies** from `baseline.doshas[]` (Kala Sarpa, Pitru, Manglik, Guru Chandala) are added once, not per window.
6. **Ishta devata** (Jaimini): the planet in, or the lord of, the 12th from Karakamsa (`karakas.karakamsa.sign` → sign + 11)
   names the deity line that suits this person; the remedy wording uses it in place of a generic one when it coincides
   with C's deity.
7. **Timing of the remedy**: start on C's weekday, during a shubha hora of C (pyjhora `drik.shubha_hora`, via the day
   panchanga export in Part 2), avoid Rahu kaal; run until `window.to` (or the Sade Sati `to`), then stop.
8. **Rank** the candidates by (score contribution of C) × (remedy fit: pacify/strengthen correct = 1, Moon-side = 0.8,
   dosha = 0.6) and keep the top three; one gemstone at most, and none when C is not a functional benefic.

The rule table (planet → mantra, stotra, deity, daan items, weekday, colour, metal, gem with the benefic-only flag,
rudraksha mukhi, direction; dosha → remedy; nakshatra → deity and shanti) is **data**, seeded as `remedy_rules` (JSON) on
the server. It is a lookup on computed facts, not an astrological computation, so it does not break "Node computes
nothing"; if Sachin prefers, the same table becomes a Radha type `remedy.rules` and the server only looks up.

Output `RemedyPlan { for: PressureMap.top[i], culprit, mode: strengthen|pacify, items: [{kind: mantra|stotra|daan|fast|
gem|colour|direction|observance|dosha_shanti, what, when: {weekday, hora, start, until}, rationale_ids[]}], moon_side[],
ishta_devata }`. One short model call writes it as a list in plain words; no amounts, no medical claims.

---

## Part 2 — Mood today

### 2.1 Technique

The day's emotional tone in the classical method is the **transit Moon read against the natal Moon** (Chandra gochara),
qualified by the **tara** of the day's nakshatra from the janma star, the **tithi** and **paksha**, the planets the Moon
**conjoins or is aspected by today**, the **hora and weekday lord**, and the **Moon's dasha relevance** (whether the running
PD lord is the Moon, is in the Moon's sign, or is the Moon's star lord). The natal Moon baseline (Part 1 step 1) sets how
strongly the day is felt.

Rules: Moon transiting 1, 3, 6, 7, 10, 11 from the natal Moon is favourable (Chandrabala; 1 is "janma", emotional but
grounded), 4, 8, 12 unfavourable, 2, 5, 9 mixed (2 and 5 lean good, 9 lean restless); tara Sampat, Kshema, Sadhaka, Mitra,
Ati-mitra favourable, Vipat, Pratyari, Vadha unfavourable, Janma intense; waxing Moon lifts, waning Moon turns inward, the
four days around Amavasya and Krishna Chaturdashi are the low point, Purnima the high-energy point; Moon with Saturn
(heavy), Rahu (restless), Ketu (detached), Mars (irritable), with Jupiter/Venus/Mercury (lighter); a Moon in the person's
lowest-SAV sign (`ashtakavarga.sav`) is a friction day; the day's hora lord and weekday lord colour the morning/evening.

### 2.2 Process and sequence (exact data points)

Data at the moment comes from **one Radha call**: `prashna` at `at = now` at the current place with natal fields
(doc 28 R-27c returns the moment's panchanga — tithi, paksha, nakshatra with pada, yoga, karana, weekday, hora lord —
and the planet rows with `natal_house`), or `transit` with `divisional_chart_factors [1]` + `withNatal`. The day table
(Rahu kaal, choghadiya, shubha horas, Chandrabala lagnas) needs the new type in §2.4.

| # | Read | Field (moment) | Field (natal) | Produces |
|---|---|---|---|---|
| M1 | Transit Moon sign | `prashna.planets.Mo.sign` | `bodies.Mo.sign` | `moon_from_moon` = house count; score: {1:+1, 3:+2, 6:+2, 7:+1, 10:+2, 11:+2, 2:+1, 5:+1, 9:0, 4:−2, 8:−3, 12:−2} |
| M2 | Transit Moon nakshatra | `prashna.panchanga.nakshatra.{name,pada}` | `nakshatra_profile.taras_from_janma[name]` | `tara` → {Sampat +2, Kshema +2, Sadhaka +2, Mitra +1, Ati-mitra +2, Janma 0 (flag intense), Vipat −2, Pratyari −2, Vadha −3} |
| M3 | Tithi and paksha | `prashna.panchanga.{tithi,paksha}` | — | Shukla +1 (Purnima +2), Krishna 0, Krishna 13/14/Amavasya −2 |
| M4 | Moon's company today | `prashna.planets.*.sign` = Moon's sign; aspects by graha drishti from Sa/Ma/Ju to that sign (7th for all; Sa 3/10, Ma 4/8, Ju 5/9) | — | Sa −2, Ra −2, Ke −1, Ma −1, Su −1 (dark Moon), Ju +2, Ve +1, Me +1 |
| M5 | Moon's sign SAV | — | `ashtakavarga.sav[transit moon sign]` | ≥ 28 +1, ≤ 22 −1 |
| M6 | Moon's natal house today | `prashna.planets.Mo.natal_house` | `houses[h].class`, area table from Part 1 | the *theme* of the day (where the attention goes), not a score |
| M7 | Hora and weekday lord | `prashna.panchanga.{weekday,hora_lord}` | `relations.functional` | lord functional benefic +1 / malefic −1 (weekday), hora: only for the "best hours" line |
| M8 | Dasha relevance | `dasha.vimshottari.current.pd`, `bodies[pd].house`, `bodies[pd].star_lord` | — | PD lord = Mo or star lord = Mo → amplitude ×1.5 (the day is felt more) |
| M9 | Baseline | Part 1 `baseline.capacity`, `moon.afflictions` | — | weak capacity: negative scores ×1.25; strong: ×0.8 |
| M10 | Today's transit events | `transits.stations[]` / `lunations[]` on today ±1, `transits.contacts` with `date` = today | — | a named spike ("Mercury stations on your natal Venus today") |

```
mood_score = (M1 + M2 + M3 + M4 + M5 + M7) * amplitude(M8) * capacity(M9)
tone: ≥ +5 bright · +2..+4 steady · −1..+1 flat/mixed · −2..−4 heavy · ≤ −5 low
theme: area(M6)  ·  spike: M10
best hours: Chandrabala lagnas and shubha horas of the day (§2.4) not in Rahu kaal / Yamaganda / Gulika kaal
```

Output `MoodCard { date, tone, score, theme, drivers: [{rule, value, evidence}], spike?, best_hours[], avoid_hours[],
baseline_note }`. Three lines of text are templated, no model call; an optional one-line model polish is allowed.

Feedback tap: `mood_feedback (user_id, date, tone_shown, score, matched: yes|partly|no, note)`. This is the label stream:
after ~300 labels the weights in M1–M7 are refit per user cohort (same shrinkage rule as doc 29 §5: `n / (n + 5)`).

### 2.3 Counter-action technique for a heavy or low day

The counter-action is picked from the **driver that made the score negative**, in order of its contribution:

1. **Moon house 4/8/12 from natal Moon (M1)** → act in the **Chandrabala lagnas** of the day (pyjhora `drik.chandrabalam`:
   the rising signs 1/3/6/7/10 from the transit Moon) and in a **shubha hora** (`drik.shubha_hora`) for anything that matters;
   defer decisions otherwise; Moon items (water, white, Chandra mantra, Shiva).
2. **Hostile tara (M2)** → the day's nakshatra deity and its lord's pacification for the day (Vipat/Pratyari/Vadha star lord
   from `prashna.panchanga.nakshatra.lord`); no new beginnings; Abhijit muhurta (`drik.abhijit_muhurta`) is the one safe
   window.
3. **Dark Moon tithi (M3)** → rest, fasting or light food, Shiva/Kali observance on Chaturdashi/Amavasya; Purnima excess → grounding.
4. **Malefic company (M4)** → that planet's pacifier for the day: Saturn (service, Hanuman/Shani, blue-black avoided),
   Rahu (Durga, avoid the unfamiliar, no large commitments), Ketu (Ganesha, finish rather than start), Mars (Hanuman,
   physical exertion, avoid confrontation), Sun (Aditya, step back from authority clashes).
5. **Low-SAV sign (M5)** → stay with routine; the house whose sign it is names what *not* to push today.
6. **Weekday/hora (M7)** → do the day's important act in a hora whose lord is a functional benefic; the table gives the hours.
7. **Avoid**: Rahu kaal, Yamaganda, Gulika kaal, Durmuhurta, Varjyam (all computable in pyjhora `panchanga/drik.py`) — listed
   as `avoid_hours`.
8. **Baseline overlay**: when `baseline.capacity = weak`, always add the Moon-side line from Part 1.3 step 3.

The counter-action is the same `remedy_rules` lookup with `scope = day` rows (planet → day practice; tithi → observance;
nakshatra → deity/lord), ranked by driver contribution, top two shown with the hours.

### 2.4 Radha gap for Part 2 (one new type)

`panchanga.day` (change class `moving`, params `date`, place): sunrise, sunset, tithi list with end times, nakshatra with
end time, yoga, karana, weekday, **hora table** (`drik.shubha_hora`), **choghadiya** (`drik.gauri_choghadiya`), Rahu kaal /
Yamaganda / Gulika kaal, Abhijit (`drik.abhijit_muhurta`), Amrita gadiya, Durmuhurta/Varjyam, **Chandrabala lagnas**
(`drik.chandrabalam`), Panchaka (`drik.panchaka_rahitha`). All exist in pyjhora; JSON builder only (same shape of work as
`prashna`). The `transit_daily` type (doc 27 R-T2, ≤ 93 days of Moon sign/nakshatra/tithi) gives the month view of Part 2.

---

## Part 3 — Prediction-market answers and luck at the moment

### 3.1 Technique: "Will X happen by D?" with a probability

The verdict machinery is doc 11's five layers with the deadline as the horizon; the probability is a **calibrated
mapping from the convergence score to an observed hit rate per event class**, which needs outcomes. The sequence makes the
question resolvable, scores it, stores it with its resolution rule, and closes the loop.

**Step P1 — Resolution spec (clarifier, deterministic slots).** From the question: `event_class` (doc 27's ten markers +
doc 14's classes: marriage, relationship start/end, job change, promotion, job offer, business start, property purchase,
move/relocation, foreign travel, child, exam/admission, litigation outcome, loan/large money in, large loss, health
event, vehicle, family event), `deadline` (date; "by Diwali" resolved to a date), `criterion` (what counts: signed offer,
registered marriage, keys in hand), `side` (happen / not happen). Stored verbatim in `predictions.spec`.

**Step P2 — Frame** from `FRAMES` (doc 02 §0 row for the class): houses, karakas, varga, arudha, chara karaka.

**Step P3 — L1 Promise** (promise specialist, or deterministic for the market type): the frame house's `sav`, lord's
`dignity/shadbala/house`, karaka's condition, `vargas[D].d1_lord_positions` and `vargas[D].houses`, arudha occupants and
`aspected_by.rasi`, yogas touching the lord. Score −3..+3. **Gate**: L1 ≤ −2 → the answer is "not indicated" with the
probability floor of the class (see P7), whatever the rest says.

**Step P4 — L2 Periods** (dasha specialist): every `dasha.vimshottari.periods[]` row with `start < deadline`, classified
deliverer/supporter/neutral/obstructor for the frame (doc 02 step 2 rules on `bodies[L].owns/house/star_lord_house`), plus
`dasha.narayana.periods[]` sign vs frame house. Score −3..+3 and the **windows** (deliverer periods ∩ [today, deadline]).

**Step P5 — L3 Triggers** (transit specialist): `transits.rows[]` with `from < deadline` whose `influences_houses` or
`over_natal` touch the frame; `double_transit[]` on the frame house inside [today, deadline]; `transits.contacts` ±2° on
the frame lord/karaka; stations on them. Score and windows. For deadlines > 24 months, `transit_range` (R-T1) extends the rows.

**Step P6 — L4/L5** (optional): nakshatra (tara of the deliverer lords, star-lord chains), annual (`annual.tithi_pravesha`
houses + `annual.tithi_pravesha_dasha` periods inside the window, `annual.sahams` for the class: Vivaha for marriage,
Karma for work, Dhana for money, Yatra for travel, Santana for children), prashna cast at the confirmation moment (doc 28
nudge rules: ±1 step, never alone).

**Step P7 — Score → probability.**

```
score   = 3*L1 + 2*L2 + 2*L3 + L4 + L5                        (doc 11 §1, −9..+9)
tier    = convergence gate (strong / moderate / weak / not indicated / mixed)
window  = ∩ of L2 and L3 favourable windows, clipped to [today, deadline]; empty window → tier capped at weak
prior   = class prior table (doc 14 §4): e.g. marriage strong 0.65 / moderate 0.45 / weak 0.25 / not 0.08
          job_change strong 0.70 / moderate 0.50 / weak 0.30 / not 0.10 … (seeded conservatively per class)
adjust  = +0.05 if a double transit on the frame house lies inside the window; −0.05 if the deadline is inside an
          obstructor PD; ±0.05 prashna nudge; clamp [0.03, 0.95]
p_shown = tier only until the class has ≥ 200 resolved predictions and Brier ≤ 0.20 (doc 14 §4 display rule);
          then isotonic(score, class) with the band ± the calibration's standard error
```

**Step P8 — Store and resolve.** `predictions (id, user_id, kundli_id, run_id, spec, event_class, deadline, score, tier,
p_internal, p_shown, window_from, window_to, evidence_ids, calibration_version)`. A resolution prompt is scheduled for
`min(window_to, deadline) + 7 days` ("Did it happen? yes / no / not yet / partly, and when"); the answer writes
`prediction_resolutions`. The timeline's past-half feedback (`timeline_feedback`) writes the same table with
`source = timeline`. Calibration job (doc 29 `calibrate.ts`): per class, isotonic fit of `score → hit rate`, Brier, the
shrinkage `n / (n + 5)` on the class prior, and a per-user adjustment when the user's own hit rate departs from the class.

**Step P9 — Answer** (template `yes_no` with a `likelihood` slot): verdict tier, the window, the deciding layer, the
probability band when `p_shown` is a number, and the line "this prediction will ask you on <date> whether it happened".

**Market events** (elections, sports, prices): no natal chart answers them; it would need mundane charts (ingress charts,
national charts) the catalog does not have, and `gambling_markets` is declined today. Out of scope for this plan.

### 3.2 Technique: luck at the moment (prashna and natal)

Two readings are combined; both are deterministic.

**A. Natal luck now** (doc 11 §4 fortune tier, extended to gains):

| # | Read | Field | Score |
|---|---|---|---|
| L1 | 9th house and lord | `houses.9.{sav,lord,lord_house,lord_dignity,occupants}` | weight 3 (doc 11 §4) |
| L2 | Jupiter condition and dasha role | `bodies.Ju.{dignity,house,aspected_by,shadbala}`; Ju ∈ {md, ad, pd} | 2 |
| L3 | Sree Lagna and Indu Lagna lords | `special_lagnas.SL`, `special_lagnas.IL` → `bodies[lord].{dignity,house}` | 1 |
| L4 | Running MD/AD/PD lord from Lagna and from AL, tara | `bodies[L].house`, house from `arudhas.AL`, `bodies[L].tara_from_janma` | 2 |
| L5 | Jupiter and Saturn from the Moon | `transits.now.Ju.house_from_moon` ∈ {2,5,7,9,11}; `transits.now.Sa.house_from_moon` ∈ {3,6,11}; `sade_sati.now` | 2 |
| L6 | Narayana running sign strength | `dasha.narayana.current.md_sign` → `houses[sign→house].sav`, lord condition | 1 |
| L7 | **Gains activation** (new): 5th and 11th lords in the running periods, `houses.11.sav`, `houses.5.sav`, transit Jupiter/Venus `bav` in the signs of 5/11 (`transits.now.Ju.bav`, `.Ve.bav` when in those signs), 2nd lord condition | 2 |
| L8 | Yogi / Avayogi planets | `sphutas.yogi`, `sphutas.avayogi` (longitude → the planet ruling that nakshatra); yogi planet running as PD/AD or transiting 5/11 → +; avayogi running → − | 1 |

`luck_tier` ∈ {rising, steady, testing, heavy} with `until` = next AD boundary or Jupiter/Saturn ingress (as today), plus
`gains_window` = periods where L7 is positive.

**B. Luck at this moment** (prashna at `at = now`, current place, `divisional_chart_factors [1, 9]`, with natal fields):

| # | Read | Field | Rule |
|---|---|---|---|
| Q1 | Prashna lagna and lord | `prashna.prashna_lagna.d1`, lord from sign, `prashna.planets[lord].{sign, house from prashna lagna}` | lord in kendra/trikona or 11th from the prashna lagna, in dignity: +2; in 6/8/12: −2 |
| Q2 | Moon in the prashna chart | `prashna.planets.Mo` house from prashna lagna; Moon's sign from natal Moon (Part 2 M1) | Moon in 1/3/5/9/10/11 from prashna lagna +1; 6/8/12 −2; waxing +1 |
| Q3 | 11th and 5th from prashna lagna | occupants and lords' placement | benefic in or aspecting 11th +2; malefic in 11th +1 (gains with cost); 5th lord in 6/8/12 −1 |
| Q4 | 2nd and 12th | occupants | malefic in 12th −1 (expense); benefic in 2nd +1 |
| Q5 | Lagna lord ↔ 11th lord / Moon connection (Tajaka) | pyjhora `transit/tajaka.py` aspects (`planets_have_benefic_aspects`) between lagna lord and 11th lord, lagna lord and Moon | applying benefic aspect (Ithasala) +2; separating (Easarapha) −1; no aspect 0 |
| Q6 | Panchanga at the moment | `prashna.panchanga.{tithi, nakshatra, yoga, hora_lord, weekday}` | tara from janma (Part 2 M2), hora lord functional benefic +1, Rikta tithis (4/9/14) −1, inauspicious yoga (Vyatipata, Vaidhriti) −1 |
| Q7 | Natal overlay | `prashna.planets.*.natal_house`: Moon/Jupiter/Venus today in natal 2/5/9/11 +1 each; Saturn/Rahu/Ketu in natal 5/11 −1 each | |
| Q8 | Time windows | `panchanga.day` (§2.4): current hora, Chandrabala lagna, Rahu kaal etc. | inside Rahu kaal/Yamaganda/Gulika −2; inside Abhijit or Amrita +1; Chandrabala lagna +1 |

```
moment_score = Σ Q1..Q8 ;  moment_tier: ≥ +6 favourable · +2..+5 fair · −1..+1 neutral · ≤ −2 unfavourable
luck_now = combine(luck_tier (natal, weight 2), moment_tier (weight 1)); the natal tier caps the moment: heavy natal → at most "fair"
next_better = first upcoming hora / Chandrabala lagna / tithi change at which moment_score recomputes ≥ +2
```

Output `LuckCard { natal: {tier, until, gains_window}, moment: {tier, score, drivers[]}, luck_now, next_better, avoid_hours }`.
Prashnawali (number/grid oracles) is not in pyjhora; the number-based prashna lagna methods are (`get_prasna_lagna_*`, set
aside in doc 28 §7 decision 1) and can be offered as a second cast if Sachin wants a user-chosen-number variant.

### 3.3 Counter-action for an unfavourable moment

Not a remedy for the chart; a **timing** answer. From the drivers of `moment_tier`: Q8 (wait for the next window:
`next_better`, with the hour), Q2/Q6 (Moon/tara/tithi: Part 2 rules 1–3), Q1/Q3 (prashna lagna weak: "not this hour; the
lagna changes at <time>"), Q7 (Saturn/nodes on natal 5/11: the day is for keeping, not staking). For a `heavy` natal
luck tier the card says plainly that no hour fixes the period and names `until`. The remedy lookup for the gains houses
(5th/11th lords and Jupiter: Part 1.3 rules) is offered once per period, not per moment.

---

## Part 4 — The DAG: nodes, state, joins

All three modules reuse the existing graph (`intake → clarify → prepare → fanOut → specialists → reconcile → synthesize →
persist`, doc 04/19) with **deterministic nodes that run inside `prepare`/`reconcile`** and at most one model call each.

| Node | Kind | Inputs | Output (state key) | Runs when |
|---|---|---|---|---|
| `baseline` | deterministic, cached per kundli (facts hash) | dossier: `bodies.Mo`, `houses.1/4/5`, `relations`, `doshas`, `arudhas.AL`, `nakshatra_profile`, `ashtakavarga` | `state.baseline` | every run of the three modules; `prepare` |
| `pressure` | deterministic | `baseline`, `dasha.*`, `transits.*` (+ `fetchTransit` today if stale), `houses.*`, `bodies.*` | `state.pressureMap` | bucket `state_of_mind`; monthly card; always before `remedy` |
| `mood` | deterministic | `baseline`, one `prashna` (or `transit`) at now, `panchanga.day`, `dasha.vimshottari.current`, `transits.stations/lunations/contacts` | `state.moodCard` | bucket `mood_today`; daily card |
| `luck` | deterministic | fortune inputs (doc 11 §4), `sphutas`, `special_lagnas`, `prashna` at now, `panchanga.day`, tajaka aspect check | `state.luckCard` | bucket `luck_now`; on request from `predict` |
| `remedy` | deterministic rule lookup + 1 short model call for wording | `pressureMap` or `moodCard` or `luckCard` drivers, `relations.functional`, `karakas.karakamsa`, `remedy_rules` | `state.remedyPlan` | when the user asks "what can I do", or the card has a heavy/low tone; after its source node |
| `resolve_spec` | clarifier slots (deterministic, model fallback) | question text, `FRAMES` | `state.predictionSpec` | bucket `will_it_happen` |
| `predict` | reconcile extension | findings of `promise/dasha/transit/(nakshatra/annual/prashna)` with horizon = deadline, `predictionSpec`, class priors, calibration table | `state.prediction` (score, tier, p, window) | after the specialist join |
| `resolution_scheduler` | persist side-effect | `state.prediction` | `predictions` row + scheduled prompt | after `persist` |
| `calibrate` | batch job (EventBridge, weekly) | `predictions` ⋈ `prediction_resolutions`, `timeline_feedback`, `mood_feedback` | `calibration_versions` row; updated priors and M-weights | outside the graph |

Joins: `pressure`, `mood`, `luck` need only `prepare`'s data and run in the same super-step as the specialists (they never
wait on a model). `remedy` waits on exactly one of them. `predict` waits on the specialist join (like `reconcile`) and
`synthesize` receives `prediction` in the `SynthBrief` (`likelihood` slot). Optional nodes keep the doc 19 rule: time-boxed,
`skipped` on no data, never hold the join.

Buckets to add in `taxonomy.ts`: `state_of_mind` (sub: `whats_weighing`, `why_unsettled`, `when_eases`), `mood_today`,
`luck_now`, `will_it_happen` (the yes/no questions with a deadline; today's `yes_no` type with `horizon` becomes this when a
deadline is present), `remedy` (sub: `for_pressure`, `for_today`, `for_period`). Templates: `narrative` (pressure), a new
`card` template (mood, luck: three lines + hours), `yes_no` with `likelihood`, `list` (remedy).

Schema (one migration, M15): `remedy_rules` (seed, JSON), `mood_cards` (user, date, card, score), `mood_feedback`,
`predictions`, `prediction_resolutions`, `calibration_versions`; `remedy_plans` optional (or keep in `reading_runs`).

Radha additions (Python pass, after R-5): `panchanga.day` (§2.4); `transit_daily` (R-T2); `remedy.rules` only if the table is
to live in Radha; nothing else — every other input is already served or in build (doc 23 §1).

---

## Part 5 — Build phases and gates

| # | Work | Repo | Gate |
|---|---|---|---|
| X-1 | `baseline` + `pressure` + area table + `state_of_mind` bucket + narrative prompt; monthly card endpoint | Server | G1 and the two panel charts: the ranked areas match the reference reading's culprits (doc 26) for the current month; grounding gate passes; unit tests per rule with hand-checked values |
| X-2 | `remedy_rules` seed + `remedy` node (pressure scope) + `remedy` bucket | Server | every top-area culprit yields a plan; gem never offered for a functional malefic (test); wording passes the no-amount/no-medical check |
| X-3 | Radha `panchanga.day`; server `mood` node + daily card + `mood_feedback`; day-scope remedy rows | Radha + Server | one `prashna` + one `panchanga.day` call per card; card renders in < 1 s warm; 20 days of self-labels from Sachin before weights are touched |
| X-4 | `luck` node (natal + moment) + `luck_now` bucket + counter-action lines | Server | tajaka aspect check verified against pyjhora's own tests; tier agrees with doc 11 §4 fortune tier on G1 |
| X-5 | `resolve_spec` slots, `predict` node, class prior table, `predictions` + resolution prompt, `yes_no` likelihood slot (tiers only) | Server | 12 golden yes/no questions produce a spec, a window and a tier; prompt fires at the right date |
| X-6 | `calibrate` job: isotonic per class, Brier, shrinkage, display gate; probability bands switched on per class | Server | first class to reach 200 resolutions with Brier ≤ 0.20 shows a band; chart-swap check (doc 29 §5.4) passes |
| X-7 | `transit_daily` (R-T2) → month view of mood; `transit_range` (R-T1) → long-deadline predictions | Radha + Server | — |

X-1 → X-2 → X-3 run in order (each reuses the previous); X-4 can start with X-3; X-5 can start now on the fixture charts
and is independent of X-1..X-4 except for sharing `baseline`; X-6 is months out and is gated by labels, not code.

Risks: (1) the pressure weights are hand-set until labels exist — ship them as a config table and keep the rule-per-driver
evidence so a wrong weight is visible; (2) mood is the weakest-evidence product and will be judged by the feedback tap —
show it as "the day's tone", never as a verdict; (3) probabilities shown too early destroy trust — the display gate is not
optional; (4) remedies are the one output that tells the person to *do* something: the gem rule and the no-amount rule are
tests, not prompts; (5) the doc 18 gates set aside here (health wording, `self_harm` routing, `gambling_markets`) must be
reopened as a product decision before X-1 and X-4 ship.
