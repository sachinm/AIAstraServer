/**
 * Retry for failed engine rows (docs/techniques/11 rev 4 §4.2 "Retry"; step 3, first half). A row that blocks the first
 * pass and fails is asked again after 1, 5 and 15 minutes, then whenever it is next asked (each 15-minute sweep), in place
 * of the old long waits (the 6-hour sweep settle, the 24-hour clock wait); after PIPELINE_GIVE_UP_FAILURES failures in a
 * row it is given up and named as a gap. A row the engine refuses for that input (it answers "invalid export type" or
 * "unsupported": the `kaala` clock row of the test chart) is kept `unsupported`, named, and not retried: it is looked at
 * again only after PIPELINE_REFUSED_RECHECK_DAYS, when something asks for it.
 *
 * The delays are "not before" times: nothing waits inside a run for them. The sweep runs every 15 minutes and the sync run
 * asks once per row, so in practice a row is asked again at the first sync or sweep after its delay.
 *
 * Which rows: the registration set (natal rows and the annual `current` pointers) through `chartData/store.ts`, and the
 * clock set's dated rows (`pressure_inventory`) through `self/sub/pressure.ts`. The yearly rows (`year=<y>` variants, the
 * annual set's own pull and its 6-hour backoff) keep their rules (doc 11 step 3 second half; ANNUAL_SPAN_YEARS and
 * DIGEST_ANNUAL_MAX_CALLS unchanged).
 *
 * PURE: no database, no clock of its own (every function takes `now`). Nothing astrological.
 */

/** A failed row is given up and named after this many failures in a row (doc 11 §4.2). */
export const PIPELINE_GIVE_UP_FAILURES = 6;

/** The waits after the 1st, 2nd and 3rd failure; from the 4th on a row is due at once (each sweep). */
export const RETRY_DELAYS_MS: readonly number[] = [60_000, 5 * 60_000, 15 * 60_000];

/** The wait before asking again after `failures` failures in a row: 1, 5, 15 minutes, then none. */
export function retryDelayMs(failures: number): number {
  if (!Number.isFinite(failures) || failures <= 0) return 0;
  return RETRY_DELAYS_MS[Math.floor(failures) - 1] ?? 0;
}

/** The registration rows the schedule covers: every variant but a fixed year (`year=<y>`, the annual set's pull). */
export function isRetryScheduled(variant: string): boolean {
  return !variant.startsWith('year=');
}

/**
 * The engine's refusal of this type for this input: it will answer the same way every time, so asking again is waste.
 * Keyed on the engine's text ("Invalid export type: pressure_inventory", "Invalid type: …", "unsupported"), as the store's
 * own `isUnsupportedError` does for the registration rows.
 */
export function isEngineRefusal(message: string | null | undefined): boolean {
  return /invalid (export )?type|unsupported|not served|does not serve/i.test(message ?? '');
}

export type RetryState = 'due' | 'waiting' | 'given_up' | 'unsupported';

export interface RetryInput {
  /** failures in a row so far (the store's `[failures=n …]` mark; an unmarked failure counts as one) */
  failures: number;
  /** when the last attempt started or ended */
  lastAttemptAt: Date | null;
  /** the failure's message (the mark's message part); an engine refusal makes the row unsupported */
  message?: string | null;
  /** the row is already `unsupported` */
  unsupported?: boolean;
  /** the store's give-up mark is set (`valid_to` = FAILED_GIVE_UP_UNTIL) */
  givenUpMark?: boolean;
}

export interface RetryVerdict {
  state: RetryState;
  failures: number;
  /** when it may be asked again (null: given up) */
  dueAt: Date | null;
}

/**
 * What to do with one failed (or refused) row now. Refused: `unsupported` until `refusedRecheckMs` after the last
 * attempt, then `due` once more. Given up at `giveUpAt` failures or with the store's mark. Otherwise due when the delay
 * after its last attempt has passed.
 */
export function retryVerdict(r: RetryInput, now: Date, opts: { giveUpAt?: number; refusedRecheckMs?: number } = {}): RetryVerdict {
  const failures = Math.max(1, Math.floor(r.failures || 1));
  const last = r.lastAttemptAt?.getTime() ?? null;
  if (r.unsupported || isEngineRefusal(r.message)) {
    const recheck = opts.refusedRecheckMs ?? 30 * 86_400_000;
    const dueAt = new Date((last ?? now.getTime()) + recheck);
    return { state: last != null && now.getTime() >= dueAt.getTime() ? 'due' : 'unsupported', failures, dueAt };
  }
  if (r.givenUpMark || failures >= (opts.giveUpAt ?? PIPELINE_GIVE_UP_FAILURES)) return { state: 'given_up', failures, dueAt: null };
  const dueAt = new Date((last ?? now.getTime()) + retryDelayMs(failures));
  return { state: now.getTime() >= dueAt.getTime() ? 'due' : 'waiting', failures, dueAt };
}

/** One stored clock row that failed or was refused, as the clock retry reads it. */
export interface StoredClockRow {
  system: string;
  status: string;
  failures: number;
  lastAttemptAt: Date | null;
  message: string | null;
  givenUpMark: boolean;
}

/**
 * The clocks to ask for this run and the rows to rewrite as unsupported. Every clock of the set is asked (the loader
 * applies the schedule to its own row). A failed clock outside today's set is asked too while it is due, so the sweep
 * that picked the chart for it settles it (given up after PIPELINE_GIVE_UP_FAILURES) instead of picking it forever. A
 * failed row whose message is an engine refusal is rewritten `unsupported`, in or out of the set, and not asked.
 */
export function clocksToAsk(set: readonly string[], stored: readonly StoredClockRow[], now: Date, opts: { refusedRecheckMs?: number } = {}): { ask: string[]; refused: string[] } {
  const ask = [...set];
  const refused: string[] = [];
  for (const r of stored) {
    if (r.status !== 'failed') continue;
    const v = retryVerdict({ failures: r.failures, lastAttemptAt: r.lastAttemptAt, message: r.message, givenUpMark: r.givenUpMark }, now, opts);
    if (v.state === 'unsupported') {
      refused.push(r.system);
      continue;
    }
    if (v.state === 'due' && !ask.includes(r.system)) ask.push(r.system);
  }
  return { ask: ask.filter((s) => !refused.includes(s) || set.includes(s)), refused };
}
