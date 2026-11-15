-- M53: Resumable Generative AI State Machine (Feature 20)
CREATE TABLE IF NOT EXISTS "chat_turns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kundli_id" TEXT,
    "session_id" TEXT,
    "question" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "seq" INTEGER NOT NULL DEFAULT 0,
    "events" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "chat_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_turns_user_created_idx" ON "chat_turns"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_turns_status_idx" ON "chat_turns"("status");
