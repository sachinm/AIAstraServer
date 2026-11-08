/**
 * `self.reading.struggle` — What you struggle with (docs/reading-engine/58 §4.1). Reads the D1 cards of the lagna lord,
 * the Moon, the Sun and the AK planet; the D1 1st, 4th and 5th house cards; the engine's house class labels
 * (dusthana), natural and functional nature, dignity, avastha ripeness and cancellation rows; and the reading clock's
 * running periods. A release date is printed only when the planet named is a running lord of the reading clock: the end of
 * that stored period.
 */
import type { PlanetCard } from '../../digest/types.js';
import { clockLabel, HOUSE_SELF, longDate, PLANET_FACULTY, PLANET_SHORT, RIPENESS_SHORT, RIPENESS_WORDS } from '../words.js';
import { activationKey, allRunningDashas, gaps, houseFrame, planetChain, runningChain } from '../slices.js';
import type { PanelBody, SelfClaim } from '../types.js';
import { body, cap, cardDetail, hasCancellation, pname, type PanelInput } from './common.js';

const HEAVY_RIPENESS = new Set(['unripe_sour', 'dried_seed_externalized']);
const MAX_CLAIMS = 6;

export function struggleLead(claims: readonly SelfClaim[]): string {
  const active = claims.filter((c) => !c.withheld);
  if (!active.length) return '';
  return `${active.length} ${active.length === 1 ? 'thing' : 'things'} in your chart ${active.length === 1 ? 'asks' : 'ask'} more of you than the rest.`;
}

export function strugglePanel({ view, activation, asOf, clock }: PanelInput): PanelBody {
  const g = gaps();
  const out: Array<SelfClaim & { planet: string | null }> = [];
  const card = (p: string): PlanetCard | null => view.planet('D1', p);
  const isMalefic = (p: string) => {
    const c = card(p);
    return !!c && /malefic/i.test(c.natural ?? '') && /malefic/i.test(c.functional ?? '');
  };
  const dusthana = (h: number | null | undefined) => (h ? (view.house('D1', h)?.class ?? []).includes('dusthana') : false);

  const h1 = houseFrame(view, 'D1', 1, g);
  const l1 = h1?.lord ?? null;
  const ak = view.points('D1').find((p) => p.id === 'AK')?.planet ?? null;
  const L = planetChain(view, l1, g);
  if (L && dusthana(L.d1.house)) {
    out.push({ id: 'struggle.lord_dusthana', planet: L.planet, line: `The part of you that steers sits in a hard place.`, text: `The part of you that steers your life sits in a hard place: ${HOUSE_SELF[L.d1.house!]}.`, detail: `Lagna lord ${cardDetail(L.d1)}; D1 h${L.d1.house} class dusthana`, certainty: 'fact', evidence: L.evidence });
  }
  for (const p of [...new Set([l1, 'Mo', 'Su', ak].filter((x): x is string => !!x))]) {
    const c = card(p);
    if (!c || !PLANET_FACULTY[p]) continue;
    if (/debil/i.test(c.dignity ?? '')) {
      const lifted = hasCancellation(view, p);
      out.push({ id: `struggle.weak_${p}`, planet: p, line: `What carries ${PLANET_SHORT[p] ?? ''} is at its weakest by birth${lifted ? ', lifted over time' : ''}.`, text: `What carries ${PLANET_FACULTY[p]} is at its weakest by birth${lifted ? ', and a cancellation in your chart lifts it over time' : ''}.`, detail: `${cardDetail(c)}${lifted ? '; cancellation row present' : ''}`, certainty: 'fact', evidence: [`planet:D1.${p}`] });
    }
    const rip = c.avasthaMultipliers?.ripeness;
    if (rip && HEAVY_RIPENESS.has(rip)) {
      out.push({ id: `struggle.ripeness_${p}`, planet: p, line: `What carries ${PLANET_SHORT[p] ?? ''} ${RIPENESS_SHORT[rip] ?? RIPENESS_WORDS[rip]}.`, text: `What carries ${PLANET_FACULTY[p]} ${RIPENESS_WORDS[rip]}.`, detail: `${pname(p)} avasthas ${JSON.stringify(c.avasthas)}; delivery ${rip} ×${c.avasthaMultipliers?.effective}`, certainty: 'fact', evidence: [`planet:D1.${p}`] });
    }
  }
  if (h1) {
    for (const p of [...h1.occupants.map((o) => o.planet), ...h1.aspectedGraha]) {
      if (p === l1 || !isMalefic(p) || !PLANET_FACULTY[p]) continue;
      const on = h1.occupants.some((o) => o.planet === p) ? 'sits on' : 'weighs on';
      out.push({ id: `struggle.on_self_${p}`, planet: p, line: `What carries ${PLANET_SHORT[p] ?? ''} weighs on your sense of self.`, text: `What carries ${PLANET_FACULTY[p]} ${on} your sense of self.`, detail: `${pname(p)} ${on === 'sits on' ? 'occupies' : 'aspects (graha drishti)'} D1 h1; natural and functional malefic`, certainty: 'fact', evidence: ['house:D1.h1', `planet:D1.${p}`] });
    }
  }
  const mo = card('Mo');
  for (const p of [...(mo?.conjunctions ?? []), ...(mo?.aspectedBy ?? [])]) {
    if (!isMalefic(p) || !PLANET_FACULTY[p]) continue;
    out.push({ id: `struggle.on_mind_${p}`, planet: p, line: `What carries ${PLANET_SHORT[p] ?? ''} presses on your feelings.`, text: `What carries ${PLANET_FACULTY[p]} presses on your feelings.`, detail: `${pname(p)} ${mo?.conjunctions.includes(p) ? 'conjunct' : 'aspects'} the Moon; natural and functional malefic`, certainty: 'fact', evidence: ['planet:D1.Mo', `planet:D1.${p}`] });
  }
  const h4 = houseFrame(view, 'D1', 4, g);
  if (h4 && dusthana(h4.lordHouse)) {
    out.push({ id: 'struggle.peace', planet: h4.lord, line: 'Your peace of mind is harder to keep than it looks.', text: `Your peace of mind depends on ${HOUSE_SELF[h4.lordHouse!]}, which makes it harder to keep.`, detail: `D1 h4 lord ${pname(h4.lord)} in h${h4.lordHouse} (dusthana)`, certainty: 'fact', evidence: ['house:D1.h4'] });
  }
  const h5 = houseFrame(view, 'D1', 5, g);
  for (const o of h5?.occupants ?? []) {
    if (!isMalefic(o.planet) || !PLANET_FACULTY[o.planet]) continue;
    out.push({ id: `struggle.ideas_${o.planet}`, planet: o.planet, line: `What carries ${PLANET_SHORT[o.planet] ?? ''} makes your ideas restless.`, text: `What carries ${PLANET_FACULTY[o.planet]} lives in your ideas and learning and makes them restless.`, detail: `${pname(o.planet)} occupies D1 h5 ${h5?.sign}; natural and functional malefic`, certainty: 'fact', evidence: ['house:D1.h5', `planet:D1.${o.planet}`] });
  }

  const run = runningChain(activation, clock.system, asOf);
  const allRunning = allRunningDashas(activation, asOf, clock.system);
  const resolveLord = (r: { lord?: string | null; sign?: string | null } | null | undefined): string | null =>
    r?.lord ?? (r?.sign ? view.houses('D1').find((h) => h.sign === r.sign)?.lord ?? null : null);
  // a struggle the reading clock is running now (a release date) comes first (doc 59 §2.2)
  // release dates come from the main period and the sub-period only; the third level is the day-to-day phase of doc 60 §11
  const runningLords = new Set([resolveLord(run.l1), resolveLord(run.l2)].filter(Boolean));
  const ordered = [...out.filter((c) => c.planet && runningLords.has(c.planet)), ...out.filter((c) => !(c.planet && runningLords.has(c.planet)))];
  const claims: SelfClaim[] = ordered.slice(0, MAX_CLAIMS).map(({ planet, ...c }) => {
    const r = [run.l2, run.l1].find((x) => x && planet && resolveLord(x) === planet);
    const otherActive = planet
      ? allRunning
          .filter((s) => s.system !== clock.system && (resolveLord(s.l1) === planet || resolveLord(s.l2) === planet))
          .map((s) => `${clockLabel(s.system)} (${(resolveLord(s.l2) === planet ? s.l2 : s.l1)!.from}→${(resolveLord(s.l2) === planet ? s.l2 : s.l1)!.to})`)
      : [];
    const otherSuffix = otherActive.length ? `; also running in ${otherActive.join(', ')}` : '';
    if (!r) return otherSuffix ? { ...c, detail: `${c.detail}${otherSuffix}` } : c;
    const what = r.level === 1 ? 'chapter' : 'sub-chapter';
    return { ...c, text: `${c.text} This presses hardest until ${longDate(r.to)}, when your current ${what} ends.`, line: c.line ? `${c.line.replace(/\.$/, '')} until ${longDate(r.to)}.` : undefined, range: { from: r.from, to: r.to }, detail: `${c.detail}; running ${clock.label} level ${r.level} ${r.lord ? pname(r.lord) : r.sign} ${r.from} → ${r.to}${otherSuffix}`, evidence: [...c.evidence, activationKey(r)] };
  });
  const lead = struggleLead(claims);
  return body(lead, claims, g);
}
