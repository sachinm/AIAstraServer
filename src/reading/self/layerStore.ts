/**
 * The stores of a build's Layer 1 and Layer 2 outputs (doc 66 §4.8 step 2; AGENTS.md machinery rule 1): each
 * sub-technique output under self.sub.<name> and each area brief under self.v2.<area>, keyed by the stamps. Moved
 * unchanged from self/v2/build.ts (plan "retire the v2 Self reading", server step 1); the old path re-exports.
 */
import type { PrismaClient } from '@prisma/client';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import { subTechniqueId } from './sub/index.js';
import { SELF_V2_REFRESH, type AreaBrief, type RefreshTrigger, type SelfBuildContext } from './v2types.js';

/** the sub-technique slots of the build context and their catalogue ids (self.sub.mind_facts …) */
export const SUB_SLOTS: ReadonlyArray<[keyof SelfBuildContext['sub'], string]> = [
  ['clock', 'clock'],
  ['periods', 'periods'],
  ['windows', 'windows'],
  ['promise', 'promise'],
  ['risk', 'risk'],
  ['mind', 'mindFacts'],
  ['body', 'bodyFacts'],
  ['presence', 'presenceFacts'],
  ['year', 'year'],
  ['profile', 'profile'],
];

/**
 * What can make each sub-technique's output stale (doc 66 §4.8 Layer 1); the digest version and the clock are in every
 * key. The areas use SELF_V2_REFRESH.
 */
export const SUB_REFRESH: Readonly<Record<string, readonly RefreshTrigger[]>> = {
  clock: ['digest'],
  periods: ['main_period', 'sub_period', 'sub_sub_period'],
  windows: ['sub_sub_period', 'sky_week'],
  promise: ['digest'],
  risk: ['sub_sub_period', 'sky_week'],
  mindFacts: ['digest'],
  bodyFacts: ['sub_sub_period', 'sky_week'],
  presenceFacts: ['main_period', 'sub_period'],
  year: ['year'],
  profile: ['profile', 'confirm'],
};

export const ALL_TRIGGERS: readonly RefreshTrigger[] = ['main_period', 'sub_period', 'sub_sub_period', 'sky_week', 'year', 'profile', 'confirm'];

/**
 * The key of a Layer 1 or Layer 2 output: its id, the digest version, the clock and the stamps of the triggers that can
 * change it (default: every stamp). Unchanged stamps give the same key, so a rebuild writes nothing.
 */
export function layerStoreKey(id: string, ctx: SelfBuildContext, triggers: readonly RefreshTrigger[] = ALL_TRIGGERS): string {
  const s = ctx.stamps;
  const t = new Set(triggers);
  const parts = [id, s.digestVersion, `clock=${s.clock}`];
  if (t.has('main_period')) parts.push(`main=${s.mainPeriod ?? '-'}`);
  if (t.has('sub_period')) parts.push(`sub=${s.subPeriod ?? '-'}`);
  if (t.has('sub_sub_period')) parts.push(`subsub=${s.subSubPeriod ?? '-'}`);
  if (t.has('sky_week')) parts.push(`sky=${s.skyWeek ?? '-'}`);
  if (t.has('year')) parts.push(`year=${s.year ?? '-'}`);
  if (t.has('profile')) parts.push(`profile=${s.profileHash ?? '-'}`);
  if (t.has('confirm')) parts.push(`confirm=${s.confirmHash ?? '-'}`);
  return parts.join('|');
}

/**
 * Step 2's stores (doc 66 §4.8; AGENTS.md machinery rule 1): each sub-technique output under `self.sub.<name>` and each
 * area brief under `self.v2.<area>`, keyed by the stamps. An unchanged key is a hit and writes nothing. Never throws.
 */
export async function storeLayerOutputs(
  prisma: PrismaClient,
  ctx: SelfBuildContext,
  briefs: readonly AreaBrief[],
  now: Date,
  runningPeriod: { from: Date; to: Date } | null,
): Promise<{ stored: string[]; cached: string[]; unkeyed: string[]; failed: string[] }> {
  const items: Array<{ id: string; agent: string; value: unknown; triggers: readonly RefreshTrigger[] }> = [
    ...SUB_SLOTS.filter(([slot]) => ctx.sub[slot] !== undefined).map(([slot, name]) => ({ id: subTechniqueId(name), agent: 'self.sub', value: ctx.sub[slot], triggers: SUB_REFRESH[name] ?? ALL_TRIGGERS })),
    ...briefs.map((b) => ({ id: `self.v2.${b.areaId}`, agent: 'self.reading_panel', value: b, triggers: SELF_V2_REFRESH[b.areaId] ?? ALL_TRIGGERS })),
  ];
  const stored: string[] = [];
  const cached: string[] = [];
  const unkeyed: string[] = [];
  const failed: string[] = [];
  await Promise.all(
    items.map(async (it) => {
      try {
        const res = await withTechniqueOutput(
          prisma,
          { technique: it.id, kundliId: ctx.kundliId, digestVersion: layerStoreKey(it.id, ctx, it.triggers), context: { now, runningPeriod }, agentId: it.agent, userId: ctx.userId, logCachedRun: false },
          async () => it.value,
        );
        // a technique whose freshness is per question (a `findings` input with no synthesizer upstream) gets no key
        (!res.cacheKey ? unkeyed : res.cached ? cached : stored).push(it.id);
      } catch {
        failed.push(it.id);
      }
    }),
  );
  return { stored, cached, unkeyed, failed };
}
