# 81 · Priority #2 Radha Capabilities Architecture: Divisional Vargas (D1..D60), Annual Tithi Pravesha Engine, Transits & Headless Jyotish Systems

**Status:** Architecture Specification & Engineering Roadmap (Milestone 2, Priority 2)  
**Author:** Teamwork Architectural Specialist (`worker_doc81`)  
**Date:** 2026-11-17  
**Target Branch:** `feat/radha-p2-capabilities` (branched from `develop`, merged `--no-ff`)  
**Context:** Implements and extends `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` (Doc 80), `docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md` (Doc 76), `docs/reading-engine/78-love-work-dashboard-separation-and-cards.md` (Doc 78), and `docs/reading-engine/79-self-foundation-and-dashboard-release-plan.md` (Doc 79).

---

## 1. Start: Current System Checked Against Code, Logs, AWS Config & DB

Direct code-level verification across `AIAstra_Radha` (`aiastra-pyjhora` Lambda) and `AIAstra_Server` (`aiastra-server-api` Lambda + PostgreSQL) establishes the exact baseline and root causes of the Priority 2 capability gaps.

### 1.1 Divisional Vargas (`D1..D60` & `D81..D144`) Status
- **Server Served Allowlist Bottleneck (`src/reading/chartData/catalog.ts:57, 60, 133, 162–173, 214–233`):**
  - `VARGA_FACTORS` declares all 23 classical and higher divisional factors: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144]`.
  - However, `SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10])` (`catalog.ts:133`) marks only 6 `varga.d<N>` entries as `served: true`, while `ARUDHA_ARGALA_VARGAS = [1, 2, 3, 4, 7, 9, 10, 12, 20, 24, 30, 60]` (`catalog.ts:60`) and `DEEP_VARGAS` entries (`dignities.d*`, `aspects.d*`, `relations.d*`, `yogas.d*`, `arudhas.d*`, `argala.d*`, `house_counts.d*` at `catalog.ts:214–233`) all default to `served: false`.
  - **Critical Prisma `legacyColumn` Trap (`catalog.ts:169` & `prisma/schema.prisma:100–105`):** `catalog.ts:169` currently sets `...(SERVED_VARGAS.has(f) ? { legacyColumn: \`d${f}\` } : {})`. Model `Kundli` only has legacy columns `d1, d2, d4, d7, d9, d10` (`schema.prisma:100–105`). Expanding `SERVED_VARGAS` without separating `LEGACY_VARGAS = new Set([1, 2, 4, 7, 9, 10])` would attach `legacyColumn: 'd11'`, `'d30'`, etc., crashing `ensureChartData` (`store.ts:265`) when Prisma queries non-existent columns.
  - **User & Runtime Symptom:** `ensureChartData` (`src/reading/chartData/store.ts:180, 288`) refuses unserved vargas with `"Radha does not serve this type yet"`. Funding/income readings lack `D11` (Rudramsha), health/vulnerability readings lack `D30` (Trimshamsha), spiritual readings lack `D20` (Vimsamsa), and academic/skill readings lack `D24` (Chaturvimsamsa).
- **Radha `dignities.dN` Already Succeeds Across All 23 Vargas (`AIAstra_Radha/src/jhora/natal_export.py`):**
  - Contrary to the initial assumption that `VARGA_SCOPE = (1, 2, 3, 4, 7, 9, 10, 12, 20, 24, 30, 60)` (`natal_export.py:54`) blocks `DEEP_VARGAS`, `VARGA_SCOPE` is unreferenced metadata: `natal_params_spec` (`natal_export.py:109–113`) already accepts all 23 `const.division_chart_factors`, and empirical testing of `run_natal("dignities", ..., {"varga": f})` across all 23 factors returned **`dignities failed_vargas: []`** (100% pass, returning complete `houses[]` with `lord`, `occupants`, `sign` and `planets[]` with `house_from_lagna`, `dignity`, `sign_lord`, `sign_lord_house`, `retrograde`, `combust`).
  - Meanwhile, legacy `export.py:_build_placements_json` (`lines 887–901`) only exports `{ body, longitude, nakshatra, pada, rasi, navamsa, karaka }` without `house`/`owns`/`dignity`, and `placementCards()` (`src/reading/digest/build.ts:589–641, 1320–1325`) only runs when `dignities.dN` is absent (`placementOnly`) and produces **zero `HouseCard`s**. Thus, serving `dignities.d2..d144` (plus `aspects.d*`, `relations.d*`, `arudhas.d*`, `argala.d*`, `house_counts.d*`) unlocks full `HouseCard` + `PlanetCard` digestion in `build.ts:1300–1311` (`vargaCoverage` `full` path) with zero legacy string-scraping and zero Node `% 12` math.

### 1.2 Tithi Pravesha (TP) Annual Engine Fail-Closed & Edge-Case Defects
- **Radha Missing `year_lord` & Return Panchanga (`AIAstra_Radha/src/jhora/annual_export.py:736–746`):**
  - `run_annual` builds `lagna`, `planets`, and `_chart_enrichment` for `TITHI_PRAVESHA`, but omits `year_lord` (*Vaaresha*, Vedic sunrise-to-sunrise weekday lord at the return instant), `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, and `karana`.
  - `AIAstra_Radha/src/jhora/pressure_inventory_export.py:572–582` already implements `_year_lord(jd, place)` using `drik.sunrise(jd, place)[0]` and `VARA_LORDS[(civil.weekday() + 1) % 7]`, but `annual_export.py` never calls it.
- **Empirical Leap-Year Birthday Crash (`Feb 29`, `annual_export.py:719–720` -> `vratha.py:604–605` -> `utils.py:752`):**
  - When birth date is Feb 29 (e.g., `1996-02-29`), `annual_export.py:719–720` evaluates `_tithi_pravesha_instant` for both `year` and `year + 1`. Because either `year` or `year + 1` is always a non-leap year, `vratha.tithi_pravesha` constructs an invalid `Date(Y, 2, 29)`, crashing `np.datetime64` in `utils.previous_panchanga_day` (`utils.py:752`) with `ValueError: Invalid date (%I64d,%ld,%ld) when converting to NumPy datetime` (verified across both `2024` and `2026`).
- **High-Latitude / Polar Sunrise Sentinel Crash (`|lat| >= 66.5°`, `annual_export.py:294–297`, `pressure_inventory_export.py:580`):**
  - At polar latitudes during midnight sun or polar night (e.g., Tromsø `69.65N, 18.96E`), `drik.sunrise(jd, place)` returns a large negative sentinel (`rise_local_time`), causing `_is_night_birth` (`annual_export.py:294`) to crash in `utils.from_dms_str_to_dms` (`ValueError: invalid literal for int() with base 10: '00 (-2461213)'`) and `_year_lord` (`pressure_inventory_export.py:580`) to evaluate `hours < sunrise` incorrectly (`False`).
- **Server Parser VP-Only Guard (`src/reading/digest/build.ts:1177–1196`):**
  - `annualRows` checks `if (kind === 'VP' && varga === 'D1')` before reading `tjObj.year_lord` from `annual.tajaka@year=${year}` and `if (kind === 'VP')` (`build.ts:1147`) before reading `annual.sahams@year=${year}`. For `kind === 'TP'`, `AnnualRow.yearLord` is always `undefined`.
- **Fail-Closed User Symptom (`src/reading/dasha/dashaAssessment.ts:411–420`):**
  - When `tpInfo.row.yearLord` is `undefined` or `'Unknown'`, `dashaAssessment.ts:418` logs `"annual: TP${tpInfo.year} yearLord missing or unresolved; failing closed to get_through stance"`, forcing the entire annual reading into a defensive `'get_through'` survival posture even during strong expansion years.
- **Unserved Dynamic Annual Pulls (`src/reading/chartData/catalog.ts:235–246` & `src/reading/digest/annualSet.ts:11`):**
  - `annual.varsha`, `annual.tithi_pravesha`, `annual.tithi_pravesha_dasha`, `annual.mudda`, `annual.patyayini`, `annual.sahams`, and `annual.tajaka` are all `served: false` in the code floor, and `ANNUAL_CHART_VARGAS` (`annualSet.ts:11`) currently covers `[1, 9, 10]` (omitting `2, 7, 30` unless expanded). Additionally, Radha lacks a compressed 365-day TP Vimshottari dasha.

### 1.3 Daily Grade, Muhurta & Transit Ashtakavarga Status
- **Dormant Radha Implementations (`AIAstra_Radha/src/jhora/daily_export.py`):**
  - `_run_daily_grade` (`lines 429–450`) computes Moon star, Janma Nakshatra Tara Bala (`1..9`), Janma Rasi Chandra Bala (`1..12`), combined `grade` (`good | neutral | avoid`), and day transition events.
  - `_run_muhurta` (`lines 616–635`) computes Sunrise/Sunset, Brahma Muhurta, Abhijit, Rahu Kalam, Yamagandam, Gulikai, Durmuhurtam, Amrita Gadiya, Varjyam, 30 diurnal/nocturnal Muhurtas, 24 Horas, Gauri Choghadiya, and Panchaka Rahitha.
  - `run_transit_ashtakavarga` (`lines 703–765`) scores moving transits against natal SAV/BAV and **Kakshya** (8-fold `3°45'` sign subdivisions ruled by `Sa, Ju, Ma, Su, Ve, Me, Mo, Lg` with `has_bindu` flags).
- **Server Wiring Status (`src/reading/chartData/catalog.ts:261–263` & `src/reading/luckyTimes/service.ts:207–266`):**
  - `muhurta` **already** has Server ingestion wiring in `src/reading/luckyTimes/service.ts:207–266` writing `day_tables` and `kundli_day_overlays`.
  - However, `daily_grade`, `muhurta`, and `transit_ashtakavarga` are marked `served: false` in `catalog.ts:261–263` (and `changeClass: 'moving'`, so `ensureChartData` explicitly refuses them via `movingTypeError` at `store.ts:224–232, 248`), and `daily_grade` / `transit_ashtakavarga` lack dedicated Server fetchers and Kakshya ingestion into `day_tables` / `kundli_day_overlays`.
- **Missing Transit Depth & Horizon Truncation:**
  - `transits_export.py` does not emit **Gochara Vedha / Virodha Vedha** (transit obstruction pairs), **Murti Nirnaya** (Gold/Silver/Copper/Iron Moon-at-ingress vehicle), or **Divisional Transit Overlays** (`D9/D10/D7/D11`).
  - Stored `transit_contacts` fixtures (`evals/fixtures/G1/catalog/transit_contacts.*.json`, `docs/TODOS.md:235–243`) terminate at the end of 2026, leaving 2027–2036 projections unable to cite exact natal-degree hits.

### 1.4 Unexported Headless Systems & Dormant Strength Models
- **Built in `pyjhora`, Unexported in `export.py`:**
  - Compatibility (`AIAstra_Radha/src/jhora/horoscope/match/compatibility.py:521–545`): 36-point North Indian Ashtakoota + South Indian Dasakoota + dosha exceptions.
  - Sudarshana Chakra (`AIAstra_Radha/src/jhora/horoscope/dhasa/sudharsana_chakra.py:24, 42`): 3 concentric wheels (Lagna, Chandra, Surya) and 1-year-per-sign progression.
  - Pancha Pakshi Shastra (`panchanga/pancha_paksha.py`), Sarvatobhadra Chakra & Kota Chakra (`ui/chakra.py` — currently coupled to Qt UI).
- **Exported in Radha (`natal_export.py:24–30, 270–321`), Unserved in Server (`chartData/catalog.ts:197–199` & `build.ts:1337–1347`):**
  - `strength.bhava` (Bhavadhipati, Dig, Drik bala, virupas/rupas/rank for 12 houses), `strength.vimsopaka` (Shadvarga/Saptavarga/Dasavarga/Shodhasavarga 20-point scores), and `strength.harsha` (4-rule 20-point trik-house stamina) omit `served: true` in `catalog.ts`, defaulting to `served: false`, and are also omitted from `DIGEST_NATAL_TYPES` (`src/reading/digest/build.ts:1337–1347`, along with `bhava`).
- **Missing Server Techniques (`src/techniques/catalog.ts`):**
  - Jaimini **Karakamsha Lagna (KL) & Swamsha**, **Bhava Chalit planetary shifts** (`houseShift`), and dedicated `general.sudarshana_chakra` / `love.synastry_koota` contracts are absent.

### 1.5 AWS, Database & Security Baseline
- **AWS Lambdas:** `aiastra-server-api` (Node/Express + GraphQL, 29s API Gateway cap, `ASTROKUNDLI_TRANSPORT=lambda` -> `aiastra-pyjhora` in `us-east-1`, `RADHA_MAX_CONCURRENT=4`, `astroKundliClient.ts` `DEFAULT_TIMEOUT_MS=120_000`), `aiastra-pyjhora` (Python 3.11 + `pyjhora`, 30s Lambda timeout).
- **PostgreSQL Tables & Sealing Gap (`src/lib/pii/fields.ts:38–156` vs `prisma/schema.prisma:439–452`):** `chart_data_types` (M7), `kundli_data` (sealed `payload`), `kundli_digest` (sealed `row`, `source`), `kundli_activation` (plain GIN-indexed dates/houses/systems), `technique_outputs` (sealed `output`), `reading_findings_cache` (sealed `payload`), `day_tables` (shared sky), `kundli_day_overlays` (`KundliDayOverlay.payload` is **currently UNSEALED** — absent from `SEALED_MODELS` in `src/lib/pii/fields.ts`), `llm_cache_entries`.
- **Parity Gap (`docs/TODOS.md:235–243`):** Sumit (`75b0d618`) holds 402 `kundli_data` rows (including 250 annual rows with divisional factors), whereas Archisha (`6514751c`) lacks full ±10 yr annual and transit overlay parity, and no account has `D11` or `2027–2036` exact transit contacts.

---

## 2. End Goal: User-Visible Behaviour, Target Timings & Eliminated Failure Modes

### 2.1 User-Visible Behaviour
1. **Domain-Accurate Multi-Varga Readings (Zero Chart Jargon):**
   - **Work (`/work`):** Career standing, authority, and income readings evaluate full `D10` (Dashamsha) house placements, `D11` (Rudramsha) gains, `strength.harsha` resilience under workplace pressure, `strength.bhava` 10th/6th/11th potency, and `transit_ashtakavarga` Kakshya bindus — rendered as plain-English career guidance with exact dates.
   - **Love (`/love`):** Relationship health and partner matching leverage `D9` (Navamsha), `D7` (Saptamsha), `D30` (Trimshamsha) subconscious stress markers, Gochara Vedha checks (preventing false promises when an auspicious transit is obstructed), and headless Ashtakoota/Dasakoota compatibility synastry with cancellation logic.
   - **Self (`/you`):** Character evolution (`self.character_arc`) and inner joy (`self.personality_joy`) integrate 3-wheel Sudarshana Chakra (action, mind, purpose), 20-point Vimsopaka Bala stability, Bhava Chalit house shifts, and Jaimini Karakamsha/Swamsha soul drivers.
   - **Lucky Times (`/lucky`):** Daily windows combine `daily_grade` (Tara/Chandra Bala), 30-muhurta & 24-hora `muhurta` tables, and `transit_ashtakavarga` Kakshya bindus (`has_bindu`) so "clear focus" or "agreement" windows reflect both sky quality and personal natal resonance.
   - **Annual & Timeline (`/chat`, `/timeline`):** Tithi Pravesha returns resolve the true *Vaaresha* (`yearLord`), return panchanga, and divisional TP charts (`TP D9`, `TP D10`) across 2026–2036 with exact transit contacts.

### 2.2 Target Performance & Latency Budgets
| Stage / Operation | Target Budget | Measurement & Telemetry Hook |
| :--- | :--- | :--- |
| **Signup / Registration Core (`registrationSet`)** | **`< 15 s`** (`first` + `registration` core only; excludes `on_demand` deep vargas) | `kundli-sync` (`registration.ts`) |
| **Cold Full Digest Build (`digest.build` over stored `kundli_data`, `fetch: false`)** | **`< 25 s`** (async background `kundli-sync` multi-varga pulls follow paced rate limits up to `KUNDLI_SYNC_MAX_MS`) | Span `digest.build` (`reading_agent_spans`) |
| **Deterministic Sub-Technique (`.sub.*`, code readers)** | **`< 150 ms`** per sub-technique over stored `DigestView` | Span `reading.code.*` / `self.sub` |
| **Card Selection (`AreaBrief` / pure memory filter)** | **`< 15 ms`** (zero runtime DB reads; asserted by unit test) | Span `reading.step` |
| **Progressive NDJSON First Section Stream** | **`< 300 ms`** TTFB for fast sections (`profile` / `chart_status` / `biodata`) | `GET /api/dashboard/sections-stream` -> `page_execution_logs` |
| **Cached Board / Card Response** | **`<= 500 ms`** end-to-end | `page_execution_logs` (`PAGE_SLOW_THRESHOLD_MS=1000`) |
| **Warm LLM Input Cache Share** | **`> 70 %`** cached prefix tokens (`parts[0] >= 1024` tokens) | `llm_cache_entries` / Lab telemetry |

### 2.3 Eliminated Failure Modes
1. **Eliminated False `'get_through'` Stance Collapse:** Exporting TP `yearLord` in Radha and parsing it for `kind === 'TP'` in `build.ts` eliminates erroneous `annual: TP<year> yearLord missing` gaps in `dashaAssessment.ts`.
2. **Eliminated `Feb 29` Leap-Day & Polar Sunrise Crashes:** Clamping Feb 29 to Feb 28 (or March 1) in non-leap return search windows eliminates `np.datetime64` `ValueError` crashes, and guarding `drik.sunrise`/`sunset` sentinels (`!(0 <= sr_hrs < 24)`) eliminates polar `_is_night_birth` crashes and wrong `_year_lord` weekday rollbacks.
3. **Eliminated `house: null` & `legacyColumn` Crashes on Divisional Cards:** Serving `natal_export.py` `dignities.dN` across all 23 vargas with `legacyColumn` strictly scoped to `{1, 2, 4, 7, 9, 10}` gives full `HouseCard` + `PlanetCard` coverage without Prisma column errors or Node astrology math.
4. **Eliminated Unvetted Benefic Transit Overclaiming:** Gochara Vedha checks suppress over-optimistic Jupiter/Venus transit claims when an obstructing planet sits in the corresponding Vedha house.
5. **Eliminated Post-2026 Exact Contact Blindness:** Extending `transit_contacts` to 2027–2036 prevents forward readings from dropping to sign-level generalities.
6. **Eliminated Unverified Sign-vs-Bhava Misattribution:** Explicit Bhava Chalit `houseShift` flags prevent reporting a planet's Rasi house when its Bhava Madhya places it in an adjacent house.

---

## 3. Deliverable: Exact Code Paths, Migrations, Docs & Tests

### 3.1 `AIAstra_Radha` (`pyjhora` Engine Repository)
| File Path | Function / Symbol | Deliverable Change |
| :--- | :--- | :--- |
| `src/jhora/natal_export.py` & `export.py` | `run_natal` (`dignities.dN`, `aspects.dN`, `relations.dN`, `arudhas.dN`, `argala.dN`, `house_counts.dN`), `export_horoscope`, `_build_bhava_chalit` | Leverage `natal_export.py`'s already-verified `dignities.dN` (100% pass across all 23 `const.division_chart_factors`, returning full `houses[]` and `planets[]`) rather than scraping strings in legacy `export.py:_build_placements_json`; emit explicit `house_shift` (`rasi_house`, `bhava_house`, `shifted`) in `bhava`/`facts`; add headless `type="compatibility"` and `type="sudarshana_chakra"` (and Phase 3 `type="chakra_sbc"` / `type="chakra_kota"`) routers in `export.py`. |
| `src/jhora/api.py` | `ExportHoroscopeRequest` | Preserve `dob`/`tob` schema (within `MAX_BODY_SIZE=4096`) and add optional `partner_dob`/`partner_tob`/`partner_place`/`partner_lat`/`partner_lon`/`partner_tz` fields (or `params.partner`) for `type="compatibility"`. |
| `src/jhora/annual_export.py` & `pressure_inventory_export.py` | `run_annual`, `_is_night_birth`, `_year_lord`, `_tithi_pravesha_instant` | Invoke `_year_lord(ret_jd, ctx["place"])` (`pressure_inventory_export.py:572–582`) inside `run_annual` for `TITHI_PRAVESHA`; export `year_lord`, `year_lord_rule`, `return_instant.panchanga` (`tithi`, `vaara`, `nakshatra`, `yoga`, `karana`, `hora`), and support `divisional_chart_factor` (`2..60`); **clamp Feb 29 to Feb 28 (or March 1)** when constructing `current_date_start` in non-leap years (`annual_export.py:719–720` / `vratha.py:604`) to prevent `np.datetime64` `ValueError` (`utils.py:752`); **guard `drik.sunrise`/`sunset` polar sentinels** (`!(0 <= sr_hrs < 24)`) in `_is_night_birth` (`annual_export.py:294`) and `_year_lord` (`pressure_inventory_export.py:580`) with a classical `06:00`/`18:00` local solar or nearest-sunrise fallback flagged in metadata (avoiding `to_dms`/`from_dms_str_to_dms` round-tripping on float hours); add optional `tp_vimshottari` 365-day dasha. |
| `src/jhora/transits_export.py` | `run_transit`, `run_transit_range` | Add `vedha` (`obstructed_by`, `virodha_vedha`), `murti_nirnaya` (`gold \| silver \| copper \| iron`, `moon_house_at_ingress`), and optional `varga` parameter (`9, 10, 7, 11`) for divisional transit overlays. |
| `src/jhora/transit_contacts_export.py` | `run_transit_contacts` | Verify/ensure deterministic chunked contact generation over 2027–2036 window (`from="2027-01-01"`, `to="2036-12-31"`). |
| `src/jhora/daily_export.py` | `_run_daily_grade`, `_run_muhurta`, `run_transit_ashtakavarga`, `run_pancha_pakshi` | Verify JSON schema stability for `daily_grade`, `muhurta`, `transit_ashtakavarga` (with `kakshya.has_bindu`); add headless wrapper for `panchanga/pancha_paksha.py` (Phase 3). |
| `src/jhora/horoscope/match/compatibility.py` & `dhasa/sudharsana_chakra.py` | `compatibility_score`, `sudharshana_chakra_chart` | Pure headless JSON adapter functions called by `export.py` (zero Qt/UI imports). |
| `src/jhora/ui/chakra.py` | `sarvatobhadra_data`, `kota_chakra_data` | Extract pure data calculation out of Qt widget methods into headless helper functions (Phase 3, O1). |

### 3.2 `AIAstra_Server` (`Node.js` / TypeScript API Repository)
| File Path | Function / Symbol | Deliverable Change |
| :--- | :--- | :--- |
| `src/config/env.ts` | Typed Env Helpers | Add `getServedVargasList()` (`SERVED_VARGAS_LIST`), `isTpDivisionalPullsEnabled()` (`TP_ENABLE_DIVISIONAL_PULLS`), `getTransitContactsHorizonYears()` (`TRANSIT_CONTACTS_HORIZON_YEARS`), alongside existing `getD9MaturityAgeYears()` (`D9_MATURITY_AGE_YEARS=36`) and `getReadingCacheRecycleMinutes()` (`READING_CACHE_RECYCLE_MINUTES=45`). |
| `src/reading/chartData/catalog.ts` & `src/services/chartCatalogSync.ts` | `LEGACY_VARGAS`, `SERVED_VARGAS`, `ARUDHA_ARGALA_VARGAS`, `BUILTIN_CHART_TYPES`, `mergeChartTypes`, `syncChartCatalog` | Separate `LEGACY_VARGAS = new Set([1, 2, 4, 7, 9, 10])` at `catalog.ts:169` so `legacyColumn` is strictly scoped to `{1, 2, 4, 7, 9, 10}` (preventing Prisma querying non-existent columns like `d11`/`d30` on `Kundli`); replace `SERVED_VARGAS` and expand `ARUDHA_ARGALA_VARGAS` / `dignities.d*` / `aspects.d*` / `relations.d*` / `yogas.d*` / `arudhas.d*` / `argala.d*` / `house_counts.d*` (`catalog.ts:60, 133, 214–233`) gated by `SERVED_VARGAS_LIST` inside both `mergeChartTypes` and `syncChartCatalog` (`chartCatalogSync.ts:77–93`); mark `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `annual.*`, `daily_grade`, `muhurta`, `transit_ashtakavarga`, `sudarshana_chakra` (`changeClass: 'natal'`) as `served: true`. |
| `src/reading/chartData/registration.ts` | `registrationSet` | Filter out `tier === 'on_demand'` from `registrationSet()` (`registration.ts:31–33`) so flipping `served: true` on 23 vargas and `sudarshana_chakra` does NOT eagerly pull them during signup (`< 15 s` registration SLA); route lazy `on_demand` deep vargas via paced async specialist prewarm / Clarify slots (not synchronous board opens). |
| `src/reading/chartData/store.ts` | `ensureChartData`, `movingTypeError`, `complete` | Keep `ensureChartData` (`store.ts:248`) rejecting `changeClass === 'moving'` types (`daily_grade`, `muhurta`, `transit_ashtakavarga`), updating `movingTypeError` (`store.ts:226`) to cite `reading/luckyTimes/service.ts` & `reading/transits/*`; record `engineCommit` from Radha headers/metadata in `complete()` (`TODOS.md:245`). |
| `src/reading/digest/types.ts` & `annualSet.ts` | `PlanetCard`, `HouseCard`, `AnnualRow`, `ANNUAL_CHART_VARGAS` | Extend `PlanetCard` with `vimsopaka`, `harshaBala`, `houseShift`; `HouseCard` with `bhavaBala`; `AnnualRow` with `panchanga`; update `ANNUAL_CHART_VARGAS` in `annualSet.ts:11` if `D2/D7/D30` TP pulls join the background annual set (`[1, 9, 10]` -> `[1, 2, 7, 9, 10, 30]`). |
| `src/reading/digest/build.ts` | `vargaCoverage`, `annualRows`, `DIGEST_NATAL_TYPES` | Ingest `dignities.d2..d144` via `vargaCoverage` (`full` path, yielding full `HouseCard`s + `PlanetCard`s with zero Node math); update `annualRows` (`build.ts:1177`) to parse `yearLord` and `return_instant.panchanga` for `kind === 'TP'`; update `DIGEST_NATAL_TYPES` (`build.ts:1337–1347`) to include `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `bhava`, and `sudarshana_chakra`; bump `DIGEST_VERSION`. |
| `src/reading/dasha/dashaAssessment.ts` | `assessActiveDashaAndTP` | Consume resolved TP `yearLord`, `annual.tithi_pravesha` divisional rows (`TP D9`, `TP D10`), and Vimsopaka/Harsha strengths without false `get_through` collapses. |
| `src/reading/transits/` & `src/reading/luckyTimes/service.ts` | `dailyGrade.ts`, `muhurta.ts`, `transitAshtakavarga.ts`, `vedhaMurti.ts` | Extend existing `muhurta` ingestion (`luckyTimes/service.ts:207–266`) with typed `daily_grade`, `transit_ashtakavarga` (Kakshya bindus), Gochara Vedha, and Murti Nirnaya fetchers writing to `day_tables` / `kundli_day_overlays`; extend `scripts/pull-sachin-annual.ts` & overlay pipeline to 2027–2036. |
| `src/reading/compatibility/service.ts` & `src/reading/llm/cacheSweep.ts` | `evaluateCompatibility`, `recycleIndividualCaches` | Dedicated pair-keyed synastry service calling headless Radha `compatibility`, persisting in a sealed `CompatibilityReport` table keyed by `(user_id, primary_kundli_id, partner_birth_hash)` with `assertOwnAccount`, and explicitly wired into `recycleIndividualCaches` (`cacheSweep.ts:85–149`) for 45-min eviction. |
| `src/techniques/catalog.ts`, `contracts.ts`, `layouts.ts` | `CHART_SOURCES`, `TECHNIQUES`, `ContractSection`, `LAYOUTS`, `LayoutId` | Canonical contract alignments: add `'compatibility'` to `ContractSection` (`contracts.ts:41`) and `compatibility_card`, `sudarshana_wheel`, `chakra_vedha` to `LAYOUTS` (`layouts.ts:13`); add `'special'` to `CHART_SOURCES` (`catalog.ts:25`) or use `'natal'` for `sudarshana_chakra`; register `general.jaimini_karakamsha`, `general.sudarshana_chakra`, and `love.synastry_koota` (`section: 'compatibility'`, `layout: 'compatibility_card'`, `output: 'findings.v3'` while `'planned'` -> `'findings.v2'` when `'built'` per `contracts.test.ts:57`). |
| `src/reading/oracle/digestSlices.ts` & `src/techniques/subagentCachePlan.ts` | `SubAgentId`, `SUBAGENT_DIGEST_SPECS`, `TECHNIQUE_TO_SUBAGENTS` | Expand `SubAgentId` (`digestSlices.ts:21`) with `reading.analyst.compatibility` and `code:sudarshana` / `code:jaimini_kl`; expand `family.varga.vargas` (`digestSlices.ts:443`) to include `D11` and remaining 23 vargas; map new strength/chakra slices and register every technique in `TECHNIQUE_TO_SUBAGENTS` (`subagentCachePlan.ts:127`) for 45-min recycling. |
| `src/agents/registry.ts` & `src/reading/metrics/trace.ts` | `AGENTS`, `CODE_READERS`, `agentIdOf`, `techniqueIdOf` | Register `code:sudarshana` (`reading.code.sudarshana`), `code:jaimini_kl`, and `reading.analyst.compatibility` (`AGENTS` + `trace.ts` for `general.*` chat flows; board/lucky runs tag `agent_id` & `technique` via `withAgentRun` in `registry.ts:611–685`). |

### 3.3 Database, Migrations & Security (`prisma/`, `src/lib/pii/`)
- **M7 Catalog Sync (`chart_data_types`) & Compatibility Schema:** Seed new rows (`served: false`) via additive `prisma migrate deploy` (zero destructive SQL), then run `npm run chart-catalog:sync` (`src/services/chartCatalogSync.ts`) to flip `served` flags from Radha's catalog (respecting `SERVED_VARGAS_LIST`). Add `CompatibilityReport` (`compatibility_reports`) keyed by `(user_id, primary_kundli_id, partner_birth_hash)` via additive Prisma migration.
- **PII Sealing (`src/lib/pii/fields.ts:38–156`):**
  - **`KundliDayOverlay` Remediation (CRITICAL):** `KundliDayOverlay` (`kundli_day_overlays`, `prisma/schema.prisma:439–452`) is **NOT** currently in `SEALED_MODELS`. Explicitly add `KundliDayOverlay: { table: 'kundli_day_overlays', owner: { via: 'kundli_id' }, fields: { payload: json } }` to `SEALED_MODELS` in `src/lib/pii/fields.ts` (with an additive backfill script/migration to seal any existing plaintext `kundli_day_overlays.payload` rows) so `daily_grade`, `muhurta`, and `transit_ashtakavarga` overlays are encrypted at rest with `pii2:v1` AES-256-GCM.
  - **`CompatibilityReport` Sealing & 45-Min Sweep:** Add `CompatibilityReport` (`owner: { via: 'user_id' }`, `fields: { partner_dob: text, partner_tob: text, partner_place: text, payload: json }`) to `SEALED_MODELS` (`src/lib/pii/fields.ts`) AND wire its deletion into `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`).

### 3.4 Documentation & Test Suites
- **Documentation:**
  - `docs/reading-engine/81-priority-2-radha-capabilities-architecture.md` (this architectural plan).
  - `docs/techniques/{work,love,self,lucky,general}/*.md` and `docs/techniques/README.md` (45 modular per-technique enhancement specifications).
  - `docs/TODOS.md` (updated tracking entries with review instructions and handoff recommendations).
- **Test Suites (`AIAstra_Server/tests/unit/` & `evals/`):**
  - `tests/unit/reading/digest/noAstrologyInNode.test.ts` — expand `DIR` scanning (`line 11`) beyond `src/reading/digest/` to also scan `src/reading/transits/` and `src/reading/compatibility/` so zero `% 12` or sign/degree arithmetic enters Wave 3B modules.
  - `tests/unit/reading/digest/priority2Digest.test.ts` — verify 23-varga `dignities.dN` digestion (all `HouseCard`s + `PlanetCard`s), TP `yearLord` + panchanga parsing, `Bhava`/`Vimsopaka`/`Harsha` ingestion, and `legacyColumn` scoping (`{1,2,4,7,9,10}` only).
  - `tests/unit/techniques/contracts.test.ts`, `summaries.test.ts`, `subagentCachePlan.test.ts`, `dashaNavamshaConfirmation.test.ts` — verify all new/updated techniques pass contract, non-PII summary, and 45-min cache plan checks with `guardNoModelCalls()`.
  - `tests/unit/rbac.test.ts` & `tests/unit/pii/seal.test.ts` — extend existing RBAC and PII-sealing test suites to verify `assertOwnAccount`, `KundliDayOverlay`, and `CompatibilityReport` AES-256-GCM sealing + `cacheSweep.ts` eviction.
  - `evals/fixtures/G1/` — refresh golden fixtures for Sachin (46), Sumit (51), Archisha (28), Swati (29), Mohit (24) with Priority 2 payloads, plus Feb 29 leap-day and polar-latitude Radha regression tests.

---

## 4. How It Works When Done

### 4.1 Backend: End-to-End Flow, Concurrency, Timeouts, Retries & Failure Handling
1. **Chart Data Ingestion (`ensureChartData` & `astroKundliClient.ts`):**
   - **Concurrency & Rate Limiting:** `KUNDLI_QUEUE_BATCH_SIZE=2`, `KUNDLI_QUEUE_MAX_FETCHES_PER_USER=1` (background queue), `CHART_DATA_FETCH_CONCURRENCY=2` (on-demand), `RADHA_MAX_CONCURRENT=4` per Node process, `ASTROKUNDLI_REQUEST_SPACING_MS=2000` (with hard floor `ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS=1100` ms start-to-start when spacing is enabled).
   - **Row-Level Distributed Locking:** `ensureChartData` (`store.ts:72`) atomically claims missing/stale rows in `kundli_data` (`status='fetching'`, `leaseMs=90_000`). Concurrent Lambda invocations poll up to the lease rather than firing duplicate Radha calls.
   - **Timeouts:** `astroKundliClient.ts:81` `DEFAULT_TIMEOUT_MS = 120_000` (120 s per-request client timeout, overriding via `ASTROKUNDLI_TIMEOUT_MS`); Radha Lambda timeout = `30,000 ms`; API Gateway HTTP timeout = `29,000 ms`; `ensureChartData` row lease = `90,000 ms` (accommodating client backoff retries).
   - **Registration & Paced On-Demand Isolation:** `registrationSet()` (`registration.ts:31–33`) excludes `tier === 'on_demand'` so signup remains `< 15 s`; deep vargas pull asynchronously via paced background `kundli-sync` (`KUNDLI_SYNC_MAX_MS=720_000`) or specialist prewarm/Clarify slots, never synchronously during board rendering (`chartBundle.ts` is read-through).
   - **Moving & Pair Routing:** `ensureChartData` (`store.ts:248`) rejects `changeClass === 'moving'` types (`daily_grade`, `muhurta`, `transit_ashtakavarga`), which route through `reading/luckyTimes/service.ts` & `reading/transits/*` into `day_tables` / `kundli_day_overlays`; `compatibility` routes through `src/reading/compatibility/service.ts` into sealed `CompatibilityReport`.
   - **Retries & Backoff:**
     - HTTP `429` / Lambda throttle: retried inside `astroKundliClient.ts` with jittered exponential backoff; never lands as `failed` in `kundli_data` unless exhausted.
     - `failed` row cooldown: `FAILED_RETRY_MS = 60_000` (1 minute).
     - `unsupported` row cooldown: `UNSUPPORTED_RETRY_MS = 86_400_000` (24 hours).
   - **Failure Handling & Graceful Degradation:**
     - If an optional Priority 2 pull (e.g., `D45`, `strength.harsha`, or `sudarshana_chakra`) fails or times out, `digest.build` records a structured gap (`gaps.push(...)`) and builds from available rows rather than crashing the board.
     - **TP Fail-Closed Invariant:** If `annual.tithi_pravesha` fails to resolve `year_lord` after retry, `dashaAssessment.ts` deterministically fails closed to `stance = 'get_through'` — never fabricating an expansion verdict.
2. **Deterministic Digest & Sub-Technique Pipeline:**
   - `digest.build` executes asynchronously after sync completion (`kundli-digest` event, `DIGEST_SWEEP_MAX_MS=60_000`) over already-pulled `kundli_data` rows (`fetch: false`, `< 25 s`) and writes sealed `DigestRowInput` rows (`house`, `planet`, `yoga`, `point`, `annual`, `star`) into `kundli_digest` (`DIGEST_VERSION` bumped on Priority 2 activation).
   - Shared board sub-techniques (`.sub.*`) run **once** per build context (`< 150 ms`), writing typed outputs into `technique_outputs` keyed by `(kundliId, techniqueId, digestVersion, clockSystem, boundaryStamp)`.
   - Card selection (`AreaBrief`) executes purely in memory (`< 15 ms`, zero DB queries).
3. **Sub-Agent Caching & Synthesis:**
   - Sub-agents slice exclusively from `DigestView` + `ActivationRow[]` via `sliceDigestForSubAgent` (`digestSlices.ts`).
   - Stable per-individual prefix (`>= 1,024` tokens) is placed in `parts[0]` with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`, warmed in parallel (`READING_EXPLICIT_CACHE=1`), and recycled 45 minutes after consumption via `informIndividualCacheUsed` (`cacheSweep.ts`) and EventBridge `llm-cache-sweep` (`runScheduledSweep`).

### 4.2 API: Endpoints, Queries, Events, Status Codes & Validation
All consumer REST and GraphQL endpoints enforce `assertOwnAccount(ctx.userId, targetUserId)` and emit `Cache-Control: private, no-store, no-cache, must-revalidate`.

| Interface | Method / Operation | Request / Validation (Zod / GraphQL) | Response Payload | Status Codes & Client Errors |
| :--- | :--- | :--- | :--- | :--- |
| **Radha Export (Internal)** | `POST /api/export-horoscope` (or Lambda invoke) | `ExportHoroscopeRequest` (`api.py:85–124`): `{ type, dob, tob, place/lat/lon/tz, params: { varga?, divisional_chart_factor?, ... }, from?, to?, partner_*? }` | Normalized Priority 2 JSON (`dignities.dN` `houses[]`/`planets[]`, `year_lord`, `kakshya`, `ashtakoota`, `sudarshana`) | `200 OK`; `400` bad params; `422` unsupported type; `429` rate limit; `504` >30s Lambda / `120_000 ms` client timeout |
| **Board Stream (Consumer)** | `GET /api/dashboard/sections-stream` | Query `?sections=profile,chart_status,biodata,content,timeline` (`VALID_SECTIONS` in `pageTiming.ts:425`); Headers `X-Astra-Page`, `X-Astra-Session` | `application/x-ndjson; charset=utf-8` line-per-section `{ section, ok, durationMs, ms, data }` (card boards `/you`, `/love`, `/work` use dedicated board v3 endpoints) | `200 OK` (chunked); `401 UNAUTHENTICATED`; per-section `{ ok: false, error: 'Section temporarily unavailable' }` |
| **Telemetry Beacon (Consumer)** | `POST /api/telemetry/page-timings` | `entries` / `timings` batch (<= 25 records, `pageTiming.ts:523`), `sessionId`, `X-Astra-Session` | `{ ok: true, recorded }` persisted to `page_execution_logs` | `200 OK`; `400 { error: 'entries array is required' \| 'no valid timing entries' }` |
| **Self v3 Board (Consumer)** | `GET /api/self/v3`, `PUT /api/self/v3/layout` | Zod layout schema + optimistic `updated_at` check | `SelfV3BoardResponse` (`now`, `cards` with `ShortFace`, `ReadFace`, `evidence[]`, `pastQuestion`) | `200 OK`; `401`; `403 FORBIDDEN`; `409 Conflict` (stale layout); `503 { error: 'timeout' }` (`SELF_V3_ROUTE_BUDGET_MS=2000`) |
| **Lucky Range (Consumer)** | `GET /api/lucky/range` | Currently accepts `from`, `to` (`luckyRoutes.ts:128–138`); extend with Zod validation + optional `tzAlias`, `scenario` (max `getLuckyHorizonDays()`) | Merged `day_tables` + sealed `kundli_day_overlays` enriched with `daily_grade`, `muhurta`, `transit_ashtakavarga` Kakshya score | `200 OK`; `400 BAD_USER_INPUT` (post-Zod extension); `401`; `403`; `409 { error: 'no_place' }`; `503` |
| **Compatibility (GraphQL)** | `query synastryCompatibility(partnerInput)` | Authenticated `userId`; Zod-validated partner `dob`/`tob`/`place` (`assertOwnAccount` on primary `kundliId`) | `{ overallBand, resonanceSummary, frictionSummary, evidence[] }` (36-guna Ashtakoota + Dasakoota + D9/D7 sync) | `200` GraphQL; `UNAUTHENTICATED`; `FORBIDDEN`; `BAD_USER_INPUT`; masked `INTERNAL_SERVER_ERROR` + `requestId` |
| **Internal Workers (EventBridge / Async)** | `POST /events` (`kundli-sync`, `kundli-digest`, `llm-cache-sweep`) | Shared event token (`KUNDLI_SYNC_EVENT_TOKEN`, `KUNDLI_DIGEST_EVENT_TOKEN`); fail-closed if unset | `{ processed, recycled, elapsedMs }` | `200 OK`; `401`/`403` invalid/missing event token |

### 4.3 Frontend Experience: Progressive NDJSON Streaming & Per-State UI
- **Progressive Streaming (`GET /api/dashboard/sections-stream`, `src/telemetry/pageTiming.ts:425, 684`):**
  - `sections-stream` currently serves `VALID_SECTIONS = ['profile', 'chart_status', 'biodata', 'content', 'timeline']` (`pageTiming.ts:425`), while `/you`, `/love`, `/work` card boards use dedicated board endpoints (`/api/self/v3`, `/api/board/*`).
  - Client sends `X-Astra-Page` (`/you`, `/love`, `/work`, `/lucky`) and `X-Astra-Session` via `apiHeaders()`.
  - Fast sections (`profile`, `chart_status`, `biodata`) flush immediately (`< 300 ms`) while heavier sections (`content`, `timeline`) stream asynchronously as newline-delimited JSON chunks (`X-Accel-Buffering: no`).
  - `<PageTimingTracker />` captures `render_ms` and `draw_ms` and posts to **`POST /api/telemetry/page-timings`** (`src/telemetry/pageTiming.ts:523`), correlating client timings with server spans in `page_execution_logs`.
- **Per-State UI Behaviour:**
  - **`pending`:** Skeleton card frame with calm holding copy ("Preparing your personal timeline…").
  - **`building` / `streaming`:** Ready sections render interactively immediately; remaining card slots display gentle progress indicators without blocking scroll or navigation.
  - **`ready`:** Full card surface renders (`ShortFace` first sentence + primary action; `ReadFace` detailed guidance + 1 past-event confirmation question; one-tap `"Chart Details"` lens revealing `evidence[]`).
  - **`failed`:** Individual section failure isolates cleanly (`ok: false`, `"This section is temporarily unavailable"`) with a single retry action — never crashing the board (`<GlobalErrorBoundary>` captures unexpected crashes into `app_error_events`).

### 4.4 UI/UX: Copy on Screen, Zero Chart Jargon & Structured Evidence Encapsulation
- **Zero Sanskrit / Engine Jargon Rule:**
  - Card titles, summaries, action advice, and calibration questions MUST use plain, empathetic second-person English.
  - Strictly prohibited on consumer surfaces: *Dashamsha*, *Navamsha*, *Trimshamsha*, *Vaaresha*, *Tithi Pravesha*, *Ashtakoota*, *Bhakoot*, *Nadi*, *Kakshya*, *Bindu*, *Harsha Bala*, *Vimsopaka*, *Sudarshana Chakra*, *Gochara Vedha*, *Karakamsha*, `Radha`, `pyjhora`, `jhora`.
  - **Translation Examples:**
    - *D10 + Harsha Bala strong in 6th:* "You handle heavy workplace pressure and competing priorities better than most this season; steady execution wins recognition."
    - *Gochara Vedha obstructing Jupiter transit:* "External momentum looks encouraging on paper, yet a quiet scheduling or resource bottleneck may slow approvals until next month."
    - *TP Year Lord strong in D9 (>36 yrs):* "This personal year rewards long-term commitment and mature leadership over quick wins."
- **Structured `evidence[]` Encapsulation:**
  - Every claim stores verifiable machine keys inside `evidence: string[]` (e.g., `["D10.p.Su.h10:exalted", "harsha:Ma:6H:18/20", "tp:2026.yearLord:Ju", "sav_transit:Sa:10H:kakshya_Ve:bindu_1", "vedha:Ju_obstructed_by_Ma"]`), surfaced **only** inside the optional one-tap `"Chart Details"` / Research drawer (vetted per `.agents/skills/dashboard-card-toolbar-vetting/SKILL.md`).
- **Single Past-Event Calibration Question:** Each card offers one concrete, verifiable past-event question (e.g., *"Between April and July, did your responsibilities shift toward managing others or stabilizing a difficult project?"*) whose answer persists to `person_facts` / `timeline_calibration`.

---

## 5. Architecture: Component Interactions, Execution Boundaries & Boundary Guarantees

### 5.1 System Component & Data Flow Diagram
```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER WEB (AIAstra_WEB)                            │
│  /you, /love, /work, /lucky  ──► GET /api/dashboard/sections-stream (NDJSON)  │
│  <PageTimingTracker />       ──► POST /api/telemetry/page-timings             │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ HTTPS + JWT + X-Astra-Page
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                SERVER API LAMBDA (AIAstra_Server / Express + GraphQL)         │
│  1. Auth & RBAC Gate: requireUser / assertOwnAccount(ctx.userId, targetId)    │
│  2. Response Headers: Cache-Control: private, no-store, no-cache, must-reval  │
│  3. Fast Path (<15ms): AreaBrief pure selection over technique_outputs        │
│  4. Deterministic Sub-Techniques (<150ms): reading.code.* over DigestView     │
│  5. Cached Sub-Agents: parts[0] stable prefix (>=1024 tok) -> Gemini Cache    │
│  6. Async Workers (POST /events): kundli-sync | kundli-digest | cache-sweep   │
└──────────────┬───────────────────────────────────────┬────────────────────────┘
               │ ASTROKUNDLI_TRANSPORT=lambda          │ Prisma + pii2:v1 AES-GCM
               │ (RADHA_MAX_CONCURRENT=4,              │ (SEALED_MODELS)
               │  spacing >= 1100ms)                   │
               ▼                                       ▼
┌────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  RADHA LAMBDA (aiastra-pyjhora)    │   │  POSTGRESQL (Sealed + Indexed)       │
│  - SOLE ASTROLOGICAL AUTHORITY     │   │  - kundli_data (sealed payload)      │
│  - 23 Vargas (dignities.dN)        │   │  - kundli_digest (sealed row/source) │
│  - TP year_lord + return panchanga │   │  - kundli_activation (plain GIN)     │
│  - Daily Grade, Muhurta, Kakshya   │   │  - technique_outputs (sealed output) │
│  - Bhava/Vimsopaka/Harsha Bala     │   │  - reading_findings_cache (sealed)   │
│  - Headless Compatibility & Chakras│   │  - day_tables / kundli_day_overlays* │
│  - Gochara Vedha & Murti Nirnaya   │   │  - compatibility_reports* (sealed)   │
│  - Feb 29 & Polar Sunrise Guards   │   │  - llm_cache_entries (45m TTL sweep) │
└────────────────────────────────────┘   └──────────────────────────────────────┘
  (* KundliDayOverlay & CompatibilityReport explicitly added to SEALED_MODELS)
```

### 5.2 Execution Boundaries
1. **Request Path (Interactive API):**
   - Strictly read-through over `kundli_digest`, `kundli_activation`, `technique_outputs`, `reading_findings_cache`, `day_tables`, `kundli_day_overlays`, and `compatibility_reports`.
   - Zero live `kundli_data` raw JSON parsing or `ensureChartData` calls during user board rendering (`subagentCachePlan.ts`, `chartBundle.ts`).
   - Moving queries (`lucky/range` via `reading/luckyTimes/service.ts` & `reading/transits/*`, never `ensureChartData`) and pair queries (`compatibility` via `reading/compatibility/service.ts`) or `prashna` invoke Radha synchronously only when cached rows are absent, with strict timeouts and `assertOwnAccount`.
2. **Async Background Worker (`kundli-sync`, `kundli-digest`):**
   - `registrationSet()` pulls `first` + `registration` core (`< 15 s` signup), while `ensureChartData` claims `kundli_data` rows (90s lease) for paced background sync (`KUNDLI_SYNC_MAX_MS = 12 min`) and specialist/Clarify on-demand pulls.
   - `digest.build` transforms stored `kundli_data` (`fetch: false`) into normalized `DigestView` (`kundli_digest`) and `ActivationRow[]` (`kundli_activation`).
3. **Scheduled Sweep (`llm-cache-sweep`, `kundli-sync-sweep`, `kundli-digest-sweep`):**
   - EventBridge triggers `POST /events` with authenticated token. Because AWS Lambda containers freeze between invocations (stopping in-process `setTimeout` timers in `informIndividualCacheUsed`), EventBridge `llm-cache-sweep` (`runScheduledSweep` in `src/reading/llm/cacheSweep.ts`) is the authoritative production 45-minute cache enforcement path.

### 5.3 Non-Negotiable Boundary Guarantees
1. **Radha Computes Astrology; Node Computes NONE:**
   - Node.js NEVER calculates planetary longitudes, divisional sign conversions, house offsets (`% 12` arithmetic is strictly prohibited), lordships, aspects, dignities, Vedha pairs, Tara/Chandra bala, or Ashtakoota points.
   - Enforced continuously by `tests/unit/reading/digest/noAstrologyInNode.test.ts` (expanded to cover `src/reading/transits/` and `src/reading/compatibility/`) and code review.
2. **Self-Only RBAC (`assertOwnAccount`):**
   - Every user-scoped GraphQL resolver and REST endpoint (`sections-stream`, `self/v3`, `lucky/range`, `compatibility`) invokes `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`), throwing `Forbidden: cross-account access denied` on mismatch.
   - Staff inspections in Admin route exclusively through HMAC-signed headers with `admin_actions` audit logging.
3. **At-Rest PII Sealing (`SEALED_MODELS`, `pii2:v1` AES-256-GCM):**
   - Every derived astrological table (`Kundli`, `KundliFacts`, `KundliData`, `KundliDigest`, `KundliTransitOverlay`, `KundliDayOverlay` *[added in Wave 3B/5]*, `CompatibilityReport` *[added in Wave 3B/5]*, `ReadingFindingsCache`, `TechniqueOutput`, `AreaBuild`, `ReadingDossier`, `KundliSlice`) is encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`) using per-owner `pii2:v1` AES-256-GCM keys.
   - All `/api/*` and `/graphql` responses emit `Cache-Control: private, no-store, no-cache, must-revalidate`.
4. **45-Minute Used-Cache Recycling (`READING_CACHE_RECYCLE_MINUTES = 45`):**
   - Prewarming (`ensurePromptCache`, `saveDbReaderCache`) leaves `hit_count = 0`.
   - Every consumption of a cached prefix, `reading_findings_cache` row, `technique_outputs` row, or `compatibility_reports` row calls `informIndividualCacheUsed({ userId, kundliId })` (`src/reading/llm/cacheSweep.ts`), scheduling `recycleIndividualCaches(owner, { onlyUsed: true })` after `getReadingCacheRecycleMinutes()` (45 min) and backed by EventBridge `runScheduledSweep`.
   - Recycling purges across **all persistence & memory layers**: Gemini `cachedContents`/`llm_cache_entries`, `reading_findings_cache`, `technique_outputs`, `compatibility_reports`, and all in-memory memos (`evictFindingsCacheForIndividual`, `evictCodeReaderMemoForIndividual`, `evictFullContextsForIndividual`, etc.).

---

## 6. Ingredients: Libraries, Env Vars, IAM, Models, Cohort & Ownership

### 6.1 Libraries & Runtime Dependencies
- **Radha (`AIAstra_Radha`):** Python 3.11, `pyjhora` (core astrological calculations, `compatibility.py`, `sudharsana_chakra.py`, `pancha_paksha.py`), `swisseph` (Swiss Ephemeris), FastAPI/Flask adapter for AWS Lambda. (Zero new third-party dependencies required.)
- **Server (`AIAstra_Server`):** Node 20+, TypeScript, Express, GraphQL (`graphql-yoga`/schema), Prisma ORM, `zod` (strict payload validation), `@aws-sdk/client-lambda` (Radha invocation).

### 6.2 Environment Variables (`src/config/env.ts` — `GEMINI.md` Rule #1)
Per mandatory design rules, all configurable selections, rule lists, and thresholds MUST be read via typed helpers in `src/config/env.ts`:

| Env Var | Typed Helper in `src/config/env.ts` | Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `SERVED_VARGAS_LIST` *(new)* | `getServedVargasList()` | `1,2,3,4,5,6,7,8,9,10,11,12,16,20,24,27,30,40,45,60,81,108,144` | Controls which `varga.d<N>` / `dignities.d<N>` entries are `served: true`, respected by both `mergeChartTypes` (`catalog.ts:297`) and `syncChartCatalog` (`chartCatalogSync.ts:77`) so DB overrides cannot bypass env gating. |
| `TP_ENABLE_DIVISIONAL_PULLS` *(new)* | `isTpDivisionalPullsEnabled()` | `true` (`1`) | Enables dynamic `annual.tithi_pravesha` divisional pulls (`divisional_chart_factor=2,7,9,10,30`). |
| `D9_MATURITY_AGE_YEARS` *(existing)* | `getD9MaturityAgeYears()` | `36` (clamped `18..100`) | Saturn maturation threshold gating joint `D1 + D9` mutual confirmation (`ageYears > threshold`). |
| `TRANSIT_CONTACTS_HORIZON_YEARS` *(new)* | `getTransitContactsHorizonYears()` | `10` (clamped `1..20`) | Forward horizon for exact slow-transit contact pulls (`2027–2036`). |
| `READING_CACHE_RECYCLE_MINUTES` *(existing)* | `getReadingCacheRecycleMinutes()` | `45` (clamped `5..240`) | Inactivity TTL before `recycleIndividualCaches` deletes used individual caches. |
| `CHART_DATA_FETCH_CONCURRENCY` *(existing)* | `concurrencyDefault()` in `store.ts` | `2` | Max parallel Radha fetches per `ensureChartData` request. |
| `RADHA_MAX_CONCURRENT` *(existing)* | `getRadhaMaxConcurrent()` | `4` (clamped `1..16`) | Process-wide Radha in-flight semaphore. |
| `ASTROKUNDLI_REQUEST_SPACING_MS` *(existing)* | `getAstroKundliRequestSpacingMs()` | `2000` (floor `1100`) | Start-to-start spacing protecting upstream rate limits. |
| `TECHNIQUE_CACHE_VERSION` *(existing)* | `getTechniqueCacheVersion()` | `'1'` (bump to `'2'` on P2 ship) | Invalidates stale pre-P2 `technique_outputs` cleanly. |

### 6.3 IAM, EventBridge & Sealed Prisma Models
- **IAM Permissions:** `aiastra-server-api` execution role retains least-privilege `lambda:InvokeFunction` scoped exclusively to `arn:aws:lambda:us-east-1:900515855120:function:aiastra-pyjhora`.
- **EventBridge Schedules:**
  - `llm-cache-sweep` (every 15 min) -> authoritative production enforcement of 45-min `READING_CACHE_RECYCLE_MINUTES` across Lambda freezes.
  - `kundli-sync-sweep` / `kundli-digest-sweep` -> backfills Priority 2 rows & rebuilds stale digests within `DIGEST_SWEEP_MAX_MS=60000`.
- **Sealed Prisma Models (`src/lib/pii/fields.ts:38–156`):** `Kundli`, `KundliFacts`, `KundliData`, `KundliDigest`, `KundliTransitOverlay`, `ReadingFindingsCache`, `TechniqueOutput`, `AreaBuild`, `ReadingDossier`, `KundliSlice`, **plus newly added `KundliDayOverlay` (`payload`) and `CompatibilityReport` (`partner_dob`, `partner_tob`, `partner_place`, `payload`)**. `KundliActivation` and `ReadingAgentSpan` remain plain-by-construction (no PII, indexed for range queries).

### 6.4 Canonical Test Cohort & Golden Fixtures
All Priority 2 changes must pass deterministic replay and empirical accuracy checks across the 5 canonical charts (`evals/fixtures/G1/` & `research_*` staging):
1. **Sachin (age 46):** Post-36 D9 maturity active; tests `D10`, `D11`, `TP yearLord`, `strength.harsha`, `2027–2036` transit contacts.
2. **Sumit (age 51):** Post-36 D9 maturity active; tests full ±10 yr annual parity (`divisional_chart_factor=2,7,9,10`), `strength.vimsopaka`, `sudarshana_chakra`.
3. **Archisha (age 28):** Pre-36 (`ageYears <= 36`) baseline; tests `D1`-primary with `D9`/`D7` romantic support, `D24` learning, annual/overlay parity catch-up.
4. **Swati (age 29):** Pre-36 baseline; tests `compatibility` synastry pair validation, `daily_grade`/`muhurta` Kakshya filtering.
5. **Mohit (age 24):** Young adult (`under_25` band); tests junior career-stage vocabulary guards (`SELF_V2_JUNIOR_BANDS`) + `D10`/`D3`/`strength.bhava`.

### 6.5 Ownership Matrix
| Component / Deliverable | Owning Agent / Session | Reviewer / Gate |
| :--- | :--- | :--- |
| `AIAstra_Radha` Python exports (`export.py`, `annual_export.py`, `natal_export.py`, `transits_export.py`, `ui/chakra.py`) | Radha Session (`AIAstra_Radha`) | Radha pytest suite + JSON schema contract check |
| `AIAstra_Server` Catalog, Digest, Dasha, Techniques, Cache Plans | Server Implementer (`AIAstra_Server`) | `npx.cmd tsc --noEmit` + `npx.cmd vitest run` |
| Prisma M7 `chart_data_types` seed sync / additive migrations | Server Implementer via `npx.cmd prisma migrate deploy` | `npx.cmd prisma migrate status` (no destructive SQL) |
| Golden Fixtures & Research QA Verifier (`>= 95%` 8-gate) | QA / Verifier Agent (`research.technical_verifier`) | Lab dossier replay + `guardNoModelCalls()` |
| Lambda & Amplify Staging Deployments (`release-candidate-staging`) | Deploy Session / Sachin (AWS profile `amplifyv2` / `gh sachinm`) | GitHub Actions OIDC green + `/health` smoke check |

---

## 7. Action Steps in Sequence

Steps within the same wave (`A` vs `B`) target different repositories/files and execute in parallel per `AGENTS.md` ("Split first").

| Step | Wave | Owning Files | Action | Definition of Done |
| :--- | :--- | :--- | :--- | :--- |
| **1A** | Wave 1 (Parallel) | `AIAstra_Radha/src/jhora/natal_export.py`, `export.py` | Verify and lock `natal_export.py` `dignities.dN` (already 100% passing across all 23 `const.division_chart_factors` with `houses[]` & `planets[]`), `aspects.dN`, `relations.dN`, `arudhas.dN`, `argala.dN`, `house_counts.dN`; emit `house_shift` for Bhava Chalit (no legacy string-scraping in `export.py:_build_placements_json`). | Radha returns complete `dignities.dN` / `arudha` / `argala` JSON for all 23 vargas (`D1..D144`) in unit tests. |
| **1B** | Wave 1 (Parallel) | `AIAstra_Radha/src/jhora/annual_export.py`, `pressure_inventory_export.py` | Invoke `_year_lord(ret_jd, ctx["place"])` (`pressure_inventory_export.py:572–582`) inside `run_annual` for `TITHI_PRAVESHA`; emit `year_lord`, `year_lord_rule`, `return_instant.panchanga` (`tithi`, `vaara`, `nakshatra`, `yoga`, `karana`, `hora`), and support `divisional_chart_factor`; **clamp Feb 29 to Feb 28 (or March 1)** in non-leap `current_date_start` windows (`annual_export.py:719–720` / `vratha.py:604`); **guard `drik.sunrise`/`sunset` polar sentinels** (`!(0 <= sr_hrs < 24)`) in `_is_night_birth` (`annual_export.py:294`) and `_year_lord` (`pressure_inventory_export.py:580`) with a flagged solar fallback. | `annual.tithi_pravesha` returns non-null `year_lord` & 6-field `panchanga`; **Feb 29 leap-day (`1996-02-29` across `2024`/`2026`) and polar latitude (`69.65N`) regression tests pass**. |
| **2A** | Wave 2 (Parallel) | `AIAstra_Server/src/config/env.ts`, `src/reading/chartData/catalog.ts`, `registration.ts`, `src/services/chartCatalogSync.ts` | Add `getServedVargasList()`, `isTpDivisionalPullsEnabled()`, `getTransitContactsHorizonYears()` to `env.ts`; separate `LEGACY_VARGAS = new Set([1,2,4,7,9,10])` at `catalog.ts:169` so `legacyColumn` never attaches to `D11`/`D30`; expand `ARUDHA_ARGALA_VARGAS` and enable `dignities.d*`, `aspects.d*`, `relations.d*`, `arudhas.d*`, `argala.d*`, `house_counts.d*`, `strength.{bhava,vimsopaka,harsha}`, `annual.*`, `daily_grade`, `muhurta`, `transit_ashtakavarga`, `sudarshana_chakra`; enforce `SERVED_VARGAS_LIST` inside `mergeChartTypes` & `syncChartCatalog`; **update `registrationSet()` (`registration.ts:31–33`) to exclude `tier === 'on_demand'`** so signup stays `< 15 s`. | `CHART_TYPE_BY_ID` reflects Priority 2 `served` flags; `legacyColumn` exists only on `{1,2,4,7,9,10}`; `registrationSet()` excludes `on_demand`; `tsc --noEmit` passes. |
| **2B** | Wave 2 (Parallel) | `AIAstra_Server/src/reading/digest/types.ts`, `build.ts`, `annualSet.ts`, `dashaAssessment.ts` | Ingest `dignities.d2..d144` via `vargaCoverage` (`full` path -> full `HouseCard` + `PlanetCard` with zero Node math); update `annualRows` (`build.ts:1177`) to parse `yearLord` and `panchanga` for `kind === 'TP'`; update `DIGEST_NATAL_TYPES` (`build.ts:1337`) to include `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `bhava`, and `sudarshana_chakra`; align `annualSet.ts` `ANNUAL_CHART_VARGAS`; bump `DIGEST_VERSION`. | `noAstrologyInNode.test.ts` passes; TP `yearLord` resolves cleanly in `dashaAssessment.ts` with zero false `'get_through'` gaps. |
| **3A** | Wave 3 (Parallel) | `AIAstra_Radha/src/jhora/api.py`, `export.py`, `transits_export.py`, `transit_contacts_export.py` | Add partner fields & exemption to `ExportHoroscopeRequest` (`api.py`); add headless `compatibility` and `sudarshana_chakra` export endpoints in `export.py`; add `vedha`, `murti_nirnaya`, and divisional transit scope (`D9, D10, D7, D11`) in `transits_export.py`; verify 2027–2036 chunking in `transit_contacts_export.py`. | Headless JSON endpoints return validated schemas for Ashtakoota/Dasakoota, 3-wheel Sudarshana, Vedha, and Murti Nirnaya. |
| **3B** | Wave 3 (Parallel) | `AIAstra_Server/src/reading/transits/*`, `luckyTimes/service.ts`, `compatibility/service.ts`, `store.ts`, `src/lib/pii/fields.ts`, `cacheSweep.ts` | Extend `muhurta` ingestion (`luckyTimes/service.ts`) with `daily_grade`, `transit_ashtakavarga` (Kakshya bindus), `vedha`/`murti` fetchers (`day_tables` / `kundli_day_overlays`, updating `movingTypeError` in `store.ts:226`); build pair-keyed `compatibility/service.ts` (`CompatibilityReport`); add **`KundliDayOverlay`** and **`CompatibilityReport`** to `SEALED_MODELS` (`fields.ts`) and wire `CompatibilityReport` into `recycleIndividualCaches` (`cacheSweep.ts`); expand `noAstrologyInNode.test.ts` to scan `src/reading/transits/` and `src/reading/compatibility/`. | Fetchers pass Zod validation; `rbac.test.ts`, `seal.test.ts`, and expanded `noAstrologyInNode.test.ts` pass (`guardNoModelCalls()`). |
| **4** | Wave 4 (Server) | `src/techniques/{catalog,contracts,layouts,subagentCachePlan}.ts`, `src/agents/registry.ts`, `src/reading/metrics/trace.ts`, `src/reading/oracle/digestSlices.ts` | Add `'compatibility'` to `ContractSection` (`contracts.ts:41`), `compatibility_card`/`sudarshana_wheel`/`chakra_vedha` to `LAYOUTS` (`layouts.ts`), `'special'` (or `'natal'`) to `CHART_SOURCES` (`catalog.ts:25`), and `reading.analyst.compatibility` + `code:sudarshana` + `D11..D144` `family.varga.vargas` to `digestSlices.ts`; register `general.jaimini_karakamsha`, `general.sudarshana_chakra`, and `love.synastry_koota` (`findings.v3` while `'planned'` -> `'findings.v2'` when `'built'`); register 45-min cache plans in `subagentCachePlan.ts` & `trace.ts`/`registry.ts`. | `npx.cmd vitest run tests/unit/techniques/` passes 100% (`contracts`, `catalog`, `summaries`, `subagentCachePlan`, `pieces`). |
| **5** | Wave 5 (DB & Evals) | `prisma/migrations/*`, `chartCatalogSync.ts`, `evals/fixtures/G1/`, `scripts/pull-sachin-annual.ts` | Deploy additive Prisma migration (`CompatibilityReport` + `chart_data_types` seed rows with `served: false`, plus `KundliDayOverlay` backfill seal) via `npx.cmd prisma migrate deploy`; run `npm run chart-catalog:sync` (`chartCatalogSync.ts`) to sync `served` flags; run canonical cohort backfill (2027–2036 contacts, `D11`, annual TP divisional rows); replay Lab QA (`research.technical_verifier`). | `prisma migrate status` clean; `research.technical_verifier` >= 95% pass across all 5 canonical cohort profiles. |
| **6** | Wave 6 (Optional O1–O3) | `AIAstra_Radha/src/jhora/ui/chakra.py`, `pancha_paksha.py`, `annual_export.py` + Server adapters | Decouple Sarvatobhadra Chakra & Kota Chakra from Qt UI; expose Pancha Pakshi biorhythm to Lucky Times; add TP compressed 365-day Vimshottari. | Headless JSON verified; integrated into `lucky.scenarios` and `general.oracle` without UI regressions. |

---

## 8. Development Phases: Shippable Checkpoints & Verification

### Phase 1: Core 23 Vargas & Tithi Pravesha Annual Repair (Required R1–R4, R6)
- **Scope:** Serve `natal_export.py` `dignities.dN` (plus `aspects.dN`, `relations.dN`, `arudhas.dN`, `argala.dN`, `house_counts.dN`) across all 23 vargas with `legacyColumn` strictly scoped to `{1, 2, 4, 7, 9, 10}`; exclude `on_demand` in `registrationSet()` (`< 15 s` signup); fix TP `year_lord` (*Vaaresha*), return panchanga, Feb 29 leap-day clamp, and polar sunrise sentinel guards; unlock dynamic TP divisional pulls (`TP D9`, `TP D10`); add Jaimini Karakamsha & Swamsha technique.
- **Closing Verification:**
  - `npx.cmd tsc --noEmit` exits `0`.
  - `npx.cmd vitest run tests/unit/reading/digest/ tests/unit/techniques/` passes all suites (`noAstrologyInNode`, `contracts`, `summaries`, `subagentCachePlan`, `dashaNavamshaConfirmation`).
  - Radha regression tests pass for Feb 29 leap-day (`1996-02-29` across `2024`/`2026`) and polar latitude (`69.65N`).
  - Lab dossier replay on Sachin (46) and Archisha (28) logs non-null `TP2026.yearLord` and resolved `D10.h*` / `D11.h*` `HouseCard`s without `'get_through'` fallback logs.

### Phase 2: Strength Models, Daily Grade, Muhurta, Transit Ashtakavarga & 2027–2036 Horizon (Required R5, High-Value H5–H6)
- **Scope:** Flip `served: true` for `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `daily_grade`, `muhurta`, `transit_ashtakavarga` (and add `strength.*` + `bhava` to `DIGEST_NATAL_TYPES`); wire Kakshya bindus into Lucky Times (`day_tables` / `kundli_day_overlays`, never `ensureChartData`) and Work/Self boards; **seal `KundliDayOverlay` in `SEALED_MODELS`**; extend exact `transit_contacts` to 2027–2036; run Archisha parity backfill.
- **Closing Verification:**
  - `npx.cmd vitest run tests/unit/` passes with `guardNoModelCalls()`, `tests/unit/pii/seal.test.ts` confirms `KundliDayOverlay` sealing, and `noAstrologyInNode.test.ts` scans `src/reading/transits/`.
  - Lucky Times API (`/api/lucky/range`) returns Kakshya-scored windows in `<= 500 ms` with zero Sanskrit terms on card surfaces.
  - Playwright / browser screenshots saved under `docs/screenshots/p2-phase2/` (`01-you.png`, `02-work.png`, `03-lucky.png`) verifying NDJSON streaming (`sections-stream` + `/api/telemetry/page-timings`) and clean `"Chart Details"` evidence expansion.

### Phase 3: Headless Synastry, Sudarshana Chakra, Gochara Vedha, Murti Nirnaya & O1–O3 (High-Value H1–H4, H7–H8, Optional O1–O3)
- **Scope:** Expose headless Ashtakoota/Dasakoota compatibility (`love.synastry_koota`, layout `compatibility_card`, agent `reading.analyst.compatibility`, section `compatibility`, pair-keyed `CompatibilityReport` in `SEALED_MODELS` + `cacheSweep.ts`) and 3-wheel Sudarshana Chakra (`general.sudarshana_chakra`, layout `sudarshana_wheel`); add Gochara Vedha obstruction gating (`chakra_vedha`), Murti Nirnaya transit vehicle, Bhava Chalit `houseShift`, and divisional transit overlays (`D9/D10/D7/D11`); optionally ship Sarvatobhadra, Kota Chakra, Pancha Pakshi, and TP compressed Vimshottari.
- **Closing Verification:**
  - Full `npx.cmd tsc --noEmit` + full `npx.cmd vitest run` green (including `tests/unit/rbac.test.ts`, `tests/unit/pii/seal.test.ts`, and expanded `noAstrologyInNode.test.ts` covering `src/reading/transits/` and `src/reading/compatibility/`).
  - Security & RBAC gate: cross-account access tests confirm `403 Forbidden: cross-account access denied`; `SEALED_MODELS` audit confirms AES-256-GCM encryption on `KundliDayOverlay`, `CompatibilityReport`, and all derived tables; 45-min `recycleIndividualCaches` (`cacheSweep.ts`) test confirms purge across all persistence and memory layers.
  - `research.technical_verifier` achieves `>= 95%` across all 8 gates on the 5-person canonical cohort.
- **Deferred Items (Out of Scope for Priority 2):**
  - Bhrigu Nandi Nadi and KP Sub-Lords (flagged as future Priority 3 in Doc 80; requires separate classical verification).
  - Private user `"money ledger"` fact type and corporate incorporation charts (`docs/TODOS.md:241`, awaiting product decision from Sachin).

---

## 9. One Recommendation

### Chosen Design: Hybrid Core (`first` + `registration`) + Paced Lazy `on_demand` Deep Vargas & Dedicated Moving/Pair Services
We recommend **Hybrid Core + Paced Lazy Deep-Varga Pull with Dedicated Moving/Pair Services**:
1. **Signup/Background Core (`registrationSet()` excluding `on_demand`):** Update `registrationSet()` (`src/reading/chartData/registration.ts:31–33`) to pull only `first` + `registration` core assets (`D1, D2, D3, D4, D7, D9, D10, D12, D30, D60` + `dignities.d*`, `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, current TP `annual.tithi_pravesha`, and `sudarshana_chakra` as `tier: 'registration'`), keeping initial signup `< 15 s` and digest computation over stored rows `< 25 s` (`fetch: false`).
2. **Paced Lazy Deep Vargas (`tier: 'on_demand'`, `served: true`):** Keep ultra-specialized deep vargas (`D5, D6, D8, D11, D16, D20, D24, D27, D40, D45, D81, D108, D144`) as `tier: 'on_demand'` (`served: true`), pulled asynchronously via `ensureChartData` during Clarify/specialist prewarm or paced background `kundli-sync` (`ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS = 1100 ms`), never blocking signup or synchronous board opens (`chartBundle.ts` remains read-through).
3. **Dedicated Moving & Pair Pipelines (Never `ensureChartData`):** Because `ensureChartData` (`store.ts:248`) rejects `changeClass === 'moving'` and `kundli_data` keys on a single `kundli_id`, route `daily_grade`, `muhurta`, and `transit_ashtakavarga` strictly through `reading/luckyTimes/service.ts` & `reading/transits/*` (`day_tables` + sealed `KundliDayOverlay`), and route `love.synastry_koota` through `reading/compatibility/service.ts` (`CompatibilityReport` keyed by `(user_id, primary_kundli_id, partner_birth_hash)`, sealed in `SEALED_MODELS` and swept by `cacheSweep.ts`).
4. **Zero Node Math + 45-Min Cache Lifecycle:** Radha computes 100% of placements, houses (`dignities.dN`), Vedha, Kakshya, and kootas; Server runs deterministic `< 150 ms` sub-techniques into `technique_outputs`, selects cards in `< 15 ms`, and recycles used individual caches at 45 minutes via `cacheSweep.ts` + EventBridge `llm-cache-sweep`.

**Why:** Fixing `registrationSet()` prevents a `+30–54 s` signup latency storm when 23 vargas and deep tables become `served: true`, while separating `moving`/`pair` pipelines prevents `ensureChartData` and Prisma `legacyColumn` crashes.

| Architectural Alternative | Latency / Signup Cost | Storage & Cache Efficiency | Boundary & Maintenance Verdict | Decision |
| :--- | :--- | :--- | :--- | :--- |
| **1. Full Eager Pre-Calculation** (pull all 23 vargas + all deep tables via unchanged `registrationSet()`) | Poor (`+30–54 s` signup storm due to 1.1–2.0s Radha spacing across 27+ extra calls) | Wasteful (stores `D81/D108/D144` & `D5/D6` for users who never ask deep Prashna/ancestral queries) | High Lambda concurrency & `kundli-sync-sweep` starvation risk | **Rejected** |
| **2. Pure Runtime Lazy Calculation** (call Radha on board open, compute offsets in Node) | Violates SLA (`> 3 s` board open; risks 29s API Gateway timeout) | Poor (re-fetches or recomputes across boards; low cache hit rate) | **Violates core rule** if Node computes any house/varga math | **Rejected** |
| **3. Hybrid Core + Paced Lazy Deep Pull + Dedicated Moving/Pair Services (Recommended)** | **Optimal** (`< 15 s` signup; `< 25 s` digest compute; `< 300 ms` NDJSON; `< 15 ms` card select) | **Optimal** (`> 70%` warm prefix cache hit; 45-min EventBridge + `cacheSweep.ts` sweep) | **100% Compliant** (zero Node math, strict RBAC, `KundliDayOverlay` & `CompatibilityReport` sealed) | **Recommended** |
