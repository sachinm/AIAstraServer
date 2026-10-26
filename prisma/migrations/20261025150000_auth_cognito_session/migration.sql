-- Auth: dedicated columns for the Cognito sign-in session (AUTH_PROVIDER=cognito).
-- Additive and nullable: existing rows and the local email-code provider are unaffected.
ALTER TABLE "auth" ADD COLUMN IF NOT EXISTS "cognito_session" TEXT;
ALTER TABLE "auth" ADD COLUMN IF NOT EXISTS "cognito_session_expires_at" TIMESTAMPTZ(6);
