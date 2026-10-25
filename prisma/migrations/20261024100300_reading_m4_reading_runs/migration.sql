-- M4 (reading engine Phase 2 graph, shipped with Phase 1 because the fan-out runs now): per-run observability.
-- status: intake | awaiting_confirm | running | done | failed | abandoned
CREATE TABLE "reading_runs" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL,
  "chat_id" TEXT,
  "message_id" TEXT,
  "status" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "intent" JSONB,
  "intent_confirmed" JSONB,
  "facts_version" INTEGER,
  "dossier_hash" TEXT,
  "transit_snapshot_id" TEXT,
  "pack_hashes" JSONB,
  "findings" JSONB,
  "windows" JSONB,
  "agreement" JSONB,
  "answer" TEXT,
  "models" JSONB,
  "usage" JSONB,
  "cost_usd" DECIMAL(10,6),
  "timings_ms" JSONB,
  "cache" JSONB,
  "dropped_claims" INTEGER,
  "grounding" JSONB,
  "errors" JSONB,
  "prompt_version" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "reading_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "reading_runs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "reading_runs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "reading_runs_message_id_key" ON "reading_runs"("message_id");
CREATE INDEX "reading_runs_user_created" ON "reading_runs"("user_id", "created_at" DESC);
CREATE INDEX "reading_runs_chat" ON "reading_runs"("chat_id");
