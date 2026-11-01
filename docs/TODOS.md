# TODOS: every finding, until it is fixed

The shared list for all agents and sessions on AI Astra (server, Radha, web). Rule in `AGENTS.md`: any error, bug or
finding you do not fix on the spot goes here, or in a named doc linked from here, before your session ends. Read this
file before starting work in an area. When an item ships, delete it and say where the fix went in the commit.

Each item says: what is wrong, where, how we know, who holds it now, what done means.
Priority: **P0** wrong readings or data; **P1** blocks or risks a release; **P2** real but can wait; **P3** nice to have.
Status: `open`, `in progress (<owner>)`, `blocked (<on what>)`.

Findings below were filed 2026-10-31. "Reported" means an agent read it and I have not verified it myself.
This file was recreated after the 2026-10-31 checkout loss; the deploy session's additions of that morning are to be
re-applied by it.

---

## P0: wrong readings or data

- **Main checkout wiped on 2026-10-31 08:17** by a `git worktree add` with an empty path (reported by the analysis
  session). `.git`, `.env`, `docs`, `evals`, `AGENTS.md`, `Dockerfile` and more deleted; unpushed local commits lost;
  `src`, `prisma`, `scripts`, `tests` survived. Rebuilt from a backup copy and GitHub by the deploy session. Status: in
  progress (deploy session). Done: `develop` rebuilt and pushed, every lost branch recreated, `.env` restored by Sachin,
  the worktree rule in AGENTS.md and CLAUDE.md.
- **Stored dossiers may not be Radha's.** `kundli_facts` (24 rows) and `transit_snapshots` (24 rows, built 2026-10-25) look
  like the local build (`scripts/backfill-local-facts.ts` plus `docs/reading-engine/drafts/radha/`), not the deployed
  Lambda. `src/reading/data/store.ts` and `src/reading/packs/transitTable.ts` read them, so the chat path depends on them.
  Lead on Sachin's wrong readings; not proven. Found by the deploy session. Status: in progress (reading-dev: comparison
  agent). Done: comparison report, types deployed, both tables rebuilt for every kundli.
- **Radha does not serve `facts` or `transits`.** `src/reading/data/factsBuilder.ts` and `engineClient.ts` ask for them;
  neither is in Radha's `export.py`. Status: in progress (reading-dev, Radha `feature/reading-p1`, files
  `facts_export.py`, `transits_export.py`). Done: real exports, deployed, with a real `engine_commit`.
- **The 2026-10-28 Sachin reading used that dossier.** Part of it rests on `facts.json`, and it derived varga dignities from
  a sign table on the reading side. Treat it as unconfirmed. Status: blocked (comparison). Done: differences listed in
  `side-session-notes/.../sachin/dossier-vs-radha-comparison.md` and the reading rewritten from Radha tables.
- **G1 golden fixture is a stand-in.** `evals/fixtures/G1/facts.v1.json` has `engine_commit: draft-stand-in`, so tests that
  agree with it prove little. Reported. Status: open. Done: regenerated from deployed Radha.
- **Node computes astrology.** Rule: "always Radha returns it". Status: in progress (reading-dev, branches
  `fix/timeline-houses-from-radha` (done, to be recreated after the loss) and `fix/node-astrology-to-radha` (agents
  writing)). Sites, reported by audit:
  - `src/reading/timeline/foundation.ts`: `houseFrom`, `houseOfSign` (removed on the branch)
  - `src/reading/layers/sections.ts`: `signLords` applies natal sign lords to prashna and tithi pravesha charts and drops
    co-lords, which can give wrong lords; `occupants` and the house sign taken from the first occupant
  - `src/reading/nodes/convergence.ts` ~160-196: fortune tier from Node tables for dignity, good houses, gochara
  - `src/reading/timeline/foundation.ts`: `ownsOf` gives Rahu and Ketu houses Radha does not (switching changes scores);
    `lordPlacement`
  - `src/reading/packs/selector.ts` `aggregateToAd`; `src/reading/timeline/dashas.ts` ~88 end dates;
    `src/reading/chartData/dashaShape.ts`; `src/reading/facts/current.ts`; `src/reading/timeline/activate/transits.ts`;
    `src/reading/timeline/activate/doubleTransit.ts`

- **Stored `kundli_facts` carry wrong values** (proved 2026-10-31 by the comparison in
  `sachin/dossier-vs-radha-comparison.md`): Rahu's D1 dignity (friend, should be enemy; six vargas wrong too),
  shadbala ranks (sorted on rupas, not the ratio: the Moon is the weakest planet, not Venus), ishta/kashta 0 for the
  Sun and Moon (not a real value, should be null), yogas for empty houses (Sunapha, Duradhara and others), doshas left
  out (Manglik from Venus and the Moon; G1's Ghata and Shrapit), and the kundlis' saved lat/lon truncated to whole
  arc-minutes by the backfill. Signs, houses, nakshatras, varga signs, arudhas, karakas, argala and dasha dates are
  right. Fix: clear the saved lat/lon/tz (database write, needs Sachin's OK), deploy Radha `facts`, then
  `npm run facts:backfill -- --force`. Status: blocked (Radha deploy).
- **pyjhora reports yogas for empty houses** (vesi, vosi, ubhayachara, sunapha, anapha, duradhara; `horoscope/chart/yoga.py`
  counts an empty house as occupied). Proved on two charts. The served `yogas` table has the same wrong rows; the other
  ~90 yogas need the same check. Status: in progress (reading-dev, Radha `feature/reading-p1`).
- **Served `dignities` gives Rahu Ketu's row** (`const.house_strengths_of_planets[7]`): Rahu reads debilitated in Taurus
  and exalted in Scorpio. Status: in progress (reading-dev).

- **Node supplies birth coordinates and timezone when none are stored.** `src/reading/chartData/store.ts`
  `resolveFallbackCoords` uses a hardcoded city table with one fixed offset per city (Folsom -8, so a summer birth is an
  hour off), or Nominatim with `tz = round(lon / 15)` outside India and Nepal, then writes the result to `kundlis.lat/lon/tz`
  and sends it to Radha for every later call. A wrong offset means a wrong chart. Found reading the code on 2026-11-01; which
  kundlis it hit is not checked. Status: open. Done: Radha resolves place and timezone for the birth date, this path is
  removed, and affected kundlis are found and rebuilt.

## P1: blocks or risks a release

- **Chart build reliability needs infra before it ships** (`docs/reading-engine/38` §10). Order: API key and doc 31 §5
  infra, then server, then web; the wrong order slows the gate or drops the profile gate. Status: open (deploy session,
  Sachin's OK). Done: §10's three steps applied and Phase 4's load check run.
- **`src/reading/chartData/registration.ts` is broken in the main checkout's uncommitted changes.** Line 1 starts with
  `b/**`, which does not compile, and the old plan function is kept as `_unusedRegistrationPlanLegacy`. Not from the chart
  build work; it was there at the start of the 2026-11-01 session. Status: open (whoever owns those uncommitted changes).
  Done: the stray `b` and the dead function are removed.

- **Release order for house counts.** With `fix/timeline-houses-from-radha` merged but `house_counts` not deployed, real
  kundlis build without Narayana (S4), without Narayana rows in S7, and with no 6/8/12 drop; the report's notes say so.
  `TIMELINE_ENABLED` is off by default. Order: deploy Radha, apply migration, catalog sync, fetch table per kundli.
- **Migration numbering.** `reading_m16_house_counts` (unapplied) shared the timestamp `20261031100000` with
  `transit_ephemeris_cache` (applied, keep it). `feat/catalog-radha-reading-types` adds M17. Renumber M16 and M17 after
  the applied one when the branches are recreated. Status: in progress (reading-dev).
- **All-kundlis override must run once, after the Radha deploy.** `store.ts:149` refetches `kundli_data` when calc_version
  differs, but this does not touch `kundli_facts` or `transit_snapshots`, which need their own rebuild. Status: blocked
  (Radha deploy). Owner of the run: deploy session.
- **Local memory.** Running `tsc` and vitest together ran out of memory and killed a test file. Run them separately:
  `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit`; `npx vitest run <area> --pool=forks --poolOptions.forks.singleFork`.
- **`.env` lost with the checkout.** Not in git or any worktree. Values live in Render (database) and the Lambda
  `aiastra-server-api` env config; Sachin restores the file. No values in this file.

- **`transit_snapshots` has no refresh command.** `transits:build` builds only when nothing is stored; the local rows
  cover lookups to about 2027-10-24. To refresh: delete the rows (database write) or raise `TRANSIT_SNAPSHOT_VERSION`,
  then run `transits:build`. Status: blocked (Radha `transits` deploy).
- **`facts` and `transits` now exist in Radha** (uncommitted, `feature/reading-p1`): LAHIRI only (pyjhora's Vimshottari
  start ignores the requested ayanamsa); yoga and dosha names changed ("Manglik Dosha"); `transits` returns all
  lunations (~50, was 13); the server must send `as_of`, `vargas`, `scope`, `from`, `to` as params; `chartCatalogSync`
  will list them as unknown. The server's "unsupported" check does not recognise the new 400 for other ayanamsas.

## P2: real, can wait

- **A worker re-run briefly closes chat on the web.** `processOneKundliRow` sets `queue_status = in_progress` on every run,
  and `ChatSection.tsx` opens only on `completed`, so a sweep or resume can show the overlay to a user whose chat was open.
  Status: open. Done: the page gates on `me.chart`, or re-runs of a completed row leave `queue_status` alone.
- **Tests that flake.** `ChatSection.location`, `SignIn`, `SignUp` and `LedgerSection` web tests and the server's `auth` and
  `registrationFullPull` tests hit the 5 s limit at random when the machine is busy, and pass with `--testTimeout=60000`.
  Running server tests with `--poolOptions.forks.singleFork` leaks env between files: `chatRouting` and `promptCache` fail
  that way and pass on their own. Status: open. Done: both suites green in one default run.
- **The "about 30 minutes" notice is out of date** once doc 38 ships (`AIAstra_WEB/src/Auth/readyNotice.ts`). Status: open.
  Done: reworded from the times Phase 4 measures.

- **`dasha.tara` fails for kundli de3223e3.** "module returned no periods", same on retry. pyjhora's `tara.py` seeds from planets
  in the kendras and returns nothing when there are none, which most likely explains it (chart not opened). Fix: return an
  empty, marked not-applicable result, not a server error. Status: open (reading-dev, on `feature/reading-p1`).
- **`transit_range` step=day** is confirmed live in the deployed catalog; the server's `transitRangeParams` does not pass
  `step`. The deploy session plans to use it for the shared daily store.
- **`annual.tithi_pravesha_dasha` stays at two levels.** Natal dashas now serve three; the year's dasha does not.
- **Timeline build hash.** `foundation.hash` is dossier-only, so `timeline_builds.dossier_hash` does not show whether a
  build had `house_counts`.
- **Arudha Lagna agreement.** The count now comes only from the table; nothing flags a table and dossier that disagree.
- **Legacy rows.** 80 `legacy` rows in `kundli_data` (10 types x 8 kundlis), which look like deactivated duplicates. Ids not checked.
- **Parked draft.** `docs/reading-engine/drafts/node-compute-parked/buildDossier.ts` still holds `houseFrom`. Delete once
  `facts` ships.
- **Worktrees to clean after merge.** `AIAstra_Server-timeline-houses`, `-node-astrology`, `-radha-types`,
  `AIAstra_Radha-reading-p1`. Their `.git` files point at the deleted `AIAstra_Server/.git/worktrees/`, so their git is
  broken; the file trees are intact and are the source for recreating the branches. The server ones hold a `node_modules`
  junction: `rmdir` it before removing the folder.
- **Radha repo logs.** `src/jhora/logs/` and `__pycache__` are untracked in Radha and not ignored.
- **Served `bhava` method 3 (Sripati)** treats house centres as starts: house 1's cusp 169.3 instead of 334.2, planets one
  house early (`drik._bhaava_madhya_new`).
- **biodata `vedic_weekday` is one day late for afternoon births** (Sachin: Wednesday, really Tuesday).
- **biodata `place` truncates coordinates to whole arc-minutes** (`export.py`), and `scripts/backfill-local-facts.ts` reads them back.
- **G1 transit fixture**: two nakshatra changes dated a day late; lunations stop at 2027-04; doc 09 says Ketu leaves Leo
  2026-12-05, Radha gives 2026-12-04.

## P3: nice to have

- pyjhora's Kemadruma and Sunapha checks count Rahu and Ketu, which classical rules exclude (decides G1's Kemadruma).
- pyjhora's neecha bhanga rule 1 checks the wrong sign and runs only on raja yoga pairs (`raja_yoga.py`).
- Served `dignities` and `benefic_malefic` use the stronger co-lord as `lord` (Ketu as 9th lord), which a Parashari reading misreads.
- Served `d1` shows "Indra Chapa" as Aries when it has no value.

## Planned work Sachin has asked for (not bugs)

- **Life reading model for Plans A, B, 3 and 4 (Sachin, 2026-10-31).** The dasha sequence is the same for everyone; only
  placements differ. So a planet's purpose comes from where it sits in the birth and divisional charts, and the running
  mahadasha, antardasha and sub-periods bring fulfilment, lack or delay. Read each planet: house, whose house, the
  dispositor and where it sits, every conjunction and drishti, and read from the other lagnas too (Indu, Hora and others).
  Fits doc 34's hierarchy; add the other-lagna readings to it.
- **Fable rewrite of the Sachin reading** from Radha tables after the deploy and re-pull.
- **Category flows (Sachin, 2026-10-31).** After that, specialised multi-agent flows per category, starting with romance,
  love and relationships, and finances (bank balance, financial luck, gains through career and business), then career,
  parents, legal. The Clarify agent detects the category, which triggers that flow, using stored kundli data or fetching
  what it needs from Radha. Not designed yet; builds on docs 33 and 34.
- **AGENTS.md and CLAUDE.md for the Radha and web repos** (pointer files), awaiting Sachin's yes.

- **Multi-School Data Requirements (`docs/ASK-REQUIREMENTS.md`, 2026-10-31).** Full specification of must-have Radha data
  points across **Parashara**, **Jaimini / Pt. Sanjay Rath**, **Lunar Astro / Deepanshu Giri**, and **Tajaka/Muhurta**
  required for deep readings: all 5 Avastha systems (`avasthas` — *Baladi, Jagradadi, Deeptadi, Lajjitadi, Shayanadi*),
  explicit combustion/cazimi/varga conjunction orbs, Level 3 (Pratyantardasha) & Level 4 (Sookshma) for the Top 9 primary
  dashas (`dwisatpathi`, `narayana`, `tithi_ashtottari`, `sudasa`, `yogini`, `vimshottari`, `chara`, `patyayini`,
  `tithi_pravesha_dasha`), pre-computed `argala_matrix` on Lagna/`AL`/`UL`/`HL`/`IL`, Special Lagnas exact degrees & Indu
  Lagna 16-kala breakdown, Lunar Astro `khara_navamsa_64`, `khara_drekkana_22`, `bhrigu_bindu`, and `dispositor_chains`,
  Annual chart vargas + Tajaka aspects (`Ithasala`/`Ishrafa`), and fast-planet (`Su, Mo, Me, Ve`) transit contacts + daily
  Ashtakavarga Kakshya bindus for 1-month/3-month bank-visibility timing. Status: open (reading-dev / Radha).

- **Shipped (2026-10-31 — Multi-School Past Life Reading & Radha Avasthas/Charter):**
  - `AIAstra_Radha` (`feature/reading-p1` → `develop` → `release-candidate-staging`, pushed to `origin`): added `pyserve/avasthas_export.py` (`avasthas`, `calc_version: "1"`, 5 Avastha systems + proximity audit + Lunar Astro `khara_navamsa_64`/`khara_drekkana_22`/`bhrigu_bindu`/`dispositor_chains`/`pending_karma` + `dasha_charter` 5-vector charter & 9×9 Antardasha fruition matrix) and `correspondences` in `pyserve/reading_tables_export.py`.
  - `AIAstra_Server` (`feat/past-comprehensive-life-reading` → `develop`): added `house_counts` (`M16`), `reading_tables`, `avasthas`, `avasthas.d9/d10/d16/d24`, Level-3 dashas (`dasha.<name>.l3`), per-varga `dignities.d*`, `aspects.d*`, `relations.d*` (`M17`), `ensurePastReadingData`, and profile-scoped 18-Year Past Life Reading Flow (`src/reading/timeline/pastReadingFlow.ts` + `/api/timeline/past-reading` routes).
  - `AIAstra_WEB` (`feat/profile-past-life-reading` → `develop`): added `PastLifeReadingSection` inside `ProfileSection.tsx` with interactive accuracy scorecard and feedback notes.
  - Documentation & Readings: `docs/TECHNIQUE.md` (+ `.docx`), `docs/ASK-REQUIREMENTS.md`, `docs/reading-engine/36-sachin-reading-2026-10-28-reader-edition-hindi.md` (+ `.docx`), and `docs/reading-engine/37-sachin-18yr-retrospective-2008-2026.md` (+ `.docx`).
