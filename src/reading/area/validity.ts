/**
 * When a board's reading was made and the last day it stays good (docs/billing/02 §10). Both come from the stored
 * technique output that decides whether a board is rebuilt, so "good until" is exactly the day after which opening the
 * board builds it fresh and takes a question. Nothing here is computed from the chart.
 */
export interface ReadingValidity {
  /** ISO time the reading was made */
  made_at: string;
  /** last day (YYYY-MM-DD, inclusive) the reading is served as it is; null when it has no end */
  valid_until: string | null;
}

/** May the person ask for a fresh reading today (docs/billing/03)? Only once the last good day has passed. */
export function refreshDue(validUntil: string | null, today: string): boolean {
  return validUntil !== null && today > validUntil;
}

/** The newest ready build of an area for a kundli, any day (offline first: the last reading is served until refreshed). */
export function latestReadyBuild<T extends { as_of: Date }>(
  prisma: { areaBuild: { findFirst: (q: { where: { kundli_id: string; area: string; status: string }; orderBy: { as_of: 'desc' } }) => Promise<T | null> } },
  kundliId: string,
  area: string,
): Promise<T | null> {
  return prisma.areaBuild.findFirst({ where: { kundli_id: kundliId, area, status: 'ready' }, orderBy: { as_of: 'desc' } });
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** From a `withTechniqueOutput` result; the window's end is exclusive, and a reading is served at least through `asOf`. */
export function validityOf(out: { madeAt: Date; window: { to: Date | null } }, asOf: string): ReadingValidity {
  const last = out.window.to ? isoDay(new Date(out.window.to.getTime() - 1)) : null;
  return { made_at: out.madeAt.toISOString(), valid_until: last === null ? null : last < asOf ? asOf : last };
}

/** From a stored `area_builds` result; a row written before validity was stored falls back to the row's own day. */
export function storedValidity(result: unknown, createdAt: Date | null | undefined, asOf: string): ReadingValidity {
  const v = (result as { validity?: Partial<ReadingValidity> } | null)?.validity;
  if (v && typeof v.made_at === 'string' && (v.valid_until === null || typeof v.valid_until === 'string')) return { made_at: v.made_at, valid_until: v.valid_until };
  return { made_at: (createdAt ?? new Date(`${asOf}T00:00:00Z`)).toISOString(), valid_until: asOf };
}
