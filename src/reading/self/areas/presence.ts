/** `self.v2.presence` — How you come across (doc 66 §4.3, §4.8): S8 keys, the past best window and the live care line. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder } from './common.js';

export function presenceArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'presence', 'always_plus_live');
  const p = ctx.sub.presence;
  b.keys('bearing', p?.bearing ?? []).keys('style', p?.style ?? []).keys('adornment', p?.adornment ?? []).keys('face', p?.face ?? []).keys('public_vs_private', p?.publicVsPrivate ?? []);
  if (p?.bestWindow) {
    b.claim('best_window', [p.bestWindow.evidence], { from: p.bestWindow.from, to: p.bestWindow.to });
    b.date(p.bestWindow.from, p.bestWindow.to, 'best_window');
  }
  if (p?.liveCare) {
    b.claim(`live_care:${p.liveCare.lord}`, [p.liveCare.evidence], { from: ctx.asOf, to: p.liveCare.until });
    b.date(p.liveCare.until, p.liveCare.until, 'live_care_ends');
  }
  return b.build();
}
