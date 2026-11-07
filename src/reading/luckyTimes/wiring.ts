/**
 * Production wiring for Lucky times (docs/reading-engine/49, 53 §4.6): the engine call at a place and the person's
 * natal fields for the personal layer, plus digest-backed `functionalNatureOf` and `runningDashaLordsOf`.
 */
import type { PrismaClient } from '@prisma/client';
import { fetchEngineExportAtPlace } from '../../lib/astroKundliClient.js';
import { natalFields } from '../chartData/transit.js';
import { prismaChartDataRepo } from '../chartData/store.js';
import { activationFor } from '../digest/activation.js';
import { loadDigest } from '../digest/load.js';
import type { Planet } from './scenarios.js';
import type { EngineFetch, LuckyDeps } from './service.js';
import type { FunctionalNature } from './windows.js';

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

const PLANET_BY_CODE: Partial<Record<string, Planet>> = {
  Su: 'Sun',
  Mo: 'Moon',
  Ma: 'Mars',
  Me: 'Mercury',
  Ju: 'Jupiter',
  Ve: 'Venus',
  Sa: 'Saturn',
};

const DASHA_LORD_BY_CODE: Record<string, string> = {
  Su: 'Sun',
  Mo: 'Moon',
  Ma: 'Mars',
  Me: 'Mercury',
  Ju: 'Jupiter',
  Ve: 'Venus',
  Sa: 'Saturn',
  Ra: 'Rahu',
  Ke: 'Ketu',
};

function parseFunctionalNature(raw: string | null | undefined): FunctionalNature | undefined {
  if (!raw) return undefined;
  const hasBenefic = /yoga\s*karaka|benefic/i.test(raw);
  const hasMalefic = /malefic/i.test(raw);
  if (hasBenefic && !hasMalefic) return 'benefic';
  if (hasMalefic && !hasBenefic) return 'malefic';
  if (/neutral/i.test(raw) || (hasBenefic && hasMalefic)) return 'neutral';
  return undefined;
}

/**
 * Reads the person's D1 planet cards from `kundli_digest` (when `digest_status = 'ready'`) and maps each classical
 * seven-planet hora lord (`Su..Sa`) to `'benefic' | 'malefic' | 'neutral'`. Returns `null` when no ready digest exists.
 */
export function functionalNatureOf(prisma: PrismaClient): NonNullable<LuckyDeps['functionalNatureOf']> {
  return async (kundliId: string): Promise<Partial<Record<Planet, FunctionalNature>> | null> => {
    const view = await loadDigest(prisma, kundliId);
    if (!view) return null;
    const out: Partial<Record<Planet, FunctionalNature>> = {};
    for (const card of view.planets('D1')) {
      const planet = PLANET_BY_CODE[card.planet];
      if (!planet) continue;
      const nature = parseFunctionalNature(card.functional);
      if (nature) out[planet] = nature;
    }
    return Object.keys(out).length > 0 ? out : null;
  };
}

/**
 * Reads the person's running Vimsottari dasha/antardasha lords from `kundli_activation` at `asOf` (`YYYY-MM-DD`).
 */
export function runningDashaLordsOf(prisma: PrismaClient): NonNullable<LuckyDeps['runningDashaLordsOf']> {
  return async (kundliId: string, asOf?: string): Promise<readonly string[] | null> => {
    const date = asOf ?? new Date().toISOString().slice(0, 10);
    try {
      const rows = await activationFor(prisma, kundliId, {
        from: date,
        to: date,
        systems: ['vimsottari'],
        maxLevel: 2,
      });
      if (!rows.length) return null;
      const lords = new Set<string>();
      for (const r of rows) {
        if (!r.lord) continue;
        const mapped = DASHA_LORD_BY_CODE[r.lord] ?? r.lord;
        if (mapped) lords.add(mapped);
      }
      return lords.size > 0 ? [...lords] : null;
    } catch {
      return null;
    }
  };
}
