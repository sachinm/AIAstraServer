-- Reading engine M13: where the person lives now (city as typed + IANA timezone from the browser), one row per user.
-- Used to state transit timing in local terms; no astrological computation reads it. A NEW table so nothing existing
-- changes: the server treats a missing table as "no location" (src/services/userLocation.ts), so the code ships safely
-- before this migration is applied. No foreign key (like llm_cache_entries): rows are a small per-user preference.
-- Additive; re-running is a no-op.
CREATE TABLE IF NOT EXISTS "user_current_location" (
  "user_id"    TEXT NOT NULL,
  "place"      TEXT NOT NULL,
  "tz"         TEXT,
  "lat"        DOUBLE PRECISION,
  "lon"        DOUBLE PRECISION,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_current_location_pkey" PRIMARY KEY ("user_id")
);
