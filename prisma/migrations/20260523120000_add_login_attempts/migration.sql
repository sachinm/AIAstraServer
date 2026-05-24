-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "failure_reason" TEXT,
    "auth_method" TEXT NOT NULL,
    "user_id" TEXT,
    "identifier_type" TEXT,
    "identifier_hash" TEXT,
    "client_ip" TEXT,
    "user_agent" TEXT,
    "accept_language" TEXT,
    "origin" TEXT,
    "country_code" TEXT,
    "device_class" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "turnstile_ok" BOOLEAN,
    "request_id" TEXT,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_login_attempts_user_occurred" ON "login_attempts"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_login_attempts_identifier_occurred" ON "login_attempts"("identifier_hash", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_login_attempts_ip_occurred" ON "login_attempts"("client_ip", "occurred_at");

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
