/**
 * S3 Tithi Ashtottari (docs/reading-engine/29 §2 row 7): a confirmer like Yogini, at half weight when `dasha.applicable`
 * does not list Ashtottari (decided in convergence).
 */
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Signification } from '../signification.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export function activateTithiAshtottari(f: Foundation, s: Signification, stack: DashaStack): Activation[] {
  return activateGrahaDasha(f, s, stack, 'tithi_ashtottari', 'S3', [2]);
}
