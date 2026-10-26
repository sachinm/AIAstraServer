/**
 * S2 Yogini (docs/reading-engine/29 §2 row 7): a confirmer. The AD yogini's planet (Radha names it) by signification;
 * convergence counts it only in a month where Vimshottari or Narayana already signify the marker.
 */
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Signification } from '../signification.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export function activateYogini(f: Foundation, s: Signification, stack: DashaStack): Activation[] {
  return activateGrahaDasha(f, s, stack, 'yogini', 'S2', [2]);
}
