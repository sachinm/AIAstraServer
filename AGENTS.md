# AGENTS.md — how agents work in this repo

Applies to every coding agent (Claude, Fable, Gemini, Cursor, Codex) working on AI AdAstra.

## Work in parallel by default

Never let one task block the rest of the plan.

0. **Run commands in background mode.** Any command that can take more than a few seconds (tests, `tsc`, builds,
   `prisma generate`, installs, git on large trees, scripts) runs with the agent's background/"run in background"
   option. While it runs, keep working on the next thing that does not need its result; read its output when it
   finishes. Do not sit waiting on a foreground command.
00. **Every sub-task runs as a background task (Sachin, 2026-11-07).** Every sub-agent, side session, research
   sweep, doc draft, web or server slice, test run and long script is started in background mode, so nothing blocks the
   task before or after it. The agent that starts it keeps working on the next independent step and reads the result
   when the notification arrives; it never waits in the foreground for a sub-task, and never polls or sleeps on one.
   Sub-agents run on Opus 5.5 at medium effort with fast mode unless Sachin names another model.

Do not work through a plan one item at a time when its items are independent.

1. **Split first.** When a plan has two or more pieces that do not need each other's results and do not edit the same
   files, start each extra piece as its own background session (or sub-agent) on its own branch/worktree, then do the
   remaining piece yourself. Do not wait for them; keep going.
2. **Unblock yourself.** A blocker that is not a decision only Sachin can make (a missing fixture, a review, a side
   investigation, a doc, a refactor another piece needs) goes to the background too, while you continue with what you can.
3. **Brief it fully.** Each background piece gets: the goal, the files it owns, the files it must not touch, which
   migration number/timestamp it uses, and what "done" is (branch, commit, tests green). Two writers never edit the same
   file; when both need one shared file (e.g. `prisma/schema.prisma`), say where each one appends.
4. **Planning stays planning.** A planning/review session (e.g. Fable on a design doc) only reads code and writes its one
   doc. It does not change code.
5. **Merge is yours.** Background sessions commit on their own branch and stop. The session that started them checks the
   diff, runs tsc and tests, and merges `--no-ff` into `develop`.
6. **Ask only for real decisions.** Production, AWS, database writes, pushes, deletes and money need Sachin's OK
   (through the deploy session for deploys). Everything else, decide and report.

## How a plan is written

Before any code, write the plan under `docs/<topic>/` covering:

1. **Start.** Current system checked against code, logs, AWS config and DB — name files, Lambdas, tables, env vars and user symptoms.
2. **End goal.** User-visible behaviour, target timings and eliminated failure modes.
3. **Deliverable.** Exact code paths, migrations, infra/env changes, docs and tests.
4. **How it works when done:**
   - **Backend:** end-to-end flow with numeric concurrency, limits, timeouts, retries and failure handling.
   - **API:** every endpoint/query/event: request, response, status codes and client errors.
   - **Frontend experience:** per-state UI behaviour, polling/streaming, loading and error views.
   - **UI/UX:** copy on screen, states (pending, building, ready, failed) and user-noticed timings.
5. **Architecture.** Component interactions, execution boundaries (request path, async invoke, scheduled sweep, Radha, DB) and boundary guarantees.
6. **Ingredients.** Libraries, env vars, IAM, EventBridge rules, migrations, fixtures/test data and owner (agent, deploy session, Sachin).
7. **Action steps in sequence.** Numbered, owning files, definition of done and parallelizable steps.
8. **Development phases.** Shippable checkpoints with closing verification (tests, screenshot, log line) and deferred items.
9. **One recommendation.** Lead with the chosen design and why; brief verdict table for alternatives, not a menu.

Decide what a staff engineer could decide; ask only for Sachin's decisions (production, money, data writes, product behaviour). Plans are for review; code follows them.

## Branches, migrations and deploys

- Every feature/fix/docs branch is cut from `develop` and merged back into `develop` with `--no-ff`. `main` gets release
  merges only.
- Before a merge: `npx tsc --noEmit` and the unit tests for the area (`npx vitest run tests/unit/<area>`).
- **Database migrations via Server (Sachin, 2026-11-06):** Gemini agents are authorized to apply additive Prisma migrations (`prisma/migrations/*`) into the database via `AIAstra_Server` using `npx.cmd prisma migrate deploy` (followed by `npx.cmd prisma generate` and `npx.cmd prisma migrate status`). Never run destructive SQL (`DROP`, `TRUNCATE`) or `terraform` without Sachin's explicit OK.
- **Pushing & deploying `develop` via `release-candidate-staging` and GitHub Actions (Sachin, 2026-11-06):** Once `tsc --noEmit` and unit tests pass on `develop`, Gemini agents are authorized to push `develop` to `origin`, merge `develop` `--no-ff` into `release-candidate-staging`, and push `release-candidate-staging` (authenticated as GitHub user `sachinm`) to trigger the GitHub Actions OIDC workflows that refresh:
  - **Main API Lambda (`aiastra-server-api`):** `.github/workflows/deploy-api-lambda.yml` in `AIAstra_Server`
  - **Admin API Lambda (`aiadastra-admin-api`) & Admin Web Amplify (`aiadastra-admin-web` / `d1qhwivm0xxltl`):** `.github/workflows/deploy-admin-api.yml` and `.github/workflows/deploy-admin-web.yml` in `aiadastra_admin`
  - **Main Web Amplify (`AIAstra_WEB` / `d20sdo476h9w6c`):** `.github/workflows/deploy-staging-amplify.yml` in `AIAstra_WEB`

## Installs and worktree creation go to Haiku

Installing dependencies (server, web, local or in a worktree: `npm ci`, `npm install`, `prisma generate`) and creating
worktrees are done only by a sub-agent on the Haiku model at medium effort, never by the session's own model. Brief it with
the literal folder to work in, because a command run without one lands in the main checkout: on 2026-11-01 an `npm ci` meant
for a worktree rebuilt the main checkout's `node_modules`. The rules under "Worktrees and deletes" apply to it too.

## Worktrees and deletes

On 2026-10-31 a `git worktree add` run with an empty path made git's cleanup delete the contents of the main checkout
(`.git`, `.env`, `docs`, `evals` and more), and unpushed commits were lost. These rules exist so it cannot happen again.

- **Never build a worktree or delete path from a variable, a substitution or a prompt result.** Write the path as a
  literal absolute path, outside every checkout, and print it before the command. An empty or wrong path in
  `git worktree add`, `git worktree remove`, `rm -rf`, `Remove-Item -Recurse`, `Directory.Delete` or `git clean` can
  delete the main checkout.
- **Before `git worktree add`:** the target must not exist, or be an empty directory, and must not be inside a checkout.
  Run `git worktree add <literal-path> -b <branch> <base>` with every argument spelled out, never with an empty string,
  `$VAR`, `$(...)` or `${...}` in the path.
- **After `git worktree add` or `git worktree remove`:** check that the main checkout still has `.git` and `docs`
  (`ls -d <main>/.git <main>/docs`) before doing anything else. If either is missing, stop, run nothing that writes, and
  tell Sachin.
- **Never run `git clean`, `git reset --hard`, `rm -rf` or a recursive delete against the main checkout.** Cleanup is
  only ever of a worktree you created, by its literal path, after its branch is merged.
- **Prefer the app's own worktree isolation** (the session or agent `isolation: worktree` option) over hand-run
  `git worktree` commands.
- **`develop` is pushed after every merge** (through the deploy session, as below), so at most one merge is ever unpushed.
- **`.env` is not in git.** Its values live in the Lambda and Render configuration; keep a copy outside the checkout and
  note where it is in `docs/TODOS.md` without the values.

## Clean up when work is done

- **Branches:** once a feature/fix/docs branch is merged into `develop`, delete it locally (`git branch -d`). Never
  delete `develop`, `main`, release branches, unmerged branches, or remote branches without Sachin's OK.
- **Worktrees:** once a worktree's branch is merged and it has no uncommitted changes, remove it
  (`git worktree remove <path>`). If the folder is held open by a session, archive that session (with Sachin's OK) and
  remove it then.
- **Local servers:** any server or watcher you start for any reason (`npm run dev`, `node server`, `uvicorn`, Vite, test
  watchers) is stopped as soon as the check that needed it is done. Kill the process; do not leave it for later. Before finishing, list what you started and confirm none is still
  running. Never stop processes you did not start.

## File every finding

Any error, bug, risk or issue you find and do not fix on the spot goes in `docs/TODOS.md` before your session ends, or in an
appropriately named doc under `docs/` linked from there. This covers side findings outside your task, failures you worked
around, and things another session told you. Say what is wrong, where, how you know, who holds it, and what done means.
Read `docs/TODOS.md` before starting work in an area. Delete an item when its fix ships. A finding mentioned only in chat is lost.

## Every agent and function is registered and tagged (docs/admin/03)

The admin panel's Techniques and Agents pages read what is registered and tagged here; anything left out does not show.

- **A new agent** (model, engine pull or code) gets an `AGENTS` row in `src/agents/registry.ts`.
- **A new board function or technique** gets a `TECHNIQUES` row in `src/techniques/catalog.ts`: its charts, its
  algorithm in plain steps written from the code, its source, its code path and its agents. It stays `planned` (no
  agents) until it is built. A technique is a contract (docs/reading-engine/53 §4.3): its `selectors` say when the
  clarify context and the companion memory pick it, its `contract` what it reads (digest sections in a layout from
  `src/techniques/layouts.ts`), under which prompt, with which user fields, and what it returns. A new technique without
  both fields fails the catalogue test (`tests/unit/techniques/contracts.test.ts`).
- **Every `withAgentRun` call** passes `technique` and `kundliId`, and the charts it read (`charts`, or `charts` in the
  result when they are known only after the read).
- **Every sub-agent slices from `kundli_digest` and recycles used caches after 45 minutes.** Register each sub-agent's digest sections in `src/reading/oracle/digestSlices.ts` (`SUBAGENT_DIGEST_SPECS`) and `src/techniques/subagentCachePlan.ts`, pass `cachePrefix: true` + `cacheOwner: { userId, kundliId }` with the stable individual prefix in `parts[0]`, store reusable outputs in `reading_findings_cache` or `technique_outputs`, and wire consumption hooks into `informIndividualCacheUsed` / `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`, 45-minute TTL via `READING_CACHE_RECYCLE_MINUTES`).
- **Self-only RBAC (`assertOwnAccount`) and sealed caches (`SEALED_MODELS`).** Every user-scoped resolver/endpoint enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`), every derived reading/board/digest/cache model is listed in `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1`), and `/api/*` + `/graphql` send `Cache-Control: private, no-store, no-cache, must-revalidate`.
- **Page timing telemetry (`M37`) and progressive NDJSON board streaming.** Consumer pages send `X-Astra-Page` + `<PageTimingTracker />` (`render_ms`, `draw_ms` → `page_execution_logs`), and multi-section boards (`/you`, `/love`, `/work`) stream via `GET /api/dashboard/sections-stream` (`application/x-ndjson`).
- **Isolated research staging (`research_*`, `M38`) and 8-gate technical verifier.** Synthetic QA cohorts and deep-dive board runs (`self`, `love`, `work`) write only to `research_*` staging tables and must pass `research.technical_verifier` (10-step trace + 8 gates, `>=95%` pass threshold).
- **Header Personalize Wizard modal and Self 3-decade character + Moon/Mercury joy.** The 6-step `WelcomeWizard` is accessible as a modal from `TopNavigation` next to `ProfileMenu` (`inModal` preloading `person_facts`), and the Self (`/you`) board ships `self.character_arc` (Last 10 Years · Who You Are Now · Next 10 Years) and `self.personality_joy` (Moon/Chandra + Mercury/Budha + 4th/5th Bhava) with plain-English prose and zero Node house arithmetic.
- **General Reading spans** are tagged by `src/reading/metrics/trace.ts` (`agentIdOf`, `techniqueIdOf`, category from the
  subject). A new reading stage or analyst name is added there, with its registry and catalogue rows.
- **Summaries** (`input` and `output` of a run) hold counts, ids, tones and scores only: never birth data, names, places
  or question text. `tests/unit/techniques/summaries.test.ts` checks the call sites.

## Board and technique machinery: how every change is made (Sachin, 2026-11-09)

Modus operandi for dashboard changes (Self, Love, Work, Today, Lucky times) and adding/editing techniques: fast, code-first, model tokens spent only on cached prefixes (`docs/reading-engine/66 §4.8`).

1. **Sub-techniques run once; areas select.** Shared board logic is a `<board>.sub.<name>` sub-technique running once per build over one build context and stored engine rows, writing typed output to `technique_outputs` keyed by digest version, clock and boundary stamps. Area techniques are pure selections over sub-technique outputs into an `AreaBrief` (no DB reads; asserted by test). Boundary rebuilds re-run only invalidated sub-techniques.
2. **Code first, model second.** Code first builds ledgers from engine rows + reviewed word tables (what the chart promises/threatens — gift, knot, grace + source row — and what is live now with dates from engine windows). Models reason over ledgers and briefs, confirm/reject with evidence, add counsel/patterns, and never recompute dates or derive astrology in Node.
3. **Types first, then registration.** Export sub-technique and agent `Input`/`Output` types from the board's `types.ts` before use, with a validator (Zod or `responseSchema`), an `AGENTS` row (`src/agents/registry.ts`), a `TECHNIQUES` row (`src/techniques/catalog.ts`) with `selectors` + `contract` (checked by `tests/unit/techniques/contracts.test.ts`), and count/id/tone/score-only summaries. Plans adding an agent list its types in deliverables.
4. **Every agent has a slice and cache plan.** Build agent inputs from build context (never DB) as a stable prefix (`>= 1,024` tokens, padded from allowed rows if short) + variable suffix; register in `SUBAGENT_DIGEST_SPECS` (`src/reading/oracle/digestSlices.ts`) and `src/techniques/subagentCachePlan.ts` with `cachePrefix: true`, `cacheOwner: { userId, kundliId }` and stable prefix in `parts[0]`. Warm all prefixes in parallel before the first call (`READING_EXPLICIT_CACHE=1`); Lab displays cached vs total tokens.
5. **Every cache region is in the ledger for 45-min cleanup.** Every explicit cache region requires an `llm_cache_entries` row (`name`, `provider`, `user_id`, `kundli_id`, `prefix_hash`, `model`, `created_at`, `last_used_at`, `expires_at`); reusable outputs go to `reading_findings_cache` or `technique_outputs`. Consumers call `informIndividualCacheUsed({ userId, kundliId })` (`src/reading/llm/cacheSweep.ts`), and `recycleIndividualCaches` deletes used regions after `READING_CACHE_RECYCLE_MINUTES` (45); `runScheduledSweep` is the safety net. Unregistered regions are merge-blocking defects.
6. **Budgets are stated and measured.** Plans state, and builds log per agent: wall time, prompt/cached/output tokens and cost. Default targets: code `< 1 s`, cold build `< 30 s`, profile-only rebuild `< 10 s`, warm cached input share `> 70 %`. Lab replay gates merge.
7. **No paid call without a yes.** Phases state key, model, call count and cost, replaying first on stored Lab dossiers (`docs/reading-engine/65 §9`).

## Enterprise security, scale & Admin error reconciliation (Sachin, 2026-11-13)

Applies to every session and `/teamwork` swarm across `AIAstra_Server`, `AIAstra_WEB` and `aiadastra_admin` (full checklist in `.agents/rules/enterprise-security-observability.md`):

1. **Fail closed, never open.** Auth/lock reads (`src/auth/requestAuth.ts`), OTP brute-force limits (`src/auth/emailCode.ts`), and `CORS_ORIGINS` fail closed (`503 auth_unavailable` / 15-min OTP lock / `origin: false`) on DB or config failure.
2. **Mask to consumers; capture & correlate for Admin.** GraphQL/REST mask internal/Prisma errors on the wire (`INTERNAL_SERVER_ERROR` + `requestId`) while keeping allowlisted domain codes (`UNAUTHENTICATED`, `FORBIDDEN`, `ACCOUNT_LOCKED`, `BAD_USER_INPUT`). Every server 5xx, GraphQL error, RBAC denial, depth/alias block, client JS/React crash and CSP violation writes a PII-redacted row to `app_error_events` (joined via `request_id`/`session_id`) for `aiadastra_admin` (`Usage › Errors`, `People › Security`).
3. **Audit every staff read; sign service calls.** Staff inspections of customer charts/profiles (`chart.inspect`, `lab.person_view`) record `admin_actions` and authenticate `aiadastra_admin` -> `AIAstra_Server` with HMAC-signed staff-attributed headers, never anonymous static tokens.
4. **Headers, CSP & header-only secrets.** Web and API ship `Content-Security-Policy`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Strict-Transport-Security` and `Permissions-Policy`. Provider keys (`x-goog-api-key`) go in headers, never URLs.
5. **Scale & `/teamwork` gate.** Enforce GraphQL depth/alias caps (`src/config/env.ts`), small per-Lambda DB pools, bounded LLM fan-out and `<=100ms` UI / `<=500ms` cached API / `<=10s` interactive AI deadlines; `/teamwork` verifiers check ASVS 5.0 L2 + Admin error capture before approval.

## Tracking files

- `docs/TODOS.md`: every open finding, by priority (see above).
- `TEST.MD`: tests to perform. Executed tests save screenshots in `docs/screenshots/<folder>/` with sequence-numbered
  names (`01-…png`).
- `QA-LIST.MD`: tested items with their screenshots, for review.
- `AUTO-FIX.MD`: straightforward bugs queued for direct fixing.
- `SLOW-UI.MD`, `SLOW-UX.MD`, `SLOW-AGENTIC-FLOW.MD`: items that need slower review.

## Product rules agents must keep

- Radha (pyjhora, `AIAstra_Radha`) is the only source of astrological data. Node computes nothing astrological.
- **Externalize configurable selections, rule lists, and thresholds into environment variables (`src/config/env.ts`).** Never hardcode astrological rule lists (favoured/avoided yogas, karanas, fixed karanas, Amrita Siddhi toggle, reference timezone places, prepull horizons, board/digest thresholds, etc.) directly in business logic; read them through typed helpers in `src/config/env.ts` with clean defaults so they can be tuned via environment variables without code changes.
- English only for now.
- Declined topics (`declined_topics` table, docs/reading-engine/18) are never facilitated or passed to any agent.
- Never print secrets.
- **Never output internal engine/library names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) in any reading, report, or user-facing response.** All agents and LLM system prompts must enforce this rule (see `SOUL.md`).
- Read and follow `SOUL.md` for all astrological reading synthesis, anti-sycophancy claim verification, and 4-tier (`Sattvic / Rajasic / Mediocre / Baseline`) behavioral playbooks.

## We are making a Vedic astrology personal assistant (Sachin, 2026-11-05)

Not a horoscope, not a dashboard of categories. Every screen, answer and agent follows these:

1. **Specific to this person, or not shown.** A category or prediction that does not name the person's own situation is
   useless and risks being caught wrong. The chart gives the astrology; the assistant turns it into *this person's*
   situation ("your review on the 12th", "the move you mentioned"), or it asks first.
2. **Ask before you answer, and let the chart lead the question.** The chart says where the person is moving (a tested
   10th house these three months, a 4th/12th activation, a 7th house strain). The assistant confirms it with one
   plain question before predicting: "Did something change at work recently?", "Have you moved, or are you planning
   to?", "Has something shifted in a relationship?". Never a general prediction that can be caught wrong.
3. **Questions follow facts.** "How's your job going?" is asked only after the person has said they have a job.
   Unknown facts are asked (one or two, one tap each), stored once with the profile, and never asked again while fresh;
   the chat's Clarify step and every board read the same memory (docs/reading-engine/48).
4. **Confirmed answers are evidence.** A "yes, I left my job in March" becomes a ledger event and a calibration point;
   the method's accuracy is measured from these, never claimed.
5. **Digested words, no chart terms on a first screen** (docs/reading-engine/45 §3.3), and never the engine's name.
6. **Tilt the board: facts first, then one question, never a guess (Sachin, 2026-11-09).** Before any board or answer
   is written, the person's known facts are gathered and handed to the agent that writes it: age band from the birth
   date, stated gender or none, role, the wizard's facts (work, love, children, focus, place), the last confirm
   answers, declined topics, and the present shade (what presses and supports now, since when, eases when, from the
   engine's dated windows; docs/reading-engine/66 §4.3). Where a fact the reading needs is missing, the board asks one
   plain question for it (one tap, stored once) instead of guessing; a mood tap is offered, never assumed. Readings are
   written for the person the facts describe: the Oracle reads the chart in its own register, a second agent writes the
   card for this person (docs/reading-engine/66 §4.1), and neither invents a fact the person did not give.
7. **An action that costs a question says so first.** Anything that spends the account's monthly questions beyond the
   open of a board (a fresh rebuild the person triggers, a clock switch, a re-read on another system) shows the cost
   before the tap ("Uses 1 of your 20 questions this month"), proceeds only on the tap, and is logged with what was
   viewed (docs/reading-engine/66 §4.4, docs/billing/02).

Code that adds a category, a question or a prediction is checked against these before it ships.
