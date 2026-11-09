/**
 * S5 `self.sub.risk` (docs/reading-engine/66 §4.8): what could go wrong, from where, from who, since when, until when,
 * and what holds it. A join of S2 × S3 × S4 and nothing else: every live S3 window that presses becomes a row; its matter
 * and people come from the window's stored houses (`SELF.matters` / `SELF.people`), `what` from `RISK_WHAT` by the
 * window's planet, `from.yogaId` from an S4 knot that names the same planet, and `holds` from the S4 graces that name the
 * same planet or cancel that knot. "Since" and "until" are kept only where the stored window has them.
 */
import { peopleOf, RISK_WHAT } from '../v2words.js';
import type { PeriodFrame, PromiseLedger, RiskLedger, RiskRow, WindowSetDetail } from '../v2types.js';
import { planetKey } from './common.js';
import { isLive } from './config.js';
import type { Gaps } from '../slices.js';

export const RISK_TOP = 3;

export function subRisk(asOf: string, periods: PeriodFrame | null, windows: WindowSetDetail, promise: PromiseLedger, g: Gaps): RiskLedger {
  const rows: RiskRow[] = [];
  const knots = promise.entries.filter((e) => e.kind === 'knot');
  const graces = promise.entries.filter((e) => e.kind === 'grace');
  if (!periods) g.add('risk: no running period frame; rows from the sky overlay only');
  for (const w of windows.rows) {
    if (w.polarity !== 'presses' || !isLive(w.from, w.to, asOf)) continue;
    if (!w.planet) continue;
    const matter = w.matters[0];
    if (!matter) {
      g.add(`risk: ${w.rowId} has no stored houses; no matter`);
      continue;
    }
    const what = RISK_WHAT[w.planet];
    if (!what) {
      g.add(`risk: ${w.rowId} planet ${w.planet} not in RISK_WHAT`);
      continue;
    }
    const pk = planetKey('D1', w.planet);
    const knot = knots.find((k) => k.evidence.includes(pk));
    const holds = graces.filter((x) => x.evidence.includes(pk) || (knot && x.cancels === knot.id)).map((x) => x.id);
    rows.push({
      id: `risk:${w.rowId}`,
      matter,
      what,
      from: { planet: w.planet, ...(w.houses[0] != null ? { house: w.houses[0] } : {}), ...(knot?.source.yogaId ? { yogaId: knot.source.yogaId } : {}), windowId: w.rowId },
      who: peopleOf(w.houses),
      since: w.sinceKnown ? w.from : null,
      until: w.untilKnown ? w.to : null,
      polarity: w.polarity,
      strength: w.strength,
      holds,
      evidence: [...new Set([...w.evidence, pk, ...(knot ? knot.evidence : [])])],
    });
  }
  const top3 = [...rows]
    .sort((a, b) => b.strength - a.strength || (a.until ?? '9999').localeCompare(b.until ?? '9999') || a.id.localeCompare(b.id))
    .slice(0, RISK_TOP)
    .map((r) => r.id);
  return { rows, top3 };
}
