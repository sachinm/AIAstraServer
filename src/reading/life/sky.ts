/**
 * The transit gate of the life reading (docs/reading-engine/34 §2, rank 5), read from the stored natal-overlay transit
 * chart (transit_snapshots, the engine's `transits` export) when one is stored. Read-only: no engine call is made here;
 * when nothing is stored the gate is unknown and the grade says so. Houses are the engine's `house_from_lagna` and
 * double-transit `houses`; nothing is derived.
 */
import type { PrismaClient } from '@prisma/client';
import { TRANSIT_SNAPSHOT_VERSION } from '../data/store.js';
import type { TransitChart } from '../transits/types.js';

export interface SkyView {
  from: string;
  to: string;
  /** Jupiter and Saturn together on these houses (engine double_transit windows) */
  gates: Array<{ from: string; to: string; houses: number[] }>;
  /** slow-moving bodies (Saturn, Rahu, Ketu) by house from the lagna */
  slow: Array<{ planet: string; from: string; to: string; house: number }>;
}

const SLOW = new Set(['Sa', 'Ra', 'Ke']);

export function skyFromChart(chart: TransitChart | null | undefined): SkyView | null {
  if (!chart || !Array.isArray(chart.rows)) return null;
  return {
    from: chart.from,
    to: chart.to,
    gates: (chart.double_transit ?? []).filter((w) => w && w.from && w.to && Array.isArray(w.houses)).map((w) => ({ from: w.from, to: w.to, houses: w.houses })),
    slow: chart.rows.filter((r) => SLOW.has(r.planet) && typeof r.house_from_lagna === 'number').map((r) => ({ planet: r.planet, from: r.from, to: r.to, house: r.house_from_lagna })),
  };
}

/** The newest stored transit chart of the kundli, or null. Never fetches. */
export async function loadStoredSky(prisma: PrismaClient, kundliId: string): Promise<{ sky: SkyView; id: string } | null> {
  const row = await prisma.transitSnapshot
    .findFirst({ where: { kundli_id: kundliId, snapshot_version: TRANSIT_SNAPSHOT_VERSION }, orderBy: { built_at: 'desc' }, select: { id: true, snapshot: true } })
    .catch(() => null);
  if (!row) return null;
  const sky = skyFromChart(row.snapshot as unknown as TransitChart);
  return sky ? { sky, id: row.id } : null;
}
