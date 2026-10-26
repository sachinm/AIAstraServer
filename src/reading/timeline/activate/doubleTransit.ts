/**
 * S6D double transit, INTERIM (docs/reading-engine/29 §3.3): Jupiter and Saturn both on the matter in the same month.
 *
 * The real rule (both transiting or rasi-aspecting the primary house or its lord's sign) needs the slow planets' sign
 * per month over 36 years, i.e. Radha's range export R-T1. Until it lands this reads `transit_contacts` only, so it
 * sees the narrow case where both are within orb (2°) of natal points: 3 when Jupiter and Saturn are each in contact
 * with a key point of the marker (its primary lord, or a planet signifying it at 2+) in the same month; 2 when one is
 * on a key point and the other on any natal point that signifies the marker at all or sits in a frame house. Rare by
 * construction; the report states it as an approximation.
 */
import type { Foundation } from '../foundation.js';
import { MARKERS, MARKER_IDS, type MarkerId } from '../markers.js';
import { monthEnd, monthsBetween, monthStart } from '../months.js';
import { sigOf, type Signification } from '../signification.js';
import type { Activation } from '../types.js';
import type { SourcedContact } from './transits.js';

function isKey(f: Foundation, s: Signification, natal: string, m: MarkerId): boolean {
  return f.houses[MARKERS[m].houses[0]!]?.lord === natal || sigOf(s.sig, natal, m) >= 2;
}

function isFrame(s: Signification, sc: SourcedContact, m: MarkerId): boolean {
  return sigOf(s.sig, sc.contact.natal, m) >= 1 || MARKERS[m].houses.includes(sc.contact.natal_house);
}

export function activateDoubleTransit(f: Foundation, s: Signification, contacts: readonly SourcedContact[]): Activation[] {
  const byMonth = new Map<string, SourcedContact[]>();
  for (const sc of contacts) {
    if (sc.contact.transit !== 'Ju' && sc.contact.transit !== 'Sa') continue;
    for (const month of monthsBetween(sc.contact.from, sc.contact.to)) byMonth.set(month, [...(byMonth.get(month) ?? []), sc]);
  }
  const out: Activation[] = [];
  for (const [month, list] of [...byMonth].sort(([a], [b]) => a.localeCompare(b))) {
    const ju = list.filter((sc) => sc.contact.transit === 'Ju');
    const sa = list.filter((sc) => sc.contact.transit === 'Sa');
    if (!ju.length || !sa.length) continue;
    for (const m of MARKER_IDS) {
      const juKey = ju.find((sc) => isKey(f, s, sc.contact.natal, m));
      const saKey = sa.find((sc) => isKey(f, s, sc.contact.natal, m));
      let strength = 0;
      let pair: SourcedContact[] = [];
      if (juKey && saKey) [strength, pair] = [3, [juKey, saKey]];
      else if (juKey && sa.some((sc) => isFrame(s, sc, m))) [strength, pair] = [2, [juKey, sa.find((sc) => isFrame(s, sc, m))!]];
      else if (saKey && ju.some((sc) => isFrame(s, sc, m))) [strength, pair] = [2, [saKey, ju.find((sc) => isFrame(s, sc, m))!]];
      if (!strength) continue;
      out.push({ system: 'S6D', marker: m, planet: 'Ju', strength, polarity: 1, from: monthStart(month), to: monthEnd(month), level: 'double', evidence: pair.flatMap((sc) => sc.evidence) });
    }
  }
  return out;
}
