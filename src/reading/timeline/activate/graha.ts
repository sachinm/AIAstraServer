/**
 * The graha period-lord rule shared by S1 Vimshottari, S2 Yogini and S3 Tithi Ashtottari (docs/reading-engine/29 §3.2).
 * A running lord activates only the markers it *signifies* (the capped table of signification.ts), at its signification
 * value 1-3; adversely for the markers in its `adv` row.
 *
 * Modifiers on the support side: -1 when the lord sits in 6/8/12 from its parent lord (AD from MD, PD from AD), read from
 * Radha's `house_counts.house_from_planet` (no table, no drop); +0.5 when its star lord signifies the same marker at 2 or
 * more (the KP rule as a tie-breaker, doc 29 §2 row 8).
 */
import { getRetrogradeScoreWeights } from '../../../config/env.js';
import { evaluateVakraDignityRegime, isTrueVakraCapable } from '../../dasha/retrogradeRules.js';
import type { PlanetCard as DigestPlanetCard } from '../../digest/types.js';
import type { PlanetCode } from '../../facts/constants.js';
import { DUSTHANAS, type Foundation } from '../foundation.js';
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

interface MotionExtras {
  motionState?: string | null;
  isStationary?: boolean;
  cheshtaBala?: number | null;
  d9Sign?: string | number | null;
  d9Dignity?: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Activations of every marker by one period lord. Empty when the lord is not in the dossier or signifies nothing. */
export function grahaActivations(f: Foundation, s: Signification, lord: PlanetCode, ctx: GrahaContext): GrahaHit[] {
  const p = f.planets[lord];
  if (!p) return [];
  const extras = p as typeof p & MotionExtras;
  const weights = getRetrogradeScoreWeights();
  const isD9Debil = /debil|neecha|fall/i.test(String(extras.d9Dignity ?? ''));
  const isVargottama = extras.d9Sign != null && String(extras.d9Sign) === String(p.sign);
  const isNeechaVargottama = Boolean(isVargottama && p.debilitated && isD9Debil);
  const vakra = isTrueVakraCapable(lord)
    ? evaluateVakraDignityRegime({
        planet: lord,
        d1Card: {
          retro: p.retro,
          dignity: p.dignity,
          sign: String(p.sign),
          motionState: extras.motionState ?? null,
          isStationary: extras.isStationary ?? false,
          cheshtaBala: extras.cheshtaBala ?? null,
        } as unknown as DigestPlanetCard,
        d9Card:
          extras.d9Sign != null || extras.d9Dignity != null
            ? ({
                sign: String(extras.d9Sign ?? ''),
                dignity: extras.d9Dignity ?? null,
              } as unknown as DigestPlanetCard)
            : null,
        isMature: true,
        isNeechaVargottama,
      })
    : null;

  let vakraSupDelta = 0;
  if (isNeechaVargottama) {
    vakraSupDelta = -0.25;
  } else if (vakra?.regime === 'vikala_stationary') {
    vakraSupDelta = -0.25;
  } else if (vakra?.regime === 'neecha_vakra') {
    vakraSupDelta = round2(weights.neechaUplift * 0.5);
  } else if (vakra?.regime === 'uccha_vakra') {
    vakraSupDelta = round2(weights.ucchaModeration * 0.5);
  } else if (vakra?.regime === 'anuvakra') {
    vakraSupDelta = 0.2;
  } else if (extras.motionState === 'atichara') {
    vakraSupDelta = -0.2;
  } else if (vakra?.isRetrograde || (typeof extras.cheshtaBala === 'number' && extras.cheshtaBala >= weights.cheshtaStrongVirupas)) {
    vakraSupDelta = 0.15;
  }

  const fromParent = ctx.parentLord ? (f.houseCounts?.house_from_planet[ctx.parentLord]?.[lord] ?? null) : null;
  const drop = fromParent != null && isDusthana(fromParent) ? 1 : 0;
  const retroEv = p.retro && isTrueVakraCapable(lord) ? [`bodies.${lord}.retro`] : [];
  const out: GrahaHit[] = [];
  for (const m of MARKER_IDS) {
    const sup = s.sig[lord]?.[m];
    if (sup) {
      const kp = p.starLord && p.starLord !== lord && sigOf(s.sig, p.starLord, m) >= 2 ? 0.5 : 0;
      const strength = round2(sup.value - drop + kp + vakraSupDelta);
      if (strength > 0) {
        out.push({
          marker: m,
          strength,
          polarity: 1,
          evidence: [
            ...new Set([
              ...sup.evidence,
              ...retroEv,
              ...(drop ? [`house_counts.house_from_planet.${ctx.parentLord}.${lord}`] : []),
              ...(kp ? [`bodies.${lord}.star_lord`] : []),
            ]),
          ],
        });
      }
    }
    const adv = s.adv[lord]?.[m];
    if (adv) {
      const advDelta =
        isNeechaVargottama && p.retro
          ? 0.25
          : vakra?.regime === 'vikala_stationary'
            ? 0.25
            : vakra?.regime === 'neecha_vakra'
              ? -round2(Math.min(0.5, weights.neechaUplift * 0.5))
              : 0;
      out.push({
        marker: m,
        strength: Math.max(0.5, round2(adv.value + advDelta)),
        polarity: -1,
        evidence: [...new Set([...adv.evidence, ...retroEv])],
      });
    }
  }
  return out;
}
