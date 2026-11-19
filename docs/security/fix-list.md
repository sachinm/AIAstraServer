# Security fix list (2026-11-18)

What to fix across the five repos, in order. It comes from a security review on 2026-11-18, plus a read-only look at
the live AWS account 442728149528. The earlier audit is `assessment.md` (SEC-01..SEC-12). This file says which of
those are still open and adds what is new.

## Scope and method

| Repo | Branch read | What runs from it |
| --- | --- | --- |
| AIAstra_Server | `feat/self-foundation-server` | API Lambda `aiastra-server-api` behind CloudFront, plus the kundli and dasha workers |
| AIAstra_WEB | `develop` | Amplify app `aiastra-web` |
| aiadastra_admin | `codex/security-baseline-2026-11-13` | Lambda `aiadastra-admin-api` and the admin Amplify app |
| AIAstra_Radha | current checkout | Engine Lambda `aiastra-pyjhora` |
| aiastra-aws-terraform | `develop` | Nothing yet: a draft that has never been applied |

The review was done in four steps:

1. One reviewer per repo read the code looking for security bugs.
2. Each candidate was checked again by a separate reviewer looking for false positives.
3. Only findings that reviewer scored 8/10 or higher count as vulnerabilities.
4. Live AWS settings were read through `amplifyv2`, switching into OrganizationAccountAccessRole. Nothing was changed.

**Result: no finding reached 8/10, so there is no confirmed, directly exploitable vulnerability today.** The two
candidates that came closest are items 1 and 4 below. Both are real gaps, but their impact is low while every row is
test data.

The list below is what still needs fixing before real users sign up. It covers lower-confidence findings, earlier
findings still in the code, and hardening.

## Facts from the live account (2026-11-18)

- **There is no Redis or ElastiCache.** The search covered us-east-1, us-east-2, us-west-1, us-west-2 and ap-south-1:
  no replication groups, no serverless caches and no cache clusters. No Lambda has a Redis setting, and none runs in a
  VPC. The only cache is the Gemini cache table (`GEMINI_CACHE_TABLE`). Redis is still only an evaluation
  (`docs/architecture/redis-evaluation.md`).
- **No security group is open to 0.0.0.0/0.**
- **Function URLs:** `aiastra-server-api` and `aiadastra-admin-api` use `AWS_IAM`, so only CloudFront can call them. The
  pyjhora, kundli-worker, dasha-deep-worker and cognito-email-sender Lambdas have no URL.
- **API Lambda settings:**
  - `NODE_ENV=staging`.
  - `CORS_ORIGINS` is set to the five app domains.
  - `ADMIN_LAB=1`, with `ADMIN_LAB_TOKEN` set (96 characters).
  - `LLM_CACHE_SWEEP_TOKEN` is unset.
  - `PII_MODE` and `PII_KEY_PROVIDER` are unset.
- **Postgres on Render was not checked** (it is outside AWS). See item 19.

## P1: fix before real people sign up

1. **The research QA routes are open to any signed-in user.**
   - **Where:**
     - `AIAstra_Server/server.ts:390` mounts `registerResearchRoutes` with only `requireUser`.
     - `src/routes/researchRoutes.ts:42-76` is `POST /api/research/hydrate`.
     - `src/reading/research/selfDashboardQa.ts:869-968` holds the writes.
   - **What happens:** anyone with a free account can post `mode:"custom"` with a preset's `subjectCode`. That
     overwrites the subject's `research_kundli`, `research_chart_data`, `research_digest` and `research_activation`
     rows and adds `research_dashboard_run` and `agent_runs` rows. The admin research lab then shows the tampered
     data. It is test data and can be restored by re-running hydrate, so the verified score was LOW, 6/10.
   - **Fix:**
     - Check `isAdminRole(role)` from the auth row, or the admin-lab guard, in `registerResearchRoutes`.
     - Mount the routes only behind a flag.
   - **Done when:** a normal user's token gets 403 on every `/api/research/*` route.

2. **Sign-in lets people in when the database read fails (SEC-01).**
   - **Where:** `AIAstra_Server/src/auth/requestAuth.ts:139-142` returns the role from the token with `locked:false`
     when the database read throws. A locked, logged-out (`token_version` bumped) or deleted account keeps working
     until the token expires, which takes up to 7 days, for as long as the database cannot be read.
   - **Fix:** return `auth_unavailable`, which gives 503 or the GraphQL error `AUTH_UNAVAILABLE`, as
     `.agents/rules/enterprise-security-observability.md` §1.1 already requires.
   - **Done when:** a unit test with the database read throwing gets 503.

3. **Personal data is stored unencrypted on Lambda (SEC-02).**
   - **Where:** `AIAstra_Server/src/lib/pii/keys.ts:108-111` is a KMS provider stub that throws "not built yet", and
     `:161` refuses sealed mode on Lambda without KMS. Live `PII_MODE` is unset, so names, emails and birth data are
     stored in plain text on Render.
   - **Fix:** build the KMS provider (plan in `docs/privacy/02`), then set `PII_MODE` to sealed and backfill.
   - **Done when:** new and existing rows read back sealed, and the B0 tests pass.

4. **Any admin-role staff account can read full email and birth data, with no audit row.**
   - **Where:**
     - `aiadastra_admin/api/src/app.ts:529-541` registers `GET /api/admin/lab/people`, `/lab/people/:id` and
       `/chart-data/:id` without `superadmin`.
     - `api/src/admin/lab.ts:92-182` and `api/src/admin/chartData.ts:63-77` return the plain email, name and birth
       date, time and place.
   - **What happens:** this gets around the superadmin-only, audited `reveal-email` (`app.ts:403`). The QA exception
     was approved on 2026-11-07 and is already filed in `aiadastra_admin/docs/TODOS.md`. It scored 3/10 today because
     the data is test data, but it becomes a real authorization bypass once real users exist. SEC-03 (no audit row)
     is still present too.
   - **Fix:**
     - Add `superadmin` to those routes, or return `emailMasked` only.
     - Drop birth time and place from the bulk list.
     - Write an `admin_actions` row for every person read.
     - Bring back the `auth.research` consent check.
   - **Small related fix:** the `runLab` comment (`lab.ts:229`) says "superadmin only, checked by the route", but the
     route at `app.ts:538` does not check. Either add the check or correct the comment.

5. **One shared static token unlocks decrypted personal data for 200 users (SEC-04).**
   - **Where:** `AIAstra_Server/src/routes/adminLabRoutes.ts:60-66`, with a copy in
     `src/routes/adminNotificationRoutes.ts:36-42`.
   - **What happens:** `GET /api/admin-lab/people` (`:69-125`) and `/people/:userId` return the decrypted email, name
     and birth data. The routes are live (`ADMIN_LAB=1`). The token is long, so nobody can guess it, but anyone who
     ever sees it can read every user, and nothing ties a request to a staff member.
   - **Fix:**
     - Replace the token with a short-lived signed token that carries the staff id (or an IAM-signed call from the
       admin Lambda).
     - Log each read.
     - Rotate `ADMIN_LAB_TOKEN` now on both Lambdas.

## P2: real, can wait a sprint

6. **The Gemini API key is sent in the URL (`?key=`) (SEC-10).**
   - **Where:**
     - `AIAstra_Server/src/services/geminiCacheService.ts:203,222`
     - `src/services/geminiChatService.ts:346`
     - `src/reading/llm/gemini.ts:290,320`
     - `src/reading/llm/promptCache.ts:150,165,185,218`
   - **What happens:** URLs end up in logs, proxy history and error text.
   - **Fix:** send the `x-goog-api-key` header instead.

7. **Internal error text reaches users (SEC-05).**
   - **Where:**
     - `server.ts:179` (`maskedErrors: false`).
     - `server.ts:448` (`/query` `details: err.message`).
     - `src/routes/researchRoutes.ts:74`.
     - Most resolvers' `error:` fields in `src/graphql/schema.ts`.
   - **What happens:** Prisma and SQL messages and file paths can leak.
   - **Fix:** mask errors in staging and production, and send the detail to `app_error_events` for admin.

8. **The engine skips its API-key check when no key is configured.**
   - **Where:** `AIAstra_Radha/src/jhora/config.py:161-178` and `src/jhora/api.py:384-394`. When neither
     `PYJHORA_API_KEY` nor `PYJHORA_API_KEYS` is set, every request is allowed.
   - **What happens:** this is safe today only because the Lambda has no URL and is reached by IAM invoke alone. It
     becomes an open door if a Function URL or API Gateway is ever added.
   - **Fix:** refuse to serve when running on Lambda without a key.

9. **The GitHub deploy role trusts every branch of the Radha repo.**
   - **Where:** IAM role `aiastra-github-deploy` (live). Its trust includes `repo:sachinm/AIAstraRadha:*`, and the
     same role deploys Server, Web and Radha.
   - **What happens:** anyone with push access to Radha can push any branch with their own workflow and deploy over
     the API Lambda, skipping the `release-candidate-staging` protection.
   - **Fix:**
     - Pin the Radha entry to `:ref:refs/heads/release-candidate-staging`.
     - Better still, use one role per repo, each limited to its own Lambda or app.

10. **The cache-sweep event runs with no token check when the token is unset.**
    - **Where:** `AIAstra_Server/src/reading/llm/cacheSweep.ts:240-241`. `LLM_CACHE_SWEEP_TOKEN` is unset on the live
      Lambda, so the sweep event is accepted with no token.
    - **Fix:** refuse the event when the token is missing, as the digest, self-build and dasha events already do.
      Then set the token.

11. **The browser keeps the 7-day login token in localStorage, and the CSP lets the page connect to very broad hosts
    (SEC-07).**
    - **Where:**
      - `AIAstra_WEB/src/lib/graphql.ts:24,307`, and about 20 `src/lib/*Api.ts` files read the `'token'` key.
      - The `connect-src` in `customHttp.yml` allows `https://*.cloudfront.net`, `https://*.amazonaws.com`,
        `https://*.onrender.com`, and `http://localhost:*` / `ws://localhost:*`.
    - **What happens:** any XSS could read the token and send it to a host the attacker controls on one of those
      domains.
    - **Fix:**
      - Narrow `connect-src` to `api.vedic-astrology.app` and the one CloudFront host, and drop localhost from the
        production headers.
      - Later, move the session into an HttpOnly cookie.

12. **CORS falls back to accepting any origin, with credentials, when `CORS_ORIGINS` is empty (SEC-09).**
    - **Where:** `AIAstra_Server/server.ts:138-142,158`.
    - **What happens:** nothing on the live API today, because `CORS_ORIGINS` is set there.
    - **Fix:** make an empty list mean `origin: false` outside dev.

## P3: hardening and cleanup

13. **Revocation takes up to 30 seconds to reach every Lambda instance (SEC-12).** The in-memory TTL is set at
    `src/auth/requestAuth.ts:25`.
14. **No GraphQL query depth or complexity limits (SEC-06),** at `server.ts:174-180`. This is a DoS issue, not a data
    one.
15. **The Terraform Cognito client uses `prevent_user_existence_errors = "LEGACY"`** at
    `aiastra-aws-terraform/modules/cognito/main.tf:107`. That lets someone find out which emails are registered. Set
    it to `ENABLED` before applying.
16. **The Terraform does not describe the live infrastructure.** It has never been applied; IAM, edge, Amplify, ECR
    and secrets are placeholder comments. Until it is imported, every infra check has to be done against AWS itself.
17. **The Render static site, if still live, sends no CSP.** `AIAstra_WEB/render.yaml` and `public/_redirects` set
    none; only Amplify does.
18. **Redis is only planned, not running.** `docs/architecture/redis-evaluation.md` weighs Upstash, ElastiCache and
    Render Redis for Phase 4, and no Lambda has a Redis setting today. When one is chosen, it needs an auth token or
    ACL user, TLS in transit, and (for ElastiCache) a security group that admits only the Lambda's group. The API
    Lambda will then also need VPC access and a NAT to keep reaching Render, Gemini and Resend.
19. **Render Postgres: not reviewed.** Check that `sslmode=require` is set on every connection string, that inbound
    access is limited to known IPs (Lambda has no fixed egress IP, so this needs a NAT, a proxy, or acceptance of the
    risk), that the database user is not the owner/superuser for the app, and that backups are encrypted.

## Fixed since the earlier audit

- **SEC-08 (no CSP):** fixed. `AIAstra_WEB/customHttp.yml` sends a full CSP: scripts are limited to `'self'` and
  hashes, with no `unsafe-inline` or `unsafe-eval`, plus `frame-ancestors 'none'`, `object-src 'none'`, HSTS,
  `nosniff` and `X-Frame-Options: DENY`.
- **SEC-11 (prompt concatenation):** partly fixed. `src/services/groqChatService.ts:171-175` now sends the system prompt
  and the question as separate role messages.

## Checked and clean

- **IDOR:** every user-data resolver and route traced in the Server (chats, ask, clarify, notifications, timeline,
  lucky, v3 cards, self v2/v3, `/query`) takes the user id from the token.
- **Tokens and sign-in codes:**
  - The Server JWT is HS-signed with a secret of at least 32 characters, expires after 7 days and is checked against
    `token_version`.
  - Sign-in codes come from `crypto.randomInt`, are bcrypt-hashed, last 5 minutes and work once.
  - Admin tokens are pinned to HS256, the `aiadastra-admin` audience and `typ: staff`, and are checked against
    `admin_accounts`. App tokens are refused.
- **SQL injection:** none. The Server uses tagged-template `$queryRaw`, and its one `$executeRawUnsafe` has a constant
  string. The admin API binds every value, and its interpolated pieces are constants.
- **Code execution and path traversal:** none.
  - No eval, command execution or path traversal reached by requests in the Server, admin or Radha.
  - Radha's `eval` calls build names only from fixed internal lists.
  - Radha's dynamic import goes through the `CALC_VERSIONS` allow-list.
- **XSS:** none. The web and admin apps render model and user text through `react-markdown` without `rehype-raw`.
  Their only `dangerouslySetInnerHTML` renders SVG built in code.
- **Secrets:** no hardcoded secrets in tracked files in any of the five repos. Deploys use GitHub OIDC with no static
  AWS keys, and the only workflow that runs on pull requests has no `id-token` permission.
