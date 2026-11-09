/** `self.v2.lagna` — Who you are (doc 66 §4.8): the 1st and lagna lord keys, the public/private keys, the promise entries on the self. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, inMatters, promiseEntries } from './common.js';

export function lagnaArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'lagna', 'always');
  b.keys('bearing', ctx.sub.presence?.bearing ?? []);
  b.keys('seen_vs_private', ctx.sub.presence?.publicVsPrivate ?? []);
  for (const e of promiseEntries(ctx, inMatters(['self_and_body']))) b.promiseEntry(e);
  return b.build();
}
