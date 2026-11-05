-- Career map Phase 1 (docs/reading-engine/42, 43, 45) and the first companion facts (doc 48). Additive; re-running is a
-- no-op.
--
-- area_builds   one deterministic area build per (kundli, area, day): the career map JSON (present tone, windows ahead,
--               horizons, security, Looking-back moments). Rebuilt at most once a day.
-- area_checks   the person's answer to a Looking-back moment (yes / partly / no / skip): calibration data (doc 45 §9)
-- person_facts  what the person told us about their situation, one row per key (doc 48 §4.3), e.g. work.status.
--               Plain until the privacy plan's sealed writes go live (docs/privacy/02); filed in TODOS.

CREATE TABLE IF NOT EXISTS "area_builds" (
  "id"         TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"    TEXT        NOT NULL,
  "kundli_id"  TEXT        NOT NULL,
  "area"       TEXT        NOT NULL,
  "as_of"      DATE        NOT NULL,
  "status"     TEXT        NOT NULL,
  "result"     JSONB,
  "error"      TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "area_builds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "area_builds_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "area_builds_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "area_builds_key" ON "area_builds" ("kundli_id", "area", "as_of");

CREATE TABLE IF NOT EXISTS "area_checks" (
  "id"         TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"    TEXT        NOT NULL,
  "area"       TEXT        NOT NULL,
  "month"      TEXT        NOT NULL,
  "side"       TEXT        NOT NULL,
  "answer"     TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "area_checks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "area_checks_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "area_checks_key" ON "area_checks" ("user_id", "area", "month");

CREATE TABLE IF NOT EXISTS "person_facts" (
  "user_id"      TEXT        NOT NULL,
  "key"          TEXT        NOT NULL,
  "value"        TEXT        NOT NULL,
  "source"       TEXT        NOT NULL,
  "confirmed_at" TIMESTAMPTZ(6),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "person_facts_pkey" PRIMARY KEY ("user_id", "key"),
  CONSTRAINT "person_facts_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
