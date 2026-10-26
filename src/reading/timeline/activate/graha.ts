/**
 * The graha period-lord rule shared by S1 Vimshottari, S2 Yogini and S3 Tithi Ashtottari (docs/reading-engine/27 §A.3).
 * A rule on read fields only: which houses the lord owns and sits in (`houses.*.lord`, `bodies.<P>.house`), its star
 * lord's houses (the kp_starlord rule), the marker's arudhas it sits on or aspects by rasi drishti
 * (`bodies.<P>.aspects_to.rasi`), and the markers it is karaka of (`karakas.natural`, `karakas.chara`).
 *
 * Strength: 3 when the lord is the marker's primary-house lord or its karaka and in dignity (exalted/own/moolatrikona);
 * 2 when it owns or occupies the primary frame house, is a karaka, or sits on a frame arudha; owning or occupying another
 * frame house gives `rules.secondaryHouseStrength` (default 2 as doc 27 says; a knob, see config.ts); 1 by star lord or
 * rasi aspect only.
 * AD-from-MD (and PD-from-AD) in 6/8/12 lowers by one; an MD running under a finer level counts one lower too (the finer
 * lord leads). A lord in a dusthana or debilitated makes the activation adverse (polarity -1). For a marker with
 * adverse houses (money: 6/8/12), owning or occupying one is an adverse activation of strength 2.
 */
import type { PlanetCode } from '../../facts/constants.js';
import { DUSTHANAS, houseFrom, pointOf, type Foundation } from '../foundation.js';
import { MARKERS, MARKER_IDS, type MarkerId } from '../markers.js';
import type { Polarity } from '../types.js';

export interface GrahaHit {
  marker: MarkerId;
  strength: number;
  polarity: Polarity;
  evidence: string[];
}

export interface GrahaContext {
  /** 1 MD, 2 AD, 3 PD */
  level: 1 | 2 | 3;
  /** The enclosing period's lord (AD -> MD, PD -> AD) */
  parentLord: PlanetCode | null;
  /** A finer level runs under this one (MD under AD): count one lower */
  hasFinerLevel: boolean;
  /** S2: periods of these planets (Ulka Sa, Sankata Ra) make the markers they rule adverse */
  adverseRulers?: ReadonlySet<PlanetCode>;
  /** Strength for owning/occupying a frame house other than the primary one (config `rules`) */
  secondaryHouseStrength: number;
}

const isDusthana = (h: number): boolean => (DUSTHANAS as readonly number[]).includes(h);

/** Activations of every marker by one period lord. Empty when the lord is not in the dossier. */
export function grahaActivations(f: Foundation, lord: PlanetCode, ctx: GrahaContext): GrahaHit[] {
  const p = f.planets[lord];
  if (!p) return [];
  const out: GrahaHit[] = [];
  const parent = ctx.parentLord ? f.planets[ctx.parentLord] : undefined;
  const fromParent = parent ? houseFrom(parent.house, p.house) : null;
  const levelDrop = (ctx.hasFinerLevel ? 1 : 0) + (fromParent != null && isDusthana(fromParent) ? 1 : 0);
  const levelEvidence = fromParent != null && isDusthana(fromParent) ? [`bodies.${ctx.parentLord}.house`, `bodies.${lord}.house`] : [];
  const adverseLord = isDusthana(p.house) || p.debilitated;
  const sl = p.starLord ? f.planets[p.starLord] : undefined;

  for (const id of MARKER_IDS) {
    const m = MARKERS[id];
    let strength = 0;
    const ev: string[] = [];
    let ruled = false;
    const bump = (s: number, ...paths: string[]): void => {
      strength = Math.max(strength, s);
      ev.push(...paths);
    };
    const houseStrength = (h: number): number => (h === m.houses[0] ? 2 : ctx.secondaryHouseStrength);
    const ownsFrame = p.owns.filter((h) => m.houses.includes(h));
    if (ownsFrame.length) {
      ruled = true;
      for (const h of ownsFrame) bump(houseStrength(h), `houses.${h}.lord`);
    }
    if (m.houses.includes(p.house)) bump(houseStrength(p.house), `bodies.${lord}.house`);
    const natural = m.karakas.includes(lord);
    const chara = m.charaKarakas.filter((k) => f.chara[k] === lord);
    if (natural) bump(2, `karakas.natural.${lord}`);
    for (const k of chara) bump(2, `karakas.chara.${k}`);
    if (p.strongDignity && (p.owns.includes(m.houses[0]!) || natural || chara.length)) bump(3, `bodies.${lord}.dignity`);
    if (sl && (sl.owns.some((h) => m.houses.includes(h)) || m.houses.includes(sl.house))) bump(1, `bodies.${lord}.star_lord`, `bodies.${p.starLord}.house`);
    for (const key of [...m.arudhas, ...m.specialLagnas]) {
      const pt = pointOf(f, key);
      if (!pt) continue;
      if (pt.point.house === p.house) bump(2, `${pt.path}.house`, `bodies.${lord}.house`);
      else if (p.rasiAspects.includes(pt.point.house)) bump(1, `${pt.path}.house`, `bodies.${lord}.aspects_to.rasi`);
    }
    const s = strength - levelDrop;
    if (s > 0) {
      const adverse = adverseLord || (ruled && ctx.adverseRulers?.has(lord) === true);
      const why = adverseLord ? [isDusthana(p.house) ? `bodies.${lord}.house` : `bodies.${lord}.dignity`] : [];
      out.push({ marker: id, strength: s, polarity: adverse ? -1 : 1, evidence: [...new Set([...ev, ...levelEvidence, ...why])] });
    }

    const adverseHouses = m.adverseHouses.filter((h) => p.owns.includes(h) || p.house === h);
    const sa = 2 - levelDrop;
    if (adverseHouses.length && sa > 0) {
      out.push({ marker: id, strength: sa, polarity: -1, evidence: adverseHouses.map((h) => (p.house === h ? `bodies.${lord}.house` : `houses.${h}.lord`)) });
    }
  }
  return out;
}
