# 01 · One loading overlay for the web app

Status: plan written 2026-11-09 (Fable, side session of the self-reading work). Code follows this doc. Companion files:
`02-quips.md` (the lines), `03-image-prompts.md` (the four Nano Banana prompts and the ask for Sachin's yes).

## 1. Start (facts checked in code on 2026-11-09)

**Where "Loading" shows today** (AIAstra_WEB, `develop` 9f6b89d):

| Place | File | What the user sees | How long |
|---|---|---|---|
| Session restore, every route | `src/Auth/RouteGuards.tsx` `SessionLoadingScreen` | a full dark page with the word `Loading…` | 0.3–2 s on refresh; also the first paint after sign-up verify |
| After birth details → `/welcome` | `src/Auth/ProfileGate.tsx` (`!checked`) renders the same `SessionLoadingScreen` | `Loading…` while `me` is read | 0.5–2 s |
| You / Love boards | `src/components/AreaBoardView.tsx:400` `board-loading`; `:401` `board-preparing` | `Loading…`, then a flat panel "Your chart is still being prepared. This page will update by itself." polled every 30 s, 10 times | **the post-registration wait: first natal set ≈ 46 s, digest ≈ 10 s, first Oracle reading ≈ 60 s** |
| Work board | `src/pages/work/WorkPage.tsx:122` | `Loading…`; `not_ready` panel | same build wait |
| Lucky times | `src/pages/lucky/LuckyTimesPage.tsx:144` | `Loading…` | 1–3 s |
| Chat | `src/pages/chat-interface/ChatSection.tsx:688` | a card with a spinner: `Loading…` / `Generating your birth chart…` + `ChartProgress` | 0.5 s / the build wait |
| Timeline ledger | `src/pages/timeline/LedgerSection.tsx:101,125` | spinner + `Loading events…` | 1–3 s |
| Self dashboard panels | `src/pages/you/OracleWait.tsx` `OracleVeil` | a per-panel gradient veil rotating the 8 `ORACLE_LINES` (`ReadingStagesPanel.tsx`) every 4.5 s | until the synthesis lands |
| Mantras / Remedies sections | `src/pages/{mantras,remedies}/*Section.tsx` | `Loading … data...` | routes redirect away; dead code, left alone |

**The post-registration path:** `SignUp.onVerified` → `/signup/details` (`BirthDetails`) → `onDone` → `/welcome` (`ProfileGate` →
`SessionLoadingScreen` → `WelcomeWizard`) → `onFinish` → `/dashboard/you` (`AreaBoardView` → `board-loading` →
`board-preparing` until `me.kundli_status === 'ready'`). The bare word is seen twice (RouteGuards, ProfileGate) and the long
wait is the board's flat `preparing` panel.

**Theme:** `src/lib/theme.ts` puts `dark` or `light` on `<html>` for `/dashboard`, `/profile`, `/welcome`; public pages stay
dark (phase 1). Light-mode colours are a generated mapping `src/theme-light.css` from the dark Tailwind classes
(`scripts/gen-light-theme.mjs`), so new components either reuse mapped classes or carry their own `html.light` CSS.

**Assets:** the home scenes are `.webp` files bundled by Vite with hash-only names (`vite.config.ts`
`assetFileNames`); `public/` holds `favicon.svg`, `images/`, `mediapipe/` (copied by `scripts/copy-mediapipe.mjs` in
`predev`/`prebuild`). No encrypted asset exists yet.

**Server:** `server.ts` (repo root) mounts route modules as `registerXRoutes(app, { prisma, requireUser })`;
`tests/unit/serverMounts.test.ts` checks every imported register call is made. `src/lib/encrypt.ts` is AES-256-GCM
for stored strings (layout `iv|tag|ct`, key `ENCRYPTION_KEY`). The web client reads the API base from `VITE_API_BASE`
(`src/lib/graphql.ts`) and sends the JWT on `Authorization` + `X-Astra-Authorization` (`src/lib/apiHeaders.ts`).

**Symptoms:** the first thing a new user sees after typing their birth details is a bare word on a dark page, then a flat
sentence for a minute. The Self dashboard has a different, nicer wait. Nothing is reusable.

## 2. End goal

Every wait in the signed-in app, and the session-restore wait before it, shows the same thing: the page beneath stays
faintly visible under a translucent veil, one of four house-chart illustrations (South or North Indian, in the viewer's
theme) sits softly behind a short line in the assistant's voice, and the line changes every 4.5 s. The line and the
illustration are picked at random each time the veil appears. The illustration arrives encrypted, is decrypted in the
browser and is cached there, so after the first visit it costs nothing. If the key, the network or the cache fail, the
veil still shows with the lines alone; a wait never fails because of its decoration. Reduced-motion users get no
animation. The words never predict, never name a step or a time, and never name the engine.

## 3. Deliverable

**AIAstra_WEB** (`feat/loading-overlay` → `develop`):

- `src/lib/loadingQuips.ts` — 40 lines + `pickQuipStart()`; test `loadingQuips.test.ts` (count 25–50, each ≤ 90 chars,
  no forbidden words, no prediction verbs).
- `src/lib/overlayArt.ts` — manifest → key → ciphertext → AES-GCM decrypt → IndexedDB cache → object URL;
  `overlayArt.test.ts` (round trip with a Node-side encrypt helper; cache hit skips the network; no key → null).
- `src/components/LoadingVeil.tsx` — the overlay (`fullScreen` and in-place modes, `note` sub-line, `children`
  skeleton); `LoadingVeil.test.tsx`.
- Wiring: `RouteGuards.SessionLoadingScreen`, `AreaBoardView` (`board-loading`, `board-preparing`), `WorkPage`,
  `LuckyTimesPage`, `ChatSection` (kundli null/false), `LedgerSection`. `OracleVeil` is left in place this round (it
  wraps per-panel content with a bottom gradient; replacing it is a follow-up once the Self page skeletons exist).
- `scripts/encrypt-overlay-art.mjs` — build step (`prebuild`, `predev`) that encrypts `art/overlay/*` into
  `public/overlay/*.enc` + `public/overlay/manifest.json` when `OVERLAY_ART_KEY` is set; writes nothing otherwise.
  `public/overlay/` is gitignored.
- `art/overlay/` — the four illustrations (Nano Banana, after Sachin's yes) and, until then, four SVG placeholders
  drawn by `scripts/draw-overlay-placeholders.mjs` so the pipeline runs end to end.
- `index.css` additions (`.load-veil*` with `html.light` overrides).

**AIAstra_Server** (`feat/loading-overlay` → `develop`):

- `src/routes/assetRoutes.ts` — `GET /api/assets/overlay-key` (signed-in only) → `{ key, version }`; mounted in
  `server.ts`; `tests/unit/assetRoutes.test.ts`.
- `src/config/env.ts` — `overlayArtKey()`; env var `OVERLAY_ART_KEY` (64 hex chars) documented in `.env.example`.
- `docs/loading-overlay/01..03` (this folder); TODOs filed in `docs/TODOS.md`.

## 4. Exactly how it works when done

### 4.1 Backend

One request type. `GET /api/assets/overlay-key` with the session JWT:

1. `requireUser` resolves the user (401 otherwise, as every other route).
2. Read `OVERLAY_ART_KEY` from env (64 hex chars = 32 bytes). Unset or malformed → `404 { error: 'no_key' }` and one
   `console.warn('[assets] OVERLAY_ART_KEY unset')` per process.
3. Respond `200 { key: <base64 of the 32 bytes>, version: <first 8 hex of sha256(key)> }` with
   `Cache-Control: private, no-store`. No DB work, no concurrency concern; the handler is synchronous after auth.

The key is the same for every user (the art is not per user); what the endpoint buys is that the ciphertext on the
public CDN is unreadable to anyone who is not signed in, and that the key is never in the JS bundle or in git. Rotation:
change the env var on the Lambda **and** in the Amplify build env, redeploy both; the version string changes, so every
browser's cache misses once and refetches.

### 4.2 API

| Endpoint | Request | Response | Errors the client handles |
|---|---|---|---|
| `GET /api/assets/overlay-key` | JWT headers | `200 { key: string(base64, 44 chars), version: string }` | `401` (no session → quips only), `404 no_key` (not configured → quips only), network/timeout 8 s (→ quips only) |
| `GET /overlay/manifest.json` (web origin, static) | none | `200 { version, files: [{ name, style: 'south'\|'north', theme: 'light'\|'dark', path, bytes }] }` | `404` (build ran without a key → quips only) |
| `GET /overlay/<name>.<version>.enc` (web origin, static) | none | bytes `iv(12) ‖ ciphertext ‖ tag(16)` (WebCrypto AES-GCM layout); `Cache-Control` long by Amplify since the name carries the version | `404`, bad tag (`DOMException OperationError` → drop cache entry, quips only) |

### 4.3 Frontend experience

`LoadingVeil` is the single component. Two placements:

- **fullScreen** (`SessionLoadingScreen`): fixed inset-0, over whatever painted (the sky, or nothing).
- **in place** (boards, chat, ledger, lucky): `position: absolute; inset: 0` inside a `relative` parent; the caller
  passes `children` = the skeleton (today: the page's title row and an empty panel frame) that stays faintly visible.

Each mount: `pickQuipStart()` picks a random start index; the line advances every `LINE_MS` (4.5 s, from
`ReadingStagesPanel`), cross-fading 300 ms (none with reduced motion). `useOverlayArt(theme)` picks `south` or `north`
at random, asks `overlayArt.get({ style, theme })`, and sets the `<img>` when the object URL arrives (fade-in 400 ms);
until then, and forever if it fails, the veil is the tinted blur alone. On unmount the object URL is revoked.
`theme` comes from `useTheme()`'s resolved value; the public pages are dark, so the restore veil is dark.

An optional `note` (e.g. "Your chart is still being prepared. This page updates by itself.") sits under the line in
smaller type, so the boards' `preparing` state keeps its one factual sentence. `ChartProgress` (stage, count, Retry)
renders as the veil's `children` card in chat, unchanged.

`overlayArt.get` in order: (1) IndexedDB `aiastra-overlay` store `art`, key `${style}-${theme}@${version}` → Blob;
(2) `manifest.json` (memoised per page load; 404 → null); (3) key from the API (memoised per page load; 8 s timeout);
(4) fetch the `.enc` (10 s timeout), `crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, body)`, store the Blob,
return `URL.createObjectURL`. Every step is in try/catch and returns `null`; IndexedDB missing (private mode, jsdom)
degrades to a per-page in-memory Map.

### 4.4 UI/UX

- Veil: dark theme `rgba(11,10,31,0.72)` + `backdrop-filter: blur(6px)`; light theme `rgba(245,243,255,0.78)` + same
  blur. The art is centred, `max(60vmin, 320px)` wide, opacity 0.38 dark / 0.30 light, `mix-blend-mode: screen` on
  dark, `multiply` on light, so quip text stays readable on top.
- Line: a pill `rounded-full border border-purple-300/20 bg-purple-900/40 text-purple-100` (already mapped to light by
  `theme-light.css`) with the sparkle icon, `role="status" aria-live="polite"`.
- States: *showing* (veil + line, art fading in when ready); *art unavailable* (veil + line, nothing else changes);
  *lifting* (callers simply stop rendering it; the in-place variant fades 300 ms via `data-leaving`).
- Timings the user notices: line change 4.5 s; art appears within ~1 s on first visit (manifest + key + ~250 KB),
  instantly from cache after that; no spinner anywhere.
- Words: `docs/loading-overlay/02-quips.md`. No step names, counts, times, the engine, or "prediction" verbs.

## 5. Architecture

```
Amplify (static)                      CloudFront → Lambda (server)
  /overlay/manifest.json  ──┐           GET /api/assets/overlay-key  (JWT) → { key, version }
  /overlay/<name>.<ver>.enc ─┤                      ▲
                             ▼                      │
Browser  LoadingVeil ── useOverlayArt ── overlayArt.get
             │                              ├─ IndexedDB aiastra-overlay/art  (Blob per style-theme@version)
             │                              ├─ fetch manifest → fetch key → fetch .enc → WebCrypto AES-GCM
             └─ loadingQuips (random start, rotates LINE_MS)
Build (Amplify / local)
  prebuild: scripts/encrypt-overlay-art.mjs  art/overlay/* + OVERLAY_ART_KEY → public/overlay/*.enc + manifest.json
```

Boundaries: the CDN never holds a key or plaintext; the server never holds the art; the browser holds plaintext only in
its own storage after a signed-in session fetched the key once. Nothing astrological is computed anywhere (the art is
a drawing of an empty chart).

**Key delivery trade-off (decided):**

| Option | Pro | Con | Verdict |
|---|---|---|---|
| **Endpoint hands the key to a signed-in session** | key out of the bundle and git; rotation is an env change; ciphertext can sit on the CDN | one extra authenticated GET per page load (memoised); no art before sign-in | **chosen** |
| Build-time key in the bundle | works before sign-in, zero requests | the key is in public JS, so the encryption protects nothing | rejected |
| Server streams the images | gated bytes | 4 × ~250 KB through Lambda per cold browser, slower, costs invocations | rejected |

Before sign-in the veil is lines only; those waits are short (session restore).

## 6. Ingredients

| Item | Provided by |
|---|---|
| 40 quips (`02-quips.md` → `loadingQuips.ts`) | this session |
| 4 illustrations via Nano Banana (`03-image-prompts.md`) | Gemini, after Sachin's typed yes (key, count, cost stated first); until then SVG placeholders |
| `OVERLAY_ART_KEY` (64 hex) in the Lambda env and the Amplify build env | deploy session (generate with `openssl rand -hex 32`); a local one in each `.env` for dev |
| `scripts/encrypt-overlay-art.mjs` wired into `prebuild`/`predev` | this session |
| Web Crypto (`crypto.subtle`), IndexedDB | browser; tests use Node's `webcrypto` and a Map fallback |
| Tests: web `vitest` (`src/**/*.test.tsx`), server `tests/unit/assetRoutes.test.ts` | this session |
| No new npm dependency | — |

## 7. Action steps in sequence

1. **Plan + quips docs** (`docs/loading-overlay/01`, `02`) — this doc. Done when both are on the server branch.
2. **Quips module** — `AIAstra_WEB/src/lib/loadingQuips.ts` + test. Parallel with 3.
3. **Art pipeline, web side** — `scripts/draw-overlay-placeholders.mjs` (4 SVGs into `art/overlay/`),
   `scripts/encrypt-overlay-art.mjs`, `package.json` scripts, `.gitignore` `public/overlay/`, `src/lib/overlayArt.ts`
   + test. Parallel with 2 and 4.
4. **Server key endpoint** — `src/config/env.ts`, `src/routes/assetRoutes.ts`, `server.ts` mount, `.env.example`,
   test. Parallel with 2 and 3.
5. **Component** — `src/components/LoadingVeil.tsx` + CSS + test. After 2 and 3.
6. **Wiring** — RouteGuards, AreaBoardView, WorkPage, LuckyTimesPage, ChatSection, LedgerSection; existing tests
   adjusted (`board-loading` test ids kept). After 5.
7. **Image prompts + the ask** — `03-image-prompts.md`; message to Sachin with key, count (4 + up to 4 retries), cost.
   Parallel with 2–6. Generation only after the yes; then replace placeholders, re-run step 3's script.
8. **Checks and merge** — web `npm run typecheck` + `npx vitest run`; server `npx tsc --noEmit` + unit tests; merge
   `--no-ff` into `develop` in both repos; file leftovers in `docs/TODOS.md`.

## 8. Development phases

- **Phase A — words and veil (ships alone):** steps 1, 2, 5, 6 with no art (the veil degrades to lines). Check: the
  web tests pass; a screenshot of `/dashboard/you` while `preparing` shows the veil and a line.
- **Phase B — encrypted art pipeline with placeholders:** steps 3, 4. Check: `OVERLAY_ART_KEY` set locally, `npm run
  dev` shows a placeholder chart behind the line; a second load reads it from IndexedDB (no `.enc` request).
- **Phase C — the four illustrations:** step 7 after the yes. Check: the four files under `art/overlay/`, the prompts
  and the generation log under `docs/loading-overlay/`. Deferred until Sachin answers.
- **Deferred:** replacing `OracleVeil` on the Self page with `LoadingVeil` once that page has skeleton shells; art before
  sign-in; a Hindi quip set.

## 9. One recommendation

Ship Phases A and B now on `develop` (placeholders included, lines-only until the deploy session sets
`OVERLAY_ART_KEY` in both environments), and generate the four Nano Banana images in one batch of 4 (retries only for a
file that breaks a content rule) the moment Sachin's yes arrives. Key via the authenticated endpoint, ciphertext on the
web CDN, decrypted art cached in IndexedDB.

## Addendum 2026-11-09: protection of the art (Sachin: "encrypted, cryptically named, decrypted, cannot be copied")

- **Never in the bundle.** The chart drawing lives in `scripts/chartBoard.mjs` (web and admin), used only at build time.
  The app ships no plaintext chart.
- **Cryptic names.** The build writes `public/_a/<sha256(key ‖ version ‖ file)[0..20]>.bin` and a compact index
  `public/_a/i.json` (`v`, and per file `s` style initial, `t` 1 for dark, `m` type, `p` path). Nothing on the wire says
  chart, style or theme; a key rotation renames every file.
- **Decrypted in memory, painted on a canvas.** Web Crypto AES-GCM on each show; the result is drawn onto a `<canvas>`
  (no "Save image as", no drag, context menu blocked on the veil) and the object URL is revoked on unmount.
- **Ciphertext-only cache.** IndexedDB keeps the encrypted bytes, never the image; the key is fetched per page load from
  `GET /api/assets/overlay-key` (admin: `/api/admin/assets/overlay-key`) and held in memory as a non-extractable key.
- **Without the key** (signed out, or `OVERLAY_ART_KEY` unset) the chart's place shows an empty glass slab.
- **Limits, stated plainly:** no web page can stop a screenshot, and a determined person with dev tools and a session can
  still capture the decoded pixels. These steps stop casual copying and keep the files unreadable at rest and on the CDN.
- Layout after review: the veil is a floating frosted panel at 90% of the viewport for page-level waits (72-74% tint,
  14 px blur), brand line in the header's own classes, quip as plain text, 3D board and glass tiles.
