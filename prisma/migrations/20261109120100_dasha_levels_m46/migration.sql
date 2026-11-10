-- Dasha levels 1–6 (docs/reading-engine/67). Additive only: one index and two chart_data_types rows; no data changed.
--
-- 1. kundli_activation grows by the deep window (level 4 by default, up to 6) for kundlis in focus. Every read filters by
--    kundli and level (activationFor defaults to level <= 3), and the worker / backfill replace one level band per kundli,
--    so (kundli_id, level, from_date, to_date) serves both without scanning the deep rows on a lifelong query. The
--    existing range index (kundli_id, from_date, to_date) and the GIN on houses stay.
CREATE INDEX IF NOT EXISTS "idx_kundli_activation_level_range" ON "kundli_activation" ("kundli_id", "level", "from_date", "to_date");

-- 2. The rows the kundli_data.data_type foreign key needs: narayana to three levels (the base row uses the legacy wire
--    type, which takes no params) and the dasha-deep worker's marker / focus rows (moving: never pulled by the chart pull).
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label")
VALUES
  ('dasha.narayana.l3', 'dasha', 'dasha.narayana', 'natal', 'on_demand', 'natal', false, NULL, NULL, 266, 'narayana dasha to pratyantar (level 3)'),
  ('dasha.deep', 'dasha', 'dasha.deep', 'moving', 'on_demand', 'natal', false, NULL, NULL, 280, 'Dasha levels 4–6 in a window around today (dasha-deep worker marker and focus rows)')
ON CONFLICT ("id") DO NOTHING;
