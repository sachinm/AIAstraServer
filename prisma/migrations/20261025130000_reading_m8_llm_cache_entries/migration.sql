-- Reading engine M8: registry of explicit LLM prompt caches (docs/reading-engine/20 §8, R-7).
-- One row per provider cache (Gemini cachedContents name). Instances look up a live row by prefix_hash before creating,
-- logout deletes the user's caches, and the sweeper deletes idle/expired ones and reconciles orphans. No foreign keys:
-- rows are bookkeeping and outlive nothing important.
CREATE TABLE "llm_cache_entries" (
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "user_id" TEXT,
  "kundli_id" TEXT,
  "prefix_hash" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "delete_error" TEXT,
  CONSTRAINT "llm_cache_entries_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "llm_cache_entries_prefix" ON "llm_cache_entries"("prefix_hash", "expires_at");
CREATE INDEX "llm_cache_entries_user" ON "llm_cache_entries"("user_id");
CREATE INDEX "llm_cache_entries_last_used" ON "llm_cache_entries"("last_used_at");
