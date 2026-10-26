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
2. Decide which belong in the registration set (doc 21 Q1); everything else is fetched on first use.
3. Run the catalog sync after each Radha deploy.
4. Multi-type coalescing in `ensureChartData` (S-3) once Radha serves the multi-type request.
