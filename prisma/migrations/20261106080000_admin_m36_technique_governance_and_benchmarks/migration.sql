-- M36 (docs/reading-engine/55): Technique governance columns, decision receipt logs, and celebrity benchmark tables

ALTER TABLE "technique_registry"
  ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(24) NOT NULL DEFAULT 'verified';

CREATE TABLE IF NOT EXISTS "technique_decision_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "kundli_id" TEXT,
  "user_id" TEXT,
  "area" VARCHAR(24) NOT NULL,
  "as_of" DATE NOT NULL,
  "technique_id" VARCHAR(80) NOT NULL,
  "subarea" VARCHAR(60) NOT NULL,
  "shade_tag" VARCHAR(80) NOT NULL,
  "winning_score" DOUBLE PRECISION NOT NULL,
  "runner_up_tag" VARCHAR(80),
  "runner_up_score" DOUBLE PRECISION,
  "gates" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "playbook_tier" VARCHAR(24) NOT NULL,
  "ease_date" VARCHAR(16),
  "tie_broken_by_fact" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "technique_decision_logs_tech_created_idx"
  ON "technique_decision_logs" ("technique_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "technique_decision_logs_kundli_area_idx"
  ON "technique_decision_logs" ("kundli_id", "area", "as_of" DESC);

CREATE TABLE IF NOT EXISTS "benchmark_charts" (
  "id" VARCHAR(80) PRIMARY KEY,
  "label" VARCHAR(120) NOT NULL,
  "rodden_rating" VARCHAR(12) NOT NULL DEFAULT 'AA',
  "birth_date" VARCHAR(16) NOT NULL,
  "birth_time" VARCHAR(16) NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lon" DOUBLE PRECISION NOT NULL,
  "tz" DOUBLE PRECISION NOT NULL,
  "place_code" VARCHAR(80) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "benchmark_events" (
  "id" VARCHAR(80) PRIMARY KEY,
  "chart_id" VARCHAR(80) NOT NULL REFERENCES "benchmark_charts"("id") ON DELETE CASCADE,
  "event_date" VARCHAR(16) NOT NULL,
  "area" VARCHAR(24) NOT NULL,
  "expected_subarea" VARCHAR(60) NOT NULL,
  "expected_shade" VARCHAR(80) NOT NULL,
  "expected_side" VARCHAR(16) NOT NULL,
  "last_passed" BOOLEAN,
  "last_run_at" TIMESTAMPTZ(6),
  "receipt" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "benchmark_events_chart_idx"
  ON "benchmark_events" ("chart_id", "event_date");
