/**
 * S6 slow-planet contacts as T_c (docs/reading-engine/29 §3.3), from Radha's `transit_contacts`: Jupiter, Saturn, Rahu
 * or Ketu within the orb of a natal point, with entry/exit, exact dates and any station in orb.
 *
 * A contact triggers a marker when its natal point is the marker's primary lord (`houses.<h1>.lord`), a planet that
 * signifies the marker at 2+ (signification.ts: karakas included), the Moon or the lagna. Per month of the contact:
 * 2 with an exact hit in the month, 1.5 while in orb, +0.5 with a station in orb, then the SAV of the natal point's house
 * as a modifier (+0.5 if >= 28, -0.5 if <= 22, `houses.<h>.sav`). Polarity: Jupiter supports; Saturn supports a marker
 * it signifies and tests the rest; Rahu supports residence (foreign, movement) and tests the rest; Ketu tests.
 */
import type { RadhaContact, TransitContactsPayload } from '../../chartData/transitContacts.js';
import type { Foundation } from '../foundation.js';
import { MARKERS, MARKER_IDS, type MarkerId } from '../markers.js';
import { addDaysIso, monthEnd, monthOf, monthsBetween, monthStart } from '../months.js';
import { sigOf, type Signification } from '../signification.js';
import type { Activation, Polarity } from '../types.js';

/** A contact with the path(s) it was read from (`transit_contacts[<from>..<to>].contacts[i]`) */
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

/** Why a natal point matters to a marker: the paths, or null when it does not (doc 29 §3.3) */
export function contactRelevance(f: Foundation, s: Signification, natal: string, marker: MarkerId): string[] | null {
  const h1 = MARKERS[marker].houses[0]!;
  if (natal === 'La') return ['bodies.La'];
  if (natal === 'Mo') return ['bodies.Mo'];
  if (f.houses[h1]?.lord === natal) return [`houses.${h1}.lord`];
  if (sigOf(s.sig, natal, marker) >= 2) return s.sig[natal as 'Su']![marker]!.evidence;
  return null;
}

export function contactPolarity(s: Signification, transit: string, marker: MarkerId): Polarity {
  if (transit === 'Ju') return 1;
  if (transit === 'Sa') return sigOf(s.sig, 'Sa', marker) > 0 ? 1 : -1;
  if (transit === 'Ra') return marker === 'residence' ? 1 : -1;
  return -1;
}

export function activateTransitContacts(f: Foundation, s: Signification, contacts: readonly SourcedContact[]): Activation[] {
  const out: Activation[] = [];
  for (const { contact: c, evidence } of contacts) {
    const sav = f.houses[c.natal_house]?.sav ?? null;
    const savMod = sav == null ? 0 : sav >= 28 ? 0.5 : sav <= 22 ? -0.5 : 0;
    const exact = new Set(c.exact.map(monthOf));
    const stations = new Set(c.stations.map((x) => monthOf(x.date)));
    for (const marker of MARKER_IDS) {
      const why = contactRelevance(f, s, c.natal, marker);
      if (!why) continue;
      const polarity = contactPolarity(s, c.transit, marker);
      for (const month of monthsBetween(c.from, c.to)) {
        const strength = Math.max(0.5, (exact.has(month) ? 2 : 1.5) + (stations.has(month) ? 0.5 : 0) + savMod);
        out.push({
          system: 'S6',
          marker,
          planet: c.transit,
          strength,
          polarity,
          from: monthStart(month),
          to: monthEnd(month),
          level: 'contact',
          evidence: [...evidence, ...why, ...(exact.has(month) ? [`${evidence[0]}.exact`] : []), ...(stations.has(month) ? [`${evidence[0]}.stations`] : []), ...(savMod ? [`houses.${c.natal_house}.sav`] : [])],
        });
      }
    }
  }
  return out;
}
