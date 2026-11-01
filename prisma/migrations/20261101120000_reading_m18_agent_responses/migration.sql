-- M18: one row per agent response per question (docs/reading-engine/39 §4.1). Written by the journal only after the Oracle
-- and validator have finished. Holds each agent's prompt, digest and highlights, never the chart tables it read.
-- run_id has no foreign key: the journal's order against reading_runs must not decide whether an agent row survives.
CREATE TABLE "reading_agent_responses" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "run_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "message_id" TEXT,
    "question" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "agent_kind" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT,
    "tier" INTEGER,
    "model" TEXT,
    "prompt_name" TEXT,
    "prompt_version" TEXT NOT NULL,
    "prompt_sent" TEXT,
    "data_keys" JSONB NOT NULL DEFAULT '[]',
    "data_hash" TEXT,
    "digest" JSONB NOT NULL DEFAULT '{}',
    "highlights" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'live',
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "thought_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "reading_agent_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_agent_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "reading_agent_responses_run" ON "reading_agent_responses"("run_id");
CREATE INDEX "reading_agent_responses_user_created" ON "reading_agent_responses"("user_id", "created_at" DESC);
