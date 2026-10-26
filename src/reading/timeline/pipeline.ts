/**
 * The past-timeline build, phase P1 of docs/reading-engine/27 (§B.7): foundation -> dasha stack -> activation (S1, S2,
 * S3, S4, S6 from transit_contacts, S7) -> convergence over the past 18 years at the monthly grain -> ledger match ->
 * calibration. Deterministic and model-free: the blind cast never reads the ledger, and the same inputs give the same
 * grid. Gated behind TIMELINE_ENABLED (default off).
 */
import { calibrate, type Calibration } from './calibrate.js';
import { isTimelineEnabled, timelineConfig, timelineSystems, type TimelineConfig, type TimelineWeights } from './config.js';
import { converge, type TimelineGrid } from './converge.js';
import { ashtottariApplies, buildDashaStack, type DashaStack } from './dashas.js';
import { buildFoundation, type Foundation } from './foundation.js';
import { pastRange, type TimelineInputs } from './inputs.js';
import type { LifeEvent } from './ledger.js';
import { matchLedger, type EventMatch, type MatchSummary } from './match.js';
import { addDaysIso, pastMonths } from './months.js';
import { activateJaimini } from './activate/jaimini.js';
import { activateNarayana } from './activate/narayana.js';
import { activateTithiAshtottari } from './activate/tithiAshtottari.js';
import { activateTransitContacts, mergeContacts } from './activate/transits.js';
import { activateVimshottari } from './activate/vimshottari.js';
import { activateYogini } from './activate/yogini.js';
import type { Activation, SystemId } from './types.js';

export class TimelineDisabledError extends Error {
  constructor() {
    super('life timeline is off (set TIMELINE_ENABLED=1)');
  }
}

export interface PastBuild {
  kundliId: string;
  asOf: string;
  range: { from: string; to: string };
  systems: SystemId[];
  config: TimelineConfig;
  weights: TimelineWeights;
  s3Applicable: boolean;
  s3ApplicableEvidence: string | null;
  foundation: Foundation;
  stack: DashaStack;
  activations: Activation[];
  grid: TimelineGrid;
  notes: string[];
}

export interface PastBuildOptions {
  env?: Record<string, string | undefined>;
  /** Score with these weights instead of the config defaults (e.g. a stored calibration) */
  weights?: TimelineWeights;
}

/** The blind cast: the 18-year past grid from the inputs alone (no ledger). */
export function buildPastTimeline(inputs: TimelineInputs, opts: PastBuildOptions = {}): PastBuild {
  const env = opts.env ?? process.env;
  if (!isTimelineEnabled(env)) throw new TimelineDisabledError();
  const config = timelineConfig(env);
  const systems = timelineSystems(env);
  const range = pastRange(inputs.asOf, config.years);
  const foundation = buildFoundation(inputs.dossier);
  const stack = buildDashaStack(inputs.dossier, inputs.items, { from: range.from, to: addDaysIso(range.to, 1) });
  const s3ApplicableEvidence = ashtottariApplies(inputs.items['dasha.applicable']);
  const notes = [...inputs.notes, ...stack.missing.map((s) => `dasha.${s} not available: its system is left out`)];

  const activations: Activation[] = [];
  const on = (s: SystemId): boolean => systems.includes(s);
  const rules = config.rules;
  if (on('S1')) activations.push(...activateVimshottari(foundation, stack, rules));
  if (on('S2')) activations.push(...activateYogini(foundation, stack, rules));
  if (on('S3')) activations.push(...activateTithiAshtottari(foundation, stack, rules));
  if (on('S4')) activations.push(...activateNarayana(foundation, stack, rules));
  if (on('S6')) {
    if (!inputs.contacts.length) notes.push('no transit_contacts: S6 is left out');
    activations.push(...activateTransitContacts(foundation, mergeContacts(inputs.contacts)));
  }
  if (on('S7')) activations.push(...activateJaimini(foundation, { ...stack, rows: stack.rows.filter((r) => (r.system === 'vimsottari' && on('S1')) || (r.system === 'yogini' && on('S2')) || (r.system === 'tithi_ashtottari' && on('S3')) || (r.system === 'narayana' && on('S4'))) }, rules));

  const weights = opts.weights ?? config.weights;
  const s3Applicable = s3ApplicableEvidence != null;
  const grid = converge(activations, pastMonths(inputs.asOf, config.years), { config, weights, s3Applicable, foundation, stack });
  return { kundliId: inputs.kundliId, asOf: inputs.asOf, range, systems, config, weights, s3Applicable, s3ApplicableEvidence, foundation, stack, activations, grid, notes };
}

export interface PastVerification {
  build: PastBuild;
  matches: EventMatch[];
  summary: MatchSummary;
  calibration: Calibration;
}

/** Blind cast, then match the ledger and calibrate (doc 27 §A.7). */
export function verifyPast(inputs: TimelineInputs, events: readonly LifeEvent[], opts: PastBuildOptions = {}): PastVerification {
  const build = buildPastTimeline(inputs, opts);
  const { matches, summary } = matchLedger(build.grid, events, build.config);
  const calibration = calibrate({ grid: build.grid, activations: build.activations, events, systems: build.systems, config: build.config, s3Applicable: build.s3Applicable });
  return { build, matches, summary, calibration };
}
