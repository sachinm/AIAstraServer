-- Admin staff sign-in second factor (aiadastra_admin, branch feat/admin-turnstile-otp). Adds only.
-- NOT APPLIED. This repo never changes the schema: the deploy session copies this folder to
-- AIAstra_Server/prisma/migrations/20261108140000_admin_staff_otp/ (next to M25 admin_accounts), gives it the next free
-- M-number (M41-M44 are claimed by plans in AIAstra_Server docs), and applies it with `npx.cmd prisma migrate deploy`.
--
-- 1. admin_accounts.email: where the six-digit sign-in code goes. Set it with
--    `npx tsx scripts/admin-accounts.ts set-email <username> <email>` (api/). Nullable: an account without one cannot
--    sign in while ADMIN_EMAIL_OTP_REQUIRED is on (otp_unavailable).
ALTER TABLE "admin_accounts" ADD COLUMN "email" TEXT;

-- 2. One row per sign-in that passed the password step. Only an HMAC-SHA256 of the code is stored (key derived from
--    ADMIN_JWT_SECRET, salted by the id), never the code. 10 minutes, 5 tries, 3 resends at least 60 s apart, bound to
--    the address that passed the password step, single use (consumed_at).
CREATE TABLE "admin_otp_challenges" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_otp_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_otp_challenges_admin_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "admin_otp_challenges_attempts_check" CHECK ("attempts" >= 0 AND "resend_count" >= 0)
);

-- the open challenge of an account (a new sign-in closes the previous one)
CREATE INDEX "admin_otp_challenges_admin_open" ON "admin_otp_challenges"("admin_id") WHERE "consumed_at" IS NULL;
CREATE INDEX "admin_otp_challenges_created" ON "admin_otp_challenges"("created_at" DESC);
