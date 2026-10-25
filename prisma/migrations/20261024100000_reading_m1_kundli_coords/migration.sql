-- M1 (reading engine Phase 1): store coordinates once and track the facts build state.
-- facts_status: pending | building | ready | failed
ALTER TABLE "kundlis"
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lon" DOUBLE PRECISION,
  ADD COLUMN "tz" DOUBLE PRECISION,
  ADD COLUMN "place_resolved" TEXT,
  ADD COLUMN "facts_status" TEXT NOT NULL DEFAULT 'pending';
