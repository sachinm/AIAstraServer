# 23 — Radha serves the full reading dataset

Status: in build, 2026-10-25. Builds on [20](20-radha-data-provider.md) (what), [21](21-radha-plan-review.md) (review)
and [22](22-radha-build-plan.md) (how). Sachin's ask: Radha (pyjhora behind FastAPI on Lambda) returns every table a full,
accurate reading needs, as JSON, one export type per item, all computed by pyjhora.

## 1. Where it stands

| Piece | Status |
|---|---|
| All 23 divisional charts (`d1` … `d144`), `chart_method` param, `catalog` type (R-3) | built, on Radha `develop` |
| Dasha node shape and fixes for Vimsottari and Narayana, calc_version 2 (R-6) | built, on Radha `develop` |
| Transit chart for any past or future moment, any divisional chart, optional natal houses | built, on Radha `develop` |
| Natal tables (R-4a): strengths, relations, benefics/malefics, dignities, ashtakavarga, yogas, doshas, arudhas, sphutas, bhava | building |
| Every dasha pyjhora computes + `dasha.applicable` (R-4b) | building |
| Annual: Tithi Pravesh (year rule), Varsha, Mudda, Patyayini, Sahams, Tithi Pravesh dasha (R-5) | building |
| Multi-type request (one horoscope build, many tables) | next, after R-4a/R-4b/R-5 merge |
| Third dasha level | later |
| Radha Lambda deploy + server catalog sync (S-1) | after merge; needs Sachin's approval |
| Server: registration pulls every served natal and annual type (current year), transit on demand (§4.2) | built, branch `feature/registration-full-pull` |

Nothing new reaches the app until Radha is deployed and `npm run chart-catalog:sync` marks the new types served. Until
then the server catalog (M7 seed) serves only biodata, d1, d2, d4, d7, d9, d10, chara karakas, Vimsottari, Narayana.

## 2. The full list (wire names)

**Charts:** `d1 d2 d3 d4 d5 d6 d7 d8 d9 d10 d11 d12 d16 d20 d24 d27 d30 d40 d45 d60 d81 d108 d144`, `biodata`.

**Natal tables:** `strength.shadbala`, `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `ashtakavarga` (BAV, SAV,
reduced), `aspects`, `relations` (natural, temporary and compound friend/enemy tables), `benefic_malefic` (natural, and
functional for the lagna: benefic, malefic, yogakaraka, maraka lords), `dignities` (exalted, debilitated, own,
moolatrikona, friend/enemy sign, combust, retrograde), `avasthas` (if pyjhora has them), `bhava` (cusps, lords,
occupants), `yogas`, `doshas`, `arudhas`, `sphutas`, `charakaraka`.

**Dashas:** `dasha.<module>` for every graha and rasi dasha module in pyjhora, plus `dasha.vimsottari`, `dasha.narayana`
(aliases of `vimsottari_dasa`, `narayana_dasa`) and `dasha.applicable` (which conditional dashas apply to this chart).

**Annual:** `annual.tithi_pravesha`, `annual.tithi_pravesha_dasha`, `annual.varsha`, `annual.mudda`, `annual.patyayini`,
`annual.sahams`.

**Moving:** `transit`.

## 3. Request rules

- **Transit:** `at` (local date-time, past or future), `divisional_chart_factor` (default 1), optional natal birth fields
  to add each planet's natal house.
- **Tithi Pravesh and the other annual items:** `year`, or `at` (default today). If `at` is before the birthday in that
  year, the prior year's Tithi Pravesh is used; on or after the birthday, the current year's. The response says which
  rule applied (`year_used`, `rule`) and the window it covers (`valid_from`, `valid_to`).
- Every response carries `calc_version` and `params_used`; the server stores both and re-fetches when a type's version
  changes.

## 4. Server work that follows

1. **Done (2026-10-25, branch `feature/catalog-new-radha-types`).** `relations`, `benefic_malefic`, `dignities`, `bhava`,
   `dasha.applicable`, `annual.tithi_pravesha_dasha` and `transit` are in `src/reading/chartData/catalog.ts`, all
   `on_demand` and unserved until the catalog sync. Seed migration `20261025160000_reading_m9_catalog_more_types`
   (written, not applied) widens the `change_class` check to `natal | annual | moving` and inserts the seven rows.
   `transit` is change class `moving`: never stored in `kundli_data`; `ensureChartData` refuses it and callers use
   `fetchTransit(kundliId, { at, divisionalChartFactor, withNatal })` in `src/reading/chartData/transit.ts` (one throttled
   Radha call, payload returned unstored). `bhava` is stored with Radha's default `bhava_madhya_method` (1). Not added:
   `avasthas` (Radha does not serve it). `dasha.brahma` stays listed and unserved (pyjhora bug, Radha does not export it).
2. **Done (2026-10-25, branch `feature/registration-full-pull`). Registration pulls everything Radha serves; transit
   stays on demand.** Sachin's call (closes doc 21 Q1): at sign-up the kundli queue stores every type the merged catalog
   (after `chart-catalog:sync`) marks `served` with change class `natal` or `annual` in `kundli_data`. `moving` types
   (`transit`) are never in the set: they depend on the moment asked for and go through `fetchTransit`, unstored.
   - **Order:** `first` tier, then `registration`, then everything else, each by `sort_order`
     (`registrationPlan` in `src/reading/chartData/registration.ts`).
   - **Chat opens early.** The run is split at the last item the completion rule needs (served first-tier types and the
     ten legacy `kundlis` columns; today that ends at `dasha.narayana`). After that gate the existing rule applies
     unchanged (`kundli_added = true`, `queue_status = completed`, facts build, Gemini cache); the rest is pulled in the
     same queue run afterwards. A failure in the rest is logged (`kundli_full_pull_failed`) and never undoes the
     completion. One user never has two pulls running in one process; across instances the row lock keeps any item from
     being fetched twice.
   - **Resume.** The rows are the progress record: `ensureChartData` skips rows already `ready`, so the next run (next
     login) fetches only what is missing, failed (after the 5-minute retry wait) or stale. On Lambda the post-gate pull
     only runs while the container is serving requests; whatever it did not reach is picked up on the next login.
   - **Annual items** (`annual.tithi_pravesha`, `annual.tithi_pravesha_dasha`, `annual.varsha`, `annual.mudda`,
     `annual.patyayini`, `annual.sahams`, when served) are fetched for the current year by `ensureAnnualCurrent`
     (`src/reading/chartData/store.ts`). Node does not work out the birthday or return instant: it sends Radha `at` =
     today's date at the birth place (no `at`, i.e. Radha's own "today in the place's timezone", when the kundli has no
     stored offset) and stores the answer under `year=<year_used>` with `valid_to` from the response. A small pointer row
     per type (variant `current`, payload `{ year_used, variant, valid_to }`) records which year is current and is the
     fetch lock. An explicit `annual.x@<year>` request reads the same year row; a past year's row is never re-fetched
     because its `valid_to` passed.
   - **Re-run on login.** Every login re-queues the kundli and walks the whole set again (one `kundli_data` read per
     batch, no Radha call for fresh rows). When a `current` pointer's `valid_to` has passed (the birthday return, S-4)
     the new year is fetched; when a type's `calc_version` changes in the catalog (e.g. Narayana going to `3`) that type
     is re-fetched.
   - **Spacing.** Concurrency stays 1 per user (`KUNDLI_QUEUE_MAX_FETCHES_PER_USER`, default 1) and every call goes
     through the export client's start-to-start throttle (Radha allows one request per second).
   - **Duration.** With everything served the set is 113 items (the catalog's 115 entries minus `transit` and the
     unexported `dasha.brahma`; the per-varga arudha and argala entries from M11 account for 23 of them). At one call per
     second, and longer for the heavy tables, a full pull takes about **2 minutes, up to about 3** if many calls run past a
     second. The earlier estimate of about 85 items and 1.5 to 2 minutes predates the per-varga entries. Chat opens after
     the gate: about 15 items (about 15 s) once the catalog sync has run, 10 items today. Each run logs
     `kundli_full_pull` with `total_items`, `gate_items`, `rest_items`, `fetched_from_radha`, `ready`, `failed`,
     `unsupported`, `missing`, `skipped_unserved`, `gate_ms` and `wall_ms`.
   - Until the catalog sync marks the new types served, the set is the same ten built-in items as before and there is no
     post-gate part. No migration: the pointer rows use the existing `kundli_data` columns.
3. Run the catalog sync after each Radha deploy.
4. Multi-type coalescing in `ensureChartData` (S-3) once Radha serves the multi-type request.
