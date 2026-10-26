# 27 — Tithi Pravesh year dasha, transit for any moment, and prashna

Status: plan, 2026-10-26. Builds on [20](20-radha-data-provider.md), [22](22-radha-build-plan.md) and
[23](23-radha-full-dataset.md). Written end goal first, then the ingredients, then the work backwards from there.

## 1. End goal

When someone asks a question, the reading can lean on three more independent views, all computed by Radha:

1. **This year (Tithi Pravesh).** The Tithi Pravesh chart for the year that applies today, and the dasha for that
   year, including **Tithi Ashtottari** run from the Tithi Pravesh moment. "This year" questions are then read from the
   year chart as well as the natal chart.
2. **The sky at a moment (transit).** D1 through D10 for any date, time and place, past or future, with no person
   needed. When a person is given, it also says where each transiting planet falls in their chart.
3. **The question itself (prashna).** A chart cast for the moment and place the question is asked, with the prashna
   lagna. A "will this happen, should I act now" question then gets a horary check alongside the natal reading. It is
   one more vote in convergence, never the only one.

## 2. Ingredients

| Ingredient | Where it comes from | Exists today? |
|---|---|---|
| Tithi Pravesh instant for a year | `vratha.tithi_pravesha(...)` | yes, `annual.tithi_pravesha` |
| Year rule (before the birthday uses the prior year) | `annual_export.py` | yes (`year_used`, `rule`) |
| Mudda and Patyayini on the Tithi Pravesh chart | `mudda`, `patyayini` | yes, `annual.tithi_pravesha_dasha` |
| **Tithi Ashtottari for that year** | `dhasa/graha/tithi_ashtottari.py` run on a `Horoscope` built at the Tithi Pravesh instant (what the desktop app does when Tithi Pravesha is selected) | **no** |
| Transit for a moment, one varga | `transit_export.run_transit` (`at`, place, `divisional_chart_factor`) | yes, `transit` |
| **Transit D1–D10 in one call, no person** | the same, looped over factors on one Julian day | **no** (one factor per call) |
| Transit contacts with natal degrees | `transit_contacts` | yes (27dbc55) |
| Chart at the question moment | `charts.divisional_chart(jd, place, ...)` | yes (same as transit) |
| **Prashna lagna by number** | `utils.get_prasna_lagna_KP_249_for_*`, `get_prasna_lagna_108_for_*`, `get_prasna_lagna_nadi_for_*`, `const.prasna_kp_249_dict` | functions exist, **not exported** |
| **Panchanga at the question moment** (tithi, nakshatra, yoga, karana, weekday, hora lord) | `panchanga/drik.py` | functions exist, **not exported** for a free moment |
| Where the question is asked | the user's current location (browser) or, failing that, their birth place | **not captured** |

## 3. Radha (FastAPI) work, backwards from the goal

All of this is in Radha; Node computes nothing.

**R-27a: `annual.tithi_pravesha_dasha` gains a `system` option.**
- `params.system` is one of `tithi_ashtottari`, `mudda`, `patyayini`, default `tithi_ashtottari`.
- Tithi Ashtottari: build a `Horoscope` at the Tithi Pravesh instant for `year_used`, then run the
  `tithi_ashtottari` module's own dasha function on it. Two levels, R-6 node shape. The year window is
  `valid_from`/`valid_to`; periods outside it are kept and marked.
- `params_used` echoes `system`. `calc_version` becomes "2" because the shape gains a `system` field.
- The response keeps `year_used`, `rule`, `rule_basis`, `valid_from`, `valid_to`.

**R-27b: `transit` takes several vargas and no person.**
- New optional `divisional_chart_factors` (a list such as `[1,2,3,4,5,6,7,8,9,10]`, or the shorthand `"d1-d10"`),
  not allowed together with `divisional_chart_factor`. One Julian day, one loop. The response is
  `charts: {"d1": {...}, "d2": {...}}`.
- Birth fields are not required for `transit` (already true). Natal fields stay optional and add `natal_house`.

**R-27c: new type `prashna`.**
- Request:
  - `at`: the question moment, defaulting to now at the place;
  - the place, as `lat/lon/tz` or `place`;
  - `method`: one of `moment`, `kp_249`, `number_108`, `nadi`;
  - `number`: required unless `method=moment`;
  - `divisional_chart_factors`: defaults to `[1, 9]`;
  - optional natal fields, which add `natal_house` as transit does.
- Response:
  - the moment (`at_jd`, `at_local`);
  - panchanga at the moment: tithi, paksha, nakshatra with pada, yoga, karana, weekday and hora lord;
  - the rising sign at the moment (udaya lagna);
  - the **prashna lagna** for the method and number, from pyjhora's `get_prasna_lagna_*` functions, per varga;
  - for each requested varga, the planet rows with houses counted from the prashna lagna.

  The KP method also returns the number's star, sub and sub-sub lords from `const.prasna_kp_249_dict`.
- `calc_version` "1", listed in `catalog` with its params.

**Tests (pytest):**
- **Tithi Ashtottari, G1, 2026 and 2027:** the year rule picks the right year, children are contiguous, and the output
  equals pyjhora's own function run on a `Horoscope` at the Tithi Pravesh instant.
- **Transit:** D1–D10 for a past and a future moment with no person. Each chart equals the single-factor call, and the
  `d1-d10` shorthand works.
- **Prashna:** each method returns the lagna pyjhora's utils give for the same number, and `moment` uses the
  ascendant. `number` is range-checked (1–249, 1–108, and the nadi range from pyjhora). Panchanga fields are present.

## 4. Server work (schema and code), backwards from the Radha types

**Catalog and migration M14** (`prisma/migrations/2026102617xxxx_reading_m14_prashna_types`):
- `chart_data_types` rows for `prashna` (family `prashna`, change class `moving`, tier `on_demand`).
- An updated label for `annual.tithi_pravesha_dasha`, which is now stored per year **and** system, under the variant
  `year=2027;system=tithi_ashtottari`.
- A new table `prashna_casts`. A prashna belongs to a question, so it is stored with the question for
  reproducibility, not per person. Columns: `id, user_id, reading_run_id (nullable), asked_at, place_resolved, lat,
  lon, tz, method, number, calc_version, payload jsonb, created_at`. Index on `(user_id, asked_at)`.
- Written, not applied, until Sachin approves.

**Code:**
- `catalog.ts`: add `prashna`, and the variant key for the annual dasha with `system`.
- `transit.ts`: `fetchTransit` accepts `divisionalChartFactors`, and needs no kundli when no natal overlay is asked for.
- New `src/reading/chartData/prashna.ts`: `castPrashna({ userId, at, place, method, number, runId })` makes one Radha
  call (spacing respected), stores the row in `prashna_casts` and returns the payload.
- Registration pull: also fetches `annual.tithi_pravesha_dasha` with `system=tithi_ashtottari` for the current year.

**Where the question place comes from:** the web asks the browser for location once, and it is optional. If it is
refused or unavailable, the birth place is used and the reading says so. The place sent is rounded to two decimals
(about 1 km) for privacy.

## 5. Reading engine use

- **This-year questions** (timing within 12 months): the annual specialist reads the Tithi Pravesh chart and its
  Tithi Ashtottari period as a confirmation layer (weight 1 in convergence, doc 19).
- **"Right now" and yes-or-no questions:** the clarify agent marks the question `prashna_eligible`. The graph casts the
  prashna at the moment of the confirmed question and adds a `prashna` specialist, an optional node time-boxed like
  nakshatra. Its verdict is one vote: it can raise or lower confidence but never decides alone.
- **Transit:** for date-specific questions, the transit specialist fetches D1, D9 and D10 at the asked date instead of
  today.
- **Declined topics stay declined:** no prashna is cast for a declined or role-gated question.

## 6. Order of work

1. R-27a, R-27b and R-27c in Radha, in parallel worktrees, each in its own module with a small hook in `export.py`.
2. Server: catalog, M14 (written only), multi-varga `fetchTransit` and `castPrashna`, in parallel with step 1. The
   wire names are fixed in this doc.
3. Reading engine: the annual and prashna specialists, after steps 1 and 2 merge.
4. Web: an optional location prompt on the chat page.
5. Deploy through the deploy session: Radha, then the server, then M14 with approval, then the catalog sync.

## 7. Open questions for Sachin

1. Prashna number: should the user be asked to pick a number (1–249 KP or 1–108), or do we use only the moment's
   ascendant?
2. Is it OK to ask for browser location for prashna, or should we always use the birth place?
3. Default system for the year dasha: Tithi Ashtottari (this plan) or Mudda?
