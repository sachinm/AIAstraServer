-- Lucky times v1, the agent registry and first-party analytics (docs/reading-engine/49). Additive (new tables only);
-- re-running is a no-op. No value here is astrological: picks and prefs are the person's choices, the registry and runs
-- describe agents, analytics records clicks.
--
-- lucky_prefs            the person's place for day tables (set once, doc 45 rule 12)
-- lucky_scenario_picks   the scenarios the person added, whether each layer is shown, the one-tap answers
-- agent_registry         one row per agent: module, sub-module, kind, provider, model, price per 1M tokens
-- agent_runs             one row per agent run: who, task, start, end, tokens, estimated cost, status
-- analytics_events       what the person clicks and chooses (no free text, no birth data)

CREATE TABLE IF NOT EXISTS "lucky_prefs" (
  "user_id"    TEXT        NOT NULL,
  "place_key"  TEXT        NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "lucky_prefs_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "lucky_prefs_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "lucky_scenario_picks" (
  "id"          TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"     TEXT        NOT NULL,
  "scenario_id" TEXT        NOT NULL,
  "shown"       BOOLEAN     NOT NULL DEFAULT true,
  "answers"     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "lucky_scenario_picks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lucky_scenario_picks_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "lucky_scenario_picks_key" ON "lucky_scenario_picks" ("user_id", "scenario_id");

CREATE TABLE IF NOT EXISTS "agent_registry" (
  "id"            TEXT        NOT NULL,
  "title"         TEXT        NOT NULL,
  "kind"          TEXT        NOT NULL,
  "module"        TEXT        NOT NULL,
  "sub_module"    TEXT,
  "provider"      TEXT,
  "model"         TEXT,
  "price_in"      DECIMAL(12,6),
  "price_out"     DECIMAL(12,6),
  "price_cached"  DECIMAL(12,6),
  "price_version" TEXT,
  "description"   TEXT,
  "enabled"       BOOLEAN     NOT NULL DEFAULT true,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "agent_registry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id"             TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "agent_id"       TEXT        NOT NULL,
  "user_id"        TEXT,
  "module"         TEXT        NOT NULL,
  "sub_module"     TEXT,
  "task"           TEXT        NOT NULL,
  "status"         TEXT        NOT NULL,
  "error"          TEXT,
  "input_summary"  JSONB,
  "output_summary" JSONB,
  "model"          TEXT,
  "started_at"     TIMESTAMPTZ(6) NOT NULL,
  "ended_at"       TIMESTAMPTZ(6) NOT NULL,
  "ms"             INTEGER     NOT NULL,
  "prompt_tokens"  INTEGER     NOT NULL DEFAULT 0,
  "cached_tokens"  INTEGER     NOT NULL DEFAULT 0,
  "output_tokens"  INTEGER     NOT NULL DEFAULT 0,
  "thought_tokens" INTEGER     NOT NULL DEFAULT 0,
  "est_cost_usd"   DECIMAL(10,6),
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_runs_agent_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "agent_runs_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "agent_runs_agent_started" ON "agent_runs" ("agent_id", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_started" ON "agent_runs" ("started_at");

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id"         TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"    TEXT,
  "session_id" TEXT,
  "event"      TEXT        NOT NULL,
  "surface"    TEXT        NOT NULL,
  "target"     TEXT,
  "props"      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_events_user_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "analytics_events_at" ON "analytics_events" ("at");
CREATE INDEX IF NOT EXISTS "analytics_events_user_at" ON "analytics_events" ("user_id", "at");
CREATE INDEX IF NOT EXISTS "analytics_events_event_at" ON "analytics_events" ("event", "at");
