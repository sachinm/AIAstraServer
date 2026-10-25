# 20 — Radha as the data provider: what to expose, how to store it, how to fetch it

Status: **reviewed (doc 21), edits applied**. Written 2026-10-25 from Sachin's brief; review in
[21-radha-plan-review.md](21-radha-plan-review.md). R-1/R-2 (server store) and R-7 (cache cleanup) are being built; the Radha
Python items are not started.
Related: [21-radha-plan-review.md](21-radha-plan-review.md), [09-lambda-contract.md](09-lambda-contract.md) (facts/transits contract), [14-life-timeline.md](14-life-timeline.md),
[16-kundli-sync-and-dossier-ops.md](16-kundli-sync-and-dossier-ops.md), [19-dag-convergence-and-caching.md](19-dag-convergence-and-caching.md).

## 1. The point

Radha (the pyjhora fork, `AIAstra_Radha`) is the **only** source of astrological data. Node computes nothing.
The computation is free (our own Lambda); what costs money is LLM tokens. So the goal is:

1. Get **every** piece of chart data we may ever need out of Radha as JSON tables.
2. Store what does not change, so Radha is asked once per person per item.
3. Let any agent ask for a missing item **on the fly**, one item per Radha call, and have it stored on the way back.
4. Send the LLM only what the question needs, cache it on the LLM side while the person is active, and delete that cache
   when they leave (see §8).

Radha was built as a desktop app (`src/jhora/ui/`, PyQt tabs). Almost everything the desktop shows is computed by library
modules under `src/jhora/horoscope/` and `src/jhora/panchanga/`; the FastAPI server (`src/jhora/api.py`) exposes only a
few of them. The work is wiring more of those library calls into the existing endpoint, not new astrology.

## 2. What Radha serves today

One endpoint: `POST /api/export-horoscope` with `{dob, tob, place | lat/lon/tz, type}` → `{type, data}`.
Deployed as Lambda `aiastra-pyjhora` (Mangum), branch `develop` (f1b57c4). One `type` per call.

| `type` | Built by (`src/jhora/export.py`) | Stored today in `kundlis.` |
|---|---|---|
| `biodata` | `_build_biodata_json` (panchanga at birth, coords) | `biodata` |
| `d1` `d2` `d4` `d7` `d9` `d10` | `_build_placements_json` via `TYPE_TO_CHART_INDEX` | one column each |
| `charakaraka` | `_build_chara_karaka_json` | `charakaraka` |
| `vimsottari_dasa` | `_build_vimsottari_dasa_json` (maha → bhuktis tree) | `vimsottari_dasa` |
| `narayana_dasa` | `_build_narayana_dasa_json` (same tree shape) | `narayana_dasa` |

So registration makes **10 calls** today. Each call rebuilds the whole `Horoscope` object, and `export.py` throttles to
one call per second per client (`_EXPORT_API_MIN_INTERVAL_SEC = 1.0`), so registration takes 10 s or more.

Already computed in `export.py` but **not** exposed: `_build_ashtakavarga` (text only, no JSON builder yet).

Known issue: sub-period rows in the dasha output have bugs (Sachin). The maha → bhukti JSON shape is right and is the
pattern every new dasha should follow; the bugs get catalogued and fixed in their own pass (§10, R-6).

## 3. Everything Radha can compute that we want (the inventory)

Grouped by how often it changes, because that decides storage (§4).

### 3.1 Natal — never changes for a person (store forever)

**Divisional charts.** pyjhora supports 23 factors (`const.division_chart_factors`):
D1 D2 D3 D4 D5 D6 D7 D8 D9 D10 D11 D12 D16 D20 D24 D27 D30 D40 D45 D60 D81 D108 D144.

| Group | Charts | Why |
|---|---|---|
| Shodasavarga (Parashara's 16) | D1 D2 D3 D4 D7 D9 D10 D12 D16 D20 D24 D27 D30 D40 D45 D60 | The standard set every reading method uses |
| Extra | D5 D6 D8 D11 D81 D108 D144 | Rarely used; fetch on demand only |

Each comes out through the same `_build_placements_json` with a generalised `TYPE_TO_CHART_INDEX` (index = position in
`division_chart_factors`). One code change covers all 23.

**Dashas.** pyjhora has 22 graha dashas (`horoscope/dhasa/graha/`) and 22 rasi dashas (`horoscope/dhasa/raasi/`).

| Tier | Dashas | Why |
|---|---|---|
| Core | Vimsottari, Narayana, Yogini, Chara, Kalachakra | Only Vimsottari + Narayana are read by the method (docs 02/11); the rest are for astrologer-grade answers and are on demand |
| Conditional | **Ashtottari**, Dwadasottari, Shodasottari, Panchottari, Satabdika, Chaturaseeti Sama, Dwisaptati Sama, Shastihayani, Shattrimsa Sama | Classical "applicable only if …" dashas, fetched only when applicable. `graha/applicability.py: applicability_check` covers 7 of the 9 (ashtottari, chaturaaseeti_sama, dwadasottari, dwisatpathi, panchottari, satabdika, shashtisama); **Shodasottari and Shattrimsa Sama are a `TODO` in pyjhora**: implement the two checks in the Radha pass or leave them on-demand by explicit request only |
| Specialist | Moola, Sudasa, Drig, Shoola, Sthira, Trikona, Kendradi, Lagnamsaka, Mandooka, Navamsa, Padhanadhamsa, Paryaaya, Brahma, Varnada, Yogardha, Tara Lagna, Chakra, Sandhya, Nirayana; Tara, Karaka, Naisargika, Buddhi Gathi, Kaala, Saptharishi Nakshatra, Tithi Ashtottari, Tithi Yogini, Yoga Vimsottari, Aayu | Fetch on demand (researcher/astrologer questions) |

New natal item `dasha.applicable`: a cheap Radha type wrapping `applicability_check` that returns the list of conditional dashas that
apply to this chart (one call, stored like any natal item). `ensureChartData` requests only those.

Every dasha is returned in the existing tree shape: `[{maha_dasha_lord, maha_start_date, bhuktis: [...]}]`. **pyjhora returns two
levels** (maha, bhukti); a third level (pratyantara) and `end_date`/`duration_years` per node are new work (generic level-3 walker per
dasha family; Vimsottari first, it is all doc 11 reads). Sub-period bugs are catalogued in doc 21 §6 (R-6).

**Strengths and other natal tables.**

| Item | pyjhora source |
|---|---|
| Shadbala (six-fold planet strength) | `chart/strength.py: shad_bala` |
| Bhava bala (house strength) | `strength.py: bhava_bala` |
| Vimsopaka / vargeeya bala | `strength.py: pancha_vargeeya_bala`, `dwadhasa_vargeeya_bala` |
| Harsha bala | `strength.py: harsha_bala` |
| Ashtakavarga | `chart/ashtakavarga.py` (builder exists in `export.py`, needs JSON). JSON returns raw BAV, SAV **and** the sodhana-reduced tables (doc 11 L3 reads raw BAV bindus and SAV) |
| Yogas, Raja yogas | `chart/yoga.py`, `chart/raja_yoga.py`. Payload = yoga ids + English names (not language-resource strings) |
| Doshas | `chart/dosha.py` |
| Arudhas (bhava + graha) | `chart/arudhas.py` |
| Special points (sphutas) | `chart/sphuta.py` |
| Planet aspect table | `strength.py: planet_aspect_relationship_table` |
| Chara karakas | already exposed |

### 3.2 Annual — changes once a year (store per year, refresh on the birthday)

| Item | pyjhora source |
|---|---|
| Varsha pravesh / Tajaka annual chart | `transit/tajaka.py: annual_chart`, `varsha_pravesh` |
| Tithi pravesha chart | `panchanga/vratha.py: tithi_pravesha` (used by `chart/charts.py`) |
| Mudda dasha, Patyayini dasha (annual dashas) | `dhasa/annual/mudda.py`, `patyayini.py` |
| Sahams (36) | `transit/saham.py` (doc 11 L5 reads them) |
| Tajaka yogas | `transit/tajaka_yoga.py` |
| Maasa pravesh (monthly, optional) | `transit/tajaka.py: maasa_pravesh` |

The annual `variant` is the **solar-return year**: the year the varsha pravesh falls in, not the calendar year the person asked in.
Radha returns `valid_to` (the next varsha pravesh instant, `tajaka.annual_chart` for `years+1`) so the server computes no dates.

### 3.3 Moving — changes daily

Two parts:

- **Global ephemeris** (transit positions, ingress dates): the same for everyone on a given day, so it lives in the global
  `transit_snapshots` table (M3), not per person.
- **Per-person overlay** (houses from Lagna/Moon/AL, `over_natal`, double transits, sade sati): stored in `kundli_data` as
  `transit.overlay` with `variant = year=<yyyy>`. Short-lived for chat horizons (up to 3 years, recompute is cheap); stored for the
  36-year timeline (computed once, section 9).

## 4. Storage: a vertical kundli table

Today `kundlis` has one JSON column per item. Adding ~60 more columns (and more later) does not scale, and every new
item needs a migration. Proposal: keep `kundlis` as the person's header row, add a **vertical** table with one row per
(kundli, data type, variant).

```
chart_data_types            -- the keyword list (catalog), seeded from Radha's `catalog` type
  id            text pk       -- dotted ids, see below
  family        text          -- varga | dasha | strength | yoga | annual | panchanga | karaka | transit
  radha_type    text          -- the `type` sent to Radha (wire name; the id stays stable if Radha renames)
  change_class  text          -- natal | annual
  tier          text          -- first | registration | on_demand   (priority order, not a hard boundary)
  variant_kind  text          -- natal | year
  served        bool          -- Radha serves it today; unserved types are never requested
  calc_version  text          -- per-type, bumped by hand in Radha when that type's numbers change
  legacy_column text null     -- the old kundlis column this backfills from
  sort_order    int           -- queue order within a tier
  label         text
  enabled       bool

kundli_data
  kundli_id         fk -> kundlis (cascade)
  data_type         fk -> chart_data_types.id
  variant           text default ''   -- '' for natal; 'year=2027' for an annual item
  params            jsonb             -- explicit parameters used, defaults included (e.g. {"chart_method":1})
  ayanamsa          text default 'LAHIRI'
  calc_version      text              -- the type's calc_version when fetched; 'legacy' on backfilled rows
  engine_commit     text              -- Radha build that produced it (forensics only)
  payload           jsonb
  payload_hash      text
  status            text              -- ready | fetching | failed | unsupported
  error             text null
  fetch_started_at  timestamptz       -- start of the 90 s fetch lease
  fetched_at        timestamptz
  valid_to          timestamptz null  -- annual items: next varsha pravesh; natal: null
  unique (kundli_id, data_type, variant, ayanamsa)
```

Migration **M7** is `20261025120000_reading_m7_kundli_data`.

**Keys.** One dotted scheme everywhere: `panchanga.birth` (= today's `biodata`), `varga.d1` ... `varga.d144`,
`dasha.<pyjhora module name>`, `karaka.chara`, `arudhas`, `ashtakavarga`, `strength.shadbala|bhava|vimsopaka|harsha`, `aspects`,
`yogas`, `doshas`, `sphutas`, `annual.varsha|tithi_pravesha|mudda|patyayini|sahams`, `transit.overlay`. Seed the catalog from
Radha's `catalog` type, never by hand.

**Variant and params.** `variant` is `''` (natal) or `'year=2027'` (solar-return year). Options a type takes (`chart_method` for
vargas, `chara_method`, `antardhasa_option`, dasha level depth) go in `params`, stored explicitly with their defaults so a later
Radha default change cannot alias two computations under one key.

**Staleness is per-type `calc_version`, not `engine_commit`.** Most Radha commits change nothing numerically; invalidating on
`engine_commit` would re-fetch every user on every release. A row is stale when its `calc_version` differs from the catalog's, or
(annual) when `valid_to` has passed. `engine_commit` is kept for forensics.

**The row is the fetch lock.** To fetch, insert `status = fetching` with `fetch_started_at`; losing the unique-key race means
wait and poll. A `fetching` row older than the 90 s lease is reclaimable. No in-process locks (separate Lambda instances).

**Page size is not a problem.** Postgres pages are 8 KB, but `jsonb` values larger than ~2 KB are moved out of line
(TOAST) and compressed automatically. A D60 table or a three-level dasha tree (tens of KB) is stored and read as one
value with no special handling. One row per item also means a read pulls only the items a question needs, not the whole
person.

**Migration path (nothing breaks).**
1. Add the two tables (migration M7). Seed `chart_data_types`.
2. Backfill: copy each existing `kundlis` column into `kundli_data` rows (pure SQL, no Radha calls). Backfilled rows are tagged
   `calc_version = 'legacy'`: today's `d1`/`d9` payloads are placement rows for the Charts page, not the per-planet records the dossier
   needs, so the two shapes must not be mixed under one key. Legacy rows are re-fetched once R-3/R-4 land.
3. Readers (`src/reading/data/store.ts`, dossier builder, GraphQL kundli resolvers, `kundliQueueService`) read
   `kundli_data` first and fall back to the old column while both exist.
4. Writers write to `kundli_data` only once every reader has moved over.
5. The old columns stay until the new path has run in production for a while; dropping them is a separate decision.

## 5. Fetch on demand: `ensureChartData`

One server function, `ensureChartData` in `src/reading/chartData/store.ts`, is the only way anything reaches Radha:

```
ensureChartData(kundliId, ['varga.d60', 'dasha.yogini', 'annual.varsha@year=2027'])
  -> reads kundli_data rows by key list (never SELECT * the person)
  -> missing / failed / stale (calc_version or valid_to) items: coalesced into one multi-type Radha request per kundli + params
  -> single-flight = the row lock (insert 'fetching', 90 s lease); losers wait and poll
  -> bounded concurrency; unserved types (served = false) are never requested
  -> stores each result as it arrives, returns all payloads
```

One item per call stays the agent-facing contract (`getChartData(types[])`), but misses for one kundli are **coalesced into one
multi-type Radha request**: `type` still accepts a string and also accepts a list; the response is
`{results: {type: {data} | {error}}}`. Radha builds `Horoscope` once and runs each builder (every call otherwise rebuilds the full
panchanga). Storage is unchanged: N rows.

Without the M7 tables, `ensureChartData` degrades to the legacy `kundlis` columns plus uncached Radha calls.

Agents (specialists in the reading graph, the timeline builder, the clarify planner) get a tool
`getChartData(types[])` that calls `ensureChartData`. They never call Radha directly, so storage, retries and rate
limits live in one place. A missing item costs one Radha round trip the first time and a DB read after that.

## 6. How many Radha calls, and when

| When | Items | Calls |
|---|---|---|
| Registration | 18 items in this order (chat can open after the first six): 1-6 `panchanga.birth`, `varga.d1`, `varga.d9`, `dasha.vimsottari`, `arudhas`, `karaka.chara`; 7-11 `varga.d10`, `d2`, `d4`, `d7`, `ashtakavarga`; 12-18 `dasha.narayana`, `strength.shadbala`, `yogas`, `varga.d12`, `d30`, `d60`, `d3` | ~18 (fewer with multi-type) |
| On demand | everything else in section 3: D16/D20/D24/D27/D40/D45, Yogini/Chara/Kalachakra, applicable conditional dashas, bhava bala, vimsopaka, sphutas, doshas, **this year's annual items** (the annual agent is phase 4, doc 11) | 1 per item, first use only |
| Timeline opt-in | Vimsottari to PD level over 36 years, Narayana AD, `transit.overlay` for 18 years each way, 36 tithi pravesha + 36 Mudda (+ sahams) | 100-150 per person (section 9) |
| Birthday | next year's annual items, for people who have them | ~4 per person per year |

Registration fetches only what the first readings read. Keep `tier` as "priority order": `first`, `registration`, `on_demand`, with
`sort_order` deciding the queue.

The throttle is our own code at both ends, not Radha's real limit. Options, in the order to do them:

1. **Order the queue** as above.
2. **Fix the server side**: pass `lat/lon/tz` (stored on `kundlis` since M1) and drop the 1.1 s Nominatim spacing for those calls
   (Nominatim is skipped when coordinates are sent); raise `KUNDLI_QUEUE_MAX_FETCHES_PER_USER` to 3-4; **whitelist the server in
   Radha** (the 1 s/client check is an in-process dict that only fires for two calls on the same warm instance; keep it for anonymous
   callers).
3. **Multi-type request first** (section 5): the first Radha change. One `Horoscope` build serves all types; `biodata`/`d1` also call
   `get_horoscope_information()`, which computes everything.
4. **Two Radha deployments, split by workload**: `aiastra-pyjhora-bulk` (timeline backfills, birthdays) and
   `aiastra-pyjhora-live` (chat-time fetches), reserved concurrency on `live`. This is the lever for timeline volume, not for
   registration. Deployment config, not code.

Splitting Radha into separate services per domain (one for dashas, one for vargas, one for tithi pravesh) is **not**
recommended now: it is one Python codebase, every item needs the same `Horoscope` build, and splitting multiplies
deploys without making anything faster. Start with one deployment for testing, add the bulk/live split (4) when
timeline volume needs it.

## 7. What changes in Radha (the Python pass)

Mostly `src/jhora/export.py` and the `ExportType` list in `src/jhora/api.py`; the dasha level-3 walker and two applicability checks
touch library modules.

1. Multi-type request: `type` accepts a list; `ExportType` becomes a list validated against the catalog rather than a hard-coded `Literal`.
2. Generalise vargas: `d1` ... `d144` for all 23 factors. `_chart_key_prefix` only maps 2/4/7/9/10; use `main.py`'s
   `dhasavarga_dict` (factor -> key). Record `chart_method` in `params`.
3. One JSON builder per dasha family on a shared tree builder, with `end_date`/`duration_years`, ISO dates, and the third level;
   plus `dasha.applicable`.
4. JSON builders for each strength / yoga / arudha / sphuta / ashtakavarga item in section 3.1.
5. Annual items `annual.varsha|tithi_pravesha|mudda|patyayini|sahams` taking a `year` field and returning `valid_to`.
6. `transits` (09-lambda-contract). **`facts` is no longer a Radha type**: Radha returns sections (the per-item payloads), the
   server stores them as rows, and `src/reading/data/factsBuilder.ts` assembles `facts.v1` from rows. The per-item payloads carry what
   the facts schema needs (planet records with house, nakshatra, dignity, lords, relations).
7. A `catalog` type: the types this build supports, per-type `calc_version`, accepted `params` per type, engine commit.
8. API default `ayanamsa = "LAHIRI"` (today `TRUE_LAHIRI`, which shifts Vimsottari by days for callers that omit the field).
   **Lahiri only** is stored; keep `ayanamsa` in the key so another ayanamsa later is a new row, not a migration.
9. Golden tests: per type, JSON matches a stored fixture (G1 chart in `evals/fixtures/G1/`); reuse pyjhora's `tests/pvr_tests.py` values.

## 8. LLM cache lifecycle (stop paying for idle caches)

Today (`src/reading/llm/promptCache.ts`): a Gemini `cachedContents` entry is created on the second use of a chart's
prefix, with a 1-hour TTL, and remembered in an in-memory map. Nothing deletes it on logout. Separate Lambda instances
do not share the map, so the same chart can be cached twice.

Plan:

1. **Registry table** `llm_cache_entries (name, provider, user_id, kundli_id, prefix_hash, created_at, last_used_at,
   expires_at, deleted_at)`. Every instance looks here before creating one, so there is one cache per chart prefix.
2. **30 min sliding TTL.** Create with 30 min, push the expiry to now + 30 min on every use (Gemini allows updating `ttl`). If
   everything else fails, an unused cache dies by itself within 30 minutes. Break-even for keeping a 30k-token prefix is ~35-40 idle
   minutes, so longer idle limits cost more than re-creating.
3. **Delete on logout.** Logout (and session expiry) deletes that user's caches through the Gemini API and marks the rows.
4. **Hourly sweeper** (EventBridge schedule -> small Lambda, or a job in the API Lambda): delete every cache with
   `last_used_at` older than the idle limit, and reconcile against Gemini's list of caches so nothing is orphaned (its real job is
   orphans from instances that died before writing the registry row).
5. Explicit cache applies to Gemini 3.x specialists only (Gemini 4 Argon does not support `cachedContents`), and only once the key
   is on paid billing.
6. Track cache spend per day (storage hours × size) next to token spend, so the saving is visible.

## 9. The 36-year timeline (needs the same data)

The accuracy timeline (18 years back, 18 forward; [14-life-timeline.md](14-life-timeline.md)) needs, per person:

- Vimsottari to **PD level across 36 years** (level 3 is new work) and Narayana antardasha;
- the natal overlay for 18 years each way: `transit.overlay` rows, one per year, **per person per year** (the global ephemeris stays in
  `transit_snapshots`);
- for TL4: 36 tithi pravesha charts + 36 Mudda dashas (+ sahams if read).

That is roughly **100-150 items per person**, versus 18 for registration, so this (not registration) is the case for the
multi-type request and the bulk Radha function. Timeline rows are fetched only when the person opens or opts into the timeline, never
at registration, and never during a chat turn. It is planned separately.

## 10. Phases

| # | Work | Repo |
|---|---|---|
| R-1 | `chart_data_types` + `kundli_data` (M7), backfill from `kundlis` columns (`calc_version = 'legacy'`), dual read | Server |
| R-2 | `ensureChartData` + `getChartData` tool; kundli queue writes rows | Server |
| R-3 | Radha: multi-type request, all 23 vargas, `catalog` type, `ayanamsa` default, golden tests | Radha |
| R-6 | Catalogue and fix the dasha sub-period bugs; shared dasha tree builder (**before R-4**) | Radha |
| R-4a | Radha: two-level dashas + end dates, `dasha.applicable`, strengths, ashtakavarga, yogas, arudhas | Radha |
| R-4b | Radha: level-3 dashas, sphutas, doshas, specialist dashas | Radha |
| R-5 | Radha: annual items incl. sahams; birthday refresh job | Radha + Server |
| R-7 | LLM cache registry, 30 min sliding TTL, logout delete, hourly sweeper | Server |
| R-8 | `transits` type; `facts` assembled server-side from rows; retire the 24 locally built dossiers | Radha + Server |
| R-9 | Bulk/live Radha split when timeline volume needs it | Infra |

R-1, R-2 and R-7 do not depend on Radha changes and can start first.

## 11. Decisions (from the review, doc 21 section 1)

1. **Registration tier**: the 18 ordered items in section 6; everything else on demand.
2. **Conditional dashas**: fetched only when `dasha.applicable` says they apply; Ashtottari is conditional, not Core.
3. **Ayanamsa**: Lahiri only; keep the column; fix the API default.
4. **LLM cache**: 30 min sliding TTL, delete on logout, hourly sweeper.
5. **Throttle**: fix the compute shape first (server spacing, concurrency, whitelist, multi-type request); bulk/live split later for
   timeline volume.
