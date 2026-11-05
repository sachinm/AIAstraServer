-- Day tables (docs/reading-engine/47): the daily panchang and good-and-bad windows depend only on the date and the place,
-- so they are stored once per place and date and read by everyone there, like the shared sky (doc 35). The person's own
-- three facts (tara, chandra bala, the Moon's natal house) come from the engine per kundli and month and sit in an
-- overlay. Additive (new tables only); re-running is a no-op. Every value is the engine's; nothing here is derived.
--
-- day_tables           one engine `muhurta` day row per (place, date, ayanamsa), no person in it
-- kundli_day_overlays  one engine answer per (kundli, month): tara, chandra bala, grade and the Moon's natal house per day

CREATE TABLE IF NOT EXISTS "day_tables" (
  "id"               TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "place_key"        TEXT        NOT NULL,
  "place_name"       TEXT,
  "lat"              DOUBLE PRECISION NOT NULL,
  "lon"              DOUBLE PRECISION NOT NULL,
  "tz_name"          TEXT        NOT NULL,
  "date"             DATE        NOT NULL,
  "utc_offset_hours" DOUBLE PRECISION NOT NULL,
  "ayanamsa"         TEXT        NOT NULL DEFAULT 'LAHIRI',
  "calc_version"     TEXT,
  "engine_commit"    TEXT,
  "source_hash"      TEXT        NOT NULL,
  "payload"          JSONB       NOT NULL,
  "fetched_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "day_tables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "day_tables_key" ON "day_tables" ("place_key", "date", "ayanamsa");
CREATE INDEX IF NOT EXISTS "day_tables_date" ON "day_tables" ("date");

CREATE TABLE IF NOT EXISTS "kundli_day_overlays" (
  "id"           TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id"    TEXT        NOT NULL,
  "place_key"    TEXT        NOT NULL,
  "month"        DATE        NOT NULL,
  "calc_version" TEXT,
  "source_hash"  TEXT        NOT NULL,
  "payload"      JSONB       NOT NULL,
  "fetched_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "kundli_day_overlays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kundli_day_overlays_kundli_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "kundli_day_overlays_key" ON "kundli_day_overlays" ("kundli_id", "place_key", "month");
