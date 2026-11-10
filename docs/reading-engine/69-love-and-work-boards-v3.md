# 69. Love and Work boards v3: the same system, fewer cards

Status: **approved by Sachin 2026-11-09 (D1 to D3 as recommended: five on the board, nine or ten in the catalogue,
one call per board; build on open; no Children card for now). Blocked on doc 68 Phases A and B, which are not yet
approved. No code changed. No paid model call made; the replay in §7 step 5 still needs its own yes.**
Asked by Sachin: "do something similar for Love, Work dashboard but go easy on the areas of focus, because they need
to be pulled in a reasonable amount of time."

This is a companion to doc 68 (Self v3). It adds no new machinery. It reuses doc 68's card registry, year frame,
layout store, picker, templates and section rules, and its research
(`reports/Self dashboard v3 design evidence.md`). Read doc 68 first; this doc states only what differs.

Rules that bind every line: as doc 68. Separation, divorce, job loss and firing are never a verdict; they appear only
as strain with a date (doc 45 §8.2, doc 43).

## 0. Answer first

| Question | Answer |
|---|---|
| How many cards? | **Nine or ten in each catalogue, five on the board to start, and only the ones that fit the person are read.** A married person is never read "Meeting someone"; a student is never read "Leading people". Most people get six or seven cards read per board, against 26 on Self. |
| How long to load? | **One Oracle call and one Personalizer call per board.** Target: first cards in 20 to 30 s cold, the rest inside the same call. Self takes three calls. |
| When are they built? | Only when the person opens that board, or after Self is ready, never all three at once. The board they are looking at always goes first. |
| What changes from today? | Today Love and Work are code-only boards (tone vote, clocks, sub-areas with template lines). v3 gives them the same card as Self: the next twelve months in the chart's own periods, Get through or Build, one question the person can answer No to. The top strip goes here too. |
| Recommendation | Build after Self Phase B proves the card contract. Then Love and Work are mostly registry rows and two card briefs. §9. |

## 1. Start (checked 2026-11-09)

1. **Love** is configured in `src/reading/area/love.ts`: houses 7, 5, 11, 2, 4, 8, 12; nine sub-areas (Meeting
   someone, Romance, Commitment, Why it is taking time, How things are between you, Distance or tension, Getting back
   together, Family and in-laws, Friendships). The person's `love.status` hides the ones that do not fit.
2. **Work** is configured in `src/reading/area/career.ts` with ranked sub-areas by work status and level (doc 43 §8.3).
3. Both are served by `boardService.ts` from the house layers and voting families. **No Oracle and no Personalizer
   run for them.** The words are template lines chosen by tone. Nothing is cut into periods.
4. The pages are `src/pages/love` and `src/pages/work` in the web repo, with the same top strip as Self.
5. A fresh board build costs one question per board per day (`docs/billing/02`).

## 2. End goal

Love and Work look and behave like Self v3: the person's own cards, two wide cards across on an iPad, each built on
the next twelve months. The catalogue is short and already filtered to their situation, so the picker takes seconds
and the build takes one call.

What can no longer happen: a card that does not fit the person's status; all three boards building at once; a Love
or Work card with no dates; a verdict of separation or job loss.

## 3. The cards

Five start on the board: the ● cards that fit the person's status. The picker and `+` tab work as in doc 68 §4.1.

### 3.1 Love (ten; a person is read five to seven)

| Card | It answers | Shown when status is |
|---|---|---|
| ● Where love stands | The state of your close bonds this year, period by period | any |
| ● Meeting someone | When meeting is likely and what to do in the quiet months | single, searching |
| ● Why it is taking time | What is slowing it, since when, until when | single, searching, delayed |
| ● How things are between you | Warmth and strain with your partner through the year | partnered, married |
| ● Distance or tension | What strains it, from where, when it eases, what holds it | partnered, married |
| ● The partner you draw | The kind of person you are drawn to and who suits you | any |
| ● Family and in-laws | How family acceptance and the home sit this year | any |
| Commitment | When a bond can be made firm | dating, partnered |
| Getting back together | Whether and when a door reopens | separated, by the person's own choice only |
| Friendships | The friends who carry you and when to lean on them | any |

A single person starts with: Where love stands, Meeting someone, Why it is taking time, The partner you draw, Family.
A married person starts with: Where love stands, How things are between you, Distance or tension, The partner you
draw, Family. "Romance" folds into Where love stands. "Children" stays out: it is its own sensitive subject and waits
for a decision (D3).

### 3.2 Work (nine; a person is read five to seven)

| Card | It answers | Shown when status is |
|---|---|---|
| ● Where work stands | The state of your working life this year, period by period | any |
| ● Money coming in | Income and gains through the year: thin stretches and openings | any |
| ● The next move | A change of role, employer or direction: when to prepare, when to act | employed, searching |
| ● What wears you at work | Load, conflict, a difficult superior: since when, until when | employed, running a business |
| ● What to build | The skill or standing to build in the easier months | any |
| Recognition | Being seen, promoted, credited | employed |
| Finding work | The search: when it opens, what to do meanwhile | searching, student |
| Your own venture | Starting or steering a business | running a business, considering one |
| Leading people | Authority and those who report to you | senior levels |

"What to build" is the Build side of doc 68 made into a card, because for work it is the most useful thing to say in
a light year.

## 4. How it works when done

### 4.1 Backend

1. **Same registry.** Love and Work cards are rows in doc 68's `SELF_CARDS` registry, renamed `BOARD_CARDS`, with a
   `board` field and a `showWhen` rule over `person_facts`. The existing `subareas` config supplies each card's
   planets and houses; nothing astrological is added in Node.
2. **Same year frame.** The spans, tones and clock agreement are built once per kundli per day and shared by all
   three boards. Love and Work only select the rows for their houses.
3. **One call each.** One Oracle call per board over the cached natal prefix, naming only the cards that pass
   `showWhen`. One Personalizer call after it. The person's five board cards are first in the schema so they
   validate and store first.
4. **Build order.** The board the person opens is queued at once. The other two are queued only when it is ready,
   one at a time. A board nobody opens is not built.
5. **Budget guard.** If a board's Oracle call passes 45 s, the cards already validated are served and the rest are
   marked pending; the page does not wait.
6. **Layout store.** `self_board_layout` becomes `board_layout` with a `board` column.
7. **Status change.** When the person changes `love.status` or `work.status`, the cards that no longer fit leave the
   board, the suggested ones for the new status are offered, and nothing is added without a tap.

### 4.2 API

`GET /api/board/:board/v3`, `GET /api/board/:board/v3/catalogue`, `PUT /api/board/:board/v3/layout`,
`POST /api/board/:board/v3/confirm`, where `:board` is `self`, `love` or `work`. Doc 68's `/api/self/v3` routes are
this same set.

### 4.3 Frontend and what the person experiences

As doc 68 §4.7, with one shared board component for all three pages. Differences:

1. The picker shows only cards that fit the person, so it is one screen of six or seven tiles.
2. If `love.status` or `work.status` is unknown, the board first asks that one question (four chips) and reads
   nothing until it is answered. This follows "ask before you predict" and saves a build.
3. Hard cards (Distance or tension, What wears you at work, Why it is taking time) always pair the strain with what
   holds it and the date it eases.

### 4.4 The prompts

One Oracle prompt and one Personalizer prompt serve all three boards (doc 68 §4.8), with a short board section each:

| Board | Added Oracle rules |
|---|---|
| Love | Read the 7th first, then Venus, the Moon, the partner significator and the lasting-bond point, in the birth chart and the D9. Never state separation, divorce or infidelity. Strain is a span with dates and what holds it. Never describe a named person; "the partner you draw" is a type. |
| Work | Read the 10th first, then the 6th, 2nd and 11th, the Sun, Saturn, the career significator, in the birth chart and the D10. Never state dismissal or failure. A hard span is load with dates. Money is direction and timing, never an amount and never investment advice. |

Personalizer additions: write to the person's status and level; in a Build span on Work name a concrete skill from
their field; on Love never give advice that assumes a partner's motives.

### 4.5 Budget (estimates; nothing is spent until you say yes)

| Item | Estimate | Basis |
|---|---|---|
| One Love or Work build, six or seven cards | $0.04 to $0.06, 20 to 30 s cold | Doc 66 replay: eleven Self areas for $0.055 in one call; fewer cards, shorter span objects, cached prefix |
| Replay to prove each board (one test kundli, two builds per board) | under $0.30 for both boards | Four builds |

## 5. Architecture

```
year frame (shared, once a day) ─┐
BOARD_CARDS + showWhen(person) ──┼─► Oracle ×1 per board ─► validator ─► Personalizer ×1 ─► card store
natal prefix (cached) ───────────┘
board_layout(board) ─► GET /api/board/:board/v3 ─► one shared web board component
```

## 6. Ingredients

| Ingredient | State |
|---|---|
| Doc 68 Phases A and B (registry, layout, year frame, card contract, shared web component) | Needed first |
| Love and Work sub-area config | Have |
| `love.status`, `work.status`, `work.level` in person facts | Have |
| Card briefs and `showWhen` rules for 19 cards | New, small |
| Board sections of the two prompts | New, small |
| No engine work | The D9, D10 and D7 rows are already stored |

## 7. Action steps in sequence

1. Sachin answers D1 to D3 (§10).
2. After doc 68 Phase A: move Love and Work pages onto the shared board component with the strip removed, filled
   from today's code-board data. No model call.
3. After doc 68 Phase B: add the 19 card rows, `showWhen`, and the board sections of the prompts; dry run with a
   fake client.
4. Build order and the 45 s budget guard, with unit tests.
5. **Paid replay, on your yes**: one test kundli, two builds per board; time and cost written to
   `docs/reading-engine/replays/`.
6. Switch `/dashboard/love` and `/dashboard/work` to v3; keep the code boards behind a flag for one release.

## 8. Phases

| Phase | What ships | Model cost | Depends on |
|---|---|---|---|
| L1 | Love and Work on the wide layout with picker and `+`, today's content | none | doc 68 Phase A |
| L2 | Period-led cards from one Oracle call per board | replay under $0.30, then about $0.05 a build | doc 68 Phase B |
| L3 | Year table (Template 4) across all three boards | none | doc 68 Phase E |

## 9. One recommendation

Approve this as the follow-on to doc 68, with **five cards on the board, nine or ten in the catalogue, one call per board,
and builds only when a board is opened**.

The reason to keep it small is the one you gave. Three calls for Self plus three for each of Love and Work would
make a new person wait minutes and cost three times as much for cards most people never open. Filtering by status
does most of the work for free: it removes the cards that would be wrong for the person anyway, which also makes the
board feel like it knows them. And because the year frame and the natal prefix are shared, Love and Work add about
five cents and half a minute each, only when asked for.

## 10. Decisions for Sachin

| # | Decision | My recommendation |
|---|---|---|
| D1 | Five on the board, nine or ten in the catalogue, one call per board? | Yes |
| D2 | Build Love and Work only when opened (then the other in the background), not at registration? | Yes |
| D3 | A Children card on Love? | Not now. It is sensitive and deserves its own rules first. |
