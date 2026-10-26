/**
 * S3 Tithi Ashtottari (docs/reading-engine/27 §A.3): the lord rule on Radha's `dasha.tithi_ashtottari` periods. Whether
 * it counts at full or half weight (`dasha.applicable` lists Ashtottari or not) is decided in convergence.
 */
import { TIMELINE_DEFAULTS, type ActivationRules } from '../config.js';
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export function activateTithiAshtottari(f: Foundation, stack: DashaStack, rules: ActivationRules = TIMELINE_DEFAULTS.rules): Activation[] {
  return activateGrahaDasha(f, stack, 'tithi_ashtottari', 'S3', rules);
}
