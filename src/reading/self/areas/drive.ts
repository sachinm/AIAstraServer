/** `self.v2.drive` — Drive & ambition (doc 66 §4.8): promise entries and live ledger rows on effort, career, gains and money, and the live windows on those matters. */
import type { AreaBrief, Matter, SelfBuildContext } from '../v2types.js';
import { BriefBuilder, inMatters, promiseEntries, riskRows } from './common.js';

const DRIVE_MATTERS: readonly Matter[] = ['effort_and_courage', 'career_and_standing', 'gains_and_network', 'money_in_hand', 'ideas_and_children'];

export function driveArea(ctx: SelfBuildContext): AreaBrief {
  const b = new BriefBuilder(ctx, 'drive', 'always_plus_live');
  for (const e of promiseEntries(ctx, inMatters(DRIVE_MATTERS))) b.promiseEntry(e);
  for (const r of riskRows(ctx, inMatters(DRIVE_MATTERS))) b.risk(r);
  const by = ctx.sub.windows?.byMatter ?? {};
  for (const m of DRIVE_MATTERS) for (const w of by[m] ?? []) if (w.from <= ctx.asOf && ctx.asOf < w.to && w.polarity !== 'mixed') b.window(`live:${m}`, w);
  return b.build();
}
