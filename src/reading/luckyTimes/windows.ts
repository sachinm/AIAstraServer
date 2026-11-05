/**
 * The Lucky times windows engine (docs/reading-engine/49 §4.1). Pure: no I/O, no clock reads.
 *
 * Input is one engine `muhurta` day row as stored in `day_tables.payload` (every time and number is the engine's) plus
 * an optional personal overlay (tara and chandra bala from the engine). Output is, per scenario, the best windows of the
 * day with plain-word reason keys. Node only cuts the engine's windows by the engine's avoid bands and adds the scores
 * the scenario table (scenarios.ts, cited) assigns; it derives no astrological value.
 */
import { scenarioById, starGroupOf, tithiGroupOf, type Lord, type ScenarioRule, type Weekday } from './scenarios.js';

/** The engine's CLOCK: hours from the local midnight of the row's date (may exceed 24). */
export interface Clock {
  time?: string;
  day_offset?: number;
  hours?: number;
}
type T = string | Clock;
export interface Span {
  start: T;
  end: T;
}
export interface DayRow {
  date: string;
  weekday?: string;
  sunrise?: string;
  sunset?: string;
  abhijit?: Span;
  rahu_kalam?: Span;
  yamagandam?: Span;
  gulikai?: Span;
  durmuhurtam?: Span[];
  brahma_muhurta?: Span;
  amrita_gadiya?: Span[];
  varjyam?: Span[];
  muhurtas?: Array<Span & { name?: string; good?: boolean }>;
  horas?: Array<Span & { lord?: string }>;
  panchanga_at_noon?: {
    tithi?: { number?: number; start_hours?: number; end_hours?: number };
    nakshatra?: { number?: number; start_hours?: number; end_hours?: number };
  };
}

/** The engine's personal fields for a day (muhurta with natal fields): its own good/bad verdicts are used as given. */
export interface PersonalDay {
  tara?: { name?: string; good?: boolean | null } | null;
  chandra_bala?: { house_from_moon?: number; good?: boolean | null } | null;
}

/** Minutes from local midnight of the row's date. */
export function toMin(v: T | undefined): number {
  if (v == null) return NaN;
  if (typeof v === 'string') {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 60 : NaN;
  }
  if (typeof v.hours === 'number') return v.hours * 60;
  if (typeof v.time === 'string') return toMin(v.time) + (v.day_offset ?? 0) * 1440;
  return NaN;
}

interface Range {
  from: number;
  to: number;
}

/** A span as minutes; an end earlier than its start is read as past midnight. */
function rangeOf(s: Span | undefined): Range | null {
  if (!s) return null;
  const from = toMin(s.start);
  let to = toMin(s.end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (to < from) to += 1440;
  return { from, to };
}

/** The horas in time order, unwrapped past midnight. */
function horaRanges(row: DayRow): Array<Range & { lord: string }> {
  const out: Array<Range & { lord: string }> = [];
  let shift = 0;
  let last = -Infinity;
  for (const h of row.horas ?? []) {
    let from = toMin(h.start) + shift;
    if (from < last - 1) {
      shift += 1440;
      from += 1440;
    }
    let to = toMin(h.end) + shift;
    if (to < from) to += 1440;
    if (Number.isFinite(from) && Number.isFinite(to)) out.push({ from, to, lord: h.lord ?? '' });
    last = from;
  }
  return out;
}

export type AvoidKind = 'rahu_kalam' | 'yamagandam' | 'gulikai' | 'durmuhurtam' | 'varjyam';
export interface AvoidBand extends Range {
  kind: AvoidKind;
}

export function avoidBands(row: DayRow): AvoidBand[] {
  const out: AvoidBand[] = [];
  const add = (kind: AvoidKind, s: Span | undefined) => {
    const r = rangeOf(s);
    if (r) out.push({ kind, ...r });
  };
  add('rahu_kalam', row.rahu_kalam);
  add('yamagandam', row.yamagandam);
  add('gulikai', row.gulikai);
  for (const d of row.durmuhurtam ?? []) add('durmuhurtam', d);
  for (const v of row.varjyam ?? []) add('varjyam', v);
  return out.sort((a, b) => a.from - b.from);
}

/** `r` minus every band, as the remaining pieces. */
export function cut(r: Range, bands: Range[]): Range[] {
  let pieces: Range[] = [r];
  for (const b of bands) {
    const next: Range[] = [];
    for (const p of pieces) {
      if (b.to <= p.from || b.from >= p.to) next.push(p);
      else {
        if (b.from > p.from) next.push({ from: p.from, to: b.from });
        if (b.to < p.to) next.push({ from: b.to, to: p.to });
      }
    }
    pieces = next;
  }
  return pieces;
}

const overlap = (a: Range, b: Range): number => Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));

export interface Window {
  from: number;
  to: number;
  score: number;
  reasons: string[];
}

export interface ScenarioDay {
  scenario: string;
  windows: Window[];
  /** why there is nothing: the whole day avoided, or nothing reached the floor */
  verdict: 'good' | 'none' | 'avoid_day';
  dayReasons: string[];
}

function personalScore(p: PersonalDay | undefined): { score: number; reasons: string[] } {
  if (!p) return { score: 0, reasons: [] };
  let score = 0;
  const reasons: string[] = [];
  if (p.tara?.good === true) {
    score += 1;
    reasons.push('personal:tara_good');
  } else if (p.tara?.good === false) {
    score -= 1;
    reasons.push('personal:tara_bad');
  }
  if (p.chandra_bala?.good === true) {
    score += 1;
    reasons.push('personal:moon_good');
  } else if (p.chandra_bala?.good === false) {
    score -= 1;
    reasons.push('personal:moon_bad');
  }
  return { score, reasons };
}

/** The noon tithi and star apply only inside their own spans; outside them the day has no tithi or star rule. */
function spanOf(x: { start_hours?: number; end_hours?: number } | undefined): Range | null {
  if (!x || typeof x.end_hours !== 'number') return null;
  return { from: typeof x.start_hours === 'number' ? x.start_hours * 60 : -Infinity, to: x.end_hours * 60 };
}

const MIN_PIECE = 20;

export function scenarioDay(row: DayRow, rule: ScenarioRule, personal?: PersonalDay): ScenarioDay {
  const weekday = (row.weekday ?? '') as Weekday;
  const dayReasons: string[] = [];
  if (rule.dayAvoid.includes(weekday)) return { scenario: rule.id, windows: [], verdict: 'avoid_day', dayReasons: [`weekday_avoid:${weekday}`] };

  const tithiNo = row.panchanga_at_noon?.tithi?.number;
  const tithiGroup = typeof tithiNo === 'number' ? tithiGroupOf(tithiNo) : null;
  const tithiSpan = spanOf(row.panchanga_at_noon?.tithi);
  const starNo = row.panchanga_at_noon?.nakshatra?.number;
  const starGroup = typeof starNo === 'number' ? starGroupOf(starNo) : null;
  const starSpan = spanOf(row.panchanga_at_noon?.nakshatra);

  const sunrise = toMin(row.sunrise);
  const from = rule.hours[0] === 'sunrise' ? sunrise : rule.hours[0] * 60;
  const to = rule.hours[1] * 60;
  const bands = avoidBands(row);
  const goods = {
    abhijit: rangeOf(row.abhijit),
    amrita: (row.amrita_gadiya ?? []).map(rangeOf).filter((r): r is Range => !!r),
    brahma: rangeOf(row.brahma_muhurta),
  };
  const goodMuhurtas = (row.muhurtas ?? []).filter((m) => m.good).map(rangeOf).filter((r): r is Range => !!r);
  const pers = personalScore(personal);
  const weekdayBoost = rule.dayFavour.includes(weekday) ? 1 : 0;

  const candidates: Array<Range & { lord?: string; brahma?: boolean }> = [];
  for (const h of horaRanges(row)) {
    const r = { from: Math.max(h.from, from), to: Math.min(h.to, to) };
    if (r.to - r.from >= MIN_PIECE) candidates.push({ ...r, lord: h.lord });
  }
  if (rule.useBrahma && goods.brahma) candidates.push({ ...goods.brahma, brahma: true });

  const windows: Window[] = [];
  for (const c of candidates) {
    for (const piece of cut(c, bands)) {
      if (Math.floor(piece.to) - Math.ceil(piece.from) < MIN_PIECE) continue;
      let score = weekdayBoost + pers.score;
      const reasons: string[] = [...pers.reasons];
      if (weekdayBoost) reasons.push(`weekday:${weekday}`);
      const mid = { from: piece.from, to: piece.to };
      // tithi: only inside its own span
      if (tithiGroup && tithiSpan && overlap(mid, tithiSpan) >= (piece.to - piece.from) / 2) {
        if (rule.tithiAvoid.includes(tithiGroup)) continue;
        if (rule.tithiFavour.includes(tithiGroup)) {
          score += 1;
          reasons.push(`tithi:${tithiGroup}`);
        }
      }
      if (starGroup && starSpan && overlap(mid, starSpan) >= (piece.to - piece.from) / 2) {
        if (rule.starFavour.includes(starGroup)) {
          score += 1;
          reasons.push(`star:${starGroup}`);
        } else if (rule.starAvoid.includes(starGroup)) {
          score -= 2;
          reasons.push(`star_avoid:${starGroup}`);
        }
      }
      if (c.brahma) {
        score += 2;
        reasons.push('brahma');
      } else if (c.lord) {
        if (rule.horaFavour.includes(c.lord as Lord)) {
          score += 2;
          reasons.push(`hora:${c.lord}`);
        } else if (rule.horaAvoid.includes(c.lord as Lord)) {
          score -= 3;
          reasons.push(`hora_avoid:${c.lord}`);
        }
      }
      if (goods.abhijit && overlap(piece, goods.abhijit) >= 10) {
        score += 2;
        reasons.push('abhijit');
      }
      if (goods.amrita.some((a) => overlap(piece, a) >= 10)) {
        score += 2;
        reasons.push('amrita');
      }
      const goodMin = goodMuhurtas.reduce((n, m) => n + overlap(piece, m), 0);
      if (goodMin >= (piece.to - piece.from) / 2) {
        score += 1;
        reasons.push('good_muhurta');
      }
      if (score >= rule.floor) windows.push({ from: Math.ceil(piece.from), to: Math.floor(piece.to), score, reasons });
    }
  }
  windows.sort((a, b) => b.score - a.score || a.from - b.from);
  const best = windows.slice(0, 2).sort((a, b) => a.from - b.from);
  if (tithiGroup && rule.tithiAvoid.includes(tithiGroup) && best.length === 0) dayReasons.push(`tithi_avoid:${tithiGroup}`);
  return { scenario: rule.id, windows: best, verdict: best.length ? 'good' : dayReasons.length ? 'avoid_day' : 'none', dayReasons };
}

export function scenarioDayById(row: DayRow, scenarioId: string, personal?: PersonalDay): ScenarioDay | null {
  const rule = scenarioById(scenarioId);
  return rule ? scenarioDay(row, rule, personal) : null;
}

export type NowState =
  | { kind: 'avoid'; band: AvoidKind; until: number }
  | { kind: 'good'; what: 'abhijit' | 'amrita' | 'brahma'; until: number }
  | { kind: 'neutral'; next?: { what: string; from: number } };

/** What is running at `nowMin` (minutes from the row's local midnight). */
export function nowState(row: DayRow, nowMin: number): NowState {
  const band = avoidBands(row).find((b) => nowMin >= b.from && nowMin < b.to);
  if (band) return { kind: 'avoid', band: band.kind, until: Math.round(band.to) };
  const named: Array<[('abhijit' | 'amrita' | 'brahma'), Range | null]> = [
    ['abhijit', rangeOf(row.abhijit)],
    ['brahma', rangeOf(row.brahma_muhurta)],
    ...(row.amrita_gadiya ?? []).map((a) => ['amrita', rangeOf(a)] as ['amrita', Range | null]),
  ];
  for (const [what, r] of named) if (r && nowMin >= r.from && nowMin < r.to) return { kind: 'good', what, until: Math.round(r.to) };
  const upcoming = named.filter(([, r]) => r && r.from > nowMin).sort((a, b) => a[1]!.from - b[1]!.from)[0];
  return { kind: 'neutral', next: upcoming ? { what: upcoming[0], from: Math.round(upcoming[1]!.from) } : undefined };
}

/** Minutes since local midnight in a zone at an instant (clock arithmetic only). */
export function localMinutes(at: Date, tzName: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tzName, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
