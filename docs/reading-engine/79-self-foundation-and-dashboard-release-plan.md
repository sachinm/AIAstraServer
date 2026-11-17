# 79. Priority 1 Plan: Self Foundation Card Release, Dashboard Stability (Self, Love, Work) & Production Merge Spec

**Date:** 2026-11-17  
**Author:** AI Astra Engineering  
**Status:** Approved Release Plan  
**Target Branches:** `feat/self-foundation-server` & `feat/self-foundation-card` -> `develop` -> `release-candidate-staging`  
**Deployments:** AWS Lambda (`aiastra-server-api`) via GitHub Actions OIDC + AWS Amplify (`d20sdo476h9w6c`, branch `release-candidate-staging`)  
**Related Docs:** `docs/reading-engine/68-self-board-v3-your-cards-your-months.md`, `docs/reading-engine/75-self-foundation-card.md`, `docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`, `docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`

---

## 1. Start

### 1.1 Current System State
The AIAstra personal astrology engine is operating across two main deployment tiers:
- **Backend (API):** AWS Lambda `aiastra-server-api` (x86_64 container image in ECR `aiastra-server-api`, running behind CloudFront `https://dzsm2dbswvuqy.cloudfront.net` in `us-east-1`). PostgreSQL database hosted on Render (`aiastradb`, `dpg-d6sdjcp5pdvs73dpa8a0-a.virginia-postgres.render.com:5432`) currently at migration 75 (`Database schema is up to date!`).
- **Frontend (Web):** AWS Amplify hosting app `d20sdo476h9w6c` on branch `release-candidate-staging` (`https://release-candidate-staging.d20sdo476h9w6c.amplifyapp.com/`).

### 1.2 Audit Findings on `feat/self-foundation-server` (AIAstra_Server)
- **Commit Baseline:** At `9288b24` (`feat(reading): age-36 D9 mutual confirmation, divisional varga routing, 40+ dasha & TP active timing (doc 76)`), ahead of `origin/feat/self-foundation-server` (`d86af37`).
- **Clean Compilation:** `.\node_modules\.bin\tsc.cmd --noEmit` exits `0` with zero diagnostic errors across 200+ source files.
- **Contract Health:**
  - `src/reading/self/v3/foundation.ts`: Clean prose formatting (`cleanEmptyRefs`, `isoDatesToWords`, `plainProse`), stale past date detection (`staleDatesIn`), period builder (`periodsFrom`), and key date extractor (`keyDatesFrom`).
  - `src/reading/self/v3/layout.ts`: Versioned layout patching (`writeLayoutVersioned`) enforcing optimistic concurrency with HTTP 409 `stale_layout`.
  - `src/reading/area/selfCharacterAndJoy.ts`: Catalogued Vedic builders `self.character_arc` (3-decade evolution: past 10y, now, next 10y) and `self.personality_joy` (Moon/Chandra + Mercury/Budha + 4H/5H Bhava joy pillars) with plain English prose.
  - `src/services/publicChatError.ts` & `src/routes/areaRoutes.ts`: Intercepts Gemini quota/auth errors and returns HTTP 503 `{ error: 'ai_unavailable', code: 'ai_unavailable' }`.
- **Pre-Merge Risk Identified & Resolved:** Notification files (`UserNotification` model, `notificationService.ts`, `adminNotificationRoutes.ts`, `notificationRoutes.ts`, `notifications.test.ts`) were already cleanly committed into `origin/develop` (commit `089f524`) and `origin/release-candidate-staging` (commit `cfacc6c`). Re-basing or merging against `origin/develop` brings these in cleanly without duplicate DDL conflicts.

### 1.3 Audit Findings on `feat/self-foundation-card` (AIAstra_WEB)
- **Commit Baseline:** At `8e39dfb` (`Merge feat/header-usage-ring into develop`).
- **Staged Deletions:** 13 obsolete v3 tool panels cleanly removed (`ShowMore`, `BreakdownFace`, `CalendarTool`, `DatesTool`, `InfoTool`, `LightFace`, `PlanTool`, `ResearchFace`, `TableTool`, `TimeframeTool`, `ToolPanels`, `useOptionSaves`).
- **Untracked Production Modules:** 14 files required staging before merge: `ShortFace.tsx`, `features.ts`, `layoutSaver.ts`, `layoutSaver.test.ts`, `useLayoutSaves.ts`, `NotificationBell.tsx`, `NotificationBell.test.tsx`, `AiUnavailableModal.tsx`, `aiStatus.ts`, `aiStatus.test.tsx`, `notificationsApi.ts`, `sessionRefresh.ts`.
- **Show-Stopper Null-Safety Defects Identified & Fixed:**
  1. `SelfBoardV3.tsx:289`: `card.v2?.details.certainty` replaced with optional chaining `card.v2?.details?.certainty` to prevent unhandled `TypeError` when `details` is undefined.
  2. `cardModel.ts:69,102,162`: `currentRail(card.rail)` and `card.rail.map` provided with fallback `(card.rail ?? [])` to prevent crashes on cards missing period rails.
  3. `notReady.tsx:30`: Aggressive check `if (card.status === 'withheld' || !cardHeadline(card))` expanded with `hasCardContent(card)` checking standing text, rail text, v2 body, and v3 spans, preventing false-positive withholding of valid cards.

### 1.4 Dashboard Status Across Self, Love, and Work
- **Self (`/you`):** Renders `SelfBoardV3` with `ShortFace`, `ReadFace`, `CardToolbar` (2-button radiogroup), `PeriodStrip`, `CardFrame` with header `ChartDetails` sheet trigger, and versioned layout saving. Falls back gracefully to `SelfBoardV2` if `/api/self/v3` returns 404.
- **Love (`/love`):** Fully stable on `AreaBoardView` with `LOVE_CONFIG` over `/api/area/love`. Completely decoupled from Self v3 card refactoring. 8 unit tests passing.
- **Work (`/work`):** Fully stable on `WorkPage` with sub-tabs (`now`, `back`, `ahead`, `worries`) over `/api/area/career`. Decoupled from Self v3 card refactoring. 10 unit tests passing.

### 1.5 Worktree Traps & Branch Locks
- `AIAstra_Server`: `develop` is locked at `C:/Users/Owner/Documents/work/wt/server-retrograde`; `release-candidate-staging` is locked at `C:/Users/Owner/Documents/work/wt/server-self-reading`.
- `AIAstra_WEB`: `release-candidate-staging` is locked at `C:/Users/Owner/Documents/work/wt/web-dashboard-card-width`.
- Direct `git checkout develop` or `git checkout release-candidate-staging` in root checkouts fails with fatal git lock error. Merge operations must be performed using the worktrees or git switch inside worktrees.
- In `AIAstra_WEB`, `.github/workflows/deploy-staging-amplify.yml` exists only on `release-candidate-staging` and must be preserved during merge.

---

## 2. End Goal

1. **User-Visible Behaviour:**
   - On `/dashboard/you` (`/you`), cards load in the clean foundation card layout (`Read` face by default, or `Short` face when toggled). Period navigation via `PeriodStrip` displays clean date words without astrological jargon in titles or body text.
   - On `/dashboard/love`, relationship timeline, status selector, and dated tone headlines render without disruption.
   - On `/dashboard/work`, 4 career sub-tabs, clock consensus, and confidence metrics render without disruption.
   - Header features (Usage Ring, Notification Bell, Personalize Wizard modal) operate smoothly across all boards.
2. **Target Timings:**
   - Static/cached board paint: `< 300ms`.
   - Full card rail render: `< 500ms`.
   - Optimistic layout patch latency: `< 50ms` UI response, background PATCH `< 400ms`.
3. **Eliminated Failure Modes:**
   - Zero `TypeError: Cannot read properties of undefined (reading 'certainty')` on partial card responses.
   - Zero `TypeError: Cannot read properties of undefined (reading 'findIndex')` on minimal or rail-less cards.
   - Zero false-positive withheld cards when valid standing or rail text is present.
   - Zero CI build failures from unstaged production files.
   - Zero deployment pipeline disruption: Amplify staging deployment workflow safely preserved.

---

## 3. Deliverable

1. **Code Paths Modified / Fixed:**
   - `AIAstra_WEB/src/pages/you/v3/SelfBoardV3.tsx`: Safe optional chaining in `detailsArea()`.
   - `AIAstra_WEB/src/pages/you/v3/cardModel.ts`: Safe array fallback `(card.rail ?? [])` in `spanFor`, `currentRail`, `periodsOf`, and `standingOf`.
   - `AIAstra_WEB/src/pages/you/v3/notReady.tsx`: Non-false-positive `hasCardContent(card)` check.
   - Staging of 14 untracked files in `AIAstra_WEB` including `ShortFace.tsx`, `features.ts`, `layoutSaver.ts`, `NotificationBell.tsx`, `AiUnavailableModal.tsx`.
2. **Release Documentation:**
   - `AIAstra_Server/docs/reading-engine/79-self-foundation-and-dashboard-release-plan.md` (this plan).
   - `AIAstra_Server/docs/TODOS.md`: Indexed entry with actionable instructions for successor agents.
3. **Database Migrations:**
   - Migration 75 (`20261115100000_user_notifications_m53`) verified applied on remote database.
4. **Deployments Triggered:**
   - GitHub Actions workflow `.github/workflows/deploy-api-lambda.yml` in `AIAstra_Server`.
   - GitHub Actions workflow `.github/workflows/deploy-staging-amplify.yml` in `AIAstra_WEB`.

---

## 4. How It Works When Done

### 4.1 Backend Flow & Concurrency
- Client requests `GET /api/self/v3`:
  - `selfV3Routes.ts` calls `getSelfBoardV3(userId, kundliId, { today })`.
  - Reads cached board view from `technique_outputs` or computes deterministic foundation over `kundli_digest` and `kundli_activation`.
  - Runs `foundation.ts`: scrubs empty brackets/parentheses (`cleanEmptyRefs`), rewrites ISO dates to plain calendar words (`isoDatesToWords`), extracts key turning points (`keyDatesFrom`), and marks any passed dates (`datesPassed`).
  - Returns `SelfV3Response` with status `ok` and layout version.
- Client mutates layout via `PUT /api/self/v3/layout`:
  - Enforces `writeLayoutVersioned`: compares client payload `version` against current stored record.
  - If mismatch, rejects with HTTP 409 `{ error: 'stale_layout', layout }`. Client `layoutSaver.ts` re-synchronizes and applies non-conflicting deltas.

### 4.2 API Contract Summary
| Endpoint | Method | Status | Payload / Response |
| :--- | :--- | :--- | :--- |
| `/api/self/v3` | `GET` | `200 OK` | `SelfV3Response` (`status`, `builtAt`, `cards[]`, `layout`, `features`, `version`) |
| `/api/self/v3/layout` | `PUT` | `200 OK` / `409 Conflict` | Updates chosen cards, card options, board options; returns updated `SelfBoardLayoutView` |
| `/api/self/v3/confirm` | `POST` | `204 No Content` | Logs user confirmation answer (`yes` / `no` / `skip`) to `clarify_turn_audits` |
| `/api/area/love` | `GET` | `200 OK` | Area board payload for Love (`relationshipArc`, subareas, tone headlines) |
| `/api/area/career` | `GET` | `200 OK` | Career board payload for Work (sub-tabs `now`, `back`, `ahead`, `worries`) |
| `/health` | `GET` | `200 OK` | `{"ok":true,"env":"staging"}` |

### 4.3 Frontend Experience
- **Initial Load:** Header renders avatar, Usage Ring, and Notification Bell.
- **Card Render:** Cards render with `CardFrame`, top banner art, card title/subtitle, and `CardToolbar`.
- **Face Selection:** User switches between `Read` (full text, pattern, what to do) and `Short` (first sentence + primary action) via 2-button radiogroup.
- **Period Navigation:** Clicking or swiping across `PeriodStrip` updates current period without re-fetching from server.
- **Chart Details Sheet:** Tapping the Info (`Why`) icon in the header opens slide-over sheet rendering `ChartDetails` without technical astrology jargon on the main board.
- **Error Handling:** If Gemini API rate limits are exceeded, `AiUnavailableModal` appears gracefully rather than throwing uncaught exceptions.

---

## 5. Architecture

```
[ Browser / Client ]
       │
       ├─► Amplify Web CDN (release-candidate-staging.d20sdo476h9w6c.amplifyapp.com)
       │     └─ React 18 SPA (SelfBoardV3 / AreaBoardView / WorkPage)
       │
       └─► CloudFront CDN (dzsm2dbswvuqy.cloudfront.net)
             │
             ▼
     AWS Lambda (aiastra-server-api:live)
             │
             ├─► Render PostgreSQL (aiastradb port 5432)
             │     ├─ kundli_digest / kundli_activation
             │     ├─ technique_outputs / reading_findings_cache (AES-256 sealed)
             │     └─ user_notifications (migration m53)
             │
             └─► Radha Astrology Microservice (pyjhora, Python 3.11)
```

### Boundary Guarantees
- **No Astrology in Node:** All astrological calculations (nakshatra, dasha dates, vargas D1–D30, Tithi Pravesha) are performed deterministically by Radha or digest builders; Node does zero house arithmetic.
- **PII Encryption at Rest:** Every reading and notification text model is registered under `SEALED_MODELS` with AES-256-GCM encryption.
- **RBAC:** All resolvers enforce `assertOwnAccount(ctx, targetUserId)`.

---

## 6. Ingredients

- **IAM Roles:** `arn:aws:iam::442728149528:role/aiastra-github-deploy` (assumed via OIDC in GitHub Actions).
- **GitHub Secrets:** `OVERLAY_ART_KEY`, AWS credentials, OIDC role bindings.
- **Database:** PostgreSQL on Render (`aiastradb`), migration 75 applied.
- **Environment Variables:**
  - Server: `SELF_V3_ENABLED=1`, `READING_CACHE_RECYCLE_MINUTES=45`, `CORS_ORIGINS`.
  - Web: `VITE_SELF_V2=1`, `NODE_ENV=staging`.
- **Tooling:** Windows PowerShell, `tsc.cmd`, `vitest.cmd`, `git`, GitHub CLI (`gh`).

---

## 7. Action Steps in Sequence

1. **Web Bug Fixes & Staging (`AIAstra_WEB`):**
   - Apply optional chaining in `SelfBoardV3.tsx:289`.
   - Apply `(card.rail ?? [])` array fallbacks in `cardModel.ts:69,102,162`.
   - Apply `hasCardContent` safety check in `notReady.tsx:30`.
   - Stage all 14 untracked files with `git add -A`.
2. **Plan & TODO Indexing (`AIAstra_Server`):**
   - Commit `docs/reading-engine/79-self-foundation-and-dashboard-release-plan.md`.
   - Index Doc 79 in `docs/TODOS.md` with explicit instructions.
3. **Mandatory Compile Gate:**
   - Execute `tsc --noEmit` in `AIAstra_Server` (`.\node_modules\.bin\tsc.cmd --noEmit`).
   - Execute `tsc --noEmit` in `AIAstra_WEB` (`cmd.exe /c npx.cmd tsc --noEmit`).
   - Confirm exit code 0 on both.
4. **Git Branch Commits & Worktree Integration:**
   - Commit `feat/self-foundation-server` in `AIAstra_Server`.
   - Commit `feat/self-foundation-card` in `AIAstra_WEB`.
   - In `AIAstra_Server`:
     - In worktree `wt/server-retrograde`: pull/rebase against `origin/develop`, merge `feat/self-foundation-server`, push `develop`.
     - In worktree `wt/server-self-reading`: pull `origin/release-candidate-staging`, merge `develop` `--no-ff`, push `release-candidate-staging` as user `sachinm`.
   - In `AIAstra_WEB`:
     - Merge `feat/self-foundation-card` into `develop`, push `develop`.
     - In worktree `wt/web-dashboard-card-width`: pull `origin/release-candidate-staging`, merge `develop` `--no-ff` preserving `.github/workflows/deploy-staging-amplify.yml`, push `release-candidate-staging` as user `sachinm`.
5. **Deployment Monitoring:**
   - Monitor `deploy-api-lambda.yml` in `AIAstra_Server`.
   - Monitor `deploy-staging-amplify.yml` in `AIAstra_WEB`.
6. **Post-Deployment Smoke Verification:**
   - Smoke test API health: `GET https://dzsm2dbswvuqy.cloudfront.net/health`.
   - Smoke test CORS preflight.
   - Smoke test live Amplify staging root and dashboard routes (`/`, `/you`, `/love`, `/work`).

---

## 8. Development Phases

| Phase | Description | Verification Criterion | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1: Code Fixes** | Null safety & withheld guards in Web | `tsc --noEmit` exits 0; unit tests green | **DONE** |
| **Phase 2: Documentation** | Author Doc 79 & update `docs/TODOS.md` | Doc 79 written per AGENTS.md; indexed in TODOS.md | **DONE** |
| **Phase 3: Compile Gates** | Pre-merge compilation verification | Both codebases pass `tsc --noEmit` with zero errors | **PENDING VERIFICATION** |
| **Phase 4: Worktree Merges** | Clean merge into `develop` & `release-candidate-staging` | Git commits pushed; Amplify workflow preserved | **UPCOMING** |
| **Phase 5: Staging Deploy** | GitHub Actions Lambda + Amplify builds | Workflows complete successfully; green checks | **UPCOMING** |
| **Phase 6: Smoke Check** | End-to-end verification of staging URLs | HTTP 200 on API & web routes without errors | **UPCOMING** |

---

## 9. One Recommendation

**Proceed immediately with direct integration via the dedicated worktrees (`wt/server-retrograde`, `wt/server-self-reading`, `wt/web-dashboard-card-width`) and trigger the OIDC staging deployment pipeline.**

### Verdict on Alternatives
| Alternative | Assessment | Verdict |
| :--- | :--- | :--- |
| **A. Direct worktree merge to `develop` & `release-candidate-staging` (Recommended)** | Uses existing tested OIDC deployment workflows, respects git branch worktree locks, preserves Amplify workflow, provides zero-downtime container updates on Lambda with automatic rollback alias. | **APPROVED** |
| **B. Tear down worktrees to merge directly in main checkout** | High operational risk of accidentally deleting files or breaking local working copies; violates AGENTS.md worktree safety guidelines. | **REJECTED** |
| **C. Deploy Web only and defer API Lambda** | Leaves Web client running against older server lacking `datesPassed` and `version` features, causing potential 404s or stale layout warnings. | **REJECTED** |
