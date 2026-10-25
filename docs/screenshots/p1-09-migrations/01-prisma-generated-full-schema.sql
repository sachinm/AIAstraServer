-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "auth" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "date_of_birth" TEXT NOT NULL,
    "place_of_birth" TEXT,
    "time_of_birth" TEXT,
    "email" TEXT NOT NULL,
    "gender" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "kundli_added" BOOLEAN DEFAULT false,
    "role" TEXT DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signup_ip" TEXT,
    "magic_link_code_hash" TEXT,
    "magic_link_expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kundlis" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "user_id" TEXT NOT NULL,
    "biodata" JSONB,
    "d1" JSONB,
    "d2" JSONB,
    "d4" JSONB,
    "d7" JSONB,
    "d9" JSONB,
    "d10" JSONB,
    "charakaraka" JSONB,
    "vimsottari_dasa" JSONB,
    "narayana_dasa" JSONB,
    "other_readings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queue_status" TEXT NOT NULL DEFAULT 'pending',
    "queue_started_at" TIMESTAMP(3),
    "queue_completed_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "tz" DOUBLE PRECISION,
    "place_resolved" TEXT,
    "facts_status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "kundlis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_prompts" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "system_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_generated_content" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "user_id" TEXT NOT NULL,
    "kundli_id" TEXT NOT NULL,
    "remedies" JSONB,
    "mantras" JSONB,
    "routines" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_generated_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "chat_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "ai_answer" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_logs" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "chat_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB NOT NULL,
    "client_delivery_sse" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kundli_facts" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "kundli_id" TEXT NOT NULL,
    "facts_version" INTEGER NOT NULL,
    "engine_commit" TEXT NOT NULL,
    "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
    "dossier" JSONB NOT NULL,
    "natal_points" JSONB NOT NULL,
    "dossier_hash" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kundli_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transit_snapshots" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "from_date" DATE NOT NULL,
    "to_date" DATE NOT NULL,
    "kundli_id" TEXT,
    "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
    "snapshot_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transit_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_runs" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "message_id" TEXT,
    "status" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" JSONB,
    "intent_confirmed" JSONB,
    "facts_version" INTEGER,
    "dossier_hash" TEXT,
    "transit_snapshot_id" TEXT,
    "pack_hashes" JSONB,
    "findings" JSONB,
    "windows" JSONB,
    "agreement" JSONB,
    "answer" TEXT,
    "models" JSONB,
    "usage" JSONB,
    "cost_usd" DECIMAL(10,6),
    "timings_ms" JSONB,
    "cache" JSONB,
    "dropped_claims" INTEGER,
    "grounding" JSONB,
    "errors" JSONB,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "reading_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_kundlis_user_id" ON "kundlis"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_prompts_name_key" ON "system_prompts"("name");

-- CreateIndex
CREATE INDEX "idx_user_generated_content_kundli_id" ON "user_generated_content"("kundli_id");

-- CreateIndex
CREATE INDEX "idx_user_generated_content_user_id" ON "user_generated_content"("user_id");

-- CreateIndex
CREATE INDEX "idx_chats_user_id" ON "chats"("user_id");

-- CreateIndex
CREATE INDEX "idx_messages_chat_id" ON "messages"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_logs_message_id_key" ON "chat_logs"("message_id");

-- CreateIndex
CREATE INDEX "idx_chat_logs_chat_id" ON "chat_logs"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "kundli_facts_kundli_version" ON "kundli_facts"("kundli_id", "facts_version");

-- CreateIndex
CREATE INDEX "transit_snapshots_range" ON "transit_snapshots"("from_date", "to_date");

-- CreateIndex
CREATE INDEX "transit_snapshots_kundli_range" ON "transit_snapshots"("kundli_id", "from_date", "to_date");

-- CreateIndex
CREATE UNIQUE INDEX "reading_runs_message_id_key" ON "reading_runs"("message_id");

-- CreateIndex
CREATE INDEX "reading_runs_user_created" ON "reading_runs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reading_runs_chat" ON "reading_runs"("chat_id");

-- AddForeignKey
ALTER TABLE "kundlis" ADD CONSTRAINT "kundlis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_generated_content" ADD CONSTRAINT "user_generated_content_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_generated_content" ADD CONSTRAINT "user_generated_content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "kundli_facts" ADD CONSTRAINT "kundli_facts_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transit_snapshots" ADD CONSTRAINT "transit_snapshots_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_runs" ADD CONSTRAINT "reading_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_runs" ADD CONSTRAINT "reading_runs_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reading_runs" ADD CONSTRAINT "reading_runs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

