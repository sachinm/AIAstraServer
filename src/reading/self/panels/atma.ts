/**
 * `self.reading.atma` — Your soul's aim (docs/reading-engine/58 §4.1). Reads the D1 AK point and its planet (the
 * karaka's own planet, `PointRow.planet`), that planet's D1 card, the D9 AK point (its sign is the karakamsa) and the D9
 * planets in that sign, the D9 1st house card, the Sun, Jupiter (judgement and faith) and the D1 9th and 12th house cards (doc 59 §6.2). The AK claims are withheld
 * with a gap when the AK planet is not stored.
 */
import { faculties, HOUSE_SELF, HOUSE_SHORT, joinWords, PLANET_FACULTY, PLANET_SHORT } from '../words.js';
import { gaps, houseFrame, planetChain, pointOf } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cardDetail, pname, stateWords, type PanelInput } from './common.js';

export function atmaPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const akPt = pointOf(view, 'D1', 'AK', g);
  const akPlanet = akPt?.planet ?? null;
  if (akPt && !akPlanet) g.add('point:D1.AK.planet missing (digest built before 2026-11-07)');
  const ak = akPlanet ? planetChain(view, akPlanet, g) : null;
  if (ak && PLANET_FACULTY[ak.planet]) {
    claims.push({
      id: 'atma.ak',
      line: `Your soul's lesson runs through ${PLANET_SHORT[ak.planet]}, lived in ${HOUSE_SHORT[ak.d1.house!]}.`,
      text: `What your soul is here to learn runs through ${PLANET_FACULTY[ak.planet]}, lived in ${HOUSE_SELF[ak.d1.house!]}.`,
      detail: `Atmakaraka ${pname(ak.planet)}: ${cardDetail(ak.d1)}; shadbala rank ${ak.d1.shadbalaRank ?? '?'}`,
      certainty: 'fact',
      evidence: ['point:D1.AK', ...ak.evidence],
    });
    const st = stateWords(ak.d1);
    if (st) claims.push({ id: 'atma.ak_state', text: st, detail: `${pname(ak.planet)} avasthas ${JSON.stringify(ak.d1.avasthas)}`, certainty: 'fact', evidence: ak.evidence.slice(0, 1) });
    const kk = pointOf(view, 'D9', 'AK', g);
    const d9h1 = view.house('D9', 1);
    if (kk?.house && kk.sign) {
      const with_ = view.planets('D9').filter((p) => p.sign === kk.sign && p.planet !== ak.planet).map((p) => p.planet);
      claims.push({
        id: 'atma.karakamsa',
        line: `Inside, what you most want lies in ${HOUSE_SHORT[kk.house]}${with_.length ? `, beside ${joinWords(with_.map((p) => PLANET_SHORT[p]).filter((x): x is string => !!x))}` : ''}.`,
        text: `In the chart of your inner self it sits in ${HOUSE_SELF[kk.house]}${with_.length ? `, alongside ${faculties(with_)}` : ''}.`,
        detail: `Karakamsa ${kk.sign} (D9 AK), h${kk.house} from the D9 lagna ${d9h1?.sign ?? '?'}; D9 planets there: ${with_.map(pname).join(', ') || 'none'}`,
        certainty: 'fact',
        evidence: ['point:D9.AK', ...with_.map((p) => `planet:D9.${p}`)],
      });
    }
  }
  if (akPlanet !== 'Su') {
    const su = planetChain(view, 'Su', g);
    if (su) claims.push({ id: 'atma.sun', text: `Your sense of purpose lives in ${HOUSE_SELF[su.d1.house!]}.`, detail: `Sun: ${cardDetail(su.d1)}`, certainty: 'fact', evidence: su.evidence });
  }
  const ju = planetChain(view, 'Ju', g);
  if (ju) claims.push({ id: 'atma.judgement', text: `Your judgement and faith work through ${HOUSE_SELF[ju.d1.house!]}.`, detail: `Jupiter: ${cardDetail(ju.d1)}`, certainty: 'fact', evidence: ju.evidence });
  const h9 = houseFrame(view, 'D1', 9, g);
  if (h9?.lordHouse) claims.push({ id: 'atma.purpose', text: `Your sense of purpose rests on ${HOUSE_SELF[h9.lordHouse]}.`, detail: `D1 h9 ${h9.sign}, lord ${pname(h9.lord)} in h${h9.lordHouse} (${h9.lordDignity ?? '?'}); occupants ${h9.occupants.map((o) => pname(o.planet)).join(', ') || 'none'}`, certainty: 'fact', evidence: ['house:D1.h9'] });
  const h12 = houseFrame(view, 'D1', 12, g);
  if (h12?.lordHouse) claims.push({ id: 'atma.letting_go', text: `Letting go comes to you through ${HOUSE_SELF[h12.lordHouse]}.`, detail: `D1 h12 ${h12.sign}, lord ${pname(h12.lord)} in h${h12.lordHouse} (${h12.lordDignity ?? '?'}); occupants ${h12.occupants.map((o) => pname(o.planet)).join(', ') || 'none'}`, certainty: 'fact', evidence: ['house:D1.h12'] });
  const lead = ak && PLANET_FACULTY[ak.planet] ? `Your soul's lesson runs through ${PLANET_FACULTY[ak.planet]}.` : '';
  return body(lead, claims, g);
}
