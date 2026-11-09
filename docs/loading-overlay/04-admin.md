# 04 · The same veil on the admin site

Scope addition from Sachin (2026-11-09, via the Self dashboard session): the loading overlay of `01` is for the WEB app
first and must also be the loading state of the ADMIN site (`aiadastra_admin`, `web/` React, `api/` its own Lambda).
One shared design: the same 40 quips, the same four illustrations, the same encrypted-asset pipeline, and the key from
the admin API because its Lambda is separate.

## 1. Start (facts checked 2026-11-09, admin `develop` 0f82fed)

- Loading today: `RequireAdmin` in `web/src/App.tsx` shows a spinner and "Checking your session…"; 58 call sites in 22
  files draw `SkeletonRows` / `SkeletonBlock` from `web/src/components/ui.tsx`; six tables print `Loading…` in an
  `EmptyRow`; two paragraphs on Activity and one on Page Performance print `Loading…`; Machinery has a spinner line.
- Theme: `web/src/lib/theme.ts` + `public/theme-init.js` put `light` or `dark` on `<html>`; light is the default.
- API: Express router `r` mounted at `/api/admin`, every route through `route()` (staff JWT), errors `HttpError` with
  the contract's codes, `deps.env` carries the env. Tests: `api/tests/*.test.ts` with `FakeDb` and supertest.
- CSP (`web/customHttp.yml`): `img-src 'self' data:` — a decrypted image shown through an object URL needs `blob:`.
- Build: Amplify `amplify.yml` runs `npm ci` then `npm run build` in `web/`; no `prebuild` step existed.

## 2. End goal

Every wait on the admin site shows the same veil as the web app: translucent layer over the skeleton, a chart drawing
in the staff member's theme, a rotating line. Session check, every table and block skeleton, the six "Loading…" rows,
the three paragraphs and Machinery all go through it. Lines only when the key is missing.

## 3. Deliverable (admin `feat/admin-loading-overlay` → `develop`)

- `web/src/lib/loadingQuips.ts` (+ test): identical to the web file.
- `web/src/lib/overlayArt.ts` (+ test): the web file with the admin's `adminApiBase()`, `buildHeaders`, `getToken()`
  (sessionStorage session), endpoint `GET /api/admin/assets/overlay-key`, IndexedDB `aiadastra-admin-overlay`.
- `web/src/components/LoadingVeil.tsx` (+ test): the web component; `LINE_MS` and `prefersReducedMotion` inlined
  (admin has no ReadingStagesPanel); theme read as `html.dark` ? dark : light.
- `web/src/index.css`: `.load-veil*` light first, `html.dark` overrides.
- `web/src/components/ui.tsx`: `SkeletonRows` is now one row with the veil over faint bars (colSpan = `cols`, `rows`
  sets the height; `data-testid="skeleton-row"` kept); `SkeletonBlock` is the veil over its lines; new `LoadingRow`.
  So the 58 skeleton sites change without being touched.
- `App.tsx` (session check → full-screen veil with the note "Checking your session…"), `Machinery.tsx`,
  `TechniqueCacheCard.tsx`, `ClarifyMonitor.tsx`, `Security.tsx`, `Technique.tsx` (`LoadingRow`), `Activity.tsx`,
  `PagePerformance.tsx` (`SkeletonBlock`).
- `web/scripts/draw-overlay-placeholders.mjs`, `web/scripts/encrypt-overlay-art.mjs`, `web/art/overlay/*.svg` (the
  same four placeholders), `package.json` `predev`/`prebuild`/`art:*`, `.gitignore` `web/public/overlay/`,
  `customHttp.yml` `img-src … blob:`.
- `api/src/admin/assets.ts` + `r.get('/assets/overlay-key')` in `api/src/app.ts`; `api/tests/assets.test.ts`;
  `api/.env.example` `OVERLAY_ART_KEY`.

## 4. How it works

Identical to `01` §4 with these substitutions: the key endpoint is `GET /api/admin/assets/overlay-key` on the admin
Lambda (`aiadastra-admin-api`), staff JWT required, `404 not_found` when `OVERLAY_ART_KEY` is unset, `Cache-Control:
no-store` (the API's default for every route). The ciphertext lives on the admin origin (`/overlay/…`), made by the
admin web build from `web/art/overlay/`. The admin build's `OVERLAY_ART_KEY` (Amplify `aiadastra-admin-web`) must equal
the admin Lambda's. It may equal the main API's too (one key for both sites) or differ; nothing ties them.

When the four Nano Banana images exist (`03`), copy the same `.webp` files into `aiadastra_admin/web/art/overlay/`.

## 5. Ingredients for the deploy session

| Item | Where |
|---|---|
| `OVERLAY_ART_KEY` (64 hex) | admin Lambda `aiadastra-admin-api` env **and** Amplify app `aiadastra-admin-web` (`d1qhwivm0xxltl`) build env |
| CSP change | ships with the web build (`customHttp.yml`) |
| Check | signed-in admin page while a table loads shows a chart behind the line; `GET /api/admin/assets/overlay-key` is 200 |

## 6. Steps and phase

One phase, all steps in this doc, closed by: admin web `npm run typecheck` + `npm test`, admin api `npx tsc --noEmit` +
`npx vitest run`, merge `--no-ff` into `develop`. Deferred: nothing admin-specific; the images wait on `03`.
