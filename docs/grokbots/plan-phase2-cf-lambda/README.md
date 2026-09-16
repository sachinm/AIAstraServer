# Plan: Phase 2 — Amplify → CloudFront → IAM Lambda

## Goal
Serverless GraphQL/streaming API behind CloudFront+WAF with **no** public Function URL (`AuthType NONE` / `Principal *`). Keep App Runner only until cutover, then retire.

## How this advanced the plan
Replaced always-on App Runner with CF→IAM Function URL + RESPONSE_STREAM; Kundli worker on EventBridge; Prisma via Render pooler.

## Steps / tests (done)
| Step | Test | Result |
|------|------|--------|
| ECR + API/worker Lambdas | SigV4 `/health`, GraphQL `__typename` | PASS |
| CF+OAC+WAF | Browser CF health/GraphQL + sha256 | PASS |
| X-Astra-Authorization + content-sha256 | CF auth smoke | PASS |
| Amplify cutover | Bundle host = CF; login→Kundli E2E | PASS after CORS OPTIONS fix |
| App Runner retire | Amplify/CF still 200 | PASS |

## Mistakes / learnings
- OPTIONS without CORS broke login (masked as “Unable to sign in”).
- ORP stripped `X-Astra-Authorization` until forwarded.
- See root [SKILLS.md](../SKILLS.md).

## Status
**COMPLETE.** Canonical API: `https://dzsm2dbswvuqy.cloudfront.net/graphql`.
