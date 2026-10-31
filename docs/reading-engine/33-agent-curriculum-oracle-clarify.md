# 33 — The agent curriculum: what every reader on Gemini 3.5 must seek, the Oracle master on Gemini 3.8, and the Clarify agent that finds what the person really wants to know

Status: **plan, 2026-10-28 (Fable).** No code changed. Written after the Archisha readings of 2026-10-28 (side-session
notes `archisha/`: the thorough reading, the parents-and-saving-graces reading, the life charter 2026–2030, and the
Sun–Rahu / Venus dig). Those readings were made by hand from the same Radha data the engine stores. This document turns
*how they were made* into instructions the engine's agents can follow, so a reading of that depth and that care can be
assembled by the app.

It enhances three plans:

| Plan | What it is today | Docs |
|---|---|---|
| **Plan A — the question reading** | cheap readers (promise, dasha, transit, nakshatra) → reconcile → one writer; eight tiers | 23, 25, 26, 30 |
| **Plan B — the state modules** | pressure map, mood today, luck now, prediction, each with its remedy/counter-action | 32 |
| **The 18 + 18 timeline** | foundation + timing systems over 36 years, ledger calibration, event timing v2 | 14, 27, 29 |

(If "Plan A" and "Plan B" mean other documents to Sachin, nothing below changes: the curriculum is organised by *data
category*, and every plan reads the same categories.)

Models as named by Sachin: every **reader** (sub-agent) runs on **Gemini 3.5** (`gemini-3.5-flash-lite` in `llm/models.ts`;
the same prompts hold for a 3.5 Flash id if one is configured), the **Oracle** master runs on **Gemini 3.8**
(`gemini-3.8-flash`), and the **Clarify** agent keeps its rules-first machine with the model step on Gemini 3.5 (or the
Bedrock model of doc 17 §6 when quotas allow). Radha stays the only source of astrological data; Node computes nothing
astrological; English only; declined topics are never facilitated.

---

## 0. Answer first

1. **A reader is taught a category, not a checklist.** Each of the fifteen readers in §2 gets a *curriculum*: what to seek,
   what to highlight, the rules it applies, what counts as important, the patterns to recognise in the data, the sensitive
   points of its category, and the exact shape of what it returns. Today's four prompts (`prompts/v2/*.md`) ask for a list of
   facts; the Archisha readings were made by asking *who holds whom, who can act, when, and what it is doing to the person*.
2. **The Oracle assembles, it does not re-read.** The master on Gemini 3.8 receives the clarified intent (including the new
   `real_want` slot), chooses the tier, dispatches the readers the fetch plan names, counts how many independent layers agree
   on each statement, and writes in the fixed shape of §3.4: essence table → the answer to what they really want to know →
   the mechanism → the saving graces → the windows with who acts when → what to do → pointers kept apart from findings →
   cautions. A statement is a **finding** when three or more layers agree, a **pointer** when one or two do, and the Oracle
   says which.
3. **The Clarify agent hones in on the real question in one to three turns.** The person who asks "how is my relationship
   with my father" usually wants to know one of five things (§4.2). A new criterion `real_want` is asked first whenever the
   area is known, with chips drawn from a per-category table of the questions people actually mean, phrased with the
   category's sensitivity in mind. The two-question cap becomes three, counted the same way as today.
4. **Sensitivity is part of the method, not a filter at the end.** Every category has a sensitive core (§5): a young adult's
   mental state, a parent who is blocking help, a hidden relationship, money shame, a marriage that is failing. The readers
   mark it, the Oracle decides who the answer is for and what it may say to them, and the Clarify agent asks about it only
   as gently as the table allows.
5. **Build order:** curriculum prompts and schema (A-1) → Clarify `real_want` (A-2) → Oracle writer (A-3) → Plan B and
   timeline adoption (B-1, T-1) → evals with the Archisha questions as goldens (E-1). §7 has the phases and gates.

---

## 1. What the Archisha readings did that the engine does not yet do

The four readings answered five requests: a full reading; her issue with each parent, where she herself is, the saving
graces to April 2027 and what each parent can do; the life charter 2026–2030 with relationship and career windows; the
Sun-as-dispositor-of-Rahu and Venus thread; and the explanation of the "natal, always on" graces. Reading the transcript
back, eleven moves recur. They are the curriculum.

| # | Move | Example from the reading | Who does it in the engine |
|---|---|---|---|
| 1 | **Backbone first, cited everywhere.** Lagna lord and its floor, the Moon and its cancellation, the strongest and weakest planet by rank, the functional nature per lagna, the SAV extremes, the running lords in six systems | Sun rank 1 and 6th lord; Venus weakest; Jupiter lagna lord sitting in Saturn's 12th; Mars ⇄ Mercury exchange holding the whole dispositor chain | R1 backbone |
| 2 | **Follow the dispositor chain to its end.** Every weak planet is held by a stronger one except the lagna lord, held by debilitated Saturn | "Routine is not a platitude for her" came from that chain, not from a rule about Saturn | R1, R2 |
| 3 | **Stack the layers for one claim and count them.** D1 → bhava chalit → D9 → D30 → transit at the break → annual sahams | Sun–Rahu: six layers, so a finding. Venus: four natal layers plus a dated trigger stack, so a strong pointer, still not a finding | every reader tags; Oracle counts |
| 4 | **Read the person inside the chart, not only the house.** Mother = Moon (MK) + 4th lord Mercury + D12 4th; father = Sun + Venus (PiK) + 9th + chalit + D12 1st | "The father's planet overpowers Venus matters" (Sun 11.8° from Venus) | R13 person reader |
| 5 | **Say who can act, and when.** The windows are attached to the actor's planet: the Sun's return (Dec 17), Yogini Sun (Dec 23), Patyayini Sun | "Dec 17 2026 – Jan 7 2027 is his best window" | R8, R9, R10, R11 give windows per planet; Oracle joins them to the actor |
| 6 | **Separate the eye of the storm from the repair window.** Nov 8–16 (nodes exact, Jupiter on Rahu): do nothing; Nov 26 – Dec 3 (Sun over Moon–Mercury): listen; Dec 17 onward: act | R10 transit windows with polarity *hold / listen / act* |
| 7 | **Name the saving graces as a standing layer.** Neecha-bhanga, the yogas Radha actually lists (and the one it does not), Jupiter's drishti on 4/6/8, Ketu as 9th lord, the Mantra pada on the lagna | "Natal, always on" | R6 yogas, R4 Jaimini, R2 |
| 8 | **Pointers are kept apart from findings and ranked by fit.** The Venus thread was given as four candidate readings, ranked, with "the chart cannot tell these apart" | "Ask gently or leave it" | Oracle §3.5 |
| 9 | **Dates are graded by their source.** Stored snapshot date / interpolated between snapshots ("about") / public calendar (eclipses: "verify") | "Mars into Leo about Nov 13"; "lunar eclipse about Mar 3 2026 (public calendar; verify)" | every reader marks `date_source`; Oracle prints the grade once |
| 10 | **What to do is derived from the culprit, the actor and the pada.** Sound on the lagna (A5) → japa at home, not the mandir; Sun = physician → "getting her treated is the father's own act"; Venus wound → white daan, no diamond | R14 remedy reader, from R4 and R6 facts |
| 11 | **Answer what they really want to know first.** "What's her issue with her mother" wanted "what can I do, is it my fault, is she possessed, will it pass"; the reading answered those and then the astrology | Clarify `real_want`; Oracle §3.4 order |

Two corrections made during the readings are also rules now: a yoga is quoted only when Radha lists it present (Gaja-Kesari
was not), and a nakshatra lord cluster is counted from the stored `nak.lord` field, not from memory (four planets in Ketu's
stars, not three).

---

## 2. The readers on Gemini 3.5: one curriculum per data category

### 2.1 What every reader shares

**System prelude** (identical for all readers; the cacheable prefix of doc 23 §3.5 starts with it):

```
You are one reader in a Vedic astrology engine (Parashara, Jaimini, nakshatra and Tajaka rules, in the integrated
tradition taught by PVR Narasimha Rao). You read ONE category of computed chart data for ONE question and return
structured findings. You never write prose for the person and never answer the question yourself.

The data are tables of `id = value` rows computed by the calculation engine. Every placement, lordship, aspect, strength,
dasha date and transit date is already computed. Never compute, count signs, re-derive a house, a lord, a dignity, a date
or a strength. Read the field. If a field you need is absent, write a gap naming the id and go on.

Your curriculum (below) says what to seek, what to highlight, the rules you apply, what is important, the patterns to
recognise, and the sensitive points of your category. Apply all of it to this chart and this question; skip nothing that
the data lets you read.

Every claim: one sentence, at most 200 characters, begins with the planet or house it is about, carries 1-4 evidence ids
copied exactly from the rows, a polarity (supports / obstructs / neutral), a weight 1-3 (3 = decides on its own), the
tradition applied (parashara / jaimini / nakshatra / kp_starlord / tajaka), and `about` = who it concerns (self / mother /
father / spouse / child / sibling / other). A claim about a person other than the chart owner is read through that
person's house and karaka in the owner's chart; it is never a reading of the other person's own chart.

Dates: copy them as they appear in the rows (YYYY-MM-DD) and set `date_source` = stored. A date read between two monthly
snapshots is `interpolated` and must be written "about <date>". A date from general knowledge (an eclipse, a festival) is
`external` and must say "verify"; never use your own ephemeris for a planet's position.

Quotes: `id = value` pairs the writer may print verbatim; at most 12, only rows you were given.
Gaps: ids you needed and did not have, with why. Disagree: one sentence when two rules in your category point opposite
ways. Sensitive: one line when your category touches the sensitive core of §Sensitivity for this question, naming it in
plain words, for the master only.

Never: remedies, amounts, medical, legal or financial advice, death timing, anything about a child under 18, the words
"possessed", "cursed", "doomed". Confidence is shown by weight and by the number of claims that agree, never by a
percentage.
```

**User turn** (the tail, after the tables): `TODAY`, `READER`, `SUBJECT`, `FRAME` (houses, lords, karakas, arudhas,
vargas, persons), `HORIZON`, `REAL_WANT` (from the clarifier: the thing the person actually wants to know, one line),
`SENSITIVITY` (the category's sensitive core if the clarifier flagged it), `QUESTION`.

**Output: `findings.v3`** = `findings.v2` (doc 23 §3.2) plus: `about` on each claim, `date_source` on each window and
dated claim, `actors[]` (`{planet, person, can_do, windows[]}` for R8–R13), `graces[]` (standing supports, R2/R4/R6),
`pointers[]` (`{text, fit 1-3, evidence[], alt[]}` for readings the data cannot settle), `sensitive` (one line or empty).
zod-tolerant field by field as in doc 30 (`keepValid`), one repair retry, parse claims one by one.

**Budget**: 3.5 Flash-Lite, temperature 0.2, thinking low, `maxOutputTokens` 6,144 with the doc 30 thinking headroom,
timeout 24 s (required readers retry once), 8–14 claims, ≤ 6 windows, ≤ 3 pointers.

**Which readers run** is decided by the fetch plan (doc 23 §3.1) from the bucket, the tier (doc 26 Part B) and
`real_want`: Tier 1 runs all that the data supports; Tier 3 runs R1, R2, R8, R10; the person readers run only when the
frame names a person; R12 only when a prashna was cast; R15 only in the timeline.

### 2.2 R1 — Backbone (foundation) reader

Runs once per chart, cached by dossier hash; its findings are prepended to every other reader's tables as `backbone.*`.

**Seek:** the ten facts of doc 26 Pass 1, read as *relations*, not a list: who is strongest and what it rules; who is
weakest and what it rules; which planet every other planet depends on; where the lagna lord stands and on whose floor.

**Highlight:**
- Lagna sign, degree, lord, the lord's house, dignity and its own dispositor (`houses.1.lord`, `bodies.<L>.{house,dignity,sign_lord}`).
- The Moon: sign, house, dignity, cancellation if `yogas[]` lists Neecha Bhanga (name the cancelling planet and the
  mechanism: its lord in a kendra from lagna or Moon, or in exchange), nakshatra and star lord, gandanta flag.
- Shadbala rank 1 and rank last with `owns[]` for each (`bodies.*.shadbala.rank`); say in one claim "the strongest planet
  rules houses N and M, so results arrive there; the weakest rules P and Q, so effort goes there".
- Functional nature per lagna (`relations.functional.{benefic,malefic,neutral}`, `yogakaraka`, `marakas`, `dusthana_lords`).
- SAV highest and lowest sign (`ashtakavarga.sav`), and which houses they are.
- **The dispositor chain** (`bodies.*.sign_lord` followed until it loops): write it as a tree, one claim per branch, and
  one claim naming the root loop (exchange or own-sign planet) and *which planet is the weakest link* (a lagna lord or frame
  lord resting on a debilitated or dusthana planet). This claim gets weight 3 whenever the weakest link is debilitated.
- Running lords in every stored system (`dasha.vimshottari.current`, `dasha.yogini.current`, `dasha.narayana.current`,
  `dasha.chara.current`, `dasha.sudasa.current` …) with end dates: one claim per system.
- Named yogas and doshas present (`yogas[]`, `doshas[]` with `present = true` only), one claim each, planets named.
- Chara karakas (`karakas.chara`: AK AmK BK MK PiK PK GK DK) and karakamsa.
- Bhava-chalit shifts: every planet whose `bhava` differs from its whole-sign `house` (`bodies.*.{house,bhava,near_cusp}`):
  one claim each, because the chalit house is where the matter is *felt* (Sun, Moon, Mercury in the 9th bhava for Archisha).
- Double transit and Sade Sati now (`transits.double_transit[]`, `transits.sade_sati.now`).

**Rules:** quote the number with every strength; a yoga absent from `yogas[]` is not mentioned even if the shape is there;
a planet in two lists (strongest and functional malefic) is both, say both.

**Important / patterns:** (a) strongest planet = functional malefic → "her greatest power is in the house of her
affliction" pattern, weight 3; (b) lagna lord in 6/8/12 or on a debilitated dispositor → the self has no floor, weight 3;
(c) three or more planets in one nakshatra lord's stars (`bodies.*.nak.lord` counted from the field) → a Ketu/Rahu/Saturn
"theme" claim; (d) Moon and the 4th lord together → mother and mind are one matter; (e) the exchange that roots the chain.

**Sensitive:** none by itself; it feeds everyone.

**Returns:** `backbone` block (the ten facts as quotes), 10–14 claims, `graces[]` for cancellations and yogas, no windows.

### 2.3 R2 — House and lord (promise) reader, per frame

**Seek:** for each frame house, *whether* the matter is promised, *in what form*, *through whom*, and *who blocks*.

**Highlight (per frame house, in this order):** the house's sign, SAV, occupants with nature; the lord's house, dignity,
retro/combust/near_cusp, shadbala ratio, BAV in its sign; every aspect on the house and on the lord, counted and named
with nature (`aspected_by.graha`, `relations.functional`); argala primary/secondary/obstructed with names; the lord's
dispositor chain to its end (two hops minimum, from `sign_lord`); the natural karaka the same way; yogas in
`detail.yogas` that bind the lord; cusp nakshatra.

**Rules:** SAV ≥ 28 strong / ≤ 22 weak; ratio ≥ 1.0 strong; BAV ≥ 4 good; a lord in 6/8/12 from lagna *or from its own
house* is a culprit; a chain ending in a kendra/trikona holds, in a dusthana leaks, in the frame itself delivers; the
varga is R3's, do not read it here; aspect strength is not in the rows unless `detail.aspects` is present.

**Important / patterns:** the house whose lord *and* karaka are both afflicted (the matter is denied, not delayed); the
house held only by an aspect of Jupiter (a saving grace: put it in `graces[]`); a lord within 12° of the Sun that is not
flagged combust (say "close to the Sun, not combust by the engine's rule; matters of this planet go quiet in the Sun's
presence"); the house the strongest planet rules; a 6th/8th/12th lord sitting in the frame.

**Sensitive:** when the frame is health (1/6/8/12), say what is *strong* first (the 6th house with bhava-bala rank 1 is
"the greatest power to overcome illness", not "illness"); when the frame is 7/5 for a young adult, do not characterise
partners by moral words.

**Returns:** verdict, `form` (empty; R3 fills it), culprits, contributors, graces, 8–12 claims.

### 2.4 R3 — Varga reader

**Seek:** the *form* and the *robustness* of what D1 promised, and the second opinion of the chart of afflictions.

**Highlight:** the subject's varga (D9 marriage and the inner self, D10 career, D7 children, D2 wealth, D4 home, D12
parents, D3 siblings, D24 learning, D30 afflictions, D60 the deep past): varga lagna and lord; `d1_lord_positions`
(where each frame lord lands: house, dignity, vargottama); the same house in the varga; planets in kendras; the frame
lord's *conjunctions by degree* in the varga (`vargas.<D>.planets.<P>.lon` differences under 1° are called "exact"). In
**D30** always: which planets share a sign with the nodes or Saturn, and in which D30 house (the house of the mind, 4, is
the one to name). In **D12** for a parent question: the 1st (father) and the 4th (mother) and the planet in each. In
**D9** always: gandanta degrees (the 29th–30th of Cancer/Scorpio/Pisces and 0–1° of the next), Maandi's sign, the Sun–Rahu
or Moon–Saturn pairs.

**Rules:** the varga refines D1 and never overrules it; one claim states the form in plain words and is copied into
`form`; an exact conjunction in a varga (≤ 1°) is weight 3; a varga reading with no D1 support is a pointer, not a claim.

**Important / patterns:** the same pair conjunct in D1 (by sign), D9 and D30 → "the bond is in every layer" (weight 3,
and the Oracle counts three layers from this one reader: say so in the claim text, `layers = [d1, d9, d30]`); the frame
lord gandanta in D9 → the inner result is at a junction; a planet exalted in D1 and debilitated in D9 (or the reverse) →
form and promise disagree, write `disagree`.

**Sensitive:** D30 names afflictions; write them as *where the pressure lives*, never as diagnoses; D9 Venus patterns
about a young person's relationship are pointers.

**Returns:** `form`, 6–10 claims, pointers for varga-only readings.

### 2.5 R4 — Jaimini reader (karakas, arudhas, argala, rasi dashas)

**Seek:** how the matter is *seen* and *carried*: the chara karaka of the subject, the arudha of its house, the argala
on it, and the rasi dasha that holds the arudha now.

**Highlight:** AK and its dispositor (the planet that *holds* the soul-significator: its rank, nature and relation to AK
from `relations`; if they are enemies say "held by an adversary"); the subject's chara karaka (DK spouse, MK mother, PiK
father, PK children, BK siblings, AmK work) with house, dignity, star; the arudha (AL, UL, A4, A5, A7, A9, A10): sign,
house, lord, occupants, rasi aspects onto it, planets in 2/7/11/12 from it; A5 (Mantra pada) and where it falls (on the
lagna = "sacred sound sits on the body", a remedy fact for R14); karakamsa and the 12th from it (ishta devata line);
argala on the primary house with names; the running Narayana / Chara / Sudasa / Drig sign and whether it holds an arudha
or a frame house, with dates.

**Rules:** Jaimini aspects are rasi drishti, not graha; AL and A7 in one sign → public image and partnership are one
matter; a dasha sign holding UL/A7 opens the relationship window, holding A10 the work window; the AK's dispositor's
weekday and deity are facts for R14.

**Important / patterns:** AK in a dusthana held by the strongest planet; AL with Maandi (the "poison" point on the image);
the Mantra pada on the lagna or the 5th; Sudasa sign change inside the horizon; two arudhas in one sign.

**Sensitive:** the AK reading names the person's central lesson; write it as what the soul is *learning*, never as a
sentence passed on them.

**Returns:** 6–10 claims, graces (A5 on lagna, a benefic on AL), windows from the rasi dashas, actors (the AK's dispositor
as "the one who holds her", with the person it maps to when it is a parent karaka).

### 2.6 R5 — Strength and Ashtakavarga reader

**Seek:** the numbers that settle a split verdict (doc 26 Tier 7) and the capacity of each house to receive a transit.

**Highlight:** shadbala rupas, ratio and rank per planet; bhava bala rank per house (`strength.bhava`); SAV per sign and
BAV per planet in each sign; ishta/kashta; vimsopaka. One claim per frame house and frame lord with the numbers quoted;
one claim for the lowest-SAV sign and what transits it now (`transits.now.*.sav`).

**Rules:** thresholds of doc 26 Pass 2; a verdict from R2 that contradicts the numbers must be explained by a yoga or a
varga (R6/R3), otherwise it is capped at "mixed"; BAV of a transiting planet in the sign it is in = whether that transit
can deliver.

**Patterns:** the 6th or 8th house with the top bhava bala; a planet with kashta ≫ ishta though rank 1 ("powerful but
painful"); SAV ≤ 22 on the house of the mother/mind.

**Sensitive:** none. **Returns:** quotes (all numbers), 6–8 claims, no windows.

### 2.7 R6 — Yoga and dosha reader

**Seek:** what *holds* and what *marks* the chart, from the lists Radha computed.

**Highlight:** every `yogas[]` entry with `present = true`: planets, houses, class; every `doshas[]` present (Kala Sarpa,
Manglik, Guru Chandala, Pitru, gandanta); for each: whether it binds a frame lord, and the mechanism in one sentence
(Neecha Bhanga: who cancels and how; Raja yoga: which lords; Dharma-Karmadhipati: 9th and 10th lords together;
Parivartana: which houses swap). For each dosha, the *condition* it attaches to (Pitru: Moon in the 9th with Saturn's
aspect) so R14 can pick the remedy.

**Rules:** a yoga not in the list is not claimed, even when the shape is visible (Gaja-Kesari by shape but absent from
the list is written as "the 4th-from-Moon Jupiter shape, not confirmed as the yoga by the engine": a pointer, fit 1);
every yoga that supports the frame goes to `graces[]`; every dosha that touches the frame goes to culprits with the
planet that activates it.

**Patterns:** Raja yoga formed partly by a node or by the 9th lord that is a node ("the ordeal is part of the promise");
Neecha Bhanga through the very planet (Mars) that governs body and discipline → the remedy direction is physical; Guru
Chandala with Jupiter as lagna lord → faith and doubt in the self.

**Sensitive:** Pitru dosha is spoken as "ancestor and parent healing is a standing remedy", never as blame.
**Returns:** graces, culprits, 6–10 claims.

### 2.8 R7 — Nakshatra reader

**Seek:** the star layer: who acts through whom, the clusters, the taras, the junctions.

**Highlight:** janma and lagna stars with lord and pada; for every frame lord, karaka and running lord: nakshatra, pada,
star lord, the star lord's house and sign lord, navamsa sign (`nakshatra_profile.star_lords.<P>`); **the cluster count**:
planets whose `nak.lord` is the same (read from the field), one claim naming all of them and the lord; the *meaning* of
the specific star where it is classical and the pack carries the name (Mula: uprooting and denial at the root; Ashlesha:
entanglement and a hypnotic hold; Ashwini: physicians; Anuradha: Saturn's star of devotion under discipline); taras of the
running lords from the janma star; gandanta and pushkara flags; transit nakshatra hits with dates (`transits.rows.*.nak_segments`).

**Rules:** star-lord results come before sign results for timing (KP rule, tag kp_starlord); a slow planet's return to
the same star is the sharpest trigger; the cluster lord's dasha is the theme of the cluster.

**Patterns:** four planets in one node's stars; the father's planet in Mula ("don't look, don't name it"); the Moon and
the 4th lord in the same star (mother and mind in one devotion); Saturn in the physicians' star (the healer is in the
chart).

**Sensitive:** star meanings are tendencies; never "this star makes her X".
**Returns:** 8–12 claims, graces (a healer star, a devotion star), windows from transit-star hits.

### 2.9 R8 — Vimshottari dasha reader

**Seek:** what each running and upcoming lord *gives, withholds, and asks the person to go through*, and what the lord
*can be used for* by an actor.

**Highlight:** MD, AD, PD (and the proportional pratyantar split when Radha stores only two levels: mark those dates
`interpolated`); for each lord: owns, house, dignity, star lord and its house, varga seat, AD-from-MD and PD-from-AD
counts, class (deliverer / supporter / neutral / obstructor, doc 02 rules); **the ending mahadasha rule**: in the last
two years of an MD, one claim on what that lord wants completed (Ketu: detachment from false supports before Venus
gives relationships; Saturn: structure; Rahu: the obsession spent); **the AD lord as a tool**: when the AD lord is a
functional benefic with the top ishta, one claim on the *activities* it rewards (Mercury: speech, writing, counting,
structured spoken work, short daytime conversations) and *who* in the chart it is (the 4th lord = the mother can use it);
the next boundary and the next lord's class.

**Rules:** a planet gives the results of the houses it owns, occupies, and above all the houses its star lord owns and
occupies; Narayana is R4's; the PD inside the horizon is the skeleton of the windows; friction counts (6/8/12 between
levels) lower a class one step.

**Patterns:** the weakest planet's AD inside a strong MD ("effort is needed exactly here"); the ending MD being the lord
of the 9th (grace through the ordeal); the next MD being the frame karaka (the relationship era opens on a date: say the
date); the PD lord being the dispositor of the actor's planet.

**Sensitive:** the ending-MD claim describes a *passage*, never "you will lose X".
**Returns:** windows per period with fruit, actors (`{planet, person, can_do, windows}` for the AD lord and any lord that is
a person's karaka), 8–12 claims.

### 2.10 R9 — Secondary dasha reader (Yogini, Narayana, Chara, Sudasa, Drig, Ashtottari, Kalachakra when stored)

**Seek:** independent confirmation of R8's windows, and the single system that changes lord *inside* the horizon.

**Highlight:** for each stored system: the running lord or sign, its dates, and the frame houses/arudhas it activates;
one claim per system; a **convergence claim** naming every system whose lord or sign touches the same frame in the same
window ("Rahu is Yogini lord Nov 8–Dec 23 while Chara runs the 6th and Narayana enters Aries on Nov 17: three systems on
illness, family and the self at once"); for the horizon, the **first boundary** in any system and what it changes to.

**Rules:** confirmers cannot open a window alone (doc 29 §3.2); one planet, one vote across systems; the Yogini lord's
weekday and the Yogini's name are facts for R14; Sudasa holding the Moon's sign colours mood.

**Patterns:** the same planet running in two systems (one vote, but a theme); a sign dasha entering the house of the
weakest-link planet (Aries with debilitated Saturn); a two-year Yogini turning to the father's planet on a date (the
father's window).

**Sensitive:** none. **Returns:** windows with `systems[]`, actors when the lord is a person's karaka, 6–10 claims.

### 2.11 R10 — Transit reader (slow planets, contacts, stations, nodes, eclipses)

**Seek:** the dated triggers, graded by source, and their *polarity for action*: hold, listen, act.

**Highlight:** `transits.now` for Sa/Ju/Ra/Ke/Ma with house from lagna, Moon and AL, `over_natal`, `influences_houses`,
sav/bav; every row touching the frame with from/to; **exact contacts** (`transits.contacts`, ±2° natal degree) with the
exact date; stations and retrograde loops over a frame lord (three crossings = the matter is revisited; say the dates);
the nodes' axis and the date they leave it; double transits; Sade Sati; **ingress dates read between snapshots** written
"about" with `interpolated`; eclipses only when Radha serves them, else `external` with "verify" and never as the reason
for a verdict; a transit planet on a *saham* when the annual pack is present (R11 provides the saham degrees).

**Rules:** transits trigger what the chart and dasha promise; Jupiter on a frame point gives; Saturn on a lord delays
and tests; Rahu inflates, Ketu detaches; the lowest-SAV sign is friction whoever transits it; **polarity for action**:
a window with two or more exact malefic contacts is `hold` (do nothing new); a luminary over the Moon/Mercury/4th lord is
`listen`; a benefic return or the Sun's return to its natal degree is `act`; a retrograde over the 8th lord is `do not pry`.

**Patterns:** nodes exact on the natal nodes (the reverse nodal return) → the "eye of the storm" week; Jupiter and Mars
both on natal Rahu within days; the Sun crossing the Moon–Mercury pair = the father's attention reaches mother and
daughter; Venus retrograde in its own sign in the 8th while the Patyayini is Venus = an old private matter close to the
surface; a planet's return to its natal degree inside the horizon.

**Sensitive:** never attach a transit to an outcome for a third person ("your father will …"); attach it to *what he can
do*.
**Returns:** windows with `action` ∈ {hold, listen, act, do_not_pry} and `date_source`, 10–14 claims, actors.

### 2.12 R11 — Annual reader (Varsha / Tithi Pravesha, muntha, year lord, sahams, Mudda / Patyayini)

**Seek:** the year's theme and the *named events* of the year, and which planet runs the month.

**Highlight:** the year lagna and its natal house; the year lord; muntha; planets in the annual kendras; **every saham
with its lord's condition** (Vivaha, Putra, Karma, Vyapara, Yatra, Santapa, Paradara, Kali, Jadya, Roga …), and any saham
within 2° of a natal planet (Santapa on natal Venus: "grief attached to Venus this year") or on the year lagna with a
node; the Mudda and Patyayini periods with dates, and which of them *overlap a Vimshottari sub-period of the same planet*
(two timing systems agree to the week: weight 3).

**Rules:** the annual chart confirms, it does not open a verdict (doc 11); sahams are Tajaka and tagged so; a saham on a
natal point is a pointer unless two other layers agree; the year runs birthday to birthday, say the dates.

**Patterns:** Jadya saham on an eclipse degree; Paradara with Rahu on the year lagna (the forbidden or unavailable);
the Mudda of the weakest planet overlapping its Vimshottari PD; the Patyayini turning to the actor's planet.

**Sensitive:** Paradara, Kali and Santapa sahams name private matters; they go to `pointers[]`, never to claims about a
third person.
**Returns:** windows (Mudda/Patyayini), pointers, 6–10 claims.

### 2.13 R12 — Prashna reader (the chart of the question moment)

As doc 28: the prashna lagna and lord, the Moon, 11th and 5th, the Tajaka aspects, the panchanga of the moment, the
natal overlay. One extra claim for the Oracle: **does the moment confirm or nudge** the natal verdict (±1 step, never
alone). Sensitive: none. Returns ≤ 6 claims, no windows beyond the day.

### 2.14 R13 — Person-in-the-chart reader (mother, father, spouse, child, sibling)

Runs when the frame names a person. **This is the reader the parents reading was made with.**

**Seek:** the *relationship* between the chart owner and that person as the owner's chart shows it, the person's own
condition as the owner's chart shows it, and what that person *can do* and *when*.

**Highlight (per person):**
- The three signifiers together: the house (4 mother, 9 father, 7 spouse, 5 children, 3/11 siblings), its lord's state,
  the natural karaka (Moon, Sun, Venus/Jupiter, Jupiter, Mars) and the chara karaka (MK, PiK, DK, PK, BK) with their
  houses, dignities, stars and dispositors.
- **The person's planet in relation to the owner's affliction**: is it the dispositor of the AK or of the afflicting node
  (the father's planet *holds* her Rahu)? Is it conjunct the owner's Moon or 4th lord (the mother and the mind are one)?
  Its distance in degrees from the owner's weakest planet (Sun 11.8° from Venus: "in his presence her Venus goes quiet").
- The varga of the relationship: D12 for parents (1st father, 4th mother), D9 for spouse, D7 for children, D3 for
  siblings: the person's house there and who sits in it.
- **What the person is like in this matter**, from the karaka's star and dignity, written as *capacities and limits*:
  "capable and prominent (rank 1, 10th) but in Mula (denial at the root) and 6th lord (friction)".
- **What the person can do**: from the karaka's natural significations (Sun = physician, dignity, authority; Moon =
  nourishment, routine, water; Mercury = speech, counting, structured work; Venus = comfort, art, women), and from the
  pada/arudha facts (A5 on the lagna → sound at home). Written as `can_do` on an actor.
- **When the person can act**: the windows R8–R11 attached to that planet (its return to its natal degree, its Yogini or
  Patyayini period, its PD), joined here into `actors[]`.
- **What the person needs for themself**: the karaka's own affliction (the Moon debilitated → the mother's own
  capacity is low; say what tends her: being tended, Monday observance, water, routine), so the Oracle can write the
  "what the mother can do for herself" paragraph.

**Rules:** everything is read from the owner's chart; the person's own chart is a separate reading (T8, not built).
A parent's planet that is a functional malefic for the owner is "brings friction and pressure", never "a bad parent".
Repair windows are the luminaries' contacts with the other parent's signifiers (the Sun over the Moon–Mercury pair).

**Patterns:** the father's planet is the dispositor of the AK ("held by him, experienced as control"); the father's
planet is also the DK (the father sets the template for the partner); mother-karaka and 4th lord conjunct in the
father's house (the mother is close, deeply felt, easily bruised, and lives inside the father's domain); the parent's
planet in the 6th/8th from the owner's Moon; a parent-karaka in a healer's star.

**Sensitive (always on for this reader):** the owner may be a young adult in distress and the asker may be the parent.
Write what the parent *can do*, what the parent *needs*, and where the parent *looks away* (from the star and dignity),
in that order; never "the father is blocking help": say "the Sun in Mula tends to cut a thing off at the root; turned
toward her, the same Sun is the physician". The `sensitive` line names the real situation plainly for the master only.

**Returns:** actors (one per person: `{planet, person, condition, can_do[], needs[], windows[]}`), 10–14 claims with
`about` set, graces (a benefic holding the relationship), pointers.

### 2.15 R14 — Remedy and counter-action reader

Runs after reconcile, on the culprits, graces and actors already grounded (doc 32 §1.3 rules as data; this reader only
*selects and phrases*).

**Seek:** for each culprit: strengthen or pacify; for each actor: the practice that is *theirs*; for the owner: the
practice the chart itself points to.

**Highlight:** culprit role and functional nature → mode; the AK's dispositor → its deity line and weekday as the central
observance; A5 on the lagna/5th → sound-based practice at home ("japa, chanting, singing; works better at home than in
a temple when the person resists the temple"); the healer star (Ashwini) → "getting treated is the remedy of that
planet"; the Moon's state → Moon-side items; doshas → one shanti each; windows → start day and `until`; **what not to
do**: no gem for a functional malefic or a planet that carries the wound (Venus retrograde in the 8th: "no diamond now;
purify first, support only when its own dasha begins on <date>").

**Rules:** no amounts, no medical claims, "the doctor's plan comes first" once when health is in the frame; the remedy
for a parent is phrased for the parent; the strongest remedy is the one that coincides with the actor's own planet
(the father does Aditya Hridayam; the mother reads the Lalita Sahasranama).

**Sensitive:** never a remedy for "possession" or for "a curse"; the fear itself is read (Saturn gandanta on the lagna
→ "a primitive fear, the kind that does not need a reason") and met with routine and sound, not exorcism.

**Returns:** `RemedyPlan` (doc 32) with `for_whom`, ≤ 3 items per person, ≤ 8 claims.

### 2.16 R15 — Ledger reader (timeline only)

Deterministic matching is doc 29 §5. This reader writes the *annotation* for a matched past event: which gate fired
(D, T, E), through which planet and house, in one sentence per event, with the trust prior and the chart's own hit rate
quoted. It never changes a score. Sensitive: the ledger holds illness and death of relatives: facts only, no judgement
words (the ledger checks already enforce this). Returns ≤ 20 annotations.

---

## 3. The Oracle on Gemini 3.8: orchestrate and assemble

### 3.1 What the Oracle receives

- `intent` from the clarifier: bucket, sub-bucket, horizon, persons, **`real_want`** (one of the per-category ids of
  §4.2 with its plain-English line), `sensitivity` (the category's sensitive core, when flagged), `asker` (self / parent
  / partner / other), the exact query the person confirmed.
- The **tier** (doc 26 Part B) chosen by rules: `real_want` ∈ {why, what_can_i_do, is_it_serious} or two or more persons
  → Tier 1; a single "when" → Tier 4; "this month" → Tier 5; explain → Tier 8.
- The **fetch plan** (doc 23 §3.1) extended by `real_want` and persons: which of R1–R15 run and which tables they get.
- The readers' `findings.v3`, the deterministic reconcile output (grounding gate, windows, deciders, convergence,
  fortune, now/next; doc 11/19), and the Plan B cards when the bucket is one of theirs (pressure map, mood, luck).

The Oracle never sees raw tables (doc 23 §3.3). It sees VERIFIED FACTS, CLAIMS (grounded only, with `about`, tradition and
layer), ACTORS, GRACES, POINTERS, WINDOWS (with `date_source` and `action`), GAPS, SENSITIVE lines, and the template.

### 3.2 The system prompt (the master's curriculum)

```
You are the Oracle: the one voice of a Vedic astrology reading assembled from the findings of specialist readers. You
write for the person who asked, in plain, kind, exact English, in the integrated Parashari–Jaimini tradition. You never
compute, never add a placement, date or yoga that is not in VERIFIED FACTS or a grounded claim, and never guess.

Your task is to answer WHAT THE PERSON REALLY WANTS TO KNOW (REAL_WANT) first, then what they asked, then show how the
chart says it. The person is intelligent and may be frightened; you are a concerned, honest reader, not a fortune-teller
and not a clinician.

How you weigh: a statement is a FINDING when three or more independent layers agree on it (a layer is one of: D1
placement, bhava chalit, a varga, Jaimini, nakshatra, Vimshottari, a second dasha system, transit contact, annual
chart, prashna). Count the layers from the claims' evidence and traditions and say the count in "How I read this". A
statement with one or two layers is a POINTER: you give it as a possibility, ranked by fit, with "the chart cannot tell
these apart" when the alternatives are listed, and you say what would settle it. Never present a pointer as a finding.
The convergence rule stands: a verdict is strong only when promise, period and trigger agree; say which layer disagrees.

How you order (every tier uses the same order, cut shorter at lower tiers):
1. ESSENCE: a table of the four to six facts that decide everything (planet, what it is in this chart, what it does).
2. THE ANSWER to REAL_WANT, in 2–5 plain sentences with dates, no chart words, then the direct answer to the question
   as asked.
3. THE MECHANISM: the astrology, one short paragraph per deciding house or planet, each sentence naming the planet and
   the field it rests on, the dispositor chain followed to its end, layers counted.
4. THE SAVING GRACES: what holds, natal and always on (cancellations, yogas, Jupiter's drishti, the arudha that helps),
   then what holds in this horizon (the period lord that is a friend, the transit that gives).
5. THE WINDOWS: a dated table — window, what runs (period and transit), what it brings, what to do (hold / listen / act /
   do not pry), and WHO can act when an actor is attached. Eye-of-the-storm windows are marked and are never windows for
   decisions. Dates carry their grade: stored dates plain, interpolated dates "about", external dates "verify".
6. WHAT TO DO: from the remedy reader only, per person when there are actors, the practice that is theirs and when to
   start; the doctor's plan first when health is in the frame; nothing that costs money by amount.
7. POINTERS, if any, in their own section, ranked, with how to receive the matter (who should ask, when, how).
8. CAUTIONS: the gaps, the date grades, "a reading of tendencies", the layers that were missing.
"How I read this" (collapsed) carries the chains and the layer counts and repeats nothing from the body.

How you speak to a sensitive matter (SENSITIVITY is set): you name the real situation plainly once, in the person's
words, and then read it as a passage with a shape and dates. You never use "possessed", "cursed", "doomed", "will
lose", "will die". A third person is described by what they can do and what they need, never by a verdict on them. If
the asker is a parent about an adult child, the reading addresses the parent's choices; it does not diagnose the child.
When a pointer is private (a relationship, a substance, an exposure), you say who should receive it and that it is
not for the family to handle alone when it would be a matter for clinicians or protection.

Words: Sanskrit terms with a gloss on first use; confidence only as strong indication / moderate indication / weak
or possible / not indicated, plus the layer count; no percentages; no remedies outside section 6; no amounts, medical,
legal or financial advice beyond the indication; nothing about a child under 18; nothing on a declined topic.

Length: Tier 1 up to 2,500 words plus tables; Tier 2–3 1,200; Tier 4–5 700; Tier 8 300. Stop at the cap.
```

### 3.3 The procedure (nodes the Oracle drives; the graph stays doc 04/19)

```
intent (with real_want, persons, sensitivity, asker)
  → tier (rules) → fetch plan (rules: readers + tables) → ensureChartData
  → R1 backbone (cached) → fan-out of the chosen readers (3.5 Flash-Lite, parallel; required = the tier's set)
  → reconcile (deterministic): grounding of ids and quote values; windows merged and cut at boundaries;
     layer count per statement (group claims by normalised text + about; count distinct traditions/layers);
     actors joined (planet → person → windows of that planet from R8–R11); graces merged; pointers ranked by fit;
     Plan B cards attached when the bucket is theirs; SynthBrief v3
  → R14 remedy (3.5, after reconcile, when the tier or real_want asks for "what to do")
  → ORACLE (3.8, streamed): template of §3.4, thinking medium, cache on persona + curriculum + template
  → grounding post-check on the prose (every date and placement maps to a verified fact); persist with the brief
```

Latency: the reader fan-out is bounded by the slowest required reader (24 s cap); R13 and R9 are usually the slow ones.
First token of the Oracle ≤ 12 s at Tier 1 is the target; the brief is ~3–4k tokens at Tier 1.

### 3.4 The assembly template (`templates/T11-oracle.md`)

```
## In one look
| What | In this chart | What it does |   (4–6 rows, from ESSENCE)

## What you want to know
(2–5 sentences answering REAL_WANT; then one paragraph on the question as asked; dates in both)

## What is going on, in the chart
(one short paragraph per deciding planet or house; layer count in brackets at the end of a finding: "[5 layers]")

## What holds
**Always on:** … **In this period:** …

## The windows
| Window | What runs | What it brings | Do | Who |

## What to do
(per person when there are actors; otherwise for the person)

## Something the chart points at, not a finding   (only when POINTERS is non-empty)
1. … (fit 3) 2. … (fit 2) — "The chart cannot tell these apart. …" — How to receive it: …

## Cautions
<details><summary>How I read this</summary> chains, layer counts, gaps </details>
```

T11 is the Tier 1 shape; T2–T10 keep their forms but gain the "What you want to know" block first and the layer count
rule (doc 09 §1 rule 1 becomes "Answer REAL_WANT first").

### 3.5 Findings versus pointers: the counting rule (deterministic, in reconcile)

- Normalise each grounded claim to `(subject planet/house, about, predicate class)`; the predicate class comes from the
  reader (`bond`, `holds`, `blocks`, `gives`, `window`, `form`, `grace`).
- A *layer* is the tradition plus the data family of the evidence ids (`d1`, `chalit`, `varga.dN`, `jaimini`, `nakshatra`,
  `vimshottari`, `dasha.<other>`, `transit`, `annual`, `prashna`). R3's `layers[]` on a multi-varga claim counts each varga.
- `layers(statement)` = number of distinct layers across the claims in the group. ≥ 3 → finding; 1–2 → pointer, unless
  the single layer is a weight-3 Vimshottari or a weight-3 promise claim, which stays a claim but is written as
  "moderate indication".
- Pointers from R3/R11/R13 keep the reader's `fit` and `alt[]`; the Oracle prints at most three, ranked.

---

## 4. The Clarify agent: finding what they really want to know

### 4.1 What changes in the machine (doc 17)

| Today | New |
|---|---|
| criteria: bucket, horizon, child_age, subject_person, sub_bucket, other_person (+ sibling, location) | add **`real_want`**, asked **first** once the bucket is known with ≥ 0.70 confidence (after `child_age`, which stays uncapped) |
| `MAX_QUESTIONS = 2` | **3**; `child_age` and `location` stay uncapped; the proposal still states every default assumed |
| chips from the taxonomy sub-buckets | `real_want` chips from the per-category table of §4.2 (4 chips + free text), phrased by the sensitivity column |
| proposal: "I will read: … over …, using …" | adds "**so that you know** <real_want line>" and, when a person is named, "(read from your chart, through your <house> and <karaka>)" |
| model step: phrase + resolve free text (Bedrock, rules first) | same two uses plus one new: **infer `real_want` from the question text** before asking (3.5 Flash-Lite, 900 ms, JSON `{real_want, confidence}`); if confidence ≥ 0.8 the slot is filled and the question is not asked; the person sees it in the proposal and can change it |
| coaching cards (doc 17 §6a) | each card gains a "what people usually want to know here" line, drawn from the same table |

The rules stay in charge of *what* is asked; the model only infers, phrases and resolves. All three model uses fall back to
the rules on any error. The classifier's confidence and the `real_want` inference are both logged on `reading_runs.intent`.

### 4.2 The real-want table (per bucket; ids are stable, the lines are what the chips say)

The *sensitive core* column is what the Clarify agent must not poke at directly and what the Oracle must address first.

| Bucket | `real_want` ids (chips, in order) | The hidden question each one carries | Sensitive core |
|---|---|---|---|
| love_relationships | `will_it_last`, `is_this_the_one`, `why_distance`, `what_should_i_do` | "am I wasting my time", "is it me", "should I leave" | a relationship the family does not know of; a breakup still raw |
| marriage | `when`, `will_it_happen_at_all`, `why_delayed`, `arranged_or_own` (+ `is_it_failing` for marriage_health) | "is something wrong with me", "is my family's pressure right", "is it over" | separation, infertility, family pressure |
| career_job | `should_i_move`, `am_i_stuck`, `recognition_coming`, `what_suits_me` | "am I failing", "will it ever change", "is my boss the problem" | being fired, humiliation at work |
| money_wealth | `will_it_ease`, `where_is_the_leak`, `is_a_gain_coming`, `should_i_take_the_risk` | "am I in trouble", "is it my fault", "will I be ok" | debt shame, a loss hidden from the family |
| business | `will_it_work`, `partner_trust`, `when_to_start`, `why_stalled` | "am I about to lose everything", "is my partner honest" | partner betrayal, money borrowed from family |
| property_vehicles | `when`, `will_it_go_through`, `right_place`, `dispute` | "will I lose the deposit", "is the dispute winnable" | family property dispute |
| education | `will_i_clear`, `which_field`, `abroad_or_here`, `why_cant_i_focus` | "am I not good enough", "is my mind the problem" | failure, the mind |
| health_windows | `is_it_serious`, `when_does_it_ease`, `what_can_i_do`, `why_now` | "am I going to be ok", "is it in my head" | the body, the mind, the doctor relationship |
| family_children (children) | `when_a_child`, `why_not_yet`, `will_my_child_be_ok`, `what_can_i_do_for_them` | "is it me", "did I cause this", "will they come back to us" | infertility; an adult child in distress; a child who has withdrawn |
| family_children (parents_siblings) | `why_the_distance`, `what_can_i_do`, `is_it_me`, `will_it_pass`, `their_wellbeing` | "is the fault mine", "am I a bad son/daughter", "is my parent ill" | a parent's decline; a rift; a parent who looks away |
| foreign_legal | `will_i_get_to_go`, `will_i_win`, `when`, `should_i_settle` | "will I be stuck here", "will I lose" | a case with family on the other side |
| spirituality_direction | `what_am_i_for`, `why_this_phase`, `what_practice`, `who_am_i_really` | "is there a point to this", "is something wrong with me spiritually" | fear of being "possessed" or cursed; a withdrawal from temple or faith that frightens the family |
| time_window_outlook | `when_does_it_ease`, `what_is_this_about`, `what_to_watch`, `what_can_i_do` | "will it get worse", "is it a curse" | same as above |
| state_of_mind (doc 32) | `why_do_i_feel_this`, `when_does_it_ease`, `what_can_i_do`, `is_it_serious` | "am I losing it", "is it just the stars" | the mind |
| will_it_happen (doc 32) | `how_likely`, `by_when`, `what_tips_it`, `what_if_not` | "should I count on it" | — |
| remedy (doc 32) | `for_what`, `which_planet`, `how_long`, `for_whom` | "will it work", "is it safe" | money asked by others; fear |

The table is data (`src/reading/clarify/realWant.ts`), tested like the taxonomy: every id has a line ≤ 18 words, no
declined topic in a chip, no "possessed/cursed" in any line, and the sensitive core is never a chip.

### 4.3 How it asks (phrasing rules for the Gemini 3.5 model step)

```
You help a Vedic astrology app find what a person really wants to know, in one short question. You never answer and
never give astrology. Reply with ONE JSON object only.

Given the question, the life area, the running period (optional) and the four options, write the question so that it
(1) names the area in the person's own words, (2) offers the four options as the things people usually mean here, in a
warm, non-clinical tone, (3) never names the sensitive core directly: ask "what do you most need to know" rather than
"is she ill", (4) is at most 18 words, (5) assumes nothing about fault, illness, possession, money or death.
Return {"question": "..."} with the chips unchanged.
```

Examples (produced by the rules; the model may rephrase within the limits):

- "How is my relationship with my father?" → *What do you most want to know about you and your father?*
  `[Why the distance] [What I can do] [Whether it's me] [Whether it will pass]` → *Whether it will pass* →
  proposal: "I will read you and your father over the next 12 months, through your 9th house and the Sun, so that you
  know whether this passes and when. [Yes, read it] [Change]".
- "My daughter isn't herself since February, she won't go to the mandir, we don't know what to do" (asker = parent,
  child_age asked first → 18 or older) → *What do you most need from this reading right now?*
  `[What I can do] [Why this is happening] [When it eases] [Whether it is serious]` → *What I can do* → proposal: "I
  will read your daughter's situation from your chart, through your 5th house and Jupiter, so that you know what you
  can do and when. Her own chart would say more; I can read it if you add her birth details."
- "Will I get the promotion?" → `real_want` inferred `recognition_coming` at 0.9 → no question; proposal says "so that
  you know whether recognition is coming and when".
- "Hello" → area question first (unchanged), then `real_want`, then horizon: three questions, the cap.

### 4.4 What the slot does downstream

`real_want` selects the tier (§3.1), adds readers to the fetch plan (`what_can_i_do` → R14 and the person readers;
`is_it_serious` → R3 D30 and R5; `why_*` → R1, R6, R7 in full), chooses the opening block of every template, and is
written into the `SENSITIVITY` line for the readers when the table marks a sensitive core. It is stored on the run
(`intent_confirmed.real_want`) so evals can check that the answer's first block addresses it.

---

## 5. Sensitive categories: what to say, to whom

| Category | The sensitive core | Readers that mark it | The Oracle says | The Oracle never says | Who receives a pointer |
|---|---|---|---|---|---|
| A young adult's mental state (asker = parent) | breakdown, withdrawal, fear, "possessed" | R1 (Moon, Saturn gandanta), R2 (1/4/6/8/12), R3 D30, R13 | what the parent can do, what she needs, the passage's shape and dates, "the doctor's plan first" | a diagnosis; "possessed"; "will recover by"; anything the child's own chart would be needed for | the parent, phrased as their action |
| A parent who looks away | the father's planet in Mula, Sun as 6th lord, dispositor of the AK | R13, R7 | "turned toward her, the same Sun is the physician"; the discreet route that meets both his fear and her need | "he is blocking help"; blame | the other parent, or the father as "his own act" |
| A hidden relationship or exposure | Venus–Rahu in the 12th, Paradara saham, D9 Ashlesha Venus, 8th lord | R3, R11, R10 | ranked possibilities; who should ask, when, how; "not for the family to handle alone" when it would be exploitation | a named act; "she has done X" | a woman (mother or female therapist), never the father first |
| Substances | Venus–Rahu 12th, 8th lord retrograde | R10, R11 | "if there is any chance of it, her doctor needs to know now" | moral words | the clinician |
| Marriage failing | 7th lord afflicted, UL with a node, D9 6/8/12 | R2, R3, R4 | the window in which it is decided, what holds, what the person can do | "it is over"; "your spouse is …" | the person |
| Infertility, loss of a child | 5th/PK afflicted, D7 | R2, R3 | tendencies and windows, "a doctor's finding comes first" | "you cannot"; timing of loss | the person |
| Debt, money shame | 2/11 weak, 6/8/12 lords running | R2, R8 | where the leak is (house), when it eases, the gain window if any | amounts; "you will lose" | the person |
| A parent's decline or death | 9/4 lords, maraka periods | R13 | the parent's wellbeing as a tendency; what the person can do for them | timing of death (declined) | the person |
| Self-harm cues | — | intake | the fixed supportive reply (doc 24), no reading | — | — |

Rules under the table: the sensitive line is for the master, never printed; a pointer about a third person is given to
the asker as *how to receive it*, not as a fact about that person; the Oracle names the real situation once in the
person's own words and then reads it as a passage with dates.

---

## 6. What this changes in each plan

### 6.1 Plan A (docs 23, 25, 26, 30)

| Area | Change |
|---|---|
| Readers | four prompts become fifteen curricula (`prompts/readers/R01-backbone.md` … `R15-ledger.md`) on 3.5 Flash-Lite; `findings.v3` schema; the fetch plan picks the set per tier and `real_want` |
| Backbone | R1 runs once per chart and is cached; its quotes are the second block of the cacheable prefix (doc 23 §3.5), which also lifts the prefix over the 4,096-token cache minimum |
| Reconcile | layer counting (§3.5), actors join, graces merge, pointer ranking, date grades, action polarity on windows |
| Writer | the Oracle on 3.8 Flash with the §3.2 prompt and T11; T1–T10 gain the REAL_WANT block; thinking medium |
| Tiers | the tier is chosen by `real_want` and persons as well as by the question type (§3.1); Tier 1 = the Archisha depth |
| Failures | doc 30 handling unchanged; R13 and R9 get the 24 s budget; an optional reader never holds the join |
| Cost (est., doc 23 prices) | Tier 1: 8–10 readers × ~9k in / 1.2k out on 3.5 Flash-Lite ≈ $0.045 + Oracle 4k in / 2.5k out + 1k thinking on 3.8 Flash ≈ $0.016 → **≈ $0.06 per Tier 1 reading** (≈ $0.09 after the 2027-01-01 Flash repricing); Tier 3 ≈ $0.03; Tier 8 ≈ $0.01 |

### 6.2 Plan B (doc 32)

| Module | Change |
|---|---|
| Pressure map | the narrative call becomes the Oracle with `real_want ∈ {why_do_i_feel_this, when_does_it_ease, what_can_i_do, is_it_serious}`; R13 runs when the pressure's dominant house is 4 or 9 (a parent is in it); the pressure map's `pressers[]` are the Oracle's culprits |
| Mood today | unchanged (deterministic); the three templated lines are phrased with the sensitivity rule when `baseline.capacity = weak` |
| Luck now / prediction | unchanged math; the `yes_no` answer opens with `real_want` (`how_likely` / `by_when` / `what_tips_it`) |
| Remedy | R14 replaces the "one short model call": it phrases per person from the actors, applies the no-gem and sound-on-the-lagna rules, and the "what not to do" line |
| Buckets | `state_of_mind`, `will_it_happen`, `remedy` get `real_want` rows (§4.2) |

### 6.3 The 18 + 18 timeline (docs 27, 29)

| Area | Change |
|---|---|
| Foundation | R1 is the foundation pack's reader; its dispositor tree and bhava-chalit shifts are added to the pack (doc 27 A.1 item 4 gets the chalit column) |
| Ledger interview | runs through the Clarify agent with `real_want` for the timeline: `what_happened_when` (the interview), `why_did_that_happen` (annotation), `what_is_coming`, `what_to_watch` — one to three questions, same cap |
| Past half | R15 annotates matched events for the person ("your 2014 job change: Saturn AD with Saturn as 10th lord, Jupiter on the 10th, an AD edge: three gates") so the calibration is explained, not just applied |
| Future half | the Oracle writes the 18-year charter in the §3.4 order per marker (essence → windows with who acts → what holds → pointers), with the doc 29 bands as the confidence words and the chart's own density line ("one of this chart's 8 % strongest months for work") |
| Persons | R13 runs for the family markers so "what can my mother do for herself" has a place in the timeline too |
| Transit range | R-T1 (doc 29 §7) stays the prerequisite; until it lands, R10 marks every future contact `interpolated` and the Oracle says so once |

---

## 7. Build phases, owners, gates

| # | Work | Owner (session) | Files it owns | Gate |
|---|---|---|---|---|
| **A-1 Curricula and schema (4–5 d)** | `prompts/readers/R01…R15.md` from §2 verbatim; `findings.v3` zod + neutral JSON schema; reader registry (`nodes/readers.ts`: id, required-by-tier, tables, budget); fetch plan rows per bucket × tier × `real_want`; R1 cache by dossier hash; prompt version bump | dev-reading | `src/reading/prompts/readers/*`, `nodes/readers.ts`, `nodes/specialists.ts` (rename path kept), `chartData/plan.ts`, `types.ts` | `tsc` clean; unit test per reader: on golden chart G1 the reader returns ≥ 8 grounded claims, every quote resolves, every window has `date_source`; the four existing specialists keep passing their tests behind `READING_FINDINGS=v2` |
| **A-2 Clarify `real_want` (2–3 d)** | `clarify/realWant.ts` table; machine: criterion, order, cap 3, proposal text; planner: infer + phrase + resolve on 3.5; coaching lines; SSE `clarify` event carries `realWant` | dev-clarify (parallel with A-1) | `src/reading/clarify/*`, `src/reading/coach/content.ts`, `routes/clarifyRoutes.ts` | every bucket has 4 chips, none trips the declined gate; the §4.3 examples reproduce from the rules; cap and defaults tests; model step falls back on error |
| **A-3 Reconcile v3 and the Oracle (4 d)** | layer counting, actors join, graces, pointers, date grades, action polarity; `SynthBrief v3`; `templates/T11-oracle.md`; REAL_WANT block in T1–T10; Oracle prompt; `READING_MODEL_SYNTH=gemini-3.8-flash`, `READING_MODEL_READER=gemini-3.5-flash-lite` as the documented defaults (env, through the deploy session) | dev-reading (after A-1) | `nodes/reconcile.ts`, `grounding/*`, `prompts/synth.md`, `prompts/templates/*`, `run.ts` | byte-stable brief test; on G1 the Tier 1 answer has the eight sections in order, every date maps to a verified fact, no forbidden word; layer counts in "How I read this" match the deterministic count |
| **B-1 Plan B adoption (2 d)** | pressure narrative → Oracle; R13 trigger on house 4/9; R14 as the remedy node; `real_want` rows for the three buckets | dev-reading (after A-3, X-1/X-2 of doc 32) | doc 32 files | the pressure reading of the reference chart names the same culprits and adds the actor line |
| **T-1 Timeline adoption (2 d)** | R1 as foundation reader; R15 annotation; ledger interview through Clarify; Oracle charter template per marker | dev-timeline (after A-3; R-T1 independent) | `src/reading/timeline/*` | annotations on G1's matched events cite the gate and planet; charter renders for one marker with bands as words |
| **E-1 Evals (2 d, then ongoing)** | add the Archisha questions (anonymised, with the stored data as fixture G3) as goldens: the parents question, the saving-graces question, the "what can her mother do with the Mercury AD" question, the Sun-as-dispositor question, the life-charter question; `proseMustMention` lists from the readings; a blind rubric by a second model on: answered `real_want` first, findings vs pointers separated, actor windows dated, sensitivity rules kept | eval session | `evals/*`, `evals/fixtures/G3` | ≥ 5 of 5 new goldens green; no `forbid` hit; the rubric's "sensitivity" score ≥ 4/5 on every golden |

A-1 and A-2 run in parallel on disjoint files; A-3 waits for A-1; B-1 and T-1 wait for A-3 and can run in parallel.
Deploy of the env defaults and any quota request for 3.5/3.8 goes through the deploy session. No migration: `real_want`
lives in the `intent` JSON (M4 columns); `findings.v3` is JSON in `reading_runs.findings`.

---

## 8. Risks and open points

- **Fifteen readers at Tier 1 is more calls**, not more cost: 3.5 Flash-Lite readers are ~75 % of a Tier 1 reading's cost
  and still under five cents. The latency risk is real: the fan-out is bounded by the slowest reader, so the registry
  marks R5, R6, R9, R11, R12 optional (never hold the join) and only R1, R2, R3, R8, R10, R13 required at Tier 1.
- **The layer count can be gamed by one reader writing the same claim thrice.** The count is over *distinct layers*
  (tradition × data family), not claims; R3's multi-varga claims declare their layers explicitly.
- **Interpolated dates.** Until R-T1 and a panchanga pull exist, every ingress between monthly snapshots is "about". The
  Oracle prints the grade once; the readers never drop it.
- **The person readers read the owner's chart only.** The proposal says so; T8 (two charts) stays future work.
- **Sensitivity rules are tests, not prompts**: the forbidden words, the "doctor's plan first" line when health is in the
  frame, "no gem for a functional malefic", and "a third person gets no verdict" are each a `forbid`/`require` check in
  the evals and a unit test on the templates.
- **Sachin's decisions (only these):** (1) whether `real_want` is inferred silently at ≥ 0.8 confidence or always shown as
  a chip once (the proposal shows it either way); (2) whether the Tier 1 cap is 2,500 words or the reading is split into
  parts as doc 25 §1 change 5 does for multi-part questions; (3) the doc 18 gates the Archisha readings set aside
  (health role-gate, remedies) — this plan writes the readers so that both can be switched on per role, but the switch is
  a product decision before A-3 ships.
