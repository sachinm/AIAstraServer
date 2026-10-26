/**
 * S7 Jaimini modifier (docs/reading-engine/29 §2 row 10): ±0.5 on a marker when a running lord that already signifies it
 * (signification.ts, 2+) sits on, rasi-aspects or holds argala on the marker's arudha or special lagna (+), or obstructs
 * that argala (−). Doc 27 counted this for every running lord; Radha's argala lists many obstructors (G1: house 1 has
 * seven), so ungated it fired in every month.
 *
 * Read fields: the point's house (`arudhas.<k>.house`, `special_lagnas.<k>.house`), the lord's house and rasi aspects
 * (`bodies.<P>.house`, `bodies.<P>.aspects_to.rasi`), and the argala on the house holding the point
 * (`houses.<h>.argala.primary|secondary|obstructed_by`).
 */
import type { PlanetCode } from '../../facts/constants.js';
import { houseOfSign, pointOf, type Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import { MARKERS, MARKER_IDS } from '../markers.js';
import { sigOf, type Signification } from '../signification.js';
import type { Activation } from '../types.js';

export function activateJaimini(f: Foundation, s: Signification, stack: DashaStack): Activation[] {
  const out: Activation[] = [];
  for (const r of stack.rows) {
    if (r.level !== 2) continue;
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
      if (sigOf(s.sig, lord, id) < 2) continue;
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
        out.push({ system: 'S7', marker: id, planet: lord, strength: 0.5, polarity, from: r.from, to: r.to, level: 'modifier', evidence: [...ev, `${pt.path}.house`, why] });
      }
    }
  }
  return out;
}
