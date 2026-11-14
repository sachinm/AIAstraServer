-- M52: Phase 1 Enterprise Security Hardening & Dual-Plane Error Observability
-- 1. Cross-Lambda OTP verification brute-force lockout counters on auth
ALTER TABLE "auth"
  ADD COLUMN IF NOT EXISTS "failed_otp_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otp_locked_until" TIMESTAMPTZ(6);

-- 2. Unified PII-redacted error ledger (Web JS, React ErrorBoundary, CSP, GraphQL, RBAC, REST 5xx, Auth 503)
CREATE TABLE IF NOT EXISTS "app_error_events" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "source" VARCHAR(32) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'error',
    "category" VARCHAR(64) NOT NULL,
    "error_code" VARCHAR(80) NOT NULL,
    "status_code" INTEGER,
    "page" VARCHAR(120),
    "operation" VARCHAR(160),
    "message_redacted" TEXT NOT NULL,
    "stack_fingerprint" VARCHAR(32),
    "stack_preview" TEXT,
    "request_id" VARCHAR(64),
    "session_id" VARCHAR(64),
    "user_id" TEXT,
    "ip_masked" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "meta" JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT "app_error_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "app_error_events_created_idx" ON "app_error_events"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "app_error_events_source_created_idx" ON "app_error_events"("source", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "app_error_events_category_created_idx" ON "app_error_events"("category", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "app_error_events_code_created_idx" ON "app_error_events"("error_code", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "app_error_events_fp_created_idx" ON "app_error_events"("stack_fingerprint", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "app_error_events_request_idx" ON "app_error_events"("request_id");
CREATE INDEX IF NOT EXISTS "app_error_events_user_created_idx" ON "app_error_events"("user_id", "created_at" DESC);
