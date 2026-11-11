/**
 * The Now card's data (docs/reading-engine/72 §4.1). Once a day per kundli, from the engine only:
 *
 *   - each reading clock's `pressure_inventory` at its deepest level around today (`levels` NOW_DASHA_LEVEL, no years
 *     either side: the engine serves levels 4 and deeper only near `as_of` and caps each system at what it serves);
 *   - one `transit` call for today in the person's birth place, in the 16 charts D1-D60, with the natal overlay.
 *
 * Node keeps the periods running today (a date comparison on the engine's own dates) and carries every value as the
 * engine gave it. A chart's natal house is shown only where the engine states which natal lagna it counted from for that
 * chart (`natal_lagna` on the chart; D1 always): until the engine fix of doc 72 §6 step 1, D2-D60 natal houses are
 * counted from the natal D1 lagna and are left out. Nothing here computes astrology. Never throws.
 */
import { fetchEngineExport } from '../../lib/astroKundliClient.js';
import type { KundliRequest, RadhaFetcher } from '../chartData/store.js';
import { transitRequestFields } from '../chartData/transit.js';
import { estProviderTokens, shortHash } from '../self/v2/slices.js';
import { asPressurePayload, PRESSURE_TYPE, type EnginePressureRow } from '../self/sub/pressure.js';
import type { RenderedSlice } from '../slices/types.js';

/** D1 to D60 as the engine serves them (D81, D108 and D144 left out: doc 72 §8 decision 1) */
export const NOW_FACTORS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60] as const;
export const NOW_SLICE_ID = 'now';

/** The deepest dasha level asked for (doc 72 §8 decision 2). Env `NOW_DASHA_LEVEL` (default 5, 4..6). */
export function nowDashaLevel(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.NOW_DASHA_LEVEL);
  return Number.isInteger(n) && n >= 4 && n <= 6 ? n : 5;
}

export interface NowPeriod {
  system: string;
  level: number;
  lord: string;
  from: string;
  to: string;
  key: string;
  polarity: string;
  houses: number[];
  matters: string[];
}

export interface NowPlanet {
  name: string;
  sign: string;
  nakshatra: string;
  houseFromLagna: number;
  /** from the natal lagna of the same chart; null when the engine did not state that lagna (see the header) */
  natalHouse: number | null;
}

export interface NowChart {
  factor: number;
  lagna: string;
  /** the natal lagna sign the engine counted `natal_house` from in this chart, when it states it */
  natalLagna: string | null;
  planets: NowPlanet[];
}

export interface NowData {
  asOf: string;
  level: number;
  clocks: Array<{ system: string; periods: NowPeriod[]; error: string | null }>;
  transit: { at: string; charts: NowChart[] } | null;
  gaps: string[];
}

export interface NowPullDeps {
  kundliRequest: (kundliId: string) => Promise<KundliRequest | null>;
  /** the engine call (default: the throttled export client); tests replace it */
  fetcher?: RadhaFetcher;
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, { ...(req.coords ?? {}), ...extra });
const S = (v: unknown): string => (typeof v === 'string' ? v : '');
const N = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null);

/** The periods of one clock's payload running on `asOf`, level 1 first (selection on the engine's dates). */
export function runningPeriods(rows: readonly EnginePressureRow[], system: string, asOf: string): NowPeriod[] {
  return rows
    .filter((r) => r && r.kind === 'dasha' && typeof r.from === 'string' && typeof r.to === 'string' && r.from <= asOf && asOf < r.to)
    .map((r) => ({
      system,
      level: Number(r.level ?? 0),
      lord: S(r.planet),
      from: r.from,
      to: r.to,
      key: r.id,
      polarity: S(r.polarity),
      houses: Array.isArray(r.houses_touched) ? r.houses_touched.filter((h) => Number.isInteger(h)) : [],
      matters: Array.isArray(r.matters) ? r.matters.filter((m): m is string => typeof m === 'string') : [],
    }))
    .sort((a, b) => a.level - b.level);
}

/** The engine's transit answer as charts; natal houses kept only where the chart's natal lagna is stated. */
export function transitCharts(raw: unknown): { at: string; charts: NowChart[] } | null {
  const d = (raw && typeof raw === 'object' && 'data' in (raw as object) && !('charts' in (raw as object)) ? (raw as { data: unknown }).data : raw) as Record<string, unknown> | null;
  const charts = d && typeof d.charts === 'object' && d.charts ? (d.charts as Record<string, Record<string, unknown>>) : null;
  if (!charts) return null;
  const out: NowChart[] = [];
  for (const [id, c] of Object.entries(charts)) {
    const factor = N(c?.divisional_chart_factor) ?? Number(id.replace(/^d/, ''));
    const natalLagna = factor === 1 ? S((c?.natal_lagna as Record<string, unknown> | undefined)?.sign) || 'natal D1 lagna' : S((c?.natal_lagna as Record<string, unknown> | undefined)?.sign) || null;
    const planets = (Array.isArray(c?.planets) ? (c.planets as Array<Record<string, unknown>>) : []).map((p) => ({
      name: S(p.name),
      sign: S(p.sign),
      nakshatra: S(p.nakshatra),
      houseFromLagna: N(p.house_from_lagna) ?? 0,
      natalHouse: natalLagna ? N(p.natal_house) : null,
    }));
    out.push({ factor, lagna: S((c?.lagna as Record<string, unknown> | undefined)?.sign), natalLagna, planets });
  }
  out.sort((a, b) => a.factor - b.factor);
  return { at: S(d!.at_local), charts: out };
}

/** Pulls the day's Now data: every clock and the transit at once. Never throws; failures land in `gaps`. */
export async function pullNow(deps: NowPullDeps, kundliId: string, asOf: string, clocks: readonly string[], level = nowDashaLevel()): Promise<NowData> {
  const data: NowData = { asOf, level, clocks: [], transit: null, gaps: [] };
  const req = await deps.kundliRequest(kundliId).catch(() => null);
  if (!req) {
    data.gaps.push('now: kundli or birth details not found');
    return data;
  }
  const fetcher = deps.fetcher ?? defaultFetcher;
  const clockPulls = clocks.map(async (system) => {
    try {
      const raw = await fetcher(req, PRESSURE_TYPE, { params: { as_of: asOf, years_back: 0, years_ahead: 0, system, levels: level } });
      const p = asPressurePayload(raw);
      if (!p) throw new Error('not a pressure_inventory payload');
      return { system, periods: runningPeriods(p.rows, system, asOf), error: null };
    } catch (e) {
      const error = String((e as Error)?.message ?? e).slice(0, 200);
      data.gaps.push(`now: ${system} not pulled (${error})`);
      return { system, periods: [], error };
    }
  });
  const transitPull = (async () => {
    try {
      // today at noon, place-local, in the birth place; the fields as fetchTransit sends them
      const fields = transitRequestFields(req, { at: `${asOf} 12:00:00`, divisionalChartFactors: [...NOW_FACTORS], withNatal: true });
      const raw = await fetcher(req, 'transit', fields);
      const t = transitCharts(raw);
      if (!t) data.gaps.push('now: transit answer has no charts');
      return t;
    } catch (e) {
      data.gaps.push(`now: transit not pulled (${String((e as Error)?.message ?? e).slice(0, 200)})`);
      return null;
    }
  })();
  data.clocks = await Promise.all(clockPulls);
  data.transit = await transitPull;
  const unstated = (data.transit?.charts ?? []).filter((c) => c.factor !== 1 && !c.natalLagna).length;
  if (unstated) data.gaps.push(`now: ${unstated} charts carry no per-chart natal lagna; their natal houses are left out (engine fix, doc 72 §6 step 1)`);
  return data;
}

/** The `now` slice: today's running periods per clock and today's sky over the chart, every line with its key. */
export function renderNowSlice(d: NowData): RenderedSlice {
  const L: string[] = [`# NOW (${d.asOf}): the periods running today in each clock, level 1 down to the deepest served, and today's transit over this chart in D1-D60`];
  const keys = new Set<string>();
  for (const c of d.clocks) {
    L.push(`## CLOCK ${c.system}${c.error ? ' (not read today)' : ''}`);
    for (const p of c.periods) {
      keys.add(p.key);
      L.push(`{${p.key}} L${p.level} lord=${p.lord || 'n/a'} ${p.from}..${p.to} polarity=${p.polarity} houses=[${p.houses.join(',')}] matters=[${p.matters.join(',')}]`);
    }
    if (!c.periods.length && !c.error) L.push('(no period stored for today)');
  }
  L.push(`## SKY TODAY (${d.transit?.at ?? 'not read'})`);
  for (const c of d.transit?.charts ?? []) {
    L.push(`### D${c.factor} lagna=${c.lagna}${c.natalLagna ? ` natal_lagna=${c.natalLagna}` : ''}`);
    for (const p of c.planets) {
      const k = `now:d${c.factor}.${p.name}`;
      keys.add(k);
      L.push(`{${k}} ${p.name} ${p.sign} ${p.nakshatra} house_from_lagna=${p.houseFromLagna}${p.natalHouse != null ? ` natal_house=${p.natalHouse}` : ''}`);
    }
  }
  const text = L.join('\n');
  const sorted = [...keys].sort();
  return {
    id: NOW_SLICE_ID,
    text,
    keys: sorted,
    estTokens: estProviderTokens(text),
    sources: [
      { dataType: 'pressure_inventory', variant: `now;levels=${d.level}`, calcVersion: 'engine', hash: shortHash(JSON.stringify(d.clocks)) },
      { dataType: 'transit', variant: `now;${d.asOf}`, calcVersion: 'engine', hash: shortHash(JSON.stringify(d.transit)) },
    ],
    hash: shortHash(`${NOW_SLICE_ID}\n${text}\n${sorted.join(',')}`),
  };
}
