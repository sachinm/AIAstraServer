# 75 · Self board Phase 1: the foundation card (server)

Source plan: "Dashboards and layered technique" (admin repo `.cursor/plans/dashboards_and_layered_technique_db2bfc29.plan.md`),
sections "Browser audit of the Self board", "Card names, in the header", "Calendar: why it is empty", "Back to the
drawing board", "The foundation card", "Feature switches and premium", "Release gate". This doc covers the server half;
the web half is owned by the web session and reads the contract in §4.2.

## 1. Start (facts checked 2026-11-13)

- **Layout saves race.** `PUT /api/self/v3/layout` (`src/routes/selfV3Routes.ts` → `putSelfLayout` in
  `src/reading/self/v3/service.ts` → `writeLayout` in `src/reading/self/v3/layout.ts`) takes the whole layout and
  upserts `board_layout` (one row per `kundli_id`, `board`). There is no version: two quick PUTs, or Edit then Done,
  write an older copy over a newer one (audit P0 item 2: cards set to Read went back to Research).
- **Default face.** The code default is already `read` (`getCardFaceDefault`, env `CARD_FACE`). The live board opened on
  Research because a stored `board_options.face` or the live env says so; neither is readable from here (filed).
- **Card names.** `SELF_CARDS` (`src/reading/self/v3/cards.ts`) titles "What bothers you", "Gifts & knots", "In short",
  "Chapters", "This year", "This chapter"; there is no subtitle field. "This chapter" repeats In short and Chapters.
- **Periods.** `railFromDates` / `railFromSpans` (`src/reading/self/v3/response.ts`) label every current bar
  `now → <to>`, keep same-end duplicates (This chapter: two "now → 1 Jan 2027" bars), and Phase B bars carry no text
  (`text: null`), so a chip changes only the small label.
- **Calendar.** The payload carries period ranges and prose only, never dated events, so the web grid has nothing to mark.
- **Text.** Read prose carries chart terms (Mahadasha, "32 SAV points"); Research/Chart details carry empty references
  (`()`, `(,)`, `(Mars ())`); ISO dates sit beside "11 Nov 2026"; past dates are written as upcoming. The words
  validator already exists: `CHART_TERMS`, `redactChartTerms`, `daysIn` in `src/reading/self/v2/personalizerValidate.ts`.
- **Plans.** `PlanCode` = `free | plus | unlimited` (`src/billing/plans.ts`); `effectivePlan` reads `billing_accounts`
  through `PrismaPlanStore.getAccount`. No feature-switch catalogue exists.

## 2. End goal

The Self board opens on Read. Each card has a plain name and a one-line subtitle. A card's period chips are named,
ordered by start, never duplicated, each with its own headline and text, past ones marked. Each card lists its own key
dates in plain words. A card whose text names a passed date says so. No Read text carries a chart term, an empty
bracket or an ISO date. Quick changes never undo each other: a stale save is refused with the current layout. Every card
and in-card feature sits on a switch (off / on / premium) that staff and env can flip without a deploy; a premium feature
the person's plan does not cover arrives locked, with no content.

## 3. Deliverable

- `src/reading/self/v3/layout.ts`: `version` on the layout view, `applyLayoutPatch`, `writeLayoutVersioned`
  (conditional update on `updated_at`); route answers 409 on a stale version.
- `src/reading/self/v3/foundation.ts` (new, pure): text cleaning (empty references, chart terms, one date format),
  periods, key dates, stale dates, the year title.
- `src/reading/self/v3/cards.ts`: renames, `subtitle`, This chapter not suggested and folded into Your life phases.
- `src/reading/self/v3/response.ts`, `types.ts`: the card view fields in §4.2; rail labels with real dates.
- `src/boards/features.ts` (new): the catalogue, resolution and payload gating.
- `src/config/env.ts`: `BOARD_FEATURES_OFF`, `BOARD_FEATURES_PREMIUM`, `BOARD_PERIODS_MAX`, `BOARD_PERIODS_PAST_DAYS`,
  `BOARD_KEY_DATES_MAX`, `BOARD_KEY_DATES_PAST_DAYS`.
- Migration `prisma/migrations/20261113100000_user_feature_overrides_m52` and model `UserFeatureOverride` (additive; not
  applied by this session).
- Tests under `tests/unit/reading/self/v3/` and `tests/unit/boards/`.

## 4. How it works when done

### 4.1 Backend

- **Layout PUT.** Read the row (one indexed read). If the body carries `version` and it differs from the row's
  `updated_at` (ISO, ms), answer 409 with the current layout. Else merge the patch into the stored layout (cards and
  template replace; `sections[id]`, `options[id]` replace or reset with `null`; `options[id]` keys merge; `boardOptions`
  keys merge, a `null` key resets), validate the merged layout with the existing `validateLayout`, and write with
  `updateMany where updated_at = <read value>`; zero rows updated means another write won: 409 with the fresh layout.
  A first write creates the row; a unique-key clash on create is a 409 too. Budget unchanged (`SELF_V3_ROUTE_BUDGET_MS`,
  default 2000 ms). A body without `version` still works (last write wins) so an old web keeps saving.
- **A card's own choice survives.** A card option is dropped on save only when it equals what the board already puts in
  force (the board option, else the default), not when it equals the default. Before this, a card set to Read under a
  Research board was stored as nothing (Read is the default) and came back as Research: the audit's "Read went back".
- **GET /api/self/v3.** Unchanged reads, plus one `billing_accounts` read and one `user_feature_overrides` read, in the
  same `Promise.all`. The card views are built as before, then per card, in code only: clean every Read string (drop
  empty references, drop sentences with a chart term or engine name, ISO dates → "11 Nov 2026"); clean Chart details of
  empty references only (the IP scrub of that text is doc 74's job); build the period list and key dates from the
  card's own stored windows (v2 card `dates` in Phase A, v3 `spans` in Phase B; no astrology in Node: dates and tones
  are copied); flag passed dates in the text. Then features are resolved and applied: an `off` card is absent, a locked
  card is a shell, an off or locked in-card feature empties its field.
- **Key dates.** Each window's start (when not before the keep-back horizon) is "<name> begins", its end "<name> ends";
  a date that ends one window and starts the next is the next one's "begins". Kept: up to 2 passed within
  `BOARD_KEY_DATES_PAST_DAYS` (default 60) and the upcoming ones, at most `BOARD_KEY_DATES_MAX` (default 6) in all.
- **Periods.** Windows sorted by start; windows ending the same day merge (earliest start, texts joined, first name);
  passed windows older than `BOARD_PERIODS_PAST_DAYS` (default 180) dropped; a period without its own text is dropped;
  at most `BOARD_PERIODS_MAX` (default 6), oldest passed first out. Phase A text: the body paragraphs that name the
  window's dates (`splitBodyByPeriods`); headline: the Oracle's own label when it passes the words check, else the first
  sentence of its text. Phase B: headline `asks`, text `[obstacle, step]`. Names: Phase B by held tone ("Heavy
  stretch", "Mixed stretch", "Lighter stretch"); else the Oracle label (≤ 5 words, clean); else by place ("Earlier",
  "Now", "Next", "Later").
- **Feature resolution**, highest first: the person's newest `user_feature_overrides` row for the key; env
  `BOARD_FEATURES_OFF` (comma list → off) and `BOARD_FEATURES_PREMIUM` (comma list of `key` or `key=plan` → premium);
  the catalogue default. `premium` is allowed when the plan's rank (free 0, plus 1, unlimited 2) reaches `minPlan`
  (catalogue `minPlan`, at least `plus`). Quota-exempt roles are not special here (they read as their plan).

### 4.2 API (contract for the web)

`GET /api/self/v3` → 200 `SelfV3Response`. New and changed fields only:

```json
{
  "features": {
    "feature.face.short": { "locked": false },
    "feature.periods": { "locked": false },
    "feature.key_dates": { "locked": false },
    "feature.why_panel": { "locked": true, "minPlan": "plus" },
    "feature.card_chat": { "locked": false },
    "feature.confirm": { "locked": false },
    "feature.voice": { "locked": false }
  },
  "layout": { "...": "as before", "version": "2026-11-13T09:41:07.123Z" },
  "cards": [
    {
      "id": "stuck",
      "title": "What's weighing on you",
      "subtitle": "What gets under your skin, and until when",
      "locked": null,
      "features": { "feature.periods": { "locked": false }, "feature.key_dates": { "locked": false } },
      "periods": [
        {
          "id": "p1",
          "name": "Heavy stretch",
          "label": "Heavy stretch · 29 Mar 2025 – 3 Jun 2027",
          "from": "2025-03-29",
          "to": "2027-06-03",
          "headline": "Keep your evenings for rest.",
          "text": ["…", "…"],
          "tone": "heavy",
          "current": true,
          "passed": false,
          "span": "s1"
        }
      ],
      "keyDates": [
        { "date": "2026-12-05", "label": "Heavy stretch ends", "tone": "heavy", "passed": false },
        { "date": "2027-01-01", "label": "Next begins", "tone": null, "passed": false }
      ],
      "stale": true,
      "staleDates": ["2026-11-11"],
      "rail": [{ "label": "29 Mar 2025 → 3 Jun 2027", "...": "as before" }]
    }
  ]
}
```

- `features` (board level) and `cards[].features` list only allowed features; an `off` feature is absent. A locked
  one is `{ "locked": true, "minPlan": "plus" | "unlimited" }` and its content is not in the body.
- A locked card: `"locked": { "minPlan": "plus" }`, `periods`, `keyDates`, `rail`, `standing` empty, `v2`, `v3`,
  `firstLine` null. An `off` card is absent from `cards` and from `layout.cards`.
- `feature.periods` off/locked: `periods: []`. `feature.key_dates` off/locked: `keyDates: []`. `feature.why_panel`
  off/locked: `v2.details` is `{ "evidence": [] }`. `feature.confirm` off/locked: `v3.confirm` null.
  `feature.research_face`, `feature.breakdown_face` off (default): a stored face `research` / `breakdown` reads as
  `read` in `cards[].options.face`. The Short face is the stored face `light` (label "Short").
- `cards[].title` for `year` is "Your year: Oct 2026 to Oct 2027" when the annual chart dates are stored, else
  "Your year". The `chapter` card is no longer suggested; its periods are folded into `chapters` ("Your life phases:
  before, now, next"); a saved layout naming `chapter` still validates and still shows it.
- `rail[].label` now always uses real dates (`"29 Mar 2025 → 3 Jun 2027"`, never `now → …`).
- Card `periods` with one entry: the web shows no chips (the plan's rule); the server still sends it.

`PUT /api/self/v3/layout`:

```json
{ "version": "2026-11-13T09:41:07.123Z", "patch": { "options": { "stuck": { "face": "light" } } } }
```

- `patch` keys (all optional): `template`, `cards` (the whole ordered list), `sections` (`{ id: [..] | null }`),
  `options` (`{ id: { key: value | null } | null }`, keys merge), `boardOptions` (`{ key: value | null }`, keys merge).
- 200 → the layout view with its new `version` (and `reading` as before). 409 →
  `{ "error": "stale_layout", "layout": <SelfBoardLayoutView> }`: the web adopts `layout`, re-applies its pending change
  on top, and sends again with the new `version`. 400 as before (errors of the merged layout).
- The old whole-layout body still works; with `version` it gets the same 409 check.

### 4.3 Frontend experience and UI/UX (web session; listed so the contract is complete)

Card name and subtitle in the header art; Read default; Short as the second face; period chips named and ordered
(one period: no chips), past greyed; Key dates list with "passed"; stale line "Some dates here have passed — refresh to
update"; a lock and "Part of Plus" on a locked feature; on 409 the page adopts the returned layout and re-sends.

## 5. Architecture

Request path only (Express on the `aiastra-server-api` Lambda): route → service → stored rows (layout, build, cards,
billing account, feature overrides) → pure mapping (`response.ts`, `foundation.ts`, `boards/features.ts`) → JSON. No
model call, no engine call, no build queued by any of this.

## 6. Ingredients

No library. Env vars in §3 (all optional, clean defaults). Migration m52 (deploy session applies it with Sachin's OK;
until then the overrides read fails soft to "no overrides"). The admin Features page and its `admin_actions` audit row
belong to `aiadastra_admin` (next batch).

## 7. Action steps

1. Plan doc (this). 2. Layout version and patch + tests. 3. `foundation.ts` + card registry renames + response fields +
tests. 4. `boards/features.ts`, env, migration, model, payload gating + tests. 5. tsc and vitest, TODOS, merge.
Steps 2–4 touch different files except `types.ts` and `service.ts`, so one writer does them in order.

## 8. Phases

- **Phase 1 (this branch):** all of §3. Closed by green unit tests and tsc on the touched files.
- **Deferred:** the stale guard's rewrite from stored spans on the next build (the flag ships now); the admin Features
  page; the Lab fill-rate gate (≥ 95 %) per feature; the doc 74 IP scrub of Chart details.

## 9. Recommendation

Optimistic concurrency on `updated_at` rather than a new `version` column: it needs no migration, the column is already
written on every update, and a conditional `updateMany` is atomic in Postgres.

| Choice | Verdict |
| --- | --- |
| `updated_at` as version (chosen) | no migration, atomic conditional update |
| new integer `version` column | cleaner number, but one more migration for no behaviour gain |
| server-side merge without version | still loses a concurrent change to the same key |
