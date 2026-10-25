-- M2 (reading engine Phase 1): chart-facts dossier per kundli and facts version.
CREATE TABLE "kundli_facts" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id" TEXT NOT NULL,
  "facts_version" INTEGER NOT NULL,
  "engine_commit" TEXT NOT NULL,
  "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
  "dossier" JSONB NOT NULL,
  "natal_points" JSONB NOT NULL,
  "dossier_hash" TEXT NOT NULL,
  "source_hash" TEXT NOT NULL,
  "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kundli_facts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kundli_facts_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "kundli_facts_kundli_version" ON "kundli_facts"("kundli_id", "facts_version");
