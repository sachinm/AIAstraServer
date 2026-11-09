/** `self.v2.diagnosis` — In short (doc 66 §4.8): the lagna lord's keys, the running tension (the ledger's top row), the running main and sub period. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, riskRows } from './common.js';

export function diagnosisArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'diagnosis', 'sub_period');
  b.keys('footing', ctx.sub.presence?.bearing ?? []);
  const top = ctx.sub.risk?.top3[0];
  const r = top ? riskRows(ctx, (x) => x.id === top)[0] : undefined;
  if (r) b.risk(r);
  b.period('running_main', ctx.sub.periods?.running);
  b.period('running_sub', ctx.sub.periods?.runningSub);
  return b.build();
}
