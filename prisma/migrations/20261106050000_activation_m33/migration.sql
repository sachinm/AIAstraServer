-- M33 (docs/reading-engine/53 §3 phase D2, 54 §2): the activation calendar. One row per period of every stored dasha
-- system (level 3 where a .l3 tree is stored, else level 2), birth to thirty years ahead, with the D1 houses the period
-- activates as the engine states them (src/reading/digest/activation.ts), so "which periods activate house 7 between
-- 2027 and 2030 under any system" is one indexed query.
CREATE TABLE IF NOT EXISTS kundli_activation (
  id             text    PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  kundli_id      text    NOT NULL REFERENCES kundlis(id) ON DELETE CASCADE,
  system         text    NOT NULL,
  family         text    NOT NULL,
  level          integer NOT NULL,
  lord           text,
  sign           text,
  from_date      date    NOT NULL,
  to_date        date    NOT NULL,
  houses         integer[] NOT NULL DEFAULT '{}',
  parent_lord    text,
  digest_version text    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kundli_activation_range ON kundli_activation (kundli_id, from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_kundli_activation_houses ON kundli_activation USING GIN (houses);
