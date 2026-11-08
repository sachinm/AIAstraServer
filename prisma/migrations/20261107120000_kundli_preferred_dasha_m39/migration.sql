-- M39 (docs/reading-engine/58 §3): the per-kundli reading clock for the You reading. Additive, nullable.
ALTER TABLE "kundlis" ADD COLUMN IF NOT EXISTS "preferred_dasha" TEXT;
