-- Reading engine M14 (docs/reading-engine/27 §4): prashna and the Tithi Pravesh year dasha per system.
-- WRITTEN, NOT APPLIED: apply only with Sachin's OK. Additive; re-running is a no-op.
--
-- 1. `prashna` (Radha type `prashna`, R-27c): the chart at the moment and place a question is asked. Change class
--    `moving`: it is never stored in kundli_data (ensureChartData refuses it); src/reading/chartData/prashna.ts casts it
--    and stores it per question in `prashna_casts`. Family `prashna` is new; `family` has no CHECK constraint, so none
--    changes. The seed row starts unserved; `npm run chart-catalog:sync` flips `served` from Radha.
INSERT INTO "chart_data_types" ("id", "family", "radha_type", "change_class", "tier", "variant_kind", "served", "calc_version", "legacy_column", "sort_order", "label") VALUES
  ('prashna', 'prashna', 'prashna', 'moving', 'on_demand', 'natal', false, NULL, NULL, 620, 'Prashna chart at the question moment (panchanga, prashna lagna, vargas)')
ON CONFLICT ("id") DO NOTHING;

-- 2. `annual.tithi_pravesha_dasha` (R-27a) is now stored per year AND system: variant `year=<y>;system=<s>`, default
--    system `tithi_ashtottari`. Only the label changes here; served and calc_version ("2") come from the catalog sync.
--    Old `year=<y>` rows stay as they are and are no longer read (the `current` pointer is re-fetched).
UPDATE "chart_data_types"
   SET "label" = 'Tithi pravesha year dasha (per year and system; default Tithi Ashtottari)', "updated_at" = now()
 WHERE "id" = 'annual.tithi_pravesha_dasha'
   AND "label" IS DISTINCT FROM 'Tithi pravesha year dasha (per year and system; default Tithi Ashtottari)';

-- 3. One row per cast prashna. A prashna belongs to a question, so it is kept with the question for reproducibility, not
--    per person. Coordinates are rounded to two decimals (about 1 km) before they are stored; they are null when only
--    the birth place text was sent. place_source: 'current' (the client's location) or 'birth' (the fallback).
--    reading_run_id has no foreign key on purpose: the cast can be made before its reading_runs row is written.
CREATE TABLE IF NOT EXISTS "prashna_casts" (
  "id"             TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "user_id"        TEXT NOT NULL,
  "reading_run_id" TEXT,
  "asked_at"       TIMESTAMPTZ(6) NOT NULL,
  "place_resolved" TEXT,
  "lat"            DOUBLE PRECISION,
  "lon"            DOUBLE PRECISION,
  "tz"             DOUBLE PRECISION,
  "place_source"   TEXT NOT NULL,
  "calc_version"   TEXT,
  "payload"        JSONB NOT NULL,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "prashna_casts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "prashna_casts_place_source_check" CHECK ("place_source" IN ('current', 'birth')),
  CONSTRAINT "prashna_casts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX IF NOT EXISTS "prashna_casts_user_asked" ON "prashna_casts" ("user_id", "asked_at");
