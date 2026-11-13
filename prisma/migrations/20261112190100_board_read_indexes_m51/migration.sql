-- Read paths of GET /api/self/v3 and PUT /api/self/v3/layout. Additive indexes only.
-- technique_outputs: every board read is findFirst(kundli_id, technique_id, digest_version filter) ORDER BY created_at
-- DESC LIMIT 1. With (kundli_id, technique_id) alone Postgres reads every build row of that technique and sorts; this
-- index walks newest first and stops at the first row whose digest_version matches.
CREATE INDEX IF NOT EXISTS "idx_technique_outputs_kundli_technique_created" ON "technique_outputs" ("kundli_id", "technique_id", "created_at" DESC);
-- kundlis: the person's latest chart (WHERE user_id ORDER BY created_at DESC LIMIT 1) without a sort.
CREATE INDEX IF NOT EXISTS "idx_kundlis_user_created" ON "kundlis" ("user_id", "created_at" DESC);
