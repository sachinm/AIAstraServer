/**
 * Life-timeline switches and the scoring config (docs/reading-engine/27 §A.4, §B.5, §B.6). Every weight and threshold
 * lives in TIMELINE_DEFAULTS; `TIMELINE_WEIGHTS` (JSON) overrides it, either as a flat system map (`{"S1":2.5}`) or as
 * a partial config (`{"weights":{"S4":2.5},"rules":{"secondaryHouseStrength":2},"bands":{"high":{"systems":3,"score":8}}}`).
 */
import { SYSTEM_IDS, type SystemId } from './types.js';
import type { MarkerId } from './markers.js';

export interface BandRule {
  /** independent systems needed */
  systems: number;
  /** score needed */
  score: number;
}

export interface TimelineWeights {
  systems: Record<SystemId, number>;
  /** Calibrated per marker (doc 27 §A.7); falls back to `systems` */
  byMarker?: Partial<Record<MarkerId, Partial<Record<SystemId, number>>>>;
}

/**
 * Activation rule knobs (doc 27 §A.3). The defaults are doc 27 as written. On G1 they saturate: every running lord of
 * four always-running dashas touches almost every marker, support is >= 8.5 in every month, and every marker is High in
 * all 217 past months, so the grid cannot beat a random baseline. The knobs exist to test tighter readings
 * (`secondaryHouseStrength: 1`, `mdCounts: false`) through TIMELINE_WEIGHTS without a code change; neither alone makes
 * the grid selective (see the P1 report). Changing the default is a method decision for doc 27, not for this code.
 */
export interface ActivationRules {
  /** strength for owning/occupying a frame house other than the primary one (doc 27 literal: 2) */
  secondaryHouseStrength: number;
  /** MD (and Narayana MD sign) lords activate too, one lower under an AD (doc 27 literal: true) */
  mdCounts: boolean;
}

export interface TimelineConfig {
  weights: TimelineWeights;
  rules: ActivationRules;
  /** S3 weight factor when `dasha.applicable` does not list Ashtottari (doc 27 §A.3: half weight) */
  s3NotApplicableFactor: number;
  bands: { high: BandRule; moderate: BandRule; possible: BandRule; testing: BandRule };
  /** S6: the strengths of the transit items of one month add up to at most this */
  s6ItemCap: number;
  /** Systems that modify the score but are not independent (S7 rides on the lords of S1-S4) */
  modifierSystems: SystemId[];
  calibration: { floor: number; ceiling: number };
  /** Months either side of an event: hit within `hit`, near-miss within `near` */
  matchTolerance: { hit: number; near: number };
  years: number;
}

export const TIMELINE_DEFAULTS: TimelineConfig = {
  weights: { systems: { S1: 3.0, S2: 1.5, S3: 1.5, S4: 2.0, S6: 1.5, S7: 1.0 } },
  rules: { secondaryHouseStrength: 2, mdCounts: true },
  s3NotApplicableFactor: 0.5,
  bands: {
    high: { systems: 3, score: 7 },
    moderate: { systems: 2, score: 4.5 },
    possible: { systems: 1, score: 2.5 },
    testing: { systems: 2, score: 4.5 },
  },
  s6ItemCap: 3,
  modifierSystems: ['S7'],
  calibration: { floor: 0.5, ceiling: 1.5 },
  matchTolerance: { hit: 1, near: 3 },
  years: 18,
};

type Env = Record<string, string | undefined>;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** TIMELINE_DEFAULTS with the TIMELINE_WEIGHTS override applied. A malformed override is ignored (logged once). */
export function timelineConfig(env: Env = process.env): TimelineConfig {
  const base: TimelineConfig = structuredClone(TIMELINE_DEFAULTS);
  const raw = env.TIMELINE_WEIGHTS?.trim();
  if (!raw) return base;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    console.warn(JSON.stringify({ msg: 'TIMELINE_WEIGHTS is not JSON; using defaults' }));
    return base;
  }
  if (!o || typeof o !== 'object') return base;
  const obj = o as Record<string, unknown>;
  const flat = SYSTEM_IDS.some((s) => s in obj);
  const weights = (flat ? obj : obj.weights) as Record<string, unknown> | undefined;
  if (weights && typeof weights === 'object') for (const s of SYSTEM_IDS) if (finite(weights[s])) base.weights.systems[s] = weights[s];
  const rules = obj.rules as Partial<ActivationRules> | undefined;
  if (!flat && rules && typeof rules === 'object') {
    if (finite(rules.secondaryHouseStrength)) base.rules.secondaryHouseStrength = rules.secondaryHouseStrength;
    if (typeof rules.mdCounts === 'boolean') base.rules.mdCounts = rules.mdCounts;
  }
  const bands = obj.bands as Record<string, Partial<BandRule>> | undefined;
  if (!flat && bands && typeof bands === 'object') {
    for (const k of ['high', 'moderate', 'possible', 'testing'] as const) {
      const b = bands[k];
      if (b && finite(b.systems)) base.bands[k].systems = b.systems;
      if (b && finite(b.score)) base.bands[k].score = b.score;
    }
  }
  return base;
}

/** TIMELINE_ENABLED=1 turns the module on (default off, doc 27 §B.6) */
export function isTimelineEnabled(env: Env = process.env): boolean {
  const v = env.TIMELINE_ENABLED?.trim().toLowerCase();
  return v === '1' || v === 'true';
}

/** TIMELINE_SYSTEMS (comma list); default every system P1 builds. Unknown ids (S5, S8 …) are ignored. */
export function timelineSystems(env: Env = process.env): SystemId[] {
  const raw = env.TIMELINE_SYSTEMS?.trim();
  if (!raw) return [...SYSTEM_IDS];
  const want = new Set(raw.split(',').map((s) => s.trim().toUpperCase()));
  return SYSTEM_IDS.filter((s) => want.has(s));
}

/** The weight of a system for a marker: calibrated per marker when known, else the system default. */
export function weightOf(w: TimelineWeights, system: SystemId, marker: MarkerId): number {
  return w.byMarker?.[marker]?.[system] ?? w.systems[system];
}
