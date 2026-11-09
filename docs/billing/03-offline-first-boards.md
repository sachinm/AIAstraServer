# 03 — Offline-first boards: the person asks for a fresh reading

Sachin, 2026-11-09, replacing the "every fresh build costs a question" rule of doc 02:

> A new reading only happens when the Oracle said this reading is valid until this date ... so until that date going to
> the dashboards does not cost another question. And lets choose a method of "offline first" so the user has to initiate
> a "fresh reading" and thats when the dashboard gets a new reading ... so the very 1st reading of each dashboard should
> be made free for a new user ... so they can "trial" the dashboards.

## 1. Start (as merged on develop, 2026-11-09)

- **Boards rebuild by themselves.** `getAreaBoard` (`/api/area/self|love`) and `getCareer` (`/api/area/career`) read the
  `area_builds` row for *today*; with none they build again (code only, from the technique-output store, window
  permitting). `GET /api/self/reading` reads the Oracle synthesis by its exact store key (chart version, answers, clock,
  year, prompt version) and, with no hit, queues the paid `self-reading-build` in the background.
- **Doc 02 charges those automatic builds**: one question per board per day when built fresh (`QuestionGate.chargeBoard`
  in `areaRoutes.ts` and `runSelfReadingBuild`). So simply opening a board after its window, or after answering a
  question that changes the Oracle key, costs a question the person never chose to spend.
- **Validity shown today** (doc 02 §10) is the technique-output window, not the Oracle's own `validUntil`.

## 2. End goal

- Opening a board never builds anything that costs a question and never costs a question. It shows the last reading
  made for it, with "Made … · Good until …".
- The very first reading of each board (You, Love, Work) is made automatically and free — the trial. The same holds
  after the chart itself is rebuilt (the store is cleared then; the person did not choose that).
- After "Good until" passes, the board keeps showing its last reading and offers **Get a fresh reading · uses 1
  question**. Only that tap builds a new reading and takes one question. Before the date the button is shown disabled
  with "Fresh reading from 4 Dec 2026".
- At the question limit the old reading stays on screen; the button reads "No questions left" with Upgrade. Nothing is
  ever empty, and the counter never passes the limit (Sachin's 2026-11-09 decision, kept: boards always show).
- A fresh reading that fails is not charged (the question is given back).

## 3. Deliverable

Server: last-reading serving for area boards and the Oracle; `POST /api/boards/:board/refresh`; charge moved from
"fresh" to "refresh"; `refresh_due` on every board response; You's `valid_until` from the Oracle. Web: Fresh reading
button and its states in the board header; You reading reloads after a refresh. Tests both sides; screenshots in both
themes. No migration (uses `area_builds`, `technique_outputs`, `question_usage`).

## 4. How it works when done

### Backend
- **GET a board (area).** Serve the newest `ready` `area_builds` row for the kundli and area, any day. Only with none at
  all, build now (free) and store it. Response adds `made_at`, `valid_until`, `refresh_due` (today > `valid_until`).
- **GET the You reading.** The exact store hit is served as today. With no exact hit, the newest stored synthesis for
  this kundli and board (`technique_outputs`, technique `self.reading.oracle`, scope `all`, any window) is served as it
  is, no build queued. Only with no synthesis ever stored is the free first build queued (the trial).
- **You's dates.** `valid_until` for the You board is the Oracle's `validUntil.overall` from that stored synthesis when
  there is one, else the area window. Love and Work use their area window (no Oracle is served for them on the web).
- **POST /api/boards/:board/refresh** (`self | love | work`):
  1. Not due (today ≤ `valid_until`, or no end date) → 409 `{ code: 'not_due', valid_until }`. No charge.
  2. Reserve one question, key `board:<board>:refresh:<YYYY-MM-DD>` (a double tap or retry the same day is the same
     reservation). At the limit → 402 `quota_exhausted` with `usage`; nothing built.
  3. Love / Work: rebuild the area board now (skip the stored row, force the technique output), store it, commit the
     question, 200 with the new board and `usage`. A thrown build releases the question, 500.
  4. You: rebuild the area board now as above, then queue the Oracle build with `refresh: true` (the oracle's store is
     forced; family readers keep their own cache). Answer 202 `{ status: 'building', usage }`. The background build
     commits the reserved question when the synthesis is `ok`, and releases it when it fails. A build that never ends is
     released by the gate's stale sweep after 10 minutes.
- **Automatic first builds are never charged.** `chargeBoard` on fresh builds (doc 02) is removed.

### API
- `GET /api/area/self|love|career` 200: `+ made_at, valid_until, refresh_due`.
- `GET /api/self/reading` 200: unchanged shape; `reading.oracle.status` is `ok` for a served older synthesis.
- `POST /api/boards/:board/refresh` → 200 (love, work) | 202 (self) | 409 not_due | 402 quota_exhausted | 404 no_kundli |
  400 unknown board | 500.

### Frontend / UI
- Header line (doc 02 §10) gains one compact control at its end, no new section, same on phone and desktop:
  - not due: disabled chip "Fresh reading from 4 Dec 2026";
  - due: button "Get a fresh reading · uses 1 question";
  - working: "Making your fresh reading…" (disabled);
  - 402: "No questions left" + Upgrade link; failure: "That did not work. Try again." (nothing charged).
- After 200 the board shows the new reading and the count moves (`usage`). After 202 on You, the board reloads and "Your
  reading" polls as it does today until the synthesis lands, then re-reads the count.

## 5. Architecture

```
open board ─▶ newest stored reading ─(none ever)─▶ build now, free (trial)
           └─▶ show it + Made/Good until + refresh_due
tap Fresh reading ─▶ POST /api/boards/:b/refresh ─▶ due? ─▶ reserve 1 ─▶ rebuild ─▶ commit | release
                                                     (You: Oracle build in its own invocation settles the reservation)
```

## 6. Ingredients

No env vars, IAM or migrations. Paid model calls happen only on the You refresh (as today's background build) and on a
first-ever You reading; no Gemini call is made while building or testing this (tests stub the build).

## 7. Steps

1. Gate: `reserveBoardRefresh`, `settleBoardRefresh`; drop `chargeBoard` callers (`src/billing/questionGate.ts`).
2. Area services: `latest` read and `force` rebuild; `refresh_due` (`boardService.ts`, `careerService.ts`, `validity.ts`).
3. Oracle: newest-stored fallback in `cached_only`; `refresh` forces the oracle store only (`oracle.ts`, `service.ts`).
4. Routes: GET changes; `POST /api/boards/:board/refresh` (`src/routes/boardRefreshRoutes.ts`); build event `refresh`
   flag settles the reservation (`buildEvent.ts`).
5. Web: refresh client, header control, You reload (`areaApi.ts`, `careerApi.ts`, `ReadingStamp.tsx`, `SelfReading.tsx`).
6. Tests, typecheck, screenshots in both themes; merge both into develop.

## 8. Phases

- P1 server (steps 1–4): unit and route tests green. Shippable alone: boards stop charging; the refresh endpoint exists.
- P2 web (step 5): tests, typecheck, e2e screenshots.

## 9. Recommendation

**Refresh only after "Good until" passes; automatic builds only when nothing was ever stored, and those are free.** This
is exactly the rule Sachin gave, and it means the same reading is never paid for twice.

| Option | Verdict |
| --- | --- |
| Refresh unlocks after "Good until" (chosen) | Matches the Oracle's date; no paying for an identical reading. |
| Refresh any time, always charged | People pay for the same reading when nothing has moved. |
| Auto-rebuild after the date, charged (doc 02) | Charges without a choice; what Sachin asked to replace. |

Left for Sachin: none blocking. A board whose reading has no end date (`valid_until` null) is never "due"; if he wants
a manual refresh there anyway, the rule is one line.
