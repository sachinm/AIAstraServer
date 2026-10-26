/**
 * Natal-degree contacts for one reading (`transits.contacts` in the evidence pack). SELECTS and CLIPS the rows of
 * Radha's `transit_contacts` payload (see ../chartData/transitContacts.ts): every date, orb, house and station is a
 * field Radha computed. This file only picks the rows that fall in the reading's horizon, orders them by date and caps
 * them, plus a plain-text renderer. Pure: no I/O, no astrology.
 */
import type { RadhaContact, TransitContactsPayload } from '../chartData/transitContacts.js';
import type { TransitSection } from './transitTable.js';

export const CONTACTS_CAP = 16;

export interface ContactRow {
  planet: string;
  natal: string;
  natal_house: number;
  /** closest approach reached (0 = exact) */
  orb_deg: number;
  from: string;
  to: string;
  exact: string[];
  station_in_orb: boolean;
  /** the first station inside the orb (the sharpest trigger) */
  station?: { date: string; kind: string; orb_deg: number };
  /** the contact began before the horizon / runs past it */
  before?: true;
  after?: true;
}

export interface ContactsSection {
  orb: number;
  /** keyed `<planet>_<natal>_<from>`, in date order */
  rows: Record<string, ContactRow>;
  dropped: number;
}

export interface ContactsSelectInput {
  payload: TransitContactsPayload;
  horizon: { from: string; to: string; months: number };
  cap?: number;
}

const NAMES: Record<string, string> = {
  Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu', La: 'Lagna',
};

export function contactKey(c: { transit?: string; planet?: string; natal: string; from: string }): string {
  return `${c.planet ?? c.transit}_${c.natal}_${c.from}`;
}

/** Mars only for short horizons, as the transit table (transitPlanetsFor): it moves too fast to matter over a year. */
function planetWanted(code: string, months: number): boolean {
  return code === 'Ma' ? months <= 3 : true;
}

/** stations in orb first, then exact hits inside the horizon, then the rest; each group by date */
function rank(c: RadhaContact, hz: { from: string; to: string }): number {
  if (c.station_in_orb) return 0;
  if (c.exact.some((d) => d >= hz.from && d <= hz.to)) return 1;
  return 2;
}

export function selectContacts(input: ContactsSelectInput): ContactsSection {
  const { payload, horizon: hz } = input;
  const cap = input.cap ?? CONTACTS_CAP;
  const inHorizon = payload.contacts.filter((c) => planetWanted(c.transit, hz.months) && c.from <= hz.to && c.to >= hz.from);
  const kept = [...inHorizon]
    .sort((a, b) => rank(a, hz) - rank(b, hz) || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
    .slice(0, cap)
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : contactKey(a) < contactKey(b) ? -1 : 1));
  const rows: Record<string, ContactRow> = {};
  for (const c of kept) {
    const row: ContactRow = {
      planet: c.transit,
      natal: c.natal,
      natal_house: c.natal_house,
      orb_deg: c.orb_deg,
      from: c.from,
      to: c.to,
      exact: c.exact,
      station_in_orb: c.station_in_orb,
    };
    if (c.stations[0]) row.station = { date: c.stations[0].date, kind: c.stations[0].kind, orb_deg: c.stations[0].orb_deg };
    if (c.from < hz.from || c.starts_before_range) row.before = true;
    if (c.to > hz.to || c.ends_after_range) row.after = true;
    rows[contactKey(c)] = row;
  }
  return { orb: payload.orb, rows, dropped: inHorizon.length - kept.length };
}

/**
 * Put the contacts at `transits.contacts` (evidence ids `transits.contacts.rows.<key>.exact` etc.). The chart's
 * `contacts` is undefined when they were not requested (type not served yet, fixture): nothing is added and nothing is
 * reported. null means the fetch failed: the reading goes on without them and `missing` carries the caveat.
 */
export function withContacts(
  transits: TransitSection | null,
  chart: { contacts?: TransitContactsPayload | null } | null,
  horizon: { from: string; to: string; months: number },
  missing: string[]
): TransitSection | null {
  if (!transits || !chart || chart.contacts === undefined) return transits;
  if (chart.contacts === null) {
    missing.push('transit contacts unavailable');
    return transits;
  }
  return { ...transits, contacts: selectContacts({ payload: chart.contacts, horizon }) } as TransitSection & { contacts: ContactsSection };
}

/** One line per contact, for logs, debugging and plain-text prompts. */
export function renderContacts(section: ContactsSection): string {
  const lines: string[] = [];
  for (const r of Object.values(section.rows)) {
    const who = `${NAMES[r.planet] ?? r.planet} over natal ${NAMES[r.natal] ?? r.natal} (house ${r.natal_house})`;
    const span = `in orb ${r.before ? 'from before ' : ''}${r.from} to ${r.to}${r.after ? ' and beyond' : ''}`;
    const exact = r.exact.length ? `exact ${r.exact.join(', ')}` : `closest ${r.orb_deg}°`;
    const station = r.station ? `; stations ${r.station.kind} ${r.station.date} within ${r.station.orb_deg}° (sharpest trigger)` : '';
    lines.push(`${who}: ${span}; ${exact}${station}`);
  }
  if (section.dropped) lines.push(`(${section.dropped} more contact${section.dropped === 1 ? '' : 's'} not shown)`);
  return lines.join('\n');
}
