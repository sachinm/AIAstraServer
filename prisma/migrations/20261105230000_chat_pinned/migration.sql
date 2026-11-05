-- Pinned threads (docs/reading-engine/51 §4): one /dashboard/chat, every thread in it, the person's pinned threads at the
-- top. Additive; re-running is a no-op.
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMPTZ(6);
