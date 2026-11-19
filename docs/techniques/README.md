# Technique Architecture & One-Per-Page Visual Illustrations

> **Design Blueprint Reference**: [`docs/reading-engine/56-technique-pieces-and-validity-windows.md`](../reading-engine/56-technique-pieces-and-validity-windows.md) · [`docs/reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md`](../reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md) · [`docs/admin/07-technique-pieces-and-agents.md`](../admin/07-technique-pieces-and-agents.md)  
> **Priority #2 Roadmap**: `docs/reading-engine/` Docs 80 & 81 (Gap Analysis & Priority #2 Engine Capabilities Architecture)  
> **Source of Truth in Code**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/techniques/pieces.ts`](../../src/techniques/pieces.ts) · [`src/techniques/piecesDoc.ts`](../../src/techniques/piecesDoc.ts) · [`src/techniques/layouts.ts`](../../src/techniques/layouts.ts) · [`src/agents/registry.ts`](../../src/agents/registry.ts)

Every reading and board function in AI AdAstra is a registered **Technique Contract** (`TechniqueDef`) assembled from standardized, reusable **Pieces** (`Reader`, `Scorer / Checker`, `Date-Range Window Cache Gate`, `Prompt`, `Output Schema`, and `Agent`).

While raw planetary positions, lagna degrees, and horas shift every ~2 hours (and panchang limbs shift daily, dasha sub-periods shift over weeks/months, and solar/lunar return charts shift annually), **the technique machinery itself stays identical**. By saving each technique's digested output alongside its applicable validity date range `[valid_from, valid_to)`, the server avoids rehashing unchanged tables and **skips the processing LLM or code agent (`status: 'skipped'`)** whenever a request arrives inside the valid window.

---

## Manual Volumes (One Illustration Per Page)

| Volume | File | Category / Board | Pages | Contents |
|---|---|---|---|---|
| **Vol. 01** | [`01-architecture-and-reusable-pieces.md`](./01-architecture-and-reusable-pieces.md) | **Architecture & Digest (`digest.*`)** | 10 Pages | End-to-end system architecture, the 5 classes of reusable Pieces, the Date-Range Window Cache Gate (`piece.cache.date_range_window`), Recipe Families & Freshness Tiers, Error-Correction & Anti-Hallucination Gates, and the 3 Digest techniques (`digest.build`, `digest.annual_set`, `digest.activation`). |
| **Vol. 02** | [`02-general-reading-illustrations.md`](./02-general-reading-illustrations.md) | **General Reading (`general.*` / `chat`)** | 15 Pages | One-per-page illustrations for all 15 General Reading techniques: Intake, Clarify, 6 Graph Specialist Analysts (`promise`, `dasha`, `annual`, `transit`, `nakshatra`, `prashna`), 4 Deterministic Code Readers (`varga_dynamics`, `strength_yoga`, `jaimini`, `person`), Oracle Readers (`R01–R14, P1–P3`), Oracle Synthesizer (`general.oracle`), and Validator (`general.validator`). |
| **Vol. 03** | [`03-self-board-illustrations.md`](./03-self-board-illustrations.md) | **Self / You Board (`self.*`, `research.*` / `you`)** | 10 Pages | One-per-page illustrations for all 8 Self house-state layers over Houses `1, 4, 5, 9, 12` and the Moon (`D1, D9, D20, D24, D12, D4, D7, D60`): `self.promise`, `self.affliction`, `self.protection`, `self.activation`, `self.transit`, `self.annual`, `self.varga`, `self.nakshatra`, plus the 2 Research Self Dashboard & Technical Verifier techniques (`research.self_dashboard_qa`, `research.technical_verifier`). |
| **Vol. 04** | [`04-love-board-illustrations.md`](./04-love-board-illustrations.md) | **Love Board (`love.*` / `love`)** | 11 Pages | One-per-page illustrations for all 8 Love house-state layers over Houses `7, 5, 11, 2, 4, 8, 12` (`D1, D9, D7, D30`) plus the 3 companion-memory sub-area techniques (`love.meet`, `love.health`, `love.reconcile`). |
| **Vol. 05** | [`05-work-board-illustrations.md`](./05-work-board-illustrations.md) | **Work Board (`work.*` / `work`)** | 9 Pages | One-per-page illustrations for all 9 Work techniques over Houses `10, 6, 1, 2, 11` (`D1, D10, D9, D60`): `work.present_tone`, `work.security_grade`, `work.subarea_windows`, `work.horizons`, `work.looking_back`, `work.annual_family`, `work.conditional_family`, `work.karaka_family`, `work.d10_check`. |
| **Vol. 06** | [`06-lucky-times-and-life-illustrations.md`](./06-lucky-times-and-life-illustrations.md) | **Lucky Times (`lucky.*`) & Life (`life.*`)** | 21 Pages | One-per-page illustrations for all 4 shared Panchang/Muhurta techniques (`lucky.day_tables`, `lucky.panchang_limbs`, `lucky.avoid_bands`, `lucky.personal_overlay`), all 13 scenario techniques (`lucky.work.*`, `lucky.love.*`, `lucky.money.*`, `lucky.travel.*`, `lucky.study.*`, `lucky.home.*`), and all 4 Life Reading / Timeline techniques (`life.promise_scale`, `life.timing_agreement`, `life.mahadasha_charter`, `life.dashboard`). |

---

## Standardized Reusable Pieces Quick Reference

| Piece Class | Canonical Piece ID | Catalogue Piece ID (`src/techniques/pieces.ts`) | Layout (`src/techniques/layouts.ts`) | Default Freshness Window |
|---|---|---|---|---|
| **Digest Slicer** | `piece.digest.house_cards` | `reader:house/house_card` | `house_card` (12 cols) | `natal` (`open` until `digest_version` changes) |
| **Digest Slicer** | `piece.digest.planet_cards` | `reader:planet/planet_card` | `planet_card` (16 cols) | `natal` (`open` until `digest_version` changes) |
| **Digest Slicer** | `piece.digest.yoga_register` | `reader:yoga/yoga_row` | `yoga_row` (7 cols) | `natal` (`open` until `digest_version` changes) |
| **Digest Slicer** | `piece.digest.point_cards` | `reader:point/point_row` | `point_row` (6 cols) | `natal` (`open` until `digest_version` changes) |
| **Digest Slicer** | `piece.digest.star_profile` | `reader:star/star_profile` | `star_profile` (6 cols) | `natal` (`open` until `digest_version` changes) |
| **Digest Slicer** | `piece.digest.annual_set` | `reader:annual/annual_row` | `annual_row` (12 cols) | `annual` (active TP/VP year or `90d` fallback) |
| **Calendar / Sky Loader** | `piece.activation.calendar_slice` | `reader:activation/activation_row` | `activation_row` (8 cols) | `dasha` (shortest active period or `30d` fallback) |
| **Calendar / Sky Loader** | `piece.transit.sky_overlay` | `reader:transit/transit_row` | `transit_row` (9 cols) | `transit` (epoch-aligned `2h` window) |
| **Calendar / Sky Loader** | `piece.panchang.day_limbs` | `reader:panchang/panchang_day` | `panchang_day` (12 cols) | `daily` (local place day `[00:00, 24:00)`) |
| **Calendar / Sky Loader** | `piece.panchang.personal_overlay` | `reader:panchang/panchang_day` | `panchang_day` (12 cols) | `daily` (local place day `[00:00, 24:00)`) |
| **Calendar / Sky Loader** | `piece.prashna.cast_2h` | `reader:prashna/prashna_card` | `prashna_card` (8 cols) | `question` (cast for the question moment) |
| **Scorer / Checker** | `piece.scorer.promise_layer` | `agent:area.self_board` / `agent:area.love_board` / `agent:life.dashboard` | Deterministic Code | `natal` |
| **Scorer / Checker** | `piece.scorer.affliction_layer` | `agent:area.self_board` / `agent:area.love_board` | Deterministic Code | `dasha` (tracks period release date) |
| **Scorer / Checker** | `piece.scorer.protection_layer` | `agent:area.self_board` / `agent:area.love_board` | Deterministic Code | `natal` |
| **Scorer / Checker** | `piece.scorer.varga_agreement` | `agent:area.career_map` / `agent:reading.code.varga_dynamics` | Deterministic Code | `natal` / `dasha` |
| **Scorer / Checker** | `piece.scorer.nakshatra_charter` | `agent:area.self_board` / `agent:area.love_board` | Deterministic Code | `natal` / `dasha` |
| **Scorer / Checker** | `piece.voter.five_family_clock` | `agent:area.career_map` / `agent:area.self_board` / `agent:area.love_board` | Deterministic Code | `dasha` / `transit` |
| **Scorer / Checker** | `piece.voter.security_gate` | `agent:area.career_map` | Deterministic Code | `transit` / `dasha` |
| **Scorer / Checker** | `piece.code_reader.rule_engine` | `agent:reading.code.*` | Deterministic Code (`findings.v2`) | `natal` |
| **Cache Gate** | `piece.cache.date_range_window` | `validityWindow` + `techniqueCacheKey` | `kundli_technique_windows` | Skips LLM/code agent when `valid_from <= as_of < valid_to` |
| **LLM / Synthesis** | `piece.llm.specialist_analyst` | `agent:reading.analyst.*` | `findings.v2` | Cached by window when `scope === 'kundli'` |
| **LLM / Synthesis** | `piece.llm.oracle_reader` | `agent:reading.reader` | `findings.v2` | Natal readers reused across questions |
| **LLM / Synthesis** | `piece.llm.synthesizer` | `agent:reading.oracle` / `agent:reading.synth` | `answer.markdown` (`findings_in`) | Per-question synthesis over cached findings |
| **LLM / Synthesis** | `piece.validator.rule_and_model` | `agent:reading.validator` | `validator.v1` (`text_in`) | `< 5 ms` rule check + `2 s` model check |

---

## Complete Catalogue Index (69 Techniques)

### 1. Digest Foundation (`digest.*` — Vol. 01)
- [`digest.build`](./01-architecture-and-reusable-pieces.md#page-8-of-10--digestbuild-kundli-digest-first-time-breakdown) — Kundli digest (the first-time breakdown)
- [`digest.annual_set`](./01-architecture-and-reusable-pieces.md#page-9-of-10--digestannual_set-annual-set-ten-years-back-and-ahead) — Annual set, ten years back and ahead
- [`digest.activation`](./01-architecture-and-reusable-pieces.md#page-10-of-10--digestactivation-activation-calendar-thirty-years-ahead) — Activation calendar, thirty years ahead

### 2. General Reading (`general.*` — Vol. 02)
- [`general.intake`](./02-general-reading-illustrations.md#page-1-of-15--generalintake-intake) — Intake
- [`general.clarify`](./02-general-reading-illustrations.md#page-2-of-15--generalclarify-clarify) — Clarify
- [`general.promise`](./02-general-reading-illustrations.md#page-3-of-15--generalpromise-house-promise-analyst) — House promise analyst
- [`general.varga_dynamics`](./02-general-reading-illustrations.md#page-4-of-15--generalvarga_dynamics-varga-dynamics-analyst) — Varga dynamics analyst (deterministic code reader)
- [`general.dasha`](./02-general-reading-illustrations.md#page-5-of-15--generaldasha-dasha-analyst-all-systems) — Dasha analyst (all systems)
- [`general.annual`](./02-general-reading-illustrations.md#page-6-of-15--generalannual-annual-set-analyst) — Annual set analyst
- [`general.transit`](./02-general-reading-illustrations.md#page-7-of-15--generaltransit-transit-analyst) — Transit analyst
- [`general.nakshatra`](./02-general-reading-illustrations.md#page-8-of-15--generalnakshatra-nakshatra-analyst) — Nakshatra analyst
- [`general.strength_yoga`](./02-general-reading-illustrations.md#page-9-of-15--generalstrength_yoga-strength-and-yoga-analyst) — Strength and yoga analyst (deterministic code reader)
- [`general.jaimini`](./02-general-reading-illustrations.md#page-10-of-15--generaljaimini-jaimini-analyst) — Jaimini analyst (deterministic code reader)
- [`general.prashna`](./02-general-reading-illustrations.md#page-11-of-15--generalprashna-question-chart-analyst) — Question chart analyst
- [`general.person`](./02-general-reading-illustrations.md#page-12-of-15--generalperson-the-person-in-your-chart) — The person in your chart (deterministic code reader)
- [`general.reader`](./02-general-reading-illustrations.md#page-13-of-15--generalreader-oracle-readers-r01r14-p1p3) — Oracle readers (R01–R14, P1–P3)
- [`general.oracle`](./02-general-reading-illustrations.md#page-14-of-15--generaloracle-oracle-and-synthesizer) — Oracle and synthesizer
- [`general.validator`](./02-general-reading-illustrations.md#page-15-of-15--generalvalidator-validator) — Validator

### 3. Self / You Board (`self.*` & `research.*` — Vol. 03)
- [`self.promise`](./03-self-board-illustrations.md#page-1-of-10--selfpromise-natal-promise-of-houses-1-4-and-5-with-the-moon) — Natal promise of houses 1, 4 and 5 with the Moon
- [`self.affliction`](./03-self-board-illustrations.md#page-2-of-10--selfaffliction-afflictions-on-houses-1-4-and-5-with-the-moon) — Afflictions on houses 1, 4 and 5 with the Moon
- [`self.protection`](./03-self-board-illustrations.md#page-3-of-10--selfprotection-what-protects-houses-1-4-and-5-with-the-moon) — What protects houses 1, 4 and 5 with the Moon
- [`self.activation`](./03-self-board-illustrations.md#page-4-of-10--selfactivation-activation-of-houses-1-4-and-5-by-every-dasha-system) — Activation of houses 1, 4 and 5 with the Moon by every dasha system
- [`self.transit`](./03-self-board-illustrations.md#page-5-of-10--selftransit-transits-over-houses-1-4-and-5-with-the-moon) — Transits over houses 1, 4 and 5 with the Moon
- [`self.annual`](./03-self-board-illustrations.md#page-6-of-10--selfannual-this-years-chart-for-houses-1-4-and-5-with-the-moon) — This year's chart for houses 1, 4 and 5 with the Moon
- [`self.varga`](./03-self-board-illustrations.md#page-7-of-10--selfvarga-owning-divisional-chart-of-houses-1-4-and-5-with-the-moon) — Owning divisional chart of houses 1, 4 and 5 with the Moon
- [`self.nakshatra`](./03-self-board-illustrations.md#page-8-of-10--selfnakshatra-nakshatra-charter-of-houses-1-4-and-5-with-the-moon) — Nakshatra charter of houses 1, 4 and 5 with the Moon
- [`research.self_dashboard_qa`](./03-self-board-illustrations.md#page-9-of-10--researchself_dashboard_qa-research-self-dashboard-deep-dive--novthanksgivingdecnew-year-zoom-in) — Research Self Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in
- [`research.technical_verifier`](./03-self-board-illustrations.md#page-10-of-10--researchtechnical_verifier-independent-technical-verifier-agent-8-gate-classical--governance-audit) — Independent Technical Verifier Agent (8-gate classical & governance audit)

### 4. Love Board (`love.*` — Vol. 04)
- [`love.promise`](./04-love-board-illustrations.md#page-1-of-11--lovepromise-natal-promise-of-house-7) — Natal promise of house 7
- [`love.affliction`](./04-love-board-illustrations.md#page-2-of-11--loveaffliction-afflictions-on-house-7) — Afflictions on house 7
- [`love.protection`](./04-love-board-illustrations.md#page-3-of-11--loveprotection-what-protects-house-7) — What protects house 7
- [`love.activation`](./04-love-board-illustrations.md#page-4-of-11--loveactivation-activation-of-house-7-by-every-dasha-system) — Activation of house 7 by every dasha system
- [`love.transit`](./04-love-board-illustrations.md#page-5-of-11--lovetransit-transits-over-house-7) — Transits over house 7
- [`love.annual`](./04-love-board-illustrations.md#page-6-of-11--loveannual-this-years-chart-for-house-7) — This year's chart for house 7
- [`love.varga`](./04-love-board-illustrations.md#page-7-of-11--lovevarga-owning-divisional-chart-of-house-7) — Owning divisional chart of house 7
- [`love.nakshatra`](./04-love-board-illustrations.md#page-8-of-11--lovenakshatra-nakshatra-charter-of-house-7) — Nakshatra charter of house 7
- [`love.meet`](./04-love-board-illustrations.md#page-9-of-11--lovemeet-meeting-someone) — Meeting someone (`love.status` in `single, dating`)
- [`love.health`](./04-love-board-illustrations.md#page-10-of-11--lovehealth-how-the-relationship-is) — How the relationship is (`love.status` in `dating, committed, married`)
- [`love.reconcile`](./04-love-board-illustrations.md#page-11-of-11--lovereconcile-strain-and-reconciling) — Strain and reconciling (`love.status` in `separated, complicated`)

### 5. Work Board (`work.*` — Vol. 05)
- [`work.present_tone`](./05-work-board-illustrations.md#page-1-of-9--workpresent_tone-present-tone) — Present tone
- [`work.security_grade`](./05-work-board-illustrations.md#page-2-of-9--worksecurity_grade-job-security-by-month) — Job security by month
- [`work.subarea_windows`](./05-work-board-illustrations.md#page-3-of-9--worksubarea_windows-windows-ahead-by-sub-area) — Windows ahead by sub-area
- [`work.horizons`](./05-work-board-illustrations.md#page-4-of-9--workhorizons-horizons-1-3-6-12-months) — Horizons (1, 3, 6, 12 months)
- [`work.looking_back`](./05-work-board-illustrations.md#page-5-of-9--worklooking_back-looking-back) — Looking back
- [`work.annual_family`](./05-work-board-illustrations.md#page-6-of-9--workannual_family-this-years-chart-annual-family) — This year's chart (annual family)
- [`work.conditional_family`](./05-work-board-illustrations.md#page-7-of-9--workconditional_family-conditional-clock) — Conditional clock
- [`work.karaka_family`](./05-work-board-illustrations.md#page-8-of-9--workkaraka_family-karaka-clock) — Karaka clock
- [`work.d10_check`](./05-work-board-illustrations.md#page-9-of-9--workd10_check-d1-and-d10-agreement-on-each-dasha-vote) — D1 and D10 agreement on each dasha vote

### 6. Lucky Times (`lucky.*`) & Life Reading (`life.*` — Vol. 06)
- **Shared Panchang & Overlay Techniques (Pages 1–4)**:
  - [`lucky.day_tables`](./06-lucky-times-and-life-illustrations.md#page-1-of-21--luckyday_tables-shared-day-tables-per-place) — Shared day tables per place (5 reference timezones, 28-day horizon)
  - [`lucky.panchang_limbs`](./06-lucky-times-and-life-illustrations.md#page-2-of-21--luckypanchang_limbs-the-five-limbs-of-the-day) — The five limbs of the day (vara, tithi, nakshatra, yoga, karana)
  - [`lucky.avoid_bands`](./06-lucky-times-and-life-illustrations.md#page-3-of-21--luckyavoid_bands-avoid-bands-and-good-spans-of-the-day) — Avoid bands and good spans of the day
  - [`lucky.personal_overlay`](./06-lucky-times-and-life-illustrations.md#page-4-of-21--luckypersonal_overlay-personal-overlay-tara-chandra-bala-and-the-chart-marks) — Personal overlay (tara, chandra bala and the chart marks)
- **Act Scenarios (Pages 5–17)**:
  - [`lucky.work.sign_contract`](./06-lucky-times-and-life-illustrations.md#page-5-of-21--luckyworksign_contract-sign-a-contract) — Sign a contract
  - [`lucky.work.send_resume`](./06-lucky-times-and-life-illustrations.md#page-6-of-21--luckyworksend_resume-send-a-resume-or-application) — Send a resume or application
  - [`lucky.work.interview`](./06-lucky-times-and-life-illustrations.md#page-7-of-21--luckyworkinterview-interview-or-pitch) — Interview or pitch
  - [`lucky.work.ask_raise`](./06-lucky-times-and-life-illustrations.md#page-8-of-21--luckyworkask_raise-ask-for-a-raise) — Ask for a raise
  - [`lucky.work.start_project`](./06-lucky-times-and-life-illustrations.md#page-9-of-21--luckyworkstart_project-start-a-project) — Start a project
  - [`lucky.work.hard_talk_boss`](./06-lucky-times-and-life-illustrations.md#page-10-of-21--luckyworkhard_talk_boss-a-hard-talk-with-the-boss) — A hard talk with the boss
  - [`lucky.love.ask_out`](./06-lucky-times-and-life-illustrations.md#page-11-of-21--luckyloveask_out-ask-someone-out) — Ask someone out
  - [`lucky.love.first_date`](./06-lucky-times-and-life-illustrations.md#page-12-of-21--luckylovefirst_date-a-first-date) — A first date
  - [`lucky.love.clear_air`](./06-lucky-times-and-life-illustrations.md#page-13-of-21--luckyloveclear_air-clear-the-air) — Clear the air
  - [`lucky.money.invest_buy`](./06-lucky-times-and-life-illustrations.md#page-14-of-21--luckymoneyinvest_buy-invest-or-buy) — Invest or buy
  - [`lucky.travel.set_out`](./06-lucky-times-and-life-illustrations.md#page-15-of-21--luckytravelset_out-set-out-on-a-journey) — Set out on a journey
  - [`lucky.study.exam_submit`](./06-lucky-times-and-life-illustrations.md#page-16-of-21--luckystudyexam_submit-exam-or-submit) — Exam or submit
  - [`lucky.home.start_routine`](./06-lucky-times-and-life-illustrations.md#page-17-of-21--luckyhomestart_routine-start-a-routine) — Start a routine
- **Life Reading / Timeline Techniques (Pages 18–21)**:
  - [`life.promise_scale`](./06-lucky-times-and-life-illustrations.md#page-18-of-21--lifepromise_scale-life-areas-the-weighed-promise-scale) — Life areas: the weighed promise scale (13 areas)
  - [`life.timing_agreement`](./06-lucky-times-and-life-illustrations.md#page-19-of-21--lifetiming_agreement-life-areas-when-it-improves-by-agreement-across-systems) — Life areas: when it improves, by agreement across systems
  - [`life.mahadasha_charter`](./06-lucky-times-and-life-illustrations.md#page-20-of-21--lifemahadasha_charter-remaining-largest-mahadasha-10-18-yrs-and-antardasha-life-charter) — Remaining largest Mahadasha (10–18+ yrs) and Antardasha life charter
  - [`life.dashboard`](./06-lucky-times-and-life-illustrations.md#page-21-of-21--lifedashboard-your-life-at-a-glance-and-long-term-mahadasha-charter) — Your life at a glance and long-term Mahadasha charter

---

## Priority #2 Modular Technique Specifications (45 Docs)

Per-technique architectural specs detailing how Priority #2 engine capabilities (Docs 80 & 81 under `docs/reading-engine/`: 23 divisional vargas, Tithi Pravesha `yearLord` & divisional TP pulls, `strength.{bhava,vimsopaka,harsha}`, `daily_grade` / `muhurta` / `transit_ashtakavarga`, Gochara Vedha, Murti Nirnaya, 2027–2036 contacts, Ashtakoota/Dasakoota compatibility, Sudarshana Chakra, and Jaimini Karakamsha) feed the Oracle and board pipelines across execution steps, contracts, RBAC, PII sealing (`SEALED_MODELS`), and 45-minute cache recycling (`READING_CACHE_RECYCLE_MINUTES=45`).

### 1. Work Board (`docs/techniques/work/` — 10 Docs)
- [`work.annual_family.md`](./work/work.annual_family.md) (`work.annual_family`, `built`) — TP `yearLord` (*Vaaresha*) & return panchanga (R1), dynamic Annual `D10` (R4), TP compressed 365-day Vimshottari & Sahams (O3), Vimsopaka & Bhava Bala on TP year lord (H6).
- [`work.character_arc.md`](./work/work.character_arc.md) (`work.character_arc`, `built`) — TP `yearLord` & Annual `D10` (R1/R4), explicit `D10` placements (R2/R3), 3-wheel Sudarshana Chakra (H4), Vimsopaka & Bhava Bala (H6), 2027–2036 contacts (R5).
- [`work.conditional_family.md`](./work/work.conditional_family.md) (`work.conditional_family`, `built`) — `dasha.applicable` & conditional dasha serving, explicit `D10` placements (R2/R3), Vimsopaka & Harsha Bala (H6), D9 >36 mutual confirmation.
- [`work.d10_check.md`](./work/work.d10_check.md) (`work.d10_check`, `built`) — `D10` & `D60` explicit `house`/`lagna`/`owns`/`dignity` (R2/R3), Vimsopaka & Bhava Bala (H6), D9 >36 maturation gate.
- [`work.horizons.md`](./work/work.horizons.md) (`work.horizons`, `built`) — 2027–2036 exact transit contacts (R5), `transit_ashtakavarga` Kakshya bindus (H5), TP `yearLord` & Annual `D10` (R1/R4), Gochara Vedha & Murti Nirnaya (H1/H2), `D10` enrichment (R2/R3).
- [`work.karaka_family.md`](./work/work.karaka_family.md) (`work.karaka_family`, `built`) — Explicit `D10` placements (R2/R3), Jaimini Karakamsha & Swamsha (R6), Vimsopaka Bala (H6), `dasha.karaka` & `dasha.chara`, Bhava Chalit shifts (H8).
- [`work.present_tone.md`](./work/work.present_tone.md) (`work.present_tone`, `built`) — TP `yearLord` & Annual `D10` (R1/R4), `D10` enrichment (R2/R3), `transit_ashtakavarga` (H5), Gochara Vedha & Murti Nirnaya (H1/H2), Vimsopaka & Harsha Bala (H6).
- [`work.reading.oracle.md`](./work/work.reading.oracle.md) (`work.reading.oracle`, `built`) — `family.varga` (`D10`, `D11`, `D24`, `D60`, R2/R3), `family.rasi` (`strength.{bhava,vimsopaka,harsha}`, H6; `houseShift`, H8), `family.year` (TP `yearLord`, Annual `D10`, R1/R4), `family.sky` (Ashtakavarga, Vedha, Murti, 2027–2036, R5/H1/H2/H5), `lineman.work` (Karakamsha, Sudarshana, R6/H4).
- [`work.security_grade.md`](./work/work.security_grade.md) (`work.security_grade`, `built`) — Harsha Bala & Bhava Bala (H6), explicit `D10` placements (R2/R3), `transit_ashtakavarga` (H5), TP `yearLord` & Annual `D10` (R1/R4).
- [`work.subarea_windows.md`](./work/work.subarea_windows.md) (`work.subarea_windows`, `built`) — `D10`, `D11`, `D4`, `D12` enrichment (R2/R3), `transit_ashtakavarga` (H5), Bhava/Vimsopaka/Harsha Bala (H6), 2027–2036 exact transit contacts (R5).

### 2. Love Board (`docs/techniques/love/` — 11 Docs)
- [`love.activation.md`](./love/love.activation.md) (`love.activation`, `built`) — `D9` & `D7` enrichment (R2/R3), TP `yearLord` & Annual `D9` (R1/R4), conditional/Chara/Karaka dashas, Vimsopaka Bala (H6), D9 >36 gate.
- [`love.affliction.md`](./love/love.affliction.md) (`love.affliction`, `built`) — `D30` Trimshamsha unlock & `D9`/`D7` parity (R2/R3), Harsha & Bhava Bala (H6), Bhava Chalit `houseShift` (H8), TP `yearLord` (R1).
- [`love.annual.md`](./love/love.annual.md) (`love.annual`, `built`) — TP `yearLord` & return panchanga (R1), dynamic Annual `D9` & `D7` (R4), TP Muntha/Sahams/365-day Vimshottari (O3), Vimsopaka Bala (H6).
- [`love.bonding_chemistry.md`](./love/love.bonding_chemistry.md) (`love.synastry_koota` aliased to `love.bonding_chemistry`, `partial`) — Headless Ashtakoota (36-pt) & Dasakoota compatibility (`compatibility` / `compatibility_card` / `reading.analyst.compatibility`, H3), `D9`/`D7` enrichment (R2/R3), Bhava & Vimsopaka Bala (H6), Gochara Vedha on synastry transits (H1).
- [`love.promise.md`](./love/love.promise.md) (`love.promise`, `built`) — Bhava & Vimsopaka Bala (H6), `D9`/`D7` enrichment (R2/R3), `D30` unlock (R2), Bhava Chalit `houseShift` (H8).
- [`love.protection.md`](./love/love.protection.md) (`love.protection`, `built`) — `D9`/`D7` enrichment (R2/R3), expanded `VARGA_SCOPE` for `argala.d9` & `arudhas.d9` (R2), Vimsopaka & Harsha Bala (H6), TP `yearLord` (R1).
- [`love.reading.oracle.md`](./love/love.reading.oracle.md) (`love.reading.oracle`, `built`) — `family.varga` (`D9`, `D7`, `D30`, R2/R3), `family.rasi` (`strength.{bhava,vimsopaka,harsha}`, H6; `houseShift`, H8), `family.year` (TP `yearLord`, Annual `D9`, R1/R4), `family.sky` (Vedha, Murti, `transit_ashtakavarga`, 2027–2036, R5/H1/H2/H5), `lineman.love` (Ashtakoota/Dasakoota, Sudarshana, H3/H4).
- [`love.relationship_arc.md`](./love/love.relationship_arc.md) (`love.relationship_arc`, `built`) — TP `yearLord` & Annual `D9` (R1/R4), `D9`/`D7` enrichment (R2/R3), Vimsopaka & Bhava Bala (H6), 3-wheel Sudarshana Chakra (H4), 2027–2036 contacts (R5).
- [`love.subareas.md`](./love/love.subareas.md) (`love.meet`, `love.health`, `love.reconcile`, `built`) — Headless Ashtakoota/Dasakoota (H3), `D9`/`D7`/`D30` enrichment (R2/R3), Gochara Vedha, Murti Nirnaya & `transit_ashtakavarga` (H1/H2/H5), TP `yearLord` & Annual `D9` (R1/R4), 2027–2036 contacts (R5).
- [`love.transit.md`](./love/love.transit.md) (`love.transit`, `built`) — Gochara Vedha & Virodha Vedha (H1), Murti Nirnaya (H2), `transit_ashtakavarga` Kakshya bindus (H5), `D9`/`D7` divisional transit overlays (H7), 2027–2036 contacts (R5).
- [`love.varga.md`](./love/love.varga.md) (`love.varga`, `built`) — `D30` unlock (R2), explicit `house`/`lagna`/`owns`/`dignity` on `D9`, `D7`, `D30` (R3), Vimsopaka Bala (H6), D9 >36 gate.

### 3. Self / You Board (`docs/techniques/self/` — 10 Docs)
- [`self.activation.md`](./self/self.activation.md) (`self.activation`, `built`) — TP `yearLord` & compressed dasha (R1/O3), 23 vargas with explicit houses & dignities (R2/R3), Vimsopaka Bala (H6), Sudarshana Chakra annual progression (H4).
- [`self.affliction.md`](./self/self.affliction.md) (`self.affliction`, `built`) — `D30`, `D60`, `D27` unlock & explicit houses (R2/R3), Bhava Bala (H6), Bhava Chalit shifts (H8), Gochara Vedha & 2027–2036 contacts (R5/H1).
- [`self.annual.md`](./self/self.annual.md) (`self.annual`, `built`) — TP `yearLord` & return panchanga (R1), dynamic TP divisional charts `D9, D20, D24, D30` (R4), TP 365-day Vimshottari & Tajaka/Muntha (O3), Sudarshana annual wheel (H4).
- [`self.character_arc.md`](./self/self.character_arc.md) (`self.character_arc`, `built`) — 3-wheel Sudarshana Chakra (H4), TP `yearLord` (R1), Vimsopaka & Bhava Bala (H6), `D9/D10/D60` explicit houses & Karakamsha/Swamsha (R2/R3/R6).
- [`self.nakshatra.md`](./self/self.nakshatra.md) (`self.nakshatra`, `built`) — Divisional cusp stars & padas across 23 vargas (R2/R3), `daily_grade` Tara Bala alignment (H5), Sarvatobhadra Chakra Nakshatra Vedha (O1), Vimsopaka & Harsha Bala on star lords (H6).
- [`self.personality_joy.md`](./self/self.personality_joy.md) (`self.personality_joy`, `built`) — `D24` Chaturvimshamsha unlock & explicit houses (R2/R3), Vimsopaka & Bhava Bala (H6), Sudarshana Chandra Wheel (H4).
- [`self.promise.md`](./self/self.promise.md) (`self.promise`, `built`) — Bhava & Vimsopaka Bala (H6), 23 vargas `D1..D60` (R2/R3), Sudarshana Chakra (H4), Bhava Chalit shifts (H8).
- [`self.protection.md`](./self/self.protection.md) (`self.protection`, `built`) — Vimsopaka & Bhava Bala (H6), expanded `VARGA_SCOPE` Argala & Arudha across 23 vargas (R2/R3), Sudarshana Chakra (H4).
- [`self.transit.md`](./self/self.transit.md) (`self.transit`, `built`) — `transit_ashtakavarga` Kakshya bindus (H5), Gochara Vedha (H1), Murti Nirnaya (H2), `D9/D24/D30` divisional transits (H7), 2027–2036 contacts (R5).
- [`self.varga.md`](./self/self.varga.md) (`self.varga`, `built`) — 23 vargas in `SERVED_VARGAS` (R2), explicit divisional `house`/`lagna`/`owns`/`dignity` (R3), Vimsopaka Bala (H6), D9 >36 gate.

### 4. Lucky Times (`docs/techniques/lucky/` — 5 Docs)
- [`lucky.avoid_bands.md`](./lucky/lucky.avoid_bands.md) (`lucky.avoid_bands`, `built`) — `muhurta` catalog unlock (H5), 30 Muhurtas, Godhuli, Vijaya, Nishita, Gauri Choghadiya, Panchaka Rahitha (H5).
- [`lucky.day_tables.md`](./lucky/lucky.day_tables.md) (`lucky.day_tables`, `built`) — `muhurta` & `daily_grade` prepull across 5 reference timezones (H5), sub-day panchanga limb transitions & end times (H5), env-driven prepull config.
- [`lucky.panchang_limbs.md`](./lucky/lucky.panchang_limbs.md) (`lucky.panchang_limbs`, `built`) — Engine-provided tithi/star groups & sub-day limb spans (`muhurta`, `daily_grade`, H5), Dina/Tribhaga Bala & Choghadiya (H5), env-driven rule lists.
- [`lucky.personal_overlay.md`](./lucky/lucky.personal_overlay.md) (`lucky.personal_overlay`, `built`) — `daily_grade` (H5), `transit_ashtakavarga` Kakshya bindus on Hora lords (H5), Pancha Pakshi Shastra biorhythm (O2).
- [`lucky.scenarios.md`](./lucky/lucky.scenarios.md) (`13` `lucky.<area>.<action>` rules, `built`) — `daily_grade` (H5), `muhurta` 30-muhurta/Choghadiya/Mercury retrograde/Disha Shool (H5), `transit_ashtakavarga` Kakshya bindus (H5), Pancha Pakshi (O2).

### 5. General Reading (`docs/techniques/general/` — 9 Docs)
- [`general.annual.md`](./general/general.annual.md) (`general.annual`, `built`) — TP `yearLord` (*Vaaresha*) & return panchanga (R1), dynamic TP divisional pulls `D9, D10, D7, D2` (R4), compressed 365-day TP Vimshottari & TP Tajaka/Muntha (O3).
- [`general.dasha.md`](./general/general.dasha.md) (`general.dasha`, `built`) — TP `yearLord` fix in `dashaAssessment.ts` (R1), 23 vargas with explicit houses & dignities (R2/R3), Vimsopaka & Harsha Bala (H6).
- [`general.jaimini_karakamsha.md`](./general/general.jaimini_karakamsha.md) (`general.jaimini_karakamsha`, `planned`, `findings.v3`) — Engine-exported Karakamsha Lagna (`KL`) & Swamsha frame (R6), explicit `D9` houses & dignities (R3), Vimsopaka Bala (H6).
- [`general.nakshatra.md`](./general/general.nakshatra.md) (`general.nakshatra`, `built`) — Sarvatobhadra Chakra Nakshatra Vedha (O1), `daily_grade` Tara Bala (H5), divisional lagna/placement nakshatras across 23 vargas (R2/R3).
- [`general.oracle.md`](./general/general.oracle.md) (`general.oracle`, `built`) — Unified 23-varga & strength grounding (R2/R3/H6), unblocked TP `yearLord` & annual vargas (R1/R4), Kakshya/Vedha/Murti/2027–2036 transits (R5/H1/H2/H5), Sudarshana/Karakamsha/Synastry briefs (R6/H3/H4).
- [`general.promise.md`](./general/general.promise.md) (`general.promise`, `built`) — Bhava & Vimsopaka Bala (H6), 23 vargas `D1..D60` (R2/R3), Bhava Chalit `houseShift` (H8).
- [`general.sudarshana_chakra.md`](./general/general.sudarshana_chakra.md) (`general.sudarshana_chakra`, `planned`, `findings.v3`) — Headless 3-wheel Sudarshana Chakra export (`Lagna`, `Chandra`, `Surya` + annual progression, H4), divisional Sudarshana (`D9`, `D10`, R2/H4).
- [`general.transit.md`](./general/general.transit.md) (`general.transit`, `built`) — `transit_ashtakavarga` Kakshya bindus (H5), Gochara Vedha & Virodha Vedha (H1), Murti Nirnaya (H2), divisional transit overlays `D9/D10/D7/D11` (H7), 2027–2036 exact contacts (R5).
- [`general.varga_dynamics.md`](./general/general.varga_dynamics.md) (`general.varga_dynamics`, `built`) — All 23 vargas unlocked in `SERVED_VARGAS` (R2), explicit `house`/`lagna`/`owns`/`aspects_to`/`dignity` across all 17+ declared vargas (R3), Vimsopaka Bala (H6).
