# Login and registration — review and target design

Reviewed 2026-10-24 against the live web branch (`develop`, from `feature/turnstile_iPhone`) and the server `authService.ts`. The Cognito build-out that replaces the home-grown auth is in [`docs/grokbots/plan-cognito-auth/README.md`](../grokbots/plan-cognito-auth/README.md); this file covers what the forms must do regardless of the identity provider.

## 1. What exists today

**Sign-in** (`src/Auth/SignIn.tsx`): two modes, password (email or username) and "Email code" (8-character magic code, 5-minute TTL, bcrypt-hashed, sent via Resend or SMTP). Turnstile widget per form (currently disabled by env). Idle sign-out after 10 minutes with a notice. No forgot-password, no remember-device, no social sign-in, no account lockout UI. Tokens are the app's own 7-day JWT in `localStorage`.

**Sign-up** (`src/Auth/SignUp.tsx`): two steps. Step 1: full name, **age**, date of birth (native `<input type=date>`), place of birth (free text "City, Country"), time of birth (native `<input type=time>`), gender (default Male). Step 2: email, password (min 6), confirm password, Turnstile. The username is derived from the name (`name` with spaces removed, lowercased), so two people called Priya Sharma collide and the second gets "Username or email already exists". No email verification. No terms/privacy consent. No timezone capture. The place string is parsed server-side by a regex into `City,CC`; anything with a state ("Austin, Texas, USA") or an unlisted country maps to `ZZ` and the Python engine falls back to geocoding by whatever text it gets.

**Server** (`authService.ts`, `validators.ts`): password min 6, bcrypt; DOB/TOB/POB AES-encrypted when `ENCRYPTION_KEY` is set; signup enqueues the Kundli sync; no coordinates stored; `age` is accepted from the client and discarded.

## 2. Problems to fix (ranked)

1. **Age field**: redundant with DOB and wrong half the year. Remove.
2. **Place as one free-text line**: the single biggest source of wrong charts (wrong city, wrong country code, no timezone). Replace with country → state → city and store resolved lat/lon/tz.
3. **Native date input for a birth date**: on desktop Chrome it is a typing field with a tiny calendar; on iOS it is a drum that takes 30+ swipes to reach 1985. Needs a purpose-built birth-date control.
4. **Derived username**: collisions and confusion. Email becomes the identifier; display name is free text.
5. **No email verification, no forgot password**: both arrive with Cognito (email OTP sign-in makes "forgot password" disappear for most users).
6. **Password-first UX**: the magic-code path is already the better experience; make it the default and keep password as a secondary option.
7. **Time of birth is mandatory with no "unknown"**: many Indian users know only the approximate time or none. Add "approximate" and "unknown" states (noon default, flagged in the dossier so readings avoid Lagna-dependent claims).
8. **Consent and legal**: no terms, privacy or data-use consent for birth data (PII). Add a single checkbox with links.
9. **Gender default Male**: make it a choice with no default and an "Prefer not to say" option; it only affects a few classical rules (Jupiter as husband karaka), so it is optional.
10. **Two-step wizard**: with age and password gone, one scrollable page with three titled sections is shorter and converts better on mobile.

## 3. Target registration form

One page, three sections, one primary button. Autosave to `sessionStorage` so a Turnstile failure or refresh does not lose the entries.

### Section A — You
| Field | Control | Validation / behaviour |
|---|---|---|
| Full name | text | 2–80 chars; used as display name only |
| Email | email, `autocomplete=email` | RFC check; becomes the Cognito username; lowercased |
| Gender | segmented: Female / Male / Other / Prefer not to say | optional |

### Section B — Birth details
| Field | Control | Validation / behaviour |
|---|---|---|
| Date of birth | **Birth-date control**: three segmented boxes `MM / DD / YYYY` with a visible guide line under them ("mm / dd / yyyy"), auto-advance on 2/2/4 digits, backspace moves back, paste of `dd-mm-yyyy` or `yyyy-mm-dd` is parsed; a calendar button opens a popover whose header is a **year grid** (12 years per page, with `−10 y` / `−20 y` / `−30 y` / `−40 y` quick chips) then month, then day; typing and picking stay in sync | 1900 ≤ year ≤ today; reject future; locale order (`DD / MM / YYYY` for India/UK, `MM / DD / YYYY` for US) chosen from the country field when set, otherwise browser locale, always labelled |
| Time of birth | `HH : MM` segmented 24-h (or 12-h with AM/PM toggle by locale) plus a selector: **Exact · Approximate (±30 min) · Unknown** | Unknown → 12:00 stored with `tob_quality=unknown`; Approximate → `tob_quality=approx`; shown later in the profile with a "rectify" link |
| Country | searchable dropdown (ISO 3166-1, flag + name, keyboard typeahead), default from browser locale | required |
| State / province | dropdown, shown only for countries with first-level subdivisions we support (IN, US, CA, AU, BR, MX, DE, GB nations, CN, JP prefectures, NG, PK, MY, AE emirates …) | required when shown |
| City / town | text with autocomplete (debounced, from the server geocoder; free text allowed) | required; on blur the server resolves `city, state, country` → lat/lon/tz and shows a confirmation line under the field: "Chennai, Tamil Nadu, India · 13.08° N 80.27° E · IST (UTC+5:30)" with a "not right?" link that opens a manual lat/lon entry |
| Time zone at birth | read-only, derived from place and date (handles historical offsets); override via "not right?" | stored as numeric offset and IANA zone |

### Section C — Finish
| Field | Control |
|---|---|
| Consent | checkbox: "I agree to the Terms and Privacy Policy and to the use of my birth details for my readings" |
| Turnstile | invisible/managed mode, rendered at submit |
| Submit | "Create my account" → sends the email OTP (Cognito) → inline 6-digit code entry on the same page → signed in |

No password field at sign-up. Users who want a password set one later in Profile → Security (Cognito `ChangePassword` without previous password is allowed for passwordless users).

### Data captured (server)

`name, email, gender?, dob (ISO), tob (HH:MM:SS), tob_quality, country_code, state_code?, city, lat, lon, tz_offset, tz_iana, place_resolved (string), consent_version, signup_ip`. Coordinates are what the Python engine consumes; `place` text is kept for display only. This removes the per-request geocoding and the `ZZ` country fallback.

## 4. Target sign-in

Order on the page:

1. **Email** field + "Continue" → Cognito `USER_AUTH` with preferred challenge `EMAIL_OTP` → 6-digit code field appears inline (auto-submit on 6 digits, `autocomplete=one-time-code`, resend after 30 s, 3 attempts).
2. "Use password instead" link for users who set one.
3. "Continue with Google" (Cognito hosted federation, Phase 2 of the Cognito plan); "Continue with Apple" when the iOS app exists.
4. "Remember this device for 30 days" (Cognito remembered devices) — skips OTP on trusted devices.
5. Error copy stays non-enumerating ("If that email is registered, a code has been sent").
6. Turnstile in managed mode on the first step only.

Forgot password becomes "Sign in with email code" (already the primary path). Account recovery when the user lost the mailbox: contact support flow (admin can change email after verification) — out of scope for v1.

## 5. Standard login options checklist

| Option | Status | Decision |
|---|---|---|
| Email one-time code (passwordless) | exists (home-grown) | **Primary**, moves to Cognito EMAIL_OTP |
| Email + password | exists | Secondary, optional per user |
| Google | no | Phase 2 (Cognito IdP) |
| Apple | no | with iOS app |
| Phone OTP (SMS) | no | Not now: SMS cost and India DLT registration; revisit with the mobile app |
| Passkeys (WebAuthn) | no | Phase 3; Cognito supports `WEB_AUTHN` on the same choice-based flow |
| Remember device | no | yes with Cognito |
| Session idle sign-out (10 min) | exists | keep, but 30 min for the chat page (readings take time) and warn 60 s before |
| Turnstile | exists, disabled | enable on sign-up and first sign-in step; see Cognito plan for the PreSignUp hook |

## 6. Component plan (web)

- `src/Auth/fields/BirthDateField.tsx` — segmented inputs + year-grid calendar; props: `locale`, `value`, `onChange`, `min`, `max`. Unit tests for typing, paste, locale order, decade chips.
- `src/Auth/fields/BirthTimeField.tsx` — segmented time + quality selector.
- `src/Auth/fields/PlaceFields.tsx` — country (ISO list bundled, ~20 KB), state (bundled per supported country), city autocomplete (`GET /api/places/suggest?q=`), resolved-place line.
- `src/Auth/fields/OtpField.tsx` — 6 boxes, paste support, auto-submit.
- `src/Auth/SignUp.tsx` and `SignIn.tsx` rebuilt on these; `useTurnstile` kept.
- Server: `GET /api/places/suggest` (Nominatim with 1 req/s throttle and a Postgres cache of resolved places) and `POST /api/places/resolve` returning `{lat, lon, tz_offset, tz_iana, display}`; both unauthenticated but Turnstile- or rate-limited.
- Prisma: `auth` gains `name, country_code, state_code, city, lat, lon, tz_offset, tz_iana, tob_quality, consent_version, cognito_sub`; `username` becomes nullable and unused for new users.

## 7. Acceptance tests (for TEST.MD)

1. Sign-up with DOB typed `27 / 04 / 2002` in India locale produces `2002-04-27`; the same digits in US locale are rejected with a clear message.
2. Year grid: from the calendar header, `−40 y` lands on 1986 and the month view opens.
3. Place: "Chennai" + Tamil Nadu + India resolves to 13.08/80.27/+5.5 and shows IST; "Austin" + Texas + United States resolves to −5/−6 with the correct historical DST for the birth date.
4. Time unknown → chart syncs with `tob_quality=unknown`; the first reading avoids Lagna claims and says so.
5. Sign-in by email code on a new device, then "remember device" skips the code next time within 30 days.
6. Two users with the same name can register.
7. Turnstile failure blocks submit with a visible message and does not clear the form.
8. Screenshots per step under `docs/screenshots/auth-registration/NN-step.png`.
