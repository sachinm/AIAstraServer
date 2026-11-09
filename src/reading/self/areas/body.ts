/** `self.v2.body` — Body & energy (doc 66 §4.8): S7 footing, wear and shape keys, the live lords on body houses, live transits over lagna and Moon, ledger rows on body and work load. */
import type { AreaBrief, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, inMatters, riskRows } from './common.js';

export function bodyArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'body', 'live_plus_standing');
  const f = ctx.sub.body;
  b.keys('footing', f?.footing ?? []).keys('wear', f?.wear ?? []).keys('shape', f?.shape ?? []);
  for (const l of f?.liveLords ?? []) {
    b.claim(`live_lord:${l.lord}:h${l.houses.join('+')}`, [l.evidence], { from: ctx.asOf, to: l.until });
    b.date(l.until, l.until, `live_lord_ends:${l.lord}`);
  }
  for (const t of f?.liveTransits ?? []) b.window('live_transit', t);
  if (f?.sensitive) b.keys('sensitive_passage', f.footing);
  for (const r of riskRows(ctx, inMatters(['self_and_body', 'work_load_and_health', 'sudden_and_hidden']))) b.risk(r);
  return b.build();
}
