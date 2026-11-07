-- M37 (docs/reading-engine/56 §4.1): store digested technique outputs by validity date range [valid_from, valid_to)
-- so callers inside the validity window read the stored output and skip running the processing agent.

CREATE TABLE IF NOT EXISTS "technique_outputs" (
  "cache_key"      TEXT        NOT NULL,
  "technique_id"   TEXT        NOT NULL,
  "kundli_id"      TEXT        NOT NULL,
  "digest_version" TEXT        NOT NULL,
  "freshness"      TEXT        NOT NULL,
  "valid_from"     TIMESTAMPTZ NOT NULL,
  "valid_to"       TIMESTAMPTZ,
  "output"         JSONB       NOT NULL,
  "output_schema"  TEXT        NOT NULL,
  "made_by_agent"  TEXT,
  "made_ms"        INTEGER     NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "hit_count"      INTEGER     NOT NULL DEFAULT 0,
  "last_hit_at"    TIMESTAMPTZ,
  CONSTRAINT "technique_outputs_pkey" PRIMARY KEY ("cache_key"),
  CONSTRAINT "technique_outputs_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_technique_outputs_kundli_technique" ON "technique_outputs" ("kundli_id", "technique_id");
CREATE INDEX IF NOT EXISTS "idx_technique_outputs_valid_to" ON "technique_outputs" ("valid_to");

