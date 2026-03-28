-- Chat delivery channel: SSE (/api/chat/ask-stream) vs GraphQL ask (matches VITE_CHAT_STREAM when client uses default).
ALTER TABLE "chat_logs" ADD COLUMN "client_delivery_sse" BOOLEAN NOT NULL DEFAULT false;
