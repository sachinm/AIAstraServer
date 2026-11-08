# BUILD-GAPS.MD — Prioritized Build Gaps & Astrological / UI Queue

**Last Updated**: `2026-11-08` (Claude Opus 5.5 BUILD-GAPS session, branch `feat/build-gaps-p2`)
**Related Handover Docs**:
- [`docs/handoff/2026-11-08-techniques-lab-self-love-work-handoff.md`](./docs/handoff/2026-11-08-techniques-lab-self-love-work-handoff.md)
- [`docs/reading-engine/63-dashboard-oracle-and-machinery-plan.md`](./docs/reading-engine/63-dashboard-oracle-and-machinery-plan.md)
- [`docs/TODOS.md`](./docs/TODOS.md)

---

## Status as of `2026-11-08T08:10` (end of Gemini session — hand-off to Claude Opus 5.5)

| Gap | Status | Where |
| :--- | :--- | :--- |
| `BG-01` doshas | **DONE** — the real bug was in `aiadastra_admin/api/src/labAdapter.ts` (hardcoded `doshas: []`), not `dossier.ts` (the server already sends every yoga with its `class`). Fixed by splitting on `class === 'dosha'`. Admin api tsc 0, vitest 162/162. | `aiadastra_admin` `develop` `436550b` (not yet on `release-candidate-staging`) |
| `BG-03` parallel family readers | **DONE** — `runSelfOracle` runs the uncached `family.*` readers with `Promise.all`, merging results in `activeFamilyIds` order. Server tsc 0. Not yet measured live. | `AIAstra_Server` `develop` (this commit) |
| `BG-02` 3-panel layout + all-user stored builds | **NOT STARTED** — spec + 7 test guards below | — |
| `BG-04`/`BG-05` cohort refresh + benchmark | **NOT STARTED** | — |
| `BG-06` lagna | **PARTLY DONE** — `lagna.seen_fit`: the lagna-to-AL fit, worded from the engine's class label on the AL's house. **Kept per doc 59 §4.1:** the Moon lagna stays and the Paka lagna stays out (doc 59 dropped it as the lagna lord's house named twice; BG-06's spec contradicted the reviewed design). 11th/12th from AL needs an engine nth-from table (TODOS 2026-11-08). | `feat/build-gaps-p2` |
| `BG-07` mind | **PARTLY DONE** — `mind.moon_support` (Sunapha / Anapha / Durudhara / Kemadruma from the engine's yoga rows), `mind.home_seen` (A4), `mind.ideas_seen` (A5). Paksha Bala, D24 and K64M wait on engine/digest fields (TODOS). | `feat/build-gaps-p2` |
| `BG-08` atma | **BLOCKED (engine)** — Ishta / Dharma / Palana Devata need counting from the karakamsa and AmK in D9, which Node may not do; D20 not in the default chart list (TODOS). | — |
| `BG-09` yogas | **DONE** — rows ranked within gifts and knots by the mean stored `avasthaMultipliers.effective` of their planets, ×1.5 when a planet runs the main or sub period; weight in the detail, "It is in play now." on running rows. | `feat/build-gaps-p2` |
| `BG-10` love | **PARTLY DONE** — manglik exceptions carried from the engine (`YogaRow.details`) and worded as eased, manglik regex fixed, `heart.venus_mood` (Lajjitadi). UL vs A7 needs an engine count (TODOS). | `feat/build-gaps-p2` |
| `BG-11` work | **PARTLY DONE** — `ground.service_or_business` (D10 h6 vs h7 by engine labels and occupants), `gain.sav_balance` (SAV h10:h11:h12). Houses from Saturn and from AL/A10 need engine nth-from tables (TODOS). | `feat/build-gaps-p2` |
| `BG-12` pipeline | **DONE** — a second purview pass over the diagnosis (rules on `diagnosis.*` now land), and the code auditor re-runs over the Oracle's merged lines (`mergeAudits`). | `feat/build-gaps-p2` |
| `BG-13` | **DONE** — `oracle/self.md` no longer names the engine; `units.test.ts` green. | `feat/build-gaps-p2` |
| `BG-14` (new, Sachin 2026-11-08) | **DONE (server)** — dashboards are AI synthesis, not word scans: the phrase bans are gone (engine names are redacted, never a reason to drop a line); dates are grounded when they fall in any stored window (activation at every level, year-chart dashas, the transit range and its spans), and a date outside them is kept and listed in `audit.dateGaps`; each panel carries `plan` (summary, dated steps, calendar) from the Oracle's `PANEL_PLAN` / `PANEL_CALENDAR` blocks; Oracle output cap 8000 (`SELF_ORACLE_MAX_OUTPUT_TOKENS`). Web rendering and day-table windows are in TODOS. Not run live (no paid call without Sachin's yes). | `feat/build-gaps-p2` |

> Note on the BG-01 line reference below: `dossier.ts:154-166` was wrong. Use `labAdapter.ts` as above.

---

## Priority 0 (`P0` — Immediate Bugs, UI/UX Layout & API Completion)

### `BG-01` — `Doshas present` Blank (`—`) in `Inputs` Tab
- **Where**: [`src/reading/self/dossier.ts:154-166`](./src/reading/self/dossier.ts)
- **Root Cause**: `buildDossier` hardcodes `doshas: []` and puts all `view.yogas().filter((y) => y.present)` (including doshas where `y.class === 'dosha'` such as `kala_sarpa` and `ganda_moola`) into `inputs.digest.yogas`.
- **Exact Fix**:
  ```ts
  yogas: view.yogas().filter((y) => y.present && y.class !== 'dosha').map((y) => y.id),
  doshas: view.yogas().filter((y) => y.present && y.class === 'dosha').map((y) => y.id),
  ```
- **Done Criteria**: `Inputs` tab in Admin Techniques Lab lists `kala_sarpa`, `ganda_moola`, etc. under `Doshas present` and excludes `class === 'dosha'` from `Yogas present`.

### `BG-02` — Full-Width `100vh` 3-Panel Layout + Collapsible `Stored Builds` Drawer + All-User Stored Builds
- **Where**:
  - `aiadastra_admin/web/src/components/Layout.tsx` (lines 37, 79)
  - `aiadastra_admin/web/src/pages/TechniquesLab.tsx` (lines 650–878)
  - `aiadastra_admin/api/src/contract.ts` (`LabRunSummary`, lines 1439–1454)
  - `aiadastra_admin/api/src/app.ts` (`/lab/dossiers`, lines 165, 347–350)
  - `aiadastra_admin/api/src/admin/lab.ts` (`listLabDossiers`, lines 192–196)
  - `aiadastra_admin/api/src/serverClient.ts` (`listDossiers`, lines 39, 137–147)
  - `aiadastra_admin/api/src/labAdapter.ts` (`summaryOf`, lines 310–328)
  - `AIAstra_Server/src/routes/adminLabRoutes.ts` (`GET /api/admin-lab/dossiers`, lines 197–209, and `POST /api/admin-lab/run`, lines 153–178)
- **What Is Needed**:
  1. **Widen Container (`Layout.tsx:37,79`)**: Replace `max-w-7xl` (`1280px`) with `w-full max-w-[1920px] px-3 sm:px-5`.
  2. **Ultra-Compact Top Bar (`TechniquesLab.tsx`)**: Single compact horizontal row for `Find (name, email, place or user id)`, `Person` dropdown (with `<option value="all">All people (all stored builds)</option>`), and `As of (optional)`, plus a 7-column horizontal birth metadata strip (`Name`, `Email`, `DOB & Time`, `Place`, `Kundli ID`, `Digest`, `Clock`). Move the Board tabs out of the top bar and into the Left Panel.
  3. **Constant-Height `100vh` 3-Panel Workspace (`TechniquesLab.tsx`)**:
     - **Left Panel (`w-[260px] shrink-0`, internal scrollbar)**: Board/Category tabs (`Self | Love | Work | General`) at the top + compact scrollable list of all non-planned techniques (including `self.*`, `love.*`, `work.*` dashboard section techniques and `general.*` reading techniques) + sticky bottom `Run this technique` / `Run the whole board` buttons.
     - **Center Main Stage (`flex-1 min-w-0`, 65%–85% width, front-and-center, internal scrollbar)**: The opened Build Inspector (`Inputs | Flow | Purview | Linemen | Brief | Output | Audit | Cost`) and `CompareView`.
     - **Right Panel (`w-[360px]` open / `w-10` collapsed rail, `shrink-0`, internal scrollbar)**: Collapsible `Stored builds` drawer showing **Who** (`personName` / `personEmail`), **Board/Type**, **Technique ID** (`self.reading.body`, `self.reading.atma`, etc.), **Built**, **Clock**, **Audit**, **Cost**, **Time**, `Open`, and `Compare`, filterable by Person and Technique.
  4. **7 Verified Unit-Test Guards to Preserve**:
     - Keep `technique: a.scope ?? 'all'` (bare scope e.g. `'body'`) on raw `/api/admin-lab/dossiers` JSON (`adminLab.test.ts:266`), and let `labAdapter.ts:317` expand it to `'self.reading.body'`.
     - Apply in-memory post-filter on `kundli_id`, `board`, `technique` after `readingDossier.findMany` (`adminLab.test.ts:94` stub ignores `where`).
     - Declare `personName?: string | null` and `personEmail?: string | null` **only** on `LabRunSummary` in `contract.ts` (never inside `export interface LabRun`, due to regex in `tests/lab.test.ts:90-93`).
     - Conditionally spread `...(personName ? { personName } : {})` and `...(personEmail ? { personEmail } : {})` in `summaryOf()` (`tests/serverClient.test.ts:105-119`).
     - Only pass `technique` as 3rd arg to `server.listDossiers` when defined, and omit `'all'` query params in `HttpServerClient.listDossiers` (`tests/lab.test.ts:215`, `tests/serverClient.test.ts:185`).
     - Keep initial `userId = ''` on mount in `TechniquesLab.tsx` (`TechniquesLab.test.tsx:112`) and guard `useEffect` with `userId !== 'all'`.
     - Preserve `aria-label="Find (name, email, place or user id)"` (`TechniquesLab.test.tsx:338`) and keep the right `Stored builds` drawer open by default (`TechniquesLab.test.tsx:219-221`).

### `BG-03` — Parallelize the 5 `family.*` Reader Calls in `runSelfOracle` to Prevent 60s CloudFront Timeout on Cold Runs
- **Where**: [`src/reading/self/oracle.ts:660-820`](./src/reading/self/oracle.ts)
- **Root Cause**: On a cold run, running `family.rasi`, `family.varga`, `family.dasha`, `family.year`, and `family.sky` sequentially takes `~29.5s` + `7.0s` (`lineman`) + `35.3s` (`oracle`) = `71.8s`, exceeding CloudFront's ~60s origin timeout (even though the backend completes and writes the dossier to PostgreSQL).
- **Exact Fix**: Run the uncached `family.*` reader calls in parallel with `Promise.all(...)` inside `runSelfOracle` (cutting cold reader wall time from `29.5s` to `~7.3s`, total cold run `~42s`), and in `TechniquesLab.tsx:715`, call `dossiers.reload()` if `runLab` times out.

---

## Priority 1 (`P1` — Database Digest Refresh & 12-Person Multi-Age Cohort Benchmark)

### `BG-04` — Rebuild Stored `kundli_digest` & `kundli_activation` Rows for the 12-Person Multi-Age Cohort (`20s`–`70s`)
- **Where**: `kundli_digest`, `kundli_activation`, `src/reading/digest/build.ts`, `src/reading/digest/annualSet.ts`
- **Root Cause**: 23 of the 24 `ready` kundlis in staging PostgreSQL were built on `2026-11-06` before `PointRow.planet` (`AK.planet`, `AmK.planet`, `DK.planet`), Upagraha `GK` separation, and `dasha.applicable` conditional dasha filtering were added (runtime backfills are already deployed in `load.ts` and `service.ts`). Also, only `2026` `D1` annual rows exist unless `ensureAnnualSet` (`2025, 2026, 2027` across `D1, D9, D10`) is run.
- **Exact Fix**: Run `buildDigest(prisma, kundliId)` + `rebuildActivation(prisma, kundliId)` + `ensureAnnualSet(prisma, kundliId, 2026, { fetch: true })` for the 12 cohort accounts listed in [`docs/handoff/2026-11-08-techniques-lab-self-love-work-handoff.md`](./docs/handoff/2026-11-08-techniques-lab-self-love-work-handoff.md).

### `BG-05` — Execute 12-Person Multi-Age-Group (`20s`–`70s`) Benchmark Across `Self`, `Love`, and `Work` + Independent Reviewer Pass
- **Budget**: `$0.92` remaining of the `$1.00` cap (`$0.08` used on Sachin's cold `self.reading.body` run; subsequent `Self`, `Love`, and `Work` runs for Sachin reuse cached `family.*` findings at `$0.00`).

---

## Priority 2 (`P2` — Four-School Vedic Astrology Enhancements Queued per Technique)

- **`BG-06` (`self.reading.lagna` — `src/reading/self/panels/lagna.ts`)**: Drop duplicate `lagna.moon` (already in `mind.moon`); add **Paka Lagna** (sign of Lagna lord), **Lagna-to-AL angular offset** (`1/7`, `5/9`, `6/8`, `2/12`), and **11th/12th from AL**.
- **`BG-07` (`self.reading.mind` — `src/reading/self/panels/mind.ts`)**: Add **Paksha Bala** (Moon tithi brightness), **Chandra Yogas** (`Sunapha`, `Anapha`, `Durudhura`, `Kemadruma`), `A4`/`A5` padas, `K64M`, and `D24` (`Chaturvimsamsa`).
- **`BG-08` (`self.reading.atma` — `src/reading/self/panels/atma.ts`)**: Add **Ishta Devata** (12th from Karakamsa in `D9`), **Dharma Devata** (9th from Karakamsa in `D9`), **Palana Devata** (6th from `AmK` in `D9`), and `D20` (`Vimsamsa`).
- **`BG-09` (`self.reading.yogas` — `src/reading/self/panels/yogas.ts`)**: Rank and weight every yoga by its participating planets' **effective 5-system Avastha multiplier** (`avasthaMultipliers.effective`) and active/upcoming Mahadasha/Antardasha schedule.
- **`BG-10` (`love.reading.partner` & `bond` — `src/reading/self/panels/love.ts`)**: Add angular relationship between **`UL` (`Upapada Lagna`, marriage)** and **`A7` (`Darapada`, attraction/lovers)** (`1/7`, `5/9` vs `6/8`, `2/12`), classical **Kuja Dosha (Manglik) cancellations**, and `Venus` `Lajjitadi` avasthas (`Lajjita`, `Kshobhita`, `Garvita`).
- **`BG-11` (`work.reading.*` — `src/reading/self/panels/work.ts`)**: Add **10th/6th/7th from Saturn (`Karma Karaka`)** (Bhrigu Nandi Nadi / Lunar Astro), **`D10` H6 vs H7** (service vs business), **10th/11th vs 6th/8th/12th from `AL` & `A10`**, and **`SAV` bindu ratio across `H10 : H11 : H12`**.
- **`BG-12` (`src/reading/self/service.ts` Post-Oracle `auditCards` & Purview on `diagnosis`)**: Run `runPurview` after `diagnosisPanel` so purview rules annotate `diagnosis.*`, and re-run `auditCards` after `runSelfOracle` merges AI `panelLines`.

