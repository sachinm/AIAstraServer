# 21 — Review of the Radha data-provider plan (doc 20)

Status: **review, planning only**. Written 2026-10-25 for Sachin. Nothing here is built; no code, schema or Radha file was
touched. Reviewed against doc 20, docs 02/09/11/14/16/19, the server (`src/lib/astroKundliClient.ts`,
`src/services/kundliQueueService.ts`, `src/reading/llm/promptCache.ts`) and the Radha fork at `develop` f1b57c4
(`src/jhora/export.py`, `api.py`, `horoscope/main.py`, `horoscope/dhasa/**`, `horoscope/chart/**`, `transit/tajaka.py`,
`panchanga/vratha.py`).

Short verdict: the plan is right in shape (vertical store, one fetch path, agents never touch Radha). Five things need
tightening before R-3/R-4 start: (1) the registration tier is twice as large as the first readings use; (2) the "throttle"
we are planning around is our own code on both ends and not the real limit; (3) `facts` (doc 09) and the per-item rows
(doc 20) describe the same data twice; (4) the dasha JSON has concrete bugs that the new builders must not copy;
(5) the timeline multiplies the call count by ~5 and is the actual reason for a bulk request.

---

## 1. Answers to the §11 questions

### Q1 — Registration tier: fetch what the first readings read, nothing else

**Recommendation.** Registration fetches exactly the set the `facts` dossier (doc 09) and the specialists (docs 02/11)
read on the first question — **18 items**, in this order so chat can start after the first six:

| Order | Items | Why this early |
|---|---|---|
| 1–6 | `biodata`, `d1`, `d9`, `dasha.vimsottari`, `arudhas`, `karaka.chara` | L1 promise + L2 timing for every subject; chat can open after these |
| 7–11 | `d10`, `d2`, `d4`, `d7`, `ashtakavarga` | the subject vargas of the six most-asked subjects (career, wealth, property, children) and the L3 ashtakavarga check |
| 12–18 | `dasha.narayana`, `strength.shadbala`, `yogas`, `d12`, `d30`, `d60`, `d3` | L4 confirmation; the remaining vargas doc 09 lists as the default `facts` set |

Everything else in doc 20 §6 moves to on-demand: D16/D20/D24/D27/D40/D45 (doc 02 marks these "when added"; no subject frame
uses them yet), Yogini, Chara, Kalachakra, Ashtottari (see Q2), bhava bala, vimsopaka, sphutas, doshas, and **this year's
varsha + tithi pravesh** (the `annual` agent is phase 4 in doc 11 §6 and "skipped if export missing" — fetching it for every
new user today stores data nobody reads).

**Reason.** Doc 20 §6 proposes ~32 calls. At the current serial spacing (`KUNDLI_QUEUE_MAX_FETCHES_PER_USER` default 1,
`ASTROKUNDLI_REQUEST_SPACING_FLOOR_MS` 1100) that is 35+ s before the person's kundli is "complete"; 18 ordered items make
the first readable state arrive in ~7 s and the full set in ~20 s, with no loss, because the on-demand path (R-2) exists
precisely so that a missing D20 costs one round trip the first time a spirituality question comes in. Keep the `tier`
column, but treat it as "priority order", not a hard boundary: `tier` ∈ {`first`, `registration`, `on_demand`} with
`sort_order` deciding the queue.

### Q2 — Conditional dashas: fetch on applicability only, and move Ashtottari out of Core

**Recommendation.** Fetch a conditional dasha only when `horoscope/dhasa/graha/applicability.py: applicability_check`
returns it, through a new cheap Radha type `dasha.applicable` (returns the list; one call, cached as a natal item). Then
`ensureChartData` requests just those. Do not fetch any of them at registration.

Two corrections to doc 20 §3.1:

- **Ashtottari is itself conditional**: `ashtottari.applicability_check` requires Rahu in a kendra/trikona from the Lagna
  lord and not in Lagna. It belongs in the conditional row, not in Core. Core becomes: Vimsottari, Narayana, Yogini, Chara,
  Kalachakra (and only Vimsottari + Narayana are read by the method in docs 02/11 today; Yogini/Chara/Kalachakra are
  there for the astrologer-grade answers, so they can also be on-demand).
- **`applicability_check` covers 7 of the 9**: ashtottari, chaturaaseeti_sama, dwadasottari, dwisatpathi, panchottari,
  satabdika, shashtisama. **Shodasottari and Shattrimsa Sama are a `TODO` in the file** (day/night birth and paksha/hora
  rules). Either implement those two checks in the Radha pass (small, well-defined rules) or leave the two dashas as
  on-demand-by-explicit-request only. Doc 20 lists all eight as if the check exists.

**Reason.** The method (doc 11 L2) uses Vimsottari MD/AD/PD and Narayana/Chara for the sign layer. The conditional dashas
are classical "use only if…" systems; fetching them for everyone stores tables that are wrong to read for most charts, and
an LLM given a Shodasottari table will use it. Gating on applicability keeps the data honest and saves ~8 calls per person.

### Q3 — Ayanamsa: Lahiri only, keep the column, fix the default trap

**Recommendation.** Store Lahiri only. Keep `ayanamsa` in the key (cheap, and it makes a later KP/True Chitra experiment a
new row instead of a migration), but every reader hard-codes `'LAHIRI'` for now. In the Radha pass, change the API default
`ayanamsa: str = "TRUE_LAHIRI"` (`api.py` request model) to `"LAHIRI"`: today the server always sends `LAHIRI`, but any
call that omits the field silently uses True Chitra, and doc 09 already measured ±4-day Vimsottari shifts between the two.

**Reason.** Three places disagree today: `const._DEFAULT_AYANAMSA_MODE = 'LAHIRI'`, the API default `TRUE_LAHIRI`
(= `swe.SIDM_TRUE_CITRA`), and the server's `'LAHIRI'`. Also several library functions take `ayanamsa_mode` with their own
default (`strength.shad_bala`, `patyayini_dhasa`, every `sphuta.*`) and `drik.set_ayanamsa_mode` is global `swe` state, so a
mixed-ayanamsa request would compute parts of one payload under different ayanamsas. One ayanamsa everywhere is the only
safe setting until those defaults are threaded through.

### Q4 — LLM cache idle limit: 30 minutes sliding is right; sweeper every hour, not three

**Recommendation.** Create with 30 min TTL, extend to now+30 min on every use, delete on logout, **sweep every 45 minutes (changed from hourly by Sachin, 2026-10-26)**. Only
specialists on Gemini 3.x get an explicit cache (doc 05: Gemini 4 Argon does not support `cachedContents`), and only once the
key is on paid billing.

**Reason.** The economics: a 30 k-token dossier prefix costs ≈ $0.015 per hour to keep (doc 05) and about $0.009 to
re-create (one uncached input pass). Break-even is ~35–40 idle minutes, so anything beyond 30–45 min of idling costs more
than re-creating it. For the ~3 k prefix doc 19 describes, storage is ≈ $0.0015/h and the whole question is moot — the
cache exists for latency, not cost. The 3-hour sweeper in doc 20 §8 is too slow to matter (the TTL already kills an idle
cache in 30 min); its job is reconciling orphans (instances that died before writing the registry row), and an hourly run
keeps the orphan window short. People who "chat on and off" are covered by the sliding extension: as long as their gaps
are under 30 min the cache lives; longer gaps re-create it at a cost below one specialist call.

### Q5 — Throttle: neither; the throttle is ours on both ends. Fix the compute shape first, split later

**Recommendation.** Do not "raise Radha's throttle for our key" and do not start with the bulk/live split. Instead:

1. Server side: pass `lat/lon/tz` (already stored on `kundlis` since M1) and drop the 1.1 s spacing for those calls — the
   spacing exists for Nominatim, which is skipped when coordinates are sent (the comment in `astroKundliClient.ts` says so).
   Set `KUNDLI_QUEUE_MAX_FETCHES_PER_USER` to 3–4.
2. Radha side: the 1 s/client check (`export.py: _enforce_export_api_rate_limit`) is an in-process dict keyed on the client
   label; the server invokes Radha with a synthetic API-Gateway event whose `sourceIp` is `127.0.0.1`, and a Lambda
   instance handles one request at a time. So the check only ever fires for two back-to-back calls landing on the same warm
   instance within 1 s. It protects nothing in our deployment; whitelist the server's user-agent / API key and leave the
   limit for anonymous callers.
3. Then add the **multi-type request** (§3 below). That is what actually cuts time: every call rebuilds `Horoscope`
   (`__init__` runs the full panchanga via `get_calendar_information`), and `biodata`/`d1` additionally call
   `get_horoscope_information()`, which computes every varga, every special lagna, sphutas and arudhas for all of them.
   Eighteen calls = eighteen full rebuilds.
4. The bulk/live split (R-9) stays as the lever for **timeline backfills** (§5), where one person costs 100+ items. Reserved
   concurrency on `live` is the right tool there; it is not needed for registration volume.

**Reason.** The real constraint is Lambda concurrency × per-call compute, not a counter. Removing the self-imposed spacing
and letting 3–4 calls run in parallel gives a ~4× speed-up with zero Radha changes; the multi-type request gives another
large factor by sharing the `Horoscope` build.

---

## 2. The vertical store (`chart_data_types` + `kundli_data`)

The design is sound: one row per (kundli, type, variant), TOAST handles the big payloads, the catalog is editable data.
Points to tighten:

1. **Key names.** Use one dotted scheme everywhere and seed the catalog from Radha's `catalog` type, never by hand:
   `varga.d1 … varga.d144`, `dasha.vimsottari`, `dasha.narayana`, `strength.shadbala`, `strength.bhava`, `karaka.chara`,
   `arudhas`, `ashtakavarga`, `yogas`, `annual.varsha`, `annual.tithi_pravesha`, `annual.mudda`, `annual.sahams`,
   `panchanga.birth` (= today's `biodata`). Keep `radha_type` as the wire name so the key can stay stable if Radha renames.
2. **Variant needs a schema, not a free string.** Three kinds exist: natal (`''`), year (`'2027'` — and define it: the
   *solar-return year*, i.e. the year the varsha pravesh falls in, not the calendar year the person asked in), and
   parameterised (`chart_method` for vargas, `chara_method` for Chara dasha, `antardhasa_option` for graha dashas, level depth
   for dasha trees). Put the parameters in a `params jsonb` column and derive `variant` as a canonical hash of
   `{year?, params}`; store the defaults used (e.g. `{"chart_method":1}`) explicitly so a later default change in Radha does
   not silently alias two different computations under `''`.
3. **`engine_commit` staleness is too blunt.** Most Radha commits change nothing numerically; invalidating every row per deploy
   means a full re-fetch of every user on every release. Have the `catalog` type return a **per-type `calc_version`**
   (bumped by hand in Radha when a type's numbers change) and store it per row; `ensureChartData` treats a row as stale
   when `calc_version` differs, never on `engine_commit` alone. Keep `engine_commit` for forensics.
4. **`status = fetching` needs an owner and a deadline.** Add `fetch_started_at` and a lease; single-flight across Lambda
   instances cannot rely on in-process locks, so the row is the lock (insert `fetching` with a unique key, lose the race →
   wait/poll). Rows stuck in `fetching` longer than the Radha timeout (60 s) are reclaimable.
5. **`valid_to` for annual rows** should be the next varsha pravesh instant, which Radha knows (`tajaka.annual_chart` for
   `years+1`) — return it in the payload so the server does not compute dates.
6. **Backfill from `kundlis` columns is only a stop-gap.** Today's `d1`/`d9` payloads are placement rows for the Charts
   page; the dossier (`facts.v1`) needs per-planet records with house, nakshatra, dignity, lords, relations. The backfilled
   rows should be tagged `calc_version = 'legacy'` so they get re-fetched once R-3/R-4 land, and the two payload shapes must
   not be mixed under the same key (see §3, point 2).
7. **One per-user size check**: ~60 natal rows at 5–50 KB each ≈ 1–2 MB per person, plus 36 × 4 annual rows for timeline
   users. Fine for Render Postgres; just do not `SELECT *` the person — `ensureChartData` reads by key list only.

## 3. One item per call vs. a multi-type request

Keep **one item per call as the agent-facing contract** (`getChartData(types[])` → `ensureChartData`), exactly as Sachin
wants, but let `ensureChartData` **coalesce its misses into one Radha request** when more than one item is missing for the
same kundli and the same variant parameters. On the wire: `type` keeps accepting a string; it also accepts a list, and the
response becomes `{results: {type: {data} | {error}}}` per type. Radha builds `Horoscope` once and runs each builder.

Why this is worth doing early (not "only if (1)–(3) are not enough" as doc 20 §6 says):

- `Horoscope.__init__` runs the full panchanga, and `get_horoscope_information()` (used by `biodata` and `d1`) computes
  everything for every varga. Eighteen registration calls are eighteen rebuilds of the same object; one build serves all.
- The timeline (§5) needs 100+ items per person; without coalescing it is 100+ cold builds.
- Nothing in storage changes: the coalesced response is still written as N rows.
- The `facts` type in doc 09 *is* a multi-type request already (one call, many sections). Deciding this now avoids two
  different bulk mechanisms.

**Reconcile doc 09 and doc 20** (the duplicate-data problem): doc 09 makes `facts` a Radha type that returns the dossier and
the server stores it (R-8 keeps it); doc 20 stores the same sections as separate rows. Pick one representation per section:
Radha returns **sections** (the per-item payloads), the server stores them as rows, and the dossier builder
(`src/reading/data/factsBuilder.ts`) **assembles** `facts.v1` from rows. `facts` then becomes a server-side view, not a
Radha type, and the per-item payloads are defined to carry what the facts schema needs (planet records with house,
nakshatra, dignity; lords; relations). `transits` stays a Radha type (it is per date range, not per natal item).

## 4. The Radha Python change list (§7) checked against the code

| §7 item | Exists in pyjhora? | Notes / effort |
|---|---|---|
| 1. All 23 vargas via one mapping | Yes — `charts.divisional_chart` handles every factor; `main.py: get_horoscope_information_for_chart(chart_index, divisional_chart_factor)` works generically | **But** `export.py: _chart_key_prefix` only maps factors 2/4/7/9/10 to their resource-string keys; the generalisation must use `main.py`'s `dhasavarga_dict` (factor → key) instead of a hand-written table. Each factor also has `chart_method` variants (`const.varga_option_dict`, e.g. D60 has 4) — record `chart_method` in `params`. Small. |
| 2. One JSON builder per dasha, third level | Partly — every dasha module has a `get_dhasa_bhukthi`/`get_dhasa_antardhasa`, but **they return two levels**. `_vimsottari_antara` exists for level 3 but `get_vimsottari_dhasa_bhukthi` never calls it; other dashas have no level-3 function | Non-trivial: a generic level-3 walker per dasha family (graha dashas share the proportional rule; rasi dashas split equally) plus end dates (see §6). Budget this as its own sub-phase of R-4. |
| 3. Strengths / yogas / arudhas / sphutas / ashtakavarga | Yes — `strength.shad_bala(jd, place, ayanamsa_mode)`, `bhava_bala(jd, place)`, `pancha_vargeeya_bala`, `dwadhasa_vargeeya_bala`, `harsha_bala`, `planet_aspect_relationship_table`; `yoga.get_yoga_details(jd, place, dcf, language)`; `raja_yoga.*`; `dosha.*`; `arudhas.bhava_arudhas_from_planet_positions` / `graha_arudhas_…`; 20+ `sphuta.*`; `ashtakavarga.get_ashtaka_varga` + sodhana | `_build_ashtakavarga` in `export.py` outputs text after both sodhanas; the JSON should return raw BAV, SAV **and** the reduced tables, because doc 11 L3 reads raw BAV bindus (≥ 4) and SAV (≥ 28 / ≤ 22). Yoga output is language-resource strings — return the yoga *ids* plus the English name. Medium. |
| 4. Annual items with `year` | Yes — `tajaka.annual_chart(jd_at_dob, place, dcf, years)`; `vratha.tithi_pravesha(birth_date, birth_time, place, year_number)`; `mudda.mudda_dhasa_bhukthi(jd, place, years)`; `patyayini.patyayini_dhasa(jd_years, place)` | `Horoscope.__init__` already takes `years/months/sixty_hours/pravesha_type`, so the annual chart can reuse the same object. **Missing from doc 20: sahams** (`transit/saham.py`, 36 functions) and Tajaka yogas (`transit/tajaka_yoga.py`) — doc 11 L5 reads sahams. Add `annual.sahams`. `tithi_pravesha` returns the date/time; the chart for that instant is a second step. Medium. |
| 5. `facts` / `transits` (doc 09) | Stand-in exists in `docs/reading-engine/drafts/radha/` | Per §3 above, `facts` should become a server-side assembly of rows; `transits` stays a Radha type. The `transits` natal overlay is the biggest single piece of new Python (the draft has it). |
| 6. `catalog` type | No | Trivial; add `calc_version` per type (see §2.3) and the list of accepted `params` per type. |
| 7. Golden tests per type | pyjhora has `tests/pvr_tests.py` (JHora-printout comparisons for many dashas) | Reuse those expected values as fixtures; add one fixture per export type for the G1 chart already in `evals/fixtures/G1/`. |

Also missing from §7: **`dasha.applicable`** (wraps `applicability_check`, Q2), and the request-model change (`ExportType`
becomes a list validated against the catalog rather than a hard-coded `Literal`).

## 5. Data needs of the 36-year timeline (doc 14)

Per person, TL0–TL4 need: Vimsottari to **PD level across 36 years** (level 3 — does not exist yet, §4.2), Narayana AD, the
natal overlay transits for **±18 years** (doc 09's `transits` takes `from/to`, so one call per year or one long call), and
for TL4 **36 tithi pravesha charts + 36 Mudda dashas** (+ sahams if read). That is roughly 1 + 1 + 18–36 + 72–108 ≈
**100–150 items per person**, versus 18 for registration. Consequences:

- This, not registration, is the case for the multi-type request (§3) and the `bulk` Lambda (R-9).
- The global part is only the raw ephemeris (sign/nakshatra ingress dates) — that belongs in `transit_snapshots`; the
  **overlay** (houses from Lagna/Moon/AL, `over_natal`, double transits, sade sati) is per person and per year, so store it as
  `transit.overlay` rows with `variant = year`, not in the global table. Doc 20 §3.3 ("recompute per request, keep a day at
  most") is right for chat horizons (≤ 3 y) and wrong for the timeline (36 years, computed once).
- Timeline rows should be fetched only when the person opens the timeline (or opts in), never at registration.

## 6. Dasha sub-period bugs found in the code (for R-6)

Confirmed from `export.py` and the dasha modules:

1. **Narayana: first bhukti of every mahadasha is mislabelled.** `_build_narayana_dasa_json` starts each maha with
   `{"lord": maha, ...}` and drops the real `bhukti` of that row. For Narayana the first antardasha sign is the *stronger of
   the dasha sign's lord's house and its 7th* (`_narayana_antardhasa`), not the dasha sign itself, so the label is wrong for
   most mahadashas. The same code in `_build_vimsottari_dasa_json` happens to be right only because Vimsottari's first bhukti
   lord equals the maha lord under the default `antardhasa_option=1`; it breaks for options 2–6 and the rasi-bhukthi
   variation. Fix: use `bhukti` for the first row too.
2. **Mixed date formats.** `get_vimsottari_dhasa_bhukthi` returns `'YYYY-MM-DD ' + utils.to_dms(h)` strings (a 12-hour
   `HH:MM:SS AM/PM` time, with a `' (+1)'` next-day suffix when the hour rolls over), so the export's `isinstance(start_date,
   float)` branch never runs and the JSON `start_date`/`maha_start_date` carry the display time. Narayana is truncated to
   `[:10]`. Consumers get two formats for two dashas. Fix: emit ISO date and a separate ISO time (or `jd`) in every dasha.
3. **No end dates and no durations.** The tree only has start dates; the end of the last bhukti of the last maha is unknown,
   and the consumer has to infer every end from the next start. Doc 09 asks for contiguous rows with `from/to`. Fix: include
   `end_date` and `duration_years` per node.
4. **Tribhagi option corrupts the process.** `get_vimsottari_dhasa_bhukthi(use_tribhagi_variation=True)` multiplies the
   module-level `vimsottari_dict` and `human_life_span_for_vimsottari_dhasa` in place and never restores them; in a warm
   Lambda every later Vimsottari call is wrong. Not reachable from today's export, but it will be the moment dasha options
   are exposed. Fix: compute on a copy.
5. **First mahadasha starts before birth.** `vimsottari_mahadasa` lists 9 mahas from the dasha start (birth minus elapsed),
   so row 0's `maha_start_date` precedes the DOB and its early bhuktis never ran. Not a bug in itself, but the JSON should
   mark the balance (`horo._vimsottari_balance` is computed and discarded) and the consumer must clip to DOB.
6. **Ayanamsa default mismatch** (Q3): API default `TRUE_LAHIRI` vs server `LAHIRI`; any direct caller omitting the field gets
   dasha boundaries shifted by days.

Still to check in R-6 against JHora's printout: the `(+1)` day roll-over in `to_dms` around midnight births, and
`_where_occurs` using strict `<` (a bhukti starting exactly at the query instant is attributed to the previous one).

## 7. Risk list

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | Two shapes for the same data (`facts` dossier vs per-item rows) drift apart; the dossier builder and the Charts page disagree | High / high | §3: Radha returns sections, server assembles `facts`; one payload shape per key, `calc_version = 'legacy'` on backfilled rows |
| 2 | `engine_commit` invalidation causes a full re-fetch of every user on every Radha deploy | High / medium | §2.3 per-type `calc_version` |
| 3 | Level-3 dashas and end dates do not exist in pyjhora; R-4 is bigger than "one builder per family" | High / medium | Budget a sub-phase; ship 2 levels + end dates first, PD level for Vimsottari only (that is all doc 11 reads), the rest later |
| 4 | New dasha builders copy the first-bhukti and date-format bugs | Medium / high | R-6 before R-4, or make R-4 use one shared tree builder that R-6 fixes once |
| 5 | Conditional dashas fetched for everyone and read by the LLM where they do not apply | Medium / high | Q2 gating; two applicability checks still to implement |
| 6 | Ayanamsa mixed inside one payload via library-function defaults | Low / high | Q3: Lahiri only; thread `ayanamsa_mode` or assert the global mode in the builders |
| 7 | Single-flight on `kundli_data` done in-process; two Lambda instances fetch the same item | Medium / low | §2.4 row-as-lock with lease |
| 8 | Timeline backfills (100–150 items/person) starve chat-time fetches | Medium (when TL ships) / high | Multi-type request first; R-9 `bulk`/`live` split with reserved concurrency on `live` |
| 9 | Explicit LLM cache spend with no visibility while billing is new | Low / medium | §8.5 of doc 20 (spend per day) before turning `READING_EXPLICIT_CACHE=1` on; hourly sweeper |
| 10 | `transit_snapshots` is used for per-person overlay rows and grows per user | Medium / medium | §5: overlay rows live in `kundli_data` keyed by year; the global table keeps only ephemeris |
| 11 | Radha's `_export_global_lock` serialises everything in a process; a multi-type request holds it for the whole batch | Low (Lambda = one request per instance) / low | Fine on Lambda; note it if Radha ever runs as a multi-worker server |

## 8. Proposed edits to doc 20 (doc 20 left unedited; apply these)

1. §3.1 dashas: move **Ashtottari** from Core to Conditional; note that `applicability_check` covers 7 of 9 and that
   Shodasottari / Shattrimsa Sama checks are a `TODO` in pyjhora.
2. §3.1: add `dasha.applicable` (the applicability list) as a natal item; add a note that pyjhora returns **two** dasha levels
   and that level 3 + end dates are new work.
3. §3.1 strengths table: say the ashtakavarga JSON returns raw BAV/SAV **and** the sodhana-reduced tables; yoga payload =
   ids + English names.
4. §3.2 annual: add **sahams** (`transit/saham.py`) and Tajaka yogas; define the annual `variant` as the solar-return year.
5. §3.3: split "moving" into *global ephemeris* (`transit_snapshots`) and *per-person overlay* (`kundli_data`,
   `transit.overlay@<year>`, stored for the timeline, short-lived for chat).
6. §4 schema: add `params jsonb`, `calc_version text`, `fetch_started_at timestamptz`; define `variant` as the canonical hash
   of `{year?, params}`; drop "rebuild when the engine changes" in favour of per-type `calc_version`.
7. §4 migration path: tag backfilled rows `calc_version = 'legacy'` and schedule their re-fetch after R-3/R-4.
8. §5: `ensureChartData` coalesces misses for one kundli into one multi-type Radha request; single-flight is the row lock,
   not an in-process map.
9. §6 table: registration = the 18 ordered items of Q1 (~18 calls); annual items leave registration; add a "timeline
   opt-in" row with 100–150 items.
10. §6 options: replace (2) "raise the throttle" with "remove the server's Nominatim spacing when `lat/lon/tz` are sent,
    raise `KUNDLI_QUEUE_MAX_FETCHES_PER_USER`, whitelist the server in Radha"; promote (4) multi-type request to the
    first Radha change; keep (3) bulk/live for timeline volume.
11. §7: add `dasha.applicable`, `annual.sahams`, the `calc_version`-bearing `catalog`, the `ExportType` → catalog-validated
    list, and the API default `ayanamsa = "LAHIRI"`; note that `_chart_key_prefix` must use `main.py`'s factor→key dict.
12. §7.5 / §10 R-8: `facts` becomes a server-side assembly from rows; only `transits` remains a Radha type.
13. §8: sweeper every 45 minutes; explicit cache applies to Gemini 3.x specialists only (not Argon).
14. §9: list the timeline's actual item counts (§5 here) and that overlay rows are per person per year.
15. §10: order **R-6 before R-4** (or make R-4 depend on a shared tree builder fixed in R-6); split R-4 into R-4a (two-level
    dashas + end dates, strengths, ashtakavarga, yogas, arudhas) and R-4b (level 3, sphutas, doshas, specialist dashas).
16. §11: record the five decisions above as decided.
