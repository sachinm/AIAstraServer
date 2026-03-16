---
name: Queue seed users and scheduling
overview: Add a seed script that creates 10 randomized users with DOB/TOB/place and pending Kundli rows; document the existing queue task and its logging; and make scheduling configurable (interval env, optional cron or internal HTTP endpoint).
todos: []
isProject: false
---

# Queue: Seed Users, Scheduling, and Logging

## Current state

**Backend queue task:** Yes. It runs in-process in [backend/server.ts](backend/server.ts):

- After the server listens, if `isAstroKundliConfigured()` is true, a **setInterval** runs every **30 seconds** (`KUNDLI_QUEUE_INTERVAL_MS = 30_000`).
- Each tick calls `processKundliSyncQueue(prisma)` from [backend/src/services/kundliQueueService.ts](backend/src/services/kundliQueueService.ts).
- The worker fetches up to 10 `Kundli` rows with `queue_status: 'pending'`, sets them to `in_progress`, calls the AstroKundli API per missing field (biodata, d1, d7, etc.), writes results to the DB, then sets `queue_status: 'completed'` and `auth.kundli_added = true` when biodata + d1 are present.

**Logging and error handling:** Already in place in `kundliQueueService.ts` and `server.ts`:


| Where                                    | What                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logAstroKundliCall(...)`                | Every AstroKundli call: JSON log with `event: 'astrokundli_call'`, `user_id`, `kundli_id`, `field`, `outcome` (passed/failed/error), `duration_ms`, `error_message` (if any). |
| Failed status update to `in_progress`    | `console.error(JSON.stringify({ event: 'kundli_queue_update_failed', kundli_id, user_id, error }))`.                                                                          |
| Params derivation failure (e.g. decrypt) | `last_sync_error` saved on Kundli row; `logAstroKundliCall(..., 'error', 0, msg)`; row marked completed with error.                                                           |
| API or per-field update failure          | `logAstroKundliCall` with outcome `failed` or `error` and `error_message`; failed fields not persisted.                                                                       |
| Top-level tick failure                   | In `server.ts`: `processKundliSyncQueue(prisma).catch(err => console.error('Kundli queue tick failed:', err.message))`.                                                       |


So the queue task exists, and errors are logged (console JSON + `last_sync_error` on the row). The plan below adds a seed script, improves scheduling options, and optionally strengthens logging (structured, batch-start log).

---

## 1. Seed script: 10 randomized users with pending queue

**Goal:** One-off script that creates 10 `Auth` users with random DOB, TOB, and place of birth, and a `Kundli` row per user with `queue_status: 'pending'` so the existing worker picks them up.

**Implementation:**

- **New file:** [backend/scripts/seed-queue-users.ts](backend/scripts/seed-queue-users.ts) (TypeScript, run with `tsx` or via `npm run build` then `node dist/scripts/seed-queue-users.js`).
- **Logic:**
  - Use Prisma, `hashPassword` from [backend/src/lib/hash.ts](backend/src/lib/hash.ts), and `encrypt` from [backend/src/lib/encrypt.ts](backend/src/lib/encrypt.ts) (same as [backend/src/services/authService.ts](backend/src/services/authService.ts) and [backend/src/ensureSuperadmin.ts](backend/src/ensureSuperadmin.ts)).
  - Define 10 fixed “random” user payloads (e.g. array of `{ username, email, date_of_birth, time_of_birth, place_of_birth }`) with varied Indian cities and dates so no external RNG is required and the script is deterministic. Example: usernames like `seeduser1`…`seeduser10`, emails `seeduser1@example.com`, DOBs like 1990–2000, TOBs like 08:00–22:00, places like "Mumbai, IN", "Delhi, IN", "Chennai, IN", etc.
  - For each payload: hash a shared placeholder password (e.g. `SeedUser#123`), encrypt DOB/TOB/place (or store plain if `ENCRYPTION_KEY` is not set, matching authService behavior), then `prisma.auth.create` with `role: 'user'` or `'astrology_student'`.
  - After each `auth.create`, call `enqueueKundliSync(prisma, created.id)` from [backend/src/services/kundliQueueService.ts](backend/src/services/kundliQueueService.ts) so a Kundli row with `queue_status: 'pending'` is created (or existing one set to pending).
  - Load `dotenv` and use the same Prisma instance as the app (e.g. from `../src/lib/prisma.js` when run from `dist/scripts`).
- **Idempotency:** Check for existing users by username (e.g. `seeduser1`…`seeduser10`) and skip or update; or document that the script is “run once” and not re-run without clearing those users.
- **npm script:** Add in [backend/package.json](backend/package.json) something like `"seed:queue-users": "tsx scripts/seed-queue-users.ts"` (or `node dist/scripts/seed-queue-users.js` after build). If `tsx` is not present, add it as a devDependency or use `node --loader ts-node/esm` / build-first approach.

**Schema:** [backend/prisma/schema.prisma](backend/prisma/schema.prisma) already has `Auth` (username, password, date_of_birth, place_of_birth, time_of_birth, email, role, etc.) and `Kundli` (user_id, queue_status). No migration required.

---

## 2. Scheduling: make interval configurable; optional cron or HTTP trigger

**Current:** Fixed 30s interval in [backend/server.ts](backend/server.ts) (`KUNDLI_QUEUE_INTERVAL_MS = 30_000`).

**Changes:**

- **Configurable interval:** Read interval from env, e.g. `KUNDLI_QUEUE_INTERVAL_MS` (default 30000). In `server.ts`, use `Number(process.env.KUNDLI_QUEUE_INTERVAL_MS) || 30_000` and pass it to `setInterval`. Document in [backend/.env.example](backend/.env.example).
- **Optional cron-style scheduling:** If you want cron expressions (e.g. “every minute” or “at 0s of every minute”) instead of a fixed interval, add a lightweight scheduler (e.g. `node-cron`). In `server.ts`, when AstroKundli is configured, if `KUNDLI_QUEUE_CRON` is set, use cron to invoke `processKundliSyncQueue(prisma)` instead of (or in addition to) setInterval; otherwise keep setInterval. This keeps a single process and no extra infra.
- **Optional internal HTTP endpoint (for external cron):** For production setups that prefer an external scheduler (e.g. Kubernetes CronJob, AWS EventBridge, system cron), add a protected route, e.g. `POST /internal/process-kundli-queue`, secured by a shared secret (e.g. `Authorization: Bearer <INTERNAL_CRON_SECRET>` or `X-Internal-Secret` header). When valid, call `processKundliSyncQueue(prisma)` and return 200 with a short JSON summary (e.g. processed count). Disable or restrict this route in development if desired (e.g. only when `INTERNAL_CRON_SECRET` is set). Document in README.

Recommendation: implement **configurable interval** and **.env.example** in this plan; treat **cron** and **HTTP endpoint** as optional follow-ups so the plan stays small.

---

## 3. Logging: confirm and optionally enhance

**Already present:**

- Per-call: `logAstroKundliCall` (JSON with event, user_id, kundli_id, field, outcome, duration_ms, error_message).
- Queue update failure: `kundli_queue_update_failed`.
- Params/decrypt errors: stored in `last_sync_error` and logged via `logAstroKundliCall`.
- Tick failure in server: `console.error('Kundli queue tick failed:', ...)`.

**Optional improvements (short):**

- **Batch start log:** At the start of each `processKundliSyncQueue` run, log one JSON line, e.g. `{ event: 'kundli_queue_tick_start', pending_count: N }` (where N = number of rows being processed). Helps correlate logs with queue depth.
- **Structured logger:** If the project later adopts a logger (e.g. pino), replace `console.log`/`console.error` in the queue service with that logger so levels and formatting are consistent; no change to the current event shapes required.

---

## 4. Summary and file list


| Item        | Action                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed script | Add [backend/scripts/seed-queue-users.ts](backend/scripts/seed-queue-users.ts): 10 users with random DOB/TOB/place, hashed password, encrypted PII; call `enqueueKundliSync` per user. Add npm script to run it. |
| Queue task  | Already exists: `setInterval` in [backend/server.ts](backend/server.ts) calling `processKundliSyncQueue` every 30s when AstroKundli is configured.                                                               |
| Scheduling  | Make interval configurable via `KUNDLI_QUEUE_INTERVAL_MS` in [backend/server.ts](backend/server.ts) and [backend/.env.example](backend/.env.example). Optionally add cron or internal HTTP endpoint later.       |
| Logging     | Already in place (see table above). Optionally add a single “tick start” log with pending count.                                                                                                                 |


No schema or migration changes required. The worker already processes up to 10 pending rows per tick; the seed script will create 10 users and 10 pending Kundli rows so they are picked up on the next run(s).