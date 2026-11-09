/**
 * The annual set (`digest.annual_set`, docs/reading-engine/53 §4.1 and step 2): for every year from ten back to ten ahead,
 * the Tithi Pravesha and Varsha charts in D1, D9 and D10, the Tithi Pravesha year dasha (its default system), Mudda,
 * Patyayini and the sahams, as `kundli_data` year rows. Fetched through ensureChartData (the row is the lock, each item is
 * stored once), only the rows that are missing, at most DIGEST_ANNUAL_MAX_CALLS engine calls per run (default 40) so one
 * event never runs long: the sweep keeps filling. Nearest years first. Nothing here computes astrology.
 */
import { ensureChartData, type ChartItem, type EnsureDeps, type EnsureOptions } from '../chartData/store.js';

/** The engine options of the year chart in a divisional chart; D1 is the plain key */
export const ANNUAL_CHART_VARGAS = [1, 9, 10] as const;
export const ANNUAL_CHART_TYPES = ['annual.tithi_pravesha', 'annual.varsha'] as const;
/** One row per year, D1 only (the year dasha uses its catalogue default system) */
export const ANNUAL_YEAR_TYPES = ['annual.tithi_pravesha_dasha', 'annual.mudda', 'annual.patyayini', 'annual.sahams'] as const;
export const ANNUAL_SPAN_YEARS = 10;

export function annualMaxCalls(): number {
  const n = Number(process.env.DIGEST_ANNUAL_MAX_CALLS);
  return Number.isInteger(n) && n >= 0 && n <= 500 ? n : 40;
}

/** The years of the set, nearest to `year` first: year, year+1, year-1, year+2 … */
export function annualYears(year: number, span = ANNUAL_SPAN_YEARS): number[] {
  const out = [year];
  for (let d = 1; d <= span; d++) out.push(year + d, year - d);
  return out;
}

/** Every ensureChartData key of the set, nearest years first ('annual.varsha@2027;divisional_chart_factor=9' …). */
export function annualSetKeys(year: number, span = ANNUAL_SPAN_YEARS): string[] {
  const keys: string[] = [];
  for (const y of annualYears(year, span)) {
    for (const t of ANNUAL_CHART_TYPES) for (const f of ANNUAL_CHART_VARGAS) keys.push(f === 1 ? `${t}@${y}` : `${t}@${y};divisional_chart_factor=${f}`);
    for (const t of ANNUAL_YEAR_TYPES) keys.push(`${t}@${y}`);
  }
  return keys;
}

/** The year of an annual key ('annual.varsha@2027;divisional_chart_factor=9' -> 2027) */
function keyYear(k: string): number {
  return Number(/@(\d{4})/.exec(k)?.[1]);
}

/** Years complete after this run that were not complete before it. */
function completedYears(keys: string[], before: Record<string, ChartItem>, got: Record<string, ChartItem>): number[] {
  const years = new Map<number, { before: boolean; after: boolean }>();
  for (const k of keys) {
    const y = keyYear(k);
    const was = before[k]?.status === 'ready';
    const is = was || got[k]?.status === 'ready';
    const cur = years.get(y) ?? { before: true, after: true };
    years.set(y, { before: cur.before && was, after: cur.after && is });
  }
  return [...years].filter(([, v]) => v.after && !v.before).map(([y]) => y);
}

export interface AnnualSetResult {
  wanted: number;
  present: number;
  /** keys sent to ensureChartData for a fetch this run (each at most one engine call) */
  requested: number;
  fetched: number;
  failed: number;
  /** still missing after this run (the next run continues) */
  remaining: number;
  /** failed rows left alone this run because they tried within ANNUAL_FAILED_BACKOFF_MS */
  backedOff: number;
  /** years whose every key is ready now and was not before this run: the only change the digest needs a rebuild for */
  yearsCompleted: number[];
}

/** A failed annual row is retried at most this often (the store's own rule is a minute, which the 5-minute sweep hit every time) */
export const ANNUAL_FAILED_BACKOFF_MS = 6 * 3_600_000;

/**
 * Top up one kundli's annual set: read what is stored (no engine call), then fetch at most `maxCalls` missing keys.
 * Failed and unsupported rows wait out ensureChartData's own retry rules; they count as remaining.
 */
export async function ensureAnnualSet(
  deps: EnsureDeps,
  kundliId: string,
  opts: EnsureOptions & { year?: number; span?: number; maxCalls?: number } = {}
): Promise<AnnualSetResult> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const keys = annualSetKeys(year, opts.span ?? ANNUAL_SPAN_YEARS);
  const maxCalls = Math.max(0, Math.floor(opts.maxCalls ?? annualMaxCalls()));
  const stored = await ensureChartData(deps, kundliId, keys, { ...opts, noFetch: true });
  const missing = keys.filter((k) => stored[k]?.status !== 'ready');
  const now = opts.now?.() ?? Date.now();
  const coolingDown = (k: string) => {
    const it = stored[k];
    if (!it || (it.status !== 'failed' && it.status !== 'unsupported') || !it.triedAt) return false;
    return now - Date.parse(it.triedAt) < ANNUAL_FAILED_BACKOFF_MS;
  };
  const due = missing.filter((k) => !coolingDown(k));
  const batch = due.slice(0, maxCalls);
  let got: Record<string, ChartItem> = {};
  if (batch.length) got = await ensureChartData(deps, kundliId, batch, { ...opts, noFetch: false, concurrency: opts.concurrency ?? 1 });
  const fetched = batch.filter((k) => got[k]?.status === 'ready' && got[k]?.source === 'radha').length;
  const nowReady = batch.filter((k) => got[k]?.status === 'ready').length;
  return {
    wanted: keys.length,
    present: keys.length - missing.length,
    requested: batch.length,
    fetched,
    failed: batch.filter((k) => got[k] && got[k]!.status !== 'ready').length,
    remaining: missing.length - nowReady,
    backedOff: missing.length - due.length,
    yearsCompleted: completedYears(keys, stored, got),
  };
}
