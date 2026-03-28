-- CreateTable
CREATE TABLE "chat_logs_thinking" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "chat_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_thinking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_logs_thinking_message_id_key" ON "chat_logs_thinking"("message_id");

-- CreateIndex
CREATE INDEX "idx_chat_logs_thinking_chat_id" ON "chat_logs_thinking"("chat_id");

-- AddForeignKey
ALTER TABLE "chat_logs_thinking" ADD CONSTRAINT "chat_logs_thinking_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_logs_thinking" ADD CONSTRAINT "chat_logs_thinking_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
