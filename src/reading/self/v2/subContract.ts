/**
 * TEMPORARY (integrator deletes this file): the shapes the sub-techniques lane (`feat/self-v2-subtechniques`) exports
 * from `src/reading/self/sub/index.ts` and `src/reading/self/areas/index.ts`, declared here so this branch compiles
 * without those files. When both branches are merged, replace the imports of this module with the real ones and delete
 * it (see docs/TODOS.md, "Filed 2026-11-09 by Self v2 step 1c/3/4").
 */
import type { PrismaClient } from '@prisma/client';
import type { TransitRangePayload } from '../../chartData/transitRange.js';
import type { ActivationRow } from '../../digest/activation.js';
import type { DigestView } from '../../digest/types.js';
import type { AreaBrief, IsoDate, SelfBuildContext } from '../v2types.js';

export interface SelfV2Deps {
  prisma: PrismaClient;
}

export interface SelfV2Loaded {
  view: DigestView;
  activation: ActivationRow[];
  sky: TransitRangePayload | null;
  preferred: string | null;
}

export interface SelfV2SubResult {
  ctx: SelfBuildContext;
  loaded: SelfV2Loaded;
  gaps: string[];
  ms: Record<string, number>;
}

export interface SelfV2Subs {
  runSelfSubTechniques(deps: SelfV2Deps, args: { userId: string; kundliId: string; asOf: IsoDate }): Promise<SelfV2SubResult | { status: 'preparing' }>;
  buildAreaBriefs(ctx: SelfBuildContext): AreaBrief[];
}

// non-literal specifiers so tsc does not resolve them on a branch where the files do not exist yet
const SUB_MODULE = '../sub/index.js';
const AREAS_MODULE = '../areas/index.js';

/** The real sub-techniques and area briefs, or null while their branch is not merged. Never throws. */
export async function loadSelfV2Subs(): Promise<SelfV2Subs | null> {
  try {
    const [sub, areas] = (await Promise.all([import(SUB_MODULE), import(AREAS_MODULE)])) as [Partial<SelfV2Subs>, Partial<SelfV2Subs>];
    if (typeof sub.runSelfSubTechniques !== 'function' || typeof areas.buildAreaBriefs !== 'function') return null;
    return { runSelfSubTechniques: sub.runSelfSubTechniques, buildAreaBriefs: areas.buildAreaBriefs };
  } catch {
    return null;
  }
}
