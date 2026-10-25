# 22 — Radha build plan: what to change in the Python Lambda, in what order

Status: **build plan**, written 2026-10-25 after the review (doc 21) and with the server side of R-1/R-2/R-7 merged into
`develop`. Doc 20 says *what* Radha must serve; doc 21 checked it against pyjhora; this doc says *how* to build it, phase by
phase, with the wire contract, files, payload shapes, tests and the deploy path.

Repo: `C:\Users\Owner\Documents\work\AIAstra_Radha` (pyjhora fork), branch `develop` (f1b57c4). Code that changes:
`src/jhora/export.py` (builders), `src/jhora/api.py` (request model), `lambda_handler.py` (unchanged), tests under
`src/jhora/tests/`. Library modules under `src/jhora/horoscope/` change only where a phase says so (R-6, R-4c).

Ground rules for every phase:

- Radha computes; the Node server stores and serves. No astrology in Node.
- Every type is backwards compatible on the wire until the server's catalog says otherwise (§1.4).
- One feature branch per phase off Radha `develop`, merged `--no-ff` after `pytest` passes. Deploys go through the deploy
  session with Sachin's approval (§8).
- Long commands (pytest, image builds) run in background mode (AGENTS.md).

## 1. Wire contract (all phases build on this)

Endpoint stays `POST /api/export-horoscope`. Today: `{dob, tob, place | lat/lon/tz, ayanamsa, type}` → `{type, data}`.

### 1.1 Single type (unchanged shape, two optional fields)

```json
{ "dob": "1990-04-12", "tob": "06:30:00", "lat": 28.61, "lon": 77.21, "tz": 5.5, "ayanamsa": "LAHIRI",
  "type": "d60", "params": { "chart_method": 1 }, "year": 2027 }
```

Response adds `calc_version` and `params_used` next to the existing fields:

```json
{ "type": "d60", "data": { ... }, "calc_version": "1", "params_used": { "chart_method": 1 } }
```

`params` is validated per type against the catalog (§1.3); unknown keys → 400. `year` is required for `annual.*` types and
rejected for others. The server stores `params_used` in `kundli_data.params` and `calc_version` in `kundli_data.calc_version`.

### 1.2 Multi-type (phase R-M)

```json
{ "...birth fields...": "", "types": ["d1", "d9", "dasha.vimsottari", "ashtakavarga"], "params": { "d9": { "chart_method": 1 } } }
```

→ one `Horoscope` build, every builder run on it:

```json
{ "results": {
    "d1": { "data": { ... }, "calc_version": "1", "params_used": {} },
    "dasha.vimsottari": { "error": "..." } } }
```

One type failing never fails the others. `type` (string) and `types` (list) are mutually exclusive. Max 40 types per call.

### 1.3 `catalog` type

```json
{ "type": "catalog", "data": { "engine_commit": "f1b57c4", "types": [
    { "type": "d60", "calc_version": "1", "params": { "chart_method": { "default": 1, "allowed": [1, 2, 3, 4] } } },
    { "type": "annual.varsha", "calc_version": "1", "params": {}, "needs_year": true } ] } }
```

Needs no birth data (dob/tob/place optional for this type only). `calc_version` per type lives in one dict
`CALC_VERSIONS` in `export.py`; bump a type's entry by hand whenever its numbers or shape change. `engine_commit` comes from
the `ENGINE_COMMIT` env var set at image build (`dev` locally).

### 1.4 How the server picks up a new type

`chart_data_types.radha_type` is the wire name. A server job `syncChartCatalog` (server task S-1, §7) calls `catalog`, sets
`served = true` and `calc_version` for every type Radha lists, and leaves the rest unserved. Rows whose `calc_version`
differs become stale and are re-fetched on next use (already built in `ensureChartData`). No server deploy is needed to
switch a new Radha type on.

### 1.5 Fixes that ship in the first phase

- **Ayanamsa default:** `api.py` defaults to `TRUE_LAHIRI`, the server always sends `LAHIRI` (doc 21 Q3). Change the API
  default to `LAHIRI` so a caller that omits it gets the same numbers as the server. The server already sends it explicitly,
  so stored data does not change.
- **Rate limit:** `_enforce_export_api_rate_limit` (1 s per client label) never protects anything in our deployment (doc 21
  Q5). Skip it when the request carries a valid API key; keep it for unauthenticated local use.
- **`ExportType` Literal → catalog check:** the request model accepts any string; `run_export_by_type` rejects types not in
  the catalog with the existing `Invalid export type: <x>` message (the server detects that string and marks the row
  `unsupported`).

## 2. Order of phases and why

| # | Phase | Why this position |
|---|---|---|
| R-3 | All 23 vargas + `catalog` + §1.5 fixes | Smallest change, unlocks the catalog mechanism every later phase uses |
| R-6 | Fix the two existing dashas (doc 21 §6) and define the dasha node shape | Every new dasha copies this shape; fixing it after adding 40 dashas means 40 fixes |
| R-4a | Strengths, ashtakavarga, yogas, arudhas, sphutas, doshas, aspects | Library functions exist; JSON builders only; the reading method's L3/L4 layers use them |
| R-4b | Core + conditional dashas, two levels, plus `dasha.applicable` | Uses the R-6 shape; `applicability.py` decides which conditional dashas a chart gets |
| R-M | Multi-type request | Registration (18 items) and the timeline (100+ items) need one `Horoscope` build, not one per item |
| R-4c | Third dasha level for every family | Real new code (doc 21 §4); needed by the timeline, not by first readings |
| R-5 | Annual items with `year` | Annual agent is phase 4 of the reading method; birthday refresh job on the server |
| R-8 | `transits` type (doc 09) | Largest new Python; the parked draft in `drafts/radha/` is the starting point |

R-3 is being built now in its own session. R-6 can start as soon as R-3 merges (different functions in the same file).

## 3. R-3 — all divisional charts and the catalog

**Change** (`export.py`):

1. `VARGA_TYPES = {f"d{f}": f for f in const.division_chart_factors}`; replace `TYPE_TO_CHART_INDEX` with the index of the
   factor in `const.division_chart_factors`.
2. `_chart_key_prefix`: take the factor → resource-key mapping from what `Horoscope` builds (`main.py: dhasavarga_dict`),
   not a hand-written dict, so every factor resolves.
3. `params.chart_method`: allowed values from `const.varga_option_dict[factor]`; default = today's behaviour. Pass it to
   `get_horoscope_information_for_chart`.
4. `catalog` type and `CALC_VERSIONS` (§1.3); §1.5 fixes in `api.py`.

**Payload:** same shape `_build_placements_json` returns today for d2…d10 (planet rows with sign, longitude, nakshatra,
house), for every factor.

**Tests:**
- golden: capture today's JSON for d1 d2 d4 d7 d9 d10 for the G1 birth **before** changing code; after the change those six
  must be byte-identical;
- every other factor returns ≥ 9 planet rows plus the ascendant for G1;
- `chart_method` outside the allowed list → 400; catalog lists every type with a `calc_version`;
- unknown type → `Invalid export type`.

**Done:** all tests green; catalog lists 23 vargas + the 4 other existing types + `catalog`.

## 4. R-6 — fix the existing dashas and fix the node shape

**The dasha node shape** used by every dasha from now on:

```json
{ "system": "vimsottari", "levels": 2, "balance_at_birth": { "lord": "Moon", "years": 6.42 },
  "periods": [
    { "lord": "Moon", "level": 1, "start": "1984-03-02", "end": "1994-03-02", "start_jd": 2445761.5, "end_jd": 2449413.5,
      "duration_years": 10.0, "before_birth": true,
      "children": [ { "lord": "Moon", "level": 2, "start": "1984-03-02", "end": "1984-12-31", "...": "..." } ] } ] }
```

- ISO dates plus Julian days; no display times (fixes doc 21 bug 2).
- Every node has `end` and `duration_years` (bug 3); children are contiguous and cover the parent exactly (test).
- `before_birth` / `balance_at_birth` instead of silently listing a maha that started before the DOB (bug 5).
- Rasi dashas use sign names as `lord` plus `sign_index`.

**Fixes:** first bhukti label taken from the row, not the maha (bug 1); tribhagi variation on copies of the module dicts,
never mutating them (bug 4, change in `horoscope/dhasa/graha/vimsottari.py`); check the `(+1)` day roll-over and
`_where_occurs` boundary against `pvr_tests.py` expected values.

**Compatibility:** the shape changes, so `vimsottari_dasa` and `narayana_dasa` get `calc_version` "2". The server marks the
legacy rows stale and re-fetches; the dossier builder (`src/reading/data/factsBuilder.ts`) and the old chat services that
read the legacy columns need a reader for the new shape before the switch (server task S-2). Until S-2 lands, keep serving
the old shape under the old type names and the new shape under `dasha.vimsottari` / `dasha.narayana`.

**Tests:** pvr_tests expected Vimsottari and Narayana dates for the book charts; contiguity and coverage; a warm-process
test calling with and without tribhagi twice and comparing.

## 5. R-4 — everything else natal

### R-4a builders (`export.py`, one function each, wire names = server ids)

| Type | Source | Payload |
|---|---|---|
| `ashtakavarga` | `ashtakavarga.get_ashtaka_varga` + sodhana | `{bav: {planet: [12 bindus]}, sav: [12], reduced: {trikona: ..., ekadhipatya: ...}}` (raw tables, doc 11 L3 reads BAV ≥ 4 and SAV ≥ 28/≤ 22) |
| `strength.shadbala` | `strength.shad_bala(jd, place, ayanamsa_mode)` | per planet: six components, total rupas, required, ratio, rank |
| `strength.bhava` | `strength.bhava_bala` | per house: total, rank |
| `strength.vimsopaka` | `pancha_vargeeya_bala`, `dwadhasa_vargeeya_bala` | per planet per scheme |
| `strength.harsha` | `strength.harsha_bala` | per planet |
| `aspects` | `planet_aspect_relationship_table` | matrix of aspect strengths |
| `yogas` | `yoga.get_yoga_details`, `raja_yoga.*` | list of `{id, name_en, present, planets, houses}`; ids, not language strings |
| `doshas` | `dosha.*` | list of `{id, present, detail}` |
| `arudhas` | `arudhas.bhava_arudhas_from_planet_positions`, `graha_arudhas_…` | `{bhava: {A1..A12: sign}, graha: {planet: sign}}` |
| `sphutas` | `sphuta.*` | `{name: longitude}` |

### R-4b dashas (two levels, R-6 shape)

Core: Vimsottari, Narayana (from R-6), Yogini, Chara, Kalachakra. Conditional (Ashtottari, Dwadasottari, Shodasottari,
Panchottari, Satabdika, Chaturaseeti Sama, Dwisaptati Sama, Shastihayani, Shattrimsa Sama): served for every chart, but the
new `dasha.applicable` type wraps `applicability_check` and returns which apply, so agents fetch only applicable ones.
Specialist dashas follow the same builder pattern; add them in batches of five with a pvr_tests check each.

### R-4c third level

A generic level-3 walker per family: graha dashas split proportionally to period lengths, rasi dashas split equally
(doc 21 §4). `params.levels` ∈ {2, 3}, default 2; level 3 only when asked (payload size).

## 6. R-M — multi-type request and R-5 annual

**R-M** (`api.py` + `export.py`): request model accepts `types` (§1.2); `run_export_by_types` builds `Horoscope` once
(and `get_horoscope_information()` once, cached on the object) and runs each builder under its own try/except. Timeout
budget: 25 s per call; the server splits lists that would exceed it. Server task S-3 makes `ensureChartData` coalesce misses
into one call.

**R-5** (`year` required):

| Type | Source | Extra in payload |
|---|---|---|
| `annual.varsha` | `tajaka.annual_chart(jd_at_dob, place, dcf, years)` | `valid_to` = next varsha pravesh instant |
| `annual.tithi_pravesha` | `vratha.tithi_pravesha(...)` then the chart for that instant | `valid_to` |
| `annual.mudda` | `mudda.mudda_dhasa_bhukthi` | R-6 node shape |
| `annual.patyayini` | `patyayini.patyayini_dhasa` | R-6 node shape |
| `annual.sahams` | `transit/saham.py` | `{saham: longitude}` |

`year` means the solar-return year (doc 21 §2). Server task S-4: birthday refresh job.

## 7. Server tasks that go with the Radha phases

| # | Task | With |
|---|---|---|
| S-1 | `syncChartCatalog`: call `catalog`, update `chart_data_types.served/calc_version` (daily + after each Radha deploy) | R-3 |
| S-2 | Readers for the R-6 dasha shape in the dossier builder and legacy chat services | R-6 |
| S-3 | `ensureChartData` coalesces misses into one multi-type call | R-M |
| S-4 | Birthday refresh of annual rows | R-5 |
| S-5 | Kundli queue fetches the 18 registration items in `sort_order` through `ensureChartData` (replaces the 10 fixed columns) | R-3 + M7 applied |
| S-6 | Remove the 1.1 s client spacing when coordinates are sent; raise per-user concurrency to 3-4 (doc 21 Q5) | R-3 |

## 8. Tests, deploy and rollback

- `pytest src/jhora/tests` must pass before every merge; each phase adds its own golden fixtures for the G1 birth
  (`AIAstra_Server/evals/fixtures/G1/`) and uses `pvr_tests.py` expected values where they exist.
- Per-type timing is logged (`export.log`) and recorded in the phase's QA row; budget 1.5 s per single type on a warm
  Lambda, 10 s for an 18-type multi call.
- Deploy: Radha's `.github/workflows/deploy-lambda.yml` (build image → ECR → `update-function-code`). Add the same
  "publish version + `previous` alias" step the server workflow got, so a bad Radha deploy rolls back in a minute.
  `ENGINE_COMMIT` is set from `GITHUB_SHA` at build. The deploy session runs it after Sachin approves.
- After each deploy: run S-1 (catalog sync), then one `ensureChartData` for a test kundli per new type.

## 9. Open items

1. Which specialist dashas to build at all (R-4b batches) — decide from what the reading method and astrologer users ask for.
2. Payload size of three-level dashas for 120-year systems; may need `params.from`/`params.to` date windows.
3. Whether `facts` stays a Radha type or becomes a server-side assembly of rows (doc 21 §3 recommends assembly).
