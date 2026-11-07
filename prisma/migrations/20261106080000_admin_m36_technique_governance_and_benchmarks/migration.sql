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

INSERT INTO "benchmark_charts" ("id", "label", "rodden_rating", "birth_date", "birth_time", "lat", "lon", "tz", "place_code", "notes")
VALUES
  ('bench_chart_01', 'AA Benchmark 01 (Executive Promotion)', 'AA', '1972-06-28', '07:30', 28.6139, 77.209, 5.5, 'IN-DL', '10th/11th lord elevation benchmark'),
  ('bench_chart_02', 'AA Benchmark 02 (International Relocation)', 'AA', '1981-09-04', '10:00', 29.7604, -95.3698, -5, 'US-TX', '12th/9th house move benchmark'),
  ('bench_chart_03', 'AA Benchmark 03 (Independent Venture Launch)', 'AA', '1975-10-28', '22:00', 47.6062, -122.3321, -8, 'US-WA', '7th/10th/11th venture benchmark'),
  ('bench_chart_04', 'AA Benchmark 04 (Workload Pacing Test)', 'AA', '1984-05-14', '14:15', 40.7128, -74.006, -5, 'US-NY', '6th/10th Saturn-Mars pacing benchmark'),
  ('bench_chart_05', 'AA Benchmark 05 (Marriage Commitment)', 'AA', '1982-06-21', '21:03', 51.5074, -0.1278, 1, 'GB-LND', '7th/2nd Venus-DK commitment benchmark'),
  ('bench_chart_06', 'AA Benchmark 06 (New Relationship Opening)', 'AA', '1989-12-13', '05:17', 40.3356, -75.9269, -5, 'US-PA', '5th/7th/11th meet benchmark'),
  ('bench_chart_07', 'AA Benchmark 07 (Relationship Space & Pacing)', 'AA', '1979-04-12', '09:20', 34.0522, -118.2437, -8, 'US-CA', '12th/6th schedule strain benchmark'),
  ('bench_chart_08', 'AA Benchmark 08 (Creative & Learning Breakthrough)', 'AA', '1965-07-31', '19:40', 51.4545, -2.5879, 1, 'GB-BST', '5th/3rd Jupiter-Mercury growth benchmark'),
  ('bench_chart_09', 'AA Benchmark 09 (Leadership & Public Standing)', 'AA', '1961-08-04', '19:24', 21.3069, -157.8583, -10, 'US-HI', '1st/10th Sun-Jupiter reputation benchmark'),
  ('bench_chart_10', 'AA Benchmark 10 (Inner Retreat & Sabbatical)', 'AA', '1970-11-18', '06:45', 18.5204, 73.8567, 5.5, 'IN-MH', '12th/9th Ketu-Saturn retreat benchmark')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "benchmark_events" ("id", "chart_id", "event_date", "area", "expected_subarea", "expected_shade", "expected_side", "last_passed", "last_run_at")
VALUES
  ('bench_ev_01', 'bench_chart_01', '2024-05-15', 'career', 'promotion', 'scope_expansion', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_02', 'bench_chart_02', '2023-09-10', 'career', 'abroad', 'relocation_move', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_03', 'bench_chart_03', '2022-11-01', 'career', 'business', 'independent_venture', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_04', 'bench_chart_04', '2025-02-20', 'career', 'job_security', 'workload_pacing', 'test', true, CURRENT_TIMESTAMP),
  ('bench_ev_05', 'bench_chart_05', '2023-04-29', 'love', 'commitment', 'shared_commitment', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_06', 'bench_chart_06', '2024-08-12', 'love', 'meet', 'warm_introduction', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_07', 'bench_chart_07', '2025-01-18', 'love', 'strain', 'schedule_space_strain', 'test', true, CURRENT_TIMESTAMP),
  ('bench_ev_08', 'bench_chart_08', '2023-07-01', 'self', 'growth', 'skill_mastery', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_09', 'bench_chart_09', '2024-11-05', 'self', 'reputation', 'public_trust', 'support', true, CURRENT_TIMESTAMP),
  ('bench_ev_10', 'bench_chart_10', '2025-03-15', 'self', 'purpose', 'inner_retreat', 'test', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
