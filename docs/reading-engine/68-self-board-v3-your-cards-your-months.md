# 68. Self board v3: your cards, your next twelve months

Status: **Phases A and B approved by Sachin 2026-11-09, Template 2 "Seasons" the default (D1). D2 to D5 taken as
recommended (marked suggestions with one-tap add; no Chakras card; What helps in Phase D; Indian terms with a gloss on
Indian-lens faces). D6, the paid replay, still needs its own yes with key, count and cost. Coding by Opus.**
Asked by Sachin the same day, from the live Self page (five screenshots): what is the reading based on, does it really
cover the self, how should the board change, how should the Oracle and Personalizer prompts change.

Inputs: the live v2 build (doc 66, `src/reading/prompts/oracle/self-areas-v2.md`, `prompts/personalizer/self.md`,
`src/reading/self/v2types.ts`), doc 67 (dasha levels), and the research of 2026-11-09 in
`reports/Self dashboard v3 design evidence.md` with its four note files under
`research_notes/Self dashboard v3 design evidence/`.

Rules that bind every line: the calculation engine is the only source of astrological values and is never named to a
person; Node selects, joins and formats and derives nothing; specific to this person or not shown; ask before you
predict; no paid model call before Sachin's yes on key, count and cost; carousels and panels, never a stacked scroll.

## 0. Answer first

| Your question | The answer |
|---|---|
| What is today's reading based on? | Eleven fixed areas (`SELF_V2_AREAS`). The Oracle reads the chart **through the running main period of one clock** and is told "nothing beyond the running main period". Each area is tied to chart factors: Who you are = rising sign, its lord, the public image points; How you think = Moon, Mercury, 4th and 5th; Body & energy = rising sign, 6th, 8th, the D30; Drive = soul planet, 10th, Mars, Sun; and so on. The Personalizer then rewrites that in plain words. |
| Is it really going over the self? | Partly. It covers character, mind, drive, presence and body as **chart topics**. It does not cover the self as a person lives it: sleep, fitness, mental sharpness, mood, what bothers you, what restores you, play, purpose, learning. It has nothing an Indian reader would look for first: constitution, the five layers, the four aims, practice and deity, Saturn's long passage. And every card is built the same way: a headline, two paragraphs, a ladder, a list of dates at the bottom. Dates are a footnote, not the spine. |
| Why does the top strip feel useless? | It is a summary with one date and no periods. It repeats what the first card says and takes a quarter of the screen. The research agrees with you: Apple's iPad guidance says show less at first and group with space; calm-technology principles say use the smallest amount of attention. **It goes.** |
| What changes? | Four things. (1) **You choose the cards.** A catalogue of about 26, a `+` tab, eight to start. (2) **Dates lead.** Every card is built on the next twelve months cut into the engine's own periods. (3) **The question changes** from "when is the good time" to "how do you get through this stretch, and if it is easy, what do you build". (4) **Room.** Two wide cards on an iPad, not four narrow ones. |
| What do I recommend? | Build **Template 2, "Seasons"** (§4.2) as the default, keep today's layout as Template 1, ship the card picker first because it costs no model money, then the new card contract with one paid replay you approve. §9. |

## 1. Start: what is true today (checked 2026-11-09)

1. **Areas are hard-coded.** `SELF_V2_AREAS` in `src/reading/self/v2types.ts:36` lists eleven ids in three groups
   (Now: diagnosis, stuck, chapter. You: lagna, mind, body, drive, presence, yogas. Time: chapters, year). The Oracle's
   JSON schema and the Personalizer's schema are built from that list.
2. **The Oracle's scope rule** (`prompts/oracle/self-areas-v2.md`): "read the person through the running main period
   of the reading clock ... Nothing beyond the running main period except its end date and the next lord's name."
   Other clocks "confirm where they agree". Per area it returns headline, 2 to 4 paragraphs, `dates`, 1 to 5 actions,
   certainty, evidence.
3. **The Personalizer** (`prompts/personalizer/self.md`) never sees the chart. It rewrites the Oracle's document for
   the person (age band, stated gender, facts, mood) with a long list of banned words, and builds a four-step ladder
   (Best, Practical, Drift, Floor).
4. **What the screen shows** (your screenshots): a top strip (tone word, one sentence, a six-months-either-side bar,
   one confirm question, "what to do this month"), then eleven cards, four across. On each card the dates sit at the
   bottom as a list. At 969 px wide a card is about 190 px and every line wraps after three or four words.
   "Chart details" for Who you are prints empty brackets `()` where chart names were stripped: a defect, filed in
   `docs/TODOS.md`.
5. **Clocks.** The person's reading clock is one system (yours shows Dwisaptati Sama). Vimshottari, Narayana, the
   Tithi Pravesha year and the conditional systems are stored for every kundli to three levels (doc 67), but the
   engine does not yet export **which conditional systems apply to this person and why** in a form the board can show.
6. **Cost today.** One v2 build is one Oracle call plus one Personalizer call for eleven areas: about $0.055 and
   60 to 70 s cold in the doc 66 replay.
7. **Nothing stores a layout.** There is no per-person record of which cards are shown, in what order.

## 2. What the research says, and how each finding shapes the design

The full report is `reports/Self dashboard v3 design evidence.md`. The findings that decide something:

| Finding | Source | What it decides |
|---|---|---|
| People use astrology to get through uncertain stretches and to reflect, not to predict. 28% of US adults consult it yearly, 1% rely on it "a lot" for big decisions. | Pew, May 2025, n = 9,593 | The board's question is "how do you get through, what do you build". Not a hunt for lucky dates. |
| CHANI moved in 2026 from quarterly summaries to month-by-month readings, one per life area. Whoop and Oura review by month and half-year. | Product releases | Period-led cards by life area have category precedent. Nobody in Vedic astrology does it. |
| No astrology app says "this eases on <date>" on screen. | Doc 66 research | Still open ground. We already have the dates. |
| People act on goals after a landmark (new month, birthday). | Dai, Milkman, Riis 2014 | Each engine boundary is a landmark. A card opens a new period with "from 5 Dec". |
| If-then plans work, modestly (d ≈ 0.27 across 642 tests, 2024). Wish-obstacle-plan about 0.34. Growth-mindset slogans do little. | Meta-analyses | One aim, the likely obstacle, one if-then step per period. Not five actions and not pep talk. |
| No evidence that 3, 6 or 12 months are special horizons. | Research gap | We do not cut the year into equal thirds. We show the engine's real periods and group them under "now", "next" and "later this year". |
| Most users never customise; over 95% keep defaults in the best-known study. An unfinished build-it-yourself step loses its value. | NN/g 2016; Spool 2011; Norton et al. 2012 | The picker must take one tap to finish. See §4.1 and decision D2. |
| Apple Health, Apple Fitness, Whoop, Oura and Garmin all use: Edit, toggle, drag to reorder, Done, with a reset. Whoop and Fitbit were punished when they removed it. | Product docs | Copy that interaction exactly. Do not invent one. |
| Margins and 50 to 75 characters per line read faster and are preferred. | Chaparro 2004; Baymard; WCAG | Wide cards with a text column capped at about 65 characters, and a second column for the period rail. |
| Carousels work when the user drives them, the next card peeks, position is shown, and labelled chips jump to a card. Eight is the upper end. | NN/g, Baymard 2025 | Eight cards on the board, chips with names, arrows, "3 of 8". More cards live behind `+`. |
| Western models agree on 8 to 12 domains. Missing from our list: **purpose and meaning** (the largest gap). "Play" is the weakest. | WHO, Ryff, PERMA, SAMHSA | Add a Purpose card. Keep Play as optional, not in the starting eight. |
| What people most want help with: exercise, being happier, health, sleep, stress. | YouGov Dec 2025; McKinsey | Body, Sleep, Mood and Energy are the cards people will pick. Personality cards are curiosity. |
| Others judge your visible traits better than you do; you judge your inner states best. | Vazire 2010 | "How you come across" earns its place: it tells you what you cannot see yourself. |
| Vague flattering lines get accepted by anyone (Barnum effect). | Forer and after | Each card carries one statement the person can say No to, and one knot, not only gifts. |
| The Parashara text assigns blood to the Moon (bone Sun, marrow Mars, skin Mercury, fat Jupiter, sinew Saturn). | BPHS 3.31 | A Blood & vitality card can stand on a classical verse. |
| No classical text links planets to chakras. Modern versions contradict each other. | Research | A chakra card can only be labelled a modern association. Decision D3. |
| Conditional dashas are used beside Vimshottari, and their conditions are "necessary, not sufficient". Tithi Pravesha is read like a birth chart for one year. | P.V.R. Narasimha Rao (snippet only), Rath | Verification means several clocks agreeing. Applicability must come from the engine. |
| A wellness product may not claim to diagnose or treat. Mood data is health data. India bars advertising "magic" remedies for listed diseases. | FDA Jan 2026; FTC 2023-24; Drugs and Magic Remedies Act 1954 | Body, sleep and mood cards speak of pace, rest and habit. Remedies are practices, never cures, never sold. Mood card carries a help line. |

Weak or unverified, stated plainly: the number eight is not tested anywhere (Pinterest asks for about five); the
planet-to-dosha mapping was found only in secondary sources and needs a check against the Santhanam translation before
a Constitution card ships; the Indian market-size figures contradict each other; nothing compares paced AI guidance
with a single astrologer sitting, so that argument is reasoning, not data.

## 3. End goal

A person opens Self and sees **their own eight cards**, two across on an iPad, each as wide as a page of a book.
Nothing sits above them but the title row and the chips.

Each card answers one part of the self over the **next twelve months**, cut into the periods the chart actually has.
For each period it says, in plain words: what this stretch asks of you, what is likely to get in the way, and one
thing to do. A heavy period is written as **Get through**. A light period is written as **Build**: a skill, a habit,
the gym, sleep, a practice. The card says which clocks agree, one tap down.

A `+` tab at the end of the chips opens the catalogue. Every card in it is already read for this person, so it shows
its real first line before they add it. They add, remove, reorder, and switch sections inside a card on or off. An
Indian reader finds Constitution, the Five layers, the Four aims, Practice and deity, Saturn's passage. A Western
reader finds Sleep, Fitness, Mood, Sharpness, Purpose.

The assistant is there every day, so no card tries to say everything. It says what matters in this period and stops.

What can no longer happen: a card with dates only at the bottom; a top strip repeating the first card; four cards
squeezed onto a tablet; a card the person did not ask for; a prediction with no end date; a "good time" with no plan.

## 4. How it works when done

### 4.1 First visit: the picker

1. The board is empty of cards. The page says: "Choose what you want to see about yourself. Eight to start. You can
   change them any time."
2. Below are the catalogue cards in four groups (§4.3), each a tile with its name, a one-line description, and
   **its real first line for this person** once the read is ready ("Rest is short until 5 Dec").
3. Eight tiles carry a small "Suggested for you" mark, chosen from what presses most in the chart now and the focus
   the person gave at registration. **They are not ticked** (your rule: the user adds the cards, we do not).
   One button, "Add the suggested eight", ticks them in one tap. Research says most people will press it, and an
   unfinished picker is worse than none. Decision D2 asks whether you accept this.
4. "Done" needs at least three cards (Oura's floor). There is no upper limit; the carousel handles any number, and
   past eight the page says "Eight is comfortable. More is fine."
5. Later: the `+` chip reopens the catalogue. "Edit" beside the chips enters edit mode: drag a chip to reorder, tap ×
   to remove, "Reset to suggested". The same steps as Apple Health and Garmin.

### 4.2 Templates

A template is a **layout plus a starting set of sections**, not a different reading. The person switches it from
Edit. The same card data fills every template.

| # | Name | iPad landscape | What a card looks like | For whom |
|---|---|---|---|---|
| 1 | **Compact** (today's) | 4 cards across | Headline, paragraphs, ladder, date list at the bottom. The top strip is removed here too. | People who liked v2 and want density. Kept so nothing is lost. |
| 2 | **Seasons** (recommended default) | 2 cards across, next one peeking | Left column, about 65 characters wide: the headline and the selected period's text. Right column: the **period rail**, the year as three to six stacked bars with dates and a tone dot; tap a bar and the left column changes. Below: one confirm question. | Everyone. The tablet target. |
| 3 | **One at a time** | 1 card fills the screen | Period rail down the left edge as large date tabs; the selected period's sections as panels (asks, obstacle, do, why). The chips become a left list. | Duo right pane, phone, and people who read one thing slowly. |
| 4 | **Year table** | 1 wide grid | Rows are the person's cards, columns are the year's periods, each cell a tone dot and five words; tap a cell to open that card at that period. | People planning a year. Built last. It is the true "summary", with dates, that the strip never was. |

Wireframe of one card in Template 2:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ SLEEP & REST                                          Edit sections   ⋯   │
│                                                                           │
│ Rest stays thin until 5 December,          YOUR YEAR                      │
│ then it comes back.                        ● now → 5 Dec 2026   Heavy     │
│                                            ○ 5 Dec → 1 Jan 2027 Easing    │
│ GET THROUGH · now to 5 Dec 2026            ○ 1 Jan → 3 Jun 2027 Steady    │
│ This stretch asks you to guard your        ○ 3 Jun → 4 Oct 2027 Open      │
│ evenings. The likely trap is working                                      │
│ late to catch up.                          Since 18 May 2025, have you    │
│                                            been sleeping worse?           │
│ If it is past ten and you are still        [Yes] [Partly] [No]            │
│ working, stop and write tomorrow's                                        │
│ first task instead.                        Checked on 3 of 4 clocks ›     │
└───────────────────────────────────────────────────────────────────────────┘
```

Card width on an 1180 px iPad: about 540 px each with 24 px gutters. Text column 300 px at 16 px type gives about 55
to 65 characters. Nothing inside a card scrolls in Template 2 for the default sections.

### 4.3 The card catalogue (26)

Marked ◆ = exists today (v2 area). Each new card names what the Oracle reads; every value is a stored engine row.
"Engine" in the last column means the engine must export something new first (§6).

**Body**

| Card | It answers | Read from | Ready? |
|---|---|---|---|
| Body & energy ◆ | What wears the body this year and what steadies it | Rising sign and lord, 6th, 8th, D30, live windows | Yes |
| Fitness & strength | When to push, when to hold, what kind of effort suits you | Mars, the Sun, 3rd and 6th, strength rows, the period lord's relation to them | Yes |
| Sleep & rest | When rest is thin and when it returns | 12th and its lord, the Moon, period and transit windows on them | Yes |
| Blood & vitality | Stamina and recovery through the year | The Moon (blood, BPHS 3.31), the Sun, the rising lord's strength | Yes |
| Constitution (Prakriti) | Your make-up in the Indian sense: airy, fiery or earthy, and what unsettles it this year | Planet-to-dosha weights of the rising sign, its lord and the Moon | **Engine** + text check |

**Mind**

| Card | It answers | Read from | Ready? |
|---|---|---|---|
| How you think ◆ | How you reason, judge and worry | Moon, Mercury, 4th, 5th | Yes |
| Sharpness & focus | When your mind is quick and when it is foggy | Mercury, 5th, Jupiter, period windows on them | Yes |
| Mood & inner weather | The emotional tone of each period | The Moon, its star lord, the 4th, Saturn's passage over the Moon | Yes (Saturn passage spans: **Engine** to the Oracle) |
| What bothers you | What gets under your skin, from whom, until when | 6th, 8th, 12th, the risk ledger | Yes (today's "Where you get stuck" ◆, renamed) |
| What restores you | What brings you peace and where to find it | 4th, 12th, Moon, Venus, Jupiter, the promise ledger's graces | Yes |
| Play & joy | What entertains you and when there is room for it | 5th, 3rd, Venus, Mercury | Yes |

**Character**

| Card | It answers | Read from | Ready? |
|---|---|---|---|
| In short ◆ | The one thing to know now | Central tension of chart and period | Yes |
| Who you are ◆ | Your nature | Rising sign, lord, image points | Yes |
| Drive & ambition ◆ | What pushes you and what it is for | Soul planet, 10th, Mars, Sun | Yes |
| How you come across ◆ | How others read you | Image point against the Moon and 4th | Yes |
| Gifts & knots ◆ | What you were given and what tangles | Promise ledger | Yes |
| Purpose & meaning | What this life is for, and what this year asks of it | 9th, soul planet's D9 sign, Jupiter, the 12th | Yes |
| Learning & skill | What to learn this year and when it sticks | Mercury, Jupiter, 3rd, 4th, 5th, 9th, the period lord | Yes |

**Indian lens**

| Card | It answers | Read from | Ready? |
|---|---|---|---|
| The five layers | Body, breath, mind, judgment, joy: which layer needs care now | A grouping of the cards above into the five sheaths; no new chart values | Yes |
| The four aims | Duty, means, desire, release: which one this period serves | Houses grouped 1-5-9, 2-6-10, 3-7-11, 4-8-12 as activated by the running periods | **Engine** (the grouping must be the engine's, not Node's) |
| Practice & deity | The practice that suits you and the deity of the chart | 12th from the soul planet's D9 sign, 5th and 9th | **Engine** (must state its tie-break rule) |
| Saturn's long passage | Where you are in the seven-and-a-half years, by date | Sade Sati and dhaiya spans | **Engine** to the Oracle (stored, not yet sent) |
| What helps (practices) | Fasting days, giving, mantra: practices tied to the planet that presses | The pressing planet and its classical practices | **Engine** (a lookup table is astrology; Node may not hold it) |

**Time**

| Card | It answers | Read from | Ready? |
|---|---|---|---|
| This chapter ◆ | The sub-period you are in | Running sub-period | Yes |
| Chapters ◆ | The long arc | Main periods | Yes |
| This year ◆ | The birthday-to-birthday year | Tithi Pravesha year | Yes |

Not offered: a **Chakras** card, unless you say yes at D3. If yes, it carries the line "a modern association, not
from the classical texts".

### 4.4 Sections inside a card

Every card has the same seven possible sections. Four are on by default. "Edit sections" on the card toggles them.

| Section | Default | What it is |
|---|---|---|
| In a line | on, fixed | The headline. One sentence with a date. |
| Your year | on, fixed | The period rail. Three to six engine periods across twelve months, each with a tone. |
| This stretch | on | For the selected period: what it asks, the likely obstacle, one if-then step. Titled Get through or Build. |
| Is this right? | on | One question the person can answer No to. The answer is stored in companion memory (doc 48). |
| Your pattern | off | A behaviour that repeats, with since and until. |
| The ladder | off | Best, Practical, Drift, Floor (today's four steps). |
| Chart details | off, one tap | The Oracle's own text with chart terms, and which clocks agree. |

"In a line" and "Your year" cannot be removed: a card without dates is not a card on this board.

### 4.5 Backend

1. **Card registry.** `SELF_V2_AREAS` becomes `SELF_CARDS` in `src/reading/self/v3/cards.ts`: id, group, title,
   one-line description, the Oracle brief for the card, the claims it may stand on, default sections, a `sensitive`
   flag (body, sleep, mood), and `needs` (engine rows that must exist; a card whose rows are missing is not offered).
2. **Year frame.** A new slice, built once per build from stored rows only: every period boundary of the reading
   clock between today and today + 12 months at levels 2 and 3, the Tithi Pravesha year boundary, the pressure and
   support windows (doc 66 §4.3), and Saturn's passage spans. It is cut into three to six **spans**; a span never has
   a date Node invented, each edge is a stored boundary. Each span carries, per clock, the engine's tone for it.
3. **Agreement.** For each span the frame lists which clocks call it heavy, mixed or light: the reading clock,
   Vimshottari, Narayana, the Tithi Pravesha year clock, and any conditional system the engine marks as applying to
   this person. The Oracle reads agreement; Node only counts identical labels.
4. **Oracle, three calls in parallel** (Body + Mind; Character + Indian lens; Time), each over the same cached natal
   prefix. Each returns, per card: `headline`, and for **each span** `tone`, `mode` (`get_through` or `build`),
   `asks`, `obstacle`, `evidence`, `agreement`; plus one `confirm` (a dated statement about the past the person can
   deny), optional `pattern`, and `details`.
5. **Validator.** As today (evidence keys exist, spans copied exactly, redaction), plus: every card has at least two
   spans; no span text without evidence; `mode` matches the frame's tone (a heavy span cannot be `build`).
6. **Personalizer, one call per Oracle call.** Writes the face of each card: the line, and per span the three short
   texts and the if-then step, fitted to the person's facts. In `build` spans it picks what to build from what the
   person told us (their work, their focus, their body goals) and the card's subject.
7. **All cards are read, the person's cards first.** The build writes the person's chosen cards first and marks the
   board ready; the rest of the catalogue follows in the same background build so the picker shows real first lines.
8. **Layout store.** New table `self_board_layout` (kundli id, template, ordered card ids, hidden sections per card,
   updated at). No astrological content. Changing the layout never triggers a model call.
9. **Validity.** A card is re-read when the first span ends, as today's `validUntil` does.

### 4.6 API

| Route | What it does |
|---|---|
| `GET /api/self/v3` | The layout, the person's cards in order, build state per card. |
| `GET /api/self/v3/catalogue` | Every card: name, description, group, suggested flag, first line if read, `unavailable` with a reason if the chart lacks what it needs. |
| `PUT /api/self/v3/layout` | Template, card order, hidden sections. Validated against the registry. |
| `POST /api/self/v3/confirm` | The answer to a card's question. Stored as a fact; lowers or raises certainty at the next build. |

`GET /api/self/v2` keeps working until v3 is the default.

### 4.7 Frontend and what the person experiences

1. Title row only: photo, **Self**, the clock line, the fresh-reading stamp, Edit, the template switch. The strip is
   gone.
2. Chips: the person's cards by name, then `+`. Tapping a chip slides to that card. Arrows and "3 of 8" at the right.
3. Two cards across (Template 2), the third peeking by 40 px so the carousel is obvious.
4. Tapping a period on the rail changes the left column with a cross-fade. The current period is selected on open.
5. A heavy period is drawn in the warm tone, a light one in the cool tone; the word (Heavy, Easing, Steady, Open) is
   always written, never colour alone.
6. Answering "Is this right?" replaces the question with "Noted. This sharpens your next reading."
7. Body, sleep and mood cards carry the line "From your chart. Not medical advice." The mood card adds a help-line
   link chosen by the person's country.
8. While a card is being read it shows its name, its description and the loading overlay (doc: loading overlay).

### 4.8 The words: what changes in the two prompts

**Oracle (`prompts/oracle/self-cards-v3.md`, replaces `self-areas-v2.md`)**

| Today | v3 |
|---|---|
| "Nothing beyond the running main period." | "Read the twelve months from TODAY, inside the running main period, span by span as the YEAR FRAME gives them. The main period is the ground; each span is what it does next." |
| Dates are a list at the end of an area. | Each span is an object. Every sentence belongs to a span or is marked lifelong. |
| Other clocks "confirm where they agree". | "For each span state which clocks agree and which do not, from the AGREEMENT rows. Where the reading clock stands alone, say so and lower the certainty." |
| Counsel as 1 to 5 actions. | Per span: what it asks, the likely obstacle. No action list; the Personalizer writes one step. |
| No rule about good times. | "Never tell the person to wait for a good time. A light span is time to build. A heavy span is time to hold. Name which, and why." |
| No falsifiable claim asked for. | "For each card write one `confirm`: a statement about a **past** span, with its dates, that this person can answer No to. Not a trait. An event or a felt change." |
| Gifts lead. | "Each card names one knot as well as one gift. A card that only flatters is rejected." |
| Eleven fixed area briefs. | One brief per card from the registry, only for the cards this call names. |
| Health "never a diagnosis". | Kept, and widened: body, sleep, mood and blood cards speak of pace, rest, heat, heaviness, stamina. No condition, no organ disease, no medicine. |

**Personalizer (`prompts/personalizer/self-v3.md`)**

| Today | v3 |
|---|---|
| Writes a headline, body paragraphs, a four-step ladder. | Writes a line, and per span three short texts: **asks** (at most 30 words), **obstacle** (at most 20), **step** (one if-then sentence). |
| Fills the card. | "Leave room. The person can come back tomorrow. Say the one thing that matters in this span and stop." |
| One register. | In a `build` span: "Choose what to build from THE PERSON: their work, their stated focus, their body goals. Name it concretely: a skill, a routine, a number of mornings a week." |
| All chart and Indian terms banned on the face. | Still banned on Western cards. On Indian-lens cards the registry lists allowed words (for example the three constitution names, the four aims), used with a plain gloss the first time. Decision D5. |
| Ladder always. | Ladder only when the person switched that section on. |

### 4.9 Budget (estimates; nothing is spent until you say yes)

| Item | Estimate | Basis |
|---|---|---|
| One full v3 build, 26 cards, 3 Oracle + 3 Personalizer calls | $0.12 to $0.18, 40 to 60 s to first eight cards | Doc 66 replay: 11 areas for $0.055; span objects are shorter than paragraphs; cached natal prefix |
| Replay to prove the contract (one test kundli, two runs) | under $0.50 | Two builds plus a repair pass |
| Layout changes | $0 | No model call |

## 5. Architecture

```
stored engine rows ──► year frame (spans, tones, agreement) ─┐
                                                             ├─► Oracle ×3 ─► validator ─► Personalizer ×3 ─► card store
card registry (26 cards, briefs, needs) ─────────────────────┘                                              │
person facts, confirms, mood ───────────────────────────────────────────────► Personalizer                  │
self_board_layout (template, order, hidden sections) ──► GET /api/self/v3 ◄──────────────────────────────────┘
                                                              │
                                              web: chips · + · carousel · template
```

The reading and the layout are separate. The reading is the same for every template; the layout never costs money.

## 6. Ingredients

| Ingredient | State |
|---|---|
| Stored periods to level 3 on every system; pressure and support windows; promise and risk ledgers | Have |
| Tithi Pravesha year and its clock | Have |
| Which conditional systems apply to this person, with the reason | **Engine pass E1** |
| Saturn's passage spans in the Oracle input | Stored; add to the year frame |
| Constitution weights, the four-aims grouping, practice and deity with tie-break, practices table | **Engine pass E2** |
| Card registry, year frame, two prompts, validator rules | New, server |
| `self_board_layout` table and three routes | New, server; one additive migration |
| Picker, edit mode, Templates 2 and 3, period rail | New, web |
| A text check of planet-to-dosha against the Santhanam translation | Before the Constitution card ships |
| A help-line list by country for the mood card | New, small |

## 7. Action steps in sequence

1. Sachin answers D1 to D6 (§10).
2. A clickable mockup of the picker and Templates 2 and 3 on iPad size, with real text from your own test kundli's
   stored v2 cards. No model call.
3. Web and server: `self_board_layout`, the registry with the eleven existing cards, the picker, edit mode, the strip
   removed, Template 2 filled from v2 data (dates lifted from each card's existing `dates`). No model call.
4. Server: the year frame slice and the agreement rows, with unit tests on stored fixtures.
5. Write the two v3 prompts and the validator rules. Dry run with a fake client.
6. **Paid replay, on your yes**: one test kundli, two builds, results and cost written to
   `docs/reading-engine/replays/`.
7. Add the eleven new cards that need no engine work (Fitness, Sleep, Blood, Sharpness, Mood, What restores you,
   Play, Purpose, Learning, Five layers; What bothers you is a rename).
8. Engine pass E1 (applicability) then E2 (Indian-lens values), each verified with the research harness before a card
   uses it.
9. Indian-lens cards switch on as their rows arrive.
10. Templates 3 and 4. Then Love and Work adopt the same registry and layout.

## 8. Phases

| Phase | What ships | Model cost | Engine work |
|---|---|---|---|
| A. Your cards | Picker, `+`, edit, strip gone, wide cards, Template 1 and 2 on the eleven cards | none | none |
| B. Your months | Year frame, v3 prompts, span-led cards, Get through and Build, confirm question | replay under $0.50, then about $0.15 a build | none |
| C. The whole self | Eleven new Western and layer cards | within B's build | none |
| D. Indian lens | Constitution, Four aims, Practice & deity, Saturn's passage, What helps; clock applicability | small | E1, E2 |
| E. More views | Templates 3 and 4; Love and Work on the same system | none | none |

Each phase leaves a board that works. A can ship this week and already answers your first two points.

## 9. One recommendation

Approve **Phase A and B together, with Template 2 as the default**.

Why this and not something smaller: the strip, the cramped cards and the fixed list are layout problems, and Phase A
removes all three without spending a cent on models. But a wide card with the old content is only a roomier version
of what bored you. The upgrade a person feels is Phase B: the year laid out in their own periods, each one telling
them how to get through it or what to build. That is the part no astrologer's single sitting and no other app gives,
and we are the only ones holding the dates to do it.

Why you can believe it will land:

1. **It is what people actually use astrology for.** Pew's 2025 survey: one in a hundred users leans on it for big
   decisions; the rest want to make sense of a stretch of life. We stop selling prediction and start selling
   passage.
2. **The leader in the West just moved this way.** CHANI went to month-by-month, by life area, in 2026. Nobody has
   done it for Vedic charts, where the dated periods are far richer.
3. **Choice makes it theirs, and a one-tap start keeps it from failing.** Every health product people pay for
   (Apple Health, Whoop, Oura, Garmin) lets them compose the screen. The two that took it away were attacked for it.
4. **It reads like a premium product.** Two cards, a book's line length, one thing said per period. The research on
   margins and line length is old and solid.
5. **It is honest.** Every card can be told "No, that did not happen", and the board says how many clocks agree.
   That is the opposite of the vague flattery the category is mocked for.

Who it is for, in order: (1) Indian professionals of 28 to 45 in a hard stretch who want to know how long and what
to do, in India and (2) in the US and UK diaspora, who already bring a fifth of the largest Indian app's revenue;
(3) wellness-minded Western readers, mostly women 18 to 49, new to Vedic astrology, who want calm and reflection.
Not chased now: people who mainly want remedies sold to them.

## 10. Decisions for Sachin

| # | Decision | My recommendation |
|---|---|---|
| D1 | Approve Phases A and B, Template 2 default? | Yes |
| D2 | Picker: eight marked "Suggested for you" plus an "Add the suggested eight" button, or a fully blank picker? | Marked suggestions with the button. Nothing is added until the person taps. |
| D3 | A Chakras card, labelled as a modern association? | No for now. It has no classical basis and the popular versions disagree. |
| D4 | "What helps" (fasting days, giving, mantra): offer it, with no sales and no promise of results? | Yes in Phase D, practices only. |
| D5 | Allow a short list of Indian terms on Indian-lens card faces, with a gloss? | Yes. Those cards make no sense without them. |
| D6 | Paid replay for Phase B: one test kundli, two builds, under $0.50, on the live paid key? | Yes, when Phase A is in. I will state key, count and cost again before the call. |
