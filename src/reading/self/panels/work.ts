/**
 * The Work reading panels (`work.reading.*`, docs/reading-engine/59 §4):
 *   - `work.reading.vocation`  — What you are built to do (10th, L10, D10, AmK, Sa/Me/Su/Ju, Karakamsa)
 *   - `work.reading.standing`  — How you are seen (AL, A10, HL, GL, SL, Sun, L10, D10 lagna, H10 SAV & Argala)
 *   - `work.reading.ground`    — Where the work is now (6th, 3rd, 7th, 12th, D10 6th & 3rd, A6, A3, Sa/Ma stamina)
 *   - `work.reading.gain`      — What it pays (11th, 2nd, D2, D10 11th, A11, A2, Dhana/Raja yogas, SAV on H2/H10/H11)
 *   - `work.reading.chapters`  — Your chapters for work (multi-clock spine filtered to Work houses & karakas)
 *   - `work.reading.struggle`  — What tests it (L10, L6, Sa, AmK, Su, dated release from reading clock)
 *   - `work.reading.year`      — This year in work (TP & VP D1 on H10, H6, H11, L10, Sa, Karma/Labha sahams, Mudda short clock)
 *   - `work.reading.diagnosis` — Your work life, in short (3-part synthesis of direction, knot/tension, and running chapter)
 *
 * Pure selection over stored `DigestView` and `ActivationRow[]` rows: zero astrological derivation in Node,
 * zero chart jargon in `text`/`line`/`lead`, and every `evidence` key guaranteed to resolve in `collectData`.
 */
import type { ActivationRow } from '../../digest/activation.js';
import type { HouseCard, PlanetCard } from '../../digest/types.js';
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
import { runningTithiPravesha } from '../../annual/tithiPravesha.js';
import { struggleLead } from './struggle.js';

export const WORK_HOUSES: readonly number[] = [10, 6, 11, 2, 9, 3, 5, 7];
const HEAVY_RIPENESS = new Set(['unripe_sour', 'dried_seed_externalized']);
const MAX_STRUGGLE_CLAIMS = 6;
const lower = (s: string): string => (s ? s[0]!.toLowerCase() + s.slice(1) : s);

/**
 * BG-11: service (D10 6th) against business (D10 7th), read only from the engine's labels on the two cards: the lord's
 * dignity and the occupants. The only comparison is the occupant count; dignities are worded, never ranked.
 */
export function serviceOrBusinessClaim(h6: HouseCard | null, h7: HouseCard | null): SelfClaim | null {
  if (!h6 || !h7) return null;
  const n6 = h6.occupants.length;
  const n7 = h7.occupants.length;
  const lean = n6 > n7 ? 'service' : n7 > n6 ? 'business' : 'even';
  const lordWords = (h: HouseCard) => {
    const dw = dignityWords(h.lordDignity);
    return dw ? `what steers it is ${dw}` : null;
  };
  const sideWords = (h: HouseCard, n: number) =>
    [n ? `${n === 1 ? 'one force' : `${n} forces`} at work there` : 'nothing sitting there', lordWords(h)].filter(Boolean).join(', ');
  const line =
    lean === 'service'
      ? 'Your career leans toward working within a team or an organisation.'
      : lean === 'business'
        ? 'Your career leans toward deals, clients and work of your own.'
        : 'Your career holds working for others and working for yourself in balance.';
  const occ = (h: HouseCard) => h.occupants.map((o) => `${pname(o.planet)}${o.dignity ? ` (${o.dignity})` : ''}`).join(', ') || 'none';
  return {
    id: 'ground.service_or_business',
    line,
    text: `${line} Working for others has ${sideWords(h6, n6)}; deals and partnerships of your own have ${sideWords(h7, n7)}.`,
    detail: `D10 h6 ${h6.sign ?? '?'} lord ${pname(h6.lord)} in D10 h${h6.lordHouse ?? '?'} (${h6.lordDignity ?? '?'}), occupants [${occ(h6)}]; D10 h7 ${h7.sign ?? '?'} lord ${pname(h7.lord)} in D10 h${h7.lordHouse ?? '?'} (${h7.lordDignity ?? '?'}), occupants [${occ(h7)}]; lean by occupant count: ${lean}`,
    certainty: 'fact',
    evidence: ['house:D10.h6', 'house:D10.h7'],
  };
}

/** BG-11: the stored SAV bindus of D1 houses 10, 11 and 12 compared as numbers (earning and gains against what drains away). */
export function savBalanceClaim(h10: HouseCard | null, h11: HouseCard | null, h12: HouseCard | null): SelfClaim | null {
  if (h10?.sav == null || h11?.sav == null || h12?.sav == null) return null;
  const [a, b, c] = [h10.sav, h11.sav, h12.sav];
  const both = a > c && b > c;
  const neither = a <= c && b <= c;
  const line = both
    ? 'What you earn and build outweighs what slips away.'
    : neither
      ? 'What slips away can match what you earn, so guard your outflow.'
      : b > c
        ? 'Your gains outweigh your losses, though work itself takes more effort to build.'
        : 'Your work is well supported, though gains leak away unless you guard them.';
  return {
    id: 'gain.sav_balance',
    line,
    text: `${line}${both && b > a ? ' Gains come a little more easily than standing.' : ''}`,
    detail: `SAV H10:H11:H12 = ${a}:${b}:${c}`,
    certainty: 'fact',
    evidence: ['house:D1.h10', 'house:D1.h11', 'house:D1.h12'],
  };
}

export function vocationPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h10 = houseFrame(view, 'D1', 10, g);
  const h3 = houseFrame(view, 'D1', 3, g);
  const h5 = houseFrame(view, 'D1', 5, g);
  const d10h1 = houseFrame(view, 'D10', 1, g);
  const d10h10 = houseFrame(view, 'D10', 10, g);
  const d10L10 = d10h10?.lord ? view.planet('D10', d10h10.lord) : null;
  const l10 = planetChain(view, h10?.lord ?? null, g);
  const amk = pointOf(view, 'D1', 'AmK', g);
  const amkChain = planetChain(view, amk?.planet ?? null, g);
  const sa = planetChain(view, 'Sa', g);
  const me = planetChain(view, 'Me', g);
  const su = planetChain(view, 'Su', g);
  const ju = planetChain(view, 'Ju', g);
  const akD1 = view.points('D1').find((p) => p.id === 'AK');
  const akD9Pt = view.points('D9').find((p) => p.id === 'AK');
  const akPlanet = akD1?.planet ?? akD9Pt?.planet ?? null;
  const akD9 = akPlanet ? view.planet('D9', akPlanet) : null;

  let lead = '';
  if (l10 && l10.d1.house != null) {
    const sw = stateWords(l10.d1);
    const d10Card = h10?.lord ? view.planet('D10', h10.lord) : null;
    lead = `You are built for work that runs through ${HOUSE_SHORT[l10.d1.house]}.`;
    claims.push({
      id: 'vocation.tenth_lord',
      line: `Your work is steered from ${HOUSE_SHORT[l10.d1.house]}.`,
      text: `The core of your work and vocation is steered from ${HOUSE_SELF[l10.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h10 ${h10?.sign ?? '?'} lord ${cardDetail(l10.d1)}${d10Card ? `; D10 ${d10Card.sign ?? '?'} h${d10Card.house ?? '?'} (${d10Card.dignity ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h10', ...l10.evidence, ...(d10Card && h10?.lord ? [`planet:D10.${h10.lord}`] : [])],
    });
  }

  if (amk?.planet && amkChain && amkChain.d1.house != null && PLANET_FACULTY[amk.planet]) {
    const sw = stateWords(amkChain.d1);
    const d10Amk = view.planet('D10', amk.planet);
    if (!lead) lead = `The faculty that carries your vocation is ${PLANET_SHORT[amk.planet]}.`;
    claims.push({
      id: 'vocation.amatyakaraka',
      line: `The faculty that carries your vocation is ${PLANET_SHORT[amk.planet]}.`,
      text: `Your natural professional strength runs through ${PLANET_FACULTY[amk.planet]}, anchored in ${HOUSE_SELF[amkChain.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `Amatyakaraka (AmK) ${pname(amk.planet)}: ${cardDetail(amkChain.d1)}${d10Amk ? `; D10 ${d10Amk.sign ?? '?'} h${d10Amk.house ?? '?'} (${d10Amk.dignity ?? '?'})` : ''}${sa ? `; Saturn ${cardDetail(sa.d1)}` : ''}${me ? `; Mercury ${cardDetail(me.d1)}` : ''}${su ? `; Sun ${cardDetail(su.d1)}` : ''}${ju ? `; Jupiter ${cardDetail(ju.d1)}` : ''}`,
      certainty: 'fact',
      evidence: [
        'point:D1.AmK',
        ...amkChain.evidence,
        ...(d10Amk ? [`planet:D10.${amk.planet}`] : []),
        ...(sa ? ['planet:D1.Sa'] : []),
        ...(me ? ['planet:D1.Me'] : []),
        ...(su ? ['planet:D1.Su'] : []),
        ...(ju ? ['planet:D1.Ju'] : []),
      ],
    });
  }

  if (d10h10 || d10h1) {
    const targetH = d10h10?.lordHouse ?? d10h1?.lordHouse ?? 10;
    const d10Occ = [...new Set([...(d10h10?.occupants.map((o) => o.planet) ?? []), ...(d10h1?.occupants.map((o) => o.planet) ?? [])])].filter(
      (p) => PLANET_FACULTY[p],
    );
    const occNote = d10Occ.length ? `, backed by ${faculties(d10Occ.slice(0, 2))}` : '';
    const ev = [
      ...(d10h10 ? ['house:D10.h10'] : []),
      ...(d10h1 ? ['house:D10.h1'] : []),
      ...(d10L10 && d10h10?.lord ? [`planet:D10.${d10h10.lord}`] : []),
      ...(akD9Pt ? ['point:D9.AK'] : []),
      ...(akD9 && akPlanet ? [`planet:D9.${akPlanet}`] : []),
    ];
    claims.push({
      id: 'vocation.dasamsa',
      line: `In your dedicated career chart, your work centres on ${HOUSE_SHORT[targetH]}.`,
      text: `In the dedicated career layer of your chart, your work centres on ${HOUSE_SELF[targetH]}${occNote}.`,
      detail: `D10 h10 ${d10h10?.sign ?? '?'} lord ${pname(d10h10?.lord)} in D10 h${d10h10?.lordHouse ?? '?'} (${d10L10?.dignity ?? '?'}); D10 h1 ${d10h1?.sign ?? '?'} lord ${pname(d10h1?.lord)} in D10 h${d10h1?.lordHouse ?? '?'}${akD9 ? `; Karakamsa ${akD9.sign ?? '?'} (D9 h${akD9.house ?? '?'})` : ''}`,
      certainty: 'fact',
      evidence: ev,
    });
  }

  if (h3?.lordHouse != null || h5?.lordHouse != null) {
    const craftH = h5?.lordHouse ?? h3?.lordHouse ?? 5;
    const effortH = h3?.lordHouse ?? craftH;
    const ev = [...(h5 ? ['house:D1.h5'] : []), ...(h3 ? ['house:D1.h3'] : [])];
    claims.push({
      id: 'vocation.skills_craft',
      line: `Your craft and problem-solving draw on ${HOUSE_SHORT[craftH]}.`,
      text: `Your practical craft and judgement draw on ${HOUSE_SELF[craftH]}${effortH !== craftH ? `, while your hands-on effort pushes through ${HOUSE_SHORT[effortH]}` : ''}.`,
      detail: `D1 h5 lord ${pname(h5?.lord)} in h${h5?.lordHouse ?? '?'}; D1 h3 lord ${pname(h3?.lord)} in h${h3?.lordHouse ?? '?'}`,
      certainty: 'fact',
      evidence: ev,
    });
  }

  if (h10) {
    const occAndAsp = [...new Set([...h10.occupants.map((o) => o.planet), ...h10.aspectedGraha])].filter((p) => PLANET_FACULTY[p]);
    if (occAndAsp.length) {
      const ev = ['house:D1.h10', ...occAndAsp.slice(0, 3).filter((p) => view.planet('D1', p)).map((p) => `planet:D1.${p}`)];
      claims.push({
        id: 'vocation.tenth_company',
        line: `Your work space is shaped by ${faculties(occAndAsp.slice(0, 2))}.`,
        text: `The space of work and authority in your chart is shaped by ${faculties(occAndAsp)}.`,
        detail: `D1 h10 occupants [${h10.occupants.map((o) => pname(o.planet)).join(', ')}], aspected by [${h10.aspectedGraha.map(pname).join(', ')}]`,
        certainty: 'fact',
        evidence: ev,
      });
    }
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function standingPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h10 = houseFrame(view, 'D1', 10, g);
  const h1 = houseFrame(view, 'D1', 1, g);
  const al = pointOf(view, 'D1', 'AL', g);
  const a10 = pointOf(view, 'D1', 'A10', g);
  const gl = view.points('D1').find((p) => p.id === 'GL');
  const hl = view.points('D1').find((p) => p.id === 'HL');
  const sl = view.points('D1').find((p) => p.id === 'SL');
  const su = planetChain(view, 'Su', g);
  const l10 = planetChain(view, h10?.lord ?? null, g);

  let lead = '';
  if (a10 && a10.house != null) {
    lead = `In your work, others see you through ${HOUSE_SHORT[a10.house]}.`;
    claims.push({
      id: 'standing.rajyapada',
      line: `Your professional standing shows through ${HOUSE_SHORT[a10.house]}.`,
      text: `In the working world, your reputation and visible authority show through ${HOUSE_SELF[a10.house]}.`,
      detail: `Rajyapada (A10) in D1 h${a10.house} ${a10.sign ?? '?'}, lord ${pname(a10.lord)} (h${a10.lordHouse ?? '?'})`,
      certainty: 'fact',
      evidence: ['point:D1.A10'],
    });
  }

  if (al && al.house != null) {
    if (!lead) lead = `In public, people read you through ${HOUSE_SHORT[al.house]}.`;
    claims.push({
      id: 'standing.arudha',
      line: `In public, people read you through ${HOUSE_SHORT[al.house]}.`,
      text: `Beyond your title, the public image that follows you is shaped by ${HOUSE_SELF[al.house]}.`,
      detail: `Arudha Lagna (AL) in D1 h${al.house} ${al.sign ?? '?'}, lord ${pname(al.lord)} (h${al.lordHouse ?? '?'})`,
      certainty: 'fact',
      evidence: ['point:D1.AL', ...(h1 ? ['house:D1.h1'] : [])],
    });
  }

  if (su && su.d1.house != null) {
    const sw = stateWords(su.d1);
    claims.push({
      id: 'standing.authority',
      line: `Your natural authority works through ${HOUSE_SHORT[su.d1.house]}.`,
      text: `Your sense of command and leadership works through ${HOUSE_SELF[su.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `Sun ${cardDetail(su.d1)}`,
      certainty: 'fact',
      evidence: su.evidence,
    });
  }

  if (gl?.house != null || hl?.house != null || sl?.house != null || h10) {
    const seatH = gl?.house ?? hl?.house ?? l10?.d1.house ?? 10;
    const argPrimary = (h10?.argala?.primary ?? []).filter((p) => PLANET_FACULTY[p]);
    const argObs = (h10?.argala?.obstructed ?? []).filter((p) => PLANET_FACULTY[p]);
    const argNote = argPrimary.length ? `, backed by ${faculties(argPrimary.slice(0, 2))}` : '';
    const ev = [
      ...(gl ? ['point:D1.GL'] : []),
      ...(hl ? ['point:D1.HL'] : []),
      ...(sl ? ['point:D1.SL'] : []),
      ...(h10 ? ['house:D1.h10'] : []),
    ];
    if (ev.length) {
      claims.push({
        id: 'standing.special_lagnas',
        line: `Influence and recognition gather for you in ${HOUSE_SHORT[seatH]}.`,
        text: `Recognition and institutional weight gather for you through ${HOUSE_SELF[seatH]}${sl?.house != null && sl.house !== seatH ? `, while prosperity backs you through ${HOUSE_SHORT[sl.house]}` : ''}${argNote}.`,
        detail: `Ghatika Lagna GL in h${gl?.house ?? '?'} ${gl?.sign ?? '?'}; Hora Lagna HL in h${hl?.house ?? '?'} ${hl?.sign ?? '?'}; Sree Lagna SL in h${sl?.house ?? '?'} ${sl?.sign ?? '?'}; D1 h10 SAV=${h10?.sav ?? 'n/a'}, argala primary=[${argPrimary.map(pname).join(', ')}], obstructed=[${argObs.map(pname).join(', ')}]`,
        certainty: 'fact',
        evidence: ev,
      });
    }
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function groundPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h6 = houseFrame(view, 'D1', 6, g);
  const h3 = houseFrame(view, 'D1', 3, g);
  const h7 = houseFrame(view, 'D1', 7, g);
  const h12 = houseFrame(view, 'D1', 12, g);
  const d10h6 = houseFrame(view, 'D10', 6, g);
  const d10h3 = houseFrame(view, 'D10', 3, g);
  const d10h7 = houseFrame(view, 'D10', 7, g);
  const l6 = planetChain(view, h6?.lord ?? null, g);
  const l3 = planetChain(view, h3?.lord ?? null, g);
  const sa = planetChain(view, 'Sa', g);
  const ma = planetChain(view, 'Ma', g);
  const a6 = pointOf(view, 'D1', 'A6', g);
  const a3 = pointOf(view, 'D1', 'A3', g);

  let lead = '';
  if (h6 && l6 && l6.d1.house != null) {
    const sw = stateWords(l6.d1);
    lead = `On the ground, your daily work runs through ${HOUSE_SHORT[l6.d1.house]}.`;
    claims.push({
      id: 'ground.daily_work',
      line: `Day-to-day execution runs through ${HOUSE_SHORT[l6.d1.house]}.`,
      text: `Your day-to-day workload, service and problem-solving are steered from ${HOUSE_SELF[l6.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h6 ${h6.sign ?? '?'} lord ${cardDetail(l6.d1)}; SAV=${h6.sav ?? 'n/a'}${d10h6 ? `; D10 h6 ${d10h6.sign ?? '?'} lord ${pname(d10h6.lord)} in D10 h${d10h6.lordHouse ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h6', ...l6.evidence, ...(d10h6 ? ['house:D10.h6'] : [])],
    });
  }

  const sob = serviceOrBusinessClaim(d10h6, d10h7);
  if (sob) claims.push(sob);
  else g.add('ground.service_or_business withheld: D10 h6/h7 cards missing');

  if (h3 && l3 && l3.d1.house != null) {
    claims.push({
      id: 'ground.initiative',
      line: `Your own initiative pushes through ${HOUSE_SHORT[l3.d1.house]}.`,
      text: `When you push something forward by your own hand, that initiative works through ${HOUSE_SELF[l3.d1.house]}${a3?.house != null ? `, showing outwardly in ${HOUSE_SHORT[a3.house]}` : ''}.`,
      detail: `D1 h3 ${h3.sign ?? '?'} lord ${cardDetail(l3.d1)}${a3 ? `; Vikrama Pada A3 in h${a3.house ?? '?'} ${a3.sign ?? '?'}` : ''}${d10h3 ? `; D10 h3 ${d10h3.sign ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h3', ...l3.evidence, ...(a3 ? ['point:D1.A3'] : []), ...(d10h3 ? ['house:D10.h3'] : [])],
    });
  }

  if (h7 && h7.lordHouse != null) {
    const h12Note = h12?.lordHouse != null ? `, while transitions and distant dealings move through ${HOUSE_SHORT[h12.lordHouse]}` : '';
    claims.push({
      id: 'ground.counterparts',
      line: `Clients and counterparts meet you in ${HOUSE_SHORT[h7.lordHouse]}.`,
      text: `Clients, counterparts and professional agreements meet you through ${HOUSE_SELF[h7.lordHouse]}${h12Note}.`,
      detail: `D1 h7 ${h7.sign ?? '?'} lord ${pname(h7.lord)} in h${h7.lordHouse}; D1 h12 lord ${pname(h12?.lord)} in h${h12?.lordHouse ?? '?'}`,
      certainty: 'fact',
      evidence: ['house:D1.h7', ...(h12 ? ['house:D1.h12'] : [])],
    });
  }

  if (sa && sa.d1.house != null) {
    const sw = stateWords(sa.d1);
    const maNote = ma?.d1.house != null ? `, while competitive drive pushes from ${HOUSE_SHORT[ma.d1.house]}` : '';
    claims.push({
      id: 'ground.stamina',
      line: `Under pressure, your stamina holds through ${HOUSE_SHORT[sa.d1.house]}.`,
      text: `Your endurance for long, demanding work is anchored in ${HOUSE_SELF[sa.d1.house]}${maNote}.${sw ? ` ${sw}` : ''}`,
      detail: `Saturn ${cardDetail(sa.d1)}${ma ? `; Mars ${cardDetail(ma.d1)}` : ''}${a6 ? `; Rogapada A6 in h${a6.house ?? '?'} ${a6.sign ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: [...sa.evidence, ...(ma ? ma.evidence : []), ...(a6 ? ['point:D1.A6'] : [])],
    });
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function gainPanel({ view }: PanelInput): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const h11 = houseFrame(view, 'D1', 11, g);
  const h2 = houseFrame(view, 'D1', 2, g);
  const h10 = houseFrame(view, 'D1', 10, g);
  const d2h1 = view.house('D2', 1);
  const d10h11 = houseFrame(view, 'D10', 11, g);
  const h12 = houseFrame(view, 'D1', 12, g);
  const l11 = planetChain(view, h11?.lord ?? null, g);
  const l2 = planetChain(view, h2?.lord ?? null, g);
  const a11 = pointOf(view, 'D1', 'A11', g);
  const a2 = pointOf(view, 'D1', 'A2', g);
  const il = view.points('D1').find((p) => p.id === 'IL');

  let lead = '';
  if (h11 && l11 && l11.d1.house != null) {
    const sw = stateWords(l11.d1);
    lead = `Your work pays back through ${HOUSE_SHORT[l11.d1.house]}.`;
    claims.push({
      id: 'gain.income',
      line: `Returns from your work come through ${HOUSE_SHORT[l11.d1.house]}.`,
      text: `Gains, professional returns and the network that backs you flow from ${HOUSE_SELF[l11.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h11 ${h11.sign ?? '?'} lord ${cardDetail(l11.d1)}; SAV=${h11.sav ?? 'n/a'}${d10h11 ? `; D10 h11 ${d10h11.sign ?? '?'} lord ${pname(d10h11.lord)} in D10 h${d10h11.lordHouse ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h11', ...l11.evidence, ...(d10h11 ? ['house:D10.h11'] : [])],
    });
  }

  if (h2 && l2 && l2.d1.house != null) {
    const sw = stateWords(l2.d1);
    claims.push({
      id: 'gain.treasury',
      line: `What you keep and build rests on ${HOUSE_SHORT[l2.d1.house]}.`,
      text: `How you store value, price your skill and build reserves rests on ${HOUSE_SELF[l2.d1.house]}.${sw ? ` ${sw}` : ''}`,
      detail: `D1 h2 ${h2.sign ?? '?'} lord ${cardDetail(l2.d1)}; SAV=${h2.sav ?? 'n/a'}${a2 ? `; Dhanapada A2 in h${a2.house ?? '?'} ${a2.sign ?? '?'}` : ''}${d2h1 ? `; D2 h1 ${d2h1.sign ?? '?'}` : ''}`,
      certainty: 'fact',
      evidence: ['house:D1.h2', ...l2.evidence, ...(a2 ? ['point:D1.A2'] : []), ...(d2h1 ? ['house:D2.h1'] : [])],
    });
  }

  if (a11 && a11.house != null) {
    const ilNote = il?.house != null && il.house !== a11.house ? `, while wealth capacity gathers in ${HOUSE_SHORT[il.house]}` : '';
    claims.push({
      id: 'gain.labhapada',
      line: `Tangible gains arrive through ${HOUSE_SHORT[a11.house]}.`,
      text: `In practical terms, tangible payoffs and inflows arrive through ${HOUSE_SELF[a11.house]}${ilNote}.`,
      detail: `Labhapada (A11) in D1 h${a11.house} ${a11.sign ?? '?'}, lord ${pname(a11.lord)} (h${a11.lordHouse ?? '?'})${il ? `; Indu Lagna (IL) in D1 h${il.house ?? '?'} ${il.sign ?? '?'} (lord ${pname(il.lord)})` : ''}`,
      certainty: 'fact',
      evidence: ['point:D1.A11', ...(il ? ['point:D1.IL'] : [])],
    });
  }

  const sav = savBalanceClaim(h10, h11, h12);
  if (sav) claims.push(sav);

  const workLords = [h10?.lord, h11?.lord, h2?.lord].filter((x): x is string => !!x);
  const wealthYogas = yogasTouching(view, workLords, [2, 10, 11]).filter((y) => yogaClassWords(y.class).kind === 'gift');
  if (wealthYogas.length) {
    const top = wealthYogas[0]!;
    const yw = yogaClassWords(top.class);
    claims.push({
      id: 'gain.combinations',
      line: `Your chart carries ${yw.words} linking work and reward.`,
      text: `Your chart carries ${yw.words}, joining ${faculties(top.planets)} across ${housesShort(top.houses.length ? top.houses : [10, 11])}.`,
      detail: `${top.name} (${top.class}): planets [${top.planets.map(pname).join(', ')}], houses [${top.houses.join(', ')}]; SAV H10=${h10?.sav ?? '?'}, H11=${h11?.sav ?? '?'}, H2=${h2?.sav ?? '?'}`,
      certainty: 'fact',
      evidence: [`yoga:D1.${top.id}`, ...(h10 ? ['house:D1.h10'] : [])],
    });
  }

  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

const ordinal = (n: number | null): string =>
  n == null ? '?' : `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export function workChaptersPanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const spine = mdSpine(activation, clock.system, asOf);
  if (!spine.running) {
    g.add(`activation:${clock.system} level 1 covering ${asOf} missing`);
    return body('', [], g, { chapters: [] });
  }
  const a10 = view.points('D1').find((p) => p.id === 'A10');
  const al = view.points('D1').find((p) => p.id === 'AL');
  const l10 = view.house('D1', 10)?.lord ?? null;
  const amk = pointOf(view, 'D1', 'AmK', g)?.planet ?? null;
  const workPlanets = new Set([l10, amk, 'Sa', 'Su', 'Me', 'Ju'].filter((x): x is string => !!x));
  const resolveLord = (r: ActivationRow | null | undefined): string | null =>
    r?.lord ?? (r?.sign ? view.houses('D1').find((h) => h.sign === r.sign)?.lord ?? null : null);
  const who = (r: ActivationRow) => r.lord ?? r.sign ?? '?';
  const pickWorkHouses = (houses: readonly number[]): number[] => {
    const filtered = houses.filter((h) => WORK_HOUSES.includes(h));
    return filtered.length ? filtered : [...houses];
  };
  const carried = (r: ActivationRow): { text: string; detail: string; evidence: string[] } => {
    const effLord = resolveLord(r);
    if (!r.lord) {
      const signNote =
        (a10?.sign && r.sign === a10.sign ? '; holds Rajyapada (A10)' : '') +
        (al?.sign && r.sign === al.sign ? '; holds Arudha Lagna (AL)' : '') +
        (effLord && workPlanets.has(effLord) ? `; ruled by work karaka/lord ${pname(effLord)}` : '');
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
    const roleNote = workPlanets.has(r.lord) ? ' (key work factor)' : '';
    return {
      text: ` In work, it is carried by ${PLANET_FACULTY[r.lord]}, placed in ${HOUSE_SHORT[c.house]}.`,
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
    const workH = pickWorkHouses(r.houses);
    const houses = housesShort(workH);
    const base =
      kind === 'previous'
        ? `From ${longDate(r.from)} to ${longDate(r.to)} your work was shaped by ${houses}.`
        : kind === 'running'
          ? `From ${longDate(r.from)} to ${longDate(r.to)} your work life is organised around ${houses}.`
          : `From ${longDate(r.from)} your work moves into a chapter of ${houses}.`;
    return {
      kind,
      lord: who(r),
      lordLabel: r.lord ? pname(r.lord) : (r.sign ?? '?'),
      from: r.from,
      to: r.to,
      text: certainty === 'split' || !houses ? null : base + ch.text,
      detail: `${clock.label} level 1 ${r.lord ? pname(r.lord) : r.sign} ${r.from} → ${r.to}; work houses ${workH.join(', ') || '—'} (all houses ${r.houses.join(', ') || '—'})${ch.detail ? `; ${ch.detail}` : ''}; confirming: ${confirmDetail(conf) || 'none'}`,
      certainty,
      houses: workH,
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
    const subWorkH = pickWorkHouses(sub.houses);
    const parallelClocks = allRunningDashas(activation, asOf, clock.system)
      .filter((s) => s.system !== clock.system && (s.l1 || s.l2))
      .map((s) => `${clockLabel(s.system)}: ${s.l1 ? `${s.l1.lord ? pname(s.l1.lord) : s.l1.sign}(${s.l1.from}→${s.l1.to})` : ''}${s.l2 ? `/${s.l2.lord ? pname(s.l2.lord) : s.l2.sign}(${s.l2.from}→${s.l2.to})` : ''}`);
    running.sub = {
      lord: sub.lord ?? sub.sign ?? '?',
      lordLabel: sub.lord ? pname(sub.lord) : (sub.sign ?? '?'),
      from: sub.from,
      to: sub.to,
      text: `Since ${longDate(sub.from)} and until ${longDate(sub.to)}, what presses at work is ${housesShort(subWorkH)}.${flavour}`,
      detail: `${clockLabel(clock.system)} level 2 ${sub.lord ? pname(sub.lord) : sub.sign} ${sub.from} → ${sub.to}; activates work houses ${subWorkH.join(', ')}${cell ? `; fruition from ${pname(mdLord)}: ${ordinal(cell.houseFromMd)} from the main lord, ${cell.fruitionClass}${cell.isDwirdwadasha212 ? ', 2/12' : ''}${cell.isShadAshtaka68 ? ', 6/8' : ''}` : ''}${parallelClocks.length ? `; all parallel clocks (${parallelClocks.length}): ${parallelClocks.join('; ')}` : ''}`,
      houses: subWorkH,
    };
    running.evidence.push(activationKey(sub));
  } else g.add(`activation:${clock.system} level 2 covering ${asOf} missing`);
  if (spine.nextSub && (spine.nextSub.lord || spine.nextSub.sign)) {
    running.nextSub = {
      lord: spine.nextSub.lord ?? spine.nextSub.sign ?? '?',
      lordLabel: spine.nextSub.lord ? pname(spine.nextSub.lord) : (spine.nextSub.sign ?? '?'),
      from: spine.nextSub.from,
      to: spine.nextSub.to,
      houses: pickWorkHouses(spine.nextSub.houses),
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
        ? `From ${monthYear(c.from)} to ${monthYear(c.to)} ${whoOf(c)} shaped work, through ${housesWord(c.houses)}.`
        : c.kind === 'running'
          ? `From ${monthYear(c.from)} to ${monthYear(c.to)} ${whoOf(c)} leads work, through ${housesWord(c.houses)}.`
          : `From ${monthYear(c.from)} ${whoOf(c)} leads work, through ${housesWord(c.houses)}.`;
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
      line: `Until ${longDate(running.sub.to)} the pressure at work is on ${housesWord(running.sub.houses)}.`,
      range: { from: running.sub.from, to: running.sub.to },
      detail: running.sub.detail,
      certainty: running.certainty,
      evidence: running.evidence.slice(-1),
    });
  }
  const lead = `In your work, you are in the chapter of ${housesShort(running.houses)}, until ${longDate(spine.running.to)}.`;
  return body(lead, claims, g, { chapters });
}

export function workStrugglePanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const out: Array<SelfClaim & { planet: string | null }> = [];
  const card = (p: string): PlanetCard | null => view.planet('D1', p);
  const isMalefic = (p: string) => {
    const c = card(p);
    return !!c && /malefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '');
  };
  const dusthana = (h: number | null | undefined) => (h ? (view.house('D1', h)?.class ?? []).includes('dusthana') : false);

  const h10 = houseFrame(view, 'D1', 10, g);
  const h6 = houseFrame(view, 'D1', 6, g);
  const h11 = houseFrame(view, 'D1', 11, g);
  const l10 = h10?.lord ?? null;
  const l6 = h6?.lord ?? null;
  const amk = view.points('D1').find((p) => p.id === 'AmK')?.planet ?? null;
  const l10Chain = planetChain(view, l10, g);

  if (l10Chain && dusthana(l10Chain.d1.house)) {
    out.push({
      id: 'struggle.lord_dusthana',
      planet: l10Chain.planet,
      line: 'What steers your work sits in a demanding place.',
      text: `What steers your work and standing sits in a demanding place: ${HOUSE_SELF[l10Chain.d1.house!]}.`,
      detail: `D1 h10 lord ${cardDetail(l10Chain.d1)}; D1 h${l10Chain.d1.house} class dusthana`,
      certainty: 'fact',
      evidence: ['house:D1.h10', ...l10Chain.evidence],
    });
  }

  for (const p of [...new Set([l10, l6, 'Sa', amk, 'Su'].filter((x): x is string => !!x))]) {
    const c = card(p);
    if (!c || !PLANET_FACULTY[p]) continue;
    if (/debil/i.test(c.dignity ?? '')) {
      const lifted = hasCancellation(view, p);
      out.push({
        id: `struggle.weak_${p}`,
        planet: p,
        line: `What carries ${PLANET_SHORT[p] ?? ''} at work is strained by birth${lifted ? ', lifted over time' : ''}.`,
        text: `In your work, what carries ${PLANET_FACULTY[p]} is at its weakest by birth${lifted ? ', and a cancellation in your chart lifts it over time' : ''}.`,
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
        line: `What carries ${PLANET_SHORT[p] ?? ''} at work ${RIPENESS_SHORT[rip] ?? RIPENESS_WORDS[rip]}.`,
        text: `In your work, what carries ${PLANET_FACULTY[p]} ${RIPENESS_WORDS[rip]}.`,
        detail: `${pname(p)} avasthas ${JSON.stringify(c.avasthas)}; delivery ${rip} ×${c.avasthaMultipliers?.effective}`,
        certainty: 'fact',
        evidence: [`planet:D1.${p}`],
      });
    }
  }

  if (h10) {
    for (const p of [...h10.occupants.map((o) => o.planet), ...h10.aspectedGraha]) {
      if (p === l10 || !isMalefic(p) || !PLANET_FACULTY[p]) continue;
      const on = h10.occupants.some((o) => o.planet === p) ? 'sits in' : 'weighs on';
      out.push({
        id: `struggle.on_work_${p}`,
        planet: p,
        line: `What carries ${PLANET_SHORT[p] ?? ''} weighs on your work and standing.`,
        text: `What carries ${PLANET_FACULTY[p]} ${on} your work and standing and asks for steadiness.`,
        detail: `${pname(p)} ${on === 'sits in' ? 'occupies' : 'aspects'} D1 h10; natural and functional malefic`,
        certainty: 'fact',
        evidence: ['house:D1.h10', `planet:D1.${p}`],
      });
    }
  }

  if (h6 && dusthana(h6.lordHouse)) {
    out.push({
      id: 'struggle.service_strain',
      planet: h6.lord,
      line: 'Daily workload and service carry extra friction.',
      text: `Your daily workload and service run through ${HOUSE_SELF[h6.lordHouse!]}, which adds friction to routine execution.`,
      detail: `D1 h6 lord ${pname(h6.lord)} in h${h6.lordHouse} (dusthana)`,
      certainty: 'fact',
      evidence: ['house:D1.h6'],
    });
  }

  if (h11 && dusthana(h11.lordHouse)) {
    out.push({
      id: 'struggle.gain_delay',
      planet: h11.lord,
      line: 'Professional returns take patience to collect.',
      text: `Your gains and professional returns run through ${HOUSE_SELF[h11.lordHouse!]}, asking for patience before payoffs settle.`,
      detail: `D1 h11 lord ${pname(h11.lord)} in h${h11.lordHouse} (dusthana)`,
      certainty: 'fact',
      evidence: ['house:D1.h11'],
    });
  }

  if (out.length === 0 && h6 && h6.lordHouse != null && HOUSE_SELF[h6.lordHouse]) {
    out.push({
      id: 'struggle.service_load',
      planet: h6.lord,
      line: `Daily workload pulls energy toward ${HOUSE_SHORT[h6.lordHouse] ?? HOUSE_SELF[h6.lordHouse]}.`,
      text: `The daily problem-solving and competitive load of your work pulls your energy into ${HOUSE_SELF[h6.lordHouse]}.`,
      detail: `D1 h6 lord ${pname(h6.lord)} in h${h6.lordHouse}`,
      certainty: 'fact',
      evidence: ['house:D1.h6'],
    });
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

export function workYearPanel({ view, asOf }: PanelInput): PanelBody {
  const yearRange = (r: { from: string; to: string } | null) => r ?? ('always' as const);
  const g = gaps();
  const claims: SelfClaim[] = [];
  // the year is the Tithi Pravesha chart whose return moment has passed (doc 66 §4.10); Varsha (Mudda) only confirms
  const run = runningTithiPravesha(view, asOf);
  for (const x of run.gaps) g.add(x);
  const tp = run.row;
  const m = run.varsha;
  if (!tp || run.year == null) {
    g.add(`annual:TP covering ${asOf} missing`);
    return body('', [], g);
  }
  const tpYear = run.year;
  const l10 = view.house('D1', 10)?.lord ?? 'Sa';
  const span = run.from && run.to ? { from: run.from, to: run.to } : null;
  const ta = run.shortClock;
  const workSahams = [...(tp?.sahams ?? []), ...(m?.row.sahams ?? [])].filter((s) =>
    /karma|rajya|artha|labha|vyapara|yasas/i.test(s.name),
  );
  const sahamNote = workSahams.length
    ? `; sahams ${workSahams.map((s) => `${s.name} in ${s.sign ?? '?'} h${s.house ?? '?'}`).join(', ')}`
    : '';
  let lead = '';
  {
    const atL10 = l10 ? tp.houses.find((h) => h.occupants.some((o) => o.planet === l10)) : undefined;
    const occL10 = atL10?.occupants.find((o) => o.planet === l10);
    if (atL10 && occL10) {
      const dw = dignityWords(occL10.dignity);
      claims.push({
        id: 'year.lord_place',
        line: `This year's chart puts your work factor in ${HOUSE_SHORT[atL10.house]}${dw ? `, ${dw}` : ''}.`,
        text: `This year's chart puts what steers your work in ${HOUSE_SELF[atL10.house]}${dw ? `, ${dw}` : ''}.`,
        detail: `TP${tpYear} lagna ${tp.lagna}; natal 10th lord ${pname(l10)} in year h${atL10.house} ${atL10.sign} (${occL10.dignity ?? '?'})${sahamNote}`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
      lead = `This year your chart puts what steers your work in ${HOUSE_SHORT[atL10.house]}.`;
    }
    const atSa = tp.houses.find((h) => h.occupants.some((o) => o.planet === 'Sa'));
    const occSa = atSa?.occupants.find((o) => o.planet === 'Sa');
    if (atSa && occSa && atSa.house !== atL10?.house) {
      const dw = dignityWords(occSa.dignity);
      claims.push({
        id: 'year.lord_company',
        line: `Discipline and execution this year focus on ${HOUSE_SHORT[atSa.house]}.`,
        text: `This year your discipline and endurance focus on ${HOUSE_SELF[atSa.house]}${dw ? `, ${dw}` : ''}.`,
        detail: `TP${tpYear} Saturn in year h${atSa.house} ${atSa.sign} (${occSa.dignity ?? '?'})`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
    }
    const y10 = tp.houses.find((h) => h.house === 10);
    const y6 = tp.houses.find((h) => h.house === 6);
    const y11 = tp.houses.find((h) => h.house === 11);
    if (y10?.lordHouse || y6?.lordHouse || y11?.lordHouse) {
      const targetH = y10?.lordHouse ?? y11?.lordHouse ?? y6?.lordHouse ?? 10;
      const y11Note = y11?.lordHouse && y11.lordHouse !== targetH ? `, while returns gather through ${HOUSE_SHORT[y11.lordHouse]}` : '';
      claims.push({
        id: 'year.self_lord',
        line: `This year your standing is steered from ${HOUSE_SHORT[targetH]}.`,
        text: `This year your work and standing are steered from ${HOUSE_SELF[targetH]}${y11Note}.`,
        detail: `TP${tpYear} h10 ${y10?.sign ?? '?'}, lord ${pname(y10?.lord)} in year h${y10?.lordHouse ?? '?'} (${y10?.lordDignity ?? '?'}); h6 lord ${pname(y6?.lord)} in h${y6?.lordHouse ?? '?'}; h11 lord ${pname(y11?.lord)} in h${y11?.lordHouse ?? '?'}${sahamNote}`,
        certainty: 'fact',
        evidence: [`annual:TP${tpYear}.D1`],
      });
    }
  }
  for (const c of claims) c.range = yearRange(span);
  // the year's short clock is the TP year dasha period (bounded to the year by the engine); Mudda only confirms
  const shortClock = ta;
  if (shortClock && PLANET_FACULTY[shortClock.lord]) {
    const evKey = `annual:TP${tpYear}.D1`;
    claims.push({
      id: 'year.short_clock',
      range: { from: shortClock.from, to: shortClock.to },
      line: `Until ${longDate(shortClock.to)} the year's short clock runs through ${PLANET_SHORT[shortClock.lord] ?? 'this period'}.`,
      text: `Until ${longDate(shortClock.to)} the year's short clock at work runs through ${PLANET_FACULTY[shortClock.lord]}.`,
      detail: `TP${tpYear} ${shortClock.system} ${pname(shortClock.lord)} ${shortClock.from} → ${shortClock.to}${m ? `; confirming VP${m.row.year} Mudda ${pname(m.lord)} ${m.from} → ${m.to}` : ''}${sahamNote}`,
      certainty: 'fact',
      evidence: [evKey, ...(m ? [`annual:VP${m.row.year}.D1`] : [])],
    });
  }
  return body(lead || (claims[0]?.text ?? ''), claims, g);
}

export function workDiagnosisPanel(b: Partial<Record<BoardPanelId, PanelBody>>): PanelBody {
  const g = gaps();
  const claims: SelfClaim[] = [];
  const vocClaim = b.vocation?.claims[0];
  const standClaim = b.standing?.claims[0];
  if (vocClaim || standClaim) {
    const primary = vocClaim ?? standClaim!;
    const secondary = vocClaim && standClaim ? standClaim : undefined;
    const leadLine = b.vocation?.lead || b.standing?.lead || primary.line || primary.text;
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
    g.add('work vocation/standing panels have no direction claim');
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
    g.add('no work struggle claim to name a tension');
  }

  const running = b.chapters?.chapters?.find((c) => c.kind === 'running');
  if (running) {
    const now =
      running.certainty === 'split'
        ? `Your clocks do not agree on the work chapter you are in; your reading clock dates it ${longDate(running.from)} to ${longDate(running.to)}.`
        : `In your work, you are in a chapter of ${housesShort(running.houses)} that runs to ${longDate(running.to)}${running.sub ? `; since ${longDate(running.sub.from)}, what presses is ${housesShort(running.sub.houses)}` : ''}.`;
    const nowLine =
      running.certainty === 'split'
        ? undefined
        : running.sub
          ? `Until ${longDate(running.sub.to)} the pressure at work is on ${housesWord(running.sub.houses)}, inside a chapter of ${housesWord(running.houses, 2)}.`
          : `Until ${longDate(running.to)} your work is in a chapter of ${housesWord(running.houses)}.`;
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
    g.add('work chapters panel has no running chapter');
  }

  return body(claims[0]?.text ?? '', claims, g);
}
