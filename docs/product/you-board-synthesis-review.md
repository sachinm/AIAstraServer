# The You board: who synthesizes it, with what prompt, and why it reads like a newspaper column (review, 2026-11-07)

Sachin's question: which model and which kind of agent does the synthesis of intelligence on the You (Self) dashboard,
what prompt is it given, and why is the result general and vague instead of a piercing reading of the self. Checked in
the code on `develop` at 12215fc, not assumed. Plan to fix it: the "Self dashboard: guru-grade reading plan" session
(feature branch off develop), which should read this file first.

## 1. The answer in one table

| Surface | Agent (`src/agents/registry.ts`) | Kind | Model | Prompt |
|---|---|---|---|---|
| You board: headline, tone, clocks, "This year", "Direction", windows, Looking back, sub-areas | `area.self_board` | **code** | **none** | **none**: sentences come from `SELF.words` in `src/reading/area/self.ts` ("A clear stretch for a fresh start", "This year's chart backs you", "firm footing"), chosen by integer scores in `src/reading/area/houseLayers.ts` |
| You board: "Character evolution across 3 decades" and "Moon and Mercury personality / what brings joy" | same build (`self.character_arc`, `self.personality_joy`, `codeContract`) | **code** | **none** | **none**: fixed paragraphs keyed by house number (`HOUSE_CHARACTER_THEMES`, 12 entries) and by Moon sign and Mercury sign (`SIGN_MIND_STYLE`, 12 entries) in `src/reading/area/selfCharacterAndJoy.ts` |
| Chat question ("General Reading") | `reading.reader` R01..R14 then `reading.oracle` | llm | `READING_MODEL_READER` / `READING_MODEL_ORACLE`, each falling back through specialist / synth to `GEMINI_FLASH_MODEL_ID` (live: gemini-2.5-flash) | `src/reading/prompts/readers/_shared.md` + one `readers/Rnn-*.md` per reader; Oracle: `oracle/system.md` over a BRIEF built by `src/reading/oracle/brief.ts` |

So: **no model synthesizes the You board. No prompt exists for it.** The "astrological Oracle" and its instructions are
never on the path that produces the dashboard. The dashboard is a scoring rule plus a phrase table. That, not a weak
system prompt, is why every person gets "A clear stretch for a fresh start. Begin before 31 Jan 2027" and why the
personality panel reads like a Moon-sign column: it is one, by construction (one paragraph per sign, one per house).

## 2. How the board text is actually produced

1. `boardService.getAreaBoard` loads the stored digest and the activation calendar (dasha periods from the engine, 13
   months back to 30 years ahead) and calls `houseLayers.buildBoard` with the `SELF` config (houses 1, 4, 5, 9, 12;
   karakas L1, Moon, Sun, AK; vargas D1, D9, D20, D24, D12).
2. `gradePlanet` gives each planet one integer: functional benefic +1 / malefic −1, D1 dignity ±1, D9 dignity ±1, owns a
   Self house +1 or owns a dusthana −1. Range −4 to +4. Dignity and nature are matched by regex on the engine's labels.
3. `gradeRow` gives each dasha period that planet's score (plus ±1 from the charter fruition cell for the sub-period
   lord). A period is "support" if the score is positive, "test" if negative. **The same planet gets the same side in
   every period, whatever house the period activates.** This is the whole dasha reading.
4. `familyVotes` folds every running period into five families (main = Vimshottari, conditional = every applicable
   conditional dasha together, rasi, karaka, short = Yogini + Tithi Ashtottari) plus transit and annual: up to seven
   votes. `presentTone` turns the votes into open / closing / demanding / easing / steady and a confidence word
   (`confirmed` needs the main clock to agree; `likely` is "2 or more agree and more than the other side"; else `split`).
   The web shows `likely` as "Most of your chart points this way."
5. `aheadWindows` keeps every period whose lord is in a sub-area's planet list, labels it from `cfg.words.ahead[side][grade]`
   and merges overlaps. The merged `systems` list is what the web prints as "33 independent timing clocks aligned":
   every conditional dasha counts as independent there, while in the vote it counted as one family. Dashas derived from
   the same Moon and lagna are not independent evidence in any case.
6. The character arc picks one house per decade from the dominant Vimshottari lord's houses with a fallback order and
   prints that house's fixed paragraph. The personality panel prints the Moon-sign and Mercury-sign paragraphs.

What the companion questions do (`self.focus` chips: My work, Learning, Family, Creativity, Faith, Health, "I'd rather
not say"): `selfLead` maps the answer to a sub-area and `shapeBoard` moves it first; `selfFits` returns true for all, so
nothing is hidden; `shadeResolver.scoreCandidate` adds a small tie-break bonus when a candidate shade carries that fact.
**No sentence is conditioned on the answer and no statement is checked against it.** Family, Health and Love all map
to the same sub-area ("mind"). The question narrows nothing and anchors nothing yet; it reorders.

## 3. Where accuracy is at risk today (why "95 to 100 percent sure" is not met)

- **Silent defaults.** `selfCharacterAndJoy.ts` falls back to `Taurus`, `Virgo`, `Rohini`, `Ju`, SAV 28 and "friendly"
  when a digest field is missing, and prints evidence strings built from those defaults (`D1.Mo:Taurus (H4, friendly)`).
  A missing fact becomes a confident sentence about someone else's chart. P1 in `docs/TODOS.md`.
- **The dasha side ignores the house.** A benefic lord's period is "support" even when it runs through the 8th or 12th
  from the Self houses; a malefic 10th lord's period is "test" even when it delivers rank. No bhavat bhavam, no
  antardasha-to-mahadasha relation (6/8, 2/12), no star lord of the period lord.
- **The main clock is always Vimshottari.** `isTurn` (the "A new chapter" line and the Direction window) requires
  `family === 'vimshottari'`. Sachin's own trusted system, Dwisaptati Sama, enters only as one "conditional" family vote.
  There is no per-kundli preferred system. The catalogue spells it `dwisatpathi` (`catalog.ts:948`, `R09`): confirm the
  engine key before relying on it.
- **Headline words are the same for everyone.** Three support phrases, three test phrases, three year phrases, two
  turn phrases. Nothing names a planet, a house or a reason on the board itself.
- **Confidence words are vote arithmetic**, not a judgement of promise, timing and trigger agreeing on one matter.

## 4. The chat Oracle prompts, judged on their own (they are not the dashboard's problem, but they are the only
prompts we have, and the fix will build on them)

Sizes: persona 75 words, method 859, oracle/system 586, `_shared` 409, each reader 200 to 320. Structure is sound:
evidence ids, a grounding gate that drops unbacked claims (`brief.ts`), layer counting, fixed confidence vocabulary,
the convergence rule, sensitive handling, no computation. That part is better than most products.

Astrologically they are thin, and in the following specific ways:

1. **There is no Self reader.** R01 (backbone) names the lagna lord's floor, the strongest and weakest planets and the
   chara karakas, in 6 to 8 claims for any question. No reader is charged with the lagna, lagna lord, paka lagna, arudha
   lagna, the Moon as manas, the Sun as atma, AK and karakamsa, D9 lagna, D60, the 3rd (parakrama), 4th (chitta), 5th
   (buddhi), 12th as one integrated reading of who this person is. R13 "person" is another person, not the self.
2. **Rules are counts, not technique.** "SAV 28 or more is strong", "a lord in 6, 8 or 12 is a culprit", "ratio 1.0".
   Missing: lordship by lagna (which planets are yogakaraka, maraka, badhaka for this lagna; the engine gives
   `functional_roles` but the prompt never says how to weigh them against natural nature), combustion and retrograde
   results, avasthas (the digest stores them; `R02` says "do not read aspect strength"), virodhargala, Jaimini
   rasi-drishti results on AL/UL, nakshatra lord and deity of the Moon, Sudarshana, Ashtakavarga kakshya for transits,
   KP star-lord results for sub-periods, and the conditional-dasha applicability rules.
3. **Dasha is read as planet class, not as a delivery chain.** R08 asks for deliverer / supporter / neutral / obstructor
   per lord. It does not ask for the mahadasha lord's house from lagna and from the Moon, the antardasha lord's position
   from the mahadasha lord, the sub-period lord as the star lord of the main lord, or the natural age of the period
   (Jupiter at 16 and at 60 are not the same dasha). R09 treats every other system as a "confirmer that cannot open a
   window", which is the opposite of what Sachin wants for a chart where Dwisaptati applies.
4. **Three generations of data shape live in the prompts.** `method.md` reads an evidence pack with `base`, `frame`,
   `detail`, `varga`, `dasha`, `transits`; the readers read v2 tables (`bhava.houses.N`, `dignities.planets`); the digest
   slices feed `digest.<section>.<varga>` ids. The live chat path (`oracle/flow.ts`) uses `oracle/system.md` and the
   readers; `method.md` and `synth.md` are the graph flow. Whichever path the Self reading takes, the prompt must name
   the fields that path actually sends, or the readers write gaps.
5. **The Oracle is told to be kind before it is told to be exact.** `oracle/system.md` order is: what they really want
   to know (no chart words), why, what holds, when, cautions. For a Self reading the person asked nothing; the reading
   has to open with the diagnosis (the central tension of the chart) and then the evidence. The persona line "never
   claim certainty" is right for prediction and wrong for description: a debilitated lagna lord in the 8th is a fact of
   the chart, not an indication.

## 5. What Sachin asked for, restated as a specification

A Self reading generated as if the person had asked one standing question, "Who am I and what am I going through right
now?", read in depth: the promise of the chart and where it was stolen, the pain, what has been achieved, where the
person stands in life (a head of state has every success and every problem at once; the reading must hold both), the
faculties of mind and self, the struggles, and how the running mahadasha and antardasha are changing the person, with
several dasha systems confirming the same thing before it is said, and the planet placements named. Every statement
backed by engine facts, nothing shown that the facts do not support, and the companion answers used to confirm, not to
reorder.

**Added by Sachin, same day: the spine of the reading is the mahadasha, with date ranges.** Three dated chapters in the
kundli's preferred dasha system: the previous mahadasha ("from <date> to <date> the self was like this"), the running
one ("from <date> to <date> this is the self", with the running antardasha as the sub-range that says what is pressing
now), and the next ("from <date> you will be like this"). Each chapter is written only where the other applicable
systems and the placements confirm the same shift; where they do not, the chapter says which clock disagrees. The
existing "three decades" character arc is the wrong cut: it slices by calendar decade and prints a house paragraph; the
cut has to be the dasha boundary, and the content has to be read from the lord's chain (houses from lagna and Moon,
dignity, star lord, yogas it forms, its antardashas) and confirmed before it is stated. Done means a person can read
their own past chapter and recognise it; that is the test of the whole feature.

## 6. Recommendation (one design; the plan session writes the full plan)

1. **Route the Self board through the reading engine, not the phrase table.** Treat it as one standing question per
   kundli, built once per digest and once per dasha boundary, read by the readers and written by the Oracle on the
   paid models, cached in `technique_outputs`. The scoring rule stays as a deterministic cross-check that can veto a
   sentence (a claim the votes contradict is dropped), not as the author.
2. **Add a Self curriculum**: a `readers/R15-self.md` (lagna, lagna lord and its floor, paka and arudha lagna, Moon as
   manas with its star and lord, Sun as atma, AK and karakamsa in D9, D60 lagna, 3rd, 4th, 5th, 12th, yogas on 1 and on
   the Moon, avasthas), a `readers/R08` revision that reads the running mahadasha and antardasha as a delivery chain
   (houses from lagna and Moon, antar lord from maha lord, star lord, age of the period), and a `readers/R09` revision
   that makes the kundli's preferred system a first-class clock, with convergence stated as "systems A, B, C put the
   same house under the same kind of lord in the same window".
3. **A Self Oracle prompt** (`oracle/self.md`): open with the diagnosis in three sentences, then the three dated
   mahadasha chapters (previous: what the self was; running: what the self is, with the antardasha as the present
   sub-range; next: what the self becomes), each naming the lord, its chain and the systems that confirm it, then "what
   was promised and what was taken", "what you have built", "the mind", "the struggle", this year's chart as a
   confirmation layer; one "confirm" question at the end drawn from the strongest claim, whose
   answer gates the next build. Confidence words only on timing; facts of the chart stated as facts.
4. **Per-kundli preferred dasha**: a field on the kundli (set by Sachin for his own, chosen by applicability for others),
   so the main clock on the board and the Direction line follow it, Vimshottari second.
5. **No defaults.** A missing digest field removes the panel line and writes a gap; it never substitutes a sign.
6. **Questions that gate, not reorder.** Each confirm answer is a sealed fact (doc 48) that a reader receives as
   `FACTS` and must cite when it narrows a claim; a statement the person has contradicted is not shown again.

Costs: one reader set plus one Oracle call per kundli per rebuild on the paid models; count and price go to Sachin
before the first run, as the rules require. Nothing here changes what the engine computes.
