-- Terms of Use acceptance on sign-in and sign-up (docs/auth/otp-consent-contract.md). Additive, nullable.
-- terms_version: the Terms version last accepted (src/auth/terms.ts CURRENT_TERMS_VERSION).
-- terms_accepted_at / age_confirmed_at: when that box was last ticked ("I am 18 or older and agree to the Terms").
ALTER TABLE "auth" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;
ALTER TABLE "auth" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ(6);
ALTER TABLE "auth" ADD COLUMN IF NOT EXISTS "age_confirmed_at" TIMESTAMPTZ(6);
