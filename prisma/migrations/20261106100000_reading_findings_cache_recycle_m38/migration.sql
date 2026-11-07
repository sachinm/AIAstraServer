-- M38: Add usage & owner tracking to reading_findings_cache and recycle indexes for 45-minute per-individual cache recycling.
ALTER TABLE "reading_findings_cache"
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hit_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "idx_reading_findings_cache_recycle"
  ON "reading_findings_cache" ("kundli_id", "last_used_at", "created_at");

CREATE INDEX IF NOT EXISTS "idx_technique_outputs_recycle"
  ON "technique_outputs" ("kundli_id", "hit_count", "last_hit_at", "created_at");
