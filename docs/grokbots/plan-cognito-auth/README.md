# Plan: Cognito passwordless auth (email OTP)

**Status:** proposal, 2026-10-24. Replaces the home-grown JWT + magic-code auth with an Amazon Cognito user pool where **email is the username** and **a one-time code by email is the primary sign-in**. No password is required at any point; users may add one later. Facts below were read from the Cognito developer guide (authentication flows and choice-based sign-in pages) on 2026-10-24.

Form and field requirements live in [`docs/product/auth-registration-review.md`](../../product/auth-registration-review.md).

## Goal

1. Sign-up: email + profile + birth details → Cognito sends a verification code → user enters it → account confirmed, email verified, **signed in** in the same step.
2. Sign-in: email → code by email → signed in. Password optional. Remember-device for 30 days.
3. The API trusts Cognito tokens; the app JWT and the magic-code tables are retired after migration.
4. Existing users keep their accounts and sign in with the email code without ever setting a password.

## How Cognito does this (verified)

- **Choice-based authentication** (`AuthFlow=USER_AUTH`) with `PREFERRED_CHALLENGE=EMAIL_OTP`. Cognito emails a code and returns `ChallengeName: EMAIL_OTP`; the app answers with `RespondToAuthChallenge` (`EMAIL_OTP_CODE`). Requires the app client to allow `ALLOW_USER_AUTH` and the user pool to be on the **Essentials** (or Plus) feature plan; `EMAIL_OTP` is not available on Lite.
- **Sign-up without a password**: when passwordless first factors are enabled, users can sign up without a password and administrators can create users without passwords. Confirming sign-up with the emailed code marks the email verified and the user `CONFIRMED`, and the `Session` from `ConfirmSignUp` can be passed to `InitiateAuth` (`USER_AUTH`) to **sign the user in immediately** with no second code.
- **OTP users and passwords**: users without a password can call `ChangePassword` without `PreviousPassword` to set one later. Passwordless first factors are not compatible with *required* MFA, so MFA stays off (or optional) in the pool.
- **Amplify JS v6**: `signIn({ username: email, options: { authFlowType: 'USER_AUTH', preferredChallenge: 'EMAIL_OTP' } })` → `nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE'` → `confirmSignIn({ challengeResponse: code })` → `DONE`.
- **Email delivery**: the Cognito default sender is limited to a small daily quota (50 messages/day by AWS documentation) and a fixed from-address; production must use **Amazon SES** (verified domain, `no-reply@` sender, DKIM) configured on the pool. SES sandbox exit is a prerequisite.

The "temporary strong password until the user verifies their email" from the brief is unnecessary under this flow: Cognito itself handles the unverified state (`UNCONFIRMED` until the code is entered), and no password exists to leak. If a password option is wanted on day one, the Profile page offers "Set a password" after sign-in.

## Architecture

```
Browser (React, aws-amplify v6 Auth only)
  signUp / confirmSignUp / signIn(USER_AUTH, EMAIL_OTP) / confirmSignIn / fetchAuthSession
        │  ID + access + refresh tokens (Amplify stores and refreshes)
        ▼
CloudFront → Lambda aiastra-server-api
  X-Astra-Authorization: Bearer <Cognito access token>
  verify with aws-jwt-verify (JWKS cached) → claims.sub → auth.cognito_sub → user row
```

- **User pool** `aiastra-users` (us-east-1, Essentials plan): username attributes = `email`; required standard attributes `email`, `name`; sign-in options `EMAIL_OTP` + `PASSWORD`; MFA off; self-registration on; email via SES; account recovery = email only; deletion protection on; advanced security "audit" mode (free) for sign-in logs.
- **App client** `aiastra-web` (public, no secret): `ALLOW_USER_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH` (and `ALLOW_USER_SRP_AUTH` for the optional password path); token validity: ID/access 60 min, refresh 30 days; remembered devices "user opt-in" with device remembering on.
- **WAF** on the user pool (Cognito supports web ACL association): rate-based rule on sign-up and InitiateAuth per IP (e.g. 100 / 5 min) to stop OTP spam; the existing `aiastra-api-edge` ACL protects the API.
- **Lambda triggers**: `PreSignUp` verifies the Turnstile token passed in `clientMetadata` (siteverify call), rejects on failure, and does **not** auto-confirm (the OTP confirms). `PostConfirmation` creates/links the Postgres `auth` row (`cognito_sub`, email, name) and enqueues the Kundli sync when birth details are present. `CustomMessage` (optional) brands the OTP email.
- **Profile data stays in Postgres**: Cognito holds only identity (email, name, sub). Birth details, consent, coordinates are written through the API after sign-in (`completeProfile` mutation), not as Cognito custom attributes, so the chart data never leaves our DB.
- **Server**: `src/auth/cognitoVerifier.ts` (aws-jwt-verify, `tokenUse: 'access'`, client id check); `buildContext` accepts a Cognito access token **or** the legacy app JWT while `AUTH_LEGACY_JWT=1`; `auth.cognito_sub` unique column; GraphQL `login/signup/requestMagicLink/loginWithMagicLink` marked deprecated and removed when the flag is turned off.

## Migration of existing users

1. Export `auth` rows (id, email, name). For each, `AdminCreateUser` with `Username=email`, attributes `email`, `email_verified=true`, `name`, `MessageAction=SUPPRESS`, **no temporary password** (allowed with passwordless enabled). Write `cognito_sub` back.
2. Duplicate emails in `auth` (the current schema does not enforce uniqueness): resolve manually before import; a script lists them.
3. Users sign in with the email code; nothing to reset. Their old bcrypt password stays unused and is dropped with the legacy flag.
4. Admin and superadmin: same pool, `cognito:groups` = `admin` / `superadmin`; the API maps groups to the existing `role`.

## Web changes

- Add `aws-amplify` (Auth category only; tree-shaken) and `Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId, loginWith: { email: true } } } })` from `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_CLIENT_ID`.
- `apiHeaders.ts`: `X-Astra-Authorization: Bearer ${(await fetchAuthSession()).tokens.accessToken}`; drop `localStorage.token`.
- `SignUp.tsx`: collect form → `signUp({ username: email, options: { userAttributes: { email, name }, clientMetadata: { turnstileToken } } })` (no password) → `confirmSignUp({ username, confirmationCode })` → `autoSignIn()` → `completeProfile` mutation with birth details → `/dashboard`.
- `SignIn.tsx`: email → `signIn` (EMAIL_OTP) → code → `confirmSignIn`; "Use password" → `signIn` with `authFlowType: 'USER_SRP_AUTH'`; `rememberDevice()` toggle after success.
- Session idle timer stays client-side; sign-out calls `signOut()`.

## Infrastructure (Terraform, `aiastra-aws-terraform/modules/cognito`)

`aws_cognito_user_pool` (sign_in_policy allowed_first_auth_factors = EMAIL_OTP, PASSWORD; email_configuration SES; user_pool_tier ESSENTIALS; schema email+name; account_recovery email), `aws_cognito_user_pool_client` (explicit_auth_flows ALLOW_USER_AUTH, ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH; token validities), `aws_cognito_user_pool_domain` (only if hosted federation is added later), `aws_wafv2_web_acl_association` to the pool, Lambda triggers (`aiastra-cognito-presignup`, `aiastra-cognito-postconfirm`, Node 22 zip, env from SM `aiastra/server-env`), SES identity + DKIM for the sending domain, IAM for Cognito → SES. Outputs: pool id, client id (into `aiastra/web-env`). Draft only; no apply without Sachin.

**Cost**: Essentials plan is priced per monthly active user above a free allowance (10,000 MAU on the public pricing page at the time of writing; confirm on aws.amazon.com/cognito/pricing before launch). SES ≈ $0.10 per 1,000 emails. Both negligible at current scale.

## Phases

| Phase | Work | Gate |
|---|---|---|
| C0 | Terraform draft of pool/client/WAF/SES; SES domain verification request; decide sending domain | Sachin approves domain and apply |
| C1 | Server verifier + dual-token context (`AUTH_LEGACY_JWT=1`); `cognito_sub` column; `completeProfile` mutation; PostConfirmation trigger | existing login still works; a test Cognito user can call GraphQL |
| C2 | Web sign-up/sign-in on Amplify with the new form (fields per the review doc); Turnstile via PreSignUp | TEST.MD items 1–8 of the review pass with screenshots |
| C3 | Migrate existing users (script), announce, flip `AUTH_LEGACY_JWT=0`, remove magic-code code and tables | zero legacy logins for 7 days before removal |
| C4 | Google sign-in (Cognito IdP), remember-device UI, passkeys | product call |

## Risks

- **SES sandbox**: until production access is granted, codes reach only verified addresses. Request access in C0.
- **Email deliverability**: OTP emails landing in spam kills sign-up; DKIM + SPF + DMARC on the sending domain, short plain subject, no marketing content.
- **Lock-in of identity**: keep `email` as the stable key in Postgres and `cognito_sub` as a mapping, so a future IdP change is a re-map, not a migration.
- **Feature-plan drift**: Essentials is required for `EMAIL_OTP`; the Terraform `user_pool_tier` pins it so a console edit cannot silently downgrade.

## Server adapter: switching and rollback

The server side of C1 is in place behind one switch; `src/auth/emailCode.ts` is the only file that knows which provider is active, so `authService` and the GraphQL schema are unchanged (`requestMagicLink`, `loginWithMagicLink`, `signup` keep their responses and the `EMAIL_EXISTS` code). The server still issues its own session JWT after a successful check.

| Env var | Meaning |
|---|---|
| `AUTH_PROVIDER` | `local` (default, legacy 8-character server code) or `cognito` |
| `COGNITO_CLIENT_ID` | required with `cognito`; the app client (public, no secret) |
| `COGNITO_USER_POOL_ID` | read for the token verifier; the adapter calls address the pool through the client id |
| `COGNITO_REGION` | default `us-east-1` |
| `COGNITO_SIGNUP_RANDOM_PASSWORD` | `1` only if the pool is not passwordless-enabled (SignUp then sends a random password nobody sees) |

**Switch on:** set `AUTH_PROVIDER=cognito` (plus the ids above) in the Lambda environment, then redeploy through the deploy session. **Rollback:** set `AUTH_PROVIDER=local` (or remove it); no data change is needed, accounts keep their stored random password hash and the local code path is untouched.

Behaviour with `cognito`:

- `signup`: refuses a duplicate email in Postgres, writes the `auth` row (random password hash as today), **then** calls Cognito `SignUp` with the email (and `name` = username) and **no password**; Cognito emails the confirmation code. If Cognito refuses, the new row is deleted so nothing is left on either side: a Cognito `UsernameExistsException` returns `EMAIL_EXISTS`, any other failure returns the retryable code `SIGNUP_RETRY` and a retry does not say "email taken".
- `requestMagicLink`: if an `auth` row exists, `InitiateAuth` with `AuthFlow=USER_AUTH`, `PREFERRED_CHALLENGE=EMAIL_OTP`; Cognito emails the code. The returned `Session` is parked in `auth.cognito_session` / `cognito_session_expires_at` (migration `20261025150000_auth_cognito_session`, **apply it before switching to `cognito`**; the local provider keeps using `magic_link_*`), because request and verify are separate calls. A user who never confirmed sign-up gets a fresh confirmation code instead (`ResendConfirmationCode`). An account that predates Cognito (InitiateAuth reports the user does not exist) gets its Cognito user created lazily with the public `SignUp`, which emails a confirmation code; no admin rights or migration script are needed. Unknown emails do nothing. All cases return the same message.
- `loginWithMagicLink`: with a parked session, `RespondToAuthChallenge` (`EMAIL_OTP_CODE`); without one, the code is treated as the signup confirmation code (`ConfirmSignUp`). Success returns the matching `auth` row (case-insensitive email, nothing is created) and the server issues its JWT. Wrong, expired or unknown gives the usual failure message.
- Cognito tokens are returned by the client wrapper but not used yet; the API still trusts only the server JWT until the verifier lands (C1 later step).

**Pool assumptions the code makes** (build the Terraform to match): Essentials or Plus feature plan; `EMAIL_OTP` in the allowed first factors (with `PASSWORD` if wanted); an app client with **no secret** and `ALLOW_USER_AUTH` in its explicit auth flows; passwordless sign-up enabled (else use `COGNITO_SIGNUP_RANDOM_PASSWORD=1`); username attribute `email`, self-registration on, `name` writable (required or optional); email sending configured (SES in production; the default sender is capped at about 50 per day); MFA off or optional; no Lambda trigger that auto-confirms users, or the signup code step is skipped. Cognito signup codes are 6 digits and sign-in codes are 8 digits, and the sign-in session lasts 3 minutes by default (app client `AuthSessionValidity`, up to 15). Lazy creation of old accounts relies on InitiateAuth returning `UserNotFoundException` for an unknown user, so set the app client's `PreventUserExistenceErrors` to `LEGACY` (with `ENABLED` Cognito hides the difference and returns a decoy challenge, so old accounts would never be created). The server messages no longer name a code length or expiry; accepted codes are digits or letters and digits, 4 to 10 long with `cognito` and the 8-character server code with `local`.
