-- Self v2 validation failures (docs/reading-engine/66 §4.1, Sachin 2026-11-09): every finding of the Oracle and
-- Personalizer validators per build, with the area's status after the one Oracle repair pass. Staff-only; holds no words
-- of the person (validator reasons quote evidence keys, chart words and Oracle date labels), so it is not sealed.
-- Additive.
CREATE TABLE IF NOT EXISTS "reading_validation_failures" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL,
  "kundli_id" TEXT NOT NULL,
  "board" TEXT NOT NULL,
  "build_id" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "area" TEXT,
  "check" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "area_status" TEXT,
  "model" TEXT NOT NULL,
  "prompt_hash" TEXT NOT NULL,
  "call_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "reading_validation_failures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_validation_failures_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "reading_validation_failures_kundli_board_created_idx" ON "reading_validation_failures" ("kundli_id", "board", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "reading_validation_failures_build_idx" ON "reading_validation_failures" ("build_id");
