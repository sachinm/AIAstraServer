# TODOS: every finding, until it is fixed

The shared list for all agents and sessions on AI AdAstra (server, Radha, web). Rule in `AGENTS.md`: any error, bug or
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

- **The Tithi Pravesha year dasha is a lifetime dasha, not a year dasha.** Every stored `annual.tithi_pravesha_dasha`
  row (`system=tithi_ashtottari`, the catalogue default) on the three newest `ready` kundlis (4feca3ca, 858f2f20,
  b4a777a6) has periods spanning 108 years (e.g. year 2026: 2025-05-30 → 2133-06-01, 19-year first period) while its
  own `valid_from`/`valid_to` is one Tithi Pravesha year. The G1 fixture shows the same (2026: Jupiter 2015-07-07 →
  2034-07-06). The digest's annual rows and any reading of "this year's dasha" read it as the year's clock. Found by the
  Chart Data Review checks (admin `feat/admin-chart-data-review`, check "a year dasha should fit its year") on
  2026-11-08. Owner: engine (Radha `annual.tithi_pravesha_dasha`). Done: the periods of each year row fall inside that
  year (compressed to the year), the admin Annual tab shows no "periods span N years" error.

- **12-person multi-age-group (`20s`–`70s`) live benchmark & 4-school review (`Self`, `Love`, `Work`).** Twenty-three of the 24 `ready` kundlis in PostgreSQL were built on `2026-11-06` before `PointRow.planet` (`AK.planet`, `AmK.planet`, `DK.planet`) and the `dasha.applicable` filter on `kundli_activation` were added (code backfills are now in `loadDigest` and `defaultSystemsPresent`, and all `love.reading.*` + `work.reading.*` panels are built and wired). Next session: run `buildDigest(prisma, kundliId)` for the 12-person cohort and execute the multi-age benchmark + independent review per [`docs/handoff/2026-11-08-techniques-lab-self-love-work-handoff.md`](handoff/2026-11-08-techniques-lab-self-love-work-handoff.md) under the $1.00 spend cap. Status: open (handoff ready). Done: 12-person cohort benchmarked across `self`, `love`, and `work` with `>=95%` verifier pass.

- **The live API refuses https://vedic-astrology.app (CORS).** An OPTIONS preflight to `/graphql` and `/api/billing/plans` on
  `dzsm2dbswvuqy.cloudfront.net` returns 204 with no `Access-Control-Allow-Origin` for this origin, and does return one for
  release-candidate-staging. The live `/pricing` page shows "Could not load the plans", with a CORS error in the console.
  Sign-up, sign-in and chat use the same API. The list is the `CORS_ORIGINS` env var on the Lambda (`server.ts:88`). Found
  2026-11-01. Status: blocked (Sachin runs step 1 of `docs/ops/2026-11-02-cloudshell-fixes.md`). Done: the origin is allowed
  and one real sign-up passes on the domain.
- **Main checkout wiped on 2026-10-31 08:17** by a `git worktree add` with an empty path (reported by the analysis
  session). `.git`, `.env`, `docs`, `evals`, `AGENTS.md`, `Dockerfile` and more deleted; unpushed local commits lost;
  `src`, `prisma`, `scripts`, `tests` survived. Rebuilt from a backup copy and GitHub by the deploy session. Status: in
  progress (deploy session). Done: `develop` rebuilt and pushed, every lost branch recreated, `.env` restored by Sachin,
  the worktree rule in AGENTS.md and CLAUDE.md.
- **US birth dates can be read with day and month swapped.** `AIAstra_WEB/src/Auth/fields/dateUtils.ts` `parseTypedDate` reads every
  typed date as DD/MM/YYYY for everyone, so a US person typing 04/05/1990 for April 5 silently gets 4 May, which is a wrong chart.
  The placeholder says DD/MM/YYYY; `docs/product/auth-registration-review.md` called for locale order. Found reading the code on
  2026-11-01; which users it hit is not checked. The field now names the month and offers the swapped reading (merged to local web
  `develop` 2026-11-02, not deployed). Status: open. Done: deployed, and kundlis with day and month both 12 or under are listed for review.
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

- **Annual (±10 yr) and `kundli_transit_overlays` parity gap on Sachin (`c584c0a3`) and Archisha (`6514751c`) vs. Sumit (`75b0d618`), plus duplicate/misnamed DB accounts.** Audited 2026-11-06 across PostgreSQL:
  1. **Sumit (`75b0d618-90b7-4db6-bff8-cc7bb0ed561f`)** has 402 ready `kundli_data` rows (including 250 `annual.*` rows across `2016–2035` with `divisional_chart_factor=2,7,9,10`), 893 `kundli_digest` rows (`200` `annual`), 10,260 `kundli_activation` rows, and 11 `kundli_transit_overlays` rows (`1975–2035`).
  2. **Sachin (`c584c0a3-841b-451b-a2ed-f5709c5fb31d`)** and **Archisha (`6514751c-9b30-45e6-bad6-0a56415e067b`)** have all 152 natal/varga/dasha/strength/avastha rows (702 and 694 `kundli_digest` rows; 12,586 and 8,298 `kundli_activation` rows), but only **12 `annual.*` rows** (`@current` and one single year in D1 only → only `2` `annual` digest rows) and **0 `kundli_transit_overlays` rows** in DB (even though `evals/fixtures/G1/catalog/transit_contacts.*.json` exists on disk for Sachin).
  3. Two active accounts named `"Sachin Mohan"` (`858f2f20-041c-4c74-8e7e-3fa4f251e19d`, born `1947-01-16 Delhi`, Leo Lagna; `3784ca07-66ba-4319-8b90-4a64073032ac`, born `1985-10-14 Pune`, Aquarius Lagna) store other people's charts under Sachin's display name, and deactivated `archishasinha` (`f3d117b0-6b60-48c9-8552-bd247b2d10aa`) has `01:28` AM (Virgo Lagna) instead of `13:28` PM (Pisces Lagna).
  - Status: open (digest rebuild with `dashaCharter`, `avasthaMultipliers`, `sunProximity`, `starChain`, `D1.K64M/K64L/KD22`, and `pendingKarmaHouses` completed 2026-11-06 for `c584c0a3`, `75b0d618`, `6514751c`, `858f2f20`, `3784ca07`). Done: run `topUpAnnualSet` and `npm run transits:overlay` for `c584c0a3` and `6514751c`, and relabel `858f2f20` / `3784ca07` with Sachin's OK.
- **Fixed (2026-11-07):** `tests/unit/auth/emailOnlySignup.test.ts` and `tests/unit/auth/registrationV2.test.ts` now explicitly clear `COGNITO_*` and `RESEND_*` / `SMTP_*` environment variables and pin `AUTH_PROVIDER=local` in `beforeEach`/`afterEach`, preventing local `.env` Cognito pool calls during Vitest runs.
- **`kundli_data` rows do not record which engine commit produced them, and the `current` annual rows look empty.** Checked
  2026-11-02 on the live database: 0 of 4,006 rows have `engine_commit` (`complete()` in `reading/chartData/store.ts` never
  sets it; only `kundli_facts` does), so after a Radha deploy there is no way to see which rows came from the old engine
  (the Rahu/Ketu dignity fix needed a blanket wipe and re-pull for that reason). Separately, a `variant='current'` annual row
  is a pointer by design: its payload is only `{variant:"year=2026", valid_to, year_used}`; the chart is in the `year=<y>`
  row it names. A reader that takes the `current` row's payload sees no chart fields. Fix: (1) record the engine commit on
  each row (Radha's response or the catalog's `engine_commit` at fetch time) and add a "re-pull rows older than commit X"
  helper; (2) document the pointer in `docs/reading-engine` and make readers follow `variant` (or return the `year` row).
  Owner: reading-dev. Done: new rows carry `engine_commit`, and a reader asked for the current year gets the chart.
- **Annual charts in divisional charts are stored but the server's read path cannot ask for them.** On 2026-11-02 the deploy
  session pulled `annual.tithi_pravesha` and `annual.varsha` for 2026-2035 in D2, D7, D9 and D10 straight from the engine
  (`params.divisional_chart_factor`, which Radha accepts: 23 factors) and saved them in `kundli_data` for Sumit's kundli
  under the variant `year=<y>;divisional_chart_factor=<n>`. `parseKey` (`reading/chartData/store.ts`) lets a year key
  override only options listed in the type's `fixedParams`, and annual.varsha and annual.tithi_pravesha have none, so
  `annual.varsha@2026;divisional_chart_factor=9` returns "unknown option" and nothing reads those rows. Fix: allow
  `divisional_chart_factor` (values from `VARGA_FACTORS`, not 1) as an optional override on the annual types in the catalog;
  `parseKey` puts it in `params` and in the variant after the year; `radhaRequestFields` sends it inside `params` (as the
  rows were pulled); D1 keeps the plain `year=<y>` variant. Add tests, then register the stored rows. Owner: whoever owns
  `reading/chartData` (reading-dev / Fable session). Done: `ensureChartData(['annual.varsha@2026;divisional_chart_factor=9'])`
  returns the stored row without a Radha call.
- **Uncommitted Radha edit hardcodes one person's reading into `reading_tables`.** In `AIAstra_Radha` (main checkout, not
  committed or deployed, found 2026-11-02) `src/jhora/reading_tables_export.py` gains `correspondences.chart_specific.
  counterparty_and_network_profiles` with fixed text such as "senior_construction_roofing_principal",
  "elder_brother_50s_jyotish_ai_commissioner" and an "h7_behavioral_playbook", and its test asserts Virgo 7th, Mercury
  lord, Capricorn 11th: values of one specific chart. The same diff deletes the module docstring that records which rules
  pyjhora does not hold and the open Rahu conflict. A generic export would serve the same text to every kundli.
  Owner: whoever is editing it, with Sachin. Done: the chart-specific text is moved out of Radha (or computed from the
  chart), and the deleted docstring is restored.
- **Registration refused: Cognito's default email sender is capped at 50 emails a day for the whole account.** User pool
  `aiastra-users-staging` (us-east-1_x8CrXCth3) has `EmailSendingAccount: COGNITO_DEFAULT`; every sign-up confirmation,
  resend and EMAIL_OTP login code counts. On 2026-11-01 20:28Z `SignUp` returned `LimitExceededException` ("Exceeded
  daily email limit") and the web showed "We could not create your account just now. Please try again in a moment."
  Reproduced locally with the same client id; the Lambda log has one failure, no loop. The counter resets daily, so
  sign-up comes back on its own and breaks again on the 51st email. SES in the account has no verified identity and
  is in sandbox (200/day, verified recipients only); the local provider needs `RESEND_API_KEY` or `SMTP_HOST`, which
  the Lambda does not have; no Route 53 zone or domain exists in either account. Fix (needs a sending domain Sachin
  owns): verify the domain in SES us-east-1, request SES production access, add the SES identity policy for
  `cognito-idp.amazonaws.com`, then `update-user-pool --email-configuration EmailSendingAccount=DEVELOPER,
  SourceArn=<identity arn>,From=...`. Access: the `aiastra-ops` key is invalid. `OrganizationAccountAccessRole` via `amplifyv2`
  worked on 2026-11-01, but it is an admin path Sachin has not approved for this: get their OK first. Code side (shipped on `fix/signup-email-limit-message`):
  the refusal now says "today's limit, try tomorrow" with code `SIGNUP_EMAIL_LIMIT`. Status: script ready 2026-11-03 in `docs/ops/2026-11-03-ses-and-cognito-email.md`; on 2026-11-03 the identity was created and production access requested through the role path (Sachin's OK); AWS **DENIED** the request the same day (case 179367262200747, reason not readable without Premium Support). Sachin is adding the DKIM, SPF and DMARC records in Cloudflare. Next: reply to the case in the Support Center once the domain shows verified, or move the pool to a CustomEmailSender Lambda that sends through Resend (domain verified there).
  Done: pool on SES, a fresh sign-up receives its code, the TODO about "Cognito auth not set up" updated.

- **Unidentified 503 and 404 on the staging sign-up pages.** On 2026-11-01 the browser console on
  `release-candidate-staging` logged one 503 and one 404 between the landing page and `/signup`. The network log did not
  capture their URLs, so the source is unconfirmed. The 503 is probably `GET /api/billing/plans`, which returns 503
  `plans_not_configured` until `PLAN_FREE_QUESTIONS` and `PLAN_PLUS_QUESTIONS` are set, and which leaves the public pricing page
  showing "Could not load the plans". The 404 may be the missing favicon (web `FINDINGS.md` F-31). Done: both named, and
  fixed or explained.
- **The security check failed in the app's built-in browser on 2026-11-01.** Cloudflare Turnstile logged error 300010 on staging `/signup`, and the form showed "Security check failed", so no code could be requested there. It may reject that embedded browser only; a normal browser is untested. The console also warns "Turnstile already has been loaded" (`index.html` loads the script, and something loads it again). Done: sign-up passes in a normal desktop and phone browser, and the double load is gone.
- **Country detection does not reach the server.** On 2026-11-01 staging `GET /api/billing/plans` returned `"country":null` for a request from the US, so `CloudFront-Viewer-Country` looks absent at the Lambda (config not read: the deployer is denied, and `put-user-policy` hit IAM's 2,048-byte inline limit for `aiastra-ops-deployer`). Everyone gets US dollars unless they use the homepage switch; a visitor in India sees dollars first. Owner: Sachin (origin request policy on E3UPJNUU8APCT). Done: a request from India returns `IN` and rupees.
- **Web dev tools have 23 npm audit findings (2 critical, 2 high, 18 moderate, 1 low).** After `npm audit fix` on 2026-11-02, production dependencies report 0. What is left is in `vitest`, `vite`, `eslint` and similar; the fixes for `vitest` and `vite` are major versions. Also, `npm install --prefix <worktree>` adds the main checkout to that worktree's `package.json` as a `file:` dependency, so run installs from inside the folder. Done: dev tools upgraded or the findings accepted.
- **The life reading tab may be hidden on staging.** `/profile/timeline` shows the reading only with `VITE_TIMELINE_ENABLED=true`; the staging value is not in the repo and was not read. Owner: Sachin. Done: the flag is set where the reading should show.
- **Account Lambda concurrency is only 10.** Sachin's CloudShell output on 2026-11-01 (relayed by another session, not read
  from AWS by the deploy session) shows total 10, unreserved 10. Doc 38's reserved concurrency of 20 is impossible, so it
  is not set, and the API, the self-invoke chart worker and the sweep share those 10 slots; a few chart builds at once
  could throttle chat. Render's pooler cap was not checked. Owner: Sachin (Service Quotas request). Done: limit raised,
  reserved concurrency set per doc 38 section 6 against the Render cap, or doc 38 revised for 10.
- **New Radha catch-up ran on 2026-11-01; checks left.** `chart-catalog:sync`, `facts:backfill --force` (coordinates cleared first, old
  values backed up in the notes folder `catchup/before-2026-11-01.json`), the `transit_snapshots` rebuild (30 rows,
  2026-11-01 to 2028-11-01) and the `kundli_data` pull (158 items each, 18 active kundlis) all finished against Radha
  `b66869a`. Not done: the contacts overlay shows "unavailable" in the snapshot build; `testuser_*` has no place so its
  facts stay `failed`; `rish`'s tz changed -7 to -8 (December birth, believed right); dossier values not compared against
  Fable's expected set after the rebuild. Done when: Fable's comparison passes on the rebuilt dossiers.
- **Staging not exercised after the 2026-11-01 deploy.** Server `e621286` and web `60803ed` are deployed, `/health` is 200 and
  the site is 200. Not checked: a reading on the current flow, a real sign-up (`kundli_sync_invoked`, `chart_build`, no 429
  from Radha, `me.chart`), the progress screen in a browser, Radha's env and the sweep rule (`aiastra-ops-deployer` is
  denied). Owner: deploy session. Done: each checked once.
- **Radha now refuses calls with no key.** Any caller without `ASTROKUNDLI_API_KEY` gets "unauthorized: Invalid or missing API
  key". The local `.env` has it; other checkouts and scripts do not. Done: noted wherever `.env` values are kept.
- **Prompt registry changes the schema from the request path.** `src/reading/prompts/registry.ts` `ensurePromptSchemaAndSeed`
  runs `ALTER TABLE`, `CREATE TABLE` and `CREATE TRIGGER` on `system_prompts` during a chat turn. That bypasses "migrations are
  written, never applied", and on a cold Lambda it adds up to 21 statements to the first question. Found reading the code,
  2026-11-01. Status: open. Done: a migration holds the DDL; the code only reads.
- **The `aiastra-ops` AWS key is invalid** (`InvalidClientTokenId`, 2026-11-01), so the live Lambda's `READING_FLOW` and models,
  and CloudWatch timings, could not be read for doc 40. Status: open (deploy session). Done: a working read-only profile.
- **Doc 39 needs a live bench before it is turned on.** Reader quality and every speed in doc 39 §5 rest on two stored data points
  per model. `npm run bench:oracle -- --live` costs under $1. Status: open (needs Sachin's OK). Done: §5 holds measured numbers.
- **Migration M18 (`reading_m18_agent_responses`) must be applied before `READING_FLOW=oracle`.** Without it the journal logs a failed
  write and loses the agent rows; answers are unaffected. Status: open (deploy session, Sachin's OK).
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
- **`transit_snapshots` has no refresh command.** `transits:build` builds only when nothing is stored; the local rows
  cover lookups to about 2027-10-24. To refresh: delete the rows (database write) or raise `TRANSIT_SNAPSHOT_VERSION`,
  then run `transits:build`. Status: blocked (Radha `transits` deploy).
- **`facts` and `transits` now exist in Radha** (uncommitted, `feature/reading-p1`): LAHIRI only (pyjhora's Vimshottari
  start ignores the requested ayanamsa); yoga and dosha names changed ("Manglik Dosha"); `transits` returns all
  lunations (~50, was 13); the server must send `as_of`, `vargas`, `scope`, `from`, `to` as params; `chartCatalogSync`
  will list them as unknown. The server's "unsupported" check does not recognise the new 400 for other ayanamsas.
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

## P2: real, can wait

- **No per-email or per-IP limit on sending sign-up and sign-in codes.** `startSignup` and `requestMagicLink`
  (`src/services/authService.ts`) have only Turnstile and the web's 30 s resend countdown in front of them. Turnstile is now
  unseen and never blocks the form (web 57bff1f, plan `docs/product/fast-auth-security-check.md`), so these limits are the
  real guard against the site being used to send unwanted email. Found 2026-11-04 by reading the code; no abuse seen. Owner: open.
  Done means: e.g. 5 codes an hour per email and 20 per IP, a polite "try again later" message, and tests.

- **Nothing runs the web type check automatically.** It reports 0 errors (`npm run typecheck`, 2026-11-02), but `npm run build` is only `vite build` and the web repo has no CI. Status: open. Done: a check runs it before a deploy.
- **The US | India switch is no longer on the home page.** Sachin asked for it there on 2026-10-31 or later (this session's second request). The 2026-11-02 landing trim moved it to `/pricing` when he said to remove Pricing from the main page, and signed-out visitors have no link to `/pricing`. With `country:null` from the API (P2 "live origin request policy"), a visitor in India sees dollars until they find the switch. Status: open (Sachin decides). Done: the switch has a decided home, and country detection works.
- **The landing page's 9,500 record figure is not a per-reading count and is partly an estimate.** One reading's measured evidence pack is about 800 to 1,000 records on the G1 fixture. 9,500 is the a16z session's estimate of everything available for one person (about 8,000 across catalog types, about 1,500 for 10-year annual charts); about 791 are stored per person today. Branch `feat/landing-chart-records` in `AIAstra_WEB` says "available", not "reviewed per reading". Found 2026-11-02. Status: open (Sachin approved the "available" wording on 2026-11-02; the figure is still an estimate). Done: the figure is counted from real data, or the copy changes.
- **Annual charts in divisional charts are stored but the server's read path cannot ask for them.** The deploy session pulled `annual.tithi_pravesha` and `annual.varsha` for years 2026-2035 in D2, D7, D9 and D10 for one kundli and saved them under the variant `year=<y>;divisional_chart_factor=<n>`, because `parseKey` let a year key override only the catalog's `fixedParams` and the annual types have none (`annual.varsha@2026;divisional_chart_factor=9` returned "unknown option"). Status: done on branch `claude/nifty-haibt-721718` (not merged, not deployed): every annual type accepts `;divisional_chart_factor=<n>` (a varga factor other than 1), `parseKey` puts it in `params` and after the year in the variant, `radhaRequestFields` sends it inside `params`, D1 keeps the plain `year=<y>` variant; tests in `tests/unit/reading/chartData.test.ts`. Remaining: merge into `develop` and deploy the API Lambda before the reading plan can read these rows.
- **Agent metrics have not written a real row yet.** M19 is applied and the code is live on the API Lambda, but no question has been asked since
  the deploy, so `reading_traces` and `reading_agent_spans` are empty (checked 2026-11-02). Status: open (Sachin asks one signed-in staging
  question, deploy session reads the rows). Done: the plan in `docs/reading-engine/41-agent-metrics.md` §8 shows rows for every agent.
- **`prisma/schema.prisma` is behind the live database.** `prisma migrate diff` from the live database to the schema (2026-11-02) wants to drop tables
  `chat_logs_thinking`, `login_attempts` and `system_prompt_versions`, six `system_prompts` columns (`agent_role`, `description`, `prompt_type`,
  `updated_at`, `updated_by`, `version`) and index `idx_auth_referred_by_user_id`. Running `prisma db push` against this database would remove them.
  `reading_traces` and `reading_agent_spans` are not in the diff. Status: open. Done: the schema covers them and the diff is empty.
- **Payment webhooks cannot reach the API through CloudFront.** `aiastra-server-api` is an AWS_IAM Function URL behind OAC, which rejects a
  POST without `x-amz-content-sha256` (AWS CloudFront OAC docs, `docs/grokbots/SKILLS.md`). A gateway cannot send that header. Plan in
  `docs/billing/README.md`: a separate webhook Lambda. Status: open (deploy session, Sachin's OK). Done: a signed test event sets `is_paid`.
- **The live origin request policy was not read.** `CloudFront-Viewer-Country` must be in policy `e1684868-b4fe-43b2-94ca-ac52642bd67d`, or every
  visitor sees USD. The check failed on 2026-11-01 because the AWS MCP credentials had expired. Status: open (deploy session). Done: an India
  request to `/api/billing/plans` returns `INR`.
- **No published payment terms confirmation for astrology.** Stripe lists "Psychic services and fortune tellers" as prohibited for Japan and Thailand,
  not the US, and says its list is not exhaustive. Razorpay's list was not found, though it publishes an Astrotalk case study. Status: open (Sachin).
  Done: written confirmation from each gateway before a live key is used.
- **The card statement name is not settled.** The web nav, page titles and chat now say "AI AdAstra" (2026-11-02). A gateway statement descriptor that
  does not match invites chargebacks. Status: open (Sachin). Done: the descriptor says AI AdAstra.
- **The rename to AI AdAstra is merged but not live.** Merged to local `develop` in server and web on 2026-11-02, not pushed; `release-candidate-staging` does not have it, so staging still
  says "Sign in to AI Astra". Migration `20261102120000_brand_ai_adastra` is written, not applied: `declined_topics.reply` and `system_prompts.prompt` override the code, so decline replies and
  the clarify prompt keep the old name until it runs. `MAIL_FROM` / `RESEND_FROM` on the API Lambda override the new default sender and were not read (no AWS access in the rename session).
  Status: open (deploy session). Done: both repos deployed, migration applied, and a declined question, the sign-up email sender and the staging sign-in page all show AI AdAstra.
- **Text already stored keeps the old name.** Past chat messages and saved readings in the database were not rewritten, and `docs/reading-engine/34`, `36`, `37` and `part1-addendum` are left as
  dated records. Status: open (Sachin, only if old readings should change). Done: decided.
- **`scripts/generate-og-image.mjs` crashed once, then worked.** In `AIAstra_WEB`, the first run in a fresh worktree on 2026-11-02 exited with a Node error (message not kept); the same command
  passed straight after. `vitest` in that same chained command also printed nothing, then passed 292 of 292 when rerun alone. Cause not found. Status: open. Done: seen again and explained, or dropped.
- **`tests/unit/reading/oracle/flow.test.ts` flakes under load.** "a hung required reader fails without a retry" uses a real 1 s join, so on a busy machine other readers miss it too (`layers_missing:R02,R08,R10`; seen once 2026-11-02 in the full server run, 30 of 30 on each of 3 runs alone). Status: open. Done: the test does not depend on real time.
- **The Unlimited guard is built but off.** `PLAN_UNLIMITED_DAILY_GUARD` caps questions per UTC day (merged to local `develop` 2026-11-02). Status: open (Sachin chooses a number; the Terms and pricing page must say so before it is on, since the plan is sold as Unlimited). Done: set, or the risk accepted.
- **Web and server must ship in order for plans.** The web now always sends `language` in `completeProfile`, so a server without that input rejects
  registration. Order: migration `20261101140000_billing_plans`, server, web, then `PLAN_FREE_QUESTIONS`, `PLAN_PLUS_QUESTIONS` and `PLANS_ENABLED=1`. Merged to local `develop` 2026-11-01, not pushed. Status: open
  (deploy session, Sachin's OK). Done: a new registration works on staging and the bar shows.
- **`question_usage` SQL has never run against Postgres.** The gate's unit tests use an in-memory store, and no database was used, because migrations
  are not applied without Sachin's OK. Status: open (deploy session). Done: migration applied on staging, and a test account stops at its quota.
- **A missing plan limit lets questions through.** With `PLANS_ENABLED=1` and `PLAN_FREE_QUESTIONS` or `PLAN_PLUS_QUESTIONS` unset, the gate logs an error and allows every question, by design, so no
  number lives in the code. Status: open (deploy session). Done: both are set on the Lambda before the flag, with an alarm on `[plans] reserve failed`.
- **The web does not call `POST /api/chat/prewarm`.** It should fire it without waiting on a `propose` event, and label the reader
  pills (`R08` → "Vimshottari periods"). Without it, a clarified question whose horizon was answered re-runs timing readers,
  which is the difference between about 7 s and about 11 s (doc 39 §5). Status: open (web session).
- **Answer text arrives in one burst.** First token came within 5 ms of the end on both stored runs (`reading_runs`), and doc 24
  saw the same. So streaming gives no early text at these sizes, and "first token" budgets (doc 12) measure nothing. Status: open.
  Done: confirmed live whether Gemini or our path holds it, and doc 12's budgets restated as complete time.
- **Only the oracle flow has a cost cap.** Single and graph flows have none: a 3-subject graph question could reach about $0.43
  (doc 40 §3). `READING_DAILY_BUDGET_USD` in doc 05 §6 was never built. Status: open. Done: the guard also wraps those flows, or they are retired.
- **Only the oracle flow scrubs engine names from output.** The rule is prompts only in the single and graph flows, despite a23a734's
  message ("enforce engine-name redaction"); `grep` finds no output filter there. Status: open. Done: one filter on every flow.
- **Clarifier model spend is not counted against a question's cap.** Bedrock `gpt-oss-120b` has no row in `llm/models.ts` `PRICES`, and its
  usage is not kept (under $0.001 per question, doc 23). Status: open. Done: priced from the AWS page and seeded into the guard.
- **Stored tables lack fields doc 33's curricula use:** star lord per planet (`varga.d1` gives the nakshatra name only), bhava chalit, and
  `near_cusp`. Readers R07 and R08 report these as gaps. Status: open (Radha session). Done: served, and the curricula restored.
- **The 6/8/12 friction counts between dasha levels have no source in the oracle R8 reader.** Doc 26 Pass 3 and doc 33 R8 use them; Node may not count, and
  `house_counts` was not in the stored rows read 2026-11-01. **Updated 2026-11-06:** `buildDigestRows` (`src/reading/digest/build.ts`) now populates `PlanetCard.dashaCharter` from `avasthas.dasha_charter` (including the 9×9 `fruition` map with `houseFromMd`, `fruitionClass`, `isShadAshtaka68`, and `isDwirdwadasha212`), and `src/reading/life/promise.ts` (`periodSide`) and `src/reading/life/charter.ts` (`life.mahadasha_charter`) read it directly. Remaining: wire R8 / doc 26 Pass 3 in the oracle flow to read `dashaCharter.fruition` or `house_counts`. Status: open.
- **Planet names differ between tables:** `karaka.chara` says `Raagu` where `dignities` says `Rahu`. A reader or the layer count can treat one
  planet as two topics. Status: open (Radha session). Done: one spelling.
- **G1's catalog fixture has only 5 of the 35 types the readers use**, so `npm run bench:oracle` sends them thin tables. Status: open.
  Done: fixture regenerated from deployed Radha (same work as the G1 P0 item above).
- **Too few stored runs to measure:** 2 readings with timings in 21 days in `reading_runs`. Status: open. Done: enough staging traffic for percentiles.
- **A worker re-run briefly closes chat on the web.** `processOneKundliRow` sets `queue_status = in_progress` on every run,
  and `ChatSection.tsx` opens only on `completed`, so a sweep or resume can show the overlay to a user whose chat was open.
  Status: open. Done: the page gates on `me.chart`, or re-runs of a completed row leave `queue_status` alone.
- **Server unit tests read the real `.env`.** In a checkout with `.env`, 39 tests in 8 files fail (`astroKundliExportSpacing`,
  `env`, `geminiChatService`, `auth/emailOnlySignup`, `auth/registrationV2`, `reading/fullPrefixCache`, `reading/promptCache`,
  `reading/run`); the same code passes all 107 in those files with no `.env` (2026-11-01). `ASTROKUNDLI_API_KEY`,
  `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_CACHE_ENABLED` and `DATABASE_URL` are among the values it holds, so a test run can see
  live settings. Whether any test reached a live service was not checked. Until fixed, run the tests in a worktree. Status: open.
  Done: tests do not load `.env`, and the suite passes in the main checkout.
- **Tests that flake.** `ChatSection.location`, `SignIn`, `SignUp` and `LedgerSection` web tests and the server's `auth` and
  `registrationFullPull` tests hit the 5 s limit at random when the machine is busy, and pass with `--testTimeout=60000`.
  The server's `astroKundliExportSpacing` "keeps the start spacing for chart exports … stored coordinates" failed once in
  a full run with no `.env` (2026-11-04, after a docs-only merge) and passed 3 of 3 alone.
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

## P3: nice to have

- **Scene images can be fetched from other websites (no hotlink guard).** Since `fix/auth-scene-fullbleed` (AIAstra_WEB) the
  39 sky scenes ship as `/assets/<hash>.webp`, cached a year, but any site can still embed or scrape them. Sachin asked
  (2026-11-04) for CloudFront / Amplify to refuse `/assets/*.webp` requests whose `Referer` is another site (allow empty
  Referer, the app's domains and staging). Infra change, so it goes to the deploy sub-session. Status: open. Done: a request
  with a foreign Referer gets 403, the app's own pages still load every scene.

- **The AM/PM select is cut to "AM/P" on a phone.** Seen on `/signup/details` at 390 wide (walkthrough, 2026-11-02). Status: open. Done: the placeholder fits at 375 wide.
- **Two chat routes skip the question limit.** `POST /api/chat/answer` and `POST /api/chat/prewarm` (`src/routes/clarifyRoutes.ts:106,129`) have no `questionGate` check. A new question is still refused, so a person at their limit can only reach them with a clarify run started earlier, but prewarm runs reader models on the oracle flow, so a direct caller could spend money. Found 2026-11-02. Status: open. Done: both refuse when the account has no questions left, with a test.
- **The home page HTML is about 78 KB.** The star map (`ConstellationSky.tsx`, 2026-11-02) is prerendered twice, once per layout, with about 180 loose stars as separate circles. It gzips well, and the brief's 20 KB goal was not met. Status: open. Done: one layout per build, or the field stars as a pattern, and the page under 30 KB.
- **Agents cannot do a real sign-up or sign-in on staging from the built-in browser.** Cloudflare Turnstile fails there with error 600010 (seen 2026-11-02 on `/signup`, after Sachin ticked the box by hand; the page shows "Security check failed"). Likely Cloudflare rejecting that browser, unconfirmed until it passes in a normal browser. So real sync timing, chat, quota and profile checks need Sachin or a connected Chrome. Status: open. Done: a documented way to run signed-in staging QA, such as a staging-only Turnstile test key decided by Sachin.
- pyjhora's Kemadruma and Sunapha checks count Rahu and Ketu, which classical rules exclude (decides G1's Kemadruma).
- pyjhora's neecha bhanga rule 1 checks the wrong sign and runs only on raja yoga pairs (`raja_yoga.py`).
- Served `dignities` and `benefic_malefic` use the stronger co-lord as `lord` (Ketu as 9th lord), which a Parashari reading misreads.
- Served `d1` shows "Indra Chapa" as Aries when it has no value.
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
- **Doc 39 follow-ups (2026-11-01).** `real_want` as a clarify question with chips (doc 33 §8 decision 1); Plan B buckets in the taxonomy; R14
  on by default (doc 18 gate); `predictions` and calibration (doc 32). All wait on Sachin's decisions or on labels.
- **Category flows (Sachin, 2026-10-31).** After that, specialised multi-agent flows per category, starting with romance,
  love and relationships, and finances (bank balance, financial luck, gains through career and business), then career,
  parents, legal. The Clarify agent detects the category, which triggers that flow, using stored kundli data or fetching
  what it needs from Radha. Not designed yet; builds on docs 33 and 34.
- **AGENTS.md and CLAUDE.md for the Radha and web repos** (pointer files), awaiting Sachin's yes.
- **Admin panel and encryption, planned 2026-11-04, for an Opus build session.** `docs/admin/01-admin-panel-users-and-agent-metrics.md`
  (lock-out, quota, plan, agent speed and cost per query; phases A1-A5) and `docs/privacy/02-birth-data-charts-and-wire-build-plan.md`
  (seal birth data and charts at rest; no payload encryption above TLS; phases B0-B5). Order: A1 first, B0 beside it, B1 after A2.
  Waiting on Sachin: `ADMIN_EMAILS`, live migrations M23-M25, KMS/DynamoDB/IAM creation, the committed G1 fixture.

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

- **The public assistant has never called a real model.** Built 2026-11-02 and tested with a stand-in, because no AWS credentials here can reach Bedrock. Whether `nvidia.nemotron-super-3-120b` is available in the account, how the real model behaves against prying questions, and real latency and price (no row in `llm/models.ts` `PRICES`) are all unknown. Status: blocked (Sachin runs step 7 of `docs/ops/2026-11-02-cloudshell-fixes.md`). Done: both models answer, and the prying questions in `tests/unit/assistant` are tried on the live route and read in `assistant_questions`.
- **The assistant log's access and erasure gaps.** No read route, no log of who reads, no erasure route, no field encryption, no lawyer's review of IP logging for visitors without an account. See `docs/security/assistant-log-controls.md`. Status: open. Done: each closed or accepted by Sachin.
- **The visitor's address may fall back to a spoofable value.** `clientIp` prefers `CloudFront-Viewer-Address`, which must be in origin request policy `e1684868-b4fe-43b2-94ca-ac52642bd67d`; otherwise it uses Express `req.ip`. Not read from AWS. Status: open. Done: the header is forwarded, and the log shows real viewer addresses.
- **Leftover local worktrees and branches.** `chore/pin-lambda-adapter-ecr` (commit 22e456c, merged into `release-candidate-staging`, not `develop`) and its worktree in the session scratchpad remain, along with the `release-candidate-staging` worktrees for the server and web repos. Their git links broke with the 2026-10-31 loss. Owner: the dev session that created them. Done: merged branches removed and worktrees removed, per the cleanup rule.

- **Screenshot review findings (2026-11-01): `AIAstra_WEB/docs/screenshots/walkthrough/FINDINGS.md`.** All P1 and P2 items are fixed on web `develop`, checked with unit tests and the stubbed walkthrough, not on real staging. The 14 P3s stay open apart from those marked there. Done: each P3 fixed or dropped by Sachin, and marked in that file.
- **Legal pages need inputs and a lawyer.** Terms, privacy and refunds are live on web `develop`, written by an agent and not reviewed. `VITE_LEGAL_ENTITY` and `VITE_SUPPORT_EMAIL` are unset, so the pages say "the operator of AI Astra" and promise an address later. Governing law is worded as "where the entity is established". The 18+ rule, the 12-month liability cap and the refund terms (14 days on the first annual payment, no part-months) are agent defaults. Owner: Sachin. Done: values set, terms approved, lawyer has read them.
- **Consent is not recorded.** The sign-up checkbox is required in the browser only; the server stores no accepted version or time, so acceptance cannot be proven, and accounts created earlier never accepted. Done: `auth` stores the terms version and time, and existing accounts accept at next sign-in.
- **No account deletion, which the mobile app needs.** Sachin said on 2026-11-01 a phone app is coming. Apple and Google both require deleting an account from inside an app, with a public privacy URL. The server has no deletion path, and `/privacy` offers deletion by email only. Done: a signed-in delete action removes the account and its data.
- **Pricing has no tax line.** F-16's saving is shown; whether prices include tax is undecided. Owner: Sachin.
- **vedic-astrology.app serves the staging build.** Same files and ETag as release-candidate-staging on 2026-11-02 UTC, so it inherits Disallow: / in robots.txt, and the Amplify production branch is a September build still branded Cosmo Vedic. Status: open. Done: a decision on which branch backs the public domain, and the old production site updated or removed.
- **Web tests time out under load.** On 2026-11-02 a different few of SignUp.test, ChatSection.location.test and LedgerSection.test failed on each full or partial run at the 5 second limit; SignUp and ChatSection.location all passed with --testTimeout=30000. Status: open. Done: the suite is stable on this machine.
- **Hindi site by locale: tabled by Sachin on 2026-11-01 as too large for now.** He asked to replace the India option with a
  Hindi locale so the site appears in Hindi script. `src/i18n` has English only and most page text is hardcoded. Status:
  tabled. Done: strings moved to the catalog, a Hindi catalog reviewed, and a language switch on public pages.
- **Public site loose ends seen 2026-11-01 on https://vedic-astrology.app.** Legal pages say the support address "will be
  published", and `VITE_SUPPORT_EMAIL` looks unset. Refund section 6 reads badly once that text is inserted. "The operator of
  AI Astra" names no legal entity, and the privacy contact sentence starts in lower case. Terms and privacy describe mobile
  apps that are not confirmed to exist. www.vedic-astrology.app serves 200 without redirecting. robots.txt there says
  `Disallow: /`, which contradicts indexing the public pages if this is the production site. The disclaimer "not predictions
  you should rely on" sits against a product that answers timing questions. Status: open.

## Filed 2026-11-01 by the page-timings planning session (docs/performance/01-page-timings.md)

- **Turnstile script loads twice on sign-in and sign-up.** `AIAstra_WEB/index.html:32` adds `api.js?render=explicit` with no id, and `@marsidev/react-turnstile` then injects `api.js?onload=onloadTurnstileCallback&render=explicit`. Both tags were read from the live page's DOM on 2026-11-01. Status: open. Done: one script request on both pages, and the widget still loads.
- **Turnstile and Google Analytics load on every page.** `index.html:32-41` loads both on the homepage, which has no widget, and in the signed-in app. This adds download time, and it matters to the data-stays-in-AWS privacy work. Status: open. Done: Turnstile loads only where it is used, and the Analytics decision is made with the privacy plan.
- **Hashed web assets are not cached by browsers.** `/assets/index-*.js` is served with `Cache-Control: public, max-age=0, s-maxage=31536000`, so every visit revalidates. Seen on https://www.vedic-astrology.app on 2026-11-01. Status: open. Done: `/assets/*` sends `max-age=31536000, immutable` through `customHttp.yml`.
- **No code splitting on the web.** `src/routes.tsx:2-20` imports every page up front, so the homepage downloads the chat and profile code: 178 KB transferred, 637 KB raw in a local build. Status: open. Done: signed-in routes are lazy loaded, with sizes before and after recorded.
- **The charts page shows no charts.** `src/pages/charts/ChartsSection.tsx` exports `BiodataPage` and shows only birth details, though its title is "Your charts" (`src/lib/seoConfig.ts:91`). `routes.tsx:130` also passes it a `user` prop it does not declare. Status: open. Owner: Sachin decides what the page should show. Done: the page matches its name, or is renamed.
- **The API saw no viewer country on 2026-11-01.** `GET /api/billing/plans` through `dzsm2dbswvuqy.cloudfront.net` returned `"country":null`, which fits the unread origin request policy above. Prices and the planned page timings by country depend on it. Status: open. Done: a request through CloudFront returns its country.

## Filed 2026-11-01 by the privacy planning session (docs/privacy/01-encryption-and-bedrock-plan.md)

Found by reading code; live rows and deployed env were not read. Fixes are sequenced in that plan. Open, unless a line says otherwise.

- **P1: One person's life story can reach other users.** `src/reading/timeline/pastReadingFlow.ts:359,511` builds the past-reading report from hardcoded narrative about one person's family, business and money; the builders ignore their input (`_inputs`) and run for every report (`:1283-1287`). Reachable when `TIMELINE_ENABLED=1` (deployed value unread). Owner: reading-dev. Done: reports use only the requester's own inputs, with a test using a second chart.
- **P1: A secret was printed into a session transcript on 2026-11-01.** A read-only sub-agent's `.env` grep printed `ASTROKUNDLI_API_KEY`. The value is not repeated here. Owner: Sachin. Done: key rotated in `.env` and in the Lambda config.
- **P1: Personal data in logs.** `server.ts:141-146` logs 300 characters of every GraphQL body (emails, sign-in codes, questions). `src/lib/astroKundliClient.ts:839-848` logs 1,500 characters of every Radha response. `src/services/kundliService.ts:120-125` logs raw model output. Radha logs place, coordinates and birth data and appends responses to `logs/export.log` (`src/jhora/export.py:481,496,503,1284,1407`). Owner: dev session. Done: lines removed and `noPiiInLogs` test passing; existing CloudWatch logs given a retention decision by Sachin. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** the three server lines are gone and `tests/unit/noPiiInLogs.test.ts` passes; the engine-side logging and the CloudWatch retention decision are still open.
- **P1: `encrypt()` can silently store plaintext.** `src/lib/encrypt.ts:30` returns the input when `ENCRYPTION_KEY` is unset, and `:59-61` returns ciphertext on a failed decrypt. Local `.env` has no key; deployed value unread. Owner: privacy plan phase 3. Done: replaced, with no plaintext path. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** no caller imports `encrypt.ts` any more; reads go through `src/lib/pii` (a failed open throws `PII_UNAVAILABLE`). The file itself is deleted in B5.
- **P2: Admin birth-data handling.** `src/services/adminService.ts:106-108` writes birth fields unencrypted; `adminGetUser` returns them undecrypted (`src/graphql/schema.ts:897`); `adminGetUserKundli` (`:1010`) returns full charts. Role comes from the JWT, not the database (`src/graphql/context.ts:48`). Done: masked, per plan section 4.3.
- **P2: Debug and event routes.** `GET /debug/kundli/:user_id` (`server.ts:371`) closes only when `NODE_ENV` is `production`, and the Lambda runs as `staging`; it returns the caller's own chart. `POST /events` passes when no token is configured (`src/services/kundliSyncWorker.ts:50`). Done: debug route removed, token mandatory. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** `/debug/kundli` removed; kundli-sync events are refused when `KUNDLI_SYNC_EVENT_TOKEN` is unset (see the ship gate below).
- **P2: Birth place sent to OpenStreetMap.** `src/reading/chartData/store.ts:582` and Radha `src/jhora/export.py:501` send the place string to Nominatim when no coordinates are known. Done: both removed, with the "pick a city" state. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** the server fallback is gone (`resolveFallbackCoords`); the engine side is still open.
- **P2: Chart hashes are unkeyed.** `kundli_facts.source_hash` is a SHA-256 over stored birth fields (`src/reading/data/factsBuilder.ts:40`), `dossier_hash` (`:54`), and `payload_hash` is an MD5 (`src/reading/chartData/store.ts:607`). Birth data is guessable, so an unkeyed hash reveals it. Done: keyed, per plan 4.1.
- **P2: Personal data in the browser after sign-out.** `astroUser` keeps name and email in localStorage (`AIAstra_WEB/src/routes.tsx:98`, `src/App.tsx:35`); the birth draft and location stay in sessionStorage (`src/Auth/BirthDetails.tsx:94`, `src/pages/chat-interface/useQuestionLocation.ts:47`); logout clears neither (`src/Auth/logout.ts:19-24`). Done: per plan 4.4.
- **P2: Groq is the code default for chat.** `src/config/env.ts:254` falls back to `groq` when `CHAT_LLM_PROVIDER` is unset, which sends biodata and charts to Groq. Deployed value unread. Done: provider removed, per plan phase 2.
- **P2: Legacy Gemini cache is not deleted at logout.** `src/services/geminiCacheService.ts:224-246` uploads charts to Google for 7 days on login and signup. Done: removed, per plan phase 2, and Google lists no caches.
- **P3: Personal data in the repo and scripts.** `evals/fixtures/G1/` and `docs/reading-engine/36-*`, `37-*` hold Sachin's own birth data and life details; `kundli.json` is tracked, contents not inspected. `scripts/backfill-local-facts.ts:68-86` writes every kundli's birth data to a local JSON file. Owner: Sachin decides what to do with their own data. Done: `kundli.json` inspected, the script removed, and any exports it produced found and deleted.
- **P3: Stale leftovers.** `login_attempts` exists by migration only, with no schema or code; `supabase/migrations` protect no current path; `server.ts:79` still allows `aiastraweb.onrender.com`; `src/services/recaptchaService.ts` has no importers. Done: each removed or kept on purpose.
- **Gemma 4 vs the catalogue.** AWS announced Gemma 4 on Bedrock and the pricing page lists it, but `list-foundation-models` in us-east-1 (account 900515855120, 2026-11-01) returned only Gemma 3. Likely another endpoint; not checked, because Gemma is only a control arm in the eval. The AWS MCP server's credentials were expired, so the catalogue in 442728149528 is still unread. Done: read in phase 1.

## Filed 2026-11-02 by the public-assistant session (docs/assistant/03 and 04)

- **P1: Nova 2 Sonic cannot serve the public agent.** AWS's model card gives 20 concurrent sessions per account per Region, not adjustable, in four Regions, and no Guardrails. A direct browser call also puts the brief in the browser. See `docs/assistant/04`.
- **P1: Voice quotas are unconfirmed.** Transcribe's concurrent streams default (25, from one re:Post article), Bedrock tokens per minute for Nemotron, and Lambda concurrency must be read in Service Quotas before any launch above the first cap.
- **P2: The testbed covers WebRTC only.** The route chosen in `docs/assistant/04` uses WebSocket and HTTP, so `testbed/voice` must be extended before its results say anything about release.
- **P2: The testbed's relay stalled for seconds on this machine.** In the 2026-11-02 run, `short spike` showed a burst of 390 packets and the relay's scheduled network changes never applied. The clean-line loss in `fast` and `light loss 2%`, and the missed recovery in `fast then throttled`, are probably the same stall, not proven. Cause not found. `run.mjs` now measures stalls and reruns.
- **P2: "No packets means dead" would misfire on a real agent.** `toSample` in web `src/lib/voice/quality.ts` counts a silent second as total loss, but a real agent may send nothing while listening. Needs a keepalive if WebRTC returns.
- **P3: The Privacy Policy line in `DATA_REPLY` assumes the policy answers storage questions.** Sachin should read it against the policy before launch.

## Filed 2026-11-04 by the admin and encryption planning session (docs/admin/01, docs/privacy/02)

Plans: `docs/admin/01-admin-panel-users-and-agent-metrics.md` (users, lock-out, quota, plan, agent speed and cost per query) and
`docs/privacy/02-birth-data-charts-and-wire-build-plan.md` (the encryption track of docs/privacy/01 as a build plan). Found reading
the code on 2026-11-04; nothing below was verified on live rows. Each item names the plan step that closes it.

- **P1: Nobody can be locked out.** `auth.is_active` is read only by `myBiodata` (`src/graphql/schema.ts:607`), one other resolver (`:713`)
  and the chart-sync sweeps (`src/services/kundliSyncWorker.ts:244,268`). Sign-in (`authService.ts:128-159`, `auth/emailCode.ts`), `ask`,
  `/api/chat/ask-stream`, `/api/chat/confirm-stream`, billing and timeline routes never read it, and authorisation comes from the 7-day JWT
  (`graphql/context.ts:32-55`, `server.ts:165-182`), so a role change waits for the next sign-in and a token cannot be revoked. Status: open.
  Done: admin plan phase A1 (`src/auth/requestAuth.ts`, `locked_at`, `token_version`).
- **P1: `adminUpdateUser` always reports success.** `schema.ts:1386` ignores the `{success:false}` from `adminService.updateUser`, and
  `adminService` manages only `MANAGED_ROLES = ['astrology_student','astrologer']` (`adminService.ts:4`), so no `novice` user can be listed or
  edited. Status: open. Done: admin plan A2 replaces these operations.
- **P2: Quota exemption uses raw role strings.** `src/billing/plans.ts:41` `EXEMPT_ROLES` lists `support, admin, superadmin, aiastra_admin,
  astrologer` and compares the raw row value, so `researcher` is not exempt and `roles.ts` is not the source. Status: open. Done: A1 step 3.
- **P2: Superadmin bootstrap is dead weight.** `src/ensureSuperadmin.ts` upserts a `superadmin` row with a bcrypt password, but there is no
  password sign-in; the row can only sign in if `SUPERADMIN_EMAIL` receives mail, and the variables are not on the Lambda. Status: open.
  Done: A1 step 3 (`ensureAdmins` from `ADMIN_EMAILS`).
- **P2: Metrics spans drop the subject and traces carry no technique label.** `src/reading/metrics/trace.ts:224` keys stages by `name|subject`
  but `reading_agent_spans` has no `subject` column, so a 3-subject graph run writes three indistinguishable `dasha` rows; `reading_traces` holds
  only `flow`, while `bucket`/`template` live in `reading_runs.intent.classification`, `tier` in `reading_runs.cache`, and the plan-B `route` is not
  persisted. Status: open. Done: A3 step 6 (M24).
- **P2: Metrics have no retention and no "lost" handling.** A dead process leaves `reading_traces.status = processing` forever; spans grow
  with every query (doc 41 §9). Status: open. Done: A3 step 7 (`/internal/metrics-retention`, `METRICS_RETENTION_DAYS`).
- **P2: Bedrock calls are unpriced in the metrics.** `src/reading/llm/models.ts:37-55` has no Bedrock rows, so every clarifier span stores
  `est_cost_usd = null` and counts in `unpriced_calls`. Status: open. Done: a dated price row per Bedrock model in `PRICES`.
- **P2: `birthPlaceFor` reads `place_of_birth` without decrypting.** `src/services/userLocation.ts:131-137` feeds the clarify "Same as birth
  place" chip from the raw column; with `ENCRYPTION_KEY` set it would show ciphertext. Status: open. Done: privacy plan B1.4. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** it reads through the client PII extension, which opens sealed and legacy values.
- **P2: Model thinking is streamed to the browser.** `src/reading/run.ts:334` sends `thought` deltas over SSE; they mention chart details and
  are already kept in `reading_runs.thinking`. Status: open. Done: privacy plan B0.2. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** no `thought` frame is sent; web branch `feat/privacy-b0-web` (07f1293) drops the handler and the panel.
- **P2: SSE sends `no-cache`, not `no-store`; GraphQL sends no cache header.** `server.ts:222`, `routes/clarifyRoutes.ts:45`. Status: open.
  Done: B0.3 and admin step 5. **Fixed on branch `claude/brave-hamilton-8eb27c` (2026-11-04, not merged or deployed):** `no-store` on every response (middleware before all routes, GraphQL with or without a token), `no-store, no-transform` on both SSE routes.
- **P3: Web `PlanStatus.window` type is incomplete.** `AIAstra_WEB/src/lib/billing.ts:13-27` allows `'month'|'none'` but the server can send
  `'day'` (`PLAN_UNLIMITED_DAILY_GUARD`). Status: open. Done: type widened and the day case shown.
- **P3: `morgan` is in `package.json:62` and never imported.** Status: open. Done: removed.

### Added later on 2026-11-04 while building (branch `feat/admin-a1-lockout`, admin repo `sachinm/aiadastra_admin`)

- **P1: Ship order for `feat/admin-a1-lockout`.** Sign-in and the code-send lookups now select `auth.locked_at` and
  `token_version`, so the code needs M23 in the database first. M23, M24 and M25 were applied to the shared database on
  2026-11-04 (standing OK for testing), so the order is already safe; any other database this code runs against needs them
  first. Owner: deploy session. Done: the branch deployed and a locked test account refused on `/api/chat/ask-stream`.
- **P1: A real-looking `SUPERADMIN_PASSWORD` is in git history.** The removed `.env.example` lines held one. Found by the
  build agent on 2026-11-04. If that value was ever used anywhere, rotate it. Owner: Sachin. Done: confirmed unused or rotated.
- **P2: Eight unit-test files fail on this machine** (44 tests): `auth/emailOnlySignup`, `auth/registrationV2` (the local `.env`
  sets `AUTH_PROVIDER=cognito`, so local-provider tests call real Cognito), `env.test`, `geminiChatService`,
  `astroKundliExportSpacing`, `reading/promptCache`, `reading/fullPrefixCache`, `reading/run` (cache, thinking and engine
  settings read from `.env`). Measured 2026-11-04: clean `develop` (2ca2206) fails the same 38 tests by name as
  `feat/admin-a1-lockout`; the branch adds only its 4 new lock tests in `emailOnlySignup`, which fail for the same Cognito
  reason and pass with `AUTH_PROVIDER=local`. So the branch causes no regressions; the 38 are pre-existing. Owner: next dev
  session. Done: the tests set the env they need (no `.env` leakage) and all eight files pass.
- **P2: A lock reaches other Lambda instances only after their 30 s auth cache expires.** The admin app runs in its own
  Lambda and cannot clear the main API's cache. Accepted for now. Done: a shorter TTL, or a cache keyed on `token_version`.
- **P2: The main web shows no locked screen.** A locked person's next request gets 401 `account_locked`; the web treats it as
  a session end and signs out, and sign-in then says "This account is locked." Done: a dedicated locked page
  (`docs/admin/01` step 9).
- **P3: `ADMIN_EMAILS` no longer grants admin-app access.** Staff sign in with `admin_accounts` (M25) since 2026-11-04;
  `aiastra_admin` on a customer row now only exempts it from the question quota. The old admin GraphQL operations
  (`adminListUsers`, `adminGetUserKundli` and the rest) still exist and still return birth data and charts. Done: removed.

## Filed 2026-11-04 by the privacy B0/B1 build session (branch `claude/brave-hamilton-8eb27c`, web `feat/privacy-b0-web`)

Built phases B0 and B1 of `docs/privacy/02`. Nothing is pushed, merged or deployed, and no AWS resource was created.

- **P1: Ship gate for B0: `KUNDLI_SYNC_EVENT_TOKEN` must be set first.** The token is now mandatory: with it unset, `/events`
  refuses every kundli-sync and kundli-sync-sweep event. Doc 38 still lists the token as "not confirmed applied". If it is missing,
  the self-invoke is skipped and the request runs the gate-only fallback instead (`kundli_sync_token_missing` in the queue log),
  so the rest of the chart waits for a sweep that would also be refused. Owner: deploy session. Done: the token is set on the API
  Lambda and in the `kundli-sync-sweep` rule input before this branch deploys.
- **P1: Ship gate for B1: confirm `ENCRYPTION_KEY` on the live Lambda (B0.4) before deploying.** B1 removes the `encrypt()` calls, and
  writes stay plain until B3. If the live Lambda has the key set, new birth fields become plaintext where they were `enc:`. Reading old
  `enc:` rows still works while the key is present. Owner: deploy session or Sachin. Done: the key's presence is read (not printed). If it is set,
  B1 waits for B3, or Sachin accepts plain writes until then.
- **P2: `timeline_calibration.marker` cannot be sealed as planned.** Doc 01 §4.1.3 seals `marker` and the scores, but `marker` is part of
  the table's primary key (`kundli_id, system, marker`), so a random-IV seal would break the upsert. The scores are Float columns with no
  sealed home in M26. Both stay plain for now (`src/lib/pii/fields.ts`). Owner: privacy plan B2. Done: either a keyed deterministic form for
  `marker` and a sealed JSON column for the scores is added to M26, or Sachin accepts them plain.
- **P2: The extension is not yet tested against a real database.** `tests/unit/pii/prismaExtension.test.ts` runs the query handler on
  every model in the field map, with a recording fake and the generated client's real datamodel. Plan B1.2 asks for a test database, and
  none exists here. Owner: B2. Done: `tests/integration/piiAtRest.test.ts` runs against a throwaway database and reads raw rows
  through a second plain client.
- **P2: The PII guard throws at run time on any filter or sort on a sealed column.** A grep found only the old admin user search, which
  now matches exactly on id, username or email (no substring search). tsc cannot see these cases, so a path the grep missed will
  fail with `PII_GUARD`. Owner: deploy session. Done: the staging smoke test (sign-in, chart view, one reading, profile edit, admin list)
  passes on this branch.
- **P2: Seven scripts make their own `new PrismaClient()` and skip the extension.** These are `backfill-local-facts`, `build-facts-for-all`,
  `build-transit-charts`, `e2e-live-db`, `oracle-slice-sizes`, `sync-chart-catalog` and `check-assistant-store`. That is harmless while every
  row is plain, but they would read ciphertext once rows are sealed. Owner: B4.2. Done: each one uses `src/lib/prisma.ts` or is deleted.
- **P3: Engine error text can still quote the birth place in stored errors.** Log lines now carry only the HTTP status for engine
  errors, and `queueLog` redacts dates, times, coordinates and emails in `error`. The full engine message (with its `detail`) is still
  thrown into `kundli_data.error` and `kundlis.last_sync_error`, which are sealed columns once B3 is on. A place name cannot be masked by
  its shape. Done: the engine returns an error code, and only the code is logged.
- **P3: Keyed hashes are not used yet.** `src/lib/pii/hash.ts` gives each hash site an HMAC form with the person's hash key. No caller
  passes one yet, because `key_ref` arrives with M26. Without a key the hashes are the same digests as before, so no dossier rebuilds.
  Owner: B3/B4. Done: the hash sites pass `hashKeyFor(key_ref)`, and the backfill rewrites `source_hash`/`dossier_hash` in the same
  transaction as the seal.
- **P3: Local development key.** `PII_LOCAL_KEY_FILE` for local sealed-mode testing points at `C:\Users\Owner\.aiastra\pii-local-key`
  (32 random bytes as hex, outside every checkout, value not recorded anywhere). Writes stay plain unless `PII_WRITE_MODE=sealed` is set.
- **P3: Web findings from the B0 web build (`feat/privacy-b0-web`).** (1) `SignIn.tsx` passes the bare user id string to `handleSignIn`, and
  the prop is typed `any`; `App` now copes with it. (2) Old `aiastra.registration.details` / `aiastra.questionLocation` values already in a
  tab's sessionStorage are not read any more. They stay until the tab closes or the user signs out. (3) Sign-out now removes the
  visit id (`aa_visit`), so the next anonymous page logs a new visit. (4) ESLint errors on untouched lines: `no-explicit-any` in
  `MantrasSection.tsx` and `RemediesSection.tsx`, and an unused `_user` in `ChatSection.tsx`. Done: each fixed or accepted.

- **`transit_instants` payloads come in two shapes.** Found 2026-11-04 while reading Sumit's daily sky rows for the
  week-by-week career document: of 833 San Jose rows between 2026-09-25 and 2029-01-05, 556 carry
  `{at_jd, at_local, charts:{d1:{lagna, planets}}, divisional_chart_factors}` and 277 carry the flat
  `{at_jd, lagna, planets, ...}` with no `charts` and no `at_local`. A reader that takes `payload.charts.d1` skips a third
  of the days. Fix: normalise on write in `reading/transits/ephemerisCache.ts` (one shape, `at_local` always set) and
  re-wrap the flat rows in place. Owner: reading-dev. Done: every row in the table has `charts.d1` and `at_local`.
- **The sky and the overlay are ready, but the daily pull for Sumit has not run.** 2026-11-04. Jobs `npm run transits:sky`
  and `npm run transits:overlay` exist (branch `feat/shared-transit-sky`), dry runs show San Jose daily 2026 to 2028 and
  Sumit's daily overlay (kundli 75b0d618) both missing. The real pull failed here with "Could not load credentials": the
  engine Lambda needs credentials that `aiastra-ops` was never granted. Fix: run both through the deploy session (6 engine
  calls, no Gemini), then regenerate the day layer of `Sumit-career-week-by-week-2026-10-to-2028-12.docx` from the stored
  overlay instead of the scratch script. Owner: deploy session. Done: both dry runs report 3 cached, and the document's
  provenance line no longer says the day layer was counted by a script.
- **The reader still builds a full per-kundli transit chart.** 2026-11-04. `loadTransitChart` in `reading/data/store.ts`
  builds the engine's `transits` export per kundli and keeps it in `transit_snapshots` (once per kundli per 24-month
  horizon, no daily job any more). That payload mixes the shared sky with the person's placements and also carries fields
  the range export does not (`influences_houses`, `sav`, `bav`, `over_natal`, `double_transit`). Fix, in the engine: serve
  those fields from `transit_range` with natal data (or split `transits` into a sky part and an overlay part), then build
  the reader's `TransitChart` from the shared sky plus `kundli_transit_overlays`. Hands-off until the engine pass, so only
  filed. Owner: reading-dev with the engine pass. Done: no `transit_snapshots` row is written per kundli.

## Filed 2026-11-05 by the career area-reading planning session (docs/reading-engine/42, 43)

- **P2: Questions are not labelled by bucket, so nothing can be ranked from our own users.** 2026-11-05. `reading_traces`
  holds four rows and all have `bucket` null; the clarify `subBucket` lives only inside `intent_confirmed` JSON. Doc 43 §2
  ranks career sub-areas from outside sources until we have 500 labelled career questions. Owner: reading-dev. Done: each
  trace has its bucket and sub-bucket, and a count query by sub-bucket works.
- **P2: Ledger categories cannot record most career events.** 2026-11-05. `src/reading/timeline/ledgerCategories.ts` has
  only job start, end, promotion, transfer and role change. The career map's feedback needs salary change, gap, work
  travel, relocation for work, recognition, team, business start, offer and visa (doc 42 §B.3). Owner: reading-dev.
  Done: the categories exist in server and web and have tests.
- **P2: Only four of 17 career sub-areas have a classifier sub-bucket.** 2026-11-05. `src/reading/buckets/taxonomy.ts`
  has job change, promotion, job search, workplace trouble and career direction; doc 43 §2 ranks 17 (job security,
  abroad, government job, business, salary, exams, transfer and others are missing). Owner: reading-dev. Done: Tier 1 and
  Tier 2 sub-areas have sub-buckets and cues, with classifier tests.
- **P3: Conditional dasha checks missing for two systems.** 2026-11-05. `dasha.applicable` returns `applies: null` for
  Shattrimsa Sama and Shodasottari ("deva/pitri hora rule not implemented"), so the career map cannot know whether they
  apply. Owner: engine pass (hands-off until Sachin opens it). Done: both return true or false.

## Filed 2026-11-05 by the life-boards design session (docs/reading-engine/45)

- **P2: No `self` marker and no annual (S5) system in the timeline engine.** 2026-11-05. `src/reading/timeline/markers.ts`
  has no house-1 marker (health is the only one using house 1) and `converge.ts` has no annual system. The You board
  (doc 45 §8.3) needs both. Owner: reading-dev. Done: a `self` marker (houses 1, 4, 5, 9; Su Mo Ju; AK; A1; D1, D9, D20)
  and S5 from Tithi Pravesha, with tests.
- **P2: No two-chart output (no Ashtakoota or synastry).** 2026-11-05. Neither the catalog nor the engine calls hold
  compatibility. Love's "is this the right person" worry and partner comparison (doc 45 §8.2) wait on it. Owner: engine
  pass (hands-off until Sachin opens it). Done: a two-chart type served and stored.
- **P2: No daily panchang, tarabala or chandrabala fetch.** 2026-11-05. `daily_grade` and `muhurta` exist in the
  catalog with "no server fetcher yet" (`src/reading/chartData/store.ts`). Today's line and Good for / Better to wait
  (doc 45 §4.1) need them. Owner: reading-dev with the deploy session. Done: a fetcher and daily rows per person or from
  the shared sky.
- **P2: Past-reading ratings may not persist.** 2026-11-05. `past_life_reading` is not seeded in `chart_data_types` and
  the foreign key is restrictive, so the upsert likely fails and `pastReadingFlow.ts:1125-1191` falls back to memory.
  Verify against the live table first. Owner: reading-dev. Done: ratings survive a restart.
- **P3: Annual Tithi Pravesha D10 is not pulled by default.** 2026-11-05. Only D1 for the current year is requested at
  registration. The Work board's annual check (doc 43 §3.3) needs `divisional_chart_factor=10`. Owner: reading-dev.
- **P3: Mantras and Remedies colours never render.** 2026-11-05. `AIAstra_WEB/src/pages/dashboard/mantras` and `remedies`
  build Tailwind classes at runtime (`from-${color}-900/10`), which are never generated; the mantra play button is a fake
  progress bar. Owner: web-dev. Done: static class map; the button plays or is removed.
- **P3: No design tokens or shared card in the web app.** 2026-11-05. `tailwind.config.js` has an empty `theme.extend`
  and the same card class string is copied into every profile file. Fixed in doc 45 step 2. Owner: web-dev.

## Filed 2026-11-05 by the house-state engine planning session (docs/reading-engine/46)

- **P2: Engine (pyjhora) house-class lambdas return non-classical offsets.** 2026-11-05. In
  `AIAstra_Radha/src/jhora/horoscope/chart/house.py`: `dushthana_aspects_of_the_raasi` gives offsets 0, 2, 6 (houses 1,
  3, 7, not 6, 8, 12); `upachaya_*` gives 0, 3, 7, 8 (houses 1, 4, 8, 9, not 3, 6, 10, 11); `chathusra_*` gives 2, 4
  (houses 3, 5, not 4, 8). `reading_tables_export` uses its own correct constants, so served tables are unaffected, but
  any new type built on these lambdas would be wrong. Owner: engine pass. Done: lambdas match the classical sets or are
  removed, with tests.
- **P3: `house.marakas_from_planet_positions` prints debug output.** 2026-11-05. Stray `print` calls in the engine; noise in
  Lambda logs if the function is ever served. Owner: engine pass.
- **P3: `yoga.get_yoga_details` ignores `chart_method`.** 2026-11-05. It builds positions with `drik.dhasavarga` (cyclic),
  so varga yogas would use the cyclic method regardless of the catalog's chart method. Blocks serving yogas on vargas
  (doc 46 §C.1). Owner: engine pass.
- **P3: Two Tajaka yogas are stubs.** 2026-11-05. `tajaka_yoga.gairi_kamboola` and `khallasara` return None. Doc 46 §B.6
  lists them as gaps. Owner: engine pass.
- **P3: No gochara vedha in the engine.** 2026-11-05. Nothing computes vedha points for transits; `const.paachaadi_relations`
  "vedhaka" is unrelated. Doc 46 §B.5 marks the gochara row as partial. Owner: engine pass (new code).
- **P3: Yoga messages missing for `vihanga` and `hara`.** 2026-11-05. 95 yoga functions, 93 rows in `lang/yoga_msgs_en.json`.
  Owner: engine pass.
- **P2: Annual Tajaka layer not served.** 2026-11-05. Muntha (`tajaka.muntha_house`), year lord (`tajaka.lord_of_the_year`),
  Tajaka aspects and yogas (`tajaka_yoga.get_*_planet_pairs`), sahams on the tithi pravesha chart (`saham.*(pp)` takes
  positions) and yogas/doshas/ashtakavarga on the annual chart are all computed by the engine but have no Lambda type.
  Doc 46 §C.1 asks for `annual.tajaka@Y` and a positions option. Owner: engine pass (hands-off until Sachin opens it).
- **P3: `transit_ashtakavarga` and `daily_grade` have no server fetcher.** 2026-11-05. Both are served by the engine and
  listed in the catalog as moving types; `store.ts` refuses moving types and nothing else fetches them. Doc 46 §B.5 and
  doc 45 §4.1 need them. Owner: reading-dev (Node fetch only, no astrology).

## Filed 2026-11-05 by the lucky-times planning session (docs/reading-engine/47)

- **P3: Engine `drik.nakshatra` start time is wrong when the star began the previous day.** 2026-11-05. `daily_export._star_span`
  works around it; any new type calling `drik.nakshatra` directly inherits the bug (so do `amrita_gadiya` and `varjyam`
  in drik). Owner: engine pass. Done: `nakshatra()` returns the true start or the export's `_star_span` is the shared path.
- **P3: Engine `panchanga_at` returns noon values only and drops a second tithi, star or yoga in the same day.** 2026-11-05.
  `prashna_export.panchanga_at`; the extra tuple drik returns is discarded. Doc 47 §3.3 asks for sunrise values and a
  `changes[]` list. Owner: engine pass.
- **P3: Engine `_resolve_place` uses today's UTC offset from Nominatim for any non-Indian city.** 2026-11-05. `export._resolve_place`
  → `utils.get_place_timezone_offset` (timezonefinder at "now"); the bundled `data/world_cities_with_tz.csv` with IANA
  zones is not consulted. Callers must pass `params.tz_name`; doc 47 §3.3 asks the API to resolve it. Owner: engine pass.
- **P3: Engine `drik.vaara` turns to the next weekday just after local noon.** 2026-11-05. Documented in `docs/daily-types.md`
  and worked around in the export; a direct caller gets the wrong weekday in the afternoon. Owner: engine pass.
- **P2: Served day functions not exposed: moonrise/moonset, choghadiya, amrit kaal, lunar month, samvatsara, chandrashtama, udaya lagna, festivals.**
  2026-11-05. All exist in `drik.py` / `vratha.py`; no Lambda type returns them. Doc 47 §3.3 lists the additions. Owner:
  engine pass (Sachin opens).

## Filed 2026-11-05 by the day-tables Phase 0 check (docs/reading-engine/47 §9)

- **P3: Engine sunrise and sunset differ from Drik Panchang by 3–6 minutes, one way.** 2026-11-05. On 5 Nov 2026 at New
  York, Chicago, Denver, San Jose and Pune the engine's sunrise is 3–4 min later and sunset 4–6 min earlier than Drik's
  (a shorter day), so brahma muhurta and yamaganda shift by the same amount; abhijit, rahu kaal, gulika and dur muhurta
  stay within 1–3 min. Looks like the solar-disc and refraction convention (`drik.sunrise`/`sunset` with swisseph flags:
  centre of the disc without refraction vs Drik's apparent rise of the upper limb). Owner: engine pass. Done: a documented
  setting, default matching the apparent sunrise, and the five rows within ±2 min of Drik.
- **P3: Engine varjyam uses a midnight-to-midnight day; Drik uses sunrise-to-sunrise.** 2026-11-05. New York engine
  varjyam 00:20–01:58 (the previous star's window in today's small hours) vs Drik 02:06–03:45 next morning (today's
  star's window inside the panchang day); Denver returns none. Amrita gadiya matched because it fell in daylight. Owner:
  engine pass. Done: `muhurta` days return the windows of the sunrise-to-sunrise panchang day (or both, flagged).
- **P3: Noon-only panchanga shows the next tithi where Drik shows the sunrise tithi.** 2026-11-05. Pune: engine
  Dwadashi (noon) vs Drik Ekadashi until 10:35; the same gap already filed under doc 47 (second tithi, sunrise values).
- **P3: `fetchEngineExportAtPlace` returns the payload without the engine's `calc_version` wrapper**, so
  `scripts/pull-day-tables.ts` stored `calc_version` null for all 150 rows. Fixed in the script by reading the catalog's
  version for the type; a client variant that returns the wrapper would be cleaner. Owner: reading-dev.

## Filed 2026-11-05 by the Lucky times v1 build (docs/reading-engine/49)

- **P2 (for Fable): write doc 50, the efficient personal calculation plan for Lucky times.** 2026-11-05. How to compute the
  personal layers at hour, week and month resolution for every user: when to pull `daily_grade` versus `muhurta` with
  natal fields, sharing the per-place day once and fanning out only tara, chandra bala and the Moon's house, cache keys
  and invalidation by `calc_version`, a nightly sweep of the next 14 days for active users, cost per thousand users, and
  how the scenarios held back in doc 49 §3 come in after the engine pass. Owner: Fable. Done: doc 50 written and reviewed.
- **P3: Tithi and star groups are a config lookup in Node** (`src/reading/luckyTimes/scenarios.ts`). 2026-11-05. CLAUDE.md
  says Node computes nothing astrological, not even a lookup; the muhurta groups (Nanda…Purna, fixed…mixed) should come
  from the engine with each day row. Owner: engine pass. Done: `muhurta` days carry `tithi.group` and `nakshatra.group`
  and scenarios.ts reads them.
- **P3: The personal overlay shape is unverified.** 2026-11-05. `lucky.day_overlay` reads `days[].tara.good` and
  `days[].chandra_bala.good` per the engine's `docs/daily-types.md`; no real overlay has been pulled yet (no engine
  credentials locally). Owner: reading-dev. Done: one real month pulled and the board shows the personal boost.

## Filed 2026-11-05 by the career map Phase 1 build (docs/reading-engine/42, 43)

- **P2: Lucky times routes were not mounted in b434dc8.** 2026-11-05. `server.ts` imported `registerLuckyRoutes` but the
  call was lost to a CRLF mismatch in the patch. Fixed in the career Phase 1 commit; `tests/unit/serverMounts.test.ts`
  now fails when a route module is imported and not called. Status: fixed.
- **P2: Career present state uses five of the seven families.** 2026-11-05. The conditional-dasha, annual (Tithi
  Pravesha) and karaka-dasha families of doc 43 §8.1 are not built, and the D1/D10 check of each dasha vote waits for
  the house-state engine (doc 46). `src/reading/area/career.ts` scales the confidence to the families available and
  says so in `notes`. Owner: reading-dev. Done: seven families, each dasha vote checked in D1 and D10.
- **P2: `person_facts` values are stored plain.** 2026-11-05. Doc 48 says sealed with the per-user keys of the privacy
  plan; sealed writes are not live yet (docs/privacy/02). Owner: privacy pass. Done: values sealed like the ledger.
- **P3: Career sub-areas come from the career marker's drivers, not sub-markers.** 2026-11-05. Phase 1 labels windows
  (promotion, job change, getting a job, security, pay, abroad, business) by the planets that drive their peak; doc 42
  §A.2 wants each sub-area as its own marker with its own signification. Needs `MARKER_IDS` to become a parameter
  (signification, converge and five activators loop over it). Owner: reading-dev.
- **P1: No audit log of account changes.** 2026-11-05. Profile edits, sign-in and OTP, plan and billing changes,
  `person_facts` upserts and photo replacement overwrite their rows with no record of who changed what, when or from
  where. `admin_actions` exists but nothing writes it, and it covers staff only. Clicks are logged separately in
  `analytics_events`; this is a different kind of log. Owner: server. Done: an `account_events` table (actor self/staff,
  action, before/after field names, ip prefix, at) written by `updateProfile`, the auth flows, billing, facts and photos;
  shown on the admin User detail page.
- **P2: No Techniques section in the Admin Panel.** 2026-11-05. Nobody can see how Happy Hour(s) scores a window or
  which rules each scenario uses, except in `scenarios.ts` and `windows.ts`. See docs/admin/02. Owner: admin. Done: a
  staff-only scenario list and a day view with scores and reason codes.
- **P2: The lucky-times API sends window scores and reason codes to the user app.** 2026-11-05. The page does not
  show them, but they are in the network response (`tithi:bhadra`, `hora:Venus`). Owner: server. Done: user responses
  carry only what the page shows, and the reasons move to the admin API.
- **P2: Research-flag chart view lives in the user app.** 2026-11-05. `ChatRightSidebar.tsx:207-215` shows raw biodata,
  D1/D7/D9/D10 and the dasha to research-flag accounts. Owner: admin. Done: moved to the Admin Panel's Techniques section.
- **P3: Analytics events and account audit have no retention.** 2026-11-05. `analytics_events`, `agent_runs`,
  `ReadingRun` and the other system logs are kept until the user is deleted. Owner: privacy pass. Done: a retention
  rule per table in docs/privacy, and a sweep job.
- **P2: Account-change log is written but not yet shown or complete.** 2026-11-05. `account_events` (migration
  `20261105240000`) records profile edits, plan choice, gateway payment changes, sign-in and out, facts and photo, each
  with IP, forwarded chain, user agent, language, country and request id. Missing: sign-up completion, the admin User
  detail page to read it, retention, and an IP/user agent for gateway payment changes (the webhook Lambda has its own
  request; pass its facts to `setPayment`). Owner: server and admin.
- **P3: Signed-out walkthrough e2e is stale.** 2026-11-05. `e2e/walkthrough.spec.ts:83` waits for a region named
  "9,500 records", which the landing page now renders as a button. The run also deletes the committed screenshots when
  it fails. Owner: web. Done: spec follows the landing page, and a failed run keeps the old screenshots.

## Filed 2026-11-05 by the techniques-tagging build (docs/admin/03, branch `feat/techniques-tagging`)

- **P3: Spans written before the first subject is known are tagged `general`.** `src/reading/metrics/trace.ts` `tags()`
  takes the category from the span's subject, else the query's one subject seen so far; intake and early step spans
  come before any analyst names a subject, so they always read `general`. Owner: reading-dev. Done: intake labels the
  trace with its subjects (a `TraceLabels` field) and every span uses it.
- **P3: The single-call path has no technique.** `specialist:single` maps to agent `reading.specialist` with
  `technique_id` null (no catalogue row for the Phase 1 one-call path). Owner: reading-dev. Done: a `general.single`
  row, or the path is retired.
- **P3: Synthesizer spans join `reading.oracle`, not `reading.synth`.** The plan (docs/admin/03 §4.1) maps `synthesize`
  to `reading.oracle`, but the graph flow's synthesizer runs on the `synth` role's model, so the registry row the admin
  joins shows the oracle model and price. Each span still carries its own model and cost. Owner: admin. Done: decide
  whether `synthesize` gets `reading.synth`.
- **P3: `reading.clarify` is registered on Bedrock with no price.** It runs on `READING_MODEL_CLARIFY` (Bedrock), which
  has no row in `PRICES` (see the P2 "Bedrock calls are unpriced" item above), so its registry price is null. Owner:
  server. Done: closes with that item.
- **P3: The career present-tone confidence rule is Phase 1, not doc 43 §8.1.** `career.ts presentState` calls a tone
  confirmed at max(3, 60 % of the available families) with the main clock agreeing; doc 43 §8.1 asks for 5 of 7 (4 of 6)
  including the transit family and a D1/D10-validated main clock. The catalogue row describes the code as built. Owner:
  reading-dev. Done: the D10 check and the missing families land (catalogue rows `work.d10_check`,
  `work.*_family`) and the rule is moved to the doc's.

- **P2: CloudFront does not forward `X-Face-Box` to the API on staging.** 2026-11-05. The API's origin request policy
  forwards only Origin, X-Astra-Authorization, Accept, Access-Control-Request-* and Content-Type, so the selfie's face
  check header may never arrive and every upload could fail with no_face. The shared policy was left unchanged. Owner:
  deploy. Done: `X-Face-Box` added to the origin request policy, then a selfie upload checked on staging.

## Filed 2026-11-05 by the technique-contracts build (docs/reading-engine/53 step 0, branch `feat/technique-contracts`)

- **P2: The selector matcher is all-of; two doc 53 rows want any-of.** `src/techniques/contracts.ts selectorsMatch`
  requires every declared selector. Doc 53 §4.4 selects `general.annual_set` on "horizon within 24 months **or** question
  type timing" and `general.person` on "slot other_person **or** a person subject". The catalogue declares the first
  half of each (annual: horizons now/3m/6m/1y/custom; person: subjects children, siblings, marriage_relationship) and
  says so in `special`. **2026-11-06:** the person half is now an any-of rule in `src/techniques/use.ts` (the slot
  other_person selects `general.person` on any subject); the annual half stays. Owner: reading-dev. Done: the matcher
  gains an any-of group (or the row is split) and the annual selector says the whole rule.
- **P2: Analyst contracts name the v2 prompts and `findings.v2`, which only run under `READING_FINDINGS=v2`.**
  `src/reading/nodes/specialists.ts` picks `prompts/v2/<analyst>.md` and the v2 schema only when `readingFindingsV2()`
  is on; otherwise `prompts/<analyst>.md` and the v1 schema run. The catalogue rows general.promise / dasha / transit /
  nakshatra state the v2 path (`src/techniques/catalog.ts`). Owner: reading-dev. Done: the v2 flag is the default on
  staging (or the contract records both paths).
- **P2: Lucky scenario rows are not told apart by selectors.** All 13 `lucky.<area>.<act>` rows carry
  `{ boards: ['lucky'] }`: the act the person taps picks the scenario, which no clarify slot or fact expresses. The
  contracts test leaves them out of the "no two built rows share output, selectors and inputs" check. Owner: lucky.
  Done: a `scenario` selector (or the act as a slot) once the Lucky times board sends it.
- **P3: `general.clarify`'s system prompt lives in the database.** The clarify agent reads `clarify.system` from
  `system_prompts` (`src/reading/clarify/planner.ts getAgentPrompt`), so its contract says `db:clarify.system`;
  `contractProblems` accepts any `db:` name without checking it exists. Owner: reading-dev. Done: the check reads
  `BUILTIN_AGENT_PROMPTS` keys.
- **P3: `digest.*` rows select on every board.** They are the gate before every reading and board (doc 53 §4.7), so
  their selectors list all five boards; `run.ts` writes only built rows on the trace, so they do not show on traces
  until built. Owner: reading-dev. Done: the digest status gate lands (doc 53 step 1) and the rows become built.

## Filed 2026-11-05 by the activity and day review build (docs/admin/04)

- **P2: Board function runs are not grouped by the request that caused them (G2).** A Lucky times load writes 1 + N
  `agent_runs` rows with nothing tying them together, so the day review counts board loads only approximately (same
  user, module and minute). Owner: server. Done: `agent_runs.request_id` from the request id, and the admin groups by it.
- **P2: Click events cover only the new boards (G4).** `page_view` and `board_open` are sent by the Lucky times and area
  boards; Chat, Profile and the landing page send none, so sessions and page counts in the admin are partial. Owner:
  web. Done: every route sends `page_view` once per view.
- **P3: Engine pulls inside a reading are not spans (G5).** Chart-data fetches sit inside `step` spans, so their time and
  cache hits are hidden in the day review. Owner: reading-dev. Done: one span per engine call (type, cache hit, ms).
- **Decision for Sachin: question text in the admin (G7).** The day review shows what a question was about (category,
  subjects, horizon, type) and never its words. Showing words would be a superadmin-only, audited Reveal per query, like
  Reveal email. Owner: Sachin. Done: a yes or no recorded in docs/admin/04.

## Filed 2026-11-05: registry seeds on Lambda

- **P1 (fixed on `fix/registry-seed-on-lambda`, ships with the next server deploy): boot seeds never finished on Lambda.**
  `server.ts` started `seedAgentRegistry` and `seedTechniqueRegistry` without awaiting them, one upsert per row. Lambda
  freezes the process after each response, so on image `api-91859654255f` `technique_registry` stayed empty and the 8
  new agents were never written (the last `agent_registry` write, 22:08 UTC, came from the old image, before the 22:12
  M29 migration). Both are now one statement each and awaited in `start()` before `listen`, capped at 4 s. The rows
  were upserted by hand from the code's own definitions on 2026-11-05 at 22:20 UTC, so the Techniques page has data
  meanwhile; their model and price columns came from local settings and are overwritten by the first boot of the fixed
  image. Done: after that deploy, `updated_at` on both tables shows the boot time.
  **Verified 2026-11-05 23:01 UTC on image `api-bb4f4ff0e20f`:** both tables were written at boot (50 techniques, 20 agents).
  Delete this item once the measurement below is filed.
- **P3: Cold-start time after the awaited seeds is unmeasured.** Init Duration was 3178 ms and 2768 ms on image
  `api-bb4f4ff0e20f`, with no baseline from before the change. The seed wait is capped at 4 s. Owner: deploy session.
  Done: Init Duration from an image before `731acc7` compared with one after, and the cap lowered if the seeds take
  more than 500 ms.

- **P3: Check a real selfie upload on staging.** 2026-11-05. `X-Face-Box` was added to the API's CloudFront origin
  request policy `e1684868-b4fe-43b2-94ca-ac52642bd67d` (only the AI Astra API distribution uses it); the preflight
  allows it and an unauthenticated upload still returns 401, but nobody has proved the header reaches the origin.
  Owner: Sachin (needs a signed-in session). Done: a selfie uploads on vedic-astrology.app without a `no_face` error.
  Status of the earlier P2 above: header added, this is its check.

## Filed 2026-11-05 by the Lucky five limbs build (doc 54 S2, branch `feat/lucky-five-limbs`)

- **P2: Ship the web Why sheet before (or with) the server.** `GET /api/lucky/range` windows now carry
  `reasons: [{ key, scope }]` and the old strings move to `reasonKeys` (doc 54 §6). The web build on the same branch
  reads both shapes; the web build live today reads `reasons` as strings and would call `.startsWith` on an object.
  Owner: deploy session. Done: web `feat/lucky-five-limbs` live on Amplify before the server image that carries it.
- **P3: Yoga and karana names are matched by spelling.** The engine spells several names its own way (Soola,
  Vaidhrithi, Vriyana, Subha, Baalava, VishtiBhadra, Sakuna, Kimstugna); `scenarios.ts SPELLING` maps them to the
  classical names. A new engine spelling would silently match no rule. Owner: engine pass. Done: the engine returns a
  stable id per yoga and karana, or a test that fails on an unknown name in day_tables.

## Filed 2026-11-06 by the digest-core build (doc 54 S1, doc 53 steps 1–3, branch `feat/digest-core`)

M32 and M33 are applied to the shared database; the 24 research kundlis are digested (`ready`, 15,700 digest rows,
231,879 activation rows). Open items:

### P1: blocks or risks a release
- **P2: The digest sweep builds about 3 kundlis per run.** Wired 2026-11-08 on Sachin's yes: `KUNDLI_DIGEST_EVENT_TOKEN`
  on `aiastra-server-api` (copy in Secrets Manager `aiastra/kundli-digest-event-token`), EventBridge rule
  `kundli-digest-sweep` at `rate(5 minutes)`. The first sweep found 8 candidates and built 3 before its 60 s budget
  (`stopped_for_budget: true`). With the immediate trigger (a finished chart pull or a board that finds the digest
  missing self-invokes one build), the sweep is the safety net, so this only matters for backlogs. Owner: deploy
  session. Done: `DIGEST_SWEEP_MAX_MS` raised (the Lambda timeout allows it) or the backlog behaviour accepted.
- **The annual set was not proven against the engine locally.** `ensureAnnualSet` for kundli `3784ca07…` with a cap of 6
  reached ensureChartData and the engine client, which failed with "Could not load credentials from any providers"
  (transport `lambda`; no local credentials can invoke the engine, see memory `aws-working-commands`). Six
  `kundli_data` rows (annual 2026 D9/D10 and nearby keys of that kundli) are now `failed`; ensureChartData retries
  failed rows after 60 s, so the first sweep on the Lambda refills them. Done: one sweep on the Lambda logs
  `digest_sweep_done` with a top-up whose `fetched > 0`, and that kundli's `annual` section grows.

### P2: real, can wait
- **Four research kundlis hold old-shape rows** (`1ae7437b`, `6589af09`, `be89e63f`, `f3d117b0`): `dignities` at calc
  version 1 (planets only, no house table), no `dignities.dN` / `aspects.dN` / `house_counts` / `avasthas` / `.l3` trees,
  and annual year rows at calc version 1 (lagna and planets only). Their digest is partial (about 405 rows instead of
  about 690; D1 house cards come from the dossier, D2–D60 from the dossier's vargas, annual rows have no house cards).
  A `kundli-digest` event runs `buildDigest` with `fetch` for natal types and would refresh them; year rows are never
  re-fetched for a calc-version change (store.ts `needsFetch`: "a year=<y> row … is never re-fetched"), so those need
  a deliberate refresh. Done: the four reach about 690 rows with annual house cards.
- **Star names differ between payloads**: `dignities` writes Tamil names (`Uthiram`), the dossier Sanskrit (`Uttara
  Phalguni`), `varga.dN` abbreviations (`UPha`). The digest keeps each as written; a consumer must not join star names
  across sections. Done: the engine writes one naming, or the digest gains a label table from the engine.
- **Digest build time**: 5–22 s per research kundli from this machine to the shared database (most of it inserting
  about 10,000 activation rows in batches of 500). Doc 53 §4.1 expects under 10 s on the Lambda; measure there. If it
  is over, raise the batch size for `kundli_activation` or insert with one `unnest` statement.
- **Doc 53 §4.7 statement timeout of 2 s for digest reads is not set** (`load.ts` reads with the client default).
- **Fixed (2026-11-06):** `conditional` activation rows in `src/reading/digest/activation.ts` now require `applies === true` in `dasha.applicable` (normalized across engine `type` → `DASHA_TREES.system` names), and `PlanetCard.owns` in `src/reading/digest/build.ts` unions both `lord` and `natural_lord` / `dashaCharter` houses (`Ma` owns `[2, 9]` in Pisces Lagna; `Sa` owns `[2, 3]` in Sagittarius Lagna).
- **`digest_built_at` doubles as the build start while `building`** (the sweep re-runs a build stuck over 10 min).
  When the status is `ready` it is the build time. A separate `digest_started_at` column would be cleaner.

### Found, not from this branch
- **Migration checksums**: M32 and M33 were recorded in `_prisma_migrations` with the sha256 of the files as written
  (LF). A CRLF checkout changes the checksum `prisma migrate` computes; the same holds for earlier migrations.

## Filed 2026-11-06 by the techniques-in-use build (doc 54 §5 S5, branch `feat/techniques-in-use`)

- **P2: The life horizon no longer runs the year-chart reader R11 in the oracle flow.** `general.annual` selects
  horizons now/3m/6m/1y/custom (doc 53 §4.4), and `src/techniques/use.ts READER_TECHNIQUE` ties R11 to it, so a tier-1
  life reading (horizon `life`) drops R11 from `BY_TIER[1]`. Everything else selects as before (the graph's annual layer
  already ran only within 13 months). Owner: Sachin (product) / reading-dev. Done: either `life` is added to the
  annual selectors (or the any-of "or question type timing" rule of the matcher item above lands), or this is accepted
  and the item deleted.
- **P2: Prewarm does not apply the technique selection.** `oracle/prewarmReaders.ts` calls `prepareReaders` without
  `allowedReaders`, so during clarify it may read a reader the question will not run (only R11 on a life horizon
  today; any reader once selectors narrow). Harmless (an unused memo) but billed. Owner: reading-dev. Done: prewarm
  computes `techniquesForQuestion` with the facts it has and passes `allowedReaders`.
- **P2: Digest fields with no dossier equivalent are kept from the dossier on the digest path.** `packs/digestSource.ts`
  keeps the dossier's values for body `deg` (the digest card's `degree` is not stated as degrees within the sign in doc
  54 §2), `conj` (the digest's conjunctions include an 8° rule the dossier's do not), the varga lagna sign and the varga
  house `sign` (the dossier's varga rows carry sign numbers), the star lord's house, shadbala rupas and `co_lord`, and
  `detail.yogas` (its filter reads a source label digest rows lack). Owner: reading-dev with S1. Done: each is either
  served by the digest in the pack's spelling or confirmed as dossier-only, and this list shrinks to the latter.

## Filed 2026-11-06 by the life-mahadasha-charter build (doc 55, branch `feat/life-mahadasha-charter`)

- **Shipped (2026-11-06 — Remaining Largest Mahadasha & Antardasha Life Charter, doc 55):**
  - `AIAstra_Server`: added `PlanetCard.dashaCharter` in `src/reading/digest/build.ts` (from `avasthas.dasha_charter`), 6/8/12 Antardasha-from-Mahadasha step-down in `src/reading/life/promise.ts` (`periodSide`), `life.mahadasha_charter` technique in `src/reading/life/charter.ts` + `compose.ts` + `service.ts`, registered `life.mahadasha_charter` in `src/techniques/catalog.ts` and `src/agents/registry.ts`, and added unit + research-fixture tests in `tests/unit/reading/life/charter.test.ts`.
  - `AIAstra_WEB`: added `LifeMahadashaCharter` types in `src/lib/lifeReadingApi.ts`, the Major Chapter Charter section (area charters, chronological Antardasha timeline, and current-chapter bridge) in `src/pages/timeline/LifeReadingDashboard.tsx`, and tests in `src/pages/timeline/LifeReadingDashboard.test.tsx`.
- **P2: `tests/unit/auth/registrationV2.test.ts` fails 1 test with `Error: no mail` when run outside local-mail test setup.** Same root cause as the `.env` / auth provider test leakage noted under P1 (line 84) and P2 (lines 280, 532); tracked there for the next auth/test-env pass.

## Filed 2026-11-06 by the technique-pieces, sub-agent cache & research-staging builds (docs 56–57, admin 07–09, M37/M38)

- **Shipped on `develop` (`c3bbc64`, `6def6c5`, `54ed7d5`, `0453a74`, `e7530c7`, `6d215e0`):**
  - **Technique pieces, validity windows & one-per-technique illustrations (`docs/reading-engine/56-*`, `docs/admin/07`, `docs/techniques/01..06-*.md`):** 69 built techniques, 25 registered agents, 24 reader pieces, 49 recipe families, `technique_outputs` date-range validity cache (`M37`), and `scripts/write-technique-pieces-doc.ts`.
  - **Per-sub-agent digest slicing & 45-minute used-cache recycle (`docs/reading-engine/57-*`, `M38`):** `src/reading/oracle/digestSlices.ts`, `src/techniques/subagentCachePlan.ts`, `src/reading/codeReaders/readers.ts` caching via `withTechniqueOutput`, `informIndividualCacheUsed` / `recycleIndividualCaches` (`READING_CACHE_RECYCLE_MINUTES=45` in `src/reading/llm/cacheSweep.ts`), and `scripts/cache-sweep.ts`.
  - **Per-request page execution telemetry & Research Lab (`docs/admin/08`, `docs/admin/09`, `M37/M38`):** `src/telemetry/pageTiming.ts`, `src/reading/research/presets.ts`, `src/reading/research/selfDashboardQa.ts`, `src/reading/research/verifier.ts` (20-subject Self dashboard QA engine, Nov–Jan temporal zoom-in, and 8-gate technical verifier), plus Admin `/pages` and `/research-lab` dashboards in `aiadastra_admin`.
- **P2: Confirm EventBridge 45-minute scheduled rule for `scripts/cache-sweep.ts` / `runScheduledSweep` on staging Lambda.** In-process 45m timers (`informIndividualCacheUsed`) recycle used caches within warm Lambda instances, and `runScheduledSweep` sweeps all 4 layers (`llm_cache_entries` / Gemini `cachedContents`, `reading_findings_cache`, `technique_outputs`, in-memory memos) across instances. Owner: deploy session. Done: EventBridge rule invoking the sweep every 15–45 minutes verified in staging CloudWatch logs (`{"msg":"llm cache sweep",...}`).
- **Fixed (2026-11-07 — Standardized `HouseCardFilter` vocabulary, Love/Work Research Lab, Self 3-Decade Character Arc & Moon/Mercury Personality/Joy, Header Personalize Wizard Modal):**
  - Standardized `house/house_card` `contract.inputs[].filter` strings in `src/techniques/catalog.ts` into a typed `HouseCardFilter` union (`D1_h1..12`, `D1,D9_h1,4,5,9,10,12`, etc.), reducing distinct `house/house_card` filter variants from 18 free-text strings to 14 canonical keys.
  - Added `self.character_arc` (3-decade Character Evolution: Last 10 Years, Who You Are Now, Next 10 Years) and `self.personality_joy` (purely Vedic Moon/Chandra & Mercury/Budha + 4th/5th house personality & joy synthesis) in `src/reading/area/selfCharacterAndJoy.ts`, wired into `buildBoard` (`src/reading/area/houseLayers.ts`), `selfDashboardQa.ts`, `AIAstra_WEB/src/pages/boards/BoardView.tsx`, and `aiadastra_admin/web/src/pages/ResearchLab.tsx`.
  - Extended Research & Verification Lab (`src/reading/research/loveDashboardQa.ts`, `workDashboardQa.ts`, `src/routes/researchRoutes.ts`, `aiadastra_admin`) to support `Self (You) | Love | Work` boards across all 20 synthetic subjects (total 73 built techniques, 27 registered agents, 80-page visual manual in `docs/techniques/01..06`).
  - Added Header "Personalize" Profile Setup Wizard Modal button next to the user profile icon in `AIAstra_WEB/src/components/AppShell.tsx` (`PersonalizeWizardModal.tsx`) and merged `fix/auth-scene-fullbleed` (`03292ec`, `48c4458`) into `develop` and `release-candidate-staging`.

## Filed 2026-11-07 by the home-scenery review session (vedic-astrology.app home, /signin, /signup)

Reviewed on the live site and from `AIAstra_WEB/src/assets/skies/*.webp`, `src/lib/skies.ts`, `scripts/skies/scenes.mjs`,
`src/components/CosmicSky.tsx`, `src/LandingPage.tsx`. Opinion and additions are in the session's report to Sachin; the
concrete findings. Full review and plan: `docs/homepage-scene-improvements/01-review-and-plan.md`. Two of these reopen earlier
decisions (the 12 planets in `docs/product/landing-cosmic-skies.md`, and Google/phone sign-in in `docs/product/auth-registration-review.md`), so they are Sachin's call:

- **P2: the home loop shows 12 "planets", not the navagraha.** `SKY_SCENES` adds Prajapati (Uranus), Varuna (Neptune) and
  Yama (Pluto) with invented vahanas (swan, whale, buffalo). A Jyotish regular reads these as Western. Status: open. Done:
  the three leave the home loop (keep the art for an "outer planets" note if wanted), caption count is 27 + 9.
- **P2: four scenes break their own iconography.** `hasta.webp` goddess is blue-skinned (reads as Vishnu/Krishna);
  `shukra.webp` reads as a woman in white (Shukracharya is a bearded male guru); `budha.webp` neon-green winged lion looks
  like a game asset; `chitra.webp` tiger is realistic fur, not starlight like every other animal. `yama.webp` is grim and
  near-black, against the "nothing frightening" brief. Status: open. Done: regenerated with `scripts/skies/scenes.mjs`.
- **P3: every scene carries two baked-in "AdAstra AI" marks**, one bottom-right and one faint in the centre over the subject.
  Looks like a stock-site preview. Status: open. Done: centre mark removed from all 39.
- **P2: portrait phones crop the rider.** Images are 1920×1072 shown `bg-cover bg-center`; on a 9:16 screen the subject is cut
  on both sides and the caption covers the animal. Status: open. Done: a focal point per scene or a portrait crop set.
- **P3: the caption names only the yoni animal and the rashi** (`रोहिणी · Rohini / बैल · the ox / वृषभ Taurus`). A regular
  knows a nakshatra by its lord, symbol and deity; the animal alone makes the ox look like Rohini itself. Status: open. Done:
  caption adds the lord (and optionally the symbol), stays two lines.
- **P3: Devanagari only.** South-Indian and US-Tamil/Telugu/Kannada/Malayalam visitors see a script they may not read; no
  transliteration toggle. Status: open. Done: decision recorded; at least an IAST/English-only option.
- **P2: the first scene is random**, so a first visit can open on Yama, Rahu or Ketu. The sky is shared for all users (Radha
  transit sky), so the first scene can be today's Moon nakshatra with a "Today the Moon is in …" line, which is what regulars
  check daily. Node computes nothing: read from the stored shared sky. Status: open. Done: first scene = today's Moon
  nakshatra when the shared sky is present, random otherwise.
- **P3: landing copy is Western new-age** ("Discover Your Cosmic Blueprint", "Generate My Chart") and the tagline reads
  "mastered on the ancient text unabridged and astrological celestial sky". Audience words are Kundli / Janam Kundali /
  Jathakam, Panchang, Dasha. Status: open. Done: copy pass with Sachin.
- **P3: eight identical parchment icons sit over the goddess's face and body**, random each visit, and the parchment card with
  pink gradient text clashes with the cinematic scenes; the product explanation and FAQ are hidden until an icon is clicked.
  Status: open. Done: one visual language chosen; the icons stay off the subject's face (placement avoids the centre third).
- **P2: sign-in and sign-up are email-only** with Turnstile. India users expect phone/WhatsApp OTP and US Indians expect
  Google sign-in; neither page says what the person gets or that birth date, time and place come next. Status: open. Done:
  decision on Google and phone OTP recorded; a one-line "what you get" and "next: your birth details" on both pages.

## Filed 2026-11-07 by the You-board synthesis review (docs/product/you-board-synthesis-review.md)

- **P1: the Self character and personality panels print defaults as the person's chart.** `src/reading/area/selfCharacterAndJoy.ts`
  falls back to `Taurus`, `Virgo`, `Rohini`, `Ju`, SAV 28 and "friendly" when a digest field is missing, and builds the
  evidence strings from those defaults. Found reading the code; how often it fires is not measured. Status: open. Done: a
  missing field drops the line and records a gap; a test asserts no default sign or star ever reaches the board.
- **P1: the You board is produced by no model and no prompt.** `area.self_board` is `kind: 'code'`; every headline is a
  phrase from `self.ts SELF.words` chosen by integer votes (`houseLayers.ts`). The "Oracle" prompts never run for the
  dashboard. Status: open (plan: the Self dashboard session). Done: the board is a reading of one standing question, written
  by the Oracle from grounded reader claims, with the vote rule as a veto.
- **P2: a dasha period's side ignores the house it activates.** `gradeRow` gives every period of a planet that planet's
  `gradePlanet` score (±1 charter cell): no house from lagna or Moon, no antar-from-maha relation, no star lord. Status:
  open. Done: R08-style delivery chain in code or in a reader; tests on known charts.
- **P2: "33 independent timing clocks aligned" counts non-independent systems.** `aheadWindows` merges `systems` across
  overlapping windows and the web (`AreaBoardView.tsx:647`) prints the count as independent; `familyVotes` treats the same
  systems as one family. Status: open. Done: the lead window names the families (and the preferred system), not a count.
- **P2: the main clock is always Vimshottari.** `isTurn` requires `family === 'vimshottari'`; a kundli where Dwisaptati Sama
  (or another conditional system) applies has no way to lead. Sachin's own chart is the first case. The catalogue and R09
  spell the system `dwisatpathi`; confirm the engine's key. Status: open. Done: `kundlis.preferred_dasha` (or equivalent)
  drives the main clock and the Direction line; applicability from the engine fills it when unset.
- **P2: companion answers reorder, they do not anchor.** `self.focus` only picks the lead sub-area (`selfLead`), `selfFits`
  is always true, and the shade resolver adds a tie-break bonus; no statement is conditioned on or checked against an
  answer, and Family, Health and Love all map to `mind`. Status: open. Done: answers are sealed facts that gate claims
  (doc 48), with a confirm question generated from the strongest claim.
- **P3: no Self reader exists in the chat engine.** R01..R14 cover frame houses, vargas, Jaimini, strength, yogas, stars,
  dashas, transits, annual, prashna, another person, remedies; none reads lagna, Moon, Sun, AK, karakamsa, D60 and houses
  3/4/5/12 as one self. Status: open. Done: `readers/R15-self.md` and `oracle/self.md` per the review §6.
- **P3: `method.md` describes a pack shape (`base`, `frame`, `detail`) that the Oracle path does not send**; readers use v2
  table ids and digest slices use `digest.<section>.<varga>`. Status: open. Done: one data vocabulary per path, stated in
  the prompt that path loads.

## Filed 2026-11-07 by the You reading build (docs/reading-engine/58, branch `feat/self-dashboard-guru-reading`)

- **P2: Stored technique outputs survive code changes.** The `technique_outputs` key carries the contract hash, the
  digest version and `TECHNIQUE_CACHE_VERSION`, not the code of the technique. A fix to a panel's code or words keeps
  serving the old output until the digest is rebuilt (seen 2026-11-07: the You reading served the old struggle wording
  after the fix). Fixed for `self.reading.*` by `SELF_READING_VERSION` in `src/reading/self/service.ts`; every other
  stored technique (`self.activation`, `love.activation`, `work.present_tone`, code readers) still has the gap. Owner:
  reading-dev. Done: a per-technique code version in the key (or in the catalogue row, hashed with the contract).
- **P2: `runningYearSpan` picks a decades-long span.** `src/techniques/outputStore.ts runningYearSpan` prefers the TP
  row and takes the min/max of its dasha periods. The TP row's `tithi_ashtottari` periods for kundli `c584c0a3` run
  2015-07-07 → 2123-07-08, so every `freshness: annual` output (the You and Love board builds pass it as `year`) is valid
  for a century. The You reading takes the year from the VP Mudda span instead (`service.ts`). Owner: reading-dev.
  Done: the year span is the Tithi Pravesha to the next one (or the VP Mudda span), with a test on this kundli.
- **P2: Karaka points carried their dispositor only.** `PointRow` for AK…DK held `lord` = the dispositor of the
  karaka's sign; `selfCharacterAndJoy.ts:473` reads it as the atmakaraka ("AK=Me (H8)" for `c584c0a3`, whose AK is the
  Sun). Fixed in the digest (`PointRow.planet`, `build.ts pointRows`); `selfCharacterAndJoy.ts` still reads `lord` and is
  not changed here (the review session owns that module). Every ready digest needs a rebuild to gain `planet`
  (`c584c0a3` rebuilt 2026-11-07); until then the You reading withholds "Your soul's aim" with a gap. Owner:
  reading-dev with the deploy session. Done: the 24 research kundlis rebuilt; the character arc reads `planet`.
- **P3: Chapter confirmation checks dates only.** `self.reading.chapters` counts a confirming clock when its main
  period starts within 18 months of the chapter start; it does not yet check that the clock's running lord or sign
  activates the same houses. Owner: reading-dev. Done: a theme check (house overlap from `kundli_activation.houses`) next
  to the date check, with confirmed requiring both.
- **P3: The You reading's wall time is mostly database round trips.** From this machine to Render: 7.0 s first open,
  2.0 s with all seven panels stored (panel code under 300 ms). Measure on the Lambda after deploy; if the stored path is
  over 150 ms, read the seven stored outputs in one query instead of seven. Owner: reading-dev.
- **P3: Love and Work panel areas wait on the parent session's guidance** (asked 2026-11-07, at Sachin's request): which
  panels each board has and what each reads, so they can be built as `love.reading.*` and `work.reading.*` on the same
  slicers. Owner: the scenery/UX review session, then reading-dev.
- **Web, found by the web build (`AIAstra_WEB` branch `feat/self-dashboard-guru-reading`, worktree
  `C:\Users\Owner\Documents\work\wt\web-self-guru`), not from this change:**
  - P2: the "Your reading" tab sits inside `AreaBoardView`, so when `/api/area/self` is preparing, unavailable or failed
    the whole page shows the board's message and the reading cannot be reached. Done: the reading tab renders on its
    own status.
  - P3: `src/components/AskModal.test.tsx` fails 2 tests on `develop` ("Unable to find an element with the text: Old").
  - P3: `npm run typecheck` fails on `develop`: `src/routes.tsx(24,1) 'boardsEnabled' is declared but never read`.
  - P2: `npm ci` reports 21 audit findings (2 critical, 2 high). Done: triaged and upgraded or accepted with a note.

## Filed 2026-11-08 by the You reading research-grade build (docs 60–62, branch `feat/self-dashboard-guru-reading`)

- **Built:** `self.reading.purview` (whole-chart check: lagna lord standing, cancellations, combustion and retrograde,
  functional nature, vargottama, gandanta, dasha applicability, MD–AD 6/8 and 2/12, stored sky, sensitive core),
  `self.reading.body` (facts only), the doc 61 card (1–3 lines of at most 22 words, per-line ranges, header ranges),
  `self.reading.audit` (code auditor; a failing line leaves the card), `reading_dossiers` (M40, sealed) written once per
  build content, and `/api/admin-lab/*` behind `ADMIN_LAB=1` and `ADMIN_LAB_TOKEN` (header `x-admin-lab-token`).
- **P2: The request still builds.** Doc 60 §6 says a person's request never builds (it reads the stored reading or
  queues a build on the four triggers). Today a request runs the panels through the stored outputs, so an unchanged
  open makes nothing, but a window boundary is crossed on a request. Owner: reading-dev. Done: a build sweep on the
  `dasha_boundary` / `annual` / `confirm` / `digest` triggers and requests that only read.
- **P2: No bundle yet (doc 60 phase C).** The build reads the digest (memoised 60 s), two activation queries, the facts
  and the sky overlay; agents do not exist yet on this path. Done: `board.bundle` in `technique_outputs` read once.
- **P2: Scenario hydration cannot take chart specs.** `buildCustomResearchSubject` (`src/reading/research/presets.ts`)
  takes birth data and a profession template, not placements, yogas or periods, and `ResearchGroupKind` has no
  `self_scenario`. S2–S8 (`docs/reading-engine/scenarios/self/`) are chart specifications with approximate dates;
  the stored dates win once hydrated. Owner: reading-dev. Done: hydration from a chart spec or hand-built subjects.
- **P3: S2's "Moon override" was undefined in doc 60 §4;** the scenario uses a Kemadruma row cancelled by a kendra Moon.
  The purview has no Kemadruma-cancellation rule yet (the engine row decides). Owner: Sachin / reading-dev.
- **P3: The global banned list of doc 60 §5** must carry the engine names; the per-scenario lists leave them out so the
  files do not contain them. `BANNED_LINE_WORDS` in `src/reading/self/words.ts` is the code list; add the names there
  through an env or a non-literal pattern.
- **P3: Doc 45 vs doc 61 on chart words in cards:** doc 61's examples name planets ("Saturn crosses your Moon"); doc
  45 §3.3 bans them. The build and the scenarios follow doc 45 (`BANNED_LINE_WORDS`). Owner: Sachin.
- **P3: `BODY_WORDS` (`BODY_SHAPE` in words.ts) needs Sachin's review** before the body panel is shown widely: planet to
  one of four shapes after the BPHS dosha natures.
- **P3: Web chapter cards still say "Likely"** from the older chapter certainty set beside the card certainty words
  (web worktree finding). The 22-word limit is not checked on the web side (the server auditor enforces it).
- **Deploy note:** M40 is applied to the shared database; `ADMIN_LAB` and `ADMIN_LAB_TOKEN` are new env vars (deploy
  session; off by default).
- **P3: The dossier has no "rows declared but unread" count** (admin lab request, 2026-11-08). `audit.unresolvedKeys`
  counts evidence keys that did not resolve; it is not the rows a technique's contract declares minus the rows its
  claims cite. Owner: reading-dev. Done: per technique, declared rows (from the contract filters over the digest)
  minus cited rows, stored in the dossier and shown in the admin lab.

## Filed 2026-11-07 by the Self pipeline review (Opus, read-only, on develop 46c241c)

Plan to fix these: docs/reading-engine/63-dashboard-oracle-and-machinery-plan.md (shipped 2026-11-08 on `fix/dashboard-priority-bugs-p2`).

- **Fixed (2026-11-08, `fix/dashboard-priority-bugs-p2`):**
  - Removed the 3-line / 22-word gag (`MAX_LINE_WORDS = 500`) and anatomical/astrological bans (`BANNED_LINE_WORDS`) in `src/reading/self/words.ts`, `src/reading/self/card.ts`, and `src/reading/self/audit.ts`.
  - Expanded `self.reading.body`, `self.reading.chapters`, `self.reading.struggle`, `self.reading.year`, and `self.reading.purview` across all 12 houses (`H1..H12`), divisional vargas (`D1, D9, D30, D60`), all stored dasha systems across every family (`vimshottari`, `conditional`, `rasi`, `yogini`, `tithi_ashtottari`, `karaka`, `other`), multi-year Tithi Pravesha (`2025/2026/2027` + 108y->1y `tithi_ashtottari` compression + `mudda`), Special Lagnas & Upagrahas (`AL, SL, HL, GL, MD, GK, Sphutas, Argala`), and Universal Shared Transit Sky (`transit_range_skies` fallback + `SAV` bindus).
  - Wired the 3-tier AI Sub-Agent (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`) -> Lineman (`lineman.self` / `R15-self`) -> Oracle Synthesizer (`self.reading_oracle` / `oracle/self`) pipeline in `src/reading/self/oracle.ts` and `src/reading/self/service.ts` with `thinking: 'medium'`, prefix caching (`parts[0]`), `PANEL_SYNTHESIS` + `VALID_UNTIL`, `forceRefresh` store persistence, and full Admin Lab `dossier.oracle` + `dossier.audit.steps` telemetry.
  - Fixed Bug 1 (`presentTone` & `votesSide` primary-clock priority in `src/reading/area/houseLayers.ts`), Bug 2 (`struggle` post-purview-veto claim count & header ranges in `src/reading/self/service.ts` and `src/reading/self/panels/struggle.ts`), Bug 3 (protecting `natal`, `family.*`, `lineman.*`, and unexpired LLM/`board.bundle*` rows from the 45-minute idle cache recycler in `src/techniques/outputStore.ts` and `src/reading/oracle/prewarm.ts`), Bug 4 (`runningYearSpan` `<= 400` day cap and TP year boundary in `src/techniques/outputStore.ts` and `src/reading/self/service.ts`), Bug 5 (single-panel scope execution in `src/reading/self/service.ts` and `Love`/`Work` board support in `src/routes/adminLabRoutes.ts`), and Bug 6 (`gemini-2.5-pro` pricing in `src/reading/llm/models.ts` and single-query `activationFor` in `src/reading/digest/activation.ts`).
- **P2: the Work board pulls engine data live on page load.** `getCareer` on Sachin's kundli took 8.1 s cold and called
  `transit_contacts` for 2024-11..2028-11 at request time (locally: "Could not load credentials from any providers"; S6/S6D then
  left out). Doc 60 §6: a person's request never builds or pulls. Done: transit contacts pulled by the digest sweep and stored.
- **P3: Love board on Sachin's kundli is "steady / split"** with main and conditional = test, karaka and annual = support; the
  Love and Work reading panels (doc 59) are planned rows only, so Love and Work run the older vote boards.

## Filed 2026-11-08 by the admin observatory review (docs/admin/11, live walkthrough of admin.vedic-astrology.app)

Plan: `docs/admin/11-admin-observatory-visitors-and-drill-down.md`. Built the same day in `aiadastra_admin` on
`feat/admin-nav-sections`: the header sections (People / Usage / Engine drop-downs) and the one-viewport Techniques Lab.

- **P1: No per-request record carries an IP.** `page_execution_logs` is PII-free by design; `account_events` gets a row
  only at sign-in/-up/-out, profile and billing; `assistant_visits` has no user id; no CloudFront or Function URL access
  log is configured. "Who visited yesterday and from which IP" cannot be answered. Owner: server. Done: plan 11 V1
  (`request_access` written by `pageTimingMiddleware`, IP sealed, prefix plain, 90-day IP retention).
- **P2: `account_events.ip` is the first `x-forwarded-for` hop** (`src/lib/requestMeta.ts` `getClientIp`), which a
  client can set; the assistant and admin paths use `CloudFront-Viewer-Address`. Whether that header is forwarded on
  the API distribution is still unchecked (item at line ~433). Owner: server + deploy session. Done: one helper that
  prefers the viewer address and falls back to the last hop; origin request policy confirmed.
- **P2: Staff lab and research runs count as customer activity.** Day review for 2026-11-07 showed 0 questions and
  181 agent runs, all from the Techniques Lab. `agent_runs` and `reading_traces` have no `source`. Owner: server. Done:
  `source = 'app' | 'lab' | 'research'` set by `adminLabRoutes.ts` and the research routes; admin aggregates filter
  `app` by default.
- **P2: Users shows "Last seen —" for 34 of 35 accounts** while two of them have a query in the last 7 days. The
  `last_seen` tick (`requestAuth.ts:151`) started on 2026-11-05 and may not sit on every authenticated path (chat SSE,
  GraphQL `me` restore). Owner: server. Done: a sign-in and a reading from a test account both move `last_seen_at`
  within 5 minutes; checked on staging.
- **P2: Security tiles count event names the server never writes.** `aiadastra_admin/api/src/admin/security.ts:48-54`
  counts `sign_in_failed`, `sign_up_failed`, `session_revoked`, `account_locked`; the server writes `sign_in` /
  `sign_up` with `outcome = failed | refused` (`src/graphql/schema.ts:1121-1325`) and never the last two. Only
  `turnstile_failed` and `sign_out` match. Owner: admin. Done: counts by action + outcome; revocations from
  `admin_actions`, locks from `auth.locked_at`.
- **P3: Trace labels are still empty.** All four traces of the last 7 days show bucket / template / tier / subjects "—"
  (doc 04 G6, still open on 2026-11-08). Owner: reading-dev.
- **P3: Retention is uneven.** `account_events`, `analytics_events`, `user_activity_days`, `reading_traces`,
  `agent_runs` are never swept; `page_execution_logs` 30 d; `assistant_visits` 30 d full IP / 400 d rows; CloudWatch
  undecided. Owner: Sachin (policy), then server. Done: one retention table in docs/privacy and sweeps to match.
- **P3: Page times "Forecast" text is generic.** It tells staff to "use GET /api/dashboard/sections-stream" for
  `/api/admin-lab/*` routes, which are staff lab calls with 30 s engine pulls, not customer pages. Owner: admin. Done:
  recommendations keyed by route family; lab routes excluded from customer forecasts.

## Filed 2026-11-08 by the BUILD-GAPS session (branch `feat/build-gaps-p2`, BUILD-GAPS.MD BG-06..BG-14)

### P2: real, can wait

- **Engine additions that BG-06/08/10/11 need (Node must not count them).** These four-school items were not built because
  the stored rows give no value for them, and getting one in Node means counting houses or signs. Engine repo
  `AIAstra_Radha` (data map: side-session note `bg06-12-data-map.md`). Status: open (engine pass). Done: each field is
  exported, read into the digest by selection, and the panel claim is added.
  1. **Devatas (BG-08):** Ishta (12th from karakamsa in D9), Dharma (9th from karakamsa), Palana (6th from AmK in D9), each
     with sign, lord and occupants, in `facts_export._karakas`.
  2. **nth-from tables (BG-06 11th/12th from AL; BG-11 10th/6th/7th from Saturn, 10th/11th vs 6/8/12 from AL and A10):**
     `nth_from_arudha_lagna {n: house}`, `nth_from_point` for A10, `nth_from_planet {planet: {n: house}}` in
     `house_counts_export.house_counts_table` (today only the inverse maps exist).
  3. **UL–A7 relation (BG-10):** a stored count from UL to A7 in `_build_arudhas`, or the digest reads `house_counts.house_from_house`.
  4. **Paksha Bala (BG-07):** `kaala_parts.paksha` in `natal_export._build_shadbala` (only the six shadbala totals are kept);
     the digest also does not read `facts.panchanga` tithi and paksha yet.
- **D20 and D24 cards (BG-07, BG-08) are not in the dossier's default chart list,** so mind/atma cannot read them. Status: open. Done: the digest builds D20/D24 cards for a cohort kundli and the panels cite them.
- **Two clarify tests fail on `develop`, unrelated to BUILD-GAPS.** `tests/unit/reading/clarify.test.ts:157` expects
  "Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at?" and gets "Shall I look until 7 Sep 2027,
  or a different stretch of time?"; `tests/unit/reading/annualPrashna.test.ts` "a ruled-out question never reaches the model"
  fails the same way. Neither file was touched on this branch. Status: open. Done: the wording and the tests agree.
- **The unit suite reads `.env` (`tests/setup.ts` calls `dotenv.config()`),** so a checkout with a live `.env` fails 6 test
  files (Gemini output cap, engine base URL, prompt cache, export spacing, thinking config). Seen 2026-11-08 in a worktree
  with the main `.env` copied in; green with `.env` moved aside. Status: open. Done: tests pin their own env or setup skips `.env` under vitest.
- **BG-14 web follow-up: panels now carry `plan` (summary, dated steps, calendar).** `SelfPanel.plan` (server
  `src/reading/self/types.ts`) and `audit.dateGaps` are new; the web You/Love/Work boards do not render them yet. Calendar
  entries with `inWindow: false` should show as unconfirmed, not hidden. Status: open (web). Done: each board shows the
  plan summary, the dated steps and a calendar per panel.
- **BG-14: lucky-day / muhurta tables are not yet a date window for the board audit.** `storedWindows` (service.ts)
  takes the activation rows, the year charts' dashas and the transit range with Sade Sati and dhaiya; the board service
  does not load `day_tables`. Status: open. Done: the board service passes the person's stored day tables and a calendar
  date on a lucky day counts as grounded.
- **BG-14 makes the Oracle write more.** The prompt now asks for a plan and calendar per panel and the output cap rose from
  4500 to 8000 tokens (`SELF_ORACLE_MAX_OUTPUT_TOKENS`). No live run has measured the cost per board yet (no paid call
  without Sachin's yes). Status: open. Done: one approved run per board records tokens and cost in the dossier.

## Filed 2026-11-08 by the sign-up/sign-in alerts and Terms consent build (branch `feat/signup-signin-alerts`)

- **P1 — Apply migration `20261108120000_auth_terms_acceptance` before this server code ships.** It adds
  `auth.terms_version`, `auth.terms_accepted_at`, `auth.age_confirmed_at` (additive, nullable). Prisma selects every
  scalar column on `auth` reads without a `select`, so code from this branch on a database without the columns fails
  those reads. Not applied by the build session (shared DB). Holder: deploy session. Done: `prisma migrate status` shows
  it applied on staging and prod before the Lambda deploy.
- **P1 — CloudFront origin request policy `e1684868` (staging API) does not forward `CloudFront-Viewer-Address` or
  `CloudFront-Viewer-Country`.** Found by the deploy session 2026-11-08: it forwards only Origin, X-Astra-Authorization,
  Accept, Access-Control-Request-*, X-Face-Box, Content-Type and X-Admin-Lab-Token. Until it does, `getClientIp`
  (`src/lib/requestMeta.ts`) falls back to X-Forwarded-For (`xff_right` when the Lambda Web Adapter's
  `x-amzn-request-context` gives the function URL peer, else `xff_first`, which a client can forge), owner alerts show
  "(unverified, …)" and the country is unknown. Holder: deploy session, waiting on Sachin's yes. Done: both headers in
  the policy (and the prod policy), an owner alert shows a bare IP and a country.
- **P2 — Owner alerts are fire-and-forget on Lambda.** `alertOwnerOfAuth` (`src/notify/ownerAlerts.ts`) sends after
  the response is returned; Lambda can freeze the instance before the 5 s send finishes, so an alert may arrive late
  (on the next invocation) or not at all. Unverified on the live Lambda. If alerts go missing, move the send to an async
  self-invoke (like the kundli sync, docs/reading-engine/31) or a queue. Holder: open. Done: alerts verified arriving
  on staging, or moved off the request path.
- **P2 — Sign-in alert throttle is per instance.** One sign-in email per user per 10 minutes is kept in an in-memory
  map; each warm Lambda instance has its own, so a user can produce more than one alert in 10 minutes. Acceptable for
  now. Done: move to a DB/Dynamo key if the owner finds it noisy.
- **P2 — Owner alert env vars to set (deploy session).** `OWNER_ALERTS_ENABLED=1` and
  `OWNER_ALERT_EMAILS=send.sachin@yahoo.com` on the API Lambda; both default off. Uses the existing `RESEND_API_KEY` /
  `SMTP_HOST` mail transport. Then, once the web ships the consent box (docs/auth/otp-consent-contract.md),
  `REQUIRE_TERMS_ON_SIGNIN=1` and `REQUIRE_TERMS_ON_SIGNUP=1`. Done: set and one real sign-up and sign-in alert received.
- **P3 — `verifySignupCode` accepts any account's login code**, so an already verified person who calls it gets a
  "New sign-up" owner alert instead of "Sign-in". Found reading `src/services/authService.ts` (`verifySignupCode` →
  `verifyLoginCode` → `completeLogin`, no pending-account check). Holder: open. Done: verifySignupCode refuses (or
  routes as sign-in) for an already verified account.
- **P3 — The deprecated one-shot `signup` mutation sends no owner alert and records no Terms.** Its person is alerted
  on the later sign-in instead. Leave unless an old web build still uses it.
- **P3 — The Terms of Use page must contain the no-reproduction clause** ("won't copy, record, or reproduce anything
  seen in the app") at version `2026-11-08` (`src/auth/terms.ts` `CURRENT_TERMS_VERSION`). Holder: web session /
  Sachin for the wording. Done: the Terms page carries the clause and its version date matches.
- **P2 — Three reading unit tests fail on this branch without touching anything it changed** (found 2026-11-08 running
  `npm run test:unit` in `wt/server-alerts-consent`; none of them import requestMeta, accountEvents, emailService,
  ownerAlerts, terms or the GraphQL schema). `tests/unit/reading/annualPrashna.test.ts:224` ("a ruled-out question
  never reaches the model": expected false, got true) and `tests/unit/reading/clarify.test.ts` ("falls back to the rule
  question…": got "Shall I look until 7 Sep 2027, or a different stretch of time?" instead of the dasha-named question;
  plus an unhandled `ThrottlingException` rejection at `clarify.test.ts:155`) fail in isolation too.
  `tests/unit/reading/coachAndRoutes.test.ts` R14 (confirm-stream returns `type: 'error'`) fails only in the full run,
  so it is order-dependent. Not verified on `develop` itself. Holder: the clarify/reading owner. Done: all three green in
  the full unit run.

## Filed 2026-11-08 by the Chart Data Review build (admin `feat/admin-chart-data-review`, server `feat/admin-chart-data-route`)

Structural checks run read-only on the three newest `ready` kundlis (4feca3ca, 858f2f20, b4a777a6) and the G1 fixture.
What passed everywhere: SAV adds to 337 (stated, summed, by house, and the BAV columns), each graha once with a sign in
every stored varga table, the D1 signs agree between `dignities` and `varga.d1`, and every natal dasha (all stored
systems, levels 1–3) has no gap or overlap. The P0 above (year dasha) is the main defect. The rest:

- **P1 · Mudda periods are offset from the year they are stored for.** `annual.mudda` rows run exactly one year but start
  11–43 days before the row's own `valid_from` (4feca3ca 2026: 2026-02-06 → 2027-02-06 for the year 2026-02-17 →
  2027-02-17; 858f2f20 2026: 2025-12-30 → 2026-12-31 for 2026-01-17 → 2027-01-17; G1 2026 starts 2026-09-02 for a
  2026-10-16 year). Either the engine counts Mudda from another instant (birthday, Varsha Pravesh) than the window it
  stamps on the row, or the start is wrong. Owner: engine. Done: the row says which instant the periods start from and
  it matches `valid_from`, or the periods are fixed.
- **P1 · Annual set incomplete on `ready` kundlis.** b4a777a6 has Tithi Pravesha only for 2026 (no 2025, no 2027) and no
  other year; 4feca3ca has no 2024 and only the TP chart for 2025 (no Varsha, year dashas or sahams). `annualSet.ts`
  wants ten years back and ahead; the sweep (40 calls per run) has not filled them, or rows fail silently. Owner:
  server (digest sweep). Done: previous, current and next TP years complete on every `ready` kundli; the admin Annual tab
  shows no "is not stored" for them.
- **P1 · Co-lords chosen as the house lord: Aquarius → Rahu, Scorpio → Ketu.** `dignities` `houses[].lord` and
  `planets[].sign_lord` name Rahu for Aquarius (all three kundlis) and Ketu for Scorpio (G1), with `natural_lord`
  Saturn / Mars beside it; `benefic_malefic` then lists Ketu as a trikona lord (G1, 9th = Scorpio). Any reader of
  `lord` gets Rahu as a house lord. Not a structural error; needs a decision on which field readers use. Owner: Sachin
  + reading-dev. Done: readers use `natural_lord` or the choice is documented in the catalogue.
- **P2 · Yogas present with no planets or houses.** 9–13 present yogas per chart (Vesi, Vosi, Ubhayachara, Sunapha,
  Anapha, Duradhara, Paasa, Bharathi, Asubha, Hamsa, Chaamara, Brahma, Amala) come with `planets: []` and `houses: []`,
  so a reading cannot say which planets form them. Owner: engine `yogas`. Done: every present yoga names its planets.
- **P2 · Node spellings differ by type.** `dasha.*` and `karaka.chara` payloads say `Raagu` / `Kethu` (with glyphs in the
  legacy columns); every other type says `Rahu` / `Ketu`. Matching rows across types by name breaks on the nodes.
  Owner: engine. Done: one spelling everywhere.
- **P2 · Deep-varga tables listed in `DIGEST_NATAL_TYPES` are never stored.** `dignities.dN` and `house_counts.dN` for
  D5, D6, D8, D11, D16, D27, D40, D45, D81, D108, D144 are in the digest's natal list but the catalogue marks them
  `served = false`, so no kundli has them. Owner: engine / catalogue. Done: served and stored, or dropped from the list.
- **P2 · The natal chart answer is about 4 MB.** `GET /api/admin-lab/chart-data/:userId` was 4.1 MB with the dashas
  (3.2 MB of it; `dasha.kaala.l3` alone 1.1 MB). The route now serves `part=dasha` on its own (natal ≈ 0.9 MB), but both
  Lambdas cap a response at 6 MB, and more level-3 dashas would push `part=dasha` near it. Owner: admin. Done: the dasha
  part paged by system, or the response compressed.
- **P3 · Birth panchanga strings carry negative times.** G1 `biodata.yoga` reads `00:-3:-49 from 20:14:14` and the
  nakshatra end `22:38:11 (-1)`. Owner: engine `biodata`. Done: times formatted without negative fields.

## Filed 2026-11-08 by the Chart Data Review transits build (admin and server `feat/admin-chart-data-transits`)

Read-only look at the transit rows of the three newest `ready` kundlis (4feca3ca, 858f2f20, b4a777a6) against the San
Jose daily sky (`37.34,-121.89`, keys `-7` and `-8`) for the admin Transits tab's default window, 2026-10-09 to
2026-11-08 + 365 days. What passed: the sky has one row on each of the 396 dates (no gap, no doubled date), each row
lists the nine grahas once, every stored `sign` matches its `sign_index`, each kundli's natal-overlay stays run without a
gap or overlap per planet, and no stay disagrees with the sky's sign on any date inside it. The defects:

- **P1 · No `kundli_transit_overlays` rows for any of the three newest `ready` kundlis.** Only Sumit (75b0d618) has an
  overlay. The others' houses come only from the per-kundli `transit_snapshots` natal-overlay chart, which the item
  "The reader still builds a full per-kundli transit chart" above says should go. Contacts are stored for nobody but
  Sumit, and the snapshots carry no `contacts` block. Owner: deploy session (`npm run transits:overlay` per kundli) and
  reading-dev (the plan in that item). Done: each `ready` kundli has a range and a contacts overlay over its reading
  horizon, and the admin Transits tab lists its contacts.
- **P1 · No stored house for the Moon on any date.** The snapshot rows hold Su, Ma, Me, Ju, Ve, Sa, Ra, Ke; the range
  overlays are monthly with Sa, Ju, Ra, Ke. Nothing stores the Moon's house from the lagna or the Moon per day, so a
  daily reading has no engine house for the Moon (the admin Transits tab warns "Moon has no stored stay"). Owner:
  deploy session (`transits:overlay --step day` with the Moon). Done: a daily overlay row per kundli and date with the
  Moon's `natal_house` and `house_from_moon`.
- **P2 · The shared sky stores no retrograde flag.** None of the 396 San Jose instants in the window (nor the Pune rows)
  carries `retrograde` on a planet, so the sky alone cannot say whether a planet is retrograde on a date; only the
  monthly range rows and the stations carry it. Owner: engine `transit` export (add the flag) and the sky job. Done:
  every instant's planets have `retrograde`, and the admin Transits tab's Retrograde column is filled.
- **P2 · The houses stop at the snapshot's `as_of`.** The three snapshots start 2026-11-01 or 2026-11-02, so the 23
  to 24 days of the default window before that have sky rows but no stored house (the Transits tab shows an error per
  planet). The past month matters for "what just happened" questions. Owner: reading-dev. Done: the overlay a kundli
  stores covers at least 30 days back.
- **P2 · Sky rows carry no engine version.** `transit_instants.calc_version` is null on every row in the window, so a
  change in the engine cannot be told apart from an old row. Owner: engine (return `calc_version`) and the sky job.
  Done: new rows carry it; old rows are listed as unversioned.
- **P3 · The three snapshots were built on two engine commits.** 4feca3ca and 858f2f20 say `8191a38`, b4a777a6 says
  `b66869a` (built the day before). Fine if both commits agree on transits; not checked. Owner: reading-dev. Done: one
  commit, or a note that the two agree.
- **Sumit readings: "one elevation per Jupiter cycle" is contradicted by his record.** 2026-11-08, Sachin: promotions in
  2018 and 2021, neither under Jupiter on his 10th (last Aug 2016 – Sep 2017). The stored clocks show both came when the
  10th lord Mercury or the 11th lord Venus ran as sub-lord in two or more systems (2018: career clock Sa/Me, Vim
  Ju/Sa/Me, Narayana Leo/Virgo; 2021: Vim Ju/Me, Kaala Sa/Me, Karaka Sa/Me, TA Sa/Ve, career clock Sa/Ve, Yogini Ra/Ju,
  graha double transit on his 11th Apr 2021 – Apr 2022). The 2 Nov readings also call Ju/Me 2020–22 "service-and-friction
  years", which his record refutes. Fix: in the career module (docs/reading-engine/42, 43) weight the 10th/11th lord as
  sub-lord across clocks above the Jupiter-on-10th transit; correct the two sentences when the Sumit readings are next
  regenerated (not before; Sachin asked for no rewrite now). Owner: reading-dev.
- **Engine yoga list says `bhadra_yoga: present=false` for Sumit's D1; the readings say Bhadra by definition.** 2026-11-08.
  Mercury own-sign Virgo at 15°18′ in the 10th from a Sagittarius lagna is a kendra, so the classical Pancha Mahapurusha
  rule is met; the engine's rule may require the kendra from the Moon, a strength threshold, or exact moolatrikona
  degrees. One for the engine-rule-verifier (doc 46 §D.2). Owner: reading-dev.
- **Sumit: job-change signature differs from promotion signature, worth a rule in the career module.** 2026-11-08, from
  Sachin's record (jobs changed Oct 2002 and Oct 2013; promotions 2018 and 2021 inside the same company). Stored clocks:
  both job changes ran the Sun (9th lord) as the career-clock sub-lord (Ve/Su 2002, Sa/Su 2013), a Rahu pratyantar or
  antardasha in Vimshottari (Ra/Ju/Ra began 15 Oct 2002; Ra/Mo/Ra Sep–Dec 2013), a rasi-dasha turnover in the preceding
  Aug/Sep (Sudasa into Virgo Aug 2002; Narayana into Sagittarius and Drig Virgo/Sagittarius Sep 2013), and Saturn or
  Jupiter entering his 7th, 11th from the Moon (Saturn Aug 2002; Jupiter Jun 2013). Both promotions instead ran Mercury
  or Venus as sub-lord with no 7th-house entry. Fix: encode "10th/11th lord sub-lord = step inside; 9th lord + Rahu +
  7th-house entry = new institution" as a chart-specific hypothesis in docs/reading-engine/42–43 and test it on the other
  research kundlis before it is generalised. Owner: reading-dev.

- [ ] (2026-11-08, transit overlay) `kundli_transit_overlays` range rows for Sumit (`75b0d618-…`) carry only `bodies` + `sade_sati` per month for 2026–2029; no `double_transit`, `ingresses` or `stations` fields in the stored payload, so the Sumit career check used placements and the `contacts` rows only. Regenerate the 2026–2029 overlay with the current engine version (with `--step day`) so double transit and ingress dates come from the engine, not from reading the monthly sign table.
- [ ] (2026-11-08, verification) Sumit career back-test used nine dated events (Dec 1999, Jan 2001, Nov 2002, 2004-05, 2006-07, 2009-10, Oct 2013, 2017-18, 2021). Annual D10 exists only from 2016 and the 2020 Tithi Pravesha chart was not pulled, so the 2021 promotion's year chart is only half checked. Candidate chart-specific rules to test on other charts: (a) Yogini mahadasha start within ~12 weeks of a career event (3 of 5 starts since 1999), (b) career clock (Chathuraaseethi Sama) sub-lord Mercury/Venus or MD Venus for promotions, Sun sub-lord + Vimshottari Rahu sub-period + slow planet entering the 7th for employer change, (c) Jupiter entering the 10th sign preceded a promotion by 1–12 months (2004, 2016–17).

## Filed 2026-11-08 by the theme setting build (web `feat/theme-setting`, admin `feat/admin-theme`)

- [ ] (planned, Sachin 2026-11-08) Web theme phase 2: Light / System on the public pages (landing, sign-in, sign-up,
  pricing, legal). Phase 1 themes only `/dashboard`, `/profile`, `/welcome`; public pages are forced dark. Scope and
  hooks in the web repo's `docs/theme/phase-2-public-pages.md`. Own branch and merge.
- [ ] (P3, web `develop` 06dea9c) `npm run typecheck` fails on `src/routes.tsx(24,1)`: `boardsEnabled` imported but
  never read.
- [ ] (P2, web `develop` 06dea9c) `src/components/AskModal.test.tsx`: two tests fail on `develop` ("the conversation
  list groups by category, General Reading first", "pinned threads sit above every category; the pin button toggles").
- [ ] (P3, web) `src/pages/welcome/WelcomeWizard.test.tsx` "falls back to null when @mediapipe/tasks-vision is
  unavailable" times out at 30 s in a fresh `npm ci` worktree (`wt/web-theme`) but passes in `AIAstra_WEB-known-bugs`:
  `loadDetector()` seems to load the real package when it is installed. The test should mock the import.
- [ ] (P3, web) Light mode is a generated remap (`scripts/gen-light-theme.mjs` -> `src/theme-light.css`) of the
  dark-first colour classes. New colour classes need a re-run (a unit test fails while the file is stale). New inline
  colour styles (`style={{ color: '#fff' }}`) are not covered; prefer classes.

## Filed 2026-11-08 (night) by the Self reading loading session (docs/reading-engine/64, branch `fix/self-reading-background-build`)

- **P1 · The admin Techniques Lab hides an Oracle failure.** Fixed on admin branch `feat/admin-engine-loads`
  (2026-11-08 night, not merged or deployed): the Lab shows a failed Oracle with its status and error, and the new
  Engine › Dashboard loads page (docs/admin/12) shows every build with its agent runs, errors and answers. Done when
  merged, both deployed, and Sachin's 21:20 build shows "Oracle failed · Gemini call timed out after 60000ms".
- **P3 · Local admin `api` typecheck reports `send` missing on `SecretsManagerClient`** (scripts/admin-accounts.ts,
  src/config.ts) in worktree `wt/admin-loads` after an interrupted `npm ci` was finished with `npm install`; lockfile and
  SDK version unchanged, tests pass. Owner: whoever next runs CI on the branch. Done: a clean CI typecheck.
- **P1 · `agent_runs` for Gemini stages record zero tokens and zero cost.** `self.reading_oracle` and `lineman.self`
  rows for the 7:36 am build have `prompt_tokens = 0`, `est_cost_usd = 0` while the dossier's stages record 45,110 /
  43,414 prompt tokens and $0.05 / $0.013. `withAgentRun` is given `tokensIn/tokensOut/costUsd` by the Oracle stage; the
  columns stay 0, so the Agents page and any spend cap read from `agent_runs` under-count. Owner: reading-dev. Done:
  the row carries the tokens and cost the stage summary carries.
- **P1 · The Oracle essay is produced and never shown (until this branch).** `reading.oracle.text` (11,516 chars,
  35 s, $0.05 per build) was not rendered by the web; only PANEL_SYNTHESIS lines reached the page, and the
  `panelPlans` parsed 0 plans on the 7:36 am build (the prompt's PANEL_PLAN format was not followed by the model).
  This branch renders `panel.plan` and the essay; the prompt rewrite (doc 64 Phase 3) decides whether the essay stays.
  Owner: reading-dev. Done: Phase 3 shipped or the essay moved to `narrator.self`.
- **P2 · Page-open builds of the reading run the Oracle inside a frozen Lambda container.** Fixed on this branch by the
  background event; the Love and Work reading routes (doc 63 §13) must mount the same `cached_only` + queue pattern when
  they are added, or they will repeat the 10 s 503 and the frozen-timer failure. Owner: reading-dev.
- **P1 · Rotate the kundli-sync-sweep event token.** 2026-11-09: the EventBridge rule `kundli-sync-sweep` carries the
  token in its input in plain text, and the deploy session printed it into its tool output while reading the rules.
  Owner: deploy session, with Sachin's yes. Done: a new token in the Lambda env and in both sweep rules' input; the old
  one refused by `/events`.
- **P2 · No schedule runs the LLM cache sweep.** 2026-11-09: no EventBridge rule targets `aiastra-server-api` with the
  cache-sweep event, while `READING_EXPLICIT_CACHE=1` is set on the Lambda, so explicit Gemini caches and reader findings
  are swept only by the in-process timer of a warm container. Owner: deploy session. Done: a daily rule sending the
  cache-sweep event, or a note that the TTL alone is enough.
- **Fixed 2026-11-09 (verify after deploy) · P1 · The digest sweep rebuilds every ready kundli 10-14 times a day.** 2026-11-09, from agent_runs: in 24 h,
  351 `digest.build` runs (about 58 min of build time) across 32 ready kundlis, while the sweep itself fires on time
  every 5 min. Cause: `runDigestSweep` tops up the annual set of 3 random ready kundlis per sweep and calls
  `markDigestInputsChanged` whenever a top-up fetched any row; the next sweep rebuilds that digest. 450 top-ups fetched
  6,193 rows and failed 243 (sets average 126 of 210 wanted, 70 remaining), so most kundlis are marked stale again
  every few hours. Each rebuild re-reads 860 rows and moves the digest version the reading store keys on, which can
  also invalidate stored Oracle readings. Owner: reading-dev. Done: a top-up marks stale only when it completes a year
  the digest reads (or once per day per kundli), failed items back off, and builds per kundli per day drop to at most
  one or two.
  Fix: `ensureAnnualSet` reports `yearsCompleted` and backs failed rows off 6 h (`ANNUAL_FAILED_BACKOFF_MS`, the
  store's own retry is 60 s); `runDigestSweep` marks stale only when a year completed. Check after deploy: `digest.build`
  runs per kundli per day from agent_runs should fall to 0-2.
- **P2 · Admin web `src/lib/themeCss.test.ts` fails to load on admin `develop` (d34221f):** "SyntaxError: Invalid or
  unexpected token", no tests run. Seen 2026-11-08 night in the main checkout and in `wt/admin-loads` after merging
  develop; from the theme work (`feat/admin-theme`), not the Dashboard loads branch. Owner: the theme session. Done: the
  file loads and its tests pass in CI.
- **P2 · The dossier's `trigger` has no `event` value.** The background build writes its dossier with `trigger:
  'request'`; a lab reader cannot tell a page-queued build from an in-request one. Owner: reading-dev. Done:
  `DossierInput.trigger` gains `'event'` and `buildEvent.ts` passes it.
- **P2 · The API logs no reason per invocation and no line per engine call** (`server.ts` `POST /events`,
  `src/lib/astroKundliClient.ts`). Admin › Usage › Lambda calls (admin doc 13) splits web vs background vs each sweep
  from AWS metrics, and the self-invokes from `digest_built` / `reading_build_*` / `kundli_sync_invoked`, but cannot
  split the engine's calls (registration pulls vs other data requests): the engine logs nothing per request and
  `[AstroKundli] outgoing` is a multi-line object dump. Owner: reading-dev. Done: `queueLog({ event: 'lambda_invocation',
  reason: <source> })` first thing in `POST /events`, and `queueLog({ event: 'engine_call', reason:
  'registration'|'digest'|'reading'|'request', type })` beside each engine invoke; the admin page fills its engine
  columns with no admin change (its Logs Insights query already counts both names).
- **P1 · Admin Lambda calls page needs IAM before it can read AWS.** Role `aiadastra-admin-api-exec` lacks
  `cloudwatch:GetMetricData`, `events:ListRuleNamesByTarget`, `logs:StartQuery`, `logs:GetQueryResults`/`StopQuery`.
  Exact policy in `docs/admin/13-usage-lambda-calls.md` §5. Owner: deploy session (Sachin's typed yes). Done: the
  deployed page shows November's totals and they match the Lambda console's Monitor tab.

## Filed 2026-11-09 by the loading overlay build (docs/loading-overlay/01–03, web and server `feat/loading-overlay`)

- **P2 · Nano Banana could not draw a correct house chart in 8 calls (2026-11-09, docs/loading-overlay/03 §Log).**
  Both runs (full prompts, then text-free boards) broke the content rules: wrong house numbers, misspelt names, wrong
  geometry on three of four boards. The veil ships the exact code-drawn SVG charts restyled after the generated look.
  Owner: Sachin decides whether to try again (new yes needed; a different approach would be: generate backgrounds only
  and composite the board, glyphs and names in code, which `sharp` renders correctly here). Done: four images that pass
  the checklist in 03 §Acceptance, or the decision to keep the drawn set.
- **(resolved 2026-11-09) P1 · Every Gemini key in the server `.env` is rejected** — Sachin supplied a key in chat for
  the illustrations and asked for it to be revoked afterwards; the `.env` keys are still invalid. Original text follows.
- **P1 (was) · The four Nano Banana illustrations are not generated: every Gemini key in the server `.env` is rejected.**
  Sachin typed yes on 2026-11-09 (4 images + up to 4 retries, ≈ $0.16–0.32). `GEMINI_API_KEY`, `GEMINI_API_KEY_SACHIN`
  and `GEMINI_API_KEY_NISHA` all answer `400 API_KEY_INVALID` (4 image calls + 3 free model-list probes, nothing
  billed; log in `docs/loading-overlay/art/log.md`). The live paid key sits only in the Lambda env, which this machine
  cannot read. Owner: Sachin (a valid key in the server `.env`), then any session runs
  `node docs/loading-overlay/generate-art.mjs --web <web checkout>` and `npm run art:encrypt`. Until then the veil shows
  the SVG placeholders (`AIAstra_WEB/art/overlay/`). Done: four `.webp` files pass the checklist in 03 §Acceptance.
- **P1 · `OVERLAY_ART_KEY` must be set in two places before the art shows on staging:** the API Lambda
  `aiastra-server-api` env and the Amplify build env of `AIAstra_WEB` (same 64 hex chars, `openssl rand -hex 32`).
  Unset: `GET /api/assets/overlay-key` answers 404 and the veil shows its lines alone (by design). Owner: deploy session
  (Sachin's typed yes). Done: a signed-in page on staging shows a chart behind the loading line.
- **P2 · The veil has no art before sign-in** (session restore on `/`, `/signin`): the key needs a session. Decided in
  docs/loading-overlay/01 §5; revisit only if the restore wait grows. Owner: web-dev.
- **P2 · `tests/unit/env.test.ts` › `isAstroKundliConfigured returns false when base URL is empty` fails in a worktree
  with the main checkout's `.env` copied in** (the test reads the real env). Pre-existing, unrelated to this build.
  Owner: server-dev. Done: the test stubs its env.
- **P2 · Web `src/routes.tsx` imported `boardsEnabled` without using it, failing `npm run typecheck` on `develop`
  9f6b89d.** Removed on `feat/loading-overlay`. Owner: none (fixed). Noted so the theme/boards session knows.
- **P3 · `OracleVeil` keeps its `offset` prop for callers but no longer uses it** (each veil picks a random line).
  Remove the prop and the `useOracleLine` offsets in `SelfReading.tsx` when that file is next touched. Owner: web-dev.
- **P2 · Web `src/pages/welcome/WelcomeWizard.test.tsx` › "falls back to null when @mediapipe/tasks-vision is
  unavailable" passes only where `node_modules` lacks the package.** In a fresh `npm ci` worktree the package is
  present, `FilesetResolver` hangs on the wasm fetch in jsdom and the test times out at 30 s; in the older
  `AIAstra_WEB-known-bugs` worktree it passes. Owner: web-dev. Done: the test mocks the import instead of relying on the
  package being absent.
- **P2 · Web `src/lib/theme.test.ts` › "theme-light.css is up to date" fails to load on `develop` 9f6b89d** (SyntaxError
  importing `scripts/gen-light-theme.mjs` through `pathToFileURL`), the same class as the admin `themeCss.test.ts`
  failure already filed. Pre-existing; seen on the untouched develop worktree too. Owner: the theme session. Done: the
  test imports the generator in a way vitest accepts on Windows.
- **P3 · Admin web `overlayArt.ts` is off under vitest** (`import.meta.env.MODE === 'test'`) because the page tests read
  the first recorded fetch; its own test turns it on. Owner: admin-dev. Done: the page tests pick their request by URL
  and the guard goes.

## Filed 2026-11-09 by the board-quota build (docs/billing/02, branch `feat/board-quota`)

- **Superseded 2026-11-09 by doc 03 (offline-first boards).** Opening a board never costs a question; only a fresh
  reading the person asks for, once "good until" has passed, takes one; each board's first reading is free. Boards always
  show their last reading, at the limit too (Sachin's decision kept). See `docs/billing/03-offline-first-boards.md`.
- **P2 · A served older You synthesis may not match today's code panels.** Offline first serves the newest stored
  synthesis even when its key (answers, clock, year, prompt version) differs from today's. Its areas are per panel, so
  they still fit, but a prompt or shape change could show an older card shape until the person refreshes. Found
  2026-11-09 building doc 03. Done: decided acceptable, or the fallback limited to the same prompt version.
- **P3 · The You reading's own "Built …, next check …" line sits at the bottom of that page.** The board stamp at the
  top (doc 02 §10) covers the You board, and the page re-reads the question count when the background synthesis lands
  (web `feat/board-quota`). If Sachin wants the reading's own dates at its top too, move `builtLine` up. Owner: web.
- **P2 · Web checks that fail on web `develop` without this change.** `src/components/AskModal.test.tsx` (2 tests: the
  conversation list order, "Old" not found; "Unpin My nature" not found), `src/lib/theme.test.ts` (SyntaxError on the
  dynamic import of `scripts/gen-light-theme.mjs` under vitest on Windows), and `tsc -b`: `src/routes.tsx(24,1)`
  `boardsEnabled` declared but never read. Found 2026-11-09. Done: all three green on web `develop`.
- **P2 · A board charge is keyed by user and day only, not by kundli.** A person who replaces their kundli the same day
  gets the new board's first build free. Acceptable for now. Done: decided, or `kundliId` added to the key.
- **P2 · Board charges are not deployed.** Server and web `feat/board-quota` merged to local `develop` 2026-11-09, not
  pushed. Owner: deploy session (server first, then web). Done: a free staging account opening a new board sees the count
  move by one, and opening it again does not.

## Filed 2026-11-09 by the You board v2 review, server side (docs/reading-engine/66 §12, audit `docs/research/research_notes/Self screen design patterns/server_self_board_audit.md`)

Server facts from `develop` 2026-11-09; each item fact (seen in code) or inference.

- **P1 · The Self Oracle receives nothing about the person but the clock, today and the confirm answers.** `oracle.ts:589-606`:
  no gender (`Auth.gender` exists), no age or age band (not computed anywhere), no `person_facts` beyond `self.confirm.*`
  (`service.ts:198-203`), no tone or shade, no mood, no declined-topic check on this path; no expertise field exists
  (`novice` is a role, `src/auth/roles.ts`). Fact. Owner: reading-dev (doc 66 §4.1–4.2). Done: the profile pack built from
  `auth`, `person_facts`, `area_checks`, `declined_topics` and consumed by the Personalizer; a test shows two profiles get
  two cards from one Oracle document.
- **P1 · The Oracle prose is asked to carry chart terms, and the card shows the prose.** `prompts/generated.ts:16`
  (`oracle/self-areas`: "the chart terms and the classical rule named inside the prose" in `paragraphs`); web
  `SelfReading.tsx:475-481`. Fact. Owner: reading-dev. Done: Personalizer card face in plain words; Oracle prose under
  Chart details (doc 66 §4.1).
- **P1 · Node derives astrological values in eight places on the Self path** (CLAUDE.md: not even a lookup). Rasi-period
  lord lookup `houseLayers.ts:394-401` (co-lords of Scorpio and Aquarius ignored); karaka→planet join by sign, house and
  dispositor `:166-174`; transit house from a sign→house map `oracle.ts:325-351`; "over natal Moon" by sign comparison
  `oracle.ts:352`; activated houses `digest/activation.ts:134-147`; tone and shade scoring with regex-classified dignities,
  avasthas and taras `houseLayers.ts:125-130, 539-540`; sensitive passage `service.ts:727-730`, `purview.ts:233`; chapter
  agreement by month distance `panels/chapters.ts:20`. Fact. Owner: engine + reading-dev (doc 66 §4.3). Done: the engine's
  `pressure_inventory` and `dasha.applicable` supply every window, lord, polarity and strength; Node selects and formats
  only; the eight sites deleted or reduced to row selection.
- **P1 · `boardFocusInstruction` for self still asks for PANEL_SYNTHESIS lines while `self-areas.md` demands JSON only.**
  Both go to the lineman and the Oracle in areas mode (`oracle.ts:772, 1162`). Fact. Owner: reading-dev. Done: one
  instruction per mode; a test asserts no PANEL_ text in the areas-mode brief.
- **P1 · Claim ids are lost on the way to the card.** The prompt asks for `claim:<id>`; the validator keeps only keys in
  `allKeys` (`areaDoc.ts:251-253`); `claimIds = area.evidence.filter((k) => !k.includes(':'))` (`oracle.ts:1276`) drops every
  prefixed id, so headline lines and plan steps carry empty or fallback ids (`service.ts:553-559`). Fact; net effect
  inference. Owner: reading-dev. Done: `claim:` keys resolve against the panel claims and survive to `claimIds`; a test.
- **P2 · Every transit line cites `{house:D1.h1}`** whatever house the transit is in (`oracle.ts:352`). Fact. Done: the
  engine row id of the ingress is the evidence.
- **P2 · The lineman prompt hard-codes one person's years.** `R15-self.md:17-18` ("2025, 2026, 2027", "prior to the Oct
  2026 return", "covering Nov 2026"), `oracle/self.md` likewise, the family.year header says "2025/2026/2027"
  (`oracle.ts:289`). The October return is one person's Tithi Pravesha. Fact. Owner: reading-dev. Done: years and the return
  date come from `asOf` and the stored annual rows; a test on a second kundli.
- **P2 · The prompts name data the packs do not carry.** Sade Sati (named among the transits, not in the sky pack; spans
  used only as validator windows `service.ts:719-722`); D60 "root karma" (only h1 and planets sent); D20/D24 (named in the
  mind and atma rules, unread); Patyayini (sent only if stored as an annual dasha); BAV, transit bindus and house from the
  Moon (in the layouts, not in the packs). D10 is sent and no Self panel reads it. `digestSlices.ts` is used by chat only.
  Fact. Owner: reading-dev. Done: one data vocabulary per path (the prompt names only what the packs carry) and the
  `pressure_inventory` for the transit and Sade Sati windows.
- **P2 · The year pack labels the first annual period active when none covers today** (`oracle.ts:~312`, `?? d.periods[0]`).
  Fact. Done: no active period → the pack says so and the year area is withheld for the live line.
- **P2 · Three certainty vocabularies on one card.** Claims `fact/confirmed/likely/split` (`types.ts:53`), lines
  `fact/strong/moderate/possible` (`:23`), areas `strong/likely/possible` (prompt), chat four tiers. Fact. Done: one set
  of three words on every card (doc 66 §4.7); the others internal.
- **P2 · Clock switches are free, unbounded and unlogged on the server.** One charge per board per day
  (`buildEvent.ts:153-156`, `questionGate.ts:46`), each distinct clock a full Oracle build (~60 s, ~$0.05, inference from
  the replay); a confirm answer also changes the key (`ans=`, `oracle.ts:765`) and rebuilds; no per-user spend cap; no
  audit row (`service.ts:289-297`, `selfReadingRoutes.ts:85-98`); a switch during a build waits (`already_building`) and
  after a failed build waits up to 30 min (`buildEvent.ts:172-177`, inference). Fact/inference as marked. Owner: server +
  web. Done: doc 66 §4.4 (consent, `board:self:<day>:clock:<system>` charge, `clock_viewed` event, applicability list,
  confirm answers re-run the Personalizer only).
- **P2 · `budget_exceeded` Oracle results are stored and served until the running period ends** (`oracle.ts:980-995`).
  Fact/inference. Done: not stored; the area falls back and the dossier records the gap.
- **P2 · The catalogue has drifted from the code.** `self.reading.oracle` cites prompt `oracle/self.md` and the functions
  `runFamilySubAgents` and `runSelfLineman`, which do not exist (default prompt is `oracle/self-areas`); `SELF_PLANNED`
  lists D4, D7, D60 which `area/self.ts:15` does not read; the section comment says "planned" while every row is `built`
  (`catalog.ts:455, 626-628, 1621-1650`). Fact. Owner: reading-dev. Done: rows match the code; the contracts test checks
  that every cited function exists.
- **P2 · `self.mind_shade` cannot be written through `writeFacts`** (not in `FACT_CATALOG`, `profile/facts.ts:11-20`), so
  the Self shade tie-break (`shadeResolver.ts:593-596, 1095-1109`) never fires for real users; only the research QA sets
  it. Fact. Done: retired by the inventory (doc 66 §4.3) or added to the catalogue.
- **P2 · The lineman still receives the full packs** (126 k prompt tokens, `oracle.ts:999-1001`), against docs 64–65
  ("findings and claims only"); most of the gap to the 15 s target. Fact. Done: lineman on findings and claims; replay
  under 20 s wall.
- **P3 · The sections stream does not serve /you**; `GET /api/self/reading` still runs uncached code panels on each open
  (`pageTiming.ts:666-740`, `service.ts:331-363`). Fact. Done: panels served from the store or the stream.
- **P3 · The area board and the reading are two surfaces that share only the digest** and can disagree about "now"; the
  area board ignores `preferred_dasha`. Fact (shared digest), inference (disagreement). Done: one build writes hero and
  areas (doc 66 §4.1).

## Filed 2026-11-09 by the You board v2 review (docs/reading-engine/66, web audit `docs/research/research_notes/Self screen design patterns/web_self_board_audit.md`)

Web facts are from `AIAstra_WEB` `develop` (70ae27f, worktree `AIAstra_WEB-known-bugs`); each item says fact (seen in code) or inference.

- **P1 · Internal technique ids are shown to every user.** `self.activation · Present Tone Consensus` on the tone card
  (`AreaBoardView.tsx:480-482`), `self.focus · Companion Fact Selector` (`:457-459`), badges on Now/Holds/Presses/Ahead/
  Questions and on the wizard (`WelcomeWizard.tsx:17-25`). Fact. Owner: web. Done: no technique id or agent label on a
  consumer screen; a test greps the rendered You page for `self.` and `·  Consensus`.
- **P1 · Chart terms and vote counts on the first screen.** "Timing Clocks 3 supporting · 2 testing of 7 clocks", "Core
  Strength", "Key Horizon", "Primary pressure" (`AreaBoardView.tsx:487-507`); "Read on your Vimshottari clock"
  (`SelfReading.tsx:215`); "Confirmed by Vimshottari and Chara" on the chapters face (`:572-576`). Breaks doc 45 §3.3.
  Fact. Owner: web + server (doc 66 §4.7 hero). Done: hero per doc 66 (tone word, one sentence, strip, question).
- **P1 · The Oracle is told to put chart terms in the card prose.** `oracle/self-areas` asks for "the chart terms and the
  classical rule named inside the prose" in `paragraphs` (`src/reading/prompts/generated.ts:16`), and the web renders
  `paragraphs` on the card face (`SelfReading.tsx:475-481`); only the headline is term-free. This is the disconnect
  Sachin saw on 2026-11-09. Fact. Owner: reading-dev (doc 66 §4.1 Personalizer). Done: the card face is written by the
  Personalizer in plain words; the Oracle prose sits under Chart details.
- **P1 · The clock switch has no confirmation, no cost line, no explanation, ignores failure, and changes Love and Work
  too.** `SelfReading.tsx:204-209`, `:284-316`; `PUT /api/self/clock` writes `kundli.preferred_dasha`
  (`service.ts:733-740`) which `getBoardReading` uses for self, love and work (`:268-277`); the list is every system with
  stored periods (`src/reading/self/clock.ts:34`, up to ~40), no applicability shown, no per-system line; a new clock is
  a new paid synthesis (keys `service.ts:355`, `oracle.ts:284`); logging is one client `track('chip_select')`, no server
  audit row. Fact (paid call per switch: inference from the keys). Owner: web + server. Done: doc 66 §4.4 (consent
  sheet with the cost, applicability from the engine, `board:self:<day>:clock:<system>` charge, `clock_viewed` event,
  the per-board clock or a notice that all three boards change).
- **P2 · Staging shows "Choose your dasha" and "… Dasha" labels that exist in no branch.** The code says "Choose your
  clock" and strips "dasha" from labels (`SelfReading.tsx:288`, `words.ts:102-148`); `release-candidate-staging` has no
  Your reading tab. Sachin's screenshot of 2026-11-09 shows the dasha wording, so staging serves a build that is not
  `develop`. Fact for code, inference for staging. Owner: deploy session. Done: the build staging serves identified and
  `develop` deployed.
- **P2 · Sixteen destinations on one page.** Question card + tone card + seven top tabs stack above the nine-area panel;
  the modular rule (doc 45 rule 11) holds only inside Your reading. Fact for order. Owner: web (doc 66 §4.6: three groups,
  ten areas, the seven tabs retired). Done: the You page is hero + chips/rail + one card.
- **P2 · Board polling gives up silently** after 10 × 30 s; the veil never lifts and no Retry shows
  (`AreaBoardView.tsx:386-393`). Fact. Owner: web. Done: a "Still working… Retry" line after the last poll.
- **P2 · Oracle failure is silent on the card.** `failed` / `budget_exceeded` fall back to code lines with no word to the
  person (`SelfReading.tsx:136`, `:348`). Fact. Owner: web. Done: one line "The full reading did not finish; here is
  what the chart says for sure" on the affected card.
- **P2 · Personal facts never reach the reading.** Gender (collected at birth details) is unused; `self.focus`, work,
  love, children do not reach Your reading; nothing collects mood, the problem on arrival, or an expertise level (the
  role `novice` is every new account, `src/auth/roles.ts`). Fact. Owner: reading-dev (doc 66 §4.2 profile pack). Done:
  the profile pack built and consumed by the Personalizer; a test shows two profiles get two cards from one Oracle doc.
- **P2 · `self.focus` is asked two ways.** The wizard stores up to three (doc 52), the board asks a single choice from a
  different option list and overwrites it. Fact / inference. Owner: web + server. Done: one question, one key, one
  option list; the board reads, it does not re-ask while fresh.
- **P3 · Two build stamps with different dates** (`ReadingStamp` at top, `builtLine` at bottom). Fact. Owner: web.
- **P3 · Millisecond timings, claim ids, evidence keys and purview jargon under Chart details** (`SelfReading.tsx:
  392-416`, `:545`; `purview.ts:95`). Behind a tap but visible to any user. Fact. Owner: web + server. Done: Chart
  details shows placements, periods and rules in words; ids and timings only for `student`/`astrologer`/`researcher`
  roles or the admin Lab.
- **P3 · `clock.reason`, `clock.confirming`, `panel.lead`, `oracle.text` are never rendered**; the reason the chart chose
  its clock is lost to the person. Fact. Owner: web. Done: the clock sheet shows "the one your chart qualifies for:
  <reason>".
- **P3 · The tone card ignores `preferred_dasha`** so it can disagree with the reading after a clock switch. Inference.
  Owner: server. Done: hero and areas read the same clock (doc 66 §4.1 hero from the same build).
- **P3 · No shared carousel component.** Scroll-snap, chips and dots are copied into five web files; no colour tokens
  (Tailwind utilities only), no custom font. Fact. Owner: web. Done: one `Carousel` and one `Chips` component used by
  You, Love, Work and Lucky times.

## Filed 2026-11-09 by the Self v2 contracts build (doc 66 §13, branch `feat/self-v2-contracts`)

- **P3 · The local Prisma client is stale.** `npx tsc --noEmit` on `develop` fails only on `src/auth/terms.ts(86,15)`:
  `terms_version` is in `prisma/schema.prisma:70` but not in the generated client. Found 2026-11-09; not caused by this
  branch. Owner: a Haiku sub-agent (AGENTS.md: `prisma generate` is an install step). Done: `npx prisma generate` run in
  the main checkout and tsc clean.
- **Status · Self v2 step 1 (contracts) merged.** `src/reading/self/v2types.ts` (hero + eleven areas, refresh triggers,
  the pressure inventory, the ten `self.sub.*` outputs, `SelfBuildContext`, `AreaBrief`, `AgentSlice`, `OracleInput`,
  `PersonalizerInput`, `PersonalCardDoc`, `HeroDoc`) and `src/reading/person/profile.ts` (profile pack, age bands from
  `SELF_AGE_BANDS`, gender null = neutral, practitioner roles, mood per day, hash). Next: steps 1b and 1c in parallel,
  and the engine export (needs Sachin's OK). The `self.mood` fact key is read but not yet in `FACT_CATALOG` (step 8).
- **P2 · Web `.env.development` points at the old Render API (`https://aiastraserver.onrender.com`), which answers 503**
  (checked 2026-11-09 from a local dev server: sign-in shows "Something went wrong"). Local `npm run dev` therefore
  cannot sign in. The live API is the CloudFront/Lambda origin in `.env.staging`. Owner: web-dev. Done: dev points at
  a local server (`http://localhost:3000`, as the file's own comment says) or at staging with its CORS allowing the
  dev origin.


## Filed 2026-11-09 by Self v2 step 1b (branch feat/self-v2-subtechniques)

- **P2 · S3 windows run degraded until the engine stores a pressure grade.** `src/reading/self/sub/windows.ts`: no
  `kundli_pressure` table and no 1–3 strength in any stored row, so every window is strength 2, transits and Sade Sati
  are polarity `mixed`, and dasha polarity is the period lord's stored functional-nature label through
  `FUNCTIONAL_POLARITY` (`v2words.ts`). `heaviestNow`, `top3` and the hero strip therefore order only by end date. Fact
  (gaps `windows: ... degraded` on every build). Owner: engine `feat/pressure-inventory` (doc 66 §13 step 2). Done:
  S3 reads `kundli_pressure` rows when present and the two gaps disappear.
- **P2 · No engine sensitive-passage flag.** S7 `bodyFacts.sensitive` is always false with a gap; the v1 service still
  decides it in Node (`service.ts isSensitive`: Ketu sub period or Saturn on 8 and 12), which doc 66 §12 lists as a
  Node derivation. Fact. Owner: engine pass (doc 66 §4.3) then server. Done: the engine stores the flag, S7 reads it,
  and `isSensitive` is deleted.
- **P3 · No engine strength grade for yogas; no yoga → grace link beyond dosha exceptions.** S4 entries are all strength 2,
  and a cancellation yoga (e.g. Neecha Bhanga) holds a risk only by naming the same planet (S5 joins on
  `planet:D1.<p>` evidence). The stored `yearLord` is also absent on the research kundli's VP rows, so S9 `yearLord` is
  null with a gap. Fact (fixture `tests/fixtures/self/research-calibration.json`). Owner: engine pass. Done: the engine
  stores a grade, the knot a cancellation cancels, and the year lord.
- **P3 · `self.sub.*` spans run under agent `self.reading_panel`.** `src/reading/self/sub/index.ts` `SUB_AGENT`: step
  1b may not edit `src/agents/registry.ts`. Owner: the agents lane (`feat/self-v2-agents`). Done: a `self.sub` code
  agent row, `SUB_AGENT` and the catalogue rows' `agents` switched to it, and `src/reading/self/sub/index.ts` added to
  `CALL_SITES` in `tests/unit/techniques/summaries.test.ts` (its own test in `tests/unit/reading/self/v2` covers it
  until then).
- **P3 · Sub-technique and area outputs are not yet written to `technique_outputs`.** `runSelfSubTechniques` fills
  `ctx.sub` and `ctx.stamps` and areas carry `refreshStamp`, but no `withTechniqueOutput` store under `self.sub.<name>`
  / `self.area.<id>` keyed by the stamps (doc 66 §4.8 step 2), so a boundary rebuild still reruns all ten. Owner: the
  build-order lane (`runSelfReadingBuild`). Done: store keys from the stamps; only the fired sub-techniques rerun.
- **P3 · Catalogue ids differ from `SELF_V2_AREAS[].technique`.** Areas are registered as `self.v2.<area>` (to avoid the
  existing `self.reading.<x>` rows), while `v2types.ts SELF_V2_AREAS` names `self.now`, `self.stuck`, … Owner: whoever
  next edits `v2types.ts` (contracts lane). Done: one id per area in both places.
- **P3 · S5 does not yet drop declined matters.** Doc 66 §4.8 says S10's declined facts remove matters from S5, but
  declined keys are fact keys (`love.status`), not matters, and no reviewed fact-key → matter table exists. Owner: Sachin
  (words table) then server. Done: a reviewed table and S5 filtering by it.
