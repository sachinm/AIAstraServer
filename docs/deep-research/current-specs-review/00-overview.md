# 00 — Current specs review: overview

Done 2026-11-18. It inventories what AI AdAstra specifies, stores and computes for astrological techniques, so it can
be set beside the classical-text research in `docs/deep-research/` (`dashas-nakshatra`, `dashas-rasi-jaimini`,
`jaimini-apparatus`, `dasha-results`, `dashas-other-and-annual`, `natal-techniques`, `transits`,
`tajika-prashna-muhurta`). It is read-only: no code, branch, database or deploy was touched.

## What was inventoried and where it lives

| File | Covers | Main sources |
|---|---|---|
| `01-technique-spec-inventory.md` | Every file under `docs/techniques/**`: README, volumes 01-06, and the 45 per-technique specs in `general/`, `self/`, `love/`, `work/`, `lucky/` | `docs/techniques/`; checked against `src/techniques/catalog.ts` |
| `02-stored-technique-contracts.md` | The "specified database": tables and columns, the kundli digest (six sections) and activation calendar, the 142-row technique catalogue with selectors and contracts, chart-type serving, discrepancies | docs 53-85; `prisma/schema.prisma`, `prisma/migrations/**`, `src/techniques/*`, `src/reading/digest/*`, `src/reading/chartData/catalog.ts`, `src/services/chartCatalogSync.ts` |
| `03-engine-exports.md` | What the engine computes and serves: 43 dasha systems and their levels, 23 vargas, strengths, ashtakavarga, yogas, Jaimini, Tajika/annual, transits, prashna, panchang/muhurta; what pyjhora has but the engine does not serve; 19 engine issues | `AIAstra_Radha` @ `origin/release-candidate-staging` `b902bea` (read with `git show`; the local engine checkout is 35 files behind) |
| `04-reading-engine-technique-usage.md` | How docs 11, 26, 43, 46, 47, 53, 55, 56, 67, 69, 70, 72, 76, 78 say techniques are chosen and combined, and which dasha systems each board relies on | `docs/reading-engine/` |
| `05-findings.md` | 25 places where Node computes astrology, 18 spec/data contradictions, 10 engine gaps, missing pieces | all of the above |

## The shape of the system in one paragraph

The engine (Python, pyjhora vendored and patched) computes everything and serves typed JSON. The server pulls the
types listed as served in `chart_data_types` into `kundli_data`, digests them once per kundli into `kundli_digest`
(sections house, planet, yoga, point, annual, star) and `kundli_activation` (every period of every stored dasha
system, levels 1-3 for life, 4-6 in a window around today), and stores the shared transit sky with a per-kundli
overlay. Techniques are rows in `src/techniques/catalog.ts` (seeded to `technique_registry` at boot) whose `contract`
says which digest sections they read and whose `selectors` say when the chat's clarify step or a board picks them.
Boards vote across dasha "families" or "clocks" (seven families in docs 43/46; five clocks in doc 70: Vimshottari,
Narayana, Tithi Pravesha year, the applicable conditional dasha, Yogini, with Chara as sixth), validate each vote in
D1 plus the owning varga (D10 work, D9 marriage, D7, D30 …), and add slow-planet transits and the annual chart.

## Key observations

1. **Specs describe a future state as present.** The `general/` and `self/` specs say "built (Priority #2 enhancement
   ready)" and list declared charts the code does not declare (vimsopaka, harsha, bhava bala, Sudarshana). None of the
   doc 80/81 Priority #2 items is implemented. Treat those blocks as plans (01 S1-S2).
2. **The catalogue cannot say "not built".** All 142 rows are `built`; governance columns are never seeded, so every
   technique reads `verified` (02 §3.3, 05 B6). Three specs describe techniques absent from the catalogue.
3. **The annual layer is hollow.** The digest sets year lord, muntha and Tajaka yogas only on Varshaphal D1 rows, so
   Tithi Pravesha rows never have a year lord, and `annual.tajaka` is not in the annual pull set (whether
   registration pulls it was not checked live); the TP year dasha rows span 108 years (open P0), and the specs use one name for two different year lords
   (05 B1-B3).
4. **Node still computes astrology in about 25 places** outside the digest folder, where the guard test does not look:
   fortune tier, vargottama and neecha bhanga, conjunctions by sign, house classes, karaka identity, rasi-dasha lords,
   activated houses, muhurta groups and tables (05 §A). About half are already filed in `docs/TODOS.md`.
5. **The engine serves more than the server reads, and less than the specs need.** It exports 43 dasha systems to
   4-6 levels, bhava/vimsopaka/harsha bala and transit ashtakavarga, which the digest ignores; but it serves no vedha,
   Sudarshana, Varsha Narayana, divisional dashas, Karakamsha lagna, compatibility or event muhurta, which specs depend
   on (03 §11-12, 05 §C-D).
6. **Dasha levels:** the "2 levels" memory note is stale; the server asks for 3 lifelong, the engine defaults to 4,
   deep levels to 6 (rasi 5, Kalachakra 1), and levels 3-6 are an engine proportional split, verified only for
   Vimshottari (03 §3.1, 05 C2).

## What was not done

- No live query of Render Postgres (`technique_registry`, `chart_data_types`) or AWS; the repo files settled what is
  stored by code, but staff edits to `served`, `enabled` or `verification_status` are unknown.
- No findings were filed in `docs/TODOS.md` (by instruction); 05 is the list to file.
