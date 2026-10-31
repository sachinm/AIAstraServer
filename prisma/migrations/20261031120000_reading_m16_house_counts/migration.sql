-- Reading engine M16: Radha's house table (type `house_counts`): sign to house and every house-from-house count of a chart.
-- Node derives no house, not even as a lookup over signs; the life timeline reads these values from this item.
-- The seed row starts unserved; `npm run chart-catalog:sync` flips `served` from Radha. Additive, re-running is a no-op.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('house_counts', 'special', 'house_counts', 'natal', 'on_demand', 'natal', false, NULL, NULL, 445, 'House counts (sign to house, house from house, from planet, from Arudha Lagna)')
ON CONFLICT ("id") DO NOTHING;
