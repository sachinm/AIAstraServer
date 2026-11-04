# Deploy to staging, then freeze (2026-11-02, for the deploy session)

Sachin's words, 2026-11-02: "Yes, deploy now" and "build the plan right now ... deploy". vedic-astrology.app serves the
`release-candidate-staging` web build, so this push is also the public site. Demo is tomorrow.

## What goes out

| Repo | From | To | Commits ahead |
|---|---|---|---|
| Server | `develop` `7031f51` | `release-candidate-staging` (API Lambda `aiastra-server-api`) | 14 |
| Web | `develop` `8d722e6` | `release-candidate-staging` (Amplify app `d20sdo476h9w6c`) | 7 |

Server: the AI AdAstra rename, the plan check on `POST /api/timeline/ledger/interview` (402 `plan_required` on the free
plan), the optional Unlimited daily guard (`PLAN_UNLIMITED_DAILY_GUARD`, unset means off), test fixes, docs.
Web: the rename, the home page star map and moving stars, the birth date read-back, the phone footer, `/dashboard/chart`
redirect, the life reading flag on, 0 type errors, audit fix.

## Order

1. **Migrations first.** List what is applied in `aiastradb`, then apply every pending one in filename order. Expected
   pending: `20261101140000_billing_plans` (if not yet) and `20261102120000_brand_ai_adastra` (text replace in
   `declined_topics.reply` and `system_prompts.prompt`; non-destructive). Standing OK for migrations needed for testing;
   anything destructive, stop and ask Sachin.
2. **Server.** Push `develop` to origin, merge into `release-candidate-staging`, run the deploy workflow. Confirm image,
   `LastUpdateStatus`, and `/health` 200.
3. **Web.** Push `develop` to origin (it already contains origin's `88b69a6`), merge into `release-candidate-staging`.
   Record the Amplify job number and the new bundle hash.
4. **Do not change** Lambda env vars. Report, if readable: `PLANS_ENABLED`, `PLAN_FREE_QUESTIONS`,
   `PLAN_PLUS_QUESTIONS`, `TIMELINE_ENABLED`, `CORS_ORIGINS`. Sachin runs the CORS, Amplify rules and CloudFront steps
   from `docs/ops/2026-11-02-cloudshell-fixes.md` himself.

## Checks after

- `https://vedic-astrology.app/` has the star map (`data-test-id="constellation-sky"` in the HTML) and the shooting stars.
- A declined question's reply says AI AdAstra. `/dashboard/chart` goes to `/dashboard/charts` once signed in.
- `/api/billing/plans` still 200 with 20, 100 and unlimited.
- No sign-up or sign-in test: the Cognito email cap is 50 a day and the demo plan spends it (`docs/demo/01`).

## Freeze

After the deploy reports clean: no further push to `release-candidate-staging` in either repo, and no real sign-ups from
any session, until Sachin says the demo is over. A fix that cannot wait goes to Sachin first.

## Report back

Commit hashes deployed, migrations applied (names), Amplify job number, Lambda image tag, `/health`, anything that failed.
