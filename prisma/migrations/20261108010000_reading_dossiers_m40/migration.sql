-- M40 (docs/reading-engine/60 §3): one research dossier per kundli per board per build content. Additive.
CREATE TABLE IF NOT EXISTS "reading_dossiers" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id" TEXT NOT NULL,
  "board" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "digest_version" TEXT NOT NULL,
  "clock" TEXT NOT NULL,
  "as_of" DATE NOT NULL,
  "valid_to" DATE,
  "bundle_hash" TEXT NOT NULL,
  "techniques" JSONB NOT NULL DEFAULT '[]',
  "rules" JSONB NOT NULL DEFAULT '[]',
  "data" JSONB NOT NULL DEFAULT '{}',
  "yogas" JSONB NOT NULL DEFAULT '[]',
  "clocks" JSONB NOT NULL DEFAULT '{}',
  "panels" JSONB NOT NULL DEFAULT '[]',
  "gaps" JSONB NOT NULL DEFAULT '[]',
  "audit" JSONB NOT NULL DEFAULT '{}',
  "oracle" JSONB,
  "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "reading_dossiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_dossiers_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "reading_dossiers_kundli_board_bundle_key" ON "reading_dossiers" ("kundli_id", "board", "bundle_hash");
CREATE INDEX IF NOT EXISTS "reading_dossiers_kundli_board_created_idx" ON "reading_dossiers" ("kundli_id", "board", "created_at" DESC);
