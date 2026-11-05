# 42 — The life-area reading: career and profession, the technique, the agents, and the dashboard

Status: plan, 2026-11-05. No code yet. Written after the Sumit week-by-week career charter (Oct 2026 – Dec 2028) was
built by hand from stored rows. It turns that hand method into a module: one life area, read through every stored layer,
cross-checked across dasha systems, and shown as a dated dashboard. Career is the first area; money, marriage and residence
follow as configuration, not new code.

Builds on: [10](10-subject-prompt-matrix.md) (subject matrix), [15](15-bucket-classifier.md) (buckets),
[26](26-reading-method-tiers.md) (tiers), [28](28-tithi-pravesh-transit-prashna.md) (annual chart and Tithi Pravesha
dasha), [29](29-life-timeline-v2-event-timing.md) (gates D, T, E and "one planet, one vote"),
[33](33-agent-curriculum-oracle-clarify.md) (readers R1–R15 and the Oracle),
[34](34-comprehensive-life-reading-from-radha-json.md) (comprehensive reading), [35](35-transit-ephemeris-cache.md) (shared
transit sky and the per-kundli overlay). The `transit-sky-preparation` and `transit-reading` skills hold the transit steps.

Rules that hold everywhere below: the engine is the only source of astrological data; Node only selects, intersects and
counts dates on engine rows and never derives a house, a lord or a sign; nothing a user reads names the engine or its
library; no Gemini call is made until Sachin says yes (key, count and cost stated first).

---

## 0. Answer first

1. **The technique is a frame, not a new astrology.** An area reading reads the same chart as the comprehensive reading,
   but through a fixed **sub-area map**: for career, the ranked sub-areas of §A.2, each with its own houses, houses
   counted from the 10th, karakas, divisional charts, Jaimini points, dasha signals, transit triggers and annual-chart
   checks. Knowing which sub-areas to look at, and what each one reads, is most of the skill.
2. **Which sub-areas, in what order, comes from what people ask** (§A.2.1): the ranking is evidence-based, so the first
   build covers the questions that make up most of the demand.
3. **Dates come from code; meaning comes from agents.** A deterministic window engine (no LLM) intersects every stored
   clock with the transit overlay per sub-area and counts how many *independent* clocks agree. Agents only read the
   promise, explain the windows and write the words. A date no stored row supports is never shown.
4. **Eight agents.** Seven readers from doc 33 (promise, varga, Jaimini, dasha, transit, annual, remedy) run in parallel
   on a career slice of the data, and the Oracle writes the cards. A ninth (the ledger reader) joins once the person has
   marked past events. §B.6 has what each reads and returns; no call runs before Sachin's yes.
5. **The dashboard** is a Profile tab, "Career map": next-90-days cards, 3/6/9/12-month promises with a score and a clock
   count, a swim-lane timeline (one lane per sub-area, major and minor events, dasha and slow-planet bands on top), a
   week view with day grades, and a window drawer that shows why, how many clocks agree, what confirms it early, what to
   do, and "Happened / Not yet / Wrong date" buttons that feed the ledger. Mockup:
   [42-career-dashboard-mockup.html](42-career-dashboard-mockup.html).
6. **Recommendation:** build the area lens on top of the timeline v2 engine (doc 29) as sub-markers of the `career`
   marker, ship it first with deterministic windows and template text (Phase 1, no LLM cost), then add the agents
   (Phase 2) after Sachin approves the spend. Part C has the verdict table.
7. **The board leads with the present** ([doc 44](44-career-board-storm-and-fair.md)): five states decided by seven
   voting dasha families checked against D1, D10, D9 and D60 (doc 43 §8). A storm opens an ER-like board, fair weather
   a resort-like board, and a split verdict asks the person first.

---

## Part A — The technique

### A.1 How the Sumit career charter was made (the hand method, step by step)

This is the method used on 2026-11-02 to 2026-11-04. Each step names the stored rows it read.

| # | Step | Stored rows read | What came out |
|---|---|---|---|
| 1 | **Frame the area.** Name the houses, lords, karakas and points for career from the stored verdicts. | `varga.d1`, `bhava`, `house_counts`, `karaka.chara`, `arudhas`, the four stored readings | 10th lord Mercury own sign in the 10th (Bhadra), AmK, A10, the 9th stellium, Rahu as AK in the 12th |
| 2 | **Read the promise per sub-area.** For each sub-area: is it promised, how strongly, in what form? | `varga.d10`, `varga.d9`, `varga.d2`, `varga.d4`, `dignities.*`, `strength.shadbala`, `strength.vimsopaka`, `ashtakavarga`, `yogas`, `argala.d1`/`d10` | "One visible elevation per Jupiter cycle"; "relocation promised, but in 2029–31"; "rise inside a large institution, not a start-up" |
| 3 | **Find the career clock.** Which conditional dasha applies to this chart and is strongest for the 10th? | `dasha.applicable`, then that system | Chathuraaseethi Sama (Sun MD; Sun/Mercury 23 Jul 2027 – 9 Apr 2029) |
| 4 | **Lay every clock on one calendar** at three levels where stored. | `dasha.vimsottari.l3`, `dasha.yogini.l3`, `dasha.tithi_ashtottari.l3`, `dasha.karaka.l3`, `dasha.chathuraaseethi_sama`, `dasha.narayana`, `dasha.chara`, `dasha.sudasa`, `dasha.drig`, `dasha.kaala` | One table of sub-periods per clock for the span |
| 5 | **Score each sub-period per sub-area.** Does the running lord signify the sub-area (owns, occupies, karaka, AmK, A10)? Same planet in two clocks counts once. | rows of steps 1–4 | Which months each sub-area is on, off or tested |
| 6 | **Annual charts.** Does each year's Tithi Pravesha chart, its D10, its own Tithi Ashtottari dasha, Mudda and Patyayini confirm or contradict? | `annual.tithi_pravesha` (and `divisional_chart_factor=10`), `annual.tithi_pravesha_dasha`, `annual.mudda`, `annual.patyayini`, `annual.sahams`, `annual.varsha` | "2027: a rise, not an exit"; "2028: the public sees him, income grows, a cut alongside" |
| 7 | **Slow transit gates.** Jupiter, Saturn, Rahu and Ketu by house from lagna and Moon, exact contacts on natal points, double transit on the 10th and its lord, stations. | shared sky + kundli overlay (doc 35) | Jupiter in the 10th 26 Nov 2027 – 28 Feb 2028 and 24 Jul – 26 Dec 2028; exact on Mercury 8 Oct 2028 |
| 8 | **Intersect.** A window is where a signifying sub-period and a trigger overlap. Count the independent clocks that agree; claim a date only at two or more. | steps 5–7 | Promotion paper 28 Feb – 7 May 2028 and 24 Jul – 12 Oct 2028, nine clocks |
| 9 | **Fast planets and the daily layer.** Sun and Mercury crossings, Mars contacts, Mercury stations, lunations, eclipses; then Moon house, tara, tithi and weekday per day, graded A/B/C/D. | shared sky (day step) + overlay | 118 weekly rows with act days |
| 10 | **Verdict and remedies.** Each window gets for minus against and a score out of 100. Remedies are tied to the planets of the sub-periods that need them. | all of the above | Horizon promises (3/6/9/12 months), sub-area answers, weekly focus lines, remedies |

What was wrong in the hand method, and what the module fixes:
- Step 9's day layer was counted by a script from stored positions because the daily overlay had not been pulled. The
  module reads it from the overlay only (doc 35, `npm run transits:overlay -- --step day`).
- Steps 5 and 8 were judged by the writer. The module does them in code with fixed rules (§A.4), so two runs give the
  same dates.
- The sub-areas were chosen from the questions that one person asked. The module uses the ranked map of §A.2.

### A.2 The career sub-area map (the heart of the technique)

#### A.2.1 What people ask, ranked

The ranking, its evidence and its sources are in [doc 43 §2](43-career-reading-technique.md). In short, seventeen
sub-areas in three tiers, built in tier order:
- **Tier 1** (most of what people ask): getting a job; job change; promotion and growth; job security (layoff, firing,
  resignation, AI); work abroad and relocation for work; career direction.
- **Tier 2:** government job; job or own business; salary and income; boss, colleagues and politics; interviews and
  exams; transfer and work travel.
- **Tier 3:** recognition; leading a team or building a department; career break, restart, retirement; skills and
  study; mentor and sponsor. Luck at work is a modifier on every window.

Our own logs hold too few questions to rank (four traced, none bucketed, 2026-11-05); re-rank at 500 career questions.

#### A.2.2 What each sub-area reads

Houses are from the lagna unless marked. "From the 10th" is bhavat bhavam: the 12th from the 10th (the 9th) ends a job;
the 2nd from the 10th (the 11th) is what the job pays; the 3rd from the 10th (the 12th) is travel for work; the 6th from
the 10th (the 3rd) is the job's own competition and effort; the 8th from the 10th (the 5th) is a break in it. The same
rows are checked again from the Moon and, for status, from the Arudha lagna.

What each sub-area reads (promise, blockers, denial, clocks, triggers, annual check) is the focus card of
[doc 43 §4](43-career-reading-technique.md); which divisional charts, dasha systems, annual layers and transit layers are
read, and with what weight, is doc 43 §3; the bad-period cluster and the layoff, firing and resignation signatures are
doc 43 §5 and §6; what "no job end in this period" can and cannot claim is doc 43 §7.

The map lives in config (`src/reading/area/subareas.career.ts`), one row per sub-area, with engine field paths only, so
an astrologer can review it without reading code.

### A.3 How this differs from the comprehensive all-house reading

The comprehensive reading (doc 34) and the area reading share the same foundation: the backbone reading (lagna, Moon,
lords, strength, yogas) is read once and cited by both. They differ in six ways.

| | Comprehensive reading | Area reading (career) |
|---|---|---|
| **Frame** | All twelve houses, the six questions of doc 34 §1 | One area split into ranked sub-areas, each with its own houses, houses counted from the 10th, karakas and points |
| **Depth of vargas** | D1, D9 and the varga of each house, one pass each | D10 read house by house (its 1st, 2nd, 4th, 6th, 7th, 8th, 10th, 11th, 12th), plus D9, D2, D4, D24 only where a sub-area points |
| **Derived houses** | Rarely | Always: from the 10th, from the Moon, from the Arudha lagna |
| **Timing** | Decades and years (mahadasha and antardasha), the main windows | Months, weeks and days: three dasha levels, every applicable clock, annual chart months (Mudda, Patyayini), daily overlay |
| **Proof rule** | A finding at three layers, a pointer at one or two (doc 33) | The same, plus a date needs two or more independent clocks and a trigger; a major event needs three clocks, a slow trigger and an annual chart that does not contradict |
| **Output** | Narrative, essence table, windows | Dashboard: dated events per sub-area, major or minor, support or test, a score, a clock count, act and hold days |

The main thing is the sub-area map. A comprehensive reading asks "what does the 10th house say?". An area reading asks a
dozen narrower questions (when will I get a job, will I change job, get promoted, be paid more, be laid off, be moved
abroad, build a team) and answers each from its own houses and its own timing.

### A.4 Cross-validation across dasha systems (fixed rules, in code)

1. **Clock families.** Clocks are grouped so that copies do not count twice:
   - *Graha clocks:* Vimshottari (L3), Yogini (L3), Tithi Ashtottari (L3), and the conditional dashas `dasha.applicable`
     names for the chart (for Sumit, Chathuraaseethi Sama).
   - *Rasi clocks:* Narayana (status and events), Chara, Sudasa (status and wealth), Drig (only for mentor and luck).
   - *Jaimini karaka clock:* `dasha.karaka.l3`.
   - *Annual clocks:* the Tithi Pravesha chart, its own Tithi Ashtottari dasha, Mudda, Patyayini.
   - *Transit:* the slow gates (Jupiter, Saturn, nodes) and, for days only, the fast layer.
2. **Signification** per sub-area and planet is read from engine fields (lordship, occupation, karaka, AmK, arudha) as in
   doc 29 §3.1, capped at the three strongest sub-areas per planet so a running lord cannot "mean everything".
3. **One planet, one vote** (doc 29 §3.2): if Mercury runs in three graha clocks in the same month, it is one vote.
4. **Gates.** D (a signifying period), T (a trigger) and E (a period edge), scored as in doc 29 §3.5.
5. **Grade.** For each sub-area and window:
   - **Major event:** D in at least two clock families including Vimshottari or Narayana at AD level, a slow T (double
     transit or an exact slow contact), an edge within the window, and the annual chart not contradicting.
   - **Minor event:** D in one family plus any T, or two families without a slow T.
   - **Below that:** not shown as an event; it can colour the week view.
6. **Window, peak, days.** The window is the intersection. The peak is the exact contact or the edge date. Act days
   inside the window come from the overlay's daily grades. Every date carries its source row.
7. **Polarity.** Support or test, from doc 29 §3.3 (Jupiter supports; Saturn delivers when it signifies, tests otherwise;
   nodes test except on travel and foreign work). Job loss and gaps only show as a test.
8. **Score out of 100** = support minus test, scaled per chart (doc 29 §4 ranked bands), with the clock count beside it.

---

## Part B — The module

### B.1 Start: what exists today (facts checked 2026-11-05)

- **Stored per kundli** (`kundli_data`, checked on kundli 75b0d618): `varga.d1` … `varga.d144`; `dignities.*`,
  `aspects.*`, `relations.*`, `argala.*`, `arudhas.*` per varga; `strength.shadbala`, `.vimsopaka`, `.bhava`, `.harsha`;
  `ashtakavarga`; `yogas`; `doshas`; `karaka.chara`; `house_counts`; `reading_tables`; 43 dasha systems including
  `dasha.applicable` and level-3 tables for Vimshottari, Yogini, Tithi Ashtottari, Kaala, Karaka and Dwisatpathi;
  `annual.tithi_pravesha`, `annual.tithi_pravesha_dasha`, `annual.varsha`, `annual.mudda`, `annual.patyayini`,
  `annual.sahams` by year. 11 transit overlays are stored for the kundli; the daily overlay is not (TODO filed).
- **Timeline module** (`src/reading/timeline/`): markers (`markers.ts`: `career` = houses 10/6/1/2, karakas Su/Sa/Me/Ju,
  AmK, A10, GL, D10), signification, dasha months, convergence, calibration, ledger (`ledgerStore.ts`), routes
  (`src/routes/timelineRoutes.ts`: ledger CRUD, interview, past reading). Doc 29 v2 gates are partly built (P1b).
- **Ledger categories** for career are only `job.start`, `job.end`, `job.promotion`, `job.transfer`, `job.role_change`.
  There is nothing for salary, gap, work travel, relocation for work, recognition or team.
- **Web** (`AIAstra_WEB/src/pages/profile/ProfileTimeline.tsx`): the timeline tab shows the past reading and the ledger
  behind `VITE_TIMELINE_ENABLED`. There is no area view and no future dashboard.
- **Readers and Oracle** are specified in doc 33; the prompts are not all written.
- **The hand-made output** to match: `C:\Users\Owner\Documents\Readings\Sumit-career-week-by-week-2026-10-to-2028-12.docx`.

### B.2 End goal

A person opens Profile → **Career map** and, within a few seconds when built (under four minutes the first time), sees:
- the three dates in the next 90 days that matter most for work, each with one plain sentence;
- what the next 3, 6, 9 and 12 months promise for work, each with a score out of 100 and how many clocks agree;
- a timeline over up to 24 months with one lane per career sub-area, major and minor events marked, support and test in
  different colours, the running dasha periods and slow planets as bands on top;
- a week view with each day graded act, good, routine or hold;
- for any window: what, when, why, how many clocks agree and which, what would confirm it early, what to do, the remedy
  that belongs to it, and buttons to say whether it happened.

Nothing on screen is invented: every date has a stored row behind it, and a window with fewer than two agreeing clocks
is never shown as an event.

### B.3 Deliverable

Server (`AIAstra_Server`):
- `src/reading/area/subareas.career.ts`: the sub-area map of §A.2 as config (houses, derived houses, karakas, points,
  vargas, clock signals, triggers, annual checks, event class, rank), with engine field paths only.
- `src/reading/area/clocks.ts`: loads every stored clock for a span into one calendar of periods with family and level.
- `src/reading/area/windows.ts`: gates, one-vote rule, grading, polarity, intersection, peaks, act days (§A.4).
- `src/reading/area/horizons.ts`: 3/6/9/12-month summaries from the windows.
- `src/reading/area/build.ts`: the async build (§B.4), status stages, caching by inputs hash.
- `src/reading/area/agents/*`: the career slices for the readers and the Oracle prompt (Phase 2).
- `src/routes/areaRoutes.ts`: the API of §B.5.
- `prisma/migrations/<ts>_area_reading/`: tables `area_builds`, `area_windows`, `area_weeks` (§B.4).
- Ledger categories added: `job.salary_change`, `job.gap`, `job.travel`, `job.relocation`, `job.recognition`,
  `job.team`, `job.business_start`, `job.offer`, `job.visa`.
- Clarify chips (doc 33 §4.2) for the career `real_want` list, one per ranked sub-area, so a chat question lands on a
  sub-area and the chat answer can cite the dashboard window.
- Tests: unit tests for clocks, windows and grading; a golden test on the Sumit kundli that the promotion windows
  (28 Feb – 7 May 2028; 24 Jul – 12 Oct 2028) and the Jupiter 10th-house gates come out of code.
- Script: `scripts/area-reading.ts --kundli <id> --area career --from --to [--dry-run]` writing the dashboard JSON and,
  in Phase 4, the DOCX.

Web (`AIAstra_WEB`):
- `src/pages/profile/ProfileCareer.tsx` and `src/pages/area/*` (cards, lanes, week grid, drawer); a route and a tab.
- `src/lib/areaApi.ts`; i18n strings (English only for now).

Docs: this file; the mockup `42-career-dashboard-mockup.html`; the project skill `life-area-reading`.

### B.4 Backend: how it works when done

**Build flow** (one per kundli, area and span; async, following doc 31's background pull pattern):

1. `POST /api/area/career/build` checks the kundli belongs to the user and the span is at most 24 months. If a build
   with the same inputs hash is ready, it returns it (200). If one is running, it returns its id (202).
2. **Stage `data`** (budget 10 s): list the needed `kundli_data` keys (§B.6 table). Missing natal or annual rows are
   queued through the existing background pull (doc 31). Missing transit coverage: shared sky via `getSharedRange`,
   overlay via `pullKundliOverlay` (doc 35), at most 6 engine calls of 30 s each, one retry each. If a layer is still
   missing, the build continues and records a gap; the dashboard shows the gap line.
3. **Stage `windows`** (no LLM, under 2 s): `clocks.ts` → `windows.ts` → `horizons.ts`. Writes `area_windows` and
   `area_weeks`. Phase 1 stops here and fills text from templates.
4. **Stage `readers`** (Phase 2): the seven readers run in parallel, each with its slice (§B.6), 60 s timeout, one retry,
   at most 7 concurrent calls per build and 3 builds at once per account. A failed reader becomes a gap; the build goes on
   when at least the promise, dasha and transit readers returned.
5. **Stage `oracle`** (Phase 2, 90 s): writes the card text, horizon lines, weekly focus lines and remedies from the
   findings and the windows. It may not add or move a date; a validator rejects any date not in `area_windows` and the
   Oracle is re-asked once.
6. **Stage `ready`**: status written; the result is cached until the inputs hash changes (new ledger event, new stored
   rows, a new month).

**Tables** (written as migrations; applied for testing under the standing OK, never in production without Sachin):
- `area_builds`: id, kundli_id, area, span_from, span_to, status (`queued|data|windows|readers|oracle|ready|failed`),
  inputs_hash, gaps jsonb, error, timings jsonb, created_at.
- `area_windows`: id, build_id, subarea, class (`major|minor`), polarity (`support|test`), starts_on, ends_on, peak_on,
  score, clocks jsonb (family, system, period, lord, source key), triggers jsonb, annual jsonb, text (sealed), remedy
  (sealed).
- `area_weeks`: build_id, week_start, days jsonb (date, grade, Moon house, tara, tithi, source), focus (sealed).

Prediction text is sealed with the privacy helpers (`sealParam`, `openRow`) as in docs/privacy/02.

### B.5 API

| Method and path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/area/:area?kundliId=&from=&to=` | area `career` | 200 `{ build: {id,status,gaps,builtAt}, horizons[], subareas[], windows[], weeks[], bands: {dashas[], slow[]} }`; 404 when never built | 401, 403 (not your kundli), 404, 422 (unknown area) |
| `POST /api/area/:area/build` | `{ kundliId, from, to }` | 202 `{ buildId }`, or 200 with the ready build | 409 (running, returns id), 422 (span over 24 months), 429 (quota) |
| `GET /api/area/builds/:id` | | 200 `{ status, stage, gaps, error? }` | 404 |
| `POST /api/area/windows/:id/feedback` | `{ outcome: happened or partly or no or wrong_date, actualDate?, note? }` | 201 with the ledger event id | 404, 422 |

### B.6 The agents: how many, what each reads, what each returns

Dates, windows and grades come from code. Agents interpret. Each reader gets only its slice and returns doc 33's
`findings.v3` shape restricted to career sub-areas (`about` = the sub-area id).

| # | Agent (doc 33 id) | Reads (stored keys) | Returns |
|---|---|---|---|
| 1 | **Promise reader** (R2 + R5 + R6, career slice) | `varga.d1`, `bhava`, `house_counts`, `dignities`, `strength.shadbala`, `strength.vimsopaka`, `strength.bhava`, `ashtakavarga`, `yogas`, `argala.d1`, `aspects` | Per sub-area: promised or not, how strongly, in what form; the vocation card in full |
| 2 | **Varga reader** (R3) | `varga.d10` with `dignities.d10`, `aspects.d10`, `argala.d10`, `arudhas.d10`; `varga.d9`, `varga.d2`, `varga.d4`, `varga.d24` only for the sub-areas that name them | D10 house by house; confirm or contradict each promise |
| 3 | **Jaimini reader** (R4) | `karaka.chara`, `arudhas`, `argala.d1`, `dasha.narayana`, `dasha.chara`, `dasha.sudasa` | AmK and A10 story; status and perception; the rasi-clock meaning of each window |
| 4 | **Dasha reader** (R8 + R9) | `dasha.vimsottari.l3`, `dasha.yogini.l3`, `dasha.tithi_ashtottari.l3`, `dasha.karaka.l3`, `dasha.applicable` and the systems it names | The charter, objective and promise of each sub-period in the span; which sub-areas each one serves |
| 5 | **Transit reader** (R10, with R7's tara line) | shared sky + kundli overlay for the span; the window list from code | What each slow gate does to which sub-area; double transits; eclipses on the career axis |
| 6 | **Annual reader** (R11) | `annual.tithi_pravesha` (D1 and D10), `annual.tithi_pravesha_dasha`, `annual.mudda`, `annual.patyayini`, `annual.sahams`, `annual.varsha` | The year's theme for work; which months confirm or contradict each window |
| 7 | **Remedy reader** (R14) | the windows marked test and their lords; the benefic lords | Acts, days, donations and conduct per planet and window; nothing with an amount |
| 8 | **Oracle** (doc 33 §3) | the seven findings, the window table, the gaps | Card text, horizon lines, weekly focus lines, the drawer's "why" and "what to do" |
| (9) | **Ledger reader** (R15), Phase 3 | the person's marked past events | Which sub-area rules hit and missed for this person; feeds calibration |

**Why eight and not fifteen:** R1 (backbone) is read once per kundli and reused from the comprehensive reading; R7
(nakshatra) is folded into the transit reader's tara line; R12 (prashna) and R13 (other persons) are not part of a career
dashboard; R15 joins when there is a ledger.

**Size and cost** (estimates, to be measured; prices from doc 23 §1.1 at the time of the Phase 2 decision): each reader
about 15–30k input and 2–4k output tokens; the Oracle about 25k in and 6k out. One build per kundli per area per span;
rebuilt only when inputs change. No call is made before Sachin approves the key, the count and the cost.

### B.7 Frontend experience and UI/UX

Profile gets a **Career map** tab next to the timeline tab, behind `VITE_AREA_ENABLED`.

| State | What the screen shows | What it does |
|---|---|---|
| Never built | "Your career map is not prepared yet." Button "Prepare my career map". Span picker (12 or 24 months). | `POST …/build`, then poll `GET /builds/:id` every 3 s |
| Building | A stage line: "Gathering your charts" → "Laying out the periods" → "Reading the windows" → "Writing your map", with a progress bar by stage | Polls every 3 s; stops after 5 min and shows the failed state |
| Ready | The dashboard (below) | `GET /api/area/career`; no polling |
| Ready with gaps | The dashboard plus a line: "Some layers are not ready yet: daily sky. Day grades are hidden until they are." | |
| Failed | "We could not prepare your career map. Nothing was charged. Try again." | Retry repeats the build |

**The board starts from where the person is now** ([doc 44](44-career-board-storm-and-fair.md), rules in doc 43 §8).
A person in a hard stretch gets an ER entrance: this week, when it eases, what to protect, one calm action. A person in a
good stretch gets a resort entrance: the window, its closing date, what to ask for, act days. Calm stretches get a
neutral lobby. Long-range horizons sit lower, or behind "What comes after" in a storm. The sections below are the shared
cards; doc 44 §1–§2 sets their order per state.

**Shared cards** (see the mockup, which has a state switcher):
1. **Next 90 days**: three cards, each a date or date range, a one-line meaning, act or hold, and the sub-area tag.
2. **Horizons**: four cards (3, 6, 9, 12 months), each with what is promised, what blocks it, a score out of 100 and
   "6 of 9 clocks agree".
3. **Timeline**: one lane per ranked sub-area. Major events as tall bars, minor as short bars; green for support, amber
   for test. Top bands: the main dasha period and sub-period, the career clock, this year's chart period, Jupiter and
   Saturn by house. A "today" line. Zoom: 24 months, 6 months, 6 weeks.
4. **Week view**: a grid of weeks by weekday, cells shaded by day grade, act days marked; tapping a week shows its focus
   line.
5. **Window drawer** (tap any event): what, when (dates, peak), why (the clocks that agree, listed by family), what would
   confirm it early, what to do, the remedy, and "Happened / Partly / Not yet / Wrong date" buttons.
6. **Vocation card**: what suits, employee or own business, the kind of institution.

**Words:** plain English, no system names in headings ("main clock", "career clock", "this year's chart" instead of the
Sanskrit names; the Sanskrit name is shown small inside the drawer). The engine and its library are never named.

### B.8 Architecture

```
Web Career map ──GET/POST──> API (Express on Lambda) ──async invoke──> area build worker
                                                                         │
            ┌────────────────────────────────────────────────────────────┤
            │ stage data:    kundli_data rows ◄── background pull (doc 31) ◄── engine
            │                shared sky + overlay ◄── doc 35 jobs ◄────────── engine
            │ stage windows: clocks.ts → windows.ts → horizons.ts  (Node, no astrology, no LLM)
            │ stage readers: 7 readers in parallel (Gemini, Phase 2)
            │ stage oracle:  Oracle + date validator
            └──> Postgres: area_builds, area_windows, area_weeks (text sealed)
Ledger feedback ──> timeline ledger ──> calibration (doc 29 §5) ──> next build's weights
Chat question ──> Clarify real_want (career chip) ──> sub-area ──> answer cites the dashboard window
```

Boundaries: the engine supplies every astrological value; the window engine only selects and intersects; the readers
cannot change dates; the Oracle's output is validated against `area_windows` before it is stored.

### B.9 Ingredients

| Need | Who provides |
|---|---|
| Daily overlay and shared sky for the span | deploy session runs `npm run transits:sky` and `npm run transits:overlay` (engine credentials) |
| Migrations applied on the test database | agent, under the standing OK; production: Sachin |
| Gemini key, call count and cost approval for Phase 2 | Sachin |
| Astrologer review of the sub-area map (§A.2) | Sachin |
| `VITE_AREA_ENABLED` on staging | deploy session |
| Golden data: the Sumit DOCX windows | already stored |
| Libraries | none new; `docx` for the Phase 4 export is already used |

### B.10 Action steps in sequence

1. Pull the daily overlay and shared sky for the golden kundli (deploy session). Parallel with 2–4.
2. Write `subareas.career.ts` from §A.2; unit test that every field path exists in the stored rows of two kundlis.
3. Write `clocks.ts` (all stored clocks into one calendar, with family and level), with tests on the golden kundli.
4. Add the new ledger categories; update `ledgerCategories.ts` and the web ledger form.
5. Write `windows.ts` and `horizons.ts` (§A.4); golden test against the Sumit windows. Depends on 2 and 3.
6. Migration and `build.ts` (stages data and windows), `areaRoutes.ts`, route tests. Depends on 5.
7. Web: `areaApi.ts`, `ProfileCareer.tsx`, cards, lanes, week grid, drawer, with template text; component tests. Can start
   on the mockup's data in parallel with 5 and 6.
8. Phase 1 check on staging behind the flag; screenshots into `docs/screenshots/career-map/`.
9. Phase 2 (after Sachin's yes): the seven reader slices and the Oracle prompt, the date validator, Clarify chips; eval
   on three kundlis.
10. Phase 3: feedback buttons to the ledger, calibration per sub-area.
11. Phase 4: DOCX export of the area reading; the next areas (money, marriage, residence) as new config files.

### B.11 Development phases

| Phase | Steps | Ships | Check that closes it | Deferred |
|---|---|---|---|---|
| 0 Data | 1, 4 | daily overlay; new ledger categories | overlay rows for 2026–2028; ledger tests | |
| 1 Deterministic map | 2, 3, 5, 6, 7, 8 | the whole dashboard with template text; no LLM cost | golden test reproduces the Sumit promotion and Jupiter 10th windows; screenshots of each state | agent text |
| 2 Agents | 9 | readers and Oracle text, Clarify chips | eval on three kundlis; no date outside `area_windows` | calibration |
| 3 Calibration | 10 | feedback, per-person weights | ten marked past events change a build's ranking as expected | |
| 4 Export and areas | 11 | DOCX export; money, marriage, residence maps | one golden per new area | |

---

## Part C — Recommendation

Build the area reading as a **lens on the timeline v2 engine**: sub-areas as config under the `career` marker, dates by
code, agents for meaning, and ship Phase 1 with no LLM cost so the dates can be checked against the hand-made Sumit
charter before any text is generated.

| Option | Verdict |
|---|---|
| **Lens on timeline v2 (chosen)** | Reuses markers, signification, ledger and calibration; dates are repeatable; agents only word them |
| One long LLM reading per request (how the Sumit DOCX was made) | Rejected: dates depend on the writer, cost per request, cannot be calibrated |
| A separate area engine | Rejected: duplicates the timeline's dasha months, signification and ledger |
| Agents choose the dates | Rejected: not repeatable, and the "no invented dates" rule cannot be enforced |

## Open points for Sachin

1. Approve the ranked sub-area map of §A.2, or mark changes.
2. Phase 2 spend: the Gemini key and model, and the call count per build (8 calls), before any call runs.
3. Whether the career map is free, part of a plan, or a one-off purchase.
