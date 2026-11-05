# 04 — Active users and the day review in the Admin Panel

Status: **build plan, 2026-11-05, executing.** Sachin's brief:

1. An **active users** tool: how many people are on the site now (signed in), today and this week.
2. A **review of a day** (yesterday by default):
   - the questions that went out;
   - the queries, function calls and techniques that fired;
   - the agents that spun up and did the work, and which agents were involved.
3. Questions asked alongside: is everything in the database to build these dashboards and charts, and what extra
   logging is needed to review it clearly?

## 1. Start (facts checked 2026-11-05 against the shared database and `develop` 2c88ee7)

| Source | What it holds | State in the database today |
|---|---|---|
| `auth.last_seen_at` | The last signed-in API request. `requestAuth.ts` writes it at most every 5 minutes per user per instance | 35 accounts; 1 seen today, 1 this week, 0 in the last 15 min |
| `analytics_events` | First-party clicks: `page_view`, `board_open`, `tab_select`, `question_answer` …, with `user_id`, `session_id`, `surface` | 86 events on 2026-11-05 from 1 user, 2 sessions. The web sends them only on the boards built so far |
| `assistant_visits` | Signed-out visitors of the public assistant, one row per visit per day | present |
| `account_events` | Sign-in, sign-out, profile, plan and payment changes, with IP and user agent | **table not in the database yet** (migration `20261105240000` is waiting on the deploy session) |
| `reading_traces` | One row per query: kind (reading, clarify, prewarm), flow, bucket, template, tier, route, number of subjects, status, tokens, cost, ms | 0 rows in the last 3 days (no staging questions) |
| `reading_runs` | The reading. `id` = the trace's `run_id`; `intent` (json: subjects with weights, horizon, question type, safety, bucket), `chat_id`, `status`, `cost_usd`, `timings_ms` | present |
| `chats.category` | Where a conversation started: general, work, love, you, today, lucky | present |
| `reading_agent_spans` | Every agent stage and model call. `agent_id`, `technique_id` and `category` are written by the build deploying now (M29) | 0 in the last 2 days |
| `agent_runs` | Board functions (career, lucky times), tagged with technique, charts read and kundli by M29 | 71 runs on 2026-11-05, written before the tagging deploy, so untagged |
| `technique_registry` | 51 techniques, seeded at boot | Empty until the server deploy boots |

## 2. Answer: is everything there?

**Mostly yes.** These can be built today from stored rows:

- **Queries of a day:** count, status, time and cost from `reading_traces`; subject, horizon and question type from
  `reading_runs.intent`; board or category from `chats.category`.
- **Agents and techniques of a day:** from `reading_agent_spans` and `agent_runs`, tagged from today's deploy on.
- **Active now, today and this week:** from `auth.last_seen_at`.

**Gaps** (what extra logging would make the review clear):

| # | Gap | Why it matters | Fix | When |
|---|---|---|---|---|
| G1 | `last_seen_at` keeps only the latest time, so there is no history | No daily or weekly active-user chart, and no "who was active on the 3rd" | New `user_activity_days` table: one row per user per day (first seen, last seen, 5-minute touches), written where `last_seen_at` is written. Migration M30 | **This build** |
| G2 | Board function runs are not grouped by the request that caused them | A Lucky times load writes 1 + N runs, which can't be read as one action | `agent_runs.request_id` from the request id | Next |
| G3 | Sign-ins are not recorded yet | No "signed in today" or session count | `account_events` (migration exists; apply and deploy) | Deploy session |
| G4 | Clicks are sent only by the new boards | Page views and sessions for Chat, Profile and the landing page are missing | The web sends `page_view` on every route | Web |
| G5 | Engine pulls inside a reading are not spans | Chart-data fetch time is hidden inside "step" spans | A span per engine call (type, cache hit, ms) | Next |
| G6 | Spans before the first subject read `general` | Category counts lean to General | Intake labels the trace with its subjects (filed in TODOS) | Filed |
| G7 | The question text | Not a logging gap. The text is stored (`messages.question`, `reading_traces.question`), but the admin never reads it (doc admin/01) | Show structure only: category, subjects, horizon, type, bucket, and the clarify questions asked as a count. Showing text would be Sachin's decision, and the recommended form is a superadmin-only Reveal per query with an audit row, like Reveal email | Decision |

## 3. End goal

### Activity page

- **Four tiles:**
  - On now: signed-in users seen in the last 15 minutes.
  - Today.
  - This week: the last 7 days.
  - Signed-out visitors today, from the public assistant.
- **A 30-day chart** of daily active users (from G1) and of queries per day.
- **A table of today's active users:** masked email, plan, first and last seen, queries today, boards opened today.

### Day review page

The date defaults to yesterday, in Pacific time. It shows:
- **Totals:** queries, people who asked, failures, cost, p50 and p95 time, clarify questions asked, and board loads.
- **Charts:** queries by hour; queries by category (Self, Love, Work, General) and by subject; and techniques fired by
  category.
- **Techniques fired:** runs, failures and time per technique, linking to its Techniques page.
- **Agents involved:** id, type, model, runs, failures, average and p95 time, tokens and cost.
- **Queries of the day:** time, masked person, category, subjects, horizon, question type, bucket, status, ms, cost and
  agents spawned. Each links to the existing Query page, which shows that query's agents.

No question text and no birth data appear.

## 4. Deliverable

| Repo | Items |
|---|---|
| Server | Migration `20261106020000_activity_m30` (`user_activity_days`); `touchActivity` beside `touchLastSeen` in `src/auth/requestAuth.ts`; schema model; tests |
| Admin API | `src/admin/activity.ts`: `GET /activity/summary`, `GET /activity/days?days=30`, `GET /activity/users?day=`, `GET /review/day?date=`; contract types; SQL check; tests |
| Admin web | Menu items **Activity** and **Day review**; tiles, bar charts (inline SVG/divs, no new library), tables; tests |

## 5. How it works when done

### 5.1 Backend

The reporting day is `America/Los_Angeles` (`REPORT_TZ`), and it applies to both writes and reads.

**Activity writes.** `requestAuth` already decides when to write `last_seen_at` (at most every 5 minutes per user per
instance). On that same tick it fires:

```sql
INSERT INTO user_activity_days (user_id, day, first_seen_at, last_seen_at, touches)
VALUES ($1, ($2::timestamptz AT TIME ZONE 'America/Los_Angeles')::date, $2, $2, 1)
ON CONFLICT (user_id, day) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at, touches = user_activity_days.touches + 1
```

It is fire and forget. A failure (including the table not existing yet) is swallowed, as `touchLastSeen` is. The cost
is one more write per user per 5 minutes.

**Reads (admin).**
- Each read is bounded: the summary is 4 counts, the days view is at most 90 days, a user list is at most 200 rows,
  and the day review covers one day.
- Each read runs under the admin's 5 s statement timeout.
- Day boundaries are computed in SQL from `REPORT_TZ`.

### 5.2 API (admin API, staff token)

| Endpoint | Response |
|---|---|
| `GET /activity/summary` | `{ tz, onNow, today, week, visitorsToday, asOf }` |
| `GET /activity/days?days=7..90` | `{ tz, days: [{ day, activeUsers, queries, visitors }] }`. `activeUsers` is null for days before M30 existed |
| `GET /activity/users?day=YYYY-MM-DD` | `{ items: [{ userId, emailMasked, plan, firstSeenAt, lastSeenAt, touches, queries, boards }] }`. Today falls back to `last_seen_at` when M30 has no row yet |
| `GET /review/day?date=YYYY-MM-DD` | `{ date, tz, totals, byHour[24], byCategory[], bySubject[], techniques[], agents[], queries[] }` (§3). Dates later than today give 400 |

### 5.3 Frontend and UI

- **Activity:** tiles, a 30-day bar chart, and today's users. It refreshes every 60 s while the tab is visible.
- **Day review:** a date picker with "Yesterday", ‹ and ›; tiles; three bar charts; three tables. While loading it
  shows skeletons. Before tagging it says: "Agents and techniques are tagged from 2026-11-05; earlier days show them as
  untagged."
- **Words:** "On now" carries the hint "signed in, last 15 minutes", and "Visitors" carries "signed-out, public
  assistant". No engine names appear.

## 6. Architecture

The user app's API (`requestAuth`) writes `auth.last_seen_at` and `user_activity_days`. The reading flow writes
`reading_traces`, `reading_runs` and the spans. The boards write `agent_runs`.

The admin API only reads these tables, from the same Postgres. The admin web reads the admin API. The admin never
writes activity.

## 7. Ingredients

- Migration M30, which is additive and applied under the standing OK.
- `REPORT_TZ` is optional on both Lambdas; it defaults to `America/Los_Angeles`.
- No new libraries.
- The deploy session ships it.

## 8. Steps

1. **Server (worktree `feat/activity-days`).** Write M30, `touchActivity`, the schema and the tests. Merge into
   `develop`.
2. **Admin API**, in parallel with step 1: the activity and review endpoints, their tests and the SQL check.
3. **Admin web**, after step 2: the pages and their tests.
4. **Ship** through the deploy session.

## 9. Phases

- **R1.** Steps 1–3. Activity history starts accruing on deploy; the day review works on all stored rows.
  - Closing check: the tests pass and the SQL check passes against the shared database.
- **R2.** Fill G2, G4 and G5.
  - G2: `agent_runs.request_id`.
  - G4: the web sends `page_view` on every route.
  - G5: engine-call spans.
- **R3.** Sachin decides G7 (question text). If he says yes, a superadmin-only, audited Reveal per query is added.

## 10. Recommendation

**Daily activity rows written on the existing last-seen tick, and a day review assembled from tables that already
exist.**

- **Why:** It adds one table and one write path, and gives history from the day it ships. The rest is reads.
- **Question text:** It stays out until Sachin decides. The structure (category, subjects, horizon, type) answers "what
  were people asking about" without exposing words a person typed.

| Option | Verdict |
|---|---|
| Daily rows on the last-seen tick (chosen) | Cheap (one write per user per 5 minutes) and exact enough for DAU and WAU |
| Count activity from `analytics_events` only | Misses API-only use and boards that send no events |
| A sessions table with heartbeats | More writes and more web work for no better answer to "how many today" |
| Show the question text in the review | Exposes personal content; Sachin's call, not a default |
