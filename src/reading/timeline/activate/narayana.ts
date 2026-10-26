/**
 * S4 Narayana (docs/reading-engine/27 §A.3): the running *sign* is activated as a house from the lagna, plus the houses
 * of its lord and the planets in it; arudhas and special lagnas in that sign are activated at strength 2. Read from the
 * running sign's house from the AL as well: the 7th from the AL activates relationships, the 2nd/11th money.
 *
 * Rules on read fields: the sign's house is `houses.<h>.sign`, its lord `houses.<h>.lord`, its planets
 * `houses.<h>.occupants`, arudhas `arudhas.<k>.sign`. Strength: 2 for the sign's house when it is the marker's primary
 * house (`rules.secondaryHouseStrength` for its other frame houses), an arudha in it, the AL relation or a karaka in it; 1 through the sign lord's houses or an occupant's houses. A sign that is a dusthana from
 * the lagna makes the activation adverse. The MD sign runs one lower when an AD sign runs under it.
 */
import type { PlanetCode } from '../../facts/constants.js';
import { TIMELINE_DEFAULTS, type ActivationRules } from '../config.js';
import { DUSTHANAS, houseFrom, houseOfSign, pointOf, type Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import { MARKERS, MARKER_IDS } from '../markers.js';
import type { Activation } from '../types.js';

const PLANETS = new Set(['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']);

export function activateNarayana(f: Foundation, stack: DashaStack, rules: ActivationRules = TIMELINE_DEFAULTS.rules): Activation[] {
  const rows = stack.rows.filter((r) => r.system === 'narayana' && r.sign != null);
  const hasAd = rows.some((r) => r.level === 2);
  const al = f.arudhas.AL;
  const out: Activation[] = [];
  for (const r of rows) {
    if (r.level === 1 && hasAd && !rules.mdCounts) continue;
    const h = houseOfSign(f, r.sign!);
    if (h == null) continue;
    const card = f.houses[h]!;
    const lord = card.lord;
    const lp = f.planets[lord];
    const occupants = card.occupants.filter((o) => PLANETS.has(o)) as PlanetCode[];
    const drop = r.level === 1 && hasAd ? 1 : 0;
    const adverse = (DUSTHANAS as readonly number[]).includes(h);
    const fromAl = al ? houseFrom(al.house, h) : null;

    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      let strength = 0;
      const ev: string[] = [];
      const bump = (s: number, ...paths: string[]): void => {
        strength = Math.max(strength, s);
        ev.push(...paths);
      };
      if (m.houses.includes(h)) bump(h === m.houses[0] ? 2 : rules.secondaryHouseStrength, `houses.${h}.sign`);
      if (lp && (lp.owns.some((x) => m.houses.includes(x)) || m.houses.includes(lp.house))) bump(1, `houses.${h}.lord`, `bodies.${lord}.house`);
      for (const o of occupants) {
        const op = f.planets[o];
        if (m.karakas.includes(o) || m.charaKarakas.some((k) => f.chara[k] === o)) bump(2, `houses.${h}.occupants`, m.karakas.includes(o) ? `karakas.natural.${o}` : 'karakas.chara');
        else if (op?.owns.some((x) => m.houses.includes(x))) bump(1, `houses.${h}.occupants`, `bodies.${o}.house`);
      }
      for (const key of [...m.arudhas, ...m.specialLagnas]) {
        const pt = pointOf(f, key);
        if (pt && pt.point.sign === r.sign) bump(2, `${pt.path}.sign`);
      }
      if (fromAl === 7 && id === 'love_marriage') bump(2, 'arudhas.AL.house', `houses.${h}.sign`);
      if ((fromAl === 2 || fromAl === 11) && id === 'money') bump(2, 'arudhas.AL.house', `houses.${h}.sign`);
      const s = strength - drop;
      if (s <= 0) continue;
      out.push({
        system: 'S4',
        marker: id,
        planet: lord,
        sign: r.sign!,
        strength: s,
        polarity: adverse ? -1 : 1,
        from: r.from,
        to: r.to,
        level: r.level === 1 ? 'md' : 'ad',
        evidence: [r.evidence, ...new Set(ev)],
      });
    }
  }
  return out;
}
