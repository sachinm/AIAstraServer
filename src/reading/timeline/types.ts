/**
 * Shared types of the life-timeline module (docs/reading-engine/27, Part B). Phase P1: foundation, dasha stack,
 * activation, convergence, ledger match and calibration for the past 18 years, deterministic and model-free.
 */
import type { MarkerId } from './markers.js';

/**
 * Timing systems of doc 27 §A.3 built in P1. S5 (Tithi Pravesha annual) waits for P2; S6 reads `transit_contacts` only
 * until Radha's range export (R-T1) lands; S7 is the Jaimini modifier on the lords S1-S4 run.
 */
export const SYSTEM_IDS = ['S1', 'S2', 'S3', 'S4', 'S6', 'S7'] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];

export const SYSTEM_LABELS: Record<SystemId, string> = {
  S1: 'Vimshottari',
  S2: 'Yogini',
  S3: 'Tithi Ashtottari',
  S4: 'Narayana',
  S6: 'Transit contacts',
  S7: 'Jaimini arudha/argala',
};

export type Polarity = 1 | -1;

/** One reason a system activates a marker in a span of time (doc 27 §B.4 stage 5). */
export interface Activation {
  system: SystemId;
  marker: MarkerId;
  /** The activating planet (code). For Narayana the running sign's lord; `sign` then names the sign. */
  planet: string;
  sign?: number;
  /** 1-3 (fractional for transit contacts and the SAV modifier) */
  strength: number;
  /** +1 support, -1 test (adverse for the marker) */
  polarity: Polarity;
  /** ISO dates; `to` exclusive */
  from: string;
  to: string;
  /** md | ad | pd for dashas, contact for transits, modifier for S7 */
  level: string;
  /** Transit contacts: one id per contact; the strengths of different items add up (doc 27 §A.4 "per transit item") */
  item?: string;
  /** Dossier / catalogue paths this activation reads (doc 27 §B.9: every activation cites its evidence) */
  evidence: string[];
}

export type Band = 'high' | 'moderate' | 'possible' | 'quiet';
