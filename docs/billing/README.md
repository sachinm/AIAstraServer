# Plans, question limits, payments and locale

> November fundraising reference: [regional pricing experiments and revenue model](../fundraising/marketing-and-revenue.md). The offers there are proposals. This document describes the billing catalog and its design.

Written 2026-11-01. Sachin asked for: a free plan everyone starts on, a progress bar that holds across
conversations, a profile dropdown with an upgrade option, paid plans, USD and rupee prices by location, a language question at
registration (English or Hindi), a US | India switch on the homepage, and access decoupled from charging: a paid flag plus a
desired plan decide what a person can ask. The gateway is set up later.

Free has 20 questions a month. Plus is USD 50 a month or 500 a year for 100 questions a month. Unlimited is USD 200 or 2,000 with no limit. Limits come from env (`PLAN_FREE_QUESTIONS`, `PLAN_PLUS_QUESTIONS`), and each account stores its own `question_quota` and `questions_used_this_month`, which govern.

## 1. Start

Checked in the code on 2026-11-01.

| Area | Today |
|---|---|
| Billing | None in either repo. `docs/product/IMPROVEMENTS.md` section 2 has an older price test (USD 4.99, Rs 299), replaced by the prices above. |
| Question paths | `POST /api/chat/ask-stream` (`server.ts`), `POST /api/chat/confirm-stream` (`src/routes/clarifyRoutes.ts`), GraphQL `ask` (`src/graphql/schema.ts`), `POST /query` (`server.ts`, not called by the web). All reach `chatWithConfiguredProvider`. None has a limit. |
| Multi-part questions | The reading emits a `next` event and the web sends each later part back with `focus`. Each part is its own request. |
| Other paid-model routes | `POST /api/timeline/past-reading/generate` and `/ledger/interview`, behind `TIMELINE_ENABLED`. |
| Cost | About USD 0.02-0.03 a question and 0.07 a full reading, cap USD 0.30 on the oracle flow (doc 39). Single and graph flows have no cap (`docs/TODOS.md`). |
| Web menu | `TopNavigation.tsx` shows a name button and a separate logout icon. There is no dropdown. |
| Web state | `ProfileGate.tsx` holds `me` in context, which is the place for the plan. |
| Country | `auth.country_code` is the **birth** country, so it cannot set prices. No code reads the viewer's country. |
| Edge | CloudFront `E3UPJNUU8APCT`, OAC, AWS_IAM Function URL, cache disabled. Origin request policy `e1684868-...` was not read, because AWS credentials had expired. |
| Language | Web is English, with at least 114 hard-coded text nodes in `.tsx` files plus strings in `.ts` files. `AGENTS.md` says English only for now. |

## 2. End goal

- A new account starts on Free with 20 questions a month. Starting a new conversation does not change the count.
- The top navigation shows "2 of 20 questions used" on every signed-in page, and it moves when a question is asked. Charts, Remedies and Mantras/Horoscope moved into the profile menu.
- When the last question is used, the person sees an upgrade card, can still read all their old answers, and no model is called.
- The avatar opens a menu: name, email, plan, questions left, Upgrade plan, Profile, Log out.
- `/pricing` shows dollars or rupees by location. The homepage switch changes it.
- Registration asks for English or Hindi, and the choice is saved.
- **Nothing is charged yet.** Choosing a plan records it as desired, and the person stays on Free until `is_paid` is set. When the gateway arrives only the code that sets the flag is added.
- What can no longer go wrong: two tabs cannot both spend the last question, a failed answer costs nothing, and a client cannot get a free question by sending `focus`.

## 3. Deliverable

- Server: `src/billing/` (`plans.ts`, `store.ts`, `questionGate.ts`, `account.ts`, `gateway.ts`, `routes.ts`, `geo.ts`), the four question paths gated, GraphQL `me.plan`, `me.language` and `completeProfile.language`, `scripts/billing-set-paid.ts`, migration `20261101140000_billing_plans`.
- Web: `ProfileMenu`, `UsageBar`, `PricingPage`, `RegionSwitch`, `UpgradeCard`, a language field in registration, `src/i18n/`, `src/lib/region.ts`.
- Env: `PLANS_ENABLED`, `PLAN_FREE_QUESTIONS`, `PLAN_PLUS_QUESTIONS`, `DEV_GEO_COUNTRY` (local only).
- Tests for each of these.

## 4. How it works when done

### Backend

**Access rule, the only one.** Payment code writes the state; nothing else about payment is read.

```
effective plan = is_paid AND paid_plan set AND (paid_until empty OR paid_until > now) ? paid_plan : free
```

`billing_accounts` holds:

| Column | Meaning | Written by |
|---|---|---|
| `desired_plan`, `desired_interval` | What the person chose | `POST /api/billing/checkout` |
| `is_paid` | The flag | Payment side only |
| `paid_plan`, `paid_interval`, `paid_since`, `paid_until` | What the payment covers | Payment side only |
| `question_quota` | This account's monthly maximum, null for unlimited. Stamped from env when the plan is set; `--quota` overrides one account | Plan change |
| `questions_used_this_month`, `usage_month_start` | Usage in the current month | Gate |
| `billing_country` | Country at the time of choosing | Checkout |

`paid_plan` sits beside the flag on purpose. With only `is_paid` and `desired_plan`, a Plus subscriber who clicks Unlimited would get
Unlimited without paying. The payment side is `markPaid` and `clearPaid` in `src/billing/account.ts`. Today `scripts/billing-set-paid.ts`
calls them; a webhook will later.

**Limits.**

| Plan | Limit | Window |
|---|---|---|
| Free | `PLAN_FREE_QUESTIONS` (20) | Calendar month, UTC |
| Plus | `PLAN_PLUS_QUESTIONS` (100) | A month from `paid_since`, annual payers included. Unused questions do not carry over. |
| Unlimited | None | Counted for reporting only |

No number lives in the code. With plans on and either variable missing, the gate logs an error and allows the question, and `/api/billing/plans` returns 503.
Changing an env value affects accounts when their plan is next set, not existing rows. Unlimited has no abuse guard, at Sachin's request (`docs/TODOS.md`).

Roles `support`, `admin`, `superadmin`, `aiastra_admin` and `astrologer` are exempt.

**A question's life.**

1. Before anything else the route calls `checkQuestion`. Over the limit returns 402 and no model runs.
2. A clarify card costs nothing. The count comes when the answer starts.
3. `reserve` adds a `question_usage` row and increments with one conditional `UPDATE ... WHERE used < quota`. Postgres re-checks that condition under the row lock, so two tabs cannot both take the last question. It works on the pooler (`connection_limit=1`) because it needs no open transaction.
4. After `persistAskTurn` it commits. An error, or a declined topic, releases it and gives the question back.
5. A reservation older than 10 minutes is released on that person's next request. The Lambda limit is 300 s, so such a row belongs to a dead run. No scheduled job is needed.
6. Later parts of a multi-part question are free only if the server recorded them in `open_parts` when the first part finished, for 1 hour. A made-up `focus` is charged as a new question.
7. `confirm-stream` uses key `clarify:<runId>`, so a replay is not charged twice.

**Failure.** With `PLANS_ENABLED` off, nothing touches the tables, so code can ship before the migration. With it on, a database error in the
gate logs and lets the question through: a bug of ours should not stop a paying customer, and the per-question cost is small.

`POST /api/timeline/past-reading/generate` returns 402 `plan_required` on Free.

**Region.** `GET /api/billing/plans` picks in this order: `billing_country` of a paying account, the homepage switch (`?region=`), `CloudFront-Viewer-Country`, then USD. Only `IN` gets rupees.
The switch lets anyone see rupee prices. That is fine because the rupee gateway is set to Indian cards only.

### API

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/billing/plans` | Optional `?region=US\|IN` | `{ country, region, currency, plans[], gateway }`, `Cache-Control: no-store`, no auth |
| `POST /api/billing/checkout` | `{ plan, interval, region? }` | `{ status: "pending_payment" \| "redirect", checkout_url, plan }`. 400 `invalid_plan`, 401 |
| GraphQL `me.plan` | | code, desired, paid flag, interval, used, limit, remaining, window, resets_at, exempt; `limit` is null for Unlimited. Null when `PLANS_ENABLED` is off |
| GraphQL `me.language`, `completeProfile(input.language)`, `updateProfile(input.language)` | `en` or `hi` | Anything else is treated as `en` |
| Question routes | | 402 `{ code: "quota_exhausted", usage }`. SSE adds `{type:"usage", usage}` and `usage` on `done` |

### Frontend experience

- `UsageBar`: Free only, in the middle of `TopNavigation`, where the page links were. Reads `me.plan`, updates from SSE `usage`, re-reads on window focus for other tabs.
- `ProfileMenu`: replaces the name button and logout icon, on mobile too. Closes on Esc and on an outside click; arrow keys move through it.
- `ChatSection`: on 402 it shows `UpgradeCard` in place of the input.
- `/pricing`: public. Monthly and annual toggle. Signed out, the button goes to sign-up. Signed in, it calls checkout: a `checkout_url` redirects, otherwise it shows the saved state.
- Registration: a required language choice on the birth details page, default English, or Hindi if the browser language is `hi`.
- Homepage: a US | India switch with inline SVG flags, because Windows browsers show flag emoji as letters. It defaults to the detected country and is kept in `localStorage`.

### UI/UX words

| State | Words |
|---|---|
| Nav, questions left | "2 of 20 questions used" + Upgrade |
| Nav, one left | "1 question left" + Upgrade, amber |
| Nav, none left | "20 of 20 questions used" + Upgrade, red |
| Free used up | "You have used this month's 20 questions. They renew on {date}. Choose a plan to keep asking. Your earlier answers stay here." |
| Plus used up | "You have used this month's 100 questions. They renew on {date}." |
| Plan saved, no gateway | "We saved your choice of {plan}. Payments open soon, and you stay on the free plan until then." |
| Hindi chosen | "Hindi is coming soon. Until then, your readings and the app are in English." |

Prices use `Intl.NumberFormat`, so rupees group as Rs 1,00,000 in `en-IN`.

## 5. Architecture

```
Browser -> CloudFront (adds Viewer-Country) -> aiastra-server-api -> Postgres
                                                 |
                    question routes -> questionGate -> effective plan <- billing_accounts
                                                                              ^
                    today: scripts/billing-set-paid.ts ---- markPaid/clearPaid
                    later: gateway -> aiastra-billing-webhook ---^
```

**The webhook needs its own Lambda.** The API is an AWS_IAM Function URL behind OAC, and AWS requires `x-amz-content-sha256` on every POST. Stripe and Razorpay
cannot send it. So: a new `aiastra-billing-webhook` from the same image, Function URL auth NONE, mounting only the webhook routes, and verifying the
gateway signature on the raw body. Alternatives:

| Option | Verdict |
|---|---|
| Separate webhook Lambda | **Chosen.** Small, and the API stays private |
| Open the main Function URL | No. It exposes the whole API and bypasses WAF |
| Lambda@Edge to hash the body | No. More moving parts for one route |

**Modern payment approach when the gateway comes:** hosted checkout, so no card data touches our servers and wallets come from the gateway; signed, idempotent webhooks are the
only thing that sets `is_paid`; the return page is never trusted. `PaymentGateway` in `gateway.ts` is the seam, and `/api/billing/checkout` and the web do not change.

**Which gateway.** Stripe for USD. Razorpay for rupees if there is an Indian legal entity, because UPI matters there. Without one, Stripe's INR subscriptions, which reach
Visa and Mastercard only. Stripe lists psychic services and fortune tellers as prohibited in Japan and Thailand, not the US, and its list is not exhaustive. Get written confirmation from both.

**RBI limit.** Recurring debits above Rs 15,000 need extra authentication on each charge (RBI e-mandate framework, April 2026). At about Rs 95.5 to the dollar, straight conversion
puts Unlimited at Rs 19,100 a month, which would need an OTP every month. The default rupee prices below stay under the limit for monthly plans. Rupee annual plans are above it, so sell them as a one-time yearly payment with a renewal reminder.

## 6. Ingredients

| Need | Who |
|---|---|
| `i18next`, `react-i18next` | Installed by Haiku agent |
| Migration `20261101140000_billing_plans` | Agent writes; applying needs Sachin's OK |
| `PLANS_ENABLED=1`, `PLAN_FREE_QUESTIONS=20`, `PLAN_PLUS_QUESTIONS=100` on the Lambda | Deploy session, after the migration |
| `CloudFront-Viewer-Country` in the origin request policy | Deploy session |
| Rupee prices | Sachin. Defaults: Plus Rs 2,499 and 24,999; Unlimited Rs 9,999 and 99,999 |
| Legal entity, gateway accounts, keys | Sachin |
| `/terms`, `/privacy`, `/refunds` and contact pages | Needed for gateway approval (`docs/TODOS.md`) |
| Tax: US sales tax, GST | Sachin with an accountant; not settled here |

## 7. Action steps

1. Migration and Prisma models. Done: `prisma validate` passes.
2. `src/billing/`. Done: unit tests cover limits, races, release and continuation.
3. Gate the four question routes and the past-reading route. Done: route tests pass.
4. `me.plan`, language in the profile mutations. Done: `tsc` and tests.
5. Web `src/i18n`, `region.ts`, API client. Runs in parallel with 2-4, against section 4's API.
6. Web `ProfileMenu`, `UsageBar`, `UpgradeCard`, `PricingPage`, `RegionSwitch`, language field. Done: component tests.
7. Merge both into `develop`.
8. Deploy session: apply migration, add header, set `PLANS_ENABLED=1`, push.
9. Sachin sets up the gateway. Then add `PaymentGateway` implementations and the webhook Lambda.

## 8. Development phases

| Phase | Ships | Closed by | Deferred |
|---|---|---|---|
| 1. Limits and plans (this work) | Sections 2-4, no charging | Tests, then a staging account taken past its quota | Payment |
| 2. Gateway | Checkout, webhook Lambda, cancel and portal | A test-mode event sets `is_paid` | Tax automation |
| 3. Locale | All web strings moved to catalogs; date and time by locale; month shown by name on the birth date (`docs/TODOS.md` P0) | No hard-coded text left | Translation |
| 4. Hindi | Hindi UI catalog, then Hindi readings with evals | Evals per language, and `AGENTS.md`'s English rule changed | Other languages |

New UI uses the catalog from Phase 1, so Phase 3 only has to move the old strings.

## 9. Recommendation

Ship Phase 1 with `PLANS_ENABLED` off, apply the migration, then turn it on in staging. It is complete without a gateway, because access reads only the flag. Decisions that were made and can be changed:

- Free resets each calendar month. Existing users start at 0.
- One question is one thing the person asked: multi-part counts once, clarify rounds and failures do not count.
- Annual Plus gets 100 a month, not 1,200 at once.
- Hindi is stored and shown as coming soon; no Hindi text ships in Phase 1.
