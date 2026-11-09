/** `self.v2.chapters` — Chapters (doc 66 §4.8): previous, running and next main period, the running sub period and the level-1/2 boundaries of the running chapter. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder } from './common.js';

export function chaptersArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'chapters', 'chapter');
  const p = ctx.sub.periods;
  b.period('previous_main', p?.previous).period('running_main', p?.running).period('next_main', p?.next).period('running_sub', p?.runningSub);
  if (p) for (const x of p.boundaries) if (x.level <= 2 && x.date >= p.running.from && x.date <= p.running.to) b.date(x.date, x.date, `boundary_l${x.level}`);
  return b.build();
}
