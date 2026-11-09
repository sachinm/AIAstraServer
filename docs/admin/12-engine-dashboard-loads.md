# 12 — Engine › Dashboard loads: the latest build of a person's board, every agent under it, and what each one said

Status: **plan with Phase 1 built, 2026-11-08 (night),** for Sachin's finding of the same night: the admin has a Lab
and Techniques, but the most recent dashboard load of a person cannot be pulled up, the Oracle's failure on it is
invisible (the Lab shows an Oracle block only when it has text), and the agents' answers, which are all written to the
database, cannot be read. Server side on branch `fix/self-reading-background-build`, admin side on
`feat/admin-engine-loads` (repo `sachinm/aiadastra_admin`).

Rules that bind: read-only over stored rows, nothing re-run and nothing computed; the kundli id never leaves the
admin API; birth fields are stripped by the server; the engine's name is never shown; every list is bounded.

## 0. Answer first

| Sachin's question | The answer |
|---|---|
| Why can't I see the Oracle failure in Admin? | `aiadastra_admin/api/src/labAdapter.ts oracleOf` returns `null` when the dossier's Oracle has no `output`/`text`; a failed Oracle has neither, so the Lab draws no Oracle block, no status, no error, no time. |
| Where can I pull up the most recent dashboard load? | Nowhere today: the Lab lists dossiers under a technique filter and the Agents pages aggregate. This plan adds **Engine › Dashboard loads** (`/engine/loads?userId=&board=&load=&run=`): one person, one board, the builds newest first, each opened to its agent timeline and each agent's answer. |
| Are the agents' responses captured? | Yes, in three places the page reads: `agent_runs` (one row per agent and sub-agent run: status, ms, model, tokens, cost, error, `output_summary`), `reading_dossiers.oracle` (the Oracle's text, the lineman's brief, every family's findings, the stage table with tokens and cost) and `reading_dossiers.panels` (the lines each panel showed). A build that dies before its dossier leaves only `agent_runs`, which the page lists as "runs under no build". |

## 1. Start: facts checked 2026-11-08

- Server: `GET /api/admin-lab/dossiers` (list) and `/runs/:id` (one dossier) exist; no route joins `agent_runs` to a
  dossier; the dossier carries no error text for a failed Oracle (`{ status: 'failed', calls: 0 }`); the error lives in
  `agent_runs.error` of the `self.reading_oracle` row ("Gemini call timed out after 60000ms").
- `agent_runs` rows of Gemini stages record `prompt_tokens = 0` and `est_cost_usd = 0` while the dossier's stages hold
  the real counts (TODOS 2026-11-08 night, P1). The page shows both and marks the gap.
- Admin API: `api/src/admin/engine.ts` reads `agent_runs` and `technique_outputs` directly with bounded SQL; the Lab
  goes through `serverClient.ts` with an allow-list adapter so the kundli id stays on the server. Loads follow the Lab
  path (the server joins; the admin maps).
- Admin web: Engine pages share `components/engine/EngineShell.tsx` (strip with the Engine tabs, left rail, centre,
  right rail) and `WorkspaceLayout`; `PersonPicker` and `listLabPeople` already pick an account.

## 2. End goal

Staff open Engine › Dashboard loads, pick a person and a board, and see the builds of that board newest first with a
status chip each (Oracle ok / failed / pending / budget, time, cost). Opening a build shows, top to bottom: the build's
header (when, trigger, scope, clock, digest version, audit verdict, valid-to), the agent timeline (every `agent_runs`
row under it in order: agent, technique, status, ms, model, tokens, cost, error), the panels (status, lines, Oracle
lines, plan), and the answers (each family's findings, the lineman's brief, the Oracle's text) as collapsible text.
A build running now shows as "building since …" from the marker; a build that died shows its runs under "no build".
The URL carries person, board, build and run, so a link to a failure can be pasted into a chat.

## 3. Deliverable

1. Server `GET /api/admin-lab/loads/:userId?board=&limit=` (`src/routes/adminLoads.ts`): dossiers newest first (≤ 30),
   `agent_runs` from 20 minutes before the oldest listed build, grouped under builds by time, the Oracle mapped with
   its error (stored, or the failing run's), the panels' line counts and texts, the `area_builds` build marker.
2. Admin API `GET /api/admin/engine/loads?userId=&board=&limit=` (`api/src/admin/loads.ts`): consent gate, server call,
   allow-list mapping to `EngineLoads*` contract types; the `noPersonalFields` test covers the new types.
3. Admin web `pages/engine/Loads.tsx` at `/engine/loads` with the nav item "Dashboard loads": person picker and board
   tabs in the strip; left rail the builds (chip per Oracle status, time, cost); centre the agent timeline table and
   the panels table; right rail the picked run or answer; `?userId=&board=&load=&run=` kept; tests with a fixture.
4. Lab fix: `labAdapter.ts oracleOf` returns a block for a failed Oracle (status, error, ms) so the Lab stops hiding it.

## 4. How it works when done

**Backend.** The server joins nothing new in the database: it reads `reading_dossiers` (select without `data`), the
`agent_runs` of the kundli since the oldest listed build minus 20 minutes (≤ 600 rows) and the build marker, and groups
runs by time: a run belongs to the first dossier written at or after (its end − 5 s). Runs after the newest dossier are
`unassignedRuns`. The Oracle block is mapped from the dossier's `oracle` JSON; when it is `failed` the error is taken
from the failed `*.reading_oracle` / `lineman.*` / `family.*` run in the same group (new builds also store `oracle.error`).
`stripBirthFields` runs over the whole response.

**API.** The admin API adds `getLoads(userId, board, limit)` to `ServerClient`, maps every field by name (an
allow-list), drops anything unknown, and never passes a kundli id. Contract: `EngineLoads { userId, board, marker,
loads: EngineLoad[], unassignedRuns: EngineLoadRun[] }` with `EngineLoad { id, createdAt, asOf, validTo, trigger, scope,
clock, digestVersion, verdict, costUsd, steps, techniques, gaps, panels, oracle, runs }`.

**Frontend.** `/engine/loads`: strip = Engine tabs, "Dashboard loads", person picker, board segmented tabs, refresh.
Left rail = builds (newest first; a row shows the time, the trigger, the Oracle chip, the total ms from `steps`, the
cost) plus a top row for the marker when a build is running or failed recently and a bottom row "runs under no build"
when `unassignedRuns` is not empty. Centre = the picked build: header facts; the agent timeline (one row per run:
start time, agent, technique, status chip, ms, model, prompt/cached/output tokens, cost, error in red); the panels
table (panel, status, lines, Oracle lines, plan). Right rail = the picked run (its input and output summaries, charts
used) or, from the answers section, the full text of a family's findings, the lineman's brief or the Oracle's text,
with a Copy button. Nothing scrolls the page; panels scroll inside (docs/04 §1.9).

**UI/UX.** Status chips: ok green, cached slate, failed red, pending/building amber, budget_exceeded amber. Times as
`formatMs`, cost as `formatCost`. Tokens show the dossier stage's counts beside the run's; when the run's are zero and
the stage's are not, a small "run row under-counts" hint points at the TODO.

## 5. Ingredients

Server: `src/routes/adminLoads.ts`, `src/routes/adminLabRoutes.ts` (mount), `src/reading/self/types.ts` and
`oracle.ts` (`oracle.error`), `tests/unit/reading/self/adminLoads.test.ts`. Admin API: `api/src/contract.ts`,
`api/src/serverClient.ts`, `api/src/admin/loads.ts`, `api/src/app.ts`, `api/src/labAdapter.ts` (Lab fix),
`api/tests/loads.test.ts`. Admin web: `web/src/pages/engine/Loads.tsx`, `web/src/App.tsx`, `web/src/components/Layout.tsx`
(nav), `web/src/lib/adminApi.ts`, `web/src/test/engineFixtures.ts`, `web/src/pages/engine/Loads.test.tsx`.

## 6. Action steps

1. **Built.** Server route, grouping, Oracle error, marker, tests.
2. Admin contract types and `ServerClient.getLoads`; `admin/loads.ts` with the consent gate; route in `app.ts`; the
   Lab adapter's failed-Oracle block; API tests (stub server client, a failed build fixture, the personal-fields test).
3. Admin web page, nav item, route, API client, fixture and tests (builds list, failed chip with error, run picked
   through `?run=`, answers rail, person and board in the URL).
4. Typecheck and tests in `api/` and `web/`; commit on `feat/admin-engine-loads`.
5. Deploy both (server Lambda `aiastra-server-api`, admin API Lambda and Amplify) through the deploy session; open
   Sachin's 21:20 build and confirm the failed Oracle shows its error and 163 s.

## 7. Development phases

| Phase | Scope | Gate |
|---|---|---|
| 1 | Server route (done) | `adminLoads.test.ts` green; tsc 0 |
| 2 | Admin API + Lab fix | `api` tests green; `noPersonalFields` passes on the new types |
| 3 | Admin web page | `web` tests green; the 9:20 pm build shows "failed · Gemini call timed out after 60000ms · 163.6 s" |
| 4 | Deploy and verify live | the page opens Sachin's builds on staging |

## 8. Recommendation

Build it as one Engine page over the Lab's server path rather than more Lab tabs: the Lab answers "what does a
technique produce", this page answers "what happened on this person's last load", and that question is the one asked
every time a dashboard looks wrong. Keep it read-only; the Lab stays the place to re-run.
