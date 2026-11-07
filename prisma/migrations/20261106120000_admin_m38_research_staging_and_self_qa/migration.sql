-- Migration M38 (docs/admin/09): Isolated synthetic/staging kundli schema and Self Dashboard QA runs
-- Kept completely separate from customer `auth` and `kundlis` tables.

CREATE TABLE IF NOT EXISTS "research_kundlis" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "subject_code" VARCHAR(80) NOT NULL,
    "group_kind" VARCHAR(24) NOT NULL DEFAULT 'age_bracket',
    "label" VARCHAR(160) NOT NULL,
    "age_years" INTEGER NOT NULL,
    "profession_code" VARCHAR(64) NOT NULL,
    "scenario_code" VARCHAR(64) NOT NULL,
    "birth_date" VARCHAR(16) NOT NULL,
    "birth_time" VARCHAR(16) NOT NULL,
    "place_code" VARCHAR(80) NOT NULL,
    "place_label" VARCHAR(120) NOT NULL,
    "coord_n" DOUBLE PRECISION NOT NULL,
    "coord_e" DOUBLE PRECISION NOT NULL,
    "tz_offset" DOUBLE PRECISION NOT NULL,
    "lagna_sign" VARCHAR(24) NOT NULL,
    "moon_sign" VARCHAR(24) NOT NULL,
    "moon_star" VARCHAR(32) NOT NULL,
    "sun_sign" VARCHAR(24) NOT NULL,
    "ak_planet" VARCHAR(16) NOT NULL,
    "amk_planet" VARCHAR(16) NOT NULL,
    "hydrate_status" VARCHAR(16) NOT NULL DEFAULT 'ready',
    "hydrate_version" INTEGER NOT NULL DEFAULT 1,
    "hydrated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_kundlis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "research_kundlis_subject_code_key" ON "research_kundlis"("subject_code");
CREATE INDEX IF NOT EXISTS "research_kundlis_group_age_idx" ON "research_kundlis"("group_kind", "age_years");

CREATE TABLE IF NOT EXISTS "research_chart_data" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "research_kundli_id" TEXT NOT NULL,
    "chart_type" VARCHAR(64) NOT NULL,
    "variant" VARCHAR(120) NOT NULL DEFAULT '',
    "calc_version" VARCHAR(32) NOT NULL DEFAULT 'v1',
    "status" VARCHAR(16) NOT NULL DEFAULT 'ready',
    "chart_blob" JSONB NOT NULL DEFAULT '{}',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_chart_data_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "research_chart_data_kundli_fkey" FOREIGN KEY ("research_kundli_id") REFERENCES "research_kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "research_chart_data_kundli_type_var_key" ON "research_chart_data"("research_kundli_id", "chart_type", "variant");
CREATE INDEX IF NOT EXISTS "research_chart_data_kundli_idx" ON "research_chart_data"("research_kundli_id");

CREATE TABLE IF NOT EXISTS "research_digests" (
    "id" BIGSERIAL NOT NULL,
    "research_kundli_id" TEXT NOT NULL,
    "section" VARCHAR(16) NOT NULL,
    "item_key" VARCHAR(80) NOT NULL,
    "varga" VARCHAR(12),
    "house_num" SMALLINT,
    "planet" VARCHAR(16),
    "section_data" JSONB NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "calc_version" VARCHAR(24) NOT NULL DEFAULT '1',
    "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_digests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "research_digests_kundli_fkey" FOREIGN KEY ("research_kundli_id") REFERENCES "research_kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "research_digests_kundli_sec_key" ON "research_digests"("research_kundli_id", "section", "item_key");
CREATE INDEX IF NOT EXISTS "research_digests_kundli_sec_idx" ON "research_digests"("research_kundli_id", "section");

CREATE TABLE IF NOT EXISTS "research_activations" (
    "id" BIGSERIAL NOT NULL,
    "research_kundli_id" TEXT NOT NULL,
    "system" VARCHAR(32) NOT NULL,
    "level" SMALLINT NOT NULL,
    "lord" VARCHAR(24) NOT NULL,
    "path" VARCHAR(80) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "houses" SMALLINT[],
    "planet_factors" JSONB NOT NULL DEFAULT '{}',
    "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_activations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "research_activations_kundli_fkey" FOREIGN KEY ("research_kundli_id") REFERENCES "research_kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "research_activations_kundli_dates_idx" ON "research_activations"("research_kundli_id", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "research_activations_kundli_sys_idx" ON "research_activations"("research_kundli_id", "system", "level");

CREATE TABLE IF NOT EXISTS "research_dashboard_runs" (
    "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
    "research_kundli_id" TEXT NOT NULL,
    "subject_code" VARCHAR(80) NOT NULL,
    "board_area" VARCHAR(16) NOT NULL DEFAULT 'self',
    "as_of" VARCHAR(16) NOT NULL,
    "tone" VARCHAR(32) NOT NULL,
    "verdict_pill" VARCHAR(64) NOT NULL,
    "charter_summary" TEXT NOT NULL,
    "board_data" JSONB NOT NULL,
    "house_varga_matrix" JSONB NOT NULL,
    "temporal_data" JSONB NOT NULL,
    "trace_data" JSONB NOT NULL,
    "reading_prose" JSONB NOT NULL,
    "verifier_verdict" VARCHAR(16) NOT NULL,
    "accuracy_score" DOUBLE PRECISION NOT NULL,
    "verifier_data" JSONB NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_dashboard_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "research_dashboard_runs_kundli_fkey" FOREIGN KEY ("research_kundli_id") REFERENCES "research_kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "research_dashboard_runs_kundli_idx" ON "research_dashboard_runs"("research_kundli_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "research_dashboard_runs_subject_idx" ON "research_dashboard_runs"("subject_code", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "research_dashboard_runs_verdict_idx" ON "research_dashboard_runs"("verifier_verdict", "accuracy_score" DESC);
