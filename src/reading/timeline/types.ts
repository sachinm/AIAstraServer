/**
 * Shared types of the life-timeline module (docs/reading-engine/27 Part B, scoring per doc 29). Phase P1/P1b: foundation,
 * dasha stack, activation, convergence, ledger match and calibration for the past 18 years, deterministic and model-free.
 */
import type { MarkerId } from './markers.js';

/**
 * Techniques built so far (doc 29 §2). Dasha family: S1 Vimshottari, S2 Yogini and S3 Tithi Ashtottari (confirmers),
 * S4 Narayana. Transit family: S6 slow-planet contacts and S6D double transit (interim, from `transit_contacts` until
 * Radha's range export R-T1). S7 Jaimini argala/aspect is a modifier. S5 (annual) waits for P2.
 */
export const SYSTEM_IDS = ['S1', 'S2', 'S3', 'S4', 'S6', 'S6D', 'S7'] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];

export const SYSTEM_LABELS: Record<SystemId, string> = {
  S1: 'Vimshottari',
  S2: 'Yogini',
  S3: 'Tithi Ashtottari',
  S4: 'Narayana',
  S6: 'Transit contacts',
  S6D: 'Double transit*',
  S7: 'Jaimini modifier',
};

export type Family = 'dasha' | 'transit' | 'modifier';
export const SYSTEM_FAMILY: Record<SystemId, Family> = { S1: 'dasha', S2: 'dasha', S3: 'dasha', S4: 'dasha', S6: 'transit', S6D: 'transit', S7: 'modifier' };

export type Polarity = 1 | -1;

/** One reason a technique activates a marker in a span of time (doc 27 §B.4 stage 5). */
export interface Activation {
  system: SystemId;
  marker: MarkerId;
  /** The activating planet (code). For Narayana the running sign's lord; `sign` then names the sign. */
  planet: string;
  sign?: number;
  /**
   * Dasha: the signification value 1-3 (+0.5 KP star-lord modifier, -1 for 6/8/12 from the parent lord); Narayana: D4;
   * transits: T_c / T_dt; S7: 0.5.
   */
  strength: number;
  /** +1 support, -1 test (adverse for the marker) */
  polarity: Polarity;
  /** ISO dates; `to` exclusive */
  from: string;
  to: string;
  /** md | ad | pd for dashas, contact | double for transits, modifier for S7 */
  level: string;
  /** Dossier / catalogue paths this activation reads (every activation cites its evidence) */
  evidence: string[];
}

export type Band = 'high' | 'moderate' | 'possible' | 'quiet';
