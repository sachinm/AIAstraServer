# Sign-up and sign-in open instantly; the security check runs unseen (2026-11-04)

## Start (facts checked)

- Web `src/Auth/TurnstileGate.tsx` covers the whole page with "Getting things ready…" until Cloudflare Turnstile returns
  its first token. Nobody can type until then: one to several seconds, longer on slow phones.
- The widget is already `appearance: interaction-only` (`TurnstileField.tsx`), so most visitors never see a puzzle. After
  the first token the gate already shrinks to an unseen 1px box that stays in view, because Cloudflare does not run a
  widget below the fold.
- `SignUp.tsx` and `SignIn.tsx` call `turnstile.requireToken()` on submit and refuse with "Please complete the security
  check" if no token is there yet.
- `@marsidev/react-turnstile` 1.5.2 loads `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit`
  only when the widget mounts; `index.html` already preconnects to that host.
- The server checks the token on `startSignup`, `requestMagicLink` and `loginWithMagicLink`. Nothing changes there.

## End goal

The form is usable the moment the page draws. The check finishes while the person types. If they submit before it
finishes (browser autofill or a password manager can fill and submit in under a second), the request waits for the
token and goes on by itself, with no second click and no error.

## Deliverable

Web only, one branch merged to `develop`:

1. `useTurnstile` gains `waitForToken()`: returns the token now if there is one, otherwise waits for it (up to 20 s),
   and tracks whether Cloudflare wants the person to click (`needsInteraction`).
2. `TurnstileGate` stays an unseen 1px box by default. It opens as an overlay only when Cloudflare needs a click, when a
   submit has waited more than 1.5 s, or when the check failed while someone is waiting (with "Try again").
3. Sign-up and sign-in submit with `await turnstile.waitForToken()`. The button shows its normal busy state meanwhile.
4. Prewarm: pointing at, focusing or touching a link or button that leads to sign-up or sign-in fetches Cloudflare's
   script into the browser cache (`<link rel="prefetch">`), so the auth page starts the check sooner. Only on intent, so
   home-page visitors who never head for sign-up make no Cloudflare request.

## How it works when done

- **Backend / API:** unchanged; every request still carries a single-use token.
- **Frontend:** the gate no longer blocks. Single-use reset after each request is unchanged.
- **UI/UX:** form at once. Fast autofill submit: busy button, then the request continues. Slow check: after 1.5 s a small
  "Finishing the security check…" overlay; after 15 s "This is taking longer than usual" and "Try again". Puzzle needed:
  the overlay with the widget appears, as today.

## Steps

1. This plan. 2. `useTurnstile` waitForToken / needsInteraction. 3. Gate rules. 4. SignUp and SignIn submit paths.
5. Prewarm module, installed from `main.tsx`; `data-auth-intent` on the landing and pricing sign-up buttons. 6. Tests.
7. tsc, build, browser check, merge to develop with `--no-ff`. Release through the deploy session on Sachin's word.

## Recommendation

Ship this as is. Then add per-email and per-IP rate limits on code sends in the API (filed separately) — that is what
stops abuse; Turnstile stays as the invisible first filter.
