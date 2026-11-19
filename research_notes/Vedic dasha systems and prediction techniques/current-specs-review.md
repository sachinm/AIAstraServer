# Working notes: current specs review (2026-11-18)

Output: `docs/deep-research/current-specs-review/00-05`.

- Server checkout `feat/self-foundation-server` @ `280ac27` (shared; no branch switch). Engine read from
  `origin/release-candidate-staging` @ `b902bea` via `git show` (local engine HEAD detached at `0c11037`, behind).
- Work split: 03 (engine) and 02 (stored contracts) drafted by background sub-agents; the 02 agent hit a rate limit
  mid-table, and §3.3-6 were finished by hand. A third sub-agent scanned `src/**` for Node astrology (feeds 05 §A).
- Catalogue: 142 rows, all `built` (you 55, love 25, work 23, chat 18, lucky 17, timeline 4). Seeded from code at boot;
  `enabled`/`verification_status` never seeded.
- `served` flags: code default false for most on-demand types; live value set by `chartCatalogSync.ts` from the engine
  catalogue. Specs quoting "served: false in catalog.ts:197" cite the code default, not live state.
- Digest natal types (`build.ts:1337`) exclude strength.bhava/vimsopaka/harsha and transit AV.
- Annual: `yearLord`/`muntha`/`tajakaYogas` only from `annual.tajaka` on VP D1, which `annualSet.ts` never pulls.
- Clocks: doc 70 order in `env.ts:859-872` (vimsottari, narayana, tithi_pravesha, conditional, yogini, chara; 5 of them).
- Doc 43/46: seven dasha families; votes count only when D1 and owning varga agree.
- Doc 72 transit natal_house bug appears fixed in engine `b902bea` (`transit_export.py:286`).
- Guard test `noAstrologyInNode.test.ts` scans only `src/reading/digest/`.
- Not done: live DB/AWS checks; TODOS filing (left to the final writer).
