# Product review docs

Written 2026-10-24 alongside the reading-engine plan. These cover the product surface around the readings; the reading method itself is in [`../reading-engine/`](../reading-engine/README.md).

| File | What |
|---|---|
| [auth-registration-review.md](./auth-registration-review.md) | Review of today's sign-in/sign-up, the target registration form (no age, country → state → city, birth-date control with typed `mm / dd / yyyy` and decade jumps, time-of-birth quality, consent, Turnstile), standard login options checklist, component plan, acceptance tests |
| [../grokbots/plan-cognito-auth/README.md](../grokbots/plan-cognito-auth/README.md) | Cognito passwordless (email OTP) build-out: pool/app-client settings, Amplify calls, server token verification, user migration, Terraform module, phases |
| [chat-interface-review.md](./chat-interface-review.md) | Review of the chat page and sidebars with specific changes: reading card, scroll behaviour, sidebar sizes and memory, Enter-to-send, subject chips, theme tokens, streaming order, tests |
| [IMPROVEMENTS.md](./IMPROVEMENTS.md) | Mass-consumer roadmap: profile and multiple charts, subscriptions and payments (Razorpay/Stripe), engagement features, trust and safety, admin, platform, and what not to build |

Related reading-engine additions from the same review: [09-response-templates.md](../reading-engine/09-response-templates.md) (ten response templates, summary-first), [10-subject-prompt-matrix.md](../reading-engine/10-subject-prompt-matrix.md) (per-subject prompt rows with the data each needs from the Python engine), [11-analysis-methods.md](../reading-engine/11-analysis-methods.md) (triangulation, deciders, fortune tier, agent responsibilities).
