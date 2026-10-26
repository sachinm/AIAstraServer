-- Reading runs: keep Gemini's thought summaries next to the answer so the reasoning can be studied for discrepancies.
-- Additive and nullable: existing rows and writers that do not send it are unaffected.
ALTER TABLE "reading_runs" ADD COLUMN IF NOT EXISTS "thinking" TEXT;
