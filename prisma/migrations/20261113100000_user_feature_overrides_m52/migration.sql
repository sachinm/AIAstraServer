-- M52 (docs/reading-engine/75 §4.1): staff-set board feature switches per person. Additive; no personal data (a key, a
-- state, who set it and why). The newest row per (user_id, key) wins over env and the catalogue default.
CREATE TABLE IF NOT EXISTS "user_feature_overrides" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "set_by" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "user_feature_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_feature_overrides_state_check" CHECK ("state" IN ('off', 'on', 'premium')),
  CONSTRAINT "user_feature_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "user_feature_overrides_user_key_idx" ON "user_feature_overrides" ("user_id", "key", "created_at" DESC);
