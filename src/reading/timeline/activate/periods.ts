/**
 * Turn one graha dasha system's period rows into activations (S1, S2, S3 share it). Every activation spans its period's
 * dates and cites the period row plus the signification entry it read. S1 runs MD, AD and PD; the confirmers S2/S3 run
 * at AD level only (doc 29 §3.2: the period lord is the finest running one).
 */
import type { Foundation } from '../foundation.js';
import type { DashaStack, DashaSystem } from '../dashas.js';
import type { Signification } from '../signification.js';
import type { Activation, SystemId } from '../types.js';
import { grahaActivations } from './graha.js';

const LEVEL_NAMES = { 1: 'md', 2: 'ad', 3: 'pd' } as const;

export function activateGrahaDasha(f: Foundation, s: Signification, stack: DashaStack, dasha: DashaSystem, system: SystemId, levels: ReadonlyArray<1 | 2 | 3>): Activation[] {
  const out: Activation[] = [];
  for (const r of stack.rows) {
    if (r.system !== dasha || !r.lord || !levels.includes(r.level)) continue;
    for (const h of grahaActivations(f, s, r.lord, { parentLord: r.parentLord })) {
      out.push({ system, marker: h.marker, planet: r.lord, strength: h.strength, polarity: h.polarity, from: r.from, to: r.to, level: LEVEL_NAMES[r.level], evidence: [r.evidence, ...h.evidence] });
    }
  }
  return out;
}
