/** `self.v2.mind` — How you think (doc 66 §4.8): S6 facts by faculty, candidate patterns, promise entries and live ledger rows on ideas and home. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, inMatters, promiseEntries, riskRows } from './common.js';

const MIND_MATTERS = ['ideas_and_children', 'home_and_peace'] as const;

export function mindArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'mind', 'always_plus_live');
  const m = ctx.sub.mind;
  b.keys('feeling', m?.feeling ?? []).keys('thinking', m?.thinking ?? []).keys('peace', m?.peace ?? []).keys('judgement', m?.judgement ?? []);
  for (const c of m?.candidatePatterns ?? []) b.keys(`pattern:${c.placement}`, c.evidence);
  for (const e of promiseEntries(ctx, inMatters(MIND_MATTERS))) b.promiseEntry(e);
  for (const r of riskRows(ctx, inMatters(MIND_MATTERS))) b.risk(r);
  return b.build();
}
