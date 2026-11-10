# 66 — The You board v2: sections people can use, a Personalizer after the Oracle, the person's present shade, and a clock switch that asks first

Status: **final plan, 2026-11-09 (Fable), for Opus to build (§13),** written for Sachin's review of the live You page ("so boring") and his brief of the same
day. No code changed. Inputs: docs 32, 45, 48, 52, 53, 58–65, `docs/billing/02`, the Phase B build on `develop`
(`feat/self-oracle-areas`, bc6ecb9), the outside research report `docs/research/reports/Self screen design patterns.md`
(2026-11-09), the two code audits in `docs/research/research_notes/Self screen design patterns/*_audit.md`, and the
screens in `66-you-board-v2-mockup.html`.

Rules that bind every line: the calculation engine is the only source of astrological values and is never named to a
person; Node selects, joins and formats, it derives nothing; a line without grounding is withheld, never softened; no
paid model call before Sachin's yes on key, model, count and cost (every phase states those); digested words and no
chart terms on a first screen (doc 45 §3.3); panels, never a scroll (doc 45 rule 11); specific to this person or not
shown, ask before you answer, questions follow facts (AGENTS.md).

## 0. Answer first

| Sachin's question | The answer |
|---|---|
| Why does the reading feel disconnected from the Oracle's rules? | The Oracle is briefed as a strict Vedic reader and writes like one: the Phase A replay shows classical reasoning, named rules, dated claims. That essay then reaches the screen almost raw (the live page shows "Jupiter in the 7th in Virgo at 3.81 degrees", "avastha", "Arudha Lagna", "Sree Lagna", "Mandi", "Gulika", "Hora Lagna"), under the code scorer's template lines, under a hero card that leaks `self.activation · Present Tone Consensus` and counts "7 clocks". Nothing between the Oracle and the person turns a reading into a card for *this* person. That missing stage is the **Personalizer** (§4.1). |
| What sections should Self have? | Eleven, in three groups, every one readable from stored engine rows (§3, table in the mockup §5): **Now** — Right now, Where you get stuck, This chapter; **You** — In short, Who you are, How you think, Body & energy, Drive & ambition, How you come across, Gifts & knots; **Time** — Your chapters, This year. "Your soul's aim" folds into Drive & ambition (Atmakaraka and Karakamsa become "what you are really after"). "How you come across" (Sachin, 2026-11-09) is dress, hair, bearing and how others read you, with a public/private contrast and the past window when the person looked their best; it is the affirming card that earns the right to say harder things. |
| Keep the Easing / Timing Clocks panel? | **Keep the slot, rebuild the card.** "Where am I right now and when does it change" is the single most valuable panel for a person who arrived with a problem (the research is unanimous: Whoop's Recovery, Oura's Today, Rise's windows). What goes: the internal id, "Present Tone Consensus", the clock count, "Your chart is divided" as a verdict. What comes: a tone word, one plain sentence naming the life area and the date, a six-months-back / six-ahead strip, one confirm question, "Why we think so" one tap down. |
| Does the Oracle know who it is writing for? | Not yet. `auth.gender` exists (optional, from birth details) and `auth.date_of_birth` gives the age; the role `novice` is every new registration (`src/auth/roles.ts`), not an expertise level; the wizard's `person_facts` (work, love, children, focus) exist (doc 52). None of these is a Personalizer input today because there is no Personalizer; the audit (§1) says which, if any, reach the Oracle prompt. |
| Did we build the "fifty shades" of where the person is in life? | Designed, not built as a feed to the words. Doc 32 Part 1 is the pressure map (what presses, since when, eases when, by house and planet), Part 2 the day's mood. The live hero's tone word comes from the board's vote machinery (`self.activation`), not from a dated pressure inventory, and nothing hands a "shade" to the synthesizer. §4.3 makes the shade an engine-side **pressure and support inventory** with windows (−3 y … +3 y), and the Personalizer's first input. |
| Should a clock switch cost a question? | Yes, with consent first. A switch rebuilds every area (a fresh build already costs one question, `docs/billing/02`). The sheet names the cost, the tap reserves `board:self:<day>:clock:<system>` and writes a `clock_viewed` event; clocks the engine marks as not applying are greyed with the reason (§4.4). |
| How far ahead? | The chapter (main period, previous / running / next) is written **once** and refreshed only at a main-period boundary. Live text is at sub-period and sub-sub-period grain. Nothing on this board is at day or week grain (that is Today and Lucky times). The hero shows six months back to six ahead; "This year" shows twelve months. |

## 1. Start: the system as it is (checked 2026-11-09)

### 1.1 What the person sees (live You page, screenshot of 2026-11-09)

- A hero card: "◇ EASING · You're coming out of it. From 1 Dec 2026, a better time to start. · Your chart is divided on
  this." with three boxes (Timing Clocks "3 supporting · 2 testing of 7 clocks", Core Strength, Key Horizon "Primary
  pressure eases by 12 Dec 2026"), a chip `self.activation · Present Tone Consensus` in the corner, "Why we think so".
- Seven top tabs (Your reading, Now, What holds you up, What presses, Ahead, Looking back, Your questions), then "Read
  on your Kaala clock · Change", then a left list of nine areas and a right column: "In short · True until 22 Oct 2034",
  five template lines (two near-duplicates: "Your sense of self is lived through partnership" appears twice in two
  wordings), then the Oracle's prose with chart terms and degrees. Sixteen destinations on one page.
- Nothing names the person's age, work, relationship or what they came for. No question is asked. No picture of time.
- The horizon on the first card is 2034.

### 1.2 How it is built (docs 58–65, `develop`)

- `GET /api/self/reading` serves the nine panels from `technique_outputs`; a missing Oracle synthesis queues
  `self-reading-build` in its own invocation (doc 64). The build: code panels (claims, template lines) → five family
  readers → lineman brief → one Oracle call with `responseSchema` = `OracleAreaDoc` (headline, paragraphs, dates,
  actions, certainty, evidence) → validator (evidence keys, dates inside stored windows, caps, redaction, code auditor)
  → `panel.area` (doc 65 Phase A and B, merged to `develop`). Replay: 72 s cold, $0.055, 5.9 k output tokens at
  thinking low; the prompt is `oracle/self-areas`.
- The hero is `self.activation` from the board's vote machinery (doc 63), not from the Oracle.
- A fresh board build costs one question per board per day (`docs/billing/02`, key `board:<board>:<day>`); the clock
  switch is not separately charged or logged.
- `kundlis.preferred_dasha` exists; the Chart Data Review found the Tithi Pravesha year dasha stored as a lifetime
  dasha (TODOS 2026-11-08), which is why a card can say "True until 22 Oct 2034".
- Personal facts: `auth.gender` (optional), `auth.date_of_birth`, `auth.role` (`novice` for every new account),
  `person_facts` from the wizard (`work.status`, `work.level`, `love.status`, `family.children`, `self.focus`,
  `place.current`), `declined_topics`. Companion memory (doc 48) is the sealed fact table the boards and Clarify share.
- Doc 32 Part 1 (pressure map) and Part 2 (mood) are designs; the day-table engine type `panchanga.day` of §2.4 was
  built for Lucky times (doc 47/49). Whether any pressure-map code runs for You is answered by the server audit (§1.3).

### 1.3 From the code audits (`server_self_board_audit.md`, `web_self_board_audit.md`, 2026-11-09)

Facts seen in code unless marked inference. Server: `develop`; web: `develop` 70ae27f.

- **Two Self surfaces share only the digest.** The You reading (`GET /api/self/reading`: nine code panels, five family
  readers, lineman, Oracle) and the You area board (`GET /api/area/self`: "Present Tone Consensus", Timing Clocks, Core
  Strength, Key Horizon, "Why we think so"), which is code only, no model. They can disagree about "how things are now"
  (inference), and the area board ignores `preferred_dasha` after a clock switch.
- **The area list is hard-coded** (`src/reading/self/types.ts:6-8`, `service.ts:84-93`, `:149`) and the Oracle's JSON
  schema is built from it (`oracle.ts:1166,1198`). The Oracle does not choose areas.
- **The Oracle prompt** is `prompts/oracle/self-areas.md` (31 lines; JSON by schema; Parashara, Jaimini and Puri;
  running Mahadasha and Antardasha only; three certainty words; never the engine's name; health never a diagnosis). It
  has no anti-sycophancy rule, no four-tier playbook (chat only), nothing about gender, age or expertise, and it asks for
  "the chart terms and the classical rule named inside the prose" in `paragraphs` (`prompts/generated.ts:16`), which the
  web renders on the card face (`SelfReading.tsx:475-481`). That is the disconnect Sachin saw.
- **The Oracle receives about the person:** today's date, the chosen clock (label, reason, confirming systems) and the
  `self.confirm.*` answers (`oracle.ts:589-606`). It does not receive name, birth data, gender (`Auth.gender` exists),
  age or age band (not computed anywhere), language, any `person_facts` other than confirms (`self.focus`, `love.status`,
  `work.status`, `family.children`, `place.current` never reach it), the area board's tone or shades, the
  `self.personality_joy` / `self.character_arc` outputs, mood, or declined topics (not checked on this path). No
  Novice / Intermediate / Expert field exists; `novice` is a role.
- **Engine data the Oracle gets:** D1 houses and planets (dignity, avastha, shadbala, SAV, aspects, argala, chains),
  D1 and D9 points (arudhas, karakas, special lagnas), yogas and doshas, D9 and D10 and D30 whole, D60 and the other
  vargas as house 1 plus planets, the dasha charter and the activation calendar on every stored system, every stored
  annual year, the ingresses running today. **Not sent:** Sade Sati and dhaiya spans (validator windows only), transit
  house from the Moon and from AL, natal contacts and stations, BAV and transit bindus, arudhas outside D1/D9,
  D5/D6/D8/D11/D81/D108/D144. D10 is sent and no Self panel reads it. `digestSlices.ts` serves chat only.
- **No life-state feed.** Nothing classifies what the person is going through and hands a tone to the Oracle. The
  "7 clocks" are the area board's five dasha families plus transit and annual (`houseLayers.ts:149-155, 877-878`), graded
  by `gradeRow` / `gradePlanet` and combined in `familyVotes`, `votesSide`, `presentTone`.
- **Node derives astrology in eight places** (CLAUDE.md forbids even a lookup): rasi-period lord lookup
  (`houseLayers.ts:394-401`, co-lords ignored); karaka-to-planet join by sign, house and dispositor (`:166-174`);
  transit house from a sign→house map (`oracle.ts:325-351`); "over natal Moon" by sign comparison (`oracle.ts:352`);
  which houses a period activates (`digest/activation.ts:134-147`); the tone and shade scoring with regex-classified
  dignities, avasthas and taras (`houseLayers.ts:125-130, 539-540`); the sensitive-passage rule (`service.ts:727-730`,
  `purview.ts:233`); chapter agreement by month distance (`panels/chapters.ts:20`).
- **Clock switch:** `PUT /api/self/clock` writes `kundlis.preferred_dasha`; the picker lists every system with stored
  periods (`clock.ts:34`, up to ~40), no applicability, no per-system line, no `clock.reason` shown; no confirmation,
  no cost line, failure ignored; the switch also changes Love and Work (shared read, `service.ts:268-277`); the next
  load misses the store and starts a background build (about 60 s and $0.05 per distinct clock, inference from the
  replay); billing is one question per board per day so extra switches are free; no server audit row, only a client
  `chip_select` event.
- **Build and cache:** a page open reads the store (10 s budget); a missing Oracle output marks pending and queues one
  build per kundli, board and day; stuck builds rerun after 10 min, failed ones wait 30 min; `budget_exceeded` is stored
  and served; the lineman still gets the full packs (126 k prompt tokens, against docs 64–65); the sections stream does
  not serve /you; replay 71.7 s (59 s cold), Oracle 44.6 s for 5.9 k output tokens.
- **Web:** the route is `/dashboard/you` (Vite + React Router, not Next); the page stacks a focus-question card, the
  tone card and seven top tabs above the nine-area panel (sixteen destinations); internal ids are shown to every user
  (`self.activation · Present Tone Consensus`, `self.focus · Companion Fact Selector`, badges on five tabs and the
  wizard); board polling gives up silently after 10 × 30 s; an Oracle failure is silent on the card; two build stamps;
  millisecond timings, claim ids, evidence keys and purview jargon under Chart details; `self.focus` asked two ways;
  no shared carousel component (scroll-snap copied into five files), no colour tokens, no custom font; staging shows
  "Choose your dasha" wording that exists in no branch (inference: staging serves a build that is not `develop`).

### 1.4 What the outside research says (report, 2026-11-09)

Three layers repeat in every leading product: who you are (a name and a line, never a score), how you are doing now
(one indicator, one sentence, the why one tap down), what is coming (dated windows with an end). Hard news lands when it
is paired (the gift and the knot it becomes under pressure), conditional ("may", "when pressed") and dated, with one
action. No product rewrites copy by age or gender; they segment by stated intent and life stage, which decides which
panel leads. Premium buyers punish paywall creep and upsells on the self screen. Today's apps serve women 18–49 and
women 25–35 asking about marriage; they fail men 35+, executives and founders, families who need several charts, people
over 60, and the wealthy, who buy discretion and a named human. No app anywhere says "this eases on <date>" on screen:
open ground.

## 2. End goal

The page is titled by the person: their selfie (doc 52; the Ganesh avatar with "Add your photo" until they take one)
beside the word **Self**, in place of "You" (Sachin, 2026-11-09). The route stays `/dashboard/you`; every label a person
reads says Self. The design target is the tablet and the desktop (iPad, Surface, laptop) and the two-fold Duo; the
phone is not the target for now. The page never scrolls: one fixed grid, cards that swipe left and right, and the only
scroll inside a card that needs it.

A person who opens Self with something on their mind reads, in under ten seconds, a tone word, one sentence that names
the life area and the date it changes, and a strip of time from six months back to six ahead. One question asks them to
confirm the strongest claim in their own terms; a tap stores the answer and the board sharpens. Eleven areas sit as a carousel of cards
with grouped chips, arrows and dots (three cards across on a tablet, four on a wide desktop, one per screen on the Duo's
right pane); the first card is the one the engine ranks highest for them today. Every card is one
voice in plain words, written for their age, their stated gender or none, their work and love status and what they said
matters, with the patterns they repeat named as behaviour, a four-step ladder of what to do, and dates. Chart terms, claim
ids and the scorer's lines live under "Chart details". The chapter is written once and holds until the main period
changes; what is live changes at the sub-period boundary and the weekly sky snapshot; nothing is at day grain. Changing
the clock asks first, says it costs a question, and is logged. A novice reads it without a glossary; an astrologer can
open every term below.

## 3. Deliverable

1. **The eleven areas** as technique contracts (`src/techniques/catalog.ts`, `layouts.ts`): `self.now` (hero),
   `self.stuck`, `self.chapter`, `self.diagnosis`, `self.lagna`, `self.mind` (+ patterns), `self.body`, `self.drive`
   (absorbs `self.atma`), `self.presence` (How you come across), `self.yogas` (paired), `self.chapters`, `self.year`. Each names its digest sections, its
   horizon and its refresh trigger (mockup §5).
2. **The pressure and support inventory** from the engine (§4.3): a new export type `pressure_inventory` (windows
   −3 y … +3 y of every active influence with polarity, strength, start, end, the houses and matters touched, the
   "since when" and "eases when" boundaries), stored per kundli, refreshed at a sub-sub-period boundary and on the
   weekly sky snapshot. Node reads it; it computes none of it.
3. **The Personalizer** (§4.1): a second model stage after the Oracle, `self.personalizer`, with its own prompt
   (`prompts/personalizer/self.md`), schema (`PersonalCardDoc`), validator (no new claim, date or chart term; every
   sentence maps to an Oracle paragraph or evidence key), registry and catalogue rows, cache plan and summaries.
4. **The person profile pack** (§4.2): `src/reading/person/profile.ts` builds `{ ageBand, ageYears, gender | null,
   role, facts (work, love, children, focus, place), lastConfirms, declined }` from `auth`, `person_facts`,
   `area_checks`, `declined_topics`. Age arithmetic is calendar arithmetic, not astrology.
5. **The confirm loop on the hero**: one question per open from the strongest dated claim; answers to `area_checks`
   and `person_facts` (doc 48 §4); a No lowers that claim's certainty word and wording on the next build.
6. **The clock switch** (§4.4): consent sheet, applicability from the engine, charge key, `clock_viewed` event.
7. **Web**: the v2 You page (`src/pages/you/`) per the mockup: hero with strip and question, chips / rail, area cards
   with headline, body, patterns, ladder, dates, Chart details; the seven top tabs retired into the areas (Now group)
   and the chat (Your questions).
8. **AGENTS.md**: rule 6 "Tilt the board: facts first, then one question, never a guess" and the question-cost consent
   rule (§9).
9. **The technique flow** (§4.8): ten shared sub-techniques `self.sub.*` with exported types, catalogue rows and
   store keys; eleven area selectors producing `AreaBrief`; typed inputs and outputs for every model agent with its
   registry row, digest slice, cache plan and prefix warm-up before the run; the lineman retired behind a flag.
10. **Tests**: Personalizer validator (new date → rejected; new chart term → rejected; sentence without a source →
   rejected; gender-neutral when gender is null), profile pack (age bands), clock charge (once per system per day,
   greyed clocks unselectable), hero (no internal ids, no counts, withheld when consensus is split), no-scroll layout
   snapshot at 360 px.

## 4. Exactly how it works when done

### 4.1 Backend: Oracle, then Personalizer

```
digest + activation + sky overlay + pressure_inventory (engine rows)
  → code panels (claims; the audit floor)                      ~0.2 s
  → family readers ×5 (cached)  → lineman brief                ~3 s
  → Oracle: OracleAreaDoc, 10 areas, Vedic register, thinking low, responseSchema      ~45 s, ≈ $0.045
  → validator (doc 65) → stored as self.reading.oracle (prompt version in the key)
  → Personalizer: PersonalCardDoc per area, plain register, for THIS person            ~12 s, ≈ $0.01
       inputs: OracleAreaDoc · profile pack · pressure_inventory summary · lastConfirms · register rules
       outputs per area: headline (≤ 14 words) · body (2–3 short paragraphs, ≤ 120 words) · patterns[] (behaviour,
                strength, since/until) · ladder {best, practical, drift, floor} · dates[] (copied, never new) ·
                question? (one, hero only) · certainty (copied)
  → Personalizer validator: every sentence cites an Oracle paragraph id or evidence key; dates ⊆ Oracle dates;
       no term from the chart-term list; no engine name; gender words only when gender is stated; age-band words
       only from the band table; a card that fails on any sentence drops that sentence; a card with no body is
       withheld and the Oracle headline stands in
  → technique_outputs: self.personal.<area> (key: Oracle key + personalizer prompt version + profile hash)
```

- **Two registers, two agents.** The Oracle keeps its strict Vedic brief and gets the `pressure_inventory` and the
  patterns instruction (§4.3); its output grows by two areas (Drive & ambition, How you come across) and the patterns
  list, within 7 k output tokens. The
  Personalizer never sees the chart; it sees the Oracle's document and the person. It cannot add astrology because it
  has none.
- **Profile hash in the key.** A wizard answer, a confirm, a birthday that moves the age band, or a gender change
  invalidates only the Personalizer output (12 s, $0.01), not the Oracle's (45 s, $0.045).
- **Refresh triggers** (per area, mockup §5): main-period boundary (Chapters, natal areas), sub-period boundary (In
  short, This chapter, Where you get stuck, Body live lines), sub-sub-period boundary and weekly sky snapshot (Right
  now), year boundary (This year), digest version (all). A build at a boundary rebuilds only the areas whose trigger
  fired; the store key carries the trigger stamps. No daily build.
- **Oracle validation failures are stored and acted on (Sachin 2026-11-09: "if there's an error it should store that
  error and bubble it up to inform some action being taken about the Oracle"; branch
  `feat/self-v2-oracle-failures-storyteller`).** Every finding of the Oracle validator (unknown evidence key, date not a
  stored span, caps, missing area, JSON/schema failure, cut at the output cap, call failed, budget) and of the
  Personalizer validator (per card and check) is written per build to `reading_validation_failures` (`build_id`,
  `stage`, `area`, `check`, `message`, `area_status`, `model`, `prompt_hash`, `call_id`; no words of the person, so not
  sealed) and logged as one `self.v2 validation` line. When expected Oracle areas fail, ONE repair call re-asks the
  Oracle for only those areas over the same cached prefix with the validator's reasons as a short "fix these" list,
  validates again and marks each area `ok`, `repaired` or `failed` (never a second repair; the call counts in the
  build's cost and `ms.oracleRepair`). Areas that still fail: the good areas are stored; a failed area shows the last
  good stored reading's card on the same clock, marked `stale` ("From your last reading"), else it is withheld. The
  build serves the page (is stored, is `ok`, commits a held question) only when the hero stands and at least 8 of the
  11 areas are ok or repaired; otherwise it is `partial`, nothing new is stored and the question is given back.
  GET /api/self/v2 carries `stale` per area and `quality: { okAreas, repaired, failed }`; the admin loads view
  (`GET /api/admin-lab/loads/:userId`) carries `validation[]` per build. The Personalizer's drops get the same storage,
  without a repair pass.
- **Failure.** Oracle failed → the code lines stand in per area (doc 65). Personalizer failed → the Oracle headline
  and first paragraph stand in, with the chart-term redaction, and the dossier records `personalizer: failed`.
  Pressure inventory missing → the hero is withheld ("Not enough stored yet to say where you are; check back
  tomorrow") and the build enqueues the engine pull.
- **Concurrency and cost.** One build per kundli at a time (today's marker); Oracle and Personalizer in the same
  invocation; total cold build ≈ 60 s, ≈ $0.055 (same as today plus ≈ $0.01). Target after Phase C: three parallel
  Oracle calls of three to four areas on the shared cached prefix ≈ 20 s wall.

### 4.2 The person profile pack

| Field | From | Rule |
|---|---|---|
| `ageYears`, `ageBand` | `auth.date_of_birth` | bands `<25`, `25–35`, `36–45`, `46–60`, `60+`; the band, not the number, goes to the prompt |
| `gender` | `auth.gender` | `woman`, `man`, or null; null means neutral second person, no pronouns, no gendered examples |
| `role` | `auth.role` | `novice` and `public` read the plain register; `student`, `astrologer`, `researcher` may have Chart details open by default |
| `work`, `love`, `children`, `focus`, `place` | `person_facts` (doc 52) | missing → the Personalizer may not mention it and the hero's question may ask for it when it is the strongest gap |
| `lastConfirms` | `area_checks` (doc 45 §3.5) | the last five yes / partly / no with their claim ids; a No on a claim lowers its certainty word |
| `declined` | `declined_topics` | areas and keys never mentioned |
| `mood` | optional one-tap on the hero ("How are you arriving today?" Heavy · Mixed · Fine), stored for the day | shifts the register (Demanding … Closing, doc 45 §7), never the facts |

Age is calendar arithmetic over a date the person typed; it is not an astrological value and stays in Node.

### 4.3 The person's present shade: the pressure and support inventory from the engine

Sachin's ask: tilt the board. The engine already gives yogas, afflictions, dashas on every system, avasthas, transit
overlays and Sade Sati. What the board lacks is those facts **as dated windows around today**, so the words can say
"since May", "eases 12 Dec", "started last year and runs to Feb 2028", and so the assistant can ask "has work felt
heavier since May?" and be right often enough to be trusted.

**New engine export `pressure_inventory`** (change class `moving`; params: kundli, `from = today − 3 y`,
`to = today + 3 y`, `clock = preferred_dasha`):

```
rows[]: { kind: dasha | transit | sade_sati | return | station,
          level: 1 | 2 | 3 (dasha), planet, system,
          houses_touched[] (owned, occupied, aspected, from lagna and from Moon), matters[] (the engine's house→matter table),
          polarity: presses | mixed | supports, strength: 1..3 (engine's avastha/shadbala/functional-nature grade),
          from, to, since_days (if from < today), remaining_days (if to > today),
          evidence: the engine's own ids }
boundaries[]: every from/to inside the range, sorted, with what changes at each
summary: { heaviest_now, eases_at, next_support_from, started_last_12m[], ending_next_6m[] }
```

Everything in it is the engine's judgement from its own tables (functional nature, avastha grades, dignities, house
counts); Node stores and selects rows. The doc 32 Part 1 arithmetic (dasha load × natal weakness × capacity) moves into
this export as the engine's `strength` and `polarity`, so no scoring happens in Node. Horizons the person asks for
(now, this month, three months, six months; the trailing six to nine months) are selections over `rows[]` by `from` and
`to`; the hero strip is `rows[]` drawn between −6 m and +6 m; "Where you get stuck" is `heaviest_now` plus
`started_last_12m` still running; Chapters is level 1 only.

**How you come across** (`self.presence`) is a new Oracle area: bearing and build from the 1st house frame and the
lagna lord; the style lent by planets in and aspecting the 1st; adornment, taste and care from Venus (sign, house,
dignity, avastha); face and voice from the 2nd; the public polish from the Arudha Lagna against the private ease of the
Moon and the 4th; and two dated windows from the periods of Venus and the lagna lord on the primary clock: when the
person looked their best, and whether the care has dropped in the live sub-period and why. The Personalizer writes it
as a recognisable picture ("put together for the room, loose at home") with the past window named and one confirm
question ("Does that match?"); a yes is stored as a fact and raises the board's standing to say harder things.

**Patterns the person repeats** come from the Oracle, not the inventory: a new instruction in `oracle/self-areas`
asks, under How you think and Where you get stuck, for up to three standing behaviours as `{ behaviour, mechanism,
since, until }` with evidence keys, each a classical reading of a placement or avastha (speculation past the evidence
from Rahu on the 5th; carrying others' load from the lagna lord in the 7th in a spent avastha; recovery through
structure from Saturn's aspect on the Moon, and so on). The Personalizer turns each into a sentence of behaviour the
person can recognise and never names the planet.

### 4.4 The clock switch

- The sheet: title, what the person's primary clock is and why ("the one your chart qualifies for"), the cost line
  ("Uses 1 of your 20 questions this month"), the list with one plain line each and the engine's applicability
  (`dasha.applicable`; `applies: false` → greyed, unselectable, reason shown; `null` → "not checked for your chart"),
  Not now / Rebuild on <system> · 1 question.
- The tap: `PUT /api/self/clock { system }` → `QuestionGate.reserve('board:self:<day>:clock:<system>')` + commit (a
  repeat the same day is free, as every key is) → `kundlis.preferred_dasha` updated → `clock_viewed` event
  (`account_events` or `analytics_events`: user, from, to, charged, at) → the build enqueued → 202 `{ usage, status:
  'building' }`. At the limit: the build still runs, the counter stays at the limit (billing/02 §9).
- Default: the engine's primary clock for the chart, never Vimshottari by habit (TODOS 2026-11-07, "the main clock is
  always Vimshottari").

### 4.5 API

| Call | Change |
|---|---|
| `GET /api/self/reading` | each panel gains `card: PersonalCard` and `cardStatus: ok \| pending \| withheld \| failed`; `area` stays for Chart details; `hero: { tone, sentence, strip: rows[], question?, eases_at, next_check }`; `profile: { ageBand, hasGender, facts: keys only }`; `clock: { system, applies: [...] }` |
| `PUT /api/self/clock` | new; 202 as above; 400 unknown or inapplicable system; 402 never (board builds are not refused) |
| `POST /api/self/confirm` | `{ claimId, answer: yes \| partly \| no \| declined }` → `area_checks` (+ `person_facts` when the question was a fact gap) → 204; the next build reads it |
| `POST /api/self/mood` | `{ mood }` for the day → 204 |

### 4.6 Frontend experience

- Open: the hero from the store (≤ 1 s), chips, the first card. Building: the veil over the cards with the rotating
  lines (doc 64), the hero from the last build if any. Failed Personalizer: the Oracle headline under redaction, "Chart
  details" open to the Oracle text. Withheld: "Not enough in your chart to say this with confidence."
- The app header (logo, question counter, Happy Hour(s), General Reading, Personalize, avatar) and the app footer
  (disclaimer, Terms, Privacy) stay as they are, anchored to the viewport; the board sits between them and repeats
  nothing from them (Sachin, 2026-11-09). The board's own row is the selfie, Self, the clock line with the build date
  and the carousel controls.
- Tablet landscape and desktop: one fixed grid (app header 52 px, board row 56 px, hero, carousel, app footer 34 px),
  no page scroll; grouped
  chips (Now · You · Time), arrows, dots and ← → keys move one card; three cards across at 1180 px, four at 1440, two in
  portrait; the rightmost card dimmed as the peek. A card longer than its slot scrolls inside its body with header and
  footer pinned. Duo: left pane holds selfie, hero, question and the area list; right pane holds one card, swiped
  across the hinge; Chart details opens as a sheet over the right pane only. Phone: later, one card across.
- The confirm question: tap → 204 → the chip "Thanks, noted" → the next build sharpens; no page reload.
- Change clock: sheet → tap → counter ticks within a second (`usage`) → veil → areas land.

### 4.7 UI/UX words

- Tone words on the hero: Demanding · Heavy · Mixed · Easing · Steady · Open (doc 45 §7 tones; one word, never a score).
- Headline ≤ 14 words, second person, names a life area and, on live cards, a date. Body ≤ 120 words. Ladder labels:
  Best · Practical · Drift · Floor (the SOUL.md four tiers in the person's words).
- Dates "16 Feb 2028"; ranges "16 Nov 2025 – 1 Jan 2027"; "since May" for a past boundary inside twelve months.
- Never on a card: planet or house names, dasha words, degrees, system names, clock counts, internal ids, "divided",
  medical words (doc 61 §3), engine names. All of them may appear under Chart details.
- The body card keeps its standing line: "What the chart and the sky put on the body. Not medical advice."

### 4.8 The technique flow: sub-techniques run once, areas select, agents get a typed slice and a warm cache

Sachin, 2026-11-09: the eleven areas are on one board, so everything they need runs once; the techniques behind them
are broken into reusable sub-techniques that run once per build and hand their data to the areas and the agents; the
code does as much of the Oracle's work as it can (what could go wrong, from where, from who, when, and what holds it)
so the Oracle reasons over a ledger, not over raw packs; every agent has types defined first, is registered, and has
its cache slice prepared and warmed before it runs.

**Layer 0 — engine rows, stored per kundli** (never computed here): `kundli_digest` (natal, vargas, dignities,
avasthas, shadbala, ashtakavarga, yogas, doshas, karakas, arudhas, relations, star profile), `kundli_activation`
(every stored dasha system, levels 1–3, with the engine's charter), the sky overlay (ingresses, Sade Sati, stations,
contacts), `kundli_pressure` (the `pressure_inventory` of §4.3), `dasha.applicable`, the annual rows.

**Layer 1 — shared sub-techniques (code, deterministic, one `SelfBuildContext` per build).** Each reads Layer 0 and
earlier sub-techniques only, never the database twice for the same rows, and writes its output to `technique_outputs`
under `self.sub.<name>` keyed by digest version, clock, and the boundary stamps that can change it. Each is a `TECHNIQUES`
row (`kind: 'code'`, its algorithm in plain steps, its charts, its code path) and a `withAgentRun` span with
`technique` and `kundliId`.

| # | Sub-technique | Reads | Produces (type) | Rebuilt when | Feeds |
|---|---|---|---|---|---|
| S1 | `self.sub.clock` | `preferred_dasha`, `dasha.applicable`, stored systems | `ClockResolution { primary, reason, confirming[], applicable[], notApplicable[{system, reason}] }` | preference or digest | every area, the clock sheet |
| S2 | `self.sub.periods` | activation on S1.primary; planet cards; charter | `PeriodFrame { previous, running, next (L1); running L2, L3 with from/to; relation (6/8, 2/12, …) from the charter; boundaries[] }` | sub-sub period boundary | Chapters, This chapter, In short, hero, S5 |
| S3 | `self.sub.windows` | `kundli_pressure` rows −6 m … +6 m and −3 y … +3 y | `WindowSet { strip[], heaviestNow, easesAt, nextSupportFrom, startedLast12m[], endingNext6m[], byMatter{} }` | sub-sub boundary, weekly sky | hero, Where you get stuck, Body, This chapter, S5 |
| S4 | `self.sub.promise` | yoga and dosha rows, functional nature, dignities, avasthas, karakas, arudhas, house frames | `PromiseLedger { entries[]: { id, matter, kind: gift \| knot \| grace, source: { yogaId \| planet \| house }, who: PeopleLabel[], strength, cancels?: id, evidence[] } }` | digest version | Gifts & knots, Who you are, Drive, Mind, S5 |
| S5 | `self.sub.risk` | S2 × S3 × S4 | `RiskLedger { rows[]: { matter, what, from: { planet, house, yogaId? }, who: PeopleLabel[], since, until, polarity, strength, holds: id[] (the graces that limit it), evidence[] }, top3 }` — "what could go wrong, from where, from who, when, and what holds it" | S2 or S3 change | hero, Where you get stuck, This chapter, Body, Drive, the Oracle brief |
| S6 | `self.sub.mindFacts` | Moon, Mercury, Rahu, Saturn cards; 4th and 5th frames; lunar yogas; star profile | `MindFacts { feeling, thinking, peace, judgement, candidatePatterns[]: { placement, evidence } }` (facts only; the Oracle names the pattern) | digest version | How you think, Where you get stuck |
| S7 | `self.sub.bodyFacts` | 1st, 6th, 8th frames; L1, Su, Mo, Ma, Sa cards; D30 h1; A6; S2 lords on 1/6/8; S3 Saturn and Mars rows over lagna and Moon | `BodyFacts { footing, wear, shape, liveLords[], liveTransits[], sensitive: boolean (engine flag) }` | S2/S3 change | Body & energy |
| S8 | `self.sub.presenceFacts` | 1st frame and occupants and aspects; Venus card; 2nd frame; AL vs Moon and 4th; Venus and L1 periods from activation (past and live) | `PresenceFacts { bearing, style[], adornment, face, publicVsPrivate, bestWindow {from,to,evidence}, liveCare {dropped: boolean, until} }` | S2 change | How you come across |
| S9 | `self.sub.year` | annual rows covering today; year dashas | `YearFrame { from, to, yearLagna, yearLord, running short clock, noCoverage: boolean }` | year boundary | This year |
| S10 | `self.sub.profile` | `auth`, `person_facts`, `area_checks`, `declined_topics`, today's mood | `ProfilePack` (§4.2) | any fact change | Personalizer, the hero question picker, S5 (declined matters removed) |

`PeopleLabel` and `matter` come from one words table (`SELF.people`, `SELF.matters`: 7th → partners and clients, 10th →
authority and the boss, 6th → rivals, debt and what wears you, 4th → home and mother, 9th → father, teachers and luck,
3rd → siblings and effort, 11th → friends and elder siblings, 5th → children and ideas, 2nd → family of origin, speech
and money in hand, 8th → the hidden and the sudden, 12th → loss, distance and rest), reviewed by Sachin like
`SELF.words`; it is vocabulary, not a derivation.

**Layer 2 — area techniques (eleven, code): the area work orders.** Each is a pure selection over S1–S10 into an
area work order (type `AreaBrief`; the code name stays). A work order is the Oracle's order for one area: the facts
(claims), the evidence keys, the dates and the ledger rows the Oracle reads for that area, and it also scopes the
Oracle validator (its claim ids and keys are allowed evidence keys, its dates are stored spans). Shape: `AreaBrief { areaId,
claims[] (id, text-free facts with evidence), dates[] from S2/S3/S9, ledgerRows: id[] from S5, promiseEntries: id[]
from S4, horizon, refreshStamp }` plus the code floor lines (doc 62) for pending and failed states. No area touches the
database; a test asserts it.

**Layer 3 — model agents, each with a type, a registry row, a slice and a cache plan, prepared before it runs.**

| Agent | Input type | Output type | Digest slice (`SUBAGENT_DIGEST_SPECS`) and cache prefix | Model, budget |
|---|---|---|---|---|
| family readers ×5 (`family.rasi`, `varga`, `dasha`, `year`, `sky`) | `FamilyPackInput` (the family's rows only) | `FamilyFindings` | each its own prefix ≥ 1,024 tokens (pad `family.sky` with the inventory rows so it clears the minimum, doc 65 §9b) | flash-lite, cached, as today |
| `self.oracle` | `OracleInput { clock: S1, periods: S2, windows: S3 summary, risk: S5 top 12, promise: S4 top 8, mind: S6, body: S7, presence: S8, year: S9, areaBriefs[11], familyFindings[5], confirms }` ≈ 9–11 k tokens | `OracleAreaDoc` (doc 65) + `patterns[]` | prefix = the natal slice (`digest.d1.*`, `digest.d9.*`, points, yogas) + S4 PromiseLedger, stable per digest version; suffix = S2/S3/S5/S9 and the briefs | gemini-3.8-flash, thinking low, ≤ 7 k out; three parallel calls of 3–4 areas over the same prefix |
| `self.personalizer` | `PersonalizerInput { oracle: OracleAreaDoc, profile: S10, windows: S3 summary, register rules }` | `PersonalCardDoc` (§4.1) | prefix = the Oracle document (stable per Oracle key); suffix = the profile pack | flash-lite, ≤ 2.5 k out |
| `self.lineman` | retired: S4 and S5 do its join in code; kept behind a flag for one release | — | — | — |

Each agent: a `src/reading/self/agents/<name>.ts` with its `Input` and `Output` types exported from
`src/reading/self/types.ts`, a Zod or `responseSchema` validator, an `AGENTS` row in `src/agents/registry.ts`, a
`TECHNIQUES` row with `selectors` and `contract`, an entry in `SUBAGENT_DIGEST_SPECS` (`digestSlices.ts`) and in
`subagentCachePlan.ts` with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`, summaries that hold counts, ids
and tones only (`tests/unit/techniques/summaries.test.ts`), and recycling through `recycleIndividualCaches` after 45
minutes.

**Order of a build (one invocation, `runSelfReadingBuild`):**

```
0  load Layer 0 rows once (one query per table, kundli-scoped)                                  ≈ 300 ms
1  S1 → S2 ∥ S3 ∥ S4 ∥ S6 ∥ S8 ∥ S9 ∥ S10 → S5, S7 (need S2, S3, S4)                             ≈ 200 ms
2  Layer 2: eleven area work orders (AreaBrief) + floor lines; store `self.sub.*` and `self.area.*` ≈ 100 ms
3  build every agent's slice from the context (no DB); warm the five family prefixes, the Oracle
   prefix and the Personalizer prefix in parallel (explicit cache, READING_EXPLICIT_CACHE=1)       ≈ 1.5 s
4  family readers ×5 in parallel (cached after the first build per digest version)               ≈ 3 s cold, 0 warm
5  Oracle: three parallel calls over the warm prefix                                               ≈ 15 s
6  validator (doc 65) → every finding to `reading_validation_failures`; failed areas re-asked in ONE
   repair call (same prefix), validated again; store `self.v2.oracle` (ok, or partial with ≥ 8 areas) ≈ 100 ms (+ ≈ 10 s on a repair)
7  Personalizer over the Oracle document + S10                                                     ≈ 8 s
8  validator (§4.1) → drops to `reading_validation_failures`; failed Oracle areas take the last good
   reading's card (stale) or are withheld; store and charge only when the build serves the page
   (the hero and ≥ 8 of 11 areas ok or repaired), else partial: nothing stored, question given back  ≈ 100 ms
                                                                                   cold ≈ 28 s · warm (profile change only) ≈ 9 s
```

A boundary rebuild runs only the sub-techniques whose stamp fired and the agents whose slice changed; the store keys
carry the stamps, so an unchanged slice is a cache hit and costs nothing.

**The cache ledger and the 45-minute sweep.** Every prefix the build warms is a region with an `llm_cache_entries`
row (`name`, `provider`, `user_id`, `kundli_id`, `prefix_hash`, `model`, `expires_at`); the build writes the row when it
creates the region and calls `informIndividualCacheUsed({ userId, kundliId })` after each agent call, so
`recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`, `READING_CACHE_RECYCLE_MINUTES` = 45) deletes the person's
regions, `reading_findings_cache` and `technique_outputs` rows after 45 minutes of inactivity, and `runScheduledSweep`
catches what a dead invocation left behind. A test creates a region through the build and asserts its ledger row; a
second asserts the sweep deletes it. The Lab's build view shows cached versus total tokens per agent (target: above 70 %
cached on a warm build). These rules are now AGENTS.md "Board and technique machinery".

**What the Oracle is told about the ledger.** For each `RiskLedger` row it receives: the matter, what the chart says
can go wrong, from where (the planet, house or yoga), from who (the people label), since and until, how strong, and
which graces hold it. Its job is to read the row against the classical rules, confirm or reject it with evidence, add
what the code cannot (the pattern behind it, the interaction between rows, the counsel), and never to rediscover the
dates. The Personalizer then says it in the person's words with the four-step ladder.

### 4.9 Budget per build (estimates, added by the final integration 2026-11-09)

Every figure below is an **estimate** unless the row says "measured". Measured rows come from the doc 65 replay of the
v1 path; the v2 rows are the plan's arithmetic over the slice sizes and the prices in `src/reading/llm/models.ts`
(`PRICES`; Flash doubles on 2027-01-01 through `PRICE_CHANGES`, so every v2 Oracle figure doubles that day). No v2 build
has run against a provider yet; the first replay (doc 66 §13, needs Sachin's yes) replaces these with measured numbers.

| Step | Measured today (doc 65 replay, v1 path) | v2 estimate |
|---|---|---|
| Family readers ×5 | cold ≈ 126 k in / ≈ 3.5 k out ≈ $0.037 | $0 warm (read through `reading_findings_cache`) / ≈ $0.037 cold |
| Lineman | 126,105 in / 98,322 cached / 596 out / 3.4 s / $0.0103 | retired on the v2 path |
| Oracle | 40,665 in / 12,246 cached / 5,908 out / 44.6 s / $0.0444 | 3 parallel calls, each ≈ 11 k in (≈ 8 k cached) / ≈ 2.2 k out; ≈ $0.033 in all; ≈ 17–20 s |
| Personalizer | (none in v1) | ≈ 8 k in / ≈ 2–4 k out ≈ $0.005–0.008; ≈ 8–12 s |
| One build | 72 s; $0.055 warm, ≈ $0.09 cold | cold ≈ $0.075–0.08 and ≈ 35 s; warm ≈ $0.04 and ≈ 28 s; profile-only ≈ $0.005 and ≈ 10 s |

**Measured on the first v2 replay (2026-11-09, kundli `c584c0a3`, doc 66 replay report), next to the estimate, and
what the fixes of branch `fix/self-v2-replay-findings` should change.** The "after the fixes" column is arithmetic on the
replay's own token counts and the 2026-11-09 prices (3.8-flash ≈ $0.75 / M input, $0.075 / M cached, $3.75 / M out,
derived from the replay's per-call costs); no call has been made since.

| Step | v2 estimate | Measured 2026-11-09 | Expected after the fixes (not yet measured) |
|---|---|---|---|
| Family readers ×5 | ≈ $0.037 cold | 87.2 k in, 99.3 % cached, 3.3 k out + 5.4 k thought; $0.0154; 6.4 s | unchanged |
| Oracle ×3 | each ≈ 11 k in (≈ 8 k cached), ≈ 2.2 k out; ≈ $0.033; ≈ 17–20 s | each 34.6 k in, 13.4 k cached (**38.6 %**), 2.2–3.7 k out, 0 thought reported; **$0.0842**; 27.4 s | the reading frame moves into the cached prefix: each ≈ 29.4 k of 34.6 k cached (**≈ 85 %**, target ≥ 70 %), ≈ $0.006 input per call instead of ≈ $0.017; step ≈ **$0.052**; wall unchanged (output-bound). The larger region costs more storage per hour (not in `PRICES`). |
| Personalizer (per profile) | ≈ 8 k in, ≈ 2–4 k out; $0.005–0.008; 8–12 s | 7.7 k in (97 % cached), 2.7–4.0 k out + 0.1–2.3 k thought; $0.0064–0.0077; 12.2–13.6 s; **2 of 3 cut at `MAX_TOKENS`** | thinking `minimal` (≈ 0.1–0.3 k thought), cap 8,000, one retry at 12,000 on `MAX_TOKENS`: ≈ $0.006 and ≈ 9–11 s per profile; a retry doubles that profile's cost when it happens |
| Sub-techniques + briefs | ≈ 300 ms | **9.1 s** (database round trips from a laptop) | ≈ 10 sequential round trips cut to ≈ 6 (Layer 0 in one round, run logs awaited once at the end): a 150 ms-per-trip simulation runs under 1 s (test `replayFindings.test.ts`); the database side (digest row size, Render latency) cannot be checked offline; on the Lambda next to the database it should be well under 1.5 s |
| One cold build, one profile | ≈ $0.075–0.08, ≈ 35 s | ≈ $0.107 + ≈ $0.004 storage, ≈ 61 s | ≈ $0.074 + storage, ≈ 50–55 s from a laptop |

**Measured on the second v2 replay (run 2, 2026-11-09, after `fix/self-v2-replay-findings`; report
`66-replay-2026-11-09-self-v2-run2.md`).** One build, kundli `c584c0a3`, three synthetic profiles, 11 model calls, 0
retries, 0 refusals.

| Step | Expected after the run 1 fixes | Measured run 2 |
|---|---|---|
| Family readers ×5 | unchanged | $0.0154, 6.7 s; `family.dasha` stopped at `MAX_TOKENS` (654 out + 1,342 thought against the fixed 2,000). Cap now 4,000 (`SELF_FAMILY_MAX_OUTPUT_TOKENS`); a cut finding passes only complete sentences, is never cached (branch `fix/self-v2-run2-findings`) |
| Oracle ×3 | ≈ 85 % cached, ≈ $0.052 | **89.7 % cached** (31.4 k of 35.0 k per call); **$0.0520**; 26.2 s; 0 thought tokens reported (whether the provider reports the field at `low` is still unverified: the timings now record "not reported" instead of 0 when the field is absent) |
| Personalizer (3 profiles) | ≈ $0.006 and ≈ 9–11 s each; a retry when cut | **3 of 3 `STOP`** on the first call at the 8,000 cap; 4.1–4.3 k out, 0 thought (`minimal`); $0.0196 for the three; 10.4–12.2 s |
| Sub-techniques + briefs | ≈ 6 round trips, well under 1.5 s on the Lambda | **9.0 s** from a laptop (run 1: 9.1 s): the parallel Layer 0 gained nothing measurable. Per-read timings now land in the build's `ms` (`sub.load.digest`, `…kundli`, `…systems`, `…sky`, `…profile`, `…applicability`, `…activation`, `…pressure`); the profile read moved into Layer 0. Not yet measured on the Lambda |
| One build, three profiles | — | **$0.087 for 11 calls** (`priceFor`) + **≈ $0.002 storage** (126,548 cached tokens × $1 / M / h × 1.04 min; the regions were deleted after the run) ≈ **$0.089**, against a $0.15 cap; 72.7 s wall (58.9 s of build steps, ≈ 14 s deleting cache rows, 15 of which failed with HTTP 403 on expired regions: now treated as gone) |

**The Personalizer on the Oracle's model (Sachin, 2026-11-09; branch `fix/self-v2-run2-findings`), estimate.** The
Personalizer now builds a portrait of the person (`PersonPortrait`: character, biography, the past month, mood trend,
health, the eleven life labels' state, register, birth and current place) and runs on the Oracle's model by default
(`modelFor('oracle')`, today gemini-3.8-flash; `SELF_PERSONALIZER_MODEL` overrides) at thinking `low`, cap 12,000
(retry 16,000). At Flash prices (≈ $0.75 / M in, $0.075 / M cached, $3.75 / M out): ≈ 8.5 k cached Oracle document
($0.0006) + ≈ 1.5–2.5 k uncached suffix with the portrait ($0.0015) + ≈ 4.3 k card output and an assumed 1–3 k of
thought at `low` (≈ $0.020–0.027) ≈ **$0.022–0.029 per profile**, against $0.0065 on flash-lite in run 2 (about four
times), and ≈ 15–25 s instead of 10–12 s. One cold build with one profile moves from ≈ $0.074 to ≈ $0.09. Not measured:
the first run on the new default measures the thought tokens (whether 3.8-flash reports them at all is still open).

**The Personalizer as storyteller, and its model (Sachin 2026-11-09).** The Personalizer stays on the Oracle's model:
`getSelfPersonalizerModel()` (`src/config/env.ts`) falls back `SELF_PERSONALIZER_MODEL` → `READING_MODEL_ORACLE` (today
gemini-3.8-flash on the live Lambda) → `READING_MODEL_SYNTH` → the chat model; there is no hard-coded 3.8-flash default
in code, the live value comes from the Lambda env. gemini-3.6-flash is priced exactly as 3.8-flash in
`src/reading/llm/models.ts` (0.75 / 3.75 / 0.075 per M, doubling on 2027-01-01 for both), so moving to it saves nothing.
A Pro model (`gemini-3.1-pro-preview`, 2.00 / 12.00 / 0.20) would cost about three times as much per Personalizer
call (≈ $0.07–0.09 per profile): only for a later side-by-side test, not now. Each card may now carry one
`illustration` (`{ text, kind: example | analogy | modern, illustrates: <Oracle paragraph id> }`, ≤ 40 words; the hero
may carry one too): the Oracle point most likely to be misread, made to land with an everyday example, an analogy or a
widely known modern reference fitted to the portrait. It adds no claim, date, chart term, prediction, advice or medical
content; its own validator rule set drops a failing illustration alone, never the card. Estimate: ≈ 11 × 40 words ≈
600 more output tokens per profile, ≈ $0.002 at Flash prices.

Token estimate: the Lab now shows chars / 2.2 (`estProviderTokens`; the replay's 74.6 k chars of Oracle input were
34.6 k provider tokens); chars / 4 stays only as the conservative padding bound for the 1,024-token cache minimum.

Notes, each one a caveat on the table:

- **Explicit cache storage is billed per hour and is not in `PRICES`.** The v2 build warms the five family packs, the
  Oracle prefix and the Personalizer prefix as explicit regions (`warmPrefixes`). Verify the storage rate per
  region-hour before relying on explicit caching for the family packs; if the packs do not pay their storage back on a
  warm rebuild, warm only `self.oracle` and `self.personalizer` (docs/TODOS.md, filed by the agents lane).
- **Thinking tokens were recorded as 0 on the v1 path** because it never passed `usage` to the run log
  (`withAgentRun` reads only `usage`); fixed 2026-11-09 in `src/reading/self/oracle.ts`, and the v2 path passes it.
  Whether Gemini 3.x returns `thoughtsTokenCount` with `includeThoughts: false` is still unverified, so the Oracle's
  thinking cost may be missing from the measured row.
- **The Personalizer's output cap is 8,000 tokens** (`SELF_PERSONALIZER_MAX_OUTPUT_TOKENS`, raised from 5,000 after
  the replay): profile c's complete document was 4,023 output tokens, and on Gemini 3.x thought tokens count against
  the cap. A `MAX_TOKENS` finish is retried once at `SELF_PERSONALIZER_RETRY_MAX_OUTPUT_TOKENS` (12,000); a cut
  document is never stored.

**One build, one bill (branch `fix/self-v2-single-build`, 2026-11-09).** Until this branch a self build with
`SELF_V2_BUILD=1` ran the whole v1 path first (family readers through the v1 code, the v1 lineman and the v1 Oracle) and
then the v2 build, and a self refresh forced the v1 synthesis as well, because the v1 synthesis owned `valid_until`. Now,
with the flag on (and the model layer on), the self build event runs the v1 code panels only (`oracleMode:
'cached_only'`: no model call; they stay as the floor the old page and the v2 API read) and the v2 build is the
reading. The board's dates (`selfBoardDates`) come from the newest stored v2 Oracle document's `doc.validUntil`; the
question held for a refresh is committed when the v2 build is `ok` and given back otherwise. So every cold build and
every refresh drops the v1 lineman + v1 Oracle, **≈ $0.055** by the doc 65 measurement ($0.0103 + $0.0444): the "one
cold build, one profile" row above is the whole cost of a self build with the flag on, where before it was that plus
≈ $0.055. The v1 family readers are not run either: on a warm `reading_findings_cache` they cost nothing, but where
their packs differ from the v2 packs a cold v1 read was a second bill (up to ≈ $0.037, not counted in the $0.055).
Love and Work builds are unchanged. Tests: `tests/unit/reading/self/v2agents/singleBuild.test.ts`.

**Slice sizes on the fixtures (chars / 4, `estTokens`; not provider counts).**

| Slice | Agents lane unit fixture (`tests/unit/reading/self/v2agents/fixtures.ts`) | Research calibration kundli (`tests/fixtures/self/research-calibration.json`, e2e test) |
|---|---|---|
| `family.rasi` prefix | not reported | 2,663 (suffix 128) |
| `family.varga` prefix | ≈ 880 (below the 1,024 minimum) | 680 (suffix 69) |
| `family.dasha` prefix | ≈ 190 (below) | 1,803 (suffix 99) |
| `family.year` prefix | ≈ 30 (below) | 795 (suffix 96) |
| `family.sky` prefix | padded past 1,024 | 579 (suffix 76; below: the fixture has no stored sky rows to pad with) |
| `self.oracle` | ≥ 1,024 (asserted by `build.test.ts`) | prefix 3,676, suffix 4,603 |
| `self.personalizer` | not reported | prefix 800 (below; the mocked Oracle document is short), suffix 128 |

A prefix under 1,024 tokens is refused as an explicit region and its call goes uncached; docs/TODOS.md keeps the
padding item open, now with the research-kundli numbers.

## 5. Architecture

```
engine (export types) ── natal/varga/dasha/avastha/yoga rows ─┐
                      ── sky overlay (weekly)                 ├─► kundli_digest · kundli_activation · overlays · pressure_inventory
                      ── pressure_inventory (−3y…+3y)        ─┘                     │
                                                                                     ▼
 self-reading-build (own invocation, one per kundli)
   ─► Layer 1: S1 clock → S2 periods ∥ S3 windows ∥ S4 promise ∥ S6 mind ∥ S8 presence ∥ S9 year ∥ S10 profile → S5 risk, S7 body
   ─► Layer 2: eleven area work orders + floor lines        ─► slices built, prefixes warmed (families, Oracle, Personalizer)
   ─► readers ×5 (cached) ─► ORACLE ×3 parallel (Vedic, JSON, over S4+S5 ledger and the briefs)
                                                                                     │
                                            S10 profile pack ─────────────────────────► PERSONALIZER (plain, JSON)
                                                                                     │
                                                 technique_outputs: self.reading.oracle · self.personal.<area> · self.hero
                                                                                     │
 GET /api/self/reading ◄── store ──► web: hero · chips/rail · cards · Chart details · confirm · clock sheet
 PUT /api/self/clock ──► QuestionGate ──► clock_viewed ──► preferred_dasha ──► build
```

Boundaries: the engine guarantees every astrological value and window; the Oracle guarantees grounding (evidence keys,
dates inside windows); the Personalizer guarantees register and person-fit and may not add; the web guarantees no
chart term above the fold and no scroll of sections.

## 6. Ingredients

- Engine (AIAstra_Radha): `pressure_inventory` export (JSON builder over existing functions: dashas on the chosen system
  with house counts, functional nature, avasthas, transit ranges, Sade Sati phases); `dasha.applicable` for every
  conditional system. Owner: engine session, after Sachin's OK (the engine was hands-off until 2026-10-25; the Radha pass
  is planned in doc 20–22).
- Server: `src/reading/person/profile.ts`; `src/reading/self/personalizer.ts` (+ prompt, schema, validator);
  `oracle/self-areas` prompt v2 (tenth area, patterns, inventory brief); catalogue, registry, cache plan, digest slices,
  summaries rows; `PUT /api/self/clock`, `POST /api/self/confirm`, `POST /api/self/mood`; `clock_viewed` event; env
  `SELF_PERSONALIZER_MODEL` (default `gemini-3.1-flash-lite`), `SELF_PERSONALIZER_MAX_OUTPUT_TOKENS` (5,000),
  `SELF_AGE_BANDS` ("25,36,46,61"), `SELF_HERO_HORIZON_MONTHS` (6), `READING_EXPLICIT_CACHE=1` on the Lambda (open since
  doc 65 §9b).
- Web: `src/pages/you/` v2 (Hero, Strip, Chips, AreaCard, Patterns, Ladder, ClockSheet), tests, 360 px snapshots.
- Fixtures: the two stored dossiers (7:36 am and 21:20 builds), the research cohort of 20 synthetic subjects
  (`selfDashboardQa.ts`) across the five age bands and three genders (woman, man, unstated).
- Model spend for the plan (needs Sachin's yes before each phase): Phase A replay 2 Oracle + 2 Personalizer calls ≈
  $0.13; Phase C cohort 20 × ($0.045 + $0.01) ≈ $1.10.

## 7. Action steps in sequence

1. **Contracts** (server): `PersonalCardDoc`, `HeroDoc`, `PressureInventory`, the ten `self.sub.*` output types, `AreaBrief`,
   `OracleInput`, `PersonalizerInput`; profile pack with age bands; tests. — `src/reading/self/types.ts`,
   `src/reading/person/profile.ts`.
1b. **Sub-techniques and areas** (server, parallel with 2): S1–S10 in `src/reading/self/sub/*.ts` over one
   `SelfBuildContext`, the eleven area selectors, catalogue and registry rows, store keys with boundary stamps; a test
   that no area reads the database and that S5's rows carry matter, from, who, since, until and holds.
1c. **Agent slices and cache plans**: `SUBAGENT_DIGEST_SPECS` and `subagentCachePlan.ts` entries for the five family
   readers, the Oracle and the Personalizer; prefix warm-up step in `runSelfReadingBuild` before any call; `family.sky`
   padded past 1,024 tokens; a test that every agent's prefix is warmed before its first call.
2. **Engine export** `pressure_inventory` + `dasha.applicable` completeness (engine repo, parallel with 1). Done: a
   pull for Sachin's and one research kundli lands in a new `kundli_pressure` table with boundaries that match the
   stored activation rows.
3. **Oracle prompt v2**: Drive & ambition absorbing atma, the new How you come across area, patterns block, inventory brief in the prefix;
   bundle regenerated; Lab replay on the two dossiers (≈ $0.09, Sachin's yes).
4. **Personalizer**: prompt, call, validator, store, registry/catalogue/cache rows; replay on the same two dossiers for
   three profiles each (woman 25–35 founder; man 46–60 senior leader; unstated 60+) (≈ $0.06, Sachin's yes); Sachin
   reads all six.
5. **Hero**: `self.hero` built from the inventory summary + the Personalizer's one sentence + the question chosen from
   the strongest dated claim; withheld rules; no counts, no ids.
6. **Clock switch**: endpoint, charge key, event, applicability; tests.
7. **Web v2 page** per the mockup; the seven top tabs retired; snapshot tests at 360 px light and dark; no-scroll check.
8. **Confirm and mood loops**: endpoints, store, the next-build sharpening; tests.
9. **Cohort run** (Phase C): 20 subjects × 5 bands; the 8-gate verifier plus three new gates (no chart term on a card,
   every sentence sourced, gender-neutral when unstated); Sachin's "recognise your own chapter" read on his board.
10. **AGENTS.md** rule 6 and the question-cost consent rule; TODOS filed and closed.

Parallel: 1 → 1b ∥ 1c ∥ 2; 3 → 4 after 1c; 5 and 6 ∥ 7 after 1b; 8 after 7; 9 after 4–8.

## 8. Development phases

| Phase | Scope | Time | Model cost | Gate |
|---|---|---|---|---|
| A | Steps 1, 1b, 1c, 3, 4: contracts, sub-techniques and areas, agent slices and warm-up, Oracle v2, Personalizer, Lab replay on 2 dossiers × 3 profiles | 3 days | ≈ $0.15 | six readings validate; no chart term above the fold; Sachin reads them and names which profile each was written for |
| B | Steps 5, 6, 7: hero, clock switch, web v2 | 2 days | $0 | live You page shows the mockup's first screen; counter ticks on a clock switch; 360 px no-scroll snapshot green |
| C | Steps 2, 8, 9: engine inventory, confirm and mood loops, cohort | 3 days (engine 1.5 in parallel) | ≈ $1.10 | inventory boundaries match activation rows on 2 kundlis; cohort ≥ 95 % on 11 gates |
| D | Love and Work on the same Personalizer | 1 day | ≈ $0.10 | same gates |

Until C ships, the hero reads its windows from `kundli_activation` and the stored sky overlay (both engine rows) with
polarity from the Oracle's own claims, and says "since" only for boundaries it has.

## 9. One recommendation

Build **A and B together as one release**: the Personalizer is the missing stage and the web page is what Sachin is
looking at; neither is useful alone. Keep the Oracle's strict brief untouched except for the tenth area and the patterns
block; the register problem is solved after it, not inside it. Start the engine's `pressure_inventory` in parallel on
day one because it is the long pole for C and the "tilt". Retire the seven top tabs; the chat answers questions.

| Option | Verdict |
|---|---|
| Personalizer as a second agent (chosen) | The Oracle stays a reader; the person-fit is testable on its own; profile changes cost $0.01 not $0.05 |
| Teach the Oracle both registers in one prompt | Longer prompt, two jobs, every profile change re-runs the 45 s call; the replay already shows the register leaking |
| Code templates for the person-fit | Back to the template lines Sachin rejected on 2026-11-08 |
| Pressure scoring in Node (doc 32 as written) | Breaks "Node derives nothing"; the engine already has every input |

## 10. Who this is for: scenarios by age band and wealth tier

The research has hard numbers only for the broad splits (women 18–49 are the core in the US; AstroTalk's payers are
25–35, 60 % women, 65 % of revenue marriage questions; coaching clients are 35–54 managers and executives). The question
lists below are reasoned from that and from what the chart can date; they are the Personalizer's band table and the
test cohort's design, to be corrected by confirm answers once live.

| Band | Arrives with | Wants to know (and the area that answers) | Served today? | Gap |
|---|---|---|---|---|
| **< 25** (student, first job, dating) | "Is this normal, will it pass, who am I" | identity (Who you are); study and focus (How you think); body image and energy (Body); first job and money (Drive); when this stretch ends (Right now) | Partly: natal areas yes; no age framing; prose too dense | Personalizer band words; shorter cards; the question "studying or working?" |
| **25–35** (ladder, partner, moves, founders) | A decision: job switch, partner timing, a move, first big money | windows to start / hold (Right now, This chapter); patterns that sabotage (Stuck); risk appetite and partner-with-numbers (Drive); marriage timing → Love board | Partly: windows exist but at 2034 grain; no founder framing | Sub-period windows; Drive & ambition; the wizard's work.level drives the examples |
| **36–45** (plateau, parenting, burnout, divorce) | Fatigue, a stall, a strain | what is heavy and since when (Right now, Stuck); stamina and recovery (Body); what the chapter is teaching (This chapter); the next main period (Chapters, once) | Weakly: no "since when", no body pacing, no ladder | Inventory "since"; Body ladder; Growth edge |
| **46–60** (succession, parents, legacy, wealth) | Timing of a hand-over, a health scare, a property or legal matter | the year's windows (This year); what to consolidate vs start (Drive); endurance (Body); family → Love/Family board | No: no executive register, no consequence-led cards, no multi-person charts | Executive register (cost at work first); family board (later); written annual outlook (later) |
| **60+** (retirement, spiritual turn, health) | Rest, meaning, grandchildren | body and rest (Body); what you are really after (Drive, the former soul's aim); the day's rhythm → Lucky times | Weakly: words too dense, no large-type layout | Support layout (doc 45) by default; Chart details closed; fewer chips |

| Wealth tier | What they buy | Served today? | Gap |
|---|---|---|---|
| Mass (free, 20 questions) | A daily reason to open; one worry answered | Yes after this plan | Board builds eat the 20 (billing/02 heads-up) |
| High earners ($200 k+; Plus/Unlimited) | Decision-grade timing, a weekly brief, no upsell on the self screen, privacy | Partly | Weekly digest email; "planning or checking" horizon switch; export of the year |
| HNW ($5 M+) | Several charts (spouse, children, partners), a dated calendar for deals and moves, a written annual outlook | No | Family board; multi-kundli accounts; annual PDF (doc 36 style) from the same contracts |
| UHNW / family office / billionaires | Discretion, a named human who reviews the output, bespoke questions, event timing, succession, litigation, naming | No, and not as an app tier | A concierge service: human astrologer + this engine + the Lab; private tenancy; contract, not subscription |

Men over 35 and executives come in through "decision support for work", not "horoscope" (coaching data); the Work board
and Drive & ambition are the door, the You board keeps them.

## 11. Decisions for Sachin

1. Spend: Phase A ≈ $0.15 (two Oracle v2 + six Personalizer calls), Phase C ≈ $1.10 (cohort). Yes before each.
2. Engine work: `pressure_inventory` on the engine (recommended) versus a Node selection over `kundli_activation` and
   overlays only (no "since" for transits not yet stored, no strength grade).
3. Mood tap on the hero: ship in B (one tap, stored per day) or defer to C.
4. The seven top tabs: retire them into the areas and the chat (recommended) or keep "Looking back" as an eleventh area.
5. Board builds and the 20-question quota (billing/02 heads-up): one charge per board per day as built, or one per day
   across boards; a clock switch is one more charge either way.

## 12. Audit defects and where this plan answers them (filed in `docs/TODOS.md` 2026-11-09)

| Defect (fact unless marked) | Where | Answered by |
|---|---|---|
| No Self prompt receives gender, age, life stage or expertise; no such user-type field exists | `oracle.ts:589-606`, `schema.prisma` | §4.2 profile pack, §4.1 Personalizer |
| The reading ignores companion memory except `self.confirm.*` | `service.ts:198-203`, `oracle.ts:603-604` | §4.2 |
| The Oracle gets no present-state, tone or shade input; two surfaces can disagree (inference) | `houseLayers.ts:774-808`, `oracle.ts:1162` | §4.3 inventory, one build for hero and areas |
| The prose is asked to carry chart terms and is shown on the card face | `generated.ts:16`, `SelfReading.tsx:475-481` | §4.1 Personalizer, §4.7 |
| Internal ids, vote counts and chart terms on the first screen | `AreaBoardView.tsx:474-513` | §4.7 hero |
| `boardFocusInstruction` still asks for PANEL_SYNTHESIS while the area prompt demands JSON | `oracle.ts:772, 1162` | step 3 |
| Claim ids with the `claim:` prefix are dropped before the card | `areaDoc.ts:251-253`, `oracle.ts:1276`, `service.ts:553-559` | step 1 validator tests |
| Every transit line cites the lagna card | `oracle.ts:352` | §4.3 inventory evidence ids |
| Sky pack and area board derive astrology in Node (sign→house, over-Moon, rasi lords, karaka join, activation, scoring, sensitive passage) | §1.3 list | §4.3: the engine's `pressure_inventory` replaces all of it |
| Prompts hard-code 2025–2027 and "the Oct 2026 return" for everyone | `R15-self.md:17-18`, `oracle.ts:289` | step 3 |
| Prompts name data the packs lack (Sade Sati, D60 beyond h1, D20/D24, Patyayini, BAV, house from Moon); D10 sent and unread | `oracle.ts:200-225, 322-360` | step 3 (one vocabulary per path), §4.3 |
| Year pack labels the first period active when none covers today | `oracle.ts:~312` | step 3 |
| Three certainty vocabularies on one card | `types.ts:23, 53`, prompt | §4.7: one set of three words |
| Clock switches: no consent, no cost line, no explanation, no applicability, no audit row, changes Love and Work, free and unbounded, can wait 30 min on a failed build (inference) | §1.3 | §4.4 |
| `budget_exceeded` stored and served | `oracle.ts:980-995` | §4.1 failure rules |
| Catalog drift (`runFamilySubAgents`, `runSelfLineman`, prompt `oracle/self.md`, `SELF_PLANNED` D4/D7/D60) | `catalog.ts:455, 626-628, 1621-1650` | step 1 |
| `self.mind_shade` not in `FACT_CATALOG`, so the shade tie-break never fires for real users | `shadeResolver.ts:593-596`, `profile/facts.ts:11-20` | retired by §4.3 |
| Lineman gets the full packs (126 k tokens) | `oracle.ts:999-1001` | Phase C: findings and claims only |
| Sixteen destinations on one page; polling gives up silently; Oracle failure silent; two stamps; timings and ids under Chart details; `self.focus` asked two ways; no shared carousel | web audit §8 | §4.6, step 7 |
| Staging wording "Choose your dasha" exists in no branch (inference) | web audit §0 | deploy session: identify the build staging serves |

## 13. Handoff to Opus (development starts from this doc; Sachin, 2026-11-09: "make the plan, Opus will do the development")

The plan is final. Build it in this order, each piece on its own branch off `develop`, merged `--no-ff` with tsc and the
area's unit tests green, per AGENTS.md. Every sub-agent runs on Opus 5.5 at medium effort with fast mode, in the
background; installs and worktrees go to Haiku. The deploy session handles pushes and Lambda deploys.

| Branch | Steps (§7) | Owns | Must not touch | Done when |
|---|---|---|---|---|
| `feat/self-v2-contracts` | 1 | `src/reading/self/types.ts`, `src/reading/person/profile.ts`, their tests | prompts, web | types exported for S1–S10, `AreaBrief`, `OracleInput`, `PersonalizerInput`, `PersonalCardDoc`, `HeroDoc`, `PressureInventory`; profile pack tests green (five age bands, gender null → neutral) |
| `feat/self-v2-subtechniques` | 1b | `src/reading/self/sub/*.ts`, `src/reading/self/areas/*.ts`, catalogue and registry rows, `SELF.people` / `SELF.matters` words tables | `oracle.ts` prompts, web | S1–S10 run over one `SelfBuildContext`; eleven `AreaBrief`s; store keys with stamps; test: no area reads the DB; S5 rows carry matter, what, from, who, since, until, holds; Sachin reviews the two words tables |
| `feat/self-v2-agents` | 1c, 3, 4 | `src/reading/self/agents/*.ts`, `prompts/oracle/self-areas.md` v2, `prompts/personalizer/self.md`, `digestSlices.ts`, `subagentCachePlan.ts`, `runSelfReadingBuild` order | web, sub-techniques | prefixes warmed before any call; ledger rows written; Lab replay on the two stored dossiers × three profiles reads right (needs Sachin's yes: ≈ $0.15); lineman behind a flag |
| `feat/self-v2-hero-clock` | 5, 6 | `self.hero`, `PUT /api/self/clock`, `POST /api/self/confirm`, `POST /api/self/mood`, `clock_viewed` event, charge key | prompts | hero withheld rules; one charge per system per day; greyed clocks unselectable; event row per switch |
| web `feat/self-v2-page` | 7, 8 | `AIAstra_WEB/src/pages/you/*`, shared `Carousel` and `Chips` components | server | the mockup's §1 frame at 1180 and 1440, the Duo frame, 360 px deferred; no page scroll; no technique id or chart term on a card face (test greps); clock sheet; confirm and mood taps |
| engine `feat/pressure-inventory` | 2 | `AIAstra_Radha` export `pressure_inventory`, `dasha.applicable` completeness; server `kundli_pressure` table and pull | server reading code beyond the pull | boundaries match stored activation rows on Sachin's and one research kundli; needs Sachin's OK to touch the engine |
| `feat/self-v2-cohort` | 9, 10 | `selfDashboardQa.ts` gates, `AGENTS.md` (done), TODOs | — | 20 subjects × 5 bands ≥ 95 % on 11 gates (needs Sachin's yes: ≈ $1.10); the 2026-11-09 TODO items closed or re-filed |

Order: contracts → sub-techniques ∥ agents ∥ engine → hero-clock ∥ web → cohort. Until the engine export lands, S3
reads `kundli_activation` and the sky overlay and says "since" only for boundaries it has (§8).

Gates Sachin holds: the two model spends; the engine work; the words tables (`SELF.people`, `SELF.matters`); the
decisions in §11. Everything else is decided here.
