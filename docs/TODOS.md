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
  Status (2026-11-09): engine fix in AIAstra_Radha `feat/dasha-levels-1-6` (with `tp_start`/`tp_end` on every TP year
  row); server side done on `feat/tithi-pravesha-year` (doc 66 §4.10: `runningTithiPravesha` picks the TP whose return
  moment has passed, never rescales a lifetime dasha and withholds the TP short clock until the dasha is bounded). Open
  until the engine ships and the digests are rebuilt.

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
  - 2026-11-10: Sachin's set now has 210 of 310 annual keys for 2006–2036 ready; 100 missing and 40 overlay years missing. The pull from the dev session failed (no local credentials can invoke `aiastra-pyjhora`; `aiastra-ops` was never granted it). Handed to the deploy sub-session with `scripts/pull-sachin-annual.ts` (disk-guarded) and `npm run transits:overlay` (month 1997–2036, day 2016–2019). Done 2026-11-10 by the deploy session and verified by dry run: 310/310 annual keys ready, overlay month 1997–2036 and day 2016–2019 all stored. Archisha (`6514751c`) still needs the same pull. Follow-up: give the dev machine a least-privilege invoke role for `aiastra-pyjhora`, or route every engine pull through the deploy session by rule.
  - 2026-11-10 finding: the stored `kundli_transit_overlays` payload has no exact contacts on natal points (keys: rows, ingresses, stations, eclipses, lunations, sade_sati, dhaiya, double_transit). The only contacts for Sachin are in `evals/fixtures/G1` and stop at 2026, so a forward reading (2027–2036) can state sign and house transits but not "Rahu exact on natal Mercury on <date>". Done: the engine's contacts are stored with the overlay (or as their own rows) for the full span, and the transit-reading skill names where to read them.
  - 2026-11-10 finding (money readings): no stored gains chart. The G1 export has D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D60 and no D11 (nor D5, D6, D8, D40, D45), so a funding or income reading cannot cite the divisional chart of gains. Also no way to size money: nothing stores a person's own past inflows (date, amount, source) to calibrate period strength against, and a company has no chart of its own (incorporation date, time, place). Done: D11 pulled and digested; a decision from Sachin on a private "money ledger" fact type and on company charts.
  - 2026-11-10 finding (date picking): `day_tables` hold November 2026 only (San Jose from October) and `kundli_day_overlays` for Sachin stop at November, so a "pick a date" question cannot look past 30 Nov 2026. Correction the same day: the chart of a chosen moment does exist (catalog type `prashna`, served by the live engine; nine answers saved untracked under `evals/fixtures/moment-charts/`), but no product path or script uses it for picking a start time, and December and January were pulled by hand through the deploy session. Done: day tables and overlays pulled a rolling 90 days ahead, and a "pick a time" path that casts `prashna` for the clean windows of a shortlisted day.
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
- **Personalizer voice by gender (branch `feat/board-layout-vclean`, 2026-11-12): written without running anything.** The
  voice (`prompts/personalizer/voice.md`, `personalizerVoicePrefix` in `src/reading/self/v3/personalizer.ts`, the stereotype
  list in `personalizerValidate.ts`) and `tests/unit/reading/self/v3/voice.test.ts` were written with no `npm`, `tsc` or
  `vitest` run (the worktree's `node_modules` was broken). `src/reading/prompts/generated.ts` was updated by hand; its
  `PROMPT_VERSION` (`8a614959c7b2`) was computed with a PowerShell copy of `scripts/embed-prompts.mjs`'s hash, which
  reproduced the old value `3771a563e8b6` before the change. Status: open. Done: `npx tsc --noEmit`, `npx vitest run
  tests/unit/reading/self/v3 tests/unit/reading/prompts.test.ts tests/unit/reading/cards` and `node scripts/embed-prompts.mjs
  --check` pass in CI or a working checkout.
- **The voice is not measured.** Whether the three voices read differently and never stereotype is unproven: the first replay
  on stored dossiers in the Lab (docs/reading-engine/65 §9; no paid call without a yes) must compare the same Oracle cards
  written as woman, man and neutral, and count `STEREOTYPE_PHRASES` hits. Owner: Sachin's yes for the replay. Done: the
  replay is in `docs/reading-engine/`.
- **Voice only on the v3 card path.** The v2 Personalizer (`personalizer/self.md`) and the Now card (`cards/now.md`) still
  write in one register for every gender. Done: the same `voice.md` is wired there, or a decision that they stay as they are.
- **A stereotype phrase withholds the whole v3 card.** `textProblem` flags the phrase, and in the v3 face a problem in
  the line or any span withholds the card (the repair pass re-asks once with the reason). A word such as `girl` may also
  appear in a legitimate sentence about a person's daughter. Done: decide whether the face drops only the sentence, and
  review the default list (`DEFAULT_PERSONALIZER_STEREOTYPE_PHRASES` in `src/config/env.ts`) after the replay.

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
  - Fixed 2026-11-09: `src/components/AskModal.test.tsx` failed because the sidebar now opens collapsed (206b350); the
    tests press Expand all first.
  - Fixed on `develop` by 2026-11-09: `src/routes.tsx` `boardsEnabled` typecheck error (tsc -b is clean).
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
- **Fixed 2026-11-09 (branch `fix/develop-red-tests`):** the clarify and annual-prashna tests failed because `planner.ts` keeps model replies in an in-memory
  `clarifyCache` keyed by question, so a case was answered by the one before it. Both describe blocks now call
  `clearClarifyCache()` in `beforeEach`. Was: **Two clarify tests fail on `develop`, unrelated to BUILD-GAPS.** `tests/unit/reading/clarify.test.ts:157` expects
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
- **Clarify and prashna part fixed 2026-11-09 (cache between cases, see above); R14 order-dependence still open.** **P2 — Three reading unit tests fail on this branch without touching anything it changed** (found 2026-11-08 running
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
- [ ] (2026-11-10, transit sky) `transit_instants` holds Pune under two place keys, `18.52,73.85,5.5` (144 monthly rows 2026–2037) and `18.52,73.86,5.5` (296 rows 2025–2035, with partial daily rows in 2026–2027). Sumit's kundli stores lon 73.8567, which rounds to 73.86. Decide which key is canonical, make the sky job round the same way as the kundli, and stop writing the other key; do not delete rows until a reading path is confirmed not to read them.
- [ ] (2026-11-08, verification) Sumit career back-test used nine dated events (Dec 1999, Jan 2001, Nov 2002, 2004-05, 2006-07, 2009-10, Oct 2013, 2017-18, 2021). Annual D10 exists only from 2016. Correction 2026-11-10: the 2020 Tithi Pravesha chart (19 Aug 2020–7 Sep 2021, D1/D9/D10) IS stored and covers the 2021 promotion: lagna Aries, Saturn own in the 10th, Sun+Moon+Mercury 5th, D10 Jupiter 11th; the check used TP2021 (from 7 Sep 2021), which also has Saturn own in the 10th, so the finding stands. The career clock's third level in `kundli_activation` (engine payload `levels=4`) matches the equal-division dates used, so that caveat is withdrawn. Candidate chart-specific rules to test on other charts: (a) Yogini mahadasha start within ~12 weeks of a career event (3 of 5 starts since 1999), (b) career clock (Chathuraaseethi Sama) sub-lord Mercury/Venus or MD Venus for promotions, Sun sub-lord + Vimshottari Rahu sub-period + slow planet entering the 7th for employer change, (c) Jupiter entering the 10th sign preceded a promotion by 1–12 months (2004, 2016–17).
- [ ] (2026-11-10, reading accuracy) The 8 Nov Sumit answer read slow-planet sign changes off the monthly overlay rows (first-of-month sample) and got four dates wrong by up to a month. The shared range sky (`transit_range_skies.payload.ingresses`) has the real dates: Rahu/Ketu change 5 Dec 2026 (said "Jan 2027"); Jupiter retrograde into Cancer 25 Jan 2027 (said "Feb"); Saturn into Aries 3 Jun 2027 and back to Pisces 20 Oct 2027 (said "early Jul" and "Nov"); Jupiter into Virgo 26 Nov 2027 (said "early Dec"), back to Leo 28 Feb 2028, Virgo again 24 Jul 2028. Fix: the transit-reading skill and `src/reading/life/sky.ts` consumers must take ingress and station dates from the range sky's `ingresses`/`stations` lists, never from the monthly `bodies` table. Add that line to `.claude/skills/transit-reading/SKILL.md`.
- [ ] (2026-11-10, transit overlay) The 10 Nov Sumit 3/6/9/12-month answer used three values not returned by the engine for this kundli: (a) Mercury and Mars retrograde spans and Mars crossings of natal Venus/Sun/Moon, found by a throwaway script comparing consecutive daily noon longitudes in `transit_instants` (day-level only); (b) the natal house of each eclipse and lunation, by matching its sign to the stored house cards; (c) Jupiter's aspect from Cancer onto the 12th, by rule. Fix: pull a `--step day` overlay for `75b0d618-…` for Nov 2026–Feb 2028 and have the shared range sky carry Mercury, Venus and Mars stations (it lists only Jupiter and Saturn stations today), so all three come from the engine.
- [ ] (2026-11-10, transit sky) `transit_instants` San Jose daily rows come in two payload shapes: `payload.planets` (273 of 410 rows, 1 Nov 2026–15 Dec 2027) and `payload.charts.d1.planets` (137 rows, from about Aug 2027). Any reader that assumes one shape silently drops the other. Normalise on one shape (or make `SkyView` the only reader) and backfill.
- [ ] (2026-11-10, transit sky) The shared range sky and Sumit's overlay stop at 31 Dec 2035 while the stored period tables and annual charts (`TP2036.*`) run through 2036. Any 2036 window is therefore read without a slow-planet trigger (the 10 Nov "promotions 1999–2036" answer says so). Fix: extend `transit_range_skies` and the kundli overlay to at least 31 Dec 2037 so the horizon of the sky matches the horizon of the annual rows.
- [ ] (2026-11-10, career reading) Back-test on Sumit's record (month-by-month count over stored rows 1999–2026, a tally by a throwaway script, no astrological value computed): the conditional clock that applies to this chart gated every promotion. With Mercury or Venus as its sub-lord, 3 of 3 sub-periods since 2006 gave a promotion (2006–07, 2017–18, 2021). Without it, 4 of 5 other signals agreeing (main-clock Venus or Mercury sub, confirmer clocks, a sign clock on the 10th sign, Jupiter 7th/11th from the Moon or Saturn in the 10th) gave nothing in Jun 2010–Oct 2011 and Mar 2025–May 2026. Doc 42 §A.4 counts clocks as equal votes by family; for a kundli where `dasha.applicable` marks a conditional clock, consider making it a required vote for promotion dates in `src/reading/area/career.ts`, and add this record to the ledger. Also: the year-chart pattern "Scorpio year lagna with the Sun in its own 10th" hit 2 of 4 (2004, 2007 yes; 2012, 2014 no), so it stays a confirmer, not a trigger.
- [ ] (2026-11-10, career reading) Back-test of the employer-change signature on Sumit's record (same kind of tally over stored rows, 1999–2026). Four legs: conditional-clock sub-lord Sun or Saturn; main-clock Rahu at level 2 or 3; a slow planet in the 7th (engine overlay `natal_house`); a sign-clock level-1 turn within 75 days. All four held in only two months of 27 years, Oct 2002 and Oct 2013, the two months he changed employer. Three of four also held in Sep 2010–Jan 2011 with no change, so three legs are not enough. The Jan 2001 start-up had only two strict legs (Rahu was the main-clock mahadasha only, and the sign-clock turn was level 2), so the earlier "3 of 3" wording in the 8 Nov answer overstated it. Record this in the career ledger and in doc 43 §6 as a per-kundli signature, not a general rule.

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
- **Accepted by Sachin 2026-11-09: a served older You synthesis may not match today's code panels.** Offline first
  serves the newest stored synthesis even when its key (answers, clock, year, prompt version) differs from today's, so a
  prompt or shape change can show an older card layout until the person asks for a fresh reading. Sachin: fine, no users
  yet. Revisit before launch.
- **P3 · The You reading's own "Built …, next check …" line sits at the bottom of that page.** The board stamp at the
  top (doc 02 §10) covers the You board, and the page re-reads the question count when the background synthesis lands
  (web `feat/board-quota`). If Sachin wants the reading's own dates at its top too, move `builtLine` up. Owner: web.
- **Fixed 2026-11-09 (branch `fix/develop-red-tests`):** web `develop` checks: `AskModal.test.tsx` (sidebar opens collapsed; tests expand first),
  `theme.test.ts` (the generator's `#!` line with a CRLF ending broke its import under vitest on Windows; the line is
  removed, the script is run as `node scripts/gen-light-theme.mjs`), and `tsc -b` (already clean).
- **Fixed 2026-11-09 (branch `fix/develop-red-tests`), found in the same run:** web `theme-light.css` was really stale on
  `develop` (regenerated); web `WelcomeWizard.test.tsx` "falls back to null when @mediapipe/tasks-vision is unavailable"
  hung 30 s once the package is installed (jsdom waits on its wasm), so the test now mocks the package as missing; server
  `oracle/self-areas-v2.md` and `personalizer/self.md` (Self v2) named the engine inside their own "never name it" line,
  which `tests/unit/reading/oracle/units.test.ts` forbids; reworded without the names and `generated.ts` re-embedded
  (PROMPT_VERSION changes, so those prompts' stored outputs are rebuilt on the next fresh reading).
- **P2 · `src/reading/prompts/method.md` and `persona.md` still name the engine in their prohibition line** ("such as
  Radha or pyjhora"). The test only checks `readers/` and `oracle/`. A model that is told the names can repeat them.
  Done: reworded like the Self v2 prompts and the test widened to every prompt, or kept on purpose with a note.
- **Closed by doc 03: a board charge keyed by user and day.** Charges are now only for fresh readings the person asks
  for; a new kundli's first boards are free by design.
- **P2 · Offline-first boards not deployed yet.** Merged and pushed to `origin/develop` in both repos; deploy brief sent to
  the deploy session 2026-11-09. Done: a free staging account opening a board twice sees the count unchanged, and a fresh
  reading after "good until" moves it by one.

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

- **Fixed 2026-11-09 (final integration) · S3 degraded until a pressure grade:** S3 now reads the engine's `pressure_inventory` from `kundli_data` when stored (`src/reading/self/sub/pressure.ts`); degraded only while the engine is not deployed.
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


## Filed 2026-11-09 by Self v2 steps 5/6/8 (branch feat/self-v2-api)

- **Fixed 2026-11-09 (final integration) · GET /api/self/v2 pending forever:** the store reader is a static import and the build event runs the v2 build under SELF_V2_BUILD=1; the offline e2e test gets `ok` with 12 areas.
- **Fixed 2026-11-09 (final integration) · clock switch during a running build:** the marker and the cards key carry the clock; PUT /api/self/v2/clock queues on the new clock while the old one runs (`tests/unit/reading/self/v2/clockSwitch.test.ts`).
- **Fixed 2026-11-09 (final integration) · `confirmedFacts()` returned `self.mood`:** dropped through `NOT_A_READING_FACT` (`tests/unit/profile/confirmedFacts.test.ts`).
- **P3 · `clock_viewed` is written server side only.** `src/analytics/events.ts` `EVENT_NAMES` does not list it, so the
  web cannot send it through `/api/events`; the row comes from `PUT /api/self/v2/clock` (`analytics_events`: event
  `clock_viewed`, surface `self`, target = system, props `kundli_id, from, to, charged, outcome`). Fact. Owner: whoever
  needs a web-side view event. Done: add the name if the web sends one.
- **P3 · `floor` lines are empty on GET /api/self/v2.** The legacy panels' code lines are optional (`SelfV2Deps.floors`)
  and not wired, because reading them means running the legacy board. Fact. Owner: integrator. Done: the v2 build
  stores the code lines per area and `floors` reads them.
- **Note for the web (`feat/self-v2-page`).** The hero question for a missing fact has `claimId = fact.<key>`
  (`work.status`, `love.status`, `family.children`, `self.focus`); its answer goes to `PUT /api/profile/facts` with the
  wizard's options (doc 52 §3, `src/reading/self/v2api/words.ts` `FACT_QUESTIONS`), not to `/api/self/v2/confirm`. The
  v2 clock switch is `PUT /api/self/v2/clock` (v1 `PUT /api/self/clock` is unchanged).

## Filed 2026-11-09 by the Self v2 integration (engine `feat/pressure-inventory`, web `feat/self-v2-page`)

- **P3 · Engine worktree venv lacks `httpx`**, a test dependency in the engine's `pyproject.toml`, so the 14 API tests in
  `src/jhora/tests/test_r3_vargas_catalog.py` error in `AIAstra_Radha-wt-pressure`. The route was checked by hand (200,
  400 for an inapplicable system, 429). Owner: a Haiku install agent. Done: `httpx` installed and the 14 tests pass.
- **P2 · `pressure_inventory` (engine `bd739ce`) has no `return` rows and no `summary` block** (heaviest now, eases at,
  next support), and its fields are snake_case. Rahu and Ketu periods always press (the engine's functional-nature table
  counts the nodes as malefics). Its gochara table follows doc 66 and differs from `reading_tables`. Owner: engine pass.
  Done: decided which gochara table is canonical; summary computed by the engine, not Node.
- **Fixed 2026-11-09 (final integration) · four fields the web inferred:** `range`/`rangeLabel` per area, `subChapterEnds`, `hero.supporting`, `profile.role` on `SelfV2Response`; the web reads them.
- **P3 · Web: five copies of the scroll-snap carousel remain** (`SelfReading.tsx`, `AreaBoardView.tsx` twice, the Work and
  Life Reading boards) beside the new shared `src/components/carousel/Carousel.tsx` and `Chips.tsx`. Owner: web. Done:
  all boards on the shared components.
- **P3 · Web: the Personalize wizard modal is mounted twice** (`TopNavigation.tsx` with local state, and
  `pages/you/v2/SelfBoardV2.tsx`). Owner: web. Done: one modal opened through shared state.
- **P3 · Web: `tsc -b` leaves `tsconfig.*.tsbuildinfo` files that are not gitignored.** Owner: web. Done: ignored.

## Filed 2026-11-09 by Self v2 step 1c/3/4 (branch feat/self-v2-agents)

- **Status · Self v2 steps 1c, 3, 4 built, not live.** `src/reading/self/v2/` (slices, cache warm-up, Oracle ×3,
  Personalizer + validator, build order, store) behind `SELF_V2_BUILD=1` (default off). No paid call has been made; every
  test mocks Gemini. The first live replay needs Sachin's yes (doc 66 §13: ≈ $0.15 for two dossiers × three profiles).
- **P2 · `OracleAreaDoc` is typed on the v1 panel ids.** `areaDoc.ts` (`OracleArea.id`, `validateAreaDoc` `panelIds`,
  `oracleAreaSchema`) takes `BoardPanelId`; the v2 ids (stuck, chapter, drive, presence, now) are cast through
  `asPanelIds` in `src/reading/self/v2/oracle.ts`. Works at run time (the validator compares strings). Owner:
  reading-dev. Done: `areaDoc.ts` generic over the area id type, the cast removed.
- **P2 · Explicit cache storage is billed per hour and the five family packs are cached explicitly.** The v2 build keeps
  the v1 behaviour (`warmPrefixes` warms the five family packs, the Oracle prefix, then the Personalizer prefix; each
  region has its `llm_cache_entries` row). Coordinator asked to keep explicit caching to the Oracle and Personalizer
  prefixes. Owner: reading-dev with Sachin. Done: storage cost per region-hour priced from the Lab replay; if the family
  packs do not pay back their storage on a warm rebuild, warm only `self.oracle` and `self.personalizer` and let the
  families use implicit caching.
- **P1 · Agent runs logged zero tokens on the v1 Self/Love/Work reading path.** `runSelfOracle` returned
  `tokensIn`/`tokensOut` from its `withAgentRun` callbacks, but `withAgentRun` reads only `usage`, so `agent_runs`
  stored 0 prompt, cached, output and thought tokens for every family reader, lineman and Oracle run (fixed in
  `src/reading/self/oracle.ts`: `usage` now passed; the v2 path passes it too). Not verified: whether Gemini 3.x returns
  `thoughtsTokenCount` at all with `includeThoughts: false` (the Lab's stage summaries also read 0). Owner: reading-dev.
  Done: one stored replay shows non-zero `thought_tokens`, or `gemini.ts toUsage` is changed to the field Gemini sends.
- **Fixed 2026-11-09 (final integration) · Personalizer cap 2,500 tight:** default raised to 5,000 (`SELF_PERSONALIZER_MAX_OUTPUT_TOKENS`); the first replay's output count still confirms it.
- **P2 · A partial Oracle (one of three calls failed) is not stored and no cards are written.** The next build re-runs
  all three calls. Owner: reading-dev. Done: store the two good calls' areas under their own keys and re-run only the
  failed call, if replays show partials happen.
- **P2 · The Personalizer's per-sentence source rule is strict.** `sources` must align one-to-one with headline + body
  sentences; a model that cites per paragraph loses sentences. Owner: reading-dev. Done: the replay's drop rate per
  card under 10 %, or the rule relaxed to per paragraph.
- **P3 · Personalizer validator word lists are constants.** `CHART_TERMS`, `GENDERED_WORDS`, `MEDICAL_WORDS` in
  `src/reading/self/v2/personalizerValidate.ts`; the hero's live areas (`LIVE_AREAS`) too. AGENTS.md asks for
  configurable selections in `src/config/env.ts`. Owner: reading-dev. Done: env-backed lists with these defaults.
- **P3 · `readSelfV2Latest` serves the newest stored cards even past their window.** It does not check `valid_to`; the
  API lane should queue a rebuild when `builtAt` is older than the running sub-sub period. Owner: API lane. Done: the
  route compares and queues.
- **P3 · `docs/admin/07-technique-pieces-and-agents.md` regenerated on this branch** after the merge with 1b; a later
  catalogue change on develop needs it regenerated again (`npx tsx scripts/write-technique-pieces-doc.ts`).
- **Fixed 2026-11-09 (final integration) · fourteen unkeyed step-2 outputs:** the rows read concrete sections (a new `person` section for S10) and each output is keyed by its own refresh stamps; `layers.unkeyed` is empty and a rebuild with unchanged stamps writes nothing.
- **P3 · Only family.sky is padded to the 1,024-token cache minimum.** On a sparse chart (the unit fixture) family.varga,
  family.dasha and family.year prefixes come out at ≈ 880, 190 and 30 tokens, below the minimum, so their explicit regions
  are refused and the calls go uncached. Owner: reading-dev. Done: pad or merge the short family packs, measured on the
  two stored dossiers.
- **P3 · `tests/unit/reading/cacheRecycle45m.test.ts` "executes scheduled per-individual recycle…" timed out once
  (45 s) under a parallel run on 2026-11-09 and passed on the rerun.** Flaky under load. Owner: reading-dev. Done: the
  test uses fake timers end to end.

## Filed 2026-11-09 by the Self v2 final integration (branch feat/self-v2-integrate)

- **P1 · What still blocks a live staging run.** (1) The engine's `pressure_inventory` is not deployed: every pull
  answers 400, the board stays in degraded windows with a gap, and the loader retries once per kundli and clock per 24 h
  (`SELF_V2_PRESSURE_RETRY_HOURS`). (2) `SELF_V2_BUILD=1` and `SELF_V2_ENABLED=1` are not set on the API Lambda.
  (3) No paid replay has been made: the first one needs Sachin's yes (doc 66 §13, §4.9 has the estimates). (4) The
  shared Prisma client must be generated from the current schema before deploy (the `terms_version` item above). Owner:
  Sachin (yes), deploy sub-session. Done: a staging GET /api/self/v2 returns `ok` with twelve areas from a live build.
- **P2 · Pressure rows: `houses` is the engine's `houses_touched`, aspects included.** S5 takes a risk row's first house
  for "from where" and its people from all of them, and S7 calls a transit "over the lagna" when house 1 is touched, so on
  engine rows both now count aspected houses. The engine row has no separate "house it stands in" field for transits and
  stations, and Node may not count it from `sign_index`. Fact (code read). Owner: engine pass, then reading-dev. Done:
  the engine adds the placement house to transit and station rows and S5/S7 read it.
- **P3 · Two key namespaces for one period.** With the inventory, S3 rows carry the engine's `dasha:<system>/<level>/<lord>@<from>`
  ids while S2 periods keep `activation:<system>/...`; the Oracle may cite either for the same period. Owner: reading-dev.
  Done: one namespace (an alias table in the slice, or S2 reading the inventory's dasha rows).
- **P3 · Sub-techniques still all run before the store lookup.** `runSelfSubTechniques` computes all ten (≈ 80 ms on the
  research kundli) and only then are the outputs keyed; a rebuild with unchanged stamps writes nothing and calls no model,
  but the code layer is not skipped. Owner: reading-dev. Done: S1, S2 and S10 run first to make the stamps, and the other
  sub-techniques read their stored output on a key hit.
- **P3 · `hero.supporting` is derived, not cited.** The hero stores no per-sentence sources, so the API names the hero
  question's claim area plus the live areas (`LIVE_AREAS`) that have a card (`response.ts heroSupporting`). Owner:
  reading-dev. Done: the Personalizer schema carries hero sources and the API reads them.
- **P3 · Range words for standing-plus-live areas.** Mind, drive and chapters say "True until <main period end>" (e.g. 16
  Feb 2037 on the research kundli), which reads long. Owner: Sachin (words). Done: reviewed wording per horizon in
  `response.ts areaRange`.
- **P3 · Slice prefixes under 1,024 tokens on the research kundli.** `family.varga` 680, `family.year` 795, `family.sky`
  579 and `self.personalizer` 800 (doc 66 §4.9 table; e2e test output), so those regions are refused and the calls go
  uncached. Extends the agents lane's padding item above. Owner: reading-dev. Done: every warmed prefix ≥ 1,024 on the two
  stored dossiers.
- **P3 · `tests/unit/chartCatalogSync.test.ts` "logs a failed sync as a warning" failed once (8.3 s) in a parallel run
  and passed on the rerun.** Flaky under load, not caused by this branch. Owner: whoever next touches the catalog sync.
  Done: the test uses fake timers.
- **P3 · The `pressure_inventory` chart type row is created by the loader** (`chart_data_types`, served false) the first
  time a pull is attempted, because `kundli_data.data_type` has a foreign key and no migration was allowed. The catalog
  sync marks it served once the engine lists the type. Owner: none needed; noted for whoever reads the table.

## Filed 2026-11-09 by the Self v2 regression check (branch fix/self-v2-test-regressions)

Ten tests in seven files fail on `9595614` (the last commit before any Self v2 code) as well as on `c5f0c77`, alone and
inside the full suite alike; they are not Self v2 regressions and were left as they are. Likely shared cause for the
env-driven ones: `tests/setup.ts` runs `dotenv.config()`, so the worktree's local `.env` (rebuilt from the Lambda:
`ASTROKUNDLI_TRANSPORT`, `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_THINKING_*`, `READING_EXPLICIT_CACHE`, model ids) leaks into
tests that assume those vars are unset. Owner: whoever next touches tests/setup.ts (load `.env` only outside vitest, or
have these tests clear the vars they depend on).
- **P2 · `tests/unit/astroKundliExportSpacing.test.ts`, all four "keeps the (start) spacing ..." cases:**
  `expected ~250 to be greater than or equal to 1090`. Fails on 9595614 too.
- **P2 · `tests/unit/env.test.ts` > isAstroKundliConfigured > "returns false when base URL is empty for current env":**
  `expected true to be false` (lambda transport from `.env` wins over the empty base URL). Fails on 9595614 too.
- **P2 · `tests/unit/geminiChatService.test.ts` > "uses GEMINI_MAX_OUTPUT_TOKENS when set":** `expected undefined to be
  4096`. Fails on 9595614 too.
- **P2 · `tests/unit/reading/promptCache.test.ts` > "is off by default: no cache created, full prompt sent":** `expected
  [ { …(5) } ] to have a length of +0 but got 1` (`READING_EXPLICIT_CACHE` set in `.env`). Fails on 9595614 too.
- **P2 · `tests/unit/reading/run.test.ts` > "sends the thinking config in the request body ...":** expected
  `{ thinkingBudget: 2048, … }`, received `{ thinkingLevel: 'medium', … }`. Fails on 9595614 too.
- **P2 · `tests/unit/reading/clarify.test.ts` > "falls back to the rule question on error, junk, a long question or
  unsafe wording":** expected "Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at?", received
  "Shall I look until 7 Sep 2027, or a different stretch of time?". Fails on 9595614 too. Already fixed on develop by
  `c9db440` (clears the planner's in-memory clarify cache in `beforeEach`); not repeated on this branch.
- **P2 · `tests/unit/reading/annualPrashna.test.ts` > model planner > "a ruled-out question never reaches the model; bad
  model output keeps the rules":** `expected true to be false`. Fails on 9595614 too. Same clarify-cache cause, already
  fixed on develop by `c9db440`.

## Filed 2026-11-09 by the Self v2 release

- **P2 · Engine develop is not deployed: `pressure_inventory` waits for a release.** Correction 2026-11-09: the engine
  has a release path. `AIAstra_Radha/.github/workflows/deploy-lambda.yml` runs on a push to `release-candidate-staging`
  (or manual dispatch), builds the Dockerfile image to ECR `aiastra-pyjhora`, updates the Lambda and repoints the
  `previous` alias for rollback. Live image is `bc8dd2b` (7 Nov); engine develop `9a4fb5d` is 2 commits ahead and not on
  origin. Limits: Lambda timeout 60 s, 2048 MB, server `RADHA_MAX_CONCURRENT=4`. Owner: deploy session with Sachin's
  yes. Done: `9a4fb5d` pushed, merged into the engine's release branch, Lambda green, and one kundli's
  `kundli_data` `pressure_inventory` row stored by the server pull.

## Filed 2026-11-09 by the Self v2 live replay

Source: `docs/reading-engine/66-replay-2026-11-09-self-v2.md` (11 paid calls, $0.12, kundli `c584c0a3`, three synthetic
profiles). Owner: the next Self v2 agents/validator branch unless noted.
- **P1 · Personalizer truncates at the output cap when it thinks.** Profiles a and b hit `MAX_TOKENS` with output
  plus about 2.2 k thought tokens equal to 5,000 (`SELF_PERSONALIZER_MAX_OUTPUT_TOKENS`). The whole card document is
  lost. `src/reading/self/v2/personalizer.ts` passes `thinking: 'low'`. Done: thinking off (or cap about 8 k, or the
  cards split over two calls), and a replay of profiles a and b returns `STOP`.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** thinking `minimal`, cap 8,000, one retry at 12,000, a cut document never stored; the replay of a and b (needs a yes) is still to run.
- **P1 · The Personalizer validator drops a whole date when its label holds a chart term** ("Ketu detachment", "Mars
  sub-period"): 9 of 11 cards lost their dates (`personalizerValidate.ts`). Done: the label is redacted or rewritten and
  the date kept, with a test.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** the label becomes the area title and the date stays (only exact Oracle windows).
- **P1 · The Personalizer ignores the profile's facts:** a retired person aged 60 and over got "executive
  responsibility", "public pitches" and "workplace friction". Done: a prompt rule and example, plus a validator check
  for career words when `work.status` is retired or between_jobs.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** THE PERSON lists each fact and its bans; env role-words table drops the sentence; hero not naming the focus is flagged.
- **P2 · Sentence/source alignment drops most body sentences:** 21 sentences on 11 cards, bodies of 12–42 words.
  Done: a `{text, source}` sentence array in the schema, or lenient matching.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** `alignSources` reads per sentence, body-only, per paragraph or card-level; 0 drops on the replay.
- **P2 · `CHART_TERMS` misses "nodal axis", "sub-period", "karmic", "combinations", "annual cycle"; `MEDICAL_WORDS`
  misses "inflammatory", "digestive", "nervous system" and diet advice.** These reached profile c's cards.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** terms added; body card diet/medicine list `SELF_V2_BODY_ADVICE_WORDS`.
- **P2 · Date pairs are not checked.** The Oracle invented 1–7-day "relief" spans (2026-12-12..13, 12-13..15, 12-13..19)
  that pass `inStoredWindow` because each day lies inside the year span. The Personalizer paired an action start with a
  chapter end. Done: pair checks in both validators.
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** Oracle dates must be a stored span, actions start today or on an edge; card dates an Oracle window.
- **P2 · Double-prefixed evidence keys** `risk:risk:…` and `promise:promise:…` in the Oracle slice
  (`src/reading/self/v2/slices.ts`, `` b.k(`risk:${r.id}`) `` where `r.id` already starts `risk:`; the same for promise).
  **DONE 2026-11-09 (fix/self-v2-replay-findings):** `riskKey`/`promiseKey`, keys normalised on write, on the model's output and on read.
- **P2 · The Oracle costs 2.5× the §4.9 estimate.** 34.6 k provider tokens per call against 15.5 k by chars/4; 38.6 %
  cached. Done: the stable part of the suffix moves into the prefix, and the Lab uses `countTokens`.
  **PARTLY DONE 2026-11-09 (fix/self-v2-replay-findings):** the reading frame is in the cached prefix (≈ 85 % projected), the Lab estimates chars / 2.2; `countTokens` is not wired (filed below).
- **P3 · The Oracle reports 0 thinking tokens** on gemini-3.8-flash with thinking `low`; unverified whether
  `thoughtsTokenCount` is missing. Needs one tiny paid call with Sachin's yes.
- **P3 · An Oracle self-contradiction is not caught:** "Saturn's tenth aspect onto this Moon" against the pattern's
  (correct) third aspect from the 7th onto the 9th. Aspect claims are not checked against the digest.
  **PARTLY DONE 2026-11-09 (fix/self-v2-replay-findings):** the Oracle prompt now reads aspects only from the input's aspect fields; the validator check is filed below.
- **P3 · Sub-techniques take 9.1 s from this machine** (estimate 0.3 s). Check on the Lambda before acting.
  **PARTLY DONE 2026-11-09 (fix/self-v2-replay-findings):** Layer 0 in one parallel round, run logs awaited once; the database side is unmeasured offline.
- **P3 · The 14-word headline cap withholds In short** (18-word headline); give the schema a length hint.
- **P3 · Replay brief listed `19b210cd…` as a kundli.** It is the user id of `c584c0a3`, so doc 66 §13's "two stored
  dossiers" are one chart. Choose a second test kundli for the next replay.

## Filed 2026-11-09 by fix/self-v2-replay-findings

- **P2 · Re-run the replay for profiles a and b** (2 Personalizer calls, ≈ $0.012, needs Sachin's yes) and one
  Oracle replay to measure the cached share of the new prefix (target ≥ 70 %, projected ≈ 85 %) and the sub-technique
  wall time against the 1.5 s target. Not done: no paid call allowed on this branch.
- **P3 · Gemini `countTokens` is not in the client** (`src/reading/llm/gemini.ts`). The Lab estimates chars / 2.2. Done:
  a free `countTokens` call in the Lab only, never on a build's path.
- **P3 · An aspect claim cannot be checked against the input in Node** without counting houses (forbidden: Radha is the
  only source). Done: the engine exports each aspect with its count (3rd/7th/10th) per planet pair; then the Oracle
  validator flags an area that names an aspect absent from the evidence. Prompt rule added meanwhile.
- **P3 · The Oracle prefix now changes per build** (it carries the reading frame), so a region lives for one build and
  its storage is larger (≈ 29 k tokens instead of 13 k). Measure the storage cost per region-hour on the next replay.
- **P3 · "First card speaks to the focus" is only a prompt rule.** Cards are keyed by area and shown in the board's
  order; only the hero is checked (a gap, never a drop). Owner: the UI lane, if focus should reorder the cards.
- **P3 · One role word or diet word drops the whole ladder** (the four steps are one object). Done: drop only the step
  and show three, or ask the Personalizer to rewrite.

## Filed 2026-11-09 by the Self v2 live replay, run 2

Source: `docs/reading-engine/66-replay-2026-11-09-self-v2-run2.md`. The run made 11 paid calls costing $0.087, plus
about $0.002 of storage. It read kundli `c584c0a3` for three synthetic profiles. Owner: the next Self v2 validator or
prompt branch unless noted. The run 1 items "Re-run the replay for profiles a and b" and "Measure the storage cost per
region-hour" are **DONE** by this run: 3 of 3 Personalizers returned `STOP`, the Oracle was 89.7 % cached, and each
region costs about $1 per million tokens per hour.
- **P1 · A withheld card's stand-in headline skips the profile and redaction checks.** On profile c, the lagna stand-in
  showed "executive leadership and professional gravitas" to a retired person. That headline had just been dropped
  for the word "executive". Other stand-ins show redaction gaps: "A disciplined … calls for", "wealth … resolve".
  Done: the stand-in goes through `textProblem` with the profile's role words; it never contains "…"; it falls back
  to the area title. A test covers it (`personalizerValidate.ts`).
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** the stand-in passes `textProblem` with the profile, role, career-stage and body words, never carries "…" (redaction drops the sentence), else shows "Not enough in your chart to say this with confidence." (`standInHeadline`, test `run2Findings.test.ts`).
- **P1 · The cards are barely personalised.** Drive, chapters and body read nearly word for word the same for all
  three profiles. Profile a (25–35, founder) gets "seasoned professional", "experienced guide" and "mentorship and
  advisory leadership". Profile c (retired) gets "Maintain a crisp and formal style in all meetings" and "assertive
  labor to secure your assets". Done: prompt examples per age band and work status; role words "meetings", "labor"
  and "professional"; an age-band list for under 36; a flag when a card copies more than about 60 % of an Oracle
  paragraph.
  **DONE in code, not yet measured live (fix/self-v2-run2-findings):** band register and work-level examples in THE PERSON, focus as the Now-card lens, career-stage words gated by band and level (`SELF_V2_SENIOR_STAGE_*`), "meetings/labor/professional" role words, an Oracle-echo metric per build (flag over 0.6); golden distinctness max Jaccard 0.231 vs 0.586 on run 2.
- **P2 · Six of 33 cards withheld for headline length or chart terms.** Over 14 words: a stuck, a chapter, c lagna.
  Chart terms "yogas" and "annual cycle": a yogas, a year, c year. Done: shorten or redact the headline instead of
  withholding the card, add a schema `maxLength` hint, and add a prompt line naming "yoga" and "annual cycle".
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** a failing headline falls back to the first passing body sentence of ≤ 14 words, else the area title; the card is never withheld for its headline alone (all six run 2 cards now deliver on replay).
- **P2 · The hero question does not check its claim.** All three cite `stuck.heaviest_now:presses:ideas_and_children+…`
  but ask about "your business", "career and family life" or "health and spiritual practice". Done: the question
  names the claim's own plain-word areas, with a flag when it does not.
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** code builds the question frame from the S5 row (`heroClaimFrame`, draft on one matter); the validator drops a question that names none of its claim's matters or also names another (all three run 2 questions now drop; the API asks the missing fact).
- **P2 · Family readers are cut at the cap.** `family.dasha` ended with `MAX_TOKENS` (654 out + 1,342 thought against
  2,000). Its finding stopped mid-sentence, had no `VALID_UNTIL`, and went into the Oracle as it was. Done: a cut
  finding is dropped as a gap, and the readers' cap goes to about 3,000 or their thinking to `low`.
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** cap 4,000 (`SELF_FAMILY_MAX_OUTPUT_TOKENS`, v1 and v2); a `MAX_TOKENS` finding passes only complete sentences with a note (or nothing), is gapped and never cached.
- **P2 · The body card writes diet advice for every profile** ("meals" ×3, "dietary", "nervous system"). The drop
  then takes the whole ladder. "Nervous depletion" and "Nervous exhaustion is a source of friction until
  12 Dec 2026" pass. Done: a body-card prompt line, those two phrases added to `SELF_V2_BODY_ADVICE_WORDS`, and a drop
  of the step only (see the P3 filed by fix/self-v2-replay-findings).
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** ladder steps are checked one by one (the ladder stands with ≥ 2 steps); "nervous depletion/exhaustion" added; the prompt limits the body card to heat, dryness, heaviness, fluids, rest and pace.
- **P3 · Expired cache regions cannot be deleted.** `deleteOne` gets HTTP 403 for a region that has already expired.
  The row keeps `deleted_at = null`, so the sweeper retries it for ever. This test person has 15 such rows from
  earlier today, and each per-individual delete spends about 0.5 s on each one. Done: treat 403 or 404 on a row past
  `expires_at` as deleted (`src/reading/llm/promptCache.ts`).
  **DONE 2026-11-09 (fix/self-v2-run2-findings):** HTTP 403/404 on a region past `expires_at` marks the row deleted on every delete path (`goneOnDelete`, test `tests/unit/reading/llm/cacheSweepExpired403.test.ts`).
- **P3 · The sub-techniques still take 9.0 s** from this machine; the parallel Layer 0 gained nothing (9.1 s in run 1).
  Done: count the database round trips and time them on the Lambda before changing code.
  **PARTLY DONE (fix/self-v2-run2-findings):** every Layer 0 read is timed (`sub.load.*` in the build ms map) and the profile read moved into Layer 0; the database side still unmeasured: read `sub.load.*` on the next live run and on the Lambda.
- **P3 · The Oracle still reports 0 thought tokens** on gemini-3.8-flash at `low` (3 of 3 calls). This is unchanged
  from run 1 and needs one tiny paid call with a yes.

## Filed 2026-11-09: Self v2 pipeline gaps (review of the build flow, doc 66 §4.8)

- **P1 · "Right now" goes stale silently.** Offline-first means no rebuild until the person taps Fresh reading, but the
  hero's "since" and "eases" dates and the strip are relative to the build date, and the `sky_week` stamp never fires on
  its own. Owner: server + web. Done: the hero shows "as of <build date>"; when a stored window boundary has passed, the
  card says it has moved on and the Fresh reading button lights up.
- **P2 · Explicit cache regions mostly expire unused.** Regions live 45 min and storage bills per hour; an offline-first
  board rebuilds rarely, so the family-pack regions are paid for and almost never reused. Owner: server. Done: explicit
  caching only for the Oracle prefix shared by its three parallel calls; implicit caching elsewhere; storage cost per
  build in the Lab.
- **P2 · Shared sub-techniques are Self-only.** S1 clock, S2 periods, S3 windows, S4/S5 ledgers and S10 profile are the
  same for Love and Work. Owner: server. Done: board-neutral sub-techniques stored once per kundli and stamps, read by
  all three boards.
- **P2 · The free first build is a one-minute veil on first open.** Owner: server. Done: the trial build starts when the
  kundli's digest is ready after registration, so the first open serves a stored reading.
- **P2 · Confirm answers change nothing until a paid rebuild.** Owner: server. Done: a confirm re-runs only the
  Personalizer (≈ $0.006, ≈ 10 s) and the board updates; not charged as a question.
- **P2 · Degraded windows go unnoticed.** With `pressure_inventory` missing every window is equal strength and the hero
  ranks by end date only; nothing alerts. Owner: admin + server. Done: gap counts per build in the Lab and an alert when
  degraded builds pass a threshold.
- **P3 · No quality gate between build and screen.** Validators drop sentences but nothing scores the build. Owner:
  server. Done: a per-build quality score (withheld cards, dropped sentences, profile distinctness); a poor build keeps
  serving the last good reading and is flagged in the Lab.

## Filed 2026-11-09 by the Self v2 refresh button

- **P3 · A forced store write keeps the old `created_at`.** `insertStoredRow` upserts on `cache_key` without touching
  `created_at`, so a forced v1 refresh under an unchanged key leaves `made_at` (synthesisValidity) on the old day. The v2
  build sidesteps it with `|fresh=<day>` in its key. Done: set `created_at = now()` in the replace branch.
- **P3 · Two fresh v2 builds on the same day share one key** (`|fresh=<day>`) when the first one succeeded; the second
  overwrites the first row (forced) and keeps its `created_at`, so the page's `builtAt` does not move. Only reachable
  when a refresh is due again the same day (a reading whose `valid_until` is already past when made). A retry after a
  failed fresh build already gets its own key (`|fresh=<day>.r<hhmmss>`, fix/self-v2-single-build).
- **P2 · With `SELF_V2_BUILD=1` the old You page (`GET /api/self/reading`) queues a build on every open.** The self
  build no longer makes a v1 synthesis (fix/self-v2-single-build), so the v1 Oracle stays `pending` for a kundli with no
  stored v1 synthesis, and the route queues a build whenever the marker is not `building` or `failed_recently`. Each
  such build is cheap (code panels, then a v2 build that hits its store: no model call) but is a Lambda invocation per
  open. Owner: server + web. Done: under the flag the old page is retired, or the route serves the code panels with
  the v1 Oracle `off` and does not queue when today's marker is `ready`.
- **P2 · The full unit suite is red on develop without this branch** (10 of 2292 with the worktree's `.env`):
  `astroKundliExportSpacing` (4), `env.test` isAstroKundliConfigured, `geminiChatService` GEMINI_MAX_OUTPUT_TOKENS,
  `promptCache` "off by default", and `reading/run.test.ts`, which fails a different 1–3 tests on each run (also alone).
  `replayFindings` "sub-technique round trips" and `specialistFailures` fail only under full-suite load. Same set
  failing with this branch's changes stashed. Done: tests that read env vars stub them instead of inheriting `.env`;
  the timing test asserts call rounds, not wall time.

  **PARTLY DONE (fix/self-v2-run2-findings):** an absent `thoughtsTokenCount` is now recorded as not reported (`thoughtTokensReported: false`, null in the Lab); the run 2 record kept only the mapped 0, so whether 3.8-flash reports it at `low` still needs one tiny paid call with a yes.

## Filed 2026-11-09 by fix/self-v2-run2-findings

Owner: the next Self v2 branch unless noted.
- **P2 · Distinctness is measured on hand-written goldens only.** `run2Findings.test.ts` asserts the three profiles'
  cards share ≤ 25 % of their words (token Jaccard) on golden documents written to the new prompt (max 0.231; run 2's
  raw output: 0.586). Whether the model now writes like the goldens needs run 3 (paid, needs a yes); read the per-build
  `self.v2 personalizer metrics` log line (Oracle echo mean/max, flagged cards) there.
- **P2 · Saturn's aspect number cannot be checked (run 1 failure 9).** The digest's planet rows carry `aspectsTo`
  (houses) and `aspectedBy` (planets), and house rows `aspectedGraha` / `aspectedRasi`, but no aspect ordinal ("third",
  "tenth"). Checking "Saturn's tenth aspect onto the Moon" would need Node to derive the house offset, which the
  Radha-only rule forbids. Engine pass (owner: Radha lane): store the aspect number per `aspectedBy` entry; then the
  Oracle validator can check aspect claims by lookup.
- **P2 · The web shows an empty ladder step.** The validator now drops a failing ladder step and leaves it `''` (the
  ladder stands with ≥ 2 steps). `AreaCard.tsx` (AIAstra_WEB `pages/you/v2`) renders all four rows; it should skip an
  empty step. Owner: web lane.
  **DONE 2026-11-09 (web `feat/self-v2-illustration`):** `AreaCard` skips an empty step and draws no ladder when all are empty.
- **P2 · A withheld stand-in card reads as `ok` in the API.** `v2api/response.ts` `areaStatus` returns `ok` whenever a
  card object exists, and the validator stores a withheld card (stand-in headline, empty body). The status should come
  from `cardStatus`. Owner: the API lane (that file was off limits to this branch).
- **P3 · Headline fallback when no body sentence fits.** The brief asked for the withheld line; this branch uses the area
  title instead when the body passes (a confident body under "Not enough in your chart…" contradicts itself). One line in
  `validatePersonalDoc` to switch if Sachin prefers the withheld line.
- **P3 · The hero question check is strict.** A question that names a word of another life matter is dropped (run 2's c:
  "health and spiritual practice"); the words tables (`MATTER_PLAIN`, reviewed-by-Sachin header) decide. Watch run 3
  for over-dropping; the API then asks the missing fact.
- **P3 · Sub-technique load: what could not be confirmed offline.** The reads are one round each and `loadDigest` is
  already memoised (per kundli and built-at, `MEMO_MS`); the activation read takes only the primary and confirming
  clocks. What is slow on the live DB (digest row size, Render latency, the pressure pull) is unknown until a live run
  reads `sub.load.*`.
- **DECIDED · Personal facts reach the Personalizer on Gemini.** Sachin, 2026-11-09: send everything to the
  Personalizer on the paid Gemini key ("their job is very grand … if they get it wrong the dashboard doesn't click with
  the person"); data minimisation is not applied to the Personalizer; the Bedrock move later carries the same pack. The
  pack (`PersonPortrait`, `src/reading/self/v2/portrait.ts`) carries the wizard facts with dates, life events (category
  and date), monthly checks, confirm answers, the 30-day mood history and question topics (categories, never text), the
  body keys, the life labels' state, and, by Sachin's correction the same day, the **birth place** (city, region,
  country as typed) and the **current city and country**. It never carries the name, the exact birth date or time, or
  coordinates and time zone (age band only). Update the privacy policy words (docs/privacy/01) to say so.
- **P3 · The Personalizer now runs on the Oracle's model at `low`.** Estimated ≈ $0.022–0.029 per profile (doc 66 §4.9),
  about four times flash-lite; measure the thought tokens and the wall on the next live run (needs a yes).
- **P3 · Mood history starts empty.** `self.mood.history` (server-owned, 30 taps) is written from now on when `self.mood`
  is written; existing users have only today's tap, so the trend reads "unknown" until three taps exist.
- **P3 · The house-state engine (doc 46) is not in code** (only planned layers in `techniques/catalog.ts`); the portrait's
  life labels read S3 windows and S5 rows (`lifeNowSource: 'windows_and_risk'`). Switch when the engine lands.

## Filed 2026-11-09 by the Oracle failures + storyteller branch (server `feat/self-v2-oracle-failures-storyteller`, web `feat/self-v2-illustration`)

- **P1 · Apply migration `20261109120000_reading_validation_failures` and regenerate the Prisma client** on staging
  before the branch ships. Until the table and the client delegate exist, `recordValidationIssues` writes nothing (the
  delegate is reached structurally, never throws) and the admin loads `validation` list is empty; the build's repair,
  fallback and charge rule work without it. Owner: deploy sub-session.
- **P2 · The admin page does not draw the validator failures yet.** `GET /api/admin-lab/loads/:userId` now carries
  `validation[]` (per build: `oracleAreas` ok/repaired/failed, `repaired`, `failed`, counts, each finding's check,
  message, call and prompt hash). The admin web repo's Dashboard loads page needs a panel for it. Owner: admin lane.
- **P2 · Alarm on failed Oracle areas.** Every build logs one `self.v2 validation` JSON line per stage (`byCheck`,
  `failed`); no CloudWatch metric filter or alarm reads it yet. Owner: deploy sub-session.
- **P3 · `reading_validation_failures` has no retention.** A build writes 0–40 rows; add a 90-day delete to the
  scheduled sweep. Owner: any server lane.
- **P3 · A partial Oracle is reused for the day.** A partial Oracle with ≥ 8 good areas is stored under its key, so a
  later non-forced build with the same stamps reads it and does not repair again (by design: one repair per build; a
  fresh reading forces a new key). Revisit if staff see many stale areas on one day.
- **P3 · A stale card keeps its own dates.** The fallback card is the last good reading's, as stored; a date on it may
  have passed. The page marks it "From your last reading"; a later pass could drop past dates from stale cards.
- **P3 · "Area briefs" is still the catalogue title.** `techniques/catalog.ts` (`self.v2.oracle`: "Oracle over the
  ledgers and the area briefs") and the generated docs (`docs/admin/07`, `docs/techniques/03`) keep the old words; doc
  66 and the pipeline page now say "area work orders". Rename in the catalogue row and regenerate (catalogue rows were
  another lane's this round). Owner: catalogue lane.
- **P3 · `src/reading/prompts/generated.ts` will conflict on merge** with the Tithi Pravesha lane (both edit
  `oracle/self-areas-v2.md` and `personalizer/self.md`; this branch's additions are their own sections at the end).
  After the merge, run `npm run prompts:embed` and commit the regenerated file.
- **P3 · Storyteller cost not measured.** The illustration adds ≈ 600 output tokens per profile (estimate ≈ $0.002 at
  Flash prices); measure on the next live run (needs a yes).

## Filed 2026-11-09 by dasha levels 1–6 (server)

Branch `feat/dasha-levels-1-6` (docs/reading-engine/67). Owner of each item in brackets.

- **P1: The worker Lambda, its IAM and the API env var do not exist yet.** Until the deploy session creates
  `aiastra-dasha-deep-worker`, grants `lambda:InvokeFunction` on it to `aiastra-api-lambda-exec`, sets
  `DASHA_DEEP_WORKER_FUNCTION` on the API, and updates `deploy-api-lambda.yml` to roll both functions, focus is a no-op
  (logged once as `dasha_deep_no_worker_function`). The spec is in doc 67 §5.1. [deploy session, Sachin's typed yes]
  Done when a manual `dasha-deep-pull` invoke logs `dasha_deep_pull` with rows for each system.
- **P1: Migration M46 (`20261109120100_dasha_levels_m46`) is not applied.** It adds the
  `(kundli_id, level, from_date, to_date)` index and the `dasha.narayana.l3` and `dasha.deep` chart types. Without it,
  the worker's focus and marker writes hit the `kundli_data.data_type` foreign key. [server release] Done when
  `prisma migrate status` is clean on the release database.
- **P1: The levels backfill has not been run.** Every kundli still has two levels for every system except the six `.l3`
  ones. Run after the engine release and the server release:
  `npx tsx scripts/backfill-dasha-levels.ts --dry-run=false` (dry run first with `--limit 3`). Sachin approved updating
  all kundlis in chat on 2026-11-09. [deploy or ops session] Done when the after counts show level 3 rows for every
  system.
- **P2: The deep-pull contract is assumed, not read.** The engine lane `feat/dasha-levels-1-6` has no commits beyond
  `develop` yet (checked 2026-11-09). The server sends `params: { max_level, deep_from, deep_to }` to every `dasha.<name>`
  and assumes these things:
  - the answer is the R-6 tree with `levels`;
  - `levels: 3` still caps the tree at three levels with no deep window;
  - the `catalog` export lists `max_level` with `allowed` up to 6.

  The backfill's wet-run gate depends on that last point. [engine lane] Done when the engine's tests pin the three
  points, or the server is adjusted to what ships.
- **P2: Levels 5–6 are stored at date precision.** `kundli_activation.from_date` and `to_date` are `date`. A level-6
  period lasts about 2 hours, and many level-5 periods last under a day, so most of them start and end on the same date.
  `activationFor`'s `from_date < to AND to_date > from` then never matches them for a one-day query. Level 4 (the default,
  about 6.7 days) is not affected. Before `DASHA_DEEP_MAX_LEVEL` is raised above 4, store `start_jd` / `end_jd` (or
  timestamps) and query on them. [server] Done when a level-6 row is found for the hour it covers.
- **P2: Today, Lucky times and chat do not read the deep levels yet.** `activationFor({ maxLevel: 4 })` (or
  `shortMaxLevel: 4` around a date) returns them where they are stored. The calls and prompts were deliberately not
  changed:
  - `luckyTimes/wiring.ts runningDashaLordsOf` asks for `maxLevel: 2`;
  - `run.ts` and `prewarmReaders.ts` now get levels 1–3 by default.

  [board owners] Done when each surface states, in its plan, what level 4 adds, and its prompt change is reviewed.
- **P3: Narayana and Vimsottari base rows stay on the legacy wire types** (`narayana_dasa`, `vimsottari_dasa`), which
  take no params. Their three-level data comes from `dasha.vimsottari.l3` and the new `dasha.narayana.l3`. The `.l3`
  entries are now redundant with `levels: 3` on every base row. [server] Done when the base rows move to `dasha.<name>`
  wire types and the `.l3` entries are retired, in one migration.
- **P3: Boards cached before the backfill keep their old activation reads.** The backfill replaces `kundli_activation`
  only. `technique_outputs` and `area_builds` built from level-2-only systems are served until their next rebuild (the
  digest version or a boundary stamp). [server] Done when the backfill's runbook includes a digest-stale mark per kundli,
  if Sachin wants fresh boards at once.

## Filed 2026-11-09 by the engine dasha levels and Tithi Pravesha build (AIAstra_Radha develop 8e31dd5)

- **DECIDED · The Tithi Pravesha year lord is the weekday lord at the TP moment** (sunrise to sunrise;
  `year_lord_rule: "weekday_lord_at_tp"`), not the Tajaka year lord of the solar return. Sachin, 2026-11-09:
  "Yes, weekday lord". Engine develop 8e31dd5 already uses it; nothing to change.
- **DECISION for Sachin · Deeper dasha levels are derived by the engine's own split rule.** This pyjhora version gives two
  levels (Vimshottari three); levels 4–6 split each period the way its own lord's mahadasha splits in that system, the rule
  the export already used for level 3. Classical sookshma/prana/deha for Vimshottari (tested); the same proportional
  rule for every other system. Kalachakra stops at level 1 (pyjhora's antardasha rows are broken); sign dashas cap at 5
  if 6 is ever switched on (size). Done: confirmed per system family, or rules named for the systems that differ.
- **P3 · `annual.mudda` and `annual.patyayini` are still pyjhora's raw trees**, not bounded to their own
  `valid_from` / `valid_to`: Mudda starts before `valid_from` (pyjhora's balance); Patyayini starts on it and runs one
  average Gregorian year. Owner: engine. Done: both bounded to their solar year like the TP year dasha.
- **P3 · Some engine tests fail when run alone** because pyjhora's language lists are not set up before them; the ones
  touched by this build were fixed. Owner: engine. Done: a test fixture sets them up.
## Filed 2026-11-09 by the Self v2 stuck-board session (docs/loading-overlay/05)

- **P0 fixed on `fix/self-v2-build-clock`, not yet deployed:** the Self v2 build chose its clock with the v1 `resolveClock`
  while GET `/api/self/v2` used `resolveClockV2`. On `c584c0a3` (preferred `kaala`) the build stored `clock=kaala`, the page
  read `clock=dwisatpathi`, and every card stayed `pending` forever with no message. After deploy: one free rebuild of
  `c584c0a3`.
- ~~**P1:** GET did not queue a build when an Oracle row had no cards row.~~ Fixed 2026-11-09 on
  `feat/self-v2-build-progress` (no cards and no build today → queued).
- **P1:** no build progress or state reaches the web. The header shows "Fresh reading from …" during a first build, a
  rebuild and a stuck read alike. Plan in docs/loading-overlay/05 (marker stages, `build` object, veil bar, header chip).
- **P2:** clients cannot force a fresh Self reading before "Good until" (409 `not_due`), and there is no admin "rebuild
  this person's board" action. After technique changes the only path is a DB-side or script rebuild. Add an admin action
  (free, logged) in the admin app.
- ~~**P1:** Try again could not re-run a failed or stuck build.~~ Fixed 2026-11-09 on `feat/self-v2-build-progress`: GET
  `/api/self/v2` re-queues on `stuck`, on `failed` past the 30 min cooldown, and when there are no cards and no build today.
- **P2:** a build that finished `ready` today but left no cards for the page's clock is not re-run by GET (it would only
  repeat); the page shows ready with pending cards until tomorrow. Should surface as failed.
- **P2:** `LoadingVeil` shows planet and rashi names (Sun, Mesha…) as hover titles on its decorative tiles (`PIECES` in
  web `src/components/LoadingVeil.tsx`), against the no-planet-words rule for user-facing text.
- **P3:** the first "Reading your chart…" and "chart still being prepared" veils have no bar (no board yet to read
  `build` from); the 5 s bar delay restarts per veil.
- **P2 (2026-11-09, Self v2 Chart details):** the "Who you are · Chart details" sheet prints empty brackets where chart
  names were stripped ("Your chart rises in Pisces (), ... ruled by Jupiter ()"). The redaction removes the bracketed
  term and leaves the brackets. Seen on staging in Sachin's screenshot. Fix in the details redaction step.
- **P2 (2026-11-09, Self v2 layout):** at about 970 px wide the four-across cards are about 190 px and lines wrap after
  three or four words; the date list sits at the bottom of every card. Answered by the plan in
  `docs/reading-engine/68-self-board-v3-your-cards-your-months.md` (Phases A and B approved 2026-11-09; in progress on `feat/self-v3`).

## Filed 2026-11-09 by the dasha-deep worker go-live

Branch `fix/dasha-deep-global-cap` (docs/reading-engine/67 §5.2). Owner of each item in brackets.

- **P1 · The account's Lambda concurrency limit is 10.** Lambda keeps 10 unreserved, so `aiastra-dasha-deep-worker`
  runs without reserved concurrency and shares one pool with `aiastra-server-api`, the chart worker and the sweep.
  The database cap `DASHA_DEEP_GLOBAL_MAX` (default 1) keeps deep pulls to one at a time. Request an increase in
  Service Quotas ("Concurrent executions", us-east-1, account 442728149528). [Sachin] Done when the quota is raised
  and the worker has a reserved concurrency of 1–2.
- **P2 · The worker Lambda is not in Terraform.** `aiastra-dasha-deep-worker` was created with the CLI. Add the
  `lambda_dasha_deep_worker` module and import it (doc 67 §5.1), with no reserved concurrency until the quota is
  raised. [deploy session] Done when `terraform plan` shows no change for the function.
- **P2 · The first real worker invocation is not yet confirmed.** It needs a signed-in board open on staging, then a
  `dasha_deep_focus_invoked` log on the API and a `dasha_deep_pull` (or `dasha_deep_queued`) log on the worker.
  [deploy session] Done when both logs are seen for one kundli and its level-4 rows are in `kundli_activation`.

## Filed 2026-11-09 by the Self v3 build (branch `feat/self-v3`, docs/reading-engine/68 Phases A and B)

- **P2 · Phase B replay: confirm the two fixes live.** The first replay (2 builds, $0.17,
  `docs/reading-engine/68-replay-2026-11-09-self-v3.md`) kept 4 and 9 of 11 cards. The Personalizer repair call and the
  evidence-key aliases that answer it are unit-tested only. One more live build, about $0.10, needs Sachin's yes.
  Done when a live build keeps all eleven cards.
- **P2 · With `SELF_V3_BUILD=1` a build pays for v2 and v3.** The v3 step runs after a v2 build that served the page,
  over the same context and natal prefix, so the Oracle and Personalizer run twice. GET /api/self/v3 still queues and
  reads progress through the v2 store and marker. Cutover step: when v3 is the default, drop the v2 Oracle and
  Personalizer steps from the build and key GET's queue logic on the v3 row. Done when one build calls one Oracle set.
- **P2 · The other clocks' tones are stored-only.** The year frame reads `pressure_inventory` for the confirming and
  applicable clocks only when a row is already stored; it never pulls at build time (the account's Lambda concurrency
  is 10). Most charts will show agreement from the reading clock and the year chart only. Pull them in the background
  (the deep-level worker or the digest), one at a time. Done when a fresh kundli has rows for each confirming clock.
- **P2 · Build time and the progress bar.** The v3 step adds an estimated 30 to 60 s in the same invocation after v2,
  and `BUILD_STAGES` has no v3 stage, so the bar sits at its last v2 stage. Check the build Lambda's timeout and add a
  stage. Done when a timed staging build stays under the timeout and the bar moves during v3.
- **P3 · A section change re-runs the whole v3 step.** The store key carries the sections hash, so switching the ladder
  on re-runs the Oracle too. Split the key: Oracle by frame and prefix, Personalizer by profile and sections.
- **P3 · "Suggested for you" is the registry's fixed eight.** The `suggest` seam (from what presses now and the
  person's stated focus) is not built. Done when the suggested set follows the strongest pressure rows' matters.
- **P3 · A unit test reached the real model-cache endpoint.** The first v3 step test called the real
  `ensurePromptCache` through `warmPrefixes` (no fake passed). It failed with "model not found", so nothing was
  created or charged. The test now passes a fake. Consider a vitest setup that blocks outbound network.
- **Not deployed:** migration `20261109180000_board_layout_m47` is not applied anywhere, and `SELF_V3_ENABLED` and
  `SELF_V3_BUILD` are not set on any Lambda. Goes through the deploy session with Sachin's yes.
- **P2 · Web v3 board not looked at in a browser.** Branch `feat/self-v3` in AIAstra_WEB (f1cfc31) passes typecheck and
  637 unit tests but has not been opened at iPad, phone or Duo size. Check that a card does not scroll inside at tablet
  width with the default sections, and that the 40 px peek shows. [web] Done with screenshots at 1180, 768 and 375 px.
- **P3 · Web v3 gaps.** Duo draws two cards across rather than splitting at the hinge (Template 3 not built); chip
  edit mode has no Cancel (press Edit again to back out); a v2-filled card shows the same body for every period.
- **P3 · Web lint baseline.** `eslint .` in AIAstra_WEB reports 28 errors in files the v3 work did not touch (for
  example `no-explicit-any` in `SelfBoardV2.test.tsx`, `YouPage.test.tsx`, `SelfReading.test.tsx`).
- **P2 · Staging registries seeded from this branch.** Running `npx tsx scripts/write-techniques-doc.ts` in the
  worktree, with the server `.env` copied in, seeded `technique_registry` and `agent_registry` on the Render staging
  database (54 agents, 136 techniques). It upserts, so the only new rows are `self.v3.cards` and `self.oracle.v3`; the
  Admin catalogue shows them before the branch is deployed. Nothing was deleted. The copied `.env` was removed from
  the worktree. Either leave them (they arrive with the deploy) or delete the two rows. [Sachin] Done when decided.
- **P3 · The doc script writes to whatever `DATABASE_URL` is set.** `scripts/write-techniques-doc.ts` seeds the
  registries whenever `DATABASE_URL` is present, so regenerating a doc in a worktree with a copied `.env` writes to
  staging. Make the seed opt-in (`--seed`). Done when the doc regenerates without touching a database by default.

## Filed 2026-11-09 by doc 70 (five clocks, a reading per card; branch `feat/self-v3`)

- **P1 · open · The Phase 3 replay ran at $0.704, not $0.41, and the first card took 106 s.** Report:
  `docs/reading-engine/70-phase3-replay-2026-11-10.md`. 50 calls; clock layer $0.155, cards $0.549 ($0.026 each, plan
  $0.013). The clock layer (readers then a 44 s concordance) blocks every card. Fix: store the ledger per kundli and day
  so only the first open pays; let the board cards show before the layer finishes; shrink the concordance input. Keep
  `CARDS_READ_REST` off until then. Owner: this branch. Done: first card under 40 s on a warm ledger; all 21 cards under
  $0.50. **Update 2026-11-10, partial (code in, not measured):** clock layer cached per kundli and day (`kundli_slices`
  row `layer.clock`, a no-op until M48 is applied), cards start on the counted ledger with the concordance beside them,
  concordance input and output trimmed, readers and cards read rows cut to the frame, a pre-check replaces the two
  repairs (commits `e24a4d4`..`27d0e43`). Expected from the replay's own calls: first card ≈ 60 s cold, ≈ 31 s warm;
  all 21 cards $0.49–0.56. Report: "Fixes made" in `docs/reading-engine/70-phase3-replay-2026-11-10.md`. Stays open
  until the next paid replay (command there, `--warm`) measures it.
- **P1 · open · The new agents are not in the staging `agents` table.** The replay's `agent_runs` writes hit
  `agent_runs_agent_fkey` for `reading.clock`, `reading.concordance` and the card agents. Runs on staging will not be
  logged until the registry rows exist (migration or seed, same way as earlier agents). Owner: this branch. Done: a run
  of the replay with storage on writes its `agent_runs` rows. **Update 2026-11-10, partial:** cause found: the rows come
  from the idempotent seed (`seedAgentRegistry`, no migration inserts agent rows) and the four agents are defined, but
  the replay's storage-dry proxy swallowed the seed's raw SQL. Now a run that hits the FK re-seeds and writes once more,
  and the replay seeds with the plain client first (`da11df5`, unit-tested with fakes). No migration written or applied.
  Stays open until a replay or a staging run shows the rows written.
- **P2 · open · Ledger still 28 of 36 confirmed after the heavy-tone stopgap.** Check whether the clocks truly agree or
  share the engine's per-planet flags; see `docs/reading-engine/70-heavy-clocks-2026-11-10.md`. Done: the count on a
  second kundli, and Sachin's decision on the word "confirmed" before a face shows it. **2026-11-10:** not touched by
  the speed and cost fixes (the count rules are unchanged); still open.
- **P2 · open · Cold cards read the ledger without the concordance's words.** Since `eee5b32` the cards start on the
  counted ledger (status, tone, agree/of, keys) while the concordance writes; only a warm open gives them the words.
  Grounding is unchanged; whether cold cards read worse is not measured. Done: the next replay's cold and `--warm`
  cards compared side by side.
- **P3 · open · The concordance's cost reaches the day's spend after the cards.** With the words in the background the
  card queue checks the cap without the concordance (about $0.015 by estimate); it is added to the state doc when it
  returns. Done: accepted, or the queue reserves it before the first card.
- **P3 · open · More cuts if the replay lands above $0.50.** (a) The card role prompt (≈ 1.6 k tokens per card) could
  move into the cached system prompt shared by every reading agent: ≈ 21 × 1.6 k × ($0.75 − $0.075)/M ≈ $0.023;
  needs a prompt-architecture decision (readers would see the card role text). (b) A repair of only the failing spans
  saves only output (≈ 700 tokens ≈ $0.003 a repair), so it was not built. (c) The cold board's critical path is the
  slowest reader (Yogini, 29.5 s, 4,387 out); only a shorter reader output moves it.
- **P3 · open · The `ledger` reading stage is never set.** The web shows "Checking where they agree" for it; the build
  goes `clocks` → `cards` → `done` (before and after the 2026-11-10 fixes). Done: dropped from the type and the web, or
  set while the concordance runs on a non-card build.
- **P3 · open · Card Oracle cited evidence outside the frame.** `chapter` cited a row from before the frame; `mind` cited
  no ledger cell in three spans; `yogas` and `learning` had a confirm dropped (dates outside the frame). All repaired or
  dropped by the validators; prompt wording could stop it. Two clock sheets (Yogini, Tithi Pravesha year) were partial
  on tones the cited rows did not allow. **Update 2026-11-10, partial:** the card reads only rows overlapping the frame
  and may cite only keys it was given; `precheckCard` drops a key it was never given (the `chapter` case) and adds the
  ledger cell a span's cited row rests on (the `mind` case) before any repair call (`e55c9e2`, unit-tested). The confirm
  dates and the partial clock sheets are not addressed. Stays open until a replay shows no repair from these causes.

- **P1 · open · Only one clock was ever read.** Plan: `docs/reading-engine/70-five-clocks-and-card-by-card-readings.md`.
  Phase 1 code is in (2026-11-10): `resolveReadingClocks()` (`src/reading/self/clock.ts`, env `READING_CLOCK_ORDER`,
  `READING_CLOCKS`, `READING_CLOCKS_MIN`), the v3 step reads that set, `ensurePressureInventories()`
  (`src/reading/self/sub/pressure.ts`) runs from the sync worker after a complete sync; unit tests in
  `tests/unit/reading/self/v3/clockSet.test.ts`. On the test kundli the set is Vimshottari, Narayana, the year,
  Dwisaptati Sama, Yogini, but only Dwisaptati is stored: the three other pulls failed locally (no AWS credentials may
  invoke the engine Lambda from this machine). Report: `docs/reading-engine/70-phase1-clock-rows-2026-11-10.md`. Owner:
  this branch. Done: the three rows pulled on staging and the frame lists five clocks. **Update 2026-11-10 19:35 UTC:**
  met on a second test kundli, 75b0d618, on deployed staging (`37a5209`): the sync worker pulled Vimshottari,
  Narayana, Chathuraaseethi Sama and Yogini, and the frame lists five clocks with a tone per span. Stays open until
  c584c0a3 has its rows too (blocked until 2026-11-11 12:44 UTC) and Chara has been pulled once.
- **P1 · open · Every clock reads heavy nearly always, so agreement on heavy says little.** On 75b0d618, 81% of period
  rows are `presses` (302 of 375 across four clocks); Vimshottari and Yogini are heavy in all five frame spans, the
  year in four. Three clocks agreeing is then the normal case and the ledger's "confirmed" (doc 70 Phase 2,
  `statusOf`) would not mean what it says. Two things to check: the engine's polarity rule (harness, engine lane), and
  the server's row-to-tone step (does one pressing row make a span heavy regardless of strength?). Owner: this branch
  with the engine lane. Done: the share of heavy spans per clock measured on the four test kundlis, and a written rule
  for tone that weighs strength. Must close before the ledger is shown to a user. **Update 2026-11-10, cause found**
  (`docs/reading-engine/70-heavy-clocks-2026-11-10.md`): the engine sets a dasha or annual row to `presses` when any
  one of six bad flags in its `reasons` list is on and `functional_benefic` is not (fits 884 of 884 dasha rows, 565 of
  565 annual rows). Most flags belong to the planet (functional malefic, kashta over ishta, in dusthana), so 7 of 9
  planets press on every row they rule; 20 of 26 kundli-planet pairs carry a bad flag, 2 of 26 are benefic. The server
  copies the tone correctly. Strength is 1 on 87% of presses and all supports, so it cannot split them. Under today's
  rule 3+ of 4 clocks are heavy on 88% (75b0d618) and 77% (de5a2275) of days; requiring 3+ bad flags gives 10-30%
  heavy days and 0-3% three-clock agreement. Next: the engine owner grades polarity (presses needs 2+ independent bad
  flags; one flag gives mixed; parent-relative flags tilt, not set) and gives dasha rows a real strength. Stopgap
  (count stored flags in the server, heavy at 3+) waits on Sachin's yes. **Update 2026-11-10 (doc 70 Phase 3):** the
  stopgap is built (see the two entries below); this entry stays open until the engine grades polarity.
- **P1 · open · Engine: grade dasha and annual polarity instead of OR-ing six flags (engine owner).** Today
  `lord_quality` (`AIAstra_Radha` `pressure_inventory_export.py:303-321`) returns `presses` when any one of
  functional_malefic, shadbala_ratio_below_0.8, in_dusthana, kashta_over_ishta is on, and the dasha/annual rows add
  `2_12_from_parent` / `6_8_from_parent` (`:378-393`, `:603-613`). Asked: presses needs 2+ independent bad flags and no
  good flag; a single bad flag gives mixed; a good flag with no bad flag gives supports; the two parent-relative flags
  tilt a row from the planet's baseline and never set it; give dasha rows a real strength (87% of presses are 1 today);
  make functional_benefic reachable (2 of 26 planets). Evidence: `docs/reading-engine/70-heavy-clocks-2026-11-10.md`.
  Owner: engine lane. Done: the engine's rows carry graded polarity and the server stopgap below is switched off
  (`PRESSES_MIN_BAD_FLAGS=1`) and removed.
- **P1 · open · Server stopgap for the heavy tone, awaiting Sachin's confirmation.** Built 2026-11-10 on
  `feat/self-v3`: the engine's stored `reasons` now reach `PressureRowDetail.reasons` (`toPressureInventory`), and one
  pure selection, `gradeRow` (`src/reading/self/sub/rowTone.ts`), turns a stored row into a tone for the year frame
  (`v3/yearFrame.ts`: spans, clocks per span, year rows, merge) and the slices (`slices/render.ts` `rowLine` writes
  `tone=` beside the engine's `polarity=` and `flags=`; the clock reader validator checks against `tone=`). Rule: a
  dasha or annual `presses` row is heavy only with >= `PRESSES_MIN_BAD_FLAGS` (default 3) of `PRESSES_BAD_FLAGS` in its
  stored `reasons`, else mixed; supports stays light; transits and rows without a stored list keep the engine's word.
  It counts a stored list and computes no astrology, but it reshapes the engine's verdict against the rule that the
  engine alone gives astrological data. Owner: Sachin (yes or no). Done: Sachin confirms, or sets
  `PRESSES_MIN_BAD_FLAGS=1` (the engine's own tone) until the engine change above ships. Tests:
  `tests/unit/reading/self/v3/heavyTone.test.ts`.
- **P1 · open · The v3 frame tone is the spine's tone even when it stands alone.** On 75b0d618 span s2 (2027-01-25 to
  2027-04-24) is shown light on 1 of 5 clocks, s4 mixed on 1 of 5. The Phase 2 count makes both confirmed heavy, but
  it is not wired. Fix: Phase 3 wiring, or until then do not show a frame tone that fewer than `READING_CLOCKS_MIN`
  clocks hold. Owner: doc 70 Phase 3. Done: a test with one clock against four. **Fixed 2026-11-10 (doc 70 Phase 3):**
  a span's tone is now the tone `READING_CLOCKS_MIN` clocks hold (`heldTone`); none held → `held: false`, tone
  `mixed`, no tone word on the rail; the spine's own tone is kept as `spineTone`. Test: one clock light against four
  heavy (`heavyTone.test.ts`). Delete this entry when the branch merges.
- **P3 · open · Frame spans run past the Tithi Pravesha year the frame names.** On 75b0d618 the year is 2026-09-12 to
  2027-09-01 and spans s4, s5 reach 2028-01-18; their year tone comes from the next year's rows but the frame's
  `year` field names one year only. Done: the frame names every year its spans touch. **Fixed 2026-11-10:**
  `YearFrameV3.years` lists every level-1 annual row the spans touch and the Oracle suffix prints a `YEARS:` line.
  Delete this entry when the branch merges.
- **P1 · open · The Tithi Pravesha year rows must be checked before they count as a clock.** Checked 2026-11-10 on the
  test kundli's Dwisaptati inventory: the 7 `annual:TP<year>` rows run 353 to 384 days and all 54 year sub-period rows
  fall inside their year, so the pressure rows do not show the 108-year problem. The separate
  `annual.tithi_pravesha_dasha` row still does (the build reports "TP2026 year dasha is a lifetime dasha"), so the P0
  above stays open. Done: the same check on a second kundli and on every clock's inventory once pulled. **Update
  2026-11-10:** done for the pressure rows: on 75b0d618 all four inventories carry the same 7 year rows (354 to 384
  days) and 56 sub-period rows, none outside its year. This entry can close; the P0 on the year-dasha row stays.
- **P3 · open · The failed `pressure_inventory` row for `system=kaala` on staging.** Its error column reads
  `validation_error: Invalid export type: pressure_inventory`, written 2026-11-10 00:38 UTC, before the engine that serves
  the export went live (the Dwisaptati row was pulled at 05:03 UTC, calc version 2). Kaala is no longer selectable for
  that kundli, so nothing asks for it again. No engine fix needed. Done: the row is replaced if kaala is ever pulled.
- **P1 · open · A pull that fails on the caller's side blocks that clock for 24 h.** `loadPressureInventory`
  (`src/reading/self/sub/pressure.ts`) stores every failure as a `failed` row with `fetch_started_at`, and no build or sync
  pulls that clock again for `SELF_V2_PRESSURE_RETRY_HOURS` (24). On 2026-11-10 12:44 UTC the doc 70 check run from a
  laptop without AWS credentials wrote `failed` rows for Vimshottari, Narayana and Yogini on kundli c584c0a3 (test data),
  so those three are not pulled on staging until 2026-11-11 12:44 UTC. Fix: do not store failures that are not the
  engine's answer (credentials, network, timeout), or retry those after minutes; and give staff a re-pull that skips
  the wait. Owner: this branch. Done: a test that a credentials error leaves no blocking row. **Fixed 2026-11-10 (doc
  70 Phase 3):** `isEngineAnswer` (`sub/pressure.ts`) stores a `failed` row only for the engine's own refusal (an
  HTTP error status other than 401/403/407/408/429, a validation error, a payload of the wrong shape); credentials,
  network and timeout failures store nothing (test in `tests/unit/reading/self/v2/pressure.test.ts`). The staff
  re-pull that skips the wait is not built (still open: delete the three `failed` rows on c584c0a3 by hand or wait
  until 2026-11-11 12:44 UTC). Delete this entry when the branch merges.
- **P2 · open · The sync sweep never pulls inventories for kundlis whose chart is already complete.** The sweep
  (`findIncompleteKundlis`) only picks kundlis with a missing registration row, and the new pull runs only after a sync
  run. A kundli synced before 2026-11-10, or one whose inventory went stale after 7 days, gets its clocks only when a
  build pulls them (15 s each, in the build). Fix: a sweep step that picks kundlis with a missing or stale clock-set
  inventory. Owner: this branch or doc 70 Phase 2. Done: a test kundli with complete charts gets its four rows from the
  sweep. **Built 2026-11-10 (doc 70 Phase 3):** `findKundlisMissingClocks` + `runClockSetPull`
  (`src/services/kundliSyncWorker.ts`) run after the incomplete-kundli pass: digest-ready kundlis with fewer settled
  inventories (ready and fresh, or failed within the retry wait) than `READING_CLOCKS - 1`. Unit-tested with fakes;
  not run against a database yet. Side effect to watch: a kundli whose chart has fewer clock systems than that number
  is picked on every sweep (the pulls then return at once, but it takes a batch slot). Done: one staging sweep log
  (`clocks_pulled`) and the test kundli's rows.
- **P2 · open · At first sync the clock set may miss the conditional clock.** The set is read from `kundli_activation`
  and `dasha.applicable`; at the first sync these may not be stored yet, so the set falls back to the non-conditional
  systems and the spine (Vimshottari by default). The conditional clock's inventory is then pulled only by the first
  build. Done: the sync pulls the set again after the digest lands, or the digest worker calls
  `ensurePressureInventories`.
- **P3 · open · Questions for the engine harness from the 2026-11-10 rows.** (a) No Dwisaptati period row has polarity
  `supports` (46 presses, 6 mixed): check whether a dasha row can be `supports` at all. (b) No `sade_sati` or `station`
  row in the 2023-11 to 2029-11 window for c584c0a3. (c) Sign-dasha rows (Narayana, Chara) not checked yet. (d) The
  inventory is 82.5 KB as JSON, not 21 KB as doc 70 says (21 KB is likely the compressed size). Owner: engine lane, doc
  70 step 2. **Update 2026-11-10 (75b0d618):** (a) answered: period rows can be `supports` (34 of 375). (c) Narayana
  checked: 107 period rows, all with houses and polarity; Chara still not pulled. (b) also no `sade_sati` or `station`
  row on the second kundli, in any of four inventories: still to check. (d) four inventories are 422 KB of JSON for one
  kundli (73 to 155 KB each; Yogini largest), and 102 rows are repeated in each; doc 70's size estimates need redoing.
- **P2 · open · Each `pressure_inventory` call recomputes the clock-independent rows.** Five clocks is five sky scans
  and five sets of year charts. Engine pass E1 in doc 70 §6: accept a list of systems and compute the shared rows once.
- **P2 · open · No weighted order of dasha systems from the engine.** The clock set's order is a server list
  (`src/config/env.ts:834-835`). Which clocks carry most weight for a birth is astrology; engine pass E2 in doc 70 §6.
- **P3 · open · Doc 68 §4.9 and doc 69 §4.1 are superseded by doc 70** (budget; one call per board). The two docs still
  carry the old text.
- **P1 · open · Doc 70 Phase 2 wiring: built 2026-11-10, not run live.** The sync worker now writes slices after
  `ensurePressureInventories` (`writeSlicesAtSync`, `src/reading/slices/prepare.ts`), the v3 step reads stored slices
  and writes back only changed ones (`prepareSlices`), and `runClockLayer` runs from the v3 step when
  `READING_CLOCK_LAYER=1` (`src/reading/self/v3/build.ts`); tests in `tests/unit/reading/self/v3/clockWiring.test.ts`.
  Still open: migration m48 is not applied and `prisma generate` was not run for it in the worktree (the store reads
  the delegate through a loose type and reports `no kundli_slices store` until then); prep time on real rows not
  measured. Done: the migration applied with the deploy, slices on the test kundli, two syncs give the same hashes.
  Older text follows.
- **P1 · open · Doc 70 Phase 2 (slices, clock readers, ledger) is built behind `READING_CLOCK_LAYER=1` and not wired.**
  Code: `src/reading/slices/` (renderers, `writeSlices`, `readSlices`), `src/reading/clocks/` (`readClocks`,
  `countConcordance`, `runConcordance`, `runClockLayer`); migration `20261110100000_kundli_slices_m48` (table
  `kundli_slices`) is written, not applied, and `prisma generate` has not been run for it (the store reads the delegate
  through a loose type, so it works once the client has it). Nothing renders or writes slices yet: the sync worker
  after `ensurePressureInventories` should call `renderSliceSet` + `writeSlices`, and the build should read slices
  (doc 70 step 3 "build reads slices"; prep under 1 s not measured on real rows). Owner: doc 70 Phase 3. Done: slices
  written at sync for the test kundli, two runs give the same hashes, and `runClockLayer` called from the event.
- **P2 · open · The frame slice does not carry each clock's rows per span (doc 70 §4.1 table says it does).** The frame
  slice sits in every reader's cached prefix; listing each clock's rows there would let a reader see the other clocks,
  against doc 70 §9. Each clock's rows per span are in its own `clock.<system>` slice (BY SPAN index) instead. Decision
  for Sachin to confirm; the doc table needs the same change. Owner: doc 70.
- **P2 · open · Count edge cases decided in code, for Sachin's review** (`src/reading/clocks/concordance.ts` header):
  3 heavy + 1 light is confirmed (with `opposed=1`, not contested); 3 heavy + 3 light is contested; 2 heavy + 1 mixed is
  leaning (mixed opposes nothing); 2 heavy + 2 mixed and heavy + mixed are `single` (nothing agreed, nothing stated).
  Done: Sachin confirms or changes the rules; tests in `tests/unit/reading/clocks/concordance.test.ts` follow.
- **P2 · open · The clock-layer agents have no `SUBAGENT_DIGEST_SPECS` / `subagentCachePlan` entry of their own.**
  `reading.clock` and `reading.concordance` use one prefix (the common system prompt + natal.core, sky.window, year.tp,
  frame) warmed by `warmPrefixes`; the cache plan falls back to the generic plan for `reading.clock.sheet` and
  `reading.concordance`, which does not describe this prefix. Owner: doc 70 Phase 3, when the layer is wired. Done: a
  plan branch naming the shared slices, and the Lab shows cached vs total tokens for the five readers.
- **P3 · open · Clock-layer prompts never run against a model.** `prompts/common/reader-system.md`,
  `prompts/clock/reader.md`, `prompts/concordance.md` are tested only with a fake model. Word limits (cell 25 words,
  ledger 30) and the "rows of two polarities allow only mixed" tone rule may drop many cells live. Done: the doc 70
  Phase 2 replay (one kundli, needs Sachin's yes on key, count and cost) reports drop rates per check.

## Filed 2026-11-10 by doc 70 Phase 3 (a reading per card; branch `feat/self-v3`)

Report: `docs/reading-engine/70-phase3-2026-11-10.md`. Everything below is built behind `SELF_V3_BUILD=1` and
`READING_CLOCK_LAYER=1` (both off by default) and tested with a fake model only.

- **P1 · open · No real model run of the per-card reading.** The card Oracle prompt (`prompts/cards/oracle.md`), the 21
  briefs (`prompts/cards/self/*.md`) and the ledger checks (`checkAgainstLedger`: a span must cite one of its ledger
  cells; `build` needs a confirmed or leaning light or mixed cell) have never met a model; the ledger rules may drop
  many cards live. Done: the doc 70 §8 Phase 3 test (`scripts/cards-replay.ts --yes-spend`, Sachin's yes on key, count
  and cost) reports drop rates per check.
- **P2 · open · Minimum board: saving still needs 3 cards; the reading starts at `CARDS_READ_MIN` (5).** Doc 70 §10
  decision 2 (minimum board of five) is Sachin's; until then a 3- or 4-card board saves and reads nothing, and the web
  shows "Add at least five cards to start your reading." Done: Sachin decides; `MIN_CARDS` follows.
- **P2 · open · The v2 Oracle still runs before the per-card reading (doc 70 §4.1 trigger item 5 not built).** The cards
  are read inside the v3 step, after a v2 build that served; the v2 calls are cached per day in `technique_outputs`, so a
  second build the same day costs nothing for v2, but the first build of a day pays v2 too. A layout save re-queues the
  whole build (v1 code panels, v2 from cache, v3) to reach the cards. Done: a dedicated `self.cards` event that builds
  only what the cards need, and v2's model calls skipped while the per-card reading is on.
- **P2 · open · The per-card state doc is read-modify-write across processes.** `src/reading/cards/state.ts` serialises
  writes inside one process; the API Lambda (layout save, POST) and the build invocation can still overwrite each
  other's entry for a card in the same second. The runner re-reads the doc before every write and drains newly queued
  cards at the end, so the usual loss is a `queued` mark that the next build picks up. Done: entries in their own rows
  (one `area_builds` row per card) or a JSON merge in SQL.
- **P2 · open · Card agents have no cache plan entry.** `self.card.oracle` reuses the clock layer's warmed region (same
  system prompt and prefix), but neither it nor `self.card.personalizer` is in `SUBAGENT_DIGEST_SPECS` /
  `subagentCachePlan`; the card Personalizer's prefix (one Oracle card) is under 1,024 tokens, so it is never cached.
  Joins the clock-layer cache-plan entry above. Done: plan rows and the Lab showing cached vs total per card agent.
- **P3 · open · Web: doc 70 §4.3 items 3 and 5 not built.** The first ready card is not auto-selected, and the `+`
  picker does not mark cards ready or "about 15 seconds". Owner: web lane (`AIAstra_WEB` `src/pages/you/v3/`).
- **P3 · open · `tests/unit/reading/specialistFailures.test.ts` "a time-out on a cached call is not retried uncached"
  is flaky under full-suite load.** On 2026-11-10 it failed once in `npx vitest run` (2585 of 2586 passed; "expected []
  to have a length of 1") and passed alone (18 of 18). Not touched by doc 70 (no change under `src/reading/llm`). Likely a
  real-time timeout in the test racing a loaded machine. Done: the test uses fake timers or a wider margin.
- **P3 · open · Love and Work card registries (doc 70 Phase 4).** `src/reading/cards/` is Self-only (`cards/self/`
  briefs, `self.cards` state row). Done: doc 70 step 10.

## Filed 2026-11-09 by the backfill disk-full incident

Branch `fix/backfill-safety` (docs/reading-engine/67 §6.1, §6.2). Owner of each item in brackets.

- **Incident (record).** `scripts/backfill-dasha-levels.ts --dry-run=false` on 33 kundlis filled the Render Postgres
  disk to 100 %: `kundli_activation` reached 553 MB (31k–47k level-3 rows per kundli across 47 dasha types, about double
  doc 67's ~20k estimate; ≈ 16.8 MB per kundli including indexes). Postgres could not write WAL and the API went down
  until Sachin raised the disk to 5 GB. 8 kundlis failed on the disk-full error, and the script then rebuilt their
  `kundli_activation` rows from the failed pull: the failed types' `kundli_data` rows had become `failed`, the rebuild
  read only `ready` trees, and the levels 1–3 band of every system was deleted and re-inserted without them. Afterwards,
  on Sachin's instruction, 29 kundlis were deleted and 4 kept.
- ~~**P0 · The backfill stripped activation rows after a failed pull.**~~ Fixed on `fix/backfill-safety`: per kundli
  and per dasha type, only a type whose pull came back as a complete tree this run (and was stored) is replaced
  (delete + insert of that kundli's levels 1–3 for exactly those systems, one transaction); a failed, locked, empty or
  unstored pull keeps its rows; all failed writes nothing; a kundli with any failed type is not marked done, so a rerun
  retries it. The digest rebuild had the same pattern (`writeDigest` deleted every level-1–3 row): it now keeps the rows
  of a system whose tree is `failed` or `fetching` (`heldDashaSystems`). The deep worker already replaced only the
  systems that answered.
- ~~**P0 · No disk guard on bulk activation writes.**~~ Fixed on `fix/backfill-safety`: `src/reading/digest/diskGuard.ts`
  reads `pg_database_size(current_database())` and the measured bytes per row (`pg_total_relation_size` ÷ `count(*)`,
  fallback 350 B) and refuses when size + estimate > `DB_DISK_LIMIT_BYTES` × `DB_DISK_MAX_FILL` (default 0.7). The
  backfill checks before the run, before every kundli's write and after every kundli; a wet run refuses when
  `DB_DISK_LIMIT_BYTES` is unset. The deep worker checks before writing and marks the marker `deferred_disk` (retried
  after an hour) instead of writing past it.
- **P1 · Run the backfill only after setting `DB_DISK_LIMIT_BYTES` and reading the dry-run byte estimate.**
  `DB_DISK_LIMIT_BYTES=5368709120` for the 5 GB Render disk; the dry run prints rows × bytes per row per kundli, the
  total, the database size and the threshold. [deploy / ops session] Done when the next run's dry-run numbers are in its
  log and fit under the threshold.
- **P1 · Storage decision for Sachin: lifelong level 3 for every system costs ≈ 16.8 MB per kundli.** Doc 67 §6.2
  recommends level 3 lifelong only for the primary clock and the configured confirming clocks, every other system
  levels 1–2 lifelong plus level 3 within ±2 years (about 70–80 % fewer rows, ≈ 3–5 MB per kundli), tunable by
  `DASHA_L3_LIFELONG_SYSTEMS`, `DASHA_L3_WINDOW_YEARS`, `DASHA_LIFELONG_OTHER_MAX_LEVEL` (reserved, not built).
  [Sachin] Done when he picks an option; then it is built before the backfill runs on more kundlis.
- **P1 · Set `DB_DISK_LIMIT_BYTES` on the API and the dasha-deep worker Lambdas.** Without it the deep worker's guard
  is off (it logs `dasha_deep_disk_guard_unset` on every run). [deploy session] Done when both functions have it and
  the log line is gone.
- **P2 · A failed re-pull downgrades a `ready` `kundli_data` row to `failed`.** `claim` sets `fetching`, and `complete`
  with `failed` keeps the old payload but sets the status, so `loadDigestInputs` (status `ready` only) no longer sees
  that tree until the next good pull. The activation rows are now kept (above), but the digest's other uses of the tree
  lose it meanwhile. [server] Done when a failed re-pull of a row that had a ready payload leaves it `ready` (with the
  error recorded) or readers fall back to the stored payload.
- **P2 · Disk freed by deletes needs a vacuum.** Replacing rows leaves dead tuples until autovacuum; after the 29
  kundlis were deleted the disk is not smaller until a `VACUUM` of `kundli_activation` (a `VACUUM FULL` needs as much
  free space again and locks the table). [ops, with Sachin's yes] Done when the table's size matches its live rows.
- **P3 · A dasha system that stops being served keeps its activation rows after a digest rebuild if its tree row is left
  `failed`.** Only rows of systems with no stored tree at all are dropped. [server] Done when retired systems are
  removed explicitly.

## Decided 2026-11-09: dasha level-3 storage

- **DECIDED · Every dasha system keeps levels 1–3 for the whole life** (Sachin, 2026-11-09: "Keep every system"). The
  storage cut in docs/reading-engine/67 §6.2 is not built. Cost: about 16.8 MB per kundli (measured 2026-11-09).
- **P2 · Database capacity for lifelong level 3.** At ~16.8 MB per kundli and the disk guard's 70% of the 5 GB Render
  disk, the database holds roughly 150–200 kundlis beside the other tables before the guard stops writes. Owner: Sachin
  (disk plan) with the deploy session (monitoring). Done: an alert at 60% disk on the Render database, and a disk plan
  for the expected user count (or a decision to revisit §6.2 then).

## Filed 2026-11-10 by doc 71 (ready on click, one cache per person, person memory; branch `feat/self-v3`)

- **P1 · open · Cache storage price and creation time for `gemini-3.8-flash` are not known.** Doc 71 §8 assumes about
  $0.50 per million input tokens (inferred from the replay bill), a tenth of that cached, and a 150,000-token pack. At
  $1 per million tokens per hour a 45-minute cache costs about $0.11, close to the reading itself. Owner: this branch,
  doc 71 Phase 0. Done: measured pack size, creation time, storage and cached-read price written into doc 71 §8. Needs
  Sachin's yes (paid call).
- **P1 · open · Every call on a shared cache pays the cached rate on the whole pack.** A bigger pack is not free: ten
  calls on 150,000 cached tokens is 1.5 million cached tokens. Doc 71 step 2 decides one pack or two from the Phase 0
  numbers. Owner: this branch.
- **P2 · open · A Gemini cache holds one system instruction.** The card path uses a different system prompt per agent,
  so it cannot share one cache as written. Doc 71 §4.2 moves the card, clock, Personalizer and Clarifier roles into
  one role library, as `packs/fullPrefix.ts` already does for questions. Owner: this branch.
- **P2 · open · No per-area life memory and no per-person Personalizer brief exist.** `src/profile/facts.ts` holds a
  fixed catalogue only. Doc 71 §4.5 and §4.6. Owner: this branch, doc 71 Phases 3 and 4.
- **Decisions for Sachin (doc 71 §10):** clocks read before the click; Oracle and Personalizer in one call per group;
  the ten memory areas; question limits of one per visit and three a week.
- **P1 · open · Four card groups take 36 to 45 s, not 15 (doc 71 §12).** Measured 2026-11-11: the cache removed the
  input wait (first token 2 to 4 s); output at about 125 tokens a second sets the time. Fix: seven groups of three
  cards, then measure. Owner: this branch.
- **P2 · open · The card pack repeats the card prompt 21 times and shared rows across cards (doc 71 §12).** 234k tokens
  raw, 79k with each line once. Build the pack with each row once and cards naming rows by key. Owner: this branch.
- **P2 · open · The Phase 0 test ran with an empty ledger (doc 71 §12).** Cards wrote "agreement" sentences without
  ledger cells to stand on. The next replay runs the readers on the pack first. Owner: this branch.
- **P2 · open · Gemini prices double on 2027-01-01** (input $1.50, output $7.50, cached $0.15, storage $1.00 per 1M per
  hour). `PRICE_CHANGES` in `src/reading/llm/models.ts` has input, output and cached; storage is not modelled anywhere.
  Owner: this branch.
- **P2 · open · Card faces failed on "divided" and "annual cycle" (doc 71 §13).** `diagnosis` and `year`, first pass;
  the repair was blocked by the replay's call limit. Watch the next replay; if the words recur, name them in the
  Personalizer prompt. Owner: this branch.
- **P2 · fixed · The group batcher sent every card alone (doc 71 §13).** A 25 ms timer; store lookups are database round
  trips. Groups now wait for every card of the phase (3 s at most). Test in `tests/unit/reading/cards/cards.test.ts`.
- **P2 · fixed · `gemini-3.8-flash` refuses thinking level "minimal"** (concordance, 2026-11-11). `allowsMinimal` in
  `src/reading/llm/gemini.ts` now sends "low" for that model.
- **P3 · open · Batch mode for the cards not on the board (doc 71 §13).** Half price; not built. Owner: this branch.

## Filed 2026-11-11 by doc 72 (the Now card; server `feat/self-v3`, engine `feat/transit-natal-varga-houses`)

- **P1 · fixed on the engine branch · `transit` counted D2-D60 natal houses from the natal D1 lagna.** Engine
  `4349000` on `feat/transit-natal-varga-houses` (worktree `C:/Users/Owner/Documents/work/wt/radha-now-vargas`): each
  chart counts from its own natal lagna and states it as `natal_lagna`; calc version 2. Not merged, not deployed. The
  server shows D2-D60 natal houses only when `natal_lagna` is present, so it is safe before and after the release.
- **P1 · open · `prashna` still counts every divisional chart from the natal D1 lagna** (`natal_lagna_sign` in
  `src/jhora/prashna_export.py`, engine). Same fault as above. Owner: engine lane.
- **P2 · open · The engine repo's remote answers "Repository not found"** (`origin` =
  `https://github.com/sachinm/AIAstraRadha`, 2026-11-11). Fetch fails; the worktree was cut from local `develop`
  (`8e31dd5`). Check the URL or access before the engine branch can be pushed. Owner: Sachin.
- **P2 · open · 11 engine tests fail on the engine branch, none in the transit export** (not checked whether they fail
  on `develop` too): 8 calc-version mismatches (`annual.tithi_pravesha`, `annual.tithi_pravesha_dasha` in
  `test_doc34_annual.py` and `test_r5_annual.py`; `pressure_inventory` in `test_pressure_inventory.py`) and 3 time
  limits under load (`dasha.sudasa` 7.2 s, `transit_contacts` Moon 400 days 6.9 s, `transit_range` 36 years 17.8 s).
  Owner: engine lane.
- **P2 · open · The Now card is not run against the real engine or model yet.** Tests use fakes. One paid call (about
  $0.02) and the engine pulls on the test kundli need Sachin's yes. Owner: this branch.
## Filed 2026-11-10 by the card picker and card options build (docs/reading-engine/71)

- **P1 · Apply migration `20261110140000_board_layout_options_m49` before the API that reads `board_layout.options`
  ships.** Additive (`ADD COLUMN IF NOT EXISTS options jsonb default '{}'`), but Prisma selects the column, so the new
  API on an unmigrated database fails layout reads and writes. [deploy session] Done when staging has the column and
  `GET /api/self/v3` answers 200 after the deploy.
- **P2 · Card Length and Words do not change the written text yet (doc 71 Phase 2).** Today a Deep card shows every
  stored part and says "Longer writing comes with a later reading"; a glance only hides parts. Writing to the chosen
  length and with chart terms needs the Personalizer to take the options and a new card cache key, priced by one paid
  replay. [server, with Sachin's yes for the replay] Done when a Deep card is longer and a glance is one sentence.
- **P2 · The long arc is only honoured on This chapter and Chapters.** Other Self cards with View = The long arc show
  the year and a plain note. [server] Done when card readings carry the life chapters, or the choice is offered only
  where it applies.
- **P2 · Love and Work cards are today's sub-areas, not doc 69's v3 cards.** The Partner you draw, What to build and
  Leading people are "Coming soon" because no sub-area feeds them; the picker shows every card whatever the person's
  status (doc 69 `showWhen` not built). [server + web, doc 69] Done when doc 69 cards replace the mapping in
  `src/reading/boards/catalogue.ts`.
- **P3 · Love and Work Plan option has no effect.** Those boards have no plan lines; the card says so. [doc 69] Done
  when their v3 cards carry a step per period.
- **P3 · The Work board's detail text is fixed copy with chart words** ("Natal Promise (10th Bhava & Dasamsa D10)",
  "Vedic Timing Clocks") written in the page, not from the engine; Plain words now hides it for chosen cards, but the
  default view still shows it. [web] Done when the copy comes from the engine's own rows or is removed.

- 2026-11-11 Turnstile input-first (found, not fixed): `requestMagicLink` still answers a malformed email with the success message (kept on purpose, tests/unit/auth/cognitoFlow.e2e.test.ts), and it spends the token because the server cannot refuse it. The web page validates first, so only a direct API call hits it. Step 2 (server-issued short-lived proof after one good check) is still open if this is not enough. Deploy the server before the web build: the web now selects `turnstileConsumed`, which an older server schema rejects.
- **P2 · Card photos depend on `OVERLAY_ART_KEY` in the web build and on the key route.** Without the key the cards
  show drawn art (by design). The packs are re-made every build with a new IV; the name changes only when the photos or
  the key change, so browsers keep their cached ciphertext across deploys. [deploy session] Done when staging serves
  `/_a/c.json` as JSON and the picker shows photos signed in.
- **P3 · Weak photo picks to replace when better CC0 images turn up:** Gifts & knots (plain box), Practice & deity
  (candles, not a diya), Distance or tension (a woman alone), Family banner reuses the Family card photo, Finding work.
  [web] Done when swapped in `art/cards` (keep SOURCES.md current).

## Filed 2026-11-12 by the board faces/tools build (server `feat/board-layout-vclean`)

- **P2 · Confirm GET /api/self/v3 answers 200 after the deploy.** Migrations `20261112190000_board_layout_board_options_m50`
  and `20261112190100_board_read_indexes_m51` were applied to `aiastradb` on 2026-11-12 (`prisma migrate status`: up to
  date, 73 migrations). Only the post-deploy check is left. [deploy session] Done when GET /api/self/v3 and PUT
  /api/self/v3/layout answer 200 on staging after the deploy; then delete this item.
- **P2 · Chart details evidence keys go to every role.** GET /api/self/v3 sends `cards[].v2.details.evidence` (engine
  row keys such as `planet:D1.Sa`) and Chart details paragraphs to every signed-in person, novice included; nothing on
  the Self v2/v3 path gates on role. The new `face: 'research'` changes no content (tested), so it does not widen this,
  but if evidence is meant to be practitioner-only (astrologer, researcher, aiastra_admin) the gate does not exist yet.
  Found reading `src/reading/self/v2api/response.ts` `areaViews`. [Sachin: product decision; then server] Done when the
  rule is decided and, if gated, a public user's body has `evidence: []` with a test.
- **P2 · PUT /api/self/v3/layout starts the card build without awaiting it.** The cards are marked `queued` (awaited)
  and the async Lambda invoke is fire-and-forget so the answer is not held. On Lambda the environment can freeze right
  after the response, so the invoke may only leave on the next request (the page's GET poll, which also re-queues a
  stuck build). [server] Done when a staging trace shows the invoke leaving within the PUT's invocation, or the queue
  call moves before the response with a measured cost under 50 ms.
- **P3 · Board-wide `length`, `words` and `plan` do not change a card's stored `sections`.** Sections are derived from
  a card's own options on PUT (doc 71 §4.4 item 3); board options only change `cards[].options` (in force) and the
  shaping (`view`, `plan`). [web + server] Done when the page derives visible sections from `cards[].options`, or PUT
  derives them from the board options too.
- **P3 · The catalogue picker no longer shows a first line, and a card read only in a Phase B (`self.v3.cards`) row shows
  `not_read`.** GET /api/self/v3/catalogue now reads the chart id, the registry, `deps.suggest` and today's card-state
  row only (no board read, no build queued), so `firstLine` is always null and `state` comes from the card-state row
  (`done` shows as `ready`, `queued`/`reading`/`failed` as stored); a card whose reading lives only in the legacy
  `self.v3.cards` row, or in a state row from an earlier day, reads `not_read` there. Found fixing the route
  (`getSelfV3Catalogue`, `src/reading/self/v3/service.ts`). [Sachin: product decision; then server + web] Done when it
  is decided whether the picker needs the first line and legacy-ready states; if so, a cheap stored read of the
  newest card rows (not the board read) provides them, with a test; if not, the web stops using `firstLine` from the
  catalogue.
- **P3 · "a girl of seven" is still refused when the person states no gender.** With no stated gender,
  `GENDERED_WORDS` (`src/reading/self/v2/personalizerValidate.ts`, `textProblem`, used by `checkPersonalCard` in
  `src/reading/self/v3/personalizer.ts`) lists `girl` (also `boy`, `man`, `woman`, `he`, `she`, `husband`, `wife`...)
  as a gendered word and `textProblem` returns a problem for the whole text, so a card with "your daughter, a girl of
  seven" is rejected (not dropped sentence by sentence) for a person with no stated gender. The stereotype list no
  longer holds `girl` (`ce81707`), and a stereotype sentence is dropped on its own, but the gendered-word check was not
  changed. Found while testing the stereotype fix on 2026-11-12. [server; Sachin: decide whether words naming another
  person (daughter, girl, boy, husband) count as gendering the reader, and whether a gendered sentence drops alone]
  Done when the rule is decided and a test shows "a girl of seven" kept for a person with no stated gender.
## Filed 2026-11-12: plan 73 findings and the fix batch (to be fixed together, one branch)

Source: `docs/reading-engine/73-self-card-faces-tools-and-lenses.md` (Appendix B) and the build sessions' side findings.

- **P1 · No typecheck or test step runs in either deploy workflow.** `.github/workflows/deploy-api-lambda.yml` (server)
  and `deploy-staging-amplify.yml` (web, on `release-candidate-staging` only) build and deploy on a push to
  `release-candidate-staging` with no `tsc` and no tests; nothing runs on feature branches or `develop`. Sachin chose a
  clean local install and local tests instead of a CI gate (2026-11-12), so the gate is manual. [deploy session] Done
  when typecheck and the unit tests pass locally on `develop` before every merge into `release-candidate-staging`, or a
  CI job exists.
- **P2 · All Self cards read `not_read` for the test account, so no per-period text exists to show.** The per-period text
  fix lands only on Phase A cards; Phase B cards carry `text: null`. Found in plan 73 §1. [reading-dev] Done when a
  card-by-card read has run for the test account and a period shows its own text.
- **P2 · Rail tones are null on every card.** `RailItem.tone` is null for all rails, so a period cannot be coloured by
  how it presses. [server] Done when `railFromDates` and `railFromSpans` fill the tone from the engine's dated windows.
- **P3 · Option notes show on cards where they do not apply** (`optionNotes`). [server + web] Done when a note appears
  only on a card its option changes.
- **P2 · The practitioner role set is hardcoded and disagrees with the TODO above.** `readerRole` treats `student`,
  `astrologer` and `researcher` as practitioner; the evidence-keys item names `aiastra_admin`, which the code does not
  include, and the set is not env-driven (AGENTS.md rule). The web hides evidence with `profile.role === 'practitioner'`
  while the server sends it to every role, so this is display-only. [Sachin: decide the set; then server] Done when the
  set is one env-driven list, used by the server to blank `evidence` for other roles, with a test.
- **P2 · Check `SELF_V3_BUILD` and `READING_CLOCK_LAYER` on the live `aiastra-server-api` Lambda.** Without them the new
  Self board does not build. The `aiastra-ops` key was invalid on 2026-11-01, so not read. [deploy session, Sachin's AWS
  access] Done when both are read from the function configuration and their values noted here (no secrets).
- **P3 · The registry has 26 cards, not 11** (plan 73 App. B item 7); the other 15 appear only with per-card reading on.
  [docs] Done when the product doc says so.
- **P3 · Love and Work have no v3 layout route** though they share the `board_layout` table. [server] Done when the
  routes exist or the docs stop saying they share one.
- **P3 · Prompt version hash was computed by hand.** `src/reading/prompts/generated.ts` was edited without the
  generator (`scripts/embed-prompts.mjs`). [server] Done when `embed-prompts.mjs --check` passes in a clean install.
- **P2 · CloudFront may strip `If-None-Match` or its response headers policy may drop `ETag` and the CORS headers.**
  The app's CORS list already allows `If-None-Match` and exposes `ETag` (`server.ts`), but the edge sits in front of
  the Lambda: cache policy `4135ea2d-…`, origin request policy `e1684868-…`, response headers policy `67f7725c-…`
  (`aiastra-aws-terraform/environments/prod/imports.md`; `modules/edge/main.tf` is an empty stub, so they are not
  readable as code). If the origin request policy does not forward `If-None-Match`, every GET returns 200 and the
  304 path never fires (no breakage, no saving). [deploy session, Sachin's AWS access] Done when the three policies are
  read, `If-None-Match` is forwarded and `ETag` passes through, and a repeat GET on staging returns 304.
- **P2 · Web Self board redesign: not seen rendered, e2e not run, real IndexedDB path untested.** (`AIAstra_WEB`,
  `feat/self-vclean`.) Vitest runs in jsdom, which has no IndexedDB, so `selfV3Cache` is tested through an in-memory
  backend only (`fake-indexeddb` is not installed); the 1280 px one-row control layout, the banner heights and the touch
  swipe carousels have not been viewed on a screen; `e2e/card-picker.spec.ts` was edited for the removed "Edit
  sections" ids but not run. [web + Sachin's screenshots] Done when the staging build is opened at 1024, 1440 and 1920
  px and on an iPad, every card and face is photographed into `docs/screenshots/`, and the e2e spec passes.
- **P3 · Web: `caniuse-lite` is outdated** (vitest prints a Browserslist warning). [web] Done when
  `npx update-browserslist-db@latest` is run in its own commit (it edits `package-lock.json`).
- **P3 · The web repo's `npm test` runs `vitest` in watch mode.** The repo already has `npm run test:run`. [docs] Done
  when `AIAstra_WEB/AGENTS.md` says agents and CI use `test:run`.

## Filed 2026-11-10 by the phone-frame session (web `fix/sky-mobile-cover`, merged into develop)

- **P2 · Landing scroll icon can rest on the figure in portrait.** In `docs/screenshots/mobile-frame/01-landing-portrait.png`
  (web repo) one parchment icon sits at about x 56 %, y 32 %, inside `KEEP_OUT_PORTRAIT` [30, 70, 30, 66] of
  `src/lib/scrollPlacement.ts`. Either the placement runs before the portrait flag is read, or the keep-out is applied
  to something other than the icon centre. Owner: web. Done: no icon centre inside the portrait keep-out on a phone.
  Status: open.
- **P3 · Phone header squeezes the question quota to "2…".** At 360 px the board header (menu, star, quota, chat,
  Personalize, avatar) leaves the `UsageBar` text a few pixels, so the count truncates. Seen in
  `docs/screenshots/mobile-frame/10-board-phone.png`. Owner: web. Done: the quota reads in full on a 360 px phone, for
  example by moving Personalize into the menu drawer. Status: open.
