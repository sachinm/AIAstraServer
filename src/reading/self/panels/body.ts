/**
 * `self.reading.body` — Your body (docs/reading-engine/61 §3). What the chart and the reading clock put on the body, as
 * facts with dates; never an illness, organ, symptom, treatment or diagnosis (doc 18: health is facts only). Reads the
 * D1 1st, 6th and 8th house cards; the D1 cards of the lagna lord and the Sun; natural-and-functional malefics on or
 * aspecting the 1st; the reading clock's running main and sub-period lords against houses 1, 6, 8; the D30 1st house
 * (its occupants, else its lord) for the shape of pressure, undated. The stored sky (Saturn, Mars and the nodes over
 * the lagna and the Moon, sade sati) is read when the overlay is stored; until then it is a gap.
 */
import { BODY_NOTE, BODY_SHAPE, dignityWords, HOUSE_SHORT, longDate, PLANET_SHORT } from '../words.js';
import { activationKey, gaps, houseFrame, planetChain, runningChain } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, cardDetail, pname, type PanelInput } from './common.js';

export const BODY_HOUSES = [1, 6, 8];

export function bodyPanel({ view, activation, asOf, clock }: PanelInput, opts: { sensitive?: boolean; skyStored?: boolean } = {}): PanelBody & { note: string } {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h1 = houseFrame(view, 'D1', 1, g);
  const L = planetChain(view, h1?.lord, g);
  if (!h1 || !L) return { ...body('', [], g), note: BODY_NOTE };
  const su = planetChain(view, 'Su', g);
  const lw = dignityWords(L.d1.dignity);
  const sw = su ? dignityWords(su.d1.dignity) : null;
  if (lw) {
    const line = `Your body's footing rests on a ruler that is ${lw} where it sits${sw ? `; your vitality is ${sw}` : ''}.`;
    claims.push({ id: 'body.footing', text: line, detail: `Lagna ${h1.sign}; lagna lord ${cardDetail(L.d1)}${su ? `; Sun ${cardDetail(su.d1)}` : ''}`, certainty: 'fact', evidence: ['house:D1.h1', ...L.evidence, ...(su ? su.evidence.slice(0, 1) : [])], range: 'always' });
  }
  // what the running chapter and sub-chapter put on the body: a running lord sitting in, or activating, 6 or 8
  const run = runningChain(activation, clock.system, asOf);
  if (!opts.sensitive) {
    for (const r of [run.l2, run.l1]) {
      if (!r?.lord) continue;
      const c = view.planet('D1', r.lord);
      const sits = c?.house === 6 || c?.house === 8;
      const acts = r.houses.some((h) => h === 6 || h === 8);
      if (!sits && !acts) continue;
      const what = r.level === 1 ? 'chapter' : 'sub-chapter';
      const where = sits ? `sits where the body ${c!.house === 6 ? 'wears' : 'breaks and renews'}` : 'works on what wears the body';
      claims.push({
        id: 'body.now',
        text: `Until ${longDate(r.to)} the ruler of this ${what} ${where}: a steady pace matters.`,
        detail: `${clock.label} level ${r.level} ${pname(r.lord)} ${r.from} → ${r.to}; ${pname(r.lord)} in D1 h${c?.house ?? '?'}; activates houses ${r.houses.join(', ')}`,
        certainty: 'fact',
        evidence: [activationKey(r), `planet:D1.${r.lord}`],
        range: { from: r.from, to: r.to },
      });
      break;
    }
  }
  const malefic = (p: string) => {
    const c = view.planet('D1', p);
    return !!c && /malefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '');
  };
  const on1 = [...h1.occupants.map((o) => o.planet), ...h1.aspectedGraha].filter((p, i, a) => a.indexOf(p) === i && p !== L.planet && malefic(p));
  if (on1.length && PLANET_SHORT[on1[0]!]) {
    claims.push({
      id: 'body.pressed',
      text: `${cap(on1.map((p) => PLANET_SHORT[p]).filter(Boolean).join(' and '))} ${on1.length > 1 ? 'press' : 'presses'} on the body by birth.`,
      detail: `${on1.map(pname).join(', ')} on or aspecting D1 h1; natural and functional malefic`,
      certainty: 'fact',
      evidence: ['house:D1.h1', ...on1.map((p) => `planet:D1.${p}`)],
      range: 'always',
    });
  }
  const h6 = houseFrame(view, 'D1', 6, g);
  if (h6?.lordHouse) {
    claims.push({ id: 'body.wear', text: `What wears the body comes through ${HOUSE_SHORT[h6.lordHouse]}.`, detail: `D1 h6 ${h6.sign}, lord ${pname(h6.lord)} in h${h6.lordHouse} (${h6.lordDignity ?? '?'}); occupants ${h6.occupants.map((o) => pname(o.planet)).join(', ') || 'none'}`, certainty: 'fact', evidence: ['house:D1.h6'], range: 'always' });
  }
  const d30 = view.house('D30', 1);
  if (!d30) g.add('house:D30.h1 missing');
  else {
    const p = d30.occupants.map((o) => o.planet).find((x) => BODY_SHAPE[x]) ?? (d30.lord && BODY_SHAPE[d30.lord] ? d30.lord : null);
    if (p) claims.push({ id: 'body.shape', text: `Under pressure, the body tends toward ${BODY_SHAPE[p]}.`, detail: `D30 h1 ${d30.sign}; ${d30.occupants.some((o) => o.planet === p) ? 'occupant' : 'lord'} ${pname(p)}; shape from the BODY_WORDS table (for review)`, certainty: 'fact', evidence: ['house:D30.h1'], range: 'always' });
  }
  if (!opts.skyStored) g.add('sky overlay not stored: Saturn, Mars and the nodes over the lagna and the Moon not checked');
  const lead = claims[0]?.text ?? '';
  return { ...body(lead, claims, g), note: BODY_NOTE };
}

