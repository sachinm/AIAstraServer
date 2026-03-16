# Backend

## Environment

- **NODE_ENV**: `development` | `staging` | `production`. Defaults to `development` if unset.
- Copy `.env.example` to `.env` and set at least `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (min 32 chars).

## AstroKundli (3rd party horoscope API)

The queue worker fetches missing Kundli data from the AstroKundli API. Set base URLs per environment:

- **Local / development**: `ASTROKUNDLI_BASE_URL_LOCAL` (e.g. `http://localhost:8765`)
- **Staging**: `ASTROKUNDLI_BASE_URL_STAGING` (e.g. `http://localhost:8766`)
- **Production**: `ASTROKUNDLI_BASE_URL_PROD` (e.g. `http://localhost:8767`)

If these are not set, the server still starts but the Kundli sync queue worker does not run. Optional: `ASTROKUNDLI_API_KEY` if the 3rd party requires it.

## Database

- Run migrations: `npx prisma migrate deploy` (requires `DATABASE_URL` and `DIRECT_URL` in `.env`).
- Kundli table includes `queue_status`, `queue_started_at`, `queue_completed_at`, `last_sync_error` for the async sync queue.

## Staging / production

1. Set `NODE_ENV=staging` or `NODE_ENV=production`.
2. Set the corresponding `ASTROKUNDLI_BASE_URL_*` and other env vars.
3. Run `npx prisma migrate deploy` before starting the server.
4. Smoke test: login, then confirm Kundli sync runs (logs show `astrokundli_call` with outcome passed/failed/error).

## Tests

- `npm run test:unit` – unit tests (no DB). Excludes `db-connection` and `auth-flow` by default.
- `npm run test` – all tests including DB and auth flow (requires DB and env).
