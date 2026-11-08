/**
 * `self.reading.mind` — Your mind (docs/reading-engine/58 §4.1). Reads the Moon (manas), Mercury (buddhi in speech and
 * reasoning) and Jupiter (judgement) D1 and D9 cards, the D1 4th (chitta, peace) and 5th (intelligence) house cards, and
 * cancellation rows on the Moon. Every claim is a natal fact.
 */
import { dignityWords, faculties, HOUSE_SELF, HOUSE_SHORT, PLANET_FACULTY } from '../words.js';
import { gaps, houseFrame, planetChain } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, cardDetail, hasCancellation, pname, type PanelInput } from './common.js';

export function mindPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const mo = planetChain(view, 'Mo', g);
  if (mo) {
    const dw = dignityWords(mo.d1.dignity);
    const lifted = /debil/i.test(mo.d1.dignity ?? '') && hasCancellation(view, 'Mo');
    claims.push({
      id: 'mind.moon_place',
      text: `Your feelings are tied to ${HOUSE_SELF[mo.d1.house!]}.${dw ? ` By birth they run ${dw === 'at its weakest' ? 'at their most fragile' : dw === 'at its strongest' ? 'at their strongest' : 'steady'}${lifted ? ', and a cancellation in your chart lifts this over time' : ''}.` : ''}`,
      detail: `Moon: ${cardDetail(mo.d1)}${mo.d9 ? `; D9 ${mo.d9.sign} h${mo.d9.house} ${mo.d9.dignity ?? ''}` : ''}${lifted ? '; neecha bhanga row present' : ''}`,
      certainty: 'fact',
      evidence: mo.evidence,
    });
    const conj = mo.d1.conjunctions ?? [];
    const by = mo.d1.aspectedBy ?? [];
    if (conj.length || by.length) {
      claims.push({
        id: 'mind.moon_company',
        text: [conj.length ? `They share space with ${faculties(conj)}` : '', by.length ? `${conj.length ? ' and are' : 'They are'} watched by ${faculties(by)}` : ''].join('') + '.',
        detail: `Moon conjunct ${conj.map(pname).join(', ') || 'none'}; aspected by ${by.map(pname).join(', ') || 'none'}`,
        certainty: 'fact',
        evidence: ['planet:D1.Mo'],
      });
    }
    if (mo.d1.starLord && PLANET_FACULTY[mo.d1.starLord]) {
      claims.push({
        id: 'mind.moon_star',
        text: `Your birth star is ruled by ${PLANET_FACULTY[mo.d1.starLord]}: that is what steadies your mind.`,
        detail: `Moon star ${mo.d1.star ?? '?'} pada ${mo.d1.pada ?? '?'}, star lord ${pname(mo.d1.starLord)}`,
        certainty: 'fact',
        evidence: ['planet:D1.Mo', 'star:profile'],
      });
    }
  }
  const me = planetChain(view, 'Me', g);
  if (me) {
    const dw = dignityWords(me.d1.dignity);
    claims.push({ id: 'mind.thinking', text: `Your thinking is drawn to ${HOUSE_SELF[me.d1.house!]}${dw ? `, and it is ${dw} there` : ''}.`, detail: `Mercury: ${cardDetail(me.d1)}`, certainty: 'fact', evidence: me.evidence });
  }
  const h3 = houseFrame(view, 'D1', 3, g);
  if (h3?.lordHouse) {
    const occ3 = h3.occupants.map((o) => o.planet);
    claims.push({ id: 'mind.courage', text: `Your courage and effort work through ${HOUSE_SELF[h3.lordHouse]}.${occ3.length ? ` ${cap(faculties(occ3))} lives in them.` : ''}`, detail: `D1 h3 ${h3.sign}, lord ${pname(h3.lord)} in h${h3.lordHouse} (${h3.lordDignity ?? '?'}); occupants ${occ3.map(pname).join(', ') || 'none'}`, certainty: 'fact', evidence: ['house:D1.h3'] });
  }
  const savs = view.houses('D1').map((h) => h.sav).filter((s): s is number => typeof s === 'number');
  const mean = savs.length ? savs.reduce((a, b) => a + b, 0) / savs.length : null;
  const h4 = houseFrame(view, 'D1', 4, g);
  if (h4?.lordHouse) {
    const support = h4.sav != null && mean != null ? (h4.sav > mean ? ' Your chart gives it more support than most of your life.' : h4.sav < mean ? ' Your chart gives it less support than most of your life.' : '') : '';
    claims.push({ id: 'mind.peace', text: `Your peace of mind depends on ${HOUSE_SELF[h4.lordHouse]}.${support}`, detail: `D1 h4 ${h4.sign}, lord ${pname(h4.lord)} in h${h4.lordHouse} (${h4.lordDignity ?? '?'}); SAV ${h4.sav ?? '?'} (chart mean ${mean?.toFixed(1) ?? '?'})`, certainty: 'fact', evidence: ['house:D1.h4'] });
  }
  const h5 = houseFrame(view, 'D1', 5, g);
  if (h5?.lordHouse) {
    const occ = h5.occupants.map((o) => o.planet);
    claims.push({ id: 'mind.intellect', text: `Your intelligence works through ${HOUSE_SELF[h5.lordHouse]}.${occ.length ? ` ${cap(faculties(occ))} lives in it.` : ''}`, detail: `D1 h5 ${h5.sign}, lord ${pname(h5.lord)} in h${h5.lordHouse} (${h5.lordDignity ?? '?'}); occupants ${occ.map(pname).join(', ') || 'none'}; SAV ${h5.sav ?? '?'}`, certainty: 'fact', evidence: ['house:D1.h5'] });
  }
  const lead = mo && me ? `Your feelings are tied to ${HOUSE_SHORT[mo.d1.house!]}, your thinking to ${HOUSE_SHORT[me.d1.house!]}.` : '';
  return body(lead, claims, g);
}
