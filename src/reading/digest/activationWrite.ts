/**
 * Replace one band of a kundli's activation rows in ONE transaction (docs/reading-engine/67): delete the kundli's rows
 * whose level is in [minLevel, maxLevel] (and, when given, whose system is in `systems`), then insert the new rows in
 * batches of 500. Only `kundli_activation` is touched, and only this kundli's rows in the band: they are derived from the
 * stored engine trees and can always be rebuilt. Used by the dasha-deep worker (levels 4..6) and the levels backfill
 * (levels 1..3).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ActivationLevel, ActivationRowInput } from './activation.js';
import { DIGEST_VERSION } from './types.js';

const BATCH = 500;

export interface ActivationBand {
  minLevel: ActivationLevel;
  maxLevel: ActivationLevel;
  /** only these systems' rows are replaced (a system whose pull failed keeps its rows) */
  systems?: string[];
}

export function activationBandWhere(kundliId: string, band: ActivationBand): Prisma.KundliActivationWhereInput {
  return {
    kundli_id: kundliId,
    level: { gte: band.minLevel, lte: band.maxLevel },
    ...(band.systems ? { system: { in: band.systems } } : {}),
  };
}

export async function replaceActivationBand(prisma: PrismaClient, kundliId: string, rows: readonly ActivationRowInput[], band: ActivationBand): Promise<{ deleted: number; inserted: number }> {
  const keep = rows.filter((a) => a.level >= band.minLevel && a.level <= band.maxLevel && (!band.systems || band.systems.includes(a.system)));
  const ops: Prisma.PrismaPromise<{ count: number }>[] = [prisma.kundliActivation.deleteMany({ where: activationBandWhere(kundliId, band) })];
  for (let i = 0; i < keep.length; i += BATCH) {
    ops.push(
      prisma.kundliActivation.createMany({
        data: keep.slice(i, i + BATCH).map((a) => ({
          kundli_id: kundliId,
          system: a.system,
          family: a.family,
          level: a.level,
          lord: a.lord,
          sign: a.sign,
          from_date: new Date(`${a.from}T00:00:00Z`),
          to_date: new Date(`${a.to}T00:00:00Z`),
          houses: a.houses,
          parent_lord: a.parentLord,
          digest_version: DIGEST_VERSION,
        })),
      }),
    );
  }
  const res = await prisma.$transaction(ops);
  return { deleted: res[0]?.count ?? 0, inserted: res.slice(1).reduce((n, r) => n + (r?.count ?? 0), 0) };
}

/** Rows of a kundli per level (for the backfill's before/after print). */
export async function activationCountsByLevel(prisma: PrismaClient, kundliId: string): Promise<Record<number, number>> {
  const g = await prisma.kundliActivation.groupBy({ by: ['level'], where: { kundli_id: kundliId }, _count: { _all: true } });
  return Object.fromEntries(g.map((r) => [r.level, r._count._all]));
}
