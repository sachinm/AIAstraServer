-- docs/reading-engine/85 (2026-11-18): a chat on every card. A card-chat thread is an ordinary row of `chats` tied to
-- its card by `card_ref` ('<board>:<cardId>', e.g. 'self:mind', 'love:dating_pulse'); the open finds the newest thread
-- of a card by (user_id, card_ref), whatever its is_active. Additive only: a nullable column and an index; every
-- existing row keeps card_ref NULL (an ordinary chat). No data is changed.
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "card_ref" TEXT;
CREATE INDEX IF NOT EXISTS "idx_chats_user_card_ref" ON "chats" ("user_id", "card_ref");
