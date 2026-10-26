-- Reading engine M15: the dated sky over up to 40 years (Radha type `transit_range`, docs/transit-range.md in
-- AIAstra_Radha; gap R-T1 of docs/reading-engine/27). Change class `moving`: it depends on the range asked for, so it is
-- never stored in kundli_data; src/reading/chartData/transitRange.ts fetches it. The seed row starts unserved;
-- `npm run chart-catalog:sync` flips `served` from Radha. Additive, re-running is a no-op.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('transit_range', 'transit', 'transit_range', 'moving', 'on_demand', 'natal', false, NULL, NULL, 630, 'Dated sky over up to 40 years (sign stays, stations, lunations, eclipses, Sade Sati)')
ON CONFLICT ("id") DO NOTHING;
