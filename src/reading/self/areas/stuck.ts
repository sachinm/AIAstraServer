/** `self.v2.stuck` — Where you get stuck (doc 66 §4.3, §4.8): the heaviest live window, windows started in the last year that still run, every live ledger row, standing knots, and the mind's candidate patterns. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, promiseEntries, riskRows } from './common.js';

export function stuckArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'stuck', 'live_plus_standing');
  const w = ctx.sub.windows;
  b.window('heaviest_now', w?.heaviestNow);
  if (w?.easesAt) b.date(w.easesAt, w.easesAt, 'eases');
  for (const s of w?.startedLast12m ?? []) if (s.to > ctx.asOf && s.polarity === 'presses') b.window('started_last_12m', s);
  for (const r of riskRows(ctx)) b.risk(r);
  for (const e of promiseEntries(ctx, (x) => x.kind === 'knot')) b.promiseEntry(e);
  for (const c of ctx.sub.mind?.candidatePatterns ?? []) b.keys(`pattern:${c.placement}`, c.evidence);
  return b.build();
}
