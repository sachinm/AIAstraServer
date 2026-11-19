# 86 — The confirmation loop: every confirm answer stored once per chart, dated answers on the timeline

Status: plan for review, 2026-11-18. No code yet.
Origin: `docs/deep-research/sanjay-rath/14-technique-mapping.md` §10 recommends this as the first change, because Rath confirms
the past aloud before every forecast and every later Rath item (rectification, seeded dashas, varga Narayana) needs
confirmed past events to be checked against. AGENTS.md product rule 4: "Confirmed answers are evidence".

## 0. Answer first

1. **One confirm service, one endpoint, one table.** `POST /api/confirm` stores every confirm answer (Self, Love, Work,
   Life, the birth-time question) in a new per-chart table `chart_confirmations`. The three existing Self confirm routes
   become thin wrappers over the same service; the Love and Work tap, which today goes to a route that does not exist,
   starts working.
2. **The server owns the claim.** The client sends only `claimId` and the answer. The service looks the claim up in the
   stored board build and saves its technique, houses and dated window with the answer, so each answer is a calibration
   point per technique.
3. **A "yes" with a date becomes a timeline event.** After yes or partly, one optional row asks "When did it start?" A
   dated answer writes one `life_events` row with source `confirm` (deduplicated against what the person already entered,
   never for illness or death categories). No date, no event.
4. **The birth-time source is asked once per chart** ("How sure is your birth time?"), and the D60 chart is passed to the
   readers only when the time comes from a record.
5. **No question spent, no model call, no engine call.** A tap is one small database transaction.

## 1. Start: what exists today (checked 2026-11-18)

Checked: `AIAstra_Server` on `feat/self-foundation-server` at `280ac27`; `AIAstra_WEB` on `develop` at `8702b54`. Code only.
**Database rows and logs were not checked.**

| What | Where | State |
|---|---|---|
| Self confirm | `POST /api/self/reading/confirm`, `/api/self/v2/confirm`, `/api/self/v3/confirm` (`src/routes/selfReadingRoutes.ts:88`, `selfV2Routes.ts:83`, `selfV3Routes.ts:147`) | All write `self.confirm.<claimId>` = yes/partly/no/skip into `person_facts` through `writeConfirm` (`src/reading/self/v2api/service.ts:247`). The claim's window, houses and technique are not stored. |
| Love and Work confirm | Web `sendSelfV3Confirm(claimId, answer, board)` (`AIAstra_WEB/src/lib/selfV3Api.ts:904`) posts to `/api/board/<board>/v3/confirm` | **That route does not exist on the server** (`src/routes/boardCardsRoutes.ts` has only catalogue and layout). Love and Work answers are lost today. |
| Love/Work/Self month check-ins | `POST /api/area/:area/checks` (`src/routes/areaRoutes.ts:151`) | Writes `area_checks` (user, area, month, side, answer) and, with a sub-area, `person_facts` `checkin.<area>.<month>`. Works; no technique link, no event. |
| Life dashboard question | `confirmQuestion()` (`src/reading/life/compose.ts:91`) | Question text only; no claim id, no answer route. |
| Past-reading ratings | `POST /api/timeline/past-reading/rate` → `ratePastLifePrediction` (`src/reading/timeline/pastReadingFlow.ts:1328`) | Rating is stored inside the stored past-reading report JSON. Not reused here. |
| Timeline (ledger) | `life_events` (`prisma/schema.prisma:576`), `createLedgerEvent` (`src/reading/timeline/ledgerStore.ts:51`) | Per user **and** kundli; source hardcoded `'user'`; cap `MAX_EVENTS_PER_KUNDLI` = 500; `DatePrecision` = day/month/year (`ledger.ts:7`); categories include `health.*`, `family.*.illness`, `family.*.death` (`ledgerCategories.ts`). Sealed through `src/lib/pii/fields.ts:143`. |
| Facts | `person_facts` (`schema.prisma:1080`), `FACT_CATALOG` (`src/profile/facts.ts:11`) | Keyed by **user only**. Boards read the user's latest kundli (`resolveKundli` / `latestKundliId`), so a second chart on one account would read the first person's answers. |
| Birth-time certainty | none | No fact or column records it. The catalogue says "D60 confirms only when the birth time is recorded to the minute" (`src/techniques/catalog.ts:303`), but D60 is passed to the readers ungated (`src/reading/oracle/digestSlices.ts:353, 403, 443, 546`). |
| Doc 48 | `48-companion-memory-on-the-you-board.md` | Planned the `/api/companion/*` question engine and per-person fact table; not built. This plan does not replace it: chart-led confirm answers and the birth-time source move to a per-chart table; the person's present situation (`work.status`, `love.status` …) stays in `person_facts`. |

Not verified, checked in step 1: where each board's stored build keeps its claim frame (Self v2/v3 has `HeroClaimFrame`
with matters, people, since, until in `src/reading/self/v2types.ts`; Love, Work and Life not found yet), and whether a
birth-data edit updates the kundli row or creates a new one.

## 2. End goal

- Every confirm tap on Self, Love, Work and Life is saved, once per chart and claim, with the technique and window it
  confirms. A second tap on the same claim updates the answer; it never asks again while the claim is live.
- A dated yes appears on the person's timeline as "From your answer", and is never a duplicate of an event they entered.
- Each chart has a birth-time source; D60 is used only when it comes from a record.
- Accuracy per technique can be counted from stored answers (yes / partly / no per technique and month), never claimed.
- Failure modes removed: lost Love/Work answers; answers that cannot be tied to a technique; a second chart inheriting
  another person's answers; D60 conclusions on a guessed birth time.

## 3. Deliverable

- Migration M55 `prisma/migrations/20261119100000_chart_confirmations_m55/` (additive): table `chart_confirmations`.
- `src/reading/confirm/types.ts`, `claims.ts` (claim lookup per board), `service.ts` (`recordConfirmation`,
  `listConfirmations`, `deleteConfirmation`, `birthTimeSource`).
- `src/routes/confirmRoutes.ts` (`POST/GET /api/confirm`, `DELETE /api/confirm/:key`), registered with the other routes;
  `POST /api/board/:board/v3/confirm` added in `boardCardsRoutes.ts` as a wrapper; the three Self routes delegate.
- `src/reading/timeline/ledgerStore.ts`: `createLedgerEvent` takes an optional `source` (default `'user'`).
- `src/reading/life/compose.ts`: the Life question carries a `claimId`.
- `src/config/env.ts`: the helpers in §6.
- `src/lib/pii/fields.ts`: `ChartConfirmation` in `SEALED_MODELS`.
- D60 gate in `src/reading/oracle/digestSlices.ts`; catalogue text for the techniques that read D60 states the gate.
- Web: `AIAstra_WEB/src/lib/confirmApi.ts`; the When row and the birth-time card; Life dashboard taps.
- Tests: `tests/unit/confirm/*.test.ts` (service, claims, dedupe, blocked categories, D60 gate); web component tests.
- Docs: this file; `docs/TODOS.md` items closed as they ship.

## 4. How it works when done

### 4.1 Backend

`recordConfirmation(prisma, userId, input)`, on the request path:

1. Resolve the chart: the given `kundliId` if the user owns it, else the latest (`resolveKundli`). None → `kundli_not_found`.
2. Validate: `board` in self | love | work | life | profile; `answer` in yes | partly | no | skip, or for
   `birth.time_source` one of record | family | estimate | unknown; `when` optional, `YYYY-MM` or `YYYY-MM-DD`, not in the
   future, precision month or day.
3. For a claim: look the claim up in the board's stored build by `claimId` (`claims.ts`), giving `technique_id`,
   `houses`, `window_from`, `window_to`, `ledger_category` (may be null), `topic`. Unknown → `claim_not_found`. The
   client never sends these.
4. Declined topics: if the claim's topic is declined for the person (`declined_topics`, doc 18) → `declined_topic`, nothing
   stored. Such a question should never have been shown; the refusal is a guard.
5. In one transaction with `pg_advisory_xact_lock(hashtext(kundli_id))`:
   - upsert `chart_confirmations` on (kundli_id, key), where key is `claim.<board>.<claimId>` or `birth.time_source`;
   - if answer is yes or partly, `when` is present and `ledger_category` is set:
     - blocked category (matches `CONFIRM_LEDGER_BLOCKED`, default `health.*`, `*.illness`, `*.death`) → no event,
       `ledger: 'blocked'`;
     - an existing event for this kundli with the same category within `CONFIRM_LEDGER_DEDUPE_DAYS` (default 45) of the
       date → link its id, `ledger: 'linked'`;
     - 500 events already → no event, `ledger: 'full'` (the answer is still stored);
     - else `createLedgerEvent(..., source: 'confirm')` and link it, `ledger: 'written'`.
6. Compatibility: for board `self`, also write `self.confirm.<claimId>` in `person_facts` as today, so the current Self
   builds keep reading it. This double write ends in the deferred step that moves the readers (§8).

Limits: one upsert, at most one select and one insert; target p95 under 150 ms. A double tap is the same upsert. No
retries; a failed write returns 500 and the chip lets the person tap again. No engine call, no model call, and it is
not counted by the question gate.

`birthTimeSource(prisma, kundliId)` returns the stored value or `unknown`. The digest slicer drops D60 from every slice
unless the value is at or above `D60_MIN_BIRTH_TIME_SOURCE` (default `record`).

Table `chart_confirmations`: `id`, `user_id`, `kundli_id`, `key`, `board`, `technique_id` null, `answer`, `houses int[]`,
`window_from date` null, `window_to date` null, `event_id` null (→ `life_events.id`, on delete set null),
`answered_at`, `updated_at`; unique (kundli_id, key); index (user_id); foreign keys cascade with the kundli and user.

### 4.2 API

| Endpoint | Request | Response |
|---|---|---|
| `POST /api/confirm` | `{ kundliId?, board, claimId? \| key?, answer, when?: { date, precision } }` | 200 `{ stored: true, ledger: 'written' \| 'linked' \| 'blocked' \| 'full' \| 'none', eventId? }` · 400 `bad_board` \| `bad_answer` \| `bad_key` \| `bad_when` · 404 `kundli_not_found` \| `claim_not_found` · 409 `declined_topic` · 500 `write_failed` |
| `GET /api/confirm?kundliId=` | | 200 `{ confirmations: [{ key, board, answer, answeredAt, eventId }] , birthTimeSource }` |
| `DELETE /api/confirm/:key?kundliId=` | | 204. The linked timeline event stays; the person deletes it on the timeline page. |
| `POST /api/self/{reading,v2,v3}/confirm` | unchanged `{ claimId, answer }` | unchanged 204 \| 400; calls the service with board `self` |
| `POST /api/board/:board/v3/confirm` (new) | `{ claimId, answer, when? }` | as `POST /api/confirm`, board love \| work; 400 `unknown_board` |

All `/api/confirm*` routes require the user, check `assertOwnAccount`, and send the private no-store cache headers.

### 4.3 Frontend experience

- **Confirm chips** (Self hero, Love and Work hero, Life area line): Yes · Partly · No · Skip. A tap disables the chips
  and shows "Noted." at once; on failure the chips come back with "Couldn't save. Tap again."
- **When row** after Yes or Partly, one line, optional: "When did it start?" This month · Last month · 2–6 months ago ·
  Earlier · Not sure. "Earlier" opens a month picker. "2–6 months ago" sends the month four months back with precision
  month. "Not sure" sends nothing. A written event shows "Added to your timeline" with a link.
- **Birth-time card**, once per chart, on the first board open after the chart is ready, and editable in the profile:
  "How sure is your birth time?" From a birth record · Family remembers it · A rough guess · I don't know. Never shown
  again once answered.
- No loading spinner: the tap is optimistic; the board does not rebuild on a tap (the next build reads the answer).

### 4.4 UI/UX copy and states

States per chip row: idle, sent ("Noted."), failed ("Couldn't save. Tap again."), answered (the chosen chip shown,
others hidden). No chart terms anywhere in this flow. The timeline marks confirm events "From your answer" so the person
can tell them from events they typed.

## 5. Architecture

Request path only: web → `/api/confirm` (or a wrapper) → `confirm/service.ts` → Postgres (`chart_confirmations`,
`life_events`, `person_facts` for Self). Builds read answers on their next run; nothing is pushed to a running build.
The calculation engine is not called. The digest slicer reads `birthTimeSource` when it assembles slices, so the D60 gate
holds for every reader that uses the slicer. Guarantees: one row per chart and claim; an event is written at most once per
claim (the row keeps its `event_id`); illness and death categories are never written from a chart-led question.

## 6. Ingredients

- Migration M55 (additive; standing OK to apply for testing, QA data only).
- Env helpers in `src/config/env.ts`: `CONFIRM_LEDGER_DEDUPE_DAYS` (45), `CONFIRM_LEDGER_BLOCKED`
  (`health.*,*.illness,*.death`), `D60_MIN_BIRTH_TIME_SOURCE` (`record`).
- `SEALED_MODELS` entry for `ChartConfirmation`.
- No new library, no IAM, no EventBridge, no agent row, no technique row (this is a service, not a technique); the
  catalogue text of the D60 readers changes.
- Owners: a server agent (steps 1–7, 9), a web agent (step 8, in parallel once §4.2 is fixed), the deploy session
  (release), Sachin (the decisions in §9).

## 7. Action steps in sequence

1. **Verify the unknowns** (server agent, read-only): where Love, Work and Life keep the claim frame in their stored
   builds; whether a birth-data edit keeps the kundli id. Write the answer into §1 of this doc. Done: §1 has no
   "not verified" line.
2. **Migration and model**: M55, Prisma model, `SEALED_MODELS`, applied to the QA database, `prisma generate`. Done:
   `prisma migrate status` clean.
3. **Env helpers** in `env.ts` with defaults. Done: unit test reads the defaults.
4. **Service and claim lookup**: `src/reading/confirm/*`, `createLedgerEvent` source parameter. Done: tests cover each
   `ledger` outcome, the dedupe window, blocked categories, declined topics, double taps.
5. **Routes**: `confirmRoutes.ts`; the Love/Work wrapper; the three Self routes delegate. Done: route tests for every
   status code in §4.2.
6. **Life claim ids**: `compose.ts` gives the Life question a stable `claimId` stored with the build. Done: test.
7. **D60 gate** in `digestSlices.ts`, catalogue text updated. Done: a test slice for `unknown` has no D60, for `record`
   has D60.
8. **Web** (parallel with 4–7 after step 2): `confirmApi.ts`, the When row, the birth-time card, Life taps, Love/Work
   taps pointed at the working route. Done: component tests; a screenshot sequence in `docs/screenshots/` per the QA
   workflow.
9. **Check and release**: `npx tsc --noEmit`, `npx vitest run tests/unit/confirm tests/unit/self tests/unit/timeline`,
   merge `--no-ff` into `develop`, release through the deploy session.

## 8. Development phases

- **Phase 1, the loop (steps 1–5, 8 partly):** table, service, endpoints, Self and Love/Work taps saved, the When row and
  timeline events, the birth-time card. Check: tests green; on staging a test user's Love "Yes / Last month" gives a
  `chart_confirmations` row and a `life_events` row with source `confirm`.
- **Phase 2, coverage (steps 6, 8 rest):** Life dashboard taps; month check-ins (`/api/area/:area/checks`) also write a
  confirmation row with the area brief's technique. Check: screenshot of the Life taps; rows present.
- **Phase 3, the gate (step 7):** D60 only on a recorded birth time. Check: slice test; a reading for an `unknown` chart
  has no D60 line.
- **Deferred:** a per-technique count of yes / partly / no for the admin research page; moving the Self readers off
  `person_facts` and ending the double write; the Rath family-fact and birth-time check questions
  (`docs/deep-research/sanjay-rath/13-user-questions.md` §3–4) and the rectification technique, which need the engine's
  candidate divisional lagnas; gating fine sub-periods on the birth-time source.

## 9. One recommendation

Build one per-chart confirmation table behind one service and endpoint, with the server reading the claim from its own
build, and write a timeline event only for a dated yes. It closes the lost-answer bug, turns every answer into a
calibration point, and gives the later Rath checks the confirmed events they need, with no engine or model work.

| Option | Verdict |
|---|---|
| Keep answers in `person_facts` as doc 48 planned | No: keyed by user while boards read the latest chart, so a second chart inherits the first person's answers; the birth-time source belongs to a chart. |
| Client sends the window and technique with the answer | No: the server already holds the build; trusting the client makes calibration forgeable. |
| A separate route per board | No: one service; the old URLs stay as wrappers. |
| A timeline event for every yes | No: an undated yes is not an event; it would put guessed dates on the timeline. |

Decisions for Sachin (my pick first):
1. **D60 when the birth-time source is unanswered:** off until answered (recommended) · on as today.
2. **Chart-tied answers stored per chart, departing from doc 48's per-person table:** yes (recommended) · no.
3. **Events from answers on the timeline:** shown, marked "From your answer" (recommended) · hidden from the timeline but
   kept for calibration.
