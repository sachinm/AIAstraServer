-- M37 (docs/admin/08): Per-request and per-page execution timing log across server routes, GraphQL operations,
-- SSE streams and browser page renders/draws. Zero PII.

CREATE TABLE IF NOT EXISTS "page_execution_logs" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "page" VARCHAR(120) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "operation" VARCHAR(160) NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 200,
    "duration_ms" INTEGER NOT NULL,
    "ttfb_ms" INTEGER,
    "server_ms" INTEGER,
    "db_ms" INTEGER,
    "render_ms" INTEGER,
    "draw_ms" INTEGER,
    "body_bytes" INTEGER,
    "cache_status" VARCHAR(24),
    "user_id" TEXT,
    "session_id" VARCHAR(64),
    "request_id" VARCHAR(64),
    "error_code" VARCHAR(80),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "page_execution_logs_page_created_idx" ON "page_execution_logs"("page", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "page_execution_logs_created_idx" ON "page_execution_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "page_execution_logs_source_created_idx" ON "page_execution_logs"("source", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "page_execution_logs_user_created_idx" ON "page_execution_logs"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "page_execution_logs_duration_idx" ON "page_execution_logs"("duration_ms" DESC);
