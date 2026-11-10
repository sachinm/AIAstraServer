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

## Second run: kundli `75b0d618` on deployed staging (2026-11-10, 19:35 UTC)

Branch `feat/self-v3` shipped to staging (server `37a5209`). A sync event for kundli
`75b0d618-90b7-4db6-bff8-cc7bb0ed561f` (test data) ran on the deployed worker, which pulled the four clocks in one
pass. `scripts/clock-rows-check.ts --kundli 75b0d618` then read the stored rows from a laptop (no engine call, no
model call, storage dry).

### Answer first

- **Five clocks are read.** Set: Vimshottari, Narayana, the Tithi Pravesha year, Chathuraaseethi Sama (the conditional
  clock that applies to this chart; also the spine), Yogini. Chara is cut by the limit of five. The year frame lists
  all five with a tone per span; `degraded` is false.
- **Narayana (a sign dasha) rows are usable.** 107 period rows at levels 1 to 3, every one with houses and a polarity
  (presses 83, mixed 17, supports 7). The open sign-dasha check from the first run is closed for Narayana. Chara is
  still unchecked (never pulled).
- **A period row can be `supports`.** Vimshottari 5 of 45, Narayana 7 of 107, Chathuraaseethi 4 of 32, Yogini 18 of
  191. The question from the first run (Dwisaptati had none) is answered.
- **The Tithi Pravesha year rows are sound on a second kundli and in every inventory.** 7 year rows of 354 to 384 days,
  56 sub-period rows, none outside its year, identical in all four inventories.
- **The four rows total 422 KB of JSON for one kundli**, not the roughly 84 KB doc 70 assumed. 102 of each
  inventory's rows (38 transit, 63 year, 1 return) are the same in all four.
- **Every clock leans heavy.** 81% of all period rows are `presses`. Vimshottari and Yogini read heavy in all five
  spans; the year in four. See "What this means for Phase 2" below.

### Per clock

| Clock | Rows | Period rows (L1 / L2 / L3) | Polarity of period rows | Payload |
|---|---|---|---|---|
| Vimshottari | 147 | 45 (1 / 6 / 38) | presses 38, mixed 2, supports 5 | 78,092 bytes |
| Narayana | 209 | 107 (2 / 9 / 96) | presses 83, mixed 17, supports 7 | 116,062 bytes |
| Tithi Pravesha year | 63 in every inventory | year 7, sub-period 56 | (not counted here) | (inside) |
| Chathuraaseethi Sama (spine) | 134 | 32 (1 / 5 / 26) | presses 25, mixed 3, supports 4 | 73,258 bytes |
| Yogini | 293 | 191 (4 / 22 / 165) | presses 156, mixed 17, supports 18 | 155,008 bytes |
| Chara | not pulled (limit) | | | |

Every inventory: window 2023-11-10 to 2029-11-10, calc version 2, 38 transit rows, 1 return row, no gaps reported by
the engine. Every period row in all four has houses and a polarity. No `sade_sati` or `station` row in any of them.

### The year frame (code only)

Spine Chathuraaseethi Sama; Tithi Pravesha year 2026-09-12 to 2027-09-01.

| Span | From | To | Place | Frame tone | Spine | Year | Vimshottari | Narayana | Yogini | Agree |
|---|---|---|---|---|---|---|---|---|---|---|
| s1 | 2026-10-27 | 2027-01-25 | now | heavy | heavy | heavy | heavy | mixed | heavy | 4 of 5 |
| s2 | 2027-01-25 | 2027-04-24 | next | light | light | heavy | heavy | heavy | heavy | 1 of 5 |
| s3 | 2027-04-24 | 2027-07-23 | later | heavy | heavy | mixed | heavy | heavy | heavy | 4 of 5 |
| s4 | 2027-07-23 | 2027-10-20 | later | mixed | mixed | heavy | heavy | heavy | heavy | 1 of 5 |
| s5 | 2027-10-20 | 2028-01-18 | later | heavy | heavy | heavy | heavy | light | heavy | 4 of 5 |

### What this means for Phase 2

1. **The frame's tone is the spine's tone even when it stands alone.** s2 is shown as light on one clock against four
   heavy; s4 as mixed on one against four. Under the Phase 2 count (`statusOf`) both spans come out confirmed heavy.
   Until the ledger is wired (Phase 3), a v3 build would tell this person the next three months are light on a 1 of 5
   reading. Filed.
2. **Agreement on "heavy" carries little information if clocks are heavy nearly always.** Vimshottari and Yogini are
   heavy in 5 of 5 spans here. Either the engine's polarity rule leans to `presses` (81% of period rows), or the
   server's row-to-tone step lets one pressing row make a span heavy. Three or more clocks agreeing would then be the
   normal case, not a confirmation. This must be settled before the ledger's "confirmed" is shown to anyone: check the
   engine's polarity rule in the harness, and check the tone step against strength. Filed as P1.
3. **Spans s4 and s5 run past the end of the Tithi Pravesha year** (2027-09-01). The year's tone for those spans comes
   from the TP2027 rows, which is right, but the frame's `year` field names only TP2026. Filed.
4. **Size.** 422 KB of JSON per kundli for four clocks, of which the shared rows are stored four times. The engine pass
   E1 (shared rows once) roughly halves it. Estimates in doc 70 §4 that rest on 21 KB per row need redoing.

### Still open for Phase 1

1. Chara rows have never been pulled or checked (it is sixth in the order).
2. Kundli `c584c0a3` still has three `failed` rows blocking its pulls until 2026-11-11 12:44 UTC.
3. The engine harness for the polarity rule (point 2 above).
