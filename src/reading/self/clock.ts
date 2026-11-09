/**
 * The reading clock (technique `self.reading.clock`, docs/reading-engine/58 §4.1): which dasha system the You reading's
 * chapters follow for this kundli, and which clocks confirm them. Order: the kundli's stored preference when that system
 * has periods → the first conditional system the engine says applies (activation family `conditional`) → Vimshottari.
 * Selection only: applicability is the engine's verdict carried on the activation rows.
 */
import { getSelfClockConditionalOrder, getSelfConfirmSystems } from '../../config/env.js';
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
 * The v2 clock: the stored preference when it is still selectable → the first conditional clock the engine says applies
 * (in `SELF_CLOCK_CONDITIONAL_ORDER`) → Vimshottari. `applicability` null means no `dasha.applicable` row is stored; the
 * activation family (`conditional`) is then the engine's verdict.
 */
export function resolveClockV2(preferred: string | null | undefined, present: readonly SystemPresence[], applicability: readonly ApplicabilityRow[] | null): ClockResolutionV2 {
  const has = new Set(present.map((p) => p.system));
  const familyConditional = new Set(present.filter((p) => p.family === 'conditional').map((p) => p.system));
  const rowFor = (s: string) => applicability?.find((r) => r.system === s || r.names.includes(s)) ?? null;
  const storedName = (s: string): string | null => {
    if (has.has(s)) return s;
    return rowFor(s)?.names.find((n) => has.has(n)) ?? null;
  };

  const candidates = [...new Set([...getSelfClockConditionalOrder(), ...(applicability ?? []).map((r) => r.system)])];
  const applying: string[] = [];
  const notApplicable: ClockResolutionV2['notApplicable'] = [];
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
