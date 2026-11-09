/**
 * S2 `self.sub.periods` (docs/reading-engine/66 §4.8): previous, running and next main period of the primary clock, the
 * running sub and sub-sub period, the boundaries between them, and the relation of the sub lord to the main lord AS THE
 * ENGINE'S DASHA CHARTER STATES IT (`PlanetCard.dashaCharter.fruition[<sub lord>]` of the main lord: the 6/8 and 2/12
 * flags, else its fruition class). Selection only.
 */
import type { ActivationRow } from '../../digest/activation.js';
import { activationKey, mdSpine, runningChain } from '../slices.js';
import type { ClockResolution, PeriodFrame, PeriodSpan } from '../v2types.js';
import type { SubEnv } from './common.js';

export function periodSpan(r: ActivationRow | null): PeriodSpan | null {
  if (!r) return null;
  return { level: r.level, lord: r.lord ?? r.sign ?? '?', from: r.from, to: r.to, evidence: activationKey(r) };
}

/** the engine charter's relation of `subLord` to `mainLord`; null and a gap when not stored */
export function charterRelation(env: SubEnv, mainLord: string | null, subLord: string | null): string | null {
  if (!mainLord || !subLord) return null;
  const card = env.view.planet('D1', mainLord);
  const cell = card?.dashaCharter?.fruition?.[subLord];
  if (!cell) {
    env.g.add(`periods: planet:D1.${mainLord}.dashaCharter.fruition.${subLord} missing`);
    return null;
  }
  if (cell.isShadAshtaka68) return '6/8';
  if (cell.isDwirdwadasha212) return '2/12';
  if (cell.fruitionClass) return cell.fruitionClass;
  env.g.add(`periods: planet:D1.${mainLord}.dashaCharter.fruition.${subLord}.fruitionClass missing`);
  return null;
}

export function subPeriods(env: SubEnv, clock: ClockResolution): PeriodFrame | null {
  const sys = clock.primary;
  const spine = mdSpine(env.activation, sys, env.asOf);
  const chain = runningChain(env.activation, sys, env.asOf);
  const running = periodSpan(spine.running ?? chain.l1);
  if (!running) {
    env.g.add(`periods: no level-1 period of ${sys} covers ${env.asOf}`);
    return null;
  }
  const sub = chain.l2 ?? spine.runningSub;
  const subSub = chain.l3;
  if (!sub) env.g.add(`periods: no level-2 period of ${sys} covers ${env.asOf}`);
  if (!subSub) env.g.add(`periods: no level-3 period of ${sys} covers ${env.asOf}`);
  const mainLord = spine.running?.lord ?? chain.l1?.lord ?? null;
  const subRelation = sub && mainLord && sub.lord ? charterRelation(env, mainLord, sub.lord) : null;
  if (sub && (!mainLord || !sub.lord)) env.g.add('periods: rasi clock, no charter relation stored for sign periods');

  const marks = new Map<string, { date: string; level: 1 | 2 | 3 }>();
  const mark = (date: string | undefined, level: 1 | 2 | 3) => {
    if (!date) return;
    const k = `${date}|${level}`;
    if (!marks.has(k)) marks.set(k, { date, level });
  };
  for (const r of [spine.previous, spine.running, spine.next]) if (r) { mark(r.from, 1); mark(r.to, 1); }
  for (const r of spine.subs) { mark(r.from, 2); mark(r.to, 2); }
  if (subSub) { mark(subSub.from, 3); mark(subSub.to, 3); }
  const boundaries = [...marks.values()].sort((a, b) => a.date.localeCompare(b.date) || a.level - b.level);

  return {
    system: sys,
    previous: periodSpan(spine.previous),
    running,
    next: periodSpan(spine.next),
    runningSub: periodSpan(sub),
    runningSubSub: periodSpan(subSub),
    subRelation,
    boundaries,
  };
}
