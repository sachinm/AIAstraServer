-- Plans and question limits (docs/billing/README.md). Access reads is_paid and paid_plan; only the payment side writes them.
-- Rows are created on first use, so this needs no backfill. Nothing reads these tables until PLANS_ENABLED=1.
ALTER TABLE "auth" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "auth" ADD COLUMN "research" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "billing_accounts" (
    "user_id" TEXT NOT NULL,
    "desired_plan" TEXT NOT NULL DEFAULT 'free',
    "desired_interval" TEXT,
    "desired_at" TIMESTAMPTZ(6),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_plan" TEXT,
    "paid_interval" TEXT,
    "paid_since" TIMESTAMPTZ(6),
    "paid_until" TIMESTAMPTZ(6),
    "payment_ref" TEXT,
    "billing_country" TEXT,
    "question_quota" INTEGER,
    "questions_used_this_month" INTEGER NOT NULL DEFAULT 0,
    "usage_month_start" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "billing_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "question_usage" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "open_parts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chat_id" TEXT,
    "message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(6),

    CONSTRAINT "question_usage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "question_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "question_usage_user_key" ON "question_usage"("user_id", "key");
CREATE INDEX "question_usage_user_status" ON "question_usage"("user_id", "status", "created_at");
