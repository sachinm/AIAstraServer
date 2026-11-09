# 02 — Fresh board builds count as questions

Sachin, 2026-11-09: "Everytime there's a new dashboard reading done all fresh then increment the question '0 of 20
questions used — Upgrade' counter for that account! for any board/across all boards. And when there's a general reading
question asked increment the question counter."

## 1. Start (checked in code, 2026-11-09)

- **The counter.** `billing_accounts.questions_used_this_month` (with `usage_month_start`) is the number the web shows as
  "N of 20 questions used". `QuestionGate` (`src/billing/questionGate.ts`) moves it: `reserve()` inserts a
  `question_usage` row (unique on `user_id, key`) and takes one question with a conditional UPDATE that refuses past the
  limit; `commit()` settles the row; `release()` gives the question back. A `key` makes a replay free.
- **General questions are already counted.** `POST /api/chat/confirm-stream` reserves with `clarify:<runId>` and commits
  when the answer is delivered (`src/routes/clarifyRoutes.ts`); the GraphQL `ask` mutation reserves and commits too
  (`src/graphql/schema.ts`). A declined (policy) answer or a failed one is given back. No change needed; tests exist.
  (`/api/chat/answer` and `/api/chat/prewarm` skip the gate — already filed in `docs/TODOS.md`.)
- **Board builds are not counted.** Three routes build boards, each once per kundli per UTC day, storing the result in
  `area_builds` (and the technique-output store):
  - `GET /api/area/self`, `GET /api/area/love` → `getAreaBoard` (`src/reading/area/boardService.ts`), returns `cached:false`
    when it built now.
  - `GET /api/area/career` (the Work board) → `getCareer` (`src/reading/area/careerService.ts`), same flag.
  - `GET /api/self/reading` (the You board's "Your reading", doc 64) → served from the store; when today's Oracle synthesis
    is missing it queues `self-reading-build`, which runs `runSelfReadingBuild` in its own Lambda invocation
    (`src/reading/self/buildEvent.ts`) and writes the `self.reading` marker.
- **The web** reads the counter from `me.plan` (`AIAstra_WEB src/Auth/ProfileGate.tsx` `refreshPlan`), on mount and on
  window focus, and from `usage` on chat events. A board open does not refresh it.
- **Admin mirror.** `aiadastra_admin api/src/plans.ts` mirrors the plan rule and the status logic. Neither changes here
  (the same column is counted), so the mirror stays as it is.

## 2. End goal

Opening a board that has to be built fresh today takes one question from the account's month, shared across You, Love
and Work, and the "N of 20" line shows it within a second of the board appearing. Opening it again the same day, a retry,
the background build finishing, or a second invocation never takes a second one. A failed build takes none. General
questions keep counting as today.

## 3. Deliverable

- `QuestionGate.chargeBoard(userId, board, day)` in `src/billing/questionGate.ts`.
- Calls in `src/routes/areaRoutes.ts` (self, love, career→work) and `src/reading/self/buildEvent.ts` (`runSelfReadingBuild`).
- Board responses carry `usage` (the plan status after the charge) so the web can update without another round trip.
- Web: `AreaBoardView`/Work board/You reading call `refreshPlan()` (or `setPlan(usage)`) after a fresh board.
- Tests: gate unit tests (charge once, idempotent, over limit, exempt, plans off), route tests (fresh charges, cached does
  not, failed does not), build-event test (ok charges once, failed/pending charges none).
- No migration: `question_usage` keys are free text.

## 4. How it works when done

### Backend
- **What "fresh" means.** The board was built in this request or this invocation: `getAreaBoard`/`getCareer` returned
  `cached:false` (not from `area_builds`, not from the technique store), or `runSelfReadingBuild` finished with the Oracle
  `ok` and not `cached`. Served from the store, `preparing`, `no_kundli`, a thrown build, or an Oracle `failed`/`pending`
  is not fresh and costs nothing.
- **One charge per board per day.** The key is `board:<board>:<YYYY-MM-DD>` with board ∈ `self | love | work`
  (`/api/area/career` is the Work board; `/api/area/self` and the `self.reading` build are both the You board). So the
  You board's code build and its Oracle synthesis together cost one question, not two. `reserve()` with that key returns
  the earlier row on any repeat (retries, a stuck build re-run, the async self-invoke, two tabs), so the count cannot
  double. The ticket is committed at once, since the work is already done.
- **At the limit (recommended: allow, do not over-count).** The board is still built and shown; the conditional UPDATE
  refuses to go past the limit, so the counter stays at 20 of 20 and nothing is recorded for that board. Questions stay
  blocked as now. Exempt staff and `PLANS_ENABLED` off are never charged (the gate's existing rules). A database error in
  the charge logs and serves the board.
- **Cost of a charge:** 3–5 small queries after the build, off the path of a cached open.

### API
- `GET /api/area/self|love|career` 200 bodies gain `usage` (PlanStatus) when a charge was attempted on a fresh build.
  Nothing else changes; no new status code (a board is never refused for quota).
- `GET /api/self/reading`: unchanged; the charge happens inside the background build.

### Frontend experience / UI-UX
- After a board loads with `cached:false` the web applies `usage` (or calls `refreshPlan()`); the "N of 20 questions used —
  Upgrade" line ticks up by one. When the You reading's Oracle turns from `pending` to `ok` while polling, the web calls
  `refreshPlan()`. Words on screen do not change.

## 5. Architecture

```
GET /api/area/<board> ─▶ getAreaBoard/getCareer ─▶ cached? ─yes─▶ 200 (no charge)
                                                  └─no──▶ chargeBoard(user, board, day) ─▶ 200 { …, usage }
GET /api/self/reading ─▶ store ─pending─▶ self-invoke ─▶ runSelfReadingBuild ─ok & fresh─▶ chargeBoard(user,'self',day)
chargeBoard = reserve(key=board:<board>:<day>) + commit   (question_usage unique key, conditional counter UPDATE)
```

## 6. Ingredients

No new env vars, IAM or migrations. Uses `PLANS_ENABLED`, `PLAN_FREE_QUESTIONS`, `PLAN_PLUS_QUESTIONS` as today.
Deploy (server, then web) goes through the deploy sub-session.

## 7. Action steps

1. Gate method + unit tests (`src/billing/questionGate.ts`, its test).
2. Route charges + tests (`src/routes/areaRoutes.ts`).
3. Build-event charge + test (`src/reading/self/buildEvent.ts`).
4. Web refresh after a fresh board (AIAstra_WEB, branch off web `develop`), with tests. Can run beside 2–3.
5. TODOs filed; merge server and web branches into their `develop`.

## 8. Phases

- **P1 (server):** steps 1–3. Closes on the server test suite and typecheck green. Shippable alone: the counter moves;
  the web shows it on the next focus or reload.
- **P2 (web):** step 4. Closes on web tests and typecheck. The line updates as soon as the board shows.

## 9. Recommendation and the decision for Sachin

**At the limit, a fresh board is built and shown, and the counter stays at the limit.** The boards are the free
experience; blocking them would show an empty You/Love/Work page on the day the month's questions run out, while the
cost of a board build is small next to a question. Questions stay blocked.

| Option | Verdict |
| --- | --- |
| Allow, counter stays at limit (chosen) | Board always shows; quota still visibly used up; no over-count. |
| Block fresh builds at the limit | Empty board pages with an Upgrade wall; harsher, more UI work. |
| Allow and count past the limit (21 of 20) | Confusing number; the gate's UPDATE is built to refuse this. |

**Heads-up for Sachin:** boards build once per day each, so a free account that opens You, Love and Work daily uses
about 3 questions a day and runs out of 20 in about a week, before asking anything. If that is not intended, the per-board
key can become `board:<day>` (one per day across boards) — a one-line change.

## 10. Addendum (Sachin, 2026-11-09): show when the reading was made and how long it holds

Sachin: show at the top of each board when the reading was done and the date it is valid until, "so the user knows that
coming to the dashboard doesn't automatically cost another question".

- **Where the dates come from.** A board is rebuilt only when its stored technique output (`technique_outputs`, through
  `withTechniqueOutput`) no longer covers today; that same window decides "fresh", so it is the charge rule too.
  `withTechniqueOutput` now returns `madeAt` (the stored row's `created_at` on a hit, now when made). `getAreaBoard` and
  `getCareer` turn it into `{ made_at, valid_until }` (`src/reading/area/validity.ts`; `valid_until` is the last day the
  window covers, inclusive, never before today; null when the window has no end), store it in the `area_builds` result
  and return it. An `area_builds` row from before this change answers with its own `created_at` and today.
- **API.** `GET /api/area/self|love|career` 200 bodies gain `made_at` (ISO) and `valid_until` (YYYY-MM-DD or null).
- **Web.** A one-line stamp under each board's title (You, Love, Work), in the header, no new section:
  "Made 9 Nov 2026 · Good until 3 Dec 2026 · Opening it again before then uses no question". With no end date the middle
  part is dropped and the last reads "Opening it again uses no question". No date from the server, no stamp. Light theme
  through the generated `theme-light.css`.
- **What counts.** Reopening inside the window serves the stored reading: no question. The first open after
  `valid_until` (or after the chart is rebuilt, which clears the store) builds fresh and takes one, once per board per day.
- **The You reading page** (`/api/self/reading`, web `feat/self-reading-oracle-veil`) already returns `builtLine` and
  `validUntil`; its stamp belongs to that branch (filed in `docs/TODOS.md`).
