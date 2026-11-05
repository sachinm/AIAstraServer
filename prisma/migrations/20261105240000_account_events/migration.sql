-- The account-change log (docs/admin/02, docs/TODOS.md): what a person changes about their account, from which IP and
-- user agent, and when. Separate from analytics_events (clicks) and admin_actions (staff). No foreign key on user_id:
-- the record stays when the account is deleted.
CREATE TABLE IF NOT EXISTS "account_events" (
  "id"              TEXT           NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"         TEXT,
  "actor"           TEXT           NOT NULL DEFAULT 'self',
  "action"          TEXT           NOT NULL,
  "outcome"         TEXT           NOT NULL DEFAULT 'ok',
  "fields"          JSONB          NOT NULL DEFAULT '[]'::jsonb,
  "before"          JSONB,
  "after"           JSONB,
  "note"            TEXT,
  "ip"              TEXT,
  "ip_chain"        TEXT,
  "user_agent"      TEXT,
  "accept_language" TEXT,
  "country"         TEXT,
  "request_id"      TEXT,
  "path"            TEXT,
  "method"          TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "account_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "account_events_user" ON "account_events" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "account_events_action" ON "account_events" ("action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "account_events_ip" ON "account_events" ("ip", "created_at" DESC);
