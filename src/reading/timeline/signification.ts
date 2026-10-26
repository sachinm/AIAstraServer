/**
 * The signification table (docs/reading-engine/29 §3.1): which markers each planet *specifically* signifies in this
 * chart, 0-3, built once from the foundation. Rules on read fields only, each entry with the dossier paths it read.
 *
 * - 3: lords the marker's primary house (`houses.<h1>.lord`, co-lord included), or is its natural karaka in dignity
 *   (exalted/own/moolatrikona), or is the chara karaka the frame names (`karakas.chara.<k>`).
 * - 2: occupies the primary house, is the natural karaka not in dignity, or is the dispositor of the primary lord.
 * - 1: lords or occupies a secondary frame house, or sits on the marker's arudha / special lagna.
 * - 0: everything else; star-lord-only and aspect-only links are modifiers, not significations.
 *
 * Adverse (`adv`): a planet in a dusthana or debilitated signifies the markers it gets through *lordship* adversely
 * (the entry moves from `sig` to `adv`); for a marker with adverse houses (money: 6/8/12) lording one gives adv 2,
 * occupying one adv 1. Both tables are capped: a planet keeps its `cap` strongest markers (ties: the primary-house rule
 * first, then the natural karaka, then the marker with the fewest other significators, then the marker table's order).
 * The cap is what makes the grid selective; the scarcity tie-break keeps every marker signified (without it, G1's
 * Jupiter, lord of the 4th and 7th, is primary for five markers and education is left with no significator at all).
 */
import { PLANET_CODES, type PlanetCode } from '../facts/constants.js';
import { DUSTHANAS, pointOf, type Foundation } from './foundation.js';
import { MARKERS, MARKER_IDS, type MarkerId } from './markers.js';

export interface SigEntry {
  value: number;
  /** true when the value comes through the primary house (lordship or occupation) */
  primary: boolean;
  natural: boolean;
  evidence: string[];
}

export type SigTable = Partial<Record<PlanetCode, Partial<Record<MarkerId, SigEntry>>>>;

export interface Signification {
  sig: SigTable;
  adv: SigTable;
  cap: number;
}

const isDusthana = (h: number): boolean => (DUSTHANAS as readonly number[]).includes(h);

/** `scarcity[m]` = how many planets signify m at 2+ before the cap; fewer wins a tie, so no marker is left without one */
function cap(entries: Partial<Record<MarkerId, SigEntry>>, n: number, scarcity: Record<string, number>): Partial<Record<MarkerId, SigEntry>> {
  const ranked = MARKER_IDS.filter((m) => (entries[m]?.value ?? 0) > 0).sort((a, b) => {
    const x = entries[a]!;
    const y = entries[b]!;
    return y.value - x.value || Number(y.primary) - Number(x.primary) || Number(y.natural) - Number(x.natural) || (scarcity[a] ?? 0) - (scarcity[b] ?? 0) || MARKER_IDS.indexOf(a) - MARKER_IDS.indexOf(b);
  });
  return Object.fromEntries(ranked.slice(0, n).map((m) => [m, entries[m]!])) as Partial<Record<MarkerId, SigEntry>>;
}

export function buildSignification(f: Foundation, capN = 3): Signification {
  const sig: SigTable = {};
  const adv: SigTable = {};
  for (const p of PLANET_CODES) {
    const card = f.planets[p];
    if (!card) continue;
    const afflicted = isDusthana(card.house) || card.debilitated;
    const s: Partial<Record<MarkerId, SigEntry>> = {};
    const a: Partial<Record<MarkerId, SigEntry>> = {};
    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      const h1 = m.houses[0]!;
      let best: SigEntry = { value: 0, primary: false, natural: false, evidence: [] };
      let viaLordship = false;
      const take = (value: number, primary: boolean, natural: boolean, lordship: boolean, ...evidence: string[]): void => {
        if (value > best.value || (value === best.value && primary && !best.primary)) {
          best = { value, primary, natural, evidence };
          viaLordship = lordship;
        }
      };
      const natural = m.karakas.includes(p);
      const chara = m.charaKarakas.find((k) => f.chara[k] === p);
      if (card.owns.includes(h1)) take(3, true, false, true, `houses.${h1}.lord`);
      if (natural && card.strongDignity) take(3, false, true, false, `karakas.natural.${p}`, `bodies.${p}.dignity`);
      if (chara) take(3, false, false, false, `karakas.chara.${chara}`);
      if (card.house === h1) take(2, true, false, false, `bodies.${p}.house`);
      if (natural) take(2, false, true, false, `karakas.natural.${p}`);
      const h1Lord = f.houses[h1]?.lord;
      if (h1Lord && f.planets[h1Lord]?.signLord === p) take(2, false, false, false, `houses.${h1}.lord`, `bodies.${h1Lord}.sign_lord`);
      const secondary = m.houses.slice(1);
      const ownsSecondary = card.owns.filter((h) => secondary.includes(h));
      if (ownsSecondary.length) take(1, false, false, true, ...ownsSecondary.map((h) => `houses.${h}.lord`));
      if (secondary.includes(card.house)) take(1, false, false, false, `bodies.${p}.house`);
      for (const key of [...m.arudhas, ...m.specialLagnas]) {
        const pt = pointOf(f, key);
        if (pt && pt.point.house === card.house) take(1, false, false, false, `${pt.path}.house`, `bodies.${p}.house`);
      }
      if (best.value > 0) {
        best = { ...best, natural: best.natural || natural };
        if (afflicted && viaLordship) a[id] = { ...best, evidence: [...best.evidence, isDusthana(card.house) ? `bodies.${p}.house` : `bodies.${p}.dignity`] };
        else s[id] = best;
      }
      const lordsAdverse = m.adverseHouses.filter((h) => card.owns.includes(h));
      const sitsAdverse = m.adverseHouses.includes(card.house);
      if (lordsAdverse.length || sitsAdverse) {
        const value = lordsAdverse.length ? 2 : 1;
        if (value > (a[id]?.value ?? 0)) a[id] = { value, primary: false, natural: false, evidence: lordsAdverse.length ? lordsAdverse.map((h) => `houses.${h}.lord`) : [`bodies.${p}.house`] };
      }
    }
    sig[p] = s;
    adv[p] = a;
  }
  const scarcity = (t: SigTable): Record<string, number> => {
    const n: Record<string, number> = {};
    for (const row of Object.values(t)) for (const [m, e] of Object.entries(row ?? {})) if ((e?.value ?? 0) >= 2) n[m] = (n[m] ?? 0) + 1;
    return n;
  };
  const sigScarcity = scarcity(sig);
  const advScarcity = scarcity(adv);
  for (const p of PLANET_CODES) {
    if (sig[p]) sig[p] = cap(sig[p]!, capN, sigScarcity);
    if (adv[p]) adv[p] = cap(adv[p]!, capN, advScarcity);
  }
  return { sig, adv, cap: capN };
}

/** sig / adv value of a planet for a marker (0 when none) */
export function sigOf(t: SigTable, p: string, m: MarkerId): number {
  return t[p as PlanetCode]?.[m]?.value ?? 0;
}
