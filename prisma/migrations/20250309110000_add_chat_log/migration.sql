-- CreateTable
CREATE TABLE "chat_logs" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "message_id" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_logs_message_id_key" ON "chat_logs"("message_id");

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
