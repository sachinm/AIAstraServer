# Technique Architecture & One-Per-Page Visual Illustrations

> **Design Blueprint Reference**: [`docs/reading-engine/56-technique-pieces-and-validity-windows.md`](../reading-engine/56-technique-pieces-and-validity-windows.md) · [`docs/reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md`](../reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md) · [`docs/admin/07-technique-pieces-and-agents.md`](../admin/07-technique-pieces-and-agents.md)  
> **Source of Truth in Code**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/techniques/pieces.ts`](../../src/techniques/pieces.ts) · [`src/techniques/piecesDoc.ts`](../../src/techniques/piecesDoc.ts) · [`src/techniques/layouts.ts`](../../src/techniques/layouts.ts) · [`src/agents/registry.ts`](../../src/agents/registry.ts)

Every reading and board function in AI AdAstra is a registered **Technique Contract** (`TechniqueDef`) assembled from standardized, reusable **Pieces** (`Reader`, `Scorer / Checker`, `Date-Range Window Cache Gate`, `Prompt`, `Output Schema`, and `Agent`).

While raw planetary positions, lagna degrees, and horas shift every ~2 hours (and panchang limbs shift daily, dasha sub-periods shift over weeks/months, and solar/lunar return charts shift annually), **the technique machinery itself stays identical**. By saving each technique's digested output alongside its applicable validity date range `[valid_from, valid_to)`, the server avoids rehashing unchanged tables and **skips the processing LLM or code agent (`status: 'skipped'`)** whenever a request arrives inside the valid window.

---

## Manual Volumes (One Illustration Per Page)

| Volume | File | Category / Board | Pages | Contents |
|---|---|---|---|---|
| **Vol. 01** | [`01-architecture-and-reusable-pieces.md`](./01-architecture-and-reusable-pieces.md) | **Architecture & Digest (`digest.*`)** | 10 Pages | End-to-end system architecture, the 5 classes of reusable Pieces, the Date-Range Window Cache Gate (`piece.cache.date_range_window`), Recipe Families & Freshness Tiers, Error-Correction & Anti-Hallucination Gates, and the 3 Digest techniques (`digest.build`, `digest.annual_set`, `digest.activation`). |
| **Vol. 02** | [`02-general-reading-illustrations.md`](./02-general-reading-illustrations.md) | **General Reading (`general.*` / `chat`)** | 15 Pages | One-per-page illustrations for all 15 General Reading techniques: Intake, Clarify, 6 Graph Specialist Analysts (`promise`, `dasha`, `annual`, `transit`, `nakshatra`, `prashna`), 4 Deterministic Code Readers (`varga_dynamics`, `strength_yoga`, `jaimini`, `person`), Oracle Readers (`R01–R14, P1–P3`), Oracle Synthesizer (`general.oracle`), and Validator (`general.validator`). |
| **Vol. 03** | [`03-self-board-illustrations.md`](./03-self-board-illustrations.md) | **Self / You Board (`self.*` / `you`)** | 8 Pages | One-per-page illustrations for all 8 Self house-state layers over Houses `1, 4, 5, 9, 12` and the Moon (`D1, D9, D20, D24, D12, D4, D7, D60`): `self.promise`, `self.affliction`, `self.protection`, `self.activation`, `self.transit`, `self.annual`, `self.varga`, `self.nakshatra`. |
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

## Complete Catalogue Index (67 Techniques)

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

### 3. Self / You Board (`self.*` — Vol. 03)
- [`self.promise`](./03-self-board-illustrations.md#page-1-of-8--selfpromise-natal-promise-of-houses-1-4-and-5-with-the-moon) — Natal promise of houses 1, 4 and 5 with the Moon
- [`self.affliction`](./03-self-board-illustrations.md#page-2-of-8--selfaffliction-afflictions-on-houses-1-4-and-5-with-the-moon) — Afflictions on houses 1, 4 and 5 with the Moon
- [`self.protection`](./03-self-board-illustrations.md#page-3-of-8--selfprotection-what-protects-houses-1-4-and-5-with-the-moon) — What protects houses 1, 4 and 5 with the Moon
- [`self.activation`](./03-self-board-illustrations.md#page-4-of-8--selfactivation-activation-of-houses-1-4-and-5-by-every-dasha-system) — Activation of houses 1, 4 and 5 with the Moon by every dasha system
- [`self.transit`](./03-self-board-illustrations.md#page-5-of-8--selftransit-transits-over-houses-1-4-and-5-with-the-moon) — Transits over houses 1, 4 and 5 with the Moon
- [`self.annual`](./03-self-board-illustrations.md#page-6-of-8--selfannual-this-years-chart-for-houses-1-4-and-5-with-the-moon) — This year's chart for houses 1, 4 and 5 with the Moon
- [`self.varga`](./03-self-board-illustrations.md#page-7-of-8--selfvarga-owning-divisional-chart-of-houses-1-4-and-5-with-the-moon) — Owning divisional chart of houses 1, 4 and 5 with the Moon
- [`self.nakshatra`](./03-self-board-illustrations.md#page-8-of-8--selfnakshatra-nakshatra-charter-of-houses-1-4-and-5-with-the-moon) — Nakshatra charter of houses 1, 4 and 5 with the Moon

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
