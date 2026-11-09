/** `self.v2.chapter` — This chapter (doc 66 §4.8): the running sub period, its charter relation to the main lord, the windows and ledger rows inside it. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, riskRows } from './common.js';

export function chapterArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'chapter', 'sub_period');
  const p = ctx.sub.periods;
  const sub = p?.runningSub ?? null;
  b.period('running_sub', sub);
  if (sub && p?.subRelation) b.claim(`relation:${p.subRelation}`, [sub.evidence, p.running.evidence], { from: sub.from, to: sub.to });
  if (sub) {
    for (const s of ctx.sub.windows?.strip ?? []) if (s.from < sub.to && s.to > sub.from && s.polarity !== 'mixed') b.window('in_sub', s);
    // every ledger row is live at asOf, so inside the running sub period
    for (const r of riskRows(ctx)) b.risk(r);
  }
  return b.build();
}
