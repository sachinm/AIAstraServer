/**
 * S2 Yogini (docs/reading-engine/27 §A.3): the same lord rule on the yogini's planet (Mangala Mo, Pingala Su, Dhanya Ju,
 * Bhramari Ma, Bhadrika Me, Ulka Sa, Siddha Ve, Sankata Ra; Radha names the planet). Ulka (Saturn) and Sankata (Rahu)
 * periods make the markers their planet rules adverse. The 1.5 weight is applied in convergence.
 */
import type { PlanetCode } from '../../facts/constants.js';
import { TIMELINE_DEFAULTS, type ActivationRules } from '../config.js';
import type { Foundation } from '../foundation.js';
import type { DashaStack } from '../dashas.js';
import type { Activation } from '../types.js';
import { activateGrahaDasha } from './periods.js';

export const YOGINI_ADVERSE: ReadonlySet<PlanetCode> = new Set<PlanetCode>(['Sa', 'Ra']);

export function activateYogini(f: Foundation, stack: DashaStack, rules: ActivationRules = TIMELINE_DEFAULTS.rules): Activation[] {
  return activateGrahaDasha(f, stack, 'yogini', 'S2', rules, { adverseRulers: YOGINI_ADVERSE });
}
