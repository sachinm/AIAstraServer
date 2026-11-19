# AWS account security review (2026-11-18)

This review looks at the AWS side of AI AdAstra: account 442728149528, its security services, IAM, Lambda, edge,
Cognito, secrets, logging and the Terraform repo. It does not look at application code. For the app, see
[`assessment.md`](assessment.md) (SEC-01..SEC-12) and today's [`fix-list.md`](fix-list.md) (items 1–19). Where an AWS
fact here changes an item there, the item number is given.

The TODO list is at the end. Open items are also filed in [`../TODOS.md`](../TODOS.md) under "Filed 2026-11-18 by the
AWS account review".

## Scope and method

| | |
| --- | --- |
| Account | `442728149528` (AI AdAstra), in the organisation whose management account is `900515855120` |
| Access | `amplifyv2` profile, switching into `OrganizationAccountAccessRole` (session `readonly-security-review`) |
| Calls | Read-only: list, get and describe calls only. Nothing was created, changed or deleted |
| Region | `us-east-1` only. GuardDuty, Inspector, Config, Macie, Access Analyzer and Security Hub are regional, so other regions were not checked |
| Code | `aiastra-aws-terraform` (`develop`), the `.github/workflows` of Server, Web, admin and Radha, Dockerfiles, `customHttp.yml`, `.gitignore` / `.env*` files |
| Date | 2026-11-18 |

Each finding says where it comes from:

- **live**: read from the account today.
- **code**: read in a repo, with `file:line`.
- **doc**: stated in a doc and not confirmed.

Access key IDs, office IP addresses, secret values and secret ARN suffixes are left out on purpose. Every
environment-variable check read the names only, never the values.

## Summary

1. **None of AWS's security services is turned on in this account (live).** That covers GuardDuty, Inspector,
   Security Hub (both versions), Macie, Detective, Security Lake, IAM Access Analyzer and AWS Config. There is no
   CloudTrail trail. The 90-day CloudTrail event history still records management calls, but nothing keeps them past
   90 days, and nothing watches them.
2. **One chain matters more than the rest (live).**
   - The GitHub deploy role `aiastra-github-deploy` trusts every branch, tag and pull-request run of the Radha repo
     (`repo:sachinm/AIAstraRadha:*`).
   - The same role can read the configuration of, and replace the code of, every `aiastra-*` Lambda.
   - `aiastra-server-api` holds its secrets as plain environment variables: database URLs, the JWT secret, Gemini,
     Groq, Resend and Turnstile keys, `ADMIN_LAB_TOKEN`, and event tokens.

   So a workflow run from any Radha branch can read every server secret and ship its own API code. fix-list item 9
   covers the trust policy. This review adds that the role can read the secrets and replace the API code.
3. **Two long-lived IAM user keys are active, and neither user has MFA (live).** `aiastra-ops` has a key from
   2026-09-13, last used 2026-10-16. Its policy includes `amplify:*`, `apprunner:*`, read access to every secret in
   the account, creating and deleting `aiastra-*` Lambdas, and passing any `aiastra-*` role. The root user has no MFA
   recorded (`AccountMFAEnabled: 0`), and there is no account password policy.
4. **The edge is in place, but thin (live).** Both APIs sit behind CloudFront with OAC and `AWS_IAM` Function URLs,
   which is right. The API's WAF runs only the AWS Common rule set, with no rate limit. Neither WAF nor CloudFront
   keeps logs. The admin distribution still uses the default `*.cloudfront.net` certificate, which accepts TLS 1.0.
5. **The live Cognito pool runs with MFA off, self sign-up open and `LEGACY` user-existence errors (live).** It has
   18 users. fix-list item 15 refers to the draft Terraform; the same setting is live on the real pool.
6. **Terraform does not describe the account (code).** Most modules are one-line placeholders, the admin stack exists
   only as hand-built resources, and nothing has been applied.

## Findings

### 1. Security services

The table below shows only what is and is not configured.

| Service | State in us-east-1 | Source |
| --- | --- | --- |
| GuardDuty | No detector | live |
| Inspector | Account `DISABLED`; EC2, ECR, Lambda, Lambda code and code repository scanning all `DISABLED` | live |
| Security Hub CSPM | Not subscribed | live |
| Security Hub (V2) | Not subscribed | live |
| Macie | Not enabled | live |
| Detective | No behaviour graph | live |
| Security Lake | No data lake | live |
| IAM Access Analyzer | No analyzer | live |
| AWS Config | No configuration recorder | live |
| CloudTrail | No trail in this account, and no organisation trail visible from it. Only the 90-day event history | live |
| ECR scanning | Basic scan on push on all four repositories; registry scanning `BASIC` with no rules | live |
| CloudWatch alarms | None | live |
| Budgets | None returned for this account | live |
| Terraform | No CloudTrail, GuardDuty, Security Hub, Config, alarm or budget resources in any `.tf` file | code |

Not checked: whether the management account `900515855120` runs any of these with this account as a member, and any
Service Control Policies. A member account sees neither from its own side.

### 2. IAM

**A-1. The GitHub deploy role trusts every Radha branch (live).** The trust policy of `aiastra-github-deploy`:

- requires `aud` = `sts.amazonaws.com`;
- pins `AIAstraServer`, `AIAstraWeb` and `AIAstraRadha` to `ref:refs/heads/release-candidate-staging`;
- **also** allows `repo:sachinm/AIAstraRadha:*`.

The role's inline policies allow:

- ECR push and pull on `repository/aiastra-*`;
- `lambda:UpdateFunctionCode`, `GetFunction`, `GetFunctionConfiguration` and `PublishVersion` on `function:aiastra-*`;
- alias and version calls on the server and engine Lambdas;
- Amplify deployments on `aiastra-web`.

All three repos share this one role. Code: `AIAstra_Server/.github/workflows/deploy-api-lambda.yml:36` and
`AIAstra_Radha/.github/workflows/deploy-lambda.yml:17`. Neither workflow uses a GitHub `environment:`, and
`id-token: write` is granted at workflow level (code).

**A-2. The admin deploy role is scoped well (live).** `aiadastra-admin-github-deploy` trusts only
`release-candidate-staging` of the admin repo, in both the name form and the immutable-ID form of the subject. It can
push only to `aiadastra-admin-api`, pull from `aiastra-server-api`, update only the admin Lambda, and deploy only the
admin Amplify app.

**A-3. Two IAM users hold long-lived keys, and neither has MFA (live).**

| User | Keys | Last used | Policy |
| --- | --- | --- | --- |
| `aiastra-ops` | 1 active (2026-09-13) | 2026-10-16, STS | Managed `aiastra-ops` v3 (below) |
| `aiastra-ops-deployer` | 1 active (2026-10-25), 1 inactive | 2026-11-15, Lambda | Inline. ECR push to `aiastra-server-api`; get, configure and update code on `aiastra-server-api`; Amplify deploy on `aiastra-web`; its logs; invoke `aiastra-pyjhora` |

`aiastra-ops` v3 allows:

- `amplify:*` and `apprunner:*` on `*` (App Runner was deleted on purpose);
- `secretsmanager:GetSecretValue` on `*`, which includes the `aiadastra/admin/*` secrets;
- create, configure, update code, invoke and delete on `function:aiastra-*`;
- `iam:PassRole` on `role/aiastra-*`;
- `logs:*Put*` and `logs:Create*` on `*`.

Creating a Lambda and passing any `aiastra-*` role together let this key run code as `aiastra-api-lambda-exec`, which
holds the PII KMS key and the database secrets. The policy explicitly denies IAM user, key, policy and role changes.

The local `aiastra-ops` profile on this machine is rejected by AWS (memory `aws-working-commands`, 2026-11-18). So the
key that is still active in AWS is not the one stored here. `docs/TODOS.md` records that deployer keys were pasted into
chat on 2026-10-25. This review cannot tell which key ID that was.

**A-4. Root and account settings (live).**

- `AccountMFAEnabled` is 0: no MFA on the root user.
- This is a member account created by Organizations. Whether its root user has a password at all was not checked.
- No account password policy.
- `AccountAccessKeysPresent` is 0: the root user has no access keys.

**A-5. Admin access comes in through `OrganizationAccountAccessRole` (live).**

- The role trusts `arn:aws:iam::900515855120:root`, so any principal in the CarbonLite management account that is
  allowed `sts:AssumeRole` becomes full admin here. That includes the `amplifyv2` user.
- The admin stack was built through this role by hand (doc: `aiadastra_admin/docs/02-deploy.md:90`).
- There is also an Identity Center role, `AWSReservedSSO_PowerUserAccess_*`.

**A-6. The Lambda execution roles are scoped well (live).**

- `aiastra-api-lambda-exec`:
  - invokes only `aiastra-pyjhora`, `aiastra-dasha-deep-worker` and itself;
  - reads three named secrets;
  - uses one DynamoDB table, one KMS key (`GenerateDataKey` / `Decrypt` / `DescribeKey`) and one Bedrock model;
  - has an explicit deny on creating a URL or adding a permission on `aiastra-pyjhora`.
- `aiadastra-admin-api-exec` reads four named secrets.
- The engine role has only basic execution.
- The dasha deep worker shares `aiastra-api-lambda-exec` with the API. It therefore holds the same KMS and Bedrock
  rights, which it may not need.

### 3. Lambda

**L-1. Secrets live in plain environment variables (live).** The names below were read, not the values.

| Function | Secret-bearing variable names |
| --- | --- |
| `aiastra-server-api` | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GEMINI_API_KEY` (+2 more Gemini keys), `GROQ_API_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_LAB_TOKEN`, `ASTROKUNDLI_API_KEY`, `OVERLAY_ART_KEY`, `KUNDLI_SYNC_EVENT_TOKEN`, `KUNDLI_DIGEST_EVENT_TOKEN` |
| `aiastra-dasha-deep-worker` | `DATABASE_URL`, `DIRECT_URL`, `ASTROKUNDLI_API_KEY`, both event tokens |
| `aiastra-kundli-worker` | `DATABASE_URL`, `DIRECT_URL` |
| `aiadastra-admin-api` | `ADMIN_LAB_TOKEN`, `OVERLAY_ART_KEY` |
| `aiastra-pyjhora` | `PYJHORA_API_KEYS` |
| `aiastra-cognito-email-sender` | none; it reads `RESEND_SECRET_ID` from Secrets Manager at run time |

No function has a customer-managed KMS key for its environment, so the AWS-managed key is used. Anyone allowed
`lambda:GetFunctionConfiguration` on these functions sees the values. That includes `aiastra-github-deploy` (A-1),
`aiastra-ops` and `aiastra-ops-deployer`.

`docker-entrypoint.mjs:17-28` reads Secrets Manager only when a variable is unset (code). Secrets Manager holds a copy,
and the Lambda reads its own environment instead. The secret `aiastra/kundli-digest-event-token` has never been
accessed.

**L-2. Function URLs are right (live).**

- `aiastra-server-api` and `aiadastra-admin-api` use `AuthType: AWS_IAM`.
- Their resource policies allow `cloudfront.amazonaws.com` only, with `AWS:SourceArn` pinned to their own
  distribution.
- `aiastra-server-api` also allows two named EventBridge rules (`kundli-sync-sweep`, `kundli-digest-sweep`), each
  pinned by `SourceArn`.
- `aiastra-pyjhora` has no resource policy.
- fix-list "Facts from the live account" reports that the other four Lambdas have no URL. That was not re-read here.

**L-3. Limits and tracing (live).**

- No function has reserved concurrency; the account limit is 10 (`docs/TODOS.md`).
- `aiastra-server-api` has a 900 s timeout.
- X-Ray tracing is `PassThrough` everywhere, so no traces are recorded.

### 4. Edge: CloudFront, WAF, Amplify

| | API `E3UPJNUU8APCT` (`api.vedic-astrology.app`) | Admin `E2G3O5L4YYBUE3` |
| --- | --- | --- |
| Certificate | ACM, SNI, `TLSv1.2_2021` | Default `*.cloudfront.net`, `TLSv1` |
| Origin | Lambda URL with OAC | Lambda URL with OAC |
| Viewer protocol | redirect-to-https | redirect-to-https |
| Response headers policy | Set (contents not read) | None |
| WAF | `aiastra-api-edge`: default **Allow**, one rule: `AWSManagedRulesCommonRuleSet` | `aiadastra-admin-ip-only`: default **Block 403**, allow IPv4 list and one office IPv6 range |
| Rate-based rule | None | None |
| WAF logging | Not configured | Not configured |
| CloudFront standard logging | Off | Off |

Source for the table: live.

- The admin allow list depends on an office IPv6 prefix that the provider has already changed once
  (doc: `aiadastra_admin/docs/02-deploy.md:110-124`).
- The Amplify app `aiastra-web` sends HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy and a CSP (live). Its
  `connect-src` allows `https://*.cloudfront.net`, `https://*.amazonaws.com` and `https://*.onrender.com`, and in the
  production headers also `http://localhost:*` and `ws://localhost:*`. fix-list item 11 covers the broad hosts; the
  localhost entries are new.
- The admin Amplify app sends its own CSP, scoped to its CloudFront domain (live).

### 5. Cognito (live)

| Setting | Value |
| --- | --- |
| Pool | `aiastra-users-staging`, Essentials tier, 18 users, deletion protection active |
| MFA | Off |
| Threat protection (advanced security) | Not configured |
| Self sign-up | Allowed (`AllowAdminCreateUserOnly: false`) |
| Password policy | 8 characters minimum; upper, lower, number and symbol |
| Client `aiastra-web-staging` | `PreventUserExistenceErrors: LEGACY`, flows `USER_AUTH` and refresh, access token 60 min, refresh 30 days, revocation on |
| Custom email sender | Lambda `aiastra-cognito-email-sender`, with a KMS key whose rotation is **off** |

The client is public, so anyone can call Cognito sign-up and sign-in directly and skip the server's Turnstile check
and rate limits. `LEGACY` lets a caller find out which emails are registered.

### 6. Data at rest and images (live)

- **Secrets Manager:** 16 secrets. All use the AWS-managed key (no customer-managed key) and none rotates.
- **KMS:** the PII envelope key rotates yearly. The Cognito email-sender key does not rotate.
- **DynamoDB `aiastra-gemini-cache`:** default AWS-owned key; point-in-time recovery and deletion protection off.
  It is a cache, and it is off (`GEMINI_CACHE_ENABLED=0`).
- **ECR:** all four repositories have **mutable** tags and AES256 encryption; scan on push is basic.
  `aiastra-server-api` has no lifecycle policy.
- **Mutable Lambda Web Adapter image (code).** The image that runs as an extension inside the API and admin Lambdas is
  pulled from that mutable repository by tag: `aiastra-server-api:lambda-adapter-1.1.0` in
  `AIAstra_Server/Dockerfile.lambda:18` and `aiadastra_admin/api/Dockerfile.lambda:10`. Radha pushes `:latest`
  (`deploy-lambda.yml:44,48`). With A-1, any Radha branch can overwrite the adapter tag that the next API build pulls.
- **S3:** no buckets. The account-level public access block is not set.
- **EC2:** none running. Default VPC present. EBS encryption by default off.

### 7. Logging

| Log group | Retention |
| --- | --- |
| `/aws/lambda/aiastra-server-api`, `aiastra-pyjhora`, `aiastra-kundli-worker` | 14 days |
| `/aws/lambda/aiadastra-admin-api`, `aiastra-cognito-email-sender`, `aiastra-dasha-deep-worker` | Never expire |

Source: live. Terraform's `modules/lambda_server_api/variables.tf:37-41` also defaults retention to `null` (code). The
app logs may carry personal data; [`assistant-log-controls.md`](assistant-log-controls.md) covers what is written.

### 8. GitHub Actions and the repos (code)

- Actions are pinned by tag, not by commit SHA, in all five workflows: `checkout`, `configure-aws-credentials`,
  `amazon-ecr-login`, `setup-node`, `setup-python`.
- No workflow uses a protected `environment:`.
- Radha's deploy workflow does not run its tests (`tests.yml:3` says it should; `tests.yml:7` skips the deploy branch).
- There is no `pull_request_target` anywhere. `AIAstra_WEB` has no workflows.
- **Committed secrets:** none found in tracked files or git history of the five repos (AKIA/ASIA, PEM, `AIza`,
  `gsk_`).
- `AIAstra_Server/.env` holds live-format Gemini and Groq keys. The file is untracked and ignored.
- `AIAstra_Radha/.gitignore` has no `.env` rule. The two tracked `.env` files hold only `PYTHONPATH`.
- `AIAstra_WEB` commits `.env.production`, `.env.staging`, `.env.e2e` and `.env.development`, which today hold only
  public `VITE_*` values.

### 9. Terraform and docs out of step with the account (code / doc)

- Placeholders: `modules/iam`, `edge`, `ecr`, `secrets_data` and `dynamodb_gemini_cache` (`main.tf:1-2`). Only
  `lambda_server_api` and `cognito` define real resources, and the live Cognito pool was made by hand.
- `backend.tf.example` names a placeholder state bucket with `encrypt = true` and a lock table. No state backend
  exists, and the account has no S3 buckets.
- `docs/INVENTORY.md` (2026-09-17) gives a 300 s API timeout; live and `environments/prod/main.tf:44` give 900 s. It
  lists none of the admin stack: the Lambda, CloudFront `E2G3O5L4YYBUE3`, two WAF ACLs, two roles, the ECR repository,
  Amplify `d1qhwivm0xxltl` and the `aiadastra/admin/*` secrets.
- `docs/lambda-deployment.md:39` says the API deploy is manual only, but `deploy-api-lambda.yml:9-10` also runs on
  push.

## Not checked

- Regions other than us-east-1.
- The management account `900515855120`: organisation trail, delegated admins, SCPs.
- The contents of the API's response headers policy and origin request policy.
- The inline policies `aiastra-kundli-worker-inline` and `send` (Cognito email sender).
- KMS key policies and Secrets Manager resource policies.
- Whether the root user of 442728149528 has a password.
- Who holds the active `aiastra-ops` key.
- Render Postgres, which is outside AWS (fix-list item 19).

## TODOs

Priority follows `docs/TODOS.md` and gives the order of work. It is not a rating of the settings above. Each item
describes the end state only. Changes to the account need Sachin's OK, and apply runs through the deploy session.

### P1: before real users sign up

1. **Close the Radha wildcard on `aiastra-github-deploy`** (A-1; fix-list 9).
   - Done when the trust policy lists only `ref:refs/heads/release-candidate-staging` (or a protected `environment:`)
     for each repo.
   - Each repo has its own deploy role, limited to its own ECR repository and Lambda.
   - No deploy role can read the configuration of a Lambda it does not deploy.
2. **Move Lambda secrets out of plain environment variables** (L-1).
   - Done when `aiastra-server-api`, `aiastra-dasha-deep-worker`, `aiastra-kundli-worker`, `aiadastra-admin-api` and
     `aiastra-pyjhora` read secrets from Secrets Manager at start-up, using ARNs passed in the environment.
   - No database URL, JWT secret, provider key or token appears in `GetFunctionConfiguration` output.
   - Every secret that was exposed through the environment has been rotated.
3. **Retire the `aiastra-ops` IAM user**, or cut it down to read-only (A-3).
   - Done when no long-lived key can read every secret, create Lambdas, pass `aiastra-*` roles or use `amplify:*` /
     `apprunner:*`.
   - Humans use Identity Center (the PowerUser role already exists) and pipelines use OIDC.
4. **Settle `aiastra-ops-deployer` (A-3).**
   - Done when its active key has either been confirmed as never shared, or been replaced.
   - The inactive key is gone.
   - Its deploy jobs move to GitHub OIDC, after which the user has no key.
5. **Root user (A-4).** Done when the root user of 442728149528 has MFA, or the organisation's centralised root access
   removes its credentials, and an account password policy exists.
6. **A CloudTrail trail exists** (section 1).
   - Done when management events from all regions go to a trail with log-file validation into a bucket that is
     encrypted, versioned and closed to the public.
   - This can be an organisation trail from the management account that covers this account.
7. **GuardDuty is on in us-east-1** (section 1), with its findings readable by the deploy session and Sachin.
8. **Fix the live Cognito client and pool (section 5; fix-list 15).** Done when:
   - `PreventUserExistenceErrors` is `ENABLED`;
   - direct sign-up through the public client is either closed (server-side create only) or protected (threat
     protection or a WAF on the pool);
   - MFA is at least optional for users and required for staff accounts.
9. **Protect the Lambda Web Adapter image (section 6).** Done when the adapter comes from its own repository with
   immutable tags, both Dockerfiles pin it by digest, and the four app repositories use immutable tags.

### P2: next sprint

10. **Harden the API WAF (section 4).** Done when `aiastra-api-edge` has a rate-based rule and the KnownBadInputs and
    IP reputation managed groups, and WAF logs go to CloudWatch or S3.
11. **Give the admin CloudFront a custom domain with `TLSv1.2_2021` and a response headers policy** (section 4). Also
    replace the IPv6 office range with something that will not rotate, as `aiadastra_admin/docs/02-deploy.md`
    suggests.
12. **Set log retention on every Lambda log group** (section 7). Done when no group is "never expire" and Terraform's
    default is not `null`.
13. **Basic alarms and a budget exist** (section 1). Done when there are Lambda error, throttle and duration alarms on
    the API and engine, a monthly budget with an email to Sachin, and a root sign-in alarm once CloudTrail exists.
14. **Inspector covers ECR and Lambda** (section 1), so image and dependency CVEs show up without a manual scan.
15. **Pin GitHub Actions by commit SHA**, put deploy jobs behind a protected `staging` environment, and make Radha's
    deploy run its tests first (section 8).
16. **Give the dasha deep worker its own execution role** (A-6), without the PII KMS key and Bedrock rights unless it
    uses them.
17. **Remove `http://localhost:*` and `ws://localhost:*` from the production CSP** in `AIAstra_WEB/customHttp.yml`
    (section 4; the broad hosts are fix-list 11).

### P3: hardening and records

18. **Turn on rotation for the Cognito email-sender KMS key**, and decide on a customer-managed key for Secrets
    Manager and Lambda environments (section 6).
19. **Account-level S3 public access block on, and EBS encryption by default on** (section 6). These cost nothing and
    guard future resources.
20. **ECR lifecycle policy on `aiastra-server-api`** and the other repositories (section 6).
21. **IAM Access Analyzer (external access) and AWS Config** are on, so a public resource or an outside trust shows up
    without a manual check (section 1).
22. **Bring the account into Terraform** (section 9): IAM, edge, WAF, ECR, Secrets, Cognito and the admin stack, with
    an encrypted, locked state backend.
23. **Update `aiastra-aws-terraform/docs/INVENTORY.md` and `docs/lambda-deployment.md`** to the live account: the 900 s
    timeout, the admin stack and push deploys (section 9).
24. **Add `.env*` to `AIAstra_Radha/.gitignore`,** and a check in `AIAstra_WEB` that rejects any non-`VITE_` key in a
    committed `.env.*` file (section 8).
25. **Read what this review did not cover** (see "Not checked"), starting with the management account's trail and SCPs
    and the other regions.
