-- Registration v2: two-page signup (name + email, verify code, then birth details).
-- Written only; apply with Sachin's OK. No pgcrypto needed.

ALTER TABLE "auth"
  ADD COLUMN IF NOT EXISTS "name"                TEXT,
  ADD COLUMN IF NOT EXISTS "country_code"        TEXT,
  ADD COLUMN IF NOT EXISTS "city"                TEXT,
  ADD COLUMN IF NOT EXISTS "email_verified_at"   TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "profile_complete"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "referral_code"       TEXT,
  ADD COLUMN IF NOT EXISTS "referred_by_user_id" TEXT;

-- Existing users are complete (default above) and their addresses count as verified.
UPDATE "auth" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;

-- Referral code for existing rows: 8 characters from [A-Z2-9] (hex digits, with 0 and 1 mapped to G and H).
UPDATE "auth"
   SET "referral_code" = translate(upper(substr(md5("id" || random()::text || clock_timestamp()::text), 1, 8)), '01', 'GH')
 WHERE "referral_code" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "auth_referral_code_key" ON "auth"("referral_code");

ALTER TABLE "auth"
  ADD CONSTRAINT "auth_referred_by_user_id_fkey"
  FOREIGN KEY ("referred_by_user_id") REFERENCES "auth"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "idx_auth_referred_by_user_id" ON "auth"("referred_by_user_id");

-- gender: the column exists. Fold old free-text values (e.g. 'Male', 'F') into the three allowed values first.
UPDATE "auth"
   SET "gender" = CASE
     WHEN lower(btrim("gender")) IN ('male', 'm', 'man') THEN 'male'
     WHEN lower(btrim("gender")) IN ('female', 'f', 'woman') THEN 'female'
     ELSE 'prefer_not_to_say'
   END
 WHERE "gender" IS NOT NULL
   AND "gender" NOT IN ('male', 'female', 'prefer_not_to_say');

ALTER TABLE "auth"
  ADD CONSTRAINT "auth_gender_check"
  CHECK ("gender" IS NULL OR "gender" IN ('male', 'female', 'prefer_not_to_say'));
