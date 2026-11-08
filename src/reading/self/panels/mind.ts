/**
 * `self.reading.mind` — Your mind (docs/reading-engine/58 §4.1). Reads the Moon (manas), Mercury (buddhi in speech and
 * reasoning) and Jupiter (judgement) D1 and D9 cards, the D1 4th (chitta, peace) and 5th (intelligence) house cards, and
 * cancellation rows on the Moon, the Moon's own yogas (BG-07) and the A4/A5 padas. Every claim is a natal fact.
 */
import { dignityWords, faculties, HOUSE_SELF, HOUSE_SHORT, PLANET_FACULTY } from '../words.js';
import { gaps, houseFrame, planetChain, pointOf } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, cardDetail, hasCancellation, pname, type PanelInput } from './common.js';

/** Display names for the Moon yoga ids (the Durudhara id is spelled so that it reads as the engine's name in a scan). */
const MOON_YOGA_NAME: Record<string, string> = { sunaphaa_yoga: 'Sunapha', anaphaa_yoga: 'Anapha', duradhara_yoga: 'Durudhara', kemadruma_yoga: 'Kemadruma' };

/** Plain words for the Moon's own yogas, from the yoga ids the engine marks present; Durudhara (both sides) wins over Sunapha and Anapha. */
export function moonYogaClaim(present: readonly string[]): SelfClaim | null {
  const has = (id: string) => present.includes(id);
  const pick = has('duradhara_yoga')
    ? { id: 'duradhara_yoga', text: 'Your mind is held on both sides: it finds support in what you build and in what you let go.' }
    : has('sunaphaa_yoga')
      ? { id: 'sunaphaa_yoga', text: 'Your mind steadies through what you build and earn yourself.' }
      : has('anaphaa_yoga')
        ? { id: 'anaphaa_yoga', text: 'Your mind steadies through poise and letting go, more than through gain.' }
        : has('kemadruma_yoga')
          ? { id: 'kemadruma_yoga', text: 'Your mind can feel on its own; routine and close company steady it.' }
          : null;
  if (!pick) return null;
  const all = ['sunaphaa_yoga', 'anaphaa_yoga', 'duradhara_yoga', 'kemadruma_yoga'].filter(has);
  return { id: 'mind.moon_support', text: pick.text, detail: `Chandra yogas present: ${all.map((y) => MOON_YOGA_NAME[y]).join(', ')}`, certainty: 'fact', evidence: all.map((y) => `yoga:D1.${y}`) };
}

export function mindPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const mo = planetChain(view, 'Mo', g);
  if (mo) {
    const dw = dignityWords(mo.d1.dignity);
    const lifted = /debil/i.test(mo.d1.dignity ?? '') && hasCancellation(view, 'Mo');
    claims.push({
      id: 'mind.moon_place',
      line: `Your feelings are tied to ${HOUSE_SHORT[mo.d1.house!]}${dw === 'at its weakest' ? `; fragile by birth${lifted ? ', lifted over time' : ''}` : ''}.`,
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
    const supportShort = h4.sav != null && mean != null ? (h4.sav > mean ? '; the chart supports it well' : h4.sav < mean ? '; the chart gives it little support' : '') : '';
    claims.push({ id: 'mind.peace', line: `Your peace of mind depends on ${HOUSE_SHORT[h4.lordHouse]}${supportShort}.`, text: `Your peace of mind depends on ${HOUSE_SELF[h4.lordHouse]}.${support}`, detail: `D1 h4 ${h4.sign}, lord ${pname(h4.lord)} in h${h4.lordHouse} (${h4.lordDignity ?? '?'}); SAV ${h4.sav ?? '?'} (chart mean ${mean?.toFixed(1) ?? '?'})`, certainty: 'fact', evidence: ['house:D1.h4'] });
  }
  const h5 = houseFrame(view, 'D1', 5, g);
  if (h5?.lordHouse) {
    const occ = h5.occupants.map((o) => o.planet);
    claims.push({ id: 'mind.intellect', text: `Your intelligence works through ${HOUSE_SELF[h5.lordHouse]}.${occ.length ? ` ${cap(faculties(occ))} lives in it.` : ''}`, detail: `D1 h5 ${h5.sign}, lord ${pname(h5.lord)} in h${h5.lordHouse} (${h5.lordDignity ?? '?'}); occupants ${occ.map(pname).join(', ') || 'none'}; SAV ${h5.sav ?? '?'}`, certainty: 'fact', evidence: ['house:D1.h5'] });
  }
  // BG-07: the Moon's own yogas, as the engine marks them present (Sunapha, Anapha, Durudhara, Kemadruma)
  const cy = moonYogaClaim(view.yogas().map((y) => y.id));
  if (cy) claims.push(cy);
  // BG-07: how home and peace (A4) and ideas (A5) are seen, from the engine's arudha padas
  const a4 = pointOf(view, 'D1', 'A4', g);
  if (a4?.house) claims.push({ id: 'mind.home_seen', text: `Your home and inner peace show to others through ${HOUSE_SELF[a4.house]}.`, detail: `A4 ${a4.sign ?? '?'}, D1 h${a4.house}; its lord ${pname(a4.lord)} in h${a4.lordHouse ?? '?'}`, certainty: 'fact', evidence: ['point:D1.A4'] });
  const a5 = pointOf(view, 'D1', 'A5', g);
  if (a5?.house) claims.push({ id: 'mind.ideas_seen', text: `Your ideas and talents show to others through ${HOUSE_SELF[a5.house]}.`, detail: `A5 ${a5.sign ?? '?'}, D1 h${a5.house}; its lord ${pname(a5.lord)} in h${a5.lordHouse ?? '?'}`, certainty: 'fact', evidence: ['point:D1.A5'] });
  const lead = mo && me ? `Your feelings are tied to ${HOUSE_SHORT[mo.d1.house!]}, your thinking to ${HOUSE_SHORT[me.d1.house!]}.` : '';
  return body(lead, claims, g);
}
