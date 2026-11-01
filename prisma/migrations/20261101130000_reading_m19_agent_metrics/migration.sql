-- M19: per-query and per-agent metrics (docs/reading-engine/41). Times, tokens and estimated cost only: no prompt, chart or
-- model text. The app runs without these tables: writes fail quietly and the reading is not affected.
CREATE TABLE "reading_traces" (
    "run_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "flow" TEXT,
    "question" TEXT,
    "clarify_run_id" TEXT,
    "status" TEXT NOT NULL,
    "agents_spawned" INTEGER NOT NULL DEFAULT 0,
    "agents_failed" INTEGER NOT NULL DEFAULT 0,
    "model_calls" INTEGER NOT NULL DEFAULT 0,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "thought_tokens" INTEGER NOT NULL DEFAULT 0,
    "est_cost_usd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "unpriced_calls" INTEGER NOT NULL DEFAULT 0,
    "ttft_ms" INTEGER,
    "ms" INTEGER,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "reading_traces_pkey" PRIMARY KEY ("run_id"),
    CONSTRAINT "reading_traces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "reading_traces_started" ON "reading_traces"("started_at" DESC);
CREATE INDEX "reading_traces_status_started" ON "reading_traces"("status", "started_at" DESC);
CREATE INDEX "reading_traces_user_started" ON "reading_traces"("user_id", "started_at" DESC);
CREATE INDEX "reading_traces_clarify" ON "reading_traces"("clarify_run_id");

CREATE TABLE "reading_agent_spans" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "run_id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "agent_kind" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6) NOT NULL,
    "ms" INTEGER NOT NULL,
    "ttft_ms" INTEGER,
    "steps" JSONB,
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "thought_tokens" INTEGER NOT NULL DEFAULT 0,
    "est_cost_usd" DECIMAL(10,6),

    CONSTRAINT "reading_agent_spans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_agent_spans_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "reading_traces"("run_id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "reading_agent_spans_run" ON "reading_agent_spans"("run_id", "started_at");
CREATE INDEX "reading_agent_spans_agent" ON "reading_agent_spans"("agent", "level", "started_at" DESC);
CREATE INDEX "reading_agent_spans_kind" ON "reading_agent_spans"("agent_kind", "level", "started_at" DESC);
