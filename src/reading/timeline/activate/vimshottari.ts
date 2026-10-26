/** S1 Vimshottari (docs/reading-engine/27 §A.3): the graha lord rule on MD, AD and (where Radha serves them) PD lords. */
import { TIMELINE_DEFAULTS, type ActivationRules } from '../config.js';
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export function activateVimshottari(f: Foundation, stack: DashaStack, rules: ActivationRules = TIMELINE_DEFAULTS.rules): Activation[] {
  return activateGrahaDasha(f, stack, 'vimsottari', 'S1', rules);
}
