# TODOS: every finding, until it is fixed

The shared list for all agents and sessions on AI Astra (server, Radha, web). Rule in `AGENTS.md`: any error, bug or
finding you do not fix on the spot goes here, or in a named doc linked from here, before your session ends. Read this
file before starting work in an area. When an item ships, delete it and say where the fix went in the commit.

Each item says: what is wrong, where, how we know, who holds it now, what done means.
Priority: **P0** wrong readings or data; **P1** blocks or risks a release; **P2** real but can wait; **P3** nice to have.
Status: `open`, `in progress (<owner>)`, `blocked (<on what>)`.

Findings below were filed 2026-10-31. "Reported" means an agent read it and I have not verified it myself.
This file was recreated after the 2026-10-31 checkout loss, with every session's items re-applied.

---

## P0: wrong readings or data

- **Main checkout wiped on 2026-10-31 08:17** by a `git worktree add` with an empty path (reported by the analysis
  session). `.git`, `.env`, `docs`, `evals`, `AGENTS.md`, `Dockerfile` and more deleted; unpushed local commits lost;
  `src`, `prisma`, `scripts`, `tests` survived. `develop` was rebuilt from the surviving tree and GitHub as one commit, pushed, and the worktree rule added to
  AGENTS.md and CLAUDE.md. `.env` was rebuilt from the Lambda env. Status: in progress (reading-dev: recreate
  `fix/timeline-houses-from-radha`, `feat/catalog-radha-reading-types`, `fix/node-astrology-to-radha` from their file
  trees). Done: the three branches recreated and the stale worktree folders removed.
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

## P1: blocks or risks a release

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
- **`.env` rebuilt from the Lambda, not complete.** On 2026-10-31 it was written from `aiastra-server-api`'s env config
  (33 variables). Local-only values (`SUPERADMIN_*`, `ASTROKUNDLI_BASE_URL_*`) are not in the Lambda and are missing.
  Keep a copy of the values outside the checkout, per AGENTS.md. Owner: Sachin. Done: the missing values restored and a
  copy kept outside the repo.
- **Background-pull AWS changes not confirmed.** The CloudShell script (timeout 900, token, self-invoke, sweep rule) in
  `docs/reading-engine/31-background-chart-pull.md` has no confirmed run. Status: in progress (background-pull-aws session
  with Sachin). Done: confirmed in the Lambda config.
- **Bedrock quota: not adjustable.** Service Quotas names the model "OpenAI GPT OSS 120B"; both inference quotas default
  to 10,000 RPM and 100M TPM and are not adjustable, so a Support case is needed only if the applied values are lower.
  Status: in progress (bedrock-quota session, waiting on Sachin to run the listing). Done: applied values confirmed.
- **No CloudWatch access for `aiastra-ops-deployer`.** `logs:DescribeLogGroups` is denied; the earlier combined policy
  was never applied. A CloudShell grant is ready. Status: in progress (cloudwatch-access session with Sachin). Done: the
  `docs/reading-engine/30-specialist-failures.md` query runs from the local profile.

- **`transit_snapshots` has no refresh command.** `transits:build` builds only when nothing is stored; the local rows
  cover lookups to about 2027-10-24. To refresh: delete the rows (database write) or raise `TRANSIT_SNAPSHOT_VERSION`,
  then run `transits:build`. Status: blocked (Radha `transits` deploy).
- **`facts` and `transits` now exist in Radha** (uncommitted, `feature/reading-p1`): LAHIRI only (pyjhora's Vimshottari
  start ignores the requested ayanamsa); yoga and dosha names changed ("Manglik Dosha"); `transits` returns all
  lunations (~50, was 13); the server must send `as_of`, `vargas`, `scope`, `from`, `to` as params; `chartCatalogSync`
  will list them as unknown. The server's "unsupported" check does not recognise the new 400 for other ayanamsas.

## P2: real, can wait

- **`dasha.tara` fails for kundli de3223e3.** "module returned no periods", same on retry. pyjhora's `tara.py` seeds from planets
  in the kendras and returns nothing when there are none, which most likely explains it (chart not opened). Fix: return an
  empty, marked not-applicable result, not a server error. Status: open (reading-dev, on `feature/reading-p1`).
- **Full server test suite not run after the transit cache merge.** `tsc` and 43 tests (`transitEphemerisCache`,
  `chartData`) passed; the rest did not run before the checkout loss. Status: in progress (deploy session). Done: full
  `tests/unit` green on the rebuilt `develop`.
- **Nothing reads the transit cache yet.** `src/reading/transits/ephemerisCache.ts` is merged, its tables applied and
  seeded (about 900 rows: monthly 2026-2037 at Pune, daily Oct 2026-Dec 2028 at San Jose). No reader is wired. Status:
  open. Done: a reader uses it, or it is removed.
- **Snapshot `house_from_lagna` is not a natal house.** In a snapshot it counts from that moment's rising sign (Sun in
  Libra at a Sagittarius transit lagna gives 11, while `natal_house` was 8 from a Pisces lagna). `stripNatal` keeps it,
  so cached snapshots carry only this number, and `src/reading/layers/sections.ts:55` maps it to `h`. The transit prompts
  say to use `natal_h`, but any reader of cached snapshots must not present `h` as the person's house. Status: open.
  Done: dropped from the stored payload or renamed at read.
- **Rate-limit errors become stored failed rows.** `ensureChartData` records a Radha `rate_limit` as `failed`, retried only
  after 5 minutes (`annual.varsha@2029` on 2026-10-28). The background registration pull may hit this. Status: open.
  Done: rate limits retried in the client, not stored as failures.
- **Sachin's early pull files are inconsistent.** `transit-contacts.json` (2026-27) used Radha's default planets without
  Mars; the 2028-30 and 2031-37 files include Mars. `facts.json` and `kd.json` predate the 2027-2030 annual rows.
  `kundli_data-rows.tsv` was never written. Status: open. Done: regenerated in the post-deploy re-run.
- **Shared transit store gaps.** Monthly and daily seeds are at different places (Pune, San Jose), so they do not serve
  each other's keys; the place key includes the UTC offset, so PDT and PST are separate keys. Archisha's 17 monthly
  files were not seeded. Daily panchanga is not stored; planned from `daily_grade` after the deploy. Status: open.
- **`archishasinha` kundli rows are stale.** Its birth time was corrected 01:28 -> 13:28 on 2026-10-31 and the account
  deactivated (duplicate of `archisha`); its kundli, coordinates and 142 `kundli_data` rows were computed at the old
  time. Harmless while off. Done: rows deleted or rebuilt if the account is ever reactivated.
- **`transit_range` step=day** is confirmed live in the deployed catalog; the server's `transitRangeParams` does not pass
  `step` and `rangeKey` in `ephemerisCache.ts` has no step, so the shared store was filled with single snapshots. Row
  shape not compared against snapshots. Status: open (deploy session). Done: step in params and key.
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

- **`dotenv` banner.** `dotenv` v17 prints a banner to stdout, so `$(node -e "require('dotenv').config(); ...")` captures
  a corrupt value. Use `config({ quiet: true })`. It cost one failed migration attempt on 2026-10-31, with no effect on
  the database.
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

## Filed 2026-10-31 by the staging-deploy session (AWS, migrations, staging)

Reported by that session; the items are its own open findings. Owners are named where the work sits.

### P1: blocks or risks a release

- **Staging API Lambda: health not verified.** Run 40234411763 (merge 6970e92, the deploy session) reports image `api-6970e9232dfa`, `LastUpdateStatus` Successful. Not checked against AWS. `/health` not verified: the Function URL is AWS_IAM and the deployer user cannot invoke it. Owner: deploy session. Done: image and status confirmed with `get-function`, and `/health` returns 200 through a signed call.
- **Push deploys skip the rollback alias.** `.github/workflows/deploy-api-lambda.yml`, step "Publish rollback version" is gated on `inputs.update_function`, so a push deploy publishes no version and moves no `previous` alias. Owner: deploy session with Sachin. Done: push deploys publish a version and move `previous`, or the gate is recorded as intended here.
- **No IAM-capable identity for account 442728149528.** The `ai@carbonlitesystems.com` key was deactivated on 2026-10-25, which removed the only admin path from this shell. The deployer user `aiastra-ops-deployer` lacks `iam:*`, `events:*`, `lambda:AddPermission`, `lambda:UpdateFunctionConfiguration`, and `amplify:CreateBranch`. Owner: Sachin. Done: a named profile holding those permissions, scoped to `aiastra-server-api` and the staging Amplify app.
- **AWS keys pasted into chat on 2026-10-25.** The CarbonLite key and two deployer keys were pasted into chat. Owner: Sachin. Done: each rotated or deleted, and `aiastra-ops`, `aiastra-deployer`, and `ai-carbonlite` removed from `~/.aws/credentials`. The `aiastra-ops` key was rejected on 2026-10-31.
- **Bedrock clarifier quota.** Quotas for gpt-oss-120b (L-25B50707 RPM, L-9DC5F595 TPM, daily limit) are 0 in account 442728149528. No support case filed. The Lambda role lacks `bedrock:InvokeModel`. Owner: Sachin, with an admin for the role. Done: quotas raised, role updated, and the live C-02 clarify call passes. Suggested starting values: 60 RPM, 200,000 TPM, 5,000,000 tokens/day. (See also the P1 "Bedrock quota: not adjustable" item above: the bedrock-quota session found the defaults are 10,000 RPM / 100M TPM and not adjustable, so the 0 reading needs re-checking.)
- **Staging web: smoke test not done.** Run 40220290440 (web `release-candidate-staging`, commit 5f38ba4) is green. The site is not loaded, the disclaimer is not checked, and the URL `https://release-candidate-staging.d20sdo476h9w6c.amplifyapp.com` is Amplify's default pattern, not confirmed. Owner: deploy session. Done: the URL confirmed in the Amplify console, the site responds, and the disclaimer shows.
- **Migration approval record for M6–M8.** M6, M7, and M8 were applied to `aiastradb` on 2026-10-25. The approval in chat was "YES!" in answer to "M6 and M7 only, or M8 too", and a sibling session says Sachin did not approve. Owner: Sachin. Done: Sachin confirms in writing; if not, roll back per the notes in the 2026-10-25 session.
- **Registration v2 migration applied before its code.** `20261027140000_registration_v2` is applied to `aiastradb` (27 users checked, gender values cleaned). The migration folder and code are on the rebuilt `develop` (2026-10-31), not yet deployed. Owner: deploy session with Sachin. Done: the code deployed.

### P2: real, can wait

- **`login_attempts` file restored, not compared.** `develop` has `prisma/migrations/20260523120000_add_login_attempts/` restored from commit 4aeaa9e (merge 65fba94). The restored SQL has not been compared with the live `login_attempts` table. Owner: this repo's dev session. Done: column and index comparison recorded here.
- **Cognito auth not set up.** `20261025150000_auth_cognito_session` is applied. The user pool and app client are not created, and `AUTH_PROVIDER` is not set. Owner: deploy session with Sachin's approval per step. Done: pool and client created, Lambda env set, and the rollback (`AUTH_PROVIDER=local`) tested. (The Lambda env read on 2026-10-31 has `AUTH_PROVIDER`, `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` set, so part of this may be done; verify.)
- **LLM cache sweep not set up.** EventBridge rule `aiastra-llm-cache-sweep` (`rate(45 minutes)`), the `LLM_CACHE_SWEEP_TOKEN` env var, and the `READING_EXPLICIT_CACHE` decision are all open. Blocked on a profile with the permissions in the P1 item above. Owner: deploy session. Done: the rule ARN reported, the token set without being printed, and the flag decided.
- **Staging deploy trigger lives only on `release-candidate-staging`.** The push trigger was added in commit 55d1eca, and merge 6970e92 carries it. `develop` does not have it, so a later `develop` merge into the branch may drop it. Owner: Sachin decides where it lives. Done: the trigger's home decided and recorded here.
- **Gemini model check not run.** The one minimal call to confirm which model the funded key can use (`gemini-3.8-flash` in the plan) has not been made. Blocked on a named profile to read the Secret Manager key. Owner: reading-dev. Done: the model name and any error reported back.
- **Stray test user in the live DB not identified.** A read-only search for test-looking accounts was stopped before it finished. Nothing deleted. Owner: Sachin. Done: the record identified, and deleted only on explicit yes. (`testuser_1792944377406_vywp3z`, role novice, no birth data, created 2026-10-25, is one candidate seen on 2026-10-31.)

### P3: nice to have

- **Leftover local worktrees and branches.** `chore/pin-lambda-adapter-ecr` (commit 22e456c, merged into `release-candidate-staging`, not `develop`) and its worktree in the session scratchpad remain, along with the `release-candidate-staging` worktrees for the server and web repos. Their git links broke with the 2026-10-31 loss. Owner: the dev session that created them. Done: merged branches removed and worktrees removed, per the cleanup rule.
