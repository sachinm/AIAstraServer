# 70 Phase 1. The clock rows on the test kundli (2026-11-10)

Run of `scripts/clock-rows-check.ts` on kundli `c584c0a3-841b-451b-a2ed-f5709c5fb31d` (test data), as of 2026-11-10,
against the staging database. No model call, no cache endpoint. Database size before the run: 544 MB (`kundli_data`
79 MB, two `pressure_inventory` rows).

## Answer first

- **The clock set resolves as doc 70 §4.1 says:** Vimshottari, Narayana, the Tithi Pravesha year, Dwisaptati Sama
  (the conditional clock the engine says applies; also the spine), Yogini. Chara is cut by the limit of five.
- **Only one of the four clocks could be read.** The engine is reached by a private Lambda invoke, and this machine has
  no AWS credentials that may invoke it. The three pulls (Vimshottari, Narayana, Yogini) failed with "Could not load
  credentials from any providers" after about 2 s each. The loader stored each failure as a `failed` row, so
  **no build or sync will pull those three clocks for this kundli until 2026-11-11 12:44 UTC** (the 24 h retry wait).
  Filed in `docs/TODOS.md`.
- **The Tithi Pravesha year rows inside the pressure inventory are bounded.** All 7 year rows run 353 to 384 days and
  all 54 year sub-period rows fall inside their year. The 108-year problem of the P0 does not show in these rows. It
  still shows in the separate `annual.tithi_pravesha_dasha` row (the build reports "TP2026 year dasha is a lifetime
  dasha"), so the P0 stays open.
- **Sign-dasha clocks (Narayana, Chara) were not checked.** No row came back (credentials). Open.
- **Why `system=kaala` is `failed`:** its error column reads `validation_error: Invalid export type: pressure_inventory`,
  written 2026-11-10 00:38 UTC, before the engine that serves this export was live (the Dwisaptati row was pulled at
  05:03 UTC with calc version 2). Kaala is no longer a selectable clock for this kundli ("preferred kaala is not
  selectable; read on dwisatpathi"), so nothing will ask for it again. Nothing to fix in the engine.

## Per clock

| Clock | Status | Rows | By kind and level | Payload | Checks |
|---|---|---|---|---|---|
| Vimshottari | failed (pull) | 0 | none | 0 | not run: no AWS credentials here |
| Narayana | failed (pull) | 0 | none | 0 | sign dasha not checked |
| Tithi Pravesha year | rides in every inventory | 61 (in the Dwisaptati row) | year 7, year sub-period 54 | (inside) | years 353 to 384 days; 0 sub-periods outside their year |
| Dwisaptati Sama (spine) | ready, stored (pulled 05:03 UTC, calc 2) | 152 | dasha L1 2, L2 6, L3 44; transit 38; annual L1 7, L2 54; return 1 | 82,530 bytes of JSON | 52 dasha rows, all with houses and polarity: presses 46, mixed 6, supports 0 |
| Yogini | failed (pull) | 0 | none | 0 | not run |
| Chara | not in the set (limit) | | | | |

Notes on the numbers:

- The payload is 82.5 KB as JSON text; doc 70 and `docs/TODOS.md` said about 21 KB, which is likely the stored size
  after the database's own compression. Four rows per kundli is about 330 KB of JSON before compression.
- The window is 2023-11-10 to 2029-11-10 (three years back, three ahead, three levels), as the server asks.
- The inventory carries no `sade_sati` and no `station` rows for this kundli and window. The year frame's Saturn line
  is therefore empty. Not checked whether that is right for this chart.
- No Dwisaptati period row has `supports`. Whether the engine's polarity can be `supports` for a dasha row at all is
  not known; filed for the engine harness.

## The year frame from the stored rows (code only)

Spine Dwisaptati Sama; year 2026-10-16 to 2027-10-04; clocks read: Dwisaptati Sama and the Tithi Pravesha year;
Vimshottari, Narayana and Yogini skipped ("no stored tone").

| Span | From | To | Place | Spine tone | Per clock | Agree |
|---|---|---|---|---|---|---|
| s1 | 2026-09-20 | 2027-06-04 | now | heavy | Dwisaptati heavy, year heavy | 2 of 2 |
| s2 | 2027-06-04 | 2027-07-25 | next | mixed | Dwisaptati mixed, year heavy | 1 of 2 |
| s3 | 2027-07-25 | 2027-12-27 | later | heavy | Dwisaptati heavy, year heavy | 2 of 2 |

With two clocks the frame is below `READING_CLOCKS_MIN` (3): a build today reports the gap "only 2 clock(s) read". The
frame will list five clocks once the three pulls succeed from somewhere that can invoke the engine (the staging
Lambda: the sync worker or a build, after 2026-11-11 12:44 UTC).

## What is still to do for Phase 1

1. Pull the three clocks from a place that can invoke the engine (the deployed server after this branch ships, or a
   run with credentials that may invoke the engine Lambda), then re-run `scripts/clock-rows-check.ts` and fill the
   sign-dasha check and the five-clock frame here.
2. The engine harness (doc 70 step 2) for sign-dasha rows and the `supports` polarity of dasha rows.
