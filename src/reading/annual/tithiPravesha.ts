/**
 * The year is read from the Tithi Pravesha (TP) chart whose return moment has passed (Sachin 2026-11-09,
 * docs/reading-engine/66 §4.10). One selector, `runningTithiPravesha`, picks that chart for every reader of the year:
 * S9 `self.sub.year`, the v1 year panels (self, love, work, body), the Self board service and the v1 oracle's
 * `family.year` pack.
 *
 * The rule: the TP year runs from its return moment `tp_start` to the next return `tp_end`. The running year is the one
 * with tp_start ≤ now < tp_end, compared as the person's local date-time (the engine writes both in the birth place's
 * local time). Before this year's return the previous year's TP chart is still in force; the calendar birthday is never
 * the boundary (the tithi return falls some days before or after it).
 *
 * Where the dates come from, best first (all of them the engine's; Node only compares stored date strings):
 *  1. `tp_start` / `tp_end` on the TP year row (engine lane AIAstra_Radha feat/dasha-levels-1-6);
 *  2. `valid_from` / `valid_to` on the stored `annual.tithi_pravesha` payload (the same return instants, already served);
 *  3. old digests that store neither: the TP D1 row whose own year dasha spans ≤ 400 days and covers asOf, with a gap.
 * When none resolves, there is no TP year (a gap says so). The Varsha (VP, solar return) year is NEVER used in its place:
 * Varshaphala and its Mudda dasha are only the confirming clock (`varsha`).
 *
 * The TP year dasha is the year's short clock only when its periods are bounded to that year (≤ 400 days). The stored
 * Tithi Ashtottari dasha of older engine builds is a lifetime dasha (TODOS: "Tithi Pravesha year dasha is a lifetime
 * dasha"); then `shortClock` is null with a gap. Node never rescales a dasha into the year.
 */
import type { AnnualRow, DigestView } from '../digest/types.js';

export const MAX_TP_YEAR_DAYS = 400;
const DAY_MS = 86_400_000;

type AnnualSource = Pick<DigestView, 'annual'>;
export type TpBasis = 'tp_start' | 'valid_from' | 'dasha_span';

export interface TpShortClock {
  system: string;
  lord: string;
  from: string;
  to: string;
}

export interface RunningVarsha {
  row: AnnualRow;
  lord: string;
  from: string;
  to: string;
}

export interface RunningTithiPravesha {
  /** the TP D1 row in force at asOf; null when no TP year resolves (never a VP row) */
  row: AnnualRow | null;
  year: number | null;
  /** the year window as dates (YYYY-MM-DD): the return day and the next return day; null when not stored */
  from: string | null;
  to: string | null;
  /** the exact return moments as stored ('YYYY-MM-DD HH:MM:SS', local), when stored */
  start: string | null;
  end: string | null;
  basis: TpBasis | null;
  /** the TP year dasha period covering asOf, only when that dasha is bounded to the year */
  shortClock: TpShortClock | null;
  /** the TP year dasha's periods, only when bounded to the year */
  yearDasha: { system: string; periods: Array<{ lord: string; from: string; to: string }> } | null;
  /** the Varshaphala row and running Mudda period covering asOf: the confirming clock, never the year */
  varsha: RunningVarsha | null;
  /** staff-only reasons (old digest, no tp_start, unbounded dasha, no TP row) */
  gaps: string[];
}

/** 'YYYY-MM-DD' → noon of that day; 'YYYY-MM-DDTHH:MM[:SS][.sss][Z|±hh:mm]' or with a space → 'YYYY-MM-DD HH:MM:SS' */
export function localStamp(s: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s.trim());
  if (!m) return s;
  if (m[2] === undefined) return `${m[1]} 12:00:00`;
  return `${m[1]} ${m[2]}:${m[3]}:${m[4] ?? '00'}`;
}

const day = (s: string) => s.slice(0, 10);
const days = (from: string, to: string) => (new Date(`${day(to)}T00:00:00Z`).getTime() - new Date(`${day(from)}T00:00:00Z`).getTime()) / DAY_MS;

function spanOf(periods: Array<{ from: string; to: string }>): { from: string; to: string } | null {
  if (!periods.length) return null;
  return { from: periods.map((p) => p.from).sort()[0]!, to: periods.map((p) => p.to).sort().at(-1)! };
}

/** a TP year dasha bounded to its own year (the engine fix): its span is at most MAX_TP_YEAR_DAYS */
function boundedDasha(row: AnnualRow): AnnualRow['dashas'][number] | null {
  for (const d of row.dashas) {
    const s = spanOf(d.periods);
    if (s && days(s.from, s.to) > 0 && days(s.from, s.to) <= MAX_TP_YEAR_DAYS) return d;
  }
  return null;
}

/** The Varshaphala (VP) D1 row whose Mudda periods cover asOf, and the running Mudda period: the confirming clock. */
export function runningVarsha(view: AnnualSource, asOf: string): RunningVarsha | null {
  const d = day(asOf);
  for (const row of view.annual()) {
    if (row.kind !== 'VP' || row.varga !== 'D1') continue;
    const mudda = row.dashas.find((x) => x.system === 'mudda');
    const p = mudda?.periods.find((x) => x.from <= d && d < x.to);
    if (p) return { row, lord: p.lord, from: p.from, to: p.to };
  }
  return null;
}

/**
 * The Tithi Pravesha year in force at `asOfDateTime` (the person's local date or date-time; a bare date is read at noon).
 * See the module comment for the rule and the fallbacks.
 */
export function runningTithiPravesha(view: AnnualSource, asOfDateTime: string): RunningTithiPravesha {
  const now = localStamp(asOfDateTime);
  const today = day(now);
  const gaps: string[] = [];
  const varsha = runningVarsha(view, today);
  const none = (): RunningTithiPravesha => ({ row: null, year: null, from: null, to: null, start: null, end: null, basis: null, shortClock: null, yearDasha: null, varsha, gaps });
  const tpRows = view.annual().filter((r) => r.kind === 'TP' && r.varga === 'D1');
  if (!tpRows.length) {
    gaps.push('annual: no Tithi Pravesha year row stored');
    return none();
  }

  let row: AnnualRow | null = null;
  let basis: TpBasis | null = null;
  let start: string | null = null;
  let end: string | null = null;
  // 1–2: the stored return moments. The running year is the latest one whose return has passed and whose next
  // return (when stored) has not; rows are compared by their own start, so the next year's row ends the previous one.
  const dated = tpRows
    .filter((r) => typeof r.start === 'string' && r.start)
    .sort((a, b) => localStamp(a.start!).localeCompare(localStamp(b.start!)));
  if (dated.length) {
    const passed = dated.filter((r) => localStamp(r.start!) <= now);
    const cand = passed.at(-1) ?? null;
    if (cand) {
      const next = dated.find((r) => localStamp(r.start!) > localStamp(cand.start!));
      const candEnd = cand.end ? localStamp(cand.end) : next ? localStamp(next.start!) : null;
      if (candEnd && now >= candEnd) {
        gaps.push(`annual: no stored Tithi Pravesha year covers ${now} (the latest stored year TP${cand.year} ended ${candEnd})`);
      } else {
        row = cand;
        basis = cand.startBasis === 'valid_from' ? 'valid_from' : 'tp_start';
        start = localStamp(cand.start!);
        end = candEnd;
        if (!candEnd) gaps.push(`annual: TP${cand.year} end of year not stored`);
      }
    } else {
      gaps.push(`annual: the earliest stored Tithi Pravesha year starts after ${now}`);
    }
  }
  // 3: an older digest with no stored return moment: the TP row whose own year dasha (bounded) covers today
  if (!row && !dated.length) {
    for (const r of tpRows) {
      const d = boundedDasha(r);
      const s = d ? spanOf(d.periods) : null;
      if (s && s.from <= today && today < s.to) {
        row = r;
        basis = 'dasha_span';
        start = null;
        end = null;
        gaps.push(`annual: TP${r.year} picked by its year-dasha span; tp_start not stored (rebuild the digest after the engine release)`);
        break;
      }
    }
    if (!row) gaps.push(`annual: tp_start not stored and no bounded TP year dasha covers ${today}; the Tithi Pravesha year is not resolved (the Varsha year is not used in its place)`);
  }
  if (!row) return none();

  const d = boundedDasha(row);
  let shortClock: TpShortClock | null = null;
  let yearDasha: RunningTithiPravesha['yearDasha'] = null;
  if (d) {
    yearDasha = { system: d.system, periods: d.periods.map((p) => ({ ...p })) };
    const p = d.periods.find((x) => x.from <= today && today < x.to);
    if (p) shortClock = { system: d.system, lord: p.lord, from: p.from, to: p.to };
    else gaps.push(`annual: TP${row.year} year dasha has no period covering ${today}`);
  } else if (row.dashas.length) {
    gaps.push(`annual: TP${row.year} year dasha is a lifetime dasha (engine fix pending); the TP short clock is withheld`);
  } else {
    gaps.push(`annual: TP${row.year} year dasha not stored`);
  }
  const bounded = d ? spanOf(d.periods) : null;
  const from = start ? day(start) : (bounded?.from ?? null);
  const to = end ? day(end) : (bounded?.to ?? null);
  return { row, year: row.year, from, to, start, end, basis, shortClock, yearDasha, varsha, gaps };
}

/** The TP row of the running year in another varga (D9, D10 …), or null. */
export function tpRowIn(view: AnnualSource, tp: RunningTithiPravesha, varga: string): AnnualRow | null {
  if (tp.year == null) return null;
  return view.annual(tp.year).find((r) => r.kind === 'TP' && r.varga === varga) ?? null;
}

/**
 * The rule block every reader of the year gets (prompts/*.md carry the same words; doc 66 §4.10). No years are named:
 * TODAY and the stored return moments decide.
 */
export const TITHI_PRAVESHA_YEAR_RULE =
  "THE YEAR (Tithi Pravesha rule): read the year from the Tithi Pravesha chart whose return moment has passed. TODAY is given. A Tithi Pravesha year runs from its return moment (tp_start) to the next return (tp_end); before this year's return the previous year's Tithi Pravesha chart is still in force. The Tithi Pravesha year dasha periods are bounded to that year. Varshaphala and its Mudda dasha only confirm; they never pick the year. Never assume the calendar birthday is the boundary. Never name a year chart that does not cover TODAY as this year's.";
