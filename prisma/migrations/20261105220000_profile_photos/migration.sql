-- The selfie (docs/reading-engine/52 §4): one current photo per person, the previous kept 30 days, and the capture
-- attempts that the rate limit counts. Additive; re-running is a no-op.

CREATE TABLE IF NOT EXISTS "profile_photos" (
  "user_id"     TEXT        NOT NULL,
  "bytes"       BYTEA       NOT NULL,
  "mime"        TEXT        NOT NULL,
  "width"       INTEGER     NOT NULL,
  "height"      INTEGER     NOT NULL,
  "face_box"    JSONB,
  "phash"       TEXT,
  "prev_bytes"  BYTEA,
  "replaced_at" TIMESTAMPTZ(6),
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "profile_photos_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "profile_photos_phash" ON "profile_photos" ("phash");

CREATE TABLE IF NOT EXISTS "profile_photo_attempts" (
  "id"         TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"    TEXT        NOT NULL,
  "outcome"    TEXT        NOT NULL,
  "at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "profile_photo_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_photo_attempts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "profile_photo_attempts_user_at" ON "profile_photo_attempts" ("user_id", "at");
