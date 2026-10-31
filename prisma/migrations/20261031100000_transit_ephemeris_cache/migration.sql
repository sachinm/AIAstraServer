-- Transit ephemeris cache (docs/reading-engine/35): the sky at an instant is the same for every kundli, so it is stored
-- once and shared. WRITTEN, NOT APPLIED: apply only with Sachin's OK. Additive (new tables only); re-running is a no-op.
--
-- transit_instants       one snapshot per (place, instant, divisional factors, ayanamsa), payload WITHOUT natal fields
-- transit_range_skies    one transit_range per (place, span, planets, flags), payload WITHOUT natal fields
-- kundli_transit_overlays a kundli's own range / contacts answer from Radha, with Radha's house fields (never derived in Node)

CREATE TABLE IF NOT EXISTS "transit_instants" (
  "id"           TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "place_key"    TEXT        NOT NULL,
  "lat"          DOUBLE PRECISION NOT NULL,
  "lon"          DOUBLE PRECISION NOT NULL,
  "tz"           DOUBLE PRECISION NOT NULL,
  "at_utc"       TIMESTAMPTZ(6) NOT NULL,
  "factors_key"  TEXT        NOT NULL,
  "ayanamsa"     TEXT        NOT NULL DEFAULT 'LAHIRI',
  "calc_version" TEXT,
  "source_hash"  TEXT        NOT NULL,
  "payload"      JSONB       NOT NULL,
  "fetched_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "transit_instants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transit_instants_key" ON "transit_instants" ("place_key", "at_utc", "factors_key", "ayanamsa");
CREATE INDEX IF NOT EXISTS "transit_instants_at" ON "transit_instants" ("at_utc");

CREATE TABLE IF NOT EXISTS "transit_range_skies" (
  "id"           TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "place_key"    TEXT        NOT NULL,
  "lat"          DOUBLE PRECISION NOT NULL,
  "lon"          DOUBLE PRECISION NOT NULL,
  "tz"           DOUBLE PRECISION NOT NULL,
  "from_date"    DATE        NOT NULL,
  "to_date"      DATE        NOT NULL,
  "planets_key"  TEXT        NOT NULL,
  "flags_key"    TEXT        NOT NULL,
  "ayanamsa"     TEXT        NOT NULL DEFAULT 'LAHIRI',
  "calc_version" TEXT,
  "source_hash"  TEXT        NOT NULL,
  "payload"      JSONB       NOT NULL,
  "fetched_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "transit_range_skies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "transit_range_skies_key" ON "transit_range_skies" ("place_key", "from_date", "to_date", "planets_key", "flags_key", "ayanamsa");

CREATE TABLE IF NOT EXISTS "kundli_transit_overlays" (
  "id"           TEXT        NOT NULL DEFAULT (uuid_generate_v4())::text,
  "kundli_id"    TEXT        NOT NULL,
  "kind"         TEXT        NOT NULL,
  "params_key"   TEXT        NOT NULL,
  "from_date"    DATE        NOT NULL,
  "to_date"      DATE        NOT NULL,
  "calc_version" TEXT,
  "source_hash"  TEXT        NOT NULL,
  "payload"      JSONB       NOT NULL,
  "fetched_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "kundli_transit_overlays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kundli_transit_overlays_kind_check" CHECK ("kind" IN ('range', 'contacts')),
  CONSTRAINT "kundli_transit_overlays_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX IF NOT EXISTS "kundli_transit_overlays_key" ON "kundli_transit_overlays" ("kundli_id", "kind", "params_key");
