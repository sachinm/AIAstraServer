# 49 — Lucky times v1: the build (scope cut, picker, layers, agents, registry, analytics, tests)

Status: **build plan, 2026-11-05 (Opus), executing.** Builds doc 47 Phase 1 and 2 with Sachin's cuts of 2026-11-05:
no month view; the board supports **one week back, today, and two weeks ahead** only; the person must **add** the
sub-categories (scenarios) they care about from a drop-down that lists only scenarios whose technique is complete; each
added scenario draws **its own calendar layer** of good times; agents that pull or build the data run **on demand**
when the person opens a scenario; every click is logged for product analytics; every agent is registered in one table
with its module, sub-module, model and price, and every run is logged with start, end and tokens. Doc 47 holds the
technique; this doc holds the v1 build.

## 1. Start (facts checked 2026-11-05)

| Fact | Where |
|---|---|
| `day_tables` holds Nov 2026 for five places (150 rows, engine `muhurta` v1), checked against Drik Panchang: abhijit, kalams, dur muhurta and star/tithi ends within 1–3 min; sunrise +3–4 min and varjyam on a midnight day (filed) | doc 47 §9a, `docs/TODOS.md` |
| A stored day has: weekday, sunrise, sunset, abhijit, rahu kaal, yamaganda, gulika, dur muhurta (1–2), brahma muhurta, godhuli, vijaya, nishita, amrita gadiya, varjyam, 30 muhurtas with a good flag, 24 horas with lords, the noon tithi/star/yoga/karana with numbers and end hours | `evals/fixtures/day-tables/sanjose/2026-11.json` |
| Not in a stored day: choghadiya, Mercury's motion, disha shool, the sunrise tithi, the star after the noon star ends | doc 47 §3.3 (engine pass) |
| Agent metrics exist only for reading runs (`reading_agent_spans` keyed to `reading_runs`); prices live in code (`src/reading/llm/models.ts` `PRICES`); there is no table of agents | doc 41, `prisma/schema.prisma` |
| The web app logs one GA event (question length only); there is no first-party click log | `AIAstra_WEB/src/lib/analytics.ts` |
| Engine calls work from the deployed Lambda (role credentials); the dev laptop has none, so an on-demand pull fails locally and the board shows what is stored | deploy session note, 2026-11-05 |

## 2. End goal (what the person sees)

The person opens **Lucky times** (a new item in the menu, route `/dashboard/lucky`). On first open: "Where are you?"
(five cities, set once, never shown again) and "What are you planning?" with an **Add** button; nothing else is shown
until they add something. The **Add** drop-down lists only the confident scenarios, grouped by area (§3). Each added
scenario is a chip; tapping a chip shows or hides its layer. Two views:

- **Today**: the window running now; the day's avoid bands; for each shown scenario, today's best windows or "Not today;
  best next: Thu 11:30–12:11".
- **Calendar**: three weeks as tabs (*Last week · This week · Next 2 weeks*, the last covering days +8..+14), each a
  day-by-hour grid 06:00–22:00 with hatched avoid bands and one coloured layer per shown scenario.

Before a scenario that depends on the person's situation, one tap: "Who is it with?" or "Do you have a job right now?"
or "Right now are you…" (doc 45 rule 13), remembered.

## 3. The confident scenarios (v1 drop-down)

A scenario is in v1 only when every rule it uses is computable from a stored day: tithi group, star group, weekday,
hora lord, the good muhurtas (abhijit, brahma, amrita gadiya, muhurtas flagged good), and the avoid bands (kalams, dur
muhurta, varjyam). Rules that need choghadiya, Mercury's motion or disha shool are dropped from the v1 rule and come
back with the engine pass; scenarios that cannot stand without them are held back.

| Area | v1 scenarios | Held back until the engine pass |
|---|---|---|
| Work | Sign a contract · Send a resume or application · Interview or pitch · Ask for a raise · Start a project · A hard talk with the boss | Launch (Mercury's motion), Negotiate (choghadiya Labh) |
| Love | Ask someone out · A first date · Clear the air | Propose (combust Venus), Make up, Meet the family |
| Money | Invest or buy | Pay, Sell, Lend or borrow |
| Travel | Set out on a journey (without the direction rule, said in Why) | Move house, Buy a vehicle |
| Study | Exam or submit | Start learning |
| Home | Start a routine | Rest, Repair |

13 scenarios. Their rules are doc 47 §3.4a, minus the dropped clauses, in `src/reading/luckyTimes/scenarios.ts` with
a source per scenario.

## 4. How it works

### 4.1 Backend

- **Windows engine** (`src/reading/luckyTimes/windows.ts`, pure, no I/O): for a stored day and a scenario, (1) day gate
  and boost from the noon tithi group, star group (only until the star's end hour; after it, no star boost) and weekday;
  (2) candidate slots = the horas between the scenario's hours (default sunrise to 21:00); (3) cut every avoid band out
  of every slot (a cut, never a fade); (4) score each piece: hora lord favoured +2, overlaps abhijit or amrita gadiya
  +2, inside a muhurta flagged good +1, day boost, personal boost (tara and chandra bala, when the overlay exists);
  (5) keep pieces of 20 minutes or more scoring at least the scenario's floor; return the best two per day with their
  reasons as plain-word keys. Every input is an engine field; the scenario table is the cited rule config (doc 47).
- **Agents** (registered, logged): `lucky.day_tables` (on demand: fetch missing days in the range for the person's place
  from the engine, one call per month, store), `lucky.day_overlay` (on demand: the person's tara and chandra bala for the
  month, one call), `lucky.scenario_windows` (code: build one scenario's layer for the range). None calls a model; each
  run is logged with zero tokens and its timings. They run when the person opens the board or adds a scenario, and the
  result is cached per (user, scenario, date, data version) for the day.
- **Agent registry** (`agent_registry`): one row per agent: id, title, kind (`engine_pull` · `code` · `llm`), module,
  sub-module, provider, model, price per 1M tokens in/out/cached and the price table version, description, enabled,
  updated. Seeded at boot from code (`src/agents/registry.ts`) including the existing reading roles with their models and
  prices from `models.ts`. **Agent runs** (`agent_runs`): agent id, user id, module, sub-module, task, input summary,
  output summary, status, error, started, ended, ms, prompt/cached/output/thought tokens, estimated cost. Written by
  `withAgentRun()`; a failed write never breaks the request. The admin module reads both (doc admin/01 adds a page).
- **Analytics** (`analytics_events`): user id, session id, event, surface, target, props (no free text, no birth data),
  at. The web batches events every 5 s or 20 events; `POST /api/analytics/events` accepts at most 50 per call, drops
  unknown event names, and returns 204.

### 4.2 API (behind `LUCKY_ENABLED=1`; 404 when off)

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/lucky/setup` | | `{ place: key | null, places[], scenarios: catalog grouped by area, picks: [{ id, shown, answers }] }` |
| `PUT /api/lucky/place` | `{ place }` | 204; 400 unknown key |
| `POST /api/lucky/picks` | `{ scenario }` | 201 `{ pick }`; 400 not in the v1 list; 409 already added |
| `PATCH /api/lucky/picks/:scenario` | `{ shown?, answers? }` | 200 |
| `DELETE /api/lucky/picks/:scenario` | | 204 |
| `GET /api/lucky/range` | `?from&to` (clamped to today −7 … +14) | `{ place, today, days: [{ date, sunrise, sunset, day_colour?, avoid: [band], layers: { [scenario]: { windows: [{ from, to, score, reasons[] }], verdict } } }], missing: [date] }`; 409 when no place |
| `GET /api/lucky/now` | | the running window and its end, from today's row |
| `POST /api/analytics/events` | `{ session, events: [{ event, surface, target?, props? }] }` | 204; 400 over 50 |

`missing` lists days not stored; when engine credentials exist the `lucky.day_tables` agent fills them on the same
request (up to 2 months, 30 s) and they come back on the next poll.

### 4.3 Frontend

`src/pages/lucky/`: `LuckyTimesPage` (views Today and Calendar), `ScenarioPicker` (Add drop-down, chips with a
coloured dot per layer, remove), `PlaceSheet` (first use and the gear), `AskFirstCard` (the one-tap situation question),
`TodayView`, `WeekGrid` (tabs Last week / This week / Next 2 weeks; carousel on the phone per doc 45 rule 11),
`WhySheet`. `src/lib/luckyApi.ts`, `src/lib/events.ts` (batched first-party analytics). No month view. No place text on
screen. Words follow doc 45 §3.3; Sanskrit only in Why.

## 5. Tests (detailed plan: `docs/reading-engine/49-lucky-times-test-plan.md`)

Unit (server): the windows engine on the San Jose fixture (avoid bands always cut; abhijit day scores top for a contract
on a Bhadra/Purna day; rikta days give no contract windows; star boost stops at the star's end; Thursday boosts a
contract), the scenario catalog (every rule references only fields present in a stored day), the range clamp, the
registry seed (every reading role has a model and price), `withAgentRun` (logs ok and failed runs, never throws),
analytics validation. Routes (server): picks CRUD, place, range with a fake store, analytics limits, flag off → 404.
Web (vitest): picker shows only v1 scenarios and adds/removes, empty state forces Add, layers toggle, no month view,
no place text, events batched. End-to-end (Playwright, run at the end locally): sign in, set place, add two scenarios,
see two layers in This week, open Why, remove one.

## 6. Steps and phases

| Phase | Ships | Check |
|---|---|---|
| A Server | migration (picks, prefs, registry, runs, analytics), windows engine, agents, routes, tests | unit and route tests green; `tsc` clean |
| B Web | the Lucky times page, picker, layers, place sheet, events, tests | vitest green; screenshots at 375 and 1280 |
| C Wire | menu item, flag on locally, end-to-end spec | Playwright run at the end |
| D Later (Fable) | the efficient weekly/hourly/monthly calculation plan for the person (§7) | doc 50 |

## 7. Left for Fable (TODO)

Write doc 50: how to compute the personal layers efficiently at three resolutions (hour, week, month) for every user,
including when to pull `daily_grade` versus `muhurta` with natal fields, how to share the per-place day once and fan out
only the three personal facts, cache keys and invalidation by `calc_version`, the nightly sweep for the next 14 days of
active users, the cost per thousand users, and how scenarios held back in §3 come in after the engine pass. Filed in
`docs/TODOS.md`.
