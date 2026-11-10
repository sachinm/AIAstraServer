# 70. Five clocks, one agreed ledger, a reading per card

Status: **plan, waiting for Sachin's review. Phase 1 step 1 (the v3 step pulls every clock of the set) is in code on
`feat/self-v3`, untested against the engine. No paid call is made by this plan until the test in §8 gets its own yes.**
Asked by Sachin 2026-11-09: every card on offer must build; every time span inside a card must be read; at least five
dasha systems, always with the Tithi Pravesha year, compared against each other before anything is predicted; each
card read as if it were the only reading; the Oracle told which cards the person chose; the reading starts only after
the person has chosen their cards; shared work done once; everything cached; data cut into stored slices when it is
pulled from the engine; the visible cards fast, the rest lazy. Self first, then Love and Work.

Builds on doc 68 (Self v3, Phases A and B built on `feat/self-v3`), doc 69 (Love and Work cards), doc 67 (dasha
levels). It replaces doc 68 §4.5 items 3, 4, 6, 7 and §4.9, and doc 69 §4.1 "one call per board".

Rules that bind every line: the calculation engine is the only source of astrological values and is never named to a
person; Node selects, joins, counts and formats and derives nothing; specific to this person or not shown; ask before
you predict; no paid model call before Sachin's yes on key, count and cost.

## 0. Answer first

| Your question | The answer |
|---|---|
| Why is only one system read? | A gap in the build, not a design choice. The server pulls the engine's dated pressure rows for the reading clock only (`src/reading/self/sub/index.ts:151`). The year frame then looks for the other clocks' rows in the database, never pulls them (`v3/yearFrame.ts:243`), and finds none. In the replay, "agreement" was the reading clock and the year chart, nothing else. |
| What changes? | Five clocks are pulled and read for every person: **Vimshottari, Narayana, the Tithi Pravesha year**, the conditional clock that applies to the birth (yours: Dwisaptati Sama), and Yogini; Chara when no conditional clock applies. Each clock is read by its own agent that cannot see the others. Their findings are joined into one **agreed ledger**. A dated prediction reaches a card only when at least three clocks say the same thing. |
| One call per card, or all visible cards in one call? | **One call per card, all visible cards at the same time.** The replay showed the time is set by how much one call has to write: four cards per call took 21 to 34 s. One card per call writes a quarter of that, the shared data is read from cache at a tenth of the price, each card arrives on its own, and a failed card is re-asked alone. |
| When does money get spent? | Engine pulls and data slices are free and happen at sync. The paid reading starts when the person saves a board of at least five cards. The clocks and the ledger are read once per person and reused by every card on Self, Love and Work. |
| What about the 30 or so cards not on the board? | They are read after the visible ones, two at a time, in the background. A card the person adds jumps the queue. |

## 1. Start: what is true today (checked 2026-11-09)

1. **One clock has dated rows.** Staging holds exactly one ready `pressure_inventory` row (`system=dwisatpathi`,
   21 KB) and one failed row (`system=kaala`). Four kundlis; the database is 544 MB.
2. **The engine can already do every clock.** `pressure_inventory` takes one `system` per call and supports every
   served dasha except Saptharishi (`AIAstra_Radha` `pressure_inventory_export.py:145-156`), sign dashas included
   (a sign period is read through its sign lord, `:27-33`). The staging engine has it (calc version 2). Each call also
   recomputes the rows that do not depend on the clock (transits, Saturn's passage, stations, returns, the year
   rows), so five calls repeat that work five times.
3. **Tithi Pravesha** rows (`annual:TP<year>` and the year's sub-periods) come inside every inventory, whatever the
   clock.
4. **Nothing compares two clocks.** The engine has no agreement function. The server counts identical tone words in
   the year frame; no agent reads a second clock.
5. **No weighting exists.** The engine lists systems alphabetically. The server has two ordered lists in
   `src/config/env.ts:834-835` (conditional systems; confirming clocks).
6. **One prompt for all cards.** `prompts/oracle/self-cards-v3.md` (55 lines) holds every card's brief in one block.
   Three Oracle calls carry four cards each. The Oracle is not told which cards the person chose.
7. **The reading does not wait for the choice.** `PUT /api/self/v3/layout` only stores the layout. The build is
   started by the first `GET`, runs v2 in full, then v3 on top; both are paid (`docs/TODOS.md`).
8. **Slices are rebuilt on every build.** `buildOracleSlice` renders about 75k characters (34.6k tokens) from raw
   rows each time; preparation took 10 s in the replay. The rendered text is stored nowhere. The provider cache
   (30 min, keyed by model, system prompt and prefix) worked: 34.7k of 36k tokens were cached per call.
9. **Cards.** Self has 26 in the registry, 11 offered, 10 more need only a brief (doc 68 Phase C), 5 need engine
   exports. Love has 10 and Work has 9 (doc 69). That is 45 cards; 40 can be built without new engine work.
10. **The year rows need a check.** `docs/TODOS.md` holds an open P0: the stored Tithi Pravesha year dasha rows span
    108 years, not one. The engine's newer code bounds the tree to the year, but this is not verified on staging.
    Step 2 checks the year rows before they count as a clock.
11. **Time spans.** Every card answers every span of the year frame (3 to 6 spans over twelve months). In replay
    build 1 only 4 of 11 cards stood; build 2, 9 of 11. Two fixes followed and have not been run live.

## 2. End goal

- The person picks five to eight cards and taps Save. The first card is readable in about 40 s, all of them in about
  a minute, each appearing as it finishes. The tabs say what is happening.
- Every card says how many clocks agree, and its "Chart details" name them. No dated prediction stands on one clock.
- Every card on offer is read for every span within a few minutes, without the person waiting for it. Adding a card
  later takes about 15 s if it is not read yet, and nothing if it is.
- Love and Work reuse the same clocks and ledger and pay only for their own cards.
- What can no longer go wrong: a single-clock prediction; a card with an unread span; a failed card taking three
  others with it; paying for a reading of cards nobody chose before anyone chose.

## 3. Deliverable

| Thing | What ships |
|---|---|
| Clock set | `READING_CLOCK_ORDER`, `READING_CLOCKS_MIN=3`, `READING_CLOCKS=5`; `resolveReadingClocks()` beside `resolveClockV2` |
| Pulls | `ensurePressureInventories()` in the sync worker and on first open: the clock set's inventories, in parallel |
| Slices | Table `kundli_slices` (migration m48); `src/reading/slices/` writers; written when rows are pulled |
| Agents | `reading.clock` (one per clock), `reading.concordance`, `self.card.oracle`, `self.card.personalizer`; registry and catalogue rows |
| Prompts | `prompts/common/reader-system.md` (the one cached system prompt), `prompts/clock/reader.md`, `prompts/concordance.md`, one brief per card under `prompts/cards/self/<id>.md`, later `cards/love/`, `cards/work/` |
| Stores | `technique_outputs` rows per clock sheet, per ledger, per card |
| API | Layout save queues the reading; per-card state on `GET /api/self/v3`; `POST /api/self/v3/cards/:id/read` |
| Web | Per-card building state, agreement line, clocks in Chart details |
| Tests | Unit tests per stage; `scripts/cards-replay.ts` (storage-dry, spend cap, seeded random board) |
| Docs | This doc; technique manual pages; `docs/TODOS.md` |

## 4. How it works when done

### 4.1 Backend

**Layer 0. Pull (engine, free, no person waiting).** When a kundli syncs, and again on first open if anything is
missing, the worker resolves the clock set and pulls one `pressure_inventory` per clock in parallel: `years_back 3`,
`years_ahead 3`, `levels 3`, 15 s limit each, refreshed after 7 days, a failure retried after 24 h. Storage is about
21 KB a row, so four more rows per kundli is about 85 KB. A reading needs at least three clocks stored; with fewer
it waits for the next pull and the board says so.

The clock set, in order, first five that exist:

1. Vimshottari (always)
2. Narayana (always)
3. The Tithi Pravesha year (always; its rows ride in every inventory)
4. The conditional clock the engine says applies to this birth, when one does
5. Yogini
6. Chara

The spine clock, whose period edges cut the twelve months into spans, stays the one `resolveClockV2` picks today.
It decides where spans begin and end. It no longer decides what a span means.

**Layer 1. Slices (code, free).** Right after a pull, the slicer renders the rows into fixed text blocks and stores
them in `kundli_slices` (kundli id, slice id, text, evidence keys, token estimate, source calc versions, hash,
built at). The build reads slices; it never renders raw rows.

| Slice | Holds | Read by |
|---|---|---|
| `natal.core` | The birth chart and divisional charts pack, the promise ledger | everyone (cached prefix) |
| `sky.window` | Transits, Saturn's passage, stations, returns: the clock-independent rows, stored once | everyone (cached prefix) |
| `year.tp` | The Tithi Pravesha year chart, year lord, year sub-periods and their rows | everyone (cached prefix); the year reader |
| `frame` | The spans, their edges, each clock's rows per span | everyone (cached prefix) |
| `clock.<system>` ×4 | That clock's periods to level 3 from a year back to 18 months ahead, and its dated rows by house | that clock's reader only |
| `matter.<key>` ×12 | Per house matter (the engine's own twelve keys): the natal facts of that house and every clock's dated rows that touch it | the cards that name that matter |

Node chooses rows by the engine's own `houses_touched` and `matters` fields. Which matters a card reads is a list in
the card registry, as its "read from" line is today.

**Layer 2. Clock readers (model, five at once, once per person per frame).** One call per clock. Each gets the
cached prefix plus only its own clock slice, so it cannot lean on another clock's answer. It returns a sheet: for
each span, for each matter its rows touch, a tone (heavy, mixed, light), one sentence of what the period does there,
strength 1 to 3, and the evidence keys. The validator drops any cell whose keys are not in that reader's slice or
whose tone contradicts the engine's polarity for the cited rows.

**Layer 3. Concordance (code count, then one model call, once per person per frame).** Node joins the five sheets
by span and matter and counts identical tones. The count sets the status and no agent can raise it:

| Status | Rule | What a card may do with it |
|---|---|---|
| confirmed | 3 or more clocks give the same tone | State it with dates |
| leaning | exactly 2 agree, none opposes | Say "may"; make it the card's "Is this right?" question |
| single | 1 clock | Not stated. It can only be asked about |
| contested | heavy against light | Not stated as a prediction. The card says the signals are split |

Node also writes the pair table: for each two clocks, on how many cells they agree. This is the bracket you
described, done for every pair at once, with no model cost. The concordance agent then writes the **agreed ledger**:
one settled sentence per confirmed or leaning cell, and for contested cells which clocks stand on each side and what
each rests on. The ledger is stored once and is the common section every card stands on, for Self, Love and Work.

**Layer 4. One Oracle call per card (model, all visible cards at once).** Every card call has the same cached
prefix. Its uncached part is small:

- the card's own brief (`prompts/cards/self/<id>.md`): what this card answers, what it reads, what it must not
  wander into. Written as if this card were the whole reading;
- the board: the titles of the cards the person chose, with the line "you write only this one; leave the others'
  subjects to them";
- the ledger cells and `matter.*` slices for this card's matters;
- the person's earlier answers on this card.

It returns what the v3 Oracle returns today for one card: headline, every span (tone, mode, asks, obstacle,
evidence, agreement), the confirm question, optional pattern and details. Validator additions: every span of the
frame is answered; each span cites ledger cells; a dated forward claim needs a confirmed cell; `build` needs a
light or mixed confirmed cell. A failed card is re-asked once, alone.

**Layer 5. One Personalizer call per card**, chained to its Oracle call, with the existing checks and the repair
re-ask. The person's portrait is loaded once (`v2/portrait.ts`) and shared. The card is stored and served the
moment its own pair of calls is done.

**Cache.** One provider cache per person per build: the common system prompt plus `natal.core`, `sky.window`,
`year.tp` and `frame` (about 35k tokens). All five readers, the concordance call and every card call read it. Role
instructions and card briefs sit in the uncached part, which is why one cache serves every agent. It is warmed
before layer 2 and kept alive (30 min, sliding) while the background queue runs, then deleted.

**Trigger and queue.**

1. `PUT /api/self/v3/layout` with at least five cards writes the layout, then queues `self.cards` for the cards on
   the board that have no current reading. `MIN_CARDS` moves from 3 to 5.
2. The event runs layers 2 to 5: readers (limit 45 s each), concordance (60 s), then up to 8 card pairs at once
   (Oracle 45 s, Personalizer 30 s, one repair each).
3. When the board is done, the same event continues with the rest of the offered catalogue, two cards at a time,
   until the spend cap. A card the person adds meanwhile goes to the front.
4. Spend cap per person per day, `CARDS_MAX_SPEND_USD` (default $0.75). At the cap the queue stops and unread
   cards stay "not read yet".
5. The v2 Oracle and Personalizer are not run when this pipeline is on. That ends paying twice.

**Validity.** Clock sheets and the ledger are reused until the first span ends, an inventory refresh changes a
slice hash, or a prompt changes. A card is re-read when its ledger cells, the person's profile or its sections
change. Changing which cards are on the board re-reads nothing.

**Budget (estimates from the replay's token counts; nothing is spent until you say yes).**

| Step | Calls | Time | Cost |
|---|---|---|---|
| Five clock readers | 5, parallel | about 12 s | about $0.05 |
| Concordance | 1 | about 12 s | about $0.02 |
| One card (Oracle then Personalizer) | 2 | about 15 to 20 s | about $0.013 |
| First board of 8 | 22 | **first card about 40 s, all about 60 s** | **about $0.17** |
| Rest of Self (13 more) | 26, two at a time | about 3 min, unseen | about $0.17 |
| Love or Work board of 6, clocks already read | 12 | about 20 s | about $0.08 |

Today one build costs about $0.055 (v2) plus $0.09 (v3) for 11 cards read on one clock.

### 4.2 API

| Route | Change |
|---|---|
| `PUT /api/self/v3/layout` | 400 under five cards. On success also returns `reading: { queued: [ids] }`. |
| `GET /api/self/v3` | Each card gains `state`: `ready`, `reading`, `queued`, `failed`, `not_read`. New `reading: { stage, clocks: [{ system, label, state }], done, total }`. Each span gains `agreement: { agree, of }`. |
| `POST /api/self/v3/cards/:id/read` | Queue or retry one card. 202; 409 if it is already reading; 429 at the spend cap. |
| `GET /api/self/v3/catalogue` | Each card gains `state`, and its first line when read. |

Love and Work get the same four routes under `/api/love/v3` and `/api/work/v3` in Phase 4.

### 4.3 Frontend experience

1. Picker: the Save button is off until five cards are chosen.
2. After Save the board opens at once with the chosen tabs. Each tab shows a quiet skeleton and one line of state.
3. The page polls every 2 s while any card is reading. A card fades in when it is ready; the first ready card is
   selected.
4. A failed card shows "This one did not come through" and a Try again button (the new POST).
5. The `+` picker marks cards as ready or "about 15 seconds".
6. Chart details lists the clocks and which agreed for the selected span.

### 4.4 UI/UX words

| State | Words |
|---|---|
| Stage 1 | "Reading five clocks of your chart" |
| Stage 2 | "Checking where they agree" |
| Stage 3 | "Writing your cards · 3 of 6" |
| Span agreement | "4 of 5 clocks agree" · "The clocks are split here" |
| Fewer than three clocks stored | "Your chart is still being prepared. Back in a few minutes." |
| Cap reached | "Not read yet" on the card; no error |

## 5. Architecture

```
engine ──pull at sync──► kundli_data (5 inventories, year, natal)
                               │ slicer (code)
                               ▼
                        kundli_slices ─────────────► provider cache: system + natal.core + sky + year + frame
                               │                                   │ (read by every call below)
   Save layout (≥5) ──► event  ▼                                   ▼
                        clock readers ×5 ──► sheets ──► count + pair table (code) ──► concordance ×1 ──► agreed ledger
                                                                                                          │
                              board cards first, then the rest two at a time                              ▼
                        card Oracle ×N ──► validator ──► Personalizer ×N ──► technique_outputs (one row per card)
                                                                                     │
                        GET /api/<board>/v3 ◄────────────────────────────────────────┘
```

Request path: reads only. Async event: every model call. Sync worker: every engine call. The ledger belongs to the
kundli, not to a board.

## 6. Ingredients

| Ingredient | Who |
|---|---|
| Migration m48 `kundli_slices`; m47 `board_layout` still unapplied | agent writes; applied with the deploy |
| Env: `READING_CLOCK_ORDER`, `READING_CLOCKS`, `READING_CLOCKS_MIN`, `CARDS_MAX_SPEND_USD`, `SELF_CARDS_PIPELINE=1`, `CARDS_READ_REST=1` | agent; set by the deploy session |
| `READING_EXPLICIT_CACHE=1` on staging (the cache is off without it) | deploy session |
| Ten Self card briefs (doc 68 Phase C), eleven rewritten as stand-alone briefs | agent |
| Engine pass E1: `systems` list on `pressure_inventory`, shared rows computed once (one call instead of five) | engine lane |
| Engine pass E2: a weighted order of the systems for a birth (which clocks carry most weight is astrology) | engine lane |
| Engine exports for the five Indian-lens cards (doc 68 Phase D) | engine lane |
| Test kundli `c584c0a3`; paid key ending `hbtQ` | Sachin's yes |

## 7. Action steps in sequence

| # | Step | Files | Done when | Parallel with |
|---|---|---|---|---|
| 1 | Clock set and pulls for five clocks; year frame reads them | `config/env.ts`, `self/clock.ts`, `self/sub/pressure.ts`, `v3/yearFrame.ts`, `v3/build.ts`, sync worker | Test kundlis hold 4 ready inventories; frame shows 5 clocks | 2 |
| 2 | Verify rows per clock (sign dashas, the failed `kaala` row) with a harness; file disagreements | engine `tests/research/` | Report in `docs/TODOS.md` | 1 |
| 3 | `kundli_slices` table and slicers; build reads slices | `prisma/`, `src/reading/slices/` | Slice hashes stable across two runs; prep under 1 s | 4 |
| 4 | Common system prompt, clock reader prompt and schema, validator | `prompts/`, `src/reading/clocks/reader.ts` | Unit tests with a fake model | 3 |
| 5 | Count, pair table, concordance agent, ledger store | `src/reading/clocks/concordance.ts` | Status can never exceed the count (test) | 6 |
| 6 | Per-card briefs, card Oracle and Personalizer per card, per-card store | `prompts/cards/self/`, `src/reading/cards/` | 21 Self briefs; unit tests | 5 |
| 7 | Event, queue, spend cap, layout trigger, per-card state, new POST | `self/buildEvent.ts`, `v3/service.ts`, routes | Route tests | 8 |
| 8 | Web: per-card states, agreement line, clocks in details | `AIAstra_WEB` `src/pages/you/v3/` | Tests; checked in a browser | 7 |
| 9 | Replay script and the paid test (§8) | `scripts/cards-replay.ts` | Report under `docs/reading-engine/` | |
| 10 | Love and Work registries, briefs, routes, web boards | `src/reading/love/`, `work/`, web | Same test on both boards | |

## 8. Phases

| Phase | Ships | Model money | Closed by |
|---|---|---|---|
| **1. Five clocks stored and counted** (steps 1, 2) | Today's v3 cards show agreement across five clocks instead of two | none | Frame for the test kundli lists five clocks |
| **2. Slices and the ledger** (3, 4, 5) | Readers and concordance behind a flag | test only | Unit tests; ledger for one kundli in the replay |
| **3. A reading per card, Self** (6, 7, 8, 9) | Save starts the reading; cards arrive one by one; all 21 Self cards build | **the test, needs your yes** | The test below |
| **4. Love and Work** (10) | Both boards on the same ledger | a second, smaller test | Same checks |
| **5. Engine passes** | One engine call for all clocks; weighted order; five Indian-lens cards | none | Engine tests |

**The Phase 3 test.** Storage-dry, on the test kundli, paid key ending `hbtQ`, model `gemini-3.8-flash`, cap $0.75.
The board is one card drawn at random from each Self group, topped up at random to five, with the seed printed.
It records the time to the first card and to the full board, then reads every other offered card. It passes when
every offered card is stored, every card has text for every span, every dated claim cites a confirmed cell, and no
chart term or engine name is on a face. Expected about $0.40 and 45 calls. The Phase 4 test repeats this for Love
and Work, one random card per row group, expected about $0.30.

## 9. One recommendation

Build it in the order above, and start Phase 1 now: it costs nothing, it is the fix for the single-clock risk, and
every later layer needs it.

| Choice | Verdict |
|---|---|
| **Independent reader per clock, counted in code, one concordance call** | **Chosen.** Readers cannot copy each other; the count cannot be argued with; shared by all three boards. |
| Pairwise comparison agents in rounds (a true bracket) | Not chosen. Ten pairs for five clocks is ten more calls and two more rounds, about +$0.08 and +25 s, and yields the same agreement table the code count gives for free. |
| One Oracle call that reads all five clocks itself | Not chosen. Cheapest, but one model harmonises the clocks as it reads; that is the risk you named. |
| **One call per card, in parallel** | **Chosen.** Fastest first card, failures stay alone, cache makes the repeated input cheap. |
| All visible cards in one call | Not chosen. 40 s or more before anything shows; one bad card forces a full re-ask. |
| **Read the rest in the background** | **Chosen**, behind `CARDS_READ_REST`. About $0.17 more per person for Self. |
| Read a card only when it is added | Kept as the off position of that flag, for when cost matters more than the wait. |
| Start the clocks when the picker opens | Not chosen: you said the reading starts after the choice. It would cut about 25 s at a risk of $0.07 for a person who leaves. |

## 10. Decisions for Sachin

1. **The clock order** in §4.1. Until the engine exports a weighted order (E2) this list is the weighting.
2. **Minimum board of five** instead of three.
3. **Reading the rest in the background** on by default (about $0.17 per person on Self, more with Love and Work).
4. **The Phase 3 test**: key ending `hbtQ`, about 45 calls, about $0.40, cap $0.75. Asked again when Phase 3 is built.
