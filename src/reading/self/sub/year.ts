/**
 * S9 `self.sub.year` (docs/reading-engine/66 §4.8, §4.10): the year read from the Tithi Pravesha chart whose return moment
 * has passed (`runningTithiPravesha`): the TP year window (tp_start → tp_end), the TP year lagna, the year lord (the TP row's
 * when stored, else the engine's annual pressure row covering today), and the TP year dasha period as the short clock
 * (only when the engine bounds it to the year). Varshaphala and its Mudda period stay in the frame as the confirming clock.
 * When no TP year covers asOf the frame is `noCoverage`; the Varsha year is never put in its place (doc 66 §12).
 */
import { runningTithiPravesha } from '../../annual/tithiPravesha.js';
import type { PeriodSpan, YearFrame } from '../v2types.js';
import type { SubEnv } from './common.js';

export function subYear(env: SubEnv): YearFrame {
  const tp = runningTithiPravesha(env.view, env.asOf);
  for (const x of tp.gaps) env.g.add(`year: ${x}`);
  const v = tp.varsha;
  const confirmClock: PeriodSpan | null = v ? { level: 1, lord: v.lord, from: v.from, to: v.to, evidence: `annual:VP${v.row.year}.D1#mudda` } : null;
  if (!tp.row || tp.year == null || !tp.from || !tp.to) {
    env.g.add(`year: no Tithi Pravesha year covers ${env.asOf}`);
    return { from: env.asOf, to: env.asOf, yearLagna: null, yearLord: null, shortClock: null, noCoverage: true, confirmClock };
  }
  const key = `annual:TP${tp.year}.D1`;
  if (!tp.row.lagna) env.g.add(`year: ${key}.lagna missing`);
  // the year lord: the TP row's when the engine stores it, else the engine's annual pressure row (level 1) covering today
  let yearLord: string | null = tp.row.yearLord ? `${key}#yearLord` : null;
  if (!yearLord) {
    const annual = (env.pressure?.rows ?? []).find((r) => r.kind === 'annual' && (r.level ?? 1) === 1 && r.planet && r.from <= env.asOf && env.asOf < r.to);
    if (annual) yearLord = annual.evidence[0] ?? annual.id;
    else env.g.add(`year: ${key}.yearLord missing (no TP year lord stored and no annual pressure row)`);
  }
  const sc = tp.shortClock;
  return {
    from: tp.from,
    to: tp.to,
    yearLagna: tp.row.lagna ? `${key}#lagna` : null,
    yearLord,
    shortClock: sc ? { level: 1, lord: sc.lord, from: sc.from, to: sc.to, evidence: `${key}#${sc.system}` } : null,
    noCoverage: false,
    tpStart: tp.start,
    tpEnd: tp.end,
    confirmClock,
  };
}
