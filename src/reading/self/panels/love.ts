/**
 * The Love reading panels (`love.reading.*`, docs/reading-engine/59 §3):
 *   - `love.reading.heart`     — How you love (Venus, Moon, 5th lord, D9 7th, UL, A7)
 *   - `love.reading.partner`   — The partner you draw (7th, L7, DK, UL, A7, D9 7th, SAV)
 *   - `love.reading.bond`      — The bond itself (7th, 2nd, 4th, 8th, UL, D9, D7, Argala)
 *   - `love.reading.circle`    — Who else is in it (2nd family, 4th home/mother, 11th friends, 5th children/legacy, D7, MK, PK)
 *   - `love.reading.chapters`  — Your chapters for love (multi-clock spine filtered to Love houses & karakas)
 *   - `love.reading.struggle`  — What tests it (L7, Ve, DK, Mo, UL, Kalathra/Manglik rows, dated release from reading clock)
 *   - `love.reading.year`      — This year in love (TP & VP D1 on H7, H5, Ve, L7, Vivaha/Preethi sahams, Mudda short clock)
 *   - `love.reading.diagnosis` — Your love life, in short (3-part synthesis of direction, knot/tension, and running chapter)
 *
 * Pure selection over stored `DigestView` and `ActivationRow[]` rows: zero astrological derivation in Node,
 * zero chart jargon in `text`/`line`/`lead`, and every `evidence` key guaranteed to resolve in `collectData`.
 */
import type { ActivationRow } from '../../digest/activation.js';
import type { PlanetCard } from '../../digest/types.js';
import {
  clockLabel,
  dignityWords,
  faculties,
  FRUITION_WORDS,
  HOUSE_SELF,
  HOUSE_SHORT,
  housesShort,
  housesWord,
  longDate,
  monthYear,
  PLANET_FACULTY,
  PLANET_SHORT,
  RIPENESS_SHORT,
  RIPENESS_WORDS,
  yogaClassWords,
} from '../words.js';
import { activationKey, allRunningDashas, gaps, houseFrame, mdSpine, planetChain, pointOf, runningChain, yogasTouching } from '../slices.js';
import type { BoardPanelId, ChapterConfirmation, PanelBody, SelfChapter, SelfClaim } from '../types.js';
import { body, cardDetail, hasCancellation, pname, stateWords, type PanelInput } from './common.js';
import { certaintyOf, confirmShift } from './chapters.js';
import { activeTpAshtottariPeriod, runningMudda, runningTp } from './year.js';
import { struggleLead } from './struggle.js';

export const LOVE_HOUSES: readonly number[] = [7, 5, 11, 2, 8, 4, 12];
const HEAVY_RIPENESS = new Set(['unripe_sour', 'dried_seed_externalized']);
const MAX_STRUGGLE_CLAIMS = 6;
const lower = (s: string): string => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

export function heartPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const ve = planetChain(view, 'Ve', g);
  const mo = planetChain(view, 'Mo', g);
  const h5 = houseFrame(view, 'D1', 5, g);
  const h7 = houseFrame(view, 'D1', 7, g);
  const l5 = planetChain(view, h5?.lord ?? null, g);
  const d9h5 = houseFrame(view, 'D9', 5, g);
  const d9h7 = houseFrame(view, 'D9', 7, g);
  const ul = pointOf(view, 'D1', 'UL', g);
  const a7 = pointOf(view, 'D1', 'A7', g);

  let lead = '';
  if (ve && ve.d1.house != null) {
    const sw = stateWords(ve.d1);
    lead = `In love, your heart moves through ${HOUSE_SHORT[ve.d1.house]}.`;
    claims.push({
      id: 'heart.venus_place',
      line: `In closeness, your heart leans toward ${HOUSE_SHORT[ve.d1.house]}.`,
      text: `How you give and receive affection runs through ${HOUSE_SELF[ve.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `Venus ${cardDetail(ve.d1)}${ve.d9 ? `; D9 ${ve.d9.sign ?? '?'} h${ve.d9.house ?? '?'} (${ve.d9.dignity ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: ve.evidence,
    });
  }

  if (h5 && l5 && l5.d1.house != null) {
    const sw = stateWords(l5.d1);
    const occ = h5.occupants.map((o) => o.planet);
    const occWords = occ.length ? ` Alongside that, ${faculties(occ)} shape how you court and play.` : '';
    claims.push({
      id: 'heart.romance',
      line: `Romance and openness grow through ${HOUSE_SHORT[l5.d1.house]}.`,
      text: `Romance, play and emotional openness are steered from ${HOUSE_SELF[l5.d1.house]}.${sw ? ` ${sw}` : ''}${occWords}`,
      detail: `D1 h5 ${h5.sign ?? '?'}, lord ${pname(h5.lord)} in h${l5.d1.house} (${l5.d1.dignity ?? '?'}); occupants: ${occ.map(pname).join(', ') || 'none'}`,
      certainty: 'fact',
      evidence: ['house:D1.h5', ...l5.evidence],
    });
  }

  if (mo && mo.d1.house != null) {
    const dw = dignityWords(mo.d1.dignity);
    const lifted = dw === 'at its weakest' && hasCancellation(view, 'Mo');
    claims.push({
      id: 'heart.feelings',
      line: `Your feelings in love rest on ${HOUSE_SHORT[mo.d1.house]}.`,
      text: `Your emotional safety in closeness rests on ${HOUSE_SELF[mo.d1.house]}${dw ? `, where your feelings are ${dw}${lifted ? ' and lifted over time' : ''}` : ''}.`,
      detail: `Moon ${cardDetail(mo.d1)}`,
      certainty: 'fact',
      evidence: mo.evidence,
    });
  }

  if ((d9h7 && d9h7.lordHouse != null) || (d9h5 && d9h5.lordHouse != null)) {
    const innerH = d9h7?.lordHouse ?? d9h5?.lordHouse ?? 7;
    const d9Ve = ve?.d9;
    const veNote = d9Ve?.house != null ? `, while your inner capacity for closeness sits in ${HOUSE_SHORT[d9Ve.house]}` : '';
    const d9h5Note = d9h5?.lordHouse != null && d9h5.lordHouse !== innerH ? ` and inner romance moves through ${HOUSE_SHORT[d9h5.lordHouse]}` : '';
    claims.push({
      id: 'heart.inner_bond',
      line: `Beneath the surface, closeness asks for ${HOUSE_SHORT[innerH]}.`,
      text: `Beneath the surface, the inner shape of partnership is steered from ${HOUSE_SELF[innerH]}${veNote}${d9h5Note}.`,
      detail: `D9 h7 ${d9h7?.sign ?? '?'}, lord ${pname(d9h7?.lord)} in D9 h${d9h7?.lordHouse ?? '?'} (${d9h7?.lordDignity ?? '?'}); D9 h5 ${d9h5?.sign ?? '?'}, lord ${pname(d9h5?.lord)} in D9 h${d9h5?.lordHouse ?? '?'}${d9Ve ? `; D9 Venus in h${d9Ve.house ?? '?'} ${d9Ve.sign ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: [
        ...(d9h7 ? ['house:D9.h7'] : []),
        ...(d9h5 ? ['house:D9.h5'] : []),
        ...(d9Ve ? ['planet:D9.Ve'] : []),
      ],
    });
  }

  if (a7?.house != null || ul?.house != null) {
    const h = a7?.house ?? ul?.house ?? 7;
    const ev: string[] = [];
    if (a7) ev.push('point:D1.A7');
    if (ul) ev.push('point:D1.UL');
    if (h7) ev.push('house:D1.h7');
    claims.push({
      id: 'heart.arudha_pull',
      line: `Attraction enters your life through ${HOUSE_SHORT[h]}.`,
      text: `In the outer world, attraction and romantic chemistry meet you through ${HOUSE_SELF[h]}${ul?.house != null && ul.house !== h ? `, while lasting commitment forms through ${HOUSE_SHORT[ul.house]}` : ''}.`,
      detail: `Darapada A7 in h${a7?.house ?? '?'} ${a7?.sign ?? '?'} (lord ${pname(a7?.lord)}); Upapada UL in h${ul?.house ?? '?'} ${ul?.sign ?? '?'} (lord ${pname(ul?.lord)})`,
      certainty: 'fact',
      evidence: ev,
    });
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function partnerPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h7 = houseFrame(view, 'D1', 7, g);
  const l7 = planetChain(view, h7?.lord ?? null, g);
  const dk = pointOf(view, 'D1', 'DK', g);
  const dkChain = planetChain(view, dk?.planet ?? null, g);
  const ve = planetChain(view, 'Ve', g);
  const ju = planetChain(view, 'Ju', g);
  const d9h7 = houseFrame(view, 'D9', 7, g);
  const d9L7 = d9h7?.lord ? view.planet('D9', d9h7.lord) : null;
  const ul = pointOf(view, 'D1', 'UL', g);
  const a7 = pointOf(view, 'D1', 'A7', g);

  let lead = '';
  if (l7 && l7.d1.house != null) {
    const sw = stateWords(l7.d1);
    lead = `The partner you draw is shaped by ${HOUSE_SHORT[l7.d1.house]}.`;
    claims.push({
      id: 'partner.seventh_lord',
      line: `The partner you draw is shaped by ${HOUSE_SHORT[l7.d1.house]}.`,
      text: `Who you meet as an equal partner is steered from ${HOUSE_SELF[l7.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h7 ${h7?.sign ?? '?'} lord ${cardDetail(l7.d1)}${l7.d9 ? `; D9 ${l7.d9.sign ?? '?'} h${l7.d9.house ?? '?'}` : ''}${d9L7 ? `; D9 h7 lord ${pname(d9h7?.lord)} in D9 h${d9L7.house ?? '?'} ${d9L7.sign ?? '?'} (${d9L7.dignity ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: [
        'house:D1.h7',
        ...l7.evidence,
        ...(d9h7 ? ['house:D9.h7'] : []),
        ...(d9L7 && d9h7?.lord ? [`planet:D9.${d9h7.lord}`] : []),
      ],
    });
  }

  if (dk?.planet && dkChain && dkChain.d1.house != null && PLANET_FACULTY[dk.planet]) {
    const sw = stateWords(dkChain.d1);
    const karakaNote =
      ve?.d1.house != null && ju?.d1.house != null
        ? `; natural partnership factors sit in ${HOUSE_SHORT[ve.d1.house]} and ${HOUSE_SHORT[ju.d1.house]}`
        : '';
    if (!lead) lead = `You are drawn to someone who carries ${PLANET_SHORT[dk.planet]}.`;
    claims.push({
      id: 'partner.darakaraka',
      line: `You are drawn to someone who carries ${PLANET_SHORT[dk.planet]}.`,
      text: `At a deeper level, you are drawn to a partner who brings ${PLANET_FACULTY[dk.planet]}, lived through ${HOUSE_SELF[dkChain.d1.house]}${karakaNote}.${sw ? ` ${sw}` : ''}`,
      detail: `Darakaraka (DK) ${pname(dk.planet)}: ${cardDetail(dkChain.d1)}${dkChain.d9 ? `; D9 ${dkChain.d9.sign ?? '?'} h${dkChain.d9.house ?? '?'}` : ''}${ve ? `; Venus ${cardDetail(ve.d1)}` : ''}${ju ? `; Jupiter ${cardDetail(ju.d1)}` : ''}`,
      certainty: 'fact',
      evidence: [
        'point:D1.DK',
        ...dkChain.evidence,
        ...(ve ? ['planet:D1.Ve'] : []),
        ...(ju ? ['planet:D1.Ju'] : []),
      ],
    });
  }

  if (ul && ul.house != null) {
    const ulLordCard = ul.lord ? view.planet('D1', ul.lord) : null;
    const lordPlace = ulLordCard?.house != null ? `, steered from ${HOUSE_SHORT[ulLordCard.house]}` : '';
    claims.push({
      id: 'partner.upapada',
      line: `Committed partnership meets you through ${HOUSE_SHORT[ul.house]}.`,
      text: `A committed partner steps into your life through ${HOUSE_SELF[ul.house]}${lordPlace}.`,
      detail: `Upapada (UL) in D1 h${ul.house} ${ul.sign ?? '?'}, lord ${pname(ul.lord)}${ulLordCard ? ` in h${ulLordCard.house ?? '?'} (${ulLordCard.dignity ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: ['point:D1.UL', ...(ulLordCard && ul.lord ? [`planet:D1.${ul.lord}`] : [])],
    });
  }

  if (a7 && a7.house != null) {
    claims.push({
      id: 'partner.darapada',
      line: `The people you attract come through ${HOUSE_SHORT[a7.house]}.`,
      text: `In everyday life, the people you attract and partner with appear through ${HOUSE_SELF[a7.house]}.`,
      detail: `Darapada (A7) in D1 h${a7.house} ${a7.sign ?? '?'}, lord ${pname(a7.lord)} (h${a7.lordHouse ?? '?'})`,
      certainty: 'fact',
      evidence: ['point:D1.A7'],
    });
  }

  if (h7) {
    const occAndAsp = [...new Set([...h7.occupants.map((o) => o.planet), ...h7.aspectedGraha])].filter((p) => PLANET_FACULTY[p]);
    const d9Occ = d9h7 ? d9h7.occupants.map((o) => o.planet).filter((p) => PLANET_FACULTY[p]) : [];
    const ev = ['house:D1.h7', ...(d9h7 ? ['house:D9.h7'] : []), ...occAndAsp.slice(0, 3).filter((p) => view.planet('D1', p)).map((p) => `planet:D1.${p}`)];
    if (occAndAsp.length || d9Occ.length) {
      const shown = (occAndAsp.length ? occAndAsp : d9Occ).slice(0, 2);
      claims.push({
        id: 'partner.seventh_company',
        line: `Your partnership space holds ${faculties(shown)}.`,
        text: `The space of partnership in your chart is coloured by ${faculties(occAndAsp.length ? occAndAsp : d9Occ)}.`,
        detail: `D1 h7 occupants [${h7.occupants.map((o) => pname(o.planet)).join(', ')}], aspected by [${h7.aspectedGraha.map(pname).join(', ')}], SAV=${h7.sav ?? 'n/a'}${d9h7 ? `; D9 h7 occupants [${d9h7.occupants.map((o) => pname(o.planet)).join(', ')}]` : ''}`,
        certainty: 'fact',
        evidence: ev,
      });
    }
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function bondPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h7 = houseFrame(view, 'D1', 7, g);
  const h2 = houseFrame(view, 'D1', 2, g);
  const h4 = houseFrame(view, 'D1', 4, g);
  const h8 = houseFrame(view, 'D1', 8, g);
  const d9h1 = houseFrame(view, 'D9', 1, g);
  const d9h7 = houseFrame(view, 'D9', 7, g);
  const d7h1 = view.house('D7', 1);
  const l7 = planetChain(view, h7?.lord ?? null, g);
  const l2 = planetChain(view, h2?.lord ?? null, g);
  const l8 = planetChain(view, h8?.lord ?? null, g);
  const ju = planetChain(view, 'Ju', g);
  const ul = pointOf(view, 'D1', 'UL', g);
  const ulLord = ul?.lord ? view.planet('D1', ul.lord) : null;

  let lead = '';
  if (h2 && l2 && l2.d1.house != null) {
    const sw = stateWords(l2.d1);
    const ulNote = ul?.house != null ? `, while your committed bond is anchored in ${HOUSE_SHORT[ul.house]}` : '';
    lead = `A lasting bond for you is sustained through ${HOUSE_SHORT[l2.d1.house]}.`;
    claims.push({
      id: 'bond.keeping',
      line: `What holds a bond together for you is ${HOUSE_SHORT[l2.d1.house]}.`,
      text: `How you keep a relationship steady day after day rests on ${HOUSE_SELF[l2.d1.house]}${ulNote}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h2 ${h2.sign ?? '?'} lord ${cardDetail(l2.d1)}${ul ? `; UL in h${ul.house ?? '?'} ${ul.sign ?? '?'}, lord ${pname(ul.lord)} in h${ulLord?.house ?? '?'} (${ulLord?.dignity ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: [
        'house:D1.h2',
        ...l2.evidence,
        ...(ul ? ['point:D1.UL'] : []),
        ...(ulLord && ul?.lord ? [`planet:D1.${ul.lord}`] : []),
      ],
    });
  }

  if (h4 && h4.lordHouse != null) {
    claims.push({
      id: 'bond.home_peace',
      line: `Shared peace at home rests on ${HOUSE_SHORT[h4.lordHouse]}.`,
      text: `Inside a shared home, your comfort and peace of mind depend on ${HOUSE_SELF[h4.lordHouse]}.`,
      detail: `D1 h4 ${h4.sign ?? '?'}, lord ${pname(h4.lord)} in h${h4.lordHouse} (${h4.lordDignity ?? '?'})`,
      certainty: 'fact',
      evidence: ['house:D1.h4'],
    });
  }

  if (h8 && l8 && l8.d1.house != null) {
    const juNote = ju?.d1.house != null ? `, while wisdom and grace steady it through ${HOUSE_SHORT[ju.d1.house]}` : '';
    claims.push({
      id: 'bond.depth',
      line: `Repair and deep trust work through ${HOUSE_SHORT[l8.d1.house]}.`,
      text: `Shared vulnerability, honesty and how a bond repairs after strain move through ${HOUSE_SELF[l8.d1.house]}${juNote}.`,
      detail: `D1 h8 ${h8.sign ?? '?'} lord ${cardDetail(l8.d1)}${ju ? `; Jupiter ${cardDetail(ju.d1)}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h8', ...l8.evidence, ...(ju ? ['planet:D1.Ju'] : [])],
    });
  }

  if (d9h7 && d9h7.lordHouse != null) {
    const d9h1Note = d9h1?.lordHouse != null ? `, while your own inner footing stands in ${HOUSE_SHORT[d9h1.lordHouse]}` : '';
    claims.push({
      id: 'bond.inner_marriage',
      line: `Over time, the bond matures through ${HOUSE_SHORT[d9h7.lordHouse]}.`,
      text: `As a relationship matures, its inner durability grows through ${HOUSE_SELF[d9h7.lordHouse]}${d9h1Note}.`,
      detail: `D9 h7 ${d9h7.sign ?? '?'} lord ${pname(d9h7.lord)} in D9 h${d9h7.lordHouse}; D9 h1 ${d9h1?.sign ?? '?'} lord ${pname(d9h1?.lord)} in D9 h${d9h1?.lordHouse ?? '?'}${d7h1 ? `; D7 h1 ${d7h1.sign ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D9.h7', ...(d9h1 ? ['house:D9.h1'] : []), ...(d7h1 ? ['house:D7.h1'] : [])],
    });
  }

  if (h7) {
    const argPrimary = (h7.argala?.primary ?? []).filter((p) => PLANET_FACULTY[p]);
    const argObs = (h7.argala?.obstructed ?? []).filter((p) => PLANET_FACULTY[p]);
    const ev = ['house:D1.h7', ...(l7 ? l7.evidence : [])];
    if (argPrimary.length) {
      claims.push({
        id: 'bond.support_argala',
        line: `The bond is steadied by ${PLANET_SHORT[argPrimary[0]!] ?? 'steady support'}.`,
        text: `What actively supports and feeds your partnerships is ${faculties(argPrimary.slice(0, 3))}${argObs.length ? `, though ${faculties(argObs.slice(0, 2))} can pull against it` : ''}.`,
        detail: `D1 h7 argala primary=[${argPrimary.map(pname).join(', ')}], obstructed=[${argObs.map(pname).join(', ')}], SAV=${h7.sav ?? 'n/a'}`,
        certainty: 'fact',
        evidence: ev,
      });
    } else if (l7 && l7.d1.house != null) {
      claims.push({
        id: 'bond.support_argala',
        line: `Your partnerships lean on ${HOUSE_SHORT[l7.d1.house]}.`,
        text: `The resilience of your partnerships is anchored in ${HOUSE_SELF[l7.d1.house]}.`,
        detail: `D1 h7 SAV=${h7.sav ?? 'n/a'}, lord ${pname(h7.lord)} in h${l7.d1.house}`,
        certainty: 'fact',
        evidence: ev,
      });
    }
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function circlePanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h2 = houseFrame(view, 'D1', 2, g);
  const h4 = houseFrame(view, 'D1', 4, g);
  const h11 = houseFrame(view, 'D1', 11, g);
  const h5 = houseFrame(view, 'D1', 5, g);
  const d7h5 = view.house('D7', 5);
  const l2 = planetChain(view, h2?.lord ?? null, g);
  const l4 = planetChain(view, h4?.lord ?? null, g);
  const l11 = planetChain(view, h11?.lord ?? null, g);
  const mk = pointOf(view, 'D1', 'MK', g);
  const pk = pointOf(view, 'D1', 'PK', g);
  const a11 = pointOf(view, 'D1', 'A11', g);

  let lead = '';
  if (h2 && h2.lordHouse != null) {
    lead = `Around your bond, family and community gather through ${HOUSE_SHORT[h2.lordHouse]}.`;
    claims.push({
      id: 'circle.family',
      line: `Family life around your bond turns on ${HOUSE_SHORT[h2.lordHouse]}.`,
      text: `Close family and the shared household around your relationship turn on ${HOUSE_SELF[h2.lordHouse]}.`,
      detail: `D1 h2 ${h2.sign ?? '?'}, lord ${pname(h2.lord)} in h${h2.lordHouse} (${h2.lordDignity ?? '?'})`,
      certainty: 'fact',
      evidence: ['house:D1.h2', ...(l2 ? l2.evidence : [])],
    });
  }

  if (h4 && h4.lordHouse != null) {
    const mkNote = mk?.planet && PLANET_FACULTY[mk.planet] ? `, carried by ${PLANET_FACULTY[mk.planet]}` : '';
    claims.push({
      id: 'circle.roots',
      line: `Your home circle is anchored by ${HOUSE_SHORT[h4.lordHouse]}.`,
      text: `Home roots, extended family and maternal warmth enter your bond through ${HOUSE_SELF[h4.lordHouse]}${mkNote}.`,
      detail: `D1 h4 ${h4.sign ?? '?'}, lord ${pname(h4.lord)} in h${h4.lordHouse}; Matrikaraka (MK) ${pname(mk?.planet)}`,
      certainty: 'fact',
      evidence: ['house:D1.h4', ...(l4 ? l4.evidence : []), ...(mk ? ['point:D1.MK'] : [])],
    });
  }

  if (h11 && h11.lordHouse != null) {
    claims.push({
      id: 'circle.friends',
      line: `Friends and community enter your bond through ${HOUSE_SHORT[h11.lordHouse]}.`,
      text: `Friends, wider networks and the circle that celebrates with you connect through ${HOUSE_SELF[h11.lordHouse]}${a11?.house != null ? `, showing outwardly in ${HOUSE_SHORT[a11.house]}` : ''}.`,
      detail: `D1 h11 ${h11.sign ?? '?'}, lord ${pname(h11.lord)} in h${h11.lordHouse}; Labhapada A11 in h${a11?.house ?? '?'} ${a11?.sign ?? '?'}`,
      certainty: 'fact',
      evidence: ['house:D1.h11', ...(l11 ? l11.evidence : []), ...(a11 ? ['point:D1.A11'] : [])],
    });
  }

  if (h5 && h5.lordHouse != null) {
    const pkNote = pk?.planet && PLANET_FACULTY[pk.planet] ? `, shaped by ${PLANET_FACULTY[pk.planet]}` : '';
    claims.push({
      id: 'circle.continuity',
      line: `What you nurture and create together grows through ${HOUSE_SHORT[h5.lordHouse]}.`,
      text: `What you create, nurture and pass forward together is steered from ${HOUSE_SELF[h5.lordHouse]}${pkNote}.`,
      detail: `D1 h5 ${h5.sign ?? '?'}, lord ${pname(h5.lord)} in h${h5.lordHouse}; Putrakaraka (PK) ${pname(pk?.planet)}${d7h5 ? `; D7 h5 ${d7h5.sign ?? '?'} lord ${pname(d7h5.lord)} in D7 h${d7h5.lordHouse ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h5', ...(pk ? ['point:D1.PK'] : []), ...(d7h5 ? ['house:D7.h5'] : [])],
    });
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

const ordinal = (n: number | null): string =>
  n == null ? '?' : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export function loveChaptersPanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const spine = mdSpine(activation, clock.system, asOf);
  if (!spine.running) {
    g.add(`activation:${clock.system} level 1 covering ${asOf} missing`);
    return body('', [], g, { chapters: [] });
  }
  const ul = view.points('D1').find((p) => p.id === 'UL');
  const a7 = view.points('D1').find((p) => p.id === 'A7');
  const l7 = view.house('D1', 7)?.lord ?? null;
  const dk = pointOf(view, 'D1', 'DK', g)?.planet ?? null;
  const lovePlanets = new Set([l7, 'Ve', dk, 'Mo', 'Ju'].filter((x): x is string => !!x));
  const resolveLord = (r: ActivationRow | null | undefined): string | null =>
    r?.lord ?? (r?.sign ? view.houses('D1').find((h) => h.sign === r.sign)?.lord ?? null : null);
  const who = (r: ActivationRow) => r.lord ?? r.sign ?? '?';
  const pickLoveHouses = (houses: readonly number[]): number[] => {
    const filtered = houses.filter((h) => LOVE_HOUSES.includes(h));
    return filtered.length ? filtered : [...houses];
  };
  const carried = (r: ActivationRow): { text: string; detail: string; evidence: string[] } => {
    const effLord = resolveLord(r);
    if (!r.lord) {
      const signNote =
        (ul?.sign && r.sign === ul.sign ? '; holds Upapada (UL)' : '') +
        (a7?.sign && r.sign === a7.sign ? '; holds Darapada (A7)' : '') +
        (effLord && lovePlanets.has(effLord) ? `; ruled by love karaka/lord ${pname(effLord)}` : '');
      return {
        text: '',
        detail: `sign period ${r.sign}${signNote}`,
        evidence: effLord && view.planet('D1', effLord) ? [`planet:D1.${effLord}`] : [],
      };
    }
    const c = view.planet('D1', r.lord);
    if (!c || c.house == null || !PLANET_FACULTY[r.lord]) {
      g.add(`planet:D1.${r.lord} missing`);
      return { text: '', detail: '', evidence: [] };
    }
    const roleNote = lovePlanets.has(r.lord) ? ' (key love factor)' : '';
    return {
      text: ` In love, it is carried by ${PLANET_FACULTY[r.lord]}, placed in ${HOUSE_SHORT[c.house]}.`,
      detail: `${cardDetail(c)}${roleNote}`,
      evidence: [`planet:D1.${r.lord}`],
    };
  };
  const confirmDetail = (cs: ChapterConfirmation[]) =>
    cs.map((c) => `${c.label} main period from ${c.boundary ?? '—'} ${c.agrees ? '✓' : '✗'}`).join('; ');

  const make = (kind: SelfChapter['kind'], r: ActivationRow): SelfChapter => {
    const conf = confirmShift(activation, r.from, clock.confirming);
    const certainty = certaintyOf(conf);
    const ch = carried(r);
    const loveH = pickLoveHouses(r.houses);
    const houses = housesShort(loveH);
    const base =
      kind === 'previous'
        ? `From ${longDate(r.from)} to ${longDate(r.to)} your relationships were shaped by ${houses}.`
        : kind === 'running'
          ? `From ${longDate(r.from)} to ${longDate(r.to)} your love life is organised around ${houses}.`
          : `From ${longDate(r.from)} your relationships move into a chapter of ${houses}.`;
    return {
      kind,
      lord: who(r),
      lordLabel: r.lord ? pname(r.lord) : (r.sign ?? '?'),
      from: r.from,
      to: r.to,
      text: certainty === 'split' || !houses ? null : base + ch.text,
      detail: `${clock.label} level 1 ${r.lord ? pname(r.lord) : r.sign} ${r.from} → ${r.to}; love houses ${loveH.join(', ') || '—'} (all houses ${r.houses.join(', ') || '—'})${ch.detail ? `; ${ch.detail}` : ''}; confirming: ${confirmDetail(conf) || 'none'}`,
      certainty,
      houses: loveH,
      confirmations: conf,
      evidence: [activationKey(r), ...ch.evidence],
    };
  };

  const chapters: SelfChapter[] = [];
  if (spine.previous) chapters.push(make('previous', spine.previous));
  else g.add(`activation:${clock.system} previous level 1 missing`);
  const running = make('running', spine.running);
  const sub = spine.runningSub;
  const subLord = resolveLord(sub);
  if (sub && (sub.lord || sub.sign)) {
    const mdLord = resolveLord(spine.running);
    const mdCard = mdLord ? view.planet('D1', mdLord) : null;
    const cell = subLord ? mdCard?.dashaCharter?.fruition?.[subLord] : undefined;
    const flavour =
      cell?.fruitionClass && FRUITION_WORDS[cell.fruitionClass]
        ? ` In this chapter ${FRUITION_WORDS[cell.fruitionClass]}${cell.isDwirdwadasha212 ? ', though what comes in also goes out' : cell.isShadAshtaka68 ? ', with friction between the two' : ''}.`
        : '';
    if (!cell && mdLord && subLord) g.add(`planet:D1.${mdLord}.dashaCharter.fruition.${subLord} missing`);
    const subLoveH = pickLoveHouses(sub.houses);
    const parallelClocks = allRunningDashas(activation, asOf, clock.system)
      .filter((s) => s.system !== clock.system && (s.l1 || s.l2))
      .map((s) => `${clockLabel(s.system)}: ${s.l1 ? `${s.l1.lord ? pname(s.l1.lord) : s.l1.sign}(${s.l1.from}→${s.l1.to})` : ''}${s.l2 ? `/${s.l2.lord ? pname(s.l2.lord) : s.l2.sign}(${s.l2.from}→${s.l2.to})` : ''}`);
    running.sub = {
      lord: sub.lord ?? sub.sign ?? '?',
      lordLabel: sub.lord ? pname(sub.lord) : (sub.sign ?? '?'),
      from: sub.from,
      to: sub.to,
      text: `Since ${longDate(sub.from)} and until ${longDate(sub.to)}, what presses in love is ${housesShort(subLoveH)}.${flavour}`,
      detail: `${clockLabel(clock.system)} level 2 ${sub.lord ? pname(sub.lord) : sub.sign} ${sub.from} → ${sub.to}; activates love houses ${subLoveH.join(', ')}${cell ? `; fruition from ${pname(mdLord)}: ${ordinal(cell.houseFromMd)} from the main lord, ${cell.fruitionClass}${cell.isDwirdwadasha212 ? ', 2/12' : ''}${cell.isShadAshtaka68 ? ', 6/8' : ''}` : ''}${parallelClocks.length ? `; all parallel clocks (${parallelClocks.length}): ${parallelClocks.join('; ')}` : ''}`,
      houses: subLoveH,
    };
    running.evidence.push(activationKey(sub));
  } else g.add(`activation:${clock.system} level 2 covering ${asOf} missing`);
  if (spine.nextSub && (spine.nextSub.lord || spine.nextSub.sign)) {
    running.nextSub = {
      lord: spine.nextSub.lord ?? spine.nextSub.sign ?? '?',
      lordLabel: spine.nextSub.lord ? pname(spine.nextSub.lord) : (spine.nextSub.sign ?? '?'),
      from: spine.nextSub.from,
      to: spine.nextSub.to,
      houses: pickLoveHouses(spine.nextSub.houses),
    };
  }
  chapters.push(running);
  if (spine.next) chapters.push(make('next', spine.next));
  else g.add(`activation:${clock.system} next level 1 missing`);

  const whoOf = (c: SelfChapter) => (PLANET_SHORT[c.lord] ? PLANET_SHORT[c.lord] : `the ${c.lordLabel} period`);
  const lineOf = (c: SelfChapter): string =>
    c.certainty === 'split' || !c.text
      ? `${monthYear(c.from)} – ${monthYear(c.to)}: your other clocks do not mark this turn.`
      : c.kind === 'previous'
        ? `From ${monthYear(c.from)} to ${monthYear(c.to)} ${whoOf(c)} shaped love, through ${housesWord(c.houses)}.`
        : c.kind === 'running'
          ? `From ${monthYear(c.from)} to ${monthYear(c.to)} ${whoOf(c)} leads love, through ${housesWord(c.houses)}.`
          : `From ${monthYear(c.from)} ${whoOf(c)} leads love, through ${housesWord(c.houses)}.`;
  const claims: SelfClaim[] = chapters.map((c) => ({
    id: `chapters.${c.kind}`,
    text: c.text ?? `${longDate(c.from)} – ${longDate(c.to)}: your other clocks do not mark a turn here.`,
    line: lineOf(c),
    range: { from: c.from, to: c.to },
    detail: c.detail,
    certainty: c.certainty,
    evidence: c.evidence,
  }));
  if (running.sub) {
    claims.splice(chapters.indexOf(running) + 1, 0, {
      id: 'chapters.sub',
      text: running.sub.text,
      line: `Until ${longDate(running.sub.to)} the pressure in love is on ${housesWord(running.sub.houses)}.`,
      range: { from: running.sub.from, to: running.sub.to },
      detail: running.sub.detail,
      certainty: running.certainty,
      evidence: running.evidence.slice(-1),
    });
  }
  const lead = `In love, you are in the chapter of ${housesShort(running.houses)}, until ${longDate(spine.running.to)}.`;
  return body(lead, claims, g, { chapters });
}

export function loveStrugglePanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const out: Array<SelfClaim & { planet: string | null }> = [];
  const card = (p: string): PlanetCard | null => view.planet('D1', p);
  const isMalefic = (p: string) => {
    const c = card(p);
    return !!c && /malefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '');
  };
  const dusthana = (h: number | null | undefined) => (h ? (view.house('D1', h)?.class ?? []).includes('dusthana') : false);

  const h7 = houseFrame(view, 'D1', 7, g);
  const h5 = houseFrame(view, 'D1', 5, g);
  const l7 = h7?.lord ?? null;
  const dk = view.points('D1').find((p) => p.id === 'DK')?.planet ?? null;
  const ul = view.points('D1').find((p) => p.id === 'UL');
  const ulLord = ul?.lord ?? null;
  const l7Chain = planetChain(view, l7, g);

  if (l7Chain && dusthana(l7Chain.d1.house)) {
    out.push({
      id: 'struggle.lord_dusthana',
      planet: l7Chain.planet,
      line: 'What steers your partnerships sits in a testing place.',
      text: `What steers your partnerships sits in a testing place: ${HOUSE_SELF[l7Chain.d1.house!]}.`,
      detail: `D1 h7 lord ${cardDetail(l7Chain.d1)}; D1 h${l7Chain.d1.house} class dusthana`,
      certainty: 'fact',
      evidence: ['house:D1.h7', ...l7Chain.evidence],
    });
  }

  for (const p of [...new Set([l7, 'Ve', dk, 'Mo', ulLord].filter((x): x is string => !!x))]) {
    const c = card(p);
    if (!c || !PLANET_FACULTY[p]) continue;
    if (/debil/i.test(c.dignity ?? '')) {
      const lifted = hasCancellation(view, p);
      out.push({
        id: `struggle.weak_${p}`,
        planet: p,
        line: `What carries ${PLANET_SHORT[p] ?? ''} in love is fragile by birth${lifted ? ', lifted over time' : ''}.`,
        text: `In love, what carries ${PLANET_FACULTY[p]} is at its weakest by birth${lifted ? ', and a cancellation in your chart lifts it over time' : ''}.`,
        detail: `${cardDetail(c)}${lifted ? '; cancellation row present' : ''}`,
        certainty: 'fact',
        evidence: [`planet:D1.${p}`],
      });
    }
    const rip = c.avasthaMultipliers?.ripeness;
    if (rip && HEAVY_RIPENESS.has(rip)) {
      out.push({
        id: `struggle.ripeness_${p}`,
        planet: p,
        line: `What carries ${PLANET_SHORT[p] ?? ''} in love ${RIPENESS_SHORT[rip] ?? RIPENESS_WORDS[rip]}.`,
        text: `In closeness, what carries ${PLANET_FACULTY[p]} ${RIPENESS_WORDS[rip]}.`,
        detail: `${pname(p)} avasthas ${JSON.stringify(c.avasthas)}; delivery ${rip} ×${c.avasthaMultipliers?.effective}`,
        certainty: 'fact',
        evidence: [`planet:D1.${p}`],
      });
    }
  }

  if (h7) {
    for (const p of [...h7.occupants.map((o) => o.planet), ...h7.aspectedGraha]) {
      if (p === l7 || !isMalefic(p) || !PLANET_FACULTY[p]) continue;
      const on = h7.occupants.some((o) => o.planet === p) ? 'sits in' : 'weighs on';
      out.push({
        id: `struggle.on_partner_${p}`,
        planet: p,
        line: `What carries ${PLANET_SHORT[p] ?? ''} weighs on your partnerships.`,
        text: `What carries ${PLANET_FACULTY[p]} ${on} your partnership space and asks for patience.`,
        detail: `${pname(p)} ${on === 'sits in' ? 'occupies' : 'aspects'} D1 h7; natural and functional malefic`,
        certainty: 'fact',
        evidence: ['house:D1.h7', `planet:D1.${p}`],
      });
    }
  }

  const ve = card('Ve');
  for (const p of [...(ve?.conjunctions ?? []), ...(ve?.aspectedBy ?? [])]) {
    if (!isMalefic(p) || !PLANET_FACULTY[p]) continue;
    out.push({
      id: `struggle.on_heart_${p}`,
      planet: p,
      line: `What carries ${PLANET_SHORT[p] ?? ''} presses on how you love.`,
      text: `What carries ${PLANET_FACULTY[p]} presses on your affection and closeness.`,
      detail: `${pname(p)} ${ve?.conjunctions.includes(p) ? 'conjunct' : 'aspects'} Venus; natural and functional malefic`,
      certainty: 'fact',
      evidence: ['planet:D1.Ve', `planet:D1.${p}`],
    });
  }

  if (h5 && dusthana(h5.lordHouse)) {
    out.push({
      id: 'struggle.romance_place',
      planet: h5.lord,
      line: 'Romance and openness take longer to settle.',
      text: `Your romance and emotional openness depend on ${HOUSE_SELF[h5.lordHouse!]}, which asks for patience.`,
      detail: `D1 h5 lord ${pname(h5.lord)} in h${h5.lordHouse} (dusthana)`,
      certainty: 'fact',
      evidence: ['house:D1.h5'],
    });
  }

  const loveDoshas = yogasTouching(view, [l7, 'Ve', 'Ma', dk].filter((x): x is string => !!x), [7, 2, 4, 8, 12]).filter(
    (y) => yogaClassWords(y.class).kind === 'knot' || /mangal|kuja|kalathra|upapada/i.test(y.name),
  );
  for (const d of loveDoshas.slice(0, 2)) {
    out.push({
      id: `struggle.dosha_${d.id}`,
      planet: d.planets[0] ?? l7,
      line: 'A knot in your chart asks for patience in partnership.',
      text: `A knot in your chart touches ${housesShort(d.houses.length ? d.houses : [7])} and asks for steady patience in love.`,
      detail: `${d.name} (${d.class}): planets [${d.planets.map(pname).join(', ')}], houses [${d.houses.join(', ')}]`,
      certainty: 'fact',
      evidence: [`yoga:D1.${d.id}`],
    });
  }

  if (out.length === 0) {
    const h8 = houseFrame(view, 'D1', 8, g);
    if (h8 && h8.lordHouse != null && HOUSE_SELF[h8.lordHouse]) {
      out.push({
        id: 'struggle.vulnerability_load',
        planet: h8.lord,
        line: `Shared vulnerability tests closeness through ${HOUSE_SHORT[h8.lordHouse] ?? HOUSE_SELF[h8.lordHouse]}.`,
        text: `Shared vulnerability and unspoken expectations in closeness test you through ${HOUSE_SELF[h8.lordHouse]}.`,
        detail: `D1 h8 lord ${pname(h8.lord)} in h${h8.lordHouse}`,
        certainty: 'fact',
        evidence: ['house:D1.h8'],
      });
    }
  }

  const run = runningChain(activation, clock.system, asOf);
  const allRunning = allRunningDashas(activation, asOf, clock.system);
  const resolveLord = (r: ActivationRow | null | undefined): string | null =>
    r?.lord ?? (r?.sign ? view.houses('D1').find((h) => h.sign === r.sign)?.lord ?? null : null);
  const runningLords = new Set([resolveLord(run.l1), resolveLord(run.l2)].filter(Boolean));
  const ordered = [
    ...out.filter((c) => c.planet && runningLords.has(c.planet)),
    ...out.filter((c) => !(c.planet && runningLords.has(c.planet))),
  ];
  const claims: SelfClaim[] = ordered.slice(0, MAX_STRUGGLE_CLAIMS).map(({ planet, ...c }) => {
    const r = [run.l2, run.l1].find((x) => x && planet && resolveLord(x) === planet);
    const otherActive = planet
      ? allRunning
          .filter((s) => s.system !== clock.system && (resolveLord(s.l1) === planet || resolveLord(s.l2) === planet))
          .map((s) => `${clockLabel(s.system)} (${(resolveLord(s.l2) === planet ? s.l2 : s.l1)!.from}→${(resolveLord(s.l2) === planet ? s.l2 : s.l1)!.to})`)
      : [];
    const otherSuffix = otherActive.length ? `; also running in ${otherActive.join(', ')}` : '';
    if (!r) return otherSuffix ? { ...c, detail: `${c.detail}${otherSuffix}` } : c;
    const what = r.level === 1 ? 'chapter' : 'sub-chapter';
    return {
      ...c,
      text: `${c.text} This presses hardest until ${longDate(r.to)}, when your current ${what} ends.`,
      line: c.line ? `${c.line.replace(/\.$/, '')} until ${longDate(r.to)}.` : undefined,
      range: { from: r.from, to: r.to },
      detail: `${c.detail}; running ${clock.label} level ${r.level} ${r.lord ? pname(r.lord) : r.sign} ${r.from} → ${r.to}${otherSuffix}`,
      evidence: [...c.evidence, activationKey(r)],
    };
  });
  return body(struggleLead(claims), claims, g);
}

export function loveYearPanel({ view, asOf }: PanelInput): PanelBody {
  const yearRange = (r: { from: string; to: string } | null) => r ?? ('always' as const);
  const g = gaps();
  const claims: SelfClaim[] = [];
  const m = runningMudda(view, asOf);
  const tp = runningTp(view, asOf, m?.row.year);
  if (!m && !tp) {
    g.add(`annual:VP covering ${asOf} missing`);
    return body('', [], g);
  }
  const year = m?.row.year ?? tp!.year;
  const tpYear = tp?.year ?? year;
  const l7 = view.house('D1', 7)?.lord ?? 'Ve';
  const mudda = m?.row.dashas.find((d) => d.system === 'mudda');
  const span = mudda?.periods.length
    ? { from: mudda.periods.map((p) => p.from).sort()[0]!, to: mudda.periods.map((p) => p.to).sort().at(-1)! }
    : null;
  const ta = activeTpAshtottariPeriod(tp, asOf, span);
  const loveSahams = [...(tp?.sahams ?? []), ...(m?.row.sahams ?? [])].filter((s) =>
    /vivaha|preethi|priti|kali|kama/i.test(s.name),
  );
  const sahamNote = loveSahams.length
    ? `; sahams ${loveSahams.map((s) => `${s.name} in ${s.sign ?? '?'} h${s.house ?? '?'}`).join(', ')}`
    : '';
  let lead = '';
  if (!tp) {
    g.add(`annual:TP${tpYear}.D1 missing`);
  } else {
    const atL7 = l7 ? tp.houses.find((h) => h.occupants.some((o) => o.planet === l7)) : undefined;
    const occL7 = atL7?.occupants.find((o) => o.planet === l7);
    if (atL7 && occL7) {
      const dw = dignityWords(occL7.dignity);
      claims.push({
        id: 'year.lord_place',
        line: `This year's chart puts your partnership factor in ${HOUSE_SHORT[atL7.house]}${dw ? `, ${dw}` : ''}.`,
        text: `This year's chart puts what steers your partnerships in ${HOUSE_SELF[atL7.house]}${dw ? `, ${dw}` : ''}.`,
        detail: `TP${tpYear} lagna ${tp.lagna}; natal 7th lord ${pname(l7)} in year h${atL7.house} ${atL7.sign} (${occL7.dignity ?? '?'})${sahamNote}`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
      lead = `This year your chart puts what steers your partnerships in ${HOUSE_SHORT[atL7.house]}.`;
    }
    const atVe = tp.houses.find((h) => h.occupants.some((o) => o.planet === 'Ve'));
    const occVe = atVe?.occupants.find((o) => o.planet === 'Ve');
    if (atVe && occVe && atVe.house !== atL7?.house) {
      const dw = dignityWords(occVe.dignity);
      claims.push({
        id: 'year.lord_company',
        line: `Affection and closeness this year move through ${HOUSE_SHORT[atVe.house]}.`,
        text: `This year your affection and closeness work through ${HOUSE_SELF[atVe.house]}${dw ? `, ${dw}` : ''}.`,
        detail: `TP${tpYear} Venus in year h${atVe.house} ${atVe.sign} (${occVe.dignity ?? '?'})`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
    }
    const y7 = tp.houses.find((h) => h.house === 7);
    const y5 = tp.houses.find((h) => h.house === 5);
    if (y7?.lordHouse || y5?.lordHouse) {
      const targetH = y7?.lordHouse ?? y5?.lordHouse ?? 7;
      const y5Note = y5?.lordHouse && y5.lordHouse !== targetH ? `, while romance moves through ${HOUSE_SHORT[y5.lordHouse]}` : '';
      claims.push({
        id: 'year.self_lord',
        line: `This year partnership is steered from ${HOUSE_SHORT[targetH]}.`,
        text: `This year your partnerships are steered from ${HOUSE_SELF[targetH]}${y5Note}.`,
        detail: `TP${tpYear} h7 ${y7?.sign ?? '?'}, lord ${pname(y7?.lord)} in year h${y7?.lordHouse ?? '?'} (${y7?.lordDignity ?? '?'}); TP${tpYear} h5 ${y5?.sign ?? '?'}, lord ${pname(y5?.lord)} in year h${y5?.lordHouse ?? '?'}${sahamNote}`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
    }
  }
  for (const c of claims) c.range = yearRange(span ?? (ta ? { from: ta.from, to: ta.to } : null));
  const shortClock = m ?? (ta ? { lord: ta.lord, from: ta.from, to: ta.to } : null);
  if (shortClock && PLANET_FACULTY[shortClock.lord]) {
    const evKey = m ? `annual:VP${year}.D1` : `annual:TP${tpYear}.D1`;
    claims.push({
      id: 'year.short_clock',
      range: { from: shortClock.from, to: shortClock.to },
      line: `Until ${longDate(shortClock.to)} the year's short clock runs through ${PLANET_SHORT[shortClock.lord] ?? 'this period'}.`,
      text: `Until ${longDate(shortClock.to)} the year's short clock in love runs through ${PLANET_FACULTY[shortClock.lord]}.`,
      detail: `${m ? `VP${year} Mudda ${pname(m.lord)} ${m.from} → ${m.to}` : ''}${ta ? `${m ? '; ' : ''}TP${tpYear} tithi_ashtottari ${pname(ta.lord)} ${ta.from} → ${ta.to}` : ''}${sahamNote}`,
      certainty: 'fact',
      evidence: [evKey],
    });
  }
  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function loveDiagnosisPanel(b: Partial<Record<BoardPanelId, PanelBody>>): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const heartClaim = b.heart?.claims[0];
  const partnerClaim = b.partner?.claims[0];
  if (heartClaim || partnerClaim) {
    const primary = heartClaim ?? partnerClaim!;
    const secondary = heartClaim && partnerClaim ? partnerClaim : undefined;
    const leadLine = b.heart?.lead || b.partner?.lead || primary.line || primary.text;
    claims.push({
      id: 'diagnosis.direction',
      text: `${primary.text}${secondary ? ` ${secondary.text}` : ''}`,
      line: leadLine,
      range: 'always',
      detail: [primary.detail, secondary?.detail].filter(Boolean).join(' | '),
      certainty: 'fact',
      evidence: [`claim:${primary.id}`, ...(secondary ? [`claim:${secondary.id}`] : [])],
    });
  } else {
    g.add('love heart/partner panels have no direction claim');
  }

  const struggle = b.struggle?.claims ?? [];
  const t = struggle.find((c) => /presses hardest until/.test(c.text)) ?? struggle[0] ?? null;
  if (t) {
    claims.push({
      id: 'diagnosis.tension',
      text: `The tension in it: ${lower(t.text)}`,
      line: t.line,
      range: t.range ?? 'always',
      detail: t.detail,
      certainty: t.certainty,
      evidence: [`claim:${t.id}`],
    });
  } else {
    g.add('no love struggle claim to name a tension');
  }

  const running = b.chapters?.chapters?.find((c) => c.kind === 'running');
  if (running) {
    const now =
      running.certainty === 'split'
        ? `Your clocks do not agree on the love chapter you are in; your reading clock dates it ${longDate(running.from)} to ${longDate(running.to)}.`
        : `In love, you are in a chapter of ${housesShort(running.houses)} that runs to ${longDate(running.to)}${running.sub ? `; since ${longDate(running.sub.from)}, what presses is ${housesShort(running.sub.houses)}` : ''}.`;
    const nowLine =
      running.certainty === 'split'
        ? undefined
        : running.sub
          ? `Until ${longDate(running.sub.to)} the pressure in love is on ${housesWord(running.sub.houses)}, inside a chapter of ${housesWord(running.houses, 2)}.`
          : `Until ${longDate(running.to)} your love life is in a chapter of ${housesWord(running.houses)}.`;
    claims.push({
      id: 'diagnosis.now',
      text: now,
      line: nowLine,
      range: running.sub ? { from: running.sub.from, to: running.sub.to } : { from: running.from, to: running.to },
      detail: running.detail,
      certainty: running.certainty,
      evidence: ['claim:chapters.running', ...(running.sub ? ['claim:chapters.sub'] : [])],
    });
  } else {
    g.add('love chapters panel has no running chapter');
  }

  return body(claims[0]?.text ?? '', claims, g);
}
