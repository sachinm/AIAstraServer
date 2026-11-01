-- Versioned agent prompts in system_prompts + historical audit table system_prompt_versions
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS agent_role TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS prompt_type TEXT NOT NULL DEFAULT 'system';
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE TABLE IF NOT EXISTS system_prompt_versions (
  id TEXT PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  prompt_name TEXT NOT NULL,
  version INT NOT NULL,
  prompt TEXT NOT NULL,
  agent_role TEXT,
  prompt_type TEXT NOT NULL DEFAULT 'system',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_prompt_versions_name_version_key UNIQUE (prompt_name, version)
);

CREATE OR REPLACE FUNCTION fn_archive_system_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.prompt IS DISTINCT FROM OLD.prompt THEN
    IF NEW.version = OLD.version THEN
      NEW.version := OLD.version + 1;
    END IF;
    NEW.updated_at := now();
    INSERT INTO system_prompt_versions (prompt_name, version, prompt, agent_role, prompt_type, notes)
    VALUES (NEW.name, NEW.version, NEW.prompt, NEW.agent_role, COALESCE(NEW.prompt_type, 'system'), 'Updated in system_prompts')
    ON CONFLICT (prompt_name, version) DO UPDATE SET prompt = EXCLUDED.prompt, created_at = now();
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO system_prompt_versions (prompt_name, version, prompt, agent_role, prompt_type, notes)
    VALUES (NEW.name, COALESCE(NEW.version, 1), NEW.prompt, NEW.agent_role, COALESCE(NEW.prompt_type, 'system'), 'Initial seed')
    ON CONFLICT (prompt_name, version) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_prompts_version ON system_prompts;
CREATE TRIGGER trg_system_prompts_version
BEFORE INSERT OR UPDATE ON system_prompts
FOR EACH ROW EXECUTE FUNCTION fn_archive_system_prompt_version();

