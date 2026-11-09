/** `self.v2.now` — Right now, the hero (doc 66 §4.8 Layer 2): the heaviest live window, when it eases, the next support, the six-month strip, the running sub-sub period and the top three ledger rows. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, riskRows } from './common.js';

export function nowArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'now', 'six_months_each_way');
  const w = ctx.sub.windows;
  const p = ctx.sub.periods;
  b.window('heaviest_now', w?.heaviestNow);
  if (w?.easesAt) b.date(w.easesAt, w.easesAt, 'eases');
  if (w?.nextSupportFrom) b.date(w.nextSupportFrom, w.nextSupportFrom, 'next_support');
  for (const s of w?.strip ?? []) if (s.polarity !== 'mixed') b.window('strip', s);
  b.period('running_sub_sub', p?.runningSubSub);
  const top = new Set(ctx.sub.risk?.top3 ?? []);
  for (const r of riskRows(ctx, (x) => top.has(x.id))) b.risk(r);
  return b.build();
}
