# 09 — What the pyjhora Lambda must serve (contract for the later Radha pass)

**Decision (Sachin, 2026-10-24):** nothing astrological is computed in Node. The pyjhora Lambda (`aiastra-pyjhora`) returns every chart,
divisional chart, dasha, strength, nakshatra fact and every transit chart. The Python service is **not touched yet**; this file is the
brief for the later, surgical pass. The server already consumes exactly this contract, validates it, and degrades gracefully while it is missing
(`READING_ENGINE=1` falls back to the legacy chat path when no dossier exists).

## Same endpoint, two new `type` values

`POST /api/export-horoscope` (HTTP) or the synthetic API Gateway v2 invoke the server already uses. Envelope unchanged: `{ "type", "data" }`.
Legacy types (`biodata`, `d1` … `narayana_dasa`) stay for the Charts page.

| type | Request fields | Response `data` | Schema | Budget |
|---|---|---|---|---|
| `facts` | `dob`, `tob`, `lat`+`lon`+`tz` (preferred) or `place`, `ayanamsa` (server sends `LAHIRI`), optional `as_of` (default today), optional `vargas` (default `D1,D2,D3,D4,D7,D9,D10,D12,D30,D60`) | the dossier | `src/reading/schema/facts.v1.schema.json` | ≤ 3 s warm on 2048 MB |
| `transits` | the same birth fields, plus `scope: "natal"`, `from`, `to` (the server asks today → +24 months), `as_of` | the natal-overlay transit chart | `src/reading/schema/transits.v1.schema.json` | ≤ 3 s warm |

Return the resolved `lat`/`lon`/`tz`/place inside `data.birth` when `place` was used, so the server stores them once on the kundli and never geocodes
again (the server then sends `lat`+`lon`+`tz`, which also lets it skip its own request throttle).

## `facts` — the dossier

Full field list and meaning: [03-chart-facts-dossier.md §2](./03-chart-facts-dossier.md). The server is strict about the fields in the schema
(planet records with house, nakshatra, dignity; 12 houses with lords and occupants; `vargas` D1, D9, D10 required, others optional; chara karakas;
arudhas A1–A12 + AL + UL; `ashtakavarga` SAV and BAV; `dasha.vimshottari` current + mahadashas + periods; `narayana`; `nakshatra_profile` with all 27 taras;
`relations`). Extra fields are welcome and ignored.

Rules the engine must keep:

- Whole-sign houses from Lagna. Longitudes in decimal degrees, signs 0–11, houses 1–12, dates ISO.
- **One ayanamsa across everything**, echoed in `engine.ayanamsa`. The server requests `LAHIRI`; the Charts page, the legacy chat context and the dossier
  must agree. (The stand-in fixtures showed Vimshottari boundaries moving by ±4 days between `LAHIRI` and `TRUE_CITRA`; JHora's own printout sits between them.)
  Compute the Vimshottari dates from the same Moon longitude as the placements (the stand-in does, and does not call pyjhora's separate dasha routine).
- `dasha.vimshottari.periods`: pratyantardasha (`level: "pd"`) rows for `as_of − 1y … as_of + 3y`, antardasha (`level: "ad"`) rows elsewhere, sorted, contiguous.
  The server re-selects the *running* period for today from these rows, so a dossier built last month still answers correctly; when today leaves the PD window it
  queues a rebuild (`dasha.vimshottari.window`).
- Dignity for Rahu/Ketu: classical (Rahu exalted Taurus, debilitated Scorpio). pyjhora's table reuses Ketu's row for Rahu; the stand-in corrects it.
- Combustion/retrograde from `drik` speeds, not from elongation tables.
- Shadbala, ishta/kashta, bhava (Sripati) and `near_cusp` flags are in the stand-in; the server passes shadbala through when present.

## `transits` — the natal overlay (per kundli)

The server never joins transits with natal points. The engine returns each transit period already placed against the natal chart:

```jsonc
{ "v": 1, "kind": "natal_overlay", "ayanamsa": "LAHIRI", "as_of": "2026-10-24", "from": "2026-10-24", "to": "2028-10-24",
  "natal": { "lagna_sign": 5, "moon_sign": 6, "al_sign": 9, "moon_nak": "Swati" },
  "now": { "Sa": { "sign": 11, "sign_name": "Pisces", "house_from_lagna": 7, "house_from_moon": 6, "house_from_al": 3, "over_natal": [], "from": "...", "to": "..." } },
  "rows": [ { "planet": "Ke", "from": "2026-12-06", "to": "2028-06-23", "sign": 3, "sign_name": "Cancer", "retro_on_entry": true,
              "house_from_lagna": 11, "house_from_moon": 10, "house_from_al": 7, "over_natal": [], "influences_houses": [11, 5],
              "sav": 27, "bav": 3, "nak_segments": [ { "from": "...", "to": "...", "nak": "Ashlesha", "over_natal_nak": [] } ] } ],
  "double_transit": [ { "from": "...", "to": "...", "houses": [7], "jupiter_sign": 3, "saturn_sign": 11 } ],
  "sade_sati": { "now": null, "periods": [ { "from": "...", "to": "...", "phase": "sade_sati_peak", "saturn_sign": 6, "house_from_moon": 1 } ] },
  "stations": [ { "planet": "Sa", "kind": "retro_start", "date": "...", "sign": 11, "nak": "..." } ],
  "lunations": [ { "kind": "new", "date": "...", "sign": 6, "sign_name": "Libra", "nak": "Swati" } ] }
```

- One row per **sign dwell** of each planet (Su, Ma, Me, Ju, Ve, Sa, Ra, Ke); slow planets carry `nak_segments` (nakshatra ingress dates, with the natal planets that share the nakshatra).
- `over_natal` lists natal bodies in the transited sign (`La` included); `influences_houses` is occupancy plus graha drishti (house numbers from natal Lagna).
- `double_transit` windows: Jupiter and Saturn both influence the same natal house; Sade Sati phases from Saturn's house from the natal Moon (12, 1, 2) plus 4 and 8 (dhaiyya).
- Dates are local calendar dates for the birth timezone; ingress instants bisected to the minute.
- The golden example is `evals/fixtures/G1/transits.v1.json`. "Ketu over my Jupiter" must show up as the row `Ke_2028-06-24` with `over_natal: ["Ju"]` (Ketu is in Leo until 2026-12-05).

## Acceptance for the Python pass

1. `facts` and `transits` for the golden chart match `evals/fixtures/G1/*.json` within the tolerances in the parked tests
   (`drafts/radha/tests/test_facts_golden.py`: longitudes 0.02°, Vimshottari ±7 days against JHora's printout).
2. Both payloads validate against the two schemas in this repo (`npm test -- tests/unit/reading/schema.test.ts` with the new fixtures swapped in).
3. Warm call under 3 s on the 2048 MB Lambda; property tests from file 03 §5 pass (every house has one lord; `houses_of` is the inverse of `lord_of`; dasha periods contiguous).
4. Then flip nothing: the server picks the data up on the next kundli sync or `npm run facts:backfill`.

## Parked stand-in code (reference, not shipped)

`docs/reading-engine/drafts/radha/` holds a working implementation of `facts` (`facts.py`), `transits` (`transits.py`), the natal overlay (`transit_chart.py`),
their tests, and `make_g1_fixtures.py` which regenerates the fixtures against Radha's source without modifying it. It is a starting point for the surgical pass,
not a finished review: look at `export.py` wiring, the request model (`ExportType`) and the Lambda handler when you port it.
