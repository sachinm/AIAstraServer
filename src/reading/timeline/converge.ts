/**
 * Convergence, v2 (docs/reading-engine/29 §3.2-§4): per marker and month, three gates and a ranked band. Arithmetic on
 * the activation matrix only.
 *
 * - Gate D (period): D1 = Vimshottari AD signification, +1 when the MD lord signifies at 2+, +1 when a PD lord signifies;
 *   D4 = Narayana; the confirmers D2 (Yogini) and D3 (Tithi Ashtottari) count only when D1 >= 2 or D4 >= 2, and one planet
 *   votes once (a confirmer whose lord already runs in Vimshottari, or in Yogini for S3, adds nothing). S7 adds its 0.5
 *   modifier. D = sum of prior x value.
 * - Gate T (trigger): T = prior x double transit (S6D) + prior x the strongest contact (S6).
 * - Gate E (edge): 1.5 in the month a signifying period (AD/PD of S1-S4 at 2+) starts, 1.25 the month after.
 * - Score: E x (D + T) when both gates are open; E x D x 0.5 period alone; T x 0.5 trigger alone. Support and test (the
 *   adverse activations) are scored separately.
 * - Bands are ranked per marker over the grid's months: High = top 8 % with an open trigger and a signifying period
 *   (two families); Moderate = top 20 % with a signifying period; Possible = top 35 %; Quiet the rest. The test score is
 *   banded the same way and the cell is `testing` when its test band out-ranks its support band.
 * - Agent = the planet with the highest prior x value on the winning side (ties: shadbala rank); channel = the next one.
 * - Grain: monthly. A dasha period runs in a month when it covers the 15th; transit activations are per month already.
 */
import type { Foundation } from './foundation.js';
import type { DashaStack } from './dashas.js';
import { runningOn } from './dashas.js';
import { weightOf, type TimelineConfig, type TimelineWeights } from './config.js';
import { MARKER_IDS, type MarkerId } from './markers.js';
import { monthEnd, monthFromIndex, monthIndex, monthMid, monthOf, monthStart } from './months.js';
import { SYSTEM_FAMILY, type Activation, type Band, type Polarity, type SystemId } from './types.js';

export interface SystemCell {
  support: number;
  test: number;
  /** the strongest activation's planet on the winning side */
  planet: string | null;
  evidence: string[];
}

export interface Gates {
  D: number;
  T: number;
  E: number;
  score: number;
}

export interface MonthCell {
  month: string;
  marker: MarkerId;
  band: Band;
  testing: boolean;
  supportScore: number;
  testScore: number;
  support: Gates;
  test: Gates;
  /** families with an open gate on the winning side (dasha, transit) */
  families: string[];
  systems: Partial<Record<SystemId, SystemCell>>;
  agent: string | null;
  channel: string | null;
}

export interface TimelineWindow {
  marker: MarkerId;
  /** first month 'YYYY-MM' and last month (inclusive) */
  fromMonth: string;
  toMonth: string;
  /** ISO dates: first day, and the first day after the window */
  from: string;
  to: string;
  months: number;
  band: Exclude<Band, 'quiet'>;
  testing: boolean;
  /** peak scores over the window, and the peak month's systems and agent */
  supportScore: number;
  testScore: number;
  peakMonth: string;
  systems: Partial<Record<SystemId, SystemCell>>;
  agent: string | null;
  channel: string | null;
}

export interface QuietStrip {
  fromMonth: string;
  toMonth: string;
  /** e.g. "Vimshottari Ju-Sa" */
  lords: string;
}

export interface TimelineGrid {
  months: string[];
  cells: Record<MarkerId, MonthCell[]>;
  windows: TimelineWindow[];
  quiet: QuietStrip[];
}

export interface ConvergeOptions {
  config: TimelineConfig;
  weights: TimelineWeights;
  /** `dasha.applicable` lists Ashtottari (S3 at full weight) */
  s3Applicable: boolean;
  foundation: Foundation;
  stack: DashaStack;
}

export const BAND_ORDER: Record<Band, number> = { quiet: 0, possible: 1, moderate: 2, high: 3 };

/** An activation runs in a month (dasha periods: on the 15th; transit activations: any overlap) */
export function runsIn(a: Activation, month: string): boolean {
  if (SYSTEM_FAMILY[a.system] === 'transit') return a.from < monthEnd(month) && a.to > monthStart(month);
  const mid = monthMid(month);
  return a.from <= mid && mid < a.to;
}

const DASHA_EDGE_SYSTEMS = new Set<SystemId>(['S1', 'S2', 'S3', 'S4']);

interface SideResult {
  gates: Gates;
  /** per system: [value, best activation] */
  per: Map<SystemId, { value: number; best: Activation }>;
  candidates: Array<{ planet: string; value: number }>;
}

function strongest(list: Activation[]): Activation | null {
  return list.reduce<Activation | null>((a, b) => (!a || b.strength > a.strength ? b : a), null);
}

/** One side (support or test) of one marker in one month */
export function scoreSide(month: string, marker: MarkerId, running: Activation[], polarity: Polarity, opts: ConvergeOptions, edge: number): SideResult {
  const { config, weights } = opts;
  const w = (s: SystemId): number => weightOf(weights, s, marker) * (s === 'S3' && !opts.s3Applicable ? config.s3NotApplicableFactor : 1);
  const acts = running.filter((a) => a.marker === marker && a.polarity === polarity);
  const bySys = (s: SystemId, level?: string): Activation[] => acts.filter((a) => a.system === s && (!level || a.level === level));
  const per = new Map<SystemId, { value: number; best: Activation }>();
  const candidates: Array<{ planet: string; value: number }> = [];
  const note = (s: SystemId, value: number, best: Activation | null): void => {
    if (!best || value <= 0) return;
    per.set(s, { value, best });
    candidates.push({ planet: best.planet, value: w(s) * best.strength });
  };

  const ad = strongest(bySys('S1', 'ad'));
  const md = strongest(bySys('S1', 'md'));
  const pd = strongest(bySys('S1', 'pd'));
  const d1 = Math.max(0, (ad?.strength ?? 0) + ((md?.strength ?? 0) >= 2 ? 1 : 0) + (pd ? 1 : 0));
  note('S1', d1, ad ?? md ?? pd);
  const n4 = strongest(bySys('S4'));
  const d4 = n4?.strength ?? 0;
  note('S4', d4, n4);

  // one planet, one vote: the Vimshottari lords running this month (any side) take precedence over the confirmers
  const s1Planets = new Set(running.filter((a) => a.system === 'S1').map((a) => a.planet));
  let d2 = 0;
  let d3 = 0;
  if (d1 >= 2 || d4 >= 2) {
    const y = strongest(bySys('S2').filter((a) => !s1Planets.has(a.planet)));
    d2 = y?.strength ?? 0;
    note('S2', d2, y);
    const yPlanets = new Set(running.filter((a) => a.system === 'S2').map((a) => a.planet));
    const t = strongest(bySys('S3').filter((a) => !s1Planets.has(a.planet) && !yPlanets.has(a.planet)));
    d3 = t?.strength ?? 0;
    note('S3', d3, t);
  }
  let D = w('S1') * d1 + w('S4') * d4 + w('S2') * d2 + w('S3') * d3;
  if (D > 0) {
    const mod = strongest(bySys('S7'));
    if (mod) {
      D += w('S7') * mod.strength;
      note('S7', mod.strength, mod);
    }
  }

  const dt = strongest(bySys('S6D'));
  const tc = strongest(bySys('S6'));
  note('S6D', dt?.strength ?? 0, dt);
  note('S6', tc?.strength ?? 0, tc);
  const T = w('S6D') * (dt?.strength ?? 0) + w('S6') * (tc?.strength ?? 0);

  const single = config.singleGateFactor;
  const score = D > 0 && T > 0 ? edge * (D + T) : D > 0 ? edge * D * single : T * single;
  const round = (n: number): number => Math.round(n * 100) / 100;
  return { gates: { D: round(D), T: round(T), E: edge, score: round(score) }, per, candidates };
}

/** Months in which a signifying period (strength 2+, AD/PD of S1-S4, either polarity) starts, per marker */
export function edgeStarts(all: readonly Activation[]): Map<MarkerId, Set<string>> {
  const out = new Map<MarkerId, Set<string>>();
  for (const a of all) {
    if (!DASHA_EDGE_SYSTEMS.has(a.system) || a.level === 'md' || a.strength < 2) continue;
    if (!out.has(a.marker)) out.set(a.marker, new Set());
    out.get(a.marker)!.add(monthOf(a.from));
  }
  return out;
}

/** Gate E for a month: 1.5 when a signifying period starts in it, 1.25 the month after, else 1 */
export function edgeFactor(month: string, starts: ReadonlySet<string> | undefined, config: TimelineConfig): number {
  if (starts?.has(month)) return config.edge.start;
  if (starts?.has(monthFromIndex(monthIndex(month) - 1))) return config.edge.next;
  return 1;
}

/** Rank-based band per month: `scores[i]` with its gate flags; returns the band of each month */
export function rankBands(cells: Array<{ score: number; D: number; T: number; month: string }>, bands: TimelineConfig['bands']): Band[] {
  const n = cells.length;
  const order = cells.map((c, i) => ({ ...c, i })).filter((c) => c.score > 0).sort((a, b) => b.score - a.score || b.T - a.T || a.month.localeCompare(b.month));
  const cut = (share: number): number => Math.round(share * n);
  const out: Band[] = cells.map(() => 'quiet');
  order.forEach((c, rank) => {
    if (rank < cut(bands.high) && c.T > 0 && c.D > 0) out[c.i] = 'high';
    else if (rank < cut(bands.moderate) && c.D > 0) out[c.i] = 'moderate';
    else if (rank < cut(bands.possible)) out[c.i] = 'possible';
  });
  return out;
}

/** The monthly grid, its merged windows and the quiet strips */
export function converge(activations: readonly Activation[], months: readonly string[], opts: ConvergeOptions): TimelineGrid {
  const rank = (p: string): number => opts.foundation.planets[p as keyof Foundation['planets']]?.shadbalaRank ?? 99;
  const raw = Object.fromEntries(MARKER_IDS.map((m) => [m, [] as Array<{ sup: SideResult; tst: SideResult }>])) as Record<MarkerId, Array<{ sup: SideResult; tst: SideResult }>>;
  const starts = edgeStarts(activations);
  for (const month of months) {
    const running = activations.filter((a) => runsIn(a, month));
    for (const m of MARKER_IDS) {
      const edge = edgeFactor(month, starts.get(m), opts.config);
      raw[m].push({ sup: scoreSide(month, m, running, 1, opts, edge), tst: scoreSide(month, m, running, -1, opts, edge) });
    }
  }

  const cells = Object.fromEntries(MARKER_IDS.map((m) => [m, [] as MonthCell[]])) as Record<MarkerId, MonthCell[]>;
  for (const m of MARKER_IDS) {
    const supBands = rankBands(raw[m].map((r, i) => ({ score: r.sup.gates.score, D: r.sup.gates.D, T: r.sup.gates.T, month: months[i]! })), opts.config.bands);
    const tstBands = rankBands(raw[m].map((r, i) => ({ score: r.tst.gates.score, D: r.tst.gates.D, T: r.tst.gates.T, month: months[i]! })), opts.config.bands);
    raw[m].forEach((r, i) => {
      const testing = BAND_ORDER[tstBands[i]!] > BAND_ORDER[supBands[i]!];
      const band = testing ? tstBands[i]! : supBands[i]!;
      const side = testing ? r.tst : r.sup;
      const systems: MonthCell['systems'] = {};
      for (const s of new Set([...r.sup.per.keys(), ...r.tst.per.keys()])) {
        const sp = r.sup.per.get(s);
        const tp = r.tst.per.get(s);
        const lead = (testing ? tp ?? sp : sp ?? tp)!.best;
        systems[s] = { support: sp?.value ?? 0, test: tp?.value ?? 0, planet: lead.planet, evidence: lead.evidence };
      }
      const cand = [...side.candidates].sort((a, b) => b.value - a.value || rank(a.planet) - rank(b.planet));
      const agent = cand[0]?.planet ?? null;
      const families = [side.gates.D > 0 ? 'dasha' : null, side.gates.T > 0 ? 'transit' : null].filter((x): x is string => x != null);
      cells[m].push({
        month: months[i]!,
        marker: m,
        band,
        testing,
        supportScore: r.sup.gates.score,
        testScore: r.tst.gates.score,
        support: r.sup.gates,
        test: r.tst.gates,
        families,
        systems,
        agent,
        channel: cand.find((c) => c.planet !== agent)?.planet ?? null,
      });
    });
  }

  const windows: TimelineWindow[] = [];
  for (const m of MARKER_IDS) {
    let cur: TimelineWindow | null = null;
    for (const c of cells[m]) {
      if (cur && c.band === cur.band && c.testing === cur.testing && monthIndex(c.month) === monthIndex(cur.toMonth) + 1) {
        cur.toMonth = c.month;
        cur.to = monthEnd(c.month);
        cur.months += 1;
        const peak = Math.max(c.supportScore, c.testScore) > Math.max(cur.supportScore, cur.testScore);
        cur.supportScore = Math.max(cur.supportScore, c.supportScore);
        cur.testScore = Math.max(cur.testScore, c.testScore);
        if (peak) Object.assign(cur, { peakMonth: c.month, systems: c.systems, agent: c.agent, channel: c.channel });
        continue;
      }
      if (cur) windows.push(cur);
      cur =
        c.band === 'quiet'
          ? null
          : { marker: m, fromMonth: c.month, toMonth: c.month, from: monthStart(c.month), to: monthEnd(c.month), months: 1, band: c.band, testing: c.testing, supportScore: c.supportScore, testScore: c.testScore, peakMonth: c.month, systems: c.systems, agent: c.agent, channel: c.channel };
    }
    if (cur) windows.push(cur);
  }

  const quiet: QuietStrip[] = [];
  months.forEach((month, i) => {
    if (MARKER_IDS.some((m) => BAND_ORDER[cells[m][i]!.band] >= BAND_ORDER.moderate)) return;
    const lords = `Vimshottari ${runningOn(opts.stack.rows, 'vimsottari', monthMid(month))
      .filter((r) => r.level <= 2)
      .map((r) => r.lord)
      .join('-')}`;
    const last = quiet.at(-1);
    if (last && months[i - 1] === last.toMonth && last.lords === lords) last.toMonth = month;
    else quiet.push({ fromMonth: month, toMonth: month, lords });
  });
  return { months: [...months], cells, windows, quiet };
}

/** Months 'YYYY-MM' where the marker is at least `min` (default moderate), either polarity */
export function flaggedMonths(grid: TimelineGrid, marker: MarkerId, min: Band = 'moderate'): Set<string> {
  return new Set(grid.cells[marker].filter((c) => BAND_ORDER[c.band] >= BAND_ORDER[min]).map((c) => c.month));
}
