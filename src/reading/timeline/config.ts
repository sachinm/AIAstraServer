/**
 * Life-timeline switches and the scoring config (docs/reading-engine/29 §2-§5, which replaces doc 27 §A.4/§B.5). Every
 * prior weight, band density and gate constant lives in TIMELINE_DEFAULTS; `TIMELINE_WEIGHTS` (JSON) overrides it,
 * either as a flat system map (`{"S1":2.5}`) or as a partial config
 * (`{"weights":{"S6D":2},"bands":{"high":0.1},"sigCap":4}`).
 */
import { SYSTEM_IDS, type SystemId } from './types.js';
import type { MarkerId } from './markers.js';

export interface TimelineWeights {
  /** Trust prior per technique (doc 29 §2); calibrated per chart */
  systems: Record<SystemId, number>;
  /** Calibrated per marker (doc 29 §5); falls back to `systems` */
  byMarker?: Partial<Record<MarkerId, Partial<Record<SystemId, number>>>>;
}

export interface BandDensities {
  /** share of a marker's months that may be High / Moderate / Possible (doc 29 §4) */
  high: number;
  moderate: number;
  possible: number;
}

export interface TimelineConfig {
  weights: TimelineWeights;
  /** S3 weight factor when `dasha.applicable` does not list Ashtottari */
  s3NotApplicableFactor: number;
  /** A planet signifies at most this many markers (doc 29 §3.1) */
  sigCap: number;
  bands: BandDensities;
  /** Gate E: the month a signifying period starts, and the month after (doc 29 §3.4) */
  edge: { start: number; next: number };
  /** A month with only one of period / trigger scores this share of D or T (doc 29 §3.5) */
  singleGateFactor: number;
  calibration: { floor: number; ceiling: number; /** shrinkage toward the prior: n / (n + k) */ shrinkK: number; densities: number[] };
  /** Months either side of an event: hit within `hit`, near-miss within `near` */
  matchTolerance: { hit: number; near: number };
  years: number;
}

export const TIMELINE_DEFAULTS: TimelineConfig = {
  weights: { systems: { S1: 3.0, S2: 1.0, S3: 1.0, S4: 2.0, S6: 2.0, S6D: 3.0, S7: 1.0 } },
  s3NotApplicableFactor: 0.5,
  sigCap: 3,
  bands: { high: 0.08, moderate: 0.2, possible: 0.35 },
  edge: { start: 1.5, next: 1.25 },
  singleGateFactor: 0.5,
  calibration: { floor: 0.5, ceiling: 1.5, shrinkK: 5, densities: [0.08, 0.2, 0.35] },
  matchTolerance: { hit: 1, near: 3 },
  years: 18,
};

type Env = Record<string, string | undefined>;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const share = (v: unknown): v is number => finite(v) && v > 0 && v <= 1;

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
  if (flat) return base;
  const bands = obj.bands as Record<string, unknown> | undefined;
  if (bands && typeof bands === 'object') for (const k of ['high', 'moderate', 'possible'] as const) if (share(bands[k])) base.bands[k] = bands[k];
  if (finite(obj.sigCap) && obj.sigCap >= 1) base.sigCap = Math.floor(obj.sigCap);
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
  return SYSTEM_IDS.filter((s) => want.has(s.toUpperCase()));
}

/** The weight of a system for a marker: calibrated per marker when known, else the system prior. */
export function weightOf(w: TimelineWeights, system: SystemId, marker: MarkerId): number {
  return w.byMarker?.[marker]?.[system] ?? w.systems[system];
}
