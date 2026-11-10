/**
 * The reading clock (technique `self.reading.clock`, docs/reading-engine/58 §4.1): which dasha system the You reading's
 * chapters follow for this kundli, and which clocks confirm them. Order: the kundli's stored preference when that system
 * has periods → the first conditional system the engine says applies (activation family `conditional`) → Vimshottari.
 * Selection only: applicability is the engine's verdict carried on the activation rows.
 */
import { getReadingClockOrder, getReadingClocks, getSelfClockConditionalOrder, getSelfConfirmSystems } from '../../config/env.js';
import { applicableConditionalSystems } from '../digest/activation.js';
import type { SelfClock } from './types.js';
import { clockLabel } from './words.js';

export interface SystemPresence {
  system: string;
  family: string;
}

export function resolveClock(preferred: string | null | undefined, present: readonly SystemPresence[]): SelfClock {
  const has = new Set(present.map((p) => p.system));
  const conditional = present.filter((p) => p.family === 'conditional').map((p) => p.system);
  const order = getSelfClockConditionalOrder();
  const applicable = order.filter((s) => conditional.includes(s));
  let system: string;
  let reason: SelfClock['reason'];
  if (preferred && has.has(preferred)) {
    system = preferred;
    reason = 'preferred';
  } else if (applicable[0]) {
    system = applicable[0];
    reason = 'applicable';
  } else {
    system = 'vimsottari';
    reason = 'default';
  }
  const confirming = getSelfConfirmSystems().filter((s) => s !== system && has.has(s));
  const choiceIds = [...new Set([system, ...applicable, ...getSelfConfirmSystems().filter((s) => has.has(s)), ...present.map((p) => p.system)])];
  return {
    system,
    label: clockLabel(system),
    reason,
    confirming: confirming.map((s) => ({ system: s, label: clockLabel(s) })),
    choices: choiceIds.map((s) => ({ system: s, label: clockLabel(s) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Self board v2 (docs/reading-engine/66 §4.4, S1 `self.sub.clock`): the clocks the person may switch to are the ones the
// engine says apply plus the configured confirming clocks, never every stored system. Conditional clocks the engine
// says do not apply, or did not check, are listed apart with the engine's verdict. Selection only.
// ---------------------------------------------------------------------------------------------------------------------

/** One row of the engine's `dasha.applicable` export: the system, its stored spellings, and the verdict. */
export interface ApplicabilityRow {
  system: string;
  names: string[];
  /** true applies, false does not, null not checked by the engine */
  applies: boolean | null;
}

/** The engine's `dasha.applicable` payload as rows; anything unreadable is skipped. */
export function parseApplicability(raw: unknown): ApplicabilityRow[] {
  const out: ApplicabilityRow[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== 'object' || typeof (r as { type?: unknown }).type !== 'string') continue;
    const type = (r as { type: string }).type;
    const system = type.replace(/^dasha\./, '');
    if (!system) continue;
    const a = (r as { applies?: unknown }).applies;
    // `applies` missing is read as applying, as applicableConditionalSystems does
    const applies = a === true || a === undefined ? true : a === false ? false : null;
    out.push({ system, names: [...applicableConditionalSystems([{ type, applies: true }])], applies });
  }
  return out;
}

export type NotApplicableCause = 'does_not_apply' | 'not_checked' | 'no_periods';

export interface ClockResolutionV2 {
  primary: string;
  reason: 'preferred' | 'conditional_applies' | 'default';
  confirming: string[];
  /** selectable, primary first */
  applicable: string[];
  notApplicable: Array<{ system: string; cause: NotApplicableCause }>;
}

/**
 * The engine's verdict on each conditional clock (in `SELF_CLOCK_CONDITIONAL_ORDER`, then any other system the
 * `dasha.applicable` export names): which apply and have stored periods, and which do not apply, were not checked or have
 * no periods. Selection only; shared by `resolveClockV2` and `resolveReadingClocks`.
 */
export function conditionalVerdicts(present: readonly SystemPresence[], applicability: readonly ApplicabilityRow[] | null): {
  applying: string[];
  notApplicable: Array<{ system: string; cause: NotApplicableCause }>;
  rowFor: (s: string) => ApplicabilityRow | null;
} {
  const has = new Set(present.map((p) => p.system));
  const familyConditional = new Set(present.filter((p) => p.family === 'conditional').map((p) => p.system));
  const rowFor = (s: string) => applicability?.find((r) => r.system === s || r.names.includes(s)) ?? null;
  const storedName = (s: string): string | null => {
    if (has.has(s)) return s;
    return rowFor(s)?.names.find((n) => has.has(n)) ?? null;
  };
  const candidates = [...new Set([...getSelfClockConditionalOrder(), ...(applicability ?? []).map((r) => r.system)])];
  const applying: string[] = [];
  const notApplicable: Array<{ system: string; cause: NotApplicableCause }> = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const row = rowFor(c);
    const key = row?.system ?? c;
    if (seen.has(key)) continue;
    seen.add(key);
    const stored = storedName(c);
    const verdict: boolean | null = row ? row.applies : stored && familyConditional.has(stored) ? true : null;
    if (verdict === true && stored) applying.push(stored);
    else if (verdict === true) notApplicable.push({ system: key, cause: 'no_periods' });
    else notApplicable.push({ system: stored ?? key, cause: verdict === false ? 'does_not_apply' : 'not_checked' });
  }
  return { applying, notApplicable, rowFor };
}

/**
 * The v2 clock: the stored preference when it is still selectable → the first conditional clock the engine says applies
 * (in `SELF_CLOCK_CONDITIONAL_ORDER`) → Vimshottari. `applicability` null means no `dasha.applicable` row is stored; the
 * activation family (`conditional`) is then the engine's verdict.
 */
export function resolveClockV2(preferred: string | null | undefined, present: readonly SystemPresence[], applicability: readonly ApplicabilityRow[] | null): ClockResolutionV2 {
  const has = new Set(present.map((p) => p.system));
  const { applying, notApplicable, rowFor } = conditionalVerdicts(present, applicability);
  // a conditional clock that is not stored and was never checked is noise, not a choice the person can see
  const shownNot = notApplicable.filter((n) => n.cause !== 'not_checked' || has.has(n.system) || rowFor(n.system));
  const blocked = new Set(shownNot.map((n) => n.system));

  const confirmCfg = getSelfConfirmSystems().filter((s) => has.has(s) && !blocked.has(s));
  const selectable = new Set([...applying, ...confirmCfg]);

  let primary: string;
  let reason: ClockResolutionV2['reason'];
  if (preferred && has.has(preferred) && selectable.has(preferred)) {
    primary = preferred;
    reason = 'preferred';
  } else if (applying[0]) {
    primary = applying[0];
    reason = 'conditional_applies';
  } else {
    primary = 'vimsottari';
    reason = 'default';
  }
  return {
    primary,
    reason,
    confirming: confirmCfg.filter((s) => s !== primary),
    applicable: [...new Set([primary, ...applying, ...confirmCfg])],
    notApplicable: shownNot.filter((n) => n.system !== primary),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The reading's clock set (docs/reading-engine/70 §4.1): the clocks whose dated rows are pulled and compared. Selection
// from configured lists and the engine's applicability verdicts only; which clock weighs most is not decided here.
// ---------------------------------------------------------------------------------------------------------------------

/** The year slot: the Tithi Pravesha year is never pulled on its own; its rows ride in every inventory. */
export const YEAR_CLOCK = 'tithi_pravesha';
/** The slot filled by the first conditional clock the engine says applies (in `SELF_CLOCK_CONDITIONAL_ORDER`). */
export const CONDITIONAL_SLOT = 'conditional';

export interface ReadingClockSet {
  /** the spine clock (`resolveClockV2`'s primary): its period edges cut the spans; always in the set */
  spine: string;
  /** the set in order, the year included as `tithi_pravesha` */
  clocks: string[];
  /** the systems whose inventories are pulled: `clocks` without the year, the spine included */
  pulled: string[];
  /** the conditional clock in the set, if one applies */
  conditional: string | null;
  skipped: Array<{ system: string; reason: 'no_periods' | 'does_not_apply' | 'none_applies' | 'limit' }>;
}

/**
 * The first `READING_CLOCKS` clocks of `READING_CLOCK_ORDER` that exist for the kundli, the year counted as one. A
 * system exists when it has stored periods (`present`); with nothing stored yet (the activation rows are built after
 * the first sync) every non-conditional system in the order counts, since the engine serves them all. A conditional
 * clock enters only on the engine's verdict. The spine is always kept: when the first clocks do not include it, it goes
 * first and the last clock drops.
 */
export function resolveReadingClocks(spine: string, present: readonly SystemPresence[], applicability: readonly ApplicabilityRow[] | null): ReadingClockSet {
  const has = new Set(present.map((p) => p.system));
  const { applying, notApplicable } = conditionalVerdicts(present, applicability);
  const conditionalNames = new Set([...getSelfClockConditionalOrder(), ...(applicability ?? []).flatMap((r) => [r.system, ...r.names])]);
  const blocked = new Map(notApplicable.map((n) => [n.system, n.cause]));
  const exists = (s: string) => (present.length ? has.has(s) : true);
  const skipped: ReadingClockSet['skipped'] = [];
  const ordered: string[] = [];
  let conditional: string | null = null;
  for (const slot of getReadingClockOrder()) {
    if (slot === YEAR_CLOCK) {
      ordered.push(YEAR_CLOCK);
    } else if (slot === CONDITIONAL_SLOT) {
      const c = applying.find((s) => !ordered.includes(s));
      if (c) {
        ordered.push(c);
        conditional ??= c;
      } else skipped.push({ system: CONDITIONAL_SLOT, reason: 'none_applies' });
    } else if (conditionalNames.has(slot) || blocked.has(slot)) {
      // a conditional system named in the order directly still needs the engine's verdict
      if (applying.includes(slot)) {
        ordered.push(slot);
        conditional ??= slot;
      } else skipped.push({ system: slot, reason: blocked.get(slot) === 'does_not_apply' ? 'does_not_apply' : 'no_periods' });
    } else if (exists(slot)) ordered.push(slot);
    else skipped.push({ system: slot, reason: 'no_periods' });
  }
  const unique = [...new Set(ordered)];
  const n = getReadingClocks();
  const head = unique.slice(0, n);
  const clocks = head.includes(spine) ? head : [spine, ...unique.filter((s) => s !== spine)].slice(0, n);
  for (const s of unique) if (!clocks.includes(s)) skipped.push({ system: s, reason: 'limit' });
  return { spine, clocks, pulled: clocks.filter((s) => s !== YEAR_CLOCK), conditional: clocks.includes(conditional ?? '') ? conditional : null, skipped };
}
