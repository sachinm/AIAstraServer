# AdAstra — Internal Developer Documentation

Internal reference for developers working on the AdAstra astrology/kundli platform. Covers repo layout, modules, processes, UI, business logic, third-party integrations, and security (auth, JWT, encryption, DB).

---

## 1. Repository Overview

| Area | Path | Purpose |
|------|------|--------|
| **Backend** | `backend/` | Node/Express, GraphQL (Yoga), Prisma, auth, kundli RAG, queue worker |
| **Frontend** | `frontend/` | React (Vite) user portal: landing, sign-in/up, dashboard, chat, charts, mantras, remedies |
| **Admin app** | `admin-app/` | React (Vite) admin panel: user list, user detail, reset password, kundli refresh |

All client apps talk to the backend via a **single GraphQL endpoint**; no direct Supabase or REST APIs are exposed to the browser (except optional REST `/query` and debug routes).

---

## 2. Test Accounts (Seed Users)

Run `npm run seed:queue-users` from `backend/` to create 10 test users. All share the same password.

| Username   | Password    | Email                 |
|------------|-------------|------------------------|
| seeduser1  | SeedUser#123 | seeduser1@example.com  |
| seeduser2  | SeedUser#123 | seeduser2@example.com  |
| seeduser3  | SeedUser#123 | seeduser3@example.com  |
| seeduser4  | SeedUser#123 | seeduser4@example.com  |
| seeduser5  | SeedUser#123 | seeduser5@example.com  |
| seeduser6  | SeedUser#123 | seeduser6@example.com  |
| seeduser7  | SeedUser#123 | seeduser7@example.com  |
| seeduser8  | SeedUser#123 | seeduser8@example.com  |
| seeduser9  | SeedUser#123 | seeduser9@example.com  |
| seeduser10 | SeedUser#123 | seeduser10@example.com |

Each user has varied DOB, TOB, and place of birth (Mumbai, Delhi, Chennai, etc.). After seeding, the Kundli queue worker processes them and sets `kundli_added` when biodata + d1 are ready.

---

## 3. Backend — Modules and Processes

### 3.1 Entry Point and HTTP Layer

- **`backend/server.ts`**
  - Loads `dotenv`, validates `JWT_SECRET` (fail-fast if missing or &lt; 32 chars).
  - Express app: CORS (origins for localhost 5173/3000/5174), JSON body parser.
  - **GraphQL**: Mounts GraphQL Yoga at `/graphql` with `schema` and `buildContext`.
  - **REST**:
    - `POST /query` — JWT required; runs RAG query for the authenticated user (`runRagQuery` from kundliService).
    - `GET /debug/kundli/:user_id` — Dev-only (disabled in production); JWT + same user; returns kundli chunks for debugging.
  - Startup: `checkDatabaseConnection`, `ensureSuperadmin`, and (if AstroKundli is configured) a **30s interval** that runs `processKundliSyncQueue`.

### 3.2 GraphQL Layer

- **`backend/src/graphql/schema.ts`**
  - Single file: **typeDefs** (all types and Query/Mutation) and **resolvers** (all resolvers).
  - Resolvers use `withAuth` / `withAdmin` (from `rbac.ts`) and call into services.
- **`backend/src/graphql/context.ts`**
  - Builds context from request: reads `Authorization: Bearer <token>`, verifies JWT with `getJwtSecret()`, sets `userId`, `role`, `prisma`, `request`.
- **`backend/src/graphql/rbac.ts`**
  - `requireAuth`, `requireRoles`, `ALL_AUTHENTICATED_ROLES`; used for “any authenticated” vs “admin/superadmin” checks.

**Queries:** `me`, `meDetails`, `myBiodata`, `myContent`, `ask`, `chats`, `activeChat`, `chatMessages`, `adminListUsers`, `adminGetUser`, `adminGetUserChats`, `adminGetUserKundli`.

**Mutations:** `login`, `signup`, `uploadKundli`, `createChat`, `setChatInactive`, `addMessage`, `adminUpdateUser`, `adminResetPassword`, `adminRefreshUserKundli`.

### 3.3 Services (Business Logic)

| Service | File | Responsibility |
|--------|------|----------------|
| **authService** | `src/services/authService.ts` | `validateLogin`, `login`, `signup`, `issueToken`; password hash (bcrypt), PII encrypt (DOB/POB/TOB); on login/signup calls `enqueueKundliSync`. |
| **kundliService** | `src/services/kundliService.ts` | `loadSystemPrompt`, `runRagQuery` (RAG over kundli chunks → fake embeddings → cosine similarity → LLM), `processKundliUpload` (PDF parse, store kundli). Uses `kundli-rag.ts`, `llmClient`. |
| **kundliQueueService** | `src/services/kundliQueueService.ts` | `enqueueKundliSync` (ensure user has a Kundli row with `queue_status: pending`); `processKundliSyncQueue` (batch process pending rows via AstroKundli API, update biodata/d1/d7/…). Uses `astroKundliClient`, `config/env`. |
| **adminService** | `src/services/adminService.ts` | List/update users (filtered by `astrology_student` / `astrologer`), reset password, used by admin GraphQL resolvers. |

### 3.4 Config and Lib

- **`src/config/env.ts`** — Central env: `getNodeEnv()`, `getAstroKundliBaseUrl()`, `isAstroKundliConfigured()`, `getAstroKundliApiKey()`. Per-env AstroKundli URL vars: `ASTROKUNDLI_BASE_URL_LOCAL`, `_STAGING`, `_PROD`.
- **`src/lib/prisma.ts`** — Singleton Prisma client.
- **`src/lib/hash.ts`** — bcrypt: `hashPassword`, `comparePassword` (SALT_ROUNDS = 10).
- **`src/lib/encrypt.ts`** — AES-256-GCM PII encryption for storage; `encrypt`/`decrypt`; key from `ENCRYPTION_KEY` (hex or base64, 32 bytes).
- **`src/lib/validators.ts`** — Zod: `loginSchema`, `signUpSchema`; `validateLoginInput`, `validateSignUpInput`.
- **`src/lib/dbCheck.ts`** — `checkDatabaseConnection()` at startup.
- **`src/lib/llmClient.ts`** — LLM client for RAG (e.g. LangChain/OpenAI); used by kundliService.
- **`src/lib/astroKundliClient.ts`** — **Third-party client**: AstroKundli API (`fetchHoroscopeChart`, `authToAstroKundliParams`); defines `KUNDLI_JSON_FIELDS`, request/response types; **decrypts** DOB/POB/TOB when mapping Auth → API params.
- **`kundli-rag.ts`** (backend root) — `fetchLatestKundliForUser`, `kundliRowToChunks`; used by debug route and kundliService.

### 3.5 Data Layer

- **Prisma** — `backend/prisma/schema.prisma`: PostgreSQL via `DATABASE_URL` / `DIRECT_URL`.
- **Models:** `Auth`, `Kundli`, `SystemPrompt`, `UserGeneratedContent`, `Chat`, `Message`.
- **Migrations:** `backend/prisma/migrations/` (e.g. kundli queue status, auth `created_at`).
- **Supabase RLS:** `backend/supabase/migrations/` — RLS enabled on all public tables; `auth` table access revoked from `anon`/`authenticated` so password is never exposed via PostgREST. Backend uses Prisma with direct URL and effectively bypasses RLS.

### 3.6 Background Process

- **Kundli sync queue** — Every 30s (when AstroKundli is configured), `processKundliSyncQueue(prisma)` runs: picks rows with `queue_status = 'pending'`, sets `in_progress`, calls AstroKundli API per field, updates Kundli columns, sets `completed` and `kundli_added` on Auth when biodata + d1 are present. Queue events (tick start, API calls, errors) are written to a log file for monitoring: default `logs/kundli-queue.log` (configurable via `KUNDLI_QUEUE_LOG_FILE`).

---

## 4. Frontend — Pages, Components, and Data Flow

### 4.1 Entry and Routing

- **Entry:** `index.html` → `main.tsx` → `App.tsx` (Router + AuthProvider) → `AppRoutes` from `routes.tsx`.
- **Routes:**

| Path | Purpose | Guard |
|------|--------|--------|
| `/` | Landing | If authenticated → redirect to `/dashboard` |
| `/signin` | Sign in | Unauthenticated only |
| `/signup` | Sign up (birth details → account) | Unauthenticated only |
| `/dashboard` | App shell (TopNavigation + Outlet) | Requires auth + user |
| `/dashboard`, `/dashboard/chat` | Chat UI | Nested under Dashboard |
| `/dashboard/charts` | Biodata / charts | Nested |
| `/dashboard/mantras` | Mantras & horoscope | Nested |
| `/dashboard/remedies` | Remedies | Nested |
| `*` | Catch-all → `/` | — |

### 4.2 Pages and Components

| Page | File | Purpose |
|------|------|--------|
| **Landing** | `LandingPage.tsx` | Hero, CTAs to signin/signup; no backend calls. |
| **Sign In** | `Auth/SignIn.tsx` | Username + password; calls `login()` from `Auth/api.ts`, then `handleSignIn(result.user)`. |
| **Sign Up** | `Auth/SignUp.tsx` | Step 1: birth details; Step 2: email/password; calls `signup()` then `handleSignUp(userData)`. |
| **Dashboard** | `pages/Dashboard.tsx` | Layout: TopNavigation + Outlet. |
| **Chat** | `pages/chat-interface/ChatSection.tsx` | Polls `fetchUserDetails()` for `kundli_added`; sends messages via `sendChatMessage()` (UserData). Renders ChatSidebar (conversation list in local state; `chatAPI.ts` exists but is not wired for persistence). |
| **Charts** | `pages/charts/ChartsSection.tsx` | Loads `fetchUserBiodata()` (UserData), shows biodata grid. |
| **Mantras** | `pages/mantras/MantrasSection.tsx` | Loads `fetchUserContent()`, shows mantras and horoscope. |
| **Remedies** | `pages/remedies/RemediesSection.tsx` | Loads `fetchUserContent()`, shows remedies (gemstones, rituals, etc.). |

**Shared:** `TopNavigation` (logo, nav links, user, logout). **Chat:** `ChatSection`, `ChatSidebar`. No global component folder; shared behavior in `Auth`, `lib/graphql`, `UserData`.

### 4.3 State and API Usage

- **State:** No Redux/Zustand. App state: `user`, `isAuthenticated` in `App.tsx`, restored from `localStorage.getItem('astroUser')`. AuthProvider injects handlers via `cloneElement`. Pages use local `useState`.
- **GraphQL client:** `lib/graphql.ts` — `runGraphQL(operation, variables)`: POST to `VITE_GRAPHQL_ENDPOINT`, `Authorization: Bearer <token>` when `localStorage.getItem('token')` is set. Helpers: `getUserId()`, `setAuth(token, userId)`, `clearAuth()`.
- **User data:** `pages/UserData.ts` — `fetchUserDetails()` (meDetails), `fetchUserBiodata()` (myBiodata), `sendChatMessage(question)` (ask), `fetchUserContent()` (myContent). All require `kundli_added` for biodata/content/chat.

---

## 5. Admin App — Overview

- **Purpose:** User management for roles `astrology_student` and `astrologer`.
- **Auth:** Separate token storage: `adminToken`, `adminUserId`, `adminRole` in localStorage (`AdminAuthProvider`, `lib/graphql.ts`). Same backend GraphQL; admin resolvers require role `admin` or `superadmin` via `withAdmin`.
- **Routes:** Login, Dashboard (user list), User detail (tabs, reset password, refresh kundli). Uses same backend `adminListUsers`, `adminGetUser`, `adminUpdateUser`, `adminResetPassword`, `adminRefreshUserKundli`.

---

## 6. Authentication, JWT, and Cookies

### 6.1 Mechanism (Current)

- **No HTTPOnly cookies.** Tokens are **JWT only**, sent and stored as follows:
  - **Frontend (user portal):** Backend returns `token` and `user` (id) from `login`/`signup`; frontend stores in **localStorage**: `token`, `userId` (via `setAuth` in `graphql.ts`). Every GraphQL request sends `Authorization: Bearer <token>`.
  - **Admin app:** Same JWT from backend `login` mutation; stored in **localStorage** as `adminToken`, `adminUserId`, `adminRole`. Requests use `Authorization: Bearer <adminToken>`.
- **Backend:** Context builder in `context.ts` reads `Authorization: Bearer <token>`, verifies with `jwt.verify(token, getJwtSecret())`, extracts `sub` (or `userId`) and `role`. No cookie parsing.

### 6.2 JWT Details

- **Issued in:** `authService.issueToken(userId, role)`.
- **Algorithm:** Default for `jsonwebtoken` (HS256 when using secret).
- **Payload:** `sub` (user id), `role`. Expiry: **7 days** (`DEFAULT_EXPIRY = '7d'`).
- **Secret:** `JWT_SECRET` env; must be set and at least 32 characters (validated at startup in `server.ts` via `getJwtSecret()`).

### 6.3 Auth Flows

- **Login (frontend):** SignIn → `Auth/api.ts` `login(username, password)` → GraphQL `login` → on success `setAuth(result.token, result.user)` and `handleSignIn(result.user)`. AuthProvider may set `user` from `localStorage.getItem('astroUser')` or from callback; navigates to `/dashboard`.
- **Sign up:** SignUp → `signup(apiData)` → GraphQL `signup` → on success `setAuth` and `handleSignUp(userData)`; AuthProvider sets user, `isAuthenticated`, saves `astroUser` and `isAuthenticated` in localStorage, navigates to `/dashboard`.
- **Logout (frontend):** `handleLogout`: clear user state, `isAuthenticated = false`, `localStorage.removeItem('astroUser')`, navigate to `/`. **Note:** `clearAuth()` in `graphql.ts` (which removes `token` and `userId`) is **not** called on logout in the current code; the JWT remains in localStorage until something else clears it.
- **Admin:** Admin app login stores token in `adminToken`; logout clears token and related keys via `setToken(null)`.

### 6.4 RBAC

- **Roles:** `user`, `astrology_student`, `astrologer`, `support`, `admin`, `superadmin`.
- **Resolvers:** User-facing queries/mutations use `requireRoles(context, ALL_AUTHENTICATED_ROLES)`. Admin-only resolvers use `requireRoles(context, ['admin','superadmin'])` via `withAdmin`.

---

## 7. Encryption and Data Handling

### 7.1 Transport (Frontend ↔ Backend)

- **HTTPS:** In production, use HTTPS so all traffic (including JWT and GraphQL payloads) is encrypted in transit. CORS is configured for known origins.
- **No application-level transport encryption** beyond TLS; JWT and JSON are sent as-is over the configured protocol.

### 7.2 Passwords

- **Storage:** Passwords are **hashed** with bcrypt (10 salt rounds) in `hash.ts`; only the hash is stored in `Auth.password`. Never stored or logged in plain text.

### 7.3 PII at Rest (Database)

- **Algorithm:** AES-256-GCM (`encrypt.ts`). Key from env: `ENCRYPTION_KEY` (32 bytes, hex or base64).
- **Fields:** On signup, `authService` encrypts `date_of_birth`, `place_of_birth`, `time_of_birth` before writing to Prisma. If `ENCRYPTION_KEY` is not set, values are stored in plain text (fallback).
- **Format:** Encrypted strings are stored with prefix `enc:` + base64(iv + authTag + ciphertext). `decrypt()` strips `enc:`, decodes, and returns plain text; non-prefixed values are returned as-is.
- **Usage:** Encryption on write in `authService.signup` and in `ensureSuperadmin`. Decryption when mapping Auth → AstroKundli params in `astroKundliClient.authToAstroKundliParams`. Admin/user reads of DOB/POB/TOB from the backend should use `decrypt()` when displaying if values may be encrypted.

### 7.4 Database Access and RLS

- **Backend:** Uses Prisma with `DATABASE_URL` / `DIRECT_URL` (service/direct connection). Supabase RLS is enabled on all public tables; `anon` and `authenticated` have no grant on `auth`, so the table is not exposed via PostgREST. Backend bypasses RLS via its connection.
- **Frontend / Admin:** No direct DB or Supabase client; all data through GraphQL (and optional REST `/query`).

---

## 8. Third-Party Integrations

| Integration | Purpose | Where | Config |
|-------------|--------|--------|--------|
| **AstroKundli API** | Horoscope/kundli data (biodata, d1, d7, d9, d10, charakaraka, vimsottari_dasa) | `astroKundliClient.ts`, `kundliQueueService.ts` | `ASTROKUNDLI_BASE_URL_*` per env, optional `ASTROKUNDLI_API_KEY` |
| **OpenAI / LLM** | RAG answers for user questions | `llmClient.ts`, `kundliService.ts` | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| **Supabase (PostgreSQL)** | Database only; RLS migrations in repo | Prisma + Supabase migrations | `DATABASE_URL`, `DIRECT_URL` |

No other backend third-party calls. Frontend uses external image URLs (e.g. Pexels) for landing assets.

---

## 9. Important Conventions and Gotchas

- **Env:** Backend uses `src/config/env.ts` for node env and AstroKundli URLs; JWT secret from `context.ts`. Frontend uses `VITE_GRAPHQL_ENDPOINT` (and admin app `VITE_API_BASE`, `VITE_GRAPHQL_ENDPOINT`).
- **Chat persistence:** Backend supports `chats` and `messages` via GraphQL; frontend `chatAPI.ts` has the operations but Chat UI currently uses only `ask` (in-memory conversation). To persist, wire ChatSection to `chatAPI` (createChat, addMessage, chatMessages).
- **Logout:** Frontend logout does not call `clearAuth()`; consider calling it so `token` and `userId` are removed from localStorage.
- **Superadmin:** Created/updated at startup by `ensureSuperadmin` when `SUPERADMIN_PASSWORD` is set (min 16 chars). Uses `SUPERADMIN_USERNAME`, `SUPERADMIN_EMAIL`.

---

## 10. Quick Reference — Key Files

| Concern | Files |
|--------|--------|
| HTTP + GraphQL + REST | `backend/server.ts`, `backend/src/graphql/schema.ts`, `context.ts`, `rbac.ts` |
| Auth (login, signup, JWT) | `backend/src/services/authService.ts`, `backend/src/graphql/context.ts` |
| Password / PII | `backend/src/lib/hash.ts`, `backend/src/lib/encrypt.ts`, `backend/src/lib/validators.ts` |
| Kundli RAG & upload | `backend/src/services/kundliService.ts`, `backend/kundli-rag.ts`, `backend/src/lib/llmClient.ts` |
| Kundli sync queue | `backend/src/services/kundliQueueService.ts`, `backend/src/lib/astroKundliClient.ts`, `backend/src/config/env.ts` |
| Admin | `backend/src/services/adminService.ts`; admin-app `Auth/AdminAuthProvider.tsx`, `lib/graphql.ts` |
| Frontend auth & API | `frontend/src/Auth/`, `frontend/src/lib/graphql.ts`, `frontend/src/pages/UserData.ts` |
| DB & RLS | `backend/prisma/schema.prisma`, `backend/supabase/migrations/` |

---

## 11. UAT/QA Remediation

For build and data issues found in UAT/QA (e.g. broken CSS imports, FK violations due to missing default users), see the dedicated plan:

- **[UAT/QA Remediation Plan](.cursor/plans/uat_qa_remediation_plan.md)** — Fixes for: (1) CSS import path in admin layout (`../admin.css` → `./admin.css`), (2) FK violation when `DEFAULT_USER_ID` (e.g. `"user-poweruser"`) does not exist in the database (Energy assessment flow). Includes resolution steps and prevention notes.

---

*This document is intended for internal use by developers on the AdAstra project. Keep it updated as modules and security practices change.*
