-- Board layout (docs/reading-engine/68 §4.5 item 8, 69 §4.1 item 6): the person's cards, their order, the sections
-- switched on per card and the template, one row per kundli per board (self, love, work). No astrological content and no
-- words of the person beyond card ids, so it is not sealed. Additive.
CREATE TABLE IF NOT EXISTS "board_layout" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id" TEXT NOT NULL,
  "kundli_id" TEXT NOT NULL,
  "board" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "cards" JSONB NOT NULL,
  "sections" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "board_layout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "board_layout_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "board_layout_kundli_board_key" ON "board_layout" ("kundli_id", "board");
