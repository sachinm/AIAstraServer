CREATE TABLE IF NOT EXISTS technique_registry (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('self','love','work','general')),
  board text NOT NULL,
  status text NOT NULL CHECK (status IN ('built','partial','planned')),
  charts jsonb NOT NULL DEFAULT '[]',
  algorithm jsonb NOT NULL DEFAULT '[]',
  special text,
  source text,
  code_ref text,
  agents jsonb NOT NULL DEFAULT '[]',
  accuracy text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technique_registry_category ON technique_registry (category, board);

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS technique_id text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS board text,
  ADD COLUMN IF NOT EXISTS kundli_id text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS charts_used jsonb;
CREATE INDEX IF NOT EXISTS agent_runs_technique ON agent_runs (technique_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_category ON agent_runs (category, started_at DESC);

ALTER TABLE reading_agent_spans
  ADD COLUMN IF NOT EXISTS agent_id text,
  ADD COLUMN IF NOT EXISTS technique_id text,
  ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS reading_agent_spans_technique ON reading_agent_spans (technique_id, started_at DESC);
CREATE INDEX IF NOT EXISTS reading_agent_spans_agent_id ON reading_agent_spans (agent_id, level, started_at DESC);

CREATE TABLE IF NOT EXISTS technique_reviews (
  id text PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  run_kind text NOT NULL CHECK (run_kind IN ('agent_run','span')),
  run_id text NOT NULL,
  technique_id text,
  verdict text NOT NULL CHECK (verdict IN ('right','wrong','unsure')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  admin_id text NOT NULL REFERENCES admin_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technique_reviews_run ON technique_reviews (run_kind, run_id);
CREATE INDEX IF NOT EXISTS technique_reviews_technique ON technique_reviews (technique_id, created_at DESC);
