-- Kundli slices (docs/reading-engine/70 §4.1 Layer 1, M48): the stored engine rows rendered once into fixed text blocks
-- (natal.core, sky.window, year.tp, frame, clock.<system>, matter.<key>), one row per kundli per slice. `text` and `keys`
-- are sealed by the Prisma extension (src/lib/pii/fields.ts SEALED_MODELS.KundliSlice). Additive; written, not applied.
CREATE TABLE IF NOT EXISTS "kundli_slices" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id" TEXT NOT NULL,
  "slice_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "keys" JSONB NOT NULL DEFAULT '[]',
  "est_tokens" INTEGER NOT NULL DEFAULT 0,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "hash" TEXT NOT NULL,
  "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "kundli_slices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kundli_slices_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "kundli_slices_kundli_slice_key" ON "kundli_slices" ("kundli_id", "slice_id");
