-- Conversation categories (docs/reading-engine/51): General Reading is one category of conversation; a question asked
-- from a board opens a conversation in that board's category. Additive; re-running is a no-op.
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS "idx_chats_user_category" ON "chats" ("user_id", "category");
