# Backend – Code Review & Summary

## 1. Package Summary

### 1.1 Installed Dependencies (`package.json`)

| Package | Version | Purpose | Used in codebase? |
|--------|---------|---------|--------------------|
| **@supabase/supabase-js** | ^2.55.0 | Supabase client (DB, auth) | ✅ Yes – `supabaseClient.js`, auth/kundli/insights |
| **body-parser** | ^2.2.0 | Parse JSON/urlencoded bodies | ❌ No – Express 5 provides `express.json()` |
| **compute-cosine-similarity** | ^1.1.0 | Cosine similarity for RAG | ✅ Yes – `server.js` |
| **cors** | ^2.8.5 | CORS middleware | ✅ Yes – `server.js` |
| **cosine-similarity** | ^1.0.1 | Alternative cosine similarity | ❌ No – duplicate; only `compute-cosine-similarity` is used |
| **dayjs** | ^1.11.13 | Date/time utilities | ❌ No |
| **dotenv** | ^17.2.1 | Load `.env` variables | ✅ Yes – `server.js`, `supabaseClient.js`, `index.js` |
| **express** | ^5.1.0 | Web framework | ✅ Yes – all routes and server |
| **express-rate-limit** | ^8.0.1 | Rate limiting | ❌ No |
| **fast-levenshtein** | ^3.0.0 | String distance | ❌ No |
| **groq-sdk** | ^0.30.0 | Groq API SDK | ❌ No – Groq is called via `openai` with `baseURL` |
| **helmet** | ^8.1.0 | Security headers | ❌ No |
| **jsonwebtoken** | ^9.0.2 | JWT sign/verify | ✅ Yes – only in `index.js` (standalone app) |
| **luxon** | ^3.7.1 | Date/time (alternative to dayjs) | ❌ No |
| **ml-kmeans** | ^6.0.0 | K-means clustering for RAG | ✅ Yes – `server.js` (optional clustering) |
| **morgan** | ^1.10.1 | HTTP request logging | ❌ No |
| **multer** | ^2.0.2 | Multipart file uploads | ✅ Yes – `authController.js` (kundli upload) |
| **node-fetch** | ^3.3.2 | HTTP client | ✅ Yes – `server.js` (user verification call) |
| **openai** | ^5.12.2 | OpenAI-compatible API (Groq/OpenAI) | ✅ Yes – `server.js`, `user_controller.js` |
| **p-limit** | ^7.0.0 | Concurrency limiting | ❌ No |
| **pdf-parse-fixed** | ^1.1.1 | PDF parsing | ❌ No |
| **zod** | ^3.25.76 | Schema validation | ❌ No |

### 1.2 Recommendations

- **Remove unused packages** to reduce install size and surface area:  
  `body-parser`, `cosine-similarity`, `dayjs`, `express-rate-limit`, `fast-levenshtein`, `groq-sdk`, `helmet`, `luxon`, `morgan`, `p-limit`, `pdf-parse-fixed`, `zod`.
- **Consider adding** (if you adopt them): `express-rate-limit` and `helmet` for production security; `morgan` for request logging; `zod` (or similar) for validating request bodies.

---

## 2. What the Backend Currently Does

The backend is a **Node.js (ESM) Express app** that powers an **astrology/Kundli** product. Main behaviors:

### 2.1 Entry points

- **`server.js`** – Main app (port **3000**). This is what the readme and flow describe; it mounts auth and RAG/query.
- **`index.js`** – Separate small app (port **5000**) with its own Supabase client: login (plain username/password in DB), JWT issue, and a `/users` route. Not mounted under `server.js`; run as a second process if used.

### 2.2 Auth (`/supa/auth/*`)

- **POST `/supa/auth/login`** – Validates username/password against Supabase table `auth`; returns `{ success, user: id }` (no JWT in this route).
- **POST `/supa/auth/signup`** – Creates user in `auth` (username, password, DOB, place/time of birth, email, gender).
- **GET `/supa/auth/users`** – Lists all users from `auth` (used by `/query` for “authorized user” check).
- **POST `/supa/auth/kundli/upload/:user_id`** – Multipart upload of a Kundli JSON file; parses it, stores in `kundlis`, triggers insight generation, sets `kundli_added` on `auth`.
- **GET `/supa/auth/biodata/:user_id`** – Returns biodata + username for user (with `kundli_added` / active checks).
- **GET `/supa/auth/users/details/:user_id`** – Returns user id, `is_active`, `kundli_added`.

### 2.3 Kundli insights (LLM-generated content)

- **POST `/supa/auth/kundli/insights/:user_id/:kundli_id`** – Manually trigger generation of remedies, mantras, routines from the latest kundli; stored in `user_generated_content`.
- **GET `/supa/auth/kundli/insights/:user_id`** – Get latest saved insights for user.
- **GET `/supa/auth/content/:user_id`** – Get latest `user_generated_content` (remedies, mantras, routines, etc.).

Insights are also generated automatically on kundli upload in `uploadKundli` → `processKundliUpload`. Prompts and LLM config come from Supabase (`system_prompts`, `llm_configs`).

### 2.4 RAG query (Kundli Q&A)

- **POST `/query`** – Body: `{ question, userID }`.  
  - Verifies user via `GET http://localhost:3000/supa/auth/users` (same-server call).  
  - Loads latest kundli for `userID`, converts row to text chunks (`kundli-rag.js`), builds an in-memory “vector store” using **fake embeddings** (SHA-256 hash → 256-dim vector).  
  - Retrieves top‑K chunks by cosine similarity (optional K-means clustering is disabled).  
  - Sends system prompt from DB (name `"qa"`) + user prompt (chart data + question) to an OpenAI-compatible API (e.g. Groq via `llm_configs`).  
  - Returns `{ success, data: { answer, userID, timestamp } }`.

### 2.5 Debug

- **GET `/debug/kundli/:user_id`** – Returns latest kundli row and its text chunks (no auth).

### 2.6 Supporting modules

- **`kundli-rag.js`** – `fetchLatestKundliForUser(userId)`, `kundliRowToChunks(row)` for RAG.
- **`supa/supabaseClient.js`** – Single Supabase client (URL + service key from `.env`).
- **`supa/corsMiddleware.js`** – CORS headers for `http://localhost:5173` (and preflight).
- **`script.cjs`** – Standalone script: reads `notes.txt`, parses Kundli text, writes `kundli.json` (not part of the HTTP server).
- **`supa/chatController.js`** – Empty (stub).

---

## 3. Code Review – Summary

### 3.1 Strengths

- **ESM** used consistently (except `script.cjs`); structure is clear.
- **Separation of concerns**: routes in `authRoutes.js`, handlers in `authController.js` / `user_controller.js`, Supabase and RAG helpers in dedicated files.
- **Config from DB**: LLM config and system prompts loaded from Supabase (`llm_configs`, `system_prompts`), which is good for changing models/prompts without code deploy.
- **CORS** explicitly configured for the frontend origin.
- **Kundli RAG pipeline** (chunks → fake embed → cosine similarity → LLM) is readable and easy to extend (e.g. swap to real embeddings later).

### 3.2 Security

- **Passwords** are stored and compared in plaintext in `auth` (login/signup). Critical: move to proper auth (e.g. Supabase Auth) and never store plaintext passwords.
- **JWT in `index.js`** uses `SUPABASE_SERVICE_KEY` as secret; that key must never be exposed to clients. Prefer Supabase Auth JWTs and verify them in the API.
- **`/supa/auth/users`** returns all users; should be restricted (e.g. admin-only or removed from production).
- **No rate limiting** on `/query` or auth routes (e.g. `express-rate-limit` is installed but unused).
- **No request validation** (e.g. Zod): body/params are trusted; invalid input can cause 500s or unexpected behavior.
- **Debug route** `GET /debug/kundli/:user_id` exposes kundli data with no auth; should be disabled or protected in production.
- **CORS** is set to localhost only; ensure production origin is added when you deploy.

### 3.3 Reliability and correctness

- **User verification in `/query`** uses an HTTP call to the same server (`http://localhost:3000/supa/auth/users`). This is fragile (port/host hardcoded, server must be up) and inefficient; better to validate `userID` against Supabase (e.g. by session/JWT or by checking `auth` table in the same process).
- **`llmConfig`** is loaded once at startup in `server.js`. If DB config changes, the process must be restarted to pick it up; consider caching with TTL or reload on first use after a period.
- **Duplicate `loadSystemPrompt` / `loadLLMConfig`**: both in `server.js` and `user_controller.js`; could live in a small shared `config` or `llm` module.
- **`uploadKundli`** uses `processKundliUpload(user_id)` without `await` in one code path—actually it is awaited; no bug there. Good.
- **Error handling**: many `catch` blocks return generic “Server error” and log details. Good for not leaking internals; consider correlation IDs or request IDs in logs for debugging.

### 3.4 Consistency and maintainability

- **Two apps**: `server.js` (main) and `index.js` (auth-only). Clarify whether `index.js` is legacy or still required; if required, document how to run both (e.g. two `node` processes or a single entry that mounts both).
- **`package.json` "main"** is `index.js` while the primary app is `server.js`; align this (e.g. set `"main": "server.js"` and/or add a `"start": "node server.js"` script).
- **CORS** is applied both globally in `server.js` (cors middleware) and on the router via `corsMiddleware.js`; redundant but harmless. Could keep a single place (e.g. only in `server.js`).
- **Unused packages** (see section 1) add noise; removing them will make the dependency set easier to reason about.

### 3.5 Minor / style

- **`config()` from dotenv**: `server.js` uses `import dotenv, { config } from 'dotenv'; config();`; `supabaseClient.js` uses `dotenv.config()`. Both work; one style is enough.
- **Magic numbers**: e.g. `TOP_K = 5`, `port 3000`; consider env vars for port and tuning (e.g. `TOP_K`).
- **`chatController.js`** is empty; remove or add a minimal stub/comment so it’s clear whether it’s intentional.

---

## 4. Quick Wins

1. Remove unused dependencies and add a `"start": "node server.js"` script; set `"main": "server.js"` if this is the primary app.
2. Replace in-process user verification in `/query` with a direct Supabase (or JWT) check.
3. Protect or remove `GET /debug/kundli/:user_id` in production.
4. Add rate limiting (e.g. `express-rate-limit`) on `/query` and auth routes.
5. Plan migration from plaintext passwords to Supabase Auth (or another secure auth mechanism).
6. Optionally add request validation (e.g. Zod) for `/query` and auth payloads.
7. Consolidate `loadSystemPrompt` / `loadLLMConfig` in one module and reuse in `server.js` and `user_controller.js`.

---

*Generated as a one-time code review and package summary for the AdAstra backend.*
