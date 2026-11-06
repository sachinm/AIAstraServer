/**
 * Reading the engine's own labels into a side of the scale (docs/reading-engine/34 §2). Every input is a label the
 * engine wrote on a digest card (dignity, functional nature, natural nature, house class); nothing here derives a
 * sign, a lord, an aspect or a dignity.
 */
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

/** A planet's side for an area: its functional nature first, then its dignity, then combustion. */
export function planetSide(card: PlanetCard | null | undefined): Side {
  if (!card) return 'neutral';
  const f = functionalSide(card.functional);
  if (f !== 'neutral') return f;
  const d = dignitySide(card.dignity);
  if (d !== 'neutral') return d;
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
