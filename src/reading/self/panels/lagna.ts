/**
 * `self.reading.lagna` — Who you are (docs/reading-engine/58 §4.1). Reads the D1 1st house card, the lagna lord's D1 and
 * D9 cards, the occupants and graha aspects on the 1st split by the engine's functional nature, the cusp star, the AL
 * point and how its house is labelled (BG-06: lagna-to-AL), the Moon lagna (the D1 house the Moon occupies, read as a
 * frame) and the D9 1st house (doc 59 §6.1). The Paka lagna stays out (doc 59 §4.1: it is the lagna lord's house again).
 * Every claim is a natal fact.
 */
import { faculties, HOUSE_SELF, HOUSE_SHORT, PLANET_FACULTY } from '../words.js';
import { gaps, houseFrame, planetChain, pointOf } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, cardDetail, pname, stateWords, type PanelInput } from './common.js';

/** How the image others hold (AL) sits with the self, from the engine's labels on the AL's house: angles and trines line up, dusthanas pull apart. */
export function alSelfFit(cls: readonly string[]): string | null {
  if (cls.includes('dusthana')) return 'How others see you and who you are pull apart; your image takes effort to keep.';
  if (cls.includes('kendra') || cls.includes('trikona')) return 'How others see you lines up with who you are; your image works for you.';
  if (cls.length) return 'How others see you sits a step away from who you are; your image needs tending.';
  return null;
}

export function lagnaPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h1 = houseFrame(view, 'D1', 1, g);
  if (!h1) return body('', [], g);
  const L = planetChain(view, h1.lord, g);
  if (L) {
    const h = L.d1.house!;
    claims.push({
      id: 'lagna.lord_house',
      text: `The part of you that steers your life is lived through ${HOUSE_SELF[h]}.`,
      detail: `Lagna ${h1.sign}; lagna lord ${pname(L.planet)}: ${cardDetail(L.d1)}${L.d9 ? `; D9 ${L.d9.sign} h${L.d9.house} ${L.d9.dignity ?? ''}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h1', ...L.evidence],
    });
    const st = stateWords(L.d1);
    if (st) claims.push({ id: 'lagna.lord_state', text: st, detail: `${pname(L.planet)} avasthas ${JSON.stringify(L.d1.avasthas)}`, certainty: 'fact', evidence: L.evidence.slice(0, 1) });
    if (L.d1.conjunctions?.length) {
      claims.push({
        id: 'lagna.lord_company',
        text: `It shares its place with ${faculties(L.d1.conjunctions)}, and every choice you make carries them.`,
        detail: `${pname(L.planet)} conjunct ${L.d1.conjunctions.map(pname).join(', ')} in ${L.d1.sign}`,
        certainty: 'fact',
        evidence: [L.evidence[0]!, ...L.d1.conjunctions.map((p) => `planet:D1.${p}`)],
      });
    }
  }
  const occ = h1.occupants.map((o) => o.planet);
  const asp = h1.aspectedGraha;
  if (occ.length || asp.length) {
    const first = occ.length ? `${cap(faculties(occ))} ${occ.length > 1 ? 'sit' : 'sits'} right on your sense of self.` : 'Nothing sits on your sense of self directly.';
    const fn = (p: string) => view.planet('D1', p)?.functional ?? '';
    const helps = asp.filter((p) => /benefic/i.test(fn(p)));
    const presses = asp.filter((p) => /malefic/i.test(fn(p)));
    const other = asp.filter((p) => !helps.includes(p) && !presses.includes(p));
    const parts = [helps.length ? `helped by ${faculties(helps)}` : '', presses.length ? `pressed by ${faculties(presses)}` : '', other.length ? `watched by ${faculties(other)}` : ''].filter(Boolean);
    const second = parts.length ? ` It is ${parts.join(', and ')}.` : '';
    claims.push({
      id: 'lagna.on_self',
      text: first + second,
      detail: `D1 h1 occupants: ${occ.map(pname).join(', ') || 'none'}; graha drishti from ${asp.map((p) => `${pname(p)} (${view.planet('D1', p)?.functional ?? '?'})`).join(', ') || 'none'}; rasi drishti from ${h1.aspectedRasi.map(pname).join(', ') || 'none'}; SAV ${h1.sav ?? '?'}`,
      certainty: 'fact',
      evidence: ['house:D1.h1'],
    });
  }
  if (h1.cuspStar?.lord && PLANET_FACULTY[h1.cuspStar.lord]) {
    claims.push({
      id: 'lagna.star',
      text: `The star rising at your birth is ruled by ${PLANET_FACULTY[h1.cuspStar.lord]}: it colours how you meet the world.`,
      detail: `Lagna cusp star ${h1.cuspStar.name}${h1.cuspStar.pada ? ` pada ${h1.cuspStar.pada}` : ''}, star lord ${pname(h1.cuspStar.lord)}`,
      certainty: 'fact',
      evidence: ['house:D1.h1'],
    });
  } else g.add('house:D1.h1.cuspStar missing');
  const al = pointOf(view, 'D1', 'AL', g);
  if (al?.house) {
    claims.push({
      id: 'lagna.seen',
      text: `Others see you through ${HOUSE_SELF[al.house]}.`,
      detail: `Arudha lagna (A1) ${al.sign}, h${al.house}; its lord ${pname(al.lord)} in h${al.lordHouse ?? '?'}`,
      certainty: 'fact',
      evidence: ['point:D1.AL'],
    });
    // BG-06: the lagna-to-AL relation, read only from the engine's class labels for the house the AL falls in
    const alCls = view.house('D1', al.house)?.class ?? [];
    const fit = alSelfFit(alCls);
    if (fit) {
      claims.push({
        id: 'lagna.seen_fit',
        text: fit,
        detail: `AL in D1 h${al.house} from the lagna; that house is ${alCls.join(', ') || 'unlabelled'} by the engine`,
        certainty: 'fact',
        evidence: ['point:D1.AL', `house:D1.h${al.house}`],
      });
    }
  }
  const mo = view.planet('D1', 'Mo');
  if (mo?.house) {
    const mf = houseFrame(view, 'D1', mo.house, g);
    if (mf?.lordHouse) {
      const with_ = mf.occupants.map((o) => o.planet).filter((p) => p !== 'Mo');
      claims.push({
        id: 'lagna.moon_lagna',
        text: `Read from your feelings rather than your body, your life is steered from ${HOUSE_SELF[mf.lordHouse]}${with_.length ? `, with ${faculties(with_)} close by` : ''}.`,
        detail: `Moon lagna: D1 h${mo.house} ${mf.sign}, its lord ${pname(mf.lord)} in h${mf.lordHouse} (${mf.lordDignity ?? '?'})${mf.coLord ? `, co-lord ${pname(mf.coLord)}` : ''}; occupants ${mf.occupants.map((o) => pname(o.planet)).join(', ')}`,
        certainty: 'fact',
        evidence: ['planet:D1.Mo', `house:D1.h${mo.house}`],
      });
    }
  }
  const d9h1 = houseFrame(view, 'D9', 1, g);
  if (d9h1?.lordHouse) {
    claims.push({ id: 'lagna.inner', text: `Your inner self is steered from ${HOUSE_SELF[d9h1.lordHouse]}.`, detail: `D9 lagna ${d9h1.sign}, lord ${pname(d9h1.lord)} in D9 h${d9h1.lordHouse} (${d9h1.lordDignity ?? '?'})`, certainty: 'fact', evidence: ['house:D9.h1'] });
  }
  const lead = L ? `Your sense of self is lived through ${HOUSE_SHORT[L.d1.house!]}.` : '';
  return body(lead, claims, g);
}
