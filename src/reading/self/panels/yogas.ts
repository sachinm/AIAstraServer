/**
 * `self.reading.yogas` — Gifts and knots (docs/reading-engine/58 §4.1). Reads the present D1 yoga and dosha rows that
 * name the lagna lord, the Moon, the Sun or the AK planet, or houses 1, 4, 5, 9. The class label is the engine's.
 * BG-09: within gifts and within knots, rows are ranked by `yogaWeight` (stored delivery multipliers and the running periods).
 */
import { faculties, housesShort, yogaClassWords } from '../words.js';
import { gaps, runningChain, yogasTouching } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, pname, type PanelInput } from './common.js';

export const SELF_YOGA_HOUSES = [1, 4, 5, 9];

export function yogasLead(claims: readonly SelfClaim[]): string {
  const active = claims.filter((c) => !c.withheld);
  if (!active.length) return '';
  const giftsN = active.filter((c) => c.text.startsWith('A gift')).length;
  const knotsN = active.length - giftsN;
  return cap(`${giftsN} ${giftsN === 1 ? 'gift' : 'gifts'} and ${knotsN} ${knotsN === 1 ? 'knot' : 'knots'} in your chart touch your self.`);
}

/**
 * BG-09: a yoga's weight is the mean of its planets' effective delivery multipliers (the engine's avastha
 * `effective`), raised by half when one of its planets runs the main or sub period now. Null when no planet has a stored
 * multiplier. Arithmetic on stored numbers only.
 */
export function yogaWeight(effective: ReadonlyArray<number | null | undefined>, running: boolean): number | null {
  const xs = effective.filter((x): x is number => typeof x === 'number');
  if (!xs.length) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return running ? mean * 1.5 : mean;
}

export function yogasPanel({ view, activation, clock, asOf }: PanelInput): PanelBody {
  const g = gaps();
  const l1 = view.house('D1', 1)?.lord ?? null;
  if (!l1) g.add('house:D1.h1.lord missing');
  const ak = view.points('D1').find((p) => p.id === 'AK')?.planet ?? null;
  const self = [l1, 'Mo', 'Su', ak].filter((p): p is string => !!p);
  // a manglik row belongs to Love unless it touches the 1st house (doc 59 §6.3)
  const rows = yogasTouching(view, self, SELF_YOGA_HOUSES).filter((y) => !/manglik|kuja/i.test(`${y.id} ${y.name}`) || y.houses.includes(1));
  const run = runningChain(activation, clock.system, asOf);
  const runLords = [run.l1?.lord, run.l2?.lord].filter((p): p is string => !!p);
  const claims: SelfClaim[] = rows
    .map((y) => {
      const w = yogaClassWords(y.class);
      const touched = y.planets.filter((p) => self.includes(p));
      const where = touched.length ? faculties(touched) : housesShort(y.houses.filter((h) => SELF_YOGA_HOUSES.includes(h)));
      const runBy = y.planets.filter((p) => runLords.includes(p));
      const weight = yogaWeight(y.planets.map((p) => view.planet('D1', p)?.avasthaMultipliers?.effective), runBy.length > 0);
      return {
        kind: w.kind,
        weight: weight ?? -1,
        claim: {
          id: `yogas.${y.id}`,
          text: `${w.kind === 'gift' ? 'A gift' : 'A knot'}: ${w.words}, touching ${where || 'your self'}.${runBy.length ? ' It is in play now.' : ''}`,
          detail: `${y.name} (${y.class}); planets ${y.planets.map(pname).join(', ') || '—'}; houses ${y.houses.join(', ') || '—'}; source ${y.source}; weight ${weight == null ? 'n/a (no stored delivery multiplier)' : weight.toFixed(2)}${runBy.length ? `; running period lord ${runBy.map(pname).join(', ')}` : ''}`,
          certainty: 'fact' as const,
          evidence: [`yoga:D1.${y.id}`],
        },
      };
    })
    .sort((a, b) => (a.kind === b.kind ? b.weight - a.weight : a.kind === 'gift' ? -1 : 1))
    .map((x) => x.claim);
  const lead = yogasLead(claims);
  return body(lead, claims, g);
}
