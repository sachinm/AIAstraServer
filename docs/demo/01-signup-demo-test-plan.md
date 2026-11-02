# Sign-up test plan for the demo (2026-11-02)

Written 2026-11-01 late evening, US Pacific. Internal document: it names internal systems, so do not show it in the demo.

## 1. Start: what is true tonight

Checked live tonight unless marked otherwise.

| Area | Fact | What the person sees | Risk to the demo |
|---|---|---|---|
| vedic-astrology.app to the API | `OPTIONS /graphql` returns 204 with no `Access-Control-Allow-Origin`. The staging Amplify URL gets the header. The list is `CORS_ORIGINS` on Lambda `aiastra-server-api` (`server.ts:88`). | Sign-up, sign-in, pricing and chat all fail on the domain | **Blocker** |
| Sign-up email | User pool `us-east-1_x8CrXCth3` uses `COGNITO_DEFAULT`, capped at 50 emails a day for the account. Sign-up codes, resends and login codes all count. It ran out on 2026-11-01 at 20:28Z. SES has no verified identity. | "Today's limit, try tomorrow", and no code | **Blocker if used up** |
| Cloudflare check | Fails in the Claude built-in browser (600010). Never seen passing on the domain. The widget's allowed hostnames were not read. | "Security check failed" | **Unknown: test first** |
| API version | Live API branch is `faaa609` (2026-11-01 15:28). Local server `develop` is 12 commits ahead: rename, migration `20261102120000_brand_ai_adastra`, interview plan check. | Decline replies and emails may say the old name | Medium |
| Web version | Live is `1493220`, with the new name and sky. Not live: moving stars, date read-back, phone footer, audit fix (`fix/known-bugs-batch`). | Old footer, no read-back | Medium |
| Page delivery | Live, `/`, `/signin`, `/signup`, `/pricing` and `/dashboard/charts` all return the same 11,445-byte home page HTML, because the Amplify rules are not in. Only `/`, pricing, terms, privacy and refunds are prerendered; sign-in and sign-up stay out on purpose (they are not indexed). | A slow connection shows the home page before sign-in or the dashboard | **High: fixed by CloudShell step 3** |
| Chart route | The route is `/dashboard/charts`. `/dashboard/chart` has no route on the live site, so it falls through to chat. Redirect is on `fix/known-bugs-batch`. | Typing the singular lands on chat | Low |
| Plan limits | `/api/billing/plans` returns 20, 100 and unlimited. `PLANS_ENABLED` on the Lambda was not read. | The bar may not count | Medium |
| Sync time | Never measured on a real sign-up. The screen says "about 30 minutes" (`src/Auth/readyNotice.ts`). | A long wait on stage | **High: unknown number** |
| Capacity | Account Lambda concurrency is 10, shared by API, chart worker and sweep (relayed, not read from AWS). | Chat can throttle if several charts build at once | Low for one presenter |
| Country | `/api/billing/plans` returns `country: null`. | India visitors see dollars | Low: only matters if the demo shows India |
| Automated tests | Web 300 of 300, types 0 errors, walkthroughs pass, on a fake API. Server 1262 pass, 1 outdated test since fixed, 1 timing flake. | Nothing here touches real sign-up | They prove nothing about tomorrow |

**Nothing above proves a real sign-up works. That is what this plan is for.**

## 2. End goal

On a normal laptop browser and a real phone, on vedic-astrology.app:

1. The home page loads with the sky and moving stars, and says AI AdAstra.
2. Get Started leads to sign-up. The Cloudflare check passes on one tick.
3. The code arrives within 60 seconds.
4. Birth details save, and the page reads the date back by month name.
5. The chart progress screen shows, and chat opens in a time we have measured.
6. A question gets a real answer, and the bar moves from 0 to 1 of 20.
7. Profile, plan, timeline, settings and log out all work. Signing back in works.
8. No raw error, no old name and no internal engine name appears at any point.

If any step fails on stage, the presenter moves to the ready-made account within 30 seconds.

## 3. Deliverable

- Both repos deployed and frozen for the demo.
- A filled-in results table (section 8), saved as `docs/demo/02-results.md`.
- Measured sync times.
- Two ready demo accounts and a one-page presenter sheet (`docs/demo/03-presenter-sheet.md`).
- Every failure fixed or filed in `docs/TODOS.md`.

## 4. How it works when done

### Backend

1. `startSignup(input, turnstileToken)` checks the Cloudflare token, then Cognito `SignUp` sends the code. Spends **1 email**.
2. `verifySignupCode(email, code)` returns a session.
3. `completeProfile(input)` saves the birth details and calls `scheduleKundliSync`: an async self-invoke, with a 15-minute sweep as the backstop.
4. The worker pulls the chart from the engine in the background. `me.chart` reports its progress.
5. A chat question passes `QuestionGate.check`, then `reserve`, and is committed when the answer is delivered, or given back if it fails.

### API

| Call | Success | Errors the page must handle |
|---|---|---|
| `startSignup` | code sent | `EMAIL_EXISTS`, `SIGNUP_RETRY`, `SIGNUP_EMAIL_LIMIT`, failed security check |
| `verifySignupCode` | session | wrong or expired code |
| `completeProfile` | profile saved | validation by field |
| `me` | profile, chart status, plan | signed out |
| chat | streamed answer | 402 `quota_exhausted` |

### Frontend

Sign-up: name, email, terms, Cloudflare, then the code, then birth details, then the progress screen, then chat. Closing the tab after the code must bring the person back to birth details at next sign-in.

### UI/UX

- The ready notice must match the measured time. If "about 30 minutes" is wrong, change the wording before the demo.
- Date: "That is 4 May 1990", with "Did you mean 5 April 1990?" when both readings are real.

## 5. Architecture

```
Browser (vedic-astrology.app, Amplify release-candidate-staging)
  -> Cloudflare check (widget in the page, token checked by the API)
  -> CloudFront E3UPJNUU8APCT -> Lambda aiastra-server-api (CORS_ORIGINS, PLANS_ENABLED)
       -> Cognito user pool (sends the code, 50 a day)
       -> Render Postgres (accounts, kundlis, billing_accounts, question_usage)
       -> self-invoke worker + 15-minute sweep -> calculation engine Lambda
       -> reading models
```

**The domain and staging are one site.** Any push to `release-candidate-staging` changes the demo. Hence the freeze.

## 6. Ingredients

| Need | Who |
|---|---|
| CloudShell step 1 (CORS), plus the printed `PLANS_ENABLED`, in `docs/ops/2026-11-02-cloudshell-fixes.md` | Sachin |
| CloudShell step 5 (deployer key), so agents can read logs | Sachin, optional tonight |
| SES steps, started tonight. Do not count on approval by the demo | Sachin |
| Cloudflare dashboard: widget hostnames include `vedic-astrology.app` and `www` | Sachin |
| Deploys, and the rename migration | Deploy session |
| A real phone, a laptop browser, and access to the test mailbox | Sachin |
| Test emails `sachin+<random>@carbonlitesystems.com` | Agent writes them, Sachin receives |
| Read-only database queries for timing | Agent |
| One write: set a QA account's used count to 19 for the limit test (the account from test 15 only) | Agent, with Sachin's OK |

### Email budget: the hard limit

The daily reset time is unknown, so treat tonight and tomorrow as possibly one window. **The whole plan spends at most 15 emails, leaving 35 for the demo and for real visitors.** No other session or agent may run a real sign-up until the demo is over. If a failure wastes codes, stop and re-plan rather than retry.

## 7. Action steps in sequence

Tonight, each step about 10 minutes unless noted. 1 to 3 can run in parallel.

1. **Merge the web fixes** to `develop` once the running check passes. Agent. Done: merged, and all checks green on the merge.
2. **Open the domain.** Sachin runs CloudShell step 1. Done: the `OPTIONS` check returns `access-control-allow-origin: https://vedic-astrology.app`.
3. **Check Cloudflare hostnames.** Sachin. Done: both hostnames listed, and one tick passes on the domain in a normal browser, without submitting.
4. **Deploy.** Deploy session: migration, then server, then web. Done: `/health` is 200, the web bundle hash changes, stars show, and a decline reply says AI AdAstra.
5. **Run the first sign-up** (test 1, section 8). Sachin clicks, agent watches the database. Done: time recorded. **If it fails, stop and fix before spending another email.**
6. **Run the remaining tests** in order. Fix what breaks, redeploy, recheck only what changed.
7. **Fix the words.** Set the ready notice to the measured time. Agent.
8. **Prepare accounts.** One fully built account, plus a test of how a fresh one looks. Done: `queue_status` is completed, and a question answers.
9. **Start SES.** Sachin. Runs by itself from here. It is not a dependency for the demo.

Demo day:

10. **Freeze.** Agent tells the deploy session and all other sessions: no pushes to `release-candidate-staging` and no real sign-ups until the demo ends.
11. **Rehearse, 2 hours before.** One complete run on the presenter's machine and network, including a fresh sign-up. Spends 1 email.
12. **Go or no-go, straight after the rehearsal.** See the recommendation.
13. **Just before:** open the backup tab signed in to the ready account, and check `/health`.

## 8. Tests

Record pass or fail, the time, and a screenshot for each. "Email" is what the test spends.

| # | Test | Expected | Email |
|---|---|---|---|
| 1 | Full sign-up, laptop, on the domain | All of section 2. Record code arrival, then T1 (submit birth details to chat open), and T2 (to chart complete) | 1 |
| 2 | First question while the chart is still building | An honest answer or a clear wait message, no error | 0 |
| 3 | Question after the chart is complete | Real answer, 0 to 1 of 20, no internal engine name | 0 |
| 4 | Declined topic, e.g. a question about death | Fixed polite reply with the new name, not counted | 0 |
| 5 | Sidebar, charts page, profile tabs, plan, timeline, settings | Load with real data, basic kundli only in the sidebar | 0 |
| 6 | Log out, sign back in with a code | Returns to the same account and chart | 1 |
| 7 | Full sign-up on a real phone, on the domain | Same as 1. Footer does not cover the form | 1 |
| 8 | Sign up with an email already registered | Clear message, sign-in offered, no email sent | 0 |
| 9 | Wrong code, then the right one | Clear error, then success | 1 |
| 10 | Resend the code | Cooldown shows, the new code works | 1 |
| 11 | Close the tab after the code, sign in again | Back at birth details, nothing lost | 1 |
| 12 | Date: 04/05/1990, 31/02/1990, a future date | Read-back with the offer, then a clear error for each bad date | 0 |
| 13 | Place: small town, misspelt city, US city in summer | Correct place and timezone, or a clear request to fix it | 0 |
| 14 | Terms unticked, Cloudflare unticked, bad email | The right message each time, nothing sent | 0 |
| 15 | Used count set to 19: ask 2 questions | The 20th answers, then the upgrade card, earlier answers stay | 0 |
| 16 | Reload during the progress screen and during an answer | Recovers with no blank page or lost account | 0 |
| 17 | Pricing signed out and signed in; Terms, Privacy, Refunds | Right titles, prices and new name | 0 |
| 18 | Search every page for the old name and internal engine names | None | 0 |

Sign-in and the charts page:

| # | Test | Expected | Email |
|---|---|---|---|
| 19 | Sign in on the domain, laptop and phone, on a throttled connection | `/signin` never shows the home page first, and the code arrives within 60 seconds | 2 |
| 20 | Unknown email, wrong code, expired code at sign-in | A clear message each time, no raw error | 1 |
| 21 | After sign-in | Lands on the dashboard, session survives a reload and a new tab | 0 |
| 22 | `/dashboard/charts` on the built account | Charts load with real data from the API, no endless spinner | 0 |
| 23 | `/dashboard/charts` on a brand new account while the chart builds | A clear building state, then data with no manual refresh problem | 0 |
| 24 | `/dashboard/chart` typed by hand, signed in | Goes to `/dashboard/charts` | 0 |
| 25 | `/dashboard/charts` opened signed out | Goes to sign-in, with no flash of private data | 0 |
| 26 | Log out, then press Back | Stays signed out | 0 |

**Total: 9 emails, plus up to 3 for repeats after fixes, plus 1 rehearsal and 1 to 2 on stage: 15 at most.** The demo account's sign-in also costs 1 email each time, so stay signed in on the backup tab.

## 9. Phases

- **Phase 1, tonight: make it possible.** Steps 1 to 4.
- **Phase 2, tonight: prove it.** Steps 5 to 8.
- **Phase 3, demo day: protect it.** Steps 10 to 13.

## 10. Recommendation

**Do a live sign-up in the demo only if the rehearsal passes in full and T1 is under about 2 minutes.** Otherwise show the live sign-up only up to the progress screen, then move to the ready-made account. Either way, keep the ready account open in a second tab, and keep the freeze on until the demo ends.

Go on the domain only if step 2 and test 1 pass there. If they don't, use the Amplify staging URL, which already passes the CORS check.

## Open items

- Whether the code email's sender and wording look right to a viewer has not been seen.
- `MAIL_FROM` and `RESEND_FROM` on the Lambda were not read.
- Whether the sweep rule and self-invoke permission are live has not been confirmed. Test 1's T2 is the real answer: if T2 stalls past 20 minutes, suspect these first.
