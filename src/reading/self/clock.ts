/**
 * The reading clock (technique `self.reading.clock`, docs/reading-engine/58 §4.1): which dasha system the You reading's
 * chapters follow for this kundli, and which clocks confirm them. Order: the kundli's stored preference when that system
 * has periods → the first conditional system the engine says applies (activation family `conditional`) → Vimshottari.
 * Selection only: applicability is the engine's verdict carried on the activation rows.
 */
import { getSelfClockConditionalOrder, getSelfConfirmSystems } from '../../config/env.js';
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
