/** S1 Vimshottari (docs/reading-engine/29 §3.2): MD, AD and (where Radha serves them) PD lords, by signification. */
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Signification } from '../signification.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export function activateVimshottari(f: Foundation, s: Signification, stack: DashaStack): Activation[] {
  return activateGrahaDasha(f, s, stack, 'vimsottari', 'S1', [1, 2, 3]);
}
