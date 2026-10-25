# Landing page and registration — wording and interaction polish

Dated 2026-10-24. Sachin's ask: the front page and the registration process should read better and feel less clunky; smooth, suave, professional, slick. This complements `auth-registration-review.md` (fields and flow) and `celestial-backgrounds.md` (visuals) with **copy** and **micro-interaction** rules, and a rewrite of the current screens.

## 1. What the live site says today (production, 2026-10-24)

Nav brand "Cosmo Vedic" (the dashboard nav says "Cosmic Vedic", the server says "AdAstra", the repo says "AI Astra"); a pulsing badge "Precision Vedic Astrology"; hero "Discover Your Cosmo Blueprint / Through Vedic Wisdom"; body "Unlock the ancient secrets of Jyotish (Vedic Astrology) to navigate life's challenges, fulfill your dharma, and align with Cosmo rhythms. Our AI-powered platform combines timeless wisdom with modern technology for personalized guidance."; buttons "Generate My Chart" and "Explore Vedic Wisdom"; lower sections with purple-to-pink gradient headlines, hover-scale buttons, blur blobs, twinkling dots. Sign-in: "Welcome Back / Sign in to continue your cosmic journey". Sign-up: "Create Account / Enter your birth details for personalized insights", two-step wizard, "Creating Account…".

Diagnosis: four different brand names; "Cosmo" is a typo of cosmic; the copy is generic ("unlock ancient secrets", "cosmic journey") and promises nothing concrete; the visual language (gradient text, pulse, scale-on-hover, blur blobs) reads as a template; the wizard adds a click and a progress indicator for a form that fits on one screen.

## 2. Voice and copy principles

- **One name**: pick it once (recommendation: **AI Astra**, matching the repos and AWS resources) and use it everywhere: nav, title tag, emails, footer. Remove "Cosmo/Cosmic Vedic" and "AdAstra" from UI strings.
- **Concrete over mystical**: say what the product does (reads your birth chart, tells you what is happening and when it changes, shows its working). No "unlock the secrets", no "cosmic journey", no "destiny".
- **Short sentences, plain verbs, dates**: the same rule as the readings (file 09).
- **Sanskrit with care**: Jyotish, Lagna, Dasha appear with a two-word gloss on first use; never as decoration.
- **No claims we cannot show**: drop "Precision", "Trained on ancient astrological texts", "Powered by Vedic AI". Replace with the one real differentiator: every reading shows which charts and periods it used.
- **Second person, present tense**: "Your chart", "You will see".

### Hero rewrite (choose one)

Option A (direct):
> **Your Vedic chart, read properly.**
> Ask about work, money, relationships or timing. AI Astra reads your D-1 and divisional charts, your dashas and today's transits, tells you what is happening and when it changes, and shows exactly which placements it used.
> [Read my chart] [See a sample reading]

Option B (warmer):
> **Know what the next months hold, from your own chart.**
> Not sun-sign horoscopes. A full Jyotish reading of your birth chart that answers your question with dates, and shows its working.
> [Start with my birth details] [How readings work]

Badge line (static, no pulse): "Computed with Lahiri ayanamsa · Parashara and Jaimini methods · Your data stays yours".

Three proof cards under the hero, each one sentence: **Dated answers** ("Windows like Nov 2026 – Mar 2027, not 'soon'"), **Shows its working** ("Which chart, which house lord, which period, every time"), **Built on your real chart** ("D-1 to D-60, dashas and transits computed, never guessed"). Then one sample reading card (a real T3 answer, anonymised). Then "How it works" in three steps (birth details → chart computed in seconds → ask). Footer with the disclaimer, credits and privacy.

### Registration copy

| Where | Now | Rewrite |
|---|---|---|
| Title | Create Account | **Tell us when and where you were born** |
| Subtitle | Enter your birth details for personalized insights | We compute your chart from these. Change them later if needed. |
| Section labels | Birth Details / Account | **You · Birth · Finish** (headers only, no numbered wizard) |
| Date field helper | — | Type the date or pick it. Day and month order follows your country. |
| Time field helper | — | Exact if you have it. Approximate or unknown is fine; we will tell you what changes. |
| Place field helper | City, Country | Country, then state, then town. We resolve the exact coordinates and time zone for you. |
| Place confirmation | — | "Chennai, Tamil Nadu, India · 13.08° N 80.27° E · IST" with **Not right?** |
| Primary button | Create Account / Creating Account… | **Continue** → **Check your email** (code step) → **Open my chart** |
| Email code screen | 8-character code | We sent a 6-digit code to you@example.com. It expires in 10 minutes. [Resend in 30 s] |
| Consent | — | I agree to the Terms and Privacy Policy and to AI Astra using my birth details to compute my readings. |
| Error, generic | Signup failed. Please try again. | Something went wrong on our side. Your details are still here; try again in a moment. |
| Error, place | — | We could not find that town. Check the spelling or enter coordinates. |
| Error, code | Unable to sign in. Check your code and try again. | That code did not match. Check the latest email or request a new code. |

### Sign-in copy

Title **Welcome back**; one field, email; button **Email me a code**; secondary **Use a password**; after send: "Code sent to you@example.com. Enter it below." Footer line: "New here? **Create your chart**."

## 3. Interaction rules (the "slick" part)

| Rule | Replace | With |
|---|---|---|
| Motion | `hover:scale-105`, `animate-pulse` badges, bouncing dots, animated star layers behind text | 150–200 ms ease-out transitions on background/colour/opacity only; hover = brighten 6 % and lift shadow 2 px; focus = 2 px saffron ring with 2 px offset; reduced-motion honoured globally |
| Buttons | gradient fills with white text everywhere | one primary (saffron fill, night text), one secondary (outlined gold), one ghost; loading state replaces the label with a 16 px spinner inside the same button width (no layout jump); disabled = 50 % opacity, not grey |
| Forms | validation on every keystroke clearing errors; errors in red below | validate on blur and on submit; inline hint under the field in grey, error in vermilion with an icon; the first invalid field receives focus; the submit button is enabled always and explains what is missing |
| Field entry | native date and time pickers; free-text place | the segmented date and time controls and the three-level place (see auth-registration-review.md); typeahead everywhere a list exists |
| OTP | text box with 8 chars | 6 boxes, auto-advance, paste fills all, auto-submit on the sixth digit, resend timer |
| Page changes | full re-render, flash of empty content | route-level crossfade 150 ms; skeletons for cards and lists (never a centred spinner for content); the chart "syncing" screen shows a 3-step progress (details received → chart computed → ready) with real stage events |
| Feedback | silent success | toast top-centre 2.5 s for saves; inline check mark on resolved place |
| Keyboard | — | Enter submits a single-field step; Tab order follows reading order; Escape closes sheets and popovers; `/` focuses the chat input |
| Touch | side overlays on phones | bottom sheets with drag handle; 44 px targets; input bar above the keyboard |
| Typography | gradient headlines, mixed sizes | one scale: 44/32/24/18/16/14 at 1.2–1.5 line height; headlines in solid gold or off-white; body `#E9E6F7`; max 72ch |
| Spacing | mixed `space-y-6/4/2` | 8-px grid: 8/16/24/32/48 only |
| Icons | lucide mixed sizes | lucide at 20 px in buttons, 16 px inline, stroke 1.75 |
| Layout | cards float at random widths | 12-column grid, content max 1120 px, forms max 480 px |

## 4. Components to build (web)

`src/ui/`: `Button` (primary/secondary/ghost, loading, sizes), `Field` (label, hint, error, required dot), `Input`, `Select` (searchable), `SegmentedDate`, `SegmentedTime`, `OtpInput`, `Toast`, `Skeleton`, `Sheet` (bottom on mobile, side on desktop), `Stepper` (used only for the chart-syncing state), `Crossfade` route wrapper. Tokens in `tailwind.config.js` (palette, radii 12/16/24, shadows, motion durations). Storybook is optional; a `/dev/ui` route with every component state is enough for the screenshot QA.

## 5. Landing page structure (replacing `LandingPage.tsx`)

1. Nav: brand, "How it works", "Sample reading", "Sign in", primary "Read my chart".
2. Hero (copy above) on a daily epic sky (celestial-backgrounds.md), text in the safe area, no blur blobs.
3. Proof cards (three).
4. Sample reading card (real T3 output, anonymised) with the "How I read this" expanded once as a demo.
5. How it works (three steps with a screenshot each).
6. What we do not do (honest scope: no remedies store, no lottery numbers, no medical advice) — this builds trust with the audience that has seen the other apps.
7. Plans (when subscriptions exist; placeholder "Free to start").
8. Footer: disclaimer, privacy, terms, credits for photography, contact.

Lighthouse targets: performance ≥ 90 on mobile, accessibility ≥ 95, LCP ≤ 2.5 s, CLS ≤ 0.05.

## 6. Tests (TEST.MD)

1. All UI strings use the single brand name (grep test).
2. Hero renders with the chosen copy; no `animate-pulse`, `scale-105` or gradient-text utilities remain on landing and auth routes (lint rule or grep test).
3. Registration: blur validation, first-invalid focus, place confirmation line, OTP auto-submit, no layout shift on loading buttons (measure button width before/after).
4. Route crossfade present; disabled under reduced motion.
5. Lighthouse run in CI for landing, sign-in, sign-up with the targets above; screenshots under `docs/screenshots/landing-auth-polish/`.
