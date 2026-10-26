# 28 — Tithi Pravesh year dasha, transit for any moment, and prashna

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
  - (no `method` / `number`: decision 1 in §7, the prashna lagna is the rising sign at the moment);
  - `divisional_chart_factors`: defaults to `[1, 9]`;
  - optional natal fields, which add `natal_house` as transit does.
- Response:
  - the moment (`at_jd`, `at_local`);
  - panchanga at the moment: tithi, paksha, nakshatra with pada, yoga, karana, weekday and hora lord;
  - the rising sign at the moment (udaya lagna);
  - the **prashna lagna** (`prashna_lagna`): the rising sign at the moment, per varga (decision 1 in §7; the
    number-based `get_prasna_lagna_*` methods are not used);
  - for each requested varga, the planet rows with houses counted from the prashna lagna.
- `calc_version` "1", listed in `catalog` with its params.

**Tests (pytest):**
- **Tithi Ashtottari, G1, 2026 and 2027:** the year rule picks the right year, children are contiguous, and the output
  equals pyjhora's own function run on a `Horoscope` at the Tithi Pravesh instant.
- **Transit:** D1–D10 for a past and a future moment with no person. Each chart equals the single-factor call, and the
  `d1-d10` shorthand works.
- **Prashna:** the prashna lagna equals the ascendant at the moment in each requested varga. Panchanga fields are
  present.

## 4. Server work (schema and code), backwards from the Radha types

**Status: built** on `feature/doc27-server` (2026-10-26), with the §7 decisions applied. QA rows `R14-01`..`R14-07`.
The migration is written, not applied.

**Catalog and migration M14** (`prisma/migrations/20261026170000_reading_m14_prashna`; timestamped after M13 so the
folders stay in order):
- `chart_data_types` row for `prashna` (family `prashna`, change class `moving`, tier `on_demand`, served false until
  the catalog sync). `family` has no CHECK constraint, so the new value needs no constraint change.
- An updated label for `annual.tithi_pravesha_dasha`, which is now stored per year **and** system, under the variant
  `year=2027;system=tithi_ashtottari`. Older `year=<y>` rows are left alone; a `current` pointer naming one is
  re-fetched.
- A new table `prashna_casts`. A prashna belongs to a question, so it is stored with the question for
  reproducibility, not per person. Columns: `id, user_id (fk auth, cascade), reading_run_id (nullable, no fk: the cast
  can precede its run row), asked_at, place_resolved, lat, lon, tz, place_source ('current' | 'birth'), calc_version,
  payload jsonb, created_at`. Index on `(user_id, asked_at)`. No `method`/`number` (decision 1). lat/lon/tz are null
  when only the birth place text could be sent.
- Written, not applied, until Sachin approves.

**Code:**
- `catalog.ts`: `prashna`; `annual.tithi_pravesha_dasha` carries the fixed option `system=tithi_ashtottari`, so its key
  is `annual.tithi_pravesha_dasha@2027` (default system) or `annual.tithi_pravesha_dasha@2027;system=mudda`. Radha gets
  the system inside `params` and the year top-level. The year is never a required input: `ensureAnnualCurrent` sends
  only `at` = today and stores under Radha's `year_used`.
- `transit.ts`: `fetchTransit(kundliId | null, { at, divisionalChartFactors: [..] | 'd1-d10', place?, withNatal? })`.
  With a `place` no kundli is read and no birth data is sent (natal fields only with `withNatal`).
- `place.ts`: `parseClientPlace` (lat/lon range-checked, `tz` in hours or an IANA zone read at the moment, rounded to
  two decimals) and `roundCoord`.
- `prashna.ts`: `castPrashna({ userId, at?, place?, runId?, divisionalChartFactors?, withNatal? })` resolves the place,
  makes one Radha call through the shared client (spacing respected), stores a `prashna_casts` row with raw SQL and
  returns the payload. A missing table is logged once and the payload is still returned.
- Registration pull: same code path; because the catalog entry carries `system`, the full pull fetches
  `annual.tithi_pravesha_dasha` with `params.system = tithi_ashtottari` for the year that applies today.
- Routes: `POST /api/chat/ask-stream` and `POST /api/chat/confirm-stream` accept optional `lat`, `lon`, `tz`, parsed
  with `parseClientPlace` and kept on the intent as `questionPlace` (rounded) for the prashna specialist (step 3).

**Where the question place comes from:** neither the server nor the web had browser-geolocation or IP-location code.
The only existing capture is `user_current_location` (M13): the city as typed plus the browser IANA timezone, with
`lat/lon` always null (no geocoding), so it cannot place a chart. The client therefore sends `lat/lon/tz` on the ask /
confirm routes when it has them (web step 4: an optional browser location prompt); otherwise the kundli's stored birth
coordinates are used, and failing those the birth place text. Coordinates are rounded to two decimals (about 1 km)
before they are sent or stored.

## 5. Reading engine use

**Status: built** on `feature/annual-prashna-specialists` (2026-10-26), step 3 of §6. QA rows `R28-01`..`R28-08`.
Code: `src/reading/graph.ts`, `src/reading/layers/{loaders,sections}.ts`, `src/reading/nodes/{specialists,convergence,reconcile}.ts`,
`src/reading/clarify/{machine,planner,service}.ts`, prompts `annual.md`, `prashna.md` and the `transit_at` paragraph in
`transit.md` / `v2/transit.md`. Tests: `tests/unit/reading/annualPrashna.test.ts`. Nothing on AWS or the database was
touched; live use waits on R-27a/b/c, the catalog sync (`served` for `annual.*`, `transit`, `prashna`) and M14.

As built:
- **Annual (L5, weight 1).** Optional node, one per run on the first subject, when the horizon ends within about 12
  months (`annualApplies`: 12 months plus one of slack). It reads `annual.tithi_pravesha` and
  `annual.tithi_pravesha_dasha` (system `tithi_ashtottari`) through `ensureAnnualCurrent`; the pack gains an `annual`
  section (year chart bodies with Radha's houses, occupants, the running year period and the periods in the horizon).
  Same findings shape, `layer: 'annual'`. Unserved or missing data: stage `skipped`, reason `no_data`. L5 counts in the
  score only (doc 19); it does not move the tier.
- **Prashna (L6, weight 1).** `prashnaRule` in the clarify machine marks a confirmed question eligible (yes/no,
  "should I", "will X happen", "is now a good time"); timing, meaning, definition, speculation and health questions are
  not, and any declined topic (deny, decline or role-gated, whatever the role) never is. Descriptive questions that only
  say "now" are `unsure` and go to the optional model planner (`judgePrashna`), else stay not eligible. The intent
  carries `prashna: { eligible, askedAt }` with the confirmation moment. The graph casts once with `castPrashna` at that
  moment at `intent.questionPlace`, else the birth place, and the `prashna` node reads the prashna lagna and its lord,
  the Moon, the house of the matter (occupants; sign and lord only when an occupant shows the sign, nothing derived)
  and the panchanga. The gate is re-checked in the graph on the question text.
- **The prashna never decides alone** (`prashnaNudge` in convergence): with a natal layer (L1–L4) of the same sign it
  moves the tier one step; alone it moves toward *mixed* and stops there (not indicated → mixed; strong → moderate →
  mixed); L1 ≤ −2 still wins; the missing-layer cap applies after it. The VERDICT line names the nudge.
- **Transit at the asked date.** When the horizon is an explicit window starting after today, the transit specialist
  also reads `fetchTransit` with `divisionalChartFactors: [1, 9, 10]` and the natal houses at noon of the window's first
  day (`transit_at` section); without data it runs on the horizon rows as before.
- **Stage events:** optional nodes send `retried: false`, `capped: false` on `done` and `skipped` (with `reason`).
  Annual, prashna and dated-transit findings are not written to the findings cache (their data is not in the dossier
  hash).
- **Design calls:** prashna eligibility is set on the clarify confirm path only (a READY question read straight from
  ask-stream gets no prashna); a prashna-eligible question skips the single-call fast lane so the graph can cast it;
  the sign → lord pairs used for the lagna lord come from the person's own dossier
  (Radha's pairing), not a Node table.

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

## 7. Decisions (Sachin, 2026-10-26)

1. **Prashna number:** no user-picked number. The prashna lagna is the rising sign at the question moment only;
   `method` and `number` are dropped from the Radha request (R-27c) and from `prashna_casts`.
2. **Question place:** the person's current location, falling back to the birth place. No existing geolocation or
   IP-location code was found (server or web), so the client sends `lat/lon/tz` on the ask / confirm routes and the
   server falls back to the kundli's stored coordinates. Coordinates are rounded to two decimals before sending or
   storing.
3. **Year dasha:** Tithi Ashtottari is the default system. The Tithi Pravesh year is never a required input: Radha
   derives it from today (its year rule), and Tithi Ashtottari follows the same rule.
