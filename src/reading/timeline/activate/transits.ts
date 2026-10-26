/**
 * S6 Transits from Radha's `transit_contacts` only (docs/reading-engine/27 §A.3, §B.3: until the range export R-T1 lands,
 * contacts already cover 36 years in four calls, including stations in orb). One contact = a slow planet within the orb
 * of a natal point, with entry/exit, exact dates and any station inside the orb.
 *
 * A contact activates a marker when the natal point sits in a frame house (`natal_house`), lords a frame house
 * (`bodies.<N>.owns` via `houses.*.lord`) or is the marker's karaka. Strength 1 while in orb, 1.5 in a month with an exact
 * hit, 2 in a month with a station in orb; then the SAV of the natal point's house as a modifier (+0.5 if SAV >= 28,
 * -0.5 if SAV <= 22, `houses.<h>.sav`). Jupiter supports; Saturn, Rahu, Ketu and Mars test. Each contact is one transit
 * item: in convergence the items of one month add up (capped).
 */
import type { PlanetCode } from '../../facts/constants.js';
import type { RadhaContact, TransitContactsPayload } from '../../chartData/transitContacts.js';
import type { Foundation } from '../foundation.js';
import { MARKERS, MARKER_IDS } from '../markers.js';
import { addDaysIso, monthEnd, monthOf, monthStart } from '../months.js';
import type { Activation } from '../types.js';

export const SUPPORTIVE_TRANSITS: ReadonlySet<string> = new Set(['Ju']);

/** A contact with the path it was read from (`transit_contacts[<from>..<to>].contacts[i]`) */
export interface SourcedContact {
  contact: RadhaContact;
  evidence: string[];
}

/**
 * Contacts of several range payloads, with a contact that crosses a range boundary (ends_after_range in one,
 * starts_before_range in the next) joined into one. Pure bookkeeping on Radha's rows.
 */
export function mergeContacts(payloads: readonly TransitContactsPayload[]): SourcedContact[] {
  const out: SourcedContact[] = [];
  const sorted = [...payloads].sort((a, b) => a.from.localeCompare(b.from));
  for (const p of sorted) {
    p.contacts.forEach((c, i) => {
      const path = `transit_contacts[${p.from}..${p.to}].contacts[${i}]`;
      if (c.starts_before_range) {
        const prev = out.find((o) => o.contact.transit === c.transit && o.contact.natal === c.natal && o.contact.ends_after_range && addDaysIso(o.contact.to, 1) >= c.from);
        if (prev) {
          prev.contact = {
            ...prev.contact,
            to: c.to,
            ends_after_range: c.ends_after_range,
            exact: [...new Set([...prev.contact.exact, ...c.exact])],
            stations: [...prev.contact.stations, ...c.stations.filter((s) => !prev.contact.stations.some((x) => x.date === s.date))],
            station_in_orb: prev.contact.station_in_orb || c.station_in_orb,
          };
          prev.evidence.push(path);
          return;
        }
      }
      out.push({ contact: { ...c, exact: [...c.exact], stations: [...c.stations] }, evidence: [path] });
    });
  }
  return out;
}

export function activateTransitContacts(f: Foundation, contacts: readonly SourcedContact[]): Activation[] {
  const out: Activation[] = [];
  contacts.forEach(({ contact: c, evidence }, idx) => {
    const natal = c.natal as PlanetCode | 'La';
    const np = natal === 'La' ? null : f.planets[natal];
    const sav = f.houses[c.natal_house]?.sav ?? null;
    const savMod = sav == null ? 0 : sav >= 28 ? 0.5 : sav <= 22 ? -0.5 : 0;
    const polarity = SUPPORTIVE_TRANSITS.has(c.transit) ? 1 : -1;
    const item = `${c.transit}-${c.natal}-${c.from}`;
    const until = addDaysIso(c.to, 1);
    const exactMonths = [...new Set(c.exact.map(monthOf))];
    const stationMonths = [...new Set(c.stations.map((s) => monthOf(s.date)))];

    for (const id of MARKER_IDS) {
      const m = MARKERS[id];
      const ev: string[] = [];
      if (m.houses.includes(c.natal_house)) ev.push('natal_house');
      const owned = np ? np.owns.filter((h) => m.houses.includes(h)) : [];
      if (owned.length) ev.push(...owned.map((h) => `houses.${h}.lord`));
      if (natal !== 'La' && (m.karakas.includes(natal) || m.charaKarakas.some((k) => f.chara[k] === natal))) ev.push(m.karakas.includes(natal) ? `karakas.natural.${natal}` : 'karakas.chara');
      if (!ev.length) continue;
      const paths = [...evidence, ...ev.map((e) => (e === 'natal_house' ? `${evidence[0]}.natal_house` : e)), ...(savMod ? [`houses.${c.natal_house}.sav`] : [])];
      const push = (strength: number, from: string, to: string, why: string[]): void => {
        const s = Math.max(0.5, strength + savMod);
        out.push({ system: 'S6', marker: id, planet: c.transit, strength: s, polarity, from, to, level: 'contact', item: `${item}#${idx}`, evidence: [...paths, ...why] });
      };
      push(1, c.from, until, []);
      for (const mo of exactMonths) push(1.5, monthStart(mo), monthEnd(mo), [`${evidence[0]}.exact`]);
      for (const mo of stationMonths) push(2, monthStart(mo), monthEnd(mo), [`${evidence[0]}.stations`]);
    }
  });
  return out;
}
