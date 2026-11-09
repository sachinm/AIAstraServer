# Web audit: the Self ("You") board, as built

Read-only audit, 2026-11-09. No code changed. Tags: **[fact]** seen in code at the cited line; **[inf]** inference.

## 0. Which code this is

- The web app is **Vite + React Router**, not Next.js (`AIAstra_WEB/vite.config.ts`, `src/routes.tsx`). [fact]
- The route is **`/dashboard/you`**, not `/you`: `AIAstra_WEB/src/routes.tsx:148` `<Route path="you" element={<YouPage />} />`,
  under `/dashboard` (`:125-150`). `/`, `*` and the end of the welcome wizard all redirect there (`:70`, `:123`, `:179`). [fact]
- The main checkout `C:\Users\Owner\Documents\work\AIAstra_WEB` is on `release-candidate-staging` (8dd2a55). That branch
  has **no** "Your reading" tab: `src/pages/you/` holds only `YouPage.tsx` + test, and YouPage renders `AreaBoardView`
  alone. [fact]
- The current code is **`develop` (70ae27f)**, checked out in the worktree
  `C:\Users\Owner\Documents\work\AIAstra_WEB-known-bugs`. All web paths below are from that worktree (same paths in the
  repo). `feat/self-reading-oracle-veil`, `feat/personalize-v2`, `feat/board-quota` sit at 9f6b89d, already in develop. [fact]
- "Choose your dasha" exists on **no** local or remote branch of the web repo (`git grep` over every ref, and `git log -S`
  over all history: nothing). The sheet's heading is **"Choose your clock"** (`SelfReading.tsx:288`), and the web strips
  the word "dasha" from every clock label (`SelfReading.tsx:57-59`). So the screen you saw is either an older/other
  build or a paraphrase. [fact for the code; inf for the cause]

## 1. Page structure

Files:
- `src/pages/you/YouPage.tsx:69-71`: `YouPage` = `<AreaBoardView cfg={YOU_CONFIG} />`. `YOU_CONFIG` (`:39-67`) holds the
  title "You", the board question `self.focus` (`:49-61`), sub-area names (`:11-20`), and `extraFirstTab`
  `{ id: 'reading', label: 'Your reading', render: () => <SelfReading /> }` (`:66`). [fact]
- `src/components/AreaBoardView.tsx` (1282 lines): the shared You/Love board shell. [fact]
- `src/pages/you/SelfReading.tsx` (639 lines): the "Your reading" tab (the nine panels). [fact]
- `src/pages/you/OracleWait.tsx`, `src/pages/you/readingMarkdown.tsx` (inline markdown for Oracle prose). [fact]
- APIs: `src/lib/areaApi.ts` (`GET /api/area/self`), `src/lib/selfReadingApi.ts` (`GET /api/self/reading`,
  `POST /api/self/reading/confirm`, `PUT /api/self/clock`). [fact]

Render order on `/dashboard/you` (AreaBoardView `:395-623`), top to bottom: [fact]
1. Header: gradient title "You" (`:399`), `ReadingStamp` "Made X · Good until Y · Opening it again before then uses no
   question" (`:400`, `components/ReadingStamp.tsx`), `BoardAsk` icon (`:402`).
2. Board question card when `ask` is true: "What are you most working on for yourself?" with badge
   `self.focus · Companion Fact Selector` (`:453-472`).
3. **Tone card** (the "state" panel, `:474-513`), see §2.
4. Page tab strip (`:515-522`): **Your reading** (default, `:368`) · Now · What holds you up · What presses · Ahead ·
   Looking back · Your questions (`:439-447`). Plus a Focus/Time-frame filter bar on every tab except Your reading
   (`:524-568`).
5. The chosen page (`:571-597`). On Your reading: SelfReading.

Where the area list (In short … This year) comes from: **the API payload**, not the web. SelfReading renders
`reading.panels` in server order and uses `p.title` as the chip/tab label (`SelfReading.tsx:186`, `:236-238`,
`:261-263`; header comment `:7` "Panels render in the order the server sends them"). [fact] The titles and order are
hard-coded on the server: `AIAstra_Server/src/reading/self/service.ts:84-93` (`PANEL_META`), `:149`
(`DIAGNOSIS_TITLE = 'In short'`), `:146` (`PANEL_ORDER = [...SELF_PANEL_IDS]`). The web type mirrors it
(`selfReadingApi.ts:67-68`). [fact]

Layout: **panels, not a stacked scroll, inside Your reading** (doc 45 rule 11 is followed there). Phone/tablet
(`< lg`): a chip row (`SelfReading.tsx:235-241`), a CSS scroll-snap swipe carousel (`:242-250`, `snap-x snap-mandatory`,
one panel per slide, `onScroll` syncs the chip `:198-203`) and dots (`:251-255`). Desktop (`lg`): vertical tab list in
3 of 12 columns, the panel in 9 (`:259-272`). [fact]
But the **page as a whole is still a stack** above that: header + question card + tone card + tab strip all sit above
the reading, so on a phone the first screen is the tone card and the reading starts below the fold. [fact for the
order; inf for the fold] Inside a panel, "Your chapters" stacks three chapter cards vertically on phone
(`:556`, `flex-col lg:flex-row`), and an Oracle area card is headline + 2-4 paragraphs + dates table + actions, which
can be a long scroll inside one panel (`:469-518`). [fact; length inf]

## 2. The top "state" panel (tone card)

- Component: inline in `AreaBoardView.tsx:474-513` (`data-testid="tone-card"`), not a separate file. [fact]
- Data: `GET /api/area/self` (`areaApi.ts:150-179`) → `board.tone` (`tone`, `date`, `confidence`, `families[]`),
  `board.supports[0].text`, `board.pressures[0].until`, `board.ahead[0]`. Not from `/api/self/reading`. [fact]
- What each line is: [fact]
  - "◇ Easing": `TONE_ICON` + `TONE_WORD[board.tone.tone]` (`:35-36`, `:477-478`).
  - "self.activation · Present Tone Consensus": **hard-coded badge** `{cfg.area}.activation · Present Tone Consensus`
    (`:480-482`), shown to every user, no staff gate. **Internal technique id leaks.**
  - "You're coming out of it. From 1 Dec 2026, a better time to start.": `cfg.headline` → `youHeadline`
    (`YouPage.tsx:23-37`), web-side wording from `tone.tone` + `tone.date`.
  - "Your chart is divided on this.": `CONFIDENCE_LINE.split` (`:37`, `:485`).
  - "Timing Clocks 3 supporting · 2 testing of 7 clocks": vote counts from `tone.families` (`:448-449`, `:488-493`).
  - "Core Strength …": `board.supports[0]?.text` or a stock line (`:494-497`).
  - "Key Horizon Primary pressure eases by 12 Dec 2026": `board.pressures[0].until`, else `ahead[0]` range (`:498-507`).
  - "Why we think so": opens a sheet listing each family's vote in words (`:510-512`, `:599-621`; `FAMILY_WORDS` `:38-46`).
- Rule check: **breaks** "digested words, no chart terms on a first screen" and doc 62 "No tone badge, no vote counts"
  (62 says that for the reading card, the same spirit applies): technique id, "Present Tone Consensus", "Timing Clocks",
  vote counts "3 … 2 … of 7 clocks", "Core Strength", "Key Horizon", "Primary pressure". [fact for the strings; the
  rule is Sachin's]
- The same badge pattern repeats across the board's other pages: `self.affliction · self.activation` (`:267`, `:588`),
  `self.activation · Lead Timing Window` (`:664`), `self.promise · self.activation` (`:749`), `self.activation · {id}`
  (`:1033`), `self.activation · Multi-Clock Topic Windows` (`:1267`), "Timing Clocks Aligned (n of m)" (`:1235`),
  graha/bhava labels such as "Shani (Endurance & Discipline Significator)", "8th Bhava (…)" (`:106-131`),
  `SYSTEM_CLOCK_NAMES` "Main Period Clock (Vimshottari)" (`:50-62`). [fact]
- The tone card does not change when the clock is switched (the area board never reads `kundli.preferred_dasha`; only
  `src/reading/self/service.ts`, admin routes and the catalog do). So the top card and the reading under it can tell
  two different time stories. [fact for the read path; inf for the mismatch]

## 3. The clock selector ("Choose your clock"; seen as "Choose your dasha")

- Component: inline in `SelfReading.tsx:284-316` (`data-testid="self-clock-sheet"`), a bottom sheet on phone, centred
  modal on `sm+`, dark `bg-[#141233]`, close ✕ (`:289-291`), click-outside closes (`:285`). [fact]
- Opened from: the line above the panels "Read on your {label} clock · Change" (`:214-219`). [fact]
- List: `reading.clock.choices` from the server (`:294-305`); the server builds it as the running clock, the applicable
  conditional systems, the confirm systems, then **every system with stored periods**
  (`AIAstra_Server/src/reading/self/clock.ts:34`), labels from `CLOCK_LABEL` (`src/reading/self/words.ts:102-148`;
  unknown ids are title-cased from the id, `:152`). That is why the list is long (up to ~40 systems). "Let your chart
  choose" appears only when the current reason is `preferred` (`:306-312`). [fact]
- Explanation of each system: **none**. Only the label; no line on what a system is for, when it applies, or which one
  the chart chose and why (`clock.reason` is not shown). [fact]
- What it posts: `PUT /api/self/clock { system }` (`selfReadingApi.ts:241-247`). Server writes
  `kundli.preferred_dasha` (`src/reading/self/service.ts:733-740`, route `src/routes/selfReadingRoutes.ts:85-98`). [fact]
- Rebuild: yes. `chooseClock` closes the sheet, awaits the PUT, then `reload()` re-fetches the whole reading
  (`SelfReading.tsx:204-209`, `:148-153`). Panel cache keys include the clock (`service.ts:355`
  `digestVersion …|clock=${clock.system}`) and the Oracle's cache key includes it (`src/reading/self/oracle.ts:284`
  `dashaHorizonKey`), so a new clock means new panels and a **new background Oracle synthesis (a paid model call)**.
  [fact for keys; paid-call per switch is inf from the keys]
- Billing: a fresh synthesis is charged via `chargeBoard(userId, board, asOf)` (`src/reading/self/buildEvent.ts:154-155`),
  keyed per board per day (`src/billing/questionGate.ts:211-218`), so the person pays at most one question per board
  per day, but every distinct clock tried costs a model run. [fact for the code; cost per run inf]
- Confirmation / quota warning: **none**. No "this will rebuild your reading", no question-count warning, no
  cost line. The PUT's result is ignored (a `false` still reloads, no error shown). [fact `:204-209`]
- Logging: client `track('chip_select', 'you', 'clock_<system>')` (`:205`); server: `withAgentRun` row for the clock
  step on the next read (`service.ts:289-296`) and `reading_build_done` log line in the build (`buildEvent.ts:157`).
  No audit row for the switch itself. [fact]
- Side effect: `preferred_dasha` is per kundli and `getBoardReading` serves self, love and work
  (`service.ts:268-277`), so switching on You also switches the Love and Work readings' clock. Nothing tells the
  person. [fact for shared read; inf that it is unintended]

## 4. Personalisation inputs

Birth details (`/signup/details`, `src/Auth/BirthDetails.tsx:44-58`): DOB, time, country, city, **gender**
(`male | female | prefer_not_to_say`, `src/Auth/fields/BirthFields.tsx:59-63`, `src/Auth/api.ts:373`), language,
referral code. Stored by GraphQL `completeProfile` (`src/Auth/api.ts:406-412`). [fact]

Welcome / Personalize wizard (`src/pages/welcome/WelcomeWizard.tsx`; opened at `/welcome` after signup,
`routes.tsx:122-124`, and as a modal from TopNavigation "Personalize" `src/pages/TopNavigation.tsx:61-110`): six steps,
`STEPS` `:28-125`, each answer saved per step via `PUT /api/profile/facts` (`saveFacts`, `src/lib/profileApi.ts:21-24`,
called in `next()` `:165-178`, save at `:174`) into `person_facts`. Each question shows a technique badge (`QUESTION_TECHNIQUE_BADGES` `:17-25`,
rendered `:267`), e.g. `self.activation · self.promise · Focus Priority Weighting`,
`love.activation · love.promise · 7th Bhava & Navamsa Context`: **internal ids and chart terms on an onboarding
screen.** [fact]

| Step | Fact key | Options | Read by `/you`? |
|---|---|---|---|
| 1 A photo of you | photo (`POST /api/profile/photo`, `SelfieStep.tsx`), `wizard.selfie` | camera/upload/skip | no [inf: not in area or reading code] |
| 2 Where you are | `place.current` | use location / typed city | not by You (Lucky times) [inf] |
| 3 Work | `work.status`, `work.level` | 5 + 8 options | no |
| 4 Love | `love.status` | single … complicated | no (Love board) |
| 5 Family | `family.children` | none / expecting / young / grown | no |
| 6 What matters now | `self.focus` (multi, up to 3, comma list) | career, money, love, family, home, learning, travel, health, creativity, spirituality (`:111-125`) | **yes, by the board only**: picks the lead sub-area (`AIAstra_Server/src/reading/area/self.ts:60-80`); not by Your reading |

Not collected anywhere in the web: pronouns, user type (Novice / Intermediate / Expert), goals beyond `self.focus`,
"what problem did you come with", mood. [fact: grep over `src` for gender/pronoun/sex/experience/novice/expert/mood/goal
hits only the gender field and AskModal]
`/api/self/reading` (the nine panels and the Oracle) reads **no** person facts except the answers to its own confirm
question (`self.confirm.<claimId>`, `src/profile/facts.ts:26`; passed to `runSelfOracle` `service.ts:539`). Gender is
not used by the Self reading (no match under `src/reading/self/`). [fact]

Inconsistency: the board's own `self.focus` question (`YouPage.tsx:49-61`) is single choice with
career/learning/family/creativity/spirituality/health/decline, while the wizard asks for up to three from a different
ten. Answering on the board overwrites the wizard's three. [fact for options; overwrite inf from `saveAreaFact`
`areaApi.ts:186`]

## 5. Streaming and states

- `/dashboard/you` does **not** use `GET /api/dashboard/sections-stream`. The NDJSON reader is
  `streamDashboardSections` (`src/lib/pageTelemetry.ts:188-260`), used only by `ChartsSection`, `MantrasSection`,
  `RemediesSection`, whose routes now redirect away (`routes.tsx:140-143`). [fact]
- The board (`AreaBoardView.tsx`): in-memory cache per token+area (`areaApi.ts:115-140`) so a revisit draws at once;
  first load and 202 both show `LoadingVeil` over an empty glass panel (`:409-420`), the second with the note "Your
  chart is still being prepared. This page will update by itself."; polls every 30 s **up to 10 times, then stops
  silently** and the veil stays forever (`:386-393`). Error: "This page did not load." + Retry (`:423-431`). 404
  no_kundli / unavailable messages (`:421-422`). [fact]
- The reading (`SelfReading.tsx`): first load → skeleton "Reading your chart…" (`:155`); 202 `stage:'chart'` → "Your
  chart is still being prepared…" polled every 30 s; 202 `stage:'reading'` or 502/503/504 → skeleton "Your reading is
  being written. It usually takes a minute or two…" polled every 10 s (`:36`, `:133-146`, `selfReadingApi.ts:216-220`);
  after 6 min (`MAX_WAIT_MS` `:38`) → "Your reading is taking longer than usual." + Retry (`:157-165`). Error → "Your
  reading did not load." + Retry (`:171-179`). [fact]
- Oracle pending (code panels ready, synthesis not): each panel sits under `OracleVeil` → `LoadingVeil` with a
  rotating line every 4.5 s (`OracleWait.tsx:40-66`, `LINE_MS` `ReadingStagesPanel.tsx:10`), plus `OracleWaitLine`
  above the panels (`SelfReading.tsx:221`); after 6 min the veils lift and "Check again" shows (`:222-229`). [fact]
- Stale data: no stale marker. The board's `ReadingStamp` says "Made … · Good until …" (header), and the reading's
  `builtLine` "Built 7 Nov 2026, next check 1 Jan 2027" sits at the bottom (`:278-282`): **two different build stamps on
  one page**. [fact]
- Loading overlay: `src/components/LoadingVeil.tsx` (one of four drawn house-chart illustrations, random quip line,
  theme aware `:30-34`; server doc `docs/loading-overlay/01`). [fact]
- Timings visible to the person: under "Chart details", `{panel.technique} · {panel.ms} ms · cached|fresh`
  (`SelfReading.tsx:414-416`), e.g. `self.reading.chapters · 5.3 ms · fresh`. [fact]

## 6. Card contract (doc 62 + doc 65 additions) vs what renders

`PanelView` `SelfReading.tsx:321-421`. Two card modes: **Oracle area** when `areaStatus === 'ok'` (doc 65), else
**code lines** (doc 62). [fact]

| Contract field | Rendered? | Where |
|---|---|---|
| `title` | yes (h3, chip, tab) | `:324`, `:238`, `:263` |
| `headerRange` → "Always" / "This year: …" / "True until …" | yes, code mode | `:76-81`, `:354` |
| `area.validUntil` + `area.certainty` → "True until X · Strong" | yes, Oracle mode | `:462-466` |
| `note` (body's not-medical line) | yes | `:356-360` |
| `lines[].text` | yes, code mode; moved under Chart details in Oracle mode | `:364-368`, `:385-391` |
| `lines[].range` (when ≠ header) | yes | `:523`, `:530` |
| `lines[].certainty` (timing only, not fact) | yes | `:93-99`, `:532` |
| `lines[].detail`, `claimIds` | under Chart details | `:535`, `:540-548` |
| `vetoed[]` | under Chart details, struck through, with `claimId · rule` | `:402-413` |
| `technique`, `ms`, `cached` | under Chart details | `:414-416` |
| `purview[].text` (affecting panel) | under Chart details "Adjusted by a whole-chart check: …" | `:101-104`, `:397-401` |
| `area.headline`, `paragraphs`, `dates` (table, "now" pill), `actions` | yes | `:469-518` |
| `area.evidence` | under Chart details, mono | `:392-396` |
| `plan.summary/steps/calendar` (doc 64) | yes, only in code mode | `:371`, `:424-457` |
| `chapters[]` (+ `sub`, `nextSub`, confirmations) | yes; "Confirmed by Vimshottari and Chara" on the face | `:68-71`, `:553-604` |
| `question` | yes, Yes/Partly/No/Skip | `:276`, `:606-638` |
| `builtLine` | yes, bottom | `:278-282` |
| empty `lines` → "Not enough in your chart to say this with confidence." | yes | `:336-344` |
| `status: 'failed'` → "This part could not be read just now." | yes | `:326-334` |
| `lead` | **ignored** | type `selfReadingApi.ts:110` |
| `claims[]` | **ignored** (only reached through lines' `claimIds`) | `:112` |
| `status: 'partial'` | **not distinguished** from ok | `:111` |
| `oracle.text` (whole narrative) | **ignored** | `:153-158` |
| `oracle.status` 'failed' / 'budget_exceeded' | **no message**; panels fall back to code lines silently | `:136`, server `service.ts:607-608` |
| `clock.reason`, `clock.confirming` | **ignored** | `:18-24` |
| `gaps`, `audit`, `dossierId`, `asOf` (except "now"), `digestVersion` | not rendered (by design) | `:175-182` |

Confidence: words only (Strong / Likely / Possible), no score. No per-card "why" beyond Chart details. [fact]

## 7. Design-system facts for a mock-up

- Styling: Tailwind 3 with **no theme extension** (`tailwind.config.js:1-12`, `darkMode: 'class'`), plus
  `@tailwindcss/typography`. [fact]
- Fonts: **no custom font**; Tailwind's default system sans stack. No Google Fonts link in `index.html`. [fact]
- Colour: no design tokens / CSS variables for colour; colours are utility classes (`text-white/60`, `purple-300`,
  `purple-500/15`, `bg-[#141233]` sheets, gradient title `from-purple-400 to-pink-400`). Backgrounds: `.app-sky`
  `#0b0a1f` night sky, `html/body #05060f` (`src/index.css:6-24`); `.main-panel` (`:431-435`). [fact]
- Cards: `.glass` (clear dark glass, 5 px blur, inset highlight, text shadow, `src/index.css:437-450`), `.glass-lift`
  hover rise (`:451-462`), `.glass-bar` for rails (`:463-467`). Panel class used by boards:
  `glass glass-lift rounded-2xl p-4 sm:p-5` (`SelfReading.tsx:32`, `AreaBoardView.tsx:28`). [fact]
- Light/dark: `src/lib/theme.ts` (System/Light/Dark, `localStorage` key `aiastra.theme`, only `/dashboard`, `/profile`,
  `/welcome` follow it, `:13-22`); `html.light` overrides in `src/index.css:476-530`; utility remaps generated into
  `src/theme-light.css` by `scripts/gen-light-theme.mjs` (do not hand-edit). `ThemeSwitch.tsx`, `ThemeScope.tsx`. [fact]
- Chips: `inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm` (`SelfReading.tsx:33`);
  selected `border-white/40 bg-white/15`, idle `border-white/10 text-white/60`. [fact]
- Carousel: no shared component; it is inline CSS scroll-snap + chip sync + dots, copied in `SelfReading.tsx:233-256`,
  `AreaBoardView.tsx:1095-1110` (Ahead) and `:1141` (Looking back), `pages/work/WorkPage.tsx`,
  `pages/timeline/LifeReadingDashboard.tsx`. Desktop vertical tabs `SelfReading.tsx:259-272`. [fact]
- Other reusable pieces: `components/LoadingVeil.tsx`, `pages/you/OracleWait.tsx`, `components/ReadingStamp.tsx`,
  `components/BoardAsk.tsx` + `AskModal.tsx`, `components/BoardTabBar.tsx` (bottom bar Today/You/Love/Work/Ask, behind
  `VITE_BOARDS_ENABLED`), `components/HeaderTabs.tsx`, `components/SideNav.tsx`, `components/UsageBar.tsx` (free-plan
  question count), `components/UpgradeCard.tsx`, icons from `lucide-react`. Sheets/modals: inline
  `fixed inset-0 … items-end … sm:items-center`, `rounded-t-3xl sm:rounded-3xl` (`SelfReading.tsx:285-286`). [fact]
- Touch targets: `min-h-[44px]` everywhere. [fact]

## 8. Defects and rule breaks

1. **Internal technique ids on screen for every user**: `self.activation · Present Tone Consensus` (tone card,
   `AreaBoardView.tsx:480-482`), `self.focus · Companion Fact Selector` (`:457-459`), and the badges on Now/Holds/
   Presses/Ahead/Questions (`:267`, `:309`, `:588`, `:664`, `:749`, `:1033`, `:1119`, `:1239`, `:1267`, `:1274`);
   wizard badges (`WelcomeWizard.tsx:17-25`). [fact]
2. **Chart terms and vote counts on the first screen**: "Timing Clocks 3 supporting · 2 testing of 7 clocks",
   "Core Strength", "Key Horizon", "Primary pressure" (`AreaBoardView.tsx:487-507`); "Read on your Vimshottari clock"
   (`SelfReading.tsx:215`); "Confirmed by Vimshottari and Chara" on the chapters face (`:572-576`); graha/bhava labels
   in finding detail (`:106-131`). [fact]
3. **Oracle area prose is told to carry chart terms**: the server prompt asks for "the chart terms and the classical
   rule named inside the prose" in `paragraphs` (`AIAstra_Server/src/reading/prompts/generated.ts:16`,
   `oracle/self-areas`), and the web renders `paragraphs` on the card face (`SelfReading.tsx:475-481`). Only the
   headline is "no chart term". [fact for both; that real output carries terms is inf]
4. **Engine names**: none found in the web strings audited; `redactEngineTerms` runs server side
   (`src/reading/self/oracle.ts:31`). [fact for grep; full output not checked]
5. **Clock switch has no confirmation, no explanation, no quota/cost line, ignores failure, and silently changes the
   Love and Work readings' clock too** (§3). Every new clock triggers a fresh paid synthesis. [fact / inf as marked]
6. **"Choose your dasha" heading and "… Dasha" labels are not in any branch**: whichever build showed them is not the
   current code (§0). Worth checking which build staging serves; `release-candidate-staging` has no Your reading tab
   at all. [fact for code; inf for staging]
7. **Stacked header above the panels**: question card + tone card + tab strip push the reading down; the modular-panel
   rule holds inside Your reading only. [fact for order; inf for fold]
8. **Two build stamps** (ReadingStamp at top, `builtLine` at bottom) with different dates/semantics. [fact]
9. **Board polling gives up silently** after 10 × 30 s; the veil never lifts and no Retry shows
   (`AreaBoardView.tsx:386-393`). [fact]
10. **Oracle failure is silent**: `failed` / `budget_exceeded` fall back to code lines with no word to the person
    (`SelfReading.tsx:136`, `:348`). [fact]
11. **Timings and internal ids under Chart details**: `self.reading.chapters · 5.3 ms · fresh`, claim ids, evidence
    keys `planet:D1.Ju`, vetoed `claimId · rule` (`SelfReading.tsx:392-416`, `:545`). Behind a tap, but visible to any
    user. [fact]
12. **Purview text may carry chart jargon** ("debilitated with a cancellation row (…)", "BPHS (neecha bhanga …)",
    `AIAstra_Server/src/reading/self/purview.ts:95`) shown as "Adjusted by a whole-chart check: …" under Chart details.
    [fact]
13. **`self.focus` asked two ways** with different option sets and single vs multi; the board's answer overwrites the
    wizard's (§4). [fact / inf]
14. **Personalisation the reading cannot use**: no user type, goals, problem-on-arrival, mood, pronouns; gender is
    collected but not used by the Self reading; `self.focus` does not reach Your reading. [fact]
15. **Tone card and reading can disagree** after a clock switch (tone card ignores `preferred_dasha`). [inf]
16. `oracle.text`, `panel.lead`, `clock.reason` never rendered (§6): the reason the chart picked a clock is lost.
    [fact]

None of these are filed in `docs/TODOS.md` by this audit (read-only brief); they need filing.

## 9. Admin repo: Self board runs

`C:\Users\Owner\Documents\work\aiadastra_admin` (branch `develop`):
- **Techniques Lab**, route `/techniques-lab` (`web/src/App.tsx:79`; `/research-lab` redirects to it with
  `source=synthetic`, `:92`). Page `web/src/pages/TechniquesLab.tsx` (header comment `:1-14`). [fact]
- Board tabs Self/Love/Work (`api/src/contract.ts:1517` `LAB_BOARDS`, `web/src/lib/lab.ts:4`); default board `self`
  (`TechniquesLab.tsx:986`). Builds sidebar from `GET /lab/dossiers?userId&board` (`web/src/lib/adminApi.ts:183`); open
  one `GET /lab/runs/:id` (`:184`); run one `POST /lab/run` (superadmin, `:185`); review right/wrong/unsure
  `POST /lab/runs/:id/review` (`:187`). [fact]
- Eight sub-tabs per build: Inputs, Flow, Purview, Linemen, Brief, Output ("What the person sees"), Audit, Cost
  (`web/src/lib/lab.ts:9-18`); steps `bundle … auditor` (`contract.ts:1520`). A "board" centre tab shows the newest
  whole-board build with its clock and trigger (`TechniquesLab.tsx:865-911`). Compare two builds by claim id. [fact]
- Also `web/src/pages/ResearchLab.tsx` (research runs, hydrate/verify, `adminApi.ts:162-175`), now reached only through
  the redirect. [fact]
- This is where a designer can see real Self board outputs per person and per clock without the web app. [inf]
