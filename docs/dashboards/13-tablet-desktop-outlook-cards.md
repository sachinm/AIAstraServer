# Doc 13 · Tablet and desktop board: Outlook cards, range calendar, card chooser, all dashboards in the rail

Written 2026-11-18 for an Opus build session. Step 1 of the build copies this file to
`AIAstra_Server/docs/dashboards/13-tablet-desktop-outlook-cards.md`. It supersedes one line of doc 12
("Tablet and desktop keep the current board"). The phone layout (doc 12) is not touched.

## Context

Sachin reviewed the live You board on a 1920 px desktop (three screenshots, 2026-11-18) and found:

- Two cards fill the screen, and each card keeps its text in a narrow centred column with empty space on both sides.
- "Read" and "Analysis" are two tabs whose difference nobody can name.
- The calendar shows one month, a dot on the start date and a dot on the end date; the stretch between them is not shown as one thing.
- "Is this right?" sits at the end of the text, not at the bottom of the card.
- After the first card choice is saved, there is no clear way back to the full list of cards. Edit only reorders.
- The rail lists only You, Love, Work; the other dashboards are reachable only by clicking through the wizard.

Outcome wanted: denser, cohesive cards on iPad, Surface and desktop, built, pushed to `develop`, merged to
`release-candidate-staging`, live on Amplify and Lambda.

### Two decisions for Sachin (defaults chosen so the build is not blocked)

1. **Default dashboards list becomes all twelve.** This reverses your earlier wizard default (Self, Love, Work, Lucky times ticked). It applies to anyone with no saved choice, in the rail, the wizard step and the phone's avatar menu. An account that already saved a list keeps it: **your own account will still show four** until you open "Choose dashboards", tap "Show all" and save.
2. **A plain-language "Why" needs a paid re-read, so it waits for your yes.** The Personalizer prompt's hash is part of every stored card's key (`cards/run.ts:223,282`). Adding a `why` sentence to that prompt makes every stored card out of date, so each board re-reads once on its next open: live Gemini key, 6 grouped calls per board, about $0.07 per board as measured on 2026-11-18, capped at $0.45. Phases 1–4 ship without it; phase 5 ships it only after you say yes. Until then Outlook's "Why we think so" shows a counted line built from data already served.

## 1. Start (checked against code on `develop`: web `8702b54`, server `38c4c41`)

Web repo `AIAstra_WEB` (worktree on RC: `wt/web-dashboard-card-width`), server repo `AIAstra_Server` (develop worktree `wt/server-retrograde`).

| Fact | Where |
|---|---|
| Card text column is capped: `mx-auto w-full max-w-[72ch]` | `src/pages/you/v3/CardFrame.tsx:247` |
| The card already has `container-type: inline-size`, with no `@container` rules yet | `src/pages/you/v3/selfBoardV3.css:7` |
| Cards across is from the window width, not the deck: Seasons 1 (portrait) or 2, never more | `BoardV3.tsx:119-123`, `SelfBoardV2.tsx:66-97` |
| Tabs: `CARD_VIEWS = ['read','analysis','calendar']`, view is local state | `CardViews.tsx:22-23`, `CardFrame.tsx:128` |
| "Why we think so" reads `card.v2.details` only. Love/Work cards have `v2: null`, so it is blank there | `CardViews.tsx:50-60,128-135`, server `boards/v3Service.ts:46-57` |
| The Oracle's chart-language text (`gift`, `knot`, per-span `asks`, `agreement`, `certainty`) is stored in every card row but never served | server `cards/types.ts:44-53`, `self/v3/oracle.ts:37-88`, `cards/store.ts:75-78` |
| No model writes a plain-language "why" for a v3 card | server `self/v3/personalizer.ts:127-161` |
| A stored row read on 2026-11-18 (cards `mind`, `body`): `gift`, `knot` and span `asks` are clean chart-language sentences; `certainty` is an enum (`likely`); span `agreement` contains internal subject keys (`home_and_peace`, `self_and_body`) and must not be served | `technique_outputs`, technique `self.card.reading` |
| The stored card key includes the hash of the Personalizer, Oracle, system, brief and group prompts; a prompt edit re-reads every card | server `cards/run.ts:223,282`, `cards/store.ts:36` |
| Calendar: one month per page; days inside a window are already shaded; pager stops at first/last month | `CardViews.tsx:236-311` |
| A 12-month grid existed and was deleted; month helpers remain | `git show bd5e8a3^:src/pages/you/v3/faces/CalendarTool.tsx`, `toolVetting.ts:126,329` |
| Windows come from the year frame in code. Every card in one build has the same windows and tones; only the words differ | server `self/v3/oracle.ts:130-148`, `yearFrame.ts:74-257`, `foundation.ts:223-285` |
| "Is this right?" is drawn inside the scroll area, Read only | `CardFrame.tsx:248-249`, `CardFooter.tsx`, `CardParts.tsx:28-67` |
| Edit = chips edit mode (drag, move, remove). The full list (Picker) opens only on first visit or from the `+` chip | `BoardV3.tsx:763-773,1005-1029`, `CardChips.tsx:124-182`, `Picker.tsx` |
| The rail lists You/Love/Work plus only the focused dashboards in the person's list; default list is `self,love,work,lucky` | `components/SideNav.tsx:15-38,165-199`, `lib/portalDashboards.ts:21` |
| The dashboards chooser exists only as wizard step 7 | `pages/welcome/WelcomeWizard.tsx:29-33,317-350` |
| Card chat refuses a period the server did not send (`bad_period`) | server `cardChat/resolve.ts:160-162` |
| Tailwind 3.4.1, no container-query plugin; no calendar library | `package.json` |
| Amplify build runs `vite build` only: no type check, no tests in CI | `.github/workflows/deploy-staging-amplify.yml` (RC branch) |

## 2. End goal

On a tablet (768 px and up) or desktop:

- **Cards across follows the deck's real width**: iPad portrait 1, iPad landscape 2, 1366–1440 px 2, 1920 px 3, 2560 px 4. No card has an empty centred gutter.
- **Three tabs: Outlook · Astrology Reading · Calendar.**
  - Outlook, top to bottom: stretch picker (when more than one), headline, Why we think so, What to do, the stretch's text, Key dates, How the systems read it, the ladder. Cards 500 px and wider regroup this into paired panels; cards 700 px and wider use two columns.
  - Astrology Reading: the chart-language reasoning (the gift, the knot, what each stretch shows in the chart, the certainty word, the clock chips).
  - Calendar: a start-to-end bar for the whole reading, then three months side by side (two on iPad landscape) with every stretch drawn as one continuous band.
- **"Is this right?" is pinned** above the question box; the text scrolls under it.
- **Edit opens the full list of the board's cards**, ticked as on the board, with order controls. Done saves.
- **The rail lists every dashboard, grouped**, with "Choose dashboards" at its foot.
- The phone board looks and behaves exactly as today. `BoardV3.phone.test.tsx` and `e2e/phone-card-v2.spec.ts` pass unmodified.
- Failure modes removed: blank "Why" on Love/Work; no way back to the card list; end date unreachable without paging 13 times.

## 3. Deliverable

**Server (additive, no migration, no env var, no model call to ship):**
- `src/reading/self/v3/types.ts`: `SelfV3CardContent.chart?: CardChartReading | null` and `why?: string | null`.
- `src/reading/cards/store.ts`, `src/reading/self/v3/store.ts`, `src/reading/cards/run.ts`: fill `chart` from the stored Oracle card on read and on write.
- Phase 5 only, after Sachin's yes: `src/reading/self/v3/personalizer.ts`, `src/reading/cards/group.ts`, `src/reading/prompts/personalizer/self-v3.md`, `prompts/cards/group.md`: optional `why` field.
- Unit tests beside each file.

**Web:**
- New: `src/pages/you/v3/OutlookView.tsx`, `AstrologyView.tsx`, `RangeCalendar.tsx`, `useDeckWidth.ts`, `src/components/DashboardChooser.tsx`.
- Changed: `CardFrame.tsx`, `CardViews.tsx`, `CardFooter.tsx`, `selfBoardV3.css`, `words.ts`, `BoardV3.tsx`, `BoardSettings.tsx`, `components/boardCards/BoardCardPicker.tsx`, `components/SideNav.tsx`, `lib/portalDashboards.ts`, `lib/selfV3Api.ts`, `pages/welcome/WelcomeWizard.tsx`.
- Tests: new unit tests per new file; `e2e/board-outlook.spec.ts` with screenshots at eight sizes.

**Docs:** `docs/dashboards/13-…md` (this plan), `docs/TODOS.md` entries (section 8).

## 4. How it works when done

### 4.1 Backend

No new flow, table, timeout or retry. Two additive fields on each served card's `v3`:

```ts
interface CardChartReading {            // from the stored Oracle card, text only
  gift: string | null;
  knot: string | null;
  certainty: string | null;             // the stored enum, e.g. "likely"; the web maps it to a word
  spans: Array<{ span: string; shows: string }>;   // Oracle spans[].asks (chart language)
}
```

- `chart` is derived when a stored row is read (`readCardReadings`, `cards/store.ts:75-78`: rows already hold `oracle`), so every existing card gets it with no rebuild and no model call.
- The Oracle's span `agreement` text is **not** served: it carries internal subject keys. "Which clocks agree" stays the code-built chips (`span.clocks`, `span.agreement` counts) already served.
- Every string passes `redactEngineText` and has `{evidence keys}` stripped (same rule as `stripKeys`, `self/oracle.ts:587`). Evidence key arrays are never served. S1's first test feeds the two real rows above through the builder and asserts no `snake_case` key, no brace key and no engine name survives. An empty result is `null`.
- **Phase 5 (gated):** `why` is one plain sentence written by the Personalizer in the same call (prompt line: "why: one plain sentence, at most 30 words, saying why the reading holds for this person; no chart term"). Optional: a missing `why` never refuses a card (docs 82, 84). Because the prompt hash is in the card key, shipping it re-reads each board once on its next open (decision 2). About 30 more output tokens per card. The per-operation cap (`READING_SPEND_CAP_USD`, $0.45) is unchanged.

### 4.2 API

No new endpoint. Changed responses, both additive:

| Endpoint | Change |
|---|---|
| `GET /api/self/v3` | each `cards[].v3` may carry `chart` and `why` |
| `GET /api/board/:board/v3` | same |
| `PUT /api/self/v3/layout`, `PUT /api/board/:board/v3/layout` | unchanged; the card chooser saves `{version, patch:{cards}}` as the `+` chip does today |
| `GET/PUT /api/profile/facts` | unchanged; "Choose dashboards" writes `portal.dashboards` as the wizard does |

Status codes and client errors are as today (409 re-read and reapply, 401 quiet refresh).

### 4.3 Frontend experience

**Deck width.** `useDeckWidth` puts a `ResizeObserver` on `[data-testid="self-v3-deck"]`. Seasons cards across = `clamp(floor((W − 64 + 24) / (420 + 24)), 1, 4)`; the gap stays 24 px and the 40 px peek stays. Before the first measure, and in jsdom, it falls back to today's `perViewFor(template, mode)`. Opening or closing the rail re-measures after its 200 ms transition. Compact is unchanged. The gear gains "Cards across: Auto · 1 · 2 · 3 · 4", kept per device in `localStorage` (`aa.board.across`), default Auto.

| Screen | Rail | Deck | Cards | Card width | Outlook layout | Months shown |
|---|---|---|---|---|---|---|
| iPad portrait 768 | icons | 664 | 1 | 600 | M | 3 |
| Surface portrait 912 | icons | 808 | 1 | 744 | L | 3 |
| iPad landscape 1180 | open | 972 | 2 | 442 | S | 2 |
| Surface landscape 1368 | open | 1160 | 2 | 536 | M | 3 |
| 1440 | open | 1232 | 2 | 572 | M | 3 |
| 1920 | open | 1708 | 3 | 532 | M | 3 |
| 2560 | open | 2352 | 4 | 554 | M | 3 |
| 1920 with "Cards across: 2" | open | 1708 | 2 | 810 | L | 3 |

On Auto, most screens get the M layout: more cards, each regrouped into paired panels, each with three months. The two-column L layout appears on a Surface in portrait and whenever the person picks fewer cards across.

**Card shape.** `CardFrame` takes `shape: 'phone' | 'board'`, default `'phone'`, which renders exactly today's card (Read · Analysis · Calendar, "i" button, footer inside the scroll), so existing `CardFrame` tests stay valid. `BoardV3` passes `shape="board"` when `mode !== 'phone'`. All new work is under `shape="board"`.

**In-card layout** (plain `@container` rules in `selfBoardV3.css`, keyed on the card's own width; the `max-w-[72ch]` cap is dropped for `board`):

```
S  under 500 px            M  500–699 px                L  700 px and up
┌───────────────────┐      ┌─────────────────────────┐  ┌──────────────────────┬──────────────┐
│ stretch picker    │      │ stretch picker          │  │ stretch picker                       │
│ HEADLINE          │      │ HEADLINE                │  │ HEADLINE                             │
│ Why we think so   │      │ Why we think so         │  │ Why we think so      │ KEY DATES    │
│ What to do        │      │ ┌ Do ──────┬ Avoid ───┐ │  │ What to do           │  start→end   │
│  Do               │      │ └──────────┴──────────┘ │  │  Do                  │  bar + dates │
│  Avoid            │      │ stretch text            │  │  Avoid               │ HOW THE      │
│ stretch text      │      │ ┌ Key dates ┬ Systems ┐ │  │ stretch text         │ SYSTEMS READ │
│ Key dates         │      │ └───────────┴─────────┘ │  │ Ladder               │ agree / test │
│ Systems · Ladder  │      │ Ladder                  │  │                      │              │
├───────────────────┤      ├─────────────────────────┤  ├──────────────────────┴──────────────┤
│ Is this right? Y N ?│    │ Is this right?  Y  N  ? │  │ Is this right? …          Yes No ?  │
│ Ask about this card │    │ Ask about this card…    │  │ Ask about this card…                 │
└───────────────────┘      └─────────────────────────┘  └─────────────────────────────────────┘
```

**Outlook** (`OutlookView.tsx`) reuses `headlineOf`, `whatToDo`, `standingOf`, `patternLine`, `keyDatesOf`, `planSteps`, `analysisSpan` (`cardModel.ts`, `CardViews.tsx`). "Why we think so" stays plain: it shows `v3.why` when the card has one (phase 5); otherwise a line built from served counts ("5 of 7 timing systems read this stretch as mixed") with a link "See the astrology reading" that switches the tab. Chart language never appears on Outlook. Key dates gain a thin start-to-end bar with today marked, so the two dates read as one stretch.

**Astrology Reading** (`AstrologyView.tsx`): "The gift", "The knot", "What the chart shows" for the picked stretch (`chart.spans[].shows`), the certainty word (reuse the v2 certainty words in `pages/you/v2/AreaCard.tsx`), the clock chips, and on Self the existing `ChartDetails` body. Empty state: "Nothing more to show for this card yet."

**Calendar** (`RangeCalendar.tsx`, replaces `CalendarView` for `board`):
1. **Span bar** across the card: first window start to last window end, one segment per window in its tone, month ticks, a today marker, key-date ticks. Under it: `11 Nov 2026 → 27 Dec 2027 · day 8 of 412`. Tapping a segment moves the months to it.
2. **Months side by side**: 2 on a card under 500 px, 3 from 500 px (compact months: 22 px day cells at 532 px, larger as the card widens; days are not tap targets). Days in a window form one unbroken band (no gaps between cells, rounded cap on the first and last day, caps marked "Start" and "End"); today has a ring; a key date has a dot.
3. **Opening rule**: open on the month the current window starts when today is still on screen with at least one later month visible; otherwise open on today's month. Never open on an empty month.
4. **Reaching the end**: pager moves by the number of months shown; chips "Start · Today · End" jump. Same first/last limits as today.
5. Windows list (each with both dates and its length in days) and key dates below; two columns on L.

**"Is this right?"**: for `board`, `CardFooter` moves out of the scroll area to a fixed sibling between the tab panel and the chat input (slot order unchanged, so the input never remounts). It has a top fade so text scrolls under it; the scroll area gets matching bottom padding. One line on M and L, two on S. Shown on Outlook only, hidden during a conversation, follows the gear's "Show Is this right?".

**Header of a card** (`board`): the "i" button is removed; Why is inside the card and the full reasoning is the Astrology Reading tab. The chat bubble stays.

**Edit → card chooser.** Edit opens the existing Picker with the board's cards ticked (`setPickerOpen(true)` instead of `setEditing`). The picker's tray gains order controls (drag, move left/right; logic lifted from `CardChips.moveTo/moveBy`) behind a `reorder` prop that only the tablet/desktop board passes. Done saves order and choice in one `saveDeck`. "Reset to suggested" moves into the picker. On Love and Work the picker lists every lens's cards, grouped by lens, as the `+` chip does today. Button label: "Cards".

**Rail.** `SideNav` renders groups from the person's list:

```
You
Love        ▸ Dating · Marriage · Friends · Allies
Work        ▸ Career start · Primary job · Hobby · Business
Happy Hour(s)
──────────
Choose dashboards
```

Sub-items are indented when the rail is open and icon-only with a tooltip when collapsed; the list scrolls inside the rail. "Choose dashboards" opens `DashboardChooser` (the wizard's step-7 body, extracted and reused by the wizard) in a sheet, with "Show all" and Save. The default list for a person with no stored choice becomes all twelve (decision 1); an existing stored list is kept as is, so such an account sees its own entries plus "Choose dashboards". The header's Happy Hour(s) link stays. The one phone-side effect: the avatar menu of a person with no stored choice also lists twelve.

### 4.4 UI/UX: copy and states

- Tabs: "Outlook", "Astrology Reading", "Calendar". Section labels: "Why we think so", "What to do", "Key dates", "How the systems read it", "The ladder", "The gift", "The knot", "What the chart shows", "Which clocks agree".
- Card states are unchanged: queued/reading skeleton, failed with "Try again", locked with "Part of Plus", stale note with Refresh. The pinned strip and tabs show only on a ready card.
- Tab switch is instant (local state). Cards across changes without a reload when the window or rail changes.
- Engine names never appear; the redaction in 4.1 covers the new text.

## 5. Architecture

- **Request path only.** No async invoke, no sweep, no engine call, no DB write beyond the two existing saves (layout, profile facts).
- **Server boundary:** stored Oracle card → `chart` (redacted) → response. Node computes nothing astrological; it passes stored text through.
- **Web boundary:** `BoardV3` owns mode, deck width, cards across, picker and chat. `CardFrame` owns the view and lays out what the server sent. `RangeCalendar` does date arithmetic only (UTC, as today).
- **Guarantees:** phone code path untouched by a `shape` switch; the web renders correctly when `chart` and `why` are absent, so either side can ship first; the period sent to card chat is still a served period.

## 6. Ingredients

- Libraries: none new. Plain CSS container queries (Chrome 105+, Safari 16+).
- Env vars, IAM, migrations: none.
- Worktrees: created by a Haiku sub-agent at medium effort with literal paths; `node_modules` junctioned to the main checkout, `.env` copied; no `npm ci`.
- Build agents: Opus 5.5, medium effort, fast mode, in the background.
- Test data: `selfV3.fixture.ts` gains `chart`, `why` and a three-window card; e2e mocks in `.env.e2e` (no sign-in, no paid call).
- Owners: build session (code, tests, docs); deploy sub-session (pushes, Amplify, Lambda); Sachin (the one paid check in phase 4, the default-list decision below).

## 7. Action steps in sequence

1. Copy this plan to `docs/dashboards/13-tablet-desktop-outlook-cards.md`; note in doc 12 that tablet/desktop moved here. Done: file committed.
2. Create branches `feat/card-chart-why` (server) and `feat/board-outlook` (web) in worktrees. Done: both type-check clean before any edit.
3. **Server S1** `chart` on read and write, redacted, with tests (existing row gets `chart`; keys stripped; engine names redacted; empty → null). The web type gains optional `chart` and `why`. *Parallel with 5–9.*
4. (Phase 5, only after Sachin's yes) **Server S2** optional Personalizer `why` in schema, prompts, type, `cardContent`; tests that a card without `why` is still served.
5. **Web W1** `useDeckWidth`, cards-across rule, gear option, `shape` prop. Done: `data-per-view` is 3 at a 1708 px deck in a unit test; existing per-view tests pass unchanged.
6. **Web W2** `OutlookView`, `AstrologyView`, tabs for `board`, container rules, drop the "i" button. *Parallel with W3, W5, W6 (different files); W2 and W4 both touch `CardFrame.tsx`, so W4 follows W2.*
7. **Web W3** `RangeCalendar` (span bar, multi-month band, opening rule, jump chips).
8. **Web W4** pinned "Is this right?".
9. **Web W5** Edit → Picker with tray reorder. **Web W6** grouped rail, `DashboardChooser`, default list.
10. Type check (`npx tsc --noEmit -p tsconfig.app.json`), `npm run test:run`, `e2e/board-outlook.spec.ts` at 768×1024, 912×1368, 1024×768, 1180×820, 1368×912, 1440×900, 1920×1080, 2560×1440; screenshots to `docs/screenshots/board-outlook/NN-<size>-<view>.png`; phone specs unmodified and green.
11. File findings in `docs/TODOS.md` (section 8).
12. Release: server to `develop` → `release-candidate-staging` (Lambda deploy), then web the same way (Amplify). Check `/health`, a 401 on the board routes, and the Amplify run.
13. Remove the merged worktrees (junction first, never `-Recurse`), delete merged branches, stop any local server.

## 8. Development phases

| Phase | Ships | Closing check |
|---|---|---|
| 1 Server field | S1 | unit tests; a read-only query shows `chart` built from an existing Love card row |
| 2 Density and Outlook | W1, W2, W4 | e2e screenshots at eight sizes; at 1920×1080: three cards, M layout, pinned question; at 912×1368: L two-column; phone specs green |
| 3 Calendar | W3 | at 1920×1080: Nov 2026, Dec 2026, Jan 2027 side by side with one band from 11 Nov; "End" lands on Dec 2027; at 1180×820: two months |
| 4 Chooser and rail | W5, W6 | Edit opens the full list with the board's cards ticked; with no stored list the rail shows twelve entries; with a stored list of four it shows four plus "Choose dashboards", and "Show all" then Save makes it twelve |
| 5 Plain "Why" (gated) | S2 | after Sachin's yes: one board refresh on staging writes `why` on every card; cost read from `agent_runs` |

**Tests.** Unmodified and green: `BoardV3.phone.test.tsx`, `e2e/phone-card-v2.spec.ts`, `CardFrame.test.tsx` (default shape). Changed by design, and only these: the Edit tests (`SelfBoardV3.test.tsx:291-314`); board-level tests that click Read / Analysis or the "i" button at tablet or desktop width (`SelfBoardV3.test.tsx`, `BoardV3.test.tsx`, `BoardV3.cardChat.test.tsx`); `BoardSettings.test.tsx` (new gear option); the default-list tests in `portalDashboards.test.ts`, `WelcomeWizard.test.tsx`, `ProfileMenuSheet.test.tsx`; the e2e facts mock. No other test may be weakened.

Deferred, each filed in `docs/TODOS.md`:
- Phone: rename to the same three tabs and pin "Is this right?" (a one-line `shape` change once approved).
- Per-card dates: every card in a build shares the same windows, so the calendar is identical across cards until the Oracle returns card-specific dates. This is the next "aspect of the cards".
- CI runs no type check or tests on the Amplify build.
- `GET /api/board/:board/v3/layout` and the catalogue route have no ownership check (existing TODO covers PUT only).
- Dead code: `ShortFace` branch, `LensTitleButton`, `BoardTabBar`, `vetCardTools`; stale TODO at `docs/TODOS.md:2742`; stale comment `profile/facts.ts:28`.
- `VITE_BOARDS_ENABLED` is missing from `.env.production`.

## 9. One recommendation

Build it as above: one `shape` switch that leaves the phone alone, density from the deck's measured width, in-card layout from the card's own width, and two additive server fields derived from text already stored.

| Alternative | Verdict |
|---|---|
| Keep two cards and only widen the text column | Rejected: fills the gutter with long lines; shows no more cards |
| Window-width breakpoints for cards across | Rejected: ignores the rail, which is why 1920 px shows two cards today |
| Web only, no server change | Rejected: Astrology Reading would be empty on Love and Work |
| Serve the Oracle's "agreement" sentence | Rejected: it carries internal subject keys; the code-built chips say the same thing cleanly |
| Ship the plain "Why" with the rest | Deferred to phase 5: it re-reads every board on a paid key, which needs Sachin's yes |
| Two-column layout from 500 px | Rejected: 250 px columns are too narrow for the Do / Avoid rows |
| A calendar library | Rejected: the grid is 60 lines of date arithmetic already in the repo |
| Apply the new card to the phone now | Deferred: Sachin scoped this pass to tablet and desktop |

The two decisions for Sachin are at the top of this plan.

## Verification

- Server: `npx tsc --noEmit`, `npm test -- cards self/v3` in the server worktree.
- Web: `npx tsc --noEmit -p tsconfig.app.json`, `npm run test:run`, `npx playwright test e2e/board-outlook.spec.ts e2e/phone-card-v2.spec.ts`.
- Live after release: Amplify run green; Lambda `/health` 200; board routes 401 unsigned; Sachin's screenshot of You at 1920 px shows three cards, the Outlook tab, the pinned question, the three-month band, the Cards chooser and the grouped rail.
