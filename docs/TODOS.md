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
  the refusal now says "today's limit, try tomorrow" with code `SIGNUP_EMAIL_LIMIT`. Status: blocked (domain).
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
- **P1: Personal data in logs.** `server.ts:141-146` logs 300 characters of every GraphQL body (emails, sign-in codes, questions). `src/lib/astroKundliClient.ts:839-848` logs 1,500 characters of every Radha response. `src/services/kundliService.ts:120-125` logs raw model output. Radha logs place, coordinates and birth data and appends responses to `logs/export.log` (`src/jhora/export.py:481,496,503,1284,1407`). Owner: dev session. Done: lines removed and `noPiiInLogs` test passing; existing CloudWatch logs given a retention decision by Sachin.
- **P1: `encrypt()` can silently store plaintext.** `src/lib/encrypt.ts:30` returns the input when `ENCRYPTION_KEY` is unset, and `:59-61` returns ciphertext on a failed decrypt. Local `.env` has no key; deployed value unread. Owner: privacy plan phase 3. Done: replaced, with no plaintext path.
- **P2: Admin birth-data handling.** `src/services/adminService.ts:106-108` writes birth fields unencrypted; `adminGetUser` returns them undecrypted (`src/graphql/schema.ts:897`); `adminGetUserKundli` (`:1010`) returns full charts. Role comes from the JWT, not the database (`src/graphql/context.ts:48`). Done: masked, per plan section 4.3.
- **P2: Debug and event routes.** `GET /debug/kundli/:user_id` (`server.ts:371`) closes only when `NODE_ENV` is `production`, and the Lambda runs as `staging`; it returns the caller's own chart. `POST /events` passes when no token is configured (`src/services/kundliSyncWorker.ts:50`). Done: debug route removed, token mandatory.
- **P2: Birth place sent to OpenStreetMap.** `src/reading/chartData/store.ts:582` and Radha `src/jhora/export.py:501` send the place string to Nominatim when no coordinates are known. Done: both removed, with the "pick a city" state.
- **P2: Chart hashes are unkeyed.** `kundli_facts.source_hash` is a SHA-256 over stored birth fields (`src/reading/data/factsBuilder.ts:40`), `dossier_hash` (`:54`), and `payload_hash` is an MD5 (`src/reading/chartData/store.ts:607`). Birth data is guessable, so an unkeyed hash reveals it. Done: keyed, per plan 4.1.
- **P2: Personal data in the browser after sign-out.** `astroUser` keeps name and email in localStorage (`AIAstra_WEB/src/routes.tsx:98`, `src/App.tsx:35`); the birth draft and location stay in sessionStorage (`src/Auth/BirthDetails.tsx:94`, `src/pages/chat-interface/useQuestionLocation.ts:47`); logout clears neither (`src/Auth/logout.ts:19-24`). Done: per plan 4.4.
- **P2: Groq is the code default for chat.** `src/config/env.ts:254` falls back to `groq` when `CHAT_LLM_PROVIDER` is unset, which sends biodata and charts to Groq. Deployed value unread. Done: provider removed, per plan phase 2.
- **P2: Legacy Gemini cache is not deleted at logout.** `src/services/geminiCacheService.ts:224-246` uploads charts to Google for 7 days on login and signup. Done: removed, per plan phase 2, and Google lists no caches.
- **P3: Personal data in the repo and scripts.** `evals/fixtures/G1/` and `docs/reading-engine/36-*`, `37-*` hold Sachin's own birth data and life details; `kundli.json` is tracked, contents not inspected. `scripts/backfill-local-facts.ts:68-86` writes every kundli's birth data to a local JSON file. Owner: Sachin decides what to do with their own data. Done: `kundli.json` inspected, the script removed, and any exports it produced found and deleted.
- **P3: Stale leftovers.** `login_attempts` exists by migration only, with no schema or code; `supabase/migrations` protect no current path; `server.ts:79` still allows `aiastraweb.onrender.com`; `src/services/recaptchaService.ts` has no importers. Done: each removed or kept on purpose.
- **Gemma 4 vs the catalogue.** AWS announced Gemma 4 on Bedrock and the pricing page lists it, but `list-foundation-models` in us-east-1 (account 900515855120, 2026-11-01) returned only Gemma 3. Likely another endpoint; not checked, because Gemma is only a control arm in the eval. The AWS MCP server's credentials were expired, so the catalogue in 442728149528 is still unread. Done: read in phase 1.
