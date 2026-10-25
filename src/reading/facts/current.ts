/**
 * The dossier is built once per kundli, but "the running dasha" changes every few weeks. This re-selects the running
 * period from the dated periods the engine already supplied (a date comparison, not a calculation), so a dossier built
 * last month still reports today's MD/AD/PD. If today falls outside the engine's PD window the dossier is flagged
 * stale so a rebuild is queued.
 */
import type { PlanetCode } from './constants.js';
import type { DashaCurrent, DashaPeriod, Dossier, NarayanaPeriod } from './types.js';

export interface RefreshResult {
  dossier: Dossier;
  /** true when asOf is outside (or close to the edge of) the PD-level window, so a rebuild should be queued */
  stale: boolean;
}

const addDays = (iso: string, days: number): string => new Date(Date.parse(iso + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

function selectVimshottari(d: Dossier, asOf: string): DashaCurrent {
  const v = d.dasha.vimshottari;
  const cur: DashaCurrent = {};
  const md = v.mahadashas.find((m) => m.start <= asOf && asOf < m.end);
  if (md) {
    cur.md = md.md as PlanetCode;
    cur.md_start = md.start;
    cur.md_end = md.end;
  }
  const rows = v.periods.filter((p) => md && p.md === md.md);
  const pdRow = rows.find((p) => p.level === 'pd' && p.start <= asOf && asOf <= p.end);
  const adRow = pdRow ?? rows.find((p) => p.start <= asOf && asOf <= p.end);
  if (adRow) {
    cur.ad = adRow.ad;
    const sameAd = rows.filter((p) => p.ad === adRow.ad);
    // contiguous run around the current row
    let lo = adRow.start;
    let hi = adRow.end;
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of sameAd) {
        if (p.start < lo && p.end >= addDays(lo, -1)) {
          lo = p.start;
          grew = true;
        }
        if (p.end > hi && p.start <= addDays(hi, 1)) {
          hi = p.end;
          grew = true;
        }
      }
    }
    cur.ad_start = lo;
    cur.ad_end = hi;
  }
  if (pdRow?.pd) {
    cur.pd = pdRow.pd;
    cur.pd_start = pdRow.start;
    cur.pd_end = pdRow.end;
  }
  return cur;
}

function selectNarayana(d: Dossier, asOf: string): Record<string, unknown> {
  const periods: NarayanaPeriod[] = d.dasha.narayana.periods;
  const idx = periods.findIndex((p) => p.start <= asOf && asOf < p.end);
  if (idx < 0) return d.dasha.narayana.current;
  const p = periods[idx]!;
  let a = idx;
  let b = idx;
  while (a > 0 && periods[a - 1]!.md_sign === p.md_sign) a -= 1;
  while (b + 1 < periods.length && periods[b + 1]!.md_sign === p.md_sign) b += 1;
  return { ...p, md_start: periods[a]!.start, md_end: periods[b]!.end };
}

export function refreshCurrent(d: Dossier, asOf: string): RefreshResult {
  const window = d.dasha.vimshottari.window;
  const stale = !!window && (asOf < window.pd_from || asOf > addDays(window.pd_to, -60));
  if (d.as_of === asOf) return { dossier: d, stale };
  const current = selectVimshottari(d, asOf);
  const out: Dossier = {
    ...d,
    as_of: asOf,
    dasha: {
      vimshottari: { ...d.dasha.vimshottari, current: Object.keys(current).length ? current : d.dasha.vimshottari.current },
      narayana: { ...d.dasha.narayana, current: selectNarayana(d, asOf) },
    },
  };
  return { dossier: out, stale };
}

export type { DashaPeriod };
