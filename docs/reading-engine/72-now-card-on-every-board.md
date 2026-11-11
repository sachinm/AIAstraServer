# 72. The Now card on every board (2026-11-11)

Asked by Sachin, 2026-11-11: "run the Now by the 5 dasha systems and TODAY's transit charts D1-D60, so the user knows
about SELF, LOVE, WORK", then "add a Now card by default that's freely available to all dashboards".

## 1. Start (facts checked today)

- **There is no Now card in v3.** v2 had a `now` area ("Right now"); v3 left it out (`SelfCardIdV2 = Exclude<SelfV2AreaId,
  'now'>`, `src/reading/self/v3/types.ts:32`) because the periods it read were weeks to months long.
- **Deep dasha levels are served.** The engine on `release-candidate-staging` (`fd2745d`) serves `pressure_inventory`
  with `levels` 1 to 6. Levels 4 and deeper are cut to a window around `as_of` (90 days back, 365 ahead,
  `DASHA_DEEP_DAYS_*`). The sign dashas (Narayana, Chara and the other 12-fold ones) and Kaala stop at level 5; the
  others go to 6. The server asks for 3 (`PRESSURE_LEVELS`, `src/reading/self/sub/pressure.ts`).
- **Today's transit in every divisional chart is served.** Export `transit` takes `divisional_chart_factors` (a list,
  or a range such as `d1-d60`) and returns each chart's planets with their sign, nakshatra and house from that chart's
  own transit lagna. Factors served: 1-12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144.
- **Fault: the transit's `natal_house` is counted from the natal D1 lagna in every chart** (`chart_rows` and
  `natal_lagna_sign` in `src/jhora/transit_export.py` compute one natal lagna, D1, and use it for all factors). In D9
  a transit must be counted from the natal D9 lagna, in D10 from the natal D10 lagna, and so on. As served, the D2-D60
  natal houses are wrong. Node may not recount them (Radha is the only source of astrological data, not even a lookup).
  This is an engine fix.
- **The transit sky is shared** (memory: one sky for all users); only the overlay on a person's chart is per kundli.
- **The quota.** Opening a board never costs a question (`src/routes/areaRoutes.ts`); only a refresh the person asks
  for does.

## 2. End goal

Every board (Self, Love, Work) opens with a Now card, always there, never one of the person's chosen cards and never
charged to their quota. It says what today holds for that board's subject: the running period in each of the five
clocks at its deepest level, and today's transits over this person's chart in D1 to D60, each chart read for the
matter it governs (D9 for partnership, D10 for work, D60 for the deep pattern, and so on).

## 3. Deliverable

1. Engine: `transit` gives each chart's `natal_house` from the natal lagna of the same chart.
2. Server: a daily Now pull per kundli (five clocks at their deepest level around today; one transit call with
   D1-D60 and the natal overlay), stored for the day; a `now` slice; one Now reading per board.
3. Web: a Now card first on the Self, Love and Work boards.

## 4. How it works when done

### 4.1 Data (engine, then server; no astrology in Node)

| What | Engine call | When | Stored |
|---|---|---|---|
| Running periods, deepest level, five clocks | `pressure_inventory` per clock, `levels` 6 (5 for sign dashas), `years_back` and `years_ahead` the smallest allowed | first open of the day | per kundli and day |
| Today's transit over the chart, D1-D60 | `transit`, `at` = today noon in the person's place, `divisional_chart_factors` [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60], natal fields | first open of the day | per kundli and day |

The server keeps from the clocks only the rows running today (level 1 down to the deepest), and from the transit only
what the engine returned. The `now` slice lists both, each line with its evidence key.

### 4.2 The reading

One model call per day per kundli writes three Now faces (Self, Love, Work) on the cached pack of doc 71, plus the
`now` slice in the uncached request (it changes daily). Each face: one line for today, what the day asks, one if-then
step, and when the running deepest period turns (a date the engine gave). Same checks as every card: keys from the
input, dates from the input, no chart word, no engine name. About 3,000 output tokens: about $0.02 a day (estimate).

The Now reading is free to the person: it runs on the first open of the day, from the board itself, with no question
taken. It needs the board's chosen cards no more than the clock layer does; it reads only the five clocks and the sky.

### 4.3 API and web

- `GET /api/self/v3` (and the Love and Work boards) add `now: { state, line, asks, step, turns, clocks[] }`.
- The Now card sits first on each board, outside the person's layout; it cannot be removed. On phone it is the first
  carousel slide, on tablet and desktop the first panel.
- While the day's pull or reading runs: "Reading today's sky" with the old Now if there is one.

## 5. Ingredients

Existing: `pressure_inventory` levels 1-6, `transit` with `divisional_chart_factors`, `fetchTransit`
(`src/reading/chartData/transit.ts`), the slices, the doc 71 pack and group call, the card checks, the board routes.

New: the engine fix; the daily Now pull and its store; the `now` slice; `cards/now.md`; the Now call and its checks;
`now` on three GET responses; the web Now card.

## 6. Action steps, in order

1. Engine: per-chart natal lagna in `transit` (`natal_house` from the natal lagna of the same factor), a test against
   the natal varga lagna the `varga.dN` export gives, calc version bump. Engine release path.
2. Server: the Now pull (both calls), stored per kundli and day; tests with fakes.
3. Server: the `now` slice and its keys.
4. Server: `cards/now.md`, the Now call on the pack (three faces in one call), its checks; tests with a fake model.
5. Server: `now` on the Self, Love and Work responses; the call made on the first open of the day.
6. Web: the Now card on the three boards.
7. Paid check: one Now call on the test kundli (about $0.02). Needs Sachin's yes.
8. Release through the deploy session.

## 7. Phases

| Phase | Steps | Proves |
|---|---|---|
| 1. Engine | 1 | D2-D60 houses are counted from the right lagna |
| 2. Data | 2, 3 | the deepest running periods and the 16 charts arrive and are stored once a day |
| 3. Reading | 4, 5, 7 | three faces from one call, checked, free |
| 4. Web | 6 | the card is first on every board |

## 8. Decisions for Sachin

1. Which charts: D1-D60 as listed (16 charts), or also D81, D108, D144 (served, rarely read).
2. The deepest level: 6 where served (prana, hours to a few days), or 5 (sookshma, days). 6 changes within a day; 5
   suits a card read once a day.

## 9. Recommendation

Build it in the order of §6, with level 5 and the 16 charts D1-D60. The engine fix comes first: without it the D2-D60
houses are wrong and the card would read them.
