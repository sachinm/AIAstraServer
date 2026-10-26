-- Reading engine M9: the chart data types Radha added in R-4a/R-4b/R-5 plus the transit chart (docs/reading-engine/23 §4).
-- change_class gains 'moving' (transit: depends on the moment asked for, never stored in kundli_data).
-- Seed rows generated from src/reading/chartData/catalog.ts; all start unserved, `npm run chart-catalog:sync` flips
-- served from Radha's catalog. Additive: no existing row changes, re-running the inserts is a no-op.
ALTER TABLE "chart_data_types" DROP CONSTRAINT IF EXISTS "chart_data_types_change_class_check";
ALTER TABLE "chart_data_types" ADD CONSTRAINT "chart_data_types_change_class_check" CHECK ("change_class" IN ('natal', 'annual', 'moving'));

INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('dasha.applicable', 'dasha', 'dasha.applicable', 'natal', 'on_demand', 'natal', false, NULL, NULL, 250, 'Which conditional dashas apply'),
  ('relations', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 410, 'Planet relations (natural, temporary, compound)'),
  ('benefic_malefic', 'strength', 'benefic_malefic', 'natal', 'on_demand', 'natal', false, NULL, NULL, 420, 'Benefics and malefics (natural and functional, maraka lords)'),
  ('dignities', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 430, 'Planet dignities (combust, retrograde, planetary war)'),
  ('bhava', 'special', 'bhava', 'natal', 'on_demand', 'natal', false, NULL, NULL, 440, 'Bhavas (cusps, lords, occupants)'),
  ('annual.tithi_pravesha_dasha', 'annual', 'annual.tithi_pravesha_dasha', 'annual', 'on_demand', 'year', false, NULL, NULL, 515, 'Tithi pravesha dasha'),
  ('transit', 'transit', 'transit', 'moving', 'on_demand', 'natal', false, NULL, NULL, 600, 'Transit chart at a moment (any divisional chart)')
ON CONFLICT ("id") DO NOTHING;
