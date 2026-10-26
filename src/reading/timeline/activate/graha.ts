/**
 * The graha period-lord rule shared by S1 Vimshottari, S2 Yogini and S3 Tithi Ashtottari (docs/reading-engine/29 §3.2).
 * A running lord activates only the markers it *signifies* (the capped table of signification.ts), at its signification
 * value 1-3; adversely for the markers in its `adv` row.
 *
 * Modifiers on the support side: -1 when the lord sits in 6/8/12 from its parent lord (AD from MD, PD from AD); +0.5 when
 * its star lord signifies the same marker at 2 or more (the KP rule as a tie-breaker, doc 29 §2 row 8).
 */
import type { PlanetCode } from '../../facts/constants.js';
import { DUSTHANAS, houseFrom, type Foundation } from '../foundation.js';
import { MARKER_IDS, type MarkerId } from '../markers.js';
import { sigOf, type Signification } from '../signification.js';
import type { Polarity } from '../types.js';

export interface GrahaHit {
  marker: MarkerId;
  strength: number;
  polarity: Polarity;
  evidence: string[];
}

export interface GrahaContext {
  /** The enclosing period's lord (AD -> MD, PD -> AD) */
  parentLord: PlanetCode | null;
}

const isDusthana = (h: number): boolean => (DUSTHANAS as readonly number[]).includes(h);

/** Activations of every marker by one period lord. Empty when the lord is not in the dossier or signifies nothing. */
export function grahaActivations(f: Foundation, s: Signification, lord: PlanetCode, ctx: GrahaContext): GrahaHit[] {
  const p = f.planets[lord];
  if (!p) return [];
  const parent = ctx.parentLord ? f.planets[ctx.parentLord] : undefined;
  const fromParent = parent ? houseFrom(parent.house, p.house) : null;
  const drop = fromParent != null && isDusthana(fromParent) ? 1 : 0;
  const out: GrahaHit[] = [];
  for (const m of MARKER_IDS) {
    const sup = s.sig[lord]?.[m];
    if (sup) {
      const kp = p.starLord && p.starLord !== lord && sigOf(s.sig, p.starLord, m) >= 2 ? 0.5 : 0;
      const strength = sup.value - drop + kp;
      if (strength > 0) {
        out.push({
          marker: m,
          strength,
          polarity: 1,
          evidence: [...sup.evidence, ...(drop ? [`bodies.${ctx.parentLord}.house`, `bodies.${lord}.house`] : []), ...(kp ? [`bodies.${lord}.star_lord`] : [])],
        });
      }
    }
    const adv = s.adv[lord]?.[m];
    if (adv) out.push({ marker: m, strength: adv.value, polarity: -1, evidence: [...adv.evidence] });
  }
  return out;
}
