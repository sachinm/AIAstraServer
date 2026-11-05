/**
 * Production wiring for Lucky times (docs/reading-engine/49): the engine call at a place and the person's natal fields
 * for the personal layer. Kept apart from the service so tests pass fakes.
 */
import type { PrismaClient } from '@prisma/client';
import { fetchEngineExportAtPlace } from '../../lib/astroKundliClient.js';
import { natalFields } from '../chartData/transit.js';
import { prismaChartDataRepo } from '../chartData/store.js';
import type { EngineFetch, LuckyDeps } from './service.js';

export const engineAtPlace: EngineFetch = (type, fields) => fetchEngineExportAtPlace(type, fields) as Promise<unknown>;

/** The person's latest kundli as the engine's `natal_*` fields (inside `params` for the daily types). */
export function natalForUser(prisma: PrismaClient): NonNullable<LuckyDeps['natalFor']> {
  const repo = prismaChartDataRepo(prisma);
  return async (userId) => {
    const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
    if (!k) return null;
    const req = await repo.kundliRequest(k.id);
    if (!req) return null;
    return { kundliId: k.id, fields: natalFields(req) };
  };
}
