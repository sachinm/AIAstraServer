-- AlterTable
ALTER TABLE "auth" ADD COLUMN "signup_ip" TEXT;
ALTER TABLE "auth" ADD COLUMN "magic_link_code_hash" TEXT;
ALTER TABLE "auth" ADD COLUMN "magic_link_expires_at" TIMESTAMPTZ(6);
