/**
 * Pack sections for the layers doc 28 §5 adds to the graph: the Tithi Pravesh year (`annual`), the chart of the question
 * moment (`prashna`) and the sky at an asked date (`transit_at`). Pure functions over Radha payloads: they select,
 * rename to the pack's planet codes and key rows so a claim can cite them as dot paths. Nothing here computes astrology:
 * every sign, house, nakshatra, lord and date is a field Radha sent (the sign lords come from the person's own dossier,
 * where Radha already paired each sign with its lord). Dates are compared as text, never derived.
 */
import { PLANET_CODES, PLANET_NAMES, type PlanetCode } from '../facts/constants.js';
import type { Dossier } from '../facts/types.js';

type Row = Record<string, unknown>;

const NAME_TO_CODE: Record<string, PlanetCode> = Object.fromEntries(
  PLANET_CODES.flatMap((c) => [
    [c.toLowerCase(), c],
    [PLANET_NAMES[c].toLowerCase(), c],
  ])
) as Record<string, PlanetCode>;

/** 'Jupiter' / 'jupiter' / 'Ju' -> 'Ju'; anything else (outer planets, special points) -> null. */
export function planetCode(name: unknown): PlanetCode | null {
  return typeof name === 'string' ? NAME_TO_CODE[name.trim().toLowerCase()] ?? null : null;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);
const isoDay = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

/** Sign name -> its lord, read from the dossier's twelve houses (Radha paired them; nothing is looked up from a table). */
export function signLords(d: Dossier | null | undefined): Record<string, PlanetCode> {
  const out: Record<string, PlanetCode> = {};
  for (const h of Object.values((d as { houses?: Record<string, { sign_name?: string; lord?: PlanetCode }> } | null)?.houses ?? {})) {
    if (h?.sign_name && h.lord) out[h.sign_name.toLowerCase()] = h.lord;
  }
  return out;
}

const lordOf = (sign: string | undefined, lords: Record<string, PlanetCode>): PlanetCode | undefined => (sign ? lords[sign.toLowerCase()] : undefined);

/** One Radha chart (lagna row + planet rows) as `{ lagna, bodies: { Su: {...} } }`, houses as Radha counted them. */
export function compactChart(chart: unknown, lords: Record<string, PlanetCode> = {}): { lagna: Row; bodies: Record<string, Row> } | null {
  const c = chart as { lagna?: Row; planets?: Row[] } | null;
  if (!c || !c.lagna || !Array.isArray(c.planets)) return null;
  const lagnaSign = str(c.lagna.sign);
  const lagna: Row = { sign: lagnaSign, nak: str(c.lagna.nakshatra) };
  const lagnaLord = lordOf(lagnaSign, lords);
  if (lagnaLord) lagna.lord = lagnaLord;
  const bodies: Record<string, Row> = {};
  for (const p of c.planets) {
    const code = planetCode(p?.name);
    if (!code) continue;
    const row: Row = { sign: str(p.sign), h: int(p.house_from_lagna), nak: str(p.nakshatra) };
    if (int(p.natal_house) !== undefined) row.natal_h = p.natal_house;
    if (p.retrograde === true) row.retro = true;
    bodies[code] = row;
  }
  return { lagna, bodies };
}

/** Occupants of each house, grouped from the house numbers Radha gave each planet. */
function occupants(bodies: Record<string, Row>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [code, b] of Object.entries(bodies)) {
    const h = int(b.h);
    if (h !== undefined) (out[String(h)] ??= []).push(code);
  }
  return out;
}

// ---- annual (Tithi Pravesh) --------------------------------------------------------------------------------

interface DashaNode {
  lord?: unknown;
  start?: unknown;
  end?: unknown;
  level?: unknown;
  children?: DashaNode[];
}

/**
 * The Tithi Pravesh chart and its year dasha for the year that applies today. Periods are the ones that overlap both
 * the year window and the question's horizon (at most 16), keyed `<lord>_<from>`; `running` is the row containing today.
 * Returns null when neither payload is usable.
 */
export function annualSection(input: { chart: unknown; dasha: unknown; asOf: string; horizon: { from: string; to: string }; dossier?: Dossier | null }): Row | null {
  const lords = signLords(input.dossier);
  const chartP = input.chart as Row | null;
  const dashaP = input.dasha as { system?: unknown; periods?: DashaNode[]; year_used?: unknown; valid_from?: unknown; valid_to?: unknown } | null;
  const chart = chartP ? compactChart(chartP, lords) : null;
  const nodes = Array.isArray(dashaP?.periods) ? dashaP!.periods! : [];
  if (!chart && !nodes.length) return null;
  const meta = (chartP ?? dashaP ?? {}) as Row;
  const yearFrom = isoDay(meta.valid_from) ?? isoDay(dashaP?.valid_from);
  const yearTo = isoDay(meta.valid_to) ?? isoDay(dashaP?.valid_to);
  const lo = [input.horizon.from, yearFrom].filter(Boolean).sort().pop()!;
  const hi = [input.horizon.to, yearTo].filter(Boolean).sort()[0]!;
  const out: Row = { year_used: int(meta.year_used) ?? int(dashaP?.year_used), valid_from: yearFrom, valid_to: yearTo };
  const missing: string[] = [];
  if (chart) {
    out.chart = { lagna: chart.lagna, bodies: chart.bodies, occupants: occupants(chart.bodies) };
  } else missing.push('Tithi Pravesh chart');

  if (nodes.length) {
    const periods: Record<string, Row> = {};
    let running: Row | undefined;
    const take = (n: DashaNode, parent: string | null): Row | null => {
      const lord = planetCode(n.lord) ?? str(n.lord);
      const from = isoDay(n.start);
      const to = isoDay(n.end);
      if (!lord || !from || !to) return null;
      const row: Row = { lord, from, to, ...(parent ? { within: parent } : {}) };
      if (to >= lo && from <= hi && Object.keys(periods).length < 16) periods[`${lord}_${from}`] = row;
      return row;
    };
    const holdsToday = (r: Row | null) => !!r && (r.from as string) <= input.asOf && input.asOf < (r.to as string);
    for (const n of nodes) {
      const top = take(n, null);
      if (holdsToday(top)) running = { lord: top!.lord, from: top!.from, to: top!.to };
      for (const c of Array.isArray(n.children) ? n.children : []) {
        const sub = take(c, (top?.lord as string | undefined) ?? null);
        if (running && holdsToday(top) && holdsToday(sub)) running.sub = { lord: sub!.lord, from: sub!.from, to: sub!.to };
      }
    }
    out.dasha = { system: str(dashaP?.system) ?? 'tithi_ashtottari', ...(running ? { running } : {}), periods };
  } else missing.push('Tithi Pravesh year dasha');
  if (missing.length) out.missing = missing;
  return out;
}

// ---- prashna -----------------------------------------------------------------------------------------------

/**
 * The prashna chart: panchanga at the moment, the prashna lagna (the rising sign at the moment) and its lord, the Moon,
 * the D-1 and D-9 bodies with houses from the prashna lagna, and for each frame house its occupants (and its sign and
 * lord only when an occupant shows the sign).
 */
export function prashnaSection(input: { payload: unknown; frameHouses: number[]; placeSource: 'current' | 'birth'; dossier?: Dossier | null }): Row | null {
  const p = input.payload as { at_local?: unknown; panchanga?: Row; charts?: Record<string, unknown> } | null;
  const lords = signLords(input.dossier);
  const d1 = compactChart(p?.charts?.d1, lords);
  if (!p || !d1) return null;
  const d9 = compactChart(p.charts?.d9, lords);
  const pan = (p.panchanga ?? {}) as Record<string, Row | string | undefined>;
  const pick = (r: unknown, keys: string[]): Row | undefined => {
    if (!r || typeof r !== 'object') return undefined;
    const o: Row = {};
    for (const k of keys) if ((r as Row)[k] !== undefined) o[k] = (r as Row)[k];
    return Object.keys(o).length ? o : undefined;
  };
  const panchanga: Row = {};
  const tithi = pick(pan.tithi, ['name', 'paksha', 'number']);
  if (tithi) panchanga.tithi = tithi;
  const nak = pick(pan.nakshatra, ['name', 'pada', 'lord']);
  if (nak) panchanga.nakshatra = { ...nak, ...(planetCode(nak.lord) ? { lord: planetCode(nak.lord) } : {}) };
  const yoga = pick(pan.yoga, ['name']);
  if (yoga) panchanga.yoga = yoga;
  const karana = pick(pan.karana, ['name', 'lord']);
  if (karana) panchanga.karana = { ...karana, ...(planetCode(karana.lord) ? { lord: planetCode(karana.lord) } : {}) };
  const weekday = pick(pan.weekday, ['name']);
  if (weekday) panchanga.weekday = weekday.name;
  const hora = planetCode(pan.hora_lord) ?? str(pan.hora_lord);
  if (hora) panchanga.hora_lord = hora;

  const occ = occupants(d1.bodies);
  const lagnaLord = d1.lagna.lord as PlanetCode | undefined;
  const matter: Record<string, Row> = {};
  for (const h of [...new Set(input.frameHouses)].slice(0, 6)) {
    const who = occ[String(h)] ?? [];
    const sign = who.length ? str(d1.bodies[who[0]!]!.sign) : undefined;
    const lord = lordOf(sign, lords);
    matter[String(h)] = { occupants: who, ...(sign ? { sign } : {}), ...(lord ? { lord, lord_row: d1.bodies[lord] ?? null } : {}) };
  }
  return {
    at_local: str(p.at_local),
    place: input.placeSource,
    panchanga,
    lagna: d1.lagna,
    ...(lagnaLord && d1.bodies[lagnaLord] ? { lagna_lord: { planet: lagnaLord, ...d1.bodies[lagnaLord] } } : {}),
    ...(d1.bodies.Mo ? { moon: d1.bodies.Mo } : {}),
    matter,
    d1: { bodies: d1.bodies, occupants: occ },
    ...(d9 ? { d9: { lagna: d9.lagna, bodies: d9.bodies } } : {}),
  };
}

// ---- transit at an asked date ------------------------------------------------------------------------------

/** The transit at the asked date: D-1, D-9 and D-10 bodies with the natal house each falls in (when Radha sent it). */
export function transitAtSection(input: { payload: unknown; at: string }): Row | null {
  const p = input.payload as { at_local?: unknown; charts?: Record<string, unknown> } | null;
  const charts: Row = {};
  for (const [k, c] of Object.entries(p?.charts ?? {})) {
    const cc = compactChart(c);
    if (cc) charts[k.toUpperCase()] = { bodies: cc.bodies };
  }
  if (!Object.keys(charts).length) return null;
  return { at: input.at, at_local: str(p!.at_local), charts };
}
