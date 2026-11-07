-- M35 (docs/admin/06): Clarify decision log & counterfactual monitor, cross-Lambda reader findings cache,
-- table write attribution on reading_traces, and security dashboard indexes.

ALTER TABLE "reading_traces"
  ADD COLUMN IF NOT EXISTS "clarify_monitor" JSONB,
  ADD COLUMN IF NOT EXISTS "tables_written" JSONB;

CREATE TABLE IF NOT EXISTS "reading_findings_cache" (
  "cache_key" TEXT NOT NULL,
  "kundli_id" TEXT NOT NULL,
  "reader_id" TEXT NOT NULL,
  "pack_hash" TEXT NOT NULL,
  "horizon_key" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reading_findings_cache_pkey" PRIMARY KEY ("cache_key")
);

CREATE INDEX IF NOT EXISTS "reading_findings_cache_kundli_idx"
  ON "reading_findings_cache" ("kundli_id", "expires_at" DESC);

CREATE INDEX IF NOT EXISTS "reading_findings_cache_expires_idx"
  ON "reading_findings_cache" ("expires_at");

CREATE INDEX IF NOT EXISTS "account_events_outcome_created"
  ON "account_events" ("outcome", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "admin_actions_action_created"
  ON "admin_actions" ("action", "created_at" DESC);
