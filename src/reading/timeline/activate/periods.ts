/**
 * Turn one graha dasha system's period rows into activations (S1, S2, S3 share it). Every activation spans its
 * period's dates and cites the period row plus the dossier fields the lord rule read.
 */
import type { ActivationRules } from '../config.js';
import type { Foundation } from '../foundation.js';
import type { DashaStack, DashaSystem } from '../dashas.js';
import type { Activation, SystemId } from '../types.js';
import { grahaActivations, type GrahaContext } from './graha.js';

const LEVEL_NAMES = { 1: 'md', 2: 'ad', 3: 'pd' } as const;

export function activateGrahaDasha(f: Foundation, stack: DashaStack, dasha: DashaSystem, system: SystemId, rules: ActivationRules, opts: Pick<GrahaContext, 'adverseRulers'> = {}): Activation[] {
  const rows = stack.rows.filter((r) => r.system === dasha && r.lord);
  const hasAd = rows.some((r) => r.level === 2);
  const out: Activation[] = [];
  for (const r of rows) {
    if (r.level === 1 && hasAd && !rules.mdCounts) continue;
    const hits = grahaActivations(f, r.lord!, { level: r.level, parentLord: r.parentLord, hasFinerLevel: r.level === 1 && hasAd, secondaryHouseStrength: rules.secondaryHouseStrength, ...opts });
    for (const h of hits) {
      out.push({ system, marker: h.marker, planet: r.lord!, strength: h.strength, polarity: h.polarity, from: r.from, to: r.to, level: LEVEL_NAMES[r.level], evidence: [r.evidence, ...h.evidence] });
    }
  }
  return out;
}
