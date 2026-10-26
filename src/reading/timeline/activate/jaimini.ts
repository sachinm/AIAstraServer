/**
 * S7 Jaimini activation (docs/reading-engine/27 §A.3): not a dasha, a modifier on every window. When a lord running in
 * S1-S4 (for Narayana, the running sign's lord) sits on, aspects by rasi drishti or holds argala on a marker's arudha or
 * special lagna, the marker gets +1; an obstructing (virodha) argala from that lord gives -1.
 *
 * Read fields only: the point's house (`arudhas.<k>.house`, `special_lagnas.<k>.house`), the lord's house and rasi
 * aspects (`bodies.<P>.house`, `bodies.<P>.aspects_to.rasi`), and the argala on the house holding the point
 * (`houses.<h>.argala.primary|secondary|obstructed_by`, as Radha lists it). The AL-based transit part of S7 (Jupiter and
 * Saturn in trines/7th from the AL) needs slow-planet positions over decades and waits for Radha's range export (R-T1).
 */
import type { PlanetCode } from '../../facts/constants.js';
import { TIMELINE_DEFAULTS, type ActivationRules } from '../config.js';
import { houseOfSign, pointOf, type Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import { MARKERS, MARKER_IDS } from '../markers.js';
import type { Activation } from '../types.js';

export function activateJaimini(f: Foundation, stack: DashaStack, rules: ActivationRules = TIMELINE_DEFAULTS.rules): Activation[] {
  const out: Activation[] = [];
  for (const r of stack.rows) {
    if (r.level > 2 || (r.level === 1 && !rules.mdCounts)) continue;
    let lord: PlanetCode | null = r.lord;
    const ev = [r.evidence];
    if (r.system === 'narayana' && r.sign != null) {
      const h = houseOfSign(f, r.sign);
      lord = h != null ? f.houses[h]!.lord : null;
      if (h != null) ev.push(`houses.${h}.lord`);
    }
    const p = lord ? f.planets[lord] : undefined;
    if (!lord || !p) continue;
    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      for (const key of [...m.arudhas, ...m.specialLagnas]) {
        const pt = pointOf(f, key);
        if (!pt) continue;
        const card = f.houses[pt.point.house];
        let polarity: 1 | -1 | 0 = 0;
        let why = '';
        if (p.house === pt.point.house) [polarity, why] = [1, `bodies.${lord}.house`];
        else if (p.rasiAspects.includes(pt.point.house)) [polarity, why] = [1, `bodies.${lord}.aspects_to.rasi`];
        else if (card?.argala.primary.includes(lord) || card?.argala.secondary.includes(lord)) [polarity, why] = [1, `houses.${pt.point.house}.argala.primary`];
        else if (card?.argala.obstructedBy.includes(lord)) [polarity, why] = [-1, `houses.${pt.point.house}.argala.obstructed_by`];
        if (!polarity) continue;
        out.push({ system: 'S7', marker: id, planet: lord, strength: 1, polarity, from: r.from, to: r.to, level: 'modifier', evidence: [...ev, `${pt.path}.house`, why] });
      }
    }
  }
  return out;
}
