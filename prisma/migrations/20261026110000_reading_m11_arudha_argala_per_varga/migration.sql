-- Reading engine M11: arudhas and argala per divisional chart (Radha R-4c), one catalog entry per chart.
-- Each entry is the same Radha type (`arudhas` / `argala`) with a fixed `varga` parameter that lives in code
-- (src/reading/chartData/catalog.ts, ARUDHA_ARGALA_VARGAS). D1 arudhas stay the existing `arudhas` entry.
-- Seed rows start unserved; `npm run chart-catalog:sync` flips `served` from Radha. Additive, re-running is a no-op.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('argala.d1', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 470, 'Argala in D1'),
  ('arudhas.d2', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 451, 'Arudha padas and special points (SL, HL, GK, MD) in D2'),
  ('argala.d2', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 471, 'Argala in D2'),
  ('arudhas.d3', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 452, 'Arudha padas and special points (SL, HL, GK, MD) in D3'),
  ('argala.d3', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 472, 'Argala in D3'),
  ('arudhas.d4', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 453, 'Arudha padas and special points (SL, HL, GK, MD) in D4'),
  ('argala.d4', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 473, 'Argala in D4'),
  ('arudhas.d7', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 454, 'Arudha padas and special points (SL, HL, GK, MD) in D7'),
  ('argala.d7', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 474, 'Argala in D7'),
  ('arudhas.d9', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 455, 'Arudha padas and special points (SL, HL, GK, MD) in D9'),
  ('argala.d9', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 475, 'Argala in D9'),
  ('arudhas.d10', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 456, 'Arudha padas and special points (SL, HL, GK, MD) in D10'),
  ('argala.d10', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 476, 'Argala in D10'),
  ('arudhas.d12', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 457, 'Arudha padas and special points (SL, HL, GK, MD) in D12'),
  ('argala.d12', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 477, 'Argala in D12'),
  ('arudhas.d20', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 458, 'Arudha padas and special points (SL, HL, GK, MD) in D20'),
  ('argala.d20', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 478, 'Argala in D20'),
  ('arudhas.d24', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 459, 'Arudha padas and special points (SL, HL, GK, MD) in D24'),
  ('argala.d24', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 479, 'Argala in D24'),
  ('arudhas.d30', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 460, 'Arudha padas and special points (SL, HL, GK, MD) in D30'),
  ('argala.d30', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 480, 'Argala in D30'),
  ('arudhas.d60', 'special', 'arudhas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 461, 'Arudha padas and special points (SL, HL, GK, MD) in D60'),
  ('argala.d60', 'special', 'argala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 481, 'Argala in D60')
ON CONFLICT ("id") DO NOTHING;
