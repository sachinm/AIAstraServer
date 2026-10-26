/**
 * S4 Narayana as D4 (docs/reading-engine/29 §3.2): Jaimini's own timing, by the running sign.
 *
 * - 3: the sign holds the marker's arudha or special lagna (`arudhas.<k>.sign`, `special_lagnas.<k>.sign`): the period of
 *   the sign holding UL / A10 / A4 brings that matter up.
 * - 2: the sign is the marker's primary house (`houses.<h1>.sign`) or the sign its primary lord sits in.
 * - 1: the sign's lord signifies the marker at 2 or more (signification.ts).
 * - adverse 1: the sign's lord signifies the marker adversely at 2 or more.
 *
 * Read from AL as well (doc 27 §A.3): the 7th sign from the AL running activates love and marriage at 2, the 2nd/11th
 * money at 2. The MD sign counts only where no AD sign runs.
 */
import { houseFrom, houseOfSign, pointOf, type Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import { MARKERS, MARKER_IDS } from '../markers.js';
import { sigOf, type Signification } from '../signification.js';
import type { Activation } from '../types.js';

export function activateNarayana(f: Foundation, s: Signification, stack: DashaStack): Activation[] {
  const rows = stack.rows.filter((r) => r.system === 'narayana' && r.sign != null);
  const hasAd = rows.some((r) => r.level === 2);
  const al = f.arudhas.AL;
  const out: Activation[] = [];
  for (const r of rows) {
    if (r.level === 1 && hasAd) continue;
    const h = houseOfSign(f, r.sign!);
    if (h == null) continue;
    const lord = f.houses[h]!.lord;
    const fromAl = al ? houseFrom(al.house, h) : null;
    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      const h1 = m.houses[0]!;
      let strength = 0;
      let ev: string[] = [];
      const take = (v: number, ...paths: string[]): void => {
        if (v > strength) [strength, ev] = [v, paths];
      };
      for (const key of [...m.arudhas, ...m.specialLagnas]) {
        const pt = pointOf(f, key);
        if (pt && pt.point.sign === r.sign) take(3, `${pt.path}.sign`);
      }
      if (h === h1) take(2, `houses.${h1}.sign`);
      const h1Lord = f.houses[h1]?.lord;
      if (h1Lord && f.planets[h1Lord]?.sign === r.sign) take(2, `houses.${h1}.lord`, `bodies.${h1Lord}.sign`);
      if ((fromAl === 7 && id === 'love_marriage') || ((fromAl === 2 || fromAl === 11) && id === 'money')) take(2, 'arudhas.AL.house', `houses.${h}.sign`);
      if (sigOf(s.sig, lord, id) >= 2) take(1, `houses.${h}.lord`, ...(s.sig[lord]?.[id]?.evidence ?? []));
      const base = { system: 'S4' as const, marker: id, planet: lord, sign: r.sign!, from: r.from, to: r.to, level: r.level === 1 ? 'md' : 'ad' };
      if (strength > 0) out.push({ ...base, strength, polarity: 1, evidence: [r.evidence, ...ev] });
      if (sigOf(s.adv, lord, id) >= 2) out.push({ ...base, strength: 1, polarity: -1, evidence: [r.evidence, `houses.${h}.lord`, ...(s.adv[lord]?.[id]?.evidence ?? [])] });
    }
  }
  return out;
}
