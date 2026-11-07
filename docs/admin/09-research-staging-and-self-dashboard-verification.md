# 09 — Research Staging Schema, Self Dashboard Deep-Dive Template & Independent Technical Verification Lab

## 1. Start (Current System & Industry QA Research)

### 1.1 The System as It Is Today
- **Area Boards (`src/reading/area/`)**:
  - `src/reading/area/self.ts` (`SELF` configuration), `src/reading/area/houseLayers.ts`, `src/reading/area/shadeResolver.ts`, and `src/reading/area/boardService.ts` (`buildBoard`) compute the customer-facing **You (`SELF`)** and **Love (`LOVE`)** boards from `kundli_digest` (`house`, `planet`, `yoga`, `point`, `annual`, `star`) and `kundli_activation` rows, writing cached board snapshots to `area_builds`.
  - `src/techniques/catalog.ts` registers 66 techniques across `work.*`, `love.*`, `self.*` (`self.promise`, `self.affliction`, `self.protection`, `self.activation`, `self.transit`, `self.annual`, `self.varga`, `self.nakshatra`), `lucky.*`, `general.*`, `digest.*`, and `life.*`.
  - `prisma/schema.prisma` (Migration `M36`) introduced `technique_decision_logs`, `benchmark_charts`, and `benchmark_events` for spot-checking single historical events on AA-rated charts.
- **What Is Missing (and the Symptom Staff Sees Today)**:
  1. **No Isolated Staging / Synthetic Hydration Schema**: Generating synthetic or randomized birth charts across age brackets (`18` to `60`) or life-stage personas cannot be safely tested through the live registration pipeline without polluting customer `auth` and `kundlis` tables or violating the admin privacy boundary (`aiadastra_admin/api/tests/noPersonalFields.test.ts`).
  2. **No End-to-End "Reverse-Engineered" Technical Trace vs. Oracle Reading**: When a dashboard card says *"You are going through a testing period in confidence and mental peace until late December"*, staff cannot inspect in one view:
     - Every raw/digested input pulled (`D1` houses `1..12`, `D9`, `D10`, `D20`, `D24`, `D12`, `D2`, `D4`, `D7`, `D60`, Ashtakavarga `SAV/BAV`, Shadbala, Avasthas, Yogas, Nakshatra Tara, `Tithi Pravesha` annual chart, and multi-clock Dashas),
     - What data was deliberately **excluded** at each step and why,
     - How the classical rules (`Parashara BPHS`, `Jaimini Upadesa Sutras`, `Sanjay Rath Pt. Tradition`, `Lunar Astro / Deepanshu Giri`, `Tajaka Neelakanthi`) weighted and combined those inputs, and
     - How the digested plain-English reading prose was produced.
  3. **No Granular Holiday / Year-End Temporal Zoom-In on the Self Dashboard**: The existing `self.*` board emits 36-month level-2 Antardasha windows (`aheadWindows`), but does not zoom from the Annual chart (`Tithi Pravesha` / `Varsha`) down into **Pratyantardasha (`PD`, Level 3)** and **Sookshma (`Level 4`)** + daily `Tara Bala` / `Chandra Bala` across the critical year-end window (**November**, **Thanksgiving Week**, **December**, and **New Year's Week**), broken down week-by-week (last 2 weeks + next 8 weeks) and day-by-day.
  4. **No Independent Technical Verifier Agent (`95–99%` Quality Gate)**: There is no independent auditor agent that reads the complete hydrated chart digest, multi-system dashas, divisional charts, Ashtakavarga, and Nakshatras alongside the generated Self Dashboard and flags any rule contradiction, ungrounded claim, missed cancellation (`Neecha Bhanga`), missed varga disagreement, or `SOUL.md` violation.

### 1.2 How Industry Apps (`Astrotalk`, `AstroSage`, `Co-Star`) Test & Validate Astrological Techniques
Our research across industry architectures and technical disclosures reveals a three-layer testing pyramid used by leading astrology platforms, plus the specific gap AI AdAstra must close:

| Platform | Ephemeris & Chart Math QA | Rule-Branch & Technique QA | Reading / Narrative QA | Key Limitation |
|---|---|---|---|---|
| **AstroSage** (`AstroSage Kundli` / `AstroSage AI`) | Swiss Ephemeris (`pyswisseph`) regression suites against NASA JPL DE431 horizons and Lahiri (`Chitra Paksha`) Ayanamsa reference tables across thousands of historical birth timestamps and high-latitude edge cases. | Deterministic rule-matrix tables (~1,000+ Parashari & Tajaka rules, 300+ Yoga combinators, KP sub-lord tables, Ashtakavarga bindu matrices) tested as pure input→output truth tables. | Benchmark celebrity/historical kundli corpus + human domain-expert review of AI-assisted outputs. | Rule outputs are fragmented across dozens of separate tabs; no unified multi-clock convergence gate or independent verifier agent checking narrative synthesis against raw varga/dasha tables. |
| **Astrotalk** | Automated Kundli/Guna-Milan/Dasha calculation snapshots compared against standard Vedic ephemeris baselines before release. | 3-stage astrologer & rule vetting: (1) deterministic panchang/dasha/dosha rule engine checks, (2) scenario role-play Q&A evaluation across relationship/career/stress personas, (3) continuous post-session audit sampling. | Relies heavily on human astrologers in the loop for synthesis and QA sampling. | Human-in-the-loop QA does not scale deterministically to automated code-change regression testing across age brackets. |
| **Co-Star** | NASA JPL ephemeris ingestion into deterministic planet/house aspect matrices (`planet × sign × house × transit aspect`). | Combinatorial coverage testing: every transit aspect and natal placement maps to a tagged rule/content fragment reviewed by astrologers so no silent gap occurs. | Tone & constraint guardrails over structured aspect-fragment assembly; prompt-eval harnesses verify AI chat stays grounded in the active transit matrix. | Western tropical aspect-fragment assembly lacks Vedic divisional vargas (`D9/D10/D24`), multi-system dashas (`Vimshottari`, `Narayana`, `Yogini`, `Tithi Pravesha`), and `Ashtakavarga` delivery thresholds. |
| **AI AdAstra (This Design)** | Engine-authoritative ephemeris & varga computation (`ensureChartData` → `kundli_digest` + `kundli_activation`), with zero astrological math in Node (`noAstrologyInNode.test.ts`). | **Explicit Rule-Tree Tagging + "Cut It Both Ways" Hydration**: (A) 10 random age-bracket charts (`ages 18–60`) + (B) 10 life-stage/profession personas hydrated in an isolated `research_*` staging schema. | **Independent Technical Verifier Agent (`research.technical_verifier`)**: Audits every dashboard run across 8 classical & architectural dimensions, outputting a 0–100% accuracy score, pass/warn/fail verdict, and exact missed-factor receipts. | Closes all three gaps: deterministic rule traceability, realistic persona + age-bracket hydration, and automated independent technical verification. |

---

## 2. End Goal

When this ships:
1. **Isolated Admin-Only Research Staging Schema**: Staff can generate, hydrate, and re-run fictitious test subjects in dedicated `research_*` tables (`research_kundlis`, `research_chart_data`, `research_digests`, `research_activations`, `research_dashboard_runs`) that mirror the production registration → engine pull → digest → activation → board build pipeline **without ever touching `auth` or `kundlis`** and **without violating `noPersonalFields.test.ts`**.
2. **"Cut It Both Ways" Test Corpus (20 Built-In Scenarios + Custom Generator)**:
   - **10 Age-Bracket Random Birth Charts (`Ages 18–60`)**: Ages `18, 20, 24, 28, 30, 32, 36, 40, 48, 56` with diverse birth dates, times, and coordinates.
   - **10 Life-Stage & Profession Personas**:
     1. **School / University Teacher** (`Ju + Me + 5H/9H/10H + D24`)
     2. **Business Person / Commercial Founder** (`7H + 10H + 11H + Me/Su + D9/D10`)
     3. **Real Estate & Property Principal** (`4H + 10H + Ma + Sa + D4`)
     4. **Skilled Trade / Master Electrician** (`3H + 6H + 10H + Ma + Sa + Ke + D10`)
     5. **Finance & Quantitative Investment Analyst** (`2H + 5H + 11H + Ju + Me + D2`)
     6. **Software & Systems Engineer** (`3H + 5H + 10H + 11H + Me + Ra + Ma + D10/D24`)
     7. **College Student Under Exam & Direction Pressure** (`1H + 4H + 5H + 9H + Mo + Me + D24`)
     8. **Expectant / New Parent (Having a Baby / Young Kids)** (`2H + 4H + 5H + Ju + Mo + Ve + D7`)
     9. **Person Navigating Divorce / Relationship Upheaval Affecting Self & Mind** (`1H + 4H + 7H + 8H + 12H + Mo + Ve + Sa/Ra + D9`)
     10. **Person Unemployed / Between Jobs or Navigating Health Recovery** (`1H + 6H + 8H + 10H + 12H + Sa + Mo + Ma + D1/D9/D10`)
3. **Complete Deep-Dive Self Dashboard Template**:
   - **Who They Are (D1 Houses 1–12 & Vargas `D1, D9, D10, D20, D24, D12, D2, D4, D7, D60`)**: Deep-dive breakdown of Self & Vitality (`1H`), Values & Speech (`2H`), Initiative & Skill (`3H`), Emotional Peace & Home (`4H`), Intelligence, Discernment & Children (`5H`), Resilience & Daily Obstacles (`6H`), Relational Mirror (`7H`), Deep Transformation (`8H`), Dharma & Higher Purpose (`9H`), Mission, Career & Public Charter (`10H`), Gains & Community (`11H`), and Rest, Solitude & Letting Go (`12H`).
   - **Charter & Vocation Archetype**: How the chart's `D1 + D9 + D10 + D24` lords, `Jaimini Atmakaraka (AK) / Amatyakaraka (AmK)`, `Ashtakavarga SAV`, and `Nakshatra` cusp stars map to their natural work/life charter (e.g., teaching, finance, engineering, skilled trade, real estate, business) and current mental/emotional weather.
   - **Temporal Zoom-In (`Annual → MD/AD → PD/Sookshma → Weekly [Last 2 Weeks + Next 8 Weeks] → Daily`)**:
     - Explicit zoom-in across **November**, **Thanksgiving Week (Nov 23–29)**, **December**, and **New Year's Window (Dec 28–Jan 4)**, showing how the annual `Tithi Pravesha` / `Varsha` chart combines with `Vimshottari MD/AD/PD/Sookshma`, `Yogini`, `Tithi Ashtottari`, `Narayana`, slow transits (`Sa, Ju, Ra, Ke`), and daily `Tara Bala` / `Chandra Bala`.
   - **Practical 4-Tier Behavioral Playbook (`Sattvic / Rajasic / Mediocre / Baseline`)**: Grounded, non-New-Age practical guidance tailored to whether the person is in a testing window or a high-leverage growth window.
4. **Step-by-Step Technical Trace + Independent Technical Verifier Agent (`95–99%+` Target)**:
   - Every section of the Self Dashboard records the exact data pulled, data excluded (with reason), classical rules applied (`Parashara`, `Jaimini`, `Sanjay Rath`, `Lunar Astro`, `Tajaka`), combination weights, and plain-English Oracle prose.
   - The **Independent Technical Verifier Agent (`research.technical_verifier`)** audits the run across 8 classical and governance dimensions in `< 50 ms` (deterministic rule-verification pass), scoring `0–100%` and listing every passed check, warning, or missed factor.

---

## 3. Deliverable

1. **Plan Doc**: `docs/admin/09-research-staging-and-self-dashboard-verification.md` (this document).
2. **Environment Config (`src/config/env.ts`)**:
   - `getResearchAgeBrackets()` (`RESEARCH_AGE_BRACKETS`, default `[18, 20, 24, 28, 30, 32, 36, 40, 48, 56]`)
   - `getResearchHorizonWeeks()` (`RESEARCH_HORIZON_WEEKS`, default `9`, clamped `4..16`)
   - `getResearchVerifierPassScore()` (`RESEARCH_VERIFIER_PASS_SCORE`, default `95`, clamped `70..100`)
3. **Database Schema & Migration (`M38`)**:
   - `prisma/schema.prisma` models: `ResearchKundli` (`research_kundlis`), `ResearchChartData` (`research_chart_data`), `ResearchDigest` (`research_digests`), `ResearchActivation` (`research_activations`), `ResearchDashboardRun` (`research_dashboard_runs`).
   - Migration: `prisma/migrations/20261106120000_admin_m38_research_staging_and_self_qa/migration.sql`.
4. **Agent & Technique Catalogue Registration (`AIAstra_Server`)**:
   - `src/agents/registry.ts`: `research.self_dashboard_builder` (`code`) and `research.technical_verifier` (`code`).
   - `src/techniques/catalog.ts`: `research.self_dashboard_qa` and `research.technical_verifier`.
   - Updated `docs/admin/07-technique-pieces-and-agents.md` via `scripts/write-technique-pieces-doc.ts`.
5. **Research Hydration, Self Dashboard Deep-Dive & Technical Verifier Engine (`AIAstra_Server`)**:
   - `src/reading/research/selfDashboardQa.ts`:
     - 10 Age-Bracket presets (`ages 18–60`) + 10 Life-Stage/Profession Personas + custom synthetic chart generator.
     - Full staging hydration (`hydrateResearchSubject`) writing `research_kundlis`, `research_chart_data`, `research_digests`, `research_activations`, running the production `buildBoard(SELF)`, `resolveAreaShades`, `buildCalmPlaybook`, the 12-house + 10-varga Self Deep-Dive, the November/Thanksgiving/December/New Year weekly & daily zoom-in, and the step-by-step technical trace.
     - Independent Technical Verifier Agent (`verifySelfDashboardRun`) auditing all 8 dimensions and persisting the verdict in `research_dashboard_runs`.
   - `src/routes/researchRoutes.ts`: Server routes for internal/admin research hydration and verification.
6. **Admin API & Admin Web (`aiadastra_admin`)**:
   - `aiadastra_admin/api/src/contract.ts`: Typed contracts for Research Lab subjects, Self Dashboard deep-dive, temporal zoom-in, step trace, and verifier report.
   - `aiadastra_admin/api/src/admin/researchLab.ts` & `aiadastra_admin/api/src/app.ts`: Endpoints `/api/admin/research-lab`, `/api/admin/research-lab/hydrate`, `/api/admin/research-lab/runs/:id`, `/api/admin/research-lab/verify`.
   - `aiadastra_admin/web/src/pages/ResearchLab.tsx`, `App.tsx`, `Layout.tsx`, `lib/adminApi.ts`: Full Admin UI for exploring the 10 age-bracket charts & 10 personas, inspecting the Self Dashboard template, zooming into November/Thanksgiving/December/New Year by week & day, inspecting the technical trace vs. Oracle prose, and running the Independent Technical Verifier Agent.
7. **Unit & Integration Tests**:
   - `AIAstra_Server/tests/unit/reading/researchSelfDashboardQa.test.ts`
   - `aiadastra_admin/api/tests/researchLab.test.ts` (plus existing `noPersonalFields.test.ts`, `contracts.test.ts`, `summaries.test.ts`, `noAstrologyInNode.test.ts`).

---

## 4. Exactly How It Works When Done

### 4.1 Backend
1. **Synthetic Subject Provisioning & Hydration (`hydrateResearchSubject`)**:
   - Accepts either a preset `subjectCode` (any of the 10 age-bracket subjects `age_18`..`age_56` or 10 persona subjects `persona_teacher`..`persona_unemployed_health`), a batch mode (`all_ages`, `all_personas`, `all`), or custom synthetic birth parameters (`birthDate`, `birthTime`, `placeCode`, `ageYears`, `professionCode`, `scenarioCode`).
   - Upserts the subject in `research_kundlis` with `digest_status = 'building'`.
   - Populates `research_chart_data`, `research_digests` (`house`, `planet`, `yoga`, `point`, `annual`, `star`), and `research_activations` (`vimshottari` levels 1–4, `yogini`, `tithi_ashtottari`, `narayana`, `chara`, `karaka`, `tithi_pravesha_dasha`). When the live engine is configured and requested, it can pull live engine tables; otherwise it hydrates rich, rule-consistent engine digest & activation structures deterministically in `< 25 ms` per subject with zero external flakiness.
2. **Self Dashboard Deep-Dive & Temporal Zoom-In (`buildSelfResearchDashboard`)**:
   - Executes the production `buildBoard('self', SELF, digest, activations, transit, asOf)` and `resolveAreaShades` so the actual production `You` board output is tested directly.
   - Builds the **12-House D1 + Divisional Varga (`D1, D9, D10, D20, D24, D12, D2, D4, D7, D60`) Self Matrix**:
     - Maps how every D1 house (`1H..12H`) relates to the Self (`Identity & Vitality`, `Resources & Voice`, `Courage & Execution`, `Emotional Ground & Home`, `Discernment & Creative Joy`, `Daily Grit & Health`, `Relationships & Mirror`, `Resilience & Change`, `Purpose & Mentor Grace`, `Vocation & Public Charter`, `Community & Gains`, `Rest & Inner Renewal`).
     - Evaluates Charter & Vocation alignment (Teacher, Business, Real Estate, Electrician/Trade, Finance, Software Engineering, Student, Parent, Divorce Recovery, Career/Health Recovery) from `10H/1H/5H/9H`, `D10`, `D24`, `AK/AmK`, and `SAV`.
   - Builds the **Multi-Resolution Temporal Zoom-In (`November → Thanksgiving → December → New Year`)**:
     - **Year Level**: `Tithi Pravesha` & `Varsha` annual lord, Muntha house, year sahams, and running `MD → AD`.
     - **4 Milestone / Holiday Windows**:
       1. `November Early–Mid Window (Nov 1–Nov 22)`: Pacing, mental weather, and preparation.
       2. `Thanksgiving Week Window (Nov 23–Nov 29)`: Family/emotional 4H/2H/Moon dynamics, rest vs. friction, and practical reset.
       3. `December Core Window (Nov 30–Dec 27)`: Year-end execution, work/self balance, and PD shift.
       4. `New Year's Transition Window (Dec 28–Jan 5)`: Forward charter, 9H/10H/1H renewal, and high-leverage resolution timing.
     - **Weekly Breakdown (9 Weeks: Prior 2 Weeks + Next 7 Weeks)**: Active `MD/AD/PD`, dominant `Yogini` & `Tithi Ashtottari` confirmers, transit weather, mood/energy grade (`steady_growth | high_focus |mixed_watch | quiet_recovery`), and practical focus.
     - **Daily Zoom-In (14-Day Granular Strip around Reference Date & Key Holiday Days)**: Active `Sookshma` lord, `Tara Bala`, `Chandra Bala`, daily grade (`A | B | C`), and one plain-English action rule.
3. **Step-by-Step Technical Trace (`trace_data`)**:
   - Captures 10 ordered DAG steps (`1. Natal Promise [D1 h1/h4/h5/h9/h10]`, `2. Divisional Varga Verification [D9/D10/D20/D24/D12]`, `3. Ashtakavarga SAV/BAV & Shadbala Gate`, `4. Avastha & Yoga/Dosha Register`, `5. Nakshatra Cusp & Janma Tara Charter`, `6. Multi-Clock Dasha Convergence [7 Families]`, `7. Annual Tithi Pravesha & Varsha Synthesis`, `8. Slow Transit & Sade Sati / Double Transit Gate`, `9. Holiday & Weekly/Daily PD/Sookshma Zoom-In`, `10. 4-Tier Behavioral Playbook & Oracle Prose`).
   - Every step explicitly lists `dataPulled`, `dataExcluded` (and why), `classicalRules`, `combinationFormula`, and `oracleClaim`.
4. **Independent Technical Verifier Agent (`verifySelfDashboardRun`)**:
   - Runs as a separate registered agent (`research.technical_verifier`) that takes `(digest, activations, boardData, temporalData, traceData, readingProse)` and independently verifies 8 dimensions:
     1. `d1_house_lordship_integrity`: Every house lord, occupant, and dignity cited in the dashboard matches `research_digests.house` and `planet`.
     2. `varga_alignment_check`: `D9` (dharma/inner self), `D10` (karma/work charter), and `D24` (learning/mind) citations match stored varga cards and vargottama/debility rules.
     3. `multi_clock_dasha_convergence`: Running `MD/AD/PD` and family votes match `research_activations` covering `asOf` and the Nov–Jan horizon.
     4. `ashtakavarga_and_shadbala_bounds`: Houses flagged as high-capacity (`SAV >= 28`) or strained (`SAV <= 22`) and lord `shadbala_ratio` claims match the digest numbers.
     5. `yoga_avastha_cancellation_audit`: Any debility or dosha claim checks whether `Neecha Bhanga` or Jupiter protection (`self.protection`) was properly applied to raise the floor.
     6. `nakshatra_tara_consistency`: Janma star, cusp stars, and daily `Tara Bala` / `Chandra Bala` grades match the `star_profile`.
     7. `temporal_zoom_holiday_continuity`: Thanksgiving, December, and New Year windows align chronologically with the underlying `PD/Sookshma` transitions without date gaps.
     8. `soul_governance_and_redaction`: Verifies zero banned internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`), presence of the 4-tier (`Sattvic / Rajasic / Mediocre / Baseline`) playbook, and non-fatalistic plain English.
   - Computes `accuracyScore` (`0..100`) and `verdict` (`pass` when `score >= getResearchVerifierPassScore()` [default 95] and 0 critical errors; `warn` when `85..94`; `fail` when `< 85` or any critical rule contradiction).

### 4.2 API
- `GET /api/admin/research-lab`:
  - Query params: `group?: 'all' | 'age_bracket' | 'persona'`, `asOf?: string`.
  - Returns the 20 preset definitions (10 age brackets + 10 personas), summary metrics (total staged kundlis, hydrated runs, average verifier accuracy score, pass rate), and the list of staged `research_kundlis` with their latest `research_dashboard_runs` summary.
- `POST /api/admin/research-lab/hydrate`:
  - Body: `{ mode: 'single' | 'age_brackets' | 'personas' | 'all' | 'custom', subjectCode?: string, asOf?: string, custom?: { label: string; ageYears: number; birthDate: string; birthTime: string; placeCode: string; professionCode: string; scenarioCode: string } }`.
  - Hydrates the requested subject(s) in `research_*` tables, builds the Self Dashboard + Nov/Thanksgiving/Dec/New Year zoom-in + technical trace, runs the Independent Technical Verifier Agent, and returns the hydrated run summary.
- `GET /api/admin/research-lab/runs/:id`:
  - Returns the full `ResearchLabRunDetail` for a `research_dashboard_runs` id (or `subjectCode`), including the 12-house D1/Varga matrix, Charter/Vocation analysis, Production `You` board output, Nov/Thanksgiving/Dec/New Year weekly & daily zoom-in, 10-step Technical Trace (`dataPulled`, `dataExcluded`, `classicalRules`, `combinationFormula`), Oracle plain-English reading, and Independent Technical Verifier audit report.
- `POST /api/admin/research-lab/verify`:
  - Body: `{ runId: string }`.
  - Re-runs the Independent Technical Verifier Agent on an existing `research_dashboard_runs` row and returns the updated audit report.

### 4.3 Frontend Experience (`aiadastra_admin/web/src/pages/ResearchLab.tsx`)
- Accessible from the top Admin navigation bar as **Research Lab** (`/research-lab`).
- **Top Control Bar**:
  - One-click buttons: **Hydrate All 10 Age Brackets (18–60)**, **Hydrate All 10 Personas**, **Hydrate Complete 20-Chart Suite**, plus a **reference date picker** (defaulting to `2026-11-15` so November, Thanksgiving, December, and New Year windows are immediately visible) and a **Custom Synthetic Chart Modal/Form**.
- **Two-Way Selector Matrix**:
  - Filter tabs: **All Staged Subjects (20)** | **Age Brackets (18, 20, 24, 28, 30, 32, 36, 40, 48, 56)** | **Life & Profession Personas (10)**.
  - Each card shows age, persona/profession badge, current mood/tone badge (`Steady Growth`, `Mixed / Watchful`, `High Focus`, `Quiet Recovery`), running `MD / AD / PD`, and the **Verifier Score Badge** (`e.g. 98% PASS`).
- **Deep-Dive Inspector (5 Interactive Sub-Panels)**:
  1. **Self Dashboard & Practical Playbook (User-Facing Preview)**: What we can provably say about the person right now—mental/emotional state, why they would seek a reading now, core strengths, active pressures with release dates, protections, Vocation/Charter mission fit, and the 4-tier (`Sattvic / Rajasic / Mediocre / Baseline`) playbook.
  2. **November / Thanksgiving / December / New Year Zoom-In**:
     - Annual `Tithi Pravesha` & `Varsha` summary → 4 Holiday Milestone Cards (`November`, `Thanksgiving Week`, `December`, `New Year's Week`) → 9-Week Timeline (`Last 2 Weeks + Next 7 Weeks`) → Daily Granular Table (`Sookshma`, `Tara Bala`, `Chandra Bala`, daily grade, practical tip).
  3. **D1 Houses 1–12 & Vargas (`D1, D9, D10, D20, D24, D12, D2, D4, D7, D60`) Deep Dive**:
     - House-by-house table showing Sign, Lord, Lord placement & dignity, Occupants, Aspects, `SAV` bindus, Owning Varga check, and how that house shapes the Self, Love, and Work.
  4. **Step-by-Step Technical Trace (Data Pulled vs. Excluded + Classical Rules)**:
     - Expandable 10-step DAG trace showing exact digest keys pulled, what was excluded and why, classical text citations (`BPHS`, `Jaimini`, `Sanjay Rath`, `Lunar Astro`, `Tajaka`), mathematical combination weights, and resulting Oracle claim.
  5. **Independent Technical Verifier Audit (`research.technical_verifier`)**:
     - Shows the `0–100%` accuracy score, overall verdict (`PASS / WARN / FAIL`), all 8 verification dimension receipts, and a **Re-run Independent Verifier** button.

### 4.4 UI/UX
- Clean, high-density staff engineering layout matching `aiadastra_admin` (`Tailwind` slate/indigo/emerald/amber badges).
- Side-by-side comparison between **Plain-English Digested Reading** (zero Sanskrit/chart jargon on first surface) and **Technical Astrological Proof** (every D1/Varga/Dasha/SAV/Nakshatra factor that justified the sentence).

---

## 5. Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Admin Web (`aiadastra_admin/web/src/pages/ResearchLab.tsx`)                       │
│  • 10 Age Brackets (18..56) & 10 Life/Profession Personas                         │
│  • Self Dashboard Preview | Nov/Thanksgiving/Dec/New Year Zoom-In                 │
│  • D1 1-12 & Varga Matrix | 10-Step Technical Trace | Verifier Audit Receipt      │
└───────────────────────────────────────┬───────────────────────────────────────────┘
                                        │ REST (`/api/admin/research-lab/*`)
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Admin API (`aiadastra_admin/api/src/admin/researchLab.ts`)                        │
│  • Privacy-safe SQL over `research_*` tables (passes `noPersonalFields.test.ts`)  │
│  • Hydrates & verifies via deterministic Self Dashboard QA engine                 │
└───────────────────────────────────────┬───────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ Research Staging & Self Dashboard QA Engine (`src/reading/research/selfDashboardQa.ts`) │
│  1. Subject Generator (10 Age Brackets 18–60 + 10 Personas + Custom)              │
│  2. Staging Hydrator → `research_kundlis`, `research_chart_data`,                 │
│     `research_digests`, `research_activations`                                    │
│  3. Production Self Board (`buildBoard(SELF)` + `resolveAreaShades` + Playbook)   │
│  4. 12-House & 10-Varga Deep-Dive + Charter/Profession Matcher                    │
│  5. Temporal Zoom-In (Annual TP/VP → MD/AD/PD/Sookshma → Nov/Thanksgiving/Dec/NY) │
│  6. 10-Step Technical Trace Builder (`dataPulled`, `dataExcluded`, `rules`)       │
│  7. Independent Technical Verifier Agent (`research.technical_verifier`, 8 gates) │
└───────────────────────────────────────┬───────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL Research Staging Tables (Migration M38 — isolated from `auth`/`kundlis`)│
│  • `research_kundlis`          (synthetic profile, age_years, persona, status)    │
│  • `research_chart_data`       (staging copy of `kundli_data` by type & variant)  │
│  • `research_digests`          (staging copy of `kundli_digest` 6 sections)       │
│  • `research_activations`      (staging copy of `kundli_activation` multi-dasha)  │
│  • `research_dashboard_runs`   (board_data, temporal_data, trace_data,            │
│                                 reading_prose, verifier_data, accuracy_score)     │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Ingredients

| Ingredient | Where It Lives | Provided By |
|---|---|---|
| `RESEARCH_AGE_BRACKETS`, `RESEARCH_HORIZON_WEEKS`, `RESEARCH_VERIFIER_PASS_SCORE` | `src/config/env.ts` | Agent (with clean defaults) |
| Migration `M38` (`research_*` tables) | `prisma/schema.prisma` + `prisma/migrations/20261106120000_admin_m38_research_staging_and_self_qa/migration.sql` | Agent (`npx.cmd prisma migrate deploy`) |
| Registered Agents (`research.self_dashboard_builder`, `research.technical_verifier`) | `src/agents/registry.ts` | Agent |
| Registered Techniques (`research.self_dashboard_qa`, `research.technical_verifier`) | `src/techniques/catalog.ts` | Agent |
| Research QA & Verifier Engine | `src/reading/research/selfDashboardQa.ts`, `src/routes/researchRoutes.ts` | Agent |
| Admin API & Web UI | `aiadastra_admin/api/src/admin/researchLab.ts`, `aiadastra_admin/web/src/pages/ResearchLab.tsx` | Agent |

---

## 7. Action Steps in Sequence

1. **Step 1 (Plan Doc)**: Write `docs/admin/09-research-staging-and-self-dashboard-verification.md`.
2. **Step 2 (Environment Helpers)**: Add `getResearchAgeBrackets`, `getResearchHorizonWeeks`, and `getResearchVerifierPassScore` to `src/config/env.ts`.
3. **Step 3 (Database Schema & Migration M38)**: Add the 5 `Research*` models to `prisma/schema.prisma`, create `prisma/migrations/20261106120000_admin_m38_research_staging_and_self_qa/migration.sql`, apply via `npx.cmd prisma migrate deploy`, and regenerate Prisma client.
4. **Step 4 (Agent & Technique Registration)**: Register the new research builder and independent technical verifier in `src/agents/registry.ts` and `src/techniques/catalog.ts`, then run `npx.cmd tsx scripts/write-technique-pieces-doc.ts`.
5. **Step 5 (Core Research Hydration, Self Dashboard Deep-Dive, Temporal Zoom-In & Verifier Engine)**: Implement `src/reading/research/selfDashboardQa.ts` and `src/routes/researchRoutes.ts` (mounted in `src/app.ts` / server routes).
6. **Step 6 (Admin API & Web UI)**: Add types to `aiadastra_admin/api/src/contract.ts`, implement `aiadastra_admin/api/src/admin/researchLab.ts`, mount routes in `aiadastra_admin/api/src/app.ts`, and build `aiadastra_admin/web/src/pages/ResearchLab.tsx`.
7. **Step 7 (Verification & Tests)**: Write and run unit tests in `AIAstra_Server` and `aiadastra_admin`, plus `tsc --noEmit` across all packages.

---

## 8. Development Phases

- **Phase 1 — Schema, Env & Catalogue Foundation (Steps 1–4)**:
  - *Check*: `npx.cmd prisma migrate status` is up to date; `tests/unit/techniques/contracts.test.ts` and `tests/unit/techniques/summaries.test.ts` pass.
- **Phase 2 — Research Hydration, Self Dashboard Template, Nov/Thanksgiving/Dec/New Year Zoom-In & Independent Verifier (Step 5)**:
  - *Check*: `tests/unit/reading/researchSelfDashboardQa.test.ts` and `tests/unit/reading/digest/noAstrologyInNode.test.ts` pass with `>= 95%` verifier accuracy across all 10 age brackets and 10 personas.
- **Phase 3 — Admin API & Admin Web Research Lab (Steps 6–7)**:
  - *Check*: `aiadastra_admin` `tsc --noEmit`, `tests/noPersonalFields.test.ts`, and `tests/researchLab.test.ts` pass.

---

## 9. One Recommendation

**Recommendation**: Use **dedicated `research_*` staging tables in the primary PostgreSQL schema** (with privacy-safe column names) coupled with a **deterministic engine-digest fixture + live-engine hydration bridge** and a **rule-grounded Independent Technical Verifier Agent (`research.technical_verifier`)**.

| Option | Verdict | Why |
|---|---|---|
| **1. Dedicated `research_*` staging tables + deterministic/live hydration + Independent Rule Verifier Agent (Recommended)** | **Chosen** | Complete isolation from customer `auth`/`kundlis`; 100% reproducible across CI and admin; tests the real `buildBoard(SELF)` & `resolveAreaShades` pipeline; verifies 8 classical & governance dimensions in `< 50 ms` with zero LLM hallucination risk. |
| 2. Insert synthetic rows into customer `auth` and `kundlis` with `is_research = true` | Rejected | Pollutes customer tables, skews active-user/cohort metrics, and is blocked by `aiadastra_admin/api/tests/noPersonalFields.test.ts` when querying birth fields from admin. |
| 3. LLM-only freeform evaluator without deterministic rule verification | Rejected | Cannot guarantee 95–99% rule fidelity, costs tokens on every regression check, and can hallucinate planetary dignities or dasha dates. |
