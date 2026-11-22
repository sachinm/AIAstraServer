# 00 · Master Plan: 8 Domain-Separated Vedic Astrology Dashboards & 72-Card Architecture

**Date:** 2026-11-17  
**Status:** Master Plan & Architecture Specification (Planning Phase)  
**Target Documentation Set:** `docs/dashboards/00-plan.md` through `docs/dashboards/08-business-and-field-of-business.md`  
**Related Specs:** `AGENTS.md`, `SOUL.md`, `docs/reading-engine/68-self-board-v3-your-cards-your-months.md`, `docs/reading-engine/69-love-and-work-boards-v3.md`, `docs/reading-engine/71-card-picker-art-and-card-options.md`, `docs/reading-engine/75-self-foundation-card.md`, `docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`, `docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`, `docs/reading-engine/79-self-foundation-and-dashboard-release-plan.md`

---

## Executive Summary

This master plan defines the architecture, astrological differentiation rules, product UX, and implementation roadmap for **8 specialized Vedic astrology dashboards** comprising **72 distinct reading cards** across two core life hubs:
- **Relationships Hub (4 Dashboards · 37 Cards):**
  1. `01` **Dating & Romance** (10 cards: 5th house, `A5`, Venus/Mars, `D1 + D9 + D7`)
  2. `02` **Marriage & Committed Partnership** (12 cards: 7th house, `UL`, `DK`, 2nd/4th/8th/12th, `D9` age-36+ gate, `D7`, `D30`)
  3. `03` **Friendships & Social Circle** (7 cards: 11th house, `A11`, 3rd/9th, `D1 + D9`, `D11` proxy)
  4. `04` **Professional Relationships & Allies** (8 cards: `D10` 6th/7th/10th/11th, `A10`, `A7`, `D30`, `D11` proxy)
- **Career & Work Hub (4 Dashboards · 35 Cards):**
  5. `05` **Career Start & First Break** (7 cards: `D24 + D10 + D1` 4th/5th/9th/10th, `D4`, Saturn Return)
  6. `06` **Primary Job & Corporate Growth** (11 cards: `D10` 6th/10th/11th + `D2` + `D24` + `D30` + `AmK`)
  7. `07` **Hobby, Craft & Creative Projects** (6 cards: `D7` + 3rd/5th + `D24` + `D16`)
  8. `08` **Business & Field of Business** (11 cards: `D10 + D2 + D4 + D11` proxy `+ D30`)

Every card adheres to the **Self v3 Foundation Card Contract** (`docs/reading-engine/75`), **Age-36 Navamsha (`D9`) Mutual Confirmation & Active Timing Architecture** (`docs/reading-engine/76`), **Anti-Sycophancy & 4-Tier Behavioral Playbook** (`SOUL.md`), **5-Gate Dashboard Card Toolbar Vetting** (`.agents/skills/dashboard-card-toolbar-vetting/SKILL.md`), and the **Zero-Node-Astrology Boundary** (all astronomical/astrological computation comes strictly from the Python calculation engine, with zero engine names ever surfaced to end users).

---

## 1. Start

### 1.1 Current System Checked Against Code, Logs, Config, and Database

| Layer | Verified Current State (as of 2026-11-17) | Evidence / Exact Paths |
|---|---|---|
| **API Compute & Routing** | AWS Lambda `aiastra-server-api` (Node.js/TypeScript, `us-east-1`) behind CloudFront `dzsm2dbswvuqy.cloudfront.net`. | `docs/reading-engine/79 §1.1`, `src/routes/areaRoutes.ts`, `src/routes/selfV3Routes.ts`, `src/routes/boardCardsRoutes.ts` |
| **Database & Schema** | PostgreSQL on Render (`aiastradb`) at migration 75 (`20261115100000_user_notifications_m53`). Core reading tables are already provisioned: `chart_data_types` (`ChartDataType`), `kundli_data` (`KundliData`), `kundli_digest` (`KundliDigest`), `kundli_activation` (`KundliActivation`), `technique_outputs` (`TechniqueOutput`), `board_layout` (`BoardLayout`), `area_builds` (`AreaBuild`), `kundli_slices` (`KundliSlice`), `reading_findings_cache` (`ReadingFindingsCache`), `llm_cache_entries` (`LlmCacheEntry`), and `user_feature_overrides` (`UserFeatureOverride`). | `prisma/schema.prisma:249–336, 482, 1045–1061, 1269–1287, 1357–1381, 1580–1623`; `prisma/migrations/20261115100000_user_notifications_m53` |
| **Web Frontend** | AWS Amplify app `d20sdo476h9w6c` (`release-candidate-staging`). `/you` runs `SelfBoardV3` (`ReadFace`, `ShortFace`, `CardToolbar`, `PeriodStrip`, `ChartDetails`). `/love` still runs legacy `AreaBoardView` over `GET /api/area/love`; `/work` still runs legacy `WorkPage` over `GET /api/area/career`. | `docs/reading-engine/78 §2`, `docs/reading-engine/79 §1.4` |
| **Card Catalogue & Options** | `src/reading/boards/catalogue.ts` registers 10 placeholder Love cards and 9 placeholder Work cards mapped to legacy `subareas` (with `love_partner`, `work_leading`, and `work_build` unimplemented as `subareas: []` "Coming soon"). `src/reading/boards/cardOptions.ts` supports `length`, `view`, `words`, `plan`, `face`, `tools`, `groupBy`, `groupsAs`, `start`. `src/boards/features.ts` gates `card.*` and `feature.*` keys against `UserFeatureOverride` and billing plans (`free \| plus \| unlimited`). | `src/reading/boards/catalogue.ts:38–61`, `src/reading/boards/cardOptions.ts:44–70`, `src/boards/features.ts:37–60` |
| **Engine Catalog & Vargas** | `src/reading/chartData/catalog.ts` supports 23 `VARGA_FACTORS` (`D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D60` natively exported in `PAST_READING_NATAL_TYPES`), 40+ dasha systems (Levels 1–3 lifelong, Levels 4–6 moving window), and `annual.tithi_pravesha` / `annual.tithi_pravesha_dasha` with `divisional_chart_factor` variants. **Gap:** `D11` (Ekadashamsha) is listed in `DEEP_VARGAS` but not yet exported by the calculation engine. | `src/reading/chartData/catalog.ts:57–101`, `docs/TODOS.md`, `docs/reading-engine/78 §5.1` |
| **D9 Gate & Timing Helpers** | `src/config/env.ts` exposes `getD9MaturityAgeYears()` (`D9_MATURITY_AGE_YEARS`, default `36`, clamped `18..100`), `getReadingCacheRecycleMs()` (`READING_CACHE_RECYCLE_MINUTES`, default `45`), `getBoardPeriodsMax()` (default `6`), `getBoardKeyDatesMax()` (default `6`), `getBoardFeaturesOff()`, and `getBoardFeaturesPremium()`. `src/reading/dasha/dashaAssessment.ts` implements `isAgeMatureD9()`, `evaluateD1D9MutualConfirmation()`, `resolveActiveMahadasha()`, and `evaluateActiveDashaWithVargaAndTP()`. `src/reading/annual/tithiPravesha.ts` implements `runningTithiPravesha()`, `tpRowIn()`, and `TITHI_PRAVESHA_YEAR_RULE`. | `src/config/env.ts:253–264, 1506–1551`, `src/reading/dasha/dashaAssessment.ts:110–319`, `src/reading/annual/tithiPravesha.ts:24–60` |
| **Streaming & Telemetry** | `src/telemetry/pageTiming.ts` exposes `GET /api/dashboard/sections-stream` (`application/x-ndjson`) and records `page_execution_logs`. | `src/telemetry/pageTiming.ts:684–759` |
| **Active Worktree Locks** | In local workspaces, `develop` (`wt/server-retrograde`) and `release-candidate-staging` (`wt/server-self-reading`) are checked out in separate worktrees. | `docs/reading-engine/79 §1.5` |

### 1.2 Observed User Symptoms & Astrological Gaps
1. **Life-Stage Mismatch on Monolithic Boards:** Single users opening Love see marriage/in-law cards; married users see "Meeting someone"; recent college graduates opening Work see "Leading people"; founders see corporate promotion prompts.
2. **Astrological Mechanism Conflation:** Monolithic Love conflates 5th-house romance/attraction (`A5`, Venus/Mars, `D7`), 7th-house legal union (`UL`, `DK`, `D9` age-36+ gate), 11th-house platonic community (`A11`), and `D10` workplace allies (`A10`/`A7`). Monolithic Work conflates degree-to-career conversion (`D24`), structured employment (`D10` 6th/10th/11th + `D2`), creative side-craft (`D7` + 3rd/5th), and entrepreneurship (`D10` 7th + `D2` + `D4` + `D30`).
3. **Absence of Self v3 Foundation Parity on Love & Work:** Legacy `/api/area/love` and `/api/area/career` render code-only house layers without grouped Oracle + Personalizer card synthesis, `PeriodStrip` date rails, `KeyDates`, or 1-tap past-event calibration confirms.
4. **Search-Intent Blind Spots:** High-volume real-world questions—mixed signals, no-contact/exes, karmic vs. compatible bonds, layoff readiness, burnout, imposter syndrome, hobby monetization, co-founder governance—have no dedicated cards.

---

## 2. End Goal

### 2.1 User-Visible Behaviour
- **Two Clean Navigation Hubs, Eight Context-Routed Lenses:** Users continue navigating to **Relationships** (`/dashboard/love`) and **Work** (`/dashboard/work`) in the left sidebar without sidebar bloat. Each hub presents a segmented 4-lens switcher whose default lens is pre-selected from `person_facts` (`love.status`, `work.status`, `age_band`), while allowing instant switching across all 4 lenses.
- **72 Non-Overlapping, Period-Led Cards:** Each dashboard launches with **4–5 suggested starter cards** pinned by `person_facts` and exposes the remaining cards in the `+` Card Picker (`Your cards`). Every card follows the Self v3 contract:
  - Plain-English **Title** and 1-line **Subtitle**
  - **Area of Focus** + chart-grounded **Oracle Question** (dated windows, zero jargon) + tailored **Personalizer Goal**
  - **Read** face default + **Short** face toggle
  - **PeriodStrip** (3–6 named, start-ordered, non-duplicated spans bounded by the Tithi Pravesha lunar-solar return or active dasha) + **KeyDates** (max 6, passed dates flagged)
  - **4-Tier Behavioral Playbook** (`Sattvic` / `Rajasic` / `Mediocre` / `Baseline`) whenever a structural bottleneck is identified (`SOUL.md` Rule 1/1a)
  - **Single Confirmable Past-Event Question** per card to calibrate empirical accuracy
  - **1-Tap "Chart details"** sheet holding sanitized astrological coordinates (`evidence[]`) and 5-clock agreement counts—never raw Sanskrit jargon or internal engine names on the card surface.

### 2.2 Target Timings & Budgets (`AGENTS.md` §"Board and technique machinery")
- **Deterministic code ledger (`<board>.sub.*`)**: `< 1 s` per build.
- **Cached board GET (`GET /api/board/:board/v3`)**: `<= 300 ms` (`<= 500 ms` p95 including DB read and feature gating).
- **Cold board build (pinned starter cards)**: `< 25 s` (hard cap `< 30 s`), using parallel prefix pre-warming (`READING_EXPLICIT_CACHE=1`) and grouped card packs (`CARDS_GROUP_PACK=1`).
- **Profile-only rebuild (`person_facts` / `voice` / `stance` change with warm digest)**: `< 10 s`.
- **Warm cached input token share**: `> 70 %` via stable per-individual prefixes (`parts[0]` >= 1,024 tokens).
- **Optimistic layout save (`PUT /api/board/:board/v3/layout`)**: `< 50 ms` UI response; `< 300 ms` server persistence.
- **Progressive NDJSON board streaming**: Fast sections (`profile`, `chart_status`, `layout`) paint in `<= 100 ms` while heavier card/timeline sections stream asynchronously.

### 2.3 Eliminated Failure Modes
1. **Zero irrelevant life-stage cards** (single users never defaulted to in-law conflict; founders never defaulted to corporate ladder tips).
2. **Zero Node astrological calculations** (no `% 12` house math, sign lordship guesses, or dasha rescaling in TypeScript).
3. **Zero internal engine names (`Radha`, `pyjhora`, `jhora`, `AIAstra_Radha`) or raw Sanskrit jargon** on user-facing card faces or Oracle questions.
4. **Zero Gregorian calendar year fallbacks** (`YYYY-01-01` .. `YYYY-12-31`) for annual Tithi Pravesha periods; unresolved `yearLord` fails closed to `stance = 'get_through'`.
5. **Zero false Vargottama inflation of debilitated planets** (`Neecha Vargottama` / *Drudha Karma* receives `-1.5` post-36 and `confirmed_weak` verdict).
6. **Zero concurrent layout overwrite races** (enforced by `updated_at` optimistic concurrency returning HTTP `409 stale_layout`).
7. **Zero unvetted empty card tools** (all optional toolbar tools pass the 5-Gate Toolbar Vetting rubric).

---

## 3. Deliverable

### 3.1 Planning & Specification Documentation (Current Assignment Scope)
- `docs/dashboards/00-plan.md` — This 9-point Master Plan.
- **Relationships Track (`docs/dashboards/01–04`):**
  - `docs/dashboards/01-dating-and-romance.md` (10 cards: Cards 1–10)
  - `docs/dashboards/02-marriage-and-partnership.md` (12 cards: Cards 11–22)
  - `docs/dashboards/03-friendships-and-social-circle.md` (7 cards: Cards 23–29)
  - `docs/dashboards/04-professional-relationships-and-allies.md` (8 cards: Cards 30–37)
- **Career & Work Track (`docs/dashboards/05–08`):**
  - `docs/dashboards/05-career-start-and-first-break.md` (7 cards: Cards 38–44)
  - `docs/dashboards/06-primary-job-and-corporate-growth.md` (11 cards: Cards 45–55)
  - `docs/dashboards/07-hobby-craft-and-creative-projects.md` (6 cards: Cards 56–61)
  - `docs/dashboards/08-business-and-field-of-business.md` (11 cards: Cards 62–72)
- `docs/TODOS.md` — P1 tracking entries for `00-plan.md` through `08-*.md` with review checklists and implementation recommendations.

### 3.2 Planned Code Paths (Subsequent Implementation Phases — NOT Modified During Planning)
- **Registry & Card Contracts:**
  - `src/reading/boards/catalogue.ts` — Expand from 19 placeholder entries to all **72 cards** grouped by `board` (`love` | `work`) and `subBoard` (`dating`, `marriage`, `friends`, `workrel`, `start`, `job`, `craft`, `biz`), with `showWhen` predicates over `person_facts`.
  - `src/boards/features.ts` — Register all 72 `card.<board>.<id>` feature keys and mirror in `aiadastra_admin/api/src/features.ts`.
  - `src/techniques/catalog.ts` & `src/techniques/layouts.ts` — Register `<board>.sub.*` sub-techniques and area card techniques with full `selectors` and `contract` definitions.
  - `src/reading/oracle/digestSlices.ts` & `src/techniques/subagentCachePlan.ts` — Register `SUBAGENT_DIGEST_SPECS` and cache plans for Relationships and Work sub-agents.
- **Deterministic Sub-Techniques & Area Ledgers (`src/reading/area/`):**
  - Relationships ledgers: `dating.ts`, `marriage.ts`, `friendships.ts`, `professional.ts` (consuming `D1`, `D9`, `D7`, `D10`, `D30`, `UL`/`AL`/`A5`/`A7`/`A10`/`A11`, `DK`, `StarProfile`, `AnnualRow`, `S6D`).
  - Career & Work ledgers: `careerStart.ts`, `primaryJob.ts`, `hobby.ts`, `business.ts` (consuming `D24`, `D10`, `D2`, `D4`, `D7`, `D16`, `D30`, `AmK`, `A10`/`A11`, `AnnualRow`, `S6D`).
  - Shared foundation helpers: `src/reading/self/v3/foundation.ts` (`cleanEmptyRefs`, `isoDatesToWords`, `periodsFrom`, `keyDatesFrom`, `staleDatesIn`), `src/reading/dasha/dashaAssessment.ts` (`isAgeMatureD9`, `evaluateD1D9MutualConfirmation`, `evaluateActiveDashaWithVargaAndTP`), and `src/reading/annual/tithiPravesha.ts` (`runningTithiPravesha`, `tpRowIn`).
- **Grouped Card Pack Synthesis & Routes:**
  - `src/reading/cards/group.ts` & `src/reading/boards/v3Service.ts` (generalized from `self/v3/service.ts` + `self/v3/layout.ts`).
  - `src/routes/boardCardsRoutes.ts` (extended with `GET /api/board/:board/v3`, `POST /api/board/:board/v3/confirm`, `POST /api/board/:board/v3/cards/:id/read`, and versioned `409 stale_layout` handling on `PUT /api/board/:board/v3/layout`).
  - `src/routes/areaRoutes.ts` (`POST /api/boards/:board/refresh`, `board = self | love | work`) — retains the `questionGate` reserve/settle refresh path (`refresh_due === true`, user cost confirmation prior to spend, `200` synchronous board refresh for `love`/`work` or `202` queued rebuild for `self`).
  - **Per-Lens `BoardLayout` Storage (`prisma/schema.prisma:1580–1602`):** `board_layout` enforces `@@unique([kundli_id, board])` for `board = 'self' | 'love' | 'work'`. Per-lens active lens selection and per-lens pinned card arrays (`dating`, `marriage`, `friends`, `workrel` under `board = 'love'`; `start`, `job`, `craft`, `biz` under `board = 'work'`) are stored inside `board_options.lenses` on the single `(kundli_id, board)` row (preserving zero schema changes and `updated_at` optimistic concurrency), with an optional additive migration path if compound `board` keys (`love:dating`, etc.) are ever needed for independent per-lens row locking.
- **Frontend (`AIAstra_WEB`):**
  - Segmented sub-lens switcher component on `/dashboard/love` and `/dashboard/work`, unified `BoardV3View` sharing `CardFrame`, `ReadFace`, `ShortFace`, `CardToolbar`, `PeriodStrip`, `KeyDates`, `ChartDetails`, and `toolVetting.ts`.

### 3.3 Database Migrations, Engine Prerequisites (`doc 80` R1–R4) & Infra/Env Changes
- **Planning & Initial Launch:** **Zero required Prisma schema migrations.** `KundliData`, `KundliDigest`, `KundliActivation`, `TechniqueOutput`, `ReadingFindingsCache`, `LlmCacheEntry`, `BoardLayout` (`@@unique([kundli_id, board])` with `board_options` per-lens map), `AreaBuild`, and `UserFeatureOverride` already exist at migration 75.
- **Optional Additive Migration (Phase 2/4 if sub-board layouts are split into separate rows):** Additive index/default update only if `board_layout.board` is migrated from `'love' | 'work'` to compound keys (`love:dating`, `love:marriage`, `love:friends`, `love:workrel`, `work:start`, `work:job`, `work:craft`, `work:biz`) rather than storing per-lens layouts inside `board_options`.
- **Technical Prerequisites (`docs/reading-engine/80` R1–R4):**
  - **R1 (`kind === 'TP'` `yearLord` Parsing):** `AIAstra_Radha/src/jhora/annual_export.py` (`run_annual`) exports `year_lord` + panchanga on `annual.tithi_pravesha`, and `src/reading/digest/build.ts:1177–1196` parses `yearLord` and panchanga when `kind === 'TP'` (not only `kind === 'VP'`) so TP cards resolve `stance` cleanly instead of failing closed to `'get_through'`.
  - **R2 (`SERVED_VARGAS` Expansion):** `src/reading/chartData/catalog.ts:133` expands `SERVED_VARGAS` via env-gated `SERVED_VARGAS_LIST` (keeping `LEGACY_VARGAS` strictly scoped to `{1, 2, 4, 7, 9, 10}`) to unlock `D16`, `D24`, `D30`, and `D11` without breaking signup latency or Prisma columns.
  - **R3 (Varga `house`, `lagna`, Lordships & Dignities):** `AIAstra_Radha` (`export.py:887` / `natal_export.py` `dignities.dN`) supplies explicit varga `house` (`1..12`), `lagna`, lordships, and dignities so `build.ts` (`placementCards`) populates non-null varga house/dignity fields across `D2..D30`.
  - **R4 (Dynamic TP Divisional Pulls & `ANNUAL_CHART_VARGAS`):** `src/reading/chartData/catalog.ts:238`, `store.ts`, and `src/reading/digest/annualSet.ts:11` (`ANNUAL_CHART_VARGAS`, currently `[1, 9, 10]`) mark `annual.tithi_pravesha` / `annual.varsha` served with `divisional_chart_factor` so `tpRowIn` serves `D2`, `D4`, `D7`, `D16`, `D24`, and `D30` annual charts.
- **Calculation Engine Backlog (`AIAstra_Radha`):** Add `varga.d11` (Ekadashamsha) export to `PAST_READING_NATAL_TYPES` in `src/reading/chartData/catalog.ts` after engine deployment.
- **Environment Variables (`src/config/env.ts`):** Reuse `D9_MATURITY_AGE_YEARS=36`, `READING_CACHE_RECYCLE_MINUTES=45`, `BOARD_PERIODS_MAX=6`, `BOARD_KEY_DATES_MAX=6`, `CARDS_GROUP_PACK=1`, `READING_EXPLICIT_CACHE=1`, plus additive `SERVED_VARGAS_LIST`, `RELATIONSHIPS_V3_ENABLED`, and `WORK_V3_ENABLED` rollout flags.

### 3.4 Verification & Test Deliverables
- `tests/unit/techniques/contracts.test.ts` — Validates `selectors` and `contract` on all new sub-techniques and area techniques.
- `tests/unit/techniques/summaries.test.ts` — Asserts `withAgentRun` summaries contain only counts, IDs, tones, and scores (zero PII/birth/question text).
- `tests/unit/reading/digest/noAstrologyInNode.test.ts` — Verifies zero astrological calculation in Node.
- `tests/unit/techniques/dashaNavamshaConfirmation.test.ts` — Verifies `isAgeMatureD9` (`> 36`) and all 7 `evaluateD1D9MutualConfirmation` cases including `Neecha Vargottama`.
- `tests/unit/boards/catalogue72.test.ts` & `tests/unit/boards/areaLedgers.test.ts` — Verifies all 72 cards, `showWhen` routing, redaction of engine names and Sanskrit terms on `Read`/`Short` faces, and pure `AreaBrief` selection with zero DB calls.
- `research.technical_verifier` — `>= 95%` pass rate across synthetic age/profession cohorts in isolated `research_*` staging tables.

---

## 4. How It Works When Done

### 4.1 Backend End-to-End Flow, Concurrency, Limits, Retries & Timing

```
[1. Engine Export] ──► [2. Digest & Activation] ──► [3. Deterministic Sub-Techniques]
  (D1..D60, Dashas,       kundli_digest (M32)         <board>.sub.* -> technique_outputs
   TP Annual, S6D)        kundli_activation (M33)     (Age-36 Gate, 5-Clock Concordance)
                                                               │
                                                               ▼
[6. 45-Min Cache Sweep] ◄── [5. Pure Card Assembly] ◄── [4. Grouped Prefix-Cached LLM]
  informIndividualCacheUsed   foundation.ts + features    parts[0] >= 1024 tok (cached)
  EventBridge / 45m timer     Read/Short + ChartDetails   Oracle -> Personalizer (1 repair)
```

1. **Pre-Pull & Digest Hydration:** When a chart is built, `kundli_data` stores natal vargas (`D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D60`), `arudhas`, `argala`, `karaka.chara`, `ashtakavarga`, `avasthas`, `dignities`, `dasha.applicable`, 40+ dashas (Levels 1–3 lifelong; Levels 4–6 moving `[-90d, +365d]`), and annual `annual.tithi_pravesha` + `annual.tithi_pravesha_dasha` across varga factors (`1, 7, 9, 10, 30`). `kundli_digest` and `kundli_activation` materialize typed `DigestView` and `ActivationRow[]` rows.
2. **Deterministic Sub-Techniques (`<board>.sub.*`):** Run once per boundary state (digest version + active dasha boundary + TP return boundary + `asOf`), writing typed JSON outputs to `technique_outputs`:
   - **Age-36 Navamsha Gate:** Computes `ageInYears(birthDate, asOf)` and checks `isAgeMatureD9(ageYears)` (`ageYears > getD9MaturityAgeYears()`, default `36`). Pre-36 treats `D1` as primary baseline with `D9` as developmental context; post-36 mandates `evaluateD1D9MutualConfirmation(view, planet, true)` across 7 cases: `Neecha Vargottama` (*Drudha Karma*, `-1.5`, `confirmed_weak`), Exalted/Own Vargottama (`+1.5`, `confirmed_strong`), Neutral Vargottama (`+1.0`, `confirmed_strong`), `Neecha Bhanga via D9` (`+1.2`, `d9_redeemed`), *False Promise* (`-1.0`, `d9_weakened`), non-Vargottama weak (`-1.3`), and Neutral (`0.0`).
   - **Active 40+ Dasha & 9x9 Fruition Matrix:** `resolveActiveMahadasha(activation, asOf)` prioritizes certified conditional nakshatra dashas (`family === 'conditional'`) -> `vimshottari` -> `rasi` (Narayana/Chara) -> `yogini`/`karaka`. Evaluates `AntardashaFruitionCell` (`1/5/9` Trikona, `4/7/10` Kendra, `2/11` Dhana/Labha, `6/8/12` Dusthana, `6/8` Shadashtaka, `2/12` Dwirdwadasha) and routes active lords into departmental vargas (`D9/D7` for Love, `D10/D24/D2/D4` for Work, `D30` for strain/litigation).
   - **Five Clocks Concordance:** Compares Vimshottari, Narayana, Tithi Pravesha Year, Applicable Conditional Dasha, and Yogini/Chara (`>= 3` agree = `confirmed`, `2` = `leaning`, split = `contested`).
   - **Tithi Pravesha Container (`TITHI_PRAVESHA_YEAR_RULE`):** `runningTithiPravesha(view, asOf)` selects the active return bounded strictly by `tp_start <= now < tp_end` (`<= 400` days; zero Gregorian `01-01`..`12-31` fallback). Reads `AnnualRow.yearLord` and `tpRowIn(view, tp, varga)`. Unresolved `yearLord` or contested clocks fail closed to `stance = 'get_through'`.
   - **Nakshatra, Navatara, Transits & Avasthas:** Integrates `StarProfile` (Janma Nakshatra, 4 padas, Navatara cycle & binary `Tara Bala`), `S6D` Jupiter/Saturn double transit (`activateDoubleTransit`), Rahu-Ketu 18-month axis, Sade Sati / Kantaka Shani / Ashtama Shani, `SAV` bindu support (`>= 30` strong, `< 25` vulnerable), and 5-system Avastha delivery multipliers (`Baladi`/`Jagradadi`, e.g., `Mrita 0.10x` externalizing via dispositor).
3. **Grouped Prefix-Cached LLM Synthesis (`src/reading/cards/group.ts`):**
   - **Concurrency & Limits:** Stable prefix (`natal.core`, `sky.window`, `year.tp`, `frame`, `person_facts`, `answers`) is placed in `parts[0]` (`>= 1,024` tokens) with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`, pre-warmed in parallel (`READING_EXPLICIT_CACHE=1`). Pinned board cards execute first in small batches (`CARDS_GROUP_SIZE_BOARD`, default `3`), followed by background/picker cards in larger batches (`CARDS_GROUP_SIZE_REST`, default `6`).
   - **Timeouts & Retries:** Each group call uses `CARD_GROUP_TIMEOUT_MS = 90_000` and `CARD_GROUP_MAX_OUTPUT_TOKENS = 16_000`. Route-level synchronous reads enforce `SELF_V3_ROUTE_BUDGET_MS` (`2,000 ms`). Every generated card passes `precheckCard`, `checkOracleCard`, `checkAgainstLedger`, and `checkPersonalCard`; failed cards execute **one** grouped repair retry with exact validation error reasons. Provider quota/auth failures map to HTTP `503 { error: 'ai_unavailable', code: 'ai_unavailable' }` without throwing uncaught 500s.
4. **45-Minute Per-Individual Used-Cache Recycling:**
   - Pre-warming (`ensurePromptCache`, `saveDbReaderCache`) writes `hit_count = 0`.
   - Reading or synthesizing a board increments `hit_count` / `last_used_at` and calls `informIndividualCacheUsed({ userId, kundliId })` (`src/reading/llm/cacheSweep.ts`), scheduling `recycleIndividualCaches(owner, { onlyUsed: true })` after `getReadingCacheRecycleMs()` (`READING_CACHE_RECYCLE_MINUTES=45`).
   - AWS EventBridge triggers `runScheduledSweep` (`POST /events`, `SWEEP_TASK = 'llm-cache-sweep'`) as a safety net across all 4 layers: Gemini `cachedContents`/`llm_cache_entries`, `reading_findings_cache`, `technique_outputs`, and in-memory memos.

### 4.2 API Contracts

All consumer endpoints enforce `requireUser`, `assertOwnAccount(ctx, targetUserId)`, `Cache-Control: private, no-store, no-cache, must-revalidate`, and masked domain errors (`app_error_events` captures 5xx/RBAC failures with `requestId`):

| Endpoint | Method | Purpose & Params | Responses & Status Codes |
|---|---|---|---|
| `/api/dashboard/sections-stream` | `GET` | Progressive NDJSON stream (`?sections=profile,chart_status,biodata,content,timeline`, header `X-Astra-Page`). | `200 application/x-ndjson` streaming `{ section, ok, durationMs, data }\n`; `401` unauthenticated. |
| `/api/board/:board/v3` | `GET` | Unified board read (`board = love \| work`, optional `?lens=dating\|marriage\|friends\|workrel\|start\|job\|craft\|biz`). Supports `If-None-Match` ETag. | `200 BoardV3Response` (with `activeLens`, `lenses[]`, `features`, `layout`, `cards[]`, `version`); `304 Not Modified`; `202 { status: 'preparing' }`; `400 unknown_board`; `403 forbidden`; `404 no_kundli`; `503 timeout \| ai_unavailable`. |
| `/api/board/:board/v3/catalogue` | `GET` | Card Picker deck grouped by sub-dashboard lens with `showWhen` hints and feature availability. | `200 { lenses, groups, cards }`; `400 unknown_board`. |
| `/api/board/:board/v3/layout` | `GET` / `PUT` | Reads or atomically patches board layout (`{ version, patch: { subBoard?, cards?, sections?, options?, boardOptions? } }`) on the `(kundli_id, board)` `BoardLayout` row (`board_options.lenses` stores per-lens card selections & active sub-lens). | `200 AreaLayoutView` (with new `version`); `400 { error, detail? }`; `404 no_kundli`; `409 { error: 'stale_layout', layout }`. |
| `/api/board/:board/v3/confirm` | `POST` | Records single past-event empirical confirmation (`{ cardId, claimId, answer: 'yes'\|'partly'\|'no'\|'skip' }`) into `clarify_turn_audits`. | `204 No Content`; `400 bad_claim \| bad_answer`. |
| `/api/board/:board/v3/cards/:id/read` | `POST` | Queues on-demand synthesis for a newly pinned picker card if not yet built. | `202 { state: 'queued' }`; `400 unknown_card \| card_not_offered`; `404 no_kundli`; `409 already_reading`; `429 spend_cap`; `503 off`. |
| `/api/boards/:board/refresh` | `POST` | User-initiated refresh (`src/routes/areaRoutes.ts:104–149`, `board = self \| love \| work`) once `refresh_due === true` (displays cost confirmation first; reserves/settles 1 monthly question via `questionGate`). | `200 { ...fresh, checks, usage }` (`love`/`work`) or `202 { status: 'building', usage }` (`self`); `400 unknown_board`; `402 quota_exhausted`; `404 no_kundli`; `409 not_due \| not_ready \| building`; `503 ai_unavailable`. |
| `/api/area/love`, `/api/area/career` | `GET` | Legacy Phase 1 endpoints retained for backward compatibility until `RELATIONSHIPS_V3_ENABLED=1` and `WORK_V3_ENABLED=1` graduate. | `200`, `202`, `404`, `500`. |
| `/graphql` (`ask`, `updatePersonFacts`) | `POST` | Contextual card chat and `person_facts` updates (`love.status`, `work.status`, `age_band`) shared with the Personalize Wizard. | `200` GraphQL JSON (masked errors with `requestId`); AST depth/alias limits enforced. |

### 4.3 Frontend Experience (`AIAstra_WEB`)
- **Progressive NDJSON Loading & Lens Routing:** The page shell mounts immediately from fast streamed sections (`profile`, `chart_status`, `layout`), while card bodies render skeleton shimmers until `content` resolves. The segmented 4-lens bar defaults to `person_facts` (`love.status`: single/dating -> *Dating*, married/partnered -> *Marriage*, etc.; `work.status`: studying/grad -> *Career Start*, employed -> *Primary Job*, side-project -> *Hobby & Craft*, own_business -> *Business*) and lets users switch lenses cleanly without leaving `/love` or `/work`.
- **Card Lifecycle States:**
  - `pending` / `building`: Calm status banner with deterministic `PeriodStrip` skeleton; no spinning wheel blocking already-ready cards.
  - `ready`: Renders `CardFrame` (top art banner, title, 1-line subtitle), `CardToolbar`, `ReadFace` (default) or `ShortFace`, ordered `PeriodStrip` chips (hidden when `periods.length <= 1`), `KeyDates` (highlighting `Active`, `Now`, `Next shift · In Nd`, `Past`), and 1-tap past-event confirmation pill.
  - `locked`: Renders card header with lock badge (`Part of Plus` / `Unlimited`) and zero leaked reading content.
  - `stale`: Displays `"Some dates here have passed — refresh to update"` inside `Info` / banner when `stale === true`.
  - `failed` (`ai_unavailable` / `notReady`): Renders `AiUnavailableModal` on AI outage or graceful standing fallback via `hasCardContent(card)` without throwing `TypeError`.
- **5-Gate Card Toolbar Vetting (`dashboard-card-toolbar-vetting`):**
  - `Chart details` (`toolbar-details` + `Chart details ›` footer) is **always** shown and reachable, never carries `aria-pressed`, and scrubs empty references (`()`, `(,)`, `(Mars ())`).
  - Optional tools (`table`, `calendar`, `dates`, `timeframe`, `plan`, `info`) only appear when passing all 5 gates: (1) Feature/Option/Readiness, (2) Data Completeness (`>= 2` periods with `own: true` prose), (3) Non-Redundancy (no duplicate `PlanList` when `Plan` is open; `Dates` requires `>= 1` milestone `>= today`), (4) Chronological Honesty (`Weeks` blocked if min span `> 21d`; `Months` blocked if `> 95d`; `Calendar` requires `>= 2` painted shades and `>= 1` day boundary, no CSS `nth-child` chopping), and (5) Layout Non-Destruction (`.self-v3-tools` capped at `max-height: 38cqh` inside `.self-v3-stage`, `44x44px` coarse touch targets, native `focusgroup` with roving `tabIndex` fallback).

### 4.4 UI/UX & Copy Discipline
- **Plain-English Surface:** Every title, subtitle, Oracle question, Personalizer paragraph, and PeriodStrip label uses warm, direct, grounded English (e.g., *"Between 14 Mar and 28 Jul 2027, work pressure eases enough to test a role change"*).
- **Strict Redaction Rules (`SOUL.md` §1, `foundation.ts`):**
  - **Prohibited on screen & in Oracle questions:** `Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`, raw Sanskrit house/varga jargon (`Mahadasha`, `Neecha Vargottama`, `Navamsha`, `SAV points`, `Dusthana`, `Upapada`), and raw ISO timestamps (`2026-11-17T...` -> `"17 Nov 2026"`).
  - **Evidence Quarantine:** All astrological coordinates (`D1.p.Sa.h7`, `D9.p.Ve.h2:neecha`, `tp:2026.yearLord:Mo`, `S6D:Ju+Sa->h10`) live strictly in `card.evidence[]` and render inside the 1-tap **Chart details** sheet (with plain-English clock agreement counts).
- **Rule 0 Multi-Entity Disambiguation & 4-Tier Playbooks (`SOUL.md` §2–3):** Cards never collapse distinct people (e.g., a demanding boss vs. a commercial client vs. an elder mentor) into one planetary stereotype, and every bottleneck card delivers 4 actionable behavioral tiers (*Best / Sattvic*, *Pragmatic / Rajasic*, *Mixed / Passive*, *Baseline Floor*).
- **Cost Transparency (`AGENTS.md` §7):** Any user action spending a monthly question (`POST /api/boards/:board/refresh` or triggering a new card read outside the free initial board build) displays `"Uses 1 of your N questions this month"` before execution.

---

## 5. Architecture

### 5.1 Execution Boundaries & Component Interactions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. CALCULATION BOUNDARY (AIAstra_Radha / pyjhora HTTP Service)               │
│    Sole astrological authority: D1..D60, Arudhas, Karakas, 40+ Dashas,       │
│    TP Annual Charts, S6D/Gochara Transits, Ashtakavarga, Avasthas, Taras.    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │ JSON ingest -> PostgreSQL (Render)
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. STORAGE & DIGEST BOUNDARY (PostgreSQL · SEALED_MODELS pii2:v1 AES-256-GCM)│
│    kundli_data ─► kundli_digest + kundli_activation ─► technique_outputs     │
│    board_layout / user_feature_overrides / reading_findings_cache / llm_cache │
└──────┬───────────────────────────────────┬───────────────────────────────────┘
       │                                   │
       ▼                                   ▼
┌─────────────────────────────────┐ ┌──────────────────────────────────────────┐
│ 3. ASYNC WORKER / BUILD BOUNDARY│ │ 4. SYNCHRONOUS REQUEST PATH (Lambda API) │
│  • <board>.sub.* ledgers (<1s)  │ │  • GET /api/board/:board/v3 (<=300ms)    │
│  • Gemini Context Cache prewarm │ │  • GET /api/dashboard/sections-stream    │
│    (parts[0] >= 1024 tok)       │ │  • PUT /api/board/:board/v3/layout (409) │
│  • Grouped Oracle+Personalizer  │ │  • Pure selection -> AreaBrief + gating  │
│  • Writes technique_outputs     │ │  • Zero LLM / zero DB astrology compute  │
└─────────────────────────────────┘ └──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5. SCHEDULED SWEEP BOUNDARY (EventBridge -> POST /events · Every 45 Min)     │
│    informIndividualCacheUsed -> recycleIndividualCaches + runScheduledSweep  │
│    Purges used Gemini cachedContents, reading_findings_cache, technique_outputs│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Boundary Guarantees
1. **Zero Node Astrology Guarantee:** TypeScript modules only select, compare ISO dates, join `DigestView`/`ActivationRow[]`, evaluate `evaluateD1D9MutualConfirmation` from stored dignities, and format prose. Verified by `noAstrologyInNode.test.ts`.
2. **Self-Only RBAC & Encryption Guarantee:** Every consumer route invokes `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`). All derived prose, digests, technique outputs, and cache tables are registered in `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1`), and responses emit `Cache-Control: private, no-store, no-cache, must-revalidate`.
3. **Fail-Closed Timing & Auth Guarantee:** Missing `AnnualRow.yearLord` or incomplete clocks fail closed to `stance = 'get_through'`. Auth lock checks (`503 auth_unavailable`), OTP rate limits, and `CORS_ORIGINS` fail closed.
4. **Dual-Plane Error & Performance Telemetry (`M37` / `M39`):** Consumer wire responses mask internal/Prisma details (`INTERNAL_SERVER_ERROR` + `requestId`), while writing PII-redacted error rows to `app_error_events` and timing rows to `page_execution_logs` for `aiadastra_admin`.
5. **Isolated Research Verification (`M38`):** QA cohorts and 10-step reverse-engineered traces run exclusively against `research_*` staging tables and must score `>= 95%` in `research.technical_verifier`.

---

## 6. Ingredients

| Category | Ingredient / Symbol / Config | Purpose | Owner |
|---|---|---|---|
| **Libraries** | `@prisma/client`, `zod`, `@google/generative-ai` (header `x-goog-api-key`), `express`, `vitest`, `react`, `lucide-react`, Tailwind CSS | Persistence, strict LLM schema validation, Gemini explicit caching, API, tests, UI | Server / Web Agents |
| **Astrological Env Vars** (`src/config/env.ts`) | `D9_MATURITY_AGE_YEARS=36` (clamped `18..100`), `DIGEST_VERSION`, `DIGEST_SWEEP_MAX_MS`, `LUCKY_*` | Age-36 Saturn maturation gate & digest/rule thresholds without hardcoding | Server Config |
| **Board & Cache Env Vars** | `READING_CACHE_RECYCLE_MINUTES=45`, `READING_EXPLICIT_CACHE=1`, `CARDS_GROUP_PACK=1`, `CARDS_GROUP_SIZE_BOARD=3`, `CARDS_GROUP_SIZE_REST=6`, `BOARD_PERIODS_MAX=6`, `BOARD_PERIODS_PAST_DAYS=180`, `BOARD_KEY_DATES_MAX=6`, `BOARD_KEY_DATES_PAST_DAYS=60`, `BOARD_FEATURES_OFF`, `BOARD_FEATURES_PREMIUM`, `SELF_V3_ROUTE_BUDGET_MS=2000`, `RELATIONSHIPS_V3_ENABLED`, `WORK_V3_ENABLED` | 45-min cache lifecycle, grouped pack tuning, window truncation, feature toggles, gradual rollout | Server Config / Ops |
| **Web Env Vars** | `VITE_CARD_TOOL_TIMEFRAME_WEEK_MAX_DAYS=21`, `VITE_CARD_TOOL_TIMEFRAME_MONTH_MAX_DAYS=95` | Duration-honest timeframe bucketing thresholds in `toolVetting.ts` | Web Agent |
| **IAM & EventBridge** | Lambda `aiastra-server-api` execution role; EventBridge rule invoking `POST /events` (`SWEEP_TASK='llm-cache-sweep'`); GitHub Actions OIDC (`amplifyv2`, account `900515855120`) | Automated 45-minute cache recycling and CI/CD Lambda/Amplify deploys | Deploy Session / Ops |
| **Database Migrations** | Migration 75 (`20261115100000_user_notifications_m53`) already applied; zero migrations needed for planning docs or JSON-backed sub-boards; optional additive index migration if compound `board_layout.board` keys are adopted | Schema readiness | Server Agent (additive via `npx.cmd prisma migrate deploy`) |
| **Fixtures & Test Data** | Golden fixture `G1`, calibration chart `c584c0a3` (D1 Pisces / D9 Leo / D10 Sagittarius), `research_kundlis` multi-age cohorts (`20s`–`70s`) | Regression, 4-school verification, and `>=95%` verifier gating | QA / Research Agent |

---

## 7. Action Steps in Sequence

### 7.1 Documentation & Planning Sequence (Current Effort)
1. **Step 1 (M1 — Done here):** Author `docs/dashboards/00-plan.md` covering all 9 `AGENTS.md` sections, system audit, card contract standards, and full attribution. **Owner:** `docs/dashboards/00-plan.md`. **DoD:** All 9 sections verified against codebase; zero code edits.
2. **Step 2 (M2 — Parallelizable across 4 docs):** Author Relationships planning specs with full card mechanics (Nakshatras/Navatara/Tara Bala, Rasi/Arudhas, Vargas, Dasha MD/AD/PD, Transits/Double Transit, TP `yearLord`), Google Search trends synthesis, and attributions:
   - `docs/dashboards/01-dating-and-romance.md` (Cards 1–10)
   - `docs/dashboards/02-marriage-and-partnership.md` (Cards 11–22, enforcing D9 age-36+ gate)
   - `docs/dashboards/03-friendships-and-social-circle.md` (Cards 23–29, documenting D11 proxy)
   - `docs/dashboards/04-professional-relationships-and-allies.md` (Cards 30–37)
3. **Step 3 (M3 — Parallelizable with Step 2):** Author Career & Work planning specs with full card mechanics, search trend synthesis, and attributions:
   - `docs/dashboards/05-career-start-and-first-break.md` (Cards 38–44)
   - `docs/dashboards/06-primary-job-and-corporate-growth.md` (Cards 45–55)
   - `docs/dashboards/07-hobby-craft-and-creative-projects.md` (Cards 56–61)
   - `docs/dashboards/08-business-and-field-of-business.md` (Cards 62–72, documenting D11 proxy)
4. **Step 4 (M4):** Update `docs/TODOS.md` under P1 with review instructions and actionable implementation recommendations for `00-plan.md` through `08-*.md`, and run final verification (72-card count, zero engine-name leakage in copy, clean `git status` on source files).

### 7.2 Subsequent Implementation Sequence (Post-Planning Execution Roadmap)
5. **Step 5 (`doc 80` R1–R4 Prerequisites + Shared Contracts & Catalogue):**
   - Land `doc 80` R1 (`kind === 'TP'` `yearLord` parsing in `src/reading/digest/build.ts:1177–1196` + `annual_export.py`), R2 (`SERVED_VARGAS` -> env-gated `SERVED_VARGAS_LIST` in `src/reading/chartData/catalog.ts:133`), R3 (explicit varga `house`/`lagna`/dignity fields in `export.py` / `dignities.dN`), and R4 (divisional TP pulls + `ANNUAL_CHART_VARGAS` expansion in `src/reading/digest/annualSet.ts:11`).
   - Extend `src/reading/boards/catalogue.ts` and `src/boards/features.ts` (plus `FACT_CATALOG` mapping in `src/profile/facts.ts`) with all 72 cards and `showWhen` predicates; register `<board>.sub.*` and area techniques in `src/techniques/catalog.ts`, `src/reading/oracle/digestSlices.ts`, and `src/techniques/subagentCachePlan.ts`. **Gate:** `contracts.test.ts` + `summaries.test.ts` green.
6. **Step 6 (Deterministic Sub-Techniques — Parallelizable by Hub):** Implement `dating.ts`, `marriage.ts`, `friendships.ts`, `professional.ts`, `careerStart.ts`, `primaryJob.ts`, `hobby.ts`, `business.ts` under `src/reading/area/` using `evaluateD1D9MutualConfirmation`, `runningTithiPravesha`, `resolveActiveMahadasha`, and `activateDoubleTransit`. **Gate:** `noAstrologyInNode.test.ts` + `dashaNavamshaConfirmation.test.ts` green, `< 1 s` ledger build.
7. **Step 7 (Grouped Card Packs & Routes):** Wire `src/reading/cards/group.ts` and `src/routes/boardCardsRoutes.ts` (`GET /api/board/:board/v3`, versioned `PUT /layout` 409 guard, `POST /confirm`, `POST /cards/:id/read`) with 45-minute `informIndividualCacheUsed` hooks. **Gate:** Lab replay `< 30 s` cold / `< 10 s` profile rebuild / `> 70%` warm cache share.
8. **Step 8 (Frontend Lenses & Toolbar Vetting):** Ship segmented 4-lens switcher and unified `BoardV3View` on `/love` and `/work` in `AIAstra_WEB` passing all 5 gates of `dashboard-card-toolbar-vetting`.
9. **Step 9 (Engine D11 Upgrade & Cohort QA):** Deploy `varga.d11` export in `AIAstra_Radha`, upgrade Dashboards `03`, `04`, and `08` from proxy to native `D11`, and pass `research.technical_verifier >= 95%`.

### 7.3 Master Index of All 8 Dashboards & 72 Cards

| # | Dashboard Doc | Hub / Lens | Cards | Primary Vargas | Primary Houses, Karakas & Arudhas |
|---|---|---|---|---|---|
| 1 | `01-dating-and-romance.md` | Relationships · Dating | 10 (`#1–10`) | `D1, D9, D7` | 5th, 11th, 12th; Venus, Mars, Moon; `A5`, `DK` |
| 2 | `02-marriage-and-partnership.md` | Relationships · Marriage | 12 (`#11–22`) | `D1, D9 (36+), D7, D30, D2` | 7th, 2nd, 4th, 8th, 12th; Jupiter, Venus; `UL`, `DK`, `AK` |
| 3 | `03-friendships-and-social-circle.md` | Relationships · Friends | 7 (`#23–29`) | `D1, D9, D11 (proxy)` | 11th, 3rd, 9th; Jupiter, Mercury, Moon; `A11`, `AL` |
| 4 | `04-professional-relationships-and-allies.md` | Relationships · Allies | 8 (`#30–37`) | `D10, D11 (proxy), D30` | `D10` 6th, 7th, 10th, 11th; Sun, Saturn, Mercury; `A10`, `A7`, `A11` |
| 5 | `05-career-start-and-first-break.md` | Work · Career Start | 7 (`#38–44`) | `D24, D10, D1, D4` | 4th, 5th, 9th -> 6th, 10th; Mercury, Jupiter, Saturn; `AmK` |
| 6 | `06-primary-job-and-corporate-growth.md` | Work · Primary Job | 11 (`#45–55`) | `D10, D2, D24, D30, D4` | `D10` 6th, 10th, 11th, 2nd; Saturn, Sun, Mercury; `AmK`, `A10` |
| 7 | `07-hobby-craft-and-creative-projects.md` | Work · Hobby & Craft | 6 (`#56–61`) | `D7, D24, D16, D10` | 3rd, 5th, 11th; Venus, Mercury, Moon, Mars; `A11` |
| 8 | `08-business-and-field-of-business.md` | Work · Business | 11 (`#62–72`) | `D10, D2, D4, D11 (proxy), D30` | 3rd, 7th, 11th, 2nd, 4th; Mars, Rahu, Mercury, Sun; `AmK`, `A7`, `A10` |

---

## 8. Development Phases

| Phase | Scope | Closing Verification Gate | Deferred Items |
|---|---|---|---|
| **Phase 1: Planning & Research Docs (Current)** | `docs/dashboards/00-plan.md` through `08-*.md` + `docs/TODOS.md` entries | All 72 cards specified with 6-layer mechanics, Search trends, zero engine names in copy, full attributions, clean code tree (`git status`) | All TypeScript/React code changes |
| **Phase 2: Relationships Core (Dating & Marriage)** | `doc 80` R1 (`kind === 'TP'` `yearLord` parsing) + R2/R3 `D30` unlock; Cards `1–22` (`01`, `02`), `dating.ts`, `marriage.ts`, `D9` age-36+ gate, `/love` v3 lens switcher (`RELATIONSHIPS_V3_ENABLED=1`) | `tsc --noEmit`, `contracts.test.ts`, `dashaNavamshaConfirmation.test.ts`, Lab replay `< 30 s` cold / `> 70%` cache hit, Playwright screenshots | Friendships & Professional Allies lenses |
| **Phase 3: Work Core (Career Start & Primary Job)** | `doc 80` R2/R3/R4 (`D24`/`D30` in `SERVED_VARGAS_LIST` + `ANNUAL_CHART_VARGAS` divisional TP pulls) + `FACT_CATALOG` mapping; Cards `38–55` (`05`, `06`), `careerStart.ts`, `primaryJob.ts`, `/work` v3 lens switcher (`WORK_V3_ENABLED=1`) | `tsc --noEmit`, `noAstrologyInNode.test.ts`, `summaries.test.ts`, Lab replay & NDJSON streaming latency check | Hobby & Business lenses |
| **Phase 4: Expansion (Friends, Allies, Hobby, Business)** | `doc 80` R2/R3/R4 (`D16`/`D4` TP divisional pulls); Cards `23–37` & `56–72` (`03`, `04`, `07`, `08`), `D11` proxy routing, `D4`/`D7`/`D16`/`D30` card ledgers, `workrel.*` `/love` Allies routing + `/work` cross-links | Full 72-card catalogue tests, 5-Gate Toolbar Vetting checklist, 45-min cache sweep verification | Native `D11` engine export |
| **Phase 5: D11 Native Upgrade, Research Cohort & Production Release** | Complete `doc 80` R2/R3 (`varga.d11` export from calculation engine), run 12-person multi-age (`20s`–`70s`) cohort via `research.technical_verifier`, push `develop` -> `release-candidate-staging` | `research.technical_verifier >= 95%`, zero `app_error_events` regressions, Lambda + Amplify health checks | `Chart details` historical IP scrub (`doc 74`), Admin Feature Switches UI |

---

## 9. One Recommendation

### Chosen Design: **Two Top-Level Hubs (`/love` and `/work`) with Four Status-Routed Contextual Sub-Lenses Each, Backed by Shared Sub-Techniques and Grouped Prefix-Cached Packs**

Keep **Relationships** (`/love`) and **Work** (`/work`) as the two top-level navigation items alongside **Self** (`/you`), and surface the 8 domains as **4 contextual sub-lenses inside each hub** defaulted automatically from `person_facts` (`love.status`, `work.status`, `age_band`). Under the hood, share one deterministic build context per individual, execute `<board>.sub.*` ledgers once per boundary into `technique_outputs`, synthesize card groups over a single `parts[0]` prefix cache (`CARDS_GROUP_PACK=1`), and select cards purely into `AreaBrief`.

**Why this wins:** It gives users surgical astrological relevance (a 23-year-old graduate never sees management or in-law cards) without cluttering the sidebar with 8 top-level tabs, preserves the existing `/api/board/:board/v3/*` and `Self v3` foundation card investments, and maximizes Gemini prompt-cache reuse (`> 70%`) across sub-lenses.

| Architecture Alternative | Verdict | Rationale |
|---|---|---|
| **A. Two Hubs (`/love`, `/work`) + 4 Contextual Sub-Lenses + Shared Sub-Techniques** | **RECOMMENDED (Chosen)** | Preserves clean navigation, routes automatically by `person_facts`, enforces strict Bhava/Varga separation, and reuses `Self v3` card contracts & prompt caches. |
| **B. Eight Separate Top-Level Sidebar Navigation Tabs** | **Rejected** | Overwhelms consumer navigation, forces users to mentally categorize themselves before seeing a reading, and fragments layout state. |
| **C. Monolithic Love & Work Boards (`doc 69` status quo)** | **Rejected** | Conflates 5th/7th/11th/D10 in Love and D24/D10/D7/D4 in Work; exposes life-stage-inappropriate cards that erode user trust. |
| **D. Uncached Per-Card Individual LLM Calls** | **Rejected** | 72 independent calls would exceed the `< 30 s` cold build budget by 5–10x and eliminate prefix cache savings. |

---

## 10. Classical Literature & Research Attribution Catalog

All astrological mechanics, scoring gates, and user-intent frameworks across `00-plan.md` through `08-*.md` are attributed to the following primary classical treatises, modern Jyotish schools, and empirical research sources:

| Source / Tradition | Author / Origin | Primary Scope & Chapters | Specific Contributions to the 8 Dashboards |
|---|---|---|---|
| **Brihat Parashara Hora Shastra (BPHS)** | Maharishi Parashara | Ch. 3, 6–7, 11–20, 34–41, 45, 46–51, 66–72 | Shodashavarga definitions (`D1..D60`), Bhava classifications (Kendra/Trikona/Dusthana/Upachaya), Graha Pakvata (Saturn age-36 maturation), Raja/Dhana/Viparita yogas, Vimshottari & conditional dashas, Ashtakavarga (`SAV`/`BAV`). |
| **Jaimini Upadesha Sutras** | Maharishi Jaimini | Ch. 1.1–1.4, 2.1–2.4 | Chara Karakas (`AK`, `AmK`, `BK`, `MK`, `PK`, `GK`, `DK`), Arudha Padas (`AL`, `UL`, `A5`, `A7`, `A10`, `A11`), Rasi Drishti, Argala/Virodhargala, Chara & Narayana Dashas. |
| **Phaladeepika** | Mantreswara | Ch. 3–4, 6, 14–20 (sl. 12–15), 26 | Planetary dignities, Vargottama & Neecha Bhanga rules, Graha Pakvata maturation thresholds, Gochara (transit) evaluations from Moon. |
| **Saravali** | Kalyana Varma | Ch. 4, 13–20, 30–35 | Mutual planetary relationships, `Neecha Vargottama` (*Drudha Karma*) vs. auspicious Vargottama differentiation, multi-planet combinations. |
| **Uttara Kalamrita** | Kalidasa | Kanda 1, Varga 4–6 | Fine-grained house/planet Karakatvas (career, litigation, in-laws, hidden assets), Shadbala/Dig Bala nuances, retrograde (*Vakra*) and nodal dignity rules. |
| **Prasna Marga** | Panakkattu Namboodiri | Ch. 1–32 | Diagnostic verification of relationship crises, Gandanta junctions, Ashtakavarga transit timing, and 64th Navamsha / 22nd Drekkana sensitive points. |
| **Tithi Pravesha & The Crux of Vedic Astrology** | Pt. Sanjay Rath (Puri Tradition) | Annual horoscopy & divisional routing treatises | Lunar-solar return (`tp_start`..`tp_end`), `yearLord` (weekday ruler), Hora lord, Muntha, Sahams, Tithi Ashtottari annual clock, post-36 `D9` primacy, `D10`/`D7`/`D24` varga routing. |
| **Double Transit & Vimshottari Timing** | K.N. Rao | *Timing Events Through Vimshottari Dasha*; *Double Transit Phenomenon* | Simultaneous Jupiter + Saturn transit confirmation (`S6D`) over target houses/lords for marriage, childbirth, job change, and promotions. |
| **Muhurta Chintamani & Muhurta** | Daivajna Rama / Dr. B.V. Raman | Panchanga & Nakshatra Taras | 27 Nakshatras, Navatara 9-zone cycle, binary `Tara Bala` favorability, and `Chandra Bala` daily/period gating. |
| **Taittiriya Brahmana & Rigveda** | Vedic Samhitas | *Nakshatra Sukta* | Cosmological deities, motivations, and qualities of the 27 Nakshatras. |
| **Lunar Astro Tradition** | Deepanshu Giri | *Blank Chart Prediction*; *Predicting Through Nakshatras* | Rasi & Nakshatra dispositor chains, Pending Karma houses, and Bhrigu Bindu / 64th Navamsha / 22nd Drekkana transit triggers. |
| **Google Search Trends & Consultation Demand Synthesis** | Internal Product & Practitioner Research (`docs/reading-engine/78 §3.2, §4.2`) | Aggregated consumer search-intent taxonomy across Relationships & Career | Original technical synthesis mapping high-frequency real-world queries (no-contact/exes, mixed signals, marriage delay, layoff anxiety, job vs. business, hobby monetization) to the 72 cards without verbatim external copying. |
