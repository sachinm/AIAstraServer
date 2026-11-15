/**
 * Reading the engine's own labels into a side of the scale (docs/reading-engine/34 §2). Every input is a label the
 * engine wrote on a digest card (dignity, functional nature, natural nature, house class); nothing here derives a
 * sign, a lord, an aspect or a dignity.
 */
import { getRetrogradeScoreWeights } from '../../config/env.js';
import { evaluateVakraDignityRegime, isTrueVakraCapable } from '../dasha/retrogradeRules.js';
import type { HouseCard, PlanetCard } from '../digest/types.js';

export type Side = 'support' | 'test' | 'neutral';

export const PLANET_WORDS: Record<string, string> = { Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu' };
export const planetName = (p: string | null | undefined): string => (p ? (PLANET_WORDS[p] ?? p) : '');

const low = (s: string | null | undefined) => (s ?? '').toLowerCase();

/** exalted, moolatrikona, own → support; debilitated → test; friend / enemy lean; anything else neutral. */
export function dignitySide(dignity: string | null | undefined): Side {
  const d = low(dignity);
  if (!d) return 'neutral';
  if (/debil|neech/.test(d)) return 'test';
  if (/exalt|ucch|moola|mool|own|swa/.test(d)) return 'support';
  if (/enemy|shatru/.test(d)) return 'test';
  if (/friend|mitra/.test(d)) return 'support';
  return 'neutral';
}

/** the engine's functional nature for the chart: benefic / yogakaraka → support, malefic → test */
export function functionalSide(functional: string | null | undefined): Side {
  const f = low(functional);
  if (/yoga ?karaka|benefic/.test(f) && !/malefic/.test(f)) return 'support';
  if (/malefic/.test(f)) return 'test';
  return 'neutral';
}

/** natural nature as the engine labels it */
export function natureSide(nature: string | null | undefined): Side {
  const n = low(nature);
  if (/malefic/.test(n)) return 'test';
  if (/benefic/.test(n)) return 'support';
  return 'neutral';
}

export interface PlanetVakraSide {
  side: Side;
  weightMultiplier: number;
  isNeechaVargottama: boolean;
  motionNote: string | null;
}

/**
 * Evaluates a planet's side and weight multiplier incorporating `evaluateVakraDignityRegime()`,
 * `cheshtaBala`, `motionState`, and strict non-inversion of *Neecha Vargottama* (docs/reading-engine/77).
 */
export function planetSideWithVakra(
  planet: string | null | undefined,
  card: PlanetCard | null | undefined,
  d9Card?: PlanetCard | null | undefined,
  isMature = true,
): PlanetVakraSide {
  if (!card) return { side: 'neutral', weightMultiplier: 1, isNeechaVargottama: false, motionNote: null };
  const weights = getRetrogradeScoreWeights();
  const isD1Debil = /debil|neech/.test(low(card.dignity));
  const isD9Debil = /debil|neech/.test(low(d9Card?.dignity));
  const isVargottama = Boolean(card.sign && d9Card?.sign && card.sign === d9Card.sign);
  const isNeechaVargottama = isVargottama && isD1Debil && isD9Debil;

  const vakra = planet
    ? evaluateVakraDignityRegime({
        planet,
        d1Card: card,
        d9Card,
        isMature,
        isNeechaVargottama,
      })
    : null;

  const f = functionalSide(card.functional);
  let baseSide: Side = 'neutral';
  if (f !== 'neutral') {
    baseSide =
      f === 'support' && card.avasthaMultipliers?.baladi === 0.1 && dignitySide(card.dignity) !== 'support'
        ? 'neutral'
        : f;
  } else {
    const d = dignitySide(card.dignity);
    if (d !== 'neutral') baseSide = d;
    else if (card.sunProximity?.zone === 'cazimi') baseSide = 'support';
    else if (card.combust) baseSide = 'test';
  }

  // Strict invariant: never invert Neecha Vargottama
  if (isNeechaVargottama) {
    return {
      side: 'test',
      weightMultiplier: vakra?.isRetrograde ? 1.2 : 1.1,
      isNeechaVargottama: true,
      motionNote: vakra?.isRetrograde ? 'neecha_vargottama_vakra (unredeemed)' : 'neecha_vargottama',
    };
  }

  if (!vakra || (!vakra.isRetrograde && !vakra.isStationary && !vakra.citations.length)) {
    const motionState = low(card.motionState);
    if (motionState === 'atichara') {
      return { side: baseSide, weightMultiplier: 0.9, isNeechaVargottama: false, motionNote: 'atichara' };
    }
    return { side: baseSide, weightMultiplier: 1, isNeechaVargottama: false, motionNote: null };
  }

  let side = baseSide;
  let weightMultiplier = 1;
  if (vakra.regime === 'vikala_stationary') {
    if (side === 'neutral') side = 'test';
    weightMultiplier = 1.15;
  } else if (vakra.regime === 'neecha_vakra' && vakra.scoreDelta >= weights.neechaUplift) {
    // Non-vargottama debilitated retrograde receives Cheshta uplift (never full inversion to exaltation unless strict UK mode)
    if (side === 'test' && f !== 'test') {
      side = vakra.model === 'uttara_kalamrita_strict' ? 'support' : 'neutral';
    }
    weightMultiplier = 1.1;
  } else if (vakra.regime === 'uccha_vakra') {
    if (vakra.model === 'uttara_kalamrita_strict' && f !== 'support') {
      side = 'neutral';
    }
    weightMultiplier = Math.max(0.8, 1 + weights.ucchaModeration * 0.3);
  } else if (vakra.regime === 'anuvakra') {
    weightMultiplier = 1.12;
  } else if (vakra.isRetrograde || vakra.isCheshtaStrong) {
    weightMultiplier = 1.1;
  }

  const cheshtaTag = typeof vakra.cheshtaBala === 'number' ? `, cheshta=${vakra.cheshtaBala.toFixed(1)}` : '';
  return {
    side,
    weightMultiplier,
    isNeechaVargottama: false,
    motionNote: `${vakra.regime}${vakra.motionState ? `(${vakra.motionState})` : ''}${cheshtaTag}`,
  };
}

/** A planet's side for an area: its functional nature first, then its dignity (with Vakra regime), then combustion (unless cazimi). */
export function planetSide(card: PlanetCard | null | undefined, d9Card?: PlanetCard | null | undefined, planet?: string): Side {
  if (!card) return 'neutral';
  if (planet && isTrueVakraCapable(planet) && (card.retro || card.isStationary)) {
    return planetSideWithVakra(planet, card, d9Card).side;
  }
  const f = functionalSide(card.functional);
  if (f !== 'neutral') {
    if (f === 'support' && card.avasthaMultipliers?.baladi === 0.1 && dignitySide(card.dignity) !== 'support') return 'neutral';
    return f;
  }
  const d = dignitySide(card.dignity);
  if (d !== 'neutral') return d;
  if (card.sunProximity?.zone === 'cazimi') return 'support';
  if (card.combust) return 'test';
  return 'neutral';
}

/** The class labels the engine wrote on a house card: a dusthana tests, a kendra or trikona supports. */
export function houseClassSide(card: HouseCard | null | undefined): Side {
  const cls = (card?.class ?? []).map(low);
  if (cls.some((c) => c.includes('dusthana'))) return 'test';
  if (cls.some((c) => c.includes('kendra') || c.includes('trikona'))) return 'support';
  return 'neutral';
}

export const sideValue = (s: Side): number => (s === 'support' ? 1 : s === 'test' ? 0 : 0.5);

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function addYears(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}
/** inclusive ISO date ranges overlap */
export const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }): boolean => a.from.slice(0, 10) <= b.to.slice(0, 10) && b.from.slice(0, 10) <= a.to.slice(0, 10);
export const covers = (r: { from: string; to: string }, day: string): boolean => r.from.slice(0, 10) <= day && day <= r.to.slice(0, 10);
