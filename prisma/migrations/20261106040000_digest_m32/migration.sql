-- M32 (docs/reading-engine/53 §3 phase D1, 54 §2): the kundli digest. One versioned, stamped breakdown per kundli,
-- built by code from the stored engine rows (src/reading/digest/build.ts): house and planet cards per varga, yogas,
-- points, annual charts and the star profile, each row with the engine type, variant, calc version and JSON path it
-- came from. `kundlis.digest_status`: pending -> building -> ready | failed; stale when its inputs change.
ALTER TABLE kundlis
  ADD COLUMN IF NOT EXISTS digest_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS digest_version text,
  ADD COLUMN IF NOT EXISTS digest_built_at timestamptz,
  ADD COLUMN IF NOT EXISTS digest_error text;

CREATE INDEX IF NOT EXISTS idx_kundlis_digest_status ON kundlis (digest_status);

CREATE TABLE IF NOT EXISTS kundli_digest (
  id             text        PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  kundli_id      text        NOT NULL REFERENCES kundlis(id) ON DELETE CASCADE,
  section        text        NOT NULL,
  key            text        NOT NULL,
  row            jsonb       NOT NULL,
  source         jsonb       NOT NULL DEFAULT '[]',
  digest_version text        NOT NULL,
  built_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kundli_digest_key ON kundli_digest (kundli_id, section, key);
CREATE INDEX IF NOT EXISTS idx_kundli_digest_section ON kundli_digest (kundli_id, section);
