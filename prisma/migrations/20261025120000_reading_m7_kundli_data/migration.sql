-- Reading engine M7: the vertical kundli store (docs/reading-engine/20 §4, review 21 §2).
-- chart_data_types = the keyword list of what Radha can serve; kundli_data = one row per (kundli, type, variant, ayanamsa).
-- Seed generated from src/reading/chartData/catalog.ts. The backfill copies the ten legacy kundlis columns as
-- calc_version 'legacy' rows (pure SQL, no Radha calls); the old columns are left in place.
CREATE TABLE "chart_data_types" (
  "id" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "radha_type" TEXT NOT NULL,
  "change_class" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "variant_kind" TEXT NOT NULL,
  "served" BOOLEAN NOT NULL DEFAULT false,
  "calc_version" TEXT,
  "legacy_column" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 500,
  "label" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chart_data_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chart_data_types_change_class_check" CHECK ("change_class" IN ('natal', 'annual')),
  CONSTRAINT "chart_data_types_tier_check" CHECK ("tier" IN ('first', 'registration', 'on_demand')),
  CONSTRAINT "chart_data_types_variant_kind_check" CHECK ("variant_kind" IN ('natal', 'year'))
);

CREATE TABLE "kundli_data" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id" TEXT NOT NULL,
  "data_type" TEXT NOT NULL,
  "variant" TEXT NOT NULL DEFAULT '',
  "params" JSONB NOT NULL DEFAULT '{}',
  "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
  "calc_version" TEXT,
  "engine_commit" TEXT,
  "payload" JSONB,
  "payload_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'fetching',
  "error" TEXT,
  "fetch_started_at" TIMESTAMPTZ(6),
  "fetched_at" TIMESTAMPTZ(6),
  "valid_to" TIMESTAMPTZ(6),
  CONSTRAINT "kundli_data_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kundli_data_status_check" CHECK ("status" IN ('ready', 'fetching', 'failed', 'unsupported')),
  CONSTRAINT "kundli_data_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "kundli_data_data_type_fkey" FOREIGN KEY ("data_type") REFERENCES "chart_data_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "kundli_data_key" ON "kundli_data"("kundli_id", "data_type", "variant", "ayanamsa");
CREATE INDEX "idx_kundli_data_type_status" ON "kundli_data"("data_type", "status");

INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('panchanga.birth', 'panchanga', 'biodata', 'natal', 'first', 'natal', true, 'legacy', 'biodata', 10, 'Birth details and panchanga'),
  ('varga.d1', 'varga', 'd1', 'natal', 'first', 'natal', true, 'legacy', 'd1', 100, 'D1 divisional chart'),
  ('varga.d2', 'varga', 'd2', 'natal', 'registration', 'natal', true, 'legacy', 'd2', 101, 'D2 divisional chart'),
  ('varga.d3', 'varga', 'd3', 'natal', 'registration', 'natal', false, NULL, NULL, 102, 'D3 divisional chart'),
  ('varga.d4', 'varga', 'd4', 'natal', 'registration', 'natal', true, 'legacy', 'd4', 103, 'D4 divisional chart'),
  ('varga.d5', 'varga', 'd5', 'natal', 'on_demand', 'natal', false, NULL, NULL, 104, 'D5 divisional chart'),
  ('varga.d6', 'varga', 'd6', 'natal', 'on_demand', 'natal', false, NULL, NULL, 105, 'D6 divisional chart'),
  ('varga.d7', 'varga', 'd7', 'natal', 'registration', 'natal', true, 'legacy', 'd7', 106, 'D7 divisional chart'),
  ('varga.d8', 'varga', 'd8', 'natal', 'on_demand', 'natal', false, NULL, NULL, 107, 'D8 divisional chart'),
  ('varga.d9', 'varga', 'd9', 'natal', 'first', 'natal', true, 'legacy', 'd9', 108, 'D9 divisional chart'),
  ('varga.d10', 'varga', 'd10', 'natal', 'registration', 'natal', true, 'legacy', 'd10', 109, 'D10 divisional chart'),
  ('varga.d11', 'varga', 'd11', 'natal', 'on_demand', 'natal', false, NULL, NULL, 110, 'D11 divisional chart'),
  ('varga.d12', 'varga', 'd12', 'natal', 'registration', 'natal', false, NULL, NULL, 111, 'D12 divisional chart'),
  ('varga.d16', 'varga', 'd16', 'natal', 'on_demand', 'natal', false, NULL, NULL, 112, 'D16 divisional chart'),
  ('varga.d20', 'varga', 'd20', 'natal', 'on_demand', 'natal', false, NULL, NULL, 113, 'D20 divisional chart'),
  ('varga.d24', 'varga', 'd24', 'natal', 'on_demand', 'natal', false, NULL, NULL, 114, 'D24 divisional chart'),
  ('varga.d27', 'varga', 'd27', 'natal', 'on_demand', 'natal', false, NULL, NULL, 115, 'D27 divisional chart'),
  ('varga.d30', 'varga', 'd30', 'natal', 'registration', 'natal', false, NULL, NULL, 116, 'D30 divisional chart'),
  ('varga.d40', 'varga', 'd40', 'natal', 'on_demand', 'natal', false, NULL, NULL, 117, 'D40 divisional chart'),
  ('varga.d45', 'varga', 'd45', 'natal', 'on_demand', 'natal', false, NULL, NULL, 118, 'D45 divisional chart'),
  ('varga.d60', 'varga', 'd60', 'natal', 'registration', 'natal', false, NULL, NULL, 119, 'D60 divisional chart'),
  ('varga.d81', 'varga', 'd81', 'natal', 'on_demand', 'natal', false, NULL, NULL, 120, 'D81 divisional chart'),
  ('varga.d108', 'varga', 'd108', 'natal', 'on_demand', 'natal', false, NULL, NULL, 121, 'D108 divisional chart'),
  ('varga.d144', 'varga', 'd144', 'natal', 'on_demand', 'natal', false, NULL, NULL, 122, 'D144 divisional chart'),
  ('dasha.vimsottari', 'dasha', 'vimsottari_dasa', 'natal', 'first', 'natal', true, 'legacy', 'vimsottari_dasa', 200, 'vimsottari dasha'),
  ('dasha.ashtottari', 'dasha', 'dasha.ashtottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 201, 'ashtottari dasha'),
  ('dasha.yogini', 'dasha', 'dasha.yogini', 'natal', 'on_demand', 'natal', false, NULL, NULL, 202, 'yogini dasha'),
  ('dasha.dwadasottari', 'dasha', 'dasha.dwadasottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 203, 'dwadasottari dasha'),
  ('dasha.shodasottari', 'dasha', 'dasha.shodasottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 204, 'shodasottari dasha'),
  ('dasha.panchottari', 'dasha', 'dasha.panchottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 205, 'panchottari dasha'),
  ('dasha.sataatbika', 'dasha', 'dasha.sataatbika', 'natal', 'on_demand', 'natal', false, NULL, NULL, 206, 'sataatbika dasha'),
  ('dasha.chathuraaseethi_sama', 'dasha', 'dasha.chathuraaseethi_sama', 'natal', 'on_demand', 'natal', false, NULL, NULL, 207, 'chathuraaseethi sama dasha'),
  ('dasha.dwisatpathi', 'dasha', 'dasha.dwisatpathi', 'natal', 'on_demand', 'natal', false, NULL, NULL, 208, 'dwisatpathi dasha'),
  ('dasha.shastihayani', 'dasha', 'dasha.shastihayani', 'natal', 'on_demand', 'natal', false, NULL, NULL, 209, 'shastihayani dasha'),
  ('dasha.shattrimsa_sama', 'dasha', 'dasha.shattrimsa_sama', 'natal', 'on_demand', 'natal', false, NULL, NULL, 210, 'shattrimsa sama dasha'),
  ('dasha.karana_chathuraaseethi_sama', 'dasha', 'dasha.karana_chathuraaseethi_sama', 'natal', 'on_demand', 'natal', false, NULL, NULL, 211, 'karana chathuraaseethi sama dasha'),
  ('dasha.tara', 'dasha', 'dasha.tara', 'natal', 'on_demand', 'natal', false, NULL, NULL, 212, 'tara dasha'),
  ('dasha.karaka', 'dasha', 'dasha.karaka', 'natal', 'on_demand', 'natal', false, NULL, NULL, 213, 'karaka dasha'),
  ('dasha.naisargika', 'dasha', 'dasha.naisargika', 'natal', 'on_demand', 'natal', false, NULL, NULL, 214, 'naisargika dasha'),
  ('dasha.buddhi_gathi', 'dasha', 'dasha.buddhi_gathi', 'natal', 'on_demand', 'natal', false, NULL, NULL, 215, 'buddhi gathi dasha'),
  ('dasha.kaala', 'dasha', 'dasha.kaala', 'natal', 'on_demand', 'natal', false, NULL, NULL, 216, 'kaala dasha'),
  ('dasha.saptharishi_nakshathra', 'dasha', 'dasha.saptharishi_nakshathra', 'natal', 'on_demand', 'natal', false, NULL, NULL, 217, 'saptharishi nakshathra dasha'),
  ('dasha.tithi_ashtottari', 'dasha', 'dasha.tithi_ashtottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 218, 'tithi ashtottari dasha'),
  ('dasha.tithi_yogini', 'dasha', 'dasha.tithi_yogini', 'natal', 'on_demand', 'natal', false, NULL, NULL, 219, 'tithi yogini dasha'),
  ('dasha.yoga_vimsottari', 'dasha', 'dasha.yoga_vimsottari', 'natal', 'on_demand', 'natal', false, NULL, NULL, 220, 'yoga vimsottari dasha'),
  ('dasha.aayu', 'dasha', 'dasha.aayu', 'natal', 'on_demand', 'natal', false, NULL, NULL, 221, 'aayu dasha'),
  ('dasha.narayana', 'dasha', 'narayana_dasa', 'natal', 'registration', 'natal', true, 'legacy', 'narayana_dasa', 222, 'narayana dasha'),
  ('dasha.chara', 'dasha', 'dasha.chara', 'natal', 'on_demand', 'natal', false, NULL, NULL, 223, 'chara dasha'),
  ('dasha.kalachakra', 'dasha', 'dasha.kalachakra', 'natal', 'on_demand', 'natal', false, NULL, NULL, 224, 'kalachakra dasha'),
  ('dasha.moola', 'dasha', 'dasha.moola', 'natal', 'on_demand', 'natal', false, NULL, NULL, 225, 'moola dasha'),
  ('dasha.sudasa', 'dasha', 'dasha.sudasa', 'natal', 'on_demand', 'natal', false, NULL, NULL, 226, 'sudasa dasha'),
  ('dasha.drig', 'dasha', 'dasha.drig', 'natal', 'on_demand', 'natal', false, NULL, NULL, 227, 'drig dasha'),
  ('dasha.shoola', 'dasha', 'dasha.shoola', 'natal', 'on_demand', 'natal', false, NULL, NULL, 228, 'shoola dasha'),
  ('dasha.sthira', 'dasha', 'dasha.sthira', 'natal', 'on_demand', 'natal', false, NULL, NULL, 229, 'sthira dasha'),
  ('dasha.trikona', 'dasha', 'dasha.trikona', 'natal', 'on_demand', 'natal', false, NULL, NULL, 230, 'trikona dasha'),
  ('dasha.kendradhi_rasi', 'dasha', 'dasha.kendradhi_rasi', 'natal', 'on_demand', 'natal', false, NULL, NULL, 231, 'kendradhi rasi dasha'),
  ('dasha.lagnamsaka', 'dasha', 'dasha.lagnamsaka', 'natal', 'on_demand', 'natal', false, NULL, NULL, 232, 'lagnamsaka dasha'),
  ('dasha.mandooka', 'dasha', 'dasha.mandooka', 'natal', 'on_demand', 'natal', false, NULL, NULL, 233, 'mandooka dasha'),
  ('dasha.navamsa', 'dasha', 'dasha.navamsa', 'natal', 'on_demand', 'natal', false, NULL, NULL, 234, 'navamsa dasha'),
  ('dasha.padhanadhamsa', 'dasha', 'dasha.padhanadhamsa', 'natal', 'on_demand', 'natal', false, NULL, NULL, 235, 'padhanadhamsa dasha'),
  ('dasha.paryaaya', 'dasha', 'dasha.paryaaya', 'natal', 'on_demand', 'natal', false, NULL, NULL, 236, 'paryaaya dasha'),
  ('dasha.brahma', 'dasha', 'dasha.brahma', 'natal', 'on_demand', 'natal', false, NULL, NULL, 237, 'brahma dasha'),
  ('dasha.varnada', 'dasha', 'dasha.varnada', 'natal', 'on_demand', 'natal', false, NULL, NULL, 238, 'varnada dasha'),
  ('dasha.yogardha', 'dasha', 'dasha.yogardha', 'natal', 'on_demand', 'natal', false, NULL, NULL, 239, 'yogardha dasha'),
  ('dasha.tara_lagna', 'dasha', 'dasha.tara_lagna', 'natal', 'on_demand', 'natal', false, NULL, NULL, 240, 'tara lagna dasha'),
  ('dasha.chakra', 'dasha', 'dasha.chakra', 'natal', 'on_demand', 'natal', false, NULL, NULL, 241, 'chakra dasha'),
  ('dasha.sandhya', 'dasha', 'dasha.sandhya', 'natal', 'on_demand', 'natal', false, NULL, NULL, 242, 'sandhya dasha'),
  ('dasha.nirayana', 'dasha', 'dasha.nirayana', 'natal', 'on_demand', 'natal', false, NULL, NULL, 243, 'nirayana dasha'),
  ('karaka.chara', 'karaka', 'charakaraka', 'natal', 'first', 'natal', true, 'legacy', 'charakaraka', 300, 'Chara karakas'),
  ('arudhas', 'special', 'arudhas', 'natal', 'first', 'natal', false, NULL, NULL, 310, 'Arudha padas (bhava and graha)'),
  ('ashtakavarga', 'strength', 'ashtakavarga', 'natal', 'registration', 'natal', false, NULL, NULL, 320, 'Ashtakavarga (BAV and SAV)'),
  ('strength.shadbala', 'strength', 'strength.shadbala', 'natal', 'registration', 'natal', false, NULL, NULL, 330, 'Shadbala'),
  ('yogas', 'yoga', 'yogas', 'natal', 'registration', 'natal', false, NULL, NULL, 340, 'Yogas and raja yogas'),
  ('strength.bhava', 'strength', 'strength.bhava', 'natal', 'on_demand', 'natal', false, NULL, NULL, 350, 'Bhava bala'),
  ('strength.vimsopaka', 'strength', 'strength.vimsopaka', 'natal', 'on_demand', 'natal', false, NULL, NULL, 360, 'Vimsopaka (vargeeya) bala'),
  ('strength.harsha', 'strength', 'strength.harsha', 'natal', 'on_demand', 'natal', false, NULL, NULL, 370, 'Harsha bala'),
  ('aspects', 'strength', 'aspects', 'natal', 'on_demand', 'natal', false, NULL, NULL, 380, 'Planet aspect table'),
  ('doshas', 'yoga', 'doshas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 390, 'Doshas'),
  ('sphutas', 'special', 'sphutas', 'natal', 'on_demand', 'natal', false, NULL, NULL, 400, 'Sphutas (special points)'),
  ('annual.varsha', 'annual', 'annual.varsha', 'annual', 'on_demand', 'year', false, NULL, NULL, 500, 'Varsha pravesh (Tajaka annual chart)'),
  ('annual.tithi_pravesha', 'annual', 'annual.tithi_pravesha', 'annual', 'on_demand', 'year', false, NULL, NULL, 510, 'Tithi pravesha chart'),
  ('annual.mudda', 'annual', 'annual.mudda', 'annual', 'on_demand', 'year', false, NULL, NULL, 520, 'Mudda dasha'),
  ('annual.patyayini', 'annual', 'annual.patyayini', 'annual', 'on_demand', 'year', false, NULL, NULL, 530, 'Patyayini dasha'),
  ('annual.sahams', 'annual', 'annual.sahams', 'annual', 'on_demand', 'year', false, NULL, NULL, 540, 'Sahams');

-- Backfill: legacy columns -> rows
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'panchanga.birth', 'legacy', "biodata", md5("biodata"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "biodata" IS NOT NULL AND "biodata" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d1', 'legacy', "d1", md5("d1"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d1" IS NOT NULL AND "d1" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d2', 'legacy', "d2", md5("d2"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d2" IS NOT NULL AND "d2" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d4', 'legacy', "d4", md5("d4"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d4" IS NOT NULL AND "d4" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d7', 'legacy', "d7", md5("d7"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d7" IS NOT NULL AND "d7" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d9', 'legacy', "d9", md5("d9"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d9" IS NOT NULL AND "d9" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'varga.d10', 'legacy', "d10", md5("d10"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "d10" IS NOT NULL AND "d10" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'dasha.vimsottari', 'legacy', "vimsottari_dasa", md5("vimsottari_dasa"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "vimsottari_dasa" IS NOT NULL AND "vimsottari_dasa" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'dasha.narayana', 'legacy', "narayana_dasa", md5("narayana_dasa"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "narayana_dasa" IS NOT NULL AND "narayana_dasa" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
INSERT INTO "kundli_data" ("kundli_id", "data_type", "calc_version", "payload", "payload_hash", "status", "fetched_at")
SELECT "id", 'karaka.chara', 'legacy', "charakaraka", md5("charakaraka"::text), 'ready', COALESCE("queue_completed_at", "created_at")
FROM "kundlis" WHERE "charakaraka" IS NOT NULL AND "charakaraka" <> 'null'::jsonb
ON CONFLICT DO NOTHING;
