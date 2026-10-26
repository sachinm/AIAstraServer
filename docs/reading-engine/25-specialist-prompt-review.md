# 25 — Specialist and synthesizer prompt review: depth, failures, multi-part questions

Status: review and proposal, 2026-10-26. No code changed. Read from the working tree of `AIAstra_Server` on
`fix/reading-focus-depth-usage` (uncommitted edits in `config.ts`, `graph.ts`, `nodes/specialists.ts`, `clarify/service.ts`,
`types.ts` are noted where they matter). Golden chart G1 (`evals/fixtures/G1`) is used only to show field shapes, never as a reading.

## 1. Answer first: the five changes, in priority order

1. **Stop losing whole layers to one bad field.** `claimZ.weight` is `z.number().int().min(1).max(3)` with no range in
   `FINDING_RESPONSE_SCHEMA` or in the prompt; one claim with `weight: 0` fails the parse and the entire transit finding is thrown
   away (`SpecialistOutputError`, graph.ts retries once, then `failed`). Clamp in zod (`.catch(2)`), state the range in the tail,
   add `minimum`/`maximum` to the response schema, and parse claims one by one so a bad claim drops, not the layer. Effect: the
   "layer missing" sentence in the answer disappears for schema slips; only real timeouts remain.
2. **Budget for the thinking the model does anyway.** `thinking: 'off'` becomes `thinkingLevel: 'low'` on every 3.x model
   (`gemini.ts:75`), and thought tokens share `maxOutputTokens`. At 1,800 that left ~1.2–1.4k for JSON, hence MAX_TOKENS on three of
   nine calls. The working tree already raises the default to 4,096 (`readingSpecialistMaxTokens`); pair it with an output
   discipline in the prompt (≤ 10 claims, each ≤ 200 characters, ≤ 6 windows) and a 18 s timeout for required readers, or the
   bigger cap just turns MAX_TOKENS into a timeout.
3. **Ask the readers the questions the user is asking.** Today's prompts ask for a checklist of facts; none asks *who* blocks,
   *who* helps, *how many* aspects, *through whom* (dispositor and star-lord chains), *what form* the promise takes, or *what a
   period gives*. Rewritten prompts (§2) make each of those a required claim type, and three small schema fields
   (`culprits`/`contributors`, `form`, per-window `fruit`) carry them to the synthesizer. Effect: the answer names Saturn as the
   culprit, Jupiter as the giver, and says "Venus AD gives 2nd/9th-house results through its star lord" instead of generic verdicts.
4. **Give the pack the two fields it is missing.** `nakshatra_profile.star_lords` (per planet: nak, pada, navamsa sign, star
   lord, its house, its sign lord, tara) is in every dossier but not in the pack; add it to `base.nakshatra`. Aspect *strength*
   exists nowhere in the dossier; Radha's `aspects` type (`natal_export._build_aspects`) returns graha and rasi drishti lists plus a
   planet-on-planet strength table in virupas. Until it is fetched and placed in `detail.aspects`, the prompt must say "count and
   name aspects; strength is not available" rather than let the model estimate. Effect: dispositor chains and aspect counts become
   checkable claims; strength becomes available once the on-demand fetch lands.
5. **Answer every part of a multi-part question, one after another, each with its own run.** The clarifier's "Which should I read
   first?" chip now (working tree) narrows `intent.subjects` to the chosen one and stores the rest in `intent.nextSubjects`, but
   nothing consumes `nextSubjects`. Add a parts queue on the clarify run (`ClarifyState.parts`), a `next_part` SSE event after each
   `done`, and let the client call `confirm-stream` again for part k+1, which is a full `runReading` with a fresh budget. Effect: the
   person who asked about work, money and love gets three answers in order, with "Part 2 of 3: income and wealth" visible.

### What the staging evidence maps to in code

| Evidence (2026-10-26) | Cause in code | Fix |
|---|---|---|
| promise+dasha (career), transit (income) truncated, `MAX_TOKENS` at 1,800 | `maxOutputTokens: 1800` (now `readingSpecialistMaxTokens()` = 4,096) shared with ~0.4k forced thought tokens (`thinkingConfigFor` maps `off` to `low` on 3.x) | change 2 |
| transit (career) Zod `too_small`, minimum 1 | the only `min(1)` in the finding schema is `weight`; a claim with `weight: 0` fails `findingZ.parse` and the finding is lost | change 1 |
| writer 0 thinking tokens | `readingSynthThinking()` defaulted to `low`; on 3.x low often means none (working tree now defaults to `medium`) | keep `medium`; see §2.5f |
| answer said career, relationship and transit layers were missing; only wealth discussed | `run.ts` appends `MISSING LAYERS (say so in one line): promise:career_work, dasha:career_work, transit:income_wealth`; `reconcile` computes the five-layer verdict for the primary subject only; `keyFactsCard` prints at most 6 frame houses of the merged pack (three subjects have up to 10); the brief caps windows at 14 across all subjects | changes 1, 2 and 5 (one subject per run makes the brief single-subject again) |
| clarifier said "love and relationships first", answer read wealth | pre-fix `intentFromState` kept every subject in the original order when the chosen frame was already among them; the working tree sets `subjects = [frame]` and `nextSubjects` | change 5 consumes `nextSubjects` |

## 2. Per specialist

Shared facts first. Every specialist call (`nodes/specialists.ts` `runSpecialist`) sends: system = `persona.md` + `method.md`;
part 1 = `renderBase(pack)` (`{base: …}`, identical for all questions of a user, cached); part 2 = `renderSubject(pack, analyst)`
(the analyst's sections from `ANALYST_SECTIONS` in `SECTION_ORDER`); part 3 = the tail (`TODAY`, `ANALYST`, the analyst prompt,
`Subject/Horizon/Focus`, the "at most 8 claims" line, the tradition/layerScore line, `QUESTION`). Model `modelFor('specialist')`,
`temperature 0.2`, `thinking 'off'` (effective `low` on 3.x), `responseSchema FINDING_RESPONSE_SCHEMA`.

`base` (with `READING_FULL_BASE`, default on) carries: `houses.1..12` (sign, lord, lord_h, occ, cls, sav), `bodies` (sign, h, deg,
nak, dig, retro, combust, flags, owns, nature "natural/functional", conj, aspects_houses, aspected_by {graha, rasi}, star_lord
"(house N)", sign_lord "(house N)", shadbala, ishta_kashta, bav_at_sign, tara, navamsa_sign), `relations` (lagna_lord, exchanges,
yogakaraka, marakas, functional benefic/malefic/neutral, kendra_trikona_lords, dusthana_lords), `nakshatra` (janma, lagna,
taras_from_janma, gandanta, pushkara, tenth_cusp_nak), plus `all_vargas`, `ashtakavarga` (sav[12], bav per planet), `dasha_tree`,
`arudhas`, `special_lagnas`, `karakas` (chara, chara_houses, karakamsa, natural significations), `yogas`, `doshas`.

Not in the pack although in the dossier: `nakshatra_profile.star_lords` and `arudha_lagna`; `relations.conjunctions`,
`lord_of`, `houses_of`, `marakas_extended`; `frame.alsoFrom` (Moon/AL/Venus as second reference points) is in `FRAMES` but
`frameSection` never renders it. Not in the dossier at all: aspect strength (virupas), argala in divisional charts (Radha
`argala.dN`, on demand), arudhas in divisional charts (`arudhas.dN`), any annual chart.

### Shared tail (replace lines 136–144 of `nodes/specialists.ts`)

```
TODAY: {asOf}
ANALYST: {analyst}
{PROMPTS[analyst]}
Subject: {subject}. Frame houses: {frame.houses}. Frame lords: {frame.lords}. Karakas: {frame.karakas}. Horizon: {from} to {to}. Focus: {focus or none}.
OUTPUT RULES
- 6 to 10 claims. Each claim is one sentence of at most 200 characters about this chart, begins with the planet or house it is about, and lists 1-4 evidence ids copied exactly from the pack as dot paths (for example detail.houses.10.lord, base.bodies.Sa.star_lord, dasha.periods.Sa-Ke-Ve_2026-08-22.from).
- weight is 1, 2 or 3 (3 = decides the verdict on its own). polarity is supports, obstructs or neutral. tradition is parashara, jaimini, nakshatra or kp_starlord.
- layerScore is one integer from -3 (clearly denied or obstructed) to +3 (clearly promised or supported); 0 when balanced.
- Dates only as they appear in the pack (YYYY-MM-DD). Never compute a house, lord, aspect, dignity, date or strength; read the field. If a field you need is absent, add a caveat naming it and go on.
- culprits and contributors are planet codes (Su Mo Ma Me Ju Ve Sa Ra Ke) that appear in the pack, at most 4 each, strongest first.
QUESTION: {question}
```

### 2.1 promise (L1)

**a. Reads today:** `base`, `frame`, `detail` (frame houses with lord, lord_house, lord_dignity, occ, aspected_by, co_lord, argala
{primary, secondary, obstructed_by}, cls, sav, cusp_nak; up to 8 yogas touching the frame; `sav_frame`), `varga` (lagna, lagna_lord,
planets {h, dig, vargottama}, frame houses, `d1_lords`, `kendra_occ`), `arudha` (AL, subject arudhas, special lagnas). Asked
(`promise.md`): judge whether the chart promises the result; list of fact types; "every claim lists evidence ids".

**b. Gaps:** no instruction to name the planets that help or hurt, so claims come out as neutral descriptions ("10th lord Mercury is
in the 9th"). No request for the aspect count or for naming aspecting planets although `detail.houses.N.aspected_by.graha` and
`base.bodies.P.aspected_by.graha` are lists. No dispositor rule although `base.bodies.P.sign_lord` is "(house N)" and the second
hop is one lookup away. Argala is listed but the prompt never says what to conclude from `obstructed_by` (G1 house 10 has five
planets in `obstructed_by` against one primary: that is a finding, and it is never spoken). "The form the result takes" (file 04
§3) is not a field, so it is usually skipped. The `alsoFrom` points (Moon, AL) are not in the pack.

**c. Rewritten `promise.md`:**

```
You judge whether this chart promises the asked result, how strongly, in what form, and who in the chart helps or blocks it. Use only the evidence pack.

Work through the frame houses in order (detail.houses), then the frame lords and karakas (base.bodies), then the varga, then the arudha.

For each frame house say: who the lord is and where it sits (house and dignity, retro or combust if flagged); who occupies the house and their nature (base.bodies.P.nature); how many planets aspect the house (the length of detail.houses.N.aspected_by.graha), naming them and whether each is a functional benefic or malefic for this lagna (base.relations.functional); whether argala helps (argala.primary and secondary) or is blocked (argala.obstructed_by), naming the planets on each side. Aspect strength is not in the pack unless detail.aspects is present; never estimate it.

For each frame lord and karaka give its dispositor chain in one claim: the planet, its sign lord and that lord's house (base.bodies.P.sign_lord), then that lord's own sign lord (look it up in base.bodies). Say whether the chain ends in a kendra or trikona, a dusthana (6, 8, 12), or in the frame itself. Tag these parashara.

Varga: read varga.<D>.d1_lords.<H> (where the D-1 lord lands, its dignity), the varga lagna and lagna_lord, the same house in the varga, and kendra_occ. The varga refines D-1; it never replaces it. Write one claim that states the form the result tends to take, with evidence in varga.<D>; copy that sentence into `form`.

Arudha: planets in or with the arudha (arudha.<A>.occ, arudha.<A>.lord); tag jaimini. Yogas in detail.yogas that include a frame lord: one claim each, naming the class.

Strength: detail.houses.N.sav (28 or more strong, 22 or less weak), base.bodies.P.shadbala.ratio (1.0 or more strong), base.bodies.P.bav_at_sign (4 or more good). Quote the number in the claim.

Then decide. verdict: strong, moderate, weak, denied or mixed. culprits: the planets whose placement, aspect, argala obstruction or dignity hurts the result most, strongest first. contributors: the planets that carry the promise, strongest first. A planet may appear in only one list. If the answer is favourable, say in a claim what makes it so; if unfavourable, name the culprit and the mechanism (dusthana lord, malefic aspect, obstructed argala, debilitation, combustion).

caveats: one line per fact you needed and did not find (for example "detail.aspects absent, aspect strength not read"). Do not write prose for the user; write claims.
```

**d. Schema:** add to `findingZ`/`FINDING_RESPONSE_SCHEMA`: `form: z.string().max(200).default('')` (promise only; others leave it
empty), `culprits: z.array(planetCode).max(4).default([])`, `contributors: z.array(planetCode).max(4).default([])`. Change
`weight` to `z.number().int().min(1).max(3).catch(2)` and add `minimum: 1, maximum: 3` in the response schema. Keep `keyFacts` (the
eval method-coverage check reads `keyFacts ∪ claims[].evidence`, doc 07 §3.5). Reconcile gate: drop a culprit/contributor code
that is not a key of `base.bodies`; keep `form` only if the promise finding has at least one grounded claim with `varga.` evidence.

**e. Pack additions:** `frame.also_from` from `FRAMES[s].alsoFrom`; `base.nakshatra.star_lords` from
`dossier.nakshatra_profile.star_lords`; a count field is not needed (the model reads list length). For strength: fetch Radha
`aspects` through `ensureChartData` (catalog id `aspects`, `on_demand`, served by Radha per doc 24 after catalog sync) and render
`detail.aspects = { on: { <P>: [{by, virupas}] } }` for frame lords and occupants only, from `aspect_strength.rows` (unit "virupas
(60 = full aspect)"). pyjhora's planet-on-house strength rows are not usable (`include_houses=False` in `_build_aspects`, with the
reason in the Radha code), so house aspect strength stays "not available". Argala in the subject varga (`argala.dN`) is on demand;
add later as `varga.<D>.argala` when the fetch plan exists (doc 23 §3.1).

**f. Budget:** `maxOutputTokens` 4,096, effective thinking `low` (cannot be lower on 3.x; the prompt is a checklist, so low is
right), timeout 18 s (required reader, retried once). Expected output 1.3–1.8k tokens (10 claims × ~45 tokens + fields) plus
0.3–0.6k thought tokens.

### 2.2 dasha (L2)

**a. Reads today:** `base`, `frame` (incl. `running`), `detail`, `varga`, `dasha` (`current`, `periods` keyed
`MD-AD-PD_start` or `MD-AD_start`, `lords` with the varga house/dignity of each period lord, `narayana_current`). Asked
(`dasha.md`): per period lord, houses owned, house, dignity, varga position, star lord's house, relation to frame; classify
deliverer/supporter/neutral/obstructor; one window per period with the class in `label`.

**b. Gaps:** the class is parsed from `label` by substring (`reconcile.classOf`), so a label like "Ketu AD: mixed support" is
read as supporter. Nothing asks what the period *gives* (its fruit) for this subject, so the writer has only a class word. The
star-lord rule is stated but the per-planet `star_lords` record is not in the pack; the model has only `base.bodies.P.star_lord`
"(house N)", which is enough for one hop but has no tara. AD-from-MD relation (file 02 step 2.3) is not asked. Narayana is in the
pack (`narayana_current`) and never used. The dasha prompt does not say which planets are the culprits of a bad period.

**c. Rewritten `dasha.md`:**

```
You judge timing from the Vimshottari periods in the evidence pack. The running period is in dasha.current and frame.running; do not recompute anything.

Take every period in dasha.periods (they are already cut to the horizon). For each distinct period lord, write one claim that reads its record from base.bodies.<P>: the houses it owns (owns), the house it sits in (h) and dignity (dig), its nakshatra star lord and that lord's house (star_lord), its sign lord and house (sign_lord), its position in the subject varga (dasha.lords.<P>.varga). A planet gives the results of the houses it owns, the house it occupies, and above all the houses its star lord owns and occupies. Tag the star-lord claim kp_starlord, the rest parashara.

Classify each lord for this subject: deliverer (owns or occupies a frame house, or is a frame karaka, or sits in the varga lagna or 10th in dignity), supporter (benefic connection to a frame lord: conjunction, aspect, exchange, kendra or trikona from it), neutral, or obstructor (lord of 6, 8 or 12, or sitting there, or in 6/8/12 from the frame lord, or afflicting the karaka). Downgrade one step when the star lord sits in 6, 8 or 12 or is debilitated; upgrade one step when a weak lord has a strong star lord in 2, 5, 9, 10 or 11.

For the antardasha lord say in one claim where it sits from the mahadasha lord (kendra or trikona smooth; 6, 8 or 12 friction), reading both houses from base.bodies.

Windows: one per row of dasha.periods, from and to copied from the row, lord = the finest level lord in the row (pd, else ad), cls = its class, label = "<MD>-<AD>-<PD> <class>", fruit = one sentence (at most 140 characters) saying what this period gives or withholds for this subject and through which houses (for example "Venus PD: 2nd and 9th house results through its own lordship; 8th house flavour through star lord Sun"). Polarity: deliverer or supporter favourable, obstructor testing, neutral mixed.

If dasha.narayana_current is present, one claim (tag jaimini) on the running sign: its lord and where that lord sits, and whether the sign is a frame house.

culprits: period lords in the horizon that obstruct, strongest first. contributors: period lords that deliver or support. verdict: strong when a deliverer runs for most of the horizon, moderate when supporters do, weak when only neutral, denied when obstructors run throughout, mixed otherwise. layerScore accordingly.
```

**d. Schema:** `windowZ` gains `lord: z.string().default('')`, `cls: z.enum(['deliverer','supporter','neutral','obstructor']).default('neutral')`,
`fruit: z.string().max(160).default('')`. `reconcile.classOf` prefers `w.cls` and falls back to the label substring. The brief's
WINDOWS lines render `fruit` after the label so the writer can say what a window gives.

**e. Pack additions:** `base.nakshatra.star_lords` (gives `tara` per planet for the nakshatra layer too); render
`dasha.lords.<P>` with `h`, `dig`, `owns`, `star_lord`, `star_lord_house`, `sign_lord` copied from `base.bodies` so the dasha
reader has the record next to the periods (duplication is cheap, ~40 tokens per lord, and it halves the lookups a cheap model gets
wrong). Period lords' AD-from-MD house is not stored; the model reads two `h` fields and the prompt tells it not to count, only to
say "the AD lord is in house X, the MD lord in house Y" — the kendra/trikona judgement is then a rule on two read fields, which
file 11 §0 allows. If stricter, Radha's `dasha.vimsottari` two-level export could add `ad_from_md`; not present today.

**f. Budget:** 4,096 tokens, thinking `low`, timeout 18 s. The window list is the big output: a 1-year horizon with PD rows yields
10–18 windows; cap windows at 12 by instruction and aggregate to AD for horizons over 12 months (already done in `buildEvidencePack`
via `aggregateToAd`).

### 2.3 transit (L3)

**a. Reads today:** `base`, `frame`, `arudha`, `dasha`, `transits` (`now`, `rows` keyed `Planet_from` with sign, retro_on_entry,
house_from_lagna/moon/al, over_natal, influences_houses, sav, bav, nak_segments; `focus_hits`; `double_transit` windows;
`sade_sati`; `stations`). Asked (`transit.md`): Saturn/Jupiter/nodes over frame houses and lords, double transit, Sade Sati,
nakshatra hits, bindu strength; focus_hits first when a transit is named.

**b. Gaps:** no instruction to name which natal planet a transit afflicts and why that planet matters to the subject (lord of
which frame house), so the writer gets "Saturn transits the 2nd" without "Saturn sits on your 2nd lord Venus, who also rules the
9th". `influences_houses` is never explained as "aspects", so the special aspects of Saturn (3, 10) and Jupiter (5, 9) go unread.
Nothing asks for the fruit of a transit window. `transits.dropped_rows` is never surfaced as a caveat. The failed call on staging
was a `weight: 0`, i.e. a formatting slip, not a content problem.

**c. Rewritten `transit.md`:**

```
You judge triggers from the transit rows in the evidence pack. Use only the dates in the pack, never your own ephemeris. Transits trigger what the chart and the dasha promise; they do not create it.

Read transits.now first: for Saturn, Jupiter, Rahu and Ketu, the sign, the house from Lagna and from the Moon, and over_natal. If the question names a transit, address transits.focus_hits first and say with dates whether it is current, upcoming or past (in_horizon).

Then every row in transits.rows that touches the frame. A row touches the frame when house_from_lagna is a frame house, when influences_houses (the houses the planet aspects from that sign) includes a frame house, or when over_natal names a frame lord or karaka. For each such row write one claim: the planet, the sign, the dates (from, to), what it sits on (over_natal, and which frame house that planet rules, from base.bodies.<P>.owns), what it aspects (influences_houses), the house from the Moon, and the bindus (sav of the sign, bav of the planet there; 28 or more and 4 or more are supportive). Saturn over a frame lord delays and tests; Jupiter over a frame house or lord or the arudha gives; Rahu over a frame lord inflates and unsettles; Ketu over one detaches. Tag parashara.

Double transit: for each transits.double_transit window write one claim naming the houses it covers and whether they are frame houses; these are the strongest trigger windows. Sade Sati: if transits.sade_sati.now is set, one claim with the phase and the periods in the horizon. Stations in the horizon: one claim naming the planet, kind and date.

Nakshatra hits: when a row has nak_segments with over_natal_nak, one claim naming the natal planet whose star is crossed and the dates; tag nakshatra.

Windows: one per claim that has dates, from and to copied from the row or double-transit window, polarity favourable (Jupiter on frame points, double transit on a frame house, Saturn in 3, 6 or 11 from the Moon), testing (Saturn or the nodes on a frame lord or the Moon, Sade Sati) or mixed, label = "<planet> in <sign> over <what>", fruit = one sentence (at most 140 characters) on what this transit tends to bring for the subject in that window.

culprits: transiting planets whose rows obstruct the frame in the horizon. contributors: those that support it. verdict and layerScore from how much of the horizon is covered by favourable rows and whether a double transit on a frame house exists. If transits.dropped_rows is greater than 0, add a caveat that some rows were not shown.
```

**d. Schema:** same window fields as dasha (`lord` holds the transiting planet, `cls` unused and left `neutral`, `fruit`). No
other change.

**e. Pack additions:** `transits.rows.<key>.over_natal_owns`: for each code in `over_natal`, the houses that planet owns (copied
from `dossier.bodies[P].owns`), so the reader does not need to cross-reference `base.bodies`; a one-line `transits.legend` string
("influences_houses = houses aspected from that sign; sav/bav = ashtakavarga bindus of the sign / of the planet in that sign")
costs 40 tokens and removes a class of misreadings. Everything else already exists in `transits/types.ts`.

**f. Budget:** 4,096 tokens, thinking `low`, timeout 18 s when required (horizon ≤ 3 years), 12 s and no retry when optional.
Rows for a 1-year horizon are typically 8–16 (slow planets only; `transitPlanetsFor`), so 10 claims is enough.

### 2.4 nakshatra (L4, optional, person-centric, once per run)

**a. Reads today:** `base`, `frame`, `detail`, `dasha`, `transits`. Asked (`nakshatra.md`): janma and lagna nakshatra and lords,
star lords of frame lords and dasha lords, tara of dasha lords and transit nakshatras, pada and navamsa, transit nakshatra over
natal planets, gandanta and pushkara; prefix claims with the layer.

**b. Gaps:** the per-planet star-lord table (`nakshatra_profile.star_lords`: nak, pada, navamsa_sign, star_lord,
star_lord_house, star_lord_sign_lord, tara) is in the dossier but not in the pack; the reader has `base.bodies.P.nak`,
`star_lord` and `tara` and must assemble the chain itself. `arudha_lagna.nakshatras` is also missing. It only runs when
`analystsFor` adds it (general_life_direction, a "nakshatra" focus, `why_meaning`, or a named planet), so for a career question
the star-lord layer the critique asks for comes from nobody: the dasha prompt must carry the one-hop star-lord rule (done in §2.2).

**c. Rewritten `nakshatra.md`:**

```
You read the question through the nakshatra layers in the evidence pack. Prefix every claim with its layer in brackets and tag it nakshatra (kp_starlord for star-lord chains).

[janma] base.nakshatra.janma: the Moon's nakshatra, pada, lord and the lord's house; what that lord rules in this chart (base.bodies.<lord>.owns). [lagna] base.nakshatra.lagna the same way.

[star-lord] For each frame lord and karaka, and for the running dasha lords (frame.running md, ad, pd), read base.nakshatra.star_lords.<P>: nak and pada, star_lord and star_lord_house, star_lord_sign_lord. One claim per planet: "<P> in <nak> acts through <star lord> in house <N>, whose sign lord is <Q>". Say whether the star lord sits in a frame house, a kendra or trikona, or a dusthana.

[tara] base.nakshatra.star_lords.<P>.tara for each running dasha lord: Janma, Sampat, Vipat, Kshema, Pratyari, Sadhaka, Vadha, Mitra, Ati-mitra. Sampat, Kshema, Sadhaka, Mitra and Ati-mitra support; Vipat, Pratyari and Vadha test; Janma is neutral. For transit nakshatras use base.nakshatra.taras_from_janma.<nak> for the nak in transits.rows.<key>.nak_segments.

[pada-navamsa] base.nakshatra.star_lords.<P>.navamsa_sign for the frame lords: name the sign and its lord as the inner result.

[transit-star] transits.rows with nak_segments whose over_natal_nak is non-empty: which natal planet's star is crossed, by whom, with dates; same-star return of a slow planet is the sharpest trigger.

[arudha] base.nakshatra.arudha_lagna.nakshatras and base.nakshatra.tenth_cusp_nak for public image and career expression.

[flags] base.nakshatra.gandanta (moon, lagna) and base.nakshatra.pushkara (navamsa, bhaga lists): one claim only when a flag is set.

culprits: planets whose star lord or tara works against the subject. contributors: those whose star lord or tara supports it. Windows only when a transit-star claim has dates. verdict and layerScore from the balance of star-lord placements and taras of the running lords.
```

**d. Schema:** no change beyond the shared fields.

**e. Pack additions:** `base.nakshatra.star_lords` and `base.nakshatra.arudha_lagna` (both from `nakshatra_profile`; add to the
`base.nakshatra` object in `buildEvidencePack` lines 280–287). ~350 tokens, cacheable, same bytes for every question.

**f. Budget:** 3,072 tokens, thinking `low`, 12 s, never retried, never holds the join (as built). Consider adding it to
`analystsFor` for `timing` questions too once the budget is measured: the star-lord layer is what the user asked for.

### 2.5 synthesizer (the writer)

**a. Reads today** (`run.ts` graph branch): system = persona + method; part 1 = `SPECIALIST FINDINGS (already tied to chart
facts):` + `rec.brief` (= `renderBrief(synthBrief)`: TEMPLATE, VERDICT, LAYERS, DECIDERS, NOW, NEXT, FORTUNE, WINDOWS (≤ 7), KEY
FACTS (≤ 12 lines from `keyFactsCard`: lagna, Moon, birth, running MD-AD-PD with end dates, up to 6 frame houses with lord/house/
occupants), CAVEATS, TRADITIONS; then `FINDINGS (detail):` JSON with agreement, ≤ 14 windows, and per finding the claims
(text, polarity, weight) sorted by weight) + the `MISSING LAYERS` line; part 2 = `synth.md` + `tailFor` (TODAY, UNDERSTOOD AS,
`templates/_rules.md` + the template or the format file, safety lines, QUESTION). `temperature 0.4`, thinking `medium` (working
tree), `maxOutputTokens 12,288`, streamed with thought summaries.

**b. Gaps:** `_rules.md` rule 7 says every placement in "How I read this" comes from a key fact, but the key facts card has no
dignities, aspects, dispositors or star lords; the depth is in the claims, which rule 7 forbids quoting. `synth.md` says nothing
about culprits, contributors, aspects or the fruit of a window because the brief has no such fields. The brief drops claim
evidence ids (fine) but also drops `tradition` per claim (only the union is shown). With several subjects, the brief interleaves
findings of all subjects and the writer has to sort them; one subject per run (§3) removes that. The 70/30 rule and the T2 cap of
350 words leave no room for the "why" the user wants; the collapsed block is uncapped and is where it belongs.

**c. Rewritten `synth.md`:**

```
You write the final answer from the specialists' findings. Every claim in FINDINGS is already tied to a chart fact; you may state any claim, culprit, contributor, form or fruit from the brief as a fact of this chart. Do not add a placement, aspect, dignity, date or window that is not in the brief or the key facts.

Apply the convergence rule: likely only when promise, dasha and transit agree; one layer alone is weak / possible; name the layer that disagrees. Use only the windows given, with their dates.

Name the planets. Where the brief lists culprits, say which planet blocks and through what (its house, dignity, aspect, argala or star lord, as the claim says). Where it lists contributors, say which planet gives and how. State the form the result takes (FORM) when present. For each window you mention, say what it gives or withholds (its fruit) and the period or transit that defines it.

Put the what and the when in the body, in the template's sections and word cap. Put the why in the collapsed "How I read this" block: there, walk the chain for each frame house (lord, where it sits, who aspects it and how many, argala, dispositor and star lord, the varga confirmation) in plain sentences, one short paragraph per house or planet, Sanskrit terms with a gloss on first use. This block has no word cap but repeats nothing from the body.

If a layer is marked missing, say so in one line and answer from the layers present; do not say the answer is unavailable. If the brief says this is part k of N, open with "Part k of N: <subject>" on its own line, answer only this subject, and do not repeat the running-period paragraph from earlier parts except as one clause.

No remedies, no amounts, no medical or legal advice beyond the astrological indication. Confidence words only: strong indication, moderate indication, weak / possible, not indicated.
```

And `templates/_rules.md` rule 7 becomes: "Facts are quoted from the brief's key facts or its grounded claims, never computed."
Rule 2 adds: "The 'How I read this' block does not count toward the cap and carries the full chain of reasoning."

**d. Brief changes (`convergence.ts` `renderBrief`, `reconcile.ts` `briefObj`):** add `FORM: <promise.form>`; `CULPRITS: Sa (promise,
dasha) · Ra (transit)` and `CONTRIBUTORS: …` aggregated per planet with the layers that named it; WINDOWS lines gain `| <fruit>`;
FINDINGS claims keep `tradition`. Add `PART: k of N — <subject label>` and `EARLIER PARTS:` (the Answer cards of previous parts, 2–4
sentences each) when running as a part (§3). Keep the block byte-stable (tests in `convergence.test.ts`).

**e. Data:** none beyond what the specialists carry.

**f. Budget:** `gemini-3.8-flash`, thinking `medium`, `maxOutputTokens 12,288` (the collapsed block is uncapped, and thought
tokens share the budget), `temperature 0.4`, 120 s timeout. For T1/T9/T10 (short templates) `low` is enough; make the thinking
level per template (`T2`, `T3`, `T5`, `T6` medium; others low) via a small map in `run.ts`, read from `intent.classification.template`.

## 3. Multi-part questions

### What exists

- Intake caps `subjects` at 3 (`run.ts` `intent.subjects.slice(0, 3)`); `Intent.followUps` exists and is always `[]` from
  `ruleIntake`; nothing consumes it.
- The clarifier (`clarify/machine.ts`) asks `bucket` ("Which should I read first?") when `alsoBuckets.length >= 2`; the proposal
  text says "<area> first, from "<question>"" (`exactQueryFor`). State lives in `reading_runs.intent.clarify` (doc 17 §9).
- Working tree: `intentFromState` returns `subjects = [frame]` and `nextSubjects = other subjects`. `confirm-stream`
  (`clarifyRoutes.ts:100`) runs one `chatWithConfiguredProvider` → `runReading` with that intent and sends `done`. `nextSubjects`
  is read by nobody.
- `graph.ts` fans out per subject, caps 10 sends, runs nakshatra once; `reconcile` computes the five-layer verdict for the primary
  subject only. The findings cache (`findingsCache.ts`) is in-process, keyed by dossier hash, analyst, subject, period, prompt
  version; `clarify/prewarm.ts` already runs the promise layer during the clarify wait.

### Recommended design: a parts queue, one run per part, auto-continue

1. **Split.** Parts = the ordered subjects after the clarifier (chosen frame first, then `nextSubjects` in the order intake
   scored them). Without a clarifier turn (clarify off, or a confident two-subject question like Q1), the parts are
   `intent.subjects` in weight order when `subjects.length >= 2` and `READING_MULTIPART=1`; one subject means one part.
   Horizon, question type, template and safety flags are shared by all parts; the clarified horizon applies to every part (say so
   in the proposal: "over the next 12 months for each").
2. **State.** `ClarifyState.parts: { order: SubjectId[]; done: number }` saved with the state. For the no-clarifier path, the
   first `runReading` writes the same structure into `reading_runs.intent` of its own run so the next part can find it.
3. **Hand-over.** `exactQueryFor` ends with "…, then <part 2>, then <part 3>." The `propose` event carries
   `parts: [{subject, label}]`. After each part's `done`, the server sends `{ type: 'next_part', runId, index, total, subject,
   label }`. The client auto-posts `POST /api/chat/confirm-stream { runId, part: index }` after a 1.5 s pause with a visible
   "Next: income and wealth" line and a Stop control; a stopped queue leaves a chip "Continue with income and wealth".
4. **Each part is a full `runReading`** with `intent.subjects = [part]`, `intent.part = { index, total, label }`, a fresh token
   budget, its own `reading_runs` row and its own assistant message (header line "Part 2 of 3: income and wealth"). The brief gets
   `PART` and `EARLIER PARTS` (the Answer cards of finished parts, stored on the clarify state as ≤ 400 characters each) so the
   writer neither contradicts nor repeats. The synth prompt rule in §2.5c handles the wording.
5. **Progress.** The `intent` event gains `part`; the web pill row (`readingProgress.ts`) shows "Part 2 of 3 · Income and wealth"
   above the stage pills, and the finished parts collapse to their Answer cards. Nothing else in the SSE contract changes.
6. **Cost and latency.** One part ≈ today's one-subject graph run: 3–4 specialist calls + 1 writer call, ~10–35 s, ~$0.02–0.05 on
   the planned matrix (doc 23 §1, estimates). N parts cost N× that, capped at 3 by intake. Each part is its own Lambda request, so
   no request outlives one part. To cut the wait between parts, when part k's synth starts, run the dasha and transit specialists
   for part k+1 in the same request (bounded like `prewarmNatalLayers`, 12 s cap) and put the findings in `findingsCache`; the hit
   only lands when the next request reaches the same Lambda instance, so treat it as an optimisation and measure the hit rate
   before relying on it. A persistent findings store (a `reading_findings` table keyed like `findingCacheKey`) makes it reliable
   later.
7. **Scope line.** Each part answers only its subject; the method's "one short line for another subject" rule is suspended inside
   a parts run because that subject gets its own part.

Main alternative, in two sentences: keep one run and one request, and write one answer per subject back to back from a single
reconcile (doc 23 pattern P3, per-subject brief → per-subject writer call); it saves the intake and prepare steps and the
repeated base-chart tokens, but one Lambda request must then hold up to three writer calls (60–100 s), a failure in part 2 loses part 3,
and the reading_runs row no longer maps to one answer. The parts queue is preferred because every part is independently retryable,
billed and evaluated.

## 4. Risks and rollout

**Grounding.** New free-text fields (`form`, `fruit`) are not evidence-checked by `resolveEvidence`. Mitigation: `form` is kept only
when the promise finding has a grounded `varga.` claim; `fruit` is kept only on windows whose `evidence` resolves; `culprits` and
`contributors` must be keys of `base.bodies` or they are dropped and counted (`droppedCulprits`). The prose checker
(`grounding/checker.ts`) only verifies planet-in-house, lord, dasha and transit-sign assertions; dispositor and aspect sentences
will land in `unverifiable`, so the doc 07 target `unverifiable ≤ 10 %` will be missed unless the checker learns two more
patterns ("X aspects Y", "X's sign lord is Y"), both checkable from `bodies.*.aspected_by` and `sign_lord`. Add them before
reading the headline number.

**Eval regressions (doc 07).** Check 3 (`droppedClaims ≤ 10 %`): more claims with deeper paths (for example
`base.bodies.Me.sign_lord`) raise the drop risk when a model writes `bodies.Me.sign_lord` without `base.`; the tail now gives three
examples with the prefix, and reconcile could try the `base.` prefix as a repair before dropping. Check 5 (method coverage) reads
`keyFacts ∪ evidence`: `keyFacts` stays. Check 7 (format): the body stays inside the template caps; the depth moves into the
collapsed block, which the word count must exclude (today's checker counts the whole text; adjust it to strip `<details>`).
Q1 and Q12 (two and three subjects) become parts runs: `proseMustMention` for the second and third subjects must be checked across
the concatenated parts, not the first answer. `run.test.ts:168` pins the `MISSING LAYERS` line; `convergence.test.ts` pins
`renderBrief` output; `prompts.test.ts` and `PROMPT_VERSION` change with any prompt edit, which invalidates the findings cache
(intended). The specialist stub in `graphJoin.test.ts` builds findings without the new fields; defaults keep it green.

**Cost and latency.** Specialist output grows from ~0.9k to ~1.5k tokens (+~$0.001 per reader on 3.1 Flash-Lite); the 4,096 cap
plus 18 s timeout must be measured live (doc 24 says the graph flow has not been measured with live models). The writer's uncapped
"How I read this" adds ~300–600 output tokens (+$0.002–0.005 on 3.8 Flash). A three-part question costs three runs; the person
sees three answers, so the per-answer cost is unchanged, the per-question cost triples and the total time is 40–100 s with
visible progress throughout. Prefix caching is unaffected (base bytes unchanged except the ~350-token `star_lords` addition, which
is in the cached prefix).

**Rollout.** Flags: `READING_FINDINGS=v2` (new schema fields, tolerant parse, new prompts compiled from `prompts/v2/*.md`, brief
additions) and `READING_MULTIPART=1` (parts queue; off means today's behaviour, where the clarifier's focus still narrows to one
subject per the working-tree change). Order: (1) ship the parse fixes and the 4,096 cap alone (no prompt change) and confirm zero
`SpecialistOutputError` over a day of staging runs; (2) `READING_FINDINGS=v2` on staging, run the 12 goldens on G1 plus two panel
charts, compare `droppedClaims`, prose-checker `contradicted`, cost and TTFT against the stored baseline, and have Sachin score
Method fidelity and Specificity (doc 07 §4) on Q1, Q7, Q9; (3) `READING_MULTIPART=1` on staging with Q1 and Q12, check that every
part lands as its own message and run; (4) production flags through the deploy session. A/B on production: `reading_runs.promptVersion`
already distinguishes arms; split by user id parity for one week, compare rubric scores and the clarify abandonment rate (ABANDONED
states), then set the default.

**Open points I could not settle from the code.** Whether Gemini's `responseSchema` honours `minimum`/`maximum` on INTEGER fields
in the current API version (the zod `.catch` makes it moot). Whether the Radha `aspects` type is already marked `served` in the
`chart_data_types` table on staging (the code floor says `served: false`; doc 24 says Radha serves it after the catalog sync).
Whether the 12 s specialist timeout is hit on staging with 4,096-token outputs: the `reading timing` log line carries per-node
`ms`, so one day of runs answers it.
