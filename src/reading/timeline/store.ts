/**
 * The ledger and stored builds (migration 20261027100000_timeline_m14_ledger_and_builds: life_events, timeline_builds,
 * timeline_windows, timeline_matches, timeline_calibration). The migration may not be applied on a given database, so
 * every read and write is wrapped like src/services/userLocation.ts: a missing table (or any database error) is logged
 * once per process and treated as "no ledger / not stored"; the build itself never fails because of it. Raw SQL, so it
 * works whether or not the generated Prisma client knows the new models.
 */
import type { PrismaClient } from '@prisma/client';
import type { CalibrationRow } from './calibrate.js';
import { parseLedger, type LifeEvent } from './ledger.js';
import type { PastVerification } from './pipeline.js';

export type LedgerLookup = { status: 'found'; events: LifeEvent[] } | { status: 'unavailable' };

let warned = false;
function warnOnce(op: string, err: unknown): void {
  if (warned) return;
  warned = true;
  const e = err as { code?: unknown; message?: unknown };
  console.warn(JSON.stringify({ msg: 'timeline tables unavailable; treating as no ledger / not stored (migration timeline_m14 applied?)', op, code: typeof e?.code === 'string' ? e.code : undefined, error: String(e?.message ?? err).slice(0, 200) }));
}

/** For tests: let the next failure log again. */
export function resetTimelineStoreWarning(): void {
  warned = false;
}

export async function readLedger(prisma: PrismaClient, kundliId: string): Promise<LedgerLookup> {
  try {
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT "id", "category", "date", "date_precision", "place", "attributes" FROM "life_events" WHERE "kundli_id" = ${kundliId} ORDER BY "date"`;
    return { status: 'found', events: parseLedger(rows).events };
  } catch (err) {
    warnOnce('readLedger', err);
    return { status: 'unavailable' };
  }
}

/** Calibration rows the next build reads (doc 27 §B.2 timeline_calibration): per system and marker, no pooled rows */
export function calibrationRowsToStore(rows: readonly CalibrationRow[]): CalibrationRow[] {
  return rows.filter((r) => r.system !== 'ALL' && r.marker !== '*');
}

/**
 * Store a verified past build: the build row, its non-quiet windows, the matches and the calibration. Returns the build
 * id, or null when the tables are unavailable (never throws). One transaction, so a half-written build never shows.
 */
export async function saveVerifiedBuild(prisma: PrismaClient, v: PastVerification): Promise<string | null> {
  const b = v.build;
  try {
    return await prisma.$transaction(async (tx) => {
      const [{ id }] = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO "timeline_builds" ("kundli_id", "dossier_hash", "from", "to", "grain", "system_versions", "weights", "status")
        VALUES (${b.kundliId}, ${b.foundation.hash}, ${b.range.from}::date, ${b.range.to}::date, 'month', ${JSON.stringify(b.stack.sources)}::jsonb, ${JSON.stringify(b.weights)}::jsonb, 'ready') RETURNING "id"`;
      const windowIds = new Map<object, string>();
      for (const w of b.grid.windows) {
        const [row] = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO "timeline_windows" ("build_id", "marker", "from", "to", "grain", "band", "testing", "support_score", "test_score", "systems", "agent", "channel")
          VALUES (${id}, ${w.marker}, ${w.from}::date, ${w.to}::date, 'month', ${w.band}, ${w.testing}, ${w.supportScore}, ${w.testScore}, ${JSON.stringify(w.systems)}::jsonb, ${w.agent}, ${w.channel}) RETURNING "id"`;
        windowIds.set(w, row!.id);
      }
      for (const m of v.matches) {
        if (m.result !== 'hit' && m.result !== 'near' && m.result !== 'miss') continue;
        const windowId = m.window ? (windowIds.get(m.window) ?? null) : null;
        await tx.$executeRaw`INSERT INTO "timeline_matches" ("build_id", "event_id", "window_id", "result") VALUES (${id}, ${m.event.id}, ${windowId}, ${m.result})`;
      }
      for (const r of calibrationRowsToStore(v.calibration.rows)) {
        await tx.$executeRaw`INSERT INTO "timeline_calibration" ("kundli_id", "system", "marker", "precision", "recall", "n", "weight", "computed_at")
          VALUES (${b.kundliId}, ${r.system}, ${r.marker}, ${r.precision}, ${r.recall}, ${r.n}, ${r.weight}, now())
          ON CONFLICT ("kundli_id", "system", "marker") DO UPDATE SET "precision" = EXCLUDED."precision", "recall" = EXCLUDED."recall", "n" = EXCLUDED."n", "weight" = EXCLUDED."weight", "computed_at" = now()`;
      }
      return id;
    });
  } catch (err) {
    warnOnce('saveVerifiedBuild', err);
    return null;
  }
}
