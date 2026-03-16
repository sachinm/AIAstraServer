-- Add chat_id to chat_logs so logs can be queried by chat/thread (denormalized for convenience).
-- Add as nullable, backfill from messages, delete any rows without a chat_id, then set NOT NULL.

ALTER TABLE "chat_logs" ADD COLUMN "chat_id" TEXT;

UPDATE "chat_logs" SET "chat_id" = "messages"."chat_id"
FROM "messages"
WHERE "messages"."id" = "chat_logs"."message_id";

DELETE FROM "chat_logs" WHERE "chat_id" IS NULL;

ALTER TABLE "chat_logs" ALTER COLUMN "chat_id" SET NOT NULL;

CREATE INDEX "idx_chat_logs_chat_id" ON "chat_logs"("chat_id");

ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
