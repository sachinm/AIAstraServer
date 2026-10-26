# G1 catalogue exports (life timeline P1)

Real Radha output for the G1 golden chart (2002-04-27 17:05, lat 28.9167, lon 77.0167, tz +5.5, LAHIRI), produced
2026-10-26 by calling Radha's own exporter locally (`jhora.export.run_export_by_type`, AIAstra_Radha `develop` at d15a4cf)
with default params. Nothing was edited by hand.

| File | Catalogue type | Params |
|---|---|---|
| `dasha.vimsottari.json` | `dasha.vimsottari` | levels 2 (MD, AD) |
| `dasha.yogini.json` | `dasha.yogini` | levels 2 |
| `dasha.tithi_ashtottari.json` | `dasha.tithi_ashtottari` | levels 2 |
| `dasha.ashtottari.json` | `dasha.ashtottari` | levels 2 |
| `dasha.narayana.json` | `dasha.narayana` | levels 2 (sign MD, sign AD) |
| `dasha.applicable.json` | `dasha.applicable` | — |
| `transit_contacts.2008-10-01_2018-08-10.json` | `transit_contacts` (moving) | from/to as named, orb 2, Sa Ju Ra Ke |
| `transit_contacts.2018-08-11_2026-10-31.json` | `transit_contacts` (moving) | from/to as named, orb 2, Sa Ju Ra Ke |

Read by `fixtureInputs` in `src/reading/timeline/inputs.ts`. The ledger next door (`../ledger.made-up.v1.json`) is
invented for the tests and is not real data.
