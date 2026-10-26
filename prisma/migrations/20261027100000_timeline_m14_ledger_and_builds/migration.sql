-- Life timeline (docs/reading-engine/27 §B.2, phase P1): the ledger of real dated life events, the stored builds of the
-- timeline grid, their matches against the ledger, and the per-kundli calibration.
-- WRITTEN, NOT APPLIED: apply only with Sachin's OK. NEW tables only; nothing existing changes. Additive; re-running is
-- a no-op. The server reads and writes these with raw SQL and treats a missing table as "no ledger, cannot store"
-- (src/reading/timeline/store.ts), so the code ships safely before this migration is applied.
-- No foreign keys (like user_current_location): rows are keyed by user_id / kundli_id text. Account and kundli deletion
-- must clear life_events and timeline_* explicitly (the P0 ledger work owns that path).

-- 1. The ledger: facts only. `category` is dotted, from the marker table (e.g. 'job.start', 'residence.move',
--    'family.father.illness'); `attributes` holds colour, make, direction, floor, field, country, outcome, with whom.
--    No free-text judgement column on purpose.
CREATE TABLE IF NOT EXISTS "life_events" (
  "id"             TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"        TEXT NOT NULL,
  "kundli_id"      TEXT NOT NULL,
  "category"       TEXT NOT NULL,
  "date"           DATE NOT NULL,
  "date_precision" TEXT NOT NULL DEFAULT 'day',
  "place"          TEXT,
  "attributes"     JSONB NOT NULL DEFAULT '{}'::jsonb,
  "source"         TEXT NOT NULL DEFAULT 'user',
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "life_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "life_events_date_precision_check" CHECK ("date_precision" IN ('day', 'month', 'year')),
  CONSTRAINT "life_events_source_check" CHECK ("source" IN ('user', 'import'))
);
CREATE INDEX IF NOT EXISTS "life_events_kundli_date" ON "life_events" ("kundli_id", "date");
CREATE INDEX IF NOT EXISTS "life_events_user" ON "life_events" ("user_id");

-- 2. One row per timeline build of a kundli. `system_versions`: calc version of every catalogue type used; `weights`:
--    the weights the grid was scored with (defaults or calibrated). status: building | ready | failed.
CREATE TABLE IF NOT EXISTS "timeline_builds" (
  "id"              TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id"       TEXT NOT NULL,
  "dossier_hash"    TEXT,
  "from"            DATE NOT NULL,
  "to"              DATE NOT NULL,
  "grain"           TEXT NOT NULL DEFAULT 'month',
  "system_versions" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "weights"         JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status"          TEXT NOT NULL DEFAULT 'building',
  "cost_usd"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "timeline_builds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_builds_grain_check" CHECK ("grain" IN ('month', 'week', 'day')),
  CONSTRAINT "timeline_builds_status_check" CHECK ("status" IN ('building', 'ready', 'failed'))
);
CREATE INDEX IF NOT EXISTS "timeline_builds_kundli_created" ON "timeline_builds" ("kundli_id", "created_at");

-- 3. The grid: one row per marker window that is not quiet. `systems`: per system the strength, planet and evidence
--    paths. `testing` marks an adverse window (doc 27 §A.4). `how`, `form` and `prompt_version` stay null until the
--    annotation phase (P3).
CREATE TABLE IF NOT EXISTS "timeline_windows" (
  "id"             TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "build_id"       TEXT NOT NULL,
  "marker"         TEXT NOT NULL,
  "from"           DATE NOT NULL,
  "to"             DATE NOT NULL,
  "grain"          TEXT NOT NULL DEFAULT 'month',
  "band"           TEXT NOT NULL,
  "testing"        BOOLEAN NOT NULL DEFAULT false,
  "support_score"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "test_score"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "systems"        JSONB NOT NULL DEFAULT '{}'::jsonb,
  "agent"          TEXT,
  "channel"        TEXT,
  "how"            TEXT,
  "form"           JSONB,
  "prompt_version" TEXT,
  CONSTRAINT "timeline_windows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_windows_grain_check" CHECK ("grain" IN ('month', 'week', 'day')),
  CONSTRAINT "timeline_windows_band_check" CHECK ("band" IN ('high', 'moderate', 'possible'))
);
CREATE INDEX IF NOT EXISTS "timeline_windows_build_marker" ON "timeline_windows" ("build_id", "marker", "from");

-- 4. A ledger event against a build: hit | near | miss, with the window it fell in (null on a miss). `specifics`: per
--    attribute the predicted class, the actual and whether it was right (P3 fills it).
CREATE TABLE IF NOT EXISTS "timeline_matches" (
  "id"        TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "build_id"  TEXT NOT NULL,
  "event_id"  TEXT NOT NULL,
  "window_id" TEXT,
  "result"    TEXT NOT NULL,
  "specifics" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "timeline_matches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_matches_result_check" CHECK ("result" IN ('hit', 'near', 'miss'))
);
CREATE INDEX IF NOT EXISTS "timeline_matches_build" ON "timeline_matches" ("build_id");

-- 5. Calibration per kundli, system and marker: precision, recall, the number of ledger events behind them and the
--    weight the next build uses. One current row per (kundli, system, marker).
CREATE TABLE IF NOT EXISTS "timeline_calibration" (
  "kundli_id"   TEXT NOT NULL,
  "system"      TEXT NOT NULL,
  "marker"      TEXT NOT NULL,
  "precision"   DOUBLE PRECISION,
  "recall"      DOUBLE PRECISION,
  "n"           INTEGER NOT NULL DEFAULT 0,
  "weight"      DOUBLE PRECISION NOT NULL,
  "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "timeline_calibration_pkey" PRIMARY KEY ("kundli_id", "system", "marker")
);
