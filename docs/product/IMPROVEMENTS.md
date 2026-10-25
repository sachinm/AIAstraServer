# IMPROVEMENTS — from prototype to mass-consumer product

Dated 2026-10-24. What the app needs around the reading engine to serve a consumer audience, with India first. Each item has a priority (P0 now, P1 next quarter, P2 later) and the layer it touches. Market notes come from public app listings of Astrotalk, InstaAstro, Astroyogi, AstroSage and similar apps: their paid layer is per-minute chat/call with human astrologers plus kundli matching, daily horoscopes, remedies stores and many Indian languages; AI-first readings are still the exception, which is the opening for AI Astra.

## 1. Account and profile (P0)

| Item | Detail | Layer |
|---|---|---|
| Passwordless account | Email OTP via Cognito; Google later | web, infra — see `docs/grokbots/plan-cognito-auth` |
| Profile page | Name, email (change with re-verification), gender, language, timezone; **birth details** with the same controls as sign-up, "time unknown/approx" state, and a *Re-sync chart* action that rebuilds the dossier and invalidates caches | web, GraphQL `updateProfile`, worker |
| Multiple charts ("people") | The user's own chart plus family members and partners (name, relation, birth details); the chat has a "reading for: Me ▾" selector; compatibility and family questions pick two | Prisma `profiles` table (user_id, label, relation, birth fields, kundli_id); `kundlis.profile_id` |
| Conversations | Search, rename, pin, archive, delete; subject tags; "My readings" (saved answers) | Prisma `chats` metadata, `saved_readings` |
| Security | Set/change password (optional), remembered devices list with revoke, sign out everywhere, account deletion with data export (DPDP/GDPR) | Cognito + API |
| Notifications | Email digest of upcoming windows (weekly), transit alerts for the user's own chart ("Saturn enters your 10th on 12 Dec"), reading-ready email when a long reading finishes in the background | worker Lambda + SES |

## 2. Monetisation (P0 design, P1 build)

Two viable models in this market: **subscription** (what AI-first apps do) and **credits/wallet** (what astrologer-marketplace apps do). Recommendation: subscription for the AI readings, with a small credit wallet reserved for future human-astrologer sessions.

| Plan | Price point (test) | Includes |
|---|---|---|
| Free | ₹0 / $0 | 3 fast-lane questions per day, one full reading per week, own chart only, "How I read this" visible, ads-free |
| Plus | ₹299/mo or ₹1,999/yr · $4.99/mo | Unlimited fast lane, 30 full readings/mo, month-ahead reading every month, 2 extra people (family/partner), saved readings, PDF export |
| Pro | ₹699/mo · $11.99/mo | Unlimited full readings, compatibility and family readings, year-ahead (Tithi Pravesha) reading, priority models (argon synth on every reading), transit alerts, early features |
| Family | ₹999/mo | Pro for up to 5 people |

Mechanics: per-user daily budget already planned (`READING_DAILY_BUDGET_USD`) becomes plan-aware; `subscriptions` table (provider, plan, status, period_end, trial_end); entitlements resolved server-side per request; soft paywall at the point of value (after the Answer card, blur the body with "Unlock the full reading"); 7-day trial of Plus on sign-up.

Payments: **Razorpay** for India (UPI, cards, netbanking, recurring mandates), **Stripe** for the rest; webhooks → `subscriptions`; invoices by email; GST invoice fields for India. App-store billing only when native apps exist.

Cost guard: readings cost $0.01–0.10 each (file 05); Plus at ₹299 covers ~30 full readings with margin only if the fast lane handles the long tail, so the fast-lane classifier matters commercially, not just for latency.

## 3. Engagement features consumers expect (P1)

| Item | Why | Notes |
|---|---|---|
| **Personal daily/weekly outlook** | The daily horoscope is the habit loop in every competitor; ours is computed from the user's own transits (T9 template), not sun-sign boilerplate | generated nightly by the worker from `transit_snapshots` × natal points; cached per user; push/email |
| Upcoming windows calendar | A calendar view of the windows the engine has produced across readings ("Nov 2026 – Mar 2027: money, strong") | derived from `reading_runs.windows` |
| Kundli matching | Table-stakes in India; T8 template with Ashtakoota + Manglik + dasha overlap | needs `compatibility` export |
| Languages | Hindi first, then Tamil, Telugu, Kannada, Marathi, Bengali, Gujarati; synth writes in the user's language, Sanskrit terms kept | language in profile; prompts carry `language`; evals per language |
| Charts page upgrade | From raw tables to readable charts: North/South Indian chart drawing, house lords, dasha timeline with "now" marker, transits today | reads `kundli_facts` |
| PDF reading export | Share with family or an astrologer | server-side render of the reading card |
| Feedback loop | Thumbs + reason per reading; "was this accurate?" follow-up 30 days after a dated window | `reading_feedback`; feeds evals and marketing proof |
| Referral | Give a month of Plus, get a month | `referrals` table, codes |
| Onboarding | First reading generated automatically after sync ("Your chart in 60 seconds": T6 life-direction) so the first screen is value, not an empty chat | worker triggers a reading on sync completion |

## 4. Trust and safety (P0/P1)

- Policy lines in templates (no death, medical, legal, financial-advice, lottery promises); a visible disclaimer in the footer and on first use.
- "How I read this" with chart facts on every reading; a Charts page the user can check against any other software (same Lahiri ayanamsa) — this is the differentiator against black-box horoscope apps.
- Data protection: birth data is PII; encryption at rest already exists; add data export/delete, consent versioning, DPDP Act (India) and GDPR notices, retention for `reading_runs`.
- Abuse: Turnstile on sign-up, WAF rate limits, per-plan quotas, prompt-injection guard in intake (questions are classified, not executed).
- Minors: do not create readings for profiles under 18 except as "children" entries read through the parent's chart (policy from file 10 row 20).

## 5. Admin and operations (P1)

- Admin app: users, plans, usage and cost per user, reading runs with grounding results, prompt versions, feature flags, refunds.
- Dashboards: readings/day, p50/p95 latency per stage, cost per reading, cache hit rate, grounding failures, conversion free→Plus, churn.
- Support: impersonation with audit log, "re-sync chart", "regenerate reading", refund.

## 6. Platform (P2)

- Native apps (Expo/React Native) sharing the GraphQL/SSE API; push notifications for transit alerts; Apple/Google sign-in via Cognito.
- WhatsApp channel for the daily outlook and OTP (India).
- Human astrologer hand-off marketplace (already sketched in `docs/improvement-plan.md` §7): the reading run is the case file; per-minute wallet applies here.

## 7. What not to build now

- Panchanga, muhurta pickers, Prashna, remedies/mantras/gemstone stores (explicitly out of scope; remove the Remedies and Mantras nav items until there is a reading-grounded version).
- Live human chat/call (marketplace) before the AI reading is proven with the eval set.
- SMS OTP in India (DLT registration and cost) before the mobile app.
