import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Dossier } from '../../src/reading/facts/types.js';
import type { TransitChart } from '../../src/reading/transits/types.js';
import { fixtureInputs, type TimelineInputs } from '../../src/reading/timeline/inputs.js';
import { parseLedger, type LifeEvent } from '../../src/reading/timeline/ledger.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Fixed "today" for every golden-chart test and eval so results are reproducible. */
export const G1_AS_OF = '2026-10-24';

export function loadG1Dossier(): Dossier {
  return JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/facts.v1.json'), 'utf8')) as Dossier;
}

/** G1 as the life timeline reads it: dossier + Radha's dasha and transit_contacts exports under evals/fixtures/G1/catalog */
export function loadG1TimelineInputs(asOf: string = G1_AS_OF): TimelineInputs {
  return fixtureInputs(path.join(root, 'evals/fixtures/G1'), asOf);
}

/** The made-up G1 ledger (evals/fixtures/G1/ledger.made-up.v1.json): invented events for the match/calibration tests */
export function loadG1Ledger(): LifeEvent[] {
  return parseLedger(JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/ledger.made-up.v1.json'), 'utf8'))).events;
}

export function loadG1Transits(): TransitChart {
  return JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/transits.v1.json'), 'utf8')) as TransitChart;
}
