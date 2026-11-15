---
name: dashboard-card-toolbar-vetting
description: Vet, gate, and iterate dashboard card toolbar tools across Self, Love, Work, and consumer reading boards so optional tools only appear or open when complete, non-redundant, chronologically honest data enhances communication of the card's content, while preserving required controls like Chart Details.
---

# Dashboard Card Toolbar Vetting & Communication Enhancement

Use this skill whenever creating, auditing, refactoring, or extending dashboard cards, card toolbars, card faces, or in-card tools across Self (`/dashboard/you`), Love (`/dashboard/love`), Work (`/dashboard/work`), or any multi-card reading deck.

## Core Principle

A card toolbar exists to **enhance comprehension of the card's reading**, never to advertise empty UI chrome.

1. **Show fewer tools, higher signal**: An optional tool icon is earned per card by passing strict data-completeness and non-redundancy gates. Never render a static row of optional tool icons across every card regardless of payload.
2. **Preserve required controls unconditionally**: Required evidence/inspection controls — specifically **Chart Details** (`toolbar-details` in the card header and `Chart details ›` in the card footer) — must remain visible and reachable on every ready card across all faces (`Read`, `Light`, `Breakdown`, `Research`) and templates (`Seasons`, `Compact`), even when zero optional tools pass vetting.
3. **Suppress the optional toolbar when empty**: When zero optional tools pass vetting for a card (`availableTools.length === 0`), do not render an empty `tool-switch` group or orphan separator. Only the face switcher, custom-settings indicator (when set), and required `Chart details` action remain.
4. **Never open unvetted panels — per-card or board-wide**: Intersect requested tools (`options.tools` from per-card or board-wide settings) with `availableTools` (`openTools = availableTools.filter(t => options.tools.includes(t))`). Pass per-tool vetted card counts (`toolSupport` + `cardCount`) into board-wide `BoardSettings` so tools with `0` supporting cards on the deck are omitted (unless currently toggled on so they can be turned off) and partial support ratios (`2/8`) are transparent.
5. **Zero astrological derivation in UI code**: All tool views operate strictly via deterministic date formatting, range specificity, and text cleaning over stored server windows. Never compute astrological houses, dashas, or transits in TypeScript/React, and never expose internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`).

---

## Mandatory 5-Gate Vetting Rubric (For Every Optional Tool)

Before any optional tool (`table`, `calendar`, `dates`, `timeframe`, `plan`, `info`, or any new candidate tool) is added to `availableTools` for a card, verify all five gates in code (`src/pages/you/v3/toolVetting.ts` or shared board equivalent):

1. **Gate 1 — Feature, Option & Readiness Gate**:
   - The card itself is ready (`!notReady`), any server feature grant governing the underlying data (`feature.periods`, `feature.key_dates`, `feature.confirm`) is usable (`grant.usable && !grant.locked`), and card options allow the content (e.g., `options.plan !== 'without'` for `Plan`).
2. **Gate 2 — Data Completeness & Clean Prose Gate (No Sparse Grids or Redaction Artifacts)**:
   - Normalize text at the `cardModel` / `CardParts` / `toolVetting` boundary using `scrubEmptyRefs` so redacted parentheticals (`()`, `(,)`, `(Mars ())`) never leak onto card headlines, faces (`Read`, `Light`, `Breakdown`, `Research`), `Chart details`, or tool panels.
   - Disambiguate colliding `rail[i].label` strings (e.g. nested stretches sharing `"now → 1 Jan 2027"`) into explicit formatted ranges (`15 Nov 2025 → 1 Jan 2027`).
   - Multi-period comparison tools require `>= 2` (or `>= 3` for bucketing) periods carrying their **own** vetted prose (`p.own === true`), never unbacked placeholder rails that produce blank cells or `"Nothing written for these dates yet."`
3. **Gate 3 — Non-Redundancy Gate (Must Add Signal & Never Duplicate Inline Sections)**:
   - Do **not** show `Dates` if it only repeats `PeriodStrip` range pills or if all milestones are already in the past (`milestones.some(m => m.date >= today)` is mandatory). `Dates` must surface chronological turning-point transitions (`Heavy stretch ends · Light stretch begins`), ignoring generic server labels (`Lighter stretch begins` / `Next stretch begins`), and distinguish `Active` (past start of current stretch), `Now` (today), `Next shift · In Nd`, `Ahead`, and `Past`.
   - When `Plan` (`tool-panel-plan`) is open on a card, suppress duplicate inline `<PlanList>` rendering on `ReadFace` and `BreakdownFace` (and omit hidden step counts from `Show more`).
   - Do **not** show `Info` solely to repeat the board's `Built <date>` timestamp (already shown in the board header).
   - Dynamically omit empty columns in `Table` (`Tone`, `Focus`, `One step`) and require at least 3 populated columns.
4. **Gate 4 — Chronological & Visual Honesty Gate**:
   - Granularity labels must match actual span durations:
     - Never offer `Weeks` (`"Week of …"`) when the shortest written period exceeds `VITE_CARD_TOOL_TIMEFRAME_WEEK_MAX_DAYS` (`21` days).
     - Never offer `Months` when the shortest written period exceeds `VITE_CARD_TOOL_TIMEFRAME_MONTH_MAX_DAYS` (`95` days).
     - Never offer a timeframe granularity (`Decades`, `Years`, etc.) unless grouping the card's written periods produces **`>= 2` non-empty buckets**.
   - `Calendar` must walk actual day-by-day coverage (`coveringPeriodForDay`, where inner sub-periods take precedence over overarching outer rails and incoming selectable stretches win on handoff days):
     - Require `>= 2` distinct toned stretches **actually painted** on the grid, `>= 2` distinct shades across painted days (rejecting 365 single-color squares), and `>= 1` real day-to-day transition inside the rendered months.
     - Derive `calendar-legend` tones strictly from painted days, and **never** hide trailing months with CSS `nth-child(n + 4) { display: none }` on narrower cards — keep all vetted months reachable in compact responsive columns inside the scrollable tool container.
5. **Gate 5 — Layout Non-Destruction & Environment Configurability**:
   - Wrap `.self-v3-tools` + `.self-v3-scroll` inside a dedicated inner stage (`.self-v3-stage { container: card-stage / size; }`) and cap `.self-v3-tools` at `max-height: 38cqh` (`flex flex-col overflow-y-auto`, **never** viewport-relative `34vh` which eats 89%–100% of the card stage and crushes `card-body` to `0px` on mobile, and **never** rely on a custom `.self-v3-scroll { min-height }` alongside Tailwind's `.min-h-0` utility which overrides it in bundle order). This guarantees the primary reading column always retains `>= 55%` of the card stage while keeping `CardFooter` (`Chart details ›`) inside the viewport.
   - Every open tool panel displays a clear header naming the tool and a one-tap close button (`Close <Tool>`).
   - Externalize all vetting thresholds (`VITE_CARD_TOOL_*` on Web, `src/config/env.ts` on Server) with sensible defaults.

---

## Per-Tool Reference Matrix

| Control / Tool | Category | Required Data to Pass Vetting | Communication Enhancement Standard |
| :--- | :--- | :--- | :--- |
| **`Chart details`** (`toolbar-details` + footer link) | **Required Action** | Ready card + `onDetails` handler | **Always shown.** Action button (never `aria-pressed`). Scrubs empty parenthetical refs (`()`, `(,)`, `(Mars ())`); displays chart reasons + per-span clock agreement. |
| **`table`** (`TableTool`) | Optional Toggle | `>= 2` periods with `own` prose **and** `>= 1` structured comparison dimension (`tone`/`mode`, `focus`, or `step`) | Renders **only** vetted rows; dynamically omits empty columns; uses `<caption className="sr-only">` + `<th scope="col">`; surfaces trap warnings and clock agreement. |
| **`calendar`** (`CalendarTool`) | Optional Toggle | `>= 2` painted toned periods + `>= 2` shades + `>= 1` day-to-day boundary in active 12-month horizon | Specificity-aware `coveringPeriodForDay` (nested sub-periods win); trims uncovered months without CSS `nth-child` chopping; legend lists only painted tones; rings turning-point days. |
| **`dates`** (`DatesTool`) | Optional Toggle | `>= 2` periods with `own` prose, `>= 2` milestones, and `>= 1` milestone `>= today` | Chronological turning-point timeline (`Active`, `Now`, `Next shift · In Nd`, `Ahead`, `Past`), compound transition titles, dated pattern `until` horizons; tapping selects the stretch. |
| **`timeframe`** (`TimeframeTool`) | Optional Toggle | `>= 3` periods with `own` prose + `>= 1` duration-honest `CardGroupBy` yielding `>= 2` buckets | Offers only honest granularities (`validGroupBys`); auto-resolves invalid default `groupBy` (`weeks` -> `months`); groups only written periods so no bucket is empty. |
| **`plan`** (`PlanTool`) | Optional Toggle | `options.plan !== 'without'` and `>= 2` non-empty scrubbed ladder steps (`best`, `practical`, `drift`, `floor`) | Structured action ladder; suppresses duplicate inline `<PlanList>` on `Read` and `Breakdown` faces while open. |
| **`info`** (`InfoTool`) | Optional Toggle | Non-empty `optionNotes`, freshness warning (`staleDates`), or hidden unanswered `confirm` (`!confirmOn`) | Shows actionable card notices and human-formatted dates (`9 Nov 2026`, never raw ISO `2026-11-09T...`). |

---

## Accessibility & Modern Web Toolbar Standards (`modern-web-guidance`)

1. **Single Tab Stop & Native `focusgroup` Feature Detection**:
   - Keep `role="toolbar"` and `focusgroup="toolbar wrap"` on the full toolbar container.
   - Feature-detect `'focusGroup' in HTMLElement.prototype`: **only when `false`**, install a single-tab-stop roving `tabIndex` (`0` on the active stop, `-1` on all other face/tool/details buttons) with `ArrowRight`/`ArrowLeft`/`Home`/`End` wrap-around navigation across all controls. Never install roving `tabIndex` when native `focusgroup` is present.
2. **ARIA & High-Contrast Visual Cues**:
   - Optional tool buttons use `aria-pressed={active}` (`boolean`). Action buttons (`Chart details`) **never** carry `aria-pressed`.
   - Active toggles (`[aria-pressed='true']` / `[aria-checked='true']`) pair background tint with a `>= 3:1` inset border cue (`box-shadow: inset 0 0 0 1px ...`) and `@media (forced-colors: active)` `Highlight` outline.
   - Draw the vertical toolbar `<span role="separator" aria-orientation="vertical" />` with a CSS `border-l` (never `background` alone, which `forced-colors` strips), and omit it when `availableTools.length === 0`.
3. **Touch & Pointer Ergonomics**:
   - Enforce `44x44px` minimum hit targets on `@media (pointer: coarse)` and force horizontal scroll-snap swipe (`resolveGroupsAs('swipe')`) on coarse pointers for `By timeframe`.

---

## Verification Checklist Before Shipping Any Card Tool Change

- [ ] Does `Chart details` remain visible and functional in both `Seasons` and `Compact` layouts across all 4 faces, including when `availableTools` is `[]`?
- [ ] Does the full `CardToolbar` expose **exactly one** `tabIndex={0}` stop when `'focusGroup' in HTMLElement.prototype` is `false`, with `ArrowRight`/`ArrowLeft`/`Home`/`End` reaching faces, vetted tools, and `Chart details`?
- [ ] When `availableTools` is `[]`, are both `data-testid="tool-switch"` and `role="separator"` absent from the DOM?
- [ ] Are all vetted calendar months rendered (no `nth-child(n + 4)` CSS hiding), nested sub-periods resolved over overarching rails, and uniform single-shade calendars rejected?
- [ ] When `Plan` is open on `Read` or `Breakdown`, is duplicate inline `PlanList` suppressed, and does `options.plan === 'without'` gate `Plan` off?
- [ ] Does `Dates` distinguish `Active` (past start) from `Next shift` / `Ahead`, preserve transition titles over generic server `keyDates`, and reject cards whose dates have all passed?
- [ ] Are empty parenthetical artifacts (`()`, `(,)`, `(Mars ())`) scrubbed across headlines, faces, tools, and `Chart details`, and duplicate period labels disambiguated?
- [ ] Do `tsc --noEmit` and unit tests covering empty, partial, nested, Phase A (`v2`), and full (`v3`) card fixtures pass?
