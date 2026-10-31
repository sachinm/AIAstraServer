-- Reading engine M17: the Radha types and options the life reading needs (docs/reading-engine/34 §4; AIAstra_Radha
-- docs/daily-types.md, docs/natal-arudhas-argala.md, docs/reading-tables.md).
-- - dignities, aspects, relations, avasthas per divisional chart: the same Radha type with a fixed `varga` parameter that lives in
--   code (src/reading/chartData/catalog.ts). D1 stays the plain entry of each type.
-- - reading_tables, avasthas: D1 reading tables (incl. correspondences) and 5-system planetary avasthas + Lunar Astro points + 5-vector dasha charter.
-- - dasha.<name>.l3: Radha's dasha.<name> with a fixed `levels: 3`, for the six systems doc 34 names.
-- - daily_grade, muhurta, transit_ashtakavarga: change class `moving`, never stored in kundli_data.
-- Seed rows start unserved; `npm run chart-catalog:sync` flips `served` and `calc_version` from Radha, including the bump
-- to "2" of annual.varsha, annual.tithi_pravesha, dignities, aspects and relations. Additive, re-running is a no-op.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('dasha.vimsottari.l3', 'dasha', 'dasha.vimsottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 260, 'vimsottari dasha to pratyantar (level 3)'),
  ('dasha.dwisatpathi.l3', 'dasha', 'dasha.dwisatpathi', 'natal', 'on_demand', 'natal', false, NULL, NULL, 261, 'dwisatpathi dasha to pratyantar (level 3)'),
  ('dasha.yogini.l3', 'dasha', 'dasha.yogini', 'natal', 'on_demand', 'natal', false, NULL, NULL, 262, 'yogini dasha to pratyantar (level 3)'),
  ('dasha.tithi_ashtottari.l3', 'dasha', 'dasha.tithi_ashtottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 263, 'tithi ashtottari dasha to pratyantar (level 3)'),
  ('dasha.kaala.l3', 'dasha', 'dasha.kaala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 264, 'kaala dasha to pratyantar (level 3)'),
  ('dasha.karaka.l3', 'dasha', 'dasha.karaka', 'natal', 'on_demand', 'natal', false, NULL, NULL, 265, 'karaka dasha to pratyantar (level 3)'),
  ('reading_tables', 'special', 'reading_tables', 'natal', 'on_demand', 'natal', false, NULL, NULL, 446, 'Reading tables (arudha meanings, karaka roles, badhaka, maraka, correspondences)'),
  ('avasthas', 'strength', 'avasthas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 447, 'Planetary avasthas (Baladi, Jagradadi, Deeptadi, Lajjitadi, Shayanadi), Lunar Astro points and dasha charter'),
  ('dignities.d2', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 701, 'Planet dignities, house lords and occupants in D2'),
  ('dignities.d3', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 702, 'Planet dignities, house lords and occupants in D3'),
  ('dignities.d4', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 703, 'Planet dignities, house lords and occupants in D4'),
  ('dignities.d7', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 704, 'Planet dignities, house lords and occupants in D7'),
  ('dignities.d9', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 705, 'Planet dignities, house lords and occupants in D9'),
  ('dignities.d10', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 706, 'Planet dignities, house lords and occupants in D10'),
  ('dignities.d12', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 707, 'Planet dignities, house lords and occupants in D12'),
  ('dignities.d20', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 708, 'Planet dignities, house lords and occupants in D20'),
  ('dignities.d24', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 709, 'Planet dignities, house lords and occupants in D24'),
  ('dignities.d30', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 710, 'Planet dignities, house lords and occupants in D30'),
  ('dignities.d60', 'strength', 'dignities', 'natal', 'on_demand', 'natal', false, NULL, NULL, 711, 'Planet dignities, house lords and occupants in D60'),
  ('aspects.d2', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 721, 'Planet aspect table in D2'),
  ('aspects.d3', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 722, 'Planet aspect table in D3'),
  ('aspects.d4', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 723, 'Planet aspect table in D4'),
  ('aspects.d7', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 724, 'Planet aspect table in D7'),
  ('aspects.d9', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 725, 'Planet aspect table in D9'),
  ('aspects.d10', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 726, 'Planet aspect table in D10'),
  ('aspects.d12', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 727, 'Planet aspect table in D12'),
  ('aspects.d20', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 728, 'Planet aspect table in D20'),
  ('aspects.d24', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 729, 'Planet aspect table in D24'),
  ('aspects.d30', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 730, 'Planet aspect table in D30'),
  ('aspects.d60', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 731, 'Planet aspect table in D60'),
  ('relations.d2', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 741, 'Planet relations (natural, temporary, compound) in D2'),
  ('relations.d3', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 742, 'Planet relations (natural, temporary, compound) in D3'),
  ('relations.d4', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 743, 'Planet relations (natural, temporary, compound) in D4'),
  ('relations.d7', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 744, 'Planet relations (natural, temporary, compound) in D7'),
  ('relations.d9', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 745, 'Planet relations (natural, temporary, compound) in D9'),
  ('relations.d10', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 746, 'Planet relations (natural, temporary, compound) in D10'),
  ('relations.d12', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 747, 'Planet relations (natural, temporary, compound) in D12'),
  ('relations.d20', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 748, 'Planet relations (natural, temporary, compound) in D20'),
  ('relations.d24', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 749, 'Planet relations (natural, temporary, compound) in D24'),
  ('relations.d30', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 750, 'Planet relations (natural, temporary, compound) in D30'),
  ('relations.d60', 'strength', 'relations', 'natal', 'on_demand', 'natal', false, NULL, NULL, 751, 'Planet relations (natural, temporary, compound) in D60'),
  ('avasthas.d9', 'strength', 'avasthas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 760, 'Planetary avasthas in D9'),
  ('avasthas.d10', 'strength', 'avasthas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 761, 'Planetary avasthas in D10'),
  ('avasthas.d16', 'strength', 'avasthas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 762, 'Planetary avasthas in D16'),
  ('avasthas.d24', 'strength', 'avasthas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 763, 'Planetary avasthas in D24'),
  ('daily_grade', 'transit', 'daily_grade', 'moving', 'on_demand', 'natal', false, NULL, NULL, 640, 'Day grade over a date range (Moon star, tara, chandra bala, panchanga, events)'),
  ('muhurta', 'panchanga', 'muhurta', 'moving', 'on_demand', 'natal', false, NULL, NULL, 650, 'Muhurta tables per day at a place (sunrise, horas, muhurtas, kalas, optional natal grade)'),
  ('transit_ashtakavarga', 'transit', 'transit_ashtakavarga', 'moving', 'on_demand', 'natal', false, NULL, NULL, 660, 'Dated transit positions scored by natal ashtakavarga (BAV, SAV, kakshya)')
ON CONFLICT ("id") DO NOTHING;
