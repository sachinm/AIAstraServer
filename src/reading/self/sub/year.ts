/**
 * S9 `self.sub.year` (docs/reading-engine/66 §4.8): the stored annual (Varsha) row whose Mudda periods cover asOf, its
 * span, its lagna and year lord when stored, and the running Mudda period as the short clock. When no stored annual row
 * covers asOf the frame is `noCoverage` and nothing is taken from another year (doc 66 §12: never the first period).
 */
import { runningMudda } from '../panels/year.js';
import type { YearFrame } from '../v2types.js';
import type { SubEnv } from './common.js';

export function subYear(env: SubEnv): YearFrame {
  const m = runningMudda(env.view, env.asOf);
  if (!m) {
    env.g.add(`year: no stored annual row covers ${env.asOf}`);
    return { from: env.asOf, to: env.asOf, yearLagna: null, yearLord: null, shortClock: null, noCoverage: true };
  }
  const key = `annual:VP${m.row.year}.D1`;
  const mudda = m.row.dashas.find((d) => d.system === 'mudda')!;
  const from = mudda.periods.map((p) => p.from).sort()[0]!;
  const to = mudda.periods.map((p) => p.to).sort().at(-1)!;
  if (!m.row.lagna) env.g.add(`year: ${key}.lagna missing`);
  if (!m.row.yearLord) env.g.add(`year: ${key}.yearLord missing`);
  return {
    from,
    to,
    yearLagna: m.row.lagna ? `${key}#lagna` : null,
    yearLord: m.row.yearLord ? `${key}#yearLord` : null,
    shortClock: { level: 1, lord: m.lord, from: m.from, to: m.to, evidence: `${key}#mudda` },
    noCoverage: false,
  };
}
