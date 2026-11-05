-- M24: technique labels on traces and subject/tier on spans, so the admin can average by agent type and technique
-- (docs/admin/01 §4.1.6). Adds only; old rows keep nulls.
ALTER TABLE "reading_traces"
    ADD COLUMN "bucket" TEXT,
    ADD COLUMN "template" TEXT,
    ADD COLUMN "tier" INTEGER,
    ADD COLUMN "route" TEXT,
    ADD COLUMN "subjects" INTEGER;

CREATE INDEX "reading_traces_flow_started" ON "reading_traces"("flow", "started_at" DESC);
CREATE INDEX "reading_traces_bucket_started" ON "reading_traces"("bucket", "started_at" DESC);

ALTER TABLE "reading_agent_spans"
    ADD COLUMN "subject" TEXT,
    ADD COLUMN "tier" INTEGER;

CREATE INDEX "reading_agent_spans_started" ON "reading_agent_spans"("started_at" DESC);
