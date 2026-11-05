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
- **The 6/8/12 friction counts between dasha levels have no source.** Doc 26 Pass 3 and doc 33 R8 use them; Node may not count, and
  `house_counts` was not in the stored rows read 2026-11-01. Status: open. Done: read from `house_counts` once fetched per kundli.
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

