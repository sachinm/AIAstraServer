-- M53: Admin-sent and system notifications delivered to a user's header inbox.
CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL,
  "sender_admin_id" TEXT,
  "sender_label" TEXT,
  "category" TEXT NOT NULL DEFAULT 'admin_message',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "action_url" TEXT,
  "action_label" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_notifications_category_check" CHECK ("category" IN ('admin_message', 'system', 'reading', 'billing')),
  CONSTRAINT "user_notifications_priority_check" CHECK ("priority" IN ('normal', 'important')),
  CONSTRAINT "user_notifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "user_notifications_sender_admin_fkey" FOREIGN KEY ("sender_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_user_notifications_inbox" ON "user_notifications" ("user_id", "dismissed_at", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_user_notifications_unread" ON "user_notifications" ("user_id", "read_at");
