/** `self.v2.year` — This year (doc 66 §4.8): the stored annual row covering asOf, its lagna, year lord and short clock; nothing when no row covers asOf. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder } from './common.js';

export function yearArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'year', 'twelve_months');
  const y = ctx.sub.year;
  if (!y || y.noCoverage) return b.build();
  const span = { from: y.from, to: y.to };
  if (y.yearLagna) b.claim('year_lagna', [y.yearLagna], span);
  if (y.yearLord) b.claim('year_lord', [y.yearLord], span);
  b.period('short_clock', y.shortClock);
  b.date(y.from, y.to, 'year');
  return b.build();
}
