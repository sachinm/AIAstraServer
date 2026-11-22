-- M56 (docs/techniques/11 rev 4 §4.2): one status row per chart (src/reading/pipeline/status.ts), recomputed from the
-- stored rows at the end of every sync, digest and clock run. Plain columns only: stage, verdict, named gaps (type ids,
-- system ids, dates), counts. Additive: a new table, no change to an existing one. Written, not applied.
CREATE TABLE IF NOT EXISTS "kundli_pipeline" (
  "kundli_id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "verdict" TEXT NOT NULL,
  "gaps" JSONB NOT NULL DEFAULT '[]',
  "done" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "counts" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "kundli_pipeline_pkey" PRIMARY KEY ("kundli_id"),
  CONSTRAINT "kundli_pipeline_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "kundli_pipeline_stage_check" CHECK ("stage" IN ('registered', 'pulling', 'checking', 'chart_ready', 'preparing', 'ready', 'blocked', 'paused')),
  CONSTRAINT "kundli_pipeline_verdict_check" CHECK ("verdict" IN ('complete', 'complete_with_gaps', 'incomplete'))
);
CREATE INDEX IF NOT EXISTS "idx_kundli_pipeline_stage" ON "kundli_pipeline" ("stage");
