import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Dossier } from '../../src/reading/facts/types.js';
import type { TransitChart } from '../../src/reading/transits/types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Fixed "today" for every golden-chart test and eval so results are reproducible. */
export const G1_AS_OF = '2026-10-24';

export function loadG1Dossier(): Dossier {
  return JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/facts.v1.json'), 'utf8')) as Dossier;
}

export function loadG1Transits(): TransitChart {
  return JSON.parse(readFileSync(path.join(root, 'evals/fixtures/G1/transits.v1.json'), 'utf8')) as TransitChart;
}
