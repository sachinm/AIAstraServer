# 20 — Radha as the data provider: what to expose, how to store it, how to fetch it

Status: **plan for review (Fable)**. Nothing in this doc is built yet. Written 2026-10-25 from Sachin's brief.
Related: [09-lambda-contract.md](09-lambda-contract.md) (facts/transits contract), [14-life-timeline.md](14-life-timeline.md),
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
| Core | Vimsottari, Narayana, Yogini, Ashtottari, Chara, Kalachakra | What the reading method and most astrologers actually use |
| Conditional | Dwadasottari, Shodasottari, Panchottari, Satabdika, Chaturaseeti Sama, Dwisaptati Sama, Shastihayani, Shattrimsa Sama | Classical "applicable only if …" dashas; `graha/applicability.py` tells which apply to a chart |
| Specialist | Moola, Sudasa, Drig, Shoola, Sthira, Trikona, Kendradi, Lagnamsaka, Mandooka, Navamsa, Padhanadhamsa, Paryaaya, Brahma, Varnada, Yogardha, Tara Lagna, Chakra, Sandhya, Nirayana; Tara, Karaka, Naisargika, Buddhi Gathi, Kaala, Saptharishi Nakshatra, Tithi Ashtottari, Tithi Yogini, Yoga Vimsottari, Aayu | Fetch on demand (researcher/astrologer questions) |

Every dasha is returned in the existing tree shape: `[{maha_dasha_lord, maha_start_date, bhuktis: [...]}]`,
extended to a third level (antara/pratyantara) where pyjhora provides it.

**Strengths and other natal tables.**

| Item | pyjhora source |
|---|---|
| Shadbala (six-fold planet strength) | `chart/strength.py: shad_bala` |
| Bhava bala (house strength) | `strength.py: bhava_bala` |
| Vimsopaka / vargeeya bala | `strength.py: pancha_vargeeya_bala`, `dwadhasa_vargeeya_bala` |
| Harsha bala | `strength.py: harsha_bala` |
| Ashtakavarga (BAV + SAV) | `chart/ashtakavarga.py` (builder exists in `export.py`, needs JSON) |
| Yogas, Raja yogas | `chart/yoga.py`, `chart/raja_yoga.py` |
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
| Maasa pravesh (monthly, optional) | `transit/tajaka.py: maasa_pravesh` |

### 3.3 Moving — changes daily (do not store per person)

Transit positions for a date, and the transit-over-natal overlay (09-lambda-contract `transits`). Positions are the same
for everyone on a given day, so they belong in the global `transit_snapshots` table (already exists, M3), not per person.
The overlay per person is cheap to recompute and is not stored beyond the request (or kept for a day at most).

## 4. Storage: a vertical kundli table

Today `kundlis` has one JSON column per item. Adding ~60 more columns (and more later) does not scale, and every new
item needs a migration. Proposal: keep `kundlis` as the person's header row, add a **vertical** table with one row per
(kundli, data type, variant).

```
chart_data_types            -- the keyword list (catalog), seeded and editable
  id            text pk       -- 'd1', 'd60', 'dasha.vimsottari', 'strength.shadbala', 'annual.varsha', …
  family        text          -- varga | dasha | strength | yoga | annual | panchanga | karaka
  radha_type    text          -- the `type` sent to Radha
  change_class  text          -- natal | annual | moving
  tier          text          -- registration | on_demand
  sort_order    int
  enabled       bool

kundli_data
  id            uuid pk
  kundli_id     fk → kundlis (cascade)
  data_type     fk → chart_data_types.id
  variant       text default ''   -- '' for natal; '2027' for an annual item; params hash if a type takes options
  ayanamsa      text default 'LAHIRI'
  engine_commit text              -- Radha build that produced it (rebuild when the engine changes)
  payload       jsonb
  payload_hash  text
  status        text              -- ready | fetching | failed
  error         text null
  fetched_at    timestamptz
  valid_to      timestamptz null  -- annual items: next birthday; natal: null
  unique (kundli_id, data_type, variant, ayanamsa)
```

**Page size is not a problem.** Postgres pages are 8 KB, but `jsonb` values larger than ~2 KB are moved out of line
(TOAST) and compressed automatically. A D60 table or a three-level dasha tree (tens of KB) is stored and read as one
value with no special handling. One row per item also means a read pulls only the items a question needs, not the whole
person.

**Migration path (nothing breaks).**
1. Add the two tables (migration M7). Seed `chart_data_types`.
2. Backfill: copy each existing `kundlis` column into `kundli_data` rows (pure SQL, no Radha calls).
3. Readers (`src/reading/data/store.ts`, dossier builder, GraphQL kundli resolvers, `kundliQueueService`) read
   `kundli_data` first and fall back to the old column while both exist.
4. Writers write to `kundli_data` only once every reader has moved over.
5. The old columns stay until the new path has run in production for a while; dropping them is a separate decision.

## 5. Fetch on demand: `ensureChartData`

One server function is the only way anything reaches Radha:

```
ensureChartData(kundliId, ['d60', 'dasha.yogini', 'annual.varsha@2027'])
  → reads kundli_data rows
  → for each missing / failed / stale (engine_commit or valid_to) item: one Radha call per item
  → single-flight per (kundli, type, variant) so two agents never fetch the same thing twice
  → bounded concurrency per Radha client (respects its throttle)
  → stores each result as it arrives, returns all payloads
```

Agents (specialists in the reading graph, the timeline builder, the clarify planner) get a tool
`getChartData(types[])` that calls `ensureChartData`. They never call Radha directly, so storage, retries and rate
limits live in one place. A missing item costs one Radha round trip the first time and a DB read after that.

## 6. How many Radha calls, and when

| When | Items | Calls |
|---|---|---|
| Registration (tier `registration`) | biodata; 16 vargas; Vimsottari, Narayana, Yogini, Ashtottari, Chara, Kalachakra; chara karakas; shadbala, bhava bala, vimsopaka; ashtakavarga; yogas; arudhas; this year's varsha + tithi pravesh | ~32 |
| On demand | everything else in §3 | 1 per item, first use only |
| Birthday | next year's annual items | ~4 per person per year |

At today's one-call-per-second throttle that is 30+ seconds of registration work. It runs in the existing kundli queue
(the person does not wait on it) and the reading engine already works with the first 10 items, so this is acceptable
to start. Ways to make it faster, in the order I'd try them:

1. **Order the queue.** Fetch what the first reading needs first (biodata, D1, D9, Vimsottari, current varsha), the
   rest after. The person can chat after the first five calls.
2. **Raise the throttle for our own server.** The 1 s/client limit protects Radha from strangers; our API key could get
   a higher limit.
3. **Two Radha deployments, split by workload, not by data type.** Same image, two Lambda functions:
   `aiastra-pyjhora-bulk` (registration, birthdays, backfills, timeline) and `aiastra-pyjhora-live` (on-demand fetches
   during chat), with reserved concurrency on `live` so a registration burst never slows a person who is chatting.
   This is deployment config, not code.
4. A multi-type request (`types: [...]`, one `Horoscope` build, many tables back) would cut compute a lot, because every
   call currently rebuilds the whole horoscope. Sachin's model is one item per call; this stays an option for the bulk
   function only if (1)–(3) are not enough.

Splitting Radha into separate services per domain (one for dashas, one for vargas, one for tithi pravesh) is **not**
recommended now: it is one Python codebase, every item needs the same `Horoscope` build, and splitting multiplies
deploys without making anything faster. Start with one deployment for testing, add the bulk/live split (3) when
registration volume needs it.

## 7. What changes in Radha (the Python pass)

All in `src/jhora/export.py` and the `ExportType` list in `src/jhora/api.py`; no change to the library modules.

1. Generalise vargas: `d1` … `d144` for all 23 factors (one mapping table).
2. One JSON builder per dasha family, reusing the existing maha → bhukti tree shape; add the third level.
3. JSON builders for each strength / yoga / arudha / sphuta / ashtakavarga item in §3.1.
4. Annual items: `annual.varsha`, `annual.tithi_pravesh`, `annual.mudda`, `annual.patyayini` taking a `year` field.
5. The `facts` and `transits` types from 09-lambda-contract.
6. A `catalog` type that returns the list of types this build supports and its engine commit, so the server can
   seed `chart_data_types` and detect when a rebuild is needed.
7. Golden tests: for a fixed birth, each type's JSON matches a stored fixture (also our check against desktop output).

## 8. LLM cache lifecycle (stop paying for idle caches)

Today (`src/reading/llm/promptCache.ts`): a Gemini `cachedContents` entry is created on the second use of a chart's
prefix, with a 1-hour TTL, and remembered in an in-memory map. Nothing deletes it on logout. Separate Lambda instances
do not share the map, so the same chart can be cached twice.

Plan:

1. **Registry table** `llm_cache_entries (name, provider, user_id, kundli_id, prefix_hash, created_at, last_used_at,
   expires_at, deleted_at)`. Every instance looks here before creating one, so there is one cache per chart prefix.
2. **Short TTL, extended on use.** Create with ~30 min, push the expiry forward when used (Gemini allows updating
   `ttl`). If everything else fails, an unused cache dies by itself within 30 minutes.
3. **Delete on logout.** Logout (and session expiry) deletes that user's caches through the Gemini API and marks the rows.
4. **Sweeper every 3 hours** (EventBridge schedule → small Lambda, or a job in the API Lambda): delete every cache with
   `last_used_at` older than the idle limit, and reconcile against Gemini's list of caches so nothing is orphaned.
5. Track cache spend per day (storage hours × size) next to token spend, so the saving is visible.

## 9. The 36-year timeline (needs the same data)

The accuracy timeline (18 years back, 18 forward; [14-life-timeline.md](14-life-timeline.md)) needs: full three-level
Vimsottari (and the core dashas) across 36 years, 36 annual charts, and transits sampled across those years. All of it
goes through `ensureChartData` on the **bulk** Radha function, ahead of time, never during a chat turn. It is planned
separately.

## 10. Phases

| # | Work | Repo |
|---|---|---|
| R-1 | `chart_data_types` + `kundli_data` (M7), backfill from `kundlis` columns, dual read | Server |
| R-2 | `ensureChartData` + `getChartData` tool; kundli queue writes rows | Server |
| R-3 | Radha: all 23 vargas, `catalog` type, golden tests | Radha |
| R-4 | Radha: core dashas, strengths, ashtakavarga, yogas, arudhas | Radha |
| R-5 | Radha: annual items; birthday refresh job | Radha + Server |
| R-6 | Catalogue and fix the dasha sub-period bugs | Radha |
| R-7 | LLM cache registry, logout delete, 3-hour sweeper | Server |
| R-8 | `facts` / `transits` types (09-lambda-contract); retire the 24 locally built dossiers | Radha + Server |
| R-9 | Bulk/live Radha split when registration volume needs it | Infra |

R-1, R-2 and R-7 do not depend on Radha changes and can start first.

## 11. Questions for review

1. Is the registration tier in §6 the right set, or should it be smaller (and the rest on demand)?
2. Which conditional dashas matter for our reading method, or do we fetch them only when `applicability.py` says they apply?
3. Ayanamsa: Lahiri only, or also store others (the `ayanamsa` column allows it)?
4. Cache idle limit: 30 minutes, or longer for people who chat on and off?
5. Do we raise the Radha throttle for our server's API key, or go straight to the bulk/live split?
