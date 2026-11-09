/** `self.v2.yogas` — Gifts & knots (doc 66 §4.8): every promise entry, gifts first, then knots, then graces. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, promiseEntries } from './common.js';

const ORDER = { gift: 0, knot: 1, grace: 2 } as const;

export function yogasArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'yogas', 'always');
  for (const e of [...promiseEntries(ctx)].sort((x, y) => ORDER[x.kind] - ORDER[y.kind])) b.promiseEntry(e);
  return b.build();
}
