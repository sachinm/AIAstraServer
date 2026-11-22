# 02 — The specified database of techniques: stored contracts, the kundli digest, and what is actually in the catalogue

Read-only inventory, 2026-11-18, taken from the shared checkout on branch `feat/self-foundation-server` at `280ac27`
(other sessions switch branches in this checkout, so line numbers hold for that commit only). Purpose: describe what the
server stores and declares about astrological techniques, so it can be set beside the classical-text research in
`docs/deep-research/`. Every claim cites a file and line. The live `technique_registry` table was **not** queried; what
it holds is inferred from the code that seeds it (§3.3).

Short answer:

- **142 catalogue rows, all `status: 'built'`, none `planned` or `partial`** (dumped from `TECHNIQUES`,
  `src/techniques/catalog.ts:2433`). By board: you 55, love 25, work 23, chat 18, lucky 17, timeline 4. 120 are code
  paths (`contract.system = 'none'`) and 22 run under a model prompt.
- **The "database" is three layers:** engine rows (`kundli_data`), a deterministic per-kundli digest (`kundli_digest` +
  `kundli_activation`, plus text `kundli_slices`), and technique declarations (`technique_registry`, seeded from code)
  whose results are cached per validity window (`technique_outputs`).
- **The digest has six sections** (`house`, `planet`, `yoga`, `point`, `annual`, `star`;
  `src/reading/digest/types.ts:10`), version `d1.2026-11-09` (`types.ts:8`). The activation calendar is a separate
  table with seven dasha families (`src/reading/digest/activation.ts:17`).
- **"Built" is a label set in code, not a measured fact.** It means a code file is named. The admin's
  `enabled` / `verification_status` columns are never set by the seed, so every row reads `verified`
  (§3.3, discrepancy D9).

---

## 1. Tables and columns

The Prisma model is the source for columns; the migration that created or changed each one is named.

### 1.1 Engine store and per-kundli state

| Table | Column | Type | Purpose | Where |
|---|---|---|---|---|
| `kundli_data` | `kundli_id`, `data_type`, `variant`, `params`, `ayanamsa` | text, text, text (`''` natal, `year=2027` …), jsonb, text (`LAHIRI`) | One row per kundli × engine type × variant: the vertical store every digest reads | `prisma/schema.prisma:270-294` |
| | `calc_version`, `engine_commit`, `payload`, `payload_hash` | text, text, jsonb, text | The engine answer and its provenance | `schema.prisma:277-281` |
| | `status` | text: ready, fetching, failed, unsupported, dispatched, queued, deferred_disk | The row doubles as the fetch lock; M54 widened the check | `schema.prisma:282-283`; `prisma/migrations/20261118100000_kundli_data_slot_statuses_m54/migration.sql` |
| | `fetch_started_at`, `fetched_at`, `valid_to` | timestamptz | Lock reclaim and expiry | `schema.prisma:285-287` |
| `kundlis` | `digest_status` (default `pending`), `digest_version`, `digest_built_at`, `digest_error` | text, text, timestamptz, text | Digest state per kundli: pending → building → ready, or stale / failed | `schema.prisma:122-125`, index `:141`; `20261106040000_digest_m32/migration.sql` |
| `kundli_facts` | `dossier`, `natal_points`, `facts_version`, `dossier_hash`, `source_hash` | jsonb, jsonb, int, text, text | The older one-time D1 dossier from the engine's `facts` export; the digest falls back to it (`FACTS_ITEM`, `src/reading/digest/types.ts:215`) | `schema.prisma:229-245` |

### 1.2 The digest

| Table | Column | Type | Purpose | Where |
|---|---|---|---|---|
| `kundli_digest` | `kundli_id`, `section`, `key` | text; section is house, planet, yoga, point, annual or star; key looks like `D9.h7`, `D1.Ve`, `D1.<yoga id>`, `D1.AK`, `TP2027.D1`, `profile` | One digest row per kundli × section × key; unique on `(kundli_id, section, key)` | `schema.prisma:298-313`; `20261106040000_digest_m32/migration.sql`; key forms `src/reading/digest/types.ts:206` |
| | `row` | jsonb (`HouseCard`, `PlanetCard`, `YogaRow`, `PointRow`, `AnnualRow` or `StarProfile`) | The selected engine values | `types.ts:23-185` |
| | `source` | jsonb `[{type, variant, calcVersion, path}]` | Provenance of every value | `types.ts:16-21` |
| | `digest_version`, `built_at` | text, timestamptz | Which rule set built it | `schema.prisma:306-307` |
| `kundli_activation` | `system`, `family`, `level`, `lord`, `sign`, `from_date`, `to_date`, `houses`, `parent_lord`, `digest_version` | text, text, int, text, text, date, date, int[], text, text | One row per dasha period of every stored system, from birth to 30 years ahead, with the D1 houses it activates | `schema.prisma:317-336`; `20261106050000_activation_m33/migration.sql`; level index added by `20261109120100_dasha_levels_m46/migration.sql:7` |
| `kundli_slices` | `slice_id`, `text`, `keys`, `est_tokens`, `sources`, `hash`, `built_at` | text, text (sealed), jsonb (sealed), int, jsonb, text, timestamptz | Engine rows rendered once into fixed text blocks (`natal.core`, `sky.window`, `year.tp`, `frame`, `clock.<system>`, `matter.<key>`) for the card readers | `schema.prisma:1607-1623`; `20261110100000_kundli_slices_m48/migration.sql` |
| `research_digests` | `section`, `item_key`, `varga`, `house_num`, `planet`, `section_data`, `sources`, `calc_version` | varchar, varchar, varchar, smallint, varchar, jsonb, jsonb, varchar | Staging copy of `kundli_digest` for synthetic research kundlis | `schema.prisma:1476-1494` (M38 admin) |
| `research_activation` | (copy of `kundli_activation` for research kundlis) | | | `schema.prisma:1497` |

### 1.3 Shared sky and day tables (no person in them)

| Table | Column | Type | Purpose | Where |
|---|---|---|---|---|
| `day_tables` | `place_key`, `place_name`, `lat`, `lon`, `tz_name`, `date`, `utc_offset_hours`, `ayanamsa`, `calc_version`, `engine_commit`, `source_hash`, `payload` | text …, date, jsonb | One engine `muhurta` day per place and date: the five limbs, horas, avoid bands | `schema.prisma:417-436`; `20261105120000_day_tables/migration.sql` |
| `kundli_day_overlays` | `kundli_id`, `place_key`, `month`, `payload` | text, text, date, jsonb | The person's tara, chandra bala, grade and Moon house per day for a month | `schema.prisma:439-452`; same migration |
| `kundli_transit_overlays` | `kind`, `params_key`, `from_date`, `to_date`, `payload` | text, text, date, date, jsonb | The engine's houses for a kundli over the shared sky; never derived in Node | `schema.prisma:399-414` |

### 1.4 Technique declarations, outputs and governance

| Table | Column | Type | Purpose | Where |
|---|---|---|---|---|
| `technique_registry` | `id`, `title`, `category`, `board`, `status` | text; category checked to self, love, work or general; status checked to built, partial or planned | One row per catalogue entry, upserted from code | `schema.prisma:1126-1153`; `20261106010000_techniques_m29/migration.sql` |
| | `charts`, `algorithm`, `special`, `source`, `code_ref`, `agents`, `accuracy` | jsonb, jsonb, text, text, text, jsonb, text | What it reads (declared), plain steps, its source, the code that runs it | same |
| | `selectors`, `contract` | jsonb | When the clarify context picks it, and what it reads, in which layout, under which prompt, with which output | `20261106030000_techniques_m31/migration.sql` |
| | `enabled`, `verification_status` | bool (default true), varchar(24) (default `verified`) | Governance switch: verified, calibrating, experimental or disabled | `20261106080000_admin_m36_technique_governance_and_benchmarks/migration.sql:3-5` |
| `reading_traces` | `techniques` | jsonb | The technique ids a question selected | `schema.prisma:734`; M31 |
| `agent_runs` | `technique_id`, `category`, `board`, `kundli_id`, `subject`, `charts_used` | text …, jsonb | Each run tagged with its technique | M29 migration |
| `reading_agent_spans` | `agent_id`, `technique_id`, `category` | text | Same, per span | M29 migration |
| `technique_outputs` | `cache_key` (PK), `technique_id`, `kundli_id`, `digest_version`, `freshness` (natal, annual, dasha, daily or transit), `valid_from`, `valid_to`, `output`, `output_schema`, `made_by_agent`, `made_ms`, `hit_count`, `last_hit_at` | text …, timestamptz, jsonb | A technique's result stored for its validity window `[valid_from, valid_to)` | `schema.prisma:1357-1381`; `20261106090000_technique_outputs_m37/migration.sql`; indexes in M38 and `20261112190100_board_read_indexes_m51/migration.sql:5` |
| `technique_decision_logs` | `area`, `as_of`, `technique_id`, `subarea`, `shade_tag`, `winning_score`, `runner_up_*`, `gates`, `playbook_tier`, `ease_date`, `tie_broken_by_fact` | | Per-window shade choice and gate receipt | `schema.prisma:1156-1177`; M36 |
| `benchmark_charts`, `benchmark_events` | chart birth data; event date, area, expected subarea, shade and side, last result | | Regression set for techniques. M36 inserts 10 charts labelled "AA Benchmark 01 … 10" (no person names) and their events | M36 `migration.sql` INSERTs |
| `technique_reviews` | `run_kind`, `run_id`, `technique_id`, `verdict` (right, wrong or unsure), `note`, `admin_id` | | Staff verdicts on a run | `schema.prisma:1217-1234`; M29 |
| `reading_findings_cache` | `reader_id`, `pack_hash`, `horizon_key`, `prompt_version`, `payload`, `expires_at` | | Validated reader findings across Lambdas | `schema.prisma:1269-1287` |
| `reading_dossiers` | `board`, `digest_version`, `techniques`, `rules`, `data`, `yogas`, `clocks`, `panels`, `gaps`, `audit`, `oracle` | | Audit record of every row a board build read | `schema.prisma:1327-1353` (M40) |

**Seeded SQL.** No migration inserts technique rows. The only technique-area seed rows in SQL are the 10 benchmark
charts and their events (M36). `technique_registry` is filled from code: at server boot
(`server.ts:466`, `Promise.allSettled([seedAgentRegistry(prisma), seedTechniqueRegistry(prisma)])`) and by
`scripts/write-techniques-doc.ts:193` whenever `DATABASE_URL` is set.

---

## 2. The kundli digest

### 2.1 How it is built

- The builder is `buildDigestRows` (`src/reading/digest/build.ts:1294-1332`), a pure function. It reads only
  `kundli_data` rows with status `ready`, ayanamsa LAHIRI and a variant other than `current`
  (`build.ts:1386`), plus the dossier under the `facts` key.
- It needs these natal types (`DIGEST_NATAL_TYPES`, `build.ts:1337-1348`): `dignities`, `aspects`, `argala.d1`,
  `arudhas`, `house_counts`, `ashtakavarga`, `avasthas`, `strength.shadbala`, `benefic_malefic`, `yogas`, `doshas`,
  `karaka.chara`, `sphutas`, `panchanga.birth`, `relations`, `dasha.applicable`. Per varga it adds
  `varga.dN`, `dignities.dN` and `house_counts.dN` for all 23 factors (`src/reading/chartData/catalog.ts:57`). It adds
  `aspects.dN`, `argala.dN` and `arudhas.dN` for 12 vargas (`catalog.ts:60`), and `avasthas.dN` for D9, D10, D16 and
  D24 (`catalog.ts:69`).
- **Three levels of varga coverage** (`vargaCoverage`, `build.ts:1271`):
  - *full* means the varga has its own `dignities` table, giving house and planet cards.
  - *dossier* means the varga appears only in `facts.vargas`, giving thinner cards with no aspects, argala, SAV or cusp
    star (`build.ts:806`).
  - *placementOnly* gives planet placements only.
- **Annual years are pulled separately** (`src/reading/digest/annualSet.ts:10-15`):
  - Years: ten back to ten ahead (`ANNUAL_SPAN_YEARS = 10`).
  - Year charts: `annual.tithi_pravesha` and `annual.varsha` in D1, D9 and D10.
  - Year tables: `annual.tithi_pravesha_dasha`, `annual.mudda`, `annual.patyayini` and `annual.sahams`.
  - At most 40 engine calls per run (`annualSet.ts:17-20`).
  - **`annual.tajaka` is not in the set** (see D4).

### 2.2 Sections, their rows and the engine fields they come from

| Section | Key | Row fields (`types.ts`) | Engine source: type and JSON path, as cited in `src.of(...)` | Builder |
|---|---|---|---|---|
| `house` | `D<n>.h<1..12>` | sign, lord, lordHouse, lordSign, lordDignity, coLord, occupants (dignity, nature), aspectedGraha, aspectedRasi, argala (primary, secondary, obstructed), sav, class[], cuspStar, arudha (`types.ts:23-45`) | `dignities[.dN].houses[i]` (`build.ts:195`); `facts.houses.<h>.co_lord` (`:204`); `aspects.graha_drishti[].aspected_houses` and `rasi_drishti[]` (`:218-219`); `argala.houses[j].argalas` or `facts.houses.<h>.argala` (`:227,237`); `ashtakavarga.sav_by_house` (`:245`); `house_counts.house_class.<h>` / `houses[i].classification` (`:256-265`); `benefic_malefic.badhaka.badhaka_house` adds the `badhaka` class (`:267-270`); `facts.houses.<h>.cusp_nak` (`:277`); `arudhas.bhava_arudhas[j].sign` (`:286`) | `houseCards`, `build.ts:179`; dossier fallbacks `:655`, `:779` |
| `planet` | `D<n>.<Su…Ke>` | sign, house, degree, star, pada, starLord, dignity, retro, combust, war, dispositor, dispositorHouse, chain, avasthas, avasthaMultipliers, shadbalaRatio/Rank/Rupa, natural, functional, owns, aspectsTo, aspectedBy, conjunctions; D1 only: dashaCharter, sunProximity, starChain (`types.ts:89-124`) | `dignities[.dN].planets[i]` (`:404`); `aspects.graha_drishti[]` (`:409-411`); `avasthas.planets[]` (`:366`); `avasthas.lunar_astro.dispositor_chains.rasi` / `.nakshatra` (`:373,419`); `avasthas.proximity_audit.solar_proximity` (`:430`); `avasthas.dasha_charter.mahadasha_charters` and `antardasha_fruition_matrix` (`:439,461`); `strength.shadbala.planets[]` (`:491`); `benefic_malefic.planets[].functional_roles`, `.houses_owned`, `natural.benefics/malefics` (`:508-519`); `facts.bodies.<p>.nature/.owns` (`:501,523`) | `planetCards`, `build.ts:379`; `placementCards` `:590` |
| `yoga` | `D1.<yoga id>` | id, name, planets, houses, class (raja, dhana, mahapurusha, dosha, named …), source, dosha details (`types.ts:133-142`) | `yogas.yogas[i]` (`:908`) with class from `facts.yogas[].class` (`:909`); per varga `yogas.dN` / `yogas@varga=N` (`:914-921`); `doshas.doshas[i]` (`:929`); dossier fallbacks `facts.yogas[]`, `facts.doshas[]` (`:935,941`) | `yogaRows`, `build.ts:879` |
| `point` | `D1.AK…DK`, `A1…A12`, special points, `UL`, `AL`, sphutas, badhaka, Lunar-Astro points | id, varga, sign, house, lord, lordHouse, planet (karakas) (`types.ts:144-153`) | `karaka.chara[i]` or `facts.karakas.chara` (`:970,975`); `arudhas.bhava_arudhas[i]`, `special_points[i]` (`:994,1005,1023`); `benefic_malefic.badhaka` (`:1036`); `facts.special_lagnas.<id>` (`:1046`); `sphutas[i]` (`:1055`); `avasthas.lunar_astro.khara_navamsa_64.from_moon/from_lagna`, `khara_drekkana_22`, `bhrigu_bindu` (`:1069-1099`) | `pointRows`, `build.ts:957` |
| `annual` | `TP<year>.D<n>`, `VP<year>.D<n>` | kind, year, varga, lagna, houses (HouseCard[]), dashas (system → periods), sahams, start/end (`tp_start` or `valid_from`); muntha, yearLord and tajakaYogas only when `annual.tajaka@year` is stored (`types.ts:155-175`) | `annual.tithi_pravesha@year[;divisional_chart_factor=N]`, `annual.varsha@…` (`build.ts:1116-1131`); year dashas `…periods` (`:1145`); `annual.tajaka@year=Y` `.muntha`, `.year_lord`, `.yoga_list` (`:1178-1193`) | `annualRows`, `build.ts:1116` |
| `star` | `profile` | moonStar, moonStarLord, lagnaStar, taras (27), gandanta[], pendingKarmaHouses (`types.ts:177-185`) | `facts.nakshatra_profile.janma`, `.lagna`, `.taras_from_janma`, `.gandanta` (`build.ts:1233-1245`); `avasthas.lunar_astro.pending_karma.pending_karma_houses` (`:1257`) | `starProfile`, `build.ts:1218` |

### 2.3 Activation calendar (`kundli_activation`)

- Every period of every stored dasha tree, from birth to `ACTIVATION_YEARS_AHEAD = 30` years out
  (`activation.ts:39`).
- Levels 1–3 are kept for life (`LIFELONG_MAX_LEVEL = 3`, `activation.ts:22`). Levels 4–6 are stored only inside the
  deep window that `src/workers/dashaDeep.ts` pulls for a kundli in focus (`activation.ts:3-5`).
- Houses come from the engine:
  - A graha period gets the lord's D1 house, the houses it owns and the houses its graha drishti falls on.
  - A rasi period gets the sign's D1 house and the house of the sign's lord (`activation.ts:6-10`).
- Families (`activation.ts:17`, `FAMILY_BY_SYSTEM` `:42-50`) are vimshottari, conditional, yogini, tithi_ashtottari,
  rasi, karaka and other. A conditional system counts only when the engine's `dasha.applicable` says
  `applies: true` (`activation.ts:66-79`).

### 2.4 Who reads which section (`src/reading/oracle/digestSlices.ts`)

`SUBAGENT_DIGEST_SPECS` (`digestSlices.ts:73-560`, exported `:564`) maps each sub-agent to the digest sections and
vargas it is sliced:

| Sub-agent(s) | Sections | Vargas | Activation | Stored in | Lines |
|---|---|---|---|---|---|
| R01–R14, P1–P3 (Oracle readers) | house and planet always, plus yoga, point, star or annual per reader | mostly D1. R03: D1, D9, D10, D30. R08: D1, D9, D10. R11 annual: D1, D9, D10. R13: D1, D3, D7, D9, D12 | R01, R04, R07–R10, R13, P1–P3 | `reading_findings_cache` | `:74-240` |
| `specialist:*` (promise, dasha, transit, nakshatra, annual, prashna) | house and planet, plus yoga, point, star or annual | D1, D9, D10 at most | dasha, transit, nakshatra | `reading_findings_cache` | `:241-294` |
| `code:varga_dynamics` → `general.varga_dynamics` | house, planet | D1, D2, D4, D7, D9, D10, D12, D24, D30, D60 | no | `technique_outputs` | `:349` |
| `code:varga` → `general.varga_dynamics` | house, planet | D1, D9, D10, D16, D20, D27, D40, D45, D60 | no | `technique_outputs` | `:399` |
| `code:strength_yoga`, `code:avastha` → `general.strength_yoga` | house, planet, yoga | D1 | no | `technique_outputs` | `:359,379` |
| `code:jaimini`, `code:nakshatra`, `code:annual`, `code:person` | point, star, annual or point | D1, D9; D1; D1, D9, D10; D1, D3, D7, D9, D12 | jaimini and nakshatra | `technique_outputs` | `:369,389,409,419` |
| `family.rasi/varga/dasha/year/sky`, `lineman.*`, `oracle.self/love/work` | up to all six | `family.varga`: D1–D60 (16 vargas); oracle.love adds D7; oracle.work adds D2 | dasha | findings cache or `technique_outputs` | `:429-540` |
| `self.oracle` (v2) | all six | 16 vargas, D1–D60 | yes | `technique_outputs` | `:542` |

**No sub-agent is sliced D81, D108 or D144.** Only the catalogue row `general.varga_dynamics` declares them
(`catalog.ts:881`, `:892`); see D7.

### 2.5 Layouts (how a section is shaped for a technique)

`src/techniques/layouts.ts:13-84` names 14 layouts: `house_card`, `planet_card`, `yoga_row`, `point_row`,
`star_profile`, `annual_row`, `activation_row`, `transit_row`, `panchang_day`, `prashna_card`, `findings_in`,
`person_pack`, `text_in`. Each is a column list only. The contract types are in `src/techniques/contracts.ts`:

- `TechniqueSelectors` (`:18-35`). Note that `houses` and `vargas` are descriptive and are **not** matched (`:17`).
- `ContractSection` (`:41`).
- `ContractInput` and `TechniqueContract` (`:43-60`).
- Matching is all-of: `selectTechniques` (`:106`) keeps a row only if every declared selector matches.

### 2.6 Output store (`technique_outputs`)

`src/techniques/outputStore.ts` stores a technique's result for the window in which its inputs cannot change.

- **Freshness** follows the shortest-lived section read (doc 56 §4.1):
  - natal for house, planet, yoga, point and star;
  - annual for annual;
  - dasha for activation;
  - daily for panchang;
  - transit for transit, in 2-hour buckets by default (`TECHNIQUE_TRANSIT_WINDOW_HOURS`, `src/config/env.ts:734-737`).
- **Rows that sweeps keep:** natal rows and rows with `valid_to IS NULL` are never swept, and neither are unexpired
  model rows (`outputStore.ts:548-558`).
- **What actually gets written:** the code that writes is `withTechniqueOutput`. The `technique_id` values seen in
  code are `general.annual`, `general.jaimini`, `general.nakshatra`, `general.person`, `general.strength_yoga`,
  `general.varga_dynamics`, `self/love/work.reading.oracle`, `self.v2.oracle`, `self.v2.personalizer`,
  `research.technical_verifier` and `work.present_tone`. These come from `techniqueId:` literals across `src/`.
- **Not written:** most of the other 142 catalogue ids never appear as a stored `technique_id`. Doc 56's key
  includes them, but TODOs say self sub-technique outputs are not yet written (`docs/TODOS.md:1840`).

---

## 3. Technique catalogue

### 3.1 Counts

Counts come from loading `TECHNIQUES` with `tsx` at `280ac27`:

- **Total:** 142 rows, 142 built, 0 partial, 0 planned.
- **By category:** self 62, work 30, love 28, general 22.
- **By board:** you 55, love 25, work 23, chat 18, lucky 17, timeline 4.
- **By kind:** 120 code, 22 model prompt.
- **Code-path check:** a script checked every `src/...ts` path named in each row's `code` field; all exist. This
  checks that the files exist, not that the named functions run.
- **How a row's status is set:**
  - It is written in code. The house-state layers set `status: fns ? 'built' : 'planned'` (`catalog.ts:587`), and the
    Love and Self configs list every layer as built (`catalog.ts:663-672`).
  - Lucky scenario rows are hard-coded `'built'` (`catalog.ts:397`), and so are the Love sub-areas (`catalog.ts:774`).

### 3.2 Table

Columns:

- **charts declared:** the row's `charts`.
- **digest sections read:** the distinct `contract.inputs[].section` values.
- **selectors:** the non-empty selector fields.
- **output:** `contract.output`, with its synthesizer after the arrow.
- **runs as:** code, or model with its prompt.
- **code file:** whether the files named in `code` exist.
- **line:** the `id:` line in `src/techniques/catalog.ts`, or the generator for rows built by a map.

This table was generated from the loaded catalogue, not typed by hand.

| id | board | status | charts / dashas / vargas declared | digest sections read | selectors | output | runs as | code file | file:line |
|---|---|---|---|---|---|---|---|---|---|
| `work.present_tone` | work | built | dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, transit:transit_contacts, transit:double_transit, jaimini:modifier, natal:house_counts, natal:facts | activation, house, transit | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `career_map.v1` | code | ok | catalog.ts:117 |
| `work.security_grade` | work | built | dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, transit:transit_contacts, transit:double_transit, jaimini:modifier, natal:house_counts, natal:facts | activation, house, transit | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `career_map.v1` | code | ok | catalog.ts:145 |
| `work.subarea_windows` | work | built | dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, transit:transit_contacts, transit:double_transit, jaimini:modifier, natal:house_counts, natal:facts | activation, house, transit | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `career_map.v1` | code | ok | catalog.ts:168 |
| `work.horizons` | work | built | dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, transit:transit_contacts, transit:double_transit, jaimini:modifier, natal:house_counts, natal:facts | activation, house, transit | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `career_map.v1` | code | ok | catalog.ts:192 |
| `work.looking_back` | work | built | dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, transit:transit_contacts, transit:double_transit, jaimini:modifier, natal:house_counts, natal:facts | activation, house, transit | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `career_map.v1` | code | ok | catalog.ts:212 |
| `work.annual_family` | work | built | annual:tithi_pravesha, annual:tithi_pravesha_dasha, annual:mudda, annual:patyayini, annual:sahams, divisional:D10 | annual | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `family_vote.v1` → work.present_tone | code | ok | catalog.ts:236 |
| `work.conditional_family` | work | built | dasha:applicable, dasha:conditional | activation | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `family_vote.v1` → work.present_tone | code | ok | catalog.ts:256 |
| `work.karaka_family` | work | built | dasha:karaka, jaimini:chara_karakas, divisional:D10 | activation, planet, point | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `family_vote.v1` → work.present_tone | code | ok | catalog.ts:275 |
| `work.d10_check` | work | built | divisional:D1, divisional:D10, divisional:D9, divisional:D60 | activation, house, planet | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D10 | `vote_check.v1` → work.present_tone | code | ok | catalog.ts:294 |
| `work.character_arc` | work | built | natal:facts, natal:dignities, divisional:D1, divisional:D10, divisional:D9, annual:tithi_pravesha, jaimini:charakaraka, dasha:vimshottari | activation, annual, house, planet, point | boards=work; subjects=career_work; houses=10,6,1,2,11; vargas=D1,D9,D10 | `work_character_arc.v1` | code | ok | catalog.ts:314 |
| `lucky.work.sign_contract` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.work.send_resume` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.work.interview` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.work.ask_raise` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.work.start_project` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.work.hard_talk_boss` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.love.ask_out` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.love.first_date` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.love.clear_air` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.money.invest_buy` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.travel.set_out` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.study.exam_submit` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.home.start_routine` | lucky | built | panchang:tithi, panchang:nakshatra, panchang:weekday, panchang:hora, panchang:muhurta, panchang:kalams, panchang:yoga, panchang:karana | panchang | boards=lucky | `windows.v1` | code | ok | catalog.ts:392-409 (generated from SCENARIOS) |
| `lucky.avoid_bands` | lucky | built | panchang:kalams, panchang:muhurta | panchang | boards=lucky | `day_bands.v1` | code | ok | catalog.ts:413 |
| `lucky.personal_overlay` | lucky | built | panchang:muhurta, nakshatra:tara, panchang:chandra_bala | activation, panchang, planet | boards=lucky | `day_overlay.v1` | code | ok | catalog.ts:433 |
| `lucky.day_tables` | lucky | built | panchang:muhurta | panchang | boards=lucky | `day_tables.v1` | code | ok | catalog.ts:454 |
| `lucky.panchang_limbs` | lucky | built | panchang:weekday, panchang:tithi, panchang:nakshatra, panchang:yoga, panchang:karana | panchang | boards=lucky | `limbs.v1` → lucky.avoid_bands | code | ok | catalog.ts:473 |
| `love.promise` | love | built | natal:facts, natal:house_counts, natal:dignities, natal:aspects, jaimini:argala, ashtakavarga:sav, natal:strength.bhava, natal:yogas, natal:doshas, jaimini:arudhas, natal:avasthas | house, planet, point, yoga | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.affliction` | love | built | natal:facts, natal:dignities, natal:aspects, natal:doshas, natal:avasthas, natal:house_counts | activation, house, planet, yoga | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.protection` | love | built | natal:aspects, natal:dignities, jaimini:argala, natal:yogas, natal:avasthas, divisional:D9, divisional:D7, divisional:D30 | house, planet, point, yoga | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.activation` | love | built | dasha:vimshottari, dasha:conditional, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha_dasha, dasha:yogini, dasha:tithi_ashtottari, divisional:D9, divisional:D7, divisional:D30 | activation, planet | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.transit` | love | built | transit:transit_contacts, transit:double_transit, transit:sade_sati, transit:eclipses, ashtakavarga:transit_ashtakavarga | house, transit | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.annual` | love | built | annual:tithi_pravesha, annual:sahams, annual:mudda, annual:patyayini, annual:tithi_pravesha_dasha | annual | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.varga` | love | built | divisional:D9, divisional:D7, divisional:D30 | house, planet, point | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.nakshatra` | love | built | nakshatra:cusp_nak, nakshatra:star_lord, nakshatra:occupant_stars | house, planet, star | boards=love; subjects=marriage_relationship; houses=7 values; vargas=D9,D7,D30 | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.meet` | love | built | natal:facts, divisional:D9, dasha:vimshottari, transit:transit_contacts | findings | boards=love; subjects=marriage_relationship; houses=7,5,11; vargas=D9; facts=love.status:single/dating | `board_subarea.v1` | code | ok | catalog.ts:763-783 (LOVE_SUBAREAS map) |
| `love.health` | love | built | natal:facts, divisional:D9, dasha:vimshottari, transit:transit_contacts | findings | boards=love; subjects=marriage_relationship; houses=7,5,11; vargas=D9; facts=love.status:dating/committed/married | `board_subarea.v1` | code | ok | catalog.ts:763-783 (LOVE_SUBAREAS map) |
| `love.reconcile` | love | built | natal:facts, divisional:D9, dasha:vimshottari, transit:transit_contacts | findings | boards=love; subjects=marriage_relationship; houses=7,5,11; vargas=D9; facts=love.status:separated/complicated | `board_subarea.v1` | code | ok | catalog.ts:763-783 (LOVE_SUBAREAS map) |
| `love.relationship_arc` | love | built | natal:facts, natal:dignities, divisional:D1, divisional:D9, divisional:D7, annual:tithi_pravesha, jaimini:charakaraka, dasha:vimshottari | activation, annual, house, planet, point | boards=love; subjects=marriage_relationship; houses=7,5,4,8,2,11; vargas=D1,D9,D7 | `love_relationship_arc.v1` | code | ok | catalog.ts:787 |
| `self.promise` | you | built | natal:facts, natal:house_counts, natal:dignities, natal:aspects, jaimini:argala, ashtakavarga:sav, natal:strength.bhava, natal:yogas, natal:doshas, jaimini:arudhas, natal:avasthas | house, planet, point, yoga | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.affliction` | you | built | natal:facts, natal:dignities, natal:aspects, natal:doshas, natal:avasthas, natal:house_counts | activation, house, planet, yoga | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.protection` | you | built | natal:aspects, natal:dignities, jaimini:argala, natal:yogas, natal:avasthas, divisional:D1, divisional:D9, divisional:D20, divisional:D24, divisional:D12, divisional:D4, divisional:D7, divisional:D60 | house, planet, point, yoga | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.activation` | you | built | dasha:vimshottari, dasha:conditional, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha_dasha, dasha:yogini, dasha:tithi_ashtottari, divisional:D1, divisional:D9, divisional:D20, divisional:D24, divisional:D12, divisional:D4, divisional:D7, divisional:D60 | activation, planet | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.transit` | you | built | transit:transit_contacts, transit:double_transit, transit:sade_sati, transit:eclipses, ashtakavarga:transit_ashtakavarga | house, transit | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.annual` | you | built | annual:tithi_pravesha, annual:sahams, annual:mudda, annual:patyayini, annual:tithi_pravesha_dasha | annual | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.varga` | you | built | divisional:D1, divisional:D9, divisional:D20, divisional:D24, divisional:D12, divisional:D4, divisional:D7, divisional:D60 | house, planet, point | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.nakshatra` | you | built | nakshatra:cusp_nak, nakshatra:star_lord, nakshatra:occupant_stars | house, planet, star | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,12; vargas=8 values | `area_board.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 668 |
| `self.character_arc` | you | built | natal:facts, natal:dignities, divisional:D1, divisional:D9, divisional:D10, annual:tithi_pravesha, jaimini:charakaraka, dasha:vimshottari, dasha:narayana | activation, annual, house, planet, point | boards=you; subjects=general_life_direction,education_learning,spirituality_moksha; houses=1,4,5,9,10; vargas=D1,D9,D10 | `self_character_arc.v1` | code | ok | catalog.ts:676 |
| `self.personality_joy` | you | built | natal:facts, natal:dignities, natal:aspects, divisional:D1, divisional:D9, divisional:D24, nakshatra:janma | house, planet, star | boards=you; subjects=general_life_direction,education_learning,health_body; houses=1,3,4,5,11,12; vargas=D1,D9,D24 | `self_personality_joy.v1` | code | ok | catalog.ts:721 |
| `self.reading.diagnosis` | you | built | natal:panel claims | findings | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `board_diagnosis.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.clock` | you | built | dasha:dasha.applicable, dasha:all served systems | activation | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_clock.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.lagna` | you | built | divisional:D1, divisional:D9, natal:dignities, natal:aspects, natal:avasthas, jaimini:arudhas, nakshatra:cusp star | house, planet, point | boards=you; subjects=general_life_direction; houses=1; vargas=D1,D9 | `self_panel.v1` → self.reading.diagnosis | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.mind` | you | built | divisional:D1, divisional:D9, natal:dignities, natal:yogas, nakshatra:Moon star, ashtakavarga:sav | house, planet, point, yoga | boards=you; subjects=general_life_direction; houses=3,4,5; vargas=D1,D9 | `self_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.atma` | you | built | jaimini:charakaraka, divisional:D1, divisional:D9, natal:avasthas | house, planet, point | boards=you; subjects=general_life_direction; houses=1,9,12; vargas=D1,D9 | `self_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.yogas` | you | built | natal:yogas, natal:doshas | yoga | boards=you; subjects=general_life_direction; houses=1,4,5,9; vargas=D1 | `self_panel.v1` → self.reading.diagnosis | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.struggle` | you | built | divisional:D1, natal:dignities, natal:avasthas, natal:benefic_malefic, natal:house_counts, dasha:reading clock L1-L3 | activation, house, planet | boards=you; subjects=general_life_direction; houses=1,4,5; vargas=D1 | `self_panel.v1` → self.reading.diagnosis | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.chapters` | you | built | dasha:reading clock L1-L2, dasha:vimshottari, dasha:narayana, dasha:chara, dasha:yogini, dasha:karaka, dasha:tithi_ashtottari, natal:avasthas dasha_charter | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_panel.v1` → self.reading.diagnosis | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.body` | you | built | divisional:D1, divisional:D30, natal:dignities, natal:benefic_malefic, dasha:reading clock L1-L2, transit:sky overlay when stored | activation, house, planet | boards=you; subjects=general_life_direction; houses=1,6,8; vargas=D1,D30 | `self_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.purview` | you | built | divisional:D1, divisional:D9, natal:yogas, dasha:reading clock, nakshatra:gandanta | activation, findings, planet, yoga | boards=you; subjects=general_life_direction; houses=1; vargas=D1,D9 | `purview.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.audit` | you | built | natal:dossier rows | findings | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `code_audit.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.year` | you | built | annual:tithi_pravesha, annual:tithi_pravesha_dasha, annual:varsha, annual:mudda | annual | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.reading.oracle` | you | built | natal:panel claims, divisional:D1, divisional:D9, divisional:D10, divisional:D30, dasha:reading clock, annual:tithi_pravesha, transit:sky overlay | activation, annual, house, planet, point, star, yoga | boards=you; subjects=general_life_direction | `self_reading.v1` | model: `src/reading/prompts/oracle/self.md` | ok | catalog.ts:1717 |
| `love.reading.clock` | love | built | dasha:kundli_activation | activation | boards=love; houses=7; vargas=D1 | `self_clock.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.diagnosis` | love | built | natal:panel claims | findings | boards=love; houses=7; vargas=D1,D9 | `board_diagnosis.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.chapters` | love | built | dasha:reading clock L1-L2, dasha:confirming clocks L1 | activation, planet | boards=love; houses=7 values; vargas=D1,D9 | `board_chapters.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.heart` | love | built | divisional:D1, divisional:D9 | house, planet | boards=love; houses=5,7; vargas=D1,D9 | `board_panel.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.partner` | love | built | divisional:D1, divisional:D9, jaimini:charakaraka, jaimini:arudhas | house, planet, point | boards=love; houses=7; vargas=D1,D9 | `board_panel.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.bond` | love | built | divisional:D1, divisional:D9, divisional:D7, jaimini:arudhas | house, planet, point | boards=love; houses=7,2,4,8; vargas=D1,D9,D7 | `board_panel.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.circle` | love | built | divisional:D1, divisional:D7, jaimini:charakaraka | house, planet, point | boards=love; houses=2,4,11,5; vargas=D1,D7 | `board_panel.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.struggle` | love | built | divisional:D1, natal:doshas, dasha:reading clock L1-L3 | activation, house, planet, yoga | boards=love; houses=7,5,8,12; vargas=D1 | `board_struggle.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.year` | love | built | annual:tithi_pravesha, annual:varsha | annual | boards=love; houses=7; vargas=D1 | `board_year.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.purview` | love | built | divisional:D1, divisional:D9, natal:yogas, dasha:reading clock | activation, findings, planet, yoga | boards=love; houses=7,5; vargas=D1,D9 | `purview.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.audit` | love | built | natal:dossier rows | findings | boards=love; houses=7; vargas=D1 | `code_audit.v1` | code | ok | catalog.ts:571-661 houseStateLayers, called at 663 |
| `love.reading.oracle` | love | built | natal:panel claims, divisional:D1, divisional:D9, divisional:D7, dasha:reading clock, annual:tithi_pravesha, transit:sky overlay | activation, annual, house, planet, point, star, yoga | boards=love; houses=7 values; vargas=D1,D9,D7 | `self_reading.v1` | model: `src/reading/prompts/oracle/self.md` | ok | catalog.ts:1839 |
| `work.reading.clock` | work | built | dasha:kundli_activation | activation | boards=work; houses=10; vargas=D1 | `self_clock.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.diagnosis` | work | built | natal:panel claims | findings | boards=work; houses=10; vargas=D1,D10 | `board_diagnosis.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.chapters` | work | built | dasha:reading clock L1-L2, dasha:confirming clocks L1 | activation, planet | boards=work; houses=8 values; vargas=D1,D10 | `board_chapters.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.vocation` | work | built | divisional:D1, divisional:D9, divisional:D10, jaimini:charakaraka | house, planet, point | boards=work; houses=10,3,5; vargas=D1,D9,D10 | `board_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.standing` | work | built | divisional:D1, divisional:D10, jaimini:arudhas | house, planet, point | boards=work; houses=10,1; vargas=D1,D10 | `board_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.ground` | work | built | divisional:D1, divisional:D10 | house, planet, point | boards=work; houses=6,3,7,12; vargas=D1,D10 | `board_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.gain` | work | built | divisional:D1, divisional:D2, divisional:D10, natal:yogas | house, planet, point, yoga | boards=work; houses=11,2; vargas=D1,D2,D10 | `board_panel.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.struggle` | work | built | divisional:D1, natal:avasthas, dasha:reading clock L1-L3 | activation, house, planet | boards=work; houses=10,6,11,2; vargas=D1 | `board_struggle.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.year` | work | built | annual:tithi_pravesha, annual:varsha | annual | boards=work; houses=10; vargas=D1 | `board_year.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.purview` | work | built | divisional:D1, divisional:D9, divisional:D10, natal:yogas, dasha:reading clock | activation, findings, planet, yoga | boards=work; houses=10,6,11; vargas=D1,D9,D10 | `purview.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.audit` | work | built | natal:dossier rows | findings | boards=work; houses=10; vargas=D1 | `code_audit.v1` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `work.reading.oracle` | work | built | natal:panel claims, divisional:D1, divisional:D9, divisional:D10, divisional:D2, dasha:reading clock, annual:tithi_pravesha, transit:sky overlay | activation, annual, house, planet, point, star, yoga | boards=work; houses=8 values; vargas=D1,D9,D10,D2 | `self_reading.v1` | model: `src/reading/prompts/oracle/self.md` | ok | catalog.ts:1920 |
| `general.promise` | chat | built | natal:facts, divisional:D1, divisional:D2, divisional:D3, divisional:D4, divisional:D7, divisional:D9, divisional:D10, jaimini:arudhas, jaimini:special_lagnas | house, planet, point, yoga | boards=chat; subjects=17 values | `findings.v2` → general.oracle | model: `src/reading/prompts/v2/promise.md` | ok | catalog.ts:860 |
| `general.varga_dynamics` | chat | built | divisional:D2, divisional:D4, divisional:D7, divisional:D9, divisional:D10, divisional:D12, divisional:D24, divisional:D30, divisional:D60, divisional:D16, divisional:D20, divisional:D27, divisional:D40, divisional:D45, divisional:D81, divisional:D108, divisional:D144 | house, planet | boards=chat; subjects=17 values; vargas=17 values | `findings.v2` → general.oracle | code | ok | catalog.ts:876 |
| `general.dasha` | chat | built | natal:facts, divisional:D1, divisional:D2, divisional:D3, divisional:D4, divisional:D7, divisional:D9, divisional:D10, dasha:vimshottari, dasha:narayana, dasha:conditional, dasha:chara, dasha:karaka, dasha:yogini, dasha:tithi_ashtottari | activation, house, planet | boards=chat; subjects=17 values; horizons=7 values | `findings.v2` → general.oracle | model: `src/reading/prompts/v2/dasha.md` | ok | catalog.ts:896 |
| `general.annual` | chat | built | natal:facts, annual:tithi_pravesha, annual:tithi_pravesha_dasha, annual:varsha, annual:sahams, annual:mudda, annual:patyayini, annual:tajaka | annual | boards=chat; subjects=17 values; horizons=now,3m,6m,1y,custom | `findings.v2` → general.oracle | model: `src/reading/prompts/annual.md` | ok | catalog.ts:912 |
| `general.transit` | chat | built | natal:facts, jaimini:arudhas, dasha:vimshottari, dasha:narayana, transit:transit_overlay, transit:transit_contacts, transit:transit_at | planet, transit | boards=chat; subjects=17 values; horizons=7 values | `findings.v2` → general.oracle | model: `src/reading/prompts/v2/transit.md` | ok | catalog.ts:928 |
| `general.nakshatra` | chat | built | natal:facts, nakshatra:janma, dasha:vimshottari, transit:transit_overlay | house, planet, star | boards=chat; subjects=17 values | `findings.v2` → general.oracle | model: `src/reading/prompts/v2/nakshatra.md` | ok | catalog.ts:944 |
| `general.strength_yoga` | chat | built | natal:yogas, natal:doshas, natal:strength, ashtakavarga:sav, natal:avasthas | house, planet, yoga | boards=chat; subjects=17 values | `findings.v2` → general.oracle | code | ok | catalog.ts:959 |
| `general.jaimini` | chat | built | jaimini:charakaraka, jaimini:arudhas, jaimini:argala, dasha:narayana, dasha:chara | house, point | boards=chat; subjects=17 values | `findings.v2` → general.oracle | code | ok | catalog.ts:980 |
| `general.prashna` | chat | built | natal:facts, natal:prashna | house, prashna | boards=chat; subjects=17 values; slots=prashna | `findings.v2` → general.oracle | model: `src/reading/prompts/prashna.md` | ok | catalog.ts:1001 |
| `general.person` | chat | built | natal:facts, natal:aspects, divisional:D12, divisional:D9, divisional:D7, divisional:D3, dasha:vimshottari | house, planet | boards=chat; subjects=children,siblings,marriage_relationship | `findings.v2` → general.oracle | code | ok | catalog.ts:1016 |
| `general.reader` | chat | built | natal:yogas, natal:doshas, natal:aspects, jaimini:argala, natal:bhava, divisional:D9, divisional:D30, divisional:D1, divisional:D2, divisional:D3, divisional:D4, divisional:D7, divisional:D10, dasha:vimshottari, dasha:narayana, dasha:chara, dasha:yogini, dasha:tithi_ashtottari, dasha:dwisatpathi, dasha:applicable, natal:strength, transit:transit_overlay, annual:tithi_pravesha, annual:varsha, annual:sahams, annual:mudda, annual:patyayini, natal:prashna, natal:sphutas | activation, annual, house, planet, point, prashna, transit, yoga | boards=chat; subjects=17 values | `findings.v2` → general.oracle | model: `src/reading/prompts/readers/_shared.md` | ok | catalog.ts:1036 |
| `general.oracle` | chat | built | — | findings, text | boards=chat; subjects=17 values | `answer.markdown` → general.validator | model: `src/reading/prompts/oracle/system.md` | ok | catalog.ts:1076 |
| `general.validator` | chat | built | — | text | boards=chat; subjects=17 values | `validator.v1` | model: `src/reading/prompts/oracle/validator.md` | ok | catalog.ts:1096 |
| `general.intake` | chat | built | — | text | boards=chat | `intent.v1` | model: `src/reading/prompts/intake.md` | ok | catalog.ts:1115 |
| `general.clarify` | chat | built | — | text | boards=chat | `intent.v1` | model: `db:clarify.system` | ok | catalog.ts:1130 |
| `digest.build` | chat | built | natal:dignities, natal:aspects, jaimini:argala, jaimini:arudhas, natal:house_counts, ashtakavarga:sav, natal:facts, natal:avasthas, natal:strength.shadbala, natal:benefic_malefic, natal:yogas, natal:doshas, jaimini:charakaraka, natal:sphutas, annual:tithi_pravesha, annual:varsha, nakshatra:janma, natal:panchanga | annual, house, planet, point, star, yoga | boards=chat,you,love,work,lucky,timeline | `kundli_digest.v1` | code | ok | catalog.ts:1158 |
| `digest.annual_set` | chat | built | annual:tithi_pravesha, annual:varsha, annual:tithi_pravesha_dasha, annual:mudda, annual:patyayini, annual:sahams, divisional:D9, divisional:D10 | annual | boards=chat,you,love,work,lucky,timeline | `kundli_digest.v1` → digest.build | code | ok | catalog.ts:1191 |
| `digest.activation` | chat | built | dasha:all_systems, dasha:applicable, natal:facts | activation, planet | boards=chat,you,love,work,lucky,timeline | `kundli_activation.v1` → digest.build | code | ok | catalog.ts:1210 |
| `life.promise_scale` | timeline | built | natal:digest.house, natal:digest.planet, natal:digest.yoga, divisional:D9, divisional:owning varga, dasha:kundli_activation, annual:digest.annual, transit:transit_snapshot.double_transit | activation, house, planet, yoga | boards=timeline; houses=12 values; vargas=11 values | `life_promise.v1` → life.dashboard | code | ok | catalog.ts:1260 |
| `life.timing_agreement` | timeline | built | natal:digest.house, natal:digest.planet, natal:digest.yoga, divisional:D9, divisional:owning varga, dasha:kundli_activation, annual:digest.annual, transit:transit_snapshot.double_transit | activation, annual, transit | boards=timeline; houses=12 values; vargas=11 values | `life_windows.v1` → life.dashboard | code | ok | catalog.ts:1285 |
| `life.mahadasha_charter` | timeline | built | natal:digest.house, natal:digest.planet, natal:digest.yoga, divisional:D9, divisional:owning varga, dasha:kundli_activation, annual:digest.annual, transit:transit_snapshot.double_transit | activation, annual, house, planet, transit, yoga | boards=timeline; houses=12 values; vargas=11 values | `life_charter.v1` → life.dashboard | code | ok | catalog.ts:1308 |
| `life.dashboard` | timeline | built | natal:digest.house, natal:digest.planet, natal:digest.yoga, divisional:D9, divisional:owning varga, dasha:kundli_activation, annual:digest.annual, transit:transit_snapshot.double_transit | activation, annual, house, planet, transit, yoga | boards=timeline; houses=12 values; vargas=11 values | `life_reading.v2` | code | ok | catalog.ts:1329 |
| `research.self_dashboard_qa` | you | built | natal:facts, natal:dignities, natal:aspects, natal:avasthas, natal:yogas, natal:doshas, natal:strength.shadbala, ashtakavarga:sav, jaimini:charakaraka, jaimini:arudhas, jaimini:argala, nakshatra:janma, nakshatra:cusp_nak, divisional:D1, divisional:D9, divisional:D10, divisional:D20, divisional:D24, divisional:D12, divisional:D2, divisional:D4, divisional:D7, divisional:D60, dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha, annual:varsha, annual:tithi_pravesha_dasha, transit:transit_contacts, transit:sade_sati, panchang:muhurta | activation, annual, house, planet, point, star, transit, yoga | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha,career_work; houses=12 values; vargas=10 values | `research_self_dashboard.v1` → research.technical_verifier | code | ok | catalog.ts:1408 |
| `research.love_dashboard_qa` | love | built | natal:facts, natal:dignities, natal:aspects, natal:avasthas, natal:yogas, natal:doshas, natal:strength.shadbala, ashtakavarga:sav, jaimini:charakaraka, jaimini:arudhas, jaimini:argala, nakshatra:janma, nakshatra:cusp_nak, divisional:D1, divisional:D9, divisional:D10, divisional:D20, divisional:D24, divisional:D12, divisional:D2, divisional:D4, divisional:D7, divisional:D60, dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha, annual:varsha, annual:tithi_pravesha_dasha, transit:transit_contacts, transit:sade_sati, panchang:muhurta | activation, annual, house, planet, point, star, transit, yoga | boards=love; subjects=marriage_relationship,children; houses=7 values; vargas=D1,D9,D7,D30 | `research_love_dashboard.v1` → research.technical_verifier | code | ok | catalog.ts:1429 |
| `research.work_dashboard_qa` | work | built | natal:facts, natal:dignities, natal:aspects, natal:avasthas, natal:yogas, natal:doshas, natal:strength.shadbala, ashtakavarga:sav, jaimini:charakaraka, jaimini:arudhas, jaimini:argala, nakshatra:janma, nakshatra:cusp_nak, divisional:D1, divisional:D9, divisional:D10, divisional:D20, divisional:D24, divisional:D12, divisional:D2, divisional:D4, divisional:D7, divisional:D60, dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha, annual:varsha, annual:tithi_pravesha_dasha, transit:transit_contacts, transit:sade_sati, panchang:muhurta | activation, annual, house, planet, point, star, transit, yoga | boards=work; subjects=career_work,income_wealth; houses=7 values; vargas=D1,D10,D9,D2,D24 | `research_work_dashboard.v1` → research.technical_verifier | code | ok | catalog.ts:1449 |
| `research.technical_verifier` | you | built | natal:facts, natal:dignities, natal:aspects, natal:avasthas, natal:yogas, natal:doshas, natal:strength.shadbala, ashtakavarga:sav, jaimini:charakaraka, jaimini:arudhas, jaimini:argala, nakshatra:janma, nakshatra:cusp_nak, divisional:D1, divisional:D9, divisional:D10, divisional:D20, divisional:D24, divisional:D12, divisional:D2, divisional:D4, divisional:D7, divisional:D60, dasha:vimshottari, dasha:yogini, dasha:tithi_ashtottari, dasha:narayana, dasha:chara, dasha:karaka, annual:tithi_pravesha, annual:varsha, annual:tithi_pravesha_dasha, transit:transit_contacts, transit:sade_sati, panchang:muhurta | activation, annual, findings, house, planet, point, star, transit, yoga | boards=you; subjects=general_life_direction,health_body,education_learning,spirituality_moksha; houses=1,4,5,9,10,12; vargas=D1,D9,D10,D20,D24 | `research_verifier_audit.v1` | code | ok | catalog.ts:1469 |
| `self.sub.clock` | you | built | dasha:dasha.applicable, dasha:all served systems | activation | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.clock_resolution` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.periods` | you | built | dasha:primary clock L1-L3, natal:dasha charter | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.period_frame` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.windows` | you | built | dasha:primary clock L1-L3, transit:stored sky overlay, natal:functional nature | activation, planet, transit | boards=you; subjects=general_life_direction; houses=12 values; vargas=D1 | `self_v2.window_set` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.promise` | you | built | natal:yogas, natal:doshas, natal:dasha charter | planet, yoga | boards=you; subjects=general_life_direction; houses=12 values; vargas=D1 | `self_v2.promise_ledger` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.risk` | you | built | dasha:primary clock, transit:stored sky overlay, natal:yogas | activation, transit, yoga | boards=you; subjects=general_life_direction; houses=12 values; vargas=D1 | `self_v2.risk_ledger` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.mind_facts` | you | built | divisional:D1, divisional:D9, natal:yogas, nakshatra:star profile | house, planet, star, yoga | boards=you; subjects=general_life_direction; houses=4,5; vargas=D1,D9 | `self_v2.mind_facts` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.body_facts` | you | built | divisional:D1, divisional:D30, jaimini:A6, dasha:primary clock, transit:stored sky overlay | activation, house, planet, point, transit | boards=you; subjects=general_life_direction; houses=1,6,8; vargas=D1,D30 | `self_v2.body_facts` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.presence_facts` | you | built | divisional:D1, divisional:D9, jaimini:AL, dasha:primary clock | activation, house, planet, point | boards=you; subjects=general_life_direction; houses=1,2,4; vargas=D1,D9 | `self_v2.presence_facts` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.year` | you | built | annual:tithi_pravesha, annual:tithi_pravesha_dasha, annual:Varshaphal mudda | annual | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.year_frame` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.sub.profile` | you | built | natal:none (person facts) | person | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.profile_pack` | code | ok | catalog.ts:1971-2011 (self.sub generator) |
| `self.v2.now` | you | built | natal:self.sub outputs | activation, person, planet, transit | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.stuck` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.chapter` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.diagnosis` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.lagna` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.mind` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.body` | you | built | natal:self.sub outputs | activation, planet, transit | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.drive` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.presence` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.yogas` | you | built | natal:self.sub outputs | planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.chapters` | you | built | natal:self.sub outputs | activation, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.year` | you | built | natal:self.sub outputs | annual, planet | boards=you; subjects=general_life_direction; houses=1; vargas=D1 | `self_v2.area_brief` | code | ok | catalog.ts:2189-2216 (self.v2 area map) |
| `self.v2.oracle` | you | built | natal:D1, divisional:D9, divisional:D10, divisional:D30, dasha:reading clock, annual:year chart, transit:sky overlay | activation, annual, house, planet, point, star, yoga | boards=you; subjects=general_life_direction | `self_v2_oracle.v1` | model: `src/reading/prompts/oracle/self-areas-v2.md` | ok | catalog.ts:2236 |
| `self.v2.personalizer` | you | built | dasha:reading clock, transit:windows around today | activation | boards=you; subjects=general_life_direction | `self_v2_cards.v1` | model: `src/reading/prompts/personalizer/self.md` | ok | catalog.ts:2258 |
| `self.v2.hero` | you | built | dasha:reading clock, transit:windows around today | activation | boards=you; subjects=general_life_direction | `self_v2_hero.v1` | model: `src/reading/prompts/personalizer/self.md` | ok | catalog.ts:2283 |
| `self.v3.cards` | you | built | natal:D1, divisional:D9, dasha:reading clock, dasha:confirming clocks, annual:year chart, transit:Saturn passage | activation | boards=you; subjects=general_life_direction | `self_v3_cards.v1` | model: `src/reading/prompts/oracle/self-cards-v3.md` | ok | catalog.ts:2307 |
| `self.now` | you | built | dasha:each clock of the reading set, deepest level served, transit:today, D1-D60, natal overlay | activation | boards=you; subjects=general_life_direction | `now_card.v1` | model: `src/reading/prompts/common/reader-system.md` | ok | catalog.ts:2333 |
| `self.card.reading` | you | built | natal:D1, divisional:D9, dasha:each clock of the reading set, annual:year chart, transit:sky window | activation | boards=you; subjects=general_life_direction | `self_v3_cards.v1` | model: `src/reading/prompts/common/reader-system.md` | ok | catalog.ts:2356 |
| `reading.clock.sheet` | you | built | natal:D1, divisional:D9, dasha:each clock of the reading set, annual:year chart, transit:sky window | activation | boards=you; subjects=general_life_direction | `clock_sheet.v1` | model: `src/reading/prompts/common/reader-system.md` | ok | catalog.ts:2381 |
| `reading.concordance` | you | built | dasha:each clock of the reading set, annual:year chart | activation | boards=you; subjects=general_life_direction | `agreed_ledger.v1` | model: `src/reading/prompts/concordance.md` | ok | catalog.ts:2406 |

### 3.3 How the catalogue reaches the database

- `seedTechniqueRegistry` (`src/techniques/catalog.ts:2479-2495`) upserts every `TECHNIQUES` row into
  `technique_registry` at server boot (`server.ts:466`) and from `scripts/write-techniques-doc.ts:193`. A SQL form of
  the same insert is `TECHNIQUE_SEED_SQL` (`catalog.ts:2464`). The upsert writes `id, title, category, board, status,
  charts, algorithm, special, source, code_ref, agents, accuracy, selectors, contract` only.
- `enabled` and `verification_status` are **never written** by the seed, so every row keeps the column defaults
  (`true`, `verified`; M36 `migration.sql:3-5`) unless staff change them in the admin.
  `src/reading/area/shadeResolver.ts:566` reads both columns to gate shades, so the gate is open for every technique by
  default (D9).
- **No migration inserts a technique row.** What is "seeded" is exactly the code catalogue at the deployed commit:
  142 rows, all `built`.
- The live `technique_registry` and `chart_data_types` tables were **not queried** (no read-only connection string was
  at hand in this session). Whether staff have disabled or downgraded any row is therefore unknown.

### 3.4 Chart types: what the server may pull (the other half of the "database")

`chart_data_types` decides which engine types the server pulls and stores in `kundli_data`:

- The built-in list is `BUILTIN_CHART_TYPES` (`src/reading/chartData/catalog.ts:136-270`). In code a natal entry is
  `served: false` unless it says otherwise (`catalog.ts:156-159`). Only `panchanga.birth`, `karaka.chara`, the D1, D2,
  D4, D7, D9, D10 vargas (`SERVED_VARGAS`, `:133`) and the two legacy dashas are `served: true` in code.
- Migrations seed the table with the same flags (for example `strength.bhava`, `strength.vimsopaka`,
  `strength.harsha`, `dasha.karaka`, `dasha.chara`, `varga.d30`, `daily_grade`, `muhurta`, `transit_ashtakavarga` are
  all `false` in their INSERTs; M7, M9, M17, M34, M46 under `prisma/migrations/`).
- The live flag is set by `src/services/chartCatalogSync.ts:6-7, 67-89`: every type the engine's `catalog` lists
  becomes `served = true`, every other `false`. `mergeChartTypes` (`catalog.ts:297-320`) lets the table override code.
- **Consequence for the specs:** the technique specs in `docs/techniques/**` repeatedly say a type is "`served: false`
  in `chartData/catalog.ts:197-199`" (bhava, vimsopaka, harsha). That is the code default, not the live state; the
  engine does export all three (03 §2, `natal_export.py:270, 293, 311`). What really keeps them out of readings is that
  they are not in `DIGEST_NATAL_TYPES` (`src/reading/digest/build.ts:1337-1347`) (D2).

## 4. Per-board notes

- **Chat / general reading (18 rows).** Six model analysts (`general.promise`, `.dasha`, `.annual`, `.transit`,
  `.nakshatra`, `.prashna`), four code readers (`.varga_dynamics`, `.strength_yoga`, `.jaimini`, `.person`), the
  Oracle readers `general.reader` (R01-R14, P1-P3), and `general.intake`, `.clarify`, `.oracle`, `.validator`
  (`catalog.ts:860-1130`). Only the analysts and code readers carry astrological inputs; their dasha input is
  `activation` rows of every served system plus Vimshottari to level 3 and `dasha.applicable`.
- **You / Self (55 rows).** Three generations side by side, all marked `built`: the doc 46 house-state layers
  (`self.promise ... self.nakshatra`, houses 1, 4, 5, 9, 12; `catalog.ts:587-672`), the v2 sub-techniques and area
  selections (`self.sub.*`, `self.v2.*`, `catalog.ts:2189-2283`), and v3 (`self.v3.cards`, `self.card.reading`,
  `reading.clock.sheet`, `reading.concordance`, `self.now`; `catalog.ts:2307-2406`). The v3 rows read "the reading
  clock" and "confirming clocks", which is the five-clock set of doc 70 (`READING_CLOCK_ORDER`,
  `src/config/env.ts:859-872`).
- **Love (25 rows).** The same eight house-state layers over houses 7, 5, 11, 2, 4, 8, 12 with D9, D7, D30
  (`LOVE_PLANNED`, `catalog.ts:663-672`), three status sub-areas (`love.meet`, `love.health`, `love.reconcile`,
  `catalog.ts:774`), `love.reading.*` cards and `love.relationship_arc`.
- **Work (23 rows).** The career map families (`work.present_tone`, `.security_grade`, `.subarea_windows`,
  `.horizons`, `.looking_back`, `.annual_family`, `.conditional_family`, `.karaka_family`, `.d10_check`;
  `catalog.ts:94-311`), `work.reading.*` cards and `work.character_arc`.
- **Lucky (17 rows).** Four shared panchang rows (`lucky.day_tables`, `.panchang_limbs`, `.avoid_bands`,
  `.personal_overlay`; `catalog.ts:413-478`) and 13 scenario rows hard-coded `built` (`catalog.ts:397`), whose rules
  live in `src/reading/luckyTimes/scenarios.ts` (`SCENARIOS`, tithi and star groups, Amrita Siddhi table).
- **Timeline (4 rows).** `life.promise_scale`, `life.timing_agreement`, `life.mahadasha_charter`, `life.dashboard`.

## 5. Discrepancies

| # | Docs or specs say | Code does | Where |
|---|---|---|---|
| D1 | Specs mark `general.jaimini_karakamsha` and `general.sudarshana_chakra` `planned`, `love.bonding_chemistry` `partial` | Neither planned id exists in `TECHNIQUES`; every catalogue row is `built` (142/142) | `docs/techniques/general/general.jaimini_karakamsha.md:5`, `general.sudarshana_chakra.md:5`, `love/love.bonding_chemistry.md:5`; `catalog.ts:2433` |
| D2 | `self.promise` and `love.promise` declare `strength.bhava`; the spec for `general.dasha` lists vimsopaka and harsha as its declared charts | Only `strength.shadbala` is in the digest, so no technique reads bhava, vimsopaka or harsha; `general.dasha`'s real `charts` (`catalog.ts:901`) has neither | `catalog.ts:600`; `build.ts:1337-1347`; `docs/techniques/general/general.dasha.md` §3 |
| D3 | Doc 53 §4.4 renames the analysts (`general.house_promise`, `general.dasha_all_systems`, `general.annual_set`) and moves them to `findings.v3` | Ids unchanged, output `findings.v2`; `findings.v3` appears nowhere in the catalogue | `docs/reading-engine/53-kundli-digest-and-technique-contracts.md:164-180`; `catalog.ts:860-944` (`special` at `:903` says the rename is deferred) |
| D4 | Specs and doc 76 rely on a Tithi Pravesha `yearLord` | The digest sets `yearLord`, `muntha` and `tajakaYogas` only for `VP` D1 and only when `annual.tajaka@year` is stored (`build.ts:1177`), so TP rows never carry a year lord. `annual.tajaka` is not in the annual pull set; whether registration pulls it depends on the live `served` flag (not checked) | `src/reading/digest/build.ts:1174-1190`; `src/reading/digest/annualSet.ts:11-14` |
| D5 | Doc 53 §4.3: "the matcher returns the techniques whose selectors all match" | `houses` and `vargas` selectors are descriptive and never matched | `src/techniques/contracts.ts:17` |
| D6 | Doc 56: every technique's output is stored by validity window | About 12 technique ids are ever written to `technique_outputs` | §2.6; `docs/TODOS.md:1840` |
| D7 | `general.varga_dynamics` declares D81, D108, D144 (and D16-D45) | No sub-agent slice includes D81, D108 or D144 | `catalog.ts:881, 892`; `src/reading/oracle/digestSlices.ts:349, 399` |
| D8 | Specs: "`served: false` in `chartData/catalog.ts`" | The live flag comes from the engine catalogue sync | §3.4 |
| D9 | Admin governance: verified, calibrating, experimental, disabled | The seed never sets them, so all rows are `verified` and `enabled` | §3.3 |
| D10 | Specs call the conditional, annual and karaka work families `built` | `career.ts:46` still exports `FAMILIES_NOT_BUILT = ['conditional clock', "this year's chart", 'karaka clock']`; it is now only a label list for families that cast no vote (`:455`) | `src/reading/area/career.ts:46-50, 226-307, 455` |
| D11 | `docs/techniques/README.md`: "Complete Catalogue Index (69 Techniques)" | 142 catalogue rows | `docs/techniques/README.md:57`; `catalog.ts:2433` |
| D12 | Annual set: ten years back and ahead in D1, D9, D10 | `DIGEST_ANNUAL_MAX_CALLS` defaults to 40 calls per run against about 21 years x 10 pulls; the set fills nearest-first over several runs | `src/reading/digest/annualSet.ts:15-20` |

## 6. Known open TODOs in this area (not re-filed here)

- P0: the Tithi Pravesha year dasha spans 108 years (`docs/TODOS.md:19-30`). The engine fix is on
  `feat/dasha-levels-1-6`; open until deployed and digests rebuilt.
- Doc 80 gap analysis and doc 81 Priority #2 plan (`docs/TODOS.md:115-135`): 23-varga ingestion, TP `year_lord`,
  `daily_grade` / `muhurta` / `transit_ashtakavarga`, vedha, murti nirnaya, 2027-2036 contacts, synastry, Sudarshana.
- Annual Tajaka layer not served (`docs/TODOS.md:863`).
- Annual and overlay parity gaps per kundli; overlays carry no exact contacts; no stored D11 (`docs/TODOS.md:240-244`).
- Self sub-technique outputs not written to `technique_outputs` (`docs/TODOS.md:1840`).
- The `pressure_inventory` chart type row is created by the loader as served false (`docs/TODOS.md:1964`).

## 7. What each reading-engine doc says the store holds (one line each)

| Doc | What it specifies for the stored contracts and digest |
|---|---|
| 53 `53-kundli-digest-and-technique-contracts.md` | Digest once per kundli (`digest.build`, status M32/M33); a technique is a stored contract (`selectors` + `contract`, §4.3); house-led general set (§4.4); boards as digest readers (§4.5); Lucky five limbs and universal prepull (§4.6); engine pass E1-E5 (§7) |
| 54 `54-build-contracts-digest-boards-life-reading.md` | Build contracts for doc 53's parallel slices: S1 digest core (M32, M33, `src/reading/digest/*`), S2 Lucky five limbs, S3 Self and Love boards, S4 life reading, S5 techniques in use (`src/techniques/use.ts`, selector) (`54:§1`) |
| 55 `55-life-reading-mahadasha-charter.md` | Life reading reads the digest, ~10k activation rows (43 systems, L1-L3, +30 y) and the engine's `dasha_charter` (5-vector MD charter, 9x9 AD-from-MD fruition); adds `life.mahadasha_charter` (§1) |
| 55 `55-technique-verification-and-shade-architecture.md` | Shade choice and verification: `technique_decision_logs`, governance (`enabled`, `verification_status`), benchmark charts (M36) |
| 56 (both files) | Technique pieces (readers, scorers, cache gate, prompts, outputs, agents) and validity windows: `technique_outputs` keyed by technique, kundli, digest version, freshness and window (M37) |
| 57 `57-technique-pieces-llm-cache-upload-and-subagent-prewarm.md` | Per-sub-agent digest slices (`SUBAGENT_DIGEST_SPECS`), explicit LLM cache upload and prewarm, `llm_cache_entries`, 45-minute recycle; indexes the 76 illustration pages in `docs/techniques/` |
| 59 `59-board-panels-as-techniques.md` | Every board panel is a catalogue row: shared `board.chapters`, `board.struggle`, `board.year`, `board.confirm` filtered by houses, catalogued per board as `<board>.reading.<panel>`; fact panels (natal rows only) kept apart from timing panels (§0) |
| 62 `62-self-card-contract.md` | The You reading card contract (`GET /api/self/reading`): panels read from `technique_outputs` and reuse one `reading_dossiers` row; worked example on the Dwisaptati clock |
| 67 `67-dasha-levels-1-6.md` | Activation levels: L1-L3 lifelong, L4-L6 in a window around today (dasha-deep worker); readers' levels per board (§1) |
| 70 (`70-*.md`) | Five clocks; `kundli_slices` (pre-rendered text per slice, with evidence keys and source calc versions); `reading.clock.sheet` and `reading.concordance` outputs (agreed ledger) |
| 82-85 | No new astrological technique. 82: no word filters in code (prompt owns the words). 83: one card writer, one check. 84: constrain at generation, never refuse a card. 85: a chat view on every card (`feature.card_chat`). They change card writing and checks, not what the store holds |
