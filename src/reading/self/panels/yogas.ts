/**
 * `self.reading.yogas` — Gifts and knots (docs/reading-engine/58 §4.1). Reads the present D1 yoga and dosha rows that
 * name the lagna lord, the Moon, the Sun or the AK planet, or houses 1, 4, 5, 9. The class label is the engine's.
 */
import { faculties, housesShort, yogaClassWords } from '../words.js';
import { gaps, yogasTouching } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, pname, type PanelInput } from './common.js';

export const SELF_YOGA_HOUSES = [1, 4, 5, 9];

export function yogasPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const l1 = view.house('D1', 1)?.lord ?? null;
  if (!l1) g.add('house:D1.h1.lord missing');
  const ak = view.points('D1').find((p) => p.id === 'AK')?.planet ?? null;
  const self = [l1, 'Mo', 'Su', ak].filter((p): p is string => !!p);
  // a manglik row belongs to Love unless it touches the 1st house (doc 59 §6.3)
  const rows = yogasTouching(view, self, SELF_YOGA_HOUSES).filter((y) => !/manglik|kuja/i.test(`${y.id} ${y.name}`) || y.houses.includes(1));
  const claims: SelfClaim[] = rows
    .map((y) => {
      const w = yogaClassWords(y.class);
      const touched = y.planets.filter((p) => self.includes(p));
      const where = touched.length ? faculties(touched) : housesShort(y.houses.filter((h) => SELF_YOGA_HOUSES.includes(h)));
      return {
        kind: w.kind,
        claim: {
          id: `yogas.${y.id}`,
          text: `${w.kind === 'gift' ? 'A gift' : 'A knot'}: ${w.words}, touching ${where || 'your self'}.`,
          detail: `${y.name} (${y.class}); planets ${y.planets.map(pname).join(', ') || '—'}; houses ${y.houses.join(', ') || '—'}; source ${y.source}`,
          certainty: 'fact' as const,
          evidence: [`yoga:D1.${y.id}`],
        },
      };
    })
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'gift' ? -1 : 1))
    .map((x) => x.claim);
  const giftsN = claims.filter((c) => c.text.startsWith('A gift')).length;
  const knotsN = claims.length - giftsN;
  const lead = cap(`${giftsN} ${giftsN === 1 ? 'gift' : 'gifts'} and ${knotsN} ${knotsN === 1 ? 'knot' : 'knots'} in your chart touch your self.`);
  return body(lead, claims, g);
}
