# Sign-in / sign-up consent contract (18+ and Terms of Use)

Server branch: `feat/signup-signin-alerts` (worktree `wt/server-alerts-consent`). Web branch: `wt/web-otp-consent`.
Written 2026-11-08. This file is the contract between the two; change it in both places if it changes.

## Decision

The no-reproduction rule is a clause in the Terms of Use. The checkbox records acceptance of the whole Terms at one
version. Checkbox text (sign-in step 2, the code step):

> I am 18 or older and agree to the Terms of Use, including that I won't copy, record, or reproduce anything I see in the app.

## Current version

`CURRENT_TERMS_VERSION = '2026-11-08'`, exported from `src/auth/terms.ts`. Public GraphQL query, no auth needed:

```graphql
query CurrentTerms {
  currentTerms {
    version            # "2026-11-08"
    requiredOnSignIn   # true when the server enforces it on loginWithMagicLink (REQUIRE_TERMS_ON_SIGNIN=1)
    requiredOnSignUp   # true when the server enforces it on startSignup / verifySignupCode (REQUIRE_TERMS_ON_SIGNUP=1)
  }
}
```

The web should fetch this once when the sign-in or sign-up page mounts and send back the `version` it got. If the
query fails, send the version the web build was made with; the server then answers `terms_outdated` if it is stale.

## Mutations (new arguments are optional, so old web builds keep working)

```graphql
loginWithMagicLink(
  email: String!, code: String!, recaptchaToken: String, turnstileToken: String,
  termsAccepted: Boolean, termsVersion: String
): LoginResult!            # { success message code token user role }

verifySignupCode(email: String!, code: String!, termsAccepted: Boolean, termsVersion: String): LoginResult!

input StartSignupInput { name: String!, email: String!, turnstileToken: String, termsAccepted: Boolean, termsVersion: String }
# startSignup(input) -> SignupStartResult { success code message }
```

Send `termsAccepted: true` and `termsVersion: <currentTerms.version>` from the checkbox step. On sign-up, send them on
`startSignup` (page 1, where the existing "I am 18 or older and accept the Terms" box is) and again on
`verifySignupCode`.

## Answers the web must handle

Request `code` in the selection (`loginWithMagicLink { success message code token user role }`).

| `success` | `code`            | When                                                                                     | Web shows |
|-----------|-------------------|------------------------------------------------------------------------------------------|-----------|
| false     | `terms_required`  | enforcement is on and `termsAccepted` is not `true` or `termsVersion` is missing           | the message; tick the box |
| false     | `terms_outdated`  | enforcement is on and `termsVersion` is not the current version                           | refetch `currentTerms`, ask the person to tick again |
| false     | `ACCOUNT_LOCKED`  | unchanged                                                                                | unchanged |
| true      | null              | signed in; acceptance recorded                                                           | unchanged |

Messages (stable, safe to show as-is):
- `terms_required`: "Please confirm you are 18 or older and agree to the Terms of Use to continue."
- `terms_outdated`: "Our Terms of Use have changed. Please review them and tick the box again."

The terms check runs **before** the emailed code is checked, so a refused attempt does not use up the code: the person
ticks the box and submits the same code again.

When enforcement is off (the default until the web ships), missing or stale terms are not refused; whatever was sent
with `termsAccepted: true` is still recorded.

## What the server records

On a successful sign-in / sign-up verify with `termsAccepted: true` (and on `startSignup` once the pending account row
exists): `auth.terms_version`, `auth.terms_accepted_at`, `auth.age_confirmed_at` (now), plus an `account_events` row
`action = 'terms_accept'`, `after = { terms_version, flow }`.

## Rollout

1. Deploy session applies migration `20261108120000_auth_terms_acceptance` **before** the server code ships.
2. Server ships with `REQUIRE_TERMS_ON_SIGNIN` / `REQUIRE_TERMS_ON_SIGNUP` unset (off).
3. Web ships the checkbox and the new arguments.
4. Deploy session sets `REQUIRE_TERMS_ON_SIGNIN=1` and `REQUIRE_TERMS_ON_SIGNUP=1` on the API Lambda.
