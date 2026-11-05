# 49 — Lucky times v1: test plan

Status: 2026-11-05. Covers the build in [doc 49](49-lucky-times-v1-build.md). Unit and route tests run in CI with
`npm run test:unit` (server) and `npm run test:run` (web); the end-to-end walk runs locally at the end, before the
deploy, against a local server with `LUCKY_ENABLED=1` and the November day tables in the test database.

## 1. Server unit tests

| File | What it proves |
|---|---|
| `tests/unit/reading/luckyTimes/windows.test.ts` | the 13 v1 scenarios have unique ids and a source; the catalog groups by area; every tithi 1–30 and star 1–27 sits in exactly one group; engine strings and clocks parse to minutes; cutting bands out of a range; the day's avoid bands are read from the row; **no window ever overlaps an avoid band** across 30 days × 13 scenarios; every window is at least 20 min; a contract on Thu 5 Nov finds a window citing Thursday; the contract layer skips Saturdays and Tuesdays; a rikta tithi gives no contract window inside its span; the star rule applies only inside the star's span; a good personal day raises the score by 2; the now state reports rahu kaal and abhijit; local minutes in a zone |
| `tests/unit/reading/luckyTimes/luckyRoutes.test.ts` | the range clamp (today −7 … +14); 401 without a user; 404 when `LUCKY_ENABLED` is off; setup lists 13 scenarios, no place, no picks; range is 409 until a place is set; place accepts only the five presets; picks add, reject unknown (a held-back scenario) and duplicates, hide, store only known one-tap answers, remove; range returns 22 days, a layer only for shown picks, avoid bands, the now state, and pulls the missing October days through the engine once; every agent run is logged with module and timings; the registry holds the reading roles and the Lucky agents; analytics keeps known events, drops unknown names and long props, records user and session; more than 50 events is 400 |
| `tests/unit/agents/registry.test.ts` | unique ids, module and kind for every agent; llm agents carry model and price, code agents none, engine agents `engine:<type>`; the seed writes every agent; `withAgentRun` logs an ok run with tokens and cost (1M prompt tokens of gemini-2.5-flash = $0.30), logs a failed run and rethrows, survives a failed log write, refuses an unknown agent |
| `tests/unit/rawSqlAllowList.test.ts`, `noPiiInLogs.test.ts` (existing) | the new modules use Prisma delegates only (no raw SQL) and log no personal data |

## 2. Web unit tests (vitest)

| File | What it proves |
|---|---|
| `src/lib/luckyApi.test.ts` | each call hits the right path and method; 409 `no_place` surfaces as a typed state |
| `src/lib/events.test.ts` | events batch (flush at 20 or 5 s), carry a session id, drop when signed out, never send free text |
| `src/pages/lucky/LuckyTimesPage.test.tsx` | first open asks for a place, then shows only the Add prompt (no scenarios until one is added); the Add menu lists only the v1 scenarios grouped by area; adding a scenario shows its chip and its layer; a situation question appears before a scenario that needs it and is remembered; toggling a chip hides its layer; removing a chip removes it; there is no month view; no place, zone or offset text is on screen; the banned-word list (doc 45 §3.3) finds nothing outside the Why sheet |

## 3. End-to-end (Playwright, `e2e/lucky-times.spec.ts`, run locally at the end)

1. Sign in as the test user (local dev host, test credentials from the seed file).
2. Open Lucky times from the menu. Expect the place sheet; choose San Jose.
3. Expect the empty state "What are you planning?" with Add. Open Add; expect 13 entries in six groups.
4. Add *Sign a contract*. Expect a chip and, in Today, a line for it. Switch to Calendar; expect three tabs (Last week,
   This week, Next 2 weeks), a coloured layer on This week, hatched avoid bands, no month tab.
5. Add *A hard talk with the boss*. Expect "Who is it with?"; choose My boss. Expect a second layer in another colour.
6. Tap a window; expect the Why sheet with the rule lines. Close it.
7. Hide the contract layer; expect only one layer. Remove the boss scenario; expect its chip gone.
8. Reload; expect the place not asked again and the remaining pick restored.
9. In the database: `analytics_events` has `place_set`, `scenario_add` ×2, `scenario_answer`, `view_select`,
   `why_open`, `scenario_layer_toggle`, `scenario_remove` for the user; `agent_runs` has `lucky.scenario_windows` runs
   with `module = lucky_times`.

## 4. Data checks

- `npx tsx scripts/check-day-tables.ts`: the stored 5 Nov rows against Drik Panchang (doc 47 §9a; abhijit, kalams,
  dur muhurta within ±3 min; sunrise convention known and filed).
- After a deploy with engine credentials: open the range on 1 Dec; expect `missing` empty after one poll and one
  `lucky.day_tables` run per place for December.

## 5. Not covered yet (filed)

- The personal layer against real engine output: the overlay shape (`tara.good`, `chandra_bala.good`) is from the
  engine's docs; the first real pull confirms it.
- Night windows across a daylight-saving change (doc 47 §1; none in Nov–Mar for the US places).
- Load: 1,000 users opening the board at once (doc 50, for Fable).
