-- M3 (reading engine Phase 1): transit charts served by the pyjhora Lambda, cached per day.
-- kundli_id NULL  = global snapshot (positions + ingresses, shared by every user)
-- kundli_id set   = the same range placed against that kundli's natal chart (houses from Lagna/Moon/AL, overlays)
CREATE TABLE "transit_snapshots" (
  "id" TEXT NOT NULL DEFAULT (uuid_generate_v4())::text,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "kundli_id" TEXT,
  "ayanamsa" TEXT NOT NULL DEFAULT 'LAHIRI',
  "snapshot_version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "built_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transit_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transit_snapshots_kundli_id_fkey" FOREIGN KEY ("kundli_id") REFERENCES "kundlis"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "transit_snapshots_range" ON "transit_snapshots"("from_date", "to_date");
CREATE INDEX "transit_snapshots_kundli_range" ON "transit_snapshots"("kundli_id", "from_date", "to_date");
