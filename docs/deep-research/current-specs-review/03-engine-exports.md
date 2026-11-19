# 03 — Calculation engine exports (code inventory)

Internal review document. It records what the engine computes and serves to the Node server, as of the commit below, so it can be compared with the classical-text research (dashas, Jaimini, vargas, transits, Tajika, prashna, muhurta). Every claim cites code. Paths are relative to the engine repo `AIAstra_Radha` at the inspected commit, which is written as `@ b902bea` where it helps.

| Item | Value |
|---|---|
| Repo | `C:/Users/Owner/Documents/work/AIAstra_Radha` |
| Branch inspected | `origin/release-candidate-staging` (deploys through `.github/workflows/deploy-lambda.yml` on push to that branch, to Lambda `aiastra-pyjhora`) |
| Commit inspected | `b902bea` (2026-11-15 13:24 -0800), "chore(release): merge develop retrograde vakra/ashtagati/cheshta/combustion export" |
| `origin/develop` | `658dff7`, fully contained in the commit above |
| Local working tree | HEAD is detached at `0c11037` (2026-11-14). It is 35 files behind the inspected commit (`git diff --stat 0c11037 origin/release-candidate-staging`). The local `release-candidate-staging` ref is `8709a29`, behind origin. Nothing was checked out: all code was read from a `git archive` of `b902bea`. |
| Library | pyjhora is **vendored and patched** under `src/jhora/` (`src/jhora/_package_info.py`, version `4.6.0` in the root `_package_info.py:21`). `requirements.lambda.txt` has no PyJHora dependency. The Dockerfile copies only `src/` and `lambda_handler.py`, so the root-level duplicate trees (`horoscope/`, `panchanga/`, `ui/`, `utils.py`) are **not deployed**. |
| Default ayanamsa | `LAHIRI` (`src/jhora/const.py:192`, `src/jhora/api.py:97`) |

---

## 1. Entry points

| Entry | File:function | Notes |
|---|---|---|
| Lambda handler | `lambda_handler.py` → `Mangum(app)` over `jhora.api:app` | The FastAPI app is the whole surface. |
| `POST /api/export-horoscope` | `src/jhora/api.py:400` `export_horoscope` | One `type` per call. It is checked against `CALC_VERSIONS` (`src/jhora/export.py:168`) and dispatched by `run_export_by_type` (`src/jhora/export.py:1202`). The response is `{type, data, calc_version, params_used}`. |
| `POST /api/calculate-full-kundli` (also `/calculate-full-kundli`) | `src/jhora/api.py:516` `calculate_full_kundli` | A batch of `fields`. The default is `DEFAULT_BATCH_FIELDS` (`api.py:214`): biodata, d1, d2, d4, d7, d9, d10, charakaraka, vimsottari_dasa, narayana_dasa. Other fields go to the natal builders or to `run_export_by_type`. |
| `type: catalog` | `src/jhora/export.py:317` `build_catalog` | Lists every served type with its `calc_version` and params, plus `engine_commit`. |
| Dispatcher | `src/jhora/export.py:1202` `run_export_by_type` → per-module `run_*` (lines 1236-1284) or `_run_export_by_type_locked` (`:1290`) for biodata, `d*`, charakaraka, the legacy dashas and `dasha.*` | It runs under a global lock (`_export_global_lock`). |
| Request limits | `api.py:29` `MAX_BODY_SIZE = 4096`. There is a rate limit of one call per second per client unless the call carries an API key (`export.py:327`). |  |

---

## 2. Exported sections (every served `type`)

The source of truth is `CALC_VERSIONS` (`src/jhora/export.py:168-212`).

| Exported section (`type`) | function / file | contents | levels / granularity |
|---|---|---|---|
| `biodata` | `export.py:635` `_build_biodata_json` | Date, time, tz, place, lunar year-month, tithi, vara, nakshatra, yoga, karana, hora lord, mahakala hora, kaala lord, sunrise and sunset, ayanamsa value, janma ghatis. Altitude and sidereal time are always `N/A` (`:659`). | Birth moment |
| `d1`..`d144` (23 vargas: 1,2,3,4,5,6,7,8,9,10,11,12,16,20,24,27,30,40,45,60,81,108,144) | `export.py:158` `VARGA_TYPES`, `export.py:888` `_build_placements_json`, `export.py:732` `_get_placements_rows` | Rows for Lagna and Sun..Ketu: longitude, nakshatra, pada, rasi, navamsa (D1 only), karaka meaning, and true-speed motion fields (retro, combust, speed, cheshta, varga reckoning and sandhi). Extra rows: Maandi, Gulika, special lagnas (BL, HL, GL, VL, VNL, SL, PL, IL, Bhrigu Bindu), upagrahas (Dhuma, Vyatipata, Parivesha, Indrachapa, Upaketu, Kaala, Mrityu, Artha, Yama), and V2-V12 (`:826-870`). | `chart_method` per varga (`const.varga_option_dict`, `const.py:673`) |
| `charakaraka` | `export.py:956` `_build_chara_karaka_json` → `house.chara_karakas` | **8-karaka scheme** (Sun..Rahu, Rahu measured from the sign end), from `horoscope/chart/house.py:121-137`. Codes AK..DK. | D1 only |
| `vimsottari_dasa` (legacy) | `export.py:1087` `_build_vimsottari_dasa_json` → `vimsottari.get_vimsottari_periods` | One 120-year cycle, maha → bhukti. | **2 levels** (`DASA_NODE_LEVELS = 2`, `export.py:1054`) |
| `narayana_dasa` (legacy) | `export.py:1158` `_build_narayana_dasa_json` → `narayana.narayana_dhasa_for_rasi_chart` | Sign periods with `sign_index`. | **2 levels**, D1 only |
| `dasha.<system>` (43 systems) + `dasha.applicable` | `src/jhora/dasha_export.py:738` `build_dasha` | See §3. | Levels 1-6 (see §3) |
| `ashtakavarga` | `natal_export.py:221` `_build_ashtakavarga` | BAV (7 planets + lagna), SAV, SAV by house, trikona and ekadhipatya reductions, rasi, graha and sodhya pindas. | D1 only |
| `strength.shadbala` | `natal_export.py:252` `_build_shadbala` → `strength.shad_bala` | Sthana, kaala, dig, cheshta, naisargika and drik in virupas. Total, rupas, the required minimum (copied, `:62`), ratio, rank. | 7 planets |
| `strength.bhava` | `natal_export.py:270` `_build_bhava_bala` → `strength.bhava_bala` | Per house: bhavadhipati, dig, drik, total, rupas, ratio, rank. | 12 houses |
| `strength.vimsopaka` | `natal_export.py:293` | Shad, sapta, dasa and shodasa varga scores out of 20, with the strong vargas. | 9 planets |
| `strength.harsha` | `natal_export.py:311` | Harsha bala, pancha vargeeya bala, dwadasa vargeeya bala. | Natal chart only |
| `aspects` | `natal_export.py:339` `_build_aspects` | Graha drishti and rasi drishti tables. Aspect strength in virupas for D1 only. | Any varga |
| `yogas` | `natal_export.py:365` `_build_yogas` | 93 catalog yogas from `lang/yoga_msgs_en.json` (present yes/no), plus raja yoga pairs, dharma-karmadhipati, vipareeta, neecha bhanga (rules 1-3 of 5) and the AK-PK raja yoga. | Any varga |
| `doshas` | `natal_export.py:417` | Kala sarpa, manglik (from lagna, Moon and Venus, with exceptions), pitru, guru chandala, ganda moola, kalathra, ghata, shrapit. | D1 |
| `arudhas` | `natal_export.py:506` | A1-A12, graha arudhas, Surya and Chandra arudhas, and SL/HL/GK/MD mapped into the varga. | Any varga |
| `argala` | `natal_export.py:543`, `:564` `argala_table` | For each house: argala 2/4/5/11 against virodha 12/10/9/3, planets with subha/papa nature, counts. **No net strength** (`:402`). | Any varga |
| `sphutas` | `natal_export.py:604` | All 14 entries of `const.sphuta_list` (`const.py:575`) through `getattr(sphuta, sid+"_sphuta")`. | D1 |
| `relations` | `natal_export.py:618` | Naisargika, tatkalika and panchadha 9x9 tables. | Any varga |
| `benefic_malefic` | `natal_export.py:649` | Natural and chart-specific (PVR) benefics, functional benefic/malefic/neutral, kendra and trikona lords, yogakaraka, maraka, badhaka, house lords. | D1 |
| `dignities` | `natal_export.py:821` → `dignity_tables:716` | Dignity, moolatrikona sign, sign lord chain, star and star lord, motion, combustion, planetary war, vakra×dignity regime. Node dignity override at `natal_export.py:74`. | Any varga |
| `bhava` | `natal_export.py:855` `_build_bhava` → `charts.bhava_chart` | Cusp start, mid and end for each house, using `bhava_madhya_method` (the Indian house systems in `const.indian_house_systems`). | D1 |
| `house_counts` | `house_counts_export.py:30` | Sign→house, planet house, house-from-house, planet-from-planet, Arudha Lagna counts, house classes. | Any varga |
| `reading_tables` | `reading_tables_export.py:238` | House classes, co-lords, strong dignity, SAV bands, a **Ju/Sa-only** gochara table (`:54`), transit polarity, correspondences. | Any varga |
| `avasthas` | `avasthas_export.py:544` `build_avasthas` | Baladi, jagradadi, deeptadi, lajjitadi, shayanadi; proximity/combustion audit; "lunar astro" (64th navamsa, 22nd drekkana, Bhrigu Bindu, dispositor chains); dasha charter and 9x9 fruition matrix. **Radha's own rules; pyjhora has no avastha functions.** | Any varga |
| `facts` | `facts_export.py:793` `build_facts` | The facts.v1 dossier: panchanga, bodies, houses, vargas (default D1,2,3,4,7,9,10,12,30,60; `:40`), karakas and karakamsa, arudhas, special lagnas (`:93` plus VNL), yogas, doshas, ashtakavarga, Vimshottari (pratyantar window from as_of -1y to +3y) and Narayana (-2y to +15y), nakshatra profile, relations, `meta.unavailable`. **LAHIRI only** (`:876`). | One kundli |
| `transit` | `transit_export.py:350` `run_transit` | Varga positions at one moment, house from the transit lagna, and optional `natal_house` from the natal lagna of the same varga. | One moment, any vargas |
| `transit_range` | `transit_range_export.py` (run at `:466`) | Ingresses, stations, lunations, eclipses, monthly or daily rows, double transit (rasi and graha drishti), sade sati and dhaiya, `gochara_good` (per docstring, `:1-35`). | Up to 14,700 days (month step) or 2 years (day step) |
| `transit_contacts` | `transit_contacts_export.py:189` `find_contacts` | Orb entry, exact hits (with retrograde re-hits), exit, and stations inside the orb, against natal planets and the lagna. | Up to 10 years |
| `transits` | `transits_export.py:158` `build_transits` | Natal overlay: sign stays of 8 bodies with houses from Lagna, Moon and Arudha Lagna; natal SAV and BAV; nakshatra segments for slow planets; double transit; sade sati; stations; lunations. **LAHIRI only** (through `facts_export`). | Up to 5 years |
| `pressure_inventory` | `pressure_inventory_export.py` (run at `:931`) | Dated rows: dasha, transit, sade sati, station, annual (TP year plus its dasha), Saturn and Jupiter returns, with polarity and strength from Radha rules. | ±0-10 years, levels 1-6 |
| `annual.varsha` / `annual.tithi_pravesha` | `annual_export.py:769` `run_annual` | Return instant, year chart in a varga, dignities, houses, aspects, argala, motion, year lord. | One year |
| `annual.tajaka` | `annual_export.py:394` `_tajaka` | Muntha, year lord, 12 month lords, the 6 Tajaka aspect kinds, Tajaka yogas (see §6). | One year |
| `annual.sahams` | `annual_export.py:366` `_sahams` | All 36 sahams of `const._saham_list` (`const.py:962`). | Varsha chart |
| `annual.mudda` / `annual.patyayini` / `annual.tithi_pravesha_dasha` | `annual_export.py:547`, `:575`, `:709` | Annual dashas (see §3). | 2 levels |
| `prashna` | `prashna_export.py:210` `run_prashna` | Chart at the question moment, udaya lagna, panchanga, hora lord, dignities, co-lords, aspects, argala per varga. | `method` = `moment` only (`:33`) |
| `daily_grade` / `muhurta` / `transit_ashtakavarga` | `daily_export.py:659`, `:724` | Day rows (see §9). | ≤732 days (grade), ≤92 days (muhurta) (`:49`) |
| `catalog` | `export.py:317` | Type list. | — |

---

## 3. Dasha systems

### 3.1 How levels are built (verified in code)

- Levels 1 and 2 come from the library's own rows. `build_generic_dasha` (`dasha_export.py:593`) calls the module function twice, once for mahas only and once with antardasha, and matches the bhukti rows to their mahas.
- **Levels 3-6 are derived by the engine, not by pyjhora.** `add_pratyantars` (`dasha_export.py:479`) and `add_deep_levels` (`:547`) split each period among the lords of its own lord's longest mahadasa, in that order and proportion (`_lord_patterns:506`, `_divide:522`). For Vimshottari this matches the classical sookshma/prana/deha rule (`:482-485`). For rasi dashas it is an engine convention, so the classical pratyantar rules for each sign dasha need checking.
- Default `max_level` is **4** (env `DASHA_MAX_LEVEL`, `dasha_export.py:159-161`). Levels 1-3 cover the whole life (`LIFELONG_LEVELS = 3`, `:129`). Levels 4 and up are built only inside the deep window: as_of −90 d to as_of +365 d (`:164-166`, `deep_window:266`).
- Per-system caps (`DEFAULT_SYSTEM_MAX_LEVEL`, `:172`): every rasi dasha, Narayana and Kaala stop at **5**; other graha dashas go to **6**; Kalachakra is **1** (`_LEVEL1_ONLY`, `:108`).
- The memory note "exports go 2 levels deep" is only true for the legacy `vimsottari_dasa` and `narayana_dasa` types (`export.py:1054`), the annual dashas, and the batch endpoint's default fields. Every `dasha.*` type defaults to 4.
- **Params exposed:** only `max_level`, `levels`, `as_of`, `deep_from`, `deep_to` (`DASHA_PARAM_NAMES`, `:190`). The engine calls each library function with `(dob, tob, place)` or `(jd, place)` only (`:600-602`). That means **no varga (`divisional_chart_factor`), no `chara_method`, no `gender`, no tribhagi, no `seed_star`, no `dhasa_starting_planet` and no antardasha option** reach the library. Every system is served with its pyjhora defaults, on D1.

### 3.2 Dasha table

`GRAHA_DASHAS` is at `dasha_export.py:39`, `RAASI_DASHAS` at `:62`, `UNSERVED` at `:111` and `ALIASES` at `:116`. All are served as `dasha.<name>`, from `jhora.horoscope.dhasa.<family>.<module>.<function>`.

| System (classical name) | Wire type | Exported? | Max level (default 4) | Module:function |
|---|---|---|---|---|
| Vimshottari | `dasha.vimsottari` (alias) and legacy `vimsottari_dasa` | Yes | 6 (legacy type: 2) | `export.py:1087` → `graha/vimsottari.py:247 get_vimsottari_periods` |
| Yogini | `dasha.yogini` | Yes | 6 | `graha/yogini.get_dhasa_bhukthi` |
| Ashtottari | `dasha.ashtottari` | Yes (conditional) | 6 | `graha/ashtottari.get_ashtottari_dhasa_bhukthi` |
| Tithi Ashtottari | `dasha.tithi_ashtottari` | Yes | 6 | `graha/tithi_ashtottari.get_ashtottari_dhasa_bhukthi` |
| Tithi Yogini | `dasha.tithi_yogini` | Yes | 6 | `graha/tithi_yogini.get_dhasa_bhukthi` |
| Yoga Vimshottari | `dasha.yoga_vimsottari` | Yes | 6 | `graha/yoga_vimsottari.get_dhasa_bhukthi` |
| Shodasottari | `dasha.shodasottari` | Yes (applicability not checked) | 6 | `graha/shodasottari` |
| Dwadasottari | `dasha.dwadasottari` | Yes (conditional) | 6 | `graha/dwadasottari` |
| Panchottari | `dasha.panchottari` | Yes (conditional) | 6 | `graha/panchottari` |
| Satabdika | `dasha.sataatbika` | Yes (conditional) | 6 | `graha/sataatbika` |
| Chaturaseeti Sama | `dasha.chathuraaseethi_sama` | Yes (conditional) | 6 | `graha/chathuraaseethi_sama` |
| Karana Chaturaseeti Sama | `dasha.karana_chathuraaseethi_sama` | Yes | 6 | `graha/karana_chathuraaseethi_sama` |
| Dwisaptati Sama | `dasha.dwisatpathi` | Yes (conditional) | 6 | `graha/dwisatpathi` |
| Shastihayani | `dasha.shastihayani` | Yes (conditional) | 6 | `graha/shastihayani` |
| Shattrimsa Sama | `dasha.shattrimsa_sama` | Yes (applicability not checked) | 6 | `graha/shattrimsa_sama` |
| Naisargika | `dasha.naisargika` | Yes; L2 is an engine equal split (`_EQUAL_SPLIT`, `:103`) | 6 | `graha/naisargika` |
| Tara | `dasha.tara` | Yes | 6 | `graha/tara` |
| Karaka | `dasha.karaka` | Yes | 6 | `graha/karaka.get_dhasa_antardhasa` |
| Aayu | `dasha.aayu` | Yes | 6 | `graha/aayu.get_dhasa_antardhasa` |
| Buddhi Gathi | `dasha.buddhi_gathi` | Yes | 6 | `graha/buddhi_gathi` |
| Kaala | `dasha.kaala` | Yes | **5** | `graha/kaala.get_dhasa_antardhasa` |
| Saptarishi Nakshatra | `dasha.saptharishi_nakshathra` | Yes (nakshatra lords; not used by `pressure_inventory`, `pressure_inventory_export.py:173`) | 6 | `graha/saptharishi_nakshathra` |
| Narayana | `dasha.narayana` (alias) and legacy `narayana_dasa` | Yes, **D1 only** | 5 (legacy type: 2) | `export.py:1158` → `raasi/narayana.py:137 narayana_dhasa_for_rasi_chart` |
| Chara (Jaimini) | `dasha.chara` | Yes, library default `chara_method=1` (PVN Rao, two cycles) only | 5 | `raasi/chara.py:227 get_dhasa_antardhasa` |
| Sthira | `dasha.sthira` | Yes | 5 | `raasi/sthira` |
| Shoola | `dasha.shoola` | Yes | 5 | `raasi/shoola.shoola_dhasa_bhukthi` |
| Niryana Shoola | `dasha.nirayana` | Yes | 5 | `raasi/nirayana.nirayana_shoola_dhasa_bhukthi` |
| Drig | `dasha.drig` | Yes | 5 | `raasi/drig.drig_dhasa_bhukthi` |
| Sudasa | `dasha.sudasa` | Yes | 5 | `raasi/sudasa.sudasa_dhasa_bhukthi` |
| Moola | `dasha.moola` | Yes; L2 equal split of the sign list (`:633-638`) | 5 | `raasi/moola.moola_dhasa` |
| Kalachakra | `dasha.kalachakra` | Yes, **mahadashas only** (bhukti rows unusable, `:105-108`) | **1** | `raasi/kalachakra.get_dhasa_bhukthi` |
| Lagnamsaka | `dasha.lagnamsaka` | Yes | 5 | `raasi/lagnamsaka` |
| Navamsa | `dasha.navamsa` | Yes | 5 | `raasi/navamsa` |
| Padhanadhamsa | `dasha.padhanadhamsa` | Yes | 5 | `raasi/padhanadhamsa` |
| Kendradhi Rasi | `dasha.kendradhi_rasi` | Yes | 5 | `raasi/kendradhi_rasi.kendradhi_rasi_dhasa` |
| Mandooka | `dasha.mandooka` | Yes | 5 | `raasi/mandooka` |
| Paryaaya | `dasha.paryaaya` | Yes | 5 | `raasi/paryaaya` |
| Sandhya | `dasha.sandhya` | Yes | 5 | `raasi/sandhya` |
| Chakra | `dasha.chakra` | Yes | 5 | `raasi/chakra` |
| Tara Lagna | `dasha.tara_lagna` | Yes | 5 | `raasi/tara_lagna` |
| Trikona | `dasha.trikona` | Yes | 5 | `raasi/trikona` |
| Varnada | `dasha.varnada` | Yes | 5 | `raasi/varnada` |
| Yogardha | `dasha.yogardha` | Yes | 5 | `raasi/yogardha` |
| Brahma | — | **No.** Negative durations (`UNSERVED`, `:111-114`) | — | `raasi/brahma` |
| Mudda (varsha Vimshottari) | `annual.mudda`, also a TP system | Yes | 2 | `annual_export.py:547` → `annual/mudda.varsha_vimsottari_mahadasa/_bhukti` |
| Patyayini | `annual.patyayini`, also a TP system | Yes | 2 | `annual_export.py:575` → `annual/patyayini.patyayini_dhasa` |
| Tithi Pravesha year dasha | `annual.tithi_pravesha_dasha` (`system` = tithi_ashtottari, mudda or patyayini) | Yes, bounded to the TP year | 2 | `annual_export.py:709` `year_dasha` |
| Varsha Narayana | — | **No** | — | `raasi/narayana.py:168 varsha_narayana_dhasa_bhukthi` |
| Sudarshana Chakra dasha | — | **No** | — | `dhasa/sudharsana_chakra.py:42`, `:93` |
| Narayana on a varga (D10, D9 and so on) | — | **No** | — | `raasi/narayana.py:113 narayana_dhasa_for_divisional_chart` |
| Karaka / Lagnamsa / Navamsa | served above | — | — | — |
| Shastihayani / Shattrimsa / Dwisaptati and the rest | served above | — | — | — |

**Count:** 43 `dasha.*` tree systems: 21 graha + 20 rasi (brahma left out) + 2 aliases. Add `dasha.applicable`, 2 legacy types, and 3 annual dasha types.

**`dasha.applicable`** (`dasha_export.py:713`) reports applicability for 9 conditional dashas through `applicability.applicability_check`. Shodasottari and Shattrimsa Sama are reported as "not checked" (`:668-669`, `:722-725`).

---

## 4. Vargas, strengths, ashtakavarga, yogas

- **Vargas:** all 23 factors of `const.division_chart_factors` (`const.py:130`) are served as `d<N>`, with `chart_method` 1..n per `varga_option_dict`. Every default is 1 (`const.py:673-675`). Varga-aware natal types: `arudhas`, `argala`, `dignities`, `aspects`, `relations`, `yogas` (`natal_export.py:52`), plus `house_counts`, `reading_tables` and `avasthas`.
- **Shadbala:** 6 components for 7 planets (`natal_export.py:252`). Ishta and kashta are computed only in `facts` (`facts_export.py:300`). Sun and Moon get null ishta/kashta (docstring, `:19-20`).
- **Bhava bala:** 3 components (`natal_export.py:270`).
- **Ashtakavarga:** BAV, SAV, lagna BAV, trikona and ekadhipatya sodhana, pindas, **D1 only** (`natal_export.py:221`). Kakshya is in `transit_ashtakavarga` (`daily_export.py:704`, lords at `:70`).
- **Yogas:** 93 catalog yogas from `lang/yoga_msgs_en.json` through `yoga.get_yoga_details_for_all_charts`, plus 5 raja yoga rows (`natal_export.py:365-414`). `facts` adds Parivartana, Budha-Aditya, Dhana pairs, Viparita per lord and Neecha Bhanga as `radha.rule` (`facts_export.py:545`), and rechecks 6 Sun/Moon yogas (`ADJACENT_YOGAS`, `:105`, `:592`). **The `yogas` type does not apply that recheck.**
- **Vimsopaka:** 4 schemes (`natal_export.py:293`). The vaiseshikamsa functions (`charts.vaiseshikamsa_*_of_planets`) are not called.

## 5. Jaimini

| Feature | Exported? | Where |
|---|---|---|
| Chara karakas | 8-karaka scheme only, D1 | `export.py:956`, `facts_export.py:489` (also karakamsa from D9) |
| 7-karaka scheme | No; no option exists | `horoscope/chart/house.py:121` (8 bodies hardcoded) |
| Rasi drishti | Yes | `natal_export.py:324` `drishti_tables` |
| Argala / virodhargala | Yes, no net judgement | `natal_export.py:564` |
| Arudhas (bhava, graha, Surya, Chandra), UL | Yes, any varga | `natal_export.py:506`; `facts_export.py:499` (AL=A1, UL=A12) |
| Special lagnas (BL, HL, GL, VL, SL, IL, PL, Bhrigu Bindu, KL, VNL) | Yes (`facts`, and rows in `d*`) | `facts_export.py:93`, `:512`; `export.py:826` |
| Chara, Narayana, Sthira, Shoola, Niryana Shoola, Drig, Sudasa, Navamsa, Mandooka and other rasi dashas | Yes, D1, default methods | §3 |
| Rudra, Maheshwara, Brahma graha, Trishoola rasis | **No** | `house.py:961 rudra`, `:1007 maheshwara`, `:976 trishoola_rasis` |
| Jaimini stronger sign / planet tests | **No** (used inside library dashas only) | `house.py:664 stronger_rasi`, `:504 stronger_planet` |
| Jaimini longevity (three pairs) | **No** | `horoscope/prediction/longevity.py:152 life_span_range` (pyjhora's longevity checks; not the three-pair method itself) |
| Jaimini raja yogas | Only AK-PK (`check_other_raja_yoga_1`) | `natal_export.py:254`; `raja_yoga.py:471`, `:508` (`_2`, `_3`) not served |

## 6. Tajika / annual

`annual_export.py`, types at `:57-64`.

- **Varshaphala:** the return instant is `drik.next_solar_date`, and the chart is `charts.divisional_chart` in any varga (`:8-10`).
- **Muntha** (sign, house from the year lagna and from the natal lagna, lord), **year lord** (`tajaka.lord_of_the_year`), **12 month lords** (`:409-415`).
- **Tajaka aspects:** trinal, sextile, square, semi-sextile, opposition, conjunction (`:430-435`).
- **Tajaka yogas:** Ishkavala, Induvara, Ithasala (three types), Eesarpha, Nakta, Yamaya, Manahoo, Kamboola, Radda, Duhphali Kutta (`:440-472`). `gairi_kamboola` and `khallasara` are **hardcoded `None`** (`:531-532`), but pyjhora has `tajaka_yoga.get_gairi_kamboola_yoga_planet_pairs` and `get_khallasara_yoga_planet_pairs`.
- **Sahams:** 36 (`const.py:962`). Day or night is taken from the **natal birth** time (`annual_export.py:808` `_is_night_birth(birth_jd, …)`), not from the varsha pravesh moment.
- **Varsha dasha:** Mudda and Patyayini, 2 levels. Varsha Narayana is **not** exported (§3).
- **Not exported:** Tajaka monthly chart and sixty-hour chart (`horoscope/transit/tajaka.py` `monthly_chart`, `maasa_pravesh`, `sixty_hour_chart`); Tajaka harsha and pancha-vargeeya bala of the **year chart** (`strength.harsha_bala` is only called on the natal chart, `natal_export.py:315-317`); Tri-pataki chakra (not in pyjhora).
- **Tithi Pravesha:** chart (`annual.tithi_pravesha`, `vratha.tithi_pravesha`) and its year dasha bounded to `[tp_start, tp_end)` (`:709`). `pressure_inventory` uses the weekday lord at the TP instant as the TP year lord (docstring `pressure_inventory_export.py:41-45`).

## 7. Transits

| Feature | Exported? | Where |
|---|---|---|
| Moment chart in any varga, natal house from the same-varga natal lagna | Yes | `transit_export.py:286` `chart_rows` |
| Ingresses, stations, lunations, eclipses, monthly or daily rows | Yes | `transit_range_export.py:206`, `:256`, `:274`; eclipses in `_eclipses` |
| Double transit (Jupiter + Saturn, rasi and graha drishti) | Yes | `transit_range_export.py:353`, `transits_export.py:133` |
| Sade sati / dhaiya (4th and 8th) | Yes | `transit_range_export.py:295`, `transits_export.py:32` |
| Natal-degree contacts with exact hits | Yes | `transit_contacts_export.py:189` |
| Nakshatra transits | Rows carry the nakshatra and pada; slow planets have nakshatra segments | `transits_export.py:96-113` |
| Gochara good/bad from the Moon | **Partial and inconsistent**: `reading_tables` has Jupiter and Saturn only (`reading_tables_export.py:54`); `pressure_inventory` has Sa/Ju/Ra/Ke/Ma with different bad lists (`pressure_inventory_export.py:115`). No Sun, Mercury or Venus table. | — |
| **Vedha** (gochara obstruction) | **No.** Not in the engine and not in vendored pyjhora (grep shows no match) | — |
| Latta | **No** | `charts.py:2223 lattha_stars_planets` (not called) |
| Sarvatobhadra chakra | **No.** Not in pyjhora | — |
| Transit ashtakavarga + kakshya | Yes | `daily_export.py:724` |
| Tara / chandra bala for the day | Yes, with **Radha's own tables** | `daily_export.py:61-65` |
| Varga ingress dates | **No** | `charts.py:2034 next_planet_entry_date_divisional_chart` |

## 8. Prashna

`prashna_export.py`: `method` is `moment` only (`:33`). The lagna is the udaya lagna at the moment. Panchanga is from `panchanga_at` (`:140`) and the hora from `drik.shubha_hora` (`:99`). The KP-249 and 108/nadi prashna lagna helpers exist in pyjhora (`utils.py:1019-1027`, `get_prasna_lagna_KP_249_*`, `get_prasna_lagna_108_*`) but are **not served** (docstring `:4-6`). No prashna-specific techniques (Arudha of the query, Tajika prashna yogas on the prashna chart, Mook prashna) are served.

## 9. Panchang and muhurta

- **Panchang:** `biodata` (`export.py:635`), `facts.panchanga` (`facts_export.py:688`), `prashna_export.panchanga_at` (`:140`), and `daily_grade` rows.
- **Muhurta day windows** (`daily_export.py:591` `_day_windows`): sunrise and sunset, abhijit, rahu kalam, yamagandam, gulikai, durmuhurtam, brahma, godhuli, vijaya day and night, nishita, amrita gadiya, varjyam (an engine re-implementation over the true star span, `_star_windows:496`), 30 muhurtas, horas, yoga and karana spans, gauri choghadiya, panchaka rahitha.
- **Not called** (drik functions with no reference in any export): `amrit_kaalam` (`drik.py:1149`), `thaaraabalam` (`:2937`), `chandrashtama` (`:3016`), `nava_thaara` (`:3022`), `special_thaara` (`:3026`), `pushkara_yoga` (`:3118`), `shiva_vaasa` (`:3076`), `agni_vaasa` (`:3106`), `disha_shool` (`:3163`), `udhaya_lagna_muhurtha` (`:2961`), `vivaha_chakra_palan` (`:2834`), `next_panchaka_days` (`:3004`), `aadal_yoga`, `vidaal_yoga`, `anandhaadhi_yoga`, `triguna`, `tamil_yogam`, `samvatsara`, `ritu`, `sandhya_periods`.
- **No event-specific muhurta search** (for example marriage, travel or griha pravesha) exists in the engine.

## 10. Other areas

- **Upagrahas:** read from `Horoscope` info strings by substring key match into the `d*` rows (`export.py:826-856`). `charts.solar_upagraha_longitudes` (`charts.py:1863`) and `drik.upagraha_longitude` (`drik.py:1635`) are not called directly. `arudhas` maps only SL, HL, GK and MD into vargas (`natal_export.py:461`).
- **Aspects / drishti:** graha and rasi drishti in any varga, and virupa aspect strength for D1 only (`natal_export.py:339`).
- **Functional benefics:** `benefic_malefic` (`natal_export.py:649`). It notes that pyjhora does not group kendra lords.
- **Avasthas:** `avasthas` (§2). Janma ghatis are computed from sunrise at `avasthas_export.py:641-652`.
- **Motion / vakra:** `motion_export.compute_planet_motion` (`motion_export.py:381`), graha yuddha (`:593`), varga sandhi (`:678`). Thresholds come from the environment (`:260`).
- **KP sub-lords:** **No** (`charts.py:1964 get_KP_lords_from_planet_positions`, `drik.py:1426 bhaava_madhya_kp`).
- **Marriage matching (Ashtakoota / porutham):** **No** (`horoscope/match/compatibility.py:180 class Ashtakoota`, `:595 class Match`).
- **Naadi marriage yogas:** **No** (`horoscope/prediction/naadi_marriage.py:78`).
- **Pancha pakshi:** **No** (`panchanga/pancha_paksha.py:80`).
- **Mrityu bhaga, marana karaka sthana, pachakadi sambandha:** **No** (`charts.py:1993`, `:2020`; `get_pachakadi_sambhandha`).
- **Pushkara navamsa / bhaga, gandanta:** Yes, in `facts` only (`facts_export.py:806`, `_is_gandanta:199`).

---

## 11. pyjhora supports but the engine does not export

Module paths are under `src/jhora/` @ b902bea.

| Capability | pyjhora module:function | Relevance to research |
|---|---|---|
| Sudarshana Chakra chart + dasha + pratyantar | `horoscope/dhasa/sudharsana_chakra.py:24`, `:42`, `:93` | Classical triple-reference annual timing |
| Varsha Narayana dasha | `horoscope/dhasa/raasi/narayana.py:168` | Jaimini annual dasha |
| Narayana dasha on a varga (D10 career, D9 marriage and so on) | `horoscope/dhasa/raasi/narayana.py:113` | Varga-specific Narayana |
| Any graha/rasi dasha on a varga or with options (chara_method 1-4 including KN Rao, tribhagi, seed star, starting planet, antardasha option) | e.g. `raasi/chara.py:227` (`chara_method`, `gender`), `graha/vimsottari.py:175` (`use_tribhagi_variation`, `seed_star`, `dhasa_starting_planet`, `antardhasa_option`, `divisional_chart_factor`), `graha/yogini.py:103` | School variants |
| Brahma dasha | `horoscope/dhasa/raasi/brahma.py` (left out: negative durations) | Jaimini longevity dasha |
| Kalachakra antardashas | `raasi/kalachakra.py` (rows unusable, `dasha_export.py:105-108`) | — |
| Tajaka monthly / sixty-hour charts | `horoscope/transit/tajaka.py` `monthly_chart`, `maasa_pravesh`, `sixty_hour_chart` | Masa phala |
| Gairi Kamboola, Khallasara yogas | `horoscope/transit/tajaka_yoga.py` `get_gairi_kamboola_yoga_planet_pairs`, `get_khallasara_yoga_planet_pairs` | Tajaka yoga set is incomplete |
| Rudra, Maheshwara, Trishoola rasis | `horoscope/chart/house.py:961`, `:1007`, `:976` | Jaimini longevity and Shoola dasha reading |
| Stronger rasi / planet (Jaimini) | `horoscope/chart/house.py:664`, `:504` | Dasha seed explanation |
| Longevity range | `horoscope/prediction/longevity.py:152` | Ayur |
| Other raja yogas 2, 3 | `horoscope/chart/raja_yoga.py:471`, `:508` | — |
| KP lords / KP cusps | `horoscope/chart/charts.py:1964`; `panchanga/drik.py:1426` | KP |
| Prashna KP-249 / 108 lagna | `utils.py:1019-1027` | Prashna number methods |
| Latta stars | `horoscope/chart/charts.py:2223` | Transit affliction |
| Mrityu bhaga, marana karaka sthana | `horoscope/chart/charts.py:1993`, `:2020` | Planet affliction |
| Varga ingress / conjunction dates | `charts.py:2034`; `next_conjunction_of_planet_pair_divisional_chart` | Varga transits |
| Mixed (varga-of-varga) charts | `charts.py:1059 mixed_chart` | D9-of-D10 and similar |
| Vaiseshikamsa counts | `charts.vaiseshikamsa_{shad,saptha,dhasa,shodhasa}varga_of_planets` | Varga dignity strength |
| Tarabala / chandrashtama / nava tara / special tara | `panchanga/drik.py:2937`, `:3016`, `:3022`, `:3026` | Muhurta (the engine uses its own tara table instead) |
| Amrit kaalam, pushkara yoga, shiva/agni vaasa, disha shool, udaya lagna muhurta, vivaha chakra | `panchanga/drik.py:1149`, `:3118`, `:3076`, `:3106`, `:3163`, `:2961`, `:2834` | Muhurta |
| Ashtakoota / porutham matching | `horoscope/match/compatibility.py:180`, `:595` | Love board |
| Naadi marriage yogas | `horoscope/prediction/naadi_marriage.py:78` | Love board |
| Pancha pakshi | `panchanga/pancha_paksha.py:80` | Daily timing |
| Vratha / festival dates | `panchanga/vratha.py` (`tithi_dates`, `sankranti_dates`, …) | Lucky times |
| Moonrise / moonset, lunar month, samvatsara, ritu | `panchanga/drik.py` | Panchang completeness |

---

## 12. Engine issues spotted

Each item gives the file and line @ b902bea, then a suggested engine addition.

1. **Dasha options never reach the library.** `dasha_export.py:600-602` calls every module with `(dob, tob, place)` or `(jd, place)` only, and `DASHA_PARAM_NAMES` (`:190`) has no varga, `chara_method`, gender, tribhagi or seed option. Chara is PVN Rao only, and every system is D1 only.
   *Add:* `varga` and a per-system `options` param, validated against each function's signature.
2. **Levels 3-6 are an engine-derived proportional split** (`dasha_export.py:479`, `:547`). It is exact for Vimshottari but unverified for rasi dashas, where classical pratyantar rules differ by system.
   *Add:* per-system tests against JHora reference charts, or library-native level 3 where pyjhora has it.
3. **Legacy 2-level types are still the batch default.** `api.py:214-225` lists `vimsottari_dasa` and `narayana_dasa`, which are capped by `export.py:1054` (`DASA_NODE_LEVELS = 2`).
   *Add:* point the batch at `dasha.vimsottari` and `dasha.narayana`, or mark the legacy types deprecated.
4. **The batch endpoint breaks `bhava`.** `api.py:659-660` calls `builder_fn(natal_obj)` for every natal type, but `_build_bhava(n, method)` (`natal_export.py:855`) needs `method`. The field returns `{"error": …}`. Varga-param natal types in the batch also always use D1 and method 1.
   *Add:* route the batch through `run_natal` with resolved params.
5. **The ayanamsa can be mixed inside one response.** `api.py:97` accepts any ayanamsa. Only `facts`, `transits` (through facts) and `pressure_inventory` enforce LAHIRI (`facts_export.py:876`, `pressure_inventory_export.py:948`). `strength.bhava_bala`, `harsha_bala`, `pancha_vargeeya_bala` and `dwadhasa_vargeeya_bala` take no ayanamsa (`natal_export.py:274-276`, `:315-317`; signatures at `horoscope/chart/strength.py:132`, `:361`, `:402`, `:908`). `vimsottari.get_vimsottari_periods` is called without one (`export.py:1097`).
   *Add:* reject non-LAHIRI everywhere, or thread `ayanamsa_mode` through every call.
6. **Saham day/night uses the natal birth, not the varsha moment.** `annual_export.py:808` calls `_is_night_birth(birth_jd, …)`, while classical Tajaka sahams switch on the annual chart's day or night.
   *Add:* pass `ret_jd`.
7. **Two Tajaka yogas are hardcoded `None`** (`annual_export.py:531-532`) although the library functions exist.
   *Add:* call `get_gairi_kamboola_yoga_planet_pairs` and `get_khallasara_yoga_planet_pairs`.
8. **Two gochara tables disagree.** `reading_tables_export.py:54` has Jupiter bad in 1,3,4,6,8,10,12 and Saturn bad in 1,2,8,12. `pressure_inventory_export.py:115` has Jupiter press in 6,8,12 only, Saturn press in all non-3/6/11 houses, plus Ra/Ke/Ma. Neither has vedha, and neither covers Sun, Mercury or Venus.
   *Add:* one gochara table per Phaladeepika ch. 26 with vedha pairs, used by every type.
9. **Tara names disagree between types.** `facts_export.py:66` uses Pratyari, Sadhaka, Vadha, Ati-mitra; `daily_export.py:61` uses Pratyak, Sadhana, Naidhana, Parama Mitra.
   *Add:* one shared constant.
10. **The `yogas` type reports false Sun/Moon yogas for empty houses.** The recheck exists only in `facts_export.py:105`, `:592`; `natal_export.py:365` serves pyjhora's raw flags.
    *Add:* move the `ADJACENT_YOGAS` recheck into `_build_yogas`.
11. **Placement rows can carry fabricated positions.** When a body or extra key is not found, the sign is set to Aries 0° (`export.py:810`, `:845`, `:867`), and the nakshatra, pada and rasi are computed from that value. Extra bodies match by substring (`:838`, for example `"yama"`, `"kaala"`, `"artha"`), which can pick the wrong key.
    *Add:* null rows for missing bodies, and exact key mapping or direct `drik.upagraha_longitude` and `charts.solar_upagraha_longitudes`.
12. **Swallowed exceptions return empty data that looks valid.** `export.py:1112-1114` and `:1196-1198` return `periods: []` on any error with only a warning, and `_build_chara_karaka_json` returns `[]` (`:975-977`). `natal_export.py:490` turns special-point failures into notes. `facts` catches these (`facts_export.py:624-629`), but `run_export_by_type` returns success.
    *Add:* raise, so the API answers with a 500.
13. **Stale docstrings.**
    - `reading_tables_export.py:39` says the Rahu dignity conflict is open, but `natal_export.py:74-86` already swaps it.
    - `natal_export.py:12-13` says there is no `avasthas` type.
    - The `facts`, `transits` and `transit_range` docstrings name older calc_versions than `CALC_VERSIONS` (`export.py:176`, `:204-205`).
    *Fix in the engine docs.*
14. **Kalachakra is mahadashas only and Brahma is left out** (`dasha_export.py:108`, `:111`). Both are Jaimini/Parashari timing tools the research names.
    *Add:* library fixes, then serve them.
15. **Bhava bala is incomplete classically.** Only 3 components are served (`natal_export.py:270-290`); there is no bhava drishti bala. `strength.bhava_drishti_bala` exists unreferenced.
    *Add:* serve it, or document the omission.
16. **Dashas are D1 only** throughout `facts`, `pressure_inventory` and `dasha.*`. There is no Narayana on D10 or D9, which Jaimini career and marriage readings use.
    *Add:* see item 1.
17. **Annual gaps.** There is no Varsha Narayana, no Sudarshana Chakra, no Tajaka monthly chart, and no harsha or pancha-vargeeya bala of the year chart (only natal, `natal_export.py:315-317`).
    *Add:* types `annual.varsha_narayana`, `annual.sudarshana`, `annual.maasa`.
18. **Prashna is moment-only** (`prashna_export.py:33`). The KP-249 and 108 lagna helpers exist (`utils.py:1019-1027`).
    *Add:* `method` = `kp249` or `nadi108` when wanted.
19. **Muhurta uses the engine's own tara and chandra bala tables** (`daily_export.py:61-65`, docstring "rules pyjhora does not hold") although `drik.thaaraabalam` and `drik.chandrabalam` exist. Chandra bala adds the 11th house by assumption (docstring).
    *Add:* reconcile the tables with the library and the sources.

Not touched: `docs/TODOS.md`. This task was limited to one file, so the issues above are not yet filed there.
