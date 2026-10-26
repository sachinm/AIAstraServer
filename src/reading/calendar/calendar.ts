/**
 * Dated calendar for one reading: a sorted list of the dated edges inside the reading's horizon, read straight out of
 * the evidence pack (dasha period boundaries, transit ingresses and exits, stations, double-transit and Sade Sati
 * edges). Mechanical and deterministic: nothing is computed here; every date is a field Radha (pyjhora) already
 * returned, and every event carries the evidence path it came from.
 *
 * Lunations: the pack's transit section does not carry them today (selectTransits drops them). If the pack ever has
 * `transits.lunations` they are read from there; otherwise the caller may pass the transit snapshot's own list
 * (`TransitChart.lunations`, also a Radha field). Nothing is derived when neither is there.
 * TODO(radha): eclipses are not in the transit snapshot yet; add them here once Radha exports them.
 */
import { horizonRange } from '../packs/frames.js';
import type { EvidencePack } from '../packs/selector.js';
import type { TransitChart } from '../transits/types.js';
import type { Intent } from '../types.js';

export type CalendarKind =
  | 'dasha_md'
  | 'dasha_ad'
  | 'dasha_pd'
  | 'dasha_end'
  | 'ingress'
  | 'exit'
  | 'station'
  | 'double_transit_start'
  | 'double_transit_end'
  | 'sade_sati_start'
  | 'sade_sati_end'
  | 'lunation';

export interface CalendarEvent {
  date: string;
  kind: CalendarKind;
  label: string;
  /** Dot path into the evidence pack (resolveEvidence), or `snapshot.lunations.<i>` for snapshot lunations */
  evidence: string;
}

export interface DatedCalendar {
  from: string;
  to: string;
  events: CalendarEvent[];
  caveats: string[];
}

export const CALENDAR_HONESTY_NOTE =
  'These dates are period and ingress edges from the chart data, not exact event days: there is no day-level data (no daily Moon, no hora), so name them as "from about <date>", never as the day something happens.';

/** Lower ranks survive the line cap first. */
const RANK: Record<CalendarKind, number> = {
  dasha_md: 0,
  dasha_ad: 1,
  double_transit_start: 2,
  double_transit_end: 2,
  sade_sati_start: 2,
  sade_sati_end: 2,
  ingress: 3,
  station: 4,
  exit: 4,
  dasha_pd: 5,
  dasha_end: 5,
  lunation: 6,
};
const SLOW = new Set(['Ju', 'Sa', 'Ra', 'Ke']);

type Rec = Record<string, any>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A merged multi-subject pack keys each section by subject id; a single pack does not. */
function sectionsOf(pack: EvidencePack, sec: 'dasha' | 'transits', marker: string): Array<{ prefix: string; s: Rec }> {
  const raw = pack.sections[sec];
  if (!isRec(raw)) return [];
  if (marker in raw) return [{ prefix: sec, s: raw }];
  return Object.entries(raw)
    .filter(([, v]) => isRec(v))
    .map(([subj, v]) => ({ prefix: `${sec}.${subj}`, s: v as Rec }));
}

const str = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export interface BuildCalendarOptions {
  /** The transit snapshot's own lunation list (Radha field), used only when the pack has none */
  lunations?: TransitChart['lunations'] | null;
}

export function buildCalendar(pack: EvidencePack, intent: Pick<Intent, 'horizon'>, asOf: string, opts: BuildCalendarOptions = {}): DatedCalendar {
  const hz = horizonRange(intent.horizon, asOf);
  const inH = (d: string | null): d is string => d !== null && d >= hz.from && d <= hz.to;
  const events: CalendarEvent[] = [];
  const caveats: string[] = [];
  const add = (e: CalendarEvent) => events.push(e);

  // ---- dasha boundaries
  for (const { prefix, s } of sectionsOf(pack, 'dasha', 'current')) {
    const cur = isRec(s.current) ? s.current : {};
    const periods = Object.entries(isRec(s.periods) ? s.periods : {})
      .filter(([, p]) => isRec(p) && str(p.from))
      .map(([key, p]) => ({ key, p: p as Rec }))
      .sort((a, b) => (a.p.from < b.p.from ? -1 : a.p.from > b.p.from ? 1 : 0));
    const starts = new Set<string>();
    let prev: Rec | null = isRec(cur) && cur.md ? { md: cur.md, ad: cur.ad, pd: cur.pd } : null;
    for (const { key, p } of periods) {
      const from = str(p.from)!;
      const chain = [p.md, p.ad, p.pd].filter(Boolean).join('-');
      const same = prev && prev.md === p.md && prev.ad === p.ad && (!p.pd || prev.pd === p.pd);
      if (inH(from) && !same) {
        const kind: CalendarKind = !prev || prev.md !== p.md ? 'dasha_md' : prev.ad !== p.ad || !p.pd ? 'dasha_ad' : 'dasha_pd';
        const lord = kind === 'dasha_md' ? p.md : kind === 'dasha_ad' ? p.ad : p.pd;
        add({ date: from, kind, label: `${kind.slice(-2).toUpperCase()} ${lord} begins (${chain})`, evidence: `${prefix}.periods.${key}.from` });
        starts.add(from);
      }
      prev = p;
    }
    const last = periods[periods.length - 1];
    const lastTo = last ? str(last.p.to) : null;
    if (last && inH(lastTo) && !starts.has(lastTo)) {
      add({ date: lastTo, kind: 'dasha_end', label: `${[last.p.md, last.p.ad, last.p.pd].filter(Boolean).join('-')} ends`, evidence: `${prefix}.periods.${last.key}.to` });
      starts.add(lastTo);
    }
    for (const lvl of ['md', 'ad', 'pd'] as const) {
      const end = str(cur[`${lvl}_end`]);
      if (inH(end) && !starts.has(end) && cur[lvl]) {
        add({ date: end, kind: 'dasha_end', label: `running ${lvl.toUpperCase()} ${cur[lvl]} ends`, evidence: `${prefix}.current.${lvl}_end` });
        starts.add(end);
      }
    }
  }

  // ---- transits
  let lunationsSeen = false;
  for (const { prefix, s } of sectionsOf(pack, 'transits', 'rows')) {
    // ingresses and exits. Row bounds in the pack are clipped to the horizon; the row key keeps the true entry date.
    const rows = Object.entries(isRec(s.rows) ? s.rows : {}).filter(([, r]) => isRec(r)) as Array<[string, Rec]>;
    const ingressDays = new Set<string>();
    for (const [key, r] of rows) {
      const entry = str(key.split('_').pop()) ?? str(r.from);
      // a row keyed on the horizon start is the snapshot's first row (already running), not a sign entry
      if (inH(entry) && entry > hz.from) {
        add({ date: entry, kind: 'ingress', label: `${r.planet} enters ${r.sign}${r.retro_on_entry ? ' (retrograde)' : ''}`, evidence: `${prefix}.rows.${key}` });
        ingressDays.add(`${r.planet}|${entry}`);
      }
    }
    for (const [key, r] of rows) {
      const to = str(r.to);
      if (!inH(to) || to >= hz.to) continue; // clipped at the horizon end: not a real exit
      const next = new Date(Date.parse(to + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
      if (ingressDays.has(`${r.planet}|${to}`) || ingressDays.has(`${r.planet}|${next}`)) continue; // the next ingress already marks it
      add({ date: to, kind: 'exit', label: `${r.planet} leaves ${r.sign}`, evidence: `${prefix}.rows.${key}.to` });
    }
    // stations
    (Array.isArray(s.stations) ? s.stations : []).forEach((st: Rec, i: number) => {
      const d = str(st?.date);
      if (!inH(d)) return;
      const what = st.kind === 'retro_start' ? 'turns retrograde' : st.kind === 'retro_end' ? 'turns direct' : `station (${st.kind})`;
      add({ date: d, kind: 'station', label: `${st.planet} ${what}`, evidence: `${prefix}.stations.${i}` });
    });
    // double transit windows (clipped to the horizon: an edge on the horizon bound is the clip, not a real edge)
    (Array.isArray(s.double_transit) ? s.double_transit : []).forEach((w: Rec, i: number) => {
      const houses = Array.isArray(w?.houses) ? w.houses.join('/') : '?';
      const f = str(w?.from);
      const t = str(w?.to);
      if (inH(f) && f > hz.from) add({ date: f, kind: 'double_transit_start', label: `double transit on house ${houses} begins`, evidence: `${prefix}.double_transit.${i}.from` });
      if (inH(t) && t < hz.to) add({ date: t, kind: 'double_transit_end', label: `double transit on house ${houses} ends`, evidence: `${prefix}.double_transit.${i}.to` });
    });
    // Sade Sati phases
    const sade = isRec(s.sade_sati) && Array.isArray(s.sade_sati.periods) ? s.sade_sati.periods : [];
    sade.forEach((p: Rec, i: number) => {
      const f = str(p?.from);
      const t = str(p?.to);
      if (inH(f) && f > hz.from) add({ date: f, kind: 'sade_sati_start', label: `Sade Sati ${p.phase} phase begins`, evidence: `${prefix}.sade_sati.periods.${i}.from` });
      if (inH(t) && t < hz.to) add({ date: t, kind: 'sade_sati_end', label: `Sade Sati ${p.phase} phase ends`, evidence: `${prefix}.sade_sati.periods.${i}.to` });
    });
    // lunations, only if the pack carries them
    if (Array.isArray(s.lunations)) {
      lunationsSeen = true;
      s.lunations.forEach((l: Rec, i: number) => {
        const d = str(l?.date);
        if (inH(d)) add({ date: d, kind: 'lunation', label: lunationLabel(l), evidence: `${prefix}.lunations.${i}` });
      });
    }
  }
  if (!lunationsSeen) {
    const snap = opts.lunations;
    if (Array.isArray(snap) && snap.length) {
      snap.forEach((l, i) => {
        const d = str(l?.date);
        if (inH(d)) add({ date: d, kind: 'lunation', label: lunationLabel(l as Rec), evidence: `snapshot.lunations.${i}` });
      });
      const lastLun = snap.map((l) => str(l?.date)).filter((d): d is string => d !== null).sort().pop();
      if (lastLun && lastLun < hz.to) caveats.push(`Lunations are listed only through ${lastLun} (the transit snapshot ends its list there).`);
    } else {
      caveats.push('No new or full moon dates are in the chart data, so none are listed.');
    }
  }
  caveats.push('No eclipse dates are in the chart data.');

  // dedupe (merged packs repeat dasha and transits per subject) and sort
  const seen = new Set<string>();
  const out = events.filter((e) => {
    const k = `${e.date}|${e.kind}|${e.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  out.sort(compareEvents);
  return { from: hz.from, to: hz.to, events: out, caveats };
}

function lunationLabel(l: Rec): string {
  const k = String(l.kind ?? '');
  const what = k === 'new' ? 'new moon' : k === 'full' ? 'full moon' : k.replace(/_/g, ' ');
  return `${what}${l.sign_name ? ` in ${l.sign_name}` : ''}${l.nak ? ` (${l.nak})` : ''}`;
}

function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (RANK[a.kind] !== RANK[b.kind]) return RANK[a.kind] - RANK[b.kind];
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

/**
 * One line per event, date order, capped at `max` lines. When over the cap the most important kinds are kept
 * (dasha MD/AD, double transit, Sade Sati, ingresses before stations, PDs and lunations).
 */
export function renderCalendar(events: CalendarEvent[], max = 24): string {
  let kept = events;
  if (events.length > max) {
    const idx = events.map((e, i) => ({ e, i })).sort((a, b) => RANK[a.e.kind] - RANK[b.e.kind] || (SLOW.has(a.e.label.slice(0, 2)) ? 0 : 1) - (SLOW.has(b.e.label.slice(0, 2)) ? 0 : 1) || a.i - b.i);
    const keep = new Set(idx.slice(0, max - 1).map((x) => x.i));
    kept = events.filter((_, i) => keep.has(i));
  }
  const lines = kept.map((e) => `${e.date}  ${e.label}  [${e.evidence}]`);
  if (kept.length < events.length) lines.push(`(+${events.length - kept.length} smaller edges omitted)`);
  return lines.join('\n');
}

/** The block the writer receives: header, the lines, caveats and the honesty note. Empty string when there is nothing dated. */
export function calendarBlock(cal: DatedCalendar, max = 24): string {
  if (!cal.events.length) return '';
  const parts = [`CALENDAR (dated edges inside the horizon ${cal.from} to ${cal.to}):`, renderCalendar(cal.events, max)];
  for (const c of cal.caveats) parts.push(`Caveat: ${c}`);
  parts.push(`Honesty note (state once when you give dates): ${CALENDAR_HONESTY_NOTE}`);
  return parts.join('\n');
}
