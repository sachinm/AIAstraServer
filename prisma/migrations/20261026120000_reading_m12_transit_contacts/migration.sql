-- Reading engine M12: natal-degree contacts of slow transits (Radha type `transit_contacts`, docs/transit-contacts.md in
-- AIAstra_Radha). Change class `moving`: it depends on the date range asked for, so it is never stored in kundli_data;
-- src/reading/chartData/transitContacts.ts fetches it. The seed row starts unserved; `npm run chart-catalog:sync` flips
-- `served` from Radha. Additive, re-running is a no-op.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('transit_contacts', 'transit', 'transit_contacts', 'moving', 'on_demand', 'natal', false, NULL, NULL, 610, 'Natal-degree contacts of slow transits (entry, exact, exit, station in orb)')
ON CONFLICT ("id") DO NOTHING;
